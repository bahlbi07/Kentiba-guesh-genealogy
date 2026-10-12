import React, { useState, useEffect, useCallback } from 'react';
import {
  Person,
  Relationship,
  SourceOccurrence,
  AuditEvent,
  UserRole
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
  saveBatchData,
  bulkLoadData
} from './services/db';
import { isCloudConfigured } from './services/supabaseClient';
import { apiFetchTree, apiSaveBatch, apiSaveRelationship } from './services/apiClient';
import { INITIAL_PEOPLE, INITIAL_RELATIONSHIPS, INITIAL_OCCURRENCES } from './data/initialGenealogyData';
import { deduplicateFamilyRecords } from './services/deduplicator';
import { syncPersonToGoogleSheets } from './services/googleSheetsService';

import { Navbar, AppDestination } from './components/Navbar';
import { FamilyExplorer } from './components/FamilyExplorer';
import { Directory } from './components/Directory';
import { FamilyInformationView } from './components/FamilyInformationView';
import { AboutArchive } from './components/AboutArchive';
import { AdminPanel } from './components/AdminPanel';
import { PersonDetailModal } from './components/PersonDetailModal';
import { AddPersonGuidedModal } from './components/AddPersonGuidedModal';
import { GenealogyPdfExportModal } from './components/GenealogyPdfExportModal';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { RotateCw } from 'lucide-react';

