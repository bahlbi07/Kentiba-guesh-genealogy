import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let client: SupabaseClient | null = null;

export function isCloudConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('placeholder') &&
    supabaseAnonKey.length > 20
  );
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isCloudConfigured()) {
    return null;
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

/**
 * SQL Schema script for initializing Supabase PostgreSQL tables with Row Level Security (RLS).
 * This can be run in the Supabase SQL Editor by the user.
 */
export const SUPABASE_SQL_MIGRATION = `
-- Kinteba Guush Family Genealogy Schema with RLS
-- PostgreSQL / Supabase Migration

-- 1. Create Tables
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  display_name TEXT,
  gender TEXT DEFAULT 'unknown',
  branch TEXT,
  notes TEXT,
  source_page INTEGER,
  source_heading TEXT,
  source_occurrence_id TEXT,
  status TEXT NOT NULL DEFAULT 'unverified',
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  from_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  to_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unverified',
  source_file TEXT NOT NULL,
  source_page INTEGER,
  source_wording TEXT NOT NULL,
  reviewer_notes TEXT,
  is_biological_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_occurrences (
  id TEXT PRIMARY KEY,
  source_file TEXT NOT NULL,
  page INTEGER NOT NULL,
  heading_or_block TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  linked_person_id TEXT REFERENCES people(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  details TEXT NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies: Authenticated Users can read and write; Public read-only if explicitly enabled
CREATE POLICY "Allow authenticated read and write on people" ON people
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read and write on relationships" ON relationships
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read and write on occurrences" ON source_occurrences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read and write on audit" ON audit_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
`;
