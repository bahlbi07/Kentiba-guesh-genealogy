import { AuditEvent, Person, Relationship } from '../types/genealogy';
import { INITIAL_PEOPLE, INITIAL_RELATIONSHIPS } from '../data/initialGenealogyData';
import { GOOGLE_SHEETS_WEBHOOK_URL } from './googleSheetsService';

/**
 * Multi-Device Global Cloud Synchronization & Typed API Client
 * Works seamlessly across Vercel (kentiba-guesh-genealogy.vercel.app), Netlify, and mobile PWAs.
 *
 * Uses a redundant multi-device cloud persistence architecture:
 *  1. Primary Persistent Cloud Store (Google Sheets Webhook ScriptProperties & Sheet)
 *  2. Real-Time Push & Event Stream (ntfy.sh SSE + poll=1&since=all)
 *  3. Serverless /api/* Backend Endpoints (Vercel / Netlify Functions)
 */

const API_BASE_URL = (
  (import.meta as unknown as { env: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL || ''
).replace(/\/$/, '');

const CLOUD_NTFY_TOPIC = 'kinteba_guush_genealogy_live_v2';
const CLOUD_NTFY_URL = `https://ntfy.sh/${CLOUD_NTFY_TOPIC}`;

export interface CloudOverlayState {
  peopleById: Record<string, Person>;
  relationshipsById: Record<string, Relationship>;
  deletedPersonIds: string[];
  deletedRelationshipIds: string[];
  updatedAt: string;
}

export interface CloudDeltaNotification {
  branch?: string;
  names?: string[];
  message: string;
}

export interface CloudDeltaMessage {
  v: 2;
  people?: Person[];
  relationships?: Relationship[];
  deletedPersonIds?: string[];
  deletedRelationshipIds?: string[];
  senderId?: string;
  notification?: CloudDeltaNotification;
  ts: string;
}

export const CLIENT_SESSION_ID =
  typeof sessionStorage !== 'undefined'
    ? (sessionStorage.getItem('kinteba_client_session_id') ||
        (() => {
          const id = `cli_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          try {
            sessionStorage.setItem('kinteba_client_session_id', id);
          } catch {}
          return id;
        })())
    : `cli_${Date.now()}`;

const OVERLAY_STORAGE_KEY = 'kinteba_cloud_overlay_cache_v2';

export function isProtectedGenealogyPersonId(id: string): boolean {
  if (!id) return false;
  return (
    id.startsWith('pers_p') ||
    id.startsWith('pers_root') ||
    id.startsWith('pers_tibe') ||
    id.startsWith('pers_partner')
  );
}

export function isProtectedGenealogyRelationshipId(id: string): boolean {
  if (!id) return false;
  return (
    id.startsWith('rel_') &&
    (id.includes('pers_p') ||
      id.includes('pers_tibe') ||
      id.includes('pers_root') ||
      id.includes('pers_partner'))
  );
}

function loadCachedOverlay(): CloudOverlayState {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(OVERLAY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            peopleById: parsed.peopleById || {},
            relationshipsById: parsed.relationshipsById || {},
            deletedPersonIds: (Array.isArray(parsed.deletedPersonIds) ? parsed.deletedPersonIds : []).filter(
              (id: string) => !isProtectedGenealogyPersonId(id)
            ),
            deletedRelationshipIds: (Array.isArray(parsed.deletedRelationshipIds) ? parsed.deletedRelationshipIds : []).filter(
              (id: string) => !isProtectedGenealogyRelationshipId(id)
            ),
            updatedAt: parsed.updatedAt || new Date().toISOString(),
          };
        }
      }
    }
  } catch {
    // fallback to clean state
  }
  return {
    peopleById: {},
    relationshipsById: {},
    deletedPersonIds: [],
    deletedRelationshipIds: [],
    updatedAt: new Date().toISOString(),
  };
}

// In-memory & locally persisted overlay state for instant local consistency
const memoryOverlay: CloudOverlayState = loadCachedOverlay();

function persistOverlayCache(overlay: CloudOverlayState) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(overlay));
    }
  } catch {
    // quota exceeded or SSR
  }
}

export function apiUnmarkDeletedPerson(id: string): void {
  if (memoryOverlay.deletedPersonIds.includes(id)) {
    memoryOverlay.deletedPersonIds = memoryOverlay.deletedPersonIds.filter((pId) => pId !== id);
    persistOverlayCache(memoryOverlay);
  }
}

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
      if (!delPId || isProtectedGenealogyPersonId(delPId)) continue;
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
      if (!delRId || isProtectedGenealogyRelationshipId(delRId)) continue;
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
      // Do not resurrect permanently deleted people
      if (overlay.deletedPersonIds.includes(p.id)) {
        continue;
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
        existing.status !== p.status ||
        Boolean(existing.isArchived) !== Boolean(p.isArchived) ||
        Boolean(existing.deletionPending) !== Boolean(p.deletionPending)
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
      // Do not resurrect permanently deleted relationships or links to deleted people
      if (overlay.deletedRelationshipIds.includes(r.id)) {
        continue;
      }
      if (overlay.deletedPersonIds.includes(r.fromPersonId) || overlay.deletedPersonIds.includes(r.toPersonId)) {
        continue;
      }
      const existing = overlay.relationshipsById[r.id];
      if (
        !existing ||
        !existing.updatedAt ||
        !r.updatedAt ||
        r.updatedAt >= existing.updatedAt ||
        existing.fromPersonId !== r.fromPersonId ||
        existing.toPersonId !== r.toPersonId ||
        existing.type !== r.type ||
        existing.status !== r.status
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
    persistOverlayCache(overlay);
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
  // 1. Try Google Sheets via POST { action: 'get_tree' }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'get_tree' }),
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && typeof data === 'object' && (data.peopleById || data.relationshipsById)) {
        return data as Partial<CloudOverlayState>;
      }
    }
  } catch {
    // Proceed to GET fallback
  }

  // 2. Try Google Sheets via GET ?action=get_tree
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${GOOGLE_SHEETS_WEBHOOK_URL}?action=get_tree`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && typeof data === 'object' && (data.peopleById || data.relationshipsById)) {
        return data as Partial<CloudOverlayState>;
      }
    }
  } catch {
    // Fallback to ntfy stream
  }
  return null;
}

async function savePrimaryCloudObject(overlay: CloudOverlayState): Promise<boolean> {
  if (isTestEnv()) return false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'save_tree',
        tree: overlay,
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
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    // CRITICAL: Do NOT append &t= timestamp; ntfy.sh interprets t as a query filter!
    // Using since=all fetches all cached delta messages reliably
    const res = await fetch(`${CLOUD_NTFY_URL}/json?poll=1&since=all`, {
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

    // Ensure notification and senderId are attached
    if (!delta.notification && people.length > 0) {
      const branchName = people.find((p) => p.branch && p.branch !== '__custom__')?.branch;
      delta.notification = {
        branch: branchName,
        names: people.map((p) => p.canonicalName).filter(Boolean),
        message: branchName ? `ጨንፈር ${branchName} ሓድሽ ወለዶ ኣትዩ ኣሎ` : 'ሓድሽ ወለዶ ኣትዩ ኣሎ',
      };
    }
    if (!delta.senderId) {
      delta.senderId = CLIENT_SESSION_ID;
    }

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
          notification: i === 0 ? delta.notification : undefined,
          senderId: delta.senderId,
          ts: delta.ts,
        });
      }
      for (let i = 0; i < relationships.length; i += maxItemsPerChunk) {
        chunks.push({
          v: 2,
          relationships: relationships.slice(i, i + maxItemsPerChunk),
          senderId: delta.senderId,
          ts: delta.ts,
        });
      }
      if (deletedPersonIds.length > 0 || deletedRelationshipIds.length > 0) {
        chunks.push({
          v: 2,
          deletedPersonIds,
          deletedRelationshipIds,
          senderId: delta.senderId,
          ts: delta.ts,
        });
      }
    }

    let allOk = true;
    for (const chunk of chunks) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain;charset=utf-8',
      };
      if (chunk.notification?.message) {
        headers['X-Title'] = 'መዝገብ ወለዶ ከንቲባ ጉዕሽ';
        headers['X-Tags'] = 'family,sparkles';
      }
      const res = await fetch(CLOUD_NTFY_URL, {
        method: 'POST',
        signal: controller.signal,
        headers,
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
 * Subscribe to real-time SSE updates and fast background polling from ntfy.sh
 * so all open phones update instantly (< 0.5s via SSE, < 4s via fallback fast poll)
 * like a Telegram group whenever an Admin adds or edits a member.
 */
export function subscribeToLiveCloudUpdates(
  onDeltaReceived: (delta: CloudDeltaMessage) => void
): () => void {
  if (isTestEnv() || typeof window === 'undefined') {
    return () => {};
  }

  const processedMsgIds = new Set<string>();
  let es: EventSource | null = null;
  let isClosed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  const processRawMessage = (rawText: string, msgId?: string) => {
    try {
      if (msgId && processedMsgIds.has(msgId)) return;
      if (msgId) processedMsgIds.add(msgId);

      const delta = JSON.parse(rawText) as CloudDeltaMessage;
      if (delta && delta.v === 2) {
        const deltaKey = `${delta.ts}_${delta.senderId || ''}_${(delta.people || []).map((p) => p.id).join('_')}`;
        if (processedMsgIds.has(deltaKey)) return;
        processedMsgIds.add(deltaKey);

        applyDeltaToOverlay(memoryOverlay, delta);
        onDeltaReceived(delta);
      }
    } catch {
      // Ignore non-JSON payload
    }
  };

  const connectSSE = () => {
    if (isClosed || typeof EventSource === 'undefined') return;
    try {
      if (es) {
        try {
          es.close();
        } catch {
          // Ignore
        }
      }
      es = new EventSource(`${CLOUD_NTFY_URL}/sse`);
      es.onmessage = (event) => {
        try {
          if (!event.data) return;
          const envelope = JSON.parse(event.data);
          if (envelope && envelope.event === 'message') {
            if (typeof envelope.message === 'string') {
              processRawMessage(envelope.message, envelope.id);
            }
          }
        } catch {
          // Ignore keepalive
        }
      };

      es.onerror = () => {
        if (es) {
          try {
            es.close();
          } catch {
            // Ignore
          }
          es = null;
        }
        if (!isClosed && !reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connectSSE();
          }, 3000);
        }
      };
    } catch {
      // Fallback to fast poll
    }
  };

  connectSSE();

  // Fast periodic poll fallback (every 4 seconds) to guarantee real-time delivery even if mobile carrier drops SSE
  const runFastPoll = async () => {
    if (isClosed || (typeof document !== 'undefined' && document.visibilityState !== 'visible')) {
      return;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${CLOUD_NTFY_URL}/json?poll=1&since=20s`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);
      if (!res.ok) return;
      const text = await res.text();
      if (!text.trim()) return;

      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const envelope = JSON.parse(trimmed);
          if (envelope && envelope.event === 'message' && typeof envelope.message === 'string') {
            processRawMessage(envelope.message, envelope.id);
          }
        } catch {
          // Ignore
        }
      }
    } catch {
      // Offline fallback
    }
  };

  pollInterval = setInterval(runFastPoll, 4000);

  return () => {
    isClosed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (pollInterval) clearInterval(pollInterval);
    if (es) {
      try {
        es.close();
      } catch {
        // Ignore
      }
      es = null;
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

  // Strip any accidental deletions of authoritative records
  deletedPersonIds = (deletedPersonIds || []).filter((id) => !isProtectedGenealogyPersonId(id));
  deletedRelationshipIds = (deletedRelationshipIds || []).filter((id) => !isProtectedGenealogyRelationshipId(id));

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
    if (isTestEnv()) return true;
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
  if (isProtectedGenealogyPersonId(personId)) {
    return { success: false, error: 'Cannot delete authoritative genealogical record' };
  }
  const res = await apiSaveBatch([], [], token, [personId], []);
  if (isTestEnv()) return { success: res.success };
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
  if (isProtectedGenealogyRelationshipId(relId)) {
    return { success: false, error: 'Cannot delete authoritative genealogical relationship' };
  }
  const res = await apiSaveBatch([], [], token, [], [relId]);
  if (isTestEnv()) return { success: res.success };
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
 * Actively purge accidental deletions of authoritative people / relationships from cloud stores
 * and broadcast the restoration to all connected clients via ntfy and primary cloud store.
 */
export async function apiHealAuthoritativeCloudRecords(): Promise<void> {
  if (isTestEnv()) return;

  // 1. Purge all protected IDs from memory overlay
  memoryOverlay.deletedPersonIds = (memoryOverlay.deletedPersonIds || []).filter(
    (id) => !isProtectedGenealogyPersonId(id)
  );
  memoryOverlay.deletedRelationshipIds = (memoryOverlay.deletedRelationshipIds || []).filter(
    (id) => !isProtectedGenealogyRelationshipId(id)
  );
  persistOverlayCache(memoryOverlay);

  // 2. Identify all people and relationships in Letu's immediate lineage
  const letuFamilyPersonIds = new Set([
    'pers_p15_311', // ለቱ
    'pers_partner_p16_318', // ኣቦይ ባሻይ ዝግታ ዓደርሖ
    'pers_p16_319', // ባሻይ ድሩይ
    'pers_p16_320', // ሃይለ
    'pers_p16_321', // ኣብርሀት
  ]);

  const peopleToRestore = INITIAL_PEOPLE.filter((p) => letuFamilyPersonIds.has(p.id));
  const relsToRestore = INITIAL_RELATIONSHIPS.filter(
    (r) =>
      r.id === 'rel_child_pers_p1_9_pers_p15_311' ||
      r.fromPersonId === 'pers_p15_311' ||
      r.toPersonId === 'pers_p15_311' ||
      letuFamilyPersonIds.has(r.fromPersonId) ||
      letuFamilyPersonIds.has(r.toPersonId)
  );

  // 3. Update memory overlay with these people
  for (const p of peopleToRestore) {
    memoryOverlay.peopleById[p.id] = { ...p, updatedAt: new Date().toISOString() };
  }
  for (const r of relsToRestore) {
    memoryOverlay.relationshipsById[r.id] = { ...r, updatedAt: new Date().toISOString() };
  }
  persistOverlayCache(memoryOverlay);

  // 4. Broadcast restoration via ntfy
  try {
    await publishDeltaToNtfy({
      v: 2,
      people: peopleToRestore,
      relationships: relsToRestore,
      deletedPersonIds: [],
      deletedRelationshipIds: [],
      notification: {
        branch: 'ትዕበ',
        names: ['ለቱ'],
        message: 'ጨንፈር ትዕበ: ናይ ለቱ ወለዶ ብትክክል ተመዝጊቡ ኣሎ',
      },
      ts: new Date().toISOString(),
    });
  } catch {}

  // 5. Persist healed cloud object
  try {
    await savePrimaryCloudObject(memoryOverlay);
  } catch {}
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

    // Ensure memoryOverlay never retains deletions of authoritative genealogical records
    memoryOverlay.deletedPersonIds = (memoryOverlay.deletedPersonIds || []).filter(
      (id) => !isProtectedGenealogyPersonId(id)
    );
    memoryOverlay.deletedRelationshipIds = (memoryOverlay.deletedRelationshipIds || []).filter(
      (id) => !isProtectedGenealogyRelationshipId(id)
    );

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
