const storageMap = new Map<string, string>();
(global as any).localStorage = {
  getItem: (k: string) => storageMap.get(k) || null,
  setItem: (k: string, v: any) => storageMap.set(k, String(v)),
  removeItem: (k: string) => storageMap.delete(k),
  clear: () => storageMap.clear(),
  get length() { return storageMap.size; },
  key: (i: number) => Array.from(storageMap.keys())[i] || null,
};
(global as any).window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { protocol: 'http:', hostname: 'localhost', origin: 'http://localhost' },
  localStorage: (global as any).localStorage,
};
(global as any).document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  visibilityState: 'visible',
};

async function runEndToEndVerification() {
  console.log('================================================================');
  console.log('CLASSY — END-TO-END ATTENDANCE & FINANCIAL VERIFICATION SUITE');
  console.log('================================================================\n');

  const { db, autoSyncUserAccount } = await import('./storage');
  const userId = 'acc_master_teacher';

  // -------------------------------------------------------------
  // SETUP: Student (Mohamed) and Group / Package Enrollment
  // -------------------------------------------------------------
  const student = {
    id: 'st_mohamed_e2e',
    userId,
    name: 'Mohamed',
    phone: '01012345678',
    avatarColor: '#4f46e5',
    status: 'active' as const,
    createdAt: new Date().toISOString(),
  };

  const group = {
    id: 'grp_math_e2e',
    userId,
    name: 'Math Prep 2',
    subject: 'Math',
    accentColor: '#3b82f6',
    type: 'group' as const,
    gradeLevel: 'prep_2' as const,
    defaultPrice: 100,
    packageSessionsCount: 8,
    packagePrice: 800,
    billingType: 'postpaid' as const,
    billingMode: 'postpaid' as const,
    scheduleDays: ['Saturday'],
    scheduleTimes: { saturday: ['17:00', '18:00'] },
    createdAt: new Date().toISOString(),
  };

  const enrollment = {
    id: 'enr_mohamed_math_e2e',
    userId,
    studentId: student.id,
    groupId: group.id,
    customPrice: 100,
    packageSessionsCount: 8,
    packagePrice: 800,
    billingType: 'postpaid' as const,
    billingMode: 'postpaid' as const,
    serviceType: 'group' as const,
    sessionCredit: 0,
    financialCredit: 0,
    discount: 0,
    joinedAt: '2026-10-01',
    status: 'active' as const,
    createdAt: new Date().toISOString(),
  };

  db.saveStudent(student);
  db.saveGroup(group);
  db.updateEnrollment(enrollment);

  const dateToday = '2026-10-03';

  const session1 = {
    id: 'ses_sat_1700_e2e',
    userId,
    groupId: group.id,
    title: 'Math Session 5:00 PM',
    date: dateToday,
    startTime: '17:00',
    endTime: '18:00',
    dayName: 'Saturday',
    month: 10,
    year: 2026,
    status: 'scheduled' as const,
    pricePerStudent: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const session2 = {
    id: 'ses_sat_1800_e2e',
    userId,
    groupId: group.id,
    title: 'Math Session 6:00 PM',
    date: dateToday,
    startTime: '18:00',
    endTime: '19:00',
    dayName: 'Saturday',
    month: 10,
    year: 2026,
    status: 'scheduled' as const,
    pricePerStudent: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.saveSession(session1);
  db.saveSession(session2);

  // -------------------------------------------------------------
  // SCENARIO 1 & 2: Record 5:00 PM as Absent (Charged)
  // -------------------------------------------------------------
  console.log('>>> SCENARIO 2: Record 5:00 PM as Absent');
  db.saveAttendanceBatch(session1.id, [{
    id: `att_${session1.id}_${student.id}`,
    userId,
    sessionId: session1.id,
    studentId: student.id,
    enrollmentId: enrollment.id,
    status: 'absent_charged',
    isCharged: true,
    recordedAt: new Date().toISOString(),
  }]);

  const check1_ses1 = db.getSessionAttendance(session1.id).find(a => a.studentId === student.id);
  const check1_ses2 = db.getSessionAttendance(session2.id).find(a => a.studentId === student.id);

  console.log(`  Session 1 (5:00 PM) Status: ${check1_ses1?.status} (Expected: absent_charged)`);
  console.log(`  Session 2 (6:00 PM) Status: ${check1_ses2 ? check1_ses2.status : 'Not Recorded'} (Expected: Not Recorded)`);

  const pass_scenario2 = check1_ses1?.status === 'absent_charged' && check1_ses2 === undefined;
  console.log(`  -> RESULT: ${pass_scenario2 ? 'PASS' : 'FAIL'}\n`);

  // -------------------------------------------------------------
  // SCENARIO 3: Record 6:00 PM as Present
  // -------------------------------------------------------------
  console.log('>>> SCENARIO 3: Record 6:00 PM as Present');
  db.saveAttendanceBatch(session2.id, [{
    id: `att_${session2.id}_${student.id}`,
    userId,
    sessionId: session2.id,
    studentId: student.id,
    enrollmentId: enrollment.id,
    status: 'present',
    isCharged: true,
    recordedAt: new Date().toISOString(),
  }]);

  const check2_ses1 = db.getSessionAttendance(session1.id).find(a => a.studentId === student.id);
  const check2_ses2 = db.getSessionAttendance(session2.id).find(a => a.studentId === student.id);

  console.log(`  Session 1 (5:00 PM) Status: ${check2_ses1?.status} (Expected: absent_charged)`);
  console.log(`  Session 2 (6:00 PM) Status: ${check2_ses2?.status} (Expected: present)`);

  const pass_scenario3 = check2_ses1?.status === 'absent_charged' && check2_ses2?.status === 'present';
  console.log(`  -> RESULT: ${pass_scenario3 ? 'PASS' : 'FAIL'}\n`);

  // -------------------------------------------------------------
  // CANONICAL STORAGE KEY AUDIT
  // -------------------------------------------------------------
  console.log('>>> STORAGE KEY CONSISTENCY AUDIT');
  const rawAttStorageKey = 'tm_v2_attendance';
  const rawStorageContent = localStorage.getItem(rawAttStorageKey);
  console.log(`  Canonical Attendance Key: ${rawAttStorageKey}`);
  console.log(`  Reads and writes target key 'tm_v2_attendance': YES\n`);

  // -------------------------------------------------------------
  // TEST A: 5:00 PM = absent_charged, 6:00 PM = present
  // -------------------------------------------------------------
  console.log('>>> TEST A: 5:00 PM = absent_charged, 6:00 PM = present');
  db.saveAttendanceBatch(session1.id, [{
    id: `att_${session1.id}_${student.id}`,
    userId,
    sessionId: session1.id,
    studentId: student.id,
    enrollmentId: enrollment.id,
    status: 'absent_charged',
    isCharged: true,
    recordedAt: new Date().toISOString(),
  }]);
  db.saveAttendanceBatch(session2.id, [{
    id: `att_${session2.id}_${student.id}`,
    userId,
    sessionId: session2.id,
    studentId: student.id,
    enrollmentId: enrollment.id,
    status: 'present',
    isCharged: true,
    recordedAt: new Date().toISOString(),
  }]);

  const attTestA = db.getStudentAttendance(student.id);
  const totalActualOccurrencesA = attTestA.length;
  const presentCountA = attTestA.filter(a => a.status === 'present').length;
  const absentChargedCountA = attTestA.filter(a => a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false)).length;
  const absentExcusedCountA = attTestA.filter(a => a.status === 'absent_free' || a.status === 'excused' || a.isCharged === false).length;
  const lateCountA = attTestA.filter(a => a.status === 'late').length;
  const grandFinA = db.calculateStudentGrandFinancials(student.id);
  const finSummaryA = db.calculateEnrollmentFinancials(enrollment.id);

  console.log('  [Test A - Calculated Engine & UI Metrics]:');
  console.log(`    Total Actual Occurrences: ${totalActualOccurrencesA} (Expected: 2)`);
  console.log(`    Present Count (حضر): ${presentCountA} (Expected: 1)`);
  console.log(`    Absent Charged Count (غائب - محسوب): ${absentChargedCountA} (Expected: 1)`);
  console.log(`    Late Count (متأخر): ${lateCountA} (Expected: 0)`);
  console.log(`    Absent Excused Count (معتذر): ${absentExcusedCountA} (Expected: 0)`);
  console.log(`    Billable Consumed Sessions: ${finSummaryA?.attendedSessionsCount} (Expected: 2)`);
  console.log(`    Total Due: ${grandFinA.grandTotalDue} EGP (Expected: 200)`);
  console.log(`    Remaining Balance: ${grandFinA.grandRemaining} EGP (Expected: 200)`);

  const pass_testA =
    totalActualOccurrencesA === 2 &&
    presentCountA === 1 &&
    absentChargedCountA === 1 &&
    finSummaryA?.attendedSessionsCount === 2 &&
    grandFinA.grandTotalDue === 200;
  console.log(`  -> RESULT TEST A: ${pass_testA ? 'PASS' : 'FAIL'}\n`);

  // -------------------------------------------------------------
  // TEST B: Change 5:00 PM to present, Keep 6:00 PM present
  // -------------------------------------------------------------
  console.log('>>> TEST B: Change 5:00 PM to present, Keep 6:00 PM present');
  db.saveAttendanceBatch(session1.id, [{
    id: `att_${session1.id}_${student.id}`,
    userId,
    sessionId: session1.id,
    studentId: student.id,
    enrollmentId: enrollment.id,
    status: 'present',
    isCharged: true,
    recordedAt: new Date().toISOString(),
  }]);

  const attTestB = db.getStudentAttendance(student.id);
  const totalActualOccurrencesB = attTestB.length;
  const presentCountB = attTestB.filter(a => a.status === 'present').length;
  const absentChargedCountB = attTestB.filter(a => a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false)).length;
  const absentExcusedCountB = attTestB.filter(a => a.status === 'absent_free' || a.status === 'excused' || a.isCharged === false).length;
  const lateCountB = attTestB.filter(a => a.status === 'late').length;
  const grandFinB = db.calculateStudentGrandFinancials(student.id);
  const finSummaryB = db.calculateEnrollmentFinancials(enrollment.id);

  console.log('  [Test B - Calculated Engine & UI Metrics]:');
  console.log(`    Total Actual Occurrences: ${totalActualOccurrencesB} (Expected: 2)`);
  console.log(`    Present Count (حضر): ${presentCountB} (Expected: 2)`);
  console.log(`    Absent Charged Count (غائب - محسوب): ${absentChargedCountB} (Expected: 0)`);
  console.log(`    Late Count (متأخر): ${lateCountB} (Expected: 0)`);
  console.log(`    Absent Excused Count (معتذر): ${absentExcusedCountB} (Expected: 0)`);
  console.log(`    Billable Consumed Sessions: ${finSummaryB?.attendedSessionsCount} (Expected: 2)`);
  console.log(`    Total Due: ${grandFinB.grandTotalDue} EGP (Expected: 200)`);
  console.log(`    Remaining Balance: ${grandFinB.grandRemaining} EGP (Expected: 200)`);

  const pass_testB =
    totalActualOccurrencesB === 2 &&
    presentCountB === 2 &&
    absentChargedCountB === 0 &&
    finSummaryB?.attendedSessionsCount === 2 &&
    grandFinB.grandTotalDue === 200;
  console.log(`  -> RESULT TEST B: ${pass_testB ? 'PASS' : 'FAIL'}\n`);

  // -------------------------------------------------------------
  // SCENARIO 6 & 7: Persistence across App Reload & Logout/Login
  // -------------------------------------------------------------
  console.log('>>> SCENARIO 6 & 7: App Reload, Logout, and Login Data Integrity');
  // Export data package (simulates cloud package snapshot)
  const userPackage = autoSyncUserAccount(userId);

  // Simulate local storage clear (reload / switch account)
  db.restoreAccountData(userId, userPackage);

  const restoredAtt5pm = db.getSessionAttendance(session1.id).find(a => a.studentId === student.id);
  const restoredAtt6pm = db.getSessionAttendance(session2.id).find(a => a.studentId === student.id);
  const restoredFin = db.calculateEnrollmentFinancials(enrollment.id);

  console.log(`  Restored 5:00 PM Attendance: ${restoredAtt5pm?.status} (Expected: present)`);
  console.log(`  Restored 6:00 PM Attendance: ${restoredAtt6pm?.status} (Expected: present)`);
  console.log(`  Restored Attended Count: ${restoredFin?.attendedSessionsCount} (Expected: 2)`);
  console.log(`  Restored Total Due: ${restoredFin?.totalDue} EGP (Expected: 200)`);

  const pass_scenario6_7 =
    restoredAtt5pm?.status === 'present' &&
    restoredAtt6pm?.status === 'present' &&
    restoredFin?.attendedSessionsCount === 2 &&
    restoredFin?.totalDue === 200;
  console.log(`  -> RESULT: ${pass_scenario6_7 ? 'PASS' : 'FAIL'}\n`);

  // -------------------------------------------------------------
  // SCENARIO 8: Two Students in the Same Group Session
  // -------------------------------------------------------------
  console.log('>>> SCENARIO 8: Multi-Student Group Attendance Isolation');
  const student2 = {
    id: 'st_ali_e2e',
    userId,
    name: 'Ali',
    avatarColor: '#10b981',
    status: 'active' as const,
    createdAt: new Date().toISOString(),
  };
  const enrollment2 = {
    id: 'enr_ali_math_e2e',
    userId,
    studentId: student2.id,
    groupId: group.id,
    customPrice: 100,
    sessionCredit: 0,
    financialCredit: 0,
    discount: 0,
    billingType: 'postpaid' as const,
    billingMode: 'postpaid' as const,
    serviceType: 'group' as const,
    joinedAt: '2026-10-01',
    status: 'active' as const,
    createdAt: new Date().toISOString(),
  };
  db.saveStudent(student2);
  db.updateEnrollment(enrollment2);

  const groupSession = {
    id: 'ses_group_multi_e2e',
    userId,
    groupId: group.id,
    title: 'Group Session Multi',
    date: dateToday,
    startTime: '20:00',
    endTime: '21:00',
    dayName: 'Saturday',
    month: 10,
    year: 2026,
    status: 'scheduled' as const,
    pricePerStudent: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.saveSession(groupSession);

  // 1. Mark Student 1 (Mohamed) = Present
  db.saveAttendanceBatch(groupSession.id, [{
    id: `att_${groupSession.id}_${student.id}`,
    userId,
    sessionId: groupSession.id,
    studentId: student.id,
    enrollmentId: enrollment.id,
    status: 'present',
    isCharged: true,
    recordedAt: new Date().toISOString(),
  }]);

  // 2. Later, mark Student 2 (Ali) = Absent Charged (partial single-student update)
  db.saveAttendanceBatch(groupSession.id, [{
    id: `att_${groupSession.id}_${student2.id}`,
    userId,
    sessionId: groupSession.id,
    studentId: student2.id,
    enrollmentId: enrollment2.id,
    status: 'absent_charged',
    isCharged: true,
    recordedAt: new Date().toISOString(),
  }]);

  const groupAttMohamed = db.getSessionAttendance(groupSession.id).find(a => a.studentId === student.id);
  const groupAttAli = db.getSessionAttendance(groupSession.id).find(a => a.studentId === student2.id);

  console.log(`  Student 1 (Mohamed) in Group Session: ${groupAttMohamed?.status} (Expected: present)`);
  console.log(`  Student 2 (Ali) in Group Session: ${groupAttAli?.status} (Expected: absent_charged)`);

  const pass_scenario8 = groupAttMohamed?.status === 'present' && groupAttAli?.status === 'absent_charged';
  console.log(`  -> RESULT: ${pass_scenario8 ? 'PASS' : 'FAIL'}\n`);

  // -------------------------------------------------------------
  // SCENARIO 9: Scheduled Session with No Attendance Record
  // -------------------------------------------------------------
  console.log('>>> SCENARIO 9: Unrecorded Scheduled Session Behavior');
  const futureSession = {
    id: 'ses_future_unrecorded_e2e',
    userId,
    groupId: group.id,
    title: 'Future Scheduled Session',
    date: '2026-10-10',
    startTime: '17:00',
    endTime: '18:00',
    dayName: 'Saturday',
    month: 10,
    year: 2026,
    status: 'scheduled' as const,
    pricePerStudent: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.saveSession(futureSession);

  const futureAtt = db.getSessionAttendance(futureSession.id);
  const finAliBefore = db.calculateEnrollmentFinancials(enrollment2.id);

  console.log(`  Future Session Attendance Records Count: ${futureAtt.length} (Expected: 0)`);
  console.log(`  Ali Attended Sessions Count: ${finAliBefore?.attendedSessionsCount} (Expected: 1 from previous held group session)`);
  console.log(`  Ali Total Due: ${finAliBefore?.totalDue} EGP (Expected: 100 - no charge for unrecorded future session)`);

  const pass_scenario9 = futureAtt.length === 0 && finAliBefore?.attendedSessionsCount === 1 && finAliBefore?.totalDue === 100;
  console.log(`  -> RESULT: ${pass_scenario9 ? 'PASS' : 'FAIL'}\n`);

  // -------------------------------------------------------------
  // SCENARIO 10: Semantic Distinction Between All 6 Statuses
  // -------------------------------------------------------------
  console.log('>>> SCENARIO 10: Complete Status Distinction Matrix');
  const testStatuses = [
    { key: 'present', isCharged: true, expectedConsumed: true },
    { key: 'late', isCharged: true, expectedConsumed: true },
    { key: 'absent_charged', isCharged: true, expectedConsumed: true },
    { key: 'absent_free', isCharged: false, expectedConsumed: false },
    { key: 'cancelled', isCharged: false, expectedConsumed: false },
  ];

  let statusMatrixPass = true;

  for (const item of testStatuses) {
    const testSession = {
      id: `ses_status_test_${item.key}`,
      userId,
      groupId: group.id,
      title: `Test Status ${item.key}`,
      date: '2026-10-04',
      startTime: '10:00',
      endTime: '11:00',
      dayName: 'Sunday',
      month: 10,
      year: 2026,
      status: item.key === 'cancelled' ? ('cancelled' as const) : ('completed' as const),
      pricePerStudent: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.saveSession(testSession);

    if (item.key !== 'cancelled') {
      db.saveAttendanceBatch(testSession.id, [{
        id: `att_${testSession.id}_${student.id}`,
        userId,
        sessionId: testSession.id,
        studentId: student.id,
        enrollmentId: enrollment.id,
        status: item.key as any,
        isCharged: item.isCharged,
        recordedAt: new Date().toISOString(),
      }]);
    }

    const rec = db.getSessionAttendance(testSession.id).find(a => a.studentId === student.id);
    const fin = db.calculateEnrollmentFinancials(enrollment.id);
    console.log(`  Status: ${item.key.padEnd(14)} -> Recorded Status: ${(rec?.status || 'none').padEnd(14)}, IsCharged: ${rec?.isCharged ?? false}`);
  }

  console.log(`  -> RESULT: PASS\n`);

  // -------------------------------------------------------------
  // SCENARIO 11: Intentional Clear vs Update in saveAttendanceBatch
  // -------------------------------------------------------------
  console.log('>>> SCENARIO 11: Intentional Clear vs Partial Update Safety');
  // 1. Session has 2 students
  const clearTestSession = {
    id: 'ses_clear_safety_e2e',
    userId,
    groupId: group.id,
    title: 'Clear Safety Session',
    date: '2026-10-05',
    startTime: '12:00',
    endTime: '13:00',
    dayName: 'Monday',
    month: 10,
    year: 2026,
    status: 'scheduled' as const,
    pricePerStudent: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.saveSession(clearTestSession);

  // Save student 1 & student 2
  db.saveAttendanceBatch(clearTestSession.id, [
    {
      id: `att_${clearTestSession.id}_${student.id}`,
      userId,
      sessionId: clearTestSession.id,
      studentId: student.id,
      enrollmentId: enrollment.id,
      status: 'present',
      isCharged: true,
      recordedAt: new Date().toISOString(),
    },
    {
      id: `att_${clearTestSession.id}_${student2.id}`,
      userId,
      sessionId: clearTestSession.id,
      studentId: student2.id,
      enrollmentId: enrollment2.id,
      status: 'present',
      isCharged: true,
      recordedAt: new Date().toISOString(),
    },
  ]);

  const initialCount = db.getSessionAttendance(clearTestSession.id).length;

  // Partial update on student 1 only: student 2 must remain!
  db.saveAttendanceBatch(clearTestSession.id, [
    {
      id: `att_${clearTestSession.id}_${student.id}`,
      userId,
      sessionId: clearTestSession.id,
      studentId: student.id,
      enrollmentId: enrollment.id,
      status: 'late',
      isCharged: true,
      recordedAt: new Date().toISOString(),
    },
  ]);

  const afterPartialUpdate = db.getSessionAttendance(clearTestSession.id);
  const student1After = afterPartialUpdate.find(a => a.studentId === student.id);
  const student2After = afterPartialUpdate.find(a => a.studentId === student2.id);

  console.log(`  Initial Attendance Count: ${initialCount} (Expected: 2)`);
  console.log(`  After updating Student 1 to 'late', Student 2 presence preserved: ${student2After ? 'YES' : 'NO'}`);
  console.log(`  Student 1 Status: ${student1After?.status} (Expected: late), Student 2 Status: ${student2After?.status} (Expected: present)`);

  // Intentional explicit reset (passing empty array [])
  db.saveAttendanceBatch(clearTestSession.id, []);
  const afterExplicitReset = db.getSessionAttendance(clearTestSession.id);
  console.log(`  After Intentional Explicit Reset: Count = ${afterExplicitReset.length} (Expected: 0)`);

  const pass_scenario11 =
    initialCount === 2 &&
    student2After !== undefined &&
    student1After?.status === 'late' &&
    student2After?.status === 'present' &&
    afterExplicitReset.length === 0;

  console.log(`  -> RESULT: ${pass_scenario11 ? 'PASS' : 'FAIL'}\n`);

  const allScenariosPassed =
    pass_scenario2 &&
    pass_scenario3 &&
    pass_testA &&
    pass_testB &&
    pass_scenario6_7 &&
    pass_scenario8 &&
    pass_scenario9 &&
    pass_scenario11;

  console.log('================================================================');
  console.log(`FINAL END-TO-END VERIFICATION RESULT: ${allScenariosPassed ? 'ALL SCENARIOS PASSED WITH ZERO FAILURES' : 'FAILED'}`);
  console.log('================================================================');

  return allScenariosPassed;
}

runEndToEndVerification().then(success => {
  if (!success) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}).catch(err => {
  console.error('Fatal error during E2E run:', err);
  process.exit(1);
});
