import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  CalendarCheck2,
} from 'lucide-react';
import { Group, Session } from '../types';
import { db } from '../utils/storage';
import { useTranslation } from '../utils/i18n';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';

interface BulkAddSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionsCreated?: (count: number) => void;
}

export const BulkAddSessionModal: React.FC<BulkAddSessionModalProps> = ({
  isOpen,
  onClose,
  onSessionsCreated,
}) => {
  const { t, language } = useTranslation();
  const isRtl = language === 'ar';
  const modalLayer = useModalLayer('bulk_add_session', isOpen, onClose);

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [weeksCount, setWeeksCount] = useState<number>(4);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [sessionTime, setSessionTime] = useState<string>('16:00');
  const [topicPrefix, setTopicPrefix] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<{ success: boolean; count: number; error?: string } | null>(null);

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

  React.useEffect(() => {
    if (isOpen) {
      const allGroups = db.getGroups();
      setGroups(allGroups);
      if (allGroups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(allGroups[0].id);
      }
      setResult(null);
    }
  }, [isOpen]);

  const toggleDay = (dayKey: string) => {
    setSelectedDays((prev) =>
      prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey]
    );
  };

  const previewDates = useMemo(() => {
    if (!startDate || selectedDays.length === 0 || weeksCount <= 0) return [];
    const dates: { dateStr: string; dayName: string }[] = [];
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return [];

    const totalDays = weeksCount * 7;
    for (let i = 0; i < totalDays; i++) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      const dayNum = current.getDay();

      const matchedDay = daysOfWeek.find((d) => d.value === dayNum);
      if (matchedDay && selectedDays.includes(matchedDay.key)) {
        dates.push({
          dateStr: current.toISOString().split('T')[0],
          dayName: matchedDay.label,
        });
      }
    }
    return dates;
  }, [startDate, selectedDays, weeksCount, daysOfWeek]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || previewDates.length === 0) return;

    setIsSubmitting(true);
    try {
      const selectedGroup = groups.find((g) => g.id === selectedGroupId);
      const newSessions: Session[] = previewDates.map((item, index) => {
        const title = topicPrefix.trim()
          ? `${topicPrefix.trim()} - ${isRtl ? `حصة ${index + 1}` : `Session ${index + 1}`}`
          : `${isRtl ? 'حصة' : 'Session'} ${index + 1} (${selectedGroup?.name || ''})`;

        return {
          id: 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + '_' + index,
          groupId: selectedGroupId,
          title,
          date: item.dateStr,
          startTime: sessionTime || '16:00',
          endTime: '',
          location: location || selectedGroup?.location || '',
          topic: title,
          status: 'scheduled',
          pricePerStudent: selectedGroup?.defaultPrice || 0,
          notes: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      newSessions.forEach((s) => db.saveSession(s));
      setResult({ success: true, count: newSessions.length });
      if (onSessionsCreated) {
        onSessionsCreated(newSessions.length);
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
    <ModalPortal>
      <div
        className="fixed inset-0 bg-[#16324F]/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
        style={{ zIndex: modalLayer.zIndex }}
      >
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className="bg-[#FFFFFF] rounded-3xl shadow-2xl max-w-2xl w-full border border-[#C7CDD3]/60 overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 bg-gradient-to-l from-[#0A3D62]/10 via-[#0A3D62]/10 to-transparent border-b border-[#C7CDD3] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0A3D62] text-[#FFFFFF] flex items-center justify-center shadow-lg shadow-[#0A3D62]/20">
                <CalendarCheck2 className="w-6 h-6 text-[#FFFFFF]" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-[#16324F] flex items-center gap-2">
                  {isRtl ? 'إنشاء جدول حصص مجمع' : 'Bulk Schedule Sessions'}
                </h3>
                <p className="text-xs sm:text-sm text-[#6F7882]">
                  {isRtl
                    ? 'أنشئ جدول الحصص لشهر أو أكثر بضغطة واحدة لمجموعتك'
                    : 'Schedule recurring sessions across multiple weeks in one step'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#6F7882] hover:text-[#16324F] hover:bg-[#C7CDD3]/35 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
            {result?.success ? (
              <div className="py-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#C7CDD3]/15 border border-[#0A3D62]/50 text-[#0A3D62] flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-[#16324F]">
                    {isRtl ? 'تم إنشاء الحصص بنجاح!' : 'Sessions Created Successfully!'}
                  </h4>
                  <p className="text-sm text-[#16324F] mt-1">
                    {isRtl
                      ? `تمت إضافة ${result.count} حصة بنجاح إلى جدول المجموعة.`
                      : `Successfully scheduled ${result.count} sessions for this group.`}
                  </p>
                </div>
                <div className="pt-4 flex justify-center">
                  <button
                    onClick={onClose}
                    className="px-6 py-2.5 bg-[#0A3D62] hover:bg-[#16324F] text-[#FFFFFF] rounded-xl font-bold shadow-md shadow-[#0A3D62]/20 transition-all text-sm"
                  >
                    {t('confirm')}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {result?.error && (
                  <div className="p-4 rounded-2xl bg-[#0A3D62]/10 border border-[#0A3D62]/30 text-[#0A3D62] text-xs flex items-center gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{result.error}</span>
                  </div>
                )}

                {/* Group Selector */}
                <div>
                  <label className="block text-xs font-bold text-[#16324F] mb-2">
                    {t('groupName')} <span className="text-[#0A3D62]">*</span>
                  </label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-[#C7CDD3]/70 bg-[#C7CDD3]/15 text-[#16324F] font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#0A3D62]/30 focus:border-[#0A3D62]"
                  >
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Start Date & Weeks Count */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#16324F] mb-2">
                      {isRtl ? 'تاريخ البداية' : 'Start Date'} <span className="text-[#0A3D62]">*</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-[#C7CDD3]/70 bg-[#C7CDD3]/15 text-[#16324F] text-sm focus:outline-none focus:ring-2 focus:ring-[#0A3D62]/30 focus:border-[#0A3D62] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#16324F] mb-2">
                      {isRtl ? 'عدد الأسابيع' : 'Duration (Weeks)'} <span className="text-[#0A3D62]">*</span>
                    </label>
                    <select
                      value={weeksCount}
                      onChange={(e) => setWeeksCount(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#C7CDD3]/70 bg-[#C7CDD3]/15 text-[#16324F] text-sm focus:outline-none focus:ring-2 focus:ring-[#0A3D62]/30 focus:border-[#0A3D62] font-bold"
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
                  <label className="block text-xs font-bold text-[#16324F] mb-2">
                    {isRtl ? 'أيام الحصص الأسبوعية' : 'Session Days'}{' '}
                    <span className="text-[#0A3D62]">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {daysOfWeek.map((day) => {
                      const isSelected = selectedDays.includes(day.key);
                      return (
                        <button
                          type="button"
                          key={day.key}
                          onClick={() => toggleDay(day.key)}
                          className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border ${
                            isSelected
                              ? 'bg-[#0A3D62] text-[#FFFFFF] border-[#0A3D62] shadow-sm shadow-[#0A3D62]/25'
                              : 'bg-[#C7CDD3]/15 text-[#16324F] border-[#C7CDD3]/50 hover:bg-[#C7CDD3]/35'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time & Topic Prefix */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#16324F] mb-2">
                      {isRtl ? 'موعد الحصة' : 'Session Time'}
                    </label>
                    <input
                      type="time"
                      value={sessionTime}
                      onChange={(e) => setSessionTime(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#C7CDD3]/70 bg-[#C7CDD3]/15 text-[#16324F] text-sm focus:outline-none focus:ring-2 focus:ring-[#0A3D62]/30 focus:border-[#0A3D62] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#16324F] mb-2">
                      {isRtl ? 'عنوان / موضوع الحصص (اختياري)' : 'Topic / Title Prefix (Optional)'}
                    </label>
                    <input
                      type="text"
                      placeholder={isRtl ? 'مثال: المراجعة النهائية' : 'e.g. Final Review'}
                      value={topicPrefix}
                      onChange={(e) => setTopicPrefix(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#C7CDD3]/70 bg-[#C7CDD3]/15 text-[#16324F] text-sm focus:outline-none focus:ring-2 focus:ring-[#0A3D62]/30 focus:border-[#0A3D62]"
                    />
                  </div>
                </div>

                {/* Preview count */}
                <div className="p-4 rounded-2xl bg-[#C7CDD3]/50 border border-[#0A3D62]/40 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#16324F] text-xs font-bold">
                    <Sparkles className="w-4 h-4 text-[#FFFFFF]" />
                    <span>{isRtl ? 'إجمالي الحصص المزمع إنشاؤها:' : 'Total sessions to schedule:'}</span>
                  </div>
                  <span className="text-base font-black text-[#0A3D62]">
                    {previewDates.length} {isRtl ? 'حصة' : 'Sessions'}
                  </span>
                </div>

                {/* Submit button */}
                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 border border-[#C7CDD3]/60 rounded-xl text-[#16324F] font-bold text-sm hover:bg-[#C7CDD3]/35 transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || previewDates.length === 0}
                    className="px-6 py-2.5 bg-[#0A3D62] hover:bg-[#16324F] disabled:opacity-50 text-[#FFFFFF] rounded-xl font-black text-sm shadow-md shadow-[#0A3D62]/20 transition-all flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <span>{t('loading')}</span>
                    ) : (
                      <>
                        <CalendarCheck2 className="w-4 h-4" />
                        <span>{isRtl ? 'إنشاء الحصص الآن' : 'Schedule Sessions Now'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
