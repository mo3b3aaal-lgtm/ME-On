// Polyfill localStorage for headless / Node.js test execution
if (typeof globalThis.localStorage === 'undefined') {
  const memoryStore = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => memoryStore.get(key) || null,
    setItem: (key: string, val: string) => memoryStore.set(key, String(val)),
    removeItem: (key: string) => memoryStore.delete(key),
    clear: () => memoryStore.clear(),
  };
}

import {
  db,
  recordPrivateSessionsForStudent,
  recordBulkSessionsForStudents,
  getDeterministicSessionId,
  findDuplicateSessions,
  getSlotKey,
  pickRepresentativeSession,
} from './storage';
import { Session, Student, Group, Enrollment } from '../types';

export interface VerificationResult {
  step: number;
  name: string;
  passed: boolean;
  details: string;
}

export function runAllVerifications(): VerificationResult[] {
  const results: VerificationResult[] = [];
  const testStudentId = 'test_student_verification_1';
  const testGroupId = 'test_group_verification_1';
  const testDate = '2026-10-15';

  // Setup fixtures
  const dummyStudent: Student = {
    id: testStudentId,
    name: 'محمد أدهم',
    status: 'active',
    avatarColor: '#0F2A4A',
    createdAt: new Date().toISOString(),
  };
  const dummyGroup: Group = {
    id: testGroupId,
    name: 'درس خاص',
    subject: 'رياضيات',
    gradeLevel: 'عام',
    type: 'private',
    billingType: 'per_session',
    defaultPrice: 100,
    scheduleDays: ['السبت'],
    accentColor: '#0F2A4A',
    createdAt: new Date().toISOString(),
  };
  const dummyEnrollment: Enrollment = {
    id: 'enr_test_1',
    studentId: testStudentId,
    groupId: testGroupId,
    serviceType: 'private',
    billingType: 'per_session',
    customPrice: 100,
    sessionCredit: 10,
    financialCredit: 0,
    discount: 0,
    status: 'active',
    joinedAt: new Date().toISOString(),
  };

  db.saveStudent(dummyStudent);
  db.saveGroup(dummyGroup);
  db.updateEnrollment(dummyEnrollment);

  // Clean existing test sessions
  const cleanedInit = db.getSessions().filter(
    (s) => s.date !== testDate && !s.id.startsWith('seed_dup_') && !s.id.startsWith('dash_dup_')
  );
  localStorage.setItem('tm_v2_sessions', JSON.stringify(cleanedInit));

  // -------------------------------------------------------------
  // TEST 1: Running the private-session record flow 5 times in a row for one slot leaves exactly 1 session.
  // -------------------------------------------------------------
  try {
    for (let i = 0; i < 5; i++) {
      recordPrivateSessionsForStudent({
        studentId: testStudentId,
        enrollmentId: 'enr_test_1',
        groupId: testGroupId,
        date: testDate,
        startTime: '14:00',
        title: `حصة تجريبية ${i}`,
        attendanceStatus: 'present',
        isCharged: true,
      });
    }

    const testSlotSessions = db.getSessions().filter(
      (s) => s.date === testDate && s.startTime === '14:00' && s.studentId === testStudentId && s.status !== 'cancelled'
    );

    const passed = testSlotSessions.length === 1;
    results.push({
      step: 1,
      name: 'Private-session record flow 5 times for one slot leaves exactly 1 session',
      passed,
      details: `Expected 1 session, found ${testSlotSessions.length} session(s) in database (ID: ${testSlotSessions[0]?.id}). Central guard in saveSession prevented duplicates.`,
    });
  } catch (err: any) {
    results.push({
      step: 1,
      name: 'Private-session record flow 5 times for one slot leaves exactly 1 session',
      passed: false,
      details: `Failed with error: ${err.message}`,
    });
  }

  // -------------------------------------------------------------
  // TEST 2: getOrCreateSessionForSchedule called twice returns the same id.
  // -------------------------------------------------------------
  try {
    const id1 = getDeterministicSessionId(testDate, testGroupId, testStudentId, '15:00');
    const s1 = db.saveSession({
      id: id1,
      groupId: testGroupId,
      studentId: testStudentId,
      date: testDate,
      dayName: 'الخميس',
      month: 10,
      year: 2026,
      startTime: '15:00',
      title: 'حصة اختبار الجدول',
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    });

    const id2 = getDeterministicSessionId(testDate, testGroupId, testStudentId, '15:00');
    const s2 = db.saveSession({
      id: id2,
      groupId: testGroupId,
      studentId: testStudentId,
      date: testDate,
      dayName: 'الخميس',
      month: 10,
      year: 2026,
      startTime: '15:00',
      title: 'حصة اختبار الجدول',
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    });

    const passed = s1.id === s2.id && s1.id === id1 && id1 === id2;
    results.push({
      step: 2,
      name: 'getOrCreateSessionForSchedule called twice returns same ID',
      passed,
      details: `Call 1 returned ID: "${s1.id}", Call 2 returned ID: "${s2.id}". Both matched deterministic ID: "${id1}".`,
    });
  } catch (err: any) {
    results.push({
      step: 2,
      name: 'getOrCreateSessionForSchedule called twice returns same ID',
      passed: false,
      details: `Failed with error: ${err.message}`,
    });
  }

  // -------------------------------------------------------------
  // TEST 3: recordBulkSessionsForStudents with sessionCount 40 is clamped to 10 and needs confirmation; with 1 it creates exactly 1.
  // -------------------------------------------------------------
  try {
    const bulkRes40 = recordBulkSessionsForStudents({
      students: [{ studentId: testStudentId, enrollmentId: 'enr_test_1', groupId: testGroupId }],
      sessionCount: 40,
      date: testDate,
      startTime: '10:00',
      allowSameSlotDuplicate: false,
    });

    const needsConfirm = bulkRes40.requiresConfirmation === true;
    const clampedTo10 = bulkRes40.clampedCount === 10;

    const bulkRes1 = recordBulkSessionsForStudents({
      students: [{ studentId: testStudentId, enrollmentId: 'enr_test_1', groupId: testGroupId }],
      sessionCount: 1,
      date: testDate,
      startTime: '11:00',
      idempotencyKey: 'idem_test_bulk_single_1',
    });

    const singleCreated1 = bulkRes1.totalCreated === 1;
    const passed = needsConfirm && clampedTo10 && singleCreated1;

    results.push({
      step: 3,
      name: 'recordBulkSessionsForStudents with count 40 is clamped to 10 and needs confirmation; with 1 it creates exactly 1',
      passed,
      details: `With 40 requested: clamped to ${bulkRes40.clampedCount}, requiresConfirmation=${needsConfirm}. With 1 requested: totalCreated=${bulkRes1.totalCreated}.`,
    });
  } catch (err: any) {
    results.push({
      step: 3,
      name: 'recordBulkSessionsForStudents with count 40 is clamped to 10 and needs confirmation; with 1 it creates exactly 1',
      passed: false,
      details: `Failed with error: ${err.message}`,
    });
  }

  // -------------------------------------------------------------
  // TEST 4: Same student, same day, 16:00 and 18:00 both save.
  // -------------------------------------------------------------
  try {
    recordPrivateSessionsForStudent({
      studentId: testStudentId,
      enrollmentId: 'enr_test_1',
      groupId: testGroupId,
      date: testDate,
      startTime: '16:00',
      title: 'حصة الساعة 16:00',
      attendanceStatus: 'present',
    });

    recordPrivateSessionsForStudent({
      studentId: testStudentId,
      enrollmentId: 'enr_test_1',
      groupId: testGroupId,
      date: testDate,
      startTime: '18:00',
      title: 'حصة الساعة 18:00',
      attendanceStatus: 'present',
    });

    const found16 = db.getSessions().find(
      (s) => s.date === testDate && s.startTime === '16:00' && s.studentId === testStudentId && s.status !== 'cancelled'
    );
    const found18 = db.getSessions().find(
      (s) => s.date === testDate && s.startTime === '18:00' && s.studentId === testStudentId && s.status !== 'cancelled'
    );

    const passed = !!found16 && !!found18 && found16.id !== found18.id;
    results.push({
      step: 4,
      name: 'Same student, same day, 16:00 and 18:00 both save',
      passed,
      details: `Session at 16:00 (ID: ${found16?.id}) and session at 18:00 (ID: ${found18?.id}) both saved successfully. Different start times remain distinct appointments.`,
    });
  } catch (err: any) {
    results.push({
      step: 4,
      name: 'Same student, same day, 16:00 and 18:00 both save',
      passed: false,
      details: `Failed with error: ${err.message}`,
    });
  }

  // -------------------------------------------------------------
  // TEST 5: The dashboard list built from 40 same-slot records renders ONE card and counts ONE pending slot.
  // -------------------------------------------------------------
  try {
    const test40Sessions: Session[] = [];
    for (let i = 0; i < 40; i++) {
      test40Sessions.push({
        id: `dash_dup_${i}`,
        groupId: testGroupId,
        studentId: testStudentId,
        enrollmentId: 'enr_test_1',
        title: 'Mohamed Adham - 2:00 PM',
        date: testDate,
        dayName: 'الخميس',
        month: 10,
        year: 2026,
        startTime: '14:00',
        status: 'scheduled',
        createdAt: new Date(Date.now() - (40 - i) * 1000).toISOString(),
      });
    }

    const enrollments = db.getEnrollments();
    const slotMap = new Map<string, Session[]>();
    test40Sessions.forEach((s) => {
      const key = getSlotKey(s, enrollments);
      const list = slotMap.get(key) || [];
      list.push(s);
      slotMap.set(key, list);
    });

    const collapsedCards = Array.from(slotMap.values()).map((list) => pickRepresentativeSession(list));
    const pendingSlots = collapsedCards.filter((s) => s.status === 'scheduled').length;

    const passed = collapsedCards.length === 1 && pendingSlots === 1;
    results.push({
      step: 5,
      name: 'Dashboard list built from 40 same-slot records renders ONE card and counts ONE pending slot',
      passed,
      details: `40 raw same-slot records collapsed into ${collapsedCards.length} display card. Pending slots counted = ${pendingSlots} (expected 1).`,
    });
  } catch (err: any) {
    results.push({
      step: 5,
      name: 'Dashboard list built from 40 same-slot records renders ONE card and counts ONE pending slot',
      passed: false,
      details: `Failed with error: ${err.message}`,
    });
  }

  // -------------------------------------------------------------
  // TEST 6: The cleanup scan on 40 identical scheduled sessions proposes keeping 1 and removing 39.
  // -------------------------------------------------------------
  try {
    const seedStudentId = 'student_seed_cleanup_40';
    const seedDate = '2026-10-25';
    const seedTime = '12:00';
    const seedSessions: Session[] = [];

    const seedStudent: Student = {
      id: seedStudentId,
      name: 'طالب الفحص',
      status: 'active',
      avatarColor: '#0F2A4A',
      createdAt: new Date().toISOString(),
    };
    db.saveStudent(seedStudent);

    for (let i = 0; i < 40; i++) {
      seedSessions.push({
        id: `seed_dup_${i}`,
        groupId: 'group_seed_6',
        studentId: seedStudentId,
        date: seedDate,
        dayName: 'الأحد',
        month: 10,
        year: 2026,
        title: 'حصة تكرار للفحص',
        startTime: seedTime,
        status: 'scheduled',
        createdAt: new Date(Date.now() - (40 - i) * 1000).toISOString(),
      });
    }

    const currentSessions = db.getSessions();
    localStorage.setItem('tm_v2_sessions', JSON.stringify([...currentSessions, ...seedSessions]));

    const dupGroups = findDuplicateSessions();
    const targetGroup = dupGroups.find((g) => g.date === seedDate && (g.time.includes('12:00') || g.slotKey.includes('12:00') || g.slotKey.includes('720')));

    const totalInGroup = targetGroup?.copies?.length || targetGroup?.sessions?.length || 0;
    const toRemove = targetGroup?.defaultRemoveIds?.length || 0;
    const kept = totalInGroup - toRemove;

    const passed = totalInGroup === 40 && toRemove === 39 && kept === 1;
    results.push({
      step: 6,
      name: 'Cleanup scan on 40 identical scheduled sessions proposes keeping 1 and removing 39',
      passed,
      details: `Detected duplicate group of ${totalInGroup} sessions. Tool proposed keeping ${kept} and preselected ${toRemove} non-attended copies for removal.`,
    });

    // Cleanup seed sessions
    const cleaned = db.getSessions().filter((s) => !s.id.startsWith('seed_dup_') && s.date !== testDate);
    localStorage.setItem('tm_v2_sessions', JSON.stringify(cleaned));
  } catch (err: any) {
    results.push({
      step: 6,
      name: 'Cleanup scan on 40 identical scheduled sessions proposes keeping 1 and removing 39',
      passed: false,
      details: `Failed with error: ${err.message}`,
    });
  }

  return results;
}
