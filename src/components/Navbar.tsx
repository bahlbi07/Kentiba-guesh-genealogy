import React from 'react';
import {
  GitFork,
  Users,
  ShieldCheck,
  Shield,
  Search,
  Printer
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
  onOpenPdfExport?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  totalPeopleCount,
  isAdminAuthenticated,
  onOpenPdfExport,
}) => {
  return (
    <>
      {/* Top Header Bar for Desktop and Mobile */}
      <header className="bg-stone-900 text-stone-100 border-b border-stone-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Official Title */}
            <button
              onClick={() => setActiveTab('tree')}
              className="flex items-center space-x-3 text-left focus:outline-hidden group"
              aria-label="ናብ ገጽ መሰረት ወለዶ ኺድ"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-600/25 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold text-xl font-ethiopic shrink-0 group-hover:bg-amber-600/35 transition-colors">
                ጉ
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold tracking-tight text-amber-100 font-ethiopic">
                  ተወለድ እንዳቦይ ከንቲባ ጉዕሽ
                </h1>
                <p className="text-xs text-stone-400 font-ethiopic">
                  ታሪኻዊ መዝገብ ወለዶ &middot; {totalPeopleCount} ኣባላት
                </p>
              </div>
            </button>

            {/* Desktop Navigation Links: 3 Core Simple Tabs */}
            <nav className="hidden md:flex items-center space-x-2" aria-label="Main Navigation">
              <button
                onClick={() => setActiveTab('tree')}
                className={`px-4 py-2.5 rounded-xl text-base font-ethiopic font-semibold transition-colors flex items-center space-x-2 min-h-[44px] ${
                  activeTab === 'tree'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <GitFork className="w-5 h-5 rotate-180" />
                <span>መሰረት ወለዶ</span>
              </button>

              <button
                onClick={() => setActiveTab('directory')}
                className={`px-4 py-2.5 rounded-xl text-base font-ethiopic font-semibold transition-colors flex items-center space-x-2 min-h-[44px] ${
                  activeTab === 'directory' || activeTab === 'details'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <Search className="w-5 h-5" />
                <span>ምድላይ</span>
              </button>

              <button
                onClick={() => setActiveTab('admin')}
                className={`px-4 py-2.5 rounded-xl text-base font-ethiopic font-semibold transition-colors flex items-center space-x-2 min-h-[44px] border ${
                  activeTab === 'admin'
                    ? 'bg-white text-stone-900 border-white shadow-sm'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700'
                }`}
              >
                {isAdminAuthenticated ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Shield className="w-5 h-5 text-amber-400" />
                )}
                <span>ምምሕዳር</span>
                {isAdminAuthenticated && (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                )}
              </button>

              {onOpenPdfExport && (
                <button
                  onClick={onOpenPdfExport}
                  className="px-3.5 py-2.5 rounded-xl text-base font-ethiopic font-semibold transition-colors flex items-center space-x-1.5 min-h-[44px] text-stone-300 hover:bg-stone-800 hover:text-white border border-stone-800"
                  title="ናይ ወለዶ ሰነድ ሕተም / ኣውርድ"
                >
                  <Printer className="w-5 h-5 text-amber-400" />
                  <span className="hidden lg:inline">ሰነድ ሕተም</span>
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Fixed for thumb reachability, touch targets >= 48px) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-stone-900/98 backdrop-blur-md border-t border-stone-800 px-4 py-2 flex items-center justify-around shadow-xl"
        aria-label="Mobile Bottom Navigation"
      >
        <button
          onClick={() => setActiveTab('tree')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 min-h-[48px] rounded-xl text-xs font-ethiopic font-bold transition-colors ${
            activeTab === 'tree' ? 'text-amber-400 bg-stone-800/60' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <GitFork className="w-5 h-5 rotate-180 mb-1" />
          <span>መሰረት ወለዶ</span>
        </button>

        <button
          onClick={() => setActiveTab('directory')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 min-h-[48px] rounded-xl text-xs font-ethiopic font-bold transition-colors ${
            activeTab === 'directory' || activeTab === 'details' ? 'text-amber-400 bg-stone-800/60' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Search className="w-5 h-5 mb-1" />
          <span>ምድላይ</span>
        </button>

        <button
          onClick={() => setActiveTab('admin')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 min-h-[48px] rounded-xl text-xs font-ethiopic font-bold transition-colors ${
            activeTab === 'admin' ? 'text-amber-400 bg-stone-800/60' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Shield className="w-5 h-5 mb-1" />
          <span>ምምሕዳር</span>
        </button>
      </nav>
    </>
  );
};
