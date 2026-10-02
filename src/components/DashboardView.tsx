import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Layers,
  CalendarCheck2,
  DollarSign,
  UserPlus,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Calendar,
  TrendingUp,
  Bell,
  ChevronDown,
  ChevronUp,
  Receipt,
  UserCheck,
  X,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { Student, Group, Session, Payment, TeacherProfile, Attendance, AttendanceStatus, ActiveTab, AutoSyncConfig } from '../types';
import {
  db,
  roundMoney,
  multiplyMoney,
  addMoney,
  getEffectiveSessionPrice,
  getAutoSyncConfig,
  performFullSync,
  subscribeToSyncUpdates,
} from '../utils/storage';
import {
  subscribeToNetworkStatus,
  getCachedNetworkStatus,
  DetailedNetworkStatus,
} from '../utils/network';
import { getScheduledClassesForDate, ScheduledClassItem } from '../utils/schedule';
import { getSmartReminders } from '../utils/reminders';
import { useTranslation } from '../utils/i18n';
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
  onOpenAttendanceModal,
  onOpenNotificationsModal,
  onNavigateToTab,
  onDataChanged,
}) => {
  const { t, language, isRTL } = useTranslation();
  const isEn = language.startsWith('en');

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

  // Network & Sync State
  const [networkStatus, setNetworkStatus] = useState<DetailedNetworkStatus>(() => getCachedNetworkStatus());
  const [syncConfig, setSyncConfig] = useState<AutoSyncConfig>(() => getAutoSyncConfig());
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  useEffect(() => {
    const unsubNet = subscribeToNetworkStatus((status) => {
      setNetworkStatus(status);
    });
    const unsubSync = subscribeToSyncUpdates(() => {
      setSyncConfig(getAutoSyncConfig());
    });
    return () => {
      unsubNet();
      unsubSync();
    };
  }, []);

  const isOffline = !networkStatus.isOnline || !networkStatus.deviceConnected || syncConfig.status === 'offline_deferred';
  const isSyncing = syncConfig.status === 'syncing' || isManualSyncing;

  // Attendance rate calculation
  const overallAttendanceRate = useMemo(() => {
    if (allAttendance.length === 0) return 100;
    const positive = allAttendance.filter((a) => a.status === 'present' || a.status === 'late').length;
    return Math.round((positive / allAttendance.length) * 100);
  }, [allAttendance]);

  const handleTriggerSync = async () => {
    setIsManualSyncing(true);
    try {
      const res = await performFullSync(undefined, true);
      setSyncConfig(getAutoSyncConfig());
      if (res.isOffline) {
        showQuickFeedback(isEn ? 'Data saved safely locally (Device currently offline)' : 'تم حفظ البيانات محلياً بأمان - الجهاز غير متصل بالإنترنت حالياً');
      } else if (res.success) {
        showQuickFeedback(isEn ? 'Cloud sync completed successfully!' : 'تمت المزامنة السحابية بنجاح وتحديث السجلات الدائمة!');
        onDataChanged?.();
      } else {
        showQuickFeedback(res.message || (isEn ? 'Cloud sync incomplete' : 'تعذر استكمال المزامنة السحابية'));
      }
    } catch {
      showQuickFeedback(isEn ? 'Error occurred during sync' : 'حدث خطأ أثناء المزامنة');
    } finally {
      setIsManualSyncing(false);
    }
  };

  // Scheduled classes for today
  const scheduledToday = useMemo(() => {
    return getScheduledClassesForDate(new Date(), groups, enrollments, students);
  }, [groups, enrollments, students]);

  // Count of completed sessions today
  const completedTodaySessionsCount = useMemo(() => {
    return todaySessions.filter((s) => s.status === 'completed').length;
  }, [todaySessions]);

  const totalTodayClassesCount = useMemo(() => {
    return Math.max(scheduledToday.length, todaySessions.length);
  }, [scheduledToday.length, todaySessions.length]);

  const remainingTodaySessionsCount = useMemo(() => {
    return Math.max(0, totalTodayClassesCount - completedTodaySessionsCount);
  }, [totalTodayClassesCount, completedTodaySessionsCount]);

  // Revenue stats
  const { totalMonthRevenue, totalTodayRevenue } = useMemo(() => {
    const finHistory = db.calculateFinancialHistory();
    const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const curMonthRecord = finHistory.months.find((m) => m.monthYear === currentMonthKey);
    const mRev = curMonthRecord ? curMonthRecord.totalCollected : 0;

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

    return { totalMonthRevenue: mRev, totalTodayRevenue: tRev };
  }, [payments, sessions, groups, enrollments, currentMonth, currentYear, todayStr]);

  // Outstanding balances
  const { totalOutstandingDues, overdueStudentsCount } = useMemo(() => {
    const activeStudents = students.filter((s) => s.status !== 'archived');
    let outDues = 0;
    let overdueCount = 0;

    activeStudents.forEach((st) => {
      const fin = db.calculateStudentGrandFinancials(st.id);
      const nonPackageRemaining = fin.enrollmentsSummary
        .filter((e) => e.billingMode !== 'package' && e.billingType !== 'package')
        .reduce((sum, e) => sum + e.remaining, 0);

      if (nonPackageRemaining > 0) {
        outDues += nonPackageRemaining;
        overdueCount++;
      }
    });

    return {
      totalOutstandingDues: outDues,
      overdueStudentsCount: overdueCount,
    };
  }, [students]);

  // Smart Reminders
  const smartReminders = useMemo(() => {
    return getSmartReminders(students, groups, sessions, enrollments, allAttendance);
  }, [students, groups, sessions, enrollments, allAttendance]);

  const findSessionForScheduleItem = (item: ScheduledClassItem) => {
    return sessions.find(
      (s) =>
        s.date === todayStr &&
        s.groupId === item.groupId &&
        (!item.studentId || s.studentId === item.studentId) &&
        s.status !== 'cancelled'
    );
  };

  const getOrCreateSessionForSchedule = (item: ScheduledClassItem): Session => {
    const existing = findSessionForScheduleItem(item);
    if (existing) return existing;

    const group = groups.find((g) => g.id === item.groupId);
    const d = new Date(todayStr);
    const [h, m] = item.time.split(':').map(Number);
    const endH = (h + 1) % 24;
    const endTime = `${String(endH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;

    const newSession: Session = {
      id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      groupId: item.groupId,
      studentId: item.studentId,
      enrollmentId: item.enrollmentId,
      title: item.isPrivate ? `${isEn ? 'Private Lesson' : 'درس خاص'} - ${item.studentName}` : item.groupName,
      date: todayStr,
      startTime: item.time,
      endTime,
      dayName: item.dayName,
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      status: 'scheduled',
      pricePerStudent: group?.defaultPrice || 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
    showQuickFeedback(
      isEn
        ? `Marked all present for ${item.isPrivate ? item.studentName : item.groupName}`
        : `تم رصد حضور جميع طلاب ${item.isPrivate ? item.studentName : item.groupName} بنجاح`
    );
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
    showQuickFeedback(isEn ? 'Attendance status updated' : 'تم تحديث حالة الحضور');
    onDataChanged?.();
  };

  // Greeting dynamic text based on current hour
  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return isEn ? 'Good morning ☀️' : 'صباح الهمة والنشاط ☀️';
    if (hour < 17) return isEn ? 'Good afternoon 🌿' : 'طاب يومك بكل خير 🌿';
    return isEn ? 'Good evening ✨' : 'مساء التميز والإنجاز ✨';
  }, [isEn]);

  const activeStudentsList = useMemo(() => students.filter((s) => s.status !== 'archived'), [students]);

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar p-3.5 sm:p-5 space-y-4 text-[#191A2E] pb-32 bg-[#F5F6FC] relative"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Soft Ambient Light Glow in Background */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#7657F6]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-0 w-80 h-80 bg-[#55C7E8]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-[#FF647C]/6 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* =========================================================================
          1. Profile & Signature Executive Hero Header
          ========================================================================= */}
      <div className="rounded-[26px] bg-gradient-to-r from-[#17163D] via-[#403B9C] to-[#7657F6] p-5 sm:p-6 text-white relative overflow-hidden shadow-xl border border-white/10">
        <div className="absolute -top-16 -right-16 w-60 h-60 bg-[#7657F6]/35 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-60 h-60 bg-[#FF647C]/30 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          {/* Teacher Profile & Greeting */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#FF647C] via-[#7657F6] to-[#55C7E8] p-0.5 shadow-lg shadow-[#7657F6]/40 shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#17163D] flex items-center justify-center text-white font-black text-2xl overflow-hidden">
                {teacherProfile.name ? teacherProfile.name.charAt(0) : 'C'}
              </div>
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#E8E7FF]/90 flex items-center gap-1">
                  {greetingText}
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate">
                {teacherProfile.name ? `${isEn ? 'Teacher ' : 'أ. '}${teacherProfile.name}` : (isEn ? 'Teacher' : 'أستاذنا الفاضل')}
              </h1>
              <p className="text-xs sm:text-sm text-[#E8E7FF]/85 font-medium truncate">
                {teacherProfile.subject || (isEn ? 'Subject' : 'المادة التعليمية')} • {teacherProfile.centerOrSchool || (isEn ? 'Classy Education' : 'منظومة كلاسي الذكية')}
              </p>
            </div>
          </div>

          {/* Action Hub & Mascot */}
          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/15">
            <div className="hidden md:flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-2xl shadow-xs">
              <div className="w-9 h-9 flex items-center justify-center">
                <ClassyOwlMascot size="sm" pose="welcome" glow={false} />
              </div>
              <div className="text-right">
                <span className="text-[10px] font-extrabold text-[#55C7E8] block leading-none">{isEn ? 'Smart Assistant' : 'مساعدك الذكي'}</span>
                <span className="text-xs font-bold text-white block mt-0.5">{isEn ? 'Ready to help' : 'جاهز لخدمتك'}</span>
              </div>
            </div>

            {/* Date Badge */}
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/15 px-3 py-2 rounded-2xl text-xs font-bold text-white shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-[#55C7E8]" />
              <span>
                {new Date().toLocaleDateString(isEn ? 'en-US' : 'ar-EG', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>

            {/* Cloud Sync Status */}
            {isOffline && (
              <button
                onClick={handleTriggerSync}
                disabled={isSyncing}
                className="relative p-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-md"
                title={isEn ? 'Working Offline - Click to sync when online' : 'العمل بدون إنترنت - انقر للمزامنة عند الاتصال'}
              >
                <WifiOff className="w-4.5 h-4.5 text-amber-300" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-[#17163D] animate-ping" />
              </button>
            )}

            <button
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-md"
              title={isEn ? 'Sync Cloud Data' : 'مزامنة البيانات السحابية'}
            >
              <RefreshCw className={`w-4.5 h-4.5 text-[#55C7E8] ${isSyncing ? 'animate-spin' : ''}`} />
            </button>

            {/* Notifications Bell */}
            {onOpenNotificationsModal && (
              <button
                onClick={onOpenNotificationsModal}
                className="relative p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-md"
                title={t('smartNotifications')}
              >
                <Bell className="w-4.5 h-4.5 text-white" />
                {smartReminders.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-[#FF647C] text-white text-[9px] font-black flex items-center justify-center shadow-md ring-2 ring-[#17163D] animate-pulse">
                    {smartReminders.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Success Toast */}
      {quickSuccessMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-between shadow-lg shadow-emerald-600/20 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{quickSuccessMsg}</span>
          </div>
          <button onClick={() => setQuickSuccessMsg(null)}>
            <X className="w-4 h-4 text-white/80 hover:text-white" />
          </button>
        </div>
      )}

      {/* =========================================================================
          2. Executive Summary Bento Grid
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Main Today Activity Hero Card */}
        <div className="lg:col-span-7 rounded-[24px] bg-gradient-to-br from-[#17163D] to-[#403B9C] p-5 text-white flex flex-col justify-between relative overflow-hidden shadow-xl border border-white/10">
          <div className="absolute -top-10 -left-10 w-44 h-44 bg-[#7657F6]/30 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-[#FF647C]/25 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF647C] animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-[#E8E7FF]">
                  {isEn ? "Today's Academic Activity" : 'نشاط اليوم الدراسي'}
                </span>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-white/15 text-white border border-white/20 shadow-xs">
                {totalTodayClassesCount} {isEn ? 'scheduled' : 'حصص مجدولة'}
              </span>
            </div>

            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                {completedTodaySessionsCount === totalTodayClassesCount && totalTodayClassesCount > 0
                  ? (isEn ? "🎉 All today's sessions completed successfully!" : '🎉 اكتملت جميع حصص اليوم بنجاح!')
                  : (isEn ? `${remainingTodaySessionsCount} sessions pending attendance` : `متبقي ${remainingTodaySessionsCount} حصص للرصد والمتابعة`)}
              </h2>
              <div className="flex items-center gap-3 text-xs text-[#E8E7FF]/90 font-medium flex-wrap">
                <span>{isEn ? "Today's Revenue:" : 'تحصيل اليوم:'} <strong className="text-white font-bold">{totalTodayRevenue} {t('currency')}</strong></span>
                <span>•</span>
                <span>{isEn ? 'Recorded ' : 'تم رصد '}<strong className="text-white font-bold">{completedTodaySessionsCount}</strong> {isEn ? 'of ' : 'من '}<strong className="text-white font-bold">{totalTodayClassesCount}</strong></span>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="w-full bg-black/40 h-3 rounded-full overflow-hidden p-0.5 border border-white/15">
                <div
                  className="bg-gradient-to-r from-[#7657F6] via-[#55C7E8] to-[#FF647C] h-full rounded-full transition-all duration-500 shadow-sm"
                  style={{
                    width: `${totalTodayClassesCount > 0 ? (completedTodaySessionsCount / totalTodayClassesCount) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-bold text-[#E8E7FF]/85">
                <span>{isEn ? 'Progress:' : 'نسبة الإنجاز:'} {totalTodayClassesCount > 0 ? Math.round((completedTodaySessionsCount / totalTodayClassesCount) * 100) : 0}%</span>
                <span>{completedTodaySessionsCount}/{totalTodayClassesCount} {isEn ? 'completed' : 'تم رصدها'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-2.5">
          {/* Metric 1: Active Students */}
          <div
            onClick={() => onNavigateToTab('students')}
            className="classy-lavender-card p-3.5 sm:p-4 flex flex-col justify-between cursor-pointer group active:scale-[0.98] transition-all hover:shadow-lg hover:border-[#7657F6]/50"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#7657F6] to-[#403B9C] text-white flex items-center justify-center shadow-md shadow-[#7657F6]/25">
                <Users className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#E8E7FF] text-[#7657F6] border border-[#D8D5FB]">
                {isEn ? 'Active' : 'نشط'}
              </span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-[#17163D] tracking-tight block">
                {activeStudentsList.length}
              </span>
              <span className="text-xs font-bold text-[#74778F] block mt-0.5">
                {t('activeStudents')}
              </span>
            </div>
          </div>

          {/* Metric 2: Attendance Rate */}
          <div
            onClick={() => onNavigateToTab('reports')}
            className="p-3.5 sm:p-4 rounded-[22px] bg-gradient-to-br from-white to-emerald-50/40 border border-emerald-200 flex flex-col justify-between cursor-pointer group active:scale-[0.98] transition-all hover:shadow-lg hover:border-emerald-400"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/25">
                <TrendingUp className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {isEn ? 'Rate' : 'التزام'}
              </span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight block">
                {overallAttendanceRate}%
              </span>
              <span className="text-xs font-bold text-[#74778F] block mt-0.5">
                {t('attendanceRate')}
              </span>
            </div>
          </div>

          {/* Metric 3: Month Revenue */}
          <div
            onClick={() => onNavigateToTab('reports')}
            className="classy-card p-3.5 sm:p-4 flex flex-col justify-between cursor-pointer group active:scale-[0.98] transition-all hover:shadow-lg hover:border-[#403B9C]/40"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#17163D] to-[#403B9C] text-white flex items-center justify-center shadow-md shadow-[#17163D]/25">
                <DollarSign className="w-4.5 h-4.5 text-[#55C7E8]" />
              </div>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#E8E7FF] text-[#403B9C] border border-[#D8D5FB]">
                {isEn ? `Month ${currentMonth}` : `شهر ${currentMonth}`}
              </span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-[#17163D] tracking-tight block truncate">
                {totalMonthRevenue} <span className="text-xs font-bold text-[#74778F]">{t('currency')}</span>
              </span>
              <span className="text-xs font-bold text-[#74778F] block mt-0.5">
                {t('monthlyRevenue')}
              </span>
            </div>
          </div>

          {/* Metric 4: Outstanding Dues */}
          <div
            onClick={() => onNavigateToTab('reports')}
            className="classy-rose-card p-3.5 sm:p-4 flex flex-col justify-between cursor-pointer group active:scale-[0.98] transition-all hover:shadow-lg hover:border-[#FF647C]/50"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#FF647C] to-[#E02E4C] text-white flex items-center justify-center shadow-md shadow-[#FF647C]/25">
                <Receipt className="w-4.5 h-4.5" />
              </div>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                totalOutstandingDues > 0
                  ? 'bg-[#FFF1F3] text-[#FF647C] border-[#FECDD3]'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {totalOutstandingDues > 0 ? (isEn ? `${overdueStudentsCount} dues` : `${overdueStudentsCount} طلاب`) : t('settled')}
              </span>
            </div>
            <div>
              <span className={`text-2xl sm:text-3xl font-black tracking-tight block truncate ${
                totalOutstandingDues > 0 ? 'text-[#FF647C]' : 'text-emerald-700'
              }`}>
                {totalOutstandingDues} <span className="text-xs font-bold text-[#74778F]">{t('currency')}</span>
              </span>
              <span className="text-xs font-bold text-[#74778F] block mt-0.5">
                {t('totalPendingDues')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. Quick Actions Bar
          ========================================================================= */}
      <div className="classy-card p-2 sm:p-3 bg-white">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={onOpenAddStudent}
            className="py-3 px-3.5 rounded-2xl bg-[#F6F7FC] hover:bg-[#E8E7FF] border border-[#E8E7FF] flex items-center justify-center gap-2.5 transition-all cursor-pointer group active:scale-95 shadow-2xs hover:shadow-sm"
          >
            <div className="w-8 h-8 rounded-xl bg-[#E8E7FF] text-[#7657F6] flex items-center justify-center shrink-0 group-hover:bg-[#7657F6] group-hover:text-white transition-colors shadow-2xs">
              <UserPlus className="w-4 h-4" />
            </div>
            <span className="font-black text-xs sm:text-sm text-[#17163D] group-hover:text-[#7657F6] transition-colors truncate">
              {t('addStudent')}
            </span>
          </button>

          <button
            onClick={onOpenAddGroup}
            className="py-3 px-3.5 rounded-2xl bg-[#F6F7FC] hover:bg-[#E8E7FF] border border-[#E8E7FF] flex items-center justify-center gap-2.5 transition-all cursor-pointer group active:scale-95 shadow-2xs hover:shadow-sm"
          >
            <div className="w-8 h-8 rounded-xl bg-[#E8E7FF]/70 text-[#403B9C] flex items-center justify-center shrink-0 group-hover:bg-[#403B9C] group-hover:text-white transition-colors shadow-2xs">
              <Layers className="w-4 h-4" />
            </div>
            <span className="font-black text-xs sm:text-sm text-[#17163D] group-hover:text-[#403B9C] transition-colors truncate">
              {t('createGroupBtn')}
            </span>
          </button>

          <button
            onClick={onOpenAddSession}
            className="py-3 px-3.5 rounded-2xl bg-[#F6F7FC] hover:bg-[#F0FAFD] border border-[#E8E7FF] flex items-center justify-center gap-2.5 transition-all cursor-pointer group active:scale-95 shadow-2xs hover:shadow-sm"
          >
            <div className="w-8 h-8 rounded-xl bg-[#F0FAFD] text-[#55C7E8] border border-[#BAE6FD] flex items-center justify-center shrink-0 group-hover:bg-[#55C7E8] group-hover:text-white transition-colors shadow-2xs">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
            <span className="font-black text-xs sm:text-sm text-[#17163D] group-hover:text-[#0284C7] transition-colors truncate">
              {t('scheduleSessionBtn')}
            </span>
          </button>

          <button
            onClick={onOpenAddPayment}
            className="py-3 px-3.5 rounded-2xl bg-[#F6F7FC] hover:bg-[#FFF1F3] border border-[#E8E7FF] flex items-center justify-center gap-2.5 transition-all cursor-pointer group active:scale-95 shadow-2xs hover:shadow-sm"
          >
            <div className="w-8 h-8 rounded-xl bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3] flex items-center justify-center shrink-0 group-hover:bg-[#FF647C] group-hover:text-white transition-colors shadow-2xs">
              <DollarSign className="w-4 h-4" />
            </div>
            <span className="font-black text-xs sm:text-sm text-[#17163D] group-hover:text-[#FF647C] transition-colors truncate">
              {t('recordPayment')}
            </span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          4. Today's Sessions Timeline & Quick Attendance Section
          ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#E8E7FF] text-[#7657F6] flex items-center justify-center font-bold shadow-2xs">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-[#17163D]">
                {isEn ? `Today's Sessions (${scheduledToday.length})` : `حصص اليوم الدراسي (${scheduledToday.length})`}
              </h2>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('sessions')}
            className="text-xs font-bold text-[#7657F6] hover:text-[#403B9C] flex items-center gap-1 cursor-pointer"
          >
            <span>{t('sessionsTitle')}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#7657F6]" />
          </button>
        </div>

        {scheduledToday.length === 0 ? (
          <div className="classy-card p-6 sm:p-8 flex flex-col items-center text-center space-y-3 relative overflow-hidden bg-white">
            <div className="w-28 h-28 flex items-center justify-center">
              <ClassyOwlMascot size="lg" pose="waving" glow={true} />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="font-black text-[#17163D] text-sm sm:text-base">
                {isEn ? 'No sessions scheduled for today!' : 'لا توجد حصص مجدولة لليوم!'}
              </h3>
              <p className="text-xs text-[#74778F] font-medium leading-relaxed">
                {isEn ? 'Enjoy your calm day or schedule a new teaching session now.' : 'استمتع بيومك الهادئ أو قم بجدولة حصة تدريسية جديدة الآن بضغطة زر.'}
              </p>
            </div>
            <button
              onClick={onOpenAddSession}
              className="mt-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#FF647C] to-[#7657F6] text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isEn ? "Add Today's Session" : 'إضافة حصة اليوم'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {scheduledToday.map((item) => {
              const matchingSession = findSessionForScheduleItem(item);
              const sessionAttendance = matchingSession ? db.getSessionAttendance(matchingSession.id) : [];
              const groupStudents = item.studentId
                ? students.filter((s) => s.id === item.studentId)
                : db.getGroupStudents(item.groupId);

              const presentCount = sessionAttendance.filter(
                (a) => a.status === 'present' || a.status === 'late'
              ).length;
              const isRecorded = sessionAttendance.length > 0;
              const isExpanded = expandedAttendanceCardId === item.id;

              return (
                <div
                  key={item.id}
                  className={`classy-card overflow-hidden transition-all bg-white ${
                    isRecorded ? 'border-emerald-200/80 bg-gradient-to-r from-emerald-50/30 to-white' : 'hover:border-[#7657F6]/40'
                  }`}
                >
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Time slot pill */}
                      <div className="px-3 py-1.5 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF] text-center shrink-0 min-w-[66px]">
                        <span className="text-xs font-black text-[#191A2E] block leading-tight">{item.time}</span>
                        <span className={`text-[9px] font-extrabold block mt-0.5 px-2 py-0.2 rounded-full ${
                          item.isPrivate ? 'bg-[#FFF1F3] text-[#FF647C]' : 'bg-[#E8E7FF] text-[#403B9C]'
                        }`}>
                          {item.isPrivate ? (isEn ? 'Private' : 'خاص') : (isEn ? 'Group' : 'مجموعة')}
                        </span>
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: item.accentColor || '#7657F6' }}
                          />
                          <h3 className="font-black text-xs sm:text-sm text-[#191A2E] truncate">
                            {item.isPrivate ? (item.studentName || (isEn ? 'Private Lesson' : 'درس خاص')) : item.groupName}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-[#74778F] flex-wrap font-medium">
                          <span>{item.isPrivate ? (isEn ? 'Private Lesson' : 'درس خاص') : (item.subject || (isEn ? 'General' : 'عام'))}</span>
                          {!item.isPrivate && (
                            <>
                              <span>•</span>
                              <span>{groupStudents.length} {isEn ? 'students' : 'طلاب'}</span>
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
                        item.isPrivate ? (
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 ${
                            presentCount > 0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]'
                          }`}>
                            {presentCount > 0 ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>{isEn ? 'Attended' : 'حضر'}</span>
                              </>
                            ) : (
                              <span>{isEn ? 'Absent' : 'لم يحضر'}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-xl flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{isEn ? 'Present' : 'حاضر'} {presentCount}/{groupStudents.length}</span>
                          </span>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkAllPresent(item)}
                          className="min-h-[34px] px-3.5 py-1 rounded-xl bg-gradient-to-r from-[#17163D] to-[#403B9C] text-white font-bold text-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs"
                          title={item.isPrivate ? (isEn ? 'Record attendance' : 'تسجيل حضور الطالب') : (isEn ? 'Mark all present' : 'تسجيل حضور جميع الطلاب دفعة واحدة')}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>{item.isPrivate ? (isEn ? 'Attended' : 'حضر') : (isEn ? 'All Present' : 'حضور الكل')}</span>
                        </button>
                      )}

                      {/* Expand for detail individual marking */}
                      <button
                        type="button"
                        onClick={() => setExpandedAttendanceCardId(isExpanded ? null : item.id)}
                        className="p-1.5 rounded-xl bg-[#F6F7FC] hover:bg-[#E8E7FF] border border-[#E8E7FF] text-[#191A2E] transition-colors cursor-pointer"
                        title={isEn ? 'Details & individual marking' : 'تفاصيل ورصد فردي'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Student List */}
                  {isExpanded && (
                    <div className="p-3 bg-[#F6F7FC] border-t border-[#E8E7FF] space-y-2 animate-in slide-in-from-top-1 duration-150">
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#74778F] mb-1">
                        <span>{isEn ? `Students List (${groupStudents.length})` : `قائمة الطلاب (${groupStudents.length})`}</span>
                        <span>{isEn ? 'Direct Individual Marking' : 'رصد فردي مباشر'}</span>
                      </div>

                      <div className="space-y-1.5">
                        {groupStudents.map((st) => {
                          const currentRecord = sessionAttendance.find((a) => a.studentId === st.id);
                          const stStatus = currentRecord?.status;

                          return (
                            <div
                              key={st.id}
                              className="p-2.5 bg-white rounded-2xl border border-[#E8E7FF] flex items-center justify-between gap-2 shadow-2xs"
                            >
                              <span className="font-bold text-xs text-[#191A2E] truncate min-w-0">
                                {st.name}
                              </span>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'present', true)}
                                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                                    stStatus === 'present'
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'bg-[#F6F7FC] text-[#74778F] hover:bg-emerald-50 hover:text-emerald-700'
                                  }`}
                                >
                                  {isEn ? 'Present' : 'حاضر'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'absent_charged', true)}
                                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                                    stStatus === 'absent_charged' || (stStatus === 'absent' && currentRecord?.isCharged !== false)
                                      ? 'bg-[#FF647C] text-white shadow-2xs'
                                      : 'bg-[#F6F7FC] text-[#74778F] hover:bg-[#FFF1F3] hover:text-[#FF647C]'
                                  }`}
                                >
                                  {isEn ? 'Absent (Paid)' : 'غياب محسوب'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'absent_free', false)}
                                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                                    stStatus === 'absent_free' || stStatus === 'excused' || (stStatus === 'absent' && currentRecord?.isCharged === false)
                                      ? 'bg-[#403B9C] text-white shadow-2xs'
                                      : 'bg-[#F6F7FC] text-[#74778F] hover:bg-[#E8E7FF]'
                                  }`}
                                >
                                  {isEn ? 'Excused' : 'معتذر'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'late', true)}
                                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                                    stStatus === 'late'
                                      ? 'bg-amber-600 text-white shadow-2xs'
                                      : 'bg-[#F6F7FC] text-[#74778F] hover:bg-amber-50 hover:text-amber-700'
                                  }`}
                                >
                                  {isEn ? 'Late' : 'متأخر'}
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
                            className="text-[11px] font-bold text-[#7657F6] hover:text-[#403B9C] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>{isEn ? 'Open Full Attendance Modal' : 'فتح نافذة الحضور الشاملة'}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-[#7657F6]" />
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
    </div>
  );
};
