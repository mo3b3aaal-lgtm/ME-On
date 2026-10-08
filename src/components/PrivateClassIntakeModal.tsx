import React, { useState, useMemo, useEffect } from 'react';
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
  Plus,
  Minus,
  RotateCcw,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Bookmark,
  Zap,
} from 'lucide-react';
import { Student, Enrollment, Group, Session, AttendanceStatus } from '../types';
import {
  db,
  roundMoney,
  multiplyMoney,
  divideMoney,
  addMoney,
  subtractMoney,
  formatMoney,
  formatSessionQuantityDisplay,
} from '../utils/storage';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import { useTranslation } from '../utils/i18n';
import { useSwipeGesture } from '../utils/useSwipeGesture';

export interface PrivateClassIntakeResult {
  sessionUnits?: number;
  hours?: number;
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
      const units = initialSessionUnits;
      const hrs = initialHours;
      setSelectedUnits(units);
      setSelectedHours(hrs);
      setCustomUnitsInput(String(units));
      setCustomHoursInput(String(hrs));
      setIsCustomMode(![0.5, 1, 1.5, 2, 2.5, 3].includes(isHourly ? hrs : units));
      setNotes(session?.notes || '');
    }
  }, [isOpen, session, initialSessionUnits, initialHours, isHourly]);

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
    if (isHourly) {
      return multiplyMoney(selectedHours, hourlyRate);
    }
    if (isPackage) {
      return multiplyMoney(selectedUnits, unitRate);
    }
    return multiplyMoney(selectedUnits, baseSessionPrice);
  }, [isHourly, isPackage, selectedUnits, selectedHours, hourlyRate, unitRate, baseSessionPrice]);

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
    const projectedUsed = roundMoney(baseUsed + selectedUnits, 2);
    const afterRemaining = Math.max(0, roundMoney(packageTotalSessions - projectedUsed, 2));
    return {
      baseUsed,
      beforeRemaining,
      thisSessionUnits: selectedUnits,
      projectedUsed,
      afterRemaining,
      total: packageTotalSessions,
    };
  }, [isPackage, activeEnrollment, selectedUnits, packageTotalSessions, session, currentFin]);

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
        className="fixed inset-0 bg-[#293828]/70 backdrop-blur-md flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#DDD3C7]/15 border border-[#DDD3C7] rounded-t-[32px] sm:rounded-[32px] max-w-lg w-full mx-auto max-h-[94vh] flex flex-col overflow-hidden shadow-2xl relative select-none-touch">
          {/* 1. Header with Smart Session Studio Badge */}
          <div
            {...swipeDownGestures}
            className="p-5 bg-gradient-to-r from-[#293828] via-[#0F1206] to-[#293828] text-[#F8F2EC] flex flex-col shrink-0 relative overflow-hidden cursor-grab active:cursor-grabbing shadow-sm"
          >
            {/* Mobile Drag Indicator */}
            <div className="sm:hidden w-full pb-2 flex items-center justify-center -mt-2">
              <div className="modal-drag-handle" />
            </div>

            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#293828] to-[#0F1206] text-[#F8F2EC] flex items-center justify-center shrink-0 shadow-md shadow-[#0F1206]/20 border border-[#DDD3C7]/25">
                  <Zap className="w-5 h-5 text-[#DDD3C7] animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-[#F8F2EC] tracking-tight truncate">
                      {isEn ? 'Smart Session Studio' : 'استوديو رصد الحصة الذكي'}
                    </h2>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#F8F2EC]/20 text-[#F8F2EC] border border-[#DDD3C7]/30">
                      {isHourly ? (isEn ? 'Hourly' : 'ساعات') : (isEn ? 'Lessons' : 'حصص')}
                    </span>
                  </div>
                  <p className="text-xs text-[#DDD3C7]/90 font-medium truncate">
                    {student.name} • {activeGroup?.subject || (isEn ? 'Private Tutoring' : 'درس خاص')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-2xl bg-[#F8F2EC]/10 hover:bg-[#F8F2EC]/20 text-[#F8F2EC] border border-[#DDD3C7]/20 transition-all cursor-pointer relative z-10 active:scale-95"
                title={t('close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2. Modal Body */}
          <div className="p-4 sm:p-5 overflow-y-auto android-scrollbar flex-1 space-y-4 text-xs text-[#0F1206]">
            {/* Smart Memory Suggestion Banner */}
            {rememberedQuantity !== null && rememberedQuantity > 0 && rememberedQuantity !== (isHourly ? selectedHours : selectedUnits) && (
              <div className="p-2.5 rounded-2xl bg-gradient-to-r from-[#F8F2EC] to-[#F8F2EC] border border-[#DDD3C7]/80 flex items-center justify-between gap-2 shadow-2xs animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Bookmark className="w-4 h-4 text-[#0F1206] shrink-0" />
                  <span className="text-[11px] text-[#0F1206] font-bold truncate">
                    {isEn
                      ? `Last used quantity for ${student.name}:`
                      : `الكمية السابقة لـ ${student.name}:`}
                    <strong className="ms-1 text-[#0F1206] font-black">
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
                  className="px-2.5 py-1 rounded-xl bg-[#DDD3C7]/700 hover:bg-[#0F1206] text-[#F8F2EC] text-[10px] font-black shrink-0 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  {isEn ? 'Repeat Last' : 'تكرار السابقة'}
                </button>
              </div>
            )}

            {/* A. INTERACTIVE QUANTITY CONTROLLER (Focal Segmented Hub) */}
            <div className="p-4 sm:p-5 rounded-3xl bg-[#F8F2EC] border border-[#DDD3C7] shadow-xs space-y-4 text-center relative overflow-hidden">
              <span className="text-[11px] font-black text-[#756046] block uppercase tracking-wider">
                {isHourly
                  ? (isEn ? 'Session Duration (Hours)' : 'مدة الحصة الفعلية (بالساعات)')
                  : (isEn ? 'Lesson Intake Quantity' : 'كمية الحصص المنفذة')}
              </span>

              {/* Central Focal Value with Steppers */}
              <div className="flex items-center justify-center gap-4 sm:gap-6 py-2">
                {/* Decrement (- 0.5) */}
                <button
                  type="button"
                  onClick={() => handleStepChange(-0.5)}
                  disabled={(isHourly ? selectedHours : selectedUnits) <= 0.5}
                  className="w-12 h-12 rounded-2xl bg-[#DDD3C7]/15 hover:bg-[#DDD3C7]/35 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border border-[#DDD3C7] flex items-center justify-center text-[#0F1206] font-black transition-all shadow-2xs cursor-pointer"
                  title="- 0.5"
                >
                  <Minus className="w-5 h-5 text-[#293828]" />
                </button>

                {/* Big Hero Number & Unit */}
                <div className="min-w-[150px] p-3.5 rounded-3xl bg-gradient-to-b from-[#F8F2EC] to-[#DDD3C7]/40 border border-[#293828]/30 shadow-inner">
                  <div className="text-3xl sm:text-4xl font-black text-[#0F1206] tracking-tight">
                    {isHourly ? selectedHours : selectedUnits}
                  </div>
                  <div className="text-xs font-black text-[#293828] mt-0.5">
                    {formatSessionQuantityDisplay(
                      isHourly ? { hours: selectedHours, isHourly: true } : { sessionUnits: selectedUnits, isHourly: false },
                      isRTL
                    )}
                  </div>
                </div>

                {/* Increment (+ 0.5) */}
                <button
                  type="button"
                  onClick={() => handleStepChange(0.5)}
                  className="w-12 h-12 rounded-2xl bg-[#DDD3C7]/15 hover:bg-[#DDD3C7]/35 active:scale-95 border border-[#DDD3C7] flex items-center justify-center text-[#0F1206] font-black transition-all shadow-2xs cursor-pointer"
                  title="+ 0.5"
                >
                  <Plus className="w-5 h-5 text-[#293828]" />
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
                          className={`py-2 px-1 rounded-2xl font-black text-xs transition-all border cursor-pointer ${
                            isSel
                              ? 'bg-[#293828] text-[#F8F2EC] border-[#293828] shadow-md shadow-[#0F1206]/20 scale-[1.02]'
                              : 'bg-[#DDD3C7]/15 text-[#756046] border-[#DDD3C7] hover:border-[#293828]/40 hover:text-[#0F1206]'
                          }`}
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
                          className={`py-2 px-1.5 rounded-2xl font-black text-xs transition-all border cursor-pointer ${
                            isSel
                              ? 'bg-[#293828] text-[#F8F2EC] border-[#293828] shadow-md shadow-[#0F1206]/20 scale-[1.02]'
                              : 'bg-[#DDD3C7]/15 text-[#756046] border-[#DDD3C7] hover:border-[#293828]/40 hover:text-[#0F1206]'
                          }`}
                        >
                          {unit} {isEn ? (unit === 1 ? 'Lesson' : 'Lessons') : (unit === 1 ? 'حصة' : 'حصص')}
                        </button>
                      );
                    })}
              </div>

              {/* Custom Value Toggle & Input */}
              <div className="pt-2 border-t border-[#DDD3C7]/60 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsCustomMode(!isCustomMode)}
                  className={`text-[11px] font-black flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isCustomMode ? 'text-[#293828]' : 'text-[#756046] hover:text-[#0F1206]'
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
                      value={isHourly ? customHoursInput : customUnitsInput}
                      onChange={(e) =>
                        isHourly
                          ? handleCustomHoursChange(e.target.value)
                          : handleCustomUnitsChange(e.target.value)
                      }
                      placeholder="e.g. 1.25"
                      className="w-24 p-1.5 text-center rounded-xl bg-[#DDD3C7]/15 border border-[#293828] font-black text-xs text-[#0F1206] focus:outline-none"
                    />
                    <span className="text-[11px] font-bold text-[#756046]">
                      {isHourly ? (isEn ? 'hours' : 'ساعة') : (isEn ? 'lessons' : 'حصة')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* B. LIVE FINANCIAL IMPACT PANEL */}
            <div className="p-4 rounded-3xl bg-gradient-to-br from-[#F8F2EC] via-[#F8F2EC] to-[#F8F2EC] border border-[#DDD3C7] shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#DDD3C7] pb-2">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-[#293828]" />
                  <span className="font-black text-xs text-[#0F1206]">
                    {isEn ? 'Live Financial Impact' : 'الأثر المالي المباشر للحصة'}
                  </span>
                </div>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#DDD3C7]/25 text-[#0F1206]">
                  {isPrepaid
                    ? (isEn ? 'Prepaid (Auto-settled)' : 'مسبق (تسوية فورية)')
                    : isPackage
                    ? (isEn ? 'Package Consumption' : 'خصم من الباقة')
                    : isHourly
                    ? (isEn ? 'Hourly Rate' : 'حساب بالساعة')
                    : (isEn ? 'Postpaid Session' : 'حساب بالحصة')}
                </span>
              </div>

              {/* Financial Calculation Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-start">
                <div className="p-3 rounded-2xl bg-[#F8F2EC] border border-[#DDD3C7] space-y-0.5">
                  <span className="text-[10px] text-[#756046] block font-bold">
                    {isHourly ? (isEn ? 'Hourly Rate' : 'سعر الساعة') : (isEn ? 'Price / Lesson' : 'سعر الحصة')}
                  </span>
                  <strong className="text-sm font-black text-[#0F1206] block">
                    {isHourly ? hourlyRate : isPackage ? unitRate : baseSessionPrice} {t('currency')}
                  </strong>
                </div>

                <div className="p-3 rounded-2xl bg-[#F8F2EC] border border-[#DDD3C7] space-y-0.5">
                  <span className="text-[10px] text-[#756046] block font-bold">
                    {isEn ? 'This Session Total' : 'إجمالي قيمة الحصة'}
                  </span>
                  <strong className="text-sm font-black text-[#0F1206] block">
                    {calculatedSessionValue} {t('currency')}
                  </strong>
                </div>

                <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-[#F8F2EC] border border-[#DDD3C7] space-y-0.5">
                  <span className="text-[10px] text-[#756046] block font-bold">
                    {isEn ? 'Outstanding Dues' : 'الرصيد المتبقي على الطالب'}
                  </span>
                  <strong
                    className={`text-sm font-black block ${
                      (currentFin?.remaining || 0) > 0 ? 'text-[#0F1206]' : 'text-[#0F1206]'
                    }`}
                  >
                    {currentFin?.remaining || 0} {t('currency')}
                  </strong>
                </div>
              </div>
            </div>

            {/* C. BEFORE & AFTER PACKAGE VISUALIZATION (For Package Students) */}
            {packageProjection && (
              <div className="p-4 rounded-3xl bg-gradient-to-br from-[#293828]/5 via-[#F8F2EC] to-[#293828]/5 border border-[#293828]/30 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#293828]" />
                    <span className="font-black text-xs text-[#0F1206]">
                      {isEn ? 'Package Progress (Before & After)' : 'تطور رصيد الباقة (قبل وبعد الرصد)'}
                    </span>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#DDD3C7]/25 text-[#293828]">
                    {packageProjection.total} {isEn ? 'Lessons Package' : 'حصص في الباقة'}
                  </span>
                </div>

                {/* Comparison Bento */}
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  {/* Before */}
                  <div className="p-2.5 rounded-2xl bg-[#F8F2EC] border border-[#DDD3C7] space-y-1">
                    <span className="text-[10px] font-bold text-[#756046] block">
                      {isEn ? 'Before' : 'قبل الرصد'}
                    </span>
                    <strong className="text-xs font-black text-[#0F1206] block">
                      {packageProjection.beforeRemaining} {isEn ? 'rem.' : 'متبقية'}
                    </strong>
                    <span className="text-[9px] text-[#756046] block">
                      {packageProjection.baseUsed} {isEn ? 'used' : 'مستهلكة'}
                    </span>
                  </div>

                  {/* This Session */}
                  <div className="p-2.5 rounded-2xl bg-[#293828]/10 border border-[#293828]/40 space-y-1">
                    <span className="text-[10px] font-bold text-[#293828] block">
                      {isEn ? 'This Session' : 'هذه الحصة'}
                    </span>
                    <strong className="text-xs font-black text-[#293828] block">
                      -{packageProjection.thisSessionUnits} {isEn ? 'lessons' : 'حصة'}
                    </strong>
                    <span className="text-[9px] text-[#756046] block">
                      {calculatedSessionValue} {t('currency')}
                    </span>
                  </div>

                  {/* After */}
                  <div className="p-2.5 rounded-2xl bg-[#DDD3C7]/65 border border-[#293828]/50 space-y-1">
                    <span className="text-[10px] font-bold text-[#0F1206] block">
                      {isEn ? 'After' : 'بعد الرصد'}
                    </span>
                    <strong className="text-xs font-black text-[#0F1206] block">
                      {packageProjection.afterRemaining} {isEn ? 'rem.' : 'متبقية'}
                    </strong>
                    <span className="text-[9px] text-[#293828] font-bold block">
                      {packageProjection.projectedUsed} / {packageProjection.total}
                    </span>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="space-y-1 pt-1">
                  <div className="h-2.5 w-full bg-[#DDD3C7]/25 rounded-full overflow-hidden flex">
                    <div
                      style={{
                        width: `${Math.min(100, (packageProjection.projectedUsed / packageProjection.total) * 100)}%`,
                      }}
                      className="bg-gradient-to-r from-[#293828] to-[#0F1206] h-full transition-all duration-300"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#756046] font-bold">
                    <span>{packageProjection.projectedUsed} {isEn ? 'consumed' : 'مستهلك'}</span>
                    <span>{packageProjection.afterRemaining} {isEn ? 'remaining' : 'متبقي'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Optional Notes */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-[#756046]">
                {isEn ? 'Session Notes (Optional):' : 'ملاحظات الحصة (اختياري):'}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isEn ? 'Topics covered, homework, remarks...' : 'الموضوعات المغطاة، الواجب، ملاحظات المعلم...'}
                className="w-full p-2.5 rounded-2xl bg-[#F8F2EC] border border-[#DDD3C7] text-xs font-medium text-[#0F1206] focus:outline-none focus:border-[#293828] resize-none h-16"
              />
            </div>
          </div>

          {/* 3. Footer Actions */}
          <div className="p-4 sm:p-5 bg-[#F8F2EC] border-t border-[#DDD3C7] flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              {t('cancel')}
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="btn-primary flex-1"
            >
              <Check className="w-4 h-4" />
              <span>
                {isEn
                  ? `Confirm & Save (${formatSessionQuantityDisplay(
                      isHourly ? { hours: selectedHours, isHourly: true } : { sessionUnits: selectedUnits, isHourly: false },
                      isRTL
                    )})`
                  : `تأكيد واعتماد الحصة (${formatSessionQuantityDisplay(
                      isHourly ? { hours: selectedHours, isHourly: true } : { sessionUnits: selectedUnits, isHourly: false },
                      isRTL
                    )})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
