import React, { useState, useMemo } from 'react';
import { Person, Relationship, RecordStatus } from '../types/genealogy';
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
  ShieldAlert
} from 'lucide-react';

interface PersonDetailModalProps {
  person: Person | null;
  people: Person[];
  relationships: Relationship[];
  onClose: () => void;
  onUpdatePerson: (updated: Person) => Promise<void>;
  onDeletePerson: (id: string) => Promise<void>;
  onAddRelationship: (fromPersonId: string) => void;
  onDeleteRelationship: (relId: string) => Promise<void>;
}

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({
  person,
  people,
  relationships,
  onClose,
  onUpdatePerson,
  onDeletePerson,
  onAddRelationship,
  onDeleteRelationship,
}) => {
  if (!person) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [canonicalName, setCanonicalName] = useState(person.canonicalName);
  const [displayName, setDisplayName] = useState(person.displayName || '');
  const [branch, setBranch] = useState(person.branch || '');
  const [notes, setNotes] = useState(person.notes || '');
  const [status, setStatus] = useState<RecordStatus>(person.status);
  const [reviewerNote, setReviewerNote] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const handleSaveEdit = async () => {
    const updated: Person = {
      ...person,
      canonicalName,
      displayName: displayName.trim() || undefined,
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
              <p className="text-xs text-stone-400 font-mono">
                ID: {person.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-stone-800">
          {/* Quick Review Status Strip */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-stone-600">Verification Status:</span>
              {status === 'verified' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Verified
                </span>
              )}
              {status === 'needs_review' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Needs Review
                </span>
              )}
              {status === 'unverified' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-stone-200 text-stone-700">
                  Unverified
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <button
                onClick={() => handleQuickStatusChange('verified')}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm transition-colors"
              >
                Mark Verified
              </button>
              <button
                onClick={() => handleQuickStatusChange('needs_review')}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg shadow-sm transition-colors"
              >
                Flag Review
              </button>
            </div>
          </div>

          {/* Person Metadata Fields (Edit Mode or Read Mode) */}
          {isEditing ? (
            <div className="space-y-4 p-4 bg-stone-50 rounded-xl border border-stone-200">
              <h4 className="font-semibold text-sm text-stone-800">Edit Person Record</h4>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Canonical Source Name (Exact Tigrinya/Ge'ez)
                </label>
                <input
                  type="text"
                  value={canonicalName}
                  onChange={(e) => setCanonicalName(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 bg-white font-ethiopic"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Reviewed Display Name (Optional English or Normalized)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Branch</label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 bg-white font-ethiopic"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as RecordStatus)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 bg-white"
                  >
                    <option value="unverified">Unverified</option>
                    <option value="needs_review">Needs Review</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-stone-300 bg-white"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg flex items-center space-x-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-white rounded-lg border border-stone-200">
                <span className="text-xs text-stone-400 block">Canonical Name</span>
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
                <span className="text-xs text-stone-400 block">Branch Lineage</span>
                <span className="font-semibold text-stone-800 font-ethiopic">
                  {person.branch || 'Unassigned / Patriarch'}
                </span>
              </div>

              {/* Source Provenance */}
              <div className="p-3 bg-white rounded-lg border border-stone-200 md:col-span-2">
                <span className="text-xs text-stone-400 flex items-center space-x-1 mb-1">
                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                  <span>Source Provenance (ከሰተ-ብርሃነ.pdf)</span>
                </span>
                <div className="text-xs text-stone-700 space-y-1">
                  {person.sourcePage && (
                    <p>
                      <strong>PDF Page:</strong> Page {person.sourcePage}
                    </p>
                  )}
                  {person.sourceHeading && (
                    <p>
                      <strong>Heading / Phrase:</strong> {person.sourceHeading}
                    </p>
                  )}
                  {person.notes && (
                    <p className="text-stone-500 whitespace-pre-line mt-1">
                      <strong>Notes:</strong> {person.notes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Relationships Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h3 className="font-bold text-sm text-stone-800 flex items-center space-x-2">
                <GitCommit className="w-4 h-4 text-amber-600" />
                <span>Documented Relationships</span>
              </h3>
              <button
                onClick={() => onAddRelationship(person.id)}
                className="px-2.5 py-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg font-medium flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Link Relationship</span>
              </button>
            </div>

            {/* Parents List */}
            <div>
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block mb-1.5">
                Parents / Source Ancestors ({parents.length})
              </span>
              {parents.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No parent relationships documented.</p>
              ) : (
                <div className="space-y-1.5">
                  {parents.map(({ rel, person: parentPerson }) => (
                    <div
                      key={rel.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200 text-xs"
                    >
                      <div>
                        <span className="font-bold font-ethiopic text-stone-900 mr-2">
                          {parentPerson?.canonicalName || 'Unknown Person'}
                        </span>
                        <span className="text-stone-500">({rel.type})</span>
                        {rel.sourceWording && (
                          <span className="text-stone-400 block text-[11px] truncate max-w-sm">
                            Evidence: {rel.sourceWording}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => onDeleteRelationship(rel.id)}
                        className="text-stone-400 hover:text-rose-600 p-1 rounded"
                        title="Delete Relationship"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Partners List */}
            {partners.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block mb-1.5">
                  Partners / Union Statements ({partners.length})
                </span>
                <div className="space-y-1.5">
                  {partners.map(({ rel, person: partnerPerson }) => (
                    <div
                      key={rel.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-purple-50/60 border border-purple-200 text-xs"
                    >
                      <div>
                        <span className="font-bold font-ethiopic text-purple-950 mr-2">
                          {partnerPerson?.canonicalName || 'Unknown Partner'}
                        </span>
                        <span className="text-purple-600">Union Statement</span>
                        {rel.sourceWording && (
                          <span className="text-stone-500 block text-[11px]">
                            {rel.sourceWording}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => onDeleteRelationship(rel.id)}
                        className="text-stone-400 hover:text-rose-600 p-1 rounded"
                        title="Delete Union"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Children List */}
            <div>
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block mb-1.5">
                Children ({children.length})
              </span>
              {children.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No children documented.</p>
              ) : (
                <div className="space-y-1.5">
                  {children.map(({ rel, person: childPerson }) => (
                    <div
                      key={rel.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200 text-xs"
                    >
                      <div>
                        <span className="font-bold font-ethiopic text-stone-900 mr-2">
                          {childPerson?.canonicalName || 'Unknown Child'}
                        </span>
                        {rel.status === 'needs_review' && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-100 text-amber-800">
                            Needs Review
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => onDeleteRelationship(rel.id)}
                        className="text-stone-400 hover:text-rose-600 p-1 rounded"
                        title="Delete Relationship"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Delete Confirmation Warning */}
          {showDeleteConfirm && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-2 text-rose-900 text-xs">
              <div className="flex items-center space-x-2 font-bold text-rose-800 text-sm">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Confirm Permanent Deletion</span>
              </div>
              <p>
                Are you sure you want to delete <strong>{person.canonicalName}</strong>?
              </p>
              <p className="text-rose-700">
                This will also permanently remove <strong>{totalAffectedRels}</strong> connected relationship links.
                This action cannot be undone unless restored from a prior backup.
              </p>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1 bg-white border border-stone-300 rounded text-stone-700"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await onDeletePerson(person.id);
                    onClose();
                  }}
                  className="px-3 py-1 bg-rose-600 text-white rounded font-medium hover:bg-rose-700"
                >
                  Yes, Delete Person and Links
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-rose-600 hover:text-rose-800 font-medium flex items-center space-x-1"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Person...</span>
          </button>

          <div className="flex items-center space-x-2">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 border border-stone-300 bg-white rounded-lg hover:bg-stone-100 text-stone-700 font-medium flex items-center space-x-1"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Record</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-lg font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

