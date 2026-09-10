import React, { useState, useEffect } from 'react';
import { X, Layers, Clock, MapPin, DollarSign, Calendar, GraduationCap } from 'lucide-react';
import { Group, GroupType, BillingType } from '../types';
import { db } from '../utils/storage';
import { ALL_GRADE_LEVELS, STAGES_HIERARCHY, getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';

interface AddEditGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingGroup?: Group | null;
  onSaveComplete: (savedGroup: Group) => void;
}

const GROUP_COLORS = [
  '#748C70', // Sage green
  '#D49B4B', // Warm gold
  '#C97C5D', // Terracotta
  '#5E755A', // Olive green
  '#5C788A', // Slate blue
  '#8C6D53', // Warm earth
  '#7E6B8F', // Dusty violet
];

export const AddEditGroupModal: React.FC<AddEditGroupModalProps> = ({
  isOpen,
  onClose,
  editingGroup,
  onSaveComplete,
}) => {
  const { t, isRTL, language } = useTranslation();

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('الصف الأول الثانوي');
  const [type, setType] = useState<GroupType>('group');
  const [billingType, setBillingType] = useState<BillingType>('per_session');
  const [defaultPrice, setDefaultPrice] = useState<number>(100);
  const [hourlyRate, setHourlyRate] = useState<number>(150);
  const [packageSessionsCount, setPackageSessionsCount] = useState<number>(10);
  const [scheduleDays, setScheduleDays] = useState<string[]>(['السبت', 'الثلاثاء']);
  const [scheduleTime, setScheduleTime] = useState('16:00');
  const [scheduleTimes, setScheduleTimes] = useState<Record<string, string>>({ 'السبت': '16:00', 'الثلاثاء': '16:00' });
  const [roomOrLocation, setRoomOrLocation] = useState('Room 1');
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
      setScheduleDays(editingGroup.scheduleDays || []);
      setScheduleTime(editingGroup.scheduleTime || '16:00');
      
      const initialTimes: Record<string, string> = { ...(editingGroup.scheduleTimes || {}) };
      if (editingGroup.scheduleDays && editingGroup.scheduleDays.length > 0) {
        editingGroup.scheduleDays.forEach((day) => {
          if (!initialTimes[day]) {
            initialTimes[day] = editingGroup.scheduleTime || '16:00';
          }
        });
      }
      setScheduleTimes(initialTimes);
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
      setScheduleDays(['السبت', 'الثلاثاء']);
      setScheduleTime('16:00');
      setScheduleTimes({ 'السبت': '16:00', 'الثلاثاء': '16:00' });
      setRoomOrLocation('Room 1');
      setAccentColor(GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)]);
      setNotes('');
    }
  }, [editingGroup, isOpen]);

  const toggleDay = (day: string) => {
    if (scheduleDays.includes(day)) {
      setScheduleDays(scheduleDays.filter((d) => d !== day));
    } else {
      setScheduleDays([...scheduleDays, day]);
      if (!scheduleTimes[day]) {
        setScheduleTimes((prev) => ({ ...prev, [day]: scheduleTime || '16:00' }));
      }
    }
  };

  const handleDayTimeChange = (day: string, timeVal: string) => {
    setScheduleTimes((prev) => ({ ...prev, [day]: timeVal }));
    if (scheduleDays[0] === day || !scheduleTime) {
      setScheduleTime(timeVal);
    }
  };

  const applyTimeToAllDays = (timeVal: string) => {
    const updated: Record<string, string> = {};
    scheduleDays.forEach((d) => {
      updated[d] = timeVal;
    });
    setScheduleTimes(updated);
    setScheduleTime(timeVal);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !subject.trim()) return;

    if (billingType === 'package' && (!packageSessionsCount || packageSessionsCount <= 0)) {
      alert(isRTL ? 'يرجى إدخال عدد حصص صحيح للباقة (أكبر من 0)' : 'Please enter a valid number of sessions for the package (>0)');
      return;
    }

    const groupId = editingGroup
      ? editingGroup.id
      : `grp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const savedGroup: Group = {
      id: groupId,
      name: name.trim(),
      subject: subject.trim(),
      gradeLevel: gradeLevel.trim(),
      type,
      billingType,
      defaultPrice: Number(defaultPrice) || 0,
      hourlyRate: billingType === 'hourly' ? (Number(hourlyRate) || 150) : undefined,
      packageSessionsCount: billingType === 'package' ? (Number(packageSessionsCount) || 10) : undefined,
      scheduleDays,
      scheduleTime: scheduleTime.trim() || (scheduleDays.length > 0 ? scheduleTimes[scheduleDays[0]] || '' : ''),
      scheduleTimes,
      roomOrLocation: roomOrLocation.trim(),
      accentColor,
      notes: notes.trim(),
      createdAt: editingGroup ? editingGroup.createdAt : new Date().toISOString(),
    };

    db.saveGroup(savedGroup);
    onSaveComplete(savedGroup);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#2D332A]/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-[#F9F7F2] border border-[#E8E2D6] rounded-t-3xl sm:rounded-[32px] max-w-lg w-full mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-[#E8E2D6] bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#748C70] text-white shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#2D332A]">
                {editingGroup ? t('editGroupAction') : t('createGroupBtn')}
              </h2>
              <p className="text-[11px] text-[#8A9187]">
                {t('groupsSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-[#F2ECE1] text-[#6B7567] hover:text-[#2D332A] hover:bg-[#EAE5D8]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto android-scrollbar flex-1 space-y-3.5 text-xs text-[#434B3E]">
          
          {/* Group Type (Group vs Private) */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#E8E2D6]/40 rounded-2xl">
            <button
              type="button"
              onClick={() => setType('group')}
              className={`py-2 rounded-xl text-xs font-bold transition-all ${
                type === 'group'
                  ? 'bg-white text-[#2D332A] shadow-sm'
                  : 'text-[#6B7567] hover:text-[#2D332A]'
              }`}
            >
              {t('groupTypeGroup')}
            </button>
            <button
              type="button"
              onClick={() => setType('private')}
              className={`py-2 rounded-xl text-xs font-bold transition-all ${
                type === 'private'
                  ? 'bg-white text-[#2D332A] shadow-sm'
                  : 'text-[#6B7567] hover:text-[#2D332A]'
              }`}
            >
              {t('groupTypePrivate')}
            </button>
          </div>

          {/* Group Name & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-[#6B7567] mb-1">{t('groupName')} *</label>
              <input
                type="text"
                required
                placeholder="e.g. Physics A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#6B7567] mb-1">{t('subjectNameLabel')} *</label>
              <input
                type="text"
                required
                placeholder="Math, Science..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
              />
            </div>
          </div>

          {/* Grade Level & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-[#6B7567] mb-1">{t('gradeLevel')}</label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
              >
                {STAGES_HIERARCHY.map((stage) => (
                  <optgroup key={stage.id} label={language === 'ar' ? `${stage.nameAr} (${stage.nameEn})` : `${stage.nameEn} (${stage.nameAr})`}>
                    {stage.grades.map((grade) => (
                      <option key={grade.id} value={grade.nameAr}>
                        {getLocalizedStageName(grade.nameAr, language)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#6B7567] mb-1">{t('location')}</label>
              <input
                type="text"
                placeholder="Center / Room 1..."
                value={roomOrLocation}
                onChange={(e) => setRoomOrLocation(e.target.value)}
                className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
              />
            </div>
          </div>

          {/* Billing Type & Default Price */}
          <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-2.5 shadow-sm">
            <h3 className="font-bold text-[#2D332A] text-xs flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-[#748C70]" />
              <span>{t('billingMode')}</span>
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-[#8A9187] mb-1">{t('billingType')}</label>
                <select
                  value={billingType}
                  onChange={(e) => setBillingType(e.target.value as BillingType)}
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none"
                >
                  <option value="prepaid">{t('billingPrepaid')}</option>
                  <option value="postpaid">{t('billingPostpaid')}</option>
                  <option value="package">{t('billingPackage')}</option>
                  <option value="monthly">{t('billingMonthly')}</option>
                  <option value="hourly">{t('billingHourly')}</option>
                </select>
              </div>

              {billingType === 'hourly' ? (
                <div>
                  <label className="block text-[11px] text-[#8A9187] mb-1 font-bold">
                    {t('hourlyRateInputLabel')} ({t('currency')}/hr)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none font-bold"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] text-[#8A9187] mb-1 font-bold">
                    {billingType === 'package' ? (isRTL ? 'إجمالي سعر الباقة (ج.م)' : 'Package Total Price') : `${t('defaultPrice')} (${t('currency')})`}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={defaultPrice}
                    onChange={(e) => setDefaultPrice(Number(e.target.value))}
                    className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none font-bold"
                  />
                </div>
              )}
            </div>

            {/* Package count selection & effective price calculation */}
            {billingType === 'package' && (
              <div className="p-3 bg-[#F9F7F2] rounded-xl border border-[#D49B4B]/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-[#2D332A] block">{t('packageSessionsNumberLabel')}:</label>
                    <span className="text-[10px] text-[#8A9187]">{isRTL ? 'حدد عدد الحصص في الباقة' : 'Define sessions in package'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      value={packageSessionsCount}
                      onChange={(e) => setPackageSessionsCount(Math.max(1, Number(e.target.value)))}
                      className="w-20 bg-white border border-[#E8E2D6] rounded-lg p-1.5 text-xs font-bold text-[#2D332A] text-center focus:outline-none focus:border-[#D49B4B]"
                    />
                    <span className="text-xs font-bold text-[#6B7567]">{isRTL ? 'حصة' : 'sessions'}</span>
                  </div>
                </div>

                <div className="p-2 bg-[#D49B4B]/10 rounded-lg flex items-center justify-between text-xs text-[#9C6615] font-bold">
                  <span>{isRTL ? 'سعر الحصة الفعلي المحسوب:' : 'Calculated Price Per Session:'}</span>
                  <span className="text-sm font-black text-[#2D332A]">
                    {packageSessionsCount > 0 ? (Math.round((defaultPrice / packageSessionsCount) * 100) / 100) : 0} {t('currency')} / {isRTL ? 'حصة' : 'session'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Schedule Days & Time Per Day */}
          <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#2D332A] text-xs flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#748C70]" />
                <span>{t('scheduleDays')} {isRTL ? 'ومواعيد الحصص' : 'and Times'}</span>
              </h3>
              {scheduleDays.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const firstTime = scheduleTimes[scheduleDays[0]] || scheduleTime || '16:00';
                    applyTimeToAllDays(firstTime);
                  }}
                  className="text-[10px] font-bold text-[#748C70] hover:underline"
                >
                  {isRTL ? 'توحيد الوقت لجميع الأيام' : 'Apply time to all days'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: 'السبت', label: t('daySat') },
                { key: 'الأحد', label: t('daySun') },
                { key: 'الاثنين', label: t('dayMon') },
                { key: 'الثلاثاء', label: t('dayTue') },
                { key: 'الأربعاء', label: t('dayWed') },
                { key: 'الخميس', label: t('dayThu') },
                { key: 'الجمعة', label: t('dayFri') },
              ].map(({ key, label }) => {
                const isSelected = scheduleDays.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleDay(key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      isSelected
                        ? 'bg-[#748C70] text-white border-[#748C70] shadow-xs'
                        : 'bg-[#F9F7F2] text-[#6B7567] border-[#E8E2D6] hover:bg-[#EAE5D8]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Individual time input per selected day */}
            {scheduleDays.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#E8E2D6]/70">
                <label className="block text-[11px] font-bold text-[#6B7567]">
                  {isRTL ? 'تحديد موعد كل يوم بشكل مستقل:' : 'Set time for each selected day:'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {scheduleDays.map((day) => {
                    const currentTime = scheduleTimes[day] || scheduleTime || '16:00';
                    return (
                      <div
                        key={day}
                        className="flex items-center justify-between p-2 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6]"
                      >
                        <span className="text-xs font-bold text-[#2D332A] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#748C70]"></span>
                          {day}
                        </span>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#8A9187]" />
                          <input
                            type="time"
                            value={currentTime}
                            onChange={(e) => handleDayTimeChange(day, e.target.value)}
                            className="bg-white border border-[#E8E2D6] rounded-lg px-2 py-1 text-xs font-bold text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Accent Color */}
          <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-2 shadow-sm">
            <label className="block font-bold text-[#6B7567] text-xs">{t('fallbackColorLabel')}</label>
            <div className="flex items-center gap-2 flex-wrap">
              {GROUP_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAccentColor(color)}
                  className={`w-7 h-7 rounded-xl transition-all border-2 ${
                    accentColor === color ? 'scale-110 border-[#2D332A] shadow-xs' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl border border-[#E8E2D6] bg-white text-[#6B7567] font-bold text-xs hover:bg-[#F2ECE1] transition-all"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-2xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              {editingGroup ? t('saveChanges') : t('save')}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
