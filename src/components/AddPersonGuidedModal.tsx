import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Person, Relationship } from '../types/genealogy';
import { validateParentChildCycle } from '../services/cycleDetector';
import { apiSaveBatch } from '../services/apiClient';
import { syncNewBatchToGoogleSheets } from '../services/googleSheetsService';
import { parseRelationshipPhrase } from '../services/importParser';
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
  'ይሕደጎ',
  'ብስራት',
  'ትዕበ',
  'በርሀ',
  'መድህን',
  'ግብፂት',
  'ተፈሪ'
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

export interface SpouseEntry {
  id: string;
  spouseName: string;
  spouseWording?: string;
  children: Array<{ id: string; name: string; notes?: string }>;
}

export interface DraftState {
  canonicalName: string;
  branch: string;
  customBranch?: string;
  notes: string;
  // Lineage chain from immediate parent up to branch root
  lineageChain: LineageGeneration[];
  // Quick text input for lineage
  quickLineageText: string;
  // Multiple spouses with their respective children
  spouses: SpouseEntry[];
  // Direct spouse of this person (kept in sync for backward compatibility)
  spouseName: string;
  spouseWording?: string;
  // Children of this person (combined across spouses for backward compatibility)
  children: Array<{ id: string; name: string; notes?: string }>;
  // Cascading hierarchy steps under branch
  cascadeSteps?: CascadeStep[];
}

const initialDraft: DraftState = {
  canonicalName: '',
  branch: '',
  customBranch: '',
  notes: '',
  lineageChain: [
    { id: 'gen_1', name: '', parentType: 'mother', spouseName: '' }
  ],
  quickLineageText: '',
  spouses: [
    {
      id: 'sp_1',
      spouseName: '',
      spouseWording: '',
      children: [],
    },
  ],
  spouseName: '',
  spouseWording: '',
  children: [],
  cascadeSteps: [],
};

/**
 * Sanitizes candidate spouse names and strictly rejects narrative phrases.
 * Any string containing 'ኣትያ', 'ዝወለደቶም', 'ድማ', backticks, etc., is rejected and returns ''.
 */
export function cleanCandidateSpouseName(raw?: string | null): string {
  if (!raw) return '';
  let clean = raw.trim().replace(/[`'"፡,:;`]/g, '').trim();

  // If candidate contains narrative keywords, it is a statement, not a person name!
  const narrativeKeywords = [
    'ኣትያ', 'ኣትዩ', 'ተኣትያ', 'ዝወለደ', 'ዝወለደት', 'ዝወለዱ', 'ዝወለዶም', 'ዝወለደቶም', 'ወሊዳ',
    'ድማ', 'source', 'relationship', 'page', 'recorded', 'pdf', 'ስድራ', 'ሓዳር'
  ];
  for (const kw of narrativeKeywords) {
    if (clean.toLowerCase().includes(kw.toLowerCase())) {
      return ''; // Reject narrative phrases completely!
    }
  }

  // Reject cut-off fragments like "ጉን ኮኾባይ..."
  if (/^ጉን\s+/i.test(clean)) {
    return '';
  }

  // Strip prefixes like "ናብ", "ምስ", "ን" (only if standalone prefix)
  clean = clean.replace(/^(?:ናብ|ምስ|ን)\s+/, '').trim();

  // A name shouldn't be overly long or multiple sentences
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 5 || clean.length > 40) {
    return '';
  }

  return clean;
}

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

export interface AddPersonGuidedModalProps {
  people: Person[];
  relationships: Relationship[];
  onClose: () => void;
  onSaveBatch?: (people: Person[], relationships: Relationship[]) => Promise<void>;
  onSavePerson?: (person: Person) => Promise<void>;
  onSaveRelationship?: (rel: Relationship) => Promise<{ success: boolean; error?: string }>;
  onComplete?: () => Promise<void> | void;
}

