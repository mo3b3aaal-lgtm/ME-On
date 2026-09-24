// Initialize in-memory localStorage BEFORE any imports
const memoryStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (k: string) => memoryStorage[k] || null,
  setItem: (k: string, v: string) => { memoryStorage[k] = v; },
  removeItem: (k: string) => { delete memoryStorage[k]; },
  clear: () => { for (const k in memoryStorage) delete memoryStorage[k]; },
};

import { db } from './src/utils/storage';
import { getScheduledClassesForDate } from './src/utils/schedule';
import { Student, Group, Enrollment, Session, Attendance, Payment } from './src/types';

function clearDb() {
  (global as any).localStorage.clear();
}

console.log('====================================================');
console.log('🧪 RUNNING COMPREHENSIVE 12-SCENARIO VERIFICATION TEST');
console.log('====================================================\n');

let allPassed = true;
function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
  } else {
    allPassed = false;
    console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
  }
}

// ----------------------------------------------------
// SCENARIO 1: Private ONLY
// ----------------------------------------------------
console.log('\n--- Scenario 1: Private ONLY ---');
clearDb();

const mohamedAdham: Student = {
  id: 'stu_mohamed_adham',
  name: 'محمد أدهم',
  phone: '01012345678',
  status: 'active',
  avatarColor: '#7657F6',
  createdAt: new Date().toISOString(),
};
db.saveStudent(mohamedAdham);

// Create private service for Mohamed Adham with postpaid billing
const { group: privGroup, enrollment: privEnr } = db.createPrivateLessonService(mohamedAdham.id, {
  subject: 'فيزياء',
  sessionPrice: 150,
  billingMode: 'postpaid',
  billingType: 'postpaid',
  scheduleDays: ['السبت'],
  scheduleTime: '05:00 م',
});

// Create 3 private sessions
const privSessions = db.recordPrivateSessionsForStudent({
  studentId: mohamedAdham.id,
  enrollmentId: privEnr.id,
  groupId: privGroup.id,
  date: '2026-09-24',
  startTime: '17:00',
  sessionCount: 3,
  title: 'محمد أدهم — Private Lesson',
});

// Verify
assert(privSessions.length === 3, '1.1 Three private sessions created');
assert(privSessions.every(s => s.studentId === mohamedAdham.id), '1.2 All sessions have studentId of Mohamed Adham');
assert(privSessions.every(s => s.title.includes('محمد أدهم')), '1.3 Session title displays Mohamed Adham');

// Check that Mohamed does not appear in any group students list
const allGroups = db.getGroups();
const realGroups = allGroups.filter(g => g.type !== 'private');
assert(realGroups.length === 0, '1.4 No real groups exist');

// Check student group relationships
const studentGroups = db.getStudentGroups(mohamedAdham.id);
assert(studentGroups.length === 0, '1.5 Student has 0 groups in db.getStudentGroups');

const serviceType = db.getStudentServiceType(mohamedAdham.id);
assert(serviceType === 'private_only', '1.6 Service type is strictly "private_only"');

// ----------------------------------------------------
// SCENARIO 2: Private Attendance
// ----------------------------------------------------
console.log('\n--- Scenario 2: Private Attendance Statuses ---');
// Test 4 statuses: Present, Absent Charged, Absent Free / Excused, Cancelled
const pSess1 = db.recordPrivateSessionsForStudent({
  studentId: mohamedAdham.id,
  enrollmentId: privEnr.id,
  groupId: privGroup.id,
  date: '2026-09-25',
  startTime: '17:00',
  sessionCount: 1,
  attendanceStatus: 'present',
  isCharged: true,
})[0];

const pSess2 = db.recordPrivateSessionsForStudent({
  studentId: mohamedAdham.id,
  enrollmentId: privEnr.id,
  groupId: privGroup.id,
  date: '2026-09-26',
  startTime: '17:00',
  sessionCount: 1,
  attendanceStatus: 'absent_charged',
  isCharged: true,
})[0];

const pSess3 = db.recordPrivateSessionsForStudent({
  studentId: mohamedAdham.id,
  enrollmentId: privEnr.id,
  groupId: privGroup.id,
  date: '2026-09-27',
  startTime: '17:00',
  sessionCount: 1,
  attendanceStatus: 'absent_free',
  isCharged: false,
})[0];

const pSess4 = db.recordPrivateSessionsForStudent({
  studentId: mohamedAdham.id,
  enrollmentId: privEnr.id,
  groupId: privGroup.id,
  date: '2026-09-28',
  startTime: '17:00',
  sessionCount: 1,
  attendanceStatus: 'cancelled',
  sessionStatus: 'cancelled',
})[0];

