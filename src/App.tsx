import React, { useState, useEffect, useCallback } from 'react';
import {
  Person,
  Relationship,
  SourceOccurrence,
  AuditEvent,
  Source
} from './types/genealogy';
import {
  getAllPeople,
  getAllRelationships,
  getAllOccurrences,
  getAllAuditEvents,
  getDatasetMode,
  savePerson,
  deletePerson,
  saveRelationship,
  deleteRelationship,
  bulkLoadData
} from './services/db';
import { isCloudConfigured } from './services/supabaseClient';
import { DEMO_PEOPLE, DEMO_RELATIONSHIPS, DEMO_OCCURRENCES } from './services/demoData';

import { Navbar } from './components/Navbar';
import { TreeViewer } from './components/TreeViewer';
import { Directory } from './components/Directory';
import { UncertainRecordsView } from './components/UncertainRecordsView';
import { ImportModal } from './components/ImportModal';
import { ExportModal } from './components/ExportModal';
import { AuditLogViewer } from './components/AuditLogViewer';
import { StorageSettingsModal } from './components/StorageSettingsModal';
import { PersonDetailModal } from './components/PersonDetailModal';
import { RelationshipModal } from './components/RelationshipModal';

import { AlertTriangle, Sparkles, Plus, RefreshCw, BookOpen } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tree' | 'directory' | 'uncertain' | 'audit' | 'import' | 'export' | 'settings'>('tree');
  const [people, setPeople] = useState<Person[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [occurrences, setOccurrences] = useState<SourceOccurrence[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [datasetMode, setDatasetMode] = useState<'real' | 'demo' | 'empty'>('empty');
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [initialRelFromId, setInitialRelFromId] = useState<string | undefined>(undefined);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonBranch, setNewPersonBranch] = useState('');

  // Reload all data from local IndexedDB
  const reloadData = useCallback(async () => {
    try {
      const [storedPeople, storedRels, storedOccs, storedAudits, mode] = await Promise.all([
        getAllPeople(true),
        getAllRelationships(),
        getAllOccurrences(),
        getAllAuditEvents(),
        getDatasetMode(),
      ]);

      setPeople(storedPeople);
      setRelationships(storedRels);
      setOccurrences(storedOccs);
      setAuditEvents(storedAudits);
      setDatasetMode(mode);
    } catch (err) {
      console.error('Failed to load database:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  // Handle Person CRUD
  const handleUpdatePerson = async (updated: Person) => {
    await savePerson(updated, 'User');
    await reloadData();
    setSelectedPerson(updated);
  };

  const handleDeletePerson = async (id: string) => {
    await deletePerson(id, 'User');
    await reloadData();
    setSelectedPerson(null);
  };

  const handleCreateNewPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;

    const newPerson: Person = {
      id: `pers_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      canonicalName: newPersonName.trim(),
      branch: newPersonBranch.trim() || undefined,
      status: 'unverified',
      isArchived: false,
      notes: 'Manually created record.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await savePerson(newPerson, 'User');
    setNewPersonName('');
    setNewPersonBranch('');
    setShowAddPersonModal(false);
    await reloadData();
    setSelectedPerson(newPerson);
  };

  // Handle Relationship CRUD
  const handleSaveRelationship = async (rel: Relationship) => {
    const result = await saveRelationship(rel, 'User');
    if (result.success) {
      await reloadData();
    }
    return result;
  };

  const handleDeleteRelationship = async (relId: string) => {
    await deleteRelationship(relId, 'User');
    await reloadData();
  };

  const handleOpenAddRelationship = (fromPersonId?: string) => {
    setInitialRelFromId(fromPersonId);
    setShowRelationshipModal(true);
  };

  // Counts for badge
  const needsReviewCount = people.filter((p) => p.status === 'needs_review').length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-stone-700 font-medium font-ethiopic text-lg">ሓረግ ወለዶ ከንቲባ ጉዑሽ ይዳሎ ኣሎ...</p>
          <p className="text-stone-400 text-xs">Initializing local-first IndexedDB archive...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        datasetMode={datasetMode}
        isCloudConnected={isCloudConfigured()}
        needsReviewCount={needsReviewCount}
        totalPeopleCount={people.length}
      />

      {/* Notice Banner when Dataset is Demo or Empty */}
      {datasetMode === 'demo' && (
        <aside aria-label="Dataset status" className="bg-amber-100/90 border-b border-amber-300 px-4 py-2 text-xs text-amber-950 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Demo Data Active:</strong> You are viewing sample demonstrator records.
              Real family records have not yet been imported.
            </span>
          </div>
          <button
            onClick={() => setActiveTab('import')}
            className="px-2.5 py-0.5 bg-amber-700 hover:bg-amber-800 text-white rounded font-medium text-[11px] transition-colors"
          >
            Go to Staged Import &rarr;
          </button>
        </aside>
      )}

      {datasetMode === 'empty' && (
        <aside aria-label="Dataset status" className="bg-stone-200 border-b border-stone-300 px-4 py-2.5 text-xs text-stone-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-stone-600 shrink-0" />
            <span>
              Welcome! Your database is currently clean and empty.
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                bulkLoadData({
                  people: DEMO_PEOPLE,
                  relationships: DEMO_RELATIONSHIPS,
                  occurrences: DEMO_OCCURRENCES,
                  mode: 'demo',
                }, 'Demo Initializer').then(reloadData);
              }}
              className="px-2.5 py-1 bg-white border border-stone-300 hover:bg-stone-50 rounded text-stone-800 font-medium text-[11px]"
            >
              Load Demo Data
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium text-[11px]"
            >
              Start Staged Import &rarr;
            </button>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'tree' && (
          <TreeViewer
            people={people}
            relationships={relationships}
            onSelectPerson={setSelectedPerson}
            onAddRelationship={() => handleOpenAddRelationship()}
            onAddPerson={() => setShowAddPersonModal(true)}
          />
        )}

        {activeTab === 'directory' && (
          <Directory
            people={people}
            relationships={relationships}
            onSelectPerson={setSelectedPerson}
            onAddNewPerson={() => setShowAddPersonModal(true)}
          />
        )}

        {activeTab === 'uncertain' && (
          <UncertainRecordsView
            people={people}
            relationships={relationships}
            onSelectPerson={setSelectedPerson}
            onUpdatePerson={handleUpdatePerson}
            onUpdateRelationship={handleSaveRelationship}
          />
        )}

        {activeTab === 'import' && (
          <ImportModal onImportCommitted={reloadData} />
        )}

        {activeTab === 'export' && (
          <ExportModal
            people={people}
            relationships={relationships}
            sources={[]}
            occurrences={occurrences}
            auditEvents={auditEvents}
            datasetMode={datasetMode}
            onRestored={reloadData}
          />
        )}

        {activeTab === 'audit' && (
          <AuditLogViewer auditEvents={auditEvents} />
        )}

        {activeTab === 'settings' && (
          <StorageSettingsModal
            datasetMode={datasetMode}
            totalPeople={people.length}
            totalRelationships={relationships.length}
            onDataReset={reloadData}
          />
        )}
      </main>

      {/* Person Detail & Review Modal */}
      {selectedPerson && (
        <PersonDetailModal
          person={selectedPerson}
          people={people}
          relationships={relationships}
          onClose={() => setSelectedPerson(null)}
          onUpdatePerson={handleUpdatePerson}
          onDeletePerson={handleDeletePerson}
          onAddRelationship={handleOpenAddRelationship}
          onDeleteRelationship={handleDeleteRelationship}
        />
      )}

      {/* Create Relationship Modal */}
      {showRelationshipModal && (
        <RelationshipModal
          initialFromPersonId={initialRelFromId}
          people={people}
          relationships={relationships}
          onClose={() => setShowRelationshipModal(false)}
          onSaveRelationship={handleSaveRelationship}
        />
      )}

      {/* Quick Add Person Modal */}
      {showAddPersonModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-stone-900">Add New Person Record</h3>
            <form onSubmit={handleCreateNewPerson} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Canonical Name (Tigrinya/Ge'ez) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ተክለ"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 font-ethiopic text-sm"
                />
              </div>
              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Branch / Context (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ጎብሩ"
                  value={newPersonBranch}
                  onChange={(e) => setNewPersonBranch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 font-ethiopic text-sm"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPersonModal(false)}
                  className="px-3 py-1.5 border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium"
                >
                  Create Person
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-stone-900 border-t border-stone-800 text-stone-400 text-xs py-4 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            Kinteba Guush Family Genealogy &middot; ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ &middot; ጸሓፊ ከሰተ ብርሃነ ወልዱ
          </p>
          <p className="text-stone-500 font-mono">
            Local-First IndexedDB Archive &middot; Private & Offline Capable
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;

