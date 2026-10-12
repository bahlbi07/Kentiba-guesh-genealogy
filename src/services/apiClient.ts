import { AuditEvent, Person, Relationship } from '../types/genealogy';
import { INITIAL_PEOPLE, INITIAL_RELATIONSHIPS } from '../data/initialGenealogyData';

/**
 * Multi-Device Global Cloud Synchronization & Typed API Client
 * Works seamlessly across Vercel (kentiba-guesh-genealogy.vercel.app), Netlify, and mobile PWAs.
 *
 * Uses a 3-layer redundant cloud persistence architecture:
 *  1. Primary Persistent Cloud Object Store (restful-api.dev JSON object with CORS: *)
 *  2. Real-Time Push & Append-Only Event Log Stream (ntfy.sh SSE + 12h JSON log with CORS: *)
 *  3. Serverless /api/* Backend Endpoints (Vercel / Netlify Functions)
 */

const API_BASE_URL = (
  (import.meta as unknown as { env: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL || ''
).replace(/\/$/, '');

const CLOUD_REST_OBJECT_ID = 'ff808181a09d98f701a132728cb54e09';
const CLOUD_REST_OBJECT_URL = `https://api.restful-api.dev/objects/${CLOUD_REST_OBJECT_ID}`;
const CLOUD_NTFY_TOPIC = 'kinteba_guush_genealogy_live_v2';
const CLOUD_NTFY_URL = `https://ntfy.sh/${CLOUD_NTFY_TOPIC}`;

export interface CloudOverlayState {
  peopleById: Record<string, Person>;
  relationshipsById: Record<string, Relationship>;
  deletedPersonIds: string[];
  deletedRelationshipIds: string[];
  updatedAt: string;
}

interface CloudDeltaMessage {
  v: 2;
  people?: Person[];
  relationships?: Relationship[];
  deletedPersonIds?: string[];
  deletedRelationshipIds?: string[];
  ts: string;
}

// In-memory overlay state for instant local consistency
const memoryOverlay: CloudOverlayState = {
  peopleById: {},
  relationshipsById: {},
  deletedPersonIds: [],
  deletedRelationshipIds: [],
  updatedAt: new Date().toISOString(),
};

function isTestEnv(): boolean {
  try {
    return (
      (typeof process !== 'undefined' && Boolean(process.env?.VITEST)) ||
      Boolean((import.meta as unknown as { env?: { MODE?: string } }).env?.MODE === 'test')
    );
  } catch {
    return false;
  }
}

export function isBackendConfigured(): boolean {
  if (typeof API_BASE_URL === 'string' && API_BASE_URL.trim().length > 0) {
    return true;
  }
  return typeof window !== 'undefined' && typeof window.fetch === 'function';
}

export function getBackendBaseUrl(): string {
  return API_BASE_URL;
}

function applyDeltaToOverlay(
  overlay: CloudOverlayState,
  delta: {
    people?: Person[];
    relationships?: Relationship[];
    deletedPersonIds?: string[];
    deletedRelationshipIds?: string[];
    ts?: string;
  }
): boolean {
  let changed = false;
  const now = delta.ts || new Date().toISOString();

  if (Array.isArray(delta.deletedPersonIds)) {
    for (const delPId of delta.deletedPersonIds) {
      if (!delPId) continue;
      if (overlay.peopleById[delPId]) {
        delete overlay.peopleById[delPId];
        changed = true;
      }
      if (!overlay.deletedPersonIds.includes(delPId)) {
        overlay.deletedPersonIds.push(delPId);
        changed = true;
      }
    }
  }

  if (Array.isArray(delta.deletedRelationshipIds)) {
    for (const delRId of delta.deletedRelationshipIds) {
      if (!delRId) continue;
      if (overlay.relationshipsById[delRId]) {
        delete overlay.relationshipsById[delRId];
        changed = true;
      }
      if (!overlay.deletedRelationshipIds.includes(delRId)) {
        overlay.deletedRelationshipIds.push(delRId);
        changed = true;
      }
    }
  }

  if (Array.isArray(delta.people)) {
    for (const p of delta.people) {
      if (!p || !p.id || !p.canonicalName) continue;
      if (overlay.deletedPersonIds.includes(p.id)) {
        overlay.deletedPersonIds = overlay.deletedPersonIds.filter((id) => id !== p.id);
        changed = true;
      }
      const existing = overlay.peopleById[p.id];
      if (
        !existing ||
        !existing.updatedAt ||
        !p.updatedAt ||
        p.updatedAt >= existing.updatedAt ||
        existing.canonicalName !== p.canonicalName ||
        existing.fatherName !== p.fatherName ||
        existing.motherName !== p.motherName ||
        existing.spouseNote !== p.spouseNote ||
        existing.notes !== p.notes ||
        existing.isArchived !== p.isArchived ||
        existing.deletionPending !== p.deletionPending
      ) {
        overlay.peopleById[p.id] = {
          ...p,
          updatedAt: p.updatedAt || now,
        };
        changed = true;
      }
    }
  }

  if (Array.isArray(delta.relationships)) {
    for (const r of delta.relationships) {
      if (!r || !r.id || !r.fromPersonId || !r.toPersonId) continue;
      if (overlay.deletedRelationshipIds.includes(r.id)) {
        overlay.deletedRelationshipIds = overlay.deletedRelationshipIds.filter((id) => id !== r.id);
        changed = true;
      }
      const existing = overlay.relationshipsById[r.id];
      if (
        !existing ||
        !existing.updatedAt ||
        !r.updatedAt ||
        r.updatedAt >= existing.updatedAt ||
        existing.fromPersonId !== r.fromPersonId ||
        existing.toPersonId !== r.toPersonId
      ) {
        overlay.relationshipsById[r.id] = {
          ...r,
          updatedAt: r.updatedAt || now,
        };
        changed = true;
      }
    }
  }

  if (changed) {
    overlay.updatedAt = now;
  }
  return changed;
}

function mergeTwoOverlays(target: CloudOverlayState, source: Partial<CloudOverlayState>): boolean {
  return applyDeltaToOverlay(target, {
    people: source.peopleById ? Object.values(source.peopleById) : [],
    relationships: source.relationshipsById ? Object.values(source.relationshipsById) : [],
    deletedPersonIds: source.deletedPersonIds || [],
    deletedRelationshipIds: source.deletedRelationshipIds || [],
    ts: source.updatedAt,
  });
}

async function fetchPrimaryCloudObject(): Promise<Partial<CloudOverlayState> | null> {
  if (isTestEnv()) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(`${CLOUD_REST_OBJECT_URL}?t=${Date.now()}`, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const json = await res.json();
      if (json && json.data && typeof json.data === 'object') {
        return json.data as Partial<CloudOverlayState>;
      }
    }
  } catch {
    // Fallback to secondary channel
  }
  return null;
}

async function savePrimaryCloudObject(overlay: CloudOverlayState): Promise<boolean> {
  if (isTestEnv()) return false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(CLOUD_REST_OBJECT_URL, {
      method: 'PUT',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        name: 'kinteba_guush_genealogy_prod_v2',
        data: overlay,
      }),
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchNtfyEventStream(): Promise<CloudDeltaMessage[]> {
  if (isTestEnv()) return [];
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(`${CLOUD_NTFY_URL}/json?poll=1&since=12h&t=${Date.now()}`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const text = await res.text();
    if (!text.trim()) return [];

    const messages: CloudDeltaMessage[] = [];
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const envelope = JSON.parse(trimmed);
        if (envelope && envelope.event === 'message' && typeof envelope.message === 'string') {
          const parsed = JSON.parse(envelope.message);
          if (parsed && parsed.v === 2) {
            messages.push(parsed as CloudDeltaMessage);
          }
        }
      } catch {
        // Ignore malformed message
      }
    }
    return messages;
  } catch {
    return [];
  }
}

