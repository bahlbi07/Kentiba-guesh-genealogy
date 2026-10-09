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
  List,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  FileText,
  CornerDownRight,
  ArrowUp,
  Tag
} from 'lucide-react';
import { TreeListAlternative } from './TreeListAlternative';

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
  // Navigation mode: 'visual' (progressive cards) vs 'list' (accessible nested list)
  const [viewMode, setViewMode] = useState<'visual' | 'list'>('visual');

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
      (p) => p.canonicalName.includes('ከንቲባ ጉዑሽ') || p.id === 'pers_p1_0_0'
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
          (p.displayName && p.displayName.toLowerCase().includes(q)) ||
          p.id.toLowerCase().includes(q) ||
          (p.branch && p.branch.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [searchQuery, people]);

  if (!focusedPerson) {
    return (
      <div className="p-8 text-center bg-stone-100 rounded-xl border border-stone-200">
        <p className="text-stone-600 font-medium">መዛግብቲ ኣይተረኽበን። በጃኹም ዳታ ኣእትዉ።</p>
      </div>
    );
  }

  const isRepeatedName = (name: string) => (repeatedNameCounts.get(name) || 0) > 1;

  return (
    <div className="space-y-6">
      {/* Top Controls: Search, View Mode Toggle, and Breadcrumbs */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Quick Search Jump */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 absolute left-3.5 top-3 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              placeholder="ስም ጽሒፍካ ቀጥታ ድለ... (ንኣብነት: ጎብሩ፣ ሃብቱ፣ ተክኣ)"
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-stone-300 bg-stone-50 text-stone-900 placeholder:text-stone-400 text-sm font-ethiopic focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
              aria-label="Search person to jump in family explorer"
            />
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white rounded-xl border border-stone-200 shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleFocusPerson(result.id)}
                    className="w-full text-left px-4 py-3 hover:bg-amber-50/70 border-b border-stone-100 last:border-0 flex items-center justify-between text-sm transition-colors"
                  >
                    <div>
                      <span className="font-bold text-stone-900 font-ethiopic text-base mr-2">
                        {result.canonicalName}
                      </span>
                      {result.branch && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-ethiopic">
                          ጨንፈር: {result.branch}
                        </span>
                      )}
                    </div>
                    <div className="text-right text-xs text-stone-400">
                      {result.sourcePage && <span>ገጽ {result.sourcePage}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Controls: Reset, Back, Mode Switch */}
          <div className="flex items-center gap-2">
            {historyTrail.length > 0 && (
              <button
                onClick={handleBackOneStep}
                className="px-3.5 py-2 min-h-[44px] rounded-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors focus:ring-2 focus:ring-amber-500"
                title="Go back to previously viewed person"
              >
                &larr; ተመለስ
              </button>
            )}

            <button
              onClick={handleResetToRoot}
              className="px-3.5 py-2 min-h-[44px] rounded-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors focus:ring-2 focus:ring-amber-500"
              title="Return to Patriarch Kinteba Guush Hagos"
            >
              <RotateCcw className="w-4 h-4 text-amber-700" />
              <span>ናብ ዋና መስራች</span>
            </button>

            {/* Toggle visual explorer vs accessible list */}
            <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200">
              <button
                onClick={() => setViewMode('visual')}
                className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  viewMode === 'visual'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                aria-pressed={viewMode === 'visual'}
              >
                <Users className="w-3.5 h-3.5 text-amber-700" />
                <span>ስእላዊ ኦም</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                aria-pressed={viewMode === 'list'}
              >
                <List className="w-3.5 h-3.5 text-stone-700" />
                <span>ዝርዝር</span>
              </button>
            </div>
          </div>
        </div>

        {/* Breadcrumb Trail */}
        <div className="pt-2 border-t border-stone-100 flex items-center flex-wrap gap-1.5 text-xs text-stone-500">
          <span className="font-medium text-stone-700">ዝተኸተለ መስመር:</span>
          <button
            onClick={handleResetToRoot}
            className="hover:text-amber-800 font-ethiopic font-medium underline underline-offset-2"
          >
            {rootPerson?.canonicalName || 'ዋና መስራች'}
          </button>
          {focusedPerson.id !== rootPerson?.id && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
              <span className="font-ethiopic font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                {focusedPerson.canonicalName}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Alternative Accessible Hierarchical List View */}
      {viewMode === 'list' ? (
        <TreeListAlternative
          people={people}
          relationships={relationships}
          onSelectPerson={(p) => {
            onSelectPerson(p);
            if (onOpenDetails) onOpenDetails(p);
          }}
          rootId={focusedPerson.id}
        />
      ) : (
        /* Visual Progressive Family Explorer Layout */
        <div className="space-y-6">
          {/* SECTION 1: PARENTS (Ascending generation) */}
          {parentIds.length > 0 && (
            <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200">
              <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
                <ArrowUp className="w-4 h-4 text-stone-600" />
                <span>ወለዲ (Parents)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {parentIds.map((pId) => {
                  const parent = peopleMap.get(pId);
                  if (!parent) return null;
                  return (
                    <div
                      key={parent.id}
                      className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs flex items-center justify-between hover:border-amber-400 transition-colors"
                    >
                      <button
                        onClick={() => handleFocusPerson(parent.id)}
                        className="text-left flex items-center gap-3 min-h-[44px] flex-1 group"
                        title="Click to focus on parent"
                      >
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 font-bold shrink-0 group-hover:bg-amber-200 transition-colors">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-stone-900 font-ethiopic text-base group-hover:text-amber-800 transition-colors">
                            {parent.canonicalName}
                          </div>
                          <div className="text-xs text-stone-400">
                            {parent.sourcePage ? `ገጽ ${parent.sourcePage}` : 'ወላዲ'}
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => onSelectPerson(parent)}
                        className="p-2 text-stone-400 hover:text-amber-700 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-stone-100"
                        title="View Full Profile"
                        aria-label={`View details for ${parent.canonicalName}`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 2: THE FOCUSED PERSON (Active Center Stage) */}
          <div className="bg-linear-to-b from-amber-50/50 to-white p-5 sm:p-6 rounded-2xl border-2 border-amber-500/70 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-700 text-white flex items-center justify-center font-bold text-xl shrink-0 shadow-sm">
                  {focusedPerson.canonicalName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center flex-wrap gap-2">
                    <h2 className="text-2xl sm:text-3xl font-bold text-stone-950 font-ethiopic tracking-tight">
                      {focusedPerson.canonicalName}
                    </h2>
                    {isRepeatedName(focusedPerson.canonicalName) && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
                        <Tag className="w-3 h-3 text-amber-700" />
                        ተደጋጋሚ ስም (Distinct Record)
                      </span>
                    )}
                    {focusedPerson.status === 'verified' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full border border-emerald-300">
                        <ShieldCheck className="w-3 h-3 text-emerald-700" />
                        ዝተረጋገጸ (Verified)
                      </span>
                    )}
                    {focusedPerson.status === 'needs_review' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-700" />
                        ምምርማር ዘድልዮ (Needs Review)
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs sm:text-sm text-stone-600">
                    <span className="font-mono bg-stone-100 px-2 py-0.5 rounded text-stone-600">
                      ID: #{focusedPerson.id.replace('pers_', '')}
                    </span>
                    {focusedPerson.branch && (
                      <span className="font-ethiopic bg-stone-100 px-2 py-0.5 rounded text-stone-700">
                        ጨንፈር: <strong>{focusedPerson.branch}</strong>
                      </span>
                    )}
                    {focusedPerson.sourcePage && (
                      <span className="bg-stone-100 px-2 py-0.5 rounded text-stone-700">
                        ምንጪ PDF: <strong>ገጽ {focusedPerson.sourcePage}</strong>
                      </span>
                    )}
                    {childrenIds.length > 0 && (
                      <span className="text-amber-800 font-medium">
                        {childrenIds.length} ውሉዳት (Children)
                      </span>
                    )}
                  </div>

                  {focusedPerson.notes && (
                    <p className="mt-2.5 text-xs sm:text-sm text-stone-600 italic bg-amber-50/70 p-2.5 rounded-lg border border-amber-200/60 max-w-2xl font-ethiopic">
                      &ldquo;{focusedPerson.notes}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {/* View Full Details Button */}
              <button
                onClick={() => {
                  onSelectPerson(focusedPerson);
                  if (onOpenDetails) onOpenDetails(focusedPerson);
                }}
                className="px-4 py-2.5 min-h-[44px] bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-medium text-sm shadow-sm flex items-center justify-center gap-2 transition-colors self-start md:self-center focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              >
                <FileText className="w-4 h-4" />
                <span>ምሉእ መረዳእታ ርአ</span>
              </button>
            </div>

            {/* Documented Spouse / Unions if any */}
            {partners.length > 0 && (
              <div className="mt-5 pt-4 border-t border-amber-200/80">
                <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-amber-900">
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  <span>ዝተመዝገበ ዝምድና መጻምድቲ (Documented Union/Spouse)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {partners.map(({ partnerId, wording }) => {
                    const partner = peopleMap.get(partnerId);
                    if (!partner) return null;
                    return (
                      <div
                        key={partner.id}
                        className="bg-white p-3 rounded-xl border border-rose-200/80 flex items-center justify-between"
                      >
                        <button
                          onClick={() => handleFocusPerson(partner.id)}
                          className="text-left flex items-center gap-2.5 flex-1 group"
                        >
                          <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                            <Heart className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-stone-900 font-ethiopic text-sm group-hover:text-rose-700 transition-colors">
                              {partner.canonicalName}
                            </div>
                            <div className="text-[11px] text-stone-500 truncate max-w-[200px] font-ethiopic">
                              {wording || 'መጻምድቲ'}
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => onSelectPerson(partner)}
                          className="p-1.5 text-stone-400 hover:text-rose-700 rounded-lg hover:bg-stone-100"
                          title="Open Details"
                          aria-label={`Open details for ${partner.canonicalName}`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Siblings Preview if any */}
            {siblingIds.length > 0 && (
              <div className="mt-4 pt-3 border-t border-stone-200/60">
                <span className="text-xs text-stone-500 font-medium mr-2">
                  ኣሕዋት ({siblingIds.length}):
                </span>
                <div className="inline-flex flex-wrap gap-1.5 mt-1">
                  {siblingIds.slice(0, 8).map((sibId) => {
                    const sibling = peopleMap.get(sibId);
                    if (!sibling) return null;
                    return (
                      <button
                        key={sibling.id}
                        onClick={() => handleFocusPerson(sibling.id)}
                        className="px-2.5 py-1 text-xs rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-ethiopic font-medium transition-colors"
                      >
                        {sibling.canonicalName}
                      </button>
                    );
                  })}
                  {siblingIds.length > 8 && (
                    <span className="text-xs text-stone-400 self-center">
                      +{siblingIds.length - 8} ተወሳኺ
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: CHILDREN & DESCENDANTS (Descending generation) */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-700" />
                <h3 className="text-lg font-bold text-stone-900 font-ethiopic">
                  ውሉዳት ({childrenIds.length})
                </h3>
              </div>
              {childrenIds.length > 0 && (
                <span className="text-xs text-stone-500 font-medium">
                  ጨንፈር ንምርኣይ ጠውቑ
                </span>
              )}
            </div>

            {childrenIds.length === 0 ? (
              <div className="p-6 text-center bg-stone-50 rounded-xl border border-dashed border-stone-200 text-stone-500 text-sm">
                ኣብዚ መዝገብ ዝተመዝገቡ ውሉዳት የለዉን።
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {childrenIds.map((childId) => {
                  const child = peopleMap.get(childId);
                  if (!child) return null;
                  const grandchildren = parentToChildrenMap.get(child.id) || [];
                  const isExpanded = expandedChildIds.has(child.id);

                  return (
                    <div
                      key={child.id}
                      className="bg-stone-50/80 hover:bg-stone-50 rounded-xl border border-stone-200 p-3.5 transition-all space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        {/* Focus on this child */}
                        <button
                          onClick={() => handleFocusPerson(child.id)}
                          className="text-left flex items-center gap-3 min-h-[44px] flex-1 group"
                          title="Focus on this branch"
                        >
                          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 font-bold shrink-0 group-hover:bg-amber-200 transition-colors">
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-bold text-stone-900 font-ethiopic text-base group-hover:text-amber-800 transition-colors flex items-center gap-1.5">
                              <span>{child.canonicalName}</span>
                              {isRepeatedName(child.canonicalName) && (
                                <span className="text-[10px] bg-stone-200 text-stone-700 px-1.5 py-0.2 rounded font-sans">
                                  #{child.id.replace('pers_', '')}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-stone-500 flex items-center gap-2">
                              {child.sourcePage && <span>ገጽ {child.sourcePage}</span>}
                              {grandchildren.length > 0 && (
                                <span className="text-amber-700 font-medium font-ethiopic">
                                  {grandchildren.length} ውሉዳት
                                </span>
                              )}
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-1">
                          {/* In-place expand/collapse descendants if they have children */}
                          {grandchildren.length > 0 && (
                            <button
                              onClick={() => toggleChildExpansion(child.id)}
                              className="px-2.5 py-1.5 min-h-[44px] rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-200/80 flex items-center gap-1 transition-colors"
                              title={isExpanded ? 'Collapse branch' : 'Expand branch'}
                              aria-label={
                                isExpanded
                                  ? `Collapse branch for ${child.canonicalName}`
                                  : `Expand branch for ${child.canonicalName}`
                              }
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronDown className="w-4 h-4 text-amber-700" />
                                  <span className="hidden sm:inline">ዕጾ</span>
                                </>
                              ) : (
                                <>
                                  <ChevronRight className="w-4 h-4 text-stone-600" />
                                  <span className="hidden sm:inline">ክፈት</span>
                                </>
                              )}
                            </button>
                          )}

                          <button
                            onClick={() => onSelectPerson(child)}
                            className="p-2 text-stone-400 hover:text-amber-700 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-stone-200"
                            title="View Details"
                            aria-label={`View details for ${child.canonicalName}`}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Nested Descendants (when expanded) */}
                      {isExpanded && grandchildren.length > 0 && (
                        <div className="pl-4 pt-2 border-l-2 border-amber-300 ml-5 space-y-1.5">
                          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
                            ናይ {child.canonicalName} ውሉዳት:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {grandchildren.map((gcId) => {
                              const grandChild = peopleMap.get(gcId);
                              if (!grandChild) return null;
                              return (
                                <button
                                  key={grandChild.id}
                                  onClick={() => handleFocusPerson(grandChild.id)}
                                  className="text-left p-2 rounded-lg bg-white border border-stone-200 hover:border-amber-400 text-xs flex items-center justify-between group transition-colors"
                                >
                                  <span className="font-bold text-stone-800 font-ethiopic group-hover:text-amber-800">
                                    {grandChild.canonicalName}
                                  </span>
                                  <span className="text-[10px] text-stone-400">
                                    {grandChild.sourcePage ? `ገጽ ${grandChild.sourcePage}` : ''}
                                  </span>
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
      )}
    </div>
  );
};

