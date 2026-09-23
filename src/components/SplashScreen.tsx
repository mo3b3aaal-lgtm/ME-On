import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { ClassyOwlMascot } from './ClassyOwlMascot';

interface SplashScreenProps {
  onComplete: () => void;
  autoDismissMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  autoDismissMs = 2400,
}) => {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(onComplete, 500);
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [autoDismissMs, onComplete]);

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(onComplete, 300);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between bg-[#14152C] text-white transition-opacity duration-500 overflow-hidden select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      dir="rtl"
    >
      {/* Ambient background glow & shapes */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#7B61FF]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-0 w-80 h-80 bg-[#FF5E62]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#38B6FF]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar with Skip */}
      <div className="relative z-10 flex items-center justify-between p-6 pt-8">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15">
          <span className="w-2 h-2 rounded-full bg-[#FF5E62] animate-ping" />
          <span className="text-[11px] font-bold text-white/90">إصدار المعلم الذكي</span>
        </div>

        <button
          onClick={handleSkip}
          className="text-xs text-white/60 hover:text-white flex items-center gap-1 font-medium transition-colors cursor-pointer"
        >
          <span>تخطي</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center Illustrated Mascot & Hero Graphic */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-4 flex-1 animate-in zoom-in-95 duration-700">
        
        {/* Organic Shaped Illustrated Card Canvas (like the reference left card) */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center mb-6">
          {/* Circular layered aura */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#7B61FF]/25 via-white/5 to-[#FF5E62]/25 animate-spin-slow blur-md" />
          <div className="absolute inset-4 rounded-full bg-[#1C1D38] border border-white/10 shadow-2xl flex items-center justify-center overflow-hidden">
            {/* Soft inner radial gradient */}
            <div className="absolute inset-0 bg-radial from-[#7B61FF]/20 via-transparent to-transparent" />
            
            {/* The Classy Owl Mascot */}
            <div className="relative z-10 animate-bounce-subtle">
              <ClassyOwlMascot size="hero" glow={true} pose="waving" />
            </div>
          </div>

          {/* Floating badge chips */}
          <div className="absolute top-2 right-2 px-3 py-1 rounded-2xl bg-gradient-to-r from-[#FF5E62] to-[#FF758C] text-white text-[11px] font-bold shadow-lg shadow-[#FF5E62]/40 flex items-center gap-1 animate-pulse">
            <Sparkles className="w-3 h-3" />
            <span>Classy v3.0</span>
          </div>

          <div className="absolute bottom-4 left-0 px-3 py-1 rounded-2xl bg-[#7B61FF] text-white text-[10px] font-bold shadow-lg shadow-[#7B61FF]/30">
            <span>🎓 المعلم المحترف</span>
          </div>
        </div>

        {/* Title & Slogan */}
        <div className="space-y-2 max-w-xs mx-auto">
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            <span>كلاسي</span>
            <span className="text-[#FF758C] font-black tracking-normal">Classy</span>
          </h1>
          <p className="text-xs text-slate-300 font-medium leading-relaxed">
            المنظومة المتكاملة لإدارة الطلاب، المجموعات، الحصص، والمحاسبة الذكية
          </p>
        </div>
      </div>

      {/* Bottom Loading Indicator & Wave Footer */}
      <div className="relative z-10 p-6 pb-8 flex flex-col items-center justify-center gap-3">
        {/* Pulsing loading bar */}
        <div className="w-44 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="w-full h-full bg-gradient-to-r from-[#7B61FF] via-[#FF5E62] to-[#38B6FF] rounded-full animate-loading-bar" />
        </div>
        <span className="text-[11px] text-white/50 font-medium">جاري تجهيز بيانات المعلم السحابية...</span>
      </div>
    </div>
  );
};
