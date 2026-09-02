import React, { useState, useEffect } from 'react';
import { X, CalendarCheck2, Clock, Calendar, BookOpen, DollarSign } from 'lucide-react';
import { Session, Group } from '../types';
import { db, getEffectiveSessionPrice } from '../utils/storage';

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
  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  const [groupId, setGroupId] = useState(defaultGroupId || allGroups[0]?.id || '');
  const [title, setTitle] = useState('حصة مراجعة وشرح درس جديد');
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('17:30');
  const [sessionNumber, setSessionNumber] = useState<number>(1);
  const [pricePerStudent, setPricePerStudent] = useState<number>(100);
  const [status, setStatus] = useState<'scheduled' | 'completed' | 'cancelled'>('scheduled');
  const [notes, setNotes] = useState('');

  const selectedGroup = allGroups.find((g) => g.id === groupId);

  useEffect(() => {
    if (editingSession) {
      setGroupId(editingSession.groupId);
      setTitle(editingSession.title);
      setDate(editingSession.date);
      setStartTime(editingSession.startTime);
      setEndTime(editingSession.endTime || '');
      setSessionNumber(editingSession.sessionNumber || 1);
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
      setPricePerStudent(getEffectiveSessionPrice(null, grp));
      setStatus('scheduled');
      setNotes('');
    }
  }, [editingSession, defaultGroupId, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !date) return;

    const parsedDate = new Date(date);
    const dayName = ARABIC_DAYS[parsedDate.getDay()] || 'السبت';
    const month = parsedDate.getMonth() + 1;
    const year = parsedDate.getFullYear();

    const grp = allGroups.find((g) => g.id === groupId);
    const isPackage = grp?.billingMode === 'package' || grp?.billingType === 'package';
    const packageSessionsCount = isPackage ? (grp?.packageSessionsCount || 8) : undefined;
    const packageTotalPrice = isPackage ? grp?.defaultPrice : undefined;
    const effectiveSessionPrice = Number(pricePerStudent) || (grp ? getEffectiveSessionPrice(null, grp) : 100);

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

  return (
    <div className="fixed inset-0 z-50 bg-[#2D332A]/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200" dir="rtl">
      <div className="bg-[#F9F7F2] border border-[#E8E2D6] rounded-t-3xl sm:rounded-[32px] max-w-lg w-full mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-[#E8E2D6] bg-white">
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto android-scrollbar flex-1 space-y-3.5 text-xs text-[#434B3E]">
          
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
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-[#6B7567] mb-1">وقت الانتهاء</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none"
              />
            </div>
          </div>

          {/* Status & Price */}
          <div className="grid grid-cols-2 gap-2.5">
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
          </div>

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

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-xs shadow-sm transition-all active:scale-[0.99]"
            >
              {editingSession ? 'حفظ تعديلات الحصة' : 'جدولة الحصة'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
