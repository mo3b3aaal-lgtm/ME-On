import { Group, Student, Enrollment, Session, SessionStatus } from '../types';

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
 * Normalize an arbitrary time representation (string or string[]) into a deduplicated, chronologically sorted array of time strings
 */
export function normalizeScheduleTimesList(val: any): string[] {
  if (!val) return [];
  let rawList: string[] = [];
  if (Array.isArray(val)) {
    rawList = val.filter((t) => typeof t === 'string' && t.trim().length > 0);
  } else if (typeof val === 'string' && val.trim().length > 0) {
    rawList = [val.trim()];
  }

  // Deduplicate and filter empty
  const uniqueTimes = Array.from(new Set(rawList.map((t) => t.trim())));
  
  // Sort chronologically
  uniqueTimes.sort((a, b) => {
    const minsA = parseTimeToMinutes(a);
    const minsB = parseTimeToMinutes(b);
    return minsA - minsB;
  });

  return uniqueTimes;
}

/**
 * Given a Group and a day name, find all scheduled times for that day (chronologically sorted)
 */
export function getTimesForDayInGroup(group: Group, dayName: string): string[] {
  if (group.scheduleTimes && typeof group.scheduleTimes === 'object') {
    // 1. Direct match
    if (group.scheduleTimes[dayName]) {
      const times = normalizeScheduleTimesList(group.scheduleTimes[dayName]);
      if (times.length > 0) return times;
    }
    // 2. Normalized match
    const targetIdx = getWeekdayIndex(dayName);
    for (const [key, val] of Object.entries(group.scheduleTimes)) {
      if (val && getWeekdayIndex(key) === targetIdx) {
        const times = normalizeScheduleTimesList(val);
        if (times.length > 0) return times;
      }
    }
  }
  return group.scheduleTime && group.scheduleTime.trim() ? [group.scheduleTime.trim()] : [];
}

/**
 * Given a Group and a day name, find the primary scheduled time for that day (backward compatibility)
 */
export function getTimeForDayInGroup(group: Group, dayName: string): string {
  const times = getTimesForDayInGroup(group, dayName);
  return times[0] || group.scheduleTime || '';
}

/**
 * Given an Enrollment, Group, and day name, find all scheduled times for that student's enrollment on that day
 */
export function getTimesForDayInEnrollment(
  enr: Enrollment,
  group: Group,
  dayName: string
): string[] {
  if (enr.scheduleTimes && typeof enr.scheduleTimes === 'object') {
    // 1. Direct match
    if (enr.scheduleTimes[dayName]) {
      const times = normalizeScheduleTimesList(enr.scheduleTimes[dayName]);
      if (times.length > 0) return times;
    }
    // 2. Normalized match
    const targetIdx = getWeekdayIndex(dayName);
    for (const [key, val] of Object.entries(enr.scheduleTimes)) {
      if (val && getWeekdayIndex(key) === targetIdx) {
        const times = normalizeScheduleTimesList(val);
        if (times.length > 0) return times;
      }
    }
  }

  if (enr.scheduleTime && enr.scheduleTime.trim()) {
    return [enr.scheduleTime.trim()];
  }

  return getTimesForDayInGroup(group, dayName);
}

/**
 * Format a comprehensive schedule summary (e.g. "السبت (04:00 م، 07:00 م)، الاثنين (05:00 م)")
 */
export function formatScheduleSummary(
  scheduleDays?: string[],
  scheduleTimes?: Record<string, string | string[]>,
  scheduleTime?: string,
  isRTL: boolean = true
): string {
  if (!scheduleDays || scheduleDays.length === 0) {
    return isRTL ? 'مرنة' : 'Flexible';
  }

  const parts = scheduleDays.map((day) => {
    let times: string[] = [];
    if (scheduleTimes && scheduleTimes[day]) {
      times = normalizeScheduleTimesList(scheduleTimes[day]);
    } else if (scheduleTimes) {
      const targetIdx = getWeekdayIndex(day);
      for (const [k, v] of Object.entries(scheduleTimes)) {
        if (v && getWeekdayIndex(k) === targetIdx) {
          times = normalizeScheduleTimesList(v);
          break;
        }
      }
    }

    if (times.length === 0 && scheduleTime && scheduleTime.trim()) {
      times = [scheduleTime.trim()];
    }

    if (times.length === 0) {
      return day;
    }

    const formattedTimes = times.map((t) => formatTimeDisplay(t, isRTL)).join(isRTL ? '، ' : ', ');
    return `${day} (${formattedTimes})`;
  });

  return parts.join(isRTL ? '، ' : ', ');
}

