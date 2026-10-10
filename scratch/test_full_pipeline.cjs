const fs = require('fs');

const md = fs.readFileSync('source/family_genealogy_register.md', 'utf-8');

function parseRelationshipPhraseNew(clean) {
  clean = clean.trim().replace(/^`|`$/g, '').trim();

  // Pattern A: Union / Marriage statement (contains ኣትያ, ኣትዩ, or ተኣትያ)
  const unionRegex = /^(.*?)(?:\s+(?:ተ?ኣትያ|ኣትዩ)\s+ዝወለ)/;
  const unionMatch = clean.match(unionRegex);

  if (unionMatch) {
    const beforeAtia = unionMatch[1].trim();
    let personPart = beforeAtia;
    let partnerPart = '';

    // Match "ናብ <partner>" or prefixed "ን<partner>" with whitespace before it!
    const separatorMatch = beforeAtia.match(/^(.*?)\s+(?:ናብ\s+(.*)|ን([^\s].*))$/);
    
    if (separatorMatch) {
      personPart = separatorMatch[1].trim();
      partnerPart = (separatorMatch[2] || separatorMatch[3] || '').trim();
    } else {
      // Check if there is patronymic followed by partner, e.g. "ብስራት ከንቲ ጉዕሽ ኮዳዲ"
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
    let fatherName = undefined;
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
      rawPersonPart: personPart,
      isUnion: true,
      originalWording: clean
    };
  }

  // Pattern B: Parent-child statement (ends with ዝወለዶም, ዝወለደቶም, ዝወለዶ)
  const pcMatch = clean.match(/^(.*?)\s+ዝወለ/);
  if (pcMatch) {
    const parentPart = pcMatch[1].trim();
    let parentName = parentPart;
    let fatherName = undefined;

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
      fullParentTitle: parentPart,
      isUnion: false,
      originalWording: clean
    };
  }

  return {
    type: 'other_source_statement',
    originalWording: clean
  };
}

const lines = md.split(/\r?\n/);
let currentPage = 1;
const blocks = [];
let currentHeading = '';
let currentRawLines = [];
let currentNames = [];

function finalizeCurrentBlock() {
  if (!currentHeading && currentNames.length === 0 && currentRawLines.length === 0) return;

  let relType = 'other_source_statement';
  let parentName = undefined;
  let partnerName = undefined;
  let fatherName = undefined;
  let isContinuation = false;
  let needsReview = false;
  let notes = undefined;

  if (currentHeading.includes('Opening names under the title')) {
    relType = 'opening';
    needsReview = false;
    notes = '10 direct branches of Kinteba Guush Hagos';
  } else if (currentHeading.includes('Confirmed continuation from PDF page')) {
    isContinuation = true;
    const phraseMatch = currentHeading.match(/`([^`]+)`/);
    const rawPhrase = phraseMatch ? phraseMatch[1].trim() : currentHeading;
    const parsed = parseRelationshipPhraseNew(rawPhrase);
    relType = parsed.type;
    parentName = parsed.parentName;
    partnerName = parsed.partnerName;
    fatherName = parsed.fatherName;
    needsReview = false;
    notes = `Confirmed continuation: ${rawPhrase}`;
  } else {
    const phraseMatch = currentHeading.match(/`([^`]+)`/);
    if (phraseMatch) {
      const rawPhrase = phraseMatch[1].trim();
      const parsed = parseRelationshipPhraseNew(rawPhrase);
      relType = parsed.type;
      parentName = parsed.parentName;
      partnerName = parsed.partnerName;
      fatherName = parsed.fatherName;
    }
  }

  blocks.push({
    page: currentPage,
    blockHeading: currentHeading,
    relationshipType: relType,
    parentName,
    partnerName,
    fatherName,
    isContinuation,
    names: [...currentNames],
    needsReview,
    notes
  });

  currentHeading = '';
  currentRawLines = [];
  currentNames = [];
}

