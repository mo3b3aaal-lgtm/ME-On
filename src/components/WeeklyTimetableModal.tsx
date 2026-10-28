import React, { useMemo } from 'react';
import { Enrollment, Group, Student } from '../types';
import {
  buildFixedWeeklyTimetable,
  TimetableCell,
  TimetableLessonEntry,
} from '../utils/weeklyTimetable';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import { useCurrentLocalDate } from '../utils/useCurrentLocalDate';
import { useTranslation } from '../utils/i18n';
import { triggerLightHaptic } from '../utils/haptics';
import { AppIcon } from './ui/AppIcon';
import { StudentAvatar } from './StudentAvatar';

export interface WeeklyTimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  groups: Group[];
  enrollments: Enrollment[];
  onOpenStudentProfile?: (student: Student) => void;
  onOpenGroupProfile?: (group: Group) => void;
  onOpenAddStudent?: () => void;
  onOpenAddGroup?: () => void;
}

function getModalZIndexClass(stackIndex: number): string {
  if (stackIndex <= 0) return 'z-[1000]';
  if (stackIndex === 1) return 'z-[1050]';
  if (stackIndex === 2) return 'z-[1100]';
  return 'z-[1150]';
}

/**
 * Permanent, non-moving Fixed Weekly Wall Timetable.
 *
 * Design & behavior guarantees:
 * - Static 8-column table (`table-fixed w-full`): 1 Time column + 7 fixed weekday columns
 *   in Classy's canonical RTL/LTR order (`السبت` .. `الجمعة`).
 * - Zero dates, zero week navigation, zero horizontal swiping/panning, zero carousel behavior,
 *   and zero schedule-switching animations.
 * - Distinct Orange & Green printed-timetable color scheme:
 *   - Orange (`#F59E3D` / `#E58A2B` / `#FFF3E3`) for fixed day headers, time column, and frame accents.
 *   - Green (`#D8F5E0` / `#B9E9C9` with `#22A05B` / `#15803D` borders) for scheduled lesson cards.
 *   - Crisp white (`#FFFFFF`) background cells with consistent row/column grid borders (`#CBD5E1`).
 *   - Dark, high-contrast ink (`#072B18` / `#0F2A4A`) for student names, group names, and lesson times.
 */
