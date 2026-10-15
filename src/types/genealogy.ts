export type RecordStatus = 'unverified' | 'verified' | 'needs_review' | 'rejected';

export type RelationshipType = 'parent_child' | 'partner_or_union' | 'other_source_statement';

export type UserRole = 'guest' | 'admin' | 'superadmin';

export interface Person {
  id: string; // Unique stable ID (e.g. "pers_abc123")
  canonicalName: string; // Exact name as written in the source (Tigrinya/Ge'ez characters preserved)
  displayName?: string; // Optional reviewed correction/variant
  gender?: 'male' | 'female' | 'unknown'; // Defaults to unknown unless verified
  branch?: string; // e.g., "ጎብሩ", "ሃብቱ", "ተስፉ", etc.
  fatherName?: string; // Recorded father's name from genealogy
  motherName?: string; // Recorded mother's name if documented
  spouseNote?: string; // Natural Tigrinya note of marriage/family entry (e.g., "ናብ ቀሺ ተክለ ሃይማኖት ዓዲምባረክ ኣትያ ዝወለደቶም")
  birthOrder?: number; // Chronological birth sequence: 1 = ቦኽሪ (firstborn), 2, 3... N = ሕሳስ (youngest)
  notes?: string;
  sourcePage?: number;
  sourceHeading?: string;
  sourceOccurrenceId?: string;
  status: RecordStatus;
  isArchived: boolean;
  deletionPending?: boolean;
  deletionRequestedBy?: string;
  deletionRequestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Relationship {
  id: string; // Unique stable ID (e.g. "rel_xyz789")
  fromPersonId: string; // Parent or first partner
  toPersonId: string; // Child or second partner
  type: RelationshipType;
  status: RecordStatus;
  sourceFile: string; // "ከሰተ-ብርሃነ.pdf" or "family_genealogy_register.md"
  sourcePage: number | null;
  sourceWording: string; // Exact phrase, e.g., "ጎብሩ ከንቲባ ጉዕሽ ዝወለዶም"
  reviewerNotes?: string;
  isBiologicalConfirmed: boolean; // false for union or ambiguous statements
  deletionPending?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Source {
  id: string;
  filename: string;
  sourceType: 'pdf' | 'markdown' | 'oral';
  pageCount: number;
  checksum?: string;
  importDate: string;
  notes?: string;
}

export interface SourceOccurrence {
  id: string;
  sourceFile: string;
  page: number;
  headingOrBlock: string;
  rawText: string;
  sequence: number;
  linkedPersonId?: string | null;
  status: 'pending' | 'linked' | 'needs_review' | 'rejected';
  notes?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  entityType: 'person' | 'relationship' | 'source_occurrence' | 'import' | 'backup' | 'restore';
  entityId: string;
  action: 'create' | 'update' | 'archive' | 'delete' | 'verify' | 'flag_review' | 'import_committed' | 'restore_committed';
  reviewer: string;
  details: string; // Human-readable change summary
}

export interface ImportBlock {
  page: number;
  heading: string;
  relationshipType: RelationshipType | 'unlabelled' | 'continuation' | 'title_names';
  parentName?: string;
  spouseName?: string;
  rawWording: string;
  names: string[];
  notes?: string;
  needsReview: boolean;
}

export interface ImportPreviewStats {
  totalPages: number;
  totalBlocks: number;
  totalNameOccurrences: number;
  distinctNamesCount: number;
  duplicateNameOccurrences: { name: string; count: number; pages: number[] }[];
  unlabelledOrUncertainBlocks: number;
  proposedRelationshipsCount: number;
  pageBreakdown: { page: number; count: number; blocksCount: number }[];
  distinctPersonRecordsCount?: number;
  nameOccurrencesCount?: number;
  relationshipsByType?: {
    parentChild: number;
    partnerOrUnion: number;
    otherSourceStatement: number;
  };
  confirmedContinuationsCount?: number;
  unresolvedOrIncompleteCount?: number;
  pagesTranscribedCount?: number;
  pagesInspectedCount?: number;
}

export interface BackupData {
  version: string;
  exportedAt: string;
  sourceMetadata: {
    app: string;
    datasetType: 'real' | 'demo';
    description: string;
  };
  people: Person[];
  relationships: Relationship[];
  sources: Source[];
  sourceOccurrences: SourceOccurrence[];
  auditEvents: AuditEvent[];
}

