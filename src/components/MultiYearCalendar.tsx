import React, { useState, useMemo } from 'react';
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
  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonthIdx = today.getMonth();
  const todayStr = useMemo(() => today.toISOString().split('T')[0], [today]);

  // View state: default to 'week' (Daily/Weekly Agenda) for immediate access to today's schedule
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

  // Calculate 7 days for the current week around selectedDateStr (Sat-Fri in Egypt/Arab world)
  const currentWeekDays = useMemo(() => {
    const selectedDate = new Date(selectedDateStr);
    const dayOfWeek = selectedDate.getDay(); // 0 is Sunday, 6 is Saturday
    const distFromSaturday = (dayOfWeek + 1) % 7;
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - distFromSaturday);

    const week: { dateStr: string; dayName: string; dayNumber: number; isToday: boolean; isSelected: boolean }[] = [];
    const arabicDays = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dStr = d.toISOString().split('T')[0];
      week.push({
        dateStr: dStr,
        dayName: arabicDays[i],
        dayNumber: d.getDate(),
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDateStr,
      });
    }
    return week;
  }, [selectedDateStr, todayStr]);

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
      ? `تحذير: الحصة "${session.title}" مسجل لها كشف حضور (${sessionAtt.length}) طالب.\n\nحذف الحصة سيؤدي إلى مسح كشف الحضور وتحديث الأرصدة.\n\nهل أنت متأكد من الحذف؟`
      : `هل أنت متأكد من حذف حصة "${session.title}" نهائياً؟`;

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
      title: item.studentName ? `حصة ${item.studentName} (${targetGroup?.name || ''})` : `حصة ${targetGroup?.name || ''}`,
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

  return (
    <div className="space-y-3.5 text-[#0F172A]" dir="rtl">
      
      {/* 1. COMPACT & CLEAN TOP TOOLBAR */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs space-y-3">
        
        {/* Row 1: Mode Switcher & Date Stepper */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          
          {/* Segmented View Mode Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === 'week'
                  ? 'bg-white text-indigo-600 shadow-xs font-black'
                  : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>الأجندة اليومية</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-white text-indigo-600 shadow-xs font-black'
                  : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>التقويم الشهري</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('year')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === 'year'
                  ? 'bg-white text-indigo-600 shadow-xs font-black'
                  : 'text-slate-600 hover:text-[#0F172A]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>السنوي</span>
            </button>
          </div>

          {/* Stepper + Today + Add */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-0.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-white transition-all cursor-pointer"
                title="الشهر السابق"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <span className="px-2.5 py-0.5 text-xs font-bold text-[#0F172A] whitespace-nowrap">
                {MONTH_NAMES_ARABIC[selectedMonthIdx]} {selectedYear}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-white transition-all cursor-pointer"
                title="الشهر القادم"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleJumpToToday}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border cursor-pointer ${
                selectedDateStr === todayStr
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>اليوم</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenAddSession(undefined, selectedDateStr)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>حصة جديدة</span>
            </button>

          </div>
        </div>

        {/* Row 2: Group Filter */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">تصفية بالمجموعة:</span>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-[#0F172A] font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">جميع المجموعات والدروس</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.type === 'private' ? 'خاص' : 'مجموعة'})
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-slate-400">
            {selectedDateAgenda.items.length} حصص في {selectedDateAgenda.formattedDisplayDate}
          </span>
        </div>

      </div>

      {/* 2. MAIN CONTENT PER VIEW MODE */}

      {/* --- A. WEEKLY / DAILY AGENDA MODE (DEFAULT - CLEAN & DIRECT) --- */}
      {viewMode === 'week' && (
        <div className="space-y-3">
          
          {/* 7 Days Horizontal Bar (Sat-Fri) */}
          <div className="bg-white rounded-2xl p-2.5 border border-slate-200/80 shadow-xs">
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
                        ? 'bg-indigo-600 text-white shadow-xs font-black'
                        : wDay.isToday
                        ? 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span className={`text-[10px] ${wDay.isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                      {wDay.dayName}
                    </span>
                    <span className="text-sm font-black">
                      {wDay.dayNumber}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-md ${
                      wDay.isSelected
                        ? 'bg-white/20 text-white'
                        : count > 0
                        ? 'text-indigo-600 font-bold'
                        : 'text-slate-400 opacity-60'
                    }`}>
                      {count > 0 ? `${count} ح` : '-'}
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
                <h3 className="text-sm font-black text-[#0F172A]">
                  حصص يوم {selectedDateAgenda.formattedDisplayDate}
                </h3>
                {selectedDateAgenda.isToday && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-[10px]">
                    اليوم
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpenAddSession(undefined, selectedDateStr)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة حصة لهذا اليوم</span>
              </button>
            </div>

            {selectedDateAgenda.items.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center space-y-2 flex flex-col items-center">
                <Calendar className="w-8 h-8 text-slate-300" />
                <p className="text-xs font-bold text-[#0F172A]">
                  لا توجد حصص مجدولة أو مسجلة في هذا اليوم
                </p>
                <p className="text-[11px] text-slate-400">
                  يمكنك جدولة حصة خاصة أو جماعية جديدة لهذا اليوم مباشرة
                </p>
                <button
                  type="button"
                  onClick={() => onOpenAddSession(undefined, selectedDateStr)}
                  className="mt-1 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs inline-flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>جدولة حصة جديدة</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDateAgenda.items.map((item) => {
                  const isRecorded = item.source === 'session_record';

                  return (
                    <div
                      key={item.id}
                      className={`bg-white rounded-2xl p-3.5 border transition-all shadow-xs space-y-2.5 ${
                        item.status === 'cancelled'
                          ? 'border-rose-200 bg-rose-50/30'
                          : item.status === 'completed'
                          ? 'border-emerald-200/80'
                          : 'border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {/* Time & Title */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="text-center shrink-0 min-w-[50px] bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5">
                            <span className="text-xs font-black text-[#0F172A] block leading-tight">
                              {item.formattedTime || item.startTime || 'وقت مرن'}
                            </span>
                            <span className="text-[9px] font-bold text-slate-500 block mt-0.5">
                              {item.isPrivate ? 'خاص' : 'مجموعة'}
                            </span>
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: item.accentColor || '#4F46E5' }}
                              />
                              <h4 className="font-bold text-sm text-[#0F172A] truncate">
                                {item.isPrivate
                                  ? (item.studentName ? `خاص — ${item.studentName}` : 'درس خاص')
                                  : item.groupName}
                              </h4>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap font-medium">
                              <span>{item.isPrivate ? 'درس خاص' : (item.subject || 'عام')}</span>
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

                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg shrink-0 ${
                            item.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'cancelled'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.status === 'completed' ? 'مكتملة' : item.status === 'cancelled' ? 'ملغاة' : 'مجدولة'}
                        </span>
                      </div>

                      {/* Attendance info for completed sessions */}
                      {item.hasRecordedAttendance && (
                        <div className="text-xs text-slate-600 font-medium flex items-center gap-2 pt-1 border-t border-slate-100">
                          <span className="text-emerald-700 font-bold">حاضر: {item.presentCount}</span>
                          {item.absentChargedCount > 0 && (
                            <span className="text-rose-700">· غياب محسوب: {item.absentChargedCount}</span>
                          )}
                          {item.absentFreeCount > 0 && (
                            <span className="text-slate-400">· معذور: {item.absentFreeCount}</span>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-[11px] text-slate-400">
                          {isRecorded ? 'حصة مسجلة بالسجل' : 'حصة أسبوعية مجدولة'}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isRecorded && item.session ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onOpenAttendanceModal(item.session!)}
                                className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{item.hasRecordedAttendance ? 'تعديل الحضور' : 'رصد الحضور'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => onEditSession(item.session!)}
                                className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                                title="تعديل الحصة"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteSession(item.session!)}
                                className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                                title="حذف الحصة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartRecurringClass(item)}
                              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>رصد الحضور وبدء الحصة</span>
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
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
            
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {CALENDAR_WEEKDAY_HEADERS_ARABIC.map((wHeader, wIdx) => (
                <div
                  key={wIdx}
                  className="text-xs font-bold text-slate-500 py-1.5 bg-slate-50 rounded-lg"
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
                        ? 'border-slate-100 bg-slate-50/40 opacity-30 pointer-events-none'
                        : isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-600/20'
                        : cell.isToday
                        ? 'border-indigo-300 bg-indigo-50/30'
                        : 'border-slate-200/70 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs font-black rounded-md w-5 h-5 flex items-center justify-center ${
                          cell.isToday
                            ? 'bg-indigo-600 text-white'
                            : isSelected
                            ? 'bg-[#0F172A] text-white'
                            : 'text-[#0F172A]'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                    </div>

                    {cell.isCurrentMonth && hasClasses && (
                      <div className="mt-1">
                        <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold block truncate">
                          {cell.classCount} حصة
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

          </div>

          {/* Selected Date Summary below Month Grid */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-[#0F172A]">
                حصص يوم {selectedDateAgenda.formattedDisplayDate} ({selectedDateAgenda.items.length})
              </h4>
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
              >
                فتح تفاصيل اليوم في الأجندة ←
              </button>
            </div>

            {selectedDateAgenda.items.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">لا توجد حصص مجدولة لهذا اليوم</p>
            ) : (
              <div className="space-y-1.5">
                {selectedDateAgenda.items.map((it) => (
                  <div key={it.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: it.accentColor || '#4F46E5' }} />
                      <span className="font-bold text-[#0F172A] truncate">{it.isPrivate ? it.studentName : it.groupName}</span>
                      <span className="text-slate-400 text-[11px]">({it.formattedTime || it.startTime || 'وقت مرن'})</span>
                    </div>
                    <span className="text-[11px] font-bold text-indigo-600 shrink-0">
                      {it.status === 'completed' ? 'مكتملة' : 'مجدولة'}
                    </span>
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
            const monthName = MONTH_NAMES_ARABIC[monthIdx];
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
                className={`bg-white rounded-2xl p-3 border cursor-pointer hover:border-indigo-400 transition-all shadow-xs ${
                  isCurrentMonth ? 'border-indigo-400 ring-2 ring-indigo-50' : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <h4 className="font-bold text-xs text-[#0F172A]">{monthName}</h4>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {monthClassCount > 0 ? `${monthClassCount} حصة` : '-'}
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
                          ? 'bg-indigo-600 text-white font-bold'
                          : cell.classCount > 0
                          ? 'bg-indigo-50 text-indigo-700 font-bold'
                          : 'text-slate-500'
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
