// Setup mock browser environment before any other modules load
class MockLocalStorage {
  private store: Map<string, string> = new Map();
  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const mockStorage = new MockLocalStorage();
(global as any).localStorage = mockStorage;
(global as any).window = {
  localStorage: mockStorage,
  location: {
    hostname: 'localhost',
    origin: 'http://localhost:3000',
    protocol: 'http:',
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
};
(global as any).document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  visibilityState: 'visible',
};

export async function runQaSuite() {
  const { db } = await import('../src/utils/storage');
  const { getSmartReminders } = await import('../src/utils/reminders');
  const {
    roundMoney,
    addMoney,
    subtractMoney,
    multiplyMoney,
    divideMoney,
  } = await import('../src/utils/money');

  interface TestResult {
    category: string;
    name: string;
    passed: boolean;
    details?: string;
    error?: string;
  }

  const results: TestResult[] = [];

  function assert(condition: boolean, category: string, name: string, details?: string) {
    if (condition) {
      results.push({ category, name, passed: true, details });
      console.log(`  [PASS] ${category} > ${name}`);
    } else {
      results.push({ category, name, passed: false, error: details || 'Assertion failed' });
      console.error(`  [FAIL] ${category} > ${name} -> ${details || 'Assertion failed'}`);
    }
  }

  function assertEquals<T>(actual: T, expected: T, category: string, name: string) {
    const isMatch = actual === expected;
    assert(
      isMatch,
      category,
      name,
      isMatch ? `Value: ${actual}` : `Expected: ${expected}, Actual: ${actual}`
    );
  }

  function assertCloseTo(actual: number, expected: number, delta: number = 0.01, category: string, name: string) {
    const isMatch = Math.abs(actual - expected) <= delta;
    assert(
      isMatch,
      category,
      name,
      isMatch ? `Value: ${actual}` : `Expected: ${expected} (±${delta}), Actual: ${actual}`
    );
  }

  console.log('================================================================');
  console.log('STARTING RIGOROUS COMPREHENSIVE QA AUDIT OF CLASSY APP ENGINE');
  console.log('================================================================\n');

  // Clear all storage for clean audit run
  mockStorage.clear();

  // -------------------------------------------------------------
  // SECTION 1: STUDENTS & GROUPS
  // -------------------------------------------------------------
  console.log('\n--- AUDITING SECTION 1: STUDENTS & GROUPS ---');

  const s1: any = {
    id: 'std_test_1',
    name: 'أحمد محمود',
    phone: '01012345678',
    parentPhone: '01112345678',
    parentRelation: 'father',
    gradeLevel: 'الصف الثالث الثانوي',
    status: 'active' as const,
    avatarColor: '#5C788A',
    createdAt: new Date().toISOString(),
  };
  db.saveStudent(s1);
  const fetchedS1 = db.getStudentById('std_test_1');
  assertEquals(fetchedS1?.name, 'أحمد محمود', 'Students', 'Create & Fetch Student s1');

  const s2: any = {
    id: 'std_test_2',
    name: 'سارة علي',
    phone: '01098765432',
    gradeLevel: 'الصف الثاني الثانوي',
    status: 'active' as const,
    avatarColor: '#D49B4B',
    createdAt: new Date().toISOString(),
  };
  db.saveStudent(s2);
  assertEquals(db.getStudents().length, 2, 'Students', 'Student count is 2');

  // Update profile
  s1.name = 'أحمد محمود المعدل';
  db.saveStudent(s1);
  assertEquals(db.getStudentById('std_test_1')?.name, 'أحمد محمود المعدل', 'Students', 'Update Student Name');

  // Create Groups
  const gPackage: any = {
    id: 'grp_pkg_8',
    name: 'مجموعة الفيزياء - باقة 8 حصص',
    subject: 'فيزياء',
    gradeLevel: 'الصف الثالث الثانوي',
    type: 'group' as const,
    billingMode: 'package' as const,
    billingType: 'package' as const,
    packageSessionsCount: 8,
    defaultPrice: 800, // 100/session
    scheduleDays: ['السبت'],
    accentColor: '#5C788A',
    createdAt: new Date().toISOString(),
  };
  db.saveGroup(gPackage);

  const gMonthly: any = {
    id: 'grp_monthly_500',
    name: 'مجموعة الرياضيات - شهري',
    subject: 'رياضيات',
    gradeLevel: 'الصف الثالث الثانوي',
    type: 'group' as const,
    billingMode: 'monthly' as const,
    billingType: 'monthly' as const,
    defaultPrice: 500,
    baseSessionsPerMonth: 8,
    scheduleDays: ['الأحد'],
    accentColor: '#748C70',
    createdAt: new Date().toISOString(),
  };
  db.saveGroup(gMonthly);

  const gPostpaid: any = {
    id: 'grp_postpaid_120',
    name: 'مجموعة الكيمياء - بالحصة',
    subject: 'كيمياء',
    gradeLevel: 'الصف الثاني الثانوي',
    type: 'group' as const,
    billingMode: 'postpaid' as const,
    billingType: 'per_session' as const,
    defaultPrice: 120,
    scheduleDays: ['الإثنين'],
    accentColor: '#C97C5D',
    createdAt: new Date().toISOString(),
  };
  db.saveGroup(gPostpaid);

  assertEquals(db.getGroups().length, 3, 'Groups', 'Created 3 distinct groups');

  // Multi-group enrollment: s1 in gPackage and gMonthly
  const enr1 = db.enrollStudent(s1.id, gPackage.id, {
    customPrice: 800,
    packagePrice: 800,
    packageSessionsCount: 8,
    billingMode: 'package',
    billingType: 'package',
  });

  const enr2 = db.enrollStudent(s1.id, gMonthly.id, {
    customPrice: 500,
    billingMode: 'monthly',
    billingType: 'monthly',
  });

  const enr3 = db.enrollStudent(s2.id, gPostpaid.id, {
    customPrice: 120,
    billingMode: 'postpaid',
    billingType: 'per_session',
  });

  assertEquals(db.getStudentEnrollments(s1.id).length, 2, 'Enrollments', 's1 enrolled in 2 groups simultaneously');
  assertEquals(db.getGroupStudents(gPackage.id).length, 1, 'Enrollments', 'gPackage has 1 student (s1)');

  // -------------------------------------------------------------
  // SECTION 2 & 3: SESSIONS & ATTENDANCE RULES
  // -------------------------------------------------------------
  console.log('\n--- AUDITING SECTION 2 & 3: SESSIONS & ATTENDANCE RULES ---');

  // Create 8 package sessions
  const pkgSessions = [];
  for (let i = 1; i <= 8; i++) {
    const sess = {
      id: `ses_pkg_${i}`,
      groupId: gPackage.id,
      date: `2026-09-0${i}`,
      dayName: 'السبت',
      month: 9,
      year: 2026,
      startTime: '16:00',
      title: `حصة فيزياء رقم ${i}`,
      status: 'completed' as const,
      effectiveSessionPrice: 100,
      totalSessionValue: 100,
      createdAt: new Date().toISOString(),
    };
    db.saveSession(sess);
    pkgSessions.push(sess);
  }
  assertEquals(db.getSessions().length, 8, 'Sessions', 'Created 8 package sessions');

  // Attendance Scenario:
  // Sessions 1-5: Present (5 charged)
  for (let i = 0; i < 5; i++) {
    db.saveAttendanceBatch(pkgSessions[i].id, [
      {
        id: `att_pkg_${i + 1}`,
        sessionId: pkgSessions[i].id,
        studentId: s1.id,
        enrollmentId: enr1.id,
        status: 'present',
        isCharged: true,
        recordedAt: new Date().toISOString(),
      },
    ]);
  }

  // Session 6: Late (Charged, should consume 1 lesson)
  db.saveAttendanceBatch(pkgSessions[5].id, [
    {
      id: 'att_pkg_6',
      sessionId: pkgSessions[5].id,
      studentId: s1.id,
      enrollmentId: enr1.id,
      status: 'late',
      isCharged: true,
      recordedAt: new Date().toISOString(),
    },
  ]);

  // Session 7: Absent Free / Excused (isCharged: false -> MUST NOT consume lesson)
  db.saveAttendanceBatch(pkgSessions[6].id, [
    {
      id: 'att_pkg_7',
      sessionId: pkgSessions[6].id,
      studentId: s1.id,
      enrollmentId: enr1.id,
      status: 'absent',
      isCharged: false,
      absenceReason: 'عذر مرضي مسبق',
      recordedAt: new Date().toISOString(),
    },
  ]);

  // Verify at 7 sessions: 5 present + 1 late + 1 free = 6 charged
  let finS1 = db.calculateStudentGrandFinancials(s1.id);
  let pkgSummary = finS1.enrollmentsSummary.find((e) => e.enrollmentId === enr1.id);
  assertEquals(pkgSummary?.attendedSessionsCount, 6, 'Attendance', 'Charged count is 6 at 7 recorded sessions');

  // Verify NO package-due reminder at 6/8
  let notifs = getSmartReminders(db.getStudents(), db.getGroups(), db.getSessions(), db.getEnrollments(), db.getAttendance(), false);
  let pkgReminders = notifs.filter((n) => n.type === 'package_completed' && n.studentId === s1.id);
  assertEquals(pkgReminders.length, 0, 'Notifications', 'No package-due notification before package completion (6/8)');

  // Session 8: Absent Charged (isCharged: true -> MUST consume 1 lesson)
  db.saveAttendanceBatch(pkgSessions[7].id, [
    {
      id: 'att_pkg_8',
      sessionId: pkgSessions[7].id,
      studentId: s1.id,
      enrollmentId: enr1.id,
      status: 'absent',
      isCharged: true,
      absenceReason: 'غياب بدون إذن',
      recordedAt: new Date().toISOString(),
    },
  ]);

  // Now charged count is 7
  finS1 = db.calculateStudentGrandFinancials(s1.id);
  pkgSummary = finS1.enrollmentsSummary.find((e) => e.enrollmentId === enr1.id);
  assertEquals(pkgSummary?.attendedSessionsCount, 7, 'Attendance', 'Charged count is 7 after 1 charged absence');

  // Add Session 9 and mark present -> exactly 8 charged sessions (Cycle 1 Complete)
  const sess9 = {
    id: 'ses_pkg_9',
    groupId: gPackage.id,
    date: '2026-09-09',
    dayName: 'الأربعاء',
    month: 9,
    year: 2026,
    startTime: '16:00',
    title: 'حصة فيزياء رقم 9',
    status: 'completed' as const,
    effectiveSessionPrice: 100,
    totalSessionValue: 100,
    createdAt: new Date().toISOString(),
  };
  db.saveSession(sess9);
  db.saveAttendanceBatch(sess9.id, [
    {
      id: 'att_pkg_9',
      sessionId: sess9.id,
      studentId: s1.id,
      enrollmentId: enr1.id,
      status: 'present',
      isCharged: true,
      recordedAt: new Date().toISOString(),
    },
  ]);

  finS1 = db.calculateStudentGrandFinancials(s1.id);
  pkgSummary = finS1.enrollmentsSummary.find((e) => e.enrollmentId === enr1.id);
  assertEquals(pkgSummary?.attendedSessionsCount, 8, 'Attendance', 'Charged count reached 8/8');
  assertCloseTo(pkgSummary?.totalDue || 0, 800, 0.01, 'Billing', 'Package 8 lessons billed is 800 EGP');
  assertCloseTo(pkgSummary?.remaining || 0, 800, 0.01, 'Billing', 'Remaining balance is 800 EGP');

  // -------------------------------------------------------------
  // SECTION 5: PACKAGE COMPLETION & NOTIFICATION ENGINE
  // -------------------------------------------------------------
  console.log('\n--- AUDITING SECTION 5: PACKAGE COMPLETION & NOTIFICATION RULES ---');

  // At exact completion of 8 lessons: Exactly ONE notification must appear
  notifs = getSmartReminders(db.getStudents(), db.getGroups(), db.getSessions(), db.getEnrollments(), db.getAttendance(), false);
  pkgReminders = notifs.filter((n) => n.type === 'package_completed' && n.studentId === s1.id);
  assertEquals(pkgReminders.length, 1, 'Notifications', 'Exactly 1 notification at 8/8 package completion');
  assertEquals(pkgReminders[0]?.cycleIndex, 1, 'Notifications', 'Notification is for Cycle 1');

  // Add Session 10 (9 charged sessions, still unpaid)
  const sess10 = {
    id: 'ses_pkg_10',
    groupId: gPackage.id,
    date: '2026-09-10',
    dayName: 'الخميس',
    month: 9,
    year: 2026,
    startTime: '16:00',
    title: 'حصة فيزياء رقم 10',
    status: 'completed' as const,
    effectiveSessionPrice: 100,
    totalSessionValue: 100,
    createdAt: new Date().toISOString(),
  };
  db.saveSession(sess10);
  db.saveAttendanceBatch(sess10.id, [
    {
      id: 'att_pkg_10',
      sessionId: sess10.id,
      studentId: s1.id,
      enrollmentId: enr1.id,
      status: 'present',
      isCharged: true,
      recordedAt: new Date().toISOString(),
    },
  ]);

  // After 9 lessons without payment, STILL only ONE notification for Cycle 1
  notifs = getSmartReminders(db.getStudents(), db.getGroups(), db.getSessions(), db.getEnrollments(), db.getAttendance(), false);
  pkgReminders = notifs.filter((n) => n.type === 'package_completed' && n.studentId === s1.id);
  assertEquals(pkgReminders.length, 1, 'Notifications', 'Still exactly 1 outstanding notification at 9/8 lessons');

  // -------------------------------------------------------------
  // SECTION 6: PAYMENTS & RESOLUTION
  // -------------------------------------------------------------
  console.log('\n--- AUDITING SECTION 6: PAYMENTS & NOTIFICATION RESOLUTION ---');

  // Partial Payment 400 EGP
  const p1 = db.recordPayment({
    studentId: s1.id,
    enrollmentId: enr1.id,
    groupId: gPackage.id,
    amount: 400,
    date: '2026-09-10',
    year: 2026,
    month: 9,
    paymentMethod: 'cash',
    paymentType: 'custom_amount',
    notes: 'دفعة أولى 400 ج.م',
  });
  assert(!!p1.id, 'Payments', 'Recorded partial payment 400 EGP');

  finS1 = db.calculateStudentGrandFinancials(s1.id);
  pkgSummary = finS1.enrollmentsSummary.find((e) => e.enrollmentId === enr1.id);
  assertCloseTo(pkgSummary?.totalPaid || 0, 400, 0.01, 'Payments', 'Total paid is 400 EGP');
  assertCloseTo(pkgSummary?.remaining || 0, 500, 0.01, 'Payments', 'Remaining (900 - 400) is 500 EGP');

  // Full settlement of Cycle 1 (+400 EGP -> Total 800 EGP)
  const p2 = db.recordPayment({
    studentId: s1.id,
    enrollmentId: enr1.id,
    groupId: gPackage.id,
    amount: 400,
    date: '2026-09-11',
    year: 2026,
    month: 9,
    paymentMethod: 'cash',
    paymentType: 'custom_amount',
    notes: 'سداد بقية الباقة الأولى',
  });
  assert(!!p2.id, 'Payments', 'Recorded second payment 400 EGP');

  // Notification for Cycle 1 must now be RESOLVED (disappear from active list)
  notifs = getSmartReminders(db.getStudents(), db.getGroups(), db.getSessions(), db.getEnrollments(), db.getAttendance(), false);
  pkgReminders = notifs.filter((n) => n.type === 'package_completed' && n.studentId === s1.id);
  assertEquals(pkgReminders.length, 0, 'Notifications', 'Cycle 1 notification cleared from active list upon full payment');

  // -------------------------------------------------------------
  // SECTION 4: POSTPAID, MONTHLY, HOURLY BILLING
  // -------------------------------------------------------------
  console.log('\n--- AUDITING SECTION 4: ALL BILLING MODELS ---');

  // Monthly: gMonthly (500 EGP/mo)
  const sessM1 = {
    id: 'ses_m_1',
    groupId: gMonthly.id,
    date: '2026-09-12',
    dayName: 'السبت',
    month: 9,
    year: 2026,
    startTime: '18:00',
    title: 'حصة رياضيات',
    status: 'completed' as const,
    createdAt: new Date().toISOString(),
  };
  db.saveSession(sessM1);
  db.saveAttendanceBatch(sessM1.id, [
    {
      id: 'att_m_1',
      sessionId: sessM1.id,
      studentId: s1.id,
      enrollmentId: enr2.id,
      status: 'present',
      isCharged: true,
      recordedAt: new Date().toISOString(),
    },
  ]);

  finS1 = db.calculateStudentGrandFinancials(s1.id);
  const monthlySummary = finS1.enrollmentsSummary.find((e) => e.enrollmentId === enr2.id);
  assertCloseTo(monthlySummary?.totalDue || 0, 500, 0.01, 'Billing [Monthly]', 'Monthly subscription is 500 EGP');

  // Postpaid: s2 in gPostpaid (120 EGP/session)
  // 3 sessions: 2 present, 1 free absent
  for (let i = 1; i <= 3; i++) {
    const sPost = {
      id: `ses_post_${i}`,
      groupId: gPostpaid.id,
      date: `2026-09-2${i}`,
      dayName: 'الإثنين',
      month: 9,
      year: 2026,
      startTime: '15:00',
      title: `حصة كيمياء ${i}`,
      status: 'completed' as const,
      effectiveSessionPrice: 120,
      totalSessionValue: 120,
      createdAt: new Date().toISOString(),
    };
    db.saveSession(sPost);
    db.saveAttendanceBatch(sPost.id, [
      {
        id: `att_post_${i}`,
        sessionId: sPost.id,
        studentId: s2.id,
        enrollmentId: enr3.id,
        status: i === 3 ? 'absent' : 'present',
        isCharged: i === 3 ? false : true,
        recordedAt: new Date().toISOString(),
      },
    ]);
  }

  const finS2 = db.calculateStudentGrandFinancials(s2.id);
  const postSummary = finS2.enrollmentsSummary.find((e) => e.enrollmentId === enr3.id);
  assertEquals(postSummary?.attendedSessionsCount, 2, 'Billing [Postpaid]', '2 charged sessions out of 3');
  assertCloseTo(postSummary?.totalDue || 0, 240, 0.01, 'Billing [Postpaid]', '2 * 120 = 240 EGP billed');
  assertCloseTo(postSummary?.remaining || 0, 240, 0.01, 'Billing [Postpaid]', '240 EGP remaining balance');

  // Hourly: s3 in private hourly lesson (200 EGP/hr, 1.5 hrs = 300 EGP)
  const s3: any = {
    id: 'std_test_3',
    name: 'كريم عادل',
    status: 'active' as const,
    avatarColor: '#5C788A',
    createdAt: new Date().toISOString(),
  };
  db.saveStudent(s3);
  const privLesson = db.createPrivateLessonService(s3.id, {
    subject: 'برمجة بايثون',
    sessionPrice: 200,
    hourlyRate: 200,
    billingType: 'hourly',
    billingMode: 'hourly',
  });

  const privSess = db.recordPrivateSessionsForStudent({
    studentId: s3.id,
    enrollmentId: privLesson.enrollment.id,
    groupId: privLesson.group.id,
    date: '2026-09-25',
    startTime: '20:00',
    sessionCount: 1,
    hours: 1.5,
    hourlyRate: 200,
    attendanceStatus: 'present',
    isCharged: true,
  });
  assertEquals(privSess.length, 1, 'Private/Hourly', 'Recorded 1 private hourly session');

  const finS3 = db.calculateStudentGrandFinancials(s3.id);
  const hourlySummary = finS3.enrollmentsSummary.find((e) => e.enrollmentId === privLesson.enrollment.id);
  assertCloseTo(hourlySummary?.totalDue || 0, 300, 0.01, 'Billing [Hourly]', '1.5 hrs @ 200 EGP/hr = 300 EGP');

  // -------------------------------------------------------------
  // SECTION 7: REPORTS & FINANCIAL AGGREGATION
  // -------------------------------------------------------------
  console.log('\n--- AUDITING SECTION 7: REPORTS & LEDGERS ---');

  const overview = db.calculateTeacherFinancialOverview();

  // Calculations check:
  // s1: gPackage (9 charged = 900 EGP) + gMonthly (500 EGP) = 1400 EGP
  // s2: gPostpaid (2 charged = 240 EGP)
  // s3: gHourly (1.5h = 300 EGP)
  // Total Due = 1400 + 240 + 300 = 1940 EGP
  // Total Collected = 800 EGP (from s1)
  // Total Remaining = 1140 EGP
  assertCloseTo(overview.totalDues, 1940, 0.01, 'Reports', 'Teacher total expected dues are 1940 EGP');
  assertCloseTo(overview.totalRevenue, 800, 0.01, 'Reports', 'Teacher total collected revenue is 800 EGP');
  assertCloseTo(overview.totalRemaining, 1140, 0.01, 'Reports', 'Teacher total remaining balance is 1140 EGP');
  assertEquals(overview.totalActiveStudents, 3, 'Reports', 'Active students count is 3');

  // -------------------------------------------------------------
  // SECTION 10: BACKUP & RESTORE DATA INTEGRITY
  // -------------------------------------------------------------
  console.log('\n--- AUDITING SECTION 10: BACKUP & DATA RESTORE ---');
  const backupJson = db.exportDatabaseJSON();
  assert(backupJson.length > 50, 'Backup/Restore', 'Database successfully exported to JSON');
  const parsedBackup = JSON.parse(backupJson);
  assertEquals(parsedBackup.students.length, 3, 'Backup/Restore', 'Export contains 3 students');
  assertEquals(parsedBackup.sessions.length, 15, 'Backup/Restore', 'Export contains 15 sessions');

  // -------------------------------------------------------------
  // SECTION 11: HISTORICAL DATA INTEGRITY ON EDIT
  // -------------------------------------------------------------
  console.log('\n--- AUDITING SECTION 11: HISTORICAL DATA INTEGRITY ---');

  // Edit an old session attendance (Session 1 of package from Present to Absent Free)
  db.saveAttendanceBatch(pkgSessions[0].id, [
    {
      id: 'att_pkg_1',
      sessionId: pkgSessions[0].id,
      studentId: s1.id,
      enrollmentId: enr1.id,
      status: 'absent',
      isCharged: false,
      absenceReason: 'تعديل تاريخي مبرر',
      recordedAt: new Date().toISOString(),
    },
  ]);

  // Recalculate s1 financials: charged count should immediately update from 9 to 8
  finS1 = db.calculateStudentGrandFinancials(s1.id);
  pkgSummary = finS1.enrollmentsSummary.find((e) => e.enrollmentId === enr1.id);
  assertEquals(pkgSummary?.attendedSessionsCount, 8, 'Historical', 'Charged count recalculated to 8');
  assertCloseTo(pkgSummary?.totalDue || 0, 800, 0.01, 'Historical', 'Billed recalculated to 800 EGP');
  assertCloseTo(pkgSummary?.remaining || 0, 0, 0.01, 'Historical', 'Remaining balance recalculated to 0 EGP (800 billed - 800 paid)');

  // Verify updated Teacher Overview:
  // Dues = 800 (s1 pkg) + 500 (s1 mon) + 240 (s2) + 300 (s3) = 1840 EGP
  // Collected = 800 EGP
  // Remaining = 1040 EGP
  const updatedOverview = db.calculateTeacherFinancialOverview();
  assertCloseTo(updatedOverview.totalDues, 1840, 0.01, 'Historical', 'Updated teacher total dues are 1840 EGP');
  assertCloseTo(updatedOverview.totalRemaining, 1040, 0.01, 'Historical', 'Updated teacher remaining is 1040 EGP');

  console.log('\n================================================================');
  console.log('AUDIT RUN COMPLETED');
  console.log('================================================================');

  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = results.filter((r) => !r.passed).length;

  console.log(`TOTAL CHECKS: ${totalTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${failedTests}`);

  if (failedTests > 0) {
    console.error('\nFAILED CHECKS:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(`- [${r.category}] ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\nALL 34 END-TO-END QA CHECKS PASSED WITH 100% MATHEMATICAL PRECISION!');
  }
}

runQaSuite().catch((err) => {
  console.error('Fatal audit execution error:', err);
  process.exit(1);
});
