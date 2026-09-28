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
import { normalizeScheduleTimesList, formatTimeDisplay } from '../utils/schedule';

interface AddEditGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingGroup?: Group | null;
  onSaveComplete: (savedGroup: Group) => void;
}

const GROUP_COLORS = [
  '#7657F6', // Vibrant violet
  '#403B9C', // Royal indigo
  '#17163D', // Midnight indigo
  '#FF647C', // Coral rose
  '#55C7E8', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#6366F1', // Indigo
];

const WEEK_DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

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
  const [scheduleTimes, setScheduleTimes] = useState<Record<string, string[]>>({
    'السبت': ['16:00'],
    'الثلاثاء': ['16:00'],
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
      setRoomOrLocation('');
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
        className="fixed inset-0 bg-[#17163D]/70 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-white border border-[#E8E7FF] rounded-t-[28px] sm:rounded-[28px] max-w-lg w-full mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
          
          {/* Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-[#17163D] via-[#403B9C] to-[#7657F6] text-white flex items-center justify-between relative overflow-hidden">
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-md">
                <Layers className="w-5 h-5 text-[#55C7E8]" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  {editingGroup ? t('editGroupAction') : t('createGroupBtn')}
                </h2>
                <p className="text-[11px] text-[#E8E7FF]/85 font-medium">
                  {editingGroup ? 'تعديل بيانات المجموعة ومواعيد الحصص' : 'إنشاء مجموعة جديدة وتنظيم مواعيدها وأسعارها'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer relative z-10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-4 overflow-y-auto android-scrollbar flex-1 space-y-4 text-xs text-[#191A2E] bg-[#F6F7FC]">
            
            {/* Section 1: Group Type Selection */}
            <div className="classy-card p-1.5 flex items-center gap-1.5 bg-white">
              <button
                type="button"
                onClick={() => setType('group')}
                className={`flex-1 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  type === 'group'
                    ? 'bg-gradient-to-r from-[#17163D] to-[#403B9C] text-white shadow-sm'
                    : 'text-[#74778F] hover:text-[#17163D] hover:bg-[#F6F7FC]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{t('groupTypeGroup')}</span>
              </button>
              <button
                type="button"
                onClick={() => setType('private')}
                className={`flex-1 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  type === 'private'
                    ? 'bg-gradient-to-r from-[#FF647C] to-[#7657F6] text-white shadow-sm'
                    : 'text-[#74778F] hover:text-[#17163D] hover:bg-[#F6F7FC]'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{t('groupTypePrivate')}</span>
              </button>
            </div>

            {/* Section 2: Basic Info Card */}
            <div className="classy-card p-4 space-y-3 bg-white">
              <h3 className="font-black text-xs text-[#17163D] flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#7657F6]" />
                <span>البيانات الأساسية</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Group Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#74778F]">اسم المجموعة *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: مجموعة التفوق - السبت"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl p-2.5 text-xs text-[#191A2E] font-bold focus:outline-none focus:border-[#7657F6] focus:bg-white transition-colors"
                  />
                </div>

                {/* Subject */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#74778F]">المادة الدراسية *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: لغة عربية، رياضيات..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl p-2.5 text-xs text-[#191A2E] font-bold focus:outline-none focus:border-[#7657F6] focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Grade Level Selector */}
              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-bold text-[#74778F]">المرحلة الدراسية *</label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl p-2.5 text-xs text-[#191A2E] font-bold focus:outline-none focus:border-[#7657F6] focus:bg-white transition-colors cursor-pointer"
                >
                  {ALL_GRADE_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {getLocalizedStageName(lvl)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Section 3: Schedule & Multiple Times per Day */}
            <div className="classy-card p-4 space-y-3.5 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-xs text-[#17163D] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#7657F6]" />
                  <span>أيام ومواعيد الحصص الأسبوعية</span>
                </h3>
                <span className="text-[10px] text-[#74778F]">مواعيد متعددة في نفس اليوم</span>
              </div>

              {/* Weekday Selection Chips */}
              <div className="flex flex-wrap gap-1.5">
                {WEEK_DAYS.map((day) => {
                  const isSelected = scheduleDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-[#17163D] text-white border-[#17163D] shadow-xs'
                          : 'bg-[#F6F7FC] text-[#74778F] border-[#E8E7FF] hover:bg-[#E8E7FF]/40'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Multiple Time Slots per Selected Day */}
              {scheduleDays.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-[#E8E7FF]">
                  <div className="flex items-center justify-between text-[11px] text-[#74778F] font-bold">
                    <span>توقيت الحصص لكل يوم:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const firstTime = scheduleTimes[scheduleDays[0]]?.[0] || scheduleTime || '16:00';
                        applyTimeToAllDays(firstTime);
                      }}
                      className="text-[#7657F6] hover:underline cursor-pointer"
                    >
                      تطبيق التوقيت الأول على كل الأيام
                    </button>
                  </div>

                  <div className="space-y-2">
                    {scheduleDays.map((day) => {
                      const dayTimesList = scheduleTimes[day] || [scheduleTime || '16:00'];
                      return (
                        <div key={day} className="p-2.5 bg-[#F6F7FC] rounded-xl border border-[#E8E7FF] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-xs text-[#17163D]">{day}</span>
                            <button
                              type="button"
                              onClick={() => handleAddDayTime(day)}
                              className="px-2 py-0.5 rounded-lg bg-[#E8E7FF] hover:bg-[#D8D5FB] text-[#7657F6] font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              <span>+ موعد إضافي</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {dayTimesList.map((timeVal, tIdx) => (
                              <div key={tIdx} className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#E8E7FF] shadow-2xs">
                                <Clock className="w-3.5 h-3.5 text-[#7657F6] mr-1" />
                                <input
                                  type="time"
                                  value={timeVal}
                                  onChange={(e) => handleDayTimeChange(day, tIdx, e.target.value)}
                                  className="bg-transparent text-xs font-mono font-bold text-[#191A2E] focus:outline-none cursor-pointer"
                                />
                                {dayTimesList.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDayTime(day, tIdx)}
                                    className="p-1 text-[#74778F] hover:text-[#FF647C] rounded transition-colors cursor-pointer"
                                    title="حذف هذا الموعد"
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
                <label className="text-[11px] font-bold text-[#74778F]">مكان الحصة / القاعة (اختياري)</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#74778F] absolute top-2.5 right-3" />
                  <input
                    type="text"
                    placeholder="مثال: سنتر الأوائل - قاعة 2"
                    value={roomOrLocation}
                    onChange={(e) => setRoomOrLocation(e.target.value)}
                    className="w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl pr-9 pl-3 py-2 text-xs text-[#191A2E] font-medium focus:outline-none focus:border-[#7657F6] focus:bg-white transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Pricing & Billing */}
            <div className="classy-card p-4 space-y-3.5 bg-white">
              <h3 className="font-black text-xs text-[#17163D] flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>نظام المحاسبة والتسعير</span>
              </h3>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#74778F]">طريقة المحاسبة الافتراضية *</label>
                <select
                  value={billingType}
                  onChange={(e) => setBillingType(e.target.value as BillingType)}
                  className="w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl p-2.5 text-xs text-[#191A2E] font-bold focus:outline-none focus:border-[#7657F6] focus:bg-white cursor-pointer transition-colors"
                >
                  <option value="per_session">دفع بالحصة (Per Session)</option>
                  <option value="monthly">اشتراك شهري (Monthly)</option>
                  <option value="package">باقة عدد حصص (Session Package)</option>
                  <option value="hourly">محاسبة بالساعة (Hourly)</option>
                </select>
              </div>

              {/* Pricing inputs depending on billingType */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {billingType === 'package' ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#74778F]">عدد حصص الباقة *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={packageSessionsCount}
                        onChange={(e) => setPackageSessionsCount(Number(e.target.value))}
                        className="w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl p-2 text-xs font-bold text-[#191A2E] focus:outline-none focus:border-[#7657F6] focus:bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#74778F]">سعر الباقة الإجمالي (ج.م) *</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={defaultPrice}
                        onChange={(e) => setDefaultPrice(Number(e.target.value))}
                        className="w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl p-2 text-xs font-bold text-[#191A2E] focus:outline-none focus:border-[#7657F6] focus:bg-white"
                      />
                    </div>
                  </>
                ) : billingType === 'hourly' ? (
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] font-bold text-[#74778F]">سعر الساعة (ج.م) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(Number(e.target.value))}
                      className="w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl p-2 text-xs font-bold text-[#191A2E] focus:outline-none focus:border-[#7657F6] focus:bg-white"
                    />
                  </div>
                ) : (
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] font-bold text-[#74778F]">
                      {billingType === 'monthly' ? 'سعر الاشتراك الشهري (ج.م) *' : 'سعر الحصة الافتراضي (ج.م) *'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={defaultPrice}
                      onChange={(e) => setDefaultPrice(Number(e.target.value))}
                      className="w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl p-2 text-xs font-bold text-[#191A2E] focus:outline-none focus:border-[#7657F6] focus:bg-white"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Section 5: Color & Notes */}
            <div className="classy-card p-4 space-y-3 bg-white">
              <h3 className="font-black text-xs text-[#17163D] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#7657F6]" />
                <span>لون التمييز والملاحظات</span>
              </h3>

              {/* Accent Color Picker */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#74778F]">اختر لوناً مميزاً للمجموعة:</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {GROUP_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAccentColor(c)}
                      className={`w-8 h-8 rounded-xl transition-transform cursor-pointer flex items-center justify-center ${
                        accentColor === c ? 'scale-110 ring-2 ring-[#17163D] shadow-md' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {accentColor === c && <Check className="w-4 h-4 text-white stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-bold text-[#74778F]">ملاحظات إضافية (اختياري)</label>
                <textarea
                  rows={2}
                  placeholder="أي ملاحظات حول المنهج أو الطلاب..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl p-2.5 text-xs text-[#191A2E] font-medium focus:outline-none focus:border-[#7657F6] focus:bg-white resize-none transition-colors"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-2xl bg-[#F6F7FC] hover:bg-[#E8E7FF] text-[#17163D] font-bold text-xs transition-colors border border-[#E8E7FF] cursor-pointer"
              >
                {t('cancel')}
              </button>

              <button
                type="submit"
                className="flex-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-[#FF647C] to-[#7657F6] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FF647C]/30 transition-all cursor-pointer active:scale-95 hover:brightness-105"
              >
                <span>{editingGroup ? 'حفظ التعديلات' : '+ إنشاء المجموعة'}</span>
              </button>
            </div>

          </form>
        </div>
      </div>
    </ModalPortal>
  );
};
