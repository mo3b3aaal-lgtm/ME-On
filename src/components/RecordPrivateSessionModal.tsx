import React, { useState, useEffect, useMemo } from 'react';
import {
  Student,
  Enrollment,
  Group,
  BehaviorRating,
  HomeworkRating,
  getBehaviorRatingLabel,
  getHomeworkRatingLabel,
} from '../types';
import {
  db,
  roundMoney,
  multiplyMoney,
  divideMoney,
  formatMoney,
  formatSessionQuantityDisplay,
} from '../utils/storage';
import { useTranslation } from '../utils/i18n';
import { toLocalISODate } from '../utils/localDate';
import { BottomSheet } from './ui/BottomSheet';
import { AttendanceChoiceTiles } from './ui/AttendanceChoiceTiles';
import { AppIcon, AppIconName } from './ui/AppIcon';
import { triggerSelectionHaptic } from '../utils/haptics';

const STUDIO_BEHAVIOR_OPTIONS: {
  value: BehaviorRating;
  labelAr: string;
  labelEn: string;
  icon: AppIconName;
  activeClass: string;
  idleIconClass: string;
}[] = [
  {
    value: 'excellent',
    labelAr: 'ممتاز',
    labelEn: 'Excellent',
    icon: 'star',
    activeClass: 'bg-navy text-white border-navy shadow-sm ring-2 ring-navy/20',
    idleIconClass: 'bg-mint-soft text-navy',
  },
  {
    value: 'very_good',
    labelAr: 'جيد جدًا',
    labelEn: 'Very Good',
    icon: 'medal',
    activeClass: 'bg-teal text-white border-teal shadow-sm ring-2 ring-teal/20',
    idleIconClass: 'bg-teal/10 text-teal',
  },
  {
    value: 'good',
    labelAr: 'جيد',
    labelEn: 'Good',
    icon: 'checkCircle',
    activeClass: 'bg-navy-soft text-white border-navy-soft shadow-sm ring-2 ring-navy-soft/20',
    idleIconClass: 'bg-navy/5 text-navy',
  },
  {
    value: 'needs_improvement',
    labelAr: 'يحتاج إلى تحسين',
    labelEn: 'Needs Improvement',
    icon: 'info',
    activeClass: 'bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-600/20',
    idleIconClass: 'bg-amber-500/15 text-amber-700',
  },
];