/**
 * Find all scheduled student classes for a given date, sorted chronologically.
 * Supports multiple classes for the same student on the same day.
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

    const isPrivate = group.type === 'private';
    const groupEnrollments = studentEnrollmentsByGroup.get(group.id) || [];

    if (isPrivate) {
      // Private lesson: Each private enrollment represents a private student
      if (groupEnrollments.length > 0) {
        for (const enr of groupEnrollments) {
          const stu = activeStudentsMap.get(enr.studentId);
          if (!stu) continue;

          const occurrenceTimes = getTimesForDayInEnrollment(enr, group, arabicDayName);
          const effectiveTimes = occurrenceTimes.length > 0 ? occurrenceTimes : [''];

          effectiveTimes.forEach((rawTime, timeIdx) => {
            const sortMinutes = parseTimeToMinutes(rawTime);
            const formattedTime = formatTimeDisplay(rawTime, isRTL);
            const cleanTimeKey = (rawTime || 'flex').replace(/[^a-zA-Z0-9]/g, '_');

            scheduledItems.push({
              id: `sched_priv_${group.id}_${stu.id}_${targetDayIdx}_${timeIdx}_${cleanTimeKey}`,
              studentId: stu.id,
              studentName: stu.name,
              student: stu,
              groupId: group.id,
              groupName: 'درس خاص',
              group: group,
              enrollmentId: enr.id,
              isPrivate: true,
              subject: group.subject || 'درس خاص',
              dayName: arabicDayName,
              time: formattedTime,
              rawTime,
              sortMinutes,
              location: group.roomOrLocation,
              accentColor: group.accentColor || '#FF647C',
            });
          });
        }
      }
    } else {
      // Real Group: Scheduled as ONE group class session
      const groupTimes = getTimesForDayInGroup(group, arabicDayName);
      const effectiveGroupTimes = groupTimes.length > 0 ? groupTimes : [''];

      effectiveGroupTimes.forEach((rawTime, timeIdx) => {
        const sortMinutes = parseTimeToMinutes(rawTime);
        const formattedTime = formatTimeDisplay(rawTime, isRTL);
        const cleanTimeKey = (rawTime || 'flex').replace(/[^a-zA-Z0-9]/g, '_');

        scheduledItems.push({
          id: `sched_grp_${group.id}_${targetDayIdx}_${timeIdx}_${cleanTimeKey}`,
          studentId: '',
          studentName: group.name,
          groupId: group.id,
          groupName: group.name,
          group: group,
          isPrivate: false,
          subject: group.subject || 'مجموعة دراسية',
          dayName: arabicDayName,
          time: formattedTime,
          rawTime,
          sortMinutes,
          location: group.roomOrLocation,
          accentColor: group.accentColor || '#7657F6',
        });
      });
    }
  }

  // Sort chronologically by time, then by student name
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
 * Get upcoming scheduled classes for a specific student for the next 7-14 days
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

      const rawTimes = getTimesForDayInEnrollment(enr, group, arabicDayName);
      const isPrivate = group.type === 'private';

      for (let tIdx = 0; tIdx < rawTimes.length; tIdx++) {
        const rawTime = rawTimes[tIdx];
        const formattedTime = formatTimeDisplay(rawTime, isRTL);
        const cleanKey = (rawTime || 'flex').replace(/[^a-zA-Z0-9]/g, '_');

        upcoming.push({
          id: `up_${enr.id}_${dateStr}_${tIdx}_${cleanKey}`,
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
          accentColor: group.accentColor || (isPrivate ? '#FF647C' : '#7657F6'),
        });
      }
    }

    if (upcoming.length >= limit * 2) break;
  }

  return upcoming.slice(0, limit);
}

// ==========================================
// MULTI-YEAR CALENDAR DOMAIN & ENGINE
// ==========================================

export const MONTH_NAMES_ARABIC = [
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

export const MONTH_NAMES_ENGLISH = [
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

export const CALENDAR_WEEKDAY_HEADERS_ARABIC = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
export const CALENDAR_WEEKDAY_SHORT_ARABIC = ['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];
export const CALENDAR_WEEKDAY_INITIALS_ARABIC = ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'];

export interface DayClassSummary {
  dateStr: string;
  totalCount: number;
  completedCount: number;
  scheduledCount: number;
  cancelledCount: number;
  hasRecordedSession: boolean;
}

export interface CalendarDayCell {
  dateStr: string; // 'YYYY-MM-DD'
  dayNumber: number; // 1..31
  monthIndex: number; // 0..11
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayOfWeek: number; // 0..6 (0=Sun, 6=Sat)
  colIndex: number; // 0..6 (0=Sat, 1=Sun, ..., 6=Fri)
  classCount: number;
  completedCount: number;
  scheduledCount: number;
  cancelledCount: number;
  hasClasses: boolean;
}

/**
 * Format Year, Month (0-11), and Day (1-31) into 'YYYY-MM-DD'
 */
