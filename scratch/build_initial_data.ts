import * as fs from 'fs';
import * as path from 'path';
import { parseRegisterMarkdown } from '../src/services/importParser';

const mdContent = fs.readFileSync('source/family_genealogy_register.md', 'utf-8');
const result = parseRegisterMarkdown(mdContent);

console.log('Staged people count:', result.stagedPeople.length);
console.log('Staged relationships count:', result.stagedRelationships.length);
console.log('Occurrences count:', result.occurrences.length);

// Verify root children
const root = result.stagedPeople.find(p => p.id === 'pers_root_kinteba_guush');
const rootChildrenRels = result.stagedRelationships.filter(r => r.fromPersonId === root?.id && r.type === 'parent_child');
console.log('Direct children linked to Kinteba Guush:', rootChildrenRels.length);

const rootChildrenNames = rootChildrenRels.map(r => {
  const c = result.stagedPeople.find(p => p.id === r.toPersonId);
  return c?.canonicalName;
});
console.log('Names of direct children:', rootChildrenNames);

// Generate src/data/initialGenealogyData.ts
const fileHeader = `// Authoritative Initial Genealogy Dataset pre-compiled from source/family_genealogy_register.md
// Automatically generated - source of truth for first load and offline PWA browsing
import { Person, Relationship, SourceOccurrence } from '../types/genealogy';

export const INITIAL_PEOPLE: Person[] = ${JSON.stringify(result.stagedPeople, null, 2)};

export const INITIAL_RELATIONSHIPS: Relationship[] = ${JSON.stringify(result.stagedRelationships, null, 2)};

export const INITIAL_OCCURRENCES: SourceOccurrence[] = ${JSON.stringify(result.occurrences, null, 2)};
`;

fs.writeFileSync('src/data/initialGenealogyData.ts', fileHeader, 'utf-8');
console.log('Successfully written src/data/initialGenealogyData.ts!');

