import React, { useState, useEffect } from 'react';
import { parseRegisterMarkdown, ParseResult } from '../services/importParser';
import { bulkLoadData } from '../services/db';
import { Source } from '../types/genealogy';
import {
  CheckCircle2,
  Users,
  GitFork,
  ShieldCheck,
  RefreshCw,
  Database
} from 'lucide-react';

// Import raw markdown from source directory using Vite's ?raw import
// @ts-ignore
import rawRegisterMarkdown from '../../source/family_genealogy_register.md?raw';

interface ImportModalProps {
  onImportCommitted: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ onImportCommitted }) => {
  const [markdownContent] = useState<string>(rawRegisterMarkdown || '');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState(false);
  const [userConfirmedCheckbox, setUserConfirmedCheckbox] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parse markdown content on load
  useEffect(() => {
    if (markdownContent) {
      try {
        const result = parseRegisterMarkdown(markdownContent);
        setParseResult(result);
      } catch (err: any) {
        console.error('Failed to parse register:', err);
        setErrorMessage('መዝገብ ኣብ ምትንታን ጸገም ኣጋጢሙ።');
      }
    }
  }, [markdownContent]);

  // Commit import to database
  const handleCommitImport = async () => {
    if (!parseResult || !userConfirmedCheckbox || isCommitting) return;

    setIsCommitting(true);
    setErrorMessage(null);
    try {
      const sourceRecord: Source = {
        id: 'source_kesete_birhane_pdf',
        filename: 'ከሰተ-ብርሃነ.pdf',
        sourceType: 'pdf',
        pageCount: 36,
        importDate: new Date().toISOString(),
        notes: 'Genealogy register records',
      };

      await bulkLoadData(
        {
          people: parseResult.stagedPeople,
          relationships: parseResult.stagedRelationships,
          occurrences: parseResult.occurrences,
          sources: [sourceRecord],
          mode: 'real',
        },
        'Lead Architect'
      );

      setCommitSuccess(true);
      onImportCommitted();
    } catch (err: any) {
      setErrorMessage(`ምእታው ኣይተዓወተን፡ ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  if (!parseResult) {
    return (
      <div className="max-w-3xl mx-auto p-12 bg-white rounded-2xl shadow-xs border border-stone-200 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-700" />
        <p className="text-stone-600 font-ethiopic text-sm">መዝገብ ስድራቤት ይዳሎ ኣሎ...</p>
      </div>
    );
  }

  const peopleCount = parseResult.stagedPeople.length;
  const relationshipsCount = parseResult.stagedRelationships.length;

  return (
    <div className="max-w-3xl mx-auto py-4 space-y-6">
      {/* Title Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-xs space-y-2">
        <div className="flex items-center space-x-2 text-amber-800 font-semibold text-xs font-ethiopic">
          <Database className="w-4 h-4 text-amber-700" />
          <span>መዝገብ ስድራቤት ምእታው</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-ethiopic">
          መዝገብ ወለዶ ከንቲባ ጉዑሽ ናብ ሲስተም ምእታው
        </h2>
        <p className="text-stone-600 text-xs sm:text-sm font-ethiopic leading-relaxed">
          እዚ ክፍሊ ንመላእ መዝገብ ስድራቤት ናብቲ ሲስተም ንምእታውን ንምዕቃብን ዘገልግል እዩ። ኩሎም ኣስማትን ዝምድናታትን ብጥንቃቐ ይመዝገቡ።
        </p>
      </div>

      {/* Success Notification */}
      {commitSuccess && (
        <div className="p-5 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold font-ethiopic text-sm sm:text-base text-emerald-900">
                መዝገብ ስድራቤት ብዓወት ኣትዩ ኣሎ!
              </p>
              <p className="text-xs font-ethiopic text-emerald-800 mt-0.5">
                {peopleCount} ኣባላት ስድራቤትን {relationshipsCount} ዝምድናታትን ብትኽክል ተመዝጊቦም ኣለዉ።
              </p>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold font-ethiopic hover:bg-emerald-800 transition-colors shadow-xs"
          >
            ሓድሽ መረዳእታ ኣርኢ
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-rose-900 text-xs font-ethiopic">
          {errorMessage}
        </div>
      )}

      {/* Key Numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-800 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-stone-500 font-medium font-ethiopic block">ብዝሒ ኣባላት ስድራቤት</span>
            <span className="text-2xl font-bold text-stone-900 font-ethiopic">{peopleCount}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-800 rounded-xl">
            <GitFork className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-stone-500 font-medium font-ethiopic block">ብዝሒ ዝምድናታት</span>
            <span className="text-2xl font-bold text-stone-900 font-ethiopic">{relationshipsCount}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-stone-500 font-medium font-ethiopic block">ኩነታት ዳታ</span>
            <span className="text-sm font-bold text-emerald-700 font-ethiopic block mt-1">ንዕቤት ዝተዳለወ</span>
          </div>
        </div>
      </div>

      {/* Simple Confirmation Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-xs space-y-5">
        <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-1.5 text-xs text-stone-700 font-ethiopic">
          <p className="font-semibold text-stone-900">መተሓሳሰቢ:</p>
          <ul className="list-disc list-inside space-y-1 text-stone-600">
            <li>ኩሎም ኣባላት ስድራቤት ምስ ወለዶምን ውሉዳቶምን ብትኽክል ይመዝገቡ።</li>
          </ul>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-stone-100">
          <label className="flex items-center space-x-3 cursor-pointer select-none text-xs text-stone-800 font-ethiopic">
            <input
              type="checkbox"
              checked={userConfirmedCheckbox}
              onChange={(e) => setUserConfirmedCheckbox(e.target.checked)}
              className="rounded border-stone-300 text-amber-700 focus:ring-amber-600 w-4 h-4 cursor-pointer"
            />
            <span className="font-medium">
              እዚ መዝገብ ናብ ሲስተም ክኣቱ አረጋግጽ ኣለኹ።
            </span>
          </label>

          <button
            onClick={handleCommitImport}
            disabled={!userConfirmedCheckbox || isCommitting}
            className={`px-6 py-3 rounded-xl text-xs font-bold font-ethiopic text-white shadow-xs transition-all flex items-center justify-center space-x-2 ${
              userConfirmedCheckbox && !isCommitting
                ? 'bg-amber-700 hover:bg-amber-800 cursor-pointer shadow-sm active:scale-98'
                : 'bg-stone-300 cursor-not-allowed text-stone-500'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isCommitting ? 'የእቱ ኣሎ...' : 'መዝገብ ናብ ሲስተም ኣእቱ'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
