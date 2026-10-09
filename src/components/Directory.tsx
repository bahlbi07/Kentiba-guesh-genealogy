import React, { useState, useMemo } from 'react';
import { Person, Relationship } from '../types/genealogy';
import {
  Search,
  Filter,
  UserPlus,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Copy,
  BookOpen,
  ArrowRight
} from 'lucide-react';

interface DirectoryProps {
  people: Person[];
  relationships: Relationship[];
  onSelectPerson: (person: Person) => void;
  onAddNewPerson: () => void;
}

export const Directory: React.FC<DirectoryProps> = ({
  people,
  relationships,
  onSelectPerson,
  onAddNewPerson,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [selectedPageFilter, setSelectedPageFilter] = useState<string>('all');

  // Detect duplicate names count
  const duplicateNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of people) {
      counts.set(p.canonicalName, (counts.get(p.canonicalName) || 0) + 1);
    }
    return counts;
  }, [people]);

  // Extract unique branches
  const uniqueBranches = useMemo(() => {
    const set = new Set<string>();
    for (const p of people) {
      if (p.branch) set.add(p.branch);
    }
    return Array.from(set).sort();
  }, [people]);

  // Extract unique source pages
  const uniquePages = useMemo(() => {
    const set = new Set<number>();
    for (const p of people) {
      if (p.sourcePage) set.add(p.sourcePage);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [people]);

  // Filtered people list
  const filteredPeople = useMemo(() => {
    return people.filter((p) => {
      // Search term
      if (searchTerm.trim().length > 0) {
        const query = searchTerm.toLowerCase();
        const matchesCanonical = p.canonicalName.toLowerCase().includes(query);
        const matchesDisplay = p.displayName?.toLowerCase().includes(query) || false;
        const matchesId = p.id.toLowerCase().includes(query);
        if (!matchesCanonical && !matchesDisplay && !matchesId) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && p.status !== statusFilter) {
        return false;
      }

      // Branch filter
      if (branchFilter !== 'all' && p.branch !== branchFilter) {
        return false;
      }

      // Page filter
      if (selectedPageFilter !== 'all' && String(p.sourcePage) !== selectedPageFilter) {
        return false;
      }

      // Duplicate names filter
      if (onlyDuplicates) {
        const count = duplicateNameCounts.get(p.canonicalName) || 0;
        if (count <= 1) return false;
      }

      return true;
    });
  }, [people, searchTerm, statusFilter, branchFilter, selectedPageFilter, onlyDuplicates, duplicateNameCounts]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center space-x-2">
            <span>People Directory & Search</span>
            <span className="text-sm font-normal text-stone-500 font-sans">
              ({filteredPeople.length} of {people.length} listed)
            </span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Every recorded person occurrence has a distinct stable ID. People sharing the same name are never merged without human confirmation.
          </p>
        </div>

        <button
          onClick={onAddNewPerson}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Person</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
            <input
              type="text"
              placeholder="Search by name (Tigrinya/English) or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-stone-300 bg-stone-50/50 focus:bg-white focus:ring-2 focus:ring-amber-500 font-ethiopic"
            />
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-44">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-lg border border-stone-300 bg-white focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">All Statuses</option>
              <option value="verified">Verified Only</option>
              <option value="needs_review">Needs Review Only</option>
              <option value="unverified">Unverified Only</option>
            </select>
          </div>

          {/* Branch Filter */}
          <div className="w-full md:w-44">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-lg border border-stone-300 bg-white focus:ring-2 focus:ring-amber-500 font-ethiopic"
            >
              <option value="all">All Branches</option>
              {uniqueBranches.map((b) => (
                <option key={b} value={b}>
                  Branch: {b}
                </option>
              ))}
            </select>
          </div>

          {/* Page Filter */}
          <div className="w-full md:w-36">
            <select
              value={selectedPageFilter}
              onChange={(e) => setSelectedPageFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-lg border border-stone-300 bg-white focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">All PDF Pages</option>
              {uniquePages.map((page) => (
                <option key={page} value={String(page)}>
                  Page {page}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Toggle Duplicates */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs">
          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyDuplicates}
              onChange={(e) => setOnlyDuplicates(e.target.checked)}
              className="rounded border-stone-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
            />
            <span className="text-stone-700 font-medium">
              Filter: Show only people with repeated/shared names (distinct records requiring human disambiguation)
            </span>
          </label>

          {(searchTerm || statusFilter !== 'all' || branchFilter !== 'all' || selectedPageFilter !== 'all' || onlyDuplicates) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setBranchFilter('all');
                setSelectedPageFilter('all');
                setOnlyDuplicates(false);
              }}
              className="text-amber-700 hover:underline font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Directory Grid */}
      {filteredPeople.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
          <HelpCircle className="w-10 h-10 text-stone-400 mx-auto mb-2" />
          <p className="text-stone-600 font-medium">No person records match your criteria.</p>
          <p className="text-xs text-stone-400 mt-1">Try clearing search terms or resetting filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPeople.map((person) => {
            const count = duplicateNameCounts.get(person.canonicalName) || 1;
            const isDup = count > 1;

            return (
              <div
                key={person.id}
                onClick={() => onSelectPerson(person)}
                className="bg-white p-4 rounded-xl border border-stone-200 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  {/* Top badges */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <div className="flex items-center space-x-1">
                      {person.status === 'verified' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </span>
                      )}
                      {person.status === 'needs_review' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Needs Review
                        </span>
                      )}
                      {person.status === 'unverified' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                          Unverified
                        </span>
                      )}

                      {isDup && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200"
                          title={`Name appears ${count} times in the source. This is occurrence with ID ${person.id}.`}
                        >
                          Shared Name ({count})
                        </span>
                      )}
                    </div>

                    {person.sourcePage && (
                      <span className="text-[11px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                        p. {person.sourcePage}
                      </span>
                    )}
                  </div>

                  {/* Names */}
                  <h3 className="text-lg font-bold text-stone-900 font-ethiopic group-hover:text-amber-800 transition-colors">
                    {person.canonicalName}
                  </h3>

                  {person.displayName && (
                    <p className="text-xs text-stone-500 mt-0.5 font-sans">
                      {person.displayName}
                    </p>
                  )}

                  {/* Branch and Source context */}
                  <div className="mt-2 text-xs text-stone-600 space-y-1">
                    {person.branch && (
                      <p className="truncate">
                        <span className="font-semibold text-stone-500">Branch: </span>
                        <span className="font-ethiopic">{person.branch}</span>
                      </p>
                    )}
                    {person.sourceHeading && (
                      <p className="truncate text-stone-500" title={person.sourceHeading}>
                        <span className="font-semibold">Heading: </span>
                        {person.sourceHeading}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="mt-4 pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400">
                  <span className="font-mono text-[11px]" title={person.id}>
                    #{person.id.replace('pers_', '')}
                  </span>
                  <span className="text-amber-600 group-hover:translate-x-0.5 transition-transform flex items-center space-x-1 font-medium">
                    <span>Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

