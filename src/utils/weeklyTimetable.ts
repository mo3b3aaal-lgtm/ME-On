import { Enrollment, Group, Student } from '../types';
import {
  CANONICAL_WEEKDAYS,
  CanonicalWeekday,
  formatTimeDisplay,
  getLocalizedLocationName,
  getLocalizedSubjectName,
  getLocalizedWeekdayName,
  isEnrollmentActiveOnDate,
  isRTLMode,
  normalizeScheduleDays,
  normalizeScheduleTimes,
  normalizeScheduleTimesList,
  parseTimeToMinutes,
  WEEKDAY_SHORT_ENGLISH,
} from './schedule';

export type TimetableLessonKind = 'group' | 'private';

export interface ParsedRecurringTime {
  rawTime: string;
  slotKey: string;
  rowLabel: string;
  startTimeDisplay: string;
  endTimeDisplay?: string;
  displayTime: string;
  sortMinutes: number;
  endSortMinutes?: number;
  hasExplicitTime: boolean;
  hasExplicitEndTime: boolean;
}

export interface TimetableLessonEntry {
  id: string;
  kind: TimetableLessonKind;
  dayKey: CanonicalWeekday;
  dayName: string;
  timeSlotKey: string;
  rawTime: string;
  startTimeDisplay: string;
  endTimeDisplay?: string;
  displayTime: string;
  sortMinutes: number;
  hasExplicitTime: boolean;
  hasExplicitEndTime: boolean;
  title: string;
  kindLabel: string;
  subject: string;
  gradeLevel: string;
  location: string;
  groupId?: string;
  group?: Group;
  studentId?: string;
  student?: Student;
  enrollmentId?: string;
  activeStudentCount: number;
  activeStudents: Student[];
  isCustomEnrollmentSchedule?: boolean;
}

export interface TimetableCell {
  dayKey: CanonicalWeekday;
  timeSlotKey: string;
  entries: TimetableLessonEntry[];
  hasCollision: boolean;
  groupCount: number;
  privateCount: number;
}

export interface TimetableDayColumn {
  dayKey: CanonicalWeekday;
  dayIndex: number;
  dayName: string;
  shortDayName: string;
  totalLessonsCount: number;
}

export interface TimetableTimeRow {
  timeSlotKey: string;
  sortMinutes: number;
  label: string;
  hasExplicitTime: boolean;
  cells: Record<CanonicalWeekday, TimetableCell>;
  totalEntriesInRow: number;
}

export interface FixedWeeklyTimetableData {
  days: TimetableDayColumn[];
  rows: TimetableTimeRow[];
  allEntries: TimetableLessonEntry[];
  totalLessonsCount: number;
  groupLessonsCount: number;
  privateLessonsCount: number;
  overlappingCellsCount: number;
}

export interface BuildFixedWeeklyTimetableParams {
  students: Student[];
  groups: Group[];
  enrollments: Enrollment[];
  /**
   * Local calendar date ("YYYY-MM-DD") used strictly to evaluate enrollment
   * start/end bounds and temporary vacation suspensions. Never rendered as a date.
   */
  operationalDateStr: string;
  isRTLOrLang?: boolean | string;
  /**
   * When true, merges standard wall-timetable hours (12:00 PM – 9:00 PM) with
   * all actual scheduled lesson time slots so the grid always maintains a fixed,
   * printed-schedule structure while keeping every custom time in chronological order.
   */
  includeBaselineHours?: boolean;
}

/**
 * Standard daily tutoring hours (12:00 PM through 9:00 PM in minutes from midnight)
 * used to give the static weekly wall timetable a consistent printed-grid structure.
 */
export const WALL_TIMETABLE_BASELINE_MINUTES: readonly number[] = [
  12 * 60, // 12:00 PM
  13 * 60, // 1:00 PM
  14 * 60, // 2:00 PM
  15 * 60, // 3:00 PM
  16 * 60, // 4:00 PM
  17 * 60, // 5:00 PM
  18 * 60, // 6:00 PM
  19 * 60, // 7:00 PM
  20 * 60, // 8:00 PM
  21 * 60, // 9:00 PM
];

const TIME_RANGE_SPLIT_REGEX = /\s*(?:–|—|-|\bto\b|إلى)\s*/i;

function minutesToHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Parses a recurring schedule time string without inventing missing times or durations.
 * Supports single start times ("17:00", "5:00 PM", "05:00 م") as well as explicit
 * start–end ranges ("17:00 - 18:30", "5:00 PM - 6:30 PM") when present in source data.
 */
export function parseRecurringTimeDescriptor(
  rawTimeInput: string | undefined | null,
  isRTL: boolean
): ParsedRecurringTime {
  const unscheduledLabel = isRTL ? 'بدون وقت محدد' : 'Time not set';
  if (!rawTimeInput || !rawTimeInput.trim()) {
    return {
      rawTime: '',
      slotKey: 'unscheduled_time',
      rowLabel: unscheduledLabel,
      startTimeDisplay: unscheduledLabel,
      displayTime: unscheduledLabel,
      sortMinutes: 99999,
      hasExplicitTime: false,
      hasExplicitEndTime: false,
    };
  }

  const trimmed = rawTimeInput.trim();
  const rangeParts = trimmed
    .split(TIME_RANGE_SPLIT_REGEX)
    .map((p) => p.trim())
    .filter(Boolean);

  if (rangeParts.length >= 2) {
    const startRaw = rangeParts[0];
    const endRaw = rangeParts[1];
    const startMins = parseTimeToMinutes(startRaw);
    const endMins = parseTimeToMinutes(endRaw);

    if (startMins !== 99999) {
      const startDisplay = formatTimeDisplay(startRaw, isRTL);
      const endDisplay = endMins !== 99999 ? formatTimeDisplay(endRaw, isRTL) : endRaw;
      const rangeSeparator = ' – ';
      return {
        rawTime: trimmed,
        slotKey: `m_${startMins}`,
        rowLabel: startDisplay,
        startTimeDisplay: startDisplay,
        endTimeDisplay: endDisplay || undefined,
        displayTime: endDisplay ? `${startDisplay}${rangeSeparator}${endDisplay}` : startDisplay,
        sortMinutes: startMins,
        endSortMinutes: endMins !== 99999 ? endMins : undefined,
        hasExplicitTime: true,
        hasExplicitEndTime: Boolean(endDisplay),
      };
    }
  }

  const singleMins = parseTimeToMinutes(trimmed);
  if (singleMins !== 99999) {
    const formatted = formatTimeDisplay(trimmed, isRTL);
    return {
      rawTime: trimmed,
      slotKey: `m_${singleMins}`,
      rowLabel: formatted,
      startTimeDisplay: formatted,
      displayTime: formatted,
      sortMinutes: singleMins,
      hasExplicitTime: true,
      hasExplicitEndTime: false,
    };
  }

  return {
    rawTime: trimmed,
    slotKey: `raw_${trimmed.toLowerCase()}`,
    rowLabel: trimmed,
    startTimeDisplay: trimmed,
    displayTime: trimmed,
    sortMinutes: 99998,
    hasExplicitTime: true,
    hasExplicitEndTime: false,
  };
}

function createEmptyCellsMap(timeSlotKey: string): Record<CanonicalWeekday, TimetableCell> {
  return {
    saturday: {
      dayKey: 'saturday',
      timeSlotKey,
      entries: [],
      hasCollision: false,
      groupCount: 0,
      privateCount: 0,
    },
    sunday: {
      dayKey: 'sunday',
      timeSlotKey,
      entries: [],
      hasCollision: false,
      groupCount: 0,
      privateCount: 0,
    },
    monday: {
      dayKey: 'monday',
      timeSlotKey,
      entries: [],
      hasCollision: false,
      groupCount: 0,
      privateCount: 0,
    },
    tuesday: {
      dayKey: 'tuesday',
      timeSlotKey,
      entries: [],
      hasCollision: false,
      groupCount: 0,
      privateCount: 0,
    },
    wednesday: {
      dayKey: 'wednesday',
      timeSlotKey,
      entries: [],
      hasCollision: false,
      groupCount: 0,
      privateCount: 0,
    },
    thursday: {
      dayKey: 'thursday',
      timeSlotKey,
      entries: [],
      hasCollision: false,
      groupCount: 0,
      privateCount: 0,
    },
    friday: {
      dayKey: 'friday',
      timeSlotKey,
      entries: [],
      hasCollision: false,
      groupCount: 0,
      privateCount: 0,
    },
  };
}

