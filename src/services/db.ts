import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Person, Relationship, SourceOccurrence, AuditEvent, Source } from '../types/genealogy';
import { validateParentChildCycle, validateReferentialIntegrity } from './cycleDetector';

interface GenealogyDBSchema extends DBSchema {
  people: {
    key: string;
    value: Person;
    indexes: {
      'by-canonicalName': string;
      'by-status': string;
      'by-branch': string;
    };
  };
  relationships: {
    key: string;
    value: Relationship;
    indexes: {
      'by-fromPersonId': string;
      'by-toPersonId': string;
      'by-type': string;
      'by-status': string;
    };
  };
  sources: {
    key: string;
    value: Source;
  };
  sourceOccurrences: {
    key: string;
    value: SourceOccurrence;
    indexes: {
      'by-page': number;
      'by-linkedPersonId': string;
      'by-status': string;
    };
  };
  auditEvents: {
    key: string;
    value: AuditEvent;
    indexes: {
      'by-timestamp': string;
      'by-entityId': string;
    };
  };
  metadata: {
    key: string;
    value: { key: string; value: any };
  };
}

const DB_NAME = 'KintebaGuushGenealogyDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<GenealogyDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<GenealogyDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<GenealogyDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // People store
        if (!db.objectStoreNames.contains('people')) {
          const personStore = db.createObjectStore('people', { keyPath: 'id' });
          personStore.createIndex('by-canonicalName', 'canonicalName');
          personStore.createIndex('by-status', 'status');
          personStore.createIndex('by-branch', 'branch');
        }

        // Relationships store
        if (!db.objectStoreNames.contains('relationships')) {
          const relStore = db.createObjectStore('relationships', { keyPath: 'id' });
          relStore.createIndex('by-fromPersonId', 'fromPersonId');
          relStore.createIndex('by-toPersonId', 'toPersonId');
          relStore.createIndex('by-type', 'type');
          relStore.createIndex('by-status', 'status');
        }

        // Sources store
        if (!db.objectStoreNames.contains('sources')) {
          db.createObjectStore('sources', { keyPath: 'id' });
        }

        // Source Occurrences store
        if (!db.objectStoreNames.contains('sourceOccurrences')) {
          const occStore = db.createObjectStore('sourceOccurrences', { keyPath: 'id' });
          occStore.createIndex('by-page', 'page');
          occStore.createIndex('by-linkedPersonId', 'linkedPersonId');
          occStore.createIndex('by-status', 'status');
        }

        // Audit Events store
        if (!db.objectStoreNames.contains('auditEvents')) {
          const auditStore = db.createObjectStore('auditEvents', { keyPath: 'id' });
          auditStore.createIndex('by-timestamp', 'timestamp');
          auditStore.createIndex('by-entityId', 'entityId');
        }

        // App Metadata
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function logAudit(
  action: AuditEvent['action'],
  entityType: AuditEvent['entityType'],
  entityId: string,
  details: string,
  reviewer = 'User'
): Promise<void> {
  try {
    const db = await getDB();
    const event: AuditEvent = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      entityType,
      entityId,
      action,
      reviewer,
      details,
    };
    await db.put('auditEvents', event);
  } catch (e) {
    console.error('Failed to write audit log:', e);
  }
}

export async function getAllPeople(includeArchived = false): Promise<Person[]> {
  const db = await getDB();
  const all = await db.getAll('people');
  if (includeArchived) return all;
  return all.filter((p) => !p.isArchived);
}

export async function getPersonById(id: string): Promise<Person | undefined> {
  const db = await getDB();
  return db.get('people', id);
}

export async function savePerson(person: Person, reviewer = 'User'): Promise<void> {
  const db = await getDB();
  const existing = await db.get('people', person.id);
  const now = new Date().toISOString();

  const toSave: Person = {
    ...person,
    updatedAt: now,
    createdAt: existing ? existing.createdAt : (person.createdAt || now),
  };

  await db.put('people', toSave);
  await logAudit(
    existing ? 'update' : 'create',
    'person',
    person.id,
    existing
      ? `Updated person "${toSave.canonicalName}" (status: ${toSave.status})`
      : `Created new person "${toSave.canonicalName}"`,
    reviewer
  );
}

export async function deletePerson(
  id: string,
  reviewer = 'User'
): Promise<{ affectedRelationships: number }> {
  const db = await getDB();
  const person = await db.get('people', id);
  if (!person) return { affectedRelationships: 0 };

  const allRels = await db.getAll('relationships');
  const affected = allRels.filter((r) => r.fromPersonId === id || r.toPersonId === id);

  const tx = db.transaction(['people', 'relationships'], 'readwrite');
  await tx.objectStore('people').delete(id);
  for (const rel of affected) {
    await tx.objectStore('relationships').delete(rel.id);
  }
  await tx.done;

  await logAudit(
    'delete',
    'person',
    id,
    `Permanently deleted person "${person.canonicalName}" (ID: ${id}) and removed ${affected.length} connected relationship(s).`,
    reviewer
  );

  return { affectedRelationships: affected.length };
}

