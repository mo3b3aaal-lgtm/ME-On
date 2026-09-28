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
  const currentMonth = useMemo(() => new Date().getMonth() + 1, []);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Main Navigation Tabs: 1. اللوحة التنفيذية والمالية | 2. سجل المستحقات والمديونيات | 3. تقارير المجموعات | 4. تقارير الطلاب والدروس الخاصة
  const [reportType, setReportType] = useState<
    'teacher_overview' | 'overdue_list' | 'group_report' | 'student_report'
  >('teacher_overview');

  // Filter Period
  const [periodFilter, setPeriodFilter] = useState<ReportPeriodFilter>('this_month');
  const [selectedSpecificMonth, setSelectedSpecificMonth] = useState<number>(currentMonth);
  const [selectedSpecificYear, setSelectedSpecificYear] = useState<number>(currentYear);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Financial Sub-Tabs: 'overview' | 'monthly_ledger' | 'yearly_summary' | 'lifetime' | 'payments'
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
    const today = new Date();
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
      cash: { label: 'كاش (نقداً)', amount: 0, count: 0, color: '#10B981' },
      vodafone_cash: { label: 'فودافون كاش', amount: 0, count: 0, color: '#FF647C' },
      instapay: { label: 'إنستاباي (InstaPay)', amount: 0, count: 0, color: '#55C7E8' },
      bank_transfer: { label: 'تحويل بنكي', amount: 0, count: 0, color: '#F59E0B' },
      other: { label: 'أخرى', amount: 0, count: 0, color: '#74778F' },
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
  }, [filteredPayments]);

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

  // Top Performing / Attention Students
  const attentionInsights = useMemo(() => {
    const activeList = students.filter((s) => s.status !== 'archived');
    const topDebtors = overdueStudentsList.slice(0, 3);
    const completedPackages: { student: Student; groupName: string; remaining: number }[] = [];

    activeEnrollments.forEach((enr) => {
      if (enr.billingMode === 'package' || enr.billingType === 'package') {
        const student = students.find((s) => s.id === enr.studentId);
        const group = groups.find((g) => g.id === enr.groupId);
        if (student && (enr.sessionCredit || 0) <= 1) {
          completedPackages.push({
            student,
            groupName: group?.name || 'باقة حصص',
            remaining: enr.sessionCredit || 0,
          });
        }
      }
    });

    return {
      topDebtors,
      completedPackages,
    };
  }, [students, overdueStudentsList, activeEnrollments, groups]);

  const handlePrint = () => {
    window.print();
  };

  // Period Display Label for Header
  const currentPeriodLabel = useMemo(() => {
    if (periodFilter === 'all_time') return 'كافة الفترات (All Time)';
    if (periodFilter === 'today') return `اليوم (${todayStr})`;
    if (periodFilter === 'last_7_days') return 'آخر 7 أيام';
    if (periodFilter === 'this_month') return `شهر ${getArabicMonthName(currentMonth)} ${currentYear}`;
    if (periodFilter === 'last_month') {
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      return `شهر ${getArabicMonthName(lastMonth)} ${lastYear}`;
    }
    if (periodFilter === 'specific_month') {
      return `شهر ${getArabicMonthName(selectedSpecificMonth)} ${selectedSpecificYear}`;
    }
    if (periodFilter === 'custom_range') {
      return `من ${customStartDate || '...'} إلى ${customEndDate || '...'}`;
    }
    return 'هذا الشهر';
  }, [
    periodFilter,
    todayStr,
    currentMonth,
    currentYear,
    selectedSpecificMonth,
    selectedSpecificYear,
    customStartDate,
    customEndDate,
  ]);

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar p-3.5 sm:p-5 space-y-4 text-[#191A2E] pb-32 bg-[#F5F6FC] relative"
      dir="rtl"
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
                  <span>مركز التحليلات والكشوف المالية</span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5 truncate">
                <span>التقارير</span>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/20 shadow-xs">
                  {currentPeriodLabel}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-[#E8E7FF]/85 font-medium truncate">
                تابع أداء طلابك، ونسب الحضور، وإيراداتك ومستحقاتك المالية بدقة متناهية.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/15 justify-end">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-2xl bg-white text-[#17163D] font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md hover:bg-[#F5F6FC] transition-all active:scale-95 cursor-pointer"
              title="طباعة التقرير والكشف المالي"
            >
              <Printer className="w-4 h-4 text-[#7657F6]" />
              <span>طباعة الكشف</span>
            </button>
          </div>
        </div>

        {/* Compact Hero KPIs Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 mt-4 border-t border-white/15 text-center">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 border border-white/10">
            <span className="text-[10px] text-[#E8E7FF]/80 block font-bold">المحصل بالفترة</span>
            <span className="text-base sm:text-lg font-black text-emerald-300">
              {periodRevenue} <span className="text-[10px] text-emerald-200">ج.م</span>
            </span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 border border-white/10">
            <span className="text-[10px] text-[#E8E7FF]/80 block font-bold">المستحقات المتبقية</span>
            <span
              className={`text-base sm:text-lg font-black ${
                teacherSummary.totalRemaining > 0 ? 'text-[#FF647C]' : 'text-emerald-300'
              }`}
            >
              {teacherSummary.totalRemaining} <span className="text-[10px]">ج.م</span>
            </span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 border border-white/10">
            <span className="text-[10px] text-[#E8E7FF]/80 block font-bold">الحصص المنفذة</span>
            <span className="text-base sm:text-lg font-black text-[#55C7E8]">
              {attendanceAnalytics.completedSessionsCount}
            </span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 border border-white/10">
            <span className="text-[10px] text-[#E8E7FF]/80 block font-bold">نسبة الالتزام والحضور</span>
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
          <span>اللوحة المالية الشاملة</span>
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
          <span>المستحقات والمديونيات</span>
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
          <span>تقارير المجموعات</span>
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
          <span>تقارير الطلاب</span>
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
              <span>تحديد الفترة الزمنية للتقرير:</span>
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              {[
                { key: 'this_month', label: 'هذا الشهر' },
                { key: 'last_month', label: 'الشهر الماضي' },
                { key: 'last_7_days', label: 'آخر 7 أيام' },
                { key: 'today', label: 'اليوم' },
                { key: 'all_time', label: 'كل الوقت' },
                { key: 'specific_month', label: 'شهر محدد' },
                { key: 'custom_range', label: 'فترة مخصصة' },
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
              <span className="text-[#74778F] text-xs font-bold">اختر الشهر والسنة:</span>
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
                <span className="text-[#74778F] text-[11px] block font-bold mb-1">من تاريخ:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] text-xs font-bold text-[#17163D] focus:outline-none focus:border-[#7657F6]"
                />
              </div>
              <div>
                <span className="text-[#74778F] text-[11px] block font-bold mb-1">إلى تاريخ:</span>
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
                <span>نظرة عامة</span>
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
                <span>السجل الشهري ({financialHistory.months.length})</span>
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
                <span>السجل السنوي ({financialHistory.years.length})</span>
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
                <span>الإجمالي الشامل (All-Time)</span>
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
                <span>سجل المقبوضات ({filteredPayments.length})</span>
              </button>
            </div>

            {/* Group vs Private Segmented Control */}
            <div className="flex items-center gap-1 bg-[#F6F7FC] p-1 rounded-xl border border-[#E8E7FF]">
              <span className="text-[10px] text-[#74778F] font-bold px-1.5">الخدمة:</span>
              <button
                type="button"
                onClick={() => setServiceTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  serviceTypeFilter === 'all'
                    ? 'bg-[#17163D] text-white shadow-2xs'
                    : 'text-[#74778F] hover:text-[#17163D]'
                }`}
              >
                الكل
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
                المجموعات
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
                الدروس الخاصة
              </button>
            </div>
          </div>

          {/* SUB-TAB 1: FINANCIAL OVERVIEW */}
          {financialSubTab === 'overview' && (
            <div className="space-y-4">
              {/* Main 4 High-Impact Financial Highlight Bento Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Collected Revenue */}
                <div className="classy-card p-4 space-y-2 bg-gradient-to-br from-white to-emerald-50/40 border-emerald-200 hover:border-emerald-300 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#74778F]">الإيرادات المحصلة</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                      <DollarSign className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight block">
                      {serviceTypeFilter === 'group'
                        ? financialHistory.group.totalCollected
                        : serviceTypeFilter === 'private'
                        ? financialHistory.private.totalCollected
                        : periodRevenue}{' '}
                      <span className="text-xs font-bold text-[#74778F]">ج.م</span>
                    </span>
                    <span className="text-[11px] text-emerald-800 font-bold block mt-0.5">
                      مقبوضات مسددة ومسبقة
                    </span>
                  </div>
                </div>

                {/* 2. Outstanding Dues */}
                <div className="classy-card p-4 space-y-2 bg-gradient-to-br from-white to-rose-50/40 border-[#FECDD3] hover:border-[#FF647C]/50 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#74778F]">المستحقات المعلقة</span>
                    <div className="w-8 h-8 rounded-xl bg-[#FFF1F3] text-[#FF647C] flex items-center justify-center font-black">
                      <Receipt className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span
                      className={`text-2xl sm:text-3xl font-black tracking-tight block ${
                        teacherSummary.totalRemaining > 0 ? 'text-[#FF647C]' : 'text-emerald-700'
                      }`}
                    >
                      {serviceTypeFilter === 'group'
                        ? financialHistory.group.totalRemaining
                        : serviceTypeFilter === 'private'
                        ? financialHistory.private.totalRemaining
                        : teacherSummary.totalRemaining}{' '}
                      <span className="text-xs font-bold text-[#74778F]">ج.م</span>
                    </span>
                    <span className="text-[11px] text-[#74778F] font-bold block mt-0.5">
                      المتبقي على الطلاب
                    </span>
                  </div>
                </div>

                {/* 3. Gross Value of Services */}
                <div className="classy-card p-4 space-y-2 bg-white hover:border-[#7657F6]/40 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#74778F]">إجمالي الرسوم (Gross)</span>
                    <div className="w-8 h-8 rounded-xl bg-[#E8E7FF] text-[#7657F6] flex items-center justify-center font-black">
                      <Wallet className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span className="text-2xl sm:text-3xl font-black text-[#17163D] tracking-tight block">
                      {serviceTypeFilter === 'group'
                        ? financialHistory.group.totalDue
                        : serviceTypeFilter === 'private'
                        ? financialHistory.private.totalDue
                        : teacherSummary.totalDues}{' '}
                      <span className="text-xs font-bold text-[#74778F]">ج.م</span>
                    </span>
                    <span className="text-[11px] text-[#74778F] font-bold block mt-0.5">
                      قيمة كافة الحصص المنفذة
                    </span>
                  </div>
                </div>

                {/* 4. Conducted Sessions */}
                <div className="classy-card p-4 space-y-2 bg-white hover:border-[#403B9C]/40 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#74778F]">الحصص المنفذة</span>
                    <div className="w-8 h-8 rounded-xl bg-[#F0FAFD] text-[#55C7E8] border border-[#BAE6FD] flex items-center justify-center font-black">
                      <CalendarCheck2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span className="text-2xl sm:text-3xl font-black text-[#17163D] tracking-tight block">
                      {serviceTypeFilter === 'group'
                        ? financialHistory.group.totalSessions
                        : serviceTypeFilter === 'private'
                        ? financialHistory.private.totalSessions
                        : teacherSummary.totalSessionsConducted}
                    </span>
                    <span className="text-[11px] text-[#74778F] font-bold block mt-0.5">
                      حصة تم رصد حضورها
                    </span>
                  </div>
                </div>
              </div>

              {/* Group vs Private Split Comparison Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Groups Service Summary */}
                <div className="classy-card p-4 sm:p-5 space-y-3 bg-white border-[#D8D5FB] hover:border-[#7657F6]/50 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#E8E7FF] text-[#403B9C] flex items-center justify-center font-bold">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-sm sm:text-base text-[#17163D]">
                          خدمات المجموعات (Groups)
                        </h3>
                        <p className="text-[11px] text-[#74778F] font-medium">
                          الفصول والمجموعات الدراسية المعتادة
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#E8E7FF] text-[#403B9C] border border-[#D8D5FB]">
                      {financialHistory.group.totalSessions} حصة
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E8E7FF] text-center">
                    <div className="p-2 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF]">
                      <span className="text-[10px] text-[#74778F] block font-bold">المحصل</span>
                      <strong className="text-xs sm:text-sm font-black text-emerald-700">
                        {financialHistory.group.totalCollected} ج.م
                      </strong>
                    </div>
                    <div className="p-2 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF]">
                      <span className="text-[10px] text-[#74778F] block font-bold">المستحق</span>
                      <strong className="text-xs sm:text-sm font-black text-[#17163D]">
                        {financialHistory.group.totalDue} ج.م
                      </strong>
                    </div>
                    <div className="p-2 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF]">
                      <span className="text-[10px] text-[#74778F] block font-bold">المتبقي</span>
                      <strong
                        className={`text-xs sm:text-sm font-black ${
                          financialHistory.group.totalRemaining > 0
                            ? 'text-[#FF647C]'
                            : 'text-emerald-700'
                        }`}
                      >
                        {financialHistory.group.totalRemaining} ج.م
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Private Lessons Service Summary */}
                <div className="classy-card p-4 sm:p-5 space-y-3 bg-white border-[#FECDD3] hover:border-[#FF647C]/50 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#FFF1F3] text-[#FF647C] flex items-center justify-center font-bold">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-sm sm:text-base text-[#17163D]">
                          الدروس الخاصة (Private Lessons)
                        </h3>
                        <p className="text-[11px] text-[#74778F] font-medium">
                          مستقلة تماماً بحسابات فردية ونماذج تسعير مرنة
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]">
                      {financialHistory.private.totalSessions} حصة
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E8E7FF] text-center">
                    <div className="p-2 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF]">
                      <span className="text-[10px] text-[#74778F] block font-bold">المحصل</span>
                      <strong className="text-xs sm:text-sm font-black text-emerald-700">
                        {financialHistory.private.totalCollected} ج.م
                      </strong>
                    </div>
                    <div className="p-2 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF]">
                      <span className="text-[10px] text-[#74778F] block font-bold">المستحق</span>
                      <strong className="text-xs sm:text-sm font-black text-[#17163D]">
                        {financialHistory.private.totalDue} ج.م
                      </strong>
                    </div>
                    <div className="p-2 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF]">
                      <span className="text-[10px] text-[#74778F] block font-bold">المتبقي</span>
                      <strong
                        className={`text-xs sm:text-sm font-black ${
                          financialHistory.private.totalRemaining > 0
                            ? 'text-[#FF647C]'
                            : 'text-emerald-700'
                        }`}
                      >
                        {financialHistory.private.totalRemaining} ج.م
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attendance & Session Analytics Bento Strip */}
              <div className="classy-card p-4 sm:p-5 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarCheck2 className="w-4.5 h-4.5 text-[#7657F6]" />
                    <h3 className="font-black text-sm sm:text-base text-[#17163D]">
                      تحليلات الحضور والغياب بالفترة
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-[#74778F]">
                    إجمالي الرصد: {attendanceAnalytics.totalAttCount} حضور
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                  <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 block font-bold">حاضر (Present)</span>
                    <strong className="text-lg font-black text-emerald-700">
                      {attendanceAnalytics.presentCount}
                    </strong>
                  </div>

                  <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200">
                    <span className="text-[10px] text-amber-900 block font-bold">متأخر (Late)</span>
                    <strong className="text-lg font-black text-amber-800">
                      {attendanceAnalytics.lateCount}
                    </strong>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#FFF1F3] border border-[#FECDD3]">
                    <span className="text-[10px] text-[#FF647C] block font-bold">غياب محسوب (Charged)</span>
                    <strong className="text-lg font-black text-[#FF647C]">
                      {attendanceAnalytics.absentChargedCount}
                    </strong>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF]">
                    <span className="text-[10px] text-[#74778F] block font-bold">غياب معذور (Excused)</span>
                    <strong className="text-lg font-black text-[#17163D]">
                      {attendanceAnalytics.absentExcusedCount}
                    </strong>
                  </div>
                </div>

                {/* Progress bar of commitment */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#17163D]">معدل الالتزام الكلي:</span>
                    <span className="text-emerald-700">{attendanceAnalytics.commitmentRate}%</span>
                  </div>
                  <div className="w-full bg-[#E8E7FF] h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${attendanceAnalytics.commitmentRate}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Payment Methods Breakdown Section */}
              <div className="classy-card p-4 sm:p-5 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4.5 h-4.5 text-[#55C7E8]" />
                    <h3 className="font-black text-sm sm:text-base text-[#17163D]">
                      توزيع طرق الدفع والتحصيل
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-[#74778F]">
                    إجمالي المدفوعات: {filteredPayments.length} عملية
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(
                    Object.entries(methodStats) as [
                      string,
                      { label: string; amount: number; count: number; color: string }
                    ][]
                  ).map(([key, stat]) => {
                    const percentage =
                      periodRevenue > 0 ? Math.round((stat.amount / periodRevenue) * 100) : 0;
                    return (
                      <div
                        key={key}
                        className="p-3 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF] space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-[#74778F]">
                          <span>{stat.label}</span>
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-white border border-[#E8E7FF] text-[#17163D]">
                            {percentage}%
                          </span>
                        </div>
                        <p className="text-base sm:text-lg font-black text-[#17163D]">
                          {stat.amount} <span className="text-xs font-bold text-[#74778F]">ج.م</span>
                        </p>
                        <p className="text-[10px] text-[#74778F] font-bold">{stat.count} عمليات دفع</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Monthly Revenue Trends Bar */}
              {financialHistory.months.length > 0 && (
                <div className="classy-card p-4 sm:p-5 space-y-3 bg-white">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4.5 h-4.5 text-[#7657F6]" />
                    <h3 className="font-black text-sm sm:text-base text-[#17163D]">
                      اتجاهات التحصيل الشهري (آخر الأشهر المسجلة)
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {financialHistory.months.slice(0, 6).map((m) => {
                      const maxRevenue = Math.max(
                        ...financialHistory.months.map((x) => x.totalCollected),
                        1
                      );
                      const barWidth = Math.min(
                        100,
                        Math.round((m.totalCollected / maxRevenue) * 100)
                      );

                      return (
                        <div
                          key={m.monthYear}
                          className="p-3 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF] space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-[#17163D]">
                              {m.monthName} {m.year}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-[#74778F] font-bold">
                                {m.totalCompletedSessions} حصة منتهية
                              </span>
                              <strong className="text-emerald-700 font-black">
                                {m.totalCollected} ج.م
                              </strong>
                            </div>
                          </div>
                          <div className="w-full bg-[#E8E7FF] h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-[#17163D] to-[#7657F6] h-full rounded-full transition-all duration-300"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 2: MONTHLY LEDGER */}
          {financialSubTab === 'monthly_ledger' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="font-black text-sm sm:text-base text-[#17163D] flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-[#7657F6]" />
                    <span>السجل المالي الشهري المفصل ({financialHistory.months.length} أشهر)</span>
                  </h3>
                  <p className="text-xs text-[#74778F] font-medium mt-0.5">
                    يشمل إجمالي الحصص المنفذة، المقبوضات المسددة والمسبقة، والمتبقي
                  </p>
                </div>
              </div>

              {financialHistory.months.length === 0 ? (
                <div className="classy-card p-8 text-center space-y-3 bg-white">
                  <ClassyOwlMascot size="sm" pose="smart" />
                  <p className="text-xs font-bold text-[#74778F]">لا توجد سجلات مالية شهرية مسجلة بعد.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {financialHistory.months.map((m) => {
                    const isExpanded = expandedMonthYear === m.monthYear;
                    const collectionRate =
                      m.totalDue > 0
                        ? Math.min(100, Math.round((m.totalCollected / m.totalDue) * 100))
                        : 100;
                    const relevantData =
                      serviceTypeFilter === 'group'
                        ? m.group
                        : serviceTypeFilter === 'private'
                        ? m.private
                        : m;

                    return (
                      <div
                        key={m.monthYear}
                        className="classy-card overflow-hidden transition-all bg-white"
                      >
                        {/* Month Header Card */}
                        <div
                          onClick={() => setExpandedMonthYear(isExpanded ? null : m.monthYear)}
                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#F6F7FC] transition-colors gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-[#E8E7FF] border border-[#D8D5FB] flex flex-col items-center justify-center text-[#403B9C] shrink-0 font-black">
                              <span className="text-[10px] leading-none text-[#74778F]">{m.year}</span>
                              <span className="text-xs leading-none mt-0.5">{m.month}</span>
                            </div>
                            <div className="space-y-0.5">
                              <h4 className="font-black text-sm sm:text-base text-[#17163D] flex items-center gap-2">
                                <span>
                                  {m.monthName} {m.year}
                                </span>
                                {m.month === currentMonth && m.year === currentYear && (
                                  <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-[#17163D] text-white">
                                    الشهر الحالي
                                  </span>
                                )}
                              </h4>
                              <p className="text-xs text-[#74778F] flex items-center gap-2 flex-wrap font-medium">
                                <span>{m.totalCompletedSessions} حصة منتهية</span>
                                <span>•</span>
                                <span>حضور: {m.presentSessionsCount}</span>
                                {m.lateSessionsCount > 0 && <span>• تأخير: {m.lateSessionsCount}</span>}
                                {m.absentChargedCount > 0 && (
                                  <span>• غياب محسوب: {m.absentChargedCount}</span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-left shrink-0">
                            <div>
                              <p className="text-sm sm:text-base font-black text-emerald-700">
                                {relevantData.totalCollected} ج.م
                              </p>
                              <p className="text-[10px] text-[#74778F] font-bold">
                                من {relevantData.totalDue} ج.م ({collectionRate}%)
                              </p>
                            </div>
                            <div className="w-7 h-7 rounded-full bg-[#F6F7FC] flex items-center justify-center text-[#74778F]">
                              <ChevronDown
                                className={`w-4 h-4 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Expandable Details */}
                        {isExpanded && (
                          <div className="p-4 bg-[#F6F7FC] border-t border-[#E8E7FF] space-y-3 text-xs">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                              <div className="p-2.5 bg-white rounded-xl border border-[#E8E7FF]">
                                <span className="text-[10px] text-[#74778F] block font-bold">
                                  المحصل الفعلي
                                </span>
                                <strong className="text-xs font-black text-emerald-700">
                                  {relevantData.totalCollected} ج.م
                                </strong>
                              </div>
                              <div className="p-2.5 bg-white rounded-xl border border-[#E8E7FF]">
                                <span className="text-[10px] text-[#74778F] block font-bold">
                                  إجمالي الرسوم (المستحق)
                                </span>
                                <strong className="text-xs font-black text-[#17163D]">
                                  {relevantData.totalDue} ج.م
                                </strong>
                              </div>
                              <div className="p-2.5 bg-white rounded-xl border border-[#E8E7FF]">
                                <span className="text-[10px] text-[#74778F] block font-bold">المتبقي</span>
                                <strong
                                  className={`text-xs font-black ${
                                    relevantData.totalRemaining > 0
                                      ? 'text-[#FF647C]'
                                      : 'text-emerald-700'
                                  }`}
                                >
                                  {relevantData.totalRemaining} ج.م
                                </strong>
                              </div>
                              <div className="p-2.5 bg-white rounded-xl border border-[#E8E7FF]">
                                <span className="text-[10px] text-[#74778F] block font-bold">
                                  نسبة التحصيل
                                </span>
                                <strong className="text-xs font-black text-[#7657F6]">
                                  {collectionRate}%
                                </strong>
                              </div>
                            </div>

                            {/* Service Comparison in this month */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="p-3 rounded-xl bg-white border border-[#E8E7FF] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-[#403B9C]" />
                                  <span className="font-bold text-xs text-[#17163D]">المجموعات:</span>
                                  <span className="text-[10px] text-[#74778F] font-bold">
                                    ({m.group.totalSessions} حصة)
                                  </span>
                                </div>
                                <span className="font-black text-xs text-emerald-700">
                                  {m.group.totalCollected} ج.م
                                </span>
                              </div>

                              <div className="p-3 rounded-xl bg-white border border-[#E8E7FF] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Zap className="w-4 h-4 text-[#FF647C]" />
                                  <span className="font-bold text-xs text-[#17163D]">الدروس الخاصة:</span>
                                  <span className="text-[10px] text-[#74778F] font-bold">
                                    ({m.private.totalSessions} حصة)
                                  </span>
                                </div>
                                <span className="font-black text-xs text-emerald-700">
                                  {m.private.totalCollected} ج.م
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 3: YEARLY SUMMARY */}
          {financialSubTab === 'yearly_summary' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="font-black text-sm sm:text-base text-[#17163D] flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#7657F6]" />
                    <span>السجل المالي السنوي ({financialHistory.years.length} سنوات)</span>
                  </h3>
                  <p className="text-xs text-[#74778F] font-medium mt-0.5">
                    ملخص الإيرادات والمستحقات مجمعة سنوياً مع التفصيل الشهري
                  </p>
                </div>
              </div>

              {financialHistory.years.length === 0 ? (
                <div className="classy-card p-8 text-center space-y-3 bg-white">
                  <ClassyOwlMascot size="sm" pose="smart" />
                  <p className="text-xs font-bold text-[#74778F]">لا توجد سجلات سنوية مسجلة بعد.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {financialHistory.years.map((y) => {
                    const isExpanded = expandedYear === y.year;
                    const relevantData =
                      serviceTypeFilter === 'group'
                        ? y.group
                        : serviceTypeFilter === 'private'
                        ? y.private
                        : y;
                    const collectionRate =
                      y.totalDue > 0
                        ? Math.min(100, Math.round((y.totalCollected / y.totalDue) * 100))
                        : 100;

                    return (
                      <div
                        key={y.year}
                        className="classy-card overflow-hidden transition-all bg-white"
                      >
                        {/* Year Card Header */}
                        <div
                          onClick={() => setExpandedYear(isExpanded ? null : y.year)}
                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#F6F7FC] transition-colors gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#17163D] to-[#403B9C] text-white font-black text-base flex items-center justify-center shadow-md">
                              {y.year}
                            </div>
                            <div className="space-y-0.5">
                              <h4 className="font-black text-base text-[#17163D]">عام {y.year}</h4>
                              <p className="text-xs text-[#74778F] font-medium">
                                {y.totalCompletedSessions} حصة منتهية • {y.months.length} أشهر نشطة
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-left shrink-0">
                            <div>
                              <p className="text-sm sm:text-base font-black text-emerald-700">
                                {relevantData.totalCollected} ج.م
                              </p>
                              <p className="text-[10px] text-[#74778F] font-bold">
                                من {relevantData.totalDue} ج.م ({collectionRate}%)
                              </p>
                            </div>
                            <div className="w-7 h-7 rounded-full bg-[#F6F7FC] flex items-center justify-center text-[#74778F]">
                              <ChevronDown
                                className={`w-4 h-4 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Year Details & Months Grid */}
                        {isExpanded && (
                          <div className="p-4 bg-[#F6F7FC] border-t border-[#E8E7FF] space-y-3 text-xs">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                              <div className="p-2.5 bg-white rounded-xl border border-[#E8E7FF]">
                                <span className="text-[10px] text-[#74778F] block font-bold">
                                  المحصل الإجمالي
                                </span>
                                <strong className="text-xs font-black text-emerald-700">
                                  {relevantData.totalCollected} ج.م
                                </strong>
                              </div>
                              <div className="p-2.5 bg-white rounded-xl border border-[#E8E7FF]">
                                <span className="text-[10px] text-[#74778F] block font-bold">
                                  إجمالي المستحق
                                </span>
                                <strong className="text-xs font-black text-[#17163D]">
                                  {relevantData.totalDue} ج.م
                                </strong>
                              </div>
                              <div className="p-2.5 bg-white rounded-xl border border-[#E8E7FF]">
                                <span className="text-[10px] text-[#74778F] block font-bold">المتبقي</span>
                                <strong
                                  className={`text-xs font-black ${
                                    relevantData.totalRemaining > 0
                                      ? 'text-[#FF647C]'
                                      : 'text-emerald-700'
                                  }`}
                                >
                                  {relevantData.totalRemaining} ج.م
                                </strong>
                              </div>
                              <div className="p-2.5 bg-white rounded-xl border border-[#E8E7FF]">
                                <span className="text-[10px] text-[#74778F] block font-bold">
                                  متوسط التحصيل الشهري
                                </span>
                                <strong className="text-xs font-black text-[#7657F6]">
                                  {y.months.length > 0
                                    ? Math.round(relevantData.totalCollected / y.months.length)
                                    : 0}{' '}
                                  ج.م
                                </strong>
                              </div>
                            </div>

                            {/* Months breakdown */}
                            <div className="space-y-1.5 pt-2">
                              <h5 className="font-black text-xs text-[#17163D]">
                                تفصيل أشهر عام {y.year}:
                              </h5>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {y.months.map((m) => (
                                  <div
                                    key={m.monthYear}
                                    className="p-3 bg-white rounded-xl border border-[#E8E7FF] flex items-center justify-between"
                                  >
                                    <div>
                                      <span className="font-black text-[#17163D] block text-xs">
                                        {m.monthName}
                                      </span>
                                      <span className="text-[10px] text-[#74778F] font-bold">
                                        {m.totalCompletedSessions} حصة
                                      </span>
                                    </div>
                                    <div className="text-left">
                                      <p className="font-black text-emerald-700 text-xs">
                                        {m.totalCollected} ج.م
                                      </p>
                                      <span className="text-[9px] text-[#74778F]">
                                        من {m.totalDue} ج.م
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 4: LIFETIME / ALL-TIME SUMMARY */}
          {financialSubTab === 'lifetime' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-black text-sm sm:text-base text-[#17163D] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#7657F6]" />
                  <span>الإجمالي الشامل طوال فترة العمل (All-Time Lifetime)</span>
                </h3>
                <p className="text-xs text-[#74778F] font-medium mt-0.5">
                  إجمالي العمليات المالية والحصص منذ بداية استخدام التطبيق
                </p>
              </div>

              {/* Lifetime Grand Bento Highlights */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="classy-card p-4 space-y-1.5 bg-white border-emerald-200">
                  <span className="text-xs font-bold text-[#74778F] block">
                    إجمالي المقبوضات الشامل
                  </span>
                  <p className="text-2xl font-black text-emerald-700">
                    {financialHistory.totalCollected}{' '}
                    <span className="text-xs text-[#74778F]">ج.م</span>
                  </p>
                  <p className="text-[10px] text-emerald-800 font-bold">
                    شامل الحصص المسبقة والدفعات
                  </p>
                </div>

                <div className="classy-card p-4 space-y-1.5 bg-white">
                  <span className="text-xs font-bold text-[#74778F] block">
                    إجمالي المستحقات الكلي
                  </span>
                  <p className="text-2xl font-black text-[#17163D]">
                    {financialHistory.totalDue} <span className="text-xs text-[#74778F]">ج.م</span>
                  </p>
                  <p className="text-[10px] text-[#74778F] font-bold">
                    قيمة كافة الحصص والخدمات
                  </p>
                </div>

                <div className="classy-card p-4 space-y-1.5 bg-white border-[#FECDD3]">
                  <span className="text-xs font-bold text-[#74778F] block">
                    إجمالي المتبقي غير المسدد
                  </span>
                  <p
                    className={`text-2xl font-black ${
                      financialHistory.totalRemaining > 0 ? 'text-[#FF647C]' : 'text-emerald-700'
                    }`}
                  >
                    {financialHistory.totalRemaining}{' '}
                    <span className="text-xs text-[#74778F]">ج.م</span>
                  </p>
                  <p className="text-[10px] text-[#74778F] font-bold">ديون معلقة على الطلاب</p>
                </div>

                <div className="classy-card p-4 space-y-1.5 bg-white">
                  <span className="text-xs font-bold text-[#74778F] block">إجمالي الحصص المنفذة</span>
                  <p className="text-2xl font-black text-[#7657F6]">
                    {financialHistory.totalCompletedSessions}
                  </p>
                  <p className="text-[10px] text-[#74778F] font-bold">حصة تم رصد حضورها</p>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 5: PAYMENT RECEIPTS LOG */}
          {financialSubTab === 'payments' && (
            <div className="classy-card p-4 sm:p-5 space-y-4 bg-white">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-black text-sm sm:text-base text-[#17163D] flex items-center gap-2">
                    <Receipt className="w-4.5 h-4.5 text-[#7657F6]" />
                    <span>سجل المقبوضات والمدفوعات ({filteredPayments.length}):</span>
                  </h3>
                  <p className="text-xs text-[#74778F] font-medium mt-0.5">
                    كشف تفصيلي لكافة عمليات التحصيل والدفعات المسجلة
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value)}
                    className="p-2 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] text-xs font-bold text-[#17163D] focus:outline-none focus:border-[#7657F6] cursor-pointer"
                  >
                    <option value="all">كل طرق الدفع</option>
                    <option value="cash">كاش (نقداً)</option>
                    <option value="vodafone_cash">فودافون كاش</option>
                    <option value="instapay">إنستاباي</option>
                    <option value="bank_transfer">تحويل بنكي</option>
                  </select>

                  <div className="relative w-44 sm:w-56">
                    <Search className="w-4 h-4 absolute right-3 top-2.5 text-[#74778F]" />
                    <input
                      type="text"
                      value={paymentSearchQuery}
                      onChange={(e) => setPaymentSearchQuery(e.target.value)}
                      placeholder="بحث في المدفوعات..."
                      className="w-full pr-9 pl-8 py-2 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] text-xs font-bold text-[#17163D] focus:outline-none focus:border-[#7657F6]"
                    />
                    {paymentSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setPaymentSearchQuery('')}
                        className="absolute left-2.5 top-2 text-[#74778F] hover:text-[#17163D]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {filteredPayments.length === 0 ? (
                <div className="p-8 text-center space-y-2 bg-[#F6F7FC] rounded-2xl border border-[#E8E7FF]">
                  <Receipt className="w-8 h-8 text-[#74778F] mx-auto opacity-40" />
                  <p className="text-xs font-bold text-[#74778F]">
                    لا توجد مدفوعات مسجلة مطابقة لخيارات التصفية الحالية.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto android-scrollbar">
                  {filteredPayments.map((p) => {
                    const student = students.find((s) => s.id === p.studentId);
                    return (
                      <div
                        key={p.id}
                        className="p-3.5 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF] flex items-center justify-between text-xs gap-2 hover:border-[#7657F6]/40 transition-all"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <span className="font-black text-sm text-[#17163D] block truncate">
                            {student?.name || 'طالب غير محدد'}
                          </span>
                          <p className="text-[11px] text-[#74778F] font-medium">
                            {p.date} •{' '}
                            {p.paymentType === 'specific_month'
                              ? `شهر ${getArabicMonthName(p.targetMonth || 1)}`
                              : 'سداد حصص'}{' '}
                            {p.notes ? `• ${p.notes}` : ''}
                          </p>
                        </div>

                        <div className="text-left shrink-0">
                          <p className="font-black text-emerald-700 text-sm">{p.amount} ج.م</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white border border-[#E8E7FF] text-[#17163D] inline-block mt-0.5">
                            {p.paymentMethod === 'vodafone_cash'
                              ? 'فودافون كاش'
                              : p.paymentMethod === 'instapay'
                              ? 'إنستاباي'
                              : p.paymentMethod === 'bank_transfer'
                              ? 'تحويل بنكي'
                              : 'كاش'}
                          </span>
                        </div>
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
          5. TAB 2: OVERDUE DEBTS & SETTLEMENT LIST
          ========================================================================= */}
      {reportType === 'overdue_list' && (
        <div className="space-y-3.5">
          <div className="classy-card p-4 sm:p-5 bg-white space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-black text-sm sm:text-base text-[#17163D] flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[#FF647C]" />
                  <span>كشف حساب الطلاب ذوي المستحقات المتأخرة</span>
                </h3>
                <p className="text-xs text-[#74778F] font-medium mt-0.5">
                  إجمالي الديون المعلقة:{' '}
                  <strong className="text-[#FF647C] font-black">
                    {teacherSummary.totalRemaining} ج.م
                  </strong>{' '}
                  على {overdueStudentsList.length} طالب
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative w-48 sm:w-60">
                  <Search className="w-4 h-4 absolute right-3 top-2.5 text-[#74778F]" />
                  <input
                    type="text"
                    value={overdueSearchQuery}
                    onChange={(e) => setOverdueSearchQuery(e.target.value)}
                    placeholder="بحث في المتأخرات..."
                    className="w-full pr-9 pl-8 py-2 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] text-xs font-bold text-[#17163D] focus:outline-none focus:border-[#7657F6]"
                  />
                  {overdueSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setOverdueSearchQuery('')}
                      className="absolute left-2.5 top-2 text-[#74778F] hover:text-[#17163D]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {onOpenAddPayment && (
                  <button
                    onClick={() => onOpenAddPayment()}
                    className="px-4 py-2 rounded-2xl bg-gradient-to-r from-[#FF647C] to-[#7657F6] text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-[#FF647C]/30 transition-all active:scale-95 cursor-pointer hover:brightness-105"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>تسجيل دفعة</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {overdueStudentsList.length === 0 ? (
            <div className="classy-card p-8 sm:p-12 text-center space-y-3 flex flex-col items-center bg-white">
              <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h4 className="font-black text-base text-[#17163D]">
                  لا توجد أي مديونيات متأخرة! 🎉
                </h4>
                <p className="text-xs sm:text-sm text-[#74778F]">
                  جميع الطلاب مسددون لالتزاماتهم واشتراكاتهم بالكامل.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {overdueStudentsList.map((item) => {
                const phoneForWa = item.student.parentPhone || item.student.phone;
                return (
                  <div
                    key={item.student.id}
                    className="classy-card classy-card-hover p-4 bg-white border-[#FECDD3] hover:border-[#FF647C]/60 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <StudentAvatar student={item.student} size="md" showFrame={true} />
                        <div className="space-y-0.5">
                          <h4 className="font-black text-sm sm:text-base text-[#17163D]">
                            {item.student.name}
                          </h4>
                          <p className="text-xs text-[#74778F] font-medium">
                            {getLocalizedStageName(item.student.gradeLevel)}{' '}
                            {item.student.parentPhone
                              ? `• ولي الأمر: ${item.student.parentPhone}`
                              : ''}
                          </p>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <span className="text-[10px] font-bold text-[#74778F] block">
                          المستحق المتبقي
                        </span>
                        <strong className="text-base sm:text-lg font-black text-[#FF647C]">
                          {item.grandRemaining} ج.م
                        </strong>
                      </div>
                    </div>

                    {/* Services Breakdown Strip */}
                    <div className="p-2.5 bg-[#F6F7FC] rounded-xl border border-[#E8E7FF] flex items-center justify-between text-xs flex-wrap gap-2">
                      <div>
                        <span className="text-[#74778F] font-bold">إجمالي الرسوم: </span>
                        <strong className="text-[#17163D]">{item.grandTotalDue} ج.م</strong>
                        <span className="text-[#74778F] font-bold mr-2"> | المسدد: </span>
                        <strong className="text-emerald-700">{item.grandTotalPaid} ج.م</strong>
                      </div>

                      {item.lastPayment && (
                        <span className="text-[11px] text-[#74778F] font-bold">
                          آخر سداد: {item.lastPayment.date} ({item.lastPayment.amount} ج.م)
                        </span>
                      )}
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#E8E7FF]">
                      {phoneForWa && (
                        <a
                          href={`https://wa.me/${phoneForWa.replace(
                            /[^0-9]/g,
                            ''
                          )}?text=${encodeURIComponent(
                            `السلام عليكم ورحمة الله، تذكير بمستحقات درس ${item.student.name}، المتبقي ${item.grandRemaining} ج.م. شكراً لتعاونكم.`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>تذكير واتساب</span>
                        </a>
                      )}

                      {onOpenAddPayment && (
                        <button
                          onClick={() => onOpenAddPayment(item.student)}
                          className="px-3.5 py-1.5 rounded-xl bg-[#17163D] hover:bg-[#403B9C] text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                        >
                          <DollarSign className="w-3.5 h-3.5 text-[#55C7E8]" />
                          <span>سداد الآن</span>
                        </button>
                      )}

                      {onOpenStudentProfile && (
                        <button
                          onClick={() => onOpenStudentProfile(item.student)}
                          className="px-3 py-1.5 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] text-xs font-bold text-[#74778F] hover:text-[#17163D] hover:bg-[#E8E7FF] transition-colors cursor-pointer"
                        >
                          فتح الملف
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          6. TAB 3: GROUP REPORT
          ========================================================================= */}
      {reportType === 'group_report' && (
        <div className="space-y-4">
          {/* Group Selector */}
          <div className="classy-card p-4 bg-white space-y-2">
            <label className="font-black text-xs text-[#17163D] block">اختر المجموعة للتقرير:</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full p-3 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF] text-xs sm:text-sm font-bold text-[#17163D] focus:outline-none focus:border-[#7657F6] cursor-pointer"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.type === 'private' ? 'درس خاص' : 'مجموعة'}) - {g.subject}
                </option>
              ))}
            </select>
          </div>

          {selectedGroupFin && (
            <div className="space-y-4">
              {/* Group Metrics Bento Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="classy-card p-3.5 text-center bg-white">
                  <span className="text-[10px] text-[#74778F] font-bold block">إجمالي الرسوم (Gross)</span>
                  <p className="text-base sm:text-lg font-black text-[#17163D] mt-0.5">
                    {selectedGroupFin.totalDue} ج.م
                  </p>
                </div>
                <div className="classy-card p-3.5 text-center bg-white">
                  <span className="text-[10px] text-[#74778F] font-bold block">إجمالي المدفوع</span>
                  <p className="text-base sm:text-lg font-black text-emerald-700 mt-0.5">
                    {selectedGroupFin.totalPaid} ج.م
                  </p>
                </div>
                <div className="classy-card p-3.5 text-center bg-white">
                  <span className="text-[10px] text-[#74778F] font-bold block">المتبقي المطلوب</span>
                  <p
                    className={`text-base sm:text-lg font-black mt-0.5 ${
                      selectedGroupFin.remaining > 0 ? 'text-[#FF647C]' : 'text-emerald-700'
                    }`}
                  >
                    {selectedGroupFin.remaining} ج.م
                  </p>
                </div>
                <div className="classy-card p-3.5 text-center bg-white">
                  <span className="text-[10px] text-[#74778F] font-bold block">الحصص المنفذة</span>
                  <p className="text-base sm:text-lg font-black text-[#7657F6] mt-0.5">
                    {selectedGroupFin.totalCompletedSessions} حصة
                  </p>
                </div>
              </div>

              {/* Students Ledger Table in Group */}
              <div className="classy-card p-4 sm:p-5 bg-white space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-black text-sm text-[#17163D]">
                    كشف حساب طلاب المجموعة ({selectedGroupFin.studentsSummary.length} طلاب):
                  </h3>
                  <span className="text-xs font-bold text-[#7657F6] bg-[#E8E7FF] px-2.5 py-1 rounded-xl">
                    إجمالي رصيد الحصص المسبقة: {selectedGroupFin.totalPrepaidCredits} حصة
                  </span>
                </div>

                <div className="rounded-2xl border border-[#E8E7FF] overflow-x-auto android-scrollbar">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-[#F6F7FC] text-[#74778F] font-black border-b border-[#E8E7FF]">
                      <tr>
                        <th className="p-3">الطالب</th>
                        <th className="p-3">الحصص المستهلكة</th>
                        <th className="p-3">إجمالي الرسوم</th>
                        <th className="p-3">المسدد</th>
                        <th className="p-3">المتبقي المطلوب</th>
                        <th className="p-3">رصيد الحصص</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E7FF]">
                      {selectedGroupFin.studentsSummary.map((item) => (
                        <tr key={item.student.id} className="bg-white hover:bg-[#F6F7FC] transition-colors">
                          <td className="p-3 font-bold text-[#17163D]">{item.student.name}</td>
                          <td className="p-3 text-[#74778F] font-bold">{item.attendedCount} حصة</td>
                          <td className="p-3 font-black text-[#17163D]">{item.totalDue} ج.م</td>
                          <td className="p-3 font-black text-emerald-700">{item.totalPaid} ج.م</td>
                          <td
                            className={`p-3 font-black ${
                              item.remaining > 0 ? 'text-[#FF647C]' : 'text-emerald-700'
                            }`}
                          >
                            {item.remaining} ج.م
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                item.sessionCredit > 0
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                  : 'bg-[#F6F7FC] text-[#74778F] border border-[#E8E7FF]'
                              }`}
                            >
                              {item.sessionCredit} حصص
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          7. TAB 4: STUDENT REPORT
          ========================================================================= */}
      {reportType === 'student_report' && (
        <div className="space-y-4">
          {/* Student Selector with Search */}
          <div className="classy-card p-4 bg-white space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="font-black text-xs text-[#17163D]">اختر الطالب لعرض التقرير الشامل:</label>
              <div className="relative w-48 sm:w-64">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-[#74778F]" />
                <input
                  type="text"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  placeholder="بحث عن طالب..."
                  className="w-full pr-9 pl-8 py-2 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] text-xs font-bold text-[#17163D] focus:outline-none focus:border-[#7657F6]"
                />
                {studentSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setStudentSearchQuery('')}
                    className="absolute left-2.5 top-2 text-[#74778F] hover:text-[#17163D]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full p-3 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF] text-xs sm:text-sm font-bold text-[#17163D] focus:outline-none focus:border-[#7657F6] cursor-pointer"
            >
              {students
                .filter((s) => s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()))
                .map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({getLocalizedStageName(st.gradeLevel) || 'غير محدد'}){' '}
                    {st.status === 'archived' ? '— (طالب مؤرشف)' : ''}
                  </option>
                ))}
            </select>
          </div>

          {selectedStudentGrandFin && selectedStudentObj && (
            <div className="space-y-4">
              {/* Grand Student Summary Card */}
              <div className="classy-card p-4 sm:p-5 bg-white space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <StudentAvatar student={selectedStudentObj} size="lg" showFrame={true} />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-base sm:text-lg text-[#17163D]">
                          {selectedStudentObj.name}
                        </h3>
                        {selectedStudentObj.status === 'archived' && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                            طالب مؤرشف
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#74778F] font-medium">
                        {getLocalizedStageName(selectedStudentObj.gradeLevel) || 'الصف غير محدد'}
                      </p>
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <span className="text-[10px] text-[#74778F] font-bold block">
                      رصيد الحصص الكلي
                    </span>
                    <strong className="text-base sm:text-lg text-[#7657F6] font-black">
                      {selectedStudentGrandFin.totalSessionCredit} حصص
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-3 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF]">
                    <span className="text-[10px] text-[#74778F] font-bold block">
                      إجمالي الرسوم (Gross)
                    </span>
                    <strong className="text-base font-black text-[#17163D] mt-0.5 block">
                      {selectedStudentGrandFin.grandTotalDue} ج.م
                    </strong>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF]">
                    <span className="text-[10px] text-[#74778F] font-bold block">إجمالي المدفوع</span>
                    <strong className="text-base font-black text-emerald-700 mt-0.5 block">
                      {selectedStudentGrandFin.grandTotalPaid} ج.م
                    </strong>
                  </div>
                  <div className="p-3 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF]">
                    <span className="text-[10px] text-[#74778F] font-bold block">
                      المستحق المتبقي (Outstanding)
                    </span>
                    <strong
                      className={`text-base font-black mt-0.5 block ${
                        selectedStudentGrandFin.grandRemaining > 0
                          ? 'text-[#FF647C]'
                          : 'text-emerald-700'
                      }`}
                    >
                      {selectedStudentGrandFin.grandRemaining} ج.م
                    </strong>
                  </div>
                </div>

                {selectedStudentGrandFin.totalFinancialCredit > 0 && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-xs font-bold flex items-center justify-between">
                    <span>الرصيد المالي المتبقي للطالب (Financial Credit):</span>
                    <strong className="text-sm font-black">
                      +{selectedStudentGrandFin.totalFinancialCredit} ج.م
                    </strong>
                  </div>
                )}
              </div>

              {/* Individual Services Breakdown (Group & Private) */}
              <div className="classy-card p-4 sm:p-5 bg-white space-y-3">
                <h4 className="font-black text-xs sm:text-sm text-[#17163D] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#7657F6]" />
                  <span>تفاصيل الاشتراكات والخدمات المستقلة (Group & Private):</span>
                </h4>

                <div className="space-y-2.5">
                  {selectedStudentGrandFin.enrollmentsSummary.map((summary) => (
                    <div
                      key={summary.enrollmentId}
                      className={`p-3.5 rounded-2xl border space-y-2.5 ${
                        summary.groupType === 'private'
                          ? 'bg-[#FFF1F3]/40 border-[#FECDD3]'
                          : 'bg-[#F6F7FC] border-[#E8E7FF]'
                      }`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: summary.accentColor }}
                          />
                          <strong className="text-xs font-black text-[#17163D]">
                            {summary.groupName}
                          </strong>
                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                              summary.groupType === 'private'
                                ? 'bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]'
                                : 'bg-[#E8E7FF] text-[#403B9C]'
                            }`}
                          >
                            {summary.groupType === 'private' ? 'درس خاص (Private)' : 'مجموعة'}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#74778F] font-bold">
                          {summary.billingMode === 'hourly' || summary.billingType === 'hourly'
                            ? 'سعر الساعة:'
                            : 'سعر الحصة:'}{' '}
                          <strong className="text-[#17163D] font-black">
                            {summary.customPrice} ج.م
                          </strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
                        <div className="p-2 bg-white rounded-xl border border-[#E8E7FF]">
                          <span className="text-[#74778F] block text-[10px] font-bold">
                            {summary.billingMode === 'hourly' || summary.billingType === 'hourly'
                              ? 'الساعات المنفذة'
                              : 'المستهلك'}
                          </span>
                          <strong className="text-xs font-black text-[#17163D]">
                            {summary.billingMode === 'hourly' || summary.billingType === 'hourly'
                              ? `${summary.totalHours ?? 0} ساعة`
                              : `${summary.usedSessionsCount || 0} حصة`}
                          </strong>
                        </div>
                        <div className="p-2 bg-white rounded-xl border border-[#E8E7FF]">
                          <span className="text-[#74778F] block text-[10px] font-bold">
                            {summary.billingMode === 'hourly' || summary.billingType === 'hourly'
                              ? 'إجمالي الرسوم'
                              : 'رصيد الحصص'}
                          </span>
                          <strong className="text-xs font-black text-[#7657F6]">
                            {summary.billingMode === 'hourly' || summary.billingType === 'hourly'
                              ? `${summary.totalDue} ج.م`
                              : `${summary.sessionCredit} حصص`}
                          </strong>
                        </div>
                        <div className="p-2 bg-white rounded-xl border border-[#E8E7FF]">
                          <span className="text-[#74778F] block text-[10px] font-bold">المدفوع</span>
                          <strong className="text-xs font-black text-emerald-700">
                            {summary.totalPaid} ج.م
                          </strong>
                        </div>
                        <div
                          className={`p-2 rounded-xl border ${
                            summary.remaining > 0
                              ? 'bg-[#FFF1F3] border-[#FECDD3] text-[#FF647C]'
                              : 'bg-white border-[#E8E7FF] text-emerald-700'
                          }`}
                        >
                          <span className="block text-[10px] font-bold">المتبقي</span>
                          <strong className="text-xs font-black">
                            {summary.remaining} ج.م
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Student Payments Ledger */}
              <div className="classy-card p-4 sm:p-5 bg-white space-y-3">
                <h4 className="font-black text-xs sm:text-sm text-[#17163D] flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#7657F6]" />
                  <span>سجل مدفوعات الطالب:</span>
                </h4>

                {selectedStudentGrandFin.allPayments.length === 0 ? (
                  <p className="text-xs text-[#74778F] font-bold text-center p-4 bg-[#F6F7FC] rounded-2xl">
                    لا توجد مدفوعات مسجلة لهذا الطالب بعد.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedStudentGrandFin.allPayments.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF] flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-black text-[#17163D]">{p.amount} ج.م</p>
                          <p className="text-[10px] text-[#74778F] font-medium">
                            {p.date} •{' '}
                            {p.paymentType === 'specific_month'
                              ? `شهر ${getArabicMonthName(p.targetMonth || 1)}`
                              : 'سداد حصص'}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-[#E8E7FF] text-[#17163D]">
                          {p.paymentMethod === 'vodafone_cash'
                            ? 'فودافون كاش'
                            : p.paymentMethod === 'instapay'
                            ? 'إنستاباي'
                            : p.paymentMethod === 'bank_transfer'
                            ? 'تحويل بنكي'
                            : 'كاش'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
