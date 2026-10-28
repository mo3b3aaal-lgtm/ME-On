import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildFixedWeeklyTimetable, parseRecurringTimeDescriptor } from '/app/applet/src/utils/weeklyTimetable';
import type { Enrollment, Group, Student } from '/app/applet/src/types';

const rootDir = '/app/applet';

// ---------------------------------------------------------------------------
// 1. Header Entry Point & Adjacency Static + Structural Verification
// ---------------------------------------------------------------------------
const screenHeaderSrc = fs.readFileSync(
  path.join(rootDir, 'src/components/ui/ScreenHeader.tsx'),
  'utf8'
);
const bottomNavSrc = fs.readFileSync(
  path.join(rootDir, 'src/components/BottomNavBar.tsx'),
  'utf8'
);
const modalSrc = fs.readFileSync(
  path.join(rootDir, 'src/components/WeeklyTimetableModal.tsx'),
  'utf8'
);
const utilSrc = fs.readFileSync(
  path.join(rootDir, 'src/utils/weeklyTimetable.ts'),
  'utf8'
);

// Verify no inline styles or window.alert / window.open in new/modified timetable files
for (const [name, content] of [
  ['ScreenHeader.tsx', screenHeaderSrc],
  ['WeeklyTimetableModal.tsx', modalSrc],
  ['weeklyTimetable.ts', utilSrc],
] as const) {
  assert.equal(
    content.includes('style={{'),
    false,
    `${name} must not contain inline style={{...}}`
  );
  assert.equal(
    content.includes('window.alert') || content.includes('window.open'),
    false,
    `${name} must not use window.alert or window.open`
  );
}

// Verify BottomNavBar does NOT add a timetable tab
assert.equal(
  bottomNavSrc.toLowerCase().includes('timetable'),
  false,
  'BottomNavBar must not gain another bottom-navigation tab for timetable'
);

// Verify ScreenHeader places timetable button IMMEDIATELY before notifications button in the same action group
const actionGroupMatch = screenHeaderSrc.match(
  /<div className="flex items-center gap-3\.5 shrink-0">([\s\S]*?)<\/div>\s*<\/header>/
);
assert.ok(actionGroupMatch, 'ScreenHeader action group container must exist');
const actionGroupBody = actionGroupMatch[1];

const timetableIdx = actionGroupBody.indexOf('data-testid="header-timetable-btn"');
const notificationsIdx = actionGroupBody.indexOf('data-tutorial-id="header-notifications-btn"');
const settingsIdx = actionGroupBody.indexOf('data-tutorial-id="header-settings-btn"');

assert.ok(timetableIdx !== -1, 'Timetable button must exist in ScreenHeader action group');
assert.ok(notificationsIdx !== -1, 'Notifications button must remain in ScreenHeader action group');
assert.ok(settingsIdx !== -1, 'Settings button must remain in ScreenHeader action group');
assert.ok(
  timetableIdx < notificationsIdx && notificationsIdx < settingsIdx,
  'Timetable button must be placed immediately adjacent to Notifications button in the header action group'
);

// Confirm zero unrelated buttons exist between Timetable and Notifications
const sliceBetweenTimetableAndBell = actionGroupBody.slice(timetableIdx, notificationsIdx);
const buttonOpenTagsBetween = (sliceBetweenTimetableAndBell.match(/<button\b/g) || []).length;
assert.equal(
  buttonOpenTagsBetween,
  0,
  'No other button or control may sit between Timetable button and Notifications button'
);

// Verify all 4 main views pass onOpenTimetable to ScreenHeader
for (const viewRel of [
  'src/components/DashboardView.tsx',
  'src/components/SessionsView.tsx',
  'src/components/ReportsView.tsx',
  'src/components/StudentsView.tsx',
]) {
  const src = fs.readFileSync(path.join(rootDir, viewRel), 'utf8');
  assert.ok(
    src.includes('onOpenTimetable={onOpenTimetableModal}'),
    `${viewRel} must wire onOpenTimetable={onOpenTimetableModal} into ScreenHeader`
  );
}

// Verify WeeklyTimetableModal has zero week-navigation or swipe handlers
assert.equal(
  /onTouchStart|onTouchMove|onTouchEnd|onPointerDown|nextWeek|prevWeek/i.test(modalSrc),
  false,
  'WeeklyTimetableModal must not have week-changing swipe/drag handlers or week navigation'
);

