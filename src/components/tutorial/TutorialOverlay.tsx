import React, { useId, useLayoutEffect, useRef, useState, useEffect } from 'react';
import { ModalPortal } from '../../contexts/ModalContext';
import { AppIcon } from '../ui/AppIcon';
import { useTranslation } from '../../utils/i18n';
import { triggerLightHaptic } from '../../utils/haptics';
import type { TargetBounds } from './tutorialRegistry';
import type {
  TutorialChapterDefinition,
  TutorialStepDefinition,
} from './tutorialSteps';

interface TutorialOverlayProps {
  chapter: TutorialChapterDefinition;
  step: TutorialStepDefinition;
  stepIndex: number;
  totalChapterSteps: number;
  globalStepNumber: number;
  totalGlobalSteps: number;
  isSingleChapterMode: boolean;
  canGoBack: boolean;
  isLastStepInRun: boolean;
  bounds: TargetBounds | null;
  isSearchingTarget: boolean;
  isTargetMissing: boolean;
  isActionCompleted: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSkipStep: () => void;
  onSkipChapter: () => void;
  onRetryTarget: () => void;
  onPerformShowMe: () => void;
  onRunPracticeAction: () => void;
  onOpenChapterHub: () => void;
  onExitTour: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  chapter,
  step,
  stepIndex,
  totalChapterSteps,
  globalStepNumber,
  totalGlobalSteps,
  isSingleChapterMode,
  canGoBack,
  isLastStepInRun,
  bounds,
  isSearchingTarget,
  isTargetMissing,
  isActionCompleted,
  onPrev,
  onNext,
  onSkipStep,
  onSkipChapter,
  onRetryTarget,
  onPerformShowMe,
  onRunPracticeAction,
  onOpenChapterHub,
  onExitTour,
}) => {
  const { language, isRTL } = useTranslation();
  const isEn = language.startsWith('en');
  const maskId = useId().replace(/:/g, '_');

  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [cardHeight, setCardHeight] = useState(230);
  const [viewport, setViewport] = useState<{ w: number; h: number }>(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 400,
    h: typeof window !== 'undefined' ? window.innerHeight : 820,
  }));

  // Reset minimize state whenever moving to a new step
  useEffect(() => {
    setIsMinimized(false);
  }, [step.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const measured = cardRef.current.offsetHeight;
    if (measured > 0 && Math.abs(measured - cardHeight) > 2) {
      setCardHeight(measured);
    }
  });

  const vw = viewport.w;
  const vh = viewport.h;
  const pad = 7;

  // Clamp spotlight cutout cleanly inside viewport
  const cutout = bounds
    ? (() => {
        const rawLeft = Math.max(4, bounds.left - pad);
        const rawTop = Math.max(4, bounds.top - pad);
        const rawRight = Math.min(vw - 4, bounds.right + pad);
        const rawBottom = Math.min(vh - 4, bounds.bottom + pad);
        return {
          left: rawLeft,
          top: rawTop,
          width: Math.max(24, rawRight - rawLeft),
          height: Math.max(24, rawBottom - rawTop),
          bottom: rawBottom,
        };
      })()
    : null;

  // Compute responsive card position that avoids covering the highlighted control
  const cardWidth = Math.min(vw - 24, 404);
  const safeTopEdge = 12;
  const safeBottomEdge = 14;

  let cardTop: number;
  if (isMinimized) {
    cardTop = Math.max(safeTopEdge, vh - cardHeight - safeBottomEdge);
  } else if (!cutout) {
    cardTop = Math.max(safeTopEdge, Math.round((vh - cardHeight) / 2));
  } else {
    const isLargeModalSection = cutout.height > vh * 0.48;
    const spaceBelow = vh - cutout.bottom - safeBottomEdge;
    const spaceAbove = cutout.top - safeTopEdge;

    if (isLargeModalSection) {
      // Dock cleanly above sticky modal footer so form inputs & Save/Cancel remain accessible
      cardTop = Math.max(safeTopEdge, vh - cardHeight - 84);
    } else if (spaceBelow >= cardHeight + 12 || (spaceBelow >= spaceAbove && spaceBelow >= 175)) {
      cardTop = Math.min(vh - cardHeight - safeBottomEdge, cutout.bottom + 12);
    } else if (spaceAbove >= cardHeight + 12 || spaceAbove >= 175) {
      cardTop = Math.max(safeTopEdge, cutout.top - cardHeight - 12);
    } else {
      cardTop = Math.max(safeTopEdge, vh - cardHeight - safeBottomEdge);
    }
  }

  // Horizontal alignment: center inside mobile viewport or align near target on desktop
  let cardLeft = Math.round((vw - cardWidth) / 2);
  if (cutout && vw > 520) {
    const targetCenterX = cutout.left + cutout.width / 2;
    cardLeft = Math.round(targetCenterX - cardWidth / 2);
    cardLeft = Math.max(12, Math.min(vw - cardWidth - 12, cardLeft));
  }

  const chapterProgressPct = Math.round(
    ((stepIndex + 1) / Math.max(1, totalChapterSteps)) * 100
  );

  const actionHint = isEn ? step.actionHintEn : step.actionHintAr;
  const safetyNote = isEn ? step.safetyNoteEn : step.safetyNoteAr;
  const practiceCta = isEn ? step.practiceCtaEn : step.practiceCtaAr;

  return (
    <ModalPortal>
      {/* 1. Non-blocking Visual Spotlight & Focus Ring (pointer-events: none so real app stays 100% interactive) */}
      {!isMinimized && (
        <div
          aria-hidden="true"
          style={{ zIndex: 1340 }}
          className="fixed inset-0 pointer-events-none select-none overflow-hidden"
        >
          <svg width="100%" height="100%" className="block w-full h-full">
            <defs>
              <mask id={maskId}>
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {cutout && (
                  <rect
                    x={cutout.left}
                    y={cutout.top}
                    width={cutout.width}
                    height={cutout.height}
                    rx="20"
                    ry="20"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(15, 42, 74, 0.44)"
              mask={`url(#${maskId})`}
            />
          </svg>

          {/* Animated Harbor Mint / Orange Spotlight Ring */}
          {cutout && (
            <div
              style={{
                transform: `translate3d(${cutout.left}px, ${cutout.top}px, 0)`,
                width: `${cutout.width}px`,
                height: `${cutout.height}px`,
              }}
              className="fixed top-0 left-0 rounded-[20px] border-[2.5px] border-orange shadow-[0_0_0_4px_rgba(245,160,74,0.22)] transition-[transform,width,height] duration-150 motion-reduce:transition-none"
            />
          )}
        </div>
      )}

      {/* 2. Floating Interactive Instruction Card */}
      <div
        ref={cardRef}
        role="region"
        aria-live="polite"
        aria-label={isEn ? 'Interactive Tutorial Guide' : 'بطاقة الجولة التفاعلية'}
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{
          zIndex: 1350,
          width: `${cardWidth}px`,
          transform: `translate3d(${cardLeft}px, ${cardTop}px, 0)`,
        }}
        className="fixed top-0 left-0 pointer-events-auto bg-page border-2 border-navy/20 rounded-[26px] shadow-2xl overflow-hidden transition-transform duration-150 motion-reduce:transition-none select-none"
      >
        {/* Top Navy Bar: Chapter Pill + Step Counter + Minimize/Chapters/Exit */}
        <div className="bg-navy text-white px-3.5 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="px-2 py-0.5 rounded-lg bg-orange text-navy-deep text-[10px] font-black shrink-0">
              {isEn ? `Ch. ${chapter.code}` : `فصل ${chapter.code}`}
            </span>
            <span className="text-xs font-bold text-white truncate">
              {isEn ? chapter.titleEn : chapter.titleAr}
            </span>
            <span className="text-[11px] font-bold text-mint/90 shrink-0 tabular-nums">
              ({stepIndex + 1}/{totalChapterSteps})
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Minimize/Expand toggle so user can inspect tall forms unobstructed */}
            <button
              type="button"
              onClick={() => {
                triggerLightHaptic();
                setIsMinimized((prev) => !prev);
              }}
              title={
                isMinimized
                  ? isEn
                    ? 'Expand guide'
                    : 'إظهار الشرح'
                  : isEn
                  ? 'Minimize card to interact freely'
                  : 'تصغير البطاقة للتفاعل بحرية'
              }
              aria-label={
                isMinimized
                  ? isEn
                    ? 'Expand guide'
                    : 'إظهار الشرح'
                  : isEn
                  ? 'Minimize card'
                  : 'تصغير البطاقة'
              }
              className="w-8 h-8 rounded-full bg-white/12 hover:bg-white/22 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <AppIcon name={isMinimized ? 'chevronUp' : 'minus'} size={14} weight="regular" />
            </button>

            <button
              type="button"
              onClick={() => {
                triggerLightHaptic();
                onOpenChapterHub();
              }}
              title={isEn ? 'All Chapters' : 'قائمة الفصول'}
              aria-label={isEn ? 'All Chapters' : 'قائمة الفصول'}
              className="w-8 h-8 rounded-full bg-white/12 hover:bg-white/22 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <AppIcon name="list" size={15} weight="regular" />
            </button>

            <button
              type="button"
              onClick={() => {
                triggerLightHaptic();
                onExitTour();
              }}
              title={isEn ? 'Exit Tutorial' : 'إنهاء الجولة'}
              aria-label={isEn ? 'Exit Tutorial' : 'إنهاء الجولة'}
              className="w-8 h-8 rounded-full bg-white/12 hover:bg-coral/80 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <AppIcon name="close" size={15} weight="regular" />
            </button>
          </div>
        </div>

        {/* Thin Progress Bar */}
        <div className="h-1 w-full bg-mint-soft overflow-hidden" aria-hidden="true">
          <div
            className="h-full bg-orange transition-all duration-200 motion-reduce:transition-none"
            style={{ width: `${chapterProgressPct}%` }}
          />
        </div>

        {/* Minimized Bar View */}
        {isMinimized ? (
          <div className="px-4 py-2.5 flex items-center justify-between gap-2 bg-page">
            <span className="text-xs font-bold text-navy truncate">
              {isEn ? step.titleEn : step.titleAr}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsMinimized(false)}
                className="px-3 py-1.5 rounded-xl bg-mint-soft text-navy text-[11px] font-bold cursor-pointer"
              >
                {isEn ? 'Show Guide' : 'إظهار الشرح'}
              </button>
              <button
                type="button"
                onClick={onNext}
                className="px-3 py-1.5 rounded-xl bg-orange text-navy-deep text-[11px] font-bold cursor-pointer"
              >
                {isLastStepInRun ? (isEn ? 'Finish' : 'إنهاء') : isEn ? 'Next' : 'التالي'}
              </button>
            </div>
          </div>
        ) : (
          /* Expanded Card Body */
          <div className="p-4 space-y-3 text-start">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm sm:text-[15px] font-black text-navy leading-snug">
                  {isEn ? step.titleEn : step.titleAr}
                </h3>
                {!isSingleChapterMode && (
                  <span className="text-[10px] font-bold text-fog shrink-0 tabular-nums">
                    {isEn
                      ? `Total ${globalStepNumber}/${totalGlobalSteps}`
                      : `إجمالي ${globalStepNumber}/${totalGlobalSteps}`}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate leading-relaxed font-medium">
                {isEn ? step.bodyEn : step.bodyAr}
              </p>
            </div>

            {/* Interactive Action Callout / Verification Status */}
            {step.kind === 'interactive' && (
              <div
                className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 text-xs ${
                  isActionCompleted
                    ? 'bg-mint-soft border-teal/40 text-teal font-bold'
                    : 'bg-orange/12 border-orange/40 text-navy font-bold'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AppIcon
                    name={isActionCompleted ? 'checkCircle' : 'sparkles'}
                    size={16}
                    weight="fill"
                    className={isActionCompleted ? 'text-teal shrink-0' : 'text-orange shrink-0'}
                  />
                  <span className="text-[11px] leading-snug">
                    {isActionCompleted
                      ? isEn
                        ? 'Action verified! Ready for the next step.'
                        : 'أحسنت! تم تنفيذ الخطوة بنجاح.'
                      : actionHint ||
                        (isEn
                          ? 'Perform the highlighted action on screen'
                          : 'نفّذ الإجراء الموضح على الشاشة الآن')}
                  </span>
                </div>

                {!isActionCompleted && step.performShowMe && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerLightHaptic();
                      onPerformShowMe();
                    }}
                    className="px-2.5 py-1 rounded-xl bg-page border border-line hover:bg-mist text-navy text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    {isEn ? 'Do it for me' : 'نفّذها لي'}
                  </button>
                )}
              </div>
            )}

            {/* Safe Data Protection Note */}
            {safetyNote && (
              <div className="p-2.5 rounded-2xl bg-mist border border-line flex items-start gap-2">
                <AppIcon
                  name="shieldCheck"
                  size={15}
                  weight="fill"
                  className="text-teal shrink-0 mt-0.5"
                />
                <span className="text-[11px] text-slate leading-snug font-medium">
                  {safetyNote}
                </span>
              </div>
            )}

            {/* Optional 1-Tap Safe Practice Helper */}
            {practiceCta && step.onPracticeAction && (
              <button
                type="button"
                onClick={() => {
                  triggerLightHaptic();
                  onRunPracticeAction();
                }}
                className="w-full py-2 px-3 rounded-xl bg-mint-soft hover:bg-mint border border-navy/20 text-navy text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <AppIcon name="sparkles" size={14} weight="fill" className="text-orange" />
                <span>{practiceCta}</span>
              </button>
            )}

            {/* Graceful Missing-Target Recovery Bar (never traps the user) */}
            {isTargetMissing && !isSearchingTarget && (
              <div className="p-2.5 rounded-2xl bg-mist border border-orange/40 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AppIcon name="info" size={15} className="text-orange shrink-0" />
                  <span className="text-[11px] font-bold text-navy truncate">
                    {isEn
                      ? 'Element is currently closed or off-screen'
                      : 'العنصر غير مفتوح في الشاشة الحالية'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerLightHaptic();
                    onRetryTarget();
                  }}
                  className="px-2.5 py-1 rounded-xl bg-page border border-line text-navy text-[11px] font-bold shrink-0 cursor-pointer hover:bg-mint-soft"
                >
                  {isEn ? 'Show Element' : 'إظهار العنصر'}
                </button>
              </div>
            )}

            {/* Footer Controls: Back | Skip Step / Skip Chapter | Next / Finish */}
            <div className="pt-1 border-t border-line flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerLightHaptic();
                    onPrev();
                  }}
                  disabled={!canGoBack}
                  className="min-h-[40px] px-3 rounded-xl bg-mist hover:bg-mint-soft disabled:opacity-40 disabled:pointer-events-none text-navy text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <AppIcon name="chevronStart" size={14} weight="regular" />
                  <span>{isEn ? 'Back' : 'السابق'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerLightHaptic();
                    onSkipStep();
                  }}
                  className="min-h-[40px] px-2.5 rounded-xl hover:bg-mist text-slate hover:text-navy text-[11px] font-bold transition-colors cursor-pointer"
                >
                  {isEn ? 'Skip step' : 'تخطي الخطوة'}
                </button>

                {!isSingleChapterMode && totalChapterSteps > 1 && !isLastStepInRun && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerLightHaptic();
                      onSkipChapter();
                    }}
                    className="hidden sm:inline-flex min-h-[40px] px-2 rounded-xl hover:bg-mist text-fog hover:text-navy text-[11px] font-semibold items-center transition-colors cursor-pointer"
                  >
                    {isEn ? 'Skip chapter' : 'تخطي الفصل'}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerLightHaptic();
                  if (
                    step.kind === 'interactive' &&
                    !isActionCompleted &&
                    step.performShowMe
                  ) {
                    onPerformShowMe();
                  } else {
                    onNext();
                  }
                }}
                className="btn-orange !min-h-[40px] !h-[40px] !px-4 !text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <span>
                  {isLastStepInRun
                    ? isEn
                      ? 'Finish Tour'
                      : 'إتمام الجولة'
                    : step.kind === 'interactive' && !isActionCompleted && step.performShowMe
                    ? isEn
                      ? 'Open & Next'
                      : 'تنفيذ والتالي'
                    : isEn
                    ? 'Next'
                    : 'التالي'}
                </span>
                <AppIcon
                  name={isLastStepInRun ? 'check' : 'chevronEnd'}
                  size={14}
                  weight="regular"
                />
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalPortal>
  );
};

export default TutorialOverlay;