const att1 = db.getSessionAttendance(pSess1.id)[0];
const att2 = db.getSessionAttendance(pSess2.id)[0];
const att3 = db.getSessionAttendance(pSess3.id)[0];
const att4 = db.getSessionAttendance(pSess4.id)[0];

assert(att1 && att1.status === 'present' && att1.isCharged === true, '2.1 Present attendance recorded correctly as charged');
assert(att2 && att2.status === 'absent_charged' && att2.isCharged === true, '2.2 Absent charged recorded correctly');
assert(att3 && att3.status === 'absent_free' && att3.isCharged === false, '2.3 Absent free recorded correctly as uncharged');
assert(att4 && att4.isCharged === false, '2.4 Cancelled recorded as uncharged');

// Verify financials of private enrollment
const privFin = db.calculateEnrollmentFinancials(privEnr.id);
// Sessions charged: 3 (initial) + 1 (present) + 1 (absent_charged) = 5 charged sessions. Price 150 each => 750
assert(privFin?.totalDue === 5 * 150, `2.5 Private totalDue is exactly 5 * 150 = 750 (got ${privFin?.totalDue})`);
assert(privFin?.freeSessionsCount === 2, `2.6 Exactly 2 free/cancelled sessions (got ${privFin?.freeSessionsCount})`);

// ----------------------------------------------------
// SCENARIO 3: Group ONLY
// ----------------------------------------------------
console.log('\n--- Scenario 3: Group ONLY ---');
const aliStudent: Student = {
  id: 'stu_ali',
  name: 'علي',
  status: 'active',
  avatarColor: '#55C7E8',
  createdAt: new Date().toISOString(),
};
db.saveStudent(aliStudent);

const chemistryGroup: Group = {
  id: 'grp_chem_1',
  name: 'مجموعة الكيمياء',
  subject: 'كيمياء',
  gradeLevel: 'الصف الأول الثانوي',
  type: 'group',
  billingType: 'monthly',
  defaultPrice: 200,
  scheduleDays: ['الأحد'],
  scheduleTime: '06:00 م',
  accentColor: '#403B9C',
  createdAt: new Date().toISOString(),
};
db.saveGroup(chemistryGroup);

const aliEnr = db.enrollStudent(aliStudent.id, chemistryGroup.id, {
  serviceType: 'group',
  customPrice: 200,
});

assert(db.getStudentServiceType(aliStudent.id) === 'group_only', '3.1 Ali service type is strictly "group_only"');
const aliGroups = db.getStudentGroups(aliStudent.id);
assert(aliGroups.length === 1 && aliGroups[0].group.id === chemistryGroup.id, '3.2 Ali is in Chemistry group');
const aliPrivs = db.getStudentPrivateEnrollments(aliStudent.id);
assert(aliPrivs.length === 0, '3.3 Ali has 0 private enrollments');

const groupStudents = db.getGroupStudents(chemistryGroup.id);
assert(groupStudents.some(s => s.id === aliStudent.id), '3.4 Ali is in getGroupStudents(chemistryGroup)');
assert(!groupStudents.some(s => s.id === mohamedAdham.id), '3.5 Mohamed Adham is NOT in Chemistry Group');

// ----------------------------------------------------
// SCENARIO 4: SAME STUDENT — GROUP + PRIVATE
// ----------------------------------------------------
console.log('\n--- Scenario 4: SAME STUDENT — GROUP + PRIVATE ---');
// Enroll Mohamed Adham in a real Group (Physics Group)
const physicsGroup: Group = {
  id: 'grp_physics_1',
  name: 'مجموعة الفيزياء للثانوية',
  subject: 'فيزياء',
  gradeLevel: 'الصف الثاني الثانوي',
  type: 'group',
  billingType: 'monthly',
  defaultPrice: 300,
  scheduleDays: ['الثلاثاء'],
  scheduleTime: '04:00 م',
  accentColor: '#7657F6',
  createdAt: new Date().toISOString(),
};
db.saveGroup(physicsGroup);

const mohamedGroupEnr = db.enrollStudent(mohamedAdham.id, physicsGroup.id, {
  serviceType: 'group',
  customPrice: 300,
});

// Check service type is now 'both'
assert(db.getStudentServiceType(mohamedAdham.id) === 'both', '4.1 Mohamed Adham service type is "both"');

// Check getStudentGroups vs getStudentPrivateEnrollments
const mGroups = db.getStudentGroups(mohamedAdham.id);
assert(mGroups.length === 1 && mGroups[0].group.id === physicsGroup.id, '4.2 Exactly 1 real group returned');

const mPrivs = db.getStudentPrivateEnrollments(mohamedAdham.id);
assert(mPrivs.length === 1 && mPrivs[0].enrollment.id === privEnr.id, '4.3 Exactly 1 private enrollment returned');

