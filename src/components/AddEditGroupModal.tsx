import React, { useState, useEffect } from 'react';
import { Group, GroupType, BillingType } from '../types';
import { db } from '../utils/storage';
import { ALL_GRADE_LEVELS, STAGES_HIERARCHY, getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';
import { BottomSheet } from './ui/BottomSheet';
import { AppIcon } from './ui/AppIcon';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';
import {
  CanonicalWeekday,
  normalizeScheduleDays,
  normalizeScheduleTimes,
  normalizeScheduleTimesList,
  getLocalizedWeekdayName,
} from '../utils/schedule';

interface AddEditGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingGroup?: Group | null;
  onSaveComplete: (savedGroup: Group) => void;
}

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
  const [accentColor, setAccentColor] = useState('navy');
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
      setAccentColor(editingGroup.accentColor || 'navy');
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
      setAccentColor('navy');
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
      return;
    }

    const groupId = editingGroup
      ? editingGroup.id
      : `grp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

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
      scheduleDays: scheduleDays,
      scheduleTime: primaryTime,
      scheduleTimes: cleanScheduleTimes,
      roomOrLocation: roomOrLocation.trim() || undefined,
      accentColor,
      notes: notes.trim() || undefined,
      createdAt: editingGroup ? editingGroup.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.saveGroup(groupToSave);
    triggerSuccessHaptic();
    onSaveComplete(groupToSave);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <BottomSheet
      id="add-edit-group"
      isOpen={isOpen}
      onClose={onClose}
      title={
        editingGroup
          ? (isEn ? 'Edit Group' : 'تعديل بيانات المجموعة')
          : (isEn ? 'New Study Group' : 'إنشاء مجموعة دراسية جديدة')
      }
      subtitle={
        isEn
          ? 'Define group details, stage, weekly schedule, and tuition fees'
          : 'تحديد بيانات المجموعة، المرحلة، مواعيد الحصص، ونظام المحاسبة'
      }
      headerLeading={
        <div className="w-10 h-10 rounded-2xl bg-mint-soft text-navy flex items-center justify-center shrink-0 border border-line">
          <AppIcon name="groups" size={20} weight="duotone" />
        </div>
      }
      headerTrailing={
        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-mint-soft text-navy border border-line">
          {type === 'private' ? (isEn ? 'Private' : 'خاص') : (isEn ? 'Group' : 'مجموعة')}
        </span>
      }
      bodyClassName="p-4"
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="btn-soft flex-1"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            form="add-group-form"
            onClick={() => triggerLightHaptic()}
            className="btn-orange flex-1 cursor-pointer"
          >
            <AppIcon name="check" size={16} weight="bold" />
            <span>
              {editingGroup
                ? (isEn ? 'Save Group Changes' : 'حفظ تعديلات المجموعة')
                : (isEn ? 'Create Group Now' : 'إنشاء المجموعة الآن')}
            </span>
          </button>
        </div>
      }
    >
      <form
        id="add-group-form"
        data-tutorial-id="group-modal-form"
        onSubmit={handleSubmit}
        className="space-y-4 text-xs text-navy text-start"
      >
        {/* Section 1: Basic Info */}
        <div className="p-4 rounded-2xl bg-page border border-line space-y-3 shadow-2xs">
          <div className="space-y-1">
            <label className="field-label">
              {isEn ? 'Group Name *' : 'اسم المجموعة *'}
            </label>
            <div className="relative">
              <AppIcon
                name="book"
                size={14}
                className={`text-slate absolute top-4 ${isRTL ? 'right-3.5' : 'left-3.5'} pointer-events-none`}
              />
              <input
                type="text"
                required
                placeholder={isEn ? 'e.g. Group A - Secondary 1' : 'مثال: مجموعة أوائل الثانوية (أ)'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`classy-input ${isRTL ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="field-label">
                {isEn ? 'Subject *' : 'المادة الدراسية *'}
              </label>
              <input
                type="text"
                required
                placeholder={isEn ? 'e.g. Mathematics, Physics' : 'مثال: الرياضيات، الفيزياء'}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="classy-input"
              />
            </div>

            <div className="space-y-1">
              <label className="field-label">
                {isEn ? 'Grade / Educational Stage *' : 'الصف / المرحلة الدراسية *'}
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="classy-select"
              >
                {STAGES_HIERARCHY.map((stage) => (
                  <optgroup key={stage.id} label={isEn ? stage.nameEn : stage.nameAr}>
                    {stage.grades.map((grd) => (
                      <option key={grd.id} value={grd.nameAr}>
                        {isEn ? grd.nameEn : grd.nameAr}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="field-label">
                {isEn ? 'Group Type' : 'نوع المجموعة'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('group')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    type === 'group'
                      ? 'bg-mint-soft border-navy text-navy shadow-2xs'
                      : 'bg-page border-line text-slate hover:bg-mist'
                  }`}
                >
                  {isEn ? 'Regular Group' : 'مجموعة عامة'}
                </button>
                <button
                  type="button"
                  onClick={() => setType('private')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    type === 'private'
                      ? 'bg-mint-soft border-navy text-navy shadow-2xs'
                      : 'bg-page border-line text-slate hover:bg-mist'
                  }`}
                >
                  {isEn ? 'Private Lesson' : 'درس خاص'}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="field-label">
                {isEn ? 'Room / Location' : 'القاعة / المكان'}
              </label>
              <input
                type="text"
                placeholder={isEn ? 'e.g. Room 2, Center A' : 'مثال: قاعة 2، سنتر الأوائل'}
                value={roomOrLocation}
                onChange={(e) => setRoomOrLocation(e.target.value)}
                className="classy-input"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Weekly Schedule */}
        <div className="p-4 rounded-2xl bg-page border border-line space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-navy flex items-center gap-1.5">
              <AppIcon name="calendar" size={14} className="text-navy" />
              <span>{isEn ? 'Weekly Schedule Days' : 'أيام الحصص الأسبوعية'}</span>
            </span>
            <span className="text-[10px] text-slate font-medium">
              {scheduleDays.length} {isEn ? 'days selected' : 'أيام محددة'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {WEEK_DAYS_CONFIG.map(({ key }) => {
              const isChecked = scheduleDays.includes(key);
              const dayName = getLocalizedWeekdayName(key, isRTL);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleDay(key)}
                  className={`chip ${isChecked ? 'chip-active' : ''}`}
                >
                  {dayName}
                </button>
              );
            })}
          </div>

          {/* Time input for each selected day */}
          {scheduleDays.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-line">
              <span className="text-[11px] font-bold text-slate block">
                {isEn ? 'Set class start time per day:' : 'تحديد توقيت كل حصة:'}
              </span>

              <div className="space-y-2">
                {scheduleDays.map((d) => {
                  const dayName = getLocalizedWeekdayName(d, isRTL);
                  const timesList = scheduleTimes[d] && scheduleTimes[d].length > 0 ? scheduleTimes[d] : ['16:00'];
                  return (
                    <div
                      key={d}
                      className="p-2.5 rounded-xl bg-mist border border-line flex items-center justify-between gap-2 flex-wrap"
                    >
                      <span className="font-bold text-xs text-navy min-w-[70px]">
                        {dayName}:
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {timesList.map((tm, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <input
                              type="time"
                              value={tm}
                              onChange={(e) => handleDayTimeChange(d, idx, e.target.value)}
                              className="classy-input w-28 text-center"
                            />
                            {timesList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveDayTime(d, idx)}
                                className="p-1 rounded-lg hover:bg-coral-soft text-coral transition-colors"
                              >
                                <AppIcon name="close" size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleAddDayTime(d)}
                          className="px-2 py-1 rounded-lg bg-page border border-line text-[10px] font-bold text-navy hover:bg-mint-soft transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <AppIcon name="plus" size={10} />
                          <span>{isEn ? 'Add' : 'إضافة'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Billing & Pricing */}
        <div className="p-4 rounded-2xl bg-page border border-line space-y-3 shadow-2xs">
          <span className="font-bold text-xs text-navy flex items-center gap-1.5">
            <AppIcon name="coins" size={14} className="text-navy" />
            <span>{isEn ? 'Billing Mode & Default Pricing' : 'نظام المحاسبة والتسعير'}</span>
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'per_session', label: isEn ? 'Per Session' : 'بالحصة' },
              { id: 'monthly', label: isEn ? 'Monthly' : 'شهري' },
              { id: 'package', label: isEn ? 'Package' : 'باقة' },
              { id: 'hourly', label: isEn ? 'Hourly' : 'بالساعة' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setBillingType(mode.id as BillingType)}
                className={`py-2 px-2 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                  billingType === mode.id
                    ? 'bg-mint-soft border-navy text-navy shadow-2xs'
                    : 'bg-page border-line text-slate hover:bg-mist'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {billingType === 'hourly' ? (
              <div className="space-y-1">
                <label className="field-label">
                  {isEn ? 'Hourly Rate *' : 'سعر الساعة للطالب (ج.م) *'}
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  className="classy-input"
                />
              </div>
            ) : billingType === 'package' ? (
              <>
                <div className="space-y-1">
                  <label className="field-label">
                    {isEn ? 'Sessions in Package *' : 'عدد حصص الباقة *'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={packageSessionsCount}
                    onChange={(e) => setPackageSessionsCount(Number(e.target.value))}
                    className="classy-input"
                  />
                </div>
                <div className="space-y-1">
                  <label className="field-label">
                    {isEn ? 'Total Package Price *' : 'إجمالي سعر الباقة (ج.م) *'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={defaultPrice}
                    onChange={(e) => setDefaultPrice(Number(e.target.value))}
                    className="classy-input"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <label className="field-label">
                  {billingType === 'monthly'
                    ? (isEn ? 'Monthly Fee *' : 'قيمة الاشتراك الشهري (ج.م) *')
                    : (isEn ? 'Session Price *' : 'سعر الحصة للطالب (ج.م) *')}
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(Number(e.target.value))}
                  className="classy-input"
                />
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Notes */}
        <div className="p-4 rounded-2xl bg-page border border-line space-y-1.5 shadow-2xs">
          <label className="field-label flex items-center gap-1.5">
            <AppIcon name="edit" size={14} className="text-navy" />
            <span>{isEn ? 'Teacher Notes (Optional)' : 'ملاحظات المعلم (اختياري)'}</span>
          </label>
          <textarea
            rows={2}
            placeholder={isEn ? 'Any special instructions or group notes...' : 'أي تعليمات خاصة بالمجموعة...'}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="classy-textarea"
          />
        </div>
      </form>
    </BottomSheet>
  );
};
