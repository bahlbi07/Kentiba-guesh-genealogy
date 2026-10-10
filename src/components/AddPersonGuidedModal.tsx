import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Person, Relationship } from '../types/genealogy';
import { validateParentChildCycle } from '../services/cycleDetector';
import {
  X,
  User,
  Users,
  Heart,
  Plus,
  Trash2,
  Search,
  CheckCircle,
  AlertTriangle,
  GitFork,
  ArrowUpRight,
  Sparkles,
  Link2
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

interface DraftState {
  canonicalName: string;
  branch: string;
  notes: string;
  // Lineage chain: e.g. [ደሃብ (መጻምድቲ: ሃይለ), ሓሊቦ, ሓጎስ, ዓዶ, ዑመር, ትዕበ]
  lineageChain: LineageGeneration[];
  // Quick text input for lineage
  quickLineageText: string;
  // Direct spouse of this person
  spouseName: string;
  spouseWording: string;
  // Children of this person
  children: Array<{ id: string; name: string; notes?: string }>;
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
  children: []
};

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
        if (parsed.canonicalName || parsed.branch || (parsed.lineageChain && parsed.lineageChain.some((g: any) => g.name))) {
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
        setForm(JSON.parse(saved));
      }
    } catch {
      // Ignore
    }
    setShowDraftRecoveryDialog(false);
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setForm(initialDraft);
    setShowDraftRecoveryDialog(false);
  };

  // Lookup map of existing people
  const peopleMap = useMemo(() => {
    const map = new Map<string, Person>();
    for (const p of people) map.set(p.id, p);
    return map;
  }, [people]);

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

  // Quick chain parser: converts text like "ደሃብ ሓሊቦ ሓጎስ ዓዶ ዑመር ትዕበ" into generations
  const handleApplyQuickChain = () => {
    const raw = form.quickLineageText.trim();
    if (!raw) return;

    // Split by comma, arrow, or spaces
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

  // Comprehensive Submission Handler: Saves person, multi-generational ancestral chain, spouses, and children
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const now = new Date().toISOString();

    try {
      // 1. Create ID for Main Person
      const mainPersonId = `pers_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      // 2. Process Ancestral Chain (from generation 1 up to top generation)
      // Filter out empty generation entries
      const validGenerations = form.lineageChain.filter((g) => g.name.trim().length > 0);

      const createdAncestorIds: string[] = [];

      for (let i = 0; i < validGenerations.length; i++) {
        const gen = validGenerations[i];
        const trimmedGenName = gen.name.trim();

        // Check if ancestor exists in the database
        let ancestorId: string;
        const existingPerson = people.find(
          (p) =>
            p.canonicalName.trim().toLowerCase() === trimmedGenName.toLowerCase() &&
            (!form.branch || !p.branch || p.branch.trim() === form.branch.trim())
        );

        if (existingPerson) {
          ancestorId = existingPerson.id;
        } else {
          ancestorId = `pers_${Date.now()}_anc_${i}_${Math.random().toString(36).substring(2, 5)}`;
          await onSavePerson({
            id: ancestorId,
            canonicalName: trimmedGenName,
            branch: form.branch || undefined,
            status: 'verified',
            isArchived: false,
            notes: `ወለዶ ስድራቤት: ${form.canonicalName}`,
            createdAt: now,
            updatedAt: now
          });
        }

        createdAncestorIds.push(ancestorId);

        // If this generation has a spouse specified (e.g. ወላዲተይ ደሃብ መጻምድታ ሃይለ)
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
            await onSavePerson({
              id: genSpouseId,
              canonicalName: trimmedSpouseName,
              branch: form.branch || undefined,
              status: 'verified',
              isArchived: false,
              notes: `መጻምድቲ ${trimmedGenName}`,
              createdAt: now,
              updatedAt: now
            });
          }

          // Link ancestor to their spouse
          await onSaveRelationship({
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
            updatedAt: now
          });
        }
      }

      // Link Ancestral Chain Steps to one another (parent -> child)
      for (let i = 0; i < createdAncestorIds.length - 1; i++) {
        const childGenId = createdAncestorIds[i];
        const parentGenId = createdAncestorIds[i + 1];

        const cycleCheck = validateParentChildCycle(relationships, parentGenId, childGenId);
        if (cycleCheck.isValid) {
          await onSaveRelationship({
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
            updatedAt: now
          });
        }
      }

      // If top ancestor matches an official branch, link to root patriarch
      if (createdAncestorIds.length > 0 && rootPatriarch) {
        const topAncestorId = createdAncestorIds[createdAncestorIds.length - 1];
        const topGenName = validGenerations[validGenerations.length - 1].name.trim();

        // Check if top ancestor is one of the 10 branches
        const isBranchTop = OFFICIAL_BRANCHES.some((b) => topGenName.includes(b));
        if (isBranchTop && topAncestorId !== rootPatriarch.id) {
          const cycleCheck = validateParentChildCycle(relationships, rootPatriarch.id, topAncestorId);
          if (cycleCheck.isValid) {
            await onSaveRelationship({
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
              updatedAt: now
            });
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
        notes: form.notes.trim() || undefined,
        createdAt: now,
        updatedAt: now
      };
      await onSavePerson(mainPerson);

      // Link main person to immediate parent (generation 1)
      if (immediateParentId) {
        const cycleCheck = validateParentChildCycle(relationships, immediateParentId, mainPersonId);
        if (cycleCheck.isValid) {
          await onSaveRelationship({
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
          });
        }
      }

      // 4. Save Main Person's Spouse
      if (form.spouseName.trim()) {
        const trimmedSpouse = form.spouseName.trim();
        const spouseId = `pers_${Date.now()}_main_sp_${Math.random().toString(36).substring(2, 5)}`;
        await onSavePerson({
          id: spouseId,
          canonicalName: trimmedSpouse,
          branch: form.branch || undefined,
          status: 'verified',
          isArchived: false,
          notes: `መጻምድቲ ${form.canonicalName}`,
          createdAt: now,
          updatedAt: now
        });

        await onSaveRelationship({
          id: `rel_${Date.now()}_main_sp_rel`,
          fromPersonId: mainPersonId,
          toPersonId: spouseId,
          type: 'partner_or_union',
          status: 'verified',
          sourceFile: 'ከሰተ-ብርሃነ.pdf',
          sourcePage: null,
          sourceWording: form.spouseWording.trim() || `${form.canonicalName} ዝተመርዓዉ ምስ ${trimmedSpouse}`,
          isBiologicalConfirmed: false,
          createdAt: now,
          updatedAt: now
        });
      }

      // 5. Save Children
      for (const child of form.children) {
        if (!child.name.trim()) continue;
        const childId = `pers_${Date.now()}_c_${Math.random().toString(36).substring(2, 5)}`;
        await onSavePerson({
          id: childId,
          canonicalName: child.name.trim(),
          branch: form.branch || undefined,
          fatherName: form.canonicalName.trim(),
          status: 'verified',
          isArchived: false,
          notes: child.notes?.trim() || undefined,
          createdAt: now,
          updatedAt: now
        });

        await onSaveRelationship({
          id: `rel_${Date.now()}_c_${childId}`,
          fromPersonId: mainPersonId,
          toPersonId: childId,
          type: 'parent_child',
          status: 'verified',
          sourceFile: 'ከሰተ-ብርሃነ.pdf',
          sourcePage: null,
          sourceWording: `${child.name.trim()} ወዲ/ጓል ${form.canonicalName.trim()}`,
          isBiologicalConfirmed: true,
          createdAt: now,
          updatedAt: now
        });
      }

      // 6. Clean draft and reload
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

          {/* SECTION 1: ውልቃዊ ሓበሬታ */}
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
                  onChange={(e) => updateForm((p) => ({ ...p, branch: e.target.value }))}
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

            {/* Quick Chain Paste / Type Box */}
            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
              <span className="text-xs font-bold text-amber-950 block">
                ፈጣን ሰንሰለት ምእታው (ብቐሊሉ ብመስርዕ ጽሓፍ):
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ንኣብነት: ደሃብ ሓሊቦ ሓጎስ ዓዶ ዑመር ትዕበ"
                  value={form.quickLineageText}
                  onChange={(e) => updateForm((p) => ({ ...p, quickLineageText: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-ethiopic focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleApplyQuickChain}
                  disabled={!form.quickLineageText.trim()}
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  ሰንሰለት ዘርግሕ
                </button>
              </div>
              <p className="text-[11px] text-amber-800">
                ኣስማት ወለዶ ብህዋኽ እንተጸሒፍኩምዎ፡ ብቐጥታ ናብቶም ዝስዕቡ ደረጃታት ክዝርግሖ እዩ።
              </p>
            </div>

            {/* Generational Steps */}
            <div className="space-y-3">
              {form.lineageChain.map((gen, idx) => (
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
                </div>
              ))}

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
                    መግለጺ ሓዳር / ዝምድና
                  </label>
                  <input
                    type="text"
                    placeholder="ንኣብነት: ዝተመርዓዉ፡ ዝወለድዎም..."
                    value={form.spouseWording}
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

          {/* Footer Submit */}
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
