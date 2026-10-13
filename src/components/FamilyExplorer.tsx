import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Person, Relationship } from '../types/genealogy';
import {
  ChevronRight,
  ChevronDown,
  User,
  Heart,
  Users,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  FileText,
  ArrowUp,
  Tag
} from 'lucide-react';

interface FamilyExplorerProps {
  people: Person[];
  relationships: Relationship[];
  onSelectPerson: (person: Person) => void;
  onOpenDetails?: (person: Person) => void;
  selectedPersonId?: string;
}

interface TrailSnapshot {
  personId: string;
  expandedOrder: string[];
}

export const FamilyExplorer: React.FC<FamilyExplorerProps> = ({
  people,
  relationships,
  onSelectPerson,
  selectedPersonId,
}) => {
  // Fast map of people by ID
  const peopleMap = useMemo(() => {
    const map = new Map<string, Person>();
    for (const p of people) map.set(p.id, p);
    return map;
  }, [people]);

  // Repeated name detection (to clearly flag identical names without merging)
  const repeatedNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of people) {
      counts.set(p.canonicalName, (counts.get(p.canonicalName) || 0) + 1);
    }
    return counts;
  }, [people]);

  // Identify root ancestor (Kinteba Guush Hagos or fallback to first person)
  const rootPerson = useMemo(() => {
    const foundRoot = people.find(
      (p) =>
        p.id === 'pers_root_kinteba_guush' ||
        p.canonicalName.includes('ከንቲባ ጉዑሽ') ||
        p.canonicalName.includes('ከንቲባ ጉዕሽ') ||
        p.id === 'pers_p1_0_0'
    );
    return foundRoot || people[0];
  }, [people]);

  // Top anchor ref for scroll-to-top guarantee
  const topAnchorRef = useRef<HTMLDivElement>(null);
  const [showScrollTopBtn, setShowScrollTopBtn] = useState(false);

  // Smooth / instant scroll-to-top handler
  const scrollToTop = useCallback((smooth = false) => {
    if (typeof window !== 'undefined') {
      if (typeof window.scrollTo === 'function') {
        try {
          window.scrollTo({
            top: 0,
            left: 0,
            behavior: smooth ? 'smooth' : ('instant' as ScrollBehavior),
          });
        } catch {
          try {
            window.scrollTo(0, 0);
          } catch {}
        }
      }
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }
    if (topAnchorRef.current && typeof topAnchorRef.current.scrollIntoView === 'function') {
      try {
        topAnchorRef.current.scrollIntoView({
          block: 'start',
          behavior: smooth ? 'smooth' : 'auto',
        });
      } catch {
        try {
          topAnchorRef.current.scrollIntoView();
        } catch {}
      }
    }
  }, []);

  // Listen to window scroll to show floating "Scroll to Top" button for long lists
  useEffect(() => {
    const handleScroll = () => {
      if (typeof window !== 'undefined') {
        setShowScrollTopBtn(window.scrollY > 320);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Focused person state
  const [focusedPersonId, setFocusedPersonId] = useState<string>(() => {
    return selectedPersonId || (rootPerson ? rootPerson.id : '');
  });

  useEffect(() => {
    if (!focusedPersonId && rootPerson) {
      setFocusedPersonId(rootPerson.id);
    }
  }, [rootPerson, focusedPersonId]);

  // Sync when selectedPersonId prop changes from parent
  useEffect(() => {
    if (selectedPersonId && selectedPersonId !== focusedPersonId && peopleMap.has(selectedPersonId)) {
      setFocusedPersonId(selectedPersonId);
      setExpandedOrder([]);
      scrollToTop(false);
    }
  }, [selectedPersonId, peopleMap, focusedPersonId, scrollToTop]);

  // Automatically scroll to top whenever focused person changes so new view starts from the very top
  useEffect(() => {
    scrollToTop(false);
    const frameId = requestAnimationFrame(() => {
      scrollToTop(false);
    });
    const timerId = setTimeout(() => {
      scrollToTop(false);
    }, 40);
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timerId);
    };
  }, [focusedPersonId, scrollToTop]);

  // In-place expanded child branches: ordered stack so Back collapses deepest level first (e.g. Level 5 -> Level 4)
  const [expandedOrder, setExpandedOrder] = useState<string[]>([]);
  const expandedChildIds = useMemo(() => new Set(expandedOrder), [expandedOrder]);

  // History trail / breadcrumbs and snapshots of expanded branches per ancestor
  const [historyTrail, setHistoryTrail] = useState<string[]>([]);
  const [trailSnapshots, setTrailSnapshots] = useState<TrailSnapshot[]>([]);

  const focusedPerson = peopleMap.get(focusedPersonId) || rootPerson;

  // Track parent -> children map
  const parentToChildrenMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of relationships) {
      if (r.type === 'parent_child' || r.type === 'other_source_statement') {
        const list = map.get(r.fromPersonId) || [];
        if (!list.includes(r.toPersonId)) {
          list.push(r.toPersonId);
          map.set(r.fromPersonId, list);
        }
      }
    }
    return map;
  }, [relationships]);

  // Helper to collect all descendant IDs of a given node so collapsing a parent cleanly clears sub-levels
  const getDescendantIds = useCallback(
    (startId: string): Set<string> => {
      const descendants = new Set<string>();
      const stack = [startId];
      while (stack.length > 0) {
        const curr = stack.pop()!;
        const kids = parentToChildrenMap.get(curr) || [];
        for (const k of kids) {
          if (!descendants.has(k)) {
            descendants.add(k);
            stack.push(k);
          }
        }
      }
      return descendants;
    },
    [parentToChildrenMap]
  );

  // Push browser history state so Mobile Hardware/Gesture Back Button steps back inside the app instead of exiting
  const pushBrowserHistoryState = useCallback(() => {
    if (typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
      try {
        window.history.pushState({ kintebaNav: true }, '');
      } catch {}
    }
  }, []);

  // Track child -> parents map
  const childToParentsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of relationships) {
      if (r.type === 'parent_child') {
        const list = map.get(r.toPersonId) || [];
        if (!list.includes(r.fromPersonId)) {
          list.push(r.fromPersonId);
          map.set(r.toPersonId, list);
        }
      }
    }
    return map;
  }, [relationships]);

  // Track partners / unions
  const partnerMap = useMemo(() => {
    const map = new Map<string, { partnerId: string; wording: string }[]>();
    for (const r of relationships) {
      if (r.type === 'partner_or_union') {
        const l1 = map.get(r.fromPersonId) || [];
        if (!l1.some((item) => item.partnerId === r.toPersonId)) {
          l1.push({ partnerId: r.toPersonId, wording: r.sourceWording });
          map.set(r.fromPersonId, l1);
        }
        const l2 = map.get(r.toPersonId) || [];
        if (!l2.some((item) => item.partnerId === r.fromPersonId)) {
          l2.push({ partnerId: r.fromPersonId, wording: r.sourceWording });
          map.set(r.toPersonId, l2);
        }
      }
    }
    return map;
  }, [relationships]);

  // Relationships of the focused person
  const parentIds = useMemo(
    () => (focusedPerson ? childToParentsMap.get(focusedPerson.id) || [] : []),
    [focusedPerson, childToParentsMap]
  );

  const childrenIds = useMemo(
    () => (focusedPerson ? parentToChildrenMap.get(focusedPerson.id) || [] : []),
    [focusedPerson, parentToChildrenMap]
  );

  const partners = useMemo(
    () => (focusedPerson ? partnerMap.get(focusedPerson.id) || [] : []),
    [focusedPerson, partnerMap]
  );

  // Siblings (share at least one parent, excluding self)
  const siblingIds = useMemo(() => {
    if (!focusedPerson || parentIds.length === 0) return [];
    const siblings = new Set<string>();
    for (const pId of parentIds) {
      const kids = parentToChildrenMap.get(pId) || [];
      for (const k of kids) {
        if (k !== focusedPerson.id) siblings.add(k);
      }
    }
    return Array.from(siblings);
  }, [focusedPerson, parentIds, parentToChildrenMap]);

  // Navigation handlers
  const handleFocusPerson = (personId: string) => {
    if (personId === focusedPersonId) {
      scrollToTop(true);
      return;
    }
    pushBrowserHistoryState();
    setTrailSnapshots((prev) => [...prev, { personId: focusedPersonId, expandedOrder }]);
    setHistoryTrail((prev) => [...prev, focusedPersonId]);
    setFocusedPersonId(personId);
    setExpandedOrder([]);
    const p = peopleMap.get(personId);
    if (p) onSelectPerson(p);
    scrollToTop(false);
  };

  const handleResetToRoot = () => {
    if (rootPerson) {
      setFocusedPersonId(rootPerson.id);
      setHistoryTrail([]);
      setTrailSnapshots([]);
      setExpandedOrder([]);
      scrollToTop(true);
    }
  };

  const handleBackOneStep = useCallback((): boolean => {
    // 1. If branches are expanded in-place (e.g. Level 5 -> Level 4 -> Level 3), collapse the deepest/latest branch
    if (expandedOrder.length > 0) {
      const lastId = expandedOrder[expandedOrder.length - 1];
      const toRemove = getDescendantIds(lastId);
      toRemove.add(lastId);
      setExpandedOrder((prev) => prev.filter((id) => !toRemove.has(id)));
      return true;
    }

    // 2. If user focused into a person's dedicated page, return to previous focused person & restore their expanded state
    if (historyTrail.length > 0) {
      const previous = historyTrail[historyTrail.length - 1];
      const lastSnap = trailSnapshots[trailSnapshots.length - 1];
      setHistoryTrail((prev) => prev.slice(0, prev.length - 1));
      setTrailSnapshots((prev) => prev.slice(0, prev.length - 1));
      setFocusedPersonId(previous);
      setExpandedOrder(lastSnap ? lastSnap.expandedOrder : []);
      const p = peopleMap.get(previous);
      if (p) onSelectPerson(p);
      scrollToTop(false);
      return true;
    }

    // 3. Fallback if focused person is not root
    if (rootPerson && focusedPersonId !== rootPerson.id) {
      setFocusedPersonId(rootPerson.id);
      setExpandedOrder([]);
      scrollToTop(false);
      return true;
    }

    return false;
  }, [expandedOrder, historyTrail, trailSnapshots, rootPerson, focusedPersonId, getDescendantIds, peopleMap, onSelectPerson, scrollToTop]);

  const toggleChildExpansion = (childId: string) => {
    if (expandedOrder.includes(childId)) {
      const toRemove = getDescendantIds(childId);
      toRemove.add(childId);
      setExpandedOrder((prev) => prev.filter((id) => !toRemove.has(id)));
    } else {
      pushBrowserHistoryState();
      setExpandedOrder((prev) => [...prev, childId]);
    }
  };

  // Intercept Mobile Hardware/Gesture Back Button (popstate) to step back one level instead of closing the app
  const canStepBack =
    expandedOrder.length > 0 ||
    historyTrail.length > 0 ||
    Boolean(rootPerson && focusedPersonId && focusedPersonId !== rootPerson.id);

  const canStepBackRef = useRef(canStepBack);
  canStepBackRef.current = canStepBack;

  const handleBackRef = useRef(handleBackOneStep);
  handleBackRef.current = handleBackOneStep;

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      if ((e as any).__kintebaHandled) return;
      if (canStepBackRef.current) {
        const handled = handleBackRef.current();
        if (handled) {
          (e as any).__kintebaHandled = true;
        }
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (!focusedPerson) {
    return (
      <div className="p-8 text-center bg-stone-100 rounded-2xl border border-stone-200">
        <p className="text-stone-700 font-medium font-ethiopic text-lg">መዝገብ ወለዶ ይዳሎ ኣሎ...</p>
      </div>
    );
  }

  const isRepeatedName = (name: string) => (repeatedNameCounts.get(name) || 0) > 1;

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0 max-w-full overflow-hidden relative">
      {/* Top anchor for seamless scroll-to-top on navigation */}
      <div ref={topAnchorRef} className="h-0 w-full m-0 p-0 pointer-events-none" aria-hidden="true" />
      {/* Top Controls: Breadcrumb Trail and Action Buttons */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200 shadow-2xs w-full min-w-0 max-w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Trail / Breadcrumb */}
          <div className="flex items-center gap-2 overflow-x-auto text-sm font-ethiopic py-1 w-full sm:w-auto">
            <span className="text-stone-400 font-semibold shrink-0">መስመር:</span>
            <button
              onClick={handleResetToRoot}
              className={`font-bold hover:underline shrink-0 ${
                focusedPerson.id === rootPerson?.id ? 'text-amber-800' : 'text-stone-600'
              }`}
            >
              {rootPerson?.canonicalName}
            </button>
            {historyTrail.map((pId) => {
              const p = peopleMap.get(pId);
              if (!p || p.id === rootPerson?.id) return null;
              return (
                <React.Fragment key={p.id}>
                  <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
                  <button
                    onClick={() => handleFocusPerson(p.id)}
                    className="hover:underline text-stone-600 shrink-0 font-medium"
                  >
                    {p.canonicalName}
                  </button>
                </React.Fragment>
              );
            })}
            {focusedPerson.id !== rootPerson?.id && (
              <>
                <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
                <span className="font-bold text-amber-900 shrink-0 bg-amber-100/60 px-2.5 py-0.5 rounded-lg">
                  {focusedPerson.canonicalName}
                </span>
              </>
            )}
          </div>

          {/* Action Buttons: Reset & Back */}
          <div className="flex items-center gap-2 shrink-0">
            {canStepBack && (
              <button
                onClick={handleBackOneStep}
                className="px-4 py-2 min-h-[40px] rounded-xl text-stone-700 bg-stone-100 hover:bg-stone-200 text-sm font-ethiopic font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="ሓደ ደረጃ ተመለስ"
              >
                <span>&larr; ተመለስ</span>
              </button>
            )}

            <button
              onClick={handleResetToRoot}
              className="px-4 py-2 min-h-[40px] rounded-xl text-stone-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-sm font-ethiopic font-semibold flex items-center gap-1.5 transition-colors"
              title="ናብ መበቆል ኣቦ ተመለስ"
            >
              <RotateCcw className="w-4 h-4 text-amber-700" />
              <span>ናብ ቀንድን መበቆልን</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: PARENTS (Ascending generation) */}
      {parentIds.length > 0 && (
        <div className="bg-stone-50/90 p-4 sm:p-5 rounded-2xl border border-stone-200">
          <div className="flex items-center gap-2 mb-3 text-sm font-bold uppercase tracking-wider text-stone-600 font-ethiopic">
            <ArrowUp className="w-4 h-4 text-stone-700" />
            <span>ወለዲ</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {parentIds.map((pId) => {
              const parent = peopleMap.get(pId);
              if (!parent) return null;
              return (
                <div
                  key={parent.id}
                  className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex items-center justify-between hover:border-amber-400 transition-colors"
                >
                  <button
                    onClick={() => handleFocusPerson(parent.id)}
                    className="text-left flex items-center gap-3 min-h-[48px] flex-1 group"
                    title="Click to focus on parent"
                  >
                    <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 font-bold shrink-0 group-hover:bg-amber-200 transition-colors">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-stone-900 font-ethiopic text-lg group-hover:text-amber-800 transition-colors">
                        {parent.canonicalName}
                      </div>
                      <div className="text-xs text-stone-500 font-ethiopic">
                        {parent.canonicalName.includes('ከንቲባ') ? 'ቀንዲ መበቆል' : 'ወላዲ'}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: THE FOCUSED PERSON (Active Center Stage) */}
      <div className="bg-linear-to-b from-amber-50/60 to-white p-3.5 sm:p-6 rounded-2xl border-2 border-amber-500/70 shadow-sm w-full min-w-0 max-w-full overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-amber-700 text-white flex items-center justify-center font-bold text-xl sm:text-2xl shrink-0 shadow-xs font-ethiopic">
              {focusedPerson.canonicalName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center flex-wrap gap-2">
                <h2 className="text-xl sm:text-3xl font-bold text-stone-950 font-ethiopic tracking-tight break-words">
                  {focusedPerson.canonicalName}
                </h2>
                {focusedPerson.status === 'verified' && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold font-ethiopic bg-emerald-100 text-emerald-950 px-2.5 py-1 rounded-full border border-emerald-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    ዝተረጋገጸ
                  </span>
                )}
                {focusedPerson.status === 'needs_review' && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold font-ethiopic bg-amber-100 text-amber-950 px-2.5 py-1 rounded-full border border-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                    ምምርማር ዘድልዮ
                  </span>
                )}
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-3 text-sm text-stone-700 font-ethiopic">
                {focusedPerson.fatherName && (
                  <span className="bg-amber-100/70 text-amber-900 px-3 py-1 rounded-lg font-medium">
                    ኣቦ: <strong>{focusedPerson.fatherName}</strong>
                  </span>
                )}
                {focusedPerson.motherName && (
                  <span className="bg-stone-100 text-stone-800 px-3 py-1 rounded-lg">
                    ኣደ: <strong>{focusedPerson.motherName}</strong>
                  </span>
                )}
                {focusedPerson.branch && (
                  <span className="bg-stone-100 text-stone-800 px-3 py-1 rounded-lg">
                    ጨንፈር: <strong>{focusedPerson.branch === 'Main Ancestor' ? 'ቀንዲ መበቆል' : focusedPerson.branch}</strong>
                  </span>
                )}
                {childrenIds.length > 0 && (
                  <span className="text-amber-800 font-bold bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                    {childrenIds.length} ውሉዳት
                  </span>
                )}
              </div>

              {/* Natural Spouse Note / Marriage Statement */}
              {focusedPerson.spouseNote && (
                <div className="mt-3 text-sm sm:text-base font-ethiopic text-amber-950 bg-amber-100/60 p-3 rounded-xl border border-amber-200 font-medium">
                  {focusedPerson.spouseNote}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Documented Spouse / Unions if any */}
        {partners.length > 0 && (
          <div className="mt-5 pt-4 border-t border-amber-200/80">
            <div className="flex items-center gap-2 mb-2.5 text-xs font-bold uppercase tracking-wider text-amber-950 font-ethiopic">
              <Heart className="w-4 h-4 text-rose-500" />
              <span>ዝተመዝገበ መጻምድቲ / ሓዳር</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {partners.map(({ partnerId, wording }) => {
                const partner = peopleMap.get(partnerId);
                if (!partner) return null;
                return (
                  <div
                    key={partner.id}
                    className="bg-white p-3.5 rounded-xl border border-rose-200 flex items-center justify-between"
                  >
                    <button
                      onClick={() => handleFocusPerson(partner.id)}
                      className="text-left flex items-center gap-3 flex-1 group"
                    >
                      <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                        <Heart className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-stone-900 font-ethiopic text-base group-hover:text-rose-700 transition-colors">
                          {partner.canonicalName}
                        </div>
                        <div className="text-xs text-stone-600 font-ethiopic mt-0.5">
                          {wording || 'መጻምድቲ'}
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Siblings Preview if any */}
        {siblingIds.length > 0 && (
          <div className="mt-4 pt-3 border-t border-stone-200/60 font-ethiopic">
            <span className="text-xs text-stone-600 font-bold mr-2">
              ኣሕዋት ({siblingIds.length}):
            </span>
            <div className="inline-flex flex-wrap gap-2 mt-1">
              {siblingIds.slice(0, 10).map((sibId) => {
                const sibling = peopleMap.get(sibId);
                if (!sibling) return null;
                return (
                  <button
                    key={sibling.id}
                    onClick={() => handleFocusPerson(sibling.id)}
                    className="px-3 py-1.5 text-sm rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-stone-800 font-ethiopic font-semibold transition-colors"
                  >
                    {sibling.canonicalName}
                  </button>
                );
              })}
              {siblingIds.length > 10 && (
                <span className="text-xs text-stone-500 self-center">
                  +{siblingIds.length - 10} ተወሳኺ
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: CHILDREN & DESCENDANTS (Descending generation) */}
      <div className="bg-white p-3.5 sm:p-6 rounded-2xl border border-stone-200 shadow-2xs space-y-3.5 w-full min-w-0 max-w-full overflow-hidden">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-amber-700 shrink-0" />
            <h3 className="text-lg sm:text-xl font-bold text-stone-900 font-ethiopic">
              ውሉዳት ({childrenIds.length})
            </h3>
          </div>
          {childrenIds.length > 0 && (
            <span className="text-xs text-stone-500 font-ethiopic shrink-0">
              ጨንፈር ንምርኣይ ነቲ ቀስቲ ተንክፍ
            </span>
          )}
        </div>

        {/* Recursive multi-generational branch node renderer: Zero truncation & adaptive left-shift for deep levels */}
        {(() => {
          const renderBranchNode = (personId: string, depth = 1): React.ReactNode => {
            const p = peopleMap.get(personId);
            if (!p) return null;
            const kids = parentToChildrenMap.get(personId) || [];
            const hasKids = kids.length > 0;
            const isExpanded = expandedChildIds.has(personId);

            return (
              <div
                key={personId}
                className={`transition-all w-full min-w-0 max-w-full overflow-hidden ${
                  depth === 1
                    ? 'rounded-2xl border bg-stone-50/95 hover:bg-stone-100/95 border-stone-200/90 p-3 sm:p-4 shadow-2xs'
                    : depth === 2
                    ? 'rounded-xl border bg-white hover:bg-amber-50/30 border-stone-200 p-2 sm:p-3 shadow-2xs'
                    : 'rounded-xl border border-stone-200/80 bg-white/95 hover:bg-amber-50/30 p-2 sm:p-2.5 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5 sm:gap-2.5 min-w-0 w-full">
                  {/* Clicking name/card opens their dedicated generational page */}
                  <button
                    type="button"
                    onClick={() => handleFocusPerson(personId)}
                    className="text-left flex items-start gap-2 sm:gap-3 min-h-[44px] min-w-0 flex-1 group cursor-pointer pt-0.5"
                    title={`ናይ ${p.canonicalName} ገጽ ርአ`}
                    aria-label={`ናይ ${p.canonicalName} ገጽ ርአ`}
                  >
                    <div
                      className={`rounded-xl flex items-center justify-center font-bold shrink-0 transition-colors mt-0.5 ${
                        depth === 1
                          ? 'w-10 h-10 sm:w-11 sm:h-11 bg-amber-100 text-amber-800 group-hover:bg-amber-200'
                          : depth === 2
                          ? 'w-8 h-8 sm:w-9 sm:h-9 bg-stone-100 text-stone-700 group-hover:bg-amber-100 group-hover:text-amber-800'
                          : 'w-7 h-7 sm:w-8 sm:h-8 bg-amber-50 text-amber-800 group-hover:bg-amber-100'
                      }`}
                    >
                      <User className={depth === 1 ? 'w-5 h-5' : depth === 2 ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      {/* Name Row: STRICT ZERO TRUNCATION, WRAPS NATURALLY */}
                      <div className="flex items-start justify-between gap-1 min-w-0">
                        <span className="font-black text-stone-900 font-ethiopic text-sm sm:text-base group-hover:text-amber-800 transition-colors break-words whitespace-normal leading-snug">
                          {p.canonicalName}
                        </span>
                        {depth > 1 && (
                          <span className="text-[10px] sm:text-[10.5px] font-black text-amber-900 bg-amber-100/90 px-1.5 py-0.5 rounded-md shrink-0 border border-amber-200/80 font-ethiopic ml-1.5 self-start">
                            ደረጃ {depth}
                          </span>
                        )}
                      </div>

                      {/* Subtitle Row: details, spouse notes, and child counts without truncation */}
                      <div className="text-xs text-stone-600 font-ethiopic flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1 min-w-0">
                        {p.spouseNote && (
                          <span className="text-amber-900/90 break-words whitespace-normal text-[11px] sm:text-xs">
                            {p.spouseNote}
                          </span>
                        )}
                        {hasKids ? (
                          <span className="text-amber-700 font-bold shrink-0 text-xs">
                            {kids.length} ውሉዳት
                          </span>
                        ) : (
                          <span className="text-stone-400 shrink-0 text-xs">
                            ገጽ ርአ &rarr;
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center shrink-0 pl-1 pt-0.5">
                    {/* Dedicated in-place expand/collapse button */}
                    {hasKids ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleChildExpansion(personId);
                        }}
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                          isExpanded
                            ? 'bg-amber-700 text-white shadow-xs'
                            : 'bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 border border-stone-200'
                        }`}
                        title={
                          isExpanded
                            ? `ናይ ${p.canonicalName} ጨንፈር ዓጽፍ`
                            : `ናይ ${p.canonicalName} ጨንፈር ዘርግሕ`
                        }
                        aria-label={
                          isExpanded
                            ? `ናይ ${p.canonicalName} ጨንፈር ዓጽፍ`
                            : `ናይ ${p.canonicalName} ጨንፈር ዘርግሕ`
                        }
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        ) : (
                          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-stone-600" />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleFocusPerson(personId)}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 text-stone-400 hover:text-amber-800 hover:bg-stone-100 transition-colors cursor-pointer"
                        title={`ናይ ${p.canonicalName} ገጽ ክፈት`}
                        aria-label={`ናይ ${p.canonicalName} ገጽ ክፈት`}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Multi-generational nested branches in-place: Adaptive left-shift for deep levels (depth >= 3) */}
                {isExpanded && hasKids && (
                  <div
                    className={`pt-2 mt-2 font-ethiopic space-y-2 ${
                      depth === 1
                        ? 'border-l-2 border-amber-400/80 ml-1.5 sm:ml-3 pl-2 sm:pl-3'
                        : depth === 2
                        ? 'border-l-2 border-amber-400/70 ml-1 sm:ml-2 pl-1.5 sm:pl-2'
                        : 'border-l-2 border-amber-500/90 ml-0.5 pl-1.5'
                    }`}
                  >
                    <div className="flex items-center text-xs text-stone-600 font-bold px-1 pb-1 gap-1">
                      <span className="text-amber-700 font-extrabold shrink-0">↳</span>
                      <span className="text-stone-800 break-words whitespace-normal text-xs sm:text-sm font-ethiopic leading-snug">
                        ናይ {p.canonicalName} ውሉዳት ({kids.length}):
                      </span>
                    </div>
                    <div className="space-y-2">
                      {kids.map((kidId) => renderBranchNode(kidId, depth + 1))}
                    </div>
                  </div>
                )}
              </div>
            );
          };

          if (childrenIds.length === 0) {
            return (
              <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-stone-500 text-base font-ethiopic">
                ኣብዚ መዝገብ ዝተመዝገቡ ውሉዳት የለዉን።
              </div>
            );
          }

          return (
            <div className="space-y-2.5">
              {childrenIds.map((childId) => renderBranchNode(childId, 1))}
            </div>
          );
        })()}
      </div>

      {/* Floating Scroll to Top button for quick convenient navigation on long branches */}
      {showScrollTopBtn && (
        <button
          type="button"
          onClick={() => scrollToTop(true)}
          className="fixed bottom-20 right-4 sm:bottom-8 sm:right-8 z-30 p-3 bg-amber-800/95 hover:bg-amber-900 text-white rounded-full shadow-lg border border-amber-500/50 flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs hover:scale-105 active:scale-95"
          title="ናብ ላዕሊ ተመለስ"
          aria-label="ናብ ላዕሊ ተመለስ"
        >
          <ArrowUp className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}
    </div>
  );
};