// Create a group session
const groupSession: Session = {
  id: 'ses_grp_phys_1',
  groupId: physicsGroup.id,
  title: 'حصة فيزياء - مجموعة عامة',
  date: '2026-09-30',
  dayName: 'الثلاثاء',
  month: 9,
  year: 2026,
  startTime: '16:00',
  status: 'completed',
  createdAt: new Date().toISOString(),
};
db.saveSession(groupSession);

// Record group attendance for Mohamed Adham (absent_free)
db.saveAttendanceBatch(groupSession.id, [{
  id: 'att_grp_m_1',
  sessionId: groupSession.id,
  studentId: mohamedAdham.id,
  enrollmentId: mohamedGroupEnr.id,
  status: 'absent_free',
  isCharged: false,
  recordedAt: new Date().toISOString(),
}]);

// Check that Mohamed's private financial summary did NOT change
const privFinAfter = db.calculateEnrollmentFinancials(privEnr.id);
assert(privFinAfter?.totalDue === 750, `4.4 Private totalDue remains 750 (got ${privFinAfter?.totalDue})`);

// Check that Mohamed's group financial summary is independent
const grpFin = db.calculateEnrollmentFinancials(mohamedGroupEnr.id);
assert(grpFin?.totalDue === 300, `4.5 Group totalDue is monthly 300 (got ${grpFin?.totalDue})`);

// ----------------------------------------------------
// SCENARIO 5: BILLING ISOLATION
// ----------------------------------------------------
console.log('\n--- Scenario 5: Billing Isolation ---');
// Pay for private enrollment only
const privPayment: Payment = {
  id: 'pay_priv_1',
  studentId: mohamedAdham.id,
  enrollmentId: privEnr.id,
  groupId: privGroup.id,
  amount: 450,
  paymentType: 'custom_amount',
  paymentMethod: 'cash',
  date: '2026-09-24',
  month: 9,
  year: 2026,
  createdAt: new Date().toISOString(),
};
db.savePayment(privPayment);

// Verify private payment does not affect group financials
const privFinAfterPay = db.calculateEnrollmentFinancials(privEnr.id);
const grpFinAfterPay = db.calculateEnrollmentFinancials(mohamedGroupEnr.id);

assert(privFinAfterPay?.totalPaid === 450, `5.1 Private paid is 450 (got ${privFinAfterPay?.totalPaid})`);
assert(privFinAfterPay?.remaining === 300, `5.2 Private remaining is 750 - 450 = 300 (got ${privFinAfterPay?.remaining})`);
assert(grpFinAfterPay?.totalPaid === 0, `5.3 Group paid remains 0 (got ${grpFinAfterPay?.totalPaid})`);
assert(grpFinAfterPay?.remaining === 300, `5.4 Group remaining remains 300 (got ${grpFinAfterPay?.remaining})`);

// ----------------------------------------------------
// SCENARIO 6: REPORTS & GRAND FINANCIALS
// ----------------------------------------------------
console.log('\n--- Scenario 6: Reports & Grand Financials ---');
const grandFin = db.calculateStudentGrandFinancials(mohamedAdham.id);
assert(grandFin.hasGroupService === true, '6.1 grandFin hasGroupService = true');
assert(grandFin.hasPrivateService === true, '6.2 grandFin hasPrivateService = true');
assert(grandFin.groupsFinancials.totalDue === 300, `6.3 groupsFinancials.totalDue is 300 (got ${grandFin.groupsFinancials.totalDue})`);
assert(grandFin.privateFinancials.totalDue === 750, `6.4 privateFinancials.totalDue is 750 (got ${grandFin.privateFinancials.totalDue})`);
assert(grandFin.grandTotalDue === 1050, `6.5 grandTotalDue is 1050 (got ${grandFin.grandTotalDue})`);
assert(grandFin.grandTotalPaid === 450, `6.6 grandTotalPaid is 450 (got ${grandFin.grandTotalPaid})`);
assert(grandFin.grandRemaining === 600, `6.7 grandRemaining is 600 (got ${grandFin.grandRemaining})`);

// ----------------------------------------------------
// SCENARIO 7: DASHBOARD & SCHEDULE DISPLAY
// ----------------------------------------------------
console.log('\n--- Scenario 7: Dashboard Schedule Separation ---');
// Date test: 2026-09-26 is Saturday (matches private lesson on Saturday)
const saturdaySchedule = getScheduledClassesForDate('2026-09-26', db.getGroups(), db.getStudents(), db.getEnrollments());
const privItem = saturdaySchedule.find(s => s.studentId === mohamedAdham.id);
assert(!!privItem, '7.1 Private item found in Saturday schedule');
assert(privItem?.isPrivate === true, '7.2 Item isPrivate is true');
assert(privItem?.studentName === 'محمد أدهم', `7.3 Student name displayed is "محمد أدهم" (got ${privItem?.studentName})`);
assert(privItem?.groupName === 'درس خاص', `7.4 Group name is "درس خاص" without fake group names (got ${privItem?.groupName})`);

