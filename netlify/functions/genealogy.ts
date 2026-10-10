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

    // 2. TREE (Public)
    if (path === '/tree') {
      if (pool) {
        const peopleRes = await pool.query('SELECT * FROM people WHERE is_archived = false');
        const relsRes = await pool.query('SELECT * FROM relationships');
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            people: peopleRes.rows,
            relationships: relsRes.rows,
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

