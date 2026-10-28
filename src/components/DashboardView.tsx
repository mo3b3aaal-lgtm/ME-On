import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ScreenHeader } from './ui/ScreenHeader';
import { NavyCard } from './ui/NavyCard';
import { ProgressRing } from './ui/ProgressRing';
import { MintCard } from './ui/MintCard';
import { SectionHeader } from './ui/SectionHeader';
import { Avatar } from './ui/Avatar';
import { StudentAvatar } from './StudentAvatar';
import { getStudentFrameCardTheme, FrameCornerWatermark } from '../utils/frameTheme';
import { getStudentProgression } from '../utils/studentProgression';
import { SessionTimeline } from './SessionTimeline';
import { TeacherBoard } from './illustrations/TeacherBoard';
import { StudentReading } from './illustrations/StudentReading';
import { WalletCoins } from './illustrations/WalletCoins';
import { CalendarCheck } from './illustrations/CalendarCheck';
import { EmptyBox } from './illustrations/EmptyBox';
import { Toast } from './ui/Toast';
import { Student, Group, Enrollment, Session, Payment, TeacherProfile, Attendance, AttendanceStatus, ActiveTab, AutoSyncConfig } from '../types';
import {
  db,
  formatSessionQuantityDisplay,
  getAutoSyncConfig,
  performFullSync,
  subscribeToSyncUpdates,
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
  isExplicitPrivateSessionOperationalOnDate,
} from '../utils/schedule';
import { useCurrentLocalDate } from '../utils/useCurrentLocalDate';
import { parseLocalTimeToStandard } from '../utils/localDate';
import { getSmartReminders } from '../utils/reminders';
import { useTranslation } from '../utils/i18n';
import { PrivateClassIntakeModal, PrivateClassIntakeResult } from './PrivateClassIntakeModal';
import { AppIcon } from './ui/AppIcon';
import { useDelayedLoading } from './ui/Skeleton';
import { DashboardContentSkeleton } from './skeletons/ClassySkeletons';

