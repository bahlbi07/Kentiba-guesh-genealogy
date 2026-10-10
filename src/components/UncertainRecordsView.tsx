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
  Check
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
  const [editFromPersonId, setEditFromPersonId] = useState('');
  const [editToPersonId, setEditToPersonId] = useState('');
  const [editType, setEditType] = useState<RelationshipType>('parent_child');
  const [editWording, setEditWording] = useState('');
  const [editStatus, setEditStatus] = useState<RecordStatus>('verified');
  const [fromSearchQuery, setFromSearchQuery] = useState('');
  const [toSearchQuery, setToSearchQuery] = useState('');
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
    setEditType(r.type);
    setEditWording(r.sourceWording || '');
    setEditStatus('verified'); // Auto mark as verified when edited and approved
    setFromSearchQuery('');
    setToSearchQuery('');
    setEditError(null);
  };

  // Save Edited Relationship
  const handleSaveEditedRel = async (shouldApprove = true) => {
    if (!editingRel) return;
    if (!editFromPersonId || !editToPersonId) {
      setEditError('ክልቲኦም ሰባት ምረጹ።');
      return;
    }
    if (editFromPersonId === editToPersonId) {
      setEditError('ሰብ ምስ ርእሱ ዝምድና ክህልዎ ኣይኽእልን።');
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);
    try {
      const updated: Relationship = {
        ...editingRel,
        fromPersonId: editFromPersonId,
        toPersonId: editToPersonId,
        type: editType,
        sourceWording: editWording.trim() || editingRel.sourceWording,
        status: shouldApprove ? 'verified' : editStatus,
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
                      {p.fatherName || p.branch || 'ከንቲባ ጉዑሽ ሓጎስ'}
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

            <div className="space-y-4 text-xs">
              {/* Parent / Partner Selection */}
              <div className="space-y-1.5">
                <label className="block font-bold text-stone-800">
                  ወላዲ / መጻምድቲ (ካበይ) *
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="ስም ወላዲ ጽሒፍካ ድለ..."
                    value={fromSearchQuery}
                    onChange={(e) => setFromSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-300 text-xs font-ethiopic mb-1.5 focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <select
                  value={editFromPersonId}
                  onChange={(e) => setEditFromPersonId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-ethiopic text-xs cursor-pointer focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">ወላዲ / መጻምድቲ ምረጽ...</option>
                  {filteredFromPeople.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.canonicalName} {p.branch ? `(${p.branch})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-stone-500">
                  ዝተመረጸ: <strong className="text-stone-800">{peopleMap.get(editFromPersonId)?.canonicalName || editFromPersonId}</strong>
                </p>
              </div>

              {/* Child / Target Selection */}
              <div className="space-y-1.5">
                <label className="block font-bold text-stone-800">
                  ውሉድ / ተቐባሊ (ንመን) *
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="ስም ውሉድ ጽሒፍካ ድለ..."
                    value={toSearchQuery}
                    onChange={(e) => setToSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-300 text-xs font-ethiopic mb-1.5 focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <select
                  value={editToPersonId}
                  onChange={(e) => setEditToPersonId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-ethiopic text-xs cursor-pointer focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">ውሉድ ምረጽ...</option>
                  {filteredToPeople.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.canonicalName} {p.branch ? `(${p.branch})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-stone-500">
                  ዝተመረጸ: <strong className="text-stone-800">{peopleMap.get(editToPersonId)?.canonicalName || editToPersonId}</strong>
                </p>
              </div>

              {/* Relationship Type */}
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
            <div className="pt-3 border-t border-stone-200 flex items-center justify-between gap-2">
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

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setEditingRel(null)}
                  className="px-3.5 py-2 border border-stone-300 rounded-xl text-stone-700 font-bold text-xs hover:bg-stone-50 cursor-pointer"
                >
                  ሰርዝ
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEditedRel(true)}
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingEdit ? 'የዕርኽ ኣሎ...' : 'ኣስተኻኺልካ ኣጽድቕ'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
