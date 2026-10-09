import React, { useState, useEffect, useCallback } from 'react';
import {
  Person,
  Relationship,
  SourceOccurrence,
  AuditEvent
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

import { Navbar, AppDestination } from './components/Navbar';
import { FamilyExplorer } from './components/FamilyExplorer';
import { Directory } from './components/Directory';
import { FamilyInformationView } from './components/FamilyInformationView';
import { AboutArchive } from './components/AboutArchive';
import { AdminPanel } from './components/AdminPanel';
import { PersonDetailModal } from './components/PersonDetailModal';
import { RelationshipModal } from './components/RelationshipModal';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';

import { AlertTriangle, BookOpen } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppDestination>('tree');
  const [people, setPeople] = useState<Person[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [occurrences, setOccurrences] = useState<SourceOccurrence[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [datasetMode, setDatasetMode] = useState<'real' | 'demo' | 'empty'>('empty');
  const [isLoading, setIsLoading] = useState(true);

  // Modals and selection state
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [initialRelFromId, setInitialRelFromId] = useState<string | undefined>(undefined);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonBranch, setNewPersonBranch] = useState('');

  // Admin authentication state
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('kinteba_admin_auth') === 'true';
  });

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

      // Auto-select root or first person if none selected
      if (!selectedPerson && storedPeople.length > 0) {
        const root = storedPeople.find(
          (p) => p.canonicalName.includes('ከንቲባ ጉዑሽ') || p.id === 'pers_p1_0_0'
        );
        setSelectedPerson(root || storedPeople[0]);
      }
    } catch (err) {
      console.error('Failed to load database:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPerson]);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  // Handle Person CRUD
  const handleUpdatePerson = async (updated: Person) => {
    await savePerson(updated, 'Admin');
    await reloadData();
    setSelectedPerson(updated);
  };

  const handleDeletePerson = async (id: string) => {
    await deletePerson(id, 'Admin');
    await reloadData();
    if (selectedPerson?.id === id) {
      setSelectedPerson(null);
    }
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
      notes: 'Manually entered record.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await savePerson(newPerson, 'Admin');
    setNewPersonName('');
    setNewPersonBranch('');
    setShowAddPersonModal(false);
    await reloadData();
    setSelectedPerson(newPerson);
  };

  // Handle Relationship CRUD
  const handleSaveRelationship = async (rel: Relationship) => {
    const result = await saveRelationship(rel, 'Admin');
    if (result.success) {
      await reloadData();
    }
    return result;
  };

  const handleDeleteRelationship = async (relId: string) => {
    await deleteRelationship(relId, 'Admin');
    await reloadData();
  };

  const handleOpenAddRelationship = (fromPersonId?: string) => {
    setInitialRelFromId(fromPersonId);
    setShowRelationshipModal(true);
  };

  const handleAdminLogin = (token: string, username: string) => {
    sessionStorage.setItem('kinteba_admin_auth', 'true');
    sessionStorage.setItem('kinteba_admin_user', username);
    sessionStorage.setItem('kinteba_admin_token', token);
    setIsAdminAuthenticated(true);
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem('kinteba_admin_auth');
    sessionStorage.removeItem('kinteba_admin_user');
    sessionStorage.removeItem('kinteba_admin_token');
    setIsAdminAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-stone-700 font-medium font-ethiopic text-lg">
            ሓረግ ወለዶ ከንቲባ ጉዑሽ ይዳሎ ኣሎ...
          </p>
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
        totalPeopleCount={people.length}
        hasSelectedPerson={!!selectedPerson}
        isAdminAuthenticated={isAdminAuthenticated}
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
            onClick={() => setActiveTab('admin')}
            className="px-2.5 py-0.5 bg-amber-700 hover:bg-amber-800 text-white rounded font-medium text-[11px] transition-colors"
          >
            Go to Admin &rarr;
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
                bulkLoadData(
                  {
                    people: DEMO_PEOPLE,
                    relationships: DEMO_RELATIONSHIPS,
                    occurrences: DEMO_OCCURRENCES,
                    mode: 'demo',
                  },
                  'Demo Initializer'
                ).then(reloadData);
              }}
              className="px-2.5 py-1 bg-white border border-stone-300 hover:bg-stone-50 rounded text-stone-800 font-medium text-[11px]"
            >
              Load Demo Data
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium text-[11px]"
            >
              Open Admin Import &rarr;
            </button>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Destination 1: Progressive Family Explorer */}
        {activeTab === 'tree' && (
          <FamilyExplorer
            people={people}
            relationships={relationships}
            onSelectPerson={(p) => {
              setSelectedPerson(p);
            }}
            onOpenDetails={(p) => {
              setSelectedPerson(p);
              setShowPersonModal(true);
            }}
          />
        )}

        {/* Destination 2: People Directory & Search */}
        {activeTab === 'directory' && (
          <Directory
            people={people}
            relationships={relationships}
            onSelectPerson={(p) => {
              setSelectedPerson(p);
              setActiveTab('details');
            }}
            onAddNewPerson={() => {
              if (isAdminAuthenticated) {
                setShowAddPersonModal(true);
              } else {
                setActiveTab('admin');
              }
            }}
          />
        )}

        {/* Destination 3: Family Information & Details View */}
        {activeTab === 'details' && (
          <FamilyInformationView
            person={selectedPerson}
            people={people}
            relationships={relationships}
            onSelectPerson={(p) => setSelectedPerson(p)}
            onExploreInTree={(p) => {
              setSelectedPerson(p);
              setActiveTab('tree');
            }}
          />
        )}

        {/* Destination 4: About This Archive */}
        {activeTab === 'about' && (
          <AboutArchive />
        )}

        {/* Destination 5: Protected Administrator Area */}
        {activeTab === 'admin' && (
          <AdminPanel
            people={people}
            relationships={relationships}
            occurrences={occurrences}
            auditEvents={auditEvents}
            isAuthenticated={isAdminAuthenticated}
            onLogin={handleAdminLogin}
            onLogout={handleAdminLogout}
            onSelectPerson={(p) => {
              setSelectedPerson(p);
              setShowPersonModal(true);
            }}
            onUpdatePerson={handleUpdatePerson}
            onDeletePerson={handleDeletePerson}
            onSaveRelationship={handleSaveRelationship}
            onDeleteRelationship={handleDeleteRelationship}
            onAddNewPerson={() => setShowAddPersonModal(true)}
            onAddNewRelationship={() => handleOpenAddRelationship()}
            onImportCommitted={reloadData}
          />
        )}
      </main>

      {/* PWA Mobile Installation Prompt Banner */}
      <PwaInstallPrompt />

      {/* Person Detail & Edit Modal */}
      {selectedPerson && showPersonModal && (
        <PersonDetailModal
          person={selectedPerson}
          people={people}
          relationships={relationships}
          onClose={() => setShowPersonModal(false)}
          onUpdatePerson={handleUpdatePerson}
          onDeletePerson={handleDeletePerson}
          onAddRelationship={(fromId: string) => handleOpenAddRelationship(fromId)}
          onDeleteRelationship={handleDeleteRelationship}
        />
      )}

      {/* Relationship Modal */}
      {showRelationshipModal && (
        <RelationshipModal
          people={people}
          relationships={relationships}
          initialFromPersonId={initialRelFromId}
          onClose={() => setShowRelationshipModal(false)}
          onSaveRelationship={handleSaveRelationship}
        />
      )}

      {/* Add Person Modal (Protected) */}
      {showAddPersonModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
            <h3 className="text-lg font-bold text-stone-900 font-ethiopic mb-4">
              ሓድሽ ሰብ መዝግብ (Register New Person)
            </h3>
            <form onSubmit={handleCreateNewPerson} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  ትክክለኛ ስም (Tigrinya Name) *
                </label>
                <input
                  type="text"
                  required
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  placeholder="ንኣብነት: ጎብሩ"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 font-ethiopic"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  ጨንፈር (Branch)
                </label>
                <input
                  type="text"
                  value={newPersonBranch}
                  onChange={(e) => setNewPersonBranch(e.target.value)}
                  placeholder="ንኣብነት: ጎብሩ"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500 font-ethiopic"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPersonModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  ሰርዝ (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm"
                >
                  ኣጽድቕ (Save)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
