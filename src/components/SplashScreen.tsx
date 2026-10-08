import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowLeft, ArrowRight } from 'lucide-react';
import { ClassyOwlMascot } from './ClassyOwlMascot';
import { useTranslation } from '../utils/i18n';

interface SplashScreenProps {
  onComplete: () => void;
  autoDismissMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  autoDismissMs = 2400,
}) => {
  const { isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');
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
      className={`fixed inset-0 z-50 flex flex-col justify-between bg-gradient-to-br from-[#293828] via-[#0F1206] to-[#0F1206] text-[#F8F2EC] transition-opacity duration-500 overflow-hidden select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Ambient background glow & shapes */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#DDD3C7]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-0 w-96 h-96 bg-[#756046]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] bg-[#F8F2EC]/8 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar with Skip */}
      <div className="relative z-10 flex items-center justify-between p-6 pt-8">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F8F2EC]/10 backdrop-blur-md border border-[#DDD3C7]/30 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#F8F2EC] animate-ping" />
          <span className="text-[11px] font-bold text-[#F8F2EC]/95">
            {isEn ? 'Smart Teacher Edition' : 'إصدار المعلم الذكي'}
          </span>
        </div>

        <button
          onClick={handleSkip}
          className="text-xs text-[#DDD3C7] hover:text-[#F8F2EC] flex items-center gap-1 font-medium transition-colors cursor-pointer px-3 py-1.5 rounded-xl bg-[#F8F2EC]/5 hover:bg-[#F8F2EC]/10 border border-[#DDD3C7]/25"
        >
          <span>{isEn ? 'Skip' : 'تخطي'}</span>
          {isRTL ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Center Illustrated Mascot & Hero Graphic */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-4 flex-1 animate-in zoom-in-95 duration-700">
        
        {/* Organic Shaped Illustrated Card Canvas */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center mb-6">
          {/* Circular layered aura */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#DDD3C7]/25 via-[#F8F2EC]/10 to-[#756046]/25 animate-spin-slow blur-md" />
          <div className="absolute inset-4 rounded-full bg-gradient-to-b from-[#0F1206] to-[#293828] border border-[#DDD3C7]/35 shadow-2xl flex items-center justify-center overflow-hidden">
            {/* Soft inner radial gradient */}
            <div className="absolute inset-0 bg-radial from-[#F8F2EC]/15 via-transparent to-transparent" />
            
            {/* The Classy Owl Mascot */}
            <div className="relative z-10 animate-bounce-subtle">
              <ClassyOwlMascot size="hero" glow={true} pose="waving" />
            </div>
          </div>

          {/* Floating badge chips */}
          <div className="absolute top-2 right-2 px-3.5 py-1 rounded-2xl bg-[#F8F2EC] text-[#764F26] text-[11px] font-black shadow-lg shadow-[#0F1206]/40 flex items-center gap-1 border border-[#DDD3C7]/60 animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-[#764F26]" />
            <span>Classy v3.0</span>
          </div>

          <div className="absolute bottom-4 left-0 px-3.5 py-1 rounded-2xl bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] text-[10px] font-bold shadow-lg shadow-[#0F1206]/40 border border-[#DDD3C7]/35">
            <span>{isEn ? '🎓 Professional Tutor' : '🎓 المعلم المحترف'}</span>
          </div>
        </div>

        {/* Title & Slogan */}
        <div className="space-y-2 max-w-xs mx-auto">
          <h1 className="text-3xl sm:text-4xl font-black text-[#F8F2EC] tracking-tight flex items-center justify-center gap-2">
            {!isEn && <span>كلاسي</span>}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F8F2EC] via-[#DDD3C7] to-[#F8F2EC] font-black">
              Classy
            </span>
          </h1>
          <p className="text-xs text-[#DDD3C7] font-medium leading-relaxed">
            {isEn
              ? 'Comprehensive Management for Students, Groups, Lessons & Smart Accounts'
              : 'المنظومة المتطورة لإدارة الطلاب، المجموعات، الحصص، والمحاسبة الذكية'}
          </p>
        </div>
      </div>

      {/* Bottom Loading Indicator & Wave Footer */}
      <div className="relative z-10 p-6 pb-8 flex flex-col items-center justify-center gap-3">
        <div className="w-48 h-1.5 rounded-full bg-[#F8F2EC]/15 overflow-hidden p-0.5">
          <div className="w-full h-full bg-gradient-to-r from-[#DDD3C7] via-[#F8F2EC] to-[#DDD3C7] rounded-full animate-loading-bar" />
        </div>
        <span className="text-[11px] text-[#DDD3C7]/80 font-medium">
          {isEn ? 'Synchronizing teacher data with cloud...' : 'جاري مزامنة بيانات المعلم السحابية...'}
        </span>
      </div>
    </div>
  );
};
