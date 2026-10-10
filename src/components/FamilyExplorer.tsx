import React, { useState, useMemo, useEffect } from 'react';
import { Person, Relationship } from '../types/genealogy';
import {
  ChevronRight,
  ChevronDown,
  User,
  Heart,
  Users,
  Search,
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
}

export const FamilyExplorer: React.FC<FamilyExplorerProps> = ({
  people,
  relationships,
  onSelectPerson,
  onOpenDetails,
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

  // Focused person state
  const [focusedPersonId, setFocusedPersonId] = useState<string>('');

  useEffect(() => {
    if (!focusedPersonId && rootPerson) {
      setFocusedPersonId(rootPerson.id);
    }
  }, [rootPerson, focusedPersonId]);

  // In-place expanded child branches
  const [expandedChildIds, setExpandedChildIds] = useState<Set<string>>(new Set());

  // Search input for quick jump
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // History trail / breadcrumbs
  const [historyTrail, setHistoryTrail] = useState<string[]>([]);

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
    if (personId === focusedPersonId) return;
    setHistoryTrail((prev) => [...prev, focusedPersonId]);
    setFocusedPersonId(personId);
    setExpandedChildIds(new Set());
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const handleResetToRoot = () => {
    if (rootPerson) {
      setFocusedPersonId(rootPerson.id);
      setHistoryTrail([]);
      setExpandedChildIds(new Set());
    }
  };

  const handleBackOneStep = () => {
    if (historyTrail.length > 0) {
      const previous = historyTrail[historyTrail.length - 1];
      setHistoryTrail((prev) => prev.slice(0, prev.length - 1));
      setFocusedPersonId(previous);
      setExpandedChildIds(new Set());
    }
  };

  const toggleChildExpansion = (childId: string) => {
    setExpandedChildIds((prev) => {
      const next = new Set(prev);
      if (next.has(childId)) next.delete(childId);
      else next.add(childId);
      return next;
    });
  };

  // Search filter
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    return people
      .filter(
        (p) =>
          p.canonicalName.toLowerCase().includes(q) ||
          (p.fatherName && p.fatherName.toLowerCase().includes(q)) ||
          (p.displayName && p.displayName.toLowerCase().includes(q)) ||
          (p.branch && p.branch.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [searchQuery, people]);

  if (!focusedPerson) {
    return (
      <div className="p-8 text-center bg-stone-100 rounded-2xl border border-stone-200">
        <p className="text-stone-700 font-medium font-ethiopic text-lg">መዝገብ ወለዶ ይዳሎ ኣሎ...</p>
      </div>
    );
  }

  const isRepeatedName = (name: string) => (repeatedNameCounts.get(name) || 0) > 1;

  return (
    <div className="space-y-6">
      {/* Top Controls: Search and Breadcrumb Trail */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Quick Search Jump */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              placeholder="ስም ወይ ኣቦ ጽሒፍካ ቀጥታ ድለ... (ንኣብነት: ጎብሩ፣ ሃብቱ)"
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-stone-300 bg-stone-50 text-stone-900 placeholder:text-stone-400 text-base font-ethiopic focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
              aria-label="ስም ድለ"
            />
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white rounded-xl border border-stone-200 shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleFocusPerson(result.id)}
                    className="w-full text-left px-4 py-3.5 hover:bg-amber-50 border-b border-stone-100 last:border-0 flex items-center justify-between text-base font-ethiopic transition-colors"
                  >
                    <div>
                      <div className="font-bold text-stone-900">{result.canonicalName}</div>
                      {result.fatherName && (
                        <div className="text-xs text-stone-500">ወዲ/ጓል {result.fatherName}</div>
                      )}
                    </div>
                    {result.branch && (
                      <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded font-ethiopic">
                        ጨንፈር {result.branch}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons: Reset & Back */}
          <div className="flex items-center gap-2">
            {historyTrail.length > 0 && (
              <button
                onClick={handleBackOneStep}
                className="px-4 py-2.5 min-h-[44px] rounded-xl text-stone-700 bg-stone-100 hover:bg-stone-200 text-sm font-ethiopic font-semibold flex items-center gap-1.5 transition-colors"
                title="ሓደ ደረጃ ተመለስ"
              >
                <span>&larr; ተመለስ</span>
              </button>
            )}

            <button
              onClick={handleResetToRoot}
              className="px-4 py-2.5 min-h-[44px] rounded-xl text-stone-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-sm font-ethiopic font-semibold flex items-center gap-1.5 transition-colors"
              title="ናብ መበቆል ኣቦ ተመለስ"
            >
              <RotateCcw className="w-4 h-4 text-amber-700" />
              <span>ናብ ቀንድን መበቆልን</span>
            </button>
          </div>
        </div>

        {/* Trail / Breadcrumb */}
        <div className="pt-2 border-t border-stone-100 flex items-center gap-2 overflow-x-auto text-sm font-ethiopic">
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
                  <button
                    onClick={() => {
                      onSelectPerson(parent);
                      if (onOpenDetails) onOpenDetails(parent);
                    }}
                    className="p-2.5 text-stone-400 hover:text-amber-700 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-stone-100"
                    title="ዝርዝር መረዳእታ"
                    aria-label={`View details for ${parent.canonicalName}`}
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: THE FOCUSED PERSON (Active Center Stage) */}
      <div className="bg-linear-to-b from-amber-50/60 to-white p-5 sm:p-7 rounded-3xl border-2 border-amber-500/70 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-700 text-white flex items-center justify-center font-bold text-2xl shrink-0 shadow-sm font-ethiopic">
              {focusedPerson.canonicalName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2.5">
                <h2 className="text-2xl sm:text-3xl font-bold text-stone-950 font-ethiopic tracking-tight">
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
                    ጨንፈር: <strong>{focusedPerson.branch}</strong>
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

          {/* View Full Details Button */}
          <button
            onClick={() => {
              onSelectPerson(focusedPerson);
              if (onOpenDetails) onOpenDetails(focusedPerson);
            }}
            className="px-5 py-3 min-h-[48px] bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold font-ethiopic text-base shadow-sm flex items-center justify-center gap-2 transition-colors self-start md:self-center focus:ring-2 focus:ring-amber-500"
          >
            <FileText className="w-5 h-5" />
            <span>ዝርዝር መረዳእታ</span>
          </button>
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
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-700" />
            <h3 className="text-xl font-bold text-stone-900 font-ethiopic">
              ውሉዳት ({childrenIds.length})
            </h3>
          </div>
          {childrenIds.length > 0 && (
            <span className="text-xs text-stone-500 font-ethiopic">
              ጨንፈር ንምርኣይ ጠውቑ
            </span>
          )}
        </div>

        {childrenIds.length === 0 ? (
          <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-stone-500 text-base font-ethiopic">
            ኣብዚ መዝገብ ዝተመዝገቡ ውሉዳት የለዉን።
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {childrenIds.map((childId) => {
              const child = peopleMap.get(childId);
              if (!child) return null;
              const grandchildren = parentToChildrenMap.get(child.id) || [];
              const isExpanded = expandedChildIds.has(child.id);

              return (
                <div
                  key={child.id}
                  className="bg-stone-50/90 hover:bg-stone-50 rounded-2xl border border-stone-200 p-4 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    {/* Focus on this child */}
                    <button
                      onClick={() => handleFocusPerson(child.id)}
                      className="text-left flex items-center gap-3.5 min-h-[48px] flex-1 group"
                      title="Focus on this branch"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-800 font-bold shrink-0 group-hover:bg-amber-200 transition-colors">
                        <User className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="font-bold text-stone-900 font-ethiopic text-lg sm:text-xl group-hover:text-amber-800 transition-colors flex items-center gap-2">
                          <span>{child.canonicalName}</span>
                        </div>
                        <div className="text-xs text-stone-600 font-ethiopic flex items-center gap-2 mt-0.5">
                          {child.spouseNote && (
                            <span className="text-amber-900 truncate max-w-[200px]">
                              {child.spouseNote}
                            </span>
                          )}
                          {grandchildren.length > 0 && (
                            <span className="text-amber-700 font-bold">
                              {grandchildren.length} ውሉዳት
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5">
                      {/* In-place expand/collapse descendants if they have children */}
                      {grandchildren.length > 0 && (
                        <button
                          onClick={() => toggleChildExpansion(child.id)}
                          className="px-3 py-2 min-h-[44px] rounded-xl text-sm font-ethiopic font-bold text-stone-700 hover:bg-stone-200 flex items-center gap-1 transition-colors"
                          title={isExpanded ? 'Collapse branch' : 'Expand branch'}
                          aria-label={
                            isExpanded
                              ? `Collapse branch for ${child.canonicalName}`
                              : `Expand branch for ${child.canonicalName}`
                          }
                        >
                          {isExpanded ? (
                            <>
                              <ChevronDown className="w-5 h-5 text-amber-700" />
                              <span className="hidden sm:inline">ዕጾ</span>
                            </>
                          ) : (
                            <>
                              <ChevronRight className="w-5 h-5 text-stone-600" />
                              <span className="hidden sm:inline">ክፈት</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => {
                          onSelectPerson(child);
                          if (onOpenDetails) onOpenDetails(child);
                        }}
                        className="p-2.5 text-stone-400 hover:text-amber-700 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-stone-200"
                        title="ዝርዝር መረዳእታ"
                        aria-label={`View details for ${child.canonicalName}`}
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Nested Descendants (when expanded) */}
                  {isExpanded && grandchildren.length > 0 && (
                    <div className="pl-4 pt-3 border-l-2 border-amber-400 ml-6 space-y-2 font-ethiopic">
                      <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">
                        ናይ {child.canonicalName} ውሉዳት:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {grandchildren.map((gcId) => {
                          const grandChild = peopleMap.get(gcId);
                          if (!grandChild) return null;
                          return (
                            <button
                              key={grandChild.id}
                              onClick={() => handleFocusPerson(grandChild.id)}
                              className="text-left p-3 rounded-xl bg-white border border-stone-200 hover:border-amber-400 text-sm flex items-center justify-between group transition-colors"
                            >
                              <span className="font-bold text-stone-900 group-hover:text-amber-800">
                                {grandChild.canonicalName}
                              </span>
                              {grandChild.spouseNote && (
                                <span className="text-[11px] text-amber-800 truncate max-w-[120px]">
                                  {grandChild.spouseNote}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
