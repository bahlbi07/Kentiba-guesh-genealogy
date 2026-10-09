# Setup, Local Operation, Rust Backend, Backup & Deployment Guide

**Project:** Kinteba Guush Family Genealogy Platform (`ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ`)  
**Workspace:** `C:\Users\Bale\My_ALL_PROJECTS\1\Kinteba_Guush_Family_Genealogy`  
**Revision:** 2.0 (Production Architecture & PWA)  

---

## 1. System Requirements

- **Operating System:** Windows 10/11, macOS, or Linux
- **Node.js:** v18.0.0 or later (Tested on Node v24.13.1)
- **Rust Toolchain:** 1.75+ (for building the backend in `backend/`)
- **Package Manager:** npm v9.0.0 or later (Tested on npm 11.8.0)
- **Git:** Git 2.30+

---

## 2. Local Setup & Running on Windows

### A. Running the React PWA Frontend
1. Open PowerShell in the project directory:
   ```powershell
   cd C:\Users\Bale\My_ALL_PROJECTS\1\Kinteba_Guush_Family_Genealogy
   ```
2. Install npm dependencies:
   ```powershell
   npm install
   ```
3. Start the local development server:
   ```powershell
   npm run dev
   ```
   Open your browser to: **`http://localhost:5173`**

4. Run the automated test suite:
   ```powershell
   npm test
   ```

5. Typecheck and build the production bundle:
   ```powershell
   npm run lint
   npm run build
   ```

### B. Running the Rust Security API Backend (Optional Local Server)
1. Open a second PowerShell terminal in the `backend/` directory:
   ```powershell
   cd C:\Users\Bale\My_ALL_PROJECTS\1\Kinteba_Guush_Family_Genealogy\backend
   ```
2. Create the first administrator account securely:
   ```powershell
   cargo run --bin init_admin -- --username archivist --password "YourStrongPasswordHere"
   ```
3. Start the Rust Axum API server:
   ```powershell
   cargo run --bin server
   ```
   The backend will listen on: **`http://127.0.0.1:3001`**

4. In the root directory, point the frontend to the backend by creating `.env`:
   ```env
   VITE_API_BASE_URL=http://localhost:3001
   ```

---

## 3. Local-First Privacy Architecture

- **Default Storage:** Browser **IndexedDB** (`KintebaGuushGenealogyDB`).
- **Zero Cloud Requirement:** The application runs 100% offline and locally without paying for cloud hosting.
- **Data Persistence:** Records persist across browser reloads, system restarts, and offline sessions.
- **Safe Isolation:** Demo data and real family records are cleanly separated.

---

## 4. Progressive Web App (PWA) Mobile Installation

### Android (Chrome / Edge / Firefox)
1. Navigate to the website in Chrome on Android.
2. An installation banner appears: **"ኣብ ሞባይልኩም ኣእትዉ (Install App)"**.
3. Tap **Install**. The golden **ጉ** icon will be added to your home screen.

### iPhone & iPad (Safari)
1. Open the website in **Safari**.
2. Tap the **Share** icon (square with upward arrow).
3. Select **"Add to Home Screen"** (`ናብ ዋና ገጽ ወስኽ`).
4. Tap **Add**. The app opens in full-screen standalone mode.

*(See [`docs/PWA_INSTALLATION.md`](file:///c:/Users/Bale/My_ALL_PROJECTS/1/Kinteba_Guush_Family_Genealogy/docs/PWA_INSTALLATION.md) for full instructions).*

---

## 5. Deployment Options (Zero-Budget / Free Tiers)

### Option A: Netlify Static Frontend (Recommended — $0/Month)
- **Features:** 100% free static hosting, automated Git deployments, free SSL/HTTPS, global CDN, custom domains.
- **Build Configuration:**
  - Build Command: `npm run build`
  - Publish Directory: `dist`
  - Pre-configured with [`netlify.toml`](file:///c:/Users/Bale/My_ALL_PROJECTS/1/Kinteba_Guush_Family_Genealogy/netlify.toml) including CSP, security headers, and PWA routing.
- **Deployment Safety:** Adding the `backend/` directory does not interfere with the Netlify build.

### Option B: Render Free Tier for Rust Backend ($0/Month)
- **Features:** Free Web Service tier capable of building and hosting Docker/Rust applications.
- **Setup:**
  1. Create a free account at [render.com](https://render.com).
  2. Create a **New Web Service** pointing to your Git repository with Root Directory `backend`.
  3. Environment: `Docker` (using [`backend/Dockerfile`](file:///c:/Users/Bale/My_ALL_PROJECTS/1/Kinteba_Guush_Family_Genealogy/backend/Dockerfile)).
  4. Note on Free Tier Limitation: Render free instances spin down after 15 minutes of inactivity; initial wakeup takes ~50 seconds.
  5. In Netlify's environment variables, set `VITE_API_BASE_URL` to your Render service URL.

---

## 6. Backup & Disaster Recovery Procedures

### Taking a Regular Backup
1. In the **Admin Area** (`ኣካያዲ`), navigate to **"ባክኣፕን ኤክስፖርትን"**.
2. Click **Download JSON**.
3. Save the resulting backup file (`kinteba_guush_genealogy_backup_YYYY-MM-DD.json`) to external encrypted storage.

### Restoring from a Backup
1. Navigate to **"Restore from JSON Backup"**.
2. Select your validated `.json` backup file.
3. Review the preview and click **"Restore Backup to Database"**.
4. The system validates referential integrity and restores all records with an audit log entry.
