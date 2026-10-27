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

class MockOscillator {
  type: string = 'sine';
  frequency = { setValueAtTime: () => {} };
  connect() {}
  start() {}
  stop() {}
}

class MockGain {
  gain = {
    setValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
  };
  connect() {}
}

let audioOscillatorsCreated = 0;
class MockAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  async resume() {}
  async close() {}
  createOscillator() {
    audioOscillatorsCreated++;
    return new MockOscillator();
  }
  createGain() {
    return new MockGain();
  }
}

(global as any).window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { protocol: 'http:', hostname: 'localhost', origin: 'http://localhost' },
  localStorage: (global as any).localStorage,
  AudioContext: MockAudioContext,
  Notification: Object.assign(
    function MockNotification() {
      return { close: () => {} };
    },
    {
      permission: 'granted',
      requestPermission: async () => 'granted',
    }
  ),
};

(global as any).document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  visibilityState: 'visible',
};

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function formatOffsetDate(base: Date, daysOffset: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + daysOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function runNotificationVerificationSuite() {
  console.log('======================================================================');
  console.log('CLASSY — PROFESSIONAL NOTIFICATION CENTER & ALERTS VERIFICATION SUITE');
  console.log('======================================================================\n');

  const notifCenter = await import('./notificationCenter');
  const { db } = await import('./storage');

  const {
    evaluateNotifications,
    getUnreadNotificationsCount,
    reconcileScheduledNotifications,
    getScheduledRegistry,
    normalizeNotificationSettings,
    normalizeSoundPreset,
    playNotificationSoundTone,
    isWithinQuietHours,
    shouldSuppressMobileAlert,
    getQuietHoursEndTimestamp,
    notifySyncOutcome,
    notifyBackupOrRestoreEvent,
    clearNotificationHistoryForUser,
    restoreDefaultNotificationSettings,
    getPersistedNotificationEvents,
  } = notifCenter;

  let passedScenarios = 0;
  const pass = (num: number, title: string) => {
    passedScenarios++;
    console.log(`  [PASS] Scenario ${String(num).padStart(2, '0')}: ${title}`);
  };

  // Base reference date at 09:00 local time so upcoming lessons later today are cleanly in the future
  const nowBase = new Date(2026, 9, 26, 9, 0, 0, 0);
  const curMonth = nowBase.getMonth() + 1;
  const curYear = nowBase.getFullYear();
  const todayStr = formatOffsetDate(nowBase, 0);
  const tomorrowStr = formatOffsetDate(nowBase, 1);
  const yesterdayStr = formatOffsetDate(nowBase, -1);
  const twoDaysAgoStr = formatOffsetDate(nowBase, -2);

  const userA = 'acc_verify_teacher_a';
  const userB = 'acc_verify_teacher_b';

  storageMap.clear();
  db.setCurrentSession({
    id: userA,
    name: 'Teacher A',
    email: 'teacher.a@classy.test',
    createdAt: nowBase.toISOString(),
  });

  // -------------------------------------------------------------------------
  // SCENARIO 2: Preferences Persistence & Per-Account Scope
  // -------------------------------------------------------------------------
  db.saveNotificationSettings(
    normalizeNotificationSettings({
      lessonReminderLeadMinutes: 30,
      enableBalanceThresholdAlert: true,
      balanceThresholdAmount: 350,
      soundPreset: 'soft_chime',
    }),
    userA
  );
  db.saveNotificationSettings(
    normalizeNotificationSettings({
      lessonReminderLeadMinutes: 10,
      enableBalanceThresholdAlert: false,
      soundPreset: 'silent',
    }),
    userB
  );

  const loadedA = normalizeNotificationSettings(db.getNotificationSettings(userA));
  const loadedB = normalizeNotificationSettings(db.getNotificationSettings(userB));
  assert(loadedA.lessonReminderLeadMinutes === 30, 'User A lead minutes should persist as 30');
  assert(loadedA.balanceThresholdAmount === 350, 'User A threshold should persist as 350');
  assert(loadedA.soundPreset === 'soft_chime', 'User A soundPreset should persist as soft_chime');
  assert(loadedB.lessonReminderLeadMinutes === 10, 'User B lead minutes should remain isolated as 10');
  assert(loadedB.soundPreset === 'silent', 'User B soundPreset should remain isolated as silent');
  pass(2, 'Preferences persistence across reloads and strict per-user isolation');

  // -------------------------------------------------------------------------
  // SCENARIO 3: Sound Presets, Legacy .wav Normalization & Web Audio Preview
  // -------------------------------------------------------------------------
  assert(normalizeSoundPreset('beep.wav') === 'default', 'Legacy beep.wav must normalize to default');
  assert(normalizeSoundPreset('crystal.wav') === 'soft_chime', 'Legacy crystal.wav must normalize to soft_chime');
  assert(normalizeSoundPreset('silent') === 'silent', 'Silent preset must remain silent');

  const silentResult = await playNotificationSoundTone('silent', { isPreview: true });
  assert(
    silentResult.played === false && silentResult.reason === 'silent_preset',
    'Silent preset must not play audio'
  );

  audioOscillatorsCreated = 0;
  const chimeResult = await playNotificationSoundTone('soft_chime', { isPreview: true });
  assert(
    chimeResult.played === true && audioOscillatorsCreated >= 2,
    'Soft chime preview must synthesize oscillators cleanly'
  );
  pass(3, 'Verified sound presets, legacy .wav normalization, and Web Audio tone preview');

  // -------------------------------------------------------------------------
  // SCENARIO 4 & 5: Concrete Group vs Private Lesson Reminders (Never Infinite Daily)
  // -------------------------------------------------------------------------
  const grpMath = {
    id: 'grp_math_1',
    userId: userA,
    name: 'Math Group A',
    subject: 'Mathematics',
    accentColor: '#17375E',
    type: 'group' as const,
    gradeLevel: 'prep_2' as const,
    defaultPrice: 100,
    billingType: 'postpaid' as const,
    billingMode: 'postpaid' as const,
    scheduleDays: [],
    createdAt: nowBase.toISOString(),
  };
  db.saveGroup(grpMath);

  const stuOmar = {
    id: 'stu_omar',
    userId: userA,
    name: 'Omar Khaled',
    phone: '01000000001',
    parentPhone: '01000000002',
    avatarColor: '#17375E',
    status: 'active' as const,
    createdAt: nowBase.toISOString(),
  };
  const stuSaraPrivate = {
    id: 'stu_sara_priv',
    userId: userA,
    name: 'Sara Private',
    phone: '01000000003',
    avatarColor: '#0F766E',
    status: 'active' as const,
    createdAt: nowBase.toISOString(),
  };
  db.saveStudent(stuOmar);
  db.saveStudent(stuSaraPrivate);

  db.updateEnrollment({
    id: 'enr_omar_grp',
    userId: userA,
    studentId: stuOmar.id,
    groupId: grpMath.id,
    serviceType: 'group',
    billingType: 'postpaid',
    billingMode: 'postpaid',
    customPrice: 100,
    sessionCredit: 0,
    financialCredit: 0,
    discount: 0,
    status: 'active',
    joinedAt: yesterdayStr,
  });

  db.updateEnrollment({
    id: 'enr_sara_priv',
    userId: userA,
    studentId: stuSaraPrivate.id,
    groupId: '',
    serviceType: 'private',
    subject: 'Physics',
    billingType: 'postpaid',
    billingMode: 'postpaid',
    customPrice: 250,
    sessionCredit: 0,
    financialCredit: 0,
    discount: 0,
    status: 'active',
    joinedAt: yesterdayStr,
  });

  // Single-date group session tomorrow at 14:00 (lead = 30m -> 13:30)
  const grpSessionTomorrow = {
    id: 'sess_grp_tomorrow',
    userId: userA,
    groupId: grpMath.id,
    title: 'Algebra Review',
    date: tomorrowStr,
    dayName: 'Tuesday',
    month: curMonth,
    year: curYear,
    startTime: '14:00',
    endTime: '15:30',
    status: 'scheduled' as const,
    createdAt: nowBase.toISOString(),
  };
  // Single-date private session tomorrow at 17:00 (lead = 30m -> 16:30)
  const privSessionTomorrow = {
    id: 'sess_priv_tomorrow',
    userId: userA,
    groupId: '',
    studentId: stuSaraPrivate.id,
    enrollmentId: 'enr_sara_priv',
    title: 'Private Physics',
    date: tomorrowStr,
    dayName: 'Tuesday',
    month: curMonth,
    year: curYear,
    startTime: '17:00',
    endTime: '18:00',
    status: 'scheduled' as const,
    createdAt: nowBase.toISOString(),
  };
  db.saveSession(grpSessionTomorrow);
  db.saveSession(privSessionTomorrow);

  await reconcileScheduledNotifications({ userId: userA, isEn: true, now: nowBase });
  const regAfterSchedule = getScheduledRegistry(userA);
  const scheduledEntries = Object.values(regAfterSchedule);

  const grpUpcoming = scheduledEntries.filter(
    (r) => r.extra?.sessionId === grpSessionTomorrow.id && r.category === 'lesson_reminders'
  );
  const privUpcoming = scheduledEntries.filter(
    (r) => r.extra?.sessionId === privSessionTomorrow.id && r.category === 'lesson_reminders'
  );

  assert(
    grpUpcoming.length === 1,
    'Single-date group lesson must schedule exactly 1 concrete reminder (never recurring)'
  );
  assert(
    grpUpcoming[0].extra.actionType === 'record_attendance' && grpUpcoming[0].extra.isPrivate === false,
    'Group lesson reminder must route to record_attendance with isPrivate=false'
  );
  const expectedGrpTrigger = new Date(
    nowBase.getFullYear(),
    nowBase.getMonth(),
    nowBase.getDate() + 1,
    13,
    30,
    0,
    0
  ).toISOString();
  assert(
    grpUpcoming[0].triggerAt === expectedGrpTrigger,
    'Group lesson reminder must respect 30m lead time (13:30)'
  );
  pass(4, 'Concrete group lesson reminder scheduled with exact lead time & no infinite recurrence');

  assert(privUpcoming.length === 1, 'Single-date private lesson must schedule exactly 1 concrete reminder');
  assert(
    privUpcoming[0].extra.actionType === 'open_private_session' && privUpcoming[0].extra.isPrivate === true,
    'Private lesson reminder must route to open_private_session with isPrivate=true'
  );
  // Verify independent toggle isolation: disabling group reminders keeps private reminder
  db.saveNotificationSettings(
    normalizeNotificationSettings({
      ...db.getNotificationSettings(userA),
      enableGroupLessonReminders: false,
      enablePrivateLessonReminders: true,
    }),
    userA
  );
  await reconcileScheduledNotifications({ userId: userA, isEn: true, now: nowBase });
  const regPrivOnly = Object.values(getScheduledRegistry(userA));
  assert(
    !regPrivOnly.some((r) => r.extra?.sessionId === grpSessionTomorrow.id && r.category === 'lesson_reminders') &&
      regPrivOnly.some(
        (r) => r.extra?.sessionId === privSessionTomorrow.id && r.category === 'lesson_reminders'
      ),
    'Disabling group lesson reminders must preserve private lesson reminders'
  );
  // Re-enable group reminders
  db.saveNotificationSettings(
    normalizeNotificationSettings({
      ...db.getNotificationSettings(userA),
      enableGroupLessonReminders: true,
    }),
    userA
  );
  await reconcileScheduledNotifications({ userId: userA, isEn: true, now: nowBase });
  pass(5, 'Private lesson reminder strictly isolated from group lesson reminders & bulk attendance');

  // -------------------------------------------------------------------------
  // SCENARIO 6: Schedule Edit & Cancellation Reconciliation (No Duplicates)
  // -------------------------------------------------------------------------
  db.saveSession({
    ...grpSessionTomorrow,
    startTime: '16:00',
    endTime: '17:30',
  });
  await reconcileScheduledNotifications({ userId: userA, isEn: true, now: nowBase });
  const regEdited = Object.values(getScheduledRegistry(userA)).filter(
    (r) => r.extra?.sessionId === grpSessionTomorrow.id && r.category === 'lesson_reminders'
  );
  const expectedUpdatedGrpTrigger = new Date(
    nowBase.getFullYear(),
    nowBase.getMonth(),
    nowBase.getDate() + 1,
    15,
    30,
    0,
    0
  ).toISOString();
  assert(
    regEdited.length === 1 && regEdited[0].triggerAt === expectedUpdatedGrpTrigger,
    'Edited lesson time must update triggerAt without duplicates'
  );

  // Cancel private session -> scheduled reminder must be removed
  db.saveSession({
    ...privSessionTomorrow,
    status: 'cancelled',
  });
  await reconcileScheduledNotifications({ userId: userA, isEn: true, now: nowBase });
  const regAfterCancel = Object.values(getScheduledRegistry(userA)).filter(
    (r) => r.extra?.sessionId === privSessionTomorrow.id
  );
  assert(regAfterCancel.length === 0, 'Cancelling a lesson must cancel its scheduled alarms');
  db.deleteSession(grpSessionTomorrow.id);
  await reconcileScheduledNotifications({ userId: userA, isEn: true, now: nowBase });
  assert(
    Object.values(getScheduledRegistry(userA)).filter((r) => r.extra?.sessionId === grpSessionTomorrow.id)
      .length === 0,
    'Deleting a lesson must remove its scheduled alarms'
  );
  pass(6, 'Lesson time edits update alarms in-place and cancellations/deletions remove them');

  // -------------------------------------------------------------------------
  // SCENARIO 1: Master Notification Toggle OFF vs ON
  // -------------------------------------------------------------------------
  const sessionTodayMorning = {
    id: 'sess_today_unrec',
    userId: userA,
    groupId: grpMath.id,
    title: 'Morning Geometry',
    date: todayStr,
    dayName: 'Monday',
    month: curMonth,
    year: curYear,
    startTime: '08:00',
    endTime: '08:45',
    status: 'scheduled' as const,
    createdAt: nowBase.toISOString(),
  };
  db.saveSession(sessionTodayMorning);

  const evalWhenOn = evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase });
  assert(
    evalWhenOn.some((n) => n.type === 'unrecorded_attendance'),
    'Active alerts must appear when master toggle is ON'
  );

  db.saveNotificationSettings(
    normalizeNotificationSettings({
      ...db.getNotificationSettings(userA),
      enableNotifications: false,
    }),
    userA
  );
  await reconcileScheduledNotifications({ userId: userA, isEn: true, now: nowBase });
  const evalWhenOff = evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase });
  assert(evalWhenOff.length === 0, 'Master toggle OFF must suppress all in-app notifications');
  assert(
    Object.keys(getScheduledRegistry(userA)).length === 0,
    'Master toggle OFF must clear scheduled notifications'
  );
  assert(
    shouldSuppressMobileAlert(
      nowBase,
      'critical',
      normalizeNotificationSettings(db.getNotificationSettings(userA))
    ) === true,
    'Master toggle OFF must suppress mobile alerts'
  );

  // Restore master toggle ON
  db.saveNotificationSettings(
    normalizeNotificationSettings({
      ...db.getNotificationSettings(userA),
      enableNotifications: true,
    }),
    userA
  );
  await reconcileScheduledNotifications({ userId: userA, isEn: true, now: nowBase });
  pass(1, 'Master notification toggle OFF disables mobile/in-app/scheduled alerts and ON restores them');

  // -------------------------------------------------------------------------
  // SCENARIO 7: Completing Attendance Clears Pending Alerts & Sweep Reminders
  // -------------------------------------------------------------------------
  const regWithUnrecorded = Object.values(getScheduledRegistry(userA));
  assert(
    regWithUnrecorded.some((r) => r.key.startsWith('daily_att_sweep_') || r.key.startsWith('post_att_')),
    'Unrecorded session today must schedule post-lesson / daily sweep reminder'
  );

  db.saveAttendanceBatch(sessionTodayMorning.id, [
    {
      id: 'att_omar_1',
      userId: userA,
      sessionId: sessionTodayMorning.id,
      studentId: stuOmar.id,
      enrollmentId: 'enr_omar_grp',
      status: 'present',
      isCharged: true,
      recordedAt: nowBase.toISOString(),
    },
  ]);
  await reconcileScheduledNotifications({ userId: userA, isEn: true, now: nowBase });

  const afterAttItems = evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase });
  assert(
    !afterAttItems.some((n) => n.type === 'unrecorded_attendance' && n.sessionId === sessionTodayMorning.id),
    'Recording attendance must immediately remove unrecorded_attendance alert'
  );
  const regAfterAtt = Object.values(getScheduledRegistry(userA));
  assert(
    !regAfterAtt.some((r) => r.key.startsWith('daily_att_sweep_') || r.key.includes(sessionTodayMorning.id)),
    'Recording all attendance for today must cancel post-lesson & daily sweep reminders'
  );
  pass(7, 'Recording attendance clears unrecorded alert and cancels post-lesson & daily sweep alarms');

  // -------------------------------------------------------------------------
  // SCENARIO 8: Excused / Uncharged vs Charged Absence Accuracy
  // -------------------------------------------------------------------------
  const stuLayla = {
    id: 'stu_layla_excused',
    userId: userA,
    name: 'Layla Excused',
    phone: '01000000010',
    avatarColor: '#2563EB',
    status: 'active' as const,
    createdAt: nowBase.toISOString(),
  };
  db.saveStudent(stuLayla);
  db.updateEnrollment({
    id: 'enr_layla_grp',
    userId: userA,
    studentId: stuLayla.id,
    groupId: grpMath.id,
    serviceType: 'group',
    billingType: 'postpaid',
    billingMode: 'postpaid',
    customPrice: 120,
    sessionCredit: 0,
    financialCredit: 0,
    discount: 0,
    status: 'active',
    joinedAt: twoDaysAgoStr,
  });

  const sessExcused1 = {
    id: 'sess_layla_ex1',
    userId: userA,
    groupId: grpMath.id,
    title: 'Lesson Excused 1',
    date: twoDaysAgoStr,
    dayName: 'Saturday',
    month: curMonth,
    year: curYear,
    startTime: '10:00',
    status: 'completed' as const,
    createdAt: nowBase.toISOString(),
  };
  const sessExcused2 = {
    id: 'sess_layla_ex2',
    userId: userA,
    groupId: grpMath.id,
    title: 'Lesson Excused 2',
    date: yesterdayStr,
    dayName: 'Sunday',
    month: curMonth,
    year: curYear,
    startTime: '10:00',
    status: 'completed' as const,
    createdAt: nowBase.toISOString(),
  };
  db.saveSession(sessExcused1);
  db.saveSession(sessExcused2);

  db.saveAttendanceBatch(sessExcused1.id, [
    {
      id: 'att_layla_ex1',
      userId: userA,
      sessionId: sessExcused1.id,
      studentId: stuLayla.id,
      enrollmentId: 'enr_layla_grp',
      status: 'absent_free',
      isCharged: false,
      recordedAt: new Date(nowBase.getTime() - 86400000).toISOString(),
    },
  ]);
  db.saveAttendanceBatch(sessExcused2.id, [
    {
      id: 'att_layla_ex2',
      userId: userA,
      sessionId: sessExcused2.id,
      studentId: stuLayla.id,
      enrollmentId: 'enr_layla_grp',
      status: 'absent_free',
      isCharged: false,
      recordedAt: nowBase.toISOString(),
    },
  ]);

  const laylaFin = db.calculateStudentGrandFinancials(stuLayla.id);
  assert(laylaFin.grandRemaining === 0, 'Excused/uncharged absences must result in 0 financial debt');

  const itemsEnAfterExcused = evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase });
  const laylaSingleAbs = itemsEnAfterExcused.find(
    (n) => n.type === 'student_absent' && n.studentId === stuLayla.id && n.sessionId === sessExcused2.id
  );
  const laylaRepAbs = itemsEnAfterExcused.find(
    (n) => n.type === 'repeated_absence' && n.studentId === stuLayla.id
  );
  assert(Boolean(laylaSingleAbs), 'Excused absence must create non-charged student_absent alert');
  assert(laylaSingleAbs!.isChargedAbsence === false, 'Excused absence alert must have isChargedAbsence=false');
  assert(
    laylaSingleAbs!.description.toLowerCase().includes('uncharged') &&
      laylaSingleAbs!.description.toLowerCase().includes('no fee applied'),
    'Excused absence English description must explicitly state uncharged / no fee applied'
  );
  const itemsArAfterExcused = evaluateNotifications({ userId: userA, lang: 'ar', now: nowBase });
  const laylaSingleAbsAr = itemsArAfterExcused.find(
    (n) => n.type === 'student_absent' && n.studentId === stuLayla.id && n.sessionId === sessExcused2.id
  );
  assert(
    Boolean(laylaSingleAbsAr) && laylaSingleAbsAr!.description.includes('غير محسوب مالياً'),
    'Excused absence Arabic description must explicitly state غير محسوب مالياً'
  );
  assert(
    Boolean(laylaRepAbs) && laylaRepAbs!.description.toLowerCase().includes('no fee applied'),
    'Consecutive excused absences must explicitly state no fee applied'
  );
  assert(
    !itemsEnAfterExcused.some((n) => n.type === 'payment_overdue' && n.studentId === stuLayla.id),
    'Excused absences must never generate payment_overdue alerts'
  );
  pass(8, 'Excused/uncharged absences never generate financial charge wording or debt');

  // -------------------------------------------------------------------------
  // SCENARIO 9 & 10: Overdue Deduplication, Re-open on Debt Increase, Threshold & Today Debt
  // -------------------------------------------------------------------------
  // Omar attended 1 session today (100 EGP due, lesson today -> overdue + today_lesson_debt)
  const eval1 = evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase });
  const eval2 = evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase });
  const omarOverdueList1 = eval1.filter((n) => n.type === 'payment_overdue' && n.studentId === stuOmar.id);
  const omarOverdueList2 = eval2.filter((n) => n.type === 'payment_overdue' && n.studentId === stuOmar.id);
  assert(
    omarOverdueList1.length === 1 && omarOverdueList2.length === 1,
    'Overdue balance alert must deduplicate across evaluations'
  );
  assert(
    eval1.some((n) => n.type === 'today_lesson_debt' && n.studentId === stuOmar.id),
    'Student with debt and lesson today must trigger today_lesson_debt'
  );
  assert(
    !eval1.some((n) => n.type === 'balance_threshold_exceeded' && n.studentId === stuOmar.id),
    '100 EGP debt must not trigger 350 EGP balance threshold alert'
  );

  // Dismiss Omar's overdue alert; while debt remains 100 it stays dismissed
  db.dismissNotification(omarOverdueList1[0].id, userA);
  assert(
    !evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase }).some(
      (n) => n.type === 'payment_overdue' && n.studentId === stuOmar.id
    ),
    'Dismissed overdue alert should stay hidden while balance does not increase'
  );

  // Add 3 more attended sessions for Omar (+300 EGP -> 400 EGP total >= 350 threshold)
  for (let i = 1; i <= 3; i++) {
    const sid = `sess_omar_extra_${i}`;
    db.saveSession({
      id: sid,
      userId: userA,
      groupId: grpMath.id,
      title: `Extra Session ${i}`,
      date: yesterdayStr,
      dayName: 'Sunday',
      month: curMonth,
      year: curYear,
      startTime: `1${i}:00`,
      status: 'completed',
      createdAt: nowBase.toISOString(),
    });
    db.saveAttendanceBatch(sid, [
      {
        id: `att_omar_extra_${i}`,
        userId: userA,
        sessionId: sid,
        studentId: stuOmar.id,
        enrollmentId: 'enr_omar_grp',
        status: 'present',
        isCharged: true,
        recordedAt: nowBase.toISOString(),
      },
    ]);
  }

  const evalIncreased = evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase });
  assert(
    evalIncreased.some((n) => n.type === 'payment_overdue' && n.studentId === stuOmar.id && n.amount === 400),
    'Increasing unpaid debt must re-open dismissed overdue alert with updated 400 EGP balance'
  );
  assert(
    evalIncreased.some((n) => n.type === 'balance_threshold_exceeded' && n.studentId === stuOmar.id),
    '400 EGP debt (>= 350 threshold) must trigger balance_threshold_exceeded'
  );

  // Settle Omar's 400 EGP balance and verify payment confirmation (when enabled) + overdue resolution
  db.saveNotificationSettings(
    normalizeNotificationSettings({
      ...db.getNotificationSettings(userA),
      enablePaymentRecordedAlerts: true,
    }),
    userA
  );
  db.recordPayment({
    studentId: stuOmar.id,
    enrollmentId: 'enr_omar_grp',
    groupId: grpMath.id,
    amount: 400,
    paymentType: 'custom_amount',
    paymentMethod: 'cash',
    date: todayStr,
    month: curMonth,
    year: curYear,
  });

  const evalAfterPayActive = evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase });
  const evalAfterPayAll = evaluateNotifications({
    userId: userA,
    lang: 'en-US',
    includeResolved: true,
    now: nowBase,
  });
  assert(
    !evalAfterPayActive.some((n) => n.type === 'payment_overdue' && n.studentId === stuOmar.id),
    'Paying full balance must clear active payment_overdue alert'
  );
  assert(
    evalAfterPayAll.some(
      (n) => n.type === 'payment_overdue' && n.studentId === stuOmar.id && n.status === 'resolved'
    ),
    'Settled overdue balance must appear as status=resolved in history'
  );
  assert(
    evalAfterPayActive.some((n) => n.type === 'payment_recorded' && n.studentId === stuOmar.id),
    'Enabling payment recorded alerts must emit payment_recorded confirmation'
  );
  pass(9, 'Overdue balance deduplicates, re-opens on debt increase, and resolves upon settlement');
  pass(10, 'Configurable balance threshold, today-lesson student debt, and payment confirmation verified');

  // -------------------------------------------------------------------------
  // SCENARIO 11: Dynamic packageSessionsCount (4-lesson & 12-lesson packages — NEVER hardcoded to 8)
  // -------------------------------------------------------------------------
  const stuPkg4 = {
    id: 'stu_pkg_4',
    userId: userA,
    name: 'Nour 4-Pack',
    phone: '01000000021',
    avatarColor: '#7C3AED',
    status: 'active' as const,
    createdAt: nowBase.toISOString(),
  };
  const stuPkg12 = {
    id: 'stu_pkg_12',
    userId: userA,
    name: 'Kareem 12-Pack',
    phone: '01000000022',
    avatarColor: '#059669',
    status: 'active' as const,
    createdAt: nowBase.toISOString(),
  };
  db.saveStudent(stuPkg4);
  db.saveStudent(stuPkg12);

  db.updateEnrollment({
    id: 'enr_pkg_4',
    userId: userA,
    studentId: stuPkg4.id,
    groupId: '',
    serviceType: 'private',
    subject: 'Chemistry',
    billingType: 'package',
    billingMode: 'package',
    packageSessionsCount: 4,
    packagePrice: 400,
    customPrice: 100,
    sessionCredit: 0,
    financialCredit: 0,
    discount: 0,
    status: 'active',
    joinedAt: twoDaysAgoStr,
  });

  db.updateEnrollment({
    id: 'enr_pkg_12',
    userId: userA,
    studentId: stuPkg12.id,
    groupId: '',
    serviceType: 'private',
    subject: 'Biology',
    billingType: 'package',
    billingMode: 'package',
    packageSessionsCount: 12,
    packagePrice: 1200,
    customPrice: 100,
    sessionCredit: 0,
    financialCredit: 0,
    discount: 0,
    status: 'active',
    joinedAt: twoDaysAgoStr,
  });

  // Record 3 lessons for Nour (4-pack) -> 1 lesson remaining!
  for (let i = 1; i <= 3; i++) {
    const sid = `sess_pkg4_${i}`;
    db.saveSession({
      id: sid,
      userId: userA,
      groupId: '',
      studentId: stuPkg4.id,
      enrollmentId: 'enr_pkg_4',
      title: `Chem ${i}`,
      date: yesterdayStr,
      dayName: 'Sunday',
      month: curMonth,
      year: curYear,
      startTime: `0${8 + i}:00`,
      status: 'completed',
      createdAt: nowBase.toISOString(),
    });
    db.saveAttendanceBatch(sid, [
      {
        id: `att_pkg4_${i}`,
        userId: userA,
        sessionId: sid,
        studentId: stuPkg4.id,
        enrollmentId: 'enr_pkg_4',
        status: 'present',
        isCharged: true,
        recordedAt: nowBase.toISOString(),
      },
    ]);
  }

  const evalAt3Of4 = evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase });
  assert(
    evalAt3Of4.some(
      (n) =>
        n.type === 'package_one_remaining' &&
        n.studentId === stuPkg4.id &&
        n.packageSize === 4 &&
        n.lessonsRemaining === 1
    ),
    '4-lesson package at 3 attended lessons must trigger package_one_remaining (packageSize=4)'
  );

  // Record 4th lesson -> package_completed at 4/4!
  db.saveSession({
    id: 'sess_pkg4_4',
    userId: userA,
    groupId: '',
    studentId: stuPkg4.id,
    enrollmentId: 'enr_pkg_4',
    title: 'Chem 4',
    date: yesterdayStr,
    dayName: 'Sunday',
    month: curMonth,
    year: curYear,
    startTime: '13:00',
    status: 'completed',
    createdAt: nowBase.toISOString(),
  });
  db.saveAttendanceBatch('sess_pkg4_4', [
    {
      id: 'att_pkg4_4',
      userId: userA,
      sessionId: 'sess_pkg4_4',
      studentId: stuPkg4.id,
      enrollmentId: 'enr_pkg_4',
      status: 'present',
      isCharged: true,
      recordedAt: nowBase.toISOString(),
    },
  ]);

  const evalAt4Of4 = evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase });
  assert(
    evalAt4Of4.some(
      (n) =>
        n.type === 'package_completed' &&
        n.studentId === stuPkg4.id &&
        n.packageSize === 4 &&
        n.totalCompletedSessions === 4
    ),
    '4-lesson package at 4 attended lessons must trigger package_completed (4/4)'
  );

  // Pay 400 EGP for Nour -> package_completed must auto-resolve!
  db.recordPayment({
    studentId: stuPkg4.id,
    enrollmentId: 'enr_pkg_4',
    amount: 400,
    paymentType: 'custom_amount',
    paymentMethod: 'cash',
    date: todayStr,
    month: curMonth,
    year: curYear,
  });
  assert(
    !evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase }).some(
      (n) => n.type === 'package_completed' && n.studentId === stuPkg4.id
    ) &&
      evaluateNotifications({ userId: userA, lang: 'en-US', includeResolved: true, now: nowBase }).some(
        (n) => n.type === 'package_completed' && n.studentId === stuPkg4.id && n.status === 'resolved'
      ),
    'Paying package price must auto-resolve package_completed notification'
  );

  // Record 8 lessons for Kareem (12-pack) -> MUST NOT trigger package_completed at 8!
  for (let i = 1; i <= 8; i++) {
    const sid = `sess_pkg12_${i}`;
    db.saveSession({
      id: sid,
      userId: userA,
      groupId: '',
      studentId: stuPkg12.id,
      enrollmentId: 'enr_pkg_12',
      title: `Bio ${i}`,
      date: twoDaysAgoStr,
      dayName: 'Saturday',
      month: curMonth,
      year: curYear,
      startTime: `${String(8 + i).padStart(2, '0')}:00`,
      status: 'completed',
      createdAt: nowBase.toISOString(),
    });
    db.saveAttendanceBatch(sid, [
      {
        id: `att_pkg12_${i}`,
        userId: userA,
        sessionId: sid,
        studentId: stuPkg12.id,
        enrollmentId: 'enr_pkg_12',
        status: 'present',
        isCharged: true,
        recordedAt: nowBase.toISOString(),
      },
    ]);
  }
  const evalAt8Of12 = evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase });
  assert(
    !evalAt8Of12.some((n) => n.type === 'package_completed' && n.studentId === stuPkg12.id),
    '12-lesson package MUST NOT trigger package_completed at 8 sessions'
  );
  pass(11, 'Dynamic packageSessionsCount (4-pack & 12-pack) alerts & payment auto-resolution verified');

  // -------------------------------------------------------------------------
  // SCENARIO 12: Prepaid Credit Exhaustion (low_credit)
  // -------------------------------------------------------------------------
  const stuPrepaid = {
    id: 'stu_prepaid_1',
    userId: userA,
    name: 'Tarek Prepaid',
    phone: '01000000031',
    avatarColor: '#D97706',
    status: 'active' as const,
    createdAt: nowBase.toISOString(),
  };
  db.saveStudent(stuPrepaid);
  db.updateEnrollment({
    id: 'enr_prepaid_1',
    userId: userA,
    studentId: stuPrepaid.id,
    groupId: grpMath.id,
    serviceType: 'group',
    billingType: 'prepaid',
    billingMode: 'prepaid',
    customPrice: 100,
    sessionCredit: 0,
    financialCredit: 0,
    discount: 0,
    status: 'active',
    joinedAt: twoDaysAgoStr,
  });
  db.saveSession({
    id: 'sess_prepaid_1',
    userId: userA,
    groupId: grpMath.id,
    title: 'Prepaid Session 1',
    date: yesterdayStr,
    dayName: 'Sunday',
    month: curMonth,
    year: curYear,
    startTime: '18:00',
    status: 'completed',
    createdAt: nowBase.toISOString(),
  });
  db.saveAttendanceBatch('sess_prepaid_1', [
    {
      id: 'att_prepaid_1',
      userId: userA,
      sessionId: 'sess_prepaid_1',
      studentId: stuPrepaid.id,
      enrollmentId: 'enr_prepaid_1',
      status: 'present',
      isCharged: true,
      paymentStatus: 'unpaid',
      isPaid: false,
      recordedAt: nowBase.toISOString(),
    },
  ]);

  assert(
    evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase }).some(
      (n) => n.type === 'low_credit' && n.studentId === stuPrepaid.id
    ),
    'Exhausted prepaid credits with unpaid balance must trigger low_credit'
  );
  // Top up prepaid credit -> low_credit clears
  db.recordPayment({
    studentId: stuPrepaid.id,
    enrollmentId: 'enr_prepaid_1',
    groupId: grpMath.id,
    amount: 300,
    sessionsPurchased: 3,
    paymentType: 'session_count',
    paymentMethod: 'cash',
    date: todayStr,
    month: curMonth,
    year: curYear,
  });
  assert(
    !evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase }).some(
      (n) => n.type === 'low_credit' && n.studentId === stuPrepaid.id
    ),
    'Topping up prepaid credits must clear low_credit alert'
  );
  pass(12, 'Prepaid credit exhaustion (low_credit) triggers and clears upon credit top-up');

  // -------------------------------------------------------------------------
  // SCENARIO 13: Multi-Session Financial Follow-Up & Incomplete Lesson Record
  // -------------------------------------------------------------------------
  // Sara Private: 3 completed unpaid lessons + 1 incomplete lesson
  for (let i = 1; i <= 3; i++) {
    const sid = `sess_sara_unpaid_${i}`;
    db.saveSession({
      id: sid,
      userId: userA,
      groupId: '',
      studentId: stuSaraPrivate.id,
      enrollmentId: 'enr_sara_priv',
      title: `Physics Followup ${i}`,
      date: yesterdayStr,
      dayName: 'Sunday',
      month: curMonth,
      year: curYear,
      startTime: `1${i}:00`,
      status: 'completed',
      createdAt: nowBase.toISOString(),
    });
    db.saveAttendanceBatch(sid, [
      {
        id: `att_sara_unpaid_${i}`,
        userId: userA,
        sessionId: sid,
        studentId: stuSaraPrivate.id,
        enrollmentId: 'enr_sara_priv',
        status: 'present',
        isCharged: true,
        recordedAt: nowBase.toISOString(),
      },
    ]);
  }
  db.saveSession({
    id: 'sess_sara_incomplete',
    userId: userA,
    groupId: '',
    studentId: stuSaraPrivate.id,
    enrollmentId: 'enr_sara_priv',
    title: 'Physics Missing Hours',
    date: yesterdayStr,
    dayName: 'Sunday',
    month: curMonth,
    year: curYear,
    startTime: '19:00',
    status: 'completed',
    isIncomplete: true,
    createdAt: nowBase.toISOString(),
  });
  db.saveAttendanceBatch('sess_sara_incomplete', [
    {
      id: 'att_sara_inc',
      userId: userA,
      sessionId: 'sess_sara_incomplete',
      studentId: stuSaraPrivate.id,
      enrollmentId: 'enr_sara_priv',
      status: 'present',
      isCharged: true,
      recordedAt: nowBase.toISOString(),
    },
  ]);

  const evalFollowUps = evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase });
  assert(
    evalFollowUps.some((n) => n.type === 'financial_follow_up' && n.studentId === stuSaraPrivate.id),
    'Multiple unpaid completed sessions must trigger financial_follow_up'
  );
  const incAlert = evalFollowUps.find(
    (n) => n.type === 'incomplete_record' && n.sessionId === 'sess_sara_incomplete'
  );
  assert(
    Boolean(incAlert) && incAlert!.actionType === 'open_private_session',
    'Incomplete private session must trigger incomplete_record routing to open_private_session'
  );
  pass(13, 'Multi-session financial follow-up and incomplete lesson record alerts verified');

  // -------------------------------------------------------------------------
  // SCENARIO 14: Cloud Sync Failure 6h Anti-Spam Cooldown & Auto-Recovery
  // -------------------------------------------------------------------------
  notifySyncOutcome({ outcome: 'server_failure', userId: userA });
  notifySyncOutcome({ outcome: 'server_failure', userId: userA });
  notifySyncOutcome({ outcome: 'server_failure', userId: userA });

  const syncFailEvents = getPersistedNotificationEvents(userA).filter((e) => e.type === 'sync_failed');
  assert(syncFailEvents.length === 1, '6h anti-spam cooldown must prevent duplicate sync_failed alerts');
  assert(
    evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase }).some((n) => n.type === 'sync_failed'),
    'Active sync_failed alert must appear in Notification Center'
  );

  // Subsequent sync success -> resolves sync_failed and emits sync_restored
  notifySyncOutcome({ outcome: 'success', userId: userA });
  assert(
    !evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase }).some((n) => n.type === 'sync_failed') &&
      evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase }).some(
        (n) => n.type === 'sync_restored'
      ),
    'Successful sync after failure must resolve sync_failed and emit sync_restored'
  );
  pass(14, 'Cloud sync failure 6h cooldown deduplication and auto-recovery verified');

  // -------------------------------------------------------------------------
  // SCENARIO 15: Quiet Hours (Overnight, Same-Day, Day Filter & Critical Bypass)
  // -------------------------------------------------------------------------
  const qhSettings = normalizeNotificationSettings({
    enableNotifications: true,
    enableMobileNotifications: true,
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    allowCriticalDuringQuietHours: false,
  });
  const nightTime = new Date(2026, 9, 26, 23, 15, 0);
  const earlyMorning = new Date(2026, 9, 27, 5, 45, 0);
  const daytime = new Date(2026, 9, 27, 12, 0, 0);

  assert(
    isWithinQuietHours(nightTime, qhSettings) === true,
    '23:15 must fall inside 22:00-07:00 quiet hours'
  );
  assert(
    isWithinQuietHours(earlyMorning, qhSettings) === true,
    '05:45 must fall inside overnight 22:00-07:00 quiet hours'
  );
  assert(
    isWithinQuietHours(daytime, qhSettings) === false,
    '12:00 must be outside 22:00-07:00 quiet hours'
  );
  assert(
    shouldSuppressMobileAlert(nightTime, 'high', qhSettings) === true,
    'High priority alert must be suppressed during quiet hours'
  );
  assert(
    shouldSuppressMobileAlert(nightTime, 'critical', qhSettings) === true,
    'Critical alert must be suppressed when allowCriticalDuringQuietHours=false'
  );
  assert(
    shouldSuppressMobileAlert(nightTime, 'critical', {
      ...qhSettings,
      allowCriticalDuringQuietHours: true,
    }) === false,
    'Critical alert must bypass quiet hours when allowCriticalDuringQuietHours=true'
  );
  const deferredEnd = getQuietHoursEndTimestamp(nightTime, qhSettings);
  assert(
    deferredEnd.getHours() === 7 && deferredEnd.getMinutes() === 0,
    'Quiet hours end timestamp must defer scheduled alerts to 07:00'
  );

  // Critical restore failure event emission check
  notifyBackupOrRestoreEvent({ eventType: 'restore_failed', userId: userA });
  assert(
    evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase }).some(
      (n) => n.type === 'restore_failed' && n.priority === 'critical'
    ),
    'Restore failure must emit critical priority notification'
  );
  pass(15, 'Quiet hours overnight/daytime windows, scheduling deferral, and critical bypass verified');

  // -------------------------------------------------------------------------
  // SCENARIO 16: Unread Count, Read/Dismiss State, Clear History & Restore Defaults
  // -------------------------------------------------------------------------
  const unreadBefore = getUnreadNotificationsCount(userA);
  assert(unreadBefore > 0, 'User A must have unread notifications before marking read');

  const firstUnread = evaluateNotifications({ userId: userA, lang: 'en-US' }).find(
    (n) => !n.isRead
  )!;
  db.markNotificationAsRead(firstUnread.id, userA);
  assert(
    getUnreadNotificationsCount(userA) === unreadBefore - 1,
    'Marking single notification read must decrement unread count by 1'
  );
  db.markNotificationAsRead(firstUnread.id, userA);
  assert(
    getUnreadNotificationsCount(userA) === unreadBefore,
    'Toggling notification back to unread must restore unread count'
  );

  const allActiveIds = evaluateNotifications({ userId: userA, lang: 'en-US' }).map((n) => n.id);
  db.markAllNotificationsAsRead(allActiveIds, userA);
  assert(getUnreadNotificationsCount(userA) === 0, 'markAllNotificationsAsRead must reduce unread count to 0');

  // Clear history must clear notification feed without touching students/sessions/payments
  const studentsCountBefore = db.getStudents(userA).length;
  const paymentsCountBefore = db.getPayments(userA).length;
  clearNotificationHistoryForUser(userA);
  assert(
    evaluateNotifications({ userId: userA, lang: 'en-US', now: nowBase }).length === 0,
    'clearNotificationHistoryForUser must produce an empty active notification center'
  );
  assert(
    db.getStudents(userA).length === studentsCountBefore &&
      db.getPayments(userA).length === paymentsCountBefore,
    'Clearing notification history must NEVER delete student or payment domain records'
  );

  const restoredDefaults = await restoreDefaultNotificationSettings(userA, true);
  assert(
    restoredDefaults.lessonReminderLeadMinutes === 15 &&
      restoredDefaults.soundPreset === 'default' &&
      restoredDefaults.enableBalanceThresholdAlert === false,
    'restoreDefaultNotificationSettings must reset preferences cleanly to factory defaults'
  );
  pass(16, 'Unread counts, read/unread toggle, mark all read, clear history & restore defaults verified');

  // -------------------------------------------------------------------------
  // SCENARIO 17: Multi-Account Isolation & Logout Scheduled Alarm Cleanup
  // -------------------------------------------------------------------------
  // Schedule an upcoming lesson for User A so User A has an active scheduled alarm
  db.saveSession({
    id: 'sess_userA_logout_test',
    userId: userA,
    groupId: grpMath.id,
    title: 'User A Future Lesson',
    date: tomorrowStr,
    dayName: 'Tuesday',
    month: curMonth,
    year: curYear,
    startTime: '15:00',
    status: 'scheduled',
    createdAt: nowBase.toISOString(),
  });
  await reconcileScheduledNotifications({ userId: userA, isEn: true, now: nowBase });
  assert(
    Object.keys(getScheduledRegistry(userA)).length > 0,
    'User A must have scheduled alarms prior to account switch'
  );

  // Switch active session to User B
  db.setCurrentSession({
    id: userB,
    name: 'Teacher B',
    email: 'teacher.b@classy.test',
    createdAt: nowBase.toISOString(),
  });
  assert(
    Object.keys(getScheduledRegistry(userA)).length === 0,
    'Switching from User A to User B must cancel User A scheduled device notifications'
  );
  assert(
    evaluateNotifications({ userId: userB, lang: 'en-US', now: nowBase }).length === 0,
    'User B Notification Center must not show any of User A notifications'
  );

  // Schedule an upcoming lesson for User B and then log out via setCurrentSession(null)
  const grpB = {
    id: 'grp_b_1',
    userId: userB,
    name: 'English Group B',
    subject: 'English',
    accentColor: '#17375E',
    type: 'group' as const,
    gradeLevel: 'prep_1' as const,
    defaultPrice: 100,
    billingType: 'postpaid' as const,
    billingMode: 'postpaid' as const,
    scheduleDays: [],
    createdAt: nowBase.toISOString(),
  };
  db.saveGroup(grpB);
  db.saveSession({
    id: 'sess_userB_logout_test',
    userId: userB,
    groupId: grpB.id,
    title: 'User B Future Lesson',
    date: tomorrowStr,
    dayName: 'Tuesday',
    month: curMonth,
    year: curYear,
    startTime: '18:00',
    status: 'scheduled',
    createdAt: nowBase.toISOString(),
  });
  await reconcileScheduledNotifications({ userId: userB, isEn: true, now: nowBase });
  assert(
    Object.keys(getScheduledRegistry(userB)).length > 0,
    'User B must have scheduled alarms prior to logout'
  );

  db.setCurrentSession(null);
  assert(
    Object.keys(getScheduledRegistry(userB)).length === 0,
    'Logging out via setCurrentSession(null) must cancel scheduled notifications for the logged-out user'
  );
  pass(17, 'Multi-account isolation and logout scheduled notification cleanup verified');

  console.log('\n======================================================================');
  console.log(`ALL ${passedScenarios}/17 NOTIFICATION SCENARIOS PASSED WITH ZERO FAILURES`);
  console.log('======================================================================');
}

runNotificationVerificationSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n[VERIFICATION FAILURE]:', err);
    process.exit(1);
  });
