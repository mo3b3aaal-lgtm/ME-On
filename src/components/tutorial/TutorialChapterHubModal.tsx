import React from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { MintCard } from '../ui/MintCard';
import { AppIcon } from '../ui/AppIcon';
import { useTranslation } from '../../utils/i18n';
import { triggerLightHaptic } from '../../utils/haptics';
import { TUTORIAL_CHAPTERS } from './tutorialSteps';
import type {
  TutorialChapterId,
  TutorialPersistedState,
} from '../../utils/tutorialProgress';

interface TutorialChapterHubModalProps {
  isOpen: boolean;
  persistedState: TutorialPersistedState;
  practiceEntitiesCount: number;
  onClose: () => void;
  onStartFullTour: () => void;
  onResumeSavedTour: () => void;
  onSelectChapter: (chapterId: TutorialChapterId) => void;
  onResetProgress: () => void;
  onCleanupPracticeData: () => void;
}

export const TutorialChapterHubModal: React.FC<TutorialChapterHubModalProps> = ({
  isOpen,
  persistedState,
  practiceEntitiesCount,
  onClose,
  onStartFullTour,
  onResumeSavedTour,
  onSelectChapter,
  onResetProgress,
  onCleanupPracticeData,
}) => {
  const { language } = useTranslation();
  const isEn = language.startsWith('en');

  if (!isOpen) return null;

  const completedSet = new Set(persistedState.completedChapterIds);
  const completedCount = completedSet.size;
  const totalChapters = TUTORIAL_CHAPTERS.length;
  const canResume = persistedState.status === 'in_progress';

  return (
    <BottomSheet
      id="tutorial-chapter-hub"
      isOpen={isOpen}
      onClose={onClose}
      zIndex={1360}
      title={isEn ? 'Interactive Onboarding Guide' : 'دليل الجولة التفاعلية'}
      subtitle={
        isEn
          ? `${completedCount} of ${totalChapters} chapters completed • Hands-on training`
          : `أكملت ${completedCount} من ${totalChapters} فصول • تدريب عملي مباشر`
      }
      headerLeading={
        <div className="w-10 h-10 rounded-2xl bg-mint-soft border border-line flex items-center justify-center text-navy shrink-0">
          <AppIcon name="sparkles" size={20} weight="fill" className="text-orange" />
        </div>
      }
      bodyClassName="p-4 space-y-4"
      footer={
        <div className="flex items-center gap-2.5">
          {canResume ? (
            <>
              <button
                type="button"
                onClick={() => {
                  triggerLightHaptic();
                  onStartFullTour();
                }}
                className="btn-soft flex-1 text-xs font-bold"
              >
                {isEn ? 'Restart Full Tour' : 'البدء من الأول'}
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerLightHaptic();
                  onResumeSavedTour();
                }}
                className="btn-orange flex-1 text-xs sm:text-sm font-bold"
              >
                <AppIcon name="sparkles" size={15} weight="fill" />
                <span>{isEn ? 'Resume Tour' : 'متابعة الجولة'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="btn-soft flex-1 text-xs font-bold"
              >
                {isEn ? 'Close' : 'إغلاق'}
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerLightHaptic();
                  onStartFullTour();
                }}
                className="btn-orange flex-1 text-xs sm:text-sm font-bold"
              >
                <AppIcon name="sparkles" size={15} weight="fill" />
                <span>
                  {completedCount > 0
                    ? isEn
                      ? 'Run Full Tour Again'
                      : 'بدء الجولة الكاملة'
                    : isEn
                    ? 'Start Full Interactive Tour'
                    : 'ابدأ الجولة التفاعلية الكاملة'}
                </span>
              </button>
            </>
          )}
        </div>
      }
    >
      {/* Top Info Banner */}
      <div className="p-3.5 rounded-2xl bg-navy text-white flex items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0 text-start">
          <p className="text-xs sm:text-sm font-bold">
            {isEn ? 'Learn by Using Real Screens' : 'تعلّم بالممارسة على شاشاتك الحقيقية'}
          </p>
          <p className="text-[11px] text-white/80 leading-snug">
            {isEn
              ? 'Jump directly to any topic below or run the complete 7-chapter tour.'
              : 'اختر أي قسم بالأسفل لتجربته فوراً، أو ابدأ الجولة الكاملة بالترتيب.'}
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-white/15 text-mint text-xs font-black shrink-0 tabular-nums">
          {completedCount}/{totalChapters}
        </span>
      </div>

      {/* Practice Cleanup Banner (shown only if sample [Practice] records exist) */}
      {practiceEntitiesCount > 0 && (
        <div className="p-3 rounded-2xl bg-mint-soft border border-mint flex items-center justify-between gap-2.5">
          <div className="min-w-0 text-start">
            <p className="text-xs font-bold text-navy">
              {isEn
                ? `${practiceEntitiesCount} [Practice] sample item(s) active`
                : `يوجد ${practiceEntitiesCount} عنصر تجريبي بوسم [تجريبي]`}
            </p>
            <p className="text-[11px] text-slate truncate">
              {isEn
                ? 'Real records are never affected.'
                : 'بياناتك الحقيقية منفصلة ومحمية بالكامل.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerLightHaptic();
              onCleanupPracticeData();
            }}
            className="px-3 py-2 rounded-xl bg-page border border-line hover:bg-mist text-navy text-[11px] font-bold shrink-0 cursor-pointer flex items-center gap-1"
          >
            <AppIcon name="trash" size={13} />
            <span>{isEn ? 'Clean Up' : 'مسح التجريبي'}</span>
          </button>
        </div>
      )}

      {/* Chapters List */}
      <div className="space-y-2.5">
        {TUTORIAL_CHAPTERS.map((chapter) => {
          const isDone = completedSet.has(chapter.id);
          const isCurrent =
            persistedState.status === 'in_progress' &&
            persistedState.activeChapterId === chapter.id;

          return (
            <MintCard
              key={chapter.id}
              clickable
              onClick={() => {
                triggerLightHaptic();
                onSelectChapter(chapter.id);
              }}
              className={`p-3.5 flex items-center justify-between gap-3 transition-all cursor-pointer ${
                isCurrent ? 'border-navy ring-1 ring-navy/20 bg-mint' : 'bg-mint-soft'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 text-start">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                    isDone
                      ? 'bg-teal text-white border-teal'
                      : isCurrent
                      ? 'bg-navy text-white border-navy'
                      : 'bg-page text-navy border-line'
                  }`}
                >
                  {isDone ? (
                    <AppIcon name="check" size={18} weight="fill" />
                  ) : (
                    <AppIcon name={chapter.icon} size={20} weight="duotone" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-page/80 text-navy border border-line/70">
                      {isEn ? `Ch. ${chapter.code}` : `فصل ${chapter.code}`}
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-navy truncate">
                      {isEn ? chapter.titleEn : chapter.titleAr}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate truncate mt-0.5">
                    {isEn ? chapter.subtitleEn : chapter.subtitleAr}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold text-slate bg-page px-2 py-1 rounded-full border border-line tabular-nums">
                  {chapter.steps.length} {isEn ? 'steps' : 'خطوات'}
                </span>
                <AppIcon name="chevronEnd" size={16} className="text-navy" />
              </div>
            </MintCard>
          );
        })}
      </div>

      {/* Reset Progress Action */}
      {(completedCount > 0 || persistedState.completedStepIds.length > 0) && (
        <div className="pt-1 flex justify-end">
          <button
            type="button"
            onClick={() => {
              triggerLightHaptic();
              onResetProgress();
            }}
            className="text-[11px] font-bold text-slate hover:text-navy inline-flex items-center gap-1.5 py-1.5 px-2 rounded-lg hover:bg-mist transition-colors cursor-pointer"
          >
            <AppIcon name="restore" size={14} />
            <span>{isEn ? 'Reset tutorial completion badges' : 'إعادة ضبط علامات إتمام الجولة'}</span>
          </button>
        </div>
      )}
    </BottomSheet>
  );
};

export default TutorialChapterHubModal;
