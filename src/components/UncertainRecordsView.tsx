import React, { useState, useMemo } from 'react';
import { Person, Relationship, RelationshipType, RecordStatus } from '../types/genealogy';
import {
  AlertTriangle,
  CheckCircle,
  Edit3,
  CheckCheck,
  X,
  GitFork,
  Search,
  Trash2,
  Save,
  Check,
  User,
  UserPlus
} from 'lucide-react';

interface UncertainRecordsViewProps {
  people: Person[];
  relationships: Relationship[];
  onSelectPerson: (person: Person) => void;
  onUpdatePerson: (person: Person) => Promise<void>;
  onUpdateRelationship: (rel: Relationship) => Promise<{ success: boolean; error?: string }>;
  onDeleteRelationship?: (id: string) => Promise<void>;
}

export const UncertainRecordsView: React.FC<UncertainRecordsViewProps> = ({
  people,
  relationships,
  onSelectPerson,
  onUpdatePerson,
  onUpdateRelationship,
  onDeleteRelationship,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  // Editing Relationship State
  const [editingRel, setEditingRel] = useState<Relationship | null>(null);
  const [fromMode, setFromMode] = useState<'rename' | 'select' | 'new'>('rename');
  const [fromName, setFromName] = useState('');
  const [editFromPersonId, setEditFromPersonId] = useState('');
  const [fromSearchQuery, setFromSearchQuery] = useState('');

  const [toMode, setToMode] = useState<'rename' | 'select' | 'new'>('rename');
  const [toName, setToName] = useState('');
  const [editToPersonId, setEditToPersonId] = useState('');
  const [toSearchQuery, setToSearchQuery] = useState('');

  const [editType, setEditType] = useState<RelationshipType>('parent_child');
  const [editWording, setEditWording] = useState('');
  const [editStatus, setEditStatus] = useState<RecordStatus>('needs_review');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const peopleMap = useMemo(() => {
    const map = new Map<string, Person>();
    for (const p of people) {
      map.set(p.id, p);
    }
    return map;
  }, [people]);

  const uncertainPeople = people.filter((p) => p.status === 'needs_review');
  const uncertainRelationships = relationships.filter((r) => r.status === 'needs_review');

  // Verify single person
  const handleVerifyPerson = async (p: Person) => {
    await onUpdatePerson({
      ...p,
      status: 'verified',
      updatedAt: new Date().toISOString(),
    });
  };

  // Verify single relationship
  const handleVerifyRel = async (r: Relationship) => {
    await onUpdateRelationship({
      ...r,
      status: 'verified',
      updatedAt: new Date().toISOString(),
    });
  };

  // Open Edit Relationship Modal
  const handleOpenEditRel = (r: Relationship) => {
    setEditingRel(r);
    setEditFromPersonId(r.fromPersonId);
    setEditToPersonId(r.toPersonId);

    const fromPerson = peopleMap.get(r.fromPersonId);
    setFromName(fromPerson ? fromPerson.canonicalName : '');
    setFromMode('rename');

    const toPerson = peopleMap.get(r.toPersonId);
    setToName(toPerson ? toPerson.canonicalName : '');
    setToMode('rename');

    setEditType(r.type);
    setEditWording(r.sourceWording || '');
    setEditStatus(r.status || 'needs_review');
    setFromSearchQuery('');
    setToSearchQuery('');
    setEditError(null);
  };

  // Save Edited Relationship
  const handleSaveEditedRel = async (shouldApprove = false) => {
    if (!editingRel) return;
    setIsSavingEdit(true);
    setEditError(null);

    try {
      let finalFromId = editFromPersonId;
      let finalToId = editToPersonId;

      // 1. Resolve From Person (ወላዲ / መጻምድቲ)
      if (fromMode === 'rename') {
        const trimmed = fromName.trim();
        if (!trimmed) {
          setEditError('ስም ወላዲ / መጻምድቲ ባዶ ክኸውን ኣይኽእልን።');
          return;
        }
        const existing = peopleMap.get(editFromPersonId);
        if (existing) {
          if (existing.canonicalName !== trimmed) {
            await onUpdatePerson({
              ...existing,
              canonicalName: trimmed,
              updatedAt: new Date().toISOString(),
            });
          }
          finalFromId = existing.id;
        } else {
          const newId = `pers_manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await onUpdatePerson({
            id: newId,
            canonicalName: trimmed,
            status: shouldApprove ? 'verified' : 'needs_review',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isArchived: false,
            notes: 'ኣብ ዝምድና ምስትኽኻል ዝተፈጠረ',
          });
          finalFromId = newId;
        }
      } else if (fromMode === 'new') {
        const trimmed = fromName.trim();
        if (!trimmed) {
          setEditError('ሓድሽ ስም ወላዲ / መጻምድቲ ምልኡ።');
          return;
        }
        const newId = `pers_manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await onUpdatePerson({
          id: newId,
          canonicalName: trimmed,
          status: shouldApprove ? 'verified' : 'needs_review',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isArchived: false,
          notes: 'ኣብ ዝምድና ምስትኽኻል ዝተፈጠረ',
        });
        finalFromId = newId;
      } else {
        if (!editFromPersonId) {
          setEditError('ካብ መዝገብ ወላዲ / መጻምድቲ ምረጹ።');
          return;
        }
        finalFromId = editFromPersonId;
      }

      // 2. Resolve To Person (ውሉድ / ተቐባሊ)
      if (toMode === 'rename') {
        const trimmed = toName.trim();
        if (!trimmed) {
          setEditError('ስም ውሉድ / መጻምድቲ ባዶ ክኸውን ኣይኽእልን።');
          return;
        }
        const existing = peopleMap.get(editToPersonId);
        if (existing) {
          if (existing.canonicalName !== trimmed) {
            await onUpdatePerson({
              ...existing,
              canonicalName: trimmed,
              updatedAt: new Date().toISOString(),
            });
          }
          finalToId = existing.id;
        } else {
          const newId = `pers_manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await onUpdatePerson({
            id: newId,
            canonicalName: trimmed,
            status: shouldApprove ? 'verified' : 'needs_review',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isArchived: false,
            notes: 'ኣብ ዝምድና ምስትኽኻል ዝተፈጠረ',
          });
          finalToId = newId;
        }
      } else if (toMode === 'new') {
        const trimmed = toName.trim();
        if (!trimmed) {
          setEditError('ሓድሽ ስም ውሉድ / መጻምድቲ ምልኡ።');
          return;
        }
        const newId = `pers_manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await onUpdatePerson({
          id: newId,
          canonicalName: trimmed,
          status: shouldApprove ? 'verified' : 'needs_review',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isArchived: false,
          notes: 'ኣብ ዝምድና ምስትኽኻል ዝተፈጠረ',
        });
        finalToId = newId;
      } else {
        if (!editToPersonId) {
          setEditError('ካብ መዝገብ ውሉድ / ተቐባሊ ምረጹ።');
          return;
        }
        finalToId = editToPersonId;
      }

      // 3. Validation
      if (finalFromId === finalToId) {
        setEditError('ሰብ ምስ ርእሱ ዝምድና ክህልዎ ኣይኽእልን።');
        return;
      }

      const finalStatus: RecordStatus = shouldApprove ? 'verified' : editStatus;

      const updated: Relationship = {
        ...editingRel,
        fromPersonId: finalFromId,
        toPersonId: finalToId,
        type: editType,
        sourceWording: editWording.trim() || editingRel.sourceWording,
        status: finalStatus,
        updatedAt: new Date().toISOString(),
      };

      const res = await onUpdateRelationship(updated);
      if (res.success) {
        setEditingRel(null);
      } else {
        setEditError(res.error || 'ምዕራይ ኣይተዓወተን።');
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete Relationship
  const handleDeleteRel = async () => {
    if (!editingRel || !onDeleteRelationship) return;
    setIsSavingEdit(true);
    try {
      await onDeleteRelationship(editingRel.id);
      setEditingRel(null);
    } catch {
      setEditError('ምድምሳስ ኣይተዓወተን።');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Bulk verify all people
  const handleVerifyAllPeople = async () => {
    if (uncertainPeople.length === 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      for (const p of uncertainPeople) {
        await onUpdatePerson({
          ...p,
          status: 'verified',
          updatedAt: new Date().toISOString(),
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Bulk verify all relationships
  const handleVerifyAllRelationships = async () => {
    if (uncertainRelationships.length === 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      for (const r of uncertainRelationships) {
        await onUpdateRelationship({
          ...r,
          status: 'verified',
          updatedAt: new Date().toISOString(),
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Approve everything at once
  const handleVerifyAll = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      for (const p of uncertainPeople) {
        await onUpdatePerson({
          ...p,
          status: 'verified',
          updatedAt: new Date().toISOString(),
        });
      }
      for (const r of uncertainRelationships) {
        await onUpdateRelationship({
          ...r,
          status: 'verified',
          updatedAt: new Date().toISOString(),
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper to format clean Tigrinya explanation without English or PDF provenance
  const getPersonExplanation = (p: Person): string => {
    const text = `${p.notes || ''} ${p.sourceHeading || ''}`;
    if (text.includes('Opening names') || text.includes('ሓረግ ወለዶ') || !p.fatherName) {
      return 'ናይ መበቆል ኣቦ ቀጥታዊ ጨንፈር / ውሉድ';
    }
    if (text.includes('continuation') || text.includes('Continuation')) {
      return 'ናይ ወለዶ ምቕጻል ዝምድና';
    }
    if (text.includes('union') || text.includes('Union') || text.includes('ኣትያ') || text.includes('ዝወለደቶም')) {
      return 'ናይ ሓዳር / መጻምድቲ ውሉድ';
    }
    const geezMatch = text.match(/[\u1200-\u137F\s]+/g);
    if (geezMatch && geezMatch.join('').trim().length > 3) {
      return geezMatch.join(' ').trim();
    }
    return 'ናይ ወለዶ መዝገብ';
  };

  const getRelationshipExplanation = (r: Relationship): string => {
    const text = `${r.sourceWording || ''} ${r.reviewerNotes || ''}`;
    if (text.includes('opening') || text.includes('Opening') || text.includes('ሓረግ ወለዶ')) {
      return 'ናይ መበቆል ኣቦ ቀጥታዊ ጨንፈር';
    }
    if (text.includes('continuation') || text.includes('Continuation')) {
      return 'ናይ ወለዶ ምቕጻል ዝምድና';
    }
    if (text.includes('union') || text.includes('Union') || text.includes('ኣትያ') || text.includes('ዝወለደቶም')) {
      return 'ናይ ሓዳር / መጻምድቲ ዝምድና';
    }
    if (r.sourceWording) {
      const geezMatch = r.sourceWording.match(/[\u1200-\u137F\s]+/g);
      if (geezMatch && geezMatch.join('').trim().length > 3) {
        return geezMatch.join(' ').trim();
      }
    }
    return 'ዝምድና ወላድን ውሉድን';
  };

  const totalUncertain = uncertainPeople.length + uncertainRelationships.length;

  // Filter people for the from/to dropdowns in edit modal
  const filteredFromPeople = useMemo(() => {
    const q = fromSearchQuery.toLowerCase().trim();
    if (!q) return people.slice(0, 40);
    return people
      .filter((p) => p.canonicalName.toLowerCase().includes(q) || (p.branch && p.branch.toLowerCase().includes(q)))
      .slice(0, 40);
  }, [people, fromSearchQuery]);

  const filteredToPeople = useMemo(() => {
    const q = toSearchQuery.toLowerCase().trim();
    if (!q) return people.slice(0, 40);
    return people
      .filter((p) => p.canonicalName.toLowerCase().includes(q) || (p.branch && p.branch.toLowerCase().includes(q)))
      .slice(0, 40);
  }, [people, toSearchQuery]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-6 font-ethiopic">
      {/* Top Banner & Fast Action */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-amber-800 font-semibold text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>ምሕደራ መዛግብቲ</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900">
            ምምርማር ዘድልዮም መዛግብቲ
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 max-w-2xl">
            እዚ ክፍሊ ተወሳኺ መረጋገጺ ዝደልዩ ውሑዳት መዛግብቲ ብቐሊሉ ንምርኣይ፡ ንምእራምን ብሓደ ጠውቂ ንምጽዳቕን ዝጠቅም እዩ።
          </p>
        </div>

        {totalUncertain > 0 && (
          <button
            onClick={handleVerifyAll}
            disabled={isProcessing}
            className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer disabled:bg-stone-300 disabled:cursor-not-allowed"
          >
            <CheckCheck className="w-4 h-4" />
            <span>{isProcessing ? 'የጽድቕ ኣሎ...' : 'ንኹሎም ብሓንሳብ ኣጽድቕ'}</span>
          </button>
        )}
      </div>

      {/* People Table */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
            <span>ምምርማር ዘድልዮም ኣባላት</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-900 font-bold">
              {uncertainPeople.length}
            </span>
          </h3>

          {uncertainPeople.length > 0 && (
            <button
              onClick={handleVerifyAllPeople}
              disabled={isProcessing}
              className="text-xs font-bold text-emerald-800 hover:text-emerald-900 hover:underline cursor-pointer"
            >
              ንኹሎም ኣባላት ኣጽድቕ
            </button>
          )}
        </div>

        {uncertainPeople.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
            <p className="font-bold text-stone-800 text-sm">ኩሎም ኣባላት ስድራቤት ዝተረጋገጹ እዮም!</p>
            <p className="text-xs text-stone-500">ምምርማር ዘድልዮ ዝተረፈ ሰብ የለን።</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-xs text-left">
              <thead className="bg-stone-50 font-semibold text-stone-700">
                <tr>
                  <th className="px-4 py-3">ምሉእ ስም</th>
                  <th className="px-4 py-3">ወላዲ / ጨንፈር</th>
                  <th className="px-4 py-3">መብርሂ</th>
                  <th className="px-4 py-3 text-right">ስጉምቲ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-800">
                {uncertainPeople.map((p) => (
                  <tr key={p.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-sm text-stone-900">
                      {p.canonicalName}
                    </td>
                    <td className="px-4 py-3 text-stone-600 font-medium">
                      {p.fatherName || p.branch || 'ከንቲባ ጉዕሽ ሓጎስ'}
                    </td>
                    <td className="px-4 py-3 text-stone-600 max-w-sm">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[11px]">
                        {getPersonExplanation(p)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleVerifyPerson(p)}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer shadow-xs active:scale-95"
                      >
                        ኣጽድቕ
                      </button>
                      <button
                        onClick={() => onSelectPerson(p)}
                        className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                        title="ኣስተኻኽል"
                      >
                        <Edit3 className="w-3.5 h-3.5 inline mr-1 text-stone-600" />
                        <span>ኣስተኻኽል</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Relationships Table with Inline & Modal Editing */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
            <span>ምምርማር ዘድልዮም ዝምድናታት</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-900 font-bold">
              {uncertainRelationships.length}
            </span>
          </h3>

          {uncertainRelationships.length > 0 && (
            <button
              onClick={handleVerifyAllRelationships}
              disabled={isProcessing}
              className="text-xs font-bold text-emerald-800 hover:text-emerald-900 hover:underline cursor-pointer"
            >
              ንኹሎም ዝምድናታት ኣጽድቕ
            </button>
          )}
        </div>

        {uncertainRelationships.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
            <p className="font-bold text-stone-800 text-sm">ኩሎም ዝምድናታት ዝተረጋገጹ እዮም!</p>
            <p className="text-xs text-stone-500">ምምርማር ዘድልዮ ዝተረፈ ዝምድና የለን።</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-xs text-left">
              <thead className="bg-stone-50 font-semibold text-stone-700">
                <tr>
                  <th className="px-4 py-3">ወላዲ / መጻምድቲ</th>
                  <th className="px-4 py-3">ውሉድ</th>
                  <th className="px-4 py-3">ዓይነት ዝምድና</th>
                  <th className="px-4 py-3">መብርሂ</th>
                  <th className="px-4 py-3 text-right">ስጉምቲ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-800">
                {uncertainRelationships.map((r) => {
                  const parentName = peopleMap.get(r.fromPersonId)?.canonicalName || r.fromPersonId;
                  const childName = peopleMap.get(r.toPersonId)?.canonicalName || r.toPersonId;

                  return (
                    <tr key={r.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-4 py-3 font-bold text-stone-900 text-xs">
                        <span className={parentName === 'ናብ' ? 'text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded' : ''}>
                          {parentName}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-stone-800 text-xs">
                        {childName}
                      </td>
                      <td className="px-4 py-3 text-stone-700 font-medium">
                        {r.type === 'parent_child'
                          ? 'ወላድን ውሉድን'
                          : r.type === 'partner_or_union'
                          ? 'መጻምድቲ / ሓዳር'
                          : 'ካልእ ዝምድና'}
                      </td>
                      <td className="px-4 py-3 text-stone-600 max-w-xs">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[11px]">
                          {getRelationshipExplanation(r)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleVerifyRel(r)}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer shadow-xs active:scale-95"
                          title="ኣጽድቕ"
                        >
                          ኣጽድቕ
                        </button>
                        <button
                          onClick={() => handleOpenEditRel(r)}
                          className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                          title="ኣስተኻኽል"
                        >
                          <Edit3 className="w-3.5 h-3.5 inline mr-1 text-stone-600" />
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

      {/* MODERN RELATIONSHIP EDIT MODAL */}
      {editingRel && (
        <div className="fixed inset-0 z-60 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <GitFork className="w-4 h-4 rotate-180" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-base">ዝምድና ኣስተኻኽል</h3>
                  <p className="text-[11px] text-stone-500">ትኽክለኛ ወላዲ፡ ውሉድን ዓይነት ዝምድናን ኣዐሪኻ መዝግብ</p>
                </div>
              </div>
              <button
                onClick={() => setEditingRel(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs max-h-[68vh] overflow-y-auto pr-1">
              {/* Parent / Partner Selection */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label className="font-bold text-stone-800 text-xs flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-700" />
                    <span>ወላዲ / መጻምድቲ (ካበይ) *</span>
                  </label>
                  <div className="inline-flex p-0.5 bg-stone-200/80 rounded-lg text-[11px] font-medium">
                    <button
                      type="button"
                      onClick={() => setFromMode('rename')}
                      className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                        fromMode === 'rename'
                          ? 'bg-white text-stone-900 font-bold shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      ✏️ ስም ኣስተኻኽል
                    </button>
                    <button
                      type="button"
                      onClick={() => setFromMode('select')}
                      className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                        fromMode === 'select'
                          ? 'bg-white text-stone-900 font-bold shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      🔍 ካብ መዝገብ ምረጽ
                    </button>
                    <button
                      type="button"
                      onClick={() => setFromMode('new')}
                      className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                        fromMode === 'new'
                          ? 'bg-white text-stone-900 font-bold shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      ➕ ሓድሽ ሰብ
                    </button>
                  </div>
                </div>

                {fromMode === 'rename' && (
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      placeholder="ስም ወላዲ/መጻምድቲ ኣስተኻኽል..."
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-ethiopic text-xs focus:ring-2 focus:ring-amber-500 font-semibold text-stone-900"
                    />
                    <p className="text-[10.5px] text-stone-500">
                      እዚ ስም ኣብ መዝገብ ቀጥታ ይስተኻኸል (ንኣብነት ናብ ዝነበረ ናብ <strong>ግደይ</strong> ንምቕያር)።
                    </p>
                  </div>
                )}

                {fromMode === 'select' && (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
                      <input
                        type="text"
                        placeholder="ስም ወላዲ ጽሒፍካ ድለ..."
                        value={fromSearchQuery}
                        onChange={(e) => setFromSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-300 text-xs font-ethiopic mb-1 focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <select
                      value={editFromPersonId}
                      onChange={(e) => {
                        setEditFromPersonId(e.target.value);
                        const p = peopleMap.get(e.target.value);
                        if (p) setFromName(p.canonicalName);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-ethiopic text-xs cursor-pointer focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">ካብ ዝተመዝገቡ ምረጽ...</option>
                      {filteredFromPeople.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.canonicalName} {p.branch ? `(${p.branch})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {fromMode === 'new' && (
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      placeholder="ሓድሽ ስም ወላዲ/መጻምድቲ ጽሓፍ..."
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-amber-50/40 font-ethiopic text-xs focus:ring-2 focus:ring-amber-500 font-semibold text-stone-900"
                    />
                    <p className="text-[10.5px] text-amber-700">
                      ሓድሽ ሰብ ኣብ መዝገብ ተፈጢሩ ምስዚ ዝምድና ክተኣሳሰር እዩ።
                    </p>
                  </div>
                )}
              </div>

              {/* Child / Target Selection */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label className="font-bold text-stone-800 text-xs flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-teal-700" />
                    <span>ውሉድ / ተቐባሊ (ንመን) *</span>
                  </label>
                  <div className="inline-flex p-0.5 bg-stone-200/80 rounded-lg text-[11px] font-medium">
                    <button
                      type="button"
                      onClick={() => setToMode('rename')}
                      className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                        toMode === 'rename'
                          ? 'bg-white text-stone-900 font-bold shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      ✏️ ስም ኣስተኻኽል
                    </button>
                    <button
                      type="button"
                      onClick={() => setToMode('select')}
                      className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                        toMode === 'select'
                          ? 'bg-white text-stone-900 font-bold shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      🔍 ካብ መዝገብ ምረጽ
                    </button>
                    <button
                      type="button"
                      onClick={() => setToMode('new')}
                      className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                        toMode === 'new'
                          ? 'bg-white text-stone-900 font-bold shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      ➕ ሓድሽ ሰብ
                    </button>
                  </div>
                </div>

                {toMode === 'rename' && (
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={toName}
                      onChange={(e) => setToName(e.target.value)}
                      placeholder="ስም ውሉድ/ተቐባሊ ኣስተኻኽል..."
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-ethiopic text-xs focus:ring-2 focus:ring-amber-500 font-semibold text-stone-900"
                    />
                    <p className="text-[10.5px] text-stone-500">
                      እዚ ስም ንኹሉ ናይዚ ሰብ መዝገብ ቀጥታ ይቕይሮ።
                    </p>
                  </div>
                )}

                {toMode === 'select' && (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
                      <input
                        type="text"
                        placeholder="ስም ውሉድ ጽሒፍካ ድለ..."
                        value={toSearchQuery}
                        onChange={(e) => setToSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-300 text-xs font-ethiopic mb-1 focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <select
                      value={editToPersonId}
                      onChange={(e) => {
                        setEditToPersonId(e.target.value);
                        const p = peopleMap.get(e.target.value);
                        if (p) setToName(p.canonicalName);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-ethiopic text-xs cursor-pointer focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">ካብ ዝተመዝገቡ ምረጽ...</option>
                      {filteredToPeople.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.canonicalName} {p.branch ? `(${p.branch})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {toMode === 'new' && (
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={toName}
                      onChange={(e) => setToName(e.target.value)}
                      placeholder="ሓድሽ ስም ውሉድ/ተቐባሊ ጽሓፍ..."
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-amber-50/40 font-ethiopic text-xs focus:ring-2 focus:ring-amber-500 font-semibold text-stone-900"
                    />
                    <p className="text-[10.5px] text-amber-700">
                      ሓድሽ ሰብ ኣብ መዝገብ ተፈጢሩ ምስዚ ዝምድና ክተኣሳሰር እዩ።
                    </p>
                  </div>
                )}
              </div>

              {/* Relationship Type & Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-stone-800">
                    ዓይነት ዝምድና
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as RelationshipType)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-ethiopic text-xs cursor-pointer focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="parent_child">ወላድን ውሉድን</option>
                    <option value="partner_or_union">መጻምድቲ / ሓዳር</option>
                    <option value="other_source_statement">ካልእ ዝምድና</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-stone-800">
                    ኩነታት ምርመራ
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as RecordStatus)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-ethiopic text-xs cursor-pointer focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="needs_review">ክምርመር ዘለዎ (Needs Review)</option>
                    <option value="verified">ዝተረጋገፀ / ጽዱቕ (Verified)</option>
                    <option value="unverified">ዘይተረጋገፀ (Unverified)</option>
                  </select>
                </div>
              </div>

              {/* Notes / Description */}
              <div className="space-y-1">
                <label className="block font-bold text-stone-800">
                  መግለጺ / መተሓሳሰቢ
                </label>
                <input
                  type="text"
                  placeholder="ንኣብነት: ተኪኤ ሃይሉ ኣረሞ ዝወለዶም ድማ..."
                  value={editWording}
                  onChange={(e) => setEditWording(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-ethiopic text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2">
              {onDeleteRelationship && (
                <button
                  type="button"
                  onClick={handleDeleteRel}
                  disabled={isSavingEdit}
                  className="px-3 py-2 text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ደምስስ</span>
                </button>
              )}

              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setEditingRel(null)}
                  className="px-3.5 py-2 border border-stone-300 rounded-xl text-stone-700 font-bold text-xs hover:bg-stone-50 cursor-pointer"
                >
                  ሰርዝ
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEditedRel(false)}
                  disabled={isSavingEdit}
                  className="px-3.5 py-2 border border-amber-600 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingEdit ? 'የቐምጥ ኣሎ...' : 'ለውጢ ኣቐምጥ'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEditedRel(true)}
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingEdit ? 'የፅድቕ ኣሎ...' : 'ኣስተኻኺልካ ኣጽድቕ'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
