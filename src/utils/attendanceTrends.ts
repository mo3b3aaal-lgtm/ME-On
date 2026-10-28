import {
  Attendance,
  Enrollment,
  Group,
  ReportPeriodFilter,
  Session,
  Student,
} from '../types';
import { parseLocalDateStr, toLocalISODate } from './localDate';
import { isEnrollmentActiveOnDate } from './schedule';

export type AttendanceMetricMode = 'rate' | 'counts' | 'all';
export type AttendanceTimeGrouping = 'session' | 'weekly' | 'monthly';
export type ConsistencyBand = 'consistent' | 'moderate' | 'at_risk';

export interface AttendanceTrendPoint {
  id: string;
  dateKey: string;
  displayLabel: string;
  fullDateLabel: string;
  attended: number; // present + late
  present: number;
  late: number;
  absentCharged: number;
  absentExcused: number;
  absentTotal: number;
  totalExpected: number;
  rate: number; // 0 - 100
  rollingAvgRate: number; // 3-point trailing moving average (0 - 100)
  sessionsCount: number;
}

export interface StudentConsistencyRow {
  studentId: string;
  studentName: string;
  attended: number;
  present: number;
  late: number;
  absentCharged: number;
  absentExcused: number;
  absentTotal: number;
  totalExpected: number;
  rate: number;
  currentStreak: number;
  consistencyBand: ConsistencyBand;
}

export interface AttendanceConsistencySummary {
  overallRate: number;
  meanBucketRate: number;
  consistentBucketsCount: number;
  totalBucketsCount: number;
  consistentBucketsRatio: number;
  currentStreak: number;
  longestStreak: number;
  rateStdDev: number;
  stabilityBand: ConsistencyBand;
  totalAttended: number;
  totalPresent: number;
  totalLate: number;
  totalAbsent: number;
  totalAbsentCharged: number;
  totalAbsentExcused: number;
  totalExpected: number;
  peakRate: number;
  peakDate: string;
  lowestRate: number;
  lowestDate: string;
  trendDelta: number;
}

export interface BuildAttendanceTrendsOptions {
  sessions: Session[];
  allAttendance: Attendance[];
  students?: Student[];
  groups?: Group[];
  enrollments?: Enrollment[];
  selectedGroupId?: string;
  selectedStudentId?: string;
  serviceTypeFilter?: 'all' | 'group' | 'private';
  periodFilter?: ReportPeriodFilter;
  todayStr: string;
  currentMonth: number;
  currentYear: number;
  selectedSpecificMonth?: number;
  selectedSpecificYear?: number;
  customStartDate?: string;
  customEndDate?: string;
  timeGrouping: AttendanceTimeGrouping;
  isEn: boolean;
}

export interface AttendanceTrendsAnalyticsResult {
  points: AttendanceTrendPoint[];
  summary: AttendanceConsistencySummary;
  studentRows: StudentConsistencyRow[];
}

