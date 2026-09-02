import React, { useState, useEffect } from 'react';
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

interface RecordAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  onSaveComplete: () => void;
}

interface StudentAttendanceRecord {
  status: AttendanceStatus;
  isCharged: boolean;
  absenceReason: string;
  homeworkDone: boolean;
  notes: string;
}

const PREDEFINED_ABSENCE_REASONS = [
  'الطالب ألغى',
  'المدرس ألغى',
  'مرض',
  'ظرف طارئ',
  'سبب آخر',
];

export const RecordAttendanceModal: React.FC<RecordAttendanceModalProps> = ({
  isOpen,
  onClose,
  session,
  onSaveComplete,
}) => {
  if (!isOpen || !session) return null;

  const group = db.getGroupById(session.groupId);
  const enrolledStudents = db.getGroupStudents(session.groupId);
  const existingAttendance = db.getSessionAttendance(session.id);
  const allEnrollments = db.getGroupEnrollments(session.groupId);

  // Local state for attendance records mapping: studentId -> StudentAttendanceRecord
  const [records, setRecords] = useState<Record<string, StudentAttendanceRecord>>({});

  // Confirmation dialog state for individual student absence
  const [confirmingStudent, setConfirmingStudent] = useState<Student | null>(null);
  const [selectedChargeDecision, setSelectedChargeDecision] = useState<'charged' | 'free' | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>('الطالب ألغى');
  const [customReasonText, setCustomReasonText] = useState<string>('');

  // Batch confirmation dialog state
  const [isBatchAbsentConfirmOpen, setIsBatchAbsentConfirmOpen] = useState(false);
  const [batchChargeDecision, setBatchChargeDecision] = useState<'charged' | 'free'>('charged');
  const [batchReason, setBatchReason] = useState<string>('المدرس ألغى');
  const [batchCustomReason, setBatchCustomReason] = useState<string>('');

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
          absenceReason: found.absenceReason || found.notes || '',
          homeworkDone: found.homeworkDone ?? true,
          notes: found.notes || '',
        };
      } else {
        map[st.id] = {
          status: 'present',
          isCharged: true,
          absenceReason: '',
          homeworkDone: true,
          notes: '',
        };
      }
    }
    setRecords(map);
  }, [session, isOpen]);

  // Handle clicking "حاضر"
  const markPresent = (studentId: string) => {
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
        setSelectedReason('سبب مخصص');
        setCustomReasonText(currentRec.absenceReason);
      } else {
        setSelectedReason('الطالب ألغى');
        setCustomReasonText('');
      }
    } else if (currentRec && (currentRec.status === 'absent_charged' || currentRec.status === 'absent')) {
      setSelectedChargeDecision('charged');
      setSelectedReason('الطالب ألغى');
      setCustomReasonText('');
    } else {
      // Default: require explicit selection
      setSelectedChargeDecision(null);
      setSelectedReason('الطالب ألغى');
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
      if (selectedReason === 'سبب مخصص') {
        finalReason = customReasonText.trim() || 'سبب مخصص';
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
        notes: finalReason ? `سبب عدم الاحتساب: ${finalReason}` : '',
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
      if (batchReason === 'سبب مخصص') {
        finalReason = batchCustomReason.trim() || 'سبب مخصص';
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
          notes: finalReason ? `سبب عدم الاحتساب: ${finalReason}` : '',
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
        absenceReason: item.absenceReason,
        homeworkDone: item.homeworkDone,
        notes: item.notes || item.absenceReason,
        recordedAt: new Date().toISOString(),
      });
    });

    // Mark session as completed
    if (session.status !== 'completed' && session.status !== 'cancelled') {
      db.saveSession({
        ...session,
        status: 'completed',
      });
    }

    db.saveAttendanceBatch(session.id, listToSave);
    onSaveComplete();
    onClose();
  };

  // Summary counts
  const recordValues = Object.values(records) as StudentAttendanceRecord[];
  const presentCount = recordValues.filter((r) => r.status === 'present' || r.status === 'late').length;
  const chargedAbsentCount = recordValues.filter((r) => r.status === 'absent_charged' || (r.status === 'absent' && r.isCharged !== false)).length;
  const freeAbsentCount = recordValues.filter((r) => r.status === 'absent_free' || r.status === 'excused' || (r.status === 'absent' && r.isCharged === false)).length;

  return (
    <div className="fixed inset-0 z-50 bg-[#2D332A]/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200" dir="rtl">
      <div className="bg-[#F9F7F2] border border-[#E8E2D6] rounded-t-3xl sm:rounded-[32px] max-w-lg w-full mx-auto max-h-[94vh] flex flex-col overflow-hidden shadow-2xl relative">
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-[#E8E2D6] bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-[#748C70] text-white shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#2D332A]">
                رصد الحضور واستهلاك الحصص
              </h2>
              <p className="text-[11px] text-[#8A9187] font-medium">
                {group?.name} • {session.title || 'حصة بدون عنوان'} ({session.date})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-[#F2ECE1] text-[#6B7567] hover:text-[#2D332A] hover:bg-[#EAE5D8] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Batch Actions & Stats Bar */}
        <div className="p-3 bg-[#E8E2D6]/40 border-b border-[#E8E2D6] flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={setAllPresent}
              className="px-2.5 py-1 rounded-xl bg-white border border-[#E8E2D6] text-[#748C70] font-bold hover:bg-[#748C70] hover:text-white transition-all shadow-xs flex items-center gap-1"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>الكل حاضر</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setBatchChargeDecision('charged');
                setBatchReason('المدرس ألغى');
                setBatchCustomReason('');
                setIsBatchAbsentConfirmOpen(true);
              }}
              className="px-2.5 py-1 rounded-xl bg-white border border-[#E8E2D6] text-[#C97C5D] font-bold hover:bg-[#C97C5D] hover:text-white transition-all shadow-xs flex items-center gap-1"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>الكل غائب</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-bold text-[#6B7567]">
            <span className="text-[#748C70]">حاضر: {presentCount}</span>
            <span>•</span>
            <span className="text-[#C97C5D]">محسوبة: {chargedAbsentCount}</span>
            <span>•</span>
            <span className="text-[#8A9187]">غير محسوبة: {freeAbsentCount}</span>
          </div>
        </div>

        {/* Students List */}
        <div className="p-4 overflow-y-auto android-scrollbar flex-1 space-y-2.5">
          {enrolledStudents.length === 0 ? (
            <div className="p-8 text-center text-[#8A9187] space-y-2">
              <Users className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-xs">لا يوجد طلاب مسجلين في هذه المجموعة حالياً.</p>
            </div>
          ) : (
            enrolledStudents.map((student) => {
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
                  className={`p-3 rounded-2xl bg-white border transition-all shadow-xs space-y-2.5 ${
                    isAbsent
                      ? currentRecord.isCharged
                        ? 'border-[#C97C5D]/40 bg-[#C97C5D]/5'
                        : 'border-[#8A9187]/40 bg-[#8A9187]/5'
                      : 'border-[#E8E2D6]'
                  }`}
                >
                  {/* Top Row: Name + Credit Badge + Homework Checkbox */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-xs shrink-0"
                        style={{ backgroundColor: student.avatarColor || '#748C70' }}
                      >
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-[#2D332A] text-xs leading-tight">{student.name}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                              credit <= 0
                                ? 'bg-[#C97C5D]/15 text-[#C97C5D]'
                                : 'bg-[#748C70]/15 text-[#748C70]'
                            }`}
                          >
                            رصيد: {credit} حصص
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Homework toggle */}
                    <button
                      type="button"
                      onClick={() => toggleHomework(student.id)}
                      className={`px-2 py-1 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1 ${
                        currentRecord.homeworkDone
                          ? 'bg-[#748C70]/15 text-[#748C70] border-[#748C70]/30'
                          : 'bg-[#F2ECE1] text-[#8A9187] border-[#E8E2D6]'
                      }`}
                    >
                      <BookCheck className="w-3.5 h-3.5" />
                      <span>{currentRecord.homeworkDone ? 'حل الواجب' : 'لم يحل'}</span>
                    </button>
                  </div>

                  {/* Attendance Status Buttons Grid */}
                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    
                    {/* 1. Present */}
                    <button
                      type="button"
                      onClick={() => markPresent(student.id)}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                        currentRecord.status === 'present'
                          ? 'bg-[#748C70] text-white border-[#748C70] shadow-xs'
                          : 'bg-[#F9F7F2] text-[#434B3E] border-[#E8E2D6] hover:bg-[#EAE5D8]'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>حاضر</span>
                    </button>

                    {/* 2. Late */}
                    <button
                      type="button"
                      onClick={() => markLate(student.id)}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                        currentRecord.status === 'late'
                          ? 'bg-[#DDA15E] text-white border-[#DDA15E] shadow-xs'
                          : 'bg-[#F9F7F2] text-[#434B3E] border-[#E8E2D6] hover:bg-[#EAE5D8]'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>متأخر</span>
                    </button>

                    {/* 3. Absent Trigger (opens confirmation modal) */}
                    <button
                      type="button"
                      onClick={() => openAbsenceModal(student)}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                        isAbsent
                          ? currentRecord.isCharged
                            ? 'bg-[#C97C5D] text-white border-[#C97C5D] shadow-xs'
                            : 'bg-[#8A9187] text-white border-[#8A9187] shadow-xs'
                          : 'bg-[#F9F7F2] text-[#C97C5D] border-[#E8E2D6] hover:bg-[#EAE5D8]'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>غائب</span>
                    </button>

                  </div>

                  {/* Zero credit warning for prepaid charged students */}
                  {enr && (enr.billingMode === 'prepaid' || enr.billingType === 'prepaid' || (enr.billingType === 'per_session' && enr.billingMode !== 'postpaid')) && credit <= 0 && currentRecord.isCharged && (
                    <div className="p-2 bg-[#C97C5D]/15 text-[#C97C5D] border border-[#C97C5D]/30 rounded-xl text-[11px] font-medium flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>تنبيه: لا يوجد رصيد حصص كافٍ لهذا الطالب (الرصيد: 0). سيتم حفظ الحضور وتسجيل الحصة كمستحقة للدفع بقيمة {enr.customPrice || 100} ج.م دون جعل الرصيد سالباً.</span>
                    </div>
                  )}

                  {/* Absent Detail Sub-badge with edit button */}
                  {isAbsent && (
                    <div
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-[11px] ${
                        currentRecord.isCharged
                          ? 'bg-[#C97C5D]/10 border-[#C97C5D]/30 text-[#A85B3F]'
                          : 'bg-[#8A9187]/10 border-[#8A9187]/30 text-[#434B3E]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {currentRecord.isCharged ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-[#C97C5D] shrink-0" />
                            <span className="font-bold">حصة محسوبة:</span>
                            <span>تستهلك رصيد حصة أو تُضاف للمستحقات</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-[#8A9187] shrink-0" />
                            <span className="font-bold">غير محسوبة:</span>
                            <span className="font-medium text-[#2D332A]">
                              السبب: {currentRecord.absenceReason || 'معفي'}
                            </span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => openAbsenceModal(student)}
                        className="px-2 py-0.5 rounded-lg bg-white border border-[#E8E2D6] text-[10px] font-bold text-[#2D332A] hover:bg-[#F2ECE1] transition-colors shrink-0 flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3 text-[#748C70]" />
                        <span>تعديل</span>
                      </button>
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>

        {/* Footer with Save Action */}
        <div className="p-4 bg-white border-t border-[#E8E2D6] flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-[#E8E2D6] bg-white text-[#6B7567] font-bold text-xs hover:bg-[#F2ECE1] transition-all"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3 rounded-2xl bg-[#748C70] hover:bg-[#60755C] text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>حفظ الحضور وتحديث الأرصدة</span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* INDIVIDUAL STUDENT ABSENCE CONFIRMATION MODAL */}
        {/* ========================================================= */}
        {confirmingStudent && (
          <div className="absolute inset-0 z-50 bg-[#2D332A]/70 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-3 animate-in fade-in duration-150">
            <div className="bg-white border border-[#E8E2D6] rounded-3xl p-4 sm:p-5 max-w-md w-full mx-auto space-y-4 shadow-2xl">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#E8E2D6] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#C97C5D]/15 text-[#C97C5D]">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#2D332A]">
                      تسجيل غياب الطالب
                    </h3>
                    <p className="text-xs text-[#748C70] font-bold">
                      {confirmingStudent.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmingStudent(null)}
                  className="p-1 rounded-full text-[#8A9187] hover:text-[#2D332A] hover:bg-[#F2ECE1]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Main Question */}
              <div className="space-y-1.5">
                <label className="block font-bold text-xs text-[#2D332A]">
                  هل تريد احتساب الحصة على الطالب؟
                </label>
                <p className="text-[11px] text-[#8A9187]">
                  حدد ما إذا كانت الحصة ستُحسب ماليًا وتستهلك رصيد حصص أو تكون معفية.
                </p>
              </div>

              {/* 2 Primary Choices */}
              <div className="grid grid-cols-1 gap-2.5">
                
                {/* Option 1: Yes, Charged */}
                <button
                  type="button"
                  onClick={() => setSelectedChargeDecision('charged')}
                  className={`p-3 rounded-2xl border text-right transition-all flex items-start gap-2.5 ${
                    selectedChargeDecision === 'charged'
                      ? 'bg-[#C97C5D]/10 border-[#C97C5D] ring-2 ring-[#C97C5D]/20 shadow-xs'
                      : 'bg-[#F9F7F2] border-[#E8E2D6] hover:bg-white'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedChargeDecision === 'charged'
                        ? 'border-[#C97C5D] bg-[#C97C5D] text-white'
                        : 'border-[#8A9187] bg-white'
                    }`}
                  >
                    {selectedChargeDecision === 'charged' && <Check className="w-3 h-3" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-[#2D332A] block">
                      نعم، تُحسب عليه
                    </span>
                    <span className="text-[11px] text-[#6B7567] mt-0.5 block leading-relaxed">
                      تستهلك حصة من رصيد الحصص (Session Credit) إن كان لديه رصيد، أو تدخل في الحصص المستحقة حسب نظام المحاسبة.
                    </span>
                  </div>
                </button>

                {/* Option 2: No, Free (Exempt) */}
                <button
                  type="button"
                  onClick={() => setSelectedChargeDecision('free')}
                  className={`p-3 rounded-2xl border text-right transition-all flex items-start gap-2.5 ${
                    selectedChargeDecision === 'free'
                      ? 'bg-[#748C70]/10 border-[#748C70] ring-2 ring-[#748C70]/20 shadow-xs'
                      : 'bg-[#F9F7F2] border-[#E8E2D6] hover:bg-white'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedChargeDecision === 'free'
                        ? 'border-[#748C70] bg-[#748C70] text-white'
                        : 'border-[#8A9187] bg-white'
                    }`}
                  >
                    {selectedChargeDecision === 'free' && <Check className="w-3 h-3" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-[#2D332A] block">
                      لا، لا تُحسب عليه
                    </span>
                    <span className="text-[11px] text-[#6B7567] mt-0.5 block leading-relaxed">
                      لا تستهلك من رصيد الحصص ولا تضيف أي قيمة للمستحقات المالية (غياب معفي).
                    </span>
                  </div>
                </button>

              </div>

              {/* Absence Reason Selector (Shown only if decision is 'free') */}
              {selectedChargeDecision === 'free' && (
                <div className="p-3 bg-[#F9F7F2] border border-[#E8E2D6] rounded-2xl space-y-2 animate-in fade-in duration-150">
                  <label className="block font-bold text-xs text-[#2D332A]">
                    يرجى تسجيل سبب عدم احتساب الحصة: *
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {PREDEFINED_ABSENCE_REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setSelectedReason(reason)}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all text-center ${
                          selectedReason === reason
                            ? 'bg-[#748C70] text-white border-[#748C70] shadow-xs'
                            : 'bg-white text-[#434B3E] border-[#E8E2D6] hover:bg-[#EAE5D8]'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedReason('سبب مخصص')}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all text-center ${
                        selectedReason === 'سبب مخصص'
                          ? 'bg-[#748C70] text-white border-[#748C70] shadow-xs'
                          : 'bg-white text-[#434B3E] border-[#E8E2D6] hover:bg-[#EAE5D8]'
                      }`}
                    >
                      سبب مخصص
                    </button>
                  </div>

                  {selectedReason === 'سبب مخصص' && (
                    <div className="pt-1">
                      <input
                        type="text"
                        autoFocus
                        placeholder="اكتب سبب الغياب المعفي بالتفصيل..."
                        value={customReasonText}
                        onChange={(e) => setCustomReasonText(e.target.value)}
                        className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#E8E2D6]">
                <button
                  type="button"
                  onClick={() => setConfirmingStudent(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E8E2D6] bg-white text-[#6B7567] font-bold text-xs hover:bg-[#F2ECE1]"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={!selectedChargeDecision || (selectedChargeDecision === 'free' && selectedReason === 'سبب مخصص' && !customReasonText.trim())}
                  onClick={handleConfirmAbsence}
                  className="flex-1 py-2.5 rounded-xl bg-[#748C70] hover:bg-[#60755C] disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all"
                >
                  تأكيد الغياب
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* BATCH ABSENCE CONFIRMATION MODAL */}
        {/* ========================================================= */}
        {isBatchAbsentConfirmOpen && (
          <div className="absolute inset-0 z-50 bg-[#2D332A]/70 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-3 animate-in fade-in duration-150">
            <div className="bg-white border border-[#E8E2D6] rounded-3xl p-4 sm:p-5 max-w-md w-full mx-auto space-y-4 shadow-2xl">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#E8E2D6] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#C97C5D]/15 text-[#C97C5D]">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#2D332A]">
                      تسجيل غياب جميع الطلاب ({enrolledStudents.length})
                    </h3>
                    <p className="text-xs text-[#8A9187]">
                      تحديد معاملة الغياب الجماعي
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBatchAbsentConfirmOpen(false)}
                  className="p-1 rounded-full text-[#8A9187] hover:text-[#2D332A] hover:bg-[#F2ECE1]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Main Question */}
              <div className="space-y-1.5">
                <label className="block font-bold text-xs text-[#2D332A]">
                  هل تريد احتساب الحصة على جميع الطلاب؟
                </label>
              </div>

              {/* 2 Primary Choices */}
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setBatchChargeDecision('charged')}
                  className={`p-3 rounded-2xl border text-right transition-all flex items-start gap-2.5 ${
                    batchChargeDecision === 'charged'
                      ? 'bg-[#C97C5D]/10 border-[#C97C5D] ring-2 ring-[#C97C5D]/20'
                      : 'bg-[#F9F7F2] border-[#E8E2D6]'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      batchChargeDecision === 'charged'
                        ? 'border-[#C97C5D] bg-[#C97C5D] text-white'
                        : 'border-[#8A9187] bg-white'
                    }`}
                  >
                    {batchChargeDecision === 'charged' && <Check className="w-3 h-3" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-[#2D332A] block">
                      نعم، تُحسب على الكل
                    </span>
                    <span className="text-[11px] text-[#6B7567] mt-0.5 block">
                      تستهلك حصة من رصيد كل طالب أو تدخل في مستحقاته.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBatchChargeDecision('free')}
                  className={`p-3 rounded-2xl border text-right transition-all flex items-start gap-2.5 ${
                    batchChargeDecision === 'free'
                      ? 'bg-[#748C70]/10 border-[#748C70] ring-2 ring-[#748C70]/20'
                      : 'bg-[#F9F7F2] border-[#E8E2D6]'
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      batchChargeDecision === 'free'
                        ? 'border-[#748C70] bg-[#748C70] text-white'
                        : 'border-[#8A9187] bg-white'
                    }`}
                  >
                    {batchChargeDecision === 'free' && <Check className="w-3 h-3" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-[#2D332A] block">
                      لا، لا تُحسب على أي طالب (إعفاء جماعي)
                    </span>
                    <span className="text-[11px] text-[#6B7567] mt-0.5 block">
                      لا تستهلك أي رصيد ولا تضيف أي مبالغ للمستحقات.
                    </span>
                  </div>
                </button>
              </div>

              {/* Reasons if free */}
              {batchChargeDecision === 'free' && (
                <div className="p-3 bg-[#F9F7F2] border border-[#E8E2D6] rounded-2xl space-y-2 animate-in fade-in">
                  <label className="block font-bold text-xs text-[#2D332A]">
                    سبب عدم احتساب الحصة للكل:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {PREDEFINED_ABSENCE_REASONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setBatchReason(r)}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all text-center ${
                          batchReason === r
                            ? 'bg-[#748C70] text-white border-[#748C70]'
                            : 'bg-white text-[#434B3E] border-[#E8E2D6]'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setBatchReason('سبب مخصص')}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all text-center ${
                        batchReason === 'سبب مخصص'
                          ? 'bg-[#748C70] text-white border-[#748C70]'
                          : 'bg-white text-[#434B3E] border-[#E8E2D6]'
                      }`}
                    >
                      سبب مخصص
                    </button>
                  </div>

                  {batchReason === 'سبب مخصص' && (
                    <input
                      type="text"
                      placeholder="اكتب السبب الجماعي المخصص..."
                      value={batchCustomReason}
                      onChange={(e) => setBatchCustomReason(e.target.value)}
                      className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none"
                    />
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#E8E2D6]">
                <button
                  type="button"
                  onClick={() => setIsBatchAbsentConfirmOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E8E2D6] bg-white text-[#6B7567] font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBatchAbsent}
                  className="flex-1 py-2.5 rounded-xl bg-[#748C70] hover:bg-[#60755C] text-white font-bold text-xs"
                >
                  تطبيق الغياب للكل
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
