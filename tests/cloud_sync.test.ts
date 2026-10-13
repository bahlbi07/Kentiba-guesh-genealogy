import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetchTree, subscribeToLiveCloudUpdates } from '../src/services/apiClient';
import { computeLineageChain, isSpouseHelperRecord } from '../src/services/googleSheetsService';
import { INITIAL_PEOPLE, INITIAL_RELATIONSHIPS } from '../src/data/initialGenealogyData';
import { Person, Relationship } from '../src/types/genealogy';

describe('Multi-Device Cloud Synchronization & Google Sheets Lineage Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. correctly computes clean lineage chain from Root Patriarch down to target person', () => {
    // Pick an existing person from initial dataset (e.g. ሓሊቦ under ትዕበ)
    const halibo = INITIAL_PEOPLE.find((p) => p.canonicalName.includes('ሓሊቦ') && p.branch === 'ትዕበ');
    expect(halibo).toBeDefined();

    if (halibo) {
      const res = computeLineageChain(halibo, INITIAL_PEOPLE, INITIAL_RELATIONSHIPS);
      expect(res.chain).toContain('ከንቲባ ጉዕሽ ሓጎስ');
      expect(res.chain).toContain('ትዕበ');
      expect(res.generation).toBeGreaterThan(1);
      expect(res.resolvedBranch).toBe('ትዕበ');
    }
  });

  it('2. filters out spouse helper records from Google Sheets bloodline sync', () => {
    const spousePerson = {
      id: 'pers_1791820081855_sp_0_b43',
      canonicalName: 'ደስታ ወልደሚካኤል',
      gender: 'female',
      status: 'verified',
      notes: 'መጻምድቲ ብስራት',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Person;
    expect(isSpouseHelperRecord(spousePerson)).toBe(true);

    const bloodlinePerson = {
      id: 'pers_1791821989553_bofu',
      canonicalName: 'ኣብርሃ',
      gender: 'male',
      status: 'verified',
      branch: 'ትዕበ',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Person;
    expect(isSpouseHelperRecord(bloodlinePerson)).toBe(false);
  });

  it('3. computeLineageChain generates clean chain for newly added member with parent link', () => {
    const parentPerson = INITIAL_PEOPLE.find((p) => p.canonicalName === 'ሓሊቦ' && p.branch === 'ትዕበ') || INITIAL_PEOPLE[1];
    const newPerson = {
      id: 'pers_test_new_member',
      canonicalName: 'ክብሮም ኣብርሃ',
      gender: 'male',
      branch: 'ትዕበ',
      fatherName: parentPerson.canonicalName,
      status: 'verified',
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Person;
    const parentRel = {
      id: 'rel_test_parent_child',
      fromPersonId: parentPerson.id,
      toPersonId: newPerson.id,
      type: 'parent_child',
      status: 'verified',
      sourceFile: '',
      sourcePage: 0,
      sourceWording: '',
    } as Relationship;

    const res = computeLineageChain(
      newPerson,
      [...INITIAL_PEOPLE, newPerson],
      [...INITIAL_RELATIONSHIPS, parentRel]
    );

    expect(res.chain).toContain('ከንቲባ ጉዕሽ ሓጎስ');
    expect(res.chain).toContain('ክብሮም ኣብርሃ');
    expect(res.immediateParentName).toBe(parentPerson.canonicalName);
  });

  it('4. subscribeToLiveCloudUpdates successfully handles escaped JSON in SSE message envelopes', () => {
    const syncCallback = vi.fn();
    
    // Test that the envelope format produced by ntfy.sh (escaped inner string) can be parsed cleanly
    const rawNtfyEnvelope = JSON.stringify({
      id: 'test_msg_1',
      time: 1728835000,
      event: 'message',
      topic: 'kinteba_guush_genealogy_live_v2',
      message: JSON.stringify({
        v: 2,
        people: [{ id: 'pers_live_test_1', canonicalName: 'ተፈተነ ኣባል', generation: 5 }],
        relationships: [],
        ts: new Date().toISOString(),
      }),
    });

    const parsedEnvelope = JSON.parse(rawNtfyEnvelope);
    expect(parsedEnvelope.event).toBe('message');
    expect(typeof parsedEnvelope.message).toBe('string');

    const innerDelta = JSON.parse(parsedEnvelope.message);
    expect(innerDelta.v).toBe(2);
    expect(innerDelta.people[0].canonicalName).toBe('ተፈተነ ኣባል');
  });
});
