import React from 'react';
import {
  GitFork,
  Users,
  ShieldCheck,
  Shield,
  Search,
  Printer,
  Minus,
  Plus,
  Crown
} from 'lucide-react';
import { UserRole } from '../types/genealogy';

export type AppDestination = 'tree' | 'directory' | 'details' | 'about' | 'admin';

export type FontScale = 'small' | 'normal' | 'large' | 'xlarge';

const FONT_SCALES: FontScale[] = ['small', 'normal', 'large', 'xlarge'];

const FONT_SCALE_LABELS: Record<FontScale, string> = {
  small: 'ንእሽቶ',
  normal: 'መደበኛ',
  large: 'ዓቢ',
  xlarge: 'ዝዓበየ',
};

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
  const [fontScale, setFontScale] = React.useState<FontScale>(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('kinteba_font_scale') as FontScale;
      if (FONT_SCALES.includes(s)) return s;
    }
    return 'normal';
  });

  const applyFontScale = (scale: FontScale) => {
    setFontScale(scale);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('font-scale-small', 'font-scale-normal', 'font-scale-large', 'font-scale-xlarge');
      if (scale !== 'normal') {
        document.documentElement.classList.add(`font-scale-${scale}`);
      }
    }
    try {
      localStorage.setItem('kinteba_font_scale', scale);
    } catch {}
  };

  React.useEffect(() => {
    if (typeof document !== 'undefined' && fontScale !== 'normal') {
      document.documentElement.classList.remove('font-scale-small', 'font-scale-normal', 'font-scale-large', 'font-scale-xlarge');
      document.documentElement.classList.add(`font-scale-${fontScale}`);
    }
  }, []);

  const handleDecreaseFont = () => {
    const currentIndex = FONT_SCALES.indexOf(fontScale);
    if (currentIndex > 0) {
      applyFontScale(FONT_SCALES[currentIndex - 1]);
    }
  };

  const handleIncreaseFont = () => {
    const currentIndex = FONT_SCALES.indexOf(fontScale);
    if (currentIndex < FONT_SCALES.length - 1) {
      applyFontScale(FONT_SCALES[currentIndex + 1]);
    }
  };

  return (
    <>
      {/* Top Header Bar for Desktop and Mobile */}
      <header className="bg-stone-900 text-stone-100 border-b border-stone-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-[58px] sm:min-h-[64px] py-1.5 sm:py-2 gap-2">
            {/* Logo and Official Title: Protected Container Immune to Dynamic Font Scaling */}
            <button
              onClick={() => setActiveTab('tree')}
              className="flex items-center space-x-2.5 sm:space-x-3 text-left focus:outline-hidden group min-w-0 flex-1 sm:flex-initial cursor-pointer"
              aria-label="ናብ ገጽ መሰረት ወለዶ ኺድ"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-600/25 border border-amber-500/40 flex items-center justify-center text-amber-300 font-black text-lg sm:text-xl font-ethiopic shrink-0 group-hover:bg-amber-600/35 transition-colors shadow-2xs">
                ጉ
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <h1 className="navbar-brand-title font-black text-amber-100 font-ethiopic tracking-tight truncate sm:whitespace-nowrap">
                  ተወለድ እንዳቦይ ከንቲባ ጉዕሽ
                </h1>
                <p className="navbar-brand-subtitle text-stone-400 font-ethiopic truncate sm:whitespace-nowrap mt-0.5">
                  ታሪኻዊ መዝገብ ወለዶ &middot; {totalPeopleCount} ኣባላት
                </p>
              </div>
            </button>

            {/* Right Side: Font Size Stepper (መወሰኺን መቐነሲን) & Desktop Nav Links */}
            <div className="flex items-center space-x-2 shrink-0">
              {/* Font Size Accessibility Stepper: Decreaser (-) & Increaser (+) */}
              <div
                className="flex items-center bg-stone-950/80 border border-amber-500/40 rounded-xl p-0.5 shadow-xs shrink-0"
                role="group"
                aria-label="ናይ ፊደል ዓቐን መቖጻጸሪ (መወሰኺን መቐነሲን)"
              >
                <button
                  type="button"
                  onClick={handleDecreaseFont}
                  disabled={fontScale === 'small'}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-amber-300 hover:text-white hover:bg-stone-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="ፊደል ኣንእስ (-): ንወጣት ተጠቀምቲ"
                  aria-label="ፊደል ኣንእስ"
                >
                  <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>

                <div className="px-1.5 sm:px-2.5 text-center select-none min-w-[48px] sm:min-w-[65px]">
                  <span className="text-[11px] sm:text-xs font-bold text-amber-200 font-ethiopic whitespace-nowrap block">
                    {FONT_SCALE_LABELS[fontScale]}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleIncreaseFont}
                  disabled={fontScale === 'xlarge'}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-amber-300 hover:text-white hover:bg-stone-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="ፊደል ኣዕቢ (+): ንዕድመ ዝደፍኡ ኣባላት"
                  aria-label="ፊደል ኣዕቢ"
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>

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