export function formatDateKey(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Calculates fast class statistics for every date in a given year.
 * Integrates both explicit Session entities from DB and recurring group/private weekly schedules.
 * Historical dates (past) only show actual recorded sessions, while today/future integrate active recurring schedules.
 */
export function getYearClassStatsMap(
  year: number,
  sessions: Session[],
  groups: Group[],
  enrollments: Enrollment[],
  students: Student[]
): Map<string, DayClassSummary> {
  const statsMap = new Map<string, DayClassSummary>();
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Index explicit sessions for the year
  const sessionsByDate = new Map<string, Session[]>();
  for (const s of sessions) {
    if (!s.date) continue;
    // Check if session belongs to target year
    if (s.date.startsWith(`${year}-`) || s.year === year) {
      const list = sessionsByDate.get(s.date) || [];
      list.push(s);
      sessionsByDate.set(s.date, list);
    }
  }

  // 2. Pre-calculate active groups meeting days and recurring slots
  const activeStudentsMap = new Map<string, Student>();
  students.forEach((st) => {
    if (st.status !== 'archived') activeStudentsMap.set(st.id, st);
  });

  const activeEnrollmentsByGroup = new Map<string, Enrollment[]>();
  enrollments.forEach((enr) => {
    if (enr.status !== 'stopped') {
      const list = activeEnrollmentsByGroup.get(enr.groupId) || [];
      list.push(enr);
      activeEnrollmentsByGroup.set(enr.groupId, list);
    }
  });

  // Calculate recurring slots per weekday (0..6)
  interface RecurringSlotRef {
    groupId: string;
    studentId?: string;
    time: string;
  }
  const recurringSlotsByWeekday = new Map<number, RecurringSlotRef[]>();

  for (let weekday = 0; weekday < 7; weekday++) {
    const dayName = DAY_MAP_ARABIC[weekday];
    const slots: RecurringSlotRef[] = [];

    for (const group of groups) {
      if (!group.scheduleDays || !Array.isArray(group.scheduleDays)) continue;
      const meets = group.scheduleDays.some((d) => getWeekdayIndex(d) === weekday);
      if (!meets) continue;

      const groupEnrs = activeEnrollmentsByGroup.get(group.id) || [];
      if (groupEnrs.length > 0) {
        for (const enr of groupEnrs) {
          if (!activeStudentsMap.has(enr.studentId)) continue;
          const times = getTimesForDayInEnrollment(enr, group, dayName);
          const effectiveTimes = times.length > 0 ? times : [''];
          for (const t of effectiveTimes) {
            slots.push({
              groupId: group.id,
              studentId: enr.studentId,
              time: t,
            });
          }
        }
      } else {
        const times = getTimesForDayInGroup(group, dayName);
        const effectiveTimes = times.length > 0 ? times : [''];
        for (const t of effectiveTimes) {
          slots.push({
            groupId: group.id,
            time: t,
          });
        }
      }
    }
    recurringSlotsByWeekday.set(weekday, slots);
  }

  // 3. Populate stats for every day in the target year
  for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDateKey(year, monthIdx, day);
      const dateObj = new Date(year, monthIdx, day);
      const dayOfWeek = dateObj.getDay();
      const isPast = dateStr < todayStr;

      const explicitSessions = sessionsByDate.get(dateStr) || [];
      
      let completedCount = 0;
      let scheduledCount = 0;
      let cancelledCount = 0;

      // Track represented group-time combinations on this date
      const representedGroupTimes = new Set<string>();

      for (const s of explicitSessions) {
        if (s.status === 'completed') completedCount++;
        else if (s.status === 'cancelled') cancelledCount++;
        else scheduledCount++;

        const timeKey = `${s.groupId}_${s.startTime || 'flex'}`;
        representedGroupTimes.add(timeKey);
        if (s.studentId) {
          representedGroupTimes.add(`${s.groupId}_${s.studentId}_${s.startTime || 'flex'}`);
        }
      }

      let totalCount = explicitSessions.length;

      // ONLY for Today or Future dates, integrate uninstantiated recurring slots
      if (!isPast) {
        const slots = recurringSlotsByWeekday.get(dayOfWeek) || [];
        for (const slot of slots) {
          const timeKey = `${slot.groupId}_${slot.time || 'flex'}`;
          const studentTimeKey = slot.studentId ? `${slot.groupId}_${slot.studentId}_${slot.time || 'flex'}` : '';

          if (representedGroupTimes.has(timeKey) || (studentTimeKey && representedGroupTimes.has(studentTimeKey))) {
            continue; // Already has an explicit session recorded or scheduled for this slot
          }

          // Uninstantiated recurring class
          scheduledCount++;
          totalCount++;
        }
      }

      if (totalCount > 0) {
        statsMap.set(dateStr, {
          dateStr,
          totalCount,
          completedCount,
          scheduledCount,
          cancelledCount,
          hasRecordedSession: explicitSessions.length > 0,
        });
      }
    }
  }

  return statsMap;
}

