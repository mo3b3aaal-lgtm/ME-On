// Mock complete browser environment for node runner
const mockStore: Record<string, string> = {};
const mockStorage = {
  getItem: (key: string) => mockStore[key] || null,
  setItem: (key: string, val: string) => {
    mockStore[key] = String(val);
  },
  removeItem: (key: string) => {
    delete mockStore[key];
  },
  clear: () => {
    Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  },
  key: (i: number) => Object.keys(mockStore)[i] || null,
  get length() {
    return Object.keys(mockStore).length;
  },
};

(globalThis as any).localStorage = mockStorage;

const eventListeners: Record<string, Function[]> = {};
(globalThis as any).window = {
  location: {
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    origin: 'http://localhost:3000',
  },
  localStorage: mockStorage,
  addEventListener: (event: string, cb: Function) => {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(cb);
  },
  removeEventListener: (event: string, cb: Function) => {
    if (eventListeners[event]) {
      eventListeners[event] = eventListeners[event].filter((f) => f !== cb);
    }
  },
  dispatchEvent: (event: any) => true,
  navigator: { onLine: true },
};

(globalThis as any).document = {
  addEventListener: (event: string, cb: Function) => {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(cb);
  },
  removeEventListener: () => {},
  visibilityState: 'visible',
};

Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true },
  configurable: true,
  writable: true,
});

