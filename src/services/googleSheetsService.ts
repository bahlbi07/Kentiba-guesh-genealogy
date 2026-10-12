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
 * Checks whether a Person record is a helper spouse record rather than a bloodline descendant.
 */
export function isSpouseHelperRecord(person: Person): boolean {
  if (!person) return true;
  if (person.id.includes('_sp_') || person.id.includes('_main_sp_')) {
    return true;
  }
  const note = (person.notes || '').trim();
  if (note.startsWith('መጻምድቲ ')) {
    return true;
  }
  return false;
}

/**
 * Computes the complete, clean bloodline lineage path from the Root Patriarch
 * ("ከንቲባ ጉዕሽ ሓጎስ") down to the target person:
 * e.g., "ከንቲባ ጉዕሽ ሓጎስ › ትዕበ › ዓዶ ዑመር › ሓጎስ › ሓሊቦ › ኣብርሃ ሓሊቦ › ክብሮም"
 *
 * Automatically ignores spouse-only helper parent links so the bloodline path
 * up to Kinteba Guush is never cut short by a spouse node.
 */
export function computeLineageChain(
  person: Person,
  allPeople: Person[],
  allRelationships: Relationship[]
): { chain: string; generation: number; resolvedBranch: string; immediateParentName: string } {
  const peopleMap = new Map<string, Person>(allPeople.map((p) => [p.id, p]));
  peopleMap.set(person.id, person);

  const childToParentsMap = new Map<string, string[]>();
  for (const rel of allRelationships) {
    if (rel.type === 'parent_child' && !rel.deletionPending) {
      const list = childToParentsMap.get(rel.toPersonId) || [];
      if (!list.includes(rel.fromPersonId)) {
        list.push(rel.fromPersonId);
        childToParentsMap.set(rel.toPersonId, list);
      }
    }
  }

  // Find the deepest ancestral path leading toward the root patriarch (ከንቲባ ጉዕሽ)
  const findBestAncestralIds = (currentId: string, visited: Set<string>): string[] => {
    const parentIds = childToParentsMap.get(currentId) || [];
    let bestPath: string[] = [];
    let bestScore = -1;

    for (const parentId of parentIds) {
      if (visited.has(parentId)) continue;
      const parentPerson = peopleMap.get(parentId);
      if (!parentPerson) continue;

      // Skip spouse helper nodes when walking up the bloodline
      if (isSpouseHelperRecord(parentPerson) && parentIds.length > 1) {
        continue;
      }

      const nextVisited = new Set(visited);
      nextVisited.add(parentId);
      const ancestorChain = findBestAncestralIds(parentId, nextVisited);
      const candidatePath = [...ancestorChain, parentId];

      // Score paths that reach the root patriarch highest, then by length
      const topPerson = peopleMap.get(candidatePath[0]);
      const reachesRoot =
        topPerson &&
        (topPerson.id === 'pers_p1_0_0' ||
          topPerson.id === 'pers_root_kinteba_guush' ||
          topPerson.canonicalName.includes('ከንቲባ ጉዕሽ'));
      const score = (reachesRoot ? 1000 : 0) + candidatePath.length * 10 + (isSpouseHelperRecord(parentPerson) ? -50 : 0);

      if (score > bestScore) {
        bestScore = score;
        bestPath = candidatePath;
      }
    }

    return bestPath;
  };

  const ancestorIds = findBestAncestralIds(person.id, new Set([person.id]));
  const fullIds = [...ancestorIds, person.id];

  const namesPath: string[] = [];
  let resolvedBranch = person.branch || '';

  for (const id of fullIds) {
    const p = peopleMap.get(id);
    if (!p) continue;
    let cleanName = p.canonicalName.trim();
    if (cleanName.startsWith('ሓረግ ወለዶ ')) {
      cleanName = cleanName.replace(/^ሓረግ ወለዶ\s+/, '').trim();
    }
    namesPath.push(cleanName);
    if (!resolvedBranch && p.branch && p.branch !== 'ከንቲባ ጉዕሽ') {
      resolvedBranch = p.branch;
    }
  }

  // Ensure Root Patriarch is at the top of the chain
  if (namesPath.length > 0 && !namesPath[0].includes('ከንቲባ ጉዕሽ')) {
    if (resolvedBranch && namesPath[0] !== resolvedBranch) {
      namesPath.unshift(resolvedBranch);
    }
    namesPath.unshift('ከንቲባ ጉዕሽ ሓጎስ');
  }

  // Determine immediate parent name from the chain
  const immediateParentName =
    namesPath.length >= 2 ? namesPath[namesPath.length - 2] : person.fatherName || '';

  // Determine branch from second element in chain (directly under ከንቲባ ጉዕሽ ሓጎስ) if still empty
  if (!resolvedBranch && namesPath.length >= 2) {
    resolvedBranch = namesPath[1];
  }

  return {
    chain: namesPath.join(' › '),
    generation: namesPath.length,
    resolvedBranch,
    immediateParentName,
  };
}

