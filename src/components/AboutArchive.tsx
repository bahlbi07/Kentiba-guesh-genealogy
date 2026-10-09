import React from 'react';
import { BookOpen, ShieldCheck, FileText, Users, Award, ExternalLink, Calendar, MapPin, CheckCircle2 } from 'lucide-react';

export const AboutArchive: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4 sm:py-6">
      {/* Hero Header */}
      <div className="bg-linear-to-b from-stone-900 to-stone-850 text-white p-6 sm:p-8 rounded-3xl shadow-lg border border-stone-800 space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-medium border border-amber-500/30">
          <BookOpen className="w-3.5 h-3.5" />
          <span>ታሪኽን መበቆልን ቤተሰብ (Historical Family Archive)</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold font-ethiopic tracking-tight text-amber-100">
          ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ
        </h1>
        <p className="text-stone-350 text-sm sm:text-base leading-relaxed max-w-2xl font-ethiopic">
          እዚ ዲጂታል መዝገብ እዚ፡ ነቲ ብኢድ ዝተጻሕፈ ታሪኻዊ ሰነድ ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ ብዘይ ዝኾነ ምቅያር ወይ ምድብላቕ፡ ብትኽክል ንመጻኢ ወለዶታት ተሓልዩ ክጸንሕ ዝተዳለወ ወግዓዊ መዝገብ እዩ።
        </p>
      </div>

      {/* Scribe and Primary Source Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 font-ethiopic text-lg">ጸሓፊ እቲ ሰነድ (The Scribe)</h3>
              <p className="text-xs text-stone-500">ካብ ዋና ምንጪ ገጽ 29 ዝተወሰደ</p>
            </div>
          </div>
          <blockquote className="p-3 bg-amber-50/70 border-l-4 border-amber-600 rounded-r-lg font-ethiopic text-stone-800 text-sm italic">
            &ldquo;ጸሓፊ ከሰተ ብርሃነ ወልዱ ወዲ ጎብሩ ካብ ጁባ ደቡብ ሱዳን&rdquo;
          </blockquote>
          <p className="text-xs text-stone-600 leading-relaxed font-ethiopic">
            ከሰተ ብርሃነ ወልዱ፡ ነዚ ታሪኻዊ ሓረግ ወለዶ ካብ ዝተፈላለዩ ዓበይቲ ዓድን ወለድን ብምእካብ፡ ብጽኑዕ ድኻምን ጥንቃቐን ኣብ ከተማ ጁባ (ደቡብ ሱዳን) ጽሒፉ ዘዳለዎ ዓቢ ውርሻ እዩ።
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 font-ethiopic text-lg">ቀዳማይ ምንጪ ሰነድ (Primary Source)</h3>
              <p className="text-xs text-stone-500">ከሰተ-ብርሃነ.pdf (36 ገጻት)</p>
            </div>
          </div>
          <p className="text-xs text-stone-600 leading-relaxed font-ethiopic">
            እቲ መበቆላዊ ሰነድ 36 ገጻት ዘለዎ ኾይኑ፡ ካብ ገጽ 1 ክሳብ 29 ዝተዘርግሐ ዝርዝር ስድራቤታት ይርከቦ። ገጻት 30 ክሳብ 35 ጌጣጌጣዊ መስመራት ዘለዎም ኾይኖም፡ ኣብ ገጽ 36 ድማ ሓደ መበገሲ ኣርእስቲ ይርከብ።
          </p>
          <div className="pt-2 flex items-center gap-3 text-xs text-stone-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              100% ዝተመርመረ
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ዘይተደባለቐ ፊደላት
            </span>
          </div>
        </div>
      </div>

      {/* Preservation Philosophy and Principles */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <h2 className="text-xl font-bold text-stone-900 font-ethiopic flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-amber-700" />
          <span>መትከላት ምዕቃብ ታሪኽ (Guiding Archival Principles)</span>
        </h2>

        <div className="space-y-3 text-sm text-stone-700 font-ethiopic leading-relaxed">
          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              1
            </div>
            <div>
              <strong className="text-stone-900">ተመሳሰልቲ ኣስማት ዘይምድብላቕ (Zero Merging):</strong>
              <p className="text-stone-600 text-xs mt-0.5">
                ኣብ ልምዲ ኣሰያይማ ትግርኛ፡ ስም ኣቦሓጎ ወይ ኣሞ/ሓወቦ ናብ ደቆም ምውራድ ልሙድ እዩ። ኣብዚ መዝገብ 92 ተመሳሰልቲ ኣስማት ዝተረኽቡ ኮይኖም፡ ነፍሲ ወከፎም ፍሉይ ናይ መንነት መለለዪ ቁጽሪ ተዋሂብዎም ከይተደባለቑ ተዓቂቦም ኣለዉ።
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              2
            </div>
            <div>
              <strong className="text-stone-900">ምንጪን ገጽን ምዕቃብ (Provenance Preservation):</strong>
              <p className="text-stone-600 text-xs mt-0.5">
                ነፍሲ ወከፍ ሰብን ዝምድናን ካብ ኣየናይ ገጽ ናይቲ መበቆላዊ PDF ከምዝተረኽበን፡ እቲ ጸሓፊ ዝተጠቀመሉ ቃል ብቃሉ ተመዝጊቡ ይርከብ።
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              3
            </div>
            <div>
              <strong className="text-stone-900">ዝምድና ብግምት ዘይምፍጣር (No Assumed Relationships):</strong>
              <p className="text-stone-600 text-xs mt-0.5">
                ኣብቲ ሰነድ ዘይተጻሕፈ ናይ ወለዲ ወይ ሓዳር ዝምድና ብግምት ኣይፍጠርን። ንጹር ዘይኮኑ መዛግብቲ ንምምርማር ተባሂሎም ፍሉይ ምልክት ተገይሩሎም ይጽንሑ።
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

