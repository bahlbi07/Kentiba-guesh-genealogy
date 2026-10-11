import { describe, it, expect } from 'vitest';
import { Person, Relationship } from '../src/types/genealogy';
import {
  deduplicateFamilyRecords,
  findDuplicateCandidates,
  normalizeEthiopicName,
} from '../src/services/deduplicator';

function mockPerson(overrides: Partial<Person> & { id: string; canonicalName: string }): Person {
  const now = new Date().toISOString();
  return {
    displayName: undefined,
    branch: undefined,
    status: 'verified',
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function mockRel(
  overrides: Partial<Relationship> & {
    id: string;
    fromPersonId: string;
    toPersonId: string;
    type: 'parent_child' | 'partner_or_union';
  }
): Relationship {
  const now = new Date().toISOString();
  return {
    status: 'verified',
    sourceFile: 'ከሰተ-ብርሃነ.pdf',
    sourcePage: null,
    sourceWording: 'መዝገብ',
    isBiologicalConfirmed: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('Genealogy Deduplication & Merge Engine', () => {
  it('normalizes Ethiopic names properly', () => {
    expect(normalizeEthiopicName('  ሓጎስ   ')).toBe('ሓጎስ');
    expect(normalizeEthiopicName('ከንቲባ   ጉዑሽ ')).toBe('ከንቲባ ጉዑሽ');
  });

  it('detects and merges duplicate siblings under the same parent (e.g. duplicate ሓጎስ and ሓሊቦ under ዓዶ ዑመር)', () => {
    const parent = mockPerson({
      id: 'pers_p15_310',
      canonicalName: 'ዓዶ ዑመር',
      status: 'verified',
    });

    // 1. Authoritative default historical Hagos & Halibo
    const historicalHagos = mockPerson({
      id: 'pers_p15_313',
      canonicalName: 'ሓጎስ',
      fatherName: 'ዓዲዑማር',
      branch: 'ዓዲዑማር',
      sourcePage: 15,
    });

    const historicalHalibo = mockPerson({
      id: 'pers_p15_315',
      canonicalName: 'ሓሊቦ',
      fatherName: 'ሓጎስ',
      branch: 'ዓዲዑማር',
      sourcePage: 15,
    });

    // 2. Newly created duplicate Hagos & Halibo (from testing / user input)
    const duplicateHagos = mockPerson({
      id: 'pers_1791748000_anc_1_xyz',
      canonicalName: 'ሓጎስ',
      branch: 'ትዕበ',
      notes: 'ወለዶ ስድራቤት',
    });

    const duplicateHalibo = mockPerson({
      id: 'pers_1791748000_anc_0_abc',
      canonicalName: 'ሓሊቦ',
      branch: 'ትዕበ',
      notes: 'ወለዶ ስድራቤት',
    });

    // 3. A new child added under duplicateHalibo that should be preserved!
    const newGrandchild = mockPerson({
      id: 'pers_new_grandchild_123',
      canonicalName: 'ተኽለ',
      fatherName: 'ሓሊቦ',
      branch: 'ትዕበ',
    });

    const people: Person[] = [
      parent,
      historicalHagos,
      historicalHalibo,
      duplicateHagos,
      duplicateHalibo,
      newGrandchild,
    ];

    const relationships: Relationship[] = [
      // Parent -> historical Hagos
      mockRel({
        id: 'rel_parent_to_hist_hagos',
        fromPersonId: parent.id,
        toPersonId: historicalHagos.id,
        type: 'parent_child',
      }),
      // Historical Hagos -> historical Halibo
      mockRel({
        id: 'rel_hist_hagos_to_hist_halibo',
        fromPersonId: historicalHagos.id,
        toPersonId: historicalHalibo.id,
        type: 'parent_child',
      }),
      // Parent -> duplicate Hagos
      mockRel({
        id: 'rel_parent_to_dup_hagos',
        fromPersonId: parent.id,
        toPersonId: duplicateHagos.id,
        type: 'parent_child',
      }),
      // Duplicate Hagos -> duplicate Halibo
      mockRel({
        id: 'rel_dup_hagos_to_dup_halibo',
        fromPersonId: duplicateHagos.id,
        toPersonId: duplicateHalibo.id,
        type: 'parent_child',
      }),
      // Duplicate Halibo -> new grandchild (new child added by user)
      mockRel({
        id: 'rel_dup_halibo_to_grandchild',
        fromPersonId: duplicateHalibo.id,
        toPersonId: newGrandchild.id,
        type: 'parent_child',
      }),
    ];

    // Check candidate detection
    const candidates = findDuplicateCandidates(people, relationships);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some((c) => c.name === 'ሓጎስ')).toBe(true);

    // Run full deduplication & merge
    const result = deduplicateFamilyRecords(people, relationships);

    // Duplicate Hagos and Halibo must be removed
    expect(result.removedPersonIds).toContain(duplicateHagos.id);
    expect(result.removedPersonIds).toContain(duplicateHalibo.id);

    // Result people must only contain 1 Hagos and 1 Halibo (the historical keepers)
    const remainingHagos = result.people.filter((p) => p.canonicalName === 'ሓጎስ');
    expect(remainingHagos).toHaveLength(1);
    expect(remainingHagos[0].id).toBe(historicalHagos.id);

    const remainingHalibo = result.people.filter((p) => p.canonicalName === 'ሓሊቦ');
    expect(remainingHalibo).toHaveLength(1);
    expect(remainingHalibo[0].id).toBe(historicalHalibo.id);

    // The user's newly added grandchild must be preserved!
    const grandchildInResult = result.people.find((p) => p.id === newGrandchild.id);
    expect(grandchildInResult).toBeDefined();

    // The grandchild's parent relationship must now point from historical Halibo!
    const grandchildRel = result.relationships.find(
      (r) => r.toPersonId === newGrandchild.id && r.type === 'parent_child'
    );
    expect(grandchildRel).toBeDefined();
    expect(grandchildRel?.fromPersonId).toBe(historicalHalibo.id);

    // No duplicate edges between Parent and Hagos
    const parentToHagosRels = result.relationships.filter(
      (r) => r.fromPersonId === parent.id && r.toPersonId === historicalHagos.id
    );
    expect(parentToHagosRels).toHaveLength(1);

    // No duplicate edges between Hagos and Halibo
    const hagosToHaliboRels = result.relationships.filter(
      (r) => r.fromPersonId === historicalHagos.id && r.toPersonId === historicalHalibo.id
    );
    expect(hagosToHaliboRels).toHaveLength(1);
  });

  it('eliminates duplicate relationship edges between identical people', () => {
    const people: Person[] = [
      mockPerson({ id: 'p1', canonicalName: 'ወላዲ' }),
      mockPerson({ id: 'p2', canonicalName: 'ውሉድ' }),
    ];

    const duplicateRels: Relationship[] = [
      mockRel({
        id: 'rel_1',
        fromPersonId: 'p1',
        toPersonId: 'p2',
        type: 'parent_child',
      }),
      mockRel({
        id: 'rel_2',
        fromPersonId: 'p1',
        toPersonId: 'p2',
        type: 'parent_child',
      }),
    ];

    const result = deduplicateFamilyRecords(people, duplicateRels);
    expect(result.relationships).toHaveLength(1);
    expect(result.removedRelationshipIds).toContain('rel_2');
  });
});
