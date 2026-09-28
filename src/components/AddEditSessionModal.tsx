import React, { useState, useEffect } from 'react';
import { X, CalendarCheck2, Clock, Calendar, BookOpen, DollarSign, Check } from 'lucide-react';
import { Session, Group } from '../types';
import { db, getEffectiveSessionPrice, roundMoney, multiplyMoney } from '../utils/storage';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import { useTranslation } from '../utils/i18n';

interface AddEditSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSession?: Session | null;
  defaultGroupId?: string;
  defaultDate?: string;
  allGroups: Group[];
  onSaveComplete: (savedSession: Session) => void;
}

const ARABIC_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export const AddEditSessionModal: React.FC<AddEditSessionModalProps> = ({
  isOpen,
  onClose,
  editingSession,
  defaultGroupId,
  defaultDate,
  allGroups,
  onSaveComplete,
}) => {
  const { t, isRTL } = useTranslation();
  const todayStr = new Date().toISOString().split('T')[0];

  const [groupId, setGroupId] = useState(defaultGroupId || allGroups[0]?.id || '');
  const [title, setTitle] = useState('حصة مراجعة وشرح درس جديد');
  const [date, setDate] = useState(defaultDate || todayStr);
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('17:30');
  const [sessionNumber, setSessionNumber] = useState<number>(1);
  const [hours, setHours] = useState<number>(1.5);
  const [hourlyRate, setHourlyRate] = useState<number>(100);
  const [pricePerStudent, setPricePerStudent] = useState<number>(100);
  const [status, setStatus] = useState<'scheduled' | 'completed' | 'cancelled'>('scheduled');
  const [notes, setNotes] = useState('');

  const selectedGroup = allGroups.find((g) => g.id === groupId);
  const isHourly = selectedGroup?.billingMode === 'hourly' || selectedGroup?.billingType === 'hourly';

  // Helper to calculate hours between times
  const calculateHoursFromTimes = (start: string, end: string): number => {
    try {
      if (!start || !end) return 1.5;
      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);
      const startMin = startH * 60 + startM;
      let endMin = endH * 60 + endM;
      if (endMin < startMin) endMin += 24 * 60; // Next day fallback
      const diffHrs = (endMin - startMin) / 60;
      return Math.round(diffHrs * 100) / 100 > 0 ? Math.round(diffHrs * 100) / 100 : 1.5;
    } catch {
      return 1.5;
    }
  };

  useEffect(() => {
    if (editingSession) {
      setGroupId(editingSession.groupId);
      setTitle(editingSession.title);
      setDate(editingSession.date);
      setStartTime(editingSession.startTime);
      setEndTime(editingSession.endTime || '');
      setSessionNumber(editingSession.sessionNumber || 1);
      const durHours = editingSession.hours || calculateHoursFromTimes(editingSession.startTime, editingSession.endTime || '');
      setHours(durHours);
      setHourlyRate(editingSession.hourlyRate || editingSession.pricePerStudent || 100);
      setPricePerStudent(editingSession.pricePerStudent || 100);
      setStatus(editingSession.status);
      setNotes(editingSession.notes || '');
    } else {
      const gId = defaultGroupId || allGroups[0]?.id || '';
      setGroupId(gId);
      const grp = allGroups.find((g) => g.id === gId);
      setTitle('حصة شرح وتطبيق');
      setDate(defaultDate || todayStr);
      setStartTime('16:00');
      setEndTime('17:30');
      setSessionNumber(1);
      const durHours = 1.5;
      setHours(durHours);
      const rate = grp?.hourlyRate || grp?.defaultPrice || 100;
      setHourlyRate(rate);
      const calculatedPrice = (grp?.billingMode === 'hourly' || grp?.billingType === 'hourly')
        ? durHours * rate
        : getEffectiveSessionPrice(null, grp);
      setPricePerStudent(calculatedPrice);
      setStatus('scheduled');
      setNotes('');
    }
  }, [editingSession, defaultGroupId, defaultDate, isOpen]);

  // Update hours and price when times or group change
  const handleTimeChange = (newStart: string, newEnd: string) => {
    setStartTime(newStart);
    setEndTime(newEnd);
    if (isHourly) {
      const calculated = calculateHoursFromTimes(newStart, newEnd);
      setHours(calculated);
      setPricePerStudent(multiplyMoney(calculated, hourlyRate));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !date) return;

    const parsedDate = new Date(date);
    const dayName = ARABIC_DAYS[parsedDate.getDay()] || 'السبت';
    const month = parsedDate.getMonth() + 1;
    const year = parsedDate.getFullYear();

    const grp = allGroups.find((g) => g.id === groupId);
    const isPackage = grp?.billingMode === 'package' || grp?.billingType === 'package';
    const isGrpHourly = grp?.billingMode === 'hourly' || grp?.billingType === 'hourly';
    const packageSessionsCount = isPackage ? (grp?.packageSessionsCount || 8) : undefined;
    const packageTotalPrice = isPackage ? grp?.defaultPrice : undefined;

    const finalHours = isGrpHourly ? (Number(hours) || calculateHoursFromTimes(startTime, endTime)) : undefined;
    const finalHourlyRate = isGrpHourly ? (Number(hourlyRate) || grp?.hourlyRate || 100) : undefined;
    const effectiveSessionPrice = isGrpHourly
      ? (finalHours! * finalHourlyRate!)
      : (Number(pricePerStudent) || (grp ? getEffectiveSessionPrice(null, grp) : 100));

    const sessionId = editingSession
      ? editingSession.id
      : `ses_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const savedSession: Session = {
      id: sessionId,
      groupId,
      title: title.trim() || 'حصة دراسية',
      date,
      dayName,
      month,
      year,
      startTime,
      endTime,
      sessionNumber: Number(sessionNumber) || 1,
      hours: finalHours,
      hourlyRate: finalHourlyRate,
      pricePerStudent: effectiveSessionPrice,
      sessionCount: 1,
      effectiveSessionPrice,
      totalSessionValue: effectiveSessionPrice,
      packageTotalPrice,
      packageSessionsCount,
      status,
      notes: notes.trim(),
      createdAt: editingSession ? editingSession.createdAt : new Date().toISOString(),
    };

    db.saveSession(savedSession);
    onSaveComplete(savedSession);
    onClose();
  };

  const modalLayer = useModalLayer('add-edit-session', isOpen, onClose);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-[#17163D]/65 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#F6F7FC] border border-[#E8E7FF] rounded-t-[28px] sm:rounded-[28px] max-w-lg w-full mx-auto max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Signature Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#17163D] via-[#403B9C] to-[#7657F6] text-white flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="flex items-center gap-3 relative z-10 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-sm shrink-0">
              <CalendarCheck2 className="w-5 h-5 text-[#55C7E8]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                {editingSession ? 'تعديل بيانات الحصة' : 'جدولة حصة دراسية جديدة'}
              </h2>
              <p className="text-xs text-[#E8E7FF]/85 font-medium truncate">
                تدعم أكثر من حصة في نفس اليوم ومرتبطة بالسجل المحاسبي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer relative z-10 active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form id="add-session-form" onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto overscroll-contain android-scrollbar flex-1 space-y-3.5 text-xs text-[#191A2E]">
          
          {/* Select Group */}
          <div className="classy-card p-3.5 space-y-1.5">
            <label className="font-black text-xs text-[#17163D] mb-1">المجموعة المستهدفة *</label>
            <select
              value={groupId}
              onChange={(e) => {
                const gId = e.target.value;
                setGroupId(gId);
                const grp = allGroups.find((g) => g.id === gId);
                if (grp) setPricePerStudent(getEffectiveSessionPrice(null, grp));
              }}
              className="classy-select"
            >
              {allGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.subject} - {g.gradeLevel})
                </option>
              ))}
            </select>
          </div>

          {/* Title / Topic */}
          <div className="classy-card p-3.5 space-y-1.5">
            <label className="font-black text-xs text-[#17163D] mb-1">عنوان أو موضوع الحصة *</label>
            <input
              type="text"
              required
              placeholder="مثال: الباب الأول - شرح قوانين الحركة وحل مسائل"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="classy-input"
            />
          </div>

          {/* Date & Day */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="classy-card p-3 space-y-1">
              <label className="font-black text-xs text-[#17163D] mb-1">تاريخ الحصة *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="classy-input font-bold"
              />
            </div>

            <div className="classy-card p-3 space-y-1">
              <label className="font-black text-xs text-[#17163D] mb-1">رقم الحصة التسلسلي</label>
              <input
                type="number"
                min={1}
                value={sessionNumber}
                onChange={(e) => setSessionNumber(Number(e.target.value))}
                className="classy-input font-bold"
              />
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="classy-card p-3 space-y-1">
              <label className="font-black text-xs text-[#17163D] mb-1">وقت البدء</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => handleTimeChange(e.target.value, endTime)}
                className="classy-input font-bold"
              />
            </div>

            <div className="classy-card p-3 space-y-1">
              <label className="font-black text-xs text-[#17163D] mb-1">وقت الانتهاء</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => handleTimeChange(startTime, e.target.value)}
                className="classy-input font-bold"
              />
            </div>
          </div>

          {/* Status & Pricing Options */}
          <div className="classy-card p-3.5 space-y-1.5">
            <label className="font-black text-xs text-[#17163D] mb-1">حالة الحصة</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="classy-select"
            >
              <option value="scheduled">مجدولة (قادمة)</option>
              <option value="completed">تمت واكتملت</option>
              <option value="cancelled">ملغاة</option>
            </select>
          </div>

          {isHourly ? (
            <div className="classy-card p-4 space-y-3 bg-[#E8E7FF]/30 border-[#D8D5FB]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#17163D]">حساب الحصة بالساعة (مجموعة بالساعة)</span>
                <span className="text-xs font-black text-[#7657F6]">
                  الإجمالي: {multiplyMoney(hours, hourlyRate)} ج.م
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-black text-[#74778F] mb-1">مدة الحصة (بالساعات)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    value={hours}
                    onChange={(e) => {
                      const h = Number(e.target.value) || 1;
                      setHours(h);
                      setPricePerStudent(multiplyMoney(h, hourlyRate));
                    }}
                    className="classy-input font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-[#74778F] mb-1">سعر الساعة للطالب (ج.م)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={hourlyRate}
                    onChange={(e) => {
                      const rate = Number(e.target.value) || 0;
                      setHourlyRate(rate);
                      setPricePerStudent(multiplyMoney(hours, rate));
                    }}
                    className="classy-input font-bold"
                  />
                </div>
              </div>

              {/* Quick Hours Pills */}
              <div className="flex items-center gap-1.5 pt-0.5">
                {[1, 1.5, 2, 2.5, 3].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setHours(val);
                      setPricePerStudent(multiplyMoney(val, hourlyRate));
                    }}
                    className={`flex-1 py-1 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                      hours === val
                        ? 'bg-[#7657F6] text-white border-[#7657F6] shadow-xs'
                        : 'bg-white text-[#74778F] border-[#E8E7FF] hover:bg-[#E8E7FF]'
                    }`}
                  >
                    {val} س
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="classy-card p-3.5 space-y-1.5">
              <label className="font-black text-xs text-[#17163D] mb-1">سعر الحصة للطالب (ج.م)</label>
              <input
                type="number"
                step="any"
                min={0}
                value={pricePerStudent}
                onChange={(e) => setPricePerStudent(Number(e.target.value))}
                className="classy-input font-bold"
              />
            </div>
          )}

          {/* Notes */}
          <div className="classy-card p-3.5 space-y-1.5">
            <label className="font-black text-xs text-[#17163D] mb-1">ملاحظات أو واجبات الحصة</label>
            <textarea
              rows={2}
              placeholder="الواجب المطلوب: صفحة 24 إلى 28..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="classy-textarea"
            />
          </div>

        </form>

        {/* Pinned Sticky Action Footer */}
        <div className="p-4 bg-white border-t border-[#E8E7FF] flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-[#E8E7FF] bg-white text-[#74778F] font-black text-xs hover:bg-[#F6F7FC] transition-all cursor-pointer"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            form="add-session-form"
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#17163D] via-[#403B9C] to-[#7657F6] text-white font-black text-xs shadow-lg shadow-[#7657F6]/30 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer hover:brightness-105"
          >
            <Check className="w-4 h-4 text-[#55C7E8] stroke-[3]" />
            <span>{editingSession ? 'حفظ تعديلات الحصة' : '+ جدولة الحصة'}</span>
          </button>
        </div>

      </div>
    </div>
    </ModalPortal>
  );
};