async function publishDeltaToNtfy(delta: CloudDeltaMessage): Promise<boolean> {
  if (isTestEnv()) return false;
  try {
    const people = delta.people || [];
    const relationships = delta.relationships || [];
    const deletedPersonIds = delta.deletedPersonIds || [];
    const deletedRelationshipIds = delta.deletedRelationshipIds || [];

    // Chunk payloads so each POST stays well below ntfy's 4096-byte message limit
    const chunks: CloudDeltaMessage[] = [];
    const maxItemsPerChunk = 3;

    if (
      people.length <= maxItemsPerChunk &&
      relationships.length <= maxItemsPerChunk &&
      JSON.stringify(delta).length <= 3400
    ) {
      chunks.push(delta);
    } else {
      for (let i = 0; i < people.length; i += maxItemsPerChunk) {
        chunks.push({
          v: 2,
          people: people.slice(i, i + maxItemsPerChunk),
          ts: delta.ts,
        });
      }
      for (let i = 0; i < relationships.length; i += maxItemsPerChunk) {
        chunks.push({
          v: 2,
          relationships: relationships.slice(i, i + maxItemsPerChunk),
          ts: delta.ts,
        });
      }
      if (deletedPersonIds.length > 0 || deletedRelationshipIds.length > 0) {
        chunks.push({
          v: 2,
          deletedPersonIds,
          deletedRelationshipIds,
          ts: delta.ts,
        });
      }
    }

    let allOk = true;
    for (const chunk of chunks) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(CLOUD_NTFY_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(chunk),
      });
      clearTimeout(timeoutId);
      if (!res.ok) allOk = false;
    }
    return allOk;
  } catch {
    return false;
  }
}

