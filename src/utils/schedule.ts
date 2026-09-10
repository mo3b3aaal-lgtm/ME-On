import { Group, Student, Enrollment } from '../types';

export interface ScheduledClassItem {
  id: string;
  studentId: string;
  studentName: string;
  student?: Student;
  groupId: string;
  groupName: string;
  group?: Group;
  enrollmentId?: string;
  isPrivate: boolean;
  subject: string;
  dayName: string;
  time: string; // Formatted display e.g. "5:00 PM" / "05:00 م"
  rawTime: string; // e.g. "17:00"
  sortMinutes: number; // For chronological sorting
  location?: string;
  accentColor: string;
}

const DAY_MAP_ARABIC: Record<number, string> = {
  0: 'الأحد',
  1: 'الاثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
};

const DAY_NORMALIZATION_MAP: Record<string, number> = {
  'الأحد': 0,
  'الاحد': 0,
  'sunday': 0,
  'sun': 0,
  'الاثنين': 1,
  'الإثنين': 1,
  'monday': 1,
  'mon': 1,
  'الثلاثاء': 2,
  'tuesday': 2,
  'tue': 2,
  'الأربعاء': 3,
  'الاربعاء': 3,
  'wednesday': 3,
  'wed': 3,
  'الخميس': 4,
  'thursday': 4,
  'thu': 4,
  'الجمعة': 5,
  'friday': 5,
  'fri': 5,
  'السبت': 6,
  'saturday': 6,
  'sat': 6,
};

/**
 * Normalizes day name to weekday index (0 for Sunday .. 6 for Saturday)
 */
export function getWeekdayIndex(dayName: string): number | null {
  if (!dayName) return null;
  const clean = dayName.trim().toLowerCase();
  if (clean in DAY_NORMALIZATION_MAP) {
    return DAY_NORMALIZATION_MAP[clean];
  }
  for (const [key, idx] of Object.entries(DAY_NORMALIZATION_MAP)) {
    if (clean.includes(key) || key.includes(clean)) {
      return idx;
    }
  }
  return null;
}

/**
 * Get Arabic day name from a Date or ISO string
 */
export function getArabicDayForDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'السبت';
  const dayIndex = d.getDay();
  return DAY_MAP_ARABIC[dayIndex] || 'السبت';
}

/**
 * Parse time string (e.g. "17:00", "5:00 PM", "05:00 م", "7:30 AM") to minutes from midnight
 */
export function parseTimeToMinutes(timeStr?: string): number {
  if (!timeStr || !timeStr.trim()) return 99999;
  const str = timeStr.trim();

  // Check 24-hour format "HH:MM"
  const match24 = str.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const mins = parseInt(match24[2], 10);
    return hours * 60 + mins;
  }

  // Check 12-hour format "H:MM AM/PM" or Arabic "H:MM ص/م"
  const isPM = /pm|م/i.test(str);
  const isAM = /am|ص/i.test(str);
  const match12 = str.match(/(\d{1,2}):(\d{2})/);

  if (match12) {
    let hours = parseInt(match12[1], 10);
    const mins = parseInt(match12[2], 10);
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    return hours * 60 + mins;
  }

  // Try extracting just hours
  const matchSingle = str.match(/(\d{1,2})/);
  if (matchSingle) {
    let hours = parseInt(matchSingle[1], 10);
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    return hours * 60;
  }

  return 99999;
}

/**
 * Format a 24-hour "HH:MM" or arbitrary time string into a clean, localized display format
 */
