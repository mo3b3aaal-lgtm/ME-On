import { Student, Group, Session, Enrollment, Attendance } from '../types';
import { db } from './storage';
import { getScheduledClassesForDate } from './schedule';

export interface SmartReminderItem {
  id: string;
  type: 'upcoming_class' | 'unrecorded_attendance' | 'low_credit' | 'finished_package' | 'payment_overdue' | 'repeated_absence';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  badge: string;
  studentId?: string;
  studentName?: string;
  studentPhone?: string;
  parentPhone?: string;
  parentRelation?: string;
  groupId?: string;
  groupName?: string;
  sessionId?: string;
  amount?: number;
  remainingCredits?: number;
  timeStr?: string;
  actionType: 'record_attendance' | 'add_payment' | 'open_student' | 'open_group' | 'whatsapp' | 'call';
}

export function getSmartReminders(
  students: Student[],
  groups: Group[],
  sessions: Session[],
  enrollments: Enrollment[],
  attendanceList: Attendance[]
): SmartReminderItem[] {
  const reminders: SmartReminderItem[] = [];
  const todayStr = new Date().toISOString().split('T')[0];
  const activeStudents = students.filter((s) => s.status !== 'archived');
  const activeStudentsMap = new Map(activeStudents.map((s) => [s.id, s]));
  const groupsMap = new Map(groups.map((g) => [g.id, g]));

  // 1. Unrecorded Attendance for Today's Scheduled Classes
  const scheduledToday = getScheduledClassesForDate(new Date(), groups, activeStudents, enrollments, true);
  const todaySessions = sessions.filter((s) => s.date === todayStr);

  for (const item of scheduledToday) {
    const matchingSession = todaySessions.find(
      (s) => s.groupId === item.groupId || (item.enrollmentId && s.enrollmentId === item.enrollmentId)
    );
    const hasAttendance = matchingSession ? db.getSessionAttendance(matchingSession.id).length > 0 : false;

    if (!hasAttendance) {
      reminders.push({
        id: `rem_att_${item.groupId}_${item.studentId || 'grp'}`,
        type: 'unrecorded_attendance',
        priority: 'high',
        title: `رصد حضور: ${item.isPrivate ? item.studentName : item.groupName}`,
        description: `حصة اليوم الساعة ${item.time} لم يُسجل حضورها بعد`,
        badge: 'حضور معلق',
        groupId: item.groupId,
        groupName: item.groupName,
        studentId: item.studentId,
        studentName: item.studentName,
        sessionId: matchingSession?.id,
        actionType: 'record_attendance',
      });
    }
  }

  // 2. Financial and Session Credit Reminders
  for (const student of activeStudents) {
    const grandFin = db.calculateStudentGrandFinancials(student.id);

    // 2a. Overdue balance reminder for non-package enrollments (Monthly, Postpaid, Hourly, etc.)
    // Note: Outstanding balance MUST NOT trigger a package-completion notification.
    const nonPackageRemaining = grandFin.enrollmentsSummary
      .filter((e) => e.billingMode !== 'package' && e.billingType !== 'package')
      .reduce((sum, e) => sum + e.remaining, 0);

    if (nonPackageRemaining > 0) {
      reminders.push({
        id: `rem_overdue_${student.id}`,
        type: 'payment_overdue',
        priority: nonPackageRemaining > 500 ? 'high' : 'medium',
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

    // 2b. Check package session count completion and prepaid session credits
    for (const enr of grandFin.enrollmentsSummary) {
      const isPkg = enr.billingMode === 'package' || enr.billingType === 'package';
      const isPrepaid = enr.billingMode === 'prepaid' || enr.billingType === 'prepaid';

      if (isPkg) {
        // Teacher defines package session count (e.g., 8, 10, 12 sessions)
        const rawEnrollment = enrollments.find((e) => e.id === enr.enrollmentId);
        const grp = groupsMap.get(enr.groupId);
        const packageSessionsCount =
          rawEnrollment?.packageSessionsCount ||
          enr.packageSessionsCount ||
          grp?.packageSessionsCount ||
          8;
        const packageSize = Math.max(1, packageSessionsCount);

        // Count only sessions that were actually held/recorded (not future, cancelled, or unheld)
        const completedSessions = enr.attendedSessionsCount || 0;

        // Total capacity covered by payments or renewal cycles
        const purchasedSessions = enr.purchasedSessionsCount || 0;
        const totalCoveredCapacity = Math.max(
          packageSize,
          purchasedSessions > 0 ? Math.ceil(purchasedSessions / packageSize) * packageSize : packageSize
        );

        // Package completion notification is strictly triggered when:
        // Completed/consumed sessions >= Package Session Count (or total covered capacity if multiple packages were renewed/paid)
        // Outstanding balance MUST NOT trigger this notification!
        if (completedSessions >= totalCoveredCapacity) {
          const displayCount = packageSize;
          reminders.push({
            id: `rem_pkg_fin_${enr.enrollmentId}`,
            type: 'finished_package',
            priority: 'high',
            title: `انتهت الباقة: ${student.name}`,
            description: `انتهت الباقة — تم إكمال ${displayCount} من ${displayCount} حصص. حان وقت تجديد الباقة.`,
            badge: `باقة مكتملة (${displayCount}/${displayCount})`,
            studentId: student.id,
            studentName: student.name,
            studentPhone: student.phone,
            parentPhone: student.parentPhone,
            parentRelation: student.parentRelation,
            groupId: enr.groupId,
            groupName: enr.groupType === 'private' ? `درس خاص - ${student.name}` : enr.groupName,
            actionType: 'add_payment',
          });
        }
      } else if (isPrepaid) {
        // Prepaid: Attended prepaid sessions are automatically paid; notify when available credits are exhausted
        if (enr.sessionCredit <= 0 && enr.attendedSessionsCount > 0) {
          reminders.push({
            id: `rem_prepaid_fin_${enr.enrollmentId}`,
            type: 'low_credit',
            priority: 'medium',
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

    // 3. Repeated Absences check (2 or more consecutive absences)
    const stuAtt = db.getStudentAttendance(student.id);
    if (stuAtt.length >= 2) {
      const lastTwo = stuAtt.slice(0, 2);
      const isConsecutiveAbsent = lastTwo.every(
        (a) => a.status === 'absent' || a.status === 'absent_charged' || a.status === 'absent_free'
      );
      if (isConsecutiveAbsent) {
        reminders.push({
          id: `rem_rep_abs_${student.id}`,
          type: 'repeated_absence',
          priority: 'medium',
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

  // Sort reminders: High priority first
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  reminders.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return reminders;
}
