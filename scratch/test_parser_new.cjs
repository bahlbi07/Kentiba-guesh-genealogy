const fs = require('fs');

const md = fs.readFileSync('source/family_genealogy_register.md', 'utf-8');
const lines = md.split('\n');
const headings = lines
  .filter(l => l.includes('ዝወለ'))
  .map(l => {
    const m = l.match(/`([^`]+)`/);
    return m ? m[1].trim() : l.trim();
  });

function parseRelationshipPhraseNew(clean) {
  // Strip code ticks and punctuation
  clean = clean.trim().replace(/^`|`$/g, '').trim();

  // Pattern A: Union / Marriage statement (contains ኣትያ, ኣትዩ, or ተኣትያ)
  // e.g. "ተክኣ ናብ ቀሺ ተክለ ሃይማኖት ዓዲምባረክ ኣትያ ዝወለደቶም ድማ"
  // e.g. "ይሕደጋ ከንቲባ ጉዕሽ ንምራራ ኣትያ ዝወለደቶም ድማ"
  // e.g. "ብስራት ከንቲ ጉዕሽ ኮዳዲ ኣትያ ዝወለደቶም ድማ"
  // e.g. "ስላስ ንምግዳረበይና ኣትያ ዝወለደቶም ድማ"
  const unionRegex = /^(.*?)(?:\s+(?:ተ?ኣትያ|ኣትዩ)\s+ዝወለ)/;
  const unionMatch = clean.match(unionRegex);

  if (unionMatch) {
    const beforeAtia = unionMatch[1].trim(); // e.g. "ትዕበ ከንቲባ ጉዑሽ ናብ ኣቦይ ወለሓንስ ዓሊተና" or "ብስራት ከንቲ ጉዕሽ ኮዳዲ" or "ስላስ ንምግዳረበይና"
    let personPart = beforeAtia;
    let partnerPart = '';

    // Check if there is "ናብ" or "ን" separator before partner
    // Notice "ናብ" or "ን..."
    const nabMatch = beforeAtia.match(/^(.*?)\s+(?:ናብ|ን)\s+(.*)$/);
    const nabAttachedMatch = beforeAtia.match(/^(.*?)(?:ናብ|ን)([^\s].*)$/);
    
    if (nabMatch) {
      personPart = nabMatch[1].trim();
      partnerPart = nabMatch[2].trim();
    } else if (nabAttachedMatch) {
      personPart = nabAttachedMatch[1].trim();
      partnerPart = nabAttachedMatch[2].trim();
    } else {
      // If no explicit "ናብ", check if there's a place/person after patronymic
      // e.g. "ብስራት ከንቲ ጉዕሽ ኮዳዲ" -> personPart: "ብስራት ከንቲ ጉዕሽ", partnerPart: "ኮዳዲ"
      // or "ስላስ ንምግዳረበይና" -> partnerPart: "ምግዳረበይና"
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

    // Extract canonical parent name and patronymic if present
    // e.g. "ትዕበ ከንቲባ ጉዑሽ" -> parentName: "ትዕበ", fatherName: "ከንቲባ ጉዑሽ"
    let parentName = personPart;
    let fatherName = undefined;
    const patronymicMatch = personPart.match(/^([^\s]+)(?:\s+((?:ከንቲባ|ከንቲ)?\s*ጉ[ዕዑ]ሽ.*))?$/);
    if (patronymicMatch) {
      parentName = patronymicMatch[1].trim();
      if (patronymicMatch[2]) fatherName = patronymicMatch[2].trim();
    }

    // Clean partnerPart if it has leading ን or ናብ
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
    const parentPart = pcMatch[1].trim(); // e.g. "ቀሺ ወለሊባኖስ", "ጎብሩ ከንቲባ ጉዕሽ", "ሓጎስ ሃብቱ", "ተክለ ሃይማኖት"
    
    // Check if there is a patronymic or title
    // If it has "ከንቲባ ጉዕሽ"
    let parentName = parentPart;
    let fatherName = undefined;

    const kintebaMatch = parentPart.match(/^(.*?)\s+((?:ከንቲባ|ከንቲ)\s*ጉ[ዕዑ]ሽ)$/);
    if (kintebaMatch) {
      parentName = kintebaMatch[1].trim();
      fatherName = kintebaMatch[2].trim();
    } else {
      // Check for patronymic like "ሓጎስ ሃብቱ" (where ሃብቱ is the father)
      // If two words and first word is not a known title (ቀሺ, ሃለቃ, ባሻይ, etc.)
      const titles = ['ቀሺ', 'ሃለቃ', 'ባሻይ', 'ግራጅማሽ', 'ቀንጀታ', 'ተለንተ', 'ሸቃ', 'በረምበራስ', 'ኣቦይ'];
      const words = parentPart.split(/\s+/);
      if (words.length === 2 && !titles.includes(words[0])) {
        // e.g. "ሓጎስ ሃብቱ", "ገብረ ሃብቱ", "ለተብርሃን ሃብቱ", "ትብለጽ ሃብቱ"
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

let countParsed = 0;
let countPC = 0;
let countUnion = 0;
let failed = [];

headings.forEach(h => {
  const res = parseRelationshipPhraseNew(h);
  if (res.type === 'parent_child') {
    countPC++;
    countParsed++;
  } else if (res.type === 'partner_or_union') {
    countUnion++;
    countParsed++;
  } else {
    failed.push(h);
  }
});

console.log('Total headings:', headings.length);
console.log('Successfully parsed as PC or Union:', countParsed);
console.log('  - Parent-Child count:', countPC);
console.log('  - Partner/Union count:', countUnion);
console.log('Failed headings count:', failed.length);
if (failed.length > 0) {
  console.log('Failed:');
  failed.forEach(f => console.log(' * ' + f));
}