for (const line of lines) {
  const pageMatch = line.match(/^## PDF page (\d+)/i);
  if (pageMatch) {
    finalizeCurrentBlock();
    currentPage = parseInt(pageMatch[1], 10);
    continue;
  }

  const h3Match = line.match(/^### (.*)/);
  if (h3Match) {
    finalizeCurrentBlock();
    currentHeading = h3Match[1].trim();
    continue;
  }

  const listMatch = line.match(/^\s*-\s+(.*)/);
  if (listMatch) {
    const cleanName = listMatch[1].trim().replace(/^`|`$/g, '').replace(/—.*$/, '').trim();
    if (cleanName) {
      currentNames.push(cleanName);
    }
    continue;
  }
}
finalizeCurrentBlock();

const rootPersonId = 'pers_root_kinteba_guush';
const stagedPeople = [
  {
    id: rootPersonId,
    canonicalName: 'ከንቲባ ጉዑሽ ሓጎስ',
    branch: 'ከንቲባ ጉዑሽ',
    status: 'verified'
  }
];
const stagedRelationships = [];
const nameToPersonIds = new Map();
nameToPersonIds.set('ከንቲባ ጉዑሽ', [rootPersonId]);
nameToPersonIds.set('ከንቲባ ጉዑሽ ሓጎስ', [rootPersonId]);

let occurrenceSeq = 0;

for (const block of blocks) {
  let parentPersonIdToUse = undefined;

  if (block.parentName) {
    const candidates = nameToPersonIds.get(block.parentName);
    if (candidates && candidates.length > 0) {
      if (block.fatherName && block.fatherName.includes('ጉ')) {
        // Child of Kinteba Guush
        parentPersonIdToUse = candidates[0];
      } else {
        parentPersonIdToUse = candidates[candidates.length - 1];
      }
    } else {
      occurrenceSeq++;
      const autoParentId = `pers_parent_head_p${block.page}_${occurrenceSeq}`;
      stagedPeople.push({
        id: autoParentId,
        canonicalName: block.parentName,
        branch: block.parentName,
        status: 'verified'
      });
      nameToPersonIds.set(block.parentName, [autoParentId]);
      parentPersonIdToUse = autoParentId;

      if (block.fatherName && block.fatherName.includes('ጉ')) {
        stagedRelationships.push({
          id: `rel_root_${autoParentId}`,
          fromPersonId: rootPersonId,
          toPersonId: autoParentId,
          type: 'parent_child'
        });
      }
    }
  }

  for (const name of block.names) {
    occurrenceSeq++;
    const personId = `pers_p${block.page}_${occurrenceSeq}`;

    stagedPeople.push({
      id: personId,
      canonicalName: name,
      branch: block.parentName || (block.relationshipType === 'opening' ? name : undefined),
      status: 'verified'
    });

    const existing = nameToPersonIds.get(name) || [];
    nameToPersonIds.set(name, [...existing, personId]);

    if (block.relationshipType === 'opening') {
      stagedRelationships.push({
        id: `rel_opening_${personId}`,
        fromPersonId: rootPersonId,
        toPersonId: personId,
        type: 'parent_child',
        notes: 'Child of Kinteba Guush Hagos'
      });
    } else if (parentPersonIdToUse) {
      stagedRelationships.push({
        id: `rel_pc_${parentPersonIdToUse}_${personId}`,
        fromPersonId: parentPersonIdToUse,
        toPersonId: personId,
        type: 'parent_child'
      });
    }
  }
}

console.log('Staged people count:', stagedPeople.length);
console.log('Staged relationships count:', stagedRelationships.length);

const rootChildren = stagedRelationships.filter(r => r.fromPersonId === rootPersonId);
console.log('Root children count:', rootChildren.length);
rootChildren.forEach(rc => {
  const p = stagedPeople.find(x => x.id === rc.toPersonId);
  const grandChildren = stagedRelationships.filter(r => r.fromPersonId === p.id);
  console.log(` - ${p.canonicalName} (${grandChildren.length} children)`);
});

