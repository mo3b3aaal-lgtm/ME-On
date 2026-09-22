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

export { type SmartReminderItem, type SmartReminderItem as AppNotification } from '../types';

/**
 * دالة توليد التنبيهات والإشعارات الذكية:
 * 1. احتساب دقيق لعدد حصص الباقة ودورات التجديد (Cycle-Aware Package Billing).
 * 2. عدم إظهار تنبيه السداد إلا عند وصول الطالب للحد المطلوب المحدد بالباقة (مثلاً 8/8).
 * 3. دعم التنبيه المبكر الاختياري (Almost Due) وفق إعدادات المعلم (مثلاً عند 7/8).
 * 4. إخفاء التنبيه تلقائياً بمجرد تسجيل السداد للدورة/الباقة المستحقة (Payment Clears Notification).
 * 5. منع تكرار التنبيهات عبر معرّفات فريدة وثابتة (Deterministic Stable IDs).
 * 6. دعم التصفية حسب الحالة (نشطة / مسددة / مقروءة).
 */
export function getSmartReminders(
  students: Student[],
  groups: Group[],
  sessions: Session[],
  enrollments: Enrollment[],
  attendanceList: Attendance[],
  includeResolved: boolean = false,
  customSettings?: NotificationSettings
): SmartReminderItem[] {
  const reminders: SmartReminderItem[] = [];
  const todayStr = new Date().toISOString().split('T')[0];
  const activeStudents = students.filter((s) => s.status !== 'archived');
  const groupsMap = new Map(groups.map((g) => [g.id, g]));

  const settings = customSettings || db.getNotificationSettings();
  const states = db.getNotificationStates();

  // 1. Unrecorded Attendance for Today's Scheduled Classes
  if (settings.enableAttendanceReminders) {
    const scheduledToday = getScheduledClassesForDate(new Date(), groups, activeStudents, enrollments, true);
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
          reminders.push({
            id,
            type: 'unrecorded_attendance',
            priority: 'high',
            status: isDismissed ? 'dismissed' : 'active',
            isRead: !!state?.isRead,
            title: `رصد حضور: ${item.isPrivate ? item.studentName : item.groupName}`,
            description: `حصة اليوم الساعة ${item.time} لم يُسجل حضورها بعد`,
            badge: 'حضور معلق',
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
          reminders.push({
            id,
            type: 'payment_overdue',
            priority: nonPackageRemaining > 500 ? 'high' : 'medium',
            status: isDismissed ? 'dismissed' : 'active',
            isRead: !!state?.isRead,
            title: `مستحقات سداد: ${student.name}`,
            description: `متبقي على الطالب ${nonPackageRemaining} ج.م لم تُسدد`,
            badge: `${nonPackageRemaining} ج.م مستحقة`,
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
        // Dynamic package size from student's enrollment or group configuration
        const packageSize = Math.max(
          1,
          rawEnrollment?.packageSessionsCount ||
            enr.packageSessionsCount ||
            grp?.packageSessionsCount ||
            8
        );

        // Count only actually attended/completed sessions (Present, Late, Absent-Charged)
        const attendedCount = enr.attendedSessionsCount || 0;
        const totalPaid = enr.totalPaid || 0;
        const packagePrice = enr.packagePrice || grp?.defaultPrice || enr.customPrice || 0;
        const unitRate = packagePrice > 0 ? packagePrice / packageSize : (enr.customPrice || 100);

        // How many cycles are covered by total payments
        const coveredCycles =
          packagePrice > 0
            ? Math.floor((totalPaid + 0.001) / packagePrice)
            : unitRate > 0
            ? Math.floor((totalPaid + 0.001) / (unitRate * packageSize))
            : 0;

        // How many full package cycles has the student reached?
        const completedCycles = Math.floor(attendedCount / packageSize);

        // Process all completed cycles (e.g. Cycle 1 at lesson 8, Cycle 2 at lesson 16, etc.)
        for (let cycle = 1; cycle <= completedCycles; cycle++) {
          const targetLimit = cycle * packageSize;
          const isCyclePaid = coveredCycles >= cycle || (cycle === completedCycles && enr.remaining <= 0);
          const id = `notif_pkg_due_${enr.enrollmentId}_cycle_${cycle}_limit_${packageSize}`;
          const state = states[id];
          const isDismissed = state?.isDismissed;

          // If paid, it's resolved; if unpaid and not dismissed, it's active
          const status = isCyclePaid ? 'resolved' : isDismissed ? 'dismissed' : 'active';

          if (status === 'active' || includeResolved) {
            reminders.push({
              id,
              type: 'package_completed',
              priority: 'high',
              status,
              isRead: !!state?.isRead,
              title: `انتهت الباقة — مستحق سداد: ${student.name}`,
              description: `أكمل الطالب ${targetLimit} ${
                targetLimit === 1 ? 'حصة' : 'حصص'
              } (${packageSize} حصص في الباقة). حان وقت سداد المستحقات.`,
              badge: isCyclePaid ? 'تم سداد الباقة' : `باقة مكتملة (${packageSize}/${packageSize})`,
              studentId: student.id,
              studentName: student.name,
              studentPhone: student.phone,
              parentPhone: student.parentPhone,
              parentRelation: student.parentRelation,
              groupId: enr.groupId,
              groupName: enr.groupType === 'private' ? `درس خاص - ${student.name}` : enr.groupName,
              enrollmentId: enr.enrollmentId,
              packageSize,
              cycleIndex: cycle,
              totalCompletedSessions: targetLimit,
              actionType: 'add_payment',
            });
          }
        }

        // Check in-progress cycle for optional Early Warning (Almost Due)
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
            reminders.push({
              id,
              type: 'package_almost_due',
              priority: 'medium',
              status: isDismissed ? 'dismissed' : 'active',
              isRead: !!state?.isRead,
              title: `اقتراب اكتمال الباقة: ${student.name}`,
              description: `متبقي للطالب ${
                lessonsRemaining === 1 ? 'حصة واحدة' : `${lessonsRemaining} حصص`
              } قبل استحقاق السداد (${cycleAttended}/${packageSize} حصص).`,
              badge: `متبقي ${lessonsRemaining} ${lessonsRemaining === 1 ? 'حصة' : 'حصص'}`,
              studentId: student.id,
              studentName: student.name,
              studentPhone: student.phone,
              parentPhone: student.parentPhone,
              parentRelation: student.parentRelation,
              groupId: enr.groupId,
              groupName: enr.groupType === 'private' ? `درس خاص - ${student.name}` : enr.groupName,
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
        // Prepaid: notify when credits are exhausted
        if (enr.sessionCredit <= 0 && enr.attendedSessionsCount > 0 && enr.remaining > 0) {
          const id = `notif_prepaid_fin_${enr.enrollmentId}`;
          const state = states[id];
          const isDismissed = state?.isDismissed;

          if (!isDismissed || includeResolved) {
            reminders.push({
              id,
              type: 'low_credit',
              priority: 'medium',
              status: isDismissed ? 'dismissed' : 'active',
              isRead: !!state?.isRead,
              title: `نفاد رصيد الحصص: ${student.name}`,
              description: `نفد رصيد الحصص المدفوعة مسبقاً في (${enr.groupName})`,
              badge: 'رصيد منتهي',
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

    // 3. Repeated Absences check (2 or more consecutive absences)
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
            reminders.push({
              id,
              type: 'repeated_absence',
              priority: 'medium',
              status: isDismissed ? 'dismissed' : 'active',
              isRead: !!state?.isRead,
              title: `غياب متكرر: ${student.name}`,
              description: `تغيب الطالب عن آخر حصتين متتاليتين - ينصح بالتواصل مع ولي الأمر`,
              badge: 'غياب متتالي',
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

  // Filter out resolved or dismissed notifications if not explicitly requested
  const filtered = includeResolved
    ? reminders
    : reminders.filter((r) => r.status === 'active');

  // Sorting: Active unread high priority -> Active read high priority -> Active medium -> Low -> Resolved
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
