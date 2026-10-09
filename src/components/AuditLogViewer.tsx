import React, { useState } from 'react';
import { AuditEvent } from '../types/genealogy';
import { History, Search, Filter } from 'lucide-react';

interface AuditLogViewerProps {
  auditEvents: AuditEvent[];
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ auditEvents }) => {
  const [filter, setFilter] = useState('');

  const filtered = auditEvents.filter((ev) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      ev.action.toLowerCase().includes(q) ||
      ev.entityType.toLowerCase().includes(q) ||
      ev.entityId.toLowerCase().includes(q) ||
      ev.details.toLowerCase().includes(q) ||
      ev.reviewer.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Title */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-2">
        <h2 className="text-xl font-bold text-stone-900 flex items-center space-x-2">
          <History className="w-5 h-5 text-amber-600" />
          <span>Audit Log & Provenance History</span>
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 max-w-2xl">
          Complete, tamper-evident record of all changes, verifications, deletions, imports, and backups.
        </p>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
          <input
            type="text"
            placeholder="Search audit trail..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-stone-50"
          />
        </div>
        <span className="text-xs text-stone-500 font-mono">
          {filtered.length} event(s) logged
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-400">
            No audit records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-xs text-left">
              <thead className="bg-stone-50 font-semibold text-stone-700">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity Type</th>
                  <th className="px-4 py-3">Record ID</th>
                  <th className="px-4 py-3">Reviewer</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-800">
                {filtered.map((ev) => (
                  <tr key={ev.id} className="hover:bg-stone-50">
                    <td className="px-4 py-2.5 font-mono text-stone-500 whitespace-nowrap">
                      {new Date(ev.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          ev.action === 'delete'
                            ? 'bg-rose-100 text-rose-800'
                            : ev.action === 'verify'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ev.action === 'create'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-stone-100 text-stone-800'
                        }`}
                      >
                        {ev.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-stone-600">{ev.entityType}</td>
                    <td className="px-4 py-2.5 font-mono text-stone-400 max-w-[120px] truncate" title={ev.entityId}>
                      {ev.entityId}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-stone-700">{ev.reviewer}</td>
                    <td className="px-4 py-2.5 text-stone-600 font-sans">{ev.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
