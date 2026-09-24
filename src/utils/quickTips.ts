import { Student, Group, Session, Payment, Enrollment, Attendance } from '../types';
import { db } from './storage';

export interface QuickTip {
  id: string;
  category: 'follow_up' | 'admin' | 'achievement' | 'scheduling';
  title: string;
  description: string;
  actionLabel?: string;
  actionType: 'open_add_payment' | 'open_add_session' | 'open_add_student' | 'navigate_students' | 'navigate_groups' | 'navigate_reports' | 'open_student' | 'open_group';
  targetStudentId?: string;
  targetGroupId?: string;
  priority: 'high' | 'medium' | 'info';
  badge: string;
}

export function generateQuickTips(
  students: Student[],
  groups: Group[],
  sessions: Session[],
  payments: Payment[],
  enrollments: Enrollment[],
  allAttendance: Attendance[]
): QuickTip[] {
  const tips: QuickTip[] = [];
  const todayStr = new Date().toISOString().split('T')[0];
  const activeStudents = students.filter((s) => s.status !== 'archived');

  // 1. Check for Overdue Dues Follow-ups
  const overdueStudents: { student: Student; remaining: number }[] = [];
  activeStudents.forEach((st) => {
    const fin = db.calculateStudentGrandFinancials(st.id);
    const nonPkgDue = fin.enrollmentsSummary
      .filter((e) => e.billingMode !== 'package' && e.billingType !== 'package')
      .reduce((sum, e) => sum + e.remaining, 0);

    if (nonPkgDue > 0) {
      overdueStudents.push({ student: st, remaining: nonPkgDue });
    }
  });

  if (overdueStudents.length > 0) {
    const totalDue = overdueStudents.reduce((sum, o) => sum + o.remaining, 0);
    tips.push({
      id: 'tip_overdue_followup',
      category: 'follow_up',
      title: `متابعة تحصيل المتأخرات (${overdueStudents.length} طلاب)`,
      description: `يوجد إجمالي ${totalDue.toLocaleString()} ج.م متأخرات مستحقة. يفضل إرسال تذكيرات سداد لأولياء الأمور لتسوية الحسابات.`,
      actionLabel: 'تسجيل دفعة',
      actionType: 'open_add_payment',
      priority: 'high',
      badge: 'متابعة مالية',
    });
  }

  // 2. Check for Low Package Credits / Completed Packages
  const expiringPackages: Student[] = [];
  activeStudents.forEach((st) => {
    const fin = db.calculateStudentGrandFinancials(st.id);
    const hasCompleted = fin.enrollmentsSummary.some((e) => {
      const isPkg = e.billingMode === 'package' || e.billingType === 'package';
      if (isPkg) {
        const pkgCount = Math.max(1, e.packageSessionsCount || 8);
        const purchased = e.purchasedSessionsCount || 0;
        const totalCovered = Math.max(pkgCount, purchased > 0 ? Math.ceil(purchased / pkgCount) * pkgCount : pkgCount);
        return (e.attendedSessionsCount || 0) >= totalCovered;
      }
      return false;
    });
    if (hasCompleted) {
      expiringPackages.push(st);
    }
  });

  if (expiringPackages.length > 0) {
    tips.push({
      id: 'tip_package_renewals',
      category: 'follow_up',
      title: `تجديد اشتراكات الباقات (${expiringPackages.length} طلاب)`,
      description: `استهلك هؤلاء الطلاب كامل حصص باقاتهم الحالية. تواصل معهم لتجديد الباقة قبل الحصة القادمة.`,
      actionLabel: 'عرض الطلاب',
      actionType: 'navigate_students',
      priority: 'high',
      badge: 'تجديد باقة',
    });
  }

  // 3. Unrecorded Past Sessions Check
  const unrecordedPastSessions = sessions.filter((s) => {
    if (s.status === 'cancelled') return false;
    if (s.date < todayStr) {
      const att = allAttendance.filter((a) => a.sessionId === s.id);
      return att.length === 0;
    }
    return false;
  });

  if (unrecordedPastSessions.length > 0) {
    tips.push({
      id: 'tip_unrecorded_sessions',
      category: 'admin',
      title: `سجلات حضور غير مكتملة (${unrecordedPastSessions.length} حصة)`,
      description: `توجد حصص سابقة لم يتم تسجيل كشف حضور طلابها، مما يؤثر على دقة الأرصدة والتقارير.`,
      actionLabel: 'مراجعة الحصص',
      actionType: 'open_add_session',
      priority: 'medium',
      badge: 'تنظيم إداري',
    });
  }

  // 4. Groups with 0 Students
  const emptyGroups = groups.filter((g) => {
    if (g.type === 'private') return false;
    const count = enrollments.filter((e) => e.groupId === g.id && e.status !== 'stopped').length;
    return count === 0;
  });

  if (emptyGroups.length > 0) {
    tips.push({
      id: 'tip_empty_groups',
      category: 'admin',
      title: `مجموعات بدون طلاب (${emptyGroups.length})`,
      description: `المجموعة "${emptyGroups[0].name}" لا تحتوي على أي طلاب حالياً. يمكنك تسكين طلاب جدد فيها أو تعديلها.`,
      actionLabel: 'إضافة طلاب',
      actionType: 'navigate_groups',
      priority: 'info',
      badge: 'تنظيم الصفوف',
    });
  }

  // 5. Check for students with 100% attendance (Achievement Tip)
  const starStudents: Student[] = [];
  activeStudents.forEach((st) => {
    const stAtt = allAttendance.filter((a) => a.studentId === st.id);
    if (stAtt.length >= 4) {
      const absences = stAtt.filter((a) => a.status === 'absent' || a.status === 'absent_charged').length;
      if (absences === 0) {
        starStudents.push(st);
      }
    }
  });

  if (starStudents.length > 0) {
    tips.push({
      id: 'tip_star_attendance',
      category: 'achievement',
      title: `تقدير الطلاب المتميزين بالحضور (${starStudents.length} طلاب)`,
      description: `الطلاب مثل "${starStudents[0].name}" لديهم سجل حضور مثالي بدون أي غياب. شجعهم لمواصلة التفوق!`,
      actionLabel: 'ملف الطالب',
      actionType: 'open_student',
      targetStudentId: starStudents[0].id,
      priority: 'info',
      badge: 'تشجيع وتميز',
    });
  }

  // 6. Positive Baseline Tip if all is smooth
  if (tips.length === 0) {
    tips.push({
      id: 'tip_all_smooth',
      category: 'achievement',
      title: 'جميع العمليات منتظمة وفي أفضل حال!',
      description: 'لا توجد متأخرات أو سجلات معلقة. يمكنك الاستفادة من الوقت الحالي في تحضير خطة الدروس القادمة.',
      actionLabel: 'جدولة حصة',
      actionType: 'open_add_session',
      priority: 'info',
      badge: 'يوم موفق',
    });
  }

  return tips;
}