export const WeeklyTimetableModal: React.FC<WeeklyTimetableModalProps> = ({
  isOpen,
  onClose,
  students,
  groups,
  enrollments,
  onOpenStudentProfile,
  onOpenGroupProfile,
}) => {
  const { language, isRTL } = useTranslation();
  const isEn = language.startsWith('en');
  const { todayStr } = useCurrentLocalDate();
  const modalLayer = useModalLayer('weekly-timetable', isOpen, onClose);

  const timetable = useMemo(
    () =>
      buildFixedWeeklyTimetable({
        students,
        groups,
        enrollments,
        operationalDateStr: todayStr,
        isRTLOrLang: isRTL,
        includeBaselineHours: true,
      }),
    [students, groups, enrollments, todayStr, isRTL]
  );

  if (!isOpen) {
    return null;
  }

  const zIndexClass = getModalZIndexClass(modalLayer.stackIndex);

  const handleEntryClick = (entry: TimetableLessonEntry) => {
    triggerLightHaptic();
    if (entry.kind === 'group' && entry.group && onOpenGroupProfile) {
      onOpenGroupProfile(entry.group);
      return;
    }
    if (entry.kind === 'private' && entry.student && onOpenStudentProfile) {
      onOpenStudentProfile(entry.student);
    }
  };

  const renderLessonCard = (entry: TimetableLessonEntry) => {
    const isGroup = entry.kind === 'group';
    const isClickable = Boolean(
      (isGroup && entry.group && onOpenGroupProfile) ||
        (!isGroup && entry.student && onOpenStudentProfile)
    );

    const cardGreenClasses = isGroup
      ? 'bg-[#B9E9C9] hover:bg-[#A6E2BA] border-[#15803D]'
      : 'bg-[#D8F5E0] hover:bg-[#C6EED2] border-[#22A05B]';

    return (
      <button
        key={entry.id}
        type="button"
        data-testid={`timetable-entry-${entry.kind}`}
        onClick={() => handleEntryClick(entry)}
        disabled={!isClickable}
        className={`w-full text-start rounded-md sm:rounded-xl border px-[3px] py-1 sm:p-2 shadow-2xs ${cardGreenClasses} ${
          isClickable ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        {/* Group vs Private label */}
        <div className="flex items-center justify-between gap-1 leading-none mb-0.5">
          <span className="text-[8.5px] sm:text-[10.5px] font-extrabold text-[#0B4F26] truncate">
            {isGroup ? (
              isEn ? (
                'Group'
              ) : (
                'مجموعة'
              )
            ) : isEn ? (
              'Private'
            ) : (
              <>
                <span className="sm:hidden">خاص</span>
                <span className="hidden sm:inline">درس خاص</span>
              </>
            )}
          </span>
          {isGroup && entry.activeStudentCount > 0 && (
            <span className="hidden sm:inline text-[10px] font-bold text-[#0F532B] tabular-nums shrink-0">
              {entry.activeStudentCount} {isEn ? 'st.' : 'طالب'}
            </span>
          )}
        </div>

        {/* Student or Group Name (with StudentAvatar on spacious viewports) */}
        <div className="flex items-center gap-1.5 min-w-0">
          {!isGroup && entry.student ? (
            <span className="hidden sm:inline-flex shrink-0">
              <StudentAvatar student={entry.student} size="xs" showFrame={false} />
            </span>
          ) : null}
          <span className="block text-[9.5px] sm:text-[12.5px] font-extrabold text-[#072B18] leading-[1.22] break-words min-w-0">
            {entry.title}
          </span>
        </div>

        {/* Custom group student override name if applicable */}
        {isGroup && entry.isCustomEnrollmentSchedule && entry.activeStudents.length > 0 && (
          <div className="mt-0.5 text-[8.5px] sm:text-[10.5px] font-bold text-[#0F532B] leading-tight break-words">
            {entry.activeStudents.map((s) => s.name).join(isRTL ? '، ' : ', ')}
          </div>
        )}

        {/* Lesson Time */}
        <div className="mt-0.5 text-[9px] sm:text-[11px] font-bold text-[#0B4F26] tabular-nums leading-tight break-words">
          {entry.displayTime}
        </div>

        {/* Subject on desktop/tablet when present */}
        {entry.subject ? (
          <div className="hidden sm:block mt-0.5 text-[10.5px] font-semibold text-[#14532D] truncate">
            {entry.subject}
          </div>
        ) : null}
      </button>
    );
  };

  const renderGridCell = (cell: TimetableCell) => {
    const cellKey = `${cell.timeSlotKey}__${cell.dayKey}`;
    const hasEntries = cell.entries.length > 0;

    return (
      <td
        key={cellKey}
        data-testid={`timetable-cell-${cell.dayKey}-${cell.timeSlotKey}`}
        className="border-b border-e last:border-e-0 border-[#CBD5E1] bg-[#FFFFFF] p-[2px] sm:p-1.5 align-top h-[48px] sm:h-[60px] overflow-hidden"
      >
        {hasEntries ? (
          <div className="space-y-1 sm:space-y-1.5">
            {cell.entries.map((entry) => renderLessonCard(entry))}
          </div>
        ) : null}
      </td>
    );
  };

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEn ? 'Fixed Weekly Timetable' : 'الجدول الأسبوعي الثابت'}
        dir={isRTL ? 'rtl' : 'ltr'}
        className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-0 sm:p-4 select-none`}
      >
        {/* Solid static backdrop */}
        <div
          className="fixed inset-0 bg-[#0F2A4A]/65"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Static Wall Timetable Panel */}
        <div
          data-testid="weekly-timetable-panel"
          className="relative z-10 w-full h-[100dvh] sm:h-[90vh] sm:max-h-[860px] sm:max-w-5xl lg:max-w-6xl bg-[#FFFFFF] sm:rounded-2xl border-0 sm:border-2 sm:border-[#E58A2B] shadow-2xl flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,0px)]"
        >
          {/* Top Structural Title Bar (Orange & Green Legend, Zero Date/Week Controls) */}
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 pt-[calc(10px+env(safe-area-inset-top,0px))] sm:pt-3 bg-[#FFF6EB] border-b-2 border-[#E58A2B] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#EA7B1F] text-[#FFFFFF] flex items-center justify-center shrink-0 shadow-2xs">
                <AppIcon name="calendarDays" weight="fill" size={20} />
              </div>
              <div className="min-w-0 text-start">
                <h2 className="text-[15px] sm:text-lg font-extrabold text-[#0F2A4A] truncate leading-tight">
                  {isEn ? 'Fixed Weekly Timetable' : 'الجدول الأسبوعي الثابت'}
                </h2>
                <div className="flex items-center gap-2 sm:gap-3 mt-0.5 text-[11px] sm:text-xs font-bold text-[#334155]">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span
                      aria-hidden="true"
                      className="w-2.5 h-2.5 rounded-xs bg-[#F59E3D] border border-[#C66A12] inline-block"
                    />
                    <span>{isEn ? 'Days & Times' : 'الأيام والأوقات'}</span>
                  </span>
                  <span aria-hidden="true" className="text-[#94A3B8]">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
                    <span
                      aria-hidden="true"
                      className="w-2.5 h-2.5 rounded-xs bg-[#B9E9C9] border border-[#15803D] inline-block"
                    />
                    <span>
                      {isEn
                        ? `Scheduled Lessons (${timetable.totalLessonsCount})`
                        : `الحصص المجدولة (${timetable.totalLessonsCount})`}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              data-testid="weekly-timetable-close-btn"
              onClick={onClose}
              aria-label={isEn ? 'Close timetable' : 'إغلاق الجدول الأسبوعي'}
              title={isEn ? 'Close timetable' : 'إغلاق الجدول الأسبوعي'}
              className="w-10 h-10 rounded-xl bg-[#FFFFFF] hover:bg-[#FFEAD0] border border-[#E58A2B]/60 text-[#0F2A4A] flex items-center justify-center cursor-pointer shrink-0"
            >
              <AppIcon name="close" size={20} />
            </button>
          </div>

          {/* Static Fixed 7-Day × Chronological-Time Wall Grid (Vertical Scroll Only) */}
          <div
            data-testid="weekly-timetable-scroll-container"
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain bg-[#FFFFFF]"
          >
            <table
              data-testid="weekly-timetable-grid"
              className="w-full max-w-full table-fixed border-separate border-spacing-0 text-start"
            >
              <colgroup>
                <col className="w-[10.5%] sm:w-[11%]" />
                {timetable.days.map((day) => (
                  <col key={`col_${day.dayKey}`} className="w-[12.785%] sm:w-[12.714%]" />
                ))}
              </colgroup>

              <thead>
                <tr>
                  {/* Fixed Corner Header: Time Column (Deep Orange) */}
                  <th
                    scope="col"
                    className="sticky top-0 z-20 bg-[#E58A2B] text-[#0F2A4A] border-b-2 border-e border-[#C66A12] px-0.5 sm:px-2.5 py-2.5 sm:py-3 text-center overflow-hidden"
                  >
                    <span className="block text-[10px] sm:text-xs font-extrabold leading-tight truncate">
                      {isEn ? 'Time' : 'الوقت'}
                    </span>
                  </th>

                  {/* Fixed 7 Weekday Column Headers (Vibrant Orange, Fixed Positions, Zero Dates) */}
                  {timetable.days.map((day) => (
                    <th
                      key={day.dayKey}
                      scope="col"
                      data-testid={`timetable-day-header-${day.dayKey}`}
                      className="sticky top-0 z-20 bg-[#F59E3D] text-[#0F2A4A] border-b-2 border-e last:border-e-0 border-[#C66A12] px-0.5 sm:px-2 py-2.5 sm:py-3 text-center overflow-hidden"
                    >
                      <span className="sm:hidden block text-[10px] font-extrabold leading-tight truncate">
                        {day.shortDayName}
                      </span>
                      <span className="hidden sm:block text-[13px] font-extrabold leading-tight truncate">
                        {day.dayName}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {timetable.rows.map((row) => (
                  <tr key={row.timeSlotKey} data-testid={`timetable-row-${row.timeSlotKey}`}>
                    {/* Fixed Time Label Cell (Warm Orange Structural Column) */}
                    <th
                      scope="row"
                      className="bg-[#FFF3E3] text-[#7C3200] border-b border-e border-[#E5B887] px-0.5 sm:px-2.5 pt-2 sm:pt-3 pb-2 align-top text-center overflow-hidden"
                    >
                      <span className="block text-[9.5px] sm:text-xs font-extrabold tabular-nums leading-tight break-words">
                        {row.label}
                      </span>
                    </th>

                    {/* 7 Fixed Weekday Cells for this Time Slot */}
                    {timetable.days.map((day) => renderGridCell(row.cells[day.dayKey]))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default WeeklyTimetableModal;
