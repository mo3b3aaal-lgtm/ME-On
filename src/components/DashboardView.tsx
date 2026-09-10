import React, { useState } from 'react';
import {
  Users,
  Layers,
  CalendarCheck2,
  DollarSign,
  UserPlus,
  Plus,
  ArrowUpRight,
  Clock,
  MapPin,
  CheckCircle2,
  Calendar,
  AlertCircle,
  TrendingUp,
  Sparkles,
  Bell,
  Check,
  XCircle,
  MessageCircle,
  Phone,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Receipt,
  UserCheck,
  X,
  CreditCard,
} from 'lucide-react';
import { Student, Group, Session, Payment, TeacherProfile, Attendance, AttendanceStatus, Enrollment } from '../types';
import { db } from '../utils/storage';
import { getLocalizedStageName } from '../utils/stages';
import { getScheduledClassesForDate, ScheduledClassItem } from '../utils/schedule';
import { getSmartReminders, SmartReminderItem } from '../utils/reminders';

interface DashboardViewProps {
  students: Student[];
  groups: Group[];
  sessions: Session[];
  payments: Payment[];
  teacherProfile: TeacherProfile;
  onOpenAddStudent: () => void;
  onOpenAddGroup: () => void;
  onOpenAddSession: () => void;
  onOpenAddPayment: () => void;
  onOpenStudentProfile: (student: Student) => void;
  onOpenGroupProfile: (group: Group) => void;
  onOpenAttendanceModal: (session: Session) => void;
  onNavigateToTab: (tab: any) => void;
  onDataChanged?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  students,
  groups,
  sessions,
  payments,
  teacherProfile,
  onOpenAddStudent,
  onOpenAddGroup,
  onOpenAddSession,
  onOpenAddPayment,
  onOpenStudentProfile,
  onOpenGroupProfile,
  onOpenAttendanceModal,
  onNavigateToTab,
  onDataChanged,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // State for expanded quick attendance cards
  const [expandedAttendanceCardId, setExpandedAttendanceCardId] = useState<string | null>(null);
  const [quickSuccessMsg, setQuickSuccessMsg] = useState<string | null>(null);

  const showQuickFeedback = (msg: string) => {
    setQuickSuccessMsg(msg);
    setTimeout(() => setQuickSuccessMsg(null), 3000);
  };

  // Filter today's sessions
  const todaySessions = sessions.filter((s) => s.date === todayStr && s.status !== 'cancelled');
  const enrollments = db.getEnrollments();
  const allAttendance = db.getAttendance();

  // Scheduled classes for today
  const scheduledToday = getScheduledClassesForDate(new Date(), groups, students, enrollments, true);

  // Completed vs Remaining sessions count today
  const completedTodaySessionsCount = todaySessions.filter((s) => {
    const att = db.getSessionAttendance(s.id);
    return att.length > 0 || s.status === 'completed';
  }).length;
  const totalTodayClassesCount = Math.max(scheduledToday.length, todaySessions.length);
  const remainingTodaySessionsCount = Math.max(0, totalTodayClassesCount - completedTodaySessionsCount);

  // Revenue stats
  const monthPayments = payments.filter((p) => p.month === currentMonth && p.year === currentYear);
  const totalMonthRevenue = monthPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const todayPayments = payments.filter((p) => p.date === todayStr);
  const totalTodayRevenue = todayPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  // Outstanding balances & Low credit calculations across active students
  const activeStudents = students.filter((s) => s.status !== 'archived');
  let totalOutstandingDues = 0;
  let overdueStudentsCount = 0;
  let lowCreditStudentsCount = 0;

  activeStudents.forEach((st) => {
    const fin = db.calculateStudentGrandFinancials(st.id);
    if (fin.grandRemaining > 0) {
      totalOutstandingDues += fin.grandRemaining;
      overdueStudentsCount++;
    }
    const hasLow = fin.enrollmentsSummary.some((e) => {
      const isPkg = e.billingMode === 'package' || e.billingType === 'package' || e.billingMode === 'prepaid' || e.billingType === 'prepaid';
      return isPkg && e.sessionCredit <= 2;
    });
    if (hasLow) {
      lowCreditStudentsCount++;
    }
  });

