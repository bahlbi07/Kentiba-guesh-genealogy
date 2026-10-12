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
  fatherName?: string;
  partnerName?: string;
  spouseNote?: string;
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

export interface ParsedPhrase {
  type: RelationshipType;
  parentName?: string;
  fatherName?: string;
  partnerName?: string;
  isUnion: boolean;
  spouseNote?: string;
}

/**
 * Extracts parent, father patronymic, and partner from a Tigrinya relationship phrase.
 * Supports:
 * - "ጎብሩ ከንቲባ ጉዕሽ ዝወለዶም" -> parent: "ጎብሩ", father: "ከንቲባ ጉዕሽ"
 * - "ቀሺ ወለሊባኖስ ዝወለዶም" -> parent: "ቀሺ ወለሊባኖስ"
 * - "ሓጎስ ሃብቱ ዝወለዶም" -> parent: "ሓጎስ", father: "ሃብቱ"
 * - "ተክኣ ናብ ቀሺ ተክለ ሃይማኖት ዓዲምባረክ ኣትያ ዝወለደቶም ድማ" -> parent: "ተክኣ", partner: "ቀሺ ተክለ ሃይማኖት ዓዲምባረክ"
 * - "ይሕደጋ ከንቲባ ጉዕሽ ንምራራ ኣትያ ዝወለደቶም ድማ" -> parent: "ይሕደጋ", father: "ከንቲባ ጉዕሽ", partner: "ምራራ"
 * - "ብስራት ከንቲ ጉዕሽ ኮዳዲ ኣትያ ዝወለደቶም ድማ" -> parent: "ብስራት", father: "ከንቲ ጉዕሽ", partner: "ኮዳዲ"
 * - "ትዕበ ከንቲባ ጉዑሽ ናብ ኣቦይ ወለሓንስ ዓሊተና ኣትያ ዝወለደቶም ድማ" -> parent: "ትዕበ", father: "ከንቲባ ጉዑሽ", partner: "ኣቦይ ወለሓንስ ዓሊተና"
 */