export async function getAllRelationships(): Promise<Relationship[]> {
  const db = await getDB();
  return db.getAll('relationships');
}

export async function getRelationshipById(id: string): Promise<Relationship | undefined> {
  const db = await getDB();
  return db.get('relationships', id);
}

export async function saveRelationship(
  rel: Relationship,
  reviewer = 'User'
): Promise<{ success: boolean; error?: string }> {
  const db = await getDB();
  const allPeople = await db.getAll('people');
  const peopleIds = new Set(allPeople.map((p) => p.id));

  // 1. Referential integrity
  const refCheck = validateReferentialIntegrity(peopleIds, rel.fromPersonId, rel.toPersonId);
  if (!refCheck.isValid) {
    return { success: false, error: refCheck.error };
  }

  // 2. Cycle prevention for parent_child
  if (rel.type === 'parent_child') {
    const existingRels = await db.getAll('relationships');
    const cycleCheck = validateParentChildCycle(
      existingRels,
      rel.fromPersonId,
      rel.toPersonId,
      rel.id
    );
    if (!cycleCheck.isValid) {
      return { success: false, error: cycleCheck.error };
    }
  }

  const existing = await db.get('relationships', rel.id);
  const now = new Date().toISOString();
  const toSave: Relationship = {
    ...rel,
    updatedAt: now,
    createdAt: existing ? existing.createdAt : (rel.createdAt || now),
  };

  await db.put('relationships', toSave);
  await logAudit(
    existing ? 'update' : 'create',
    'relationship',
    rel.id,
    existing
      ? `Updated relationship ${rel.type} between ${rel.fromPersonId} and ${rel.toPersonId} (status: ${rel.status})`
      : `Created relationship ${rel.type} from ${rel.fromPersonId} to ${rel.toPersonId}`,
    reviewer
  );

  return { success: true };
}

export async function deleteRelationship(id: string, reviewer = 'User'): Promise<void> {
  const db = await getDB();
  const rel = await db.get('relationships', id);
  if (!rel) return;

  await db.delete('relationships', id);
  await logAudit(
    'delete',
    'relationship',
    id,
    `Deleted relationship ${rel.type} between ${rel.fromPersonId} and ${rel.toPersonId}`,
    reviewer
  );
}

export async function getAllOccurrences(): Promise<SourceOccurrence[]> {
  const db = await getDB();
  return db.getAll('sourceOccurrences');
}

export async function saveOccurrence(occurrence: SourceOccurrence): Promise<void> {
  const db = await getDB();
  await db.put('sourceOccurrences', occurrence);
}

export async function getAllAuditEvents(): Promise<AuditEvent[]> {
  const db = await getDB();
  const events = await db.getAll('auditEvents');
  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function getDatasetMode(): Promise<'real' | 'demo' | 'empty'> {
  const db = await getDB();
  const meta = await db.get('metadata', 'datasetMode');
  return (meta?.value as 'real' | 'demo' | 'empty') || 'empty';
}

export async function setDatasetMode(mode: 'real' | 'demo' | 'empty'): Promise<void> {
  const db = await getDB();
  await db.put('metadata', { key: 'datasetMode', value: mode });
}

export async function clearAllData(reviewer = 'User'): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['people', 'relationships', 'sources', 'sourceOccurrences', 'metadata'],
    'readwrite'
  );
  await tx.objectStore('people').clear();
  await tx.objectStore('relationships').clear();
  await tx.objectStore('sources').clear();
  await tx.objectStore('sourceOccurrences').clear();
  await tx.objectStore('metadata').clear();
  await tx.done;

  await logAudit('delete', 'import', 'all', 'Cleared all local records from database.', reviewer);
}

export async function bulkLoadData(
  data: {
    people: Person[];
    relationships: Relationship[];
    occurrences?: SourceOccurrence[];
    sources?: Source[];
    mode: 'real' | 'demo';
  },
  reviewer = 'User'
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['people', 'relationships', 'sources', 'sourceOccurrences', 'metadata'],
    'readwrite'
  );

  // Clear previous before loading if requested
  await tx.objectStore('people').clear();
  await tx.objectStore('relationships').clear();
  await tx.objectStore('sourceOccurrences').clear();
  await tx.objectStore('sources').clear();

  for (const p of data.people) {
    await tx.objectStore('people').put(p);
  }

  for (const r of data.relationships) {
    await tx.objectStore('relationships').put(r);
  }

  if (data.occurrences) {
    for (const occ of data.occurrences) {
      await tx.objectStore('sourceOccurrences').put(occ);
    }
  }

  if (data.sources) {
    for (const s of data.sources) {
      await tx.objectStore('sources').put(s);
    }
  }

  await tx.objectStore('metadata').put({ key: 'datasetMode', value: data.mode });
  await tx.done;

  await logAudit(
    'import_committed',
    'import',
    `bulk_${Date.now()}`,
    `Bulk loaded ${data.people.length} people, ${data.relationships.length} relationships in mode [${data.mode}].`,
    reviewer
  );
}
