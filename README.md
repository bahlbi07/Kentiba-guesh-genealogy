# Kinteba Guush Family Genealogy | ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ

A modern, responsive, source-faithful family history archive and interactive genealogy application built for the descendants of **Kinteba Guush Hagos** (`ከንቲባ ጉዑሽ ሓጎስ`).

## Project Overview

- **Source Records Authority:** Transcribed from **`ከሰተ-ብርሃነ.pdf`** via **`source/family_genealogy_register.md`**.
- **Patriarch Root:** ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ
- **Attribution:** ጸሓፊ ከሰተ ብርሃነ ወልዱ ወዲ ጎብሩ ካብ ጁባ ደቡብ ሱዳን
- **Architecture:** Local-first React + TypeScript + Vite with IndexedDB persistence, SVG interactive tree visualization, accessible hierarchical alternative, referential DAG cycle prevention, and optional free-tier Supabase cloud synchronization.

---

## Key Capabilities

1. **Source Provenance & Fidelity:**
   - Preserves exact Tigrinya/Ge'ez Unicode orthography, titles, spacing, and variant spellings without silent normalization.
   - Every individual occurrence receives a distinct stable ID (`#pers_p...`).
   - People sharing the same name are **never merged** into single records.
   - Tracks source PDF page and exact citation phrases with every relationship link.

2. **Interactive Family Tree Viewer:**
   - Hierarchical generation layout with zoom, pan, fit-to-view, and branch focus.
   - Visually distinct lines for verified biological parentage (solid), needs-review links (dashed amber), and union statements (purple).
   - Dedicated toggle for an accessible, screen-reader-compliant hierarchical list alternative (`TreeListAlternative.tsx`).

3. **People Directory & Search:**
   - Multi-factor search across Tigrinya and English names, IDs, branches, and pages.
   - Dedicated filter to isolate people with repeated/shared names across generations.

4. **Staged Source Import & Approval Gate:**
   - Reads `source/family_genealogy_register.md` and generates structured pre-import preview stats (breakdown by PDF page, duplicate names table, uncertain block list).
   - Validation dry-run with DAG cycle checking.
   - Requires explicit human approval before committing real records to IndexedDB.

5. **Backup, Export & Disaster Recovery:**
   - Complete JSON backup with full round-trip restoration.
   - CSV export for people and relationships (with evidence citations).
   - Human-readable Markdown summary report.

6. **Immutable Audit Trail:**
   - Logs all creations, modifications, deletions, and verifications with timestamps and reviewer tags.

---

## Quick Start (Local Run)

```powershell
# 1. Navigate to the project directory
cd C:\Users\Bale\My_ALL_PROJECTS\1\Kinteba_Guush_Family_Genealogy

# 2. Install dependencies (if not already installed)
npm install

# 3. Start local development server
npm run dev
```

Open your browser to: **`http://localhost:5173`**

### Running Automated Tests
```powershell
npm test
```

### Type Checking & Production Build
```powershell
npm run lint
npm run build
```

---

## Documentation

- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — Normalized schema, relationship semantics, DAG integrity.
- [`docs/DATA_IMPORT_REPORT.md`](docs/DATA_IMPORT_REPORT.md) — Source inventory, page coverage, and import audit metrics.
- [`docs/UNCERTAIN_RECORDS.md`](docs/UNCERTAIN_RECORDS.md) — Registry of all ambiguous blocks, page continuations, and incomplete statements needing human confirmation.
- [`docs/SETUP_AND_DEPLOYMENT.md`](docs/SETUP_AND_DEPLOYMENT.md) — Local operation, backup/restore procedures, and free deployment guides.

