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
import { getScheduledClassesForDate, ScheduledClassItem, parseTimeToMinutes } from '../utils/schedule';
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
  const regularGroups = useMemo(() => groups.filter((g) => g.type !== 'private'), [groups]);

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
    let completedPackagesCount = 0;

    activeStudents.forEach((st) => {
      const fin = db.calculateStudentGrandFinancials(st.id);
      
      // Calculate overdue balance for non-package enrollments
      const nonPackageRemaining = fin.enrollmentsSummary
        .filter((e) => e.billingMode !== 'package' && e.billingType !== 'package')
        .reduce((sum, e) => sum + e.remaining, 0);

      if (nonPackageRemaining > 0) {
        outDues += nonPackageRemaining;
        overdueCount++;
      }

      // Check for completed packages (based on session count, not debt)
      const hasCompletedPackage = fin.enrollmentsSummary.some((e) => {
        const isPkg = e.billingMode === 'package' || e.billingType === 'package';
        if (isPkg) {
          const pkgCount = Math.max(1, e.packageSessionsCount || 8);
          const purchased = e.purchasedSessionsCount || 0;
          const totalCovered = Math.max(pkgCount, purchased > 0 ? Math.ceil(purchased / pkgCount) * pkgCount : pkgCount);
          return (e.attendedSessionsCount || 0) >= totalCovered;
        }
        const isPrepaid = e.billingMode === 'prepaid' || e.billingType === 'prepaid';
        if (isPrepaid) {
          return e.sessionCredit <= 0 && (e.attendedSessionsCount || 0) > 0;
        }
        return false;
      });

      if (hasCompletedPackage) {
        completedPackagesCount++;
      }
    });

    return {
      totalOutstandingDues: outDues,
      overdueStudentsCount: overdueCount,
      lowCreditStudentsCount: completedPackagesCount,
    };
  }, [students, payments, sessions]);

  // Smart Reminders
  const smartReminders = useMemo(() => {
    return getSmartReminders(students, groups, sessions, enrollments, allAttendance);
  }, [students, groups, sessions, enrollments, allAttendance]);

  // Helper to find existing session for this scheduled occurrence
  const findSessionForScheduleItem = (item: ScheduledClassItem): Session | undefined => {
    const itemMins = parseTimeToMinutes(item.rawTime || item.time);

    // 1. Match by group/enrollment AND start time
    const timeMatch = todaySessions.find((s) => {
      const isTarget = s.groupId === item.groupId || (item.enrollmentId && s.enrollmentId === item.enrollmentId);
      if (!isTarget) return false;

      if (s.startTime && (item.rawTime || item.time)) {
        const sMins = parseTimeToMinutes(s.startTime);
        if (sMins !== 99999 && itemMins !== 99999) {
          return sMins === itemMins;
        }
        return s.startTime === item.rawTime || s.startTime === item.time;
      }
      return false;
    });

    if (timeMatch) return timeMatch;

    // 2. Fallback: if only one session exists for this group today and neither has a specific time
    const groupSessionsToday = todaySessions.filter(
      (s) => s.groupId === item.groupId || (item.enrollmentId && s.enrollmentId === item.enrollmentId)
    );
    if (groupSessionsToday.length === 1 && !item.rawTime && !groupSessionsToday[0].startTime) {
      return groupSessionsToday[0];
    }

    return undefined;
  };

  // Quick Attendance Actions
  const getOrCreateSessionForSchedule = (item: ScheduledClassItem): Session => {
    const existing = findSessionForScheduleItem(item);
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
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-4 text-slate-900 pb-24" dir="rtl">
      
      {/* Teacher Welcome Header - Modern SaaS Deep Navy Card */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-md flex items-center justify-between relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 space-y-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-white">
              مرحباً، {teacherProfile.name || 'أستاذنا الفاضل'}
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
              معلم معتمد
            </span>
          </div>
          <p className="text-xs text-slate-300 font-medium">
            {teacherProfile.subject} • {teacherProfile.centerOrSchool || 'مركز التعليم'}
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 px-3 py-1.5 rounded-xl shadow-xs text-xs font-semibold text-slate-100">
          <Calendar className="w-3.5 h-3.5 text-amber-300" />
          <span>
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>

      {/* Quick Success Toast */}
      {quickSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-between shadow-md animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{quickSuccessMsg}</span>
          </div>
          <button onClick={() => setQuickSuccessMsg(null)}>
            <X className="w-4 h-4 text-white/80 hover:text-white" />
          </button>
        </div>
      )}

      {/* 1. Today's Overview Bar (Information First, Low Noise) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <CalendarCheck2 className="w-4 h-4 text-blue-600" />
            <span>ملخص نشاط اليوم</span>
          </span>
          <button
            onClick={() => onNavigateToTab('sessions')}
            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
          >
            عرض الحصص
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center divide-x divide-x-reverse divide-slate-100">
          <div className="px-1">
            <p className="text-xl font-black text-slate-900">{totalTodayClassesCount}</p>
            <p className="text-[10px] font-medium text-slate-500 mt-0.5">حصص اليوم</p>
          </div>
          <div className="px-1">
            <p className="text-xl font-black text-emerald-600">{completedTodaySessionsCount}</p>
            <p className="text-[10px] font-medium text-slate-500 mt-0.5">تم رصدها</p>
          </div>
          <div className="px-1">
            <p className="text-xl font-black text-amber-600">{remainingTodaySessionsCount}</p>
            <p className="text-[10px] font-medium text-slate-500 mt-0.5">متبقية</p>
          </div>
          <div className="px-1">
            <p className="text-xl font-black text-slate-900">{totalTodayRevenue} <span className="text-[10px] font-normal text-slate-500">ج</span></p>
            <p className="text-[10px] font-medium text-slate-500 mt-0.5">تحصيل اليوم</p>
          </div>
        </div>
      </div>

      {/* 2. Financial & Student Health Summary */}
      <div className="grid grid-cols-2 gap-2.5">
        <div
          onClick={() => onNavigateToTab('reports')}
          className="p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-blue-300 transition-all cursor-pointer space-y-1.5 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">تحصيل الشهر</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-slate-900 mt-0.5">
            {totalMonthRevenue} <span className="text-xs font-semibold text-slate-500">ج</span>
          </p>
          <p className="text-[10px] text-emerald-700 font-bold flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" />
            <span>شهر {currentMonth} / {currentYear}</span>
          </p>
        </div>

        <div
          onClick={() => onNavigateToTab('reports')}
          className="p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-rose-300 transition-all cursor-pointer space-y-1.5 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">مستحقات غير مسددة</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-rose-600 mt-0.5">
            {totalOutstandingDues} <span className="text-xs font-semibold text-slate-500">ج</span>
          </p>
          <p className="text-[10px] text-slate-500 font-medium">
            {overdueStudentsCount > 0 ? `على ${overdueStudentsCount} طلاب` : 'لا توجد متأخرات'}
          </p>
        </div>
      </div>

      {/* Low session credit warning chip if any */}
      {lowCreditStudentsCount > 0 && (
        <div
          onClick={() => onNavigateToTab('students')}
          className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-amber-100/70 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-700" />
            <span className="text-xs font-medium text-amber-900">
              تنبيه باقات: {lowCreditStudentsCount} طلاب اكتملت باقاتهم وحان وقت التجديد
            </span>
          </div>
          <ArrowUpRight className="w-3.5 h-3.5 text-amber-700" />
        </div>
      )}

      {/* 3. Quick Action Buttons */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={onOpenAddStudent}
          className="min-h-[46px] p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-slate-800 transition-all shadow-2xs active:scale-95"
        >
          <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <UserPlus className="w-3.5 h-3.5" />
          </div>
          <span>طالب جديد</span>
        </button>

        <button
          onClick={onOpenAddGroup}
          className="min-h-[46px] p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-slate-800 transition-all shadow-2xs active:scale-95"
        >
          <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span>مجموعة</span>
        </button>

        <button
          onClick={onOpenAddPayment}
          className="min-h-[46px] p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-slate-800 transition-all shadow-2xs active:scale-95"
        >
          <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <span>تسجيل دفعة</span>
        </button>

        <button
          onClick={onOpenAddSession}
          className="min-h-[46px] p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-slate-800 transition-all shadow-2xs active:scale-95"
        >
          <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <CalendarCheck2 className="w-3.5 h-3.5" />
          </div>
          <span>جدولة حصة</span>
        </button>
      </div>

      {/* 4. Smart Reminders (Compact, Collapsible / Limited by default) */}
      {smartReminders.length > 0 && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-amber-500" />
              <span>تنبيهات للمتابعة ({smartReminders.length})</span>
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
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
                  className={`p-2.5 rounded-xl flex items-center justify-between gap-2 transition-all ${
                    isHigh ? 'bg-rose-50/70 border border-rose-200' : 'bg-slate-50 border border-slate-200/80'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        isHigh ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {rem.badge}
                      </span>
                      <h4 className="font-bold text-xs text-slate-900 truncate">{rem.title}</h4>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">{rem.description}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {rem.actionType === 'add_payment' && targetStudent && (
                      <button
                        onClick={onOpenAddPayment}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 transition-all shadow-2xs"
                      >
                        سداد
                      </button>
                    )}

                    {rem.parentPhone && (
                      <a
                        href={`https://wa.me/${rem.parentPhone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all border border-emerald-200"
                        title="واتساب ولي الأمر"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {targetStudent && (
                      <button
                        onClick={() => onOpenStudentProfile(targetStudent)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-700 hover:bg-slate-100"
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
          <h2 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <CalendarCheck2 className="w-3.5 h-3.5 text-blue-600" />
            <span>حصص اليوم ({scheduledToday.length > 0 ? scheduledToday.length : todaySessions.length})</span>
          </h2>
          <button
            onClick={onOpenAddSession}
            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة حصة</span>
          </button>
        </div>

        {scheduledToday.length === 0 && todaySessions.length === 0 ? (
          <div className="p-6 bg-white border border-slate-200/90 rounded-2xl text-center space-y-1.5 shadow-xs">
            <CalendarCheck2 className="w-7 h-7 mx-auto text-slate-400 opacity-60" />
            <p className="font-bold text-slate-900 text-xs">لا توجد حصص مجدولة لليوم</p>
            <p className="text-[11px] text-slate-500">
              يمكنك جدولة حصة الآن لأي مجموعة أو طالب خاص
            </p>
            <button
              onClick={onOpenAddSession}
              className="mt-2 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-1 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>جدولة حصة جديدة</span>
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs divide-y divide-slate-100 overflow-hidden">
            {scheduledToday.map((item) => {
              const matchingSession = findSessionForScheduleItem(item);
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
                  className="transition-colors hover:bg-slate-50/70"
                >
                  {/* Clean List Row */}
                  <div className="p-3.5 flex items-center justify-between gap-2.5">
                    
                    {/* Time & Class Title */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="text-center shrink-0 min-w-[54px] bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5">
                        <span className="text-[11px] font-bold text-slate-900 block leading-tight">{item.time}</span>
                        <span className={`text-[9px] font-bold block mt-0.5 px-1 rounded ${
                          item.isPrivate ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.isPrivate ? 'خاص' : 'مجموعة'}
                        </span>
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.accentColor || '#2563EB' }}
                          />
                          <h3 className="font-bold text-xs text-slate-900 truncate">
                            {item.isPrivate ? (item.studentName ? `خاص — ${item.studentName}` : 'درس خاص') : item.groupName}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
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
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg">
                          حاضر {presentCount}/{groupStudents.length}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkAllPresent(item)}
                          className="min-h-[36px] px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition-all active:scale-95"
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
                        className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors"
                        title="تفاصيل ورصد فردي"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Student List */}
                  {isExpanded && (
                    <div className="p-3 bg-slate-50 border-t border-slate-200/80 space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-1">
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
                              className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                            >
                              <span className="font-bold text-xs text-slate-900 truncate min-w-0">
                                {st.name}
                              </span>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'present', true)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                    stStatus === 'present'
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                                  }`}
                                >
                                  حاضر
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'absent_charged', true)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                    stStatus === 'absent_charged' || (stStatus === 'absent' && currentRecord?.isCharged !== false)
                                      ? 'bg-rose-600 text-white shadow-2xs'
                                      : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700'
                                  }`}
                                >
                                  غياب محسوب
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'absent_free', false)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                    stStatus === 'absent_free' || stStatus === 'excused' || (stStatus === 'absent' && currentRecord?.isCharged === false)
                                      ? 'bg-slate-600 text-white shadow-2xs'
                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  }`}
                                >
                                  معتذر
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'late', true)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                    stStatus === 'late'
                                      ? 'bg-amber-600 text-white shadow-2xs'
                                      : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-700'
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
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
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
          <h2 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            <span>المجموعات النشطة ({regularGroups.length})</span>
          </h2>
          <button
            onClick={() => onNavigateToTab('groups')}
            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
          >
            عرض الكل
          </button>
        </div>

        {regularGroups.length === 0 ? (
          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl text-center space-y-1 shadow-xs">
            <p className="font-bold text-slate-900 text-xs">لا توجد مجموعات بعد</p>
            <p className="text-[10px] text-slate-500">ابدأ بإنشاء مجموعتك الأولى لتنظيم الطلاب</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {regularGroups.slice(0, 4).map((group) => {
              const count = db.getGroupEnrollments(group.id).length;
              return (
                <div
                  key={group.id}
                  onClick={() => onOpenGroupProfile(group)}
                  className="p-3 bg-white border border-slate-200/90 rounded-xl shadow-xs hover:border-blue-300 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: group.accentColor || '#2563EB' }}
                    />
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-slate-900 truncate">{group.name}</h4>
                      <p className="text-[10px] text-slate-500 truncate">
                        {group.subject} • {getLocalizedStageName(group.gradeLevel)}
                      </p>
                    </div>
                  </div>

                  <div className="text-left shrink-0 pl-1">
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">{count} طالب</span>
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
