import React, { useState, useEffect } from 'react';
import { X, Layers, Clock, MapPin, DollarSign, Calendar, GraduationCap, Plus, Trash2 } from 'lucide-react';
import { Group, GroupType, BillingType } from '../types';
import { db, divideMoney } from '../utils/storage';
import { ALL_GRADE_LEVELS, STAGES_HIERARCHY, getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import { normalizeScheduleTimesList } from '../utils/schedule';

interface AddEditGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingGroup?: Group | null;
  onSaveComplete: (savedGroup: Group) => void;
}

const GROUP_COLORS = [
  '#172554', // Royal navy
  '#1E3A8A', // Deep navy
  '#2563EB', // Royal blue
  '#0284C7', // Sky blue
  '#C9A227', // Royal gold
  '#D97706', // Warm amber
  '#059669', // Emerald
  '#475569', // Slate
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
  const [scheduleTimes, setScheduleTimes] = useState<Record<string, string[]>>({ 'السبت': ['16:00'], 'الثلاثاء': ['16:00'] });
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
      
      const initialTimes: Record<string, string[]> = {};
      if (editingGroup.scheduleDays && editingGroup.scheduleDays.length > 0) {
        editingGroup.scheduleDays.forEach((day) => {
          if (editingGroup.scheduleTimes && editingGroup.scheduleTimes[day]) {
            initialTimes[day] = normalizeScheduleTimesList(editingGroup.scheduleTimes[day]);
          } else {
            initialTimes[day] = [editingGroup.scheduleTime || '16:00'];
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
      setScheduleTimes({ 'السبت': ['16:00'], 'الثلاثاء': ['16:00'] });
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
      if (!scheduleTimes[day] || scheduleTimes[day].length === 0) {
        setScheduleTimes((prev) => ({ ...prev, [day]: [scheduleTime || '16:00'] }));
      }
    }
  };

  const handleDayTimeChange = (day: string, timeIdx: number, timeVal: string) => {
    setScheduleTimes((prev) => {
      const currentList = prev[day] ? [...prev[day]] : ['16:00'];
      currentList[timeIdx] = timeVal;
      return { ...prev, [day]: currentList };
    });
  };

  const handleAddDayTime = (day: string) => {
    setScheduleTimes((prev) => {
      const currentList = prev[day] ? [...prev[day]] : ['16:00'];
      // Suggest next time slot (e.g. 19:00 if 16:00)
      const lastTime = currentList[currentList.length - 1] || '16:00';
      const [h, m] = lastTime.split(':').map(Number);
      const nextH = !isNaN(h) ? Math.min(23, (h + 3) % 24) : 19;
      const nextTimeStr = `${String(nextH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
      return { ...prev, [day]: [...currentList, nextTimeStr] };
    });
  };

  const handleRemoveDayTime = (day: string, timeIdx: number) => {
    setScheduleTimes((prev) => {
      const currentList = prev[day] ? [...prev[day]] : ['16:00'];
      if (currentList.length <= 1) return prev;
      const updated = currentList.filter((_, idx) => idx !== timeIdx);
      return { ...prev, [day]: updated };
    });
  };

  const applyTimeToAllDays = (timeVal: string) => {
    const updated: Record<string, string[]> = {};
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
      alert(isRTL ? 'يرجى إدخال عدد حصص صحيح للباقة (أكبر من 0)' : 'Please enter a valid number of sessions for the package (>0)');
      return;
    }

    const groupId = editingGroup
      ? editingGroup.id
      : `grp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Clean and normalize schedule times
    const cleanScheduleTimes: Record<string, string[]> = {};
    scheduleDays.forEach((d) => {
      const list = normalizeScheduleTimesList(scheduleTimes[d] || [scheduleTime || '16:00']);
      cleanScheduleTimes[d] = list.length > 0 ? list : ['16:00'];
    });

    const primaryTime = scheduleDays.length > 0 && cleanScheduleTimes[scheduleDays[0]]?.[0]
      ? cleanScheduleTimes[scheduleDays[0]][0]
      : (scheduleTime.trim() || '16:00');

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
      scheduleTime: primaryTime,
      scheduleTimes: cleanScheduleTimes,
      roomOrLocation: roomOrLocation.trim(),
      accentColor,
      notes: notes.trim(),
      createdAt: editingGroup ? editingGroup.createdAt : new Date().toISOString(),
    };

    db.saveGroup(savedGroup);
    onSaveComplete(savedGroup);
    onClose();
  };

  const modalLayer = useModalLayer('add-edit-group', isOpen, onClose);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-[#0F172A]/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#F7F8FC] border border-[#E2E8F0] rounded-t-3xl sm:rounded-[28px] max-w-lg w-full mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-[#E2E8F0] bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-[#172554] text-[#C9A227] shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#111827]">
                {editingGroup ? t('editGroupAction') : t('createGroupBtn')}
              </h2>
              <p className="text-[11px] text-[#64748B]">
                {t('groupsSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-[#F1F5F9] text-[#64748B] hover:text-[#111827] hover:bg-[#E2E8F0]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto android-scrollbar flex-1 space-y-3.5 text-xs text-[#111827]">
          
          {/* Group Type (Group vs Private) */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl">
            <button
              type="button"
              onClick={() => setType('group')}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${
                type === 'group'
                  ? 'bg-[#172554] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#111827]'
              }`}
            >
              {t('groupTypeGroup')}
            </button>
            <button
              type="button"
              onClick={() => setType('private')}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${
                type === 'private'
                  ? 'bg-[#172554] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#111827]'
              }`}
            >
              {t('groupTypePrivate')}
            </button>
          </div>

          {/* Group Name & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-[#64748B] mb-1">{t('groupName')} *</label>
              <input
                type="text"
                required
                placeholder="e.g. Physics A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded-xl p-2.5 text-xs text-[#111827] focus:outline-none focus:border-[#172554]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#64748B] mb-1">{t('subjectNameLabel')} *</label>
              <input
                type="text"
                required
                placeholder="Math, Science..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded-xl p-2.5 text-xs text-[#111827] focus:outline-none focus:border-[#172554]"
              />
            </div>
          </div>

          {/* Grade Level & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-[#64748B] mb-1">{t('gradeLevel')}</label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded-xl p-2.5 text-xs text-[#111827] focus:outline-none focus:border-[#172554]"
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
              <label className="block font-bold text-[#64748B] mb-1">{t('location')}</label>
              <input
                type="text"
                placeholder="Center / Room 1..."
                value={roomOrLocation}
                onChange={(e) => setRoomOrLocation(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded-xl p-2.5 text-xs text-[#111827] focus:outline-none focus:border-[#172554]"
              />
            </div>
          </div>

          {/* Billing Type & Default Price */}
          <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-2xl space-y-2.5 shadow-sm">
            <h3 className="font-bold text-[#111827] text-xs flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>{t('billingMode')}</span>
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-[#64748B] mb-1">{t('billingType')}</label>
                <select
                  value={billingType}
                  onChange={(e) => setBillingType(e.target.value as BillingType)}
                  className="w-full bg-[#F7F8FC] border border-[#E2E8F0] rounded-xl p-2 text-xs text-[#111827] focus:outline-none"
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
                  <label className="block text-[11px] text-[#64748B] mb-1 font-bold">
                    {t('hourlyRateInputLabel')} ({t('currency')}/hr)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    className="w-full bg-[#F7F8FC] border border-[#E2E8F0] rounded-xl p-2 text-xs text-[#111827] focus:outline-none font-bold"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] text-[#64748B] mb-1 font-bold">
                    {billingType === 'package' ? (isRTL ? 'إجمالي سعر الباقة (ج.م)' : 'Package Total Price') : `${t('defaultPrice')} (${t('currency')})`}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={defaultPrice}
                    onChange={(e) => setDefaultPrice(Number(e.target.value))}
                    className="w-full bg-[#F7F8FC] border border-[#E2E8F0] rounded-xl p-2 text-xs text-[#111827] focus:outline-none font-bold"
                  />
                </div>
              )}
            </div>

            {/* Package count selection & effective price calculation */}
            {billingType === 'package' && (
              <div className="p-3 bg-[#F7F8FC] rounded-xl border border-[#C9A227]/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-[#111827] block">{t('packageSessionsNumberLabel')}:</label>
                    <span className="text-[10px] text-[#64748B]">{isRTL ? 'حدد عدد الحصص في الباقة' : 'Define sessions in package'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      value={packageSessionsCount}
                      onChange={(e) => setPackageSessionsCount(Math.max(1, Number(e.target.value)))}
                      className="w-20 bg-white border border-[#E2E8F0] rounded-lg p-1.5 text-xs font-bold text-[#111827] text-center focus:outline-none focus:border-[#C9A227]"
                    />
                    <span className="text-xs font-bold text-[#64748B]">{isRTL ? 'حصة' : 'sessions'}</span>
                  </div>
                </div>

                <div className="p-2 bg-[#C9A227]/10 rounded-lg flex items-center justify-between text-xs text-[#172554] font-bold">
                  <span>{isRTL ? 'سعر الحصة الفعلي المحسوب:' : 'Calculated Price Per Session:'}</span>
                  <span className="text-sm font-black text-[#172554]">
                    {packageSessionsCount > 0 ? divideMoney(defaultPrice, packageSessionsCount) : 0} {t('currency')} / {isRTL ? 'حصة' : 'session'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Schedule Days & Time Per Day */}
          <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-2xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#111827] text-xs flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#C9A227]" />
                <span>{t('scheduleDays')} {isRTL ? 'ومواعيد الحصص' : 'and Times'}</span>
              </h3>
              {scheduleDays.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const firstTime = scheduleTimes[scheduleDays[0]] || scheduleTime || '16:00';
                    applyTimeToAllDays(firstTime);
                  }}
                  className="text-[10px] font-bold text-[#172554] hover:underline"
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
                        ? 'bg-[#172554] text-white border-[#172554] shadow-xs'
                        : 'bg-[#F7F8FC] text-[#64748B] border-[#E2E8F0] hover:bg-[#E2E8F0]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Individual time input per selected day */}
            {scheduleDays.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                <label className="block text-[11px] font-bold text-[#64748B]">
                  {isRTL ? 'تحديد مواعيد الحصص لكل يوم (يمكن إضافة أكثر من موعد في نفس اليوم):' : 'Set schedule times per day (multiple times supported):'}
                </label>
                <div className="space-y-2">
                  {scheduleDays.map((day) => {
                    const dayTimes = scheduleTimes[day] && scheduleTimes[day].length > 0 ? scheduleTimes[day] : ['16:00'];
                    return (
                      <div
                        key={day}
                        className="p-2.5 rounded-2xl bg-[#F7F8FC] border border-[#E2E8F0] space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#C9A227]"></span>
                            {day}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddDayTime(day)}
                            className="text-[11px] font-bold text-[#172554] hover:text-[#1E3A8A] flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#C9A227]/20 hover:bg-[#C9A227]/30 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{isRTL ? 'إضافة موعد آخر' : 'Add another time'}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {dayTimes.map((tVal, tIdx) => (
                            <div
                              key={`${day}_${tIdx}`}
                              className="flex items-center gap-1.5 bg-white border border-[#E2E8F0] rounded-xl px-2 py-1 shadow-2xs"
                            >
                              <Clock className="w-3.5 h-3.5 text-[#64748B]" />
                              <input
                                type="time"
                                value={tVal}
                                onChange={(e) => handleDayTimeChange(day, tIdx, e.target.value)}
                                className="bg-transparent text-xs font-bold text-[#111827] focus:outline-none focus:text-[#172554]"
                              />
                              {dayTimes.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDayTime(day, tIdx)}
                                  className="p-1 rounded-md text-[#64748B] hover:text-red-600 hover:bg-red-50 transition-colors ml-0.5"
                                  title={isRTL ? 'حذف هذا الموعد' : 'Remove time'}
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
          </div>

          {/* Accent Color */}
          <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-2xl space-y-2 shadow-sm">
            <label className="block font-bold text-[#64748B] text-xs">{t('fallbackColorLabel')}</label>
            <div className="flex items-center gap-2 flex-wrap">
              {GROUP_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAccentColor(color)}
                  className={`w-7 h-7 rounded-xl transition-all border-2 ${
                    accentColor === color ? 'scale-110 border-[#172554] shadow-xs' : 'border-transparent'
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
              className="flex-1 py-3 rounded-2xl border border-[#E2E8F0] bg-white text-[#64748B] font-bold text-xs hover:bg-[#F1F5F9] transition-all"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-2xl bg-[#172554] hover:bg-[#1E3A8A] text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              {editingGroup ? t('saveChanges') : t('save')}
            </button>
          </div>

        </form>

      </div>
    </div>
    </ModalPortal>
  );
};
