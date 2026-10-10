import { AuditEvent } from '../types/genealogy';

/**
 * Typed API Client for Kinteba Guush Netlify / Serverless Backend API
 * Connects to Netlify Functions via VITE_API_BASE_URL
 * Gracefully handles offline states, timeouts, and authorization.
 */

const API_BASE_URL = ((import.meta as unknown as { env: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function isBackendConfigured(): boolean {
  return typeof API_BASE_URL === 'string' && API_BASE_URL.trim().length > 0;
}

export function getBackendBaseUrl(): string {
  return API_BASE_URL;
}

/**
 * Check backend health endpoint (GET /api/auth/health or /api/health)
 */
export async function checkBackendHealth(): Promise<{ healthy: boolean; status?: string; timestamp?: string }> {
  if (!isBackendConfigured()) {
    return { healthy: false, status: 'not_configured' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`${getBackendBaseUrl()}/api/auth/health`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return { healthy: true, status: data.status, timestamp: data.timestamp };
    }
    return { healthy: false, status: `HTTP ${res.status}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Connection failed';
    return { healthy: false, status: message };
  }
}

/**
 * Authenticate administrator against the Netlify auth function
 */
export async function apiLogin(
  username: string,
  password: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (!isBackendConfigured()) {
    return { success: false, error: 'መእተዊ ሓበሬታ ትክክል ኣይኮነን። (Backend not configured)' };
  }

  try {
    const res = await fetch(`${getBackendBaseUrl()}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, token: data.token };
    }

    if (res.status === 429) {
      return { success: false, error: 'መጠኑ ዝበዝሐ ፈተነ ተኻይዱ። ብኽብረትኩም ን 5 ደቓይቕ ተጸበዩ። (Throttled for 5 minutes)' };
    }

    const errData = await res.json().catch(() => ({}));
    return { success: false, error: errData.error || 'መእተዊ ሓበሬታ ትክክል ኣይኮነን። (Invalid credentials)' };
  } catch {
    return { success: false, error: 'መእተዊ ሓበሬታ ትክክል ኣይኮነን። (Failed to reach auth server)' };
  }
}

/**
 * Fetch database statistics from backend
 */
export async function apiFetchStats(): Promise<{
  total_people: number;
  total_relationships: number;
  status: string;
} | null> {
  if (!isBackendConfigured()) return null;

  try {
    const res = await fetch(`${getBackendBaseUrl()}/api/stats`);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Return null on offline / unreachable
  }
  return null;
}

/**
 * Fetch audit log with Bearer token authentication
 */
export async function apiFetchAuditLog(token: string): Promise<AuditEvent[]> {
  if (!isBackendConfigured() || !token) return [];

  try {
    const res = await fetch(`${getBackendBaseUrl()}/api/admin/audit`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      return data as AuditEvent[];
    }
  } catch {
    // Return empty on error
  }
  return [];
}
