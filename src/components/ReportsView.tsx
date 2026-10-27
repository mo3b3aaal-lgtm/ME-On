import React, { Suspense, lazy, useState, useMemo, useEffect, useDeferredValue } from 'react';
import { Student, Group, Session, Payment, ReportPeriodFilter, Enrollment, Attendance, ActiveTab } from '../types';
import { db, roundMoney, getArabicMonthName, getSessionLessonQuantity } from '../utils/storage';
import { getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';
import { toLocalISODate } from '../utils/localDate';
import { useCurrentLocalDate } from '../utils/useCurrentLocalDate';
import { StudentAvatar } from './StudentAvatar';
import { AppIcon } from './ui/AppIcon';
import { SegmentedControl } from './ui/SegmentedControl';
import { ScreenHeader } from './ui/ScreenHeader';
import { SectionHeader } from './ui/SectionHeader';
import { NavyCard } from './ui/NavyCard';
import { MintCard } from './ui/MintCard';
import { WhiteCard } from './ui/WhiteCard';
import { ProgressRing, useCountUp } from './ui/ProgressRing';
import { DelayedFallback, useDelayedLoading } from './ui/Skeleton';
import { ReportChartSkeleton, ReportsContentSkeleton } from './skeletons/ClassySkeletons';
import { EmptyBox } from './illustrations/EmptyBox';

const loadAttendanceTrendsChart = () => import('./AttendanceTrendsChart');
const loadBillingStreamsProgressChart = () => import('./BillingStreamsProgressChart');

const AttendanceTrendsChart = lazy(() =>
  loadAttendanceTrendsChart().then((m) => ({ default: m.AttendanceTrendsChart }))
);
const BillingStreamsProgressChart = lazy(() =>
  loadBillingStreamsProgressChart().then((m) => ({ default: m.BillingStreamsProgressChart }))
);

const AnimatedCountValue: React.FC<{ value: number; duration?: number }> = React.memo(
  ({ value, duration = 600 }) => {
    const animated = useCountUp(value, duration);
    return <>{animated}</>;
  }
);

interface ReportsViewProps {
  students: Student[];
  groups: Group[];
  sessions: Session[];
  payments: Payment[];
  enrollments?: Enrollment[];
  allAttendance?: Attendance[];
  isLoading?: boolean;
  onOpenAddPayment?: (student?: Student, enrollmentId?: string) => void;
  onOpenStudentProfile?: (student: Student) => void;
  onNavigateToTab?: (tab: ActiveTab) => void;
  onOpenNotificationsModal?: () => void;
  unreadNotificationsCount?: number;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  students,
  groups,
  sessions,
  payments,
  enrollments,
  allAttendance,
  isLoading = false,
  onOpenAddPayment,
  onOpenStudentProfile,
  onNavigateToTab,
  onOpenNotificationsModal,
  unreadNotificationsCount,
}) => {
  const { t, language, isRTL } = useTranslation();
  const isEn = language.startsWith('en');
  const rawReportsLoading =
    Boolean(isLoading) &&
    students.length === 0 &&
    groups.length === 0 &&
    sessions.length === 0 &&
    payments.length === 0;
  const showReportsSkeleton = useDelayedLoading(rawReportsLoading, 90);

  // Pre-warm lazy chart chunks during idle time once ReportsView mounts
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const win = window as any;
      const warm = () => {
        Promise.all([loadBillingStreamsProgressChart(), loadAttendanceTrendsChart()]).catch(() => {});
      };
      if (typeof win.requestIdleCallback === 'function') {
        win.requestIdleCallback(warm, { timeout: 400 });
      } else {
        warm();
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, []);

  const { now: today, todayStr } = useCurrentLocalDate();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  // Main Navigation Tabs
  const [reportType, setReportType] = useState<
    'teacher_overview' | 'overdue_list' | 'group_report' | 'student_report'
  >('teacher_overview');

  // Filter Period
  const [periodFilter, setPeriodFilter] = useState<ReportPeriodFilter>('this_month');
  const [selectedSpecificMonth, setSelectedSpecificMonth] = useState<number>(currentMonth);
  const [selectedSpecificYear, setSelectedSpecificYear] = useState<number>(currentYear);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Financial & Attendance Sub-Tabs
  const [financialSubTab, setFinancialSubTab] = useState<
    'overview' | 'billing_streams' | 'attendance_trends' | 'monthly_ledger' | 'yearly_summary' | 'lifetime' | 'payments'
  >('overview');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<'all' | 'group' | 'private'>('all');

  // Selected Student / Group for dedicated reports
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [overdueSearchQuery, setOverdueSearchQuery] = useState('');
  const deferredPaymentSearchQuery = useDeferredValue(paymentSearchQuery);
  const deferredOverdueSearchQuery = useDeferredValue(overdueSearchQuery);
  const [methodFilter] = useState<string>('all');

  const studentsById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const groupsById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const paymentsByStudentId = useMemo(() => {
    const map = new Map<string, Payment[]>();
    payments.forEach((p) => {
      const list = map.get(p.studentId);
      if (list) list.push(p);
      else map.set(p.studentId, [p]);
    });
    return map;
  }, [payments]);

  const activeEnrollments = useMemo(() => enrollments ?? db.getEnrollments(), [enrollments]);
  const allAttendanceRecords = useMemo(
    () => allAttendance ?? db.getAttendance(),
    [allAttendance, sessions]
  );

  // 1. Overall Teacher Calculations from db
  const teacherSummary = useMemo(() => {
    return db.calculateTeacherFinancialOverview(periodFilter);
  }, [periodFilter, students, groups, activeEnrollments, sessions, allAttendanceRecords, payments]);

  // Full Financial History Engine
  const financialHistory = useMemo(() => {
    return teacherSummary.financialHistory || db.calculateFinancialHistory();
  }, [teacherSummary, payments, sessions, allAttendanceRecords, activeEnrollments, groups, students]);

  // Attendance & Sessions Analytics for current period
  const attendanceAnalytics = useMemo(() => {
    const allAtt = allAttendanceRecords;
    const d7 = new Date();
    d7.setDate(d7.getDate() - 7);
    const d7Str = toLocalISODate(d7);

    const periodSessions = sessions.filter((s) => {
      if (periodFilter === 'all_time') return true;
      if (periodFilter === 'today') return s.date === todayStr;
      if (periodFilter === 'last_7_days') return s.date >= d7Str && s.date <= todayStr;
      if (periodFilter === 'this_month') return s.month === currentMonth && s.year === currentYear;
      if (periodFilter === 'last_month') {
        const lastM = currentMonth === 1 ? 12 : currentMonth - 1;
        const lastY = currentMonth === 1 ? currentYear - 1 : currentYear;
        return s.month === lastM && s.year === lastY;
      }
      if (periodFilter === 'specific_month') {
        return s.month === selectedSpecificMonth && s.year === selectedSpecificYear;
      }
      if (periodFilter === 'custom_range' && customStartDate && customEndDate) {
        return s.date >= customStartDate && s.date <= customEndDate;
      }
      return true;
    });

    const periodSessionIds = new Set(periodSessions.map((s) => s.id));
    const relevantAtt = allAtt.filter((a) => periodSessionIds.has(a.sessionId));

    const completedSessions = periodSessions.filter((s) => s.status === 'completed');
    const scheduledSessions = periodSessions.filter((s) => s.status === 'scheduled');
    const cancelledSessions = periodSessions.filter((s) => s.status === 'cancelled');

    const groupSessions = periodSessions.filter((s) => !s.studentId);
    const privateSessions = periodSessions.filter((s) => !!s.studentId);

    // Helper: For Session-based Private Lessons, return sessionUnits; for Hourly or Group, return 1
    const getSessionUnitFactor = (s?: Session, att?: Attendance | null): number => {
      if (!s) return 1;
      const grp = s.groupId ? groupsById.get(s.groupId) : undefined;
      const isPrivate = !!s.studentId || grp?.type === 'private' || (s.groupId && s.groupId.startsWith('private_'));
      if (!isPrivate) return 1;

      const enr = activeEnrollments.find(
        (e) =>
          e.id === s.enrollmentId ||
          (att?.enrollmentId && e.id === att.enrollmentId) ||
          (s.studentId && e.studentId === s.studentId && e.groupId === s.groupId)
      );
      const isHourly =
        s.isHourly === true ||
        s.billingMode === 'hourly' ||
        enr?.billingMode === 'hourly' ||
        enr?.billingType === 'hourly' ||
        grp?.billingMode === 'hourly' ||
        grp?.billingType === 'hourly' ||
        (s.hours !== undefined && Number(s.hours) > 0 && !s.sessionUnits && !att?.sessionUnits);

      if (isHourly) return 1;
      return getSessionLessonQuantity(s, att);
    };

    const firstAttBySessionId = new Map<string, Attendance>();
    relevantAtt.forEach((a) => {
      if (!firstAttBySessionId.has(a.sessionId)) {
        firstAttBySessionId.set(a.sessionId, a);
      }
    });

    const completedLessonsCount = roundMoney(
      completedSessions.reduce((sum, s) => {
        const sAtt = firstAttBySessionId.get(s.id);
        return sum + getSessionUnitFactor(s, sAtt);
      }, 0),
      2
    );

    const sessionMap = new Map<string, Session>();
    periodSessions.forEach((s) => sessionMap.set(s.id, s));

    const presentCount = roundMoney(
      relevantAtt
        .filter((a) => a.status === 'present')
        .reduce((sum, a) => sum + getSessionUnitFactor(sessionMap.get(a.sessionId), a), 0),
      2
    );
    const lateCount = roundMoney(
      relevantAtt
        .filter((a) => a.status === 'late')
        .reduce((sum, a) => sum + getSessionUnitFactor(sessionMap.get(a.sessionId), a), 0),
      2
    );
    const absentChargedCount = roundMoney(
      relevantAtt
        .filter((a) => a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false))
        .reduce((sum, a) => sum + getSessionUnitFactor(sessionMap.get(a.sessionId), a), 0),
      2
    );
    const absentExcusedCount = roundMoney(
      relevantAtt
        .filter((a) => a.status === 'absent_free' || a.status === 'excused' || a.isCharged === false)
        .reduce((sum, a) => sum + getSessionUnitFactor(sessionMap.get(a.sessionId), a), 0),
      2
    );

    const totalAttCount = roundMoney(presentCount + lateCount + absentChargedCount + absentExcusedCount, 2);
    const commitmentRate =
      totalAttCount > 0 ? Math.round(((presentCount + lateCount) / totalAttCount) * 100) : 100;

    return {
      totalSessions: periodSessions.length,
      completedAppointmentsCount: completedSessions.length,
      completedLessonsCount,
      completedSessionsCount: completedLessonsCount,
      scheduledSessionsCount: scheduledSessions.length,
      cancelledSessionsCount: cancelledSessions.length,
      groupSessionsCount: groupSessions.length,
      privateSessionsCount: privateSessions.length,
      presentCount,
      lateCount,
      absentChargedCount,
      absentExcusedCount,
      totalAttCount,
      commitmentRate,
    };
  }, [
    sessions,
    allAttendanceRecords,
    groupsById,
    activeEnrollments,
    periodFilter,
    todayStr,
    currentMonth,
    currentYear,
    selectedSpecificMonth,
    selectedSpecificYear,
    customStartDate,
    customEndDate,
  ]);

  // Filter payments by period
  const filteredPayments = useMemo(() => {
    const d7 = new Date();
    d7.setDate(d7.getDate() - 7);
    const d7Str = toLocalISODate(d7);

    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const q = deferredPaymentSearchQuery.trim().toLowerCase();

    return payments.filter((p) => {
      // Search query
      if (q) {
        const student = studentsById.get(p.studentId);
        const studentMatches = student?.name.toLowerCase().includes(q);
        const notesMatches = p.notes?.toLowerCase().includes(q);
        if (!studentMatches && !notesMatches) return false;
      }

      // Method filter
      if (methodFilter !== 'all') {
        if (p.paymentMethod !== methodFilter) return false;
      }

      // Period filter
      if (periodFilter === 'all_time') return true;
      if (periodFilter === 'today') return p.date === todayStr;
      if (periodFilter === 'last_7_days') return p.date >= d7Str && p.date <= todayStr;
      if (periodFilter === 'this_month') return p.month === currentMonth && p.year === currentYear;
      if (periodFilter === 'last_month') return p.month === lastMonth && p.year === lastMonthYear;
      if (periodFilter === 'specific_month')
        return p.month === selectedSpecificMonth && p.year === selectedSpecificYear;
      if (periodFilter === 'custom_range' && customStartDate && customEndDate) {
        return p.date >= customStartDate && p.date <= customEndDate;
      }
      return true;
    });
  }, [
    payments,
    deferredPaymentSearchQuery,
    studentsById,
    methodFilter,
    periodFilter,
    todayStr,
    currentMonth,
    currentYear,
    selectedSpecificMonth,
    selectedSpecificYear,
    customStartDate,
    customEndDate,
  ]);

  const periodRevenue = useMemo(() => {
    if (periodFilter === 'all_time') {
      return financialHistory.totalCollected;
    }
    if (periodFilter === 'this_month') {
      const key = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      const mRec = financialHistory.months.find((m) => m.monthYear === key);
      return mRec
        ? mRec.totalCollected
        : filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    }
    if (periodFilter === 'last_month') {
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const key = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}`;
      const mRec = financialHistory.months.find((m) => m.monthYear === key);
      return mRec
        ? mRec.totalCollected
        : filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    }
    if (periodFilter === 'specific_month') {
      const key = `${selectedSpecificYear}-${String(selectedSpecificMonth).padStart(2, '0')}`;
      const mRec = financialHistory.months.find((m) => m.monthYear === key);
      return mRec
        ? mRec.totalCollected
        : filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    }

    return filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [
    filteredPayments,
    periodFilter,
    financialHistory,
    currentMonth,
    currentYear,
    selectedSpecificMonth,
    selectedSpecificYear,
  ]);

  // Payment Methods Breakdown
  const methodStats = useMemo(() => {
    const stats = {
      cash: { label: isEn ? 'Cash' : 'كاش (نقداً)', amount: 0, count: 0 },
      vodafone_cash: { label: isEn ? 'Vodafone Cash' : 'فودافون كاش', amount: 0, count: 0 },
      instapay: { label: isEn ? 'InstaPay' : 'إنستاباي (InstaPay)', amount: 0, count: 0 },
      bank_transfer: { label: isEn ? 'Bank Transfer' : 'تحويل بنكي', amount: 0, count: 0 },
      other: { label: isEn ? 'Other' : 'أخرى', amount: 0, count: 0 },
    };

    filteredPayments.forEach((p) => {
      const amt = Number(p.amount) || 0;
      const m = (p.paymentMethod || 'cash') as keyof typeof stats;
      if (stats[m]) {
        stats[m].amount += amt;
        stats[m].count++;
      } else {
        stats.other.amount += amt;
        stats.other.count++;
      }
    });

    return stats;
  }, [filteredPayments, isEn]);

  // Overdue Students List
  const overdueStudentsList = useMemo(() => {
    const activeStudents = students.filter((s) => s.status !== 'archived');
    const q = deferredOverdueSearchQuery.trim().toLowerCase();
    const list: {
      student: Student;
      grandTotalDue: number;
      grandTotalPaid: number;
      grandRemaining: number;
      lastPayment?: Payment;
      enrollmentsSummary: any[];
    }[] = [];

    activeStudents.forEach((st) => {
      const fin = db.calculateStudentGrandFinancials(st.id);
      if (fin.grandRemaining > 0) {
        if (q) {
          const matches =
            st.name.toLowerCase().includes(q) ||
            (st.phone && st.phone.includes(q)) ||
            (st.parentPhone && st.parentPhone.includes(q));
          if (!matches) return;
        }

        const studentPayments = paymentsByStudentId.get(st.id) || [];
        let lastPayment: Payment | undefined;
        for (let i = 0; i < studentPayments.length; i++) {
          const p = studentPayments[i];
          if (!lastPayment || p.date > lastPayment.date) {
            lastPayment = p;
          }
        }
        list.push({
          student: st,
          grandTotalDue: fin.grandTotalDue,
          grandTotalPaid: fin.grandTotalPaid,
          grandRemaining: fin.grandRemaining,
          lastPayment,
          enrollmentsSummary: fin.enrollmentsSummary,
        });
      }
    });

    list.sort((a, b) => b.grandRemaining - a.grandRemaining);
    return list;
  }, [
    students,
    groups,
    activeEnrollments,
    sessions,
    allAttendanceRecords,
    paymentsByStudentId,
    deferredOverdueSearchQuery,
  ]);

  // Selected Student Dossier
  const selectedStudentGrandFin = useMemo(() => {
    return selectedStudentId ? db.calculateStudentGrandFinancials(selectedStudentId) : null;
  }, [
    selectedStudentId,
    students,
    groups,
    activeEnrollments,
    sessions,
    allAttendanceRecords,
    payments,
  ]);

  const selectedStudentObj = useMemo(() => {
    return studentsById.get(selectedStudentId);
  }, [studentsById, selectedStudentId]);

  // Selected Group Dossier
  const selectedGroupFin = useMemo(() => {
    return selectedGroupId ? db.calculateGroupFinancials(selectedGroupId) : null;
  }, [
    selectedGroupId,
    groups,
    students,
    activeEnrollments,
    sessions,
    allAttendanceRecords,
    payments,
  ]);

  const selectedGroupObj = useMemo(() => {
    return groupsById.get(selectedGroupId);
  }, [groupsById, selectedGroupId]);

  const handlePrint = () => {
    window.print();
  };

  // Period Display Label for Header
  const currentPeriodLabel = useMemo(() => {
    if (periodFilter === 'all_time') return isEn ? 'All Time' : 'كافة الفترات';
    if (periodFilter === 'today') return isEn ? `Today (${todayStr})` : `اليوم (${todayStr})`;
    if (periodFilter === 'last_7_days') return isEn ? 'Last 7 Days' : 'آخر 7 أيام';
    if (periodFilter === 'this_month') return isEn ? `${getArabicMonthName(currentMonth)} ${currentYear}` : `شهر ${getArabicMonthName(currentMonth)} ${currentYear}`;
    if (periodFilter === 'last_month') {
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      return isEn ? `${getArabicMonthName(lastMonth)} ${lastYear}` : `شهر ${getArabicMonthName(lastMonth)} ${lastYear}`;
    }
    if (periodFilter === 'specific_month') {
      return isEn ? `${getArabicMonthName(selectedSpecificMonth)} ${selectedSpecificYear}` : `شهر ${getArabicMonthName(selectedSpecificMonth)} ${selectedSpecificYear}`;
    }
    if (periodFilter === 'custom_range') {
      return isEn ? `From ${customStartDate || '...'} to ${customEndDate || '...'}` : `من ${customStartDate || '...'} إلى ${customEndDate || '...'}`;
    }
    return t('thisMonth');
  }, [
    periodFilter,
    todayStr,
    currentMonth,
    currentYear,
    selectedSpecificMonth,
    selectedSpecificYear,
    customStartDate,
    customEndDate,
    isEn,
    t,
  ]);

  // ProgressRing collection rate value (guarded 0..100)
  const collectionRate = useMemo(() => {
    const due = Number(teacherSummary.totalDue ?? teacherSummary.totalDues) || 0;
    const collected = Number(periodRevenue) || 0;
    if (due > 0) {
      return Math.min(100, Math.max(0, Math.round((collected / due) * 100)));
    }
    if (attendanceAnalytics.totalSessions > 0) {
      return Math.min(
        100,
        Math.max(
          0,
          Math.round(
            (attendanceAnalytics.completedAppointmentsCount / attendanceAnalytics.totalSessions) * 100
          )
        )
      );
    }
    return 100;
  }, [teacherSummary, periodRevenue, attendanceAnalytics]);

  const periodOptions: { key: ReportPeriodFilter; label: string }[] = [
    { key: 'this_month', label: isEn ? 'This Month' : 'هذا الشهر' },
    { key: 'last_month', label: isEn ? 'Last Month' : 'الشهر الماضي' },
    { key: 'last_7_days', label: isEn ? 'Last 7 Days' : 'آخر 7 أيام' },
    { key: 'today', label: isEn ? 'Today' : 'اليوم' },
    { key: 'specific_month', label: isEn ? 'Specific Month' : 'شهر محدد' },
    { key: 'custom_range', label: isEn ? 'Custom Range' : 'فترة مخصصة' },
    { key: 'all_time', label: isEn ? 'All Time' : 'كل الوقت' },
  ];

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar px-5 py-4 space-y-4 text-navy pb-32 bg-page relative overscroll-contain"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* 1. Screen Header */}
      <ScreenHeader
        title={t('reportsTitle') || (isEn ? 'Reports' : 'التقارير')}
        unreadCount={unreadNotificationsCount}
        onOpenNotifications={onOpenNotificationsModal}
        onOpenSettings={onNavigateToTab ? () => onNavigateToTab('settings') : undefined}
      />

      {showReportsSkeleton ? (
        <ReportsContentSkeleton />
      ) : (
        <>
          {/* 2. Top Summary = NavyCard with main number (.t-display white) and ProgressRing for collection rate */}
          <NavyCard className="relative">
        <div className="flex items-center justify-between gap-4 relative z-10">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-page/80">
                {currentPeriodLabel}
              </span>
            </div>
            <div>
              <div className="t-meta text-page/80">
                {isEn ? 'Total revenue' : 'إجمالي التحصيل'}
              </div>
              <div className="t-display text-page mt-1">
                <AnimatedCountValue value={periodRevenue} />{' '}
                <span className="text-sm font-semibold text-page/80">{t('currency')}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-0.5">
              <span className="text-[12px] text-page/80">
                {isEn
                  ? `Due: ${teacherSummary.totalDue ?? teacherSummary.totalDues} ${t('currency')}`
                  : `المستحق: ${teacherSummary.totalDue ?? teacherSummary.totalDues} ${t('currency')}`}
              </span>
              <button
                type="button"
                onClick={handlePrint}
                className="ms-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-page/15 hover:bg-page/25 text-page text-xs font-semibold transition-colors cursor-pointer"
                title={isEn ? 'Print Statement' : 'طباعة التقرير'}
              >
                <AppIcon name="printer" size={14} />
                <span>{isEn ? 'Print' : 'طباعة'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 shrink-0">
            <ProgressRing
              value={collectionRate}
              size={80}
              stroke={9}
              variant="navy"
              className="text-page"
            />
            <span className="text-[11px] font-medium text-page/80 text-center">
              {isEn ? 'Collection rate' : 'نسبة التحصيل'}
            </span>
          </div>
        </div>
      </NavyCard>

      {/* 3. Main Navigation: SegmentedControl */}
      <SegmentedControl<'teacher_overview' | 'overdue_list' | 'group_report' | 'student_report'>
        value={reportType}
        onChange={(val) => setReportType(val)}
        options={[
          { value: 'teacher_overview', label: isEn ? 'Overview' : 'شامل' },
          { value: 'overdue_list', label: isEn ? 'Dues' : 'المستحقات' },
          { value: 'group_report', label: isEn ? 'Groups' : 'المجموعات' },
          { value: 'student_report', label: isEn ? 'Students' : 'الطلاب' },
        ]}
      />

      {/* 4. Period Selector = chips; horizontally scrollable */}
      {reportType !== 'overdue_list' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar -mx-5 px-5">
            {periodOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPeriodFilter(opt.key)}
                className={`chip shrink-0 ${periodFilter === opt.key ? 'chip-active' : ''}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Specific Month Selectors */}
          {periodFilter === 'specific_month' && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <select
                value={selectedSpecificMonth}
                onChange={(e) => setSelectedSpecificMonth(Number(e.target.value))}
                className="bg-page border border-line text-navy rounded-full px-4 py-2 text-xs font-semibold focus:outline-none focus:border-navy cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {getArabicMonthName(m)}
                  </option>
                ))}
              </select>
              <select
                value={selectedSpecificYear}
                onChange={(e) => setSelectedSpecificYear(Number(e.target.value))}
                className="bg-page border border-line text-navy rounded-full px-4 py-2 text-xs font-semibold focus:outline-none focus:border-navy cursor-pointer"
              >
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Date Inputs */}
          {periodFilter === 'custom_range' && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <span className="t-caption text-slate block mb-1 ms-1">
                  {isEn ? 'From date' : 'من تاريخ'}
                </span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full bg-page border border-line text-navy rounded-full px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-navy"
                />
              </div>
              <div>
                <span className="t-caption text-slate block mb-1 ms-1">
                  {isEn ? 'To date' : 'إلى تاريخ'}
                </span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full bg-page border border-line text-navy rounded-full px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-navy"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 1: EXECUTIVE FINANCIAL OVERVIEW
          ========================================================================= */}
      {reportType === 'teacher_overview' && (
        <div className="space-y-4">
          {/* Sub-Tabs: horizontally scrollable chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar -mx-5 px-5">
            {[
              { key: 'overview', label: isEn ? 'Overview' : 'نظرة عامة' },
              { key: 'billing_streams', label: isEn ? 'Billing Streams' : 'مسارات المحاسبة' },
              { key: 'attendance_trends', label: isEn ? 'Attendance Trends' : 'منحنيات الحضور' },
              {
                key: 'monthly_ledger',
                label: isEn
                  ? `Monthly (${financialHistory.months.length})`
                  : `السجل الشهري (${financialHistory.months.length})`,
              },
              {
                key: 'yearly_summary',
                label: isEn
                  ? `Annual (${financialHistory.years.length})`
                  : `السجل السنوي (${financialHistory.years.length})`,
              },
              {
                key: 'payments',
                label: isEn
                  ? `Receipts (${filteredPayments.length})`
                  : `المقبوضات (${filteredPayments.length})`,
              },
              { key: 'lifetime', label: isEn ? 'Lifetime' : 'شامل الفترات' },
            ].map((sub) => (
              <button
                key={sub.key}
                type="button"
                onClick={() => setFinancialSubTab(sub.key as any)}
                className={`chip shrink-0 ${financialSubTab === sub.key ? 'chip-active' : ''}`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {/* Service Filter (All | Groups | Private) */}
          <SegmentedControl<'all' | 'group' | 'private'>
            value={serviceTypeFilter}
            onChange={(val) => setServiceTypeFilter(val)}
            options={[
              { value: 'all', label: t('all') },
              { value: 'group', label: isEn ? 'Groups' : 'مجموعات' },
              { value: 'private', label: isEn ? 'Private' : 'خاص' },
            ]}
          />

          {/* Sub-Tab 1: Overview Dashboard */}
          {financialSubTab === 'overview' && (
            <div className="space-y-4">
              {/* KPI Cards: 2-column grid of MintCards (label .t-meta, value 22px/700 navy, optional AppIcon in white circle) */}
              <div className="grid grid-cols-2 gap-4">
                <MintCard className="flex flex-col justify-between min-h-[104px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="t-meta text-slate truncate">
                      {isEn ? 'Total Expected' : 'إجمالي المستحق'}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-page flex items-center justify-center text-navy shrink-0 shadow-2xs">
                      <AppIcon name="trendUp" weight="duotone" size={16} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[22px] font-bold text-navy truncate mt-1">
                      {teacherSummary.totalDue ?? teacherSummary.totalDues}{' '}
                      <span className="text-xs font-semibold text-slate">{t('currency')}</span>
                    </div>
                    <span className="t-caption text-slate block mt-0.5 truncate">
                      {attendanceAnalytics.completedAppointmentsCount} {isEn ? 'Appts' : 'موعد'}
                    </span>
                  </div>
                </MintCard>

                <MintCard className="flex flex-col justify-between min-h-[104px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="t-meta text-slate truncate">
                      {isEn ? 'Completed Lessons' : 'الحصص المنفذة'}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-page flex items-center justify-center text-navy shrink-0 shadow-2xs">
                      <AppIcon name="checkAll" weight="duotone" size={16} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[22px] font-bold text-navy truncate mt-1">
                      {attendanceAnalytics.completedSessionsCount}
                    </div>
                    <span className="t-caption text-slate block mt-0.5 truncate">
                      {attendanceAnalytics.commitmentRate}% {isEn ? 'Attendance' : 'نسبة الالتزام'}
                    </span>
                  </div>
                </MintCard>

                <MintCard className="flex flex-col justify-between min-h-[104px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="t-meta text-slate truncate">
                      {isEn ? 'Total Collected' : 'المحصل الفعلي'}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-page flex items-center justify-center text-navy shrink-0 shadow-2xs">
                      <AppIcon name="wallet" weight="duotone" size={16} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[22px] font-bold text-navy truncate mt-1">
                      {periodRevenue}{' '}
                      <span className="text-xs font-semibold text-slate">{t('currency')}</span>
                    </div>
                    <span className="t-caption text-slate block mt-0.5 truncate">
                      {filteredPayments.length} {isEn ? 'payments' : 'دفعات'}
                    </span>
                  </div>
                </MintCard>

                <MintCard className="flex flex-col justify-between min-h-[104px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="t-meta text-slate truncate">
                      {isEn ? 'Remaining Dues' : 'المستحقات المتبقية'}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-page flex items-center justify-center text-navy shrink-0 shadow-2xs">
                      <AppIcon name="warning" weight="duotone" size={16} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[22px] font-bold text-navy truncate mt-1">
                      {teacherSummary.totalRemaining}{' '}
                      <span className="text-xs font-semibold text-slate">{t('currency')}</span>
                    </div>
                    <span className="t-caption text-slate block mt-0.5 truncate">
                      {overdueStudentsList.length} {isEn ? 'students' : 'طلاب'}
                    </span>
                  </div>
                </MintCard>
              </div>

              {/* Payment Methods Breakdown */}
              <WhiteCard className="p-4 space-y-3">
                <SectionHeader
                  title={isEn ? 'Payment Methods' : 'طرق الدفع والتحصيل'}
                  subtitle={`${periodRevenue} ${t('currency')}`}
                />
                <div className="grid grid-cols-2 gap-3">
                  {(
                    Object.entries(methodStats) as [
                      string,
                      { label: string; amount: number; count: number }
                    ][]
                  )
                    .filter(([key, item]) => key !== 'other' || item.count > 0)
                    .map(([key, item]) => (
                      <MintCard
                        key={key}
                        variant="soft"
                        className="p-3.5 flex flex-col justify-between min-h-[82px]"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="t-meta text-slate truncate">{item.label}</span>
                          <span className="text-[11px] font-semibold text-navy bg-page px-2 py-0.5 rounded-full border border-line shrink-0">
                            {item.count} {isEn ? 'pmts' : 'دفعات'}
                          </span>
                        </div>
                        <div className="text-[18px] font-bold text-navy truncate mt-1">
                          {item.amount}{' '}
                          <span className="text-xs font-semibold text-slate">{t('currency')}</span>
                        </div>
                      </MintCard>
                    ))}
                </div>
              </WhiteCard>

              {/* Chart 1 Container = WhiteCard with 16px padding and SectionHeader */}
              <WhiteCard className="p-4 space-y-3">
                <SectionHeader
                  title={isEn ? 'Billing Streams' : 'مسارات المحاسبة'}
                  subtitle={isEn ? 'Lesson-based vs Hourly comparison' : 'مقارنة الحصص بالساعات'}
                />
                <Suspense
                  fallback={
                    <DelayedFallback delayMs={75}>
                      <ReportChartSkeleton compact />
                    </DelayedFallback>
                  }
                >
                  <BillingStreamsProgressChart
                    sessions={sessions}
                    allAttendance={allAttendanceRecords}
                    students={students}
                    groups={groups}
                    enrollments={activeEnrollments}
                    payments={payments}
                    periodFilter={periodFilter}
                    customStartDate={customStartDate}
                    customEndDate={customEndDate}
                    compact
                  />
                </Suspense>
              </WhiteCard>

              {/* Chart 2 Container = WhiteCard with 16px padding and SectionHeader */}
              <WhiteCard className="p-4 space-y-3">
                <SectionHeader
                  title={isEn ? 'Attendance Trends' : 'منحنيات الحضور'}
                  subtitle={isEn ? 'Student commitment over time' : 'معدل التزام الطلاب عبر الوقت'}
                />
                <Suspense
                  fallback={
                    <DelayedFallback delayMs={75}>
                      <ReportChartSkeleton compact />
                    </DelayedFallback>
                  }
                >
                  <AttendanceTrendsChart
                    sessions={sessions}
                    allAttendance={allAttendanceRecords}
                    students={students}
                    groups={groups}
                    periodFilter={periodFilter}
                    customStartDate={customStartDate}
                    customEndDate={customEndDate}
                    compact
                  />
                </Suspense>
              </WhiteCard>
            </div>
          )}

          {/* Sub-Tab 2: Dedicated Billing Streams Chart */}
          {financialSubTab === 'billing_streams' && (
            <WhiteCard className="p-4 space-y-3">
              <SectionHeader
                title={isEn ? 'Billing Streams' : 'مسارات المحاسبة'}
                subtitle={isEn ? 'Lesson-based vs Hourly performance' : 'تفاصيل مسارات الحصص والساعات'}
              />
              <Suspense
                fallback={
                  <DelayedFallback delayMs={75}>
                    <ReportChartSkeleton />
                  </DelayedFallback>
                }
              >
                <BillingStreamsProgressChart
                  sessions={sessions}
                  allAttendance={allAttendanceRecords}
                  students={students}
                  groups={groups}
                  enrollments={activeEnrollments}
                  payments={payments}
                  periodFilter={periodFilter}
                  customStartDate={customStartDate}
                  customEndDate={customEndDate}
                />
              </Suspense>
            </WhiteCard>
          )}

          {/* Sub-Tab 3: Dedicated Attendance Trends Chart */}
          {financialSubTab === 'attendance_trends' && (
            <div className="space-y-4">
              <WhiteCard className="p-4 space-y-3">
                <SectionHeader
                  title={isEn ? 'Attendance Trends' : 'منحنيات الحضور'}
                  subtitle={isEn ? 'Commitment trends across sessions' : 'منحنيات التزام الطلاب عبر الحصص'}
                />
                <Suspense
                  fallback={
                    <DelayedFallback delayMs={75}>
                      <ReportChartSkeleton />
                    </DelayedFallback>
                  }
                >
                  <AttendanceTrendsChart
                    sessions={sessions}
                    allAttendance={allAttendanceRecords}
                    students={students}
                    groups={groups}
                    periodFilter={periodFilter}
                    customStartDate={customStartDate}
                    customEndDate={customEndDate}
                  />
                </Suspense>
              </WhiteCard>

              {/* Attendance metrics grid (2-column MintCards) */}
              <div className="grid grid-cols-2 gap-4">
                <MintCard className="flex flex-col justify-between min-h-[96px]">
                  <div className="flex items-center justify-between text-slate text-[11px] font-medium">
                    <span className="truncate">{isEn ? 'Completed Lessons' : 'الحصص المنفذة'}</span>
                    <AppIcon name="sessions" size={14} />
                  </div>
                  <div>
                    <div className="text-[22px] font-bold text-navy">
                      {attendanceAnalytics.completedSessionsCount}
                    </div>
                    <p className="t-caption text-slate truncate mt-0.5">
                      {attendanceAnalytics.completedAppointmentsCount} {isEn ? 'Appointments' : 'مواعيد فعلية'}
                    </p>
                  </div>
                </MintCard>

                <MintCard className="flex flex-col justify-between min-h-[96px]">
                  <div className="flex items-center justify-between text-slate text-[11px] font-medium">
                    <span className="truncate">{isEn ? 'Recorded Presences' : 'حالات الحضور'}</span>
                    <AppIcon name="check" size={14} />
                  </div>
                  <div>
                    <div className="text-[22px] font-bold text-navy">
                      {attendanceAnalytics.presentCount + attendanceAnalytics.lateCount}
                    </div>
                    <p className="t-caption text-slate truncate mt-0.5">
                      {isEn ? `${attendanceAnalytics.lateCount} late` : `${attendanceAnalytics.lateCount} تأخير`}
                    </p>
                  </div>
                </MintCard>

                <MintCard className="flex flex-col justify-between min-h-[96px]">
                  <div className="flex items-center justify-between text-slate text-[11px] font-medium">
                    <span className="truncate">{isEn ? 'Charged Absences' : 'الغياب المحسوب'}</span>
                    <AppIcon name="warning" size={14} />
                  </div>
                  <div>
                    <div className="text-[22px] font-bold text-navy">
                      {attendanceAnalytics.absentChargedCount}
                    </div>
                    <p className="t-caption text-slate truncate mt-0.5">
                      {isEn ? 'Charged from balance' : 'مخصوم من الرصيد'}
                    </p>
                  </div>
                </MintCard>

                <MintCard className="flex flex-col justify-between min-h-[96px]">
                  <div className="flex items-center justify-between text-slate text-[11px] font-medium">
                    <span className="truncate">{isEn ? 'Excused Absences' : 'الغياب المعفى'}</span>
                    <AppIcon name="sparkles" size={14} />
                  </div>
                  <div>
                    <div className="text-[22px] font-bold text-navy">
                      {attendanceAnalytics.absentExcusedCount}
                    </div>
                    <p className="t-caption text-slate truncate mt-0.5">
                      {isEn ? 'Without deduction' : 'بدون خصم مالي'}
                    </p>
                  </div>
                </MintCard>
              </div>
            </div>
          )}

          {/* Sub-Tab 4: Monthly Ledger Table (Rows separated by 1px line, header .t-caption slate, numeric end-aligned, no zebra) */}
          {financialSubTab === 'monthly_ledger' && (
            <WhiteCard className="p-4 space-y-3">
              <SectionHeader
                title={isEn ? 'Monthly Ledger' : 'السجل المالي الشهري'}
                subtitle={isEn ? 'Historical monthly breakdown' : 'كشف التحصيل والمستحق حسب الأشهر'}
              />

              {financialHistory.months.length === 0 ? (
                <div className="p-8 text-center text-slate text-xs">
                  {isEn ? 'No monthly records found yet' : 'لا توجد سجلات شهرية سابقة بعد'}
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {/* Table Header */}
                  <div className="grid grid-cols-3 pb-2 text-[11px] font-medium text-slate">
                    <span>{isEn ? 'Month' : 'الشهر'}</span>
                    <span className="text-end">{isEn ? 'Collected' : 'المحصل'}</span>
                    <span className="text-end">{isEn ? 'Due' : 'المستحق'}</span>
                  </div>
                  {/* Table Rows */}
                  {financialHistory.months.map((m) => (
                    <div
                      key={m.monthYear}
                      className="grid grid-cols-3 py-3 text-xs items-center"
                    >
                      <span className="font-semibold text-navy truncate">
                        {isEn
                          ? `${getArabicMonthName(m.month)} ${m.year}`
                          : `شهر ${getArabicMonthName(m.month)} ${m.year}`}
                      </span>
                      <span className="text-end font-bold text-navy">
                        {m.totalCollected} <span className="text-[10px] text-slate font-normal">{t('currency')}</span>
                      </span>
                      <span className="text-end text-slate font-medium">
                        {m.totalDue} <span className="text-[10px] font-normal">{t('currency')}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </WhiteCard>
          )}

          {/* Sub-Tab 5: Annual Summary Table */}
          {financialSubTab === 'yearly_summary' && (
            <WhiteCard className="p-4 space-y-3">
              <SectionHeader
                title={isEn ? 'Annual Summary' : 'الملخص المالي السنوي'}
                subtitle={isEn ? 'Yearly revenue totals' : 'إجمالي التحصيل حسب السنوات'}
              />

              <div className="divide-y divide-line">
                {/* Table Header */}
                <div className="grid grid-cols-3 pb-2 text-[11px] font-medium text-slate">
                  <span>{isEn ? 'Year' : 'السنة'}</span>
                  <span className="text-end">{isEn ? 'Collected' : 'المحصل'}</span>
                  <span className="text-end">{isEn ? 'Due' : 'المستحق'}</span>
                </div>
                {/* Table Rows */}
                {financialHistory.years.map((y) => (
                  <div
                    key={y.year}
                    className="grid grid-cols-3 py-3 text-xs items-center"
                  >
                    <span className="font-semibold text-navy">
                      {isEn ? `Year ${y.year}` : `سنة ${y.year}`}
                    </span>
                    <span className="text-end font-bold text-navy">
                      {y.totalCollected} <span className="text-[10px] text-slate font-normal">{t('currency')}</span>
                    </span>
                    <span className="text-end text-slate font-medium">
                      {y.totalDue} <span className="text-[10px] font-normal">{t('currency')}</span>
                    </span>
                  </div>
                ))}
              </div>
            </WhiteCard>
          )}

          {/* Sub-Tab 6: Lifetime Totals (NavyCard) */}
          {financialSubTab === 'lifetime' && (
            <NavyCard className="space-y-3">
              <div className="flex items-center gap-2">
                <AppIcon name="sparkles" size={18} className="text-page" />
                <h3 className="t-card text-page font-semibold">
                  {isEn ? 'Lifetime Comprehensive Totals' : 'إجمالي كافة الفترات الشاملة (Lifetime)'}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-3.5 rounded-[var(--radius-tile)] bg-page/10 border border-page/15">
                  <span className="t-meta text-page/80 block">
                    {isEn ? 'Total All-Time Collected' : 'إجمالي ما تم تحصيله'}
                  </span>
                  <div className="t-display text-page mt-1">
                    <AnimatedCountValue value={financialHistory.totalCollected} />{' '}
                    <span className="text-xs font-semibold text-page/80">{t('currency')}</span>
                  </div>
                </div>
                <div className="p-3.5 rounded-[var(--radius-tile)] bg-page/10 border border-page/15">
                  <span className="t-meta text-page/80 block">
                    {isEn ? 'Total Expected Due' : 'إجمالي القيمة المستحقة'}
                  </span>
                  <div className="t-display text-page mt-1">
                    <AnimatedCountValue value={financialHistory.totalDue} />{' '}
                    <span className="text-xs font-semibold text-page/80">{t('currency')}</span>
                  </div>
                </div>
              </div>
            </NavyCard>
          )}

          {/* Sub-Tab 7: Payments Audit Table */}
          {financialSubTab === 'payments' && (
            <WhiteCard className="p-4 space-y-3">
              <SectionHeader
                title={isEn ? 'Receipts Audit' : 'سجل المقبوضات والدفعات'}
                subtitle={`${filteredPayments.length} ${isEn ? 'receipts' : 'إيصال'}`}
              />

              {/* Search Pill */}
              <div className="relative">
                <div className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-4' : 'left-4'} text-slate pointer-events-none`}>
                  <AppIcon name="search" size={16} />
                </div>
                <input
                  type="text"
                  placeholder={
                    isEn
                      ? 'Search receipts by student name or notes...'
                      : 'البحث باسم الطالب أو الملاحظات في الإيصالات...'
                  }
                  value={paymentSearchQuery}
                  onChange={(e) => setPaymentSearchQuery(e.target.value)}
                  className={`w-full h-[46px] rounded-full bg-page border border-line text-navy placeholder:text-slate text-xs font-medium focus:outline-none focus:border-navy shadow-white transition-all ${
                    isRTL ? 'pr-11 pl-4' : 'pl-11 pr-4'
                  }`}
                />
              </div>

              {filteredPayments.length === 0 ? (
                <div className="p-8 text-center text-slate text-xs">
                  {isEn ? 'No receipts recorded in this period' : 'لا توجد مقبوضات مسجلة في هذه الفترة'}
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {/* Table Header */}
                  <div className="flex items-center justify-between pb-2 text-[11px] font-medium text-slate">
                    <span>{isEn ? 'Student / Details' : 'الطالب / التفاصيل'}</span>
                    <span className="text-end">{isEn ? 'Amount' : 'المبلغ'}</span>
                  </div>
                  {/* Table Rows */}
                  {filteredPayments.map((p, idx) => {
                    const st = studentsById.get(p.studentId);
                    return (
                      <div
                        key={p.id}
                        className={`py-3 flex items-center justify-between gap-3 text-xs ${
                          idx >= 16 ? 'cv-list-item' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <strong className="font-semibold text-navy block truncate">
                            {st?.name || (isEn ? 'Unknown Student' : 'طالب غير محدد')}
                          </strong>
                          <span className="t-caption text-slate block mt-0.5">
                            {p.date} • {p.paymentMethod || 'cash'}
                          </span>
                        </div>
                        <span className="text-end font-bold text-navy text-sm shrink-0">
                          +{p.amount} <span className="text-[10px] text-slate font-normal">{t('currency')}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </WhiteCard>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: OVERDUE BALANCES & DUES DIRECTORY
          ========================================================================= */}
      {reportType === 'overdue_list' && (
        <div className="space-y-3.5">
          <WhiteCard className="p-4 space-y-3">
            <SectionHeader
              title={isEn ? 'Overdue Balances' : 'كشف المديونيات والمتأخرات'}
              subtitle={`${overdueStudentsList.length} ${isEn ? 'debtors' : 'طلاب'}`}
            />

            {/* Search Pill */}
            <div className="relative">
              <div className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-4' : 'left-4'} text-slate pointer-events-none`}>
                <AppIcon name="search" size={16} />
              </div>
              <input
                type="text"
                placeholder={
                  isEn
                    ? 'Search debtor students by name or phone...'
                    : 'البحث في كشف المديونيات بالاسم أو الهاتف...'
                }
                value={overdueSearchQuery}
                onChange={(e) => setOverdueSearchQuery(e.target.value)}
                className={`w-full h-[46px] rounded-full bg-page border border-line text-navy placeholder:text-slate text-xs font-medium focus:outline-none focus:border-navy shadow-white transition-all ${
                  isRTL ? 'pr-11 pl-4' : 'pl-11 pr-4'
                }`}
              />
            </div>
          </WhiteCard>

          {overdueStudentsList.length === 0 ? (
            <WhiteCard className="p-8 text-center flex flex-col items-center justify-center space-y-3">
              <EmptyBox className="w-24 h-24" />
              <div className="space-y-1">
                <h3 className="t-card font-semibold text-navy">
                  {isEn ? 'All Accounts Settled' : 'لا توجد مديونيات متأخرة'}
                </h3>
                <p className="t-meta text-slate">
                  {isEn
                    ? 'All students have paid their dues in full! 🎉'
                    : 'جميع الطلاب سددوا مستحقاتهم بالكامل! 🎉'}
                </p>
              </div>
            </WhiteCard>
          ) : (
            <WhiteCard className="p-4 space-y-3">
              <div className="divide-y divide-line">
                {/* Table Header */}
                <div className="flex items-center justify-between pb-2 text-[11px] font-medium text-slate">
                  <span>{isEn ? 'Student' : 'الطالب'}</span>
                  <span className="text-end">{isEn ? 'Remaining / Action' : 'المتبقي / إجراء'}</span>
                </div>

                {/* Table Rows */}
                {overdueStudentsList.map(({ student, grandRemaining, grandTotalDue, grandTotalPaid }) => (
                  <div
                    key={student.id}
                    className="py-3.5 flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <StudentAvatar student={student} size="sm" showBadge={false} />
                      <div className="min-w-0">
                        <h4 className="font-semibold text-xs sm:text-sm text-navy truncate">
                          {student.name}
                        </h4>
                        <span className="t-caption text-slate block mt-0.5">
                          {student.phone || student.parentPhone || (isEn ? 'No phone' : 'بدون هاتف')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ms-auto">
                      <div className="text-end">
                        <strong className="text-sm font-bold text-navy block">
                          {grandRemaining} <span className="text-[10px] text-slate font-normal">{t('currency')}</span>
                        </strong>
                        <span className="t-caption text-slate block mt-0.5">
                          {isEn
                            ? `Paid ${grandTotalPaid} of ${grandTotalDue}`
                            : `سدد ${grandTotalPaid} من ${grandTotalDue}`}
                        </span>
                      </div>

                      {onOpenAddPayment && (
                        <button
                          type="button"
                          onClick={() => onOpenAddPayment(student)}
                          className="btn-orange btn-sm text-xs"
                        >
                          {isEn ? 'Collect' : 'تحصيل'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </WhiteCard>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: GROUP PERFORMANCE DOSSIER
          ========================================================================= */}
      {reportType === 'group_report' && (
        <div className="space-y-4">
          <WhiteCard className="p-4 space-y-2">
            <label className="t-caption text-slate block ms-1">
              {isEn ? 'Select Group / Service:' : 'اختر المجموعة أو الخدمة للتحليل:'}
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full bg-page border border-line text-navy rounded-full px-4 py-2 text-xs font-semibold focus:outline-none focus:border-navy cursor-pointer"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.subject} • {getLocalizedStageName(g.gradeLevel)})
                </option>
              ))}
            </select>
          </WhiteCard>

          {selectedGroupFin && selectedGroupObj && (
            <div className="space-y-4">
              {/* Group KPIs (2-column MintCards) */}
              <div className="grid grid-cols-2 gap-4">
                <MintCard className="flex flex-col justify-between min-h-[96px]">
                  <span className="t-meta text-slate truncate">
                    {isEn ? 'Completed Lessons' : 'الحصص المنفذة'}
                  </span>
                  <div className="text-[22px] font-bold text-navy mt-1">
                    {selectedGroupFin.totalCompletedSessions ?? selectedGroupFin.completedSessionsCount}
                  </div>
                </MintCard>

                <MintCard className="flex flex-col justify-between min-h-[96px]">
                  <span className="t-meta text-slate truncate">
                    {isEn ? 'Total Expected' : 'إجمالي المستحق'}
                  </span>
                  <div className="text-[22px] font-bold text-navy mt-1 truncate">
                    {selectedGroupFin.totalDue ?? selectedGroupFin.totalExpectedRevenue}{' '}
                    <span className="text-xs font-semibold text-slate">{t('currency')}</span>
                  </div>
                </MintCard>

                <MintCard className="flex flex-col justify-between min-h-[96px]">
                  <span className="t-meta text-slate truncate">
                    {isEn ? 'Collected' : 'المحصل الفعلي'}
                  </span>
                  <div className="text-[22px] font-bold text-navy mt-1 truncate">
                    {selectedGroupFin.totalPaid ?? selectedGroupFin.totalRevenue}{' '}
                    <span className="text-xs font-semibold text-slate">{t('currency')}</span>
                  </div>
                </MintCard>

                <MintCard className="flex flex-col justify-between min-h-[96px]">
                  <span className="t-meta text-slate truncate">
                    {isEn ? 'Remaining' : 'المتبقي'}
                  </span>
                  <div className="text-[22px] font-bold text-navy mt-1 truncate">
                    {selectedGroupFin.remaining ?? selectedGroupFin.totalRemainingDues}{' '}
                    <span className="text-xs font-semibold text-slate">{t('currency')}</span>
                  </div>
                </MintCard>
              </div>

              {/* Group Attendance Trends Chart in WhiteCard with SectionHeader */}
              <WhiteCard className="p-4 space-y-3">
                <SectionHeader
                  title={isEn ? 'Group Attendance Trends' : 'منحنيات حضور المجموعة'}
                  subtitle={`${selectedGroupObj.name} • ${selectedGroupObj.subject}`}
                />
                <Suspense
                  fallback={
                    <DelayedFallback delayMs={75}>
                      <ReportChartSkeleton compact />
                    </DelayedFallback>
                  }
                >
                  <AttendanceTrendsChart
                    sessions={sessions}
                    allAttendance={allAttendanceRecords}
                    students={students}
                    groups={groups}
                    selectedGroupId={selectedGroupId}
                    periodFilter={periodFilter}
                    customStartDate={customStartDate}
                    customEndDate={customEndDate}
                    compact
                  />
                </Suspense>
              </WhiteCard>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: INDIVIDUAL STUDENT DOSSIER
          ========================================================================= */}
      {reportType === 'student_report' && (
        <div className="space-y-4">
          <WhiteCard className="p-4 space-y-2">
            <label className="t-caption text-slate block ms-1">
              {isEn ? 'Select Student:' : 'اختر الطالب لعرض كشف الحساب والتقرير:'}
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full bg-page border border-line text-navy rounded-full px-4 py-2 text-xs font-semibold focus:outline-none focus:border-navy cursor-pointer"
            >
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} {st.phone ? `(${st.phone})` : ''}
                </option>
              ))}
            </select>
          </WhiteCard>

          {selectedStudentGrandFin && selectedStudentObj && (
            <div className="space-y-4">
              {/* Student Header Card */}
              <WhiteCard className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <StudentAvatar student={selectedStudentObj} size="md" />
                  <div className="min-w-0">
                    <h3 className="t-card font-semibold text-navy truncate">
                      {selectedStudentObj.name}
                    </h3>
                    <span className="t-meta text-slate block truncate mt-0.5">
                      {getLocalizedStageName(selectedStudentObj.gradeLevel)}
                    </span>
                  </div>
                </div>

                {onOpenStudentProfile && (
                  <button
                    type="button"
                    onClick={() => onOpenStudentProfile(selectedStudentObj)}
                    className="btn-orange btn-sm text-xs shrink-0"
                  >
                    {t('profile')}
                  </button>
                )}
              </WhiteCard>

              {/* Student KPIs (2-column MintCards) */}
              <div className="grid grid-cols-2 gap-4">
                <MintCard className="flex flex-col justify-between min-h-[96px]">
                  <span className="t-meta text-slate truncate">
                    {isEn ? 'Completed Lessons' : 'الحصص المنفذة'}
                  </span>
                  <div>
                    <div className="text-[22px] font-bold text-navy mt-1">
                      {selectedStudentGrandFin.grandCompletedLessons}
                    </div>
                    <span className="t-caption text-slate block mt-0.5 truncate">
                      {selectedStudentGrandFin.grandAppointmentsCount} {isEn ? 'Appts' : 'مواعيد'}
                    </span>
                  </div>
                </MintCard>

                <MintCard className="flex flex-col justify-between min-h-[96px]">
                  <span className="t-meta text-slate truncate">
                    {isEn ? 'Grand Total Due' : 'إجمالي المطلوب'}
                  </span>
                  <div className="text-[22px] font-bold text-navy mt-1 truncate">
                    {selectedStudentGrandFin.grandTotalDue}{' '}
                    <span className="text-xs font-semibold text-slate">{t('currency')}</span>
                  </div>
                </MintCard>

                <MintCard className="flex flex-col justify-between min-h-[96px]">
                  <span className="t-meta text-slate truncate">
                    {isEn ? 'Paid' : 'المدفوع'}
                  </span>
                  <div className="text-[22px] font-bold text-navy mt-1 truncate">
                    {selectedStudentGrandFin.grandTotalPaid}{' '}
                    <span className="text-xs font-semibold text-slate">{t('currency')}</span>
                  </div>
                </MintCard>

                <MintCard className="flex flex-col justify-between min-h-[96px]">
                  <span className="t-meta text-slate truncate">
                    {isEn ? 'Remaining Due' : 'المتبقي'}
                  </span>
                  <div className="text-[22px] font-bold text-navy mt-1 truncate">
                    {selectedStudentGrandFin.grandRemaining}{' '}
                    <span className="text-xs font-semibold text-slate">{t('currency')}</span>
                  </div>
                </MintCard>
              </div>

              {/* Student Attendance Trends Chart in WhiteCard with SectionHeader */}
              <WhiteCard className="p-4 space-y-3">
                <SectionHeader
                  title={isEn ? 'Attendance Trends' : 'منحنيات حضور الطالب'}
                  subtitle={selectedStudentObj.name}
                />
                <Suspense
                  fallback={
                    <DelayedFallback delayMs={75}>
                      <ReportChartSkeleton compact />
                    </DelayedFallback>
                  }
                >
                  <AttendanceTrendsChart
                    sessions={sessions}
                    allAttendance={allAttendanceRecords}
                    students={students}
                    groups={groups}
                    selectedStudentId={selectedStudentId}
                    periodFilter={periodFilter}
                    customStartDate={customStartDate}
                    customEndDate={customEndDate}
                    compact
                  />
                </Suspense>
              </WhiteCard>
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
};
