import React, { useState, useMemo } from 'react';
import { useSwipeGesture } from '../utils/useSwipeGesture';
import {
  ChevronRight,
  ChevronLeft,
  Calendar,
  Clock,
  Plus,
  Users,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Sparkles,
  CalendarDays,
  MapPin,
  DollarSign,
  Layers,
  ChevronDown,
  CalendarRange,
} from 'lucide-react';
import { Session, Group, Student } from '../types';
import { db } from '../utils/storage';
import {
  MONTH_NAMES_ARABIC,
  MONTH_NAMES_ENGLISH,
  CALENDAR_WEEKDAY_INITIALS_ARABIC,
  CALENDAR_WEEKDAY_HEADERS_ARABIC,
  CalendarDayCell,
  generateMonthGrid,
  getYearClassStatsMap,
  getDetailedAgendaForDate,
  DetailedDateAgenda,
  DetailedDateAgendaItem,
  formatDateKey,
} from '../utils/schedule';
import { useTranslation } from '../utils/i18n';
import { toLocalISODate, parseLocalDateStr } from '../utils/localDate';
import { useCurrentLocalDate } from '../utils/useCurrentLocalDate';

export type CalendarViewMode = 'week' | 'month' | 'year';

interface MultiYearCalendarProps {
  sessions: Session[];
  groups: Group[];
  students?: Student[];
  onOpenAddSession: (defaultGroupId?: string, defaultDate?: string) => void;
  onEditSession: (session: Session) => void;
  onOpenAttendanceModal: (session: Session) => void;
  onSessionDeleted: () => void;
  onDataChanged?: () => void;
}