const ARABIC_MONTH_NAMES = [
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

const ENGLISH_SHORT_MONTHS = [
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

function getMonthLabel(month1to12: number, isEn: boolean): string {
  if (month1to12 >= 1 && month1to12 <= 12) {
    return isEn ? ENGLISH_SHORT_MONTHS[month1to12 - 1] : ARABIC_MONTH_NAMES[month1to12 - 1];
  }
  return isEn ? `M${month1to12}` : `شهر ${month1to12}`;
}

function getSaturdayWeekStartStr(dateStr: string): string {
  const d = parseLocalDateStr(dateStr);
  const dayOfWeek = d.getDay(); // 0=Sun .. 6=Sat
  const offsetToSaturday = (dayOfWeek + 1) % 7;
  const startOfWeek = new Date(d.getFullYear(), d.getMonth(), d.getDate() - offsetToSaturday);
  return toLocalISODate(startOfWeek);
}

function classifyAttendanceCounts(records: Attendance[]) {
  let present = 0;
  let late = 0;
  let absentCharged = 0;
  let absentExcused = 0;

  for (const a of records) {
    if (a.status === 'present') {
      present += 1;
    } else if (a.status === 'late') {
      late += 1;
    } else if (
      a.status === 'absent_charged' ||
      (a.status === 'absent' && a.isCharged !== false)
    ) {
      absentCharged += 1;
    } else if (
      a.status === 'absent_free' ||
      a.status === 'excused' ||
      (a.status === 'absent' && a.isCharged === false)
    ) {
      absentExcused += 1;
    }
  }

  const attended = present + late;
  const absentTotal = absentCharged + absentExcused;
  const totalExpected = attended + absentTotal;
  const rate = totalExpected > 0 ? Math.round((attended / totalExpected) * 100) : 0;

  return {
    present,
    late,
    attended,
    absentCharged,
    absentExcused,
    absentTotal,
    totalExpected,
    rate,
  };
}

function getConsistencyBand(rate: number): ConsistencyBand {
  if (rate >= 85) return 'consistent';
  if (rate >= 70) return 'moderate';
  return 'at_risk';
}

export function buildAttendanceTrendsAnalytics(
  options: BuildAttendanceTrendsOptions
): AttendanceTrendsAnalyticsResult {
  const {
    sessions,
    allAttendance,
    students = [],
    groups = [],
    enrollments = [],
    selectedGroupId,
    selectedStudentId,
    serviceTypeFilter = 'all',
    periodFilter = 'this_month',
    todayStr,
    currentMonth,
    currentYear,
    selectedSpecificMonth,
    selectedSpecificYear,
    customStartDate,
    customEndDate,
    timeGrouping,
    isEn,
  } = options;

  const groupsById = new Map<string, Group>();
  for (const g of groups) {
    groupsById.set(g.id, g);
  }

  const studentsById = new Map<string, Student>();
  for (const st of students) {
    studentsById.set(st.id, st);
  }

  const todayDate = parseLocalDateStr(todayStr);
  const d7Date = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - 7);
  const d7Str = toLocalISODate(d7Date);

  const weekStartStr = getSaturdayWeekStartStr(todayStr);
  const weekStartDate = parseLocalDateStr(weekStartStr);
  const weekEndDate = new Date(
    weekStartDate.getFullYear(),
    weekStartDate.getMonth(),
    weekStartDate.getDate() + 6
  );
  const weekEndStr = toLocalISODate(weekEndDate);

  const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const targetGroupId =
    selectedGroupId && selectedGroupId !== 'all' ? selectedGroupId : undefined;
  const targetStudentId =
    selectedStudentId && selectedStudentId !== 'all' ? selectedStudentId : undefined;

  // Map student enrollments by groupId when filtering by student
  const studentEnrollments = targetStudentId
    ? enrollments.filter((e) => e.studentId === targetStudentId && e.status !== 'stopped')
    : [];
  const targetStudentObj = targetStudentId ? studentsById.get(targetStudentId) ?? null : null;

  // Pre-index sessions where targetStudentId has explicit attendance
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

  // 1. Filter sessions by status, serviceType, group, student, and timeframe
  const relevantSessions = sessions.filter((s) => {
    if (s.status === 'cancelled') return false;

    if (serviceTypeFilter === 'private' && !isPrivateSession(s)) return false;
    if (serviceTypeFilter === 'group' && isPrivateSession(s)) return false;

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

    if (periodFilter === 'all_time') return true;
    if (periodFilter === 'today') return s.date === todayStr;
    if (periodFilter === 'last_7_days') return s.date >= d7Str && s.date <= todayStr;
    if (periodFilter === 'this_week') return s.date >= weekStartStr && s.date <= weekEndStr;
    if (periodFilter === 'this_month') {
      return s.month === currentMonth && s.year === currentYear;
    }
    if (periodFilter === 'last_month') {
      return s.month === lastMonth && s.year === lastMonthYear;
    }
    if (periodFilter === 'specific_month') {
      const specM = selectedSpecificMonth ?? currentMonth;
      const specY = selectedSpecificYear ?? currentYear;
      return s.month === specM && s.year === specY;
    }
    if (periodFilter === 'custom_range') {
      if (customStartDate && s.date < customStartDate) return false;
      if (customEndDate && s.date > customEndDate) return false;
      return true;
    }

    return true;
  });

  const relevantSessionIds = new Set(relevantSessions.map((s) => s.id));
  const sessionsById = new Map<string, Session>();
  for (const s of relevantSessions) {
    sessionsById.set(s.id, s);
  }

  // 2. Filter attendance records for those sessions
  const relevantAttendance = allAttendance.filter((a) => {
    if (!relevantSessionIds.has(a.sessionId)) return false;
    if (targetStudentId && a.studentId !== targetStudentId) return false;
    return true;
  });

  const attendanceBySession = new Map<string, Attendance[]>();
  for (const att of relevantAttendance) {
    const existing = attendanceBySession.get(att.sessionId);
    if (existing) {
      existing.push(att);
    } else {
      attendanceBySession.set(att.sessionId, [att]);
    }
  }

  // Sort sessions chronologically ascending
  const sortedSessions = [...relevantSessions].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.startTime || '').localeCompare(b.startTime || '');
  });

  // 3. Bucket sessions that have recorded attendance
  const rawPoints: Omit<AttendanceTrendPoint, 'rollingAvgRate'>[] = [];

  if (timeGrouping === 'monthly') {
    const monthlyBuckets = new Map<string, { sessionsCount: number; attendance: Attendance[] }>();

    for (const ses of sortedSessions) {
      const atts = attendanceBySession.get(ses.id);
      if (!atts || atts.length === 0) continue;

      const key = `${ses.year}-${String(ses.month).padStart(2, '0')}`;
      const bucket = monthlyBuckets.get(key) || { sessionsCount: 0, attendance: [] };
      bucket.sessionsCount += 1;
      bucket.attendance.push(...atts);
      monthlyBuckets.set(key, bucket);
    }

    monthlyBuckets.forEach((bucket, key) => {
      const counts = classifyAttendanceCounts(bucket.attendance);
      if (counts.totalExpected === 0) return;

      const [yStr, mStr] = key.split('-');
      const m = Number(mStr);
      const monthName = getMonthLabel(m, isEn);

      rawPoints.push({
        id: `point_month_${key}`,
        dateKey: key,
        displayLabel: `${monthName} ${yStr}`,
        fullDateLabel: `${monthName} ${yStr}`,
        attended: counts.attended,
        present: counts.present,
        late: counts.late,
        absentCharged: counts.absentCharged,
        absentExcused: counts.absentExcused,
        absentTotal: counts.absentTotal,
        totalExpected: counts.totalExpected,
        rate: counts.rate,
        sessionsCount: bucket.sessionsCount,
      });
    });
  } else if (timeGrouping === 'weekly') {
    const weeklyBuckets = new Map<string, { sessionsCount: number; attendance: Attendance[] }>();

    for (const ses of sortedSessions) {
      const atts = attendanceBySession.get(ses.id);
      if (!atts || atts.length === 0) continue;

      const key = getSaturdayWeekStartStr(ses.date);
      const bucket = weeklyBuckets.get(key) || { sessionsCount: 0, attendance: [] };
      bucket.sessionsCount += 1;
      bucket.attendance.push(...atts);
      weeklyBuckets.set(key, bucket);
    }

    weeklyBuckets.forEach((bucket, key) => {
      const counts = classifyAttendanceCounts(bucket.attendance);
      if (counts.totalExpected === 0) return;

      const dateObj = parseLocalDateStr(key);
      const dayNum = dateObj.getDate();
      const mNum = dateObj.getMonth() + 1;
      const monthShort = getMonthLabel(mNum, isEn);

      rawPoints.push({
        id: `point_week_${key}`,
        dateKey: key,
        displayLabel: `${dayNum} ${monthShort}`,
        fullDateLabel: isEn ? `Week of ${dayNum} ${monthShort} (${key})` : `أسبوع ${dayNum} ${monthShort} (${key})`,
        attended: counts.attended,
        present: counts.present,
        late: counts.late,
        absentCharged: counts.absentCharged,
        absentExcused: counts.absentExcused,
        absentTotal: counts.absentTotal,
        totalExpected: counts.totalExpected,
        rate: counts.rate,
        sessionsCount: bucket.sessionsCount,
      });
    });
  } else {
    const dailyBuckets = new Map<string, { sessionsCount: number; attendance: Attendance[] }>();

    for (const ses of sortedSessions) {
      const atts = attendanceBySession.get(ses.id);
      if (!atts || atts.length === 0) continue;

      const key = ses.date;
      const bucket = dailyBuckets.get(key) || { sessionsCount: 0, attendance: [] };
      bucket.sessionsCount += 1;
      bucket.attendance.push(...atts);
      dailyBuckets.set(key, bucket);
    }

    dailyBuckets.forEach((bucket, key) => {
      const counts = classifyAttendanceCounts(bucket.attendance);
      if (counts.totalExpected === 0) return;

      const parts = key.split('-');
      const mNum = Number(parts[1]);
      const dNum = Number(parts[2]);
      const monthShort = getMonthLabel(mNum, isEn);

      rawPoints.push({
        id: `point_day_${key}`,
        dateKey: key,
        displayLabel: `${dNum} ${monthShort}`,
        fullDateLabel: `${dNum} ${monthShort} ${parts[0]}`,
        attended: counts.attended,
        present: counts.present,
        late: counts.late,
        absentCharged: counts.absentCharged,
        absentExcused: counts.absentExcused,
        absentTotal: counts.absentTotal,
        totalExpected: counts.totalExpected,
        rate: counts.rate,
        sessionsCount: bucket.sessionsCount,
      });
    });
  }

  rawPoints.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  // 4. Attach 3-point trailing rolling average for consistency line visualization
  const points: AttendanceTrendPoint[] = rawPoints.map((pt, idx) => {
    const windowStart = Math.max(0, idx - 2);
    const windowSlice = rawPoints.slice(windowStart, idx + 1);
    const avg = Math.round(
      windowSlice.reduce((sum, item) => sum + item.rate, 0) / windowSlice.length
    );
    return {
      ...pt,
      rollingAvgRate: avg,
    };
  });

  // 5. Build Per-Student Consistency Rows (chronologically ordered per student for streak calculation)
  const attendanceByStudent = new Map<string, { date: string; startTime: string; record: Attendance }[]>();
  for (const att of relevantAttendance) {
    const ses = sessionsById.get(att.sessionId);
    if (!ses) continue;
    const list = attendanceByStudent.get(att.studentId) || [];
    list.push({ date: ses.date, startTime: ses.startTime || '', record: att });
    attendanceByStudent.set(att.studentId, list);
  }

  const studentRows: StudentConsistencyRow[] = [];
  attendanceByStudent.forEach((entries, studentId) => {
    entries.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });

    const records = entries.map((e) => e.record);
    const counts = classifyAttendanceCounts(records);
    if (counts.totalExpected === 0) return;

    let streak = 0;
    for (let i = entries.length - 1; i >= 0; i--) {
      const st = entries[i].record.status;
      if (st === 'present' || st === 'late') {
        streak += 1;
      } else {
        break;
      }
    }

    const stEntity = studentsById.get(studentId);
    const studentName = stEntity?.name || (isEn ? 'Student' : 'طالب');

    studentRows.push({
      studentId,
      studentName,
      attended: counts.attended,
      present: counts.present,
      late: counts.late,
      absentCharged: counts.absentCharged,
      absentExcused: counts.absentExcused,
      absentTotal: counts.absentTotal,
      totalExpected: counts.totalExpected,
      rate: counts.rate,
      currentStreak: streak,
      consistencyBand: getConsistencyBand(counts.rate),
    });
  });

  // Sort student rows: lowest rate first so teachers spot follow-ups immediately, then by totalExpected desc
  studentRows.sort((a, b) => {
    if (a.rate !== b.rate) return a.rate - b.rate;
    return b.totalExpected - a.totalExpected;
  });

  // 6. Compute Overall Consistency Summary
  if (points.length === 0) {
    return {
      points: [],
      studentRows,
      summary: {
        overallRate: 0,
        meanBucketRate: 0,
        consistentBucketsCount: 0,
        totalBucketsCount: 0,
        consistentBucketsRatio: 0,
        currentStreak: 0,
        longestStreak: 0,
        rateStdDev: 0,
        stabilityBand: 'consistent',
        totalAttended: 0,
        totalPresent: 0,
        totalLate: 0,
        totalAbsent: 0,
        totalAbsentCharged: 0,
        totalAbsentExcused: 0,
        totalExpected: 0,
        peakRate: 0,
        peakDate: '',
        lowestRate: 0,
        lowestDate: '',
        trendDelta: 0,
      },
    };
  }

  let sumBucketRates = 0;
  let consistentBucketsCount = 0;
  let totalAttended = 0;
  let totalPresent = 0;
  let totalLate = 0;
  let totalAbsent = 0;
  let totalAbsentCharged = 0;
  let totalAbsentExcused = 0;
  let totalExpected = 0;

  let peakRate = -1;
  let peakDate = '';
  let lowestRate = 101;
  let lowestDate = '';

  let runningStreak = 0;
  let longestStreak = 0;

  for (const pt of points) {
    sumBucketRates += pt.rate;
    if (pt.rate >= 85) {
      consistentBucketsCount += 1;
      runningStreak += 1;
      if (runningStreak > longestStreak) longestStreak = runningStreak;
    } else {
      runningStreak = 0;
    }

    totalAttended += pt.attended;
    totalPresent += pt.present;
    totalLate += pt.late;
    totalAbsent += pt.absentTotal;
    totalAbsentCharged += pt.absentCharged;
    totalAbsentExcused += pt.absentExcused;
    totalExpected += pt.totalExpected;

    if (pt.rate >= peakRate) {
      peakRate = pt.rate;
      peakDate = pt.displayLabel;
    }
    if (pt.rate <= lowestRate) {
      lowestRate = pt.rate;
      lowestDate = pt.displayLabel;
    }
  }

  let currentStreak = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].rate >= 85) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  // If scoped to a single student and student row exists, use exact lesson-level streak
  if (targetStudentId && studentRows.length === 1) {
    currentStreak = studentRows[0].currentStreak;
  }

  const totalBucketsCount = points.length;
  const meanBucketRate = Math.round(sumBucketRates / totalBucketsCount);
  const overallRate = totalExpected > 0 ? Math.round((totalAttended / totalExpected) * 100) : 0;
  const consistentBucketsRatio = Math.round((consistentBucketsCount / totalBucketsCount) * 100);

  const exactMean = sumBucketRates / totalBucketsCount;
  const variance =
    points.reduce((acc, pt) => acc + Math.pow(pt.rate - exactMean, 2), 0) / totalBucketsCount;
  const rateStdDev = Math.round(Math.sqrt(variance) * 10) / 10;

  let trendDelta = 0;
  if (points.length >= 2) {
    trendDelta = points[points.length - 1].rate - points[points.length - 2].rate;
  }

  const stabilityBand: ConsistencyBand =
    overallRate >= 85 && consistentBucketsRatio >= 75
      ? 'consistent'
      : overallRate >= 70
      ? 'moderate'
      : 'at_risk';

  return {
    points,
    studentRows,
    summary: {
      overallRate,
      meanBucketRate,
      consistentBucketsCount,
      totalBucketsCount,
      consistentBucketsRatio,
      currentStreak,
      longestStreak,
      rateStdDev,
      stabilityBand,
      totalAttended,
      totalPresent,
      totalLate,
      totalAbsent,
      totalAbsentCharged,
      totalAbsentExcused,
      totalExpected,
      peakRate: peakRate < 0 ? 0 : peakRate,
      peakDate,
      lowestRate: lowestRate > 100 ? 0 : lowestRate,
      lowestDate,
      trendDelta,
    },
  };
}