export function formatTimeDisplay(timeStr?: string, isRTL: boolean = true): string {
  if (!timeStr || !timeStr.trim()) {
    return isRTL ? 'وقت مرن' : 'Flexible Time';
  }

  const mins = parseTimeToMinutes(timeStr);
  if (mins === 99999) return timeStr;

  const totalHours = Math.floor(mins / 60);
  const totalMins = mins % 60;
  const isPM = totalHours >= 12;
  const displayHours = totalHours % 12 === 0 ? 12 : totalHours % 12;
  const displayMins = totalMins < 10 ? `0${totalMins}` : `${totalMins}`;

  if (isRTL) {
    const suffix = isPM ? 'م' : 'ص';
    return `${displayHours}:${displayMins} ${suffix}`;
  } else {
    const suffix = isPM ? 'PM' : 'AM';
    return `${displayHours}:${displayMins} ${suffix}`;
  }
}

/**
 * Given a Group and a day name, find the scheduled time for that day
 */
export function getTimeForDayInGroup(group: Group, dayName: string): string {
  if (group.scheduleTimes && typeof group.scheduleTimes === 'object') {
    // 1. Direct match
    if (group.scheduleTimes[dayName]) {
      return group.scheduleTimes[dayName];
    }
    // 2. Normalized match
    const targetIdx = getWeekdayIndex(dayName);
    for (const [key, val] of Object.entries(group.scheduleTimes)) {
      if (val && getWeekdayIndex(key) === targetIdx) {
        return val;
      }
    }
  }
  return group.scheduleTime || '';
}

/**
 * Find all scheduled student classes for a given date, sorted chronologically
 */
export function getScheduledClassesForDate(
  dateInput: Date | string,
  groups: Group[],
  students: Student[],
  enrollments: Enrollment[],
  isRTL: boolean = true
): ScheduledClassItem[] {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return [];

  const targetDayIdx = d.getDay();
  const arabicDayName = DAY_MAP_ARABIC[targetDayIdx];
  const activeStudentsMap = new Map<string, Student>();
  students.forEach((s) => {
    if (s.status !== 'archived') {
      activeStudentsMap.set(s.id, s);
    }
  });

  const studentEnrollmentsByGroup = new Map<string, Enrollment[]>();
  enrollments.forEach((enr) => {
    if (enr.status !== 'stopped') {
      const list = studentEnrollmentsByGroup.get(enr.groupId) || [];
      list.push(enr);
      studentEnrollmentsByGroup.set(enr.groupId, list);
    }
  });

  const scheduledItems: ScheduledClassItem[] = [];

  for (const group of groups) {
    if (!group.scheduleDays || !Array.isArray(group.scheduleDays)) continue;

    // Check if group meets on this day
    const meetsToday = group.scheduleDays.some((dayStr) => {
      const idx = getWeekdayIndex(dayStr);
      return idx === targetDayIdx;
    });

    if (!meetsToday) continue;

    const rawTime = getTimeForDayInGroup(group, arabicDayName);
    const sortMinutes = parseTimeToMinutes(rawTime);
    const formattedTime = formatTimeDisplay(rawTime, isRTL);
    const isPrivate = group.type === 'private';
    const groupEnrollments = studentEnrollmentsByGroup.get(group.id) || [];

    if (groupEnrollments.length > 0) {
      for (const enr of groupEnrollments) {
        const stu = activeStudentsMap.get(enr.studentId);
        if (!stu) continue;

        // Check if enrollment has custom time override
        const enrRawTime = enr.scheduleTimes?.[arabicDayName] || enr.scheduleTime || rawTime;
        const enrSortMinutes = parseTimeToMinutes(enrRawTime);
        const enrFormattedTime = formatTimeDisplay(enrRawTime, isRTL);

        scheduledItems.push({
          id: `sched_${group.id}_${stu.id}_${targetDayIdx}`,
          studentId: stu.id,
          studentName: stu.name,
          student: stu,
          groupId: group.id,
          groupName: group.name,
          group: group,
          enrollmentId: enr.id,
          isPrivate,
          subject: group.subject || (isPrivate ? 'درس خاص' : 'مجموعة'),
          dayName: arabicDayName,
          time: enrFormattedTime,
          rawTime: enrRawTime,
          sortMinutes: enrSortMinutes !== 99999 ? enrSortMinutes : sortMinutes,
          location: group.roomOrLocation,
          accentColor: group.accentColor || (isPrivate ? '#D49B4B' : '#748C70'),
        });
      }
    } else {
      // Group scheduled with no students yet, still show on schedule
      scheduledItems.push({
        id: `sched_grp_${group.id}_${targetDayIdx}`,
        studentId: '',
        studentName: isPrivate ? group.name : `${group.name} (المجموعة)`,
        groupId: group.id,
        groupName: group.name,
        group: group,
        isPrivate,
        subject: group.subject,
        dayName: arabicDayName,
        time: formattedTime,
        rawTime,
        sortMinutes,
        location: group.roomOrLocation,
        accentColor: group.accentColor || (isPrivate ? '#D49B4B' : '#748C70'),
      });
    }
  }

  // Sort chronologically by time
  scheduledItems.sort((a, b) => {
    if (a.sortMinutes !== b.sortMinutes) {
      return a.sortMinutes - b.sortMinutes;
    }
    return a.studentName.localeCompare(b.studentName);
  });

  return scheduledItems;
}