// Authoritative genealogy dataset schema version. Incrementing this triggers an automatic,
// seamless upgrade of local IndexedDB across all visiting phones and browsers.
export const CURRENT_DATASET_VERSION = '2026.10.12.v8_clean_english_annotations';

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
  const [lastSyncBadge, setLastSyncBadge] = useState<string | null>(null);

  // Modals and selection state: immediately select root ancestor
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(() => {
    return (
      INITIAL_PEOPLE.find(
        (p) =>
          p.id === 'pers_root_kinteba_guush' ||
          p.canonicalName.includes('ከንቲባ ጉዕሽ') ||
          p.id === 'pers_p1_0_0'
      ) ||
      INITIAL_PEOPLE[0] ||
      null
    );
  });
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [showPdfExportModal, setShowPdfExportModal] = useState(false);

  // Admin authentication state
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('kinteba_admin_auth') === 'true';
  });

  const [adminRole, setAdminRole] = useState<UserRole>(() => {
    const stored = sessionStorage.getItem('kinteba_admin_role') as UserRole;
    if (stored === 'superadmin' || stored === 'admin') return stored;
    return sessionStorage.getItem('kinteba_admin_auth') === 'true' ? 'admin' : 'guest';
  });

  // Background Auto-Sync Worker: automatically checks "ሓድሽ ሓበሬታ ኣሎ ድዩ?" on launch and tab activation
  const syncWithServerInBackground = useCallback(async () => {
    try {
      setIsSyncing(true);
      const serverTree = await apiFetchTree();
      if (!serverTree || !serverTree.people || serverTree.people.length === 0) {
        return;
      }

      const currentStoredPeople = await getAllPeople(true);
      const localPersonMap = new Map(currentStoredPeople.map((p) => [p.id, p]));
      const peopleToUpdate: Person[] = [];

      for (const sp of serverTree.people) {
        const existing = localPersonMap.get(sp.id);
        const isDifferent =
          !existing ||
          existing.canonicalName !== sp.canonicalName ||
          existing.displayName !== sp.displayName ||
          existing.branch !== sp.branch ||
          existing.fatherName !== sp.fatherName ||
          existing.motherName !== sp.motherName ||
          existing.status !== sp.status ||
          existing.isArchived !== sp.isArchived ||
          (sp.updatedAt && existing.updatedAt && sp.updatedAt > existing.updatedAt);

        if (isDifferent) {
          peopleToUpdate.push(sp);
          localPersonMap.set(sp.id, sp);
        }
      }

      const currentStoredRels = await getAllRelationships();
      const localRelMap = new Map(currentStoredRels.map((r) => [r.id, r]));
      const relsToUpdate: Relationship[] = [];

      for (const sr of serverTree.relationships) {
        const existing = localRelMap.get(sr.id);
        const isDifferent =
          !existing ||
          existing.fromPersonId !== sr.fromPersonId ||
          existing.toPersonId !== sr.toPersonId ||
          existing.type !== sr.type ||
          existing.status !== sr.status ||
          (sr.updatedAt && existing.updatedAt && sr.updatedAt > existing.updatedAt);

        if (isDifferent) {
          relsToUpdate.push(sr);
          localRelMap.set(sr.id, sr);
        }
      }

      // If new or updated records were detected from the server, atomically persist to IndexedDB
      if (peopleToUpdate.length > 0 || relsToUpdate.length > 0) {
        await saveBatchData(peopleToUpdate, relsToUpdate, 'ServerAutoSync');
        const refreshedPeople = await getAllPeople(true);
        const refreshedRels = await getAllRelationships();
        setPeople(refreshedPeople);
        setRelationships(refreshedRels);
        setLastSyncBadge(`ሓድሽ ሓበሬታ ተመሳሲሉ (${peopleToUpdate.length + relsToUpdate.length})`);
        setTimeout(() => setLastSyncBadge(null), 6000);
      } else {
        setLastSyncBadge('እዋናዊ');
        setTimeout(() => setLastSyncBadge(null), 3000);
      }
    } catch {
      // Silently proceed with local offline database
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Reload data from local IndexedDB with automatic real-dataset seeding & background server sync
  const reloadData = useCallback(async () => {
    try {
      let storedPeople = await getAllPeople(true);
      let storedRels = await getAllRelationships();
      let storedOccs = await getAllOccurrences();
      let storedAudits = await getAllAuditEvents();
      let mode = await getDatasetMode();

      // Check if client database is missing records or has an outdated dataset schema.
      // Auto-upgrade to authoritative dataset with zero wait time.
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

      // Seamlessly initiate background server sync without blocking the UI
      syncWithServerInBackground();
    } catch (err) {
      console.error('Failed to load database:', err);
    } finally {
      setIsLoading(false);
    }
  }, [syncWithServerInBackground]);

  useEffect(() => {
    reloadData();

    // Automatically check for new data whenever user focuses the app or switches back to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncWithServerInBackground();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', syncWithServerInBackground);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', syncWithServerInBackground);
    };
  }, [reloadData, syncWithServerInBackground]);

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
    if (adminRole === 'superadmin') {
      // Super Admin permanently deletes immediately
      await deletePerson(id, 'SuperAdmin');
      await reloadData();
      if (selectedPerson?.id === id) {
        setSelectedPerson(null);
      }
    } else {
      // Regular Admin: marks deletionPending = true and isArchived = true for Super Admin review
      const target = people.find((p) => p.id === id);
      if (target) {
        const updated: Person = {
          ...target,
          isArchived: true,
          deletionPending: true,
          deletionRequestedBy: 'ኣድሚን',
          deletionRequestedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await savePerson(updated, 'Admin');
        try {
          const token = sessionStorage.getItem('kinteba_admin_token') || undefined;
          await apiSaveBatch([updated], [], token);
        } catch {
          // offline fallback
        }
        await reloadData();
        if (selectedPerson?.id === id) {
          setSelectedPerson(null);
        }
        alert('እዚ ናይ ምድማስ ጠለብ ተመዝጊቡ ኣሎ። ንውሕስነት ዳታ፡ ናይ መወዳእታ ውሳነ ምድማስ ብሱፐር ኣድሚን (Super Admin) ክረጋገጽ እዩ።');
      }
    }
  };

  const handlePermanentDeletePerson = async (id: string) => {
    await deletePerson(id, 'SuperAdmin');
    await reloadData();
    if (selectedPerson?.id === id) {
      setSelectedPerson(null);
    }
  };

  const handleRestorePerson = async (id: string) => {
    const target = people.find((p) => p.id === id);
    if (target) {
      const restored: Person = {
        ...target,
        isArchived: false,
        deletionPending: false,
        deletionRequestedBy: undefined,
        deletionRequestedAt: undefined,
        updatedAt: new Date().toISOString(),
      };
      await savePerson(restored, 'SuperAdmin');
      try {
        const token = sessionStorage.getItem('kinteba_admin_token') || undefined;
        await apiSaveBatch([restored], [], token);
      } catch {
        // offline fallback
      }
      await reloadData();
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

  const handleAdminLogin = (token: string, username: string, role: 'admin' | 'superadmin' = 'admin') => {
    sessionStorage.setItem('kinteba_admin_auth', 'true');
    sessionStorage.setItem('kinteba_admin_user', username);
    sessionStorage.setItem('kinteba_admin_token', token);
    sessionStorage.setItem('kinteba_admin_role', role);
    setIsAdminAuthenticated(true);
    setAdminRole(role);
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
    sessionStorage.removeItem('kinteba_admin_role');
    setIsAdminAuthenticated(false);
    setAdminRole('guest');
  };

  // Quick Live Refresh & Sync Utility (In-place live sync with instant feedback)
  const handleForceRefresh = async () => {
    setIsSyncing(true);
    setLastSyncBadge('ሓድሽ ሓበሬታ ይምርመር ኣሎ...');
    try {
      // 1. Proactively check for Service Worker updates
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update().catch(() => {});
        }
      }

      // 2. Force re-sync with authoritative dataset
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('kinteba_authoritative_dataset_version');
      }

      // 3. Run full in-place reload and background server synchronization
      await reloadData();

      // 4. Immediate clear visual confirmation
      const refreshedList = await getAllPeople(true);
      setLastSyncBadge(`መዝገብ ብዓወት ተሓዲሱ! (${refreshedList.length} ኣባላት - 12 ጨናፍር)`);
      setTimeout(() => setLastSyncBadge(null), 6000);
    } catch {
      setLastSyncBadge('መዝገብ እዋናዊ እዩ');
      setTimeout(() => setLastSyncBadge(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading && people.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-stone-900 font-bold font-ethiopic text-xl">
            ተወለድ እንዳቦይ ከንቲባ ጉዕሽ ይዳሎ ኣሎ...
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
        adminRole={adminRole}
        onOpenPdfExport={() => setShowPdfExportModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 py-3 sm:px-6 sm:py-6 lg:px-8 overflow-x-hidden">
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
            role={adminRole}
            onLogin={handleAdminLogin}
            onLogout={handleAdminLogout}
            onSelectPerson={(p) => {
              setSelectedPerson(p);
              setShowPersonModal(true);
            }}
            onUpdatePerson={handleUpdatePerson}
            onDeletePerson={handleDeletePerson}
            onPermanentDeletePerson={handlePermanentDeletePerson}
            onRestorePerson={handleRestorePerson}
            onSaveRelationship={handleSaveRelationship}
            onDeleteRelationship={handleDeleteRelationship}
            onAddNewPerson={() => setShowAddPersonModal(true)}
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
          onDeleteRelationship={handleDeleteRelationship}
          onSelectPerson={(p) => setSelectedPerson(p)}
          onReload={reloadData}
        />
      )}

      {/* Modal: Guided Add Person with Draft Recovery & Batch Children */}
      {showAddPersonModal && (
        <AddPersonGuidedModal
          people={people}
          relationships={relationships}
          onClose={() => setShowAddPersonModal(false)}
          onSaveBatch={async (batchPeople, batchRelationships) => {
            // 1. Instantly update in-memory React state for 0ms latency UI update!
            setPeople((prev) => {
              const map = new Map(prev.map((p) => [p.id, p]));
              for (const p of batchPeople) map.set(p.id, p);
              return Array.from(map.values());
            });
            setRelationships((prev) => {
              const map = new Map(prev.map((r) => [r.id, r]));
              for (const r of batchRelationships) map.set(r.id, r);
              return Array.from(map.values());
            });

            // 2. Persist to IndexedDB in a single lightning-fast atomic transaction
            await saveBatchData(batchPeople, batchRelationships, 'Admin');

            // 3. Asynchronously forward each new person to Google Sheets Webhook!
            for (const p of batchPeople) {
              syncPersonToGoogleSheets(p, people, relationships);
            }

            // 4. Non-blocking asynchronous remote sync in the background
            try {
              const token = sessionStorage.getItem('kinteba_admin_token') || 'official-admin-session-token';
              apiSaveBatch(batchPeople, batchRelationships, token).catch((e) => {
                console.warn('Background sync note:', e);
              });
            } catch (syncErr) {
              console.warn('Server batch sync note:', syncErr);
            }
          }}
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
      <footer className="mt-auto border-t border-stone-200 bg-white/80 py-4 pb-20 md:pb-4 px-4 text-center text-sm text-stone-600 font-ethiopic">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-medium">© {new Date().getFullYear()} ተወለድ እንዳቦይ ከንቲባ ጉዕሽ &middot; መዝገብ ወለዶ</p>
          <div className="flex items-center flex-wrap justify-center gap-3">
            <span className="text-xs sm:text-sm font-bold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">
              ስሪት 6.0 ({people.length} ኣባላት)
            </span>
            {isSyncing && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-50 px-3 py-1 rounded-full border border-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>ሓድሽ ሓበሬታ ይምርመር ኣሎ...</span>
              </span>
            )}
            {!isSyncing && lastSyncBadge && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-300 transition-opacity">
                <span>✓ {lastSyncBadge}</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleForceRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-extrabold text-amber-900 bg-amber-100/80 hover:bg-amber-200 border border-amber-300 rounded-xl cursor-pointer transition-colors active:scale-95 shadow-xs"
              title="ካሽ ኣጽሪኻ ሓድሽ መዝገብ ጽዓን"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-600' : ''}`} />
              <span>ዳታ ሓድስ / Refresh</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
