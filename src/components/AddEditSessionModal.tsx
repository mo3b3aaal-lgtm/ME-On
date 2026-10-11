import React, { useState, useEffect } from 'react';
import { Session, Group } from '../types';
import { db, getEffectiveSessionPrice, multiplyMoney } from '../utils/storage';
import { useTranslation } from '../utils/i18n';
import { toLocalISODate, parseLocalDateStr } from '../utils/localDate';
import { BottomSheet } from './ui/BottomSheet';
import { AppIcon } from './ui/AppIcon';

interface AddEditSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSession?: Session | null;
  defaultGroupId?: string;
  defaultDate?: string;
  isExtraSessionDefault?: boolean;
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
  isExtraSessionDefault = false,
  allGroups,
  onSaveComplete,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');
  const todayStr = toLocalISODate();

  const [groupId, setGroupId] = useState(defaultGroupId || allGroups[0]?.id || '');
  const [title, setTitle] = useState(isEn ? 'Lesson Review & Explanation' : 'حصة مراجعة وشرح درس جديد');
  const [date, setDate] = useState(defaultDate || todayStr);
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('17:30');
  const [sessionNumber, setSessionNumber] = useState<number>(1);
  const [hours, setHours] = useState<number>(1.5);
  const [hourlyRate, setHourlyRate] = useState<number>(100);
  const [pricePerStudent, setPricePerStudent] = useState<number>(100);
  const [status, setStatus] = useState<'scheduled' | 'completed' | 'cancelled'>('scheduled');
  const [isExtraSession, setIsExtraSession] = useState<boolean>(isExtraSessionDefault);
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
      setIsExtraSession(editingSession.isExtraSession || false);
      setNotes(editingSession.notes || '');
    } else {
      const gId = defaultGroupId || allGroups[0]?.id || '';
      setGroupId(gId);
      const grp = allGroups.find((g) => g.id === gId);
      setTitle(isExtraSessionDefault ? (isEn ? 'Extra Session' : 'حصة إضافية') : (isEn ? 'Lesson & Application' : 'حصة شرح وتطبيق'));
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
      setIsExtraSession(isExtraSessionDefault);
      setNotes('');
    }
  }, [editingSession, defaultGroupId, defaultDate, isExtraSessionDefault, isOpen]);

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

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!groupId || !date) return;

    const parsedDate = parseLocalDateStr(date);
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
      title: title.trim() || (isEn ? 'Class Session' : 'حصة دراسية'),
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
      isExtraSession: isExtraSession || false,
      notes: notes.trim(),
      createdAt: editingSession ? editingSession.createdAt : new Date().toISOString(),
    };

    db.saveSession(savedSession);
    onSaveComplete(savedSession);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <BottomSheet
      id="add-edit-session"
      isOpen={isOpen}
      onClose={onClose}
      title={editingSession ? (isEn ? 'Edit Session' : 'تعديل بيانات الحصة') : (isEn ? 'Schedule New Session' : 'جدولة حصة دراسية جديدة')}
      subtitle={
        isEn
          ? 'Supports multiple sessions on same day, linked to financials'
          : 'تدعم أكثر من حصة في نفس اليوم ومرتبطة بالسجل المحاسبي'
      }
      headerLeading={
        <div className="w-10 h-10 rounded-2xl bg-mint-soft text-navy flex items-center justify-center shrink-0 border border-line">
          <AppIcon name="calendarCheck" size={20} weight="duotone" />
        </div>
      }
      headerTrailing={
        isExtraSession ? (
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-orange text-white">
            {isEn ? 'Extra' : 'إضافية'}
          </span>
        ) : undefined
      }
      bodyClassName="p-4"
      footer={
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="btn-soft flex-1"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            form="add-session-form"
            className="btn-orange flex-1"
          >
            <AppIcon name="check" size={16} weight="bold" />
            <span>
              {editingSession
                ? isEn ? 'Save Changes' : 'حفظ تعديلات الحصة'
                : isEn ? '+ Schedule Session' : '+ جدولة الحصة'}
            </span>
          </button>
        </div>
      }
    >
      <form id="add-session-form" onSubmit={handleSubmit} className="space-y-3.5 text-xs text-navy text-start">
        {/* Select Group */}
        <div className="p-3.5 rounded-2xl bg-page border border-line space-y-1.5 shadow-2xs">
          <label className="field-label flex items-center gap-1.5">
            <AppIcon name="book" size={14} className="text-navy" />
            <span>{isEn ? 'Target Group *' : 'المجموعة المستهدفة *'}</span>
          </label>
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
        <div className="p-3.5 rounded-2xl bg-page border border-line space-y-1.5 shadow-2xs">
          <label className="field-label flex items-center gap-1.5">
            <AppIcon name="edit" size={14} className="text-navy" />
            <span>{isEn ? 'Topic or Lesson Title *' : 'عنوان أو موضوع الحصة *'}</span>
          </label>
          <input
            type="text"
            required
            placeholder={isEn ? 'e.g. Chapter 1 - Motion Laws & Problems' : 'مثال: الباب الأول - شرح قوانين الحركة وحل مسائل'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="classy-input"
          />
        </div>

        {/* Date & Day */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="p-3 rounded-2xl bg-page border border-line space-y-1 shadow-2xs">
            <label className="field-label flex items-center gap-1">
              <AppIcon name="calendar" size={13} className="text-navy" />
              <span>{isEn ? 'Date *' : 'تاريخ الحصة *'}</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="classy-input"
            />
          </div>

          <div className="p-3 rounded-2xl bg-page border border-line space-y-1 shadow-2xs">
            <label className="field-label">{isEn ? 'Session #' : 'رقم الحصة التسلسلي'}</label>
            <input
              type="number"
              min={1}
              value={sessionNumber}
              onChange={(e) => setSessionNumber(Number(e.target.value))}
              className="classy-input"
            />
          </div>
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-2xl bg-page border border-line space-y-1 shadow-2xs">
            <label className="field-label flex items-center gap-1">
              <AppIcon name="clock" size={13} className="text-navy" />
              <span>{isEn ? 'Start Time' : 'وقت البدء'}</span>
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => handleTimeChange(e.target.value, endTime)}
              className="classy-input"
            />
          </div>

          <div className="p-3 rounded-2xl bg-page border border-line space-y-1 shadow-2xs">
            <label className="field-label flex items-center gap-1">
              <AppIcon name="clock" size={13} className="text-navy" />
              <span>{isEn ? 'End Time' : 'وقت الانتهاء'}</span>
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => handleTimeChange(startTime, e.target.value)}
              className="classy-input"
            />
          </div>
        </div>

        {/* Status */}
        <div className="p-3.5 rounded-2xl bg-page border border-line space-y-1.5 shadow-2xs">
          <label className="field-label">{isEn ? 'Session Status' : 'حالة الحصة'}</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="classy-select"
          >
            <option value="scheduled">{isEn ? 'Scheduled' : 'مجدولة (قادمة)'}</option>
            <option value="completed">{isEn ? 'Completed' : 'تمت واكتملت'}</option>
            <option value="cancelled">{isEn ? 'Cancelled' : 'ملغاة'}</option>
          </select>
        </div>

        {/* Extra Session Identifier */}
        <div className="p-3.5 rounded-2xl bg-page border border-line shadow-2xs">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="space-y-0.5">
              <span className="font-black text-xs text-navy flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-navy text-white text-[10px] font-black">
                  {isEn ? 'Extra' : 'إضافية'}
                </span>
                {isEn ? 'Extra / Additional Session' : 'حصة إضافية (خارج الجدول المعتاد)'}
              </span>
              <p className="text-[11px] text-slate font-medium">
                {isEn ? 'Marks this session as extra on calendar & reports' : 'تمييز هذه الحصة كحصة إضافية في تقويم الحصص وسجلات المتابعة'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={isExtraSession}
              onChange={(e) => setIsExtraSession(e.target.checked)}
              className="classy-checkbox"
            />
          </label>
        </div>

        {isHourly ? (
          <div className="p-4 rounded-2xl space-y-3 bg-mint-soft border border-line">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-navy">{isEn ? 'Hourly Billing (Group)' : 'حساب الحصة بالساعة (مجموعة بالساعة)'}</span>
              <span className="text-xs font-black text-navy">
                {isEn ? 'Total:' : 'الإجمالي:'} {multiplyMoney(hours, hourlyRate)} {t('currency')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="field-label">{isEn ? 'Duration (Hours)' : 'مدة الحصة (بالساعات)'}</label>
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
                  className="classy-input"
                />
              </div>

              <div>
                <label className="field-label">{isEn ? 'Hourly Rate' : 'سعر الساعة للطالب'}</label>
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
                  className="classy-input"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
              {[1, 1.5, 2, 2.5, 3].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setHours(val);
                    setPricePerStudent(multiplyMoney(val, hourlyRate));
                  }}
                  className={`chip flex-1 ${hours === val ? 'chip-active' : ''}`}
                >
                  {val} {isEn ? 'h' : 'س'}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-page border border-line space-y-1.5 shadow-2xs">
            <label className="field-label flex items-center gap-1">
              <AppIcon name="coins" size={13} className="text-navy" />
              <span>{isEn ? 'Price per Student' : 'سعر الحصة للطالب'}</span>
            </label>
            <input
              type="number"
              step="any"
              min={0}
              value={pricePerStudent}
              onChange={(e) => setPricePerStudent(Number(e.target.value))}
              className="classy-input"
            />
          </div>
        )}

        {/* Notes */}
        <div className="p-3.5 rounded-2xl bg-page border border-line space-y-1.5 shadow-2xs">
          <label className="field-label flex items-center gap-1">
            <AppIcon name="edit" size={13} className="text-navy" />
            <span>{isEn ? 'Notes or Homework' : 'ملاحظات أو واجبات الحصة'}</span>
          </label>
          <textarea
            rows={2}
            placeholder={isEn ? 'Homework: pages 24-28...' : 'الواجب المطلوب: صفحة 24 إلى 28...'}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="classy-textarea"
          />
        </div>
      </form>
    </BottomSheet>
  );
};
