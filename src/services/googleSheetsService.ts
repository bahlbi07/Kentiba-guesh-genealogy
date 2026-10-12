import { Person, Relationship } from '../types/genealogy';

export const GOOGLE_SHEETS_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbz1CHBFXD1vhbW0mvvzDJhaycQ1MHJHYXAiQSAX58Xa8UBp_L6Wg5kgrdCE5J21bD4K/exec';

export interface GoogleSheetSyncPayload {
  canonicalName: string;
  branch: string;
  generation: number | string;
  lineageChain: string;
  fatherName: string;
  motherName: string;
  spouseName: string;
  status: string;
  notes: string;
}

/**
 * Computes lineage path from root ancestor down to this person:
 * e.g., ["ከንቲባ ጉዕሽ", "ጎብሩ", "ተከለ", "ገብረመድህን"]
 */
export function computeLineageChain(
  person: Person,
  allPeople: Person[],
  allRelationships: Relationship[]
): { chain: string; generation: number } {
  const peopleMap = new Map<string, Person>(allPeople.map((p) => [p.id, p]));
  const childToParentMap = new Map<string, string>();

  for (const rel of allRelationships) {
    if (rel.type === 'parent_child' && !rel.deletionPending) {
      childToParentMap.set(rel.toPersonId, rel.fromPersonId);
    }
  }

  const path: string[] = [person.canonicalName];
  const visited = new Set<string>([person.id]);
  let currentId = person.id;

  while (childToParentMap.has(currentId)) {
    const parentId = childToParentMap.get(currentId)!;
    if (visited.has(parentId)) break; // cycle protection
    visited.add(parentId);

    const parent = peopleMap.get(parentId);
    if (!parent) break;

    path.unshift(parent.canonicalName);
    currentId = parentId;
  }

  // Ensure Root Patriarch is always at the top if not already present
  if (path.length > 0 && !path[0].includes('ከንቲባ ጉዕሽ')) {
    path.unshift('ከንቲባ ጉዕሽ ሓጎስ');
  }

  return {
    chain: path.join(' › '),
    generation: path.length,
  };
}

/**
 * Sends a single person's information to Google Sheets Webhook asynchronously.
 * Safe and non-blocking: never fails client mutations if network is offline.
 */
export async function syncPersonToGoogleSheets(
  person: Person,
  allPeople: Person[] = [],
  allRelationships: Relationship[] = []
): Promise<{ success: boolean; error?: string }> {
  try {
    const { chain, generation } = computeLineageChain(person, allPeople, allRelationships);

    const payload: GoogleSheetSyncPayload = {
      canonicalName: person.canonicalName,
      branch: person.branch || '',
      generation,
      lineageChain: chain,
      fatherName: person.fatherName || '',
      motherName: person.motherName || '',
      spouseName: person.spouseNote || '',
      status: person.status === 'verified' ? 'ዝተረጋገጸ' : 'ሓድሽ ዝኣተወ',
      notes: person.notes || '',
    };

    // Google Apps Script redirect handling requires mode: 'no-cors' or following redirects
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      mode: 'no-cors', // essential for Google Apps Script Web App from browser clients
    });

    return { success: true };
  } catch (err: any) {
    console.warn('Google Sheets Webhook Sync Notice:', err?.message || err);
    return { success: false, error: err?.message || 'Sync error' };
  }
}

/**
 * Tests connection to Google Sheets by sending a sample test row
 */
export async function testGoogleSheetsPing(): Promise<boolean> {
  try {
    await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        canonicalName: 'ፈተነ መስመር (Test Ping)',
        branch: 'ጎብሩ',
        generation: 1,
        lineageChain: 'ከንቲባ ጉዕሽ › ፈተነ',
        fatherName: 'ከንቲባ ጉዕሽ',
        motherName: '',
        spouseName: '',
        status: 'ዝተረጋገጸ (Verified)',
        notes: 'ናይ ሱፐር ኣድሚን ፈተነ ምልክት',
      }),
      mode: 'no-cors',
    });
    return true;
  } catch {
    return false;
  }
}

