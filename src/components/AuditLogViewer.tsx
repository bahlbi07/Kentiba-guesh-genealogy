import React, { useState } from 'react';
import { AuditEvent } from '../types/genealogy';
import { History, Search } from 'lucide-react';

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

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'delete':
        return 'ምድምሳስ';
      case 'verify':
        return 'ምርግጋጽ';
      case 'create':
        return 'ምፍጣር';
      case 'update':
        return 'ምዕራይ';
      case 'import':
        return 'ምእታው';
      default:
        return action;
    }
  };

  const getEntityTypeLabel = (type: string) => {
    switch (type) {
      case 'person':
        return 'ሰብ';
      case 'relationship':
        return 'ዝምድና';
      case 'source':
        return 'ሰነድ';
      case 'system':
        return 'ሲስተም';
      default:
        return type;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-6 font-ethiopic">
      {/* Title */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-2">
        <h2 className="text-xl font-bold text-stone-900 flex items-center space-x-2">
          <History className="w-5 h-5 text-amber-600" />
          <span>ናይ ስራሕቲ መዝገብ (ኦዲት)</span>
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 max-w-2xl">
          ኩሎም ኣብዚ ሲስተም ዝተገብሩ ለውጥታትን ምምሕያሻትን ዝምዝገቡሉ ሰሌዳ።
        </p>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
          <input
            type="text"
            placeholder="ኣብ መዝገብ ድለ..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <span className="text-xs text-stone-600">
          {filtered.length} ዝተመዝገቡ ተግባራት
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-xs text-stone-400">
            ዝተመዝገበ ስራሕ የለን።
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-xs text-left">
              <thead className="bg-stone-50 font-semibold text-stone-700">
                <tr>
                  <th className="px-4 py-3">ዕለት / ሰዓት</th>
                  <th className="px-4 py-3">ዝተወሰደ ስጉምቲ</th>
                  <th className="px-4 py-3">ዓይነት መዝገብ</th>
                  <th className="px-4 py-3">ተጠቃሚ</th>
                  <th className="px-4 py-3">ዝርዝር ሓበሬታ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-800">
                {filtered.map((ev) => (
                  <tr key={ev.id} className="hover:bg-stone-50">
                    <td className="px-4 py-2.5 text-stone-500 whitespace-nowrap">
                      {new Date(ev.timestamp).toLocaleDateString()} {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ev.action === 'delete'
                            ? 'bg-rose-100 text-rose-800'
                            : ev.action === 'verify'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ev.action === 'create'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-stone-100 text-stone-800'
                        }`}
                      >
                        {getActionLabel(ev.action)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-stone-600">{getEntityTypeLabel(ev.entityType)}</td>
                    <td className="px-4 py-2.5 font-medium text-stone-700">{ev.reviewer}</td>
                    <td className="px-4 py-2.5 text-stone-600">{ev.details}</td>
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