function resolveGroupTimesOnScheduledDay(group: Group, canonDay: CanonicalWeekday): string[] {
  const normMap = normalizeScheduleTimes(group.scheduleTimes);
  if (normMap[canonDay] && normMap[canonDay].length > 0) {
    return normMap[canonDay];
  }
  if (group.scheduleTime && group.scheduleTime.trim()) {
    const fallbackList = normalizeScheduleTimesList(group.scheduleTime);
    if (fallbackList.length > 0) {
      return fallbackList;
    }
  }
  return [''];
}

function resolveEnrollmentOverrideTimesOnDay(
  enr: Enrollment,
  group: Group,
  canonDay: CanonicalWeekday
): string[] {
  const normEnrMap = normalizeScheduleTimes(enr.scheduleTimes);
  if (normEnrMap[canonDay] && normEnrMap[canonDay].length > 0) {
    return normEnrMap[canonDay];
  }
  if (enr.scheduleTime && enr.scheduleTime.trim()) {
    const enrList = normalizeScheduleTimesList(enr.scheduleTime);
    if (enrList.length > 0) {
      return enrList;
    }
  }
  return resolveGroupTimesOnScheduledDay(group, canonDay);
}

function resolvePrivateEnrollmentTimesOnDay(
  enr: Enrollment,
  stu: Student,
  legacyPrivateGroup: Group | undefined,
  canonDay: CanonicalWeekday
): string[] {
  const enrMap = normalizeScheduleTimes(enr.scheduleTimes);
  if (enrMap[canonDay]?.length) return enrMap[canonDay];
  if (enr.scheduleTime?.trim()) return normalizeScheduleTimesList(enr.scheduleTime);

  const stuPrivMap = normalizeScheduleTimes(stu.privateTimes);
  if (stuPrivMap[canonDay]?.length) return stuPrivMap[canonDay];
  if (stu.privateTime?.trim()) return normalizeScheduleTimesList(stu.privateTime);

  const stuSchedMap = normalizeScheduleTimes(stu.scheduleTimes);
  if (stuSchedMap[canonDay]?.length) return stuSchedMap[canonDay];
  if (stu.scheduleTime?.trim()) return normalizeScheduleTimesList(stu.scheduleTime);

  if (legacyPrivateGroup) {
    const grpMap = normalizeScheduleTimes(legacyPrivateGroup.scheduleTimes);
    if (grpMap[canonDay]?.length) return grpMap[canonDay];
    if (legacyPrivateGroup.scheduleTime?.trim()) {
      return normalizeScheduleTimesList(legacyPrivateGroup.scheduleTime);
    }
  }

  return [''];
}

function resolveDirectStudentPrivateTimesOnDay(stu: Student, canonDay: CanonicalWeekday): string[] {
  const stuPrivMap = normalizeScheduleTimes(stu.privateTimes);
  if (stuPrivMap[canonDay]?.length) return stuPrivMap[canonDay];
  if (stu.privateTime?.trim()) return normalizeScheduleTimesList(stu.privateTime);

  const stuSchedMap = normalizeScheduleTimes(stu.scheduleTimes);
  if (stuSchedMap[canonDay]?.length) return stuSchedMap[canonDay];
  if (stu.scheduleTime?.trim()) return normalizeScheduleTimesList(stu.scheduleTime);

  return [''];
}

/**
 * Pure, read-only aggregation of Classy's recurring weekly schedules into a static 7-day
 * chronological wall timetable matrix.
 *
 * Architectural guarantees:
 * - Reads ONLY recurring schedule sources (`Group`, `Enrollment`, `Student`).
 * - Never reads or displays dated `Session` records.
 * - Never writes to storage or mutates entities.
 * - Preserves strict Group vs. Private domain separation.
 * - Respects student status, enrollment status, `startDate`, `endDate`, and `vacationPeriods`.
 * - Preserves all overlapping lessons in the same `(day, timeSlot)` cell without overwriting.
 * - Never invents missing start times, end times, or durations on lessons.
 */
