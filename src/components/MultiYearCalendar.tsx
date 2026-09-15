import React, { useState, useMemo, useEffect } from 'react';
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
  ListFilter,
  ArrowRight,
  MapPin,
  DollarSign,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { Session, Group, Student, Enrollment } from '../types';
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

export type CalendarViewMode = 'year' | 'month' | 'agenda';

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

  // View state
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(currentMonthIdx);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('year');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [isYearPickerOpen, setIsYearPickerOpen] = useState<boolean>(false);
  const [isAgendaDrawerOpen, setIsAgendaDrawerOpen] = useState<boolean>(false);

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

  // Fast pre-calculated stats for the selected year
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

  // Calculate total classes in this selected year
  const totalClassesInYear = useMemo(() => {
    let sum = 0;
    yearStatsMap.forEach((val) => {
      sum += val.totalCount;
    });
    return sum;
  }, [yearStatsMap]);

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

  // Navigation handlers
  const handlePrevYear = () => {
    setSelectedYear((prev) => prev - 1);
  };

  const handleNextYear = () => {
    setSelectedYear((prev) => prev + 1);
  };

  const handleJumpToToday = () => {
    setSelectedYear(currentYear);
    setSelectedMonthIdx(currentMonthIdx);
    setSelectedDateStr(todayStr);
  };

  const handleSelectDay = (cell: CalendarDayCell, openDrawer: boolean = true) => {
    setSelectedDateStr(cell.dateStr);
    setSelectedYear(cell.year);
    setSelectedMonthIdx(cell.monthIndex);
    if (openDrawer) {
      setIsAgendaDrawerOpen(true);
    }
  };

  const handleOpenMonthView = (monthIdx: number) => {
    setSelectedMonthIdx(monthIdx);
    setViewMode('month');
  };

  const handleDeleteSession = (session: Session) => {
    const sessionAtt = db.getAttendance().filter((a) => a.sessionId === session.id);
    const hasRecordedAttendance = sessionAtt.length > 0;
    const warningMsg = hasRecordedAttendance
      ? `تحذير هام: الحصة "${session.title}" مسجل لها كشف حضور لعدد (${sessionAtt.length}) طالب.\n\nحذف الحصة سيؤدي إلى مسح سجلات الحضور وإلغاء أي مستحقات مالية مترتبة عليها.\n\nهل أنت متأكد من الحذف النهائي؟`
      : `هل أنت متأكد من حذف حصة "${session.title}" نهائياً؟`;

    if (confirm(warningMsg)) {
      db.deleteSession(session.id);
      onSessionDeleted();
      if (onDataChanged) onDataChanged();
    }
  };

  // Convert recurring scheduled item into an instantiated session record and open attendance
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

  // Available year quick list for year picker dropdown
  const yearPickerRange = useMemo(() => {
    const years: number[] = [];
    const startYear = Math.min(currentYear - 4, selectedYear - 3);
    const endYear = Math.max(currentYear + 6, selectedYear + 4);
    for (let y = startYear; y <= endYear; y++) {
      years.push(y);
    }
    return years;
  }, [currentYear, selectedYear]);

  return (
    <div className="space-y-4 text-slate-900" dir="rtl">
      
      {/* 1. TOP HEADER & NAVIGATION TOOLBAR */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs space-y-3">
        
        {/* Row 1: Year Navigator + Mode Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          
          {/* Year Selector & Stepper */}
          <div className="flex items-center gap-2">
            
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl p-1 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevYear}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white transition-all active:scale-95"
                title="السنة السابقة"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsYearPickerOpen(!isYearPickerOpen)}
                  className="px-3 py-1 flex items-center gap-1.5 text-base font-bold text-slate-900 hover:bg-white rounded-xl transition-all"
                >
                  <span>{selectedYear}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                </button>

                {/* Year Dropdown Menu */}
                {isYearPickerOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsYearPickerOpen(false)}
                    />
                    <div className="absolute top-full right-0 mt-1.5 w-40 max-h-56 overflow-y-auto android-scrollbar bg-white border border-slate-200 rounded-2xl shadow-lg p-1.5 z-50 space-y-1">
                      <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100">
                        اختر السنة
                      </div>
                      {yearPickerRange.map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => {
                            setSelectedYear(yr);
                            setIsYearPickerOpen(false);
                          }}
                          className={`w-full text-right px-2.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center justify-between ${
                            yr === selectedYear
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <span>{yr}</span>
                          {yr === currentYear && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${yr === selectedYear ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
                              الحالية
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={handleNextYear}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white transition-all active:scale-95"
                title="السنة القادمة"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Quick "Today" Button */}
            <button
              type="button"
              onClick={handleJumpToToday}
              className={`px-3 py-1.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs active:scale-95 ${
                selectedDateStr === todayStr && selectedYear === currentYear
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>اليوم</span>
            </button>

            {/* Total Classes in Year pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 font-medium">
              <span className="text-slate-400">إجمالي حصص {selectedYear}:</span>
              <span className="font-bold text-slate-900">{totalClassesInYear} حصة</span>
            </div>

          </div>

          {/* View Modes & Action */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            
            {/* View Mode Toggle: Year / Month */}
            <div className="flex items-center bg-slate-100 border border-slate-200/80 rounded-2xl p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('year')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'year'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>عرض السنة</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'month'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-amber-600" />
                <span>عرض الشهر</span>
              </button>
            </div>

            {/* Add Session on Selected Date button */}
            <button
              type="button"
              onClick={() => onOpenAddSession(undefined, selectedDateStr)}
              className="px-3.5 py-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>حصة جديدة</span>
            </button>

          </div>

        </div>

        {/* Row 2: Group Filter + Quick Month Select Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
          
          {/* Group Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-[11px] text-slate-400 font-medium shrink-0">تصفية:</span>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none max-w-[180px] truncate"
            >
              <option value="all">جميع المجموعات والدروس</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.type === 'private' ? 'خاص' : 'مجموعة'})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Month Selector Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto android-scrollbar w-full md:w-auto pb-1 md:pb-0">
            {MONTH_NAMES_ARABIC.map((mName, mIdx) => {
              const isSelected = mIdx === selectedMonthIdx;
              const isCurrent = selectedYear === currentYear && mIdx === currentMonthIdx;
              return (
                <button
                  key={mIdx}
                  type="button"
                  onClick={() => {
                    setSelectedMonthIdx(mIdx);
                    const targetDay = isCurrent ? today.getDate() : 1;
                    setSelectedDateStr(formatDateKey(selectedYear, mIdx, targetDay));
                  }}
                  className={`px-2 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all shrink-0 ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : isCurrent
                      ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {mName}
                </button>
              );
            })}
          </div>

        </div>

      </div>

      {/* 2. MAIN CALENDAR BODY (YEAR VIEW or MONTH VIEW) */}
      {viewMode === 'year' ? (
        /* --- 12-MONTH YEARLY GRID --- */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {Array.from({ length: 12 }).map((_, monthIdx) => {
            const monthGrid = monthsGrids[monthIdx] || [];
            const monthName = MONTH_NAMES_ARABIC[monthIdx];
            const monthNameEn = MONTH_NAMES_ENGLISH[monthIdx];
            const isCurrentMonth = selectedYear === currentYear && monthIdx === currentMonthIdx;

            // Count classes in this month
            let monthClassCount = 0;
            monthGrid.forEach((cell) => {
              if (cell.isCurrentMonth) monthClassCount += cell.classCount;
            });

            return (
              <div
                key={monthIdx}
                className={`bg-white border rounded-2xl p-3 shadow-xs transition-all flex flex-col justify-between ${
                  isCurrentMonth
                    ? 'border-blue-400 ring-2 ring-blue-500/15'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Month Card Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleOpenMonthView(monthIdx)}
                    className="flex items-baseline gap-1.5 text-right group"
                  >
                    <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                      {monthName}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {monthNameEn}
                    </span>
                  </button>

                  <div className="flex items-center gap-1">
                    {monthClassCount > 0 ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 font-bold text-[10px]">
                        {monthClassCount} حصة
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 opacity-60">
                        لا حصص
                      </span>
                    )}
                  </div>
                </div>

                {/* Weekday Initials Row */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                  {CALENDAR_WEEKDAY_INITIALS_ARABIC.map((wName, wIdx) => (
                    <div
                      key={wIdx}
                      className="text-[10px] font-bold text-slate-400 py-0.5"
                    >
                      {wName}
                    </div>
                  ))}
                </div>

                {/* Month Day Cells Grid (Saturday-first) */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {monthGrid.map((cell, cIdx) => {
                    const isSelected = cell.dateStr === selectedDateStr;
                    const hasClasses = cell.classCount > 0;
                    
                    return (
                      <button
                        key={cIdx}
                        type="button"
                        onClick={() => handleSelectDay(cell, true)}
                        className={`min-h-[30px] rounded-lg p-0.5 text-center flex flex-col items-center justify-center transition-all relative group ${
                          !cell.isCurrentMonth
                            ? 'opacity-20 pointer-events-none'
                            : isSelected
                            ? 'bg-slate-900 text-white font-bold shadow-xs scale-105 z-10'
                            : cell.isToday
                            ? 'bg-blue-50 border border-blue-500 text-blue-900 font-bold'
                            : hasClasses
                            ? 'bg-slate-50 text-slate-900 font-semibold hover:bg-slate-100 border border-slate-200/60'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                        title={`${cell.dateStr} - ${cell.classCount} حصة`}
                      >
                        <span className="text-[11px] leading-none">
                          {cell.dayNumber}
                        </span>

                        {/* Class Indicator Badge / Dots */}
                        {cell.isCurrentMonth && hasClasses && (
                          <div className="flex items-center justify-center gap-0.5 mt-0.5">
                            {cell.classCount <= 3 ? (
                              Array.from({ length: cell.classCount }).map((_, dotIdx) => (
                                <span
                                  key={dotIdx}
                                  className={`w-1 h-1 rounded-full ${
                                    isSelected
                                      ? 'bg-white'
                                      : cell.completedCount > 0
                                      ? 'bg-emerald-500'
                                      : 'bg-amber-500'
                                  }`}
                                />
                              ))
                            ) : (
                              <span
                                className={`text-[8px] font-bold leading-none px-1 rounded-full ${
                                  isSelected
                                    ? 'bg-white/20 text-white'
                                    : 'bg-blue-600 text-white'
                                }`}
                              >
                                {cell.classCount}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Footer hint */}
                <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <button
                    type="button"
                    onClick={() => handleOpenMonthView(monthIdx)}
                    className="hover:text-blue-600 font-bold transition-colors"
                  >
                    عرض تفصيلي للشهر ←
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        /* --- FOCUSED SINGLE MONTH VIEW --- */
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-4">
          
          {/* Month Navigation Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedMonthIdx === 0) {
                    setSelectedYear((y) => y - 1);
                    setSelectedMonthIdx(11);
                  } else {
                    setSelectedMonthIdx((m) => m - 1);
                  }
                }}
                className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <h2 className="text-lg font-bold text-slate-900">
                {MONTH_NAMES_ARABIC[selectedMonthIdx]} {selectedYear}
              </h2>
              <span className="text-xs text-slate-400">
                ({MONTH_NAMES_ENGLISH[selectedMonthIdx]})
              </span>

              <button
                type="button"
                onClick={() => {
                  if (selectedMonthIdx === 11) {
                    setSelectedYear((y) => y + 1);
                    setSelectedMonthIdx(0);
                  } else {
                    setSelectedMonthIdx((m) => m + 1);
                  }
                }}
                className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setViewMode('year')}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 hover:text-slate-900 transition-all flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>العودة لعرض السنة (12 شهر)</span>
            </button>
          </div>

          {/* Full Weekdays Headers */}
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {CALENDAR_WEEKDAY_HEADERS_ARABIC.map((wHeader, wIdx) => (
              <div
                key={wIdx}
                className="text-xs font-bold text-slate-600 bg-slate-50 py-2 rounded-xl border border-slate-200/60"
              >
                {wHeader}
              </div>
            ))}
          </div>

          {/* Large Month Day Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {(monthsGrids[selectedMonthIdx] || []).map((cell, idx) => {
              const isSelected = cell.dateStr === selectedDateStr;
              const hasClasses = cell.classCount > 0;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectDay(cell, true)}
                  className={`min-h-[70px] sm:min-h-[85px] p-2 rounded-2xl border text-right flex flex-col justify-between transition-all relative ${
                    !cell.isCurrentMonth
                      ? 'border-dashed border-slate-200/60 bg-slate-50/50 opacity-30 pointer-events-none'
                      : isSelected
                      ? 'border-slate-900 bg-slate-900/5 ring-2 ring-slate-900'
                      : cell.isToday
                      ? 'border-blue-500 bg-blue-50/60'
                      : 'border-slate-200/80 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-bold rounded-lg w-6 h-6 flex items-center justify-center ${
                        cell.isToday
                          ? 'bg-blue-600 text-white'
                          : isSelected
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-900'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {cell.isToday && (
                      <span className="text-[9px] font-bold text-blue-600">اليوم</span>
                    )}
                  </div>

                  {/* Class Badge in Cell */}
                  {cell.isCurrentMonth && hasClasses && (
                    <div className="mt-1 space-y-1 w-full">
                      <div className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-between">
                        <span>{cell.classCount} حصة</span>
                        {cell.completedCount > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        )}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

        </div>
      )}

      {/* 3. DETAILED DAILY AGENDA (INTERACTIVE INSPECTOR) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3.5">
        
        {/* Agenda Title + Date Navigator */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900">
                أجندة يوم {selectedDateAgenda.formattedDisplayDate}
              </h2>
              {selectedDateAgenda.isToday && (
                <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-bold text-[10px]">
                  اليوم الحالي
                </span>
              )}
              {selectedDateAgenda.isPast && (
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium text-[10px]">
                  تاريخ سابق
                </span>
              )}
              {selectedDateAgenda.isFuture && (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px]">
                  حصة مستقبلية
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              جدول الحصص المجدولة والمنفذة مع تفاصيل الحضور والفوترة
            </p>
          </div>

          {/* Quick Date Stepper (Previous Day / Next Day) & Add Session on Date */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  const curr = new Date(selectedDateStr);
                  curr.setDate(curr.getDate() - 1);
                  setSelectedDateStr(curr.toISOString().split('T')[0]);
                  setSelectedYear(curr.getFullYear());
                  setSelectedMonthIdx(curr.getMonth());
                }}
                className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 transition-all"
                title="اليوم السابق"
              >
                اليوم السابق
              </button>

              <button
                type="button"
                onClick={() => {
                  const curr = new Date(selectedDateStr);
                  curr.setDate(curr.getDate() + 1);
                  setSelectedDateStr(curr.toISOString().split('T')[0]);
                  setSelectedYear(curr.getFullYear());
                  setSelectedMonthIdx(curr.getMonth());
                }}
                className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 transition-all"
                title="اليوم التالي"
              >
                اليوم التالي
              </button>
            </div>

            <button
              type="button"
              onClick={() => onOpenAddSession(undefined, selectedDateStr)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة حصة لهذا اليوم</span>
            </button>
          </div>
        </div>

        {/* Daily Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="block text-[10px] text-slate-500 font-medium">إجمالي الحصص</span>
            <span className="text-base font-bold text-slate-900">
              {selectedDateAgenda.summary.totalClasses}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
            <span className="block text-[10px] text-emerald-700 font-medium">حاضر</span>
            <span className="text-base font-bold text-emerald-700">
              {selectedDateAgenda.summary.presentStudents} طالب
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-center">
            <span className="block text-[10px] text-rose-700 font-medium">غائب</span>
            <span className="text-base font-bold text-rose-700">
              {selectedDateAgenda.summary.absentStudents} طالب
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
            <span className="block text-[10px] text-amber-800 font-medium">مجدولة</span>
            <span className="text-base font-bold text-amber-700">
              {selectedDateAgenda.summary.scheduledClasses} حصة
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center col-span-2 sm:col-span-1">
            <span className="block text-[10px] text-slate-500 font-medium">ملغاة</span>
            <span className="text-base font-bold text-slate-600">
              {selectedDateAgenda.summary.cancelledClasses} حصة
            </span>
          </div>

        </div>

        {/* Chronological Agenda Items */}
        {selectedDateAgenda.items.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
            <Calendar className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
            <p className="text-xs font-bold text-slate-800">
              لا توجد حصص مجدولة أو مسجلة في هذا اليوم
            </p>
            <p className="text-[11px] text-slate-500">
              يمكنك جدولة حصة خاصة أو جماعية جديدة لهذا اليوم مباشرة
            </p>
            <button
              type="button"
              onClick={() => onOpenAddSession(undefined, selectedDateStr)}
              className="mt-2 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>جدولة حصة في {selectedDateStr}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {selectedDateAgenda.items.map((item) => {
              const isRecorded = item.source === 'session_record';
              
              return (
                <div
                  key={item.id}
                  className={`p-3.5 bg-white border rounded-2xl shadow-xs transition-all space-y-2.5 ${
                    item.status === 'cancelled'
                      ? 'border-rose-200 bg-rose-50/40'
                      : item.status === 'completed'
                      ? 'border-emerald-200 hover:border-emerald-300'
                      : 'border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  {/* Top Row: Time, Type, Title & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        
                        {/* Time Badge */}
                        <span className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span>{item.formattedTime || item.startTime || 'وقت مرن'}</span>
                        </span>

                        {/* Subject & Group/Student Name */}
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.accentColor }}
                          />
                          <h4 className="font-bold text-xs text-slate-900 truncate">
                            {item.isPrivate
                              ? (item.studentName ? `خاص — ${item.studentName}` : 'درس خاص')
                              : item.groupName}
                          </h4>
                        </div>

                        {/* Type Badge (Group vs Private) */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            item.isPrivate
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-100'
                          }`}
                        >
                          {item.isPrivate ? 'درس خاص' : 'مجموعة'}
                        </span>

                        {item.subject && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                            {item.subject}
                          </span>
                        )}
                      </div>

                      {/* Location & Stage */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                        {item.stageOrGrade && (
                          <span>المرحلة: {item.stageOrGrade}</span>
                        )}
                        {item.location && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{item.location}</span>
                          </span>
                        )}
                        {item.pricePerStudent !== undefined && (
                          <span className="flex items-center gap-0.5 text-slate-700 font-semibold">
                            <DollarSign className="w-3 h-3 text-emerald-600" />
                            <span>
                              {item.billingMode === 'hourly'
                                ? `${item.hourlyRate || item.pricePerStudent} ج/ساعة`
                                : `${item.pricePerStudent} ج/حصة`}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                        item.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : item.status === 'cancelled'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {item.status === 'completed'
                        ? 'مكتملة'
                        : item.status === 'cancelled'
                        ? 'ملغاة'
                        : 'مجدولة'}
                    </span>
                  </div>

                  {/* Attendance Breakdown for Completed Session */}
                  {item.hasRecordedAttendance && item.attendanceRecords && item.attendanceRecords.length > 0 && (
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-600 font-medium">
                        <span>سجل الحضور ({item.totalStudentsCount} طلاب):</span>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-700 font-bold">حاضر: {item.presentCount}</span>
                          {item.absentChargedCount > 0 && (
                            <span className="text-rose-700">غائب محسوب: {item.absentChargedCount}</span>
                          )}
                          {item.absentFreeCount > 0 && (
                            <span className="text-slate-500">معذور: {item.absentFreeCount}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {item.attendanceRecords.map((att, attIdx) => (
                          <span
                            key={attIdx}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                              att.status === 'present' || att.status === 'late'
                                ? 'bg-emerald-100/70 text-emerald-800'
                                : att.isCharged || att.status === 'absent_charged'
                                ? 'bg-rose-100/70 text-rose-800'
                                : 'bg-slate-200/70 text-slate-700'
                            }`}
                          >
                            {att.studentName}: {att.status === 'present' ? 'حاضر' : att.status === 'late' ? 'متأخر' : att.isCharged ? 'غائب محسوب' : 'غائب معذور'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="text-[11px] text-slate-500">
                      {isRecorded ? (
                        <span>حصة مسجلة بالسجل</span>
                      ) : (
                        <span className="text-amber-700 font-medium">حصة أسبوعية مجدولة</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isRecorded && item.session ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onOpenAttendanceModal(item.session!)}
                            className="min-h-[34px] px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition-all active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{item.hasRecordedAttendance ? 'تعديل الحضور' : 'رصد الحضور'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onEditSession(item.session!)}
                            className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                            title="تعديل الحصة"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteSession(item.session!)}
                            className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100"
                            title="حذف الحصة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartRecurringClass(item)}
                          className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>بدء الحصة ورصد الحضور</span>
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
  );
};