// ---------------------------------------------------------------------------
// 2. Fixed 7-Day Structure & Date-Free Output Verification
// ---------------------------------------------------------------------------
const emptyAr = buildFixedWeeklyTimetable({
  students: [],
  groups: [],
  enrollments: [],
  operationalDateStr: '2026-05-15',
  isRTLOrLang: true,
});

assert.deepEqual(
  emptyAr.days.map((d) => d.dayName),
  ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'],
  'Arabic day headers must follow Classy canonical order Saturday -> Friday with no dates'
);

const emptyEn = buildFixedWeeklyTimetable({
  students: [],
  groups: [],
  enrollments: [],
  operationalDateStr: '2026-05-15',
  isRTLOrLang: false,
});

assert.deepEqual(
  emptyEn.days.map((d) => d.dayName),
  ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  'English day headers must follow Classy canonical order Saturday -> Friday with no dates'
);

// ---------------------------------------------------------------------------
// 3. Automatic Population, Multiple Slots, Explicit Start-End Ranges, Missing Times
// ---------------------------------------------------------------------------
const studentA: Student = {
  id: 'stu_sunday_priv',
  name: 'أحمد محمود',
  status: 'active',
  avatarColor: '#17375E',
  subject: 'رياضيات',
  privateLocation: 'منزل الطالب',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const studentMulti: Student = {
  id: 'stu_multi',
  name: 'سارة خالد',
  status: 'active',
  avatarColor: '#0F2A4A',
  privateDays: ['الأحد', 'الأربعاء'],
  privateTimes: {
    sunday: ['17:00'],
    wednesday: ['19:30 - 21:00'],
  },
  subject: 'فيزياء',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const studentNoTime: Student = {
  id: 'stu_notime',
  name: 'يوسف طارق',
  status: 'active',
  avatarColor: '#5F7083',
  privateDays: ['الخميس'],
  // Intentionally missing privateTime & privateTimes: must NOT invent 16:00 or duration
  createdAt: '2026-01-01T00:00:00.000Z',
};

const groupMon: Group = {
  id: 'grp_mon_6pm',
  name: 'مجموعة الصف الثالث الثانوي',
  subject: 'كيمياء',
  gradeLevel: 'ثانوي 3',
  type: 'group',
  billingType: 'monthly',
  defaultPrice: 300,
  scheduleDays: ['الاثنين'],
  scheduleTime: '18:00',
  roomOrLocation: 'السنتر',
  accentColor: '#17375E',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const groupCollisionSun: Group = {
  id: 'grp_sun_5pm_1',
  name: 'مجموعة التفوق أ',
  subject: 'رياضيات',
  gradeLevel: 'إعدادي 3',
  type: 'group',
  billingType: 'monthly',
  defaultPrice: 250,
  scheduleDays: ['الأحد'],
  scheduleTimes: { sunday: '5:00 PM' },
  roomOrLocation: 'قاعة 1',
  accentColor: '#17375E',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const groupCollisionSun2: Group = {
  id: 'grp_sun_5pm_2',
  name: 'مجموعة التفوق ب',
  subject: 'علوم',
  gradeLevel: 'إعدادي 2',
  type: 'group',
  billingType: 'monthly',
  defaultPrice: 250,
  scheduleDays: ['sunday'],
  scheduleTimes: { sunday: '17:00' },
  roomOrLocation: 'قاعة 2',
  accentColor: '#0F2A4A',
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Legacy private group object (must NEVER appear as kind === 'group')
const legacyPrivateGroup: Group = {
  id: 'grp_legacy_priv',
  name: 'درس خاص قديم',
  subject: 'انجليزي',
  gradeLevel: 'ثانوي 1',
  type: 'private',
  billingType: 'per_session',
  defaultPrice: 150,
  scheduleDays: ['السبت'],
  scheduleTime: '14:00',
  accentColor: '#17375E',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const enrollments: Enrollment[] = [
  // Private student scheduled Sunday at 5:00 PM
  {
    id: 'enr_priv_a',
    studentId: studentA.id,
    groupId: '',
    serviceType: 'private',
    billingType: 'per_session',
    customPrice: 200,
    scheduleDays: ['الأحد'],
    scheduleTimes: { sunday: ['17:00'] },
    sessionCredit: 0,
    financialCredit: 0,
    discount: 0,
    status: 'active',
    joinedAt: '2026-01-01',
  },
  // Multi-lesson student also enrolled in Monday 6:00 PM group
  {
    id: 'enr_grp_multi',
    studentId: studentMulti.id,
    groupId: groupMon.id,
    serviceType: 'group',
    billingType: 'monthly',
    customPrice: 300,
    sessionCredit: 0,
    financialCredit: 0,
    discount: 0,
    status: 'active',
    joinedAt: '2026-01-01',
  },
];

const populated = buildFixedWeeklyTimetable({
  students: [studentA, studentMulti, studentNoTime],
  groups: [groupMon, groupCollisionSun, groupCollisionSun2, legacyPrivateGroup],
  enrollments,
  operationalDateStr: '2026-05-15',
  isRTLOrLang: true,
});

// Verify chronological ordering of rows: 17:00 (1020) < 18:00 (1080) < 19:30 (1170) < unscheduled (99999)
assert.deepEqual(
  populated.rows.map((r) => r.timeSlotKey),
  ['m_1020', 'm_1080', 'm_1170', 'unscheduled_time'],
  'Time rows must be sorted strictly chronologically with missing-time slots last'
);

// Verify Monday 6:00 PM group cell
const mon6pmRow = populated.rows.find((r) => r.timeSlotKey === 'm_1080')!;
assert.equal(mon6pmRow.cells.monday.entries.length, 1);
assert.equal(mon6pmRow.cells.monday.entries[0].kind, 'group');
assert.equal(mon6pmRow.cells.monday.entries[0].title, 'مجموعة الصف الثالث الثانوي');
assert.equal(mon6pmRow.cells.monday.entries[0].activeStudentCount, 1);

// Verify Sunday 5:00 PM collision cell: 2 groups + 2 private students = 4 overlapping items, none overwritten!
const sun5pmRow = populated.rows.find((r) => r.timeSlotKey === 'm_1020')!;
const sun5pmCell = sun5pmRow.cells.sunday;
assert.equal(sun5pmCell.entries.length, 4, 'All 4 overlapping Sunday 5:00 PM lessons must be preserved');
assert.equal(sun5pmCell.hasCollision, true);
assert.equal(sun5pmCell.groupCount, 2);
assert.equal(sun5pmCell.privateCount, 2);

// Verify studentMulti appears in Sunday 5:00 PM, Wednesday 7:30 PM - 9:00 PM, AND Monday 6:00 PM group roster
const wedRow = populated.rows.find((r) => r.timeSlotKey === 'm_1170')!;
assert.equal(wedRow.cells.wednesday.entries.length, 1);
assert.equal(wedRow.cells.wednesday.entries[0].studentId, studentMulti.id);
assert.equal(wedRow.cells.wednesday.entries[0].hasExplicitEndTime, true);
assert.equal(wedRow.cells.wednesday.entries[0].displayTime, '7:30 م – 9:00 م');

// Verify missing time is NOT invented
const unscheduledRow = populated.rows.find((r) => r.timeSlotKey === 'unscheduled_time')!;
assert.equal(unscheduledRow.cells.thursday.entries.length, 1);
assert.equal(unscheduledRow.cells.thursday.entries[0].studentId, studentNoTime.id);
assert.equal(unscheduledRow.cells.thursday.entries[0].hasExplicitTime, false);
assert.equal(unscheduledRow.cells.thursday.entries[0].rawTime, '');
assert.equal(unscheduledRow.cells.thursday.entries[0].endTimeDisplay, undefined);

// Verify legacyPrivateGroup without active enrollment does NOT appear as a group
assert.equal(
  populated.allEntries.some((e) => e.groupId === legacyPrivateGroup.id && e.kind === 'group'),
  false,
  'group.type === "private" must never be rendered as a group lesson'
);

// Verify zero ISO date strings anywhere in generated entries/headers
const serializedOutput = JSON.stringify({
  days: populated.days,
  rowLabels: populated.rows.map((r) => r.label),
  displayTimes: populated.allEntries.map((e) => e.displayTime),
});
assert.equal(
  /\d{4}-\d{2}-\d{2}/.test(serializedOutput),
  false,
  'No dates may appear anywhere in timetable headers, row labels, or display times'
);

// ---------------------------------------------------------------------------
// 4. Dynamic Schedule Edits & Old Slot Removal Verification
// ---------------------------------------------------------------------------
const updatedEnrollments: Enrollment[] = enrollments.map((e) =>
  e.id === 'enr_priv_a'
    ? {
        ...e,
        scheduleDays: ['الثلاثاء'],
        scheduleTimes: { tuesday: ['20:00'] },
      }
    : e
);

const afterEdit = buildFixedWeeklyTimetable({
  students: [studentA],
  groups: [],
  enrollments: updatedEnrollments,
  operationalDateStr: '2026-05-15',
  isRTLOrLang: true,
});

assert.equal(afterEdit.totalLessonsCount, 1, 'Schedule edit must not create duplicate entries');
assert.equal(
  afterEdit.allEntries.some((e) => e.dayKey === 'sunday'),
  false,
  'Old Sunday 5:00 PM slot must be removed immediately when schedule changes'
);
assert.equal(afterEdit.allEntries[0].dayKey, 'tuesday');
assert.equal(afterEdit.allEntries[0].timeSlotKey, 'm_1200');

// ---------------------------------------------------------------------------
// 5. Enrollment Periods (startDate, endDate) & Temporary Vacations Verification
// ---------------------------------------------------------------------------
const vacationStudent: Student = {
  id: 'stu_vac',
  name: 'ليلى حسن',
  status: 'active',
  avatarColor: '#17375E',
  privateDays: ['السبت'], // Fallback schedule also present to test no-leakage during vacation
  privateTime: '16:00',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const vacationEnrollment: Enrollment = {
  id: 'enr_vac',
  studentId: vacationStudent.id,
  groupId: '',
  serviceType: 'private',
  billingType: 'per_session',
  customPrice: 200,
  scheduleDays: ['السبت'],
  scheduleTimes: { saturday: ['16:00'] },
  startDate: '2026-05-01',
  endDate: '2026-06-30',
  vacationPeriods: [
    {
      id: 'vp_1',
      startDate: '2026-05-10',
      endDate: '2026-05-20',
      reason: 'سفر عائلي',
    },
  ],
  sessionCredit: 0,
  financialCredit: 0,
  discount: 0,
  status: 'active',
  joinedAt: '2026-05-01',
};

// 5a. Before startDate (2026-04-25) -> Excluded
const beforeStartRes = buildFixedWeeklyTimetable({
  students: [vacationStudent],
  groups: [],
  enrollments: [vacationEnrollment],
  operationalDateStr: '2026-04-25',
  isRTLOrLang: true,
});
assert.equal(beforeStartRes.totalLessonsCount, 0, 'Student must not appear before enrollment startDate');

// 5b. Active before vacation (2026-05-05) -> Displayed
const activeBeforeVacRes = buildFixedWeeklyTimetable({
  students: [vacationStudent],
  groups: [],
  enrollments: [vacationEnrollment],
  operationalDateStr: '2026-05-05',
  isRTLOrLang: true,
});
assert.equal(activeBeforeVacRes.totalLessonsCount, 1, 'Student must appear during active enrollment period');

// 5c. During vacation (2026-05-15) -> Excluded (and does NOT leak via fallback student.privateDays!)
const duringVacRes = buildFixedWeeklyTimetable({
  students: [vacationStudent],
  groups: [],
  enrollments: [vacationEnrollment],
  operationalDateStr: '2026-05-15',
  isRTLOrLang: true,
});
assert.equal(duringVacRes.totalLessonsCount, 0, 'Student must be hidden during active vacation period');
assert.deepEqual(
  vacationEnrollment.scheduleDays,
  ['السبت'],
  'Permanent recurring schedule must remain intact while suspended by vacation'
);

// 5d. Day after vacation ends (2026-05-21) -> Automatically Resumes!
const afterVacRes = buildFixedWeeklyTimetable({
  students: [vacationStudent],
  groups: [],
  enrollments: [vacationEnrollment],
  operationalDateStr: '2026-05-21',
  isRTLOrLang: true,
});
assert.equal(
  afterVacRes.totalLessonsCount,
  1,
  'Student must automatically resume appearing after vacation ends'
);

// 5e. After endDate (2026-07-01) -> Excluded
const afterEndRes = buildFixedWeeklyTimetable({
  students: [vacationStudent],
  groups: [],
  enrollments: [vacationEnrollment],
  operationalDateStr: '2026-07-01',
  isRTLOrLang: true,
});
assert.equal(afterEndRes.totalLessonsCount, 0, 'Student must not appear after enrollment endDate');

// 5f. Parse time descriptor checks
const singleDesc = parseRecurringTimeDescriptor('17:00', false);
assert.equal(singleDesc.displayTime, '5:00 PM');
assert.equal(singleDesc.hasExplicitEndTime, false);

const rangeDesc = parseRecurringTimeDescriptor('17:00 - 18:30', false);
assert.equal(rangeDesc.displayTime, '5:00 PM – 6:30 PM');
assert.equal(rangeDesc.hasExplicitEndTime, true);

console.log('ALL_WEEKLY_TIMETABLE_VERIFICATION_TESTS_PASSED');
