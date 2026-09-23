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
import { Student, Group, Session, Payment, TeacherProfile, Attendance, AttendanceStatus, Enrollment, ActiveTab } from '../types';
import { db, roundMoney, multiplyMoney, addMoney, getEffectiveSessionPrice } from '../utils/storage';
import { getLocalizedStageName } from '../utils/stages';
import { getScheduledClassesForDate, ScheduledClassItem, parseTimeToMinutes } from '../utils/schedule';
import { getSmartReminders, SmartReminderItem } from '../utils/reminders';
import { ClassyOwlMascot } from './ClassyOwlMascot';

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
  onOpenNotificationsModal?: () => void;
  onNavigateToTab: (tab: ActiveTab) => void;
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
  onOpenNotificationsModal,
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

  // Revenue stats - including prepaid collected session revenue
  const { totalMonthRevenue, totalTodayRevenue, totalAllTimeRevenue } = useMemo(() => {
    const finHistory = db.calculateFinancialHistory();
    const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const curMonthRecord = finHistory.months.find((m) => m.monthYear === currentMonthKey);
    const mRev = curMonthRecord ? curMonthRecord.totalCollected : 0;

    // Today's revenue: explicit payments recorded today + prepaid sessions completed today
    const tPayments = payments.filter((p) => p.date === todayStr);
    let tRev = tPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    const todayCompletedSessions = sessions.filter((s) => s.date === todayStr && s.status === 'completed');
    todayCompletedSessions.forEach((s) => {
      const atts = db.getSessionAttendance(s.id);
      const grp = groups.find((g) => g.id === s.groupId);
      atts.forEach((a) => {
        const isCharged = a.status === 'present' || a.status === 'late' || a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false);
        if (isCharged) {
          const enr = enrollments.find((e) => e.id === a.enrollmentId || (e.studentId === a.studentId && e.groupId === s.groupId));
          const isHourly = enr?.billingType === 'hourly' || enr?.billingMode === 'hourly' || grp?.billingType === 'hourly' || grp?.billingMode === 'hourly';
          const isPackage = !isHourly && (enr?.billingMode === 'package' || enr?.billingType === 'package' || grp?.billingType === 'package');
          const isPrepaid = !isHourly && !isPackage && (enr?.billingMode === 'prepaid' || enr?.billingType === 'prepaid' || (enr?.billingType === 'per_session' && enr?.billingMode !== 'postpaid') || grp?.billingType === 'prepaid' || (!enr?.billingMode && !enr?.billingType));
          const isUnpaid = a.paymentStatus === 'unpaid' || a.paymentOverride === 'unpaid' || a.isPaid === false;
          if (isPrepaid && !isUnpaid) {
            let sessionVal = 0;
            if (isHourly) {
              const hours = a.hours !== undefined && a.hours !== null ? Number(a.hours) : (s.hours !== undefined && s.hours !== null ? Number(s.hours) : 1);
              const rate = a.hourlyRate || s.hourlyRate || enr?.hourlyRate || grp?.hourlyRate || enr?.customPrice || grp?.defaultPrice || 100;
              sessionVal = roundMoney(multiplyMoney(hours, rate), 2);
            } else {
              const sRate = a.sessionPriceSnapshot || (enr ? getEffectiveSessionPrice(enr, grp) : (grp?.defaultPrice || 100));
              sessionVal = roundMoney(sRate, 2);
            }
            tRev = addMoney(tRev, sessionVal);
          }
        }
      });
    });

    return { totalMonthRevenue: mRev, totalTodayRevenue: tRev, totalAllTimeRevenue: finHistory.totalCollected };
  }, [payments, sessions, groups, enrollments, currentMonth, currentYear, todayStr]);

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
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-4 text-[#14152C] pb-28 bg-[#F4F3FA] relative" dir="rtl">
      
      {/* 1. Profile & Top Header Bar (Dark Navy Container with Organic Lighting) */}
      <div className="classy-dark-card p-4 sm:p-5 flex items-center justify-between relative overflow-hidden">
        {/* Soft background ambient glow */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#7B61FF]/25 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[#FF5E62]/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10 min-w-0">
          {/* Mascot / Avatar with Glowing Aura */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#7B61FF] to-[#FF5E62] p-0.5 shadow-lg shadow-[#7B61FF]/30 shrink-0">
            <div className="w-full h-full rounded-[14px] bg-[#1E1F3D] flex items-center justify-center text-white font-black text-lg overflow-hidden">
              {teacherProfile.name ? teacherProfile.name.charAt(0) : 'م'}
            </div>
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-white tracking-tight truncate">
                {teacherProfile.name || 'أستاذنا الفاضل'}
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF5E62]/20 text-[#FF758C] border border-[#FF5E62]/40">
                معلم كلاسي
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium truncate">
              {teacherProfile.subject || 'المادة الدراسية'} • {teacherProfile.centerOrSchool || 'مركز التعليم'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-10 shrink-0">
          {onOpenNotificationsModal && (
            <button
              onClick={onOpenNotificationsModal}
              className="relative w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-md"
              title="مركز التنبيهات والإشعارات"
            >
              <Bell className="w-4.5 h-4.5 text-white" />
              {smartReminders.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-gradient-to-r from-[#FF5E62] to-[#FF758C] text-white text-[9px] font-black flex items-center justify-center shadow-md animate-pulse">
                  {smartReminders.length}
                </span>
              )}
            </button>
          )}

          <div className="hidden sm:flex items-center gap-1.5 bg-white/10 border border-white/15 px-3 py-1.5 rounded-2xl text-xs font-bold text-white">
            <Calendar className="w-3.5 h-3.5 text-[#FF758C]" />
            <span>
              {new Date().toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Success Toast */}
      {quickSuccessMsg && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold flex items-center justify-between shadow-lg shadow-emerald-600/30 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{quickSuccessMsg}</span>
          </div>
          <button onClick={() => setQuickSuccessMsg(null)}>
            <X className="w-4 h-4 text-white/80 hover:text-white" />
          </button>
        </div>
      )}

      {/* 2. Featured Series Hero Card (Indigo & Coral Glow Accent) */}
      <div className="classy-dark-card p-5 relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5E62] animate-pulse shadow-sm shadow-[#FF5E62]" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#FF758C]">نشاط اليوم الدراسي</span>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white border border-white/15">
              {totalTodayClassesCount} حصص مجدولة
            </span>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-white">
              {completedTodaySessionsCount === totalTodayClassesCount && totalTodayClassesCount > 0
                ? 'اكتملت جميع حصص اليوم بنجاح!'
                : `متبقي ${remainingTodaySessionsCount} حصص للرصد والمتابعة`}
            </h2>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              تحصيل اليوم: {totalTodayRevenue} جنيه • تم رصد {completedTodaySessionsCount} من {totalTodayClassesCount}
            </p>
          </div>

          {/* Progress Bar with Pill Styling */}
          <div className="space-y-1.5 pt-1">
            <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="bg-gradient-to-l from-[#FF5E62] via-[#FF758C] to-[#FFAA2C] h-full rounded-full transition-all duration-500 shadow-sm"
                style={{
                  width: `${totalTodayClassesCount > 0 ? (completedTodaySessionsCount / totalTodayClassesCount) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-bold text-slate-300">
              <span>نسبة الإنجاز: {totalTodayClassesCount > 0 ? Math.round((completedTodaySessionsCount / totalTodayClassesCount) * 100) : 0}%</span>
              <span>{completedTodaySessionsCount}/{totalTodayClassesCount} تم رصدها</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bento Statistics 2x2 Grid (Modern Reference Style) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-xl bg-[#EDE8FF] text-[#7B61FF] flex items-center justify-center font-bold">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <span className="font-extrabold text-sm text-[#14152C]">مؤشرات الأداء السريع</span>
          </div>
          <button
            onClick={() => onNavigateToTab('reports')}
            className="text-xs font-bold text-[#7B61FF] hover:text-[#6C5CE7] flex items-center gap-0.5 cursor-pointer"
          >
            <span>عرض التقارير</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#FF5E62]" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Card 1: Today's Sessions */}
          <div
            onClick={() => onNavigateToTab('sessions')}
            className="classy-card classy-card-hover p-4 flex flex-col items-center justify-center text-center cursor-pointer group active:scale-[0.98]"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#EDE8FF] text-[#7B61FF] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-xs">
              <Sparkles className="w-5 h-5 text-[#7B61FF]" />
            </div>
            <span className="text-xl font-black text-[#14152C] tracking-tight">
              {completedTodaySessionsCount}/{totalTodayClassesCount}
            </span>
            <span className="text-[11px] font-semibold text-[#727494] mt-0.5">
              حصص مكتملة اليوم
            </span>
          </div>

          {/* Card 2: Month Revenue */}
          <div
            onClick={() => onNavigateToTab('reports')}
            className="classy-card classy-card-hover p-4 flex flex-col items-center justify-center text-center cursor-pointer group active:scale-[0.98]"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#FFF5E5] text-[#FFAA2C] border border-[#FFE8C2] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-xs">
              <DollarSign className="w-5 h-5 text-[#FFAA2C]" />
            </div>
            <span className="text-xl font-black text-[#14152C] tracking-tight">
              {totalMonthRevenue} <span className="text-xs font-bold text-[#727494]">ج</span>
            </span>
            <span className="text-[11px] font-semibold text-[#727494] mt-0.5">
              تحصيل شهر {currentMonth}
            </span>
          </div>

          {/* Card 3: Active Students */}
          <div
            onClick={() => onNavigateToTab('students')}
            className="classy-card classy-card-hover p-4 flex flex-col items-center justify-center text-center cursor-pointer group active:scale-[0.98]"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#E1F4FF] text-[#38B6FF] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-xs">
              <Users className="w-5 h-5 text-[#38B6FF]" />
            </div>
            <span className="text-xl font-black text-[#14152C] tracking-tight">
              {students.filter(s => s.status !== 'archived').length}
            </span>
            <span className="text-[11px] font-semibold text-[#727494] mt-0.5">
              إجمالي الطلاب النشطين
            </span>
          </div>

          {/* Card 4: Outstanding Dues */}
          <div
            onClick={() => onNavigateToTab('reports')}
            className="classy-card classy-card-hover p-4 flex flex-col items-center justify-center text-center cursor-pointer group active:scale-[0.98]"
          >
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-xs ${
              totalOutstandingDues > 0
                ? 'bg-[#FFEBEB] text-[#FF5E62] border border-[#FFD6D6]'
                : 'bg-[#E0F7EF] text-emerald-700 border border-emerald-200'
            }`}>
              <Receipt className="w-5 h-5" />
            </div>
            <span className={`text-xl font-black tracking-tight ${totalOutstandingDues > 0 ? 'text-[#FF5E62]' : 'text-emerald-700'}`}>
              {totalOutstandingDues} <span className="text-xs font-bold text-[#727494]">ج</span>
            </span>
            <span className="text-[11px] font-semibold text-[#727494] mt-0.5">
              {totalOutstandingDues > 0 ? `مستحقات (${overdueStudentsCount} طلاب)` : 'لا توجد متأخرات'}
            </span>
          </div>
        </div>
      </div>

      {/* Package Expiry Alert Pill if any */}
      {lowCreditStudentsCount > 0 && (
        <div
          onClick={() => onNavigateToTab('students')}
          className="classy-card classy-card-hover p-3.5 bg-gradient-to-r from-[#FFF5E5] to-[#FFEED1] border-[#FFE2A8] flex items-center justify-between cursor-pointer transition-all shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFAA2C] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#FFAA2C]/30">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <span className="text-xs font-bold text-[#B45309]">
              تنبيه باقات: {lowCreditStudentsCount} طلاب اكتملت باقاتهم وحان وقت التجديد
            </span>
          </div>
          <ArrowUpRight className="w-4.5 h-4.5 text-[#B45309]" />
        </div>
      )}

      {/* 4. Quick Action Buttons (Squircle Colorful Tiles) */}
      <div className="grid grid-cols-4 gap-2.5">
        <button
          onClick={onOpenAddStudent}
          className="classy-card classy-card-hover p-3 flex flex-col items-center justify-center gap-1.5 text-xs font-bold text-[#14152C] transition-all active:scale-95 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#EDE8FF] text-[#7B61FF] flex items-center justify-center shadow-xs">
            <UserPlus className="w-4.5 h-4.5" />
          </div>
          <span className="text-[11px] font-bold truncate">طالب جديد</span>
        </button>

        <button
          onClick={onOpenAddGroup}
          className="classy-card classy-card-hover p-3 flex flex-col items-center justify-center gap-1.5 text-xs font-bold text-[#14152C] transition-all active:scale-95 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#FFF5E5] text-[#FFAA2C] flex items-center justify-center shadow-xs">
            <Layers className="w-4.5 h-4.5" />
          </div>
          <span className="text-[11px] font-bold truncate">مجموعة</span>
        </button>

        <button
          onClick={onOpenAddPayment}
          className="classy-card classy-card-hover p-3 flex flex-col items-center justify-center gap-1.5 text-xs font-bold text-[#14152C] transition-all active:scale-95 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#E0F7EF] text-emerald-700 flex items-center justify-center shadow-xs">
            <DollarSign className="w-4.5 h-4.5" />
          </div>
          <span className="text-[11px] font-bold truncate">تسجيل دفعة</span>
        </button>

        <button
          onClick={onOpenAddSession}
          className="classy-card classy-card-hover p-3 flex flex-col items-center justify-center gap-1.5 text-xs font-bold text-[#14152C] transition-all active:scale-95 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#FFEBEB] text-[#FF5E62] flex items-center justify-center shadow-xs">
            <CalendarCheck2 className="w-4.5 h-4.5" />
          </div>
          <span className="text-[11px] font-bold truncate">جدولة حصة</span>
        </button>
      </div>

      {/* 5. Smart Notifications Preview Area */}
      {smartReminders.length > 0 && (
        <div className="classy-card p-4 space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#E8E4F5]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FFEBEB] text-[#FF5E62] flex items-center justify-center shadow-xs">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-[#14152C]">
                  مركز التنبيهات الذكية
                </h3>
                <p className="text-[10px] sm:text-[11px] text-[#727494] font-medium">
                  {smartReminders.length} تنبيهات تستوجب المتابعة السريعة
                </p>
              </div>
            </div>
            {onOpenNotificationsModal && (
              <button
                onClick={onOpenNotificationsModal}
                className="text-xs text-[#7B61FF] hover:text-[#6C5CE7] font-bold cursor-pointer flex items-center gap-1"
              >
                <span>عرض الكل</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#FF5E62]" />
              </button>
            )}
          </div>

          <div className="space-y-2">
            {smartReminders.slice(0, 3).map((rem) => {
              const targetStudent = rem.studentId ? students.find((s) => s.id === rem.studentId) : null;
              const isHigh = rem.priority === 'high';
              const isAlmostDue = rem.type === 'package_almost_due';

              return (
                <div
                  key={rem.id}
                  className={`p-3 rounded-2xl flex items-center justify-between gap-3 transition-all ${
                    isHigh
                      ? 'bg-[#FFEBEB]/70 border border-[#FFD6D6]'
                      : isAlmostDue
                      ? 'bg-[#FFF5E5]/70 border border-[#FFE8C2]'
                      : 'bg-[#F4F3FA] border border-[#E8E4F5]'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${
                        isHigh
                          ? 'bg-[#FF5E62] text-white shadow-xs'
                          : isAlmostDue
                          ? 'bg-[#FFAA2C] text-white shadow-xs'
                          : 'bg-[#7B61FF]/15 text-[#7B61FF]'
                      }`}>
                        {rem.badge}
                      </span>
                      <h4 className="font-bold text-xs text-[#14152C] truncate">{rem.title}</h4>
                    </div>
                    <p className="text-[11px] text-[#727494] truncate font-medium">{rem.description}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {rem.actionType === 'add_payment' && targetStudent && (
                      <button
                        onClick={onOpenAddPayment}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-bold hover:brightness-105 transition-all shadow-sm cursor-pointer active:scale-95"
                      >
                        سداد
                      </button>
                    )}

                    {rem.actionType === 'record_attendance' && rem.sessionId && (
                      <button
                        onClick={() => {
                          const sess = sessions.find((s) => s.id === rem.sessionId);
                          if (sess) onOpenAttendanceModal(sess);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#1E1F3D] text-white text-[11px] font-bold hover:bg-[#14152C] transition-all shadow-sm cursor-pointer active:scale-95"
                      >
                        رصد
                      </button>
                    )}

                    {rem.parentPhone && (
                      <a
                        href={`https://wa.me/${rem.parentPhone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all border border-emerald-200 cursor-pointer shadow-2xs"
                        title="واتساب ولي الأمر"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    )}

                    {targetStudent && (
                      <button
                        onClick={() => onOpenStudentProfile(targetStudent)}
                        className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E8E4F5] text-[11px] font-bold text-[#14152C] hover:bg-[#F4F3FA] cursor-pointer"
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

      {/* 6. Calendar Strip Widget */}
      <div className="classy-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#EDE8FF] text-[#7B61FF] flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="font-black text-sm text-[#14152C]">التقويم والجدول الأسبوعي</span>
          </div>
          <button
            onClick={() => onNavigateToTab('sessions')}
            className="text-xs font-bold text-[#7B61FF] hover:text-[#6C5CE7] flex items-center gap-0.5 cursor-pointer"
          >
            <span>كل الحصص</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#FF5E62]" />
          </button>
        </div>

        {/* 7 Days Strip */}
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
            const d = new Date();
            d.setDate(d.getDate() + offset);
            const isToday = offset === 0;
            const dayNum = d.getDate();
            const dayNamesShort = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
            const dayLabel = dayNamesShort[d.getDay()];

            return (
              <div
                key={offset}
                className={`py-2 px-1 rounded-2xl flex flex-col items-center justify-center transition-all ${
                  isToday
                    ? 'bg-gradient-to-b from-[#1E1F3D] to-[#14152C] text-white shadow-lg shadow-[#14152C]/20 ring-2 ring-[#FF5E62]/40 scale-[1.03] relative'
                    : 'bg-[#F4F3FA] text-[#727494] hover:bg-[#ECEAF6]'
                }`}
              >
                {isToday && (
                  <span className="w-2 h-1 rounded-full bg-[#FF5E62] absolute top-1.5" />
                )}
                <span className={`text-xs font-black mt-1 ${isToday ? 'text-white' : 'text-[#14152C]'}`}>
                  {dayNum}
                </span>
                <span className={`text-[9px] font-bold ${isToday ? 'text-[#FF758C]' : 'text-[#727494]'}`}>
                  {dayLabel}
                </span>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => onNavigateToTab('sessions')}
          className="w-full py-2.5 rounded-2xl bg-[#F4F3FA] hover:bg-[#ECEAF6] border border-[#E8E4F5] text-[#7B61FF] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <CalendarCheck2 className="w-4 h-4 text-[#FF5E62]" />
          <span>عرض جدول الحصص بالكامل</span>
        </button>
      </div>

      {/* 7. Today's Classes List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#FFEBEB] text-[#FF5E62] flex items-center justify-center font-bold">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-black text-[#14152C]">
              حصص اليوم ({scheduledToday.length > 0 ? scheduledToday.length : todaySessions.length})
            </h2>
          </div>
          <button
            onClick={onOpenAddSession}
            className="text-xs font-bold text-[#7B61FF] hover:text-[#6C5CE7] flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#FF5E62]" />
            <span>إضافة حصة</span>
          </button>
        </div>

        {scheduledToday.length === 0 && todaySessions.length === 0 ? (
          <div className="classy-card p-6 text-center space-y-3 flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-[#EDE8FF] flex items-center justify-center p-2 shadow-inner">
              <ClassyOwlMascot size="sm" glow={false} pose="smart" />
            </div>
            <div className="space-y-1">
              <p className="font-black text-[#14152C] text-sm">لا توجد حصص مجدولة لليوم</p>
              <p className="text-xs text-[#727494] font-medium">
                استمتع بيومك أو ابدأ بجدولة حصة جديدة لمجموعاتك
              </p>
            </div>
            <button
              onClick={onOpenAddSession}
              className="mt-1 px-4 py-2 rounded-2xl btn-coral text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md shadow-[#FF5E62]/30 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>جدولة حصة جديدة</span>
            </button>
          </div>
        ) : (
          <div className="classy-card divide-y divide-[#E8E4F5] overflow-hidden">
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
                  className="transition-colors hover:bg-[#F4F3FA]/50"
                >
                  {/* Clean List Row */}
                  <div className="p-3.5 flex items-center justify-between gap-3">
                    
                    {/* Time & Class Title */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-center shrink-0 min-w-[54px] bg-[#F4F3FA] border border-[#E8E4F5] rounded-2xl px-2 py-1.5 shadow-2xs">
                        <span className="text-xs font-black text-[#14152C] block leading-tight">{item.time}</span>
                        <span className={`text-[9px] font-extrabold block mt-0.5 px-1.5 py-0.5 rounded-full ${
                          item.isPrivate ? 'bg-[#FFF5E5] text-[#FFAA2C] border border-[#FFE8C2]' : 'bg-[#EDE8FF] text-[#7B61FF]'
                        }`}>
                          {item.isPrivate ? 'خاص' : 'مجموعة'}
                        </span>
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: item.accentColor || '#7B61FF' }}
                          />
                          <h3 className="font-bold text-xs sm:text-sm text-[#14152C] truncate">
                            {item.isPrivate ? (item.studentName ? `خاص — ${item.studentName}` : 'درس خاص') : item.groupName}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-[#727494] flex-wrap font-medium">
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
                        <span className="text-[10px] font-bold bg-[#E0F7EF] text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-xl">
                          حاضر {presentCount}/{groupStudents.length}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkAllPresent(item)}
                          className="min-h-[34px] px-3 py-1 rounded-xl btn-coral text-white font-bold text-xs flex items-center gap-1 shadow-sm shadow-[#FF5E62]/30 transition-all active:scale-95 cursor-pointer"
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
                        className="p-1.5 rounded-xl bg-[#F4F3FA] hover:bg-[#ECEAF6] border border-[#E8E4F5] text-[#14152C] transition-colors cursor-pointer"
                        title="تفاصيل ورصد فردي"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Student List */}
                  {isExpanded && (
                    <div className="p-3 bg-[#F4F3FA]/80 border-t border-[#E8E4F5] space-y-2 animate-in slide-in-from-top-1 duration-150">
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#727494] mb-1">
                        <span>قائمة الطلاب ({groupStudents.length})</span>
                        <span>رصد فردي</span>
                      </div>

                      <div className="space-y-1.5">
                        {groupStudents.map((st) => {
                          const currentRecord = sessionAttendance.find((a) => a.studentId === st.id);
                          const stStatus = currentRecord?.status;

                          return (
                            <div
                              key={st.id}
                              className="p-2.5 bg-white rounded-2xl border border-[#E8E4F5] flex items-center justify-between gap-2 shadow-2xs"
                            >
                              <span className="font-bold text-xs text-[#14152C] truncate min-w-0">
                                {st.name}
                              </span>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'present', true)}
                                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                                    stStatus === 'present'
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'bg-[#F4F3FA] text-[#14152C] hover:bg-emerald-50 hover:text-emerald-700'
                                  }`}
                                >
                                  حاضر
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'absent_charged', true)}
                                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                                    stStatus === 'absent_charged' || (stStatus === 'absent' && currentRecord?.isCharged !== false)
                                      ? 'bg-[#FF5E62] text-white shadow-2xs'
                                      : 'bg-[#F4F3FA] text-[#14152C] hover:bg-rose-50 hover:text-rose-700'
                                  }`}
                                >
                                  غياب محسوب
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'absent_free', false)}
                                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                                    stStatus === 'absent_free' || stStatus === 'excused' || (stStatus === 'absent' && currentRecord?.isCharged === false)
                                      ? 'bg-slate-600 text-white shadow-2xs'
                                      : 'bg-[#F4F3FA] text-[#727494] hover:bg-slate-200'
                                  }`}
                                >
                                  معتذر
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'late', true)}
                                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                                    stStatus === 'late'
                                      ? 'bg-[#FFAA2C] text-white shadow-2xs'
                                      : 'bg-[#F4F3FA] text-[#14152C] hover:bg-amber-50 hover:text-amber-700'
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
                            className="text-[11px] font-bold text-[#7B61FF] hover:text-[#6C5CE7] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>فتح نافذة الحضور الشاملة</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-[#FF5E62]" />
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

      {/* 8. Active Groups */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#FFF5E5] text-[#FFAA2C] flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-black text-[#14152C]">
              المجموعات النشطة ({regularGroups.length})
            </h2>
          </div>
          <button
            onClick={() => onNavigateToTab('groups')}
            className="text-xs font-bold text-[#7B61FF] hover:text-[#6C5CE7] hover:underline cursor-pointer"
          >
            عرض الكل
          </button>
        </div>

        {regularGroups.length === 0 ? (
          <div className="classy-card p-6 text-center space-y-1">
            <p className="font-black text-[#14152C] text-xs">لا توجد مجموعات بعد</p>
            <p className="text-[11px] text-[#727494]">ابدأ بإنشاء مجموعتك الأولى لتنظيم الطلاب وحصصهم</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {regularGroups.slice(0, 4).map((group) => {
              const count = db.getGroupEnrollments(group.id).length;
              return (
                <div
                  key={group.id}
                  onClick={() => onOpenGroupProfile(group)}
                  className="classy-card classy-card-hover p-3.5 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: group.accentColor || '#7B61FF' }}
                    />
                    <div className="min-w-0 space-y-0.5">
                      <h4 className="font-bold text-xs text-[#14152C] truncate">{group.name}</h4>
                      <p className="text-[10px] text-[#727494] truncate font-medium">
                        {group.subject} • {getLocalizedStageName(group.gradeLevel)}
                      </p>
                    </div>
                  </div>

                  <div className="text-left shrink-0 pl-1">
                    <span className="text-xs font-black text-[#7B61FF] bg-[#EDE8FF] px-2.5 py-0.5 rounded-full">
                      {count} طالب
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Quick Action Button (FAB) */}
      <div className="fixed bottom-20 left-6 z-20">
        <button
          onClick={onOpenAddSession}
          className="w-13 h-13 rounded-full btn-coral text-white flex items-center justify-center shadow-xl shadow-[#FF5E62]/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="جدولة حصة سريعة"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

    </div>
  );
};
