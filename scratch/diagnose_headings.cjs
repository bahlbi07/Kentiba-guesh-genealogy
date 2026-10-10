const fs = require('fs');

const md = fs.readFileSync('source/family_genealogy_register.md', 'utf-8');
const lines = md.split('\n');
const headings = lines
  .filter(l => l.includes('ዝወለ'))
  .map(l => {
    const m = l.match(/`([^`]+)`/);
    return m ? m[1].trim() : l.trim();
  });

function parseRelationshipPhraseOld(clean) {
  const unionMatch = clean.match(/^([^\s]+)\s+ናብ\s+(.+?)\s+ኣትያ\s+ዝወለ/);
  if (unionMatch) {
    return { type: 'partner_or_union', parentName: unionMatch[1].trim(), partnerName: unionMatch[2].trim() };
  }
  const parentMatch = clean.match(/^([^\s]+)(?:\s+(?:ከንቲባ|ከንቲ)?\s*ጉ[ዕዑ]ሽ)?\s+ዝወለ/);
  if (parentMatch) {
    return { type: 'parent_child', parentName: parentMatch[1].trim() };
  }
  return null;
}

let failed = [];
headings.forEach(h => {
  const res = parseRelationshipPhraseOld(h);
  if (!res) failed.push(h);
});

console.log('Total headings tested:', headings.length);
console.log('FAILED headings count:', failed.length);
console.log('Sample failed headings:');
failed.forEach(f => console.log(' - ' + f));

