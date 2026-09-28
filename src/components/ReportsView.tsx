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
} from 'lucide-react';
import { Student, Group, Session, Payment, ReportPeriodFilter, Enrollment } from '../types';
import { db, getArabicMonthName } from '../utils/storage';
import { getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';
import { ClassyOwlMascot } from './ClassyOwlMascot';
import { StudentAvatar } from './StudentAvatar';

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

  // Financial Sub-Tabs
  const [financialSubTab, setFinancialSubTab] = useState<
    'overview' | 'monthly_ledger' | 'yearly_summary' | 'lifetime' | 'payments'
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
    const allAtt = db.getAttendance();
    const periodSessions = sessions.filter((s) => {
      if (periodFilter === 'all_time') return true;
      if (periodFilter === 'today') return s.date === todayStr;
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

    const presentCount = relevantAtt.filter((a) => a.status === 'present').length;
    const lateCount = relevantAtt.filter((a) => a.status === 'late').length;
    const absentChargedCount = relevantAtt.filter(
      (a) => a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false)
    ).length;
    const absentExcusedCount = relevantAtt.filter(
      (a) => a.status === 'absent_free' || a.status === 'excused' || a.isCharged === false
    ).length;

    const totalAttCount = presentCount + lateCount + absentChargedCount + absentExcusedCount;
    const commitmentRate =
      totalAttCount > 0 ? Math.round(((presentCount + lateCount) / totalAttCount) * 100) : 100;

    return {
      totalSessions: periodSessions.length,
      completedSessionsCount: completedSessions.length,
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
      cash: { label: isEn ? 'Cash' : 'كاش (نقداً)', amount: 0, count: 0, color: '#10B981' },
      vodafone_cash: { label: isEn ? 'Vodafone Cash' : 'فودافون كاش', amount: 0, count: 0, color: '#FF647C' },
      instapay: { label: isEn ? 'InstaPay' : 'إنستاباي (InstaPay)', amount: 0, count: 0, color: '#55C7E8' },
      bank_transfer: { label: isEn ? 'Bank Transfer' : 'تحويل بنكي', amount: 0, count: 0, color: '#F59E0B' },
      other: { label: isEn ? 'Other' : 'أخرى', amount: 0, count: 0, color: '#74778F' },
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
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar p-3.5 sm:p-5 space-y-4 text-[#191A2E] pb-32 bg-[#F5F6FC] relative"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Ambient background glows matching Classy visual identity */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#7657F6]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-0 w-80 h-80 bg-[#55C7E8]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-[#FF647C]/6 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* =========================================================================
          1. REPORTS HERO HEADER
          ========================================================================= */}
      <div className="rounded-[24px] bg-gradient-to-r from-[#17163D] via-[#403B9C] to-[#7657F6] p-5 sm:p-6 text-white relative overflow-hidden shadow-xl border border-white/10">
        {/* Soft internal gradient orbs */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#7657F6]/35 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-[#FF647C]/30 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#FF647C] via-[#7657F6] to-[#55C7E8] p-0.5 shadow-lg shadow-[#7657F6]/35 shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#17163D] flex items-center justify-center text-white">
                <BarChart3 className="w-6 h-6 text-[#55C7E8]" />
              </div>
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#E8E7FF]/90 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#55C7E8]" />
                  <span>{isEn ? 'Financial Analytics & Audit Center' : 'مركز التحليلات والكشوف المالية'}</span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5 truncate">
                <span>{t('reportsTitle')}</span>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/20 shadow-xs">
                  {currentPeriodLabel}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-[#E8E7FF]/85 font-medium truncate">
                {isEn ? 'Track your student performance, attendance rates, revenues, and dues accurately.' : 'تابع أداء طلابك، ونسب الحضور، وإيراداتك ومستحقاتك المالية بدقة متناهية.'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/15 justify-end">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-2xl bg-white text-[#17163D] font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md hover:bg-[#F5F6FC] transition-all active:scale-95 cursor-pointer"
              title={isEn ? 'Print Statement' : 'طباعة التقرير والكشف المالي'}
            >
              <Printer className="w-4 h-4 text-[#7657F6]" />
              <span>{isEn ? 'Print Statement' : 'طباعة الكشف'}</span>
            </button>
          </div>
        </div>

        {/* Compact Hero KPIs Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 mt-4 border-t border-white/15 text-center">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 border border-white/10">
            <span className="text-[10px] text-[#E8E7FF]/80 block font-bold">{isEn ? 'Collected in Period' : 'المحصل بالفترة'}</span>
            <span className="text-base sm:text-lg font-black text-emerald-300">
              {periodRevenue} <span className="text-[10px] text-emerald-200">{t('currency')}</span>
            </span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 border border-white/10">
            <span className="text-[10px] text-[#E8E7FF]/80 block font-bold">{isEn ? 'Remaining Dues' : 'المستحقات المتبقية'}</span>
            <span
              className={`text-base sm:text-lg font-black ${
                teacherSummary.totalRemaining > 0 ? 'text-[#FF647C]' : 'text-emerald-300'
              }`}
            >
              {teacherSummary.totalRemaining} <span className="text-[10px]">{t('currency')}</span>
            </span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 border border-white/10">
            <span className="text-[10px] text-[#E8E7FF]/80 block font-bold">{isEn ? 'Completed Sessions' : 'الحصص المنفذة'}</span>
            <span className="text-base sm:text-lg font-black text-[#55C7E8]">
              {attendanceAnalytics.completedSessionsCount}
            </span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 border border-white/10">
            <span className="text-[10px] text-[#E8E7FF]/80 block font-bold">{isEn ? 'Attendance Rate' : 'نسبة الالتزام والحضور'}</span>
            <span className="text-base sm:text-lg font-black text-white">
              {attendanceAnalytics.commitmentRate}%
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. MAIN REPORT NAVIGATION (Segmented Bar)
          ========================================================================= */}
      <div className="classy-card p-1.5 flex items-center gap-1.5 bg-white">
        <button
          type="button"
          onClick={() => setReportType('teacher_overview')}
          className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            reportType === 'teacher_overview'
              ? 'bg-gradient-to-r from-[#17163D] to-[#403B9C] text-white shadow-md shadow-[#17163D]/20'
              : 'text-[#74778F] hover:text-[#17163D] hover:bg-[#F6F7FC]'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>{isEn ? 'Executive & Finance' : 'اللوحة المالية الشاملة'}</span>
        </button>

        <button
          type="button"
          onClick={() => setReportType('overdue_list')}
          className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            reportType === 'overdue_list'
              ? 'bg-gradient-to-r from-[#17163D] to-[#403B9C] text-white shadow-md shadow-[#17163D]/20'
              : 'text-[#74778F] hover:text-[#17163D] hover:bg-[#F6F7FC]'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>{isEn ? 'Dues & Overdue' : 'المستحقات والمديونيات'}</span>
          <span
            className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
              reportType === 'overdue_list'
                ? 'bg-white/20 text-white'
                : 'bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]'
            }`}
          >
            {overdueStudentsList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setReportType('group_report')}
          className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            reportType === 'group_report'
              ? 'bg-gradient-to-r from-[#17163D] to-[#403B9C] text-white shadow-md shadow-[#17163D]/20'
              : 'text-[#74778F] hover:text-[#17163D] hover:bg-[#F6F7FC]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{isEn ? 'Group Reports' : 'تقارير المجموعات'}</span>
        </button>

        <button
          type="button"
          onClick={() => setReportType('student_report')}
          className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            reportType === 'student_report'
              ? 'bg-gradient-to-r from-[#17163D] to-[#403B9C] text-white shadow-md shadow-[#17163D]/20'
              : 'text-[#74778F] hover:text-[#17163D] hover:bg-[#F6F7FC]'
          }`}
        >
          <User className="w-4 h-4" />
          <span>{isEn ? 'Student Dossier' : 'تقارير الطلاب'}</span>
        </button>
      </div>

      {/* =========================================================================
          3. TIME PERIOD FILTER BAR (Universal)
          ========================================================================= */}
      {reportType !== 'overdue_list' && (
        <div className="classy-card p-3.5 space-y-3 bg-white">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-[#17163D] font-black text-xs">
              <Filter className="w-4 h-4 text-[#7657F6]" />
              <span>{isEn ? 'Report Period:' : 'تحديد الفترة الزمنية للتقرير:'}</span>
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              {[
                { key: 'this_month', label: isEn ? 'This Month' : 'هذا الشهر' },
                { key: 'last_month', label: isEn ? 'Last Month' : 'الشهر الماضي' },
                { key: 'last_7_days', label: isEn ? 'Last 7 Days' : 'آخر 7 أيام' },
                { key: 'today', label: isEn ? 'Today' : 'اليوم' },
                { key: 'all_time', label: isEn ? 'All Time' : 'كل الوقت' },
                { key: 'specific_month', label: isEn ? 'Specific Month' : 'شهر محدد' },
                { key: 'custom_range', label: isEn ? 'Custom Range' : 'فترة مخصصة' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setPeriodFilter(tab.key as ReportPeriodFilter)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    periodFilter === tab.key
                      ? 'bg-[#17163D] text-white shadow-xs'
                      : 'bg-[#F6F7FC] text-[#74778F] border border-[#E8E7FF] hover:bg-[#E8E7FF]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Extended controls for specific month or custom range */}
          {periodFilter === 'specific_month' && (
            <div className="flex items-center gap-2 pt-2 border-t border-[#E8E7FF] flex-wrap">
              <span className="text-[#74778F] text-xs font-bold">{isEn ? 'Select Month & Year:' : 'اختر الشهر والسنة:'}</span>
              <select
                value={selectedSpecificMonth}
                onChange={(e) => setSelectedSpecificMonth(Number(e.target.value))}
                className="p-2 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] font-bold text-xs text-[#17163D] focus:outline-none focus:border-[#7657F6]"
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
                className="p-2 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] font-bold text-xs text-[#17163D] focus:outline-none focus:border-[#7657F6]"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#E8E7FF]">
              <div>
                <span className="text-[#74778F] text-[11px] block font-bold mb-1">{isEn ? 'From Date:' : 'من تاريخ:'}</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] text-xs font-bold text-[#17163D] focus:outline-none focus:border-[#7657F6]"
                />
              </div>
              <div>
                <span className="text-[#74778F] text-[11px] block font-bold mb-1">{isEn ? 'To Date:' : 'إلى تاريخ:'}</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] text-xs font-bold text-[#17163D] focus:outline-none focus:border-[#7657F6]"
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
          {/* Sub-Navigation Strip & Group vs Private Filter */}
          <div className="classy-card p-2 flex items-center justify-between flex-wrap gap-2 bg-white">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setFinancialSubTab('overview')}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  financialSubTab === 'overview'
                    ? 'bg-[#17163D] text-white shadow-xs'
                    : 'text-[#74778F] hover:bg-[#F6F7FC] hover:text-[#17163D]'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{isEn ? 'Overview' : 'نظرة عامة'}</span>
              </button>

              <button
                type="button"
                onClick={() => setFinancialSubTab('monthly_ledger')}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  financialSubTab === 'monthly_ledger'
                    ? 'bg-[#17163D] text-white shadow-xs'
                    : 'text-[#74778F] hover:bg-[#F6F7FC] hover:text-[#17163D]'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>{isEn ? `Monthly Ledger (${financialHistory.months.length})` : `السجل الشهري (${financialHistory.months.length})`}</span>
              </button>

              <button
                type="button"
                onClick={() => setFinancialSubTab('yearly_summary')}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  financialSubTab === 'yearly_summary'
                    ? 'bg-[#17163D] text-white shadow-xs'
                    : 'text-[#74778F] hover:bg-[#F6F7FC] hover:text-[#17163D]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{isEn ? `Annual Breakdown (${financialHistory.years.length})` : `السجل السنوي (${financialHistory.years.length})`}</span>
              </button>

              <button
                type="button"
                onClick={() => setFinancialSubTab('lifetime')}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  financialSubTab === 'lifetime'
                    ? 'bg-[#17163D] text-white shadow-xs'
                    : 'text-[#74778F] hover:bg-[#F6F7FC] hover:text-[#17163D]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isEn ? 'Lifetime (All-Time)' : 'الإجمالي الشامل (All-Time)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setFinancialSubTab('payments')}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  financialSubTab === 'payments'
                    ? 'bg-[#17163D] text-white shadow-xs'
                    : 'text-[#74778F] hover:bg-[#F6F7FC] hover:text-[#17163D]'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>{isEn ? `Payments Audit (${filteredPayments.length})` : `سجل المقبوضات (${filteredPayments.length})`}</span>
              </button>
            </div>

            {/* Group vs Private Segmented Control */}
            <div className="flex items-center gap-1 bg-[#F6F7FC] p-1 rounded-xl border border-[#E8E7FF]">
              <span className="text-[10px] text-[#74778F] font-bold px-1.5">{isEn ? 'Service:' : 'الخدمة:'}</span>
              <button
                type="button"
                onClick={() => setServiceTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  serviceTypeFilter === 'all'
                    ? 'bg-[#17163D] text-white shadow-2xs'
                    : 'text-[#74778F] hover:text-[#17163D]'
                }`}
              >
                {t('all')}
              </button>
              <button
                type="button"
                onClick={() => setServiceTypeFilter('group')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  serviceTypeFilter === 'group'
                    ? 'bg-[#17163D] text-white shadow-2xs'
                    : 'text-[#74778F] hover:text-[#17163D]'
                }`}
              >
                {isEn ? 'Groups' : 'مجموعات'}
              </button>
              <button
                type="button"
                onClick={() => setServiceTypeFilter('private')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  serviceTypeFilter === 'private'
                    ? 'bg-[#17163D] text-white shadow-2xs'
                    : 'text-[#74778F] hover:text-[#17163D]'
                }`}
              >
                {isEn ? 'Private' : 'خاص'}
              </button>
            </div>
          </div>

          {/* Sub-Tab 1: Overview Dashboard */}
          {financialSubTab === 'overview' && (
            <div className="space-y-4">
              {/* Financial KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="classy-card p-4.5 bg-gradient-to-br from-white to-emerald-50/50 border border-emerald-200/80 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#74778F]">{isEn ? 'Total Expected Value' : 'إجمالي القيمة المستحقة'}</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <strong className="text-xl sm:text-2xl font-black text-[#17163D]">
                      {teacherSummary.totalDue} <span className="text-xs font-bold text-[#74778F]">{t('currency')}</span>
                    </strong>
                    <p className="text-[11px] text-[#74778F] font-medium mt-1">
                      {isEn ? 'Value of completed sessions and subscriptions' : 'قيمة الحصص والاشتراكات المنفذة بالفترة'}
                    </p>
                  </div>
                </div>

                <div className="classy-card p-4.5 bg-gradient-to-br from-white to-[#E8E7FF]/40 border border-[#E8E7FF] shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#74778F]">{isEn ? 'Total Collected' : 'إجمالي المحصل الفعلي'}</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-700">
                      <Wallet className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <strong className="text-xl sm:text-2xl font-black text-emerald-700">
                      {periodRevenue} <span className="text-xs font-bold text-emerald-800">{t('currency')}</span>
                    </strong>
                    <p className="text-[11px] text-[#74778F] font-medium mt-1">
                      {isEn ? `${filteredPayments.length} recorded payments` : `${filteredPayments.length} دفعة مالية مقيدة`}
                    </p>
                  </div>
                </div>

                <div className="classy-card p-4.5 bg-gradient-to-br from-white to-[#FFF1F3]/40 border border-[#FECDD3] shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#74778F]">{isEn ? 'Remaining Dues' : 'المستحقات المتبقية في ذمة الطلاب'}</span>
                    <div className="w-8 h-8 rounded-xl bg-[#FF647C]/15 flex items-center justify-center text-[#FF647C]">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <strong
                      className={`text-xl sm:text-2xl font-black ${
                        teacherSummary.totalRemaining > 0 ? 'text-[#FF647C]' : 'text-emerald-700'
                      }`}
                    >
                      {teacherSummary.totalRemaining} <span className="text-xs font-bold">{t('currency')}</span>
                    </strong>
                    <p className="text-[11px] text-[#74778F] font-medium mt-1">
                      {isEn ? `${overdueStudentsList.length} students have dues` : `${overdueStudentsList.length} طالب لديهم مستحقات متأخرة`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Methods Breakdown */}
              <div className="classy-card p-4 sm:p-5 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-[#7657F6]" />
                    <h3 className="text-sm sm:text-base font-black text-[#17163D]">
                      {isEn ? 'Collections by Payment Method' : 'توزيع التحصيل حسب طرق الدفع'}
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-[#74778F]">
                    {isEn ? 'Total:' : 'الإجمالي:'} {periodRevenue} {t('currency')}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(Object.entries(methodStats) as [string, { label: string; amount: number; count: number; color: string }][]).map(([key, item]) => (
                    <div
                      key={key}
                      className="bg-[#F6F7FC] p-3 rounded-2xl border border-[#E8E7FF] space-y-1 text-center"
                    >
                      <span className="text-[11px] font-bold text-[#74778F] block truncate">
                        {item.label}
                      </span>
                      <strong className="text-sm sm:text-base font-black text-[#17163D] block">
                        {item.amount} {t('currency')}
                      </strong>
                      <span className="text-[10px] text-[#74778F] block font-medium">
                        {item.count} {isEn ? 'payments' : 'دفعات'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 2: Monthly Ledger */}
          {financialSubTab === 'monthly_ledger' && (
            <div className="classy-card p-4 sm:p-5 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-[#7657F6]" />
                  <h3 className="text-sm sm:text-base font-black text-[#17163D]">
                    {isEn ? 'Historical Monthly Ledger' : 'السجل المالي الشهري التاريخي'}
                  </h3>
                </div>
              </div>

              {financialHistory.months.length === 0 ? (
                <div className="p-8 text-center text-[#74778F] text-xs">
                  {isEn ? 'No monthly records found yet' : 'لا توجد سجلات شهرية سابقة بعد'}
                </div>
              ) : (
                <div className="space-y-2">
                  {financialHistory.months.map((m) => (
                    <div
                      key={m.monthYear}
                      className="p-3 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF] flex items-center justify-between gap-2"
                    >
                      <div className="font-bold text-xs sm:text-sm text-[#17163D]">
                        {isEn ? `${getArabicMonthName(m.month)} ${m.year}` : `شهر ${getArabicMonthName(m.month)} ${m.year}`}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-emerald-700 font-black">
                          {isEn ? 'Collected:' : 'المحصل:'} {m.totalCollected} {t('currency')}
                        </span>
                        <span className="text-[#74778F]">
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
            <div className="classy-card p-4 sm:p-5 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#7657F6]" />
                  <h3 className="text-sm sm:text-base font-black text-[#17163D]">
                    {isEn ? 'Annual Summary' : 'الملخص المالي السنوي'}
                  </h3>
                </div>
              </div>

              <div className="space-y-2">
                {financialHistory.years.map((y) => (
                  <div
                    key={y.year}
                    className="p-3.5 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF] flex items-center justify-between gap-2"
                  >
                    <div className="font-black text-sm text-[#17163D]">{isEn ? `Year ${y.year}` : `سنة ${y.year}`}</div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-emerald-700 font-black">
                        {isEn ? 'Collected:' : 'المحصل:'} {y.totalCollected} {t('currency')}
                      </span>
                      <span className="text-[#74778F]">
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
            <div className="classy-card p-5 bg-gradient-to-r from-[#17163D] to-[#403B9C] text-white rounded-3xl space-y-3">
              <h3 className="font-black text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#55C7E8]" />
                <span>{isEn ? 'Lifetime All-Time Totals' : 'إجمالي كافة الفترات الشاملة (Lifetime)'}</span>
              </h3>
              <div className="grid grid-cols-2 gap-3 pt-2 text-center">
                <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                  <span className="text-xs text-[#E8E7FF]/80 block font-bold">{isEn ? 'Total All-Time Collected' : 'إجمالي ما تم تحصيله'}</span>
                  <span className="text-xl font-black text-emerald-300">
                    {financialHistory.totalCollected} {t('currency')}
                  </span>
                </div>
                <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                  <span className="text-xs text-[#E8E7FF]/80 block font-bold">{isEn ? 'Total Expected' : 'إجمالي القيمة المستحقة'}</span>
                  <span className="text-xl font-black text-white">
                    {financialHistory.totalDue} {t('currency')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 5: Payments Audit */}
          {financialSubTab === 'payments' && (
            <div className="classy-card p-4 sm:p-5 bg-white space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#7657F6]" />
                  <h3 className="text-sm sm:text-base font-black text-[#17163D]">
                    {isEn ? 'Recorded Payments Audit' : 'سجل المقبوضات والدفعات المفصل'}
                  </h3>
                </div>
                <span className="text-xs font-bold text-[#74778F]">
                  {filteredPayments.length} {isEn ? 'receipts' : 'إيصال'}
                </span>
              </div>

              {/* Payment Search Bar */}
              <div className="relative">
                <Search className={`w-4 h-4 text-[#74778F] absolute top-3 ${isRTL ? 'right-3' : 'left-3'}`} />
                <input
                  type="text"
                  placeholder={isEn ? 'Search receipts by student name or notes...' : 'البحث باسم الطالب أو الملاحظات في الإيصالات...'}
                  value={paymentSearchQuery}
                  onChange={(e) => setPaymentSearchQuery(e.target.value)}
                  className={`w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl py-2 text-xs text-[#191A2E] placeholder-[#74778F]/70 focus:outline-none focus:border-[#7657F6] ${
                    isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'
                  }`}
                />
              </div>

              {filteredPayments.length === 0 ? (
                <div className="p-8 text-center text-[#74778F] text-xs">
                  {isEn ? 'No receipts recorded in this period' : 'لا توجد مقبوضات مسجلة في هذه الفترة'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPayments.map((p) => {
                    const st = students.find((s) => s.id === p.studentId);
                    return (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <strong className="font-bold text-[#17163D] block truncate">
                            {st?.name || (isEn ? 'Unknown Student' : 'طالب غير محدد')}
                          </strong>
                          <span className="text-[11px] text-[#74778F] block">
                            {p.date} • {p.paymentMethod || 'cash'}
                          </span>
                        </div>
                        <span className="text-emerald-700 font-black text-sm shrink-0">
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
          <div className="classy-card p-4 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#FF647C]" />
                <h3 className="text-sm sm:text-base font-black text-[#17163D]">
                  {isEn ? 'Students with Overdue Balances' : 'كشف الطلاب المستحق عليهم مبالغ مالية'}
                </h3>
              </div>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]">
                {overdueStudentsList.length} {isEn ? 'debtors' : 'طلاب'}
              </span>
            </div>

            <div className="relative">
              <Search className={`w-4 h-4 text-[#74778F] absolute top-3 ${isRTL ? 'right-3' : 'left-3'}`} />
              <input
                type="text"
                placeholder={isEn ? 'Search debtor students by name or phone...' : 'البحث في كشف المديونيات بالاسم أو الهاتف...'}
                value={overdueSearchQuery}
                onChange={(e) => setOverdueSearchQuery(e.target.value)}
                className={`w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl py-2 text-xs text-[#191A2E] placeholder-[#74778F]/70 focus:outline-none focus:border-[#7657F6] ${
                  isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'
                }`}
              />
            </div>
          </div>

          {overdueStudentsList.length === 0 ? (
            <div className="classy-card p-8 text-center space-y-3 flex flex-col items-center bg-white">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-sm text-[#17163D]">{isEn ? 'All Accounts Settled' : 'لا توجد مديونيات متأخرة'}</h3>
                <p className="text-xs text-[#74778F]">{isEn ? 'All students have paid their dues in full! 🎉' : 'جميع الطلاب سددوا مستحقاتهم بالكامل! 🎉'}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {overdueStudentsList.map(({ student, grandRemaining, grandTotalDue, grandTotalPaid }) => (
                <div
                  key={student.id}
                  className="classy-card p-3.5 sm:p-4 bg-white border border-[#FECDD3] flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StudentAvatar student={student} size="sm" showBadge={false} />
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm text-[#17163D] truncate">{student.name}</h4>
                      <span className="text-[11px] text-[#74778F]">{student.phone || student.parentPhone || (isEn ? 'No phone' : 'بدون هاتف')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <strong className="text-sm font-black text-[#FF647C] block">
                        {grandRemaining} {t('currency')}
                      </strong>
                      <span className="text-[10px] text-[#74778F] block">
                        {isEn ? `Paid ${grandTotalPaid} of ${grandTotalDue}` : `سدد ${grandTotalPaid} من ${grandTotalDue}`}
                      </span>
                    </div>

                    {onOpenAddPayment && (
                      <button
                        type="button"
                        onClick={() => onOpenAddPayment(student)}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FF647C] to-[#7657F6] text-white font-bold text-xs active:scale-95 transition-all cursor-pointer"
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
          <div className="classy-card p-4 space-y-2 bg-white">
            <label className="text-xs font-bold text-[#74778F] block">{isEn ? 'Select Group / Service:' : 'اختر المجموعة أو الخدمة للتحليل:'}</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] font-bold text-xs text-[#17163D] focus:outline-none focus:border-[#7657F6]"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.subject} • {getLocalizedStageName(g.gradeLevel)})
                </option>
              ))}
            </select>
          </div>

          {selectedGroupFin && selectedGroupObj && (
            <div className="classy-card p-4 sm:p-5 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-[#17163D]">{selectedGroupObj.name}</h3>
                  <span className="text-xs text-[#74778F]">{selectedGroupObj.subject} • {getLocalizedStageName(selectedGroupObj.gradeLevel)}</span>
                </div>
                <span className="text-xs font-black px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {selectedGroupFin.totalRevenue} {t('currency')} {isEn ? 'collected' : 'محصل'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-[#E8E7FF]">
                <div className="p-2 bg-[#F6F7FC] rounded-xl">
                  <span className="text-[10px] text-[#74778F] block font-bold">{isEn ? 'Total Expected' : 'المستحق'}</span>
                  <strong className="font-black text-[#17163D]">{selectedGroupFin.totalExpectedRevenue} {t('currency')}</strong>
                </div>
                <div className="p-2 bg-[#F6F7FC] rounded-xl">
                  <span className="text-[10px] text-[#74778F] block font-bold">{isEn ? 'Remaining' : 'المتبقي'}</span>
                  <strong className="font-black text-[#FF647C]">{selectedGroupFin.totalRemainingDues} {t('currency')}</strong>
                </div>
                <div className="p-2 bg-[#F6F7FC] rounded-xl">
                  <span className="text-[10px] text-[#74778F] block font-bold">{isEn ? 'Completed Sessions' : 'الحصص'}</span>
                  <strong className="font-black text-[#7657F6]">{selectedGroupFin.completedSessionsCount}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          7. TAB 4: INDIVIDUAL STUDENT DOSSIER
          ========================================================================= */}
      {reportType === 'student_report' && (
        <div className="space-y-3.5">
          <div className="classy-card p-4 space-y-2 bg-white">
            <label className="text-xs font-bold text-[#74778F] block">{isEn ? 'Select Student:' : 'اختر الطالب لعرض كشف الحساب والتقرير:'}</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] font-bold text-xs text-[#17163D] focus:outline-none focus:border-[#7657F6]"
            >
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} {st.phone ? `(${st.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedStudentGrandFin && selectedStudentObj && (
            <div className="classy-card p-4 sm:p-5 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StudentAvatar student={selectedStudentObj} size="md" />
                  <div>
                    <h3 className="text-base font-black text-[#17163D]">{selectedStudentObj.name}</h3>
                    <span className="text-xs text-[#74778F]">{getLocalizedStageName(selectedStudentObj.gradeLevel)}</span>
                  </div>
                </div>

                {onOpenStudentProfile && (
                  <button
                    type="button"
                    onClick={() => onOpenStudentProfile(selectedStudentObj)}
                    className="px-3 py-1.5 rounded-xl bg-[#17163D] text-white font-bold text-xs active:scale-95 transition-all cursor-pointer"
                  >
                    {t('profile')}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-[#E8E7FF]">
                <div className="p-2 bg-[#F6F7FC] rounded-xl">
                  <span className="text-[10px] text-[#74778F] block font-bold">{isEn ? 'Grand Total Due' : 'المطلوب'}</span>
                  <strong className="font-black text-[#17163D]">{selectedStudentGrandFin.grandTotalDue} {t('currency')}</strong>
                </div>
                <div className="p-2 bg-[#F6F7FC] rounded-xl">
                  <span className="text-[10px] text-[#74778F] block font-bold">{isEn ? 'Paid' : 'المدفوع'}</span>
                  <strong className="font-black text-emerald-700">{selectedStudentGrandFin.grandTotalPaid} {t('currency')}</strong>
                </div>
                <div className="p-2 bg-[#F6F7FC] rounded-xl">
                  <span className="text-[10px] text-[#74778F] block font-bold">{isEn ? 'Remaining Due' : 'المتبقي'}</span>
                  <strong
                    className={`font-black ${
                      selectedStudentGrandFin.grandRemaining > 0 ? 'text-[#FF647C]' : 'text-emerald-700'
                    }`}
                  >
                    {selectedStudentGrandFin.grandRemaining} {t('currency')}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
