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

    // Overdue balance reminder
    if (grandFin.grandRemaining > 0) {
      reminders.push({
        id: `rem_overdue_${student.id}`,
        type: 'payment_overdue',
        priority: grandFin.grandRemaining > 500 ? 'high' : 'medium',
        title: `مستحقات سداد: ${student.name}`,
        description: `متبقي على الطالب ${grandFin.grandRemaining} ج.م لم تُسدد`,
        badge: `${grandFin.grandRemaining} ج.م مستحقة`,
        studentId: student.id,
        studentName: student.name,
        studentPhone: student.phone,
        parentPhone: student.parentPhone,
        parentRelation: student.parentRelation,
        amount: grandFin.grandRemaining,
        actionType: 'add_payment',
      });
    }

    // Check package and prepaid session credits
    for (const enr of grandFin.enrollmentsSummary) {
      const isPkg = enr.billingMode === 'package' || enr.billingType === 'package';
      const isPrepaid = enr.billingMode === 'prepaid' || enr.billingType === 'prepaid';

      if (isPkg || isPrepaid) {
        if (enr.sessionCredit <= 0) {
          reminders.push({
            id: `rem_pkg_fin_${enr.enrollmentId}`,
            type: 'finished_package',
            priority: 'high',
            title: `باقة منتهية: ${student.name}`,
            description: `نفد رصيد الحصص في (${enr.groupName}) - الرصيد الحالي ${enr.sessionCredit} حصة`,
            badge: 'باقة منتهية',
            studentId: student.id,
            studentName: student.name,
            groupId: enr.groupId,
            groupName: enr.groupName,
            remainingCredits: enr.sessionCredit,
            actionType: 'add_payment',
          });
        } else if (enr.sessionCredit <= 2) {
          reminders.push({
            id: `rem_low_crd_${enr.enrollmentId}`,
            type: 'low_credit',
            priority: 'medium',
            title: `رصيد حصص منخفض: ${student.name}`,
            description: `متبقي ${enr.sessionCredit} حصص فقط في (${enr.groupName}) - يرجى التجديد قريباً`,
            badge: `${enr.sessionCredit} حصص متبقية`,
            studentId: student.id,
            studentName: student.name,
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
