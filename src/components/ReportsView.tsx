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
import { Student, Group, Session, Payment, ReportPeriodFilter } from '../types';
import { db, getArabicMonthName } from '../utils/storage';
import { getLocalizedStageName } from '../utils/stages';

interface ReportsViewProps {
  students: Student[];
  groups: Group[];
  sessions: Session[];
  payments: Payment[];
  onOpenAddPayment?: (student?: Student, enrollmentId?: string) => void;
  onOpenStudentProfile?: (student: Student) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  students,
  groups,
  sessions,
  payments,
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

  // Selected Student / Group for dedicated reports
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [overdueSearchQuery, setOverdueSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  // 1. Overall Teacher Calculations
  const teacherSummary = useMemo(() => {
    return db.calculateTeacherFinancialOverview(periodFilter);
  }, [periodFilter, students, payments, sessions]);

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
    return filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [filteredPayments]);

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
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-4 text-[#272D24] pb-24" dir="rtl">
      
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-serif text-[#272D24] tracking-tight">
            التقارير والكشوف المالية
          </h1>
          <p className="text-xs text-[#878E82] font-medium mt-0.5">
            اللوحة المالية الشاملة وتحليلات الإيرادات والتحصيل
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="px-3 py-2 rounded-2xl bg-white hover:bg-[#F5F2EC] text-[#272D24] border border-[#EAE6DE] font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
        >
          <Printer className="w-4 h-4 text-[#607B5E]" />
          <span>طباعة</span>
        </button>
      </div>

      {/* 4 Report Navigation Tabs - Sticky on Mobile & Desktop */}
      <div className="sticky top-0 z-20 bg-[#FAF8F5]/95 backdrop-blur-xs pt-1 pb-1 -mx-1 px-1">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs text-xs font-bold">
          <button
            type="button"
            onClick={() => setReportType('teacher_overview')}
            className={`py-2 px-1 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 ${
              reportType === 'teacher_overview'
                ? 'bg-[#607B5E] text-white shadow-xs'
                : 'text-[#5F675A] hover:bg-[#FAF8F5]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">اللوحة المالية</span>
          </button>

          <button
            type="button"
            onClick={() => setReportType('overdue_list')}
            className={`py-2 px-1 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 ${
              reportType === 'overdue_list'
                ? 'bg-[#607B5E] text-white shadow-xs'
                : 'text-[#5F675A] hover:bg-[#FAF8F5]'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">المستحقات ({overdueStudentsList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setReportType('group_report')}
            className={`py-2 px-1 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 ${
              reportType === 'group_report'
                ? 'bg-[#607B5E] text-white shadow-xs'
                : 'text-[#5F675A] hover:bg-[#FAF8F5]'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">المجموعات</span>
          </button>

          <button
            type="button"
            onClick={() => setReportType('student_report')}
            className={`py-2 px-1 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 ${
              reportType === 'student_report'
                ? 'bg-[#607B5E] text-white shadow-xs'
                : 'text-[#5F675A] hover:bg-[#FAF8F5]'
            }`}
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">تقرير الطالب</span>
          </button>
        </div>
      </div>

      {/* Time Period Filter Bar (Common for Reports) */}
      {reportType !== 'overdue_list' && (
        <div className="p-3 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs space-y-2 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="font-bold text-[#272D24] flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#607B5E]" />
              <span>الفترة الزمنية:</span>
            </span>

            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setPeriodFilter('last_7_days')}
                className={`px-2 py-1 rounded-lg font-medium text-[11px] border transition-all ${
                  periodFilter === 'last_7_days'
                    ? 'bg-[#607B5E] text-white border-[#607B5E]'
                    : 'bg-[#FAF8F5] text-[#5F675A] border-[#EAE6DE] hover:bg-[#F5F2EC]'
                }`}
              >
                آخر 7 أيام
              </button>
              <button
                onClick={() => setPeriodFilter('this_month')}
                className={`px-2 py-1 rounded-lg font-medium text-[11px] border transition-all ${
                  periodFilter === 'this_month'
                    ? 'bg-[#607B5E] text-white border-[#607B5E]'
                    : 'bg-[#FAF8F5] text-[#5F675A] border-[#EAE6DE] hover:bg-[#F5F2EC]'
                }`}
              >
                هذا الشهر
              </button>
              <button
                onClick={() => setPeriodFilter('last_month')}
                className={`px-2 py-1 rounded-lg font-medium text-[11px] border transition-all ${
                  periodFilter === 'last_month'
                    ? 'bg-[#607B5E] text-white border-[#607B5E]'
                    : 'bg-[#FAF8F5] text-[#5F675A] border-[#EAE6DE] hover:bg-[#F5F2EC]'
                }`}
              >
                الشهر الماضي
              </button>
              <button
                onClick={() => setPeriodFilter('all_time')}
                className={`px-2 py-1 rounded-lg font-medium text-[11px] border transition-all ${
                  periodFilter === 'all_time'
                    ? 'bg-[#607B5E] text-white border-[#607B5E]'
                    : 'bg-[#FAF8F5] text-[#5F675A] border-[#EAE6DE] hover:bg-[#F5F2EC]'
                }`}
              >
                كل الوقت
              </button>
              <button
                onClick={() => setPeriodFilter('specific_month')}
                className={`px-2 py-1 rounded-lg font-medium text-[11px] border transition-all ${
                  periodFilter === 'specific_month'
                    ? 'bg-[#607B5E] text-white border-[#607B5E]'
                    : 'bg-[#FAF8F5] text-[#5F675A] border-[#EAE6DE] hover:bg-[#F5F2EC]'
                }`}
              >
                شهر محدد
              </button>
              <button
                onClick={() => setPeriodFilter('custom_range')}
                className={`px-2 py-1 rounded-lg font-medium text-[11px] border transition-all ${
                  periodFilter === 'custom_range'
                    ? 'bg-[#607B5E] text-white border-[#607B5E]'
                    : 'bg-[#FAF8F5] text-[#5F675A] border-[#EAE6DE] hover:bg-[#F5F2EC]'
                }`}
              >
                فترة مخصصة
              </button>
            </div>
          </div>

          {/* Extended controls for specific month or custom range */}
          {periodFilter === 'specific_month' && (
            <div className="flex items-center gap-2 pt-1 border-t border-[#EAE6DE]/60">
              <span className="text-[#878E82] text-[11px]">اختر الشهر والسنة:</span>
              <select
                value={selectedSpecificMonth}
                onChange={(e) => setSelectedSpecificMonth(Number(e.target.value))}
                className="p-1 rounded-lg bg-[#FAF8F5] border border-[#EAE6DE] font-medium text-xs text-[#272D24]"
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
                className="p-1 rounded-lg bg-[#FAF8F5] border border-[#EAE6DE] font-medium text-xs text-[#272D24]"
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
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#EAE6DE]/60">
              <div>
                <span className="text-[#878E82] text-[10px] block">من تاريخ:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full p-1.5 rounded-lg bg-[#FAF8F5] border border-[#EAE6DE] text-xs font-medium text-[#272D24]"
                />
              </div>
              <div>
                <span className="text-[#878E82] text-[10px] block">إلى تاريخ:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full p-1.5 rounded-lg bg-[#FAF8F5] border border-[#EAE6DE] text-xs font-medium text-[#272D24]"
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
          
          {/* Main 4 Financial Highlight Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            
            <div className="p-3 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs space-y-1">
              <div className="flex items-center justify-between text-[#607B5E]">
                <span className="text-[10px] font-medium text-[#878E82]">المحصل بالفترة</span>
                <DollarSign className="w-4 h-4 text-[#607B5E]" />
              </div>
              <p className="text-xl font-bold text-[#607B5E] mt-0.5">{periodRevenue} <span className="text-[10px] text-[#878E82]">ج</span></p>
              <p className="text-[10px] text-[#878E82]">إجمالي المقبوضات</p>
            </div>

            <div className="p-3 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs space-y-1">
              <div className="flex items-center justify-between text-[#B86B52]">
                <span className="text-[10px] font-medium text-[#878E82]">المستحقات المعلقة</span>
                <Receipt className="w-4 h-4 text-[#B86B52]" />
              </div>
              <p className={`text-xl font-bold mt-0.5 ${teacherSummary.totalRemaining > 0 ? 'text-[#B86B52]' : 'text-[#607B5E]'}`}>
                {teacherSummary.totalRemaining} <span className="text-[10px] text-[#878E82]">ج</span>
              </p>
              <p className="text-[10px] text-[#878E82]">المتبقي على الطلاب</p>
            </div>

            <div className="p-3 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs space-y-1">
              <div className="flex items-center justify-between text-[#272D24]">
                <span className="text-[10px] font-medium text-[#878E82]">إجمالي الرسوم</span>
                <Wallet className="w-4 h-4 text-[#5F675A]" />
              </div>
              <p className="text-xl font-bold text-[#272D24] mt-0.5">{teacherSummary.totalDues} <span className="text-[10px] text-[#878E82]">ج</span></p>
              <p className="text-[10px] text-[#878E82]">قيمة الخدمات المسجلة</p>
            </div>

            <div className="p-3 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs space-y-1">
              <div className="flex items-center justify-between text-[#586E7E]">
                <span className="text-[10px] font-medium text-[#878E82]">الحصص المنفذة</span>
                <CalendarCheck2 className="w-4 h-4 text-[#586E7E]" />
              </div>
              <p className="text-xl font-bold text-[#272D24] mt-0.5">{teacherSummary.totalSessionsConducted}</p>
              <p className="text-[10px] text-[#878E82]">حصص تم رصدها</p>
            </div>

          </div>

          {/* Payment Methods Breakdown Section */}
          <div className="p-3.5 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs space-y-2.5">
            <h3 className="font-bold text-xs text-[#272D24] flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-[#607B5E]" />
              <span>توزيع طرق الدفع والتحصيل</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.entries(methodStats) as [string, { label: string; amount: number; count: number; color: string }][]).map(([key, stat]) => {
                const percentage = periodRevenue > 0 ? Math.round((stat.amount / periodRevenue) * 100) : 0;
                return (
                  <div
                    key={key}
                    className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE] space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] font-medium text-[#5F675A]">
                      <span>{stat.label}</span>
                      <span className="text-[10px] bg-white px-1.5 py-0.2 rounded border border-[#EAE6DE]">{percentage}%</span>
                    </div>
                    <p className="text-base font-bold text-[#272D24]">{stat.amount} <span className="text-[10px] text-[#878E82]">ج.م</span></p>
                    <p className="text-[10px] text-[#878E82] font-medium">{stat.count} عملية دفع</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly Revenue History Breakdown */}
          {teacherSummary.monthlyRevenues.length > 0 && (
            <div className="p-4 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs space-y-2.5">
              <h3 className="font-bold text-xs text-[#272D24] flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-[#607B5E]" />
                <span>سجل التحصيلات الشهرية والاتجاهات:</span>
              </h3>

              <div className="space-y-1.5">
                {teacherSummary.monthlyRevenues.map((m) => {
                  const maxRevenue = Math.max(...teacherSummary.monthlyRevenues.map((x) => x.revenue), 1);
                  const barWidth = Math.min(100, Math.round((m.revenue / maxRevenue) * 100));

                  return (
                    <div
                      key={m.monthYear}
                      className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE] space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[#272D24]">{m.monthYear}</span>
                        <strong className="text-[#607B5E] font-bold">{m.revenue} ج.م</strong>
                      </div>
                      <div className="w-full bg-[#EAE6DE] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#607B5E] h-full rounded-full transition-all duration-300"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detailed Payment History Log */}
          <div className="p-4 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-xs text-[#272D24] flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-[#607B5E]" />
                <span>سجل المدفوعات المسجلة ({filteredPayments.length}):</span>
              </h3>

              <div className="flex items-center gap-2">
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="p-1.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE] text-xs font-medium text-[#272D24]"
                >
                  <option value="all">كل طرق الدفع</option>
                  <option value="cash">كاش</option>
                  <option value="vodafone_cash">فودافون كاش</option>
                  <option value="instapay">إنستاباي</option>
                  <option value="bank_transfer">تحويل بنكي</option>
                </select>

                <div className="relative w-36 sm:w-44">
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-[#878E82]" />
                  <input
                    type="text"
                    value={paymentSearchQuery}
                    onChange={(e) => setPaymentSearchQuery(e.target.value)}
                    placeholder="بحث في المدفوعات..."
                    className="w-full pr-8 pl-7 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE] text-[11px]"
                  />
                  {paymentSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setPaymentSearchQuery('')}
                      className="absolute left-2 top-2 text-[#878E82] hover:text-[#272D24]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {filteredPayments.length === 0 ? (
              <p className="text-xs text-[#878E82] text-center p-4">لا توجد مدفوعات مطابقة للفترة والبحث.</p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto android-scrollbar">
                {filteredPayments.slice(0, 30).map((p) => {
                  const student = students.find((s) => s.id === p.studentId);
                  return (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE] flex items-center justify-between text-xs gap-2"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <span className="font-bold text-[#272D24] block truncate">{student?.name || 'طالب غير محدد'}</span>
                        <p className="text-[10px] text-[#878E82]">
                          {p.date} • {p.paymentType === 'specific_month' ? `شهر ${getArabicMonthName(p.targetMonth || 1)}` : 'سداد حصص'} {p.notes ? `• ${p.notes}` : ''}
                        </p>
                      </div>

                      <div className="text-left shrink-0">
                        <p className="font-bold text-[#607B5E]">{p.amount} ج.م</p>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-white border border-[#EAE6DE] text-[#5F675A]">
                          {p.paymentMethod === 'vodafone_cash' ? 'فودافون كاش' : p.paymentMethod === 'instapay' ? 'إنستاباي' : p.paymentMethod === 'bank_transfer' ? 'تحويل بنكي' : 'كاش'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================== */}
      {/* 2. OVERDUE STUDENTS LIST */}
      {/* ========================================== */}
      {reportType === 'overdue_list' && (
        <div className="space-y-3">
          <div className="p-3 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-xs text-[#272D24]">كشف حساب الطلاب ذوي المستحقات المتأخرة</h3>
              <p className="text-[11px] text-[#878E82]">
                إجمالي الديون المعلقة: <strong className="text-[#B86B52]">{teacherSummary.totalRemaining} ج.م</strong> على {overdueStudentsList.length} طالب
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-40 sm:w-48">
                <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-[#878E82]" />
                <input
                  type="text"
                  value={overdueSearchQuery}
                  onChange={(e) => setOverdueSearchQuery(e.target.value)}
                  placeholder="بحث في المتأخرات..."
                  className="w-full pr-8 pl-7 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE] text-[11px]"
                />
                {overdueSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setOverdueSearchQuery('')}
                    className="absolute left-2 top-2 text-[#878E82] hover:text-[#272D24]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {onOpenAddPayment && (
                <button
                  onClick={() => onOpenAddPayment()}
                  className="px-3 py-1.5 rounded-xl bg-[#607B5E] text-white font-bold text-xs flex items-center gap-1 shadow-xs"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>تسجيل دفعة</span>
                </button>
              )}
            </div>
          </div>

          {overdueStudentsList.length === 0 ? (
            <div className="p-8 bg-white border border-[#EAE6DE] rounded-2xl text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-[#607B5E] mx-auto opacity-70" />
              <h4 className="font-bold text-sm text-[#272D24]">لا توجد أي مديونيات متأخرة!</h4>
              <p className="text-xs text-[#878E82]">جميع الطلاب مسددون لالتزاماتهم بالكامل</p>
            </div>
          ) : (
            <div className="space-y-2">
              {overdueStudentsList.map((item) => {
                const phoneForWa = item.student.parentPhone || item.student.phone;
                return (
                  <div
                    key={item.student.id}
                    className="p-3.5 rounded-2xl bg-white border border-[#EAE6DE] shadow-xs hover:border-[#B86B52]/40 transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-xs text-[#272D24]">{item.student.name}</h4>
                        <p className="text-[10px] text-[#878E82]">
                          {getLocalizedStageName(item.student.gradeLevel)} {item.student.parentPhone ? `• ولي الأمر: ${item.student.parentPhone}` : ''}
                        </p>
                      </div>

                      <div className="text-left">
                        <span className="text-[10px] font-medium text-[#878E82] block">المستحق المتبقي</span>
                        <strong className="text-sm font-bold text-[#B86B52]">{item.grandRemaining} ج.م</strong>
                      </div>
                    </div>

                    {/* Services Breakdown */}
                    <div className="p-2 bg-[#FAF8F5] rounded-xl border border-[#EAE6DE] flex items-center justify-between text-[11px]">
                      <div>
                        <span className="text-[#878E82]">إجمالي الرسوم: </span>
                        <strong>{item.grandTotalDue} ج</strong>
                        <span className="text-[#878E82] mr-2"> | المسدد: </span>
                        <strong className="text-[#607B5E]">{item.grandTotalPaid} ج</strong>
                      </div>
                      {item.lastPayment && (
                        <span className="text-[10px] text-[#878E82]">
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
                          className="px-2.5 py-1.5 rounded-xl bg-[#607B5E]/12 text-[#4E664C] hover:bg-[#607B5E]/20 text-xs font-medium flex items-center gap-1 transition-all"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>تذكير واتساب</span>
                        </a>
                      )}

                      {onOpenAddPayment && (
                        <button
                          onClick={() => onOpenAddPayment(item.student)}
                          className="px-3 py-1.5 rounded-xl bg-[#607B5E] hover:bg-[#50684E] text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-all"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>سداد الآن</span>
                        </button>
                      )}

                      {onOpenStudentProfile && (
                        <button
                          onClick={() => onOpenStudentProfile(item.student)}
                          className="px-2.5 py-1.5 rounded-xl bg-white border border-[#EAE6DE] text-xs font-medium text-[#3E453A] hover:bg-[#F5F2EC]"
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
          <div className="p-3 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs space-y-1.5">
            <label className="font-bold text-xs text-[#272D24]">اختر المجموعة:</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE] text-xs font-medium text-[#272D24] focus:outline-none focus:border-[#607B5E]"
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
                <div className="p-3 bg-white border border-[#EAE6DE] rounded-2xl text-center">
                  <span className="text-[10px] text-[#878E82] font-medium">إجمالي الرسوم (Gross)</span>
                  <p className="text-lg font-bold text-[#272D24] mt-0.5">{selectedGroupFin.totalDue} ج</p>
                </div>
                <div className="p-3 bg-white border border-[#EAE6DE] rounded-2xl text-center">
                  <span className="text-[10px] text-[#878E82] font-medium">إجمالي المدفوع</span>
                  <p className="text-lg font-bold text-[#607B5E] mt-0.5">{selectedGroupFin.totalPaid} ج</p>
                </div>
                <div className="p-3 bg-white border border-[#EAE6DE] rounded-2xl text-center">
                  <span className="text-[10px] text-[#878E82] font-medium">المتبقي (Outstanding)</span>
                  <p className={`text-lg font-bold mt-0.5 ${selectedGroupFin.remaining > 0 ? 'text-[#B86B52]' : 'text-[#607B5E]'}`}>
                    {selectedGroupFin.remaining} ج
                  </p>
                </div>
                <div className="p-3 bg-white border border-[#EAE6DE] rounded-2xl text-center">
                  <span className="text-[10px] text-[#878E82] font-medium">الحصص المنفذة</span>
                  <p className="text-lg font-bold text-[#272D24] mt-0.5">{selectedGroupFin.totalCompletedSessions} حصة</p>
                </div>
              </div>

              {/* Students Ledger Table in Group */}
              <div className="p-4 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-[#272D24]">
                    كشف حساب طلاب المجموعة ({selectedGroupFin.studentsSummary.length} طلاب):
                  </h3>
                  <span className="text-[11px] text-[#607B5E] font-medium">
                    إجمالي رصيد الحصص المسبقة: {selectedGroupFin.totalPrepaidCredits}
                  </span>
                </div>

                <div className="rounded-xl border border-[#EAE6DE] overflow-x-auto">
                  <table className="w-full text-right text-[11px]">
                    <thead className="bg-[#F5F2EC] text-[#5F675A]">
                      <tr>
                        <th className="p-2 font-medium">الطالب</th>
                        <th className="p-2 font-medium">الحصص المستهلكة</th>
                        <th className="p-2 font-medium">إجمالي الرسوم</th>
                        <th className="p-2 font-medium">المسدد</th>
                        <th className="p-2 font-medium">المتبقي المطلوب</th>
                        <th className="p-2 font-medium">رصيد الحصص</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAE6DE]">
                      {selectedGroupFin.studentsSummary.map((item) => (
                        <tr key={item.student.id} className="bg-white hover:bg-[#FAF8F5]">
                          <td className="p-2 font-medium text-[#272D24]">{item.student.name}</td>
                          <td className="p-2 text-[#5F675A]">{item.attendedCount} حصة</td>
                          <td className="p-2 font-medium">{item.totalDue} ج</td>
                          <td className="p-2 font-medium text-[#607B5E]">{item.totalPaid} ج</td>
                          <td className={`p-2 font-medium ${item.remaining > 0 ? 'text-[#B86B52]' : 'text-[#607B5E]'}`}>
                            {item.remaining} ج
                          </td>
                          <td className="p-2">
                            <span
                              className={`px-1.5 py-0.5 rounded font-medium text-[10px] ${
                                item.sessionCredit > 0 ? 'bg-[#607B5E]/12 text-[#4E664C]' : 'bg-[#F5F2EC] text-[#878E82]'
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
          <div className="p-3 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs text-[#272D24]">اختر الطالب:</label>
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-[#878E82]" />
                <input
                  type="text"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  placeholder="بحث عن طالب..."
                  className="w-full pr-8 pl-7 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE] text-[11px] focus:outline-none focus:border-[#607B5E]"
                />
                {studentSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setStudentSearchQuery('')}
                    className="absolute left-2 top-2 text-[#878E82] hover:text-[#272D24]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE] text-xs font-medium text-[#272D24] focus:outline-none focus:border-[#607B5E]"
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
              <div className="p-4 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-[#272D24]">{selectedStudentObj.name}</h3>
                    <p className="text-xs text-[#878E82]">{getLocalizedStageName(selectedStudentObj.gradeLevel) || 'الصف غير محدد'}</p>
                  </div>

                  <div className="text-left">
                    <span className="text-[10px] text-[#878E82] font-medium block">رصيد الحصص الكلي</span>
                    <strong className="text-base text-[#607B5E] font-bold">
                      {selectedStudentGrandFin.totalSessionCredit} حصص
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE]">
                    <span className="text-[10px] text-[#878E82] font-medium block">إجمالي الرسوم (Gross)</span>
                    <strong className="text-base text-[#272D24] mt-0.5 block">{selectedStudentGrandFin.grandTotalDue} ج</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE]">
                    <span className="text-[10px] text-[#878E82] font-medium block">إجمالي المدفوع</span>
                    <strong className="text-base text-[#607B5E] mt-0.5 block">{selectedStudentGrandFin.grandTotalPaid} ج</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE]">
                    <span className="text-[10px] text-[#878E82] font-medium block">المستحق المتبقي (Outstanding)</span>
                    <strong className={`text-base mt-0.5 block ${selectedStudentGrandFin.grandRemaining > 0 ? 'text-[#B86B52]' : 'text-[#607B5E]'}`}>
                      {selectedStudentGrandFin.grandRemaining} ج
                    </strong>
                  </div>
                </div>

                {selectedStudentGrandFin.totalFinancialCredit > 0 && (
                  <div className="p-2 bg-[#607B5E]/10 text-[#4E664C] rounded-xl border border-[#607B5E]/20 text-xs font-medium flex items-center justify-between">
                    <span>الرصيد المالي المتبقي للطالب (Financial Credit):</span>
                    <strong>{selectedStudentGrandFin.totalFinancialCredit} ج.م</strong>
                  </div>
                )}
              </div>

              {/* Individual Services Breakdown (Group & Private) */}
              <div className="p-4 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs space-y-3">
                <h4 className="font-bold text-xs text-[#272D24] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#607B5E]" />
                  <span>تفاصيل الاشتراكات والخدمات المستقلة (Group & Private):</span>
                </h4>

                <div className="space-y-2.5">
                  {selectedStudentGrandFin.enrollmentsSummary.map((summary) => (
                    <div
                      key={summary.enrollmentId}
                      className={`p-3 rounded-xl border space-y-2 ${
                        summary.groupType === 'private'
                          ? 'bg-[#B88438]/5 border-[#B88438]/25'
                          : 'bg-[#FAF8F5] border-[#EAE6DE]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: summary.accentColor }}
                          />
                          <strong className="text-xs text-[#272D24]">{summary.groupName}</strong>
                          <span
                            className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${
                              summary.groupType === 'private'
                                ? 'bg-[#B88438]/15 text-[#946522]'
                                : 'bg-[#EAE6DE] text-[#5F675A]'
                            }`}
                          >
                            {summary.groupType === 'private' ? 'درس خاص (Private)' : 'مجموعة'}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#878E82]">
                          سعر الحصة: <strong className="text-[#272D24]">{summary.customPrice} ج.م</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                        <div className="p-1.5 bg-white rounded-lg border border-[#EAE6DE]">
                          <span className="text-[#878E82] block text-[9px]">المستهلك</span>
                          <strong className="text-xs text-[#272D24]">{summary.usedSessionsCount || 0}</strong>
                        </div>
                        <div className="p-1.5 bg-white rounded-lg border border-[#EAE6DE]">
                          <span className="text-[#878E82] block text-[9px]">رصيد الحصص</span>
                          <strong className="text-xs text-[#607B5E]">
                            {summary.sessionCredit} {summary.sessionCredit > 0 ? `(${summary.sessionCreditValue || summary.sessionCredit * summary.customPrice}ج)` : ''}
                          </strong>
                        </div>
                        <div className="p-1.5 bg-white rounded-lg border border-[#EAE6DE]">
                          <span className="text-[#878E82] block text-[9px]">المدفوع</span>
                          <strong className="text-xs text-[#607B5E]">{summary.totalPaid} ج</strong>
                        </div>
                        <div className={`p-1.5 rounded-lg border ${summary.remaining > 0 ? 'bg-[#B86B52]/10 border-[#B86B52]/25 text-[#B86B52]' : 'bg-white border-[#EAE6DE] text-[#607B5E]'}`}>
                          <span className="block text-[9px]">المتبقي (Current Due)</span>
                          <strong className="text-xs">
                            {summary.remaining} ج {summary.unpaidSessionsCount > 0 ? `(${summary.unpaidSessionsCount}ح)` : ''}
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Student Payments Ledger */}
              <div className="p-4 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs space-y-2.5">
                <h4 className="font-bold text-xs text-[#272D24] flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-[#607B5E]" />
                  <span>سجل مدفوعات الطالب:</span>
                </h4>

                {selectedStudentGrandFin.allPayments.length === 0 ? (
                  <p className="text-xs text-[#878E82] text-center p-4">لا توجد مدفوعات مسجلة.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedStudentGrandFin.allPayments.map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EAE6DE] flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-[#272D24]">{p.amount} ج.م</p>
                          <p className="text-[10px] text-[#878E82]">
                            {p.date} • {p.paymentType === 'specific_month' ? `شهر ${getArabicMonthName(p.targetMonth || 1)}` : 'سداد حصص'}
                          </p>
                        </div>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-[#EAE6DE] text-[#5F675A]">
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
