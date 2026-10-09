import React, { useState, useMemo } from 'react';
import { Person, Relationship } from '../types/genealogy';
import {
  User,
  Users,
  Heart,
  FileText,
  ShieldCheck,
  AlertTriangle,
  GitFork,
  Search,
  BookOpen,
  ArrowRight,
  ExternalLink,
  Tag
} from 'lucide-react';

interface FamilyInformationViewProps {
  person: Person | null;
  people: Person[];
  relationships: Relationship[];
  onSelectPerson: (person: Person) => void;
  onExploreInTree: (person: Person) => void;
}

export const FamilyInformationView: React.FC<FamilyInformationViewProps> = ({
  person,
  people,
  relationships,
  onSelectPerson,
  onExploreInTree,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Map people for lookup
  const peopleMap = useMemo(() => {
    const map = new Map<string, Person>();
    for (const p of people) map.set(p.id, p);
    return map;
  }, [people]);

  // Repeated name counts
  const repeatedNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of people) {
      counts.set(p.canonicalName, (counts.get(p.canonicalName) || 0) + 1);
    }
    return counts;
  }, [people]);

  // Find relationships for current person
  const { parents, children, partners, siblings, evidenceStatements } = useMemo(() => {
    if (!person) {
      return { parents: [], children: [], partners: [], siblings: [], evidenceStatements: [] };
    }

    const parentList: Person[] = [];
    const childList: Person[] = [];
    const partnerList: { partner: Person; wording: string }[] = [];
    const statements: Relationship[] = [];

    for (const r of relationships) {
      if (r.toPersonId === person.id && r.type === 'parent_child') {
        const parent = peopleMap.get(r.fromPersonId);
        if (parent && !parentList.some((p) => p.id === parent.id)) {
          parentList.push(parent);
        }
        statements.push(r);
      } else if (r.fromPersonId === person.id && (r.type === 'parent_child' || r.type === 'other_source_statement')) {
        const child = peopleMap.get(r.toPersonId);
        if (child && !childList.some((c) => c.id === child.id)) {
          childList.push(child);
        }
        statements.push(r);
      } else if (r.type === 'partner_or_union') {
        if (r.fromPersonId === person.id) {
          const part = peopleMap.get(r.toPersonId);
          if (part && !partnerList.some((p) => p.partner.id === part.id)) {
            partnerList.push({ partner: part, wording: r.sourceWording });
          }
          statements.push(r);
        } else if (r.toPersonId === person.id) {
          const part = peopleMap.get(r.fromPersonId);
          if (part && !partnerList.some((p) => p.partner.id === part.id)) {
            partnerList.push({ partner: part, wording: r.sourceWording });
          }
          statements.push(r);
        }
      }
    }

    // Determine siblings
    const siblingList: Person[] = [];
    if (parentList.length > 0) {
      const parentIds = new Set(parentList.map((p) => p.id));
      for (const r of relationships) {
        if (parentIds.has(r.fromPersonId) && r.toPersonId !== person.id && r.type === 'parent_child') {
          const sib = peopleMap.get(r.toPersonId);
          if (sib && !siblingList.some((s) => s.id === sib.id)) {
            siblingList.push(sib);
          }
        }
      }
    }

    return {
      parents: parentList,
      children: childList,
      partners: partnerList,
      siblings: siblingList,
      evidenceStatements: statements,
    };
  }, [person, relationships, peopleMap]);

  // Search filter when picking a person
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    return people
      .filter(
        (p) =>
          p.canonicalName.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.branch && p.branch.toLowerCase().includes(q))
      )
      .slice(0, 12);
  }, [searchQuery, people]);

  // If no person selected, provide search and quick select list
  if (!person) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 py-4 sm:py-6">
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-stone-900 font-ethiopic">
              መረዳእታ ስድራቤት ንምርኣይ ሰብ ምረጹ
            </h2>
            <p className="text-stone-500 text-sm mt-1 max-w-md mx-auto">
              ስም ብምድላይ ወይ ካብቲ ዝርዝር ብምምራጽ፡ ምሉእ መረዳእታ ወለዶን ዝምድናን ርኣዩ።
            </p>
          </div>

          <div className="relative max-w-md mx-auto">
            <Search className="w-5 h-5 absolute left-3.5 top-3 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ስም ጽሒፍካ ድለ (ንኣብነት: ጎብሩ፣ ተክኣ፣ ሃብቱ)..."
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-stone-300 bg-stone-50 font-ethiopic text-sm focus:bg-white focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left max-w-lg mx-auto pt-2">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelectPerson(p)}
                  className="p-3 rounded-xl border border-stone-200 hover:border-amber-400 hover:bg-amber-50/50 flex items-center justify-between text-sm transition-colors"
                >
                  <div>
                    <span className="font-bold text-stone-900 font-ethiopic">
                      {p.canonicalName}
                    </span>
                    {p.branch && (
                      <span className="block text-xs text-stone-500 font-ethiopic">
                        ጨንፈር: {p.branch}
                      </span>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-stone-400" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const isSharedName = (repeatedNameCounts.get(person.canonicalName) || 0) > 1;

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4 sm:py-6">
      {/* Header Profile Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-700 text-white flex items-center justify-center font-bold text-2xl shrink-0 shadow-sm">
              {person.canonicalName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-stone-950 font-ethiopic tracking-tight">
                  {person.canonicalName}
                </h1>
                {isSharedName && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
                    <Tag className="w-3 h-3 text-amber-700" />
                    ተደጋጋሚ ስም (92 Distinct Groups)
                  </span>
                )}
                {person.status === 'verified' && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                    ዝተረጋገጸ (Verified)
                  </span>
                )}
                {person.status === 'needs_review' && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                    ምምርማር ዘድልዮ (Needs Review)
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs sm:text-sm text-stone-600">
                <span className="font-mono bg-stone-100 px-2.5 py-1 rounded-md text-stone-700">
                  ID: #{person.id.replace('pers_', '')}
                </span>
                {person.branch && (
                  <span className="font-ethiopic bg-stone-100 px-2.5 py-1 rounded-md text-stone-800">
                    ጨንፈር: <strong>{person.branch}</strong>
                  </span>
                )}
                {person.sourcePage && (
                  <span className="bg-stone-100 px-2.5 py-1 rounded-md text-stone-800">
                    ምንጪ PDF: <strong>ገጽ {person.sourcePage}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action: Open in Family Tree */}
          <button
            onClick={() => onExploreInTree(person)}
            className="px-4 py-2.5 min-h-[44px] bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-medium text-sm shadow-sm flex items-center justify-center gap-2 transition-colors self-start sm:self-center focus:ring-2 focus:ring-amber-500"
          >
            <GitFork className="w-4 h-4 rotate-180" />
            <span>ኣብ ኦም ወለዶ ርአ</span>
          </button>
        </div>

        {/* Source Statement / Quotation */}
        {person.sourceHeading && (
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1">
            <span className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider block">
              መበቆላዊ ናይ ምንጪ ጽሑፍ (Original Source Statement):
            </span>
            <p className="font-ethiopic text-stone-900 text-sm font-medium">
              &ldquo;{person.sourceHeading}&rdquo;
            </p>
          </div>
        )}

        {person.notes && (
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs sm:text-sm text-stone-600 font-ethiopic">
            <strong>መተሓሳሰቢ:</strong> {person.notes}
          </div>
        )}
      </div>

      {/* Relational Connections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Parents */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
          <h3 className="font-bold text-stone-900 font-ethiopic text-base flex items-center gap-2">
            <User className="w-4 h-4 text-amber-700" />
            <span>ወለዲ ({parents.length})</span>
          </h3>
          {parents.length === 0 ? (
            <p className="text-xs text-stone-400 italic">ኣብ መዝገብ ዝተጠቕሰ ወላዲ የለን።</p>
          ) : (
            <div className="space-y-2">
              {parents.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelectPerson(p)}
                  className="w-full text-left p-3 rounded-xl bg-stone-50 hover:bg-amber-50 border border-stone-200 hover:border-amber-400 flex items-center justify-between text-sm transition-colors group"
                >
                  <span className="font-bold text-stone-900 font-ethiopic group-hover:text-amber-800">
                    {p.canonicalName}
                  </span>
                  <span className="text-xs text-stone-400">
                    {p.sourcePage ? `ገጽ ${p.sourcePage}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Partners / Unions */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
          <h3 className="font-bold text-stone-900 font-ethiopic text-base flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-500" />
            <span>መጻምድቲ / ሓዳር ({partners.length})</span>
          </h3>
          {partners.length === 0 ? (
            <p className="text-xs text-stone-400 italic">ኣብ መዝገብ ዝተመዝገበ መጻምድቲ የለን።</p>
          ) : (
            <div className="space-y-2">
              {partners.map(({ partner, wording }) => (
                <button
                  key={partner.id}
                  onClick={() => onSelectPerson(partner)}
                  className="w-full text-left p-3 rounded-xl bg-stone-50 hover:bg-rose-50 border border-stone-200 hover:border-rose-300 flex items-center justify-between text-sm transition-colors group"
                >
                  <div>
                    <span className="font-bold text-stone-900 font-ethiopic group-hover:text-rose-700">
                      {partner.canonicalName}
                    </span>
                    <span className="block text-[11px] text-stone-500 font-ethiopic">
                      {wording}
                    </span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-stone-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Siblings */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
          <h3 className="font-bold text-stone-900 font-ethiopic text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-stone-600" />
            <span>ኣሕዋት ({siblings.length})</span>
          </h3>
          {siblings.length === 0 ? (
            <p className="text-xs text-stone-400 italic">ኣብ መዝገብ ዝተመዝገቡ ኣሕዋት የለዉን።</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {siblings.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelectPerson(s)}
                  className="p-2.5 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-left text-xs font-ethiopic font-bold text-stone-800 truncate"
                >
                  {s.canonicalName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Children */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
          <h3 className="font-bold text-stone-900 font-ethiopic text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-700" />
            <span>ውሉዳት ({children.length})</span>
          </h3>
          {children.length === 0 ? (
            <p className="text-xs text-stone-400 italic">ኣብ መዝገብ ዝተመዝገቡ ውሉዳት የለዉን።</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {children.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onSelectPerson(c)}
                  className="p-2.5 rounded-xl bg-stone-50 hover:bg-amber-50 border border-stone-200 hover:border-amber-400 text-left text-xs font-ethiopic font-bold text-stone-800 truncate"
                >
                  {c.canonicalName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

