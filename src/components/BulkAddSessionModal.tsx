import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Group, Session, Student } from '../types';
import { db } from '../utils/storage';
import { useTranslation } from '../utils/i18n';
import { toLocalISODate, parseLocalDateStr } from '../utils/localDate';
import { parseTimeToMinutes, getSlotKey } from '../utils/schedule';
import { BottomSheet } from './ui/BottomSheet';
import { AppIcon } from './ui/AppIcon';

interface BulkAddSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionsCreated?: (count: number) => void;
  selectedStudents?: Student[];
  preselectedGroupId?: string;
  allGroups?: Group[];
  onSuccess?: () => void;
}

export const BulkAddSessionModal: React.FC<BulkAddSessionModalProps> = ({
  isOpen,
  onClose,
  onSessionsCreated,
  selectedStudents,
  preselectedGroupId,
  allGroups,
  onSuccess,
}) => {
  const { t, language } = useTranslation();
  const isRtl = language === 'ar';

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(preselectedGroupId || '');
  const [startDate, setStartDate] = useState<string>(() => {
    return toLocalISODate();
  });
  const [weeksCount, setWeeksCount] = useState<number>(4);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [sessionTime, setSessionTime] = useState<string>('16:00');
  const [topicPrefix, setTopicPrefix] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<{ success: boolean; count: number; error?: string } | null>(null);

  // TASK 23: Re-entry lock and idempotency key per modal open
  const isSubmittingLockRef = useRef<boolean>(false);
  const idempotencyKeyRef = useRef<string>('');

  const daysOfWeek = useMemo(
    () => [
      { key: 'Saturday', label: t('daySat'), value: 6 },
      { key: 'Sunday', label: t('daySun'), value: 0 },
      { key: 'Monday', label: t('dayMon'), value: 1 },
      { key: 'Tuesday', label: t('dayTue'), value: 2 },
      { key: 'Wednesday', label: t('dayWed'), value: 3 },
      { key: 'Thursday', label: t('dayThu'), value: 4 },
      { key: 'Friday', label: t('dayFri'), value: 5 },
    ],
    [t]
  );

  useEffect(() => {
    if (isOpen) {
      idempotencyKeyRef.current = `bulk_modal_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const all = allGroups && allGroups.length > 0 ? allGroups : db.getGroups();
      setGroups(all);
      if (preselectedGroupId) {
        setSelectedGroupId(preselectedGroupId);
      } else if (all.length > 0 && !selectedGroupId) {
        setSelectedGroupId(all[0].id);
      }
      setResult(null);
    }
  }, [isOpen, preselectedGroupId, allGroups]);

  const toggleDay = (dayKey: string) => {
    setSelectedDays((prev) =>
      prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey]
    );
  };

  const rawPreviewDates = useMemo(() => {
    if (!startDate || selectedDays.length === 0 || weeksCount <= 0) return [];
    const dates: { dateStr: string; dayName: string }[] = [];
    const start = parseLocalDateStr(startDate);
    if (isNaN(start.getTime())) return [];

    const totalDays = weeksCount * 7;
    for (let i = 0; i < totalDays; i++) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      const dayNum = current.getDay();

      const matchedDay = daysOfWeek.find((d) => d.value === dayNum);
      if (matchedDay && selectedDays.includes(matchedDay.key)) {
        dates.push({
          dateStr: toLocalISODate(current),
          dayName: matchedDay.label,
        });
      }
    }
    return dates;
  }, [startDate, selectedDays, weeksCount, daysOfWeek]);

  // TASK 23: Max 10 sessions per submit
  const isOverLimit = rawPreviewDates.length > 10;
  const previewDates = useMemo(() => rawPreviewDates.slice(0, 10), [rawPreviewDates]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || previewDates.length === 0) return;

    // STEP 3: Re-entry lock
    if (isSubmittingLockRef.current) return;
    isSubmittingLockRef.current = true;
    setTimeout(() => {
      isSubmittingLockRef.current = false;
    }, 1500);

    // STEP 4: Safety net: if one user action would create more than 5 sessions for the same student/group and date, abort
    const dateCounts = new Map<string, number>();
    for (const item of previewDates) {
      dateCounts.set(item.dateStr, (dateCounts.get(item.dateStr) || 0) + 1);
      if ((dateCounts.get(item.dateStr) || 0) > 5) {
        setResult({
          success: false,
          count: 0,
          error: isRtl
            ? 'لا يمكن إنشاء أكثر من 5 حصص لنفس المجموعة في نفس اليوم'
            : 'Safety limit: Cannot create more than 5 sessions on the same date.',
        });
        return;
      }
    }

    // STEP 4: Confirmation if sessionCount > 1 or same slot already exists
    const existingSessions = db.getSessions();
    const existingEnrollments = db.getEnrollments();
    const selectedGroup = groups.find((g) => g.id === selectedGroupId);
    const startMins = parseTimeToMinutes(sessionTime || '16:00');

    let hasSameSlot = false;
    for (const item of previewDates) {
      const key = getSlotKey(
        {
          groupId: selectedGroupId,
          date: item.dateStr,
          startTime: sessionTime || '16:00',
        },
        existingEnrollments
      );
      if (
        existingSessions.some((s) => s.status !== 'cancelled' && getSlotKey(s, existingEnrollments) === key)
      ) {
        hasSameSlot = true;
        break;
      }
    }

    let allowSameSlot = false;
    if (previewDates.length > 1 || hasSameSlot) {
      const groupName = selectedGroup?.name || (isRtl ? 'المجموعة' : 'Group');
      const firstDate = previewDates[0]?.dateStr || '';
      const confirmMsg = isRtl
        ? `سيتم إنشاء ${previewDates.length} حصة لـ ${groupName} في ${firstDate} الساعة ${sessionTime || '16:00'}. هل ترغب في المتابعة؟`
        : `${previewDates.length} sessions for ${groupName} on ${firstDate} at ${sessionTime || '16:00'}. Continue?`;

      if (!window.confirm(confirmMsg)) {
        return;
      }
      allowSameSlot = true;
    }

    setIsSubmitting(true);
    try {
      const [h, m] = (sessionTime || '16:00').split(':').map(Number);
      const endH = !isNaN(h) ? (h + 1) % 24 : 17;
      const endTime = `${String(endH).padStart(2, '0')}:${String(!isNaN(m) ? m : 0).padStart(2, '0')}`;

      const newSessions: Session[] = previewDates.map((item, index) => {
        const dateObj = parseLocalDateStr(item.dateStr);
        const month = !isNaN(dateObj.getTime()) ? dateObj.getMonth() + 1 : new Date().getMonth() + 1;
        const year = !isNaN(dateObj.getTime()) ? dateObj.getFullYear() : new Date().getFullYear();
        const title = topicPrefix.trim()
          ? `${topicPrefix.trim()} - ${isRtl ? `حصة ${index + 1}` : `Session ${index + 1}`}`
          : `${isRtl ? 'حصة' : 'Session'} ${index + 1} (${selectedGroup?.name || ''})`;

        const deterministicId = `sess_${item.dateStr}_${selectedGroupId}_grp_${startMins}_${index}`;

        return {
          id: deterministicId,
          groupId: selectedGroupId,
          title,
          date: item.dateStr,
          dayName: item.dayName,
          month,
          year,
          startTime: sessionTime || '16:00',
          endTime,
          location: location || selectedGroup?.roomOrLocation || '',
          topic: title,
          status: 'scheduled',
          pricePerStudent: selectedGroup?.defaultPrice || 0,
          notes: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      newSessions.forEach((s) => db.saveSession(s, { allowSameSlotDuplicate: allowSameSlot }));
      setResult({ success: true, count: newSessions.length });
      if (onSessionsCreated) {
        onSessionsCreated(newSessions.length);
      }
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Failed to create sessions in bulk', err);
      setResult({
        success: false,
        count: 0,
        error: err?.message || (isRtl ? 'فشلت عملية إنشاء الحصص' : 'Failed to bulk create sessions'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <BottomSheet
      id="bulk-add-session-sheet"
      isOpen={isOpen}
      onClose={onClose}
      title={isRtl ? 'إنشاء جدول حصص مجمع' : 'Bulk Schedule Sessions'}
      subtitle={
        isRtl
          ? 'أنشئ جدول الحصص لشهر أو أكثر بضغطة واحدة لمجموعتك'
          : 'Schedule recurring sessions across multiple weeks in one step'
      }
      headerLeading={
        <div className="w-10 h-10 rounded-2xl bg-mint-soft text-navy flex items-center justify-center shrink-0 border border-line">
          <AppIcon name="calendarCheck" size={20} weight="fill" />
        </div>
      }
      footer={
        result?.success ? (
          <button
            type="button"
            onClick={onClose}
            className="btn-orange w-full"
          >
            {t('confirm')}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-soft flex-1"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              form="bulk-add-session-form"
              disabled={isSubmitting || previewDates.length === 0}
              className="btn-orange flex-1"
            >
              {isSubmitting ? (
                <span>{t('loading')}</span>
              ) : (
                <>
                  <AppIcon name="calendarCheck" size={16} weight="bold" />
                  <span>{isRtl ? 'إنشاء الحصص الآن' : 'Schedule Sessions Now'}</span>
                </>
              )}
            </button>
          </div>
        )
      }
    >
      {result?.success ? (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-teal/12 border border-teal/30 text-teal flex items-center justify-center mx-auto shadow-inner">
            <AppIcon name="checkCircle" size={36} weight="fill" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-navy">
              {isRtl ? 'تم إنشاء الحصص بنجاح!' : 'Sessions Created Successfully!'}
            </h4>
            <p className="text-sm text-slate mt-1">
              {isRtl
                ? `تمت إضافة ${result.count} حصة بنجاح إلى جدول المجموعة.`
                : `Successfully scheduled ${result.count} sessions for this group.`}
            </p>
          </div>
        </div>
      ) : (
        <form id="bulk-add-session-form" onSubmit={handleSubmit} className="space-y-4 text-xs text-navy">
          {result?.error && (
            <div className="p-3.5 rounded-2xl bg-coral/10 border border-coral/20 text-coral text-xs flex items-center gap-2 font-bold">
              <AppIcon name="warning" size={16} className="shrink-0" />
              <span>{result.error}</span>
            </div>
          )}

          {/* Group Selector */}
          <div>
            <label className="field-label">
              {t('groupName')} *
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              required
              className="classy-select"
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date & Weeks Count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">
                {isRtl ? 'تاريخ البداية' : 'Start Date'} *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="classy-input"
              />
            </div>
            <div>
              <label className="field-label">
                {isRtl ? 'عدد الأسابيع' : 'Duration (Weeks)'} *
              </label>
              <select
                value={weeksCount}
                onChange={(e) => setWeeksCount(Number(e.target.value))}
                className="classy-select"
              >
                <option value={2}>{isRtl ? 'أسبوعان (2)' : '2 Weeks'}</option>
                <option value={4}>{isRtl ? '4 أسابيع (شهر)' : '4 Weeks (1 Month)'}</option>
                <option value={8}>{isRtl ? '8 أسابيع (شهران)' : '8 Weeks (2 Months)'}</option>
                <option value={12}>{isRtl ? '12 أسبوع (فصل دراسي)' : '12 Weeks (Semester)'}</option>
              </select>
            </div>
          </div>

          {/* Days of week */}
          <div>
            <label className="field-label">
              {isRtl ? 'أيام الحصص الأسبوعية' : 'Session Days'} *
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              {daysOfWeek.map((day) => {
                const isSelected = selectedDays.includes(day.key);
                return (
                  <button
                    type="button"
                    key={day.key}
                    onClick={() => toggleDay(day.key)}
                    className={`chip ${isSelected ? 'chip-active' : ''}`}
                  >
                    {isSelected && <AppIcon name="check" size={14} weight="bold" />}
                    <span>{day.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time & Topic Prefix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">
                {isRtl ? 'موعد الحصة' : 'Session Time'}
              </label>
              <input
                type="time"
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
                className="classy-input"
              />
            </div>
            <div>
              <label className="field-label">
                {isRtl ? 'عنوان / موضوع الحصص (اختياري)' : 'Topic / Title Prefix (Optional)'}
              </label>
              <input
                type="text"
                placeholder={isRtl ? 'مثال: المراجعة النهائية' : 'e.g. Final Review'}
                value={topicPrefix}
                onChange={(e) => setTopicPrefix(e.target.value)}
                className="classy-input"
              />
            </div>
          </div>

          {/* Preview count */}
          {isOverLimit && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs flex items-center gap-2 font-medium">
              <AppIcon name="warning" size={16} className="text-amber-600 shrink-0" />
              <span>
                {isRtl
                  ? `الحد الأقصى لكل عملية إنشاء هو 10 حصص (تم تقليص ${rawPreviewDates.length} إلى 10).`
                  : `Maximum 10 sessions allowed per submit (clamped ${rawPreviewDates.length} to 10).`}
              </span>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-mint-soft border border-line flex items-center justify-between">
            <div className="flex items-center gap-2 text-navy text-xs font-bold">
              <AppIcon name="sparkles" size={16} className="text-orange" />
              <span>{isRtl ? 'إجمالي الحصص المزمع إنشاؤها:' : 'Total sessions to schedule:'}</span>
            </div>
            <span className="text-base font-bold text-navy">
              {previewDates.length} {isRtl ? 'حصة' : 'Sessions'}
            </span>
          </div>
        </form>
      )}
    </BottomSheet>
  );
};

export default BulkAddSessionModal;
