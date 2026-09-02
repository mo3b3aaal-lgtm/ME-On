import React, { useState } from 'react';
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  Users,
  Layers,
  Calendar,
  CalendarDays,
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
} from 'lucide-react';
import { Student, Group, Session, Payment, ReportPeriodFilter } from '../types';
import { db, getArabicMonthName } from '../utils/storage';

interface ReportsViewProps {
  students: Student[];
  groups: Group[];
  sessions: Session[];
  payments: Payment[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  students,
  groups,
  sessions,
  payments,
}) => {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Tab State: 1. تقرير الطالب | 2. تقرير المجموعة | 3. تقرير إجمالي المدرس
  const [reportType, setReportType] = useState<'teacher_overview' | 'student_report' | 'group_report'>('teacher_overview');

  // Filter Period
  const [periodFilter, setPeriodFilter] = useState<ReportPeriodFilter>('all_time');
  const [selectedSpecificMonth, setSelectedSpecificMonth] = useState<number>(currentMonth);
  const [selectedSpecificYear, setSelectedSpecificYear] = useState<number>(currentYear);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Selected Student / Group for dedicated reports
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // 1. Overall Teacher Calculations
  const teacherSummary = db.calculateTeacherFinancialOverview(periodFilter);

  // Filter payments by period
  const filteredPayments = payments.filter((p) => {
    if (periodFilter === 'all_time') return true;
    if (periodFilter === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      return p.date === todayStr;
    }
    if (periodFilter === 'this_month') {
      return p.month === currentMonth && p.year === currentYear;
    }
    if (periodFilter === 'specific_month') {
      return p.month === selectedSpecificMonth && p.year === selectedSpecificYear;
    }
    if (periodFilter === 'custom_range' && customStartDate && customEndDate) {
      return p.date >= customStartDate && p.date <= customEndDate;
    }
    return true;
  });

  const periodRevenue = filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  // 2. Selected Student Dossier
  const selectedStudentGrandFin = selectedStudentId
    ? db.calculateStudentGrandFinancials(selectedStudentId)
    : null;
  const selectedStudentObj = students.find((s) => s.id === selectedStudentId);

  // 3. Selected Group Dossier
  const selectedGroupFin = selectedGroupId
    ? db.calculateGroupFinancials(selectedGroupId)
    : null;
  const selectedGroupObj = groups.find((g) => g.id === selectedGroupId);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-4 text-[#2D332A] pb-24" dir="rtl">
      
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-serif text-[#2D332A] tracking-tight">
            التقارير والكشوف المالية
          </h1>
          <p className="text-xs text-[#8A9187] font-semibold mt-0.5">
            تقارير تفصيلية للمدرس، المجموعات، والطلاب
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="px-3 py-2 rounded-2xl bg-white hover:bg-[#F2ECE1] text-[#2D332A] border border-[#E8E2D6] font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
        >
          <Printer className="w-4 h-4 text-[#748C70]" />
          <span>طباعة</span>
        </button>
      </div>

      {/* 3 Report Tabs */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-white border border-[#E8E2D6] rounded-2xl shadow-xs text-xs font-bold">
        <button
          type="button"
          onClick={() => setReportType('teacher_overview')}
          className={`py-2 px-1 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 ${
            reportType === 'teacher_overview'
              ? 'bg-[#748C70] text-white shadow-xs'
              : 'text-[#6B7567] hover:bg-[#F9F7F2]'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>التقرير العام للمدرس</span>
        </button>

        <button
          type="button"
          onClick={() => setReportType('group_report')}
          className={`py-2 px-1 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 ${
            reportType === 'group_report'
              ? 'bg-[#748C70] text-white shadow-xs'
              : 'text-[#6B7567] hover:bg-[#F9F7F2]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>تقرير المجموعة</span>
        </button>

        <button
          type="button"
          onClick={() => setReportType('student_report')}
          className={`py-2 px-1 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 ${
            reportType === 'student_report'
              ? 'bg-[#748C70] text-white shadow-xs'
              : 'text-[#6B7567] hover:bg-[#F9F7F2]'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>تقرير الطالب</span>
        </button>
      </div>

      {/* Time Period Filter Bar */}
      <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[#2D332A] flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#748C70]" />
            <span>الفترة الزمنية للتقرير:</span>
          </span>

          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setPeriodFilter('today')}
              className={`px-2 py-1 rounded-lg font-bold text-[11px] border transition-all ${
                periodFilter === 'today'
                  ? 'bg-[#748C70] text-white border-[#748C70]'
                  : 'bg-[#F9F7F2] text-[#6B7567] border-[#E8E2D6]'
              }`}
            >
              اليوم
            </button>
            <button
              onClick={() => setPeriodFilter('this_month')}
              className={`px-2 py-1 rounded-lg font-bold text-[11px] border transition-all ${
                periodFilter === 'this_month'
                  ? 'bg-[#748C70] text-white border-[#748C70]'
                  : 'bg-[#F9F7F2] text-[#6B7567] border-[#E8E2D6]'
              }`}
            >
              هذا الشهر
            </button>
            <button
              onClick={() => setPeriodFilter('specific_month')}
              className={`px-2 py-1 rounded-lg font-bold text-[11px] border transition-all ${
                periodFilter === 'specific_month'
                  ? 'bg-[#748C70] text-white border-[#748C70]'
                  : 'bg-[#F9F7F2] text-[#6B7567] border-[#E8E2D6]'
              }`}
            >
              شهر محدد
            </button>
            <button
              onClick={() => setPeriodFilter('custom_range')}
              className={`px-2 py-1 rounded-lg font-bold text-[11px] border transition-all ${
                periodFilter === 'custom_range'
                  ? 'bg-[#748C70] text-white border-[#748C70]'
                  : 'bg-[#F9F7F2] text-[#6B7567] border-[#E8E2D6]'
              }`}
            >
              فترة مخصصة
            </button>
            <button
              onClick={() => setPeriodFilter('all_time')}
              className={`px-2 py-1 rounded-lg font-bold text-[11px] border transition-all ${
                periodFilter === 'all_time'
                  ? 'bg-[#748C70] text-white border-[#748C70]'
                  : 'bg-[#F9F7F2] text-[#6B7567] border-[#E8E2D6]'
              }`}
            >
              كل الوقت
            </button>
          </div>
        </div>

        {/* Extended controls for specific month or custom range */}
        {periodFilter === 'specific_month' && (
          <div className="flex items-center gap-2 pt-1 border-t border-[#E8E2D6]/60">
            <span className="text-[#8A9187] text-[11px]">اختر الشهر والسنة:</span>
            <select
              value={selectedSpecificMonth}
              onChange={(e) => setSelectedSpecificMonth(Number(e.target.value))}
              className="p-1 rounded-lg bg-[#F9F7F2] border border-[#E8E2D6] font-bold text-xs"
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
              className="p-1 rounded-lg bg-[#F9F7F2] border border-[#E8E2D6] font-bold text-xs"
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
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#E8E2D6]/60">
            <div>
              <span className="text-[#8A9187] text-[10px] block">من تاريخ:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full p-1.5 rounded-lg bg-[#F9F7F2] border border-[#E8E2D6] text-xs font-bold"
              />
            </div>
            <div>
              <span className="text-[#8A9187] text-[10px] block">إلى تاريخ:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full p-1.5 rounded-lg bg-[#F9F7F2] border border-[#E8E2D6] text-xs font-bold"
              />
            </div>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* 1. TEACHER GRAND OVERVIEW REPORT */}
      {/* ========================================== */}
      {reportType === 'teacher_overview' && (
        <div className="space-y-4">
          
          {/* Main 6 Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            
            <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-[#8A9187]">إجمالي الإيرادات (المحصل)</span>
              <p className="text-xl font-black text-[#748C70]">{periodRevenue} <span className="text-xs text-[#8A9187]">ج.م</span></p>
            </div>

            <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-[#8A9187]">إجمالي المستحقات المطلوبة</span>
              <p className="text-xl font-black text-[#2D332A]">{teacherSummary.totalDues} <span className="text-xs text-[#8A9187]">ج.م</span></p>
            </div>

            <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-[#8A9187]">إجمالي المتبقي (المتأخرات)</span>
              <p className={`text-xl font-black ${teacherSummary.totalRemaining > 0 ? 'text-[#C97C5D]' : 'text-[#748C70]'}`}>
                {teacherSummary.totalRemaining} <span className="text-xs text-[#8A9187]">ج.م</span>
              </p>
            </div>

            <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-[#8A9187]">عدد الطلاب الفعلي</span>
              <p className="text-xl font-black text-[#2D332A]">{students.length} <span className="text-xs text-[#8A9187]">طالب</span></p>
            </div>

            <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-[#8A9187]">عدد الحصص المنفذة</span>
              <p className="text-xl font-black text-[#2D332A]">{teacherSummary.totalSessionsConducted} <span className="text-xs text-[#8A9187]">حصة</span></p>
            </div>

            <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-[#8A9187]">الحصص الإضافية المسجلة</span>
              <p className="text-xl font-black text-[#DDA15E]">+{teacherSummary.totalExtraSessions} <span className="text-xs text-[#8A9187]">حصة</span></p>
            </div>

          </div>

          {/* Monthly Revenue History Breakdown */}
          {teacherSummary.monthlyRevenues.length > 0 && (
            <div className="p-4 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-2.5">
              <h3 className="font-bold text-xs text-[#2D332A] flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-[#748C70]" />
                <span>سجل التحصيلات الشهرية:</span>
              </h3>

              <div className="space-y-1.5">
                {teacherSummary.monthlyRevenues.map((m) => (
                  <div
                    key={m.monthYear}
                    className="p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6] flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-[#2D332A]">{m.monthYear}</span>
                    <strong className="text-[#748C70] font-black">{m.revenue} ج.م</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================== */}
      {/* 2. GROUP REPORT */}
      {/* ========================================== */}
      {reportType === 'group_report' && (
        <div className="space-y-4">
          
          {/* Group Selector */}
          <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl shadow-xs space-y-1.5">
            <label className="font-bold text-xs text-[#2D332A]">اختر المجموعة:</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6] text-xs font-bold text-[#2D332A] focus:outline-none focus:border-[#748C70]"
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
                <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl text-center">
                  <span className="text-[10px] text-[#8A9187] font-bold">إجمالي المستحق</span>
                  <p className="text-lg font-black text-[#2D332A] mt-0.5">{selectedGroupFin.totalDue} ج</p>
                </div>
                <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl text-center">
                  <span className="text-[10px] text-[#8A9187] font-bold">إجمالي المدفوع</span>
                  <p className="text-lg font-black text-[#748C70] mt-0.5">{selectedGroupFin.totalPaid} ج</p>
                </div>
                <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl text-center">
                  <span className="text-[10px] text-[#8A9187] font-bold">المتبقي</span>
                  <p className={`text-lg font-black mt-0.5 ${selectedGroupFin.remaining > 0 ? 'text-[#C97C5D]' : 'text-[#748C70]'}`}>
                    {selectedGroupFin.remaining} ج
                  </p>
                </div>
                <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl text-center">
                  <span className="text-[10px] text-[#8A9187] font-bold">الحصص المنفذة</span>
                  <p className="text-lg font-black text-[#2D332A] mt-0.5">{selectedGroupFin.totalCompletedSessions} حصة</p>
                </div>
              </div>

              {/* Students Ledger Table in Group */}
              <div className="p-4 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-[#2D332A]">
                    كشف حساب طلاب المجموعة ({selectedGroupFin.studentsSummary.length} طلاب):
                  </h3>
                  <span className="text-[11px] text-[#748C70] font-bold">
                    إجمالي رصيد الحصص المسبقة: {selectedGroupFin.totalPrepaidCredits}
                  </span>
                </div>

                <div className="rounded-xl border border-[#E8E2D6] overflow-x-auto">
                  <table className="w-full text-right text-[11px]">
                    <thead className="bg-[#F2ECE1] text-[#6B7567]">
                      <tr>
                        <th className="p-2 font-bold">الطالب</th>
                        <th className="p-2 font-bold">الحصص المستهلكة</th>
                        <th className="p-2 font-bold">المطلوب</th>
                        <th className="p-2 font-bold">المدفوع</th>
                        <th className="p-2 font-bold">المتبقي</th>
                        <th className="p-2 font-bold">رصيد الحصص</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E2D6]">
                      {selectedGroupFin.studentsSummary.map((item) => (
                        <tr key={item.student.id} className="bg-white hover:bg-[#F9F7F2]">
                          <td className="p-2 font-bold text-[#2D332A]">{item.student.name}</td>
                          <td className="p-2 text-[#6B7567]">{item.attendedCount} حصة</td>
                          <td className="p-2 font-bold">{item.totalDue} ج</td>
                          <td className="p-2 font-bold text-[#748C70]">{item.totalPaid} ج</td>
                          <td className={`p-2 font-bold ${item.remaining > 0 ? 'text-[#C97C5D]' : 'text-[#748C70]'}`}>
                            {item.remaining} ج
                          </td>
                          <td className="p-2">
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                item.sessionCredit > 0 ? 'bg-[#748C70]/15 text-[#748C70]' : 'bg-[#F2ECE1] text-[#8A9187]'
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
      {/* 3. STUDENT REPORT */}
      {/* ========================================== */}
      {reportType === 'student_report' && (
        <div className="space-y-4">
          
          {/* Student Selector with Search */}
          <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs text-[#2D332A]">اختر الطالب:</label>
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-[#8A9187]" />
                <input
                  type="text"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  placeholder="بحث عن طالب..."
                  className="w-full pr-8 pl-2 py-1.5 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6] text-[11px] focus:outline-none focus:border-[#748C70]"
                />
              </div>
            </div>

            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6] text-xs font-bold text-[#2D332A] focus:outline-none focus:border-[#748C70]"
            >
              {students
                .filter((s) => s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()))
                .map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.gradeLevel || 'غير محدد'})
                  </option>
                ))}
            </select>
          </div>

          {selectedStudentGrandFin && selectedStudentObj && (
            <div className="space-y-4">
              
              {/* Grand Student Summary Card */}
              <div className="p-4 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-[#2D332A]">{selectedStudentObj.name}</h3>
                    <p className="text-xs text-[#8A9187]">{selectedStudentObj.gradeLevel || 'الصف غير محدد'}</p>
                  </div>

                  <div className="text-left">
                    <span className="text-[10px] text-[#8A9187] font-bold block">رصيد الحصص الكلي</span>
                    <strong className="text-base text-[#748C70] font-black">
                      {selectedStudentGrandFin.totalSessionCredit} حصص
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6]">
                    <span className="text-[10px] text-[#8A9187] font-bold block">إجمالي المطلوب</span>
                    <strong className="text-base text-[#2D332A] mt-0.5 block">{selectedStudentGrandFin.grandTotalDue} ج</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6]">
                    <span className="text-[10px] text-[#8A9187] font-bold block">إجمالي المدفوع</span>
                    <strong className="text-base text-[#748C70] mt-0.5 block">{selectedStudentGrandFin.grandTotalPaid} ج</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6]">
                    <span className="text-[10px] text-[#8A9187] font-bold block">المتبقي</span>
                    <strong className={`text-base mt-0.5 block ${selectedStudentGrandFin.grandRemaining > 0 ? 'text-[#C97C5D]' : 'text-[#748C70]'}`}>
                      {selectedStudentGrandFin.grandRemaining} ج
                    </strong>
                  </div>
                </div>

                {selectedStudentGrandFin.totalFinancialCredit > 0 && (
                  <div className="p-2 bg-[#748C70]/10 text-[#60755C] rounded-xl border border-[#748C70]/20 text-xs font-bold flex items-center justify-between">
                    <span>الرصيد المالي المتبقي للطالب (Financial Credit):</span>
                    <strong>{selectedStudentGrandFin.totalFinancialCredit} ج.م</strong>
                  </div>
                )}
              </div>

              {/* Individual Services Breakdown (Group & Private) */}
              <div className="p-4 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-3">
                <h4 className="font-bold text-xs text-[#2D332A] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#748C70]" />
                  <span>تفاصيل الاشتراكات والخدمات المستقلة (Group & Private):</span>
                </h4>

                <div className="space-y-2.5">
                  {selectedStudentGrandFin.enrollmentsSummary.map((summary) => (
                    <div
                      key={summary.enrollmentId}
                      className={`p-3 rounded-xl border space-y-2 ${
                        summary.groupType === 'private'
                          ? 'bg-[#D49B4B]/5 border-[#D49B4B]/30'
                          : 'bg-[#F9F7F2] border-[#E8E2D6]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: summary.accentColor }}
                          />
                          <strong className="text-xs text-[#2D332A]">{summary.groupName}</strong>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              summary.groupType === 'private'
                                ? 'bg-[#D49B4B]/20 text-[#9C6615]'
                                : 'bg-[#E8E2D6] text-[#6B7567]'
                            }`}
                          >
                            {summary.groupType === 'private' ? 'درس خاص (Private)' : 'مجموعة'}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#8A9187]">
                          سعر الحصة: <strong className="text-[#2D332A]">{summary.customPrice} ج.م</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                        <div className="p-1.5 bg-white rounded-lg border border-[#E8E2D6]">
                          <span className="text-[#8A9187] block text-[9px]">المستهلك</span>
                          <strong className="text-xs text-[#2D332A]">{summary.usedSessionsCount || 0}</strong>
                        </div>
                        <div className="p-1.5 bg-white rounded-lg border border-[#E8E2D6]">
                          <span className="text-[#8A9187] block text-[9px]">رصيد الحصص</span>
                          <strong className="text-xs text-[#748C70]">
                            {summary.sessionCredit} {summary.sessionCredit > 0 ? `(${summary.sessionCreditValue || summary.sessionCredit * summary.customPrice}ج)` : ''}
                          </strong>
                        </div>
                        <div className="p-1.5 bg-white rounded-lg border border-[#E8E2D6]">
                          <span className="text-[#8A9187] block text-[9px]">المدفوع</span>
                          <strong className="text-xs text-[#748C70]">{summary.totalPaid} ج</strong>
                        </div>
                        <div className={`p-1.5 rounded-lg border ${summary.remaining > 0 ? 'bg-[#C97C5D]/10 border-[#C97C5D]/30 text-[#C97C5D]' : 'bg-white border-[#E8E2D6] text-[#748C70]'}`}>
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
              <div className="p-4 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-2.5">
                <h4 className="font-bold text-xs text-[#2D332A] flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-[#748C70]" />
                  <span>سجل مدفوعات الطالب:</span>
                </h4>

                {selectedStudentGrandFin.allPayments.length === 0 ? (
                  <p className="text-xs text-[#8A9187] text-center p-4">لا توجد مدفوعات مسجلة.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedStudentGrandFin.allPayments.map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6] flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-[#2D332A]">{p.amount} ج.م</p>
                          <p className="text-[10px] text-[#8A9187]">
                            {p.date} • {p.paymentType === 'specific_month' ? `شهر ${getArabicMonthName(p.targetMonth || 1)}` : 'سداد حصص'}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-[#E8E2D6] text-[#6B7567]">
                          {p.paymentMethod === 'cash' ? 'نقداً' : p.paymentMethod}
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
