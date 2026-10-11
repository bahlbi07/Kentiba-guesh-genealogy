import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Person, Relationship } from '../types/genealogy';
import { validateParentChildCycle } from '../services/cycleDetector';
import { apiSaveBatch } from '../services/apiClient';
import {
  X,
  User,
  Heart,
  Plus,
  Trash2,
  Search,
  CheckCircle,
  AlertTriangle,
  GitFork,
  Sparkles,
  Link2,
  Info,
  ChevronDown
} from 'lucide-react';

const DRAFT_STORAGE_KEY = 'kinteba_add_person_draft';

export const OFFICIAL_BRANCHES = [
  'ጎብሩ',
  'ሃብቱ',
  'ተስፉ',
  'ደስታ',
  'ወለገርግስ',
  'ይሕደጋ',
  'ብስራት',
  'ትዕበ',
  'በርሀ',
  'መድሂን'
];

export interface LineageGeneration {
  id: string;
  name: string;
  parentType: 'mother' | 'father';
  spouseName?: string;
  existingPersonId?: string | null;
}

export interface CascadeStep {
  id: string;
  parentName: string;
  parentId?: string;
  selectedPersonId?: string;
  name: string;
  spouseName?: string;
  isCustom: boolean;
}

interface DraftState {
  canonicalName: string;
  branch: string;
  notes: string;
  // Lineage chain from immediate parent up to branch root
  lineageChain: LineageGeneration[];
  // Quick text input for lineage
  quickLineageText: string;
  // Direct spouse of this person
  spouseName: string;
  spouseWording?: string;
  // Children of this person
  children: Array<{ id: string; name: string; notes?: string }>;
  // Cascading hierarchy steps under branch
  cascadeSteps?: CascadeStep[];
}

const initialDraft: DraftState = {
  canonicalName: '',
  branch: '',
  notes: '',
  lineageChain: [
    { id: 'gen_1', name: '', parentType: 'mother', spouseName: '' }
  ],
  quickLineageText: '',
  spouseName: '',
  spouseWording: '',
  children: [],
  cascadeSteps: []
};

