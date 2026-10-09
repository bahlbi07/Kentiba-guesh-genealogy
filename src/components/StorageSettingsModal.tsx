import React, { useState } from 'react';
import { isCloudConfigured, SUPABASE_SQL_MIGRATION } from '../services/supabaseClient';
import { DEMO_PEOPLE, DEMO_RELATIONSHIPS, DEMO_OCCURRENCES } from '../services/demoData';
import { bulkLoadData, clearAllData } from '../services/db';
import {
  Settings,
  Database,
  Cloud,
  CloudOff,
  Copy,
  Check,
  AlertTriangle,
  Sparkles,
  Trash2
} from 'lucide-react';

interface StorageSettingsModalProps {
  datasetMode: 'real' | 'demo' | 'empty';
  totalPeople: number;
  totalRelationships: number;
  onDataReset: () => void;
}

export const StorageSettingsModal: React.FC<StorageSettingsModalProps> = ({
  datasetMode,
  totalPeople,
  totalRelationships,
  onDataReset,
}) => {
  const [copiedSql, setCopiedSql] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const cloudActive = isCloudConfigured();

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_MIGRATION);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleLoadDemoData = async () => {
    await bulkLoadData({
      people: DEMO_PEOPLE,
      relationships: DEMO_RELATIONSHIPS,
      occurrences: DEMO_OCCURRENCES,
      mode: 'demo',
    }, 'User');
    onDataReset();
  };

  const handleClearData = async () => {
    await clearAllData('User');
    setShowClearConfirm(false);
    onDataReset();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Title */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-2">
        <h2 className="text-xl font-bold text-stone-900 flex items-center space-x-2">
          <Settings className="w-5 h-5 text-amber-600" />
          <span>Storage Architecture & Privacy Settings</span>
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 max-w-2xl">
          The application follows a <strong>Local-First Privacy Architecture</strong>.
          Your family records are saved in your browser's persistent IndexedDB and never uploaded anywhere without your explicit credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Local Storage Card */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Browser IndexedDB Storage</h3>
              <span className="text-[11px] text-emerald-600 font-semibold">Active & Persistent</span>
            </div>
          </div>

          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-stone-500">Dataset Status:</span>
              <span className="font-bold text-stone-800 uppercase">{datasetMode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">People Stored:</span>
              <span className="font-bold text-stone-800">{totalPeople} records</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Relationships Stored:</span>
              <span className="font-bold text-stone-800">{totalRelationships} links</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2 pt-2 border-t border-stone-100">
            <button
              onClick={handleLoadDemoData}
              className="w-full py-2 px-3 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Load Sample Demo Dataset (~9 people)</span>
            </button>

            {showClearConfirm ? (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl space-y-2 text-xs text-rose-900">
                <p className="font-bold">Are you sure you want to clear all data?</p>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2.5 py-1 bg-white border border-stone-300 rounded text-stone-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearData}
                    className="px-2.5 py-1 bg-rose-600 text-white rounded font-medium hover:bg-rose-700"
                  >
                    Confirm Clear All
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full py-2 px-3 border border-stone-200 hover:bg-rose-50 hover:text-rose-700 text-stone-600 rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear All Local Records</span>
              </button>
            )}
          </div>
        </div>

        {/* Optional Cloud Supabase Card */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-sky-50 text-sky-700">
              {cloudActive ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Optional Cloud Mode (Supabase)</h3>
              <span className={`text-[11px] font-semibold ${cloudActive ? 'text-sky-600' : 'text-stone-400'}`}>
                {cloudActive ? 'Connected' : 'Not Configured (Running Local-Only)'}
              </span>
            </div>
          </div>

          <p className="text-xs text-stone-600">
            To connect optional cloud sync on Supabase's free tier:
          </p>

          <ol className="list-decimal pl-4 space-y-1 text-xs text-stone-600">
            <li>Create a free project at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-amber-700 underline font-medium">supabase.com</a>.</li>
            <li>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your local <code>.env</code> file.</li>
            <li>Run the SQL migration script in your Supabase SQL Editor.</li>
          </ol>

          <div className="pt-2">
            <button
              onClick={handleCopySql}
              className="w-full py-2 px-3 border border-stone-300 hover:bg-stone-50 rounded-lg text-xs font-medium text-stone-700 flex items-center justify-center space-x-1.5"
            >
              {copiedSql ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copiedSql ? 'Copied SQL Script!' : 'Copy Supabase SQL Migration Script'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
