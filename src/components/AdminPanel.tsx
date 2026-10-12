import React, { useState } from 'react';
import {
  Person,
  Relationship,
  SourceOccurrence,
  AuditEvent,
  UserRole,
} from '../types/genealogy';
import {
  Shield,
  Lock,
  LogOut,
  Users,
  AlertTriangle,
  History,
  FileSpreadsheet,
  Plus,
  CheckCircle,
  KeyRound,
  ShieldCheck,
  Printer,
  Edit3,
  Eye,
  EyeOff,
  Crown,
  Trash2,
  RotateCcw,
  Send,
} from 'lucide-react';
import { RecordEditorView } from './RecordEditorView';
import { UncertainRecordsView } from './UncertainRecordsView';
import { ImportModal } from './ImportModal';
import { AuditLogViewer } from './AuditLogViewer';
import {
  GOOGLE_SHEETS_WEBHOOK_URL,
  testGoogleSheetsPing,
} from '../services/googleSheetsService';

interface AdminPanelProps {
  people: Person[];
  relationships: Relationship[];
  occurrences: SourceOccurrence[];
  auditEvents: AuditEvent[];
  isAuthenticated: boolean;
  role?: UserRole;
  onLogin: (token: string, username: string, role: 'admin' | 'superadmin') => void;
  onLogout: () => void;
  onSelectPerson: (person: Person) => void;
  onUpdatePerson: (person: Person) => Promise<void>;
  onDeletePerson: (id: string) => Promise<void>;
  onPermanentDeletePerson?: (id: string) => Promise<void>;
  onRestorePerson?: (id: string) => Promise<void>;
  onSaveRelationship: (rel: Relationship) => Promise<{ success: boolean; error?: string }>;
  onDeleteRelationship: (id: string) => Promise<void>;
  onAddNewPerson: () => void;
  onAddNewRelationship?: (fromPersonId?: string) => void;
  onImportCommitted: () => Promise<void>;
  onOpenPdfExport?: () => void;
  onDeduplicate?: () => Promise<{ mergedCount: number; details: string[] }>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  people,
  relationships,
  auditEvents,
  isAuthenticated,
  role = 'guest',
  onLogin,
  onLogout,
  onSelectPerson,
  onUpdatePerson,
  onDeletePerson,
  onPermanentDeletePerson,
  onRestorePerson,
  onSaveRelationship,
  onDeleteRelationship,
  onAddNewPerson,
  onAddNewRelationship,
  onImportCommitted,
  onOpenPdfExport,
  onDeduplicate,
}) => {
  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Google Sheets ping state
  const [isTestingSheets, setIsTestingSheets] = useState(false);
  const [sheetsTestResult, setSheetsTestResult] = useState<string | null>(null);

  // Super Admin vs Regular Admin tab navigation
  const [adminTab, setAdminTab] = useState<string>(() =>
    role === 'superadmin' ? 'deletions' : 'overview'
  );

  const pendingDeletions = people.filter(
    (p) => p.deletionPending || (p.isArchived && p.deletionRequestedBy)
  );
  const needsReviewCount = people.filter((p) => p.status === 'needs_review').length;
  const verifiedCount = people.filter((p) => p.status === 'verified').length;

  // Handle Login Authentication
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (loginAttempts >= 5) {
      setLoginError('ካብ መጠን ንላዕሊ ፈተነ ተገይሩ። በጃኹም ን5 ደቓይቕ ተጸበዩ።');
      return;
    }

    setIsLoggingIn(true);

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. Strict Super Admin Check - Exactly the required email and password
    const isSuperAdmin =
      cleanUser === 'kentibaguesh0909superadmin@gmail.com' &&
      cleanPass === 'Kentibaguesh#0909';

    // 2. Regular Admin Check
    const isRegularAdmin =
      (cleanUser === 'kentibaguesh@gmail.com' || cleanUser === 'admin') &&
      (cleanPass === 'Kentibaguesh0909' || cleanPass.toLowerCase() === 'kentibaguesh0909');

    try {
      if (isSuperAdmin) {
        onLogin('superadmin-master-session-token', 'kentibaguesh0909superadmin@gmail.com', 'superadmin');
        setAdminTab('deletions');
        return;
      }

      if (isRegularAdmin) {
        onLogin('admin-standard-session-token', cleanUser, 'admin');
        setAdminTab('overview');
        return;
      }

      setLoginAttempts((prev) => prev + 1);
      setLoginError('መእተዊ ሓበሬታ ትክክል ኣይኮነን። በጃኹም ዝተዋህበኩም ኢመይልን ፓስዎርድን ተጠቐሙ።');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // If not logged in, render the secure authentication gate
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-8 p-6 sm:p-8 bg-white rounded-3xl border border-stone-200 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-stone-900 text-amber-400 flex items-center justify-center mx-auto shadow-md">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-stone-950 font-ethiopic">
            ናይ መዛግብቲ ኣካያዲ መእተዊ
          </h2>
          <p className="text-xs text-stone-500 font-ethiopic">
            ውሑስ ናይ ኣድሚንን ሱፐር ኣድሚንን መእተዊ
          </p>
          <p className="text-sm sm:text-base text-stone-700 font-ethiopic leading-relaxed pt-1 font-medium">
            እዚ ክፍሊ ንተፈቐደሎም ናይ ስድራቤት ታሪኽ ተሓለውቲ ጥራይ ዝተፈቐደ እዩ። ተራ በጻሕቲ ሰነዳት ክቕይሩ ወይ ክድምስሱ ኣይክእሉን።
          </p>
        </div>

        <form onSubmit={handleLoginSubmit} className="space-y-4 font-ethiopic">
          <div>
            <label className="block text-sm font-bold text-stone-800 uppercase tracking-wider mb-1.5">
              ስም ተጠቃሚ / ኢመይል
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ስም ተጠቃሚ የእትዉ..."
              required
              className="w-full px-4 py-3 rounded-xl border border-stone-300 text-stone-950 text-base font-medium focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-ethiopic"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-stone-800 uppercase tracking-wider mb-1.5">
              መሕለፊ ቃል (Password)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 pr-12 rounded-xl border border-stone-300 text-stone-950 text-base font-medium focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-500 hover:text-stone-800 focus:outline-none cursor-pointer"
                title={showPassword ? 'መሕለፊ ቃል ሓብእ' : 'መሕለፊ ቃል ኣርኢ'}
                aria-label={showPassword ? 'መሕለፊ ቃል ሓብእ' : 'መሕለፊ ቃል ኣርኢ'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5 text-stone-500" />}
              </button>
            </div>
          </div>

          {loginError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{loginError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-3.5 min-h-[48px] bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-base font-extrabold shadow-md flex items-center justify-center gap-2 transition-colors focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <KeyRound className="w-5 h-5 text-amber-400" />
            <span>{isLoggingIn ? 'ይፍተሽ ኣሎ...' : 'ብደሓን እቶ'}</span>
          </button>
        </form>

        <div className="pt-4 border-t border-stone-200 text-center">
          <p className="text-xs sm:text-sm text-stone-500 font-ethiopic font-medium">
            ውሑስ ስርዓት ምሕደራ ተወለድቲ እንዳቦይ ከንቲባ ጉዕሽ
          </p>
        </div>
      </div>
    );
  }

  const isSuper = role === 'superadmin';

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-4 font-ethiopic">
      {/* Dynamic Header: Super Admin vs Regular Admin */}
      <div
        className={`p-5 sm:p-6 rounded-3xl border shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white ${
          isSuper
            ? 'bg-linear-to-r from-amber-950 via-stone-900 to-amber-900 border-amber-600/40'
            : 'bg-stone-900 border-stone-800'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
              isSuper
                ? 'bg-amber-500/30 border border-amber-400 text-amber-300 shadow-sm'
                : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
            }`}
          >
            {isSuper ? <Crown className="w-6 h-6 text-amber-300" /> : <ShieldCheck className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold font-ethiopic text-amber-100">
                {isSuper ? 'ዋና ኣካያዲ / ሱፐር ኣድሚን (Super Admin)' : 'ናይ መዛግብቲ ኣካያዲ (Admin Panel)'}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                  isSuper
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/50'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {isSuper ? 'ልዑል ስልጣን (Master Control)' : 'ስሩዕ ኣድሚን'}
              </span>
            </div>
            <p className="text-xs text-stone-300 mt-0.5 font-ethiopic">
              {isSuper
                ? 'kentibaguesh0909superadmin@gmail.com · ናይ ምድማስ ውሳነታትን ምሉእ ቁጽጽርን'
                : 'kentibaguesh@gmail.com · ምውሳኽን ምዕራይን መዛግብቲ ስድራቤት'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenPdfExport && (
            <button
              onClick={onOpenPdfExport}
              className="px-3 py-2 min-h-[40px] bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="ናይ ወለዶ ሰነድ ሕተም / ኣውርድ"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>ሰነድ ሕተም</span>
            </button>
          )}

          <button
            onClick={onAddNewPerson}
            className="px-3.5 py-2 min-h-[40px] bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>ሓድሽ ሰብ ወስኽ</span>
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

      {/* Admin Notice Banner */}
      {!isSuper && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-950 flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>ሓበሬታ፦</strong> ሓድሽ ዝውሰኽ ስም ብቐጥታ ናብ ወግዓዊ ሓረግ ወለዶን Google Sheetን ይሕወስ። ዝድምሰስ መዝገብ እንተሃልዩ ግና ንውሕስነት ዳታ ብሱፐር ኣድሚን ይረጋገጽ።
          </span>
        </div>
      )}

      {/* Clean Navigation Tabs */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-stone-200 shadow-xs overflow-x-auto gap-1">
        {/* Super Admin specific tab: Pending Deletions Queue */}
        {isSuper && (
          <button
            onClick={() => setAdminTab('deletions')}
            className={`px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              adminTab === 'deletions'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'text-stone-700 hover:bg-rose-50 hover:text-rose-900'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-300" />
            <span>ናይ ምድማስ ውሳነታት</span>
            {pendingDeletions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-900 text-white">
                {pendingDeletions.length}
              </span>
            )}
          </button>
        )}

        {/* Regular Admin Overview */}
        {!isSuper && (
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
        )}

        {/* Record Editor for both */}
        <button
          onClick={() => setAdminTab('editor')}
          className={`px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            adminTab === 'editor'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5 text-amber-500" />
          <span>መመዓራረዪ መዝገብ ({people.length})</span>
        </button>

        {/* Super Admin specific: Verification & Uncertain Records */}
        {isSuper && (
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
        )}

        {/* Super Admin specific: Google Sheets Sync */}
        {isSuper && (
          <button
            onClick={() => setAdminTab('sheets')}
            className={`px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              adminTab === 'sheets'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-stone-600 hover:bg-emerald-50 hover:text-emerald-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span>Google Sheets መላገቢ</span>
          </button>
        )}

        {/* Super Admin specific: Raw register import */}
        {isSuper && (
          <button
            onClick={() => setAdminTab('import')}
            className={`px-4 py-2 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              adminTab === 'import'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-stone-500" />
            <span>መዝገብ ምእታው</span>
          </button>
        )}

        {/* Audit Trail for both */}
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

      {/* TAB 1: Super Admin Pending Deletions Review */}
      {isSuper && adminTab === 'deletions' && (
        <div className="space-y-4">
          <div className="bg-rose-50 border border-rose-300 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-rose-950 text-base flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <span>ናይ ምድማስ ውሳነታት (Pending Deletions Queue)</span>
              </h3>
              <p className="text-xs text-rose-800 mt-0.5">
                ኣድሚን ደምስስ ዝበሎም መዛግብቲ ንውሕስነት ዳታ ኣብዚ ይእከቡ። ሱፐር ኣድሚን ጥራይ እዩ ንሓዋሩ ዘጽድቖም ወይ ናብ መዝገብ ዝመልሶም።
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-200 text-rose-950 border border-rose-300 shrink-0 self-start sm:self-auto">
              {pendingDeletions.length} ጠለባት
            </span>
          </div>

          {pendingDeletions.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-stone-200 shadow-xs space-y-2">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="text-base font-bold text-stone-900">ዝኾነ ናይ ምድማስ ጠለብ የለን</h4>
              <p className="text-xs text-stone-500">ኩሉ ናይ ስድራቤት ዳታ ውሑስን ጽኑዕን ኮይኑ ይቕጽል ኣሎ።</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingDeletions.map((p) => (
                <div key={p.id} className="p-5 bg-white rounded-2xl border-2 border-rose-200 shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-lg font-black text-stone-900">{p.canonicalName}</h4>
                      <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 font-bold text-stone-700">
                          ጨንፈር: {p.branch || 'ዘይተፈልጠ'}
                        </span>
                        {p.fatherName && <span>ወላዲ: {p.fatherName}</span>}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      ጠለብ ኣድሚን
                    </span>
                  </div>

                  {p.deletionRequestedAt && (
                    <div className="text-[11px] text-stone-400">
                      ዕለት ጠለብ: {new Date(p.deletionRequestedAt).toLocaleString('en-GB')}
                    </div>
                  )}

                  <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2">
                    <button
                      onClick={async () => {
                        if (onRestorePerson) {
                          await onRestorePerson(p.id);
                        }
                      }}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                      <span>መልስ / ንጸግ</span>
                    </button>

                    <button
                      onClick={async () => {
                        if (confirm(`ብሓቂ ን ${p.canonicalName} ካብ መዝገብ ንሓዋሩ ክትድምስሶ ትደሊ ዲኻ?`)) {
                          if (onPermanentDeletePerson) {
                            await onPermanentDeletePerson(p.id);
                          }
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ምድማስ ኣጽድቕ</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Super Admin Google Sheets Sync Management */}
      {isSuper && adminTab === 'sheets' && (
        <div className="space-y-6">
          <div className="bg-emerald-50 border-2 border-emerald-300 p-6 rounded-3xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-emerald-950">Google Sheets ቀጥታዊ ምትእስሳር</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-600 text-white">
                      ብህይወት ዘሎ (Active)
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    ኩሉ ሓድሽ ዝኣተወ ዳታ ብተዋረድ ሰንሰለቱ (Lineage) ናብ Google Sheet ይምዝገብ
                  </p>
                </div>
              </div>

              <button
                disabled={isTestingSheets}
                onClick={async () => {
                  setIsTestingSheets(true);
                  setSheetsTestResult(null);
                  const ok = await testGoogleSheetsPing();
                  setIsTestingSheets(false);
                  if (ok) {
                    setSheetsTestResult('✅ ፈተነ ብዓወት ተላኢኹ! ኣብ Google Sheet ናትካ ሓድሽ መስመር ተወሲኹ ኣሎ።');
                  } else {
                    setSheetsTestResult('❌ ጌጋ ኣጋጢሙ። በጃኹም ዳግማይ ፈትኑ።');
                  }
                }}
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs shrink-0 active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>{isTestingSheets ? 'ይፍተን ኣሎ...' : 'ናይ ፈተነ መስመር ስደድ'}</span>
              </button>
            </div>

            {sheetsTestResult && (
              <div className="p-3 bg-white rounded-xl border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{sheetsTestResult}</span>
              </div>
            )}

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 text-xs text-stone-700 space-y-2">
              <div className="font-bold text-stone-900">ዝተተኸለ ናይ መራኸቢ Webhook ሊንክ፦</div>
              <div className="font-mono text-[11px] bg-stone-100 p-2.5 rounded-xl break-all text-stone-800 select-all border border-stone-200">
                {GOOGLE_SHEETS_WEBHOOK_URL}
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed pt-1">
                ዝኾነ ተጠቃሚ ወይ ኣድሚን ኣብዚ ዌብሳይት ሓድሽ ሰብ ወይ ውሉድ ኣብ ዝወሰኸሉ ቅጽበት፡ እቲ ስም፡ ደረጃ ወለዶ፡ ጨንፈር፡ ስም ኣቦ/ኣደ፡ መጻምድትን እቲ ምሉእ ተዋረድ ሰንሰለት (Breadcrumb) ብቐጥታ ናብቲ ናትካ Google Sheet ይለኣኽ።
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Regular Admin Overview */}
      {!isSuper && adminTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">ጠቕላላ ሰባት</span>
              <div className="text-2xl font-bold text-stone-900 mt-1">{people.length}</div>
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

          <div className="bg-linear-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 sm:p-6 rounded-3xl border border-amber-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <Edit3 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-stone-900">
                  ዝተመዝገበ ዳታ ወይ ስም ምዕራይ (መመዓራረዪ)
                </h4>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                  ኣብ መዛግብቲ ወለዶ ዝተጋገየ ስም፣ ስም ኣቦ/ኣደ፣ ጨንፈር ወይ ዝምድናታት ንምስትኻኻል እዚ መመዓራረዪ ተጠቐሙ።
                </p>
              </div>
            </div>

            <button
              onClick={() => setAdminTab('editor')}
              className="px-4 py-2.5 min-h-[40px] bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <Edit3 className="w-4 h-4" />
              <span>መመዓራረዪ መዝገብ ክፈት</span>
            </button>
          </div>
        </div>
      )}

      {/* Record Editor for both */}
      {adminTab === 'editor' && (
        <RecordEditorView
          people={people}
          relationships={relationships}
          onUpdatePerson={onUpdatePerson}
          onDeletePerson={onDeletePerson}
          onSaveRelationship={onSaveRelationship}
          onDeleteRelationship={onDeleteRelationship}
          onAddNewPerson={onAddNewPerson}
          onAddNewRelationship={onAddNewRelationship}
          onSelectPerson={onSelectPerson}
          onDeduplicate={onDeduplicate}
        />
      )}

      {/* Super Admin specific: Uncertain Records Queue */}
      {isSuper && adminTab === 'uncertain' && (
        <UncertainRecordsView
          people={people}
          relationships={relationships}
          onSelectPerson={onSelectPerson}
          onUpdatePerson={onUpdatePerson}
          onUpdateRelationship={onSaveRelationship}
          onDeleteRelationship={onDeleteRelationship}
        />
      )}

      {/* Super Admin specific: Import Register */}
      {isSuper && adminTab === 'import' && (
        <ImportModal onImportCommitted={onImportCommitted} />
      )}

      {/* Audit Logs for both */}
      {adminTab === 'audit' && (
        <AuditLogViewer auditEvents={auditEvents} />
      )}
    </div>
  );
};