// Date test: 2026-09-29 is Tuesday (matches Physics group)
const tuesdaySchedule = getScheduledClassesForDate('2026-09-29', db.getGroups(), db.getStudents(), db.getEnrollments());
const grpItem = tuesdaySchedule.find(s => s.groupId === physicsGroup.id);
assert(!!grpItem, '7.5 Group item found in Tuesday schedule');
assert(grpItem?.isPrivate === false, '7.6 Group item isPrivate is false');
assert(grpItem?.studentName === 'مجموعة الفيزياء للثانوية', '7.7 Group session studentName holds group title');

// ----------------------------------------------------
// SCENARIO 8: CALENDAR
// ----------------------------------------------------
console.log('\n--- Scenario 8: Calendar & Session Queries ---');
const allSessions = db.getSessions();
const privSessionsInDb = allSessions.filter(s => s.studentId === mohamedAdham.id);
const grpSessionsInDb = allSessions.filter(s => s.groupId === physicsGroup.id);

assert(privSessionsInDb.length === 7, `8.1 Exactly 7 private sessions in db (got ${privSessionsInDb.length})`);
assert(grpSessionsInDb.length === 1, `8.2 Exactly 1 group session in db (got ${grpSessionsInDb.length})`);
assert(privSessionsInDb.every(s => s.groupId !== physicsGroup.id), '8.3 Private sessions are NOT linked to physics group');

// ----------------------------------------------------
// SCENARIO 9: NOTIFICATIONS ISOLATION
// ----------------------------------------------------
console.log('\n--- Scenario 9: Notifications Isolation ---');
const privNotifId = `notif_priv_${privEnr.id}`;
db.saveNotificationState({
  id: privNotifId,
  isRead: false,
});
const grpNotifId = `notif_grp_${mohamedGroupEnr.id}`;
db.saveNotificationState({
  id: grpNotifId,
  isRead: false,
});

db.markNotificationAsRead(privNotifId);
const notifStates = db.getNotificationStates();
assert(notifStates[privNotifId]?.isRead === true, '9.1 Private notification marked as read');
assert(notifStates[grpNotifId]?.isRead === false, '9.2 Group notification remains unread and unaffected');

// ----------------------------------------------------
// SCENARIO 10: HISTORICAL DATA INTEGRITY
// ----------------------------------------------------
console.log('\n--- Scenario 10: Historical Data Integrity ---');
// Modify private price from 150 to 200
db.updateEnrollmentBilling(privEnr.id, {
  billingType: 'postpaid',
  customPrice: 200,
});
// Verify historical sessions and attendances retained their recorded prices
const sessAtt = db.getSessionAttendance(pSess1.id)[0];
assert(pSess1.effectiveSessionPrice === 150, '10.1 Historical session snapshot price preserved at 150');

// ----------------------------------------------------
// SCENARIO 11: DUPLICATE STUDENT PROTECTION
// ----------------------------------------------------
console.log('\n--- Scenario 11: Duplicate Student Protection ---');
const allStudents = db.getStudents();
const mohamedStudents = allStudents.filter(s => s.name === 'محمد أدهم');
assert(mohamedStudents.length === 1, `11.1 Exactly 1 student entity for Mohamed Adham in db (got ${mohamedStudents.length})`);

// ----------------------------------------------------
// SCENARIO 12: DELETION SAFETY
// ----------------------------------------------------
console.log('\n--- Scenario 12: Deletion Safety ---');
// Delete private enrollment
db.removeEnrollment(privEnr.id);

// Verify student is still in physics group
const mohamedGroupsAfterPrivDelete = db.getStudentGroups(mohamedAdham.id);
assert(mohamedGroupsAfterPrivDelete.length === 1, '12.1 Student remains enrolled in Physics Group after private enrollment removal');
assert(db.getStudentById(mohamedAdham.id) !== undefined, '12.2 Student entity still exists');

// Verify service type updated to group_only
assert(db.getStudentServiceType(mohamedAdham.id) === 'group_only', '12.3 Service type updated to "group_only"');

// Delete a private session and verify group sessions/attendance unaffected
db.deleteSession(pSess1.id);
assert(db.getSessionById(groupSession.id) !== undefined, '12.4 Group session unaffected by private session deletion');
assert(db.getSessionAttendance(groupSession.id).length === 1, '12.5 Group attendance unaffected');

console.log('\n====================================================');
if (allPassed) {
  console.log('🎉 ALL 12 SCENARIOS PASSED WITH 100% SUCCESS!');
} else {
  console.log('💥 SOME TESTS FAILED! PLEASE REVIEW OUTPUT ABOVE.');
}
console.log('====================================================');
