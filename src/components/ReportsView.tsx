import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  Users,
  Layers,
  Calendar,
  CalendarDays,
  CalendarCheck2,
  Printer,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Wallet,
  Sparkles,
  Receipt,
  Search,
  Filter,
  ArrowDownLeft,
  CreditCard,
  Phone,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Clock,
  PieChart,
  X,
  Zap,
  CheckCheck,
  Award,
  AlertTriangle,
  RefreshCw,
  Share2,
  Activity,
} from 'lucide-react';
import { Student, Group, Session, Payment, ReportPeriodFilter, Enrollment, Attendance } from '../types';
import { db, roundMoney, getArabicMonthName, calculateWorkloadSummary, getSessionLessonQuantity } from '../utils/storage';
import { getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';
import { ClassyOwlMascot } from './ClassyOwlMascot';
import { StudentAvatar } from './StudentAvatar';
import { AttendanceTrendsChart } from './AttendanceTrendsChart';
import { BillingStreamsProgressChart } from './BillingStreamsProgressChart';

interface ReportsViewProps {
  students: Student[];
  groups: Group[];
  sessions: Session[];
  payments: Payment[];
  enrollments?: Enrollment[];
  onOpenAddPayment?: (student?: Student, enrollmentId?: string) => void;
  onOpenStudentProfile?: (student: Student) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  students,
  groups,
  sessions,
  payments,
  enrollments,
  onOpenAddPayment,
  onOpenStudentProfile,
}) => {
  const { t, language, isRTL } = useTranslation();
  const isEn = language.startsWith('en');

  const currentMonth = useMemo(() => new Date().getMonth() + 1, []);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

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
  const [expandedMonthYear, setExpandedMonthYear] = useState<string | null>(null);
  const [expandedYear, setExpandedYear] = useState<number | null>(currentYear);

  // Selected Student / Group for dedicated reports
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [overdueSearchQuery, setOverdueSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [studentFilterType, setStudentFilterType] = useState<'all' | 'active' | 'archived'>('all');

  const activeEnrollments = useMemo(() => enrollments || db.getEnrollments(), [enrollments]);
  const allAttendanceRecords = useMemo(() => db.getAttendance(), [sessions]);

  // 1. Overall Teacher Calculations from db
  const teacherSummary = useMemo(() => {
    return db.calculateTeacherFinancialOverview(periodFilter);
  }, [periodFilter, students, payments, sessions]);

  // Full Financial History Engine
  const financialHistory = useMemo(() => {
    return teacherSummary.financialHistory || db.calculateFinancialHistory();
  }, [teacherSummary, payments, sessions, activeEnrollments, groups, students]);

  // Attendance & Sessions Analytics for current period
  const attendanceAnalytics = useMemo(() => {
    const allAtt = allAttendanceRecords;
    const d7 = new Date();
    d7.setDate(d7.getDate() - 7);
    const d7Str = d7.toISOString().split('T')[0];

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
      const grp = groups.find((g) => g.id === s.groupId);
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

      if (isHourly) return 1; // Hourly never uses sessionUnits
      return getSessionLessonQuantity(s, att);
    };

    const completedLessonsCount = roundMoney(
      completedSessions.reduce((sum, s) => {
        const sAtt = relevantAtt.find((a) => a.sessionId === s.id);
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
    groups,
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
    const d7Str = d7.toISOString().split('T')[0];

    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    return payments.filter((p) => {
      // Search query
      if (paymentSearchQuery.trim()) {
        const q = paymentSearchQuery.toLowerCase();
        const student = students.find((s) => s.id === p.studentId);
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
    paymentSearchQuery,
    students,
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
      cash: { label: isEn ? 'Cash' : 'كاش (نقداً)', amount: 0, count: 0, color: '#5C4033' },
      vodafone_cash: { label: isEn ? 'Vodafone Cash' : 'فودافون كاش', amount: 0, count: 0, color: '#B56B45' },
      instapay: { label: isEn ? 'InstaPay' : 'إنستاباي (InstaPay)', amount: 0, count: 0, color: '#B68A4C' },
      bank_transfer: { label: isEn ? 'Bank Transfer' : 'تحويل بنكي', amount: 0, count: 0, color: '#B68A4C' },
      other: { label: isEn ? 'Other' : 'أخرى', amount: 0, count: 0, color: '#69493C' },
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
        if (overdueSearchQuery.trim()) {
          const q = overdueSearchQuery.toLowerCase();
          const matches =
            st.name.toLowerCase().includes(q) ||
            (st.phone && st.phone.includes(q)) ||
            (st.parentPhone && st.parentPhone.includes(q));
          if (!matches) return;
        }

        const studentPayments = payments.filter((p) => p.studentId === st.id);
        const lastPayment = studentPayments.sort((a, b) => b.date.localeCompare(a.date))[0];
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
  }, [students, payments, overdueSearchQuery]);

  // Selected Student Dossier
  const selectedStudentGrandFin = useMemo(() => {
    return selectedStudentId ? db.calculateStudentGrandFinancials(selectedStudentId) : null;
  }, [selectedStudentId, students, payments, sessions]);

  const selectedStudentObj = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  // Selected Group Dossier
  const selectedGroupFin = useMemo(() => {
    return selectedGroupId ? db.calculateGroupFinancials(selectedGroupId) : null;
  }, [selectedGroupId, groups, students, sessions, payments]);

  const selectedGroupObj = useMemo(() => {
    return groups.find((g) => g.id === selectedGroupId);
  }, [groups, selectedGroupId]);

  const handlePrint = () => {
    window.print();
  };

  // Period Display Label for Header
  const currentPeriodLabel = useMemo(() => {
    if (periodFilter === 'all_time') return isEn ? 'All Time' : 'كافة الفترات (All Time)';
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

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar p-3.5 sm:p-5 space-y-4 text-[#2F2F2F] pb-32 bg-[#FAF7F2] relative"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Ambient background glows matching Classy visual identity */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#6B1E2B]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-0 w-80 h-80 bg-[#B68A4C]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-[#B56B45]/6 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* =========================================================================
          1. REPORTS HERO HEADER
          ========================================================================= */}
      <div className="rounded-[24px] bg-gradient-to-r from-[#6B1E2B] via-[#5C4033] to-[#69493C] p-4 sm:p-5 text-[#FAF7F2] relative overflow-hidden shadow-xl border border-[#EADBC7]/15">
        {/* Soft internal gradient orbs */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#6B1E2B]/35 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-[#B56B45]/30 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start justify-between gap-3 relative z-10 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6B1E2B] via-[#B56B45] to-[#B68A4C] p-0.5 shadow-lg shadow-[#6B1E2B]/35 shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#6B1E2B] flex items-center justify-center text-[#FAF7F2]">
                <BarChart3 className="w-5 h-5 text-[#B68A4C]" />
              </div>
            </div>

            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-[#EADBC7]/90 flex items-center gap-1 truncate">
                  <Sparkles className="w-3 h-3 text-[#B68A4C] shrink-0" />
                  <span className="truncate">{isEn ? 'Financial Analytics & Audit Center' : 'مركز التحليلات والكشوف المالية'}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black text-[#FAF7F2] tracking-tight">
                  {t('reportsTitle')}
                </h1>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#FAF7F2]/20 text-[#FAF7F2] border border-[#EADBC7]/25 shadow-xs truncate max-w-full">
                  {currentPeriodLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-2 rounded-2xl bg-[#FAF7F2] text-[#2F2F2F] font-bold text-xs flex items-center gap-1.5 shadow-md hover:bg-[#FAF7F2] transition-all active:scale-95 cursor-pointer shrink-0"
            title={isEn ? 'Print Statement' : 'طباعة التقرير والكشف المالي'}
          >
            <Printer className="w-3.5 h-3.5 text-[#6B1E2B]" />
            <span>{isEn ? 'Print' : 'طباعة'}</span>
          </button>
        </div>

        {/* Square 2x2 Hero KPIs Grid */}
        <div className="grid grid-cols-2 gap-2.5 pt-4 mt-4 border-t border-[#EADBC7]/20">
          <div className="bg-[#FAF7F2]/10 backdrop-blur-md rounded-2xl p-3 border border-[#EADBC7]/20 flex flex-col justify-between min-h-[78px]">
            <span className="text-[11px] text-[#EADBC7]/85 block font-bold">{isEn ? 'Collected in Period' : 'المحصل بالفترة'}</span>
            <span className="text-lg font-black text-[#EADBC7] block truncate mt-1">
              {periodRevenue} <span className="text-[10px] text-[#EADBC7]">{t('currency')}</span>
            </span>
          </div>
          <div className="bg-[#FAF7F2]/10 backdrop-blur-md rounded-2xl p-3 border border-[#EADBC7]/20 flex flex-col justify-between min-h-[78px]">
            <span className="text-[11px] text-[#EADBC7]/85 block font-bold">{isEn ? 'Remaining Dues' : 'المستحقات المتبقية'}</span>
            <span
              className={`text-lg font-black block truncate mt-1 ${
                teacherSummary.totalRemaining > 0 ? 'text-[#B56B45]' : 'text-[#EADBC7]'
              }`}
            >
              {teacherSummary.totalRemaining} <span className="text-[10px]">{t('currency')}</span>
            </span>
          </div>
          <div className="bg-[#FAF7F2]/10 backdrop-blur-md rounded-2xl p-3 border border-[#EADBC7]/20 flex flex-col justify-between min-h-[78px]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] text-[#EADBC7]/85 font-bold">{isEn ? 'Completed Lessons' : 'الحصص المنفذة'}</span>
              {attendanceAnalytics.completedAppointmentsCount > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#FAF7F2]/15 text-[#EADBC7] font-bold">
                  {attendanceAnalytics.completedAppointmentsCount}{' '}
                  {isEn
                    ? attendanceAnalytics.completedAppointmentsCount === 1
                      ? 'Appt'
                      : 'Appts'
                    : attendanceAnalytics.completedAppointmentsCount === 1
                    ? 'موعد'
                    : 'مواعيد'}
                </span>
              )}
            </div>
            <span className="text-lg font-black text-[#B68A4C] block leading-tight mt-1">
              {attendanceAnalytics.completedSessionsCount}
            </span>
          </div>
          <div className="bg-[#FAF7F2]/10 backdrop-blur-md rounded-2xl p-3 border border-[#EADBC7]/20 flex flex-col justify-between min-h-[78px]">
            <span className="text-[11px] text-[#EADBC7]/85 block font-bold">{isEn ? 'Attendance Rate' : 'نسبة الالتزام والحضور'}</span>
            <span className="text-lg font-black text-[#FAF7F2] block mt-1">
              {attendanceAnalytics.commitmentRate}%
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. MAIN REPORT NAVIGATION (2x2 Square Bento Grid like Dashboard)
          ========================================================================= */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setReportType('teacher_overview')}
          className={`p-3.5 rounded-[22px] flex flex-col justify-between min-h-[96px] text-start transition-all cursor-pointer active:scale-[0.98] border ${
            reportType === 'teacher_overview'
              ? 'bg-gradient-to-br from-[#6B1E2B] to-[#5C4033] text-[#FAF7F2] border-[#6B1E2B]/50 shadow-lg shadow-[#5C4033]/20'
              : 'classy-lavender-card text-[#2F2F2F] hover:border-[#6B1E2B]/50'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shadow-sm ${
                reportType === 'teacher_overview'
                  ? 'bg-[#FAF7F2]/15 text-[#B68A4C]'
                  : 'bg-gradient-to-tr from-[#6B1E2B] to-[#5C4033] text-[#FAF7F2]'
              }`}
            >
              <BarChart3 className="w-4.5 h-4.5" />
            </div>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                reportType === 'teacher_overview'
                  ? 'bg-[#FAF7F2]/20 text-[#FAF7F2]'
                  : 'bg-[#EADBC7] text-[#6B1E2B] border border-[#B6A89C]'
              }`}
            >
              {isEn ? 'Executive' : 'شامل'}
            </span>
          </div>
          <div className="w-full min-w-0">
            <span className="text-xs sm:text-sm font-black block truncate">
              {isEn ? 'Executive & Finance' : 'اللوحة المالية الشاملة'}
            </span>
            <span
              className={`text-[10px] font-bold block truncate mt-0.5 ${
                reportType === 'teacher_overview' ? 'text-[#EADBC7]/80' : 'text-[#69493C]'
              }`}
            >
              {isEn ? 'Revenues & Analytics' : 'الأرباح والإحصائيات'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setReportType('overdue_list')}
          className={`p-3.5 rounded-[22px] flex flex-col justify-between min-h-[96px] text-start transition-all cursor-pointer active:scale-[0.98] border ${
            reportType === 'overdue_list'
              ? 'bg-gradient-to-br from-[#6B1E2B] to-[#5C4033] text-[#FAF7F2] border-[#B56B45]/50 shadow-lg shadow-[#5C4033]/20'
              : 'classy-rose-card text-[#2F2F2F] hover:border-[#B56B45]/50'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shadow-sm ${
                reportType === 'overdue_list'
                  ? 'bg-[#FAF7F2]/15 text-[#B56B45]'
                  : 'bg-gradient-to-tr from-[#B56B45] to-[#6B1E2B] text-[#FAF7F2]'
              }`}
            >
              <Receipt className="w-4.5 h-4.5" />
            </div>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                reportType === 'overdue_list'
                  ? 'bg-[#FAF7F2]/20 text-[#FAF7F2]'
                  : 'bg-[#F8F2EA] text-[#B56B45] border border-[#B6A89C]'
              }`}
            >
              {overdueStudentsList.length} {isEn ? 'dues' : 'طلاب'}
            </span>
          </div>
          <div className="w-full min-w-0">
            <span className="text-xs sm:text-sm font-black block truncate">
              {isEn ? 'Dues & Overdue' : 'المستحقات والمديونيات'}
            </span>
            <span
              className={`text-[10px] font-bold block truncate mt-0.5 ${
                reportType === 'overdue_list' ? 'text-[#EADBC7]/80' : 'text-[#69493C]'
              }`}
            >
              {isEn ? 'Pending collections' : 'كشف المتأخرات والتحصيل'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setReportType('group_report')}
          className={`p-3.5 rounded-[22px] flex flex-col justify-between min-h-[96px] text-start transition-all cursor-pointer active:scale-[0.98] border ${
            reportType === 'group_report'
              ? 'bg-gradient-to-br from-[#6B1E2B] to-[#5C4033] text-[#FAF7F2] border-[#B68A4C]/50 shadow-lg shadow-[#5C4033]/20'
              : 'rounded-[22px] bg-gradient-to-br from-[#FAF7F2] to-[#F8F2EA]/40 border-[#B68A4C]/50 text-[#2F2F2F] hover:border-[#B68A4C]'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shadow-sm ${
                reportType === 'group_report'
                  ? 'bg-[#FAF7F2]/15 text-[#EADBC7]'
                  : 'bg-gradient-to-tr from-[#B68A4C] to-[#5C4033] text-[#FAF7F2]'
              }`}
            >
              <Layers className="w-4.5 h-4.5" />
            </div>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                reportType === 'group_report'
                  ? 'bg-[#FAF7F2]/20 text-[#FAF7F2]'
                  : 'bg-[#EADBC7] text-[#5C4033] border border-[#B68A4C]/50'
              }`}
            >
              {groups.length} {isEn ? 'groups' : 'مجموعة'}
            </span>
          </div>
          <div className="w-full min-w-0">
            <span className="text-xs sm:text-sm font-black block truncate">
              {isEn ? 'Group Reports' : 'تقارير المجموعات'}
            </span>
            <span
              className={`text-[10px] font-bold block truncate mt-0.5 ${
                reportType === 'group_report' ? 'text-[#EADBC7]/80' : 'text-[#69493C]'
              }`}
            >
              {isEn ? 'Group performance' : 'تحليل المجموعات والخدمات'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setReportType('student_report')}
          className={`p-3.5 rounded-[22px] flex flex-col justify-between min-h-[96px] text-start transition-all cursor-pointer active:scale-[0.98] border ${
            reportType === 'student_report'
              ? 'bg-gradient-to-br from-[#6B1E2B] to-[#5C4033] text-[#FAF7F2] border-[#B68A4C]/50 shadow-lg shadow-[#5C4033]/20'
              : 'classy-card bg-[#FAF7F2] text-[#2F2F2F] hover:border-[#5C4033]/40'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shadow-sm ${
                reportType === 'student_report'
                  ? 'bg-[#FAF7F2]/15 text-[#B68A4C]'
                  : 'bg-gradient-to-tr from-[#6B1E2B] to-[#5C4033] text-[#B68A4C]'
              }`}
            >
              <User className="w-4.5 h-4.5" />
            </div>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                reportType === 'student_report'
                  ? 'bg-[#FAF7F2]/20 text-[#FAF7F2]'
                  : 'bg-[#EADBC7] text-[#5C4033] border border-[#B6A89C]'
              }`}
            >
              {students.length} {isEn ? 'students' : 'طالب'}
            </span>
          </div>
          <div className="w-full min-w-0">
            <span className="text-xs sm:text-sm font-black block truncate">
              {isEn ? 'Student Dossier' : 'تقارير الطلاب'}
            </span>
            <span
              className={`text-[10px] font-bold block truncate mt-0.5 ${
                reportType === 'student_report' ? 'text-[#EADBC7]/80' : 'text-[#69493C]'
              }`}
            >
              {isEn ? 'Individual statement' : 'كشف حساب الطالب'}
            </span>
          </div>
        </button>
      </div>

      {/* =========================================================================
          3. TIME PERIOD FILTER BAR (2-Column Square Grid)
          ========================================================================= */}
      {reportType !== 'overdue_list' && (
        <div className="classy-card p-3.5 space-y-2.5 bg-[#FAF7F2]">
          <div className="flex items-center gap-1.5 text-[#2F2F2F] font-black text-xs">
            <Filter className="w-4 h-4 text-[#6B1E2B]" />
            <span>{isEn ? 'Report Period:' : 'تحديد الفترة الزمنية للتقرير:'}</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {[
              { key: 'this_month', label: isEn ? 'This Month' : 'هذا الشهر' },
              { key: 'last_month', label: isEn ? 'Last Month' : 'الشهر الماضي' },
              { key: 'last_7_days', label: isEn ? 'Last 7 Days' : 'آخر 7 أيام' },
              { key: 'today', label: isEn ? 'Today' : 'اليوم' },
              { key: 'specific_month', label: isEn ? 'Specific Month' : 'شهر محدد' },
              { key: 'custom_range', label: isEn ? 'Custom Range' : 'فترة مخصصة' },
              { key: 'all_time', label: isEn ? 'All Time (Comprehensive)' : 'كل الوقت (شامل)' },
            ].map((tab, idx, arr) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setPeriodFilter(tab.key as ReportPeriodFilter)}
                className={`px-3 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer text-center truncate ${
                  idx === arr.length - 1 ? 'col-span-2' : ''
                } ${
                  periodFilter === tab.key
                    ? 'bg-[#6B1E2B] text-[#FAF7F2] shadow-xs'
                    : 'bg-[#F8F2EA] text-[#69493C] border border-[#EADBC7] hover:bg-[#EADBC7]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Extended controls for specific month or custom range */}
          {periodFilter === 'specific_month' && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#EADBC7]">
              <select
                value={selectedSpecificMonth}
                onChange={(e) => setSelectedSpecificMonth(Number(e.target.value))}
                className="p-2 rounded-xl bg-[#F8F2EA] border border-[#EADBC7] font-bold text-xs text-[#2F2F2F] focus:outline-none focus:border-[#6B1E2B]"
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
                className="p-2 rounded-xl bg-[#F8F2EA] border border-[#EADBC7] font-bold text-xs text-[#2F2F2F] focus:outline-none focus:border-[#6B1E2B]"
              >
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodFilter === 'custom_range' && (
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#EADBC7]">
              <div>
                <span className="text-[#69493C] text-[11px] block font-bold mb-1">{isEn ? 'From Date:' : 'من تاريخ:'}</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full p-2 rounded-xl bg-[#F8F2EA] border border-[#EADBC7] text-xs font-bold text-[#2F2F2F] focus:outline-none focus:border-[#6B1E2B]"
                />
              </div>
              <div>
                <span className="text-[#69493C] text-[11px] block font-bold mb-1">{isEn ? 'To Date:' : 'إلى تاريخ:'}</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full p-2 rounded-xl bg-[#F8F2EA] border border-[#EADBC7] text-xs font-bold text-[#2F2F2F] focus:outline-none focus:border-[#6B1E2B]"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          4. TAB 1: EXECUTIVE FINANCIAL DASHBOARD & ANALYTICS
          ========================================================================= */}
      {reportType === 'teacher_overview' && (
        <div className="space-y-4">
          {/* Sub-Navigation Square Grid & Group vs Private Filter */}
          <div className="classy-card p-3 space-y-2.5 bg-[#FAF7F2]">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFinancialSubTab('overview')}
                className={`p-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border ${
                  financialSubTab === 'overview'
                    ? 'bg-[#6B1E2B] text-[#FAF7F2] border-[#6B1E2B] shadow-xs'
                    : 'bg-[#F8F2EA] text-[#69493C] border-[#EADBC7] hover:bg-[#EADBC7] hover:text-[#2F2F2F]'
                }`}
              >
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                  financialSubTab === 'overview' ? 'bg-[#FAF7F2]/15 text-[#B68A4C]' : 'bg-[#FAF7F2] text-[#6B1E2B]'
                }`}>
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">{isEn ? 'Overview' : 'نظرة عامة'}</span>
              </button>

              <button
                type="button"
                onClick={() => setFinancialSubTab('billing_streams')}
                className={`p-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border ${
                  financialSubTab === 'billing_streams'
                    ? 'bg-[#6B1E2B] text-[#FAF7F2] border-[#6B1E2B] shadow-xs'
                    : 'bg-[#F8F2EA] text-[#69493C] border-[#EADBC7] hover:bg-[#EADBC7] hover:text-[#2F2F2F]'
                }`}
              >
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                  financialSubTab === 'billing_streams' ? 'bg-[#FAF7F2]/15 text-[#B68A4C]' : 'bg-[#FAF7F2] text-[#6B1E2B]'
                }`}>
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">{isEn ? 'Billing Streams' : 'مسارات المحاسبة'}</span>
              </button>

              <button
                type="button"
                onClick={() => setFinancialSubTab('attendance_trends')}
                className={`p-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border ${
                  financialSubTab === 'attendance_trends'
                    ? 'bg-[#6B1E2B] text-[#FAF7F2] border-[#6B1E2B] shadow-xs'
                    : 'bg-[#F8F2EA] text-[#69493C] border-[#EADBC7] hover:bg-[#EADBC7] hover:text-[#2F2F2F]'
                }`}
              >
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                  financialSubTab === 'attendance_trends' ? 'bg-[#FAF7F2]/15 text-[#B68A4C]' : 'bg-[#FAF7F2] text-[#B68A4C]'
                }`}>
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">{isEn ? 'Attendance Trends' : 'منحنيات الحضور'}</span>
              </button>

              <button
                type="button"
                onClick={() => setFinancialSubTab('monthly_ledger')}
                className={`p-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border ${
                  financialSubTab === 'monthly_ledger'
                    ? 'bg-[#6B1E2B] text-[#FAF7F2] border-[#6B1E2B] shadow-xs'
                    : 'bg-[#F8F2EA] text-[#69493C] border-[#EADBC7] hover:bg-[#EADBC7] hover:text-[#2F2F2F]'
                }`}
              >
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                  financialSubTab === 'monthly_ledger' ? 'bg-[#FAF7F2]/15 text-[#B68A4C]' : 'bg-[#FAF7F2] text-[#6B1E2B]'
                }`}>
                  <CalendarDays className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">{isEn ? `Monthly (${financialHistory.months.length})` : `السجل الشهري (${financialHistory.months.length})`}</span>
              </button>

              <button
                type="button"
                onClick={() => setFinancialSubTab('yearly_summary')}
                className={`p-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border ${
                  financialSubTab === 'yearly_summary'
                    ? 'bg-[#6B1E2B] text-[#FAF7F2] border-[#6B1E2B] shadow-xs'
                    : 'bg-[#F8F2EA] text-[#69493C] border-[#EADBC7] hover:bg-[#EADBC7] hover:text-[#2F2F2F]'
                }`}
              >
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                  financialSubTab === 'yearly_summary' ? 'bg-[#FAF7F2]/15 text-[#B68A4C]' : 'bg-[#FAF7F2] text-[#6B1E2B]'
                }`}>
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">{isEn ? `Annual (${financialHistory.years.length})` : `السجل السنوي (${financialHistory.years.length})`}</span>
              </button>

              <button
                type="button"
                onClick={() => setFinancialSubTab('payments')}
                className={`p-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border ${
                  financialSubTab === 'payments'
                    ? 'bg-[#6B1E2B] text-[#FAF7F2] border-[#6B1E2B] shadow-xs'
                    : 'bg-[#F8F2EA] text-[#69493C] border-[#EADBC7] hover:bg-[#EADBC7] hover:text-[#2F2F2F]'
                }`}
              >
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                  financialSubTab === 'payments' ? 'bg-[#FAF7F2]/15 text-[#B56B45]' : 'bg-[#FAF7F2] text-[#B56B45]'
                }`}>
                  <Receipt className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">{isEn ? `Receipts (${filteredPayments.length})` : `المقبوضات (${filteredPayments.length})`}</span>
              </button>

              <button
                type="button"
                onClick={() => setFinancialSubTab('lifetime')}
                className={`col-span-2 p-2.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                  financialSubTab === 'lifetime'
                    ? 'bg-[#6B1E2B] text-[#FAF7F2] border-[#6B1E2B] shadow-xs'
                    : 'bg-[#F8F2EA] text-[#69493C] border-[#EADBC7] hover:bg-[#EADBC7] hover:text-[#2F2F2F]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#B68A4C] shrink-0" />
                <span className="truncate">{isEn ? 'Lifetime Comprehensive Totals (All-Time)' : 'الإجمالي الشامل لكافة الفترات (All-Time)'}</span>
              </button>
            </div>

            {/* Group vs Private Segmented Control */}
            <div className="grid grid-cols-3 gap-1.5 bg-[#F8F2EA] p-1.5 rounded-xl border border-[#EADBC7]">
              <button
                type="button"
                onClick={() => setServiceTypeFilter('all')}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                  serviceTypeFilter === 'all'
                    ? 'bg-[#6B1E2B] text-[#FAF7F2] shadow-2xs'
                    : 'text-[#69493C] hover:text-[#2F2F2F]'
                }`}
              >
                {t('all')}
              </button>
              <button
                type="button"
                onClick={() => setServiceTypeFilter('group')}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                  serviceTypeFilter === 'group'
                    ? 'bg-[#6B1E2B] text-[#FAF7F2] shadow-2xs'
                    : 'text-[#69493C] hover:text-[#2F2F2F]'
                }`}
              >
                {isEn ? 'Groups' : 'مجموعات'}
              </button>
              <button
                type="button"
                onClick={() => setServiceTypeFilter('private')}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                  serviceTypeFilter === 'private'
                    ? 'bg-[#6B1E2B] text-[#FAF7F2] shadow-2xs'
                    : 'text-[#69493C] hover:text-[#2F2F2F]'
                }`}
              >
                {isEn ? 'Private' : 'خاص'}
              </button>
            </div>
          </div>

          {/* Sub-Tab 1: Overview Dashboard */}
          {financialSubTab === 'overview' && (
            <div className="space-y-4">
              {/* Financial KPI Square 2x2 Bento Grid (Matches DashboardView) */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Square Card 1: Total Expected Value */}
                <div className="p-3.5 rounded-[22px] bg-gradient-to-br from-[#FAF7F2] to-[#F8F2EA]/50 border border-[#B68A4C]/50 flex flex-col justify-between min-h-[112px] shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#B68A4C] to-[#5C4033] text-[#FAF7F2] flex items-center justify-center shadow-md shadow-[#B68A4C]/20 shrink-0">
                      <TrendingUp className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#EADBC7] text-[#5C4033] border border-[#B68A4C]/50 truncate">
                      {attendanceAnalytics.completedAppointmentsCount} {isEn ? 'Appts' : 'موعد'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <strong className="text-xl sm:text-2xl font-black text-[#2F2F2F] tracking-tight block truncate">
                      {teacherSummary.totalDue ?? teacherSummary.totalDues} <span className="text-xs font-bold text-[#69493C]">{t('currency')}</span>
                    </strong>
                    <span className="text-xs font-bold text-[#69493C] block mt-0.5 truncate">
                      {isEn ? 'Total Expected Value' : 'إجمالي القيمة المستحقة'}
                    </span>
                  </div>
                </div>

                {/* Square Card 2: Completed Lessons */}
                <div className="classy-lavender-card p-3.5 flex flex-col justify-between min-h-[112px] shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#6B1E2B] to-[#5C4033] text-[#FAF7F2] flex items-center justify-center shadow-md shadow-[#6B1E2B]/25 shrink-0">
                      <CheckCircle2 className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#EADBC7] text-[#6B1E2B] border border-[#B6A89C] truncate">
                      {attendanceAnalytics.commitmentRate}% {isEn ? 'Rate' : 'التزام'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <strong className="text-xl sm:text-2xl font-black text-[#2F2F2F] tracking-tight block truncate">
                      {attendanceAnalytics.completedSessionsCount}
                    </strong>
                    <span className="text-xs font-bold text-[#69493C] block mt-0.5 truncate">
                      {isEn ? 'Completed Lessons' : 'الحصص المنفذة'}
                    </span>
                  </div>
                </div>

                {/* Square Card 3: Total Collected */}
                <div className="classy-card p-3.5 flex flex-col justify-between min-h-[112px] shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#6B1E2B] to-[#5C4033] text-[#B68A4C] flex items-center justify-center shadow-md shadow-[#5C4033]/25 shrink-0">
                      <Wallet className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#EADBC7] text-[#5C4033] border border-[#B6A89C] truncate">
                      {filteredPayments.length} {isEn ? 'paid' : 'دفعات'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <strong className="text-xl sm:text-2xl font-black text-[#5C4033] tracking-tight block truncate">
                      {periodRevenue} <span className="text-xs font-bold text-[#5C4033]">{t('currency')}</span>
                    </strong>
                    <span className="text-xs font-bold text-[#69493C] block mt-0.5 truncate">
                      {isEn ? 'Total Collected' : 'إجمالي المحصل الفعلي'}
                    </span>
                  </div>
                </div>

                {/* Square Card 4: Remaining Dues */}
                <div className="classy-rose-card p-3.5 flex flex-col justify-between min-h-[112px] shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#B56B45] to-[#6B1E2B] text-[#FAF7F2] flex items-center justify-center shadow-md shadow-[#B56B45]/25 shrink-0">
                      <AlertCircle className="w-4.5 h-4.5" />
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border truncate ${
                      teacherSummary.totalRemaining > 0
                        ? 'bg-[#F8F2EA] text-[#B56B45] border-[#B6A89C]'
                        : 'bg-[#EADBC7]/65 text-[#5C4033] border-[#B68A4C]/50'
                    }`}>
                      {overdueStudentsList.length} {isEn ? 'students' : 'طلاب'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <strong
                      className={`text-xl sm:text-2xl font-black tracking-tight block truncate ${
                        teacherSummary.totalRemaining > 0 ? 'text-[#B56B45]' : 'text-[#5C4033]'
                      }`}
                    >
                      {teacherSummary.totalRemaining} <span className="text-xs font-bold">{t('currency')}</span>
                    </strong>
                    <span className="text-xs font-bold text-[#69493C] block mt-0.5 truncate">
                      {isEn ? 'Remaining Dues' : 'المستحقات المتبقية'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Methods Breakdown (2x2 Square Cards) */}
              <div className="classy-card p-4 bg-[#FAF7F2] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <PieChart className="w-4 h-4 text-[#6B1E2B] shrink-0" />
                    <h3 className="text-xs sm:text-sm font-black text-[#2F2F2F] truncate">
                      {isEn ? 'Collections by Payment Method' : 'توزيع التحصيل حسب طرق الدفع'}
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-[#69493C] shrink-0">
                    {periodRevenue} {t('currency')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {(Object.entries(methodStats) as [string, { label: string; amount: number; count: number; color: string }][])
                    .filter(([key, item]) => key !== 'other' || item.count > 0)
                    .map(([key, item]) => (
                    <div
                      key={key}
                      className="bg-[#F8F2EA] p-3.5 rounded-2xl border border-[#EADBC7] flex flex-col justify-between min-h-[84px]"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-bold text-[#69493C] truncate">
                          {item.label}
                        </span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#FAF7F2] text-[#2F2F2F] border border-[#EADBC7] shrink-0">
                          {item.count} {isEn ? 'pmts' : 'دفعات'}
                        </span>
                      </div>
                      <strong className="text-base sm:text-lg font-black text-[#2F2F2F] block truncate mt-1">
                        {item.amount} <span className="text-xs font-bold text-[#69493C]">{t('currency')}</span>
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive Billing Streams Progress (Lesson-Based vs Hourly Progress) */}
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

              {/* Interactive Attendance Trends Over Time Visualization */}
              <AttendanceTrendsChart
                sessions={sessions}
                allAttendance={allAttendanceRecords}
                students={students}
                groups={groups}
                periodFilter={periodFilter}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
              />
            </div>
          )}

          {/* Sub-Tab 1.2: Dedicated Billing Streams Visualization (Lessons vs Hours) */}
          {financialSubTab === 'billing_streams' && (
            <div className="space-y-4">
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
            </div>
          )}

          {/* Sub-Tab 1.5: Dedicated Attendance Trends & Analytics View */}
          {financialSubTab === 'attendance_trends' && (
            <div className="space-y-4">
              <AttendanceTrendsChart
                sessions={sessions}
                allAttendance={allAttendanceRecords}
                students={students}
                groups={groups}
                periodFilter={periodFilter}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
              />

              {/* Attendance Commitment Summary Cards (2x2 Square Grid) */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="classy-lavender-card p-3.5 flex flex-col justify-between min-h-[104px] shadow-xs">
                  <div className="flex items-center justify-between text-[#6B1E2B] text-[11px] font-bold">
                    <span className="truncate">{isEn ? 'Completed Lessons' : 'الحصص المنفذة'}</span>
                    <BarChart3 className="w-4 h-4 text-[#6B1E2B] shrink-0" />
                  </div>
                  <div>
                    <strong className="text-xl font-black text-[#2F2F2F] block">
                      {attendanceAnalytics.completedSessionsCount}
                    </strong>
                    <p className="text-[10px] text-[#69493C] font-bold truncate">
                      {attendanceAnalytics.completedAppointmentsCount} {isEn ? 'Appointments' : 'مواعيد فعلية'}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-[22px] bg-gradient-to-br from-[#FAF7F2] to-[#F8F2EA]/50 border border-[#B68A4C]/50 flex flex-col justify-between min-h-[104px] shadow-xs">
                  <div className="flex items-center justify-between text-[#69493C] text-[11px] font-bold">
                    <span className="truncate">{isEn ? 'Recorded Presences' : 'حالات الحضور'}</span>
                    <CheckCircle2 className="w-4 h-4 text-[#B68A4C] shrink-0" />
                  </div>
                  <div>
                    <strong className="text-xl font-black text-[#5C4033] block">
                      {attendanceAnalytics.presentCount + attendanceAnalytics.lateCount}
                    </strong>
                    <p className="text-[10px] text-[#69493C] font-bold truncate">
                      {isEn ? `${attendanceAnalytics.lateCount} late arrivals` : `${attendanceAnalytics.lateCount} حضور بتأخير`}
                    </p>
                  </div>
                </div>

                <div className="classy-rose-card p-3.5 flex flex-col justify-between min-h-[104px] shadow-xs">
                  <div className="flex items-center justify-between text-[#69493C] text-[11px] font-bold">
                    <span className="truncate">{isEn ? 'Charged Absences' : 'الغياب المحسوب'}</span>
                    <AlertCircle className="w-4 h-4 text-[#B56B45] shrink-0" />
                  </div>
                  <div>
                    <strong className="text-xl font-black text-[#B56B45] block">
                      {attendanceAnalytics.absentChargedCount}
                    </strong>
                    <p className="text-[10px] text-[#69493C] font-bold truncate">
                      {isEn ? 'Charged from balance' : 'مخصوم من الرصيد'}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-[22px] bg-gradient-to-br from-[#FAF7F2] to-[#F8F2EA] border border-[#EADBC7]/80 flex flex-col justify-between min-h-[104px] shadow-xs">
                  <div className="flex items-center justify-between text-[#69493C] text-[11px] font-bold">
                    <span className="truncate">{isEn ? 'Excused Absences' : 'الغياب المعفى'}</span>
                    <Sparkles className="w-4 h-4 text-[#B68A4C] shrink-0" />
                  </div>
                  <div>
                    <strong className="text-xl font-black text-[#B56B45] block">
                      {attendanceAnalytics.absentExcusedCount}
                    </strong>
                    <p className="text-[10px] text-[#69493C] font-bold truncate">
                      {isEn ? 'Without deduction' : 'بدون خصم مالي'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 2: Monthly Ledger */}
          {financialSubTab === 'monthly_ledger' && (
            <div className="classy-card p-4 sm:p-5 bg-[#FAF7F2] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-[#6B1E2B]" />
                  <h3 className="text-sm sm:text-base font-black text-[#2F2F2F]">
                    {isEn ? 'Historical Monthly Ledger' : 'السجل المالي الشهري التاريخي'}
                  </h3>
                </div>
              </div>

              {financialHistory.months.length === 0 ? (
                <div className="p-8 text-center text-[#69493C] text-xs">
                  {isEn ? 'No monthly records found yet' : 'لا توجد سجلات شهرية سابقة بعد'}
                </div>
              ) : (
                <div className="space-y-2">
                  {financialHistory.months.map((m) => (
                    <div
                      key={m.monthYear}
                      className="p-3 rounded-2xl bg-[#F8F2EA] border border-[#EADBC7] flex items-center justify-between gap-2"
                    >
                      <div className="font-bold text-xs sm:text-sm text-[#2F2F2F]">
                        {isEn ? `${getArabicMonthName(m.month)} ${m.year}` : `شهر ${getArabicMonthName(m.month)} ${m.year}`}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-[#5C4033] font-black">
                          {isEn ? 'Collected:' : 'المحصل:'} {m.totalCollected} {t('currency')}
                        </span>
                        <span className="text-[#69493C]">
                          {isEn ? 'Due:' : 'المستحق:'} {m.totalDue} {t('currency')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-Tab 3: Yearly Summary */}
          {financialSubTab === 'yearly_summary' && (
            <div className="classy-card p-4 sm:p-5 bg-[#FAF7F2] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#6B1E2B]" />
                  <h3 className="text-sm sm:text-base font-black text-[#2F2F2F]">
                    {isEn ? 'Annual Summary' : 'الملخص المالي السنوي'}
                  </h3>
                </div>
              </div>

              <div className="space-y-2">
                {financialHistory.years.map((y) => (
                  <div
                    key={y.year}
                    className="p-3.5 rounded-2xl bg-[#F8F2EA] border border-[#EADBC7] flex items-center justify-between gap-2"
                  >
                    <div className="font-black text-sm text-[#2F2F2F]">{isEn ? `Year ${y.year}` : `سنة ${y.year}`}</div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-[#5C4033] font-black">
                        {isEn ? 'Collected:' : 'المحصل:'} {y.totalCollected} {t('currency')}
                      </span>
                      <span className="text-[#69493C]">
                        {isEn ? 'Due:' : 'المستحق:'} {y.totalDue} {t('currency')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-Tab 4: Lifetime All-Time */}
          {financialSubTab === 'lifetime' && (
            <div className="classy-card p-5 bg-gradient-to-r from-[#6B1E2B] to-[#5C4033] text-[#FAF7F2] rounded-3xl space-y-3">
              <h3 className="font-black text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#B68A4C]" />
                <span>{isEn ? 'Lifetime All-Time Totals' : 'إجمالي كافة الفترات الشاملة (Lifetime)'}</span>
              </h3>
              <div className="grid grid-cols-2 gap-3 pt-2 text-center">
                <div className="bg-[#FAF7F2]/10 rounded-2xl p-3 border border-[#EADBC7]/15">
                  <span className="text-xs text-[#EADBC7]/80 block font-bold">{isEn ? 'Total All-Time Collected' : 'إجمالي ما تم تحصيله'}</span>
                  <span className="text-xl font-black text-[#EADBC7]">
                    {financialHistory.totalCollected} {t('currency')}
                  </span>
                </div>
                <div className="bg-[#FAF7F2]/10 rounded-2xl p-3 border border-[#EADBC7]/15">
                  <span className="text-xs text-[#EADBC7]/80 block font-bold">{isEn ? 'Total Expected' : 'إجمالي القيمة المستحقة'}</span>
                  <span className="text-xl font-black text-[#FAF7F2]">
                    {financialHistory.totalDue} {t('currency')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 5: Payments Audit */}
          {financialSubTab === 'payments' && (
            <div className="classy-card p-4 sm:p-5 bg-[#FAF7F2] space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#6B1E2B]" />
                  <h3 className="text-sm sm:text-base font-black text-[#2F2F2F]">
                    {isEn ? 'Recorded Payments Audit' : 'سجل المقبوضات والدفعات المفصل'}
                  </h3>
                </div>
                <span className="text-xs font-bold text-[#69493C]">
                  {filteredPayments.length} {isEn ? 'receipts' : 'إيصال'}
                </span>
              </div>

              {/* Payment Search Bar */}
              <div className="relative">
                <Search className={`w-4 h-4 text-[#69493C] absolute top-3 ${isRTL ? 'right-3' : 'left-3'}`} />
                <input
                  type="text"
                  placeholder={isEn ? 'Search receipts by student name or notes...' : 'البحث باسم الطالب أو الملاحظات في الإيصالات...'}
                  value={paymentSearchQuery}
                  onChange={(e) => setPaymentSearchQuery(e.target.value)}
                  className={`w-full bg-[#F8F2EA] border border-[#EADBC7] rounded-xl py-2 text-xs text-[#2F2F2F] placeholder-[#69493C]/70 focus:outline-none focus:border-[#6B1E2B] ${
                    isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'
                  }`}
                />
              </div>

              {filteredPayments.length === 0 ? (
                <div className="p-8 text-center text-[#69493C] text-xs">
                  {isEn ? 'No receipts recorded in this period' : 'لا توجد مقبوضات مسجلة في هذه الفترة'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPayments.map((p) => {
                    const st = students.find((s) => s.id === p.studentId);
                    return (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl bg-[#F8F2EA] border border-[#EADBC7] flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <strong className="font-bold text-[#2F2F2F] block truncate">
                            {st?.name || (isEn ? 'Unknown Student' : 'طالب غير محدد')}
                          </strong>
                          <span className="text-[11px] text-[#69493C] block">
                            {p.date} • {p.paymentMethod || 'cash'}
                          </span>
                        </div>
                        <span className="text-[#5C4033] font-black text-sm shrink-0">
                          +{p.amount} {t('currency')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          5. TAB 2: OVERDUE BALANCES & DUES DIRECTORY
          ========================================================================= */}
      {reportType === 'overdue_list' && (
        <div className="space-y-3.5">
          <div className="classy-card p-4 space-y-3 bg-[#FAF7F2]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#B56B45]" />
                <h3 className="text-sm sm:text-base font-black text-[#2F2F2F]">
                  {isEn ? 'Students with Overdue Balances' : 'كشف الطلاب المستحق عليهم مبالغ مالية'}
                </h3>
              </div>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#F8F2EA] text-[#B56B45] border border-[#B6A89C]">
                {overdueStudentsList.length} {isEn ? 'debtors' : 'طلاب'}
              </span>
            </div>

            <div className="relative">
              <Search className={`w-4 h-4 text-[#69493C] absolute top-3 ${isRTL ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                placeholder={isEn ? 'Search debtor students by name or phone...' : 'البحث في كشف المديونيات بالاسم أو الهاتف...'}
                value={overdueSearchQuery}
                onChange={(e) => setOverdueSearchQuery(e.target.value)}
                className={`w-full bg-[#F8F2EA] border border-[#EADBC7] rounded-xl py-2 text-xs text-[#2F2F2F] placeholder-[#69493C]/70 focus:outline-none focus:border-[#6B1E2B] ${
                  isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'
                }`}
              />
            </div>
          </div>

          {overdueStudentsList.length === 0 ? (
            <div className="classy-card p-8 text-center space-y-3 flex flex-col items-center bg-[#FAF7F2]">
              <div className="w-16 h-16 rounded-2xl bg-[#EADBC7]/65 flex items-center justify-center text-[#B68A4C]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-sm text-[#2F2F2F]">{isEn ? 'All Accounts Settled' : 'لا توجد مديونيات متأخرة'}</h3>
                <p className="text-xs text-[#69493C]">{isEn ? 'All students have paid their dues in full! 🎉' : 'جميع الطلاب سددوا مستحقاتهم بالكامل! 🎉'}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {overdueStudentsList.map(({ student, grandRemaining, grandTotalDue, grandTotalPaid }) => (
                <div
                  key={student.id}
                  className="classy-card p-3.5 sm:p-4 bg-[#FAF7F2] border border-[#B6A89C] flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StudentAvatar student={student} size="sm" showBadge={false} />
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm text-[#2F2F2F] truncate">{student.name}</h4>
                      <span className="text-[11px] text-[#69493C]">{student.phone || student.parentPhone || (isEn ? 'No phone' : 'بدون هاتف')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <strong className="text-sm font-black text-[#B56B45] block">
                        {grandRemaining} {t('currency')}
                      </strong>
                      <span className="text-[10px] text-[#69493C] block">
                        {isEn ? `Paid ${grandTotalPaid} of ${grandTotalDue}` : `سدد ${grandTotalPaid} من ${grandTotalDue}`}
                      </span>
                    </div>

                    {onOpenAddPayment && (
                      <button
                        type="button"
                        onClick={() => onOpenAddPayment(student)}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#6B1E2B] to-[#5C4033] text-[#FAF7F2] font-bold text-xs active:scale-95 transition-all cursor-pointer"
                      >
                        {isEn ? 'Collect' : 'تحصيل'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          6. TAB 3: GROUP PERFORMANCE DOSSIER
          ========================================================================= */}
      {reportType === 'group_report' && (
        <div className="space-y-3.5">
          <div className="classy-card p-4 space-y-2 bg-[#FAF7F2]">
            <label className="text-xs font-bold text-[#69493C] block">{isEn ? 'Select Group / Service:' : 'اختر المجموعة أو الخدمة للتحليل:'}</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#F8F2EA] border border-[#EADBC7] font-bold text-xs text-[#2F2F2F] focus:outline-none focus:border-[#6B1E2B]"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.subject} • {getLocalizedStageName(g.gradeLevel)})
                </option>
              ))}
            </select>
          </div>

          {selectedGroupFin && selectedGroupObj && (
            <div className="classy-card p-4 bg-[#FAF7F2] space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-[#2F2F2F] truncate">{selectedGroupObj.name}</h3>
                  <span className="text-xs text-[#69493C] block truncate">{selectedGroupObj.subject} • {getLocalizedStageName(selectedGroupObj.gradeLevel)}</span>
                </div>
              </div>

              {/* 2x2 Square Cards for Group Report */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#EADBC7]">
                <div className="p-3.5 bg-[#F8F2EA] rounded-2xl border border-[#EADBC7] flex flex-col justify-between min-h-[84px]">
                  <span className="text-[11px] text-[#69493C] block font-bold">{isEn ? 'Completed Lessons' : 'الحصص المنفذة'}</span>
                  <strong className="text-lg font-black text-[#6B1E2B] block mt-1">{selectedGroupFin.totalCompletedSessions ?? selectedGroupFin.completedSessionsCount}</strong>
                </div>
                <div className="p-3.5 bg-[#F8F2EA] rounded-2xl border border-[#EADBC7] flex flex-col justify-between min-h-[84px]">
                  <span className="text-[11px] text-[#69493C] block font-bold">{isEn ? 'Total Expected' : 'إجمالي المستحق'}</span>
                  <strong className="text-lg font-black text-[#2F2F2F] block truncate mt-1">{selectedGroupFin.totalDue ?? selectedGroupFin.totalExpectedRevenue} <span className="text-xs font-bold text-[#69493C]">{t('currency')}</span></strong>
                </div>
                <div className="p-3.5 bg-[#F8F2EA] rounded-2xl border border-[#B68A4C]/50 flex flex-col justify-between min-h-[84px]">
                  <span className="text-[11px] text-[#69493C] block font-bold">{isEn ? 'Collected' : 'المحصل الفعلي'}</span>
                  <strong className="text-lg font-black text-[#5C4033] block truncate mt-1">{selectedGroupFin.totalPaid ?? selectedGroupFin.totalRevenue} <span className="text-xs font-bold">{t('currency')}</span></strong>
                </div>
                <div className="p-3.5 bg-[#F8F2EA]/50 rounded-2xl border border-[#B6A89C] flex flex-col justify-between min-h-[84px]">
                  <span className="text-[11px] text-[#69493C] block font-bold">{isEn ? 'Remaining' : 'المتبقي'}</span>
                  <strong className="text-lg font-black text-[#B56B45] block truncate mt-1">{selectedGroupFin.remaining ?? selectedGroupFin.totalRemainingDues} <span className="text-xs font-bold">{t('currency')}</span></strong>
                </div>
              </div>

              {/* Group Attendance Trends Line Chart */}
              <AttendanceTrendsChart
                sessions={sessions}
                allAttendance={allAttendanceRecords}
                students={students}
                groups={groups}
                selectedGroupId={selectedGroupId}
                periodFilter={periodFilter}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
              />
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          7. TAB 4: INDIVIDUAL STUDENT DOSSIER
          ========================================================================= */}
      {reportType === 'student_report' && (
        <div className="space-y-3.5">
          <div className="classy-card p-4 space-y-2 bg-[#FAF7F2]">
            <label className="text-xs font-bold text-[#69493C] block">{isEn ? 'Select Student:' : 'اختر الطالب لعرض كشف الحساب والتقرير:'}</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#F8F2EA] border border-[#EADBC7] font-bold text-xs text-[#2F2F2F] focus:outline-none focus:border-[#6B1E2B]"
            >
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} {st.phone ? `(${st.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedStudentGrandFin && selectedStudentObj && (
            <div className="classy-card p-4 bg-[#FAF7F2] space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <StudentAvatar student={selectedStudentObj} size="md" />
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-black text-[#2F2F2F] truncate">{selectedStudentObj.name}</h3>
                    <span className="text-xs text-[#69493C] block truncate">{getLocalizedStageName(selectedStudentObj.gradeLevel)}</span>
                  </div>
                </div>

                {onOpenStudentProfile && (
                  <button
                    type="button"
                    onClick={() => onOpenStudentProfile(selectedStudentObj)}
                    className="px-3 py-1.5 rounded-xl bg-[#6B1E2B] text-[#FAF7F2] font-bold text-xs active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    {t('profile')}
                  </button>
                )}
              </div>

              {/* 2x2 Square Cards for Student Report */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#EADBC7]">
                <div className="p-3.5 bg-[#F8F2EA] rounded-2xl border border-[#EADBC7] flex flex-col justify-between min-h-[84px]">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-[#69493C] font-bold">{isEn ? 'Completed Lessons' : 'الحصص المنفذة'}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#EADBC7] text-[#6B1E2B] font-bold">
                      {selectedStudentGrandFin.grandAppointmentsCount} {isEn ? 'Appts' : 'مواعيد'}
                    </span>
                  </div>
                  <strong className="text-lg font-black text-[#6B1E2B] block mt-1">{selectedStudentGrandFin.grandCompletedLessons}</strong>
                </div>
                <div className="p-3.5 bg-[#F8F2EA] rounded-2xl border border-[#EADBC7] flex flex-col justify-between min-h-[84px]">
                  <span className="text-[11px] text-[#69493C] block font-bold">{isEn ? 'Grand Total Due' : 'إجمالي المطلوب'}</span>
                  <strong className="text-lg font-black text-[#2F2F2F] block truncate mt-1">{selectedStudentGrandFin.grandTotalDue} <span className="text-xs font-bold text-[#69493C]">{t('currency')}</span></strong>
                </div>
                <div className="p-3.5 bg-[#F8F2EA] rounded-2xl border border-[#B68A4C]/50 flex flex-col justify-between min-h-[84px]">
                  <span className="text-[11px] text-[#69493C] block font-bold">{isEn ? 'Paid' : 'المدفوع'}</span>
                  <strong className="text-lg font-black text-[#5C4033] block truncate mt-1">{selectedStudentGrandFin.grandTotalPaid} <span className="text-xs font-bold">{t('currency')}</span></strong>
                </div>
                <div className="p-3.5 bg-[#F8F2EA]/50 rounded-2xl border border-[#B6A89C] flex flex-col justify-between min-h-[84px]">
                  <span className="text-[11px] text-[#69493C] block font-bold">{isEn ? 'Remaining Due' : 'المتبقي'}</span>
                  <strong
                    className={`text-lg font-black block truncate mt-1 ${
                      selectedStudentGrandFin.grandRemaining > 0 ? 'text-[#B56B45]' : 'text-[#5C4033]'
                    }`}
                  >
                    {selectedStudentGrandFin.grandRemaining} <span className="text-xs font-bold">{t('currency')}</span>
                  </strong>
                </div>
              </div>

              {/* Student Attendance Trends Line Chart */}
              <AttendanceTrendsChart
                sessions={sessions}
                allAttendance={allAttendanceRecords}
                students={students}
                groups={groups}
                selectedStudentId={selectedStudentId}
                periodFilter={periodFilter}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