/**
 * Generate a complete 6-row or 5-row calendar grid for a specific month.
 * Starts with Saturday (col 0) through Friday (col 6).
 */
export function generateMonthGrid(
  year: number,
  monthIndex: number,
  statsMap?: Map<string, DayClassSummary>
): CalendarDayCell[] {
  const cells: CalendarDayCell[] = [];
  const todayStr = new Date().toISOString().split('T')[0];

  const firstDayDate = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDayOfWeek = firstDayDate.getDay(); // 0 (Sun) .. 6 (Sat)

  // Map JS getDay() (0=Sun..6=Sat) to Saturday-first column (0=Sat..6=Fri)
  // Saturday (6) -> 0
  // Sunday (0) -> 1
  // Monday (1) -> 2
  // Tuesday (2) -> 3
  // Wednesday (3) -> 4
  // Thursday (4) -> 5
  // Friday (5) -> 6
  const startColIndex = (firstDayOfWeek + 1) % 7;

  // Days from previous month to fill first row
  const prevMonthDays = new Date(year, monthIndex, 0).getDate();
  for (let i = startColIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const prevMonthIdx = monthIndex === 0 ? 11 : monthIndex - 1;
    const prevYear = monthIndex === 0 ? year - 1 : year;
    const dateStr = formatDateKey(prevYear, prevMonthIdx, dayNum);
    const dayOfWeek = new Date(prevYear, prevMonthIdx, dayNum).getDay();
    const colIndex = (dayOfWeek + 1) % 7;
    const stat = statsMap?.get(dateStr);

    cells.push({
      dateStr,
      dayNumber: dayNum,
      monthIndex: prevMonthIdx,
      year: prevYear,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      dayOfWeek,
      colIndex,
      classCount: stat?.totalCount || 0,
      completedCount: stat?.completedCount || 0,
      scheduledCount: stat?.scheduledCount || 0,
      cancelledCount: stat?.cancelledCount || 0,
      hasClasses: (stat?.totalCount || 0) > 0,
    });
  }

  // Days of current month
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dateStr = formatDateKey(year, monthIndex, dayNum);
    const dayOfWeek = new Date(year, monthIndex, dayNum).getDay();
    const colIndex = (dayOfWeek + 1) % 7;
    const stat = statsMap?.get(dateStr);

    cells.push({
      dateStr,
      dayNumber: dayNum,
      monthIndex,
      year,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      dayOfWeek,
      colIndex,
      classCount: stat?.totalCount || 0,
      completedCount: stat?.completedCount || 0,
      scheduledCount: stat?.scheduledCount || 0,
      cancelledCount: stat?.cancelledCount || 0,
      hasClasses: (stat?.totalCount || 0) > 0,
    });
  }

  // Trailing days from next month to complete the grid (up to multiple of 7, usually 35 or 42 cells)
  const remainingCells = (7 - (cells.length % 7)) % 7;
  for (let dayNum = 1; dayNum <= remainingCells; dayNum++) {
    const nextMonthIdx = monthIndex === 11 ? 0 : monthIndex + 1;
    const nextYear = monthIndex === 11 ? year + 1 : year;
    const dateStr = formatDateKey(nextYear, nextMonthIdx, dayNum);
    const dayOfWeek = new Date(nextYear, nextMonthIdx, dayNum).getDay();
    const colIndex = (dayOfWeek + 1) % 7;
    const stat = statsMap?.get(dateStr);

    cells.push({
      dateStr,
      dayNumber: dayNum,
      monthIndex: nextMonthIdx,
      year: nextYear,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      dayOfWeek,
      colIndex,
      classCount: stat?.totalCount || 0,
      completedCount: stat?.completedCount || 0,
      scheduledCount: stat?.scheduledCount || 0,
      cancelledCount: stat?.cancelledCount || 0,
      hasClasses: (stat?.totalCount || 0) > 0,
    });
  }

  return cells;
}

