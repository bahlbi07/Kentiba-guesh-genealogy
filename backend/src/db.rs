use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonModel {
    pub id: String,
    pub canonical_name: String,
    pub display_name: Option<String>,
    pub gender: Option<String>,
    pub branch: Option<String>,
    pub notes: Option<String>,
    pub source_page: Option<i64>,
    pub source_heading: Option<String>,
    pub status: String,
    pub is_archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationshipModel {
    pub id: String,
    pub from_person_id: String,
    pub to_person_id: String,
    pub rel_type: String,
    pub status: String,
    pub source_file: String,
    pub source_page: Option<i64>,
    pub source_wording: String,
    pub reviewer_notes: Option<String>,
    pub is_bio_confirmed: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEventModel {
    pub id: String,
    pub timestamp: String,
    pub entity_type: String,
    pub entity_id: String,
    pub action: String,
    pub reviewer: String,
    pub details: String,
}

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn open(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;

        // Initialize schema
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS people (
                id TEXT PRIMARY KEY NOT NULL,
                canonical_name TEXT NOT NULL,
                display_name TEXT,
                gender TEXT,
                branch TEXT,
                notes TEXT,
                source_page INTEGER,
                source_heading TEXT,
                status TEXT NOT NULL DEFAULT 'unverified',
                is_archived INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS relationships (
                id TEXT PRIMARY KEY NOT NULL,
                from_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
                to_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
                rel_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'unverified',
                source_file TEXT NOT NULL,
                source_page INTEGER,
                source_wording TEXT NOT NULL,
                reviewer_notes TEXT,
                is_bio_confirmed INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS admin_users (
                id TEXT PRIMARY KEY NOT NULL,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
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
            "#,
        )?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn get_people_count(&self) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.query_row("SELECT COUNT(*) FROM people WHERE is_archived = 0", [], |row| {
            row.get(0)
        })
    }

    pub fn get_relationships_count(&self) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.query_row("SELECT COUNT(*) FROM relationships", [], |row| row.get(0))
    }

    pub fn get_all_people(&self, limit: i64, offset: i64) -> Result<Vec<PersonModel>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, canonical_name, display_name, gender, branch, notes, source_page, source_heading, status, is_archived, created_at, updated_at 
             FROM people WHERE is_archived = 0 ORDER BY canonical_name LIMIT ?1 OFFSET ?2",
        )?;
        let rows = stmt.query_map(params![limit, offset], |row| {
            Ok(PersonModel {
                id: row.get(0)?,
                canonical_name: row.get(1)?,
                display_name: row.get(2)?,
                gender: row.get(3)?,
                branch: row.get(4)?,
                notes: row.get(5)?,
                source_page: row.get(6)?,
                source_heading: row.get(7)?,
                status: row.get(8)?,
                is_archived: row.get::<_, i64>(9)? != 0,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        let mut results = Vec::new();
        for r in rows {
            results.push(r?);
        }
        Ok(results)
    }

    pub fn search_people(&self, query: &str, limit: i64) -> Result<Vec<PersonModel>> {
        let conn = self.conn.lock().unwrap();
        let pattern = format!("%{}%", query);
        let mut stmt = conn.prepare(
            "SELECT id, canonical_name, display_name, gender, branch, notes, source_page, source_heading, status, is_archived, created_at, updated_at 
             FROM people 
             WHERE is_archived = 0 AND (canonical_name LIKE ?1 OR display_name LIKE ?1 OR id LIKE ?1 OR branch LIKE ?1)
             ORDER BY canonical_name LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![pattern, limit], |row| {
            Ok(PersonModel {
                id: row.get(0)?,
                canonical_name: row.get(1)?,
                display_name: row.get(2)?,
                gender: row.get(3)?,
                branch: row.get(4)?,
                notes: row.get(5)?,
                source_page: row.get(6)?,
                source_heading: row.get(7)?,
                status: row.get(8)?,
                is_archived: row.get::<_, i64>(9)? != 0,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        let mut results = Vec::new();
        for r in rows {
            results.push(r?);
        }
        Ok(results)
    }

    pub fn get_all_relationships(&self) -> Result<Vec<RelationshipModel>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, from_person_id, to_person_id, rel_type, status, source_file, source_page, source_wording, reviewer_notes, is_bio_confirmed, created_at, updated_at 
             FROM relationships",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(RelationshipModel {
                id: row.get(0)?,
                from_person_id: row.get(1)?,
                to_person_id: row.get(2)?,
                rel_type: row.get(3)?,
                status: row.get(4)?,
                source_file: row.get(5)?,
                source_page: row.get(6)?,
                source_wording: row.get(7)?,
                reviewer_notes: row.get(8)?,
                is_bio_confirmed: row.get::<_, i64>(9)? != 0,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        let mut results = Vec::new();
        for r in rows {
            results.push(r?);
        }
        Ok(results)
    }

    pub fn insert_audit_event(&self, event: &AuditEventModel) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO audit_events (id, timestamp, entity_type, entity_id, action, reviewer, details) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                event.id,
                event.timestamp,
                event.entity_type,
                event.entity_id,
                event.action,
                event.reviewer,
                event.details
            ],
        )?;
        Ok(())
    }

    pub fn get_audit_events(&self, limit: i64) -> Result<Vec<AuditEventModel>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, timestamp, entity_type, entity_id, action, reviewer, details 
             FROM audit_events ORDER BY timestamp DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit], |row| {
            Ok(AuditEventModel {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                entity_type: row.get(2)?,
                entity_id: row.get(3)?,
                action: row.get(4)?,
                reviewer: row.get(5)?,
                details: row.get(6)?,
            })
        })?;

        let mut results = Vec::new();
        for r in rows {
            results.push(r?);
        }
        Ok(results)
    }

    pub fn get_admin_password_hash(&self, username: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT password_hash FROM admin_users WHERE username = ?1")?;
        let mut rows = stmt.query(params![username])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_admin_user(&self, username: &str, password_hash: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let id = format!("user_{}", uuid::Uuid::new_v4());
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            r#"
            INSERT INTO admin_users (id, username, password_hash, role, created_at, updated_at)
            VALUES (?1, ?2, ?3, 'archivist', ?4, ?4)
            ON CONFLICT(username) DO UPDATE SET password_hash = ?3, updated_at = ?4
            "#,
            params![id, username, password_hash, now],
        )?;
        Ok(())
    }
}

