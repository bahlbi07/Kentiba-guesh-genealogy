# Setup, Local Operation, Backup & Deployment Guide

## 1. Prerequisites

- **Operating System:** Windows 10/11 (or macOS / Linux)
- **Node.js:** v18.0.0 or later (Tested on Node v24.13.1)
- **Package Manager:** npm v9.0.0 or later (Tested on npm 11.8.0)
- **Git:** Git 2.30+ (Tested on Git 2.53.0)

---

## 2. Local Setup and Running

1. **Open Terminal / PowerShell** in the project folder:
   ```powershell
   cd C:\Users\Bale\My_ALL_PROJECTS\1\Kinteba_Guush_Family_Genealogy
   ```

2. **Install Dependencies:**
   ```powershell
   npm install
   ```

3. **Start Local Development Server:**
   ```powershell
   npm run dev
   ```
   Open your browser to: **`http://localhost:5173`**

4. **Run Automated Test Suite:**
   ```powershell
   npm test
   ```

5. **Typecheck & Production Build:**
   ```powershell
   npm run lint
   npm run build
   ```

---

## 3. Local-First Privacy Architecture

- **Default Storage:** Browser **IndexedDB** (`KintebaGuushGenealogyDB`).
- **Zero Cloud Requirement:** The application runs 100% offline and locally without creating an account or paying for hosting.
- **Data Persistence:** Your records persist across browser reloads, system restarts, and offline sessions.
- **Safe Isolation:** Demo data and real family records are cleanly separated.

---

## 4. Backup & Disaster Recovery Procedures

### Creating a Backup
1. Navigate to the **Backup & Export** tab in the navigation bar.
2. Click **Download JSON**.
3. Save the resulting file (`kinteba_guush_genealogy_backup_YYYY-MM-DD.json`) to a secure location (e.g. external drive, encrypted folder).
4. You can also export **People Directory (CSV)** and **Relationships with Evidence (CSV)** for viewing in Excel or Google Sheets.

### Restoring from a Backup
1. In the **Backup & Export** tab, locate the **Restore from JSON Backup** section.
2. Click **Choose File** and select your `.json` backup file.
3. Review the preview and click **Restore Backup to Database**.
4. The system validates referential integrity and restores all people, relationships, and source occurrences.

---

## 5. Optional Free Cloud Setup (Supabase)

If you decide to enable cross-device synchronization or collaborative editing:

1. Create a free account at **[supabase.com](https://supabase.com)** (Free Tier).
2. Create a new free project.
3. Open the **SQL Editor** in the Supabase dashboard.
4. Copy the SQL migration script from the **Settings** tab in the app or run `src/services/supabaseClient.ts` migration script:
   - Sets up `people`, `relationships`, `source_occurrences`, and `audit_events` tables.
   - Enforces PostgreSQL Row Level Security (RLS).
5. In your project root, create a `.env` file from `.env.example`:
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
6. Restart Vite (`npm run dev`). The status badge will update to **Cloud Connected**.
7. **Security Warning:** Never expose the `service_role` secret key. Only use the public `anon` key in browser applications.

---

## 6. Deployment Options (Free Tiers)

> [!NOTE]
> Do not publish private genealogy data publicly without explicit family consent. By default, Cloudflare Pages and GitHub Pages deployments can be kept in private repositories or protected behind access authentication.

### Option A: Cloudflare Pages (Recommended Free Tier)
- **Free Tier Features:** Unlimited bandwidth, 500 builds/month, global CDN, custom domain support.
- **Steps:**
  1. Push the project repository to GitHub or GitLab.
  2. Connect your repository to **Cloudflare Pages**.
  3. Set Build Command: `npm run build`
  4. Set Build Output Directory: `dist`
  5. Deploy.

### Option B: GitHub Pages
- **Free Tier Features:** Free static hosting directly from a GitHub repository.
- **Steps:**
  1. Configure `vite.config.ts` `base: '/Kinteba_Guush_Family_Genealogy/'`.
  2. Deploy via GitHub Actions using the official Vite static deployment workflow.
