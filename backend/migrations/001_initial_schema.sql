-- Initial Relational Schema for Kinteba Guush Family Genealogy Platform
-- SQLite compatible DDL with strict foreign keys and indexes

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY NOT NULL,
    canonical_name TEXT NOT NULL,
    display_name TEXT,
    gender TEXT,
    branch TEXT,
    notes TEXT,
    source_page INTEGER,
    source_heading TEXT,
    source_occurrence_id TEXT,
    status TEXT NOT NULL DEFAULT 'unverified',
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_people_canonical_name ON people(canonical_name);
CREATE INDEX IF NOT EXISTS idx_people_branch ON people(branch);
CREATE INDEX IF NOT EXISTS idx_people_status ON people(status);
CREATE INDEX IF NOT EXISTS idx_people_source_page ON people(source_page);

CREATE TABLE IF NOT EXISTS relationships (
    id TEXT PRIMARY KEY NOT NULL,
    from_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
    to_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
    rel_type TEXT NOT NULL, -- 'parent_child', 'partner_or_union', 'other_source_statement'
    status TEXT NOT NULL DEFAULT 'unverified',
    source_file TEXT NOT NULL,
    source_page INTEGER,
    source_wording TEXT NOT NULL,
    reviewer_notes TEXT,
    is_bio_confirmed INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rel_from_person ON relationships(from_person_id);
CREATE INDEX IF NOT EXISTS idx_rel_to_person ON relationships(to_person_id);
CREATE INDEX IF NOT EXISTS idx_rel_type ON relationships(rel_type);

CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, -- Argon2id hash with salt
    role TEXT NOT NULL DEFAULT 'archivist',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY NOT NULL,
    timestamp TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    reviewer TEXT NOT NULL,
    details TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp DESC);