export function parseRelationshipPhrase(phrase: string): ParsedPhrase {
  const clean = phrase.trim().replace(/^`|`$/g, '').trim();

  // Pattern A: Union / Marriage statement (contains ኣትያ, ኣትዩ, or ተኣትያ)
  const unionRegex = /^(.*?)(?:\s+(?:ተ?ኣትያ|ኣትዩ)\s+ዝወለ)/;
  const unionMatch = clean.match(unionRegex);

  if (unionMatch) {
    const beforeAtia = unionMatch[1].trim();
    let personPart = beforeAtia;
    let partnerPart = '';

    // Match "ናብ <partner>" or prefixed "ን<partner>" preceded by whitespace
    const separatorMatch = beforeAtia.match(/^(.*?)\s+(?:ናብ\s+(.*)|ን([^\s].*))$/);

    if (separatorMatch) {
      personPart = separatorMatch[1].trim();
      partnerPart = (separatorMatch[2] || separatorMatch[3] || '').trim();
    } else {
      // Check if there is patronymic followed by partner (e.g., "ብስራት ከንቲ ጉዕሽ ኮዳዲ")
      const kintebaSplit = beforeAtia.match(/^(.*?(?:ከንቲባ|ከንቲ)?\s*ጉ[ዕዑ]ሽ)\s+(.*)$/);
      if (kintebaSplit) {
        personPart = kintebaSplit[1].trim();
        partnerPart = kintebaSplit[2].trim();
      } else {
        const words = beforeAtia.split(/\s+/);
        if (words.length >= 2) {
          personPart = words[0];
          partnerPart = words.slice(1).join(' ');
        }
      }
    }

    let parentName = personPart;
    let fatherName: string | undefined;
    const patronymicMatch = personPart.match(/^([^\s]+)(?:\s+((?:ከንቲባ|ከንቲ)?\s*ጉ[ዕዑ]ሽ.*))?$/);
    if (patronymicMatch) {
      parentName = patronymicMatch[1].trim();
      if (patronymicMatch[2]) fatherName = patronymicMatch[2].trim();
    }

    partnerPart = partnerPart.replace(/^(?:ናብ|ን)\s*/, '').trim();

    return {
      type: 'partner_or_union',
      parentName,
      fatherName,
      partnerName: partnerPart || undefined,
      isUnion: true,
      spouseNote: clean,
    };
  }

  // Pattern B: Parent-child statement (ends with ዝወለዶም, ዝወለደቶም, ዝወለዶ)
  const pcMatch = clean.match(/^(.*?)\s+ዝወለ/);
  if (pcMatch) {
    const parentPart = pcMatch[1].trim();
    let parentName = parentPart;
    let fatherName: string | undefined;

    const kintebaMatch = parentPart.match(/^(.*?)\s+((?:ከንቲባ|ከንቲ)\s*ጉ[ዕዑ]ሽ)$/);
    if (kintebaMatch) {
      parentName = kintebaMatch[1].trim();
      fatherName = kintebaMatch[2].trim();
    } else {
      const titles = ['ቀሺ', 'ሃለቃ', 'ባሻይ', 'ግራጅማሽ', 'ቀንጀታ', 'ተለንተ', 'ሸቃ', 'በረምበራስ', 'ኣቦይ'];
      const words = parentPart.split(/\s+/);
      if (words.length === 2 && !titles.includes(words[0])) {
        parentName = words[0];
        fatherName = words[1];
      }
    }

    return {
      type: 'parent_child',
      parentName,
      fatherName,
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
    let fatherName: string | undefined;
    let partnerName: string | undefined;
    let spouseNote: string | undefined;
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
      fatherName = parsedPhrase.fatherName;
      partnerName = parsedPhrase.partnerName;
      spouseNote = parsedPhrase.spouseNote;
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
      fatherName = parsedPhrase.fatherName;
      partnerName = parsedPhrase.partnerName;
      spouseNote = parsedPhrase.spouseNote;
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
        fatherName = parsedPhrase.fatherName;
        partnerName = parsedPhrase.partnerName;
        spouseNote = parsedPhrase.spouseNote;
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
      fatherName = parsedPhrase.fatherName;
      partnerName = parsedPhrase.partnerName;
      spouseNote = parsedPhrase.spouseNote;

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
      fatherName,
      partnerName,
      spouseNote,
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

  let hasReachedGenealogySection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect Page headers: "## PDF page 1"
    const pageMatch = line.match(/^##\s+PDF\s+page\s+(\d+)/i);
    if (pageMatch) {
      finalizeCurrentBlock();
      hasReachedGenealogySection = true;
      currentPage = parseInt(pageMatch[1], 10);
      continue;
    }

    if (!hasReachedGenealogySection) {
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
      canonicalName: 'ከንቲባ ጉዕሽ ሓጎስ',
      displayName: 'Kinteba Guush Hagos (ከንቲባ ጉዕሽ ሓጎስ)',
      branch: 'Main Ancestor',
      status: 'verified',
      notes: 'Patriarch named in source title: ሓረግ ወለዶ ከንቲባ ጉዕሽ ሓጎስ (PDF page 1)',
      sourcePage: 1,
      sourceHeading: 'ሓረግ ወለዶ ከንቲባ ጉዕሽ ሓጎስ',
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
  nameToPersonIds.set('ከንቲባ ጉዕሽ', [rootPersonId]);
  nameToPersonIds.set('ከንቲባ ጉዕሽ ሓጎስ', [rootPersonId]);
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
      const isChildOfKinteba =
        block.fatherName?.includes('ጉ') ||
        block.blockHeading.includes('ከንቲባ ጉዕሽ') ||
        block.blockHeading.includes('ከንቲባ ጉዑሽ') ||
        block.blockHeading.includes('ከንቲ ጉዕሽ') ||
        block.blockHeading.includes('ከንቲ ጉዑ');

      if (candidates && candidates.length > 0) {
        if (isChildOfKinteba) {
          parentPersonIdToUse = candidates[0];
        } else {
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
          fatherName: isChildOfKinteba ? 'ከንቲባ ጉዕሽ ሓጎስ' : undefined,
          status: 'verified',
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
      }

      // If heading establishes this person as a child of Kinteba Guush Hagos, ensure link to root
      if (isChildOfKinteba && parentPersonIdToUse) {
        const alreadyLinked = stagedRelationships.some(
          (r) => r.fromPersonId === rootPersonId && r.toPersonId === parentPersonIdToUse && r.type === 'parent_child'
        );
        if (!alreadyLinked) {
          stagedRelationships.push({
            id: `rel_root_${parentPersonIdToUse}`,
            fromPersonId: rootPersonId,
            toPersonId: parentPersonIdToUse,
            type: 'parent_child',
            status: 'verified',
            sourceFile: 'ከሰተ-ብርሃነ.pdf',
            sourcePage: block.page,
            sourceWording: block.blockHeading,
            reviewerNotes: 'Verified direct child of Patriarch Kinteba Guush Hagos',
            isBiologicalConfirmed: true,
            createdAt: STABLE_TIMESTAMP,
            updatedAt: STABLE_TIMESTAMP,
          });
        }
        const parentObj = stagedPeople.find((p) => p.id === parentPersonIdToUse);
        if (parentObj && !parentObj.fatherName) {
          parentObj.fatherName = 'ከንቲባ ጉዕሽ ሓጎስ';
        }
      }

      // If union/marriage note is present, attach to parent record
      if (block.spouseNote && parentPersonIdToUse) {
        const parentObj = stagedPeople.find((p) => p.id === parentPersonIdToUse);
        if (parentObj) {
          parentObj.spouseNote = block.spouseNote;
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

      let childFatherName: string | undefined;
      let childMotherName: string | undefined;
      let childBranch: string | undefined;

      if (block.relationshipType === 'opening') {
        childFatherName = 'ከንቲባ ጉዕሽ ሓጎስ';
        childBranch = name;
      } else if (parentPersonIdToUse) {
        const parentObj = stagedPeople.find((p) => p.id === parentPersonIdToUse);
        if (block.partnerName || block.relationshipType === 'partner_or_union') {
          childMotherName = parentObj?.canonicalName;
          childFatherName = block.partnerName;
        } else {
          childFatherName = parentObj?.canonicalName;
        }
        childBranch = parentObj?.branch || parentObj?.canonicalName;
      }

      const person: Person = {
        id: personId,
        canonicalName: name,
        fatherName: childFatherName,
        motherName: childMotherName,
        branch: childBranch,
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
          type: 'parent_child',
          status: 'verified',
          sourceFile: 'ከሰተ-ብርሃነ.pdf',
          sourcePage: 1,
          sourceWording: 'ሓረግ ወለዶ ከንቲባ ጉዕሽ ሓጎስ',
          reviewerNotes: 'Direct branch ancestor under Patriarch Kinteba Guush Hagos',
          isBiologicalConfirmed: true,
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