export interface UpcomingStudentClass {
  id: string;
  dateStr: string; // YYYY-MM-DD
  dayName: string;
  dayRelative: string; // "اليوم", "غداً", etc.
  time: string;
  rawTime: string;
  groupId: string;
  groupName: string;
  isPrivate: boolean;
  subject: string;
  location?: string;
  accentColor: string;
}

/**
 * Get upcoming scheduled classes for a specific student for the next 7 days
 */
export function getUpcomingClassesForStudent(
  studentId: string,
  groups: Group[],
  enrollments: Enrollment[],
  limit: number = 5,
  isRTL: boolean = true
): UpcomingStudentClass[] {
  if (!studentId) return [];

  const studentEnrollments = enrollments.filter(
    (e) => e.studentId === studentId && e.status !== 'stopped'
  );
  if (studentEnrollments.length === 0) return [];

  const groupsMap = new Map<string, Group>();
  groups.forEach((g) => groupsMap.set(g.id, g));

  const upcoming: UpcomingStudentClass[] = [];
  const today = new Date();

  // Scan next 14 days
  for (let offset = 0; offset < 14; offset++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + offset);
    const dayIdx = targetDate.getDay();
    const arabicDayName = DAY_MAP_ARABIC[dayIdx];
    const dateStr = targetDate.toISOString().split('T')[0];

    const dayRelative =
      offset === 0
        ? (isRTL ? 'اليوم' : 'Today')
        : offset === 1
        ? (isRTL ? 'غداً' : 'Tomorrow')
        : arabicDayName;

    for (const enr of studentEnrollments) {
      const group = groupsMap.get(enr.groupId);
      if (!group || !group.scheduleDays || !Array.isArray(group.scheduleDays)) continue;

      const meetsOnDay = group.scheduleDays.some((dayStr) => {
        return getWeekdayIndex(dayStr) === dayIdx;
      });

      if (!meetsOnDay) continue;

      const rawTime =
        enr.scheduleTimes?.[arabicDayName] ||
        enr.scheduleTime ||
        getTimeForDayInGroup(group, arabicDayName);
      const formattedTime = formatTimeDisplay(rawTime, isRTL);
      const isPrivate = group.type === 'private';

      upcoming.push({
        id: `up_${enr.id}_${dateStr}`,
        dateStr,
        dayName: arabicDayName,
        dayRelative,
        time: formattedTime,
        rawTime,
        groupId: group.id,
        groupName: group.name,
        isPrivate,
        subject: group.subject || (isPrivate ? 'درس خاص' : 'مجموعة'),
        location: group.roomOrLocation,
        accentColor: group.accentColor || (isPrivate ? '#D49B4B' : '#748C70'),
      });
    }

    if (upcoming.length >= limit * 2) break;
  }

  return upcoming.slice(0, limit);
}
