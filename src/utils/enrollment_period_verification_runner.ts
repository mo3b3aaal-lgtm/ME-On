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

class MockAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  async resume() {}
  async close() {}
  createOscillator() {
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
  documentElement: { lang: 'ar', dir: 'rtl' },
};

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runEnrollmentPeriodVerificationSuite() {
  console.log('============================================================================');
  console.log('CLASSY — STUDENT ENROLLMENT PERIODS, END DATES & VACATIONS VERIFICATION');
  console.log('============================================================================\n');

  const { db } = await import('./storage');
  const schedule = await import('./schedule');
  const localDate = await import('./localDate');
  const notifCenter = await import('./notificationCenter');
  const i18n = await import('./i18n');

  const {
    normalizeLocalDateOnly,
    getEffectiveEnrollmentPeriod,
    getEnrollmentDateStatus,
    isEnrollmentActiveOnDate,
    validateEnrollmentPeriod,
    getScheduledClassesForDate,
    getUpcomingClassesForStudent,
    getDetailedAgendaForDate,
    getMonthClassStatsMap,
    getYearClassStatsMap,
    buildRecurringSlotsByWeekday,
  } = schedule;

  let suiteCounter = 0;
  function resetCleanAccount(explicitUserId?: string) {
    suiteCounter++;
    const userId = explicitUserId || `acc_period_tester_${suiteCounter}`;
    storageMap.clear();
    const user = {
      id: userId,
      name: 'Period Test Teacher',
      email: `${userId}@classy.test`,
      createdAt: '2026-07-01T00:00:00.000Z',
    };
    db.saveAccounts([user as any]);
    db.setCurrentSession(user as any);
  }

  // ---------------------------------------------------------------------------
  // UI Localization Sanity Check
  // ---------------------------------------------------------------------------
  assert(i18n.t('lessonStartDate', undefined, 'ar') === 'تاريخ بداية الحصص', 'Arabic lessonStartDate exact match');
  assert(
    i18n.t('lessonEndDateOptional', undefined, 'ar') === 'تاريخ نهاية الحصص (اختياري)',
    'Arabic lessonEndDateOptional exact match'
  );
  assert(
    i18n.t('vacationsAndSuspensions', undefined, 'ar') === 'الإجازات وفترات التوقف',
    'Arabic vacationsAndSuspensions exact match'
  );
  assert(i18n.t('addVacation', undefined, 'ar') === 'إضافة إجازة', 'Arabic addVacation exact match');
  assert(i18n.t('vacationStartDate', undefined, 'ar') === 'بداية الإجازة', 'Arabic vacationStartDate exact match');
  assert(i18n.t('vacationEndDate', undefined, 'ar') === 'نهاية الإجازة', 'Arabic vacationEndDate exact match');
  assert(
    i18n.t('vacationReasonOptional', undefined, 'ar') === 'سبب الإجازة (اختياري)',
    'Arabic vacationReasonOptional exact match'
  );

  assert(i18n.t('lessonStartDate', undefined, 'en-GB') === 'Lesson Start Date', 'English lessonStartDate exact match');
  assert(
    i18n.t('lessonEndDateOptional', undefined, 'en-GB') === 'Lesson End Date (Optional)',
    'English lessonEndDateOptional exact match'
  );
  assert(
    i18n.t('vacationsAndSuspensions', undefined, 'en-GB') === 'Vacations & Suspension Periods',
    'English vacationsAndSuspensions exact match'
  );
  assert(i18n.t('addVacation', undefined, 'en-GB') === 'Add Vacation', 'English addVacation exact match');
  assert(
    i18n.t('vacationStartDate', undefined, 'en-GB') === 'Vacation Start Date',
    'English vacationStartDate exact match'
  );
  assert(i18n.t('vacationEndDate', undefined, 'en-GB') === 'Vacation End Date', 'English vacationEndDate exact match');
  assert(
    i18n.t('vacationReasonOptional', undefined, 'en-GB') === 'Reason (Optional)',
    'English vacationReasonOptional exact match'
  );
  console.log('[PASS] Exact Arabic & English UI Labels Verified');

  // ---------------------------------------------------------------------------
  // SUITE A: Future Start Date & Registration Date Preservation
  // ---------------------------------------------------------------------------
  resetCleanAccount();
  const regTimestamp = '2026-07-10T09:30:00.000Z';
  const studentFuture = {
    id: 'st_future_1',
    name: 'يوسف طارق',
    gradeLevel: 'الصف الأول الثانوي',
    avatarColor: 'navy',
    status: 'active' as const,
    createdAt: regTimestamp,
    updatedAt: regTimestamp,
  };
  db.saveStudent(studentFuture);
  const savedFutureSt = db.getStudentById('st_future_1')!;
  assert(savedFutureSt.createdAt === regTimestamp, 'Suite A: Student createdAt registration date preserved');

  // Register on July 10, operational start Aug 16, 2026 (2026-08-16 is a Sunday)
  const { enrollment: privFutureEnr } = db.createPrivateLessonService('st_future_1', {
    subject: 'الرياضيات',
    sessionPrice: 150,
    billingType: 'prepaid',
    billingMode: 'prepaid',
    scheduleDays: ['sunday'],
    scheduleTime: '16:00',
    scheduleTimes: { sunday: ['16:00'] },
    startDate: '2026-08-16',
    joinedAt: regTimestamp,
  });

  assert(privFutureEnr.joinedAt === regTimestamp, 'Suite A: Enrollment joinedAt preserved separately from startDate');
  assert(privFutureEnr.startDate === '2026-08-16', 'Suite A: Enrollment startDate saved as 2026-08-16');

  assert(!isEnrollmentActiveOnDate(privFutureEnr, '2026-07-10', savedFutureSt), 'Suite A: Inactive on registration date');
  assert(!isEnrollmentActiveOnDate(privFutureEnr, '2026-07-12', savedFutureSt), 'Suite A: Inactive on Sunday July 12');
  assert(!isEnrollmentActiveOnDate(privFutureEnr, '2026-08-09', savedFutureSt), 'Suite A: Inactive on Sunday Aug 9');
  assert(!isEnrollmentActiveOnDate(privFutureEnr, '2026-08-15', savedFutureSt), 'Suite A: Inactive on day before startDate');
  assert(
    getEnrollmentDateStatus(privFutureEnr, '2026-08-15', savedFutureSt).reason === 'before_start',
    'Suite A: Status reason is before_start on Aug 15'
  );
  assert(isEnrollmentActiveOnDate(privFutureEnr, '2026-08-16', savedFutureSt), 'Suite A: Active on startDate (inclusive)');

  const classesJul12 = getScheduledClassesForDate('2026-07-12', db.getGroups(), db.getEnrollments(), db.getStudents());
  const classesAug09 = getScheduledClassesForDate('2026-08-09', db.getGroups(), db.getEnrollments(), db.getStudents());
  const classesAug16 = getScheduledClassesForDate('2026-08-16', db.getGroups(), db.getEnrollments(), db.getStudents());
  assert(classesJul12.length === 0, 'Suite A: Zero classes generated on July 12');
  assert(classesAug09.length === 0, 'Suite A: Zero classes generated on Aug 9');
  assert(classesAug16.length === 1 && classesAug16[0].studentId === 'st_future_1', 'Suite A: Class generated on Aug 16');

  const upcomingFromJuly = getUpcomingClassesForStudent(
    'st_future_1',
    db.getGroups(),
    db.getEnrollments(),
    5,
    true,
    db.getSessions(),
    savedFutureSt,
    new Date(2026, 6, 10, 9, 0, 0) // Local July 10, 2026
  );
  assert(upcomingFromJuly.length > 0, 'Suite A: Upcoming classes found within 60-day horizon');
  assert(
    upcomingFromJuly[0].dateStr === '2026-08-16',
    `Suite A: First upcoming class is 2026-08-16, got ${upcomingFromJuly[0].dateStr}`
  );
  console.log('[PASS] Suite A — Future Start Date & Registration Date Separation');

  // ---------------------------------------------------------------------------
  // SUITE B: Optional End Date & Validation Rules
  // ---------------------------------------------------------------------------
  const boundedEnr = db.updateEnrollmentBilling(privFutureEnr.id, {
    startDate: '2026-08-16',
    endDate: '2026-08-30', // Sunday Aug 30 inclusive
  })!;
  assert(isEnrollmentActiveOnDate(boundedEnr, '2026-08-16', savedFutureSt), 'Suite B: Active on startDate');
  assert(isEnrollmentActiveOnDate(boundedEnr, '2026-08-30', savedFutureSt), 'Suite B: Active on endDate (inclusive)');
  assert(!isEnrollmentActiveOnDate(boundedEnr, '2026-08-31', savedFutureSt), 'Suite B: Inactive on endDate + 1');
  assert(!isEnrollmentActiveOnDate(boundedEnr, '2026-09-06', savedFutureSt), 'Suite B: Inactive on Sunday Sep 6');
  assert(
    getEnrollmentDateStatus(boundedEnr, '2026-09-06', savedFutureSt).reason === 'ended',
    'Suite B: Status reason is ended after endDate'
  );
  assert(
    getScheduledClassesForDate('2026-08-30', db.getGroups(), db.getEnrollments(), db.getStudents()).length === 1,
    'Suite B: Scheduled on inclusive endDate Aug 30'
  );
  assert(
    getScheduledClassesForDate('2026-09-06', db.getGroups(), db.getEnrollments(), db.getStudents()).length === 0,
    'Suite B: Excluded on Sunday Sep 6 after endDate'
  );

  // Clear endDate -> open-ended again
  const reopenedEnr = db.updateEnrollmentBilling(privFutureEnr.id, {
    endDate: '',
  })!;
  assert(reopenedEnr.endDate === undefined, 'Suite B: Clearing endDate sets undefined');
  assert(isEnrollmentActiveOnDate(reopenedEnr, '2027-03-14', savedFutureSt), 'Suite B: Open-ended enrollment stays active');

  // Validation checks
  const invalidEndBeforeStart = validateEnrollmentPeriod({
    startDate: '2026-08-16',
    endDate: '2026-08-10',
  });
  assert(!invalidEndBeforeStart.valid && invalidEndBeforeStart.errors.length > 0, 'Suite B: Rejects endDate < startDate');

  const invalidVacRange = validateEnrollmentPeriod({
    startDate: '2026-08-01',
    vacationPeriods: [{ id: 'v1', startDate: '2026-08-20', endDate: '2026-08-18' }],
  });
  assert(!invalidVacRange.valid, 'Suite B: Rejects vacation endDate < startDate');

  const missingVacDate = validateEnrollmentPeriod({
    vacationPeriods: [{ id: 'v2', startDate: '2026-08-20', endDate: '' }],
  });
  assert(!missingVacDate.valid, 'Suite B: Rejects incomplete vacation range');

  const overlapVacCheck = validateEnrollmentPeriod({
    vacationPeriods: [
      { id: 'v1', startDate: '2026-09-05', endDate: '2026-09-12' },
      { id: 'v2', startDate: '2026-09-10', endDate: '2026-09-15' },
    ],
  });
  assert(overlapVacCheck.valid && overlapVacCheck.warnings.length === 1, 'Suite B: Warns on overlapping vacation ranges');
  console.log('[PASS] Suite B — Optional End Date & Validation Rules');

  // ---------------------------------------------------------------------------
  // SUITE C: Single & Multiple Vacation Periods (Boundary Precision)
  // ---------------------------------------------------------------------------
  const vacEnr = db.updateEnrollmentBilling(privFutureEnr.id, {
    startDate: '2026-08-01',
    endDate: '2026-09-30',
    vacationPeriods: [
      { id: 'vac_travel', startDate: '2026-08-16', endDate: '2026-08-23', reason: 'سفر العائلة' },
      { id: 'vac_exam', startDate: '2026-09-06', endDate: '2026-09-06', reason: 'اعتذار يوم واحد' },
    ],
  })!;

  assert(isEnrollmentActiveOnDate(vacEnr, '2026-08-15', savedFutureSt), 'Suite C: Active day before vacation starts');
  assert(!isEnrollmentActiveOnDate(vacEnr, '2026-08-16', savedFutureSt), 'Suite C: Inactive on vacation startDate');
  assert(!isEnrollmentActiveOnDate(vacEnr, '2026-08-19', savedFutureSt), 'Suite C: Inactive during middle of vacation');
  assert(!isEnrollmentActiveOnDate(vacEnr, '2026-08-23', savedFutureSt), 'Suite C: Inactive on vacation endDate');
  assert(
    isEnrollmentActiveOnDate(vacEnr, '2026-08-24', savedFutureSt),
    'Suite C: Resumes automatically on vacation.endDate + 1'
  );
  assert(isEnrollmentActiveOnDate(vacEnr, '2026-08-30', savedFutureSt), 'Suite C: Active on Sunday Aug 30 between vacations');
  assert(!isEnrollmentActiveOnDate(vacEnr, '2026-09-06', savedFutureSt), 'Suite C: Single-day vacation inactive on Sep 6');
  assert(isEnrollmentActiveOnDate(vacEnr, '2026-09-07', savedFutureSt), 'Suite C: Resumes on Sep 7 after 1-day vacation');

  // Vacation ending on enrollment endDate does NOT reactivate on endDate + 1
  const vacAtContractEnd = db.updateEnrollmentBilling(privFutureEnr.id, {
    startDate: '2026-08-01',
    endDate: '2026-08-23',
    vacationPeriods: [{ id: 'vac_end', startDate: '2026-08-16', endDate: '2026-08-23' }],
  })!;
  assert(
    !isEnrollmentActiveOnDate(vacAtContractEnd, '2026-08-24', savedFutureSt),
    'Suite C: Does NOT reactivate after vacation if enrollment endDate has passed'
  );

  // Removing vacation restores activity immediately
  const vacRemovedEnr = db.updateEnrollmentBilling(privFutureEnr.id, {
    startDate: '2026-08-01',
    endDate: '2026-09-30',
    vacationPeriods: [],
  })!;
  assert(
    isEnrollmentActiveOnDate(vacRemovedEnr, '2026-08-16', savedFutureSt),
    'Suite C: Removing vacation immediately restores active schedule on Aug 16'
  );
  console.log('[PASS] Suite C — Single & Multiple Vacation Periods & Boundary Rules');

  // ---------------------------------------------------------------------------
  // SUITE D: Group vs. Private Independence & Shared Group Session Rule
  // ---------------------------------------------------------------------------
  resetCleanAccount();
  const groupCountBeforePrivate = db.getGroups().length;
  db.saveStudent({
    id: 'st_priv_only',
    name: 'سارة محمود',
    gradeLevel: 'الصف الثاني الثانوي',
    avatarColor: 'teal',
    status: 'active',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  });
  db.createPrivateLessonService('st_priv_only', {
    subject: 'الكيمياء',
    sessionPrice: 200,
    billingType: 'prepaid',
    billingMode: 'prepaid',
    scheduleDays: ['saturday'],
    scheduleTime: '14:00',
    startDate: '2026-08-15',
  });
  assert(
    db.getGroups().length === groupCountBeforePrivate,
    'Suite D: Creating private-only student service creates ZERO Group entities'
  );

  // Create a shared Group on Saturdays at 18:00
  const sharedGroup = {
    id: 'grp_sat_physics',
    name: 'مجموعة الفيزياء المتقدمة',
    subject: 'الفيزياء',
    gradeLevel: 'الصف الثالث الثانوي',
    type: 'group' as const,
    billingType: 'monthly' as const,
    billingMode: 'monthly' as const,
    defaultPrice: 400,
    scheduleDays: ['saturday'],
    scheduleTime: '18:00',
    scheduleTimes: { saturday: ['18:00'] },
    accentColor: '#17375E',
    createdAt: '2026-07-01T00:00:00.000Z',
  };
  db.saveGroup(sharedGroup);

  // Student 1: Active legacy student (no startDate/endDate)
  db.saveStudent({
    id: 'st_grp_active',
    name: 'عمر خالد',
    gradeLevel: 'الصف الثالث الثانوي',
    avatarColor: 'navy',
    status: 'active',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  });
  db.enrollStudent('st_grp_active', 'grp_sat_physics', {
    serviceType: 'group',
    billingType: 'monthly',
    billingMode: 'monthly',
    customPrice: 400,
    status: 'active',
  });

  // Student 2: Dual-enrolled student (Group + Private) with INDEPENDENT operational periods!
  // Group: on vacation 2026-08-10..2026-08-20
  // Private: active on Saturdays 11:00 starting 2026-08-01 with NO vacation
  db.saveStudent({
    id: 'st_dual',
    name: 'مريم حسن',
    gradeLevel: 'الصف الثالث الثانوي',
    avatarColor: 'slate',
    status: 'active',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  });
  db.enrollStudent('st_dual', 'grp_sat_physics', {
    serviceType: 'group',
    billingType: 'monthly',
    billingMode: 'monthly',
    customPrice: 400,
    startDate: '2026-08-01',
    vacationPeriods: [{ id: 'v_grp_only', startDate: '2026-08-10', endDate: '2026-08-20', reason: 'توقف عن المجموعة فقط' }],
    status: 'active',
  });
  db.createPrivateLessonService('st_dual', {
    subject: 'مراجعة فردية فيزياء',
    sessionPrice: 250,
    billingType: 'prepaid',
    billingMode: 'prepaid',
    scheduleDays: ['saturday'],
    scheduleTime: '11:00',
    scheduleTimes: { saturday: ['11:00'] },
    startDate: '2026-08-01',
    vacationPeriods: [],
  });

  // Check Saturday 2026-08-15 (st_dual is on Group vacation, but Private is active!)
  const satAug15Classes = getScheduledClassesForDate(
    '2026-08-15',
    db.getGroups(),
    db.getEnrollments(),
    db.getStudents()
  );
  const hasGroupClassAug15 = satAug15Classes.some((c) => !c.isPrivate && c.groupId === 'grp_sat_physics');
  const hasDualPrivAug15 = satAug15Classes.some((c) => c.isPrivate && c.studentId === 'st_dual');
  assert(hasGroupClassAug15, 'Suite D: Shared group session remains scheduled on Aug 15 for active group students');
  assert(hasDualPrivAug15, 'Suite D: Dual student private lesson remains active on Aug 15 despite group vacation');

  const rosterOnAug15 = db.getGroupStudents('grp_sat_physics', '2026-08-15');
  const fullDirectoryRoster = db.getGroupStudents('grp_sat_physics');
  assert(
    rosterOnAug15.length === 1 && rosterOnAug15[0].id === 'st_grp_active',
    'Suite D: Group operational roster on Aug 15 excludes vacationing st_dual and keeps st_grp_active'
  );
  assert(fullDirectoryRoster.length === 2, 'Suite D: Group directory roster still retains both enrolled students');

  const agendaAug15 = getDetailedAgendaForDate(
    '2026-08-15',
    db.getSessions(),
    db.getGroups(),
    db.getEnrollments(),
    db.getStudents(),
    true,
    db.getAttendance(),
    '2026-08-01'
  );
  const groupAgendaAug15 = agendaAug15.items.find((it) => !it.isPrivate && it.groupId === 'grp_sat_physics')!;
  assert(
    groupAgendaAug15.totalStudentsCount === 1,
    `Suite D: Expected 1 operational group student on Aug 15, got ${groupAgendaAug15.totalStudentsCount}`
  );

  // On Saturday 2026-08-22 (after group vacation ended on Aug 20), both students are active in the group!
  const rosterOnAug22 = db.getGroupStudents('grp_sat_physics', '2026-08-22');
  assert(rosterOnAug22.length === 2, 'Suite D: Group operational roster on Aug 22 includes both students after vacation');
  console.log('[PASS] Suite D — Group vs. Private Scope Independence & Shared-Session Roster Rule');

  // ---------------------------------------------------------------------------
  // SUITE E: Attendance, Absence, Monthly Billing & Package Credit Safety
  // ---------------------------------------------------------------------------
  resetCleanAccount();
  const billingGroup = {
    id: 'grp_monthly_math',
    name: 'مجموعة الجبر الشهرية',
    subject: 'الرياضيات',
    gradeLevel: 'الصف الأول الثانوي',
    type: 'group' as const,
    billingType: 'monthly' as const,
    billingMode: 'monthly' as const,
    defaultPrice: 500,
    baseSessionsPerMonth: 4,
    scheduleDays: ['saturday'],
    scheduleTime: '17:00',
    accentColor: '#17375E',
    createdAt: '2026-07-01T00:00:00.000Z',
  };
  db.saveGroup(billingGroup);

  db.saveStudent({
    id: 'st_july_veteran',
    name: 'أحمد قديم',
    gradeLevel: 'الصف الأول الثانوي',
    avatarColor: 'navy',
    status: 'active',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  });
  db.enrollStudent('st_july_veteran', 'grp_monthly_math', {
    serviceType: 'group',
    billingType: 'monthly',
    billingMode: 'monthly',
    customPrice: 500,
    joinedAt: '2026-07-01T00:00:00.000Z',
    status: 'active',
  });

  // New student registered Oct 10, starts Dec 1, 2026 (future relative to live clock)!
  db.saveStudent({
    id: 'st_sep_starter',
    name: 'كريم ديسمبر',
    gradeLevel: 'الصف الأول الثانوي',
    avatarColor: 'teal',
    status: 'active',
    createdAt: '2026-10-10T00:00:00.000Z',
    updatedAt: '2026-10-10T00:00:00.000Z',
  });
  const sepStarterEnr = db.enrollStudent('st_sep_starter', 'grp_monthly_math', {
    serviceType: 'group',
    billingType: 'monthly',
    billingMode: 'monthly',
    customPrice: 500,
    joinedAt: '2026-10-10T00:00:00.000Z',
    startDate: '2026-12-01',
    status: 'active',
  });

  // Group holds completed sessions in July and October for st_july_veteran
  db.saveSession({
    id: 'ses_july_18',
    groupId: 'grp_monthly_math',
    title: 'حصة يوليو',
    date: '2026-07-18',
    month: 7,
    year: 2026,
    dayName: 'السبت',
    startTime: '17:00',
    endTime: '18:30',
    sessionNumber: 1,
    hours: 1.5,
    hourlyRate: 500,
    pricePerStudent: 125,
    status: 'completed',
    createdAt: '2026-07-18T17:00:00.000Z',
  });
  db.saveSession({
    id: 'ses_oct_17',
    groupId: 'grp_monthly_math',
    title: 'حصة أكتوبر',
    date: '2026-10-17',
    month: 10,
    year: 2026,
    dayName: 'السبت',
    startTime: '17:00',
    endTime: '18:30',
    sessionNumber: 2,
    hours: 1.5,
    hourlyRate: 500,
    pricePerStudent: 125,
    status: 'completed',
    createdAt: '2026-10-17T17:00:00.000Z',
  });
  const julyRoster = db.getGroupStudents('grp_monthly_math', '2026-07-18');
  assert(
    julyRoster.length === 1 && julyRoster[0].id === 'st_july_veteran',
    'Suite E: Pre-start student excluded from July 18 group session roster'
  );
  db.saveAttendanceBatch('ses_july_18', [
    {
      id: 'att_july_vet',
      sessionId: 'ses_july_18',
      studentId: 'st_july_veteran',
      status: 'present',
      isCharged: true,
      recordedAt: '2026-07-18T18:00:00.000Z',
    },
  ]);

  // Verify st_sep_starter has ZERO attendance/absence records and ZERO spurious July/August monthly charges!
  assert(
    db.getStudentAttendance('st_sep_starter').length === 0,
    'Suite E: Zero auto-generated absences for pre-start student'
  );
  const sepStarterFin = db.calculateEnrollmentFinancials(sepStarterEnr.id)!;
  assert(
    sepStarterFin.totalDue === 0 && sepStarterFin.remaining === 0,
    `Suite E: Pre-start monthly student has 0 spurious dues before startDate, got totalDue=${sepStarterFin.totalDue}`
  );

  // Package Credit Safety during vacation/pre-start
  db.saveStudent({
    id: 'st_pkg_student',
    name: 'ندى باقات',
    gradeLevel: 'الصف الأول الثانوي',
    avatarColor: 'navy',
    status: 'active',
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
  });
  const { enrollment: pkgEnr } = db.createPrivateLessonService('st_pkg_student', {
    subject: 'اللغة الإنجليزية',
    sessionPrice: 800,
    billingType: 'package',
    billingMode: 'package',
    packageSessionsCount: 8,
    packagePrice: 800,
    scheduleDays: ['monday'],
    scheduleTime: '15:00',
    startDate: '2026-08-03',
    vacationPeriods: [{ id: 'v_pkg', startDate: '2026-08-10', endDate: '2026-08-24', reason: 'إجازة صيفية' }],
  });
  db.savePayment({
    id: 'pay_pkg_800',
    studentId: 'st_pkg_student',
    enrollmentId: pkgEnr.id,
    amount: 800,
    sessionsPurchased: 8,
    paymentType: 'session_count',
    paymentMethod: 'cash',
    date: '2026-07-10',
    month: 7,
    year: 2026,
    createdAt: '2026-07-10T12:00:00.000Z',
  });
  const pkgFinInitial = db.calculateEnrollmentFinancials(pkgEnr.id)!;
  assert(pkgFinInitial.sessionCredit === 8, `Suite E: Package credit remains 8 untouched by vacation/pre-start`);

  // Historical Preservation: Attend 1 session on 2026-08-03, then retroactively change startDate to 2026-09-01
  db.saveSession({
    id: 'ses_aug_03_pkg',
    groupId: '',
    studentId: 'st_pkg_student',
    enrollmentId: pkgEnr.id,
    title: 'حصة إنجليزي 1',
    date: '2026-08-03',
    month: 8,
    year: 2026,
    dayName: 'الاثنين',
    startTime: '15:00',
    endTime: '16:30',
    sessionNumber: 1,
    hours: 1.5,
    hourlyRate: 100,
    pricePerStudent: 100,
    status: 'completed',
    createdAt: '2026-08-03T15:00:00.000Z',
  });
  db.saveAttendanceBatch('ses_aug_03_pkg', [
    {
      id: 'att_aug_03_pkg',
      sessionId: 'ses_aug_03_pkg',
      studentId: 'st_pkg_student',
      enrollmentId: pkgEnr.id,
      status: 'present',
      isCharged: true,
      recordedAt: '2026-08-03T16:30:00.000Z',
    },
  ]);

  // Retroactively update startDate to 2026-09-01
  db.updateEnrollmentBilling(pkgEnr.id, { startDate: '2026-09-01' });
  const histAttAfterEdit = db.getStudentAttendance('st_pkg_student');
  const pkgFinAfterEdit = db.calculateEnrollmentFinancials(pkgEnr.id)!;
  assert(histAttAfterEdit.length === 1, 'Suite E: Historical attendance preserved when startDate is edited later');
  assert(pkgFinAfterEdit.totalPaid === 800, 'Suite E: Historical payment preserved when startDate is edited later');
  assert(pkgFinAfterEdit.usedSessionsCount === 1 && pkgFinAfterEdit.sessionCredit === 7, 'Suite E: Consumed lesson & credit preserved');
  console.log('[PASS] Suite E — Attendance, Absence, Monthly Billing & Historical Integrity');

  // ---------------------------------------------------------------------------
  // SUITE F: Calendar Day / Week / Month / Year Agreement & Timezone Safety
  // ---------------------------------------------------------------------------
  resetCleanAccount();
  // Timezone safety check on YYYY-MM-DD strings
  const partsAug16 = localDate.getLocalDateParts('2026-08-16');
  assert(
    partsAug16.dateStr === '2026-08-16' && partsAug16.canonicalWeekday === 'sunday',
    `Suite F: Local YYYY-MM-DD weekday must be sunday without UTC shift, got ${partsAug16.canonicalWeekday}`
  );
  assert(normalizeLocalDateOnly('2026-8-5') === '2026-08-05', 'Suite F: normalizeLocalDateOnly zero-pads cleanly');

  db.saveStudent({
    id: 'st_cal_check',
    name: 'ليلى تقويم',
    gradeLevel: 'الصف الثاني الثانوي',
    avatarColor: 'navy',
    status: 'active',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  });
  // Saturdays in Aug/Sep 2026:
  // Aug 8 (before start) -> 0
  // Aug 15 (startDate) -> 1
  // Aug 22 (vacation) -> 0
  // Aug 29 (resumed, endDate) -> 1
  // Sep 5 (after endDate) -> 0
  db.createPrivateLessonService('st_cal_check', {
    subject: 'الأحياء',
    sessionPrice: 180,
    billingType: 'prepaid',
    billingMode: 'prepaid',
    scheduleDays: ['saturday'],
    scheduleTime: '13:00',
    scheduleTimes: { saturday: ['13:00'] },
    startDate: '2026-08-15',
    endDate: '2026-08-29',
    vacationPeriods: [{ id: 'v_aug22', startDate: '2026-08-20', endDate: '2026-08-25' }],
  });

  const calGroups = db.getGroups();
  const calEnrs = db.getEnrollments();
  const calStudents = db.getStudents();
  const calSessions = db.getSessions();
  const recurringMap = buildRecurringSlotsByWeekday(calGroups, calEnrs, calStudents);

  const augMonthMap = getMonthClassStatsMap(2026, 7, calSessions, calGroups, calEnrs, calStudents, {
    recurringSlotsByWeekday: recurringMap,
    todayStr: '2026-08-01',
  });
  const sepMonthMap = getMonthClassStatsMap(2026, 8, calSessions, calGroups, calEnrs, calStudents, {
    recurringSlotsByWeekday: recurringMap,
    todayStr: '2026-08-01',
  });
  const year2026Map = getYearClassStatsMap(2026, calSessions, calGroups, calEnrs, calStudents, {
    recurringSlotsByWeekday: recurringMap,
    todayStr: '2026-08-01',
  });

  const checkCases: Array<{ date: string; expected: number; mapRef: Map<string, any> }> = [
    { date: '2026-08-08', expected: 0, mapRef: augMonthMap },
    { date: '2026-08-15', expected: 1, mapRef: augMonthMap },
    { date: '2026-08-22', expected: 0, mapRef: augMonthMap },
    { date: '2026-08-29', expected: 1, mapRef: augMonthMap },
    { date: '2026-09-05', expected: 0, mapRef: sepMonthMap },
  ];

  for (const tc of checkCases) {
    const dayItems = getScheduledClassesForDate(tc.date, calGroups, calEnrs, calStudents);
    const agenda = getDetailedAgendaForDate(
      tc.date,
      calSessions,
      calGroups,
      calEnrs,
      calStudents,
      true,
      [],
      '2026-08-01'
    );
    const monthStat = tc.mapRef.get(tc.date)?.totalCount ?? 0;
    const yearStat = year2026Map.get(tc.date)?.totalCount ?? 0;

    assert(
      dayItems.length === tc.expected &&
        agenda.items.length === tc.expected &&
        monthStat === tc.expected &&
        yearStat === tc.expected,
      `Suite F: Calendar mismatch on ${tc.date}: day=${dayItems.length}, agenda=${agenda.items.length}, month=${monthStat}, year=${yearStat}, expected=${tc.expected}`
    );
  }
  console.log('[PASS] Suite F — Day / Week / Month / Year Calendar Consistency & Timezone Safety');

  // ---------------------------------------------------------------------------
  // SUITE G: Persistence, Export/Import, Backup/Restore, & Multi-Account Isolation
  // ---------------------------------------------------------------------------
  resetCleanAccount('acc_teacher_alpha');
  db.saveStudent({
    id: 'st_persist_alpha',
    name: 'طالب حفظ ومزامنة',
    gradeLevel: 'الصف الثالث الثانوي',
    avatarColor: 'navy',
    startDate: '2026-08-16',
    endDate: '2026-12-31',
    vacationPeriods: [{ id: 'vp_alpha_1', startDate: '2026-10-01', endDate: '2026-10-07', reason: 'إجازة أكتوبر' }],
    status: 'active',
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
  });
  const { enrollment: alphaPriv } = db.createPrivateLessonService('st_persist_alpha', {
    subject: 'التفاضل',
    sessionPrice: 200,
    billingType: 'prepaid',
    billingMode: 'prepaid',
    scheduleDays: ['tuesday'],
    scheduleTime: '19:00',
    startDate: '2026-08-18',
    endDate: '2026-12-29',
    vacationPeriods: [{ id: 'vp_enr_1', startDate: '2026-11-01', endDate: '2026-11-05', reason: 'مراجعة نصف الفصل' }],
  });

  // 1. Export & Import JSON round-trip
  const exportedJson = db.exportDatabaseJSON();
  const exportedAccountBackup = db.exportAccountBackup('acc_teacher_alpha');

  // Switch to second account and verify strict multi-account isolation
  const betaUser = {
    id: 'acc_teacher_beta',
    name: 'Beta Teacher',
    email: 'beta@classy.test',
    createdAt: '2026-07-01T00:00:00.000Z',
  };
  db.saveAccounts([...db.getAccounts(), betaUser as any]);
  db.setCurrentSession(betaUser as any);
  assert(db.getStudents().length === 0, 'Suite G: Account Beta cannot see Account Alpha students');
  assert(db.getEnrollments().length === 0, 'Suite G: Account Beta cannot see Account Alpha enrollments');

  // Switch back to Alpha, wipe Alpha's domain lists, and restore via importDatabaseJSON
  const alphaUser = db.getAccounts().find((a) => a.id === 'acc_teacher_alpha')!;
  db.setCurrentSession(alphaUser);
  db.importDatabaseJSON(JSON.stringify({ students: [], enrollments: [], groups: [], sessions: [], attendance: [], payments: [] }));
  assert(db.getStudents().length === 0, 'Suite G: Local wipe confirmed before JSON import');

  const importOk = db.importDatabaseJSON(exportedJson);
  assert(importOk, 'Suite G: importDatabaseJSON succeeded');
  const restoredStJson = db.getStudentById('st_persist_alpha')!;
  const restoredEnrJson = db.getEnrollments().find((e) => e.id === alphaPriv.id)!;
  assert(
    restoredStJson.startDate === '2026-08-16' &&
      restoredStJson.endDate === '2026-12-31' &&
      restoredStJson.vacationPeriods?.[0]?.reason === 'إجازة أكتوبر',
    'Suite G: Student operational period fields preserved through JSON export/import'
  );
  assert(
    restoredEnrJson.startDate === '2026-08-18' &&
      restoredEnrJson.endDate === '2026-12-29' &&
      restoredEnrJson.vacationPeriods?.[0]?.reason === 'مراجعة نصف الفصل',
    'Suite G: Enrollment operational period fields preserved through JSON export/import'
  );

  // 2. Wipe again and restore via Account Backup package (cloud/sync format)
  db.importDatabaseJSON(JSON.stringify({ students: [], enrollments: [], groups: [], sessions: [], attendance: [], payments: [] }));
  const backupRes = db.importAccountBackup(exportedAccountBackup, 'acc_teacher_alpha');
  assert(backupRes.success, 'Suite G: importAccountBackup succeeded');
  const restoredEnrBackup = db.getEnrollments().find((e) => e.id === alphaPriv.id)!;
  assert(
    restoredEnrBackup.startDate === '2026-08-18' &&
      restoredEnrBackup.endDate === '2026-12-29' &&
      restoredEnrBackup.vacationPeriods?.length === 1,
    'Suite G: Enrollment operational period fields preserved through Account Backup/Sync package'
  );
  console.log('[PASS] Suite G — Persistence, Export/Import, Account Backup/Restore, & Multi-Account Isolation');

  // ---------------------------------------------------------------------------
  // SUITE H: Notification Scheduling, Smart Reminders, & Deduplication
  // ---------------------------------------------------------------------------
  resetCleanAccount('acc_notif_period');
  db.saveStudent({
    id: 'st_notif_future',
    name: 'زياد إشعارات',
    gradeLevel: 'الصف الأول الثانوي',
    avatarColor: 'navy',
    status: 'active',
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
  });

  // Reference time: Saturday 2026-08-08 at 09:00 local time
  const refAug08Morning = new Date(2026, 7, 8, 9, 0, 0);

  // Create private service on Saturdays 16:00, starting NEXT Saturday 2026-08-15 (so Aug 8 is pre-start!)
  const { enrollment: notifEnr } = db.createPrivateLessonService('st_notif_future', {
    subject: 'الفيزياء',
    sessionPrice: 200,
    billingType: 'postpaid',
    billingMode: 'postpaid',
    scheduleDays: ['saturday'],
    scheduleTime: '16:00',
    scheduleTimes: { saturday: ['16:00'] },
    startDate: '2026-08-15',
  });

  // Also give the student an historical unpaid balance from an older service so today_lesson_debt would trigger IF active today
  db.saveSession({
    id: 'ses_old_debt',
    groupId: '',
    studentId: 'st_notif_future',
    enrollmentId: notifEnr.id,
    title: 'حصة سابقة',
    date: '2026-07-01',
    month: 7,
    year: 2026,
    dayName: 'الأربعاء',
    startTime: '16:00',
    endTime: '17:30',
    sessionNumber: 1,
    hours: 1.5,
    hourlyRate: 200,
    pricePerStudent: 200,
    status: 'completed',
    createdAt: '2026-07-01T16:00:00.000Z',
  });
  db.saveAttendanceBatch('ses_old_debt', [
    {
      id: 'att_old_debt',
      sessionId: 'ses_old_debt',
      studentId: 'st_notif_future',
      enrollmentId: notifEnr.id,
      status: 'present',
      isCharged: true,
      recordedAt: '2026-07-01T17:30:00.000Z',
    },
  ]);

  await notifCenter.reconcileScheduledNotifications({
    userId: 'acc_notif_period',
    isEn: false,
    now: refAug08Morning,
  });
  const regAug08Entries = Object.entries(notifCenter.getScheduledRegistry('acc_notif_period'));
  const aug08ScheduledForStudent = regAug08Entries.filter(
    ([dedupeKey, item]) => item.category === 'lesson_reminders' && dedupeKey.includes('2026-08-08')
  );
  assert(
    aug08ScheduledForStudent.length === 0,
    `Suite H: Zero scheduled upcoming/completion notifications on pre-start date 2026-08-08, got ${aug08ScheduledForStudent.length}`
  );

  const evalAug08 = notifCenter.evaluateNotifications({
    userId: 'acc_notif_period',
    lang: 'ar',
    now: refAug08Morning,
  });
  const debtNotifAug08 = evalAug08.some(
    (n) => n.type === 'today_lesson_debt' && n.studentId === 'st_notif_future' && n.id.includes('2026-08-08')
  );
  assert(!debtNotifAug08, 'Suite H: today_lesson_debt suppressed on pre-start date 2026-08-08');

  // Now check on active Saturday 2026-08-15 at 09:00 local time!
  const refAug15Morning = new Date(2026, 7, 15, 9, 0, 0);
  await notifCenter.reconcileScheduledNotifications({
    userId: 'acc_notif_period',
    isEn: false,
    now: refAug15Morning,
  });
  const regAug15Entries = Object.entries(notifCenter.getScheduledRegistry('acc_notif_period'));
  const aug15Upcoming = regAug15Entries.filter(
    ([dedupeKey, item]) => item.category === 'lesson_reminders' && dedupeKey.includes('2026-08-15')
  );
  assert(aug15Upcoming.length === 1, 'Suite H: Upcoming lesson notification scheduled on active startDate 2026-08-15');

  const evalAug15 = notifCenter.evaluateNotifications({
    userId: 'acc_notif_period',
    lang: 'ar',
    now: refAug15Morning,
  });
  const debtNotifAug15 = evalAug15.some(
    (n) => n.type === 'today_lesson_debt' && n.studentId === 'st_notif_future' && n.id.includes('2026-08-15')
  );
  assert(debtNotifAug15, 'Suite H: today_lesson_debt emitted when enrollment is active on 2026-08-15');

  // Add a vacation covering 2026-08-15 and reconcile twice -> verify 2026-08-15 scheduled item is cancelled/removed and no duplicates exist!
  db.updateEnrollmentBilling(notifEnr.id, {
    vacationPeriods: [{ id: 'v_notif_aug15', startDate: '2026-08-14', endDate: '2026-08-16' }],
  });
  await notifCenter.reconcileScheduledNotifications({
    userId: 'acc_notif_period',
    isEn: false,
    now: refAug15Morning,
  });
  await notifCenter.reconcileScheduledNotifications({
    userId: 'acc_notif_period',
    isEn: false,
    now: refAug15Morning,
  });
  const regAfterVacEntries = Object.entries(notifCenter.getScheduledRegistry('acc_notif_period'));
  const aug15AfterVac = regAfterVacEntries.filter(
    ([dedupeKey, item]) => item.category === 'lesson_reminders' && dedupeKey.includes('2026-08-15')
  );
  assert(
    aug15AfterVac.length === 0,
    'Suite H: Adding vacation covering 2026-08-15 cancels/removes scheduled notifications for that date'
  );
  const uniqueNumericIds = new Set(regAfterVacEntries.map(([, item]) => item.numericId));
  assert(
    uniqueNumericIds.size === regAfterVacEntries.length,
    'Suite H: Zero duplicate scheduled notifications after repeated edits and reconciliations'
  );
  console.log('[PASS] Suite H — Notification Suppression, Reactivation, & Deduplication');

  console.log('\n============================================================================');
  console.log('ALL 8 ENROLLMENT PERIOD VERIFICATION SUITES (A–H) PASSED 100%!');
  console.log('============================================================================');
  process.exit(0);
}

runEnrollmentPeriodVerificationSuite().catch((err) => {
  console.error('\n[FAIL] Enrollment Period Verification Suite failed:', err);
  process.exit(1);
});
