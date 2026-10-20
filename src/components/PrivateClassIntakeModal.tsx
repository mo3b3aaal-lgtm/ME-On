import React, { useState, useMemo, useEffect } from 'react';
import { Student, Enrollment, Group, Session } from '../types';
import {
  db,
  roundMoney,
  multiplyMoney,
  divideMoney,
  formatSessionQuantityDisplay,
} from '../utils/storage';
import { useTranslation } from '../utils/i18n';
import { BottomSheet } from './ui/BottomSheet';
import { AppIcon } from './ui/AppIcon';

export interface PrivateClassIntakeResult {
  sessionUnits?: number;
  hours?: number;
  pricePerStudent?: number;
  notes?: string;
  attendanceStatus?: 'present' | 'absent_free' | 'absent_charged';
  isCharged?: boolean;
}

interface PrivateClassIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  enrollment?: Enrollment | null;
  group?: Group | null;
  session?: Session | null;
  initialAttendanceStatus?: 'present' | 'absent_free' | 'absent_charged';
  onConfirm: (result: PrivateClassIntakeResult) => void;
}

export const PrivateClassIntakeModal: React.FC<PrivateClassIntakeModalProps> = ({
  isOpen,
  onClose,
  student,
  enrollment,
  group,
  session,
  initialAttendanceStatus,
  onConfirm,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');

  // Determine effective enrollment & group if not passed directly
  const activeEnrollment = useMemo(() => {
    if (enrollment) return enrollment;
    if (!student) return null;
    const allEnrs = db.getEnrollments().filter((e) => e.studentId === student.id);
    if (session?.enrollmentId) {
      return allEnrs.find((e) => e.id === session.enrollmentId) || null;
    }
    if (session?.groupId) {
      return allEnrs.find((e) => e.groupId === session.groupId) || null;
    }
    const allGroups = db.getGroups();
    return (
      allEnrs.find((e) => {
        const g = allGroups.find((grp) => grp.id === e.groupId);
        return e.serviceType === 'private' || g?.type === 'private';
      }) ||
      allEnrs[0] ||
      null
    );
  }, [enrollment, student, session]);

  const activeGroup = useMemo(() => {
    if (group) return group;
    if (activeEnrollment) {
      return db.getGroupById(activeEnrollment.groupId) || null;
    }
    if (session?.groupId) {
      return db.getGroupById(session.groupId) || null;
    }
    return null;
  }, [group, activeEnrollment, session]);

  // Billing mode check
  const isHourly = useMemo(() => {
    return (
      activeEnrollment?.billingMode === 'hourly' ||
      activeEnrollment?.billingType === 'hourly' ||
      activeGroup?.billingMode === 'hourly' ||
      activeGroup?.billingType === 'hourly'
    );
  }, [activeEnrollment, activeGroup]);

  const isPackage = useMemo(() => {
    if (isHourly) return false;
    return (
      activeEnrollment?.billingMode === 'package' ||
      activeEnrollment?.billingType === 'package' ||
      activeGroup?.billingMode === 'package' ||
      activeGroup?.billingType === 'package'
    );
  }, [isHourly, activeEnrollment, activeGroup]);

  const isMonthly = useMemo(() => {
    if (isHourly || isPackage) return false;
    return (
      activeEnrollment?.billingMode === 'monthly' ||
      activeEnrollment?.billingType === 'monthly' ||
      activeGroup?.billingMode === 'monthly' ||
      activeGroup?.billingType === 'monthly'
    );
  }, [isHourly, isPackage, activeEnrollment, activeGroup]);

  const isPrepaid = useMemo(() => {
    if (isHourly || isPackage || isMonthly) return false;
    return (
      activeEnrollment?.billingMode === 'prepaid' ||
      activeEnrollment?.billingType === 'prepaid' ||
      (activeEnrollment?.billingType === 'per_session' && activeEnrollment?.billingMode !== 'postpaid')
    );
  }, [isHourly, isPackage, isMonthly, activeEnrollment]);

  // Initial unit values
  const initialSessionUnits = useMemo(() => {
    if (session?.sessionUnits !== undefined && session?.sessionUnits !== null && Number(session.sessionUnits) > 0) {
      return Number(session.sessionUnits);
    }
    return 1;
  }, [session]);

  const initialHours = useMemo(() => {
    if (session?.hours !== undefined && session?.hours !== null && Number(session.hours) > 0) {
      return Number(session.hours);
    }
    return 1.5;
  }, [session]);

  // Selection states
  const [selectedUnits, setSelectedUnits] = useState<number>(initialSessionUnits);
  const [selectedHours, setSelectedHours] = useState<number>(initialHours);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customUnitsInput, setCustomUnitsInput] = useState<string>(String(initialSessionUnits));
  const [customHoursInput, setCustomHoursInput] = useState<string>(String(initialHours));
  const [notes, setNotes] = useState<string>('');
  const [attendanceStatus, setAttendanceStatus] = useState<'present' | 'absent_free' | 'absent_charged'>(
    initialAttendanceStatus || 'present'
  );

  const isFreeAbsence = attendanceStatus === 'absent_free';

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
      } catch (e) {
        // ignore
      }
    }
  }, [memoryStorageKey, isOpen]);

  // Reset when modal opens or session changes
  useEffect(() => {
    if (isOpen) {
      setAttendanceStatus(initialAttendanceStatus || 'present');
      const units = initialSessionUnits;
      const hrs = initialHours;
      setSelectedUnits(units);
      setSelectedHours(hrs);
      setCustomUnitsInput(String(units));
      setCustomHoursInput(String(hrs));
      setIsCustomMode(![0.5, 1, 1.5, 2, 2.5, 3].includes(isHourly ? hrs : units));
      setNotes(session?.notes || '');
    }
  }, [isOpen, session, initialSessionUnits, initialHours, isHourly, initialAttendanceStatus]);

  // Predefined Presets
  const SESSION_PRESETS = [0.5, 1, 1.5, 2, 2.5, 3];
  const HOURLY_PRESETS = [
    { labelAr: '30 دقيقة (0.5 س)', labelEn: '30m (0.5h)', value: 0.5 },
    { labelAr: '1 ساعة', labelEn: '1h', value: 1 },
    { labelAr: '1.5 ساعة', labelEn: '1.5h', value: 1.5 },
    { labelAr: '2 ساعة', labelEn: '2h', value: 2 },
    { labelAr: '2.5 ساعة', labelEn: '2.5h', value: 2.5 },
    { labelAr: '3 ساعات', labelEn: '3h', value: 3 },
  ];

  // Prices & Rates
  const baseSessionPrice = activeEnrollment?.customPrice || activeGroup?.defaultPrice || 100;
  const hourlyRate =
    activeEnrollment?.hourlyRate ||
    activeGroup?.hourlyRate ||
    activeEnrollment?.customPrice ||
    activeGroup?.defaultPrice ||
    150;

  const packageTotalSessions = activeEnrollment?.packageSessionsCount || activeGroup?.packageSessionsCount || 8;
  const packageTotalPrice =
    activeEnrollment?.packagePrice ||
    activeGroup?.defaultPrice ||
    packageTotalSessions * baseSessionPrice;
  const unitRate = packageTotalSessions > 0 ? divideMoney(packageTotalPrice, packageTotalSessions) : baseSessionPrice;

  // Live Calculations
  const calculatedSessionValue = useMemo(() => {
    if (isFreeAbsence) return 0;
    if (isHourly) {
      return multiplyMoney(selectedHours, hourlyRate);
    }
    if (isPackage) {
      return multiplyMoney(selectedUnits, unitRate);
    }
    return multiplyMoney(selectedUnits, baseSessionPrice);
  }, [isFreeAbsence, isHourly, isPackage, selectedUnits, selectedHours, hourlyRate, unitRate, baseSessionPrice]);

  // Outstanding balance & Enrollment financials before & after
  const currentFin = useMemo(() => {
    if (!activeEnrollment) return null;
    return db.calculateEnrollmentFinancials(activeEnrollment.id);
  }, [activeEnrollment, isOpen]);

  // Package Remaining Projection with exact Before / This Session / After values
  const packageProjection = useMemo(() => {
    if (!isPackage || !activeEnrollment) return null;
    const prevSessionUnits = session?.sessionUnits || 0;
    const baseUsed = Math.max(0, (currentFin?.attendedSessionsCount || 0) - prevSessionUnits);
    const beforeRemaining = Math.max(0, roundMoney(packageTotalSessions - baseUsed, 2));
    const effectiveUnitsToAdd = isFreeAbsence ? 0 : selectedUnits;
    const projectedUsed = roundMoney(baseUsed + effectiveUnitsToAdd, 2);
    const afterRemaining = Math.max(0, roundMoney(packageTotalSessions - projectedUsed, 2));
    return {
      baseUsed,
      beforeRemaining,
      thisSessionUnits: effectiveUnitsToAdd,
      projectedUsed,
      afterRemaining,
      total: packageTotalSessions,
      isFreeAbsence,
    };
  }, [isPackage, activeEnrollment, selectedUnits, packageTotalSessions, session, currentFin, isFreeAbsence]);

  // Stepper handlers
  const handleStepChange = (delta: number) => {
    if (isHourly) {
      const next = Math.max(0.5, roundMoney(selectedHours + delta, 2));
      setSelectedHours(next);
      setCustomHoursInput(String(next));
      setIsCustomMode(![0.5, 1, 1.5, 2, 2.5, 3].includes(next));
    } else {
      const next = Math.max(0.5, roundMoney(selectedUnits + delta, 2));
      setSelectedUnits(next);
      setCustomUnitsInput(String(next));
      setIsCustomMode(![0.5, 1, 1.5, 2, 2.5, 3].includes(next));
    }
  };

  const handleSelectPresetUnit = (val: number) => {
    setSelectedUnits(val);
    setCustomUnitsInput(String(val));
    setIsCustomMode(false);
  };

  const handleSelectPresetHour = (val: number) => {
    setSelectedHours(val);
    setCustomHoursInput(String(val));
    setIsCustomMode(false);
  };

  const handleCustomUnitsChange = (valStr: string) => {
    setCustomUnitsInput(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      setSelectedUnits(parsed);
    }
  };

  const handleCustomHoursChange = (valStr: string) => {
    setCustomHoursInput(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      setSelectedHours(parsed);
    }
  };

  // Smart Memory: Apply Remembered Quantity
  const handleApplySmartMemory = () => {
    if (rememberedQuantity && rememberedQuantity > 0) {
      if (isHourly) {
        setSelectedHours(rememberedQuantity);
        setCustomHoursInput(String(rememberedQuantity));
        setIsCustomMode(![0.5, 1, 1.5, 2, 2.5, 3].includes(rememberedQuantity));
      } else {
        setSelectedUnits(rememberedQuantity);
        setCustomUnitsInput(String(rememberedQuantity));
        setIsCustomMode(![0.5, 1, 1.5, 2, 2.5, 3].includes(rememberedQuantity));
      }
    }
  };

  const handleConfirm = () => {
    const finalUnits = isHourly ? undefined : selectedUnits;
    const finalHours = isHourly ? selectedHours : undefined;
    const quantityToSave = isHourly ? selectedHours : selectedUnits;

    // Save to Smart Memory
    if (memoryStorageKey && typeof window !== 'undefined' && quantityToSave > 0) {
      try {
        localStorage.setItem(memoryStorageKey, String(quantityToSave));
      } catch (e) {
        // ignore
      }
    }

    onConfirm({
      sessionUnits: finalUnits,
      hours: finalHours,
      pricePerStudent: calculatedSessionValue,
      notes: notes.trim(),
      attendanceStatus,
      isCharged: attendanceStatus !== 'absent_free',
    });
    onClose();
  };

  if (!isOpen || !student) return null;

  return (
    <BottomSheet
      id="private-class-intake"
      isOpen={isOpen}
      onClose={onClose}
      title={isEn ? 'Smart Session Studio' : 'استوديو رصد الحصة الذكي'}
      subtitle={`${student.name} • ${activeGroup?.subject || (isEn ? 'Private Tutoring' : 'درس خاص')}`}
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
      bodyClassName="p-4"
      footer={
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="btn-soft px-6"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`flex-1 transition-all flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-black text-sm shadow-xs cursor-pointer active:scale-98 ${
              attendanceStatus === 'absent_charged'
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200'
                : attendanceStatus === 'absent_free'
                ? 'bg-slate-600 hover:bg-slate-700 text-white shadow-slate-200'
                : 'btn-orange'
            }`}
          >
            <AppIcon
              name={
                attendanceStatus === 'present'
                  ? 'check'
                  : attendanceStatus === 'absent_charged'
                  ? 'warning'
                  : 'close'
              }
              size={16}
              weight="bold"
            />
            <span>
              {attendanceStatus === 'present'
                ? isEn
                  ? `Confirm Present (${formatSessionQuantityDisplay(
                      isHourly ? { hours: selectedHours, isHourly: true } : { sessionUnits: selectedUnits, isHourly: false },
                      isRTL
                    )})`
                  : `تأكيد حضور (${formatSessionQuantityDisplay(
                      isHourly ? { hours: selectedHours, isHourly: true } : { sessionUnits: selectedUnits, isHourly: false },
                      isRTL
                    )})`
                : attendanceStatus === 'absent_charged'
                ? isEn
                  ? `Confirm Absent Charged (${formatSessionQuantityDisplay(
                      isHourly ? { hours: selectedHours, isHourly: true } : { sessionUnits: selectedUnits, isHourly: false },
                      isRTL
                    )})`
                  : `تأكيد غياب محسوب (${formatSessionQuantityDisplay(
                      isHourly ? { hours: selectedHours, isHourly: true } : { sessionUnits: selectedUnits, isHourly: false },
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
      <div className="space-y-4 text-xs text-navy">
        {/* Smart Memory Suggestion Banner */}
        {rememberedQuantity !== null && rememberedQuantity > 0 && rememberedQuantity !== (isHourly ? selectedHours : selectedUnits) && (
          <div className="p-2.5 rounded-2xl bg-page border border-line flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <AppIcon name="calendar" size={15} className="text-navy shrink-0" />
              <span className="text-[11px] text-navy font-bold truncate">
                {isEn ? `Last used for ${student.name}:` : `الكمية السابقة لـ ${student.name}:`}
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

        {/* INTERACTIVE QUANTITY CONTROLLER */}
        <div className="p-4 sm:p-5 rounded-3xl bg-page border border-line shadow-xs space-y-4 text-center relative overflow-hidden">
          <span className="text-[11px] font-black text-slate block uppercase tracking-wider">
            {isHourly
              ? (isEn ? 'Session Duration (Hours)' : 'مدة الحصة الفعلية (بالساعات)')
              : (isEn ? 'Lesson Intake Quantity' : 'كمية الحصص المنفذة')}
          </span>

          {/* Steppers + Number */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 py-2">
            <button
              type="button"
              onClick={() => handleStepChange(-0.5)}
              disabled={(isHourly ? selectedHours : selectedUnits) <= 0.5}
              className="w-12 h-12 rounded-2xl bg-mint-soft hover:bg-mint active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-line flex items-center justify-center text-navy font-black transition-all cursor-pointer"
              title="- 0.5"
            >
              <AppIcon name="minus" size={18} weight="bold" />
            </button>

            <div className="min-w-[150px] p-3.5 rounded-3xl bg-page border border-line shadow-inner">
              <div className="text-3xl sm:text-4xl font-black text-navy tracking-tight">
                {isHourly ? selectedHours : selectedUnits}
              </div>
              <div className="text-xs font-black text-navy mt-0.5">
                {formatSessionQuantityDisplay(
                  isHourly ? { hours: selectedHours, isHourly: true } : { sessionUnits: selectedUnits, isHourly: false },
                  isRTL
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleStepChange(0.5)}
              className="w-12 h-12 rounded-2xl bg-mint-soft hover:bg-mint active:scale-95 border border-line flex items-center justify-center text-navy font-black transition-all cursor-pointer"
              title="+ 0.5"
            >
              <AppIcon name="plus" size={18} weight="bold" />
            </button>
          </div>

          {/* Segmented Preset Pills */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {isHourly
              ? HOURLY_PRESETS.map((preset) => {
                  const isSel = !isCustomMode && selectedHours === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => handleSelectPresetHour(preset.value)}
                      className={`chip px-2 ${isSel ? 'chip-active' : ''}`}
                    >
                      {isEn ? preset.labelEn : preset.labelAr}
                    </button>
                  );
                })
              : SESSION_PRESETS.map((unit) => {
                  const isSel = !isCustomMode && selectedUnits === unit;
                  return (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => handleSelectPresetUnit(unit)}
                      className={`chip px-2 ${isSel ? 'chip-active' : ''}`}
                    >
                      {unit} {isEn ? (unit === 1 ? 'Lesson' : 'Lessons') : (unit === 1 ? 'حصة' : 'حصص')}
                    </button>
                  );
                })}
          </div>

          {/* Custom Input Toggle */}
          <div className="pt-2 border-t border-line flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsCustomMode(!isCustomMode)}
              className="text-[11px] font-black text-navy hover:underline flex items-center gap-1 cursor-pointer"
            >
              <AppIcon name="edit" size={12} />
              <span>{isCustomMode ? (isEn ? 'Close Custom' : 'إغلاق المخصص') : (isEn ? 'Enter Custom Value' : 'إدخال قيمة مخصصة')}</span>
            </button>

            {isCustomMode && (
              <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="24"
                  value={isHourly ? customHoursInput : customUnitsInput}
                  onChange={(e) => (isHourly ? handleCustomHoursChange(e.target.value) : handleCustomUnitsChange(e.target.value))}
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

        {/* ATTENDANCE STATUS SELECTION */}
        <div className="p-3.5 sm:p-4 rounded-3xl bg-page border border-line shadow-xs space-y-2.5 text-start">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate block uppercase tracking-wider">
              {isEn ? 'Attendance Status' : 'حالة الحضور والاحتساب'}
            </span>
            <span
              className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border transition-colors ${
                attendanceStatus === 'present'
                  ? 'bg-navy/10 text-navy border-navy/20'
                  : attendanceStatus === 'absent_charged'
                  ? 'bg-rose-500/10 text-rose-700 border-rose-300'
                  : 'bg-slate/10 text-slate border-slate/20'
              }`}
            >
              {attendanceStatus === 'present'
                ? (isEn ? 'Present • Consumes Credit' : 'حاضر • تستهلك رصيد')
                : attendanceStatus === 'absent_charged'
                ? (isEn ? 'Charged Absence • Due' : 'غياب محسوب • يخصم رصيد')
                : (isEn ? 'Free Absence • No Charge' : 'غياب غير محسوب • بدون خصم')}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* 1. حضر */}
            <button
              type="button"
              onClick={() => setAttendanceStatus('present')}
              className={`p-2.5 sm:p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer border ${
                attendanceStatus === 'present'
                  ? 'bg-navy text-white border-navy shadow-sm ring-2 ring-navy/20'
                  : 'bg-white hover:bg-mist text-navy border-line'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                  attendanceStatus === 'present' ? 'bg-white/20 text-white' : 'bg-navy/5 text-navy'
                }`}
              >
                <AppIcon name="check" size={15} weight="bold" />
              </div>
              <span className="text-xs font-black tracking-tight leading-tight">
                {isEn ? 'Present' : 'حضر'}
              </span>
              <span
                className={`text-[9px] font-bold ${
                  attendanceStatus === 'present' ? 'text-white/80' : 'text-slate'
                }`}
              >
                {isEn ? 'Attended' : 'حضور فعلي'}
              </span>
            </button>

            {/* 2. غائب غير محسوب */}
            <button
              type="button"
              onClick={() => setAttendanceStatus('absent_free')}
              className={`p-2.5 sm:p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer border ${
                attendanceStatus === 'absent_free'
                  ? 'bg-slate-700 text-white border-slate-700 shadow-sm ring-2 ring-slate-700/20'
                  : 'bg-white hover:bg-mist text-slate border-line'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                  attendanceStatus === 'absent_free' ? 'bg-white/20 text-white' : 'bg-slate/10 text-slate'
                }`}
              >
                <AppIcon name="close" size={14} weight="bold" />
              </div>
              <span className="text-xs font-black tracking-tight leading-tight">
                {isEn ? 'Absent (Free)' : 'غائب غير محسوب'}
              </span>
              <span
                className={`text-[9px] font-bold ${
                  attendanceStatus === 'absent_free' ? 'text-white/80' : 'text-slate'
                }`}
              >
                {isEn ? 'No charge' : 'معفى / بدون خصم'}
              </span>
            </button>

            {/* 3. غائب محسوب */}
            <button
              type="button"
              onClick={() => setAttendanceStatus('absent_charged')}
              className={`p-2.5 sm:p-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer border ${
                attendanceStatus === 'absent_charged'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm ring-2 ring-rose-600/20'
                  : 'bg-rose-50/50 hover:bg-rose-50 text-rose-700 border-rose-200/70'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                  attendanceStatus === 'absent_charged' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
                }`}
              >
                <AppIcon name="warning" size={14} weight="bold" />
              </div>
              <span className="text-xs font-black tracking-tight leading-tight">
                {isEn ? 'Absent (Charged)' : 'غائب محسوب'}
              </span>
              <span
                className={`text-[9px] font-bold ${
                  attendanceStatus === 'absent_charged' ? 'text-white/80' : 'text-rose-600'
                }`}
              >
                {isEn ? 'Charged' : 'يخصم رصيد'}
              </span>
            </button>
          </div>
        </div>

        {/* FINANCIAL SUMMARY */}
        <div className="p-4 rounded-3xl bg-page border border-line shadow-xs space-y-3 text-start">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <div className="flex items-center gap-2">
              <AppIcon name="coins" size={16} className="text-navy" />
              <span className="font-black text-xs text-navy">
                {isEn ? 'Financial Impact' : 'الأثر المالي للحصة'}
              </span>
            </div>
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-mint-soft text-navy">
              {isFreeAbsence
                ? (isEn ? 'Exempt / Free Absence' : 'غياب غير محسوب (معفى)')
                : isPrepaid
                ? (isEn ? 'Prepaid (Auto-settled)' : 'مسبق (تسوية فورية)')
                : isPackage
                ? (isEn ? 'Package Consumption' : 'خصم من الباقة')
                : isHourly
                ? (isEn ? 'Hourly Rate' : 'حساب بالساعة')
                : (isEn ? 'Postpaid Session' : 'حساب بالحصة')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-page border border-line space-y-0.5">
              <span className="text-[10px] text-slate block font-bold">
                {isHourly ? (isEn ? 'Hourly Rate' : 'سعر الساعة') : (isEn ? 'Price / Lesson' : 'سعر الحصة')}
              </span>
              <strong className="text-sm font-black text-navy block">
                {isHourly ? hourlyRate : isPackage ? unitRate : baseSessionPrice} {t('currency')}
              </strong>
            </div>

            <div className="p-3 rounded-2xl bg-page border border-line space-y-0.5">
              <span className="text-[10px] text-slate block font-bold">
                {isEn ? 'Session Total' : 'إجمالي قيمة الحصة'}
              </span>
              <strong className="text-sm font-black text-navy block">
                {calculatedSessionValue} {t('currency')}
              </strong>
              {isFreeAbsence && (
                <span className="text-[9px] text-slate font-bold block">
                  {isEn ? '(Not charged)' : '(معفى من الرسوم)'}
                </span>
              )}
            </div>

            <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-page border border-line space-y-0.5">
              <span className="text-[10px] text-slate block font-bold">
                {isEn ? 'Current Outstanding' : 'المستحق المتبقي'}
              </span>
              <strong className="text-sm font-black text-navy block">
                {currentFin?.remaining || 0} {t('currency')}
              </strong>
            </div>
          </div>
        </div>

        {/* PACKAGE PROJECTION */}
        {packageProjection && (
          <div className="p-4 rounded-3xl bg-page border border-line shadow-xs space-y-3 text-start">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <div className="flex items-center gap-2">
                <AppIcon name="invoice" size={16} className="text-navy" />
                <span className="font-black text-xs text-navy">
                  {isEn ? 'Package Balance Progression' : 'حالة استهلاك رصيد الباقة'}
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
                <span className="text-[9px] text-slate block">
                  {packageProjection.baseUsed} {isEn ? 'used' : 'مستهلكة'}
                </span>
              </div>

              <div className="p-2.5 rounded-2xl bg-mint-soft border border-navy/30 space-y-1">
                <span className="text-[10px] font-bold text-navy block">
                  {isEn ? 'This Session' : 'هذه الحصة'}
                </span>
                <strong className="text-xs font-black text-navy block">
                  {isFreeAbsence ? `0 ${isEn ? 'lessons' : 'حصة'}` : `-${packageProjection.thisSessionUnits} ${isEn ? 'lessons' : 'حصة'}`}
                </strong>
                <span className="text-[9px] text-slate block">
                  {isFreeAbsence ? (isEn ? 'No deduction' : 'بدون خصم') : `${calculatedSessionValue} ${t('currency')}`}
                </span>
              </div>

              <div className="p-2.5 rounded-2xl bg-mint-soft/50 border border-line space-y-1">
                <span className="text-[10px] font-bold text-navy block">
                  {isEn ? 'After' : 'بعد الرصد'}
                </span>
                <strong className="text-xs font-black text-navy block">
                  {packageProjection.afterRemaining} {isEn ? 'rem.' : 'متبقية'}
                </strong>
                <span className="text-[9px] text-navy font-bold block">
                  {packageProjection.projectedUsed} / {packageProjection.total}
                </span>
              </div>
            </div>

            {/* Visual Progress Bar */}
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

        {/* Notes */}
        <div className="space-y-1 text-start">
          <label className="field-label">
            {isEn ? 'Session Notes (Optional):' : 'ملاحظات الحصة (اختياري):'}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isEn ? 'Topics covered, homework, remarks...' : 'الموضوعات المغطاة، الواجب، ملاحظات المعلم...'}
            rows={2}
            className="classy-textarea"
          />
        </div>
      </div>
    </BottomSheet>
  );
};
