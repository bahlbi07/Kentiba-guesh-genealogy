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
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <GitCommit className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base text-amber-100">Document Relationship Link</h3>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs text-stone-700">
          {/* Cycle / Error Warning Banner */}
          {!cycleValidation.isValid && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Generational Cycle Detected!</p>
                <p className="mt-0.5">{cycleValidation.error}</p>
              </div>
            </div>
          )}

          {saveError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800">
              <p className="font-bold">Error:</p>
              <p>{saveError}</p>
            </div>
          )}

          {/* People Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-800 mb-1">
                Parent / From Person *
              </label>
              <select
                value={fromPersonId}
                onChange={(e) => setFromPersonId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white font-ethiopic"
                required
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.canonicalName} ({p.id.replace('pers_', '#')})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">
                Child / To Person *
              </label>
              <select
                value={toPersonId}
                onChange={(e) => setToPersonId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white font-ethiopic"
                required
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.canonicalName} ({p.id.replace('pers_', '#')})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Type & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-800 mb-1">Relationship Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as RelationshipType)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
              >
                <option value="parent_child">Biological Parent-Child</option>
                <option value="partner_or_union">Partner / Union Statement</option>
                <option value="other_source_statement">Other Source Statement</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-800 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as RecordStatus)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
              >
                <option value="unverified">Unverified</option>
                <option value="needs_review">Needs Review</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Source Evidence */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
            <span className="font-bold text-stone-900 block">Source Evidence & Provenance</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-stone-600 mb-1">Source File</label>
                <input
                  type="text"
                  value={sourceFile}
                  onChange={(e) => setSourceFile(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
                />
              </div>
              <div>
                <label className="block text-stone-600 mb-1">PDF Page</label>
                <input
                  type="number"
                  min="1"
                  max="36"
                  value={sourcePage}
                  onChange={(e) => setSourcePage(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-stone-600 mb-1">
                Exact Source Phrase / Heading (Tigrinya)
              </label>
              <input
                type="text"
                placeholder="e.g. ጎብሩ ከንቲባ ጉዕሽ ዝወለዶም"
                value={sourceWording}
                onChange={(e) => setSourceWording(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white font-ethiopic"
              />
            </div>
          </div>

          {/* Biological Confirmation Checkbox */}
          {type === 'parent_child' && (
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isBiologicalConfirmed}
                onChange={(e) => setIsBiologicalConfirmed(e.target.checked)}
                className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-stone-700">
                Mark as direct biological parentage (uncheck if only cultural/household phrasing)
              </span>
            </label>
          )}

          <div>
            <label className="block font-semibold text-stone-800 mb-1">Reviewer Notes</label>
            <textarea
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              rows={2}
              placeholder="Add verification notes or citation reasons..."
              className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-stone-300 rounded-lg hover:bg-stone-100 text-stone-700"
            >
              Cancel
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
              Save Relationship
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

