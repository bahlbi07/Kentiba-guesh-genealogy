# Kinteba Guush Family Genealogy — Data Model Specification

## 1. Architectural Philosophy

The **Kinteba Guush Family Genealogy** system is architected around historical fidelity, provenance preservation, and cultural integrity. Rather than treating names as primary keys or assuming biological parenthood where only cultural or union phrasing exists, this model enforces:

1. **Unique Identity vs. Name Representation:**
   In Tigrinya and Ethiopian genealogical records, family names recur across generations (e.g., grandchildren named after grandparents, siblings named after revered ancestors). A name is **never** a unique identifier. Every individual occurrence in the source register receives an immutable, stable ID (e.g., `pers_p1_14`).

2. **Separation of Occurrence, Entity, and Relationship:**
   - **SourceOccurrence:** Represents the literal text as it appeared on a specific PDF page and under a specific heading.
   - **Person:** Represents the genealogical individual.
   - **Relationship:** A typed, evidenced directed or undirected edge between two persons.

3. **Evidence-Linked Relationships:**
   Every relationship carries the exact source phrase, PDF page number, citation source file, reviewer status, and a boolean indicating whether biological parentage is explicitly confirmed or if the text only records a household/union statement.

---

## 2. Entity Schemas

### A. `Person`
```typescript
interface Person {
  id: string; // Unique stable identifier (e.g. "pers_p1_4")
  canonicalName: string; // Exact Tigrinya/Ge'ez characters as transcribed
  displayName?: string; // Optional reviewed English or normalized variant
  gender?: 'male' | 'female' | 'unknown';
  branch?: string; // e.g. "ጎብሩ", "ሃብቱ", "ተስፉ"
  notes?: string;
  sourcePage?: number; // Primary source PDF page
  sourceHeading?: string; // Exact heading in source
  sourceOccurrenceId?: string;
  status: 'unverified' | 'verified' | 'needs_review' | 'rejected';
  isArchived: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

### B. `Relationship`
```typescript
interface Relationship {
  id: string; // Unique stable identifier (e.g. "rel_pc_123")
  fromPersonId: string; // Parent or first partner
  toPersonId: string; // Child or second partner
  type: 'parent_child' | 'partner_or_union' | 'other_source_statement';
  status: 'unverified' | 'verified' | 'needs_review' | 'rejected';
  sourceFile: string; // "ከሰተ-ብርሃነ.pdf"
  sourcePage: number | null;
  sourceWording: string; // e.g. "ጎብሩ ከንቲባ ጉዕሽ ዝወለዶም"
  reviewerNotes?: string;
  isBiologicalConfirmed: boolean; // false for union statements or ambiguous lists
  createdAt: string;
  updatedAt: string;
}
```

### C. `SourceOccurrence`
```typescript
interface SourceOccurrence {
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
```

### D. `AuditEvent`
```typescript
interface AuditEvent {
  id: string;
  timestamp: string;
  entityType: 'person' | 'relationship' | 'source_occurrence' | 'import' | 'backup' | 'restore';
  entityId: string;
  action: 'create' | 'update' | 'archive' | 'delete' | 'verify' | 'flag_review' | 'import_committed' | 'restore_committed';
  reviewer: string;
  details: string;
}
```

---

## 3. Relationship Semantics & Tigrinya Source Phrasing

| Source Phrasing Pattern | Relationship Type | Biological Confirmed | Default Status |
| :--- | :--- | :--- | :--- |
| `X ዝወለዶም` / `X ዝወለደቶም` | `parent_child` | `true` | `verified` or `unverified` |
| `X ናብ Y ... ኣትያ ዝወለደቶም ድማ` | `partner_or_union` (X & Y) + `parent_child` (children) | `false` (for children of union until verified) | `needs_review` |
| Opening names under `ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ` | `other_source_statement` | `false` | `needs_review` |
| Unlabelled names / continuation blocks | `other_source_statement` | `false` | `needs_review` |
| Incomplete phrase on Page 36 | `other_source_statement` | `false` | `needs_review` |

---

## 4. Referential Integrity & Validation Rules

1. **Cycle Prevention:**
   A directed acyclic graph (DAG) cycle detector verifies all `parent_child` modifications. If a proposed link would cause a child to become an ancestor of their own parent, the transaction is rejected with an error.

2. **Dangling Edge Prevention:**
   Both `fromPersonId` and `toPersonId` must exist in the `people` store. When a person is deleted, all dependent relationships are tracked and cleaned up with audit logging.

3. **Non-Destructive Deduplication:**
   If a user suspects two occurrences represent the same individual, they are linked or noted in the reviewer audit trail rather than silently merged.

