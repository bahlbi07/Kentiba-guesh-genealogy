import React, { useState, useMemo, useEffect } from 'react';
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
}

export const FamilyExplorer: React.FC<FamilyExplorerProps> = ({
  people,
  relationships,
  onSelectPerson,
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
    const p = peopleMap.get(personId);
    if (p) onSelectPerson(p);
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
      {/* Top Controls: Breadcrumb Trail and Action Buttons */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-sm">
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
            {historyTrail.length > 0 && (
              <button
                onClick={handleBackOneStep}
                className="px-4 py-2 min-h-[40px] rounded-xl text-stone-700 bg-stone-100 hover:bg-stone-200 text-sm font-ethiopic font-semibold flex items-center gap-1.5 transition-colors"
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

        {/* Recursive multi-generational branch node renderer */}
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
                className={`rounded-2xl border transition-all ${
                  depth === 1
                    ? 'bg-stone-50/90 hover:bg-stone-50 border-stone-200 p-4 space-y-3'
                    : 'bg-white hover:bg-amber-50/20 border-stone-200 p-3.5 space-y-2.5 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Clicking name/card opens their dedicated generational page */}
                  <button
                    onClick={() => handleFocusPerson(personId)}
                    className="text-left flex items-center gap-3.5 min-h-[48px] flex-1 group"
                    title={`ናይ ${p.canonicalName} ገጽ ርአ`}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 transition-colors ${
                        depth === 1
                          ? 'bg-amber-100 text-amber-800 group-hover:bg-amber-200'
                          : 'bg-stone-100 text-stone-700 group-hover:bg-amber-100 group-hover:text-amber-800'
                      }`}
                    >
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-stone-900 font-ethiopic text-base sm:text-lg group-hover:text-amber-800 transition-colors flex items-center gap-2">
                        <span>{p.canonicalName}</span>
                      </div>
                      <div className="text-xs text-stone-600 font-ethiopic flex items-center gap-2 mt-0.5">
                        {p.spouseNote && (
                          <span className="text-amber-900 truncate max-w-[200px]">
                            {p.spouseNote}
                          </span>
                        )}
                        {hasKids ? (
                          <span className="text-amber-700 font-bold">
                            {kids.length} ውሉዳት
                          </span>
                        ) : (
                          <span className="text-stone-400">
                            ገጽ ንምርኣይ ጠውቕ
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {/* Dedicated in-place expand/collapse button if has kids */}
                    {hasKids ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleChildExpansion(personId);
                        }}
                        className="px-3 py-2 min-h-[44px] rounded-xl text-sm font-ethiopic font-bold text-stone-700 bg-stone-100 hover:bg-amber-100 hover:text-amber-900 flex items-center gap-1 transition-colors"
                        title={isExpanded ? 'ጨንፈር ዓጽፍ' : 'ጨንፈር ዘርግሕ'}
                        aria-label={
                          isExpanded
                            ? `ናይ ${p.canonicalName} ጨንፈር ዓጽፍ`
                            : `ናይ ${p.canonicalName} ጨንፈር ዘርግሕ`
                        }
                      >
                        {isExpanded ? (
                          <>
                            <ChevronDown className="w-5 h-5 text-amber-700" />
                            <span className="text-xs">ዕጾ</span>
                          </>
                        ) : (
                          <>
                            <ChevronRight className="w-5 h-5 text-stone-600" />
                            <span className="text-xs">ዘርግሕ</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleFocusPerson(personId)}
                        className="px-2.5 py-1.5 min-h-[40px] rounded-xl text-xs font-ethiopic font-semibold text-stone-600 hover:bg-stone-100 hover:text-amber-800 flex items-center gap-1 transition-colors"
                        title={`ናይ ${p.canonicalName} ገጽ ክፈት`}
                      >
                        <span>ገጽ ርአ &rarr;</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Multi-generational nested branches in-place */}
                {isExpanded && hasKids && (
                  <div className="pl-3 sm:pl-4 pt-3 border-l-2 border-amber-400 ml-4 sm:ml-5 space-y-2.5 font-ethiopic">
                    <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">
                      ናይ {p.canonicalName} ውሉዳት ({kids.length}):
                    </span>
                    <div className="space-y-2.5">
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
            <div className="space-y-3">
              {childrenIds.map((childId) => renderBranchNode(childId, 1))}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