interface DashboardViewProps {
  students: Student[];
  groups: Group[];
  enrollments?: Enrollment[];
  sessions: Session[];
  allAttendance?: Attendance[];
  payments: Payment[];
  teacherProfile: TeacherProfile;
  isLoading?: boolean;
  onOpenAddStudent: () => void;
  onOpenAddGroup: () => void;
  onOpenAddSession: () => void;
  onOpenAddPayment: () => void;
  onOpenStudentProfile: (student: Student) => void;
  onOpenGroupProfile: (group: Group) => void;
  onOpenAttendanceModal: (session: Session) => void;
  onOpenNotificationsModal?: () => void;
  unreadNotificationsCount?: number;
  onNavigateToTab: (tab: ActiveTab) => void;
  onDataChanged?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  students,
  groups,
  enrollments: enrollmentsProp,
  sessions,
  allAttendance: allAttendanceProp,
  payments,
  teacherProfile,
  isLoading = false,
  onOpenAddStudent,
  onOpenAddGroup,
  onOpenAddSession,
  onOpenAddPayment,
  onOpenStudentProfile,
  onOpenGroupProfile,
  onOpenAttendanceModal,
  onOpenNotificationsModal,
  unreadNotificationsCount,
  onNavigateToTab,
  onDataChanged,
}) => {
  const { t, language, isRTL } = useTranslation();
  const isEn = language.startsWith('en');

  const { todayStr, canonicalWeekday, parts } = useCurrentLocalDate();
  const todayArabicDay = useMemo(() => getLocalizedWeekdayName(canonicalWeekday, isRTL), [canonicalWeekday, isRTL]);

  // State for expanded quick attendance cards
  const [expandedAttendanceCardId, setExpandedAttendanceCardId] = useState<string | null>(null);
  const [quickSuccessMsg, setQuickSuccessMsg] = useState<string | null>(null);
  const quickFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (quickFeedbackTimerRef.current !== null) {
        clearTimeout(quickFeedbackTimerRef.current);
        quickFeedbackTimerRef.current = null;
      }
    };
  }, []);

  const showQuickFeedback = useCallback((msg: string) => {
    if (quickFeedbackTimerRef.current !== null) {
      clearTimeout(quickFeedbackTimerRef.current);
    }
    setQuickSuccessMsg(msg);
    quickFeedbackTimerRef.current = setTimeout(() => {
      quickFeedbackTimerRef.current = null;
      setQuickSuccessMsg(null);
    }, 3000);
  }, []);

  // Filter and order today's sessions chronologically by time (earliest to latest) within the day
  const todaySessions = useMemo(() => {
    return sessions
      .filter((s) => s.date === todayStr && s.status !== 'cancelled')
      .sort((a, b) => {
        const timeA = parseTimeToMinutes(a.startTime);
        const timeB = parseTimeToMinutes(b.startTime);
        if (timeA !== timeB) return timeA - timeB;
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      });
  }, [sessions, todayStr]);

  const enrollments = useMemo(
    () => enrollmentsProp ?? db.getEnrollments(),
    [enrollmentsProp, students, groups]
  );
  const allAttendance = useMemo(
    () => allAttendanceProp ?? db.getAttendance(),
    [allAttendanceProp, sessions]
  );

  const studentsById = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((st) => map.set(st.id, st));
    return map;
  }, [students]);

  const recordedSessionIds = useMemo(() => {
    const set = new Set<string>();
    allAttendance.forEach((a) => set.add(a.sessionId));
    return set;
  }, [allAttendance]);

  const operationalTodaySessions = useMemo(() => {
    return todaySessions.filter((s) =>
      isExplicitPrivateSessionOperationalOnDate(
        s,
        todayStr,
        enrollments,
        studentsById,
        recordedSessionIds.has(s.id)
      )
    );
  }, [todaySessions, todayStr, enrollments, studentsById, recordedSessionIds]);

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
  const rawDashboardLoading =
    (isLoading || isSyncing) &&
    students.length === 0 &&
    groups.length === 0 &&
    sessions.length === 0 &&
    payments.length === 0;
  const showDashboardSkeleton = useDelayedLoading(rawDashboardLoading, 90);


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
    return getScheduledClassesForDate(todayStr, groups, enrollments, students);
  }, [todayStr, groups, enrollments, students]);

  // Count of completed sessions today
  const completedTodaySessionsCount = useMemo(() => {
    return operationalTodaySessions.filter((s) => s.status === 'completed').length;
  }, [operationalTodaySessions]);

  const totalTodayClassesCount = useMemo(() => {
    return Math.max(scheduledToday.length, operationalTodaySessions.length);
  }, [scheduledToday.length, operationalTodaySessions.length]);

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
  }, [students, groups, enrollments, sessions, payments, allAttendance]);

  // Smart Reminders
  const smartReminders = useMemo(() => {
    return getSmartReminders(students, groups, sessions, enrollments, allAttendance);
  }, [students, groups, sessions, enrollments, allAttendance]);

  const findSessionForScheduleItem = useCallback((item: ScheduledClassItem): Session | undefined => {
    const itemMins = item.sortMinutes || parseTimeToMinutes(item.rawTime || item.time);
    const candidates = sessions.filter((s) => {
      if (s.date !== todayStr) return false;
      if (s.status === 'cancelled') return false;
      if (item.isPrivate || item.studentId) {
        if (s.studentId !== item.studentId) return false;
      } else {
        if (s.groupId !== item.groupId) return false;
      }

      // Match exact start time (parsed to minutes) to strictly isolate multiple sessions on same day
      const sMins = parseTimeToMinutes(s.startTime);
      return sMins === itemMins;
    });

    if (candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0];

    // Prioritize canonical session: attendance records, completed status, deterministic ID
    const withAttendance = candidates.find((s) => allAttendance.some((a) => a.sessionId === s.id));
    if (withAttendance) return withAttendance;

    const completed = candidates.find((s) => s.status === 'completed');
    if (completed) return completed;

    const deterministic = candidates.find((s) => s.id.startsWith('sess_'));
    if (deterministic) return deterministic;

    return candidates[0];
  }, [sessions, todayStr, allAttendance]);

  // Pure virtual session builder - NO SIDE EFFECTS, NO DATABASE WRITES DURING RENDER
  const buildVirtualSessionForSchedule = (item: ScheduledClassItem): Session => {
    const group = item.groupId ? groups.find((g) => g.id === item.groupId) : undefined;
    const timeInfo = parseLocalTimeToStandard(item.rawTime);
    const rawStartTime = timeInfo.normalizedTime;
    const [h, m] = rawStartTime.split(':').map(Number);
    const endH = !isNaN(h) ? (h + 1) % 24 : 17;
    const endTime = `${String(endH).padStart(2, '0')}:${String(!isNaN(m) ? m : 0).padStart(2, '0')}`;
    const deterministicEntityKey = item.isPrivate
      ? `stu_${item.studentId || 'priv'}`
      : `grp_${item.groupId || 'academic'}`;
    const deterministicId = `sess_${todayStr}_${deterministicEntityKey}_${timeInfo.sortMinutes}`;

    return {
      id: deterministicId,
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

    // Deterministic ID prevents creating multiple duplicate records for the same scheduled occurrence
    const deterministicEntityKey = item.isPrivate
      ? `stu_${item.studentId || 'priv'}`
      : `grp_${item.groupId || 'academic'}`;
    const deterministicId = `sess_${todayStr}_${deterministicEntityKey}_${timeInfo.sortMinutes}`;

    const existingById = sessions.find((s) => s.id === deterministicId) || db.getSessionById(deterministicId);
    if (existingById) return existingById;

    const newSession: Session = {
      id: deterministicId,
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
    item?: ScheduledClassItem;
    session?: Session;
    studentId: string;
  } | null>(null);

  // Canonical classification helper to determine whether an appointment belongs to a private lesson or group session
  const isAppointmentPrivate = useCallback((itemOrSession: ScheduledClassItem | Session): boolean => {
    // 1. Explicit boolean flag on ScheduledClassItem
    if ('isPrivate' in itemOrSession && itemOrSession.isPrivate === true) {
      return true;
    }

    // 2. Individual student assigned
    const studentId = itemOrSession.studentId;
    if (studentId) {
      const enrId = itemOrSession.enrollmentId;
      if (enrId) {
        const enr = enrollments.find((e) => e.id === enrId) || db.getEnrollmentById(enrId);
        if (enr && (enr.serviceType === 'private' || !enr.groupId)) {
          return true;
        }
      }
      const grpId = itemOrSession.groupId;
      if (grpId) {
        const grp = groups.find((g) => g.id === grpId) || db.getGroupById(grpId);
        if (grp?.type === 'private') {
          return true;
        }
        if (grp && grp.type !== 'private') {
          if ('isPrivate' in itemOrSession && itemOrSession.isPrivate === false) {
            return false;
          }
        }
      }
      return true;
    }

    // 3. Enrollment serviceType check
    if (itemOrSession.enrollmentId) {
      const enr = enrollments.find((e) => e.id === itemOrSession.enrollmentId) || db.getEnrollmentById(itemOrSession.enrollmentId);
      if (enr && (enr.serviceType === 'private' || !enr.groupId)) {
        return true;
      }
    }

    // 4. Group type check
    if (itemOrSession.groupId) {
      const grp = groups.find((g) => g.id === itemOrSession.groupId) || db.getGroupById(itemOrSession.groupId);
      if (grp?.type === 'private') {
        return true;
      }
      if (grp && grp.type !== 'private') {
        return false;
      }
    }

    return false;
  }, [enrollments, groups]);

  // Centralized session tap router:
  // - Private lessons ALWAYS route to PrivateClassIntakeModal without saving uncommitted sessions to DB
  // - Genuine group sessions route to group attendance modal (RecordAttendanceModal)
  const handleSessionCardClick = useCallback((
    itemOrSession: ScheduledClassItem | Session,
    persistedSession?: Session
  ) => {
    const isPrivate = isAppointmentPrivate(itemOrSession);

    if (isPrivate) {
      const studentId =
        itemOrSession.studentId ||
        ('student' in itemOrSession && itemOrSession.student?.id) ||
        ('studentName' in itemOrSession && itemOrSession.studentName ? students.find((s) => s.name === itemOrSession.studentName)?.id : '') ||
        '';

      if (!studentId) return;

      const scheduleItem: ScheduledClassItem | undefined = 'isPrivate' in itemOrSession ? itemOrSession : undefined;
      const existingSession: Session | undefined =
        persistedSession ||
        ('status' in itemOrSession && !('isPrivate' in itemOrSession) ? itemOrSession : undefined) ||
        (scheduleItem ? findSessionForScheduleItem(scheduleItem) : undefined);

      setPrivateIntakeTarget({
        item: scheduleItem,
        session: existingSession,
        studentId,
      });
    } else {
      const scheduleItem: ScheduledClassItem | undefined = 'isPrivate' in itemOrSession ? itemOrSession : undefined;
      const existingSession: Session | undefined =
        persistedSession ||
        ('status' in itemOrSession && !('isPrivate' in itemOrSession) ? itemOrSession : undefined) ||
        (scheduleItem ? findSessionForScheduleItem(scheduleItem) : undefined);

      if (existingSession) {
        onOpenAttendanceModal(existingSession);
      } else if (scheduleItem) {
        const session = getOrCreateSessionForSchedule(scheduleItem);
        onOpenAttendanceModal(session);
      }
    }
  }, [isAppointmentPrivate, students, findSessionForScheduleItem, onOpenAttendanceModal, getOrCreateSessionForSchedule]);

  const handleMarkAllPresent = useCallback((item: ScheduledClassItem) => {
    // If it is a private lesson, open PrivateClassIntakeModal to ask the teacher what the intake was
    if (isAppointmentPrivate(item)) {
      handleSessionCardClick(item);
      return;
    }

    // Standard Group Logic (filtering roster to students active today)
    const session = getOrCreateSessionForSchedule(item);
    const groupStudents = db.getGroupStudents(item.groupId, todayStr);

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
  }, [isAppointmentPrivate, handleSessionCardClick, getOrCreateSessionForSchedule, enrollments, isEn, onDataChanged, todayStr]);

  const handleQuickStudentAttendance = (
    item: ScheduledClassItem,
    studentId: string,
    status: AttendanceStatus,
    isCharged: boolean = true
  ) => {
    // If it is a private lesson and marked present, ask for intake
    if (isAppointmentPrivate(item) && status === 'present') {
      handleSessionCardClick(item);
      return;
    }

    const session = getOrCreateSessionForSchedule(item);
    const enr = enrollments.find(
      (e) => e.studentId === studentId && (e.groupId === item.groupId || e.id === item.enrollmentId)
    );

    const existingAtt = db.getSessionAttendance(session.id).find((a) => a.studentId === studentId);
    const record: Attendance = {
      ...existingAtt,
      id: existingAtt?.id || `att_${session.id}_${studentId}`,
      sessionId: session.id,
      studentId,
      enrollmentId: enr?.id || item.enrollmentId,
      status,
      isCharged,
      recordedAt: existingAtt?.recordedAt || new Date().toISOString(),
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
    const { item, session: targetSession, studentId } = privateIntakeTarget;
    const session = targetSession || (item ? getOrCreateSessionForSchedule(item) : null);
    if (!session) return;
    const enr =
      enrollments.find(
        (e) =>
          e.studentId === studentId &&
          ((item && (e.groupId === item.groupId || e.id === item.enrollmentId)) ||
           (session && (e.groupId === session.groupId || e.id === session.enrollmentId)))
      ) ||
      enrollments.find((e) => e.studentId === studentId && (e.serviceType === 'private' || !e.groupId)) ||
      enrollments.find((e) => e.studentId === studentId);

    const isHourly =
      (item && (item.group?.billingMode === 'hourly' || item.group?.billingType === 'hourly')) ||
      session.isHourly ||
      enr?.billingMode === 'hourly' ||
      enr?.billingType === 'hourly';

    const finalStatus = result.attendanceStatus || 'present';
    const isCharged = result.isCharged !== undefined ? result.isCharged : (finalStatus !== 'absent_free');
    const existingAtt = db.getSessionAttendance(session.id).find((a) => a.studentId === studentId);

    const record: Attendance = {
      ...existingAtt,
      id: existingAtt?.id || `att_${session.id}_${studentId}`,
      sessionId: session.id,
      studentId,
      enrollmentId: enr?.id || item?.enrollmentId || session.enrollmentId,
      status: finalStatus,
      isCharged,
      sessionUnits: isHourly ? undefined : result.sessionUnits,
      hours: isHourly ? result.hours : undefined,
      notes: result.notes,
      behaviorRating: result.behaviorRating,
      homeworkRating: result.homeworkRating,
      absenceReason: finalStatus === 'absent_free' ? (result.notes || (isEn ? 'Uncharged Absence' : 'غياب غير محسوب')) : undefined,
      recordedAt: existingAtt?.recordedAt || new Date().toISOString(),
    };

    db.saveSession({
      ...session,
      status: 'completed',
      sessionUnits: isHourly ? undefined : result.sessionUnits,
      hours: isHourly ? result.hours : undefined,
      pricePerStudent: result.pricePerStudent,
      notes: result.notes !== undefined ? result.notes : session.notes,
    });
    db.saveAttendanceBatch(session.id, [record]);

    const qtyText = formatSessionQuantityDisplay({
      sessionUnits: result.sessionUnits,
      hours: result.hours,
      isHourly,
    }, isRTL);

    const studentObj = students.find((s) => s.id === studentId) || db.getStudentById(studentId);
    const displayName = item?.studentName || studentObj?.name || session.title || '';
    const feedbackMsg =
      finalStatus === 'present'
        ? (isEn ? `Recorded ${qtyText} for ${displayName}` : `تم تسجيل حضور ${qtyText} للطالب ${displayName}`)
        : finalStatus === 'absent_charged'
        ? (isEn ? `Recorded charged absence (${qtyText}) for ${displayName}` : `تم تسجيل غياب محسوب (${qtyText}) للطالب ${displayName}`)
        : (isEn ? `Recorded uncharged absence for ${displayName}` : `تم تسجيل غياب غير محسوب للطالب ${displayName}`);

    showQuickFeedback(feedbackMsg);
    setPrivateIntakeTarget(null);
    onDataChanged?.();
  };

  // Comprehensive list of items to display on today's schedule (scheduled recurring + explicit ad-hoc)
  const allTodayDisplayItems = useMemo(() => {
    const list: ScheduledClassItem[] = [...scheduledToday];

    // Track unique occurrences using deterministic occurrence identity
    // For private: priv_${studentId}_${sortMinutes}
    // For group: grp_${groupId}_${sortMinutes}
    const representedOccurrences = new Set<string>();
    list.forEach((item) => {
      const itemMins = item.sortMinutes || parseTimeToMinutes(item.rawTime || item.time);
      const occKey = (item.isPrivate || item.studentId)
        ? `priv_${item.studentId || 'unknown'}_${itemMins}`
        : `grp_${item.groupId || 'unknown'}_${itemMins}`;
      representedOccurrences.add(occKey);
    });

    operationalTodaySessions.forEach((s) => {
      if (s.status === 'cancelled') return;
      const sMins = parseTimeToMinutes(s.startTime || '16:00');
      const isPrivate = !s.groupId || !!s.studentId;
      const occKey = isPrivate
        ? `priv_${s.studentId || 'unknown'}_${sMins}`
        : `grp_${s.groupId || 'unknown'}_${sMins}`;

      if (!representedOccurrences.has(occKey)) {
        representedOccurrences.add(occKey);
        const group = groups.find((g) => g.id === s.groupId);
        const student = s.studentId ? students.find((st) => st.id === s.studentId) : undefined;
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
          sortMinutes: sMins,
          location: group?.roomOrLocation,
          accentColor: group?.accentColor || (isPrivate ? '#0F2A4A' : '#17375E'),
        });
      }
    });

    list.sort((a, b) => a.sortMinutes - b.sortMinutes);
    return list;
  }, [scheduledToday, operationalTodaySessions, groups, students, isRTL, isEn, todayArabicDay]);


  // Next pending session for the "Start session" quick action (PURE - ZERO DB SIDE EFFECTS DURING RENDER)
  const nextPendingSession = useMemo(() => {
    const scheduledExisting = operationalTodaySessions.find((s) => s.status === 'scheduled');
    if (scheduledExisting) return scheduledExisting;

    const pendingItem = allTodayDisplayItems.find((item) => {
      const matching = findSessionForScheduleItem(item);
      return !matching || matching.status === 'scheduled';
    });
    if (pendingItem) {
      const matching = findSessionForScheduleItem(pendingItem);
      if (matching) return matching;
      return buildVirtualSessionForSchedule(pendingItem);
    }

    return null;
  }, [operationalTodaySessions, allTodayDisplayItems, groups, students, parts, todayStr]);

  const handleStartNextSession = () => {
    if (!nextPendingSession) return;
    handleSessionCardClick(nextPendingSession);
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

  const focusStudent1 = useMemo(() => {
    if (!focusSession1) return null;
    const sId = focusSession1.studentId || (focusSession1.isPrivate ? focusSession1.student?.id : '');
    if (sId) {
      return students.find((s) => s.id === sId) || db.getStudentById(sId) || focusSession1.student || null;
    }
    return focusSession1.student || null;
  }, [focusSession1, students]);

  const focusStudent2 = useMemo(() => {
    if (!focusSession2) return null;
    const sId = focusSession2.studentId || (focusSession2.isPrivate ? focusSession2.student?.id : '');
    if (sId) {
      return students.find((s) => s.id === sId) || db.getStudentById(sId) || focusSession2.student || null;
    }
    return focusSession2.student || null;
  }, [focusSession2, students]);

  const focusProgression1 = useMemo(
    () => (focusStudent1 ? getStudentProgression(focusStudent1) : null),
    [focusStudent1, allAttendance, sessions]
  );

  const focusProgression2 = useMemo(
    () => (focusStudent2 ? getStudentProgression(focusStudent2) : null),
    [focusStudent2, allAttendance, sessions]
  );

  const focusFrameTheme1 = useMemo(() => {
    if (!focusSession1?.isPrivate || !focusStudent1) return null;
    return getStudentFrameCardTheme(focusStudent1);
  }, [focusSession1, focusStudent1, allAttendance, sessions]);

  const focusFrameTheme2 = useMemo(() => {
    if (!focusSession2?.isPrivate || !focusStudent2) return null;
    return getStudentFrameCardTheme(focusStudent2);
  }, [focusSession2, focusStudent2, allAttendance, sessions]);

  // Unrecorded sessions today for Today's Focus Row 2
  const unrecordedTodaySessions = useMemo(() => {
    return allTodayDisplayItems.filter((item) => {
      const matching = findSessionForScheduleItem(item);
      if (!matching) return true;
      const att = db.getSessionAttendance(matching.id);
      return att.length === 0 || matching.status === 'scheduled';
    });
  }, [allTodayDisplayItems, sessions, allAttendance]);

  const handleAttendanceToRecordClick = () => {
    if (unrecordedTodaySessions.length > 0) {
      handleSessionCardClick(unrecordedTodaySessions[0]);
    } else {
      onNavigateToTab('sessions');
    }
  };

  const handlePaymentsDueClick = () => {
    onNavigateToTab('reports');
  };

  // Today's students who owe money (مديونيات حصص اليوم)
  const todayDebtors = useMemo(() => {
    const studentIdsWithLessonsToday = new Set<string>();

    allTodayDisplayItems.forEach((item) => {
      if (item.isPrivate || item.studentId) {
        if (item.studentId) {
          studentIdsWithLessonsToday.add(item.studentId);
        } else if (item.student?.id) {
          studentIdsWithLessonsToday.add(item.student.id);
        }
      } else if (item.groupId) {
        const groupStudents = db.getGroupStudents(item.groupId, todayStr);
        groupStudents.forEach((st) => {
          if (st.status !== 'archived') {
            studentIdsWithLessonsToday.add(st.id);
          }
        });
      }
    });

    operationalTodaySessions.forEach((s) => {
      if (s.status === 'cancelled') return;
      if (s.studentId) {
        studentIdsWithLessonsToday.add(s.studentId);
      } else if (s.groupId) {
        const groupStudents = db.getGroupStudents(s.groupId, todayStr);
        groupStudents.forEach((st) => {
          if (st.status !== 'archived') {
            studentIdsWithLessonsToday.add(st.id);
          }
        });
      }
    });

    const results: { student: Student; remaining: number }[] = [];

    studentIdsWithLessonsToday.forEach((studentId) => {
      const student = students.find((s) => s.id === studentId) || db.getStudentById(studentId);
      if (!student || student.status === 'archived') return;

      const grandFinancials = db.calculateStudentGrandFinancials(studentId);
      const remaining = grandFinancials ? grandFinancials.grandRemaining : 0;

      if (remaining > 0) {
        results.push({
          student,
          remaining,
        });
      }
    });

    results.sort((a, b) => b.remaining - a.remaining);
    return results;
  }, [allTodayDisplayItems, operationalTodaySessions, todayStr, students, groups, enrollments, sessions, payments, allAttendance]);

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
        unreadCount={unreadNotificationsCount ?? smartReminders.filter((r) => !r.isRead).length}
        onOpenNotifications={onOpenNotificationsModal}
        onOpenSettings={onNavigateToTab ? () => onNavigateToTab('settings') : undefined}
      />

      {/* Quick Success Toast */}
      <Toast
        isOpen={Boolean(quickSuccessMsg)}
        message={quickSuccessMsg || ''}
        type="success"
        onClose={() => setQuickSuccessMsg(null)}
      />

      {showDashboardSkeleton ? (
        <DashboardContentSkeleton />
      ) : (
        <>
          {/* 2. Today's Progress NavyCard (Daily Goal Card) */}
          <NavyCard data-tutorial-id="dashboard-progress-card" className="relative">
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

          {/* 1. Today's Focus Section Header */}
          <div className="space-y-3 pt-1">
        <SectionHeader
          title={t('todaysFocus') || (isEn ? "Today's Focus" : 'تركيزك اليوم')}
        />

        {/* 2. 2x2 Grid of MintCards */}
        <div data-tutorial-id="dashboard-focus-grid" className="grid grid-cols-2 gap-4">
          {/* Row 1, Card 1: First pending/next session */}
          {focusSession1 ? (
            <MintCard
              key={focusSession1.id || 'focus-1'}
              clickable
              onClick={() => {
                handleSessionCardClick(focusSession1);
              }}
              style={{ animationDelay: '0ms' }}
              className={`animate-tile-stagger min-h-[168px] relative overflow-hidden flex flex-col justify-between p-4 group transition-all duration-150 ${
                focusFrameTheme1
                  ? `${focusFrameTheme1.cardBgClass} ${focusFrameTheme1.cardBorderClass}`
                  : ''
              }`}
            >
              {/* Subtle frame corner watermark */}
              {focusFrameTheme1 && (
                <FrameCornerWatermark patternType={focusFrameTheme1.patternType} />
              )}

              <div className="relative z-10 space-y-1.5">
                <div className="flex items-center gap-2.5">
                  {focusStudent1 && (
                    <div className="shrink-0 gaming-frame-interactive transition-transform group-hover:scale-108 hover:scale-115">
                      <StudentAvatar
                        student={focusStudent1}
                        size="sm"
                        showFrame={true}
                        className="shrink-0"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <h3 className="t-card text-navy font-bold line-clamp-2 leading-snug">
                      {focusSession1.isPrivate
                        ? (focusSession1.studentName || (isEn ? 'Private Lesson' : 'درس خاص'))
                        : focusSession1.groupName}
                    </h3>
                  </div>
                </div>
                <p className="text-[13px] text-slate font-medium tabular-nums">
                  {focusSession1.time}
                  {focusSession1.isPrivate && focusProgression1 && (
                    <span>
                      {' · '}
                      {isEn
                        ? focusProgression1.frameDef.shortLabelEn
                        : focusProgression1.frameDef.shortLabelAr}
                    </span>
                  )}
                </p>
              </div>

              <div className="absolute -bottom-1 end-[-8px] w-28 h-24 pointer-events-none select-none opacity-90">
                <TeacherBoard className="w-full h-full object-contain" />
              </div>
            </MintCard>
          ) : (
            <MintCard
              key="focus-empty-1"
              style={{ animationDelay: '0ms' }}
              className="animate-tile-stagger min-h-[168px] relative overflow-hidden flex flex-col justify-between p-4"
            >
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
              key={focusSession2.id || 'focus-2'}
              clickable
              onClick={() => {
                handleSessionCardClick(focusSession2);
              }}
              style={{ animationDelay: '18ms' }}
              className={`animate-tile-stagger min-h-[168px] relative overflow-hidden flex flex-col justify-between p-4 group transition-all duration-150 ${
                focusFrameTheme2
                  ? `${focusFrameTheme2.cardBgClass} ${focusFrameTheme2.cardBorderClass}`
                  : ''
              }`}
            >
              {/* Subtle frame corner watermark */}
              {focusFrameTheme2 && (
                <FrameCornerWatermark patternType={focusFrameTheme2.patternType} />
              )}

              <div className="relative z-10 space-y-1.5">
                <div className="flex items-center gap-2.5">
                  {focusStudent2 && (
                    <div className="shrink-0 gaming-frame-interactive transition-transform group-hover:scale-108 hover:scale-115">
                      <StudentAvatar
                        student={focusStudent2}
                        size="sm"
                        showFrame={true}
                        className="shrink-0"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <h3 className="t-card text-navy font-bold line-clamp-2 leading-snug">
                      {focusSession2.isPrivate
                        ? (focusSession2.studentName || (isEn ? 'Private Lesson' : 'درس خاص'))
                        : focusSession2.groupName}
                    </h3>
                  </div>
                </div>
                <p className="text-[13px] text-slate font-medium tabular-nums">
                  {focusSession2.time}
                  {focusSession2.isPrivate && focusProgression2 && (
                    <span>
                      {' · '}
                      {isEn
                        ? focusProgression2.frameDef.shortLabelEn
                        : focusProgression2.frameDef.shortLabelAr}
                    </span>
                  )}
                </p>
              </div>

              <div className="absolute -bottom-1 end-[-8px] w-28 h-24 pointer-events-none select-none opacity-90">
                <StudentReading className="w-full h-full object-contain" />
              </div>
            </MintCard>
          ) : (
            <MintCard
              key="focus-empty-2"
              style={{ animationDelay: '18ms' }}
              className="animate-tile-stagger min-h-[168px] relative overflow-hidden flex flex-col justify-between p-4"
            >
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
            key="payments-due"
            clickable
            onClick={handlePaymentsDueClick}
            style={{ animationDelay: '36ms' }}
            className="animate-tile-stagger min-h-[104px] relative overflow-hidden flex flex-col justify-between p-3.5"
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
            key="attendance-to-record"
            clickable
            onClick={handleAttendanceToRecordClick}
            style={{ animationDelay: '54ms' }}
            className="animate-tile-stagger min-h-[104px] relative overflow-hidden flex flex-col justify-between p-3.5"
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
          onTapSession={handleSessionCardClick}
          onOpenStudentProfile={onOpenStudentProfile}
          onOpenGroupProfile={onOpenGroupProfile}
          onOpenAddSession={onOpenAddSession}
        />
      </div>

      {/* 4. Today's Students with Debt (مديونيات حصص اليوم) */}
      <div className="space-y-3 pt-1">
        <SectionHeader
          title={isEn ? "Today's Session Debts" : "مديونيات حصص اليوم"}
          seeAllLabel={todayDebtors.length > 0 ? (t('navStudents') || (isEn ? 'All students' : 'جميع الطلاب')) : undefined}
          onSeeAll={todayDebtors.length > 0 ? () => onNavigateToTab('students') : undefined}
        />

        {todayDebtors.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {todayDebtors.map(({ student, remaining }) => {
              const stProg = getStudentProgression(student);
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => onOpenStudentProfile(student)}
                  className="animate-tile-stagger p-3 rounded-2xl bg-mint-soft hover:bg-mint border border-line shadow-2xs flex items-center gap-2.5 text-start cursor-pointer active:scale-[0.985] transition-transform duration-120 select-none group min-h-[72px] w-full will-change-transform"
                >
                  <StudentAvatar
                    student={student}
                    size="xs"
                    showFrame={true}
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[13px] font-black text-navy truncate w-full block group-hover:text-navy/80 transition-colors">
                      {student.name}
                    </span>
                    <span className="text-[11px] font-medium text-slate truncate block mt-0.5 tabular-nums">
                      {isEn ? stProg.frameDef.shortLabelEn : stProg.frameDef.shortLabelAr}
                      {' · '}
                      <strong className="text-xs font-black text-navy">{remaining}</strong>{' '}
                      {t('currency') || 'ج.م'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-mint-soft/40 border border-line text-center">
            <p className="text-xs font-bold text-slate">
              {isEn ? "No outstanding debts for today's students" : 'لا توجد مديونيات لطلبة لديهم حصص اليوم'}
            </p>
          </div>
        )}
      </div>
        </>
      )}

      {/* Private Class Intake Modal */}
      {privateIntakeTarget && (
        <PrivateClassIntakeModal
          isOpen={!!privateIntakeTarget}
          onClose={() => setPrivateIntakeTarget(null)}
          student={students.find((s) => s.id === privateIntakeTarget.studentId) || db.getStudentById(privateIntakeTarget.studentId) || null}
          enrollment={
            enrollments.find(
              (e) =>
                e.studentId === privateIntakeTarget.studentId &&
                ((privateIntakeTarget.item && (e.groupId === privateIntakeTarget.item.groupId || e.id === privateIntakeTarget.item.enrollmentId)) ||
                 (privateIntakeTarget.session && (e.groupId === privateIntakeTarget.session.groupId || e.id === privateIntakeTarget.session.enrollmentId)))
            ) ||
            enrollments.find((e) => e.studentId === privateIntakeTarget.studentId && (e.serviceType === 'private' || !e.groupId)) ||
            null
          }
          session={privateIntakeTarget.session || (privateIntakeTarget.item ? findSessionForScheduleItem(privateIntakeTarget.item) : null)}
          onConfirm={handleConfirmPrivateIntake}
        />
      )}
    </div>
  );
};
