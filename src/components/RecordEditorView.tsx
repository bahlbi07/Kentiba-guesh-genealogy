import React, { useState, useMemo } from 'react';
import {
  Person,
  Relationship,
  RecordStatus,
} from '../types/genealogy';
import { OFFICIAL_BRANCHES } from './AddPersonGuidedModal';
import {
  Search,
  Edit3,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  X,
  Save,
  Trash2,
  GitFork,
  User,
  Users,
  Heart,
  Plus,
  Filter,
  Check,
  ShieldAlert,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

interface RecordEditorViewProps {
  people: Person[];
  relationships: Relationship[];
  onUpdatePerson: (person: Person) => Promise<void>;
  onDeletePerson: (id: string) => Promise<void>;
  onSaveRelationship: (rel: Relationship) => Promise<{ success: boolean; error?: string }>;
  onDeleteRelationship: (id: string) => Promise<void>;
  onAddNewPerson?: () => void;
  onAddNewRelationship?: (fromPersonId?: string) => void;
  onSelectPerson?: (person: Person) => void;
  onDeduplicate?: () => Promise<{ mergedCount: number; details: string[] }>;
}

export const RecordEditorView: React.FC<RecordEditorViewProps> = ({
  people,
  relationships,
  onUpdatePerson,
  onDeletePerson,
  onSaveRelationship,
  onDeleteRelationship,
  onAddNewPerson,
  onAddNewRelationship,
  onSelectPerson,
  onDeduplicate,
}) => {
  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Active Person being edited in Modal
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  // Form states for the editing modal
  const [formCanonicalName, setFormCanonicalName] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formFatherName, setFormFatherName] = useState('');
  const [formMotherName, setFormMotherName] = useState('');
  const [formGender, setFormGender] = useState<'male' | 'female' | 'unknown'>('unknown');
  const [formBranch, setFormBranch] = useState('');
  const [formCustomBranch, setFormCustomBranch] = useState('');
  const [formStatus, setFormStatus] = useState<RecordStatus>('verified');
  const [formSpouseNote, setFormSpouseNote] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // UI state for saving / alerts
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Deduplication state
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [dedupFeedback, setDedupFeedback] = useState<string | null>(null);

  const handleRunDeduplication = async () => {
    if (!onDeduplicate || isDeduplicating) return;
    setIsDeduplicating(true);
    setDedupFeedback(null);
    try {
      const res = await onDeduplicate();
      if (res.mergedCount > 0) {
        setDedupFeedback(`${res.mergedCount} ተደገምቲ መዛግብቲ ብዓወት ተወሃሂዶም ጸሪዮም!`);
      } else {
        setDedupFeedback('ምንም ተደገምቲ መዛግብቲ የለዉን - ኩሉ መዝገብ ብትኽክል ዝተወደበ እዩ።');
      }
    } catch {
      setDedupFeedback('ምጽራይ ተደገምቲ መዛግብቲ ክካየድ ኣይከኣለን። በጃኹም ደጊምኩም ፈትኑ።');
    } finally {
      setIsDeduplicating(false);
      setTimeout(() => setDedupFeedback(null), 6000);
    }
  };

  // Fast person lookup map
  const peopleMap = useMemo(() => {
    const map = new Map<string, Person>();
    for (const p of people) {
      map.set(p.id, p);
    }
    return map;
  }, [people]);

  // The 12 official branches
  const availableBranches = useMemo(() => {
    return OFFICIAL_BRANCHES;
  }, []);

  // Filtered people list
  const filteredPeople = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return people.filter((p) => {
      // Search matching canonicalName, fatherName, motherName, displayName, id
      if (query) {
        const matchName = p.canonicalName.toLowerCase().includes(query);
        const matchFather = p.fatherName?.toLowerCase().includes(query) || false;
        const matchMother = p.motherName?.toLowerCase().includes(query) || false;
        const matchDisplay = p.displayName?.toLowerCase().includes(query) || false;
        const matchId = p.id.toLowerCase().includes(query);
        if (!matchName && !matchFather && !matchMother && !matchDisplay && !matchId) {
          return false;
        }
      }

      // Branch filter
      if (selectedBranch !== 'all' && (p.branch || '') !== selectedBranch) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && p.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [people, searchTerm, selectedBranch, selectedStatus]);

  // Open Edit Modal for a Person
  const handleOpenEdit = (p: Person) => {
    setEditingPerson(p);
    setFormCanonicalName(p.canonicalName);
    setFormDisplayName(p.displayName || '');

    // Auto-detect father's name (and grandfather's) if fatherName is empty and canonicalName has space
    let initialFather = p.fatherName || '';
    if (!initialFather && p.canonicalName) {
      const trimmed = p.canonicalName.trimStart();
      const firstSpaceIdx = trimmed.indexOf(' ');
      if (firstSpaceIdx !== -1) {
        const extracted = trimmed.slice(firstSpaceIdx + 1).trim();
        if (extracted) {
          initialFather = extracted;
        }
      }
    }
    setFormFatherName(initialFather);
    setFormMotherName(p.motherName || '');
    setFormGender(p.gender || 'unknown');
    
    // Check if branch is in available branches or custom
    const br = p.branch || '';
    if (availableBranches.includes(br)) {
      setFormBranch(br);
      setFormCustomBranch('');
    } else if (br) {
      setFormBranch('custom');
      setFormCustomBranch(br);
    } else {
      setFormBranch('');
      setFormCustomBranch('');
    }

    setFormStatus(p.status);
    setFormSpouseNote(p.spouseNote || '');
    setFormNotes(p.notes || '');
    setSaveError(null);
    setSaveSuccessMsg(null);
    setConfirmDeleteId(null);
  };

  // Handle Canonical Name Change with Automatic Transfer of Father/Grandfather Names
  const handleCanonicalNameChange = (val: string) => {
    setFormCanonicalName(val);
    const trimmed = val.trimStart();
    const firstSpaceIdx = trimmed.indexOf(' ');
    if (firstSpaceIdx !== -1) {
      const extractedFatherName = trimmed.slice(firstSpaceIdx + 1).trimStart();
      if (extractedFatherName) {
        setFormFatherName(extractedFatherName);
      }
    }
  };

  // Close Edit Modal
  const handleCloseEdit = () => {
    setEditingPerson(null);
    setSaveError(null);
    setSaveSuccessMsg(null);
    setConfirmDeleteId(null);
  };

  // Relationships connected to the person currently being edited
  const currentRelationships = useMemo(() => {
    if (!editingPerson) return { parents: [], children: [], partners: [] };

    const parents = relationships
      .filter((r) => r.toPersonId === editingPerson.id && (r.type === 'parent_child' || r.type === 'other_source_statement'))
      .map((r) => ({ rel: r, person: peopleMap.get(r.fromPersonId) }));

    const children = relationships
      .filter((r) => r.fromPersonId === editingPerson.id && (r.type === 'parent_child' || r.type === 'other_source_statement'))
      .map((r) => ({ rel: r, person: peopleMap.get(r.toPersonId) }));

    const partners = relationships
      .filter((r) => r.type === 'partner_or_union' && (r.fromPersonId === editingPerson.id || r.toPersonId === editingPerson.id))
      .map((r) => {
        const otherId = r.fromPersonId === editingPerson.id ? r.toPersonId : r.fromPersonId;
        return { rel: r, person: peopleMap.get(otherId) };
      });

    return { parents, children, partners };
  }, [editingPerson, relationships, peopleMap]);

  // Handle Save Person Changes
  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson) return;

    if (!formCanonicalName.trim()) {
      setSaveError('ምሉእ ስም ብግቡእ ክምላእ ኣለዎ።');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const finalBranch = formBranch === 'custom' ? formCustomBranch.trim() : formBranch.trim();

    const updated: Person = {
      ...editingPerson,
      canonicalName: formCanonicalName.trim(),
      displayName: formDisplayName.trim() || undefined,
      fatherName: formFatherName.trim() || undefined,
      motherName: formMotherName.trim() || undefined,
      gender: formGender,
      branch: finalBranch || undefined,
      status: formStatus,
      spouseNote: formSpouseNote.trim() || undefined,
      notes: formNotes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    try {
      await onUpdatePerson(updated);
      setEditingPerson(updated);
      setSaveSuccessMsg(`ናይ ${updated.canonicalName} መረዳእታ ብትኽክል ተዓርዩ ተዓቒቡ ኣሎ!`);
      setTimeout(() => {
        setSaveSuccessMsg(null);
      }, 4000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'ምዕራይ ኣይተዓወተን። ዳግማይ ፈትኑ።');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Reassigning a Parent's Branch or Relationship (Screenshot 4)
  const handleReassignParentBranch = async (rel: Relationship, newBranchName: string) => {
    if (!newBranchName || !editingPerson) return;
    try {
      const now = new Date().toISOString();

      // Find branch head person
      const branchHead =
        people.find(
          (p) =>
            p.canonicalName === newBranchName &&
            (p.fatherName?.includes('ከንቲባ') || p.id.startsWith('pers_p1_'))
        ) || people.find((p) => p.canonicalName === newBranchName);

      if (branchHead && branchHead.id !== rel.fromPersonId) {
        const updatedRel: Relationship = {
          ...rel,
          fromPersonId: branchHead.id,
          sourceWording: `ጨንፈር ${newBranchName}`,
          updatedAt: now,
        };
        await onSaveRelationship(updatedRel);
      }

      // Update editing person's branch & father/mother name
      const isFemaleBranchHead =
        branchHead?.gender === 'female' ||
        newBranchName === 'ትዕበ' ||
        newBranchName === 'ደስታ' ||
        newBranchName === 'ግብፂት';

      const updatedPerson: Person = {
        ...editingPerson,
        branch: newBranchName,
        fatherName: isFemaleBranchHead ? editingPerson.fatherName : newBranchName,
        motherName: isFemaleBranchHead ? newBranchName : editingPerson.motherName,
        updatedAt: now,
      };

      await onUpdatePerson(updatedPerson);
      setEditingPerson(updatedPerson);
      setFormBranch(newBranchName);
      if (!isFemaleBranchHead) {
        setFormFatherName(newBranchName);
      } else {
        setFormMotherName(newBranchName);
      }

      setSaveSuccessMsg(`ናብ ጨንፈር "${newBranchName}" ብዓወት ተቐይሩ ኣሎ!`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch {
      setSaveError('ጨንፈር ምቕያር ኣይተዓወተን።');
    }
  };

  // Handle Reassigning a Child's Branch directly
  const handleReassignChildBranch = async (childPerson: Person | undefined, newBranchName: string) => {
    if (!childPerson || !newBranchName) return;
    try {
      const now = new Date().toISOString();
      const updatedChild: Person = {
        ...childPerson,
        branch: newBranchName,
        updatedAt: now,
      };
      await onUpdatePerson(updatedChild);
      setSaveSuccessMsg(`ናይ ${childPerson.canonicalName} ጨንፈር ናብ "${newBranchName}" ተቐይሩ ኣሎ!`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch {
      setSaveError('ናይ ውሉድ ጨንፈር ምቕያር ኣይተዓወተን።');
    }
  };

  // Handle Delete Relationship
  const handleDeleteRel = async (relId: string) => {
    try {
      await onDeleteRelationship(relId);
      setSaveSuccessMsg('እቲ ዝምድና ብትኽክል ተሰሪዙ ኣሎ።');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch {
      setSaveError('ዝምድና ምስራዝ ኣይተዓወተን።');
    }
  };

  // Handle Delete Person
  const handleDeletePerson = async (id: string) => {
    setIsDeleting(true);
    try {
      await onDeletePerson(id);
      handleCloseEdit();
    } catch {
      setSaveError('ሰብ ምድምሳስ ኣይተዓወተን።');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 font-ethiopic">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center font-bold">
              <Edit3 className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-stone-900">
              መመዓራረዪ መዝገብ ወለዶ
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-stone-100 text-stone-700 border border-stone-200">
              {filteredPeople.length} ካብ {people.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 mt-1 leading-relaxed">
            ኣብዚ ዝተመዝገበ ዝኾነ ስም፣ ስም ኣቦ/ኣደ፣ ጨንፈር ወይ ዝምድናታት ብቐሊሉ ንምትዕርራይ ተጠቐሙ።
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onAddNewPerson && (
            <button
              onClick={onAddNewPerson}
              className="px-3.5 py-2 min-h-[40px] bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ሓድሽ ሰብ ወስኽ</span>
            </button>
          )}

          {onDeduplicate && (
            <button
              onClick={handleRunDeduplication}
              disabled={isDeduplicating}
              className="px-3.5 py-2 min-h-[40px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="ተደገምቲ ኣስማትን ሰባትን ብኣውቶማቲክ ኣዋህድ"
            >
              <RefreshCw className={`w-4 h-4 ${isDeduplicating ? 'animate-spin' : ''}`} />
              <span>ተደገምቲ ኣዋህድ / ኣጻሪ</span>
            </button>
          )}
        </div>
      </div>

      {dedupFeedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">{dedupFeedback}</span>
          </div>
          <button
            onClick={() => setDedupFeedback(null)}
            className="text-emerald-600 hover:text-emerald-800 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-stone-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="relative md:col-span-6">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-400" />
            <input
              type="text"
              placeholder="ብሽም፣ ብስም ኣቦ፣ ብስም ኣደ ወይ ብመፍለዪ ቁጽሪ ድለዩ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-stone-300 bg-stone-50/70 focus:bg-white focus:ring-2 focus:ring-amber-500 text-stone-900"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-stone-400 hover:text-stone-700 p-0.5"
                title="ኣጽሪ"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Branch Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-amber-500 text-stone-800"
            >
              <option value="all">ኩሎም ጨናፍር ({availableBranches.length})</option>
              {availableBranches.map((b) => (
                <option key={b} value={b}>
                  ጨንፈር {b}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-amber-500 text-stone-800"
            >
              <option value="all">ኩሉ ኩነታት</option>
              <option value="verified">ዝተረጋገጸ ጥራይ</option>
              <option value="needs_review">ምምርማር ዘድልዮ</option>
              <option value="unverified">ዘይተረጋገጸ</option>
            </select>
          </div>
        </div>

        {(searchTerm || selectedBranch !== 'all' || selectedStatus !== 'all') && (
          <div className="flex items-center justify-between pt-1 text-xs text-stone-500 border-t border-stone-100">
            <span>
              ዝተረኽቡ: <strong>{filteredPeople.length}</strong> ሰባት
            </span>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedBranch('all');
                setSelectedStatus('all');
              }}
              className="text-amber-800 hover:text-amber-900 font-bold hover:underline cursor-pointer"
            >
              መጻረዪታት ጽረግ
            </button>
          </div>
        )}
      </div>

      {/* People Table */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
        {filteredPeople.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <h4 className="font-bold text-stone-800 text-base">ዝተረኽበ ሰብ የለን</h4>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              በቲ ዘእተኹምዎ ናይ ምድላይ ቃል ወይ መጻረዪ ዝተረኽበ ሰብ የለን። በጃኹም ዳግማይ መርምሩ።
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-sm sm:text-base text-left font-ethiopic">
              <thead className="bg-stone-50/90 font-bold text-stone-800 text-sm sm:text-base">
                <tr>
                  <th className="px-4 py-3.5">ምሉእ ስም</th>
                  <th className="px-4 py-3.5">ስም ኣቦ / ኣደ</th>
                  <th className="px-4 py-3.5">ጨንፈር / ሓረግ</th>
                  <th className="px-4 py-3.5">ጾታ</th>
                  <th className="px-4 py-3.5">ኩነታት</th>
                  <th className="px-4 py-3.5 text-right">ስጉምቲ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-900">
                {filteredPeople.map((p) => {
                  return (
                    <tr key={p.id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-black text-stone-950 text-base sm:text-lg">
                          {p.canonicalName}
                        </div>
                        {p.displayName && (
                          <div className="text-xs sm:text-sm font-semibold text-stone-600">
                            ({p.displayName})
                          </div>
                        )}
                        <div className="text-xs text-stone-400 font-mono">
                          {p.id}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {p.fatherName && (
                          <div className="text-stone-800 text-sm sm:text-base">
                            <span className="text-stone-500 text-xs sm:text-sm">ኣቦ: </span>
                            <span className="font-bold text-stone-950">{p.fatherName}</span>
                          </div>
                        )}
                        {p.motherName && (
                          <div className="text-stone-800 text-sm sm:text-base mt-0.5">
                            <span className="text-stone-500 text-xs sm:text-sm">ኣደ: </span>
                            <span className="font-bold text-stone-950">{p.motherName}</span>
                          </div>
                        )}
                        {!p.fatherName && !p.motherName && (
                          <span className="text-stone-400 italic text-xs sm:text-sm">ዘይተመዝገበ</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {p.branch ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs sm:text-sm font-bold bg-stone-100 text-stone-900 border border-stone-300">
                            {p.branch}
                          </span>
                        ) : (
                          <span className="text-stone-400 italic text-xs sm:text-sm">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-stone-800 font-medium text-sm sm:text-base">
                        {p.gender === 'male' && 'ተባዕታይ'}
                        {p.gender === 'female' && 'ኣንስተይቲ'}
                        {(!p.gender || p.gender === 'unknown') && (
                          <span className="text-stone-400">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {p.status === 'verified' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                            <span>ዝተረጋገጸ</span>
                          </span>
                        )}
                        {p.status === 'needs_review' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold bg-amber-100 text-amber-950 border border-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                            <span>ምምርማር ዘድልዮ</span>
                          </span>
                        )}
                        {p.status === 'unverified' && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold bg-stone-200 text-stone-800 border border-stone-300">
                            ዘይተረጋገጸ
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="px-3 py-1.5 min-h-[36px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors ml-auto cursor-pointer"
                          title="መረዳእታ ኣስተኻኽል"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                          <span>ኣስተኻኽል</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Comprehensive Person Edit Modal */}
      {editingPerson && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col font-ethiopic">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 font-bold text-lg">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-100">
                    ናይ {editingPerson.canonicalName} መረዳእታ ምስትኻኻል
                  </h3>
                  <p className="text-xs text-stone-400">
                    መፍለዪ ቁጽሪ: {editingPerson.id}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseEdit}
                className="text-stone-400 hover:text-white p-1.5 rounded-xl hover:bg-stone-800 transition-colors cursor-pointer"
                aria-label="ዕጾ"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-stone-800">
              {/* Feedback messages */}
              {saveSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold">{saveSuccessMsg}</span>
                </div>
              )}

              {saveError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-bold">{saveError}</span>
                </div>
              )}

              <form onSubmit={handleSavePerson} className="space-y-5">
                {/* Section 1: Names */}
                <div className="bg-stone-50/70 p-4 rounded-2xl border border-stone-200 space-y-3">
                  <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-600" />
                    <span>ስምን ስድራቤታዊ ሓበሬታን</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        ምሉእ ስም (ብትግርኛ) *
                      </label>
                      <input
                        type="text"
                        value={formCanonicalName}
                        onChange={(e) => handleCanonicalNameChange(e.target.value)}
                        placeholder="ምሉእ ስም የእትዉ..."
                        required
                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 bg-white font-ethiopic text-stone-900 focus:ring-2 focus:ring-amber-500"
                      />
                      {formCanonicalName.trim().indexOf(' ') !== -1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const firstName = formCanonicalName.trim().split(/\s+/)[0];
                            setFormCanonicalName(firstName);
                          }}
                          className="text-[11px] text-amber-600 hover:text-amber-800 underline font-ethiopic mt-1 cursor-pointer block"
                        >
                          ስም በዓል ዋና ጥራይ ግበር ("{formCanonicalName.trim().split(/\s+/)[0]}")
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        ተወሳኺ ስም (ወይ ፍሉጥ ስም)
                      </label>
                      <input
                        type="text"
                        value={formDisplayName}
                        onChange={(e) => setFormDisplayName(e.target.value)}
                        placeholder="ተወሳኺ ስም እንተሃልዩ..."
                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 bg-white font-ethiopic text-stone-900 focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-stone-700">
                          ስም ኣቦ
                        </label>
                        {formFatherName && formCanonicalName.trim().indexOf(' ') !== -1 && (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-ethiopic">
                            ብኣውቶማቲክ ዝተረኽበ
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={formFatherName}
                        onChange={(e) => setFormFatherName(e.target.value)}
                        placeholder="ስም ኣቦ..."
                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 bg-white font-ethiopic text-stone-900 focus:ring-2 focus:ring-amber-500"
                      />
                      {formFatherName && formCanonicalName.trim().indexOf(' ') !== -1 && (
                        <p className="text-[11px] text-amber-800 font-ethiopic mt-1">
                          💡 ድሕሪ ስፔስ ዘሎ ሽም (<strong>{formFatherName}</strong>) ናብ ስም ኣቦ ሓሊፉ ኣሎ።
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        ስም ኣደ
                      </label>
                      <input
                        type="text"
                        value={formMotherName}
                        onChange={(e) => setFormMotherName(e.target.value)}
                        placeholder="ስም ኣደ..."
                        className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 bg-white font-ethiopic text-stone-900 focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        ጾታ
                      </label>
                      <select
                        value={formGender}
                        onChange={(e) => setFormGender(e.target.value as 'male' | 'female' | 'unknown')}
                        className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-stone-300 bg-white font-ethiopic text-stone-900 focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="male">ተባዕታይ</option>
                        <option value="female">ኣንስተይቲ</option>
                        <option value="unknown">ዘይተፈልጠ</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        ኩነታት ምርግጋጽ
                      </label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as RecordStatus)}
                        className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-stone-300 bg-white font-ethiopic text-stone-900 focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="verified">ዝተረጋገጸ</option>
                        <option value="needs_review">ምምርማር ዘድልዮ</option>
                        <option value="unverified">ዘይተረጋገጸ</option>
                        <option value="rejected">ዘይቅቡል</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 2: Branch & Lineage */}
                <div className="bg-stone-50/70 p-4 rounded-2xl border border-stone-200 space-y-3">
                  <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-600" />
                    <span>ጨንፈር / ወለዶ</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        ጨንፈር ምረጹ
                      </label>
                      <select
                        value={formBranch}
                        onChange={(e) => setFormBranch(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-stone-300 bg-white font-ethiopic text-stone-900 focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">ዘይተወሰነ</option>
                        {availableBranches.map((b) => (
                          <option key={b} value={b}>
                            ጨንፈር {b}
                          </option>
                        ))}
                        <option value="custom">ካልእ ፍሉይ ጨንፈር የእቱ...</option>
                      </select>
                    </div>

                    {formBranch === 'custom' && (
                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          ፍሉይ ስም ጨንፈር
                        </label>
                        <input
                          type="text"
                          value={formCustomBranch}
                          onChange={(e) => setFormCustomBranch(e.target.value)}
                          placeholder="ሽም ጨንፈር ጽሓፉ..."
                          className="w-full px-3.5 py-2 text-sm rounded-xl border border-stone-300 bg-white font-ethiopic text-stone-900 focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Section: Spouse / Marriage Note (Screenshot 2 & 3) */}
                <div className="bg-stone-50/70 p-4 rounded-2xl border border-stone-200 space-y-2">
                  <label className="block text-xs font-bold text-stone-700 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-rose-500" />
                      <span>ናይ መርዓ / መጻምድቲ መብርሂ (Spouse Note)</span>
                    </span>
                    <span className="text-[10px] text-stone-400 font-normal">ኣብ ስክሪን ዝረአ ናይ መርዓ ጽሑፍ</span>
                  </label>
                  <input
                    type="text"
                    value={formSpouseNote}
                    onChange={(e) => setFormSpouseNote(e.target.value)}
                    placeholder="ንኣብነት፡ ትዕበ ከንቲባ ጉዕሽ ናብ ሊዝ ሓሊቦ ወልደገርግስ ኣትያ ዝወለደቶም ድማ"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-stone-300 bg-white font-ethiopic text-stone-900 focus:ring-2 focus:ring-amber-500"
                  />
                  {formSpouseNote && (
                    <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                      እዚ ጽሑፍ ኣብቲ ቀንዲ ካርድ መዝገብ ከምዚ ኮይኑ ይወጽእ: <strong>{formSpouseNote}</strong>
                    </p>
                  )}
                </div>

                {/* Section 3: Notes */}
                <div className="bg-stone-50/70 p-4 rounded-2xl border border-stone-200 space-y-2">
                  <label className="block text-xs font-bold text-stone-700">
                    መተሓሳሰቢ / መብርሂ
                  </label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    rows={2}
                    placeholder="ዝኾነ መተሓሳሰቢ ወይ መብርሂ እንተሃልዩ..."
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-stone-300 bg-white font-ethiopic text-stone-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Save Button for Person Information */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseEdit}
                    className="px-4 py-2 min-h-[40px] rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                  >
                    ሰርዝ
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 min-h-[40px] bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'ይዕቀብ ኣሎ...' : 'ለውጢ ኣቐምጥ'}</span>
                  </button>
                </div>
              </form>

              {/* Section 4: Direct Relationships Management */}
              <div className="pt-4 border-t border-stone-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    <GitFork className="w-4 h-4 text-amber-600" />
                    <span>ተተሓሓዝቲ ዝምድናታት</span>
                  </h4>
                </div>

                {/* Parents */}
                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 space-y-2">
                  <span className="text-xs font-bold text-stone-700 block">
                    ወለዲ (ኣቦ / ኣደ) ({currentRelationships.parents.length})
                  </span>
                  {currentRelationships.parents.length === 0 ? (
                    <p className="text-xs text-stone-400 italic">ዝተመዝገበ ወላዲ የለን።</p>
                  ) : (
                    <div className="space-y-1.5">
                      {currentRelationships.parents.map(({ rel, person }) => (
                        <div
                          key={rel.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-stone-900 text-sm block">
                              {person ? person.canonicalName : rel.fromPersonId}
                            </span>
                            {rel.sourceWording && (
                              <span className="text-[11px] text-stone-500 block break-words">
                                {rel.sourceWording}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Branch Selector Option (Screenshot 4) */}
                            <select
                              value={person?.branch || editingPerson.branch || ''}
                              onChange={(e) => handleReassignParentBranch(rel, e.target.value)}
                              className="px-2.5 py-1 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-lg cursor-pointer transition-colors shadow-2xs"
                              title="ካብቶም ጨንፈራት ምረጹ"
                            >
                              <option value="" disabled>🌿 ጨንፈር ምረጽ...</option>
                              {availableBranches.map((b) => (
                                <option key={b} value={b}>
                                  ጨንፈር {b}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => handleDeleteRel(rel.id)}
                              className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              title="ዝምድና ሰርዝ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Children */}
                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 space-y-2">
                  <span className="text-xs font-bold text-stone-700 block">
                    ውሉዳት ({currentRelationships.children.length})
                  </span>
                  {currentRelationships.children.length === 0 ? (
                    <p className="text-xs text-stone-400 italic">ዝተመዝገበ ውሉድ የለን።</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {currentRelationships.children.map(({ rel, person }) => (
                        <div
                          key={rel.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-stone-200 text-xs"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-stone-900">
                              {person ? person.canonicalName : rel.toPersonId}
                            </span>
                            {person?.branch && (
                              <span className="text-[10px] text-stone-500 ml-1">
                                ({person.branch})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {person && (
                              <select
                                value={person.branch || ''}
                                onChange={(e) => handleReassignChildBranch(person, e.target.value)}
                                className="px-2 py-0.5 text-[11px] font-medium bg-stone-50 hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-lg cursor-pointer"
                                title="ናይዚ ውሉድ ጨንፈር ምረጽ"
                              >
                                <option value="" disabled>ጨንፈር ምረጽ...</option>
                                {availableBranches.map((b) => (
                                  <option key={b} value={b}>
                                    ጨንፈር {b}
                                  </option>
                                ))}
                              </select>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteRel(rel.id)}
                              className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              title="ዝምድና ሰርዝ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Partners / Spouses */}
                <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 space-y-2">
                  <span className="text-xs font-bold text-stone-700 block">
                    መጻምድቲ ({currentRelationships.partners.length})
                  </span>
                  {currentRelationships.partners.length === 0 ? (
                    <p className="text-xs text-stone-400 italic">ዝተመዝገበ መጻምድቲ የለን።</p>
                  ) : (
                    <div className="space-y-1.5">
                      {currentRelationships.partners.map(({ rel, person }) => (
                        <div
                          key={rel.id}
                          className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-stone-200 text-xs"
                        >
                          <div>
                            <span className="font-bold text-stone-900">
                              {person ? person.canonicalName : 'መጻምድቲ'}
                            </span>
                            {rel.sourceWording && (
                              <span className="text-[10px] text-stone-500 block">
                                {rel.sourceWording}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteRel(rel.id)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="ዝምድና ሰርዝ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Danger Zone: Delete Person */}
              <div className="pt-4 border-t border-rose-100 bg-rose-50/50 p-4 rounded-2xl border">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-rose-900">
                      ሰብ ካብ መዝገብ ምድምሳስ
                    </h5>
                    <p className="text-[11px] text-rose-700 mt-0.5">
                      እዚ ሰብ ምስ ተደምሰሰ ኩሎም ተተሓሓዝቲ ዝምድናታት እውን ክስረዙ እዮም።
                    </p>
                  </div>

                  {confirmDeleteId === editingPerson.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDeletePerson(editingPerson.id)}
                        disabled={isDeleting}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        {isDeleting ? 'ይድምሰስ ኣሎ...' : 'ብርግጽ ደምስስ'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        ሰርዝ
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(editingPerson.id)}
                      className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ደምስስ</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
