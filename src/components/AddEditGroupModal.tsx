import React, { useState, useEffect } from 'react';
import { X, Layers, Clock, MapPin, DollarSign, Calendar } from 'lucide-react';
import { Group, GroupType, BillingType } from '../types';
import { db } from '../utils/storage';

interface AddEditGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingGroup?: Group | null;
  onSaveComplete: (savedGroup: Group) => void;
}

const WEEK_DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

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
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('الصف الأول الثانوي');
  const [type, setType] = useState<GroupType>('group');
  const [billingType, setBillingType] = useState<BillingType>('per_session');
  const [defaultPrice, setDefaultPrice] = useState<number>(100);
  const [packageSessionsCount, setPackageSessionsCount] = useState<number>(10);
  const [scheduleDays, setScheduleDays] = useState<string[]>(['السبت', 'الثلاثاء']);
  const [scheduleTime, setScheduleTime] = useState('04:00 م');
  const [roomOrLocation, setRoomOrLocation] = useState('قاعة 1 - السنتر');
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
      setPackageSessionsCount(editingGroup.packageSessionsCount || 10);
      setScheduleDays(editingGroup.scheduleDays || []);
      setScheduleTime(editingGroup.scheduleTime || '');
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
      setPackageSessionsCount(10);
      setScheduleDays(['السبت', 'الثلاثاء']);
      setScheduleTime('04:00 م');
      setRoomOrLocation('قاعة 1');
      setAccentColor(GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)]);
      setNotes('');
    }
  }, [editingGroup, isOpen]);

  const toggleDay = (day: string) => {
    if (scheduleDays.includes(day)) {
      setScheduleDays(scheduleDays.filter((d) => d !== day));
    } else {
      setScheduleDays([...scheduleDays, day]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !subject.trim()) return;

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
      packageSessionsCount: billingType === 'package' ? (Number(packageSessionsCount) || 10) : undefined,
      scheduleDays,
      scheduleTime: scheduleTime.trim(),
      roomOrLocation: roomOrLocation.trim(),
      accentColor,
      notes: notes.trim(),
      createdAt: editingGroup ? editingGroup.createdAt : new Date().toISOString(),
    };

    db.saveGroup(savedGroup);
    onSaveComplete(savedGroup);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2D332A]/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200" dir="rtl">
      <div className="bg-[#F9F7F2] border border-[#E8E2D6] rounded-t-3xl sm:rounded-[32px] max-w-lg w-full mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-[#E8E2D6] bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#748C70] text-white shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#2D332A]">
                {editingGroup ? 'تعديل بيانات المجموعة' : 'إنشاء مجموعة جديدة'}
              </h2>
              <p className="text-[11px] text-[#8A9187]">
                إعداد المجموعة ونظام المحاسبة والمواعيد الأسبوعية
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
              مجموعة عامة (سنتر / مدرسي)
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
              درس خاص / Private
            </button>
          </div>

          {/* Group Name & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-[#6B7567] mb-1">اسم المجموعة / الصف *</label>
              <input
                type="text"
                required
                placeholder="مثال: مجموعة أوائل الفيزياء A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#6B7567] mb-1">المادة الدراسية *</label>
              <input
                type="text"
                required
                placeholder="رياضيات، لغة عربية، علوم..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
              />
            </div>
          </div>

          {/* Grade Level & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-[#6B7567] mb-1">المرحلة / الصف</label>
              <input
                type="text"
                placeholder="مثال: الصف الثاني الثانوي"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#6B7567] mb-1">المكان / القاعة</label>
              <input
                type="text"
                placeholder="سنتر التميز - قاعة 2..."
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
              <span>نظام المحاسبة الافتراضي للمجموعة</span>
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-[#8A9187] mb-1">طريقة الحساب الافتراضية</label>
                <select
                  value={billingType}
                  onChange={(e) => setBillingType(e.target.value as BillingType)}
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none"
                >
                  <option value="prepaid">دفع بالحصة - دفع مسبق (Prepaid)</option>
                  <option value="postpaid">دفع بالحصة - دفع بعد الحصة (Postpaid)</option>
                  <option value="package">باقة عدد حصص (Session Package)</option>
                  <option value="monthly">اشتراك شهري ثابت (Monthly)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-[#8A9187] mb-1">
                  السعر الافتراضي {billingType === 'monthly' ? 'الشهري' : billingType === 'package' ? 'للباقة الإجمالية' : 'للحصة'} (ج.م)
                </label>
                <input
                  type="number"
                  min={0}
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(Number(e.target.value))}
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none font-bold"
                />
              </div>
            </div>

            {/* Package count selection & presets */}
            {billingType === 'package' && (
              <div className="p-2.5 bg-[#F9F7F2] rounded-xl border border-[#D49B4B]/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[#2D332A]">عدد حصص الباقة:</label>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#8A9187]">حصص:</span>
                    <input
                      type="number"
                      min="1"
                      value={packageSessionsCount}
                      onChange={(e) => setPackageSessionsCount(Math.max(1, Number(e.target.value)))}
                      className="w-16 bg-white border border-[#E8E2D6] rounded-lg p-1 text-xs font-bold text-[#2D332A] text-center focus:outline-none focus:border-[#D49B4B]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[5, 8, 10, 15, 20].map((count) => {
                    const isSel = packageSessionsCount === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setPackageSessionsCount(count)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          isSel
                            ? 'bg-[#D49B4B] text-white shadow-xs'
                            : 'bg-white text-[#6B7567] border border-[#E8E2D6] hover:border-[#D49B4B]'
                        }`}
                      >
                        {count} حصص
                      </button>
                    );
                  })}
                </div>

                <div className="p-2 bg-[#D49B4B]/10 rounded-lg flex items-center justify-between text-xs text-[#9C6615] font-bold">
                  <span>سعر الحصة الفعلي المحسوب:</span>
                  <span className="text-sm text-[#2D332A]">
                    {packageSessionsCount > 0 ? Math.round(defaultPrice / packageSessionsCount) : 0} ج.م / حصة
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Schedule Days & Default Time */}
          <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#2D332A] text-xs flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#748C70]" />
                <span>أيام الحصص الأسبوعية</span>
              </h3>
              <div className="flex items-center gap-1 text-[11px] text-[#8A9187]">
                <Clock className="w-3 h-3" />
                <input
                  type="text"
                  placeholder="الموعد: 04:00 م"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="bg-[#F9F7F2] border border-[#E8E2D6] rounded-lg px-2 py-0.5 text-xs text-[#2D332A] w-24 text-center focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {WEEK_DAYS.map((day) => {
                const isSelected = scheduleDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-[#748C70] text-white shadow-sm'
                        : 'bg-[#F9F7F2] text-[#6B7567] border border-[#E8E2D6] hover:border-[#748C70]/50'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block font-bold text-[#6B7567] mb-1.5">لون التمييز</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {GROUP_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setAccentColor(col)}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      accentColor === col ? 'ring-2 ring-[#2D332A] scale-110' : 'opacity-80'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-[#6B7567] mb-1">ملاحظات عن المجموعة</label>
              <input
                type="text"
                placeholder="أهداف المنهج، اشتراطات الحضور..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-xs shadow-sm transition-all active:scale-[0.99]"
            >
              {editingGroup ? 'حفظ تعديلات المجموعة' : 'إنشاء المجموعة'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
