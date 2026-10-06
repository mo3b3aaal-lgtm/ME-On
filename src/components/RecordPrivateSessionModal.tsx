import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Clock,
  BookOpen,
  Layers,
  CheckCircle2,
  Sparkles,
  Hash,
  AlignRight,
  Timer,
  Check,
  Plus,
  Minus,
  Zap,
  Bookmark,
  Calculator,
  Tag,
} from 'lucide-react';
import { Student, Enrollment, Group } from '../types';
import {
  db,
  roundMoney,
  multiplyMoney,
  divideMoney,
  formatMoney,
  formatSessionQuantityDisplay,
} from '../utils/storage';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import { useTranslation } from '../utils/i18n';

interface RecordPrivateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onSaveComplete: () => void;
}

export const RecordPrivateSessionModal: React.FC<RecordPrivateSessionModalProps> = ({
  isOpen,
  onClose,
  student,
  onSaveComplete,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');

  const PREDEFINED_REASONS = [
    isEn ? 'Student Cancelled' : 'الطالب ألغى',
    isEn ? 'Teacher Cancelled' : 'المدرس ألغى',
    isEn ? 'Illness / Medical' : 'مرض',
    isEn ? 'Emergency' : 'ظرف طارئ',
    isEn ? 'Other Reason' : 'سبب آخر',
  ];

  const todayStr = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  // Get private enrollments for this student
  const allEnrollments = db.getEnrollments();
  const allGroups = db.getGroups();

  const studentPrivateEnrollments = student
    ? allEnrollments.filter((enr) => {
        if (enr.studentId !== student.id) return false;
        const grp = allGroups.find((g) => g.id === enr.groupId);
        return enr.serviceType === 'private' || grp?.type === 'private';
      })
    : [];

  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>(() => {
    return studentPrivateEnrollments[0]?.id || '';
  });

  const [date, setDate] = useState<string>(todayStr);
  const [startTime, setStartTime] = useState<string>(nowTime || '16:00');
  const [sessionCount, setSessionCount] = useState<number>(1);
  const [hours, setHours] = useState<number>(1.5);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customInput, setCustomInput] = useState<string>('1');
  const [attendanceType, setAttendanceType] = useState<'present' | 'absent_charged' | 'absent_free' | 'cancelled'>('present');
  const [absenceReason, setAbsenceReason] = useState<string>(PREDEFINED_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Active private enrollment info
  const activeEnrollment =
    studentPrivateEnrollments.find((e) => e.id === selectedEnrollmentId) || studentPrivateEnrollments[0];
  const activeGroup = activeEnrollment ? allGroups.find((g) => g.id === activeEnrollment.groupId) : undefined;
  const finSummary = activeEnrollment ? db.calculateEnrollmentFinancials(activeEnrollment.id) : undefined;

  const isHourly =
    activeEnrollment?.billingMode === 'hourly' ||
    activeEnrollment?.billingType === 'hourly' ||
    activeGroup?.billingMode === 'hourly' ||
    activeGroup?.billingType === 'hourly';

  const hourlyRate =
    activeEnrollment?.hourlyRate ||
    activeGroup?.hourlyRate ||
    activeEnrollment?.customPrice ||
    activeGroup?.defaultPrice ||
    150;

  const isPackage =
    !isHourly &&
    (activeEnrollment?.billingMode === 'package' ||
      activeEnrollment?.billingType === 'package' ||
      activeGroup?.billingMode === 'package' ||
      activeGroup?.billingType === 'package');

  const isPrepaid =
    !isHourly &&
    !isPackage &&
    (activeEnrollment?.billingMode === 'prepaid' ||
      activeEnrollment?.billingType === 'prepaid' ||
      (activeEnrollment?.billingType === 'per_session' && activeEnrollment?.billingMode !== 'postpaid'));

  const isPostpaid =
    !isHourly &&
    !isPackage &&
    (activeEnrollment?.billingMode === 'postpaid' || activeEnrollment?.billingType === 'postpaid');

  const packageSessionsCount = isPackage
    ? activeEnrollment?.packageSessionsCount || activeGroup?.packageSessionsCount || 8
    : 8;

  const packageTotalPrice = isPackage
    ? activeEnrollment?.packagePrice ||
      (activeGroup?.billingMode === 'package' || activeGroup?.billingType === 'package'
        ? activeGroup.defaultPrice
        : undefined) ||
      activeEnrollment?.customPrice ||
      800
    : 800;

  // Effective Session Price
  const effectiveSessionPrice = isHourly
    ? hourlyRate
    : isPackage && packageSessionsCount > 0
    ? divideMoney(packageTotalPrice, packageSessionsCount)
    : activeEnrollment?.customPrice || activeGroup?.defaultPrice || 100;

  const isCharged = attendanceType === 'present' || attendanceType === 'absent_charged';

  // Smart Memory: Remember last quantity per student and billing mode
  const memoryStorageKey = useMemo(() => {
    if (!student) return null;
    return `classy_smart_memory_quantity_${student.id}_${isHourly ? 'hourly' : 'lesson'}`;
  }, [student, isHourly]);

  const [rememberedQuantity, setRememberedQuantity] = useState<number | null>(null);

  useEffect(() => {
    if (memoryStorageKey && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(memoryStorageKey);
        if (saved) {
          const parsed = parseFloat(saved);
          if (!isNaN(parsed) && parsed > 0) {
            setRememberedQuantity(parsed);
          }
        }
      } catch (e) {}
    }
  }, [memoryStorageKey, isOpen]);

  // Reset when opening
  useEffect(() => {
    if (isOpen) {
      if (studentPrivateEnrollments.length > 0 && !selectedEnrollmentId) {
        setSelectedEnrollmentId(studentPrivateEnrollments[0].id);
      }
      setDate(todayStr);
      setStartTime(nowTime || '16:00');
      setSessionCount(1);
      setHours(1.5);
      setCustomInput('1');
      setIsCustomMode(false);
      setNotes('');
    }
  }, [isOpen, studentPrivateEnrollments, selectedEnrollmentId, todayStr, nowTime]);

  // Stepper handlers
  const handleStepChange = (delta: number) => {
    if (isHourly) {
      const next = Math.max(0.5, roundMoney(hours + delta, 2));
      setHours(next);
      setCustomInput(String(next));
      setIsCustomMode(![0.5, 1, 1.5, 2, 2.5, 3].includes(next));
    } else {
      const next = Math.max(0.5, roundMoney(sessionCount + delta, 2));
      setSessionCount(next);
      setCustomInput(String(next));
      setIsCustomMode(![0.5, 1, 1.5, 2, 2.5, 3].includes(next));
    }
  };

  const handleSelectPreset = (val: number) => {
    if (isHourly) {
      setHours(val);
    } else {
      setSessionCount(val);
    }
    setCustomInput(String(val));
    setIsCustomMode(false);
  };

  const handleCustomChange = (valStr: string) => {
    setCustomInput(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      if (isHourly) {
        setHours(parsed);
      } else {
        setSessionCount(parsed);
      }
    }
  };

  const handleApplySmartMemory = () => {
    if (rememberedQuantity && rememberedQuantity > 0) {
      if (isHourly) {
        setHours(rememberedQuantity);
      } else {
        setSessionCount(rememberedQuantity);
      }
      setCustomInput(String(rememberedQuantity));
      setIsCustomMode(![0.5, 1, 1.5, 2, 2.5, 3].includes(rememberedQuantity));
    }
  };

  // Live Total Session Value
  const selectedQuantity = isHourly ? hours : sessionCount;
  const totalSessionValue = isCharged
    ? isHourly
      ? multiplyMoney(hours, hourlyRate)
      : multiplyMoney(sessionCount, effectiveSessionPrice)
    : 0;

  // Package Remaining Projection
  const packageProjection = useMemo(() => {
    if (!isPackage || !finSummary) return null;
    const baseUsed = finSummary.attendedSessionsCount || 0;
    const beforeRemaining = Math.max(0, roundMoney(packageSessionsCount - baseUsed, 2));
    const projectedUsed = roundMoney(baseUsed + (isCharged ? sessionCount : 0), 2);
    const afterRemaining = Math.max(0, roundMoney(packageSessionsCount - projectedUsed, 2));
    return {
      beforeRemaining,
      thisSessionUnits: sessionCount,
      projectedUsed,
      afterRemaining,
      total: packageSessionsCount,
    };
  }, [isPackage, finSummary, sessionCount, packageSessionsCount, isCharged]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    const count = isHourly ? 1 : Math.max(0.5, Number(sessionCount) || 1);
    setIsSubmitting(true);

    try {
      let targetGroupId = activeGroup?.id;
      let targetEnrollmentId = activeEnrollment?.id;

      if (!targetGroupId || !targetEnrollmentId) {
        const created = db.createPrivateLessonService(student.id, {
          subject: isEn ? 'Private Subject' : 'مادة الدرس الخاص',
          sessionPrice: 100,
          billingType: 'prepaid',
          billingMode: 'prepaid',
        });
        targetGroupId = created.group.id;
        targetEnrollmentId = created.enrollment.id;
      }

      const finalReason =
        attendanceType === 'absent_free' || attendanceType === 'cancelled'
          ? absenceReason === (isEn ? 'Other Reason' : 'سبب آخر')
            ? customReason.trim() || (isEn ? 'Other Reason' : 'سبب آخر')
            : absenceReason
          : undefined;

      // Save to Smart Memory
      const qtyToSave = isHourly ? hours : sessionCount;
      if (memoryStorageKey && typeof window !== 'undefined' && qtyToSave > 0) {
        try {
          localStorage.setItem(memoryStorageKey, String(qtyToSave));
        } catch (e) {}
      }

      db.recordPrivateSessionsForStudent({
        studentId: student.id,
        enrollmentId: targetEnrollmentId,
        groupId: targetGroupId,
        date: date || todayStr,
        startTime: startTime || '16:00',
        sessionCount: isHourly ? 1 : count,
        hours: isHourly ? hours : undefined,
        hourlyRate: isHourly ? hourlyRate : undefined,
        attendanceStatus: attendanceType,
        isCharged,
        absenceReason: finalReason,
        sessionStatus: attendanceType === 'cancelled' ? 'cancelled' : 'completed',
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onSaveComplete();
      onClose();
    } catch (err) {
      console.error('Error recording private sessions:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalLayer = useModalLayer('record-private-session', isOpen && !!student, onClose);

  if (!isOpen || !student) return null;

  return (
    <ModalPortal>
      <div
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-[#6B1E2B]/70 backdrop-blur-md flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#F8F2EA] border border-[#EADBC7] rounded-t-[32px] sm:rounded-[32px] max-w-lg w-full mx-auto max-h-[94vh] flex flex-col overflow-hidden shadow-2xl relative select-none-touch">
          {/* 1. Header with Smart Session Studio Badge */}
          <div className="p-5 bg-gradient-to-r from-[#6B1E2B] via-[#5C4033] to-[#6B1E2B] text-[#FAF7F2] flex items-center justify-between shrink-0 relative overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 relative z-10 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#6B1E2B] to-[#5C4033] text-[#FAF7F2] flex items-center justify-center shrink-0 shadow-md shadow-[#B56B45]/20 border border-[#EADBC7]/25">
                <Zap className="w-5 h-5 text-[#EADBC7] animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-[#FAF7F2] tracking-tight truncate">
                    {isEn ? 'Smart Session Studio' : 'استوديو رصد الحصة الذكي'}
                  </h2>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#FAF7F2]/20 text-[#FAF7F2] border border-[#EADBC7]/30">
                    {isHourly ? (isEn ? 'Hourly' : 'ساعات') : (isEn ? 'Lessons' : 'حصص')}
                  </span>
                </div>
                <p className="text-xs text-[#EADBC7]/85 font-medium truncate">
                  {isEn ? 'Student:' : 'الطالب:'} <strong className="text-[#FAF7F2] font-black">{student.name}</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-2xl bg-[#FAF7F2]/10 hover:bg-[#FAF7F2]/20 text-[#FAF7F2] border border-[#EADBC7]/20 transition-all cursor-pointer relative z-10 active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Scrollable Body */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto android-scrollbar flex-1 space-y-4 text-xs text-[#2F2F2F]">
            {/* Service / Enrollment Selector (If student has multiple private subjects) */}
            {studentPrivateEnrollments.length > 1 && (
              <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#EADBC7] space-y-1.5 shadow-2xs">
                <label className="font-bold text-[#69493C] text-[11px] flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#6B1E2B]" />
                  <span>{isEn ? 'Private Subject / Service:' : 'المادة / الخدمة الخاصة:'}</span>
                </label>
                <select
                  value={selectedEnrollmentId}
                  onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#F8F2EA] border border-[#EADBC7] font-black text-xs text-[#2F2F2F] focus:outline-none focus:border-[#6B1E2B]"
                >
                  {studentPrivateEnrollments.map((enr) => {
                    const grp = allGroups.find((g) => g.id === enr.groupId);
                    return (
                      <option key={enr.id} value={enr.id}>
                        {grp?.name || (isEn ? 'Private Lesson' : 'درس خاص')} - {enr.customPrice} {t('currency')}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Smart Memory Suggestion Banner */}
            {rememberedQuantity !== null && rememberedQuantity > 0 && rememberedQuantity !== selectedQuantity && (
              <div className="p-2.5 rounded-2xl bg-gradient-to-r from-[#F8F2EA] to-[#F8F2EA]/50 border border-[#EADBC7]/80 flex items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Bookmark className="w-4 h-4 text-[#B56B45] shrink-0" />
                  <span className="text-[11px] text-[#2F2F2F] font-bold truncate">
                    {isEn ? 'Last used quantity:' : 'الكمية السابقة:'}
                    <strong className="ms-1 text-[#B56B45] font-black">
                      {formatSessionQuantityDisplay(
                        isHourly ? { hours: rememberedQuantity, isHourly: true } : { sessionUnits: rememberedQuantity, isHourly: false },
                        isRTL
                      )}
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleApplySmartMemory}
                  className="px-2.5 py-1 rounded-xl bg-[#EADBC7]/700 hover:bg-[#B56B45] text-[#FAF7F2] text-[10px] font-black shrink-0 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  {isEn ? 'Repeat Last' : 'تكرار السابقة'}
                </button>
              </div>
            )}

            {/* Date & Time Row */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#EADBC7] space-y-1">
                <label className="font-bold text-[11px] text-[#69493C] flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#6B1E2B]" />
                  <span>{isEn ? 'Date:' : 'التاريخ:'}</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2 rounded-xl bg-[#F8F2EA] border border-[#EADBC7] font-black text-xs text-[#2F2F2F] focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#EADBC7] space-y-1">
                <label className="font-bold text-[11px] text-[#69493C] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#6B1E2B]" />
                  <span>{isEn ? 'Start Time:' : 'وقت البدء:'}</span>
                </label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-2 rounded-xl bg-[#F8F2EA] border border-[#EADBC7] font-black text-xs text-[#2F2F2F] focus:outline-none"
                />
              </div>
            </div>

            {/* A. INTERACTIVE QUANTITY CONTROLLER */}
            <div className="p-4 sm:p-5 rounded-3xl bg-[#FAF7F2] border border-[#EADBC7] shadow-xs space-y-4 text-center relative overflow-hidden">
              <span className="text-[11px] font-black text-[#69493C] block uppercase tracking-wider">
                {isHourly
                  ? (isEn ? 'Session Duration (Hours)' : 'مدة الحصة الفعلية (بالساعات)')
                  : (isEn ? 'Lesson Intake Quantity' : 'كمية الحصص المنفذة')}
              </span>

              {/* Central Hero Controller */}
              <div className="flex items-center justify-center gap-4 sm:gap-6 py-2">
                <button
                  type="button"
                  onClick={() => handleStepChange(-0.5)}
                  disabled={selectedQuantity <= 0.5}
                  className="w-12 h-12 rounded-2xl bg-[#F8F2EA] hover:bg-[#EADBC7] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-[#EADBC7] flex items-center justify-center text-[#2F2F2F] font-black transition-all shadow-2xs cursor-pointer"
                  title="- 0.5"
                >
                  <Minus className="w-5 h-5 text-[#6B1E2B]" />
                </button>

                <div className="min-w-[150px] p-3.5 rounded-3xl bg-gradient-to-b from-[#F8F2EA] to-[#EADBC7]/40 border border-[#6B1E2B]/30 shadow-inner">
                  <div className="text-3xl sm:text-4xl font-black text-[#2F2F2F] tracking-tight">
                    {selectedQuantity}
                  </div>
                  <div className="text-xs font-black text-[#6B1E2B] mt-0.5">
                    {formatSessionQuantityDisplay(
                      isHourly ? { hours: selectedQuantity, isHourly: true } : { sessionUnits: selectedQuantity, isHourly: false },
                      isRTL
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleStepChange(0.5)}
                  className="w-12 h-12 rounded-2xl bg-[#F8F2EA] hover:bg-[#EADBC7] active:scale-95 border border-[#EADBC7] flex items-center justify-center text-[#2F2F2F] font-black transition-all shadow-2xs cursor-pointer"
                  title="+ 0.5"
                >
                  <Plus className="w-5 h-5 text-[#6B1E2B]" />
                </button>
              </div>

              {/* Quick Segmented Presets */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[0.5, 1, 1.5, 2, 2.5, 3].map((val) => {
                  const isSel = !isCustomMode && selectedQuantity === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleSelectPreset(val)}
                      className={`py-2 px-1 rounded-2xl font-black text-xs transition-all border cursor-pointer ${
                        isSel
                          ? 'bg-[#6B1E2B] text-[#FAF7F2] border-[#6B1E2B] shadow-md shadow-[#5C4033]/20 scale-[1.02]'
                          : 'bg-[#F8F2EA] text-[#69493C] border-[#EADBC7] hover:border-[#6B1E2B]/40 hover:text-[#2F2F2F]'
                      }`}
                    >
                      {val} {isHourly ? (isEn ? 'h' : 'س') : (isEn ? 'L' : 'ح')}
                    </button>
                  );
                })}
              </div>

              {/* Custom Value Mode */}
              <div className="pt-2 border-t border-[#EADBC7]/60 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsCustomMode(!isCustomMode)}
                  className={`text-[11px] font-black flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isCustomMode ? 'text-[#6B1E2B]' : 'text-[#69493C] hover:text-[#2F2F2F]'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Custom Value Input' : 'إدخال كمية مخصصة'}</span>
                </button>

                {isCustomMode && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      max="24"
                      value={customInput}
                      onChange={(e) => handleCustomChange(e.target.value)}
                      placeholder="e.g. 1.25"
                      className="w-24 p-1.5 text-center rounded-xl bg-[#F8F2EA] border border-[#6B1E2B] font-black text-xs text-[#2F2F2F] focus:outline-none"
                    />
                    <span className="text-[11px] font-bold text-[#69493C]">
                      {isHourly ? (isEn ? 'hours' : 'ساعة') : (isEn ? 'lessons' : 'حصة')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Attendance Status Selection */}
            <div className="p-4 rounded-3xl bg-[#FAF7F2] border border-[#EADBC7] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-black text-[#2F2F2F] text-xs">{isEn ? 'Attendance Status:' : 'حالة الحضور والاحتساب:'}</span>
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                  isCharged ? 'bg-[#F8F2EA] text-[#5C4033] border border-[#B68A4C]' : 'bg-[#F8F2EA] text-[#69493C] border border-[#EADBC7]'
                }`}>
                  {isCharged ? (isEn ? 'Charged (Consumes Credit)' : 'محسوبة (تستهلك رصيد)') : (isEn ? 'Exempt (Free)' : 'غير محسوبة (معفية)')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAttendanceType('present')}
                  className={`p-2.5 rounded-2xl text-xs font-black border text-center transition-all cursor-pointer ${
                    attendanceType === 'present'
                      ? 'bg-[#5C4033] text-[#FAF7F2] border-[#5C4033] shadow-sm'
                      : 'bg-[#F8F2EA] text-[#2F2F2F] border-[#EADBC7]'
                  }`}
                >
                  ✓ {isEn ? 'Present' : 'حاضر (مستهلكة)'}
                </button>

                <button
                  type="button"
                  onClick={() => setAttendanceType('absent_charged')}
                  className={`p-2.5 rounded-2xl text-xs font-black border text-center transition-all cursor-pointer ${
                    attendanceType === 'absent_charged'
                      ? 'bg-[#B56B45] text-[#FAF7F2] border-[#B56B45] shadow-sm'
                      : 'bg-[#F8F2EA] text-[#2F2F2F] border-[#EADBC7]'
                  }`}
                >
                  ⚠️ {isEn ? 'Absent (Charged)' : 'غائب (محسوبة)'}
                </button>

                <button
                  type="button"
                  onClick={() => setAttendanceType('absent_free')}
                  className={`p-2.5 rounded-2xl text-xs font-black border text-center transition-all cursor-pointer ${
                    attendanceType === 'absent_free'
                      ? 'bg-[#6B1E2B] text-[#FAF7F2] border-[#6B1E2B] shadow-sm'
                      : 'bg-[#F8F2EA] text-[#2F2F2F] border-[#EADBC7]'
                  }`}
                >
                  ℹ️ {isEn ? 'Absent (Free)' : 'غائب (غير محسوبة)'}
                </button>

                <button
                  type="button"
                  onClick={() => setAttendanceType('cancelled')}
                  className={`p-2.5 rounded-2xl text-xs font-black border text-center transition-all cursor-pointer ${
                    attendanceType === 'cancelled'
                      ? 'bg-[#69493C] text-[#FAF7F2] border-[#69493C] shadow-sm'
                      : 'bg-[#F8F2EA] text-[#2F2F2F] border-[#EADBC7]'
                  }`}
                >
                  ✕ {isEn ? 'Cancelled' : 'حصة ملغاة'}
                </button>
              </div>
            </div>

            {/* B. LIVE FINANCIAL IMPACT PANEL */}
            <div className="p-4 rounded-3xl bg-gradient-to-br from-[#FAF7F2] via-[#F8F2EA] to-[#FAF7F2] border border-[#EADBC7] shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#EADBC7] pb-2">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-[#6B1E2B]" />
                  <span className="font-black text-xs text-[#2F2F2F]">
                    {isEn ? 'Live Financial Impact' : 'الأثر المالي المباشر'}
                  </span>
                </div>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#EADBC7] text-[#5C4033]">
                  {isPrepaid
                    ? (isEn ? 'Prepaid (Auto-settled)' : 'مسبق (تسوية فورية)')
                    : isPackage
                    ? (isEn ? 'Package Consumption' : 'خصم من الباقة')
                    : isHourly
                    ? (isEn ? 'Hourly Rate' : 'حساب بالساعة')
                    : (isEn ? 'Postpaid Session' : 'حساب بالحصة')}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-start">
                <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#EADBC7] space-y-0.5">
                  <span className="text-[10px] text-[#69493C] block font-bold">
                    {isHourly ? (isEn ? 'Hourly Rate' : 'سعر الساعة') : (isEn ? 'Price / Lesson' : 'سعر الحصة')}
                  </span>
                  <strong className="text-sm font-black text-[#2F2F2F] block">
                    {effectiveSessionPrice} {t('currency')}
                  </strong>
                </div>

                <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#EADBC7] space-y-0.5">
                  <span className="text-[10px] text-[#69493C] block font-bold">
                    {isEn ? 'Session Total' : 'إجمالي قيمة الحصة'}
                  </span>
                  <strong className="text-sm font-black text-[#5C4033] block">
                    {totalSessionValue} {t('currency')}
                  </strong>
                </div>

                <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-[#FAF7F2] border border-[#EADBC7] space-y-0.5">
                  <span className="text-[10px] text-[#69493C] block font-bold">
                    {isEn ? 'Outstanding Dues' : 'الرصيد المتبقي على الطالب'}
                  </span>
                  <strong
                    className={`text-sm font-black block ${
                      (finSummary?.remaining || 0) > 0 ? 'text-[#B56B45]' : 'text-[#5C4033]'
                    }`}
                  >
                    {finSummary?.remaining || 0} {t('currency')}
                  </strong>
                </div>
              </div>
            </div>

            {/* C. BEFORE & AFTER PACKAGE PROGRESS */}
            {packageProjection && (
              <div className="p-4 rounded-3xl bg-gradient-to-br from-[#6B1E2B]/5 via-[#F8F2EA] to-[#B68A4C]/5 border border-[#6B1E2B]/30 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#6B1E2B]" />
                    <span className="font-black text-xs text-[#2F2F2F]">
                      {isEn ? 'Package Progress (Before & After)' : 'تطور رصيد الباقة (قبل وبعد الرصد)'}
                    </span>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#EADBC7] text-[#6B1E2B]">
                    {packageProjection.total} {isEn ? 'Lessons Package' : 'حصص في الباقة'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="p-2.5 rounded-2xl bg-[#FAF7F2] border border-[#EADBC7] space-y-1">
                    <span className="text-[10px] font-bold text-[#69493C] block">
                      {isEn ? 'Before' : 'قبل الرصد'}
                    </span>
                    <strong className="text-xs font-black text-[#2F2F2F] block">
                      {packageProjection.beforeRemaining} {isEn ? 'rem.' : 'متبقية'}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-[#6B1E2B]/10 border border-[#6B1E2B]/40 space-y-1">
                    <span className="text-[10px] font-bold text-[#6B1E2B] block">
                      {isEn ? 'This Session' : 'هذه الحصة'}
                    </span>
                    <strong className="text-xs font-black text-[#6B1E2B] block">
                      -{packageProjection.thisSessionUnits} {isEn ? 'lessons' : 'حصة'}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-[#EADBC7]/65 border border-[#B68A4C]/50 space-y-1">
                    <span className="text-[10px] font-bold text-[#5C4033] block">
                      {isEn ? 'After' : 'بعد الرصد'}
                    </span>
                    <strong className="text-xs font-black text-[#5C4033] block">
                      {packageProjection.afterRemaining} {isEn ? 'rem.' : 'متبقية'}
                    </strong>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="h-2.5 w-full bg-[#EADBC7] rounded-full overflow-hidden flex">
                    <div
                      style={{
                        width: `${Math.min(100, (packageProjection.projectedUsed / packageProjection.total) * 100)}%`,
                      }}
                      className="bg-gradient-to-r from-[#6B1E2B] to-[#B56B45] h-full transition-all duration-300"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#69493C] font-bold">
                    <span>{packageProjection.projectedUsed} {isEn ? 'consumed' : 'مستهلك'}</span>
                    <span>{packageProjection.afterRemaining} {isEn ? 'remaining' : 'متبقي'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Optional Notes */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-[#69493C]">
                {isEn ? 'Notes (Optional):' : 'ملاحظات (اختياري):'}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isEn ? 'Topics covered, homework, remarks...' : 'الموضوعات المغطاة، الواجب، ملاحظات المعلم...'}
                className="w-full p-2.5 rounded-2xl bg-[#FAF7F2] border border-[#EADBC7] text-xs font-medium text-[#2F2F2F] focus:outline-none focus:border-[#6B1E2B] resize-none h-16"
              />
            </div>

            {/* Footer Buttons */}
            <div className="p-2 pt-3 flex items-center justify-between gap-3 border-t border-[#EADBC7]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl bg-[#F8F2EA] hover:bg-[#EADBC7] text-[#69493C] font-bold text-xs cursor-pointer"
              >
                {t('cancel')}
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-[#6B1E2B] via-[#5C4033] to-[#69493C] hover:from-[#5C4033] hover:to-[#5C4033] text-[#FAF7F2] font-black text-xs sm:text-sm shadow-md shadow-[#6B1E2B]/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? (isEn ? 'Saving...' : 'جاري الحفظ...')
                    : isEn
                    ? `Save & Confirm (${formatSessionQuantityDisplay(
                        isHourly ? { hours, isHourly: true } : { sessionUnits: sessionCount, isHourly: false },
                        isRTL
                      )})`
                    : `حفظ وتأكيد (${formatSessionQuantityDisplay(
                        isHourly ? { hours, isHourly: true } : { sessionUnits: sessionCount, isHourly: false },
                        isRTL
                      )})`}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};