export const AddPersonGuidedModal: React.FC<AddPersonGuidedModalProps> = ({
  people,
  relationships,
  onClose,
  onSaveBatch,
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
        if (parsed.spouseName) {
          parsed.spouseName = cleanCandidateSpouseName(parsed.spouseName);
        }
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
        if (parsed.spouseName) {
          parsed.spouseName = cleanCandidateSpouseName(parsed.spouseName);
        }
        if (parsed.lineageChain && Array.isArray(parsed.lineageChain)) {
          parsed.lineageChain = parsed.lineageChain.map((g: any) => ({
            ...g,
            spouseName: cleanCandidateSpouseName(g.spouseName),
          }));
        }
        if (parsed.cascadeSteps && parsed.cascadeSteps.length > 0) {
          parsed.cascadeSteps = parsed.cascadeSteps.map((s: any) => ({
            ...s,
            spouseName: cleanCandidateSpouseName(s.spouseName),
          }));
          setCascadeSteps(parsed.cascadeSteps);
        }
        if (parsed.spouses && Array.isArray(parsed.spouses) && parsed.spouses.length > 0) {
          parsed.spouses = parsed.spouses.map((s: any, idx: number) => ({
            id: s.id || `sp_${Date.now()}_${idx}`,
            spouseName: cleanCandidateSpouseName(s.spouseName),
            spouseWording: s.spouseWording || '',
            children: Array.isArray(s.children) ? s.children : [],
          }));
        } else {
          parsed.spouses = [
            {
              id: 'sp_init_1',
              spouseName: cleanCandidateSpouseName(parsed.spouseName),
              spouseWording: parsed.spouseWording || '',
              children: Array.isArray(parsed.children) ? parsed.children : [],
            },
          ];
        }
        parsed.spouseName = parsed.spouses[0]?.spouseName || '';
        parsed.spouseWording = parsed.spouses[0]?.spouseWording || '';
        parsed.children = parsed.spouses.flatMap((s: any) => s.children);
        setForm(parsed);
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

  // Strictly the 12 official branches of Patriarch Kinteba Guush
  const availableBranches = useMemo(() => {
    return OFFICIAL_BRANCHES;
  }, []);

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

  // Helper to get registered children of a person from database STRICTLY by personId (never by global name match)
  const getChildrenForPerson = useCallback(
    (personId?: string, personName?: string): Person[] => {
      let resolvedId = personId;
      if (!resolvedId && personName && OFFICIAL_BRANCHES.includes(personName.trim())) {
        resolvedId = getBranchRootPerson(personName.trim())?.id;
      }
      if (!resolvedId) return [];

      const foundMap = new Map<string, Person>();
      for (const rel of relationships) {
        if (rel.type === 'parent_child' && rel.fromPersonId === resolvedId) {
          const child = people.find((p) => p.id === rel.toPersonId && !p.isArchived);
          if (child) foundMap.set(child.id, child);
        }
      }

      return Array.from(foundMap.values());
    },
    [people, relationships, getBranchRootPerson]
  );

  // Helper to retrieve auto-detected or registered spouse for an ancestor/person
  const getSpouseForPerson = useCallback(
    (personId?: string | null, personName?: string): { spouseName: string; spouseId?: string; source: string } | null => {
      if (!personId && !personName) return null;

      // 1. If personId is provided, look up by ID
      let targetPerson: Person | undefined;
      if (personId) {
        targetPerson = people.find((p) => p.id === personId && !p.isArchived);
      }

      // 2. If not found by ID, ONLY look up by canonicalName if it is an official branch root or has a single unambiguous match
      const cleanName = (personName || targetPerson?.canonicalName || '').trim();
      if (!targetPerson && cleanName) {
        if (OFFICIAL_BRANCHES.includes(cleanName)) {
          targetPerson = getBranchRootPerson(cleanName) || undefined;
        } else {
          const cleanLower = cleanName.toLowerCase();
          const matches = people.filter(
            (p) => !p.isArchived && p.canonicalName.trim().toLowerCase() === cleanLower
          );
          if (matches.length === 1) {
            targetPerson = matches[0];
          }
        }
      }

      if (!targetPerson) return null;

      // 3. Search relationships for partner_or_union linked to targetPerson.id
      for (const rel of relationships) {
        if (rel.type === 'partner_or_union') {
          if (rel.fromPersonId === targetPerson.id || rel.toPersonId === targetPerson.id) {
            const otherId = rel.fromPersonId === targetPerson.id ? rel.toPersonId : rel.fromPersonId;
            const spouse = people.find((p) => p.id === otherId && !p.isArchived);
            if (spouse && spouse.canonicalName.trim()) {
              const cleaned = cleanCandidateSpouseName(spouse.canonicalName);
              if (cleaned) {
                return {
                  spouseName: cleaned,
                  spouseId: spouse.id,
                  source: 'relationship',
                };
              }
            }
          }
        }
      }

      // 4. Search by targetPerson's spouseNote or notes
      if (targetPerson.spouseNote) {
        const parsed = parseRelationshipPhrase(targetPerson.spouseNote);
        const cleanPartner = cleanCandidateSpouseName(parsed.partnerName);
        if (cleanPartner) {
          return {
            spouseName: cleanPartner,
            source: 'spouseNote',
          };
        }
        const noteMatch = targetPerson.spouseNote.match(/(?:^|\s)(?:መጻምድቲ|ምስ|ካብ)\s*[:፡]?\s*([^\n,፡]+)/);
        if (noteMatch) {
          const cleanMatch = cleanCandidateSpouseName(noteMatch[1]);
          if (cleanMatch) {
            return {
              spouseName: cleanMatch,
              source: 'spouseNote_regex',
            };
          }
        }
      }

      if (targetPerson.notes) {
        const backtickMatch = targetPerson.notes.match(/`([^`]+)`/);
        if (backtickMatch) {
          const parsed = parseRelationshipPhrase(backtickMatch[1]);
          const cleanPartner = cleanCandidateSpouseName(parsed.partnerName);
          if (cleanPartner) {
            return {
              spouseName: cleanPartner,
              source: 'notes_backtick',
            };
          }
        }
        const noteMatch = targetPerson.notes.match(/(?:^|\s)መጻምድቲ\s*[:፡]?\s*([^\n,፡]+)/);
        if (noteMatch) {
          const cleanMatch = cleanCandidateSpouseName(noteMatch[1]);
          if (cleanMatch) {
            return {
              spouseName: cleanMatch,
              source: 'notes_regex',
            };
          }
        }
      }

      // 5. Look ONLY at actual direct children of targetPerson.id where co-parent is recorded
      const directChildren = getChildrenForPerson(targetPerson.id);
      for (const p of directChildren) {
        if (p.fatherName && p.fatherName.trim().toLowerCase() === targetPerson.canonicalName.trim().toLowerCase()) {
          if (p.motherName && p.motherName.trim()) {
            const cleanMom = cleanCandidateSpouseName(p.motherName);
            if (cleanMom) {
              return {
                spouseName: cleanMom,
                source: 'child_mother',
              };
            }
          }
        }
        if (p.motherName && p.motherName.trim().toLowerCase() === targetPerson.canonicalName.trim().toLowerCase()) {
          if (p.fatherName && p.fatherName.trim()) {
            const cleanDad = cleanCandidateSpouseName(p.fatherName);
            if (cleanDad) {
              return {
                spouseName: cleanDad,
                source: 'child_father',
              };
            }
          }
        }
      }

      return null;
    },
    [people, relationships, getBranchRootPerson, getChildrenForPerson]
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
        let spouse = s.spouseName?.trim() || '';
        if (!spouse && s.selectedPersonId) {
          const sp = getSpouseForPerson(s.selectedPersonId, s.name);
          if (sp?.spouseName) spouse = sp.spouseName;
        }
        chain.push({
          id: `gen_casc_${i}_${s.name.trim()}`,
          name: s.name.trim(),
          parentType: i === validSteps.length - 1 ? 'mother' : 'father',
          spouseName: spouse,
          existingPersonId: s.selectedPersonId || null,
        });
      }

      // Add branch anchor at top of chain
      if (branchName && !chain.some((g) => g.name.trim() === branchName.trim())) {
        const rootPerson = getBranchRootPerson(branchName);
        const rootSpouse = getSpouseForPerson(rootPerson?.id, branchName);
        chain.push({
          id: `gen_casc_branch_${branchName}`,
          name: branchName.trim(),
          parentType: 'father',
          spouseName: rootSpouse?.spouseName || '',
          existingPersonId: rootPerson?.id || null,
        });
      }

      updateForm((prev) => ({
        ...prev,
        lineageChain: chain,
        cascadeSteps: steps,
      }));
    },
    [getBranchRootPerson, getSpouseForPerson]
  );

  // When branch is selected
  const handleBranchChange = (newBranch: string) => {
    updateForm((prev) => ({ ...prev, branch: newBranch }));
    if (!newBranch) {
      setCascadeSteps([]);
      return;
    }
    const rootPerson = getBranchRootPerson(newBranch);
    const rootSpouse = getSpouseForPerson(rootPerson?.id, newBranch);
    const initialStep: CascadeStep = {
      id: `step_${Date.now()}_0`,
      parentName: newBranch,
      parentId: rootPerson?.id,
      name: '',
      spouseName: rootSpouse?.spouseName || '',
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

    const spouseInfo = getSpouseForPerson(selectedPerson.id, selectedPerson.canonicalName);

    setCascadeSteps((prev) => {
      const next = prev.slice(0, stepIndex + 1);
      next[stepIndex] = {
        ...next[stepIndex],
        name: selectedPerson.canonicalName,
        selectedPersonId: selectedPerson.id,
        spouseName: spouseInfo?.spouseName || '',
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
      // Match ONLY within the direct children of next[stepIndex].parentId!
      // Never match globally across unrelated branches/parents!
      const matchedChild = trimmed
        ? existingChildren.find(
            (c) => c.canonicalName.trim().toLowerCase() === trimmed.toLowerCase()
          )
        : undefined;

      const spouseInfo = matchedChild
        ? getSpouseForPerson(matchedChild.id, matchedChild.canonicalName)
        : null;

      next[stepIndex] = {
        ...next[stepIndex],
        name,
        selectedPersonId: matchedChild ? matchedChild.id : undefined,
        spouseName: next[stepIndex].spouseName || spouseInfo?.spouseName || '',
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
  const handleRemoveGeneration = (id: string) => {
    updateForm((prev) => ({
      ...prev,
      lineageChain: prev.lineageChain.filter((g) => g.id !== id)
    }));
  };

  const handleUpdateGeneration = (id: string, updates: Partial<LineageGeneration>) => {
    let augmented = { ...updates };
    if (updates.name !== undefined && updates.spouseName === undefined) {
      const trimmed = updates.name.trim();
      if (trimmed) {
        const spouseInfo = getSpouseForPerson(updates.existingPersonId, trimmed);
        if (spouseInfo?.spouseName) {
          augmented.spouseName = spouseInfo.spouseName;
        }
      }
    }
    updateForm((prev) => ({
      ...prev,
      lineageChain: prev.lineageChain.map((g) => (g.id === id ? { ...g, ...augmented } : g))
    }));
  };

  // Auto-detect patronymic & ancestral lineage from full name input
  const handleCanonicalNameChange = (val: string) => {
    updateForm((prev) => {
      const trimmed = val.trim();
      const words = trimmed ? trimmed.split(/\s+/) : [];

      let nextChain = [...prev.lineageChain];
      if (words.length > 1) {
        const ancestorWords = words.slice(1);
        while (nextChain.length < ancestorWords.length) {
          nextChain.push({
            id: `gen_${Date.now()}_${nextChain.length}`,
            name: '',
            parentType: 'father',
            spouseName: '',
          });
        }

        for (let i = 0; i < ancestorWords.length; i++) {
          const ancName = ancestorWords[i];
          const existingSpouse = cleanCandidateSpouseName(nextChain[i]?.spouseName);
          const spouseInfo = getSpouseForPerson(nextChain[i]?.existingPersonId, ancName);
          const detectedSpouse = cleanCandidateSpouseName(spouseInfo?.spouseName);
          nextChain[i] = {
            ...nextChain[i],
            name: ancName,
            spouseName: existingSpouse || detectedSpouse || '',
          };
        }
      }

      return {
        ...prev,
        canonicalName: val,
        lineageChain: nextChain,
      };
    });
  };

  // Multiple Spouses and per-spouse Children management
  const handleAddSpouse = () => {
    updateForm((prev) => {
      const nextSpouses: SpouseEntry[] = [
        ...prev.spouses,
        {
          id: `sp_${Date.now()}_${prev.spouses.length + 1}`,
          spouseName: '',
          spouseWording: '',
          children: [],
        },
      ];
      return {
        ...prev,
        spouses: nextSpouses,
        spouseName: nextSpouses[0]?.spouseName || '',
        children: nextSpouses.flatMap((s) => s.children),
      };
    });
  };

  const handleRemoveSpouse = (spouseId: string) => {
    updateForm((prev) => {
      if (prev.spouses.length <= 1) {
        const resetSpouse: SpouseEntry = {
          id: `sp_${Date.now()}`,
          spouseName: '',
          spouseWording: '',
          children: [],
        };
        return {
          ...prev,
          spouses: [resetSpouse],
          spouseName: '',
          spouseWording: '',
          children: [],
        };
      }
      const nextSpouses = prev.spouses.filter((s) => s.id !== spouseId);
      return {
        ...prev,
        spouses: nextSpouses,
        spouseName: nextSpouses[0]?.spouseName || '',
        spouseWording: nextSpouses[0]?.spouseWording || '',
        children: nextSpouses.flatMap((s) => s.children),
      };
    });
  };

  const handleUpdateSpouse = (spouseId: string, updates: Partial<SpouseEntry>) => {
    updateForm((prev) => {
      const nextSpouses = prev.spouses.map((s) =>
        s.id === spouseId ? { ...s, ...updates } : s
      );
      return {
        ...prev,
        spouses: nextSpouses,
        spouseName: nextSpouses[0]?.spouseName || '',
        spouseWording: nextSpouses[0]?.spouseWording || '',
        children: nextSpouses.flatMap((s) => s.children),
      };
    });
  };

  const handleAddChildToSpouse = (spouseId: string) => {
    updateForm((prev) => {
      const nextSpouses = prev.spouses.map((s) => {
        if (s.id !== spouseId) return s;
        return {
          ...s,
          children: [
            ...s.children,
            { id: `c_${Date.now()}_${s.children.length}`, name: '', notes: '' },
          ],
        };
      });
      return {
        ...prev,
        spouses: nextSpouses,
        children: nextSpouses.flatMap((s) => s.children),
      };
    });
  };

  const handleAddMultipleChildrenToSpouse = (spouseId: string, count = 4) => {
    updateForm((prev) => {
      const nextSpouses = prev.spouses.map((s) => {
        if (s.id !== spouseId) return s;
        const newRows: Array<{ id: string; name: string; notes?: string }> = Array.from(
          { length: count },
          (_, i) => ({
            id: `c_${Date.now()}_${s.children.length + i}`,
            name: '',
            notes: '',
          })
        );
        return {
          ...s,
          children: [...s.children, ...newRows],
        };
      });
      return {
        ...prev,
        spouses: nextSpouses,
        children: nextSpouses.flatMap((s) => s.children),
      };
    });
  };

  const handleUpdateSpouseChild = (spouseId: string, childId: string, name: string) => {
    updateForm((prev) => {
      const nextSpouses = prev.spouses.map((s) => {
        if (s.id !== spouseId) return s;
        return {
          ...s,
          children: s.children.map((c) => (c.id === childId ? { ...c, name } : c)),
        };
      });
      return {
        ...prev,
        spouses: nextSpouses,
        children: nextSpouses.flatMap((s) => s.children),
      };
    });
  };

  const handleRemoveSpouseChild = (spouseId: string, childId: string) => {
    updateForm((prev) => {
      const nextSpouses = prev.spouses.map((s) => {
        if (s.id !== spouseId) return s;
        return {
          ...s,
          children: s.children.filter((c) => c.id !== childId),
        };
      });
      return {
        ...prev,
        spouses: nextSpouses,
        children: nextSpouses.flatMap((s) => s.children),
      };
    });
  };

  // Backwards compatible child row helpers (operating on first spouse)
  const handleAddChildRow = () => {
    if (form.spouses.length > 0) {
      handleAddChildToSpouse(form.spouses[0].id);
    }
  };

  const handleUpdateChildRow = (id: string, name: string) => {
    for (const sp of form.spouses) {
      if (sp.children.some((c) => c.id === id)) {
        handleUpdateSpouseChild(sp.id, id, name);
        return;
      }
    }
  };

  const handleRemoveChildRow = (id: string) => {
    for (const sp of form.spouses) {
      if (sp.children.some((c) => c.id === id)) {
        handleRemoveSpouseChild(sp.id, id);
        return;
      }
    }
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

      const persistPerson = async (p: Person) => {
        createdPeopleBatch.push(p);
        if (!onSaveBatch && onSavePerson) {
          await onSavePerson(p);
        }
      };

      const persistRelationship = async (r: Relationship) => {
        createdRelationshipsBatch.push(r);
        if (!onSaveBatch && onSaveRelationship) {
          await onSaveRelationship(r);
        }
      };

      // 1. Process Ancestral Chain from TOP (branch root) DOWN to generation 0 (immediate parent)
      const validGenerations = form.lineageChain.filter((g) => g.name.trim().length > 0);
      const createdAncestorIds: string[] = new Array(validGenerations.length);

      for (let i = validGenerations.length - 1; i >= 0; i--) {
        const gen = validGenerations[i];
        const trimmedGenName = gen.name.trim();

        let ancestorId: string | null = null;

        // 1. Check by explicit existingPersonId if selected from dropdown or picker
        if (gen.existingPersonId) {
          const matchedById = people.find((p) => p.id === gen.existingPersonId);
          if (matchedById) {
            ancestorId = matchedById.id;
          }
        }

        // 2. If top-most generation is an official branch root, resolve to that branch root person
        if (!ancestorId && i === validGenerations.length - 1) {
          const matchedBranch = OFFICIAL_BRANCHES.find((b) => trimmedGenName === b || trimmedGenName.includes(b));
          if (matchedBranch) {
            const branchRoot = getBranchRootPerson(matchedBranch);
            if (branchRoot) {
              ancestorId = branchRoot.id;
            }
          }
        }

        // 3. Check ONLY if the resolved parent generation already has a direct child with this name
        if (!ancestorId) {
          const parentGenId =
            i < validGenerations.length - 1
              ? createdAncestorIds[i + 1]
              : form.branch && form.branch !== '__custom__'
              ? getBranchRootPerson(form.branch.trim())?.id
              : undefined;

          if (parentGenId) {
            const parentChildren = getChildrenForPerson(parentGenId);
            const childMatch = parentChildren.find(
              (c) => c.canonicalName.trim().toLowerCase() === trimmedGenName.toLowerCase()
            );
            if (childMatch) {
              ancestorId = childMatch.id;
            }
          }
        }

        // NEVER match globally across unrelated branches by canonicalName!
        if (!ancestorId) {
          ancestorId = `pers_${Date.now()}_anc_${i}_${Math.random().toString(36).substring(2, 7)}`;
          const newAncestor: Person = {
            id: ancestorId,
            canonicalName: trimmedGenName,
            branch: form.branch && form.branch !== '__custom__' ? form.branch : undefined,
            status: 'verified',
            isArchived: false,
            notes: `ወለዶ ስድራቤት: ${form.canonicalName}`,
            spouseNote: gen.spouseName?.trim() ? `መጻምድቲ: ${gen.spouseName.trim()}` : undefined,
            createdAt: now,
            updatedAt: now,
          };
          await persistPerson(newAncestor);
        }

        createdAncestorIds[i] = ancestorId;

        // If this generation has a spouse specified, only reuse if already linked to this specific ancestorId
        if (gen.spouseName && gen.spouseName.trim()) {
          const trimmedSpouseName = gen.spouseName.trim();
          const existingLinkedSpouseRel = relationships.find(
            (r) =>
              r.type === 'partner_or_union' &&
              (r.fromPersonId === ancestorId || r.toPersonId === ancestorId)
          );
          let genSpouseId: string | null = null;
          if (existingLinkedSpouseRel) {
            const otherId =
              existingLinkedSpouseRel.fromPersonId === ancestorId
                ? existingLinkedSpouseRel.toPersonId
                : existingLinkedSpouseRel.fromPersonId;
            const otherPerson = people.find((p) => p.id === otherId);
            if (
              otherPerson &&
              otherPerson.canonicalName.trim().toLowerCase() === trimmedSpouseName.toLowerCase()
            ) {
              genSpouseId = otherPerson.id;
            }
          }

          if (!genSpouseId) {
            genSpouseId = `pers_${Date.now()}_sp_${i}_${Math.random().toString(36).substring(2, 7)}`;
            const newSpouse: Person = {
              id: genSpouseId,
              canonicalName: trimmedSpouseName,
              branch: form.branch && form.branch !== '__custom__' ? form.branch : undefined,
              status: 'verified',
              isArchived: false,
              notes: `መጻምድቲ ${trimmedGenName}`,
              spouseNote: `መጻምድቲ: ${trimmedGenName}`,
              createdAt: now,
              updatedAt: now,
            };
            await persistPerson(newSpouse);
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
              id: `rel_${Date.now()}_sp_${i}_${Math.random().toString(36).substring(2, 7)}`,
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
            await persistRelationship(spouseRel);
          }

          // Permanently record spouseNote on the ancestor person record
          const matchedAncestor = people.find((p) => p.id === ancestorId);
          if (matchedAncestor) {
            const updatedAncestor: Person = {
              ...matchedAncestor,
              spouseNote: `መጻምድቲ: ${trimmedSpouseName}`,
              updatedAt: now,
            };
            await persistPerson(updatedAncestor);
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
              id: `rel_${Date.now()}_chain_${i}_${Math.random().toString(36).substring(2, 7)}`,
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
            await persistRelationship(chainRel);
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
                sourceWording: `${topGenName} ወዲ ከንቲባ ጉዕሽ ሓጎስ`,
                isBiologicalConfirmed: true,
                createdAt: now,
                updatedAt: now,
              };
              await persistRelationship(rootRel);
            }
          }
        }
      }

      // 2. Resolve Immediate Parent and Main Person ID
      const branchRootFallback =
        validGenerations.length === 0 && form.branch && form.branch !== '__custom__'
          ? getBranchRootPerson(form.branch.trim())
          : null;

      const immediateParentId =
        createdAncestorIds.length > 0
          ? createdAncestorIds[0]
          : branchRootFallback?.id;
      const immediateParentName =
        validGenerations.length > 0
          ? validGenerations[0].name
          : branchRootFallback?.canonicalName;

      // Check ONLY if immediateParentId ALREADY has a direct child with this exact name (e.g. "ደሃብ" under "ሓሊቦ").
      // If yes, reuse that child's record to prevent duplicating an existing child under the same parent.
      // Otherwise, ALWAYS generate a brand-new unique ID so same-named people in different branches are never merged!
      const existingChildUnderSameParent = immediateParentId
        ? getChildrenForPerson(immediateParentId).find(
            (c) => c.canonicalName.trim().toLowerCase() === form.canonicalName.trim().toLowerCase()
          )
        : undefined;

      const mainPersonId = existingChildUnderSameParent
        ? existingChildUnderSameParent.id
        : `pers_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const spouseNoteSummary =
        form.spouses
          .filter((s) => s.spouseName.trim())
          .map((s) => s.spouseName.trim())
          .join('፣ ') || undefined;

      const mainPerson: Person = existingChildUnderSameParent
        ? {
            ...existingChildUnderSameParent,
            notes: form.notes?.trim() || existingChildUnderSameParent.notes,
            spouseNote: spouseNoteSummary || existingChildUnderSameParent.spouseNote,
            updatedAt: now,
          }
        : {
            id: mainPersonId,
            canonicalName: form.canonicalName.trim(),
            branch:
              (form.branch && form.branch !== '__custom__' ? form.branch.trim() : undefined) ||
              (validGenerations.length > 0 ? validGenerations[validGenerations.length - 1].name : undefined),
            fatherName: immediateParentName,
            status: 'verified',
            isArchived: false,
            notes: form.notes?.trim() || undefined,
            spouseNote: spouseNoteSummary,
            createdAt: now,
            updatedAt: now,
          };
      await persistPerson(mainPerson);

      // Link main person to immediate parent (generation 1) if not already linked
      if (immediateParentId) {
        const alreadyMainParentLinked =
          relationships.some(
            (r) =>
              r.type === 'parent_child' &&
              r.fromPersonId === immediateParentId &&
              r.toPersonId === mainPersonId
          ) ||
          createdRelationshipsBatch.some(
            (r) =>
              r.type === 'parent_child' &&
              r.fromPersonId === immediateParentId &&
              r.toPersonId === mainPersonId
          );

        if (!alreadyMainParentLinked) {
          const cycleCheck = validateParentChildCycle(relationships, immediateParentId, mainPersonId);
          if (cycleCheck.isValid) {
            const mainParentRel: Relationship = {
              id: `rel_${Date.now()}_main_parent_${Math.random().toString(36).substring(2, 7)}`,
              fromPersonId: immediateParentId,
              toPersonId: mainPersonId,
              type: 'parent_child',
              status: 'verified',
              sourceFile: 'ከሰተ-ብርሃነ.pdf',
              sourcePage: null,
              sourceWording: `${form.canonicalName} ወዲ/ጓል ${immediateParentName}`,
              isBiologicalConfirmed: true,
              createdAt: now,
              updatedAt: now,
            };
            await persistRelationship(mainParentRel);
          }
        }
      }

      // 3. Save Main Person's Multiple Spouses and their respective Children
      const existingMainChildren = getChildrenForPerson(mainPersonId);

      for (let sIdx = 0; sIdx < form.spouses.length; sIdx++) {
        const spouseEntry = form.spouses[sIdx];
        const trimmedSpouse = spouseEntry.spouseName?.trim();
        let spouseId: string | null = null;

        if (trimmedSpouse) {
          // Reuse spouse ONLY if already linked to this specific mainPersonId
          let existingSpouseForMain: Person | undefined;
          for (const r of relationships) {
            if (
              r.type === 'partner_or_union' &&
              (r.fromPersonId === mainPersonId || r.toPersonId === mainPersonId)
            ) {
              const otherId = r.fromPersonId === mainPersonId ? r.toPersonId : r.fromPersonId;
              const candidate = people.find((p) => p.id === otherId);
              if (
                candidate &&
                candidate.canonicalName.trim().toLowerCase() === trimmedSpouse.toLowerCase()
              ) {
                existingSpouseForMain = candidate;
                break;
              }
            }
          }

          if (existingSpouseForMain) {
            spouseId = existingSpouseForMain.id;
          } else {
            spouseId = `pers_${Date.now()}_main_sp_${sIdx}_${Math.random().toString(36).substring(2, 7)}`;
            const spousePerson: Person = {
              id: spouseId,
              canonicalName: trimmedSpouse,
              branch: form.branch && form.branch !== '__custom__' ? form.branch : undefined,
              status: 'verified',
              isArchived: false,
              notes: `መጻምድቲ ${form.canonicalName}`,
              spouseNote: `መጻምድቲ: ${form.canonicalName.trim()}`,
              createdAt: now,
              updatedAt: now,
            };
            await persistPerson(spousePerson);
          }

          const alreadyLinkedSpouse =
            relationships.some(
              (r) =>
                r.type === 'partner_or_union' &&
                ((r.fromPersonId === mainPersonId && r.toPersonId === spouseId) ||
                  (r.fromPersonId === spouseId && r.toPersonId === mainPersonId))
            ) ||
            createdRelationshipsBatch.some(
              (r) =>
                r.type === 'partner_or_union' &&
                ((r.fromPersonId === mainPersonId && r.toPersonId === spouseId) ||
                  (r.fromPersonId === spouseId && r.toPersonId === mainPersonId))
            );

          if (!alreadyLinkedSpouse) {
            const mainSpouseRel: Relationship = {
              id: `rel_${Date.now()}_main_sp_${sIdx}_rel_${Math.random().toString(36).substring(2, 7)}`,
              fromPersonId: mainPersonId,
              toPersonId: spouseId,
              type: 'partner_or_union',
              status: 'verified',
              sourceFile: 'ከሰተ-ብርሃነ.pdf',
              sourcePage: null,
              sourceWording:
                spouseEntry.spouseWording?.trim() ||
                `${form.canonicalName} ዝተመርዓዉ ምስ ${trimmedSpouse}`,
              isBiologicalConfirmed: false,
              createdAt: now,
              updatedAt: now,
            };
            await persistRelationship(mainSpouseRel);
          }
        }

        // Save Children of this Spouse (strictly scoped to mainPersonId)
        for (let cIdx = 0; cIdx < spouseEntry.children.length; cIdx++) {
          const child = spouseEntry.children[cIdx];
          if (!child.name.trim()) continue;
          const trimmedChildName = child.name.trim();

          // Reuse child ONLY if already a direct child of this exact mainPersonId
          const existingChild = existingMainChildren.find(
            (c) => c.canonicalName.trim().toLowerCase() === trimmedChildName.toLowerCase()
          );

          let childId: string;
          if (existingChild) {
            childId = existingChild.id;
          } else {
            childId = `pers_${Date.now()}_c_${sIdx}_${cIdx}_${Math.random().toString(36).substring(2, 7)}`;
            const childPerson: Person = {
              id: childId,
              canonicalName: trimmedChildName,
              branch: form.branch && form.branch !== '__custom__' ? form.branch : undefined,
              fatherName: form.canonicalName.trim(),
              motherName: trimmedSpouse || undefined,
              status: 'verified',
              isArchived: false,
              notes: child.notes?.trim() || undefined,
              createdAt: now,
              updatedAt: now,
            };
            await persistPerson(childPerson);
          }

          // Link to Main Person
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
              id: `rel_${Date.now()}_c_${sIdx}_${cIdx}_${childId}`,
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
            await persistRelationship(childRel);
          }

          // Link to Spouse if spouseId is available
          if (spouseId) {
            const alreadySpouseChildLinked =
              relationships.some(
                (r) =>
                  r.type === 'parent_child' &&
                  r.fromPersonId === spouseId &&
                  r.toPersonId === childId
              ) ||
              createdRelationshipsBatch.some(
                (r) =>
                  r.type === 'parent_child' &&
                  r.fromPersonId === spouseId &&
                  r.toPersonId === childId
              );

            if (!alreadySpouseChildLinked) {
              const spouseChildRel: Relationship = {
                id: `rel_${Date.now()}_sp_c_${childId}`,
                fromPersonId: spouseId,
                toPersonId: childId,
                type: 'parent_child',
                status: 'verified',
                sourceFile: 'ከሰተ-ብርሃነ.pdf',
                sourcePage: null,
                sourceWording: `${trimmedChildName} ወዲ/ጓል ${trimmedSpouse}`,
                isBiologicalConfirmed: true,
                createdAt: now,
                updatedAt: now,
              };
              await persistRelationship(spouseChildRel);
            }
          }
        }
      }

      // 5. Fast Atomic Batch Commit or Complete Callback
      if (onSaveBatch) {
        await onSaveBatch(createdPeopleBatch, createdRelationshipsBatch);
      } else if (onComplete) {
        await onComplete();
      }

      // 6. Clean draft, close modal immediately (< 20ms!)
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      onClose();

      // 7. Non-blocking background synchronization with server backend & Google Sheets
      try {
        const token = sessionStorage.getItem('kinteba_admin_token') || 'official-admin-session-token';
        apiSaveBatch(createdPeopleBatch, createdRelationshipsBatch, token).catch((syncErr) => {
          console.warn('Background server sync note:', syncErr);
        });
        syncNewBatchToGoogleSheets(
          createdPeopleBatch,
          createdRelationshipsBatch,
          people,
          relationships
        ).catch((syncErr) => {
          console.warn('Google Sheets batch sync note:', syncErr);
        });
      } catch (syncErr) {
        console.warn('Server batch synchronization note:', syncErr);
      }
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
                  onChange={(e) => handleCanonicalNameChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:ring-2 focus:ring-amber-500 font-ethiopic"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  ጨንፈር / ሓረግ
                </label>
                <select
                  value={availableBranches.includes(form.branch) ? form.branch : (form.branch ? '__custom__' : '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__custom__') {
                      updateForm((prev) => ({
                        ...prev,
                        branch: '__custom__',
                        customBranch: prev.customBranch || '',
                      }));
                    } else {
                      updateForm((prev) => ({ ...prev, customBranch: '' }));
                      handleBranchChange(val);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:ring-2 focus:ring-amber-500 font-ethiopic cursor-pointer"
                >
                  <option value="">ጨንፈር ምረጽ...</option>
                  {availableBranches.map((b) => (
                    <option key={b} value={b}>
                      ሓረግ {b}
                    </option>
                  ))}
                  <option value="__custom__">+ ካሊእ ሓድሽ ጨንፈር ጽሓፍ... (ስም ኣእቱ)</option>
                </select>

                {(form.branch === '__custom__' || (form.customBranch !== undefined && form.customBranch !== '')) && (
                  <div className="mt-2.5 space-y-1">
                    <label className="block text-[11px] font-bold text-amber-900">
                      ስም ሓድሽ ጨንፈር ብኢድካ ኣእቱ፦
                    </label>
                    <input
                      type="text"
                      placeholder="ስም ሓድሽ ጨንፈር ጽሓፍ (ንኣብነት: ስም ጨንፈር)..."
                      value={form.customBranch || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateForm((prev) => ({
                          ...prev,
                          customBranch: val,
                          branch: val.trim() || '__custom__',
                        }));
                      }}
                      className="w-full px-3.5 py-2 rounded-xl border border-amber-400 bg-amber-50/60 text-stone-900 text-xs font-ethiopic focus:ring-2 focus:ring-amber-500"
                      autoFocus
                    />
                  </div>
                )}
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
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[11px] text-stone-600 font-medium">
                                    መጻምድቲ (ሓዳር) እንተሃልዩ
                                  </label>
                                  {(() => {
                                    const recorded = getSpouseForPerson(step.selectedPersonId, step.name);
                                    const isAutoMatched =
                                      Boolean(recorded && step.spouseName && recorded.spouseName.trim().toLowerCase() === step.spouseName.trim().toLowerCase());
                                    return isAutoMatched ? (
                                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-medium inline-flex items-center gap-1 shadow-2xs">
                                        <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                                        ካብ መዝገብ ዝተረኽበ
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
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
                        ከንቲባ ጉዕሽ
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
                  ቅድሚ ኣብዚ ሰንሰለታዊ ወለዶ ብኢድኩም ምጽሓፍኩም፡ እቲ ጨንፈር ወይ መበቆልኩም ካብቶም ኣብ ላዕሊ ኣብ &ldquo;ጨንፈር / ሓረግ&rdquo; ዝተዘርዘሩ {availableBranches.length} ዓበይቲ ጨናፍር ከንቲባ ጉዕሽ ({availableBranches.join('፡ ')}) ዘይተዘርዘረ ምዃኑ ኣረጋግጹ። እቲ ጨንፈር እንተሃልዩ፡ ካብቲ ላዕላይ መምረጺ ብምምራጽ ብቐሊሉ ተዋረድ ክትረኽቡ ትኽእሉ ኢኹም።
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
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] text-stone-600 font-medium">
                            መጻምድቲ (ሓዳር) እንተሃልዩ
                          </label>
                          {(() => {
                            const recorded = getSpouseForPerson(gen.existingPersonId, gen.name);
                            const isAutoMatched =
                              Boolean(recorded && gen.spouseName && recorded.spouseName.trim().toLowerCase() === gen.spouseName.trim().toLowerCase());
                            return isAutoMatched ? (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-medium inline-flex items-center gap-1 shadow-2xs">
                                <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                                ካብ መዝገብ ዝተረኽበ
                              </span>
                            ) : null;
                          })()}
                        </div>
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
            </div>
          </div>

          {/* SECTION 3: መጻምድትን ውሉዳትን */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" />
                <span>
                  3. መጻምድትን ውሉዳትን ({form.spouses.length} መጻምድቲ{form.children.length > 0 ? `፡ ${form.children.length} ውሉዳት` : ''})
                </span>
              </h3>
              <button
                type="button"
                onClick={handleAddSpouse}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ መጻምድቲ ወስኽ</span>
              </button>
            </div>

            <div className="space-y-4">
              {form.spouses.map((spouse, sIdx) => {
                const spouseChildrenCount = spouse.children.length;
                return (
                  <div
                    key={spouse.id}
                    className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3.5 relative transition-all"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-900 font-bold text-[11px] flex items-center justify-center shrink-0">
                          {sIdx + 1}
                        </span>
                        <span className="font-bold text-stone-800 text-xs">
                          {sIdx === 0 ? 'ቀዳማይ መጻምድቲ' : `መጻምድቲ ${sIdx + 1}`}
                          {spouse.spouseName ? ` (${spouse.spouseName})` : ''}
                        </span>
                      </div>
                      {form.spouses.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSpouse(spouse.id)}
                          className="text-[11px] text-stone-400 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                          title="እዚ መጻምድቲ ኣልግስ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>ኣልግስ</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-stone-600 font-medium mb-1">
                          ስም መጻምድቲ
                        </label>
                        <input
                          type="text"
                          placeholder="ንኣብነት: ስም መጻምድቲ..."
                          value={spouse.spouseName}
                          onChange={(e) => handleUpdateSpouse(spouse.id, { spouseName: e.target.value })}
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
                          value={spouse.spouseWording || ''}
                          onChange={(e) => handleUpdateSpouse(spouse.id, { spouseWording: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-ethiopic"
                        />
                      </div>
                    </div>

                    {/* Dedicated Children Section for this specific Spouse */}
                    <div className="p-3 bg-white rounded-xl border border-amber-200/90 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-amber-100">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                          <GitFork className="w-3.5 h-3.5 rotate-180 text-amber-700" />
                          <span>
                            ውሉዳት {spouse.spouseName ? `(ምስ ${spouse.spouseName})` : ''} ({spouseChildrenCount})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAddChildToSpouse(spouse.id)}
                            className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+ ቆልዓ ወስኽ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddMultipleChildrenToSpouse(spouse.id, 4)}
                            className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            title="4 መስመራት ውሉዳት ብሓባር ወስኽ"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+ 4 ውሉዳት</span>
                          </button>
                        </div>
                      </div>

                      {spouse.children.length === 0 ? (
                        <p className="text-[11px] text-stone-500 italic py-1">
                          ውሉዳት {spouse.spouseName ? `ምስ ${spouse.spouseName}` : 'ናይዚ መጻምድቲ'} እንተሃልዮም፡ «+ ቆልዓ ወስኽ» ብምትንካፍ ኣእትዉ።
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {spouse.children.map((child, cIdx) => (
                            <div
                              key={child.id}
                              className="flex items-center gap-2 p-2 rounded-lg bg-amber-50/40 border border-amber-200/70"
                            >
                              <span className="w-5 h-5 rounded-md bg-amber-200 text-amber-900 text-[10px] font-bold flex items-center justify-center shrink-0">
                                {cIdx + 1}
                              </span>
                              <input
                                type="text"
                                placeholder="ስም ቆልዓ..."
                                value={child.name}
                                onChange={(e) => handleUpdateSpouseChild(spouse.id, child.id, e.target.value)}
                                className="flex-1 px-2.5 py-1 rounded-md border border-stone-300 bg-white text-xs font-ethiopic"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveSpouseChild(spouse.id, child.id)}
                                className="p-1 text-stone-400 hover:text-rose-600 rounded cursor-pointer"
                                title="ደምስስ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
                        const spouseInfo = getSpouseForPerson(p.id, p.canonicalName);
                        handleUpdateGeneration(pickerTargetGenId, {
                          name: p.canonicalName,
                          existingPersonId: p.id,
                          spouseName: spouseInfo?.spouseName || '',
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
