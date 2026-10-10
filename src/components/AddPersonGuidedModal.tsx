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
  RotateCcw,
  Sparkles,
  GitFork
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

interface DraftState {
  canonicalName: string;
  branch: string;
  gender: 'male' | 'female' | 'unknown';
  notes: string;
  fatherId: string | null;
  fatherNameCustom: string;
  motherId: string | null;
  motherNameCustom: string;
  spouseId: string | null;
  spouseNameCustom: string;
  spouseWording: string;
  children: Array<{ id: string; name: string; notes?: string }>;
}

const initialDraft: DraftState = {
  canonicalName: '',
  branch: '',
  gender: 'unknown',
  notes: '',
  fatherId: null,
  fatherNameCustom: '',
  motherId: null,
  motherNameCustom: '',
  spouseId: null,
  spouseNameCustom: '',
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

  // Search picker modals
  const [pickerTarget, setPickerTarget] = useState<'father' | 'mother' | 'spouse' | null>(null);
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');
  const [inlineQuickAddName, setInlineQuickAddName] = useState('');

  // Check draft in localStorage on mount
  useEffect(() => {
    if (hasCheckedDraft) return;
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.canonicalName || parsed.branch || (parsed.children && parsed.children.length > 0)) {
          setShowDraftRecoveryDialog(true);
        }
      }
    } catch {
      // Ignore JSON parse errors
    } finally {
      setHasCheckedDraft(true);
    }
  }, [hasCheckedDraft]);

  // Save draft silently on any change
  const saveDraftSilent = useCallback((nextState: DraftState) => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      // Silent fail
    }
  }, []);

  const updateForm = (updater: (prev: DraftState) => DraftState) => {
    setForm((prev) => {
      const next = updater(prev);
      saveDraftSilent(next);
      return next;
    });
  };

  // Restore draft
  const handleResumeDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        setForm(JSON.parse(saved));
      }
    } catch {
      // Fallback
    }
    setShowDraftRecoveryDialog(false);
  };

  // Discard draft
  const handleDiscardDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setForm(initialDraft);
    setShowDraftRecoveryDialog(false);
  };

  // Lookup map
  const peopleMap = useMemo(() => {
    const map = new Map<string, Person>();
    for (const p of people) map.set(p.id, p);
    return map;
  }, [people]);

  // Filtered people for picker
  const pickerSearchResults = useMemo(() => {
    if (!pickerTarget) return [];
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
  }, [pickerTarget, pickerSearchQuery, people]);

  // Validation
  const validation = useMemo(() => {
    if (!form.canonicalName.trim()) {
      return { isValid: false, error: 'ስም ኣባል ምምላእ ግድነት እዩ።' };
    }
    return { isValid: true };
  }, [form.canonicalName]);

  // Add child to batch
  const handleAddChildRow = () => {
    updateForm((prev) => ({
      ...prev,
      children: [
        ...prev.children,
        { id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`, name: '', notes: '' }
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

  // Handle final submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validation.isValid) {
      setSubmitError(validation.error || 'በጃኹም ዝጎደለ ሓበሬታ ምልኡ።');
      return;
    }

    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      const mainPersonId = `pers_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      // 1. Determine or create father
      let effectiveFatherId = form.fatherId;
      if (!effectiveFatherId && form.fatherNameCustom.trim()) {
        effectiveFatherId = `pers_${Date.now()}_f_${Math.random().toString(36).substring(2, 5)}`;
        await onSavePerson({
          id: effectiveFatherId,
          canonicalName: form.fatherNameCustom.trim(),
          branch: form.branch || undefined,
          status: 'verified',
          isArchived: false,
          notes: 'ብኢድ ዝተመዝገበ ወላዲ ኣቦ',
          createdAt: now,
          updatedAt: now
        });
      }

      // 2. Determine or create mother
      let effectiveMotherId = form.motherId;
      if (!effectiveMotherId && form.motherNameCustom.trim()) {
        effectiveMotherId = `pers_${Date.now()}_m_${Math.random().toString(36).substring(2, 5)}`;
        await onSavePerson({
          id: effectiveMotherId,
          canonicalName: form.motherNameCustom.trim(),
          branch: form.branch || undefined,
          status: 'verified',
          isArchived: false,
          notes: 'ብኢድ ዝተመዝገበት ወላዲት ኣደ',
          createdAt: now,
          updatedAt: now
        });
      }

      // 3. Determine or create spouse
      let effectiveSpouseId = form.spouseId;
      if (!effectiveSpouseId && form.spouseNameCustom.trim()) {
        effectiveSpouseId = `pers_${Date.now()}_s_${Math.random().toString(36).substring(2, 5)}`;
        await onSavePerson({
          id: effectiveSpouseId,
          canonicalName: form.spouseNameCustom.trim(),
          branch: form.branch || undefined,
          status: 'verified',
          isArchived: false,
          notes: 'ብኢድ ዝተመዝገበ መጻምድቲ',
          createdAt: now,
          updatedAt: now
        });
      }

      // 4. Save Main Person
      const fatherPerson = effectiveFatherId ? peopleMap.get(effectiveFatherId) : undefined;
      const mainPerson: Person = {
        id: mainPersonId,
        canonicalName: form.canonicalName.trim(),
        branch: form.branch.trim() || undefined,
        fatherName: fatherPerson ? fatherPerson.canonicalName : form.fatherNameCustom.trim() || undefined,
        status: 'verified',
        isArchived: false,
        notes: form.notes.trim() || undefined,
        createdAt: now,
        updatedAt: now
      };
      await onSavePerson(mainPerson);

      // 5. Save Parent Relationships
      if (effectiveFatherId) {
        const fatherCycle = validateParentChildCycle(relationships, effectiveFatherId, mainPersonId);
        if (fatherCycle.isValid) {
          await onSaveRelationship({
            id: `rel_${Date.now()}_f_${Math.random().toString(36).substring(2, 5)}`,
            fromPersonId: effectiveFatherId,
            toPersonId: mainPersonId,
            type: 'parent_child',
            status: 'verified',
            sourceFile: 'ከሰተ-ብርሃነ.pdf',
            sourcePage: null,
            sourceWording: `${form.canonicalName} ወዲ/ጓል ${form.fatherNameCustom || fatherPerson?.canonicalName}`,
            isBiologicalConfirmed: true,
            createdAt: now,
            updatedAt: now
          });
        }
      }

      if (effectiveMotherId) {
        const motherCycle = validateParentChildCycle(relationships, effectiveMotherId, mainPersonId);
        if (motherCycle.isValid) {
          await onSaveRelationship({
            id: `rel_${Date.now()}_m_${Math.random().toString(36).substring(2, 5)}`,
            fromPersonId: effectiveMotherId,
            toPersonId: mainPersonId,
            type: 'parent_child',
            status: 'verified',
            sourceFile: 'ከሰተ-ብርሃነ.pdf',
            sourcePage: null,
            sourceWording: `${form.canonicalName} ወዲ/ጓል ${form.motherNameCustom}`,
            isBiologicalConfirmed: true,
            createdAt: now,
            updatedAt: now
          });
        }
      }

      // 6. Save Spouse Relationship
      if (effectiveSpouseId) {
        await onSaveRelationship({
          id: `rel_${Date.now()}_sp_${Math.random().toString(36).substring(2, 5)}`,
          fromPersonId: mainPersonId,
          toPersonId: effectiveSpouseId,
          type: 'partner_or_union',
          status: 'verified',
          sourceFile: 'ከሰተ-ብርሃነ.pdf',
          sourcePage: null,
          sourceWording: form.spouseWording.trim() || `${form.canonicalName} ዝተመርዓዉ`,
          isBiologicalConfirmed: false,
          createdAt: now,
          updatedAt: now
        });
      }

      // 7. Save Children batch
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
          id: `rel_${Date.now()}_rc_${Math.random().toString(36).substring(2, 5)}`,
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

      // 8. Clean draft storage and reload
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

  const selectedFather = form.fatherId ? peopleMap.get(form.fatherId) : null;
  const selectedMother = form.motherId ? peopleMap.get(form.motherId) : null;
  const selectedSpouse = form.spouseId ? peopleMap.get(form.spouseId) : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col font-ethiopic">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 font-bold text-lg">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-amber-100">
                ሓድሽ ኣባል ስድራቤት ምምዝጋብ
              </h2>
              <p className="text-xs text-stone-400">
                ውልቃዊ ሓበሬታ፡ ወለዲ፡ መጻምድትን ውሉዳትን ብቐሊሉ ኣእቱ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors"
            aria-label="ዕጾ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Draft Recovery Alert Modal Dialog */}
        {showDraftRecoveryDialog && (
          <div className="p-4 bg-amber-50 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2 text-amber-900">
              <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>ዘይተዛዘመ ስራሕ ጸኒሑ ኣሎ!</strong> ካብቲ ዝነበሮ ክትቅጽል ትደሊ ዲኻ?
              </span>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleDiscardDraft}
                className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-stone-700 hover:bg-stone-50 font-bold"
              >
                ሰርዝ (ሓድሽ ጀምር)
              </button>
              <button
                onClick={handleResumeDraft}
                className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold"
              >
                ካብቲ ዝነበሮ ቀጽል
              </button>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-stone-800">
          {submitError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Section 1: ውልቃዊ ሓበሬታ */}
          <div className="space-y-4">
            <h3 className="font-bold text-stone-900 text-base flex items-center gap-2 pb-2 border-b border-stone-200">
              <User className="w-4 h-4 text-amber-700" />
              <span>1. ውልቃዊ ሓበሬታ (Personal Details)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  ምሉእ ስም (ብትግርኛ) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ንኣብነት: ጎብሩ፡ ተስፉ፡ ብስራት..."
                  value={form.canonicalName}
                  onChange={(e) => updateForm((p) => ({ ...p, canonicalName: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-base focus:ring-2 focus:ring-amber-500 font-ethiopic"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                  ጨንፈር / ሓረግ (Branch)
                </label>
                <div className="flex gap-2">
                  <select
                    value={form.branch}
                    onChange={(e) => updateForm((p) => ({ ...p, branch: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:ring-2 focus:ring-amber-500 font-ethiopic"
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
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase mb-1">
                መተሓሳሰቢ ወይ ታሪኻዊ መረዳእታ (Notes)
              </label>
              <textarea
                rows={2}
                placeholder="ተወሳኺ መረዳእታ ወይ መተሓሳሰቢ እንተሃልዩ ኣብዚ ጽሓፍ..."
                value={form.notes}
                onChange={(e) => updateForm((p) => ({ ...p, notes: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm focus:ring-2 focus:ring-amber-500 font-ethiopic"
              />
            </div>
          </div>

          {/* Section 2: ወለዲ */}
          <div className="space-y-4">
            <h3 className="font-bold text-stone-900 text-base flex items-center gap-2 pb-2 border-b border-stone-200">
              <Users className="w-4 h-4 text-amber-700" />
              <span>2. ወለዲ (Parents)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Father */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                <span className="text-xs font-bold text-stone-700 block">ኣቦ (Father)</span>
                {selectedFather ? (
                  <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-stone-200">
                    <span className="font-bold text-stone-900">{selectedFather.canonicalName}</span>
                    <button
                      type="button"
                      onClick={() => updateForm((p) => ({ ...p, fatherId: null, fatherNameCustom: '' }))}
                      className="text-stone-400 hover:text-rose-600 p-1"
                      title="ኣልግስ"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : form.fatherNameCustom ? (
                  <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-stone-200">
                    <span className="font-bold text-stone-900">{form.fatherNameCustom} (ሓድሽ)</span>
                    <button
                      type="button"
                      onClick={() => updateForm((p) => ({ ...p, fatherNameCustom: '' }))}
                      className="text-stone-400 hover:text-rose-600 p-1"
                      title="ኣልግስ"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPickerTarget('father');
                        setPickerSearchQuery('');
                        setInlineQuickAddName('');
                      }}
                      className="w-full py-2 px-3 border border-stone-300 rounded-xl bg-white hover:bg-stone-100 text-stone-700 font-semibold text-xs flex items-center justify-center gap-1.5"
                    >
                      <Search className="w-3.5 h-3.5 text-stone-400" />
                      <span>ካብ ዝርዝር ኣቦ ምረጽ</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mother */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                <span className="text-xs font-bold text-stone-700 block">ኣደ (Mother)</span>
                {selectedMother ? (
                  <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-stone-200">
                    <span className="font-bold text-stone-900">{selectedMother.canonicalName}</span>
                    <button
                      type="button"
                      onClick={() => updateForm((p) => ({ ...p, motherId: null, motherNameCustom: '' }))}
                      className="text-stone-400 hover:text-rose-600 p-1"
                      title="ኣልግስ"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : form.motherNameCustom ? (
                  <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-stone-200">
                    <span className="font-bold text-stone-900">{form.motherNameCustom} (ሓድሽ)</span>
                    <button
                      type="button"
                      onClick={() => updateForm((p) => ({ ...p, motherNameCustom: '' }))}
                      className="text-stone-400 hover:text-rose-600 p-1"
                      title="ኣልግስ"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPickerTarget('mother');
                        setPickerSearchQuery('');
                        setInlineQuickAddName('');
                      }}
                      className="w-full py-2 px-3 border border-stone-300 rounded-xl bg-white hover:bg-stone-100 text-stone-700 font-semibold text-xs flex items-center justify-center gap-1.5"
                    >
                      <Search className="w-3.5 h-3.5 text-stone-400" />
                      <span>ካብ ዝርዝር ኣደ ምረጺ</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: መጻምድቲ */}
          <div className="space-y-4">
            <h3 className="font-bold text-stone-900 text-base flex items-center gap-2 pb-2 border-b border-stone-200">
              <Heart className="w-4 h-4 text-rose-500" />
              <span>3. መጻምድቲ / ሓዳር (Spouse)</span>
            </h3>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
              {selectedSpouse ? (
                <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-stone-200">
                  <span className="font-bold text-stone-900">{selectedSpouse.canonicalName}</span>
                  <button
                    type="button"
                    onClick={() => updateForm((p) => ({ ...p, spouseId: null, spouseNameCustom: '' }))}
                    className="text-stone-400 hover:text-rose-600 p-1"
                    title="ኣልግስ"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : form.spouseNameCustom ? (
                <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-stone-200">
                  <span className="font-bold text-stone-900">{form.spouseNameCustom} (ሓድሽ)</span>
                  <button
                    type="button"
                    onClick={() => updateForm((p) => ({ ...p, spouseNameCustom: '' }))}
                    className="text-stone-400 hover:text-rose-600 p-1"
                    title="ኣልግስ"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPickerTarget('spouse');
                    setPickerSearchQuery('');
                    setInlineQuickAddName('');
                  }}
                  className="py-2 px-3 border border-stone-300 rounded-xl bg-white hover:bg-stone-100 text-stone-700 font-semibold text-xs flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5 text-stone-400" />
                  <span>መጻምድቲ ካብ ዝርዝር ምረጽ ወይ ሓድሽ ወስኽ</span>
                </button>
              )}

              {(selectedSpouse || form.spouseNameCustom) && (
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    መግለጺ ሓዳር / ዝምድና
                  </label>
                  <input
                    type="text"
                    placeholder="ንኣብነት: ዝተመርዓዉ፡ ናብ ... ኣትያ ዝወለደቶም..."
                    value={form.spouseWording}
                    onChange={(e) => updateForm((p) => ({ ...p, spouseWording: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 4: ውሉዳት */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <GitFork className="w-4 h-4 rotate-180 text-amber-700" />
                <span>4. ውሉዳት ({form.children.length})</span>
              </h3>
              <button
                type="button"
                onClick={handleAddChildRow}
                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
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
                      className="flex-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-sm font-ethiopic"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveChildRow(child.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
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
          <div className="pt-4 border-t border-stone-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-stone-300 rounded-xl text-stone-700 font-bold text-sm hover:bg-stone-50"
            >
              ሰርዝ
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !validation.isValid}
              className={`px-6 py-2.5 rounded-xl text-white font-bold text-sm shadow-md flex items-center gap-2 transition-colors ${
                isSubmitting || !validation.isValid
                  ? 'bg-stone-400 cursor-not-allowed'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {isSubmitting ? (
                <span>ይዕቀብ ኣሎ...</span>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>ኣጽዲቕካ መዝግብ</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Modal Picker for Selecting Existing / Quick Adding Parent or Spouse */}
        {pickerTarget && (
          <div className="fixed inset-0 z-60 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <h4 className="font-bold text-stone-900 text-base">
                  {pickerTarget === 'father'
                    ? 'ኣቦ ምረጽ'
                    : pickerTarget === 'mother'
                    ? 'ኣደ ምረጺ'
                    : 'መጻምድቲ ምረጽ'}
                </h4>
                <button
                  onClick={() => setPickerTarget(null)}
                  className="p-1 text-stone-400 hover:text-stone-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                <input
                  type="text"
                  placeholder="ስም ጽሒፍካ ድለ..."
                  value={pickerSearchQuery}
                  onChange={(e) => setPickerSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-sm font-ethiopic"
                  autoFocus
                />
              </div>

              {/* Pick from existing */}
              <div className="max-h-52 overflow-y-auto space-y-1">
                {pickerSearchResults.length === 0 ? (
                  <p className="text-xs text-stone-400 italic py-2 text-center">
                    ኣብ መዝገብ ዝተረኽበ የለን።
                  </p>
                ) : (
                  pickerSearchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        if (pickerTarget === 'father') {
                          updateForm((prev) => ({ ...prev, fatherId: p.id, fatherNameCustom: '' }));
                        } else if (pickerTarget === 'mother') {
                          updateForm((prev) => ({ ...prev, motherId: p.id, motherNameCustom: '' }));
                        } else if (pickerTarget === 'spouse') {
                          updateForm((prev) => ({ ...prev, spouseId: p.id, spouseNameCustom: '' }));
                        }
                        setPickerTarget(null);
                      }}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-amber-50 flex items-center justify-between text-xs transition-colors border border-transparent hover:border-amber-300"
                    >
                      <span className="font-bold text-stone-900 font-ethiopic">
                        {p.canonicalName}
                      </span>
                      {p.branch && (
                        <span className="text-[11px] text-stone-500">{p.branch}</span>
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* Inline Quick Add without losing form state */}
              <div className="pt-3 border-t border-stone-100 space-y-2">
                <span className="text-xs font-semibold text-stone-600 block">
                  ኣብቲ ዝርዝር ዘየለ ሓድሽ ስም እንተኾይኑ:
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="ሓድሽ ስም ጽሓፍ..."
                    value={inlineQuickAddName}
                    onChange={(e) => setInlineQuickAddName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-ethiopic"
                  />
                  <button
                    type="button"
                    disabled={!inlineQuickAddName.trim()}
                    onClick={() => {
                      if (!inlineQuickAddName.trim()) return;
                      if (pickerTarget === 'father') {
                        updateForm((prev) => ({
                          ...prev,
                          fatherId: null,
                          fatherNameCustom: inlineQuickAddName.trim()
                        }));
                      } else if (pickerTarget === 'mother') {
                        updateForm((prev) => ({
                          ...prev,
                          motherId: null,
                          motherNameCustom: inlineQuickAddName.trim()
                        }));
                      } else if (pickerTarget === 'spouse') {
                        updateForm((prev) => ({
                          ...prev,
                          spouseId: null,
                          spouseNameCustom: inlineQuickAddName.trim()
                        }));
                      }
                      setPickerTarget(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs disabled:opacity-50"
                  >
                    ወሰኽ
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
