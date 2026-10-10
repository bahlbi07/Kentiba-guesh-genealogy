import React, { useState, useMemo } from 'react';
import { Person, Relationship } from '../types/genealogy';
import {
  Search,
  UserPlus,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  X
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
  // Extract unique branches
  const uniqueBranches = useMemo(() => {
    const set = new Set<string>();
    for (const p of people) {
      if (p.branch) set.add(p.branch);
    }
    return Array.from(set).sort();
  }, [people]);

  // Filtered people list
  const filteredPeople = useMemo(() => {
    return people.filter((p) => {
      // Search term matching canonicalName, fatherName, displayName, or id
      if (searchTerm.trim().length > 0) {
        const query = searchTerm.toLowerCase().trim();
        const matchesCanonical = p.canonicalName.toLowerCase().includes(query);
        const matchesFather = p.fatherName?.toLowerCase().includes(query) || false;
        const matchesDisplay = p.displayName?.toLowerCase().includes(query) || false;
        const matchesId = p.id.toLowerCase().includes(query);
        if (!matchesCanonical && !matchesFather && !matchesDisplay && !matchesId) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && p.status !== statusFilter) {
        return false;
      }

      // Branch filter
      if (branchFilter !== 'all' && p.branch !== branchFilter) {
        return false;
      }

      return true;
    });
  }, [people, searchTerm, statusFilter, branchFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-ethiopic flex items-center space-x-2">
            <span>መዝገብ ኣባላት ስድራን ምድላይን</span>
            <span className="text-sm font-normal text-stone-500 font-sans">
              ({filteredPeople.length} ካብ {people.length} ተመዝጊቦም)
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 font-ethiopic mt-1">
            ነፍሲ ወከፍ ኣባል ስድራ ርእሱ ዝኸኣለ መፍለዪ ቁጽሪ ኣለዎ። ተመሳሳሊ ስም ዘለዎም ኣባላት ብፍጹም ኣይሕወሱን።
          </p>
        </div>

        <button
          onClick={onAddNewPerson}
          className="inline-flex items-center space-x-2 px-5 py-2.5 min-h-[44px] bg-amber-600 hover:bg-amber-700 text-white text-sm font-ethiopic font-bold rounded-xl shadow-sm transition-colors self-start sm:self-center"
        >
          <UserPlus className="w-4 h-4" />
          <span>ሓድሽ ኣባል ወስኽ</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-stone-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search by name (Tigrinya/English) or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-10 py-3 text-base rounded-xl border border-stone-300 bg-stone-50/70 focus:bg-white focus:ring-2 focus:ring-amber-500 font-ethiopic text-stone-900"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3.5 text-stone-400 hover:text-stone-700 p-1"
                title="ኣጽሪ"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-3 px-3 text-sm font-ethiopic font-medium rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">ኩሉ ኩነታት</option>
              <option value="verified">ዝተረጋገጸ ጥራይ</option>
              <option value="needs_review">ምምርማር ዘድልዮ</option>
              <option value="unverified">ዘይተረጋገጸ</option>
            </select>
          </div>

          {/* Branch Filter */}
          <div className="w-full md:w-48">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full py-3 px-3 text-sm rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-amber-500 font-ethiopic font-medium"
            >
              <option value="all">ኩሎም ጨናፍር</option>
              {uniqueBranches.map((b) => (
                <option key={b} value={b}>
                  ጨንፈር {b}
                </option>
              ))}
            </select>
          </div>
        </div>

          {(searchTerm || statusFilter !== 'all' || branchFilter !== 'all') && (
            <div className="pt-2 border-t border-stone-100 flex justify-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setBranchFilter('all');
                }}
                className="text-xs font-ethiopic text-amber-700 hover:underline font-bold"
              >
                መጻረዪታት ጸርግ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Directory Grid */}
      {filteredPeople.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border border-stone-200">
          <HelpCircle className="w-10 h-10 text-stone-400 mx-auto mb-2" />
          <p className="text-stone-700 font-medium font-ethiopic text-lg">ዝተረኽበ ኣባል የለን።</p>
          <p className="text-xs text-stone-500 font-ethiopic mt-1">በጃኹም ዝተጻሕፈ ስም ኣስተኻኽሉ ወይ መጻረዪታት ጸርጉ።</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPeople.map((person) => {
            return (
              <div
                key={person.id}
                onClick={() => onSelectPerson(person)}
                className="bg-white p-5 rounded-2xl border border-stone-200 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  {/* Top badges */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <div className="flex items-center space-x-1.5 font-ethiopic">
                      {person.status === 'verified' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          ዝተረጋገጸ
                        </span>
                      )}
                      {person.status === 'needs_review' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-300">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          ምምርማር ዘድልዮ
                        </span>
                      )}
                      {person.status === 'unverified' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                          ዘይተረጋገጸ
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Names */}
                  <h3 className="text-xl font-bold text-stone-900 font-ethiopic group-hover:text-amber-800 transition-colors">
                    {person.canonicalName}
                  </h3>

                  {/* Father / Mother information */}
                  <div className="mt-1 text-sm text-stone-600 font-ethiopic space-y-0.5">
                    {person.fatherName && (
                      <p>
                        <span className="text-stone-400 font-normal">ኣቦ: </span>
                        <span className="font-semibold text-stone-800">{person.fatherName}</span>
                      </p>
                    )}
                    {person.spouseNote && (
                      <p className="text-xs text-amber-900 truncate">
                        {person.spouseNote}
                      </p>
                    )}
                    {person.branch && (
                      <p className="text-xs text-stone-500 truncate">
                        <span>ጨንፈር: </span>
                        <strong>{person.branch}</strong>
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400 font-ethiopic">
                  <span className="text-stone-400 text-xs">
                    {person.branch ? `ሓረግ ${person.branch}` : ''}
                  </span>
                  <span className="text-amber-700 group-hover:translate-x-0.5 transition-transform flex items-center space-x-1 font-bold">
                    <span>መረዳእታ</span>
                    <ArrowRight className="w-4 h-4" />
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
