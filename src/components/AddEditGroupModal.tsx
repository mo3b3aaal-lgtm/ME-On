import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Clock,
  MapPin,
  DollarSign,
  Calendar,
  GraduationCap,
  Plus,
  Trash2,
  BookOpen,
  Sparkles,
  Check,
  Zap,
} from 'lucide-react';
import { Group, GroupType, BillingType } from '../types';
import { db, divideMoney } from '../utils/storage';
import { ALL_GRADE_LEVELS, STAGES_HIERARCHY, getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import {
  CanonicalWeekday,
  CANONICAL_WEEKDAYS,
  normalizeWeekdayKey,
  normalizeScheduleDays,
  normalizeScheduleTimes,
  normalizeScheduleTimesList,
  getLocalizedWeekdayName,
  getLocalizedSubjectName,
  getLocalizedLocationName,
} from '../utils/schedule';

interface AddEditGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingGroup?: Group | null;
  onSaveComplete: (savedGroup: Group) => void;
}

const GROUP_COLORS = [
  '#0A3D62', // Sapphire (Primary Blue)
  '#16324F', // Navy (Dark Blue)
  '#6F7882', // Steel Grey (Secondary Neutral)
];

const WEEK_DAYS_CONFIG: { key: CanonicalWeekday; labelKey: string }[] = [
  { key: 'saturday', labelKey: 'daySat' },
  { key: 'sunday', labelKey: 'daySun' },
  { key: 'monday', labelKey: 'dayMon' },
  { key: 'tuesday', labelKey: 'dayTue' },
  { key: 'wednesday', labelKey: 'dayWed' },
  { key: 'thursday', labelKey: 'dayThu' },
  { key: 'friday', labelKey: 'dayFri' },
];

