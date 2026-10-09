import {
  Person,
  Relationship,
  SourceOccurrence,
  ImportPreviewStats,
  RelationshipType,
  RecordStatus
} from '../types/genealogy';

export interface ParsedBlock {
  page: number;
  blockHeading: string;
  relationshipWording: string;
  relationshipType: RelationshipType | 'unlabelled' | 'continuation' | 'opening';
  parentName?: string;
  partnerName?: string;
  isContinuation?: boolean;
  names: string[];
  rawLines: string[];
  needsReview: boolean;
  notes?: string;
}

export interface ParseResult {
  stats: ImportPreviewStats;
  blocks: ParsedBlock[];
  occurrences: SourceOccurrence[];
  stagedPeople: Person[];
  stagedRelationships: Relationship[];
  uncertainRecords: {
    page: number;
    wording: string;
    names: string[];
    reason: string;
  }[];
}

/**
 * Extracts parent and optional partner from a Tigrinya relationship phrase.
 * Examples:
 * - "ጎብሩ ከንቲባ ጉዕሽ ዝወለዶም" -> parent: "ጎብሩ"
 * - "ተላ ዝወለዶም" -> parent: "ተላ"
 * - "ተክኣ ናብ ቀሺ ተክለ ሃይማኖት ዓዲምባረክ ኣትያ ዝወለደቶም ድማ" -> parent: "ተክኣ", partner: "ቀሺ ተክለ ሃይማኖት ዓዲምባረክ"
 * - "ዘውዲቱ ዝወለደቶም" -> parent: "ዘውዲቱ"
 */
function parseRelationshipPhrase(phrase: string): {
  type: RelationshipType;
  parentName?: string;
  partnerName?: string;
  isUnion: boolean;
} {
  const clean = phrase.trim().replace(/^`|`$/g, '');

  // Union pattern: "X ናብ Y ... ኣትያ ዝወለደቶም/ድማ"
  const unionMatch = clean.match(/^([^\s]+)\s+ናብ\s+(.+?)\s+ኣትያ\s+ዝወለ/);
  if (unionMatch) {
    return {
      type: 'partner_or_union',
      parentName: unionMatch[1].trim(),
      partnerName: unionMatch[2].trim(),
      isUnion: true,
    };
  }

  // Parent pattern: matches "X ዝወለዶም", "X ዝወለደቶም", "X ከንቲባ ጉዕሽ ዝወለዶም", "X ከንቲ ጉዕሽ ዝወለዶም", etc.
  const parentMatch = clean.match(/^([^\s]+)(?:\s+(?:ከንቲባ|ከንቲ)?\s*ጉ[ዕዑ]ሽ)?\s+ዝወለ/);
  if (parentMatch) {
    return {
      type: 'parent_child',
      parentName: parentMatch[1].trim(),
      isUnion: false,
    };
  }

  return {
    type: 'other_source_statement',
    isUnion: false,
  };
}

