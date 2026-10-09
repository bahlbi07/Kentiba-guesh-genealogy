import {
  Person,
  Relationship,
  SourceOccurrence,
  AuditEvent,
  Source,
  BackupData
} from '../types/genealogy';
import { bulkLoadData } from './db';

export function createJSONBackup(
  people: Person[],
  relationships: Relationship[],
  sources: Source[],
  sourceOccurrences: SourceOccurrence[],
  auditEvents: AuditEvent[],
  datasetType: 'real' | 'demo'
): BackupData {
  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    sourceMetadata: {
      app: 'Kinteba Guush Family Genealogy',
      datasetType,
      description: 'Full database snapshot including people, relationships, source evidence, and audit logs.',
    },
    people,
    relationships,
    sources,
    sourceOccurrences,
    auditEvents,
  };
}

export function exportPeopleToCSV(people: Person[]): string {
  const headers = ['id', 'canonicalName', 'displayName', 'branch', 'status', 'sourcePage', 'sourceHeading', 'isArchived'];
  const rows = people.map((p) => [
    p.id,
    `"${(p.canonicalName || '').replace(/"/g, '""')}"`,
    `"${(p.displayName || '').replace(/"/g, '""')}"`,
    `"${(p.branch || '').replace(/"/g, '""')}"`,
    p.status,
    p.sourcePage ?? '',
    `"${(p.sourceHeading || '').replace(/"/g, '""')}"`,
    p.isArchived ? 'true' : 'false',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

export function exportRelationshipsToCSV(
  relationships: Relationship[],
  peopleMap: Map<string, Person>
): string {
  const headers = [
    'id',
    'fromPersonId',
    'fromPersonName',
    'toPersonId',
    'toPersonName',
    'type',
    'status',
    'sourceFile',
    'sourcePage',
    'sourceWording',
    'isBiologicalConfirmed',
    'reviewerNotes',
  ];

  const rows = relationships.map((r) => {
    const fromName = peopleMap.get(r.fromPersonId)?.canonicalName || '';
    const toName = peopleMap.get(r.toPersonId)?.canonicalName || '';
    return [
      r.id,
      r.fromPersonId,
      `"${fromName.replace(/"/g, '""')}"`,
      r.toPersonId,
      `"${toName.replace(/"/g, '""')}"`,
      r.type,
      r.status,
      `"${(r.sourceFile || '').replace(/"/g, '""')}"`,
      r.sourcePage ?? '',
      `"${(r.sourceWording || '').replace(/"/g, '""')}"`,
      r.isBiologicalConfirmed ? 'true' : 'false',
      `"${(r.reviewerNotes || '').replace(/"/g, '""')}"`,
    ];
  });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

export function exportToMarkdownReport(
  people: Person[],
  relationships: Relationship[],
  datasetMode: string
): string {
  const verifiedPeople = people.filter((p) => p.status === 'verified').length;
  const needsReviewPeople = people.filter((p) => p.status === 'needs_review').length;
  const unverifiedPeople = people.filter((p) => p.status === 'unverified').length;

  const verifiedRels = relationships.filter((r) => r.status === 'verified').length;
  const needsReviewRels = relationships.filter((r) => r.status === 'needs_review').length;

  const lines = [
    `# Kinteba Guush Family Genealogy — Export Report`,
    ``,
    `- **Report Generated:** ${new Date().toISOString()}`,
    `- **Dataset Mode:** ${datasetMode}`,
    `- **Total People Records:** ${people.length}`,
    `  - Verified: ${verifiedPeople}`,
    `  - Needs Review: ${needsReviewPeople}`,
    `  - Unverified: ${unverifiedPeople}`,
    `- **Total Relationships:** ${relationships.length}`,
    `  - Verified: ${verifiedRels}`,
    `  - Needs Review: ${needsReviewRels}`,
    ``,
    `## Summary of Branch Lineages`,
    ``,
  ];

  // Group by branch
  const branchMap = new Map<string, number>();
  for (const p of people) {
    const b = p.branch || 'Unassigned / Root';
    branchMap.set(b, (branchMap.get(b) || 0) + 1);
  }

  for (const [branch, count] of branchMap.entries()) {
    lines.push(`- **Branch ${branch}**: ${count} members`);
  }

  lines.push('');
  lines.push('## Records Requiring Review (needs_review)');
  lines.push('');

  const uncertain = people.filter((p) => p.status === 'needs_review');
  if (uncertain.length === 0) {
    lines.push('*No unconfirmed people records found.*');
  } else {
    lines.push('| ID | Name | Source Page | Source Heading / Context | Notes |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const p of uncertain.slice(0, 50)) {
      lines.push(
        `| \`${p.id}\` | ${p.canonicalName} | ${p.sourcePage ?? 'N/A'} | ${p.sourceHeading ?? 'N/A'} | ${p.notes ?? ''} |`
      );
    }
    if (uncertain.length > 50) {
      lines.push(`| ... and ${uncertain.length - 50} more records requiring review. |`);
    }
  }

  return lines.join('\n');
}

export async function restoreFromJSON(
  jsonString: string,
  reviewer = 'User'
): Promise<{ success: boolean; message: string; peopleCount?: number }> {
  try {
    const data: BackupData = JSON.parse(jsonString);

    if (!data.people || !Array.isArray(data.people)) {
      return { success: false, message: 'Invalid backup file: "people" array is missing.' };
    }
    if (!data.relationships || !Array.isArray(data.relationships)) {
      return { success: false, message: 'Invalid backup file: "relationships" array is missing.' };
    }

    await bulkLoadData(
      {
        people: data.people,
        relationships: data.relationships,
        occurrences: data.sourceOccurrences || [],
        sources: data.sources || [],
        mode: data.sourceMetadata?.datasetType === 'demo' ? 'demo' : 'real',
      },
      reviewer
    );

    return {
      success: true,
      message: `Successfully restored ${data.people.length} people and ${data.relationships.length} relationships.`,
      peopleCount: data.people.length,
    };
  } catch (err: any) {
    return { success: false, message: `Failed to parse or restore backup: ${err.message}` };
  }
}

export function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
