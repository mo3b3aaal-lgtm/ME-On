import React, { useState, useEffect } from 'react';
import { X, CalendarCheck2, Clock, Calendar, BookOpen, DollarSign } from 'lucide-react';
import { Session, Group } from '../types';
import { db, getEffectiveSessionPrice } from '../utils/storage';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';

interface AddEditSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSession?: Session | null;
  defaultGroupId?: string;
  allGroups: Group[];
  onSaveComplete: (savedSession: Session) => void;
}

const ARABIC_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export const AddEditSessionModal: React.FC<AddEditSessionModalProps> = ({
  isOpen,
  onClose,
  editingSession,
  defaultGroupId,
  allGroups,
  onSaveComplete,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [groupId, setGroupId] = useState(defaultGroupId || allGroups[0]?.id || '');
  const [title, setTitle] = useState('حصة مراجعة وشرح درس جديد');
  const [date, setDate] = useState(todayStr);
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
      setDate(todayStr);
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
  }, [editingSession, defaultGroupId, isOpen]);

  // Update hours and price when times or group change
  const handleTimeChange = (newStart: string, newEnd: string) => {
    setStartTime(newStart);
    setEndTime(newEnd);
    if (isHourly) {
      const calculated = calculateHoursFromTimes(newStart, newEnd);
      setHours(calculated);
      setPricePerStudent(Math.round(calculated * hourlyRate));
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
        className="fixed inset-0 bg-[#2D332A]/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir="rtl"
      >
        <div className="bg-[#F9F7F2] border border-[#E8E2D6] rounded-t-3xl sm:rounded-[32px] max-w-lg w-full mx-auto max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header - Fixed Top */}
        <div className="p-4 flex items-center justify-between border-b border-[#E8E2D6] bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#748C70] text-white shadow-sm">
              <CalendarCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#2D332A]">
                {editingSession ? 'تعديل بيانات الحصة' : 'جدولة حصة دراسية جديدة'}
              </h2>
              <p className="text-[11px] text-[#8A9187]">
                تدعم أكثر من حصة في نفس اليوم ومرتبطة بالتاريخ والشهر والسنة
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

        {/* Form Body - Scrollable */}
        <form id="add-session-form" onSubmit={handleSubmit} className="p-4 overflow-y-auto overscroll-contain android-scrollbar flex-1 space-y-3.5 text-xs text-[#434B3E]">
          
          {/* Select Group */}
          <div>
            <label className="block font-bold text-[#6B7567] mb-1">المجموعة المستهدفة *</label>
            <select
              value={groupId}
              onChange={(e) => {
                const gId = e.target.value;
                setGroupId(gId);
                const grp = allGroups.find((g) => g.id === gId);
                if (grp) setPricePerStudent(getEffectiveSessionPrice(null, grp));
              }}
              className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
            >
              {allGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.subject} - {g.gradeLevel})
                </option>
              ))}
            </select>
          </div>

          {/* Title / Topic */}
          <div>
            <label className="block font-bold text-[#6B7567] mb-1">عنوان أو موضوع الحصة *</label>
            <input
              type="text"
              required
              placeholder="مثال: الباب الأول - شرح قوانين الحركة وحل مسائل"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
            />
          </div>

          {/* Date & Day */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-[#6B7567] mb-1">تاريخ الحصة *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#6B7567] mb-1">رقم الحصة التسلسلي</label>
              <input
                type="number"
                min={1}
                value={sessionNumber}
                onChange={(e) => setSessionNumber(Number(e.target.value))}
                className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none"
              />
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-[#6B7567] mb-1">وقت البدء</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => handleTimeChange(e.target.value, endTime)}
                className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-[#6B7567] mb-1">وقت الانتهاء</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => handleTimeChange(startTime, e.target.value)}
                className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none"
              />
            </div>
          </div>

          {/* Status & Pricing Options */}
          <div>
            <label className="block font-bold text-[#6B7567] mb-1">حالة الحصة</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none"
            >
              <option value="scheduled">مجدولة (قادمة)</option>
              <option value="completed">تمت واكتملت</option>
              <option value="cancelled">ملغاة</option>
            </select>
          </div>

          {isHourly ? (
            <div className="p-3 bg-[#F0EBE1] border border-[#E8E2D6] rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#2D332A]">حساب الحصة بالساعة (مجموعة بالساعة)</span>
                <span className="text-[11px] font-bold text-[#748C70]">
                  الإجمالي: {Math.round(hours * hourlyRate)} ج.م
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7567] mb-1">مدة الحصة (بالساعات)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    value={hours}
                    onChange={(e) => {
                      const h = Number(e.target.value) || 1;
                      setHours(h);
                      setPricePerStudent(Math.round(h * hourlyRate));
                    }}
                    className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#6B7567] mb-1">سعر الساعة للطالب (ج.م)</label>
                  <input
                    type="number"
                    min="0"
                    value={hourlyRate}
                    onChange={(e) => {
                      const rate = Number(e.target.value) || 0;
                      setHourlyRate(rate);
                      setPricePerStudent(Math.round(hours * rate));
                    }}
                    className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none"
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
                      setPricePerStudent(Math.round(val * hourlyRate));
                    }}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                      hours === val
                        ? 'bg-[#748C70] text-white border-[#748C70]'
                        : 'bg-white text-[#6B7567] border-[#E8E2D6] hover:bg-[#EAE5D8]'
                    }`}
                  >
                    {val} س
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="block font-bold text-[#6B7567] mb-1">سعر الحصة للطالب (ج.م)</label>
              <input
                type="number"
                min={0}
                value={pricePerStudent}
                onChange={(e) => setPricePerStudent(Number(e.target.value))}
                className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block font-bold text-[#6B7567] mb-1">ملاحظات أو واجبات الحصة</label>
            <textarea
              rows={2}
              placeholder="الواجب المطلوب: صفحة 24 إلى 28..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none resize-none"
            />
          </div>

        </form>

        {/* Pinned Sticky Action Footer */}
        <div className="p-3.5 bg-white border-t border-[#E8E2D6] flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-[#E8E2D6] bg-white text-[#6B7567] font-bold text-xs hover:bg-[#F2ECE1] transition-all"
          >
            إلغاء
          </button>
          <button
            type="submit"
            form="add-session-form"
            className="flex-1 py-3 rounded-2xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-xs shadow-sm transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
          >
            <span>{editingSession ? 'حفظ تعديلات الحصة' : 'جدولة الحصة'}</span>
          </button>
        </div>

      </div>
    </div>
    </ModalPortal>
  );
};
