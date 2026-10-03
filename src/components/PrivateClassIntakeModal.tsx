import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  Clock,
  Layers,
  DollarSign,
  CheckCircle2,
  Calendar,
  User,
  Calculator,
  Tag,
  Check,
} from 'lucide-react';
import { Student, Enrollment, Group, Session, AttendanceStatus } from '../types';
import { db, roundMoney, multiplyMoney, divideMoney, formatMoney } from '../utils/storage';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import { useTranslation } from '../utils/i18n';
import { useSwipeGesture } from '../utils/useSwipeGesture';

export interface PrivateClassIntakeResult {
  sessionUnits: number;
  hours: number;
  pricePerStudent?: number;
  notes?: string;
}

interface PrivateClassIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  enrollment?: Enrollment | null;
  group?: Group | null;
  session?: Session | null;
  onConfirm: (result: PrivateClassIntakeResult) => void;
}

export const PrivateClassIntakeModal: React.FC<PrivateClassIntakeModalProps> = ({
  isOpen,
  onClose,
  student,
  enrollment,
  group,
  session,
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
    return allEnrs.find((e) => {
      const g = allGroups.find((grp) => grp.id === e.groupId);
      return e.serviceType === 'private' || g?.type === 'private';
    }) || allEnrs[0] || null;
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

  // Initial unit values
  const initialSessionUnits = useMemo(() => {
    if (session?.sessionUnits !== undefined && session?.sessionUnits !== null && session.sessionUnits > 0) {
      return Number(session.sessionUnits);
    }
    return 1;
  }, [session]);

  const initialHours = useMemo(() => {
    if (session?.hours !== undefined && session?.hours !== null && session.hours > 0) {
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

  // Reset when modal opens or session/student changes
  React.useEffect(() => {
    if (isOpen) {
      const units = initialSessionUnits;
      const hrs = initialHours;
      setSelectedUnits(units);
      setSelectedHours(hrs);
      setCustomUnitsInput(String(units));
      setCustomHoursInput(String(hrs));
      setIsCustomMode(![0.5, 1, 1.5, 2, 2.5, 3].includes(units));
      setNotes(session?.notes || '');
    }
  }, [isOpen, session, initialSessionUnits, initialHours]);

  // Predefined Session Presets
  const SESSION_PRESETS = [0.5, 1, 1.5, 2, 2.5, 3];

  // Predefined Hourly Presets (in hours)
  const HOURLY_PRESETS = [
    { labelAr: '30 دقيقة (0.5 س)', labelEn: '30 mins (0.5h)', value: 0.5 },
    { labelAr: '1 ساعة', labelEn: '1 hour', value: 1 },
    { labelAr: '1.5 ساعة', labelEn: '1.5 hours', value: 1.5 },
    { labelAr: '2 ساعة', labelEn: '2 hours', value: 2 },
    { labelAr: '2.5 ساعة', labelEn: '2.5 hours', value: 2.5 },
    { labelAr: '3 ساعات', labelEn: '3 hours', value: 3 },
  ];

  // Prices & Rates
  const baseSessionPrice = activeEnrollment?.customPrice || activeGroup?.defaultPrice || 100;
  const hourlyRate = activeEnrollment?.hourlyRate || activeGroup?.hourlyRate || activeEnrollment?.customPrice || activeGroup?.defaultPrice || 150;
  
  const packageTotalSessions = activeEnrollment?.packageSessionsCount || activeGroup?.packageSessionsCount || 8;
  const packageTotalPrice = activeEnrollment?.packagePrice || activeGroup?.defaultPrice || (packageTotalSessions * baseSessionPrice);
  const unitRate = packageTotalSessions > 0 ? divideMoney(packageTotalPrice, packageTotalSessions) : baseSessionPrice;

  // Live Calculations
  const calculatedSessionValue = useMemo(() => {
    if (isHourly) {
      return multiplyMoney(selectedHours, hourlyRate);
    }
    if (isPackage) {
      return multiplyMoney(selectedUnits, unitRate);
    }
    return multiplyMoney(selectedUnits, baseSessionPrice);
  }, [isHourly, isPackage, selectedUnits, selectedHours, hourlyRate, unitRate, baseSessionPrice]);

  // Package Remaining Projection
  const packageProjection = useMemo(() => {
    if (!isPackage || !activeEnrollment) return null;
    const currentFin = db.calculateEnrollmentFinancials(activeEnrollment.id);
    const currentUsed = currentFin?.attendedSessionsCount || 0;
    const projectedUsed = roundMoney(currentUsed + selectedUnits, 2);
    const projectedRemaining = Math.max(0, roundMoney(packageTotalSessions - projectedUsed, 2));
    return {
      currentUsed,
      projectedUsed,
      projectedRemaining,
      total: packageTotalSessions,
    };
  }, [isPackage, activeEnrollment, selectedUnits, packageTotalSessions]);

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

  const handleConfirm = () => {
    const finalUnits = isHourly ? 1 : selectedUnits;
    const finalHours = isHourly ? selectedHours : selectedHours;
    onConfirm({
      sessionUnits: finalUnits,
      hours: finalHours,
      pricePerStudent: calculatedSessionValue,
      notes: notes.trim(),
    });
    onClose();
  };

  const modalLayer = useModalLayer('private-class-intake', isOpen, onClose);
  const swipeDownGestures = useSwipeGesture({ onSwipeDown: onClose, threshold: 45 });

  if (!isOpen || !student) return null;

  return (
    <ModalPortal>
      <div
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-[#17163D]/70 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#F6F7FC] border border-[#E8E7FF] rounded-t-[32px] sm:rounded-[32px] max-w-lg w-full mx-auto max-h-[94vh] flex flex-col overflow-hidden shadow-2xl relative select-none-touch">
          {/* Header */}
          <div
            {...swipeDownGestures}
            className="p-5 bg-gradient-to-r from-[#17163D] via-[#403B9C] to-[#7657F6] text-white flex flex-col shrink-0 relative overflow-hidden cursor-grab active:cursor-grabbing"
          >
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden w-full pb-2 flex items-center justify-center -mt-2">
              <div className="modal-drag-handle" />
            </div>

            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Sparkles className="w-5 h-5 text-[#FF647C]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                    {isEn ? 'Private Lesson Details' : 'تفاصيل الدرس الخاص'}
                  </h2>
                  <p className="text-xs text-[#E8E7FF]/90 font-medium truncate">
                    {student.name} • {activeGroup?.subject || (isEn ? 'Private Lesson' : 'درس خاص')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer relative z-10 active:scale-95"
                title={t('close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-5 overflow-y-auto android-scrollbar flex-1 space-y-4 text-xs text-[#191A2E]">
            {/* Question Banner */}
            <div className="p-3.5 rounded-2xl bg-white border border-[#E8E7FF] shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-[#7657F6]" />
                  <strong className="text-xs sm:text-sm font-black text-[#17163D]">
                    {isEn ? 'What was the lesson intake?' : 'الطالب أخذ كام؟'}
                  </strong>
                </div>

                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#E8E7FF] text-[#7657F6] border border-[#7657F6]/20">
                  {isHourly
                    ? (isEn ? 'Hourly Billing' : 'نظام بالساعة')
                    : isPackage
                    ? (isEn ? 'Session Package' : 'باقة حصص')
                    : isMonthly
                    ? (isEn ? 'Monthly Subscription' : 'اشتراك شهري')
                    : (isEn ? 'Per-Session' : 'حساب بالحصة')}
                </span>
              </div>

              <p className="text-[11px] text-[#74778F] font-medium leading-relaxed">
                {isHourly
                  ? (isEn ? 'Select the exact completed duration for this private class.' : 'حدد المدة الفعلية التي استغرقها الدرس الخاص.')
                  : (isEn ? 'Select the exact number of session units completed for this private class.' : 'حدد عدد الحصص أو الأجزاء الفعلية التي استهلكها الطالب في هذا الدرس.')}
              </p>
            </div>

            {/* 1. If Hourly Mode */}
            {isHourly && (
              <div className="space-y-2.5">
                <label className="font-black text-xs text-[#17163D] block">
                  {isEn ? 'Select Duration / Hours:' : 'المدة المحسوبة بالساعة:'}
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {HOURLY_PRESETS.map((p) => {
                    const isSelected = !isCustomMode && selectedHours === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => handleSelectPresetHour(p.value)}
                        className={`py-2.5 px-3 rounded-2xl font-black text-xs transition-all border flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                          isSelected
                            ? 'bg-[#7657F6] text-white border-[#7657F6] shadow-md'
                            : 'bg-white text-[#17163D] border-[#E8E7FF] hover:border-[#7657F6]/40'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                        <span>{isEn ? p.labelEn : p.labelAr}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Hour Button / Field */}
                <div className="pt-1">
                  {!isCustomMode ? (
                    <button
                      type="button"
                      onClick={() => setIsCustomMode(true)}
                      className="w-full py-2 px-3 rounded-xl bg-white border border-dashed border-[#7657F6]/40 text-[#7657F6] font-black text-xs hover:bg-[#E8E7FF]/40 transition-all text-center cursor-pointer active:scale-95"
                    >
                      + {isEn ? 'Custom Duration...' : 'تحديد مدة مخصصة...'}
                    </button>
                  ) : (
                    <div className="p-3 bg-white rounded-2xl border border-[#7657F6] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-[#17163D]">
                          {isEn ? 'Enter Custom Duration (Hours):' : 'أدخل المدة بالساعات (مثال: 1.75 أو 3.5):'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsCustomMode(false)}
                          className="text-[10px] text-[#74778F] font-bold hover:underline"
                        >
                          {isEn ? 'Back to presets' : 'الرجوع للخيارات الجاهزة'}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.25"
                          min="0.25"
                          max="12"
                          value={customHoursInput}
                          onChange={(e) => handleCustomHoursChange(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] text-xs font-black text-[#17163D] focus:outline-none focus:border-[#7657F6]"
                          placeholder="e.g. 2.5"
                        />
                        <span className="font-black text-xs text-[#74778F] shrink-0">
                          {isEn ? 'Hours' : 'ساعة'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. If Session / Package / Postpaid Mode */}
            {!isHourly && (
              <div className="space-y-2.5">
                <label className="font-black text-xs text-[#17163D] block">
                  {isEn ? 'Select Intake (Session Units):' : 'الكمية المستهلكة من الحصص:'}
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {SESSION_PRESETS.map((val) => {
                    const isSelected = !isCustomMode && selectedUnits === val;
                    const label = isEn
                      ? `${val} ${val === 1 ? 'Session' : 'Sessions'}`
                      : `${val} ${val === 1 ? 'حصة' : val >= 3 && val <= 10 ? 'حصص' : 'حصة'}`;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleSelectPresetUnit(val)}
                        className={`py-2.5 px-2 rounded-2xl font-black text-xs transition-all border flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                          isSelected
                            ? 'bg-gradient-to-r from-[#7657F6] to-[#5B3CE0] text-white border-[#7657F6] shadow-md'
                            : 'bg-white text-[#17163D] border-[#E8E7FF] hover:border-[#7657F6]/40'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Units Button / Field */}
                <div className="pt-1">
                  {!isCustomMode ? (
                    <button
                      type="button"
                      onClick={() => setIsCustomMode(true)}
                      className="w-full py-2 px-3 rounded-xl bg-white border border-dashed border-[#7657F6]/40 text-[#7657F6] font-black text-xs hover:bg-[#E8E7FF]/40 transition-all text-center cursor-pointer active:scale-95"
                    >
                      + {isEn ? 'Custom Session Fraction...' : 'تحديد كمية مخصصة (مثال: 0.75 أو 1.25)...'}
                    </button>
                  ) : (
                    <div className="p-3 bg-white rounded-2xl border border-[#7657F6] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-[#17163D]">
                          {isEn ? 'Enter Custom Fraction:' : 'أدخل عدد الحصص (مثال: 1.25 أو 2.5):'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsCustomMode(false)}
                          className="text-[10px] text-[#74778F] font-bold hover:underline"
                        >
                          {isEn ? 'Back to presets' : 'الرجوع للخيارات الجاهزة'}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.25"
                          min="0.1"
                          max="20"
                          value={customUnitsInput}
                          onChange={(e) => handleCustomUnitsChange(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] text-xs font-black text-[#17163D] focus:outline-none focus:border-[#7657F6]"
                          placeholder="e.g. 1.5"
                        />
                        <span className="font-black text-xs text-[#74778F] shrink-0">
                          {isEn ? 'Sessions' : 'حصة'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Financial Summary Bento Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-white to-[#F6F7FC] border border-[#E8E7FF] shadow-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#E8E7FF] pb-2">
                <span className="text-xs font-bold text-[#74778F]">
                  {isHourly
                    ? (isEn ? 'Hourly Rate' : 'سعر الساعة')
                    : isPackage
                    ? (isEn ? 'Package Unit Rate' : 'سعر الحصة في الباقة')
                    : (isEn ? 'Session Rate' : 'سعر الحصة')}
                </span>
                <span className="font-black text-xs text-[#17163D]">
                  {isHourly ? hourlyRate : isPackage ? unitRate : baseSessionPrice} {t('currency')}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-[#E8E7FF] pb-2">
                <span className="text-xs font-bold text-[#74778F]">
                  {isHourly
                    ? (isEn ? 'Calculated Duration' : 'المدة المحسوبة')
                    : (isEn ? 'Consumed Units' : 'الكمية المحسوبة')}
                </span>
                <span className="font-black text-xs text-[#7657F6]">
                  {isHourly ? `${selectedHours} ${isEn ? 'hours' : 'ساعة'}` : `${selectedUnits} ${isEn ? 'sessions' : 'حصة'}`}
                </span>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-xs font-black text-[#17163D]">
                  {isEn ? 'Total Class Value' : 'إجمالي قيمة هذا الدرس'}
                </span>
                <span className="text-base font-black text-emerald-700">
                  {calculatedSessionValue} {t('currency')}
                </span>
              </div>

              {/* Package Details if applicable */}
              {packageProjection && (
                <div className="mt-2 p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200/80 text-[11px] space-y-1 text-indigo-900">
                  <div className="flex items-center justify-between font-bold">
                    <span>{isEn ? 'Package Usage After this Class:' : 'استهلاك الباقة بعد هذا الدرس:'}</span>
                    <span className="font-black">{packageProjection.projectedUsed} / {packageProjection.total} {isEn ? 'sessions' : 'حصة'}</span>
                  </div>
                  <div className="flex items-center justify-between text-indigo-700">
                    <span>{isEn ? 'Remaining in Package:' : 'المتبقي في الباقة:'}</span>
                    <strong className="font-black">{packageProjection.projectedRemaining} {isEn ? 'sessions' : 'حصة'}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Notes */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#74778F] block">
                {isEn ? 'Notes (Optional):' : 'ملاحظات المعلم على الدرس (اختياري):'}
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isEn ? 'e.g. Covered Chapter 3 problems' : 'مثال: تم حل مسائل الفصل الثالث'}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#E8E7FF] text-xs text-[#191A2E] placeholder:text-[#74778F]/50 focus:outline-none focus:border-[#7657F6]"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-white border-t border-[#E8E7FF] flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#F6F7FC] hover:bg-[#E8E7FF] text-[#74778F] font-bold text-xs transition-all cursor-pointer active:scale-95"
            >
              {t('cancel')}
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isEn ? 'Confirm & Record Present' : 'تأكيد وتسجيل الحضور'}</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
