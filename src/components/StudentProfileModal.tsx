import React, { useState, useEffect, useMemo } from 'react';
import { useSwipeGesture } from '../utils/useSwipeGesture';
import {
  X,
  Phone,
  MessageCircle,
  GraduationCap,
  Layers,
  DollarSign,
  CalendarCheck2,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  User,
  CreditCard,
  Wallet,
  Sparkles,
  Coins,
  History,
  TrendingUp,
  Receipt,
  BookOpen,
  Filter,
  PlusCircle,
  Calendar,
  Settings2,
  FileText,
  Activity,
  Check,
  Save,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  BookMarked,
  MapPin,
  CalendarDays,
  Zap,
  Award,
  Search,
  Tag,
  SlidersHorizontal,
  RotateCcw,
  Archive,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import {
  Student,
  Group,
  Enrollment,
  Payment,
  Attendance,
  Session,
  AttendanceStatus,
  BillingMode,
  StudentGrandFinancialSummary,
  StudentBehaviorLog,
  BehaviorCategory,
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
import { RecordPrivateSessionModal } from './RecordPrivateSessionModal';
import { QuickBehaviorLogModal } from './QuickBehaviorLogModal';
import { SafeDeleteStudentModal } from './SafeDeleteStudentModal';
import { getLocalizedStageName } from '../utils/stages';
import {
  getUpcomingClassesForStudent,
  UpcomingStudentClass,
  formatTimeDisplay,
  getStudentEffectiveSchedule,
} from '../utils/schedule';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import {
  calculateStudentBehaviorStats,
  formatBehaviorTime,
  getCategoryBadge,
} from '../utils/behavior';
import { useTranslation } from '../utils/i18n';
import { useCurrentLocalDate } from '../utils/useCurrentLocalDate';
import { PrivateClassIntakeModal, PrivateClassIntakeResult } from './PrivateClassIntakeModal';

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  allGroups: Group[];
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

  useEffect(() => {
    if (student) {
      setNotesText(student.notes || '');
      setIsNotesSaved(false);
    }
  }, [student?.id, student?.notes]);

  const handleSaveNotes = () => {
    if (!student) return;
    const updated = {
      ...student,
      notes: notesText.trim(),
    };
    db.saveStudent(updated);
    setIsNotesSaved(true);
    setTimeout(() => setIsNotesSaved(false), 2500);
    onDataChanged();
  };

  // Edit enrollment billing state
  const [editingEnrollmentId, setEditingEnrollmentId] = useState<string | null>(null);
  const [editBillingMode, setEditBillingMode] = useState<BillingMode>('prepaid');
  const [editCustomPrice, setEditCustomPrice] = useState<number>(100);
  const [editHourlyRate, setEditHourlyRate] = useState<number>(150);
  const [editPackagePrice, setEditPackagePrice] = useState<number>(900);
  const [editPackageSessions, setEditPackageSessions] = useState<number>(10);

  // Load relations and calculated financials (Memoized to guarantee instant tab switches & zero lag)
  const studentId = student?.id;
  const studentGroups = useMemo(() => (studentId ? db.getStudentGroups(studentId) : []), [studentId]);
  const enrollments = useMemo(() => (studentId ? db.getEnrollments() : []), [studentId]);
  
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
  }, [studentId]);

  const allPayments = grandFinancials.allPayments;
  const attendanceList = useMemo(() => (studentId ? db.getStudentAttendance(studentId) : []), [studentId]);
  const allSessions = useMemo(() => (studentId ? db.getSessions() : []), [studentId]);
  const allCreditLogs = useMemo(() => (studentId ? db.getCreditLogs().filter((l) => l.studentId === studentId) : []), [studentId]);
  const studentBehaviorLogs = useMemo(() => (studentId ? db.getStudentBehaviorLogs(studentId) : []), [studentId]);
  const behaviorStats = useMemo(() => calculateStudentBehaviorStats(studentBehaviorLogs), [studentBehaviorLogs]);
  const serviceType = useMemo(() => (studentId ? db.getStudentServiceType(studentId) : 'none'), [studentId]);

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
    return studentId ? getUpcomingClassesForStudent(studentId, allGroups, enrollments, 5, isRTL) : [];
  }, [studentId, allGroups, enrollments, isRTL]);

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
      const s = allSessions.find((sess) => sess.id === a.sessionId);
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
        (s.studentId === studentId || studentGroups.some((g) => g.group.id === s.groupId))
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
  }, [attendanceList, allSessions, studentId, studentGroups]);

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
          ? 'bg-[#C7CDD3]/65 text-[#16324F] border border-[#0A3D62]/60'
          : isNeg
          ? 'bg-[#C7CDD3]/15 text-[#16324F] border border-[#C7CDD3]'
          : 'bg-[#C7CDD3]/15 text-[#16324F] border border-[#C7CDD3]',
        timestamp: new Date(b.timestamp || b.createdAt).getTime(),
      });
    });

    // 2. Add attendance activities
    attendanceList.slice(0, 8).forEach((att) => {
      const ses = allSessions.find((s) => s.id === att.sessionId);
      const grp = allGroups.find((g) => g.id === ses?.groupId);
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
          ? 'bg-[#C7CDD3]/65 text-[#16324F] border border-[#0A3D62]/60'
          : isLate
          ? 'bg-[#C7CDD3]/70 text-[#16324F] border border-[#16324F]/50'
          : isCharged
          ? 'bg-[#C7CDD3]/15 text-[#16324F] border border-[#C7CDD3]'
          : 'bg-[#C7CDD3]/25 text-[#16324F] border border-[#C7CDD3]',
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
        badgeColor: 'bg-[#C7CDD3]/65 text-[#16324F] border border-[#0A3D62]/60',
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
            ? 'bg-[#C7CDD3]/65 text-[#16324F] border border-[#0A3D62]/60'
            : 'bg-[#C7CDD3]/70 text-[#16324F] border border-[#16324F]/50',
        timestamp: new Date(log.date).getTime(),
      });
    });

    activities.sort((a, b) => b.timestamp - a.timestamp);
    return {
      recentActivity: activities,
      latestActivities: activities.slice(0, 6),
    };
  }, [studentBehaviorLogs, attendanceList, allSessions, allGroups, allPayments, allCreditLogs, isEn, t]);

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
  };

  const handleSaveEnrollmentBilling = (enrId: string) => {
    const isHourly = editBillingMode === 'hourly';
    const isPkg = editBillingMode === 'package';
    db.updateEnrollmentBilling(enrId, {
      billingMode: editBillingMode,
      billingType: editBillingMode as any,
      customPrice: isHourly ? editHourlyRate : isPkg ? editPackagePrice : editCustomPrice,
      hourlyRate: isHourly ? editHourlyRate : undefined,
      packagePrice: isPkg ? editPackagePrice : undefined,
      packageSessionsCount: isPkg ? editPackageSessions : undefined,
    });
    setEditingEnrollmentId(null);
    onDataChanged();
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
    onDataChanged();
  };

  const handleRemoveEnrollment = (enrollmentId: string, groupName: string) => {
    if (confirm(isEn ? `Are you sure you want to unenroll student from ${groupName}?` : `هل أنت متأكد من إلغاء قيد الطالب من ${groupName}؟`)) {
      db.removeEnrollment(enrollmentId);
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

    const record: Attendance = {
      id: `att_${session.id}_${student.id}`,
      sessionId: session.id,
      studentId: student.id,
      enrollmentId: enrollment?.id || session.enrollmentId,
      status: 'present',
      isCharged: true,
      sessionUnits: result.sessionUnits,
      hours: result.hours,
      isIncomplete: false,
      notes: result.notes || session.notes,
      recordedAt: new Date().toISOString(),
    };

    db.saveAttendanceBatch(session.id, [record]);
    db.saveSession({
      ...session,
      status: 'completed',
      sessionUnits: result.sessionUnits,
      hours: result.hours,
      pricePerStudent: result.pricePerStudent,
      isIncomplete: false,
      notes: result.notes || session.notes,
      updatedAt: new Date().toISOString(),
    });

    setSelectedPrivateIntakeSession(null);
    onDataChanged();
  };

  const [isSafeDeleteModalOpen, setIsSafeDeleteModalOpen] = useState(false);
  const modalLayer = useModalLayer('student-profile', isOpen && !!student, onClose);

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

  if (!isOpen || !student) return null;

  const isArchived = student.status === 'archived';

  return (
    <ModalPortal>
      <div
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-[#16324F]/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#FFFFFF] border border-[#C7CDD3] rounded-t-[32px] sm:rounded-[32px] max-w-2xl w-full mx-auto max-h-[94vh] flex flex-col overflow-hidden shadow-2xl relative select-none-touch">
          {/* =========================================================================
              1. STUDENT PROFILE HERO (Classy Midnight & Royal Gradient)
              ========================================================================= */}
          <div
            {...headerSwipeDownGestures}
            className="bg-gradient-to-r from-[#0A3D62] via-[#16324F] to-[#6F7882] p-5 sm:p-6 text-[#FFFFFF] relative overflow-hidden shrink-0 border-b border-[#C7CDD3]/15 select-none cursor-grab active:cursor-grabbing"
          >
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden w-full pb-2 flex items-center justify-center -mt-2">
              <div className="modal-drag-handle" />
            </div>

            {/* Ambient internal glows */}
            <div className="absolute -top-16 -right-16 w-52 h-52 bg-[#0A3D62]/35 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-[#16324F]/30 rounded-full blur-3xl pointer-events-none" />

            {/* Close button */}
            <button
              onClick={onClose}
              className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} p-2 rounded-2xl bg-[#FFFFFF]/10 hover:bg-[#FFFFFF]/20 text-[#FFFFFF]/90 hover:text-[#FFFFFF] transition-all cursor-pointer z-10`}
              title={t('close')}
            >
              <X className="w-5 h-5" />
            </button>

            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 ${isRTL ? 'pl-10' : 'pr-10'}`}>
              <div className="flex items-center gap-3.5 min-w-0">
                <StudentAvatar
                  student={student}
                  size="xl"
                  showFrame={true}
                  className="shrink-0 shadow-lg"
                />

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black text-[#FFFFFF] tracking-tight truncate">
                      {student.name}
                    </h2>

                    {/* Archived Status Badge */}
                    {isArchived && (
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#0A3D62]/20 text-[#C7CDD3] border border-[#0A3D62]/30 flex items-center gap-1 shadow-2xs">
                        <Archive className="w-3 h-3 text-[#C7CDD3]" />
                        <span>{t('archived')}</span>
                      </span>
                    )}

                    {/* Service Badges */}
                    {serviceType === 'both' && (
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#FFFFFF]/20 text-[#FFFFFF] border border-[#C7CDD3]/25">
                        {isEn ? 'Group + Private' : 'مجموعة + درس خاص'}
                      </span>
                    )}
                    {serviceType === 'private_only' && (
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#FFFFFF]/15 text-[#FFFFFF] border border-[#C7CDD3]/30">
                        {isEn ? 'Private Lesson' : 'درس خاص'}
                      </span>
                    )}
                    {serviceType === 'group_only' && (
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#FFFFFF]/20 text-[#C7CDD3] border border-[#C7CDD3]/25">
                        {isEn ? 'Group Only' : 'مجموعة فقط'}
                      </span>
                    )}
                    {serviceType === 'none' && !isArchived && (
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#FFFFFF]/10 text-[#C7CDD3]/90 border border-[#C7CDD3]/20">
                        {isEn ? 'No Active Enrollment' : 'بدون اشتراك نشط'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[#C7CDD3]/90 font-medium flex-wrap">
                    <span className="font-bold bg-[#FFFFFF]/15 px-2.5 py-0.5 rounded-lg border border-[#C7CDD3]/15">
                      {getLocalizedStageName(student.gradeLevel) || (isEn ? 'Grade Not Set' : 'الصف غير محدد')}
                    </span>
                    {student.school && <span>• {isEn ? `School: ${student.school}` : `مدرسة ${student.school}`}</span>}
                    {student.city && <span>• {student.city}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Archived Alert Banner */}
            {isArchived && (
              <div className="mt-4 p-3 rounded-2xl bg-[#16324F]/20 border border-[#0A3D62]/30 text-[#FFFFFF] flex flex-col sm:flex-row items-center justify-between gap-2.5 relative z-10">
                <div className={`text-xs font-medium leading-relaxed ${isRTL ? 'text-right' : 'text-left'} w-full sm:w-auto`}>
                  <strong className="font-black block text-[#FFFFFF]">{isEn ? 'Student is currently archived' : 'هذا الطالب مؤرشف حالياً'}</strong>
                  <span>{isEn ? 'All historical records, sessions, and payments are preserved.' : 'كافة السجلات والحصص والمدفوعات التاريخية محفوظة بالكامل.'}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreStudent}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-[#0A3D62] to-[#16324F] hover:from-[#16324F] hover:to-[#6F7882] text-[#FFFFFF] font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer shrink-0 active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{isEn ? 'Restore Student' : 'استعادة الطالب للنشاط'}</span>
                </button>
              </div>
            )}

            {/* Quick Contacts & Actions Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-[#C7CDD3]/20 relative z-10">
              {hasPrivate && (
                <button
                  type="button"
                  onClick={() => setIsRecordPrivateModalOpen(true)}
                  className="py-2 px-3 rounded-xl bg-gradient-to-r from-[#0A3D62] to-[#16324F] text-[#FFFFFF] text-xs font-black flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95 hover:brightness-105"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isEn ? '+ Private Class' : '+ حصة خاصة'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onOpenAddPayment(student)}
                className="py-2 px-3 rounded-xl bg-[#FFFFFF] text-[#16324F] hover:bg-[#FFFFFF] text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <DollarSign className="w-3.5 h-3.5 text-[#FFFFFF]" />
                <span>+ {t('recordPayment')}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsQuickBehaviorModalOpen(true)}
                className="py-2 px-3 rounded-xl bg-[#FFFFFF]/15 hover:bg-[#FFFFFF]/25 text-[#FFFFFF] border border-[#C7CDD3]/25 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <Zap className="w-3.5 h-3.5 text-[#C7CDD3]" />
                <span>{isEn ? 'Behavior Rating' : 'تقييم سلوك'}</span>
              </button>

              <button
                type="button"
                onClick={() => onEditStudent(student)}
                className="py-2 px-3 rounded-xl bg-[#FFFFFF]/15 hover:bg-[#FFFFFF]/25 text-[#FFFFFF] border border-[#C7CDD3]/25 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                title={t('editStudent')}
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{t('editStudent')}</span>
              </button>
            </div>
          </div>

          {/* =========================================================================
              2. SUB-NAVIGATION TABS (Horizontal Scrollable Strip)
              ========================================================================= */}
          <div className="flex border-b border-[#C7CDD3] bg-[#FFFFFF] px-2 overflow-x-auto android-scrollbar shrink-0 z-10 sticky top-0">
            <button
              onClick={() => setActiveSubTab('overview')}
              className={`py-3 px-3.5 text-center text-xs font-black border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'overview'
                  ? 'border-[#0A3D62] text-[#0A3D62] bg-[#C7CDD3]/30'
                  : 'border-transparent text-[#6F7882] hover:text-[#16324F]'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>{isEn ? 'Overview' : 'لوحة الطالب'}</span>
            </button>

            <button
              onClick={() => setActiveSubTab('groups')}
              className={`py-3 px-3.5 text-center text-xs font-black border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'groups'
                  ? 'border-[#0A3D62] text-[#0A3D62] bg-[#C7CDD3]/30'
                  : 'border-transparent text-[#6F7882] hover:text-[#16324F]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{t('groups')} ({groupEnrollments.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('private')}
              className={`py-3 px-3.5 text-center text-xs font-black border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'private'
                  ? 'border-[#16324F] text-[#16324F] bg-[#C7CDD3]/15'
                  : 'border-transparent text-[#6F7882] hover:text-[#16324F]'
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#16324F]" />
              <span>{isEn ? 'Private Lessons' : 'الدرس الخاص'} {privateEnrollments.length > 0 ? `(${privateEnrollments.length})` : ''}</span>
            </button>

            <button
              onClick={() => setActiveSubTab('finances')}
              className={`py-3 px-3.5 text-center text-xs font-black border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'finances'
                  ? 'border-[#0A3D62] text-[#0A3D62] bg-[#C7CDD3]/30'
                  : 'border-transparent text-[#6F7882] hover:text-[#16324F]'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>{isEn ? 'Finances' : 'الحسابات والماليات'}</span>
            </button>

            <button
              onClick={() => setActiveSubTab('attendance')}
              className={`py-3 px-3.5 text-center text-xs font-black border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'attendance'
                  ? 'border-[#0A3D62] text-[#0A3D62] bg-[#C7CDD3]/30'
                  : 'border-transparent text-[#6F7882] hover:text-[#16324F]'
              }`}
            >
              <CalendarCheck2 className="w-4 h-4" />
              <span>{t('attendance')} ({attendanceList.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('behavior')}
              className={`py-3 px-3.5 text-center text-xs font-black border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'behavior'
                  ? 'border-[#0A3D62] text-[#0A3D62] bg-[#C7CDD3]/30'
                  : 'border-transparent text-[#6F7882] hover:text-[#16324F]'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>{isEn ? 'Behavior' : 'السلوك'} ({studentBehaviorLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('history')}
              className={`py-3 px-3.5 text-center text-xs font-black border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'history'
                  ? 'border-[#0A3D62] text-[#0A3D62] bg-[#C7CDD3]/30'
                  : 'border-transparent text-[#6F7882] hover:text-[#16324F]'
              }`}
            >
              <History className="w-4 h-4" />
              <span>{isEn ? 'Payments Log' : 'سجل المدفوعات'}</span>
            </button>

            <button
              onClick={() => setActiveSubTab('credit_logs')}
              className={`py-3 px-3.5 text-center text-xs font-black border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'credit_logs'
                  ? 'border-[#0A3D62] text-[#0A3D62] bg-[#C7CDD3]/30'
                  : 'border-transparent text-[#6F7882] hover:text-[#16324F]'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>{isEn ? 'Credit Logs' : 'حركات الرصيد'} ({allCreditLogs.length})</span>
            </button>
          </div>

          {/* =========================================================================
              3. TAB CONTENTS
              ========================================================================= */}
          <div
            {...tabContentSwipeGestures}
            className="p-4 sm:p-5 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar flex-1 space-y-4 text-xs text-[#16324F]"
          >
            {/* -------------------------------------------------------------
                TAB 1: OVERVIEW / TEACHER DOSSIER
                ------------------------------------------------------------- */}
            {activeSubTab === 'overview' && (
              <div className="space-y-4">
                {/* Today's Private Lessons Summary (Feature 1 & Feature 3) */}
                {todayPrivateSummary && todayPrivateSummary.visitsCount > 0 && (
                  <div className="classy-card p-4 bg-gradient-to-r from-[#FFFFFF] via-[#FFFFFF] to-[#FFFFFF] border-[#C7CDD3] space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#C7CDD3]/15 text-[#16324F] flex items-center justify-center font-black">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-black text-xs sm:text-sm text-[#16324F] flex items-center gap-1.5">
                            <span>{isEn ? "Today's Private Lessons" : 'دروس اليوم الخاصة'}</span>
                          </h3>
                          <p className="text-[11px] text-[#6F7882] font-medium">
                            {student.name} • {todayPrivateSummary.date}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {todayPrivateSummary.hasIncomplete && (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#C7CDD3]/25 text-[#16324F] border border-[#16324F]/50 animate-pulse">
                            ⚠️ {isEn ? `${todayPrivateSummary.incompleteCount} need(s) completion` : `${todayPrivateSummary.incompleteCount} حصة تحتاج استكمال`}
                          </span>
                        )}
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#C7CDD3]/15 text-[#16324F] border border-[#C7CDD3]">
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
                                ? 'bg-[#C7CDD3]/80 border-[#16324F]/50'
                                : isPres
                                ? 'bg-[#FFFFFF] border-[#0A3D62]/50 shadow-2xs'
                                : 'bg-[#C7CDD3]/15 border-[#C7CDD3]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="px-2.5 py-1 rounded-xl bg-[#0A3D62] text-[#FFFFFF] font-black text-xs shrink-0">
                                {sesItem.time}
                              </div>
                              <div className="min-w-0">
                                <strong className="text-xs font-black text-[#16324F] block truncate">
                                  {sesItem.subject}
                                </strong>
                                <span className="text-[11px] text-[#6F7882] block">
                                  {sesItem.status === 'unrecorded'
                                    ? (isEn ? 'Scheduled • Not recorded yet' : 'مجدول • لم يُرصد بعد')
                                    : isPres
                                    ? (isEn ? '✓ Present' : '✓ حضر')
                                    : (isEn ? 'Absent' : 'لم يحضر')}
                                  {isPres && (
                                    <span className="font-black text-[#0A3D62] ms-1">
                                      • {isHourly ? `${sesItem.hours || 0} ${isEn ? 'Hours' : 'ساعة'}` : `${sesItem.sessionUnits || 0} ${isEn ? 'Session(s)' : 'حصة'}`}
                                    </span>
                                  )}
                                </span>
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
                                  className="px-2.5 py-1.5 rounded-xl bg-[#C7CDD3]/700 hover:bg-[#16324F] text-[#FFFFFF] font-black text-[10px] flex items-center gap-1 shadow-sm cursor-pointer active:scale-95"
                                >
                                  <span>⚠️</span>
                                  <span>{isEn ? 'Complete Session' : 'استكمال تفاصيل الحصة'}</span>
                                </button>
                              ) : isPres ? (
                                <div className="text-right">
                                  <span className="text-xs font-black text-[#16324F] block">
                                    {sesItem.price} {t('currency')}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const actualSession = allSessions.find((s) => s.id === sesItem.sessionId);
                                      if (actualSession) {
                                        setSelectedPrivateIntakeSession({ session: actualSession, item: sesItem });
                                      }
                                    }}
                                    className="text-[10px] text-[#0A3D62] font-bold hover:underline cursor-pointer"
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
                    <div className="p-3 rounded-xl bg-[#FFFFFF] border border-[#C7CDD3] flex items-center justify-between text-xs">
                      <span className="font-bold text-[#6F7882]">
                        {isEn ? "Today's Total:" : 'إجمالي اليوم:'}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-black text-[#0A3D62]">
                          {todayPrivateSummary.totalUnitsOrHoursText}
                        </span>
                        <span className="text-sm font-black text-[#16324F]">
                          {todayPrivateSummary.totalAmount} {t('currency')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Financial Summary Bento Cards */}
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="classy-card p-3.5 bg-[#FFFFFF] space-y-1">
                    <span className="text-[10px] font-bold text-[#6F7882] block">
                      {isEn ? 'Total Fees (Gross)' : 'إجمالي الرسوم (Gross)'}
                    </span>
                    <strong className="text-base sm:text-lg font-black text-[#16324F] block">
                      {grandFinancials.grandTotalDue} {t('currency')}
                    </strong>
                  </div>

                  <div className="classy-card p-3.5 bg-[#FFFFFF] space-y-1 border-[#0A3D62]/50">
                    <span className="text-[10px] font-bold text-[#16324F] block">
                      {t('totalCollected')}
                    </span>
                    <strong className="text-base sm:text-lg font-black text-[#16324F] block">
                      {grandFinancials.grandTotalPaid} {t('currency')}
                    </strong>
                  </div>

                  <div
                    className={`classy-card p-3.5 space-y-1 ${
                      grandFinancials.grandRemaining > 0
                        ? 'bg-[#C7CDD3]/15 border-[#C7CDD3]'
                        : 'bg-[#FFFFFF] border-[#0A3D62]/50'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-[#6F7882] block">
                      {t('remainingBalance')}
                    </span>
                    <strong
                      className={`text-base sm:text-lg font-black block ${
                        grandFinancials.grandRemaining > 0 ? 'text-[#16324F]' : 'text-[#16324F]'
                      }`}
                    >
                      {grandFinancials.grandRemaining} {t('currency')}
                    </strong>
                  </div>
                </div>

                {/* Lesson & Hourly Delivery Ledger Breakdown (Sessions vs Lessons & Unpaid Lessons) */}
                <div className="classy-card p-4 bg-gradient-to-br from-[#FFFFFF] via-[#FFFFFF] to-[#FFFFFF] border-[#C7CDD3] shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[#C7CDD3] pb-2">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#0A3D62]" />
                      <h4 className="font-black text-xs text-[#16324F]">
                        {isEn ? 'Lessons & Workload Balance (Physical vs Billed)' : 'ميزان الحصص وساعات العمل (الفعلي مقابل المسدد)'}
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#C7CDD3]/25 text-[#0A3D62]">
                      {grandFinancials.grandAppointmentsCount || 0} {isEn ? 'Appointments' : 'جلسات منعقدة'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10px]">
                    <div className="p-2.5 bg-[#FFFFFF] rounded-2xl border border-[#C7CDD3] space-y-0.5">
                      <span className="text-[#6F7882] block font-bold">
                        {isEn ? 'Completed Lessons' : 'إجمالي الحصص المنفذة'}
                      </span>
                      <strong className="text-sm font-black text-[#16324F] block">
                        {grandFinancials.grandCompletedLessons || 0} {isEn ? 'Lessons' : 'حصة'}
                      </strong>
                    </div>

                    <div className="p-2.5 bg-[#FFFFFF] rounded-2xl border border-[#0A3D62]/50 space-y-0.5">
                      <span className="text-[#16324F] block font-bold">
                        {isEn ? 'Paid Lessons' : 'الحصص المسددة'}
                      </span>
                      <strong className="text-sm font-black text-[#16324F] block">
                        {grandFinancials.grandPaidLessons || 0} {isEn ? 'Lessons' : 'حصة'}
                      </strong>
                    </div>

                    <div className={`p-2.5 rounded-2xl border space-y-0.5 ${
                      (grandFinancials.grandUnpaidLessons || 0) > 0 ? 'bg-[#C7CDD3]/15 border-[#C7CDD3]' : 'bg-[#FFFFFF] border-[#C7CDD3]'
                    }`}>
                      <span className="block font-bold text-[#6F7882]">
                        {isEn ? 'Unpaid Lessons' : 'الحصص غير المسددة'}
                      </span>
                      <strong className={`text-sm font-black block ${
                        (grandFinancials.grandUnpaidLessons || 0) > 0 ? 'text-[#16324F]' : 'text-[#16324F]'
                      }`}>
                        {grandFinancials.grandUnpaidLessons || 0} {isEn ? 'Lessons' : 'حصة'}
                      </strong>
                    </div>

                    <div className="p-2.5 bg-[#FFFFFF] rounded-2xl border border-[#C7CDD3] space-y-0.5">
                      <span className="text-[#6F7882] block font-bold">
                        {isEn ? 'Hourly Logged' : 'ساعات العمل'}
                      </span>
                      <strong className="text-sm font-black text-[#16324F] block">
                        {grandFinancials.grandTotalHours || 0} {isEn ? 'Hours' : 'ساعة'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Direct Contacts & WhatsApp Bar */}
                <div className="classy-card p-3.5 bg-[#FFFFFF] flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#0A3D62]" />
                    <span className="font-bold text-xs text-[#16324F]">{isEn ? 'Contact Info:' : 'بيانات التواصل المباشر:'}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {student.phone && (
                      <a
                        href={`tel:${student.phone}`}
                        className="px-3 py-1.5 rounded-xl bg-[#C7CDD3]/15 hover:bg-[#C7CDD3]/35 text-[#16324F] font-bold text-xs flex items-center gap-1.5 border border-[#C7CDD3] transition-colors"
                      >
                        <Phone className="w-3 h-3 text-[#0A3D62]" />
                        <span>{student.phone}</span>
                      </a>
                    )}

                    {student.parentPhone && (
                      <a
                        href={`https://wa.me/${student.parentPhone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-[#C7CDD3]/65 hover:bg-[#C7CDD3]/35 text-[#16324F] font-bold text-xs flex items-center gap-1.5 border border-[#0A3D62]/60 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-[#0A3D62]" />
                        <span>{isEn ? `WhatsApp (${student.parentRelation || 'Parent'}): ${student.parentPhone}` : `واتساب ${student.parentRelation || 'ولي الأمر'}: ${student.parentPhone}`}</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* =========================================================================
                    DEDICATED STUDENT SCHEDULE CARD (مواعيد الطالب)
                    ========================================================================= */}
                <div className="classy-card p-4 bg-[#FFFFFF] space-y-3.5 shadow-sm border-[#C7CDD3]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#C7CDD3]/25 text-[#0A3D62] flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-black text-xs sm:text-sm text-[#16324F] flex items-center gap-1.5">
                          <span>{t('studentSchedule')}</span>
                        </h3>
                        <p className="text-[11px] text-[#6F7882] font-medium">
                          {isEn ? 'Effective recurring weekly timetable' : 'جدول ومواعيد الحصص الأسبوعية الفعلية'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {effectiveSchedule && effectiveSchedule.totalOccurrencesCount > 0 && (
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#C7CDD3]/25 text-[#0A3D62] border border-[#0A3D62]/20">
                          {effectiveSchedule.totalOccurrencesCount} {t('weeklyClassesCount')}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onEditStudent(student)}
                        className="p-1.5 rounded-xl bg-[#C7CDD3]/15 hover:bg-[#C7CDD3]/35 text-[#6F7882] hover:text-[#16324F] border border-[#C7CDD3] transition-colors cursor-pointer"
                        title={isEn ? 'Edit Schedule' : 'تعديل المواعيد'}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Schedule Content */}
                  {!effectiveSchedule || effectiveSchedule.allDaysGrouped.length === 0 ? (
                    <div className="p-4 bg-[#C7CDD3]/15 rounded-2xl border border-dashed border-[#C7CDD3] text-center space-y-2">
                      <Clock className="w-6 h-6 text-[#6F7882]/40 mx-auto" />
                      <p className="text-xs font-bold text-[#6F7882]">
                        {t('noStudentSchedulePrompt')}
                      </p>
                      <button
                        type="button"
                        onClick={() => onEditStudent(student)}
                        className="px-3 py-1.5 rounded-xl bg-[#0A3D62] text-[#FFFFFF] font-black text-xs inline-flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
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
                            className="p-3 rounded-2xl bg-[#C7CDD3]/15 border border-[#C7CDD3] space-y-2 hover:border-[#0A3D62]/30 transition-all"
                          >
                            <div className="flex items-center justify-between border-b border-[#C7CDD3]/70 pb-1.5">
                              <span className="font-black text-xs text-[#16324F] flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-[#0A3D62]" />
                                <span>{dayGroup.dayName}</span>
                              </span>
                              <span className="text-[10px] font-bold text-[#6F7882]">
                                {dayGroup.items.length} {isEn ? (dayGroup.items.length > 1 ? 'times' : 'time') : (dayGroup.items.length > 1 ? 'مواعيد' : 'موعد')}
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              {dayGroup.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="p-2 rounded-xl bg-[#FFFFFF] border border-[#C7CDD3] flex items-center justify-between gap-2 shadow-2xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="px-2 py-0.5 rounded-lg bg-[#0A3D62] text-[#FFFFFF] font-black text-xs tracking-wide shrink-0">
                                      {item.time}
                                    </span>
                                    <div className="min-w-0 truncate">
                                      <strong className="text-xs font-black text-[#16324F] block truncate">
                                        {item.sourceTitle}
                                      </strong>
                                      <span className="text-[10px] text-[#6F7882] font-bold block truncate">
                                        {item.subject} {item.location ? `• ${item.location}` : ''}
                                      </span>
                                    </div>
                                  </div>

                                  <span
                                    className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                                      item.sourceType === 'private'
                                        ? 'bg-[#C7CDD3]/15 text-[#16324F] border border-[#C7CDD3]'
                                        : 'bg-[#C7CDD3]/25 text-[#16324F] border border-[#C7CDD3]'
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
                      <div className="pt-2 border-t border-[#C7CDD3] space-y-2">
                        {effectiveSchedule.groupSchedules.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-black text-[#6F7882] block">
                              {t('groupSchedules')}:
                            </span>
                            <div className="space-y-1">
                              {effectiveSchedule.groupSchedules.map((grp) => (
                                <div
                                  key={grp.groupId}
                                  className="p-2.5 rounded-xl bg-[#C7CDD3]/15 border border-[#C7CDD3] flex items-center justify-between text-xs flex-wrap gap-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full"
                                      style={{ backgroundColor: grp.accentColor }}
                                    />
                                    <strong className="font-black text-[#16324F]">{grp.groupName}</strong>
                                    <span className="text-[11px] text-[#6F7882]">({grp.subject})</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {grp.items.map((itm) => (
                                      <span
                                        key={itm.id}
                                        className="px-2 py-0.5 rounded-lg bg-[#FFFFFF] border border-[#C7CDD3] font-bold text-[11px] text-[#16324F]"
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
                            <span className="text-[11px] font-black text-[#16324F] block">
                              {t('privateLessonSchedule')}:
                            </span>
                            <div className="space-y-1">
                              {effectiveSchedule.privateSchedules.map((priv, pIdx) => (
                                <div
                                  key={pIdx}
                                  className="p-2.5 rounded-xl bg-[#C7CDD3]/15 border border-[#C7CDD3] flex items-center justify-between text-xs flex-wrap gap-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5 text-[#16324F]" />
                                    <strong className="font-black text-[#16324F]">{priv.subject}</strong>
                                    {priv.location && (
                                      <span className="text-[11px] text-[#6F7882]">({priv.location})</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {priv.items.map((itm) => (
                                      <span
                                        key={itm.id}
                                        className="px-2 py-0.5 rounded-lg bg-[#FFFFFF] border border-[#C7CDD3] font-bold text-[11px] text-[#16324F]"
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
                      <span className="font-black text-xs text-[#16324F] flex items-center gap-1.5">
                        <CalendarCheck2 className="w-4 h-4 text-[#0A3D62]" />
                        <span>{isEn ? 'Attendance Rate' : 'معدل الحضور والالتزام'}</span>
                      </span>
                      <span className="text-xs font-black text-[#16324F]">
                        {attendanceRate}%
                      </span>
                    </div>

                    <div className="w-full bg-[#C7CDD3]/25 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-[#0A3D62] to-[#16324F] h-full rounded-full transition-all duration-300"
                        style={{ width: `${attendanceRate}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#6F7882] font-bold pt-1">
                      <span>{t('present')}: {presentCount}</span>
                      <span>{t('late')}: {lateCount}</span>
                      <span>{t('absentCharged')}: {absentChargedCount}</span>
                      <span>{t('absentExcused')}: {absentExcusedCount}</span>
                    </div>
                  </div>

                  {/* Behavior & Points */}
                  <div className="classy-card p-4 bg-[#FFFFFF] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-[#16324F] flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-[#0A3D62]" />
                        <span>{isEn ? 'Behavior Rating & Engagement' : 'التقييم السلوكي والتفاعل'}</span>
                      </span>
                      <span
                        className={`text-xs font-black ${
                          behaviorStats.totalPoints > 0
                            ? 'text-[#16324F]'
                            : behaviorStats.totalPoints < 0
                            ? 'text-[#16324F]'
                            : 'text-[#16324F]'
                        }`}
                      >
                        {behaviorStats.totalPoints > 0
                          ? `+${behaviorStats.totalPoints}`
                          : behaviorStats.totalPoints}{' '}
                        {t('points')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold pt-1">
                      <div className="p-2 rounded-xl bg-[#C7CDD3]/65 text-[#16324F] border border-[#0A3D62]/50">
                        <span className="text-[10px] block">{isEn ? 'Positive' : 'تميز وتفاعل'}</span>
                        <strong className="text-sm font-black">{behaviorStats.positiveCount}</strong>
                      </div>
                      <div className="p-2 rounded-xl bg-[#C7CDD3]/15 text-[#16324F] border border-[#C7CDD3]">
                        <span className="text-[10px] block">{isEn ? 'Needs Attention' : 'يحتاج متابعة'}</span>
                        <strong className="text-sm font-black">{behaviorStats.needsImprovementCount}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Persistent Teacher Notes */}
                <div className="classy-card p-4 bg-[#FFFFFF] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-[#16324F] flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#0A3D62]" />
                      <span>{isEn ? 'Teacher Private Notes:' : 'ملاحظات المعلم الخاصة عن الطالب:'}</span>
                    </span>
                    {isNotesSaved && (
                      <span className="text-[10px] font-bold text-[#16324F] flex items-center gap-1 animate-in fade-in">
                        <Check className="w-3 h-3" />
                        <span>{isEn ? 'Saved successfully' : 'تم الحفظ بنجاح'}</span>
                      </span>
                    )}
                  </div>

                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder={isEn ? 'Write notes on student progress, parent follow-ups, or curriculum goals...' : 'اكتب ملاحظاتك عن مستوى الطالب، متابعة ولي الأمر، أو خطة المنهج...'}
                    rows={3}
                    className="w-full p-3 rounded-2xl bg-[#C7CDD3]/15 border border-[#C7CDD3] text-xs text-[#16324F] font-medium focus:outline-none focus:border-[#0A3D62] focus:bg-[#FFFFFF] transition-all shadow-inner"
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      className="px-4 py-2 rounded-xl bg-[#0A3D62] hover:bg-[#16324F] text-[#FFFFFF] font-black text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Save Notes' : 'حفظ الملاحظات'}</span>
                    </button>
                  </div>
                </div>

                {/* Recent Activity Timeline Feed */}
                <div className="classy-card p-4 bg-[#FFFFFF] space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-xs text-[#16324F] flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-[#0A3D62]" />
                      <span>{isEn ? 'Recent Activity & Transactions' : 'سجل النشاط والعمليات الأخيرة'}</span>
                    </h3>
                  </div>

                  {latestActivities.length === 0 ? (
                    <p className="text-xs text-[#6F7882] font-bold text-center py-3">
                      {isEn ? 'No activity recorded yet for this student.' : 'لا يوجد نشاط مسجل للطالب بعد.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {latestActivities.map((act) => (
                        <div
                          key={act.id}
                          className="p-3 rounded-xl bg-[#C7CDD3]/15 border border-[#C7CDD3] flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <strong className="font-black text-[#16324F] block truncate">
                              {act.title}
                            </strong>
                            <p className="text-[11px] text-[#6F7882] truncate">
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
                <div className="p-3.5 rounded-2xl bg-[#C7CDD3]/15 border border-[#C7CDD3] flex items-center justify-between flex-wrap gap-2">
                  <div className="space-y-0.5">
                    <strong className="text-xs font-black text-[#16324F] block">
                      {isEn ? 'Student Status & Archiving' : 'إدارة حالة الطالب والأرشفة'}
                    </strong>
                    <p className="text-[10px] text-[#6F7882]">
                      {isEn ? 'Archiving preserves all records and accounts, while permanent delete wipes data.' : 'أرشفة الطالب تحتفظ بكافة سجلاته وحساباته، بينما الحذف النهائي يزيل بياناته.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSafeDeleteModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#FFFFFF] text-[#16324F] border border-[#C7CDD3] hover:bg-[#C7CDD3]/25 text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
                  <span className="font-black text-xs text-[#16324F]">
                    {isEn ? `Enrolled Groups (${groupEnrollments.length})` : `المجموعات الدراسية المسجل بها (${groupEnrollments.length})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenEnrollModal(student)}
                    className="px-3 py-1.5 rounded-xl bg-[#0A3D62] hover:bg-[#16324F] text-[#FFFFFF] font-black text-xs flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Enroll in Group' : 'تسجيل في مجموعة'}</span>
                  </button>
                </div>

                {groupEnrollments.length === 0 ? (
                  <div className="classy-card p-8 text-center space-y-3 bg-[#FFFFFF]">
                    <Layers className="w-8 h-8 text-[#6F7882] mx-auto opacity-40" />
                    <p className="text-xs font-bold text-[#6F7882]">
                      {isEn ? 'Student is not enrolled in any study group yet.' : 'الطالب مش مضاف لأي مجموعة دراسية حالياً.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => onOpenEnrollModal(student)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#0A3D62] to-[#16324F] text-[#FFFFFF] font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isEn ? 'Add Student to Group Now' : 'إضافة الطالب لمجموعة الآن'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {groupEnrollments.map((enr) => (
                      <div
                        key={enr.enrollmentId}
                        className="classy-card p-4 bg-[#FFFFFF] border-[#C7CDD3] hover:border-[#0A3D62]/40 transition-all space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: enr.accentColor || '#0A3D62' }}
                              />
                              <h4 className="font-black text-sm text-[#16324F]">{enr.groupName}</h4>
                              <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-[#C7CDD3]/25 text-[#16324F]">
                                {getBillingModeLabel(enr.billingType, enr.billingMode)}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#6F7882]">
                              {isEn ? 'Class Price:' : 'سعر الحصة المقرر:'} <strong className="text-[#16324F]">{enr.customPrice} {t('currency')}</strong>
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditEnrollment(enr.enrollmentId)}
                              className="p-1.5 rounded-lg bg-[#C7CDD3]/15 hover:bg-[#C7CDD3]/35 text-[#6F7882] hover:text-[#16324F] border border-[#C7CDD3] transition-colors cursor-pointer"
                              title={isEn ? 'Edit Pricing' : 'تعديل شروط التسعير والاشتراك'}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveEnrollment(enr.enrollmentId, enr.groupName)}
                              className="p-1.5 rounded-lg bg-[#C7CDD3]/15 hover:bg-[#C7CDD3]/35 text-[#16324F] border border-[#C7CDD3] transition-colors cursor-pointer"
                              title={isEn ? 'Unenroll Student' : 'إلغاء قيد الطالب من المجموعة'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Inline Billing Editor */}
                        {editingEnrollmentId === enr.enrollmentId && (
                          <div className="p-3 bg-[#C7CDD3]/15 rounded-2xl border border-[#C7CDD3] space-y-2.5 text-xs">
                            <span className="font-black text-[#16324F] block">{isEn ? 'Edit Billing & Pricing Mode:' : 'تعديل نظام المحاسبة والتسعير:'}</span>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-[#6F7882] font-bold mb-1">
                                  {isEn ? 'Billing Mode' : 'نظام المحاسبة'}
                                </label>
                                <select
                                  value={editBillingMode}
                                  onChange={(e) => setEditBillingMode(e.target.value as BillingMode)}
                                  className="w-full p-2 rounded-xl bg-[#FFFFFF] border border-[#C7CDD3] text-xs font-bold text-[#16324F]"
                                >
                                  <option value="prepaid">{isEn ? 'Prepaid Per Session' : 'دفع مسبق بالحصة'}</option>
                                  <option value="postpaid">{isEn ? 'Postpaid (Pay After)' : 'دفع بعد الحصة (آجل)'}</option>
                                  <option value="monthly">{isEn ? 'Monthly Subscription' : 'اشتراك شهري'}</option>
                                  <option value="package">{isEn ? 'Session Package' : 'باقة حصص'}</option>
                                  <option value="hourly">{isEn ? 'Hourly Rate' : 'محاسبة بالساعة'}</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] text-[#6F7882] font-bold mb-1">
                                  {isEn ? `Price (${t('currency')})` : `السعر المخصص (${t('currency')})`}
                                </label>
                                <input
                                  type="number"
                                  value={editCustomPrice}
                                  onChange={(e) => setEditCustomPrice(Number(e.target.value))}
                                  className="w-full p-2 rounded-xl bg-[#FFFFFF] border border-[#C7CDD3] text-xs font-bold text-[#16324F]"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingEnrollmentId(null)}
                                className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#C7CDD3] text-xs font-bold text-[#6F7882]"
                              >
                                {t('cancel')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEnrollmentBilling(enr.enrollmentId)}
                                className="px-3.5 py-1.5 rounded-xl bg-[#0A3D62] text-[#FFFFFF] text-xs font-black shadow-xs"
                              >
                                {t('save')}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Financial Metrics Strip */}
                        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                          <div className="p-2 bg-[#C7CDD3]/15 rounded-xl border border-[#C7CDD3]">
                            <span className="text-[#6F7882] block font-bold">{isEn ? 'Used' : 'الحصص المستهلكة'}</span>
                            <strong className="text-xs font-black text-[#16324F]">
                              {enr.usedSessionsCount || 0}
                            </strong>
                          </div>
                          <div className="p-2 bg-[#C7CDD3]/15 rounded-xl border border-[#C7CDD3]">
                            <span className="text-[#6F7882] block font-bold">{isEn ? 'Credit' : 'رصيد الحصص'}</span>
                            <strong className="text-xs font-black text-[#0A3D62]">
                              {enr.sessionCredit || 0}
                            </strong>
                          </div>
                          <div className="p-2 bg-[#C7CDD3]/15 rounded-xl border border-[#C7CDD3]">
                            <span className="text-[#6F7882] block font-bold">{isEn ? 'Paid' : 'المدفوع'}</span>
                            <strong className="text-xs font-black text-[#16324F]">
                              {enr.totalPaid} {t('currency')}
                            </strong>
                          </div>
                          <div
                            className={`p-2 rounded-xl border ${
                              enr.remaining > 0
                                ? 'bg-[#C7CDD3]/15 border-[#C7CDD3] text-[#16324F]'
                                : 'bg-[#C7CDD3]/15 border-[#C7CDD3] text-[#16324F]'
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
                  <div className="classy-card p-4 bg-gradient-to-r from-[#FFFFFF] via-[#FFFFFF] to-[#FFFFFF] border-[#C7CDD3] space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#C7CDD3]/15 text-[#16324F] flex items-center justify-center font-black">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-black text-xs sm:text-sm text-[#16324F] flex items-center gap-1.5">
                            <span>{isEn ? "Today's Private Lessons" : 'دروس اليوم الخاصة'}</span>
                          </h3>
                          <p className="text-[11px] text-[#6F7882] font-medium">
                            {student.name} • {todayPrivateSummary.date}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {todayPrivateSummary.hasIncomplete && (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#C7CDD3]/25 text-[#16324F] border border-[#16324F]/50 animate-pulse">
                            ⚠️ {isEn ? `${todayPrivateSummary.incompleteCount} need(s) completion` : `${todayPrivateSummary.incompleteCount} حصة تحتاج استكمال`}
                          </span>
                        )}
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#C7CDD3]/15 text-[#16324F] border border-[#C7CDD3]">
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
                                ? 'bg-[#C7CDD3]/80 border-[#16324F]/50'
                                : isPres
                                ? 'bg-[#FFFFFF] border-[#0A3D62]/50 shadow-2xs'
                                : 'bg-[#C7CDD3]/15 border-[#C7CDD3]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="px-2.5 py-1 rounded-xl bg-[#0A3D62] text-[#FFFFFF] font-black text-xs shrink-0">
                                {sesItem.time}
                              </div>
                              <div className="min-w-0">
                                <strong className="text-xs font-black text-[#16324F] block truncate">
                                  {sesItem.subject}
                                </strong>
                                <span className="text-[11px] text-[#6F7882] block">
                                  {sesItem.status === 'unrecorded'
                                    ? (isEn ? 'Scheduled • Not recorded yet' : 'مجدول • لم يُرصد بعد')
                                    : isPres
                                    ? (isEn ? '✓ Present' : '✓ حضر')
                                    : (isEn ? 'Absent' : 'لم يحضر')}
                                  {isPres && (
                                    <span className="font-black text-[#0A3D62] ms-1">
                                      • {isHourly ? `${sesItem.hours || 0} ${isEn ? 'Hours' : 'ساعة'}` : `${sesItem.sessionUnits || 0} ${isEn ? 'Session(s)' : 'حصة'}`}
                                    </span>
                                  )}
                                </span>
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
                                  className="px-2.5 py-1.5 rounded-xl bg-[#C7CDD3]/700 hover:bg-[#16324F] text-[#FFFFFF] font-black text-[10px] flex items-center gap-1 shadow-sm cursor-pointer active:scale-95"
                                >
                                  <span>⚠️</span>
                                  <span>{isEn ? 'Complete Session' : 'استكمال تفاصيل الحصة'}</span>
                                </button>
                              ) : isPres ? (
                                <div className="text-right">
                                  <span className="text-xs font-black text-[#16324F] block">
                                    {sesItem.price} {t('currency')}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const actualSession = allSessions.find((s) => s.id === sesItem.sessionId);
                                      if (actualSession) {
                                        setSelectedPrivateIntakeSession({ session: actualSession, item: sesItem });
                                      }
                                    }}
                                    className="text-[10px] text-[#0A3D62] font-bold hover:underline cursor-pointer"
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
                    <div className="p-3 rounded-xl bg-[#FFFFFF] border border-[#C7CDD3] flex items-center justify-between text-xs">
                      <span className="font-bold text-[#6F7882]">
                        {isEn ? "Today's Total:" : 'إجمالي اليوم:'}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-black text-[#0A3D62]">
                          {todayPrivateSummary.totalUnitsOrHoursText}
                        </span>
                        <span className="text-sm font-black text-[#16324F]">
                          {todayPrivateSummary.totalAmount} {t('currency')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-[#16324F]">
                    {isEn ? `Private Services & Tutoring (${privateEnrollments.length})` : `الخدمات والدروس الخاصة (${privateEnrollments.length})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingPrivateService(!isAddingPrivateService)}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#0A3D62] to-[#16324F] text-[#FFFFFF] font-black text-xs flex items-center gap-1 shadow-md shadow-[#16324F]/30 transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Add New Private Lesson' : 'إضافة درس خاص جديد'}</span>
                  </button>
                </div>

                {/* Add Private Service Drawer Form */}
                {isAddingPrivateService && (
                  <form
                    onSubmit={handleCreatePrivateService}
                    className="classy-card p-4 bg-[#FFFFFF] border-[#C7CDD3] space-y-3 shadow-md"
                  >
                    <div className="flex items-center justify-between border-b border-[#C7CDD3] pb-2">
                      <span className="font-black text-xs text-[#16324F]">
                        {isEn ? 'Configure New Private Tutoring Service:' : 'إعداد وتخصيص خدمة درس خاص جديدة:'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAddingPrivateService(false)}
                        className="text-[#6F7882] hover:text-[#16324F]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div>
                        <label className="block text-[10px] text-[#6F7882] font-bold mb-1">
                          {isEn ? 'Subject / Topic' : 'المادة / موضوع الدرس'}
                        </label>
                        <input
                          type="text"
                          value={newPrivateSubject}
                          onChange={(e) => setNewPrivateSubject(e.target.value)}
                          placeholder={isEn ? 'e.g. English - Private' : 'مثال: لغة إنجليزية - خاص'}
                          className="w-full p-2.5 rounded-xl bg-[#C7CDD3]/15 border border-[#C7CDD3] font-bold text-xs text-[#16324F]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-[#6F7882] font-bold mb-1">
                          {isEn ? 'Billing Mode' : 'نظام المحاسبة'}
                        </label>
                        <select
                          value={newPrivateBillingMode}
                          onChange={(e) =>
                            setNewPrivateBillingMode(e.target.value as BillingMode)
                          }
                          className="w-full p-2.5 rounded-xl bg-[#C7CDD3]/15 border border-[#C7CDD3] font-bold text-xs text-[#16324F]"
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
                          <label className="block text-[10px] text-[#6F7882] font-bold mb-1">
                            {isEn ? `Hourly Rate (${t('currency')})` : `سعر الساعة (${t('currency')})`}
                          </label>
                          <input
                            type="number"
                            value={newPrivateHourlyRate}
                            onChange={(e) => setNewPrivateHourlyRate(Number(e.target.value))}
                            className="w-full p-2.5 rounded-xl bg-[#C7CDD3]/15 border border-[#C7CDD3] font-bold text-xs text-[#16324F]"
                            required
                          />
                        </div>
                      ) : newPrivateBillingMode === 'package' ? (
                        <>
                          <div>
                            <label className="block text-[10px] text-[#6F7882] font-bold mb-1">
                              {isEn ? 'Package Sessions Count' : 'عدد حصص الباقة'}
                            </label>
                            <input
                              type="number"
                              value={newPrivatePackageSessions}
                              onChange={(e) =>
                                setNewPrivatePackageSessions(Number(e.target.value))
                              }
                              className="w-full p-2.5 rounded-xl bg-[#C7CDD3]/15 border border-[#C7CDD3] font-bold text-xs text-[#16324F]"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#6F7882] font-bold mb-1">
                              {isEn ? `Package Total Price (${t('currency')})` : `إجمالي سعر الباقة (${t('currency')})`}
                            </label>
                            <input
                              type="number"
                              value={newPrivatePackagePrice}
                              onChange={(e) => setNewPrivatePackagePrice(Number(e.target.value))}
                              className="w-full p-2.5 rounded-xl bg-[#C7CDD3]/15 border border-[#C7CDD3] font-bold text-xs text-[#16324F]"
                              required
                            />
                          </div>
                        </>
                      ) : (
                        <div>
                          <label className="block text-[10px] text-[#6F7882] font-bold mb-1">
                            {isEn ? `Session Price (${t('currency')})` : `سعر الحصة (${t('currency')})`}
                          </label>
                          <input
                            type="number"
                            value={newPrivatePrice}
                            onChange={(e) => setNewPrivatePrice(Number(e.target.value))}
                            className="w-full p-2.5 rounded-xl bg-[#C7CDD3]/15 border border-[#C7CDD3] font-bold text-xs text-[#16324F]"
                            required
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] text-[#6F7882] font-bold mb-1">
                          {isEn ? 'Location' : 'مكان الدرس'}
                        </label>
                        <input
                          type="text"
                          value={newPrivateLocation}
                          onChange={(e) => setNewPrivateLocation(e.target.value)}
                          placeholder={isEn ? "e.g. Student's Home or Center" : 'مثال: منزل الطالب أو السنتر'}
                          className="w-full p-2.5 rounded-xl bg-[#C7CDD3]/15 border border-[#C7CDD3] font-bold text-xs text-[#16324F]"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingPrivateService(false)}
                        className="px-4 py-2 rounded-xl bg-[#C7CDD3]/15 text-[#6F7882] font-bold text-xs"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#0A3D62] to-[#16324F] text-[#FFFFFF] font-black text-xs shadow-md shadow-[#16324F]/30"
                      >
                        {isEn ? 'Save Private Lesson' : 'حفظ وإنشاء الدرس الخاص'}
                      </button>
                    </div>
                  </form>
                )}

                {privateEnrollments.length === 0 ? (
                  <div className="classy-card p-8 text-center space-y-3 bg-[#FFFFFF]">
                    <Sparkles className="w-8 h-8 text-[#16324F] mx-auto opacity-50" />
                    <p className="text-xs font-bold text-[#6F7882]">
                      {isEn ? 'No private lessons registered yet for this student.' : 'مفيش دروس خاصة مسجلة للطالب حتى الآن.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAddingPrivateService(true)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#0A3D62] to-[#16324F] text-[#FFFFFF] font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isEn ? 'Add First Private Lesson' : 'إضافة أول درس خاص للطالب'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {privateEnrollments.map((enr) => (
                      <div
                        key={enr.enrollmentId}
                        className="classy-card p-4 bg-[#FFFFFF] border-[#C7CDD3] hover:border-[#16324F]/60 transition-all space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#16324F]" />
                              <h4 className="font-black text-sm text-[#16324F]">{enr.groupName}</h4>
                              <span className="text-[10px] font-black px-2 py-0.2 rounded-full bg-[#C7CDD3]/15 text-[#16324F] border border-[#C7CDD3]">
                                {getBillingModeLabel(enr.billingType, enr.billingMode)}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#6F7882]">
                              {enr.billingMode === 'hourly' || enr.billingType === 'hourly'
                                ? (isEn ? `Hourly Rate: ${enr.customPrice} ${t('currency')}` : `سعر الساعة: ${enr.customPrice} ج.م`)
                                : (isEn ? `Session Price: ${enr.customPrice} ${t('currency')}` : `سعر الحصة: ${enr.customPrice} ج.م`)}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditEnrollment(enr.enrollmentId)}
                              className="p-1.5 rounded-lg bg-[#C7CDD3]/15 hover:bg-[#C7CDD3]/35 text-[#6F7882] hover:text-[#16324F] border border-[#C7CDD3] transition-colors cursor-pointer"
                              title={isEn ? 'Edit Pricing' : 'تعديل شروط التسعير والاشتراك'}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveEnrollment(enr.enrollmentId, enr.groupName)}
                              className="p-1.5 rounded-lg bg-[#C7CDD3]/15 hover:bg-[#C7CDD3]/35 text-[#16324F] border border-[#C7CDD3] transition-colors cursor-pointer"
                              title={isEn ? 'Delete Private Lesson' : 'إلغاء خدمة الدرس الخاص'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Financial & Workload Metrics Strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center text-[10px]">
                          <div className="p-2 bg-[#C7CDD3]/15 rounded-xl border border-[#C7CDD3]">
                            <span className="text-[#6F7882] block font-bold">
                              {enr.billingMode === 'hourly' || enr.billingType === 'hourly'
                                ? (isEn ? 'Logged Duration' : 'الساعات المنفذة')
                                : (isEn ? 'Completed Lessons' : 'الحصص المنفذة')}
                            </span>
                            <strong className="text-xs font-black text-[#16324F]">
                              {enr.billingMode === 'hourly' || enr.billingType === 'hourly'
                                ? (isEn ? `${enr.totalHours ?? 0} hrs` : `${enr.totalHours ?? 0} ساعة`)
                                : `${enr.attendedSessionsCount || enr.usedSessionsCount || 0} ${isEn ? 'Lessons' : 'حصة'}`}
                            </strong>
                            <span className="text-[9px] text-[#6F7882] block mt-0.5">
                              {enr.actualOccurrencesCount || 0} {isEn ? 'sessions' : 'جلسة'}
                            </span>
                          </div>

                          <div className="p-2 bg-[#C7CDD3]/70 rounded-xl border border-[#0A3D62]/50">
                            <span className="text-[#16324F] block font-bold">
                              {enr.billingMode === 'hourly' || enr.billingType === 'hourly'
                                ? (isEn ? 'Paid Amount' : 'المسدد')
                                : (isEn ? 'Paid Lessons' : 'الحصص المسددة')}
                            </span>
                            <strong className="text-xs font-black text-[#16324F]">
                              {enr.billingMode === 'hourly' || enr.billingType === 'hourly'
                                ? `${enr.totalPaid} ${t('currency')}`
                                : `${enr.paidLessonsCount ?? enr.settledSessionsCount ?? 0} ${isEn ? 'Lessons' : 'حصة'}`}
                            </strong>
                            <span className="text-[9px] text-[#0A3D62] block mt-0.5">
                              {enr.totalPaid} {t('currency')}
                            </span>
                          </div>

                          <div className={`p-2 rounded-xl border ${
                            enr.remaining > 0
                              ? 'bg-[#C7CDD3]/15 border-[#C7CDD3] text-[#16324F]'
                              : 'bg-[#C7CDD3]/15 border-[#C7CDD3] text-[#16324F]'
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

                          <div className="p-2 bg-[#C7CDD3]/15 rounded-xl border border-[#C7CDD3]">
                            <span className="text-[#6F7882] block font-bold">
                              {enr.billingMode === 'package' ? (isEn ? 'Package Credit' : 'رصيد الباقة') : (isEn ? 'Balance Credit' : 'الرصيد الدائن')}
                            </span>
                            <strong className="text-xs font-black text-[#0A3D62]">
                              {enr.sessionCredit || 0} {isEn ? 'rem.' : 'متبقي'}
                            </strong>
                            <span className="text-[9px] text-[#6F7882] block mt-0.5">
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
                <div className="classy-card p-4 bg-[#FFFFFF] space-y-3 border-[#0A3D62]/50">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-[#16324F] flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-[#0A3D62]" />
                      <span>{isEn ? 'Grand Financial Summary:' : 'الحساب المالي الإجمالي للطالب:'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenAddPayment(student)}
                      className="px-3 py-1 rounded-xl bg-gradient-to-r from-[#16324F] to-[#6F7882] text-[#FFFFFF] font-black text-xs flex items-center gap-1 shadow-xs active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('recordPayment')}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-[#C7CDD3]/15 border border-[#C7CDD3]">
                      <span className="text-[10px] text-[#6F7882] font-bold block">
                        {isEn ? 'Total Fees (Gross)' : 'إجمالي الرسوم (Gross)'}
                      </span>
                      <strong className="text-sm sm:text-base font-black text-[#16324F] mt-0.5 block">
                        {grandFinancials.grandTotalDue} {t('currency')}
                      </strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#C7CDD3]/65 border border-[#0A3D62]/50 text-[#16324F]">
                      <span className="text-[10px] font-bold block">{t('totalCollected')}</span>
                      <strong className="text-sm sm:text-base font-black mt-0.5 block">
                        {grandFinancials.grandTotalPaid} {t('currency')}
                      </strong>
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border ${
                        grandFinancials.grandRemaining > 0
                          ? 'bg-[#C7CDD3]/15 border-[#C7CDD3] text-[#16324F]'
                          : 'bg-[#C7CDD3]/65 border-[#0A3D62]/50 text-[#16324F]'
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
                  <h4 className="font-black text-xs text-[#16324F] flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#0A3D62]" />
                    <span>{isEn ? 'Group vs Private Fees Comparison:' : 'مقارنة الرسوم بين المجموعات والدروس الخاصة:'}</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-[#C7CDD3]/15 border border-[#C7CDD3] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-[#16324F]">{isEn ? 'Group Classes' : 'خدمات المجموعات'}</span>
                        <span className="text-[10px] font-bold text-[#6F7882]">
                          {grandFinancials.groupsFinancials.enrollments.length} {t('groups')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-[#C7CDD3]">
                        <span>{isEn ? 'Paid' : 'المسدد'}: {grandFinancials.groupsFinancials.totalPaid} {t('currency')}</span>
                        <span
                          className={
                            grandFinancials.groupsFinancials.remaining > 0
                              ? 'text-[#16324F]'
                              : 'text-[#16324F]'
                          }
                        >
                          {isEn ? 'Due' : 'المتبقي'}: {grandFinancials.groupsFinancials.remaining} {t('currency')}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-[#C7CDD3]/15 border border-[#C7CDD3] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-[#16324F]">{isEn ? 'Private Lessons' : 'الدروس الخاصة'}</span>
                        <span className="text-[10px] font-bold text-[#6F7882]">
                          {grandFinancials.privateFinancials.enrollments.length} {isEn ? 'services' : 'خدمات خاصة'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-[#C7CDD3]">
                        <span>{isEn ? 'Paid' : 'المسدد'}: {grandFinancials.privateFinancials.totalPaid} {t('currency')}</span>
                        <span
                          className={
                            grandFinancials.privateFinancials.remaining > 0
                              ? 'text-[#16324F]'
                              : 'text-[#16324F]'
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
                  <span className="font-black text-xs text-[#16324F]">
                    {isEn ? `Attendance History (${attendanceList.length})` : `سجل الحصص المنفذة والحضور (${attendanceList.length})`}
                  </span>
                  <span className="text-xs font-black text-[#16324F] bg-[#C7CDD3]/65 px-2.5 py-1 rounded-xl border border-[#0A3D62]/50">
                    {isEn ? `Rate: ${attendanceRate}%` : `معدل الالتزام: ${attendanceRate}%`}
                  </span>
                </div>

                {attendanceList.length === 0 ? (
                  <div className="classy-card p-8 text-center space-y-3 bg-[#FFFFFF]">
                    <CalendarCheck2 className="w-8 h-8 text-[#6F7882] mx-auto opacity-40" />
                    <p className="text-xs font-bold text-[#6F7882]">
                      {isEn ? 'No attendance records yet for this student.' : 'مفيش سجلات حضور مسجلة للطالب حتى الآن.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {attendanceList.map((att) => {
                      const session = allSessions.find((s) => s.id === att.sessionId);
                      const isPrivate = !!session?.studentId;
                      const isUnpaid =
                        att.paymentStatus === 'unpaid' ||
                        att.paymentOverride === 'unpaid' ||
                        att.isPaid === false;

                      return (
                        <div
                          key={att.id}
                          className="classy-card p-3.5 bg-[#FFFFFF] border-[#C7CDD3] hover:border-[#0A3D62]/40 transition-all space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${
                                  isPrivate ? 'bg-[#16324F]' : 'bg-[#0A3D62]'
                                }`}
                              />
                              <strong className="font-black text-[#16324F]">
                                {session?.title || (isPrivate ? (isEn ? 'Private Lesson' : 'درس خاص') : (isEn ? 'Group Class' : 'حصة مجموعة'))}
                              </strong>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                                  isPrivate
                                    ? 'bg-[#C7CDD3]/15 text-[#16324F] border border-[#C7CDD3]'
                                    : 'bg-[#C7CDD3]/25 text-[#16324F]'
                                }`}
                              >
                                {isPrivate ? (isEn ? 'Private' : 'خاص') : (isEn ? 'Group' : 'مجموعة')}
                              </span>
                            </div>

                            {/* Status Badge */}
                            <span
                              className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                                att.status === 'present'
                                  ? 'bg-[#C7CDD3]/65 text-[#16324F] border border-[#0A3D62]/60'
                                  : att.status === 'late'
                                  ? 'bg-[#C7CDD3]/70 text-[#16324F] border border-[#16324F]/50'
                                  : att.status === 'absent_charged'
                                  ? 'bg-[#C7CDD3]/15 text-[#16324F] border border-[#C7CDD3]'
                                  : 'bg-[#C7CDD3]/15 text-[#6F7882] border border-[#C7CDD3]'
                              }`}
                            >
                              {att.status === 'present'
                                ? t('present')
                                : att.status === 'late'
                                ? t('late')
                                : att.status === 'absent_charged'
                                ? t('absentCharged')
                                : t('absentExcused')}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-[#6F7882] pt-1 border-t border-[#C7CDD3] flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>
                                {session?.date || att.recordedAt?.split('T')[0]}{' '}
                                {session?.startTime
                                  ? `• ${formatTimeDisplay(session.startTime, true)}`
                                  : ''}
                              </span>

                              {isPrivate && (
                                <span className="font-black text-[10px] px-2 py-0.5 rounded-lg bg-[#C7CDD3]/15 text-[#16324F] border border-[#C7CDD3] inline-flex items-center gap-1">
                                  <span>
                                    {formatSessionQuantityDisplay(
                                      att.hours || session?.hours
                                        ? { hours: att.hours || session?.hours, isHourly: true }
                                        : { sessionUnits: getSessionLessonQuantity(session, att), isHourly: false },
                                      isRTL
                                    )}
                                  </span>
                                  {(att.sessionPriceSnapshot || session?.pricePerStudent) && (
                                    <span>• {att.sessionPriceSnapshot || session?.pricePerStudent} {t('currency')}</span>
                                  )}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleSessionPaymentOverride(att.sessionId)}
                                className={`px-2 py-0.5 rounded-md font-bold text-[10px] border transition-colors cursor-pointer ${
                                  isUnpaid
                                    ? 'bg-[#C7CDD3]/15 text-[#16324F] border-[#C7CDD3]'
                                    : 'bg-[#C7CDD3]/65 text-[#16324F] border-[#0A3D62]/50'
                                }`}
                              >
                                {isUnpaid ? (isEn ? 'Unpaid' : 'غير مسدد (مستحق)') : (isEn ? 'Paid' : 'مسدد (خالص)')}
                              </button>
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
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-[#16324F]">
                    {isEn ? `Behavior & Engagement Logs (${studentBehaviorLogs.length})` : `سجل التقييم السلوكي والتفاعل (${studentBehaviorLogs.length})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsQuickBehaviorModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#0A3D62] to-[#0A3D62] text-[#FFFFFF] font-black text-xs flex items-center gap-1 shadow-xs active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isEn ? 'New Behavior Rating' : 'تقييم سلوكي جديد'}</span>
                  </button>
                </div>

                {studentBehaviorLogs.length === 0 ? (
                  <div className="classy-card p-8 text-center space-y-3 bg-[#FFFFFF]">
                    <Zap className="w-8 h-8 text-[#6F7882] mx-auto opacity-40" />
                    <p className="text-xs font-bold text-[#6F7882]">
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
                          className="classy-card p-3.5 bg-[#FFFFFF] border-[#C7CDD3] flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <strong className="font-black text-[#16324F] block truncate">
                              {log.emoji ? `${log.emoji} ` : ''}
                              {log.tag}
                            </strong>
                            <p className="text-[11px] text-[#6F7882]">
                              {log.timestamp.split('T')[0]} {log.note ? `• ${log.note}` : ''}
                            </p>
                          </div>

                          <span
                            className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 ${
                              isPos
                                ? 'bg-[#C7CDD3]/65 text-[#16324F] border border-[#0A3D62]/60'
                                : isNeg
                                ? 'bg-[#C7CDD3]/15 text-[#16324F] border border-[#C7CDD3]'
                                : 'bg-[#C7CDD3]/15 text-[#16324F] border border-[#C7CDD3]'
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
                  <span className="font-black text-xs text-[#16324F]">
                    {isEn ? `Payments History (${allPayments.length})` : `سجل الدفعات والمقبوضات (${allPayments.length})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenAddPayment(student)}
                    className="px-3 py-1.5 rounded-xl bg-[#0A3D62] hover:bg-[#16324F] text-[#FFFFFF] font-black text-xs flex items-center gap-1 shadow-xs active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#0A3D62]" />
                    <span>{t('recordPayment')}</span>
                  </button>
                </div>

                {allPayments.length === 0 ? (
                  <div className="classy-card p-8 text-center space-y-3 bg-[#FFFFFF]">
                    <Receipt className="w-8 h-8 text-[#6F7882] mx-auto opacity-40" />
                    <p className="text-xs font-bold text-[#6F7882]">{isEn ? 'No payments recorded yet for this student.' : 'مفيش دفعات مسجلة للطالب بعد.'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allPayments.map((p) => (
                      <div
                        key={p.id}
                        className="classy-card p-3.5 bg-[#FFFFFF] border-[#C7CDD3] flex items-center justify-between text-xs hover:border-[#0A3D62]/40 transition-all"
                      >
                        <div>
                          <p className="font-black text-[#16324F] text-sm">{p.amount} {t('currency')}</p>
                          <p className="text-[11px] text-[#6F7882] font-medium">
                            {p.date} •{' '}
                            {p.paymentType === 'specific_month'
                              ? (isEn ? `Month: ${getArabicMonthName(p.targetMonth || 1)}` : `شهر ${getArabicMonthName(p.targetMonth || 1)}`)
                              : (isEn ? 'Class Payment' : 'سداد حصص')}{' '}
                            {p.notes ? `• ${p.notes}` : ''}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#C7CDD3]/15 border border-[#C7CDD3] text-[#16324F]">
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
                <span className="font-black text-xs text-[#16324F] block">
                  {isEn ? `Prepaid Session Credit Logs (${allCreditLogs.length})` : `سجل حركات رصيد الحصص الدفع المسبق (${allCreditLogs.length})`}
                </span>

                {allCreditLogs.length === 0 ? (
                  <div className="classy-card p-8 text-center space-y-3 bg-[#FFFFFF]">
                    <Coins className="w-8 h-8 text-[#6F7882] mx-auto opacity-40" />
                    <p className="text-xs font-bold text-[#6F7882]">{isEn ? 'No credit balance logs recorded.' : 'لا توجد حركات رصيد مسجلة.'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allCreditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="classy-card p-3.5 bg-[#FFFFFF] border-[#C7CDD3] flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <strong className="font-black text-[#16324F] block truncate">
                            {log.reason || (isEn ? 'Credit adjustment' : 'حركة رصيد')}
                          </strong>
                          <p className="text-[11px] text-[#6F7882]">
                            {log.date} • {isEn ? `Balance after: ${log.balanceAfter} sessions` : `الرصيد بعد العملية: ${log.balanceAfter} حصص`}
                          </p>
                        </div>

                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 ${
                            log.sessionsDelta > 0
                              ? 'bg-[#C7CDD3]/65 text-[#16324F] border border-[#0A3D62]/60'
                              : 'bg-[#C7CDD3]/70 text-[#16324F] border border-[#16324F]/50'
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
        </div>
      </div>

      {/* Child Modals with Proper Portaling & Layering */}
      {isRecordPrivateModalOpen && (
        <RecordPrivateSessionModal
          isOpen={isRecordPrivateModalOpen}
          onClose={() => setIsRecordPrivateModalOpen(false)}
          defaultStudentId={student.id}
          onSessionCreated={() => {
            setIsRecordPrivateModalOpen(false);
            onDataChanged();
          }}
        />
      )}

      {isQuickBehaviorModalOpen && (
        <QuickBehaviorLogModal
          isOpen={isQuickBehaviorModalOpen}
          onClose={() => setIsQuickBehaviorModalOpen(false)}
          students={[student]}
          defaultStudentId={student.id}
          onLogSaved={() => {
            setIsQuickBehaviorModalOpen(false);
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
    </ModalPortal>
  );
};
