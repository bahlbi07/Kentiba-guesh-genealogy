import React, { useMemo } from 'react';
import { Person, Relationship } from '../types/genealogy';
import { X, Printer, Download, BookOpen, GitFork } from 'lucide-react';

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
  'ይሕደጋ',
  'ብስራት',
  'ትዕበ',
  'በርሀ',
  'መድሂን',
];

export const GenealogyPdfExportModal: React.FC<GenealogyPdfExportModalProps> = ({
  people,
  relationships,
  onClose,
}) => {
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

  // Group descendants by the 10 official branches
  const branchData = useMemo(() => {
    return OFFICIAL_BRANCH_ORDER.map((branchName) => {
      // Find branch founder
      const founder = people.find(
        (p) =>
          p.canonicalName.trim() === branchName ||
          (p.canonicalName.includes(branchName) && (!p.fatherName || p.fatherName.includes('ከንቲባ')))
      );

      // Collect all people assigned to this branch
      const branchMembers = people.filter(
        (p) => p.branch && p.branch.trim() === branchName
      );

      return {
        name: branchName,
        founder,
        totalMembers: branchMembers.length,
        members: branchMembers,
      };
    });
  }, [people]);

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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:z-auto print:overflow-visible">
      {/* Modal Dialog Box */}
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 max-w-4xl w-full max-h-[94vh] overflow-hidden flex flex-col print:border-none print:shadow-none print:max-w-none print:w-full print:max-h-none print:rounded-none">
        {/* Header - Screen only */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-ethiopic text-amber-100">
                ናይ ወለዶ ሰነድ ምሕታምን ምውራድን (Print / Export PDF)
              </h2>
              <p className="text-xs text-stone-400 font-ethiopic">
                ንሕትመት ዝተዳለወ ምሉእ መዝገብ ወለዶ ከንቲባ ጉዕሽ ሓጎስ
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold font-ethiopic flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>ሕተም / ኣውርድ (PDF)</span>
            </button>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors"
              aria-label="ዕጾ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 sm:p-10 overflow-y-auto flex-1 font-ethiopic text-stone-900 print:overflow-visible print:p-0">
          <article className="max-w-3xl mx-auto space-y-8 print:space-y-6">
            {/* Document Title Header */}
            <header className="text-center pb-6 border-b-2 border-stone-900 space-y-2">
              <div className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold mb-1 print:hidden">
                ወግዓዊ መዝገብ ስድራቤት
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-950">
                ተወለድ እንዳቦይ ከንትባ ጉዕሽ
              </h1>
              <p className="text-base text-stone-700 font-semibold">
                ሓረግ ወለዶ ከንቲባ ጉዕሽ ሓጎስን 10 ጨናፍሮምን
              </p>
              <p className="text-xs text-stone-500 pt-1">
                ምሉእ ቁጽሪ ኣባላት: {people.length} &middot; ዝተዳለወሉ ዕለት: {new Date().toLocaleDateString()}
              </p>
            </header>

            {/* Patriarch Section */}
            <section className="bg-stone-50 print:bg-transparent p-5 rounded-2xl border border-stone-200 print:border-stone-400 space-y-2">
              <span className="text-xs uppercase tracking-wider text-amber-900 font-bold block">
                ቀዳማይ ኣቦሓጎ (Patriarch)
              </span>
              <h2 className="text-xl font-bold text-stone-950">
                {rootAncestor?.canonicalName || 'ከንቲባ ጉዕሽ ሓጎስ'}
              </h2>
              <p className="text-xs text-stone-700 leading-relaxed">
                ከንቲባ ጉዕሽ ሓጎስ፡ 10 ውሉዳት (5 ደቂ ተባዕትዮን 5 ደቂ ኣንስትዮን) ዝወለዱ ኮይኖም፡ እዚ ሰነድ እዚ ነቶም ካብዚኣቶም ዝተወልዱ ኩሎም ወለዶታት የጠቃልል።
              </p>
            </section>

            {/* 10 Branches Grid Summary */}
            <section className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 border-b border-stone-200 pb-1">
                10 ጨናፍር እንዳቦይ ከንትባ ጉዕሽ
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {OFFICIAL_BRANCH_ORDER.map((name, i) => (
                  <div
                    key={name}
                    className="p-2.5 rounded-xl border border-stone-200 print:border-stone-300 bg-white"
                  >
                    <span className="text-[10px] text-stone-500 block">ጨንፈር {i + 1}</span>
                    <strong className="text-stone-900 text-sm block">{name}</strong>
                  </div>
                ))}
              </div>
            </section>

            {/* Detailed Branches and Descendants */}
            <section className="space-y-8 pt-4">
              {branchData.map((branch, index) => {
                const founderChildren = branch.founder
                  ? parentToChildrenMap.get(branch.founder.id) || []
                  : [];

                return (
                  <div
                    key={branch.name}
                    className="p-5 rounded-2xl border border-stone-200 print:border-stone-400 space-y-4 break-inside-avoid"
                  >
                    <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                      <div className="flex items-center space-x-2">
                        <span className="w-7 h-7 rounded-lg bg-stone-900 text-white font-bold text-xs flex items-center justify-center">
                          {index + 1}
                        </span>
                        <h4 className="text-lg font-bold text-stone-900">
                          ጨንፈር {branch.name}
                        </h4>
                      </div>
                      <span className="text-xs text-stone-600 font-semibold">
                        {branch.totalMembers} ኣባላት
                      </span>
                    </div>

                    {/* Descendants List */}
                    <div className="space-y-2 text-xs">
                      {branch.members.length === 0 ? (
                        <p className="text-stone-400 italic">ዝተመዝገበ ኣባል የለን።</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {branch.members.map((member) => {
                            const memberSpouses = spouseMap.get(member.id) || [];
                            const memberChildren = parentToChildrenMap.get(member.id) || [];

                            return (
                              <div
                                key={member.id}
                                className="p-2.5 rounded-xl bg-stone-50 print:bg-white border border-stone-200 print:border-stone-300"
                              >
                                <div className="font-bold text-stone-900 text-sm">
                                  {member.canonicalName}
                                </div>
                                {member.fatherName && (
                                  <div className="text-stone-600 text-[11px]">
                                    ኣቦ: {member.fatherName}
                                  </div>
                                )}
                                {memberSpouses.length > 0 && (
                                  <div className="text-amber-900 text-[11px] mt-0.5">
                                    መጻምድቲ: {memberSpouses.map((s) => s.person.canonicalName).join('፣ ')}
                                  </div>
                                )}
                                {memberChildren.length > 0 && (
                                  <div className="text-stone-500 text-[11px] mt-0.5">
                                    ውሉዳት ({memberChildren.length}):{' '}
                                    {memberChildren.map((c) => c.canonicalName).join('፣ ')}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Footer Certification */}
            <footer className="pt-6 border-t-2 border-stone-900 text-center text-xs text-stone-600 space-y-1">
              <p className="font-bold text-stone-800">
                ተወለድ እንዳቦይ ከንትባ ጉዕሽ &middot; ወግዓዊ መዝገብ ወለዶ
              </p>
              <p className="text-[11px] text-stone-500">
                እዚ ሰነድ ካብቲ ዲጂታል መዝገብ ብትክክል ዝተሓትመ ወግዓዊ ሰነድ ስድራቤት እዩ።
              </p>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
};
