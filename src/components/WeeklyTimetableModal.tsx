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
 * - Static 8-column table (`table-fixed w-full`): 1 narrow quiet Time column + 7 fixed weekday columns
 *   in Classy's canonical RTL/LTR order (`السبت` .. `الجمعة`).
 * - Zero dates, zero week navigation, zero horizontal swiping/panning, zero carousel behavior,
 *   and zero schedule-switching animations.
 * - Soft, minimal, airy Harbor Mint palette:
 *   - Pale off-white canvas (`#FAFDFD`) with ultra-subtle 1px neutral-teal grid lines (`#ECF3F3`).
 *   - Compact, softly tinted day headers (`#F3F8F8`) and a narrow, muted secondary time column.
 *   - Low-saturation pastel lesson pills/cards (`#EAF4F3` soft sage-mint for groups,
 *     `#EEF3F9` soft mist-blue for private lessons) with minimal hairline borders and no shadows.
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

    const surfaceClasses = isGroup
      ? 'bg-[#EAF4F3] hover:bg-[#DFEFEF] dark:bg-[#142F3A]/85 dark:hover:bg-[#193A47] border-[#D3E7E5] dark:border-[#244E5C]/70'
      : 'bg-[#EEF3F9] hover:bg-[#E4ECF6] dark:bg-[#162942]/85 dark:hover:bg-[#1C3352] border-[#DAE4F0] dark:border-[#284466]/70';

    const kindTextClasses = isGroup
      ? 'text-[#35736D] dark:text-[#86CEC6]'
      : 'text-[#4A678C] dark:text-[#97B6DC]';

    const titleTextClasses = isGroup
      ? 'text-[#17375E] dark:text-[#ECF6F5]'
      : 'text-[#17375E] dark:text-[#EDF3FA]';

    const metaTextClasses = isGroup
      ? 'text-[#4F6D70] dark:text-[#9EC3C1]'
      : 'text-[#56697F] dark:text-[#A3B7CE]';

    return (
      <button
        key={entry.id}
        type="button"
        data-testid={`timetable-entry-${entry.kind}`}
        title={`${entry.title} — ${entry.displayTime}`}
        onClick={() => handleEntryClick(entry)}
        disabled={!isClickable}
        className={`w-full text-start rounded-[7px] sm:rounded-[10px] border px-1 py-1 sm:px-2 sm:py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8B83]/35 ${surfaceClasses} ${
          isClickable ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        {/* Quiet Group vs Private Kicker */}
        <div className="flex items-center justify-between gap-1 leading-none mb-0.5">
          <span className={`text-[8px] sm:text-[9.5px] font-medium truncate ${kindTextClasses}`}>
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
            <span
              className={`hidden md:inline text-[9.5px] font-normal tabular-nums shrink-0 ${metaTextClasses}`}
            >
              {entry.activeStudentCount} {isEn ? 'st.' : 'طالب'}
            </span>
          )}
        </div>

        {/* Student or Group Name (with StudentAvatar on spacious desktop viewports) */}
        <div className="flex items-center gap-1.5 min-w-0">
          {!isGroup && entry.student ? (
            <span className="hidden md:inline-flex shrink-0">
              <StudentAvatar student={entry.student} size="xs" showFrame={false} />
            </span>
          ) : null}
          <span
            className={`block text-[9.5px] sm:text-[11.5px] font-semibold leading-[1.28] line-clamp-2 break-words min-w-0 ${titleTextClasses}`}
          >
            {entry.title}
          </span>
        </div>

        {/* Custom group student override name if applicable */}
        {isGroup && entry.isCustomEnrollmentSchedule && entry.activeStudents.length > 0 && (
          <div
            className={`mt-0.5 text-[8px] sm:text-[10px] font-normal leading-tight line-clamp-1 break-words ${metaTextClasses}`}
          >
            {entry.activeStudents.map((s) => s.name).join(isRTL ? '، ' : ', ')}
          </div>
        )}

        {/* Muted Lesson Time */}
        <div
          className={`mt-0.5 text-[8.5px] sm:text-[10px] font-normal tabular-nums leading-tight truncate ${metaTextClasses}`}
        >
          {entry.displayTime}
        </div>

        {/* Subject on tablet/desktop when present */}
        {entry.subject ? (
          <div
            className={`hidden sm:block mt-0.5 text-[9.5px] font-normal opacity-85 truncate ${metaTextClasses}`}
          >
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
        className="border-b border-e last:border-e-0 border-[#ECF3F3] dark:border-[#182E45] bg-transparent p-[3px] sm:p-1.5 align-top h-[54px] sm:h-[68px] overflow-hidden"
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
        className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-0 sm:p-5 select-none`}
      >
        {/* Soft calm backdrop */}
        <div
          className="fixed inset-0 bg-[#0F2A4A]/35 dark:bg-[#040B14]/65"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Soft, Minimal Static Weekly Timetable Panel */}
        <div
          data-testid="weekly-timetable-panel"
          className="relative z-10 w-full h-[100dvh] sm:h-[88vh] sm:max-h-[840px] sm:max-w-5xl lg:max-w-6xl bg-[#FAFDFD] dark:bg-[#0D1D30] sm:rounded-[24px] border-0 sm:border sm:border-[#E3EDED] dark:sm:border-[#1E3852] shadow-[0_20px_50px_rgba(15,42,74,0.12)] flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,0px)]"
        >
          {/* Clean, Airy Top Title Bar (Zero Date/Week Controls) */}
          <div className="px-4 sm:px-6 py-3 sm:py-3.5 pt-[calc(12px+env(safe-area-inset-top,0px))] sm:pt-3.5 bg-[#FFFFFF] dark:bg-[#102236] border-b border-[#E8F1F1] dark:border-[#1C354E] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#EFF7F6] dark:bg-[#163244] text-[#2E8B83] dark:text-[#8CD4CC] flex items-center justify-center shrink-0">
                <AppIcon name="calendarDays" weight="duotone" size={19} />
              </div>
              <div className="min-w-0 text-start">
                <h2 className="text-[15px] sm:text-[17px] font-semibold text-[#17375E] dark:text-[#EEF7F6] truncate leading-snug">
                  {isEn ? 'Fixed Weekly Timetable' : 'الجدول الأسبوعي الثابت'}
                </h2>
                <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 text-[11px] sm:text-xs font-normal text-[#6E8094] dark:text-[#8CA6BF] tabular-nums truncate">
                  <span>{isEn ? 'Recurring weekly schedule' : 'جدول أسبوعي ثابت'}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {isEn
                      ? `${timetable.totalLessonsCount} scheduled`
                      : `${timetable.totalLessonsCount} حصة مجدولة`}
                  </span>
                  {timetable.totalLessonsCount > 0 && (
                    <>
                      <span aria-hidden="true" className="hidden sm:inline">
                        ·
                      </span>
                      <span className="hidden sm:inline text-[#35736D] dark:text-[#86CEC6]">
                        {isEn
                          ? `${timetable.groupLessonsCount} groups`
                          : `${timetable.groupLessonsCount} مجموعات`}
                      </span>
                      <span aria-hidden="true" className="hidden sm:inline">
                        ·
                      </span>
                      <span className="hidden sm:inline text-[#4A678C] dark:text-[#97B6DC]">
                        {isEn
                          ? `${timetable.privateLessonsCount} private`
                          : `${timetable.privateLessonsCount} دروس خاصة`}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              data-testid="weekly-timetable-close-btn"
              onClick={onClose}
              aria-label={isEn ? 'Close timetable' : 'إغلاق الجدول الأسبوعي'}
              title={isEn ? 'Close timetable' : 'إغلاق الجدول الأسبوعي'}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#F2F7F7] hover:bg-[#E4EFEF] dark:bg-[#162C44] dark:hover:bg-[#1E3A58] text-[#4A5B6E] hover:text-[#17375E] dark:text-[#B4CADB] dark:hover:text-[#FFFFFF] flex items-center justify-center transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8B83]/35"
            >
              <AppIcon name="close" size={18} />
            </button>
          </div>

          {/* Static Fixed 7-Day × Chronological-Time Grid (Vertical Scroll Only) */}
          <div
            data-testid="weekly-timetable-scroll-container"
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain bg-[#FAFDFD] dark:bg-[#0D1D30]"
          >
            <table
              data-testid="weekly-timetable-grid"
              className="w-full max-w-full table-fixed border-separate border-spacing-0 text-start"
            >
              <colgroup>
                <col className="w-[9.5%] sm:w-[8.5%]" />
                {timetable.days.map((day) => (
                  <col key={`col_${day.dayKey}`} className="w-[12.928%] sm:w-[13.071%]" />
                ))}
              </colgroup>

              <thead>
                <tr>
                  {/* Narrow, Quiet Corner Header: Time Column */}
                  <th
                    scope="col"
                    className="sticky top-0 z-20 bg-[#F3F8F8] dark:bg-[#102338] text-[#7B8FA2] dark:text-[#7E99B4] border-b border-e border-[#E6EFEF] dark:border-[#1B334B] px-0.5 sm:px-2 py-2 sm:py-2.5 text-center align-middle overflow-hidden"
                  >
                    <span className="block text-[9.5px] sm:text-[11px] font-medium leading-tight truncate">
                      {isEn ? 'Time' : 'الوقت'}
                    </span>
                  </th>

                  {/* Compact, Softly Tinted 7 Weekday Column Headers (Zero Dates) */}
                  {timetable.days.map((day) => (
                    <th
                      key={day.dayKey}
                      scope="col"
                      data-testid={`timetable-day-header-${day.dayKey}`}
                      className="sticky top-0 z-20 bg-[#F3F8F8] dark:bg-[#102338] text-[#17375E] dark:text-[#E6F2F1] border-b border-e last:border-e-0 border-[#E6EFEF] dark:border-[#1B334B] px-0.5 sm:px-2 py-2 sm:py-2.5 text-center align-middle overflow-hidden"
                    >
                      <span className="sm:hidden block text-[10px] font-semibold leading-tight truncate">
                        {day.shortDayName}
                      </span>
                      <span className="hidden sm:block text-[12px] font-semibold tracking-tight leading-tight truncate">
                        {day.dayName}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {timetable.rows.map((row) => (
                  <tr key={row.timeSlotKey} data-testid={`timetable-row-${row.timeSlotKey}`}>
                    {/* Narrow, Muted Secondary Time Label Cell */}
                    <th
                      scope="row"
                      className="bg-[#F6FAFA]/65 dark:bg-[#0F2034]/60 text-[#7B8FA2] dark:text-[#7E99B4] border-b border-e border-[#ECF3F3] dark:border-[#182E45] px-0.5 sm:px-2 py-2.5 sm:py-3 align-top text-center overflow-hidden"
                    >
                      <span className="block text-[9px] sm:text-[11px] font-normal tabular-nums leading-tight break-words">
                        {row.label}
                      </span>
                    </th>

                    {/* 7 Quiet Weekday Cells for this Time Slot */}
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
