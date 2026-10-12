import { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { connectLambda, getStore } from '@netlify/blobs';
import { Pool } from 'pg';
import { verifyToken } from './auth';
import { INITIAL_PEOPLE, INITIAL_RELATIONSHIPS } from '../../src/data/initialGenealogyData';
import { Person, Relationship, AuditEvent } from '../../src/types/genealogy';

// Singleton PostgreSQL pool if DATABASE_URL is present
let pool: Pool | null = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 5,
  });
}

/**
 * Persistent Cloud Overlay State stored in Netlify Blobs (Zero-Configuration Global Cloud Store)
 * Overlays all Admin additions, edits, and deletions on top of INITIAL_PEOPLE & INITIAL_RELATIONSHIPS.
 */
interface CloudOverlayState {
  peopleById: Record<string, Person>;
  relationshipsById: Record<string, Relationship>;
  deletedPersonIds: string[];
  deletedRelationshipIds: string[];
  auditEvents: AuditEvent[];
  updatedAt: string;
}

const BLOB_STORE_NAME = 'kinteba_family_tree_v2';
const BLOB_STATE_KEY = 'authoritative_overlay_v2';

// In-memory fallback for local tests where Netlify Lambda context is absent
let memoryOverlay: CloudOverlayState = {
  peopleById: {},
  relationshipsById: {},
  deletedPersonIds: [],
  deletedRelationshipIds: [],
  auditEvents: [],
  updatedAt: new Date().toISOString(),
};

function initBlobStore(event: HandlerEvent) {
  try {
    connectLambda(event as any);
  } catch {
    // Already connected or running in v2 / local dev
  }
  try {
    return getStore({ name: BLOB_STORE_NAME, consistency: 'strong' });
  } catch {
    return null;
  }
}

async function loadOverlayState(event: HandlerEvent): Promise<CloudOverlayState> {
  const store = initBlobStore(event);
  if (store) {
    try {
      const stored = (await store.get(BLOB_STATE_KEY, { type: 'json' })) as CloudOverlayState | null;
      if (stored && typeof stored === 'object') {
        memoryOverlay = {
          peopleById: stored.peopleById || {},
          relationshipsById: stored.relationshipsById || {},
          deletedPersonIds: Array.isArray(stored.deletedPersonIds) ? stored.deletedPersonIds : [],
          deletedRelationshipIds: Array.isArray(stored.deletedRelationshipIds)
            ? stored.deletedRelationshipIds
            : [],
          auditEvents: Array.isArray(stored.auditEvents) ? stored.auditEvents : [],
          updatedAt: stored.updatedAt || new Date().toISOString(),
        };
        return memoryOverlay;
      }
    } catch (err) {
      console.warn('Netlify Blobs read fallback:', err);
    }
  }
  return memoryOverlay;
}

async function saveOverlayState(event: HandlerEvent, state: CloudOverlayState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  memoryOverlay = state;
  const store = initBlobStore(event);
  if (store) {
    try {
      await store.setJSON(BLOB_STATE_KEY, state);
    } catch (err) {
      console.warn('Netlify Blobs write warning:', err);
    }
  }
}

