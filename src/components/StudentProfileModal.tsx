import React, { useState, useEffect } from 'react';
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
} from '../utils/storage';
import { StudentAvatar } from './StudentAvatar';
import { RecordPrivateSessionModal } from './RecordPrivateSessionModal';
import { QuickBehaviorLogModal } from './QuickBehaviorLogModal';
import { SafeDeleteStudentModal } from './SafeDeleteStudentModal';
import { getLocalizedStageName } from '../utils/stages';
import { getUpcomingClassesForStudent, UpcomingStudentClass, formatTimeDisplay } from '../utils/schedule';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import {
  calculateStudentBehaviorStats,
  formatBehaviorTime,
  getCategoryBadge,
} from '../utils/behavior';

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
  const [activeSubTab, setActiveSubTab] = useState<
    'overview' | 'groups' | 'private' | 'finances' | 'attendance' | 'behavior' | 'history' | 'credit_logs'
  >('overview');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'group' | 'private'>('all');
  const [isRecordPrivateModalOpen, setIsRecordPrivateModalOpen] = useState<boolean>(false);
  const [isQuickBehaviorModalOpen, setIsQuickBehaviorModalOpen] = useState<boolean>(false);
  const [behaviorFilterCategory, setBehaviorFilterCategory] = useState<
    'all' | 'positive' | 'needs_improvement' | 'neutral'
  >('all');
  const [behaviorSearchQuery, setBehaviorSearchQuery] = useState<string>('');
  const [behaviorSelectedTag, setBehaviorSelectedTag] = useState<string>('all');
  const [isAddingPrivateService, setIsAddingPrivateService] = useState<boolean>(false);
  const [newPrivateSubject, setNewPrivateSubject] = useState<string>('درس خاص');
  const [newPrivatePrice, setNewPrivatePrice] = useState<number>(100);
  const [newPrivateHourlyRate, setNewPrivateHourlyRate] = useState<number>(150);
  const [newPrivateBillingMode, setNewPrivateBillingMode] = useState<BillingMode>('postpaid');
  const [newPrivatePackageSessions, setNewPrivatePackageSessions] = useState<number>(10);
  const [newPrivatePackagePrice, setNewPrivatePackagePrice] = useState<number>(1000);
  const [newPrivateDays, setNewPrivateDays] = useState<string[]>(['السبت']);
  const [newPrivateTime, setNewPrivateTime] = useState<string>('16:00');
  const [newPrivateLocation, setNewPrivateLocation] = useState<string>('منزل الطالب');

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

  // Load relations and calculated financials
  const studentGroups = student ? db.getStudentGroups(student.id) : [];
  const enrollments = db.getEnrollments();
  const grandFinancials: StudentGrandFinancialSummary = student
    ? db.calculateStudentGrandFinancials(student.id)
    : {
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
  const allPayments = grandFinancials.allPayments;
  const attendanceList = student ? db.getStudentAttendance(student.id) : [];
  const allSessions = db.getSessions();
  const allCreditLogs = student ? db.getCreditLogs().filter((l) => l.studentId === student.id) : [];
  const studentBehaviorLogs = student ? db.getStudentBehaviorLogs(student.id) : [];
  const behaviorStats = calculateStudentBehaviorStats(studentBehaviorLogs);
  const serviceType = student ? db.getStudentServiceType(student.id) : 'none';

  // Upcoming scheduled classes for student
  const upcomingClasses = student
    ? getUpcomingClassesForStudent(student.id, allGroups, enrollments, 5, true)
    : [];
  const nextClass = upcomingClasses[0] || null;

  // Attendance metrics calculation
  const totalScheduledSessions = attendanceList.length;
  const presentCount = attendanceList.filter((a) => a.status === 'present').length;
  const absentChargedCount = attendanceList.filter(
    (a) => a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false)
  ).length;
  const absentExcusedCount = attendanceList.filter(
    (a) => a.status === 'absent_free' || a.status === 'excused' || a.isCharged === false
  ).length;
  const lateCount = attendanceList.filter((a) => a.status === 'late').length;
  const cancelledCount = allSessions.filter(
    (s) =>
      s.status === 'cancelled' &&
      (s.studentId === student?.id || studentGroups.some((g) => g.group.id === s.groupId))
  ).length;
  const totalCounted = presentCount + absentChargedCount + absentExcusedCount + lateCount;
  const attendanceRate =
    totalCounted > 0 ? Math.round(((presentCount + lateCount) / totalCounted) * 100) : 100;

  // Payment methods breakdown
  const paymentMethodsSummary = allPayments.reduce<Record<string, number>>((acc, p) => {
    const method = p.paymentMethod || 'cash';
    acc[method] = (acc[method] || 0) + (Number(p.amount) || 0);
    return acc;
  }, {});

  // Recent activity stream (Attendance, Payments, Added sessions, Credit logs, Behavior logs)
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

  const recentActivity: ActivityItem[] = [];

  // 1. Add behavior activities
  studentBehaviorLogs.slice(0, 8).forEach((b) => {
    const isPos = b.category === 'positive';
    const isNeg = b.category === 'needs_improvement';
    recentActivity.push({
      id: `act_bhv_${b.id}`,
      type: 'behavior',
      date: b.timestamp.split('T')[0],
      title: `${b.emoji ? b.emoji + ' ' : ''}${b.tag}`,
      subtitle: b.note || (b.groupName ? `في ${b.groupName}` : 'تقييم سلوكي سريع'),
      badge: `${(b.points ?? 0) > 0 ? '+' : ''}${b.points ?? 0} نقطة`,
      badgeColor: isPos
        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
        : isNeg
        ? 'bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]'
        : 'bg-[#F6F7FC] text-[#17163D] border border-[#E8E7FF]',
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

    recentActivity.push({
      id: `act_att_${att.id}`,
      type: 'attendance',
      date: ses?.date || att.recordedAt?.split('T')[0] || '',
      title: ses?.title || grp?.name || 'حصة دراسية',
      subtitle: isPres
        ? 'حضور كامل'
        : isLate
        ? 'حضور متأخر'
        : isCharged
        ? 'غياب محسوب'
        : `غياب معفى (${att.absenceReason || 'معتذر'})`,
      badge: isPres ? 'حاضر' : isLate ? 'متأخر' : isCharged ? 'غياب محسوب' : 'غياب معفى',
      badgeColor: isPres
        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
        : isLate
        ? 'bg-amber-50 text-amber-900 border border-amber-300'
        : isCharged
        ? 'bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]'
        : 'bg-[#E8E7FF] text-[#403B9C] border border-[#D8D5FB]',
      timestamp: new Date(att.recordedAt || ses?.date || 0).getTime(),
    });
  });

  // 3. Add payment activities
  allPayments.slice(0, 8).forEach((p) => {
    recentActivity.push({
      id: `act_pay_${p.id}`,
      type: 'payment',
      date: p.date,
      title: `سداد مبلغ ${p.amount} ج.م`,
      subtitle: `${
        p.notes || (p.targetMonth ? `عن شهر ${getArabicMonthName(p.targetMonth)}` : 'دفعة حساب')
      }`,
      badge:
        p.paymentMethod === 'vodafone_cash'
          ? 'فودافون كاش'
          : p.paymentMethod === 'instapay'
          ? 'إنستاباي'
          : p.paymentMethod === 'bank_transfer'
          ? 'تحويل بنكي'
          : 'كاش',
      badgeColor: 'bg-emerald-50 text-emerald-800 border border-emerald-300',
      timestamp: new Date(p.createdAt || p.date).getTime(),
    });
  });

  // 4. Add credit log activities
  allCreditLogs.slice(0, 8).forEach((log) => {
    recentActivity.push({
      id: `act_crd_${log.id}`,
      type: 'credit',
      date: log.date,
      title: log.reason || 'تعديل رصيد الحصص',
      subtitle: `الرصيد بعد العملية: ${log.balanceAfter} حصص`,
      badge: `${log.sessionsDelta > 0 ? '+' : ''}${log.sessionsDelta} حصة`,
      badgeColor:
        log.sessionsDelta > 0
          ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
          : 'bg-amber-50 text-amber-900 border border-amber-300',
      timestamp: new Date(log.date).getTime(),
    });
  });

  recentActivity.sort((a, b) => b.timestamp - a.timestamp);
  const latestActivities = recentActivity.slice(0, 6);

  const privateEnrollments = grandFinancials.enrollmentsSummary.filter(
    (e) => e.groupType === 'private'
  );
  const groupEnrollments = grandFinancials.enrollmentsSummary.filter(
    (e) => e.groupType !== 'private'
  );
  const hasPrivate =
    privateEnrollments.length > 0 || serviceType === 'private_only' || serviceType === 'both';

  const filteredEnrollments = grandFinancials.enrollmentsSummary.filter((e) => {
    if (serviceFilter === 'all') return true;
    if (serviceFilter === 'private') return e.groupType === 'private';
    if (serviceFilter === 'group') return e.groupType !== 'private';
    return true;
  });

  const handleCreatePrivateService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    try {
      const isHourly = newPrivateBillingMode === 'hourly';
      const isPkg = newPrivateBillingMode === 'package';
      db.createPrivateLessonService(student.id, {
        subject: newPrivateSubject.trim() || 'درس خاص',
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
      alert('حدث خطأ أثناء إضافة الخدمة الخاصة');
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

  const handleUpdateAttendanceStatus = (
    sessionId: string,
    status: AttendanceStatus,
    isCharged: boolean,
    reason?: string
  ) => {
    if (!student) return;
    const existingAtt = attendanceList.find((a) => a.sessionId === sessionId);
    const session = allSessions.find((s) => s.id === sessionId);
    const enr = grandFinancials.enrollmentsSummary.find(
      (e) => e.groupId === session?.groupId || e.enrollmentId === session?.enrollmentId
    );

    const rec: Attendance = {
      id: existingAtt?.id || `att_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      studentId: student.id,
      enrollmentId: session?.enrollmentId || enr?.enrollmentId,
      status,
      isCharged,
      absenceReason: reason,
      paymentStatus: existingAtt?.paymentStatus,
      isPaid: existingAtt?.isPaid,
      paymentOverride: existingAtt?.paymentOverride,
      recordedAt: new Date().toISOString(),
    };
    db.saveAttendanceBatch(sessionId, [rec]);
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

  const handleCancelSession = (session: Session) => {
    if (confirm(`هل أنت متأكد من إلغاء الحصة (${session.title})؟ لن يتم احتسابها مالياً.`)) {
      const updated: Session = { ...session, status: 'cancelled' };
      db.saveSession(updated);
      handleUpdateAttendanceStatus(session.id, 'excused', false, 'حصة ملغاة');
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    const sessionAtt = db.getAttendance().filter((a) => a.sessionId === sessionId);
    const hasRecordedAttendance = sessionAtt.length > 0;
    const warningMsg = hasRecordedAttendance
      ? `تحذير هام: هذه الحصة مسجل لها كشف حضور لعدد (${sessionAtt.length}) طالب.\n\nحذف الحصة سيؤدي إلى مسح سجلات الحضور وإلغاء أي مستحقات مالية متعلقة بها.\n\nهل أنت متأكد من الحذف النهائي؟`
      : 'هل أنت متأكد من حذف هذه الحصة نهائياً؟';

    if (confirm(warningMsg)) {
      db.deleteSession(sessionId);
      onDataChanged();
    }
  };

  const [isSafeDeleteModalOpen, setIsSafeDeleteModalOpen] = useState(false);

  const handleRemoveEnrollment = (enrollmentId: string, groupName: string) => {
    if (confirm(`هل أنت متأكد من إلغاء قيد الطالب من ${groupName}؟`)) {
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

  const modalLayer = useModalLayer('student-profile', isOpen && !!student, onClose);

  if (!isOpen || !student) return null;

  const isArchived = student.status === 'archived';

  return (
    <ModalPortal>
      <div
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir="rtl"
      >
        <div className="bg-[#F5F6FC] border border-[#E8E7FF] rounded-t-[32px] sm:rounded-[32px] max-w-2xl w-full mx-auto max-h-[94vh] flex flex-col overflow-hidden shadow-2xl relative">
          {/* =========================================================================
              1. STUDENT PROFILE HERO (Classy Midnight & Royal Gradient)
              ========================================================================= */}
          <div className="bg-gradient-to-r from-[#17163D] via-[#403B9C] to-[#7657F6] p-5 sm:p-6 text-white relative overflow-hidden shrink-0 border-b border-white/10">
            {/* Ambient internal glows */}
            <div className="absolute -top-16 -right-16 w-52 h-52 bg-[#7657F6]/35 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-[#FF647C]/30 rounded-full blur-3xl pointer-events-none" />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-all cursor-pointer z-10"
              title="إغلاق الملف"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 pl-10">
              <div className="flex items-center gap-3.5 min-w-0">
                <StudentAvatar
                  student={student}
                  size="xl"
                  showFrame={true}
                  className="shrink-0 shadow-lg"
                />

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                      {student.name}
                    </h2>

                    {/* Archived Status Badge */}
                    {isArchived && (
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/30 flex items-center gap-1 shadow-2xs">
                        <Archive className="w-3 h-3 text-amber-300" />
                        <span>طالب مؤرشف</span>
                      </span>
                    )}

                    {/* Service Badges */}
                    {serviceType === 'both' && (
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/20">
                        مجموعة + درس خاص
                      </span>
                    )}
                    {serviceType === 'private_only' && (
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#FF647C]/20 text-[#FF647C] border border-[#FF647C]/30">
                        درس خاص
                      </span>
                    )}
                    {serviceType === 'group_only' && (
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-white/20 text-[#E8E7FF] border border-white/20">
                        مجموعة فقط
                      </span>
                    )}
                    {serviceType === 'none' && !isArchived && (
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/15">
                        بدون اشتراك نشط
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[#E8E7FF]/90 font-medium flex-wrap">
                    <span className="font-bold bg-white/15 px-2.5 py-0.5 rounded-lg border border-white/10">
                      {getLocalizedStageName(student.gradeLevel) || 'الصف غير محدد'}
                    </span>
                    {student.school && <span>• مدرسة {student.school}</span>}
                    {student.city && <span>• {student.city}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Archived Alert Banner */}
            {isArchived && (
              <div className="mt-4 p-3 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 relative z-10">
                <div className="text-xs font-medium leading-relaxed text-right w-full sm:w-auto">
                  <strong className="font-black block text-white">هذا الطالب مؤرشف حالياً</strong>
                  <span>كافة السجلات والحصص والمدفوعات التاريخية محفوظة بالكامل.</span>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreStudent}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer shrink-0 active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>استعادة الطالب للنشاط</span>
                </button>
              </div>
            )}

            {/* Quick Contacts & Actions Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-white/15 relative z-10">
              {hasPrivate && (
                <button
                  type="button"
                  onClick={() => setIsRecordPrivateModalOpen(true)}
                  className="py-2 px-3 rounded-xl bg-gradient-to-r from-[#FF647C] to-[#7657F6] text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95 hover:brightness-105"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>+ حصة خاصة</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onOpenAddPayment(student)}
                className="py-2 px-3 rounded-xl bg-white text-[#17163D] hover:bg-[#F5F6FC] text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>+ تسجيل دفعة</span>
              </button>

              <button
                type="button"
                onClick={() => setIsQuickBehaviorModalOpen(true)}
                className="py-2 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <Zap className="w-3.5 h-3.5 text-[#55C7E8]" />
                <span>تقييم سلوك</span>
              </button>

              <button
                type="button"
                onClick={() => onEditStudent(student)}
                className="py-2 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                title="تعديل بيانات الطالب"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>تعديل الطالب</span>
              </button>
            </div>
          </div>

          {/* =========================================================================
              2. SUB-NAVIGATION TABS (Horizontal Scrollable Strip)
              ========================================================================= */}
          <div className="flex border-b border-[#E8E7FF] bg-white px-2 overflow-x-auto android-scrollbar shrink-0 z-10 sticky top-0">
            <button
              onClick={() => setActiveSubTab('overview')}
              className={`py-3 px-3.5 text-center text-xs font-black border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'overview'
                  ? 'border-[#7657F6] text-[#7657F6] bg-[#E8E7FF]/30'
                  : 'border-transparent text-[#74778F] hover:text-[#17163D]'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>لوحة الطالب</span>
            </button>

            <button
              onClick={() => setActiveSubTab('groups')}
              className={`py-3 px-3.5 text-center text-xs font-black border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'groups'
                  ? 'border-[#7657F6] text-[#7657F6] bg-[#E8E7FF]/30'
                  : 'border-transparent text-[#74778F] hover:text-[#17163D]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>المجموعات ({groupEnrollments.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('private')}
              className={`py-3 px-3.5 text-center text-xs font-black border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'private'
                  ? 'border-[#FF647C] text-[#FF647C] bg-[#FFF1F3]'
                  : 'border-transparent text-[#74778F] hover:text-[#17163D]'
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#FF647C]" />
              <span>الدرس الخاص {privateEnrollments.length > 0 ? `(${privateEnrollments.length})` : ''}</span>
            </button>

            <button
              onClick={() => setActiveSubTab('finances')}
              className={`py-3 px-3.5 text-center text-xs font-black border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'finances'
                  ? 'border-[#7657F6] text-[#7657F6] bg-[#E8E7FF]/30'
                  : 'border-transparent text-[#74778F] hover:text-[#17163D]'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>الحسابات والماليات</span>
            </button>

            <button
              onClick={() => setActiveSubTab('attendance')}
              className={`py-3 px-3.5 text-center text-xs font-black border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'attendance'
                  ? 'border-[#7657F6] text-[#7657F6] bg-[#E8E7FF]/30'
                  : 'border-transparent text-[#74778F] hover:text-[#17163D]'
              }`}
            >
              <CalendarCheck2 className="w-4 h-4" />
              <span>سجل الحضور ({attendanceList.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('behavior')}
              className={`py-3 px-3.5 text-center text-xs font-black border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'behavior'
                  ? 'border-[#7657F6] text-[#7657F6] bg-[#E8E7FF]/30'
                  : 'border-transparent text-[#74778F] hover:text-[#17163D]'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>السلوك ({studentBehaviorLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('history')}
              className={`py-3 px-3.5 text-center text-xs font-black border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'history'
                  ? 'border-[#7657F6] text-[#7657F6] bg-[#E8E7FF]/30'
                  : 'border-transparent text-[#74778F] hover:text-[#17163D]'
              }`}
            >
              <History className="w-4 h-4" />
              <span>سجل المدفوعات</span>
            </button>

            <button
              onClick={() => setActiveSubTab('credit_logs')}
              className={`py-3 px-3.5 text-center text-xs font-black border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                activeSubTab === 'credit_logs'
                  ? 'border-[#7657F6] text-[#7657F6] bg-[#E8E7FF]/30'
                  : 'border-transparent text-[#74778F] hover:text-[#17163D]'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>حركات الرصيد ({allCreditLogs.length})</span>
            </button>
          </div>

          {/* =========================================================================
              3. TAB CONTENTS
              ========================================================================= */}
          <div className="p-4 sm:p-5 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar flex-1 space-y-4 text-xs text-[#191A2E]">
            {/* -------------------------------------------------------------
                TAB 1: OVERVIEW / TEACHER DOSSIER
                ------------------------------------------------------------- */}
            {activeSubTab === 'overview' && (
              <div className="space-y-4">
                {/* Financial Summary Bento Cards */}
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="classy-card p-3.5 bg-white space-y-1">
                    <span className="text-[10px] font-bold text-[#74778F] block">
                      إجمالي الرسوم (Gross)
                    </span>
                    <strong className="text-base sm:text-lg font-black text-[#17163D] block">
                      {grandFinancials.grandTotalDue} ج.م
                    </strong>
                  </div>

                  <div className="classy-card p-3.5 bg-white space-y-1 border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-800 block">
                      إجمالي المدفوع
                    </span>
                    <strong className="text-base sm:text-lg font-black text-emerald-700 block">
                      {grandFinancials.grandTotalPaid} ج.م
                    </strong>
                  </div>

                  <div
                    className={`classy-card p-3.5 space-y-1 ${
                      grandFinancials.grandRemaining > 0
                        ? 'bg-[#FFF1F3] border-[#FECDD3]'
                        : 'bg-white border-emerald-200'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-[#74778F] block">
                      المستحق المتبقي
                    </span>
                    <strong
                      className={`text-base sm:text-lg font-black block ${
                        grandFinancials.grandRemaining > 0 ? 'text-[#FF647C]' : 'text-emerald-700'
                      }`}
                    >
                      {grandFinancials.grandRemaining} ج.م
                    </strong>
                  </div>
                </div>

                {/* Direct Contacts & WhatsApp Bar */}
                <div className="classy-card p-3.5 bg-white flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#7657F6]" />
                    <span className="font-bold text-xs text-[#17163D]">بيانات التواصل المباشر:</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {student.phone && (
                      <a
                        href={`tel:${student.phone}`}
                        className="px-3 py-1.5 rounded-xl bg-[#F6F7FC] hover:bg-[#E8E7FF] text-[#17163D] font-bold text-xs flex items-center gap-1.5 border border-[#E8E7FF] transition-colors"
                      >
                        <Phone className="w-3 h-3 text-[#7657F6]" />
                        <span>{student.phone}</span>
                      </a>
                    )}

                    {student.parentPhone && (
                      <a
                        href={`https://wa.me/${student.parentPhone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5 border border-emerald-300 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>واتساب {student.parentRelation || 'ولي الأمر'}: {student.parentPhone}</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Attendance & Behavioral Quick Bento Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Attendance Rate */}
                  <div className="classy-card p-4 bg-white space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-[#17163D] flex items-center gap-1.5">
                        <CalendarCheck2 className="w-4 h-4 text-[#7657F6]" />
                        <span>معدل الحضور والالتزام</span>
                      </span>
                      <span className="text-xs font-black text-emerald-700">
                        {attendanceRate}%
                      </span>
                    </div>

                    <div className="w-full bg-[#E8E7FF] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${attendanceRate}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#74778F] font-bold pt-1">
                      <span>حاضر: {presentCount}</span>
                      <span>متأخر: {lateCount}</span>
                      <span>غياب محسوب: {absentChargedCount}</span>
                      <span>معذور: {absentExcusedCount}</span>
                    </div>
                  </div>

                  {/* Behavior & Points */}
                  <div className="classy-card p-4 bg-white space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-[#17163D] flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-[#55C7E8]" />
                        <span>التقييم السلوكي والتفاعل</span>
                      </span>
                      <span
                        className={`text-xs font-black ${
                          behaviorStats.totalPoints > 0
                            ? 'text-emerald-700'
                            : behaviorStats.totalPoints < 0
                            ? 'text-[#FF647C]'
                            : 'text-[#17163D]'
                        }`}
                      >
                        {behaviorStats.totalPoints > 0
                          ? `+${behaviorStats.totalPoints}`
                          : behaviorStats.totalPoints}{' '}
                        نقطة
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold pt-1">
                      <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <span className="text-[10px] block">تميز وتفاعل</span>
                        <strong className="text-sm font-black">{behaviorStats.positiveCount}</strong>
                      </div>
                      <div className="p-2 rounded-xl bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]">
                        <span className="text-[10px] block">يحتاج متابعة</span>
                        <strong className="text-sm font-black">{behaviorStats.needsImprovementCount}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Persistent Teacher Notes */}
                <div className="classy-card p-4 bg-white space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-[#17163D] flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#7657F6]" />
                      <span>ملاحظات المعلم الخاصة عن الطالب:</span>
                    </span>
                    {isNotesSaved && (
                      <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 animate-in fade-in">
                        <Check className="w-3 h-3" />
                        <span>تم الحفظ بنجاح</span>
                      </span>
                    )}
                  </div>

                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder="اكتب ملاحظاتك عن مستوى الطالب، متابعة ولي الأمر، أو خطة المنهج..."
                    rows={3}
                    className="w-full p-3 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF] text-xs text-[#191A2E] font-medium focus:outline-none focus:border-[#7657F6] focus:bg-white transition-all shadow-inner"
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      className="px-4 py-2 rounded-xl bg-[#17163D] hover:bg-[#403B9C] text-white font-black text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>حفظ الملاحظات</span>
                    </button>
                  </div>
                </div>

                {/* Recent Activity Timeline Feed */}
                <div className="classy-card p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-xs text-[#17163D] flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-[#7657F6]" />
                      <span>سجل النشاط والعمليات الأخيرة</span>
                    </h3>
                  </div>

                  {latestActivities.length === 0 ? (
                    <p className="text-xs text-[#74778F] font-bold text-center py-3">
                      لا يوجد نشاط مسجل للطالب بعد.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {latestActivities.map((act) => (
                        <div
                          key={act.id}
                          className="p-3 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <strong className="font-black text-[#17163D] block truncate">
                              {act.title}
                            </strong>
                            <p className="text-[11px] text-[#74778F] truncate">
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
                <div className="p-3.5 rounded-2xl bg-[#FFF1F3]/50 border border-[#FECDD3] flex items-center justify-between flex-wrap gap-2">
                  <div className="space-y-0.5">
                    <strong className="text-xs font-black text-[#17163D] block">
                      إدارة حالة الطالب والأرشفة
                    </strong>
                    <p className="text-[10px] text-[#74778F]">
                      أرشفة الطالب تحتفظ بكافة سجلاته وحساباته، بينما الحذف النهائي يزيل بياناته.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSafeDeleteModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-white text-[#FF647C] border border-[#FECDD3] hover:bg-[#FFF1F3] text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>أرشفة أو حذف</span>
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
                  <span className="font-black text-xs text-[#17163D]">
                    المجموعات الدراسية المسجل بها ({groupEnrollments.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenEnrollModal(student)}
                    className="px-3 py-1.5 rounded-xl bg-[#17163D] hover:bg-[#403B9C] text-white font-black text-xs flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>تسجيل في مجموعة</span>
                  </button>
                </div>

                {groupEnrollments.length === 0 ? (
                  <div className="classy-card p-8 text-center space-y-3 bg-white">
                    <Layers className="w-8 h-8 text-[#74778F] mx-auto opacity-40" />
                    <p className="text-xs font-bold text-[#74778F]">
                      الطالب مش مضاف لأي مجموعة دراسية حالياً.
                    </p>
                    <button
                      type="button"
                      onClick={() => onOpenEnrollModal(student)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF647C] to-[#7657F6] text-white font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة الطالب لمجموعة الآن</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {groupEnrollments.map((enr) => (
                      <div
                        key={enr.enrollmentId}
                        className="classy-card p-4 bg-white border-[#E8E7FF] hover:border-[#7657F6]/40 transition-all space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: enr.accentColor || '#7657F6' }}
                              />
                              <h4 className="font-black text-sm text-[#17163D]">{enr.groupName}</h4>
                              <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-[#E8E7FF] text-[#403B9C]">
                                {getBillingModeLabel(enr.billingType, enr.billingMode)}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#74778F]">
                              سعر الحصة المقرر: <strong className="text-[#17163D]">{enr.customPrice} ج.م</strong>
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditEnrollment(enr.enrollmentId)}
                              className="p-1.5 rounded-lg bg-[#F6F7FC] hover:bg-[#E8E7FF] text-[#74778F] hover:text-[#17163D] border border-[#E8E7FF] transition-colors cursor-pointer"
                              title="تعديل شروط التسعير والاشتراك"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveEnrollment(enr.enrollmentId, enr.groupName)}
                              className="p-1.5 rounded-lg bg-[#FFF1F3] hover:bg-[#FFE4E6] text-[#FF647C] border border-[#FECDD3] transition-colors cursor-pointer"
                              title="إلغاء قيد الطالب من المجموعة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Inline Billing Editor */}
                        {editingEnrollmentId === enr.enrollmentId && (
                          <div className="p-3 bg-[#F6F7FC] rounded-2xl border border-[#E8E7FF] space-y-2.5 text-xs">
                            <span className="font-black text-[#17163D] block">تعديل نظام المحاسبة والتسعير:</span>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-[#74778F] font-bold mb-1">
                                  نظام المحاسبة
                                </label>
                                <select
                                  value={editBillingMode}
                                  onChange={(e) => setEditBillingMode(e.target.value as BillingMode)}
                                  className="w-full p-2 rounded-xl bg-white border border-[#E8E7FF] text-xs font-bold text-[#17163D]"
                                >
                                  <option value="prepaid">دفع مسبق بالحصة</option>
                                  <option value="postpaid">دفع بعد الحصة (آجل)</option>
                                  <option value="monthly">اشتراك شهري</option>
                                  <option value="package">باقة حصص</option>
                                  <option value="hourly">محاسبة بالساعة</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] text-[#74778F] font-bold mb-1">
                                  السعر المخصص (ج.م)
                                </label>
                                <input
                                  type="number"
                                  value={editCustomPrice}
                                  onChange={(e) => setEditCustomPrice(Number(e.target.value))}
                                  className="w-full p-2 rounded-xl bg-white border border-[#E8E7FF] text-xs font-bold text-[#17163D]"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingEnrollmentId(null)}
                                className="px-3 py-1.5 rounded-xl bg-white border border-[#E8E7FF] text-xs font-bold text-[#74778F]"
                              >
                                إلغاء
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEnrollmentBilling(enr.enrollmentId)}
                                className="px-3.5 py-1.5 rounded-xl bg-[#17163D] text-white text-xs font-black shadow-xs"
                              >
                                حفظ التعديل
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Financial Metrics Strip */}
                        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                          <div className="p-2 bg-[#F6F7FC] rounded-xl border border-[#E8E7FF]">
                            <span className="text-[#74778F] block font-bold">الحصص المستهلكة</span>
                            <strong className="text-xs font-black text-[#17163D]">
                              {enr.usedSessionsCount || 0}
                            </strong>
                          </div>
                          <div className="p-2 bg-[#F6F7FC] rounded-xl border border-[#E8E7FF]">
                            <span className="text-[#74778F] block font-bold">رصيد الحصص</span>
                            <strong className="text-xs font-black text-[#7657F6]">
                              {enr.sessionCredit || 0}
                            </strong>
                          </div>
                          <div className="p-2 bg-[#F6F7FC] rounded-xl border border-[#E8E7FF]">
                            <span className="text-[#74778F] block font-bold">المدفوع</span>
                            <strong className="text-xs font-black text-emerald-700">
                              {enr.totalPaid} ج.م
                            </strong>
                          </div>
                          <div
                            className={`p-2 rounded-xl border ${
                              enr.remaining > 0
                                ? 'bg-[#FFF1F3] border-[#FECDD3] text-[#FF647C]'
                                : 'bg-[#F6F7FC] border-[#E8E7FF] text-emerald-700'
                            }`}
                          >
                            <span className="block font-bold">المتبقي</span>
                            <strong className="text-xs font-black">{enr.remaining} ج.م</strong>
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
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-[#17163D]">
                    الخدمات والدروس الخاصة ({privateEnrollments.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingPrivateService(!isAddingPrivateService)}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FF647C] to-[#7657F6] text-white font-black text-xs flex items-center gap-1 shadow-md shadow-[#FF647C]/30 transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة درس خاص جديد</span>
                  </button>
                </div>

                {/* Add Private Service Drawer Form */}
                {isAddingPrivateService && (
                  <form
                    onSubmit={handleCreatePrivateService}
                    className="classy-card p-4 bg-white border-[#FECDD3] space-y-3 shadow-md"
                  >
                    <div className="flex items-center justify-between border-b border-[#E8E7FF] pb-2">
                      <span className="font-black text-xs text-[#17163D]">
                        إعداد وتخصيص خدمة درس خاص جديدة:
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAddingPrivateService(false)}
                        className="text-[#74778F] hover:text-[#17163D]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div>
                        <label className="block text-[10px] text-[#74778F] font-bold mb-1">
                          المادة / موضوع الدرس
                        </label>
                        <input
                          type="text"
                          value={newPrivateSubject}
                          onChange={(e) => setNewPrivateSubject(e.target.value)}
                          placeholder="مثال: لغة إنجليزية - خاص"
                          className="w-full p-2.5 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] font-bold text-xs text-[#17163D]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-[#74778F] font-bold mb-1">
                          نظام المحاسبة
                        </label>
                        <select
                          value={newPrivateBillingMode}
                          onChange={(e) =>
                            setNewPrivateBillingMode(e.target.value as BillingMode)
                          }
                          className="w-full p-2.5 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] font-bold text-xs text-[#17163D]"
                        >
                          <option value="postpaid">دفع آجل (بعد الحصة)</option>
                          <option value="prepaid">دفع مسبق (شحن رصيد)</option>
                          <option value="monthly">اشتراك شهري</option>
                          <option value="package">باقة حصص</option>
                          <option value="hourly">محاسبة بالساعة (Hourly)</option>
                        </select>
                      </div>

                      {newPrivateBillingMode === 'hourly' ? (
                        <div>
                          <label className="block text-[10px] text-[#74778F] font-bold mb-1">
                            سعر الساعة (ج.م)
                          </label>
                          <input
                            type="number"
                            value={newPrivateHourlyRate}
                            onChange={(e) => setNewPrivateHourlyRate(Number(e.target.value))}
                            className="w-full p-2.5 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] font-bold text-xs text-[#17163D]"
                            required
                          />
                        </div>
                      ) : newPrivateBillingMode === 'package' ? (
                        <>
                          <div>
                            <label className="block text-[10px] text-[#74778F] font-bold mb-1">
                              عدد حصص الباقة
                            </label>
                            <input
                              type="number"
                              value={newPrivatePackageSessions}
                              onChange={(e) =>
                                setNewPrivatePackageSessions(Number(e.target.value))
                              }
                              className="w-full p-2.5 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] font-bold text-xs text-[#17163D]"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#74778F] font-bold mb-1">
                              إجمالي سعر الباقة (ج.م)
                            </label>
                            <input
                              type="number"
                              value={newPrivatePackagePrice}
                              onChange={(e) => setNewPrivatePackagePrice(Number(e.target.value))}
                              className="w-full p-2.5 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] font-bold text-xs text-[#17163D]"
                              required
                            />
                          </div>
                        </>
                      ) : (
                        <div>
                          <label className="block text-[10px] text-[#74778F] font-bold mb-1">
                            سعر الحصة (ج.م)
                          </label>
                          <input
                            type="number"
                            value={newPrivatePrice}
                            onChange={(e) => setNewPrivatePrice(Number(e.target.value))}
                            className="w-full p-2.5 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] font-bold text-xs text-[#17163D]"
                            required
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] text-[#74778F] font-bold mb-1">
                          مكان الدرس
                        </label>
                        <input
                          type="text"
                          value={newPrivateLocation}
                          onChange={(e) => setNewPrivateLocation(e.target.value)}
                          placeholder="مثال: منزل الطالب أو السنتر"
                          className="w-full p-2.5 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] font-bold text-xs text-[#17163D]"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingPrivateService(false)}
                        className="px-4 py-2 rounded-xl bg-[#F6F7FC] text-[#74778F] font-bold text-xs"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#FF647C] to-[#7657F6] text-white font-black text-xs shadow-md shadow-[#FF647C]/30"
                      >
                        حفظ وإنشاء الدرس الخاص
                      </button>
                    </div>
                  </form>
                )}

                {privateEnrollments.length === 0 ? (
                  <div className="classy-card p-8 text-center space-y-3 bg-white">
                    <Sparkles className="w-8 h-8 text-[#FF647C] mx-auto opacity-50" />
                    <p className="text-xs font-bold text-[#74778F]">
                      مفيش دروس خاصة مسجلة للطالب حتى الآن.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAddingPrivateService(true)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF647C] to-[#7657F6] text-white font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة أول درس خاص للطالب</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {privateEnrollments.map((enr) => (
                      <div
                        key={enr.enrollmentId}
                        className="classy-card p-4 bg-white border-[#FECDD3] hover:border-[#FF647C]/60 transition-all space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#FF647C]" />
                              <h4 className="font-black text-sm text-[#17163D]">{enr.groupName}</h4>
                              <span className="text-[10px] font-black px-2 py-0.2 rounded-full bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]">
                                {getBillingModeLabel(enr.billingType, enr.billingMode)}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#74778F]">
                              {enr.billingMode === 'hourly' || enr.billingType === 'hourly'
                                ? `سعر الساعة: ${enr.customPrice} ج.م`
                                : `سعر الحصة: ${enr.customPrice} ج.م`}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditEnrollment(enr.enrollmentId)}
                              className="p-1.5 rounded-lg bg-[#F6F7FC] hover:bg-[#E8E7FF] text-[#74778F] hover:text-[#17163D] border border-[#E8E7FF] transition-colors cursor-pointer"
                              title="تعديل شروط التسعير والاشتراك"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveEnrollment(enr.enrollmentId, enr.groupName)}
                              className="p-1.5 rounded-lg bg-[#FFF1F3] hover:bg-[#FFE4E6] text-[#FF647C] border border-[#FECDD3] transition-colors cursor-pointer"
                              title="إلغاء خدمة الدرس الخاص"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Financial Metrics Strip */}
                        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                          <div className="p-2 bg-[#F6F7FC] rounded-xl border border-[#E8E7FF]">
                            <span className="text-[#74778F] block font-bold">
                              {enr.billingMode === 'hourly' || enr.billingType === 'hourly'
                                ? 'الساعات المنفذة'
                                : 'الحصص المستهلكة'}
                            </span>
                            <strong className="text-xs font-black text-[#17163D]">
                              {enr.billingMode === 'hourly' || enr.billingType === 'hourly'
                                ? `${enr.totalHours ?? 0} ساعة`
                                : enr.usedSessionsCount || 0}
                            </strong>
                          </div>
                          <div className="p-2 bg-[#F6F7FC] rounded-xl border border-[#E8E7FF]">
                            <span className="text-[#74778F] block font-bold">رصيد الحصص</span>
                            <strong className="text-xs font-black text-[#7657F6]">
                              {enr.sessionCredit || 0}
                            </strong>
                          </div>
                          <div className="p-2 bg-[#F6F7FC] rounded-xl border border-[#E8E7FF]">
                            <span className="text-[#74778F] block font-bold">المدفوع</span>
                            <strong className="text-xs font-black text-emerald-700">
                              {enr.totalPaid} ج.م
                            </strong>
                          </div>
                          <div
                            className={`p-2 rounded-xl border ${
                              enr.remaining > 0
                                ? 'bg-[#FFF1F3] border-[#FECDD3] text-[#FF647C]'
                                : 'bg-[#F6F7FC] border-[#E8E7FF] text-emerald-700'
                            }`}
                          >
                            <span className="block font-bold">المتبقي</span>
                            <strong className="text-xs font-black">{enr.remaining} ج.م</strong>
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
                <div className="classy-card p-4 bg-white space-y-3 border-emerald-200">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-[#17163D] flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-[#7657F6]" />
                      <span>الحساب المالي الإجمالي للطالب:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenAddPayment(student)}
                      className="px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black text-xs flex items-center gap-1 shadow-xs active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>تسجيل دفعة</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF]">
                      <span className="text-[10px] text-[#74778F] font-bold block">
                        إجمالي الرسوم (Gross)
                      </span>
                      <strong className="text-sm sm:text-base font-black text-[#17163D] mt-0.5 block">
                        {grandFinancials.grandTotalDue} ج.م
                      </strong>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                      <span className="text-[10px] font-bold block">إجمالي المدفوع</span>
                      <strong className="text-sm sm:text-base font-black mt-0.5 block">
                        {grandFinancials.grandTotalPaid} ج.م
                      </strong>
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border ${
                        grandFinancials.grandRemaining > 0
                          ? 'bg-[#FFF1F3] border-[#FECDD3] text-[#FF647C]'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      }`}
                    >
                      <span className="text-[10px] font-bold block">المستحق المتبقي</span>
                      <strong className="text-sm sm:text-base font-black mt-0.5 block">
                        {grandFinancials.grandRemaining} ج.م
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Services Financial Breakdown (Group vs Private) */}
                <div className="classy-card p-4 bg-white space-y-3">
                  <h4 className="font-black text-xs text-[#17163D] flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#7657F6]" />
                    <span>مقارنة الرسوم بين المجموعات والدروس الخاصة:</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-[#403B9C]">خدمات المجموعات</span>
                        <span className="text-[10px] font-bold text-[#74778F]">
                          {grandFinancials.groupsFinancials.enrollments.length} مجموعات
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-[#E8E7FF]">
                        <span>المسدد: {grandFinancials.groupsFinancials.totalPaid} ج</span>
                        <span
                          className={
                            grandFinancials.groupsFinancials.remaining > 0
                              ? 'text-[#FF647C]'
                              : 'text-emerald-700'
                          }
                        >
                          المتبقي: {grandFinancials.groupsFinancials.remaining} ج
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-[#FFF1F3]/40 border border-[#FECDD3] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-[#FF647C]">الدروس الخاصة</span>
                        <span className="text-[10px] font-bold text-[#74778F]">
                          {grandFinancials.privateFinancials.enrollments.length} خدمات خاصة
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-[#FECDD3]">
                        <span>المسدد: {grandFinancials.privateFinancials.totalPaid} ج</span>
                        <span
                          className={
                            grandFinancials.privateFinancials.remaining > 0
                              ? 'text-[#FF647C]'
                              : 'text-emerald-700'
                          }
                        >
                          المتبقي: {grandFinancials.privateFinancials.remaining} ج
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
                  <span className="font-black text-xs text-[#17163D]">
                    سجل الحصص المنفذة والحضور ({attendanceList.length})
                  </span>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                    معدل الالتزام: {attendanceRate}%
                  </span>
                </div>

                {attendanceList.length === 0 ? (
                  <div className="classy-card p-8 text-center space-y-3 bg-white">
                    <CalendarCheck2 className="w-8 h-8 text-[#74778F] mx-auto opacity-40" />
                    <p className="text-xs font-bold text-[#74778F]">
                      مفيش سجلات حضور مسجلة للطالب حتى الآن.
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
                          className="classy-card p-3.5 bg-white border-[#E8E7FF] hover:border-[#7657F6]/40 transition-all space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${
                                  isPrivate ? 'bg-[#FF647C]' : 'bg-[#7657F6]'
                                }`}
                              />
                              <strong className="font-black text-[#17163D]">
                                {session?.title || (isPrivate ? 'درس خاص' : 'حصة مجموعة')}
                              </strong>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                                  isPrivate
                                    ? 'bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]'
                                    : 'bg-[#E8E7FF] text-[#403B9C]'
                                }`}
                              >
                                {isPrivate ? 'خاص' : 'مجموعة'}
                              </span>
                            </div>

                            {/* Status Badge */}
                            <span
                              className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                                att.status === 'present'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                  : att.status === 'late'
                                  ? 'bg-amber-50 text-amber-900 border border-amber-300'
                                  : att.status === 'absent_charged'
                                  ? 'bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]'
                                  : 'bg-[#F6F7FC] text-[#74778F] border border-[#E8E7FF]'
                              }`}
                            >
                              {att.status === 'present'
                                ? 'حاضر'
                                : att.status === 'late'
                                ? 'متأخر'
                                : att.status === 'absent_charged'
                                ? 'غياب محسوب'
                                : 'غياب معذور'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-[#74778F] pt-1 border-t border-[#E8E7FF] flex-wrap gap-2">
                            <span>
                              {session?.date || att.recordedAt?.split('T')[0]}{' '}
                              {session?.startTime
                                ? `• ${formatTimeDisplay(session.startTime, true)}`
                                : ''}
                            </span>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleSessionPaymentOverride(att.sessionId)}
                                className={`px-2 py-0.5 rounded-md font-bold text-[10px] border transition-colors cursor-pointer ${
                                  isUnpaid
                                    ? 'bg-[#FFF1F3] text-[#FF647C] border-[#FECDD3]'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {isUnpaid ? 'غير مسدد (مستحق)' : 'مسدد (خالص)'}
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
                  <span className="font-black text-xs text-[#17163D]">
                    سجل التقييم السلوكي والتفاعل ({studentBehaviorLogs.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsQuickBehaviorModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#17163D] to-[#7657F6] text-white font-black text-xs flex items-center gap-1 shadow-xs active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>تقييم سلوكي جديد</span>
                  </button>
                </div>

                {studentBehaviorLogs.length === 0 ? (
                  <div className="classy-card p-8 text-center space-y-3 bg-white">
                    <Zap className="w-8 h-8 text-[#74778F] mx-auto opacity-40" />
                    <p className="text-xs font-bold text-[#74778F]">
                      لا توجد تقييمات سلوكية مرصودة بعد.
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
                          className="classy-card p-3.5 bg-white border-[#E8E7FF] flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <strong className="font-black text-[#17163D] block truncate">
                              {log.emoji ? `${log.emoji} ` : ''}
                              {log.tag}
                            </strong>
                            <p className="text-[11px] text-[#74778F]">
                              {log.timestamp.split('T')[0]} {log.note ? `• ${log.note}` : ''}
                            </p>
                          </div>

                          <span
                            className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 ${
                              isPos
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                : isNeg
                                ? 'bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]'
                                : 'bg-[#F6F7FC] text-[#17163D] border border-[#E8E7FF]'
                            }`}
                          >
                            {(log.points ?? 0) > 0 ? `+${log.points}` : log.points} نقطة
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
                  <span className="font-black text-xs text-[#17163D]">
                    سجل الدفعات والمقبوضات ({allPayments.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenAddPayment(student)}
                    className="px-3 py-1.5 rounded-xl bg-[#17163D] hover:bg-[#403B9C] text-white font-black text-xs flex items-center gap-1 shadow-xs active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#55C7E8]" />
                    <span>تسجيل دفعة</span>
                  </button>
                </div>

                {allPayments.length === 0 ? (
                  <div className="classy-card p-8 text-center space-y-3 bg-white">
                    <Receipt className="w-8 h-8 text-[#74778F] mx-auto opacity-40" />
                    <p className="text-xs font-bold text-[#74778F]">مفيش دفعات مسجلة للطالب بعد.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allPayments.map((p) => (
                      <div
                        key={p.id}
                        className="classy-card p-3.5 bg-white border-[#E8E7FF] flex items-center justify-between text-xs hover:border-[#7657F6]/40 transition-all"
                      >
                        <div>
                          <p className="font-black text-[#17163D] text-sm">{p.amount} ج.م</p>
                          <p className="text-[11px] text-[#74778F] font-medium">
                            {p.date} •{' '}
                            {p.paymentType === 'specific_month'
                              ? `شهر ${getArabicMonthName(p.targetMonth || 1)}`
                              : 'سداد حصص'}{' '}
                            {p.notes ? `• ${p.notes}` : ''}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F6F7FC] border border-[#E8E7FF] text-[#17163D]">
                          {p.paymentMethod === 'vodafone_cash'
                            ? 'فودافون كاش'
                            : p.paymentMethod === 'instapay'
                            ? 'إنستاباي'
                            : p.paymentMethod === 'bank_transfer'
                            ? 'تحويل بنكي'
                            : 'كاش'}
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
                <span className="font-black text-xs text-[#17163D] block">
                  سجل حركات رصيد الحصص الدفع المسبق ({allCreditLogs.length})
                </span>

                {allCreditLogs.length === 0 ? (
                  <div className="classy-card p-8 text-center space-y-3 bg-white">
                    <Coins className="w-8 h-8 text-[#74778F] mx-auto opacity-40" />
                    <p className="text-xs font-bold text-[#74778F]">لا توجد حركات رصيد مسجلة.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allCreditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="classy-card p-3.5 bg-white border-[#E8E7FF] flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <strong className="font-black text-[#17163D] block truncate">
                            {log.reason || 'حركة رصيد'}
                          </strong>
                          <p className="text-[11px] text-[#74778F]">
                            {log.date} • الرصيد بعد العملية: {log.balanceAfter} حصص
                          </p>
                        </div>

                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 ${
                            log.sessionsDelta > 0
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-50 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {log.sessionsDelta > 0 ? `+${log.sessionsDelta}` : log.sessionsDelta} حصة
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
    </ModalPortal>
  );
};
