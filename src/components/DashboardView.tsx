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
  Sparkles,
  Edit3,
} from 'lucide-react';
import { Student, Group, Session, Payment, TeacherProfile, Attendance, AttendanceStatus, ActiveTab, AutoSyncConfig } from '../types';
import {
  db,
  roundMoney,
  multiplyMoney,
  addMoney,
  formatSessionQuantityDisplay,
  getEffectiveSessionPrice,
  getAutoSyncConfig,
  performFullSync,
  subscribeToSyncUpdates,
  calculateWorkloadSummary,
  getSessionLessonQuantity,
} from '../utils/storage';
import {
  subscribeToNetworkStatus,
  getCachedNetworkStatus,
  DetailedNetworkStatus,
} from '../utils/network';
import {
  getScheduledClassesForDate,
  ScheduledClassItem,
  formatTimeDisplay,
  getLocalizedWeekdayName,
  parseTimeToMinutes,
} from '../utils/schedule';
import { useCurrentLocalDate } from '../utils/useCurrentLocalDate';
import { parseLocalTimeToStandard } from '../utils/localDate';
import { getSmartReminders } from '../utils/reminders';
import { useTranslation } from '../utils/i18n';
import { ClassyOwlMascot } from './ClassyOwlMascot';
import { PrivateClassIntakeModal, PrivateClassIntakeResult } from './PrivateClassIntakeModal';

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

  const { todayStr, canonicalWeekday, parts } = useCurrentLocalDate();
  const todayArabicDay = useMemo(() => getLocalizedWeekdayName(canonicalWeekday, isRTL), [canonicalWeekday, isRTL]);
  const currentMonth = parts.month;
  const currentYear = parts.year;

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

  const todayWorkload = useMemo(() => {
    return calculateWorkloadSummary(todaySessions, allAttendance, isRTL);
  }, [todaySessions, allAttendance, isRTL]);

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
    return sessions.find((s) => {
      if (s.date !== todayStr) return false;
      if (s.status === 'cancelled') return false;
      if (s.groupId !== item.groupId) return false;
      if (item.studentId && s.studentId && s.studentId !== item.studentId) return false;

      // Match exact start time (parsed to minutes) to strictly isolate multiple sessions on same day
      const sMins = parseLocalTimeToStandard(s.startTime).sortMinutes;
      const itemMins = item.sortMinutes || parseLocalTimeToStandard(item.rawTime).sortMinutes;
      if (sMins !== itemMins) return false;
      return true;
    });
  };

  const getOrCreateSessionForSchedule = (item: ScheduledClassItem): Session => {
    const existing = findSessionForScheduleItem(item);
    if (existing) return existing;

    const group = groups.find((g) => g.id === item.groupId);
    const timeInfo = parseLocalTimeToStandard(item.rawTime);
    const rawStartTime = timeInfo.normalizedTime;
    const [h, m] = rawStartTime.split(':').map(Number);
    const endH = !isNaN(h) ? (h + 1) % 24 : 17;
    const endTime = `${String(endH).padStart(2, '0')}:${String(!isNaN(m) ? m : 0).padStart(2, '0')}`;

    const newSession: Session = {
      id: `sess_${todayStr}_${item.groupId}_${item.studentId || 'grp'}_${timeInfo.sortMinutes}_${Math.random().toString(36).substr(2, 5)}`,
      groupId: item.groupId,
      studentId: item.studentId,
      enrollmentId: item.enrollmentId,
      title: item.isPrivate ? `${isEn ? 'Private Lesson' : 'درس خاص'} - ${item.studentName}` : item.groupName,
      date: todayStr,
      startTime: rawStartTime,
      endTime,
      dayName: item.dayName,
      month: parts.month,
      year: parts.year,
      status: 'scheduled',
      pricePerStudent: group?.defaultPrice || 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.saveSession(newSession);
    return newSession;
  };

  const [privateIntakeTarget, setPrivateIntakeTarget] = useState<{
    item: ScheduledClassItem;
    studentId: string;
  } | null>(null);

  const handleMarkAllPresent = (item: ScheduledClassItem) => {
    // If it is a private lesson, open PrivateClassIntakeModal to ask the teacher what the intake was
    if (item.isPrivate || item.studentId) {
      const studentId = item.studentId || (students.find((s) => s.name === item.studentName)?.id || '');
      setPrivateIntakeTarget({ item, studentId });
      return;
    }

    // Standard Group Logic (100% untouched)
    const session = getOrCreateSessionForSchedule(item);
    const groupStudents = db.getGroupStudents(item.groupId);

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
    if (session.status !== 'completed' && session.status !== 'cancelled') {
      db.saveSession({ ...session, status: 'completed' });
    }
    showQuickFeedback(
      isEn
        ? `Marked all present for ${item.groupName}`
        : `تم رصد حضور جميع طلاب ${item.groupName} بنجاح`
    );
    onDataChanged?.();
  };

  const handleQuickStudentAttendance = (
    item: ScheduledClassItem,
    studentId: string,
    status: AttendanceStatus,
    isCharged: boolean = true
  ) => {
    // If it is a private lesson and marked present, ask for intake
    if ((item.isPrivate || item.studentId) && status === 'present') {
      setPrivateIntakeTarget({ item, studentId });
      return;
    }

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
    if (session.status !== 'completed' && session.status !== 'cancelled') {
      db.saveSession({ ...session, status: 'completed' });
    }
    showQuickFeedback(isEn ? 'Attendance status updated' : 'تم تحديث حالة الحضور');
    onDataChanged?.();
  };

  const handleConfirmPrivateIntake = (result: PrivateClassIntakeResult) => {
    if (!privateIntakeTarget) return;
    const { item, studentId } = privateIntakeTarget;
    const session = getOrCreateSessionForSchedule(item);
    const enr = enrollments.find(
      (e) => e.studentId === studentId && (e.groupId === item.groupId || e.id === item.enrollmentId)
    );

    const isHourly =
      item.group?.billingMode === 'hourly' ||
      item.group?.billingType === 'hourly' ||
      enr?.billingMode === 'hourly' ||
      enr?.billingType === 'hourly';

    const record: Attendance = {
      id: `att_${session.id}_${studentId}`,
      sessionId: session.id,
      studentId,
      enrollmentId: enr?.id || item.enrollmentId,
      status: 'present',
      isCharged: true,
      sessionUnits: isHourly ? undefined : result.sessionUnits,
      hours: isHourly ? result.hours : undefined,
      notes: result.notes,
      recordedAt: new Date().toISOString(),
    };

    db.saveAttendanceBatch(session.id, [record]);
    db.saveSession({
      ...session,
      status: 'completed',
      sessionUnits: isHourly ? undefined : result.sessionUnits,
      hours: isHourly ? result.hours : undefined,
      pricePerStudent: result.pricePerStudent,
      notes: result.notes || session.notes,
    });

    const qtyText = formatSessionQuantityDisplay({
      sessionUnits: result.sessionUnits,
      hours: result.hours,
      isHourly,
    }, isRTL);

    showQuickFeedback(
      isEn
        ? `Recorded ${qtyText} for ${item.studentName}`
        : `تم تسجيل حضور ${qtyText} للطالب ${item.studentName}`
    );
    setPrivateIntakeTarget(null);
    onDataChanged?.();
  };

  // Comprehensive list of items to display on today's schedule (scheduled recurring + explicit ad-hoc)
  const allTodayDisplayItems = useMemo(() => {
    const list: ScheduledClassItem[] = [...scheduledToday];

    todaySessions.forEach((s) => {
      const alreadyRepresented = list.some((item) => {
        const matching = findSessionForScheduleItem(item);
        return matching?.id === s.id;
      });

      if (!alreadyRepresented) {
        const group = groups.find((g) => g.id === s.groupId);
        const isPrivate = group?.type === 'private' || !!s.studentId;
        const student = s.studentId ? students.find((st) => st.id === s.studentId) : undefined;
        const sortMinutes = parseTimeToMinutes(s.startTime);
        const formattedTime = formatTimeDisplay(s.startTime, isRTL);

        list.push({
          id: `today_ses_${s.id}`,
          studentId: s.studentId || '',
          studentName: student?.name || s.title || (isPrivate ? (isEn ? 'Private Lesson' : 'درس خاص') : (group?.name || '')),
          student,
          groupId: s.groupId,
          groupName: group?.name || s.title || (isEn ? 'Academic Session' : 'حصة دراسية'),
          group,
          enrollmentId: s.enrollmentId,
          isPrivate,
          subject: group?.subject || (isPrivate ? (isEn ? 'Private Lesson' : 'درس خاص') : (isEn ? 'General' : 'عام')),
          dayName: s.dayName || todayArabicDay,
          time: formattedTime,
          rawTime: s.startTime || '16:00',
          sortMinutes,
          location: group?.roomOrLocation,
          accentColor: group?.accentColor || (isPrivate ? '#16324F' : '#0A3D62'),
        });
      }
    });

    list.sort((a, b) => a.sortMinutes - b.sortMinutes);
    return list;
  }, [scheduledToday, todaySessions, groups, students, isRTL, isEn, todayArabicDay, sessions]);

  // Today's Private Lessons Summary for students with private appointments today (Feature 1)
  const todayPrivateStudentsSummary = useMemo(() => {
    const map = new Map<string, {
      studentId: string;
      studentName: string;
      items: { session: Session; attendance?: Attendance; time: string; units: number; hours: number; val: number; isHourly: boolean }[];
      totalUnits: number;
      totalHours: number;
      totalValue: number;
      recordedSessionsCount: number;
      hasIncomplete: boolean;
    }>();

    allTodayDisplayItems.filter((item) => item.isPrivate && item.studentId).forEach((item) => {
      const stuId = item.studentId;
      const matching = findSessionForScheduleItem(item);
      const att = matching ? allAttendance.find((a) => a.sessionId === matching.id && a.studentId === stuId) : undefined;
      const isPresent = att?.status === 'present' || att?.status === 'late';
      const enr = enrollments.find((e) => e.studentId === stuId && (e.groupId === item.groupId || e.id === item.enrollmentId));
      const isHourly = enr?.billingMode === 'hourly' || enr?.billingType === 'hourly' || item.group?.billingMode === 'hourly';
      const units = att?.sessionUnits !== undefined ? att.sessionUnits : (matching?.sessionUnits !== undefined ? matching.sessionUnits : 0);
      const hours = att?.hours !== undefined ? att.hours : (matching?.hours !== undefined ? matching.hours : 0);
      const rate = enr?.customPrice || item.group?.defaultPrice || 100;
      const val = att?.pricePerStudent || matching?.pricePerStudent || (isHourly ? multiplyMoney(hours, rate) : multiplyMoney(units, rate));
      const isIncomplete = isPresent && (isHourly ? hours <= 0 : units <= 0);

      const existing = map.get(stuId) || {
        studentId: stuId,
        studentName: item.studentName,
        items: [],
        totalUnits: 0,
        totalHours: 0,
        totalValue: 0,
        recordedSessionsCount: 0,
        hasIncomplete: false,
      };

      if (matching) {
        existing.items.push({
          session: matching,
          attendance: att,
          time: item.time,
          units,
          hours,
          val,
          isHourly,
        });
      }

      if (att && isPresent) {
        existing.recordedSessionsCount++;
        existing.totalUnits = roundMoney(existing.totalUnits + units, 2);
        existing.totalHours = roundMoney(existing.totalHours + hours, 2);
        existing.totalValue = addMoney(existing.totalValue, val);
      }
      if (isIncomplete) {
        existing.hasIncomplete = true;
      }

      map.set(stuId, existing);
    });

    return Array.from(map.values()).map((s) => ({
      ...s,
      totalUnitsOrHoursText:
        s.totalHours > 0
          ? formatSessionQuantityDisplay({ hours: s.totalHours, isHourly: true }, isRTL)
          : formatSessionQuantityDisplay({ sessionUnits: s.totalUnits, isHourly: false }, isRTL),
    }));
  }, [allTodayDisplayItems, allAttendance, sessions, enrollments, isEn, todayStr]);

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
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar p-3.5 sm:p-5 space-y-4 text-[#16324F] pb-32 bg-[#FFFFFF] relative"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Soft Ambient Warm Luxury Light Glow in Background */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#0A3D62]/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-0 w-80 h-80 bg-[#16324F]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-[#0A3D62]/6 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* =========================================================================
          1. Profile & Signature Executive Hero Header
          ========================================================================= */}
      <div className="rounded-[26px] bg-gradient-to-r from-[#0A3D62] via-[#16324F] to-[#6F7882] p-5 sm:p-6 text-[#FFFFFF] relative overflow-hidden shadow-xl border border-[#0A3D62]/35">
        <div className="absolute -top-16 -right-16 w-60 h-60 bg-[#0A3D62]/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-60 h-60 bg-[#16324F]/25 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          {/* Teacher Profile & Greeting */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0A3D62] via-[#16324F] to-[#0A3D62] p-0.5 shadow-lg shadow-[#16324F]/30 shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#16324F] flex items-center justify-center text-[#FFFFFF] font-black text-2xl overflow-hidden">
                {teacherProfile.name ? teacherProfile.name.charAt(0) : 'C'}
              </div>
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#C7CDD3] flex items-center gap-1">
                  {greetingText}
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black text-[#FFFFFF] tracking-tight truncate">
                {teacherProfile.name ? `${isEn ? 'Teacher ' : 'أ. '}${teacherProfile.name}` : (isEn ? 'Teacher' : 'أستاذنا الفاضل')}
              </h1>
              <p className="text-xs sm:text-sm text-[#C7CDD3]/90 font-medium truncate">
                {teacherProfile.subject || (isEn ? 'Subject' : 'المادة التعليمية')} • {teacherProfile.centerOrSchool || (isEn ? 'Classy Education' : 'منظومة كلاسي الذكية')}
              </p>
            </div>
          </div>

          {/* Action Hub & Mascot */}
          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#C7CDD3]/20">
            <div className="hidden md:flex items-center gap-2 bg-[#FFFFFF]/10 backdrop-blur-md border border-[#C7CDD3]/25 px-3 py-1.5 rounded-2xl shadow-xs">
              <div className="w-9 h-9 flex items-center justify-center">
                <ClassyOwlMascot size="sm" pose="welcome" glow={false} />
              </div>
              <div className="text-right">
                <span className="text-[10px] font-extrabold text-[#C7CDD3] block leading-none">{isEn ? 'Smart Assistant' : 'مساعدك الذكي'}</span>
                <span className="text-xs font-bold text-[#FFFFFF] block mt-0.5">{isEn ? 'Ready to help' : 'جاهز لخدمتك'}</span>
              </div>
            </div>

            {/* Date Badge */}
            <div className="flex items-center gap-1.5 bg-[#FFFFFF]/10 backdrop-blur-md border border-[#C7CDD3]/25 px-3 py-2 rounded-2xl text-xs font-bold text-[#FFFFFF] shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-[#C7CDD3]" />
              <span>
                {new Date().toLocaleDateString(isEn ? 'en-US' : 'ar-EG', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>

            {/* Cloud Sync Status */}
            {isOffline && (
              <button
                onClick={handleTriggerSync}
                disabled={isSyncing}
                className="relative p-2.5 rounded-2xl bg-[#16324F]/30 hover:bg-[#16324F]/45 border border-[#0A3D62]/50 text-[#C7CDD3] transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-md"
                title={isEn ? 'Working Offline - Click to sync when online' : 'العمل بدون إنترنت - انقر للمزامنة عند الاتصال'}
              >
                <WifiOff className="w-4.5 h-4.5 text-[#C7CDD3]" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#0A3D62] ring-2 ring-[#16324F] animate-ping" />
              </button>
            )}

            <button
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="p-2.5 rounded-2xl bg-[#FFFFFF]/10 hover:bg-[#FFFFFF]/20 border border-[#C7CDD3]/25 text-[#FFFFFF] transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-md"
              title={isEn ? 'Sync Cloud Data' : 'مزامنة البيانات السحابية'}
            >
              <RefreshCw className={`w-4.5 h-4.5 text-[#FFFFFF] ${isSyncing ? 'animate-spin' : ''}`} />
            </button>

            {/* Notifications Bell */}
            {onOpenNotificationsModal && (
              <button
                onClick={onOpenNotificationsModal}
                className="relative p-2.5 rounded-2xl bg-[#FFFFFF]/10 hover:bg-[#FFFFFF]/20 border border-[#C7CDD3]/25 text-[#FFFFFF] transition-all cursor-pointer flex items-center justify-center active:scale-95 shadow-md"
                title={t('smartNotifications')}
              >
                <Bell className="w-4.5 h-4.5 text-[#FFFFFF]" />
                {smartReminders.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-[#16324F] text-[#FFFFFF] text-[9px] font-black flex items-center justify-center shadow-md ring-2 ring-[#0A3D62] animate-pulse">
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
        <div className="p-3.5 rounded-2xl bg-[#16324F] text-[#FFFFFF] border border-[#0A3D62] text-xs font-bold flex items-center justify-between shadow-lg shadow-[#16324F]/20 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#C7CDD3]" />
            <span>{quickSuccessMsg}</span>
          </div>
          <button onClick={() => setQuickSuccessMsg(null)}>
            <X className="w-4 h-4 text-[#C7CDD3] hover:text-[#FFFFFF]" />
          </button>
        </div>
      )}

      {/* =========================================================================
          2. Executive Summary Bento Grid
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Main Today Activity Hero Card */}
        <div className="lg:col-span-7 rounded-[24px] bg-gradient-to-br from-[#16324F] via-[#6F7882] to-[#0A3D62] p-5 text-[#FFFFFF] flex flex-col justify-between relative overflow-hidden shadow-xl border border-[#0A3D62]/35">
          <div className="absolute -top-10 -left-10 w-44 h-44 bg-[#0A3D62]/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-[#16324F]/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0A3D62] animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-[#C7CDD3]">
                  {isEn ? "Today's Academic Activity" : 'نشاط اليوم الدراسي'}
                </span>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-[#FFFFFF]/15 text-[#FFFFFF] border border-[#0A3D62]/40 shadow-xs">
                {totalTodayClassesCount} {isEn ? 'scheduled' : 'حصص مجدولة'}
              </span>
            </div>

            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-[#FFFFFF]">
                {completedTodaySessionsCount === totalTodayClassesCount && totalTodayClassesCount > 0
                  ? (isEn ? "🎉 All today's sessions completed successfully!" : '🎉 اكتملت جميع حصص اليوم بنجاح!')
                  : (isEn ? `${remainingTodaySessionsCount} sessions pending attendance` : `متبقي ${remainingTodaySessionsCount} حصص للرصد والمتابعة`)}
              </h2>
              <div className="flex items-center gap-3 text-xs text-[#C7CDD3] font-medium flex-wrap">
                <span>{isEn ? "Today's Revenue:" : 'تحصيل اليوم:'} <strong className="text-[#FFFFFF] font-bold">{totalTodayRevenue} {t('currency')}</strong></span>
                <span>•</span>
                <span>{isEn ? 'Appointments: ' : 'المواعيد: '}<strong className="text-[#FFFFFF] font-bold">{completedTodaySessionsCount}</strong> {isEn ? 'of ' : 'من '}<strong className="text-[#FFFFFF] font-bold">{totalTodayClassesCount}</strong></span>
                {todayWorkload.completedLessonUnits > 0 && (
                  <>
                    <span>•</span>
                    <span>{isEn ? 'Lessons: ' : 'الحصص: '}<strong className="text-[#FFFFFF] font-black">{todayWorkload.completedLessonUnits} {isEn ? 'Lessons' : 'حصة'}</strong></span>
                  </>
                )}
                {todayWorkload.completedHours > 0 && (
                  <>
                    <span>•</span>
                    <span>{isEn ? 'Hours: ' : 'الساعات: '}<strong className="text-[#FFFFFF] font-black">{todayWorkload.completedHours} {isEn ? 'Hours' : 'ساعة'}</strong></span>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="w-full bg-[#16324F]/40 h-3 rounded-full overflow-hidden p-0.5 border border-[#C7CDD3]/20">
                <div
                  className="bg-gradient-to-r from-[#C7CDD3] via-[#FFFFFF] to-[#C7CDD3] h-full rounded-full transition-all duration-500 shadow-sm"
                  style={{
                    width: `${totalTodayClassesCount > 0 ? (completedTodaySessionsCount / totalTodayClassesCount) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-bold text-[#C7CDD3]/90">
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
            className="p-3.5 sm:p-4 rounded-[22px] bg-[#C7CDD3]/15 border border-[#C7CDD3] flex flex-col justify-between cursor-pointer group active:scale-[0.98] transition-all hover:shadow-lg hover:border-[#0A3D62]"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#0A3D62] to-[#16324F] text-[#FFFFFF] flex items-center justify-center shadow-md shadow-[#0A3D62]/20">
                <Users className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#C7CDD3]/25 text-[#0A3D62] border border-[#C7CDD3]">
                {isEn ? 'Active' : 'نشط'}
              </span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-[#16324F] tracking-tight block">
                {activeStudentsList.length}
              </span>
              <span className="text-xs font-bold text-[#6F7882] block mt-0.5">
                {t('activeStudents')}
              </span>
            </div>
          </div>

          {/* Metric 2: Attendance Rate */}
          <div
            onClick={() => onNavigateToTab('reports')}
            className="p-3.5 sm:p-4 rounded-[22px] bg-[#C7CDD3]/15 border border-[#C7CDD3] flex flex-col justify-between cursor-pointer group active:scale-[0.98] transition-all hover:shadow-lg hover:border-[#0A3D62]"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#0A3D62] to-[#16324F] text-[#FFFFFF] flex items-center justify-center shadow-md shadow-[#0A3D62]/25">
                <TrendingUp className="w-4.5 h-4.5" />
              </div>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#C7CDD3]/25 text-[#16324F] border border-[#0A3D62]/50">
                {isEn ? 'Rate' : 'التزام'}
              </span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-[#16324F] tracking-tight block">
                {overallAttendanceRate}%
              </span>
              <span className="text-xs font-bold text-[#6F7882] block mt-0.5">
                {t('attendanceRate')}
              </span>
            </div>
          </div>

          {/* Metric 3: Month Revenue */}
          <div
            onClick={() => onNavigateToTab('reports')}
            className="p-3.5 sm:p-4 rounded-[22px] bg-[#C7CDD3]/15 border border-[#C7CDD3] flex flex-col justify-between cursor-pointer group active:scale-[0.98] transition-all hover:shadow-lg hover:border-[#0A3D62]"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#16324F] to-[#6F7882] text-[#FFFFFF] flex items-center justify-center shadow-md shadow-[#16324F]/20">
                <DollarSign className="w-4.5 h-4.5 text-[#0A3D62]" />
              </div>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#C7CDD3]/25 text-[#16324F] border border-[#C7CDD3]">
                {isEn ? `Month ${currentMonth}` : `شهر ${currentMonth}`}
              </span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-[#16324F] tracking-tight block truncate">
                {totalMonthRevenue} <span className="text-xs font-bold text-[#6F7882]">{t('currency')}</span>
              </span>
              <span className="text-xs font-bold text-[#6F7882] block mt-0.5">
                {t('monthlyRevenue')}
              </span>
            </div>
          </div>

          {/* Metric 4: Outstanding Dues */}
          <div
            onClick={() => onNavigateToTab('reports')}
            className="p-3.5 sm:p-4 rounded-[22px] bg-[#C7CDD3]/15 border border-[#C7CDD3] flex flex-col justify-between cursor-pointer group active:scale-[0.98] transition-all hover:shadow-lg hover:border-[#0A3D62]/50"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#16324F] to-[#0A3D62] text-[#FFFFFF] flex items-center justify-center shadow-md shadow-[#0A3D62]/20">
                <Receipt className="w-4.5 h-4.5" />
              </div>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                totalOutstandingDues > 0
                  ? 'bg-[#0A3D62]/10 text-[#0A3D62] border-[#0A3D62]/30'
                  : 'bg-[#C7CDD3]/25 text-[#16324F] border-[#0A3D62]/50'
              }`}>
                {totalOutstandingDues > 0 ? (isEn ? `${overdueStudentsCount} dues` : `${overdueStudentsCount} طلاب`) : t('settled')}
              </span>
            </div>
            <div>
              <span className={`text-2xl sm:text-3xl font-black tracking-tight block truncate ${
                totalOutstandingDues > 0 ? 'text-[#0A3D62]' : 'text-[#16324F]'
              }`}>
                {totalOutstandingDues} <span className="text-xs font-bold text-[#6F7882]">{t('currency')}</span>
              </span>
              <span className="text-xs font-bold text-[#6F7882] block mt-0.5">
                {t('totalPendingDues')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. Quick Actions Bar
          ========================================================================= */}
      <div className="classy-card p-2 sm:p-3 bg-[#C7CDD3]/15 border border-[#C7CDD3]">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={onOpenAddStudent}
            className="py-3 px-3.5 rounded-2xl bg-[#FFFFFF] hover:bg-[#C7CDD3]/35 border border-[#C7CDD3]/50 flex items-center justify-center gap-2.5 transition-all cursor-pointer group active:scale-95 shadow-2xs hover:shadow-sm"
          >
            <div className="w-8 h-8 rounded-xl bg-[#C7CDD3]/25 text-[#0A3D62] flex items-center justify-center shrink-0 group-hover:bg-[#0A3D62] group-hover:text-[#FFFFFF] transition-colors shadow-2xs">
              <UserPlus className="w-4 h-4" />
            </div>
            <span className="font-black text-xs sm:text-sm text-[#16324F] group-hover:text-[#0A3D62] transition-colors truncate">
              {t('addStudent')}
            </span>
          </button>

          <button
            onClick={onOpenAddGroup}
            className="py-3 px-3.5 rounded-2xl bg-[#FFFFFF] hover:bg-[#C7CDD3]/35 border border-[#C7CDD3]/50 flex items-center justify-center gap-2.5 transition-all cursor-pointer group active:scale-95 shadow-2xs hover:shadow-sm"
          >
            <div className="w-8 h-8 rounded-xl bg-[#C7CDD3]/25 text-[#16324F] flex items-center justify-center shrink-0 group-hover:bg-[#16324F] group-hover:text-[#FFFFFF] transition-colors shadow-2xs">
              <Layers className="w-4 h-4" />
            </div>
            <span className="font-black text-xs sm:text-sm text-[#16324F] group-hover:text-[#16324F] transition-colors truncate">
              {t('createGroupBtn')}
            </span>
          </button>

          <button
            onClick={onOpenAddSession}
            className="py-3 px-3.5 rounded-2xl bg-[#FFFFFF] hover:bg-[#C7CDD3]/35 border border-[#C7CDD3]/50 flex items-center justify-center gap-2.5 transition-all cursor-pointer group active:scale-95 shadow-2xs hover:shadow-sm"
          >
            <div className="w-8 h-8 rounded-xl bg-[#C7CDD3]/25 text-[#0A3D62] border border-[#0A3D62]/40 flex items-center justify-center shrink-0 group-hover:bg-[#0A3D62] group-hover:text-[#FFFFFF] transition-colors shadow-2xs">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
            <span className="font-black text-xs sm:text-sm text-[#16324F] group-hover:text-[#16324F] transition-colors truncate">
              {t('scheduleSessionBtn')}
            </span>
          </button>

          <button
            onClick={onOpenAddPayment}
            className="py-3 px-3.5 rounded-2xl bg-[#FFFFFF] hover:bg-[#C7CDD3]/35 border border-[#C7CDD3]/50 flex items-center justify-center gap-2.5 transition-all cursor-pointer group active:scale-95 shadow-2xs hover:shadow-sm"
          >
            <div className="w-8 h-8 rounded-xl bg-[#C7CDD3]/25 text-[#16324F] border border-[#16324F]/40 flex items-center justify-center shrink-0 group-hover:bg-[#16324F] group-hover:text-[#FFFFFF] transition-colors shadow-2xs">
              <DollarSign className="w-4 h-4" />
            </div>
            <span className="font-black text-xs sm:text-sm text-[#16324F] group-hover:text-[#16324F] transition-colors truncate">
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
            <div className="w-8 h-8 rounded-xl bg-[#C7CDD3]/25 text-[#0A3D62] flex items-center justify-center font-bold shadow-2xs border border-[#C7CDD3]/50">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-[#16324F]">
                {isEn ? `Today's Sessions (${scheduledToday.length})` : `حصص اليوم الدراسي (${scheduledToday.length})`}
              </h2>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('sessions')}
            className="text-xs font-bold text-[#0A3D62] hover:text-[#16324F] flex items-center gap-1 cursor-pointer"
          >
            <span>{t('sessionsTitle')}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#0A3D62]" />
          </button>
        </div>

        {/* Today's Private Lessons Summary Banner (Feature 1) */}
        {todayPrivateStudentsSummary.length > 0 && (
          <div className="p-3.5 bg-gradient-to-r from-[#FFFFFF] to-[#C7CDD3]/60 rounded-2xl border border-[#0A3D62]/50 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-black text-xs text-[#16324F] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#16324F]" />
                <span>{isEn ? "Today's Private Lessons Summary" : 'ملخص الدروس الخاصة لليوم'}</span>
              </span>
              <span className="text-[10px] font-black text-[#0A3D62] bg-[#FFFFFF] px-2 py-0.5 rounded-full border border-[#C7CDD3]">
                {todayPrivateStudentsSummary.length} {isEn ? 'Students' : 'طلاب'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {todayPrivateStudentsSummary.map((summary) => (
                <div key={summary.studentId} className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#C7CDD3] text-xs space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between font-black text-[#16324F]">
                    <span className="truncate">{summary.studentName}</span>
                    <span className="text-[#0A3D62] shrink-0 font-black">{summary.totalUnitsOrHoursText}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#6F7882]">
                    <span>{isEn ? `${summary.recordedSessionsCount} appointment(s)` : `${summary.recordedSessionsCount} موعد مسجل`}</span>
                    <strong className="text-[#16324F] font-black">{summary.totalValue} {t('currency')}</strong>
                  </div>
                  {summary.hasIncomplete && (
                    <div className="pt-1 text-[10px] font-black text-[#16324F] flex items-center gap-1">
                      <span>⚠️</span>
                      <span>{isEn ? 'Incomplete session details' : 'حصة غير مكتملة التفاصيل'}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {allTodayDisplayItems.length === 0 ? (
          <div className="classy-card p-6 sm:p-8 flex flex-col items-center text-center space-y-3 relative overflow-hidden bg-[#C7CDD3]/15">
            <div className="w-28 h-28 flex items-center justify-center">
              <ClassyOwlMascot size="lg" pose="waving" glow={true} />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="font-black text-[#16324F] text-sm sm:text-base">
                {isEn ? 'No sessions scheduled for today!' : 'لا توجد حصص مجدولة لليوم!'}
              </h3>
              <p className="text-xs text-[#6F7882] font-medium leading-relaxed">
                {isEn ? 'Enjoy your calm day or schedule a new teaching session now.' : 'استمتع بيومك الهادئ أو قم بجدولة حصة تدريسية جديدة الآن بضغطة زر.'}
              </p>
            </div>
            <button
              onClick={onOpenAddSession}
              className="mt-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#0A3D62] to-[#16324F] text-[#FFFFFF] font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#0A3D62]" />
              <span>{isEn ? "Add Today's Session" : 'إضافة حصة اليوم'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {allTodayDisplayItems.map((item) => {
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
                  className={`classy-card overflow-hidden transition-all bg-[#FFFFFF] ${
                    isRecorded ? 'border-[#0A3D62]/60 bg-gradient-to-r from-[#C7CDD3]/45 to-[#FFFFFF]' : 'hover:border-[#0A3D62]/50'
                  }`}
                >
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Time slot pill */}
                      <div className="px-3 py-1.5 rounded-2xl bg-[#C7CDD3]/15 border border-[#C7CDD3] text-center shrink-0 min-w-[66px]">
                        <span className="text-xs font-black text-[#16324F] block leading-tight">{item.time}</span>
                        <span className={`text-[9px] font-extrabold block mt-0.5 px-2 py-0.2 rounded-full ${
                          item.isPrivate ? 'bg-[#16324F]/15 text-[#16324F]' : 'bg-[#C7CDD3]/25 text-[#16324F]'
                        }`}>
                          {item.isPrivate ? (isEn ? 'Private' : 'خاص') : (isEn ? 'Group' : 'مجموعة')}
                        </span>
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: item.accentColor || '#0A3D62' }}
                          />
                          <h3 className="font-black text-xs sm:text-sm text-[#16324F] truncate">
                            {item.isPrivate ? (item.studentName || (isEn ? 'Private Lesson' : 'درس خاص')) : item.groupName}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-[#6F7882] flex-wrap font-medium">
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
                          (() => {
                            const firstAtt = sessionAttendance[0];
                            const isHourly = item.group?.billingMode === 'hourly' || item.group?.billingType === 'hourly';
                            const isPres = firstAtt?.status === 'present' || firstAtt?.status === 'late';
                            const isIncomplete =
                              isPres &&
                              (isHourly
                                ? (firstAtt?.hours === undefined || firstAtt?.hours === null || firstAtt.hours <= 0)
                                : (firstAtt?.sessionUnits === undefined || firstAtt?.sessionUnits === null || firstAtt.sessionUnits <= 0));

                            if (isIncomplete) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => setPrivateIntakeTarget({ item, studentId: item.studentId || '' })}
                                  className="px-2.5 py-1 rounded-xl bg-[#C7CDD3]/25 text-[#16324F] border border-[#16324F] text-[10px] font-black flex items-center gap-1 cursor-pointer hover:bg-[#0A3D62]/30 transition-all shadow-2xs animate-pulse"
                                  title={isEn ? 'Click to complete session details' : 'اضغط لاستكمال تفاصيل الدرس'}
                                >
                                  <span>⚠️</span>
                                  <span>{isEn ? 'Details Required' : 'تفاصيل مطلوبة'}</span>
                                </button>
                              );
                            }

                            return (
                              <div className="flex items-center gap-1">
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 ${
                                  presentCount > 0
                                    ? 'bg-[#C7CDD3]/25 text-[#16324F] border border-[#0A3D62]/50'
                                    : 'bg-[#0A3D62]/10 text-[#0A3D62] border border-[#0A3D62]/30'
                                }`}>
                                  {presentCount > 0 ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3 text-[#0A3D62]" />
                                      <span>
                                        {firstAtt?.hours
                                          ? `${firstAtt.hours} ${isEn ? 'hrs' : 'ساعة'}`
                                          : `${firstAtt?.sessionUnits || 1} ${isEn ? 'session(s)' : 'حصة'}`}
                                      </span>
                                    </>
                                  ) : (
                                    <span>{isEn ? 'Absent' : 'لم يحضر'}</span>
                                  )}
                                </span>
                                {presentCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setPrivateIntakeTarget({ item, studentId: item.studentId || '' })}
                                    className="p-1.5 rounded-lg bg-[#C7CDD3]/15 border border-[#C7CDD3] text-[#0A3D62] hover:bg-[#C7CDD3]/35 transition-colors cursor-pointer"
                                    title={isEn ? 'Edit Intake' : 'تعديل التفاصيل'}
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-[10px] font-bold bg-[#C7CDD3]/25 text-[#16324F] border border-[#0A3D62]/50 px-2.5 py-1 rounded-xl flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-[#0A3D62]" />
                            <span>{isEn ? 'Present' : 'حاضر'} {presentCount}/{groupStudents.length}</span>
                          </span>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkAllPresent(item)}
                          className="min-h-[34px] px-3.5 py-1 rounded-xl bg-gradient-to-r from-[#0A3D62] to-[#16324F] text-[#FFFFFF] font-bold text-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs"
                          title={item.isPrivate ? (isEn ? 'Record attendance' : 'تسجيل حضور الطالب') : (isEn ? 'Mark all present' : 'تسجيل حضور جميع الطلاب دفعة واحدة')}
                        >
                          <UserCheck className="w-3.5 h-3.5 text-[#0A3D62]" />
                          <span>{item.isPrivate ? (isEn ? 'Attended' : 'حضر') : (isEn ? 'All Present' : 'حضور الكل')}</span>
                        </button>
                      )}

                      {/* Expand for detail individual marking */}
                      <button
                        type="button"
                        onClick={() => setExpandedAttendanceCardId(isExpanded ? null : item.id)}
                        className="p-1.5 rounded-xl bg-[#C7CDD3]/15 hover:bg-[#C7CDD3]/35 border border-[#C7CDD3]/50 text-[#16324F] transition-colors cursor-pointer"
                        title={isEn ? 'Details & individual marking' : 'تفاصيل ورصد فردي'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Student List */}
                  {isExpanded && (
                    <div className="p-3 bg-[#C7CDD3]/15 border-t border-[#C7CDD3] space-y-2 animate-in slide-in-from-top-1 duration-150">
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#6F7882] mb-1">
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
                              className="p-2.5 bg-[#FFFFFF] rounded-2xl border border-[#C7CDD3] flex items-center justify-between gap-2 shadow-2xs"
                            >
                              <span className="font-bold text-xs text-[#16324F] truncate min-w-0">
                                {st.name}
                              </span>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'present', true)}
                                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                                    stStatus === 'present'
                                      ? 'bg-[#16324F] text-[#FFFFFF] shadow-2xs'
                                      : 'bg-[#C7CDD3]/15 text-[#6F7882] hover:bg-[#C7CDD3]/35 hover:text-[#16324F]'
                                  }`}
                                >
                                  {isEn ? 'Present' : 'حاضر'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'absent_charged', true)}
                                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                                    stStatus === 'absent_charged' || (stStatus === 'absent' && currentRecord?.isCharged !== false)
                                      ? 'bg-[#0A3D62] text-[#FFFFFF] shadow-2xs'
                                      : 'bg-[#C7CDD3]/15 text-[#6F7882] hover:bg-[#0A3D62]/15 hover:text-[#0A3D62]'
                                  }`}
                                >
                                  {isEn ? 'Absent (Paid)' : 'غياب محسوب'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'absent_free', false)}
                                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                                    stStatus === 'absent_free' || stStatus === 'excused' || (stStatus === 'absent' && currentRecord?.isCharged === false)
                                      ? 'bg-[#6F7882] text-[#FFFFFF] shadow-2xs'
                                      : 'bg-[#C7CDD3]/15 text-[#6F7882] hover:bg-[#C7CDD3]/35'
                                  }`}
                                >
                                  {isEn ? 'Excused' : 'معتذر'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuickStudentAttendance(item, st.id, 'late', true)}
                                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                                    stStatus === 'late'
                                      ? 'bg-[#16324F] text-[#FFFFFF] shadow-2xs'
                                      : 'bg-[#C7CDD3]/15 text-[#6F7882] hover:bg-[#16324F]/15 hover:text-[#16324F]'
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
                            className="text-[11px] font-bold text-[#0A3D62] hover:text-[#16324F] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>{isEn ? 'Open Full Attendance Modal' : 'فتح نافذة الحضور الشاملة'}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-[#0A3D62]" />
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
        {/* Private Class Intake Modal */}
        {privateIntakeTarget && (
          <PrivateClassIntakeModal
            isOpen={!!privateIntakeTarget}
            onClose={() => setPrivateIntakeTarget(null)}
            student={students.find((s) => s.id === privateIntakeTarget.studentId) || null}
            enrollment={enrollments.find((e) => e.studentId === privateIntakeTarget.studentId && (e.groupId === privateIntakeTarget.item.groupId || e.id === privateIntakeTarget.item.enrollmentId)) || null}
            session={findSessionForScheduleItem(privateIntakeTarget.item)}
            onConfirm={handleConfirmPrivateIntake}
          />
        )}
      </div>
    </div>
  );
};
