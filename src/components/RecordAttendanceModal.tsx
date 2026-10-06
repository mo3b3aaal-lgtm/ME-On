import React, { useState, useEffect, useMemo } from 'react';
import { useSwipeGesture } from '../utils/useSwipeGesture';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Users,
  CheckCheck,
  Save,
  BookCheck,
  HelpCircle,
  Sparkles,
  Edit3,
  UserCheck,
  UserX,
  Check,
} from 'lucide-react';
import { Session, Group, Student, Attendance, AttendanceStatus } from '../types';
import { db } from '../utils/storage';
import { StudentAvatar } from './StudentAvatar';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import { useTranslation } from '../utils/i18n';
import { PrivateClassIntakeModal, PrivateClassIntakeResult } from './PrivateClassIntakeModal';

interface RecordAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  onSaveComplete: () => void;
}

interface StudentAttendanceRecord {
  status: AttendanceStatus;
  isCharged: boolean;
  sessionUnits?: number;
  hours?: number;
  pricePerStudent?: number;
  absenceReason: string;
  homeworkDone: boolean;
  notes: string;
}

export const RecordAttendanceModal: React.FC<RecordAttendanceModalProps> = ({
  isOpen,
  onClose,
  session,
  onSaveComplete,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');

  const PREDEFINED_ABSENCE_REASONS = [
    isEn ? 'Student Cancelled' : 'الطالب ألغى',
    isEn ? 'Teacher Cancelled' : 'المدرس ألغى',
    isEn ? 'Illness / Medical' : 'مرض',
    isEn ? 'Emergency' : 'ظرف طارئ',
    isEn ? 'Other Reason' : 'سبب آخر',
  ];

  const sessionId = session?.id;
  const groupId = session?.groupId;
  const sessionStudentId = session?.studentId;

  const group = useMemo(() => (groupId ? db.getGroupById(groupId) : undefined), [groupId]);
  const isPrivateSession = group?.type === 'private' || !!sessionStudentId;

  const privateStudent: Student | undefined = useMemo(() => {
    if (sessionStudentId) {
      return db.getStudentById(sessionStudentId);
    }
    if (group?.type === 'private' && groupId) {
      const enrs = db.getGroupEnrollments(groupId);
      if (enrs[0]) {
        return db.getStudentById(enrs[0].studentId);
      }
    }
    return undefined;
  }, [sessionStudentId, group?.type, groupId]);

  const enrolledStudents = useMemo(() => {
    if (!sessionId || !groupId) return [];
    if (privateStudent) return [privateStudent];
    return db.getGroupStudents(groupId);
  }, [sessionId, groupId, privateStudent]);

  const existingAttendance = useMemo(
    () => (sessionId ? db.getSessionAttendance(sessionId) : []),
    [sessionId]
  );

  const allEnrollments = useMemo(() => {
    if (!sessionId || !groupId) return [];
    if (isPrivateSession && privateStudent) {
      return db.getStudentPrivateEnrollments(privateStudent.id).map((p) => p.enrollment);
    }
    return db.getGroupEnrollments(groupId);
  }, [sessionId, groupId, isPrivateSession, privateStudent]);

  // Local state for attendance records mapping: studentId -> StudentAttendanceRecord
  const [records, setRecords] = useState<Record<string, StudentAttendanceRecord>>({});

  // Confirmation dialog state for individual student absence
  const [confirmingStudent, setConfirmingStudent] = useState<Student | null>(null);
  const [selectedChargeDecision, setSelectedChargeDecision] = useState<'charged' | 'free' | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>(PREDEFINED_ABSENCE_REASONS[0]);
  const [customReasonText, setCustomReasonText] = useState<string>('');

  // Batch confirmation dialog state
  const [isBatchAbsentConfirmOpen, setIsBatchAbsentConfirmOpen] = useState(false);
  const [batchChargeDecision, setBatchChargeDecision] = useState<'charged' | 'free'>('charged');
  const [batchReason, setBatchReason] = useState<string>(PREDEFINED_ABSENCE_REASONS[1]);
  const [batchCustomReason, setBatchCustomReason] = useState<string>('');

  // Subtle success feedback state
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);

  useEffect(() => {
    const map: Record<string, StudentAttendanceRecord> = {};

    for (const st of enrolledStudents) {
      const found = existingAttendance.find((a) => a.studentId === st.id);
      if (found) {
        const isCharged =
          found.isCharged !== undefined
            ? found.isCharged
            : found.status === 'absent_charged' || found.status === 'absent' || found.status === 'present' || found.status === 'late';
        map[st.id] = {
          status: found.status,
          isCharged,
          sessionUnits: found.sessionUnits ?? session?.sessionUnits ?? 1,
          hours: found.hours ?? session?.hours ?? 1.5,
          absenceReason: found.absenceReason || found.notes || '',
          homeworkDone: found.homeworkDone ?? true,
          notes: found.notes || '',
        };
      } else {
        map[st.id] = {
          status: 'present',
          isCharged: true,
          sessionUnits: session?.sessionUnits ?? 1,
          hours: session?.hours ?? 1.5,
          absenceReason: '',
          homeworkDone: true,
          notes: '',
        };
      }
    }
    setRecords(map);
  }, [session, isOpen]);

  // State for Private Class Intake Dialog
  const [privateIntakeStudent, setPrivateIntakeStudent] = useState<Student | null>(null);

  // Handle clicking "حاضر"
  const markPresent = (studentId: string) => {
    if (isPrivateSession || privateStudent) {
      const targetStudent = enrolledStudents.find((s) => s.id === studentId) || privateStudent;
      if (targetStudent) {
        setPrivateIntakeStudent(targetStudent);
        return;
      }
    }

    setRecords((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status: 'present',
        isCharged: true,
        absenceReason: '',
      },
    }));
  };

  const handleConfirmPrivateIntake = (result: PrivateClassIntakeResult) => {
    if (!privateIntakeStudent) return;
    const studentId = privateIntakeStudent.id;

    setRecords((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status: 'present',
        isCharged: true,
        sessionUnits: result.sessionUnits,
        hours: result.hours,
        pricePerStudent: result.pricePerStudent,
        notes: result.notes || prev[studentId]?.notes || '',
        absenceReason: '',
      },
    }));

    setPrivateIntakeStudent(null);
  };

  // Handle clicking "متأخر"
  const markLate = (studentId: string) => {
    setRecords((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status: 'late',
        isCharged: true,
        absenceReason: '',
      },
    }));
  };

  // Open absence decision dialog
  const openAbsenceModal = (student: Student) => {
    const currentRec = records[student.id];
    setConfirmingStudent(student);
    if (currentRec && (currentRec.status === 'absent_free' || currentRec.status === 'excused')) {
      setSelectedChargeDecision('free');
      if (PREDEFINED_ABSENCE_REASONS.includes(currentRec.absenceReason)) {
        setSelectedReason(currentRec.absenceReason);
        setCustomReasonText('');
      } else if (currentRec.absenceReason) {
        setSelectedReason(isEn ? 'Custom reason' : 'سبب مخصص');
        setCustomReasonText(currentRec.absenceReason);
      } else {
        setSelectedReason(PREDEFINED_ABSENCE_REASONS[0]);
        setCustomReasonText('');
      }
    } else if (currentRec && (currentRec.status === 'absent_charged' || currentRec.status === 'absent')) {
      setSelectedChargeDecision('charged');
      setSelectedReason(PREDEFINED_ABSENCE_REASONS[0]);
      setCustomReasonText('');
    } else {
      setSelectedChargeDecision(null);
      setSelectedReason(PREDEFINED_ABSENCE_REASONS[0]);
      setCustomReasonText('');
    }
  };

  // Save the absence decision from dialog
  const handleConfirmAbsence = () => {
    if (!confirmingStudent || !selectedChargeDecision) return;

    const studentId = confirmingStudent.id;
    let finalReason = '';
    let finalStatus: AttendanceStatus = 'absent_charged';
    let finalCharged = true;

    if (selectedChargeDecision === 'charged') {
      finalStatus = 'absent_charged';
      finalCharged = true;
      finalReason = '';
    } else {
      finalStatus = 'absent_free';
      finalCharged = false;
      if (selectedReason === (isEn ? 'Custom reason' : 'سبب مخصص')) {
        finalReason = customReasonText.trim() || (isEn ? 'Custom reason' : 'سبب مخصص');
      } else {
        finalReason = selectedReason;
      }
    }

    setRecords((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status: finalStatus,
        isCharged: finalCharged,
        absenceReason: finalReason,
        notes: finalReason ? `${isEn ? 'Reason for exemption' : 'سبب عدم الاحتساب'}: ${finalReason}` : '',
      },
    }));

    setConfirmingStudent(null);
  };

  // Batch mark all absent
  const handleConfirmBatchAbsent = () => {
    let finalReason = '';
    let finalStatus: AttendanceStatus = 'absent_charged';
    let finalCharged = true;

    if (batchChargeDecision === 'charged') {
      finalStatus = 'absent_charged';
      finalCharged = true;
      finalReason = '';
    } else {
      finalStatus = 'absent_free';
      finalCharged = false;
      if (batchReason === (isEn ? 'Custom reason' : 'سبب مخصص')) {
        finalReason = batchCustomReason.trim() || (isEn ? 'Custom reason' : 'سبب مخصص');
      } else {
        finalReason = batchReason;
      }
    }

    setRecords((prev) => {
      const next: Record<string, StudentAttendanceRecord> = { ...prev };
      Object.keys(next).forEach((stId) => {
        next[stId] = {
          ...next[stId],
          status: finalStatus,
          isCharged: finalCharged,
          absenceReason: finalReason,
          notes: finalReason ? `${isEn ? 'Reason for exemption' : 'سبب عدم الاحتساب'}: ${finalReason}` : '',
        };
      });
      return next;
    });

    setIsBatchAbsentConfirmOpen(false);
  };

  // Toggle homework
  const toggleHomework = (studentId: string) => {
    setRecords((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        homeworkDone: !prev[studentId]?.homeworkDone,
      },
    }));
  };

  // Mark all present
  const setAllPresent = () => {
    setRecords((prev) => {
      const next: Record<string, StudentAttendanceRecord> = { ...prev };
      Object.keys(next).forEach((stId) => {
        next[stId] = {
          ...next[stId],
          status: 'present',
          isCharged: true,
          absenceReason: '',
        };
      });
      return next;
    });
  };

  const handleSave = () => {
    if (!session || isSavedSuccess) return;
    const listToSave: Attendance[] = [];

    Object.entries(records).forEach(([studentId, item]: [string, StudentAttendanceRecord]) => {
      const enr = allEnrollments.find((e) => e.studentId === studentId);
      listToSave.push({
        id: `att_${session.id}_${studentId}`,
        sessionId: session.id,
        studentId,
        enrollmentId: enr?.id,
        status: item.status,
        isCharged: item.isCharged,
        sessionUnits: item.sessionUnits,
        hours: item.hours || session.hours,
        hourlyRate: session.hourlyRate || enr?.hourlyRate || group?.hourlyRate,
        absenceReason: item.absenceReason,
        homeworkDone: item.homeworkDone,
        notes: item.notes || item.absenceReason,
        recordedAt: new Date().toISOString(),
      });
    });

    // Mark session as completed
    const firstRec = Object.values(records)[0] as StudentAttendanceRecord | undefined;
    if (session.status !== 'completed' && session.status !== 'cancelled') {
      db.saveSession({
        ...session,
        status: 'completed',
        sessionUnits: firstRec?.sessionUnits || session.sessionUnits,
        hours: firstRec?.hours || session.hours,
      });
    }

    db.saveAttendanceBatch(session.id, listToSave);
    setIsSavedSuccess(true);
    
    setTimeout(() => {
      onSaveComplete();
      onClose();
    }, 650);
  };

  // Summary counts
  const recordValues = Object.values(records) as StudentAttendanceRecord[];
  const presentCount = recordValues.filter((r) => r.status === 'present' || r.status === 'late').length;
  const chargedAbsentCount = recordValues.filter((r) => r.status === 'absent_charged' || (r.status === 'absent' && r.isCharged !== false)).length;
  const freeAbsentCount = recordValues.filter((r) => r.status === 'absent_free' || r.status === 'excused' || (r.status === 'absent' && r.isCharged === false)).length;

  const modalLayer = useModalLayer('record-attendance', isOpen && !!session, onClose);
  useModalLayer('attendance-confirm-student', !!confirmingStudent, () => setConfirmingStudent(null));
  useModalLayer('attendance-batch-confirm', isBatchAbsentConfirmOpen, () => setIsBatchAbsentConfirmOpen(false));

  const headerSwipeGestures = useSwipeGesture({
    onSwipeDown: onClose,
    threshold: 45,
  });

  if (!isOpen || !session) return null;

  return (
    <ModalPortal>
      <div
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-[#6B1E2B]/65 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#F8F2EA] border border-[#EADBC7] rounded-t-[28px] sm:rounded-[28px] max-w-lg w-full mx-auto max-h-[94vh] flex flex-col overflow-hidden shadow-2xl relative select-none-touch">
        
        {/* Signature Classy Header */}
        <div
          {...headerSwipeGestures}
          className="p-4 sm:p-5 bg-gradient-to-r from-[#6B1E2B] via-[#5C4033] to-[#69493C] text-[#FAF7F2] flex flex-col shrink-0 relative overflow-hidden cursor-grab active:cursor-grabbing"
        >
          {/* Mobile Drag Indicator */}
          <div className="sm:hidden w-full pb-2.5 flex items-center justify-center -mt-2">
            <div className="modal-drag-handle" />
          </div>

          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3 relative z-10 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#FAF7F2]/15 backdrop-blur-md border border-[#EADBC7]/25 text-[#FAF7F2] flex items-center justify-center shrink-0 shadow-sm">
                <Users className="w-5 h-5 text-[#B68A4C]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-black text-[#FAF7F2] tracking-tight truncate">
                  {isPrivateSession ? (isEn ? 'Record Private Attendance' : 'رصد حضور الدرس الخاص') : (isEn ? 'Take Attendance & Credit Consumption' : 'رصد الحضور واستهلاك الحصص')}
                </h2>
                <p className="text-xs text-[#EADBC7]/85 font-medium truncate">
                  {isPrivateSession && privateStudent
                    ? (isEn ? `Student: ${privateStudent.name}` : `الطالب: ${privateStudent.name}`)
                    : (group?.name || (isEn ? 'Group' : 'مجموعة'))} • {session.title || (isEn ? 'Class Session' : 'حصة دراسية')} ({session.date})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-2xl bg-[#FAF7F2]/10 hover:bg-[#FAF7F2]/20 text-[#FAF7F2] border border-[#EADBC7]/20 transition-all cursor-pointer relative z-10 active:scale-95"
              title={t('close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Batch Actions & Stats Bar */}
        <div className="p-3 bg-[#FAF7F2] border-b border-[#EADBC7] flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={setAllPresent}
              className="px-3 py-1.5 rounded-xl bg-[#F8F2EA] border border-[#B68A4C] text-[#5C4033] font-black hover:bg-[#5C4033] hover:text-[#FAF7F2] transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{isEn ? 'All Present' : 'الكل حاضر'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBatchChargeDecision('charged');
                setBatchReason(PREDEFINED_ABSENCE_REASONS[1]);
                setBatchCustomReason('');
                setIsBatchAbsentConfirmOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-[#F8F2EA] border border-[#B6A89C] text-[#B56B45] font-black hover:bg-[#B56B45] hover:text-[#FAF7F2] transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>{isEn ? 'All Absent' : 'الكل غائب'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-black">
            <span className="text-[#5C4033] bg-[#F8F2EA] px-2 py-0.5 rounded-lg border border-[#B68A4C]">{t('present')}: {presentCount}</span>
            <span className="text-[#B56B45] bg-[#F8F2EA] px-2 py-0.5 rounded-lg border border-[#B6A89C]">{isEn ? 'Charged' : 'محسوبة'}: {chargedAbsentCount}</span>
            <span className="text-[#69493C] bg-[#F8F2EA] px-2 py-0.5 rounded-lg border border-[#EADBC7]">{isEn ? 'Excused' : 'معفية'}: {freeAbsentCount}</span>
          </div>
        </div>

        {/* Students List */}
        <div className="p-4 overflow-y-auto android-scrollbar flex-1 space-y-2.5">
          {enrolledStudents.length === 0 ? (
            <div className="p-8 text-center text-[#69493C] space-y-2 bg-[#FAF7F2] rounded-2xl border border-[#EADBC7]">
              <Users className="w-8 h-8 mx-auto opacity-40 text-[#6B1E2B]" />
              <p className="text-xs font-bold">{isEn ? 'No students enrolled in this group yet.' : 'لا يوجد طلاب مسجلين في هذه المجموعة حالياً.'}</p>
            </div>
          ) : (
            enrolledStudents.map((student, index) => {
              const currentRecord = records[student.id] || {
                status: 'present',
                isCharged: true,
                absenceReason: '',
                homeworkDone: true,
                notes: '',
              };
              const enr = allEnrollments.find((e) => e.studentId === student.id);
              const credit = enr?.sessionCredit || 0;
              const isAbsent = currentRecord.status === 'absent_charged' || currentRecord.status === 'absent_free' || currentRecord.status === 'absent' || currentRecord.status === 'excused';

              return (
                <div
                  key={student.id}
                  style={{ animationDelay: `${index * 40}ms` }}
                  className={`p-3.5 rounded-2xl bg-[#FAF7F2] border transition-all shadow-sm space-y-2.5 animate-slide-up-fade ${
                    isAbsent
                      ? currentRecord.isCharged
                        ? 'border-[#B6A89C] bg-[#F8F2EA]/40'
                        : 'border-[#EADBC7] bg-[#F8F2EA]'
                      : 'border-[#EADBC7]'
                  }`}
                >
                  {/* Top Row: Name + Credit Badge + Homework Checkbox */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <StudentAvatar
                        student={student}
                        size="sm"
                        showFrame={true}
                        className="shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="font-black text-[#2F2F2F] text-xs leading-tight truncate">{student.name}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                              credit <= 0
                                ? 'bg-[#F8F2EA] text-[#B56B45] border border-[#B6A89C]'
                                : 'bg-[#EADBC7] text-[#5C4033]'
                            }`}
                          >
                            {isEn ? `Credit: ${credit} sessions` : `رصيد: ${credit} حصص`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Homework toggle */}
                    <button
                      type="button"
                      onClick={() => toggleHomework(student.id)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-black border transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                        currentRecord.homeworkDone
                          ? 'bg-[#F8F2EA] text-[#5C4033] border-[#B68A4C]'
                          : 'bg-[#F8F2EA] text-[#69493C] border-[#EADBC7]'
                      }`}
                    >
                      <BookCheck className="w-3.5 h-3.5" />
                      <span>{currentRecord.homeworkDone ? (isEn ? 'HW Done' : 'حل الواجب') : (isEn ? 'HW Incomplete' : 'لم يحل')}</span>
                    </button>
                  </div>

                  {/* Attendance Status Buttons Grid */}
                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    {/* 1. Present */}
                    <button
                      type="button"
                      onClick={() => markPresent(student.id)}
                      className={`py-2 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                        currentRecord.status === 'present'
                          ? 'bg-[#5C4033] text-[#FAF7F2] border-[#5C4033] shadow-sm'
                          : 'bg-[#F8F2EA] text-[#2F2F2F] border-[#EADBC7] hover:bg-[#EADBC7]/40'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{t('present')}</span>
                    </button>

                    {/* 2. Late */}
                    <button
                      type="button"
                      onClick={() => markLate(student.id)}
                      className={`py-2 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                        currentRecord.status === 'late'
                          ? 'bg-[#B68A4C] text-[#FAF7F2] border-[#B68A4C] shadow-sm'
                          : 'bg-[#F8F2EA] text-[#2F2F2F] border-[#EADBC7] hover:bg-[#EADBC7]/40'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{t('late')}</span>
                    </button>

                    {/* 3. Absent Trigger (opens confirmation modal) */}
                    <button
                      type="button"
                      onClick={() => openAbsenceModal(student)}
                      className={`py-2 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                        isAbsent
                          ? currentRecord.isCharged
                            ? 'bg-[#B56B45] text-[#FAF7F2] border-[#B56B45] shadow-sm'
                            : 'bg-[#6B1E2B] text-[#FAF7F2] border-[#6B1E2B] shadow-sm'
                          : 'bg-[#F8F2EA] text-[#B56B45] border-[#EADBC7] hover:bg-[#F8F2EA]'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Absent' : 'غائب'}</span>
                    </button>
                  </div>

                  {/* Zero credit warning for prepaid charged students */}
                  {enr && (enr.billingMode === 'prepaid' || enr.billingType === 'prepaid' || (enr.billingType === 'per_session' && enr.billingMode !== 'postpaid')) && credit <= 0 && currentRecord.isCharged && (
                    <div className="p-2.5 bg-[#F8F2EA] text-[#B56B45] border border-[#B6A89C] rounded-xl text-[11px] font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        {isEn
                          ? `Alert: Insufficient session credit (Balance: 0). Attendance will be saved and charged as due (${enr.customPrice || 100} ${t('currency')}).`
                          : `تنبيه: لا يوجد رصيد حصص كافٍ (الرصيد: 0). سيتم حفظ الحضور وتسجيل الحصة كمستحقة للدفع بقيمة ${enr.customPrice || 100} ج.م.`}
                      </span>
                    </div>
                  )}

                  {/* Private Present Detail Sub-badge with edit button */}
                  {!isAbsent && isPrivateSession && currentRecord.status === 'present' && (
                    <div className="p-2.5 rounded-xl border border-[#B68A4C]/50 bg-[#F8F2EA] flex items-center justify-between gap-2 text-[11px] text-[#2F2F2F]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-[#B68A4C] shrink-0" />
                        <span className="font-black">
                          {currentRecord.hours
                            ? `${currentRecord.hours} ${isEn ? 'hours' : 'ساعة'}`
                            : `${currentRecord.sessionUnits || 1} ${isEn ? 'session(s)' : 'حصة'}`}
                        </span>
                        {currentRecord.pricePerStudent ? (
                          <span className="text-[#5C4033] font-bold">• {currentRecord.pricePerStudent} {t('currency')}</span>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => setPrivateIntakeStudent(student)}
                        className="px-2.5 py-1 rounded-lg bg-[#FAF7F2] border border-[#B68A4C]/60 text-[10px] font-black text-[#5C4033] hover:bg-[#EADBC7] transition-colors shrink-0 flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <Edit3 className="w-3 h-3 text-[#6B1E2B]" />
                        <span>{t('edit')}</span>
                      </button>
                    </div>
                  )}

                  {/* Absent Detail Sub-badge with edit button */}
                  {isAbsent && (
                    <div
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-[11px] ${
                        currentRecord.isCharged
                          ? 'bg-[#F8F2EA] border-[#B6A89C] text-[#B56B45]'
                          : 'bg-[#F8F2EA] border-[#EADBC7] text-[#2F2F2F]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        {currentRecord.isCharged ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-[#B56B45] shrink-0" />
                            <span className="font-black">{isEn ? 'Charged Absence:' : 'حصة محسوبة:'}</span>
                            <span className="truncate">{isEn ? 'Consumes session credit or added to due balance' : 'تستهلك رصيد حصة أو تُضاف للمستحقات'}</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-[#69493C] shrink-0" />
                            <span className="font-black">{isEn ? 'Exempt Absence:' : 'غير محسوبة:'}</span>
                            <span className="font-bold text-[#69493C] truncate">
                              {isEn ? `Reason: ${currentRecord.absenceReason || 'Exempt'}` : `السبب: ${currentRecord.absenceReason || 'معفي'}`}
                            </span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => openAbsenceModal(student)}
                        className="px-2.5 py-1 rounded-lg bg-[#FAF7F2] border border-[#EADBC7] text-[10px] font-black text-[#2F2F2F] hover:bg-[#F8F2EA] transition-colors shrink-0 flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <Edit3 className="w-3 h-3 text-[#6B1E2B]" />
                        <span>{t('edit')}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer with Save Action */}
        <div className="p-4 bg-[#FAF7F2] border-t border-[#EADBC7] flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSavedSuccess}
            className="flex-1 py-3 rounded-2xl border border-[#EADBC7] bg-[#FAF7F2] text-[#69493C] font-black text-xs hover:bg-[#F8F2EA] transition-all disabled:opacity-50 cursor-pointer"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSavedSuccess}
            className={`flex-1 py-3 rounded-2xl text-[#FAF7F2] font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
              isSavedSuccess
                ? 'bg-[#5C4033] ring-2 ring-[#B68A4C]/50'
                : 'bg-gradient-to-r from-[#6B1E2B] via-[#5C4033] to-[#69493C] shadow-[#6B1E2B]/30 hover:brightness-105'
            }`}
          >
            {isSavedSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#FAF7F2] animate-in zoom-in-50" />
                <span>{isEn ? 'Attendance Saved Successfully!' : 'تم حفظ الحضور وتحديث الأرصدة!'}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-[#B68A4C]" />
                <span>{isEn ? 'Save Attendance & Update Balances' : 'حفظ الحضور وتحديث الأرصدة'}</span>
              </>
            )}
          </button>
        </div>

        {/* ========================================================= */}
        {/* INDIVIDUAL STUDENT ABSENCE CONFIRMATION MODAL */}
        {/* ========================================================= */}
        {confirmingStudent && (
          <div className="absolute inset-0 z-50 bg-[#6B1E2B]/70 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-3 animate-in fade-in duration-150">
            <div className="bg-[#FAF7F2] border border-[#EADBC7] rounded-[28px] p-4 sm:p-5 max-w-md w-full mx-auto space-y-4 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#EADBC7] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#F8F2EA] text-[#B56B45]">
                    <UserX className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-[#2F2F2F]">
                      {isEn ? 'Record Student Absence' : 'تسجيل غياب الطالب'}
                    </h3>
                    <p className="text-xs text-[#6B1E2B] font-black">
                      {confirmingStudent.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmingStudent(null)}
                  className="p-1.5 rounded-full text-[#69493C] hover:text-[#2F2F2F] hover:bg-[#F8F2EA] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Main Question */}
              <div className="space-y-1">
                <label className="block font-black text-xs text-[#2F2F2F]">
                  {isEn ? 'Charge this class to the student?' : 'هل تريد احتساب الحصة على الطالب؟'}
                </label>
                <p className="text-[11px] text-[#69493C] font-medium">
                  {isEn ? 'Specify if the class will consume credit / be charged as due or be excused.' : 'حدد ما إذا كانت الحصة ستُحسب ماليًا وتستهلك رصيد حصص أو تكون معفية.'}
                </p>
              </div>

              {/* 2 Primary Choices */}
              <div className="grid grid-cols-1 gap-2.5">
                {/* Option 1: Yes, Charged */}
                <button
                  type="button"
                  onClick={() => setSelectedChargeDecision('charged')}
                  className={`p-3.5 rounded-2xl border ${isRTL ? 'text-right' : 'text-left'} transition-all flex items-start gap-2.5 cursor-pointer ${
                    selectedChargeDecision === 'charged'
                      ? 'bg-[#F8F2EA] border-[#B56B45] ring-2 ring-[#B56B45]/20 shadow-xs'
                      : 'bg-[#F8F2EA] border-[#EADBC7] hover:bg-[#FAF7F2]'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedChargeDecision === 'charged'
                        ? 'border-[#B56B45] bg-[#B56B45] text-[#FAF7F2]'
                        : 'border-[#B6A89C] bg-[#FAF7F2]'
                    }`}
                  >
                    {selectedChargeDecision === 'charged' && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <span className="font-black text-xs text-[#2F2F2F] block">
                      {isEn ? 'Yes, Charge (Charged Absence)' : 'نعم، تُحسب عليه'}
                    </span>
                    <span className="text-[11px] text-[#69493C] mt-0.5 block leading-relaxed font-medium">
                      {isEn ? 'Consumes 1 session credit or is recorded as a due payment.' : 'تستهلك حصة من رصيد الحصص (Session Credit) إن كان لديه رصيد، أو تدخل في الحصص المستحقة.'}
                    </span>
                  </div>
                </button>

                {/* Option 2: No, Free (Exempt) */}
                <button
                  type="button"
                  onClick={() => setSelectedChargeDecision('free')}
                  className={`p-3.5 rounded-2xl border ${isRTL ? 'text-right' : 'text-left'} transition-all flex items-start gap-2.5 cursor-pointer ${
                    selectedChargeDecision === 'free'
                      ? 'bg-[#F8F2EA] border-[#B68A4C] ring-2 ring-[#B68A4C]/20 shadow-xs'
                      : 'bg-[#F8F2EA] border-[#EADBC7] hover:bg-[#FAF7F2]'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedChargeDecision === 'free'
                        ? 'border-[#B68A4C] bg-[#5C4033] text-[#FAF7F2]'
                        : 'border-[#B6A89C] bg-[#FAF7F2]'
                    }`}
                  >
                    {selectedChargeDecision === 'free' && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <span className="font-black text-xs text-[#2F2F2F] block">
                      {isEn ? 'No, Excuse (Free / Exempt)' : 'لا، لا تُحسب عليه (غياب معفى)'}
                    </span>
                    <span className="text-[11px] text-[#69493C] mt-0.5 block leading-relaxed font-medium">
                      {isEn ? 'Does not consume session credit and does not add any financial charge.' : 'لا تستهلك من رصيد الحصص ولا تضيف أي قيمة للمستحقات المالية.'}
                    </span>
                  </div>
                </button>
              </div>

              {/* Absence Reason Selector (Shown only if decision is 'free') */}
              {selectedChargeDecision === 'free' && (
                <div className="p-3 bg-[#F8F2EA] border border-[#EADBC7] rounded-2xl space-y-2 animate-in fade-in duration-150">
                  <label className="block font-black text-xs text-[#2F2F2F]">
                    {isEn ? 'Please record exemption reason: *' : 'يرجى تسجيل سبب عدم احتساب الحصة: *'}
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {PREDEFINED_ABSENCE_REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setSelectedReason(reason)}
                        className={`py-2 px-2 rounded-xl text-[11px] font-black border transition-all text-center cursor-pointer ${
                          selectedReason === reason
                            ? 'bg-[#6B1E2B] text-[#FAF7F2] border-[#6B1E2B] shadow-xs'
                            : 'bg-[#FAF7F2] text-[#2F2F2F] border-[#EADBC7] hover:bg-[#EADBC7]/40'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedReason(isEn ? 'Custom reason' : 'سبب مخصص')}
                      className={`py-2 px-2 rounded-xl text-[11px] font-black border transition-all text-center cursor-pointer ${
                        selectedReason === (isEn ? 'Custom reason' : 'سبب مخصص')
                          ? 'bg-[#6B1E2B] text-[#FAF7F2] border-[#6B1E2B] shadow-xs'
                          : 'bg-[#FAF7F2] text-[#2F2F2F] border-[#EADBC7] hover:bg-[#EADBC7]/40'
                      }`}
                    >
                      {isEn ? 'Custom reason' : 'سبب مخصص'}
                    </button>
                  </div>

                  {selectedReason === (isEn ? 'Custom reason' : 'سبب مخصص') && (
                    <div className="pt-1">
                      <input
                        type="text"
                        autoFocus
                        placeholder={isEn ? 'Write detailed exemption reason...' : 'اكتب سبب الغياب المعفي بالتفصيل...'}
                        value={customReasonText}
                        onChange={(e) => setCustomReasonText(e.target.value)}
                        className="classy-input"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#EADBC7]">
                <button
                  type="button"
                  onClick={() => setConfirmingStudent(null)}
                  className="flex-1 py-2.5 rounded-2xl border border-[#EADBC7] bg-[#FAF7F2] text-[#69493C] font-black text-xs hover:bg-[#F8F2EA] cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  disabled={!selectedChargeDecision || (selectedChargeDecision === 'free' && selectedReason === (isEn ? 'Custom reason' : 'سبب مخصص') && !customReasonText.trim())}
                  onClick={handleConfirmAbsence}
                  className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-[#6B1E2B] to-[#5C4033] hover:brightness-105 disabled:opacity-50 text-[#FAF7F2] font-black text-xs shadow-md transition-all cursor-pointer"
                >
                  {isEn ? 'Confirm Absence' : 'تأكيد الغياب'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* BATCH ABSENCE CONFIRMATION MODAL */}
        {/* ========================================================= */}
        {isBatchAbsentConfirmOpen && (
          <div className="absolute inset-0 z-50 bg-[#6B1E2B]/70 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-3 animate-in fade-in duration-150">
            <div className="bg-[#FAF7F2] border border-[#EADBC7] rounded-[28px] p-4 sm:p-5 max-w-md w-full mx-auto space-y-4 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#EADBC7] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#F8F2EA] text-[#B56B45]">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-[#2F2F2F]">
                      {isEn ? `Record All Students Absent (${enrolledStudents.length})` : `تسجيل غياب جميع الطلاب (${enrolledStudents.length})`}
                    </h3>
                    <p className="text-xs text-[#69493C] font-medium">
                      {isEn ? 'Specify batch absence handling' : 'تحديد معاملة الغياب الجماعي'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBatchAbsentConfirmOpen(false)}
                  className="p-1.5 rounded-full text-[#69493C] hover:text-[#2F2F2F] hover:bg-[#F8F2EA] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Main Question */}
              <div className="space-y-1">
                <label className="block font-black text-xs text-[#2F2F2F]">
                  {isEn ? 'Charge this class to all students?' : 'هل تريد احتساب الحصة على جميع الطلاب؟'}
                </label>
              </div>

              {/* 2 Primary Choices */}
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setBatchChargeDecision('charged')}
                  className={`p-3.5 rounded-2xl border ${isRTL ? 'text-right' : 'text-left'} transition-all flex items-start gap-2.5 cursor-pointer ${
                    batchChargeDecision === 'charged'
                      ? 'bg-[#F8F2EA] border-[#B56B45] ring-2 ring-[#B56B45]/20'
                      : 'bg-[#F8F2EA] border-[#EADBC7]'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      batchChargeDecision === 'charged'
                        ? 'border-[#B56B45] bg-[#B56B45] text-[#FAF7F2]'
                        : 'border-[#B6A89C] bg-[#FAF7F2]'
                    }`}
                  >
                    {batchChargeDecision === 'charged' && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <span className="font-black text-xs text-[#2F2F2F] block">
                      {isEn ? 'Yes, Charge for all' : 'نعم، تُحسب على الكل'}
                    </span>
                    <span className="text-[11px] text-[#69493C] mt-0.5 block font-medium">
                      {isEn ? 'Consumes 1 session credit from each student or added to dues.' : 'تستهلك حصة من رصيد كل طالب أو تدخل في مستحقاته.'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBatchChargeDecision('free')}
                  className={`p-3.5 rounded-2xl border ${isRTL ? 'text-right' : 'text-left'} transition-all flex items-start gap-2.5 cursor-pointer ${
                    batchChargeDecision === 'free'
                      ? 'bg-[#F8F2EA] border-[#B68A4C] ring-2 ring-[#B68A4C]/20'
                      : 'bg-[#F8F2EA] border-[#EADBC7]'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      batchChargeDecision === 'free'
                        ? 'border-[#B68A4C] bg-[#5C4033] text-[#FAF7F2]'
                        : 'border-[#B6A89C] bg-[#FAF7F2]'
                    }`}
                  >
                    {batchChargeDecision === 'free' && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <span className="font-black text-xs text-[#2F2F2F] block">
                      {isEn ? 'No, Excuse for all (Batch Exemption)' : 'لا، لا تُحسب على أي طالب (إعفاء جماعي)'}
                    </span>
                    <span className="text-[11px] text-[#69493C] mt-0.5 block font-medium">
                      {isEn ? 'Does not consume any credits and does not add charges.' : 'لا تستهلك أي رصيد ولا تضيف أي مبالغ للمستحقات.'}
                    </span>
                  </div>
                </button>
              </div>

              {/* Reasons if free */}
              {batchChargeDecision === 'free' && (
                <div className="p-3 bg-[#F8F2EA] border border-[#EADBC7] rounded-2xl space-y-2 animate-in fade-in">
                  <label className="block font-black text-xs text-[#2F2F2F]">
                    {isEn ? 'Reason for batch exemption:' : 'سبب عدم احتساب الحصة للكل:'}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {PREDEFINED_ABSENCE_REASONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setBatchReason(r)}
                        className={`py-2 px-2 rounded-xl text-[11px] font-black border transition-all text-center cursor-pointer ${
                          batchReason === r
                            ? 'bg-[#6B1E2B] text-[#FAF7F2] border-[#6B1E2B]'
                            : 'bg-[#FAF7F2] text-[#2F2F2F] border-[#EADBC7]'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setBatchReason(isEn ? 'Custom reason' : 'سبب مخصص')}
                      className={`py-2 px-2 rounded-xl text-[11px] font-black border transition-all text-center cursor-pointer ${
                        batchReason === (isEn ? 'Custom reason' : 'سبب مخصص')
                          ? 'bg-[#6B1E2B] text-[#FAF7F2] border-[#6B1E2B]'
                          : 'bg-[#FAF7F2] text-[#2F2F2F] border-[#EADBC7]'
                      }`}
                    >
                      {isEn ? 'Custom reason' : 'سبب مخصص'}
                    </button>
                  </div>

                  {batchReason === (isEn ? 'Custom reason' : 'سبب مخصص') && (
                    <input
                      type="text"
                      placeholder={isEn ? 'Write custom batch reason...' : 'اكتب السبب الجماعي المخصص...'}
                      value={batchCustomReason}
                      onChange={(e) => setBatchCustomReason(e.target.value)}
                      className="classy-input"
                    />
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#EADBC7]">
                <button
                  type="button"
                  onClick={() => setIsBatchAbsentConfirmOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-[#EADBC7] bg-[#FAF7F2] text-[#69493C] font-black text-xs cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBatchAbsent}
                  className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-[#6B1E2B] to-[#5C4033] hover:brightness-105 text-[#FAF7F2] font-black text-xs cursor-pointer shadow-md"
                >
                  {isEn ? 'Apply Batch Absence' : 'تطبيق الغياب للكل'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Private Class Intake Details Modal */}
        {privateIntakeStudent && (
          <PrivateClassIntakeModal
            isOpen={!!privateIntakeStudent}
            onClose={() => setPrivateIntakeStudent(null)}
            student={privateIntakeStudent}
            session={session}
            group={group}
            onConfirm={handleConfirmPrivateIntake}
          />
        )}

      </div>
    </div>
    </ModalPortal>
  );
};