export const AddEditGroupModal: React.FC<AddEditGroupModalProps> = ({
  isOpen,
  onClose,
  editingGroup,
  onSaveComplete,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('الصف الأول الثانوي');
  const [type, setType] = useState<GroupType>('group');
  const [billingType, setBillingType] = useState<BillingType>('per_session');
  const [defaultPrice, setDefaultPrice] = useState<number>(100);
  const [hourlyRate, setHourlyRate] = useState<number>(150);
  const [packageSessionsCount, setPackageSessionsCount] = useState<number>(10);
  const [scheduleDays, setScheduleDays] = useState<CanonicalWeekday[]>(['saturday', 'tuesday']);
  const [scheduleTime, setScheduleTime] = useState('16:00');
  const [scheduleTimes, setScheduleTimes] = useState<Record<CanonicalWeekday, string[]>>({
    saturday: ['16:00'],
    sunday: [],
    monday: [],
    tuesday: ['16:00'],
    wednesday: [],
    thursday: [],
    friday: [],
  });
  const [roomOrLocation, setRoomOrLocation] = useState('');
  const [accentColor, setAccentColor] = useState(GROUP_COLORS[0]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editingGroup) {
      setName(editingGroup.name);
      setSubject(editingGroup.subject);
      setGradeLevel(editingGroup.gradeLevel);
      setType(editingGroup.type);
      setBillingType(editingGroup.billingType);
      setDefaultPrice(editingGroup.defaultPrice);
      setHourlyRate(editingGroup.hourlyRate || 150);
      setPackageSessionsCount(editingGroup.packageSessionsCount || 10);

      const normDays = normalizeScheduleDays(editingGroup.scheduleDays);
      setScheduleDays(normDays.length > 0 ? normDays : ['saturday', 'tuesday']);
      setScheduleTime(editingGroup.scheduleTime || '16:00');

      const normTimes = normalizeScheduleTimes(
        editingGroup.scheduleTimes,
        editingGroup.scheduleTime || '16:00',
        editingGroup.scheduleDays
      );
      setScheduleTimes(normTimes);

      setRoomOrLocation(editingGroup.roomOrLocation || '');
      setAccentColor(editingGroup.accentColor || GROUP_COLORS[0]);
      setNotes(editingGroup.notes || '');
    } else {
      setName('');
      setSubject('');
      setGradeLevel('الصف الأول الثانوي');
      setType('group');
      setBillingType('per_session');
      setDefaultPrice(100);
      setHourlyRate(150);
      setPackageSessionsCount(10);
      setScheduleDays(['saturday', 'tuesday']);
      setScheduleTime('16:00');
      setScheduleTimes({
        saturday: ['16:00'],
        sunday: [],
        monday: [],
        tuesday: ['16:00'],
        wednesday: [],
        thursday: [],
        friday: [],
      });
      setRoomOrLocation('');
      setAccentColor(GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)]);
      setNotes('');
    }
  }, [editingGroup, isOpen]);

  const toggleDay = (dayKey: CanonicalWeekday) => {
    if (scheduleDays.includes(dayKey)) {
      setScheduleDays(scheduleDays.filter((d) => d !== dayKey));
    } else {
      setScheduleDays([...scheduleDays, dayKey]);
      if (!scheduleTimes[dayKey] || scheduleTimes[dayKey].length === 0) {
        setScheduleTimes((prev) => ({
          ...prev,
          [dayKey]: [scheduleTime || '16:00'],
        }));
      }
    }
  };

  const handleDayTimeChange = (dayKey: CanonicalWeekday, timeIdx: number, timeVal: string) => {
    setScheduleTimes((prev) => {
      const currentList = prev[dayKey] ? [...prev[dayKey]] : ['16:00'];
      currentList[timeIdx] = timeVal;
      return { ...prev, [dayKey]: currentList };
    });
  };

  const handleAddDayTime = (dayKey: CanonicalWeekday) => {
    setScheduleTimes((prev) => {
      const currentList = prev[dayKey] && prev[dayKey].length > 0 ? [...prev[dayKey]] : ['16:00'];
      const lastTime = currentList[currentList.length - 1] || '16:00';
      const [h, m] = lastTime.split(':').map(Number);
      const nextH = !isNaN(h) ? Math.min(23, (h + 3) % 24) : 19;
      const nextTimeStr = `${String(nextH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
      return { ...prev, [dayKey]: [...currentList, nextTimeStr] };
    });
  };

  const handleRemoveDayTime = (dayKey: CanonicalWeekday, timeIdx: number) => {
    setScheduleTimes((prev) => {
      const currentList = prev[dayKey] ? [...prev[dayKey]] : ['16:00'];
      if (currentList.length <= 1) return prev;
      const updated = currentList.filter((_, idx) => idx !== timeIdx);
      return { ...prev, [dayKey]: updated };
    });
  };

  const applyTimeToAllDays = (timeVal: string) => {
    const updated: Record<CanonicalWeekday, string[]> = { ...scheduleTimes };
    scheduleDays.forEach((d) => {
      updated[d] = [timeVal];
    });
    setScheduleTimes(updated);
    setScheduleTime(timeVal);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !subject.trim()) return;

    if (billingType === 'package' && (!packageSessionsCount || packageSessionsCount <= 0)) {
      alert(isEn ? 'Please enter a valid number of sessions for the package (>0)' : 'يرجى إدخال عدد حصص صحيح للباقة (أكبر من 0)');
      return;
    }

    const groupId = editingGroup
      ? editingGroup.id
      : `grp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Build clean canonical schedule times
    const cleanScheduleTimes: Record<string, string[]> = {};
    scheduleDays.forEach((d) => {
      const list = normalizeScheduleTimesList(scheduleTimes[d] || [scheduleTime || '16:00']);
      cleanScheduleTimes[d] = list.length > 0 ? list : ['16:00'];
    });

    const primaryTime = cleanScheduleTimes[scheduleDays[0]]?.[0] || scheduleTime || '16:00';

    const groupToSave: Group = {
      id: groupId,
      name: name.trim(),
      subject: subject.trim(),
      gradeLevel,
      type,
      billingType,
      billingMode: billingType,
      defaultPrice: Number(defaultPrice) || 0,
      hourlyRate: billingType === 'hourly' ? Number(hourlyRate) || 0 : undefined,
      baseSessionsPerMonth: billingType === 'monthly' ? 8 : undefined,
      packageSessionsCount: billingType === 'package' ? Number(packageSessionsCount) || 10 : undefined,
      scheduleDays: scheduleDays, // Saved as CanonicalWeekday[]
      scheduleTime: primaryTime,
      scheduleTimes: cleanScheduleTimes,
      roomOrLocation: roomOrLocation.trim() || undefined,
      accentColor,
      notes: notes.trim() || undefined,
      createdAt: editingGroup ? editingGroup.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.saveGroup(groupToSave);
    onSaveComplete(groupToSave);
    onClose();
  };

  const modalLayer = useModalLayer('add-edit-group', isOpen, onClose);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-[#0A3D62]/70 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#FFFFFF] border border-[#C7CDD3] rounded-t-[28px] sm:rounded-[28px] max-w-lg w-full mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0A3D62] via-[#16324F] to-[#6F7882] text-[#FFFFFF] flex items-center justify-between shrink-0 relative overflow-hidden">
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-[#FFFFFF]/15 backdrop-blur-md border border-[#C7CDD3]/25 flex items-center justify-center text-[#FFFFFF] shadow-sm shrink-0">
                {type === 'private' ? <Zap className="w-5 h-5 text-[#FFFFFF]" /> : <Layers className="w-5 h-5 text-[#FFFFFF]" />}
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  {editingGroup
                    ? (isEn ? 'Edit Group Information' : 'تعديل بيانات المجموعة')
                    : (isEn ? 'Create New Study Group' : 'إنشاء مجموعة دراسية جديدة')}
                </h2>
                <p className="text-[11px] text-[#C7CDD3]/85 font-medium">
                  {isEn
                    ? 'Define group details, stage, weekly schedule, and tuition fees'
                    : 'تحديد بيانات المجموعة، المرحلة، مواعيد الحصص، ونظام المحاسبة'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[#FFFFFF]/10 hover:bg-[#FFFFFF]/20 text-[#FFFFFF] transition-colors cursor-pointer relative z-10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto android-scrollbar flex-1 space-y-4 text-xs bg-[#FFFFFF]">
            {/* Section 1: Basic Info */}
            <div className="classy-card p-4 space-y-3 bg-[#FFFFFF]">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#6F7882]">
                  {isEn ? 'Group Name *' : 'اسم المجموعة *'}
                </label>
                <div className="relative">
                  <BookOpen className={`w-4 h-4 text-[#6F7882] absolute top-2.5 ${isRTL ? 'right-3' : 'left-3'}`} />
                  <input
                    type="text"
                    required
                    placeholder={isEn ? 'e.g. Group A - Secondary 1' : 'مثال: مجموعة أوائل الثانوية (أ)'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full bg-[#C7CDD3]/15 border border-[#C7CDD3] rounded-xl ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 text-xs text-[#16324F] font-black focus:outline-none focus:border-[#0A3D62] focus:bg-[#FFFFFF] transition-colors`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#6F7882]">
                    {isEn ? 'Subject *' : 'المادة الدراسية *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isEn ? 'e.g. Mathematics, English, Physics' : 'مثال: رياضيات، لغة إنجليزية، فيزياء'}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-[#C7CDD3]/15 border border-[#C7CDD3] rounded-xl p-2 text-xs text-[#16324F] font-bold focus:outline-none focus:border-[#0A3D62] focus:bg-[#FFFFFF]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#6F7882]">
                    {isEn ? 'Grade Level *' : 'المرحلة / الصف الدراسي *'}
                  </label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full bg-[#C7CDD3]/15 border border-[#C7CDD3] rounded-xl p-2 text-xs text-[#16324F] font-bold focus:outline-none focus:border-[#0A3D62] focus:bg-[#FFFFFF] cursor-pointer"
                  >
                    {STAGES_HIERARCHY.map((stage) => (
                      <optgroup key={stage.id} label={isEn ? stage.nameEn : stage.nameAr}>
                        {stage.grades.map((grade) => (
                          <option key={grade.id} value={grade.nameAr}>
                            {isEn ? grade.nameEn : grade.nameAr}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              {/* Accent Color Picker */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-[#6F7882]">
                  {isEn ? 'Group Theme Color' : 'اللون المميز للمجموعة'}
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {GROUP_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAccentColor(c)}
                      className={`w-7 h-7 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                        accentColor === c ? 'scale-115 ring-2 ring-offset-2 ring-[#0A3D62]' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {accentColor === c && <Check className="w-3.5 h-3.5 text-[#FFFFFF]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 2: Schedule & Multiple Times per Day */}
            <div className="classy-card p-4 space-y-3.5 bg-[#FFFFFF]">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-xs text-[#16324F] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#0A3D62]" />
                  <span>{isEn ? 'Weekly Schedule Days & Times' : 'أيام ومواعيد الحصص الأسبوعية'}</span>
                </h3>
                <span className="text-[10px] text-[#6F7882]">
                  {isEn ? 'Multi-time slot support' : 'مواعيد متعددة في نفس اليوم'}
                </span>
              </div>

              {/* Weekday Selection Chips */}
              <div className="flex flex-wrap gap-1.5">
                {WEEK_DAYS_CONFIG.map((dayItem) => {
                  const isSelected = scheduleDays.includes(dayItem.key);
                  const dayLabel = getLocalizedWeekdayName(dayItem.key, isRTL);
                  return (
                    <button
                      key={dayItem.key}
                      type="button"
                      onClick={() => toggleDay(dayItem.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-[#0A3D62] text-[#FFFFFF] border-[#0A3D62] shadow-xs'
                          : 'bg-[#C7CDD3]/15 text-[#6F7882] border-[#C7CDD3] hover:bg-[#C7CDD3]/35'
                      }`}
                    >
                      {dayLabel}
                    </button>
                  );
                })}
              </div>

              {/* Multiple Time Slots per Selected Day */}
              {scheduleDays.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-[#C7CDD3]">
                  <div className="flex items-center justify-between text-[11px] text-[#6F7882] font-bold">
                    <span>{isEn ? 'Time slots per day:' : 'توقيت الحصص لكل يوم:'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const firstTime = scheduleTimes[scheduleDays[0]]?.[0] || scheduleTime || '16:00';
                        applyTimeToAllDays(firstTime);
                      }}
                      className="text-[#0A3D62] hover:underline cursor-pointer text-[10px]"
                    >
                      {isEn ? 'Apply first time to all days' : 'تطبيق التوقيت الأول على كل الأيام'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {scheduleDays.map((dayKey) => {
                      const dayTimesList = scheduleTimes[dayKey] && scheduleTimes[dayKey].length > 0
                        ? scheduleTimes[dayKey]
                        : [scheduleTime || '16:00'];
                      const dayLabel = getLocalizedWeekdayName(dayKey, isRTL);

                      return (
                        <div key={dayKey} className="p-2.5 bg-[#C7CDD3]/15 rounded-xl border border-[#C7CDD3] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-xs text-[#16324F]">{dayLabel}</span>
                            <button
                              type="button"
                              onClick={() => handleAddDayTime(dayKey)}
                              className="px-2 py-0.5 rounded-lg bg-[#C7CDD3]/25 hover:bg-[#C7CDD3]/40 text-[#0A3D62] font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              <span>{isEn ? '+ Extra Time' : '+ موعد إضافي'}</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {dayTimesList.map((timeVal, tIdx) => (
                              <div key={tIdx} className="flex items-center gap-1 bg-[#FFFFFF] p-1 rounded-lg border border-[#C7CDD3] shadow-2xs">
                                <Clock className="w-3.5 h-3.5 text-[#0A3D62] mr-1" />
                                <input
                                  type="time"
                                  value={timeVal}
                                  onChange={(e) => handleDayTimeChange(dayKey, tIdx, e.target.value)}
                                  className="bg-transparent text-xs font-mono font-bold text-[#16324F] focus:outline-none cursor-pointer"
                                />
                                {dayTimesList.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDayTime(dayKey, tIdx)}
                                    className="p-1 text-[#6F7882] hover:text-[#16324F] rounded transition-colors cursor-pointer"
                                    title={isEn ? 'Remove this time slot' : 'حذف هذا الموعد'}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Room / Location Input */}
              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-bold text-[#6F7882]">
                  {isEn ? 'Class Location / Room (Optional)' : 'مكان الحصة / القاعة (اختياري)'}
                </label>
                <div className="relative">
                  <MapPin className={`w-4 h-4 text-[#6F7882] absolute top-2.5 ${isRTL ? 'right-3' : 'left-3'}`} />
                  <input
                    type="text"
                    placeholder={isEn ? 'e.g. Center Room 2 / Online' : 'مثال: سنتر الأوائل - قاعة 2'}
                    value={roomOrLocation}
                    onChange={(e) => setRoomOrLocation(e.target.value)}
                    className={`w-full bg-[#C7CDD3]/15 border border-[#C7CDD3] rounded-xl ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 text-xs text-[#16324F] font-medium focus:outline-none focus:border-[#0A3D62] focus:bg-[#FFFFFF] transition-colors`}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Pricing & Billing */}
            <div className="classy-card p-4 space-y-3.5 bg-[#FFFFFF]">
              <h3 className="font-black text-xs text-[#16324F] flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-[#0A3D62]" />
                <span>{isEn ? 'Billing & Pricing System' : 'نظام المحاسبة والتسعير'}</span>
              </h3>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#6F7882]">
                  {isEn ? 'Default Billing Mode *' : 'طريقة المحاسبة الافتراضية *'}
                </label>
                <select
                  value={billingType}
                  onChange={(e) => setBillingType(e.target.value as BillingType)}
                  className="w-full bg-[#C7CDD3]/15 border border-[#C7CDD3] rounded-xl p-2.5 text-xs text-[#16324F] font-bold focus:outline-none focus:border-[#0A3D62] focus:bg-[#FFFFFF] cursor-pointer transition-colors"
                >
                  <option value="per_session">{isEn ? 'Per Session' : 'دفع بالحصة (Per Session)'}</option>
                  <option value="monthly">{isEn ? 'Monthly Subscription' : 'اشتراك شهري (Monthly)'}</option>
                  <option value="package">{isEn ? 'Session Package' : 'باقة عدد حصص (Session Package)'}</option>
                  <option value="hourly">{isEn ? 'Hourly Rate' : 'محاسبة بالساعة (Hourly)'}</option>
                </select>
              </div>

              {/* Pricing inputs depending on billingType */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {billingType === 'package' ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#6F7882]">
                        {isEn ? 'Package Sessions Count *' : 'عدد حصص الباقة *'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={packageSessionsCount}
                        onChange={(e) => setPackageSessionsCount(Number(e.target.value))}
                        className="w-full bg-[#C7CDD3]/15 border border-[#C7CDD3] rounded-xl p-2 text-xs font-bold text-[#16324F] focus:outline-none focus:border-[#0A3D62] focus:bg-[#FFFFFF]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#6F7882]">
                        {isEn ? `Package Total Price (${t('currency')}) *` : `سعر الباقة الإجمالي (${t('currency')}) *`}
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={defaultPrice}
                        onChange={(e) => setDefaultPrice(Number(e.target.value))}
                        className="w-full bg-[#C7CDD3]/15 border border-[#C7CDD3] rounded-xl p-2 text-xs font-bold text-[#16324F] focus:outline-none focus:border-[#0A3D62] focus:bg-[#FFFFFF]"
                      />
                    </div>
                  </>
                ) : billingType === 'hourly' ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#6F7882]">
                        {isEn ? `Hourly Rate (${t('currency')}) *` : `سعر الساعة (${t('currency')}) *`}
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(Number(e.target.value))}
                        className="w-full bg-[#C7CDD3]/15 border border-[#C7CDD3] rounded-xl p-2 text-xs font-bold text-[#16324F] focus:outline-none focus:border-[#0A3D62] focus:bg-[#FFFFFF]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#6F7882]">
                        {isEn ? `Base Session Price (${t('currency')})` : `سعر الحصة التقديري (${t('currency')})`}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={defaultPrice}
                        onChange={(e) => setDefaultPrice(Number(e.target.value))}
                        className="w-full bg-[#C7CDD3]/15 border border-[#C7CDD3] rounded-xl p-2 text-xs font-bold text-[#16324F] focus:outline-none focus:border-[#0A3D62] focus:bg-[#FFFFFF]"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] font-bold text-[#6F7882]">
                      {billingType === 'monthly'
                        ? (isEn ? `Monthly Subscription Price (${t('currency')}) *` : `قيمة الاشتراك الشهري (${t('currency')}) *`)
                        : (isEn ? `Class Price per Student (${t('currency')}) *` : `سعر الحصة للطالب (${t('currency')}) *`)}
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={defaultPrice}
                      onChange={(e) => setDefaultPrice(Number(e.target.value))}
                      className="w-full bg-[#C7CDD3]/15 border border-[#C7CDD3] rounded-xl p-2 text-xs font-bold text-[#16324F] focus:outline-none focus:border-[#0A3D62] focus:bg-[#FFFFFF]"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Section 4: Notes */}
            <div className="classy-card p-4 space-y-2 bg-[#FFFFFF]">
              <label className="text-[11px] font-bold text-[#6F7882]">
                {isEn ? 'Teacher Notes (Optional)' : 'ملاحظات المعلم (اختياري)'}
              </label>
              <textarea
                rows={2}
                placeholder={isEn ? 'Any special instructions or group notes...' : 'أي تعليمات خاصة بالمجموعة...'}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#C7CDD3]/15 border border-[#C7CDD3] rounded-xl p-2 text-xs text-[#16324F] focus:outline-none focus:border-[#0A3D62] focus:bg-[#FFFFFF]"
              />
            </div>

            {/* Submit Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#FFFFFF] border border-[#C7CDD3] text-xs font-bold text-[#6F7882] hover:bg-[#C7CDD3]/25 transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#0A3D62] to-[#16324F] hover:from-[#16324F] hover:to-[#0A3D62] text-[#FFFFFF] text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer"
              >
                {editingGroup
                  ? (isEn ? 'Save Group Changes' : 'حفظ تعديلات المجموعة')
                  : (isEn ? 'Create Group Now' : 'إنشاء المجموعة الآن')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};