export const MultiYearCalendar: React.FC<MultiYearCalendarProps> = ({
  sessions,
  groups,
  students = [],
  onOpenAddSession,
  onEditSession,
  onOpenAttendanceModal,
  onSessionDeleted,
  onDataChanged,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');

  const { now: today, todayStr } = useCurrentLocalDate();
  const currentYear = today.getFullYear();
  const currentMonthIdx = today.getMonth();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(currentMonthIdx);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [isYearPickerOpen, setIsYearPickerOpen] = useState<boolean>(false);

  // Enrollments from db
  const enrollments = useMemo(() => {
    return db.getEnrollments();
  }, [sessions, groups]);

  // Filtered sessions and groups if a group is chosen
  const filteredSessions = useMemo(() => {
    if (selectedGroupId === 'all') return sessions;
    return sessions.filter((s) => s.groupId === selectedGroupId);
  }, [sessions, selectedGroupId]);

  const filteredGroups = useMemo(() => {
    if (selectedGroupId === 'all') return groups;
    return groups.filter((g) => g.id === selectedGroupId);
  }, [groups, selectedGroupId]);

  // Pre-calculated stats for the selected year
  const yearStatsMap = useMemo(() => {
    return getYearClassStatsMap(
      selectedYear,
      filteredSessions,
      filteredGroups,
      enrollments,
      students
    );
  }, [selectedYear, filteredSessions, filteredGroups, enrollments, students]);

  // Pre-generate grids for all 12 months of the year
  const monthsGrids = useMemo(() => {
    const grids: Record<number, CalendarDayCell[]> = {};
    for (let m = 0; m < 12; m++) {
      grids[m] = generateMonthGrid(selectedYear, m, yearStatsMap);
    }
    return grids;
  }, [selectedYear, yearStatsMap]);

  // Detailed Agenda for selected date
  const selectedDateAgenda: DetailedDateAgenda = useMemo(() => {
    return getDetailedAgendaForDate(
      selectedDateStr,
      filteredSessions,
      filteredGroups,
      enrollments,
      students,
      true
    );
  }, [selectedDateStr, filteredSessions, filteredGroups, enrollments, students]);

  // Weekdays localized
  const currentWeekDays = useMemo(() => {
    const selectedDate = parseLocalDateStr(selectedDateStr);
    const dayOfWeek = selectedDate.getDay();
    const distFromSaturday = (dayOfWeek + 1) % 7;
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - distFromSaturday);

    const week: { dateStr: string; dayName: string; dayNumber: number; isToday: boolean; isSelected: boolean }[] = [];
    const arabicDays = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    const englishDays = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const dayList = isEn ? englishDays : arabicDays;

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dStr = toLocalISODate(d);
      week.push({
        dateStr: dStr,
        dayName: dayList[i],
        dayNumber: d.getDate(),
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDateStr,
      });
    }
    return week;
  }, [selectedDateStr, todayStr, isEn]);

  const monthNames = isEn ? MONTH_NAMES_ENGLISH : MONTH_NAMES_ARABIC;

  // Stepper handlers
  const handlePrevMonth = () => {
    if (selectedMonthIdx === 0) {
      setSelectedYear((prev) => prev - 1);
      setSelectedMonthIdx(11);
    } else {
      setSelectedMonthIdx((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonthIdx === 11) {
      setSelectedYear((prev) => prev + 1);
      setSelectedMonthIdx(0);
    } else {
      setSelectedMonthIdx((prev) => prev + 1);
    }
  };

  const handleJumpToToday = () => {
    setSelectedYear(currentYear);
    setSelectedMonthIdx(currentMonthIdx);
    setSelectedDateStr(todayStr);
  };

  const handleSelectDay = (cell: CalendarDayCell) => {
    setSelectedDateStr(cell.dateStr);
    setSelectedYear(cell.year);
    setSelectedMonthIdx(cell.monthIndex);
  };

  const handleDeleteSession = (session: Session) => {
    const sessionAtt = db.getAttendance().filter((a) => a.sessionId === session.id);
    const hasRecordedAttendance = sessionAtt.length > 0;
    const warningMsg = hasRecordedAttendance
      ? (isEn
          ? `Warning: Class "${session.title}" has attendance recorded for (${sessionAtt.length}) students.\n\nDeleting this class will clear attendance records and recalculate balances.\n\nAre you sure you want to delete?`
          : `تحذير: الحصة "${session.title}" مسجل لها كشف حضور (${sessionAtt.length}) طالب.\n\nحذف الحصة سيؤدي إلى مسح كشف الحضور وتحديث الأرصدة.\n\nهل أنت متأكد من الحذف؟`)
      : (isEn ? `Are you sure you want to permanently delete class "${session.title}"?` : `هل أنت متأكد من حذف حصة "${session.title}" نهائياً؟`);

    if (confirm(warningMsg)) {
      db.deleteSession(session.id);
      onSessionDeleted();
      if (onDataChanged) onDataChanged();
    }
  };

  const handleStartRecurringClass = (item: DetailedDateAgendaItem) => {
    const targetGroup = groups.find((g) => g.id === item.groupId);
    const now = new Date().toISOString();
    const newSession: Session = {
      id: 'ses_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      groupId: item.groupId,
      title: item.studentName
        ? (isEn ? `Class: ${item.studentName} (${targetGroup?.name || ''})` : `حصة ${item.studentName} (${targetGroup?.name || ''})`)
        : (isEn ? `Class: ${targetGroup?.name || ''}` : `حصة ${targetGroup?.name || ''}`),
      date: item.dateStr,
      dayName: item.dayName,
      startTime: item.startTime || '16:00',
      endTime: item.endTime || '',
      sessionNumber: 1,
      hours: 1.5,
      hourlyRate: item.hourlyRate || targetGroup?.hourlyRate || targetGroup?.defaultPrice || 100,
      pricePerStudent: item.pricePerStudent || targetGroup?.defaultPrice || 100,
      status: 'scheduled',
      notes: '',
      studentId: item.studentId,
      year: parseInt(item.dateStr.split('-')[0], 10),
      month: parseInt(item.dateStr.split('-')[1], 10),
      createdAt: now,
      updatedAt: now,
    };

    db.saveSession(newSession);
    if (onDataChanged) onDataChanged();
    onOpenAttendanceModal(newSession);
  };

  const handlePrevDay = () => {
    const d = parseLocalDateStr(selectedDateStr);
    d.setDate(d.getDate() - 1);
    const dStr = toLocalISODate(d);
    setSelectedDateStr(dStr);
    setSelectedYear(d.getFullYear());
    setSelectedMonthIdx(d.getMonth());
  };

  const handleNextDay = () => {
    const d = parseLocalDateStr(selectedDateStr);
    d.setDate(d.getDate() + 1);
    const dStr = toLocalISODate(d);
    setSelectedDateStr(dStr);
    setSelectedYear(d.getFullYear());
    setSelectedMonthIdx(d.getMonth());
  };

  const handlePrevYear = () => {
    setSelectedYear((prev) => prev - 1);
  };

  const handleNextYear = () => {
    setSelectedYear((prev) => prev + 1);
  };

  const handleSwipePrev = () => {
    if (viewMode === 'week') {
      handlePrevDay();
    } else if (viewMode === 'month') {
      handlePrevMonth();
    } else if (viewMode === 'year') {
      handlePrevYear();
    }
  };

  const handleSwipeNext = () => {
    if (viewMode === 'week') {
      handleNextDay();
    } else if (viewMode === 'month') {
      handleNextMonth();
    } else if (viewMode === 'year') {
      handleNextYear();
    }
  };

  // Swiping gestures for Calendar container (natural swipe mapping)
  const calendarSwipeGestures = useSwipeGesture({
    onSwipeLeft: isRTL ? handleSwipePrev : handleSwipeNext,
    onSwipeRight: isRTL ? handleSwipeNext : handleSwipePrev,
    threshold: 45,
  });

  const weekdayHeaders = isEn
    ? ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    : CALENDAR_WEEKDAY_HEADERS_ARABIC;

  return (
    <div
      {...calendarSwipeGestures}
      className="space-y-3.5 text-[#0F1206] select-none-touch"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* 1. COMPACT & CLEAN TOP TOOLBAR */}
      <div className="bg-[#F8F2EC] rounded-2xl p-3.5 sm:p-4 border border-[#DDD3C7]/80 shadow-xs space-y-3">
        {/* Row 1: Mode Switcher & Date Stepper */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          {/* Segmented View Mode Tabs */}
          <div className="flex items-center bg-[#DDD3C7]/70 p-1 rounded-xl border border-[#DDD3C7]/60 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === 'week'
                  ? 'bg-[#F8F2EC] text-[#293828] shadow-xs font-black'
                  : 'text-[#756046] hover:text-[#0F1206]'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>{isEn ? 'Daily Agenda' : 'الأجندة اليومية'}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-[#F8F2EC] text-[#293828] shadow-xs font-black'
                  : 'text-[#756046] hover:text-[#0F1206]'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{isEn ? 'Monthly Calendar' : 'التقويم الشهري'}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('year')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === 'year'
                  ? 'bg-[#F8F2EC] text-[#293828] shadow-xs font-black'
                  : 'text-[#756046] hover:text-[#0F1206]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isEn ? 'Yearly' : 'السنوي'}</span>
            </button>
          </div>

          {/* Stepper + Today + Add */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center bg-[#DDD3C7]/15 border border-[#DDD3C7] rounded-xl p-0.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#756046] hover:text-[#293828] hover:bg-[#F8F2EC] transition-all cursor-pointer"
                title={isEn ? 'Previous Month' : 'الشهر السابق'}
              >
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>

              <span className="px-2.5 py-0.5 text-xs font-bold text-[#0F1206] whitespace-nowrap">
                {monthNames[selectedMonthIdx]} {selectedYear}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#756046] hover:text-[#293828] hover:bg-[#F8F2EC] transition-all cursor-pointer"
                title={isEn ? 'Next Month' : 'الشهر القادم'}
              >
                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleJumpToToday}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border cursor-pointer ${
                selectedDateStr === todayStr
                  ? 'bg-[#DDD3C7]/65 border-[#DDD3C7] text-[#293828]'
                  : 'bg-[#F8F2EC] border-[#DDD3C7] text-[#756046] hover:bg-[#DDD3C7]/25'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#DDD3C7]" />
              <span>{isEn ? 'Today' : 'اليوم'}</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenAddSession(undefined, selectedDateStr)}
              className="px-3 py-1.5 rounded-xl bg-[#293828] hover:bg-[#0F1206] text-[#F8F2EC] font-bold text-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isEn ? 'New Class' : 'حصة جديدة'}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Group Filter */}
        <div className="pt-2 border-t border-[#DDD3C7]/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#756046] font-medium">{isEn ? 'Filter by group:' : 'تصفية بالمجموعة:'}</span>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="bg-[#DDD3C7]/15 border border-[#DDD3C7] rounded-lg px-2.5 py-1 text-xs text-[#0F1206] font-bold focus:outline-none focus:border-[#293828] cursor-pointer"
            >
              <option value="all">{isEn ? 'All Groups & Lessons' : 'جميع المجموعات والدروس'}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.type === 'private' ? (isEn ? 'Private' : 'خاص') : (isEn ? 'Group' : 'مجموعة')})
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-[#756046]">
            {isEn
              ? `${selectedDateAgenda.items.length} classes on ${selectedDateAgenda.formattedDisplayDate}`
              : `${selectedDateAgenda.items.length} حصص في ${selectedDateAgenda.formattedDisplayDate}`}
          </span>
        </div>
      </div>

      {/* 2. MAIN CONTENT PER VIEW MODE */}

      {/* --- A. WEEKLY / DAILY AGENDA MODE (DEFAULT - CLEAN & DIRECT) --- */}
      {viewMode === 'week' && (
        <div className="space-y-3">
          {/* 7 Days Horizontal Bar (Sat-Fri) */}
          <div className="bg-[#F8F2EC] rounded-2xl p-2.5 border border-[#DDD3C7]/80 shadow-xs">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center">
              {currentWeekDays.map((wDay, idx) => {
                const dAgenda = getDetailedAgendaForDate(
                  wDay.dateStr,
                  filteredSessions,
                  filteredGroups,
                  enrollments,
                  students,
                  true
                );
                const count = dAgenda.items.length;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDateStr(wDay.dateStr)}
                    className={`py-2 px-1 rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      wDay.isSelected
                        ? 'bg-[#293828] text-[#F8F2EC] shadow-xs font-black'
                        : wDay.isToday
                        ? 'bg-[#DDD3C7]/65 text-[#0F1206] border border-[#DDD3C7]'
                        : 'bg-[#DDD3C7]/15 hover:bg-[#DDD3C7]/35 text-[#756046]'
                    }`}
                  >
                    <span className={`text-[10px] ${wDay.isSelected ? 'text-[#DDD3C7]' : 'text-[#756046]'}`}>
                      {wDay.dayName}
                    </span>
                    <span className="text-sm font-black">
                      {wDay.dayNumber}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-md ${
                      wDay.isSelected
                        ? 'bg-[#F8F2EC]/20 text-[#F8F2EC]'
                        : count > 0
                        ? 'text-[#293828] font-bold'
                        : 'text-[#756046] opacity-60'
                    }`}>
                      {count > 0 ? (isEn ? `${count} cl` : `${count} ح`) : '-'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Agenda Items for Selected Date */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-[#0F1206]">
                  {isEn ? `Classes on ${selectedDateAgenda.formattedDisplayDate}` : `حصص يوم ${selectedDateAgenda.formattedDisplayDate}`}
                </h3>
                {selectedDateAgenda.isToday && (
                  <span className="px-2 py-0.5 rounded-full bg-[#DDD3C7]/65 text-[#293828] font-bold text-[10px]">
                    {isEn ? 'Today' : 'اليوم'}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpenAddSession(undefined, selectedDateStr)}
                className="text-xs font-bold text-[#293828] hover:text-[#0F1206] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isEn ? 'Add class for this date' : 'إضافة حصة لهذا اليوم'}</span>
              </button>
            </div>

            {selectedDateAgenda.items.length === 0 ? (
              <div className="bg-[#F8F2EC] rounded-2xl p-8 border border-[#DDD3C7]/80 text-center space-y-2 flex flex-col items-center">
                <Calendar className="w-8 h-8 text-[#DDD3C7]" />
                <p className="text-xs font-bold text-[#0F1206]">
                  {isEn ? 'No scheduled classes on this day' : 'لا توجد حصص مجدولة أو مسجلة في هذا اليوم'}
                </p>
                <p className="text-[11px] text-[#756046]">
                  {isEn ? 'You can schedule a new group or private class directly' : 'يمكنك جدولة حصة خاصة أو جماعية جديدة لهذا اليوم مباشرة'}
                </p>
                <button
                  type="button"
                  onClick={() => onOpenAddSession(undefined, selectedDateStr)}
                  className="mt-1 px-3.5 py-1.5 rounded-xl bg-[#293828] hover:bg-[#0F1206] text-[#F8F2EC] font-bold text-xs inline-flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Schedule New Class' : 'جدولة حصة جديدة'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDateAgenda.items.map((item) => {
                  const isRecorded = item.source === 'session_record';

                  return (
                    <div
                      key={item.id}
                      className={`bg-[#F8F2EC] rounded-2xl p-3.5 border transition-all shadow-xs space-y-2.5 ${
                        item.status === 'cancelled'
                          ? 'border-[#293828]/30 bg-[#293828]/30'
                          : item.status === 'completed'
                          ? 'border-[#293828]/50'
                          : 'border-[#DDD3C7]/80 hover:border-[#756046]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {/* Time & Title */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="text-center shrink-0 min-w-[50px] bg-[#DDD3C7]/15 border border-[#DDD3C7] rounded-xl px-2 py-1.5">
                            <span className="text-xs font-black text-[#0F1206] block leading-tight">
                              {item.formattedTime || item.startTime || (isEn ? 'Flexible' : 'وقت مرن')}
                            </span>
                            <span className="text-[9px] font-bold text-[#756046] block mt-0.5">
                              {item.isPrivate ? (isEn ? 'Private' : 'خاص') : (isEn ? 'Group' : 'مجموعة')}
                            </span>
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: item.accentColor || '#293828' }}
                              />
                              <h4 className="font-bold text-sm text-[#0F1206] truncate">
                                {item.isPrivate
                                  ? (item.studentName ? (isEn ? `Private — ${item.studentName}` : `خاص — ${item.studentName}`) : (isEn ? 'Private Lesson' : 'درس خاص'))
                                  : item.groupName}
                              </h4>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-[#756046] flex-wrap font-medium">
                              <span>{item.isPrivate ? (isEn ? 'Private Lesson' : 'درس خاص') : (item.subject || (isEn ? 'General' : 'عام'))}</span>
                              {item.stageOrGrade && (
                                <>
                                  <span>·</span>
                                  <span>{item.stageOrGrade}</span>
                                </>
                              )}
                              {item.location && (
                                <>
                                  <span>·</span>
                                  <span className="truncate max-w-[120px]">{item.location}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Dynamic Semantic Status Badge */}
                        {item.status === 'completed' ? (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#DDD3C7]/65 text-[#0F1206] border border-[#293828]/60 inline-flex items-center gap-1 shadow-2xs shrink-0">
                            <CheckCircle2 className="w-3 h-3 text-[#293828]" />
                            <span>{t('completed')}</span>
                          </span>
                        ) : item.status === 'cancelled' ? (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#DDD3C7]/15 text-[#0F1206] border border-[#DDD3C7] inline-flex items-center gap-1 shadow-2xs shrink-0">
                            <AlertCircle className="w-3 h-3 text-[#0F1206]" />
                            <span>{t('cancelled')}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#DDD3C7]/70 text-[#0F1206] border border-[#0F1206]/50 inline-flex items-center gap-1 shadow-2xs shrink-0">
                            <Clock className="w-3 h-3 text-[#0F1206]" />
                            <span>{t('scheduled')}</span>
                          </span>
                        )}
                      </div>

                      {/* Attendance info for completed sessions */}
                      {item.hasRecordedAttendance && (
                        <div className="text-xs text-[#756046] font-medium flex items-center gap-2 pt-1 border-t border-[#DDD3C7]/70">
                          <span className="text-[#0F1206] font-bold">{t('present')}: {item.presentCount}</span>
                          {item.absentChargedCount > 0 && (
                            <span className="text-[#293828]">· {t('absentCharged')}: {item.absentChargedCount}</span>
                          )}
                          {item.absentFreeCount > 0 && (
                            <span className="text-[#756046]">· {t('absentExcused')}: {item.absentFreeCount}</span>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#DDD3C7]/70">
                        <span className="text-[11px] text-[#756046]">
                          {isRecorded ? (isEn ? 'Recorded Class' : 'حصة مسجلة بالسجل') : (isEn ? 'Recurring Scheduled Class' : 'حصة أسبوعية مجدولة')}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isRecorded && item.session ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onOpenAttendanceModal(item.session!)}
                                className="px-3 py-1 rounded-xl bg-[#293828] hover:bg-[#0F1206] text-[#F8F2EC] font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{item.hasRecordedAttendance ? (isEn ? 'Edit Attendance' : 'تعديل الحضور') : (isEn ? 'Take Attendance' : 'رصد الحضور')}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => onEditSession(item.session!)}
                                className="p-1.5 rounded-xl bg-[#DDD3C7]/70 text-[#756046] hover:bg-[#DDD3C7]/50 transition-colors cursor-pointer"
                                title={t('edit')}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteSession(item.session!)}
                                className="p-1.5 rounded-xl bg-[#293828]/10 text-[#293828] hover:bg-[#293828]/15 transition-colors cursor-pointer"
                                title={t('delete')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartRecurringClass(item)}
                              className="px-3.5 py-1.5 rounded-xl bg-[#293828] hover:bg-[#0F1206] text-[#F8F2EC] font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isEn ? 'Take Attendance & Start Class' : 'رصد الحضور وبدء الحصة'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- B. MONTH VIEW --- */}
      {viewMode === 'month' && (
        <div className="space-y-3">
          <div className="bg-[#F8F2EC] rounded-2xl p-4 border border-[#DDD3C7]/80 shadow-xs space-y-3">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {weekdayHeaders.map((wHeader, wIdx) => (
                <div
                  key={wIdx}
                  className="text-xs font-bold text-[#756046] py-1.5 bg-[#DDD3C7]/15 rounded-lg"
                >
                  {wHeader}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {(monthsGrids[selectedMonthIdx] || []).map((cell, idx) => {
                const isSelected = cell.dateStr === selectedDateStr;
                const hasClasses = cell.classCount > 0;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDay(cell)}
                    className={`min-h-[58px] sm:min-h-[72px] p-1.5 rounded-xl border text-right flex flex-col justify-between transition-all cursor-pointer ${
                      !cell.isCurrentMonth
                        ? 'border-[#DDD3C7]/70 bg-[#DDD3C7]/15 opacity-30 pointer-events-none'
                        : isSelected
                        ? 'border-[#293828] bg-[#DDD3C7]/70 ring-2 ring-[#293828]/20'
                        : cell.isToday
                        ? 'border-[#DDD3C7] bg-[#DDD3C7]/30'
                        : 'border-[#DDD3C7]/70 bg-[#F8F2EC] hover:border-[#756046]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs font-black rounded-md w-5 h-5 flex items-center justify-center ${
                          cell.isToday
                            ? 'bg-[#293828] text-[#F8F2EC]'
                            : isSelected
                            ? 'bg-[#0F1206] text-[#F8F2EC]'
                            : 'text-[#0F1206]'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                    </div>

                    {cell.isCurrentMonth && hasClasses && (
                      <div className="mt-1">
                        <span className="px-1.5 py-0.5 rounded-md bg-[#DDD3C7]/65 text-[#293828] text-[10px] font-bold block truncate">
                          {cell.classCount} {isEn ? 'classes' : 'حصة'}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Date Summary below Month Grid */}
          <div className="bg-[#F8F2EC] rounded-2xl p-4 border border-[#DDD3C7]/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-[#0F1206]">
                {isEn ? `Classes on ${selectedDateAgenda.formattedDisplayDate}` : `حصص يوم ${selectedDateAgenda.formattedDisplayDate}`} ({selectedDateAgenda.items.length})
              </h4>
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className="text-xs text-[#293828] font-bold hover:underline cursor-pointer"
              >
                {isEn ? 'Open Day Agenda →' : 'فتح تفاصيل اليوم في الأجندة ←'}
              </button>
            </div>

            {selectedDateAgenda.items.length === 0 ? (
              <p className="text-xs text-[#756046] py-2">{isEn ? 'No scheduled classes on this day' : 'لا توجد حصص مجدولة لهذا اليوم'}</p>
            ) : (
              <div className="space-y-1.5">
                {selectedDateAgenda.items.map((it) => (
                  <div key={it.id} className="p-2.5 rounded-xl bg-[#DDD3C7]/15 border border-[#DDD3C7]/70 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: it.accentColor || '#293828' }} />
                      <span className="font-bold text-[#0F1206] truncate">{it.isPrivate ? it.studentName : it.groupName}</span>
                      <span className="text-[#756046] text-[11px]">({it.formattedTime || it.startTime || (isEn ? 'Flexible' : 'وقت مرن')})</span>
                    </div>
                    {it.status === 'completed' ? (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#DDD3C7]/65 text-[#0F1206] border border-[#293828]/60 inline-flex items-center gap-1 shadow-2xs shrink-0">
                        <CheckCircle2 className="w-2.5 h-2.5 text-[#293828]" />
                        <span>{t('completed')}</span>
                      </span>
                    ) : it.status === 'cancelled' ? (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#DDD3C7]/15 text-[#0F1206] border border-[#DDD3C7] inline-flex items-center gap-1 shadow-2xs shrink-0">
                        <AlertCircle className="w-2.5 h-2.5 text-[#0F1206]" />
                        <span>{t('cancelled')}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#DDD3C7]/70 text-[#0F1206] border border-[#0F1206]/50 inline-flex items-center gap-1 shadow-2xs shrink-0">
                        <Clock className="w-2.5 h-2.5 text-[#0F1206]" />
                        <span>{t('scheduled')}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- C. YEAR VIEW --- */}
      {viewMode === 'year' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, monthIdx) => {
            const monthGrid = monthsGrids[monthIdx] || [];
            const monthName = monthNames[monthIdx];
            const isCurrentMonth = selectedYear === currentYear && monthIdx === currentMonthIdx;

            let monthClassCount = 0;
            monthGrid.forEach((cell) => {
              if (cell.isCurrentMonth) monthClassCount += cell.classCount;
            });

            return (
              <div
                key={monthIdx}
                onClick={() => {
                  setSelectedMonthIdx(monthIdx);
                  setViewMode('month');
                }}
                className={`bg-[#F8F2EC] rounded-2xl p-3 border cursor-pointer hover:border-[#293828] transition-all shadow-xs ${
                  isCurrentMonth ? 'border-[#293828] ring-2 ring-[#DDD3C7]' : 'border-[#DDD3C7]/80'
                }`}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-[#DDD3C7]/70">
                  <h4 className="font-bold text-xs text-[#0F1206]">{monthName}</h4>
                  <span className="text-[10px] text-[#756046] font-bold">
                    {monthClassCount > 0 ? (isEn ? `${monthClassCount} classes` : `${monthClassCount} حصة`) : '-'}
                  </span>
                </div>

                <div className="grid grid-cols-7 gap-0.5 text-center mt-1.5">
                  {monthGrid.map((cell, cIdx) => (
                    <span
                      key={cIdx}
                      className={`text-[10px] py-0.5 rounded ${
                        !cell.isCurrentMonth
                          ? 'opacity-10'
                          : cell.isToday
                          ? 'bg-[#293828] text-[#F8F2EC] font-bold'
                          : cell.classCount > 0
                          ? 'bg-[#DDD3C7]/65 text-[#293828] font-bold'
                          : 'text-[#756046]'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
