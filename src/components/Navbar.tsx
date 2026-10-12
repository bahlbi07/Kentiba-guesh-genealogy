import React, { useState } from 'react';
import {
  GitFork,
  Users,
  ShieldCheck,
  Shield,
  Search,
  Printer,
  Type,
  Crown
} from 'lucide-react';
import { UserRole } from '../types/genealogy';

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
  adminRole?: UserRole;
  onOpenPdfExport?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  totalPeopleCount,
  isAdminAuthenticated,
  adminRole = 'guest',
  onOpenPdfExport,
}) => {
  const [fontScale, setFontScale] = React.useState<'normal' | 'large' | 'xlarge'>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('kinteba_font_scale');
      if (s === 'large' || s === 'xlarge') return s;
    }
    return 'normal';
  });

  const handleCycleFontScale = () => {
    const nextScale: 'normal' | 'large' | 'xlarge' = 
      fontScale === 'normal' ? 'large' : fontScale === 'large' ? 'xlarge' : 'normal';
    setFontScale(nextScale);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('font-scale-large', 'font-scale-xlarge');
      if (nextScale === 'large') document.documentElement.classList.add('font-scale-large');
      if (nextScale === 'xlarge') document.documentElement.classList.add('font-scale-xlarge');
    }
    try {
      localStorage.setItem('kinteba_font_scale', nextScale);
    } catch {}
  };
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

            {/* Right Side: Font Size Accessibility Switcher & Nav Links */}
            <div className="flex items-center space-x-2">
              {/* Elder Font Scaler Button (Visible on both Mobile and Desktop) */}
              <button
                onClick={handleCycleFontScale}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-amber-500/50 bg-amber-950/50 hover:bg-amber-900/60 text-amber-200 text-xs sm:text-sm font-ethiopic font-bold transition-all shadow-xs min-h-[40px] cursor-pointer"
                title="መዐበዪ ፊደል: ንዕድመ ዝደፍኡ ኣባላት ዝተዳለወ (Font Size)"
                aria-label="ናይ ፊደል ዓቐን ቀይር"
              >
                <Type className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">ፊደል:</span>
                <span className="text-amber-100 font-extrabold whitespace-nowrap">
                  {fontScale === 'normal' ? (
                    'መደበኛ'
                  ) : fontScale === 'large' ? (
                    <>ዓቢ <span className="hidden sm:inline">(+15%)</span></>
                  ) : (
                    <>ዝዓበየ <span className="hidden sm:inline">(+30%)</span></>
                  )}
                </span>
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
                {adminRole === 'superadmin' ? (
                  <Crown className="w-5 h-5 text-amber-300" />
                ) : isAdminAuthenticated ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Shield className="w-5 h-5 text-amber-400" />
                )}
                <span>
                  {adminRole === 'superadmin'
                    ? 'ሱፐር ኣድሚን'
                    : isAdminAuthenticated
                    ? 'ኣድሚን'
                    : 'ምምሕዳር'}
                </span>
                {isAdminAuthenticated && (
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      adminRole === 'superadmin' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                  ></span>
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
          {adminRole === 'superadmin' ? (
            <Crown className="w-5 h-5 mb-1 text-amber-300" />
          ) : isAdminAuthenticated ? (
            <ShieldCheck className="w-5 h-5 mb-1 text-emerald-400" />
          ) : (
            <Shield className="w-5 h-5 mb-1" />
          )}
          <span>
            {adminRole === 'superadmin'
              ? 'ሱፐር ኣድሚን'
              : isAdminAuthenticated
              ? 'ኣድሚን'
              : 'ምምሕዳር'}
          </span>
        </button>
      </nav>
    </>
  );
};
