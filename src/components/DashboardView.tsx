import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  WifiOff,
  Wifi,
  RefreshCw,
  CloudOff,
  Cloud,
  Database,
  ShieldCheck,
  HardDrive,
  BrainCircuit,
  Lightbulb,
  Activity,
  ArrowRight,
  PieChart,
} from 'lucide-react';
import { Student, Group, Session, Payment, TeacherProfile, Attendance, AttendanceStatus, Enrollment, ActiveTab, AutoSyncConfig } from '../types';
import {
  db,
  roundMoney,
  multiplyMoney,
  addMoney,
  getEffectiveSessionPrice,
  getAutoSyncConfig,
  performFullSync,
  subscribeToSyncUpdates,
  formatSyncStatusArabic,
} from '../utils/storage';
import {
  subscribeToNetworkStatus,
  getCachedNetworkStatus,
  DetailedNetworkStatus,
} from '../utils/network';
import { getLocalizedStageName } from '../utils/stages';
import { getScheduledClassesForDate, ScheduledClassItem, parseTimeToMinutes } from '../utils/schedule';
import { getSmartReminders, SmartReminderItem } from '../utils/reminders';
import { fetchAttendanceInsights, SmartAttendanceInsightsResult } from '../utils/aiInsights';
import { generateQuickTips, QuickTip } from '../utils/quickTips';
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

  // Smart AI Insights state
  const [insights, setInsights] = useState<SmartAttendanceInsightsResult | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // Selected date for calendar strip
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(todayStr);

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

  // Cached Attendance Summary statistics
  const cachedAttendanceStats = useMemo(() => {
    const totalRecords = allAttendance.length;
    const todayRecords = allAttendance.filter((a) => {
      const sess = sessions.find((s) => s.id === a.sessionId);
      return sess?.date === todayStr;
    });

    const presentCount = allAttendance.filter((a) => a.status === 'present').length;
    const lateCount = allAttendance.filter((a) => a.status === 'late').length;
    const absentChargedCount = allAttendance.filter(
      (a) => a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false)
    ).length;
    const absentFreeCount = allAttendance.filter(
      (a) => a.status === 'absent_free' || a.status === 'excused' || (a.status === 'absent' && a.isCharged === false)
    ).length;

    const recentLogs = allAttendance.slice(-4).reverse().map((att) => {
      const st = students.find((s) => s.id === att.studentId);
      const sess = sessions.find((s) => s.id === att.sessionId);
      const grp = groups.find((g) => g.id === sess?.groupId);
      return {
        id: att.id,
        studentName: st?.name || 'طالب',
        groupName: grp?.name || sess?.title || 'حصة',
        date: sess?.date || todayStr,
        status: att.status,
        isCharged: att.isCharged !== false,
        recordedAt: att.recordedAt,
      };
    });

    return {
      totalRecords,
      todayRecordsCount: todayRecords.length,
      presentCount,
      lateCount,
      absentChargedCount,
      absentFreeCount,
      recentLogs,
    };
  }, [allAttendance, sessions, students, groups, todayStr]);

  // Attendance rate calculation
  const overallAttendanceRate = useMemo(() => {
    if (allAttendance.length === 0) return 100;
    const positive = allAttendance.filter((a) => a.status === 'present' || a.status === 'late').length;
    return Math.round((positive / allAttendance.length) * 100);
  }, [allAttendance]);

  // Cached Payments Summary statistics
  const cachedPaymentStats = useMemo(() => {
    const totalTransactions = payments.length;
    const totalCachedAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const todayPayments = payments.filter((p) => p.date === todayStr);
    const todayCachedAmount = todayPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const cashTotal = payments
      .filter((p) => !p.paymentMethod || p.paymentMethod === 'cash')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const transferTotal = payments
      .filter((p) => p.paymentMethod === 'bank_transfer' || p.paymentMethod === 'vodafone_cash' || p.paymentMethod === 'instapay' || p.paymentMethod === 'card')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const recentLogs = payments.slice(-4).reverse().map((pay) => {
      const st = students.find((s) => s.id === pay.studentId);
      const grp = groups.find((g) => g.id === pay.groupId);
      return {
        id: pay.id,
        studentName: st?.name || 'طالب',
        groupName: grp?.name || 'دفعة',
        amount: Number(pay.amount) || 0,
        date: pay.date,
        method: pay.paymentMethod || 'cash',
        notes: pay.notes,
      };
    });

    return {
      totalTransactions,
      totalCachedAmount,
      todayCachedAmount,
      todayCount: todayPayments.length,
      cashTotal,
      transferTotal,
      recentLogs,
    };
  }, [payments, students, groups, todayStr]);

  const handleTriggerSync = async () => {
    setIsManualSyncing(true);
    try {
      const res = await performFullSync(undefined, true);
      setSyncConfig(getAutoSyncConfig());
      if (res.isOffline) {
        showQuickFeedback('تم حفظ البيانات محلياً بأمان - الجهاز غير متصل بالإنترنت حالياً');
      } else if (res.success) {
        showQuickFeedback('تمت المزامنة السحابية بنجاح وتحديث السجلات الدائمة!');
        onDataChanged?.();
      } else {
        showQuickFeedback(res.message || 'تعذر استكمال المزامنة السحابية');
      }
    } catch {
      showQuickFeedback('حدث خطأ أثناء المزامنة');
    } finally {
      setIsManualSyncing(false);
    }
  };

  // Load Smart Attendance Insights
  const loadInsights = useCallback(async () => {
    if (students.length === 0) return;
    setIsLoadingInsights(true);
    try {
      const result = await fetchAttendanceInsights(
        students,
        groups,
        sessions,
        allAttendance,
        teacherProfile.subject || 'عام',
        teacherProfile.name || 'المعلم'
      );
      setInsights(result);
    } catch {
      // Handled
    } finally {
      setIsLoadingInsights(false);
    }
  }, [students, groups, sessions, allAttendance, teacherProfile.subject, teacherProfile.name]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

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
      const nonPackageRemaining = fin.enrollmentsSummary
        .filter((e) => e.billingMode !== 'package' && e.billingType !== 'package')
        .reduce((sum, e) => sum + e.remaining, 0);

      if (nonPackageRemaining > 0) {
        outDues += nonPackageRemaining;
        overdueCount++;
      }

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

  // Personalized Quick Tips based on data state
  const quickTips = useMemo(() => {
    return generateQuickTips(students, groups, sessions, payments, enrollments, allAttendance);
  }, [students, groups, sessions, payments, enrollments, allAttendance]);

  const [dismissedTipIds, setDismissedTipIds] = useState<string[]>([]);
  const activeQuickTips = useMemo(() => {
    return quickTips.filter((t) => !dismissedTipIds.includes(t.id));
  }, [quickTips, dismissedTipIds]);

  const handleQuickTipAction = (tip: QuickTip) => {
    switch (tip.actionType) {
      case 'open_add_payment':
        onOpenAddPayment();
        break;
      case 'open_add_session':
        onOpenAddSession();
        break;
      case 'open_add_student':
        onOpenAddStudent();
        break;
      case 'navigate_students':
        onNavigateToTab('students');
        break;
      case 'navigate_groups':
        onNavigateToTab('groups');
        break;
      case 'navigate_reports':
        onNavigateToTab('reports');
        break;
      case 'open_student':
        if (tip.targetStudentId) {
          const st = students.find((s) => s.id === tip.targetStudentId);
          if (st) onOpenStudentProfile(st);
        } else {
          onNavigateToTab('students');
        }
        break;
      case 'open_group':
        if (tip.targetGroupId) {
          const grp = groups.find((g) => g.id === tip.targetGroupId);
          if (grp) onOpenGroupProfile(grp);
        } else {
          onNavigateToTab('groups');
        }
        break;
      default:
        break;
    }
  };

  // Helper to find existing session for this scheduled occurrence
  const findSessionForScheduleItem = (item: ScheduledClassItem): Session | undefined => {
    const itemMins = parseTimeToMinutes(item.rawTime || item.time);

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

    const groupSessionsToday = todaySessions.filter(
      (s) => s.groupId === item.groupId || (item.enrollmentId && s.enrollmentId === item.enrollmentId)
    );
    if (groupSessionsToday.length === 1 && !item.rawTime && !groupSessionsToday[0].startTime) {
      return groupSessionsToday[0];
    }

    return undefined;
  };

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

  // Greeting dynamic text based on current hour
  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'صباح الهمة والنشاط ☀️';
    if (hour < 17) return 'طاب يومك بكل خير 🌿';
    return 'مساء التميز والإنجاز ✨';
  }, []);

  // 7-day calendar strip days
  const calendarDays = useMemo(() => {
    const days = [];
    const arabicDayNames = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
    for (let i = -2; i <= 4; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dStr = d.toISOString().split('T')[0];
      const daySessionsCount = sessions.filter((s) => s.date === dStr && s.status !== 'cancelled').length;
      days.push({
        dateStr: dStr,
        dayNum: d.getDate(),
        dayName: arabicDayNames[d.getDay()],
        isToday: dStr === todayStr,
        sessionCount: daySessionsCount,
      });
    }
    return days;
  }, [sessions, todayStr]);

  const activeStudentsList = useMemo(() => students.filter((s) => s.status !== 'archived'), [students]);

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar p-3.5 sm:p-5 space-y-4 text-[#191A2E] pb-32 bg-[#F5F6FC] relative" dir="rtl">
      
      {/* Soft Ambient Light Glow in Background */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#7657F6]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-0 w-80 h-80 bg-[#55C7E8]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-[#FF647C]/6 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* =========================================================================
          1. Profile & Signature Executive Hero Header (Midnight -> Royal -> Violet)
          ========================================================================= */}
      <div className="rounded-[26px] bg-gradient-to-r from-[#17163D] via-[#403B9C] to-[#7657F6] p-5 sm:p-6 text-white relative overflow-hidden shadow-xl border border-white/10">
        {/* Soft internal gradient orbs */}
        <div className="absolute -top-16 -right-16 w-60 h-60 bg-[#7657F6]/35 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-60 h-60 bg-[#FF647C]/30 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          
          {/* Teacher Profile & Greeting */}
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Avatar with glowing ring */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#FF647C] via-[#7657F6] to-[#55C7E8] p-0.5 shadow-lg shadow-[#7657F6]/40 shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#17163D] flex items-center justify-center text-white font-black text-2xl overflow-hidden">
                {teacherProfile.name ? teacherProfile.name.charAt(0) : 'ك'}
              </div>
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#E8E7FF]/90 flex items-center gap-1">
                  {greetingText}
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate">
                {teacherProfile.name ? `أ. ${teacherProfile.name}` : 'أستاذنا الفاضل'}
              </h1>
              <p className="text-xs sm:text-sm text-[#E8E7FF]/85 font-medium truncate">
                {teacherProfile.subject || 'المادة التعليمية'} • {teacherProfile.centerOrSchool || 'منظومة كلاسي الذكية'}
              </p>
            </div>
          </div>

          {/* Action Hub & Owl Mascot Integration */}
          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/15">
            
            {/* Classy Owl Mascot in Hero */}
            <div className="hidden md:flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-2xl shadow-xs">
              <div className="w-9 h-9 flex items-center justify-center">
                <ClassyOwlMascot size="sm" pose="welcome" glow={false} />
              </div>
              <div className="text-right">
                <span className="text-[10px] font-extrabold text-[#55C7E8] block leading-none">مساعدك الذكي</span>
                <span className="text-xs font-bold text-white block mt-0.5">جاهز لخدمتك</span>
              </div>
            </div>

            {/* Date Badge */}
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/15 px-3 py-2 rounded-2xl text-xs font-bold text-white shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-[#55C7E8]" />
              <span>
                {new Date().toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>

            {/* Cloud Sync & Offline Status */}
            {isOffline && (
              <button
                onClick={handleTriggerSync}
                disabled={isSyncing}
                className="relative p-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-md"
                title="العمل بدون إنترنت - انقر للمزامنة عند الاتصال"
              >
                <WifiOff className="w-4.5 h-4.5 text-amber-300" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-[#17163D] animate-ping" />
              </button>
            )}

            <button
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-md"
              title="مزامنة البيانات السحابية"
            >
              <RefreshCw className={`w-4.5 h-4.5 text-[#55C7E8] ${isSyncing ? 'animate-spin' : ''}`} />
            </button>

            {/* Notifications Bell */}
            {onOpenNotificationsModal && (
              <button
                onClick={onOpenNotificationsModal}
                className="relative p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-md"
                title="مركز التنبيهات والإشعارات"
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
        
        {/* Main Today's Activity & Progress Hero Card (lg:col-span-7) */}
        <div className="lg:col-span-7 rounded-[24px] bg-gradient-to-br from-[#17163D] to-[#403B9C] p-5 text-white flex flex-col justify-between relative overflow-hidden shadow-xl border border-white/10">
          <div className="absolute -top-10 -left-10 w-44 h-44 bg-[#7657F6]/30 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-[#FF647C]/25 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF647C] animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-[#E8E7FF]">نشاط اليوم الدراسي</span>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-white/15 text-white border border-white/20 shadow-xs">
                {totalTodayClassesCount} حصص مجدولة
              </span>
            </div>

            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                {completedTodaySessionsCount === totalTodayClassesCount && totalTodayClassesCount > 0
                  ? '🎉 اكتملت جميع حصص اليوم بنجاح!'
                  : `متبقي ${remainingTodaySessionsCount} حصص للرصد والمتابعة`}
              </h2>
              <div className="flex items-center gap-3 text-xs text-[#E8E7FF]/90 font-medium flex-wrap">
                <span>تحصيل اليوم: <strong className="text-white font-bold">{totalTodayRevenue} ج.م</strong></span>
                <span>•</span>
                <span>تم رصد <strong className="text-white font-bold">{completedTodaySessionsCount}</strong> من <strong className="text-white font-bold">{totalTodayClassesCount}</strong></span>
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
                <span>نسبة الإنجاز: {totalTodayClassesCount > 0 ? Math.round((completedTodaySessionsCount / totalTodayClassesCount) * 100) : 0}%</span>
                <span>{completedTodaySessionsCount}/{totalTodayClassesCount} تم رصدها</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 High-Value Key Metric Cards (lg:col-span-5, 2x2 grid) */}
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
                نشط
              </span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-[#17163D] tracking-tight block">
                {activeStudentsList.length}
              </span>
              <span className="text-xs font-bold text-[#74778F] block mt-0.5">
                إجمالي الطلاب النشطين
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
                التزام
              </span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight block">
                {overallAttendanceRate}%
              </span>
              <span className="text-xs font-bold text-[#74778F] block mt-0.5">
                معدل الحضور العام
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
                شهر {currentMonth}
              </span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-[#17163D] tracking-tight block truncate">
                {totalMonthRevenue} <span className="text-xs font-bold text-[#74778F]">ج.م</span>
              </span>
              <span className="text-xs font-bold text-[#74778F] block mt-0.5">
                تحصيل الشهر
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
                {totalOutstandingDues > 0 ? `${overdueStudentsCount} طلاب` : 'خالص'}
              </span>
            </div>
            <div>
              <span className={`text-2xl sm:text-3xl font-black tracking-tight block truncate ${
                totalOutstandingDues > 0 ? 'text-[#FF647C]' : 'text-emerald-700'
              }`}>
                {totalOutstandingDues} <span className="text-xs font-bold text-[#74778F]">ج.م</span>
              </span>
              <span className="text-xs font-bold text-[#74778F] block mt-0.5">
                مستحقات معلقة
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* =========================================================================
          3. Compact Unified Quick Actions Bar
          ========================================================================= */}
      <div className="classy-card p-2 sm:p-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={onOpenAddStudent}
            className="py-3 px-3.5 rounded-2xl bg-[#F6F7FC] hover:bg-[#E8E7FF] border border-[#E8E7FF] flex items-center justify-center gap-2.5 transition-all cursor-pointer group active:scale-95 shadow-2xs hover:shadow-sm"
          >
            <div className="w-8 h-8 rounded-xl bg-[#E8E7FF] text-[#7657F6] flex items-center justify-center shrink-0 group-hover:bg-[#7657F6] group-hover:text-white transition-colors shadow-2xs">
              <UserPlus className="w-4 h-4" />
            </div>
            <span className="font-black text-xs sm:text-sm text-[#17163D] group-hover:text-[#7657F6] transition-colors truncate">
              إضافة طالب
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
              إضافة مجموعة
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
              جدولة حصة
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
              تسجيل دفعة
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
                حصص اليوم الدراسي ({scheduledToday.length})
              </h2>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('sessions')}
            className="text-xs font-bold text-[#7657F6] hover:text-[#403B9C] flex items-center gap-1 cursor-pointer"
          >
            <span>جدول الحصص</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#7657F6]" />
          </button>
        </div>

        {scheduledToday.length === 0 ? (
          /* High-Fidelity Empty State with Official Classy Owl Mascot */
          <div className="classy-card p-6 sm:p-8 flex flex-col items-center text-center space-y-3 relative overflow-hidden">
            <div className="w-28 h-28 flex items-center justify-center">
              <ClassyOwlMascot size="lg" pose="waving" glow={true} />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="font-black text-[#17163D] text-sm sm:text-base">
                لا توجد حصص مجدولة لليوم!
              </h3>
              <p className="text-xs text-[#74778F] font-medium leading-relaxed">
                استمتع بيومك الهادئ أو قم بجدولة حصة تدريسية جديدة الآن بضغطة زر.
              </p>
            </div>
            <button
              onClick={onOpenAddSession}
              className="mt-2 px-5 py-2.5 rounded-2xl btn-violet text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة حصة اليوم</span>
            </button>
          </div>
        ) : (
          /* Timeline Session Cards */
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
                  className={`classy-card overflow-hidden transition-all ${
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
                          {item.isPrivate ? 'خاص' : 'مجموعة'}
                        </span>
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: item.accentColor || '#7657F6' }}
                          />
                          <h3 className="font-black text-xs sm:text-sm text-[#191A2E] truncate">
                            {item.isPrivate ? (item.studentName || 'درس خاص') : item.groupName}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-[#74778F] flex-wrap font-medium">
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
                        item.isPrivate ? (
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 ${
                            presentCount > 0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]'
                          }`}>
                            {presentCount > 0 ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>حضر</span>
                              </>
                            ) : (
                              <span>لم يحضر</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-xl flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>حاضر {presentCount}/{groupStudents.length}</span>
                          </span>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkAllPresent(item)}
                          className="min-h-[34px] px-3.5 py-1 rounded-xl btn-primary text-white font-bold text-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs"
                          title={item.isPrivate ? "تسجيل حضور الطالب" : "تسجيل حضور جميع الطلاب دفعة واحدة"}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>{item.isPrivate ? 'حضر' : 'حضور الكل'}</span>
                        </button>
                      )}

                      {/* Expand for detail individual marking */}
                      <button
                        type="button"
                        onClick={() => setExpandedAttendanceCardId(isExpanded ? null : item.id)}
                        className="p-1.5 rounded-xl bg-[#F6F7FC] hover:bg-[#E8E7FF] border border-[#E8E7FF] text-[#191A2E] transition-colors cursor-pointer"
                        title="تفاصيل ورصد فردي"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Student List */}
                  {isExpanded && (
                    <div className="p-3 bg-[#F6F7FC] border-t border-[#E8E7FF] space-y-2 animate-in slide-in-from-top-1 duration-150">
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#74778F] mb-1">
                        <span>قائمة الطلاب ({groupStudents.length})</span>
                        <span>رصد فردي مباشر</span>
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
                                  حاضر
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
                                  غياب محسوب
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
                                  معتذر
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
                            className="text-[11px] font-bold text-[#7657F6] hover:text-[#403B9C] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>فتح نافذة الحضور الشاملة</span>
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

      {/* =========================================================================
          5. Bento Grid: Financial Summary & Weekly Calendar Strip
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        
        {/* Financial Summary & Monthly Overview Card */}
        <div className="classy-card p-4 sm:p-5 space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E8E7FF]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#17163D] to-[#403B9C] text-white flex items-center justify-center shadow-md">
                  <DollarSign className="w-4 h-4 text-[#55C7E8]" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-[#17163D]">
                    الملخص المالي (شهر {currentMonth})
                  </h3>
                  <p className="text-[10px] text-[#74778F] font-medium">
                    متابعة الإيرادات والمستحقات المتبقية
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigateToTab('reports')}
                className="text-xs font-bold text-[#7657F6] hover:text-[#403B9C] flex items-center gap-0.5 cursor-pointer"
              >
                <span>التقرير المالي</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#7657F6]" />
              </button>
            </div>

            {/* 3 Metric Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF]">
                <span className="text-sm sm:text-base font-black text-emerald-700 block tracking-tight truncate">
                  {totalMonthRevenue} <span className="text-[10px] text-[#74778F]">ج.م</span>
                </span>
                <span className="text-[10px] font-bold text-[#74778F] mt-0.5 block truncate">
                  محصل الشهر
                </span>
              </div>

              <div className="p-2.5 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF]">
                <span className="text-sm sm:text-base font-black text-[#17163D] block tracking-tight truncate">
                  {totalTodayRevenue} <span className="text-[10px] text-[#74778F]">ج.م</span>
                </span>
                <span className="text-[10px] font-bold text-[#74778F] mt-0.5 block truncate">
                  تحصيل اليوم
                </span>
              </div>

              <div className="p-2.5 rounded-2xl bg-[#FFF1F3] border border-[#FECDD3]">
                <span className="text-sm sm:text-base font-black text-[#FF647C] block tracking-tight truncate">
                  {totalOutstandingDues} <span className="text-[10px] text-[#FF647C]/80">ج.م</span>
                </span>
                <span className="text-[10px] font-bold text-[#FF647C] mt-0.5 block truncate">
                  مستحقات
                </span>
              </div>
            </div>
          </div>

          {/* Financial Collection Meter */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-[11px] font-bold text-[#74778F]">
              <span>نسبة التحصيل التقديرية</span>
              <span>
                {totalMonthRevenue + totalOutstandingDues > 0
                  ? `${Math.round((totalMonthRevenue / (totalMonthRevenue + totalOutstandingDues)) * 100)}%`
                  : '100%'}
              </span>
            </div>
            <div className="w-full bg-[#E8E7FF] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#7657F6] to-emerald-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${
                    totalMonthRevenue + totalOutstandingDues > 0
                      ? Math.min(100, (totalMonthRevenue / (totalMonthRevenue + totalOutstandingDues)) * 100)
                      : 100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Weekly Calendar Strip Widget */}
        <div className="classy-card p-4 sm:p-5 space-y-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#E8E7FF]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#E8E7FF] text-[#7657F6] flex items-center justify-center font-bold shadow-2xs">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-[#17163D]">
                  الجدول الأسبوعي السريع
                </h3>
                <p className="text-[10px] text-[#74778F] font-medium">
                  استعراض الحصص الموزعة على مدار الأسبوع
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateToTab('sessions')}
              className="text-xs font-bold text-[#7657F6] hover:text-[#403B9C] flex items-center gap-1 cursor-pointer"
            >
              <span>كل الحصص</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {calendarDays.map((day) => {
              const isSelected = selectedCalendarDate === day.dateStr;
              return (
                <button
                  key={day.dateStr}
                  onClick={() => setSelectedCalendarDate(day.dateStr)}
                  className={`py-2.5 px-0.5 sm:px-1 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                    day.isToday
                      ? 'bg-gradient-to-b from-[#17163D] to-[#403B9C] text-white shadow-md shadow-[#17163D]/20 ring-2 ring-[#7657F6]/40'
                      : isSelected
                      ? 'bg-[#E8E7FF] text-[#7657F6] border border-[#D8D5FB]'
                      : 'bg-[#F6F7FC] text-[#74778F] hover:bg-[#E8E7FF]/50'
                  }`}
                >
                  <span className="text-[9px] sm:text-[10px] font-bold block">{day.dayName}</span>
                  <span className="text-xs sm:text-sm font-black block mt-0.5">{day.dayNum}</span>
                  {day.sessionCount > 0 && (
                    <span className={`w-1.5 h-1.5 rounded-full mt-1 ${day.isToday ? 'bg-[#FF647C]' : 'bg-[#7657F6]'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* =========================================================================
          6. Bento Grid: Smart AI Attendance Insights & Personalized Quick Tips
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        
        {/* Smart AI Attendance Insights Card */}
        {insights && (
          <div className="classy-card p-4 sm:p-5 space-y-3 border-[#7657F6]/30 bg-gradient-to-br from-white to-[#E8E7FF]/25 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#E8E7FF]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7657F6] to-[#403B9C] text-white flex items-center justify-center shadow-md shadow-[#7657F6]/20">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-black text-[#17163D]">تحليلات الحضور الذكية</h3>
                      <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-[#E8E7FF] text-[#7657F6]">AI</span>
                    </div>
                    <p className="text-[10px] text-[#74778F] font-medium">مؤشر التزام الحضور: {insights.overallHealthScore}%</p>
                  </div>
                </div>

                <button
                  onClick={loadInsights}
                  disabled={isLoadingInsights}
                  className="p-1.5 rounded-xl bg-[#F6F7FC] hover:bg-[#E8E7FF] text-[#74778F] border border-[#E8E7FF] transition-colors cursor-pointer"
                  title="تحديث التحليل الذكي"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingInsights ? 'animate-spin text-[#7657F6]' : ''}`} />
                </button>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-[#E8E7FF] space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs font-black text-[#17163D]">
                  <BrainCircuit className="w-4 h-4 text-[#7657F6] shrink-0" />
                  <span>{insights.headline}</span>
                </div>
                <p className="text-[11px] text-[#74778F] font-medium leading-relaxed">{insights.summary}</p>
              </div>

              {insights.attentionNeededStudents && insights.attentionNeededStudents.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-[#191A2E] block">طلاب بحاجة لاهتمام وتواصل:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {insights.attentionNeededStudents.map((st) => {
                      const studentObj = students.find((s) => s.id === st.studentId);
                      const isHigh = st.riskLevel === 'high';
                      return (
                        <div
                          key={st.studentId}
                          className={`p-2.5 rounded-2xl bg-white border flex items-center justify-between gap-2 shadow-2xs ${
                            isHigh ? 'border-[#FECDD3]' : 'border-amber-200'
                          }`}
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${isHigh ? 'bg-[#FF647C]' : 'bg-amber-500'}`} />
                              <h4 className="font-bold text-xs text-[#191A2E] truncate">{st.studentName}</h4>
                            </div>
                            <p className="text-[10px] text-[#74778F] truncate">{st.reason}</p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {st.parentPhone && (
                              <a
                                href={`https://wa.me/${st.parentPhone.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                title="واتساب"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {studentObj && (
                              <button
                                onClick={() => onOpenStudentProfile(studentObj)}
                                className="px-2 py-1 rounded-xl bg-[#F6F7FC] hover:bg-[#E8E7FF] text-[#17163D] text-[10px] font-bold cursor-pointer"
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
            </div>
          </div>
        )}

        {/* Personalized Quick Tips Bento Slot */}
        {activeQuickTips.length > 0 && (
          <div className="classy-card p-4 sm:p-5 space-y-3 bg-gradient-to-br from-white via-amber-50/20 to-white border-amber-200/60 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#E8E7FF]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center shadow-2xs">
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-black text-[#17163D]">
                        نصائح ومقترحات المتابعة
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800">
                        {activeQuickTips.length} مقترحات
                      </span>
                    </div>
                    <p className="text-[10px] text-[#74778F] font-medium">
                      إرشادات إدارية وتربوية مبنية على حالة البيانات
                    </p>
                  </div>
                </div>

                {dismissedTipIds.length > 0 && (
                  <button
                    onClick={() => setDismissedTipIds([])}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
                  >
                    استعادة
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {activeQuickTips.slice(0, 3).map((tip) => {
                  const isHigh = tip.priority === 'high';
                  const isAchievement = tip.category === 'achievement';

                  return (
                    <div
                      key={tip.id}
                      className={`p-3 rounded-2xl bg-white border flex flex-col justify-between gap-2 transition-all shadow-2xs ${
                        isHigh
                          ? 'border-amber-200 hover:border-amber-300'
                          : isAchievement
                          ? 'border-[#7657F6]/30 hover:border-[#7657F6]'
                          : 'border-[#E8E7FF] hover:border-[#7657F6]/40'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                                isHigh
                                  ? 'bg-amber-100 text-amber-800'
                                  : isAchievement
                                  ? 'bg-[#E8E7FF] text-[#7657F6]'
                                  : 'bg-[#F6F7FC] text-[#74778F]'
                              }`}
                            >
                              {tip.badge}
                            </span>
                            <h4 className="font-bold text-xs text-[#191A2E] truncate">{tip.title}</h4>
                          </div>

                          <button
                            onClick={() => setDismissedTipIds((prev) => [...prev, tip.id])}
                            className="text-[#74778F] hover:text-[#191A2E] p-0.5 rounded-md cursor-pointer transition-colors"
                            title="إخفاء هذه النصيحة"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <p className="text-[11px] text-[#74778F] leading-relaxed font-medium">
                          {tip.description}
                        </p>
                      </div>

                      {tip.actionLabel && (
                        <div className="pt-1.5 border-t border-[#E8E7FF] flex items-center justify-end">
                          <button
                            onClick={() => handleQuickTipAction(tip)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1 cursor-pointer shadow-2xs ${
                              isHigh
                                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                : 'btn-violet text-white'
                            }`}
                          >
                            <span>{tip.actionLabel}</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* =========================================================================
          7. Recent Activity Stream Timeline
          ========================================================================= */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#E8E7FF] text-[#7657F6] flex items-center justify-center font-bold">
              <Activity className="w-4 h-4" />
            </div>
            <h2 className="text-xs sm:text-sm font-black text-[#17163D]">
              سجل النشاطات الأخيرة
            </h2>
          </div>
          <button
            onClick={() => onNavigateToTab('reports')}
            className="text-xs font-bold text-[#7657F6] hover:text-[#403B9C] flex items-center gap-0.5 cursor-pointer"
          >
            <span>كل السجلات</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#7657F6]" />
          </button>
        </div>

        <div className="classy-card p-3.5 sm:p-4 space-y-2.5">
          {cachedPaymentStats.recentLogs.length === 0 && cachedAttendanceStats.recentLogs.length === 0 ? (
            <div className="text-center py-4 space-y-1">
              <p className="text-xs font-bold text-[#17163D]">لا توجد نشاطات مسجلة بعد</p>
              <p className="text-[11px] text-[#74778F]">ستظهر هنا تلقائياً سجلات الحضور والمدفوعات فور تسجيلها</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Payment logs */}
              {cachedPaymentStats.recentLogs.slice(0, 2).map((p) => (
                <div
                  key={`pay_${p.id}`}
                  className="p-2.5 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-[#191A2E] truncate">
                        تحصيل دفعة من {p.studentName}
                      </h4>
                      <p className="text-[10px] text-[#74778F] font-medium">
                        {p.groupName} • {p.date}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-emerald-700 shrink-0">
                    +{p.amount} ج.م
                  </span>
                </div>
              ))}

              {/* Attendance logs */}
              {cachedAttendanceStats.recentLogs.slice(0, 2).map((a) => (
                <div
                  key={`att_${a.id}`}
                  className="p-2.5 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#E8E7FF] text-[#7657F6] flex items-center justify-center shrink-0">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-[#191A2E] truncate">
                        تسجيل حضور {a.studentName}
                      </h4>
                      <p className="text-[10px] text-[#74778F] font-medium">
                        {a.groupName} • {a.date}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                    {a.status === 'present' ? 'حاضر' : a.status === 'late' ? 'متأخر' : 'غياب'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          8. Active Groups Bento Grid Section
          ========================================================================= */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#E8E7FF] text-[#7657F6] flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-xs sm:text-sm font-black text-[#17163D]">
              المجموعات النشطة ({regularGroups.length})
            </h2>
          </div>
          <button
            onClick={() => onNavigateToTab('groups')}
            className="text-xs font-bold text-[#7657F6] hover:text-[#403B9C] flex items-center gap-0.5 cursor-pointer"
          >
            <span>عرض الكل</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {regularGroups.length === 0 ? (
          <div className="classy-card p-6 text-center space-y-1">
            <p className="font-black text-[#17163D] text-xs">لا توجد مجموعات بعد</p>
            <p className="text-[11px] text-[#74778F]">ابدأ بإنشاء مجموعتك الأولى لتنظيم الطلاب وحصصهم</p>
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
                      className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: group.accentColor || '#7657F6' }}
                    />
                    <div className="min-w-0 space-y-0.5">
                      <h4 className="font-bold text-xs text-[#191A2E] truncate">{group.name}</h4>
                      <p className="text-[10px] text-[#74778F] truncate font-medium">
                        {group.subject} • {getLocalizedStageName(group.gradeLevel)}
                      </p>
                    </div>
                  </div>

                  <div className="text-left shrink-0 pl-1">
                    <span className="text-xs font-black text-[#7657F6] bg-[#E8E7FF] px-2.5 py-0.5 rounded-full border border-[#D8D5FB]">
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
      <div className="fixed bottom-22 left-6 z-20">
        <button
          onClick={onOpenAddSession}
          className="w-13 h-13 rounded-full btn-coral text-white flex items-center justify-center shadow-xl shadow-[#FF647C]/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="جدولة حصة سريعة"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

    </div>
  );
};
