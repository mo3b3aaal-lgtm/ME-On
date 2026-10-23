import React, { useState, useEffect, useMemo } from 'react';
import { Session, Group, Student, Attendance, AttendanceStatus } from '../types';
import { db } from '../utils/storage';
import { StudentAvatar } from './StudentAvatar';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import { useTranslation } from '../utils/i18n';
import { useSwipeGesture } from '../utils/useSwipeGesture';
import { PrivateClassIntakeModal, PrivateClassIntakeResult } from './PrivateClassIntakeModal';
import { BottomSheet } from './ui/BottomSheet';
import { AppIcon } from './ui/AppIcon';
import { StatusBadge } from './ui/StatusBadge';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';

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
    if (!sessionId) return [];
    if (privateStudent) return [privateStudent];
    if (!groupId) return [];
    return db.getGroupStudents(groupId);
  }, [sessionId, groupId, privateStudent]);

  const existingAttendance = useMemo(
    () => (sessionId ? db.getSessionAttendance(sessionId) : []),
    [sessionId]
  );

  const allEnrollments = useMemo(() => {
    if (!sessionId) return [];
    if (isPrivateSession && privateStudent) {
      return db.getStudentPrivateEnrollments(privateStudent.id).map((p) => p.enrollment);
    }
    if (!groupId) return [];
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
    const finalStatus = result.attendanceStatus || 'present';
    const isCharged = result.isCharged !== undefined ? result.isCharged : (finalStatus !== 'absent_free');

    setRecords((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status: finalStatus,
        isCharged,
        sessionUnits: result.sessionUnits,
        hours: result.hours,
        pricePerStudent: result.pricePerStudent,
        notes: result.notes || prev[studentId]?.notes || '',
        absenceReason: finalStatus === 'absent_free' ? (result.notes || (isEn ? 'Uncharged Absence' : 'غياب غير محسوب')) : '',
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
    triggerSuccessHaptic();
    
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

  const handleDirectPrivateConfirm = (result: PrivateClassIntakeResult) => {
    if (!session || !privateStudent) return;
    const studentId = privateStudent.id;
    const finalStatus = result.attendanceStatus || 'present';
    const isCharged = result.isCharged !== undefined ? result.isCharged : (finalStatus !== 'absent_free');

    const enr = allEnrollments.find((e) => e.studentId === studentId);
    const isHourly =
      group?.billingMode === 'hourly' ||
      group?.billingType === 'hourly' ||
      enr?.billingMode === 'hourly' ||
      enr?.billingType === 'hourly';

    const record: Attendance = {
      id: `att_${session.id}_${studentId}`,
      sessionId: session.id,
      studentId,
      enrollmentId: enr?.id || session.enrollmentId,
      status: finalStatus,
      isCharged,
      sessionUnits: isHourly ? undefined : result.sessionUnits,
      hours: isHourly ? result.hours : undefined,
      notes: result.notes,
      absenceReason: finalStatus === 'absent_free' ? (result.notes || (isEn ? 'Uncharged Absence' : 'غياب غير محسوب')) : undefined,
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

    triggerSuccessHaptic();
    onSaveComplete();
    onClose();
  };

  if (!isOpen || !session) return null;

  // CRITICAL RULE: A private lesson must NEVER open the group attendance modal
  // that contains bulk actions like "Mark All Present" or "Mark All Absent".
  // If a private session is routed here, immediately render PrivateClassIntakeModal directly.
  if (isPrivateSession && privateStudent) {
    return (
      <PrivateClassIntakeModal
        isOpen={isOpen}
        onClose={onClose}
        student={privateStudent}
        session={session}
        group={group}
        onConfirm={handleDirectPrivateConfirm}
      />
    );
  }

  return (
    <>
      <BottomSheet
        id="record-attendance"
        isOpen={isOpen && !!session}
        onClose={onClose}
        title={
          isPrivateSession
            ? isEn
              ? 'Record Private Attendance'
              : 'رصد حضور الدرس الخاص'
            : isEn
            ? 'Take Attendance'
            : 'رصد الحضور واستهلاك الحصص'
        }
        subtitle={`${
          isPrivateSession && privateStudent
            ? isEn
              ? `Student: ${privateStudent.name}`
              : `الطالب: ${privateStudent.name}`
            : group?.name || (isEn ? 'Group' : 'مجموعة')
        } • ${session.title || (isEn ? 'Class Session' : 'حصة دراسية')} (${session.date})`}
        headerLeading={
          <div className="w-10 h-10 rounded-2xl bg-mint-soft text-navy flex items-center justify-center shrink-0 border border-line">
            <AppIcon name="calendarCheck" size={20} weight="fill" />
          </div>
        }
        headerTrailing={
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-mint-soft text-navy border border-line">
            {enrolledStudents.length} {isEn ? 'Students' : 'طلاب'}
          </span>
        }
        bodyClassName="p-4"
        footer={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSavedSuccess}
              className="btn-soft flex-1"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={() => {
                triggerLightHaptic();
                handleSave();
              }}
              disabled={isSavedSuccess}
              className="btn-orange flex-1 cursor-pointer"
            >
              {isSavedSuccess ? (
                <>
                  <AppIcon name="checkCircle" size={16} weight="bold" className="animate-pop-in" />
                  <span>{isEn ? 'Attendance Saved Successfully!' : 'تم حفظ الحضور وتحديث الأرصدة!'}</span>
                </>
              ) : (
                <>
                  <AppIcon name="save" size={16} weight="bold" />
                  <span>{isEn ? 'Save Attendance & Update Balances' : 'حفظ الحضور وتحديث الأرصدة'}</span>
                </>
              )}
            </button>
          </div>
        }
      >
        {/* Quick Batch Actions & Stats Bar */}
        <div className="p-3 bg-mist rounded-2xl border border-line flex items-center justify-between gap-2 flex-wrap text-xs mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={setAllPresent}
              className="px-3 py-1.5 rounded-xl bg-page border border-navy text-navy font-bold hover:bg-navy hover:text-white transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <AppIcon name="userCheck" size={14} weight="bold" />
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
              className="px-3 py-1.5 rounded-xl bg-page border border-line text-navy font-bold hover:bg-navy hover:text-white transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <AppIcon name="student" size={14} />
              <span>{isEn ? 'All Absent' : 'الكل غائب'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="text-teal bg-teal/10 px-2 py-0.5 rounded-lg border border-teal/20">
              {t('present')}: {presentCount}
            </span>
            <span className="text-coral bg-coral/10 px-2 py-0.5 rounded-lg border border-coral/20">
              {isEn ? 'Charged' : 'محسوبة'}: {chargedAbsentCount}
            </span>
            <span className="text-slate bg-mint-soft px-2 py-0.5 rounded-lg border border-line">
              {isEn ? 'Excused' : 'معفية'}: {freeAbsentCount}
            </span>
          </div>
        </div>

        {/* Students List */}
        <div className="space-y-2.5">
          {enrolledStudents.length === 0 ? (
            <div className="p-8 text-center text-slate space-y-2 bg-page rounded-2xl border border-line">
              <AppIcon name="students" size={32} weight="duotone" className="mx-auto text-slate" />
              <p className="text-xs font-bold">
                {isEn ? 'No students enrolled in this group yet.' : 'لا يوجد طلاب مسجلين في هذه المجموعة حالياً.'}
              </p>
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
              const isAbsent =
                currentRecord.status === 'absent_charged' ||
                currentRecord.status === 'absent_free' ||
                currentRecord.status === 'absent' ||
                currentRecord.status === 'excused';

              return (
                <div
                  key={student.id}
                  style={{ animationDelay: `${index * 40}ms` }}
                  className={`p-3.5 rounded-2xl bg-page border transition-all shadow-sm space-y-2.5 animate-slide-up-fade ${
                    isAbsent
                      ? currentRecord.isCharged
                        ? 'border-line bg-mist'
                        : 'border-line bg-mist'
                      : 'border-line'
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
                        <h4 className="font-bold text-navy text-xs leading-tight truncate">{student.name}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                              credit <= 0
                                ? 'bg-coral/10 text-coral border border-coral/20'
                                : 'bg-mint-soft text-navy'
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
                      className={`px-3 py-1 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                        currentRecord.homeworkDone
                          ? 'bg-mint-soft text-navy border-navy'
                          : 'bg-page text-slate border-line'
                      }`}
                    >
                      <AppIcon name={currentRecord.homeworkDone ? 'check' : 'minus'} size={12} weight="bold" />
                      <span>{currentRecord.homeworkDone ? (isEn ? 'HW Done' : 'حل الواجب') : (isEn ? 'HW Incomplete' : 'لم يحل')}</span>
                    </button>
                  </div>

                  {/* Attendance Status Buttons: 3 selectable tiles with radius 18px */}
                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    {/* 1. Present */}
                    <button
                      type="button"
                      onClick={() => markPresent(student.id)}
                      className={`py-2 px-2 rounded-[18px] text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                        currentRecord.status === 'present'
                          ? 'bg-mint border-2 border-navy text-navy font-bold shadow-xs'
                          : 'bg-mint-soft text-navy border-line hover:bg-mint/60'
                      }`}
                    >
                      <AppIcon name="check" size={14} weight="bold" />
                      <span>{t('present')}</span>
                    </button>

                    {/* 2. Late */}
                    <button
                      type="button"
                      onClick={() => markLate(student.id)}
                      className={`py-2 px-2 rounded-[18px] text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                        currentRecord.status === 'late'
                          ? 'bg-mint border-2 border-navy text-navy font-bold shadow-xs'
                          : 'bg-mint-soft text-navy border-line hover:bg-mint/60'
                      }`}
                    >
                      <AppIcon name="clock" size={14} weight="fill" />
                      <span>{t('late')}</span>
                    </button>

                    {/* 3. Absent Trigger (opens confirmation modal) */}
                    <button
                      type="button"
                      onClick={() => openAbsenceModal(student)}
                      className={`py-2 px-2 rounded-[18px] text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                        isAbsent
                          ? 'bg-mint border-2 border-navy text-navy font-bold shadow-xs'
                          : 'bg-mint-soft text-navy border-line hover:bg-mint/60'
                      }`}
                    >
                      <AppIcon name="warning" size={14} weight="fill" />
                      <span>{isEn ? 'Absent' : 'غائب'}</span>
                    </button>
                  </div>

                  {/* Zero credit warning for prepaid charged students */}
                  {enr && (enr.billingMode === 'prepaid' || enr.billingType === 'prepaid' || (enr.billingType === 'per_session' && enr.billingMode !== 'postpaid')) && credit <= 0 && currentRecord.isCharged && (
                    <div className="p-2.5 bg-coral/10 text-coral border border-coral/20 rounded-xl text-[11px] font-bold flex items-center gap-1.5">
                      <AppIcon name="warning" size={16} className="shrink-0" />
                      <span>
                        {isEn
                          ? `Alert: Insufficient session credit (Balance: 0). Attendance will be saved and charged as due (${enr.customPrice || 100} ${t('currency')}).`
                          : `تنبيه: لا يوجد رصيد حصص كافٍ (الرصيد: 0). سيتم حفظ الحضور وتسجيل الحصة كمستحقة للدفع بقيمة ${enr.customPrice || 100} ج.م.`}
                      </span>
                    </div>
                  )}

                  {/* Private Present Detail Sub-badge with edit button */}
                  {!isAbsent && isPrivateSession && currentRecord.status === 'present' && (
                    <div className="p-2.5 rounded-xl border border-navy/20 bg-mint-soft flex items-center justify-between gap-2 text-[11px] text-navy">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AppIcon name="checkCircle" size={16} weight="fill" className="text-teal shrink-0" />
                        <span className="font-bold">
                          {currentRecord.hours
                            ? `${currentRecord.hours} ${isEn ? 'hours' : 'ساعة'}`
                            : `${currentRecord.sessionUnits || 1} ${isEn ? 'session(s)' : 'حصة'}`}
                        </span>
                        {currentRecord.pricePerStudent ? (
                          <span className="text-navy font-bold">• {currentRecord.pricePerStudent} {t('currency')}</span>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => setPrivateIntakeStudent(student)}
                        className="px-2.5 py-1 rounded-lg bg-page border border-line text-[10px] font-bold text-navy hover:bg-mint-soft transition-colors shrink-0 flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <AppIcon name="edit" size={12} className="text-navy" />
                        <span>{t('edit')}</span>
                      </button>
                    </div>
                  )}

                  {/* Absent Detail Sub-badge with edit button */}
                  {isAbsent && (
                    <div className="p-2.5 rounded-xl border border-line bg-mist flex items-center justify-between gap-2 text-[11px] text-navy">
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        {currentRecord.isCharged ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-coral shrink-0" />
                            <span className="font-bold">{isEn ? 'Charged Absence:' : 'حصة محسوبة:'}</span>
                            <span className="truncate">{isEn ? 'Consumes session credit or added to due balance' : 'تستهلك رصيد حصة أو تُضاف للمستحقات'}</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-slate shrink-0" />
                            <span className="font-bold">{isEn ? 'Exempt Absence:' : 'غير محسوبة:'}</span>
                            <span className="font-medium text-slate truncate">
                              {isEn ? `Reason: ${currentRecord.absenceReason || 'Exempt'}` : `السبب: ${currentRecord.absenceReason || 'معفي'}`}
                            </span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => openAbsenceModal(student)}
                        className="px-2.5 py-1 rounded-lg bg-page border border-line text-[10px] font-bold text-navy hover:bg-mint-soft transition-colors shrink-0 flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <AppIcon name="edit" size={12} className="text-navy" />
                        <span>{t('edit')}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </BottomSheet>

      {/* ========================================================= */}
      {/* INDIVIDUAL STUDENT ABSENCE CONFIRMATION DIALOG (centered card) */}
      {/* ========================================================= */}
      {confirmingStudent && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 bg-navy-deep/40 backdrop-blur-xs flex items-center justify-center p-4 animate-backdrop-fade"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div className="bg-page border border-line rounded-[28px] p-5 max-w-md w-full mx-auto space-y-4 shadow-white animate-pop-in">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-mint-soft text-navy flex items-center justify-center shrink-0">
                    <AppIcon name="student" size={20} weight="duotone" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-navy">
                      {isEn ? 'Record Student Absence' : 'تسجيل غياب الطالب'}
                    </h3>
                    <p className="text-xs text-navy font-bold">
                      {confirmingStudent.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmingStudent(null)}
                  className="w-8 h-8 rounded-full bg-mint-soft text-navy hover:bg-mint flex items-center justify-center transition-colors cursor-pointer"
                >
                  <AppIcon name="close" size={16} weight="bold" />
                </button>
              </div>

              {/* Main Question */}
              <div className="space-y-1">
                <label className="block font-bold text-xs text-navy">
                  {isEn ? 'Charge this class to the student?' : 'هل تريد احتساب الحصة على الطالب؟'}
                </label>
                <p className="text-[11px] text-slate font-medium">
                  {isEn ? 'Specify if the class will consume credit / be charged as due or be excused.' : 'حدد ما إذا كانت الحصة ستُحسب ماليًا وتستهلك رصيد حصص أو تكون معفية.'}
                </p>
              </div>

              {/* 2 Selectable Tiles: radius 18px, mint-soft when idle, navy border + mint bg when selected */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Option 1: Yes, Charged */}
                <button
                  type="button"
                  onClick={() => setSelectedChargeDecision('charged')}
                  className={`p-3.5 rounded-[18px] transition-all flex items-start gap-2.5 cursor-pointer text-start ${
                    selectedChargeDecision === 'charged'
                      ? 'bg-mint border-2 border-navy text-navy font-bold shadow-xs'
                      : 'bg-mint-soft border border-line text-navy hover:bg-mint/60'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      selectedChargeDecision === 'charged'
                        ? 'bg-navy text-white animate-pop-in'
                        : 'bg-page text-navy'
                    }`}
                  >
                    <AppIcon name="warning" size={14} weight="fill" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-navy block leading-tight">
                      {isEn ? 'Charged Absence' : 'نعم، تُحسب عليه'}
                    </span>
                    <span className="text-[10px] text-slate mt-1 block leading-tight font-medium">
                      {isEn ? 'Consumes credit / due' : 'تستهلك رصيد / مستحقة'}
                    </span>
                  </div>
                </button>

                {/* Option 2: No, Free (Exempt) */}
                <button
                  type="button"
                  onClick={() => setSelectedChargeDecision('free')}
                  className={`p-3.5 rounded-[18px] transition-all flex items-start gap-2.5 cursor-pointer text-start ${
                    selectedChargeDecision === 'free'
                      ? 'bg-mint border-2 border-navy text-navy font-bold shadow-xs'
                      : 'bg-mint-soft border border-line text-navy hover:bg-mint/60'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      selectedChargeDecision === 'free'
                        ? 'bg-navy text-white animate-pop-in'
                        : 'bg-page text-navy'
                    }`}
                  >
                    <AppIcon name="info" size={14} weight="fill" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-navy block leading-tight">
                      {isEn ? 'Free (Exempt)' : 'غياب معفى'}
                    </span>
                    <span className="text-[10px] text-slate mt-1 block leading-tight font-medium">
                      {isEn ? 'No credit consumed' : 'لا تستهلك أي رصيد'}
                    </span>
                  </div>
                </button>
              </div>

              {/* Absence Reason Selector (Shown only if decision is 'free') */}
              {selectedChargeDecision === 'free' && (
                <div className="p-3 bg-mist border border-line rounded-2xl space-y-2 animate-in fade-in duration-150">
                  <label className="block font-bold text-xs text-navy">
                    {isEn ? 'Please record exemption reason: *' : 'يرجى تسجيل سبب عدم احتساب الحصة: *'}
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {PREDEFINED_ABSENCE_REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setSelectedReason(reason)}
                        className={`chip px-2 text-[11px] ${selectedReason === reason ? 'chip-active' : ''}`}
                      >
                        {reason}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedReason(isEn ? 'Custom reason' : 'سبب مخصص')}
                      className={`chip px-2 text-[11px] ${selectedReason === (isEn ? 'Custom reason' : 'سبب مخصص') ? 'chip-active' : ''}`}
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

              {/* Action Buttons: btn-soft cancel + btn-orange confirm */}
              <div className="flex items-center gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setConfirmingStudent(null)}
                  className="btn-soft flex-1"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  disabled={!selectedChargeDecision || (selectedChargeDecision === 'free' && selectedReason === (isEn ? 'Custom reason' : 'سبب مخصص') && !customReasonText.trim())}
                  onClick={handleConfirmAbsence}
                  className="btn-orange flex-1"
                >
                  {isEn ? 'Confirm Absence' : 'تأكيد الغياب'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ========================================================= */}
      {/* BATCH ABSENCE CONFIRMATION DIALOG (centered card) */}
      {/* ========================================================= */}
      {isBatchAbsentConfirmOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 bg-navy-deep/40 backdrop-blur-xs flex items-center justify-center p-4 animate-backdrop-fade"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div className="bg-page border border-line rounded-[28px] p-5 max-w-md w-full mx-auto space-y-4 shadow-white animate-pop-in">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-mint-soft text-navy flex items-center justify-center shrink-0">
                    <AppIcon name="students" size={20} weight="duotone" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-navy">
                      {isEn ? `Record All Students Absent (${enrolledStudents.length})` : `تسجيل غياب جميع الطلاب (${enrolledStudents.length})`}
                    </h3>
                    <p className="text-xs text-slate font-medium">
                      {isEn ? 'Specify batch absence handling' : 'تحديد معاملة الغياب الجماعي'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBatchAbsentConfirmOpen(false)}
                  className="w-8 h-8 rounded-full bg-mint-soft text-navy hover:bg-mint flex items-center justify-center transition-colors cursor-pointer"
                >
                  <AppIcon name="close" size={16} weight="bold" />
                </button>
              </div>

              {/* Main Question */}
              <div className="space-y-1">
                <label className="block font-bold text-xs text-navy">
                  {isEn ? 'Charge this class to all students?' : 'هل تريد احتساب الحصة على جميع الطلاب؟'}
                </label>
              </div>

              {/* 2 Selectable Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setBatchChargeDecision('charged')}
                  className={`p-3.5 rounded-[18px] transition-all flex items-start gap-2.5 cursor-pointer text-start ${
                    batchChargeDecision === 'charged'
                      ? 'bg-mint border-2 border-navy text-navy font-bold shadow-xs'
                      : 'bg-mint-soft border border-line text-navy hover:bg-mint/60'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      batchChargeDecision === 'charged'
                        ? 'bg-navy text-white animate-pop-in'
                        : 'bg-page text-navy'
                    }`}
                  >
                    <AppIcon name="warning" size={14} weight="fill" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-navy block leading-tight">
                      {isEn ? 'Yes, Charge for all' : 'نعم، تُحسب على الكل'}
                    </span>
                    <span className="text-[10px] text-slate mt-1 block leading-tight font-medium">
                      {isEn ? 'Consumes 1 session credit' : 'تستهلك حصة من رصيد كل طالب'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBatchChargeDecision('free')}
                  className={`p-3.5 rounded-[18px] transition-all flex items-start gap-2.5 cursor-pointer text-start ${
                    batchChargeDecision === 'free'
                      ? 'bg-mint border-2 border-navy text-navy font-bold shadow-xs'
                      : 'bg-mint-soft border border-line text-navy hover:bg-mint/60'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      batchChargeDecision === 'free'
                        ? 'bg-navy text-white animate-pop-in'
                        : 'bg-page text-navy'
                    }`}
                  >
                    <AppIcon name="info" size={14} weight="fill" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-navy block leading-tight">
                      {isEn ? 'No, Excuse for all' : 'إعفاء جماعي'}
                    </span>
                    <span className="text-[10px] text-slate mt-1 block leading-tight font-medium">
                      {isEn ? 'No credits consumed' : 'لا تستهلك أي رصيد'}
                    </span>
                  </div>
                </button>
              </div>

              {/* Reasons if free */}
              {batchChargeDecision === 'free' && (
                <div className="p-3 bg-mist border border-line rounded-2xl space-y-2 animate-in fade-in">
                  <label className="block font-bold text-xs text-navy">
                    {isEn ? 'Reason for batch exemption:' : 'سبب عدم احتساب الحصة للكل:'}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {PREDEFINED_ABSENCE_REASONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setBatchReason(r)}
                        className={`chip px-2 text-[11px] ${batchReason === r ? 'chip-active' : ''}`}
                      >
                        {r}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setBatchReason(isEn ? 'Custom reason' : 'سبب مخصص')}
                      className={`chip px-2 text-[11px] ${batchReason === (isEn ? 'Custom reason' : 'سبب مخصص') ? 'chip-active' : ''}`}
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

              {/* Action Buttons: btn-soft cancel + btn-orange apply */}
              <div className="flex items-center gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsBatchAbsentConfirmOpen(false)}
                  className="btn-soft flex-1"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBatchAbsent}
                  className="btn-orange flex-1"
                >
                  {isEn ? 'Apply Batch Absence' : 'تطبيق الغياب للكل'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
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
    </>
  );
};
