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
} from 'lucide-react';
import { Student, Group, Enrollment, Payment, Attendance, Session, AttendanceStatus, BillingMode } from '../types';
import { db, getArabicMonthName, getBillingModeLabel } from '../utils/storage';
import { StudentAvatar } from './StudentAvatar';
import { RecordPrivateSessionModal } from './RecordPrivateSessionModal';
import { getLocalizedStageName } from '../utils/stages';
import { getUpcomingClassesForStudent, UpcomingStudentClass } from '../utils/schedule';

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
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'finances' | 'attendance' | 'history' | 'groups' | 'credit_logs'>('overview');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'group' | 'private'>('all');
  const [isRecordPrivateModalOpen, setIsRecordPrivateModalOpen] = useState<boolean>(false);
  const [isAddingPrivateService, setIsAddingPrivateService] = useState<boolean>(false);
  const [newPrivateSubject, setNewPrivateSubject] = useState<string>('درس خاص');
  const [newPrivatePrice, setNewPrivatePrice] = useState<number>(100);
  const [newPrivateHourlyRate, setNewPrivateHourlyRate] = useState<number>(150);
  const [newPrivateBillingMode, setNewPrivateBillingMode] = useState<BillingMode>('postpaid');
  const [newPrivatePackageSessions, setNewPrivatePackageSessions] = useState<number>(10);
  const [newPrivatePackagePrice, setNewPrivatePackagePrice] = useState<number>(1000);

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
  const grandFinancials = student ? db.calculateStudentGrandFinancials(student.id) : {
    studentId: '',
    studentName: '',
    grandTotalDue: 0,
    grandTotalPaid: 0,
    grandRemaining: 0,
    totalSessionCredit: 0,
    totalUnpaidSessions: 0,
    totalFinancialCredit: 0,
    enrollmentsSummary: [],
    allPayments: [],
  };
  const allPayments = grandFinancials.allPayments;
  const attendanceList = student ? db.getStudentAttendance(student.id) : [];
  const allSessions = db.getSessions();
  const allCreditLogs = student ? db.getCreditLogs().filter((l) => l.studentId === student.id) : [];
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
  const paymentMethodsSummary = allPayments.reduce((acc, p) => {
    const method = p.paymentMethod || 'cash';
    acc[method] = (acc[method] || 0) + (Number(p.amount) || 0);
    return acc;
  }, {} as Record<string, number>);

  // Recent activity stream (Attendance, Payments, Added sessions, Credit logs)
  interface ActivityItem {
    id: string;
    type: 'attendance' | 'payment' | 'credit' | 'session';
    date: string;
    title: string;
    subtitle: string;
    badge: string;
    badgeColor: string;
    timestamp: number;
  }

  const recentActivity: ActivityItem[] = [];

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
      badgeColor: isPres ? 'bg-[#748C70]/15 text-[#60755C]' : isLate ? 'bg-[#D49B4B]/15 text-[#9C6615]' : isCharged ? 'bg-[#C97C5D]/15 text-[#C97C5D]' : 'bg-[#8A9187]/15 text-[#434B3E]',
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
      badgeColor: 'bg-[#748C70]/15 text-[#748C70]',
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
      badgeColor: log.sessionsDelta > 0 ? 'bg-[#748C70]/15 text-[#60755C]' : 'bg-[#D49B4B]/15 text-[#9C6615]',
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
      recordedAt: new Date().toISOString(),
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

  const handleRemoveEnrollment = (enrollmentId: string, groupName: string) => {
    if (confirm(`هل أنت متأكد من إلغاء قيد الطالب من ${groupName}؟`)) {
      db.removeEnrollment(enrollmentId);
      onDataChanged();
    }
  };

  const handleDeleteStudent = () => {
    if (!student) return;
    if (confirm(`هل أنت متأكد من حذف الطالب ${student.name} نهائياً مع كافة تسجيلاته ومدفوعاته؟`)) {
      db.deleteStudent(student.id);
      onDataChanged();
      onClose();
    }
  };

  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#2D332A]/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200" dir="rtl">
      <div className="bg-[#F9F7F2] border border-[#E8E2D6] rounded-t-3xl sm:rounded-[32px] max-w-lg w-full mx-auto max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header with Avatar & Basic Info */}
        <div className="p-4 bg-white border-b border-[#E8E2D6] relative">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 rounded-full bg-[#F2ECE1] text-[#6B7567] hover:text-[#2D332A] hover:bg-[#EAE5D8] transition-colors"
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
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#2D332A] tracking-tight">{student.name}</h2>
                
                {/* Service Tag Badge */}
                {serviceType === 'both' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#748C70]/15 text-[#60755C] border border-[#748C70]/30">
                    مجموعة + Private
                  </span>
                )}
                {serviceType === 'private_only' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D49B4B]/15 text-[#9C6615] border border-[#D49B4B]/30">
                    درس خاص (Private)
                  </span>
                )}
                {serviceType === 'group_only' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#748C70]/15 text-[#60755C] border border-[#748C70]/30">
                    مجموعة فقط
                  </span>
                )}
                {serviceType === 'none' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#8A9187]/15 text-[#8A9187]">
                    بدون اشتراك
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px] font-bold text-[#6B7567] bg-[#F2ECE1] px-2.5 py-0.5 rounded-full border border-[#E8E2D6]">
                  {getLocalizedStageName(student.gradeLevel) || 'الصف غير محدد'}
                </span>
                {student.school && (
                  <span className="text-[11px] text-[#8A9187] font-medium">
                    مدرسة {student.school}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Contacts & Action Bar */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#E8E2D6]/70 flex-wrap">
            {hasPrivate && (
              <button
                type="button"
                onClick={() => setIsRecordPrivateModalOpen(true)}
                className="w-full py-2 px-3.5 rounded-xl bg-linear-to-r from-[#D49B4B] to-[#B88237] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:brightness-105 active:scale-98 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>تسجيل حصة Private</span>
              </button>
            )}

            {student.phone ? (
              <a
                href={`tel:${student.phone}`}
                className="flex-1 py-1.5 px-3 rounded-xl bg-[#F9F7F2] hover:bg-[#EAE5D8] text-[#2D332A] border border-[#E8E2D6] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-[#748C70]" />
                <span>اتصال بالطالب</span>
              </a>
            ) : null}

            {student.parentPhone ? (
              <a
                href={`https://wa.me/${student.parentPhone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-1.5 px-3 rounded-xl bg-[#748C70]/15 hover:bg-[#748C70]/25 text-[#60755C] border border-[#748C70]/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[#748C70]" />
                <span>واتساب {student.parentRelation || 'ولي الأمر'}</span>
              </a>
            ) : null}

            <button
              onClick={() => onEditStudent(student)}
              className="p-1.5 rounded-xl bg-[#F9F7F2] hover:bg-[#EAE5D8] text-[#6B7567] border border-[#E8E2D6] transition-colors"
              title="تعديل بيانات الطالب"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub Navigation Tabs (Sticky) */}
        <div className="flex border-b border-[#E8E2D6] bg-white px-2 overflow-x-auto no-scrollbar shrink-0 shadow-xs z-10 sticky top-0">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`py-2.5 px-3 text-center text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              activeSubTab === 'overview'
                ? 'border-[#748C70] text-[#748C70]'
                : 'border-transparent text-[#8A9187] hover:text-[#434B3E]'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>لوحة الطالب الشاملة</span>
          </button>

          <button
            onClick={() => setActiveSubTab('finances')}
            className={`py-2.5 px-3 text-center text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              activeSubTab === 'finances'
                ? 'border-[#748C70] text-[#748C70]'
                : 'border-transparent text-[#8A9187] hover:text-[#434B3E]'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>الحسابات والاشتراكات</span>
          </button>

          <button
            onClick={() => setActiveSubTab('attendance')}
            className={`py-2.5 px-3 text-center text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              activeSubTab === 'attendance'
                ? 'border-[#748C70] text-[#748C70]'
                : 'border-transparent text-[#8A9187] hover:text-[#434B3E]'
            }`}
          >
            <CalendarCheck2 className="w-4 h-4" />
            <span>الحضور ({attendanceList.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`py-2.5 px-3 text-center text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              activeSubTab === 'history'
                ? 'border-[#748C70] text-[#748C70]'
                : 'border-transparent text-[#8A9187] hover:text-[#434B3E]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>سجل المدفوعات</span>
          </button>

          <button
            onClick={() => setActiveSubTab('groups')}
            className={`py-2.5 px-3 text-center text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              activeSubTab === 'groups'
                ? 'border-[#748C70] text-[#748C70]'
                : 'border-transparent text-[#8A9187] hover:text-[#434B3E]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>الاشتراكات ({studentGroups.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('credit_logs')}
            className={`py-2.5 px-3 text-center text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              activeSubTab === 'credit_logs'
                ? 'border-[#748C70] text-[#748C70]'
                : 'border-transparent text-[#8A9187] hover:text-[#434B3E]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>حركات الرصيد ({allCreditLogs.length})</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-4 overflow-y-auto android-scrollbar flex-1 space-y-4 text-xs text-[#434B3E]">
          
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
                  className="p-2.5 rounded-2xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>تسجيل دفعة</span>
                </button>

                {hasPrivate && (
                  <button
                    type="button"
                    onClick={() => setIsRecordPrivateModalOpen(true)}
                    className="p-2.5 rounded-2xl bg-[#D49B4B] hover:bg-[#B88237] text-white font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>حصة خاصة</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveSubTab('attendance')}
                  className="p-2.5 rounded-2xl bg-white hover:bg-[#F2ECE1] text-[#2D332A] border border-[#E8E2D6] font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
                >
                  <CalendarCheck2 className="w-3.5 h-3.5 text-[#748C70]" />
                  <span>سجل الحضور</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenEnrollModal(student)}
                  className="p-2.5 rounded-2xl bg-white hover:bg-[#F2ECE1] text-[#2D332A] border border-[#E8E2D6] font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-[#748C70]" />
                  <span>اشتراك جديد</span>
                </button>
              </div>

              {/* B. Today's & Upcoming Classes Section */}
              <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-[#2D332A] flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#748C70]" />
                    <span>المواعيد والحصص القادمة</span>
                  </h3>
                  {nextClass && (
                    <span className="text-[10px] bg-[#748C70]/15 text-[#60755C] px-2 py-0.5 rounded-full font-bold">
                      الحصة القادمة: {nextClass.dayRelative}
                    </span>
                  )}
                </div>

                {upcomingClasses.length === 0 ? (
                  <div className="p-3 bg-[#F9F7F2] rounded-xl border border-[#E8E2D6] text-center text-[#8A9187]">
                    <p>لا توجد مواعيد حصص أسبوعية محددة حالياً لهذا الطالب</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {upcomingClasses.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                          idx === 0
                            ? 'bg-[#748C70]/10 border-[#748C70]/30 shadow-xs'
                            : 'bg-[#F9F7F2] border-[#E8E2D6]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.accentColor }}
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-[#2D332A]">{item.groupName}</span>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                item.isPrivate ? 'bg-[#D49B4B]/20 text-[#9C6615]' : 'bg-[#F2ECE1] text-[#6B7567]'
                              }`}>
                                {item.isPrivate ? 'Private' : item.subject}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#8A9187] flex items-center gap-2 mt-0.5">
                              <span>{item.dayName} ({item.dayRelative})</span>
                              {item.location && <span>• {item.location}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          <span className="font-bold text-xs text-[#2D332A] bg-white px-2 py-1 rounded-lg border border-[#E8E2D6] inline-block">
                            {item.time}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* C. Attendance Summary Card */}
              <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-[#2D332A] flex items-center gap-1.5">
                    <CalendarCheck2 className="w-4 h-4 text-[#748C70]" />
                    <span>ملخص الحضور والغياب</span>
                  </h3>
                  <span className="font-black text-xs text-[#748C70] bg-[#748C70]/10 px-2.5 py-0.5 rounded-full border border-[#748C70]/20">
                    نسبة الالتزام {attendanceRate}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#E8E2D6] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#748C70] h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, attendanceRate))}%` }}
                  />
                </div>

                {/* 5-box Stat Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center">
                  <div className="p-2 rounded-xl bg-[#748C70]/10 border border-[#748C70]/20 text-[#60755C]">
                    <span className="text-[10px] font-bold block">حاضر</span>
                    <span className="text-sm font-black mt-0.5 block">{presentCount}</span>
                  </div>

                  <div className="p-2 rounded-xl bg-[#C97C5D]/15 border border-[#C97C5D]/30 text-[#C97C5D]">
                    <span className="text-[10px] font-bold block">غياب محسوب</span>
                    <span className="text-sm font-black mt-0.5 block">{absentChargedCount}</span>
                  </div>

                  <div className="p-2 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6] text-[#8A9187]">
                    <span className="text-[10px] font-bold block">غياب معذور</span>
                    <span className="text-sm font-black mt-0.5 block">{absentExcusedCount}</span>
                  </div>

                  <div className="p-2 rounded-xl bg-[#D49B4B]/15 border border-[#D49B4B]/30 text-[#9C6615]">
                    <span className="text-[10px] font-bold block">متأخر</span>
                    <span className="text-sm font-black mt-0.5 block">{lateCount}</span>
                  </div>

                  <div className="p-2 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6] text-[#8A9187]">
                    <span className="text-[10px] font-bold block">ملغاة</span>
                    <span className="text-sm font-black mt-0.5 block">{cancelledCount}</span>
                  </div>
                </div>
              </div>

              {/* D. Financial Summary Card */}
              <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-[#2D332A] flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-[#748C70]" />
                    <span>الموقف المالي الشامل</span>
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    grandFinancials.grandRemaining > 0
                      ? 'bg-[#C97C5D]/15 text-[#C97C5D] border border-[#C97C5D]/30'
                      : 'bg-[#748C70]/15 text-[#748C70] border border-[#748C70]/30'
                  }`}>
                    {grandFinancials.grandRemaining > 0
                      ? `مستحق سداد: ${grandFinancials.grandRemaining} ج`
                      : 'خالص ومسدد بالكامل'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6]">
                    <span className="text-[10px] text-[#8A9187] font-bold block">إجمالي المستحق</span>
                    <span className="text-sm font-black text-[#2D332A] mt-0.5 block">
                      {grandFinancials.grandTotalDue} ج
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6]">
                    <span className="text-[10px] text-[#8A9187] font-bold block">إجمالي المدفوع</span>
                    <span className="text-sm font-black text-[#748C70] mt-0.5 block">
                      {grandFinancials.grandTotalPaid} ج
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6]">
                    <span className="text-[10px] text-[#8A9187] font-bold block">المتبقي</span>
                    <span className={`text-sm font-black mt-0.5 block ${
                      grandFinancials.grandRemaining > 0 ? 'text-[#C97C5D]' : 'text-[#748C70]'
                    }`}>
                      {grandFinancials.grandRemaining} ج
                    </span>
                  </div>
                </div>

                {/* Payment methods used */}
                {Object.keys(paymentMethodsSummary).length > 0 && (
                  <div className="pt-2 border-t border-[#E8E2D6]/60 flex items-center gap-1.5 flex-wrap text-[10px] text-[#8A9187]">
                    <span className="font-bold text-[#2D332A]">طرق السداد:</span>
                    {Object.entries(paymentMethodsSummary).map(([method, amount]) => (
                      <span key={method} className="bg-[#F2ECE1] px-2 py-0.5 rounded-md font-bold text-[#6B7567]">
                        {method === 'vodafone_cash' ? 'فودافون كاش' : method === 'instapay' ? 'إنستاباي' : method === 'bank_transfer' ? 'تحويل بنكي' : 'كاش'}: {amount} ج
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* E. Session / Package Status Breakdown */}
              <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-2.5">
                <h3 className="font-bold text-xs text-[#2D332A] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#748C70]" />
                  <span>حالة الاشتراكات والباقات</span>
                </h3>

                {grandFinancials.enrollmentsSummary.length === 0 ? (
                  <div className="p-3 bg-[#F9F7F2] rounded-xl border border-[#E8E2D6] text-center text-[#8A9187]">
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
                          className="p-3 bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: enr.accentColor }}
                              />
                              <span className="font-bold text-xs text-[#2D332A]">{enr.groupName}</span>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                enr.groupType === 'private' ? 'bg-[#D49B4B]/20 text-[#9C6615]' : 'bg-[#E8E2D6] text-[#6B7567]'
                              }`}>
                                {getBillingModeLabel(enr.billingType, enr.billingMode)}
                              </span>
                            </div>

                            <span className="text-xs font-bold text-[#748C70]">
                              {enr.customPrice} ج.م
                            </span>
                          </div>

                          {/* Detail row based on billing mode */}
                          {(isPkg || isPrepaid) && (
                            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] bg-white p-2 rounded-lg border border-[#E8E2D6]">
                              <div>
                                <span className="text-[#8A9187] block">رصيد الحصص</span>
                                <strong className={`text-xs block ${enr.sessionCredit <= 2 ? 'text-[#C97C5D]' : 'text-[#748C70]'}`}>
                                  {enr.sessionCredit} حصص
                                </strong>
                              </div>
                              <div>
                                <span className="text-[#8A9187] block">المستهلك</span>
                                <strong className="text-xs text-[#2D332A] block">{enr.usedSessionsCount || 0}</strong>
                              </div>
                              <div>
                                <span className="text-[#8A9187] block">سعر الحصة</span>
                                <strong className="text-xs text-[#6B7567] block">
                                  {isPkg && enr.packageSessionsCount
                                    ? `${Math.round((enr.packagePrice || enr.customPrice) / enr.packageSessionsCount)} ج`
                                    : `${enr.customPrice} ج`}
                                </strong>
                              </div>
                            </div>
                          )}

                          {isMonthly && (
                            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] bg-white p-2 rounded-lg border border-[#E8E2D6]">
                              <div>
                                <span className="text-[#8A9187] block">مستحق الشهر</span>
                                <strong className="text-xs text-[#2D332A] block">{enr.totalDue || enr.customPrice} ج</strong>
                              </div>
                              <div>
                                <span className="text-[#8A9187] block">المسدد</span>
                                <strong className="text-xs text-[#748C70] block">{enr.totalPaid || 0} ج</strong>
                              </div>
                              <div>
                                <span className="text-[#8A9187] block">المتبقي</span>
                                <strong className={`text-xs block ${(enr.remaining || 0) > 0 ? 'text-[#C97C5D]' : 'text-[#748C70]'}`}>
                                  {enr.remaining || 0} ج
                                </strong>
                              </div>
                            </div>
                          )}

                          {(isPostpaid || isHourly) && (
                            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] bg-white p-2 rounded-lg border border-[#E8E2D6]">
                              <div>
                                <span className="text-[#8A9187] block">حصص مستحقة</span>
                                <strong className="text-xs text-[#C97C5D] block">{enr.unpaidSessionsCount || 0}</strong>
                              </div>
                              <div>
                                <span className="text-[#8A9187] block">المستحق</span>
                                <strong className="text-xs text-[#C97C5D] block">{enr.remaining || 0} ج</strong>
                              </div>
                              <div>
                                <span className="text-[#8A9187] block">المسدد</span>
                                <strong className="text-xs text-[#748C70] block">{enr.totalPaid || 0} ج</strong>
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
              <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-[#2D332A] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#748C70]" />
                    <span>ملاحظات المعلم الخاصة بالطالب</span>
                  </h3>
                  {isNotesSaved && (
                    <span className="text-[10px] text-[#748C70] font-bold flex items-center gap-1 animate-in fade-in">
                      <Check className="w-3 h-3" />
                      <span>تم الحفظ</span>
                    </span>
                  )}
                </div>

                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="سجل ملاحظاتك الأكاديمية أو السلوكية أو المالية عن الطالب هنا... (تُحفظ تلقائياً وتتزامن مع السحابة)"
                  className="w-full p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6] text-xs text-[#2D332A] placeholder-[#8A9187] focus:outline-none focus:border-[#748C70] resize-none h-20"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    className="px-3 py-1.5 rounded-xl bg-[#2D332A] hover:bg-[#434B3E] text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <Save className="w-3.5 h-3.5 text-[#748C70]" />
                    <span>حفظ الملاحظات</span>
                  </button>
                </div>
              </div>

              {/* F. Recent Activity Stream */}
              <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-[#2D332A] flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-[#748C70]" />
                    <span>آخر الأنشطة والعمليات</span>
                  </h3>
                </div>

                {latestActivities.length === 0 ? (
                  <div className="p-3 bg-[#F9F7F2] rounded-xl border border-[#E8E2D6] text-center text-[#8A9187]">
                    <p>لا توجد أنشطة مسجلة حديثاً</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {latestActivities.map((act) => (
                      <div
                        key={act.id}
                        className="p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6] flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-[#2D332A]">{act.title}</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${act.badgeColor}`}>
                              {act.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#8A9187]">
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
              <div className="p-4 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#2D332A] flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-[#748C70]" />
                    <span>الموقف المالي الشامل للطالب</span>
                  </span>
                  <button
                    onClick={() => onOpenAddPayment(student)}
                    className="px-3 py-1.5 rounded-xl bg-[#748C70] text-white font-bold text-xs hover:bg-[#60755C] transition-all flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>تسجيل دفعة</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
                  <div className="p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6]">
                    <span className="text-[10px] text-[#8A9187] font-bold block">المستحق حالياً</span>
                    <span
                      className={`text-base font-black mt-0.5 block ${
                        grandFinancials.grandRemaining > 0 ? 'text-[#C97C5D]' : 'text-[#748C70]'
                      }`}
                    >
                      {grandFinancials.grandRemaining} ج
                    </span>
                    <span className="text-[9px] text-[#8A9187] block">Current Due</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6]">
                    <span className="text-[10px] text-[#8A9187] font-bold block">إجمالي المدفوع</span>
                    <span className="text-base font-black text-[#748C70] mt-0.5 block">
                      {grandFinancials.grandTotalPaid} ج
                    </span>
                    <span className="text-[9px] text-[#8A9187] block">Total Paid</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#748C70]/10 border border-[#748C70]/20 text-[#60755C]">
                    <span className="text-[10px] text-[#60755C] font-bold block">رصيد الحصص</span>
                    <span className="text-base font-black mt-0.5 block">
                      {grandFinancials.totalSessionCredit}
                    </span>
                    <span className="text-[9px] text-[#60755C]/80 block">Session Credit</span>
                  </div>

                  <div
                    className={`p-2.5 rounded-xl border ${
                      grandFinancials.totalUnpaidSessions > 0
                        ? 'bg-[#C97C5D]/15 border-[#C97C5D]/30 text-[#C97C5D]'
                        : 'bg-[#F9F7F2] border-[#E8E2D6] text-[#6B7567]'
                    }`}
                  >
                    <span className="text-[10px] font-bold block text-[#8A9187]">حصص مستحقة</span>
                    <span className="text-base font-black mt-0.5 block">
                      {grandFinancials.totalUnpaidSessions}
                    </span>
                    <span className="text-[9px] text-[#8A9187] block">Unpaid Sessions</span>
                  </div>
                </div>

                {/* Credits summary pills */}
                <div className="flex items-center justify-between text-[11px] bg-[#748C70]/10 p-2.5 rounded-xl border border-[#748C70]/20 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-[#60755C] font-bold">
                    <Sparkles className="w-4 h-4 text-[#748C70]" />
                    <span>
                      إجمالي رصيد الحصص المتبقي: <strong>{grandFinancials.totalSessionCredit} حصص</strong>
                    </span>
                  </div>
                  {grandFinancials.totalUnpaidSessions > 0 && (
                    <div className="text-[#C97C5D] font-bold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>
                        إجمالي الحصص المستحقة غير المدفوعة: <strong>{grandFinancials.totalUnpaidSessions} حصص</strong>
                      </span>
                    </div>
                  )}
                  {grandFinancials.totalFinancialCredit > 0 && (
                    <div className="text-[#60755C] font-bold">
                      <span>
                        الرصيد المالي (Credit): <strong>{grandFinancials.totalFinancialCredit} ج.م</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Service Tabs if student is in multiple accounts */}
              {(privateEnrollments.length > 0 && groupEnrollments.length > 0) && (
                <div className="flex items-center gap-1.5 p-1 bg-white border border-[#E8E2D6] rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setServiceFilter('all')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all ${
                      serviceFilter === 'all'
                        ? 'bg-[#748C70] text-white shadow-xs'
                        : 'text-[#6B7567] hover:bg-[#F9F7F2]'
                    }`}
                  >
                    كل الحسابات ({grandFinancials.enrollmentsSummary.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceFilter('group')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all ${
                      serviceFilter === 'group'
                        ? 'bg-[#748C70] text-white shadow-xs'
                        : 'text-[#6B7567] hover:bg-[#F9F7F2]'
                    }`}
                  >
                    المجموعات ({groupEnrollments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceFilter('private')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all ${
                      serviceFilter === 'private'
                        ? 'bg-[#D49B4B] text-white shadow-xs'
                        : 'text-[#6B7567] hover:bg-[#F9F7F2]'
                    }`}
                  >
                    دروس خاصة / Private ({privateEnrollments.length})
                  </button>
                </div>
              )}

              {/* Individual Enrollments Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#2D332A] text-xs flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#748C70]" />
                    <span>الحسابات المالية المستقلة للاشتراكات:</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsAddingPrivateService((prev) => !prev)}
                    className="px-2.5 py-1 rounded-xl bg-[#D49B4B]/15 hover:bg-[#D49B4B]/25 text-[#9C6615] border border-[#D49B4B]/30 font-bold text-[11px] flex items-center gap-1 transition-all"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>إضافة خدمة Private</span>
                  </button>
                </div>

                {/* Inline Add Private Service Form */}
                {isAddingPrivateService && (
                  <form
                    onSubmit={handleCreatePrivateService}
                    className="p-3.5 bg-white rounded-2xl border-2 border-[#D49B4B] shadow-md space-y-3 animate-in fade-in duration-150"
                  >
                    <div className="flex items-center justify-between border-b border-[#E8E2D6] pb-2">
                      <span className="font-bold text-xs text-[#2D332A] flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-[#D49B4B]" />
                        <span>إضافة خدمة درس خاص (Private) جديدة</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAddingPrivateService(false)}
                        className="text-[#8A9187] hover:text-[#2D332A] text-xs font-bold"
                      >
                        إلغاء
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[11px] font-bold text-[#2D332A] block mb-1">اسم المادة / عنوان الخدمة:</label>
                        <input
                          type="text"
                          required
                          value={newPrivateSubject}
                          onChange={(e) => setNewPrivateSubject(e.target.value)}
                          placeholder="مثال: رياضيات خاصة / فيزياء لغات"
                          className="w-full p-2 text-xs rounded-xl border border-[#E8E2D6] bg-white font-medium focus:ring-2 focus:ring-[#D49B4B] outline-hidden"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {newPrivateBillingMode === 'hourly' ? (
                          <div>
                            <label className="text-[11px] font-bold text-[#2D332A] block mb-1">سعر الساعة (ج.م):</label>
                            <input
                              type="number"
                              min="0"
                              required
                              value={newPrivateHourlyRate}
                              onChange={(e) => setNewPrivateHourlyRate(Number(e.target.value) || 0)}
                              className="w-full p-2 text-xs rounded-xl border border-[#E8E2D6] bg-white font-bold focus:ring-2 focus:ring-[#D49B4B] outline-hidden"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="text-[11px] font-bold text-[#2D332A] block mb-1">سعر الحصة (ج.م):</label>
                            <input
                              type="number"
                              min="0"
                              required
                              value={newPrivatePrice}
                              onChange={(e) => setNewPrivatePrice(Number(e.target.value) || 0)}
                              className="w-full p-2 text-xs rounded-xl border border-[#E8E2D6] bg-white font-bold focus:ring-2 focus:ring-[#D49B4B] outline-hidden"
                            />
                          </div>
                        )}
                        <div>
                          <label className="text-[11px] font-bold text-[#2D332A] block mb-1">نظام المحاسبة:</label>
                          <select
                            value={newPrivateBillingMode}
                            onChange={(e) => setNewPrivateBillingMode(e.target.value as any)}
                            className="w-full p-2 text-xs rounded-xl border border-[#E8E2D6] bg-white font-bold focus:ring-2 focus:ring-[#D49B4B] outline-hidden"
                          >
                            <option value="postpaid">دفع آجل (Postpaid)</option>
                            <option value="prepaid">دفع مسبق (Prepaid)</option>
                            <option value="package">باقة حصص (Package)</option>
                            <option value="hourly">محاسبة بالساعة (Hourly)</option>
                          </select>
                        </div>
                      </div>

                      {newPrivateBillingMode === 'package' && (
                        <div className="grid grid-cols-2 gap-2 p-2 bg-[#F9F7F2] rounded-xl border border-[#E8E2D6]">
                          <div>
                            <label className="text-[10px] font-bold text-[#2D332A] block mb-1">عدد حصص الباقة:</label>
                            <input
                              type="number"
                              min="1"
                              value={newPrivatePackageSessions}
                              onChange={(e) => setNewPrivatePackageSessions(Math.max(1, Number(e.target.value) || 1))}
                              className="w-full p-1.5 text-xs rounded-lg border border-[#E8E2D6] bg-white font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-[#2D332A] block mb-1">إجمالي سعر الباقة (ج):</label>
                            <input
                              type="number"
                              min="0"
                              value={newPrivatePackagePrice}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setNewPrivatePackagePrice(val);
                                if (newPrivatePackageSessions > 0) {
                                  setNewPrivatePrice(Math.round(val / newPrivatePackageSessions));
                                }
                              }}
                              className="w-full p-1.5 text-xs rounded-lg border border-[#E8E2D6] bg-white font-bold"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingPrivateService(false)}
                        className="px-3 py-1.5 rounded-xl border border-[#E8E2D6] text-[#6B7567] font-bold text-xs"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-[#D49B4B] hover:bg-[#B88237] text-white font-bold text-xs shadow-xs"
                      >
                        حفظ الخدمة
                      </button>
                    </div>
                  </form>
                )}

                {filteredEnrollments.length === 0 ? (
                  <div className="p-6 bg-white rounded-2xl border border-[#E8E2D6] text-center text-[#8A9187] space-y-2">
                    <p>لا توجد اشتراكات مسجلة لهذا التصنيف.</p>
                    <button
                      onClick={() => onOpenEnrollModal(student)}
                      className="px-3 py-1.5 rounded-xl bg-[#748C70] text-white font-bold text-xs"
                    >
                      إضافة اشتراك الآن
                    </button>
                  </div>
                ) : (
                  filteredEnrollments.map((summary) => {
                    const isPrepaid = summary.billingMode === 'prepaid' || summary.billingType === 'prepaid' || (summary.billingType === 'per_session' && summary.billingMode !== 'postpaid');
                    const isPostpaid = summary.billingMode === 'postpaid' || summary.billingType === 'postpaid';
                    const isPrivate = summary.groupType === 'private';
                    
                    // Sessions specific to this group/service
                    const serviceSessions = allSessions.filter((s) => s.groupId === summary.groupId);
                    const servicePayments = allPayments.filter((p) => p.enrollmentId === summary.enrollmentId || p.groupId === summary.groupId);

                    return (
                      <div
                        key={summary.enrollmentId}
                        className={`p-4 bg-white rounded-2xl shadow-sm space-y-3.5 border ${
                          isPrivate ? 'border-[#D49B4B]/40 ring-1 ring-[#D49B4B]/10' : 'border-[#E8E2D6]'
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
                              <h4 className="font-bold text-sm text-[#2D332A]">{summary.groupName}</h4>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    isPrivate
                                      ? 'bg-[#D49B4B]/15 text-[#9C6615]'
                                      : 'bg-[#F2ECE1] text-[#6B7567]'
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
                              className="p-1.5 rounded-xl text-[#6B7567] hover:text-[#2D332A] hover:bg-[#F2ECE1] transition-colors border border-[#E8E2D6]"
                              title="تعديل نظام المحاسبة والأسعار لهذا الطالب"
                            >
                              <Settings2 className="w-3.5 h-3.5" />
                            </button>

                            {isPrivate && (
                              <button
                                type="button"
                                onClick={() => setIsRecordPrivateModalOpen(true)}
                                className="px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 bg-[#D49B4B]/15 hover:bg-[#D49B4B]/25 text-[#9C6615] border border-[#D49B4B]/30 transition-all shadow-xs"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>تسجيل حصة</span>
                              </button>
                            )}

                            <button
                              onClick={() => onOpenAddPayment(student, summary.enrollmentId)}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shadow-xs transition-all ${
                                isPrivate
                                  ? 'bg-[#D49B4B] hover:bg-[#B88237] text-white'
                                  : 'bg-[#748C70]/15 hover:bg-[#748C70]/25 text-[#60755C] border border-[#748C70]/30'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>سداد لـ {isPrivate ? 'Private' : 'المجموعة'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Inline Billing Editor */}
                        {editingEnrollmentId === summary.enrollmentId && (
                          <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#D49B4B]/40 space-y-2.5 animate-in fade-in text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#2D332A] flex items-center gap-1">
                                <Settings2 className="w-3.5 h-3.5 text-[#D49B4B]" />
                                <span>تعديل نظام المحاسبة والأسعار:</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setEditingEnrollmentId(null)}
                                className="text-[#8A9187] hover:text-[#2D332A] text-xs font-bold"
                              >
                                ✕
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-[#2D332A] block mb-1">نظام المحاسبة:</label>
                                <select
                                  value={editBillingMode}
                                  onChange={(e) => setEditBillingMode(e.target.value as BillingMode)}
                                  className="w-full p-1.5 text-xs rounded-lg border border-[#E8E2D6] bg-white font-bold"
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
                                  <label className="text-[10px] font-bold text-[#2D332A] block mb-1">سعر الساعة (ج.م):</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={editHourlyRate}
                                    onChange={(e) => setEditHourlyRate(Number(e.target.value) || 0)}
                                    className="w-full p-1.5 text-xs rounded-lg border border-[#E8E2D6] bg-white font-bold"
                                  />
                                </div>
                              ) : (
                                <div>
                                  <label className="text-[10px] font-bold text-[#2D332A] block mb-1">
                                    {editBillingMode === 'monthly' ? 'الاشتراك الشهري (ج):' : 'سعر الحصة (ج):'}
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={editCustomPrice}
                                    onChange={(e) => setEditCustomPrice(Number(e.target.value) || 0)}
                                    className="w-full p-1.5 text-xs rounded-lg border border-[#E8E2D6] bg-white font-bold"
                                  />
                                </div>
                              )}
                            </div>

                            {editBillingMode === 'package' && (
                              <div className="grid grid-cols-2 gap-2 p-2 bg-white rounded-lg border border-[#E8E2D6]">
                                <div>
                                  <label className="text-[10px] font-bold text-[#2D332A] block mb-1">عدد حصص الباقة:</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={editPackageSessions}
                                    onChange={(e) => setEditPackageSessions(Math.max(1, Number(e.target.value) || 1))}
                                    className="w-full p-1 text-xs rounded border border-[#E8E2D6]"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-[#2D332A] block mb-1">سعر الباقة الإجمالي (ج):</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={editPackagePrice}
                                    onChange={(e) => setEditPackagePrice(Number(e.target.value) || 0)}
                                    className="w-full p-1 text-xs rounded border border-[#E8E2D6]"
                                  />
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingEnrollmentId(null)}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-[#6B7567] bg-[#F2ECE1]"
                              >
                                إلغاء
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEnrollmentBilling(summary.enrollmentId)}
                                className="px-3 py-1 rounded-lg text-[10px] font-bold text-white bg-[#748C70] hover:bg-[#60755C]"
                              >
                                حفظ التغييرات
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 1. Session Price & 2. Billing Mode Header */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#F9F7F2] p-2.5 rounded-xl border border-[#E8E2D6]">
                          <div>
                            <span className="text-[#8A9187] block text-[10px]">
                              {summary.billingMode === 'package' || summary.billingType === 'package' ? '١. سعر الحصة الفعلي:' : '١. سعر الحصة:'}
                            </span>
                            <strong className="text-sm text-[#2D332A]">
                              {summary.effectiveSessionPrice || summary.customPrice} ج.م
                            </strong>
                            {(summary.billingMode === 'package' || summary.billingType === 'package') && summary.packagePrice && (
                              <span className="text-[9px] text-[#8A9187] block mt-0.5">
                                (باقة {summary.packageSessionsCount || 10} حصص - إجمالي {summary.packagePrice} ج)
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-[#8A9187] block text-[10px]">٢. نظام المحاسبة:</span>
                            <strong className="text-xs text-[#2D332A]">{getBillingModeLabel(summary.billingType, summary.billingMode)}</strong>
                          </div>
                        </div>

                        {/* 3 to 7: Numbers Breakdown (عدد الحصص، المستخدمة، المستحقة، المدفوع، المتبقي) */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-center text-[10px]">
                          {/* 3. Purchased / Settled Sessions */}
                          <div className="p-2 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6]">
                            <span className="text-[#8A9187] font-bold block text-[9px]">
                              {isPostpaid ? '٣. الحصص المسددة' : '٣. الحصص المشتراة'}
                            </span>
                            <p className="font-black text-xs text-[#2D332A] mt-0.5">
                              {summary.purchasedSessionsCount || 0}
                            </p>
                            <span className="text-[8px] text-[#8A9187]">
                              {isPostpaid ? 'تمت تسويتها' : 'إجمالي الباقة/الرصيد'}
                            </span>
                          </div>

                          {/* 4. Used Sessions */}
                          <div className="p-2 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6]">
                            <span className="text-[#8A9187] font-bold block text-[9px]">٤. الحصص المستخدمة</span>
                            <p className="font-black text-xs text-[#2D332A] mt-0.5">{summary.usedSessionsCount || 0}</p>
                            <span className="text-[8px] text-[#8A9187]">حضور فعلي</span>
                          </div>

                          {/* 5. Unpaid Sessions */}
                          <div className={`p-2 rounded-xl border ${
                            summary.unpaidSessionsCount > 0
                              ? 'bg-[#C97C5D]/15 border-[#C97C5D]/30 text-[#C97C5D]'
                              : 'bg-[#F9F7F2] border-[#E8E2D6] text-[#748C70]'
                          }`}>
                            <span className="font-bold block text-[9px] text-[#8A9187]">٥. الحصص المستحقة</span>
                            <p className="font-black text-xs mt-0.5">{summary.unpaidSessionsCount || 0}</p>
                            <span className="text-[8px] text-[#8A9187]">
                              {summary.unpaidSessionsCount > 0 ? `${summary.unpaidSessionsCount * (summary.effectiveSessionPrice || summary.customPrice)} ج` : 'مسددة بالكامل'}
                            </span>
                          </div>

                          {/* 6. Total Paid */}
                          <div className="p-2 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6]">
                            <span className="text-[#8A9187] font-bold block text-[9px]">٦. المدفوع</span>
                            <p className="font-black text-xs text-[#748C70] mt-0.5">{summary.totalPaid} ج</p>
                            <span className="text-[8px] text-[#8A9187]">سداد فعلي</span>
                          </div>

                          {/* 7. Remaining / Current Due */}
                          <div className={`p-2 rounded-xl border ${
                            summary.remaining > 0
                              ? 'bg-[#C97C5D]/15 border-[#C97C5D]/30 text-[#C97C5D]'
                              : 'bg-[#748C70]/10 border-[#748C70]/20 text-[#60755C]'
                          }`}>
                            <span className="font-bold block text-[9px] text-[#8A9187]">٧. المتبقي / المستحق</span>
                            <p className="font-black text-xs mt-0.5">{summary.remaining} ج</p>
                            <span className="text-[8px] text-[#8A9187]">Current Due</span>
                          </div>
                        </div>

                        {/* Additional Session Credit & Financial Credit Badges with Combined Count & Value */}
                        <div className="flex items-center justify-between text-[11px] bg-[#748C70]/10 p-2.5 rounded-xl border border-[#748C70]/20 flex-wrap gap-2">
                          <div className="flex items-center gap-1.5 font-bold text-[#60755C]">
                            <Sparkles className="w-3.5 h-3.5 text-[#748C70]" />
                            <span>
                              {summary.sessionCredit > 0 ? (
                                <>
                                  رصيد الحصص المتبقي (Session Credit):{' '}
                                  <strong className="text-[#2D332A]">
                                    {summary.sessionCredit} حصص ({summary.sessionCreditValue || summary.sessionCredit * (summary.effectiveSessionPrice || summary.customPrice)} ج.م)
                                  </strong>
                                </>
                              ) : isPostpaid ? (
                                <>نظام آجل (Postpaid): <strong>المحاسبة بعد حضور الحصص</strong></>
                              ) : (
                                <>
                                  رصيد الحصص المتبقي (Session Credit):{' '}
                                  <strong className="text-[#2D332A]">0 حصص (0 ج.م)</strong>
                                </>
                              )}
                            </span>
                          </div>

                          {summary.financialCredit > 0 && (
                            <span className="font-bold text-[#60755C]">
                              رصيد مالي متبقي: <strong>{summary.financialCredit} ج.م</strong>
                            </span>
                          )}
                        </div>

                        {/* Unpaid Sessions Alert if exists */}
                        {summary.unpaidSessionsCount > 0 && (
                          <div className="p-2.5 bg-[#C97C5D]/15 text-[#C97C5D] rounded-xl border border-[#C97C5D]/30 text-[11px] font-medium flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              <span>
                                يوجد عدد <strong>{summary.unpaidSessionsCount} حصص مستحقة غير مدفوعة</strong>.
                              </span>
                            </div>
                            <span className="font-black text-xs">
                              المستحق: {summary.remaining} ج.م
                            </span>
                          </div>
                        )}

                        {/* 8. Dedicated Sessions Log for this Account */}
                        <div className="space-y-1.5 pt-1 border-t border-[#E8E2D6]/60">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-[#2D332A] flex items-center gap-1">
                              <CalendarCheck2 className="w-3.5 h-3.5 text-[#748C70]" />
                              <span>٨. سجل الحصص لهذا الحساب ({serviceSessions.length} حصة):</span>
                            </span>
                          </div>

                          {serviceSessions.length === 0 ? (
                            <p className="text-[10px] text-[#8A9187] p-2 bg-[#F9F7F2] rounded-xl border border-[#E8E2D6]">
                              لم يتم تسجيل حصص لهذا الاشتراك حتى الآن.
                            </p>
                          ) : (
                            <div className="max-h-48 overflow-y-auto rounded-xl border border-[#E8E2D6] divide-y divide-[#E8E2D6]">
                              {serviceSessions.map((s) => {
                                const att = attendanceList.find((a) => a.sessionId === s.id);
                                const isCancelled = s.status === 'cancelled';
                                const isPresent = !isCancelled && att?.status === 'present';
                                const isAbsentCharged = !isCancelled && (att?.status === 'absent_charged' || (att?.status === 'absent' && att.isCharged !== false));
                                const isAbsentFree = !isCancelled && (att?.status === 'absent_free' || att?.status === 'excused' || att?.isCharged === false);

                                return (
                                  <div key={s.id} className="p-2.5 bg-white space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <div>
                                        <strong className={`block ${isCancelled ? 'line-through text-[#8A9187]' : 'text-[#2D332A]'}`}>
                                          {s.title}
                                        </strong>
                                        <span className="text-[10px] text-[#8A9187]">{s.date} • {s.startTime}</span>
                                      </div>
                                      <span
                                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                          isCancelled
                                            ? 'bg-[#434B3E]/15 text-[#434B3E]'
                                            : isPresent
                                            ? 'bg-[#748C70]/15 text-[#748C70]'
                                            : isAbsentCharged
                                            ? 'bg-[#C97C5D]/15 text-[#C97C5D]'
                                            : 'bg-[#8A9187]/15 text-[#6B7567]'
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
                                    <div className="flex items-center gap-1 justify-end pt-1 border-t border-[#E8E2D6]/40 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateAttendanceStatus(s.id, 'present', true)}
                                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold border transition-all ${
                                          isPresent
                                            ? 'bg-[#748C70] text-white border-[#748C70]'
                                            : 'bg-[#F9F7F2] text-[#6B7567] border-[#E8E2D6] hover:bg-[#748C70]/15'
                                        }`}
                                      >
                                        حاضر
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateAttendanceStatus(s.id, 'absent_charged', true)}
                                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold border transition-all ${
                                          isAbsentCharged
                                            ? 'bg-[#C97C5D] text-white border-[#C97C5D]'
                                            : 'bg-[#F9F7F2] text-[#6B7567] border-[#E8E2D6] hover:bg-[#C97C5D]/15'
                                        }`}
                                      >
                                        غائب محسوب
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateAttendanceStatus(s.id, 'absent_free', false, 'معتذر')}
                                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold border transition-all ${
                                          isAbsentFree
                                            ? 'bg-[#8A9187] text-white border-[#8A9187]'
                                            : 'bg-[#F9F7F2] text-[#6B7567] border-[#E8E2D6] hover:bg-[#8A9187]/15'
                                        }`}
                                      >
                                        غائب معفى
                                      </button>
                                      {!isCancelled && (
                                        <button
                                          type="button"
                                          onClick={() => handleCancelSession(s)}
                                          className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-[#F9F7F2] text-[#434B3E] border border-[#E8E2D6] hover:bg-[#434B3E]/10"
                                        >
                                          إلغاء
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSession(s.id)}
                                        className="p-1 rounded-md text-[#8A9187] hover:text-[#C97C5D] hover:bg-[#C97C5D]/10"
                                        title="حذف الحصة"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* 9. Dedicated Payments Log for this Account */}
                        <div className="space-y-1.5 pt-1 border-t border-[#E8E2D6]/60">
                          <span className="text-[11px] font-bold text-[#2D332A] flex items-center gap-1">
                            <Receipt className="w-3.5 h-3.5 text-[#748C70]" />
                            <span>٩. سجل المدفوعات لهذا الحساب ({servicePayments.length} دفعة):</span>
                          </span>

                          {servicePayments.length === 0 ? (
                            <p className="text-[10px] text-[#8A9187] p-2 bg-[#F9F7F2] rounded-xl border border-[#E8E2D6]">
                              لا توجد مدفوعات مسجلة لهذا الحساب تحديداً.
                            </p>
                          ) : (
                            <div className="max-h-28 overflow-y-auto rounded-xl border border-[#E8E2D6] divide-y divide-[#E8E2D6]">
                              {servicePayments.map((p) => (
                                <div key={p.id} className="p-2 bg-white flex items-center justify-between text-[10px]">
                                  <div>
                                    <strong className="text-[#748C70] font-bold block">{p.amount} ج.م</strong>
                                    <span className="text-[#8A9187]">{p.date} • {p.paymentType || 'سداد'}</span>
                                  </div>
                                  <span className="text-[#6B7567] bg-[#F2ECE1] px-2 py-0.5 rounded font-bold">
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
                <h3 className="font-bold text-[#2D332A] text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#748C70]" />
                  <span>سجل حركات رصيد الحصص (Credit Logs) ({allCreditLogs.length}):</span>
                </h3>
              </div>

              {allCreditLogs.length === 0 ? (
                <div className="p-8 bg-white rounded-2xl border border-[#E8E2D6] text-center text-[#8A9187] space-y-2">
                  <Sparkles className="w-8 h-8 mx-auto text-[#8A9187]/40" />
                  <p className="font-bold text-xs text-[#2D332A]">لا توجد حركات رصيد مسجلة حتى الآن</p>
                  <p className="text-[11px]">يتم تسجيل الحركات تلقائياً عند دفع مبالغ مسبقة أو تسجيل حضور/غياب في نظام الدفع المسبق.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allCreditLogs.map((log) => {
                    const group = allGroups.find((g) => g.id === log.groupId);
                    return (
                      <div
                        key={log.id}
                        className="p-3 bg-white rounded-2xl border border-[#E8E2D6] shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${
                                log.type === 'purchase'
                                  ? 'bg-[#748C70]/15 text-[#748C70]'
                                  : log.type === 'refund'
                                  ? 'bg-[#DDA15E]/15 text-[#9C6615]'
                                  : 'bg-[#C97C5D]/15 text-[#C97C5D]'
                              }`}
                            >
                              {log.type === 'purchase'
                                ? 'شراء رصيد حصص'
                                : log.type === 'refund'
                                ? 'استرجاع رصيد'
                                : 'استهلاك رصيد (حصة)'}
                            </span>
                            <span className="font-bold text-xs text-[#2D332A]">
                              {group ? group.name : 'اشتراك عام'}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#8A9187] font-medium">{log.date}</span>
                        </div>

                        <div className="flex items-center justify-between bg-[#F9F7F2] p-2 rounded-xl border border-[#E8E2D6] text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[#8A9187]">حركة الرصيد:</span>
                            <strong className={`font-bold ${log.sessionsDelta > 0 ? 'text-[#748C70]' : 'text-[#C97C5D]'}`}>
                              {log.sessionsDelta > 0 ? `+${log.sessionsDelta}` : log.sessionsDelta} حصة
                            </strong>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[#8A9187]">الرصيد:</span>
                            <span className="font-medium text-[#2D332A]">{log.balanceBefore}</span>
                            <span className="text-[#8A9187]">⬅️</span>
                            <strong className="text-[#748C70] font-bold">{log.balanceAfter} حصص</strong>
                          </div>
                        </div>

                        <p className="text-[11px] text-[#6B7567] font-medium leading-relaxed">
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
                <h3 className="font-bold text-[#2D332A] text-xs">سجل كافة العمليات والمدفوعات ({allPayments.length}):</h3>
                <button
                  onClick={() => onOpenAddPayment(student)}
                  className="px-2.5 py-1 rounded-xl bg-[#748C70] text-white font-bold text-xs flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>تسجيل دفعة</span>
                </button>
              </div>

              {allPayments.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-[#E8E2D6] text-[#8A9187] space-y-1">
                  <Receipt className="w-8 h-8 mx-auto opacity-40" />
                  <p>لا توجد مدفوعات مسجلة لهذا الطالب حتى الآن.</p>
                </div>
              ) : (
                allPayments.map((pmt) => {
                  const grp = allGroups.find((g) => g.id === pmt.groupId);

                  return (
                    <div
                      key={pmt.id}
                      className="p-3 bg-white border border-[#E8E2D6] rounded-2xl shadow-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-[#748C70]/15 text-[#748C70]">
                            <DollarSign className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-[#2D332A]">{pmt.amount} ج.م</p>
                            <span className="text-[10px] text-[#8A9187]">
                              {grp?.name || 'مجموعة'} • {pmt.date}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F2ECE1] text-[#6B7567]">
                          {pmt.paymentType === 'specific_month' && `سداد شهر ${getArabicMonthName(pmt.targetMonth || 1)} ${pmt.targetYear || ''}`}
                          {pmt.paymentType === 'single_session' && 'سداد حصة واحدة'}
                          {pmt.paymentType === 'session_count' && `شراء ${pmt.sessionsPurchased || 0} حصص`}
                          {pmt.paymentType === 'custom_amount' && 'سداد مبلغ مالي'}
                          {!pmt.paymentType && 'سداد عام'}
                        </span>
                      </div>

                      {/* Extra breakdown tags */}
                      <div className="flex items-center gap-2 flex-wrap text-[10px] text-[#6B7567] pt-1 border-t border-[#E8E2D6]/60">
                        <span>طريقة الدفع: <strong>{pmt.paymentMethod === 'cash' ? 'نقداً' : pmt.paymentMethod}</strong></span>
                        {pmt.financialCreditAdded ? (
                          <span className="text-[#C97C5D] font-bold">
                            • رصيد مالي متبقٍ: +{pmt.financialCreditAdded} ج
                          </span>
                        ) : null}
                        {pmt.autoSessionsConverted ? (
                          <span className="text-[#748C70] font-bold">
                            • تحويل لرصيد حصص: +{pmt.autoSessionsConverted} حصة
                          </span>
                        ) : null}
                        {pmt.notes && (
                          <span className="text-[#8A9187]">• ملاحظات: {pmt.notes}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* 3. GROUPS & SERVICES TAB (المجموعات والدروس المسجل بها) */}
          {/* ========================================== */}
          {activeSubTab === 'groups' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#2D332A] text-xs">الاشتراكات والخدمات المسجل بها:</h3>
                <button
                  onClick={() => onOpenEnrollModal(student)}
                  className="px-2.5 py-1.5 rounded-xl bg-[#748C70] text-white font-bold text-xs flex items-center gap-1 hover:bg-[#60755C] transition-all shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة اشتراك أو درس خاص</span>
                </button>
              </div>

              {studentGroups.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-[#E8E2D6] text-[#8A9187] space-y-2">
                  <Layers className="w-8 h-8 mx-auto opacity-40" />
                  <p>الطالب غير مسجل في أي مجموعة أو درس خاص حالياً.</p>
                </div>
              ) : (
                studentGroups.map(({ group, enrollment }) => (
                  <div
                    key={enrollment.id}
                    className={`p-3.5 bg-white rounded-2xl shadow-xs space-y-2 border ${
                      group.type === 'private' ? 'border-[#D49B4B]/40' : 'border-[#E8E2D6]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full"
                          style={{ backgroundColor: group.accentColor }}
                        />
                        <h4 className="font-bold text-[#2D332A] text-xs">{group.name}</h4>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            group.type === 'private'
                              ? 'bg-[#D49B4B]/15 text-[#9C6615]'
                              : 'bg-[#F2ECE1] text-[#6B7567]'
                          }`}
                        >
                          {group.type === 'private' ? '⭐ درس خاص (Private)' : 'مجموعة'}
                        </span>
                      </div>

                      <button
                        onClick={() => handleRemoveEnrollment(enrollment.id, group.name)}
                        className="p-1 rounded-lg text-[#8A9187] hover:text-[#C97C5D] hover:bg-[#C97C5D]/10 transition-colors"
                        title="إلغاء قيد الطالب من هذا الاشتراك"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-[#6B7567] bg-[#F9F7F2] p-2 rounded-xl">
                      <div>المادة: <strong className="text-[#2D332A]">{group.subject}</strong></div>
                      <div>المواعيد: <strong className="text-[#2D332A]">{group.scheduleDays.join('، ') || 'مرنة'}</strong></div>
                      <div>نظام المحاسبة: <strong className="text-[#2D332A]">{getBillingModeLabel(enrollment.billingType, enrollment.billingMode)}</strong></div>
                      <div>السعر الفعلي: <strong className="text-[#748C70]">{enrollment.customPrice} ج.م</strong></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* 4. ATTENDANCE TAB (سجل الحضور) */}
          {/* ========================================== */}
          {activeSubTab === 'attendance' && (
            <div className="space-y-3">
              <h3 className="font-bold text-[#2D332A] text-xs">سجل الحضور والغياب ({attendanceList.length}):</h3>

              {attendanceList.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-[#E8E2D6] text-[#8A9187]">
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
                      className="p-3 bg-white border border-[#E8E2D6] rounded-2xl shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <p className={`font-bold text-xs ${isCancelled ? 'line-through text-[#8A9187]' : 'text-[#2D332A]'}`}>
                              {session?.title || 'حصة بدون عنوان'}
                            </p>
                            {grp?.type === 'private' && (
                              <span className="text-[9px] bg-[#D49B4B]/15 text-[#9C6615] px-1.5 py-0.2 rounded font-bold">
                                Private
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#8A9187]">
                            {grp?.name || 'مجموعة'} • {session?.date}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                              isCancelled
                                ? 'bg-[#434B3E]/15 text-[#434B3E]'
                                : isPresent
                                ? 'bg-[#748C70]/15 text-[#748C70]'
                                : isAbsentCharged
                                ? 'bg-[#C97C5D]/15 text-[#C97C5D]'
                                : 'bg-[#8A9187]/15 text-[#434B3E]'
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
                      <div className="flex items-center gap-1 justify-end pt-1.5 border-t border-[#E8E2D6]/40 flex-wrap text-[9px]">
                        <button
                          type="button"
                          onClick={() => handleUpdateAttendanceStatus(att.sessionId, 'present', true)}
                          className={`px-2 py-0.5 rounded-md font-bold border transition-all ${
                            isPresent
                              ? 'bg-[#748C70] text-white border-[#748C70]'
                              : 'bg-[#F9F7F2] text-[#6B7567] border-[#E8E2D6] hover:bg-[#748C70]/15'
                          }`}
                        >
                          حاضر
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateAttendanceStatus(att.sessionId, 'absent_charged', true)}
                          className={`px-2 py-0.5 rounded-md font-bold border transition-all ${
                            isAbsentCharged
                              ? 'bg-[#C97C5D] text-white border-[#C97C5D]'
                              : 'bg-[#F9F7F2] text-[#6B7567] border-[#E8E2D6] hover:bg-[#C97C5D]/15'
                          }`}
                        >
                          غائب محسوب
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateAttendanceStatus(att.sessionId, 'absent_free', false, 'معتذر')}
                          className={`px-2 py-0.5 rounded-md font-bold border transition-all ${
                            isAbsentFree
                              ? 'bg-[#8A9187] text-white border-[#8A9187]'
                              : 'bg-[#F9F7F2] text-[#6B7567] border-[#E8E2D6] hover:bg-[#8A9187]/15'
                          }`}
                        >
                          غائب معفى
                        </button>
                        {session && !isCancelled && (
                          <button
                            type="button"
                            onClick={() => handleCancelSession(session)}
                            className="px-2 py-0.5 rounded-md font-bold bg-[#F9F7F2] text-[#434B3E] border border-[#E8E2D6] hover:bg-[#434B3E]/10"
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

        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-white border-t border-[#E8E2D6] flex items-center justify-between">
          <button
            onClick={handleDeleteStudent}
            className="px-3 py-2 rounded-xl text-[#C97C5D] hover:bg-[#C97C5D]/10 font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>حذف الطالب</span>
          </button>

          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-[#2D332A] text-white font-bold text-xs hover:bg-[#434B3E] transition-colors"
          >
            إغلاق
          </button>
        </div>

      </div>

      {/* Record Private Session Sub-Modal */}
      <RecordPrivateSessionModal
        isOpen={isRecordPrivateModalOpen}
        onClose={() => setIsRecordPrivateModalOpen(false)}
        student={student}
        onSaveComplete={() => {
          onDataChanged();
        }}
      />
    </div>
  );
};
