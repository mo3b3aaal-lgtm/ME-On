import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSwipeGesture } from '../utils/useSwipeGesture';
import { BottomSheet } from './ui/BottomSheet';
import {
  Student,
  Group,
  Enrollment,
  Payment,
  Attendance,
  Session,
  SessionStatus,
  AttendanceStatus,
  BillingMode,
  StudentGrandFinancialSummary,
  StudentBehaviorLog,
  BehaviorCategory,
  getBehaviorRatingLabel,
  getHomeworkRatingLabel,
} from '../types';
import {
  db,
  getArabicMonthName,
  getBillingModeLabel,
  divideMoney,
  multiplyMoney,
  roundMoney,
  getSessionLessonQuantity,
  formatSessionQuantityDisplay,
} from '../utils/storage';
import { StudentAvatar } from './StudentAvatar';
import { getStudentProgression, getProgressWidthClass } from '../utils/studentProgression';
import { RecordPrivateSessionModal } from './RecordPrivateSessionModal';
import { parseLocalDateStr } from '../utils/localDate';
import { QuickBehaviorLogModal } from './QuickBehaviorLogModal';
import { SafeDeleteStudentModal } from './SafeDeleteStudentModal';
import { getLocalizedStageName } from '../utils/stages';
import {
  getUpcomingClassesForStudent,
  UpcomingStudentClass,
  formatTimeDisplay,
  parseTimeToMinutes,
  getStudentEffectiveSchedule,
  getEnrollmentDateStatus,
  getEffectiveEnrollmentPeriod,
  validateEnrollmentPeriod,
  isExplicitPrivateSessionOperationalOnDate,
} from '../utils/schedule';
import {
  EnrollmentPeriodFields,
  EnrollmentPeriodFormValue,
  sanitizePeriodForPersistence,
} from './EnrollmentPeriodFields';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import {
  calculateStudentBehaviorStats,
  formatBehaviorTime,
  getCategoryBadge,
} from '../utils/behavior';
import { useTranslation } from '../utils/i18n';
import { StatusBadge } from './ui/StatusBadge';
import { AppIcon } from './ui/AppIcon';
import { WhiteCard } from './ui/WhiteCard';
import { MintCard } from './ui/MintCard';
import { ProgressRing } from './ui/ProgressRing';
import { useCurrentLocalDate } from '../utils/useCurrentLocalDate';
import { PrivateClassIntakeModal, PrivateClassIntakeResult } from './PrivateClassIntakeModal';

/**
 * Normalizes date and time strings into a reliable Unix epoch timestamp (ms).
 * Handles YYYY-MM-DD, YYYY/MM/DD, ISO timestamps, and 12/24-hour time formats.
 * Safely returns 0 for invalid/missing dates to ensure stable sorting without crashing.
 */
function getChronologicalTimestamp(
  dateStr?: string | null,
  timeStr?: string | null,
  fallbackIso?: string | null
): number {
  let year = 0;
  let month = 0;
  let day = 0;
  let hasValidDate = false;

  if (dateStr && typeof dateStr === 'string' && dateStr.trim()) {
    const trimmed = dateStr.trim();
    const dateMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (dateMatch) {
      year = parseInt(dateMatch[1], 10);
      month = parseInt(dateMatch[2], 10) - 1;
      day = parseInt(dateMatch[3], 10);
      hasValidDate = true;
    } else {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        year = d.getFullYear();
        month = d.getMonth();
        day = d.getDate();
        hasValidDate = true;
      }
    }
  }

  if (!hasValidDate && fallbackIso && typeof fallbackIso === 'string' && fallbackIso.trim()) {
    const d = new Date(fallbackIso.trim());
    if (!isNaN(d.getTime())) {
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
      hasValidDate = true;
    }
  }

  if (!hasValidDate) {
    return 0;
  }

  let timeMinutes = 0;
  if (timeStr && typeof timeStr === 'string' && timeStr.trim()) {
    const parsedMins = parseTimeToMinutes(timeStr);
    if (parsedMins !== 99999) {
      timeMinutes = parsedMins;
    }
  } else if (fallbackIso && typeof fallbackIso === 'string' && fallbackIso.includes('T')) {
    const d = new Date(fallbackIso.trim());
    if (!isNaN(d.getTime())) {
      timeMinutes = d.getHours() * 60 + d.getMinutes();
    }
  }

  const dateObj = new Date(year, month, day, Math.floor(timeMinutes / 60), timeMinutes % 60, 0, 0);
  const ts = dateObj.getTime();
  return isNaN(ts) ? 0 : ts;
}

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  allGroups: Group[];
  domainRevision?: number;
  onEditStudent: (student: Student) => void;
  onOpenEnrollModal: (student: Student) => void;
  onOpenAddPayment: (student: Student, enrollmentId?: string) => void;
  onDataChanged: () => void;
}

