import React, { useState } from 'react';
import { Person, Relationship, SourceOccurrence, AuditEvent, Source } from '../types/genealogy';
import {
  createJSONBackup,
  exportPeopleToCSV,
  exportRelationshipsToCSV,
  exportToMarkdownReport,
  restoreFromJSON,
  triggerDownload
} from '../services/exportService';
import {
  Download,
  Upload,
  FileText,
  FileSpreadsheet,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  FileJson
} from 'lucide-react';

interface ExportModalProps {
  people: Person[];
  relationships: Relationship[];
  sources: Source[];
  occurrences: SourceOccurrence[];
  auditEvents: AuditEvent[];
  datasetMode: 'real' | 'demo' | 'empty';
  onRestored: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  people,
  relationships,
  sources,
  occurrences,
  auditEvents,
  datasetMode,
  onRestored,
}) => {
  const [restoreText, setRestoreText] = useState('');
  const [restoreStatus, setRestoreStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleDownloadJSON = () => {
    const backup = createJSONBackup(
      people,
      relationships,
      sources,
      occurrences,
      auditEvents,
      datasetMode === 'demo' ? 'demo' : 'real'
    );
    const jsonStr = JSON.stringify(backup, null, 2);
    const filename = `kinteba_guush_genealogy_backup_${new Date().toISOString().slice(0, 10)}.json`;
    triggerDownload(jsonStr, filename, 'application/json');
  };

  const handleDownloadPeopleCSV = () => {
    const csv = exportPeopleToCSV(people);
    const filename = `kinteba_guush_people_${new Date().toISOString().slice(0, 10)}.csv`;
    triggerDownload(csv, filename, 'text/csv');
  };

  const handleDownloadRelationshipsCSV = () => {
    const peopleMap = new Map<string, Person>();
    for (const p of people) peopleMap.set(p.id, p);
    const csv = exportRelationshipsToCSV(relationships, peopleMap);
    const filename = `kinteba_guush_relationships_${new Date().toISOString().slice(0, 10)}.csv`;
    triggerDownload(csv, filename, 'text/csv');
  };

  const handleDownloadMarkdown = () => {
    const md = exportToMarkdownReport(people, relationships, datasetMode);
    const filename = `kinteba_guush_family_report_${new Date().toISOString().slice(0, 10)}.md`;
    triggerDownload(md, filename, 'text/markdown');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRestoreText(content);
    };
    reader.readAsText(file);
  };

  const handleRestoreSubmit = async () => {
    if (!restoreText.trim()) return;

    setIsRestoring(true);
    setRestoreStatus(null);

    const result = await restoreFromJSON(restoreText, 'User Restore');
    setRestoreStatus(result);
    setIsRestoring(false);

    if (result.success) {
      setTimeout(() => {
        onRestored();
      }, 1000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Title */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-2">
        <h2 className="text-xl font-bold text-stone-900 flex items-center space-x-2">
          <Download className="w-5 h-5 text-amber-600" />
          <span>Backup, Export & Disaster Recovery</span>
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 max-w-2xl">
          Export your family archive in open, portable formats (JSON, CSV, Markdown) to ensure your records are never locked in or lost.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Column */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
          <h3 className="font-bold text-stone-900 text-sm flex items-center space-x-1.5">
            <Download className="w-4 h-4 text-amber-600" />
            <span>Export Archive</span>
          </h3>

          <div className="space-y-3">
            {/* JSON Backup */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-xs text-stone-900 flex items-center space-x-1">
                  <FileJson className="w-3.5 h-3.5 text-amber-600" />
                  <span>Complete JSON Snapshot</span>
                </span>
                <span className="text-[11px] text-stone-500 block">
                  Includes all people, relationships, source evidence, occurrences, and audit history.
                </span>
              </div>
              <button
                onClick={handleDownloadJSON}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium transition-colors shrink-0 ml-2"
              >
                Download JSON
              </button>
            </div>

            {/* People CSV */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-xs text-stone-900 flex items-center space-x-1">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>People Directory (CSV)</span>
                </span>
                <span className="text-[11px] text-stone-500 block">
                  Spreadsheet of all individual person records with IDs and source pages.
                </span>
              </div>
              <button
                onClick={handleDownloadPeopleCSV}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors shrink-0 ml-2"
              >
                Download CSV
              </button>
            </div>

            {/* Relationships CSV */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-xs text-stone-900 flex items-center space-x-1">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                  <span>Relationships with Evidence (CSV)</span>
                </span>
                <span className="text-[11px] text-stone-500 block">
                  Parent-child, union links, exact source phrases, and verification flags.
                </span>
              </div>
              <button
                onClick={handleDownloadRelationshipsCSV}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors shrink-0 ml-2"
              >
                Download CSV
              </button>
            </div>

            {/* Markdown Report */}
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-xs text-stone-900 flex items-center space-x-1">
                  <FileText className="w-3.5 h-3.5 text-stone-600" />
                  <span>Human-Readable Report (MD)</span>
                </span>
                <span className="text-[11px] text-stone-500 block">
                  Executive summary with branch counts, unconfirmed records, and statistics.
                </span>
              </div>
              <button
                onClick={handleDownloadMarkdown}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-medium transition-colors shrink-0 ml-2"
              >
                Download MD
              </button>
            </div>
          </div>
        </div>

        {/* Restore Column */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
          <h3 className="font-bold text-stone-900 text-sm flex items-center space-x-1.5">
            <Upload className="w-4 h-4 text-amber-600" />
            <span>Restore from JSON Backup</span>
          </h3>

          <p className="text-xs text-stone-500">
            Select a previously exported <code>.json</code> backup file to restore records into local IndexedDB.
          </p>

          <div className="space-y-3">
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="block w-full text-xs text-stone-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-800 hover:file:bg-amber-100"
            />

            {restoreText && (
              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs space-y-1">
                <span className="font-semibold text-stone-700">Backup payload ready:</span>
                <p className="text-[11px] text-stone-500 font-mono truncate">
                  {restoreText.slice(0, 120)}...
                </p>
              </div>
            )}

            {restoreStatus && (
              <div
                className={`p-3 rounded-lg text-xs border ${
                  restoreStatus.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-rose-50 border-rose-300 text-rose-800'
                }`}
              >
                {restoreStatus.success ? (
                  <div className="flex items-center space-x-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>{restoreStatus.message}</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>{restoreStatus.message}</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleRestoreSubmit}
              disabled={!restoreText.trim() || isRestoring}
              className={`w-full py-2 rounded-lg text-xs font-bold text-white transition-colors ${
                restoreText.trim() && !isRestoring
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-stone-300 cursor-not-allowed text-stone-500'
              }`}
            >
              {isRestoring ? 'Restoring Records...' : 'Restore Backup to Database'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
