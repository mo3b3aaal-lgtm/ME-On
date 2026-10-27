import fs from 'node:fs';
import path from 'node:path';

const storageMap = new Map<string, string>();
(global as any).localStorage = {
  getItem: (k: string) => storageMap.get(k) || null,
  setItem: (k: string, v: any) => storageMap.set(k, String(v)),
  removeItem: (k: string) => storageMap.delete(k),
  clear: () => storageMap.clear(),
  get length() {
    return storageMap.size;
  },
  key: (i: number) => Array.from(storageMap.keys())[i] || null,
};

(global as any).window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  location: { protocol: 'http:', hostname: 'localhost', origin: 'http://localhost' },
  localStorage: (global as any).localStorage,
};

(global as any).document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  visibilityState: 'visible',
  documentElement: { lang: 'ar', dir: 'rtl' },
  querySelectorAll: () => [],
};

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runTutorialVerificationSuite() {
  console.log('============================================================================');
  console.log('CLASSY — INTERACTIVE HANDS-ON ONBOARDING TUTORIAL VERIFICATION SUITE');
  console.log('============================================================================\n');

  const { db } = await import('./storage');
  const tutorialProgress = await import('./tutorialProgress');
  const tutorialStepsMod = await import('../components/tutorial/tutorialSteps');

  const {
    __resetTutorialMemoryCacheForTests,
    cleanupPracticeEntities,
    closeTutorialChapterHub,
    closeTutorialCompletionModal,
    createSafePracticeGroup,
    createSafePracticeStudent,
    dismissFirstLoginTutorial,
    exitTutorialSession,
    finishTutorialRun,
    getActivePracticeEntitiesCount,
    getTutorialPersistedState,
    getTutorialRuntimeUIState,
    getTutorialStorageKey,
    isPracticeLabeledName,
    openTutorialChapterHub,
    PRACTICE_TAG_AR,
    PRACTICE_TAG_EN,
    resetTutorialProgress,
    resumeTutorial,
    setTutorialStepPosition,
    shouldShowFirstLoginChoice,
    shouldShowInterruptedTourPrompt,
    startFullTutorial,
    startTutorialChapter,
  } = tutorialProgress;

  const {
    getChapterById,
    getGlobalStepNumber,
    getTotalStepsCount,
    TUTORIAL_CHAPTERS,
  } = tutorialStepsMod;

  let passedCount = 0;
  const pass = (label: string) => {
    passedCount++;
    console.log(`  ✓ [${passedCount}] ${label}`);
  };

  // =========================================================================
  // SUITE 1: FIRST-LOGIN CHOICE & PER-ACCOUNT ISOLATION
  // =========================================================================
  console.log('Suite 1: First-Login Onboarding Choice & Multi-Account Isolation');
  storageMap.clear();
  __resetTutorialMemoryCacheForTests();

  const userA = 'usr_teacher_alpha';
  const userB = 'usr_teacher_beta';

  assert(
    shouldShowFirstLoginChoice(userA) === true,
    'Fresh userA should be offered first-login onboarding choice'
  );
  assert(
    shouldShowInterruptedTourPrompt(userA) === false,
    'Fresh userA should NOT show interrupted tour resume prompt'
  );
  assert(
    shouldShowFirstLoginChoice(null) === false && shouldShowFirstLoginChoice('') === false,
    'Unauthenticated session must never trigger onboarding choice'
  );
  pass('First-login prompt offered only to authenticated new account');

  // Dismiss ("Explore on My Own") for userA
  dismissFirstLoginTutorial(userA);
  assert(
    shouldShowFirstLoginChoice(userA) === false,
    'After choosing "Explore on My Own", userA must not see first-login prompt'
  );
  assert(
    getTutorialPersistedState(userA).status === 'dismissed',
    'userA status persisted as dismissed'
  );
  assert(
    shouldShowFirstLoginChoice(userB) === true,
    'userB tutorial state must remain completely independent of userA'
  );
  pass('Multi-account scoping isolates userA dismissal from userB');

  // Simulate full browser reload & subsequent login for userA
  __resetTutorialMemoryCacheForTests();
  assert(
    shouldShowFirstLoginChoice(userA) === false,
    'userA must NEVER be re-prompted on subsequent logins after dismissal'
  );
  assert(
    shouldShowInterruptedTourPrompt(userA) === false,
    'Dismissed userA must not see resume prompt on reload'
  );
  pass('Dismissal persists across browser reloads without nagging userA');

  // =========================================================================
  // SUITE 2: MID-TOUR PERSISTENCE & INTERRUPTION RECOVERY
  // =========================================================================
  console.log('\nSuite 2: Mid-Tour Persistence & Interruption Recovery');
  const startedState = startFullTutorial(userB, false);
  assert(startedState.status === 'in_progress', 'Starting tour sets status to in_progress');
  assert(startedState.runScope === 'full', 'Full tour sets runScope = full');
  assert(
    startedState.activeChapterId === 'getting_started' && startedState.activeStepIndex === 0,
    'Full tour starts at Chapter A Step 0'
  );
  assert(
    getTutorialRuntimeUIState().isTourActive === true,
    'Runtime spotlight tour becomes active immediately'
  );
  assert(
    shouldShowFirstLoginChoice(userB) === false,
    'First-login modal hidden once tour starts'
  );
  pass('Full tour launches cleanly at Chapter A Step 0');

  // Advance userB through Chapter A -> Chapter B -> Chapter C Step 2
  setTutorialStepPosition(userB, {
    chapterId: 'students',
    stepIndex: 0,
    completedStepId: 'a6_return_from_settings',
    completedChapterId: 'getting_started',
  });
  setTutorialStepPosition(userB, {
    chapterId: 'groups',
    stepIndex: 2,
    completedStepId: 'c2_tap_add_group_btn',
    skippedStepId: 'b4_student_form_and_periods',
    completedChapterId: 'students',
  });

  // Simulate accidental page refresh mid-tutorial
  __resetTutorialMemoryCacheForTests();
  assert(
    getTutorialRuntimeUIState().isTourActive === false,
    'After fresh reload, spotlight overlay waits for user confirmation before blocking screen'
  );
  assert(
    shouldShowFirstLoginChoice(userB) === false,
    'Reloaded mid-tour userB does NOT see first-login welcome screen'
  );
  assert(
    shouldShowInterruptedTourPrompt(userB) === true,
    'Reloaded mid-tour userB IS offered Resume Where I Left Off prompt'
  );

  const reloadedB = getTutorialPersistedState(userB);
  assert(
    reloadedB.activeChapterId === 'groups' && reloadedB.activeStepIndex === 2,
    'Exact chapter (groups) and step index (2) recovered after reload'
  );
  assert(
    reloadedB.completedChapterIds.includes('getting_started') &&
      reloadedB.completedChapterIds.includes('students'),
    'Completed chapters preserved across reload'
  );
  assert(
    reloadedB.skippedStepIds.includes('b4_student_form_and_periods'),
    'Skipped step tracking preserved across reload'
  );
  pass('Mid-tutorial reload preserves exact chapter, step index, completed & skipped badges');

  resumeTutorial(userB);
  assert(
    getTutorialRuntimeUIState().isTourActive === true &&
      shouldShowInterruptedTourPrompt(userB) === false,
    'Resuming tour reactivates spotlight and clears interruption prompt'
  );
  pass('Resume Where I Left Off restores active spotlight session cleanly');

  // Exit mid-tour safely
  exitTutorialSession(userB, true);
  __resetTutorialMemoryCacheForTests();
  assert(
    shouldShowFirstLoginChoice(userB) === false &&
      shouldShowInterruptedTourPrompt(userB) === false,
    'Exiting tour marks session dismissed so future logins are never interrupted'
  );
  pass('Explicit Exit Tour prevents unwanted prompts on future logins');

  // =========================================================================
  // SUITE 3: CHAPTER HUB, SINGLE-CHAPTER LAUNCH, COMPLETION & RESET
  // =========================================================================
  console.log('\nSuite 3: Settings Chapter Hub, Single-Chapter Mode & Reset');
  openTutorialChapterHub();
  assert(
    getTutorialRuntimeUIState().isChapterHubOpen === true &&
      getTutorialRuntimeUIState().isTourActive === false,
    'Opening Chapter Hub activates hub sheet'
  );
  closeTutorialChapterHub();
  assert(getTutorialRuntimeUIState().isChapterHubOpen === false, 'Closing Chapter Hub works');

  const singleState = startTutorialChapter(userB, 'reports_analytics', 'single_chapter');
  assert(
    singleState.runScope === 'single_chapter' &&
      singleState.activeChapterId === 'reports_analytics' &&
      singleState.activeStepIndex === 0,
    'Single-chapter launch targets Reports & Analytics at step 0'
  );

  finishTutorialRun(userB, 'f4_billing_streams_breakdown', 'reports_analytics');
  assert(
    getTutorialRuntimeUIState().isTourActive === false &&
      getTutorialRuntimeUIState().isCompletionModalOpen === true,
    'Finishing single chapter closes spotlight and opens completion modal'
  );
  assert(
    getTutorialPersistedState(userB).completedChapterIds.includes('reports_analytics'),
    'Single chapter completion badge recorded'
  );
  closeTutorialCompletionModal();
  pass('Single-chapter launch and completion flow verified');

  // Complete full tour
  startFullTutorial(userB, false);
  const fullDone = finishTutorialRun(userB, 'g5_relaunch_tutorial_anytime', 'settings_sync');
  assert(fullDone.status === 'completed' && Boolean(fullDone.completedAt), 'Full tour marks status completed');
  closeTutorialCompletionModal();

  // Reset completion badges from Chapter Hub
  const afterReset = resetTutorialProgress(userB);
  assert(
    afterReset.completedChapterIds.length === 0 &&
      afterReset.completedStepIds.length === 0 &&
      afterReset.firstLoginPromptHandled === true,
    'Reset clears completion badges while keeping firstLoginPromptHandled = true'
  );
  pass('Full tour completion and badge reset verified');

  // =========================================================================
  // SUITE 4: CURRICULUM INTEGRITY, DOM TARGET AUDIT & ACTION PREDICATES
  // =========================================================================
  console.log('\nSuite 4: 7-Chapter Curriculum, Static DOM Target Audit & Action Predicates');
  const expectedChapterIds = [
    'getting_started',
    'students',
    'groups',
    'sessions_attendance',
    'billing_payments',
    'reports_analytics',
    'settings_sync',
  ];
  assert(
    TUTORIAL_CHAPTERS.map((c) => c.id).join(',') === expectedChapterIds.join(','),
    'All 7 required chapters (A–G) present in exact sequence'
  );
  assert(getTotalStepsCount() === 31, `Expected 31 steps across 7 chapters, got ${getTotalStepsCount()}`);
  assert(getGlobalStepNumber('getting_started', 0) === 1, 'Global step 1 starts at Chapter A Step 0');
  assert(
    getGlobalStepNumber('settings_sync', getChapterById('settings_sync').steps.length - 1) === 31,
    'Final step resolves to global step 31'
  );
  pass('All 7 chapters (A–G) and 31 bilingual steps verified');

  // Read UI source files and confirm every targetId / fallbackTargetId exists in real JSX
  const uiFilesToScan = [
    'src/components/ui/ScreenHeader.tsx',
    'src/components/BottomNavBar.tsx',
    'src/components/DashboardView.tsx',
    'src/components/StudentsView.tsx',
    'src/components/AddEditStudentModal.tsx',
    'src/components/StudentProfileModal.tsx',
    'src/components/GroupsView.tsx',
    'src/components/AddEditGroupModal.tsx',
    'src/components/GroupProfileModal.tsx',
    'src/components/SessionsView.tsx',
    'src/components/RecordAttendanceModal.tsx',
    'src/components/AddPaymentModal.tsx',
    'src/components/ReportsView.tsx',
    'src/components/SettingsView.tsx',
  ];

  const combinedSource = uiFilesToScan
    .map((rel) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8'))
    .join('\n');

  const isTargetIdWiredInSource = (tid: string): boolean => {
    if (combinedSource.includes(`data-tutorial-id="${tid}"`)) return true;
    // Dynamic template IDs in BottomNavBar and ReportsView
    if (
      tid.startsWith('bottom-nav-') &&
      combinedSource.includes('data-tutorial-id={`bottom-nav-${tab.id}`}')
    ) {
      return true;
    }
    if (
      tid.startsWith('reports-subtab-') &&
      combinedSource.includes('data-tutorial-id={`reports-subtab-${sub.key}`}')
    ) {
      return true;
    }
    return false;
  };

  for (const ch of TUTORIAL_CHAPTERS) {
    assert(ch.titleAr.trim().length > 0 && ch.titleEn.trim().length > 0, `Chapter ${ch.id} bilingual titles`);
    for (const step of ch.steps) {
      assert(
        step.titleAr.trim().length > 0 &&
          step.titleEn.trim().length > 0 &&
          step.bodyAr.trim().length > 0 &&
          step.bodyEn.trim().length > 0,
        `Step ${step.id} must have complete Arabic & English copy`
      );
      assert(
        isTargetIdWiredInSource(step.targetId),
        `Target ID "${step.targetId}" (step ${step.id}) is missing from UI source files!`
      );
      if (step.fallbackTargetId) {
        assert(
          isTargetIdWiredInSource(step.fallbackTargetId),
          `Fallback Target ID "${step.fallbackTargetId}" (step ${step.id}) is missing from UI source files!`
        );
      }
    }
  }
  pass('Every single targetId & fallbackTargetId across all 29 steps is wired in real JSX components');

  // Execute interactive step prepare + performShowMe + isActionCompleted state transitions
  let mockSnap = {
    userId: userA,
    activeTab: 'dashboard' as any,
    studentsSegment: 'students' as 'students' | 'groups',
    studentsCount: 1,
    groupsCount: 1,
    sessionsCount: 1,
    isQuickAddOpen: false,
    isNotificationsOpen: false,
    isAddStudentOpen: false,
    isStudentProfileOpen: false,
    isAddGroupOpen: false,
    isGroupProfileOpen: false,
    isAttendanceOpen: false,
    isAddPaymentOpen: false,
    isEnrollOpen: false,
    isReportsAttendanceTrendsActive: false,
    isReportsBillingStreamsActive: false,
  };

  const mockActions = {
    navigateToTab: (tab: any) => {
      mockSnap = {
        ...mockSnap,
        activeTab: tab === 'groups' ? 'students' : tab,
        studentsSegment: tab === 'groups' ? 'groups' : tab === 'students' ? 'students' : mockSnap.studentsSegment,
      };
    },
    setStudentsSegment: (seg: 'students' | 'groups') => {
      mockSnap = { ...mockSnap, studentsSegment: seg };
    },
    closeAllModals: () => {
      mockSnap = {
        ...mockSnap,
        isQuickAddOpen: false,
        isNotificationsOpen: false,
        isAddStudentOpen: false,
        isStudentProfileOpen: false,
        isAddGroupOpen: false,
        isGroupProfileOpen: false,
        isAttendanceOpen: false,
        isAddPaymentOpen: false,
        isEnrollOpen: false,
      };
    },
    openAddStudent: () => {
      mockSnap = { ...mockSnap, isAddStudentOpen: true };
    },
    closeAddStudent: () => {
      mockSnap = { ...mockSnap, isAddStudentOpen: false };
    },
    openFirstStudentProfile: () => {
      mockSnap = { ...mockSnap, isStudentProfileOpen: true };
      return true;
    },
    closeStudentProfile: () => {
      mockSnap = { ...mockSnap, isStudentProfileOpen: false };
    },
    openAddGroup: () => {
      mockSnap = { ...mockSnap, isAddGroupOpen: true };
    },
    closeAddGroup: () => {
      mockSnap = { ...mockSnap, isAddGroupOpen: false };
    },
    openFirstGroupProfile: () => {
      mockSnap = { ...mockSnap, isGroupProfileOpen: true };
      return true;
    },
    closeGroupProfile: () => {
      mockSnap = { ...mockSnap, isGroupProfileOpen: false };
    },
    openFirstGroupAttendance: () => {
      mockSnap = { ...mockSnap, isAttendanceOpen: true };
      return true;
    },
    closeAttendance: () => {
      mockSnap = { ...mockSnap, isAttendanceOpen: false };
    },
    openAddPaymentPreview: () => {
      mockSnap = { ...mockSnap, isAddPaymentOpen: true };
    },
    closeAddPayment: () => {
      mockSnap = { ...mockSnap, isAddPaymentOpen: false };
    },
    openNotifications: () => {
      mockSnap = { ...mockSnap, isNotificationsOpen: true };
    },
    closeNotifications: () => {
      mockSnap = { ...mockSnap, isNotificationsOpen: false };
    },
    createPracticeStudent: () => {
      mockSnap = { ...mockSnap, studentsCount: mockSnap.studentsCount + 1 };
    },
    createPracticeGroup: () => {
      mockSnap = { ...mockSnap, groupsCount: mockSnap.groupsCount + 1 };
    },
    activateReportsSubTab: (_reportType: any, subTab?: string) => {
      mockSnap = {
        ...mockSnap,
        isReportsAttendanceTrendsActive: subTab === 'attendance_trends',
        isReportsBillingStreamsActive: subTab === 'billing_streams',
      };
    },
  };

  for (const ch of TUTORIAL_CHAPTERS) {
    for (const step of ch.steps) {
      step.prepare?.(mockActions, mockSnap);
      const entrySnap = { ...mockSnap };
      if (step.kind === 'interactive' && step.performShowMe && step.isActionCompleted) {
        assert(
          step.isActionCompleted(mockSnap, entrySnap) === false,
          `Interactive step ${step.id} should start incomplete after prepare()`
        );
        step.performShowMe(mockActions, mockSnap);
        assert(
          step.isActionCompleted(mockSnap, entrySnap) === true,
          `Interactive step ${step.id} should complete after performShowMe()`
        );
      }
    }
  }
  pass('All interactive step prepare() + performShowMe() + isActionCompleted() transitions verified');

  // =========================================================================
  // SUITE 5: REAL DATA PROTECTION & DOUBLE-GUARDED [تجريبي] SANDBOX CLEANUP
  // =========================================================================
  console.log('\nSuite 5: Real Data Protection & Double-Guarded [تجريبي] Sandbox Cleanup');
  storageMap.clear();
  __resetTutorialMemoryCacheForTests();

  const realUid = 'acc_real_teacher_test';
  const realUserAccount = {
    id: realUid,
    name: 'أستاذ محمد الحقيقي',
    email: 'real_teacher@classy.test',
    createdAt: '2026-07-01T00:00:00.000Z',
  };
  db.saveAccounts([realUserAccount as any]);
  db.setCurrentSession(realUserAccount as any);

  // Seed real data: 1 real group, 1 real student (with BOTH Group + Private independent services), session, attendance, payment
  const realGroupId = 'grp_real_physics_1';
  db.saveGroup({
    id: realGroupId,
    userId: realUid,
    name: 'مجموعة الفيزياء المتقدمة',
    subject: 'الفيزياء',
    gradeLevel: 'الصف الثالث الثانوي',
    type: 'group',
    scheduleDays: ['saturday', 'tuesday'],
    scheduleTime: '18:00',
    billingType: 'monthly',
    billingMode: 'monthly',
    defaultPrice: 400,
    accentColor: '#17375E',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const realStudent1Id = 'stu_real_ahmed_1';
  db.saveStudent({
    id: realStudent1Id,
    userId: realUid,
    name: 'أحمد محمود الحقيقي',
    phone: '01012345678',
    gradeLevel: 'الصف الثالث الثانوي',
    avatarColor: '#17375E',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Enroll real student in BOTH real group AND independent private lesson service
  const realGroupEnr = db.enrollStudent(realStudent1Id, realGroupId, {
    serviceType: 'group',
    customPrice: 400,
    billingType: 'monthly',
    billingMode: 'monthly',
    status: 'active',
  });
  const realGroupEnrId = realGroupEnr.id;
  const { enrollment: realPrivateEnr } = db.createPrivateLessonService(realStudent1Id, {
    subject: 'فيزياء مراجعة خاصة',
    sessionPrice: 200,
    billingType: 'per_session',
    billingMode: 'postpaid',
    scheduleDays: ['thursday'],
    scheduleTime: '20:00',
  });

  // Record a real session, attendance, and 400 EGP payment
  const realSessionId = 'ses_real_1';
  db.saveSession({
    id: realSessionId,
    groupId: realGroupId,
    title: 'حصة الفيزياء الأولى',
    date: '2026-10-24',
    dayName: 'السبت',
    month: 10,
    year: 2026,
    startTime: '18:00',
    status: 'completed',
    pricePerStudent: 400,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  db.saveAttendanceBatch(realSessionId, [
    {
      id: 'att_real_1',
      sessionId: realSessionId,
      studentId: realStudent1Id,
      enrollmentId: realGroupEnrId,
      status: 'present',
      isCharged: true,
      recordedAt: new Date().toISOString(),
    },
  ]);
  db.savePayment({
    id: 'pay_real_1',
    userId: realUid,
    studentId: realStudent1Id,
    groupId: realGroupId,
    enrollmentId: realGroupEnrId,
    amount: 400,
    date: '2026-10-24',
    month: 10,
    year: 2026,
    targetMonth: 10,
    targetYear: 2026,
    paymentMethod: 'cash',
    paymentType: 'specific_month',
    createdAt: new Date().toISOString(),
  });

  // Create safe practice entities during tutorial
  const practiceStu = createSafePracticeStudent(realUid, false);
  const practiceStuDuplicateCall = createSafePracticeStudent(realUid, false);
  assert(
    practiceStu.id === practiceStuDuplicateCall.id,
    'createSafePracticeStudent must be idempotent while active practice student exists'
  );
  assert(
    practiceStu.id.startsWith('stu_tutorial_practice_') &&
      isPracticeLabeledName(practiceStu.name) &&
      practiceStu.name.includes(PRACTICE_TAG_AR),
    'Practice student carries stu_tutorial_practice_ prefix and [تجريبي] label'
  );

  const practiceGrp = createSafePracticeGroup(realUid, true);
  assert(
    practiceGrp.id.startsWith('grp_tutorial_practice_') &&
      isPracticeLabeledName(practiceGrp.name) &&
      practiceGrp.name.includes(PRACTICE_TAG_EN),
    'Practice group carries grp_tutorial_practice_ prefix and [Practice] label'
  );

  const activePracticeBeforeCleanup = getActivePracticeEntitiesCount(realUid);
  assert(
    activePracticeBeforeCleanup.studentsCount === 1 &&
      activePracticeBeforeCleanup.groupsCount === 1 &&
      activePracticeBeforeCleanup.totalCount === 2,
    'getActivePracticeEntitiesCount accurately reports 2 active practice items'
  );
  pass('Safe [تجريبي] / [Practice] sample student & group created idempotently');

  // ADVERSARIAL SAFETY TEST: Inject real student ID & real group ID into persisted practice arrays
  const storageKey = getTutorialStorageKey(realUid);
  const tamperedRaw = JSON.parse(localStorage.getItem(storageKey) || '{}');
  tamperedRaw.practiceStudentIds = [...(tamperedRaw.practiceStudentIds || []), realStudent1Id];
  tamperedRaw.practiceGroupIds = [...(tamperedRaw.practiceGroupIds || []), realGroupId];
  localStorage.setItem(storageKey, JSON.stringify(tamperedRaw));
  __resetTutorialMemoryCacheForTests();

  const cleanupResult = cleanupPracticeEntities(realUid);
  assert(
    cleanupResult.removedStudents === 1 && cleanupResult.removedGroups === 1,
    'cleanupPracticeEntities removed ONLY the 1 practice student and 1 practice group'
  );
  assert(
    getActivePracticeEntitiesCount(realUid).totalCount === 0,
    'Practice entity count is 0 after cleanup'
  );

  // Verify 100% of real data survived untouched!
  const remainingStudents = db.getStudents();
  const remainingGroups = db.getGroups();
  const remainingEnrollments = db.getEnrollments();
  const remainingSessions = db.getSessions();
  const remainingAttendance = db.getAttendance();
  const remainingPayments = db.getPayments();

  assert(
    remainingStudents.length === 1 && remainingStudents[0].id === realStudent1Id,
    'Real student survived adversarial cleanup 100% intact'
  );
  assert(
    remainingGroups.length === 1 && remainingGroups[0].id === realGroupId,
    'Real group survived adversarial cleanup 100% intact'
  );
  assert(
    remainingEnrollments.some((e) => e.id === realGroupEnrId && e.serviceType !== 'private') &&
      remainingEnrollments.some((e) => e.id === realPrivateEnr.id && e.serviceType === 'private'),
    'Both real Group enrollment AND independent Private lesson service survived intact'
  );
  assert(remainingSessions.length === 1 && remainingSessions[0].id === realSessionId, 'Real session intact');
  assert(remainingAttendance.length === 1 && remainingAttendance[0].id === 'att_real_1', 'Real attendance intact');
  assert(remainingPayments.length === 1 && remainingPayments[0].amount === 400, 'Real payment intact');
  pass('Adversarial double-guard verified: 100% of real students, groups, enrollments, sessions & payments preserved');

  console.log('\n============================================================================');
  console.log(`ALL ${passedCount} ONBOARDING TUTORIAL VERIFICATION CHECKS PASSED!`);
  console.log('============================================================================');
  process.exit(0);
}

runTutorialVerificationSuite().catch((err) => {
  console.error('\nTUTORIAL VERIFICATION FAILED:', err);
  process.exit(1);
});