type StudentProfileSubTab =
  | 'overview'
  | 'groups'
  | 'private'
  | 'finances'
  | 'attendance'
  | 'behavior'
  | 'history'
  | 'credit_logs';

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  isOpen,
  onClose,
  student,
  allGroups,
  domainRevision = 0,
  onEditStudent,
  onOpenEnrollModal,
  onOpenAddPayment,
  onDataChanged,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');

  const [activeSubTab, setActiveSubTab] = useState<StudentProfileSubTab>('overview');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'group' | 'private'>('all');
  const [isRecordPrivateModalOpen, setIsRecordPrivateModalOpen] = useState<boolean>(false);
  const [isQuickBehaviorModalOpen, setIsQuickBehaviorModalOpen] = useState<boolean>(false);
  const [behaviorFilterCategory, setBehaviorFilterCategory] = useState<
    'all' | 'positive' | 'needs_improvement' | 'neutral'
  >('all');
  const [behaviorSearchQuery, setBehaviorSearchQuery] = useState<string>('');
  const [behaviorSelectedTag, setBehaviorSelectedTag] = useState<string>('all');
  const [isAddingPrivateService, setIsAddingPrivateService] = useState<boolean>(false);
  const [newPrivateSubject, setNewPrivateSubject] = useState<string>(isEn ? 'Private Lesson' : 'درس خاص');
  const [newPrivatePrice, setNewPrivatePrice] = useState<number>(100);
  const [newPrivateHourlyRate, setNewPrivateHourlyRate] = useState<number>(150);
  const [newPrivateBillingMode, setNewPrivateBillingMode] = useState<BillingMode>('postpaid');
  const [newPrivatePackageSessions, setNewPrivatePackageSessions] = useState<number>(10);
  const [newPrivatePackagePrice, setNewPrivatePackagePrice] = useState<number>(1000);
  const [newPrivateDays, setNewPrivateDays] = useState<string[]>(['Saturday']);
  const [newPrivateTime, setNewPrivateTime] = useState<string>('16:00');
  const [newPrivateLocation, setNewPrivateLocation] = useState<string>(isEn ? "Student's Home" : 'منزل الطالب');

  // Student persistent teacher notes
  const [notesText, setNotesText] = useState<string>('');
  const [isNotesSaved, setIsNotesSaved] = useState<boolean>(false);
  const notesSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (notesSavedTimerRef.current !== null) {
      clearTimeout(notesSavedTimerRef.current);
      notesSavedTimerRef.current = null;
    }
    if (student) {
      setNotesText(student.notes || '');
      setIsNotesSaved(false);
    }
    return () => {
      if (notesSavedTimerRef.current !== null) {
        clearTimeout(notesSavedTimerRef.current);
        notesSavedTimerRef.current = null;
      }
    };
  }, [isOpen, student?.id, student?.notes]);

  const handleSaveNotes = () => {
    if (!student) return;
    const updated = {
      ...student,
      notes: notesText.trim(),
    };
    db.saveStudent(updated);
    setIsNotesSaved(true);
    if (notesSavedTimerRef.current !== null) {
      clearTimeout(notesSavedTimerRef.current);
    }
    notesSavedTimerRef.current = setTimeout(() => {
      notesSavedTimerRef.current = null;
      setIsNotesSaved(false);
    }, 2500);
    onDataChanged();
  };

  // Edit enrollment billing & operational period state
  const [editingEnrollmentId, setEditingEnrollmentId] = useState<string | null>(null);
  const [editBillingMode, setEditBillingMode] = useState<BillingMode>('prepaid');
  const [editCustomPrice, setEditCustomPrice] = useState<number>(100);
  const [editHourlyRate, setEditHourlyRate] = useState<number>(150);
  const [editPackagePrice, setEditPackagePrice] = useState<number>(900);
  const [editPackageSessions, setEditPackageSessions] = useState<number>(10);
  const [editPeriodValue, setEditPeriodValue] = useState<EnrollmentPeriodFormValue>({
    startDate: undefined,
    endDate: undefined,
    vacationPeriods: [],
  });
  const [editPeriodError, setEditPeriodError] = useState<string | null>(null);

  // Load relations and calculated financials (Memoized to guarantee instant tab switches & zero lag)
  const studentId = student?.id;
  const [profileDataVersion, setProfileDataVersion] = useState(0);
  const studentGroups = useMemo(
    () => (studentId ? db.getStudentGroups(studentId) : []),
    [studentId, isOpen, profileDataVersion, domainRevision]
  );
  const enrollments = useMemo(
    () => (studentId ? db.getEnrollments() : []),
    [studentId, isOpen, profileDataVersion, domainRevision]
  );

  const grandFinancials: StudentGrandFinancialSummary = useMemo(() => {
    if (!studentId) {
      return {
        studentId: '',
        studentName: '',
        grandTotalDue: 0,
        grandTotalPaid: 0,
        grandRemaining: 0,
        totalSessionCredit: 0,
        totalUnpaidSessions: 0,
        totalFinancialCredit: 0,
        groupsFinancials: {
          totalDue: 0,
          totalPaid: 0,
          remaining: 0,
          totalUnpaidSessions: 0,
          totalSessionCredit: 0,
          totalFinancialCredit: 0,
          enrollments: [],
        },
        privateFinancials: {
          totalDue: 0,
          totalPaid: 0,
          remaining: 0,
          totalUnpaidSessions: 0,
          totalSessionCredit: 0,
          totalFinancialCredit: 0,
          enrollments: [],
        },
        hasGroupService: false,
        hasPrivateService: false,
        enrollmentsSummary: [],
        allPayments: [],
      };
    }
    return db.calculateStudentGrandFinancials(studentId);
  }, [studentId, isOpen, profileDataVersion, domainRevision]);

  const allPayments = grandFinancials.allPayments;
  const attendanceList = useMemo(
    () => (studentId && isOpen ? db.getStudentAttendance(studentId) : []),
    [studentId, isOpen, profileDataVersion, domainRevision]
  );
  const allSessions = useMemo(
    () => (studentId && isOpen ? db.getSessions() : []),
    [studentId, isOpen, profileDataVersion, domainRevision]
  );
  const sessionsById = useMemo(() => new Map(allSessions.map((s) => [s.id, s])), [allSessions]);
  const groupsById = useMemo(() => new Map(allGroups.map((g) => [g.id, g])), [allGroups]);
  const studentGroupIds = useMemo(() => new Set(studentGroups.map((g) => g.group.id)), [studentGroups]);

  interface StudentSessionHistoryItem {
    id: string;
    attendance?: Attendance;
    session?: Session;
    dateStr: string;
    timeDisplay: string;
    isPrivate: boolean;
    status: AttendanceStatus | SessionStatus;
    isAbsentCharged: boolean;
    isAbsentFree: boolean;
    isExcused: boolean;
    isPresent: boolean;
    isLate: boolean;
    isUnpaid: boolean;
    title: string;
    sortTimestamp: number;
  }

  // Complete session history sorted strictly chronologically (newest to oldest)
  const sortedSessionHistory = useMemo((): StudentSessionHistoryItem[] => {
    if (!studentId || !isOpen) return [];

    const entries: StudentSessionHistoryItem[] = [];
    const representedSessionIds = new Set<string>();

    attendanceList.forEach((att) => {
      const session = sessionsById.get(att.sessionId);
      if (session) {
        representedSessionIds.add(session.id);
      }

      const rawDate = session?.date || (att.recordedAt ? att.recordedAt.split('T')[0] : '');
      const rawTime = session?.startTime || '';
      const sortTimestamp = getChronologicalTimestamp(rawDate, rawTime, att.recordedAt || session?.createdAt);

      const isPrivate = !!session?.studentId || (session ? !session.groupId : false);
      const isAbsentCharged = att.status === 'absent_charged' || (att.status === 'absent' && att.isCharged !== false);
      const isAbsentFree = att.status === 'absent_free' || (att.status === 'absent' && att.isCharged === false);
      const isExcused = att.status === 'excused';
      const isPresent = att.status === 'present';
      const isLate = att.status === 'late';
      const isUnpaid = att.paymentStatus === 'unpaid' || att.paymentOverride === 'unpaid' || att.isPaid === false;
      const title = session?.title || (isPrivate ? (isEn ? 'Private Lesson' : 'درس خاص') : (isEn ? 'Group Class' : 'حصة مجموعة'));
      const timeDisplay = rawTime ? formatTimeDisplay(rawTime, isRTL) : '';

      entries.push({
        id: att.id,
        attendance: att,
        session,
        dateStr: rawDate,
        timeDisplay,
        isPrivate,
        status: att.status,
        isAbsentCharged,
        isAbsentFree,
        isExcused,
        isPresent,
        isLate,
        isUnpaid,
        title,
        sortTimestamp,
      });
    });

    // Also include any private sessions directly assigned to this student without an attendance record yet
    const studentMapForSessionFilter = new Map<string, Student>();
    if (student) studentMapForSessionFilter.set(student.id, student);

    allSessions.forEach((s) => {
      if (s.studentId === studentId && !representedSessionIds.has(s.id)) {
        if (
          s.date &&
          !isExplicitPrivateSessionOperationalOnDate(
            s,
            s.date,
            enrollments,
            studentMapForSessionFilter,
            false
          )
        ) {
          return;
        }
        representedSessionIds.add(s.id);
        const rawDate = s.date || '';
        const rawTime = s.startTime || '';
        const sortTimestamp = getChronologicalTimestamp(rawDate, rawTime, s.createdAt);

        entries.push({
          id: `ses_${s.id}`,
          session: s,
          dateStr: rawDate,
          timeDisplay: rawTime ? formatTimeDisplay(rawTime, isRTL) : '',
          isPrivate: true,
          status: s.status,
          isAbsentCharged: false,
          isAbsentFree: false,
          isExcused: false,
          isPresent: s.status === 'completed',
          isLate: false,
          isUnpaid: true,
          title: s.title || (isEn ? 'Private Lesson' : 'درس خاص'),
          sortTimestamp,
        });
      }
    });

    // Stable, non-mutating sort: Newest to oldest (descending)
    // Same-date sessions are sorted by their actual time (latest first).
    return entries.sort((a, b) => {
      if (b.sortTimestamp !== a.sortTimestamp) {
        return b.sortTimestamp - a.sortTimestamp;
      }
      const secondaryA = a.attendance?.recordedAt || a.session?.createdAt || '';
      const secondaryB = b.attendance?.recordedAt || b.session?.createdAt || '';
      if (secondaryB !== secondaryA) {
        return secondaryB.localeCompare(secondaryA);
      }
      return b.id.localeCompare(a.id);
    });
  }, [studentId, student, isOpen, attendanceList, allSessions, sessionsById, enrollments, isEn, isRTL]);
  const allCreditLogs = useMemo(
    () => (studentId && isOpen ? db.getCreditLogs().filter((l) => l.studentId === studentId) : []),
    [studentId, isOpen, profileDataVersion, domainRevision]
  );
  const studentBehaviorLogs = useMemo(
    () => (studentId && isOpen ? db.getStudentBehaviorLogs(studentId) : []),
    [studentId, isOpen, profileDataVersion, domainRevision]
  );
  const behaviorStats = useMemo(() => calculateStudentBehaviorStats(studentBehaviorLogs), [studentBehaviorLogs]);
  const progression = useMemo(
    () => getStudentProgression(student),
    [student, attendanceList, studentBehaviorLogs, profileDataVersion, domainRevision]
  );
  const serviceType = useMemo(
    () => (studentId ? db.getStudentServiceType(studentId) : 'none'),
    [studentId, isOpen, profileDataVersion, domainRevision]
  );

  const { todayStr: todayDateStr } = useCurrentLocalDate();

  // Today's Private Lessons Summary for this student (Feature 1)
  const todayPrivateSummary = useMemo(() => {
    if (!studentId) return null;
    return db.getStudentTodayPrivateSummary(studentId, todayDateStr);
  }, [studentId, todayDateStr, allSessions, attendanceList, enrollments]);

  // Intake modal target state for completing incomplete sessions
  const [selectedPrivateIntakeSession, setSelectedPrivateIntakeSession] = useState<{
    session: Session;
    item: any;
  } | null>(null);

  // Effective recurring schedule for student
  const effectiveSchedule = useMemo(() => {
    return student ? getStudentEffectiveSchedule(student, allGroups, enrollments, isRTL) : null;
  }, [student, allGroups, enrollments, isRTL]);

  // Upcoming scheduled classes for student
  const upcomingClasses = useMemo(() => {
    return studentId
      ? getUpcomingClassesForStudent(studentId, allGroups, enrollments, 5, isRTL, allSessions, student)
      : [];
  }, [studentId, student, allGroups, enrollments, isRTL, allSessions]);

  const nextClass = upcomingClasses[0] || null;

  // Attendance metrics calculation (Using exact lesson quantities instead of session counts)
  const {
    totalScheduledSessions,
    completedLessonsCount,
    presentCount,
    absentChargedCount,
    absentExcusedCount,
    lateCount,
    cancelledCount,
    attendanceRate,
  } = useMemo(() => {
    const totalScheduled = attendanceList.length;

    let present = 0;
    let absentCharged = 0;
    let absentExcused = 0;
    let late = 0;

    attendanceList.forEach((a) => {
      const s = sessionsById.get(a.sessionId);
      const isHourly =
        s?.isHourly === true ||
        (a.hours !== undefined && a.hours !== null && Number(a.hours) > 0);

      // Extract exact quantity (lessons or hours)
      const qty = isHourly
        ? (a.hours !== undefined && a.hours !== null ? Number(a.hours) : (s?.hours ? Number(s.hours) : 1))
        : getSessionLessonQuantity(s, a);

      if (a.status === 'present') {
        present = roundMoney(present + qty, 2);
      } else if (a.status === 'late') {
        late = roundMoney(late + qty, 2);
      } else if (a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false)) {
        absentCharged = roundMoney(absentCharged + qty, 2);
      } else if (a.status === 'absent_free' || a.status === 'excused' || a.isCharged === false) {
        absentExcused = roundMoney(absentExcused + qty, 2);
      }
    });

    const completedLessons = roundMoney(present + late + absentCharged, 2);
    const cancelled = allSessions.filter(
      (s) =>
        s.status === 'cancelled' &&
        (s.studentId === studentId || (s.groupId ? studentGroupIds.has(s.groupId) : false))
    ).length;

    const totalCounted = roundMoney(present + absentCharged + absentExcused + late, 2);
    const rate = totalCounted > 0 ? Math.round(((present + late) / totalCounted) * 100) : 100;

    return {
      totalScheduledSessions: totalScheduled,
      completedLessonsCount: completedLessons,
      presentCount: present,
      absentChargedCount: absentCharged,
      absentExcusedCount: absentExcused,
      lateCount: late,
      cancelledCount: cancelled,
      attendanceRate: rate,
    };
  }, [attendanceList, allSessions, sessionsById, studentId, studentGroupIds]);

  // Recent activity stream
  interface ActivityItem {
    id: string;
    type: 'attendance' | 'payment' | 'credit' | 'session' | 'behavior';
    date: string;
    title: string;
    subtitle: string;
    badge: string;
    badgeColor: string;
    timestamp: number;
  }

  const { recentActivity, latestActivities } = useMemo(() => {
    const activities: ActivityItem[] = [];

    // 1. Add behavior activities
    studentBehaviorLogs.slice(0, 8).forEach((b) => {
      const isPos = b.category === 'positive';
      const isNeg = b.category === 'needs_improvement';
      activities.push({
        id: `act_bhv_${b.id}`,
        type: 'behavior',
        date: b.timestamp.split('T')[0],
        title: `${b.emoji ? b.emoji + ' ' : ''}${b.tag}`,
        subtitle: b.note || (b.groupName ? (isEn ? `in ${b.groupName}` : `في ${b.groupName}`) : (isEn ? 'Quick behavior assessment' : 'تقييم سلوكي سريع')),
        badge: `${(b.points ?? 0) > 0 ? '+' : ''}${b.points ?? 0} ${t('points')}`,
        badgeColor: isPos
          ? 'bg-[#E1EBEC]/65 text-[#0F2A4A] border border-[#17375E]/60'
          : isNeg
          ? 'bg-[#E1EBEC]/15 text-[#0F2A4A] border border-[#E1EBEC]'
          : 'bg-[#E1EBEC]/15 text-[#0F2A4A] border border-[#E1EBEC]',
        timestamp: new Date(b.timestamp || b.createdAt).getTime(),
      });
    });

    // 2. Add attendance activities
    attendanceList.slice(0, 8).forEach((att) => {
      const ses = sessionsById.get(att.sessionId);
      const grp = ses?.groupId ? groupsById.get(ses.groupId) : undefined;
      const isPres = att.status === 'present';
      const isLate = att.status === 'late';
      const isCharged =
        att.status === 'absent_charged' || (att.status === 'absent' && att.isCharged !== false);

      activities.push({
        id: `act_att_${att.id}`,
        type: 'attendance',
        date: ses?.date || att.recordedAt?.split('T')[0] || '',
        title: ses?.title || grp?.name || (isEn ? 'Class Session' : 'حصة دراسية'),
        subtitle: isPres
          ? (isEn ? 'Present' : 'حضور كامل')
          : isLate
          ? (isEn ? 'Late' : 'حضور متأخر')
          : isCharged
          ? (isEn ? 'Charged Absence' : 'غياب محسوب')
          : (isEn ? `Excused Absence (${att.absenceReason || 'Excused'})` : `غياب معفى (${att.absenceReason || 'معتذر'})`),
        badge: isPres ? t('present') : isLate ? t('late') : isCharged ? t('absentCharged') : t('absentExcused'),
        badgeColor: isPres
          ? 'bg-[#E1EBEC]/65 text-[#0F2A4A] border border-[#17375E]/60'
          : isLate
          ? 'bg-[#E1EBEC]/70 text-[#0F2A4A] border border-[#0F2A4A]/50'
          : isCharged
          ? 'bg-[#E1EBEC]/15 text-[#0F2A4A] border border-[#E1EBEC]'
          : 'bg-[#E1EBEC]/25 text-[#0F2A4A] border border-[#E1EBEC]',
        timestamp: new Date(att.recordedAt || ses?.date || 0).getTime(),
      });
    });

    // 3. Add payment activities
    allPayments.slice(0, 8).forEach((p) => {
      activities.push({
        id: `act_pay_${p.id}`,
        type: 'payment',
        date: p.date,
        title: isEn ? `Payment of ${p.amount} ${t('currency')}` : `سداد مبلغ ${p.amount} ج.م`,
        subtitle: `${
          p.notes || (p.targetMonth ? (isEn ? `Month: ${getArabicMonthName(p.targetMonth)}` : `عن شهر ${getArabicMonthName(p.targetMonth)}`) : (isEn ? 'Account Payment' : 'دفعة حساب'))
        }`,
        badge:
          p.paymentMethod === 'vodafone_cash'
            ? (isEn ? 'Vodafone Cash' : 'فودافون كاش')
            : p.paymentMethod === 'instapay'
            ? (isEn ? 'InstaPay' : 'إنستاباي')
            : p.paymentMethod === 'bank_transfer'
            ? (isEn ? 'Bank Transfer' : 'تحويل بنكي')
            : (isEn ? 'Cash' : 'كاش'),
        badgeColor: 'bg-[#E1EBEC]/65 text-[#0F2A4A] border border-[#17375E]/60',
        timestamp: new Date(p.createdAt || p.date).getTime(),
      });
    });

    // 4. Add credit log activities
    allCreditLogs.slice(0, 8).forEach((log) => {
      activities.push({
        id: `act_crd_${log.id}`,
        type: 'credit',
        date: log.date,
        title: log.reason || (isEn ? 'Session balance adjustment' : 'تعديل رصيد الحصص'),
        subtitle: isEn ? `Balance after: ${log.balanceAfter} sessions` : `الرصيد بعد العملية: ${log.balanceAfter} حصص`,
        badge: `${log.sessionsDelta > 0 ? '+' : ''}${log.sessionsDelta} ${isEn ? 'sessions' : 'حصة'}`,
        badgeColor:
          log.sessionsDelta > 0
            ? 'bg-[#E1EBEC]/65 text-[#0F2A4A] border border-[#17375E]/60'
            : 'bg-[#E1EBEC]/70 text-[#0F2A4A] border border-[#0F2A4A]/50',
        timestamp: parseLocalDateStr(log.date).getTime(),
      });
    });

    activities.sort((a, b) => b.timestamp - a.timestamp);
    return {
      recentActivity: activities,
      latestActivities: activities.slice(0, 6),
    };
  }, [studentBehaviorLogs, attendanceList, sessionsById, groupsById, allPayments, allCreditLogs, isEn, t]);

  const privateEnrollments = useMemo(
    () => grandFinancials.enrollmentsSummary.filter((e) => e.groupType === 'private'),
    [grandFinancials]
  );
  const groupEnrollments = useMemo(
    () => grandFinancials.enrollmentsSummary.filter((e) => e.groupType !== 'private'),
    [grandFinancials]
  );
  const hasPrivate =
    privateEnrollments.length > 0 || serviceType === 'private_only' || serviceType === 'both';

  const handleCreatePrivateService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    try {
      const isHourly = newPrivateBillingMode === 'hourly';
      const isPkg = newPrivateBillingMode === 'package';
      db.createPrivateLessonService(student.id, {
        subject: newPrivateSubject.trim() || (isEn ? 'Private Lesson' : 'درس خاص'),
        sessionPrice: isPkg
          ? newPrivatePackagePrice
          : isHourly
          ? newPrivateHourlyRate
          : newPrivatePrice,
        billingType: newPrivateBillingMode as any,
        billingMode: newPrivateBillingMode,
        hourlyRate: isHourly ? newPrivateHourlyRate : undefined,
        packageSessionsCount: isPkg ? newPrivatePackageSessions : undefined,
        packagePrice: isPkg ? newPrivatePackagePrice : undefined,
        scheduleDays: newPrivateDays,
        scheduleTime: newPrivateTime,
        roomOrLocation: newPrivateLocation,
      });
      setIsAddingPrivateService(false);
      setProfileDataVersion((v) => v + 1);
      onDataChanged();
    } catch (err) {
      console.error(err);
      alert(isEn ? 'An error occurred while adding private service' : 'حدث خطأ أثناء إضافة الخدمة الخاصة');
    }
  };

  const handleStartEditEnrollment = (enrId: string) => {
    const enroll = db.getEnrollments().find((e) => e.id === enrId);
    if (!enroll) return;
    setEditingEnrollmentId(enrId);
    setEditBillingMode((enroll.billingMode || enroll.billingType || 'prepaid') as BillingMode);
    setEditCustomPrice(enroll.customPrice || 100);
    setEditHourlyRate(enroll.hourlyRate || 150);
    setEditPackagePrice(enroll.packagePrice || 900);
    setEditPackageSessions(enroll.packageSessionsCount || 10);
    const effPeriod = getEffectiveEnrollmentPeriod(enroll, student);
    setEditPeriodValue({
      startDate: effPeriod.startDate,
      endDate: effPeriod.endDate,
      vacationPeriods: effPeriod.vacationPeriods.map((vp) => ({ ...vp })),
    });
    setEditPeriodError(null);
  };

  const handleSaveEnrollmentBilling = (enrId: string) => {
    const validation = validateEnrollmentPeriod(editPeriodValue, language);
    if (!validation.valid) {
      setEditPeriodError(validation.errors[0]);
      return;
    }
    setEditPeriodError(null);

    const cleanPeriod = sanitizePeriodForPersistence(editPeriodValue);
    const isHourly = editBillingMode === 'hourly';
    const isPkg = editBillingMode === 'package';
    db.updateEnrollmentBilling(enrId, {
      billingMode: editBillingMode,
      billingType: editBillingMode as any,
      customPrice: isHourly ? editHourlyRate : isPkg ? editPackagePrice : editCustomPrice,
      hourlyRate: isHourly ? editHourlyRate : undefined,
      packagePrice: isPkg ? editPackagePrice : undefined,
      packageSessionsCount: isPkg ? editPackageSessions : undefined,
      startDate: cleanPeriod.startDate || '',
      endDate: cleanPeriod.endDate || '',
      vacationPeriods: cleanPeriod.vacationPeriods,
    });
    setEditingEnrollmentId(null);
    setProfileDataVersion((v) => v + 1);
    onDataChanged();
  };

  const renderEnrollmentPeriodStatusPill = (enrId: string) => {
    const rawEnr = enrollments.find((e) => e.id === enrId);
    if (!rawEnr) return null;
    const statusToday = getEnrollmentDateStatus(rawEnr, todayDateStr, student);
    const eff = getEffectiveEnrollmentPeriod(rawEnr, student);

    if (statusToday.reason === 'before_start' && statusToday.startDate) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300/60">
          <AppIcon name="calendar" size={11} />
          <span>{t('periodStatusBeforeStart', { date: statusToday.startDate })}</span>
        </span>
      );
    }
    if (statusToday.reason === 'on_vacation' && statusToday.activeVacation) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300/60">
          <AppIcon name="calendarRange" size={11} />
          <span>{t('periodStatusOnVacation', { date: statusToday.activeVacation.endDate })}</span>
        </span>
      );
    }
    if (statusToday.reason === 'ended' && statusToday.endDate) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-coral-soft text-coral border border-coral/30">
          <AppIcon name="calendar" size={11} />
          <span>{t('periodStatusEnded', { date: statusToday.endDate })}</span>
        </span>
      );
    }
    if (eff.startDate || eff.endDate || eff.vacationPeriods.length > 0) {
      const partsLabel: string[] = [];
      if (eff.startDate) partsLabel.push(`${t('lessonStartDate')}: ${eff.startDate}`);
      if (eff.endDate) partsLabel.push(`${eff.endDate}`);
      if (eff.vacationPeriods.length > 0) {
        partsLabel.push(
          isEn
            ? `${eff.vacationPeriods.length} vacation(s)`
            : `${eff.vacationPeriods.length} إجازة`
        );
      }
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E1EBEC]/35 text-[#0F2A4A] border border-[#E1EBEC]">
          <AppIcon name="calendarRange" size={11} />
          <span dir="ltr">{partsLabel.join(' • ')}</span>
        </span>
      );
    }
    return null;
  };

  const handleToggleSessionPaymentOverride = (sessionId: string) => {
    const existingAtt = attendanceList.find((a) => a.sessionId === sessionId);
    const session = allSessions.find((s) => s.id === sessionId);
    const enr = grandFinancials.enrollmentsSummary.find(
      (e) => e.groupId === session?.groupId || e.enrollmentId === session?.enrollmentId
    );
    if (!student) return;

    const currentUnpaid =
      existingAtt?.paymentStatus === 'unpaid' ||
      existingAtt?.paymentOverride === 'unpaid' ||
      existingAtt?.isPaid === false;
    const nextPaymentStatus = currentUnpaid ? 'paid' : 'unpaid';

    const rec: Attendance = {
      ...existingAtt,
      id: existingAtt?.id || `att_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      studentId: student.id,
      enrollmentId: session?.enrollmentId || enr?.enrollmentId,
      status: existingAtt?.status || 'present',
      isCharged: existingAtt?.isCharged !== undefined ? existingAtt.isCharged : true,
      paymentStatus: nextPaymentStatus,
      isPaid: nextPaymentStatus === 'paid',
      paymentOverride: nextPaymentStatus,
      recordedAt: existingAtt?.recordedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.saveAttendanceBatch(sessionId, [rec]);
    setProfileDataVersion((v) => v + 1);
    onDataChanged();
  };

  const handleRemoveEnrollment = (enrollmentId: string, groupName: string) => {
    if (confirm(isEn ? `Are you sure you want to unenroll student from ${groupName}?` : `هل أنت متأكد من إلغاء قيد الطالب من ${groupName}؟`)) {
      db.removeEnrollment(enrollmentId);
      setProfileDataVersion((v) => v + 1);
      onDataChanged();
    }
  };

  const handleConfirmArchive = (targetStudent: Student) => {
    db.archiveStudent(targetStudent.id);
    onDataChanged();
    onClose();
  };

  const handleConfirmPermanentDelete = (targetStudent: Student) => {
    db.deleteStudentPermanently(targetStudent.id);
    onDataChanged();
    onClose();
  };

  const handleRestoreStudent = () => {
    if (!student) return;
    db.restoreStudent(student.id);
    onDataChanged();
    onClose();
  };

  const handleConfirmPrivateIntakeInProfile = (result: PrivateClassIntakeResult) => {
    if (!selectedPrivateIntakeSession || !student) return;
    const { session } = selectedPrivateIntakeSession;
    const enrollment = enrollments.find(
      (e) => e.studentId === student.id && (e.groupId === session.groupId || e.id === session.enrollmentId)
    );

    const finalStatus = result.attendanceStatus || 'present';
    const isCharged = result.isCharged !== undefined ? result.isCharged : (finalStatus !== 'absent_free');
    const existingAtt = db.getSessionAttendance(session.id).find((a) => a.studentId === student.id);

    const record: Attendance = {
      ...existingAtt,
      id: existingAtt?.id || `att_${session.id}_${student.id}`,
      sessionId: session.id,
      studentId: student.id,
      enrollmentId: enrollment?.id || session.enrollmentId,
      status: finalStatus,
      isCharged,
      sessionUnits: result.sessionUnits,
      hours: result.hours,
      isIncomplete: false,
      notes: result.notes !== undefined ? result.notes : session.notes,
      behaviorRating: result.behaviorRating,
      homeworkRating: result.homeworkRating,
      absenceReason: finalStatus === 'absent_free' ? (result.notes || (isEn ? 'Uncharged Absence' : 'غياب غير محسوب')) : undefined,
      recordedAt: existingAtt?.recordedAt || new Date().toISOString(),
    };

    db.saveSession({
      ...session,
      status: 'completed',
      sessionUnits: result.sessionUnits,
      hours: result.hours,
      pricePerStudent: result.pricePerStudent,
      isIncomplete: false,
      notes: result.notes !== undefined ? result.notes : session.notes,
      updatedAt: new Date().toISOString(),
    });
    db.saveAttendanceBatch(session.id, [record]);

    setSelectedPrivateIntakeSession(null);
    setProfileDataVersion((v) => v + 1);
    onDataChanged();
  };

  const [isSafeDeleteModalOpen, setIsSafeDeleteModalOpen] = useState(false);

  const subTabs: StudentProfileSubTab[] = ['overview', 'groups', 'private', 'finances', 'attendance', 'behavior', 'history', 'credit_logs'];

  const handleNextSubTab = () => {
    const currentIdx = subTabs.indexOf(activeSubTab);
    if (currentIdx < subTabs.length - 1) {
      setActiveSubTab(subTabs[currentIdx + 1]);
    }
  };

  const handlePrevSubTab = () => {
    const currentIdx = subTabs.indexOf(activeSubTab);
    if (currentIdx > 0) {
      setActiveSubTab(subTabs[currentIdx - 1]);
    }
  };

  // Touch gestures: Swipe left/right on tab body switches subtabs
  const tabContentSwipeGestures = useSwipeGesture({
    onSwipeLeft: isRTL ? handlePrevSubTab : handleNextSubTab,
    onSwipeRight: isRTL ? handleNextSubTab : handlePrevSubTab,
    threshold: 60,
  });

  // Touch gesture: Swipe down on header dismisses modal
  const headerSwipeDownGestures = useSwipeGesture({
    onSwipeDown: onClose,
    threshold: 45,
  });

  if (!student) return null;

  const isArchived = student.status === 'archived';

  return (
    <>
      <BottomSheet
        id="student-profile"
        transitionVariant="detail"
        isOpen={isOpen && !!student}
        onClose={onClose}
        size="full"
        maxWidthClass="sm:max-w-2xl"
        showHandle={true}
        showClose={true}
        title={student.name}
        subtitle={`${getLocalizedStageName(student.gradeLevel) || (isEn ? 'Student Dossier' : 'ملف الطالب')}${student.school ? ` • ${student.school}` : ''}`}
        bodyClassName="p-0 flex flex-col"
        footer={
          <div className="flex items-center justify-between gap-3 w-full">
            <span className="text-[11px] font-bold text-slate truncate">
              {student.name} • {getLocalizedStageName(student.gradeLevel) || (isEn ? 'Student Dossier' : 'ملف الطالب')}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="btn-soft px-4 py-1.5 text-xs font-bold"
            >
              {t('close')}
            </button>
          </div>
        }
      >
        {/* =========================================================================
            1. STUDENT PROFILE HERO
            ========================================================================= */}
        <div
          data-tutorial-id="student-profile-summary"
          {...headerSwipeDownGestures}
          className="p-5 border-b border-line bg-page text-navy relative overflow-hidden shrink-0 select-none cursor-grab active:cursor-grabbing"
        >

            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 ${isRTL ? 'pl-10' : 'pr-10'}`}>
              <div className="flex items-center gap-3.5 min-w-0">
                <StudentAvatar
                  student={student}
                  size="xl"
                  showFrame={true}
                  className="shrink-0"
                />

                <div className="space-y-1 min-w-0 text-start">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="t-title text-navy font-bold text-xl sm:text-2xl truncate">
                      {student.name}
                    </h2>

                    {/* Archived Status Badge */}
                    {isArchived && (
                      <StatusBadge status="archived" label={t('archived')} />
                    )}

                    {/* Service Badges */}
                    {serviceType === 'both' && (
                      <StatusBadge
                        status="active"
                        label={isEn ? 'Group + Private' : 'مجموعة + درس خاص'}
                      />
                    )}
                    {serviceType === 'private_only' && (
                      <StatusBadge
                        status="pending"
                        label={isEn ? 'Private Lesson' : 'درس خاص'}
                      />
                    )}
                    {serviceType === 'group_only' && (
                      <StatusBadge
                        status="active"
                        label={isEn ? 'Group Only' : 'مجموعة فقط'}
                      />
                    )}
                    {serviceType === 'none' && !isArchived && (
                      <StatusBadge
                        status="inactive"
                        label={isEn ? 'No Active Enrollment' : 'بدون اشتراك نشط'}
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate font-medium flex-wrap tabular-nums">
                    <span className="font-bold text-navy">
                      {isEn ? progression.frameDef.shortLabelEn : progression.frameDef.shortLabelAr}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {progression.totalXp} {isEn ? 'XP' : 'نقطة'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {isEn ? progression.behaviorStandingEn : progression.behaviorStandingAr}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {getLocalizedStageName(student.gradeLevel) || (isEn ? 'Grade Not Set' : 'الصف غير محدد')}
                    </span>
                    {student.school && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{isEn ? `School: ${student.school}` : `مدرسة ${student.school}`}</span>
                      </>
                    )}
                    {student.city && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{student.city}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Archived Alert Banner */}
            {isArchived && (
              <div className="mt-4 p-3 rounded-2xl bg-coral-soft border border-coral/30 text-navy flex flex-col sm:flex-row items-center justify-between gap-2.5 relative z-10">
                <div className={`text-xs font-medium leading-relaxed ${isRTL ? 'text-right' : 'text-left'} w-full sm:w-auto`}>
                  <strong className="font-black block text-coral">{isEn ? 'Student is currently archived' : 'هذا الطالب مؤرشف حالياً'}</strong>
                  <span className="text-slate">{isEn ? 'All historical records, sessions, and payments are preserved.' : 'كافة السجلات والحصص والمدفوعات التاريخية محفوظة بالكامل.'}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreStudent}
                  className="btn-navy w-full sm:w-auto px-4 py-2 text-xs flex items-center justify-center gap-1.5 shrink-0"
                >
                  <AppIcon name="refresh" size={14} />
                  <span>{isEn ? 'Restore Student' : 'استعادة الطالب للنشاط'}</span>
                </button>
              </div>
            )}

            {/* Quick Contacts & Actions Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-line relative z-10">
              <button
                type="button"
                onClick={() => setIsRecordPrivateModalOpen(true)}
                className="btn-orange py-2 px-3 text-xs flex items-center justify-center gap-1.5"
              >
                <AppIcon name="sparkles" size={14} weight="fill" />
                <span>{isEn ? '+ Private Class' : '+ حصة خاصة'}</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenAddPayment(student)}
                className="btn-soft py-2 px-3 text-xs flex items-center justify-center gap-1.5"
              >
                <AppIcon name="coins" size={14} weight="bold" />
                <span>+ {t('recordPayment')}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsQuickBehaviorModalOpen(true)}
                className="btn-soft py-2 px-3 text-xs flex items-center justify-center gap-1.5"
              >
                <AppIcon name="award" size={14} weight="bold" />
                <span>{isEn ? 'Behavior Rating' : 'تقييم سلوك'}</span>
              </button>

              <button
                type="button"
                onClick={() => onEditStudent(student)}
                className="btn-soft py-2 px-3 text-xs flex items-center justify-center gap-1.5"
                title={t('editStudent')}
              >
                <AppIcon name="edit" size={14} />
                <span>{t('editStudent')}</span>
              </button>
            </div>
          </div>

          {/* =========================================================================
              2. SUB-NAVIGATION TABS (Horizontal Scrollable Chips)
              ========================================================================= */}
          <div className="flex items-center gap-1.5 border-b border-line bg-page px-3 py-2 overflow-x-auto no-scrollbar shrink-0 z-10 sticky top-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('overview')}
              className={`chip ${activeSubTab === 'overview' ? 'chip-active' : ''}`}
            >
              <AppIcon name="filter" size={13} />
              <span>{isEn ? 'Overview' : 'لوحة الطالب'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('groups')}
              className={`chip ${activeSubTab === 'groups' ? 'chip-active' : ''}`}
            >
              <AppIcon name="groups" size={13} />
              <span>{t('groups')} ({groupEnrollments.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('private')}
              className={`chip ${activeSubTab === 'private' ? 'chip-active' : ''}`}
            >
              <AppIcon name="zap" size={13} />
              <span>{isEn ? 'Private' : 'الدرس الخاص'} {privateEnrollments.length > 0 ? `(${privateEnrollments.length})` : ''}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('finances')}
              className={`chip ${activeSubTab === 'finances' ? 'chip-active' : ''}`}
            >
              <AppIcon name="coins" size={13} />
              <span>{isEn ? 'Finances' : 'الحسابات والماليات'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('attendance')}
              className={`chip ${activeSubTab === 'attendance' ? 'chip-active' : ''}`}
            >
              <AppIcon name="calendarCheck" size={13} />
              <span>{t('attendance')} ({sortedSessionHistory.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('behavior')}
              className={`chip ${activeSubTab === 'behavior' ? 'chip-active' : ''}`}
            >
              <AppIcon name="award" size={13} />
              <span>{isEn ? 'Behavior' : 'السلوك'} ({studentBehaviorLogs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('history')}
              className={`chip ${activeSubTab === 'history' ? 'chip-active' : ''}`}
            >
              <AppIcon name="invoice" size={13} />
              <span>{isEn ? 'Payments Log' : 'سجل المدفوعات'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('credit_logs')}
              className={`chip ${activeSubTab === 'credit_logs' ? 'chip-active' : ''}`}
            >
              <AppIcon name="coins" size={13} />
              <span>{isEn ? 'Credit Logs' : 'حركات الرصيد'} ({allCreditLogs.length})</span>
            </button>
          </div>

          {/* =========================================================================
              3. TAB CONTENTS
              ========================================================================= */}
          <div
            {...tabContentSwipeGestures}
            className="p-4 sm:p-5 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar flex-1 space-y-4 text-xs text-[#0F2A4A]"
          >
            {/* -------------------------------------------------------------
                TAB 1: OVERVIEW / TEACHER DOSSIER
                ------------------------------------------------------------- */}
            {activeSubTab === 'overview' && (
              <div className="space-y-4">
                {/* Level & Behavior Progression Summary */}
                <WhiteCard className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <StudentAvatar
                        student={student}
                        size="lg"
                        showFrame={true}
                        className="shrink-0"
                      />
                      <div className="min-w-0 space-y-0.5 text-start">
                        <h3 className="font-bold text-sm text-navy truncate">
                          {isEn ? progression.frameDef.titleEn : progression.frameDef.titleAr}
                        </h3>
                        <p className="text-xs text-slate tabular-nums">
                          {isEn ? progression.behaviorStandingEn : progression.behaviorStandingAr}
                          {' · '}
                          {progression.totalXp} {isEn ? 'XP' : 'نقطة خبرة'}
                          {student.avatarFrameMode === 'manual' && (
                            <span>
                              {' · '}
                              {isEn ? 'Manual Frame' : 'إطار يدوي'}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsQuickBehaviorModalOpen(true)}
                      className="btn-soft px-3 py-1.5 text-xs flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                    >
                      <AppIcon name="award" size={14} weight="bold" />
                      <span>{isEn ? '+ Rate Behavior' : '+ تقييم سلوك'}</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate font-medium tabular-nums">
                      <span>
                        {progression.isMaxLevel
                          ? isEn
                            ? 'Maximum Level Reached (MAX)'
                            : 'تم بلوغ المستوى الأقصى (MAX)'
                          : isEn
                          ? `Progress to Level ${progression.level + 1}`
                          : `التقدم نحو المستوى ${progression.level + 1}`}
                      </span>
                      <span>
                        {progression.isMaxLevel
                          ? `${progression.totalXp} XP`
                          : isEn
                          ? `${progression.xpRemainingToNextLevel} XP remaining`
                          : `متبقي ${progression.xpRemainingToNextLevel} نقطة`}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-mint-soft overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-navy transition-all duration-300 ${getProgressWidthClass(
                          progression.progressPercent
                        )}`}
                      />
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-line flex items-center gap-2 flex-wrap text-[11px] text-slate tabular-nums">
                    <span>
                      {isEn ? 'Attendance:' : 'الحضور:'}{' '}
                      <strong className="text-navy">
                        {progression.attendanceXp >= 0
                          ? `+${progression.attendanceXp}`
                          : progression.attendanceXp}
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {isEn ? 'Behavior:' : 'السلوك:'}{' '}
                      <strong className="text-navy">
                        {progression.behaviorXp >= 0
                          ? `+${progression.behaviorXp}`
                          : progression.behaviorXp}
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {isEn ? 'Homework:' : 'الواجبات:'}{' '}
                      <strong className="text-navy">
                        {progression.homeworkXp >= 0
                          ? `+${progression.homeworkXp}`
                          : progression.homeworkXp}
                      </strong>
                    </span>
                  </div>
                </WhiteCard>

                {/* Today's Private Lessons Summary (Feature 1 & Feature 3) */}
                {todayPrivateSummary && todayPrivateSummary.visitsCount > 0 && (
                  <div className="classy-card p-4 bg-gradient-to-r from-[#FFFFFF] via-[#FFFFFF] to-[#FFFFFF] border-[#E1EBEC] space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#E1EBEC]/15 text-[#0F2A4A] flex items-center justify-center font-black">
                          <AppIcon name="calendar" size={16} />
                        </div>
                        <div>
                          <h3 className="font-black text-xs sm:text-sm text-[#0F2A4A] flex items-center gap-1.5">
                            <span>{isEn ? "Today's Private Lessons" : 'دروس اليوم الخاصة'}</span>
                          </h3>
                          <p className="text-[11px] text-[#5F7083] font-medium">
                            {student.name} • {todayPrivateSummary.date}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {todayPrivateSummary.hasIncomplete && (
                          <StatusBadge
                            status="incomplete"
                            label={
                              isEn
                                ? `${todayPrivateSummary.incompleteCount} need(s) completion`
                                : `${todayPrivateSummary.incompleteCount} حصة تحتاج استكمال`
                            }
                          />
                        )}
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#E1EBEC]/15 text-[#0F2A4A] border border-[#E1EBEC]">
                          {todayPrivateSummary.visitsCount} {isEn ? (todayPrivateSummary.visitsCount === 1 ? 'Appointment' : 'Appointments') : (todayPrivateSummary.visitsCount === 1 ? 'موعد' : 'مواعيد')}
                        </span>
                      </div>
                    </div>

                    {/* List of Today's Sessions */}
                    <div className="space-y-2">
                      {todayPrivateSummary.sessions.map((sesItem) => {
                        const isPres = sesItem.status === 'present' || sesItem.status === 'late';
                        const isHourly = sesItem.billingMode === 'hourly';
                        const sesAtt = sesItem.sessionId
                          ? attendanceList.find((a) => a.sessionId === sesItem.sessionId)
                          : undefined;

                        return (
                          <div
                            key={sesItem.occurrenceId}
                            className={`p-3 rounded-2xl border flex items-center justify-between gap-2.5 transition-all ${
                              sesItem.isIncomplete
                                ? 'bg-[#E1EBEC]/80 border-[#0F2A4A]/50'
                                : isPres
                                ? 'bg-[#FFFFFF] border-[#17375E]/50 shadow-2xs'
                                : 'bg-[#E1EBEC]/15 border-[#E1EBEC]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="px-2.5 py-1 rounded-xl bg-[#17375E] text-[#FFFFFF] font-black text-xs shrink-0">
                                {sesItem.time}
                              </div>
                              <div className="min-w-0">
                                <strong className="text-xs font-black text-[#0F2A4A] block truncate">
                                  {sesItem.subject}
                                </strong>
                                <span className="text-[11px] text-[#5F7083] block">
                                  {sesItem.status === 'unrecorded'
                                    ? (isEn ? 'Scheduled • Not recorded yet' : 'مجدول • لم يُرصد بعد')
                                    : isPres
                                    ? (isEn ? '✓ Present' : '✓ حضر')
                                    : (isEn ? 'Absent' : 'لم يحضر')}
                                  {isPres && (
                                    <span className="font-black text-[#17375E] ms-1">
                                      • {isHourly ? `${sesItem.hours || 0} ${isEn ? 'Hours' : 'ساعة'}` : `${sesItem.sessionUnits || 0} ${isEn ? 'Session(s)' : 'حصة'}`}
                                    </span>
                                  )}
                                </span>
                                {(sesAtt?.behaviorRating || sesAtt?.homeworkRating) && (
                                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                    {sesAtt.behaviorRating && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#DCEDEB]/70 text-[#0F2A4A] border border-[#E1EBEC]">
                                        <AppIcon name="star" size={10} weight="fill" className="text-[#F5A04A]" />
                                        <span>{isEn ? 'Behavior:' : 'السلوك:'} {getBehaviorRatingLabel(sesAtt.behaviorRating, isEn)}</span>
                                      </span>
                                    )}
                                    {sesAtt.homeworkRating && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#DCEDEB]/70 text-[#0F2A4A] border border-[#E1EBEC]">
                                        <AppIcon name="book" size={10} weight="fill" className="text-[#17375E]" />
                                        <span>{isEn ? 'Homework:' : 'الواجب:'} {getHomeworkRatingLabel(sesAtt.homeworkRating, isEn)}</span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {sesItem.isIncomplete ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const actualSession = allSessions.find((s) => s.id === sesItem.sessionId);
                                    if (actualSession) {
                                      setSelectedPrivateIntakeSession({ session: actualSession, item: sesItem });
                                    }
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-[#E1EBEC]/700 hover:bg-[#0F2A4A] text-[#FFFFFF] font-black text-[10px] flex items-center gap-1 shadow-sm cursor-pointer active:scale-95"
                                >
                                  <span>⚠️</span>
                                  <span>{isEn ? 'Complete Session' : 'استكمال تفاصيل الحصة'}</span>
                                </button>
                              ) : sesItem.status !== 'unrecorded' && sesItem.sessionId ? (
                                <div className="text-right">
                                  {isPres && (
                                    <span className="text-xs font-black text-[#0F2A4A] block">
                                      {sesItem.price} {t('currency')}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const actualSession = allSessions.find((s) => s.id === sesItem.sessionId);
                                      if (actualSession) {
                                        setSelectedPrivateIntakeSession({ session: actualSession, item: sesItem });
                                      }
                                    }}
                                    className="text-[10px] text-[#17375E] font-bold hover:underline cursor-pointer"
                                  >
                                    {isEn ? 'Edit' : 'تعديل'}
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Daily Totals Bar */}
                    <div className="p-3 rounded-xl bg-[#FFFFFF] border border-[#E1EBEC] flex items-center justify-between text-xs">
                      <span className="font-bold text-[#5F7083]">
                        {isEn ? "Today's Total:" : 'إجمالي اليوم:'}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-black text-[#17375E]">
                          {todayPrivateSummary.totalUnitsOrHoursText}
                        </span>
                        <span className="text-sm font-black text-[#0F2A4A]">
                          {todayPrivateSummary.totalAmount} {t('currency')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Financial Summary Bento Cards */}
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="classy-card p-3.5 bg-[#FFFFFF] space-y-1">
                    <span className="text-[10px] font-bold text-[#5F7083] block">
                      {isEn ? 'Total Fees (Gross)' : 'إجمالي الرسوم (Gross)'}
                    </span>
                    <strong className="text-base sm:text-lg font-black text-[#0F2A4A] block">
                      {grandFinancials.grandTotalDue} {t('currency')}
                    </strong>
                  </div>

                  <div className="classy-card p-3.5 bg-[#FFFFFF] space-y-1 border-[#17375E]/50">
                    <span className="text-[10px] font-bold text-[#0F2A4A] block">
                      {t('totalCollected')}
                    </span>
                    <strong className="text-base sm:text-lg font-black text-[#0F2A4A] block">
                      {grandFinancials.grandTotalPaid} {t('currency')}
                    </strong>
                  </div>

                  <div
                    className={`classy-card p-3.5 space-y-1 ${
                      grandFinancials.grandRemaining > 0
                        ? 'bg-[#E1EBEC]/15 border-[#E1EBEC]'
                        : 'bg-[#FFFFFF] border-[#17375E]/50'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-[#5F7083] block">
                      {t('remainingBalance')}
                    </span>
                    <strong
                      className={`text-base sm:text-lg font-black block ${
                        grandFinancials.grandRemaining > 0 ? 'text-[#0F2A4A]' : 'text-[#0F2A4A]'
                      }`}
                    >
                      {grandFinancials.grandRemaining} {t('currency')}
                    </strong>
                  </div>
                </div>

                {/* Lesson & Hourly Delivery Ledger Breakdown (Sessions vs Lessons & Unpaid Lessons) */}
                <div className="classy-card p-4 bg-gradient-to-br from-[#FFFFFF] via-[#FFFFFF] to-[#FFFFFF] border-[#E1EBEC] shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[#E1EBEC] pb-2">
                    <div className="flex items-center gap-2">
                      <AppIcon name="layers" size={16} className="text-navy" />
                      <h4 className="font-black text-xs text-[#0F2A4A]">
                        {isEn ? 'Lessons & Workload Balance (Physical vs Billed)' : 'ميزان الحصص وساعات العمل (الفعلي مقابل المسدد)'}
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E1EBEC]/25 text-[#17375E]">
                      {grandFinancials.grandAppointmentsCount || 0} {isEn ? 'Appointments' : 'جلسات منعقدة'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10px]">
                    <div className="p-2.5 bg-[#FFFFFF] rounded-2xl border border-[#E1EBEC] space-y-0.5">
                      <span className="text-[#5F7083] block font-bold">
                        {isEn ? 'Completed Lessons' : 'إجمالي الحصص المنفذة'}
                      </span>
                      <strong className="text-sm font-black text-[#0F2A4A] block">
                        {grandFinancials.grandCompletedLessons || 0} {isEn ? 'Lessons' : 'حصة'}
                      </strong>
                    </div>

                    <div className="p-2.5 bg-[#FFFFFF] rounded-2xl border border-[#17375E]/50 space-y-0.5">
                      <span className="text-[#0F2A4A] block font-bold">
                        {isEn ? 'Paid Lessons' : 'الحصص المسددة'}
                      </span>
                      <strong className="text-sm font-black text-[#0F2A4A] block">
                        {grandFinancials.grandPaidLessons || 0} {isEn ? 'Lessons' : 'حصة'}
                      </strong>
                    </div>

                    <div className={`p-2.5 rounded-2xl border space-y-0.5 ${
                      (grandFinancials.grandUnpaidLessons || 0) > 0 ? 'bg-[#E1EBEC]/15 border-[#E1EBEC]' : 'bg-[#FFFFFF] border-[#E1EBEC]'
                    }`}>
                      <span className="block font-bold text-[#5F7083]">
                        {isEn ? 'Unpaid Lessons' : 'الحصص غير المسددة'}
                      </span>
                      <strong className={`text-sm font-black block ${
                        (grandFinancials.grandUnpaidLessons || 0) > 0 ? 'text-[#0F2A4A]' : 'text-[#0F2A4A]'
                      }`}>
                        {grandFinancials.grandUnpaidLessons || 0} {isEn ? 'Lessons' : 'حصة'}
                      </strong>
                    </div>

                    <div className="p-2.5 bg-[#FFFFFF] rounded-2xl border border-[#E1EBEC] space-y-0.5">
                      <span className="text-[#5F7083] block font-bold">
                        {isEn ? 'Hourly Logged' : 'ساعات العمل'}
                      </span>
                      <strong className="text-sm font-black text-[#0F2A4A] block">
                        {grandFinancials.grandTotalHours || 0} {isEn ? 'Hours' : 'ساعة'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Direct Contacts & WhatsApp Bar */}
                <div className="classy-card p-3.5 bg-[#FFFFFF] flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <AppIcon name="phone" size={16} className="text-navy" />
                    <span className="font-bold text-xs text-[#0F2A4A]">{isEn ? 'Contact Info:' : 'بيانات التواصل المباشر:'}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {student.phone && (
                      <a
                        href={`tel:${student.phone}`}
                        className="px-3 py-1.5 rounded-xl bg-[#E1EBEC]/15 hover:bg-[#E1EBEC]/35 text-[#0F2A4A] font-bold text-xs flex items-center gap-1.5 border border-[#E1EBEC] transition-colors"
                      >
                        <AppIcon name="phone" size={12} className="text-navy" />
                        <span>{student.phone}</span>
                      </a>
                    )}

                    {student.parentPhone && (
                      <a
                        href={`https://wa.me/${student.parentPhone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-[#E1EBEC]/65 hover:bg-[#E1EBEC]/35 text-[#0F2A4A] font-bold text-xs flex items-center gap-1.5 border border-[#17375E]/60 transition-colors"
                      >
                        <AppIcon name="whatsapp" size={14} className="text-navy" />
                        <span>{isEn ? `WhatsApp (${student.parentRelation || 'Parent'}): ${student.parentPhone}` : `واتساب ${student.parentRelation || 'ولي الأمر'}: ${student.parentPhone}`}</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* =========================================================================
                    DEDICATED STUDENT SCHEDULE CARD (مواعيد الطالب)
                    ========================================================================= */}
                <div className="classy-card p-4 bg-[#FFFFFF] space-y-3.5 shadow-sm border-[#E1EBEC]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#E1EBEC]/25 text-[#17375E] flex items-center justify-center shrink-0">
                        <AppIcon name="clock" size={16} />
                      </div>
                      <div>
                        <h3 className="font-black text-xs sm:text-sm text-[#0F2A4A] flex items-center gap-1.5">
                          <span>{t('studentSchedule')}</span>
                        </h3>
                        <p className="text-[11px] text-[#5F7083] font-medium">
                          {isEn ? 'Effective recurring weekly timetable' : 'جدول ومواعيد الحصص الأسبوعية الفعلية'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {effectiveSchedule && effectiveSchedule.totalOccurrencesCount > 0 && (
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#E1EBEC]/25 text-[#17375E] border border-[#17375E]/20">
                          {effectiveSchedule.totalOccurrencesCount} {t('weeklyClassesCount')}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onEditStudent(student)}
                        className="p-1.5 rounded-xl bg-[#E1EBEC]/15 hover:bg-[#E1EBEC]/35 text-[#5F7083] hover:text-[#0F2A4A] border border-[#E1EBEC] transition-colors cursor-pointer"
                        title={isEn ? 'Edit Schedule' : 'تعديل المواعيد'}
                      >
                        <AppIcon name="edit" size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Schedule Content */}
                  {!effectiveSchedule || effectiveSchedule.allDaysGrouped.length === 0 ? (
                    <div className="p-4 bg-[#E1EBEC]/15 rounded-2xl border border-dashed border-[#E1EBEC] text-center space-y-2">
                      <AppIcon name="clock" size={24} className="text-slate/40 mx-auto" />
                      <p className="text-xs font-bold text-[#5F7083]">
                        {t('noStudentSchedulePrompt')}
                      </p>
                      <button
                        type="button"
                        onClick={() => onEditStudent(student)}
                        className="px-3 py-1.5 rounded-xl bg-[#17375E] text-[#FFFFFF] font-black text-xs inline-flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                      >
                        <AppIcon name="plus" size={14} />
                        <span>{t('addScheduleSlot')}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Days & Times list grouped by day */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {effectiveSchedule.allDaysGrouped.map((dayGroup) => (
                          <div
                            key={dayGroup.dayKey}
                            className="p-3 rounded-2xl bg-[#E1EBEC]/15 border border-[#E1EBEC] space-y-2 hover:border-[#17375E]/30 transition-all"
                          >
                            <div className="flex items-center justify-between border-b border-[#E1EBEC]/70 pb-1.5">
                              <span className="font-black text-xs text-[#0F2A4A] flex items-center gap-1.5">
                                <AppIcon name="calendar" size={14} className="text-navy" />
                                <span>{dayGroup.dayName}</span>
                              </span>
                              <span className="text-[10px] font-bold text-[#5F7083]">
                                {dayGroup.items.length} {isEn ? (dayGroup.items.length > 1 ? 'times' : 'time') : (dayGroup.items.length > 1 ? 'مواعيد' : 'موعد')}
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              {dayGroup.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="p-2 rounded-xl bg-[#FFFFFF] border border-[#E1EBEC] flex items-center justify-between gap-2 shadow-2xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="px-2 py-0.5 rounded-lg bg-[#17375E] text-[#FFFFFF] font-black text-xs tracking-wide shrink-0">
                                      {item.time}
                                    </span>
                                    <div className="min-w-0 truncate">
                                      <strong className="text-xs font-black text-[#0F2A4A] block truncate">
                                        {item.sourceTitle}
                                      </strong>
                                      <span className="text-[10px] text-[#5F7083] font-bold block truncate">
                                        {item.subject} {item.location ? `• ${item.location}` : ''}
                                      </span>
                                    </div>
                                  </div>

                                  <span
                                    className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                                      item.sourceType === 'private'
                                        ? 'bg-[#E1EBEC]/15 text-[#0F2A4A] border border-[#E1EBEC]'
                                        : 'bg-[#E1EBEC]/25 text-[#0F2A4A] border border-[#E1EBEC]'
                                    }`}
                                  >
                                    {item.sourceType === 'private'
                                      ? (isEn ? 'Private' : 'خاص')
                                      : (isEn ? 'Group' : 'مجموعة')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Breakdown by Service Type (Group vs Private) */}
                      <div className="pt-2 border-t border-[#E1EBEC] space-y-2">
                        {effectiveSchedule.groupSchedules.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-black text-[#5F7083] block">
                              {t('groupSchedules')}:
                            </span>
                            <div className="space-y-1">
                              {effectiveSchedule.groupSchedules.map((grp) => (
                                <div
                                  key={grp.groupId}
                                  className="p-2.5 rounded-xl bg-[#E1EBEC]/15 border border-[#E1EBEC] flex items-center justify-between text-xs flex-wrap gap-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full"
                                      style={{ backgroundColor: grp.accentColor }}
                                    />
                                    <strong className="font-black text-[#0F2A4A]">{grp.groupName}</strong>
                                    <span className="text-[11px] text-[#5F7083]">({grp.subject})</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {grp.items.map((itm) => (
                                      <span
                                        key={itm.id}
                                        className="px-2 py-0.5 rounded-lg bg-[#FFFFFF] border border-[#E1EBEC] font-bold text-[11px] text-[#0F2A4A]"
                                      >
                                        {itm.dayName} — {itm.time}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {effectiveSchedule.privateSchedules.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[11px] font-black text-[#0F2A4A] block">
                              {t('privateLessonSchedule')}:
                            </span>
                            <div className="space-y-1">
                              {effectiveSchedule.privateSchedules.map((priv, pIdx) => (
                                <div
                                  key={pIdx}
                                  className="p-2.5 rounded-xl bg-[#E1EBEC]/15 border border-[#E1EBEC] flex items-center justify-between text-xs flex-wrap gap-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <AppIcon name="sparkles" size={14} className="text-navy" />
                                    <strong className="font-black text-[#0F2A4A]">{priv.subject}</strong>
                                    {priv.location && (
                                      <span className="text-[11px] text-[#5F7083]">({priv.location})</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {priv.items.map((itm) => (
                                      <span
                                        key={itm.id}
                                        className="px-2 py-0.5 rounded-lg bg-[#FFFFFF] border border-[#E1EBEC] font-bold text-[11px] text-[#0F2A4A]"
                                      >
                                        {itm.dayName} — {itm.time}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Attendance & Behavioral Quick Bento Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Attendance Rate */}
                  <div className="classy-card p-4 bg-[#FFFFFF] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-[#0F2A4A] flex items-center gap-1.5">
                        <AppIcon name="calendarCheck" size={16} className="text-navy" />
                        <span>{isEn ? 'Attendance Rate' : 'معدل الحضور والالتزام'}</span>
                      </span>
                      <span className="text-xs font-black text-[#0F2A4A]">
                        {attendanceRate}%
                      </span>
                    </div>

                    <div className="w-full bg-[#E1EBEC]/25 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-[#17375E] to-[#0F2A4A] h-full rounded-full transition-all duration-300"
                        style={{ width: `${attendanceRate}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#5F7083] font-bold pt-1">
                      <span>{t('present')}: {presentCount}</span>
                      <span>{t('late')}: {lateCount}</span>
                      <span>{t('absentCharged')}: {absentChargedCount}</span>
                      <span>{t('absentExcused')}: {absentExcusedCount}</span>
                    </div>
                  </div>

                  {/* Behavior & Points */}
                  <div className="classy-card p-4 bg-[#FFFFFF] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-[#0F2A4A] flex items-center gap-1.5">
                        <AppIcon name="zap" size={16} className="text-navy" />
                        <span>{isEn ? 'Behavior Rating & Engagement' : 'التقييم السلوكي والتفاعل'}</span>
                      </span>
                      <span
                        className={`text-xs font-black ${
                          behaviorStats.totalPoints > 0
                            ? 'text-[#0F2A4A]'
                            : behaviorStats.totalPoints < 0
                            ? 'text-[#0F2A4A]'
                            : 'text-[#0F2A4A]'
                        }`}
                      >
                        {behaviorStats.totalPoints > 0
                          ? `+${behaviorStats.totalPoints}`
                          : behaviorStats.totalPoints}{' '}
                        {t('points')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold pt-1">
                      <div className="p-2 rounded-xl bg-[#E1EBEC]/65 text-[#0F2A4A] border border-[#17375E]/50">
                        <span className="text-[10px] block">{isEn ? 'Positive' : 'تميز وتفاعل'}</span>
                        <strong className="text-sm font-black">{behaviorStats.positiveCount}</strong>
                      </div>
                      <div className="p-2 rounded-xl bg-[#E1EBEC]/15 text-[#0F2A4A] border border-[#E1EBEC]">
                        <span className="text-[10px] block">{isEn ? 'Needs Attention' : 'يحتاج متابعة'}</span>
                        <strong className="text-sm font-black">{behaviorStats.needsImprovementCount}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Persistent Teacher Notes */}
                <div className="classy-card p-4 bg-[#FFFFFF] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-[#0F2A4A] flex items-center gap-1.5">
                      <AppIcon name="fileText" size={16} className="text-navy" />
                      <span>{isEn ? 'Teacher Private Notes:' : 'ملاحظات المعلم الخاصة عن الطالب:'}</span>
                    </span>
                    {isNotesSaved && (
                      <span className="text-[10px] font-bold text-[#0F2A4A] flex items-center gap-1 animate-in fade-in">
                        <AppIcon name="check" size={12} />
                        <span>{isEn ? 'Saved successfully' : 'تم الحفظ بنجاح'}</span>
                      </span>
                    )}
                  </div>

                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder={isEn ? 'Write notes on student progress, parent follow-ups, or curriculum goals...' : 'اكتب ملاحظاتك عن مستوى الطالب، متابعة ولي الأمر، أو خطة المنهج...'}
                    rows={3}
                    className="w-full p-3 rounded-2xl bg-[#E1EBEC]/15 border border-[#E1EBEC] text-xs text-[#0F2A4A] font-medium focus:outline-none focus:border-[#17375E] focus:bg-[#FFFFFF] transition-all shadow-inner"
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      className="px-4 py-2 rounded-xl bg-[#17375E] hover:bg-[#0F2A4A] text-[#FFFFFF] font-black text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
                    >
                      <AppIcon name="save" size={14} />
                      <span>{isEn ? 'Save Notes' : 'حفظ الملاحظات'}</span>
                    </button>
                  </div>
                </div>

                {/* Recent Activity Timeline Feed */}
                <div className="classy-card p-4 bg-[#FFFFFF] space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-xs text-[#0F2A4A] flex items-center gap-1.5">
                      <AppIcon name="activity" size={16} className="text-navy" />
                      <span>{isEn ? 'Recent Activity & Transactions' : 'سجل النشاط والعمليات الأخيرة'}</span>
                    </h3>
                  </div>

                  {latestActivities.length === 0 ? (
                    <p className="text-xs text-[#5F7083] font-bold text-center py-3">
                      {isEn ? 'No activity recorded yet for this student.' : 'لا يوجد نشاط مسجل للطالب بعد.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {latestActivities.map((act) => (
                        <div
                          key={act.id}
                          className="p-3 rounded-xl bg-[#E1EBEC]/15 border border-[#E1EBEC] flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <strong className="font-black text-[#0F2A4A] block truncate">
                              {act.title}
                            </strong>
                            <p className="text-[11px] text-[#5F7083] truncate">
                              {act.date} • {act.subtitle}
                            </p>
                          </div>
                          <span
                            className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 ${act.badgeColor}`}
                          >
                            {act.badge}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Safety Danger Zone: Archive / Delete */}
                <div className="p-3.5 rounded-2xl bg-[#E1EBEC]/15 border border-[#E1EBEC] flex items-center justify-between flex-wrap gap-2">
                  <div className="space-y-0.5">
                    <strong className="text-xs font-black text-[#0F2A4A] block">
                      {isEn ? 'Student Status & Archiving' : 'إدارة حالة الطالب والأرشفة'}
                    </strong>
                    <p className="text-[10px] text-[#5F7083]">
                      {isEn ? 'Archiving preserves all records and accounts, while permanent delete wipes data.' : 'أرشفة الطالب تحتفظ بكافة سجلاته وحساباته، بينما الحذف النهائي يزيل بياناته.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSafeDeleteModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#FFFFFF] text-[#0F2A4A] border border-[#E1EBEC] hover:bg-[#E1EBEC]/25 text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <AppIcon name="trash" size={14} />
                    <span>{isEn ? 'Archive or Delete' : 'أرشفة أو حذف'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 2: GROUPS ENROLLMENTS
                ------------------------------------------------------------- */}
            {activeSubTab === 'groups' && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-[#0F2A4A]">
                    {isEn ? `Enrolled Groups (${groupEnrollments.length})` : `المجموعات الدراسية المسجل بها (${groupEnrollments.length})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenEnrollModal(student)}
                    className="px-3 py-1.5 rounded-xl bg-[#17375E] hover:bg-[#0F2A4A] text-[#FFFFFF] font-black text-xs flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <AppIcon name="plus" size={14} />
                    <span>{isEn ? 'Enroll in Group' : 'تسجيل في مجموعة'}</span>
                  </button>
                </div>

                {groupEnrollments.length === 0 ? (
                  <div className="classy-card p-8 text-center space-y-3 bg-[#FFFFFF]">
                    <AppIcon name="layers" size={32} className="text-slate mx-auto opacity-40" />
                    <p className="text-xs font-bold text-[#5F7083]">
                      {isEn ? 'Student is not enrolled in any study group yet.' : 'الطالب مش مضاف لأي مجموعة دراسية حالياً.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => onOpenEnrollModal(student)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#17375E] to-[#0F2A4A] text-[#FFFFFF] font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <AppIcon name="plus" size={16} />
                      <span>{isEn ? 'Add Student to Group Now' : 'إضافة الطالب لمجموعة الآن'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {groupEnrollments.map((enr) => (
                      <div
                        key={enr.enrollmentId}
                        className="classy-card p-4 bg-[#FFFFFF] border-[#E1EBEC] hover:border-[#17375E]/40 transition-all space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: enr.accentColor || '#17375E' }}
                              />
                              <h4 className="font-black text-sm text-[#0F2A4A]">{enr.groupName}</h4>
                              <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-[#E1EBEC]/25 text-[#0F2A4A]">
                                {getBillingModeLabel(enr.billingType, enr.billingMode)}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#5F7083]">
                              {isEn ? 'Class Price:' : 'سعر الحصة المقرر:'} <strong className="text-[#0F2A4A]">{enr.customPrice} {t('currency')}</strong>
                            </p>
                            {renderEnrollmentPeriodStatusPill(enr.enrollmentId)}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditEnrollment(enr.enrollmentId)}
                              className="p-1.5 rounded-lg bg-[#E1EBEC]/15 hover:bg-[#E1EBEC]/35 text-[#5F7083] hover:text-[#0F2A4A] border border-[#E1EBEC] transition-colors cursor-pointer"
                              title={isEn ? 'Edit Pricing & Period' : 'تعديل شروط التسعير وفترة الاشتراك'}
                            >
                              <AppIcon name="edit" size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveEnrollment(enr.enrollmentId, enr.groupName)}
                              className="p-1.5 rounded-lg bg-[#E1EBEC]/15 hover:bg-[#E1EBEC]/35 text-[#0F2A4A] border border-[#E1EBEC] transition-colors cursor-pointer"
                              title={isEn ? 'Unenroll Student' : 'إلغاء قيد الطالب من المجموعة'}
                            >
                              <AppIcon name="trash" size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Inline Billing & Operational Period Editor */}
                        {editingEnrollmentId === enr.enrollmentId && (
                          <div className="p-3 bg-[#E1EBEC]/15 rounded-2xl border border-[#E1EBEC] space-y-2.5 text-xs">
                            <span className="font-black text-[#0F2A4A] block">{isEn ? 'Edit Billing & Operational Period:' : 'تعديل نظام المحاسبة وفترة الحصص:'}</span>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-[#5F7083] font-bold mb-1">
                                  {isEn ? 'Billing Mode' : 'نظام المحاسبة'}
                                </label>
                                <select
                                  value={editBillingMode}
                                  onChange={(e) => setEditBillingMode(e.target.value as BillingMode)}
                                  className="w-full p-2 rounded-xl bg-[#FFFFFF] border border-[#E1EBEC] text-xs font-bold text-[#0F2A4A]"
                                >
                                  <option value="prepaid">{isEn ? 'Prepaid Per Session' : 'دفع مسبق بالحصة'}</option>
                                  <option value="postpaid">{isEn ? 'Postpaid (Pay After)' : 'دفع بعد الحصة (آجل)'}</option>
                                  <option value="monthly">{isEn ? 'Monthly Subscription' : 'اشتراك شهري'}</option>
                                  <option value="package">{isEn ? 'Session Package' : 'باقة حصص'}</option>
                                  <option value="hourly">{isEn ? 'Hourly Rate' : 'محاسبة بالساعة'}</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] text-[#5F7083] font-bold mb-1">
                                  {isEn ? `Price (${t('currency')})` : `السعر المخصص (${t('currency')})`}
                                </label>
                                <input
                                  type="number"
                                  value={editBillingMode === 'hourly' ? editHourlyRate : editBillingMode === 'package' ? editPackagePrice : editCustomPrice}
                                  onChange={(e) => {
                                    const num = Number(e.target.value);
                                    if (editBillingMode === 'hourly') setEditHourlyRate(num);
                                    else if (editBillingMode === 'package') setEditPackagePrice(num);
                                    else setEditCustomPrice(num);
                                  }}
                                  className="w-full p-2 rounded-xl bg-[#FFFFFF] border border-[#E1EBEC] text-xs font-bold text-[#0F2A4A]"
                                />
                              </div>
                            </div>

                            <EnrollmentPeriodFields
                              value={editPeriodValue}
                              onChange={(next) => {
                                setEditPeriodError(null);
                                setEditPeriodValue(next);
                              }}
                              compact
                              externalError={editPeriodError}
                            />

                            <div className="flex justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingEnrollmentId(null)}
                                className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#E1EBEC] text-xs font-bold text-[#5F7083]"
                              >
                                {t('cancel')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEnrollmentBilling(enr.enrollmentId)}
                                className="px-3.5 py-1.5 rounded-xl bg-[#17375E] text-[#FFFFFF] text-xs font-black shadow-xs"
                              >
                                {t('save')}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Financial Metrics Strip */}
                        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                          <div className="p-2 bg-[#E1EBEC]/15 rounded-xl border border-[#E1EBEC]">
                            <span className="text-[#5F7083] block font-bold">{isEn ? 'Used' : 'الحصص المستهلكة'}</span>
                            <strong className="text-xs font-black text-[#0F2A4A]">
                              {enr.usedSessionsCount || 0}
                            </strong>
                          </div>
                          <div className="p-2 bg-[#E1EBEC]/15 rounded-xl border border-[#E1EBEC]">
                            <span className="text-[#5F7083] block font-bold">{isEn ? 'Credit' : 'رصيد الحصص'}</span>
                            <strong className="text-xs font-black text-[#17375E]">
                              {enr.sessionCredit || 0}
                            </strong>
                          </div>
                          <div className="p-2 bg-[#E1EBEC]/15 rounded-xl border border-[#E1EBEC]">
                            <span className="text-[#5F7083] block font-bold">{isEn ? 'Paid' : 'المدفوع'}</span>
                            <strong className="text-xs font-black text-[#0F2A4A]">
                              {enr.totalPaid} {t('currency')}
                            </strong>
                          </div>
                          <div
                            className={`p-2 rounded-xl border ${
                              enr.remaining > 0
                                ? 'bg-[#E1EBEC]/15 border-[#E1EBEC] text-[#0F2A4A]'
                                : 'bg-[#E1EBEC]/15 border-[#E1EBEC] text-[#0F2A4A]'
                            }`}
                          >
                            <span className="block font-bold">{isEn ? 'Remaining' : 'المتبقي'}</span>
                            <strong className="text-xs font-black">{enr.remaining} {t('currency')}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 3: PRIVATE LESSONS
                ------------------------------------------------------------- */}
            {activeSubTab === 'private' && (
              <div className="space-y-3.5">
                {/* Today's Private Lessons Summary (Feature 1 & Feature 3) */}
                {todayPrivateSummary && todayPrivateSummary.visitsCount > 0 && (
                  <div className="classy-card p-4 bg-gradient-to-r from-[#FFFFFF] via-[#FFFFFF] to-[#FFFFFF] border-[#E1EBEC] space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#E1EBEC]/15 text-[#0F2A4A] flex items-center justify-center font-black">
                          <AppIcon name="calendar" size={16} />
                        </div>
                        <div>
                          <h3 className="font-black text-xs sm:text-sm text-[#0F2A4A] flex items-center gap-1.5">
                            <span>{isEn ? "Today's Private Lessons" : 'دروس اليوم الخاصة'}</span>
                          </h3>
                          <p className="text-[11px] text-[#5F7083] font-medium">
                            {student.name} • {todayPrivateSummary.date}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {todayPrivateSummary.hasIncomplete && (
                          <StatusBadge
                            status="incomplete"
                            label={
                              isEn
                                ? `${todayPrivateSummary.incompleteCount} need(s) completion`
                                : `${todayPrivateSummary.incompleteCount} حصة تحتاج استكمال`
                            }
                          />
                        )}
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#E1EBEC]/15 text-[#0F2A4A] border border-[#E1EBEC]">
                          {todayPrivateSummary.visitsCount} {isEn ? (todayPrivateSummary.visitsCount === 1 ? 'Appointment' : 'Appointments') : (todayPrivateSummary.visitsCount === 1 ? 'موعد' : 'مواعيد')}
                        </span>
                      </div>
                    </div>

                    {/* List of Today's Sessions */}
                    <div className="space-y-2">
                      {todayPrivateSummary.sessions.map((sesItem) => {
                        const isPres = sesItem.status === 'present' || sesItem.status === 'late';
                        const isHourly = sesItem.billingMode === 'hourly';

                        return (
                          <div
                            key={sesItem.occurrenceId}
                            className={`p-3 rounded-2xl border flex items-center justify-between gap-2.5 transition-all ${
                              sesItem.isIncomplete
                                ? 'bg-[#E1EBEC]/80 border-[#0F2A4A]/50'
                                : isPres
                                ? 'bg-[#FFFFFF] border-[#17375E]/50 shadow-2xs'
                                : 'bg-[#E1EBEC]/15 border-[#E1EBEC]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="px-2.5 py-1 rounded-xl bg-[#17375E] text-[#FFFFFF] font-black text-xs shrink-0">
                                {sesItem.time}
                              </div>
                              <div className="min-w-0">
                                <strong className="text-xs font-black text-[#0F2A4A] block truncate">
                                  {sesItem.subject}
                                </strong>
                                <span className="text-[11px] text-[#5F7083] block">
                                  {sesItem.status === 'unrecorded'
                                    ? (isEn ? 'Scheduled • Not recorded yet' : 'مجدول • لم يُرصد بعد')
                                    : isPres
                                    ? (isEn ? '✓ Present' : '✓ حضر')
                                    : (isEn ? 'Absent' : 'لم يحضر')}
                                  {isPres && (
                                    <span className="font-black text-[#17375E] ms-1">
                                      • {isHourly ? `${sesItem.hours || 0} ${isEn ? 'Hours' : 'ساعة'}` : `${sesItem.sessionUnits || 0} ${isEn ? 'Session(s)' : 'حصة'}`}
                                    </span>
                                  )}
                                </span>
                                {(() => {
                                  const sesAtt = sesItem.sessionId
                                    ? attendanceList.find((a) => a.sessionId === sesItem.sessionId)
                                    : undefined;
                                  if (!sesAtt?.behaviorRating && !sesAtt?.homeworkRating) return null;
                                  return (
                                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                      {sesAtt.behaviorRating && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#DCEDEB]/70 text-[#0F2A4A] border border-[#E1EBEC]">
                                          <AppIcon name="star" size={10} weight="fill" className="text-[#F5A04A]" />
                                          <span>{isEn ? 'Behavior:' : 'السلوك:'} {getBehaviorRatingLabel(sesAtt.behaviorRating, isEn)}</span>
                                        </span>
                                      )}
                                      {sesAtt.homeworkRating && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#DCEDEB]/70 text-[#0F2A4A] border border-[#E1EBEC]">
                                          <AppIcon name="book" size={10} weight="fill" className="text-[#17375E]" />
                                          <span>{isEn ? 'Homework:' : 'الواجب:'} {getHomeworkRatingLabel(sesAtt.homeworkRating, isEn)}</span>
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {sesItem.isIncomplete ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const actualSession = allSessions.find((s) => s.id === sesItem.sessionId);
                                    if (actualSession) {
                                      setSelectedPrivateIntakeSession({ session: actualSession, item: sesItem });
                                    }
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-[#E1EBEC]/700 hover:bg-[#0F2A4A] text-[#FFFFFF] font-black text-[10px] flex items-center gap-1 shadow-sm cursor-pointer active:scale-95"
                                >
                                  <span>⚠️</span>
                                  <span>{isEn ? 'Complete Session' : 'استكمال تفاصيل الحصة'}</span>
                                </button>
                              ) : sesItem.status !== 'unrecorded' && sesItem.sessionId ? (
                                <div className="text-right">
                                  {isPres && (
                                    <span className="text-xs font-black text-[#0F2A4A] block">
                                      {sesItem.price} {t('currency')}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const actualSession = allSessions.find((s) => s.id === sesItem.sessionId);
                                      if (actualSession) {
                                        setSelectedPrivateIntakeSession({ session: actualSession, item: sesItem });
                                      }
                                    }}
                                    className="text-[10px] text-[#17375E] font-bold hover:underline cursor-pointer"
                                  >
                                    {isEn ? 'Edit' : 'تعديل'}
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Daily Totals Bar */}
                    <div className="p-3 rounded-xl bg-[#FFFFFF] border border-[#E1EBEC] flex items-center justify-between text-xs">
                      <span className="font-bold text-[#5F7083]">
                        {isEn ? "Today's Total:" : 'إجمالي اليوم:'}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-black text-[#17375E]">
                          {todayPrivateSummary.totalUnitsOrHoursText}
                        </span>
                        <span className="text-sm font-black text-[#0F2A4A]">
                          {todayPrivateSummary.totalAmount} {t('currency')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-black text-xs text-[#0F2A4A]">
                    {isEn ? `Private Services & Tutoring (${privateEnrollments.length})` : `الخدمات والدروس الخاصة (${privateEnrollments.length})`}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setIsRecordPrivateModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#17375E] to-[#0F2A4A] text-[#FFFFFF] font-black text-xs flex items-center gap-1.5 shadow-md shadow-[#0F2A4A]/30 transition-all active:scale-95 cursor-pointer hover:brightness-105"
                    >
                      <AppIcon name="sparkles" size={14} />
                      <span>{isEn ? 'Record Private Class' : 'رصد حصة خاصة'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingPrivateService(!isAddingPrivateService)}
                      className="px-3 py-1.5 rounded-xl bg-[#E1EBEC]/25 hover:bg-[#E1EBEC]/45 text-[#17375E] font-black text-xs flex items-center gap-1 border border-[#E1EBEC] transition-all active:scale-95 cursor-pointer"
                    >
                      <AppIcon name="plus" size={14} />
                      <span>{isEn ? 'New Service' : 'خدمة جديدة'}</span>
                    </button>
                  </div>
                </div>

                {/* Add Private Service Drawer Form */}
                {isAddingPrivateService && (
                  <form
                    onSubmit={handleCreatePrivateService}
                    className="classy-card p-4 bg-[#FFFFFF] border-[#E1EBEC] space-y-3 shadow-md"
                  >
                    <div className="flex items-center justify-between border-b border-[#E1EBEC] pb-2">
                      <span className="font-black text-xs text-[#0F2A4A]">
                        {isEn ? 'Configure New Private Tutoring Service:' : 'إعداد وتخصيص خدمة درس خاص جديدة:'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAddingPrivateService(false)}
                        className="text-[#5F7083] hover:text-[#0F2A4A]"
                      >
                        <AppIcon name="close" size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div>
                        <label className="block text-[10px] text-[#5F7083] font-bold mb-1">
                          {isEn ? 'Subject / Topic' : 'المادة / موضوع الدرس'}
                        </label>
                        <input
                          type="text"
                          value={newPrivateSubject}
                          onChange={(e) => setNewPrivateSubject(e.target.value)}
                          placeholder={isEn ? 'e.g. English - Private' : 'مثال: لغة إنجليزية - خاص'}
                          className="w-full p-2.5 rounded-xl bg-[#E1EBEC]/15 border border-[#E1EBEC] font-bold text-xs text-[#0F2A4A]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-[#5F7083] font-bold mb-1">
                          {isEn ? 'Billing Mode' : 'نظام المحاسبة'}
                        </label>
                        <select
                          value={newPrivateBillingMode}
                          onChange={(e) =>
                            setNewPrivateBillingMode(e.target.value as BillingMode)
                          }
                          className="w-full p-2.5 rounded-xl bg-[#E1EBEC]/15 border border-[#E1EBEC] font-bold text-xs text-[#0F2A4A]"
                        >
                          <option value="postpaid">{isEn ? 'Postpaid (Pay After Class)' : 'دفع آجل (بعد الحصة)'}</option>
                          <option value="prepaid">{isEn ? 'Prepaid (Credit Balance)' : 'دفع مسبق (شحن رصيد)'}</option>
                          <option value="monthly">{isEn ? 'Monthly Subscription' : 'اشتراك شهري'}</option>
                          <option value="package">{isEn ? 'Session Package' : 'باقة حصص'}</option>
                          <option value="hourly">{isEn ? 'Hourly Rate' : 'محاسبة بالساعة (Hourly)'}</option>
                        </select>
                      </div>

                      {newPrivateBillingMode === 'hourly' ? (
                        <div>
                          <label className="block text-[10px] text-[#5F7083] font-bold mb-1">
                            {isEn ? `Hourly Rate (${t('currency')})` : `سعر الساعة (${t('currency')})`}
                          </label>
                          <input
                            type="number"
                            value={newPrivateHourlyRate}
                            onChange={(e) => setNewPrivateHourlyRate(Number(e.target.value))}
                            className="w-full p-2.5 rounded-xl bg-[#E1EBEC]/15 border border-[#E1EBEC] font-bold text-xs text-[#0F2A4A]"
                            required
                          />
                        </div>
                      ) : newPrivateBillingMode === 'package' ? (
                        <>
                          <div>
                            <label className="block text-[10px] text-[#5F7083] font-bold mb-1">
                              {isEn ? 'Package Sessions Count' : 'عدد حصص الباقة'}
                            </label>
                            <input
                              type="number"
                              value={newPrivatePackageSessions}
                              onChange={(e) =>
                                setNewPrivatePackageSessions(Number(e.target.value))
                              }
                              className="w-full p-2.5 rounded-xl bg-[#E1EBEC]/15 border border-[#E1EBEC] font-bold text-xs text-[#0F2A4A]"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#5F7083] font-bold mb-1">
                              {isEn ? `Package Total Price (${t('currency')})` : `إجمالي سعر الباقة (${t('currency')})`}
                            </label>
                            <input
                              type="number"
                              value={newPrivatePackagePrice}
                              onChange={(e) => setNewPrivatePackagePrice(Number(e.target.value))}
                              className="w-full p-2.5 rounded-xl bg-[#E1EBEC]/15 border border-[#E1EBEC] font-bold text-xs text-[#0F2A4A]"
                              required
                            />
                          </div>
                        </>
                      ) : (
                        <div>
                          <label className="block text-[10px] text-[#5F7083] font-bold mb-1">
                            {isEn ? `Session Price (${t('currency')})` : `سعر الحصة (${t('currency')})`}
                          </label>
                          <input
                            type="number"
                            value={newPrivatePrice}
                            onChange={(e) => setNewPrivatePrice(Number(e.target.value))}
                            className="w-full p-2.5 rounded-xl bg-[#E1EBEC]/15 border border-[#E1EBEC] font-bold text-xs text-[#0F2A4A]"
                            required
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] text-[#5F7083] font-bold mb-1">
                          {isEn ? 'Location' : 'مكان الدرس'}
                        </label>
                        <input
                          type="text"
                          value={newPrivateLocation}
                          onChange={(e) => setNewPrivateLocation(e.target.value)}
                          placeholder={isEn ? "e.g. Student's Home or Center" : 'مثال: منزل الطالب أو السنتر'}
                          className="w-full p-2.5 rounded-xl bg-[#E1EBEC]/15 border border-[#E1EBEC] font-bold text-xs text-[#0F2A4A]"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingPrivateService(false)}
                        className="px-4 py-2 rounded-xl bg-[#E1EBEC]/15 text-[#5F7083] font-bold text-xs"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#17375E] to-[#0F2A4A] text-[#FFFFFF] font-black text-xs shadow-md shadow-[#0F2A4A]/30"
                      >
                        {isEn ? 'Save Private Lesson' : 'حفظ وإنشاء الدرس الخاص'}
                      </button>
                    </div>
                  </form>
                )}

                {privateEnrollments.length === 0 ? (
                  <div className="classy-card p-8 text-center space-y-3 bg-[#FFFFFF]">
                    <AppIcon name="sparkles" className="w-8 h-8 text-[#0F2A4A] mx-auto opacity-50" />
                    <p className="text-xs font-bold text-[#5F7083]">
                      {isEn ? 'No private lessons registered yet for this student.' : 'مفيش دروس خاصة مسجلة للطالب حتى الآن.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAddingPrivateService(true)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#17375E] to-[#0F2A4A] text-[#FFFFFF] font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <AppIcon name="plus" size={16} />
                      <span>{isEn ? 'Add First Private Lesson' : 'إضافة أول درس خاص للطالب'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {privateEnrollments.map((enr) => (
                      <div
                        key={enr.enrollmentId}
                        className="classy-card p-4 bg-[#FFFFFF] border-[#E1EBEC] hover:border-[#0F2A4A]/60 transition-all space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#0F2A4A]" />
                              <h4 className="font-black text-sm text-[#0F2A4A]">{enr.groupName}</h4>
                              <span className="text-[10px] font-black px-2 py-0.2 rounded-full bg-[#E1EBEC]/15 text-[#0F2A4A] border border-[#E1EBEC]">
                                {getBillingModeLabel(enr.billingType, enr.billingMode)}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#5F7083]">
                              {enr.billingMode === 'hourly' || enr.billingType === 'hourly'
                                ? (isEn ? `Hourly Rate: ${enr.customPrice} ${t('currency')}` : `سعر الساعة: ${enr.customPrice} ج.م`)
                                : (isEn ? `Session Price: ${enr.customPrice} ${t('currency')}` : `سعر الحصة: ${enr.customPrice} ج.م`)}
                            </p>
                            {renderEnrollmentPeriodStatusPill(enr.enrollmentId)}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setIsRecordPrivateModalOpen(true)}
                              className="px-2 py-1 rounded-lg bg-[#17375E] hover:bg-[#0F2A4A] text-[#FFFFFF] text-[11px] font-black flex items-center gap-1 shadow-xs transition-colors cursor-pointer active:scale-95"
                              title={isEn ? 'Record Private Lesson' : 'رصد حصة خاصة'}
                            >
                              <AppIcon name="sparkles" size={12} className="text-[#E1EBEC]" />
                              <span>{isEn ? 'Record' : 'رصد'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEditEnrollment(enr.enrollmentId)}
                              className="p-1.5 rounded-lg bg-[#E1EBEC]/15 hover:bg-[#E1EBEC]/35 text-[#5F7083] hover:text-[#0F2A4A] border border-[#E1EBEC] transition-colors cursor-pointer"
                              title={isEn ? 'Edit Pricing & Period' : 'تعديل شروط التسعير وفترة الاشتراك'}
                            >
                              <AppIcon name="edit" size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveEnrollment(enr.enrollmentId, enr.groupName)}
                              className="p-1.5 rounded-lg bg-[#E1EBEC]/15 hover:bg-[#E1EBEC]/35 text-[#0F2A4A] border border-[#E1EBEC] transition-colors cursor-pointer"
                              title={isEn ? 'Delete Private Lesson' : 'إلغاء خدمة الدرس الخاص'}
                            >
                              <AppIcon name="trash" size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Inline Billing & Operational Period Editor for Private Service */}
                        {editingEnrollmentId === enr.enrollmentId && (
                          <div className="p-3 bg-[#E1EBEC]/15 rounded-2xl border border-[#E1EBEC] space-y-2.5 text-xs">
                            <span className="font-black text-[#0F2A4A] block">{isEn ? 'Edit Billing & Operational Period:' : 'تعديل نظام المحاسبة وفترة الحصص:'}</span>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-[#5F7083] font-bold mb-1">
                                  {isEn ? 'Billing Mode' : 'نظام المحاسبة'}
                                </label>
                                <select
                                  value={editBillingMode}
                                  onChange={(e) => setEditBillingMode(e.target.value as BillingMode)}
                                  className="w-full p-2 rounded-xl bg-[#FFFFFF] border border-[#E1EBEC] text-xs font-bold text-[#0F2A4A]"
                                >
                                  <option value="prepaid">{isEn ? 'Prepaid Per Session' : 'دفع مسبق بالحصة'}</option>
                                  <option value="postpaid">{isEn ? 'Postpaid (Pay After)' : 'دفع بعد الحصة (آجل)'}</option>
                                  <option value="monthly">{isEn ? 'Monthly Subscription' : 'اشتراك شهري'}</option>
                                  <option value="package">{isEn ? 'Session Package' : 'باقة حصص'}</option>
                                  <option value="hourly">{isEn ? 'Hourly Rate' : 'محاسبة بالساعة'}</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] text-[#5F7083] font-bold mb-1">
                                  {isEn ? `Price (${t('currency')})` : `السعر المخصص (${t('currency')})`}
                                </label>
                                <input
                                  type="number"
                                  value={editBillingMode === 'hourly' ? editHourlyRate : editBillingMode === 'package' ? editPackagePrice : editCustomPrice}
                                  onChange={(e) => {
                                    const num = Number(e.target.value);
                                    if (editBillingMode === 'hourly') setEditHourlyRate(num);
                                    else if (editBillingMode === 'package') setEditPackagePrice(num);
                                    else setEditCustomPrice(num);
                                  }}
                                  className="w-full p-2 rounded-xl bg-[#FFFFFF] border border-[#E1EBEC] text-xs font-bold text-[#0F2A4A]"
                                />
                              </div>
                            </div>

                            <EnrollmentPeriodFields
                              value={editPeriodValue}
                              onChange={(next) => {
                                setEditPeriodError(null);
                                setEditPeriodValue(next);
                              }}
                              compact
                              externalError={editPeriodError}
                            />

                            <div className="flex justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingEnrollmentId(null)}
                                className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#E1EBEC] text-xs font-bold text-[#5F7083]"
                              >
                                {t('cancel')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEnrollmentBilling(enr.enrollmentId)}
                                className="px-3.5 py-1.5 rounded-xl bg-[#17375E] text-[#FFFFFF] text-xs font-black shadow-xs"
                              >
                                {t('save')}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Financial & Workload Metrics Strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center text-[10px]">
                          <div className="p-2 bg-[#E1EBEC]/15 rounded-xl border border-[#E1EBEC]">
                            <span className="text-[#5F7083] block font-bold">
                              {enr.billingMode === 'hourly' || enr.billingType === 'hourly'
                                ? (isEn ? 'Logged Duration' : 'الساعات المنفذة')
                                : (isEn ? 'Completed Lessons' : 'الحصص المنفذة')}
                            </span>
                            <strong className="text-xs font-black text-[#0F2A4A]">
                              {enr.billingMode === 'hourly' || enr.billingType === 'hourly'
                                ? (isEn ? `${enr.totalHours ?? 0} hrs` : `${enr.totalHours ?? 0} ساعة`)
                                : `${enr.attendedSessionsCount || enr.usedSessionsCount || 0} ${isEn ? 'Lessons' : 'حصة'}`}
                            </strong>
                            <span className="text-[9px] text-[#5F7083] block mt-0.5">
                              {enr.actualOccurrencesCount || 0} {isEn ? 'sessions' : 'جلسة'}
                            </span>
                          </div>

                          <div className="p-2 bg-[#E1EBEC]/70 rounded-xl border border-[#17375E]/50">
                            <span className="text-[#0F2A4A] block font-bold">
                              {enr.billingMode === 'hourly' || enr.billingType === 'hourly'
                                ? (isEn ? 'Paid Amount' : 'المسدد')
                                : (isEn ? 'Paid Lessons' : 'الحصص المسددة')}
                            </span>
                            <strong className="text-xs font-black text-[#0F2A4A]">
                              {enr.billingMode === 'hourly' || enr.billingType === 'hourly'
                                ? `${enr.totalPaid} ${t('currency')}`
                                : `${enr.paidLessonsCount ?? enr.settledSessionsCount ?? 0} ${isEn ? 'Lessons' : 'حصة'}`}
                            </strong>
                            <span className="text-[9px] text-[#17375E] block mt-0.5">
                              {enr.totalPaid} {t('currency')}
                            </span>
                          </div>

                          <div className={`p-2 rounded-xl border ${
                            enr.remaining > 0
                              ? 'bg-[#E1EBEC]/15 border-[#E1EBEC] text-[#0F2A4A]'
                              : 'bg-[#E1EBEC]/15 border-[#E1EBEC] text-[#0F2A4A]'
                          }`}>
                            <span className="block font-bold">
                              {enr.billingMode === 'hourly' || enr.billingType === 'hourly'
                                ? (isEn ? 'Unpaid Hours' : 'الساعات المتبقية')
                                : (isEn ? 'Unpaid Lessons' : 'الحصص المتبقية')}
                            </span>
                            <strong className="text-xs font-black">
                              {enr.billingMode === 'hourly' || enr.billingType === 'hourly'
                                ? (isEn ? `${enr.unpaidHours ?? 0} hrs` : `${enr.unpaidHours ?? 0} ساعة`)
                                : `${enr.unpaidLessonsCount ?? enr.unpaidSessionsCount ?? 0} ${isEn ? 'Lessons' : 'حصة'}`}
                            </strong>
                            <span className="text-[9px] block mt-0.5 font-bold">
                              {enr.remaining} {t('currency')}
                            </span>
                          </div>

                          <div className="p-2 bg-[#E1EBEC]/15 rounded-xl border border-[#E1EBEC]">
                            <span className="text-[#5F7083] block font-bold">
                              {enr.billingMode === 'package' ? (isEn ? 'Package Credit' : 'رصيد الباقة') : (isEn ? 'Balance Credit' : 'الرصيد الدائن')}
                            </span>
                            <strong className="text-xs font-black text-[#17375E]">
                              {enr.sessionCredit || 0} {isEn ? 'rem.' : 'متبقي'}
                            </strong>
                            <span className="text-[9px] text-[#5F7083] block mt-0.5">
                              {enr.financialCredit || 0} {t('currency')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 4: FINANCES & BILLING BREAKDOWN
                ------------------------------------------------------------- */}
            {activeSubTab === 'finances' && (
              <div className="space-y-4">
                {/* Grand Financial Overview Card */}
                <div className="classy-card p-4 bg-[#FFFFFF] space-y-3 border-[#17375E]/50">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-[#0F2A4A] flex items-center gap-1.5">
                      <AppIcon name="wallet" size={16} className="text-[#17375E]" />
                      <span>{isEn ? 'Grand Financial Summary:' : 'الحساب المالي الإجمالي للطالب:'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenAddPayment(student)}
                      className="px-3 py-1 rounded-xl bg-gradient-to-r from-[#0F2A4A] to-[#5F7083] text-[#FFFFFF] font-black text-xs flex items-center gap-1 shadow-xs active:scale-95"
                    >
                      <AppIcon name="plus" size={14} />
                      <span>{t('recordPayment')}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-[#E1EBEC]/15 border border-[#E1EBEC]">
                      <span className="text-[10px] text-[#5F7083] font-bold block">
                        {isEn ? 'Total Fees (Gross)' : 'إجمالي الرسوم (Gross)'}
                      </span>
                      <strong className="text-sm sm:text-base font-black text-[#0F2A4A] mt-0.5 block">
                        {grandFinancials.grandTotalDue} {t('currency')}
                      </strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#E1EBEC]/65 border border-[#17375E]/50 text-[#0F2A4A]">
                      <span className="text-[10px] font-bold block">{t('totalCollected')}</span>
                      <strong className="text-sm sm:text-base font-black mt-0.5 block">
                        {grandFinancials.grandTotalPaid} {t('currency')}
                      </strong>
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border ${
                        grandFinancials.grandRemaining > 0
                          ? 'bg-[#E1EBEC]/15 border-[#E1EBEC] text-[#0F2A4A]'
                          : 'bg-[#E1EBEC]/65 border-[#17375E]/50 text-[#0F2A4A]'
                      }`}
                    >
                      <span className="text-[10px] font-bold block">{t('remainingBalance')}</span>
                      <strong className="text-sm sm:text-base font-black mt-0.5 block">
                        {grandFinancials.grandRemaining} {t('currency')}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Services Financial Breakdown (Group vs Private) */}
                <div className="classy-card p-4 bg-[#FFFFFF] space-y-3">
                  <h4 className="font-black text-xs text-[#0F2A4A] flex items-center gap-1.5">
                    <AppIcon name="layers" size={16} className="text-[#17375E]" />
                    <span>{isEn ? 'Group vs Private Fees Comparison:' : 'مقارنة الرسوم بين المجموعات والدروس الخاصة:'}</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-[#E1EBEC]/15 border border-[#E1EBEC] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-[#0F2A4A]">{isEn ? 'Group Classes' : 'خدمات المجموعات'}</span>
                        <span className="text-[10px] font-bold text-[#5F7083]">
                          {grandFinancials.groupsFinancials.enrollments.length} {t('groups')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-[#E1EBEC]">
                        <span>{isEn ? 'Paid' : 'المسدد'}: {grandFinancials.groupsFinancials.totalPaid} {t('currency')}</span>
                        <span
                          className={
                            grandFinancials.groupsFinancials.remaining > 0
                              ? 'text-[#0F2A4A]'
                              : 'text-[#0F2A4A]'
                          }
                        >
                          {isEn ? 'Due' : 'المتبقي'}: {grandFinancials.groupsFinancials.remaining} {t('currency')}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-[#E1EBEC]/15 border border-[#E1EBEC] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-[#0F2A4A]">{isEn ? 'Private Lessons' : 'الدروس الخاصة'}</span>
                        <span className="text-[10px] font-bold text-[#5F7083]">
                          {grandFinancials.privateFinancials.enrollments.length} {isEn ? 'services' : 'خدمات خاصة'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-[#E1EBEC]">
                        <span>{isEn ? 'Paid' : 'المسدد'}: {grandFinancials.privateFinancials.totalPaid} {t('currency')}</span>
                        <span
                          className={
                            grandFinancials.privateFinancials.remaining > 0
                              ? 'text-[#0F2A4A]'
                              : 'text-[#0F2A4A]'
                          }
                        >
                          {isEn ? 'Due' : 'المتبقي'}: {grandFinancials.privateFinancials.remaining} {t('currency')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 5: ATTENDANCE & SESSIONS TIMELINE
                ------------------------------------------------------------- */}
            {activeSubTab === 'attendance' && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-[#0F2A4A]">
                    {isEn ? `Attendance History (${sortedSessionHistory.length})` : `سجل الحصص المنفذة والحضور (${sortedSessionHistory.length})`}
                  </span>
                  <span className="text-xs font-black text-[#0F2A4A] bg-[#E1EBEC]/65 px-2.5 py-1 rounded-xl border border-[#17375E]/50">
                    {isEn ? `Rate: ${attendanceRate}%` : `معدل الالتزام: ${attendanceRate}%`}
                  </span>
                </div>

                {sortedSessionHistory.length === 0 ? (
                  <div className="classy-card p-8 text-center space-y-3 bg-[#FFFFFF]">
                    <AppIcon name="calendarCheck" className="w-8 h-8 text-[#5F7083] mx-auto opacity-40" />
                    <p className="text-xs font-bold text-[#5F7083]">
                      {isEn ? 'No attendance records yet for this student.' : 'مفيش سجلات حضور مسجلة للطالب حتى الآن.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {sortedSessionHistory.map((item) => {
                      const att = item.attendance;
                      const session = item.session;
                      const isPrivate = item.isPrivate;
                      const isUnpaid = item.isUnpaid;

                      return (
                        <div
                          key={item.id}
                          className={`classy-card p-3.5 transition-all space-y-2 text-xs ${
                            item.isAbsentCharged
                              ? 'bg-[#FFF5F5] border-[#FF647C]/40 hover:border-[#E53935]/60 shadow-2xs'
                              : item.isAbsentFree
                              ? 'bg-[#FFF8F8] border-[#FF647C]/30 hover:border-[#FF647C]/50 shadow-2xs'
                              : 'bg-[#FFFFFF] border-[#E1EBEC] hover:border-[#17375E]/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {/* Dot indicator: distinct Red for absence */}
                              <span
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                  item.isAbsentCharged
                                    ? 'bg-[#E53935] ring-2 ring-[#E53935]/25'
                                    : item.isAbsentFree
                                    ? 'bg-[#FF647C] ring-2 ring-[#FF647C]/25'
                                    : item.isLate
                                    ? 'bg-[#D97706]'
                                    : item.isExcused
                                    ? 'bg-[#64748B]'
                                    : isPrivate
                                    ? 'bg-[#0F2A4A]'
                                    : 'bg-[#17375E]'
                                }`}
                              />
                              <strong className="font-black text-[#0F2A4A]">
                                {item.title}
                              </strong>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                                  isPrivate
                                    ? 'bg-[#E1EBEC]/15 text-[#0F2A4A] border border-[#E1EBEC]'
                                    : 'bg-[#E1EBEC]/25 text-[#0F2A4A]'
                                }`}
                              >
                                {isPrivate ? (isEn ? 'Private' : 'خاص') : (isEn ? 'Group' : 'مجموعة')}
                              </span>

                              {/* Distinct red pill indicator for absences */}
                              {item.isAbsentCharged && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#E53935]/10 text-[#E53935] border border-[#E53935]/20 shrink-0">
                                  {isEn ? 'Charged' : 'محسوب'}
                                </span>
                              )}
                              {item.isAbsentFree && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#FF647C]/10 text-[#FF647C] border border-[#FF647C]/20 shrink-0">
                                  {isEn ? 'Uncharged' : 'غير محسوب'}
                                </span>
                              )}
                            </div>

                            {/* Status Badge */}
                            <StatusBadge
                              status={
                                item.isAbsentCharged
                                  ? 'absent_charged'
                                  : item.isAbsentFree
                                  ? 'absent_free'
                                  : (item.status as string)
                              }
                              variant={
                                item.isAbsentCharged || item.isAbsentFree
                                  ? 'danger'
                                  : undefined
                              }
                              label={
                                item.isAbsentCharged
                                  ? (isEn ? 'Absent (Charged)' : 'غائب محسوب')
                                  : item.isAbsentFree
                                  ? (isEn ? 'Absent (Not Charged)' : 'غائب غير محسوب')
                                  : item.status === 'present'
                                  ? t('present')
                                  : item.status === 'late'
                                  ? t('late')
                                  : item.status === 'excused'
                                  ? (isEn ? 'Excused' : 'معذور')
                                  : item.status === 'cancelled'
                                  ? (isEn ? 'Cancelled' : 'ملغاة')
                                  : (isEn ? 'Scheduled' : 'مجدول')
                              }
                            />
                          </div>

                          {(att?.behaviorRating || att?.homeworkRating) && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                              {att.behaviorRating && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#DCEDEB]/70 text-[#0F2A4A] border border-[#E1EBEC]">
                                  <AppIcon name="star" size={11} weight="fill" className="text-[#F5A04A]" />
                                  <span>
                                    {isEn ? 'Behavior:' : 'السلوك:'} {getBehaviorRatingLabel(att.behaviorRating, isEn)}
                                  </span>
                                </span>
                              )}
                              {att.homeworkRating && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#DCEDEB]/70 text-[#0F2A4A] border border-[#E1EBEC]">
                                  <AppIcon name="book" size={11} weight="fill" className="text-[#17375E]" />
                                  <span>
                                    {isEn ? 'Homework:' : 'الواجب:'} {getHomeworkRatingLabel(att.homeworkRating, isEn)}
                                  </span>
                                </span>
                              )}
                            </div>
                          )}

                          <div className={`flex items-center justify-between text-[11px] text-[#5F7083] pt-1 border-t flex-wrap gap-2 ${
                            item.isAbsentCharged || item.isAbsentFree ? 'border-[#FF647C]/20' : 'border-[#E1EBEC]'
                          }`}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>
                                {item.dateStr}{' '}
                                {item.timeDisplay ? `• ${item.timeDisplay}` : ''}
                              </span>

                              {att?.absenceReason && (
                                <span className="text-[10px] text-[#E53935] font-semibold">
                                  ({att.absenceReason})
                                </span>
                              )}

                              {isPrivate && (
                                <span className="font-black text-[10px] px-2 py-0.5 rounded-lg bg-[#E1EBEC]/15 text-[#0F2A4A] border border-[#E1EBEC] inline-flex items-center gap-1">
                                  <span>
                                    {formatSessionQuantityDisplay(
                                      att?.hours || session?.hours
                                        ? { hours: att?.hours || session?.hours, isHourly: true }
                                        : { sessionUnits: getSessionLessonQuantity(session, att), isHourly: false },
                                      isRTL
                                    )}
                                  </span>
                                  {(att?.sessionPriceSnapshot || session?.pricePerStudent) && (
                                    <span>• {att?.sessionPriceSnapshot || session?.pricePerStudent} {t('currency')}</span>
                                  )}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {isPrivate && session && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedPrivateIntakeSession({ session, item })}
                                  className="px-2 py-0.5 rounded-md font-bold text-[10px] border bg-[#FFFFFF] text-[#17375E] border-[#E1EBEC] hover:bg-[#DCEDEB]/50 transition-colors cursor-pointer inline-flex items-center gap-1"
                                >
                                  <AppIcon name="edit" size={10} />
                                  <span>{isEn ? 'Edit' : 'تعديل'}</span>
                                </button>
                              )}
                              {att && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleToggleSessionPaymentOverride(att.sessionId);
                                    setProfileDataVersion((v) => v + 1);
                                  }}
                                  className={`px-2 py-0.5 rounded-md font-bold text-[10px] border transition-colors cursor-pointer ${
                                    isUnpaid
                                      ? 'bg-[#E1EBEC]/15 text-[#0F2A4A] border-[#E1EBEC]'
                                      : 'bg-[#E1EBEC]/65 text-[#0F2A4A] border-[#17375E]/50'
                                  }`}
                                >
                                  {isUnpaid ? (isEn ? 'Unpaid' : 'غير مسدد (مستحق)') : (isEn ? 'Paid' : 'مسدد (خالص)')}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 6: BEHAVIOR & PARTICIPATION LOGS
                ------------------------------------------------------------- */}
            {activeSubTab === 'behavior' && (
              <div className="space-y-3.5">
                <WhiteCard className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <StudentAvatar
                        student={student}
                        size="md"
                        showFrame={true}
                        className="shrink-0"
                      />
                      <div className="min-w-0 space-y-0.5 text-start">
                        <strong className="font-bold text-xs text-navy block truncate">
                          {isEn ? progression.frameDef.titleEn : progression.frameDef.titleAr}
                        </strong>
                        <span className="text-[11px] text-slate block tabular-nums">
                          {isEn ? progression.behaviorStandingEn : progression.behaviorStandingAr}
                          {' · '}
                          {progression.totalXp} {isEn ? 'XP' : 'نقطة خبرة'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsQuickBehaviorModalOpen(true)}
                      className="btn-navy px-3 py-1.5 text-xs flex items-center gap-1 shrink-0 whitespace-nowrap"
                    >
                      <AppIcon name="plus" size={14} />
                      <span>{isEn ? 'New Behavior Rating' : 'تقييم سلوكي جديد'}</span>
                    </button>
                  </div>
                  <div className="h-2 w-full rounded-full bg-mint-soft overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-navy transition-all duration-300 ${getProgressWidthClass(
                        progression.progressPercent
                      )}`}
                    />
                  </div>
                </WhiteCard>

                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-[#0F2A4A] tabular-nums">
                    {isEn ? `Behavior & Engagement Logs (${studentBehaviorLogs.length})` : `سجل التقييم السلوكي والتفاعل (${studentBehaviorLogs.length})`}
                  </span>
                </div>

                {studentBehaviorLogs.length === 0 ? (
                  <div className="classy-card p-8 text-center space-y-3 bg-[#FFFFFF]">
                    <AppIcon name="zap" className="w-8 h-8 text-[#5F7083] mx-auto opacity-40" />
                    <p className="text-xs font-bold text-[#5F7083]">
                      {isEn ? 'No behavior ratings logged yet.' : 'لا توجد تقييمات سلوكية مرصودة بعد.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {studentBehaviorLogs.map((log) => {
                      const isPos = log.category === 'positive';
                      const isNeg = log.category === 'needs_improvement';
                      return (
                        <div
                          key={log.id}
                          className="classy-card p-3.5 bg-[#FFFFFF] border-[#E1EBEC] flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <strong className="font-black text-[#0F2A4A] block truncate">
                              {log.emoji ? `${log.emoji} ` : ''}
                              {log.tag}
                            </strong>
                            <p className="text-[11px] text-[#5F7083]">
                              {log.timestamp.split('T')[0]} {log.note ? `• ${log.note}` : ''}
                            </p>
                          </div>

                          <span
                            className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 ${
                              isPos
                                ? 'bg-[#E1EBEC]/65 text-[#0F2A4A] border border-[#17375E]/60'
                                : isNeg
                                ? 'bg-[#E1EBEC]/15 text-[#0F2A4A] border border-[#E1EBEC]'
                                : 'bg-[#E1EBEC]/15 text-[#0F2A4A] border border-[#E1EBEC]'
                            }`}
                          >
                            {(log.points ?? 0) > 0 ? `+${log.points}` : log.points} {t('points')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 7: PAYMENTS HISTORY
                ------------------------------------------------------------- */}
            {activeSubTab === 'history' && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-[#0F2A4A]">
                    {isEn ? `Payments History (${allPayments.length})` : `سجل الدفعات والمقبوضات (${allPayments.length})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenAddPayment(student)}
                    className="px-3 py-1.5 rounded-xl bg-[#17375E] hover:bg-[#0F2A4A] text-[#FFFFFF] font-black text-xs flex items-center gap-1 shadow-xs active:scale-95"
                  >
                    <AppIcon name="plus" size={14} className="text-[#FFFFFF]" />
                    <span>{t('recordPayment')}</span>
                  </button>
                </div>

                {allPayments.length === 0 ? (
                  <div className="classy-card p-8 text-center space-y-3 bg-[#FFFFFF]">
                    <AppIcon name="receipt" className="w-8 h-8 text-[#5F7083] mx-auto opacity-40" />
                    <p className="text-xs font-bold text-[#5F7083]">{isEn ? 'No payments recorded yet for this student.' : 'مفيش دفعات مسجلة للطالب بعد.'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allPayments.map((p) => (
                      <div
                        key={p.id}
                        className="classy-card p-3.5 bg-[#FFFFFF] border-[#E1EBEC] flex items-center justify-between text-xs hover:border-[#17375E]/40 transition-all"
                      >
                        <div>
                          <p className="font-black text-[#0F2A4A] text-sm">{p.amount} {t('currency')}</p>
                          <p className="text-[11px] text-[#5F7083] font-medium">
                            {p.date} •{' '}
                            {p.paymentType === 'specific_month'
                              ? (isEn ? `Month: ${getArabicMonthName(p.targetMonth || 1)}` : `شهر ${getArabicMonthName(p.targetMonth || 1)}`)
                              : (isEn ? 'Class Payment' : 'سداد حصص')}{' '}
                            {p.notes ? `• ${p.notes}` : ''}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E1EBEC]/15 border border-[#E1EBEC] text-[#0F2A4A]">
                          {p.paymentMethod === 'vodafone_cash'
                            ? (isEn ? 'Vodafone Cash' : 'فودافون كاش')
                            : p.paymentMethod === 'instapay'
                            ? (isEn ? 'InstaPay' : 'إنستاباي')
                            : p.paymentMethod === 'bank_transfer'
                            ? (isEn ? 'Bank Transfer' : 'تحويل بنكي')
                            : (isEn ? 'Cash' : 'كاش')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 8: CREDIT LOGS
                ------------------------------------------------------------- */}
            {activeSubTab === 'credit_logs' && (
              <div className="space-y-3.5">
                <span className="font-black text-xs text-[#0F2A4A] block">
                  {isEn ? `Prepaid Session Credit Logs (${allCreditLogs.length})` : `سجل حركات رصيد الحصص الدفع المسبق (${allCreditLogs.length})`}
                </span>

                {allCreditLogs.length === 0 ? (
                  <div className="classy-card p-8 text-center space-y-3 bg-[#FFFFFF]">
                    <AppIcon name="coins" className="w-8 h-8 text-[#5F7083] mx-auto opacity-40" />
                    <p className="text-xs font-bold text-[#5F7083]">{isEn ? 'No credit balance logs recorded.' : 'لا توجد حركات رصيد مسجلة.'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allCreditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="classy-card p-3.5 bg-[#FFFFFF] border-[#E1EBEC] flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <strong className="font-black text-[#0F2A4A] block truncate">
                            {log.reason || (isEn ? 'Credit adjustment' : 'حركة رصيد')}
                          </strong>
                          <p className="text-[11px] text-[#5F7083]">
                            {log.date} • {isEn ? `Balance after: ${log.balanceAfter} sessions` : `الرصيد بعد العملية: ${log.balanceAfter} حصص`}
                          </p>
                        </div>

                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 ${
                            log.sessionsDelta > 0
                              ? 'bg-[#E1EBEC]/65 text-[#0F2A4A] border border-[#17375E]/60'
                              : 'bg-[#E1EBEC]/70 text-[#0F2A4A] border border-[#0F2A4A]/50'
                          }`}
                        >
                          {log.sessionsDelta > 0 ? `+${log.sessionsDelta}` : log.sessionsDelta} {isEn ? 'sessions' : 'حصة'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

      </BottomSheet>

      {/* Child Modals with Proper Portaling & Layering */}
      {isRecordPrivateModalOpen && (
        <RecordPrivateSessionModal
          isOpen={isRecordPrivateModalOpen}
          onClose={() => setIsRecordPrivateModalOpen(false)}
          student={student}
          onSaveComplete={() => {
            setIsRecordPrivateModalOpen(false);
            setProfileDataVersion((v) => v + 1);
            onDataChanged();
          }}
        />
      )}

      {isQuickBehaviorModalOpen && (
        <QuickBehaviorLogModal
          isOpen={isQuickBehaviorModalOpen}
          onClose={() => setIsQuickBehaviorModalOpen(false)}
          student={student}
          availableGroups={allGroups}
          onSuccess={() => {
            setIsQuickBehaviorModalOpen(false);
            setProfileDataVersion((v) => v + 1);
            onDataChanged();
          }}
        />
      )}

      {isSafeDeleteModalOpen && (
        <SafeDeleteStudentModal
          isOpen={isSafeDeleteModalOpen}
          onClose={() => setIsSafeDeleteModalOpen(false)}
          student={student}
          onConfirmArchive={handleConfirmArchive}
          onConfirmPermanentDelete={handleConfirmPermanentDelete}
        />
      )}

      {selectedPrivateIntakeSession && (
        <PrivateClassIntakeModal
          isOpen={!!selectedPrivateIntakeSession}
          onClose={() => setSelectedPrivateIntakeSession(null)}
          student={student}
          session={selectedPrivateIntakeSession.session}
          onConfirm={handleConfirmPrivateIntakeInProfile}
        />
      )}
    </>
  );
};
