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
  ArrowUpRight,
  Clock,
  PieChart,
  X,
} from 'lucide-react';
import { Student, Group, Session, Payment, ReportPeriodFilter, Enrollment } from '../types';
import { db, getArabicMonthName } from '../utils/storage';
import { getLocalizedStageName } from '../utils/stages';

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

  // Tab State: 1. تقرير المدرس العام | 2. تقرير المجموعة | 3. تقرير الطالب | 4. كشف المديونيات
  const [reportType, setReportType] = useState<'teacher_overview' | 'group_report' | 'student_report' | 'overdue_list'>('teacher_overview');

  // Filter Period
  const [periodFilter, setPeriodFilter] = useState<ReportPeriodFilter>('this_month');
  const [selectedSpecificMonth, setSelectedSpecificMonth] = useState<number>(currentMonth);
  const [selectedSpecificYear, setSelectedSpecificYear] = useState<number>(currentYear);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Financial Sub-View: 'overview' | 'monthly_ledger' | 'yearly_summary' | 'lifetime' | 'payments'
  const [financialSubTab, setFinancialSubTab] = useState<'overview' | 'monthly_ledger' | 'yearly_summary' | 'lifetime' | 'payments'>('overview');
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

  const activeEnrollments = useMemo(() => enrollments || db.getEnrollments(), [enrollments]);

  // 1. Overall Teacher Calculations
  const teacherSummary = useMemo(() => {
    return db.calculateTeacherFinancialOverview(periodFilter);
  }, [periodFilter, students, payments, sessions]);

  // Full Financial History Engine
  const financialHistory = useMemo(() => {
    return teacherSummary.financialHistory || db.calculateFinancialHistory();
  }, [teacherSummary, payments, sessions, activeEnrollments, groups, students]);

  // Filter payments by period
  const filteredPayments = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

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
      if (periodFilter === 'today') {
        return p.date === todayStr;
      }
      if (periodFilter === 'last_7_days') {
        return p.date >= d7Str && p.date <= todayStr;
      }
      if (periodFilter === 'this_month') {
        return p.month === currentMonth && p.year === currentYear;
      }
      if (periodFilter === 'last_month') {
        return p.month === lastMonth && p.year === lastMonthYear;
      }
      if (periodFilter === 'specific_month') {
        return p.month === selectedSpecificMonth && p.year === selectedSpecificYear;
      }
      if (periodFilter === 'custom_range' && customStartDate && customEndDate) {
        return p.date >= customStartDate && p.date <= customEndDate;
      }
      return true;
    });
  }, [payments, paymentSearchQuery, students, methodFilter, periodFilter, currentMonth, currentYear, selectedSpecificMonth, selectedSpecificYear, customStartDate, customEndDate]);

  const periodRevenue = useMemo(() => {
    // If filtering by predefined periods, use financialHistory to include prepaid revenue properly
    if (periodFilter === 'all_time') {
      return financialHistory.totalCollected;
    }
    if (periodFilter === 'this_month') {
      const key = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      const mRec = financialHistory.months.find((m) => m.monthYear === key);
      return mRec ? mRec.totalCollected : filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    }
    if (periodFilter === 'last_month') {
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const key = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}`;
      const mRec = financialHistory.months.find((m) => m.monthYear === key);
      return mRec ? mRec.totalCollected : filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    }
    if (periodFilter === 'specific_month') {
      const key = `${selectedSpecificYear}-${String(selectedSpecificMonth).padStart(2, '0')}`;
      const mRec = financialHistory.months.find((m) => m.monthYear === key);
      return mRec ? mRec.totalCollected : filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    }

    return filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [filteredPayments, periodFilter, financialHistory, currentMonth, currentYear, selectedSpecificMonth, selectedSpecificYear]);

  // Payment Methods Breakdown Calculations
  const methodStats = useMemo(() => {
    const stats = {
      cash: { label: 'كاش (نقداً)', amount: 0, count: 0, color: '#607B5E' },
      vodafone_cash: { label: 'فودافون كاش', amount: 0, count: 0, color: '#B86B52' },
      instapay: { label: 'إنستاباي (InstaPay)', amount: 0, count: 0, color: '#586E7E' },
      bank_transfer: { label: 'تحويل بنكي', amount: 0, count: 0, color: '#B88438' },
      other: { label: 'أخرى', amount: 0, count: 0, color: '#878E82' },
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

  // Calculate Overdue Students List
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
        // Apply search if present
        if (overdueSearchQuery.trim()) {
          const q = overdueSearchQuery.toLowerCase();
          const matches = st.name.toLowerCase().includes(q) || (st.phone && st.phone.includes(q)) || (st.parentPhone && st.parentPhone.includes(q));
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

    // Sort by highest overdue amount first
    list.sort((a, b) => b.grandRemaining - a.grandRemaining);
    return list;
  }, [students, payments, overdueSearchQuery]);

  // 2. Selected Student Dossier
  const selectedStudentGrandFin = useMemo(() => {
    return selectedStudentId ? db.calculateStudentGrandFinancials(selectedStudentId) : null;
  }, [selectedStudentId, students, payments, sessions]);

  const selectedStudentObj = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  // 3. Selected Group Dossier
  const selectedGroupFin = useMemo(() => {
    return selectedGroupId ? db.calculateGroupFinancials(selectedGroupId) : null;
  }, [selectedGroupId, groups, students, sessions, payments]);

  const selectedGroupObj = useMemo(() => {
    return groups.find((g) => g.id === selectedGroupId);
  }, [groups, selectedGroupId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-4 text-[#14152C] pb-24 bg-[#F4F3FA]" dir="rtl">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 classy-card p-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#EDE8FF] text-[#7B61FF] flex items-center justify-center shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#14152C] tracking-tight">
                التقارير والكشوف المالية
              </h1>
              <p className="text-xs text-[#727494] font-medium mt-0.5">
                اللوحة المالية الشاملة وتحليلات الإيرادات والتحصيل
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="px-4 py-2 rounded-2xl bg-white hover:bg-[#F4F3FA] text-[#14152C] border border-[#E8E4F5] font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer shadow-xs"
        >
          <Printer className="w-4 h-4 text-[#FF5E62]" />
          <span>طباعة الكشف</span>
        </button>
      </div>

      {/* 4 Report Navigation Tabs - Sticky on Mobile & Desktop */}
      <div className="sticky top-0 z-20 bg-[#F4F3FA]/95 backdrop-blur-xs pt-1 pb-1 -mx-1 px-1">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 classy-card text-xs font-bold">
          <button
            type="button"
            onClick={() => setReportType('teacher_overview')}
            className={`py-2 px-2 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              reportType === 'teacher_overview'
                ? 'bg-[#1E1F3D] text-white shadow-md'
                : 'text-[#727494] hover:bg-[#F4F3FA] hover:text-[#14152C]'
            }`}
          >
            <BarChart3 className={`w-3.5 h-3.5 shrink-0 ${reportType === 'teacher_overview' ? 'text-[#FF758C]' : ''}`} />
            <span className="truncate font-black">اللوحة المالية</span>
          </button>

          <button
            type="button"
            onClick={() => setReportType('overdue_list')}
            className={`py-2 px-2 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              reportType === 'overdue_list'
                ? 'bg-[#1E1F3D] text-white shadow-md'
                : 'text-[#727494] hover:bg-[#F4F3FA] hover:text-[#14152C]'
            }`}
          >
            <Receipt className={`w-3.5 h-3.5 shrink-0 ${reportType === 'overdue_list' ? 'text-[#FF758C]' : ''}`} />
            <span className="truncate font-black">المستحقات ({overdueStudentsList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setReportType('group_report')}
            className={`py-2 px-2 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              reportType === 'group_report'
                ? 'bg-[#1E1F3D] text-white shadow-md'
                : 'text-[#727494] hover:bg-[#F4F3FA] hover:text-[#14152C]'
            }`}
          >
            <Layers className={`w-3.5 h-3.5 shrink-0 ${reportType === 'group_report' ? 'text-[#FF758C]' : ''}`} />
            <span className="truncate font-black">المجموعات</span>
          </button>

          <button
            type="button"
            onClick={() => setReportType('student_report')}
            className={`py-2 px-2 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              reportType === 'student_report'
                ? 'bg-[#1E1F3D] text-white shadow-md'
                : 'text-[#727494] hover:bg-[#F4F3FA] hover:text-[#14152C]'
            }`}
          >
            <User className={`w-3.5 h-3.5 shrink-0 ${reportType === 'student_report' ? 'text-[#FF758C]' : ''}`} />
            <span className="truncate font-black">تقرير الطالب</span>
          </button>
        </div>
      </div>

      {/* Time Period Filter Bar (Common for Reports) */}
      {reportType !== 'overdue_list' && (
        <div className="p-3.5 classy-card space-y-2.5 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="font-black text-[#14152C] flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#7B61FF]" />
              <span>الفترة الزمنية:</span>
            </span>

            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setPeriodFilter('last_7_days')}
                className={`px-3 py-1 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                  periodFilter === 'last_7_days'
                    ? 'bg-[#1E1F3D] text-white shadow-xs'
                    : 'bg-[#F4F3FA] text-[#727494] border border-[#E8E4F5] hover:bg-[#ECEAF6]'
                }`}
              >
                آخر 7 أيام
              </button>
              <button
                onClick={() => setPeriodFilter('this_month')}
                className={`px-3 py-1 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                  periodFilter === 'this_month'
                    ? 'bg-[#1E1F3D] text-white shadow-xs'
                    : 'bg-[#F4F3FA] text-[#727494] border border-[#E8E4F5] hover:bg-[#ECEAF6]'
                }`}
              >
                هذا الشهر
              </button>
              <button
                onClick={() => setPeriodFilter('last_month')}
                className={`px-3 py-1 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                  periodFilter === 'last_month'
                    ? 'bg-[#1E1F3D] text-white shadow-xs'
                    : 'bg-[#F4F3FA] text-[#727494] border border-[#E8E4F5] hover:bg-[#ECEAF6]'
                }`}
              >
                الشهر الماضي
              </button>
              <button
                onClick={() => setPeriodFilter('all_time')}
                className={`px-3 py-1 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                  periodFilter === 'all_time'
                    ? 'bg-[#1E1F3D] text-white shadow-xs'
                    : 'bg-[#F4F3FA] text-[#727494] border border-[#E8E4F5] hover:bg-[#ECEAF6]'
                }`}
              >
                كل الوقت
              </button>
              <button
                onClick={() => setPeriodFilter('specific_month')}
                className={`px-3 py-1 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                  periodFilter === 'specific_month'
                    ? 'bg-[#1E1F3D] text-white shadow-xs'
                    : 'bg-[#F4F3FA] text-[#727494] border border-[#E8E4F5] hover:bg-[#ECEAF6]'
                }`}
              >
                شهر محدد
              </button>
              <button
                onClick={() => setPeriodFilter('custom_range')}
                className={`px-3 py-1 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                  periodFilter === 'custom_range'
                    ? 'bg-[#1E1F3D] text-white shadow-xs'
                    : 'bg-[#F4F3FA] text-[#727494] border border-[#E8E4F5] hover:bg-[#ECEAF6]'
                }`}
              >
                فترة مخصصة
              </button>
            </div>
          </div>

          {/* Extended controls for specific month or custom range */}
          {periodFilter === 'specific_month' && (
            <div className="flex items-center gap-2 pt-2 border-t border-[#E8E4F5]">
              <span className="text-[#727494] text-[11px] font-bold">اختر الشهر والسنة:</span>
              <select
                value={selectedSpecificMonth}
                onChange={(e) => setSelectedSpecificMonth(Number(e.target.value))}
                className="p-1.5 rounded-xl bg-[#F4F3FA] border border-[#E8E4F5] font-bold text-xs text-[#14152C]"
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
                className="p-1.5 rounded-xl bg-[#F4F3FA] border border-[#E8E4F5] font-bold text-xs text-[#14152C]"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodFilter === 'custom_range' && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E8E4F5]">
              <div>
                <span className="text-[#727494] text-[10px] block font-bold mb-1">من تاريخ:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full p-2 rounded-2xl bg-[#F4F3FA] border border-[#E8E4F5] text-xs font-bold text-[#14152C]"
                />
              </div>
              <div>
                <span className="text-[#727494] text-[10px] block font-bold mb-1">إلى تاريخ:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full p-2 rounded-2xl bg-[#F4F3FA] border border-[#E8E4F5] text-xs font-bold text-[#14152C]"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* 1. TEACHER GRAND OVERVIEW REPORT (FINANCIAL DASHBOARD) */}
      {/* ========================================== */}
      {reportType === 'teacher_overview' && (
        <div className="space-y-4">
          
          {/* Sub-Navigation for Financial Ledger */}
          <div className="flex items-center justify-between flex-wrap gap-2 p-1.5 neu-card text-xs">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setFinancialSubTab('overview')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  financialSubTab === 'overview'
                    ? 'bg-[#172554] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#111827]'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>نظرة عامة</span>
              </button>

              <button
                type="button"
                onClick={() => setFinancialSubTab('monthly_ledger')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  financialSubTab === 'monthly_ledger'
                    ? 'bg-[#172554] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#111827]'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>السجل الشهري ({financialHistory.months.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setFinancialSubTab('yearly_summary')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  financialSubTab === 'yearly_summary'
                    ? 'bg-[#172554] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#111827]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>السجل السنوي ({financialHistory.years.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setFinancialSubTab('lifetime')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  financialSubTab === 'lifetime'
                    ? 'bg-[#172554] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#111827]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>الإجمالي الشامل</span>
              </button>

              <button
                type="button"
                onClick={() => setFinancialSubTab('payments')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  financialSubTab === 'payments'
                    ? 'bg-[#172554] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#111827]'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>سجل المقبوضات ({filteredPayments.length})</span>
              </button>
            </div>

            {/* Group vs Private Service Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#64748B] font-bold ml-1">الخدمة:</span>
              <button
                type="button"
                onClick={() => setServiceTypeFilter('all')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                  serviceTypeFilter === 'all'
                    ? 'bg-[#172554] text-white border-[#172554]'
                    : 'bg-white text-[#64748B] border-[#E2E8F0] hover:bg-[#F7F8FC]'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setServiceTypeFilter('group')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                  serviceTypeFilter === 'group'
                    ? 'bg-[#172554] text-white border-[#172554]'
                    : 'bg-white text-[#64748B] border-[#E2E8F0] hover:bg-[#F7F8FC]'
                }`}
              >
                مجموعات
              </button>
              <button
                type="button"
                onClick={() => setServiceTypeFilter('private')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                  serviceTypeFilter === 'private'
                    ? 'bg-[#172554] text-white border-[#172554]'
                    : 'bg-white text-[#64748B] border-[#E2E8F0] hover:bg-[#F7F8FC]'
                }`}
              >
                خاص
              </button>
            </div>
          </div>

          {/* 1.1 FINANCIAL OVERVIEW SUB-TAB */}
          {financialSubTab === 'overview' && (
            <div className="space-y-4">
              {/* Main 4 Financial Highlight Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                
                <div className="p-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-emerald-600">
                    <span className="text-[10px] font-medium text-slate-500">المحصل بالفترة</span>
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-xl font-bold text-emerald-700 mt-0.5">
                    {serviceTypeFilter === 'group'
                      ? financialHistory.group.totalCollected
                      : serviceTypeFilter === 'private'
                      ? financialHistory.private.totalCollected
                      : periodRevenue} <span className="text-[10px] text-slate-400">ج</span>
                  </p>
                  <p className="text-[10px] text-slate-400">مقبوضات مسددة ومسبقة</p>
                </div>

                <div className="p-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-rose-600">
                    <span className="text-[10px] font-medium text-slate-500">المستحقات المعلقة</span>
                    <Receipt className="w-4 h-4 text-rose-600" />
                  </div>
                  <p className={`text-xl font-bold mt-0.5 ${teacherSummary.totalRemaining > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {serviceTypeFilter === 'group'
                      ? financialHistory.group.totalRemaining
                      : serviceTypeFilter === 'private'
                      ? financialHistory.private.totalRemaining
                      : teacherSummary.totalRemaining} <span className="text-[10px] text-slate-400">ج</span>
                  </p>
                  <p className="text-[10px] text-slate-400">المتبقي على الطلاب</p>
                </div>

                <div className="p-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-[10px] font-medium text-slate-500">إجمالي الرسوم</span>
                    <Wallet className="w-4 h-4 text-slate-500" />
                  </div>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">
                    {serviceTypeFilter === 'group'
                      ? financialHistory.group.totalDue
                      : serviceTypeFilter === 'private'
                      ? financialHistory.private.totalDue
                      : teacherSummary.totalDues} <span className="text-[10px] text-slate-400">ج</span>
                  </p>
                  <p className="text-[10px] text-slate-400">قيمة الخدمات المسجلة</p>
                </div>

                <div className="p-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
                  <div className="flex items-center justify-between text-blue-600">
                    <span className="text-[10px] font-medium text-slate-500">الحصص المنفذة</span>
                    <CalendarCheck2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">
                    {serviceTypeFilter === 'group'
                      ? financialHistory.group.totalSessions
                      : serviceTypeFilter === 'private'
                      ? financialHistory.private.totalSessions
                      : teacherSummary.totalSessionsConducted}
                  </p>
                  <p className="text-[10px] text-slate-400">حصص تم رصدها</p>
                </div>

              </div>

              {/* Group vs Private Split Overview Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <span className="font-bold text-xs text-blue-950">خدمات المجموعات (Groups)</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                      {financialHistory.group.totalSessions} حصة
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-blue-200/60 text-center">
                    <div>
                      <span className="text-[10px] text-slate-500 block">المحصل</span>
                      <strong className="text-xs font-bold text-emerald-700">{financialHistory.group.totalCollected} ج.م</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">المستحق</span>
                      <strong className="text-xs font-bold text-slate-800">{financialHistory.group.totalDue} ج.م</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">المتبقي</span>
                      <strong className={`text-xs font-bold ${financialHistory.group.totalRemaining > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {financialHistory.group.totalRemaining} ج.م
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-purple-50/70 border border-purple-200/80 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-purple-600" />
                      <span className="font-bold text-xs text-purple-950">الدروس الخاصة (Private)</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                      {financialHistory.private.totalSessions} حصة
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-purple-200/60 text-center">
                    <div>
                      <span className="text-[10px] text-slate-500 block">المحصل</span>
                      <strong className="text-xs font-bold text-emerald-700">{financialHistory.private.totalCollected} ج.م</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">المستحق</span>
                      <strong className="text-xs font-bold text-slate-800">{financialHistory.private.totalDue} ج.م</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">المتبقي</span>
                      <strong className={`text-xs font-bold ${financialHistory.private.totalRemaining > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {financialHistory.private.totalRemaining} ج.م
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Methods Breakdown Section */}
              <div className="p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-2.5">
                <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <PieChart className="w-4 h-4 text-blue-600" />
                  <span>توزيع طرق الدفع والتحصيل</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.entries(methodStats) as [string, { label: string; amount: number; count: number; color: string }][]).map(([key, stat]) => {
                    const percentage = periodRevenue > 0 ? Math.round((stat.amount / periodRevenue) * 100) : 0;
                    return (
                      <div
                        key={key}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                          <span>{stat.label}</span>
                          <span className="text-[10px] bg-white px-1.5 py-0.2 rounded border border-slate-200 text-slate-700">{percentage}%</span>
                        </div>
                        <p className="text-base font-bold text-slate-900">{stat.amount} <span className="text-[10px] text-slate-400">ج.م</span></p>
                        <p className="text-[10px] text-slate-400 font-medium">{stat.count} عملية دفع</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Monthly Revenue History Breakdown */}
              {financialHistory.months.length > 0 && (
                <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-2.5">
                  <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-blue-600" />
                    <span>سجل التحصيلات الشهرية والاتجاهات:</span>
                  </h3>

                  <div className="space-y-1.5">
                    {financialHistory.months.slice(0, 6).map((m) => {
                      const maxRevenue = Math.max(...financialHistory.months.map((x) => x.totalCollected), 1);
                      const barWidth = Math.min(100, Math.round((m.totalCollected / maxRevenue) * 100));

                      return (
                        <div
                          key={m.monthYear}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-800">{m.monthName} {m.year}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500">{m.totalCompletedSessions} حصة</span>
                              <strong className="text-emerald-700 font-bold">{m.totalCollected} ج.م</strong>
                            </div>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-blue-600 h-full rounded-full transition-all duration-300"
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

          {/* 1.2 MONTHLY LEDGER SUB-TAB */}
          {financialSubTab === 'monthly_ledger' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-blue-600" />
                    <span>السجل المالي الشهري المفصل ({financialHistory.months.length} أشهر)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    يشمل إجمالي الحصص المنفذة، الإيرادات المحصلة (المسبقة والمسددة)، والمستحقات المتبقية
                  </p>
                </div>
              </div>

              {financialHistory.months.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-500 text-xs">
                  لا توجد سجلات مالية شهرية مسجلة حتى الآن.
                </div>
              ) : (
                <div className="space-y-3">
                  {financialHistory.months.map((m) => {
                    const isExpanded = expandedMonthYear === m.monthYear;
                    const collectionRate = m.totalDue > 0 ? Math.min(100, Math.round((m.totalCollected / m.totalDue) * 100)) : 100;
                    const relevantData = serviceTypeFilter === 'group' ? m.group : serviceTypeFilter === 'private' ? m.private : m;

                    return (
                      <div
                        key={m.monthYear}
                        className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden transition-all"
                      >
                        {/* Month Header Card */}
                        <div
                          onClick={() => setExpandedMonthYear(isExpanded ? null : m.monthYear)}
                          className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex flex-col items-center justify-center text-blue-700 shrink-0">
                              <span className="text-[10px] font-medium leading-none">{m.year}</span>
                              <span className="text-xs font-bold leading-none mt-0.5">{m.month}</span>
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                                <span>{m.monthName} {m.year}</span>
                                {m.month === currentMonth && m.year === currentYear && (
                                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-600 text-white">الشهر الحالي</span>
                                )}
                              </h4>
                              <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                <span>{m.totalCompletedSessions} حصة منتهية</span>
                                <span>•</span>
                                <span>حضور: {m.presentSessionsCount}</span>
                                {m.lateSessionsCount > 0 && <span>• تأخير: {m.lateSessionsCount}</span>}
                                {m.absentChargedCount > 0 && <span>• غياب محتسب: {m.absentChargedCount}</span>}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-left">
                            <div>
                              <p className="text-sm font-black text-emerald-700">{relevantData.totalCollected} ج.م</p>
                              <p className="text-[10px] text-slate-500 font-medium">
                                من أصل {relevantData.totalDue} ج.م ({collectionRate}%)
                              </p>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>

                        {/* Expandable Details */}
                        {isExpanded && (
                          <div className="p-3.5 bg-slate-50/80 border-t border-slate-100 space-y-3 text-xs">
                            {/* Financial Summary Strip */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                              <div className="p-2 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 block">المحصل الفعلي</span>
                                <strong className="text-xs font-bold text-emerald-700">{relevantData.totalCollected} ج.م</strong>
                              </div>
                              <div className="p-2 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 block">قيمة الحصص (المستحق)</span>
                                <strong className="text-xs font-bold text-slate-800">{relevantData.totalDue} ج.م</strong>
                              </div>
                              <div className="p-2 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 block">المتبقي</span>
                                <strong className={`text-xs font-bold ${relevantData.totalRemaining > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                  {relevantData.totalRemaining} ج.م
                                </strong>
                              </div>
                              <div className="p-2 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 block">نسبة التحصيل</span>
                                <strong className="text-xs font-bold text-blue-600">{collectionRate}%</strong>
                              </div>
                            </div>

                            {/* Group vs Private comparison in this month */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/70 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                                  <span className="font-bold text-[11px] text-blue-950">المجموعات:</span>
                                  <span className="text-[10px] text-blue-700">({m.group.totalSessions} حصة)</span>
                                </div>
                                <div className="text-left font-bold text-[11px] text-emerald-700">
                                  {m.group.totalCollected} ج.م
                                </div>
                              </div>

                              <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-200/70 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-purple-600" />
                                  <span className="font-bold text-[11px] text-purple-950">الدروس الخاصة:</span>
                                  <span className="text-[10px] text-purple-700">({m.private.totalSessions} حصة)</span>
                                </div>
                                <div className="text-left font-bold text-[11px] text-emerald-700">
                                  {m.private.totalCollected} ج.م
                                </div>
                              </div>
                            </div>

                            {/* Attendance Breakdown for Month */}
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                              <span className="font-bold text-slate-700">حالات الحضور:</span>
                              <div className="flex items-center gap-3">
                                <span className="text-emerald-700 font-medium">حاضر: {m.presentSessionsCount}</span>
                                <span className="text-amber-700 font-medium">متأخر: {m.lateSessionsCount}</span>
                                <span className="text-rose-700 font-medium">غياب محتسب: {m.absentChargedCount}</span>
                                <span className="text-slate-500 font-medium">غياب معذور: {m.freeSessionsCount}</span>
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

          {/* 1.3 YEARLY SUMMARY SUB-TAB */}
          {financialSubTab === 'yearly_summary' && (
            <div className="space-y-3">
              <div>
                <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>السجل المالي السنوي ({financialHistory.years.length} سنوات)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  ملخص الإيرادات والمستحقات مجمعة سنوياً مع التفصيل الشهري
                </p>
              </div>

              {financialHistory.years.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-slate-500 text-xs">
                  لا توجد سجلات سنوية مسجلة حتى الآن.
                </div>
              ) : (
                <div className="space-y-4">
                  {financialHistory.years.map((y) => {
                    const isExpanded = expandedYear === y.year;
                    const relevantData = serviceTypeFilter === 'group' ? y.group : serviceTypeFilter === 'private' ? y.private : y;
                    const collectionRate = y.totalDue > 0 ? Math.min(100, Math.round((y.totalCollected / y.totalDue) * 100)) : 100;

                    return (
                      <div
                        key={y.year}
                        className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden"
                      >
                        {/* Year Card Header */}
                        <div
                          onClick={() => setExpandedYear(isExpanded ? null : y.year)}
                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-base flex items-center justify-center shadow-xs">
                              {y.year}
                            </div>
                            <div>
                              <h4 className="font-bold text-base text-slate-900">
                                عام {y.year}
                              </h4>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {y.totalCompletedSessions} حصة منتهية • {y.months.length} أشهر نشطة
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-left">
                            <div>
                              <p className="text-base font-black text-emerald-700">{relevantData.totalCollected} ج.م</p>
                              <p className="text-[10px] text-slate-500 font-medium">
                                من أصل {relevantData.totalDue} ج.م ({collectionRate}%)
                              </p>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>

                        {/* Year Details & Months Table */}
                        {isExpanded && (
                          <div className="p-4 bg-slate-50/80 border-t border-slate-100 space-y-3 text-xs">
                            {/* Year KPIs */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 block">المحصل الإجمالي</span>
                                <strong className="text-sm font-bold text-emerald-700">{relevantData.totalCollected} ج.م</strong>
                              </div>
                              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 block">إجمالي المستحق</span>
                                <strong className="text-sm font-bold text-slate-800">{relevantData.totalDue} ج.م</strong>
                              </div>
                              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 block">المتبقي</span>
                                <strong className={`text-sm font-bold ${relevantData.totalRemaining > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                  {relevantData.totalRemaining} ج.م
                                </strong>
                              </div>
                              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 block">متوسط التحصيل الشهري</span>
                                <strong className="text-sm font-bold text-blue-600">
                                  {y.months.length > 0 ? Math.round(relevantData.totalCollected / y.months.length) : 0} ج.م
                                </strong>
                              </div>
                            </div>

                            {/* Months Grid within this year */}
                            <div className="space-y-1.5 pt-2">
                              <h5 className="font-bold text-xs text-slate-800">الأشهر المسجلة في عام {y.year}:</h5>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {y.months.map((m) => (
                                  <div
                                    key={m.monthYear}
                                    className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between"
                                  >
                                    <div>
                                      <span className="font-bold text-slate-900 block text-xs">{m.monthName}</span>
                                      <span className="text-[10px] text-slate-500">{m.totalCompletedSessions} حصة</span>
                                    </div>
                                    <div className="text-left">
                                      <p className="font-bold text-emerald-700 text-xs">{m.totalCollected} ج.م</p>
                                      <span className="text-[9px] text-slate-400">من {m.totalDue} ج.م</span>
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

          {/* 1.4 LIFETIME / ALL-TIME SUMMARY SUB-TAB */}
          {financialSubTab === 'lifetime' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>الإجمالي الشامل طوال فترة العمل (All-Time Lifetime)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  إجمالي العمليات المالية والحصص منذ بداية استخدام التطبيق
                </p>
              </div>

              {/* Lifetime Grand Highlight Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
                  <span className="text-[10px] font-medium text-slate-500 block">إجمالي المقبوضات الشامل</span>
                  <p className="text-2xl font-black text-emerald-700">{financialHistory.totalCollected} <span className="text-xs text-slate-400">ج.م</span></p>
                  <p className="text-[10px] text-emerald-600 font-medium">شامل الحصص المسبقة والدفعات</p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
                  <span className="text-[10px] font-medium text-slate-500 block">إجمالي المستحقات الكلي</span>
                  <p className="text-2xl font-black text-slate-900">{financialHistory.totalDue} <span className="text-xs text-slate-400">ج.م</span></p>
                  <p className="text-[10px] text-slate-400">قيمة كافة الحصص والخدمات</p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
                  <span className="text-[10px] font-medium text-slate-500 block">إجمالي المتبقي غير المسدد</span>
                  <p className={`text-2xl font-black ${financialHistory.totalRemaining > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {financialHistory.totalRemaining} <span className="text-xs text-slate-400">ج.م</span>
                  </p>
                  <p className="text-[10px] text-slate-400">ديون معلقة على الطلاب</p>
                </div>

                <div className="p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1">
                  <span className="text-[10px] font-medium text-slate-500 block">إجمالي الحصص المنفذة</span>
                  <p className="text-2xl font-black text-blue-600">{financialHistory.totalCompletedSessions}</p>
                  <p className="text-[10px] text-slate-400">حصة تم رصد حضورها</p>
                </div>
              </div>

              {/* Group vs Private Lifetime Breakdown */}
              <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3">
                <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>مقارنة إجماليات المجموعات والدروس الخاصة (All-Time)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-blue-950">خدمات المجموعات</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                        {financialHistory.group.totalSessions} حصة
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-blue-200/60">
                      <div>
                        <span className="text-[10px] text-slate-500 block">المحصل</span>
                        <strong className="text-xs font-bold text-emerald-700">{financialHistory.group.totalCollected} ج.م</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">المستحق</span>
                        <strong className="text-xs font-bold text-slate-800">{financialHistory.group.totalDue} ج.م</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">المتبقي</span>
                        <strong className={`text-xs font-bold ${financialHistory.group.totalRemaining > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {financialHistory.group.totalRemaining} ج.م
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-purple-950">الدروس الخاصة</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                        {financialHistory.private.totalSessions} حصة
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-purple-200/60">
                      <div>
                        <span className="text-[10px] text-slate-500 block">المحصل</span>
                        <strong className="text-xs font-bold text-emerald-700">{financialHistory.private.totalCollected} ج.م</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">المستحق</span>
                        <strong className="text-xs font-bold text-slate-800">{financialHistory.private.totalDue} ج.م</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">المتبقي</span>
                        <strong className={`text-xs font-bold ${financialHistory.private.totalRemaining > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {financialHistory.private.totalRemaining} ج.م
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 1.5 PAYMENT RECEIPTS LOG SUB-TAB */}
          {financialSubTab === 'payments' && (
            <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-blue-600" />
                  <span>سجل المدفوعات المسجلة ({filteredPayments.length}):</span>
                </h3>

                <div className="flex items-center gap-2">
                  <select
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value)}
                    className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800"
                  >
                    <option value="all">كل طرق الدفع</option>
                    <option value="cash">كاش</option>
                    <option value="vodafone_cash">فودافون كاش</option>
                    <option value="instapay">إنستاباي</option>
                    <option value="bank_transfer">تحويل بنكي</option>
                  </select>

                  <div className="relative w-36 sm:w-44">
                    <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={paymentSearchQuery}
                      onChange={(e) => setPaymentSearchQuery(e.target.value)}
                      placeholder="بحث في المدفوعات..."
                      className="w-full pr-8 pl-7 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-900"
                    />
                    {paymentSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setPaymentSearchQuery('')}
                        className="absolute left-2 top-2 text-slate-400 hover:text-slate-800"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {filteredPayments.length === 0 ? (
                <p className="text-xs text-slate-500 text-center p-4">لا توجد مدفوعات مطابقة للفترة والبحث.</p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto android-scrollbar">
                  {filteredPayments.slice(0, 30).map((p) => {
                    const student = students.find((s) => s.id === p.studentId);
                    return (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs gap-2"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <span className="font-bold text-slate-900 block truncate">{student?.name || 'طالب غير محدد'}</span>
                          <p className="text-[10px] text-slate-500">
                            {p.date} • {p.paymentType === 'specific_month' ? `شهر ${getArabicMonthName(p.targetMonth || 1)}` : 'سداد حصص'} {p.notes ? `• ${p.notes}` : ''}
                          </p>
                        </div>

                        <div className="text-left shrink-0">
                          <p className="font-bold text-emerald-700">{p.amount} ج.م</p>
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-white border border-slate-200 text-slate-600">
                            {p.paymentMethod === 'vodafone_cash' ? 'فودافون كاش' : p.paymentMethod === 'instapay' ? 'إنستاباي' : p.paymentMethod === 'bank_transfer' ? 'تحويل بنكي' : 'كاش'}
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

      {/* ========================================== */}
      {/* 2. OVERDUE STUDENTS LIST */}
      {/* ========================================== */}
      {reportType === 'overdue_list' && (
        <div className="space-y-3">
          <div className="p-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-xs text-slate-900">كشف حساب الطلاب ذوي المستحقات المتأخرة</h3>
              <p className="text-[11px] text-slate-500">
                إجمالي الديون المعلقة: <strong className="text-rose-600">{teacherSummary.totalRemaining} ج.م</strong> على {overdueStudentsList.length} طالب
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-40 sm:w-48">
                <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={overdueSearchQuery}
                  onChange={(e) => setOverdueSearchQuery(e.target.value)}
                  placeholder="بحث في المتأخرات..."
                  className="w-full pr-8 pl-7 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-900"
                />
                {overdueSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setOverdueSearchQuery('')}
                    className="absolute left-2 top-2 text-slate-400 hover:text-slate-800"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {onOpenAddPayment && (
                <button
                  onClick={() => onOpenAddPayment()}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition-all active:scale-95"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>تسجيل دفعة</span>
                </button>
              )}
            </div>
          </div>

          {overdueStudentsList.length === 0 ? (
            <div className="p-8 bg-white border border-slate-200/90 rounded-2xl text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto opacity-70" />
              <h4 className="font-bold text-sm text-slate-900">لا توجد أي مديونيات متأخرة!</h4>
              <p className="text-xs text-slate-500">جميع الطلاب مسددون لالتزاماتهم بالكامل</p>
            </div>
          ) : (
            <div className="space-y-2">
              {overdueStudentsList.map((item) => {
                const phoneForWa = item.student.parentPhone || item.student.phone;
                return (
                  <div
                    key={item.student.id}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-rose-300 transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">{item.student.name}</h4>
                        <p className="text-[10px] text-slate-500">
                          {getLocalizedStageName(item.student.gradeLevel)} {item.student.parentPhone ? `• ولي الأمر: ${item.student.parentPhone}` : ''}
                        </p>
                      </div>

                      <div className="text-left">
                        <span className="text-[10px] font-medium text-slate-500 block">المستحق المتبقي</span>
                        <strong className="text-sm font-bold text-rose-600">{item.grandRemaining} ج.م</strong>
                      </div>
                    </div>

                    {/* Services Breakdown */}
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="text-slate-500">إجمالي الرسوم: </span>
                        <strong className="text-slate-900">{item.grandTotalDue} ج</strong>
                        <span className="text-slate-500 mr-2"> | المسدد: </span>
                        <strong className="text-emerald-700">{item.grandTotalPaid} ج</strong>
                      </div>
                      {item.lastPayment && (
                        <span className="text-[10px] text-slate-500">
                          آخر سداد: {item.lastPayment.date} ({item.lastPayment.amount}ج)
                        </span>
                      )}
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      {phoneForWa && (
                        <a
                          href={`https://wa.me/${phoneForWa.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                            `السلام عليكم ورحمة الله، تذكير بمستحقات درس ${item.student.name}، المتبقي ${item.grandRemaining} ج.م. شكراً لتعاونكم.`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-medium flex items-center gap-1 transition-all"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>تذكير واتساب</span>
                        </a>
                      )}

                      {onOpenAddPayment && (
                        <button
                          onClick={() => onOpenAddPayment(item.student)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow-2xs transition-all active:scale-95"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>سداد الآن</span>
                        </button>
                      )}

                      {onOpenStudentProfile && (
                        <button
                          onClick={() => onOpenStudentProfile(item.student)}
                          className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          الملف
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

      {/* ========================================== */}
      {/* 3. GROUP REPORT */}
      {/* ========================================== */}
      {reportType === 'group_report' && (
        <div className="space-y-4">
          
          {/* Group Selector */}
          <div className="p-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1.5">
            <label className="font-bold text-xs text-slate-900">اختر المجموعة:</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500"
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
              {/* Group Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 bg-white border border-slate-200/90 rounded-2xl text-center">
                  <span className="text-[10px] text-slate-500 font-medium">إجمالي الرسوم (Gross)</span>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">{selectedGroupFin.totalDue} ج</p>
                </div>
                <div className="p-3 bg-white border border-slate-200/90 rounded-2xl text-center">
                  <span className="text-[10px] text-slate-500 font-medium">إجمالي المدفوع</span>
                  <p className="text-lg font-bold text-emerald-700 mt-0.5">{selectedGroupFin.totalPaid} ج</p>
                </div>
                <div className="p-3 bg-white border border-slate-200/90 rounded-2xl text-center">
                  <span className="text-[10px] text-slate-500 font-medium">المتبقي (Outstanding)</span>
                  <p className={`text-lg font-bold mt-0.5 ${selectedGroupFin.remaining > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {selectedGroupFin.remaining} ج
                  </p>
                </div>
                <div className="p-3 bg-white border border-slate-200/90 rounded-2xl text-center">
                  <span className="text-[10px] text-slate-500 font-medium">الحصص المنفذة</span>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">{selectedGroupFin.totalCompletedSessions} حصة</p>
                </div>
              </div>

              {/* Students Ledger Table in Group */}
              <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-900">
                    كشف حساب طلاب المجموعة ({selectedGroupFin.studentsSummary.length} طلاب):
                  </h3>
                  <span className="text-[11px] text-blue-600 font-medium">
                    إجمالي رصيد الحصص المسبقة: {selectedGroupFin.totalPrepaidCredits}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full text-right text-[11px]">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="p-2 font-medium">الطالب</th>
                        <th className="p-2 font-medium">الحصص المستهلكة</th>
                        <th className="p-2 font-medium">إجمالي الرسوم</th>
                        <th className="p-2 font-medium">المسدد</th>
                        <th className="p-2 font-medium">المتبقي المطلوب</th>
                        <th className="p-2 font-medium">رصيد الحصص</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedGroupFin.studentsSummary.map((item) => (
                        <tr key={item.student.id} className="bg-white hover:bg-slate-50">
                          <td className="p-2 font-medium text-slate-900">{item.student.name}</td>
                          <td className="p-2 text-slate-600">{item.attendedCount} حصة</td>
                          <td className="p-2 font-medium text-slate-900">{item.totalDue} ج</td>
                          <td className="p-2 font-medium text-emerald-700">{item.totalPaid} ج</td>
                          <td className={`p-2 font-medium ${item.remaining > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {item.remaining} ج
                          </td>
                          <td className="p-2">
                            <span
                              className={`px-1.5 py-0.5 rounded font-medium text-[10px] ${
                                item.sessionCredit > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
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

      {/* ========================================== */}
      {/* 4. STUDENT REPORT */}
      {/* ========================================== */}
      {reportType === 'student_report' && (
        <div className="space-y-4">
          
          {/* Student Selector with Search */}
          <div className="p-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs text-slate-900">اختر الطالب:</label>
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  placeholder="بحث عن طالب..."
                  className="w-full pr-8 pl-7 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-900 focus:outline-none focus:border-blue-500"
                />
                {studentSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setStudentSearchQuery('')}
                    className="absolute left-2 top-2 text-slate-400 hover:text-slate-800"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500"
            >
              {students
                .filter((s) => s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()))
                .map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({getLocalizedStageName(st.gradeLevel) || 'غير محدد'})
                  </option>
                ))}
            </select>
          </div>

          {selectedStudentGrandFin && selectedStudentObj && (
            <div className="space-y-4">
              
              {/* Grand Student Summary Card */}
              <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">{selectedStudentObj.name}</h3>
                    <p className="text-xs text-slate-500">{getLocalizedStageName(selectedStudentObj.gradeLevel) || 'الصف غير محدد'}</p>
                  </div>

                  <div className="text-left">
                    <span className="text-[10px] text-slate-500 font-medium block">رصيد الحصص الكلي</span>
                    <strong className="text-base text-blue-600 font-bold">
                      {selectedStudentGrandFin.totalSessionCredit} حصص
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-medium block">إجمالي الرسوم (Gross)</span>
                    <strong className="text-base text-slate-900 mt-0.5 block">{selectedStudentGrandFin.grandTotalDue} ج</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-medium block">إجمالي المدفوع</span>
                    <strong className="text-base text-emerald-700 mt-0.5 block">{selectedStudentGrandFin.grandTotalPaid} ج</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-medium block">المستحق المتبقي (Outstanding)</span>
                    <strong className={`text-base mt-0.5 block ${selectedStudentGrandFin.grandRemaining > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {selectedStudentGrandFin.grandRemaining} ج
                    </strong>
                  </div>
                </div>

                {selectedStudentGrandFin.totalFinancialCredit > 0 && (
                  <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-medium flex items-center justify-between">
                    <span>الرصيد المالي المتبقي للطالب (Financial Credit):</span>
                    <strong>{selectedStudentGrandFin.totalFinancialCredit} ج.م</strong>
                  </div>
                )}
              </div>

              {/* Individual Services Breakdown (Group & Private) */}
              <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3">
                <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>تفاصيل الاشتراكات والخدمات المستقلة (Group & Private):</span>
                </h4>

                <div className="space-y-2.5">
                  {selectedStudentGrandFin.enrollmentsSummary.map((summary) => (
                    <div
                      key={summary.enrollmentId}
                      className={`p-3 rounded-xl border space-y-2 ${
                        summary.groupType === 'private'
                          ? 'bg-amber-50/50 border-amber-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: summary.accentColor }}
                          />
                          <strong className="text-xs text-slate-900">{summary.groupName}</strong>
                          <span
                            className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${
                              summary.groupType === 'private'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {summary.groupType === 'private' ? 'درس خاص (Private)' : 'مجموعة'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {summary.billingMode === 'hourly' || summary.billingType === 'hourly' ? 'سعر الساعة:' : 'سعر الحصة:'} <strong className="text-slate-900">{summary.customPrice} ج.م</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                        <div className="p-1.5 bg-white rounded-lg border border-slate-200">
                          <span className="text-slate-500 block text-[9px]">
                            {summary.billingMode === 'hourly' || summary.billingType === 'hourly' ? 'الساعات المنفذة' : 'المستهلك'}
                          </span>
                          <strong className="text-xs text-slate-900">
                            {summary.billingMode === 'hourly' || summary.billingType === 'hourly' ? `${summary.totalHours ?? 0} ساعة` : (summary.usedSessionsCount || 0)}
                          </strong>
                        </div>
                        <div className="p-1.5 bg-white rounded-lg border border-slate-200">
                          <span className="text-slate-500 block text-[9px]">
                            {summary.billingMode === 'hourly' || summary.billingType === 'hourly' ? 'إجمالي الرسوم' : 'رصيد الحصص'}
                          </span>
                          <strong className="text-xs text-blue-600">
                            {summary.billingMode === 'hourly' || summary.billingType === 'hourly'
                              ? `${summary.totalDue} ج`
                              : `${summary.sessionCredit} ${summary.sessionCredit > 0 ? `(${summary.sessionCreditValue || summary.sessionCredit * summary.customPrice}ج)` : ''}`}
                          </strong>
                        </div>
                        <div className="p-1.5 bg-white rounded-lg border border-slate-200">
                          <span className="text-slate-500 block text-[9px]">المدفوع</span>
                          <strong className="text-xs text-emerald-700">{summary.totalPaid} ج</strong>
                        </div>
                        <div className={`p-1.5 rounded-lg border ${summary.remaining > 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white border-slate-200 text-emerald-700'}`}>
                          <span className="block text-[9px]">المتبقي (Current Due)</span>
                          <strong className="text-xs">
                            {summary.remaining} ج {(summary.billingMode === 'hourly' || summary.billingType === 'hourly') ? (summary.unpaidHours ? `(${summary.unpaidHours}س)` : '') : (summary.unpaidSessionsCount > 0 ? `(${summary.unpaidSessionsCount}ح)` : '')}
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Student Payments Ledger */}
              <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-2.5">
                <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-blue-600" />
                  <span>سجل مدفوعات الطالب:</span>
                </h4>

                {selectedStudentGrandFin.allPayments.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center p-4">لا توجد مدفوعات مسجلة.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedStudentGrandFin.allPayments.map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{p.amount} ج.م</p>
                          <p className="text-[10px] text-slate-500">
                            {p.date} • {p.paymentType === 'specific_month' ? `شهر ${getArabicMonthName(p.targetMonth || 1)}` : 'سداد حصص'}
                          </p>
                        </div>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                          {p.paymentMethod === 'vodafone_cash' ? 'فودافون كاش' : p.paymentMethod === 'instapay' ? 'إنستاباي' : p.paymentMethod === 'bank_transfer' ? 'تحويل بنكي' : 'كاش'}
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