export interface DetailedDateAgendaItem {
  id: string;
  source: 'session_record' | 'recurring_schedule';
  session?: Session;
  groupId: string;
  groupName: string;
  studentId?: string;
  studentName?: string;
  isPrivate: boolean;
  subject: string;
  stageOrGrade?: string;
  location?: string;
  dateStr: string;
  dayName: string;
  startTime: string; // e.g. "16:00"
  endTime?: string;
  formattedTime: string;
  sortMinutes: number;
  status: SessionStatus;
  notes?: string;
  accentColor: string;
  pricePerStudent?: number;
  hourlyRate?: number;
  billingMode?: string;
  // Attendance metrics if recorded
  hasRecordedAttendance: boolean;
  presentCount: number;
  absentChargedCount: number;
  absentFreeCount: number;
  totalStudentsCount: number;
  attendanceRecords?: {
    studentId: string;
    studentName: string;
    status: string;
    isCharged?: boolean;
    absenceReason?: string;
  }[];
}

export interface DetailedDateAgenda {
  dateStr: string;
  dayName: string;
  formattedDisplayDate: string;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  summary: {
    totalClasses: number;
    presentStudents: number;
    absentStudents: number;
    scheduledClasses: number;
    cancelledClasses: number;
    completedClasses: number;
  };
  items: DetailedDateAgendaItem[];
}

/**
 * Build the full detailed agenda for any exact date (past, present, or future).
 * Chronologically sorts all sessions, integrates multiple time slots, group & private sessions,
 * and attendance breakdowns.
 */