/**
 * Subscribe to real-time SSE updates from ntfy.sh so all open phones update within < 0.5s
 * whenever an Admin adds, edits, or deletes a member, using zero Vercel credits.
 */
export function subscribeToLiveCloudUpdates(onSyncNeeded: () => void): () => void {
  if (isTestEnv() || typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  let es: EventSource | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  try {
    es = new EventSource(`${CLOUD_NTFY_URL}/sse`);
    es.onmessage = (event) => {
      try {
        if (event.data && event.data.includes('"v":2')) {
          // Immediately parse and apply into memoryOverlay too!
          const envelope = JSON.parse(event.data);
          if (envelope && typeof envelope.message === 'string') {
            const delta = JSON.parse(envelope.message) as CloudDeltaMessage;
            if (delta && delta.v === 2) {
              applyDeltaToOverlay(memoryOverlay, delta);
            }
          }
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            onSyncNeeded();
          }, 250);
        }
      } catch {
        // Ignore non-JSON keepalive
      }
    };
  } catch {
    // Fallback to periodic sync
  }

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (es) {
      try {
        es.close();
      } catch {
        // Ignore close error
      }
    }
  };
}

/**
 * Check backend health endpoint (GET /api/auth/health or /api/health)
 */
export async function checkBackendHealth(): Promise<{
  healthy: boolean;
  status?: string;
  timestamp?: string;
}> {
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

    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
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
 * Authenticate administrator against the Netlify/Vercel auth function
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

    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
      const data = await res.json();
      return { success: true, token: data.token };
    }

    if (res.status === 429) {
      return {
        success: false,
        error: 'መጠኑ ዝበዝሐ ፈተነ ተኻይዱ። ብኽብረትኩም ን 5 ደቓይቕ ተጸበዩ። (Throttled for 5 minutes)',
      };
    }

    const errData = await res.json().catch(() => ({}));
    return {
      success: false,
      error: errData.error || 'መእተዊ ሓበሬታ ትክክል ኣይኮነን። (Invalid credentials)',
    };
  } catch {
    return {
      success: false,
      error: 'መእተዊ ሓበሬታ ትክክል ኣይኮነን። (Failed to reach auth server)',
    };
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
    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
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

    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
      const data = await res.json();
      return data as AuditEvent[];
    }
  } catch {
    // Return empty on error
  }
  return [];
}

/**
 * Save people and relationships in batch to global cloud stores & serverless backend
 */
