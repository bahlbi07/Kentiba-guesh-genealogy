import React from 'react';
import { Person, Relationship } from '../types/genealogy';
import { AlertTriangle, CheckCircle, ExternalLink, HelpCircle } from 'lucide-react';

interface UncertainRecordsViewProps {
  people: Person[];
  relationships: Relationship[];
  onSelectPerson: (person: Person) => void;
  onUpdatePerson: (person: Person) => Promise<void>;
  onUpdateRelationship: (rel: Relationship) => Promise<{ success: boolean }>;
}

export const UncertainRecordsView: React.FC<UncertainRecordsViewProps> = ({
  people,
  relationships,
  onSelectPerson,
  onUpdatePerson,
  onUpdateRelationship,
}) => {
  const uncertainPeople = people.filter((p) => p.status === 'needs_review');
  const uncertainRelationships = relationships.filter((r) => r.status === 'needs_review');

  const handleVerifyPerson = async (p: Person) => {
    await onUpdatePerson({
      ...p,
      status: 'verified',
      updatedAt: new Date().toISOString(),
    });
  };

  const handleVerifyRel = async (r: Relationship) => {
    await onUpdateRelationship({
      ...r,
      status: 'verified',
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-2 font-ethiopic">
        <div className="flex items-center space-x-2 text-amber-700 font-semibold text-xs uppercase tracking-wider">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>ምሕደራ መዛግብቲ</span>
        </div>
        <h2 className="text-xl font-bold text-stone-900">
          ምምርማር ዘድልዮም መዛግብቲ
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 max-w-3xl">
          እዚ ክፍሊ ብኣካያዲ መዝገብ ተወሳኺ መረጋገጺ ዝደልዩ ውሑዳት መዛግብቲ ንምርኣይን ንምጽዳቕን ዝጠቅም ናይ ምሕደራ ሰሌዳ እዩ።
        </p>
      </div>

      {/* Uncertain People Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden font-ethiopic">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-bold text-stone-900 text-sm">
            ምምርማር ዘድልዮም ኣባላት ({uncertainPeople.length})
          </h3>
        </div>

        {uncertainPeople.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-500">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="font-medium text-stone-700 font-ethiopic">ኩሎም ኣባላት ዝተረጋገጹ እዮም!</p>
          </div>
        ) : (
          <div className="overflow-x-auto font-ethiopic">
            <table className="min-w-full divide-y divide-stone-200 text-xs text-left">
              <thead className="bg-stone-50 font-semibold text-stone-700">
                <tr>
                  <th className="px-4 py-3">ምሉእ ስም</th>
                  <th className="px-4 py-3">ጨንፈር / ሓረግ</th>
                  <th className="px-4 py-3">መተሓሳሰቢ</th>
                  <th className="px-4 py-3 text-right">ስጉምቲ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-800">
                {uncertainPeople.map((p) => (
                  <tr key={p.id} className="hover:bg-amber-50/30">
                    <td className="px-4 py-3 font-bold font-ethiopic text-sm text-stone-900">
                      {p.canonicalName}
                    </td>
                    <td className="px-4 py-3 text-stone-600 font-medium">
                      {p.branch || 'ከንቲባ ጉዕሽ'}
                    </td>
                    <td className="px-4 py-3 text-stone-500 max-w-sm">
                      {p.notes || 'ምምርማር ዘድልዮ'}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleVerifyPerson(p)}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-medium transition-colors"
                      >
                        ኣረጋግጽ
                      </button>
                      <button
                        onClick={() => onSelectPerson(p)}
                        className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-medium"
                        title="መረዳእታ ርአ"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Uncertain Relationships Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden font-ethiopic">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-bold text-stone-900 text-sm">
            ምምርማር ዘድልዮም ዝምድናታት ({uncertainRelationships.length})
          </h3>
        </div>

        {uncertainRelationships.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-500">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="font-medium text-stone-700">ኩሎም ዝምድናታት ዝተረጋገጹ እዮም!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-xs text-left">
              <thead className="bg-stone-50 font-semibold text-stone-700">
                <tr>
                  <th className="px-4 py-3">ዓይነት ዝምድና</th>
                  <th className="px-4 py-3">መግለጺ ዝምድና</th>
                  <th className="px-4 py-3">መተሓሳሰቢ</th>
                  <th className="px-4 py-3 text-right">ስጉምቲ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-800">
                {uncertainRelationships.map((r) => (
                  <tr key={r.id} className="hover:bg-amber-50/30">
                    <td className="px-4 py-3 font-semibold text-amber-800">
                      {r.type === 'parent_child' ? 'ወላድን ውሉድን' : r.type === 'partner_or_union' ? 'መጻምድቲ / ሓዳር' : 'ካልእ'}
                    </td>
                    <td className="px-4 py-3 font-ethiopic text-stone-900 max-w-sm truncate">
                      {r.sourceWording}
                    </td>
                    <td className="px-4 py-3 text-stone-500 max-w-xs">
                      {r.reviewerNotes || 'ምምርማር ይጽበ ኣሎ'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleVerifyRel(r)}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-medium transition-colors"
                      >
                        ኣረጋግጽ
                      </button>
                    </td>
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

