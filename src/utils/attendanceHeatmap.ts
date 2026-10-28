import {
  Attendance,
  Enrollment,
  Group,
  Session,
  Student,
} from '../types';
import { parseLocalDateStr, toLocalISODate } from './localDate';
import { isEnrollmentActiveOnDate } from './schedule';

export type HeatmapWindowMode = 'calendar_year' | 'rolling_365';
export type HeatmapIntensityBand =
  | 'no_session'
  | 'optimal'
  | 'steady'
  | 'moderate_dip'
  | 'high_absence';
export type HeatmapSpotlightMode = 'all' | 'high_absence';

export interface HeatmapDayCell {
  dateKey: string;
  displayDate: string;
  shortDate: string;
  weekdayRow: number; // 0 = Sat, 1 = Sun, 2 = Mon, 3 = Tue, 4 = Wed, 5 = Thu, 6 = Fri
  weekdayLabel: string;
  weekdayFullLabel: string;
  weekIndex: number;
  month: number;
  year: number;
  sessionsCount: number;
  present: number;
  late: number;
  attended: number;
  absentCharged: number;
  absentExcused: number;
  absentTotal: number;
  totalExpected: number;
  attendanceRate: number | null;
  absenceRate: number | null;
  intensityBand: HeatmapIntensityBand;
  isHighAbsence: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface HeatmapMonthTick {
  weekIndex: number;
  month: number;
  year: number;
  label: string;
}

export interface HeatmapSeasonalMonthStat {
  key: string;
  month: number;
  year: number;
  label: string;
  shortLabel: string;
  activeDaysCount: number;
  highAbsenceDaysCount: number;
  sessionsCount: number;
  attended: number;
  absentTotal: number;
  absentCharged: number;
  absentExcused: number;
  totalExpected: number;
  attendanceRate: number;
  absenceRate: number;
  hasData: boolean;
}

export interface HeatmapWeekdayStat {
  weekdayRow: number;
  shortLabel: string;
  fullLabel: string;
  activeDaysCount: number;
  highAbsenceDaysCount: number;
  attended: number;
  absentTotal: number;
  totalExpected: number;
  attendanceRate: number | null;
  absenceRate: number | null;
}

export interface AttendanceHeatmapSummary {
  totalCalendarDays: number;
  activeSessionDays: number;
  highAbsenceDaysCount: number;
  moderateDipDaysCount: number;
  steadyOrOptimalDaysCount: number;
  zeroAbsenceDaysCount: number;
  overallAttendanceRate: number;
  overallAbsenceRate: number;
  totalSessions: number;
  totalAttended: number;
  totalAbsent: number;
  totalAbsentCharged: number;
  totalAbsentExcused: number;
  totalExpected: number;
  worstSeasonalMonth: HeatmapSeasonalMonthStat | null;
  bestSeasonalMonth: HeatmapSeasonalMonthStat | null;
  highestAbsenceWeekday: HeatmapWeekdayStat | null;
}

export interface BuildAttendanceHeatmapOptions {
  sessions: Session[];
  allAttendance: Attendance[];
  students?: Student[];
  groups?: Group[];
  enrollments?: Enrollment[];
  selectedGroupId?: string;
  selectedStudentId?: string;
  serviceTypeFilter?: 'all' | 'group' | 'private';
  windowMode?: HeatmapWindowMode;
  targetYear?: number;
  todayStr: string;
  isEn: boolean;
}

export interface AttendanceHeatmapResult {
  cells: HeatmapDayCell[];
  maxWeekIndex: number;
  monthTicks: HeatmapMonthTick[];
  weekdayLabels: { row: number; shortLabel: string; fullLabel: string }[];
  monthlySeasonality: HeatmapSeasonalMonthStat[];
  weekdayPatterns: HeatmapWeekdayStat[];
  highAbsenceDays: HeatmapDayCell[];
  summary: AttendanceHeatmapSummary;
  rangeStartStr: string;
  rangeEndStr: string;
}

export const HIGH_ABSENCE_THRESHOLD_PERCENT = 30;
export const MODERATE_ABSENCE_THRESHOLD_PERCENT = 15;

const ARABIC_MONTHS_SHORT = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const ENGLISH_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const ENGLISH_MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Row 0 = Saturday .. Row 6 = Friday (matches Classy's Saturday-first educational calendar)
const WEEKDAY_META = [
  { row: 0, arShort: 'سبت', arFull: 'السبت', enShort: 'Sat', enFull: 'Saturday' },
  { row: 1, arShort: 'أحد', arFull: 'الأحد', enShort: 'Sun', enFull: 'Sunday' },
  { row: 2, arShort: 'إثنين', arFull: 'الإثنين', enShort: 'Mon', enFull: 'Monday' },
  { row: 3, arShort: 'ثلاثاء', arFull: 'الثلاثاء', enShort: 'Tue', enFull: 'Tuesday' },
  { row: 4, arShort: 'أربعاء', arFull: 'الأربعاء', enShort: 'Wed', enFull: 'Wednesday' },
  { row: 5, arShort: 'خميس', arFull: 'الخميس', enShort: 'Thu', enFull: 'Thursday' },
  { row: 6, arShort: 'جمعة', arFull: 'الجمعة', enShort: 'Fri', enFull: 'Friday' },
];

function getMonthShortName(month1to12: number, isEn: boolean): string {
  if (month1to12 >= 1 && month1to12 <= 12) {
    return isEn ? ENGLISH_MONTHS_SHORT[month1to12 - 1] : ARABIC_MONTHS_SHORT[month1to12 - 1];
  }
  return isEn ? `M${month1to12}` : `شهر ${month1to12}`;
}

function getMonthFullName(month1to12: number, isEn: boolean): string {
  if (month1to12 >= 1 && month1to12 <= 12) {
    return isEn ? ENGLISH_MONTHS_FULL[month1to12 - 1] : ARABIC_MONTHS_SHORT[month1to12 - 1];
  }
  return isEn ? `Month ${month1to12}` : `شهر ${month1to12}`;
}

function jsDayToSaturdayRow(jsDay: number): number {
  return (jsDay + 1) % 7;
}

function classifyIntensityBand(
  totalExpected: number,
  absenceRate: number | null
): HeatmapIntensityBand {
  if (totalExpected <= 0 || absenceRate === null) {
    return 'no_session';
  }
  if (absenceRate >= HIGH_ABSENCE_THRESHOLD_PERCENT) {
    return 'high_absence';
  }
  if (absenceRate > MODERATE_ABSENCE_THRESHOLD_PERCENT) {
    return 'moderate_dip';
  }
  if (absenceRate > 0) {
    return 'steady';
  }
  return 'optimal';
}

export function extractAvailableHeatmapYears(
  sessions: Session[],
  currentYear: number
): number[] {
  const yearSet = new Set<number>([currentYear, currentYear - 1]);
  for (const s of sessions) {
    if (s.status === 'cancelled') continue;
    const yr = s.year || Number((s.date || '').slice(0, 4));
    if (Number.isFinite(yr) && yr >= 2020 && yr <= 2100) {
      yearSet.add(yr);
    }
  }
  return Array.from(yearSet).sort((a, b) => a - b);
}

export function pickInitialHeatmapYear(
  sessions: Session[],
  allAttendance: Attendance[],
  currentYear: number,
  preferredYear?: number
): number {
  if (preferredYear && Number.isFinite(preferredYear)) {
    return preferredYear;
  }

  const sessionIdsWithAttendance = new Set<string>();
  for (const a of allAttendance) {
    sessionIdsWithAttendance.add(a.sessionId);
  }

  const yearsWithAttendance = new Set<number>();
  for (const s of sessions) {
    if (s.status === 'cancelled') continue;
    if (!sessionIdsWithAttendance.has(s.id)) continue;
    const yr = s.year || Number((s.date || '').slice(0, 4));
    if (Number.isFinite(yr) && yr >= 2020 && yr <= 2100) {
      yearsWithAttendance.add(yr);
    }
  }

  if (yearsWithAttendance.has(currentYear) || yearsWithAttendance.size === 0) {
    return currentYear;
  }

  const sortedActive = Array.from(yearsWithAttendance).sort((a, b) => b - a);
  return sortedActive[0] ?? currentYear;
}

export function buildAttendanceHeatmapAnalytics(
  options: BuildAttendanceHeatmapOptions
): AttendanceHeatmapResult {
  const {
    sessions,
    allAttendance,
    students = [],
    groups = [],
    enrollments = [],
    selectedGroupId,
    selectedStudentId,
    todayStr,
    isEn,
  } = options;

  const resolvedServiceFilter: 'all' | 'group' | 'private' =
    options.serviceTypeFilter ?? 'all';
  const resolvedWindowMode: HeatmapWindowMode =
    options.windowMode ?? 'calendar_year';

  const todayDate = parseLocalDateStr(todayStr);
  const resolvedYear = options.targetYear ?? todayDate.getFullYear();

  // Compute start and end dates for the heatmap grid
  let startDate: Date;
  let endDate: Date;

  if (resolvedWindowMode === 'rolling_365') {
    // End on the Friday of the current Saturday-anchored week (or today's week end)
    // and start 52 full weeks earlier on Saturday so the grid is cleanly aligned
    const todayRow = jsDayToSaturdayRow(todayDate.getDay());
    const currentWeekSaturday = new Date(
      todayDate.getFullYear(),
      todayDate.getMonth(),
      todayDate.getDate() - todayRow
    );
    startDate = new Date(
      currentWeekSaturday.getFullYear(),
      currentWeekSaturday.getMonth(),
      currentWeekSaturday.getDate() - 52 * 7
    );
    endDate = new Date(
      currentWeekSaturday.getFullYear(),
      currentWeekSaturday.getMonth(),
      currentWeekSaturday.getDate() + 6
    );
  } else {
    startDate = new Date(resolvedYear, 0, 1);
    endDate = new Date(resolvedYear, 11, 31);
  }

  const rangeStartStr = toLocalISODate(startDate);
  const rangeEndStr = toLocalISODate(endDate);

  const groupsById = new Map<string, Group>();
  for (const g of groups) {
    groupsById.set(g.id, g);
  }

  const studentsById = new Map<string, Student>();
  for (const st of students) {
    studentsById.set(st.id, st);
  }

  const targetGroupId =
    selectedGroupId && selectedGroupId !== 'all' ? selectedGroupId : undefined;
  const targetStudentId =
    selectedStudentId && selectedStudentId !== 'all' ? selectedStudentId : undefined;

  const studentEnrollments = targetStudentId
    ? enrollments.filter((e) => e.studentId === targetStudentId && e.status !== 'stopped')
    : [];
  const targetStudentObj = targetStudentId ? studentsById.get(targetStudentId) ?? null : null;

  const sessionIdsWithTargetStudentAttendance = new Set<string>();
  if (targetStudentId) {
    for (const att of allAttendance) {
      if (att.studentId === targetStudentId) {
        sessionIdsWithTargetStudentAttendance.add(att.sessionId);
      }
    }
  }

  const isPrivateSession = (s: Session): boolean => {
    const grp = s.groupId ? groupsById.get(s.groupId) : undefined;
    return (
      Boolean(s.studentId) ||
      grp?.type === 'private' ||
      Boolean(s.groupId && s.groupId.startsWith('private_'))
    );
  };

  // 1. Filter relevant sessions within [rangeStartStr, rangeEndStr]
  const relevantSessions = sessions.filter((s) => {
    if (s.status === 'cancelled') return false;
    if (!s.date || s.date < rangeStartStr || s.date > rangeEndStr) return false;

    if (resolvedServiceFilter === 'private' && !isPrivateSession(s)) return false;
    if (resolvedServiceFilter === 'group' && isPrivateSession(s)) return false;
    if (targetGroupId && s.groupId !== targetGroupId) return false;

    if (targetStudentId) {
      if (s.studentId) {
        if (s.studentId !== targetStudentId) return false;
      } else if (!sessionIdsWithTargetStudentAttendance.has(s.id)) {
        const matchingEnr = studentEnrollments.find((e) => e.groupId === s.groupId);
        if (!matchingEnr || !isEnrollmentActiveOnDate(matchingEnr, s.date, targetStudentObj)) {
          return false;
        }
      }
    }

    return true;
  });

  const relevantSessionIds = new Set<string>(relevantSessions.map((s) => s.id));

  // 2. Index attendance by sessionId
  const attendanceBySession = new Map<string, Attendance[]>();
  for (const att of allAttendance) {
    if (!relevantSessionIds.has(att.sessionId)) continue;
    if (targetStudentId && att.studentId !== targetStudentId) continue;
    const list = attendanceBySession.get(att.sessionId);
    if (list) {
      list.push(att);
    } else {
      attendanceBySession.set(att.sessionId, [att]);
    }
  }

  // 3. Aggregate daily buckets by dateKey ('YYYY-MM-DD')
  interface DailyBucket {
    sessionsCount: number;
    present: number;
    late: number;
    absentCharged: number;
    absentExcused: number;
  }

  const dailyBuckets = new Map<string, DailyBucket>();

  for (const ses of relevantSessions) {
    const atts = attendanceBySession.get(ses.id);
    if (!atts || atts.length === 0) continue;

    const bucket = dailyBuckets.get(ses.date) || {
      sessionsCount: 0,
      present: 0,
      late: 0,
      absentCharged: 0,
      absentExcused: 0,
    };

    let countedAnyRecord = false;
    for (const a of atts) {
      if (a.status === 'present') {
        bucket.present += 1;
        countedAnyRecord = true;
      } else if (a.status === 'late') {
        bucket.late += 1;
        countedAnyRecord = true;
      } else if (
        a.status === 'absent_charged' ||
        (a.status === 'absent' && a.isCharged !== false)
      ) {
        bucket.absentCharged += 1;
        countedAnyRecord = true;
      } else if (
        a.status === 'absent_free' ||
        a.status === 'excused' ||
        (a.status === 'absent' && a.isCharged === false)
      ) {
        bucket.absentExcused += 1;
        countedAnyRecord = true;
      }
    }

    if (countedAnyRecord) {
      bucket.sessionsCount += 1;
      dailyBuckets.set(ses.date, bucket);
    }
  }

  // 4. Generate every day cell across the calendar window
  const cells: HeatmapDayCell[] = [];
  const startWeekdayRow = jsDayToSaturdayRow(startDate.getDay());

  const monthFirstWeekCandidates: HeatmapMonthTick[] = [];
  const seenMonthKeys = new Set<string>();

  interface MonthAccumulator {
    month: number;
    year: number;
    activeDaysCount: number;
    highAbsenceDaysCount: number;
    sessionsCount: number;
    attended: number;
    absentTotal: number;
    absentCharged: number;
    absentExcused: number;
    totalExpected: number;
  }

  const monthAccumulators = new Map<string, MonthAccumulator>();
  const weekdayAccumulators = WEEKDAY_META.map((meta) => ({
    weekdayRow: meta.row,
    shortLabel: isEn ? meta.enShort : meta.arShort,
    fullLabel: isEn ? meta.enFull : meta.arFull,
    activeDaysCount: 0,
    highAbsenceDaysCount: 0,
    attended: 0,
    absentTotal: 0,
    totalExpected: 0,
  }));

  let dayOffset = 0;
  let maxWeekIndex = 0;

  let activeSessionDays = 0;
  let highAbsenceDaysCount = 0;
  let moderateDipDaysCount = 0;
  let steadyOrOptimalDaysCount = 0;
  let zeroAbsenceDaysCount = 0;
  let totalSessions = 0;
  let totalAttended = 0;
  let totalAbsent = 0;
  let totalAbsentCharged = 0;
  let totalAbsentExcused = 0;
  let totalExpectedAll = 0;

  while (true) {
    const cur = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + dayOffset
    );
    if (cur.getTime() > endDate.getTime()) break;

    const dateKey = toLocalISODate(cur);
    const y = cur.getFullYear();
    const m = cur.getMonth() + 1;
    const d = cur.getDate();

    const gridSlot = startWeekdayRow + dayOffset;
    const weekIndex = Math.floor(gridSlot / 7);
    const weekdayRow = gridSlot % 7;
    if (weekIndex > maxWeekIndex) maxWeekIndex = weekIndex;

    const wdMeta = WEEKDAY_META[weekdayRow];
    const monthShort = getMonthShortName(m, isEn);

    const monthKey = `${y}-${String(m).padStart(2, '0')}`;
    if (!seenMonthKeys.has(monthKey)) {
      seenMonthKeys.add(monthKey);
      monthFirstWeekCandidates.push({
        weekIndex,
        month: m,
        year: y,
        label: monthShort,
      });
    }

    if (!monthAccumulators.has(monthKey)) {
      monthAccumulators.set(monthKey, {
        month: m,
        year: y,
        activeDaysCount: 0,
        highAbsenceDaysCount: 0,
        sessionsCount: 0,
        attended: 0,
        absentTotal: 0,
        absentCharged: 0,
        absentExcused: 0,
        totalExpected: 0,
      });
    }

    const bucket = dailyBuckets.get(dateKey);
    const present = bucket ? bucket.present : 0;
    const late = bucket ? bucket.late : 0;
    const attended = present + late;
    const absentCharged = bucket ? bucket.absentCharged : 0;
    const absentExcused = bucket ? bucket.absentExcused : 0;
    const absentTotal = absentCharged + absentExcused;
    const totalExpected = attended + absentTotal;
    const sessionsCount = bucket ? bucket.sessionsCount : 0;

    const attendanceRate =
      totalExpected > 0 ? Math.round((attended / totalExpected) * 100) : null;
    const absenceRate =
      totalExpected > 0 ? Math.round((absentTotal / totalExpected) * 100) : null;

    const intensityBand = classifyIntensityBand(totalExpected, absenceRate);
    const isHighAbsence = intensityBand === 'high_absence';

    if (totalExpected > 0) {
      activeSessionDays += 1;
      totalSessions += sessionsCount;
      totalAttended += attended;
      totalAbsent += absentTotal;
      totalAbsentCharged += absentCharged;
      totalAbsentExcused += absentExcused;
      totalExpectedAll += totalExpected;

      if (intensityBand === 'high_absence') {
        highAbsenceDaysCount += 1;
      } else if (intensityBand === 'moderate_dip') {
        moderateDipDaysCount += 1;
      } else {
        steadyOrOptimalDaysCount += 1;
        if (intensityBand === 'optimal') {
          zeroAbsenceDaysCount += 1;
        }
      }

      const mAcc = monthAccumulators.get(monthKey)!;
      mAcc.activeDaysCount += 1;
      if (isHighAbsence) mAcc.highAbsenceDaysCount += 1;
      mAcc.sessionsCount += sessionsCount;
      mAcc.attended += attended;
      mAcc.absentTotal += absentTotal;
      mAcc.absentCharged += absentCharged;
      mAcc.absentExcused += absentExcused;
      mAcc.totalExpected += totalExpected;

      const wdAcc = weekdayAccumulators[weekdayRow];
      wdAcc.activeDaysCount += 1;
      if (isHighAbsence) wdAcc.highAbsenceDaysCount += 1;
      wdAcc.attended += attended;
      wdAcc.absentTotal += absentTotal;
      wdAcc.totalExpected += totalExpected;
    }

    cells.push({
      dateKey,
      displayDate: `${d} ${monthShort} ${y}`,
      shortDate: `${d} ${monthShort}`,
      weekdayRow,
      weekdayLabel: isEn ? wdMeta.enShort : wdMeta.arShort,
      weekdayFullLabel: isEn ? wdMeta.enFull : wdMeta.arFull,
      weekIndex,
      month: m,
      year: y,
      sessionsCount,
      present,
      late,
      attended,
      absentCharged,
      absentExcused,
      absentTotal,
      totalExpected,
      attendanceRate,
      absenceRate,
      intensityBand,
      isHighAbsence,
      isToday: dateKey === todayStr,
      isFuture: dateKey > todayStr,
    });

    dayOffset += 1;
  }

  // 5. Deduplicate close month ticks (prevent XAxis overlap when rolling window starts near month end)
  const monthTicks: HeatmapMonthTick[] = [];
  for (let i = 0; i < monthFirstWeekCandidates.length; i++) {
    const curr = monthFirstWeekCandidates[i];
    const next = monthFirstWeekCandidates[i + 1];
    if (i === 0 && next && next.weekIndex - curr.weekIndex < 2) {
      continue;
    }
    if (
      monthTicks.length > 0 &&
      curr.weekIndex - monthTicks[monthTicks.length - 1].weekIndex < 2
    ) {
      continue;
    }
    monthTicks.push(curr);
  }

  // 6. Finalize Monthly Seasonality Array
  const monthlySeasonality: HeatmapSeasonalMonthStat[] = [];
  monthAccumulators.forEach((acc, key) => {
    const hasData = acc.totalExpected > 0;
    const attendanceRate = hasData
      ? Math.round((acc.attended / acc.totalExpected) * 100)
      : 0;
    const absenceRate = hasData
      ? Math.round((acc.absentTotal / acc.totalExpected) * 100)
      : 0;
    const monthFull = getMonthFullName(acc.month, isEn);
    const monthShort = getMonthShortName(acc.month, isEn);

    monthlySeasonality.push({
      key,
      month: acc.month,
      year: acc.year,
      label:
        resolvedWindowMode === 'rolling_365'
          ? `${monthShort} ${String(acc.year).slice(-2)}`
          : monthFull,
      shortLabel: monthShort,
      activeDaysCount: acc.activeDaysCount,
      highAbsenceDaysCount: acc.highAbsenceDaysCount,
      sessionsCount: acc.sessionsCount,
      attended: acc.attended,
      absentTotal: acc.absentTotal,
      absentCharged: acc.absentCharged,
      absentExcused: acc.absentExcused,
      totalExpected: acc.totalExpected,
      attendanceRate,
      absenceRate,
      hasData,
    });
  });

  // Consolidate rolling_365 if 13 partial month keys exist (keep chronological order, max 12 most recent if >12)
  const displayedSeasonality =
    monthlySeasonality.length > 12
      ? monthlySeasonality.slice(monthlySeasonality.length - 12)
      : monthlySeasonality;

  let worstSeasonalMonth: HeatmapSeasonalMonthStat | null = null;
  let bestSeasonalMonth: HeatmapSeasonalMonthStat | null = null;

  for (const mStat of displayedSeasonality) {
    if (!mStat.hasData) continue;
    if (
      !worstSeasonalMonth ||
      mStat.absenceRate > worstSeasonalMonth.absenceRate ||
      (mStat.absenceRate === worstSeasonalMonth.absenceRate &&
        mStat.absentTotal > worstSeasonalMonth.absentTotal)
    ) {
      worstSeasonalMonth = mStat;
    }
    if (
      !bestSeasonalMonth ||
      mStat.attendanceRate > bestSeasonalMonth.attendanceRate ||
      (mStat.attendanceRate === bestSeasonalMonth.attendanceRate &&
        mStat.attended > bestSeasonalMonth.attended)
    ) {
      bestSeasonalMonth = mStat;
    }
  }

  // 7. Finalize Weekday Patterns
  const weekdayPatterns: HeatmapWeekdayStat[] = weekdayAccumulators.map((wd) => ({
    weekdayRow: wd.weekdayRow,
    shortLabel: wd.shortLabel,
    fullLabel: wd.fullLabel,
    activeDaysCount: wd.activeDaysCount,
    highAbsenceDaysCount: wd.highAbsenceDaysCount,
    attended: wd.attended,
    absentTotal: wd.absentTotal,
    totalExpected: wd.totalExpected,
    attendanceRate:
      wd.totalExpected > 0 ? Math.round((wd.attended / wd.totalExpected) * 100) : null,
    absenceRate:
      wd.totalExpected > 0 ? Math.round((wd.absentTotal / wd.totalExpected) * 100) : null,
  }));

  let highestAbsenceWeekday: HeatmapWeekdayStat | null = null;
  for (const wd of weekdayPatterns) {
    if (wd.absenceRate === null || wd.absenceRate <= 0) continue;
    if (
      !highestAbsenceWeekday ||
      wd.absenceRate > (highestAbsenceWeekday.absenceRate ?? 0) ||
      (wd.absenceRate === highestAbsenceWeekday.absenceRate &&
        wd.absentTotal > highestAbsenceWeekday.absentTotal)
    ) {
      highestAbsenceWeekday = wd;
    }
  }

  // 8. High-Absence Days Alert List (sorted by absenceRate desc, then absentTotal desc, then date desc)
  const highAbsenceDays = cells
    .filter((c) => c.isHighAbsence)
    .sort((a, b) => {
      const rateDiff = (b.absenceRate ?? 0) - (a.absenceRate ?? 0);
      if (rateDiff !== 0) return rateDiff;
      if (b.absentTotal !== a.absentTotal) return b.absentTotal - a.absentTotal;
      return b.dateKey.localeCompare(a.dateKey);
    });

  const overallAttendanceRate =
    totalExpectedAll > 0 ? Math.round((totalAttended / totalExpectedAll) * 100) : 0;
  const overallAbsenceRate =
    totalExpectedAll > 0 ? Math.round((totalAbsent / totalExpectedAll) * 100) : 0;

  return {
    cells,
    maxWeekIndex,
    monthTicks,
    weekdayLabels: WEEKDAY_META.map((meta) => ({
      row: meta.row,
      shortLabel: isEn ? meta.enShort : meta.arShort,
      fullLabel: isEn ? meta.enFull : meta.arFull,
    })),
    monthlySeasonality: displayedSeasonality,
    weekdayPatterns,
    highAbsenceDays,
    summary: {
      totalCalendarDays: cells.length,
      activeSessionDays,
      highAbsenceDaysCount,
      moderateDipDaysCount,
      steadyOrOptimalDaysCount,
      zeroAbsenceDaysCount,
      overallAttendanceRate,
      overallAbsenceRate,
      totalSessions,
      totalAttended,
      totalAbsent,
      totalAbsentCharged,
      totalAbsentExcused,
      totalExpected: totalExpectedAll,
      worstSeasonalMonth:
        worstSeasonalMonth && worstSeasonalMonth.absenceRate > 0 ? worstSeasonalMonth : null,
      bestSeasonalMonth,
      highestAbsenceWeekday,
    },
    rangeStartStr,
    rangeEndStr,
  };
}
