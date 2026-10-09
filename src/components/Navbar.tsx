import React from 'react';
import {
  GitFork,
  Users,
  AlertTriangle,
  History,
  Download,
  Settings,
  Database,
  CloudOff,
  Cloud,
  FileSpreadsheet
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'tree' | 'directory' | 'uncertain' | 'audit' | 'import' | 'export' | 'settings';
  setActiveTab: (tab: 'tree' | 'directory' | 'uncertain' | 'audit' | 'import' | 'export' | 'settings') => void;
  datasetMode: 'real' | 'demo' | 'empty';
  isCloudConnected: boolean;
  needsReviewCount: number;
  totalPeopleCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  datasetMode,
  isCloudConnected,
  needsReviewCount,
  totalPeopleCount,
}) => {
  return (
    <header className="bg-stone-900 text-stone-100 border-b border-stone-800 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('tree')}>
            <div className="w-10 h-10 rounded-lg bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xl font-ethiopic">
              ጉ
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold tracking-tight text-amber-100">
                  Kinteba Guush Family Genealogy
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-xs rounded bg-stone-800 text-amber-300/90 font-ethiopic">
                  ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Faithful Historical Archive &middot; {totalPeopleCount} Records
              </p>
            </div>
          </div>

          {/* Status Badges */}
          <div className="hidden md:flex items-center space-x-2">
            {/* Dataset Badge */}
            {datasetMode === 'real' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-400"></span>
                Real Family Dataset
              </span>
            )}
            {datasetMode === 'demo' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950 text-amber-300 border border-amber-800">
                <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                Demo Data Active
              </span>
            )}
            {datasetMode === 'empty' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-800 text-stone-400 border border-stone-700">
                <Database className="w-3 h-3 mr-1" />
                No Data Loaded
              </span>
            )}

            {/* Storage Mode */}
            {isCloudConnected ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-950 text-sky-300 border border-sky-800">
                <Cloud className="w-3 h-3 mr-1" />
                Cloud Connected
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-800 text-stone-300 border border-stone-700" title="Running in Local-First Mode via browser IndexedDB. No cloud required.">
                <CloudOff className="w-3 h-3 mr-1" />
                Local Mode (IndexedDB)
              </span>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2 border-t border-stone-800/80 scrollbar-none" aria-label="Main Navigation">
          <button
            onClick={() => setActiveTab('tree')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center space-x-1.5 ${
              activeTab === 'tree'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <GitFork className="w-4 h-4 rotate-180" />
            <span>Interactive Tree</span>
          </button>

          <button
            onClick={() => setActiveTab('directory')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center space-x-1.5 ${
              activeTab === 'directory'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Directory & Search</span>
          </button>

          <button
            onClick={() => setActiveTab('uncertain')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center space-x-1.5 ${
              activeTab === 'uncertain'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Uncertain Records</span>
            {needsReviewCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/30 text-amber-300 border border-amber-500/50">
                {needsReviewCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center space-x-1.5 ${
              activeTab === 'import'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Staged Import</span>
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center space-x-1.5 ${
              activeTab === 'export'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Backup & Export</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center space-x-1.5 ${
              activeTab === 'audit'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center space-x-1.5 ${
              activeTab === 'settings'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
