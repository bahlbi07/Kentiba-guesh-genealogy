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
import { apiFetchTree } from './services/apiClient';
import { INITIAL_PEOPLE, INITIAL_RELATIONSHIPS, INITIAL_OCCURRENCES } from './data/initialGenealogyData';

import { Navbar, AppDestination } from './components/Navbar';
import { FamilyExplorer } from './components/FamilyExplorer';
import { Directory } from './components/Directory';
import { FamilyInformationView } from './components/FamilyInformationView';
import { AboutArchive } from './components/AboutArchive';
import { AdminPanel } from './components/AdminPanel';
import { PersonDetailModal } from './components/PersonDetailModal';
import { RelationshipModal } from './components/RelationshipModal';
import { AddPersonGuidedModal } from './components/AddPersonGuidedModal';
import { GenealogyPdfExportModal } from './components/GenealogyPdfExportModal';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppDestination>('tree');
  const [people, setPeople] = useState<Person[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [occurrences, setOccurrences] = useState<SourceOccurrence[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [datasetMode, setDatasetMode] = useState<'real' | 'demo' | 'empty'>('real');
  const [isLoading, setIsLoading] = useState(true);

  // Modals and selection state
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [initialRelFromId, setInitialRelFromId] = useState<string | undefined>(undefined);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [showPdfExportModal, setShowPdfExportModal] = useState(false);

  // Admin authentication state
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('kinteba_admin_auth') === 'true';
  });

  // Reload all data from local IndexedDB with automatic real-dataset seeding
  const reloadData = useCallback(async () => {
    try {
      let storedPeople = await getAllPeople(true);
      let storedRels = await getAllRelationships();
      let storedOccs = await getAllOccurrences();
      let storedAudits = await getAllAuditEvents();
      let mode = await getDatasetMode();

      // Check if client database is missing records (e.g. stale client cache with only 531 people)
      // or still in demo mode. Auto-upgrade to the authoritative dataset.
      const needsDatasetUpgrade =
        storedPeople.length === 0 ||
        mode === 'demo' ||
        storedPeople.length < INITIAL_PEOPLE.length ||
        storedRels.length < INITIAL_RELATIONSHIPS.length;

      if (needsDatasetUpgrade) {
        await bulkLoadData(
          {
            people: INITIAL_PEOPLE,
            relationships: INITIAL_RELATIONSHIPS,
            occurrences: INITIAL_OCCURRENCES,
            mode: 'real',
          },
          'Auto-seed Authoritative Dataset'
        );
        storedPeople = await getAllPeople(true);
        storedRels = await getAllRelationships();
        storedOccs = await getAllOccurrences();
        storedAudits = await getAllAuditEvents();
        mode = 'real';
      }

      // Synchronize with server backend for live updates across all family members
      try {
        const serverTree = await apiFetchTree();
        if (serverTree && serverTree.people && serverTree.people.length > 0) {
          let hasNewServerData = false;
          const localPersonMap = new Map(storedPeople.map((p) => [p.id, p]));
          for (const sp of serverTree.people) {
            const existing = localPersonMap.get(sp.id);
            if (!existing || (sp.updatedAt && existing.updatedAt && sp.updatedAt > existing.updatedAt)) {
              await savePerson(sp, 'ServerSync');
              localPersonMap.set(sp.id, sp);
              hasNewServerData = true;
            }
          }

          const localRelMap = new Map(storedRels.map((r) => [r.id, r]));
          for (const sr of serverTree.relationships) {
            const existing = localRelMap.get(sr.id);
            if (!existing || (sr.updatedAt && existing.updatedAt && sr.updatedAt > existing.updatedAt)) {
              await saveRelationship(sr, 'ServerSync');
              localRelMap.set(sr.id, sr);
              hasNewServerData = true;
            }
          }

          if (hasNewServerData) {
            storedPeople = await getAllPeople(true);
            storedRels = await getAllRelationships();
          }
        }
      } catch (syncErr) {
        // Silently proceed with local offline database
      }

      setPeople(storedPeople);
      setRelationships(storedRels);
      setOccurrences(storedOccs);
      setAuditEvents(storedAudits);
      setDatasetMode(mode);

      // Auto-select root ancestor if none selected
      setSelectedPerson((prev) => {
        if (!prev && storedPeople.length > 0) {
          const root = storedPeople.find(
            (p) =>
              p.id === 'pers_root_kinteba_guush' ||
              p.canonicalName.includes('ከንቲባ ጉዑሽ') ||
              p.canonicalName.includes('ከንቲባ ጉዕሽ') ||
              p.id === 'pers_p1_0_0'
          );
          return root || storedPeople[0];
        }
        return prev;
      });
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
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-stone-900 font-bold font-ethiopic text-xl">
            ተወለድ እንዳቦይ ከንትባ ጉዕሽ ይዳሎ ኣሎ...
          </p>
          <p className="text-stone-500 font-ethiopic text-sm">
            መዝገብ ወለዶ ኣብዚ መሳርሒ ይዳሎ ኣሎ።
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans">
      {/* Top Navbar: 3 Core Simple Tabs */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        datasetMode={datasetMode}
        isCloudConnected={isCloudConfigured()}
        totalPeopleCount={people.length}
        hasSelectedPerson={!!selectedPerson}
        isAdminAuthenticated={isAdminAuthenticated}
        onOpenPdfExport={() => setShowPdfExportModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Core Tab 1: Progressive Family Explorer */}
        {activeTab === 'tree' && (
          <FamilyExplorer
            people={people}
            relationships={relationships}
            onSelectPerson={(p) => {
              setSelectedPerson(p);
            }}
          />
        )}

        {/* Core Tab 2: People Directory & Search */}
        {(activeTab === 'directory' || activeTab === 'details') && (
          <Directory
            people={people}
            relationships={relationships}
            onSelectPerson={(p) => {
              setSelectedPerson(p);
              if (isAdminAuthenticated) {
                setShowPersonModal(true);
              } else {
                setActiveTab('tree');
              }
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

        {/* Supporting Destination: About This Archive */}
        {activeTab === 'about' && (
          <AboutArchive />
        )}

        {/* Core Tab 3: Protected Administrator Area */}
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
            onOpenPdfExport={() => setShowPdfExportModal(true)}
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
          isAdmin={isAdminAuthenticated}
          onClose={() => setShowPersonModal(false)}
          onUpdatePerson={handleUpdatePerson}
          onDeletePerson={handleDeletePerson}
          onAddRelationship={(fromId) => handleOpenAddRelationship(fromId)}
          onDeleteRelationship={handleDeleteRelationship}
        />
      )}

      {/* Add / Edit Relationship Modal */}
      {showRelationshipModal && (
        <RelationshipModal
          people={people}
          relationships={relationships}
          initialFromPersonId={initialRelFromId}
          onClose={() => setShowRelationshipModal(false)}
          onSaveRelationship={handleSaveRelationship}
        />
      )}

      {/* Modal: Guided Add Person with Draft Recovery & Batch Children */}
      {showAddPersonModal && (
        <AddPersonGuidedModal
          people={people}
          relationships={relationships}
          onClose={() => setShowAddPersonModal(false)}
          onSavePerson={async (p) => {
            await savePerson(p, 'Admin');
          }}
          onSaveRelationship={handleSaveRelationship}
          onComplete={reloadData}
        />
      )}

      {/* Modal: Printable Official Genealogy PDF Export */}
      {showPdfExportModal && (
        <GenealogyPdfExportModal
          people={people}
          relationships={relationships}
          onClose={() => setShowPdfExportModal(false)}
        />
      )}
    </div>
  );
};

export default App;
