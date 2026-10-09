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
 * - "ጎብሩ ከንቲባ ጉዕሽ ዝወለዶም" -> parent: "ጎብሩ", wording
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

  // Parent pattern: matches "X ዝወለዶም", "X ዝወለደቶም", "X ከንቲባ ጉዕሽ ዝወለዶም", etc.
  const parentMatch = clean.match(/^([^\s]+)(?:\s+(?:ከንቲባ\s+)?ጉ[ዕዑ]ሽ)?\s+ዝወለ/);
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
    let needsReview = false;
    let notes: string | undefined;

    const lowerHeading = currentHeading.toLowerCase();

    if (currentHeading.includes('Opening names under the title')) {
      relType = 'opening';
      notes = 'Opening branch names recorded under Kinteba Guush title; relationships not individually specified.';
    } else if (currentHeading.includes('Unlabelled name') || currentHeading.includes('unlabelled')) {
      relType = 'unlabelled';
      needsReview = true;
      notes = 'Unlabelled in source text. Relationship unassigned pending visual confirmation with PDF.';
    } else if (currentHeading.includes('Continuation')) {
      relType = 'continuation';
      needsReview = true;
      notes = 'Continuation block across page boundary. Verify grouping against source layout.';
    } else if (currentHeading.includes('Source relationship:')) {
      const phraseMatch = currentHeading.match(/Source relationship:\s*`([^`]+)`/) ||
                           currentHeading.match(/Source relationship:\s*(.+)/);
      const rawPhrase = phraseMatch ? phraseMatch[1].trim() : currentHeading;
      const parsedPhrase = parseRelationshipPhrase(rawPhrase);
      relType = parsedPhrase.type;
      parentName = parsedPhrase.parentName;
      partnerName = parsedPhrase.partnerName;

      if (parsedPhrase.isUnion) {
        notes = `Union/marriage statement: ${rawPhrase}`;
      }
    } else if (currentHeading.includes('Incomplete statement') || currentHeading.includes('PDF page 36')) {
      relType = 'other_source_statement';
      needsReview = true;
      notes = 'Incomplete statement on PDF page 36 without child names.';
    }

    blocks.push({
      page: currentPage,
      blockHeading: currentHeading,
      relationshipWording: currentHeading,
      relationshipType: relType,
      parentName,
      partnerName,
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
      // Skip explanatory bullet notes like "- No names are listed..."
      if (
        itemText.startsWith('No names are listed') ||
        itemText.startsWith('Associated names continue') ||
        itemText.includes('PDF page')
      ) {
        currentRawLines.push(line);
      } else if (itemText.length > 0) {
        currentNames.push(itemText);
        currentRawLines.push(line);
      }
      continue;
    }

    if (line.trim().length > 0) {
      currentRawLines.push(line);
    }
  }

  // Finalize any trailing block
  finalizeCurrentBlock();

  // Create Root / Patriarch
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const stagedRelationships: Relationship[] = [];
  const occurrences: SourceOccurrence[] = [];
  const uncertainRecords: { page: number; wording: string; names: string[]; reason: string }[] = [];

  // Track name frequencies to detect duplicates across different occurrences
  const nameOccurrencesMap = new Map<string, { count: number; pages: number[] }>();

  // Map from canonicalName to list of candidate person IDs created so far (to resolve parents accurately)
  const nameToPersonIds = new Map<string, string[]>();
  nameToPersonIds.set('ከንቲባ ጉዑሽ', [rootPersonId]);
  nameToPersonIds.set('ከንቲባ ጉዑሽ ሓጎስ', [rootPersonId]);

  let occurrenceSeq = 0;

  for (const block of blocks) {
    if (block.needsReview || block.relationshipType === 'unlabelled' || block.relationshipType === 'continuation') {
      uncertainRecords.push({
        page: block.page,
        wording: block.blockHeading,
        names: block.names,
        reason: block.notes || 'Unlabelled or continuation across page boundary',
      });
    }

    // Create partner person if present (e.g. spouse in union)
    let partnerPersonId: string | undefined;
    if (block.partnerName) {
      occurrenceSeq++;
      partnerPersonId = `pers_partner_p${block.page}_${occurrenceSeq}`;
      const partnerOccId = `occ_partner_p${block.page}_${occurrenceSeq}`;

      const partnerPerson: Person = {
        id: partnerPersonId,
        canonicalName: block.partnerName,
        status: 'needs_review', // partner from union statement
        notes: `Named in union statement: ${block.blockHeading} (PDF page ${block.page})`,
        sourcePage: block.page,
        sourceHeading: block.blockHeading,
        sourceOccurrenceId: partnerOccId,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
        status: 'needs_review',
        notes: 'Partner recorded in union phrase',
      });

      const existingPartnerList = nameToPersonIds.get(block.partnerName) || [];
      nameToPersonIds.set(block.partnerName, [...existingPartnerList, partnerPersonId]);
    }

    // Now process children / names in this block
    for (const name of block.names) {
      occurrenceSeq++;
      const personId = `pers_p${block.page}_${occurrenceSeq}`;
      const occId = `occ_p${block.page}_${occurrenceSeq}`;

      // Update duplicate tracking
      const freq = nameOccurrencesMap.get(name) || { count: 0, pages: [] };
      freq.count++;
      if (!freq.pages.includes(block.page)) {
        freq.pages.push(block.page);
      }
      nameOccurrencesMap.set(name, freq);

      // Determine person status: if block needs review, mark person needs_review
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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

      // Register person ID for parent lookups
      const existingList = nameToPersonIds.get(name) || [];
      nameToPersonIds.set(name, [...existingList, personId]);

      // Now create relationships if parent is known
      if (block.relationshipType === 'opening') {
        // Opening names under the title Kinteba Guush
        // Do NOT assume direct biological paternity without evidence, mark as other_source_statement or needs_review!
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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else if (block.parentName) {
        // Find parent candidate. We take the most recent matching person before this block.
        const parentCandidates = nameToPersonIds.get(block.parentName);
        let parentPersonIdToUse: string | undefined;

        if (parentCandidates && parentCandidates.length > 0) {
          // Use the latest one created before this child
          parentPersonIdToUse = parentCandidates[parentCandidates.length - 1];
        } else {
          // If parent was named in the heading but not yet indexed, create and register them
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
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
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
          if (block.blockHeading.includes('ከንቲባ ጉዕሽ') || block.blockHeading.includes('ከንቲባ ጉዑሽ')) {
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
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }

        if (parentPersonIdToUse) {
          // If union, also link partner
          if (block.partnerName && partnerPersonId) {
            // Union relationship between parent and partner
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
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            // Relationship to child
            stagedRelationships.push({
              id: `rel_child_${parentPersonIdToUse}_${personId}`,
              fromPersonId: parentPersonIdToUse,
              toPersonId: personId,
              type: 'parent_child',
              status: block.needsReview ? 'needs_review' : 'unverified',
              sourceFile: 'ከሰተ-ብርሃነ.pdf',
              sourcePage: block.page,
              sourceWording: block.blockHeading,
              reviewerNotes: `Child of union between ${block.parentName} and ${block.partnerName}`,
              isBiologicalConfirmed: false, // Union phrasing preserved
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } else {
            // Standard parent-child
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
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        } else {
          // Parent name appeared in heading but wasn't previously indexed as a person
          // Flag as needs_review
          uncertainRecords.push({
            page: block.page,
            wording: block.blockHeading,
            names: [name],
            reason: `Parent "${block.parentName}" was not found in preceding indexed people records.`,
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

  const stats: ImportPreviewStats = {
    totalPages: pageBreakdown.length,
    totalBlocks: blocks.length,
    totalNameOccurrences: stagedPeople.length - 1, // Exclude synthetic root
    distinctNamesCount,
    duplicateNameOccurrences,
    unlabelledOrUncertainBlocks: uncertainRecords.length,
    proposedRelationshipsCount: stagedRelationships.length,
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