const STUDIO_HOMEWORK_OPTIONS: {
  value: HomeworkRating;
  labelAr: string;
  labelEn: string;
  icon: AppIconName;
  activeClass: string;
  idleIconClass: string;
}[] = [
  {
    value: 'completed',
    labelAr: 'مكتمل',
    labelEn: 'Completed',
    icon: 'checkCircle',
    activeClass: 'bg-navy text-white border-navy shadow-sm ring-2 ring-navy/20',
    idleIconClass: 'bg-mint-soft text-navy',
  },
  {
    value: 'partially_completed',
    labelAr: 'مكتمل جزئيًا',
    labelEn: 'Partially Completed',
    icon: 'clock',
    activeClass: 'bg-teal text-white border-teal shadow-sm ring-2 ring-teal/20',
    idleIconClass: 'bg-teal/10 text-teal',
  },
  {
    value: 'incomplete',
    labelAr: 'غير مكتمل',
    labelEn: 'Incomplete',
    icon: 'warning',
    activeClass: 'bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-600/20',
    idleIconClass: 'bg-amber-500/15 text-amber-700',
  },
  {
    value: 'not_submitted',
    labelAr: 'لم يُسلَّم',
    labelEn: 'Not Submitted',
    icon: 'close',
    activeClass: 'bg-rose-600 text-white border-rose-600 shadow-sm ring-2 ring-rose-600/20',
    idleIconClass: 'bg-rose-100 text-rose-700',
  },
];

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

  const todayStr = toLocalISODate();
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
  const [behaviorRating, setBehaviorRating] = useState<BehaviorRating | undefined>(undefined);
  const [homeworkRating, setHomeworkRating] = useState<HomeworkRating | undefined>(undefined);
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
      if (studentPrivateEnrollments.length > 0 && (!selectedEnrollmentId || !studentPrivateEnrollments.some((e) => e.id === selectedEnrollmentId))) {
        setSelectedEnrollmentId(studentPrivateEnrollments[0].id);
      }
      setDate(todayStr);
      setStartTime(nowTime || '16:00');
      setSessionCount(1);
      setHours(1.5);
      setCustomInput('1');
      setIsCustomMode(false);
      setNotes('');
      setBehaviorRating(undefined);
      setHomeworkRating(undefined);
    }
  }, [isOpen, student?.id]);

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
      let targetGroupId = activeGroup?.id || '';
      let targetEnrollmentId = activeEnrollment?.id;

      if (!targetEnrollmentId) {
        const privEnrs = db.getStudentPrivateEnrollments(student.id);
        if (privEnrs.length > 0) {
          targetEnrollmentId = privEnrs[0].enrollment.id;
          targetGroupId = privEnrs[0].group?.id || '';
        } else {
          const created = db.createPrivateLessonService(student.id, {
            subject: isEn ? 'Private Subject' : 'مادة الدرس الخاص',
            sessionPrice: 100,
            billingType: 'prepaid',
            billingMode: 'prepaid',
          });
          targetGroupId = created.group?.id || '';
          targetEnrollmentId = created.enrollment.id;
        }
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
        behaviorRating,
        homeworkRating,
      });

      if (typeof onSaveComplete === 'function') {
        onSaveComplete();
      }
      onClose();
    } catch (err) {
      console.error('Error recording private sessions:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !student) return null;

  return (
    <BottomSheet
      id="record-private-session"
      isOpen={isOpen && !!student}
      onClose={onClose}
      title={isEn ? 'Smart Session Studio' : 'استوديو رصد الحصة الذكي'}
      subtitle={isEn ? `Student: ${student.name}` : `الطالب: ${student.name}`}
      headerLeading={
        <div className="w-10 h-10 rounded-2xl bg-mint-soft text-navy flex items-center justify-center shrink-0 border border-line">
          <AppIcon name="zap" size={20} weight="fill" className="text-orange" />
        </div>
      }
      headerTrailing={
        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-mint-soft text-navy border border-line">
          {isHourly ? (isEn ? 'Hourly' : 'ساعات') : (isEn ? 'Lessons' : 'حصص')}
        </span>
      }
      footer={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn-soft flex-1"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            form="record-private-session-form"
            disabled={isSubmitting}
            className={`flex-1 transition-all flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-black text-sm shadow-xs cursor-pointer active:scale-98 ${
              attendanceType === 'absent_charged'
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200'
                : attendanceType === 'absent_free' || attendanceType === 'cancelled'
                ? 'bg-slate-600 hover:bg-slate-700 text-white shadow-slate-200'
                : 'btn-orange'
            }`}
          >
            <AppIcon
              name={
                attendanceType === 'present'
                  ? 'check'
                  : attendanceType === 'absent_charged'
                  ? 'warning'
                  : 'close'
              }
              size={16}
              weight="bold"
            />
            <span>
              {isSubmitting
                ? (isEn ? 'Saving...' : 'جاري الحفظ...')
                : attendanceType === 'present'
                ? isEn
                  ? `Save & Confirm (${formatSessionQuantityDisplay(
                      isHourly ? { hours, isHourly: true } : { sessionUnits: sessionCount, isHourly: false },
                      isRTL
                    )})`
                  : `حفظ وتأكيد (${formatSessionQuantityDisplay(
                      isHourly ? { hours, isHourly: true } : { sessionUnits: sessionCount, isHourly: false },
                      isRTL
                    )})`
                : attendanceType === 'absent_charged'
                ? isEn
                  ? `Confirm Absent Charged (${formatSessionQuantityDisplay(
                      isHourly ? { hours, isHourly: true } : { sessionUnits: sessionCount, isHourly: false },
                      isRTL
                    )})`
                  : `تأكيد غياب محسوب (${formatSessionQuantityDisplay(
                      isHourly ? { hours, isHourly: true } : { sessionUnits: sessionCount, isHourly: false },
                      isRTL
                    )})`
                : isEn
                ? 'Confirm Absent (Not Charged)'
                : 'تأكيد غياب غير محسوب'}
            </span>
          </button>
        </div>
      }
    >
      <form
        id="record-private-session-form"
        onSubmit={handleSubmit}
        className="space-y-4 text-xs text-navy"
      >
        {/* Service / Enrollment Selector */}
        {studentPrivateEnrollments.length > 1 && (
          <div className="p-3 rounded-2xl bg-page border border-line space-y-1.5 shadow-2xs">
            <label className="field-label flex items-center gap-1.5">
              <AppIcon name="book" size={14} className="text-navy" />
              <span>{isEn ? 'Private Subject / Service:' : 'المادة / الخدمة الخاصة:'}</span>
            </label>
            <select
              value={selectedEnrollmentId}
              onChange={(e) => setSelectedEnrollmentId(e.target.value)}
              className="classy-select"
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
          <div className="p-2.5 rounded-2xl bg-page border border-line flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <AppIcon name="calendar" size={16} className="text-navy shrink-0" />
              <span className="text-[11px] text-navy font-bold truncate">
                {isEn ? 'Last used quantity:' : 'الكمية السابقة:'}
                <strong className="ms-1 text-navy font-black">
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
              className="px-2.5 py-1 rounded-xl bg-navy text-white text-[10px] font-black shrink-0 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              {isEn ? 'Repeat Last' : 'تكرار السابقة'}
            </button>
          </div>
        )}

        {/* Date & Time Row */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-2xl bg-page border border-line space-y-1">
            <label className="field-label flex items-center gap-1">
              <AppIcon name="calendar" size={14} className="text-navy" />
              <span>{isEn ? 'Date:' : 'التاريخ:'}</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="classy-input"
            />
          </div>

          <div className="p-3 rounded-2xl bg-page border border-line space-y-1">
            <label className="field-label flex items-center gap-1">
              <AppIcon name="clock" size={14} className="text-navy" />
              <span>{isEn ? 'Start Time:' : 'وقت البدء:'}</span>
            </label>
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="classy-input"
            />
          </div>
        </div>

        {/* A. INTERACTIVE QUANTITY CONTROLLER */}
        <div className="p-4 sm:p-5 rounded-3xl bg-page border border-line shadow-xs space-y-4 text-center relative overflow-hidden">
          <span className="text-[11px] font-black text-slate block uppercase tracking-wider">
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
              className="w-12 h-12 rounded-2xl bg-mint-soft hover:bg-mint active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-line flex items-center justify-center text-navy font-black transition-all shadow-2xs cursor-pointer"
              title="- 0.5"
            >
              <AppIcon name="minus" size={18} weight="bold" />
            </button>

            <div className="min-w-[150px] p-3.5 rounded-3xl bg-mist border border-line shadow-inner">
              <div className="text-3xl sm:text-4xl font-black text-navy tracking-tight">
                {selectedQuantity}
              </div>
              <div className="text-xs font-black text-navy mt-0.5">
                {formatSessionQuantityDisplay(
                  isHourly ? { hours: selectedQuantity, isHourly: true } : { sessionUnits: selectedQuantity, isHourly: false },
                  isRTL
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleStepChange(0.5)}
              className="w-12 h-12 rounded-2xl bg-mint-soft hover:bg-mint active:scale-95 border border-line flex items-center justify-center text-navy font-black transition-all shadow-2xs cursor-pointer"
              title="+ 0.5"
            >
              <AppIcon name="plus" size={18} weight="bold" />
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
                  className={`chip px-2 ${isSel ? 'chip-active' : ''}`}
                >
                  {val} {isHourly ? (isEn ? 'h' : 'س') : (isEn ? 'L' : 'ح')}
                </button>
              );
            })}
          </div>

          {/* Custom Value Mode */}
          <div className="pt-2 border-t border-line flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsCustomMode(!isCustomMode)}
              className={`chip ${isCustomMode ? 'chip-active' : ''}`}
            >
              <AppIcon name="edit" size={14} />
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
                  className="classy-input w-28 text-center"
                />
                <span className="text-[11px] font-bold text-slate">
                  {isHourly ? (isEn ? 'hours' : 'ساعة') : (isEn ? 'lessons' : 'حصة')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Attendance Status Selection via AttendanceChoiceTiles */}
        <div className="p-4 rounded-3xl bg-page border border-line space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-black text-navy text-xs">
              {isEn ? 'Attendance Status:' : 'حالة الحضور والاحتساب:'}
            </span>
            <span
              className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                isCharged
                  ? 'bg-mint-soft text-navy border border-line'
                  : 'bg-page text-slate border border-line'
              }`}
            >
              {isCharged
                ? (isEn ? 'Charged (Consumes Credit)' : 'محسوبة (تستهلك رصيد)')
                : (isEn ? 'Exempt (Free)' : 'غير محسوبة (معفية)')}
            </span>
          </div>

          <AttendanceChoiceTiles
            value={attendanceType}
            onChange={(val) => {
              if (val === 'late') {
                setAttendanceType('present');
              } else {
                setAttendanceType(val);
              }
            }}
            options={['present', 'absent_charged', 'absent_free', 'cancelled']}
          />
        </div>

        {/* BEHAVIOR RATING (تقييم السلوك) */}
        <div className="p-3.5 sm:p-4 rounded-3xl bg-page border border-line shadow-xs space-y-2.5 text-start">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate block uppercase tracking-wider">
              {isEn ? 'Behavior Rating' : 'تقييم السلوك'}
            </span>
            {behaviorRating ? (
              <button
                type="button"
                onClick={() => {
                  triggerSelectionHaptic();
                  setBehaviorRating(undefined);
                }}
                className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-navy/10 text-navy border border-navy/20 hover:bg-navy/15 transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                <span>{getBehaviorRatingLabel(behaviorRating, isEn)}</span>
                <AppIcon name="close" size={10} weight="regular" />
              </button>
            ) : (
              <span className="text-[10px] font-bold text-slate px-2 py-0.5 rounded-full bg-mist border border-line">
                {isEn ? 'Unset' : 'غير محدد'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {STUDIO_BEHAVIOR_OPTIONS.map((opt) => {
              const isSelected = behaviorRating === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    triggerSelectionHaptic();
                    setBehaviorRating((prev) => (prev === opt.value ? undefined : opt.value));
                  }}
                  className={`py-2.5 px-3 rounded-2xl flex items-center gap-2 transition-all text-start cursor-pointer border active:scale-98 ${
                    isSelected
                      ? opt.activeClass
                      : 'bg-white hover:bg-mist text-navy border-line'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'bg-white/20 text-white' : opt.idleIconClass
                    }`}
                  >
                    <AppIcon name={opt.icon} size={13} weight="fill" />
                  </div>
                  <span className="text-xs font-black tracking-tight leading-tight truncate">
                    {isEn ? opt.labelEn : opt.labelAr}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* HOMEWORK RATING (تقييم الواجب) */}
        <div className="p-3.5 sm:p-4 rounded-3xl bg-page border border-line shadow-xs space-y-2.5 text-start">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate block uppercase tracking-wider">
              {isEn ? 'Homework Rating' : 'تقييم الواجب'}
            </span>
            {homeworkRating ? (
              <button
                type="button"
                onClick={() => {
                  triggerSelectionHaptic();
                  setHomeworkRating(undefined);
                }}
                className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-navy/10 text-navy border border-navy/20 hover:bg-navy/15 transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                <span>{getHomeworkRatingLabel(homeworkRating, isEn)}</span>
                <AppIcon name="close" size={10} weight="regular" />
              </button>
            ) : (
              <span className="text-[10px] font-bold text-slate px-2 py-0.5 rounded-full bg-mist border border-line">
                {isEn ? 'Unset' : 'غير محدد'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {STUDIO_HOMEWORK_OPTIONS.map((opt) => {
              const isSelected = homeworkRating === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    triggerSelectionHaptic();
                    setHomeworkRating((prev) => (prev === opt.value ? undefined : opt.value));
                  }}
                  className={`py-2.5 px-3 rounded-2xl flex items-center gap-2 transition-all text-start cursor-pointer border active:scale-98 ${
                    isSelected
                      ? opt.activeClass
                      : 'bg-white hover:bg-mist text-navy border-line'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'bg-white/20 text-white' : opt.idleIconClass
                    }`}
                  >
                    <AppIcon name={opt.icon} size={13} weight="fill" />
                  </div>
                  <span className="text-xs font-black tracking-tight leading-tight truncate">
                    {isEn ? opt.labelEn : opt.labelAr}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* B. LIVE FINANCIAL IMPACT PANEL */}
        <div className="p-4 rounded-3xl bg-page border border-line shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <div className="flex items-center gap-2">
              <AppIcon name="coins" size={16} className="text-navy" />
              <span className="font-black text-xs text-navy">
                {isEn ? 'Live Financial Impact' : 'الأثر المالي المباشر'}
              </span>
            </div>
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-mint-soft text-navy">
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
            <div className="p-3 rounded-2xl bg-page border border-line space-y-0.5">
              <span className="text-[10px] text-slate block font-bold">
                {isHourly ? (isEn ? 'Hourly Rate' : 'سعر الساعة') : (isEn ? 'Price / Lesson' : 'سعر الحصة')}
              </span>
              <strong className="text-sm font-black text-navy block">
                {effectiveSessionPrice} {t('currency')}
              </strong>
            </div>

            <div className="p-3 rounded-2xl bg-page border border-line space-y-0.5">
              <span className="text-[10px] text-slate block font-bold">
                {isEn ? 'Session Total' : 'إجمالي قيمة الحصة'}
              </span>
              <strong className="text-sm font-black text-navy block">
                {totalSessionValue} {t('currency')}
              </strong>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-page border border-line space-y-0.5">
              <span className="text-[10px] text-slate block font-bold">
                {isEn ? 'Outstanding Dues' : 'الرصيد المتبقي على الطالب'}
              </span>
              <strong className="text-sm font-black text-navy block">
                {finSummary?.remaining || 0} {t('currency')}
              </strong>
            </div>
          </div>
        </div>

        {/* C. BEFORE & AFTER PACKAGE PROGRESS */}
        {packageProjection && (
          <div className="p-4 rounded-3xl bg-page border border-line shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AppIcon name="layers" size={16} className="text-navy" />
                <span className="font-black text-xs text-navy">
                  {isEn ? 'Package Progress (Before & After)' : 'تطور رصيد الباقة (قبل وبعد الرصد)'}
                </span>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-mint-soft text-navy">
                {packageProjection.total} {isEn ? 'Lessons Package' : 'حصص في الباقة'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="p-2.5 rounded-2xl bg-page border border-line space-y-1">
                <span className="text-[10px] font-bold text-slate block">
                  {isEn ? 'Before' : 'قبل الرصد'}
                </span>
                <strong className="text-xs font-black text-navy block">
                  {packageProjection.beforeRemaining} {isEn ? 'rem.' : 'متبقية'}
                </strong>
              </div>

              <div className="p-2.5 rounded-2xl bg-mint-soft border border-navy/20 space-y-1">
                <span className="text-[10px] font-bold text-navy block">
                  {isEn ? 'This Session' : 'هذه الحصة'}
                </span>
                <strong className="text-xs font-black text-navy block">
                  -{packageProjection.thisSessionUnits} {isEn ? 'lessons' : 'حصة'}
                </strong>
              </div>

              <div className="p-2.5 rounded-2xl bg-mist border border-line space-y-1">
                <span className="text-[10px] font-bold text-navy block">
                  {isEn ? 'After' : 'بعد الرصد'}
                </span>
                <strong className="text-xs font-black text-navy block">
                  {packageProjection.afterRemaining} {isEn ? 'rem.' : 'متبقية'}
                </strong>
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <div className="h-2.5 w-full bg-mint-soft rounded-full overflow-hidden flex">
                <div
                  style={{
                    width: `${Math.min(100, (packageProjection.projectedUsed / packageProjection.total) * 100)}%`,
                  }}
                  className="bg-navy h-full transition-all duration-300"
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate font-bold">
                <span>{packageProjection.projectedUsed} {isEn ? 'consumed' : 'مستهلك'}</span>
                <span>{packageProjection.afterRemaining} {isEn ? 'remaining' : 'متبقي'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Optional Notes */}
        <div className="space-y-1">
          <label className="field-label">
            {isEn ? 'Notes (Optional):' : 'ملاحظات (اختياري):'}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isEn ? 'Topics covered, homework, remarks...' : 'الموضوعات المغطاة، الواجب، ملاحظات المعلم...'}
            rows={2}
            className="classy-textarea"
          />
        </div>
      </form>
    </BottomSheet>
  );
};