async function main() {
  const { db, autoSyncUserAccount } = await import('../src/utils/storage');

  console.log('================================================================');
  console.log('🚀 RUNNING FINAL INTEGRITY TEST FOR STUDENT ARCHIVE / DELETE');
  console.log('================================================================\n');

  const testUserId = 'test_teacher_audit_' + Date.now();

  // Set active user session
  db.setCurrentSession({
    id: testUserId,
    name: 'أحمد محمود',
    email: 'test@classy.app',
    subject: 'الفيزياء والرياضيات',
    phone: '01000000000',
    recoveryPin: '1234',
    createdAt: new Date().toISOString(),
  });

  // 1. Create a realistic student: "محمد أدهم"
  const student1Id = 'st_mohamed_adham_' + Date.now();
  const student1: any = {
    id: student1Id,
    userId: testUserId,
    name: 'محمد أدهم',
    phone: '01111111111',
    parentPhone: '01222222222',
    parentName: 'أدهم حسين',
    parentRelation: 'الأب',
    gradeLevel: 'الصف الثاني الثانوي',
    school: 'الأورمان الثانوية',
    status: 'active',
    avatarColor: 'bg-emerald-500',
    createdAt: '2026-08-01T10:00:00.000Z',
  };
  db.saveStudent(student1);

  // 2. Create Group
  const groupId = 'grp_physics_sec2_' + Date.now();
  const group1: any = {
    id: groupId,
    userId: testUserId,
    name: 'مجموعة الفيزياء - 2 ثانوي السبت',
    subject: 'الفيزياء',
    scheduleDays: ['السبت'],
    accentColor: '#7657F6',
    gradeLevel: 'الصف الثاني الثانوي',
    type: 'group',
    billingType: 'per_session',
    billingMode: 'prepaid',
    defaultPrice: 100,
    academicTerm: 'ترم أول',
    createdAt: '2026-08-01T10:00:00.000Z',
  };
  db.saveGroup(group1);

  // 3. Enroll Student in Group
  const grpEnrollment = db.enrollStudent(student1.id, group1.id, {
    serviceType: 'group',
    billingType: 'per_session',
    billingMode: 'prepaid',
    customPrice: 100,
    status: 'active',
  });

  // 4. Create Private Lesson Enrollment for Student
  const privResult = db.createPrivateLessonService(student1.id, {
    subject: 'فيزياء متقدمة (خاص)',
    gradeLevel: 'الصف الثاني الثانوي',
    sessionPrice: 250,
    billingType: 'per_session',
    billingMode: 'prepaid',
    scheduleDays: ['الخميس'],
    scheduleTime: '06:00 م',
  });

  // 5. Create 3 Completed Group Sessions
  const sess1 = {
    id: 'sess_grp_1_' + Date.now(),
    userId: testUserId,
    groupId: group1.id,
    sessionType: 'group' as const,
    title: 'حصة فيزياء: الحركة الموجية',
    date: '2026-08-05',
    dayName: 'الأربعاء',
    month: 8,
    year: 2026,
    startTime: '14:00',
    status: 'completed' as const,
    pricePerStudent: 100,
    effectiveSessionPrice: 100,
    totalSessionValue: 100,
    createdAt: '2026-08-05T10:00:00.000Z',
  };

  const sess2 = {
    id: 'sess_grp_2_' + Date.now(),
    userId: testUserId,
    groupId: group1.id,
    sessionType: 'group' as const,
    title: 'حصة فيزياء: تداخل الضوء',
    date: '2026-08-12',
    dayName: 'الأربعاء',
    month: 8,
    year: 2026,
    startTime: '14:00',
    status: 'completed' as const,
    pricePerStudent: 100,
    effectiveSessionPrice: 100,
    totalSessionValue: 100,
    createdAt: '2026-08-12T10:00:00.000Z',
  };

  const sess3 = {
    id: 'sess_grp_3_' + Date.now(),
    userId: testUserId,
    groupId: group1.id,
    sessionType: 'group' as const,
    title: 'حصة فيزياء: حيود الضوء',
    date: '2026-08-19',
    dayName: 'الأربعاء',
    month: 8,
    year: 2026,
    startTime: '14:00',
    status: 'completed' as const,
    pricePerStudent: 100,
    effectiveSessionPrice: 100,
    totalSessionValue: 100,
    createdAt: '2026-08-19T10:00:00.000Z',
  };

  db.saveSession(sess1);
  db.saveSession(sess2);
  db.saveSession(sess3);

  // 6. Create 1 Completed Private Session
  const sessPriv = {
    id: 'sess_priv_1_' + Date.now(),
    userId: testUserId,
    groupId: privResult.group.id,
    enrollmentId: privResult.enrollment.id,
    studentId: student1.id,
    sessionType: 'private' as const,
    title: 'درس خاص: مراجعة قوانين نيوتن',
    date: '2026-08-20',
    dayName: 'الخميس',
    month: 8,
    year: 2026,
    startTime: '18:00',
    status: 'completed' as const,
    pricePerStudent: 250,
    effectiveSessionPrice: 250,
    totalSessionValue: 250,
    createdAt: '2026-08-20T10:00:00.000Z',
  };
  db.saveSession(sessPriv);

  // 7. Attendance Records:
  // - Group Sess 1: Present (100 EGP)
  // - Group Sess 2: Present (100 EGP)
  // - Group Sess 3: Absent Charged (100 EGP)
  // - Private Sess: Present (250 EGP)
  // Total Expected Charges = 100 + 100 + 100 + 250 = 550 EGP
  const att1 = {
    id: 'att_1_' + Date.now(),
    userId: testUserId,
    sessionId: sess1.id,
    studentId: student1.id,
    enrollmentId: grpEnrollment.id,
    status: 'present' as const,
    isCharged: true,
    priceCharged: 100,
    recordedAt: '2026-08-05T14:30:00.000Z',
  };

  const att2 = {
    id: 'att_2_' + Date.now(),
    userId: testUserId,
    sessionId: sess2.id,
    studentId: student1.id,
    enrollmentId: grpEnrollment.id,
    status: 'present' as const,
    isCharged: true,
    priceCharged: 100,
    recordedAt: '2026-08-12T14:30:00.000Z',
  };

  const att3 = {
    id: 'att_3_' + Date.now(),
    userId: testUserId,
    sessionId: sess3.id,
    studentId: student1.id,
    enrollmentId: grpEnrollment.id,
    status: 'absent_charged' as const,
    isCharged: true,
    priceCharged: 100,
    recordedAt: '2026-08-19T14:30:00.000Z',
  };

  const attPriv = {
    id: 'att_priv_1_' + Date.now(),
    userId: testUserId,
    sessionId: sessPriv.id,
    studentId: student1.id,
    enrollmentId: privResult.enrollment.id,
    status: 'present' as const,
    isCharged: true,
    priceCharged: 250,
    recordedAt: '2026-08-20T18:30:00.000Z',
  };

  db.saveAttendanceBatch(sess1.id, [att1]);
  db.saveAttendanceBatch(sess2.id, [att2]);
  db.saveAttendanceBatch(sess3.id, [att3]);
  db.saveAttendanceBatch(sessPriv.id, [attPriv]);

  // 8. Payments (2 Payments: 200 EGP + 150 EGP = 350 EGP Total Paid)
  // Expected Outstanding Balance = 350 - 550 = -200 EGP (Due 200 EGP)
  const pay1: any = {
    id: 'pay_1_' + Date.now(),
    userId: testUserId,
    studentId: student1.id,
    groupId: group1.id,
    enrollmentId: grpEnrollment.id,
    amount: 200,
    date: '2026-08-10',
    month: 8,
    year: 2026,
    paymentType: 'per_session',
    paymentMethod: 'cash',
    receiptNumber: 'REC-2026-001',
    createdAt: '2026-08-10T10:00:00.000Z',
  };

  const pay2: any = {
    id: 'pay_2_' + Date.now(),
    userId: testUserId,
    studentId: student1.id,
    groupId: privResult.group.id,
    enrollmentId: privResult.enrollment.id,
    amount: 150,
    date: '2026-08-22',
    month: 8,
    year: 2026,
    paymentType: 'per_session',
    paymentMethod: 'vodafone_cash',
    receiptNumber: 'REC-2026-002',
    createdAt: '2026-08-22T10:00:00.000Z',
  };

  db.savePayment(pay1);
  db.savePayment(pay2);

  // -------------------------------------------------------------
  // RECORD BASELINE TOTALS BEFORE ARCHIVING
  // -------------------------------------------------------------
  const finBaseline = db.calculateStudentGrandFinancials(student1.id);
  const teacherFinBaseline = db.calculateFinancialHistory(testUserId);
  const studentAttBaseline = db.getStudentAttendance(student1.id);
  const studentPaymentsBaseline = db.getStudentPayments(student1.id);
  const activeStudentsBaseline = db.getActiveStudents();
  const allStudentsBaseline = db.getStudents();
  const groupStudentsBaseline = db.getGroupStudents(group1.id);
  const studentPrivateEnrBaseline = db.getStudentPrivateEnrollments(student1.id);

  const baselineMetrics = {
    totalSessions: 4,
    presentSessions: studentAttBaseline.filter((a) => a.status === 'present').length,
    absentChargedSessions: studentAttBaseline.filter((a) => a.status === 'absent_charged').length,
    totalCharges: finBaseline.grandTotalDue,
    totalPayments: finBaseline.grandTotalPaid,
    outstandingBalance: finBaseline.grandRemaining,
    groupRecordsCount: db.getGroupEnrollments(group1.id).length,
    privateRecordsCount: studentPrivateEnrBaseline.length,
    overallTeacherRevenue: teacherFinBaseline.totalCollected,
  };

  console.log('📊 BASELINE BEFORE ARCHIVING:');
  console.table({
    'Student Name': student1.name,
    'Total Sessions': baselineMetrics.totalSessions,
    'Present Sessions': baselineMetrics.presentSessions,
    'Absent Charged': baselineMetrics.absentChargedSessions,
    'Total Charges (EGP)': baselineMetrics.totalCharges,
    'Total Payments (EGP)': baselineMetrics.totalPayments,
    'Outstanding Balance (EGP)': baselineMetrics.outstandingBalance,
    'Group Active Members': groupStudentsBaseline.length,
    'Private Enrollments': baselineMetrics.privateRecordsCount,
    'Overall Teacher Collected Revenue': baselineMetrics.overallTeacherRevenue,
  });

  // =============================================================
  // TEST 1: ARCHIVE / KEEP RECORDS
  // =============================================================
  console.log('\n------------------------------------------------------------');
  console.log('🧪 TEST 1: ARCHIVE / KEEP RECORDS ("حذف مع الاحتفاظ بالسجلات")');
  console.log('------------------------------------------------------------');

  db.archiveStudent(student1.id, 'تم الأرشفة للاختبار الشامل');

  const activeStudentsAfterArchive = db.getActiveStudents();
  const archivedStudentsAfterArchive = db.getArchivedStudents();
  const allStudentsAfterArchive = db.getStudents();
  const archivedStudentObj = db.getStudentById(student1.id);
  const studentAttAfterArchive = db.getStudentAttendance(student1.id);
  const studentPaymentsAfterArchive = db.getStudentPayments(student1.id);
  const finAfterArchive = db.calculateStudentGrandFinancials(student1.id);
  const teacherFinAfterArchive = db.calculateFinancialHistory(testUserId);
  const groupStudentsAfterArchive = db.getGroupStudents(group1.id);
  const allSessionsAfterArchive = db.getSessions();
  const privateSessionsAfterArchive = allSessionsAfterArchive.filter((s) => s.studentId === student1.id);

  const test1_archivePass =
    activeStudentsAfterArchive.every((s) => s.id !== student1.id) &&
    archivedStudentsAfterArchive.some((s) => s.id === student1.id) &&
    archivedStudentObj?.status === 'archived' &&
    allStudentsAfterArchive.length === allStudentsBaseline.length;

  const test1_sessionsPass =
    allSessionsAfterArchive.length === 4 &&
    privateSessionsAfterArchive.length === 1 &&
    privateSessionsAfterArchive[0].status === 'completed';

  const test1_attendancePass =
    studentAttAfterArchive.length === 4 &&
    studentAttAfterArchive.filter((a) => a.status === 'present').length === baselineMetrics.presentSessions &&
    studentAttAfterArchive.filter((a) => a.status === 'absent_charged').length === baselineMetrics.absentChargedSessions;

  const test1_paymentsPass =
    studentPaymentsAfterArchive.length === 2 &&
    finAfterArchive.grandTotalPaid === baselineMetrics.totalPayments;

  const test1_financialReportsPass =
    finAfterArchive.grandTotalDue === baselineMetrics.totalCharges &&
    finAfterArchive.grandTotalPaid === baselineMetrics.totalPayments &&
    finAfterArchive.grandRemaining === baselineMetrics.outstandingBalance &&
    teacherFinAfterArchive.totalCollected === baselineMetrics.overallTeacherRevenue;

  const test1_groupHistoryPass =
    groupStudentsAfterArchive.every((s) => s.id !== student1.id) &&
    db.getEnrollments().some((e) => e.studentId === student1.id && e.groupId === group1.id);

  const test1_privateHistoryPass =
    privateSessionsAfterArchive.length === 1 &&
    db.getEnrollments().some((e) => e.studentId === student1.id && e.serviceType === 'private');

  console.log(`✓ Student hidden from active list: ${test1_archivePass ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Historical sessions preserved (4/4): ${test1_sessionsPass ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Historical attendance preserved (4/4): ${test1_attendancePass ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Historical payments preserved (2/2): ${test1_paymentsPass ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Financial reports mathematically identical: ${test1_financialReportsPass ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Removed from active group roster: ${test1_groupHistoryPass ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Private session history intact: ${test1_privateHistoryPass ? 'PASS' : 'FAIL'}`);

  // =============================================================
  // TEST 2: RESTORE
  // =============================================================
  console.log('\n------------------------------------------------------------');
  console.log('🧪 TEST 2: RESTORE ARCHIVED STUDENT');
  console.log('------------------------------------------------------------');

  const restoredObj = db.restoreStudent(student1.id);
  const activeStudentsAfterRestore = db.getActiveStudents();
  const finAfterRestore = db.calculateStudentGrandFinancials(student1.id);
  const groupStudentsAfterRestore = db.getGroupStudents(group1.id);
  const allStudentsAfterRestore = db.getStudents();
  const studentDuplicateCount = allStudentsAfterRestore.filter((s) => s.id === student1.id).length;

  const test2_restorePass =
    restoredObj !== undefined &&
    restoredObj.id === student1.id &&
    restoredObj.status === 'active' &&
    activeStudentsAfterRestore.some((s) => s.id === student1.id);

  const test2_duplicateProtectionPass = studentDuplicateCount === 1;

  const test2_groupReconnectionPass = groupStudentsAfterRestore.some((s) => s.id === student1.id);

  const test2_financialIntegrityPass =
    finAfterRestore.grandTotalDue === baselineMetrics.totalCharges &&
    finAfterRestore.grandTotalPaid === baselineMetrics.totalPayments &&
    finAfterRestore.grandRemaining === baselineMetrics.outstandingBalance;

  console.log(`✓ Restored successfully with identical ID: ${test2_restorePass ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Duplicate protection verified (record count: ${studentDuplicateCount}): ${test2_duplicateProtectionPass ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Group relationship reactivated: ${test2_groupReconnectionPass ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Financial integrity fully preserved: ${test2_financialIntegrityPass ? 'PASS' : 'FAIL'}`);

  // =============================================================
  // TEST 3: PERMANENT DELETE
  // =============================================================
  console.log('\n------------------------------------------------------------');
  console.log('🧪 TEST 3: PERMANENT DELETE ("حذف الطالب وجميع سجلاته")');
  console.log('------------------------------------------------------------');

  // Create a separate test student with records
  const student2Id = 'st_temp_delete_' + Date.now();
  const student2: any = {
    id: student2Id,
    userId: testUserId,
    name: 'طالب مؤقت لاختبار الحذف النهائي',
    phone: '01099999999',
    gradeLevel: 'الصف الأول الثانوي',
    status: 'active',
    avatarColor: 'bg-rose-500',
    createdAt: new Date().toISOString(),
  };
  db.saveStudent(student2);

  const sessTemp: any = {
    id: 'sess_temp_delete_' + Date.now(),
    userId: testUserId,
    studentId: student2.id,
    sessionType: 'private',
    title: 'حصة اختبار حذف نهائي',
    date: '2026-08-25',
    dayName: 'الثلاثاء',
    month: 8,
    year: 2026,
    startTime: '10:00',
    status: 'completed',
    pricePerStudent: 150,
    createdAt: new Date().toISOString(),
  };
  db.saveSession(sessTemp);

  const attTemp: any = {
    id: 'att_temp_delete_' + Date.now(),
    userId: testUserId,
    sessionId: sessTemp.id,
    studentId: student2.id,
    status: 'present',
    isCharged: true,
    priceCharged: 150,
    recordedAt: new Date().toISOString(),
  };
  db.saveAttendanceBatch(sessTemp.id, [attTemp]);

  const payTemp: any = {
    id: 'pay_temp_delete_' + Date.now(),
    userId: testUserId,
    studentId: student2.id,
    amount: 150,
    date: '2026-08-25',
    month: 8,
    year: 2026,
    paymentType: 'per_session',
    paymentMethod: 'cash',
    createdAt: new Date().toISOString(),
  };
  db.savePayment(payTemp);

  // Execute permanent delete
  db.deleteStudentPermanently(student2.id);

  const student2Found = db.getStudents().some((s) => s.id === student2.id);
  const student2AttFound = db.getAttendance().some((a) => a.studentId === student2.id || a.sessionId === sessTemp.id);
  const student2PayFound = db.getPayments().some((p) => p.studentId === student2.id);
  const student2SessFound = db.getSessions().some((s) => s.studentId === student2.id);

  const test3_permanentDeletePass = !student2Found;
  const test3_noOrphansPass = !student2AttFound && !student2PayFound && !student2SessFound;

  console.log(`✓ Student deleted permanently: ${test3_permanentDeletePass ? 'PASS' : 'FAIL'}`);
  console.log(`✓ Orphan records cleaned up completely: ${test3_noOrphansPass ? 'PASS' : 'FAIL'}`);

  // =============================================================
  // TEST 4: CLOUD SYNC & CROSS-DEVICE REPLICATION
  // =============================================================
  console.log('\n------------------------------------------------------------');
  console.log('🧪 TEST 4: CLOUD SYNC & CROSS-DEVICE REPLICATION');
  console.log('------------------------------------------------------------');

  // Device A: Archive student1
  db.archiveStudent(student1.id);
  const packageDeviceA = autoSyncUserAccount(testUserId);

  // Apply to Device B
  db.restoreAccountData(testUserId, packageDeviceA);
  const deviceBStudent = db.getStudentById(student1.id);
  const isArchivedOnDeviceB = deviceBStudent?.status === 'archived';

  // Device B restores student
  db.restoreStudent(student1.id);
  const packageDeviceB = autoSyncUserAccount(testUserId);

  // Sync back to Device A
  db.restoreAccountData(testUserId, packageDeviceB);
  const deviceAStudent = db.getStudentById(student1.id);
  const isRestoredOnDeviceA = deviceAStudent?.status === 'active';

  const test4_cloudSyncPass = isArchivedOnDeviceB && isRestoredOnDeviceA;
  console.log(`✓ Cross-device sync & state replication: ${test4_cloudSyncPass ? 'PASS' : 'FAIL'}`);

  // =============================================================
  // TEST 5: REPORT INTEGRITY BEFORE VS AFTER
  // =============================================================
  console.log('\n------------------------------------------------------------');
  console.log('🧪 TEST 5: REPORT INTEGRITY & NUMERICAL ACCURACY');
  console.log('------------------------------------------------------------');

  // Archive again to measure report integrity while in archived state
  db.archiveStudent(student1.id);

  const studentFinArchived = db.calculateStudentGrandFinancials(student1.id);
  const teacherFinArchived = db.calculateFinancialHistory(testUserId);

  const reportDiffs = {
    revenueDiff: Math.abs(studentFinArchived.grandTotalPaid - baselineMetrics.totalPayments),
    chargeDiff: Math.abs(studentFinArchived.grandTotalDue - baselineMetrics.totalCharges),
    outstandingDiff: Math.abs(studentFinArchived.grandRemaining - baselineMetrics.outstandingBalance),
    teacherRevenueDiff: Math.abs(teacherFinArchived.totalCollected - baselineMetrics.overallTeacherRevenue),
  };

  const test5_reportIntegrityPass =
    reportDiffs.revenueDiff === 0 &&
    reportDiffs.chargeDiff === 0 &&
    reportDiffs.outstandingDiff === 0 &&
    reportDiffs.teacherRevenueDiff === 0;

  console.log(`✓ Numerical variance in financial reports: ${reportDiffs.revenueDiff + reportDiffs.chargeDiff + reportDiffs.outstandingDiff} EGP (Diff = 0: ${test5_reportIntegrityPass ? 'PASS' : 'FAIL'})`);

  // Final summary table
  const testResults = {
    Archive: test1_archivePass ? 'PASS' : 'FAIL',
    'Historical Sessions': test1_sessionsPass ? 'PASS' : 'FAIL',
    Attendance: test1_attendancePass ? 'PASS' : 'FAIL',
    Payments: test1_paymentsPass ? 'PASS' : 'FAIL',
    'Financial Reports': test1_financialReportsPass ? 'PASS' : 'FAIL',
    'Group History': test1_groupHistoryPass ? 'PASS' : 'FAIL',
    'Private History': test1_privateHistoryPass ? 'PASS' : 'FAIL',
    Restore: test2_restorePass ? 'PASS' : 'FAIL',
    'Duplicate Protection': test2_duplicateProtectionPass ? 'PASS' : 'FAIL',
    'Permanent Delete': test3_permanentDeletePass ? 'PASS' : 'FAIL',
    'Orphan Records': test3_noOrphansPass ? 'PASS' : 'FAIL',
    'Cloud Sync': test4_cloudSyncPass ? 'PASS' : 'FAIL',
  };

  console.log('\n============================================================');
  console.log('🎯 INTEGRITY TEST RESULTS SUMMARY');
  console.log('============================================================');
  console.table(testResults);
  process.exit(0);
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
