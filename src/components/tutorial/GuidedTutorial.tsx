import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActiveTab, Group, Session, Student } from '../../types';
import { db } from '../../utils/storage';
import { useTranslation } from '../../utils/i18n';
import { triggerSuccessHaptic } from '../../utils/haptics';
import {
  cleanupPracticeEntities,
  closeTutorialChapterHub,
  closeTutorialCompletionModal,
  createSafePracticeGroup,
  createSafePracticeStudent,
  dismissFirstLoginTutorial,
  exitTutorialSession,
  finishTutorialRun,
  getActivePracticeEntitiesCount,
  openTutorialChapterHub,
  resetTutorialProgress,
  resumeTutorial,
  setTutorialStepPosition,
  shouldShowFirstLoginChoice,
  shouldShowInterruptedTourPrompt,
  startFullTutorial,
  startTutorialChapter,
  useTutorialState,
  type TutorialChapterId,
} from '../../utils/tutorialProgress';
import {
  findActiveTutorialTarget,
  useActiveTutorialTarget,
} from './tutorialRegistry';
import {
  getChapterById,
  getGlobalStepNumber,
  getTotalStepsCount,
  TUTORIAL_CHAPTERS,
  type TutorialAppActions,
  type TutorialAppSnapshot,
} from './tutorialSteps';
import { FirstLoginWelcomeModal } from './FirstLoginWelcomeModal';
import { TutorialChapterHubModal } from './TutorialChapterHubModal';
import { TutorialOverlay } from './TutorialOverlay';

export interface GuidedTutorialProps {
  userId: string;
  isAppReady: boolean;
  activeTab: ActiveTab;
  studentsSegment: 'students' | 'groups';
  students: Student[];
  groups: Group[];
  sessions: Session[];
  isQuickAddOpen: boolean;
  isNotificationsOpen: boolean;
  isAddStudentOpen: boolean;
  isStudentProfileOpen: boolean;
  isAddGroupOpen: boolean;
  isGroupProfileOpen: boolean;
  isAttendanceOpen: boolean;
  isAddPaymentOpen: boolean;
  isEnrollOpen: boolean;
  onNavigateToTab: (tab: ActiveTab) => void;
  onSetStudentsSegment: (seg: 'students' | 'groups') => void;
  onCloseQuickAdd: () => void;
  onOpenNotifications: () => void;
  onCloseNotifications: () => void;
  onOpenAddStudent: () => void;
  onCloseAddStudent: () => void;
  onOpenStudentProfile: (student: Student) => void;
  onCloseStudentProfile: () => void;
  onOpenAddGroup: () => void;
  onCloseAddGroup: () => void;
  onOpenGroupProfile: (group: Group) => void;
  onCloseGroupProfile: () => void;
  onOpenAttendance: (session: Session) => void;
  onCloseAttendance: () => void;
  onOpenAddPayment: (student?: Student) => void;
  onCloseAddPayment: () => void;
  onCloseEnroll: () => void;
  onDataChanged: () => void;
  onShowToast?: (message: string) => void;
}