export function parseRegisterMarkdown(markdownContent: string): ParseResult {
  const lines = markdownContent.split(/\r?\n/);
  const blocks: ParsedBlock[] = [];
  let currentPage = 1;

  let currentHeading = '';
  let currentRawLines: string[] = [];
  let currentNames: string[] = [];

  const finalizeCurrentBlock = () => {
    if (!currentHeading && currentNames.length === 0 && currentRawLines.length === 0) return;

    let relType: RelationshipType | 'unlabelled' | 'continuation' | 'opening' = 'other_source_statement';
    let parentName: string | undefined;
    let partnerName: string | undefined;
    let isContinuation = false;
    let needsReview = false;
    let notes: string | undefined;

    if (currentHeading.includes('Opening names under the title')) {
      relType = 'opening';
      needsReview = true;
      notes = 'Opening branch names recorded under Kinteba Guush title; relationships not individually specified.';
    } else if (currentHeading.includes('Confirmed continuation from PDF page')) {
      isContinuation = true;
      const phraseMatch = currentHeading.match(/`([^`]+)`/);
      const rawPhrase = phraseMatch ? phraseMatch[1].trim() : currentHeading;
      const parsedPhrase = parseRelationshipPhrase(rawPhrase);
      relType = parsedPhrase.type;
      parentName = parsedPhrase.parentName;
      partnerName = parsedPhrase.partnerName;
      needsReview = false;
      notes = `Confirmed continuation from preceding page: ${rawPhrase}`;
    } else if (
      currentHeading.includes('Unresolved continuation') ||
      currentHeading.includes('needs review') ||
      currentHeading.includes('needs_review')
    ) {
      isContinuation = true;
      const phraseMatch = currentHeading.match(/`([^`]+)`/);
      const rawPhrase = phraseMatch ? phraseMatch[1].trim() : currentHeading;
      const parsedPhrase = parseRelationshipPhrase(rawPhrase);
      relType = parsedPhrase.type !== 'other_source_statement' ? parsedPhrase.type : 'other_source_statement';
      parentName = parsedPhrase.parentName;
      partnerName = parsedPhrase.partnerName;
      needsReview = true;
      notes = `Unresolved / ambiguous statement: ${rawPhrase}. Flagged for family confirmation.`;
    } else if (currentHeading.includes('Unlabelled name') || currentHeading.includes('unlabelled')) {
      relType = 'unlabelled';
      needsReview = true;
      notes = 'Unlabelled in source text. Relationship unassigned pending visual confirmation with PDF.';
    } else if (currentHeading.includes('Continuation')) {
      isContinuation = true;
      const phraseMatch = currentHeading.match(/`([^`]+)`/);
      if (phraseMatch) {
        const rawPhrase = phraseMatch[1].trim();
        const parsedPhrase = parseRelationshipPhrase(rawPhrase);
        relType = parsedPhrase.type;
        parentName = parsedPhrase.parentName;
        partnerName = parsedPhrase.partnerName;
      } else {
        relType = 'continuation';
      }
      needsReview = true;
      notes = 'Continuation block across page boundary. Verify grouping against source layout.';
    } else if (
      currentHeading.includes('Source relationship:') ||
      currentHeading.includes('Source relationship heading') ||
      currentHeading.includes('Source relationship statement') ||
      currentHeading.includes('Source statement:')
    ) {
      const phraseMatch =
        currentHeading.match(/Source relationship(?:\s+heading)?(?:\s+at\s+the\s+[^\:]+)?:\s*`([^`]+)`/) ||
        currentHeading.match(/Source relationship statement(?:\s+at\s+the\s+[^\:]+)?:\s*`([^`]+)`/) ||
        currentHeading.match(/Source statement:\s*`([^`]+)`/) ||
        currentHeading.match(/`([^`]+)`/);
      const rawPhrase = phraseMatch ? phraseMatch[1].trim() : currentHeading;
      const parsedPhrase = parseRelationshipPhrase(rawPhrase);
      relType = parsedPhrase.type;
      parentName = parsedPhrase.parentName;
      partnerName = parsedPhrase.partnerName;

      if (parsedPhrase.isUnion) {
        notes = `Union/marriage statement: ${rawPhrase}`;
      }
    } else if (currentHeading.includes('Incomplete') || currentHeading.includes('PDF page 36')) {
      relType = 'other_source_statement';
      needsReview = true;
      notes = 'Incomplete statement recorded without child names.';
    }

    // Check for incomplete headings with zero children
    if (
      currentNames.length === 0 &&
      currentRawLines.some(
        (l) =>
          l.includes('No names are listed') ||
          l.includes('incomplete') ||
          l.includes('not shown before the next heading') ||
          l.includes('ended the document after this heading')
      )
    ) {
      needsReview = true;
      notes = notes
        ? `${notes} — No children listed in source text.`
        : 'Heading recorded in source without children listed beneath it.';
    }

    blocks.push({
      page: currentPage,
      blockHeading: currentHeading,
      relationshipWording: currentHeading,
      relationshipType: relType,
      parentName,
      partnerName,
      isContinuation,
      names: [...currentNames],
      rawLines: [...currentRawLines],
      needsReview,
      notes,
    });

    currentHeading = '';
    currentRawLines = [];
    currentNames = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect Page headers: "## PDF page 1"
    const pageMatch = line.match(/^##\s+PDF\s+page\s+(\d+)/i);
    if (pageMatch) {
      finalizeCurrentBlock();
      currentPage = parseInt(pageMatch[1], 10);
      continue;
    }

    // Detect Block Subheadings: "### ..."
    if (line.startsWith('### ')) {
      finalizeCurrentBlock();
      currentHeading = line.substring(4).trim();
      currentRawLines.push(line);
      continue;
    }

    // Detect Names under lists: "- Name"
    if (line.trim().startsWith('- ')) {
      const itemText = line.trim().substring(2).trim();
      // Skip markdown checkboxes, checklist items, and explanatory bullet notes
      if (
        itemText.startsWith('[ ]') ||
        itemText.startsWith('[x]') ||
        itemText.startsWith('No names are listed') ||
        itemText.startsWith('Associated names continue') ||
        itemText.startsWith('The listed names continue') ||
        itemText.startsWith('Names continue') ||
        itemText.startsWith('This statement appears') ||
        itemText.includes('PDF page')
      ) {
        currentRawLines.push(line);
      } else if (itemText.length > 0) {
        const cleanName = itemText.replace(/^`|`$/g, '').trim();
        currentNames.push(cleanName);
        currentRawLines.push(line);
      }
      continue;
    }

    if (line.trim().length > 0) {
      currentRawLines.push(line);
    }
  }

  // Finalize trailing block
  finalizeCurrentBlock();

  // Create Root / Patriarch with stable timestamp
  const STABLE_TIMESTAMP = '2026-10-09T00:00:00.000Z';
  const rootPersonId = 'pers_root_kinteba_guush';
  const stagedPeople: Person[] = [
    {
      id: rootPersonId,
      canonicalName: 'ከንቲባ ጉዑሽ ሓጎስ',
      displayName: 'Kinteba Guush Hagos (ከንቲባ ጉዑሽ ሓጎስ)',
      branch: 'Main Ancestor',
      status: 'verified',
      notes: 'Patriarch named in source title: ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ (PDF page 1)',
      sourcePage: 1,
      sourceHeading: 'ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ',
      isArchived: false,
      createdAt: STABLE_TIMESTAMP,
      updatedAt: STABLE_TIMESTAMP,
    },
  ];

  const stagedRelationships: Relationship[] = [];
  const occurrences: SourceOccurrence[] = [];
  const uncertainRecords: { page: number; wording: string; names: string[]; reason: string }[] = [];

  // Track name frequencies to detect duplicates across different occurrences
  const nameOccurrencesMap = new Map<string, { count: number; pages: number[] }>();

  // Map from canonicalName to list of candidate person IDs created so far
  const nameToPersonIds = new Map<string, string[]>();
  nameToPersonIds.set('ከንቲባ ጉዑሽ', [rootPersonId]);
  nameToPersonIds.set('ከንቲባ ጉዑሽ ሓጎስ', [rootPersonId]);

  let occurrenceSeq = 0;
  let confirmedContinuationsCount = 0;

  for (const block of blocks) {
    if (block.blockHeading.includes('Confirmed continuation')) {
      confirmedContinuationsCount++;
    }

    if (
      block.needsReview ||
      block.relationshipType === 'unlabelled' ||
      (block.relationshipType === 'continuation' && !block.blockHeading.includes('Confirmed continuation'))
    ) {
      uncertainRecords.push({
        page: block.page,
        wording: block.blockHeading,
        names: block.names,
        reason: block.notes || 'Unlabelled or ambiguous statement requiring review',
      });
    }

    // Resolve parent candidate
    let parentPersonIdToUse: string | undefined;
    if (block.parentName) {
      const candidates = nameToPersonIds.get(block.parentName);
      if (candidates && candidates.length > 0) {
        // If the heading explicitly refers to child of Kinteba Guush, pick the root's direct child
        if (
          block.blockHeading.includes('ከንቲባ ጉዕሽ') ||
          block.blockHeading.includes('ከንቲባ ጉዑሽ') ||
          block.blockHeading.includes('ከንቲ ጉዕሽ')
        ) {
          parentPersonIdToUse = candidates[0];
        } else {
          // Most recent candidate created before this block
          parentPersonIdToUse = candidates[candidates.length - 1];
        }
      } else {
        // Parent named in heading but not previously indexed
        occurrenceSeq++;
        const autoParentId = `pers_parent_head_p${block.page}_${occurrenceSeq}`;
        const autoParentOccId = `occ_parent_head_p${block.page}_${occurrenceSeq}`;
        const autoParent: Person = {
          id: autoParentId,
          canonicalName: block.parentName,
          branch: block.parentName,
          status: 'unverified',
          notes: `Parent introduced in heading: ${block.blockHeading} (PDF page ${block.page})`,
          sourcePage: block.page,
          sourceHeading: block.blockHeading,
          sourceOccurrenceId: autoParentOccId,
          isArchived: false,
          createdAt: STABLE_TIMESTAMP,
          updatedAt: STABLE_TIMESTAMP,
        };
        stagedPeople.push(autoParent);
        occurrences.push({
          id: autoParentOccId,
          sourceFile: 'ከሰተ-ብርሃነ.pdf',
          page: block.page,
          headingOrBlock: block.blockHeading,
          rawText: block.parentName,
          sequence: occurrenceSeq,
          linkedPersonId: autoParentId,
          status: 'linked',
          notes: 'Parent introduced in heading',
        });
        nameToPersonIds.set(block.parentName, [autoParentId]);
        parentPersonIdToUse = autoParentId;

        // If heading mentions Kinteba Guush, link to root
        if (
          block.blockHeading.includes('ከንቲባ ጉዕሽ') ||
          block.blockHeading.includes('ከንቲባ ጉዑሽ') ||
          block.blockHeading.includes('ከንቲ ጉዕሽ')
        ) {
          stagedRelationships.push({
            id: `rel_head_root_${autoParentId}`,
            fromPersonId: rootPersonId,
            toPersonId: autoParentId,
            type: 'parent_child',
            status: 'verified',
            sourceFile: 'ከሰተ-ብርሃነ.pdf',
            sourcePage: block.page,
            sourceWording: block.blockHeading,
            isBiologicalConfirmed: true,
            createdAt: STABLE_TIMESTAMP,
            updatedAt: STABLE_TIMESTAMP,
          });
        }
      }
    }

    // Process partner person if present in union
    let partnerPersonId: string | undefined;
    if (block.partnerName) {
      const existingPartnerCandidates = nameToPersonIds.get(block.partnerName);
      if (block.isContinuation && existingPartnerCandidates && existingPartnerCandidates.length > 0) {
        partnerPersonId = existingPartnerCandidates[existingPartnerCandidates.length - 1];
      } else {
        occurrenceSeq++;
        partnerPersonId = `pers_partner_p${block.page}_${occurrenceSeq}`;
        const partnerOccId = `occ_partner_p${block.page}_${occurrenceSeq}`;

        const partnerPerson: Person = {
          id: partnerPersonId,
          canonicalName: block.partnerName,
          status: 'unverified',
          notes: `Named in union statement: ${block.blockHeading} (PDF page ${block.page})`,
          sourcePage: block.page,
          sourceHeading: block.blockHeading,
          sourceOccurrenceId: partnerOccId,
          isArchived: false,
          createdAt: STABLE_TIMESTAMP,
          updatedAt: STABLE_TIMESTAMP,
        };
        stagedPeople.push(partnerPerson);

        occurrences.push({
          id: partnerOccId,
          sourceFile: 'ከሰተ-ብርሃነ.pdf',
          page: block.page,
          headingOrBlock: block.blockHeading,
          rawText: block.partnerName,
          sequence: occurrenceSeq,
          linkedPersonId: partnerPersonId,
          status: 'linked',
          notes: 'Partner recorded in union phrase',
        });

        const existingList = nameToPersonIds.get(block.partnerName) || [];
        nameToPersonIds.set(block.partnerName, [...existingList, partnerPersonId]);

        // Create partner_or_union relationship ONCE per union block (outside child loop)
        if (parentPersonIdToUse) {
          stagedRelationships.push({
            id: `rel_union_${parentPersonIdToUse}_${partnerPersonId}`,
            fromPersonId: parentPersonIdToUse,
            toPersonId: partnerPersonId,
            type: 'partner_or_union',
            status: block.needsReview ? 'needs_review' : 'unverified',
            sourceFile: 'ከሰተ-ብርሃነ.pdf',
            sourcePage: block.page,
            sourceWording: block.blockHeading,
            reviewerNotes: `Union phrase: ${block.blockHeading}`,
            isBiologicalConfirmed: false,
            createdAt: STABLE_TIMESTAMP,
            updatedAt: STABLE_TIMESTAMP,
          });
        }
      }
    }

    // Process children / names in this block
    for (const name of block.names) {
      occurrenceSeq++;
      const personId = `pers_p${block.page}_${occurrenceSeq}`;
      const occId = `occ_p${block.page}_${occurrenceSeq}`;

      const freq = nameOccurrencesMap.get(name) || { count: 0, pages: [] };
      freq.count++;
      if (!freq.pages.includes(block.page)) {
        freq.pages.push(block.page);
      }
      nameOccurrencesMap.set(name, freq);

      const personStatus: RecordStatus = block.needsReview ? 'needs_review' : 'unverified';

      const person: Person = {
        id: personId,
        canonicalName: name,
        branch: block.parentName || (block.relationshipType === 'opening' ? name : undefined),
        status: personStatus,
        notes: `Recorded on PDF page ${block.page} under: ${block.blockHeading}`,
        sourcePage: block.page,
        sourceHeading: block.blockHeading,
        sourceOccurrenceId: occId,
        isArchived: false,
        createdAt: STABLE_TIMESTAMP,
        updatedAt: STABLE_TIMESTAMP,
      };
      stagedPeople.push(person);

      occurrences.push({
        id: occId,
        sourceFile: 'ከሰተ-ብርሃነ.pdf',
        page: block.page,
        headingOrBlock: block.blockHeading,
        rawText: name,
        sequence: occurrenceSeq,
        linkedPersonId: personId,
        status: block.needsReview ? 'needs_review' : 'linked',
        notes: block.notes,
      });

      const existingList = nameToPersonIds.get(name) || [];
      nameToPersonIds.set(name, [...existingList, personId]);

      if (block.relationshipType === 'opening') {
        stagedRelationships.push({
          id: `rel_opening_${personId}`,
          fromPersonId: rootPersonId,
          toPersonId: personId,
          type: 'other_source_statement',
          status: 'needs_review',
          sourceFile: 'ከሰተ-ብርሃነ.pdf',
          sourcePage: 1,
          sourceWording: 'Opening names under title ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ — relationship not separately stated',
          reviewerNotes: 'Listed under main title; biological relationship to Kinteba Guush requires family confirmation.',
          isBiologicalConfirmed: false,
          createdAt: STABLE_TIMESTAMP,
          updatedAt: STABLE_TIMESTAMP,
        });
      } else if (parentPersonIdToUse) {
        if (block.partnerName || block.relationshipType === 'partner_or_union') {
          stagedRelationships.push({
            id: `rel_child_${parentPersonIdToUse}_${personId}`,
            fromPersonId: parentPersonIdToUse,
            toPersonId: personId,
            type: 'parent_child',
            status: block.needsReview ? 'needs_review' : 'unverified',
            sourceFile: 'ከሰተ-ብርሃነ.pdf',
            sourcePage: block.page,
            sourceWording: block.blockHeading,
            reviewerNotes: `Child of union under: ${block.blockHeading}`,
            isBiologicalConfirmed: false,
            createdAt: STABLE_TIMESTAMP,
            updatedAt: STABLE_TIMESTAMP,
          });
        } else {
          stagedRelationships.push({
            id: `rel_pc_${parentPersonIdToUse}_${personId}`,
            fromPersonId: parentPersonIdToUse,
            toPersonId: personId,
            type: 'parent_child',
            status: block.needsReview ? 'needs_review' : 'unverified',
            sourceFile: 'ከሰተ-ብርሃነ.pdf',
            sourcePage: block.page,
            sourceWording: block.blockHeading,
            reviewerNotes: `Recorded as child under: ${block.blockHeading}`,
            isBiologicalConfirmed: true,
            createdAt: STABLE_TIMESTAMP,
            updatedAt: STABLE_TIMESTAMP,
          });
        }
      }
    }
  }

  // Calculate duplicate name occurrences
  const duplicateNameOccurrences: { name: string; count: number; pages: number[] }[] = [];
  let distinctNamesCount = 0;

  for (const [name, freq] of nameOccurrencesMap.entries()) {
    distinctNamesCount++;
    if (freq.count > 1) {
      duplicateNameOccurrences.push({
        name,
        count: freq.count,
        pages: freq.pages,
      });
    }
  }

  // Sort duplicates descending by count
  duplicateNameOccurrences.sort((a, b) => b.count - a.count);

  // Group page breakdown
  const pageMap = new Map<number, { count: number; blocksCount: number }>();
  for (const block of blocks) {
    const cur = pageMap.get(block.page) || { count: 0, blocksCount: 0 };
    cur.count += block.names.length;
    cur.blocksCount += 1;
    pageMap.set(block.page, cur);
  }

  const pageBreakdown: { page: number; count: number; blocksCount: number }[] = [];
  for (const [page, data] of pageMap.entries()) {
    pageBreakdown.push({ page, ...data });
  }
  pageBreakdown.sort((a, b) => a.page - b.page);

  const relationshipsByType = {
    parentChild: stagedRelationships.filter((r) => r.type === 'parent_child').length,
    partnerOrUnion: stagedRelationships.filter((r) => r.type === 'partner_or_union').length,
    otherSourceStatement: stagedRelationships.filter((r) => r.type === 'other_source_statement').length,
  };

  const stats: ImportPreviewStats = {
    totalPages: pageBreakdown.length,
    totalBlocks: blocks.length,
    totalNameOccurrences: occurrences.length,
    nameOccurrencesCount: occurrences.length,
    distinctPersonRecordsCount: stagedPeople.length,
    distinctNamesCount,
    duplicateNameOccurrences,
    unlabelledOrUncertainBlocks: uncertainRecords.length,
    proposedRelationshipsCount: stagedRelationships.length,
    relationshipsByType,
    confirmedContinuationsCount,
    unresolvedOrIncompleteCount: uncertainRecords.length,
    pagesTranscribedCount: 29,
    pagesInspectedCount: 36,
    pageBreakdown,
  };

  return {
    stats,
    blocks,
    occurrences,
    stagedPeople,
    stagedRelationships,
    uncertainRecords,
  };
}
