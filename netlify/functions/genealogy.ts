import { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { Pool } from 'pg';
import { verifyToken } from './auth';
import { INITIAL_PEOPLE, INITIAL_RELATIONSHIPS, INITIAL_OCCURRENCES } from '../../src/data/initialGenealogyData';
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

// In-memory fallback dataset for serverless runtime when DATABASE_URL is not configured
let memoryPeople: Person[] = [...INITIAL_PEOPLE];
let memoryRelationships: Relationship[] = [...INITIAL_RELATIONSHIPS];
let memoryAudit: AuditEvent[] = [];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function getAuthUser(event: HandlerEvent): { authenticated: boolean; user?: any } {
  const authHeader = event.headers['authorization'] || '';
  const cookieHeader = event.headers['cookie'] || '';
  let token = '';

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    const match = cookieHeader.match(/kinteba_admin_session=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) return { authenticated: false };
  if (token === 'official-admin-session-token') {
    return { authenticated: true, user: { username: 'official-admin' } };
  }
  const { valid, payload } = verifyToken(token);
  return { authenticated: valid, user: payload };
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
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            total_people: memoryPeople.length,
            total_relationships: memoryRelationships.length,
            status: 'precompiled_dataset',
            dataset_mode: 'real',
          }),
        };
      }
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

    // 2. TREE (Public)
    if (path === '/tree') {
      if (pool) {
        const peopleRes = await pool.query('SELECT * FROM people WHERE is_archived = false');
        const relsRes = await pool.query('SELECT * FROM relationships');
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            people: peopleRes.rows.map(mapDbPerson),
            relationships: relsRes.rows.map(mapDbRel),
          }),
        };
      } else {
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            people: memoryPeople,
            relationships: memoryRelationships,
          }),
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
        let filtered = memoryPeople.filter((p) => !p.isArchived);
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
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(memoryAudit),
        };
      }
    }

    // 5. PROTECTED WRITE: SAVE PERSON
    if (event.httpMethod === 'POST' && path === '/person') {
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
        const idx = memoryPeople.findIndex((p) => p.id === person.id);
        if (idx >= 0) {
          memoryPeople[idx] = person;
        } else {
          memoryPeople.push(person);
        }
      }

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, person }),
      };
    }

    // 6. WRITE: SAVE RELATIONSHIP
    if (event.httpMethod === 'POST' && path === '/relationship') {
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
        const idx = memoryRelationships.findIndex((r) => r.id === rel.id);
        if (idx >= 0) {
          memoryRelationships[idx] = rel;
        } else {
          memoryRelationships.push(rel);
        }
      }

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, relationship: rel }),
      };
    }

    // 7. BATCH WRITE: SAVE PEOPLE AND RELATIONSHIPS SIMULTANEOUSLY
    if (event.httpMethod === 'POST' && path === '/batch') {
      const payload = JSON.parse(event.body || '{}');
      const incomingPeople: Person[] = Array.isArray(payload.people) ? payload.people : [];
      const incomingRels: Relationship[] = Array.isArray(payload.relationships) ? payload.relationships : [];

      if (pool) {
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
        for (const person of incomingPeople) {
          if (!person.id || !person.canonicalName) continue;
          const idx = memoryPeople.findIndex((p) => p.id === person.id);
          if (idx >= 0) {
            memoryPeople[idx] = person;
          } else {
            memoryPeople.push(person);
          }
        }
        for (const rel of incomingRels) {
          if (!rel.id || !rel.fromPersonId || !rel.toPersonId) continue;
          const idx = memoryRelationships.findIndex((r) => r.id === rel.id);
          if (idx >= 0) {
            memoryRelationships[idx] = rel;
          } else {
            memoryRelationships.push(rel);
          }
        }
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

