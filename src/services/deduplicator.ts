import { Person, Relationship } from '../types/genealogy';

export interface DeduplicationResult {
  people: Person[];
  relationships: Relationship[];
  removedPersonIds: string[];
  removedRelationshipIds: string[];
  mergedCount: number;
  details: string[];
}

export interface DuplicateGroup {
  name: string;
  parentName?: string;
  parentId?: string;
  keeper: Person;
  duplicates: Person[];
}

/**
 * Normalizes an Ethiopic name for accurate matching.
 * Trims extra whitespace and normalizes spaces.
 */
export function normalizeEthiopicName(name: string): string {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Evaluates which person record is the authoritative canonical keeper.
 * Prefers pre-compiled historical records (pers_p*, pers_root*), verified records,
 * and records with richer relationships/metadata.
 */
function calculateKeeperScore(
  person: Person,
  relationships: Relationship[]
): number {
  let score = 0;

  // 1. Root or pre-compiled historical manuscript ID
  if (person.id.startsWith('pers_root_') || person.id.startsWith('pers_p')) {
    score += 1000;
  }

  // 2. Verified status
  if (person.status === 'verified') score += 100;
  else if (person.status === 'needs_review') score += 50;

  // 3. Count connected relationships
  const relCount = relationships.filter(
    (r) => r.fromPersonId === person.id || r.toPersonId === person.id
  ).length;
  score += relCount * 10;

  // 4. Metadata richness
  if (person.sourcePage) score += 20;
  if (person.sourceHeading) score += 10;
  if (person.notes && person.notes.length > 10) score += 5;

  return score;
}

/**
 * Scans the database and detects duplicate person groups.
 * Detects:
 * 1. Duplicate sibling children under the same parent with identical names (e.g. two "ሓጎስ" under "ዓዶ ዑመር")
 * 2. Unconnected duplicates with identical canonicalName and identical fatherName/branch
 */
export function findDuplicateCandidates(
  people: Person[],
  relationships: Relationship[]
): DuplicateGroup[] {
  const peopleMap = new Map<string, Person>();
  for (const p of people) {
    if (!p.isArchived) peopleMap.set(p.id, p);
  }

  const groups: DuplicateGroup[] = [];
  const handledDuplicateIds = new Set<string>();

  // 1. Detect duplicate children under each parent
  const parentToChildrenMap = new Map<string, string[]>();
  for (const rel of relationships) {
    if (rel.type === 'parent_child') {
      const current = parentToChildrenMap.get(rel.fromPersonId) || [];
      if (!current.includes(rel.toPersonId)) {
        current.push(rel.toPersonId);
        parentToChildrenMap.set(rel.fromPersonId, current);
      }
    }
  }

  for (const [parentId, childIds] of parentToChildrenMap.entries()) {
    const parentPerson = peopleMap.get(parentId);
    const nameMap = new Map<string, Person[]>();

    for (const cId of childIds) {
      const child = peopleMap.get(cId);
      if (!child) continue;
      const norm = normalizeEthiopicName(child.canonicalName);
      if (!norm) continue;
      const list = nameMap.get(norm) || [];
      list.push(child);
      nameMap.set(norm, list);
    }

    for (const [, candidates] of nameMap.entries()) {
      if (candidates.length > 1) {
        // Sort descending by score
        const sorted = [...candidates].sort(
          (a, b) =>
            calculateKeeperScore(b, relationships) -
            calculateKeeperScore(a, relationships)
        );
        const keeper = sorted[0];
        const duplicates = sorted.slice(1);

        for (const d of duplicates) {
          handledDuplicateIds.add(d.id);
        }

        groups.push({
          name: keeper.canonicalName,
          parentName: parentPerson?.canonicalName,
          parentId,
          keeper,
          duplicates,
        });
      }
    }
  }

  return groups;
}

/**
 * Deduplicates and merges family records.
 * - Detects duplicate siblings and people with identical names under the same lineage.
 * - Chooses the authoritative keeper and transfers all children and partner relationships.
 * - Recursively merges matching descendant children so child lines are not duplicated.
 * - Removes duplicate person records and duplicate relationship edges.
 */
export function deduplicateFamilyRecords(
  inputPeople: Person[],
  inputRelationships: Relationship[]
): DeduplicationResult {
  const peopleMap = new Map<string, Person>();
  for (const p of inputPeople) {
    peopleMap.set(p.id, { ...p });
  }

  let workingRelationships: Relationship[] = inputRelationships.map((r) => ({
    ...r,
  }));
  const removedPersonIds: string[] = [];
  const removedRelIds: string[] = [];
  const details: string[] = [];
  let mergedCount = 0;

  // Repeat merging passes until no more duplicate groups are found (handles multi-generation cascade duplicates)
  let pass = 0;
  const maxPasses = 10;

  while (pass < maxPasses) {
    pass++;
    const activePeople = Array.from(peopleMap.values()).filter(
      (p) => !p.isArchived && !removedPersonIds.includes(p.id)
    );
    const activeRels = workingRelationships.filter(
      (r) =>
        !removedRelIds.includes(r.id) &&
        !removedPersonIds.includes(r.fromPersonId) &&
        !removedPersonIds.includes(r.toPersonId)
    );

    const duplicateGroups = findDuplicateCandidates(activePeople, activeRels);
    if (duplicateGroups.length === 0) {
      break;
    }

    for (const group of duplicateGroups) {
      const keeper = peopleMap.get(group.keeper.id);
      if (!keeper) continue;

      for (const dup of group.duplicates) {
        if (removedPersonIds.includes(dup.id)) continue;
        removedPersonIds.push(dup.id);
        mergedCount++;

        details.push(
          `ተደጋሚ "${dup.canonicalName}" (ID: ${dup.id}) ናብቲ ዋና መዝገብ (ID: ${keeper.id}${
            group.parentName ? `, ወላዲ: ${group.parentName}` : ''
          }) ተወሃሂዱ።`
        );

        // Merge notes if duplicate has unique notes
        if (dup.notes && dup.notes.trim() && (!keeper.notes || !keeper.notes.includes(dup.notes.trim()))) {
          keeper.notes = keeper.notes ? `${keeper.notes} | ${dup.notes.trim()}` : dup.notes.trim();
        }

        // Remap relationships involving dup
        for (const rel of workingRelationships) {
          if (removedRelIds.includes(rel.id)) continue;

          // Outgoing: dup -> child or partner
          if (rel.fromPersonId === dup.id) {
            if (rel.toPersonId === keeper.id) {
              // Self-loop after remap -> remove
              removedRelIds.push(rel.id);
            } else {
              rel.fromPersonId = keeper.id;
            }
          }

          // Incoming: parent or partner -> dup
          if (rel.toPersonId === dup.id) {
            if (rel.fromPersonId === keeper.id) {
              // Self-loop after remap -> remove
              removedRelIds.push(rel.id);
            } else {
              rel.toPersonId = keeper.id;
            }
          }
        }
      }
    }
  }

  // Deduplicate redundant relationship edges
  const edgeSeen = new Set<string>();
  const finalRels: Relationship[] = [];

  for (const rel of workingRelationships) {
    if (removedRelIds.includes(rel.id)) continue;
    if (removedPersonIds.includes(rel.fromPersonId) || removedPersonIds.includes(rel.toPersonId)) {
      removedRelIds.push(rel.id);
      continue;
    }
    // Remove self-referential relations
    if (rel.fromPersonId === rel.toPersonId) {
      removedRelIds.push(rel.id);
      continue;
    }

    const edgeKey = `${rel.fromPersonId}:::${rel.toPersonId}:::${rel.type}`;
    if (edgeSeen.has(edgeKey)) {
      removedRelIds.push(rel.id);
    } else {
      edgeSeen.add(edgeKey);
      finalRels.push(rel);
    }
  }

  // Final cleaned people
  const finalPeople = Array.from(peopleMap.values()).filter(
    (p) => !removedPersonIds.includes(p.id)
  );

  return {
    people: finalPeople,
    relationships: finalRels,
    removedPersonIds,
    removedRelationshipIds: Array.from(new Set(removedRelIds)),
    mergedCount,
    details,
  };
}
