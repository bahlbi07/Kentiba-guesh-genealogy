import React, { useState, useMemo } from 'react';
import { Person, Relationship } from '../types/genealogy';
import {
  X,
  Printer,
  Table as TableIcon,
  GitFork,
  Search,
  Filter,
  Users,
  Heart,
  Baby,
  ChevronRight,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface GenealogyPdfExportModalProps {
  people: Person[];
  relationships: Relationship[];
  onClose: () => void;
}

export const OFFICIAL_BRANCH_ORDER = [
  'ጎብሩ',
  'ሃብቱ',
  'ተስፉ',
  'ደስታ',
  'ወለገርግስ',
  'ይሕደጎ',
  'ብስራት',
  'ትዕበ',
  'በርሀ',
  'መድህን',
  'ግብፂት',
  'ተፈሪ',
];

export interface BranchTheme {
  name: string;
  themeColor: string;
  headerGradient: string;
  headerBadge: string;
  tableHeadBg: string;
  tableHeadText: string;
  borderCol: string;
  lightBg: string;
  accentText: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  accentHex: string;
}

export const BRANCH_THEMES: Record<string, BranchTheme> = {
  ጎብሩ: {
    name: 'ጎብሩ',
    themeColor: 'amber',
    headerGradient: 'from-amber-600 via-amber-700 to-yellow-700',
    headerBadge: 'bg-amber-800/80 text-amber-100 border-amber-400/40',
    tableHeadBg: 'bg-amber-100/90',
    tableHeadText: 'text-amber-950',
    borderCol: 'border-amber-300',
    lightBg: 'bg-amber-50/40',
    accentText: 'text-amber-800',
    badgeBg: 'bg-amber-100',
    badgeBorder: 'border-amber-300',
    badgeText: 'text-amber-900',
    accentHex: '#b45309',
  },
  ሃብቱ: {
    name: 'ሃብቱ',
    themeColor: 'emerald',
    headerGradient: 'from-emerald-600 via-emerald-700 to-teal-800',
    headerBadge: 'bg-emerald-800/80 text-emerald-100 border-emerald-400/40',
    tableHeadBg: 'bg-emerald-100/90',
    tableHeadText: 'text-emerald-950',
    borderCol: 'border-emerald-300',
    lightBg: 'bg-emerald-50/40',
    accentText: 'text-emerald-800',
    badgeBg: 'bg-emerald-100',
    badgeBorder: 'border-emerald-300',
    badgeText: 'text-emerald-900',
    accentHex: '#047857',
  },
  ተስፉ: {
    name: 'ተስፉ',
    themeColor: 'blue',
    headerGradient: 'from-blue-600 via-blue-700 to-indigo-800',
    headerBadge: 'bg-blue-800/80 text-blue-100 border-blue-400/40',
    tableHeadBg: 'bg-blue-100/90',
    tableHeadText: 'text-blue-950',
    borderCol: 'border-blue-300',
    lightBg: 'bg-blue-50/40',
    accentText: 'text-blue-800',
    badgeBg: 'bg-blue-100',
    badgeBorder: 'border-blue-300',
    badgeText: 'text-blue-900',
    accentHex: '#1d4ed8',
  },
  ደስታ: {
    name: 'ደስታ',
    themeColor: 'purple',
    headerGradient: 'from-purple-600 via-purple-700 to-violet-800',
    headerBadge: 'bg-purple-800/80 text-purple-100 border-purple-400/40',
    tableHeadBg: 'bg-purple-100/90',
    tableHeadText: 'text-purple-950',
    borderCol: 'border-purple-300',
    lightBg: 'bg-purple-50/40',
    accentText: 'text-purple-800',
    badgeBg: 'bg-purple-100',
    badgeBorder: 'border-purple-300',
    badgeText: 'text-purple-900',
    accentHex: '#7e22ce',
  },
  ወለገርግስ: {
    name: 'ወለገርግስ',
    themeColor: 'teal',
    headerGradient: 'from-teal-600 via-teal-700 to-cyan-800',
    headerBadge: 'bg-teal-800/80 text-teal-100 border-teal-400/40',
    tableHeadBg: 'bg-teal-100/90',
    tableHeadText: 'text-teal-950',
    borderCol: 'border-teal-300',
    lightBg: 'bg-teal-50/40',
    accentText: 'text-teal-800',
    badgeBg: 'bg-teal-100',
    badgeBorder: 'border-teal-300',
    badgeText: 'text-teal-900',
    accentHex: '#0f766e',
  },
  ይሕደጎ: {
    name: 'ይሕደጎ',
    themeColor: 'rose',
    headerGradient: 'from-rose-600 via-rose-700 to-pink-800',
    headerBadge: 'bg-rose-800/80 text-rose-100 border-rose-400/40',
    tableHeadBg: 'bg-rose-100/90',
    tableHeadText: 'text-rose-950',
    borderCol: 'border-rose-300',
    lightBg: 'bg-rose-50/40',
    accentText: 'text-rose-800',
    badgeBg: 'bg-rose-100',
    badgeBorder: 'border-rose-300',
    badgeText: 'text-rose-900',
    accentHex: '#be123c',
  },
  ይሕደጋ: {
    name: 'ይሕደጎ',
    themeColor: 'rose',
    headerGradient: 'from-rose-600 via-rose-700 to-pink-800',
    headerBadge: 'bg-rose-800/80 text-rose-100 border-rose-400/40',
    tableHeadBg: 'bg-rose-100/90',
    tableHeadText: 'text-rose-950',
    borderCol: 'border-rose-300',
    lightBg: 'bg-rose-50/40',
    accentText: 'text-rose-800',
    badgeBg: 'bg-rose-100',
    badgeBorder: 'border-rose-300',
    badgeText: 'text-rose-900',
    accentHex: '#be123c',
  },
  ብስራት: {
    name: 'ብስራት',
    themeColor: 'orange',
    headerGradient: 'from-orange-600 via-orange-700 to-amber-800',
    headerBadge: 'bg-orange-800/80 text-orange-100 border-orange-400/40',
    tableHeadBg: 'bg-orange-100/90',
    tableHeadText: 'text-orange-950',
    borderCol: 'border-orange-300',
    lightBg: 'bg-orange-50/40',
    accentText: 'text-orange-800',
    badgeBg: 'bg-orange-100',
    badgeBorder: 'border-orange-300',
    badgeText: 'text-orange-900',
    accentHex: '#c2410c',
  },
  ትዕበ: {
    name: 'ትዕበ',
    themeColor: 'indigo',
    headerGradient: 'from-indigo-600 via-indigo-700 to-slate-800',
    headerBadge: 'bg-indigo-800/80 text-indigo-100 border-indigo-400/40',
    tableHeadBg: 'bg-indigo-100/90',
    tableHeadText: 'text-indigo-950',
    borderCol: 'border-indigo-300',
    lightBg: 'bg-indigo-50/40',
    accentText: 'text-indigo-800',
    badgeBg: 'bg-indigo-100',
    badgeBorder: 'border-indigo-300',
    badgeText: 'text-indigo-900',
    accentHex: '#4338ca',
  },
  በርሀ: {
    name: 'በርሀ',
    themeColor: 'sky',
    headerGradient: 'from-sky-600 via-sky-700 to-cyan-800',
    headerBadge: 'bg-sky-800/80 text-sky-100 border-sky-400/40',
    tableHeadBg: 'bg-sky-100/90',
    tableHeadText: 'text-sky-950',
    borderCol: 'border-sky-300',
    lightBg: 'bg-sky-50/40',
    accentText: 'text-sky-800',
    badgeBg: 'bg-sky-100',
    badgeBorder: 'border-sky-300',
    badgeText: 'text-sky-900',
    accentHex: '#0369a1',
  },
  መድህን: {
    name: 'መድህን',
    themeColor: 'fuchsia',
    headerGradient: 'from-fuchsia-600 via-fuchsia-700 to-pink-800',
    headerBadge: 'bg-fuchsia-800/80 text-fuchsia-100 border-fuchsia-400/40',
    tableHeadBg: 'bg-fuchsia-100/90',
    tableHeadText: 'text-fuchsia-950',
    borderCol: 'border-fuchsia-300',
    lightBg: 'bg-fuchsia-50/40',
    accentText: 'text-fuchsia-800',
    badgeBg: 'bg-fuchsia-100',
    badgeBorder: 'border-fuchsia-300',
    badgeText: 'text-fuchsia-900',
    accentHex: '#a21caf',
  },
  መድሂን: {
    name: 'መድህን',
    themeColor: 'fuchsia',
    headerGradient: 'from-fuchsia-600 via-fuchsia-700 to-pink-800',
    headerBadge: 'bg-fuchsia-800/80 text-fuchsia-100 border-fuchsia-400/40',
    tableHeadBg: 'bg-fuchsia-100/90',
    tableHeadText: 'text-fuchsia-950',
    borderCol: 'border-fuchsia-300',
    lightBg: 'bg-fuchsia-50/40',
    accentText: 'text-fuchsia-800',
    badgeBg: 'bg-fuchsia-100',
    badgeBorder: 'border-fuchsia-300',
    badgeText: 'text-fuchsia-900',
    accentHex: '#a21caf',
  },
  ግብፂት: {
    name: 'ግብፂት',
    themeColor: 'rose',
    headerGradient: 'from-rose-600 via-rose-700 to-pink-800',
    headerBadge: 'bg-rose-800/80 text-rose-100 border-rose-400/40',
    tableHeadBg: 'bg-rose-100/90',
    tableHeadText: 'text-rose-950',
    borderCol: 'border-rose-300',
    lightBg: 'bg-rose-50/40',
    accentText: 'text-rose-800',
    badgeBg: 'bg-rose-100',
    badgeBorder: 'border-rose-300',
    badgeText: 'text-rose-900',
    accentHex: '#e11d48',
  },
  ተፈሪ: {
    name: 'ተፈሪ',
    themeColor: 'indigo',
    headerGradient: 'from-indigo-600 via-indigo-700 to-purple-800',
    headerBadge: 'bg-indigo-800/80 text-indigo-100 border-indigo-400/40',
    tableHeadBg: 'bg-indigo-100/90',
    tableHeadText: 'text-indigo-950',
    borderCol: 'border-indigo-300',
    lightBg: 'bg-indigo-50/40',
    accentText: 'text-indigo-800',
    badgeBg: 'bg-indigo-100',
    badgeBorder: 'border-indigo-300',
    badgeText: 'text-indigo-900',
    accentHex: '#4f46e5',
  },
};

const DEFAULT_THEME: BranchTheme = {
  name: 'ሓፈሻዊ',
  themeColor: 'stone',
  headerGradient: 'from-stone-700 via-stone-800 to-stone-900',
  headerBadge: 'bg-stone-800 text-stone-100 border-stone-600',
  tableHeadBg: 'bg-stone-100',
  tableHeadText: 'text-stone-900',
  borderCol: 'border-stone-300',
  lightBg: 'bg-stone-50/50',
  accentText: 'text-stone-800',
  badgeBg: 'bg-stone-100',
  badgeBorder: 'border-stone-300',
  badgeText: 'text-stone-900',
  accentHex: '#44403c',
};

export interface HierarchicalMember {
  person: Person;
  generation: number; // 1 = Founder of branch, 2 = Child, 3 = Grandchild, 4 = Great-grandchild...
  generationLabel: string;
  lineagePath: string[];
  spouses: Array<{ person: Person; wording?: string }>;
  children: Person[];
  depth: number;
}

export interface BranchHierarchicalData {
  name: string;
  theme: BranchTheme;
  founder: Person | null;
  totalMembers: number;
  hierarchicalMembers: HierarchicalMember[];
  maxGeneration: number;
}

export function cleanDisplayNote(note?: string | null): string {
  if (!note) return '';
  const trimmed = note.trim();
  if (
    /PDF/i.test(trimmed) ||
    /page \d+/i.test(trimmed) ||
    /ገጽ \d+/i.test(trimmed) ||
    /ከሰተ-ብርሃነ/i.test(trimmed) ||
    /Recorded on/i.test(trimmed) ||
    /Opening names/i.test(trimmed) ||
    /Source relationship/i.test(trimmed) ||
    /Confirmed continuation/i.test(trimmed) ||
    /Named in union/i.test(trimmed) ||
    /Parent introduced/i.test(trimmed) ||
    /Patriarch named/i.test(trimmed) ||
    /Unlabelled in source/i.test(trimmed) ||
    /source title/i.test(trimmed)
  ) {
    return '';
  }
  return trimmed;
}

export const GenealogyPdfExportModal: React.FC<GenealogyPdfExportModalProps> = ({
  people,
  relationships,
  onClose,
}) => {
  // Modal state
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'hierarchy'>('table');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Map people
  const peopleMap = useMemo(() => {
    const map = new Map<string, Person>();
    for (const p of people) map.set(p.id, p);
    return map;
  }, [people]);

  // Map parents to children
  const parentToChildrenMap = useMemo(() => {
    const map = new Map<string, Person[]>();
    for (const r of relationships) {
      if (r.type === 'parent_child') {
        const child = peopleMap.get(r.toPersonId);
        if (child) {
          const list = map.get(r.fromPersonId) || [];
          if (!list.some((c) => c.id === child.id)) {
            list.push(child);
            map.set(r.fromPersonId, list);
          }
        }
      }
    }
    return map;
  }, [relationships, peopleMap]);

  // Map spouses
  const spouseMap = useMemo(() => {
    const map = new Map<string, Array<{ person: Person; wording?: string }>>();
    for (const r of relationships) {
      if (r.type === 'partner_or_union') {
        const p1 = peopleMap.get(r.fromPersonId);
        const p2 = peopleMap.get(r.toPersonId);
        if (p1 && p2) {
          const l1 = map.get(p1.id) || [];
          if (!l1.some((s) => s.person.id === p2.id)) {
            l1.push({ person: p2, wording: r.sourceWording });
            map.set(p1.id, l1);
          }
          const l2 = map.get(p2.id) || [];
          if (!l2.some((s) => s.person.id === p1.id)) {
            l2.push({ person: p1, wording: r.sourceWording });
            map.set(p2.id, l2);
          }
        }
      }
    }
    return map;
  }, [relationships, peopleMap]);

  // Root ancestor
  const rootAncestor = useMemo(() => {
    return (
      people.find(
        (p) =>
          p.id === 'pers_root_kinteba_guush' ||
          p.canonicalName.includes('ከንቲባ ጉዑሽ') ||
          p.canonicalName.includes('ከንቲባ ጉዕሽ') ||
          p.id === 'pers_p1_0_0'
      ) || people[0]
    );
  }, [people]);

  // The exact 12 official branches of Patriarch Kinteba Guush Hagos
  const allBranchNames = useMemo(() => {
    return OFFICIAL_BRANCH_ORDER;
  }, []);

  // Build hierarchical descent order per branch
  const branchData = useMemo<BranchHierarchicalData[]>(() => {
    return allBranchNames.map((branchName) => {
      const theme = BRANCH_THEMES[branchName] || DEFAULT_THEME;

      // Collect all people assigned to this branch
      const branchMembers = people.filter(
        (p) => p.branch && p.branch.trim() === branchName
      );

      // Find founder: canonicalName matches branchName, or contains branchName & father includes 'ከንቲባ'
      let founder =
        people.find(
          (p) =>
            p.canonicalName.trim() === branchName ||
            (p.canonicalName.includes(branchName) &&
              (!p.fatherName || p.fatherName.includes('ከንቲባ')))
        ) || null;

      // Fallback: first member with branch match
      if (!founder && branchMembers.length > 0) {
        founder = branchMembers[0];
      }

      const hierarchicalMembers: HierarchicalMember[] = [];
      const visited = new Set<string>();

      const getGenLabel = (gen: number): string => {
        if (gen === 1) return 'ደረጃ 1 (መስራቲ)';
        if (gen === 2) return 'ደረጃ 2 (ውሉድ)';
        if (gen === 3) return 'ደረጃ 3 (ደቂ-ደቂ)';
        if (gen === 4) return 'ደረጃ 4 (ደቂ-ደቂ-ደቂ)';
        return `ደረጃ ${gen} (${gen}ይ ወለዶ)`;
      };

      // Recursive DFS for parent-child descent
      const traverse = (
        curr: Person,
        gen: number,
        parentPath: string[]
      ) => {
        if (visited.has(curr.id)) return;
        visited.add(curr.id);

        const spouses = spouseMap.get(curr.id) || [];
        const rawChildren = parentToChildrenMap.get(curr.id) || [];
        // Keep children in the branch, or include unbranched direct children
        const children = rawChildren.filter(
          (c) => !c.branch || c.branch.trim() === branchName
        );

        const lineagePath = [...parentPath, curr.canonicalName];

        hierarchicalMembers.push({
          person: curr,
          generation: gen,
          generationLabel: getGenLabel(gen),
          lineagePath,
          spouses,
          children,
          depth: gen - 1,
        });

        // Traverse children sequentially to preserve pedigree hierarchy
        for (const child of children) {
          traverse(child, gen + 1, lineagePath);
        }
      };

      // Start traversal from founder
      if (founder) {
        traverse(founder, 1, ['ከንቲባ ጉዕሽ']);
      }

      // Handle any branch members that weren't connected to the founder directly via parent_child
      const unvisited = branchMembers.filter((m) => !visited.has(m.id));
      for (const member of unvisited) {
        if (visited.has(member.id)) continue;

        // Try to estimate depth from fatherName
        let estimatedGen = 2;
        let parentPath = ['ከንቲባ ጉዕሽ', branchName];

        if (member.fatherName) {
          const matchedParent = hierarchicalMembers.find(
            (hm) =>
              hm.person.canonicalName.trim() === member.fatherName?.trim() ||
              hm.person.canonicalName.includes(member.fatherName || '')
          );
          if (matchedParent) {
            estimatedGen = matchedParent.generation + 1;
            parentPath = [...matchedParent.lineagePath];
          } else {
            parentPath.push(member.fatherName);
          }
        }

        traverse(member, estimatedGen, parentPath);
      }

      // Compute max generation in this branch
      const maxGen = hierarchicalMembers.reduce(
        (max, m) => Math.max(max, m.generation),
        1
      );

      return {
        name: branchName,
        theme,
        founder,
        totalMembers: hierarchicalMembers.length,
        hierarchicalMembers,
        maxGeneration: maxGen,
      };
    });
  }, [people, spouseMap, parentToChildrenMap]);

  // Filter branches according to selected tab and search term
  const filteredBranchData = useMemo(() => {
    let branches = branchData;

    if (selectedBranchFilter !== 'all') {
      branches = branches.filter((b) => b.name === selectedBranchFilter);
    }

    if (!searchQuery.trim()) {
      return branches;
    }

    const q = searchQuery.toLowerCase().trim();
    return branches.map((b) => {
      const filteredMembers = b.hierarchicalMembers.filter(
        (m) =>
          m.person.canonicalName.toLowerCase().includes(q) ||
          (m.person.fatherName && m.person.fatherName.toLowerCase().includes(q)) ||
          m.spouses.some((s) => s.person.canonicalName.toLowerCase().includes(q)) ||
          m.lineagePath.some((lp) => lp.toLowerCase().includes(q)) ||
          (m.person.notes && m.person.notes.toLowerCase().includes(q)) ||
          (m.person.spouseNote && m.person.spouseNote.toLowerCase().includes(q))
      );
      return {
        ...b,
        hierarchicalMembers: filteredMembers,
        totalMembers: filteredMembers.length,
      };
    });
  }, [branchData, selectedBranchFilter, searchQuery]);

  // Summary statistics
  const totalShownMembers = useMemo(() => {
    return filteredBranchData.reduce((acc, b) => acc + b.totalMembers, 0);
  }, [filteredBranchData]);

  const handlePrint = () => {
    window.print();
  };

  // Helper for generation color badge
  const renderGenerationBadge = (gen: number, label: string) => {
    if (gen === 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500 text-white shadow-sm border border-amber-600">
          <Sparkles className="w-3 h-3" />
          <span>{label}</span>
        </span>
      );
    }
    if (gen === 2) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white shadow-sm border border-emerald-700">
          <span>{label}</span>
        </span>
      );
    }
    if (gen === 3) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-600 text-white shadow-sm border border-sky-700">
          <span>{label}</span>
        </span>
      );
    }
    if (gen === 4) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-600 text-white shadow-sm border border-purple-700">
          <span>{label}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white shadow-sm border border-rose-700">
        <span>{label}</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:z-auto print:overflow-visible font-ethiopic">
      {/* Modal Card */}
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 max-w-6xl w-full max-h-[96vh] overflow-hidden flex flex-col print:border-none print:shadow-none print:max-w-none print:w-full print:max-h-none print:rounded-none">
        
        {/* Top Header - Hidden on Print */}
        <header className="px-5 py-4 bg-stone-900 text-white border-b border-stone-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 font-bold shadow-inner">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-amber-100">
                  ናይ ወለዶ መዝገብ ሕተም / ኣውርድ (PDF)
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 rounded-full">
                  ተዋረድ ወለዶ
                </span>
              </div>
              <p className="text-xs text-stone-400">
                ብተዋረድ ሰንሰለት ዝተሰርዐ፡ ብሕብርታት ዝተኸፋፈለ ወግዓዊ መዝገብ ስድራቤት ከንቲባ ጉዕሽ
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>ሕተም / ብፒዲኤፍ (PDF) ኣውርድ</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-stone-400 hover:text-white p-2 rounded-xl hover:bg-stone-800 transition-colors cursor-pointer"
              aria-label="ዕጾ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Toolbar: Branch Selection, View Mode & Search - Hidden on Print */}
        <div className="px-5 py-3 bg-stone-100 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
          {/* Branch Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full scrollbar-thin">
            <button
              type="button"
              onClick={() => setSelectedBranchFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedBranchFilter === 'all'
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              ኩሎም {allBranchNames.length} ጨናፍር ({people.length})
            </button>
            {allBranchNames.map((bName) => {
              const bTheme = BRANCH_THEMES[bName] || DEFAULT_THEME;
              const count = people.filter((p) => p.branch && p.branch.trim() === bName).length;
              const isSelected = selectedBranchFilter === bName;

              return (
                <button
                  key={bName}
                  type="button"
                  onClick={() => setSelectedBranchFilter(bName)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
                    isSelected
                      ? `${bTheme.badgeBg} ${bTheme.badgeText} ${bTheme.borderCol} ring-2 ring-stone-900/10 shadow-sm font-black`
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: bTheme.accentHex }}
                  />
                  <span>{bName}</span>
                  <span className="text-[10px] opacity-75 font-normal">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Right Controls: View Switcher and Search */}
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="ኣብ ውሽጢ ሰነድ ድለ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 w-36 sm:w-48 text-stone-800"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-white border border-stone-300 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="መልክዕ ሰንጠረዥ (Table View)"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ሰንጠረዥ</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('hierarchy')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                  viewMode === 'hierarchy'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="ተዋረድ ሓረግ (Tree View)"
              >
                <GitFork className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ተዋረድ ሓረግ</span>
              </button>
            </div>
          </div>
        </div>

        {/* Helpful Tip Banner for Printing - Screen only */}
        <div className="px-5 py-2 bg-amber-50/70 border-b border-amber-200/60 text-amber-900 text-[11px] flex items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>ምኽሪ ንሕትመት፦</strong> ኣብቲ ናይ ብራውዘር ሕትመት መስኮት (Print Dialog) <em>"Background graphics"</em> ወይ <em>"Print backgrounds"</em> ዝብል ኣብርህዎ ምእንቲ ሕብርታት ብግቡእ ኣብ ወረቐት/PDF ክሕተም።
            </span>
          </div>
          <span className="text-[10px] font-bold text-amber-800 shrink-0">
            ዝተመርጹ ኣባላት: {totalShownMembers}
          </span>
        </div>

        {/* Scrollable Printable Document Container */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 font-ethiopic text-stone-900 print:overflow-visible print:p-0">
          <article className="max-w-5xl mx-auto space-y-6 print:space-y-6">
            
            {/* Document Title Header */}
            <header className="text-center pb-6 border-b-2 border-stone-900 space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-950 text-xs font-black border border-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>ወግዓዊ መዝገብ ወለዶ ስድራቤት</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-950">
                ተወለድ እንዳቦይ ከንቲባ ጉዕሽ ሓጎስ
              </h1>
              <p className="text-sm sm:text-base text-stone-700 font-bold">
                ሓረግ ወለዶን ተዋረድ ሰንሰለትን {allBranchNames.length} ጨናፍር (መበቆል ዓዲ ሓሓይለ)
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-stone-500 pt-1">
                <span>ጠቕላላ ኣባላት: <strong>{people.length}</strong></span>
                <span>&bull;</span>
                <span>ብዝሒ ጨናፍር: <strong>{allBranchNames.length}</strong></span>
                <span>&bull;</span>
                <span>ዝተዳለወሉ ዕለት: <strong>{new Date().toLocaleDateString('en-GB')}</strong></span>
              </div>
            </header>

            {/* Patriarch Root Section */}
            <section className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50 via-stone-50 to-amber-50 border-2 border-amber-300 print:border-stone-500 space-y-2 print:bg-transparent">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-amber-950 font-black flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>ቀዳማይ መበቆል ኣቦሓጎ</span>
                </span>
                <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                  ደረጃ 1 - መበቆል
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-stone-950">
                {rootAncestor?.canonicalName || 'ከንቲባ ጉዕሽ ሓጎስ'}
              </h2>
              <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                ከንቲባ ጉዕሽ ሓጎስ፡ {allBranchNames.length} ውሉዳት ዝወለዱ ኮይኖም፡ እዚ ወግዓዊ ሰነድ እዚ ነቶም ካብዚኣቶም ዝተወልዱ ኩሎም ወለዶታት ብተዋረድ ሰንሰለት ኣሰናዲኡ የቅርብ።
              </p>
            </section>

            {/* Quick Branches Visual Index - Screen only or compact print */}
            {selectedBranchFilter === 'all' && (
              <section className="space-y-2.5 print:hidden">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" />
                  <span>{allBranchNames.length} ጨናፍር እንዳቦይ ከንቲባ ጉዕሽ</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  {branchData.map((b, i) => (
                    <div
                      key={b.name}
                      style={{ borderColor: b.theme.accentHex }}
                      className="p-2.5 rounded-xl border-2 bg-white flex flex-col justify-between shadow-2xs hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-stone-400">#{i + 1}</span>
                        <span
                          className="px-1.5 py-0.2 rounded-full text-[10px] font-bold text-white"
                          style={{ backgroundColor: b.theme.accentHex }}
                        >
                          {b.totalMembers} ኣባላት
                        </span>
                      </div>
                      <div className="mt-1 font-black text-stone-900 text-sm">
                        ጨንፈር {b.name}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Branches Descent Listings */}
            <div className="space-y-8 pt-2">
              {filteredBranchData.map((branch, branchIndex) => {
                const theme = branch.theme;

                return (
                  <section
                    key={branch.name}
                    className="rounded-2xl border-2 overflow-hidden print:border-stone-400 print:break-inside-avoid shadow-xs space-y-0"
                    style={{ borderColor: theme.accentHex }}
                  >
                    {/* Branch Header Banner */}
                    <div
                      className={`p-4 bg-gradient-to-r ${theme.headerGradient} text-white flex flex-wrap items-center justify-between gap-2`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="w-8 h-8 rounded-xl bg-white/20 border border-white/30 text-white font-black text-sm flex items-center justify-center shadow-inner">
                          {branchIndex + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
                              ጨንፈር {branch.name}
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/25 border border-white/30 text-white">
                              {branch.totalMembers} ኣባላት
                            </span>
                          </div>
                          <p className="text-xs text-white/80">
                            መስራቲ ጨንፈር: <strong>{branch.founder?.canonicalName || branch.name}</strong> &middot; ዝዓሞቐ ደረጃ ወለዶ: {branch.maxGeneration}
                          </p>
                        </div>
                      </div>

                      <div className="text-right text-xs text-white/90 font-medium hidden sm:block">
                        <span>ተወለድ ከንቲባ ጉዕሽ ሓጎስ</span>
                      </div>
                    </div>

                    {/* Branch Content: Table View vs Hierarchy Tree View */}
                    {branch.hierarchicalMembers.length === 0 ? (
                      <div className="p-8 text-center text-stone-400 text-xs italic bg-white">
                        ኣብዚ ጨንፈር ዝተመዝገበ ኣባል የለን ወይ ብዝተገብረ ፍተሻ ኣይተረኽበን።
                      </div>
                    ) : viewMode === 'table' ? (
                      /* Table View - Highly Structured, Legible & Color-Coded */
                      <div className="overflow-x-auto bg-white">
                        <table className="w-full text-left text-sm border-collapse font-ethiopic">
                          <thead>
                            <tr
                              className={`${theme.tableHeadBg} ${theme.tableHeadText} border-b-2 font-black text-xs sm:text-sm uppercase tracking-wider`}
                              style={{ borderBottomColor: theme.accentHex }}
                            >
                              <th className="py-3 px-3.5 text-center w-12 font-black border-r border-stone-200">
                                ተ.ቁ
                              </th>
                              <th className="py-3 px-3.5 w-32 border-r border-stone-200">
                                ደረጃ ወለዶ
                              </th>
                              <th className="py-3 px-3.5 min-w-[150px] border-r border-stone-200">
                                ምሉእ ስም
                              </th>
                              <th className="py-3 px-3.5 min-w-[220px] border-r border-stone-200">
                                ተዋረድ ሰንሰለት
                              </th>
                              <th className="py-3 px-3.5 w-32 border-r border-stone-200">
                                ወላዲ / ኣቦ
                              </th>
                              <th className="py-3 px-3.5 min-w-[140px] border-r border-stone-200">
                                መጻምድቲ / ሓዳር
                              </th>
                              <th className="py-3 px-3.5 min-w-[160px] border-r border-stone-200">
                                ውሉዳት
                              </th>
                              <th className="py-3 px-3.5 min-w-[130px]">
                                ዓዲ / መተሓሳሰቢ
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-200 text-stone-900">
                            {branch.hierarchicalMembers.map((member, mIdx) => {
                              const isEven = mIdx % 2 === 0;
                              const rowBg = isEven ? 'bg-white' : theme.lightBg;

                              return (
                                <tr
                                  key={member.person.id}
                                  className={`${rowBg} hover:bg-stone-50 transition-colors print:break-inside-avoid`}
                                >
                                  {/* 1. ተ.ቁ (Index) */}
                                  <td className="py-2.5 px-3 text-center font-bold text-stone-600 border-r border-stone-200 text-xs sm:text-sm">
                                    {mIdx + 1}
                                  </td>

                                  {/* 2. ደረጃ ወለዶ (Generation Badge with Depth indentation) */}
                                  <td className="py-2.5 px-3 border-r border-stone-200 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      {/* Visual depth guide */}
                                      {member.depth > 0 && (
                                        <span className="text-stone-400 font-mono text-xs font-bold">
                                          {'—'.repeat(Math.min(member.depth, 3))}↳
                                        </span>
                                      )}
                                      {renderGenerationBadge(member.generation, member.generationLabel)}
                                    </div>
                                  </td>

                                  {/* 3. ምሉእ ስም (Full Name) */}
                                  <td className="py-2.5 px-3 font-black text-stone-950 border-r border-stone-200 text-base sm:text-lg">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span>{member.person.canonicalName}</span>
                                      {member.person.gender === 'female' && (
                                        <span className="text-xs font-bold px-2 py-0.5 bg-rose-100 text-rose-900 rounded-md border border-rose-300">
                                          ኣንስትዮ
                                        </span>
                                      )}
                                      {member.person.gender === 'male' && (
                                        <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-900 rounded-md border border-blue-300">
                                          ተባዕታይ
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* 4. ተዋረድ ሰንሰለት (Descent Breadcrumb) */}
                                  <td className="py-2.5 px-3 border-r border-stone-200">
                                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                                      {member.lineagePath.map((step, pIdx) => {
                                        const isLast = pIdx === member.lineagePath.length - 1;
                                        return (
                                          <React.Fragment key={pIdx}>
                                            {pIdx > 0 && (
                                              <span className="text-stone-400 font-black text-xs">
                                                ›
                                              </span>
                                            )}
                                            <span
                                              className={`px-2 py-0.5 rounded-md ${
                                                isLast
                                                  ? 'font-black bg-stone-900 text-white text-xs'
                                                  : 'bg-stone-100 text-stone-800 text-xs border border-stone-300 font-bold'
                                              }`}
                                            >
                                              {step}
                                            </span>
                                          </React.Fragment>
                                        );
                                      })}
                                    </div>
                                  </td>

                                  {/* 5. ወላዲ / ኣቦ (Father/Parent) */}
                                  <td className="py-2.5 px-3 text-stone-900 font-bold border-r border-stone-200 text-xs sm:text-sm">
                                    {member.person.fatherName || '-'}
                                  </td>

                                  {/* 6. መጻምድቲ / ሓዳር (Spouse) */}
                                  <td className="py-2.5 px-3 border-r border-stone-200">
                                    {member.spouses.length > 0 ? (
                                      <div className="space-y-1">
                                        {member.spouses.map((s, sIdx) => (
                                          <div
                                            key={sIdx}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-950 border border-rose-300 text-xs font-bold"
                                          >
                                            <Heart className="w-3.5 h-3.5 text-rose-600 fill-rose-600" />
                                            <span>{s.person.canonicalName}</span>
                                          </div>
                                        ))}
                                        {member.person.spouseNote && (
                                          <p className="text-xs text-stone-600 italic leading-tight">
                                            {member.person.spouseNote}
                                          </p>
                                        )}
                                      </div>
                                    ) : member.person.spouseNote ? (
                                      <p className="text-xs text-stone-700 italic font-medium">
                                        {member.person.spouseNote}
                                      </p>
                                    ) : (
                                      <span className="text-stone-300">-</span>
                                    )}
                                  </td>

                                  {/* 7. ውሉዳት (Children) */}
                                  <td className="py-2.5 px-3 border-r border-stone-200">
                                    {member.children.length > 0 ? (
                                      <div className="space-y-1">
                                        <div className="inline-flex items-center gap-1 text-xs font-bold text-sky-950 bg-sky-100/90 px-2 py-0.5 rounded-lg border border-sky-300">
                                          <Baby className="w-3.5 h-3.5 text-sky-700" />
                                          <span>{member.children.length} ውሉዳት</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1 text-xs font-semibold">
                                          {member.children.map((child, cIdx) => (
                                            <span
                                              key={cIdx}
                                              className="bg-stone-100 text-stone-800 px-2 py-0.5 rounded-md border border-stone-300"
                                            >
                                              {child.canonicalName}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-stone-300">-</span>
                                    )}
                                  </td>

                                  {/* 8. ዓዲ / መተሓሳሰቢ (Village / Notes) */}
                                  <td className="py-2.5 px-3 text-xs sm:text-sm text-stone-700 font-medium">
                                    {cleanDisplayNote(member.person.notes) ? (
                                      <span className="line-clamp-2">{cleanDisplayNote(member.person.notes)}</span>
                                    ) : (
                                      <span className="text-stone-400">ዓዲ ሓሓይለ</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      /* Hierarchy Tree Cards View */
                      <div className="p-4 sm:p-6 bg-white space-y-3">
                        {branch.hierarchicalMembers.map((member) => {
                          const indentPx = Math.min(member.depth * 20, 100);

                          return (
                            <div
                              key={member.person.id}
                              style={{ marginLeft: `${indentPx}px` }}
                              className="p-3 rounded-xl border border-stone-200 bg-stone-50/60 hover:bg-stone-50 transition-colors print:break-inside-avoid relative"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/70 pb-2 mb-2">
                                <div className="flex items-center gap-2">
                                  {renderGenerationBadge(member.generation, member.generationLabel)}
                                  <h4 className="font-black text-stone-900 text-sm sm:text-base">
                                    {member.person.canonicalName}
                                  </h4>
                                  {member.person.fatherName && (
                                    <span className="text-xs text-stone-500">
                                      (ወዲ/ጓል: {member.person.fatherName})
                                    </span>
                                  )}
                                </div>

                                <div className="text-[11px] text-stone-500 font-medium">
                                  ሰንሰለት: {member.lineagePath.join(' › ')}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div>
                                  {member.spouses.length > 0 ? (
                                    <div className="text-rose-900 font-medium">
                                      መጻምድቲ:{' '}
                                      <strong>
                                        {member.spouses.map((s) => s.person.canonicalName).join('፣ ')}
                                      </strong>
                                      {member.person.spouseNote && (
                                        <p className="text-[10px] text-stone-500 italic mt-0.5">
                                          {member.person.spouseNote}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-stone-400 italic">መጻምድቲ: ኣይተመዝገበን</div>
                                  )}
                                </div>

                                <div>
                                  {member.children.length > 0 ? (
                                    <div className="text-sky-900 font-medium">
                                      ውሉዳት ({member.children.length}):{' '}
                                      <strong>
                                        {member.children.map((c) => c.canonicalName).join('፣ ')}
                                      </strong>
                                    </div>
                                  ) : (
                                    <div className="text-stone-400 italic">ውሉዳት: የለን</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Branch Summary Footer */}
                    <div className="px-4 py-2 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
                      <span>
                        ጠቕላላ ተመዝገብቲ ጨንፈር <strong>{branch.name}</strong>: {branch.totalMembers}
                      </span>
                      <span>
                        ዝተፈተሸ ወግዓዊ መዝገብ ወለዶ
                      </span>
                    </div>
                  </section>
                );
              })}
            </div>

            {/* Official Certification Footer */}
            <footer className="pt-8 pb-4 border-t-2 border-stone-900 text-center text-xs text-stone-600 space-y-2 print:pt-6">
              <div className="flex items-center justify-center gap-2 font-bold text-stone-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>ተወለድ እንዳቦይ ከንቲባ ጉዕሽ ሓጎስ &middot; ወግዓዊ ዲጂታል መዝገብ ወለዶ</span>
              </div>
              <p className="text-[11px] text-stone-500 max-w-xl mx-auto leading-relaxed">
                እዚ ሰነድ እዚ ካብቲ ዝተጻረየን ዝተረጋገጸን ናይ እንዳቦይ ከንቲባ ጉዕሽ ሓጎስ ዲጂታል መዝገብ ብትክክል ዝተሓትመ ወግዓዊ ሰነድ ስድራቤት እዩ።
              </p>
              <div className="text-[10px] text-stone-400 pt-1">
                ዕለት: {new Date().toLocaleDateString('en-GB')} &middot; ሕትመት ስሪት 3.0 &middot; ዓዲ ሓሓይለ
              </div>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
};
