import { Student, Group, Session, Payment, Enrollment, Attendance } from '../types';
import { db } from './storage';
import { getAppLanguage } from './i18n';
import { toLocalISODate } from './localDate';

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
  allAttendance: Attendance[],
  lang?: string
): QuickTip[] {
  const currentLang = lang || getAppLanguage();
  const isEn = currentLang.startsWith('en');

  const tips: QuickTip[] = [];
  const todayStr = toLocalISODate();
  const activeStudents = students.filter((s) => s.status !== 'archived');
  const currencyLabel = isEn ? 'EGP' : 'ج.م';

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
    const title = isEn
      ? `Follow up Outstanding Balances (${overdueStudents.length} students)`
      : `متابعة تحصيل المتأخرات (${overdueStudents.length} طلاب)`;
    const description = isEn
      ? `There is a total of ${totalDue.toLocaleString()} ${currencyLabel} overdue balance. Send reminders to parents to settle statements.`
      : `يوجد إجمالي ${totalDue.toLocaleString()} ج.م متأخرات مستحقة. يفضل إرسال تذكيرات سداد لأولياء الأمور لتسوية الحسابات.`;
    const actionLabel = isEn ? 'Record Payment' : 'تسجيل دفعة';
    const badge = isEn ? 'Financial Due' : 'متابعة مالية';

    tips.push({
      id: 'tip_overdue_followup',
      category: 'follow_up',
      title,
      description,
      actionLabel,
      actionType: 'open_add_payment',
      priority: 'high',
      badge,
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
    const title = isEn
      ? `Package Renewals Required (${expiringPackages.length} students)`
      : `تجديد اشتراكات الباقات (${expiringPackages.length} طلاب)`;
    const description = isEn
      ? 'These students have completed all lessons in their current package. Contact them to renew before next session.'
      : 'استهلك هؤلاء الطلاب كامل حصص باقاتهم الحالية. تواصل معهم لتجديد الباقة قبل الحصة القادمة.';
    const actionLabel = isEn ? 'View Students' : 'عرض الطلاب';
    const badge = isEn ? 'Package Renewal' : 'تجديد باقة';

    tips.push({
      id: 'tip_package_renewals',
      category: 'follow_up',
      title,
      description,
      actionLabel,
      actionType: 'navigate_students',
      priority: 'high',
      badge,
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
    const title = isEn
      ? `Unmarked Past Lessons (${unrecordedPastSessions.length} lessons)`
      : `سجلات حضور غير مكتملة (${unrecordedPastSessions.length} حصة)`;
    const description = isEn
      ? 'Previous lessons have unrecorded attendance logs, affecting accurate balance deduction and reporting.'
      : 'توجد حصص سابقة لم يتم تسجيل كشف حضور طلابها، مما يؤثر على دقة الأرصدة والتقارير.';
    const actionLabel = isEn ? 'Review Timetable' : 'مراجعة الحصص';
    const badge = isEn ? 'Admin Task' : 'تنظيم إداري';

    tips.push({
      id: 'tip_unrecorded_sessions',
      category: 'admin',
      title,
      description,
      actionLabel,
      actionType: 'open_add_session',
      priority: 'medium',
      badge,
    });
  }

  // 4. Groups with 0 Students
  const emptyGroups = groups.filter((g) => {
    if (g.type === 'private') return false;
    const count = enrollments.filter((e) => e.groupId === g.id && e.status !== 'stopped').length;
    return count === 0;
  });

  if (emptyGroups.length > 0) {
    const title = isEn
      ? `Groups with No Students (${emptyGroups.length})`
      : `مجموعات بدون طلاب (${emptyGroups.length})`;
    const description = isEn
      ? `Group "${emptyGroups[0].name}" currently has 0 students. You can enroll students now or adjust the schedule.`
      : `المجموعة "${emptyGroups[0].name}" لا تحتوي على أي طلاب حالياً. يمكنك تسكين طلاب جدد فيها أو تعديلها.`;
    const actionLabel = isEn ? 'Add Students' : 'إضافة طلاب';
    const badge = isEn ? 'Class Management' : 'تنظيم الصفوف';

    tips.push({
      id: 'tip_empty_groups',
      category: 'admin',
      title,
      description,
      actionLabel,
      actionType: 'navigate_groups',
      priority: 'info',
      badge,
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
    const title = isEn
      ? `Celebrate Outstanding Attendance (${starStudents.length} students)`
      : `تقدير الطلاب المتميزين بالحضور (${starStudents.length} طلاب)`;
    const description = isEn
      ? `Students like "${starStudents[0].name}" have a perfect attendance track record. Encourage them to keep up the great work!`
      : `الطلاب مثل "${starStudents[0].name}" لديهم سجل حضور مثالي بدون أي غياب. شجعهم لمواصلة التفوق!`;
    const actionLabel = isEn ? 'Student Dossier' : 'ملف الطالب';
    const badge = isEn ? 'Excellence & Merit' : 'تشجيع وتميز';

    tips.push({
      id: 'tip_star_attendance',
      category: 'achievement',
      title,
      description,
      actionLabel,
      actionType: 'open_student',
      targetStudentId: starStudents[0].id,
      priority: 'info',
      badge,
    });
  }

  // 6. Positive Baseline Tip if all is smooth
  if (tips.length === 0) {
    const title = isEn ? 'All classes and accounts are up to date!' : 'جميع العمليات منتظمة وفي أفضل حال!';
    const description = isEn
      ? 'No overdue balances or pending attendance logs. Great time to prepare upcoming lesson plans.'
      : 'لا توجد متأخرات أو سجلات معلقة. يمكنك الاستفادة من الوقت الحالي في تحضير خطة الدروس القادمة.';
    const actionLabel = isEn ? 'Schedule Lesson' : 'جدولة حصة';
    const badge = isEn ? 'Good Standing' : 'يوم موفق';

    tips.push({
      id: 'tip_all_smooth',
      category: 'achievement',
      title,
      description,
      actionLabel,
      actionType: 'open_add_session',
      priority: 'info',
      badge,
    });
  }

  return tips;
}
