# Kinteba Guush Family Genealogy | ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ

A modern, secure, source-faithful family history platform and progressive family tree application built for the descendants of **Kinteba Guush Hagos** (`ከንቲባ ጉዑሽ ሓጎስ`).

---

## 1. Project Overview & Architectural Vision

- **Primary Source Manuscript:** Transcribed from **`ከሰተ-ብርሃነ.pdf`** (36 pages) via **`source/family_genealogy_register.md`**.
- **Patriarch Root:** `ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ`
- **Scribe Attribution:** `ጸሓፊ ከሰተ ብርሃነ ወልዱ ወዲ ጎብሩ ካብ ጁባ ደቡብ ሱዳን` (Kesete Birhane Weldu, from Juba, South Sudan).
- **Core Architecture:**
  - **Frontend:** React 18, TypeScript 5, Vite 5, Tailwind CSS, installable Progressive Web App (PWA).
  - **Tree Experience:** Progressive-disclosure family explorer (no overwhelming giant canvas; centered on focused relative with collapsible branches).
  - **Mobile App:** Touch-friendly with responsive bottom navigation, Android install prompt, and iOS Add-to-Home support.
  - **Backend (Rust):** High-security Axum API in `backend/` with SQLite/Postgres persistence, Argon2id password hashing, rate limiting, and server-side authorization.
  - **Data Integrity:** Strict preservation of 539 people, 348 relationships, and 92 repeated-name groups without merging.

---

## 2. Key Capabilities

### A. Progressive Family Explorer & Elder Accessibility
- Focuses on the selected person and immediate family (parents, spouse/unions, siblings, children).
- In-place branch expansion/collapse allows revealing descendants without recalculating giant layouts.
- Breadcrumb navigation trail (`ከንቲባ ጉዑሽ > ጎብሩ > ተላ > ሓድጉ`) and "Return to Root Ancestor" button.
- Large touch targets (≥ 44–48px) and high-contrast typography designed for older family members.
- Complementary **Accessible Hierarchical List View** for keyboard navigation and screen readers.

### B. Simplified 4-Destination Navigation
1. **ኦም ወለዶ (Family Tree):** Progressive collapsible family explorer.
2. **ሰባት ድለ (Find a Person):** Fast search with Tigrinya/Ge'ez text, branch filters, and shared-name distinction.
3. **መረዳእታ ስድራ (Family Information):** Comprehensive profile with parent, child, spouse, sibling, and source links.
4. **ብዛዕባ እዚ መዝገብ (About This Archive):** Historical context, scribe attribution, and preservation principles.

### C. Protected Archivist Administration Portal (`ኣካያዲ`)
- Authenticated area protected by Argon2id password verification, brute-force rate limiting, and session tokens.
- Add and edit people and relationships with relationship deletion safeguards.
- Review uncertain records and approve proposed relationship updates.
- Staged Import Pipeline with an explicit approval gate.
- Complete JSON backups, CSV exports, and immutable audit trail.

### D. Progressive Web App (PWA) Mobile Experience
- Installable on Android (via Chrome install banner) and iPhone/iPad (via Safari "Add to Home Screen").
- Offline application shell pre-cached by service worker (`sw.js`).
- Golden **ጉ** app icon in standalone display mode.

---

## 3. Quick Start & Local Running (Windows)

### Running the React PWA Frontend:
```powershell
# 1. Navigate to the project directory
cd C:\Users\Bale\My_ALL_PROJECTS\1\Kinteba_Guush_Family_Genealogy

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```
Open your browser to: **`http://localhost:5173`**

### Running the Automated Test Suite:
```powershell
npm test
```

### Type Checking & Production Build:
```powershell
npm run lint
npm run build
```

### Running the Rust Security API (Optional Local Server):
```powershell
cd backend
# Create first administrator account securely
cargo run --bin init_admin -- --username archivist --password "YourStrongPassword"
# Start the API server
cargo run --bin server
```
The API server runs on: **`http://127.0.0.1:3001`**

---

## 4. Documentation Directory

- [`docs/ARCHITECTURE_REDESIGN_PLAN.md`](docs/ARCHITECTURE_REDESIGN_PLAN.md) — Architectural redesign plan and risk analysis.
- [`docs/SECURITY.md`](docs/SECURITY.md) — Threat model, Argon2id authentication, rate limiting, and server-side authorization.
- [`docs/PWA_INSTALLATION.md`](docs/PWA_INSTALLATION.md) — Step-by-step install guide for Android, iPhone, iPad, and desktop.
- [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md) — Archivist administration, record editing, and disaster recovery.
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — Relational schema, relationship types, and DAG cycle prevention.
- [`docs/DATA_IMPORT_REPORT.md`](docs/DATA_IMPORT_REPORT.md) — Complete 36-page PDF audit and staged import metrics.
- [`docs/UNCERTAIN_RECORDS.md`](docs/UNCERTAIN_RECORDS.md) — Detailed registry of the 6 remaining needs-review items.
- [`docs/SETUP_AND_DEPLOYMENT.md`](docs/SETUP_AND_DEPLOYMENT.md) — Zero-budget deployment to Netlify and Render.