/**
 * Sends a single newly added bloodline member's name and full lineage chain to Google Sheets.
 * Only sends clean genealogical lineage data (zero system clutter).
 */
export async function syncPersonToGoogleSheets(
  person: Person,
  allPeople: Person[] = [],
  allRelationships: Relationship[] = []
): Promise<{ success: boolean; error?: string }> {
  try {
    // Never send helper spouse records to Google Sheets
    if (isSpouseHelperRecord(person)) {
      return { success: true };
    }

    const { chain, generation, resolvedBranch, immediateParentName } = computeLineageChain(
      person,
      allPeople,
      allRelationships
    );

    const payload: GoogleSheetSyncPayload = {
      canonicalName: person.canonicalName.trim(),
      branch: resolvedBranch || person.branch || '',
      generation,
      lineageChain: chain,
      fatherName: immediateParentName || person.fatherName || '',
      motherName: '',
      spouseName: '',
      status: 'ሓድሽ ወለዶ',
      notes: '',
    };

    await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      mode: 'no-cors',
    });

    return { success: true };
  } catch (err: any) {
    console.warn('Google Sheets Webhook Sync Notice:', err?.message || err);
    return { success: false, error: err?.message || 'Sync error' };
  }
}

/**
 * Filters a batch of people saved by an Admin so ONLY genuinely new bloodline members
 * (not existing ancestors and not spouse helper records) are sent to Google Sheets,
 * using the complete merged people + relationships list so the lineage chain is 100% intact.
 */
export async function syncNewBatchToGoogleSheets(
  batchPeople: Person[],
  batchRelationships: Relationship[],
  existingPeople: Person[],
  existingRelationships: Relationship[]
): Promise<void> {
  const existingPersonIds = new Set(existingPeople.map((p) => p.id));

  // Merge existing + new batch so computeLineageChain can walk all new parent_child links
  const mergedPeopleMap = new Map<string, Person>();
  for (const p of existingPeople) mergedPeopleMap.set(p.id, p);
  for (const p of batchPeople) mergedPeopleMap.set(p.id, p);
  const allPeople = Array.from(mergedPeopleMap.values());

  const mergedRelsMap = new Map<string, Relationship>();
  for (const r of existingRelationships) mergedRelsMap.set(r.id, r);
  for (const r of batchRelationships) mergedRelsMap.set(r.id, r);
  const allRelationships = Array.from(mergedRelsMap.values());

  // Only include brand-new bloodline members (not previously in database, not spouse helper nodes, not ancestor chain steps)
  const newBloodlineMembers = batchPeople.filter((p) => {
    if (existingPersonIds.has(p.id)) return false;
    if (isSpouseHelperRecord(p)) return false;
    if (p.id.includes('_anc_')) return false;
    return true;
  });

  for (const newMember of newBloodlineMembers) {
    await syncPersonToGoogleSheets(newMember, allPeople, allRelationships);
  }
}

/**
 * Tests connection to Google Sheets by sending a clean sample lineage row
 */
export async function testGoogleSheetsPing(): Promise<boolean> {
  try {
    await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        canonicalName: 'ፈተነ መስመር',
        branch: 'ትዕበ',
        generation: 2,
        lineageChain: 'ከንቲባ ጉዕሽ ሓጎስ › ትዕበ',
        fatherName: 'ከንቲባ ጉዕሽ ሓጎስ',
        motherName: '',
        spouseName: '',
        status: 'ሓድሽ ወለዶ',
        notes: '',
      }),
      mode: 'no-cors',
    });
    return true;
  } catch {
    return false;
  }
}
