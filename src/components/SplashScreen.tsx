import React, { useEffect, useRef, useState } from 'react';
import { AppIcon } from './ui/AppIcon';
import { useTranslation } from '../utils/i18n';

interface SplashScreenProps {
  onComplete: () => void;
  autoDismissMs?: number;
}

/**
 * SplashScreen: white background, logo navy with an orange accent, gentle fade + scale-in (400ms).
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  autoDismissMs = 2000,
}) => {
  const { isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');
  const [isFadingOut, setIsFadingOut] = useState(false);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    autoTimerRef.current = setTimeout(() => {
      autoTimerRef.current = null;
      setIsFadingOut(true);
      fadeTimerRef.current = setTimeout(() => {
        fadeTimerRef.current = null;
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current();
        }
      }, 400);
    }, autoDismissMs);

    return () => {
      if (autoTimerRef.current !== null) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      if (fadeTimerRef.current !== null) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
    };
  }, [autoDismissMs]);

  const handleSkip = () => {
    if (completedRef.current) return;
    if (autoTimerRef.current !== null) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    if (fadeTimerRef.current !== null) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    setIsFadingOut(true);
    fadeTimerRef.current = setTimeout(() => {
      fadeTimerRef.current = null;
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
    }, 200);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Loading Classy"
      className={`fixed inset-0 z-50 flex flex-col justify-between bg-page text-navy transition-opacity duration-400 select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Top Bar with gentle Skip */}
      <div className="flex items-center justify-between p-6 pt-8">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-mint-soft text-navy border border-line text-[11px] font-bold">
          <span className="w-2 h-2 rounded-full bg-teal animate-pulse" />
          <span>{isEn ? 'Teacher Edition' : 'إصدار المعلم'}</span>
        </div>

        <button
          type="button"
          onClick={handleSkip}
          className="text-xs text-slate hover:text-navy px-3 py-1.5 rounded-full hover:bg-mint-soft transition-colors cursor-pointer"
        >
          {isEn ? 'Skip' : 'تخطي'}
        </button>
      </div>

      {/* Center Logo: navy with an orange accent, gentle fade + scale-in (400ms) */}
      <div className="flex flex-col items-center justify-center text-center px-6 py-4 flex-1 animate-pop-in duration-400">
        <div className="relative mb-4">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[28px] bg-mint-soft border border-line flex items-center justify-center text-navy shadow-white">
            <AppIcon name="teacher" size={54} weight="duotone" />
          </div>
          {/* Orange accent indicator */}
          <div className="absolute -bottom-1 -end-1 w-7 h-7 rounded-full bg-orange text-white flex items-center justify-center shadow-orange border-2 border-page">
            <AppIcon name="sparkles" size={14} weight="fill" />
          </div>
        </div>

        <div className="space-y-1.5 max-w-xs mx-auto">
          <h1 className="t-display text-navy flex items-center justify-center gap-2">
            <span>Classy</span>
            <span className="text-orange">•</span>
            {!isEn && <span className="font-bold">كلاسي</span>}
          </h1>
          <p className="t-meta text-slate text-xs leading-relaxed">
            {isEn
              ? 'Smart Tuition & Financial Management for Tutors'
              : 'منظومة المعلم الذكية لإدارة الحصص والطلاب'}
          </p>
        </div>
      </div>

      {/* Bottom Loading Indicator */}
      <div className="p-6 pb-8 flex flex-col items-center justify-center gap-2">
        <div className="w-36 h-1 rounded-full bg-mint-soft overflow-hidden">
          <div className="w-full h-full bg-orange rounded-full animate-loading-bar" />
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