export function getDetailedAgendaForDate(
  dateStr: string,
  sessions: Session[],
  groups: Group[],
  enrollments: Enrollment[],
  students: Student[],
  isRTL: boolean = true
): DetailedDateAgenda {
  const dateObj = new Date(dateStr);
  const dayOfWeek = !isNaN(dateObj.getTime()) ? dateObj.getDay() : 6;
  const dayName = DAY_MAP_ARABIC[dayOfWeek] || 'السبت';
  
  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = dateStr === todayStr;
  const isPast = dateStr < todayStr;
  const isFuture = dateStr > todayStr;

  const groupsMap = new Map<string, Group>();
  groups.forEach((g) => groupsMap.set(g.id, g));

  const studentsMap = new Map<string, Student>();
  students.forEach((s) => studentsMap.set(s.id, s));

  const enrollmentsByGroup = new Map<string, Enrollment[]>();
  enrollments.forEach((e) => {
    if (e.status !== 'stopped') {
      const list = enrollmentsByGroup.get(e.groupId) || [];
      list.push(e);
      enrollmentsByGroup.set(e.groupId, list);
    }
  });

  // 1. Fetch explicit sessions for this date
  const explicitSessions = sessions.filter((s) => s.date === dateStr);
  const items: DetailedDateAgendaItem[] = [];

  // Track group + time combinations already represented by an explicit session
  const representedGroupTimes = new Set<string>();

  for (const session of explicitSessions) {
    const group = groupsMap.get(session.groupId);
    const isPrivate = group?.type === 'private' || !!session.studentId;
    const groupEnrs = enrollmentsByGroup.get(session.groupId) || [];
    
    // Check attendance in localStorage
    let attendanceList: any[] = [];
    try {
      const rawAtt = localStorage.getItem('tm_attendance_v2');
      if (rawAtt) {
        const parsed = JSON.parse(rawAtt);
        attendanceList = parsed.filter((a: any) => a.sessionId === session.id);
      }
    } catch {
      // Fallback
    }

    const presentCount = attendanceList.filter((a) => a.status === 'present' || a.status === 'late').length;
    const absentChargedCount = attendanceList.filter(
      (a) => a.isCharged || a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false)
    ).length;
    const absentFreeCount = attendanceList.filter(
      (a) => a.status === 'absent_free' || a.status === 'excused' || a.isCharged === false
    ).length;

    const enrichedAttendance = attendanceList.map((a) => {
      const stu = studentsMap.get(a.studentId);
      return {
        studentId: a.studentId,
        studentName: stu?.name || 'طالب',
        status: a.status,
        isCharged: a.isCharged,
        absenceReason: a.absenceReason,
      };
    });

    let singleStudentName = '';
    if (session.studentId) {
      singleStudentName = studentsMap.get(session.studentId)?.name || '';
    } else if (isPrivate && groupEnrs.length > 0) {
      singleStudentName = studentsMap.get(groupEnrs[0].studentId)?.name || '';
    }

    const sortMinutes = parseTimeToMinutes(session.startTime);
    const formattedTime = formatTimeDisplay(session.startTime, isRTL);

    const timeKey = `${session.groupId}_${session.startTime || 'flex'}`;
    representedGroupTimes.add(timeKey);

    items.push({
      id: `ses_item_${session.id}`,
      source: 'session_record',
      session,
      groupId: session.groupId,
      groupName: group?.name || session.title || 'مجموعة',
      studentId: session.studentId,
      studentName: singleStudentName,
      isPrivate,
      subject: group?.subject || 'مادة دراسية',
      stageOrGrade: group?.gradeLevel,
      location: group?.roomOrLocation,
      dateStr,
      dayName,
      startTime: session.startTime,
      endTime: session.endTime,
      formattedTime,
      sortMinutes,
      status: session.status,
      notes: session.notes,
      accentColor: group?.accentColor || (isPrivate ? '#B88438' : '#607B5E'),
      pricePerStudent: session.pricePerStudent || group?.defaultPrice,
      hourlyRate: session.hourlyRate || group?.hourlyRate,
      billingMode: group?.billingMode || group?.billingType,
      hasRecordedAttendance: attendanceList.length > 0,
      presentCount,
      absentChargedCount,
      absentFreeCount,
      totalStudentsCount: attendanceList.length > 0 ? attendanceList.length : groupEnrs.length,
      attendanceRecords: enrichedAttendance,
    });
  }

  // 2. If for this date (today or future) there are recurring scheduled groups/private lessons not yet instantiated as session records
  if (!isPast) {
    for (const group of groups) {
      if (!group.scheduleDays || !Array.isArray(group.scheduleDays)) continue;
      const meetsOnDay = group.scheduleDays.some((d) => getWeekdayIndex(d) === dayOfWeek);
      if (!meetsOnDay) continue;

      const isPrivate = group.type === 'private';
      const groupEnrs = enrollmentsByGroup.get(group.id) || [];

      if (groupEnrs.length > 0) {
        for (const enr of groupEnrs) {
          const student = studentsMap.get(enr.studentId);
          if (!student || student.status === 'archived') continue;

          const occurrenceTimes = getTimesForDayInEnrollment(enr, group, dayName);
          const effectiveTimes = occurrenceTimes.length > 0 ? occurrenceTimes : [''];

          for (let tIdx = 0; tIdx < effectiveTimes.length; tIdx++) {
            const rawTime = effectiveTimes[tIdx];
            const timeKey = `${group.id}_${rawTime || 'flex'}`;
            const studentTimeKey = `${group.id}_${student.id}_${rawTime || 'flex'}`;
            
            // If already recorded as explicit session, skip duplicate
            if (representedGroupTimes.has(timeKey) || representedGroupTimes.has(studentTimeKey)) continue;

            const sortMinutes = parseTimeToMinutes(rawTime);
            const formattedTime = formatTimeDisplay(rawTime, isRTL);

            items.push({
              id: `rec_item_${group.id}_${enr.id}_${tIdx}`,
              source: 'recurring_schedule',
              groupId: group.id,
              groupName: group.name,
              studentId: student.id,
              studentName: student.name,
              isPrivate,
              subject: group.subject || (isPrivate ? 'درس خاص' : 'مجموعة'),
              stageOrGrade: group.gradeLevel,
              location: group.roomOrLocation,
              dateStr,
              dayName,
              startTime: rawTime,
              formattedTime,
              sortMinutes,
              status: 'scheduled',
              accentColor: group.accentColor || (isPrivate ? '#B88438' : '#607B5E'),
              pricePerStudent: enr.customPrice || group.defaultPrice,
              hourlyRate: enr.hourlyRate || group.hourlyRate,
              billingMode: enr.billingMode || group.billingMode,
              hasRecordedAttendance: false,
              presentCount: 0,
              absentChargedCount: 0,
              absentFreeCount: 0,
              totalStudentsCount: 1,
            });
          }
        }
      } else {
        // Group with no students enrolled yet
        const groupTimes = getTimesForDayInGroup(group, dayName);
        const effectiveTimes = groupTimes.length > 0 ? groupTimes : [''];

        for (let tIdx = 0; tIdx < effectiveTimes.length; tIdx++) {
          const rawTime = effectiveTimes[tIdx];
          const timeKey = `${group.id}_${rawTime || 'flex'}`;
          if (representedGroupTimes.has(timeKey)) continue;

          const sortMinutes = parseTimeToMinutes(rawTime);
          const formattedTime = formatTimeDisplay(rawTime, isRTL);

          items.push({
            id: `rec_grp_${group.id}_${tIdx}`,
            source: 'recurring_schedule',
            groupId: group.id,
            groupName: group.name,
            isPrivate,
            subject: group.subject,
            stageOrGrade: group.gradeLevel,
            location: group.roomOrLocation,
            dateStr,
            dayName,
            startTime: rawTime,
            formattedTime,
            sortMinutes,
            status: 'scheduled',
            accentColor: group.accentColor || (isPrivate ? '#B88438' : '#607B5E'),
            pricePerStudent: group.defaultPrice,
            hourlyRate: group.hourlyRate,
            billingMode: group.billingMode,
            hasRecordedAttendance: false,
            presentCount: 0,
            absentChargedCount: 0,
            absentFreeCount: 0,
            totalStudentsCount: 0,
          });
        }
      }
    }
  }

  // Chronologically sort by start time, then group/student name
  items.sort((a, b) => {
    if (a.sortMinutes !== b.sortMinutes) {
      return a.sortMinutes - b.sortMinutes;
    }
    return (a.studentName || a.groupName).localeCompare(b.studentName || b.groupName);
  });

  // Calculate summary KPI numbers
  let presentStudents = 0;
  let absentStudents = 0;
  let scheduledClasses = 0;
  let cancelledClasses = 0;
  let completedClasses = 0;

  for (const item of items) {
    if (item.status === 'completed') {
      completedClasses++;
      presentStudents += item.presentCount;
      absentStudents += item.absentChargedCount + item.absentFreeCount;
    } else if (item.status === 'cancelled') {
      cancelledClasses++;
    } else {
      scheduledClasses++;
    }
  }

  // Format date for display
  let formattedDisplayDate = dateStr;
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const mIdx = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      formattedDisplayDate = `${dayName}، ${d} ${MONTH_NAMES_ARABIC[mIdx] || ''} ${y}`;
    }
  } catch {
    formattedDisplayDate = `${dayName} ${dateStr}`;
  }

  return {
    dateStr,
    dayName,
    formattedDisplayDate,
    isToday,
    isPast,
    isFuture,
    summary: {
      totalClasses: items.length,
      presentStudents,
      absentStudents,
      scheduledClasses,
      cancelledClasses,
      completedClasses,
    },
    items,
  };
}
