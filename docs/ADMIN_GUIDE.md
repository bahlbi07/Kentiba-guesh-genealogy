# Archivist Administration & Data Management Guide

**Project:** Kinteba Guush Family Genealogy Platform (`ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ`)  
**Target Audience:** Family Archivists and Designated Administrators  

---

## 1. Overview & Separation of Roles

The Kinteba Guush Family Genealogy platform strictly segregates public viewing from archivist management:
- **Public Visitors / Relatives:** Can freely browse the progressive family tree, search names, view immediate family relationships, and read historical context. They cannot alter, import, or delete family records.
- **Authorized Archivists:** Have access to the **Archivist Admin Portal** (`ኣካያዲ`) protected by password authentication and server-side authorization.

---

## 2. Setting Up the First Administrator

To prevent security vulnerabilities, no default administrator accounts or hardcoded passwords exist in the repository.

### Option A: Using the Rust Backend CLI
When running the Rust backend API (`backend/`), initialize the administrator account using the secure `init_admin` CLI tool:

```powershell
cd C:\Users\Bale\My_ALL_PROJECTS\1\Kinteba_Guush_Family_Genealogy\backend
cargo run --bin init_admin -- --username archivist --password "YourStrongPasswordHere"
```

The tool:
1. Validates that the password is at least 8 characters long.
2. Hashes the password using **Argon2id** with a cryptographically secure random salt.
3. Inserts the user record into the SQLite `admin_users` table.

### Option B: Local Mode Session
When running purely in local-first browser mode without the Rust API running, enter:
- **Username:** `archivist` or `admin`
- **Password:** A password of at least 6 characters (e.g., your personal passcode).

---

## 3. Accessing the Admin Area

1. Click the **"ኣካያዲ (Admin)"** button in the top navigation bar (or bottom navigation bar on mobile).
2. Enter your archivist username and password.
3. Upon authentication, a green status badge (**"Authenticated"**) will appear, granting access to the archivist control panels:
   - **ሓፈሻዊ ጸብጻብ (Overview):** Live count of people, relationships, and verification health.
   - **ምምርማር ዘድልዮም (Needs Review):** Dedicated interface for the 6 remaining flagged records.
   - **መዝገብ ምእታው (Staged Import):** The staged import pipeline with the explicit user approval gate.
   - **ባክኣፕን ኤክስፖርትን (Backup/Restore):** JSON backup download and validated database restore.
   - **ናይ ለውጢ ታሪኽ (Audit Trail):** Complete history of additions, edits, and deletions.

---

## 4. Key Administrative Operations

### Adding a Person
1. Click **"ሓድሽ ሰብ ወስኽ"** (Add New Person) in the admin bar.
2. Enter the canonical Tigrinya name (e.g., `ጎብሩ`), optional family branch (e.g., `ጎብሩ`), and notes.
3. Click **"ኣጽድቕ"** (Save). The person is created with an immutable stable ID.

### Editing or Deleting a Person
1. Open the person from the directory or tree.
2. Click **"ምሉእ መረዳእታ ርአ"** (View Details) &rarr; **"Edit"**.
3. **Deletion Safeguards:** Before deleting an individual, review whether they have dependent child relationships. Deleting an individual with dependent children requires reassigning or resolving their relationships first to protect family tree integrity.

### Adding a Relationship
1. Click **"ዝምድና ወስኽ"** (Add Relationship).
2. Select the parent/first person and child/partner.
3. Select relationship type: `parent_child`, `partner_or_union`, or `other_source_statement`.
4. Enter the source page and source quotation.
5. The cycle detector verifies the graph. If valid, the relationship is saved.

### Staged Import Approval Workflow
1. Navigate to **"መዝገብ ምእታው (Staged Import)"**.
2. Review the verified metrics:
   - **539** Distinct Person Records
   - **538** Source Name Occurrences
   - **348** Proposed Relationships
   - **92** Repeated Name Groups
   - **6** Remaining Needs-Review Items
3. Verify the **Pre-Flight Check: Passed** badge.
4. Check the authorization checkbox:  
   `[x] I have reviewed the staging metrics and authorize importing these records into the local database.`
5. Click **"Commit Verified Import"**.

---

## 5. Backup & Disaster Recovery Procedures

### Taking a Backup
1. In the Admin Area, go to **"ባክኣፕን ኤክስፖርትን"**.
2. Click **"Download JSON"**.
3. A complete backup file (`kinteba_guush_genealogy_backup_YYYY-MM-DD.json`) will download containing all persons, relationships, occurrences, and audit events.
4. **Best Practice:** Store this file in a secure location (e.g., USB drive, encrypted cloud drive).

### Restoring from a Backup
1. Go to **"Restore from JSON Backup"**.
2. Select your `.json` backup file.
3. The system checks file structure, schema integrity, and person IDs.
4. Click **"Restore Backup to Database"** to commit the restore.