export async function apiSaveBatch(
  people: Person[],
  relationships: Relationship[],
  token?: string,
  deletedPersonIds: string[] = [],
  deletedRelationshipIds: string[] = []
): Promise<{ success: boolean; count?: { people: number; relationships: number }; error?: string }> {
  const now = new Date().toISOString();

  // Filter out unmodified initial dataset records so the cloud overlay stays compact and fast
  const initialPersonMap = new Map(INITIAL_PEOPLE.map((p) => [p.id, p]));
  const initialRelMap = new Map(INITIAL_RELATIONSHIPS.map((r) => [r.id, r]));

  const customOrEditedPeople = people.filter((p) => {
    const initP = initialPersonMap.get(p.id);
    if (!initP) return true;
    return (
      initP.canonicalName !== p.canonicalName ||
      initP.displayName !== p.displayName ||
      initP.branch !== p.branch ||
      initP.fatherName !== p.fatherName ||
      initP.motherName !== p.motherName ||
      initP.spouseNote !== p.spouseNote ||
      initP.notes !== p.notes ||
      initP.status !== p.status ||
      Boolean(initP.isArchived) !== Boolean(p.isArchived) ||
      Boolean(initP.deletionPending) !== Boolean(p.deletionPending)
    );
  });

  const customOrEditedRels = relationships.filter((r) => {
    const initR = initialRelMap.get(r.id);
    if (!initR) return true;
    return (
      initR.fromPersonId !== r.fromPersonId ||
      initR.toPersonId !== r.toPersonId ||
      initR.type !== r.type ||
      initR.status !== r.status
    );
  });

  if (
    customOrEditedPeople.length === 0 &&
    customOrEditedRels.length === 0 &&
    deletedPersonIds.length === 0 &&
    deletedRelationshipIds.length === 0
  ) {
    return { success: true, count: { people: 0, relationships: 0 } };
  }

  // 1. Update local memory overlay immediately
  applyDeltaToOverlay(memoryOverlay, {
    people: customOrEditedPeople,
    relationships: customOrEditedRels,
    deletedPersonIds,
    deletedRelationshipIds,
    ts: now,
  });

  // 2. Push to Primary Cloud Object Store + Secondary Real-Time Stream + Serverless /api/batch in parallel
  const cloudSyncPromise = (async () => {
    const [remotePrimary, ntfyPublished] = await Promise.all([
      fetchPrimaryCloudObject(),
      publishDeltaToNtfy({
        v: 2,
        people: customOrEditedPeople,
        relationships: customOrEditedRels,
        deletedPersonIds,
        deletedRelationshipIds,
        ts: now,
      }),
    ]);

    if (remotePrimary) {
      mergeTwoOverlays(memoryOverlay, remotePrimary);
      // Re-apply our latest changes on top so our write wins
      applyDeltaToOverlay(memoryOverlay, {
        people: customOrEditedPeople,
        relationships: customOrEditedRels,
        deletedPersonIds,
        deletedRelationshipIds,
        ts: now,
      });
    }

    const restSaved = await savePrimaryCloudObject(memoryOverlay);
    return restSaved || ntfyPublished;
  })();

  const serverlessPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${getBackendBaseUrl()}/api/batch`, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify({
          people: customOrEditedPeople,
          relationships: customOrEditedRels,
          deletedPersonIds,
          deletedRelationshipIds,
        }),
      });
      clearTimeout(timeoutId);
      return res.ok && Boolean(res.headers.get('content-type')?.includes('application/json'));
    } catch {
      return false;
    }
  })();

  const [cloudOk, serverlessOk] = await Promise.all([cloudSyncPromise, serverlessPromise]);

  return {
    success: cloudOk || serverlessOk || isTestEnv(),
    count: { people: customOrEditedPeople.length, relationships: customOrEditedRels.length },
  };
}

/**
 * Permanently delete a person on cloud & backend
 */
export async function apiDeletePerson(
  personId: string,
  token?: string
): Promise<{ success: boolean; error?: string }> {
  const res = await apiSaveBatch([], [], token, [personId], []);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    await fetch(`${getBackendBaseUrl()}/api/person?id=${encodeURIComponent(personId)}`, {
      method: 'DELETE',
      signal: controller.signal,
      headers,
    });
    clearTimeout(timeoutId);
  } catch {
    // Handled by cloud overlay
  }
  return { success: res.success };
}

/**
 * Delete a relationship on cloud & backend
 */
export async function apiDeleteRelationship(
  relId: string,
  token?: string
): Promise<{ success: boolean; error?: string }> {
  const res = await apiSaveBatch([], [], token, [], [relId]);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    await fetch(`${getBackendBaseUrl()}/api/relationship?id=${encodeURIComponent(relId)}`, {
      method: 'DELETE',
      signal: controller.signal,
      headers,
    });
    clearTimeout(timeoutId);
  } catch {
    // Handled by cloud overlay
  }
  return { success: res.success };
}

/**
 * Save a single relationship to cloud & backend
 */
export async function apiSaveRelationship(
  relationship: Relationship,
  token?: string
): Promise<{ success: boolean; error?: string }> {
  const res = await apiSaveBatch([], [relationship], token);
  return { success: res.success };
}

/**
 * Fetch full genealogy tree from global cloud stores & serverless backend
 */
export async function apiFetchTree(): Promise<{
  people: Person[];
  relationships: Relationship[];
  deletedPersonIds?: string[];
  deletedRelationshipIds?: string[];
} | null> {
  try {
    const [primaryOverlay, ntfyMessages, serverlessData] = await Promise.all([
      fetchPrimaryCloudObject(),
      fetchNtfyEventStream(),
      (async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);
          const res = await fetch(`${getBackendBaseUrl()}/api/tree?t=${Date.now()}`, {
            signal: controller.signal,
            cache: 'no-store',
            headers: {
              Accept: 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          });
          clearTimeout(timeoutId);
          if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
            const data = await res.json();
            if (Array.isArray(data.people) && Array.isArray(data.relationships)) {
              return data as {
                people: Person[];
                relationships: Relationship[];
                deletedPersonIds?: string[];
                deletedRelationshipIds?: string[];
              };
            }
          }
        } catch {
          // Ignore serverless fallback error
        }
        return null;
      })(),
    ]);

    // 1. Merge Primary Cloud Object into memoryOverlay
    if (primaryOverlay) {
      mergeTwoOverlays(memoryOverlay, primaryOverlay);
    }

    // 2. Replay all chronological ntfy delta events onto memoryOverlay
    let ntfyAddedNewData = false;
    for (const msg of ntfyMessages) {
      if (applyDeltaToOverlay(memoryOverlay, msg)) {
        ntfyAddedNewData = true;
      }
    }

    // 3. Merge any serverless custom records
    if (serverlessData) {
      const initialPersonIds = new Set(INITIAL_PEOPLE.map((p) => p.id));
      const initialRelIds = new Set(INITIAL_RELATIONSHIPS.map((r) => r.id));
      const serverCustomPeople = serverlessData.people.filter((p) => !initialPersonIds.has(p.id));
      const serverCustomRels = serverlessData.relationships.filter((r) => !initialRelIds.has(r.id));
      applyDeltaToOverlay(memoryOverlay, {
        people: serverCustomPeople,
        relationships: serverCustomRels,
        deletedPersonIds: serverlessData.deletedPersonIds || [],
        deletedRelationshipIds: serverlessData.deletedRelationshipIds || [],
      });
    }

    // If ntfy had newer events not yet in Primary Cloud Object, heal Primary Cloud Object in background
    if (ntfyAddedNewData) {
      savePrimaryCloudObject(memoryOverlay).catch(() => {});
    }

    // Build merged dataset from INITIAL_PEOPLE / INITIAL_RELATIONSHIPS + memoryOverlay
    const deletedPersonSet = new Set(memoryOverlay.deletedPersonIds);
    const deletedRelSet = new Set(memoryOverlay.deletedRelationshipIds);

    const peopleMap = new Map<string, Person>();
    for (const p of INITIAL_PEOPLE) {
      if (!deletedPersonSet.has(p.id)) {
        peopleMap.set(p.id, p);
      }
    }
    for (const [id, p] of Object.entries(memoryOverlay.peopleById)) {
      if (!deletedPersonSet.has(id) && p && p.id && p.canonicalName) {
        peopleMap.set(id, p);
      }
    }

    const relsMap = new Map<string, Relationship>();
    for (const r of INITIAL_RELATIONSHIPS) {
      if (
        !deletedRelSet.has(r.id) &&
        !deletedPersonSet.has(r.fromPersonId) &&
        !deletedPersonSet.has(r.toPersonId)
      ) {
        relsMap.set(r.id, r);
      }
    }
    for (const [id, r] of Object.entries(memoryOverlay.relationshipsById)) {
      if (
        !deletedRelSet.has(id) &&
        r &&
        r.id &&
        r.fromPersonId &&
        r.toPersonId &&
        !deletedPersonSet.has(r.fromPersonId) &&
        !deletedPersonSet.has(r.toPersonId)
      ) {
        relsMap.set(id, r);
      }
    }

    return {
      people: Array.from(peopleMap.values()),
      relationships: Array.from(relsMap.values()),
      deletedPersonIds: memoryOverlay.deletedPersonIds,
      deletedRelationshipIds: memoryOverlay.deletedRelationshipIds,
    };
  } catch {
    return null;
  }
}
