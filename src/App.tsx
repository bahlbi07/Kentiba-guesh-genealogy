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
import { apiFetchTree, apiSaveBatch, apiSaveRelationship } from './services/apiClient';
import { INITIAL_PEOPLE, INITIAL_RELATIONSHIPS, INITIAL_OCCURRENCES } from './data/initialGenealogyData';
import { deduplicateFamilyRecords } from './services/deduplicator';

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
import { RotateCw } from 'lucide-react';

// Authoritative genealogy dataset schema version. Incrementing this triggers an automatic,
// seamless upgrade of local IndexedDB across all visiting phones and browsers.
export const CURRENT_DATASET_VERSION = '2026.10.11.v3_authoritative_gidey';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppDestination>('tree');
  // Immediately initialize with authoritative dataset for instantaneous 0.0s startup
  const [people, setPeople] = useState<Person[]>(() => INITIAL_PEOPLE);
  const [relationships, setRelationships] = useState<Relationship[]>(() => INITIAL_RELATIONSHIPS);
  const [occurrences, setOccurrences] = useState<SourceOccurrence[]>(() => INITIAL_OCCURRENCES);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [datasetMode, setDatasetMode] = useState<'real' | 'demo' | 'empty'>('real');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Modals and selection state: immediately select root ancestor
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(() => {
    return (
      INITIAL_PEOPLE.find(
        (p) =>
          p.id === 'pers_root_kinteba_guush' ||
          p.canonicalName.includes('ከንቲባ ጉዑሽ') ||
          p.canonicalName.includes('ከንቲባ ጉዕሽ') ||
          p.id === 'pers_p1_0_0'
      ) ||
      INITIAL_PEOPLE[0] ||
      null
    );
  });
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [initialRelFromId, setInitialRelFromId] = useState<string | undefined>(undefined);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [showPdfExportModal, setShowPdfExportModal] = useState(false);

  // Admin authentication state
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('kinteba_admin_auth') === 'true';
  });

  // Reload data from local IndexedDB with automatic real-dataset seeding & background server sync
  const reloadData = useCallback(async () => {
    try {
      let storedPeople = await getAllPeople(true);
      let storedRels = await getAllRelationships();
      let storedOccs = await getAllOccurrences();
      let storedAudits = await getAllAuditEvents();
      let mode = await getDatasetMode();

      // Check if client database is missing records or has an outdated dataset schema
      // (e.g. stale client cache before 'ግደይ' or branch correction). Auto-upgrade to authoritative dataset.
      const storedVersion =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('kinteba_authoritative_dataset_version')
          : null;
      const isVersionOutdated = storedVersion !== CURRENT_DATASET_VERSION;

      const needsDatasetUpgrade =
        storedPeople.length === 0 ||
        mode === 'demo' ||
        storedPeople.length < INITIAL_PEOPLE.length ||
        storedRels.length < INITIAL_RELATIONSHIPS.length ||
        isVersionOutdated;

      if (needsDatasetUpgrade) {
        // Preserve any custom user-added records that are not part of the initial static dataset
        const initialPersonIds = new Set(INITIAL_PEOPLE.map((p) => p.id));
        const customPeople = storedPeople.filter((p) => !initialPersonIds.has(p.id));

        const initialRelIds = new Set(INITIAL_RELATIONSHIPS.map((r) => r.id));
        const customRels = storedRels.filter((r) => !initialRelIds.has(r.id));

        await bulkLoadData(
          {
            people: [...INITIAL_PEOPLE, ...customPeople],
            relationships: [...INITIAL_RELATIONSHIPS, ...customRels],
            occurrences: INITIAL_OCCURRENCES,
            mode: 'real',
          },
          'Auto-upgrade Authoritative Dataset'
        );

        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('kinteba_authoritative_dataset_version', CURRENT_DATASET_VERSION);
        }

        storedPeople = await getAllPeople(true);
        storedRels = await getAllRelationships();
        storedOccs = await getAllOccurrences();
        storedAudits = await getAllAuditEvents();
        mode = 'real';
      }

      // Automatically detect and merge duplicate family records
      const dedupResult = deduplicateFamilyRecords(storedPeople, storedRels);
      if (dedupResult.removedPersonIds.length > 0 || dedupResult.removedRelationshipIds.length > 0) {
        for (const remId of dedupResult.removedPersonIds) {
          await deletePerson(remId, 'Deduplicator');
        }
        for (const remRelId of dedupResult.removedRelationshipIds) {
          await deleteRelationship(remRelId, 'Deduplicator');
        }
        for (const p of dedupResult.people) {
          await savePerson(p, 'Deduplicator');
        }
        for (const r of dedupResult.relationships) {
          await saveRelationship(r, 'Deduplicator');
        }

        storedPeople = dedupResult.people;
        storedRels = dedupResult.relationships;

        try {
          const token = sessionStorage.getItem('kinteba_admin_token') || 'official-admin-session-token';
          apiSaveBatch(storedPeople, storedRels, token).catch(() => {});
        } catch {
          // Proceed with local
        }
      }

      // Immediately display local database with zero waiting time!
      setPeople(storedPeople);
      setRelationships(storedRels);
      setOccurrences(storedOccs);
      setAuditEvents(storedAudits);
      setDatasetMode(mode);

      // Auto-select root ancestor if none selected, or refresh current selection
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
        if (prev) {
          const refreshed = storedPeople.find((p) => p.id === prev.id);
          return refreshed || prev;
        }
        return prev;
      });

      // Synchronize with server backend completely in the background without blocking the screen
      setIsSyncing(true);
      (async () => {
        try {
          const serverTree = await apiFetchTree();
          if (serverTree && serverTree.people && serverTree.people.length > 0) {
            let hasNewServerData = false;
            const currentStoredPeople = await getAllPeople(true);
            const localPersonMap = new Map(currentStoredPeople.map((p) => [p.id, p]));
            for (const sp of serverTree.people) {
              const existing = localPersonMap.get(sp.id);
              if (!existing || (sp.updatedAt && existing.updatedAt && sp.updatedAt > existing.updatedAt)) {
                await savePerson(sp, 'ServerSync');
                localPersonMap.set(sp.id, sp);
                hasNewServerData = true;
              }
            }

            const currentStoredRels = await getAllRelationships();
            const localRelMap = new Map(currentStoredRels.map((r) => [r.id, r]));
            for (const sr of serverTree.relationships) {
              const existing = localRelMap.get(sr.id);
              if (!existing || (sr.updatedAt && existing.updatedAt && sr.updatedAt > existing.updatedAt)) {
                await saveRelationship(sr, 'ServerSync');
                localRelMap.set(sr.id, sr);
                hasNewServerData = true;
              }
            }

            if (hasNewServerData) {
              const refreshedPeople = await getAllPeople(true);
              const refreshedRels = await getAllRelationships();
              setPeople(refreshedPeople);
              setRelationships(refreshedRels);
            }
          }
        } catch {
          // Silently proceed with local offline database
        } finally {
          setIsSyncing(false);
        }
      })();
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
    try {
      const token = sessionStorage.getItem('kinteba_admin_token') || undefined;
      await apiSaveBatch([updated], [], token);
    } catch {
      // offline fallback
    }
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
      try {
        const token = sessionStorage.getItem('kinteba_admin_token') || undefined;
        await apiSaveRelationship(rel, token);
      } catch {
        // offline fallback
      }
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

  const handleManualDeduplication = async (): Promise<{ mergedCount: number; details: string[] }> => {
    const dedupResult = deduplicateFamilyRecords(people, relationships);
    if (dedupResult.removedPersonIds.length > 0 || dedupResult.removedRelationshipIds.length > 0) {
      for (const remId of dedupResult.removedPersonIds) {
        await deletePerson(remId, 'Deduplicator');
      }
      for (const remRelId of dedupResult.removedRelationshipIds) {
        await deleteRelationship(remRelId, 'Deduplicator');
      }
      for (const p of dedupResult.people) {
        await savePerson(p, 'Deduplicator');
      }
      for (const r of dedupResult.relationships) {
        await saveRelationship(r, 'Deduplicator');
      }

      setPeople(dedupResult.people);
      setRelationships(dedupResult.relationships);

      try {
        const token = sessionStorage.getItem('kinteba_admin_token') || 'official-admin-session-token';
        await apiSaveBatch(dedupResult.people, dedupResult.relationships, token);
      } catch {
        // Proceed
      }
    }
    return { mergedCount: dedupResult.mergedCount, details: dedupResult.details };
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem('kinteba_admin_auth');
    sessionStorage.removeItem('kinteba_admin_user');
    sessionStorage.removeItem('kinteba_admin_token');
    setIsAdminAuthenticated(false);
  };

  // Quick Force-Refresh & Cache-Clear Utility (for family members to purge any old cache)
  const handleForceRefresh = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('kinteba_authoritative_dataset_version');
      }
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  if (isLoading && people.length === 0) {
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
            onDeduplicate={handleManualDeduplication}
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
          onSelectPerson={(p) => setSelectedPerson(p)}
          onReload={reloadData}
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
          onSaveRelationship={async (r) => {
            return await saveRelationship(r, 'Admin');
          }}
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

      {/* Footer with App Version and Quick Force-Refresh / Cache Clear button */}
      <footer className="mt-auto border-t border-stone-200 bg-white/70 py-4 pb-20 md:pb-4 px-4 text-center text-xs text-stone-500 font-ethiopic">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <p>© {new Date().getFullYear()} ተወለድ እንዳቦይ ከንትባ ጉዕሽ &middot; መዝገብ ወለዶ</p>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-stone-400">ስሪት 3.0 ({people.length} ኣባላት)</span>
            {isSyncing && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                <span>ይመሳሰል ኣሎ...</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleForceRefresh}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg cursor-pointer transition-colors"
              title="ካሽ ኣጽሪኻ ሓድሽ መዝገብ ጽዓን"
            >
              <RotateCw className="w-3 h-3" />
              <span>ዳታ ሓድስ / Refresh</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
