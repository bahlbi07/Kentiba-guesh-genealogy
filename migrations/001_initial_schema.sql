-- 001_initial_schema.sql
-- Production PostgreSQL / Neon Schema for Kinteba Guush Family Genealogy (ተወለድ እንዳቦይ ከንትባ ጉዕሽ)

CREATE TABLE IF NOT EXISTS people (
    id VARCHAR(64) PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    display_name TEXT,
    branch TEXT,
    father_name TEXT,
    mother_name TEXT,
    spouse_note TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'unverified',
    notes TEXT,
    source_page INTEGER,
    source_heading TEXT,
    source_occurrence_id VARCHAR(64),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_people_canonical_name ON people(canonical_name);
CREATE INDEX IF NOT EXISTS idx_people_father_name ON people(father_name);
CREATE INDEX IF NOT EXISTS idx_people_branch ON people(branch);
CREATE INDEX IF NOT EXISTS idx_people_status ON people(status);

CREATE TABLE IF NOT EXISTS relationships (
    id VARCHAR(64) PRIMARY KEY,
    from_person_id VARCHAR(64) NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    to_person_id VARCHAR(64) NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'unverified',
    source_file TEXT,
    source_page INTEGER,
    source_wording TEXT,
    reviewer_notes TEXT,
    is_biological_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_relationships_from_person ON relationships(from_person_id);
CREATE INDEX IF NOT EXISTS idx_relationships_to_person ON relationships(to_person_id);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);
CREATE INDEX IF NOT EXISTS idx_relationships_status ON relationships(status);

CREATE TABLE IF NOT EXISTS source_occurrences (
    id VARCHAR(64) PRIMARY KEY,
    source_file TEXT NOT NULL,
    page INTEGER NOT NULL,
    heading_or_block TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    linked_person_id VARCHAR(64) REFERENCES people(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'linked',
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_occurrences_page ON source_occurrences(page);
CREATE INDEX IF NOT EXISTS idx_occurrences_linked_person ON source_occurrences(linked_person_id);

CREATE TABLE IF NOT EXISTS audit_events (
    id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    entity_type VARCHAR(32) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL,
    reviewer TEXT NOT NULL,
    details TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events(timestamp DESC);

CREATE TABLE IF NOT EXISTS app_metadata (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL
);

-- Seed initial app metadata
INSERT INTO app_metadata (key, value)
VALUES ('dataset_version', '{"version": "1.0.0", "dataset": "real", "title": "ተወለድ እንዳቦይ ከንትባ ጉዕሽ"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

