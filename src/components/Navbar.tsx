import React from 'react';
import {
  GitFork,
  Users,
  Info,
  BookOpen,
  Lock,
  Database,
  CloudOff,
  Cloud,
  FileText,
  Shield
} from 'lucide-react';

export type AppDestination = 'tree' | 'directory' | 'details' | 'about' | 'admin';

interface NavbarProps {
  activeTab: AppDestination;
  setActiveTab: (tab: AppDestination) => void;
  datasetMode: 'real' | 'demo' | 'empty';
  isCloudConnected: boolean;
  totalPeopleCount: number;
  hasSelectedPerson: boolean;
  onOpenAdminLogin?: () => void;
  isAdminAuthenticated?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  datasetMode,
  isCloudConnected,
  totalPeopleCount,
  hasSelectedPerson,
  isAdminAuthenticated,
}) => {
  return (
    <>
      {/* Top Header Bar for Desktop and Mobile */}
      <header className="bg-stone-900 text-stone-100 border-b border-stone-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Archive Title */}
            <button
              onClick={() => setActiveTab('tree')}
              className="flex items-center space-x-3 text-left focus:outline-hidden group"
              aria-label="Go to Family Tree home"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-600/25 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold text-xl font-ethiopic shrink-0 group-hover:bg-amber-600/35 transition-colors">
                ጉ
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-amber-100 font-sans">
                    Kinteba Guush Genealogy
                  </h1>
                  <span className="hidden md:inline-block px-2 py-0.5 text-xs rounded bg-stone-800 text-amber-300 font-ethiopic">
                    ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ
                  </span>
                </div>
                <p className="text-xs text-stone-400 font-ethiopic">
                  ታሪኻዊ መዝገብ &middot; {totalPeopleCount} ሰባት
                </p>
              </div>
            </button>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1" aria-label="Main Navigation">
              <button
                onClick={() => setActiveTab('tree')}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors flex items-center space-x-2 min-h-[44px] ${
                  activeTab === 'tree'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <GitFork className="w-4 h-4 rotate-180" />
                <span>ኦም ወለዶ (Tree)</span>
              </button>

              <button
                onClick={() => setActiveTab('directory')}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors flex items-center space-x-2 min-h-[44px] ${
                  activeTab === 'directory'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>ሰባት ድለ (Find)</span>
              </button>

              <button
                onClick={() => setActiveTab('details')}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors flex items-center space-x-2 min-h-[44px] ${
                  activeTab === 'details'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>መረዳእታ ስድራ (Details)</span>
                {hasSelectedPerson && (
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('about')}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors flex items-center space-x-2 min-h-[44px] ${
                  activeTab === 'about'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>ብዛዕባ እዚ መዝገብ (About)</span>
              </button>
            </nav>

            {/* Right Side: Status Badges and Admin Portal Button */}
            <div className="flex items-center space-x-2.5">
              {/* Storage Mode Badge */}
              <div className="hidden lg:flex items-center text-xs text-stone-400">
                {isCloudConnected ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-sky-950 text-sky-300 border border-sky-800">
                    <Cloud className="w-3 h-3 mr-1" />
                    Cloud
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-stone-800 text-stone-300 border border-stone-700">
                    <CloudOff className="w-3 h-3 mr-1" />
                    Local
                  </span>
                )}
              </div>

              {/* Admin Portal Entry */}
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-colors flex items-center space-x-1.5 min-h-[40px] border ${
                  activeTab === 'admin'
                    ? 'bg-stone-100 text-stone-900 border-white'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700'
                }`}
                title="Archivist Administration Portal"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>ኣካያዲ (Admin)</span>
                {isAdminAuthenticated && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Fixed for thumb reachability, touch targets >= 48px) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-stone-900/95 backdrop-blur-md border-t border-stone-800 px-2 py-1 flex items-center justify-around shadow-lg"
        aria-label="Mobile Bottom Navigation"
      >
        <button
          onClick={() => setActiveTab('tree')}
          className={`flex-1 flex flex-col items-center justify-center py-1 min-h-[48px] rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'tree' ? 'text-amber-400' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <GitFork className="w-5 h-5 rotate-180 mb-0.5" />
          <span>ኦም ወለዶ</span>
        </button>

        <button
          onClick={() => setActiveTab('directory')}
          className={`flex-1 flex flex-col items-center justify-center py-1 min-h-[48px] rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'directory' ? 'text-amber-400' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span>ሰባት ድለ</span>
        </button>

        <button
          onClick={() => setActiveTab('details')}
          className={`flex-1 flex flex-col items-center justify-center py-1 min-h-[48px] rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'details' ? 'text-amber-400' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <FileText className="w-5 h-5 mb-0.5" />
          <span>መረዳእታ</span>
        </button>

        <button
          onClick={() => setActiveTab('about')}
          className={`flex-1 flex flex-col items-center justify-center py-1 min-h-[48px] rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'about' ? 'text-amber-400' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          <span>ብዛዕባ</span>
        </button>

        <button
          onClick={() => setActiveTab('admin')}
          className={`flex-1 flex flex-col items-center justify-center py-1 min-h-[48px] rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'admin' ? 'text-amber-400' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Shield className="w-5 h-5 mb-0.5" />
          <span>ኣካያዲ</span>
        </button>
      </nav>
    </>
  );
};
