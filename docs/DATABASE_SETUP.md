# Database Setup & Configuration Guide

**Project:** ተወለድ እንዳቦይ ከንትባ ጉዕሽ (Kinteba Guush Family Genealogy Platform)  
**Architecture:** Serverless PostgreSQL (Neon / Supabase compatible) + Netlify Functions + React PWA

---

## 1. Overview

The platform uses a resilient dual-layer data architecture:
1. **Local-first / Offline Layer:** High-performance browser IndexedDB seeded with authoritative pre-compiled family data (538 individuals, 498 genealogical relationships). The family tree operates seamlessly even when offline.
2. **Serverless PostgreSQL Layer (Optional / Production Cloud):** When `DATABASE_URL` is configured in Netlify environment variables, Netlify serverless functions synchronize and persist family data and audit logs to PostgreSQL.

---

## 2. Environment Variables

Configure the following environment variables in the Netlify dashboard under **Site configuration > Environment variables**:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (supports Neon pooler or direct SSL) | `postgresql://user:secret@ep-cool-fog-123.eu-central-1.neon.tech/kinteba_db?sslmode=require` |
| `ADMIN_EMAIL` | Single administrator login username / email | `admin@kintebaguush.org` |
| `ADMIN_PASSWORD_HASH` | Secure salted scrypt hash of the administrator password | Output of `node scripts/hash_admin_password.js` |
| `SESSION_SECRET` | 32+ character random hex or string for signing admin session tokens | `6f38d99c4a812e9b0d1e7c5a2f8b4d...` |

---

## 3. Applying Database Schema

To apply the schema to your Neon or PostgreSQL instance:
1. Copy the contents of `migrations/001_initial_schema.sql`.
2. Open the **SQL Editor** in Neon or run via `psql`:
   ```bash
   psql "$DATABASE_URL" -f migrations/001_initial_schema.sql
   ```
3. Tables `people`, `relationships`, `source_occurrences`, `audit_events`, and `app_metadata` will be created with proper indexes.

---

## 4. Administrator Password Generation

To generate a secure hash for `ADMIN_PASSWORD_HASH`:
```bash
node -e "
const crypto = require('crypto');
const pwd = process.argv[1] || 'YourAdminPasswordHere';
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(pwd, salt, 64).toString('hex');
console.log('ADMIN_PASSWORD_HASH=' + salt + ':' + hash);
" 'YOUR_NEW_SECURE_PASSWORD'
```
Set the resulting `salt:hash` value in `ADMIN_PASSWORD_HASH`.

