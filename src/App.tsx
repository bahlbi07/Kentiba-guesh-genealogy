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
  bulkLoadData,
  getDeletedPersonIds,
  getDeletedRelationshipIds,
  removeDeletedPersonId,
  removeDeletedRelationshipId,
} from './services/db';
import { isCloudConfigured } from './services/supabaseClient';
import {
  apiFetchTree,
  apiSaveBatch,
  apiSaveRelationship,
  apiDeletePerson,
  apiDeleteRelationship,
  apiUnmarkDeletedPerson,
  subscribeToLiveCloudUpdates,
  CLIENT_SESSION_ID,
} from './services/apiClient';
import {
  playNotificationChime,
  showBrowserNotification,
  requestNotificationPermission,
  isNotificationPermissionGranted,
} from './services/notificationService';
import { INITIAL_PEOPLE, INITIAL_RELATIONSHIPS, INITIAL_OCCURRENCES } from './data/initialGenealogyData';
import { deduplicateFamilyRecords } from './services/deduplicator';
import { syncNewBatchToGoogleSheets } from './services/googleSheetsService';

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
import { RotateCw, Bell, X } from 'lucide-react';

// Authoritative genealogy dataset schema version. Incrementing this triggers an automatic,
// seamless upgrade of local IndexedDB across all visiting phones and browsers.
export const CURRENT_DATASET_VERSION = '2026.10.15.v16_tibe_mana_medhin_lineage_verified';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppDestination>('tree');
  // Immediately initialize with authoritative dataset excluding any deleted IDs
  const [people, setPeople] = useState<Person[]>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const delRaw = localStorage.getItem('kinteba_deleted_person_ids_v1');
        if (delRaw) {
          const delIds = new Set(JSON.parse(delRaw));
          return INITIAL_PEOPLE.filter((p) => !delIds.has(p.id));
        }
      }
    } catch {
      // fallback
    }
    return INITIAL_PEOPLE;
  });
  const [relationships, setRelationships] = useState<Relationship[]>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const delRaw = localStorage.getItem('kinteba_deleted_rel_ids_v1');
        const delPersonRaw = localStorage.getItem('kinteba_deleted_person_ids_v1');
        const delRels = delRaw ? new Set(JSON.parse(delRaw)) : new Set();
        const delPersons = delPersonRaw ? new Set(JSON.parse(delPersonRaw)) : new Set();
        return INITIAL_RELATIONSHIPS.filter(
          (r) => !delRels.has(r.id) && !delPersons.has(r.fromPersonId) && !delPersons.has(r.toPersonId)
        );
      }
    } catch {
      // fallback
    }
    return INITIAL_RELATIONSHIPS;
  });
  const [occurrences, setOccurrences] = useState<SourceOccurrence[]>(() => INITIAL_OCCURRENCES);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [datasetMode, setDatasetMode] = useState<'real' | 'demo' | 'empty'>('real');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncBadge, setLastSyncBadge] = useState<string | null>(null);
  const [liveToast, setLiveToast] = useState<{
    id: string;
    message: string;
    branch?: string;
    personName?: string;
    personId?: string;
  } | null>(null);
  const [hasNotificationPermission, setHasNotificationPermission] = useState<boolean>(() => {
    return isNotificationPermissionGranted();
  });

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

  // Mobile Hardware/Gesture Back Button Support for Modals & Tabs
  useEffect(() => {
    if (showPersonModal || showAddPersonModal || showPdfExportModal) {
      if (typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
        try {
          window.history.pushState({ kintebaModal: true }, '');
        } catch {}
      }
    }
  }, [showPersonModal, showAddPersonModal, showPdfExportModal]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      } catch {
        window.scrollTo(0, 0);
      }
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }
    if (activeTab !== 'tree') {
      if (typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
        try {
          window.history.pushState({ kintebaTab: activeTab }, '');
        } catch {}
      }
    }
  }, [activeTab]);

  useEffect(() => {
    const handleAppPopState = (e: PopStateEvent) => {
      if (showAddPersonModal) {
        setShowAddPersonModal(false);
        (e as any).__kintebaHandled = true;
        return;
      }
      if (showPdfExportModal) {
        setShowPdfExportModal(false);
        (e as any).__kintebaHandled = true;
        return;
      }
      if (showPersonModal) {
        setShowPersonModal(false);
        (e as any).__kintebaHandled = true;
        return;
      }
      if (activeTab !== 'tree') {
        setActiveTab('tree');
        (e as any).__kintebaHandled = true;
        return;
      }
    };

    window.addEventListener('popstate', handleAppPopState, true);
    return () => window.removeEventListener('popstate', handleAppPopState, true);
  }, [showPersonModal, showAddPersonModal, showPdfExportModal, activeTab]);

  // Admin authentication state
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('kinteba_admin_auth') === 'true';
  });

  const [adminRole, setAdminRole] = useState<UserRole>(() => {
    const stored = sessionStorage.getItem('kinteba_admin_role') as UserRole;
    if (stored === 'superadmin' || stored === 'admin') return stored;
    return sessionStorage.getItem('kinteba_admin_auth') === 'true' ? 'admin' : 'guest';
  });

  // Background Auto-Sync Worker: bidirectional multi-device cloud synchronization
  // Pulls new/updated/deleted records from cloud AND pushes any unsynced local custom records up to cloud
  const syncWithServerInBackground = useCallback(async () => {
    try {
      setIsSyncing(true);
      const serverTree = await apiFetchTree();
      if (!serverTree || !serverTree.people || serverTree.people.length === 0) {
        return;
      }

      const localDelP = await getDeletedPersonIds();
      const localDelR = await getDeletedRelationshipIds();
      const deletedPeopleSet = new Set([...(serverTree.deletedPersonIds || []), ...localDelP]);
      const deletedRelsSet = new Set([...(serverTree.deletedRelationshipIds || []), ...localDelR]);

      const currentStoredPeople = await getAllPeople(true);
      const localPersonMap = new Map(currentStoredPeople.map((p) => [p.id, p]));
      const serverPersonMap = new Map(serverTree.people.map((p) => [p.id, p]));

      let localChanged = false;

      // 1. Apply server deletions to local IndexedDB
      for (const delPId of deletedPeopleSet) {
        if (localPersonMap.has(delPId)) {
          await deletePerson(delPId, 'ServerAutoSync');
          localPersonMap.delete(delPId);
          localChanged = true;
        }
      }

      // 2. Pull new or updated people from server to local IndexedDB
      const peopleToUpdate: Person[] = [];
      for (const sp of serverTree.people) {
        if (deletedPeopleSet.has(sp.id)) continue;
        const existing = localPersonMap.get(sp.id);
        if (existing && existing.updatedAt && sp.updatedAt && existing.updatedAt > sp.updatedAt) {
          // Local record is newer than server record; keep local and push it to server in step 5
          continue;
        }
        const isDifferent =
          !existing ||
          existing.canonicalName !== sp.canonicalName ||
          existing.displayName !== sp.displayName ||
          existing.branch !== sp.branch ||
          existing.fatherName !== sp.fatherName ||
          existing.motherName !== sp.motherName ||
          existing.spouseNote !== sp.spouseNote ||
          existing.notes !== sp.notes ||
          existing.status !== sp.status ||
          Boolean(existing.isArchived) !== Boolean(sp.isArchived) ||
          Boolean(existing.deletionPending) !== Boolean(sp.deletionPending) ||
          (sp.updatedAt && existing.updatedAt && sp.updatedAt > existing.updatedAt);

        if (isDifferent) {
          peopleToUpdate.push(sp);
          localPersonMap.set(sp.id, sp);
        }
      }

      const currentStoredRels = await getAllRelationships();
      const localRelMap = new Map(currentStoredRels.map((r) => [r.id, r]));
      const serverRelMap = new Map(serverTree.relationships.map((r) => [r.id, r]));

      // 3. Apply server relationship deletions to local IndexedDB
      for (const delRId of deletedRelsSet) {
        if (localRelMap.has(delRId)) {
          await deleteRelationship(delRId, 'ServerAutoSync');
          localRelMap.delete(delRId);
          localChanged = true;
        }
      }

      // 4. Pull new or updated relationships from server to local IndexedDB
      const relsToUpdate: Relationship[] = [];
      for (const sr of serverTree.relationships) {
        if (deletedRelsSet.has(sr.id)) continue;
        const existing = localRelMap.get(sr.id);
        if (existing && existing.updatedAt && sr.updatedAt && existing.updatedAt > sr.updatedAt) {
          continue;
        }
        const isDifferent =
          !existing ||
          existing.fromPersonId !== sr.fromPersonId ||
          existing.toPersonId !== sr.toPersonId ||
          existing.type !== sr.type ||
          existing.status !== sr.status ||
          existing.sourceWording !== sr.sourceWording ||
          (sr.updatedAt && existing.updatedAt && sr.updatedAt > existing.updatedAt);

        if (isDifferent) {
          relsToUpdate.push(sr);
          localRelMap.set(sr.id, sr);
        }
      }

      // 5. Bidirectional Push: if this device has local custom people/relationships not yet on the server, push them up!
      const initialPersonIds = new Set(INITIAL_PEOPLE.map((p) => p.id));
      const initialRelIds = new Set(INITIAL_RELATIONSHIPS.map((r) => r.id));
      const unsyncedLocalPeople: Person[] = [];
      const unsyncedLocalRels: Relationship[] = [];

      for (const lp of currentStoredPeople) {
        if (deletedPeopleSet.has(lp.id)) continue;
        const sp = serverPersonMap.get(lp.id);
        if (!sp && !initialPersonIds.has(lp.id)) {
          unsyncedLocalPeople.push(lp);
        } else if (sp && lp.updatedAt && sp.updatedAt && lp.updatedAt > sp.updatedAt) {
          unsyncedLocalPeople.push(lp);
        }
      }

      for (const lr of currentStoredRels) {
        if (deletedRelsSet.has(lr.id)) continue;
        const sr = serverRelMap.get(lr.id);
        if (!sr && !initialRelIds.has(lr.id)) {
          unsyncedLocalRels.push(lr);
        } else if (sr && lr.updatedAt && sr.updatedAt && lr.updatedAt > sr.updatedAt) {
          unsyncedLocalRels.push(lr);
        }
      }

      if (unsyncedLocalPeople.length > 0 || unsyncedLocalRels.length > 0) {
        const token = sessionStorage.getItem('kinteba_admin_token') || 'official-admin-session-token';
        await apiSaveBatch(unsyncedLocalPeople, unsyncedLocalRels, token).catch(() => {});
      }

      // 6. If new, updated, or deleted records were detected from the server, atomically persist to IndexedDB & update UI
      if (peopleToUpdate.length > 0 || relsToUpdate.length > 0 || localChanged) {
        if (peopleToUpdate.length > 0 || relsToUpdate.length > 0) {
          await saveBatchData(peopleToUpdate, relsToUpdate, 'ServerAutoSync');
        }
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
        isVersionOutdated;

      if (needsDatasetUpgrade) {
        const deletedPersonIds = new Set(await getDeletedPersonIds());
        const deletedRelIds = new Set(await getDeletedRelationshipIds());

        // Protect authoritative historical people and relationships from being suppressed by accidental deletions
        const protectedPersonPrefixes = ['pers_p', 'pers_root', 'pers_tibe', 'pers_partner'];
        for (const delId of Array.from(deletedPersonIds)) {
          if (protectedPersonPrefixes.some((pfx) => delId.startsWith(pfx))) {
            deletedPersonIds.delete(delId);
            await removeDeletedPersonId(delId);
          }
        }
        for (const delRId of Array.from(deletedRelIds)) {
          if (delRId.startsWith('rel_') && (delRId.includes('pers_p') || delRId.includes('pers_tibe') || delRId.includes('pers_root'))) {
            deletedRelIds.delete(delRId);
            await removeDeletedRelationshipId(delRId);
          }
        }

        const filteredInitialPeople = INITIAL_PEOPLE.filter((p) => !deletedPersonIds.has(p.id));
        const filteredInitialRels = INITIAL_RELATIONSHIPS.filter(
          (r) =>
            !deletedRelIds.has(r.id) &&
            !deletedPersonIds.has(r.fromPersonId) &&
            !deletedPersonIds.has(r.toPersonId)
        );

        // Preserve any custom user-added records that are not part of the initial static dataset
        const initialPersonIds = new Set(filteredInitialPeople.map((p) => p.id));
        const customPeople = storedPeople.filter(
          (p) => !initialPersonIds.has(p.id) && !deletedPersonIds.has(p.id)
        );

        const initialRelIds = new Set(filteredInitialRels.map((r) => r.id));
        const initialChildToParents = new Map<string, Set<string>>();
        for (const ir of filteredInitialRels) {
          if (ir.type === 'parent_child') {
            const set = initialChildToParents.get(ir.toPersonId) || new Set<string>();
            set.add(ir.fromPersonId);
            initialChildToParents.set(ir.toPersonId, set);
          }
        }

        const customRels = storedRels.filter((r) => {
          if (initialRelIds.has(r.id) || deletedRelIds.has(r.id)) return false;
          // Prevent cross-branch phantom children caused by legacy global-name matching:
          // if an initial person already has an authoritative parent in INITIAL_RELATIONSHIPS,
          // do not allow a custom parent_child relationship from an unrelated parent to hijack them.
          if (r.type === 'parent_child' && initialPersonIds.has(r.toPersonId)) {
            const authParents = initialChildToParents.get(r.toPersonId);
            if (authParents && authParents.size > 0 && !authParents.has(r.fromPersonId)) {
              return false;
            }
          }
          return true;
        });

        await bulkLoadData(
          {
            people: [...filteredInitialPeople, ...customPeople],
            relationships: [...filteredInitialRels, ...customRels],
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

    // Subscribe to real-time SSE + fast delta cloud updates so all open phones update instantly without clicking refresh
    const unsubscribeLive = subscribeToLiveCloudUpdates((delta) => {
      // 1. Immediately apply new people into React state so tree & directory update in 0ms!
      if (delta.people && delta.people.length > 0) {
        setPeople((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          for (const p of delta.people!) {
            if (!delta.deletedPersonIds?.includes(p.id)) {
              map.set(p.id, p);
            }
          }
          return Array.from(map.values());
        });
      }

      if (delta.relationships && delta.relationships.length > 0) {
        setRelationships((prev) => {
          const map = new Map(prev.map((r) => [r.id, r]));
          for (const r of delta.relationships!) {
            if (!delta.deletedRelationshipIds?.includes(r.id)) {
              map.set(r.id, r);
            }
          }
          return Array.from(map.values());
        });
      }

      if (delta.deletedPersonIds && delta.deletedPersonIds.length > 0) {
        const delSet = new Set(delta.deletedPersonIds);
        setPeople((prev) => prev.filter((p) => !delSet.has(p.id)));
      }
      if (delta.deletedRelationshipIds && delta.deletedRelationshipIds.length > 0) {
        const delRelSet = new Set(delta.deletedRelationshipIds);
        setRelationships((prev) => prev.filter((r) => !delRelSet.has(r.id)));
      }

      // 2. Persist to IndexedDB in background
      if ((delta.people && delta.people.length > 0) || (delta.relationships && delta.relationships.length > 0)) {
        saveBatchData(delta.people || [], delta.relationships || [], 'LiveSync').catch(() => {});
      }

      // 3. If from another admin/phone and contains new people, play chime & show notification
      const isFromOther = !delta.senderId || delta.senderId !== CLIENT_SESSION_ID;
      if (isFromOther && delta.people && delta.people.length > 0) {
        const branchName = delta.notification?.branch || delta.people.find((p) => p.branch && p.branch !== '__custom__')?.branch;
        const firstPerson = delta.people[0];
        const msg = branchName ? `ጨንፈር ${branchName} ሓድሽ ወለዶ ኣትዩ ኣሎ` : 'ሓድሽ ወለዶ ኣትዩ ኣሎ';

        // Play chime sound
        playNotificationChime();

        // Browser system notification
        showBrowserNotification('መዝገብ ወለዶ ከንቲባ ጉዕሽ', msg);

        // In-app pop-up toast banner
        setLiveToast({
          id: `toast_${Date.now()}`,
          message: msg,
          branch: branchName,
          personName: firstPerson?.canonicalName,
          personId: firstPerson?.id,
        });

        // Auto dismiss after 9 seconds
        setTimeout(() => {
          setLiveToast((curr) => (curr?.id === `toast_${Date.now()}` ? null : curr));
        }, 9000);
      }
    });

    // Automatically check for new data whenever user focuses the app, switches back to tab, or every 60s while open
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncWithServerInBackground();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', syncWithServerInBackground);

    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncWithServerInBackground();
      }
    }, 60000);

    return () => {
      unsubscribeLive();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', syncWithServerInBackground);
      clearInterval(pollInterval);
    };
  }, [reloadData, syncWithServerInBackground]);

  // Handle Person CRUD
  const handleUpdatePerson = async (updated: Person) => {
    setPeople((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    if (selectedPerson?.id === updated.id) {
      setSelectedPerson(updated);
    }
    await savePerson(updated, 'Admin');
    try {
      const token = sessionStorage.getItem('kinteba_admin_token') || 'official-admin-session-token';
      await apiSaveBatch([updated], [], token);
    } catch {
      // offline fallback
    }
  };

  const handlePermanentDeletePerson = async (id: string) => {
    // 1. Instant optimistic state update
    setPeople((prev) => prev.filter((p) => p.id !== id));
    setRelationships((prev) => prev.filter((r) => r.fromPersonId !== id && r.toPersonId !== id));
    if (selectedPerson?.id === id) {
      setSelectedPerson(null);
    }

    // 2. Persist permanently to local IndexedDB & metadata deleted sets
    await deletePerson(id, 'SuperAdmin');

    // 3. Sync deletion to cloud
    try {
      const token = sessionStorage.getItem('kinteba_admin_token') || 'superadmin-master-session-token';
      await apiDeletePerson(id, token);
    } catch {
      // offline fallback
    }
  };

  const handleDeletePerson = async (id: string) => {
    if (adminRole === 'superadmin') {
      await handlePermanentDeletePerson(id);
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
        setPeople((prev) => prev.map((p) => (p.id === id ? updated : p)));
        if (selectedPerson?.id === id) {
          setSelectedPerson(null);
        }
        await savePerson(updated, 'Admin');
        try {
          const token = sessionStorage.getItem('kinteba_admin_token') || 'admin-standard-session-token';
          await apiSaveBatch([updated], [], token);
        } catch {
          // offline fallback
        }
        alert('እዚ ናይ ምድማስ ጠለብ ተመዝጊቡ ኣሎ። ንውሕስነት ዳታ፡ ናይ መወዳእታ ውሳነ ምድማስ ብሱፐር ኣድሚን (Super Admin) ክረጋገጽ እዩ።');
      }
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
      setPeople((prev) => prev.map((p) => (p.id === id ? restored : p)));
      await removeDeletedPersonId(id);
      apiUnmarkDeletedPerson(id);
      await savePerson(restored, 'SuperAdmin');
      try {
        const token = sessionStorage.getItem('kinteba_admin_token') || 'superadmin-master-session-token';
        await apiSaveBatch([restored], [], token);
      } catch {
        // offline fallback
      }
    }
  };

  // Handle Relationship CRUD
  const handleSaveRelationship = async (rel: Relationship) => {
    setRelationships((prev) => {
      const idx = prev.findIndex((r) => r.id === rel.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = rel;
        return copy;
      }
      return [...prev, rel];
    });

    const result = await saveRelationship(rel, 'Admin');
    if (result.success) {
      try {
        const token = sessionStorage.getItem('kinteba_admin_token') || 'official-admin-session-token';
        await apiSaveRelationship(rel, token);
      } catch {
        // offline fallback
      }
    }
    return result;
  };

  const handleDeleteRelationship = async (relId: string) => {
    setRelationships((prev) => prev.filter((r) => r.id !== relId));
    await deleteRelationship(relId, 'Admin');
    try {
      const token = sessionStorage.getItem('kinteba_admin_token') || 'official-admin-session-token';
      await apiDeleteRelationship(relId, token);
    } catch {
      // offline fallback
    }
  };

  // Chronological children reordering from firstborn (ቦኽሪ) to youngest (ሕሳስ)
  const handleReorderChildren = async (parentId: string, orderedChildIds: string[]) => {
    if (orderedChildIds.length === 0) return;

    const nowIso = new Date().toISOString();
    const updatedPeopleMap = new Map<string, Person>();
    const peopleToSave: Person[] = [];

    orderedChildIds.forEach((childId, index) => {
      const existing = people.find((p) => p.id === childId);
      if (existing) {
        const updated: Person = {
          ...existing,
          birthOrder: index + 1,
          updatedAt: nowIso,
        };
        updatedPeopleMap.set(childId, updated);
        peopleToSave.push(updated);
      }
    });

    if (peopleToSave.length === 0) return;

    // 1. Instant optimistic state update
    setPeople((prev) =>
      prev.map((p) => (updatedPeopleMap.has(p.id) ? updatedPeopleMap.get(p.id)! : p))
    );

    // 2. Persist locally to IndexedDB in a single batch
    await saveBatchData(peopleToSave, [], 'ReorderChildren');

    // 3. Sync to cloud in single batch call
    try {
      const token = sessionStorage.getItem('kinteba_admin_token') || 'official-admin-session-token';
      await apiSaveBatch(peopleToSave, [], token);
    } catch {
      // offline fallback
    }
  };

  // Batch verify both people and relationships atomically
  const handleBatchVerify = async (peopleToVerify: Person[], relsToVerify: Relationship[]) => {
    if (peopleToVerify.length === 0 && relsToVerify.length === 0) return;

    const verifiedPeopleMap = new Map(peopleToVerify.map((p) => [p.id, p]));
    const verifiedRelMap = new Map(relsToVerify.map((r) => [r.id, r]));

    // 1. Instant optimistic state update
    setPeople((prev) => prev.map((p) => verifiedPeopleMap.get(p.id) || p));
    setRelationships((prev) => prev.map((r) => verifiedRelMap.get(r.id) || r));

    // 2. Persist locally to IndexedDB in a single batch
    await saveBatchData(peopleToVerify, relsToVerify, 'Admin');

    // 3. Sync to cloud in single batch call
    try {
      const token = sessionStorage.getItem('kinteba_admin_token') || 'official-admin-session-token';
      await apiSaveBatch(peopleToVerify, relsToVerify, token);
    } catch {
      // offline fallback
    }
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

  const activePeople = people.filter((p) => !p.isArchived);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans">
      {/* Top Navbar: 3 Core Simple Tabs */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        datasetMode={datasetMode}
        isCloudConnected={isCloudConfigured()}
        totalPeopleCount={activePeople.length}
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
            people={activePeople}
            relationships={relationships}
            selectedPersonId={selectedPerson?.id}
            isAdmin={isAdminAuthenticated}
            onSelectPerson={(p) => {
              setSelectedPerson(p);
            }}
            onDeleteRelationship={handleDeleteRelationship}
            onDeletePerson={handleDeletePerson}
            onReorderChildren={handleReorderChildren}
          />
        )}

        {/* Core Tab 2: People Directory & Search */}
        {(activeTab === 'directory' || activeTab === 'details') && (
          <Directory
            people={activePeople}
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
            onBatchVerify={handleBatchVerify}
          />
        )}
      </main>

      {/* PWA Mobile Installation Prompt Banner */}
      <PwaInstallPrompt />

      {/* Person Detail & Edit Modal */}
      {selectedPerson && showPersonModal && (
        <PersonDetailModal
          person={selectedPerson}
          people={activePeople}
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
          people={activePeople}
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

            // 3. Forward ONLY genuinely new bloodline members with complete lineage chain to Google Sheets!
            syncNewBatchToGoogleSheets(batchPeople, batchRelationships, people, relationships);

            // 4. Synchronize new batch to global cloud stores immediately so all other devices receive it
            try {
              const token = sessionStorage.getItem('kinteba_admin_token') || 'official-admin-session-token';
              await apiSaveBatch(batchPeople, batchRelationships, token);
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
          onDeleteRelationship={handleDeleteRelationship}
          onDeletePerson={handleDeletePerson}
          onComplete={reloadData}
        />
      )}

      {/* Modal: Printable Official Genealogy PDF Export */}
      {showPdfExportModal && (
        <GenealogyPdfExportModal
          people={activePeople}
          relationships={relationships}
          onClose={() => setShowPdfExportModal(false)}
        />
      )}

      {/* Live Telegram-style Real-Time Notification Toast Banner */}
      {liveToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-60 w-11/12 max-w-md animate-in slide-in-from-top-4 duration-300">
          <div className="p-3.5 bg-gradient-to-r from-amber-900 via-stone-900 to-stone-900 text-white rounded-2xl shadow-2xl border border-amber-500/50 flex items-center justify-between gap-3 font-ethiopic">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 animate-bounce text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>ሓድሽ ሓበሬታ ወለዶ (ብቐጥታ)</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-white truncate">
                  {liveToast.message}
                </div>
                {liveToast.personName && (
                  <div className="text-[11px] text-amber-200/80 truncate">
                    &laquo;{liveToast.personName}&raquo; ተመዝጊቡ ኣሎ
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {liveToast.personId && (
                <button
                  type="button"
                  onClick={() => {
                    const target = activePeople.find((p) => p.id === liveToast.personId);
                    if (target) {
                      setSelectedPerson(target);
                      setShowPersonModal(true);
                    }
                    setLiveToast(null);
                  }}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
                >
                  ተመልከት
                </button>
              )}
              <button
                type="button"
                onClick={() => setLiveToast(null)}
                className="p-1 text-stone-400 hover:text-white rounded-lg cursor-pointer transition-colors"
                title="ዕጾ"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer with App Version, Live Telegram-like Sync Status, and Quick Force-Refresh button */}
      <footer className="mt-auto border-t border-stone-200 bg-white/80 py-4 pb-20 md:pb-4 px-4 text-center text-sm text-stone-600 font-ethiopic">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-medium">© {new Date().getFullYear()} ተወለድ እንዳቦይ ከንቲባ ጉዕሽ &middot; መዝገብ ወለዶ</p>
          <div className="flex items-center flex-wrap justify-center gap-3">
            <span className="text-xs sm:text-sm font-bold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">
              ስሪት 7.2 ({activePeople.length} ኣባላት)
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>ብቐጥታ ዝተዛመደ (Live)</span>
            </span>
            {!hasNotificationPermission && (
              <button
                type="button"
                onClick={async () => {
                  const granted = await requestNotificationPermission();
                  setHasNotificationPermission(granted);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 px-3 py-1 rounded-full border border-amber-300 cursor-pointer transition-colors shadow-2xs active:scale-95"
                title="ሓድሽ ወለዶ ምስ ዝኣቱ መልእኽቲ ንኽበጽሓኩም እዚ ተንክፉ"
              >
                <Bell className="w-3.5 h-3.5 text-amber-700" />
                <span>ሓድሽ መልእኽቲ ንኽመጸኩም እዚ ተንክፉ</span>
              </button>
            )}
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