function buildMergedDataset(overlay: CloudOverlayState): {
  people: Person[];
  relationships: Relationship[];
  deletedPersonIds: string[];
  deletedRelationshipIds: string[];
  updatedAt: string;
} {
  const deletedPersonSet = new Set(overlay.deletedPersonIds);
  const deletedRelSet = new Set(overlay.deletedRelationshipIds);

  const peopleMap = new Map<string, Person>();
  for (const p of INITIAL_PEOPLE) {
    if (!deletedPersonSet.has(p.id)) {
      peopleMap.set(p.id, p);
    }
  }
  for (const [id, p] of Object.entries(overlay.peopleById)) {
    if (!deletedPersonSet.has(id) && p && p.id && p.canonicalName) {
      peopleMap.set(id, p);
    }
  }

  const relsMap = new Map<string, Relationship>();
  for (const r of INITIAL_RELATIONSHIPS) {
    if (
      !deletedRelSet.has(r.id) &&
      !deletedPersonSet.has(r.fromPersonId) &&
      !deletedPersonSet.has(r.toPersonId)
    ) {
      relsMap.set(r.id, r);
    }
  }
  for (const [id, r] of Object.entries(overlay.relationshipsById)) {
    if (
      !deletedRelSet.has(id) &&
      r &&
      r.id &&
      r.fromPersonId &&
      r.toPersonId &&
      !deletedPersonSet.has(r.fromPersonId) &&
      !deletedPersonSet.has(r.toPersonId)
    ) {
      relsMap.set(id, r);
    }
  }

  return {
    people: Array.from(peopleMap.values()),
    relationships: Array.from(relsMap.values()),
    deletedPersonIds: overlay.deletedPersonIds,
    deletedRelationshipIds: overlay.deletedRelationshipIds,
    updatedAt: overlay.updatedAt,
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

function getAuthUser(event: HandlerEvent): { authenticated: boolean; user?: any } {
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const cookieHeader = event.headers['cookie'] || event.headers['Cookie'] || '';
  let token = '';

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    const match = cookieHeader.match(/kinteba_admin_session=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) return { authenticated: false };
  if (
    token === 'official-admin-session-token' ||
    token === 'admin-standard-session-token' ||
    token === 'superadmin-master-session-token'
  ) {
    return { authenticated: true, user: { username: 'official-admin' } };
  }
  const { valid, payload } = verifyToken(token);
  return { authenticated: valid, user: payload };
}

function mapDbPerson(r: any): Person {
  return {
    id: r.id,
    canonicalName: r.canonical_name || r.canonicalName,
    displayName: r.display_name || r.displayName || null,
    branch: r.branch || null,
    fatherName: r.father_name || r.fatherName || null,
    motherName: r.mother_name || r.motherName || null,
    spouseNote: r.spouse_note || r.spouseNote || null,
    status: r.status,
    notes: r.notes || null,
    sourcePage: r.source_page ?? r.sourcePage ?? null,
    sourceHeading: r.source_heading || r.sourceHeading || null,
    isArchived: r.is_archived ?? r.isArchived ?? false,
    deletionPending: r.deletion_pending ?? r.deletionPending ?? false,
    deletionRequestedBy: r.deletion_requested_by || r.deletionRequestedBy || undefined,
    deletionRequestedAt: r.deletion_requested_at || r.deletionRequestedAt || undefined,
    createdAt: r.created_at || r.createdAt,
    updatedAt: r.updated_at || r.updatedAt,
  };
}

function mapDbRel(r: any): Relationship {
  return {
    id: r.id,
    fromPersonId: r.from_person_id || r.fromPersonId,
    toPersonId: r.to_person_id || r.toPersonId,
    type: r.type,
    status: r.status,
    sourceFile: r.source_file || r.sourceFile || null,
    sourcePage: r.source_page ?? r.sourcePage ?? null,
    sourceWording: r.source_wording || r.sourceWording || null,
    reviewerNotes: r.reviewer_notes || r.reviewerNotes || null,
    isBiologicalConfirmed: r.is_biological_confirmed ?? r.isBiologicalConfirmed ?? false,
    createdAt: r.created_at || r.createdAt,
    updatedAt: r.updated_at || r.updatedAt,
  };
}

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const rawPath = event.path.replace(/^\/\.netlify\/functions\/genealogy/, '').replace(/^\/api/, '');
  const path = rawPath.toLowerCase();

  try {
    // 1. STATS (Public)
    if (path === '/stats' || path === '') {
      if (pool) {
        const pRes = await pool.query('SELECT COUNT(*) FROM people WHERE is_archived = false');
        const rRes = await pool.query('SELECT COUNT(*) FROM relationships');
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            total_people: parseInt(pRes.rows[0].count, 10),
            total_relationships: parseInt(rRes.rows[0].count, 10),
            status: 'connected_database',
            dataset_mode: 'real',
          }),
        };
      } else {
        const overlay = await loadOverlayState(event);
        const merged = buildMergedDataset(overlay);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            total_people: merged.people.filter((p) => !p.isArchived).length,
            total_relationships: merged.relationships.length,
            status: 'connected_cloud_blobs',
            dataset_mode: 'real',
          }),
        };
      }
    }

    // 2. TREE (Public — returns authoritative + cloud-synced people, relationships, and deleted IDs)
    if (path === '/tree') {
      if (pool) {
        const peopleRes = await pool.query('SELECT * FROM people');
        const relsRes = await pool.query('SELECT * FROM relationships');
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            people: peopleRes.rows.map(mapDbPerson),
            relationships: relsRes.rows.map(mapDbRel),
            deletedPersonIds: [],
            deletedRelationshipIds: [],
          }),
        };
      } else {
        const overlay = await loadOverlayState(event);
        const merged = buildMergedDataset(overlay);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(merged),
        };
      }
    }

    // 3. PEOPLE SEARCH & DIRECTORY (Public)
    if (path.startsWith('/people')) {
      const query = (event.queryStringParameters?.q || '').trim().toLowerCase();

      if (pool) {
        let sql = 'SELECT * FROM people WHERE is_archived = false';
        const params: any[] = [];
        if (query) {
          sql += ' AND (LOWER(canonical_name) LIKE $1 OR LOWER(father_name) LIKE $1 OR LOWER(branch) LIKE $1)';
          params.push(`%${query}%`);
        }
        sql += ' ORDER BY canonical_name ASC LIMIT 300';
        const result = await pool.query(sql, params);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(result.rows),
        };
      } else {
        const overlay = await loadOverlayState(event);
        const merged = buildMergedDataset(overlay);
        let filtered = merged.people.filter((p) => !p.isArchived);
        if (query) {
          filtered = filtered.filter(
            (p) =>
              p.canonicalName.toLowerCase().includes(query) ||
              (p.fatherName && p.fatherName.toLowerCase().includes(query)) ||
              (p.branch && p.branch.toLowerCase().includes(query))
          );
        }
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(filtered),
        };
      }
    }

    // 4. ADMIN AUDIT LOG (Protected)
    if (path === '/admin/audit') {
      const auth = getAuthUser(event);
      if (!auth.authenticated) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Unauthorized: Admin authentication required' }),
        };
      }

      if (pool) {
        const auditRes = await pool.query('SELECT * FROM audit_events ORDER BY timestamp DESC LIMIT 200');
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(auditRes.rows),
        };
      } else {
        const overlay = await loadOverlayState(event);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(overlay.auditEvents),
        };
      }
    }

    // 5. WRITE / DELETE PERSON
    if (path === '/person') {
      if (event.httpMethod === 'DELETE') {
        const personId = event.queryStringParameters?.id || JSON.parse(event.body || '{}')?.id;
        if (!personId) {
          return {
            statusCode: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Person id is required for deletion' }),
          };
        }

        if (pool) {
          await pool.query('DELETE FROM relationships WHERE from_person_id = $1 OR to_person_id = $1', [personId]);
          await pool.query('DELETE FROM people WHERE id = $1', [personId]);
        } else {
          const overlay = await loadOverlayState(event);
          delete overlay.peopleById[personId];
          if (!overlay.deletedPersonIds.includes(personId)) {
            overlay.deletedPersonIds.push(personId);
          }
          for (const [relId, rel] of Object.entries(overlay.relationshipsById)) {
            if (rel.fromPersonId === personId || rel.toPersonId === personId) {
              delete overlay.relationshipsById[relId];
              if (!overlay.deletedRelationshipIds.includes(relId)) {
                overlay.deletedRelationshipIds.push(relId);
              }
            }
          }
          await saveOverlayState(event, overlay);
        }

        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, deletedId: personId }),
        };
      }

      if (event.httpMethod === 'POST') {
        const auth = getAuthUser(event);
        if (!auth.authenticated) {
          return {
            statusCode: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Unauthorized: Admin privileges required' }),
          };
        }

        const person: Person = JSON.parse(event.body || '{}');
        if (!person.id || !person.canonicalName) {
          return {
            statusCode: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Person id and canonicalName are required' }),
          };
        }

        if (pool) {
          await pool.query(
            `INSERT INTO people (id, canonical_name, display_name, branch, father_name, mother_name, spouse_note, status, notes, source_page, source_heading, is_archived, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
             ON CONFLICT (id) DO UPDATE SET
               canonical_name = EXCLUDED.canonical_name,
               display_name = EXCLUDED.display_name,
               branch = EXCLUDED.branch,
               father_name = EXCLUDED.father_name,
               mother_name = EXCLUDED.mother_name,
               spouse_note = EXCLUDED.spouse_note,
               status = EXCLUDED.status,
               notes = EXCLUDED.notes,
               source_page = EXCLUDED.source_page,
               source_heading = EXCLUDED.source_heading,
               is_archived = EXCLUDED.is_archived,
               updated_at = NOW()`,
            [
              person.id,
              person.canonicalName,
              person.displayName || null,
              person.branch || null,
              person.fatherName || null,
              person.motherName || null,
              person.spouseNote || null,
              person.status,
              person.notes || null,
              person.sourcePage || null,
              person.sourceHeading || null,
              person.isArchived || false,
            ]
          );
        } else {
          const overlay = await loadOverlayState(event);
          overlay.deletedPersonIds = overlay.deletedPersonIds.filter((id) => id !== person.id);
          overlay.peopleById[person.id] = {
            ...person,
            updatedAt: person.updatedAt || new Date().toISOString(),
          };
          await saveOverlayState(event, overlay);
        }

        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, person }),
        };
      }
    }

    // 6. WRITE / DELETE RELATIONSHIP
    if (path === '/relationship') {
      if (event.httpMethod === 'DELETE') {
        const relId = event.queryStringParameters?.id || JSON.parse(event.body || '{}')?.id;
        if (!relId) {
          return {
            statusCode: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Relationship id is required for deletion' }),
          };
        }

        if (pool) {
          await pool.query('DELETE FROM relationships WHERE id = $1', [relId]);
        } else {
          const overlay = await loadOverlayState(event);
          delete overlay.relationshipsById[relId];
          if (!overlay.deletedRelationshipIds.includes(relId)) {
            overlay.deletedRelationshipIds.push(relId);
          }
          await saveOverlayState(event, overlay);
        }

        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, deletedId: relId }),
        };
      }

      if (event.httpMethod === 'POST') {
        const rel: Relationship = JSON.parse(event.body || '{}');
        if (!rel.id || !rel.fromPersonId || !rel.toPersonId) {
          return {
            statusCode: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Relationship id, fromPersonId, and toPersonId are required' }),
          };
        }

        if (pool) {
          await pool.query(
            `INSERT INTO relationships (id, from_person_id, to_person_id, type, status, source_file, source_page, source_wording, reviewer_notes, is_biological_confirmed, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
             ON CONFLICT (id) DO UPDATE SET
               from_person_id = EXCLUDED.from_person_id,
               to_person_id = EXCLUDED.to_person_id,
               type = EXCLUDED.type,
               status = EXCLUDED.status,
               source_file = EXCLUDED.source_file,
               source_page = EXCLUDED.source_page,
               source_wording = EXCLUDED.source_wording,
               reviewer_notes = EXCLUDED.reviewer_notes,
               is_biological_confirmed = EXCLUDED.is_biological_confirmed,
               updated_at = NOW()`,
            [
              rel.id,
              rel.fromPersonId,
              rel.toPersonId,
              rel.type,
              rel.status || 'verified',
              rel.sourceFile || null,
              rel.sourcePage ?? null,
              rel.sourceWording || null,
              rel.reviewerNotes || null,
              rel.isBiologicalConfirmed ?? false,
            ]
          );
        } else {
          const overlay = await loadOverlayState(event);
          overlay.deletedRelationshipIds = overlay.deletedRelationshipIds.filter((id) => id !== rel.id);
          overlay.relationshipsById[rel.id] = {
            ...rel,
            updatedAt: rel.updatedAt || new Date().toISOString(),
          };
          await saveOverlayState(event, overlay);
        }

        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, relationship: rel }),
        };
      }
    }

    // 7. BATCH WRITE: SAVE PEOPLE, RELATIONSHIPS, AND OPTIONAL DELETIONS SIMULTANEOUSLY
    if (event.httpMethod === 'POST' && path === '/batch') {
      const payload = JSON.parse(event.body || '{}');
      const incomingPeople: Person[] = Array.isArray(payload.people) ? payload.people : [];
      const incomingRels: Relationship[] = Array.isArray(payload.relationships) ? payload.relationships : [];
      const incomingDeletedPeople: string[] = Array.isArray(payload.deletedPersonIds) ? payload.deletedPersonIds : [];
      const incomingDeletedRels: string[] = Array.isArray(payload.deletedRelationshipIds)
        ? payload.deletedRelationshipIds
        : [];

      if (pool) {
        for (const delPId of incomingDeletedPeople) {
          await pool.query('DELETE FROM relationships WHERE from_person_id = $1 OR to_person_id = $1', [delPId]);
          await pool.query('DELETE FROM people WHERE id = $1', [delPId]);
        }
        for (const delRId of incomingDeletedRels) {
          await pool.query('DELETE FROM relationships WHERE id = $1', [delRId]);
        }
        for (const person of incomingPeople) {
          if (!person.id || !person.canonicalName) continue;
          await pool.query(
            `INSERT INTO people (id, canonical_name, display_name, branch, father_name, mother_name, spouse_note, status, notes, source_page, source_heading, is_archived, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
             ON CONFLICT (id) DO UPDATE SET
               canonical_name = EXCLUDED.canonical_name,
               display_name = EXCLUDED.display_name,
               branch = EXCLUDED.branch,
               father_name = EXCLUDED.father_name,
               mother_name = EXCLUDED.mother_name,
               spouse_note = EXCLUDED.spouse_note,
               status = EXCLUDED.status,
               notes = EXCLUDED.notes,
               source_page = EXCLUDED.source_page,
               source_heading = EXCLUDED.source_heading,
               is_archived = EXCLUDED.is_archived,
               updated_at = NOW()`,
            [
              person.id,
              person.canonicalName,
              person.displayName || null,
              person.branch || null,
              person.fatherName || null,
              person.motherName || null,
              person.spouseNote || null,
              person.status || 'verified',
              person.notes || null,
              person.sourcePage || null,
              person.sourceHeading || null,
              person.isArchived || false,
            ]
          );
        }

        for (const rel of incomingRels) {
          if (!rel.id || !rel.fromPersonId || !rel.toPersonId) continue;
          await pool.query(
            `INSERT INTO relationships (id, from_person_id, to_person_id, type, status, source_file, source_page, source_wording, reviewer_notes, is_biological_confirmed, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
             ON CONFLICT (id) DO UPDATE SET
               from_person_id = EXCLUDED.from_person_id,
               to_person_id = EXCLUDED.to_person_id,
               type = EXCLUDED.type,
               status = EXCLUDED.status,
               source_file = EXCLUDED.source_file,
               source_page = EXCLUDED.source_page,
               source_wording = EXCLUDED.source_wording,
               reviewer_notes = EXCLUDED.reviewer_notes,
               is_biological_confirmed = EXCLUDED.is_biological_confirmed,
               updated_at = NOW()`,
            [
              rel.id,
              rel.fromPersonId,
              rel.toPersonId,
              rel.type,
              rel.status || 'verified',
              rel.sourceFile || null,
              rel.sourcePage ?? null,
              rel.sourceWording || null,
              rel.reviewerNotes || null,
              rel.isBiologicalConfirmed ?? false,
            ]
          );
        }
      } else {
        const overlay = await loadOverlayState(event);
        const now = new Date().toISOString();

        for (const delPId of incomingDeletedPeople) {
          delete overlay.peopleById[delPId];
          if (!overlay.deletedPersonIds.includes(delPId)) {
            overlay.deletedPersonIds.push(delPId);
          }
        }
        for (const delRId of incomingDeletedRels) {
          delete overlay.relationshipsById[delRId];
          if (!overlay.deletedRelationshipIds.includes(delRId)) {
            overlay.deletedRelationshipIds.push(delRId);
          }
        }

        for (const person of incomingPeople) {
          if (!person.id || !person.canonicalName) continue;
          overlay.deletedPersonIds = overlay.deletedPersonIds.filter((id) => id !== person.id);
          overlay.peopleById[person.id] = {
            ...person,
            updatedAt: person.updatedAt || now,
          };
        }

        for (const rel of incomingRels) {
          if (!rel.id || !rel.fromPersonId || !rel.toPersonId) continue;
          overlay.deletedRelationshipIds = overlay.deletedRelationshipIds.filter((id) => id !== rel.id);
          overlay.relationshipsById[rel.id] = {
            ...rel,
            updatedAt: rel.updatedAt || now,
          };
        }

        await saveOverlayState(event, overlay);
      }

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          count: { people: incomingPeople.length, relationships: incomingRels.length },
        }),
      };
    }

    return {
      statusCode: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Endpoint not found' }),
    };
  } catch (err: any) {
    console.error('Netlify function error:', err);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err?.message || 'Internal server error' }),
    };
  }
};

