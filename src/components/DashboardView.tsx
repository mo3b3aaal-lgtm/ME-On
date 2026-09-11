import React, { useState, useMemo } from 'react';
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
  Mail,
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
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonth = useMemo(() => new Date().getMonth() + 1, []);
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  // State for expanded quick attendance cards
  const [expandedAttendanceCardId, setExpandedAttendanceCardId] = useState<string | null>(null);
  const [quickSuccessMsg, setQuickSuccessMsg] = useState<string | null>(null);

  const showQuickFeedback = (msg: string) => {
    setQuickSuccessMsg(msg);
    setTimeout(() => setQuickSuccessMsg(null), 3000);
  };

  // Filter today's sessions
  const todaySessions = useMemo(() => {
    return sessions.filter((s) => s.date === todayStr && s.status !== 'cancelled');
  }, [sessions, todayStr]);

  const enrollments = useMemo(() => db.getEnrollments(), [students, groups]);
  const allAttendance = useMemo(() => db.getAttendance(), [sessions]);

  // Scheduled classes for today
  const scheduledToday = useMemo(() => {
    return getScheduledClassesForDate(new Date(), groups, students, enrollments, true);
  }, [groups, students, enrollments]);

  // Completed vs Remaining sessions count today
  const completedTodaySessionsCount = useMemo(() => {
    return todaySessions.filter((s) => {
      const att = db.getSessionAttendance(s.id);
      return att.length > 0 || s.status === 'completed';
    }).length;
  }, [todaySessions]);

  const totalTodayClassesCount = useMemo(() => {
    return Math.max(scheduledToday.length, todaySessions.length);
  }, [scheduledToday.length, todaySessions.length]);

  const remainingTodaySessionsCount = useMemo(() => {
    return Math.max(0, totalTodayClassesCount - completedTodaySessionsCount);
  }, [totalTodayClassesCount, completedTodaySessionsCount]);

  // Revenue stats
  const { totalMonthRevenue, totalTodayRevenue } = useMemo(() => {
    const monthPayments = payments.filter((p) => p.month === currentMonth && p.year === currentYear);
    const mRev = monthPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const tPayments = payments.filter((p) => p.date === todayStr);
    const tRev = tPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    return { totalMonthRevenue: mRev, totalTodayRevenue: tRev };
  }, [payments, currentMonth, currentYear, todayStr]);

  // Outstanding balances & Low credit calculations across active students
  const { totalOutstandingDues, overdueStudentsCount, lowCreditStudentsCount } = useMemo(() => {
    const activeStudents = students.filter((s) => s.status !== 'archived');
    let outDues = 0;
    let overdueCount = 0;
    let lowCreditCount = 0;

    activeStudents.forEach((st) => {
      const fin = db.calculateStudentGrandFinancials(st.id);
      if (fin.grandRemaining > 0) {
        outDues += fin.grandRemaining;
        overdueCount++;
      }
      const hasLow = fin.enrollmentsSummary.some((e) => {
        const isPkg = e.billingMode === 'package' || e.billingType === 'package' || e.billingMode === 'prepaid' || e.billingType === 'prepaid';
        return isPkg && e.sessionCredit <= 2;
      });
      if (hasLow) {
        lowCreditCount++;
      }
    });

    return {
      totalOutstandingDues: outDues,
      overdueStudentsCount: overdueCount,
      lowCreditStudentsCount: lowCreditCount,
    };
  }, [students, payments, sessions]);

  // Smart Reminders
  const smartReminders = useMemo(() => {
    return getSmartReminders(students, groups, sessions, enrollments, allAttendance);
  }, [students, groups, sessions, enrollments, allAttendance]);

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
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-4 text-[#272D24] pb-24" dir="rtl">
      
      {/* Teacher Welcome Header */}
      <div className="flex items-center justify-between pb-1">
        <div>
          <h1 className="text-xl font-bold font-serif text-[#272D24] tracking-tight">
            مرحباً، {teacherProfile.name || 'أستاذنا الفاضل'}
          </h1>
          <p className="text-xs text-[#878E82] font-medium mt-0.5">
            {teacherProfile.subject} • {teacherProfile.centerOrSchool || 'مركز التعليم'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-white border border-[#EAE6DE] px-3 py-1.5 rounded-xl shadow-xs text-xs font-semibold text-[#5F675A]">
          <Calendar className="w-3.5 h-3.5 text-[#607B5E]" />
          <span>
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>

      {/* Quick Success Toast */}
      {quickSuccessMsg && (
        <div className="p-3 rounded-xl bg-[#607B5E] text-white text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{quickSuccessMsg}</span>
          </div>
          <button onClick={() => setQuickSuccessMsg(null)}>
            <X className="w-4 h-4 text-white/80" />
          </button>
        </div>
      )}

      {/* 1. Today's Overview Bar (Information First, Low Noise) */}
      <div className="bg-white border border-[#EAE6DE] rounded-2xl p-3.5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#5F675A] flex items-center gap-1.5">
            <CalendarCheck2 className="w-4 h-4 text-[#607B5E]" />
            <span>ملخص نشاط اليوم</span>
          </span>
          <button
            onClick={() => onNavigateToTab('sessions')}
            className="text-[11px] font-bold text-[#607B5E] hover:underline"
          >
            عرض الحصص
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center divide-x divide-x-reverse divide-[#EAE6DE]/80">
          <div className="px-1">
            <p className="text-xl font-black text-[#272D24]">{totalTodayClassesCount}</p>
            <p className="text-[10px] font-medium text-[#878E82] mt-0.5">حصص اليوم</p>
          </div>
          <div className="px-1">
            <p className="text-xl font-black text-[#607B5E]">{completedTodaySessionsCount}</p>
            <p className="text-[10px] font-medium text-[#878E82] mt-0.5">تم رصدها</p>
          </div>
          <div className="px-1">
            <p className="text-xl font-black text-[#B88438]">{remainingTodaySessionsCount}</p>
            <p className="text-[10px] font-medium text-[#878E82] mt-0.5">متبقية</p>
          </div>
          <div className="px-1">
            <p className="text-xl font-black text-[#272D24]">{totalTodayRevenue} <span className="text-[10px] font-normal text-[#878E82]">ج</span></p>
            <p className="text-[10px] font-medium text-[#878E82] mt-0.5">تحصيل اليوم</p>
          </div>
        </div>
      </div>

      {/* 2. Financial & Student Health Summary */}
      <div className="grid grid-cols-2 gap-2.5">
        <div
          onClick={() => onNavigateToTab('reports')}
          className="p-3 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs hover:border-[#607B5E]/40 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#878E82]">تحصيل الشهر</span>
            <DollarSign className="w-4 h-4 text-[#607B5E]" />
          </div>
          <p className="text-xl font-black text-[#272D24] mt-0.5">
            {totalMonthRevenue} <span className="text-xs font-semibold text-[#878E82]">ج</span>
          </p>
          <p className="text-[10px] text-[#607B5E] font-medium flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" />
            <span>شهر {currentMonth} / {currentYear}</span>
          </p>
        </div>

        <div
          onClick={() => onNavigateToTab('reports')}
          className="p-3 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs hover:border-[#B86B52]/40 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#878E82]">مستحقات غير مسددة</span>
            <Receipt className="w-4 h-4 text-[#B86B52]" />
          </div>
          <p className="text-xl font-black text-[#B86B52] mt-0.5">
            {totalOutstandingDues} <span className="text-xs font-semibold text-[#878E82]">ج</span>
          </p>
          <p className="text-[10px] text-[#878E82] font-medium">
            {overdueStudentsCount > 0 ? `على ${overdueStudentsCount} طلاب` : 'لا توجد متأخرات'}
          </p>
        </div>
      </div>

      {/* Low session credit warning chip if any */}
      {lowCreditStudentsCount > 0 && (
        <div
          onClick={() => onNavigateToTab('students')}
          className="p-2.5 bg-[#B88438]/10 border border-[#B88438]/25 rounded-xl flex items-center justify-between cursor-pointer hover:bg-[#B88438]/15 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#946522]" />
            <span className="text-xs font-medium text-[#946522]">
              تنبيه باقات: {lowCreditStudentsCount} طلاب قارب رصيد حصصهم على الانتهاء (≤ 2)
            </span>
          </div>
          <ArrowUpRight className="w-3.5 h-3.5 text-[#946522]" />
        </div>
      )}

      {/* 3. Quick Action Buttons */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={onOpenAddStudent}
          className="min-h-[44px] p-2.5 rounded-xl bg-white hover:bg-[#F5F2EC] border border-[#EAE6DE] flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-[#272D24] transition-all shadow-xs active:scale-95"
        >
          <UserPlus className="w-4 h-4 text-[#607B5E]" />
          <span>طالب جديد</span>
        </button>

        <button
          onClick={onOpenAddGroup}
          className="min-h-[44px] p-2.5 rounded-xl bg-white hover:bg-[#F5F2EC] border border-[#EAE6DE] flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-[#272D24] transition-all shadow-xs active:scale-95"
        >
          <Layers className="w-4 h-4 text-[#B88438]" />
          <span>مجموعة</span>
        </button>

        <button
          onClick={onOpenAddPayment}
          className="min-h-[44px] p-2.5 rounded-xl bg-white hover:bg-[#F5F2EC] border border-[#EAE6DE] flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-[#272D24] transition-all shadow-xs active:scale-95"
        >
          <DollarSign className="w-4 h-4 text-[#607B5E]" />
          <span>تسجيل دفعة</span>
        </button>

        <button
          onClick={onOpenAddSession}
          className="min-h-[44px] p-2.5 rounded-xl bg-white hover:bg-[#F5F2EC] border border-[#EAE6DE] flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-[#272D24] transition-all shadow-xs active:scale-95"
        >
          <CalendarCheck2 className="w-4 h-4 text-[#586E7E]" />
          <span>جدولة حصة</span>
        </button>
      </div>

      {/* 4. Smart Reminders (Compact, Collapsible / Limited by default) */}
      {smartReminders.length > 0 && (
        <div className="bg-white border border-[#EAE6DE] rounded-2xl p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#272D24] flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-[#B88438]" />
              <span>تنبيهات للمتابعة ({smartReminders.length})</span>
            </span>
            <span className="text-[10px] text-[#878E82] font-medium">
              أهم الملاحظات
            </span>
          </div>

          <div className="space-y-1.5">
            {smartReminders.slice(0, 3).map((rem) => {
              const targetStudent = rem.studentId ? students.find((s) => s.id === rem.studentId) : null;
              const isHigh = rem.priority === 'high';

              return (
                <div
                  key={rem.id}
                  className={`p-2 rounded-xl flex items-center justify-between gap-2 transition-all ${
                    isHigh ? 'bg-[#B86B52]/10 border border-[#B86B52]/20' : 'bg-[#FAF8F5] border border-[#EAE6DE]'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        isHigh ? 'bg-[#B86B52]/15 text-[#9A543E]' : 'bg-[#B88438]/15 text-[#946522]'
                      }`}>
                        {rem.badge}
                      </span>
                      <h4 className="font-bold text-xs text-[#272D24] truncate">{rem.title}</h4>
                    </div>
                    <p className="text-[10px] text-[#878E82] truncate">{rem.description}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {rem.actionType === 'add_payment' && targetStudent && (
                      <button
                        onClick={onOpenAddPayment}
                        className="px-2 py-1 rounded-lg bg-[#607B5E] text-white text-[10px] font-bold hover:bg-[#50684E] transition-all"
                      >
                        سداد
                      </button>
                    )}

                    {rem.parentPhone && (
                      <a
                        href={`https://wa.me/${rem.parentPhone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-[#607B5E]/12 text-[#4E664C] hover:bg-[#607B5E]/20 transition-all"
                        title="واتساب ولي الأمر"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {targetStudent && (
                      <button
                        onClick={() => onOpenStudentProfile(targetStudent)}
                        className="px-2 py-1 rounded-lg bg-white border border-[#EAE6DE] text-[10px] font-bold text-[#5F675A] hover:bg-[#F5F2EC]"
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

      {/* 5. Today's Classes List (The Main Operational Focus) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#5F675A] flex items-center gap-1.5">
            <CalendarCheck2 className="w-3.5 h-3.5 text-[#607B5E]" />
            <span>حصص اليوم ({scheduledToday.length > 0 ? scheduledToday.length : todaySessions.length})</span>
          </h2>
          <button
            onClick={onOpenAddSession}
            className="text-[11px] font-bold text-[#607B5E] hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة حصة</span>
          </button>
        </div>

        {scheduledToday.length === 0 && todaySessions.length === 0 ? (
          <div className="p-6 bg-white border border-[#EAE6DE] rounded-2xl text-center space-y-1.5 shadow-xs">
            <CalendarCheck2 className="w-7 h-7 mx-auto text-[#878E82] opacity-40" />
            <p className="font-bold text-[#272D24] text-xs">لا توجد حصص مجدولة لليوم</p>
            <p className="text-[11px] text-[#878E82]">
              يمكنك جدولة حصة الآن لأي مجموعة أو طالب خاص
            </p>
            <button
              onClick={onOpenAddSession}
              className="mt-2 px-3 py-1.5 rounded-xl bg-[#607B5E] text-white font-bold text-xs inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>جدولة حصة جديدة</span>
            </button>
          </div>
        ) : (
          <div className="bg-white border border-[#EAE6DE] rounded-2xl shadow-xs divide-y divide-[#EAE6DE]/70 overflow-hidden">
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
                  className="transition-colors hover:bg-[#FAF8F5]/80"
                >
                  {/* Clean List Row */}
                  <div className="p-3 flex items-center justify-between gap-2.5">
                    
                    {/* Time & Class Title */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="text-center shrink-0 min-w-[52px] bg-[#FAF8F5] border border-[#EAE6DE] rounded-xl px-2 py-1.5">
                        <span className="text-[11px] font-bold text-[#272D24] block leading-tight">{item.time}</span>
                        <span className="text-[9px] font-medium text-[#878E82] block mt-0.5">
                          {item.isPrivate ? 'خاص' : 'مجموعة'}
                        </span>
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: item.accentColor || '#607B5E' }}
                          />
                          <h3 className="font-bold text-xs text-[#272D24] truncate">
                            {item.isPrivate ? item.studentName : item.groupName}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-[#878E82] flex-wrap">
                          <span>{item.isPrivate ? 'درس خاص' : (item.subject || 'عام')}</span>
                          {!item.isPrivate && (
                            <>
                              <span>•</span>
                              <span>{groupStudents.length} طلاب</span>
                            </>
                          )}
                          {item.location && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[120px]">{item.location}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status & Primary Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isRecorded ? (
                        <span className="text-[10px] font-bold bg-[#607B5E]/12 text-[#4E664C] px-2.5 py-1 rounded-lg">
                          حاضر {presentCount}/{groupStudents.length}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkAllPresent(item)}
                          className="min-h-[36px] px-3 py-1 rounded-xl bg-[#607B5E] hover:bg-[#50684E] text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all active:scale-95"
                          title="تسجيل حضور جميع الطلاب دفعة واحدة"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>حضور الكل</span>
                        </button>
                      )}

                      {/* Expand for detail marking */}
                      <button
                        type="button"
                        onClick={() => setExpandedAttendanceCardId(isExpanded ? null : item.id)}
                        className="p-1.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F2ECE1] border border-[#EAE6DE] text-[#272D24] transition-colors"
                        title="تفاصيل ورصد فردي"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Student List */}
                  {isExpanded && (
                    <div className="p-3 bg-[#FAF8F5] border-t border-[#EAE6DE] space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                      <div className="flex items-center justify-between text-[10px] font-bold text-[#5F675A] mb-1">
                        <span>قائمة الطلاب ({groupStudents.length})</span>
                        <span>رصد فردي</span>
                      </div>

                      <div className="space-y-1">
                        {groupStudents.map((st) => {
                          const currentRecord = sessionAttendance.find((a) => a.studentId === st.id);
                          const stStatus = currentRecord?.status;

                          return (
                            <div
                              key={st.id}
                              className="p-1.5 bg-white rounded-xl border border-[#EAE6DE] flex items-center justify-between gap-2"
                            >
                              <span className="font-bold text-xs text-[#272D24] truncate min-w-0">
                                {st.name}
                              </span>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'present', true)}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                                    stStatus === 'present'
                                      ? 'bg-[#607B5E] text-white'
                                      : 'bg-[#F5F2EC] text-[#5F675A] hover:bg-[#607B5E]/15'
                                  }`}
                                >
                                  حاضر
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'absent_charged', true)}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                                    stStatus === 'absent_charged' || (stStatus === 'absent' && currentRecord?.isCharged !== false)
                                      ? 'bg-[#B86B52] text-white'
                                      : 'bg-[#F5F2EC] text-[#5F675A] hover:bg-[#B86B52]/15'
                                  }`}
                                >
                                  غياب محسوب
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'absent_free', false)}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                                    stStatus === 'absent_free' || stStatus === 'excused' || (stStatus === 'absent' && currentRecord?.isCharged === false)
                                      ? 'bg-[#878E82] text-white'
                                      : 'bg-[#F5F2EC] text-[#5F675A] hover:bg-[#878E82]/15'
                                  }`}
                                >
                                  معتذر
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'late', true)}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                                    stStatus === 'late'
                                      ? 'bg-[#B88438] text-white'
                                      : 'bg-[#F5F2EC] text-[#5F675A] hover:bg-[#B88438]/15'
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
                        <div className="pt-1.5 flex justify-end">
                          <button
                            type="button"
                            onClick={() => onOpenAttendanceModal(matchingSession)}
                            className="text-[10px] font-bold text-[#607B5E] hover:underline flex items-center gap-1"
                          >
                            <span>فتح نافذة الحضور الشاملة</span>
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

      {/* 6. Active Groups (Compact Scannable List) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#5F675A] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#B88438]" />
            <span>المجموعات النشطة ({groups.length})</span>
          </h2>
          <button
            onClick={() => onNavigateToTab('groups')}
            className="text-[11px] font-bold text-[#607B5E] hover:underline"
          >
            عرض الكل
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="p-4 bg-white border border-[#EAE6DE] rounded-2xl text-center space-y-1 shadow-xs">
            <p className="font-bold text-[#272D24] text-xs">لا توجد مجموعات بعد</p>
            <p className="text-[10px] text-[#878E82]">ابدأ بإنشاء مجموعتك الأولى لتنظيم الطلاب</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {groups.slice(0, 4).map((group) => {
              const count = db.getGroupEnrollments(group.id).length;
              return (
                <div
                  key={group.id}
                  onClick={() => onOpenGroupProfile(group)}
                  className="p-2.5 bg-white border border-[#EAE6DE] rounded-xl shadow-xs hover:border-[#607B5E]/40 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: group.accentColor || '#607B5E' }}
                    />
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-[#272D24] truncate">{group.name}</h4>
                      <p className="text-[10px] text-[#878E82] truncate">
                        {group.subject} • {getLocalizedStageName(group.gradeLevel)}
                      </p>
                    </div>
                  </div>

                  <div className="text-left shrink-0 pl-1">
                    <span className="text-xs font-bold text-[#607B5E]">{count} طالب</span>
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
