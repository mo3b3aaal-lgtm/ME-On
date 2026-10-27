import React from 'react';
import { ModalPortal, useModalLayer } from '../../contexts/ModalContext';
import { ClassyOwlMascot } from '../ClassyOwlMascot';
import { AppIcon } from '../ui/AppIcon';
import { useTranslation } from '../../utils/i18n';
import { triggerLightHaptic, triggerSuccessHaptic } from '../../utils/haptics';
import { getChapterById, TUTORIAL_CHAPTERS } from './tutorialSteps';
import type { TutorialChapterId } from '../../utils/tutorialProgress';

export type OnboardingDialogMode = 'welcome' | 'resume' | 'completed';

interface FirstLoginWelcomeModalProps {
  isOpen: boolean;
  mode: OnboardingDialogMode;
  activeChapterId: TutorialChapterId;
  activeStepIndex: number;
  completedChaptersCount: number;
  practiceEntitiesCount: number;
  onStartFullTour: () => void;
  onResumeTour: () => void;
  onOpenChapterHub: () => void;
  onExploreOnOwn: () => void;
  onCloseCompletion: () => void;
  onCleanupPracticeData: () => void;
}

export const FirstLoginWelcomeModal: React.FC<FirstLoginWelcomeModalProps> = ({
  isOpen,
  mode,
  activeChapterId,
  activeStepIndex,
  completedChaptersCount,
  practiceEntitiesCount,
  onStartFullTour,
  onResumeTour,
  onOpenChapterHub,
  onExploreOnOwn,
  onCloseCompletion,
  onCleanupPracticeData,
}) => {
  const { language, isRTL } = useTranslation();
  const isEn = language.startsWith('en');

  const handleDismiss = () => {
    triggerLightHaptic();
    if (mode === 'completed') {
      onCloseCompletion();
    } else {
      onExploreOnOwn();
    }
  };

  useModalLayer(`tutorial-dialog-${mode}`, isOpen, handleDismiss);

  if (!isOpen) return null;

  const currentChapter = getChapterById(activeChapterId);
  const clampedStep = Math.min(
    Math.max(1, activeStepIndex + 1),
    Math.max(1, currentChapter.steps.length)
  );

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="classy-onboarding-dialog-title"
        style={{ zIndex: 1360 }}
        dir={isRTL ? 'rtl' : 'ltr'}
        className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4 select-none"
      >
        {/* Translucent Harbor Mint Scrim */}
        <div
          className="fixed inset-0 bg-navy-deep/50 animate-backdrop-fade"
          onClick={handleDismiss}
          aria-hidden="true"
        />

        {/* Dialog Card */}
        <div className="relative z-10 w-full sm:max-w-[420px] bg-page border border-line rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden animate-sheet-slide-up pb-[env(safe-area-inset-bottom,0px)]">
          {/* Decorative Harbor Mint Top Header */}
          <div className="relative bg-navy px-5 pt-5 pb-6 text-white overflow-hidden">
            {/* Subtle geometric accent */}
            <div
              aria-hidden="true"
              className="absolute -top-10 -end-10 w-36 h-36 rounded-full bg-mint/15 pointer-events-none"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-8 -start-8 w-28 h-28 rounded-full bg-orange/15 pointer-events-none"
            />

            {/* Top Bar: Badge + Accessible Skip/Close */}
            <div className="relative z-10 flex items-center justify-between gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/12 border border-white/15 text-[11px] font-bold text-mint">
                <AppIcon name="sparkles" size={13} weight="fill" className="text-orange" />
                <span>
                  {mode === 'welcome'
                    ? isEn
                      ? 'Interactive Hands-On Tour'
                      : 'جولة تفاعلية عملية'
                    : mode === 'resume'
                    ? isEn
                      ? 'Saved Tour Progress'
                      : 'استكمال الجولة المحفوظة'
                    : isEn
                    ? 'Tour Completed'
                    : 'اكتملت الجولة بنجاح'}
                </span>
              </span>

              <button
                type="button"
                onClick={handleDismiss}
                aria-label={isEn ? 'Skip onboarding' : 'تخطي الجولة'}
                className="min-h-[38px] px-3 rounded-full bg-white/12 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>{mode === 'completed' ? (isEn ? 'Close' : 'إغلاق') : isEn ? 'Skip' : 'تخطي'}</span>
                <AppIcon name="close" size={14} weight="regular" />
              </button>
            </div>

            {/* Mascot + Headline */}
            <div className="relative z-10 flex items-center gap-4">
              <div className="shrink-0 bg-page/10 rounded-3xl p-1.5 border border-white/15">
                <ClassyOwlMascot
                  size="md"
                  pose={mode === 'completed' ? 'happy' : 'waving'}
                  glow={false}
                />
              </div>

              <div className="min-w-0 flex-1 text-start space-y-1.5">
                <h2
                  id="classy-onboarding-dialog-title"
                  className="text-lg sm:text-xl font-black text-white leading-snug"
                >
                  {mode === 'welcome'
                    ? isEn
                      ? 'Welcome to Classy!'
                      : 'أهلًا بيك في Classy!'
                    : mode === 'resume'
                    ? isEn
                      ? 'Resume Your Interactive Tour?'
                      : 'تحب تكمّل الجولة من حيث توقفت؟'
                    : isEn
                    ? 'You Are Ready to Teach with Classy!'
                    : 'أنت الآن جاهز للانطلاق مع Classy!'}
                </h2>
                <p className="text-xs sm:text-[13px] text-white/85 leading-relaxed font-medium">
                  {mode === 'welcome'
                    ? isEn
                      ? 'Let us introduce you to the app step by step while you use the real interface yourself.'
                      : 'خلينا نعرّفك على البرنامج خطوة بخطوة، وإنت بتستخدمه بنفسك.'
                    : mode === 'resume'
                    ? isEn
                      ? `Your progress is saved at Chapter ${currentChapter.code}: ${currentChapter.titleEn} (Step ${clampedStep} of ${currentChapter.steps.length}).`
                      : `تم حفظ تقدمك عند الفصل (${currentChapter.code}): ${currentChapter.titleAr} — الخطوة ${clampedStep} من ${currentChapter.steps.length}.`
                    : isEn
                    ? `You explored ${completedChaptersCount} of ${TUTORIAL_CHAPTERS.length} interactive chapters. You can revisit any chapter anytime from Settings.`
                    : `استعرضت الجوانب العملية للبرنامج بنجاح. يمكنك إعادة الجولة أو فتح أي فصل محدد في أي وقت من شاشة الإعدادات.`}
                </p>
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-5 space-y-4 text-start">
            {mode === 'welcome' && (
              <div className="p-3.5 rounded-2xl bg-mint-soft border border-line space-y-2.5">
                <p className="text-xs font-bold text-navy flex items-center gap-1.5">
                  <AppIcon name="checkCircle" size={16} weight="fill" className="text-teal shrink-0" />
                  <span>
                    {isEn
                      ? 'What makes this tour hands-on & safe:'
                      : 'مميزات الجولة التفاعلية العملية:'}
                  </span>
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate">
                  <div className="flex items-center gap-1.5 bg-page px-2.5 py-2 rounded-xl border border-line/70">
                    <AppIcon name="students" size={14} weight="duotone" className="text-navy shrink-0" />
                    <span className="truncate">{isEn ? 'Real Students & Groups' : 'تجربة الطلاب والمجموعات'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-page px-2.5 py-2 rounded-xl border border-line/70">
                    <AppIcon name="calendarCheck" size={14} weight="duotone" className="text-navy shrink-0" />
                    <span className="truncate">{isEn ? 'Attendance & Periods' : 'التحضير وفترات القيد'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-page px-2.5 py-2 rounded-xl border border-line/70">
                    <AppIcon name="wallet" size={14} weight="duotone" className="text-navy shrink-0" />
                    <span className="truncate">{isEn ? 'Billing & Safe Preview' : 'المحاسبة وحماية بياناتك'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-page px-2.5 py-2 rounded-xl border border-line/70">
                    <AppIcon name="reports" size={14} weight="duotone" className="text-navy shrink-0" />
                    <span className="truncate">{isEn ? 'Trends & Cloud Sync' : 'منحنيات الحضور والمزامنة'}</span>
                  </div>
                </div>
              </div>
            )}

            {mode === 'resume' && (
              <div className="p-3.5 rounded-2xl bg-mint-soft border border-line flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-page border border-line flex items-center justify-center text-navy font-black text-sm shrink-0">
                    {currentChapter.code}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-navy truncate">
                      {isEn ? currentChapter.titleEn : currentChapter.titleAr}
                    </p>
                    <p className="text-[11px] text-slate truncate mt-0.5">
                      {isEn
                        ? `Step ${clampedStep} of ${currentChapter.steps.length} • Non-destructive safe mode`
                        : `الخطوة ${clampedStep} من ${currentChapter.steps.length} • بياناتك الحقيقية محمية بالكامل`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerLightHaptic();
                    onOpenChapterHub();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-page border border-line text-[11px] font-bold text-navy hover:bg-mist shrink-0 cursor-pointer"
                >
                  {isEn ? 'Chapters' : 'الفصول'}
                </button>
              </div>
            )}

            {mode === 'completed' && practiceEntitiesCount > 0 && (
              <div className="p-3.5 rounded-2xl bg-mint-soft border border-mint space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <AppIcon name="shieldCheck" size={18} weight="fill" className="text-teal shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-navy">
                      {isEn
                        ? `Found ${practiceEntitiesCount} [Practice] sample item(s)`
                        : `يوجد ${practiceEntitiesCount} سجل تجريبي بوسم [تجريبي]`}
                    </p>
                    <p className="text-[11px] text-slate mt-0.5 leading-snug">
                      {isEn
                        ? 'Would you like to remove the sample [Practice] records now while keeping 100% of your real data untouched?'
                        : 'هل ترغب في مسح السجلات التجريبية [تجريبي] الآن مع الحفاظ الكامل على جميع بياناتك الحقيقية؟'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerSuccessHaptic();
                    onCleanupPracticeData();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-page border border-navy/30 hover:bg-mist text-navy text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <AppIcon name="trash" size={15} weight="duotone" />
                  <span>
                    {isEn
                      ? 'Clean Up [Practice] Records Only'
                      : 'مسح السجلات التجريبية [تجريبي] فقط'}
                  </span>
                </button>
              </div>
            )}

            {/* Action Buttons */}
            {mode === 'welcome' && (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerLightHaptic();
                    onStartFullTour();
                  }}
                  className="btn-orange w-full min-h-[48px] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <AppIcon name="sparkles" size={18} weight="fill" />
                  <span>{isEn ? 'Start Interactive Tour' : 'ابدأ الجولة التفاعلية'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerLightHaptic();
                    onExploreOnOwn();
                  }}
                  className="btn-soft w-full min-h-[46px] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{isEn ? 'Explore on My Own' : 'استكشف البرنامج بنفسك'}</span>
                </button>

                <div className="pt-1 flex items-center justify-between text-[11px] text-slate px-1">
                  <button
                    type="button"
                    onClick={() => {
                      triggerLightHaptic();
                      onOpenChapterHub();
                    }}
                    className="font-bold text-navy hover:underline cursor-pointer inline-flex items-center gap-1 py-1"
                  >
                    <AppIcon name="list" size={13} />
                    <span>{isEn ? 'Pick a specific chapter (7)' : 'أو اختر فصلاً محدداً (7 فصول)'}</span>
                  </button>
                  <span>{isEn ? 'Available anytime in Settings' : 'متاحة دائماً من الإعدادات'}</span>
                </div>
              </div>
            )}

            {mode === 'resume' && (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerLightHaptic();
                    onResumeTour();
                  }}
                  className="btn-orange w-full min-h-[48px] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <AppIcon name="sparkles" size={18} weight="fill" />
                  <span>{isEn ? 'Resume Where I Left Off' : 'متابعة الجولة من حيث توقفت'}</span>
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      triggerLightHaptic();
                      onStartFullTour();
                    }}
                    className="btn-soft min-h-[44px] text-xs font-bold cursor-pointer"
                  >
                    {isEn ? 'Restart Tour' : 'البدء من الأول'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="btn-soft min-h-[44px] text-xs font-bold cursor-pointer"
                  >
                    {isEn ? 'Exit Tour' : 'إنهاء الجولة'}
                  </button>
                </div>
              </div>
            )}

            {mode === 'completed' && (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerLightHaptic();
                    onOpenChapterHub();
                  }}
                  className="btn-soft flex-1 min-h-[46px] text-xs font-bold cursor-pointer"
                >
                  {isEn ? 'Browse Chapters' : 'قائمة الفصول'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerSuccessHaptic();
                    onCloseCompletion();
                  }}
                  className="btn-orange flex-1 min-h-[46px] text-sm font-bold cursor-pointer"
                >
                  {isEn ? 'Start Using Classy' : 'ابدأ العمل الآن'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default FirstLoginWelcomeModal;
