import React, { useState, useMemo, useEffect } from 'react';
import { ScreenHeader } from './ui/ScreenHeader';
import { NavyCard } from './ui/NavyCard';
import { ProgressRing } from './ui/ProgressRing';
import { MintCard } from './ui/MintCard';
import { SectionHeader } from './ui/SectionHeader';
import { Avatar } from './ui/Avatar';
import { SessionTimeline } from './SessionTimeline';
import { TeacherBoard } from './illustrations/TeacherBoard';
import { StudentReading } from './illustrations/StudentReading';
import { WalletCoins } from './illustrations/WalletCoins';
import { CalendarCheck } from './illustrations/CalendarCheck';
import { EmptyBox } from './illustrations/EmptyBox';
import { Toast } from './ui/Toast';
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
import { PrivateClassIntakeModal, PrivateClassIntakeResult } from './PrivateClassIntakeModal';
import { AppIcon } from './ui/AppIcon';

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
      if (item.isPrivate || item.studentId) {
        if (s.studentId !== item.studentId) return false;
        if (item.enrollmentId && s.enrollmentId && s.enrollmentId !== item.enrollmentId) return false;
      } else {
        if (s.groupId !== item.groupId) return false;
      }

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

    const group = item.groupId ? groups.find((g) => g.id === item.groupId) : undefined;
    const timeInfo = parseLocalTimeToStandard(item.rawTime);
    const rawStartTime = timeInfo.normalizedTime;
    const [h, m] = rawStartTime.split(':').map(Number);
    const endH = !isNaN(h) ? (h + 1) % 24 : 17;
    const endTime = `${String(endH).padStart(2, '0')}:${String(!isNaN(m) ? m : 0).padStart(2, '0')}`;

    const newSession: Session = {
      id: `sess_${todayStr}_${item.groupId || 'priv'}_${item.studentId || 'grp'}_${timeInfo.sortMinutes}_${Math.random().toString(36).substr(2, 5)}`,
      groupId: item.groupId || '',
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
          accentColor: group?.accentColor || (isPrivate ? '#0F2A4A' : '#17375E'),
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

  // Next pending session for the "Start session" quick action
  const nextPendingSession = useMemo(() => {
    const scheduledExisting = todaySessions.find((s) => s.status === 'scheduled');
    if (scheduledExisting) return scheduledExisting;

    const pendingItem = allTodayDisplayItems.find((item) => {
      const matching = findSessionForScheduleItem(item);
      return !matching || matching.status === 'scheduled';
    });
    if (pendingItem) {
      return getOrCreateSessionForSchedule(pendingItem);
    }

    return null;
  }, [todaySessions, allTodayDisplayItems, groups, students, parts, todayStr]);

  const handleStartNextSession = () => {
    if (!nextPendingSession) return;
    onOpenAttendanceModal(nextPendingSession);
  };

  const todayProgressPercent = totalTodayClassesCount > 0
    ? Math.min(100, Math.max(0, Math.round((completedTodaySessionsCount / totalTodayClassesCount) * 100)))
    : 0;

  const hasUnreadNotifications = smartReminders.some((r) => !r.isRead);

  // Pending sessions today for Today's Focus Row 1
  const pendingFocusSessions = useMemo(() => {
    return allTodayDisplayItems.filter((item) => {
      const matching = findSessionForScheduleItem(item);
      return !matching || matching.status !== 'completed';
    });
  }, [allTodayDisplayItems, sessions]);

  const focusSession1 = pendingFocusSessions[0];
  const focusSession2 = pendingFocusSessions[1];

  // Unrecorded sessions today for Today's Focus Row 2
  const unrecordedTodaySessions = useMemo(() => {
    return allTodayDisplayItems.filter((item) => {
      const matching = findSessionForScheduleItem(item);
      if (!matching) return true;
      const att = db.getSessionAttendance(matching.id);
      return att.length === 0 || matching.status === 'scheduled';
    });
  }, [allTodayDisplayItems, sessions]);

  const handleAttendanceToRecordClick = () => {
    if (unrecordedTodaySessions.length > 0) {
      const s = getOrCreateSessionForSchedule(unrecordedTodaySessions[0]);
      onOpenAttendanceModal(s);
    } else {
      onNavigateToTab('sessions');
    }
  };

  const handlePaymentsDueClick = () => {
    onNavigateToTab('reports');
  };

  const recentStudentsList = useMemo(() => {
    return students.filter((s) => s.status !== 'archived').slice(0, 12);
  }, [students]);

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar px-5 py-4 space-y-4 text-ink pb-32 bg-page relative"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* 1. Screen Header with Greeting */}
      <ScreenHeader
        title={t('dashboardGreetingPrefix') || (isEn ? 'Your teaching day starts' : 'يومك التعليمي يبدأ')}
        accentWord={t('dashboardGreetingAccent') || (isEn ? 'Now' : 'الآن')}
        hasUnreadNotifications={hasUnreadNotifications}
        onOpenNotifications={onOpenNotificationsModal}
        onOpenSettings={onNavigateToTab ? () => onNavigateToTab('settings') : undefined}
      />

      {/* 2. Today's Progress NavyCard (Daily Goal Card) */}
      <NavyCard className="relative">
        <div className="flex items-center justify-between gap-4 relative z-10">
          <div className="flex-1 min-w-0 space-y-2.5">
            <div>
              <h2 className="text-[16px] font-semibold text-white leading-tight">
                {t('todaysProgress') || (isEn ? "Today's progress" : 'إنجاز اليوم')}
              </h2>
              <p className="text-[13px] text-white/80 mt-1 leading-snug">
                {isEn
                  ? `${completedTodaySessionsCount} of ${totalTodayClassesCount} sessions completed`
                  : `اكتملت ${completedTodaySessionsCount} من ${totalTodayClassesCount} حصة`}
              </p>
            </div>

            {nextPendingSession && (
              <button
                type="button"
                onClick={handleStartNextSession}
                className="btn-orange px-3.5 py-1.5 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-transform"
              >
                <AppIcon name="sessions" weight="fill" size={14} />
                <span>{t('startSession') || (isEn ? 'Start session' : 'بدء الحصة')}</span>
              </button>
            )}
          </div>

          <div className="shrink-0">
            <ProgressRing
              value={todayProgressPercent}
              size={88}
              stroke={10}
              variant="navy"
              trackColor="navy-soft"
              arcColor="orange"
            />
          </div>
        </div>
      </NavyCard>

      {/* Quick Success Toast */}
      <Toast
        isOpen={Boolean(quickSuccessMsg)}
        message={quickSuccessMsg || ''}
        type="success"
        onClose={() => setQuickSuccessMsg(null)}
      />

      {/* 1. Today's Focus Section Header */}
      <div className="space-y-3 pt-1">
        <SectionHeader
          title={t('todaysFocus') || (isEn ? "Today's Focus" : 'تركيزك اليوم')}
        />

        {/* 2. 2x2 Grid of MintCards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Row 1, Card 1: First pending/next session */}
          {focusSession1 ? (
            <MintCard
              clickable
              onClick={() => {
                const s = getOrCreateSessionForSchedule(focusSession1);
                onOpenAttendanceModal(s);
              }}
              className="min-h-[168px] relative overflow-hidden flex flex-col justify-between p-4"
            >
              <div className="relative z-10 space-y-1">
                <h3 className="t-card text-navy font-bold line-clamp-2 leading-snug">
                  {focusSession1.isPrivate
                    ? (focusSession1.studentName || (isEn ? 'Private Lesson' : 'درس خاص'))
                    : focusSession1.groupName}
                </h3>
                <p className="text-[13px] text-slate font-medium">
                  {focusSession1.time}
                </p>
              </div>

              <div className="absolute -bottom-1 end-[-8px] w-28 h-24 pointer-events-none select-none opacity-90">
                <TeacherBoard className="w-full h-full object-contain" />
              </div>
            </MintCard>
          ) : (
            <MintCard className="min-h-[168px] relative overflow-hidden flex flex-col justify-between p-4">
              <div className="relative z-10 space-y-1">
                <h3 className="t-card text-navy font-bold leading-snug">
                  {isEn ? 'Clear schedule' : 'جدول هادئ'}
                </h3>
                <p className="text-[13px] text-slate font-medium">
                  {isEn ? 'No sessions scheduled today' : 'لا توجد حصص مجدولة لليوم'}
                </p>
              </div>

              <div className="absolute -bottom-1 end-[-6px] w-24 h-20 pointer-events-none select-none opacity-80">
                <EmptyBox className="w-full h-full object-contain" />
              </div>
            </MintCard>
          )}

          {/* Row 1, Card 2: Second pending/next session */}
          {focusSession2 ? (
            <MintCard
              clickable
              onClick={() => {
                const s = getOrCreateSessionForSchedule(focusSession2);
                onOpenAttendanceModal(s);
              }}
              className="min-h-[168px] relative overflow-hidden flex flex-col justify-between p-4"
            >
              <div className="relative z-10 space-y-1">
                <h3 className="t-card text-navy font-bold line-clamp-2 leading-snug">
                  {focusSession2.isPrivate
                    ? (focusSession2.studentName || (isEn ? 'Private Lesson' : 'درس خاص'))
                    : focusSession2.groupName}
                </h3>
                <p className="text-[13px] text-slate font-medium">
                  {focusSession2.time}
                </p>
              </div>

              <div className="absolute -bottom-1 end-[-8px] w-28 h-24 pointer-events-none select-none opacity-90">
                <StudentReading className="w-full h-full object-contain" />
              </div>
            </MintCard>
          ) : (
            <MintCard className="min-h-[168px] relative overflow-hidden flex flex-col justify-between p-4">
              <div className="relative z-10 space-y-1">
                <h3 className="t-card text-navy font-bold leading-snug">
                  {isEn ? 'All caught up' : 'يومك مكتمل'}
                </h3>
                <p className="text-[13px] text-slate font-medium">
                  {isEn ? 'No more sessions today' : 'لا توجد حصص أخرى لليوم'}
                </p>
              </div>

              <div className="absolute -bottom-1 end-[-6px] w-24 h-20 pointer-events-none select-none opacity-80">
                <EmptyBox className="w-full h-full object-contain" />
              </div>
            </MintCard>
          )}

          {/* Row 2, Card 1: Payments due */}
          <MintCard
            clickable
            onClick={handlePaymentsDueClick}
            className="min-h-[104px] relative overflow-hidden flex flex-col justify-between p-3.5"
          >
            <div className="relative z-10 space-y-1">
              <span className="text-[13px] font-semibold text-slate block leading-tight">
                {t('paymentsDue') || (isEn ? 'Payments due' : 'دفعات مستحقة')}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-navy leading-none">
                  {totalOutstandingDues}
                </span>
                <span className="text-xs font-semibold text-slate">
                  {t('currency')}
                </span>
              </div>
              {overdueStudentsCount > 0 && (
                <span className="text-[11px] text-slate block leading-none">
                  {overdueStudentsCount} {isEn ? 'students' : 'طلاب'}
                </span>
              )}
            </div>

            <div className="absolute -bottom-1 end-[-4px] w-14 h-12 pointer-events-none select-none opacity-90">
              <WalletCoins className="w-full h-full object-contain" />
            </div>
          </MintCard>

          {/* Row 2, Card 2: Attendance to record */}
          <MintCard
            clickable
            onClick={handleAttendanceToRecordClick}
            className="min-h-[104px] relative overflow-hidden flex flex-col justify-between p-3.5"
          >
            <div className="relative z-10 space-y-1">
              <span className="text-[13px] font-semibold text-slate block leading-tight">
                {t('attendanceToRecord') || (isEn ? 'Attendance to record' : 'حضور بانتظار الرصد')}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-navy leading-none">
                  {unrecordedTodaySessions.length}
                </span>
                <span className="text-xs font-semibold text-slate">
                  {isEn ? (unrecordedTodaySessions.length === 1 ? 'session' : 'sessions') : 'حصص'}
                </span>
              </div>
              <span className="text-[11px] text-slate block leading-none">
                {unrecordedTodaySessions.length > 0
                  ? (isEn ? 'Pending marking' : 'تحتاج للتسجيل')
                  : (isEn ? 'All recorded' : 'تم رصد الكل')}
              </span>
            </div>

            <div className="absolute -bottom-1 end-[-4px] w-14 h-12 pointer-events-none select-none opacity-90">
              <CalendarCheck className="w-full h-full object-contain" />
            </div>
          </MintCard>
        </div>
      </div>

      {/* 3. Today's Schedule */}
      <div className="space-y-3 pt-1">
        <SectionHeader
          title={t('todaysSchedule') || (isEn ? "Today's schedule" : 'جدول اليوم')}
          seeAllLabel={t('sessionsTitle') || (isEn ? 'All sessions' : 'جميع الحصص')}
          onSeeAll={() => onNavigateToTab('sessions')}
        />
        <SessionTimeline
          items={allTodayDisplayItems}
          sessions={sessions}
          students={students}
          groups={groups}
          allAttendance={allAttendance}
          findSessionForScheduleItem={findSessionForScheduleItem}
          onRecordAttendance={handleMarkAllPresent}
          onOpenAttendanceModal={onOpenAttendanceModal}
          onOpenStudentProfile={onOpenStudentProfile}
          onOpenGroupProfile={onOpenGroupProfile}
          onOpenAddSession={onOpenAddSession}
        />
      </div>

      {/* 4. Recent Students */}
      {recentStudentsList.length > 0 && (
        <div className="space-y-3 pt-1">
          <SectionHeader
            title={t('recentStudents') || (isEn ? 'Recent students' : 'الطلاب مؤخراً')}
            seeAllLabel={t('navStudents') || (isEn ? 'All students' : 'جميع الطلاب')}
            onSeeAll={() => onNavigateToTab('students')}
          />
          <div className="flex items-center gap-4 overflow-x-auto snap-x snap-mandatory py-2 px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {recentStudentsList.map((student) => (
              <button
                key={student.id}
                type="button"
                onClick={() => onOpenStudentProfile(student)}
                className="flex flex-col items-center gap-1.5 shrink-0 snap-start cursor-pointer group active:scale-95 transition-transform select-none w-16"
              >
                <Avatar
                  size={56}
                  name={student.name}
                  profilePhoto={student.profilePhoto}
                  className="group-hover:ring-2 group-hover:ring-orange transition-all shadow-xs"
                />
                <span className="text-[12px] font-medium text-navy text-center truncate w-full group-hover:text-orange transition-colors">
                  {student.name}
                </span>
              </button>
            ))}
          </div>
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
  );
};
