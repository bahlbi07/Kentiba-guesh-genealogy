import React, { useState } from 'react';
import {
  Person,
  Relationship,
  SourceOccurrence,
  AuditEvent
} from '../types/genealogy';
import {
  Shield,
  Lock,
  LogOut,
  Users,
  GitFork,
  AlertTriangle,
  History,
  Download,
  FileSpreadsheet,
  Plus,
  CheckCircle,
  HelpCircle,
  KeyRound,
  ShieldCheck,
  Settings,
  Database,
  Printer
} from 'lucide-react';
import { UncertainRecordsView } from './UncertainRecordsView';
import { ImportModal } from './ImportModal';
import { AuditLogViewer } from './AuditLogViewer';
import { apiLogin, isBackendConfigured } from '../services/apiClient';

interface AdminPanelProps {
  people: Person[];
  relationships: Relationship[];
  occurrences: SourceOccurrence[];
  auditEvents: AuditEvent[];
  isAuthenticated: boolean;
  onLogin: (token: string, username: string) => void;
  onLogout: () => void;
  onSelectPerson: (person: Person) => void;
  onUpdatePerson: (person: Person) => Promise<void>;
  onDeletePerson: (id: string) => Promise<void>;
  onSaveRelationship: (rel: Relationship) => Promise<{ success: boolean; error?: string }>;
  onDeleteRelationship: (id: string) => Promise<void>;
  onAddNewPerson: () => void;
  onAddNewRelationship: () => void;
  onImportCommitted: () => Promise<void>;
  onOpenPdfExport?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  people,
  relationships,
  occurrences,
  auditEvents,
  isAuthenticated,
  onLogin,
  onLogout,
  onSelectPerson,
  onUpdatePerson,
  onDeletePerson,
  onSaveRelationship,
  onDeleteRelationship,
  onAddNewPerson,
  onAddNewRelationship,
  onImportCommitted,
  onOpenPdfExport,
}) => {
  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Admin sub-view
  const [adminTab, setAdminTab] = useState<'overview' | 'uncertain' | 'import' | 'audit'>('overview');

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (loginAttempts >= 5) {
      setLoginError('ካብ መጠን ንላዕሊ ፈተነ ተገይሩ። በጃኹም ን5 ደቓይቕ ተጸበዩ።');
      return;
    }

    setIsLoggingIn(true);

    try {
      if (isBackendConfigured()) {
        const result = await apiLogin(username, password);
        if (result.success && result.token) {
          onLogin(result.token, username);
          return;
        } else {
          setLoginAttempts((prev) => prev + 1);
          setLoginError(result.error || 'መእተዊ ሓበሬታ ትክክል ኣይኮነን።');
          return;
        }
      } else {
        // Authorized administrator credentials: kentibaguesh@gmail.com / Kentibaguesh0909
        const normalizedUser = username.trim().toLowerCase();
        const isOfficialAdmin = normalizedUser === 'kentibaguesh@gmail.com' && password === 'Kentibaguesh0909';
        const isArchivistTest = (normalizedUser === 'archivist' || normalizedUser === 'admin') && password === 'Kentibaguesh0909';
        
        if (isOfficialAdmin || isArchivistTest) {
          onLogin('official-admin-session-token', username);
          return;
        } else {
          setLoginAttempts((prev) => prev + 1);
          setLoginError('መእተዊ ሓበሬታ ትክክል ኣይኮነን።');
        }
      }
    } catch {
      setLoginError('ምስ ሰርቨር ምርኻብ ኣይተኻእለን። በጃኹም ዳግማይ ፈትኑ።');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // If not logged in, render the secure authentication gate
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-8 p-6 sm:p-8 bg-white rounded-3xl border border-stone-250 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-stone-900 text-amber-400 flex items-center justify-center mx-auto shadow-md">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-stone-950 font-ethiopic">
            ናይ መዛግብቲ ኣካያዲ መእተዊ
          </h2>
          <p className="text-xs text-stone-500 font-ethiopic">
            ውሑስ ናይ ምሕደራ መእተዊ
          </p>
          <p className="text-xs text-stone-600 font-ethiopic leading-relaxed pt-1">
            እዚ ክፍሊ ንተፈቐደሎም ናይ ስድራቤት ታሪኽ ተሓለውቲ ጥራይ ዝተፈቐደ እዩ። ተራ በጻሕቲ ሰነዳት ክቕይሩ ኣይክእሉን።
          </p>
        </div>

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
              ስም ተጠቃሚ (Username)
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="archivist"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
              መሕለፊ ቃል (Password)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>

          {loginError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-3 min-h-[44px] bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-bold shadow-md flex items-center justify-center gap-2 transition-colors focus:ring-2 focus:ring-amber-500"
          >
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>{isLoggingIn ? 'ይፍተሽ ኣሎ...' : 'ብደሓን እቶ'}</span>
          </button>
        </form>

        <div className="pt-4 border-t border-stone-100 text-center">
          <p className="text-[11px] text-stone-400 font-ethiopic">
            ብውሑስ ናይ ሰርቨር ስርዓት ዝተሓለወ እዩ።
          </p>
        </div>
      </div>
    );
  }

  const needsReviewCount = people.filter((p) => p.status === 'needs_review').length;
  const verifiedCount = people.filter((p) => p.status === 'verified').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-4 font-ethiopic">
      {/* Admin Header Bar */}
      <div className="bg-stone-900 text-white p-5 sm:p-6 rounded-3xl border border-stone-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-ethiopic text-amber-100">
                ናይ መዛግብቲ ኣካያዲ
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ዝተረጋገጸ
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5 font-ethiopic">
              ምሉእ ምሕደራ መዛግብቲ ስድራቤት፣ ዝምድናታትን ኦዲትን
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenPdfExport && (
            <button
              onClick={onOpenPdfExport}
              className="px-3 py-2 min-h-[40px] bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="ናይ ወለዶ ሰነድ ሕተም / ኣውርድ"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>ናይ ወለዶ ሰነድ (ሕትመት)</span>
            </button>
          )}

          <button
            onClick={onAddNewPerson}
            className="px-3 py-2 min-h-[40px] bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ሓድሽ ሰብ ወስኽ</span>
          </button>

          <button
            onClick={onAddNewRelationship}
            className="px-3 py-2 min-h-[40px] bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <GitFork className="w-4 h-4 rotate-180" />
            <span>ዝምድና ወስኽ</span>
          </button>

          <button
            onClick={onLogout}
            className="px-3 py-2 min-h-[40px] bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="ካብዚ ውጻእ"
          >
            <LogOut className="w-4 h-4" />
            <span>ውጻእ</span>
          </button>
        </div>
      </div>

      {/* Admin Sub-navigation Tabs */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-stone-200 shadow-xs overflow-x-auto gap-1">
        <button
          onClick={() => setAdminTab('overview')}
          className={`px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            adminTab === 'overview'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          ሓፈሻዊ ጸብጻብ
        </button>

        <button
          onClick={() => setAdminTab('uncertain')}
          className={`px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            adminTab === 'uncertain'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span>ምምርማር ዘድልዮም ({needsReviewCount})</span>
        </button>

        <button
          onClick={() => setAdminTab('import')}
          className={`px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            adminTab === 'import'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
          <span>መዝገብ ምእታው</span>
        </button>

        <button
          onClick={() => setAdminTab('audit')}
          className={`px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            adminTab === 'audit'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          <History className="w-3.5 h-3.5 text-stone-500" />
          <span>ናይ ለውጢ ታሪኽ</span>
        </button>
      </div>

      {/* Admin Content Panels */}
      {adminTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">ጠቕላላ ሰባት</span>
              <div className="text-2xl font-bold text-stone-900 mt-1">{people.length}</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">ጠቕላላ ዝምድናታት</span>
              <div className="text-2xl font-bold text-stone-900 mt-1">{relationships.length}</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-amber-800 font-medium">ምምርማር ዘድልዮም</span>
              <div className="text-2xl font-bold text-amber-700 mt-1">{needsReviewCount}</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-emerald-800 font-medium">ዝተረጋገጹ</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1">{verifiedCount}</div>
            </div>
          </div>

          {/* Quick Management Instructions */}
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-3">
            <h3 className="font-bold text-stone-900 font-ethiopic text-lg">
              መመሪያታት ኣካያዲ
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-stone-700 font-ethiopic list-disc list-inside leading-relaxed">
              <li>
                <strong>ምድላው መዝገብ:</strong> እቲ ናይ መበቆል ሰነድ ዳታ ቅድሚ ምእታዉ፡ ኣብቲ &ldquo;መዝገብ ምእታው&rdquo; ዝብል ክፍሊ ብንጹር ተረጋጊጹ ብፍቓድካ ጥራይ ይኣቱ።
              </li>
              <li>
                <strong>ተመሳሰልቲ ኣስማት:</strong> ኣብ ስድራቤትና ተመሳሰልቲ ኣስማት ስለዘለዉ፡ ብስም ጥራይ ኣይትድምስሱ ወይ ኣይተደባልቑ።
              </li>
              <li>
                <strong>ምድምሳስ ሰብ:</strong> ሰብ ቅድሚ ምድምሳስኩም፡ ተተሓሓዝቲ ዝምድናታትን ውሉዳትን ከይጉድኡ ብጥንቃቐ መርምሩ።
              </li>
              <li>
                <strong>ባክኣፕ ምውሳድ:</strong> ድሕሪ ዝኾነ ዓቢ ለውጢ ምግባርኩም፡ ወትሩ ባክኣፕ ፋይል ኣውሪድኩም ኣቐምጡ።
              </li>
            </ul>
          </div>
        </div>
      )}

      {adminTab === 'uncertain' && (
        <UncertainRecordsView
          people={people}
          relationships={relationships}
          onSelectPerson={onSelectPerson}
          onUpdatePerson={onUpdatePerson}
          onUpdateRelationship={onSaveRelationship}
        />
      )}

      {adminTab === 'import' && (
        <ImportModal onImportCommitted={onImportCommitted} />
      )}

      {adminTab === 'audit' && (
        <AuditLogViewer auditEvents={auditEvents} />
      )}
    </div>
  );
};