export const GuidedTutorial: React.FC<GuidedTutorialProps> = ({
  userId,
  isAppReady,
  activeTab,
  studentsSegment,
  students,
  groups,
  sessions,
  isQuickAddOpen,
  isNotificationsOpen,
  isAddStudentOpen,
  isStudentProfileOpen,
  isAddGroupOpen,
  isGroupProfileOpen,
  isAttendanceOpen,
  isAddPaymentOpen,
  isEnrollOpen,
  onNavigateToTab,
  onSetStudentsSegment,
  onCloseQuickAdd,
  onOpenNotifications,
  onCloseNotifications,
  onOpenAddStudent,
  onCloseAddStudent,
  onOpenStudentProfile,
  onCloseStudentProfile,
  onOpenAddGroup,
  onCloseAddGroup,
  onOpenGroupProfile,
  onCloseGroupProfile,
  onOpenAttendance,
  onCloseAttendance,
  onOpenAddPayment,
  onCloseAddPayment,
  onCloseEnroll,
  onDataChanged,
  onShowToast,
}) => {
  const { language } = useTranslation();
  const isEn = language.startsWith('en');

  const { persisted, runtime } = useTutorialState(userId);

  // Track active sub-tabs in ReportsView via lightweight custom event / DOM attribute
  const [reportsSubState, setReportsSubState] = useState<{
    isAttendanceTrends: boolean;
    isBillingStreams: boolean;
  }>({ isAttendanceTrends: false, isBillingStreams: false });

  useEffect(() => {
    if (!runtime.isTourActive) return;

    const checkReportsDom = () => {
      const trendsEl = document.querySelector(
        '[data-tutorial-id="reports-subtab-attendance_trends"][data-tutorial-active="true"]'
      );
      const streamsEl = document.querySelector(
        '[data-tutorial-id="reports-subtab-billing_streams"][data-tutorial-active="true"]'
      );
      setReportsSubState((prev) => {
        const nextTrends = Boolean(trendsEl);
        const nextStreams = Boolean(streamsEl);
        if (
          prev.isAttendanceTrends === nextTrends &&
          prev.isBillingStreams === nextStreams
        ) {
          return prev;
        }
        return { isAttendanceTrends: nextTrends, isBillingStreams: nextStreams };
      });
    };

    checkReportsDom();
    const mo = new MutationObserver(checkReportsDom);
    mo.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-tutorial-active', 'class'],
    });
    return () => mo.disconnect();
  }, [runtime.isTourActive, activeTab]);

  const appSnapshot: TutorialAppSnapshot = useMemo(
    () => ({
      userId,
      activeTab,
      studentsSegment,
      studentsCount: students.length,
      groupsCount: groups.length,
      sessionsCount: sessions.length,
      isQuickAddOpen,
      isNotificationsOpen,
      isAddStudentOpen,
      isStudentProfileOpen,
      isAddGroupOpen,
      isGroupProfileOpen,
      isAttendanceOpen,
      isAddPaymentOpen,
      isEnrollOpen,
      isReportsAttendanceTrendsActive: reportsSubState.isAttendanceTrends,
      isReportsBillingStreamsActive: reportsSubState.isBillingStreams,
    }),
    [
      userId,
      activeTab,
      studentsSegment,
      students.length,
      groups.length,
      sessions.length,
      isQuickAddOpen,
      isNotificationsOpen,
      isAddStudentOpen,
      isStudentProfileOpen,
      isAddGroupOpen,
      isGroupProfileOpen,
      isAttendanceOpen,
      isAddPaymentOpen,
      isEnrollOpen,
      reportsSubState.isAttendanceTrends,
      reportsSubState.isBillingStreams,
    ]
  );

  const appSnapshotRef = useRef<TutorialAppSnapshot>(appSnapshot);
  appSnapshotRef.current = appSnapshot;

  const closeAllModals = useCallback(() => {
    if (isQuickAddOpen) onCloseQuickAdd();
    if (isNotificationsOpen) onCloseNotifications();
    if (isAddStudentOpen) onCloseAddStudent();
    if (isStudentProfileOpen) onCloseStudentProfile();
    if (isAddGroupOpen) onCloseAddGroup();
    if (isGroupProfileOpen) onCloseGroupProfile();
    if (isAttendanceOpen) onCloseAttendance();
    if (isAddPaymentOpen) onCloseAddPayment();
    if (isEnrollOpen) onCloseEnroll();
  }, [
    isQuickAddOpen,
    isNotificationsOpen,
    isAddStudentOpen,
    isStudentProfileOpen,
    isAddGroupOpen,
    isGroupProfileOpen,
    isAttendanceOpen,
    isAddPaymentOpen,
    isEnrollOpen,
    onCloseQuickAdd,
    onCloseNotifications,
    onCloseAddStudent,
    onCloseStudentProfile,
    onCloseAddGroup,
    onCloseGroupProfile,
    onCloseAttendance,
    onCloseAddPayment,
    onCloseEnroll,
  ]);

  const appActions: TutorialAppActions = useMemo(
    () => ({
      navigateToTab: onNavigateToTab,
      setStudentsSegment: onSetStudentsSegment,
      closeAllModals,
      openAddStudent: onOpenAddStudent,
      closeAddStudent: onCloseAddStudent,
      openFirstStudentProfile: () => {
        const latest = db.getStudents().filter((s) => s.status !== 'archived');
        if (latest.length === 0) return false;
        onOpenStudentProfile(latest[0]);
        return true;
      },
      closeStudentProfile: onCloseStudentProfile,
      openAddGroup: onOpenAddGroup,
      closeAddGroup: onCloseAddGroup,
      openFirstGroupProfile: () => {
        const latest = db.getGroups().filter((g) => g.type !== 'private');
        const target = latest[0] || db.getGroups()[0];
        if (!target) return false;
        onOpenGroupProfile(target);
        return true;
      },
      closeGroupProfile: onCloseGroupProfile,
      openFirstGroupAttendance: () => {
        const latestSessions = db.getSessions();
        const groupSession = latestSessions.find(
          (s) => s.groupId && !s.studentId && s.status !== 'cancelled'
        );
        if (!groupSession) {
          onShowToast?.(
            isEn
              ? 'Schedule or select a group class first to preview Lesson Studio.'
              : 'لا توجد حصة مجموعة مجدولة حالياً — يمكنك تجربتها فور إضافة أول حصة.'
          );
          return false;
        }
        onOpenAttendance(groupSession);
        return true;
      },
      closeAttendance: onCloseAttendance,
      openAddPaymentPreview: () => {
        const latestStudents = db.getStudents().filter((s) => s.status !== 'archived');
        onOpenAddPayment(latestStudents[0]);
      },
      closeAddPayment: onCloseAddPayment,
      openNotifications: onOpenNotifications,
      closeNotifications: onCloseNotifications,
      createPracticeStudent: () => {
        const stu = createSafePracticeStudent(userId, isEn);
        onDataChanged();
        onShowToast?.(
          isEn
            ? `Created safe sample student "${stu.name}"`
            : `تم إنشاء طالب تجريبي آمن "${stu.name}"`
        );
      },
      createPracticeGroup: () => {
        const grp = createSafePracticeGroup(userId, isEn);
        onDataChanged();
        onShowToast?.(
          isEn
            ? `Created safe sample group "${grp.name}"`
            : `تم إنشاء مجموعة تجريبية آمنة "${grp.name}"`
        );
      },
      activateReportsSubTab: (reportType, subTab) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('classy_tutorial_reports_nav', {
              detail: { reportType, subTab },
            })
          );
        }
      },
    }),
    [
      onNavigateToTab,
      onSetStudentsSegment,
      closeAllModals,
      onOpenAddStudent,
      onCloseAddStudent,
      onOpenStudentProfile,
      onCloseStudentProfile,
      onOpenAddGroup,
      onCloseAddGroup,
      onOpenGroupProfile,
      onCloseGroupProfile,
      onOpenAttendance,
      onCloseAttendance,
      onOpenAddPayment,
      onCloseAddPayment,
      onOpenNotifications,
      onCloseNotifications,
      userId,
      isEn,
      onDataChanged,
      onShowToast,
    ]
  );

  const appActionsRef = useRef<TutorialAppActions>(appActions);
  appActionsRef.current = appActions;

  // Current Chapter & Step resolution
  const activeChapter = useMemo(
    () => getChapterById(persisted.activeChapterId),
    [persisted.activeChapterId]
  );
  const clampedStepIdx = Math.min(
    Math.max(0, persisted.activeStepIndex),
    Math.max(0, activeChapter.steps.length - 1)
  );
  const activeStep = activeChapter.steps[clampedStepIdx];

  // Track baseline snapshot when entering a step so delta predicates (e.g. studentsCount increased) work accurately
  const stepEntrySnapshotRef = useRef<TutorialAppSnapshot | null>(null);
  const preparedStepKeyRef = useRef<string>('');
  const autoAdvanceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  // Run step.prepare() once whenever entering a new active step during an active tour
  useEffect(() => {
    if (!runtime.isTourActive || !isAppReady || !activeStep) {
      preparedStepKeyRef.current = '';
      return;
    }

    const stepKey = `${activeChapter.id}::${activeStep.id}`;
    if (preparedStepKeyRef.current === stepKey) return;
    preparedStepKeyRef.current = stepKey;

    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    // Prepare required screen/tab first, then capture baseline snapshot
    activeStep.prepare?.(appActionsRef.current, appSnapshotRef.current);
    stepEntrySnapshotRef.current = appSnapshotRef.current;
  }, [runtime.isTourActive, isAppReady, activeChapter.id, activeStep]);

  // Resolve primary vs fallback target ID (e.g. when a profile modal isn't open yet, highlight the list)
  const resolvedTargetId = useMemo(() => {
    if (!runtime.isTourActive || !activeStep) return undefined;
    if (!activeStep.fallbackTargetId) return activeStep.targetId;
    const primaryFound = findActiveTutorialTarget(activeStep.targetId);
    if (primaryFound) return activeStep.targetId;
    return activeStep.fallbackTargetId;
  }, [runtime.isTourActive, activeStep, appSnapshot]);

  const {
    bounds,
    isSearching: isSearchingTarget,
    isMissing: isTargetMissing,
    recheckNow,
  } = useActiveTutorialTarget(
    resolvedTargetId,
    runtime.isTourActive && isAppReady,
    `${activeChapter.id}::${activeStep?.id || ''}`
  );

  // Evaluate hands-on action completion
  const isActionCompleted = useMemo(() => {
    if (!runtime.isTourActive || !activeStep?.isActionCompleted) return false;
    return activeStep.isActionCompleted(appSnapshot, stepEntrySnapshotRef.current);
  }, [runtime.isTourActive, activeStep, appSnapshot]);

  const chapterIndexInList = useMemo(
    () => TUTORIAL_CHAPTERS.findIndex((c) => c.id === activeChapter.id),
    [activeChapter.id]
  );

  const isSingleChapterMode = persisted.runScope === 'single_chapter';
  const isLastStepInChapter = clampedStepIdx >= activeChapter.steps.length - 1;
  const isLastChapter = chapterIndexInList >= TUTORIAL_CHAPTERS.length - 1;
  const isLastStepInRun = isSingleChapterMode
    ? isLastStepInChapter
    : isLastStepInChapter && isLastChapter;

  const canGoBack = isSingleChapterMode
    ? clampedStepIdx > 0
    : chapterIndexInList > 0 || clampedStepIdx > 0;

  const handleAdvance = useCallback(
    (wasSkipped = false) => {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }

      if (!activeStep) return;

      if (!isLastStepInChapter) {
        setTutorialStepPosition(userId, {
          chapterId: activeChapter.id,
          stepIndex: clampedStepIdx + 1,
          completedStepId: wasSkipped ? undefined : activeStep.id,
          skippedStepId: wasSkipped ? activeStep.id : undefined,
        });
        return;
      }

      // End of current chapter
      if (isSingleChapterMode || isLastChapter) {
        closeAllModals();
        finishTutorialRun(
          userId,
          wasSkipped ? undefined : activeStep.id,
          activeChapter.id
        );
        return;
      }

      // Move to Chapter + 1, Step 0
      const nextChapter = TUTORIAL_CHAPTERS[chapterIndexInList + 1];
      setTutorialStepPosition(userId, {
        chapterId: nextChapter.id,
        stepIndex: 0,
        completedStepId: wasSkipped ? undefined : activeStep.id,
        skippedStepId: wasSkipped ? activeStep.id : undefined,
        completedChapterId: activeChapter.id,
      });
    },
    [
      activeStep,
      isLastStepInChapter,
      userId,
      activeChapter.id,
      clampedStepIdx,
      isSingleChapterMode,
      isLastChapter,
      chapterIndexInList,
      closeAllModals,
    ]
  );

  // Auto-advance interactive navigation/modal-open steps smoothly once verified
  useEffect(() => {
    if (
      !runtime.isTourActive ||
      !activeStep ||
      !activeStep.autoAdvanceOnComplete ||
      !isActionCompleted
    ) {
      return;
    }

    if (autoAdvanceTimerRef.current !== null) return;
    triggerSuccessHaptic();
    autoAdvanceTimerRef.current = window.setTimeout(() => {
      autoAdvanceTimerRef.current = null;
      handleAdvance(false);
    }, 320);
  }, [runtime.isTourActive, activeStep, isActionCompleted, handleAdvance]);

  const handlePrev = useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    if (clampedStepIdx > 0) {
      setTutorialStepPosition(userId, {
        chapterId: activeChapter.id,
        stepIndex: clampedStepIdx - 1,
      });
      return;
    }

    if (!isSingleChapterMode && chapterIndexInList > 0) {
      const prevChapter = TUTORIAL_CHAPTERS[chapterIndexInList - 1];
      setTutorialStepPosition(userId, {
        chapterId: prevChapter.id,
        stepIndex: Math.max(0, prevChapter.steps.length - 1),
      });
    }
  }, [clampedStepIdx, userId, activeChapter.id, isSingleChapterMode, chapterIndexInList]);

  const handleSkipChapter = useCallback(() => {
    if (isSingleChapterMode || isLastChapter) {
      closeAllModals();
      exitTutorialSession(userId, true);
      return;
    }
    const nextChapter = TUTORIAL_CHAPTERS[chapterIndexInList + 1];
    closeAllModals();
    setTutorialStepPosition(userId, {
      chapterId: nextChapter.id,
      stepIndex: 0,
    });
  }, [isSingleChapterMode, isLastChapter, closeAllModals, userId, chapterIndexInList]);

  const handleRetryTarget = useCallback(() => {
    preparedStepKeyRef.current = '';
    activeStep?.prepare?.(appActionsRef.current, appSnapshotRef.current);
    window.setTimeout(() => {
      recheckNow();
    }, 120);
  }, [activeStep, recheckNow]);

  const handlePerformShowMe = useCallback(() => {
    if (!activeStep?.performShowMe) return;
    activeStep.performShowMe(appActionsRef.current, appSnapshotRef.current);
    if (!activeStep.autoAdvanceOnComplete) {
      window.setTimeout(() => {
        handleAdvance(false);
      }, 240);
    }
  }, [activeStep, handleAdvance]);

  const handleRunPracticeAction = useCallback(() => {
    activeStep?.onPracticeAction?.(appActionsRef.current, appSnapshotRef.current);
    window.setTimeout(() => {
      recheckNow();
    }, 120);
  }, [activeStep, recheckNow]);

  const handleExitTour = useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    closeAllModals();
    // Pause safely if user exits mid-tour? No: requirement says if user skips/dismisses onboarding,
    // do not show repeatedly on every login; user can always restart or resume from Settings!
    exitTutorialSession(userId, true);
  }, [closeAllModals, userId]);

  const handleCleanupPracticeData = useCallback(() => {
    const res = cleanupPracticeEntities(userId);
    onDataChanged();
    const totalRemoved = res.removedStudents + res.removedGroups;
    if (totalRemoved > 0) {
      onShowToast?.(
        isEn
          ? `Removed ${totalRemoved} [Practice] sample item(s). Real data untouched.`
          : `تم مسح ${totalRemoved} سجل تجريبي [تجريبي] بنجاح دون المساس ببياناتك الحقيقية.`
      );
    }
  }, [userId, onDataChanged, onShowToast, isEn]);

  const practiceStats = useMemo(
    () => getActivePracticeEntitiesCount(userId),
    [userId, students, groups, persisted.practiceStudentIds, persisted.practiceGroupIds]
  );

  if (!isAppReady || !userId) return null;

  const showFirstLoginModal =
    !runtime.isTourActive &&
    !runtime.isChapterHubOpen &&
    !runtime.isCompletionModalOpen &&
    shouldShowFirstLoginChoice(userId);

  const showInterruptedResumeModal =
    !runtime.isTourActive &&
    !runtime.isChapterHubOpen &&
    !runtime.isCompletionModalOpen &&
    !showFirstLoginModal &&
    shouldShowInterruptedTourPrompt(userId);

  const activeDialogMode = runtime.isCompletionModalOpen
    ? 'completed'
    : showInterruptedResumeModal
    ? 'resume'
    : 'welcome';

  const isDialogOpen =
    showFirstLoginModal || showInterruptedResumeModal || runtime.isCompletionModalOpen;

  return (
    <>
      {/* 1. First-Login Choice / Mid-Tour Resume / Completion Celebration Modal */}
      <FirstLoginWelcomeModal
        isOpen={isDialogOpen}
        mode={activeDialogMode}
        activeChapterId={persisted.activeChapterId}
        activeStepIndex={persisted.activeStepIndex}
        completedChaptersCount={persisted.completedChapterIds.length}
        practiceEntitiesCount={practiceStats.totalCount}
        onStartFullTour={() => startFullTutorial(userId, false)}
        onResumeTour={() => resumeTutorial(userId)}
        onOpenChapterHub={() => {
          if (showFirstLoginModal) {
            dismissFirstLoginTutorial(userId);
          }
          openTutorialChapterHub();
        }}
        onExploreOnOwn={() => dismissFirstLoginTutorial(userId)}
        onCloseCompletion={() => closeTutorialCompletionModal()}
        onCleanupPracticeData={handleCleanupPracticeData}
      />

      {/* 2. Chapter Picker Hub Modal */}
      <TutorialChapterHubModal
        isOpen={runtime.isChapterHubOpen}
        persistedState={persisted}
        practiceEntitiesCount={practiceStats.totalCount}
        onClose={() => closeTutorialChapterHub()}
        onStartFullTour={() => startFullTutorial(userId, false)}
        onResumeSavedTour={() => resumeTutorial(userId)}
        onSelectChapter={(chapterId: TutorialChapterId) =>
          startTutorialChapter(userId, chapterId, 'single_chapter')
        }
        onResetProgress={() => resetTutorialProgress(userId)}
        onCleanupPracticeData={handleCleanupPracticeData}
      />

      {/* 3. Active Spotlight + Step Instruction Card */}
      {runtime.isTourActive && activeStep && (
        <TutorialOverlay
          chapter={activeChapter}
          step={activeStep}
          stepIndex={clampedStepIdx}
          totalChapterSteps={activeChapter.steps.length}
          globalStepNumber={getGlobalStepNumber(activeChapter.id, clampedStepIdx)}
          totalGlobalSteps={getTotalStepsCount()}
          isSingleChapterMode={isSingleChapterMode}
          canGoBack={canGoBack}
          isLastStepInRun={isLastStepInRun}
          bounds={bounds}
          isSearchingTarget={isSearchingTarget}
          isTargetMissing={isTargetMissing}
          isActionCompleted={isActionCompleted}
          onPrev={handlePrev}
          onNext={() => handleAdvance(false)}
          onSkipStep={() => handleAdvance(true)}
          onSkipChapter={handleSkipChapter}
          onRetryTarget={handleRetryTarget}
          onPerformShowMe={handlePerformShowMe}
          onRunPracticeAction={handleRunPracticeAction}
          onOpenChapterHub={() => openTutorialChapterHub()}
          onExitTour={handleExitTour}
        />
      )}
    </>
  );
};

export default GuidedTutorial;
