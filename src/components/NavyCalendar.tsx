import React, { useState, useMemo, useEffect } from 'react';
import { NavyCard } from './ui/NavyCard';
import { AppIcon } from './ui/AppIcon';
import { useTranslation } from '../utils/i18n';
import { useCurrentLocalDate } from '../utils/useCurrentLocalDate';
import { useModalLayer } from '../contexts/ModalContext';
import { Session, Group, Student } from '../types';
import { db } from '../utils/storage';
import {
  MONTH_NAMES_ARABIC,
  MONTH_NAMES_ENGLISH,
  CALENDAR_WEEKDAY_HEADERS_ARABIC,
  CalendarDayCell,
  generateMonthGrid,
  getYearClassStatsMap,
} from '../utils/schedule';
import { parseLocalDateStr } from '../utils/localDate';
import { BottomSheet } from './ui/BottomSheet';

export interface NavyCalendarProps {
  selectedDateStr: string;
  onSelectDate: (dateStr: string) => void;
  sessions: Session[];
  groups: Group[];
  students?: Student[];
  onOpenAddSession: (defaultGroupId?: string, defaultDate?: string) => void;
  viewMode?: 'week' | 'month';
  onViewModeChange?: (mode: 'week' | 'month') => void;
  className?: string;
}

export const NavyCalendar: React.FC<NavyCalendarProps> = ({
  selectedDateStr,
  onSelectDate,
  sessions,
  groups,
  students = [],
  onOpenAddSession,
  viewMode: controlledViewMode,
  onViewModeChange,
  className = '',
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');
  const { now: today, todayStr } = useCurrentLocalDate();

  const currentYear = today.getFullYear();

  const selectedDateObj = useMemo(() => parseLocalDateStr(selectedDateStr), [selectedDateStr]);
  const [selectedYear, setSelectedYear] = useState<number>(() => selectedDateObj.getFullYear());
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(() => selectedDateObj.getMonth());
  const [internalViewMode, setInternalViewMode] = useState<'week' | 'month'>('week');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);

  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;

  useModalLayer('year-month-picker', isPickerOpen, () => setIsPickerOpen(false));

  // Sync year and month with selectedDateStr whenever selectedDateStr updates externally
  useEffect(() => {
    const d = parseLocalDateStr(selectedDateStr);
    setSelectedYear(d.getFullYear());
    setSelectedMonthIdx(d.getMonth());
  }, [selectedDateStr]);

  const monthNames = isEn ? MONTH_NAMES_ENGLISH : MONTH_NAMES_ARABIC;
  const weekdayHeaders = isEn
    ? ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    : CALENDAR_WEEKDAY_HEADERS_ARABIC;

  // Enrollments and stats map
  const enrollments = useMemo(() => db.getEnrollments(), [sessions, groups]);

  const yearStatsMap = useMemo(() => {
    return getYearClassStatsMap(
      selectedYear,
      sessions,
      groups,
      enrollments,
      students
    );
  }, [selectedYear, sessions, groups, enrollments, students]);

  // Current month's grid
  const monthGrid = useMemo(() => {
    return generateMonthGrid(selectedYear, selectedMonthIdx, yearStatsMap);
  }, [selectedYear, selectedMonthIdx, yearStatsMap]);

  // Break monthGrid into 7-day rows (weeks)
  const weeks = useMemo(() => {
    const rows: CalendarDayCell[][] = [];
    for (let i = 0; i < monthGrid.length; i += 7) {
      rows.push(monthGrid.slice(i, i + 7));
    }
    return rows;
  }, [monthGrid]);

  // Month navigation (direction-aware and RTL-aware)
  const handlePrevMonth = () => {
    setSlideDirection(isRTL ? 'left' : 'right');
    const newMonth = selectedMonthIdx === 0 ? 11 : selectedMonthIdx - 1;
    const newYear = selectedMonthIdx === 0 ? selectedYear - 1 : selectedYear;
    setSelectedYear(newYear);
    setSelectedMonthIdx(newMonth);

    if (viewMode === 'week') {
      const currentDay = selectedDateObj.getDate();
      const daysInNewMonth = new Date(newYear, newMonth + 1, 0).getDate();
      const clampedDay = Math.min(currentDay, daysInNewMonth);
      const newDateStr = `${newYear}-${String(newMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
      onSelectDate(newDateStr);
    }
  };

  const handleNextMonth = () => {
    setSlideDirection(isRTL ? 'right' : 'left');
    const newMonth = selectedMonthIdx === 11 ? 0 : selectedMonthIdx + 1;
    const newYear = selectedMonthIdx === 11 ? selectedYear + 1 : selectedYear;
    setSelectedYear(newYear);
    setSelectedMonthIdx(newMonth);

    if (viewMode === 'week') {
      const currentDay = selectedDateObj.getDate();
      const daysInNewMonth = new Date(newYear, newMonth + 1, 0).getDate();
      const clampedDay = Math.min(currentDay, daysInNewMonth);
      const newDateStr = `${newYear}-${String(newMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
      onSelectDate(newDateStr);
    }
  };

  const handleSelectCell = (cell: CalendarDayCell) => {
    if (!cell.isCurrentMonth) return;
    onSelectDate(cell.dateStr);
  };

  // Quick picker selections
  const pickerYears = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear - 3; y <= currentYear + 3; y++) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  return (
    <NavyCard className={`select-none ${className}`.trim()} showDecor={true}>
      <div className="space-y-3.5">
        {/* 1. Header row: Chevrons (36px hit area, mirrored in RTL) + Centered Month/Year (18px/600 white) + View Switch */}
        <div className="relative flex items-center justify-between min-h-[36px]">
          {/* Previous month chevron */}
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label={isEn ? 'Previous month' : 'الشهر السابق'}
            className="w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer shrink-0 z-10"
          >
            <AppIcon name="chevronStart" weight="bold" size={18} mirrorRtl />
          </button>

          {/* Centered Month/Year button */}
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="text-[18px] font-semibold text-white cursor-pointer active:scale-95 transition-transform flex items-center justify-center gap-1.5 px-2 py-1 rounded-xl hover:bg-white/10 z-0"
            title={isEn ? 'Select month and year' : 'اختيار الشهر والسنة'}
          >
            <span>{monthNames[selectedMonthIdx]} {selectedYear}</span>
            <AppIcon name="chevronDown" weight="bold" size={14} className="text-white/70" />
          </button>

          {/* Next month chevron + view mode toggle */}
          <div className="flex items-center gap-1 shrink-0 z-10">
            {/* Week / Month view toggle */}
            <div className="flex items-center bg-white/15 rounded-full p-0.5 text-xs me-0.5">
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className={`px-2 py-0.5 rounded-full transition-all text-[11px] font-bold cursor-pointer ${
                  viewMode === 'week'
                    ? 'bg-mint text-navy shadow-xs'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                {isEn ? 'Week' : 'أسبوع'}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`px-2 py-0.5 rounded-full transition-all text-[11px] font-bold cursor-pointer ${
                  viewMode === 'month'
                    ? 'bg-mint text-navy shadow-xs'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                {isEn ? 'Month' : 'شهر'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              aria-label={isEn ? 'Next month' : 'الشهر القادم'}
              className="w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <AppIcon name="chevronEnd" weight="bold" size={18} mirrorRtl />
            </button>
          </div>
        </div>

        {/* 2. Weekday row: 13px white/70 */}
        <div className="grid grid-cols-7 text-center text-[13px] text-white/70 font-medium py-0.5">
          {weekdayHeaders.map((wHeader, idx) => (
            <div key={idx} className="h-6 flex items-center justify-center">
              {wHeader}
            </div>
          ))}
        </div>

        {/* 3. Day grid: 36px cells, 14px white, sliding animation (250ms) */}
        <div
          key={`${selectedYear}-${selectedMonthIdx}`}
          className={`space-y-1.5 ${
            slideDirection === 'left'
              ? 'animate-slide-month-left'
              : slideDirection === 'right'
              ? 'animate-slide-month-right'
              : ''
          }`}
          onAnimationEnd={() => setSlideDirection(null)}
        >
          {weeks.map((week, wIdx) => {
            const hasSelectedDay = week.some((c) => c.dateStr === selectedDateStr && c.isCurrentMonth);
            const isWeekHighlighted = viewMode === 'week' && hasSelectedDay;

            // In week view, only show the week containing the selected day
            if (viewMode === 'week' && !hasSelectedDay) {
              return null;
            }

            return (
              <div
                key={wIdx}
                className={`grid grid-cols-7 text-center relative py-0.5 transition-colors ${
                  isWeekHighlighted ? 'bg-mint text-navy rounded-full shadow-xs' : ''
                }`}
              >
                {week.map((cell, cIdx) => {
                  if (!cell.isCurrentMonth) {
                    // Days outside the month hidden
                    return <div key={cIdx} className="w-9 h-9 mx-auto" />;
                  }

                  const isSelected = cell.dateStr === selectedDateStr;
                  const isTodayCell = cell.dateStr === todayStr;
                  const hasSessions = cell.classCount > 0;

                  return (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={() => handleSelectCell(cell)}
                      className="w-9 h-9 mx-auto flex items-center justify-center relative cursor-pointer active:scale-95 transition-transform"
                    >
                      {isSelected ? (
                        // Selected day: 36px ORANGE circle with navy bold number (pop-in spring animation)
                        <span className="w-9 h-9 rounded-full bg-orange text-navy font-bold text-[14px] flex flex-col items-center justify-center animate-day-pop shadow-xs relative z-10">
                          <span className="leading-none">{cell.dayNumber}</span>
                          {hasSessions && (
                            <span className="w-1 h-1 rounded-full bg-navy mt-0.5" />
                          )}
                        </span>
                      ) : isTodayCell ? (
                        // Today (if not selected): 1.5px white ring
                        <span
                          className={`w-9 h-9 rounded-full border-[1.5px] ${
                            isWeekHighlighted ? 'border-navy text-navy' : 'border-white text-white'
                          } font-semibold text-[14px] flex flex-col items-center justify-center relative`}
                        >
                          <span className="leading-none">{cell.dayNumber}</span>
                          {hasSessions && (
                            <span className="w-1 h-1 rounded-full bg-orange mt-0.5" />
                          )}
                        </span>
                      ) : (
                        // Regular day
                        <span
                          className={`w-9 h-9 rounded-full flex flex-col items-center justify-center ${
                            isWeekHighlighted
                              ? 'text-navy font-medium hover:bg-navy/10'
                              : 'text-white font-medium hover:bg-white/10'
                          } text-[14px]`}
                        >
                          <span className="leading-none">{cell.dayNumber}</span>
                          {hasSessions && (
                            <span className="w-1 h-1 rounded-full bg-orange mt-0.5" />
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* 4. Full-width Add Session Button under grid, inside the card: btn-orange btn-lg */}
        <button
          type="button"
          onClick={() => onOpenAddSession(undefined, selectedDateStr)}
          className="btn-orange btn-lg w-full flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98] transition-transform mt-3"
        >
          <AppIcon name="plus" size={18} weight="bold" />
          <span>{t('scheduleSessionBtn') || (isEn ? 'Add session' : 'إضافة حصة')}</span>
        </button>
      </div>

      {/* 5. Year/Month Picker Bottom Sheet */}
      <BottomSheet
        id="calendar-month-year-picker"
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        title={isEn ? 'Select Month & Year' : 'اختيار الشهر والسنة'}
        maxWidthClass="sm:max-w-md"
        bodyClassName="p-5 space-y-4 text-start"
      >
        {/* Year selector strip */}
        <div>
          <span className="text-xs font-semibold text-slate block mb-1.5">
            {isEn ? 'Year' : 'السنة'}
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
            {pickerYears.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedYear === yr
                    ? 'bg-navy text-white shadow-xs'
                    : 'bg-page border border-line text-navy hover:bg-mint-soft'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>

        {/* Month grid */}
        <div>
          <span className="text-xs font-semibold text-slate block mb-1.5">
            {isEn ? 'Month' : 'الشهر'}
          </span>
          <div className="grid grid-cols-3 gap-2">
            {monthNames.map((name, idx) => {
              const isSelectedMonth = selectedMonthIdx === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedMonthIdx(idx);
                    setIsPickerOpen(false);
                  }}
                  className={`p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelectedMonth
                      ? 'bg-orange text-navy font-extrabold shadow-xs'
                      : 'bg-page border border-line text-navy hover:bg-mint-soft'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      </BottomSheet>
    </NavyCard>
  );
};

export default NavyCalendar;
