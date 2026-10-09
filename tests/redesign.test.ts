import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { isBackendConfigured, getBackendBaseUrl, checkBackendHealth } from '../src/services/apiClient';

describe('Redesign Architecture, PWA, and Netlify Compatibility Tests', () => {
  it('PWA: manifest.webmanifest exists and has valid configuration', () => {
    const manifestPath = path.resolve(__dirname, '../public/manifest.webmanifest');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const content = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(content);

    expect(manifest.name).toContain('ከንቲባ ጉዑሽ');
    expect(manifest.short_name).toBe('Kinteba Guush');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBe('#1c1917');
    expect(manifest.theme_color).toBe('#b45309');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
    expect(manifest.icons[0].src).toBe('/icon.svg');
  });

  it('PWA: Service Worker exists with offline shell caching logic', () => {
    const swPath = path.resolve(__dirname, '../public/sw.js');
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf-8');
    expect(swContent).toContain("addEventListener('install'");
    expect(swContent).toContain("addEventListener('activate'");
    expect(swContent).toContain("addEventListener('fetch'");
    expect(swContent).toContain('/manifest.webmanifest');
    expect(swContent).toContain('/icon.svg');
  });

  it('Deployment: netlify.toml is present and configures SPA routing and security headers', () => {
    const netlifyPath = path.resolve(__dirname, '../netlify.toml');
    expect(fs.existsSync(netlifyPath)).toBe(true);

    const netlifyContent = fs.readFileSync(netlifyPath, 'utf-8');
    expect(netlifyContent).toContain('publish = "dist"');
    expect(netlifyContent).toContain('command = "npm run build"');
    expect(netlifyContent).toContain('to = "/index.html"');
    expect(netlifyContent).toContain('X-Frame-Options = "DENY"');
    expect(netlifyContent).toContain('Content-Security-Policy');
  });

  it('Backend: Cargo.toml and migrations are properly placed in backend/', () => {
    const cargoPath = path.resolve(__dirname, '../backend/Cargo.toml');
    const migrationPath = path.resolve(__dirname, '../backend/migrations/001_initial_schema.sql');
    const mainPath = path.resolve(__dirname, '../backend/src/main.rs');

    expect(fs.existsSync(cargoPath)).toBe(true);
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(fs.existsSync(mainPath)).toBe(true);

    const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
    expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS people');
    expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS relationships');
    expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS admin_users');
    expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS audit_events');
  });

  it('API Client: handles unconfigured backend environment gracefully without throwing', async () => {
    // When VITE_API_BASE_URL is not set
    const configured = isBackendConfigured();
    expect(typeof configured).toBe('boolean');

    const health = await checkBackendHealth();
    expect(health.healthy).toBe(false);
  });
});