  // Smart Reminders
  const smartReminders = getSmartReminders(students, groups, sessions, enrollments, allAttendance);

  // Quick Attendance Actions
  const getOrCreateSessionForSchedule = (item: ScheduledClassItem): Session => {
    const existing = todaySessions.find(
      (s) => s.groupId === item.groupId || (item.enrollmentId && s.enrollmentId === item.enrollmentId)
    );
    if (existing) return existing;

    const now = new Date();
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const newSession: Session = {
      id: `ses_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      groupId: item.groupId,
      enrollmentId: item.enrollmentId,
      studentId: item.studentId || undefined,
      title: item.isPrivate ? `درس خاص - ${item.studentName}` : item.groupName,
      date: todayStr,
      dayName: dayNames[now.getDay()],
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      startTime: item.rawTime || item.time,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };
    db.saveSession(newSession);
    return newSession;
  };

  const handleMarkAllPresent = (item: ScheduledClassItem) => {
    const session = getOrCreateSessionForSchedule(item);
    const groupStudents = item.studentId
      ? students.filter((s) => s.id === item.studentId)
      : db.getGroupStudents(item.groupId);

    const attendanceRecords: Attendance[] = groupStudents.map((st) => {
      const enr = enrollments.find(
        (e) => e.studentId === st.id && (e.groupId === item.groupId || e.id === item.enrollmentId)
      );
      return {
        id: `att_${session.id}_${st.id}`,
        sessionId: session.id,
        studentId: st.id,
        enrollmentId: enr?.id || item.enrollmentId,
        status: 'present',
        isCharged: true,
        recordedAt: new Date().toISOString(),
      };
    });

    db.saveAttendanceBatch(session.id, attendanceRecords);
    showQuickFeedback(`تم رصد حضور جميع طلاب ${item.isPrivate ? item.studentName : item.groupName} بنجاح`);
    onDataChanged?.();
  };

  const handleQuickStudentAttendance = (
    item: ScheduledClassItem,
    studentId: string,
    status: AttendanceStatus,
    isCharged: boolean = true
  ) => {
    const session = getOrCreateSessionForSchedule(item);
    const enr = enrollments.find(
      (e) => e.studentId === studentId && (e.groupId === item.groupId || e.id === item.enrollmentId)
    );

    const record: Attendance = {
      id: `att_${session.id}_${studentId}`,
      sessionId: session.id,
      studentId,
      enrollmentId: enr?.id || item.enrollmentId,
      status,
      isCharged,
      recordedAt: new Date().toISOString(),
    };

    db.saveAttendanceBatch(session.id, [record]);
    showQuickFeedback('تم تحديث حالة الحضور');
    onDataChanged?.();
  };

  return (
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-4 text-[#2D332A] pb-24" dir="rtl">
      
      {/* Teacher Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-serif text-[#2D332A] tracking-tight">
            مرحباً، {teacherProfile.name || 'أستاذنا الفاضل'}
          </h1>
          <p className="text-xs text-[#8A9187] font-semibold mt-0.5">
            {teacherProfile.subject} • {teacherProfile.centerOrSchool || 'مركز التعليم'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-white border border-[#E8E2D6] px-3 py-1.5 rounded-2xl shadow-sm">
          <Calendar className="w-4 h-4 text-[#748C70]" />
          <span className="text-xs font-bold text-[#434B3E]">
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>

      {/* Quick Success Toast */}
      {quickSuccessMsg && (
        <div className="p-3 rounded-2xl bg-[#748C70] text-white text-xs font-bold flex items-center justify-between shadow-md animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{quickSuccessMsg}</span>
          </div>
          <button onClick={() => setQuickSuccessMsg(null)}>
            <X className="w-4 h-4 text-white/80" />
          </button>
        </div>
      )}

      {/* 6 Core Dashboard Summary KPI Cards (Feature 2) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        
        {/* Card 1: Today's Classes & Students */}
        <div
          onClick={() => onNavigateToTab('sessions')}
          className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm hover:border-[#748C70]/50 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-[#5C788A]">
            <CalendarCheck2 className="w-5 h-5" />
            <span className="text-[10px] bg-[#5C788A]/15 text-[#5C788A] px-2 py-0.5 rounded-md font-bold">
              اليوم
            </span>
          </div>
          <p className="text-2xl font-black text-[#2D332A] mt-1">{totalTodayClassesCount}</p>
          <p className="text-[11px] font-bold text-[#8A9187]">
            حصص اليوم ({scheduledToday.length} طالب/مجموعة)
          </p>
        </div>

        {/* Card 2: Completed vs Remaining Sessions Today */}
        <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-[#748C70]">
            <Clock className="w-5 h-5" />
            <span className="text-[10px] bg-[#748C70]/15 text-[#748C70] px-2 py-0.5 rounded-md font-bold">
              {completedTodaySessionsCount} تم رصدها
            </span>
          </div>
          <p className="text-2xl font-black text-[#2D332A] mt-1">
            {remainingTodaySessionsCount} <span className="text-xs text-[#8A9187] font-bold">متبقية</span>
          </p>
          <p className="text-[11px] font-bold text-[#8A9187]">حالة حصص اليوم</p>
        </div>

        {/* Card 3: Payments Collected (Month & Today) */}
        <div
          onClick={() => onNavigateToTab('reports')}
          className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm hover:border-[#748C70]/50 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-[#748C70]">
            <DollarSign className="w-5 h-5" />
            <TrendingUp className="w-3.5 h-3.5 text-[#748C70]" />
          </div>
          <p className="text-2xl font-black text-[#2D332A] mt-1">
            {totalMonthRevenue} <span className="text-xs font-bold text-[#8A9187]">ج</span>
          </p>
          <p className="text-[11px] font-bold text-[#8A9187]">
            تحصيل الشهر (اليوم: {totalTodayRevenue} ج)
          </p>
        </div>

        {/* Card 4: Outstanding & Due Amounts */}
        <div
          onClick={() => onNavigateToTab('reports')}
          className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm hover:border-[#C97C5D]/50 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-[#C97C5D]">
            <Receipt className="w-5 h-5" />
            <span className="text-[10px] bg-[#C97C5D]/15 text-[#C97C5D] px-2 py-0.5 rounded-md font-bold">
              {overdueStudentsCount} طلاب
            </span>
          </div>
          <p className="text-2xl font-black text-[#C97C5D] mt-1">
            {totalOutstandingDues} <span className="text-xs font-bold text-[#8A9187]">ج</span>
          </p>
          <p className="text-[11px] font-bold text-[#8A9187]">مستحقات غير مسددة</p>
        </div>

        {/* Card 5: Low Session Credits */}
        <div
          onClick={() => onNavigateToTab('students')}
          className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm hover:border-[#D49B4B]/50 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-[#D49B4B]">
            <Sparkles className="w-5 h-5" />
            <span className="text-[10px] bg-[#D49B4B]/15 text-[#9C6615] px-2 py-0.5 rounded-md font-bold">
              تنبيه باقات
            </span>
          </div>
          <p className="text-2xl font-black text-[#2D332A] mt-1">{lowCreditStudentsCount}</p>
          <p className="text-[11px] font-bold text-[#8A9187]">رصيد باقات منخفض (≤2)</p>
        </div>

        {/* Card 6: Total Students */}
        <div
          onClick={() => onNavigateToTab('students')}
          className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm hover:border-[#748C70]/50 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-[#748C70]">
            <Users className="w-5 h-5" />
            <ArrowUpRight className="w-3.5 h-3.5 text-[#8A9187]" />
          </div>
          <p className="text-2xl font-black text-[#2D332A] mt-1">{students.length}</p>
          <p className="text-[11px] font-bold text-[#8A9187]">إجمالي الطلاب المقيدين</p>
        </div>

      </div>

      {/* Quick Actions Row */}
      <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-2.5">
        <h2 className="text-xs font-bold text-[#6B7567]">إجراءات سريعة</h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={onOpenAddStudent}
            className="p-2.5 rounded-xl bg-[#F9F7F2] hover:bg-[#F2ECE1] border border-[#E8E2D6] flex items-center gap-2 text-xs font-bold text-[#2D332A] transition-all active:scale-95"
          >
            <div className="p-1.5 rounded-lg bg-[#748C70] text-white">
              <UserPlus className="w-4 h-4" />
            </div>
            <span>إضافة طالب</span>
          </button>

          <button
            onClick={onOpenAddGroup}
            className="p-2.5 rounded-xl bg-[#F9F7F2] hover:bg-[#F2ECE1] border border-[#E8E2D6] flex items-center gap-2 text-xs font-bold text-[#2D332A] transition-all active:scale-95"
          >
            <div className="p-1.5 rounded-lg bg-[#D49B4B] text-white">
              <Layers className="w-4 h-4" />
            </div>
            <span>إنشاء مجموعة</span>
          </button>

          <button
            onClick={onOpenAddPayment}
            className="p-2.5 rounded-xl bg-[#F9F7F2] hover:bg-[#F2ECE1] border border-[#E8E2D6] flex items-center gap-2 text-xs font-bold text-[#2D332A] transition-all active:scale-95"
          >
            <div className="p-1.5 rounded-lg bg-[#748C70] text-white">
              <DollarSign className="w-4 h-4" />
            </div>
            <span>تسجيل دفعة</span>
          </button>

          <button
            onClick={onOpenAddSession}
            className="p-2.5 rounded-xl bg-[#F9F7F2] hover:bg-[#F2ECE1] border border-[#E8E2D6] flex items-center gap-2 text-xs font-bold text-[#2D332A] transition-all active:scale-95"
          >
            <div className="p-1.5 rounded-lg bg-[#5C788A] text-white">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
            <span>جدولة حصة</span>
          </button>
        </div>
      </div>

      {/* Attention Needed / Smart Reminders Section (Feature 4) */}
      {smartReminders.length > 0 && (
        <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#2D332A] flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-[#D49B4B]" />
              <span>تنبيهات وملاحظات تتطلب اهتمامك ({smartReminders.length})</span>
            </h2>
            <span className="text-[10px] bg-[#D49B4B]/15 text-[#9C6615] px-2 py-0.5 rounded-full font-bold">
              تنبيهات ذكية
            </span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto android-scrollbar">
            {smartReminders.slice(0, 5).map((rem) => {
              const targetStudent = rem.studentId ? students.find((s) => s.id === rem.studentId) : null;
              const isHigh = rem.priority === 'high';

              return (
                <div
                  key={rem.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                    isHigh ? 'bg-[#C97C5D]/10 border-[#C97C5D]/30' : 'bg-[#F9F7F2] border-[#E8E2D6]'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                        isHigh ? 'bg-[#C97C5D]/20 text-[#C97C5D]' : 'bg-[#D49B4B]/20 text-[#9C6615]'
                      }`}>
                        {rem.badge}
                      </span>
                      <h4 className="font-bold text-xs text-[#2D332A] truncate">{rem.title}</h4>
                    </div>
                    <p className="text-[10px] text-[#8A9187] truncate">{rem.description}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {rem.actionType === 'add_payment' && targetStudent && (
                      <button
                        onClick={onOpenAddPayment}
                        className="px-2.5 py-1 rounded-lg bg-[#748C70] text-white text-[11px] font-bold hover:bg-[#60755C] transition-all shadow-xs"
                      >
                        سداد
                      </button>
                    )}

                    {rem.parentPhone && (
                      <a
                        href={`https://wa.me/${rem.parentPhone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-[#748C70]/15 text-[#60755C] hover:bg-[#748C70]/25 transition-all"
                        title="واتساب ولي الأمر"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {targetStudent && (
                      <button
                        onClick={() => onOpenStudentProfile(targetStudent)}
                        className="px-2 py-1 rounded-lg bg-white border border-[#E8E2D6] text-[10px] font-bold text-[#434B3E] hover:bg-[#F2ECE1]"
                      >
                        الملف
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Today's Scheduled Sessions with Quick Attendance (Feature 3) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#2D332A] flex items-center gap-1.5">
            <CalendarCheck2 className="w-4 h-4 text-[#748C70]" />
            <span>
              جدول وحضور حصص اليوم ({scheduledToday.length > 0 ? scheduledToday.length : todaySessions.length})
            </span>
          </h2>
          <button
            onClick={onOpenAddSession}
            className="text-[11px] font-bold text-[#748C70] hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة حصة اليوم</span>
          </button>
        </div>

        {scheduledToday.length === 0 && todaySessions.length === 0 ? (
          <div className="p-6 bg-white border border-[#E8E2D6] rounded-2xl text-center space-y-1.5 shadow-sm">
            <CalendarCheck2 className="w-8 h-8 mx-auto text-[#8A9187] opacity-50" />
            <p className="font-bold text-[#2D332A] text-xs">لا توجد حصص مجدولة لليوم</p>
            <p className="text-[11px] text-[#8A9187]">
              يمكنك جدولة حصة الآن لأي مجموعة أو طالب خاص
            </p>
            <button
              onClick={onOpenAddSession}
              className="mt-2 px-3 py-1.5 rounded-xl bg-[#748C70] text-white font-bold text-xs inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>جدولة حصة جديدة</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {scheduledToday.map((item) => {
              const matchingSession = todaySessions.find(
                (s) => s.groupId === item.groupId || (item.enrollmentId && s.enrollmentId === item.enrollmentId)
              );
              const sessionAttendance = matchingSession ? db.getSessionAttendance(matchingSession.id) : [];
              const isRecorded = sessionAttendance.length > 0 || matchingSession?.status === 'completed';
              const isExpanded = expandedAttendanceCardId === item.id;

              const groupStudents = item.studentId
                ? students.filter((s) => s.id === item.studentId)
                : db.getGroupStudents(item.groupId);

              const presentCount = sessionAttendance.filter((a) => a.status === 'present').length;

              return (
                <div
                  key={item.id}
                  className="bg-white border border-[#E8E2D6] rounded-2xl shadow-sm hover:border-[#748C70]/50 transition-all overflow-hidden"
                >
                  {/* Class Header */}
                  <div className="p-3.5 flex items-center justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: item.accentColor }}
                        />
                        <h3 className="font-bold text-xs text-[#2D332A] truncate">
                          {item.isPrivate ? item.studentName : item.groupName}
                        </h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          item.isPrivate
                            ? 'bg-[#D49B4B]/15 text-[#9C6615]'
                            : 'bg-[#F2ECE1] text-[#6B7567]'
                        }`}>
                          {item.isPrivate ? 'درس خاص' : (item.subject || 'مجموعة')}
                        </span>

                        {isRecorded && (
                          <span className="text-[10px] bg-[#748C70]/15 text-[#60755C] px-2 py-0.5 rounded-full font-bold">
                            تم الرصد ({presentCount}/{groupStudents.length} حاضر)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-[#8A9187] flex-wrap">
                        <span className="flex items-center gap-1 font-bold text-[#2D332A]">
                          <Clock className="w-3.5 h-3.5 text-[#748C70]" />
                          <span>الساعة {item.time}</span>
                        </span>
                        {!item.isPrivate && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-[#748C70]" />
                            <span>{groupStudents.length} طلاب</span>
                          </span>
                        )}
                        {item.location && (
                          <span className="flex items-center gap-1 text-[10px]">
                            <MapPin className="w-3 h-3 text-[#8A9187]" />
                            <span>{item.location}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Mark All Present Quick Button */}
                      <button
                        type="button"
                        onClick={() => handleMarkAllPresent(item)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all active:scale-95"
                        title="تسجيل حضور جميع الطلاب دفعة واحدة"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">حضور الكل</span>
                      </button>

                      {/* Expand / Collapse Quick Attendance list */}
                      <button
                        type="button"
                        onClick={() => setExpandedAttendanceCardId(isExpanded ? null : item.id)}
                        className="p-1.5 rounded-xl bg-[#F9F7F2] hover:bg-[#EAE5D8] border border-[#E8E2D6] text-[#2D332A] transition-colors"
                        title="تفاصيل ورصد الطلاب فردياً"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Inline Quick Attendance List */}
                  {isExpanded && (
                    <div className="p-3 bg-[#F9F7F2] border-t border-[#E8E2D6] space-y-2 animate-in slide-in-from-top-2 duration-150">
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#6B7567]">
                        <span>قائمة الطلاب ({groupStudents.length})</span>
                        <span>اختر حالة الحضور لكل طالب</span>
                      </div>

                      <div className="space-y-1.5">
                        {groupStudents.map((st) => {
                          const currentRecord = sessionAttendance.find((a) => a.studentId === st.id);
                          const stStatus = currentRecord?.status;

                          return (
                            <div
                              key={st.id}
                              className="p-2 bg-white rounded-xl border border-[#E8E2D6] flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <span className="font-bold text-xs text-[#2D332A] block truncate">{st.name}</span>
                                {st.phone && <span className="text-[10px] text-[#8A9187]">{st.phone}</span>}
                              </div>

                              {/* 4 Quick Action Chips */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'present', true)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                    stStatus === 'present'
                                      ? 'bg-[#748C70] text-white shadow-xs'
                                      : 'bg-[#F2ECE1] text-[#6B7567] hover:bg-[#748C70]/20'
                                  }`}
                                >
                                  حاضر
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'absent_charged', true)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                    stStatus === 'absent_charged' || (stStatus === 'absent' && currentRecord?.isCharged !== false)
                                      ? 'bg-[#C97C5D] text-white shadow-xs'
                                      : 'bg-[#F2ECE1] text-[#6B7567] hover:bg-[#C97C5D]/20'
                                  }`}
                                >
                                  غياب محسوب
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'absent_free', false)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                    stStatus === 'absent_free' || stStatus === 'excused' || (stStatus === 'absent' && currentRecord?.isCharged === false)
                                      ? 'bg-[#8A9187] text-white shadow-xs'
                                      : 'bg-[#F2ECE1] text-[#6B7567] hover:bg-[#8A9187]/20'
                                  }`}
                                >
                                  معتذر
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'late', true)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                    stStatus === 'late'
                                      ? 'bg-[#D49B4B] text-white shadow-xs'
                                      : 'bg-[#F2ECE1] text-[#6B7567] hover:bg-[#D49B4B]/20'
                                  }`}
                                >
                                  متأخر
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {matchingSession && (
                        <div className="pt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => onOpenAttendanceModal(matchingSession)}
                            className="text-[11px] font-bold text-[#748C70] hover:underline flex items-center gap-1"
                          >
                            <span>فتح نافذة الحضور التفصيلية</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Groups Overview */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#2D332A] flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#D49B4B]" />
            <span>المجموعات الدراسية النشطة</span>
          </h2>
          <button
            onClick={() => onNavigateToTab('groups')}
            className="text-[11px] font-bold text-[#748C70] hover:underline"
          >
            عرض الكل ({groups.length})
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="p-6 bg-white border border-[#E8E2D6] rounded-2xl text-center space-y-1.5 shadow-sm">
            <Layers className="w-8 h-8 mx-auto text-[#8A9187] opacity-50" />
            <p className="font-bold text-[#2D332A] text-xs">لا توجد مجموعات بعد</p>
            <p className="text-[11px] text-[#8A9187]">
              ابدأ بإنشاء مجموعتك الأولى لتنظيم الطلاب والحصص
            </p>
            <button
              onClick={onOpenAddGroup}
              className="mt-2 px-3 py-1.5 rounded-xl bg-[#D49B4B] text-white font-bold text-xs inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إنشاء مجموعة جديدة</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {groups.slice(0, 4).map((group) => {
              const count = db.getGroupEnrollments(group.id).length;
              return (
                <div
                  key={group.id}
                  onClick={() => onOpenGroupProfile(group)}
                  className="p-3 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm hover:border-[#748C70]/50 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-xs shrink-0"
                      style={{ backgroundColor: group.accentColor || '#748C70' }}
                    >
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-[#2D332A]">{group.name}</h4>
                      <p className="text-[10px] text-[#8A9187]">
                        {group.subject} • {getLocalizedStageName(group.gradeLevel)}
                      </p>
                    </div>
                  </div>

                  <div className="text-left">
                    <span className="text-xs font-black text-[#748C70]">{count} طالب</span>
                    <p className="text-[10px] text-[#8A9187]">
                      {group.billingType === 'per_session' ? 'بالحصة' : 'شهري'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
