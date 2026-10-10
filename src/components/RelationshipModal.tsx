import React, { useState, useMemo } from 'react';
import { Person, Relationship, RelationshipType, RecordStatus } from '../types/genealogy';
import { validateParentChildCycle } from '../services/cycleDetector';
import { X, GitCommit, AlertTriangle, ShieldCheck } from 'lucide-react';

interface RelationshipModalProps {
  initialFromPersonId?: string;
  people: Person[];
  relationships: Relationship[];
  onClose: () => void;
  onSaveRelationship: (rel: Relationship) => Promise<{ success: boolean; error?: string }>;
}

export const RelationshipModal: React.FC<RelationshipModalProps> = ({
  initialFromPersonId,
  people,
  relationships,
  onClose,
  onSaveRelationship,
}) => {
  const [fromPersonId, setFromPersonId] = useState(initialFromPersonId || (people[0]?.id || ''));
  const [toPersonId, setToPersonId] = useState(
    people.find((p) => p.id !== (initialFromPersonId || people[0]?.id))?.id || ''
  );
  const [type, setType] = useState<RelationshipType>('parent_child');
  const [status, setStatus] = useState<RecordStatus>('unverified');
  const [sourceFile, setSourceFile] = useState('ከሰተ-ብርሃነ.pdf');
  const [sourcePage, setSourcePage] = useState<number | ''>(1);
  const [sourceWording, setSourceWording] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [isBiologicalConfirmed, setIsBiologicalConfirmed] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Real-time cycle validation
  const cycleValidation = useMemo(() => {
    if (type !== 'parent_child') return { isValid: true };
    return validateParentChildCycle(relationships, fromPersonId, toPersonId);
  }, [relationships, fromPersonId, toPersonId, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (!fromPersonId || !toPersonId) {
      setSaveError('Please select both people.');
      return;
    }

    if (fromPersonId === toPersonId) {
      setSaveError('A person cannot have a relationship with themselves.');
      return;
    }

    if (!cycleValidation.isValid) {
      setSaveError(cycleValidation.error || 'Invalid parent-child relationship: cycle detected.');
      return;
    }

    const newRel: Relationship = {
      id: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      fromPersonId,
      toPersonId,
      type,
      status,
      sourceFile,
      sourcePage: typeof sourcePage === 'number' ? sourcePage : null,
      sourceWording: sourceWording.trim(),
      reviewerNotes: reviewerNotes.trim(),
      isBiologicalConfirmed: type === 'parent_child' ? isBiologicalConfirmed : false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await onSaveRelationship(newRel);
    if (result.success) {
      onClose();
    } else {
      setSaveError(result.error || 'Failed to save relationship.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between font-ethiopic">
          <div className="flex items-center space-x-2">
            <GitCommit className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base text-amber-100">ዝምድና መዝግብ</h3>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800"
            aria-label="ዕጾ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs text-stone-700 font-ethiopic">
          {/* Cycle / Error Warning Banner */}
          {!cycleValidation.isValid && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">ጌጋ ዑደት ወለዶ ተረኺቡ!</p>
                <p className="mt-0.5">{cycleValidation.error}</p>
              </div>
            </div>
          )}

          {saveError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800">
              <p className="font-bold">ጌጋ:</p>
              <p>{saveError}</p>
            </div>
          )}

          {/* People Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-800 mb-1">
                ወላዲ / ካብ ሰብ *
              </label>
              <select
                value={fromPersonId}
                onChange={(e) => setFromPersonId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white font-ethiopic"
                required
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.canonicalName} {p.branch ? `(${p.branch})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">
                ውሉድ / ናብ ሰብ *
              </label>
              <select
                value={toPersonId}
                onChange={(e) => setToPersonId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white font-ethiopic"
                required
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.canonicalName} {p.branch ? `(${p.branch})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Type & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-800 mb-1">ዓይነት ዝምድና</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as RelationshipType)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white font-ethiopic"
              >
                <option value="parent_child">ወላድን ውሉድን</option>
                <option value="partner_or_union">መጻምድቲ / ሓዳር</option>
                <option value="other_source_statement">ካልእ ዝምድና</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">ኩነታት</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as RecordStatus)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white font-ethiopic"
              >
                <option value="unverified">ዘይተረጋገጸ</option>
                <option value="needs_review">ምምርማር ዘድልዮ</option>
                <option value="verified">ዝተረጋገጸ</option>
                <option value="rejected">ዘይቅቡል</option>
              </select>
            </div>
          </div>

          {/* Natural Relationship Note */}
          <div>
            <label className="block font-semibold text-stone-800 mb-1">
              መግለጺ ወይ መተሓሳሰቢ ዝምድና
            </label>
            <input
              type="text"
              placeholder="ንኣብነት: ጎብሩ ከንቲባ ጉዕሽ ዝወለዶም"
              value={sourceWording}
              onChange={(e) => setSourceWording(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white font-ethiopic"
            />
          </div>

          {/* Biological Confirmation Checkbox */}
          {type === 'parent_child' && (
            <label className="flex items-center space-x-2 cursor-pointer font-ethiopic">
              <input
                type="checkbox"
                checked={isBiologicalConfirmed}
                onChange={(e) => setIsBiologicalConfirmed(e.target.checked)}
                className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-stone-700">
                ቀጥታዊ ባዮሎጂካዊ ወላዲ ምዃኑ ኣረጋግጽ
              </span>
            </label>
          )}

          <div>
            <label className="block font-semibold text-stone-800 mb-1">ተወሳኺ መተሓሳሰቢ</label>
            <textarea
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              rows={2}
              placeholder="ተወሳኺ መረዳእታ ወይ መተሓሳሰቢ ጽሓፍ..."
              className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white font-ethiopic"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-200 font-ethiopic">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-stone-300 rounded-lg hover:bg-stone-100 text-stone-700"
            >
              ሰርዝ
            </button>
            <button
              type="submit"
              disabled={!cycleValidation.isValid}
              className={`px-4 py-1.5 rounded-lg text-white font-medium shadow-sm transition-colors ${
                !cycleValidation.isValid
                  ? 'bg-stone-400 cursor-not-allowed'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              ኣቐምጥ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

