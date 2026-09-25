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
} from 'lucide-react';
import { Student, Group, Enrollment, Payment, Attendance, Session, AttendanceStatus, BillingMode, StudentGrandFinancialSummary, StudentBehaviorLog, BehaviorCategory } from '../types';
import { db, getArabicMonthName, getBillingModeLabel, divideMoney, multiplyMoney, roundMoney } from '../utils/storage';
import { StudentAvatar } from './StudentAvatar';
import { RecordPrivateSessionModal } from './RecordPrivateSessionModal';
import { QuickBehaviorLogModal } from './QuickBehaviorLogModal';
import { SafeDeleteStudentModal } from './SafeDeleteStudentModal';
import { getLocalizedStageName } from '../utils/stages';
import { getUpcomingClassesForStudent, UpcomingStudentClass } from '../utils/schedule';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import { calculateStudentBehaviorStats, formatBehaviorTime, getCategoryBadge } from '../utils/behavior';

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
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'groups' | 'private' | 'finances' | 'attendance' | 'behavior' | 'history' | 'credit_logs'>('overview');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'group' | 'private'>('all');
  const [isRecordPrivateModalOpen, setIsRecordPrivateModalOpen] = useState<boolean>(false);
  const [isQuickBehaviorModalOpen, setIsQuickBehaviorModalOpen] = useState<boolean>(false);
  const [behaviorFilterCategory, setBehaviorFilterCategory] = useState<'all' | 'positive' | 'needs_improvement' | 'neutral'>('all');
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
    (s) => s.status === 'cancelled' && (s.studentId === student?.id || studentGroups.some((g) => g.group.id === s.groupId))
  ).length;
  const totalCounted = presentCount + absentChargedCount + absentExcusedCount + lateCount;
  const attendanceRate = totalCounted > 0 ? Math.round(((presentCount + lateCount) / totalCounted) * 100) : 100;

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
      badgeColor: isPos ? 'bg-emerald-50 text-emerald-700' : isNeg ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700',
      timestamp: new Date(b.timestamp || b.createdAt).getTime(),
    });
  });

  // 1. Add attendance activities
  attendanceList.slice(0, 8).forEach((att) => {
    const ses = allSessions.find((s) => s.id === att.sessionId);
    const grp = allGroups.find((g) => g.id === ses?.groupId);
    const isPres = att.status === 'present';
    const isLate = att.status === 'late';
    const isCharged = att.status === 'absent_charged' || (att.status === 'absent' && att.isCharged !== false);
    
    recentActivity.push({
      id: `act_att_${att.id}`,
      type: 'attendance',
      date: ses?.date || att.recordedAt?.split('T')[0] || '',
      title: ses?.title || grp?.name || 'حصة دراسية',
      subtitle: isPres ? 'حضور كامل' : isLate ? 'حضور متأخر' : isCharged ? 'غياب محسوب' : `غياب معفى (${att.absenceReason || 'معتذر'})`,
      badge: isPres ? 'حاضر' : isLate ? 'متأخر' : isCharged ? 'غياب محسوب' : 'غياب معفى',
      badgeColor: isPres ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : isLate ? 'bg-amber-50 text-amber-700 border border-amber-200' : isCharged ? 'bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]' : 'bg-[#E8E7FF] text-[#403B9C]',
      timestamp: new Date(att.recordedAt || ses?.date || 0).getTime(),
    });
  });

  // 2. Add payment activities
  allPayments.slice(0, 8).forEach((p) => {
    recentActivity.push({
      id: `act_pay_${p.id}`,
      type: 'payment',
      date: p.date,
      title: `سداد مبلغ ${p.amount} ج.م`,
      subtitle: `${p.notes || (p.targetMonth ? `عن شهر ${getArabicMonthName(p.targetMonth)}` : 'دفعة حساب')}`,
      badge: p.paymentMethod === 'vodafone_cash' ? 'فودافون كاش' : p.paymentMethod === 'instapay' ? 'إنستاباي' : p.paymentMethod === 'bank_transfer' ? 'تحويل بنكي' : 'كاش',
      badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      timestamp: new Date(p.createdAt || p.date).getTime(),
    });
  });

  // 3. Add credit log activities
  allCreditLogs.slice(0, 8).forEach((log) => {
    recentActivity.push({
      id: `act_crd_${log.id}`,
      type: 'credit',
      date: log.date,
      title: log.reason || 'تعديل رصيد الحصص',
      subtitle: `الرصيد بعد العملية: ${log.balanceAfter} حصص`,
      badge: `${log.sessionsDelta > 0 ? '+' : ''}${log.sessionsDelta} حصة`,
      badgeColor: log.sessionsDelta > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200',
      timestamp: new Date(log.date).getTime(),
    });
  });

  recentActivity.sort((a, b) => b.timestamp - a.timestamp);
  const latestActivities = recentActivity.slice(0, 6);

  const privateEnrollments = grandFinancials.enrollmentsSummary.filter((e) => e.groupType === 'private');
  const groupEnrollments = grandFinancials.enrollmentsSummary.filter((e) => e.groupType !== 'private');
  const hasPrivate = privateEnrollments.length > 0 || serviceType === 'private_only' || serviceType === 'both';

  const filteredEnrollments = grandFinancials.enrollmentsSummary.filter((e) => {
    if (serviceFilter === 'all') return true;
    if (serviceFilter === 'private') return e.groupType === 'private';
    if (serviceFilter === 'group') return e.groupType !== 'private';
    return true;
  });

  const handleCreatePrivateService = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isHourly = newPrivateBillingMode === 'hourly';
      const isPkg = newPrivateBillingMode === 'package';
      db.createPrivateLessonService(student.id, {
        subject: newPrivateSubject.trim() || 'درس خاص',
        sessionPrice: isPkg ? newPrivatePackagePrice : isHourly ? newPrivateHourlyRate : newPrivatePrice,
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

  const handleUpdateAttendanceStatus = (sessionId: string, status: AttendanceStatus, isCharged: boolean, reason?: string) => {
    const existingAtt = attendanceList.find((a) => a.sessionId === sessionId);
    const session = allSessions.find((s) => s.id === sessionId);
    const enr = grandFinancials.enrollmentsSummary.find((e) => e.groupId === session?.groupId || e.enrollmentId === session?.enrollmentId);
    
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
    const enr = grandFinancials.enrollmentsSummary.find((e) => e.groupId === session?.groupId || e.enrollmentId === session?.enrollmentId);
    if (!student) return;

    const currentUnpaid = existingAtt?.paymentStatus === 'unpaid' || existingAtt?.paymentOverride === 'unpaid' || existingAtt?.isPaid === false;
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
        <div className="bg-[#F7F8FC] border border-slate-200 rounded-t-3xl sm:rounded-3xl max-w-lg w-full mx-auto max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header with Avatar & Basic Info */}
        <div className="p-4 bg-white border-b border-slate-200 relative">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5 pl-10">
            <StudentAvatar
              student={student}
              size="lg"
              showFrame={true}
              className="shrink-0"
            />

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">{student.name}</h2>
                
                {/* Archived Badge */}
                {isArchived && (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-xs">
                    <Archive className="w-3 h-3 text-amber-700" />
                    <span>طالب مؤرشف</span>
                  </span>
                )}

                {/* Service Tag Badge */}
                {serviceType === 'both' && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#7657F6]/10 text-[#7657F6] border border-[#7657F6]/20">
                    مجموعة + درس خاص
                  </span>
                )}
                {serviceType === 'private_only' && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]">
                    درس خاص
                  </span>
                )}
                {serviceType === 'group_only' && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#E8E7FF] text-[#403B9C] border border-[#403B9C]/20">
                    مجموعة فقط
                  </span>
                )}
                {serviceType === 'none' && !isArchived && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#F6F7FC] text-[#74778F] border border-[#E8E7FF]">
                    بدون اشتراك
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px] font-bold text-[#191A2E] bg-[#E8E7FF]/60 px-2.5 py-0.5 rounded-full border border-[#D8D5FB]">
                  {getLocalizedStageName(student.gradeLevel) || 'الصف غير محدد'}
                </span>
                {student.school && (
                  <span className="text-[11px] text-[#74778F] font-medium">
                    مدرسة {student.school}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Archived Banner if student is archived */}
          {isArchived && (
            <div className="mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <div className="text-xs font-medium text-amber-900 leading-relaxed text-right w-full sm:w-auto">
                <strong className="font-bold block text-amber-950">هذا الطالب مؤرشف حالياً</strong>
                <span>السجلات والحصص والمدفوعات التاريخية محفوظة بالكامل لأغراض المحاسبة والتقارير.</span>
              </div>
              <button
                type="button"
                onClick={handleRestoreStudent}
                className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>استعادة الطالب</span>
              </button>
            </div>
          )}

          {/* Quick Contacts & Action Bar */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#E8E7FF] flex-wrap">
            {hasPrivate && (
              <button
                type="button"
                onClick={() => setIsRecordPrivateModalOpen(true)}
                className="w-full py-2 px-3.5 rounded-xl bg-gradient-to-r from-[#FF647C] to-[#E04860] hover:from-[#E04860] hover:to-[#C9334A] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-white/90" />
                <span>تسجيل حصة خاصة</span>
              </button>
            )}

            {student.phone ? (
              <a
                href={`tel:${student.phone}`}
                className="flex-1 py-1.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-[#172554]" />
                <span>اتصال بالطالب</span>
              </a>
            ) : null}

            {student.parentPhone ? (
              <a
                href={`https://wa.me/${student.parentPhone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>واتساب {student.parentRelation || 'ولي الأمر'}</span>
              </a>
            ) : null}

            <button
              type="button"
              onClick={() => setIsQuickBehaviorModalOpen(true)}
              className="py-1.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-indigo-600" />
              <span>تقييم سلوك سريع</span>
            </button>

            <button
              onClick={() => onEditStudent(student)}
              className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
              title="تعديل بيانات الطالب"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub Navigation Tabs (Sticky) */}
        <div className="flex border-b border-slate-200 bg-white px-2 overflow-x-auto no-scrollbar shrink-0 shadow-xs z-10 sticky top-0">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`py-2.5 px-3 text-center text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              activeSubTab === 'overview'
                ? 'border-[#172554] text-[#172554] bg-[#172554]/5'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>لوحة الطالب</span>
          </button>

          <button
            onClick={() => setActiveSubTab('behavior')}
            className={`py-2.5 px-3 text-center text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              activeSubTab === 'behavior'
                ? 'border-indigo-600 text-indigo-800 bg-indigo-50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="w-4 h-4 text-indigo-600" />
            <span>السلوك والتفاعل ({studentBehaviorLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('groups')}
            className={`py-2.5 px-3 text-center text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              activeSubTab === 'groups'
                ? 'border-[#172554] text-[#172554] bg-[#172554]/5'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>المجموعات ({groupEnrollments.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('private')}
            className={`py-2.5 px-3 text-center text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              activeSubTab === 'private'
                ? 'border-amber-600 text-amber-800 bg-amber-50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>الدرس الخاص {privateEnrollments.length > 0 ? `(${privateEnrollments.length})` : ''}</span>
          </button>

          <button
            onClick={() => setActiveSubTab('finances')}
            className={`py-2.5 px-3 text-center text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              activeSubTab === 'finances'
                ? 'border-[#172554] text-[#172554] bg-[#172554]/5'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>الحسابات والماليات</span>
          </button>

          <button
            onClick={() => setActiveSubTab('attendance')}
            className={`py-2.5 px-3 text-center text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              activeSubTab === 'attendance'
                ? 'border-[#172554] text-[#172554] bg-[#172554]/5'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarCheck2 className="w-4 h-4" />
            <span>الحضور ({attendanceList.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`py-2.5 px-3 text-center text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              activeSubTab === 'history'
                ? 'border-[#172554] text-[#172554] bg-[#172554]/5'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>سجل المدفوعات</span>
          </button>

          <button
            onClick={() => setActiveSubTab('credit_logs')}
            className={`py-2.5 px-3 text-center text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              activeSubTab === 'credit_logs'
                ? 'border-[#172554] text-[#172554] bg-[#172554]/5'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>حركات الرصيد ({allCreditLogs.length})</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-4 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar flex-1 space-y-4 text-xs text-slate-700">
          
          {/* ========================================== */}
          {/* 0. OVERVIEW / DASHBOARD TAB (لوحة الطالب الشاملة) */}
          {/* ========================================== */}
          {activeSubTab === 'overview' && (
            <div className="space-y-4">

              {/* Quick Actions Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenAddPayment(student)}
                  className="p-2.5 rounded-2xl bg-[#172554] hover:bg-[#0F172A] text-white font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>تسجيل دفعة</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsQuickBehaviorModalOpen(true)}
                  className="p-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>رصد سلوك</span>
                </button>

                {hasPrivate && (
                  <button
                    type="button"
                    onClick={() => setIsRecordPrivateModalOpen(true)}
                    className="p-2.5 rounded-2xl bg-[#C9A227] hover:bg-[#B88237] text-white font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>حصة خاصة</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveSubTab('attendance')}
                  className="p-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <CalendarCheck2 className="w-3.5 h-3.5 text-[#172554]" />
                  <span>سجل الحضور</span>
                </button>
              </div>

              {/* Behavior & Participation Overview Widget */}
              <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-indigo-600" />
                    <span>مؤشرات السلوك والتفاعل</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsQuickBehaviorModalOpen(true)}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>تقييم سريع</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 font-bold block">مجموع النقاط</span>
                    <span className={`text-sm font-black mt-0.5 block ${
                      behaviorStats.totalPoints > 0
                        ? 'text-emerald-700'
                        : behaviorStats.totalPoints < 0
                        ? 'text-rose-600'
                        : 'text-slate-700'
                    }`}>
                      {behaviorStats.totalPoints > 0 ? `+${behaviorStats.totalPoints}` : behaviorStats.totalPoints}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-800">
                    <span className="text-[10px] font-bold block">تفاعل وتميز</span>
                    <span className="text-sm font-black mt-0.5 block">{behaviorStats.positiveCount}</span>
                  </div>

                  <div className="p-2 rounded-xl bg-rose-50 border border-rose-200/70 text-rose-800">
                    <span className="text-[10px] font-bold block">يحتاج تحسين</span>
                    <span className="text-sm font-black mt-0.5 block">{behaviorStats.needsImprovementCount}</span>
                  </div>
                </div>

                {studentBehaviorLogs.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-bold">آخر الملاحظات المرصودة:</span>
                      <button
                        type="button"
                        onClick={() => setActiveSubTab('behavior')}
                        className="text-indigo-600 font-bold hover:underline cursor-pointer"
                      >
                        عرض الكل ({studentBehaviorLogs.length})
                      </button>
                    </div>

                    <div className="space-y-1">
                      {studentBehaviorLogs.slice(0, 3).map((b) => {
                        const isPos = b.category === 'positive';
                        const isNeg = b.category === 'needs_improvement';
                        const timeInfo = formatBehaviorTime(b.timestamp);
                        return (
                          <div
                            key={b.id}
                            className="p-2 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm shrink-0">{b.emoji || '📝'}</span>
                              <div className="min-w-0">
                                <span className="font-bold text-slate-800 text-xs truncate block">{b.tag}</span>
                                {b.note && <span className="text-[10px] text-slate-500 truncate block">{b.note}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-slate-400 font-medium">{timeInfo.relativeTime}</span>
                              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                                isPos ? 'bg-emerald-50 text-emerald-700' : isNeg ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {(b.points ?? 0) > 0 ? `+${b.points}` : b.points}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* B. Today's & Upcoming Classes Section */}
              <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#172554]" />
                    <span>المواعيد والحصص القادمة</span>
                  </h3>
                  {nextClass && (
                    <span className="text-[10px] bg-[#172554]/10 text-[#172554] px-2.5 py-0.5 rounded-full font-bold border border-[#172554]/20">
                      الحصة القادمة: {nextClass.dayRelative}
                    </span>
                  )}
                </div>

                {upcomingClasses.length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-center text-slate-500">
                    <p>لا توجد مواعيد حصص أسبوعية محددة حالياً لهذا الطالب</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {upcomingClasses.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                          idx === 0
                            ? 'bg-[#172554]/5 border-[#172554]/20 shadow-xs'
                            : 'bg-slate-50 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.accentColor }}
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-slate-900">{item.groupName}</span>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                item.isPrivate ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {item.isPrivate ? 'Private' : item.subject}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>{item.dayName} ({item.dayRelative})</span>
                              {item.location && <span>• {item.location}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          <span className="font-bold text-xs text-slate-900 bg-white px-2 py-1 rounded-lg border border-slate-200 inline-block">
                            {item.time}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* C. Attendance Summary Card */}
              <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <CalendarCheck2 className="w-4 h-4 text-[#172554]" />
                    <span>ملخص الحضور والغياب</span>
                  </h3>
                  <span className="font-black text-xs text-[#172554] bg-[#172554]/10 px-2.5 py-0.5 rounded-full border border-[#172554]/20">
                    نسبة الالتزام {attendanceRate}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#172554] h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, attendanceRate))}%` }}
                  />
                </div>

                {/* 5-box Stat Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center">
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                    <span className="text-[10px] font-bold block">حاضر</span>
                    <span className="text-sm font-black mt-0.5 block">{presentCount}</span>
                  </div>

                  <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                    <span className="text-[10px] font-bold block">غياب محسوب</span>
                    <span className="text-sm font-black mt-0.5 block">{absentChargedCount}</span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
                    <span className="text-[10px] font-bold block">غياب معذور</span>
                    <span className="text-sm font-black mt-0.5 block">{absentExcusedCount}</span>
                  </div>

                  <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                    <span className="text-[10px] font-bold block">متأخر</span>
                    <span className="text-sm font-black mt-0.5 block">{lateCount}</span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
                    <span className="text-[10px] font-bold block">ملغاة</span>
                    <span className="text-sm font-black mt-0.5 block">{cancelledCount}</span>
                  </div>
                </div>
              </div>

              {/* D. Financial Summary Card */}
              <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-[#172554]" />
                    <span>الموقف المالي الشامل</span>
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    grandFinancials.grandRemaining > 0
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {grandFinancials.grandRemaining > 0
                      ? `مستحق سداد: ${grandFinancials.grandRemaining} ج`
                      : 'خالص ومسدد بالكامل'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 font-bold block">إجمالي المستحق</span>
                    <span className="text-sm font-black text-slate-900 mt-0.5 block">
                      {grandFinancials.grandTotalDue} ج
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 font-bold block">إجمالي المدفوع</span>
                    <span className="text-sm font-black text-emerald-700 mt-0.5 block">
                      {grandFinancials.grandTotalPaid} ج
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 font-bold block">المتبقي</span>
                    <span className={`text-sm font-black mt-0.5 block ${
                      grandFinancials.grandRemaining > 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}>
                      {grandFinancials.grandRemaining} ج
                    </span>
                  </div>
                </div>

                {/* Payment methods used */}
                {Object.keys(paymentMethodsSummary).length > 0 && (
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap text-[10px] text-slate-500">
                    <span className="font-bold text-slate-900">طرق السداد:</span>
                    {Object.entries(paymentMethodsSummary).map(([method, amount]) => (
                      <span key={method} className="bg-slate-100 px-2 py-0.5 rounded-md font-bold text-slate-700">
                        {method === 'vodafone_cash' ? 'فودافون كاش' : method === 'instapay' ? 'إنستاباي' : method === 'bank_transfer' ? 'تحويل بنكي' : 'كاش'}: {amount} ج
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* E. Session / Package Status Breakdown */}
              <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-2.5">
                <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#C9A227]" />
                  <span>حالة الاشتراكات والباقات</span>
                </h3>

                {grandFinancials.enrollmentsSummary.length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-center text-slate-500">
                    <p>الطالب غير مسجل في أي اشتراكات حالياً</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {grandFinancials.enrollmentsSummary.map((enr) => {
                      const isPkg = enr.billingMode === 'package' || enr.billingType === 'package';
                      const isPrepaid = enr.billingMode === 'prepaid' || enr.billingType === 'prepaid';
                      const isMonthly = enr.billingMode === 'monthly' || enr.billingType === 'monthly';
                      const isPostpaid = enr.billingMode === 'postpaid' || enr.billingType === 'postpaid';
                      const isHourly = enr.billingMode === 'hourly' || enr.billingType === 'hourly';

                      return (
                        <div
                          key={enr.enrollmentId}
                          className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: enr.accentColor }}
                              />
                              <span className="font-bold text-xs text-slate-900">{enr.groupName}</span>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                enr.groupType === 'private' ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-700'
                              }`}>
                                {getBillingModeLabel(enr.billingType, enr.billingMode)}
                              </span>
                            </div>

                            <span className="text-xs font-bold text-emerald-700">
                              {enr.customPrice} ج.م
                            </span>
                          </div>

                          {/* Detail row based on billing mode */}
                          {(isPkg || isPrepaid) && (
                            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] bg-white p-2 rounded-lg border border-slate-200">
                              <div>
                                <span className="text-slate-500 block">رصيد الحصص</span>
                                <strong className={`text-xs block ${enr.sessionCredit <= 2 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                  {enr.sessionCredit} حصص
                                </strong>
                              </div>
                              <div>
                                <span className="text-slate-500 block">المستهلك</span>
                                <strong className="text-xs text-slate-900 block">{enr.usedSessionsCount || 0}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500 block">سعر الحصة</span>
                                <strong className="text-xs text-slate-700 block">
                                  {isPkg && enr.packageSessionsCount
                                    ? `${divideMoney(enr.packagePrice || enr.customPrice, enr.packageSessionsCount)} ج`
                                    : `${enr.customPrice} ج`}
                                </strong>
                              </div>
                            </div>
                          )}

                          {isMonthly && (
                            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] bg-white p-2 rounded-lg border border-slate-200">
                              <div>
                                <span className="text-slate-500 block">مستحق الشهر</span>
                                <strong className="text-xs text-slate-900 block">{enr.totalDue || enr.customPrice} ج</strong>
                              </div>
                              <div>
                                <span className="text-slate-500 block">المسدد</span>
                                <strong className="text-xs text-emerald-700 block">{enr.totalPaid || 0} ج</strong>
                              </div>
                              <div>
                                <span className="text-slate-500 block">المتبقي</span>
                                <strong className={`text-xs block ${(enr.remaining || 0) > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                  {enr.remaining || 0} ج
                                </strong>
                              </div>
                            </div>
                          )}

                          {(isPostpaid || isHourly) && (
                            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] bg-white p-2 rounded-lg border border-slate-200">
                              <div>
                                <span className="text-slate-500 block">حصص مستحقة</span>
                                <strong className="text-xs text-rose-600 block">{enr.unpaidSessionsCount || 0}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500 block">المستحق</span>
                                <strong className="text-xs text-rose-600 block">{enr.remaining || 0} ج</strong>
                              </div>
                              <div>
                                <span className="text-slate-500 block">المسدد</span>
                                <strong className="text-xs text-emerald-700 block">{enr.totalPaid || 0} ج</strong>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* G. Teacher Notes Section */}
              <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#172554]" />
                    <span>ملاحظات المعلم الخاصة بالطالب</span>
                  </h3>
                  {isNotesSaved && (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 animate-in fade-in">
                      <Check className="w-3 h-3" />
                      <span>تم الحفظ</span>
                    </span>
                  )}
                </div>

                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="سجل ملاحظاتك الأكاديمية أو السلوكية أو المالية عن الطالب هنا... (تُحفظ تلقائياً وتتزامن مع السحابة)"
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#172554] resize-none h-20"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    className="px-3.5 py-1.5 rounded-xl bg-[#172554] hover:bg-[#0F172A] text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-amber-400" />
                    <span>حفظ الملاحظات</span>
                  </button>
                </div>
              </div>

              {/* F. Recent Activity Stream */}
              <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-[#172554]" />
                    <span>آخر الأنشطة والعمليات</span>
                  </h3>
                </div>

                {latestActivities.length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-center text-slate-500">
                    <p>لا توجد أنشطة مسجلة حديثاً</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {latestActivities.map((act) => (
                      <div
                        key={act.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900">{act.title}</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${act.badgeColor}`}>
                              {act.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500">
                            {act.subtitle} {act.date && `• ${act.date}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================== */}
          {/* 1. FINANCES TAB (الحسابات والاشتراكات المستقلة) */}
          {/* ========================================== */}
          {activeSubTab === 'finances' && (
            <div className="space-y-4">
              
              {/* Grand Total Summary Card */}
              <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-[#172554]" />
                    <span>الموقف المالي الشامل للطالب</span>
                  </span>
                  <button
                    onClick={() => onOpenAddPayment(student)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#172554] text-white font-bold text-xs hover:bg-[#0F172A] transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>تسجيل دفعة</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 font-bold block">المستحق حالياً</span>
                    <span
                      className={`text-base font-black mt-0.5 block ${
                        grandFinancials.grandRemaining > 0 ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {grandFinancials.grandRemaining} ج
                    </span>
                    <span className="text-[9px] text-slate-400 block">Current Due</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 font-bold block">إجمالي المدفوع</span>
                    <span className="text-base font-black text-emerald-700 mt-0.5 block">
                      {grandFinancials.grandTotalPaid} ج
                    </span>
                    <span className="text-[9px] text-slate-400 block">Total Paid</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                    <span className="text-[10px] text-emerald-800 font-bold block">رصيد الحصص</span>
                    <span className="text-base font-black mt-0.5 block">
                      {grandFinancials.totalSessionCredit}
                    </span>
                    <span className="text-[9px] text-emerald-700 block">Session Credit</span>
                  </div>

                  <div
                    className={`p-2.5 rounded-xl border ${
                      grandFinancials.totalUnpaidSessions > 0
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-slate-50 border-slate-200/70 text-slate-600'
                    }`}
                  >
                    <span className="text-[10px] font-bold block text-slate-500">حصص مستحقة</span>
                    <span className="text-base font-black mt-0.5 block">
                      {grandFinancials.totalUnpaidSessions}
                    </span>
                    <span className="text-[9px] text-slate-400 block">Unpaid Sessions</span>
                  </div>
                </div>

                {/* Credits summary pills */}
                <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                    <Sparkles className="w-4 h-4 text-[#C9A227]" />
                    <span>
                      إجمالي رصيد الحصص المتبقي: <strong className="text-emerald-700">{grandFinancials.totalSessionCredit} حصص</strong>
                    </span>
                  </div>
                  {grandFinancials.totalUnpaidSessions > 0 && (
                    <div className="text-rose-700 font-bold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>
                        إجمالي الحصص المستحقة غير المدفوعة: <strong>{grandFinancials.totalUnpaidSessions} حصص</strong>
                      </span>
                    </div>
                  )}
                  {grandFinancials.totalFinancialCredit > 0 && (
                    <div className="text-emerald-800 font-bold">
                      <span>
                        الرصيد المالي (Credit): <strong>{grandFinancials.totalFinancialCredit} ج.م</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Service Tabs if student is in multiple accounts */}
              {(privateEnrollments.length > 0 && groupEnrollments.length > 0) && (
                <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setServiceFilter('all')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                      serviceFilter === 'all'
                        ? 'bg-[#172554] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    كل الحسابات ({grandFinancials.enrollmentsSummary.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceFilter('group')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                      serviceFilter === 'group'
                        ? 'bg-[#172554] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    المجموعات ({groupEnrollments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceFilter('private')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                      serviceFilter === 'private'
                        ? 'bg-[#C9A227] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    دروس خاصة / Private ({privateEnrollments.length})
                  </button>
                </div>
              )}

              {/* Individual Enrollments Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#172554]" />
                    <span>الحسابات المالية المستقلة للاشتراكات:</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsAddingPrivateService((prev) => !prev)}
                    className="px-3 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>إضافة خدمة Private</span>
                  </button>
                </div>

                {/* Inline Add Private Service Form */}
                {isAddingPrivateService && (
                  <form
                    onSubmit={handleCreatePrivateService}
                    className="p-4 bg-white rounded-2xl border-2 border-amber-400 shadow-md space-y-3 animate-in fade-in duration-150"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>إضافة خدمة درس خاص (Private) جديدة</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAddingPrivateService(false)}
                        className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[11px] font-bold text-slate-800 block mb-1">اسم المادة / عنوان الخدمة:</label>
                        <input
                          type="text"
                          required
                          value={newPrivateSubject}
                          onChange={(e) => setNewPrivateSubject(e.target.value)}
                          placeholder="مثال: رياضيات خاصة / فيزياء لغات"
                          className="w-full p-2 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-amber-400 outline-hidden"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {newPrivateBillingMode === 'hourly' ? (
                          <div>
                            <label className="text-[11px] font-bold text-slate-800 block mb-1">سعر الساعة (ج.م):</label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              required
                              value={newPrivateHourlyRate}
                              onChange={(e) => setNewPrivateHourlyRate(Number(e.target.value) || 0)}
                              className="w-full p-2 text-xs rounded-xl border border-slate-200 bg-white font-bold focus:ring-2 focus:ring-amber-400 outline-hidden"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="text-[11px] font-bold text-slate-800 block mb-1">سعر الحصة (ج.م):</label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              required
                              value={newPrivatePrice}
                              onChange={(e) => setNewPrivatePrice(Number(e.target.value) || 0)}
                              className="w-full p-2 text-xs rounded-xl border border-slate-200 bg-white font-bold focus:ring-2 focus:ring-amber-400 outline-hidden"
                            />
                          </div>
                        )}
                        <div>
                          <label className="text-[11px] font-bold text-slate-800 block mb-1">نظام المحاسبة:</label>
                          <select
                            value={newPrivateBillingMode}
                            onChange={(e) => setNewPrivateBillingMode(e.target.value as any)}
                            className="w-full p-2 text-xs rounded-xl border border-slate-200 bg-white font-bold focus:ring-2 focus:ring-amber-400 outline-hidden"
                          >
                            <option value="postpaid">دفع آجل (Postpaid)</option>
                            <option value="prepaid">دفع مسبق (Prepaid)</option>
                            <option value="package">باقة حصص (Package)</option>
                            <option value="hourly">محاسبة بالساعة (Hourly)</option>
                          </select>
                        </div>
                      </div>

                      {newPrivateBillingMode === 'package' && (
                        <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                          <div>
                            <label className="text-[10px] font-bold text-slate-800 block mb-1">عدد حصص الباقة:</label>
                            <input
                              type="number"
                              min="1"
                              value={newPrivatePackageSessions}
                              onChange={(e) => setNewPrivatePackageSessions(Math.max(1, Number(e.target.value) || 1))}
                              className="w-full p-1.5 text-xs rounded-lg border border-slate-200 bg-white font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-800 block mb-1">إجمالي سعر الباقة (ج):</label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={newPrivatePackagePrice}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setNewPrivatePackagePrice(val);
                                if (newPrivatePackageSessions > 0) {
                                  setNewPrivatePrice(divideMoney(val, newPrivatePackageSessions));
                                }
                              }}
                              className="w-full p-1.5 text-xs rounded-lg border border-slate-200 bg-white font-bold"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingPrivateService(false)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-[#C9A227] hover:bg-[#B88237] text-white font-bold text-xs shadow-xs cursor-pointer"
                      >
                        حفظ الخدمة
                      </button>
                    </div>
                  </form>
                )}

                {filteredEnrollments.length === 0 ? (
                  <div className="p-6 bg-white rounded-2xl border border-slate-200 text-center text-slate-500 space-y-2">
                    <p>لا توجد اشتراكات مسجلة لهذا التصنيف.</p>
                    <button
                      onClick={() => onOpenEnrollModal(student)}
                      className="px-3 py-1.5 rounded-xl bg-[#172554] text-white font-bold text-xs cursor-pointer"
                    >
                      إضافة اشتراك الآن
                    </button>
                  </div>
                ) : (
                  filteredEnrollments.map((summary) => {
                    const isPrepaid = summary.billingMode === 'prepaid' || summary.billingType === 'prepaid' || (summary.billingType === 'per_session' && summary.billingMode !== 'postpaid');
                    const isPostpaid = summary.billingMode === 'postpaid' || summary.billingType === 'postpaid';
                    const isHourly = summary.billingMode === 'hourly' || summary.billingType === 'hourly';
                    const isPrivate = summary.groupType === 'private';
                    
                    // Sessions specific to this group/service
                    const serviceSessions = allSessions.filter((s) => s.groupId === summary.groupId);
                    const servicePayments = allPayments.filter((p) => p.enrollmentId === summary.enrollmentId || p.groupId === summary.groupId);

                    return (
                      <div
                        key={summary.enrollmentId}
                        className={`p-4 bg-white rounded-2xl shadow-xs space-y-3.5 border ${
                          isPrivate ? 'border-amber-300 ring-1 ring-amber-400/20' : 'border-slate-200'
                        }`}
                      >
                        {/* Enrollment Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: summary.accentColor }}
                            />
                            <div>
                              <h4 className="font-bold text-sm text-slate-900">{summary.groupName}</h4>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    isPrivate
                                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {isPrivate ? '⭐ خدمة درس خاص (Private)' : 'مجموعة عامة'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (editingEnrollmentId === summary.enrollmentId) {
                                  setEditingEnrollmentId(null);
                                } else {
                                  handleStartEditEnrollment(summary.enrollmentId);
                                }
                              }}
                              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer"
                              title="تعديل نظام المحاسبة والأسعار لهذا الطالب"
                            >
                              <Settings2 className="w-3.5 h-3.5" />
                            </button>

                            {isPrivate && (
                              <button
                                type="button"
                                onClick={() => setIsRecordPrivateModalOpen(true)}
                                className="px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-all shadow-xs cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                <span>تسجيل حصة</span>
                              </button>
                            )}

                            <button
                              onClick={() => onOpenAddPayment(student, summary.enrollmentId)}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer ${
                                isPrivate
                                  ? 'bg-[#C9A227] hover:bg-[#B88237] text-white'
                                  : 'bg-[#172554]/10 hover:bg-[#172554]/20 text-[#172554] border border-[#172554]/20'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>سداد لـ {isPrivate ? 'Private' : 'المجموعة'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Inline Billing Editor */}
                        {editingEnrollmentId === summary.enrollmentId && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-amber-300 space-y-2.5 animate-in fade-in text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 flex items-center gap-1">
                                <Settings2 className="w-3.5 h-3.5 text-amber-600" />
                                <span>تعديل نظام المحاسبة والأسعار:</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setEditingEnrollmentId(null)}
                                className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-800 block mb-1">نظام المحاسبة:</label>
                                <select
                                  value={editBillingMode}
                                  onChange={(e) => setEditBillingMode(e.target.value as BillingMode)}
                                  className="w-full p-1.5 text-xs rounded-lg border border-slate-200 bg-white font-bold"
                                >
                                  <option value="prepaid">دفع مسبق (Prepaid)</option>
                                  <option value="postpaid">دفع آجل (Postpaid)</option>
                                  <option value="monthly">شهري ثابت (Monthly)</option>
                                  <option value="package">باقة حصص (Package)</option>
                                  <option value="hourly">محاسبة بالساعة (Hourly)</option>
                                </select>
                              </div>

                              {editBillingMode === 'hourly' ? (
                                <div>
                                  <label className="text-[10px] font-bold text-slate-800 block mb-1">سعر الساعة (ج.م):</label>
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={editHourlyRate}
                                    onChange={(e) => setEditHourlyRate(Number(e.target.value) || 0)}
                                    className="w-full p-1.5 text-xs rounded-lg border border-slate-200 bg-white font-bold"
                                  />
                                </div>
                              ) : (
                                <div>
                                  <label className="text-[10px] font-bold text-slate-800 block mb-1">
                                    {editBillingMode === 'monthly' ? 'الاشتراك الشهري (ج):' : 'سعر الحصة (ج):'}
                                  </label>
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={editCustomPrice}
                                    onChange={(e) => setEditCustomPrice(Number(e.target.value) || 0)}
                                    className="w-full p-1.5 text-xs rounded-lg border border-slate-200 bg-white font-bold"
                                  />
                                </div>
                              )}
                            </div>

                            {editBillingMode === 'package' && (
                              <div className="grid grid-cols-2 gap-2 p-2 bg-white rounded-lg border border-slate-200">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-800 block mb-1">عدد حصص الباقة:</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={editPackageSessions}
                                    onChange={(e) => setEditPackageSessions(Math.max(1, Number(e.target.value) || 1))}
                                    className="w-full p-1 text-xs rounded border border-slate-200"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-800 block mb-1">سعر الباقة الإجمالي (ج):</label>
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={editPackagePrice}
                                    onChange={(e) => setEditPackagePrice(Number(e.target.value) || 0)}
                                    className="w-full p-1 text-xs rounded border border-slate-200"
                                  />
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingEnrollmentId(null)}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-600 bg-slate-200 cursor-pointer"
                              >
                                إلغاء
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEnrollmentBilling(summary.enrollmentId)}
                                className="px-3 py-1 rounded-lg text-[10px] font-bold text-white bg-[#172554] hover:bg-[#0F172A] cursor-pointer"
                              >
                                حفظ التغييرات
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 1. Session Price & 2. Billing Mode Header */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <div>
                            <span className="text-slate-500 block text-[10px]">
                              {isHourly ? '١. سعر الساعة:' : (summary.billingMode === 'package' || summary.billingType === 'package') ? '١. سعر الحصة الفعلي:' : '١. سعر الحصة:'}
                            </span>
                            <strong className="text-sm text-slate-900">
                              {summary.effectiveSessionPrice || summary.customPrice} ج.م {isHourly ? '/ ساعة' : ''}
                            </strong>
                            {(summary.billingMode === 'package' || summary.billingType === 'package') && summary.packagePrice && (
                              <span className="text-[9px] text-slate-500 block mt-0.5">
                                (باقة {summary.packageSessionsCount || 10} حصص - إجمالي {summary.packagePrice} ج)
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">٢. نظام المحاسبة:</span>
                            <strong className="text-xs text-slate-900">{getBillingModeLabel(summary.billingType, summary.billingMode)}</strong>
                          </div>
                        </div>

                        {/* 3 to 7: Numbers Breakdown (عدد الساعات/الحصص، المستخدمة، المستحقة، المدفوع، المتبقي) */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-center text-[10px]">
                          {/* 3. Purchased / Total Hours / Settled Sessions */}
                          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-slate-500 font-bold block text-[9px]">
                              {isHourly ? '٣. إجمالي الساعات' : isPostpaid ? '٣. الحصص المسددة' : '٣. الحصص المشتراة'}
                            </span>
                            <p className="font-black text-xs text-slate-900 mt-0.5">
                              {isHourly ? `${summary.totalHours ?? 0} ساعة` : (summary.purchasedSessionsCount || 0)}
                            </p>
                            <span className="text-[8px] text-slate-400">
                              {isHourly ? `(${summary.attendedSessionsCount || 0} حصص)` : isPostpaid ? 'تمت تسويتها' : 'إجمالي الباقة/الرصيد'}
                            </span>
                          </div>

                          {/* 4. Used Sessions / Completed Hours */}
                          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-slate-500 font-bold block text-[9px]">
                              {isHourly ? '٤. الساعات المنفذة' : '٤. الحصص المستخدمة'}
                            </span>
                            <p className="font-black text-xs text-slate-900 mt-0.5">
                              {isHourly ? `${summary.totalHours ?? 0} ساعة` : (summary.usedSessionsCount || 0)}
                            </p>
                            <span className="text-[8px] text-slate-400">حضور فعلي</span>
                          </div>

                          {/* 5. Unpaid / Due Sessions / Hours */}
                          <div className={`p-2 rounded-xl border ${
                            summary.remaining > 0
                              ? 'bg-rose-50 border-rose-200 text-rose-700'
                              : 'bg-slate-50 border-slate-200 text-emerald-700'
                          }`}>
                            <span className="font-bold block text-[9px] text-slate-500">
                              {isHourly ? '٥. الساعات المستحقة' : '٥. الحصص المستحقة'}
                            </span>
                            <p className="font-black text-xs mt-0.5">
                              {isHourly ? (summary.unpaidHours ? `${summary.unpaidHours} ساعة` : (summary.remaining > 0 ? `${(summary.remaining / (summary.effectiveSessionPrice || summary.customPrice || 1)).toFixed(1)} س` : '0')) : (summary.unpaidSessionsCount || 0)}
                            </p>
                            <span className="text-[8px] text-slate-400">
                              {summary.remaining > 0 ? `${summary.remaining} ج` : 'مسددة بالكامل'}
                            </span>
                          </div>

                          {/* 6. Total Paid */}
                          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-slate-500 font-bold block text-[9px]">٦. المدفوع</span>
                            <p className="font-black text-xs text-emerald-700 mt-0.5">{summary.totalPaid} ج</p>
                            <span className="text-[8px] text-slate-400">سداد فعلي</span>
                          </div>

                          {/* 7. Remaining / Current Due */}
                          <div className={`p-2 rounded-xl border ${
                            summary.remaining > 0
                              ? 'bg-rose-50 border-rose-200 text-rose-700'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          }`}>
                            <span className="font-bold block text-[9px] text-slate-500">٧. المتبقي / المستحق</span>
                            <p className="font-black text-xs mt-0.5">{summary.remaining} ج</p>
                            <span className="text-[8px] text-slate-400">Current Due</span>
                          </div>
                        </div>

                        {/* Additional Session Credit & Financial Credit Badges with Combined Count & Value */}
                        {isHourly ? (
                          <div className="flex items-center justify-between text-[11px] bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 font-bold text-amber-900">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>
                                نظام محاسبة بالساعات (Hourly Billing):{' '}
                                <strong className="text-slate-900">
                                  المحاسبة بالمدة الفعلية ({summary.totalHours ?? 0} ساعة منفذة • إجمالي الرسوم {summary.totalDue} ج.م)
                                </strong>
                              </span>
                            </div>
                            {summary.remaining > 0 ? (
                              <span className="font-bold text-rose-600">
                                المستحق المتبقي: <strong>{summary.remaining} ج.م ({summary.unpaidHours ?? 0} ساعة)</strong>
                              </span>
                            ) : (
                              <span className="font-bold text-emerald-700">
                                ✓ تم سداد جميع الساعات المنفذة بالكامل
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 font-bold text-slate-700">
                              <Sparkles className="w-3.5 h-3.5 text-[#C9A227]" />
                              <span>
                                {summary.sessionCredit > 0 ? (
                                  <>
                                    رصيد الحصص المتبقي (Session Credit):{' '}
                                    <strong className="text-slate-900">
                                      {summary.sessionCredit} حصص ({summary.sessionCreditValue || summary.sessionCredit * (summary.effectiveSessionPrice || summary.customPrice)} ج.م)
                                    </strong>
                                  </>
                                ) : isPostpaid ? (
                                  <>نظام آجل (Postpaid): <strong>المحاسبة بعد حضور الحصص</strong></>
                                ) : (
                                  <>
                                    رصيد الحصص المتبقي (Session Credit):{' '}
                                    <strong className="text-slate-900">0 حصص (0 ج.م)</strong>
                                  </>
                                )}
                              </span>
                            </div>

                            {summary.financialCredit > 0 && (
                              <span className="font-bold text-emerald-700">
                                رصيد مالي متبقي: <strong>{summary.financialCredit} ج.م</strong>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Unpaid Sessions Alert if exists */}
                        {!isHourly && summary.unpaidSessionsCount > 0 && (
                          <div className="p-2.5 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 text-[11px] font-medium flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                              <span>
                                يوجد عدد <strong>{summary.unpaidSessionsCount} حصص مستحقة غير مدفوعة</strong>.
                              </span>
                            </div>
                            <span className="font-black text-xs text-rose-700">
                              المستحق: {summary.remaining} ج.م
                            </span>
                          </div>
                        )}

                        {/* 8. Dedicated Sessions Log for this Account */}
                        <div className="space-y-1.5 pt-1 border-t border-slate-100">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-900 flex items-center gap-1">
                              <CalendarCheck2 className="w-3.5 h-3.5 text-[#172554]" />
                              <span>
                                ٨. سجل الحصص لهذا الحساب ({isHourly ? `${summary.totalHours ?? 0} ساعة منفذة • ${serviceSessions.length} حصص` : `${serviceSessions.length} حصة`}):
                              </span>
                            </span>
                          </div>

                          {serviceSessions.length === 0 ? (
                            <p className="text-[10px] text-slate-500 p-2 bg-slate-50 rounded-xl border border-slate-200">
                              لم يتم تسجيل حصص لهذا الاشتراك حتى الآن.
                            </p>
                          ) : (
                            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                              {serviceSessions.map((s) => {
                                const att = attendanceList.find((a) => a.sessionId === s.id);
                                const isCancelled = s.status === 'cancelled';
                                const isPresent = !isCancelled && att?.status === 'present';
                                const isAbsentCharged = !isCancelled && (att?.status === 'absent_charged' || (att?.status === 'absent' && att.isCharged !== false));
                                const isAbsentFree = !isCancelled && (att?.status === 'absent_free' || att?.status === 'excused' || att?.isCharged === false);
                                const durationHours = att?.hours !== undefined && att?.hours !== null ? Number(att.hours) : (s.hours !== undefined && s.hours !== null ? Number(s.hours) : 1);
                                const currentRate = att?.hourlyRate || s.hourlyRate || summary.customPrice || 100;
                                const sessionCost = isHourly ? Math.round(durationHours * currentRate) : (s.pricePerStudent || summary.customPrice || 100);

                                return (
                                  <div key={s.id} className="p-2.5 bg-white space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <div>
                                        <strong className={`block ${isCancelled ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                                          {s.title}
                                        </strong>
                                        <span className="text-[10px] text-slate-500">
                                          {s.date} • {s.startTime}
                                          {isHourly && (
                                            <span className="text-amber-800 font-bold mr-1">
                                              • {durationHours} {durationHours === 1 ? 'ساعة' : durationHours === 2 ? 'ساعتان' : 'ساعة'}{Math.round((durationHours % 1) * 60) > 0 ? ` (${Math.floor(durationHours)}س و ${Math.round((durationHours % 1) * 60)}د)` : ''} ({sessionCost} ج)
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                      <span
                                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                          isCancelled
                                            ? 'bg-slate-100 text-slate-500'
                                            : isPresent
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : isAbsentCharged
                                            ? 'bg-rose-100 text-rose-800'
                                            : 'bg-slate-100 text-slate-600'
                                        }`}
                                      >
                                        {isCancelled
                                          ? '🚫 ملغاة (غير محسوبة)'
                                          : isPresent
                                          ? '✓ حاضر (مستهلكة)'
                                          : isAbsentCharged
                                          ? '⚠️ غائب (محسوبة)'
                                          : `ℹ️ غائب (معفى${att?.absenceReason ? ` - ${att.absenceReason}` : ''})`}
                                      </span>
                                    </div>

                                    {/* Inline Quick Attendance and Cancel Buttons */}
                                    <div className="flex items-center gap-1 justify-end pt-1 border-t border-slate-100 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateAttendanceStatus(s.id, 'present', true)}
                                        className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
                                          isPresent
                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
                                        }`}
                                      >
                                        حاضر
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateAttendanceStatus(s.id, 'absent_charged', true)}
                                        className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
                                          isAbsentCharged
                                            ? 'bg-rose-600 text-white border-rose-600'
                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50'
                                        }`}
                                      >
                                        غائب محسوب
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateAttendanceStatus(s.id, 'absent_free', false, 'معتذر')}
                                        className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
                                          isAbsentFree
                                            ? 'bg-slate-700 text-white border-slate-700'
                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                        }`}
                                      >
                                        غائب معفى
                                      </button>
                                      {!isCancelled && (isPresent || isAbsentCharged) && (
                                        <button
                                          type="button"
                                          onClick={() => handleToggleSessionPaymentOverride(s.id)}
                                          title="تعديل حالة السداد اليدوي للحصة"
                                          className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
                                            (att?.paymentStatus === 'unpaid' || att?.paymentOverride === 'unpaid' || att?.isPaid === false)
                                              ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                                              : 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                          }`}
                                        >
                                          {(att?.paymentStatus === 'unpaid' || att?.paymentOverride === 'unpaid' || att?.isPaid === false)
                                            ? '💳 مستحقة (غير مسددة)'
                                            : '✓ مسددة'}
                                        </button>
                                      )}
                                      {!isCancelled && (
                                        <button
                                          type="button"
                                          onClick={() => handleCancelSession(s)}
                                          className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 cursor-pointer"
                                        >
                                          إلغاء
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSession(s.id)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                        title="حذف الحصة"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* 9. Dedicated Payments Log for this Account */}
                        <div className="space-y-1.5 pt-1 border-t border-slate-100">
                          <span className="text-[11px] font-bold text-slate-900 flex items-center gap-1">
                            <Receipt className="w-3.5 h-3.5 text-[#172554]" />
                            <span>٩. سجل المدفوعات لهذا الحساب ({servicePayments.length} دفعة):</span>
                          </span>

                          {servicePayments.length === 0 ? (
                            <p className="text-[10px] text-slate-500 p-2 bg-slate-50 rounded-xl border border-slate-200">
                              لا توجد مدفوعات مسجلة لهذا الحساب تحديداً.
                            </p>
                          ) : (
                            <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                              {servicePayments.map((p) => (
                                <div key={p.id} className="p-2 bg-white flex items-center justify-between text-[10px]">
                                  <div>
                                    <strong className="text-emerald-700 font-bold block">{p.amount} ج.م</strong>
                                    <span className="text-slate-400">{p.date} • {p.paymentType || 'سداد'}</span>
                                  </div>
                                  <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-bold">
                                    {p.paymentMethod === 'cash' ? 'نقداً' : p.paymentMethod}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })
                )}
              </div>

            </div>
          )}

          {/* ========================================== */}
          {/* 1.1 CREDIT LOGS TAB (سجل حركات رصيد الحصص الشامل) */}
          {/* ========================================== */}
          {activeSubTab === 'credit_logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#C9A227]" />
                  <span>سجل حركات رصيد الحصص (Credit Logs) ({allCreditLogs.length}):</span>
                </h3>
              </div>

              {allCreditLogs.length === 0 ? (
                <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500 space-y-2">
                  <Sparkles className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="font-bold text-xs text-slate-900">لا توجد حركات رصيد مسجلة حتى الآن</p>
                  <p className="text-[11px] text-slate-500">يتم تسجيل الحركات تلقائياً عند دفع مبالغ مسبقة أو تسجيل حضور/غياب في نظام الدفع المسبق.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allCreditLogs.map((log) => {
                    const group = allGroups.find((g) => g.id === log.groupId);
                    return (
                      <div
                        key={log.id}
                        className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-lg font-bold text-[10px] ${
                                log.type === 'purchase'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : log.type === 'refund'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {log.type === 'purchase'
                                ? 'شراء رصيد حصص'
                                : log.type === 'refund'
                                ? 'استرجاع رصيد'
                                : 'استهلاك رصيد (حصة)'}
                            </span>
                            <span className="font-bold text-xs text-slate-900">
                              {group ? group.name : 'اشتراك عام'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">{log.date}</span>
                        </div>

                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">حركة الرصيد:</span>
                            <strong className={`font-bold ${log.sessionsDelta > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {log.sessionsDelta > 0 ? `+${log.sessionsDelta}` : log.sessionsDelta} حصة
                            </strong>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500">الرصيد:</span>
                            <span className="font-medium text-slate-900">{log.balanceBefore}</span>
                            <span className="text-slate-400">⬅️</span>
                            <strong className="text-emerald-700 font-bold">{log.balanceAfter} حصص</strong>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                          {log.reason}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* 2. PAYMENT HISTORY TAB (سجل المدفوعات) */}
          {/* ========================================== */}
          {activeSubTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-xs">سجل كافة العمليات والمدفوعات ({allPayments.length}):</h3>
                <button
                  onClick={() => onOpenAddPayment(student)}
                  className="px-3 py-1.5 rounded-xl bg-[#172554] text-white font-bold text-xs flex items-center gap-1 shadow-xs hover:bg-[#0F172A] transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>تسجيل دفعة</span>
                </button>
              </div>

              {allPayments.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 space-y-1">
                  <Receipt className="w-8 h-8 mx-auto opacity-30 text-slate-400" />
                  <p>لا توجد مدفوعات مسجلة لهذا الطالب حتى الآن.</p>
                </div>
              ) : (
                allPayments.map((pmt) => {
                  const grp = allGroups.find((g) => g.id === pmt.groupId);

                  return (
                    <div
                      key={pmt.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <DollarSign className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-900">{pmt.amount} ج.م</p>
                            <span className="text-[10px] text-slate-500">
                              {grp?.name || 'مجموعة'} • {pmt.date}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {pmt.paymentType === 'specific_month' && `سداد شهر ${getArabicMonthName(pmt.targetMonth || 1)} ${pmt.targetYear || ''}`}
                          {pmt.paymentType === 'single_session' && 'سداد حصة واحدة'}
                          {pmt.paymentType === 'session_count' && `شراء ${pmt.sessionsPurchased || 0} حصص`}
                          {pmt.paymentType === 'custom_amount' && 'سداد مبلغ مالي'}
                          {!pmt.paymentType && 'سداد عام'}
                        </span>
                      </div>

                      {/* Extra breakdown tags */}
                      <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-600 pt-1.5 border-t border-slate-100">
                        <span>طريقة الدفع: <strong>{pmt.paymentMethod === 'cash' ? 'نقداً' : pmt.paymentMethod}</strong></span>
                        {pmt.financialCreditAdded ? (
                          <span className="text-amber-700 font-bold">
                            • رصيد مالي متبقٍ: +{pmt.financialCreditAdded} ج
                          </span>
                        ) : null}
                        {pmt.autoSessionsConverted ? (
                          <span className="text-emerald-700 font-bold">
                            • تحويل لرصيد حصص: +{pmt.autoSessionsConverted} حصة
                          </span>
                        ) : null}
                        {pmt.notes && (
                          <span className="text-slate-400">• ملاحظات: {pmt.notes}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* 3. GROUPS TAB (المجموعات الدراسية) */}
          {/* ========================================== */}
          {activeSubTab === 'groups' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-xs">المجموعات الدراسية المسجل بها:</h3>
                  <p className="text-[10px] text-slate-500">قائمة المجموعات التعليمية العادية المشترك بها الطالب</p>
                </div>
                <button
                  onClick={() => onOpenEnrollModal(student)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#172554] text-white font-bold text-xs flex items-center gap-1 hover:bg-[#0F172A] transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة قيد بمجموعة</span>
                </button>
              </div>

              {groupEnrollments.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 space-y-2">
                  <Layers className="w-8 h-8 mx-auto opacity-30 text-slate-400" />
                  <p className="font-medium text-xs">الطالب غير مسجل في أي مجموعة دراسية حالياً.</p>
                  <button
                    onClick={() => onOpenEnrollModal(student)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#172554] text-white font-bold text-xs inline-flex items-center gap-1 hover:bg-[#0F172A] transition-all shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>تسجيل الطالب في مجموعة</span>
                  </button>
                </div>
              ) : (
                studentGroups
                  .filter(({ group }) => group.type !== 'private')
                  .map(({ group, enrollment }) => {
                    const enrSummary = grandFinancials.enrollmentsSummary.find((e) => e.enrollmentId === enrollment.id);
                    return (
                      <div
                        key={enrollment.id}
                        className="p-3.5 bg-white rounded-2xl shadow-xs space-y-2.5 border border-slate-200 hover:border-slate-300 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3.5 h-3.5 rounded-full"
                              style={{ backgroundColor: group.accentColor || '#172554' }}
                            />
                            <div>
                              <h4 className="font-bold text-slate-900 text-xs">{group.name}</h4>
                              <p className="text-[10px] text-slate-500 font-medium">
                                {group.subject} • {getLocalizedStageName(group.gradeLevel, 'ar')}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700">
                              مجموعة
                            </span>
                            <button
                              onClick={() => handleRemoveEnrollment(enrollment.id, group.name)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="إلغاء قيد الطالب من المجموعة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div>المواعيد: <strong className="text-slate-900">{group.scheduleDays.join('، ') || 'مرنة'} {group.scheduleTime ? `(${group.scheduleTime})` : ''}</strong></div>
                          <div>المكان: <strong className="text-slate-900">{group.roomOrLocation || 'قاعة الدرس'}</strong></div>
                          <div>نظام المحاسبة: <strong className="text-slate-900">{getBillingModeLabel(enrollment.billingType, enrollment.billingMode)}</strong></div>
                          <div>السعر: <strong className="text-emerald-700">{enrollment.customPrice} ج.م</strong></div>
                        </div>

                        {enrSummary && (
                          <div className="grid grid-cols-3 gap-2 text-center text-[10px] bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <div>
                              <span className="text-slate-400 block">المستحق</span>
                              <strong className="text-slate-900 font-bold">{enrSummary.totalDue} ج</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block">المدفوع</span>
                              <strong className="text-emerald-700 font-bold">{enrSummary.totalPaid} ج</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block">المتبقي</span>
                              <strong className={`font-bold ${enrSummary.remaining > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                                {enrSummary.remaining} ج
                              </strong>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* 3.5 PRIVATE LESSON TAB (الدرس الخاص - Private) */}
          {/* ========================================== */}
          {activeSubTab === 'private' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#C9A227]" />
                    <span>خدمة الدرس الخاص (Private Lesson):</span>
                  </h3>
                  <p className="text-[10px] text-slate-500">حصة فردية خاصة مستقلة تماماً عن المجموعات</p>
                </div>

                {privateEnrollments.length > 0 && (
                  <button
                    onClick={() => setIsRecordPrivateModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#C9A227] hover:bg-[#B88237] text-white font-bold text-xs flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>تسجيل حصة خاصة الآن</span>
                  </button>
                )}
              </div>

              {privateEnrollments.length === 0 ? (
                <div className="p-6 bg-white rounded-2xl border-2 border-dashed border-amber-200 text-center space-y-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                    <Sparkles className="w-5 h-5 text-[#C9A227]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">لا يوجد درس خاص مسجل لهذا الطالب</h4>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-0.5">
                      يمكنك إنشاء خدمة درس خاص مستقلة لهذا الطالب بأسعار ومواعيد خاصة ونظام محاسبة منفصل.
                    </p>
                  </div>

                  {!isAddingPrivateService ? (
                    <button
                      onClick={() => setIsAddingPrivateService(true)}
                      className="px-4 py-2 rounded-xl bg-[#C9A227] hover:bg-[#B88237] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة خدمة درس خاص الآن</span>
                    </button>
                  ) : null}
                </div>
              ) : (
                studentGroups
                  .filter(({ group }) => group.type === 'private')
                  .map(({ group, enrollment }) => {
                    const enrSummary = grandFinancials.enrollmentsSummary.find((e) => e.enrollmentId === enrollment.id);
                    return (
                      <div
                        key={enrollment.id}
                        className="p-4 bg-white rounded-2xl shadow-xs space-y-3 border-2 border-amber-300"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shrink-0" />
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm">
                                خاص — {student.name}
                              </h4>
                              <p className="text-[10px] text-slate-500 font-medium">
                                {group.subject} • {getLocalizedStageName(group.gradeLevel, 'ar')}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] px-2.5 py-0.5 rounded-md font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              درس خاص
                            </span>
                            <button
                              onClick={() => handleRemoveEnrollment(enrollment.id, 'الدرس الخاص')}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="إلغاء خدمة الدرس الخاص"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Details grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-amber-50/40 p-2.5 rounded-xl border border-amber-200">
                          <div>
                            <span className="text-[10px] text-slate-400 block">نظام المحاسبة</span>
                            <strong className="text-slate-900 font-bold">{getBillingModeLabel(enrollment.billingType, enrollment.billingMode)}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">السعر / المعدل</span>
                            <strong className="text-emerald-700 font-bold">
                              {enrollment.billingMode === 'hourly'
                                ? `${enrollment.hourlyRate || 150} ج / ساعة`
                                : enrollment.billingMode === 'package'
                                ? `${enrollment.packagePrice || 1000} ج (${enrollment.packageSessionsCount || 10} حصص)`
                                : `${enrollment.customPrice} ج / حصة`}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">المواعيد</span>
                            <strong className="text-slate-900 font-bold">{group.scheduleDays.join('، ') || 'مرنة'} {group.scheduleTime ? `(${group.scheduleTime})` : ''}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">المكان</span>
                            <strong className="text-slate-900 font-bold">{group.roomOrLocation || 'منزل الطالب'}</strong>
                          </div>
                        </div>

                        {/* Financial summary for private */}
                        {enrSummary && (
                          <div className="grid grid-cols-4 gap-2 text-center text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                            <div>
                              <span className="text-[10px] text-slate-400 block">إجمالي المستحق</span>
                              <strong className="text-slate-900 font-bold">{enrSummary.totalDue} ج</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">إجمالي المدفوع</span>
                              <strong className="text-emerald-700 font-bold">{enrSummary.totalPaid} ج</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">المتبقي</span>
                              <strong className={`font-bold ${enrSummary.remaining > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                                {enrSummary.remaining} ج
                              </strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">
                                {enrollment.billingMode === 'prepaid' || enrollment.billingMode === 'package' ? 'رصيد الحصص' : 'الحصص غير المسددة'}
                              </span>
                              <strong className={`font-bold ${enrSummary.sessionCredit > 0 ? 'text-emerald-700' : enrSummary.unpaidSessionsCount > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                                {enrollment.billingMode === 'prepaid' || enrollment.billingMode === 'package'
                                  ? `${enrSummary.sessionCredit} حصص`
                                  : `${enrSummary.unpaidSessionsCount} حصص`}
                              </strong>
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => setIsRecordPrivateModalOpen(true)}
                            className="flex-1 py-2 px-3 rounded-xl bg-[#C9A227] hover:bg-[#B88237] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                          >
                            <CalendarCheck2 className="w-4 h-4" />
                            <span>تسجيل حصة خاصة الآن</span>
                          </button>
                          <button
                            onClick={() => onOpenAddPayment(student, enrollment.id)}
                            className="py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                          >
                            <DollarSign className="w-4 h-4" />
                            <span>تسجيل سداد</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}

              {/* Inline Form to Add Private Service */}
              {isAddingPrivateService && (
                <form
                  onSubmit={handleCreatePrivateService}
                  className="p-4 bg-white rounded-2xl border-2 border-amber-400 shadow-md space-y-3 animate-in fade-in duration-150"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>إعداد خدمة درس خاص جديدة</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingPrivateService(false)}
                      className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <label className="text-[11px] font-bold text-slate-800 block mb-1">المادة الدراسية:</label>
                      <input
                        type="text"
                        required
                        value={newPrivateSubject}
                        onChange={(e) => setNewPrivateSubject(e.target.value)}
                        placeholder="مثال: رياضيات خاصة / فيزياء لغات"
                        className="w-full p-2 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium focus:ring-2 focus:ring-amber-500 outline-hidden"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-800 block mb-1">مكان الدرس:</label>
                        <input
                          type="text"
                          value={newPrivateLocation}
                          onChange={(e) => setNewPrivateLocation(e.target.value)}
                          placeholder="مثال: منزل الطالب / أونلاين"
                          className="w-full p-2 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium focus:ring-2 focus:ring-amber-500 outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-800 block mb-1">وقت الحصة:</label>
                        <input
                          type="time"
                          value={newPrivateTime}
                          onChange={(e) => setNewPrivateTime(e.target.value)}
                          className="w-full p-2 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium focus:ring-2 focus:ring-amber-500 outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-800 block mb-1">أيام الحصة الخاصة:</label>
                      <div className="flex flex-wrap gap-1.5">
                        {['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map((day) => {
                          const isSelected = newPrivateDays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                setNewPrivateDays((prev) =>
                                  isSelected ? prev.filter((d) => d !== day) : [...prev, day]
                                );
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#C9A227] text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-800 block mb-1">نظام المحاسبة:</label>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center">
                        {[
                          { id: 'postpaid', label: 'سداد لاحق' },
                          { id: 'prepaid', label: 'سداد مسبق' },
                          { id: 'package', label: 'باقة حصص' },
                          { id: 'hourly', label: 'بالساعة' },
                          { id: 'monthly', label: 'شهري' },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setNewPrivateBillingMode(m.id as any)}
                            className={`p-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                              newPrivateBillingMode === m.id
                                ? 'bg-[#C9A227] text-white border-[#C9A227] shadow-2xs'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {newPrivateBillingMode === 'hourly' ? (
                        <div>
                          <label className="text-[11px] font-bold text-slate-800 block mb-1">سعر الساعة (ج.م):</label>
                          <input
                            type="number"
                            min="0"
                            required
                            value={newPrivateHourlyRate}
                            onChange={(e) => setNewPrivateHourlyRate(Number(e.target.value) || 0)}
                            className="w-full p-2 text-xs rounded-xl border border-slate-200 bg-white font-bold focus:ring-2 focus:ring-amber-500 outline-hidden"
                          />
                        </div>
                      ) : newPrivateBillingMode === 'package' ? (
                        <>
                          <div>
                            <label className="text-[11px] font-bold text-slate-800 block mb-1">عدد حصص الباقة:</label>
                            <input
                              type="number"
                              min="1"
                              required
                              value={newPrivatePackageSessions}
                              onChange={(e) => setNewPrivatePackageSessions(Number(e.target.value) || 1)}
                              className="w-full p-2 text-xs rounded-xl border border-slate-200 bg-white font-bold focus:ring-2 focus:ring-amber-500 outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-800 block mb-1">سعر الباقة الإجمالي (ج.م):</label>
                            <input
                              type="number"
                              min="0"
                              required
                              value={newPrivatePackagePrice}
                              onChange={(e) => setNewPrivatePackagePrice(Number(e.target.value) || 0)}
                              className="w-full p-2 text-xs rounded-xl border border-slate-200 bg-white font-bold focus:ring-2 focus:ring-amber-500 outline-hidden"
                            />
                          </div>
                        </>
                      ) : (
                        <div>
                          <label className="text-[11px] font-bold text-slate-800 block mb-1">
                            {newPrivateBillingMode === 'monthly' ? 'الاشتراك الشهري (ج.م):' : 'سعر الحصة (ج.م):'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            required
                            value={newPrivatePrice}
                            onChange={(e) => setNewPrivatePrice(Number(e.target.value) || 0)}
                            className="w-full p-2 text-xs rounded-xl border border-slate-200 bg-white font-bold focus:ring-2 focus:ring-amber-500 outline-hidden"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-[#C9A227] hover:bg-[#B88237] text-white font-bold text-xs shadow-xs transition-all mt-2 cursor-pointer"
                    >
                      حفظ وتفعيل خدمة الدرس الخاص
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* 4. ATTENDANCE TAB (سجل الحضور) */}
          {/* ========================================== */}
          {activeSubTab === 'attendance' && (
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 text-xs">سجل الحضور والغياب ({attendanceList.length}):</h3>

              {attendanceList.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
                  <p>لا توجد سجلات حضور مسجلة لهذا الطالب حتى الآن.</p>
                </div>
              ) : (
                attendanceList.map((att) => {
                  const session = allSessions.find((s) => s.id === att.sessionId);
                  const grp = allGroups.find((g) => g.id === session?.groupId);
                  const isCancelled = session?.status === 'cancelled';
                  const isPresent = !isCancelled && att.status === 'present';
                  const isAbsentCharged = !isCancelled && (att.status === 'absent_charged' || (att.status === 'absent' && att.isCharged !== false));
                  const isAbsentFree = !isCancelled && (att.status === 'absent_free' || att.status === 'excused' || att.isCharged === false);

                  return (
                    <div
                      key={att.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <p className={`font-bold text-xs ${isCancelled ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                              {session?.title || 'حصة بدون عنوان'}
                            </p>
                            {grp?.type === 'private' && (
                              <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-bold">
                                Private
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500">
                            {grp?.name || 'مجموعة'} • {session?.date}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                              isCancelled
                                ? 'bg-slate-100 text-slate-500'
                                : isPresent
                                ? 'bg-emerald-100 text-emerald-800'
                                : isAbsentCharged
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isCancelled
                              ? '🚫 ملغاة (غير محسوبة)'
                              : isPresent
                              ? '✓ حاضر (مستهلكة)'
                              : isAbsentCharged
                              ? '⚠️ غائب (محسوبة عليه)'
                              : `ℹ️ غائب (غير محسوبة${att.absenceReason ? ` - ${att.absenceReason}` : ''})`}
                          </span>
                        </div>
                      </div>

                      {/* Quick Attendance Action Buttons */}
                      <div className="flex items-center gap-1.5 justify-end pt-1.5 border-t border-slate-100 flex-wrap text-[9px]">
                        <button
                          type="button"
                          onClick={() => handleUpdateAttendanceStatus(att.sessionId, 'present', true)}
                          className={`px-2.5 py-1 rounded-md font-bold border transition-all cursor-pointer ${
                            isPresent
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
                          }`}
                        >
                          حاضر
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateAttendanceStatus(att.sessionId, 'absent_charged', true)}
                          className={`px-2.5 py-1 rounded-md font-bold border transition-all cursor-pointer ${
                            isAbsentCharged
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50'
                          }`}
                        >
                          غائب محسوب
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateAttendanceStatus(att.sessionId, 'absent_free', false, 'معتذر')}
                          className={`px-2.5 py-1 rounded-md font-bold border transition-all cursor-pointer ${
                            isAbsentFree
                              ? 'bg-slate-700 text-white border-slate-700'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          غائب معفى
                        </button>
                        {session && !isCancelled && (
                          <button
                            type="button"
                            onClick={() => handleCancelSession(session)}
                            className="px-2.5 py-1 rounded-md font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 cursor-pointer"
                          >
                            إلغاء الحصة
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* BEHAVIOR & PARTICIPATION TAB (سجل السلوك والتفاعل) */}
          {/* ========================================== */}
          {activeSubTab === 'behavior' && (
            <div className="space-y-4">
              
              {/* Header Stats & Action */}
              <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">سجل التفاعل والسلوك</h3>
                      <p className="text-[11px] text-slate-500">متابعة التميز والمشاركات والملاحظات الصفية</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsQuickBehaviorModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>رصد سريع</span>
                  </button>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-center pt-1">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] text-slate-500 font-bold block">مجموع النقاط</span>
                    <span className={`text-base font-black mt-0.5 block ${
                      behaviorStats.totalPoints > 0
                        ? 'text-emerald-700'
                        : behaviorStats.totalPoints < 0
                        ? 'text-rose-600'
                        : 'text-slate-700'
                    }`}>
                      {behaviorStats.totalPoints > 0 ? `+${behaviorStats.totalPoints}` : behaviorStats.totalPoints}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-800">
                    <span className="text-[10px] font-bold block">مشاركات إيجابية</span>
                    <span className="text-base font-black mt-0.5 block">{behaviorStats.positiveCount}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200/70 text-rose-800">
                    <span className="text-[10px] font-bold block">يحتاج تحسين</span>
                    <span className="text-base font-black mt-0.5 block">{behaviorStats.needsImprovementCount}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 hidden sm:block">
                    <span className="text-[10px] text-slate-500 font-bold block">إجمالي التسجيلات</span>
                    <span className="text-base font-black text-slate-900 mt-0.5 block">{behaviorStats.totalLogs}</span>
                  </div>
                </div>
              </div>

              {/* Filter & Search Bar Section */}
              <div className="space-y-2.5">
                {/* 1. Search Input Bar */}
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={behaviorSearchQuery}
                    onChange={(e) => setBehaviorSearchQuery(e.target.value)}
                    placeholder="ابحث في السلوكيات، الملاحظات، الأوسمة، المجموعات..."
                    className="w-full pl-9 pr-9 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                  {behaviorSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setBehaviorSearchQuery('')}
                      className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      title="مسح البحث"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* 2. Category Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => {
                      setBehaviorFilterCategory('all');
                      setBehaviorSelectedTag('all');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      behaviorFilterCategory === 'all'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    الكل ({studentBehaviorLogs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBehaviorFilterCategory('positive');
                      setBehaviorSelectedTag('all');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                      behaviorFilterCategory === 'positive'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    <span>🌟</span>
                    <span>تميز وتفاعل ({behaviorStats.positiveCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBehaviorFilterCategory('needs_improvement');
                      setBehaviorSelectedTag('all');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                      behaviorFilterCategory === 'needs_improvement'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                    }`}
                  >
                    <span>⚠️</span>
                    <span>يحتاج تحسين ({behaviorStats.needsImprovementCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBehaviorFilterCategory('neutral');
                      setBehaviorSelectedTag('all');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                      behaviorFilterCategory === 'neutral'
                        ? 'bg-slate-700 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>📝</span>
                    <span>ملاحظات عامة ({behaviorStats.neutralCount})</span>
                  </button>
                </div>

                {/* 3. Specific Tag Filter Bar (when student has logged tags) */}
                {(() => {
                  const relevantLogs = studentBehaviorLogs.filter((b) => {
                    if (behaviorFilterCategory === 'all') return true;
                    return b.category === behaviorFilterCategory;
                  });

                  const distinctTags = Array.from(new Set(relevantLogs.map((b) => b.tag.trim()))).filter(Boolean);

                  if (distinctTags.length <= 1 && behaviorSelectedTag === 'all') return null;

                  return (
                    <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-600 flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 text-indigo-600" />
                          <span>تصفية حسب الوسم:</span>
                        </span>
                        {behaviorSelectedTag !== 'all' && (
                          <button
                            type="button"
                            onClick={() => setBehaviorSelectedTag('all')}
                            className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                          >
                            عرض جميع الأوسمة
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar flex-wrap">
                        <button
                          type="button"
                          onClick={() => setBehaviorSelectedTag('all')}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            behaviorSelectedTag === 'all'
                              ? 'bg-slate-800 text-white shadow-2xs'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          جميع الأوسمة ({relevantLogs.length})
                        </button>

                        {distinctTags.map((tagName) => {
                          const tagLogs = relevantLogs.filter((b) => b.tag === tagName);
                          const firstLog = tagLogs[0];
                          const isSelected = behaviorSelectedTag === tagName;

                          return (
                            <button
                              key={tagName}
                              type="button"
                              onClick={() => setBehaviorSelectedTag(isSelected ? 'all' : tagName)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white shadow-2xs ring-1 ring-indigo-300'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-indigo-50/50 hover:border-indigo-200'
                              }`}
                            >
                              <span>{firstLog?.emoji || '🏷️'}</span>
                              <span>{tagName}</span>
                              <span className={`text-[9px] px-1 py-0.2 rounded-full font-black ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {tagLogs.length}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* 4. Active Filters Indicator & Reset Bar */}
                {(behaviorSearchQuery.trim() || behaviorSelectedTag !== 'all' || behaviorFilterCategory !== 'all') && (
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-900">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold">الفلاتر النشطة:</span>
                      {behaviorFilterCategory !== 'all' && (
                        <span className="bg-white px-2 py-0.5 rounded-md border border-indigo-200 font-medium">
                          القسم: {behaviorFilterCategory === 'positive' ? 'تميز وتفاعل' : behaviorFilterCategory === 'needs_improvement' ? 'يحتاج تحسين' : 'ملاحظات عامة'}
                        </span>
                      )}
                      {behaviorSelectedTag !== 'all' && (
                        <span className="bg-white px-2 py-0.5 rounded-md border border-indigo-200 font-medium">
                          الوسم: {behaviorSelectedTag}
                        </span>
                      )}
                      {behaviorSearchQuery.trim() && (
                        <span className="bg-white px-2 py-0.5 rounded-md border border-indigo-200 font-medium truncate max-w-[120px]">
                          بحث: "{behaviorSearchQuery.trim()}"
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setBehaviorFilterCategory('all');
                        setBehaviorSelectedTag('all');
                        setBehaviorSearchQuery('');
                      }}
                      className="text-indigo-700 hover:text-indigo-900 font-bold hover:underline shrink-0 cursor-pointer"
                    >
                      إعادة ضبط
                    </button>
                  </div>
                )}
              </div>

              {/* Behavior Logs List */}
              <div className="space-y-2">
                {(() => {
                  const filteredLogs = studentBehaviorLogs.filter((b) => {
                    // 1. Category Filter
                    if (behaviorFilterCategory !== 'all' && b.category !== behaviorFilterCategory) {
                      return false;
                    }
                    // 2. Tag Filter
                    if (behaviorSelectedTag !== 'all' && b.tag !== behaviorSelectedTag) {
                      return false;
                    }
                    // 3. Search Query Filter
                    if (behaviorSearchQuery.trim()) {
                      const q = behaviorSearchQuery.trim().toLowerCase();
                      const tagMatch = b.tag.toLowerCase().includes(q);
                      const tagEnMatch = b.tagEn ? b.tagEn.toLowerCase().includes(q) : false;
                      const noteMatch = b.note ? b.note.toLowerCase().includes(q) : false;
                      const groupMatch = b.groupName ? b.groupName.toLowerCase().includes(q) : false;
                      const dateMatch = b.timestamp.toLowerCase().includes(q);
                      if (!tagMatch && !tagEnMatch && !noteMatch && !groupMatch && !dateMatch) {
                        return false;
                      }
                    }
                    return true;
                  });

                  if (filteredLogs.length === 0) {
                    const hasActiveFilters = behaviorSearchQuery.trim() || behaviorSelectedTag !== 'all' || behaviorFilterCategory !== 'all';
                    return (
                      <div className="p-8 bg-white rounded-2xl border border-slate-200/80 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
                          {hasActiveFilters ? <Search className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-800">
                            {hasActiveFilters ? 'لا توجد نتائج مطابقة للبحث أو الفلاتر' : 'لا توجد تسجيلات سلوكية مرصودة بعد'}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                            {hasActiveFilters
                              ? 'جرب تعديل كلمات البحث أو اختيار وسم آخر، أو إعادة ضبط الفلاتر'
                              : 'يمكنك رصد أي سلوك أو ملاحظة فورية للطالب مع اختيار الوسم وتحديد التوقيت'}
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-1">
                          {hasActiveFilters ? (
                            <button
                              type="button"
                              onClick={() => {
                                setBehaviorFilterCategory('all');
                                setBehaviorSelectedTag('all');
                                setBehaviorSearchQuery('');
                              }}
                              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-xs hover:bg-slate-800 transition-all cursor-pointer"
                            >
                              مسح الفلاتر والبحث
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIsQuickBehaviorModalOpen(true)}
                              className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-xs hover:bg-indigo-700 transition-all cursor-pointer"
                            >
                              رصد سلوك جديد الآن
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return filteredLogs.map((log) => {
                    const badge = getCategoryBadge(log.category);
                    const timeInfo = formatBehaviorTime(log.timestamp);
                    const isPos = log.category === 'positive';
                    const isNeg = log.category === 'needs_improvement';

                    const handleDeleteLog = () => {
                      if (confirm(`هل أنت متأكد من حذف هذا التقييم: "${log.tag}"؟`)) {
                        db.deleteBehaviorLog(log.id);
                        onDataChanged();
                      }
                    };

                    return (
                      <div
                        key={log.id}
                        className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-2 hover:border-slate-300 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <span className="text-xl p-1 bg-slate-50 rounded-xl border border-slate-100 shrink-0">
                              {log.emoji || '📝'}
                            </span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-black text-xs text-slate-900">{log.tag}</h4>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.badgeClass}`}>
                                  {badge.label}
                                </span>
                              </div>
                              {log.tagEn && (
                                <p className="text-[10px] text-slate-400 font-medium">{log.tagEn}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-xs font-black px-2.5 py-1 rounded-xl ${
                                isPos
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : isNeg
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {(log.points ?? 0) > 0 ? `+${log.points}` : log.points} نقطة
                            </span>

                            <button
                              type="button"
                              onClick={handleDeleteLog}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف التقييم"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {log.note && (
                          <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 text-xs leading-relaxed">
                            {log.note}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <span>{timeInfo.formattedDate} - {timeInfo.formattedTime}</span>
                            <span className="text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.2 rounded">
                              {timeInfo.relativeTime}
                            </span>
                          </div>

                          {log.groupName && (
                            <span className="font-bold text-slate-600 flex items-center gap-1">
                              <Layers className="w-3 h-3 text-slate-400" />
                              <span>{log.groupName}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200/80 flex items-center justify-between gap-2">
          {isArchived ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRestoreStudent}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>استعادة الطالب</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSafeDeleteModalOpen(true)}
                className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>خيارات الحذف</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSafeDeleteModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف الطالب</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
          >
            إغلاق
          </button>
        </div>

      </div>

      {/* Safe Delete Student Modal */}
      <SafeDeleteStudentModal
        isOpen={isSafeDeleteModalOpen}
        onClose={() => setIsSafeDeleteModalOpen(false)}
        student={student}
        onConfirmArchive={handleConfirmArchive}
        onConfirmPermanentDelete={handleConfirmPermanentDelete}
      />

      {/* Record Private Session Sub-Modal */}
      <RecordPrivateSessionModal
        isOpen={isRecordPrivateModalOpen}
        onClose={() => setIsRecordPrivateModalOpen(false)}
        student={student}
        onSaveComplete={() => {
          onDataChanged();
        }}
      />

      {/* Quick Behavior Log Sub-Modal */}
      <QuickBehaviorLogModal
        isOpen={isQuickBehaviorModalOpen}
        onClose={() => setIsQuickBehaviorModalOpen(false)}
        student={student}
        availableGroups={allGroups}
        onSuccess={() => {
          onDataChanged();
        }}
      />
    </div>
    </ModalPortal>
  );
};

