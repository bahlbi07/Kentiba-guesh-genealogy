import React, { useState, useMemo } from 'react';
import { Person, Relationship } from '../types/genealogy';
import { Search, ChevronDown, ChevronRight, User, ExternalLink, AlertTriangle, CheckCircle } from 'lucide-react';

interface TreeListAlternativeProps {
  people: Person[];
  relationships: Relationship[];
  onSelectPerson: (person: Person) => void;
  rootId?: string;
}

export const TreeListAlternative: React.FC<TreeListAlternativeProps> = ({
  people,
  relationships,
  onSelectPerson,
  rootId,
}) => {
  const [search, setSearch] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([rootId || '']));

  const peopleMap = useMemo(() => {
    const map = new Map<string, Person>();
    for (const p of people) map.set(p.id, p);
    return map;
  }, [people]);

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

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedNodes(new Set(people.map((p) => p.id)));
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const renderPersonNode = (personId: string, depth = 0) => {
    const person = peopleMap.get(personId);
    if (!person) return null;

    const children = parentToChildrenMap.get(personId) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(personId);

    const matchesSearch =
      search.trim().length > 0 &&
      (person.canonicalName.toLowerCase().includes(search.toLowerCase()) ||
        (person.displayName && person.displayName.toLowerCase().includes(search.toLowerCase())) ||
        person.id.toLowerCase().includes(search.toLowerCase()));

    return (
      <li key={person.id} className="my-1.5 list-none">
        <div
          className={`flex items-center justify-between p-2 rounded-lg border text-sm transition-colors ${
            matchesSearch
              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300'
              : 'bg-stone-50 hover:bg-stone-100/80 border-stone-200'
          }`}
          style={{ marginLeft: `${depth * 24}px` }}
        >
          <div className="flex items-center space-x-2">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(person.id)}
                className="p-1 rounded text-stone-600 hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                aria-label={isExpanded ? `Collapse ${person.canonicalName}` : `Expand ${person.canonicalName}`}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <div className="w-6 flex items-center justify-center text-stone-400">
                <User className="w-3.5 h-3.5" />
              </div>
            )}

            <div>
              <span className="font-bold text-stone-900 font-ethiopic text-base mr-2">
                {person.canonicalName}
              </span>
              {person.displayName && (
                <span className="text-xs text-stone-500 mr-2 font-sans">
                  ({person.displayName})
                </span>
              )}
              <span className="text-xs font-mono text-stone-400">
                #{person.id.replace('pers_', '')}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {person.sourcePage && (
              <span className="px-2 py-0.5 rounded bg-stone-200 text-stone-700 text-xs">
                Page {person.sourcePage}
              </span>
            )}

            {person.status === 'verified' && (
              <span className="inline-flex items-center text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <CheckCircle className="w-3 h-3 mr-1" />
                Verified
              </span>
            )}
            {person.status === 'needs_review' && (
              <span className="inline-flex items-center text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Needs Review
              </span>
            )}

            <button
              onClick={() => onSelectPerson(person)}
              className="p-1 text-stone-500 hover:text-amber-700 rounded hover:bg-stone-200"
              title="Open Details & Review"
              aria-label={`Open details for ${person.canonicalName}`}
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <ul className="pl-2 border-l border-stone-200 ml-4 space-y-1">
            {children.map((childId) => renderPersonNode(childId, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  const startRoot = rootId || people[0]?.id;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-50 p-3 rounded-lg border border-stone-200">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
          <input
            type="text"
            placeholder="Search within accessible list..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-md border border-stone-300 bg-white focus:ring-2 focus:ring-amber-500 font-ethiopic"
            aria-label="Filter tree list by name"
          />
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={expandAll}
            className="px-2.5 py-1 text-xs bg-white border border-stone-300 rounded hover:bg-stone-100 text-stone-700 font-medium"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-2.5 py-1 text-xs bg-white border border-stone-300 rounded hover:bg-stone-100 text-stone-700 font-medium"
          >
            Collapse All
          </button>
        </div>
      </div>

      <nav aria-label="Hierarchical Family Tree">
        <ul className="space-y-1" role="tree">
          {startRoot && renderPersonNode(startRoot, 0)}
        </ul>
      </nav>
    </div>
  );
};
