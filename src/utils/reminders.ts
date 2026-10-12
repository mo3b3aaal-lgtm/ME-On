import {
  Student,
  Group,
  Session,
  Enrollment,
  Attendance,
  SmartReminderItem,
  NotificationSettings,
  NotificationPriority,
} from '../types';
import { db } from './storage';
import { getScheduledClassesForDate } from './schedule';
import { getAppLanguage } from './i18n';
import { toLocalISODate } from './localDate';

export { type SmartReminderItem, type SmartReminderItem as AppNotification } from '../types';

/**
 * Smart Reminder & Notification Generator:
 * Generates natural Arabic / English notifications according to active language
 */
export function getSmartReminders(
  students: Student[],
  groups: Group[],
  sessions: Session[],
  enrollments: Enrollment[],
  attendanceList: Attendance[],
  includeResolved: boolean = false,
  customSettings?: NotificationSettings,
  lang?: string
): SmartReminderItem[] {
  const currentLang = lang || getAppLanguage();
  const isEn = currentLang.startsWith('en');
  const isRTL = !isEn;

  const reminders: SmartReminderItem[] = [];
  const todayStr = toLocalISODate();
  const activeStudents = students.filter((s) => s.status !== 'archived');
  const groupsMap = new Map(groups.map((g) => [g.id, g]));

  const settings = customSettings || db.getNotificationSettings();
  const states = db.getNotificationStates();

  // 1. Unrecorded Attendance for Today's Scheduled Classes
  if (settings.enableAttendanceReminders) {
    const scheduledToday = getScheduledClassesForDate(new Date(), groups, activeStudents, enrollments, isRTL);
    const todaySessions = sessions.filter((s) => s.date === todayStr);

    for (const item of scheduledToday) {
      const matchingSession = todaySessions.find(
        (s) => s.groupId === item.groupId || (item.enrollmentId && s.enrollmentId === item.enrollmentId)
      );
      const hasAttendance = matchingSession ? db.getSessionAttendance(matchingSession.id).length > 0 : false;

      if (!hasAttendance) {
        const id = `notif_att_${item.groupId}_${item.studentId || 'grp'}_${todayStr}`;
        const state = states[id];
        const isDismissed = state?.isDismissed;

        if (!isDismissed || includeResolved) {
          const title = isEn
            ? `Take Attendance: ${item.isPrivate ? item.studentName : item.groupName}`
            : `رصد حضور: ${item.isPrivate ? item.studentName : item.groupName}`;

          const description = isEn
            ? `Today's ${item.time} lesson has not been marked yet`
            : `حصة اليوم الساعة ${item.time} لم يُسجل حضورها بعد`;

          const badge = isEn ? 'Pending Attendance' : 'حضور معلق';

          reminders.push({
            id,
            type: 'unrecorded_attendance',
            priority: 'high',
            status: isDismissed ? 'dismissed' : 'active',
            isRead: !!state?.isRead,
            title,
            description,
            badge,
            groupId: item.groupId,
            groupName: item.groupName,
            studentId: item.studentId,
            studentName: item.studentName,
            sessionId: matchingSession?.id,
            timeStr: item.time,
            actionType: 'record_attendance',
          });
        }
      }
    }
  }

  // 2. Financial & Package Cycle Tracking
  for (const student of activeStudents) {
    const grandFin = db.calculateStudentGrandFinancials(student.id);

    // 2a. Overdue balance reminder for non-package enrollments (Monthly, Postpaid, Hourly)
    if (settings.enableOverdueReminders) {
      const nonPackageEnrollments = grandFin.enrollmentsSummary.filter(
        (e) => e.billingMode !== 'package' && e.billingType !== 'package'
      );
      const nonPackageRemaining = nonPackageEnrollments.reduce((sum, e) => sum + e.remaining, 0);

      if (nonPackageRemaining > 0) {
        const id = `notif_overdue_${student.id}`;
        const state = states[id];
        const isDismissed = state?.isDismissed;

        if (!isDismissed || includeResolved) {
          const currencyLabel = isEn ? 'EGP' : 'ج.م';
          const title = isEn ? `Payment Due: ${student.name}` : `مستحقات سداد: ${student.name}`;
          const description = isEn
            ? `Outstanding balance of ${nonPackageRemaining.toLocaleString()} ${currencyLabel} requires settlement.`
            : `متبقي على الطالب ${nonPackageRemaining.toLocaleString()} ${currencyLabel} لم تُسدد`;
          const badge = isEn
            ? `${nonPackageRemaining.toLocaleString()} ${currencyLabel} Due`
            : `${nonPackageRemaining.toLocaleString()} ج.م مستحقة`;

          reminders.push({
            id,
            type: 'payment_overdue',
            priority: nonPackageRemaining > 500 ? 'high' : 'medium',
            status: isDismissed ? 'dismissed' : 'active',
            isRead: !!state?.isRead,
            title,
            description,
            badge,
            studentId: student.id,
            studentName: student.name,
            studentPhone: student.phone,
            parentPhone: student.parentPhone,
            parentRelation: student.parentRelation,
            amount: nonPackageRemaining,
            actionType: 'add_payment',
          });
        }
      }
    }

    // 2b. Package session count completion and cycle-aware tracking
    for (const enr of grandFin.enrollmentsSummary) {
      const rawEnrollment = enrollments.find((e) => e.id === enr.enrollmentId);
      const grp = groupsMap.get(enr.groupId);
      const isHourly =
        enr.billingType === 'hourly' ||
        enr.billingMode === 'hourly' ||
        grp?.billingType === 'hourly' ||
        grp?.billingMode === 'hourly';

      const isPkg =
        !isHourly &&
        (enr.billingMode === 'package' ||
          enr.billingType === 'package' ||
          grp?.billingType === 'package' ||
          grp?.billingMode === 'package' ||
          Boolean(rawEnrollment?.packageSessionsCount || enr.packageSessionsCount || grp?.packageSessionsCount));

      const isPrepaid =
        !isHourly &&
        !isPkg &&
        (enr.billingMode === 'prepaid' ||
          enr.billingType === 'prepaid' ||
          (enr.billingType === 'per_session' && enr.billingMode !== 'postpaid') ||
          grp?.billingType === 'prepaid');

      if (isPkg) {
        const packageSize = Math.max(
          1,
          rawEnrollment?.packageSessionsCount ||
            enr.packageSessionsCount ||
            grp?.packageSessionsCount ||
            8
        );

        const attendedCount = enr.attendedSessionsCount || 0;
        const totalPaid = enr.totalPaid || 0;
        const packagePrice = enr.packagePrice || grp?.defaultPrice || enr.customPrice || 0;
        const unitRate = packagePrice > 0 ? packagePrice / packageSize : (enr.customPrice || 100);

        const coveredCycles =
          packagePrice > 0
            ? Math.floor((totalPaid + 0.001) / packagePrice)
            : unitRate > 0
            ? Math.floor((totalPaid + 0.001) / (unitRate * packageSize))
            : 0;

        const completedCycles = Math.floor(attendedCount / packageSize);

        for (let cycle = 1; cycle <= completedCycles; cycle++) {
          const targetLimit = cycle * packageSize;
          const isCyclePaid = coveredCycles >= cycle || (cycle === completedCycles && enr.remaining <= 0);
          const id = `notif_pkg_due_${enr.enrollmentId}_cycle_${cycle}_limit_${packageSize}`;
          const state = states[id];
          const isDismissed = state?.isDismissed;

          const status = isCyclePaid ? 'resolved' : isDismissed ? 'dismissed' : 'active';

          if (status === 'active' || includeResolved) {
            const title = isEn
              ? `Package Completed — Payment Due: ${student.name}`
              : `انتهت الباقة — مستحق سداد: ${student.name}`;

            const description = isEn
              ? `Student has completed ${targetLimit} ${targetLimit === 1 ? 'lesson' : 'lessons'} (${packageSize} lessons package). Term renewal is due.`
              : `أكمل الطالب ${targetLimit} ${targetLimit === 1 ? 'حصة' : 'حصص'} (${packageSize} حصص في الباقة). حان وقت سداد المستحقات.`;

            const badge = isEn
              ? isCyclePaid ? 'Package Settled' : `Package Completed (${packageSize}/${packageSize})`
              : isCyclePaid ? 'تم سداد الباقة' : `باقة مكتملة (${packageSize}/${packageSize})`;

            const defaultGroupName = enr.groupType === 'private'
              ? (isEn ? `Private Lesson - ${student.name}` : `درس خاص - ${student.name}`)
              : enr.groupName;

            reminders.push({
              id,
              type: 'package_completed',
              priority: 'high',
              status,
              isRead: !!state?.isRead,
              title,
              description,
              badge,
              studentId: student.id,
              studentName: student.name,
              studentPhone: student.phone,
              parentPhone: student.parentPhone,
              parentRelation: student.parentRelation,
              groupId: enr.groupId,
              groupName: defaultGroupName,
              enrollmentId: enr.enrollmentId,
              packageSize,
              cycleIndex: cycle,
              totalCompletedSessions: targetLimit,
              actionType: 'add_payment',
            });
          }
        }

        const inProgressCycle = completedCycles + 1;
        const cycleAttended = attendedCount - completedCycles * packageSize;
        const lessonsRemaining = packageSize - cycleAttended;
        const isNextCyclePrepaid = coveredCycles >= inProgressCycle;

        if (
          settings.enableEarlyPackageWarning &&
          !isNextCyclePrepaid &&
          lessonsRemaining > 0 &&
          lessonsRemaining <= (settings.earlyWarningLessonThreshold || 1) &&
          cycleAttended > 0
        ) {
          const id = `notif_pkg_warn_${enr.enrollmentId}_cycle_${inProgressCycle}_rem_${lessonsRemaining}`;
          const state = states[id];
          const isDismissed = state?.isDismissed;

          if (!isDismissed || includeResolved) {
            const title = isEn
              ? `Package Near Completion: ${student.name}`
              : `اقتراب اكتمال الباقة: ${student.name}`;

            const description = isEn
              ? `Student has ${lessonsRemaining} ${lessonsRemaining === 1 ? 'lesson' : 'lessons'} remaining before renewal (${cycleAttended}/${packageSize} lessons).`
              : `متبقي للطالب ${lessonsRemaining === 1 ? 'حصة واحدة' : `${lessonsRemaining} حصص`} قبل استحقاق السداد (${cycleAttended}/${packageSize} حصص).`;

            const badge = isEn
              ? `${lessonsRemaining} ${lessonsRemaining === 1 ? 'Lesson' : 'Lessons'} Left`
              : `متبقي ${lessonsRemaining} ${lessonsRemaining === 1 ? 'حصة' : 'حصص'}`;

            const defaultGroupName = enr.groupType === 'private'
              ? (isEn ? `Private Lesson - ${student.name}` : `درس خاص - ${student.name}`)
              : enr.groupName;

            reminders.push({
              id,
              type: 'package_almost_due',
              priority: 'medium',
              status: isDismissed ? 'dismissed' : 'active',
              isRead: !!state?.isRead,
              title,
              description,
              badge,
              studentId: student.id,
              studentName: student.name,
              studentPhone: student.phone,
              parentPhone: student.parentPhone,
              parentRelation: student.parentRelation,
              groupId: enr.groupId,
              groupName: defaultGroupName,
              enrollmentId: enr.enrollmentId,
              packageSize,
              cycleIndex: inProgressCycle,
              lessonsRemaining,
              totalCompletedSessions: attendedCount,
              actionType: 'whatsapp',
            });
          }
        }
      } else if (isPrepaid) {
        if (enr.sessionCredit <= 0 && enr.attendedSessionsCount > 0 && enr.remaining > 0) {
          const id = `notif_prepaid_fin_${enr.enrollmentId}`;
          const state = states[id];
          const isDismissed = state?.isDismissed;

          if (!isDismissed || includeResolved) {
            const title = isEn
              ? `Credits Exhausted: ${student.name}`
              : `نفاد رصيد الحصص: ${student.name}`;

            const description = isEn
              ? `Prepaid lesson credits have expired in (${enr.groupName})`
              : `نفد رصيد الحصص المدفوعة مسبقاً في (${enr.groupName})`;

            const badge = isEn ? 'Credits Exhausted' : 'رصيد منتهي';

            reminders.push({
              id,
              type: 'low_credit',
              priority: 'medium',
              status: isDismissed ? 'dismissed' : 'active',
              isRead: !!state?.isRead,
              title,
              description,
              badge,
              studentId: student.id,
              studentName: student.name,
              studentPhone: student.phone,
              parentPhone: student.parentPhone,
              parentRelation: student.parentRelation,
              groupId: enr.groupId,
              groupName: enr.groupName,
              remainingCredits: enr.sessionCredit,
              actionType: 'add_payment',
            });
          }
        }
      }
    }

    // 3. Repeated Absences check
    if (settings.enableAbsenceReminders) {
      const stuAtt = db.getStudentAttendance(student.id);
      if (stuAtt.length >= 2) {
        const lastTwo = stuAtt.slice(0, 2);
        const isConsecutiveAbsent = lastTwo.every(
          (a) => a.status === 'absent' || a.status === 'absent_charged' || a.status === 'absent_free'
        );
        if (isConsecutiveAbsent) {
          const id = `notif_rep_abs_${student.id}`;
          const state = states[id];
          const isDismissed = state?.isDismissed;

          if (!isDismissed || includeResolved) {
            const title = isEn
              ? `Repeated Absence: ${student.name}`
              : `غياب متكرر: ${student.name}`;

            const description = isEn
              ? 'Student was absent from the last 2 consecutive lessons — recommended to follow up with guardian.'
              : 'تغيب الطالب عن آخر حصتين متتاليتين - ينصح بالتواصل مع ولي الأمر';

            const badge = isEn ? 'Consecutive Absence' : 'غياب متتالي';

            reminders.push({
              id,
              type: 'repeated_absence',
              priority: 'medium',
              status: isDismissed ? 'dismissed' : 'active',
              isRead: !!state?.isRead,
              title,
              description,
              badge,
              studentId: student.id,
              studentName: student.name,
              studentPhone: student.phone,
              parentPhone: student.parentPhone,
              parentRelation: student.parentRelation,
              actionType: 'whatsapp',
            });
          }
        }
      }
    }
  }

  const filtered = includeResolved
    ? reminders
    : reminders.filter((r) => r.status === 'active');

  const priorityScore = (item: SmartReminderItem) => {
    let score = 0;
    if (item.status === 'resolved') score += 100;
    if (item.status === 'dismissed') score += 200;
    if (item.isRead) score += 10;
    if (item.priority === 'high') score += 0;
    else if (item.priority === 'medium') score += 1;
    else score += 2;
    return score;
  };

  filtered.sort((a, b) => priorityScore(a) - priorityScore(b));

  return filtered;
}
