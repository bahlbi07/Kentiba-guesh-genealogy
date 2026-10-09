import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  useEffect(() => {
    // Check if dismissed before
    const isDismissed = sessionStorage.getItem('pwa_prompt_dismissed');
    if (isDismissed) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone?: boolean }).standalone;

    if (isIosDevice && !isStandalone) {
      setIsIos(true);
      setShowPrompt(true);
    }

    // Android / Desktop beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosInstructions(true);
      return;
    }

    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIosInstructions(false);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <>
      {/* Install Banner */}
      <aside aria-label="Mobile application installation" className="fixed bottom-18 md:bottom-4 right-4 left-4 md:left-auto md:max-w-md z-50 bg-stone-900 text-white p-3.5 sm:p-4 rounded-2xl border border-amber-500/40 shadow-2xl flex items-center justify-between gap-3 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white shrink-0 font-bold font-ethiopic">
            ጉ
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-amber-200 font-ethiopic">
              ኣብ ሞባይልኩም ኣእትዉ (Install App)
            </h4>
            <p className="text-[11px] text-stone-300">
              ንቕልጡፍ ምጥቃምን ብዘይ ኢንተርኔት ንምርኣይን
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 min-h-[36px] bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg transition-colors"
            aria-label="Dismiss install prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* iOS Instructions Modal */}
      {showIosInstructions && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-stone-900 max-w-sm w-full p-5 rounded-2xl shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-700" />
                <span>iPhone / iPad Setup</span>
              </h3>
              <button
                onClick={() => setShowIosInstructions(false)}
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ol className="space-y-3 text-xs sm:text-sm text-stone-700 font-ethiopic list-decimal list-inside">
              <li>
                ኣብ Safari ናይ <strong>Share</strong> ምልክት (<Share className="w-4 h-4 inline text-amber-700" />) ጠውቑ።
              </li>
              <li>
                ንታሕቲ ብምውራድ <strong>&ldquo;Add to Home Screen&rdquo;</strong> (ናብ ዋና ገጽ ወስኽ) ዝብል ምረጹ።
              </li>
              <li>
                ኣብ ላዕሊ <strong>&ldquo;Add&rdquo;</strong> ጠውቑ። እታ ኣፕሊኬሽን ኣብ ሞባይልኩም ከም ናጻ ኣፕ ክትኣቱ እያ።
              </li>
            </ol>

            <button
              onClick={() => setShowIosInstructions(false)}
              className="w-full py-2 bg-stone-900 text-white rounded-xl text-xs font-bold"
            >
              ተረዲአ ኣለኹ (Close)
            </button>
          </div>
        </div>
      )}
    </>
  );
};

