import React, { useState, useMemo } from 'react';
import { Person, Relationship, RecordStatus } from '../types/genealogy';
import { savePerson, saveRelationship } from '../services/db';
import { apiSaveBatch } from '../services/apiClient';
import { validateParentChildCycle } from '../services/cycleDetector';
import {
  X,
  CheckCircle,
  AlertTriangle,
  FileText,
  User,
  Heart,
  GitCommit,
  Plus,
  Trash2,
  Edit2,
  Save,
  ShieldAlert,
  Users,
  Search,
  ExternalLink,
  Check
} from 'lucide-react';

interface PersonDetailModalProps {
  person: Person | null;
  people: Person[];
  relationships: Relationship[];
  isAdmin?: boolean;
  onClose: () => void;
  onUpdatePerson: (updated: Person) => Promise<void>;
  onDeletePerson: (id: string) => Promise<void>;
  onAddRelationship?: (fromPersonId: string) => void;
  onDeleteRelationship: (relId: string) => Promise<void>;
  onSelectPerson?: (person: Person) => void;
  onReload?: () => Promise<void>;
}

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({
  person,
  people,
  relationships,
  isAdmin = false,
  onClose,
  onUpdatePerson,
  onDeletePerson,
  onAddRelationship,
  onDeleteRelationship,
  onSelectPerson,
  onReload,
}) => {
  if (!person) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [canonicalName, setCanonicalName] = useState(person.canonicalName);
  const [displayName, setDisplayName] = useState(person.displayName || '');

  // Auto-detect father's name (and grandfather's) if fatherName is empty and canonicalName has space
  const initialFatherName = useMemo(() => {
    if (person.fatherName) return person.fatherName;
    const trimmed = (person.canonicalName || '').trimStart();
    const firstSpaceIdx = trimmed.indexOf(' ');
    if (firstSpaceIdx !== -1) {
      return trimmed.slice(firstSpaceIdx + 1).trim();
    }
    return '';
  }, [person.fatherName, person.canonicalName]);

  const [fatherName, setFormFatherName] = useState(initialFatherName);
  const [motherName, setFormMotherName] = useState(person.motherName || '');
  const [gender, setGender] = useState<'male' | 'female' | 'unknown'>(person.gender || 'unknown');
  const [branch, setBranch] = useState(person.branch || '');
  const [notes, setNotes] = useState(person.notes || '');
  const [status, setStatus] = useState<RecordStatus>(person.status);
  const [reviewerNote, setReviewerNote] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Handle Canonical Name Change with Automatic Transfer of Father/Grandfather Names
  const handleCanonicalNameChange = (val: string) => {
    setCanonicalName(val);
    const trimmed = val.trimStart();
    const firstSpaceIdx = trimmed.indexOf(' ');
    if (firstSpaceIdx !== -1) {
      const extractedFatherName = trimmed.slice(firstSpaceIdx + 1).trimStart();
      if (extractedFatherName) {
        setFormFatherName(extractedFatherName);
      }
    }
  };

  // Children expansion & batch management state
  const [showAddChildrenPanel, setShowAddChildrenPanel] = useState(false);
  const [childrenPanelMode, setChildrenPanelMode] = useState<'batch' | 'existing'>('batch');
  const [quickChildNamesInput, setQuickChildNamesInput] = useState('');
  const [batchChildRows, setBatchChildRows] = useState<Array<{ id: string; name: string; gender: 'male' | 'female' | 'unknown' }>>([
    { id: 'c_1', name: '', gender: 'unknown' },
    { id: 'c_2', name: '', gender: 'unknown' }
  ]);
  const [selectedMotherId, setSelectedMotherId] = useState<string>('');
  const [existingSearchQuery, setExistingSearchQuery] = useState('');
  const [isSubmittingChildren, setIsSubmittingChildren] = useState(false);
  const [childSuccessMessage, setChildSuccessMessage] = useState<string | null>(null);
  const [childErrorMessage, setChildErrorMessage] = useState<string | null>(null);

  // Inline child editing
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editingChildName, setEditingChildName] = useState<string>('');

  const peopleMap = useMemo(() => {
    const map = new Map<string, Person>();
    for (const p of people) map.set(p.id, p);
    return map;
  }, [people]);

  // Find relationships for this person
  const parents = useMemo(() => {
    return relationships
      .filter((r) => r.toPersonId === person.id && (r.type === 'parent_child' || r.type === 'other_source_statement'))
      .map((r) => ({
        rel: r,
        person: peopleMap.get(r.fromPersonId),
      }));
  }, [relationships, person.id, peopleMap]);

  const children = useMemo(() => {
    return relationships
      .filter((r) => r.fromPersonId === person.id && (r.type === 'parent_child' || r.type === 'other_source_statement'))
      .map((r) => ({
        rel: r,
        person: peopleMap.get(r.toPersonId),
      }));
  }, [relationships, person.id, peopleMap]);

  const partners = useMemo(() => {
    return relationships
      .filter((r) => r.type === 'partner_or_union' && (r.fromPersonId === person.id || r.toPersonId === person.id))
      .map((r) => {
        const otherId = r.fromPersonId === person.id ? r.toPersonId : r.fromPersonId;
        return {
          rel: r,
          person: peopleMap.get(otherId),
        };
      });
  }, [relationships, person.id, peopleMap]);

  // Count children for a given person ID to display descendants indicator
  const getChildCountForPerson = (personId: string) => {
    return relationships.filter(
      (r) => r.fromPersonId === personId && (r.type === 'parent_child' || r.type === 'other_source_statement')
    ).length;
  };

  const existingChildIds = useMemo(() => {
    return new Set(children.map((c) => c.rel.toPersonId));
  }, [children]);

  const candidatePeople = useMemo(() => {
    if (!existingSearchQuery.trim()) return [];
    const query = existingSearchQuery.trim().toLowerCase();
    return people
      .filter((p) => {
        if (p.id === person.id) return false;
        if (existingChildIds.has(p.id)) return false;
        return (
          p.canonicalName.toLowerCase().includes(query) ||
          (p.displayName && p.displayName.toLowerCase().includes(query)) ||
          (p.fatherName && p.fatherName.toLowerCase().includes(query))
        );
      })
      .slice(0, 10);
  }, [people, person.id, existingChildIds, existingSearchQuery]);

  const validNewChildren = useMemo(() => {
    return batchChildRows.filter((r) => r.name.trim().length > 0);
  }, [batchChildRows]);

  const handleApplyQuickNames = () => {
    if (!quickChildNamesInput.trim()) return;
    const splitNames = quickChildNamesInput
      .split(/[,፣;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (splitNames.length === 0) return;

    const newRows = splitNames.map((name, idx) => ({
      id: `c_${Date.now()}_${idx}`,
      name,
      gender: 'unknown' as const,
    }));

    setBatchChildRows(newRows);
    setChildSuccessMessage(`${splitNames.length} ኣስማት ተመዲቦም ኣለዉ። ጾታ ኣረጋጊጽኩም መዝግቡ።`);
  };

  const handleAddChildRow = () => {
    setBatchChildRows((prev) => [
      ...prev,
      { id: `c_${Date.now()}_${prev.length + 1}`, name: '', gender: 'unknown' },
    ]);
  };

  const handleRemoveChildRow = (id: string) => {
    setBatchChildRows((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      return filtered.length > 0
        ? filtered
        : [{ id: `c_${Date.now()}_0`, name: '', gender: 'unknown' }];
    });
  };

  const handleUpdateChildRowName = (id: string, name: string) => {
    setBatchChildRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, name } : r))
    );
  };

  const handleUpdateChildRowGender = (id: string, gender: 'male' | 'female' | 'unknown') => {
    setBatchChildRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, gender } : r))
    );
  };

  const handleSaveBatchChildren = async () => {
    if (validNewChildren.length === 0) {
      setChildErrorMessage('ብውሕዱ ስም ሓደ ውሉድ ኣእትዉ።');
      return;
    }

    setIsSubmittingChildren(true);
    setChildErrorMessage(null);
    setChildSuccessMessage(null);

    try {
      const createdPeople: Person[] = [];
      const createdRels: Relationship[] = [];
      const now = new Date().toISOString();

      const otherParent = selectedMotherId ? peopleMap.get(selectedMotherId) : undefined;
      const isParentFemale = person.gender === 'female';

      for (let i = 0; i < validNewChildren.length; i++) {
        const row = validNewChildren[i];
        const childId = `pers_child_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${i}`;

        const cycleCheck = validateParentChildCycle(relationships, person.id, childId);
        if (!cycleCheck.isValid) {
          throw new Error(cycleCheck.error || 'ዑደት ዝምድና ተረኺቡ።');
        }

        const newPerson: Person = {
          id: childId,
          canonicalName: row.name.trim(),
          gender: row.gender,
          branch: person.branch || 'ትዕበ',
          fatherName: isParentFemale ? (otherParent?.canonicalName || undefined) : person.canonicalName,
          motherName: isParentFemale ? person.canonicalName : (otherParent?.canonicalName || undefined),
          status: 'verified',
          isArchived: false,
          notes: `ውሉድ ${person.canonicalName} (ዝተወሰኸ: ${new Date().toLocaleDateString()})`,
          sourceHeading: person.sourceHeading,
          sourcePage: person.sourcePage,
          createdAt: now,
          updatedAt: now,
        };

        await savePerson(newPerson, 'Admin');
        createdPeople.push(newPerson);

        const mainRel: Relationship = {
          id: `rel_pc_${person.id}_${childId}`,
          fromPersonId: person.id,
          toPersonId: childId,
          type: 'parent_child',
          status: 'verified',
          sourceFile: 'ከሰተ-ብርሃነ.pdf',
          sourcePage: person.sourcePage ?? null,
          sourceWording: `${row.name.trim()} ወዲ/ጓል ${person.canonicalName}`,
          isBiologicalConfirmed: true,
          createdAt: now,
          updatedAt: now,
        };
        await saveRelationship(mainRel, 'Admin');
        createdRels.push(mainRel);

        if (otherParent) {
          const otherRel: Relationship = {
            id: `rel_pc_${otherParent.id}_${childId}`,
            fromPersonId: otherParent.id,
            toPersonId: childId,
            type: 'parent_child',
            status: 'verified',
            sourceFile: 'ከሰተ-ብርሃነ.pdf',
            sourcePage: person.sourcePage ?? null,
            sourceWording: `${row.name.trim()} ወዲ/ጓል ${otherParent.canonicalName}`,
            isBiologicalConfirmed: true,
            createdAt: now,
            updatedAt: now,
          };
          await saveRelationship(otherRel, 'Admin');
          createdRels.push(otherRel);
        }
      }

      // Synchronize batch with cloud backend
      try {
        const token = sessionStorage.getItem('kinteba_admin_token') || 'official-admin-session-token';
        await apiSaveBatch(createdPeople, createdRels, token);
      } catch (cloudErr) {
        console.warn('Cloud sync error (fallback to local):', cloudErr);
      }

      const prevCount = children.length;
      const newTotal = prevCount + validNewChildren.length;
      setChildSuccessMessage(
        `${validNewChildren.length} ውሉዳት ብዓወት ተመዝጊቦም! ጠቕላላ ውሉዳት ካብ ${prevCount} ናብ ${newTotal} ዓብዩ ኣሎ።`
      );
      setQuickChildNamesInput('');
      setBatchChildRows([
        { id: `c_${Date.now()}_1`, name: '', gender: 'unknown' },
        { id: `c_${Date.now()}_2`, name: '', gender: 'unknown' },
      ]);

      if (onReload) {
        await onReload();
      }
      setShowAddChildrenPanel(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ውሉዳት ምምዝጋብ ኣይተዓወተን።';
      setChildErrorMessage(msg);
    } finally {
      setIsSubmittingChildren(false);
    }
  };

  const handleLinkExistingChild = async (childId: string) => {
    setIsSubmittingChildren(true);
    setChildErrorMessage(null);
    try {
      const cycleCheck = validateParentChildCycle(relationships, person.id, childId);
      if (!cycleCheck.isValid) {
        throw new Error(cycleCheck.error || 'ዑደት ዝምድና ተረኺቡ።');
      }

      const existingChild = peopleMap.get(childId);
      const now = new Date().toISOString();
      const rel: Relationship = {
        id: `rel_pc_${person.id}_${childId}`,
        fromPersonId: person.id,
        toPersonId: childId,
        type: 'parent_child',
        status: 'verified',
        sourceFile: 'ከሰተ-ብርሃነ.pdf',
        sourcePage: person.sourcePage ?? null,
        sourceWording: `${existingChild?.canonicalName || ''} ውሉድ ${person.canonicalName}`,
        isBiologicalConfirmed: true,
        createdAt: now,
        updatedAt: now,
      };

      await saveRelationship(rel, 'Admin');
      try {
        const token = sessionStorage.getItem('kinteba_admin_token') || 'official-admin-session-token';
        await apiSaveBatch([], [rel], token);
      } catch (err) {
        console.warn('Cloud sync note:', err);
      }

      setChildSuccessMessage(`"${existingChild?.canonicalName}" ከም ውሉድ ብዓወት ተኣሳሲሩ!`);
      if (onReload) {
        await onReload();
      }
      setShowAddChildrenPanel(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ምእሳር ኣይተዓወተን።';
      setChildErrorMessage(msg);
    } finally {
      setIsSubmittingChildren(false);
    }
  };

  const handleStartEditChild = (child: Person) => {
    setEditingChildId(child.id);
    setEditingChildName(child.canonicalName);
  };

  const handleSaveEditChild = async (child: Person) => {
    if (!editingChildName.trim()) return;
    const updated: Person = {
      ...child,
      canonicalName: editingChildName.trim(),
      updatedAt: new Date().toISOString(),
    };
    await savePerson(updated, 'Admin');
    try {
      const token = sessionStorage.getItem('kinteba_admin_token') || 'official-admin-session-token';
      await apiSaveBatch([updated], [], token);
    } catch {}
    setEditingChildId(null);
    if (onReload) {
      await onReload();
    }
  };

  const handleSaveEdit = async () => {
    const updated: Person = {
      ...person,
      canonicalName: canonicalName.trim(),
      displayName: displayName.trim() || undefined,
      fatherName: fatherName.trim() || undefined,
      motherName: motherName.trim() || undefined,
      gender,
      branch: branch.trim() || undefined,
      notes: notes.trim() || undefined,
      status,
      updatedAt: new Date().toISOString(),
    };
    await onUpdatePerson(updated);
    setIsEditing(false);
  };

  const handleQuickStatusChange = async (newStatus: RecordStatus) => {
    const updated: Person = {
      ...person,
      status: newStatus,
      notes: reviewerNote
        ? `${person.notes || ''}\n[Review Note ${new Date().toLocaleDateString()}]: ${reviewerNote}`.trim()
        : person.notes,
      updatedAt: new Date().toISOString(),
    };
    await onUpdatePerson(updated);
    setStatus(newStatus);
    setReviewerNote('');
  };

  const totalAffectedRels = parents.length + children.length + partners.length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 font-bold font-ethiopic text-lg">
              {person.canonicalName.charAt(0) || 'ጉ'}
            </div>
            <div>
              <h2 className="text-xl font-bold font-ethiopic text-amber-100">
                {person.canonicalName}
              </h2>
              {person.branch && (
                <p className="text-xs text-amber-400 font-ethiopic">
                  ጨንፈር: {person.branch}
                </p>
              )}
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-stone-800">
          {/* Quick Review Status Strip (Admin only) */}
          {isAdmin && (
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2 font-ethiopic">
                <span className="text-xs font-semibold text-stone-600">ኩነታት:</span>
                {status === 'verified' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> ዝተረጋገጸ
                  </span>
                )}
                {status === 'needs_review' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" /> ምምርማር ዘድልዮ
                  </span>
                )}
                {status === 'unverified' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-stone-200 text-stone-700">
                    ዘይተረጋገጸ
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2 text-xs font-ethiopic">
                <button
                  onClick={() => handleQuickStatusChange('verified')}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm transition-colors"
                >
                  ኣረጋግጽ
                </button>
                <button
                  onClick={() => handleQuickStatusChange('needs_review')}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg shadow-sm transition-colors"
                >
                  ንመመርመሪ ምልክት ግበር
                </button>
              </div>
            </div>
          )}

          {/* Person Metadata Fields (Edit Mode or Read Mode) */}
          {isEditing ? (
            <div className="space-y-4 p-4 bg-stone-50 rounded-xl border border-stone-200 font-ethiopic">
              <h4 className="font-semibold text-sm text-stone-800">መረዳእታ ኣባል ምዕራይ</h4>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  ምሉእ ስም (ብትግርኛ) *
                </label>
                <input
                  type="text"
                  value={canonicalName}
                  onChange={(e) => handleCanonicalNameChange(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 bg-white font-ethiopic"
                />
                {canonicalName.trim().indexOf(' ') !== -1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const firstName = canonicalName.trim().split(/\s+/)[0];
                      setCanonicalName(firstName);
                    }}
                    className="text-[11px] text-amber-600 hover:text-amber-800 underline font-ethiopic mt-1 cursor-pointer block"
                  >
                    ስም በዓል ዋና ጥራይ ግበር ("{canonicalName.trim().split(/\s+/)[0]}")
                  </button>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  ተወሳኺ ስም
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 bg-white font-ethiopic"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-stone-700">ስም ኣቦ</label>
                    {fatherName && canonicalName.trim().indexOf(' ') !== -1 && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                        ብኣውቶማቲክ ዝተረኽበ
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => setFormFatherName(e.target.value)}
                    placeholder="ስም ኣቦ..."
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 bg-white font-ethiopic"
                  />
                  {fatherName && canonicalName.trim().indexOf(' ') !== -1 && (
                    <p className="text-[10px] text-amber-800 font-ethiopic mt-1">
                      💡 ድሕሪ ስፔስ ዘሎ ሽም (<strong>{fatherName}</strong>) ናብ ስም ኣቦ ሓሊፉ ኣሎ።
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">ስም ኣደ</label>
                  <input
                    type="text"
                    value={motherName}
                    onChange={(e) => setFormMotherName(e.target.value)}
                    placeholder="ስም ኣደ..."
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 bg-white font-ethiopic"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">ጾታ</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'unknown')}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 bg-white font-ethiopic"
                  >
                    <option value="male">ተባዕታይ</option>
                    <option value="female">ኣንስተይቲ</option>
                    <option value="unknown">ዘይተፈልጠ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">ጨንፈር / ሓረግ</label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 bg-white font-ethiopic"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">ኩነታት ምርግጋጽ</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as RecordStatus)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 bg-white font-ethiopic"
                  >
                    <option value="unverified">ዘይተረጋገጸ</option>
                    <option value="needs_review">ምምርማር ዘድልዮ</option>
                    <option value="verified">ዝተረጋገጸ</option>
                    <option value="rejected">ዘይቅቡል</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">መተሓሳሰቢ</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 bg-white font-ethiopic"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-200 rounded-lg"
                >
                  ሰርዝ
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg flex items-center space-x-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>ኣቐምጥ</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-ethiopic">
              <div className="p-3 bg-white rounded-lg border border-stone-200">
                <span className="text-xs text-stone-400 block">ምሉእ ስም</span>
                <span className="font-bold text-stone-900 font-ethiopic text-lg">
                  {person.canonicalName}
                </span>
                {person.displayName && (
                  <span className="text-xs text-stone-500 block font-sans mt-0.5">
                    ({person.displayName})
                  </span>
                )}
              </div>

              <div className="p-3 bg-white rounded-lg border border-stone-200">
                <span className="text-xs text-stone-400 block">ጨንፈር / ሓረግ</span>
                <span className="font-semibold text-stone-800 font-ethiopic">
                  {person.branch || 'ከንቲባ ጉዕሽ ሓጎስ'}
                </span>
              </div>

              {(person.fatherName || person.motherName) && (
                <div className="p-3 bg-white rounded-lg border border-stone-200 md:col-span-2">
                  <span className="text-xs text-stone-400 block mb-1">ወለዲ (ኣቦን ኣደን)</span>
                  <div className="flex flex-wrap gap-4 text-xs">
                    {person.fatherName && (
                      <div className="text-stone-800">
                        <span className="text-stone-500">ኣቦ: </span>
                        <span className="font-bold">{person.fatherName}</span>
                      </div>
                    )}
                    {person.motherName && (
                      <div className="text-stone-800">
                        <span className="text-stone-500">ኣደ: </span>
                        <span className="font-bold">{person.motherName}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {person.notes && !person.notes.includes('PDF') && !person.notes.includes('source title') && (
                <div className="p-3 bg-white rounded-lg border border-stone-200 md:col-span-2">
                  <span className="text-xs text-stone-400 block mb-1">መተሓሳሰቢ</span>
                  <p className="text-xs text-stone-700 whitespace-pre-line">
                    {person.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Relationships Section */}
          <div className="space-y-4 font-ethiopic">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h3 className="font-bold text-sm text-stone-800 flex items-center space-x-2">
                <GitCommit className="w-4 h-4 text-amber-600" />
                <span>ዝተመዝገቡ ዝምድናታት</span>
              </h3>
              {isAdmin && onAddRelationship && (
                <button
                  onClick={() => onAddRelationship(person.id)}
                  className="px-2.5 py-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg font-medium flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ዝምድና ኣራኽብ</span>
                </button>
              )}
            </div>

            {/* Parents List */}
            <div>
              <span className="text-xs font-semibold text-stone-500 block mb-1.5">
                ወለዲ ({parents.length})
              </span>
              {parents.length === 0 ? (
                <p className="text-xs text-stone-400 italic">ዝተመዝገበ ወላዲ የለን።</p>
              ) : (
                <div className="space-y-1.5">
                  {parents.map(({ rel, person: parentPerson }) => (
                    <div
                      key={rel.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200 text-xs"
                    >
                      <div>
                        <span className="font-bold font-ethiopic text-stone-900 mr-2">
                          {parentPerson?.canonicalName || 'ዘይተፈልጠ ኣባል'}
                        </span>
                        {rel.sourceWording && (
                          <span className="text-stone-500 block text-[11px] truncate max-w-sm">
                            {rel.sourceWording}
                          </span>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => onDeleteRelationship(rel.id)}
                          className="text-stone-400 hover:text-rose-600 p-1 rounded"
                          title="ዝምድና ደምስስ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Partners List */}
            {partners.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-stone-500 block mb-1.5">
                  መጻምድቲ / ሓዳር ({partners.length})
                </span>
                <div className="space-y-1.5">
                  {partners.map(({ rel, person: partnerPerson }) => (
                    <div
                      key={rel.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-purple-50/60 border border-purple-200 text-xs"
                    >
                      <div>
                        <span className="font-bold font-ethiopic text-purple-950 mr-2">
                          {partnerPerson?.canonicalName || 'ዘይተፈልጠ መጻምድቲ'}
                        </span>
                        {rel.sourceWording && (
                          <span className="text-stone-500 block text-[11px]">
                            {rel.sourceWording}
                          </span>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => onDeleteRelationship(rel.id)}
                          className="text-stone-400 hover:text-rose-600 p-1 rounded"
                          title="መጻምድቲ ደምስስ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Children Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-stone-700 font-ethiopic">
                    ውሉዳት ({children.length})
                  </span>
                  {children.length > 0 && (
                    <span className="text-[11px] text-stone-400 font-ethiopic">
                      (ዘለዉ ውሉዳት: {children.length})
                    </span>
                  )}
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddChildrenPanel(!showAddChildrenPanel);
                      setChildErrorMessage(null);
                      setChildSuccessMessage(null);
                    }}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium font-ethiopic flex items-center space-x-1.5 transition-colors cursor-pointer ${
                      showAddChildrenPanel
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showAddChildrenPanel ? 'ኣዕጹ' : '+ ውሉድ ወስኽ / ኣስፍሕ'}</span>
                  </button>
                )}
              </div>

              {/* Children Expansion Panel */}
              {showAddChildrenPanel && (
                <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-2xl space-y-3.5 text-xs font-ethiopic transition-all">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-amber-700" />
                      <span className="font-bold text-amber-950 text-sm">
                        ን {person.canonicalName} ውሉዳት ምዕባይን ምምዝጋብን
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 bg-amber-100/80 p-0.5 rounded-lg border border-amber-300">
                      <button
                        type="button"
                        onClick={() => setChildrenPanelMode('batch')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          childrenPanelMode === 'batch'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-amber-900 hover:bg-amber-200/60'
                        }`}
                      >
                        ብጅምላ ወስኽ
                      </button>
                      <button
                        type="button"
                        onClick={() => setChildrenPanelMode('existing')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          childrenPanelMode === 'existing'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-amber-900 hover:bg-amber-200/60'
                        }`}
                      >
                        ካብ ዝርዝር ምረጽ
                      </button>
                    </div>
                  </div>

                  {/* Batch Add Mode */}
                  {childrenPanelMode === 'batch' && (
                    <div className="space-y-3">
                      {/* Quick Multi-name paste/entry input */}
                      <div className="bg-white p-3 rounded-xl border border-amber-200 space-y-2">
                        <label className="block text-[11px] font-semibold text-stone-700">
                          ብነጥቢ (ኮማ) ፈላልይኩም ኣስማት ብሓንሳእ ኣእትዉ:
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={quickChildNamesInput}
                            onChange={(e) => setQuickChildNamesInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleApplyQuickNames();
                              }
                            }}
                            placeholder="ንኣብነት፡ ሓጎስ፣ ለምለም፣ ኣብርሃ፣ በርሀ፣ መሓሪ፣ ኣስመላሽ..."
                            className="flex-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-stone-50 focus:bg-white text-xs font-ethiopic focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={handleApplyQuickNames}
                            className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-medium font-ethiopic shrink-0 cursor-pointer"
                          >
                            ኣከፋፍል
                          </button>
                        </div>
                      </div>

                      {/* Dynamic Rows */}
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-stone-600 px-1">
                          <span>ዝርዝር ሓደሽቲ ውሉዳት ({validNewChildren.length})</span>
                          <span className="text-amber-800 font-bold">
                            ጠቕላላ ውሉዳት: ካብ {children.length} ናብ {children.length + validNewChildren.length} ክዓቢ እዩ
                          </span>
                        </div>

                        {batchChildRows.map((row, idx) => (
                          <div
                            key={row.id}
                            className="flex items-center space-x-2 bg-white p-2 rounded-xl border border-stone-200"
                          >
                            <span className="w-5 text-center font-mono text-[11px] text-stone-400 font-bold">
                              #{idx + 1}
                            </span>
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => handleUpdateChildRowName(row.id, e.target.value)}
                              placeholder="ስም ውሉድ..."
                              className="flex-1 px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs font-ethiopic focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                            />
                            <select
                              value={row.gender}
                              onChange={(e) => handleUpdateChildRowGender(row.id, e.target.value as any)}
                              className="px-2 py-1.5 rounded-lg border border-stone-300 text-xs font-ethiopic bg-stone-50"
                            >
                              <option value="unknown">ጾታ (ዘይተፈልጠ)</option>
                              <option value="male">ተባዕታይ</option>
                              <option value="female">ኣንስተይቲ</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleRemoveChildRow(row.id)}
                              className="text-stone-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 cursor-pointer"
                              title="እዚ ውሉድ ሰርዝ"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add more row button & optional partner */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleAddChildRow}
                          className="px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 rounded-lg text-xs font-medium font-ethiopic flex items-center space-x-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-amber-600" />
                          <span>+ ተወሳኺ ውሉድ ወስኽ</span>
                        </button>

                        {partners.length > 0 && (
                          <div className="flex items-center space-x-2 text-xs">
                            <span className="text-stone-600 font-medium">ወላዲት / መጻምድቲ:</span>
                            <select
                              value={selectedMotherId}
                              onChange={(e) => setSelectedMotherId(e.target.value)}
                              className="px-2 py-1 border border-stone-300 rounded-lg bg-white text-xs font-ethiopic"
                            >
                              <option value="">(ዘይተፈልጠ / ዲፎልት)</option>
                              {partners.map(({ person: partnerPerson }) => partnerPerson ? (
                                <option key={partnerPerson.id} value={partnerPerson.id}>
                                  {partnerPerson.canonicalName}
                                </option>
                              ) : null)}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Action submit button */}
                      <div className="flex items-center justify-end space-x-2 pt-2 border-t border-amber-200">
                        <button
                          type="button"
                          onClick={() => setShowAddChildrenPanel(false)}
                          className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 font-medium text-xs cursor-pointer"
                        >
                          ሰርዝ
                        </button>
                        <button
                          type="button"
                          disabled={validNewChildren.length === 0 || isSubmittingChildren}
                          onClick={handleSaveBatchChildren}
                          className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-medium text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer"
                        >
                          {isSubmittingChildren ? (
                            <span>ይመዝገብ ኣሎ...</span>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>
                                {validNewChildren.length} ውሉዳት መዝግብን ኣራኽብን
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Existing Member Link Mode */}
                  {childrenPanelMode === 'existing' && (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                        <input
                          type="text"
                          value={existingSearchQuery}
                          onChange={(e) => setExistingSearchQuery(e.target.value)}
                          placeholder="ካብ ዝርዝር ስድራቤት ስም ጸሓፍ..."
                          className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-ethiopic focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                        />
                      </div>

                      {candidatePeople.length > 0 ? (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {candidatePeople.map((cand) => (
                            <div
                              key={cand.id}
                              className="flex items-center justify-between p-2 rounded-lg bg-white border border-stone-200 text-xs"
                            >
                              <div>
                                <span className="font-bold text-stone-900 font-ethiopic">
                                  {cand.canonicalName}
                                </span>
                                {cand.branch && (
                                  <span className="text-[11px] text-stone-500 ml-2">
                                    ({cand.branch})
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                disabled={isSubmittingChildren}
                                onClick={() => handleLinkExistingChild(cand.id)}
                                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium text-xs font-ethiopic flex items-center space-x-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>ከም ውሉድ ኣራኽብ</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : existingSearchQuery.trim() ? (
                        <p className="text-xs text-stone-500 italic p-2 text-center">
                          ተመሳሳሊ ስም ዘለዎ ኣባል ኣይተረኽበን።
                        </p>
                      ) : (
                        <p className="text-xs text-stone-500 italic p-2 text-center">
                          ኣባል ስድራቤት ንምድላይ ኣብ ላዕሊ ስም ጸሓፉ።
                        </p>
                      )}
                    </div>
                  )}

                  {/* Success / Error Alerts */}
                  {childSuccessMessage && (
                    <div className="p-2.5 bg-emerald-100/80 border border-emerald-300 rounded-lg text-emerald-800 text-xs flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{childSuccessMessage}</span>
                    </div>
                  )}
                  {childErrorMessage && (
                    <div className="p-2.5 bg-rose-100/80 border border-rose-300 rounded-lg text-rose-800 text-xs flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{childErrorMessage}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Children List Display */}
              {children.length === 0 ? (
                <p className="text-xs text-stone-400 italic">ዝተመዝገቡ ውሉዳት የለዉን።</p>
              ) : (
                <div className="space-y-1.5">
                  {children.map(({ rel, person: childPerson }) => {
                    if (!childPerson) return null;
                    const childCount = getChildCountForPerson(childPerson.id);
                    const isEditingThisChild = editingChildId === childPerson.id;

                    return (
                      <div
                        key={rel.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 hover:bg-stone-100/80 border border-stone-200 transition-colors text-xs"
                      >
                        <div className="flex items-center space-x-2.5 flex-1 min-w-0 mr-2">
                          {/* Gender Indicator Icon */}
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] shrink-0 font-bold ${
                              childPerson.gender === 'female'
                                ? 'bg-rose-100 text-rose-700'
                                : childPerson.gender === 'male'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-stone-200 text-stone-600'
                            }`}
                            title={
                              childPerson.gender === 'female'
                                ? 'ኣንስተይቲ'
                                : childPerson.gender === 'male'
                                ? 'ተባዕታይ'
                                : 'ዘይተፈልጠ'
                            }
                          >
                            {childPerson.gender === 'female'
                              ? '♀'
                              : childPerson.gender === 'male'
                              ? '♂'
                              : '•'}
                          </span>

                          {isEditingThisChild ? (
                            <div className="flex items-center space-x-1.5 flex-1">
                              <input
                                type="text"
                                value={editingChildName}
                                onChange={(e) => setEditingChildName(e.target.value)}
                                className="px-2 py-1 bg-white border border-stone-300 rounded text-xs font-ethiopic font-bold flex-1"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditChild(childPerson)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-ethiopic flex items-center space-x-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>ኣጽድቕ</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingChildId(null)}
                                className="px-2 py-1 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded text-xs font-ethiopic cursor-pointer"
                              >
                                ሰርዝ
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2 truncate">
                              {onSelectPerson ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectPerson(childPerson)}
                                  className="font-bold font-ethiopic text-stone-900 hover:text-amber-700 hover:underline flex items-center space-x-1 truncate cursor-pointer text-left"
                                  title="ናይዚ ውሉድ መረዳእታ ኽፈት"
                                >
                                  <span className="truncate">{childPerson.canonicalName}</span>
                                  <ExternalLink className="w-3 h-3 text-stone-400 shrink-0 inline" />
                                </button>
                              ) : (
                                <span className="font-bold font-ethiopic text-stone-900 truncate">
                                  {childPerson.canonicalName}
                                </span>
                              )}

                              {/* Descendant count badge */}
                              {childCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-stone-200/80 text-stone-700 font-medium shrink-0 font-ethiopic">
                                  {childCount} ውሉድ
                                </span>
                              )}

                              {rel.status === 'needs_review' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 shrink-0">
                                  ምምርማር ዘድልዮ
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action icons */}
                        {!isEditingThisChild && (
                          <div className="flex items-center space-x-1 shrink-0">
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleStartEditChild(childPerson)}
                                className="text-stone-400 hover:text-amber-600 p-1 rounded hover:bg-stone-200 transition-colors cursor-pointer"
                                title="ስም ውሉድ ኣስተኻኽል"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => onDeleteRelationship(rel.id)}
                                className="text-stone-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                title="ዝምድና ውሉድ ደምስስ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Delete Confirmation Warning */}
          {showDeleteConfirm && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-2 text-rose-900 text-xs font-ethiopic">
              <div className="flex items-center space-x-2 font-bold text-rose-800 text-sm">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>ካብ መዝገብ ምድምሳስ ኣረጋግጽ</span>
              </div>
              <p>
                ብሓቂ ን <strong>{person.canonicalName}</strong> ካብ መዝገብ ክትድምስስዎ ትደልዩ ዲኹም?
              </p>
              <p className="text-rose-700">
                እዚ ስጉምቲ ምስዚ ኣባል ዝተተሓሓዙ <strong>{totalAffectedRels}</strong> ዝምድናታት ብሓባር ክድምስስ እዩ።
              </p>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1 bg-white border border-stone-300 rounded text-stone-700"
                >
                  ሰርዝ
                </button>
                <button
                  onClick={async () => {
                    await onDeletePerson(person.id);
                    onClose();
                  }}
                  className="px-3 py-1 bg-rose-600 text-white rounded font-medium hover:bg-rose-700"
                >
                  እወ፡ ካብ መዝገብ ደምስስ
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={`px-6 py-3 bg-stone-50 border-t border-stone-200 flex items-center ${isAdmin ? 'justify-between' : 'justify-end'} text-xs font-ethiopic`}>
          {isAdmin && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-rose-600 hover:text-rose-800 font-medium flex items-center space-x-1"
            >
              <Trash2 className="w-4 h-4" />
              <span>ካብ መዝገብ ደምስስ...</span>
            </button>
          )}

          <div className="flex items-center space-x-2">
            {isAdmin && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 border border-stone-300 bg-white rounded-lg hover:bg-stone-100 text-stone-700 font-medium flex items-center space-x-1"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>ኣስተኻኽል</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-lg font-medium"
            >
              ዕጾ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