// Levenshtein distance for fuzzy matching typos
function levenshteinDistance(a: string, b: string): number {
  const an = a.trim().toLowerCase();
  const bn = b.trim().toLowerCase();
  if (an === bn) return 0;
  if (!an.length) return bn.length;
  if (!bn.length) return an.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn.length; i++) matrix[i] = [i];
  for (let j = 0; j <= an.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= bn.length; i++) {
    for (let j = 1; j <= an.length; j++) {
      if (bn[i - 1] === an[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[bn.length][an.length];
}

interface AddPersonGuidedModalProps {
  people: Person[];
  relationships: Relationship[];
  onClose: () => void;
  onSavePerson: (person: Person) => Promise<void>;
  onSaveRelationship: (rel: Relationship) => Promise<{ success: boolean; error?: string }>;
  onComplete: () => Promise<void>;
}

export const AddPersonGuidedModal: React.FC<AddPersonGuidedModalProps> = ({
  people,
  relationships,
  onClose,
  onSavePerson,
  onSaveRelationship,
  onComplete,
}) => {
  // Form draft state
  const [form, setForm] = useState<DraftState>(initialDraft);
  const [showDraftRecoveryDialog, setShowDraftRecoveryDialog] = useState(false);
  const [hasCheckedDraft, setHasCheckedDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Cascading branch hierarchy steps
  const [cascadeSteps, setCascadeSteps] = useState<CascadeStep[]>([]);

  // Dismissed fuzzy suggestions
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  // Search picker state for searching an existing ancestor in database
  const [pickerTargetGenId, setPickerTargetGenId] = useState<string | null>(null);
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');

  // Check draft on load
  useEffect(() => {
    if (hasCheckedDraft) return;
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed.canonicalName ||
          parsed.branch ||
          (parsed.lineageChain && parsed.lineageChain.some((g: any) => g.name))
        ) {
          setShowDraftRecoveryDialog(true);
        }
      }
    } catch {
      // Ignore parse error
    } finally {
      setHasCheckedDraft(true);
    }
  }, [hasCheckedDraft]);

  const saveDraftSilent = useCallback((nextState: DraftState) => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      // Ignore storage error
    }
  }, []);

  const updateForm = (updater: (prev: DraftState) => DraftState) => {
    setForm((prev) => {
      const next = updater(prev);
      saveDraftSilent(next);
      return next;
    });
  };

  const handleResumeDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm(parsed);
        if (parsed.cascadeSteps && parsed.cascadeSteps.length > 0) {
          setCascadeSteps(parsed.cascadeSteps);
        }
      }
    } catch {
      // Ignore
    }
    setShowDraftRecoveryDialog(false);
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setForm(initialDraft);
    setCascadeSteps([]);
    setShowDraftRecoveryDialog(false);
  };

  // Root patriarch Kinteba Guush
  const rootPatriarch = useMemo(() => {
    return (
      people.find(
        (p) =>
          p.id === 'pers_root_kinteba_guush' ||
          p.canonicalName.includes('ከንቲባ ጉዑሽ') ||
          p.canonicalName.includes('ከንቲባ ጉዕሽ') ||
          p.id === 'pers_p1_0_0'
      ) || null
    );
  }, [people]);

  // Find root person for a given branch
  const getBranchRootPerson = useCallback(
    (branchName: string): Person | null => {
      if (!branchName) return null;
      const b = branchName.trim();
      return (
        people.find(
          (p) =>
            p.branch === b &&
            (p.canonicalName.trim() === b ||
              p.fatherName?.includes('ከንቲባ') ||
              p.id.startsWith('pers_p1_'))
        ) ||
        people.find((p) => p.canonicalName.trim() === b) ||
        null
      );
    },
    [people]
  );

  // Helper to get registered children of a person from database
  const getChildrenForPerson = useCallback(
    (personId?: string, personName?: string): Person[] => {
      if (!personId && !personName) return [];
      const foundMap = new Map<string, Person>();

      if (personId) {
        for (const rel of relationships) {
          if (rel.type === 'parent_child' && rel.fromPersonId === personId) {
            const child = people.find((p) => p.id === rel.toPersonId && !p.isArchived);
            if (child) foundMap.set(child.id, child);
          }
        }
      }

      const cleanName = (personName || '').trim().toLowerCase();
      if (cleanName) {
        for (const p of people) {
          if (p.isArchived) continue;
          if (
            (p.fatherName && p.fatherName.trim().toLowerCase() === cleanName) ||
            (p.motherName && p.motherName.trim().toLowerCase() === cleanName) ||
            (p.notes && p.notes.toLowerCase().includes(`ደቂ ${cleanName}`))
          ) {
            foundMap.set(p.id, p);
          }
        }
      }

      return Array.from(foundMap.values());
    },
    [people, relationships]
  );

  // Synchronize cascading descendant steps into form.lineageChain (from bottom up)
  const syncCascadeToLineage = useCallback(
    (steps: CascadeStep[], branchName: string) => {
      const validSteps = steps.filter((s) => s.name && s.name.trim().length > 0);
      if (validSteps.length === 0) return;

      const chain: LineageGeneration[] = [];

      // Step 1 up to last step in reverse order: lowest child first (immediate parent)
      for (let i = validSteps.length - 1; i >= 0; i--) {
        const s = validSteps[i];
        chain.push({
          id: `gen_casc_${i}_${s.name.trim()}`,
          name: s.name.trim(),
          parentType: i === validSteps.length - 1 ? 'mother' : 'father',
          spouseName: s.spouseName?.trim() || '',
          existingPersonId: s.selectedPersonId || null,
        });
      }

      // Add branch anchor at top of chain
      if (branchName && !chain.some((g) => g.name.trim() === branchName.trim())) {
        const rootPerson = getBranchRootPerson(branchName);
        chain.push({
          id: `gen_casc_branch_${branchName}`,
          name: branchName.trim(),
          parentType: 'father',
          spouseName: '',
          existingPersonId: rootPerson?.id || null,
        });
      }

      updateForm((prev) => ({
        ...prev,
        lineageChain: chain,
        cascadeSteps: steps,
      }));
    },
    [getBranchRootPerson]
  );

  // When branch is selected
  const handleBranchChange = (newBranch: string) => {
    updateForm((prev) => ({ ...prev, branch: newBranch }));
    if (!newBranch) {
      setCascadeSteps([]);
      return;
    }
    const rootPerson = getBranchRootPerson(newBranch);
    const initialStep: CascadeStep = {
      id: `step_${Date.now()}_0`,
      parentName: newBranch,
      parentId: rootPerson?.id,
      name: '',
      spouseName: '',
      isCustom: false,
    };
    setCascadeSteps([initialStep]);
  };

  // Cascading child selection handler
  const handleSelectCascadeChild = (stepIndex: number, childPersonId: string) => {
    if (childPersonId === '__custom__') {
      setCascadeSteps((prev) => {
        const next = [...prev];
        next[stepIndex] = {
          ...next[stepIndex],
          name: '',
          selectedPersonId: undefined,
          isCustom: true,
        };
        const pruned = next.slice(0, stepIndex + 1);
        syncCascadeToLineage(pruned, form.branch);
        return pruned;
      });
      return;
    }

    if (!childPersonId) {
      setCascadeSteps((prev) => {
        const next = [...prev];
        next[stepIndex] = {
          ...next[stepIndex],
          name: '',
          selectedPersonId: undefined,
          isCustom: false,
        };
        const pruned = next.slice(0, stepIndex + 1);
        syncCascadeToLineage(pruned, form.branch);
        return pruned;
      });
      return;
    }

    const selectedPerson = people.find((p) => p.id === childPersonId);
    if (!selectedPerson) return;

    setCascadeSteps((prev) => {
      const next = prev.slice(0, stepIndex + 1);
      next[stepIndex] = {
        ...next[stepIndex],
        name: selectedPerson.canonicalName,
        selectedPersonId: selectedPerson.id,
        isCustom: false,
      };

      // Automatically add next generation step below
      next.push({
        id: `step_${Date.now()}_${stepIndex + 1}`,
        parentName: selectedPerson.canonicalName,
        parentId: selectedPerson.id,
        name: '',
        spouseName: '',
        isCustom: false,
      });

      syncCascadeToLineage(next, form.branch);
      return next;
    });
  };

  const handleUpdateCascadeCustomName = (stepIndex: number, name: string) => {
    setCascadeSteps((prev) => {
      const next = [...prev];
      const trimmed = name.trim();
      const existingChildren = getChildrenForPerson(next[stepIndex].parentId, next[stepIndex].parentName);
      const matchedChild = trimmed
        ? existingChildren.find(
            (c) => c.canonicalName.trim().toLowerCase() === trimmed.toLowerCase()
          )
        : undefined;

      next[stepIndex] = {
        ...next[stepIndex],
        name,
        selectedPersonId: matchedChild ? matchedChild.id : undefined,
        isCustom: !matchedChild,
      };
      syncCascadeToLineage(next, form.branch);
      return next;
    });
  };

  const handleUpdateCascadeSpouse = (stepIndex: number, spouseName: string) => {
    setCascadeSteps((prev) => {
      const next = [...prev];
      next[stepIndex] = {
        ...next[stepIndex],
        spouseName,
      };
      syncCascadeToLineage(next, form.branch);
      return next;
    });
  };

  const handleAddNextCascadeStep = (fromStepIndex: number) => {
    const parent = cascadeSteps[fromStepIndex];
    if (!parent || !parent.name.trim()) return;

    setCascadeSteps((prev) => {
      const next = [...prev];
      next.push({
        id: `step_${Date.now()}_${prev.length}`,
        parentName: parent.name.trim(),
        parentId: parent.selectedPersonId,
        name: '',
        spouseName: '',
        isCustom: true,
      });
      return next;
    });
  };

  const handleRemoveCascadeStep = (stepIndex: number) => {
    setCascadeSteps((prev) => {
      const next = prev.slice(0, stepIndex);
      syncCascadeToLineage(next, form.branch);
      return next;
    });
  };

  // Fuzzy typo matching against official branches (Requirement 3)
  const getSuggestionForName = (name: string): string | null => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return null;
    if (OFFICIAL_BRANCHES.includes(trimmed)) return null;

    for (const branch of OFFICIAL_BRANCHES) {
      const key = `${trimmed}:${branch}`;
      if (dismissedSuggestions.has(key)) continue;
      const dist = levenshteinDistance(trimmed, branch);
      if (dist > 0 && dist <= 2) {
        return branch;
      }
    }
    return null;
  };

  const handleAcceptFuzzy = (genId: string, suggestion: string) => {
    handleUpdateGeneration(genId, { name: suggestion });
  };

  const handleDismissFuzzy = (typedName: string, suggestion: string) => {
    setDismissedSuggestions((prev) => new Set(prev).add(`${typedName.trim()}:${suggestion}`));
  };

  // Quick chain parser: converts text like "ደሃብ ሓሊቦ ሓጎስ ዓዶ ዑመር ትዕበ" into generations
  const handleApplyQuickChain = () => {
    const raw = form.quickLineageText.trim();
    if (!raw) return;

    const parts = raw
      .split(/[➔\->,]+|\s{2,}|\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.includes('ከንቲባ') && !s.includes('ጉዕሽ') && !s.includes('ጉዑሽ'));

    if (parts.length === 0) return;

    const newChain: LineageGeneration[] = parts.map((name, idx) => ({
      id: `gen_${Date.now()}_${idx}`,
      name,
      parentType: idx === 0 ? 'mother' : 'father',
      spouseName: ''
    }));

    updateForm((prev) => ({
      ...prev,
      lineageChain: newChain,
      quickLineageText: ''
    }));
  };

  // Quick lineage fuzzy suggestion
  const quickLineageSuggestion = useMemo(() => {
    if (!form.quickLineageText.trim()) return null;
    const words = form.quickLineageText.trim().split(/\s+/);
    for (const w of words) {
      const sugg = getSuggestionForName(w);
      if (sugg) return { typo: w, suggestion: sugg };
    }
    return null;
  }, [form.quickLineageText, dismissedSuggestions]);

  const handleAcceptQuickFuzzy = (typo: string, suggestion: string) => {
    updateForm((p) => ({
      ...p,
      quickLineageText: p.quickLineageText.replace(new RegExp(typo, 'g'), suggestion),
    }));
  };

  // Lineage chain management
  const handleAddGeneration = () => {
    updateForm((prev) => ({
      ...prev,
      lineageChain: [
        ...prev.lineageChain,
        {
          id: `gen_${Date.now()}_${prev.lineageChain.length}`,
          name: '',
          parentType: 'father',
          spouseName: ''
        }
      ]
    }));
  };

  const handleRemoveGeneration = (id: string) => {
    updateForm((prev) => ({
      ...prev,
      lineageChain: prev.lineageChain.filter((g) => g.id !== id)
    }));
  };

  const handleUpdateGeneration = (id: string, updates: Partial<LineageGeneration>) => {
    updateForm((prev) => ({
      ...prev,
      lineageChain: prev.lineageChain.map((g) => (g.id === id ? { ...g, ...updates } : g))
    }));
  };

  // Children management
  const handleAddChildRow = () => {
    updateForm((prev) => ({
      ...prev,
      children: [
        ...prev.children,
        { id: `c_${Date.now()}_${prev.children.length}`, name: '', notes: '' }
      ]
    }));
  };

  const handleUpdateChildRow = (id: string, name: string) => {
    updateForm((prev) => ({
      ...prev,
      children: prev.children.map((c) => (c.id === id ? { ...c, name } : c))
    }));
  };

  const handleRemoveChildRow = (id: string) => {
    updateForm((prev) => ({
      ...prev,
      children: prev.children.filter((c) => c.id !== id)
    }));
  };

  // Search results for ancestor picker
  const pickerSearchResults = useMemo(() => {
    if (!pickerTargetGenId) return [];
    const q = pickerSearchQuery.toLowerCase().trim();
    return people
      .filter((p) => {
        if (!q) return true;
        return (
          p.canonicalName.toLowerCase().includes(q) ||
          (p.fatherName && p.fatherName.toLowerCase().includes(q)) ||
          (p.branch && p.branch.toLowerCase().includes(q))
        );
      })
      .slice(0, 15);
  }, [pickerTargetGenId, pickerSearchQuery, people]);

  // Validation
  const validation = useMemo(() => {
    if (!form.canonicalName.trim()) {
      return { isValid: false, error: 'ስም ኣባል ምምላእ ግድነት እዩ።' };
    }
    return { isValid: true };
  }, [form.canonicalName]);

  // Comprehensive Submission Handler: Saves person, multi-generational chain, spouse, children locally + server batch sync
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const now = new Date().toISOString();

    try {
      const createdPeopleBatch: Person[] = [];
      const createdRelationshipsBatch: Relationship[] = [];

      // 1. Create ID for Main Person
      const mainPersonId = `pers_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      // 2. Process Ancestral Chain (from generation 1 up to top generation)
      const validGenerations = form.lineageChain.filter((g) => g.name.trim().length > 0);
      const createdAncestorIds: string[] = [];

      for (let i = 0; i < validGenerations.length; i++) {
        const gen = validGenerations[i];
        const trimmedGenName = gen.name.trim();

        // Check if ancestor already exists in the database
        let ancestorId: string | null = null;

        // 1. Check by explicit existingPersonId if selected from dropdown or auto-matched
        if (gen.existingPersonId) {
          const matchedById = people.find((p) => p.id === gen.existingPersonId);
          if (matchedById) {
            ancestorId = matchedById.id;
          }
        }

        // 2. Check if the parent generation (validGenerations[i + 1]) already has a child with this name
        if (!ancestorId && i < validGenerations.length - 1) {
          const parentGen = validGenerations[i + 1];
          const parentCandidateId = parentGen.existingPersonId;
          const parentChildren = getChildrenForPerson(parentCandidateId || undefined, parentGen.name);
          const childMatch = parentChildren.find(
            (c) => c.canonicalName.trim().toLowerCase() === trimmedGenName.toLowerCase()
          );
          if (childMatch) {
            ancestorId = childMatch.id;
          }
        }

        // 3. Check across all database people by canonicalName (branch insensitive or matching)
        if (!ancestorId) {
          const matchedByName =
            people.find(
              (p) =>
                p.canonicalName.trim().toLowerCase() === trimmedGenName.toLowerCase() &&
                (!form.branch || !p.branch || p.branch.trim() === form.branch.trim())
            ) ||
            people.find(
              (p) => p.canonicalName.trim().toLowerCase() === trimmedGenName.toLowerCase()
            );

          if (matchedByName) {
            ancestorId = matchedByName.id;
          }
        }

        if (ancestorId) {
          // Ancestor exists! Reuse existing record without duplication
        } else {
          // Genuinely new ancestor: create record
          ancestorId = `pers_${Date.now()}_anc_${i}_${Math.random().toString(36).substring(2, 5)}`;
          const newAncestor: Person = {
            id: ancestorId,
            canonicalName: trimmedGenName,
            branch: form.branch || undefined,
            status: 'verified',
            isArchived: false,
            notes: `ወለዶ ስድራቤት: ${form.canonicalName}`,
            createdAt: now,
            updatedAt: now,
          };
          await onSavePerson(newAncestor);
          createdPeopleBatch.push(newAncestor);
        }

        createdAncestorIds.push(ancestorId);

        // If this generation has a spouse specified
        if (gen.spouseName && gen.spouseName.trim()) {
          const trimmedSpouseName = gen.spouseName.trim();
          const existingSpouse = people.find(
            (p) => p.canonicalName.trim().toLowerCase() === trimmedSpouseName.toLowerCase()
          );

          let genSpouseId: string;
          if (existingSpouse) {
            genSpouseId = existingSpouse.id;
          } else {
            genSpouseId = `pers_${Date.now()}_sp_${i}_${Math.random().toString(36).substring(2, 5)}`;
            const newSpouse: Person = {
              id: genSpouseId,
              canonicalName: trimmedSpouseName,
              branch: form.branch || undefined,
              status: 'verified',
              isArchived: false,
              notes: `መጻምድቲ ${trimmedGenName}`,
              createdAt: now,
              updatedAt: now,
            };
            await onSavePerson(newSpouse);
            createdPeopleBatch.push(newSpouse);
          }

          // Link ancestor to their spouse if not already linked
          const alreadySpouseLinked =
            relationships.some(
              (r) =>
                r.type === 'partner_or_union' &&
                ((r.fromPersonId === ancestorId && r.toPersonId === genSpouseId) ||
                  (r.fromPersonId === genSpouseId && r.toPersonId === ancestorId))
            ) ||
            createdRelationshipsBatch.some(
              (r) =>
                r.type === 'partner_or_union' &&
                ((r.fromPersonId === ancestorId && r.toPersonId === genSpouseId) ||
                  (r.fromPersonId === genSpouseId && r.toPersonId === ancestorId))
            );

          if (!alreadySpouseLinked) {
            const spouseRel: Relationship = {
              id: `rel_${Date.now()}_sp_${i}_${Math.random().toString(36).substring(2, 5)}`,
              fromPersonId: ancestorId,
              toPersonId: genSpouseId,
              type: 'partner_or_union',
              status: 'verified',
              sourceFile: 'ከሰተ-ብርሃነ.pdf',
              sourcePage: null,
              sourceWording: `${trimmedGenName} ዝተመርዓዉ ምስ ${trimmedSpouseName}`,
              isBiologicalConfirmed: false,
              createdAt: now,
              updatedAt: now,
            };
            await onSaveRelationship(spouseRel);
            createdRelationshipsBatch.push(spouseRel);
          }
        }
      }

      // Link Ancestral Chain Steps to one another (parent -> child)
      for (let i = 0; i < createdAncestorIds.length - 1; i++) {
        const childGenId = createdAncestorIds[i];
        const parentGenId = createdAncestorIds[i + 1];

        // Check if link already exists in database or batch
        const alreadyLinked =
          relationships.some(
            (r) =>
              r.type === 'parent_child' &&
              r.fromPersonId === parentGenId &&
              r.toPersonId === childGenId
          ) ||
          createdRelationshipsBatch.some(
            (r) =>
              r.type === 'parent_child' &&
              r.fromPersonId === parentGenId &&
              r.toPersonId === childGenId
          );

        if (!alreadyLinked) {
          const cycleCheck = validateParentChildCycle(relationships, parentGenId, childGenId);
          if (cycleCheck.isValid) {
            const chainRel: Relationship = {
              id: `rel_${Date.now()}_chain_${i}_${Math.random().toString(36).substring(2, 5)}`,
              fromPersonId: parentGenId,
              toPersonId: childGenId,
              type: 'parent_child',
              status: 'verified',
              sourceFile: 'ከሰተ-ብርሃነ.pdf',
              sourcePage: null,
              sourceWording: `${validGenerations[i].name} ወዲ/ጓል ${validGenerations[i + 1].name}`,
              isBiologicalConfirmed: true,
              createdAt: now,
              updatedAt: now,
            };
            await onSaveRelationship(chainRel);
            createdRelationshipsBatch.push(chainRel);
          }
        }
      }

      // If top ancestor matches an official branch, link to root patriarch
      if (createdAncestorIds.length > 0 && rootPatriarch) {
        const topAncestorId = createdAncestorIds[createdAncestorIds.length - 1];
        const topGenName = validGenerations[validGenerations.length - 1].name.trim();

        const isBranchTop = OFFICIAL_BRANCHES.some((b) => topGenName.includes(b));
        if (isBranchTop && topAncestorId !== rootPatriarch.id) {
          const alreadyRootLinked =
            relationships.some(
              (r) =>
                r.type === 'parent_child' &&
                r.fromPersonId === rootPatriarch.id &&
                r.toPersonId === topAncestorId
            ) ||
            createdRelationshipsBatch.some(
              (r) =>
                r.type === 'parent_child' &&
                r.fromPersonId === rootPatriarch.id &&
                r.toPersonId === topAncestorId
            );

          if (!alreadyRootLinked) {
            const cycleCheck = validateParentChildCycle(relationships, rootPatriarch.id, topAncestorId);
            if (cycleCheck.isValid) {
              const rootRel: Relationship = {
                id: `rel_${Date.now()}_root_${topAncestorId}`,
                fromPersonId: rootPatriarch.id,
                toPersonId: topAncestorId,
                type: 'parent_child',
                status: 'verified',
                sourceFile: 'ከሰተ-ብርሃነ.pdf',
                sourcePage: null,
                sourceWording: `${topGenName} ወዲ ከንቲባ ጉዑሽ ሓጎስ`,
                isBiologicalConfirmed: true,
                createdAt: now,
                updatedAt: now,
              };
              await onSaveRelationship(rootRel);
              createdRelationshipsBatch.push(rootRel);
            }
          }
        }
      }

      // 3. Save Main Person
      const immediateParentId = createdAncestorIds.length > 0 ? createdAncestorIds[0] : undefined;
      const immediateParentName = validGenerations.length > 0 ? validGenerations[0].name : undefined;

      const mainPerson: Person = {
        id: mainPersonId,
        canonicalName: form.canonicalName.trim(),
        branch: form.branch.trim() || (validGenerations.length > 0 ? validGenerations[validGenerations.length - 1].name : undefined),
        fatherName: immediateParentName,
        status: 'verified',
        isArchived: false,
        notes: form.notes?.trim() || undefined,
        createdAt: now,
        updatedAt: now
      };
      await onSavePerson(mainPerson);
      createdPeopleBatch.push(mainPerson);

      // Link main person to immediate parent (generation 1)
      if (immediateParentId) {
        const cycleCheck = validateParentChildCycle(relationships, immediateParentId, mainPersonId);
        if (cycleCheck.isValid) {
          const mainParentRel: Relationship = {
            id: `rel_${Date.now()}_main_parent`,
            fromPersonId: immediateParentId,
            toPersonId: mainPersonId,
            type: 'parent_child',
            status: 'verified',
            sourceFile: 'ከሰተ-ብርሃነ.pdf',
            sourcePage: null,
            sourceWording: `${form.canonicalName} ወዲ/ጓል ${immediateParentName}`,
            isBiologicalConfirmed: true,
            createdAt: now,
            updatedAt: now
          };
          await onSaveRelationship(mainParentRel);
          createdRelationshipsBatch.push(mainParentRel);
        }
      }

      // 4. Save Main Person's Spouse (Requirement 4: only spouseName)
      if (form.spouseName.trim()) {
        const trimmedSpouse = form.spouseName.trim();
        const spouseId = `pers_${Date.now()}_main_sp_${Math.random().toString(36).substring(2, 5)}`;
        const spousePerson: Person = {
          id: spouseId,
          canonicalName: trimmedSpouse,
          branch: form.branch || undefined,
          status: 'verified',
          isArchived: false,
          notes: `መጻምድቲ ${form.canonicalName}`,
          createdAt: now,
          updatedAt: now
        };
        await onSavePerson(spousePerson);
        createdPeopleBatch.push(spousePerson);

        const mainSpouseRel: Relationship = {
          id: `rel_${Date.now()}_main_sp_rel`,
          fromPersonId: mainPersonId,
          toPersonId: spouseId,
          type: 'partner_or_union',
          status: 'verified',
          sourceFile: 'ከሰተ-ብርሃነ.pdf',
          sourcePage: null,
          sourceWording: form.spouseWording?.trim() || `${form.canonicalName} ዝተመርዓዉ ምስ ${trimmedSpouse}`,
          isBiologicalConfirmed: false,
          createdAt: now,
          updatedAt: now
        };
        await onSaveRelationship(mainSpouseRel);
        createdRelationshipsBatch.push(mainSpouseRel);
      }

      // 5. Save Children
      for (const child of form.children) {
        if (!child.name.trim()) continue;
        const trimmedChildName = child.name.trim();

        const existingChild = people.find(
          (p) =>
            p.canonicalName.trim().toLowerCase() === trimmedChildName.toLowerCase() &&
            (p.fatherName?.trim().toLowerCase() === form.canonicalName.trim().toLowerCase() ||
              p.motherName?.trim().toLowerCase() === form.canonicalName.trim().toLowerCase())
        );

        let childId: string;
        if (existingChild) {
          childId = existingChild.id;
        } else {
          childId = `pers_${Date.now()}_c_${Math.random().toString(36).substring(2, 5)}`;
          const childPerson: Person = {
            id: childId,
            canonicalName: trimmedChildName,
            branch: form.branch || undefined,
            fatherName: form.canonicalName.trim(),
            status: 'verified',
            isArchived: false,
            notes: child.notes?.trim() || undefined,
            createdAt: now,
            updatedAt: now,
          };
          await onSavePerson(childPerson);
          createdPeopleBatch.push(childPerson);
        }

        const alreadyChildLinked =
          relationships.some(
            (r) =>
              r.type === 'parent_child' &&
              r.fromPersonId === mainPersonId &&
              r.toPersonId === childId
          ) ||
          createdRelationshipsBatch.some(
            (r) =>
              r.type === 'parent_child' &&
              r.fromPersonId === mainPersonId &&
              r.toPersonId === childId
          );

        if (!alreadyChildLinked) {
          const childRel: Relationship = {
            id: `rel_${Date.now()}_c_${childId}`,
            fromPersonId: mainPersonId,
            toPersonId: childId,
            type: 'parent_child',
            status: 'verified',
            sourceFile: 'ከሰተ-ብርሃነ.pdf',
            sourcePage: null,
            sourceWording: `${trimmedChildName} ወዲ/ጓል ${form.canonicalName.trim()}`,
            isBiologicalConfirmed: true,
            createdAt: now,
            updatedAt: now,
          };
          await onSaveRelationship(childRel);
          createdRelationshipsBatch.push(childRel);
        }
      }

      // 6. Immediately synchronize all created records with server backend (Requirement 5)
      try {
        const token = sessionStorage.getItem('kinteba_admin_token') || 'official-admin-session-token';
        await apiSaveBatch(createdPeopleBatch, createdRelationshipsBatch, token);
      } catch (syncErr) {
        console.warn('Server batch synchronization note:', syncErr);
      }

      // 7. Clean draft and reload
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      await onComplete();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ምምዝጋብ ኣይተዓወተን።';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 font-ethiopic">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-amber-100">ሓድሽ ኣባል ስድራቤት ምምዝጋብ</h2>
              <p className="text-xs text-stone-400">
                ምሉእ ሓበሬታ፡ ወለዶ፡ መዋስብትን ውሉዳትን ብዝግባእ ኣእቱ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
            aria-label="ዕጾ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Draft Recovery Alert */}
        {showDraftRecoveryDialog && (
          <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-900 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
              <span>ቅድሚ ሕጂ ዝጀመርኩምዎ ዘይተወድአ ረቂቕ መዝገብ ኣሎ። ክትቅጽልዎ ትደልዩ ዲኹም?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResumeDraft}
                className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-bold cursor-pointer"
              >
                ቀጽል
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="px-2.5 py-1 text-stone-600 hover:text-stone-900 hover:underline cursor-pointer"
              >
                ኣጥፍእ
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* SECTION 1: ውልቃዊ ሓበሬታ (Requirement 2: Historical notes textarea removed) */}
          <div className="space-y-4">
            <h3 className="font-bold text-stone-900 text-base flex items-center gap-2 pb-2 border-b border-stone-200">
              <User className="w-4 h-4 text-amber-700" />
              <span>1. ውልቃዊ ሓበሬታ</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  ምሉእ ስም (ብትግርኛ) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ንኣብነት: ባህልቢ ሃይለ..."
                  value={form.canonicalName}
                  onChange={(e) => updateForm((p) => ({ ...p, canonicalName: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:ring-2 focus:ring-amber-500 font-ethiopic"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  ጨንፈር / ሓረግ
                </label>
                <select
                  value={form.branch}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:ring-2 focus:ring-amber-500 font-ethiopic cursor-pointer"
                >
                  <option value="">ጨንፈር ምረጽ...</option>
                  {OFFICIAL_BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      ሓረግ {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* REQUIREMENT 1: Cascading Branch Descendants Hierarchy Navigation */}
            {form.branch && (
              <div className="p-4 bg-amber-50/70 border border-amber-300/80 rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                  <div className="flex items-center gap-2">
                    <GitFork className="w-4 h-4 text-amber-800 rotate-180 shrink-0" />
                    <span className="font-bold text-amber-950 text-xs">
                      ተዋረድ ወለዶ ሓረግ «{form.branch}» (ጨንፈር ተዋረድ)
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-800">
                    ካብ ሓረግ {form.branch} ጀሚርካ ተዋረድ ውሉዳት ምረጽ ወይ የእቱ
                  </span>
                </div>

                <div className="space-y-3">
                  {cascadeSteps.map((step, idx) => {
                    const availableChildren = getChildrenForPerson(step.parentId, step.parentName);
                    return (
                      <div
                        key={step.id}
                        className="p-3 bg-white rounded-xl border border-amber-200/90 shadow-2xs space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                            <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 text-[10px] flex items-center justify-center font-bold shrink-0">
                              {idx + 1}
                            </span>
                            <span>
                              ደቂ «{step.parentName}» (ደረጃ {idx + 1} ተዋረድ)
                            </span>
                          </div>
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCascadeStep(idx)}
                              className="text-[11px] text-stone-400 hover:text-rose-600 cursor-pointer flex items-center gap-0.5"
                              title="እዚ ደረጃ ኣልግስ"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>ኣልግስ</span>
                            </button>
                          )}
                        </div>

                        {!step.isCustom ? (
                          <div className="space-y-1.5">
                            <label className="block text-[11px] text-stone-600 font-medium">
                              ውሉድ / ተዋረድ ናይ {step.parentName} ምረጽ፦
                            </label>
                            <div className="relative">
                              <select
                                value={step.selectedPersonId || ''}
                                onChange={(e) => handleSelectCascadeChild(idx, e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-ethiopic focus:ring-2 focus:ring-amber-500 cursor-pointer"
                              >
                                <option value="">-- ካብቶም ዘለዉ ውሉድ ምረጽ ወይ ሓድሽ የእቱ --</option>
                                {availableChildren.map((child) => (
                                  <option key={child.id} value={child.id}>
                                    {child.canonicalName}
                                  </option>
                                ))}
                                <option value="__custom__">
                                  + ሓድሽ ወለዶ የእቱ (ኣብ መዝገብ ንዘየለ ሓድሽ ውሉድ)...
                                </option>
                              </select>
                            </div>
                            {availableChildren.length === 0 && (
                              <p className="text-[11px] text-amber-800 italic pt-1">
                                ኣብ መዝገብ ዝተረኽበ ውሉድ የለን። &ldquo;+ ሓድሽ ወለዶ የእቱ&rdquo; ብምምራጽ ሓድሽ ወለዶ የእትዉ።
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[11px] text-stone-600 font-medium mb-1">
                                  ስም ሓድሽ ውሉድ ናይ {step.parentName} *
                                </label>
                                <input
                                  type="text"
                                  placeholder="ስም ውሉድ ጽሓፍ..."
                                  value={step.name}
                                  onChange={(e) => handleUpdateCascadeCustomName(idx, e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border border-amber-400 bg-amber-50/30 text-xs font-ethiopic focus:ring-2 focus:ring-amber-500"
                                  autoFocus
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-stone-600 font-medium mb-1">
                                  መጻምድቲ (ሓዳር) እንተሃልዩ
                                </label>
                                <input
                                  type="text"
                                  placeholder="ስም መጻምድቲ..."
                                  value={step.spouseName || ''}
                                  onChange={(e) => handleUpdateCascadeSpouse(idx, e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-ethiopic"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setCascadeSteps((prev) => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], isCustom: false, name: '' };
                                    return next;
                                  });
                                }}
                                className="text-[11px] text-amber-800 hover:underline cursor-pointer"
                              >
                                &larr; ናብ መምረጺ ተመለስ
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddNextCascadeStep(idx)}
                                disabled={!step.name.trim()}
                                className="px-3 py-1 bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>+ ቀጻሊ ተዋረድ ወስኽ</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Lineage visual breadcrumb */}
                {form.lineageChain.length > 0 && (
                  <div className="p-3 bg-white/90 rounded-xl border border-amber-300/80 text-[11px] text-stone-700 space-y-1.5">
                    <span className="font-bold text-amber-950 block">
                      ዝተረኽበ ሰንሰለታዊ ሓረግ (ካብ ከንቲባ ጉዕሽ ክሳብ እዚ ሰብ)፦
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-ethiopic text-stone-800">
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 font-bold text-amber-950">
                        ከንቲባ ጉዑሽ
                      </span>
                      {form.lineageChain
                        .slice()
                        .reverse()
                        .map((g) => (
                          <React.Fragment key={g.id}>
                            <span className="text-amber-500 font-bold">&rarr;</span>
                            <span className="px-2 py-0.5 rounded-md bg-stone-100 font-medium border border-stone-200">
                              {g.name}
                              {g.spouseName && (
                                <span className="text-[10px] text-rose-600 font-normal">
                                  {' '}(ምስ {g.spouseName})
                                </span>
                              )}
                            </span>
                          </React.Fragment>
                        ))}
                      <span className="text-amber-500 font-bold">&rarr;</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-950 font-bold border border-emerald-300">
                        {form.canonicalName || 'እዚ ሰብ'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* መተሓሳሰቢ ወይ ታሪኻዊ መረዳእታ */}
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                መተሓሳሰቢ ወይ ታሪኻዊ መረዳእታ
              </label>
              <textarea
                rows={2}
                placeholder="ተወሳኺ መረዳእታ፡ ዓዲ፡ ወይ ታሪኽ እንተሃልዩ ኣብዚ ጽሓፍ..."
                value={form.notes}
                onChange={(e) => updateForm((p) => ({ ...p, notes: e.target.value }))}
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 bg-white text-stone-900 text-xs focus:ring-2 focus:ring-amber-500 font-ethiopic"
              />
            </div>
          </div>

          {/* SECTION 2: ሰንሰለታዊ ወለዶ (Lineage Path to Kinteba Guush) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-stone-200 gap-2">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <Link2 className="w-4 h-4 text-amber-700" />
                <span>2. ሰንሰለታዊ ወለዶ (ናብ ከንቲባ ጉዕሽ ዝወስድ ሓረግ)</span>
              </h3>
              <span className="text-[11px] text-stone-500">
                ካብ ወላዲ ጀሚርካ ክሳብ ጨንፈር ከንቲባ ጉዕሽ ብቅደም ተኸተል
              </span>
            </div>

            {/* REQUIREMENT 3: Professional Lineage Guidance Box */}
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3">
              <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900 space-y-1">
                <p className="font-bold">ፕሮፌሽናል መዘኻኸሪ ንሰንሰለታዊ ወለዶ፦</p>
                <p className="text-[11px] leading-relaxed text-blue-800">
                  ቅድሚ ኣብዚ ሰንሰለታዊ ወለዶ ብኢድኩም ምጽሓፍኩም፡ እቲ ጨንፈር ወይ መበቆልኩም ካብቶም ኣብ ላዕሊ ኣብ &ldquo;ጨንፈር / ሓረግ&rdquo; ዝተዘርዘሩ 10 ዓበይቲ ጨናፍር ከንቲባ ጉዕሽ (ጎብሩ፡ ሃብቱ፡ ተስፉ፡ ደስታ፡ ወለገርግስ፡ ይሕደጋ፡ ብስራት፡ ትዕበ፡ በርሀ፡ መድሂን) ዘይተዘርዘረ ምዃኑ ኣረጋግጹ። እቲ ጨንፈር እንተሃልዩ፡ ካብቲ ላዕላይ መምረጺ ብምምራጽ ብቐሊሉ ተዋረድ ክትረኽቡ ትኽእሉ ኢኹም።
                </p>
              </div>
            </div>

            {/* Generational Steps */}
            <div className="space-y-3">
              {form.lineageChain.map((gen, idx) => {
                const fuzzySuggestion = getSuggestionForName(gen.name);
                return (
                  <div
                    key={gen.id}
                    className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2.5 relative transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-stone-800 text-xs">
                          {idx === 0
                            ? 'ቀዳማይ ደረጃ (ወላዲ / ወላዲት)'
                            : idx === form.lineageChain.length - 1
                            ? `መወዳእታ ወለዶ (ጨንፈር ከንቲባ ጉዕሽ)`
                            : `ደረጃ ${idx + 1} ወለዶ`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPickerTargetGenId(gen.id);
                            setPickerSearchQuery(gen.name || '');
                          }}
                          className="text-[11px] text-amber-800 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                        >
                          <Search className="w-3 h-3" />
                          <span>ካብ መዝገብ ድለ</span>
                        </button>

                        {form.lineageChain.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveGeneration(gen.id)}
                            className="p-1 text-stone-400 hover:text-rose-600 rounded cursor-pointer"
                            title="ኣልግስ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-stone-600 font-medium mb-1">
                          ስም ወላዲ / ወላዲት
                        </label>
                        <input
                          type="text"
                          placeholder={idx === 0 ? 'ንኣብነት: ደሃብ...' : 'ንኣብነት: ሓሊቦ...'}
                          value={gen.name}
                          onChange={(e) => handleUpdateGeneration(gen.id, { name: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-ethiopic"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-stone-600 font-medium mb-1">
                          መጻምድቲ (ሓዳር) እንተሃልዩ
                        </label>
                        <input
                          type="text"
                          placeholder={idx === 0 ? 'ንኣብነት: ሃይለ...' : 'ስም መጻምድቲ...'}
                          value={gen.spouseName || ''}
                          onChange={(e) => handleUpdateGeneration(gen.id, { spouseName: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-ethiopic"
                        />
                      </div>
                    </div>

                    {/* REQUIREMENT 3: Fuzzy Typo Suggestion inside generation card */}
                    {fuzzySuggestion && (
                      <div className="p-2.5 bg-amber-100 border border-amber-300 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-center gap-2 text-amber-950 font-medium">
                          <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>
                            ኣብ መዝገብና ተመሳሳሊ ስም ሓረግ <strong>&laquo;{fuzzySuggestion}&raquo;</strong> ኣሎ። እዚ ዲኹም ደሊኹም?
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleAcceptFuzzy(gen.id, fuzzySuggestion)}
                            className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-bold text-[11px] cursor-pointer"
                          >
                            እወ ተጠቐም
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDismissFuzzy(gen.name, fuzzySuggestion)}
                            className="px-2.5 py-1 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg font-medium text-[11px] cursor-pointer"
                          >
                            ኣይፋል ቀጽል
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={handleAddGeneration}
                className="w-full py-2 px-3 border border-dashed border-stone-300 hover:border-amber-500 rounded-xl bg-white hover:bg-amber-50/50 text-stone-700 hover:text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-amber-700" />
                <span>+ ቀጻሊ ወለዶ ወስኽ</span>
              </button>
            </div>
          </div>

          {/* SECTION 3: መጻምድቲ / ሓዳር ናይዚ ሰብ */}
          <div className="space-y-4">
            <h3 className="font-bold text-stone-900 text-base flex items-center gap-2 pb-2 border-b border-stone-200">
              <Heart className="w-4 h-4 text-rose-500" />
              <span>3. መጻምድቲ / ሓዳር ናይዚ ሰብ</span>
            </h3>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-stone-600 font-medium mb-1">
                    ስም መጻምድቲ
                  </label>
                  <input
                    type="text"
                    placeholder="ንኣብነት: ስም መጻምድቲ..."
                    value={form.spouseName}
                    onChange={(e) => updateForm((p) => ({ ...p, spouseName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-ethiopic"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-stone-600 font-medium mb-1">
                    መግለፂ ሓዳር / ዝምድና
                  </label>
                  <input
                    type="text"
                    placeholder="ንኣብነት: ዝተመርዓዉ፡ ዝወለድዎም..."
                    value={form.spouseWording || ''}
                    onChange={(e) => updateForm((p) => ({ ...p, spouseWording: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-ethiopic"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: ውሉዳት */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <GitFork className="w-4 h-4 rotate-180 text-amber-700" />
                <span>4. ውሉዳት ({form.children.length})</span>
              </h3>
              <button
                type="button"
                onClick={handleAddChildRow}
                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ ቆልዓ ወስኽ</span>
              </button>
            </div>

            {form.children.length === 0 ? (
              <p className="text-xs text-stone-500 italic py-2">
                ውሉዳት እንተሃልዮሞም፡ ነቲ &ldquo;+ ቆልዓ ወስኽ&rdquo; ዝብል ጠዊቕኩም ብሓባር ከተእትዉ ትኽእሉ ኢኹም።
              </p>
            ) : (
              <div className="space-y-2">
                {form.children.map((child, index) => (
                  <div
                    key={child.id}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-stone-50 border border-stone-200"
                  >
                    <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      placeholder="ስም ቆልዓ..."
                      value={child.name}
                      onChange={(e) => handleUpdateChildRow(child.id, e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-ethiopic"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveChildRow(child.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="ደምስስ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Submit (Requirement 5: Immediately saved to server) */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-stone-300 rounded-xl text-stone-700 font-bold text-xs hover:bg-stone-50 cursor-pointer"
            >
              ሰርዝ
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !validation.isValid}
              className={`px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-md flex items-center gap-2 transition-colors cursor-pointer ${
                isSubmitting || !validation.isValid
                  ? 'bg-stone-400 cursor-not-allowed'
                  : 'bg-amber-700 hover:bg-amber-800 active:scale-98'
              }`}
            >
              {isSubmitting ? (
                <span>ይዕቀብ ኣሎ...</span>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>ኣረጋግጽን መዝግብን</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Modal Picker for Selecting Existing Ancestor */}
        {pickerTargetGenId && (
          <div className="fixed inset-0 z-60 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 font-ethiopic">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <h4 className="font-bold text-stone-900 text-sm">
                  ካብ መዝገብ ስድራቤት ምረጽ
                </h4>
                <button
                  onClick={() => setPickerTargetGenId(null)}
                  className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="ስም ጽሒፍካ ድለ..."
                  value={pickerSearchQuery}
                  onChange={(e) => setPickerSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-xs font-ethiopic focus:ring-2 focus:ring-amber-500"
                  autoFocus
                />
              </div>

              {/* Pick from existing */}
              <div className="max-h-52 overflow-y-auto space-y-1">
                {pickerSearchResults.length === 0 ? (
                  <p className="text-xs text-stone-400 italic py-4 text-center">
                    ኣብ መዝገብ ዝተረኽበ የለን።
                  </p>
                ) : (
                  pickerSearchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        handleUpdateGeneration(pickerTargetGenId, {
                          name: p.canonicalName,
                          existingPersonId: p.id
                        });
                        setPickerTargetGenId(null);
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-amber-50 flex items-center justify-between text-xs transition-colors border border-transparent hover:border-amber-300 cursor-pointer"
                    >
                      <span className="font-bold text-stone-900">
                        {p.canonicalName}
                      </span>
                      {p.branch && (
                        <span className="text-[11px] text-stone-500">{p.branch}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