export function buildFixedWeeklyTimetable({
  students,
  groups,
  enrollments,
  operationalDateStr,
  isRTLOrLang,
  includeBaselineHours = false,
}: BuildFixedWeeklyTimetableParams): FixedWeeklyTimetableData {
  const isRTL = isRTLMode(isRTLOrLang);
  const groupKindLabel = isRTL ? 'مجموعة' : 'Group';
  const privateKindLabel = isRTL ? 'درس خاص' : 'Private';

  const activeStudentsById = new Map<string, Student>();
  for (const stu of students) {
    if (stu.status === 'active') {
      activeStudentsById.set(stu.id, stu);
    }
  }

  const groupsById = new Map<string, Group>();
  for (const grp of groups) {
    groupsById.set(grp.id, grp);
  }

  const nonStoppedGroupEnrollments = new Map<string, Enrollment[]>();
  for (const enr of enrollments) {
    if (enr.status === 'stopped' || enr.serviceType === 'private' || !enr.groupId) {
      continue;
    }
    const existing = nonStoppedGroupEnrollments.get(enr.groupId);
    if (existing) {
      existing.push(enr);
    } else {
      nonStoppedGroupEnrollments.set(enr.groupId, [enr]);
    }
  }

  const rawEntries: TimetableLessonEntry[] = [];

  // ---------------------------------------------------------------------------
  // 1. Recurring Study Groups (Strictly excluding `group.type === 'private'`)
  // ---------------------------------------------------------------------------
  for (const group of groups) {
    if (group.type === 'private') {
      continue;
    }

    const groupDays = normalizeScheduleDays(group.scheduleDays);
    const groupDaySet = new Set<CanonicalWeekday>(groupDays);
    const groupEnrs = nonStoppedGroupEnrollments.get(group.id) || [];

    const operationalGroupEnrollments: { enrollment: Enrollment; student: Student }[] = [];
    for (const enr of groupEnrs) {
      const stu = activeStudentsById.get(enr.studentId);
      if (!stu) continue;
      if (!isEnrollmentActiveOnDate(enr, operationalDateStr, stu)) continue;
      operationalGroupEnrollments.push({ enrollment: enr, student: stu });
    }

    const localizedSubject = getLocalizedSubjectName(group.subject, isRTL);
    const localizedLocation = getLocalizedLocationName(group.roomOrLocation, isRTL);
    const groupBaseSlotKeysByDay = new Map<CanonicalWeekday, Set<string>>();

    for (const canonDay of groupDays) {
      const dayName = getLocalizedWeekdayName(canonDay, isRTL);
      const rawTimes = resolveGroupTimesOnScheduledDay(group, canonDay);
      const seenSlotKeysForGroupDay = new Set<string>();

      const activeStudentsForGroupDay: Student[] = [];
      const seenStudentIds = new Set<string>();
      for (const { enrollment: enr, student: stu } of operationalGroupEnrollments) {
        if (seenStudentIds.has(stu.id)) continue;
        if (enr.scheduleDays && Array.isArray(enr.scheduleDays) && enr.scheduleDays.length > 0) {
          const customDays = normalizeScheduleDays(enr.scheduleDays);
          if (!customDays.includes(canonDay)) {
            continue;
          }
        }
        seenStudentIds.add(stu.id);
        activeStudentsForGroupDay.push(stu);
      }

      for (const rawTime of rawTimes) {
        const timeDesc = parseRecurringTimeDescriptor(rawTime, isRTL);
        const dedupeKey = `${timeDesc.slotKey}__${timeDesc.displayTime}`;
        if (seenSlotKeysForGroupDay.has(dedupeKey)) continue;
        seenSlotKeysForGroupDay.add(dedupeKey);

        let dayKeysSet = groupBaseSlotKeysByDay.get(canonDay);
        if (!dayKeysSet) {
          dayKeysSet = new Set<string>();
          groupBaseSlotKeysByDay.set(canonDay, dayKeysSet);
        }
        dayKeysSet.add(timeDesc.slotKey);

        rawEntries.push({
          id: `tt_grp_${group.id}_${canonDay}_${timeDesc.slotKey}`,
          kind: 'group',
          dayKey: canonDay,
          dayName,
          timeSlotKey: timeDesc.slotKey,
          rawTime: timeDesc.rawTime,
          startTimeDisplay: timeDesc.startTimeDisplay,
          endTimeDisplay: timeDesc.endTimeDisplay,
          displayTime: timeDesc.displayTime,
          sortMinutes: timeDesc.sortMinutes,
          hasExplicitTime: timeDesc.hasExplicitTime,
          hasExplicitEndTime: timeDesc.hasExplicitEndTime,
          title: group.name,
          kindLabel: groupKindLabel,
          subject: localizedSubject,
          gradeLevel: group.gradeLevel || '',
          location: localizedLocation,
          groupId: group.id,
          group,
          activeStudentCount: activeStudentsForGroupDay.length,
          activeStudents: activeStudentsForGroupDay,
        });
      }
    }

    const customSlotsMap = new Map<
      string,
      {
        canonDay: CanonicalWeekday;
        timeDesc: ParsedRecurringTime;
        students: Student[];
        studentIds: Set<string>;
        firstEnrollmentId: string;
      }
    >();

    for (const { enrollment: enr, student: stu } of operationalGroupEnrollments) {
      const hasCustomDays = Boolean(
        enr.scheduleDays && Array.isArray(enr.scheduleDays) && enr.scheduleDays.length > 0
      );
      const hasCustomTimes = Boolean(
        (enr.scheduleTimes && Object.keys(enr.scheduleTimes).length > 0) ||
          (enr.scheduleTime && enr.scheduleTime.trim())
      );

      if (!hasCustomDays && !hasCustomTimes) {
        continue;
      }

      const effectiveDays = hasCustomDays ? normalizeScheduleDays(enr.scheduleDays) : groupDays;
      for (const canonDay of effectiveDays) {
        const overrideTimes = resolveEnrollmentOverrideTimesOnDay(enr, group, canonDay);
        for (const rawTime of overrideTimes) {
          const timeDesc = parseRecurringTimeDescriptor(rawTime, isRTL);
          const coveredByBaseGroup =
            groupDaySet.has(canonDay) &&
            Boolean(groupBaseSlotKeysByDay.get(canonDay)?.has(timeDesc.slotKey));

          if (coveredByBaseGroup) {
            continue;
          }

          const customKey = `${canonDay}__${timeDesc.slotKey}`;
          const existing = customSlotsMap.get(customKey);
          if (existing) {
            if (!existing.studentIds.has(stu.id)) {
              existing.studentIds.add(stu.id);
              existing.students.push(stu);
            }
          } else {
            customSlotsMap.set(customKey, {
              canonDay,
              timeDesc,
              students: [stu],
              studentIds: new Set([stu.id]),
              firstEnrollmentId: enr.id,
            });
          }
        }
      }
    }

    for (const customSlot of customSlotsMap.values()) {
      const dayName = getLocalizedWeekdayName(customSlot.canonDay, isRTL);
      rawEntries.push({
        id: `tt_grp_custom_${group.id}_${customSlot.canonDay}_${customSlot.timeDesc.slotKey}`,
        kind: 'group',
        dayKey: customSlot.canonDay,
        dayName,
        timeSlotKey: customSlot.timeDesc.slotKey,
        rawTime: customSlot.timeDesc.rawTime,
        startTimeDisplay: customSlot.timeDesc.startTimeDisplay,
        endTimeDisplay: customSlot.timeDesc.endTimeDisplay,
        displayTime: customSlot.timeDesc.displayTime,
        sortMinutes: customSlot.timeDesc.sortMinutes,
        hasExplicitTime: customSlot.timeDesc.hasExplicitTime,
        hasExplicitEndTime: customSlot.timeDesc.hasExplicitEndTime,
        title: group.name,
        kindLabel: groupKindLabel,
        subject: localizedSubject,
        gradeLevel: group.gradeLevel || '',
        location: localizedLocation,
        groupId: group.id,
        group,
        enrollmentId: customSlot.firstEnrollmentId,
        activeStudentCount: customSlot.students.length,
        activeStudents: customSlot.students,
        isCustomEnrollmentSchedule: true,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Recurring Private Lessons (Strictly isolated from Groups)
  // ---------------------------------------------------------------------------
  const studentsWithPrivateEnrollments = new Set<string>();
  const seenPrivateSlotKeys = new Set<string>();

  const nonStoppedPrivateEnrollments = enrollments.filter(
    (e) =>
      e.status !== 'stopped' &&
      (e.serviceType === 'private' || !e.groupId || groupsById.get(e.groupId)?.type === 'private')
  );

  for (const enr of nonStoppedPrivateEnrollments) {
    studentsWithPrivateEnrollments.add(enr.studentId);

    const stu = activeStudentsById.get(enr.studentId);
    if (!stu) continue;
    if (!isEnrollmentActiveOnDate(enr, operationalDateStr, stu)) continue;

    const legacyPrivGroup =
      enr.groupId && groupsById.get(enr.groupId)?.type === 'private'
        ? groupsById.get(enr.groupId)
        : undefined;

    const rawPrivDays =
      enr.scheduleDays && Array.isArray(enr.scheduleDays) && enr.scheduleDays.length > 0
        ? enr.scheduleDays
        : stu.privateDays && Array.isArray(stu.privateDays) && stu.privateDays.length > 0
        ? stu.privateDays
        : stu.scheduleDays && Array.isArray(stu.scheduleDays) && stu.scheduleDays.length > 0
        ? stu.scheduleDays
        : legacyPrivGroup?.scheduleDays || [];

    const normPrivDays = normalizeScheduleDays(rawPrivDays);
    if (normPrivDays.length === 0) continue;

    const localizedSubject = getLocalizedSubjectName(
      enr.subject || stu.subject || legacyPrivGroup?.subject,
      isRTL
    );
    const localizedLocation = getLocalizedLocationName(
      enr.roomOrLocation || stu.privateLocation || legacyPrivGroup?.roomOrLocation,
      isRTL
    );

    for (const canonDay of normPrivDays) {
      const dayName = getLocalizedWeekdayName(canonDay, isRTL);
      const rawTimes = resolvePrivateEnrollmentTimesOnDay(enr, stu, legacyPrivGroup, canonDay);

      for (const rawTime of rawTimes) {
        const timeDesc = parseRecurringTimeDescriptor(rawTime, isRTL);
        const dedupeKey = `${stu.id}__${enr.id}__${canonDay}__${timeDesc.slotKey}`;
        if (seenPrivateSlotKeys.has(dedupeKey)) continue;
        seenPrivateSlotKeys.add(dedupeKey);

        rawEntries.push({
          id: `tt_priv_enr_${enr.id}_${stu.id}_${canonDay}_${timeDesc.slotKey}`,
          kind: 'private',
          dayKey: canonDay,
          dayName,
          timeSlotKey: timeDesc.slotKey,
          rawTime: timeDesc.rawTime,
          startTimeDisplay: timeDesc.startTimeDisplay,
          endTimeDisplay: timeDesc.endTimeDisplay,
          displayTime: timeDesc.displayTime,
          sortMinutes: timeDesc.sortMinutes,
          hasExplicitTime: timeDesc.hasExplicitTime,
          hasExplicitEndTime: timeDesc.hasExplicitEndTime,
          title: stu.name,
          kindLabel: privateKindLabel,
          subject: localizedSubject,
          gradeLevel: stu.gradeLevel || '',
          location: localizedLocation,
          studentId: stu.id,
          student: stu,
          enrollmentId: enr.id,
          activeStudentCount: 1,
          activeStudents: [stu],
        });
      }
    }
  }

  // Fallback for direct Student private recurring schedules not governed by a private Enrollment
  for (const stu of activeStudentsById.values()) {
    if (studentsWithPrivateEnrollments.has(stu.id)) continue;
    if (!isEnrollmentActiveOnDate(null, operationalDateStr, stu)) continue;

    const hasDirectPrivateDays = Boolean(
      stu.privateDays && Array.isArray(stu.privateDays) && stu.privateDays.length > 0
    );
    const hasPrivateServiceSchedule =
      stu.serviceType === 'private' &&
      Boolean(stu.scheduleDays && Array.isArray(stu.scheduleDays) && stu.scheduleDays.length > 0);

    if (!hasDirectPrivateDays && !hasPrivateServiceSchedule) continue;

    const rawDays = hasDirectPrivateDays ? stu.privateDays! : stu.scheduleDays!;
    const normDays = normalizeScheduleDays(rawDays);
    if (normDays.length === 0) continue;

    const localizedSubject = getLocalizedSubjectName(stu.subject, isRTL);
    const localizedLocation = getLocalizedLocationName(stu.privateLocation, isRTL);

    for (const canonDay of normDays) {
      const dayName = getLocalizedWeekdayName(canonDay, isRTL);
      const rawTimes = resolveDirectStudentPrivateTimesOnDay(stu, canonDay);

      for (const rawTime of rawTimes) {
        const timeDesc = parseRecurringTimeDescriptor(rawTime, isRTL);
        const dedupeKey = `${stu.id}__direct__${canonDay}__${timeDesc.slotKey}`;
        if (seenPrivateSlotKeys.has(dedupeKey)) continue;
        seenPrivateSlotKeys.add(dedupeKey);

        rawEntries.push({
          id: `tt_priv_stu_${stu.id}_${canonDay}_${timeDesc.slotKey}`,
          kind: 'private',
          dayKey: canonDay,
          dayName,
          timeSlotKey: timeDesc.slotKey,
          rawTime: timeDesc.rawTime,
          startTimeDisplay: timeDesc.startTimeDisplay,
          endTimeDisplay: timeDesc.endTimeDisplay,
          displayTime: timeDesc.displayTime,
          sortMinutes: timeDesc.sortMinutes,
          hasExplicitTime: timeDesc.hasExplicitTime,
          hasExplicitEndTime: timeDesc.hasExplicitEndTime,
          title: stu.name,
          kindLabel: privateKindLabel,
          subject: localizedSubject,
          gradeLevel: stu.gradeLevel || '',
          location: localizedLocation,
          studentId: stu.id,
          student: stu,
          activeStudentCount: 1,
          activeStudents: [stu],
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Build Chronological Time Rows × Fixed 7-Day Columns
  // ---------------------------------------------------------------------------
  const rowsBySlotKey = new Map<string, TimetableTimeRow>();

  if (includeBaselineHours) {
    for (const mins of WALL_TIMETABLE_BASELINE_MINUTES) {
      const slotKey = `m_${mins}`;
      const label = formatTimeDisplay(minutesToHHMM(mins), isRTL);
      rowsBySlotKey.set(slotKey, {
        timeSlotKey: slotKey,
        sortMinutes: mins,
        label,
        hasExplicitTime: true,
        cells: createEmptyCellsMap(slotKey),
        totalEntriesInRow: 0,
      });
    }
  }

  const dayCounts: Record<CanonicalWeekday, number> = {
    saturday: 0,
    sunday: 0,
    monday: 0,
    tuesday: 0,
    wednesday: 0,
    thursday: 0,
    friday: 0,
  };

  let groupLessonsCount = 0;
  let privateLessonsCount = 0;

  for (const entry of rawEntries) {
    dayCounts[entry.dayKey] += 1;
    if (entry.kind === 'group') {
      groupLessonsCount += 1;
    } else {
      privateLessonsCount += 1;
    }

    let row = rowsBySlotKey.get(entry.timeSlotKey);
    if (!row) {
      row = {
        timeSlotKey: entry.timeSlotKey,
        sortMinutes: entry.sortMinutes,
        label: entry.startTimeDisplay,
        hasExplicitTime: entry.hasExplicitTime,
        cells: createEmptyCellsMap(entry.timeSlotKey),
        totalEntriesInRow: 0,
      };
      rowsBySlotKey.set(entry.timeSlotKey, row);
    }

    const cell = row.cells[entry.dayKey];
    cell.entries.push(entry);
    if (entry.kind === 'group') {
      cell.groupCount += 1;
    } else {
      cell.privateCount += 1;
    }
    cell.hasCollision = cell.entries.length > 1;
    row.totalEntriesInRow += 1;
  }

  const rows = Array.from(rowsBySlotKey.values());

  let overlappingCellsCount = 0;
  for (const row of rows) {
    for (const dayKey of CANONICAL_WEEKDAYS) {
      const cell = row.cells[dayKey];
      if (cell.entries.length > 1) {
        overlappingCellsCount += 1;
        cell.entries.sort((a, b) => {
          if (a.sortMinutes !== b.sortMinutes) {
            return a.sortMinutes - b.sortMinutes;
          }
          if (a.kind !== b.kind) {
            return a.kind === 'group' ? -1 : 1;
          }
          return a.title.localeCompare(b.title);
        });
      }
    }
  }

  rows.sort((a, b) => {
    if (a.sortMinutes !== b.sortMinutes) {
      return a.sortMinutes - b.sortMinutes;
    }
    return a.label.localeCompare(b.label);
  });

  const days: TimetableDayColumn[] = CANONICAL_WEEKDAYS.map((dayKey, dayIndex) => {
    const fullDayName = getLocalizedWeekdayName(dayKey, isRTL);
    return {
      dayKey,
      dayIndex,
      dayName: fullDayName,
      shortDayName: isRTL ? fullDayName : WEEKDAY_SHORT_ENGLISH[dayKey],
      totalLessonsCount: dayCounts[dayKey],
    };
  });

  return {
    days,
    rows,
    allEntries: rawEntries,
    totalLessonsCount: rawEntries.length,
    groupLessonsCount,
    privateLessonsCount,
    overlappingCellsCount,
  };
}
