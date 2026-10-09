import { Group, Student, Enrollment, Session, SessionStatus } from '../types';
import { getAppLanguage } from './i18n';
import { getLocalDateParts, getLocalDateString, parseLocalTimeToStandard, toLocalISODate, parseLocalDateStr } from './localDate';

// ==========================================
// 1. CANONICAL WEEKDAYS ARCHITECTURE
// ==========================================

export type CanonicalWeekday =
  | 'saturday'
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday';

export const CANONICAL_WEEKDAYS: CanonicalWeekday[] = [
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];

export const CANONICAL_WEEKDAY_KEYS = CANONICAL_WEEKDAYS;

/**
 * Maps Canonical Weekdays to standard JavaScript Day Index (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
export const CANONICAL_TO_DAY_INDEX: Record<CanonicalWeekday, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Maps standard JavaScript Day Index (0 = Sunday, 6 = Saturday) to Canonical Weekday
 */
export const DAY_INDEX_TO_CANONICAL: Record<number, CanonicalWeekday> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

export const WEEKDAY_DISPLAY_NAMES_ARABIC: Record<CanonicalWeekday, string> = {
  saturday: 'السبت',
  sunday: 'الأحد',
  monday: 'الاثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
};

export const WEEKDAY_DISPLAY_NAMES_ENGLISH: Record<CanonicalWeekday, string> = {
  saturday: 'Saturday',
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
};

export const WEEKDAY_SHORT_ENGLISH: Record<CanonicalWeekday, string> = {
  saturday: 'Sat',
  sunday: 'Sun',
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
};

export const DAY_MAP_ARABIC: Record<number, string> = {
  0: 'الأحد',
  1: 'الاثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
};

export const DAY_MAP_ENGLISH: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

// ==========================================
// 2. NORMALIZATION LAYER
// ==========================================

/**
 * Normalizes any weekday input (Arabic, English, short forms, uppercase, lowercase, numeric index)
 * into a single unified CanonicalWeekday key: 'saturday' | 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'
 */
export function normalizeWeekdayKey(input?: string | number | null): CanonicalWeekday | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    return DAY_INDEX_TO_CANONICAL[input] || null;
  }

  const clean = String(input).trim().toLowerCase();
  if (clean in CANONICAL_TO_DAY_INDEX) {
    return clean as CanonicalWeekday;
  }

  // Exact mappings
  switch (clean) {
    case 'saturday':
    case 'sat':
    case 'السبت':
    case 'سبت':
      return 'saturday';

    case 'sunday':
    case 'sun':
    case 'الأحد':
    case 'الاحد':
    case 'أحد':
    case 'احد':
      return 'sunday';

    case 'monday':
    case 'mon':
    case 'الاثنين':
    case 'الإثنين':
    case 'اثنين':
    case 'إثنين':
      return 'monday';

    case 'tuesday':
    case 'tue':
    case 'tues':
    case 'الثلاثاء':
    case 'ثلاثاء':
      return 'tuesday';

    case 'wednesday':
    case 'wed':
    case 'الأربعاء':
    case 'الاربعاء':
    case 'أربعاء':
    case 'اربعاء':
      return 'wednesday';

    case 'thursday':
    case 'thu':
    case 'thur':
    case 'thurs':
    case 'الخميس':
    case 'خميس':
      return 'thursday';

    case 'friday':
    case 'fri':
    case 'الجمعة':
    case 'جمعة':
      return 'friday';

    default:
      break;
  }

  // Substring matching for resilience
  if (clean.includes('سبت') || clean.includes('sat')) return 'saturday';
  if (clean.includes('أحد') || clean.includes('احد') || clean.includes('sun')) return 'sunday';
  if (clean.includes('ثنين') || clean.includes('mon')) return 'monday';
  if (clean.includes('ثلاث') || clean.includes('tue')) return 'tuesday';
  if (clean.includes('ربع') || clean.includes('wed')) return 'wednesday';
  if (clean.includes('خميس') || clean.includes('thu')) return 'thursday';
  if (clean.includes('جمع') || clean.includes('fri')) return 'friday';

  return null;
}

/**
 * Returns the JavaScript weekday index (0..6) from any weekday representation
 */
export function getWeekdayIndex(input?: string | number | null): number | null {
  const canon = normalizeWeekdayKey(input);
  return canon ? CANONICAL_TO_DAY_INDEX[canon] : null;
}

/**
 * Normalizes an array of scheduleDays into deduplicated CanonicalWeekday keys
 */
export function normalizeScheduleDays(days?: string[] | null): CanonicalWeekday[] {
  if (!days || !Array.isArray(days)) return [];
  const result: CanonicalWeekday[] = [];
  for (const d of days) {
    const canon = normalizeWeekdayKey(d);
    if (canon && !result.includes(canon)) {
      result.push(canon);
    }
  }
  return result;
}

/**
 * Normalizes an arbitrary time representation (string or string[]) into a deduplicated, chronologically sorted array of time strings
 */
export function normalizeScheduleTimesList(val: any): string[] {
  if (!val) return [];
  let rawList: string[] = [];
  if (Array.isArray(val)) {
    rawList = val.filter((t) => typeof t === 'string' && t.trim().length > 0);
  } else if (typeof val === 'string' && val.trim().length > 0) {
    rawList = [val.trim()];
  }

  const uniqueTimes = Array.from(new Set(rawList.map((t) => t.trim())));

  uniqueTimes.sort((a, b) => {
    const minsA = parseTimeToMinutes(a);
    const minsB = parseTimeToMinutes(b);
    return minsA - minsB;
  });

  return uniqueTimes;
}

/**
 * Normalizes a scheduleTimes dictionary so all keys are CanonicalWeekday and values are string[]
 */
export function normalizeScheduleTimes(
  scheduleTimes?: Record<string, string | string[] | undefined> | null,
  defaultScheduleTime?: string,
  scheduleDays?: string[]
): Record<CanonicalWeekday, string[]> {
  const result: Record<CanonicalWeekday, string[]> = {
    saturday: [],
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
  };

  if (scheduleTimes && typeof scheduleTimes === 'object') {
    for (const [key, val] of Object.entries(scheduleTimes)) {
      const canon = normalizeWeekdayKey(key);
      if (canon && val) {
        const list = normalizeScheduleTimesList(val);
        if (list.length > 0) {
          result[canon] = Array.from(new Set([...result[canon], ...list]));
        }
      }
    }
  }

  // Fallback to default schedule time if a selected day has empty times
  if (scheduleDays && Array.isArray(scheduleDays) && defaultScheduleTime && defaultScheduleTime.trim()) {
    const normDays = normalizeScheduleDays(scheduleDays);
    const defTimes = normalizeScheduleTimesList(defaultScheduleTime);
    if (defTimes.length > 0) {
      normDays.forEach((d) => {
        if (result[d].length === 0) {
          result[d] = [...defTimes];
        }
      });
    }
  }

  return result;
}

// ==========================================
// 3. DISPLAY LOCALIZATION HELPERS
// ==========================================

export function isRTLMode(isRTLOrLang?: boolean | string): boolean {
  if (typeof isRTLOrLang === 'boolean') return isRTLOrLang;
  if (typeof isRTLOrLang === 'string') {
    return isRTLOrLang.startsWith('ar');
  }
  return getAppLanguage().startsWith('ar');
}

/**
 * Get localized display name for any weekday input
 */
export function getLocalizedWeekdayName(
  dayInput: CanonicalWeekday | string | number,
  isRTLOrLang?: boolean | string
): string {
  const canon = normalizeWeekdayKey(dayInput);
  const isRTL = isRTLMode(isRTLOrLang);
  if (!canon) {
    return typeof dayInput === 'string' ? dayInput : '';
  }
  return isRTL ? WEEKDAY_DISPLAY_NAMES_ARABIC[canon] : WEEKDAY_DISPLAY_NAMES_ENGLISH[canon];
}

/**
 * Localize day name (backward compatibility)
 */
export function formatDayNameLocalized(dayName: string, isRTLOrLang?: boolean | string): string {
  return getLocalizedWeekdayName(dayName, isRTLOrLang);
}

/**
 * Get localized day name from a Date or ISO string
 */
export function getLocalizedDayForDate(date: Date | string, isRTLOrLang?: boolean | string): string {
  const d = typeof date === 'string' ? parseLocalDateStr(date) : date;
  if (isNaN(d.getTime())) return getLocalizedWeekdayName('saturday', isRTLOrLang);
  const dayIndex = d.getDay();
  const canon = DAY_INDEX_TO_CANONICAL[dayIndex] || 'saturday';
  return getLocalizedWeekdayName(canon, isRTLOrLang);
}

/**
 * Get Arabic day name from a Date or ISO string (backward compatibility)
 */
export function getArabicDayForDate(date: Date | string): string {
  return getLocalizedDayForDate(date, true);
}

// ==========================================
// 4. SUBJECT & LOCATION LOCALIZATION
// ==========================================

export const COMMON_SUBJECT_MAP: Record<string, { ar: string; en: string }> = {
  'رياضيات': { ar: 'رياضيات', en: 'Mathematics' },
  'math': { ar: 'رياضيات', en: 'Mathematics' },
  'mathematics': { ar: 'رياضيات', en: 'Mathematics' },
  'رياضيات / math': { ar: 'رياضيات', en: 'Mathematics' },
  'ماث': { ar: 'رياضيات', en: 'Mathematics' },
  'لغة إنجليزية': { ar: 'اللغة الإنجليزية', en: 'English' },
  'اللغة الإنجليزية': { ar: 'اللغة الإنجليزية', en: 'English' },
  'انجليزي': { ar: 'اللغة الإنجليزية', en: 'English' },
  'إنجليزي': { ar: 'اللغة الإنجليزية', en: 'English' },
  'english': { ar: 'اللغة الإنجليزية', en: 'English' },
  'لغة عربية': { ar: 'اللغة العربية', en: 'Arabic' },
  'اللغة العربية': { ar: 'اللغة العربية', en: 'Arabic' },
  'عربي': { ar: 'اللغة العربية', en: 'Arabic' },
  'arabic': { ar: 'اللغة العربية', en: 'Arabic' },
  'علوم': { ar: 'علوم', en: 'Science' },
  'العلوم': { ar: 'علوم', en: 'Science' },
  'science': { ar: 'علوم', en: 'Science' },
  'دراسات': { ar: 'الدراسات الاجتماعية', en: 'Social Studies' },
  'الدراسات الاجتماعية': { ar: 'الدراسات الاجتماعية', en: 'Social Studies' },
  'social studies': { ar: 'الدراسات الاجتماعية', en: 'Social Studies' },
  'فيزياء': { ar: 'فيزياء', en: 'Physics' },
  'physics': { ar: 'فيزياء', en: 'Physics' },
  'كيمياء': { ar: 'كيمياء', en: 'Chemistry' },
  'chemistry': { ar: 'كيمياء', en: 'Chemistry' },
  'أحياء': { ar: 'أحياء', en: 'Biology' },
  'احياء': { ar: 'أحياء', en: 'Biology' },
  'biology': { ar: 'أحياء', en: 'Biology' },
  'حاسب': { ar: 'حاسب آلي', en: 'Computer Science' },
  'حاسب آلي': { ar: 'حاسب آلي', en: 'Computer Science' },
  'كمبيوتر': { ar: 'حاسب آلي', en: 'Computer Science' },
  'computer science': { ar: 'حاسب آلي', en: 'Computer Science' },
  'ict': { ar: 'تكنولوجيا المعلومات (ICT)', en: 'Information Technology (ICT)' },
  'تاريخ': { ar: 'تاريخ', en: 'History' },
  'history': { ar: 'تاريخ', en: 'History' },
  'جغرافيا': { ar: 'جغرافيا', en: 'Geography' },
  'geography': { ar: 'جغرافيا', en: 'Geography' },
  'فلسفة': { ar: 'فلسفة ومنطق', en: 'Philosophy' },
  'philosophy': { ar: 'فلسفة', en: 'Philosophy' },
  'علم نفس': { ar: 'علم نفس واجتماع', en: 'Psychology' },
  'psychology': { ar: 'علم نفس', en: 'Psychology' },
  'فرنساوي': { ar: 'اللغة الفرنسية', en: 'French' },
  'لغة فرنسية': { ar: 'اللغة الفرنسية', en: 'French' },
  'french': { ar: 'اللغة الفرنسية', en: 'French' },
  'ألماني': { ar: 'اللغة الألمانية', en: 'German' },
  'german': { ar: 'اللغة الألمانية', en: 'German' },
  'عام': { ar: 'عام', en: 'General' },
  'general': { ar: 'عام', en: 'General' },
  'درس خاص': { ar: 'درس خاص', en: 'Private Lesson' },
  'private lesson': { ar: 'درس خاص', en: 'Private Lesson' },
  'مجموعة': { ar: 'مجموعة', en: 'Group' },
  'group': { ar: 'مجموعة', en: 'Group' },
  'مجموعة دراسية': { ar: 'مجموعة دراسية', en: 'Tuition Group' },
  'tuition group': { ar: 'مجموعة دراسية', en: 'Tuition Group' },
};

export function getLocalizedSubjectName(subject?: string, isRTLOrLang?: boolean | string): string {
  if (!subject || !subject.trim()) return '';
  const clean = subject.trim().toLowerCase();
  const isRTL = isRTLMode(isRTLOrLang);

  if (COMMON_SUBJECT_MAP[clean]) {
    return isRTL ? COMMON_SUBJECT_MAP[clean].ar : COMMON_SUBJECT_MAP[clean].en;
  }
  for (const [key, mapping] of Object.entries(COMMON_SUBJECT_MAP)) {
    if (clean === key || clean.startsWith(key) || key.startsWith(clean)) {
      return isRTL ? mapping.ar : mapping.en;
    }
  }
  return subject;
}

export const COMMON_LOCATION_MAP: Record<string, { ar: string; en: string }> = {
  'منزل الطالب / أونلاين': { ar: 'منزل الطالب / أونلاين', en: "Student's Home / Online" },
  'منزل الطالب/أونلاين': { ar: 'منزل الطالب / أونلاين', en: "Student's Home / Online" },
  "student's home / online": { ar: 'منزل الطالب / أونلاين', en: "Student's Home / Online" },
  "student home / online": { ar: 'منزل الطالب / أونلاين', en: "Student's Home / Online" },
  'منزل الطالب': { ar: 'منزل الطالب', en: "Student's Home" },
  "student's home": { ar: 'منزل الطالب', en: "Student's Home" },
  'أونلاين': { ar: 'أونلاين', en: 'Online' },
  'اونلاين': { ar: 'أونلاين', en: 'Online' },
  'online': { ar: 'أونلاين', en: 'Online' },
  'المركز': { ar: 'السنتر / المركز', en: 'Centre' },
  'السنتر': { ar: 'السنتر', en: 'Centre' },
  'centre': { ar: 'السنتر', en: 'Centre' },
  'center': { ar: 'السنتر', en: 'Centre' },
  'المدرسة': { ar: 'المدرسة', en: 'School' },
  'school': { ar: 'المدرسة', en: 'School' },
  'في المنزل': { ar: 'في المنزل', en: 'At Home' },
  'at home': { ar: 'في المنزل', en: 'At Home' },
  'مقر الأكاديمية': { ar: 'مقر الأكاديمية', en: 'Academy HQ' },
};

export function getLocalizedLocationName(location?: string, isRTLOrLang?: boolean | string): string {
  if (!location || !location.trim()) return '';
  const clean = location.trim().toLowerCase();
  const isRTL = isRTLMode(isRTLOrLang);

  if (COMMON_LOCATION_MAP[clean]) {
    return isRTL ? COMMON_LOCATION_MAP[clean].ar : COMMON_LOCATION_MAP[clean].en;
  }
  for (const [key, mapping] of Object.entries(COMMON_LOCATION_MAP)) {
    if (clean === key || clean.includes(key)) {
      return isRTL ? mapping.ar : mapping.en;
    }
  }
  return location;
}

// ==========================================
// 5. TIME PARSING & FORMATTING
// ==========================================

export function parseTimeToMinutes(timeStr?: string): number {
  if (!timeStr || !timeStr.trim()) return 99999;
  const str = timeStr.trim();

  // 24-hour format "HH:MM"
  const match24 = str.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const mins = parseInt(match24[2], 10);
    return hours * 60 + mins;
  }

  // 12-hour format
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

  const matchSingle = str.match(/(\d{1,2})/);
  if (matchSingle) {
    let hours = parseInt(matchSingle[1], 10);
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    return hours * 60;
  }

  return 99999;
}

export function formatTimeDisplay(timeStr?: string, isRTLOrLang?: boolean | string): string {
  const isRTL = isRTLMode(isRTLOrLang);
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

// ==========================================
// 6. SCHEDULE LOOKUP FOR GROUPS & ENROLLMENTS
// ==========================================

/**
 * Given a Group and any day input, find all scheduled times for that day
 */
export function getTimesForDayInGroup(
  group: Group,
  dayInput: CanonicalWeekday | string | number
): string[] {
  const targetCanon = normalizeWeekdayKey(dayInput);
  if (!targetCanon) {
    return group.scheduleTime && group.scheduleTime.trim() ? [group.scheduleTime.trim()] : [];
  }

  if (group.scheduleTimes && typeof group.scheduleTimes === 'object') {
    // 1. Direct match with canonical key
    if ((group.scheduleTimes as any)[targetCanon]) {
      const times = normalizeScheduleTimesList((group.scheduleTimes as any)[targetCanon]);
      if (times.length > 0) return times;
    }
    // 2. Normalized match over all keys in case legacy format exists
    for (const [key, val] of Object.entries(group.scheduleTimes)) {
      if (val && normalizeWeekdayKey(key) === targetCanon) {
        const times = normalizeScheduleTimesList(val);
        if (times.length > 0) return times;
      }
    }
  }

  // 3. Fallback to single scheduleTime if group meets on this day
  if (group.scheduleDays && Array.isArray(group.scheduleDays)) {
    const meets = normalizeScheduleDays(group.scheduleDays).includes(targetCanon);
    if (meets && group.scheduleTime && group.scheduleTime.trim()) {
      return [group.scheduleTime.trim()];
    }
  }

  return group.scheduleTime && group.scheduleTime.trim() ? [group.scheduleTime.trim()] : [];
}

export function getTimeForDayInGroup(
  group: Group,
  dayInput: CanonicalWeekday | string | number
): string {
  const times = getTimesForDayInGroup(group, dayInput);
  return times[0] || group.scheduleTime || '';
}

/**
 * Given an Enrollment, Group, and day input, find all scheduled times for that student's enrollment
 */
export function getTimesForDayInEnrollment(
  enr: Enrollment,
  group: Group,
  dayInput: CanonicalWeekday | string | number
): string[] {
  const targetCanon = normalizeWeekdayKey(dayInput);
  if (!targetCanon) {
    return getTimesForDayInGroup(group, dayInput);
  }

  if (enr.scheduleTimes && typeof enr.scheduleTimes === 'object') {
    if ((enr.scheduleTimes as any)[targetCanon]) {
      const times = normalizeScheduleTimesList((enr.scheduleTimes as any)[targetCanon]);
      if (times.length > 0) return times;
    }
    for (const [key, val] of Object.entries(enr.scheduleTimes)) {
      if (val && normalizeWeekdayKey(key) === targetCanon) {
        const times = normalizeScheduleTimesList(val);
        if (times.length > 0) return times;
      }
    }
  }

  if (enr.scheduleTime && enr.scheduleTime.trim()) {
    return [enr.scheduleTime.trim()];
  }

  return getTimesForDayInGroup(group, targetCanon);
}

/**
 * Format a comprehensive schedule summary
 */
export function formatScheduleSummary(
  scheduleDays?: string[],
  scheduleTimes?: Record<string, string | string[]>,
  scheduleTime?: string,
  isRTLOrLang?: boolean | string
): string {
  const isRTL = isRTLMode(isRTLOrLang);
  if (!scheduleDays || scheduleDays.length === 0) {
    return isRTL ? 'مرنة' : 'Flexible';
  }

  const normalizedDays = normalizeScheduleDays(scheduleDays);
  if (normalizedDays.length === 0) {
    return isRTL ? 'مرنة' : 'Flexible';
  }

  const parts = normalizedDays.map((canonDay) => {
    let times: string[] = [];
    if (scheduleTimes && typeof scheduleTimes === 'object') {
      if ((scheduleTimes as any)[canonDay]) {
        times = normalizeScheduleTimesList((scheduleTimes as any)[canonDay]);
      } else {
        for (const [k, v] of Object.entries(scheduleTimes)) {
          if (v && normalizeWeekdayKey(k) === canonDay) {
            times = normalizeScheduleTimesList(v);
            break;
          }
        }
      }
    }

    if (times.length === 0 && scheduleTime && scheduleTime.trim()) {
      times = [scheduleTime.trim()];
    }

    const localizedDayName = getLocalizedWeekdayName(canonDay, isRTL);

    if (times.length === 0) {
      return localizedDayName;
    }

    const formattedTimes = times.map((t) => formatTimeDisplay(t, isRTL)).join(isRTL ? '، ' : ', ');
    return `${localizedDayName} (${formattedTimes})`;
  });

  return parts.join(isRTL ? '، ' : ', ');
}

// ==========================================
// 7. SCHEDULE OCCURRENCE COMPUTATION
// ==========================================

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
  time: string; // Formatted display e.g. "4:00 PM" / "04:00 م"
  rawTime: string; // e.g. "16:00"
  sortMinutes: number; // For chronological sorting
  location?: string;
  accentColor: string;
}

/**
 * Finds all scheduled classes for a given date, supporting both regular groups and private tutoring.
 * Robust against parameter ordering (students vs enrollments).
 */
export function getScheduledClassesForDate(
  dateInput: Date | string,
  groups: Group[],
  arg3: Student[] | Enrollment[],
  arg4: Student[] | Enrollment[],
  isRTLOrLang?: boolean | string
): ScheduledClassItem[] {
  const d = typeof dateInput === 'string' ? parseLocalDateStr(dateInput) : dateInput;
  if (isNaN(d.getTime())) return [];

  const isRTL = isRTLMode(isRTLOrLang);

  // Disambiguate arg3 and arg4
  let students: Student[] = [];
  let enrollments: Enrollment[] = [];

  const isEnrollmentArr = (arr: any[]): arr is Enrollment[] => {
    return arr.length > 0 && ('studentId' in arr[0] && 'groupId' in arr[0] && 'serviceType' in arr[0]);
  };

  if (Array.isArray(arg3) && Array.isArray(arg4)) {
    if (isEnrollmentArr(arg3)) {
      enrollments = arg3 as unknown as Enrollment[];
      students = arg4 as unknown as Student[];
    } else if (isEnrollmentArr(arg4)) {
      enrollments = arg4 as unknown as Enrollment[];
      students = arg3 as unknown as Student[];
    } else {
      if (arg3.length > 0 && 'serviceType' in arg3[0]) {
        enrollments = arg3 as unknown as Enrollment[];
        students = arg4 as unknown as Student[];
      } else {
        students = arg3 as unknown as Student[];
        enrollments = arg4 as unknown as Enrollment[];
      }
    }
  }

  const parts = getLocalDateParts(dateInput);
  const targetDayIdx = parts.weekdayIndex; // 0 = Sunday, 6 = Saturday
  const canonicalTodayKey = parts.canonicalWeekday;
  const localizedDayName = getLocalizedWeekdayName(canonicalTodayKey, isRTL);

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
    const isPrivate = group.type === 'private';
    const groupEnrollments = studentEnrollmentsByGroup.get(group.id) || [];

    const groupNormalizedDays = group.scheduleDays && Array.isArray(group.scheduleDays) ? normalizeScheduleDays(group.scheduleDays) : [];
    const groupMeetsToday = groupNormalizedDays.includes(canonicalTodayKey);

    // Check if any active enrollment in this group has custom schedule days meeting today
    const customEnrollmentsMeetingToday = groupEnrollments.filter((enr) => {
      if (enr.scheduleDays && Array.isArray(enr.scheduleDays) && enr.scheduleDays.length > 0) {
        return normalizeScheduleDays(enr.scheduleDays).includes(canonicalTodayKey);
      }
      return false;
    });

    if (!groupMeetsToday && customEnrollmentsMeetingToday.length === 0) {
      continue;
    }

    if (isPrivate) {
      // Private lesson: each private enrollment represents a scheduled private lesson
      if (groupEnrollments.length > 0) {
        for (const enr of groupEnrollments) {
          const stu = activeStudentsMap.get(enr.studentId);
          if (!stu) continue;

          // Check custom enrollment schedule days if defined
          if (enr.scheduleDays && Array.isArray(enr.scheduleDays) && enr.scheduleDays.length > 0) {
            const enrDays = normalizeScheduleDays(enr.scheduleDays);
            if (!enrDays.includes(canonicalTodayKey)) {
              continue;
            }
          } else if (!groupMeetsToday) {
            continue;
          }

          const occurrenceTimes = getTimesForDayInEnrollment(enr, group, canonicalTodayKey);
          const effectiveTimes = occurrenceTimes.length > 0 ? occurrenceTimes : [group.scheduleTime || '16:00'];

          effectiveTimes.forEach((rawTime, timeIdx) => {
            const sortMinutes = parseTimeToMinutes(rawTime);
            const formattedTime = formatTimeDisplay(rawTime, isRTL);
            const cleanTimeKey = (rawTime || 'flex').replace(/[^a-zA-Z0-9]/g, '_');
            const loc = getLocalizedLocationName(group.roomOrLocation, isRTL);
            const subj = getLocalizedSubjectName(group.subject, isRTL) || (isRTL ? 'درس خاص' : 'Private Lesson');

            scheduledItems.push({
              id: `sched_priv_${group.id}_${stu.id}_${targetDayIdx}_${timeIdx}_${cleanTimeKey}`,
              studentId: stu.id,
              studentName: stu.name,
              student: stu,
              groupId: group.id,
              groupName: isRTL ? 'درس خاص' : 'Private Lesson',
              group: group,
              enrollmentId: enr.id,
              isPrivate: true,
              subject: subj,
              dayName: localizedDayName,
              time: formattedTime,
              rawTime,
              sortMinutes,
              location: loc,
              accentColor: group.accentColor || '#0F2A4A',
            });
          });
        }
      }
    } else {
      // Regular Study Group
      if (groupMeetsToday) {
        const groupTimes = getTimesForDayInGroup(group, canonicalTodayKey);
        const effectiveGroupTimes = groupTimes.length > 0 ? groupTimes : [group.scheduleTime || '16:00'];

        effectiveGroupTimes.forEach((rawTime, timeIdx) => {
          const sortMinutes = parseTimeToMinutes(rawTime);
          const formattedTime = formatTimeDisplay(rawTime, isRTL);
          const cleanTimeKey = (rawTime || 'flex').replace(/[^a-zA-Z0-9]/g, '_');
          const loc = getLocalizedLocationName(group.roomOrLocation, isRTL);
          const subj = getLocalizedSubjectName(group.subject, isRTL) || (isRTL ? 'مجموعة دراسية' : 'Tuition Group');

          scheduledItems.push({
            id: `sched_grp_${group.id}_${targetDayIdx}_${timeIdx}_${cleanTimeKey}`,
            studentId: '',
            studentName: group.name,
            groupId: group.id,
            groupName: group.name,
            group: group,
            isPrivate: false,
            subject: subj,
            dayName: localizedDayName,
            time: formattedTime,
            rawTime,
            sortMinutes,
            location: loc,
            accentColor: group.accentColor || '#17375E',
          });
        });
      }

      // If enrollment has custom schedule override meeting today when group itself doesn't meet
      if (!groupMeetsToday && customEnrollmentsMeetingToday.length > 0) {
        for (const enr of customEnrollmentsMeetingToday) {
          const stu = activeStudentsMap.get(enr.studentId);
          const rawTimes = getTimesForDayInEnrollment(enr, group, canonicalTodayKey);
          const effectiveTimes = rawTimes.length > 0 ? rawTimes : [group.scheduleTime || '16:00'];

          effectiveTimes.forEach((rawTime, timeIdx) => {
            const sortMinutes = parseTimeToMinutes(rawTime);
            const formattedTime = formatTimeDisplay(rawTime, isRTL);
            const cleanTimeKey = (rawTime || 'flex').replace(/[^a-zA-Z0-9]/g, '_');
            const loc = getLocalizedLocationName(group.roomOrLocation, isRTL);
            const subj = getLocalizedSubjectName(group.subject, isRTL) || (isRTL ? 'مجموعة دراسية' : 'Tuition Group');

            scheduledItems.push({
              id: `sched_enr_custom_${group.id}_${enr.id}_${targetDayIdx}_${timeIdx}_${cleanTimeKey}`,
              studentId: stu?.id || '',
              studentName: stu?.name || group.name,
              groupId: group.id,
              groupName: group.name,
              group: group,
              enrollmentId: enr.id,
              isPrivate: false,
              subject: subj,
              dayName: localizedDayName,
              time: formattedTime,
              rawTime,
              sortMinutes,
              location: loc,
              accentColor: group.accentColor || '#17375E',
            });
          });
        }
      }
    }
  }

  // Also check active students with direct privateDays or scheduleDays not yet covered by a group
  const coveredStudentIds = new Set(scheduledItems.filter((i) => i.isPrivate && i.studentId).map((i) => i.studentId));
  for (const stu of activeStudentsMap.values()) {
    if (coveredStudentIds.has(stu.id)) continue;

    if (stu.privateDays && Array.isArray(stu.privateDays) && stu.privateDays.length > 0) {
      const normPD = normalizeScheduleDays(stu.privateDays);
      if (normPD.includes(canonicalTodayKey)) {
        const normPT = normalizeScheduleTimes(stu.privateTimes);
        const effectiveTimes = normPT[canonicalTodayKey]?.length ? normPT[canonicalTodayKey] : [stu.privateTime || '16:30'];

        effectiveTimes.forEach((rawTime, timeIdx) => {
          const sortMinutes = parseTimeToMinutes(rawTime);
          const formattedTime = formatTimeDisplay(rawTime, isRTL);
          const cleanTimeKey = (rawTime || 'flex').replace(/[^a-zA-Z0-9]/g, '_');
          const loc = getLocalizedLocationName(stu.privateLocation || (isRTL ? 'منزل الطالب' : "Student's Home"), isRTL);
          const subj = getLocalizedSubjectName(stu.subject, isRTL) || (isRTL ? 'درس خاص' : 'Private Lesson');

          scheduledItems.push({
            id: `sched_priv_direct_${stu.id}_${targetDayIdx}_${timeIdx}_${cleanTimeKey}`,
            studentId: stu.id,
            studentName: stu.name,
            student: stu,
            groupId: `direct_priv_${stu.id}`,
            groupName: isRTL ? 'درس خاص' : 'Private Lesson',
            isPrivate: true,
            subject: subj,
            dayName: localizedDayName,
            time: formattedTime,
            rawTime,
            sortMinutes,
            location: loc,
            accentColor: '#0F2A4A',
          });
        });
      }
    }
  }

  // Sort chronologically by time, then name
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
  isRTLOrLang?: boolean | string
): UpcomingStudentClass[] {
  if (!studentId) return [];

  const isRTL = isRTLMode(isRTLOrLang);

  const studentEnrollments = enrollments.filter(
    (e) => e.studentId === studentId && e.status !== 'stopped'
  );
  if (studentEnrollments.length === 0) return [];

  const groupsMap = new Map<string, Group>();
  groups.forEach((g) => groupsMap.set(g.id, g));

  const upcoming: UpcomingStudentClass[] = [];
  const today = new Date();

  for (let offset = 0; offset < 14; offset++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + offset);
    const dayIdx = targetDate.getDay();
    const canonKey = DAY_INDEX_TO_CANONICAL[dayIdx] || 'saturday';
    const localizedDayName = getLocalizedWeekdayName(canonKey, isRTL);
    const dateStr = toLocalISODate(targetDate);

    const dayRelative =
      offset === 0
        ? (isRTL ? 'اليوم' : 'Today')
        : offset === 1
        ? (isRTL ? 'غداً' : 'Tomorrow')
        : localizedDayName;

    for (const enr of studentEnrollments) {
      const group = groupsMap.get(enr.groupId);
      if (!group || !group.scheduleDays || !Array.isArray(group.scheduleDays)) continue;

      const groupNormalizedDays = normalizeScheduleDays(group.scheduleDays);
      let meetsOnDay = groupNormalizedDays.includes(canonKey);

      if (enr.scheduleDays && Array.isArray(enr.scheduleDays) && enr.scheduleDays.length > 0) {
        meetsOnDay = normalizeScheduleDays(enr.scheduleDays).includes(canonKey);
      }

      if (!meetsOnDay) continue;

      const rawTimes = getTimesForDayInEnrollment(enr, group, canonKey);
      const isPrivate = group.type === 'private';
      const effectiveTimes = rawTimes.length > 0 ? rawTimes : [group.scheduleTime || '16:00'];

      for (let tIdx = 0; tIdx < effectiveTimes.length; tIdx++) {
        const rawTime = effectiveTimes[tIdx];
        const formattedTime = formatTimeDisplay(rawTime, isRTL);
        const cleanKey = (rawTime || 'flex').replace(/[^a-zA-Z0-9]/g, '_');
        const loc = getLocalizedLocationName(group.roomOrLocation, isRTL);
        const subj = getLocalizedSubjectName(group.subject, isRTL) || (isPrivate ? (isRTL ? 'درس خاص' : 'Private Lesson') : (isRTL ? 'مجموعة' : 'Group'));

        upcoming.push({
          id: `up_${enr.id}_${dateStr}_${tIdx}_${cleanKey}`,
          dateStr,
          dayName: localizedDayName,
          dayRelative,
          time: formattedTime,
          rawTime,
          groupId: group.id,
          groupName: isPrivate ? (isRTL ? 'درس خاص' : 'Private Lesson') : group.name,
          isPrivate,
          subject: subj,
          location: loc,
          accentColor: group.accentColor || (isPrivate ? '#0F2A4A' : '#17375E'),
        });
      }
    }

    if (upcoming.length >= limit * 2) break;
  }

  return upcoming.slice(0, limit);
}

export interface StudentRecurringScheduleItem {
  id: string;
  dayKey: string; // 'saturday', 'sunday', etc.
  dayIndex: number; // 0 for saturday, ..., 6 for friday
  dayName: string; // Localized day name e.g. "السبت" or "Saturday"
  rawTime: string; // e.g. "16:00"
  time: string; // Formatted time e.g. "4:00 م" or "4:00 PM"
  sortMinutes: number; // minutes from midnight
  sourceType: 'group' | 'private' | 'student_custom';
  sourceTitle: string; // e.g. "Math Group" or "الدرس الخاص"
  subject: string;
  location?: string;
  groupId?: string;
  enrollmentId?: string;
  accentColor: string;
}

export interface StudentScheduleGroupSummary {
  groupId: string;
  groupName: string;
  subject: string;
  accentColor: string;
  location?: string;
  items: StudentRecurringScheduleItem[];
}

export interface StudentSchedulePrivateSummary {
  groupId?: string;
  enrollmentId?: string;
  title: string;
  subject: string;
  location?: string;
  accentColor: string;
  items: StudentRecurringScheduleItem[];
}

export interface StudentEffectiveScheduleResult {
  groupSchedules: StudentScheduleGroupSummary[];
  privateSchedules: StudentSchedulePrivateSummary[];
  allDaysGrouped: {
    dayKey: string;
    dayName: string;
    dayIndex: number;
    items: StudentRecurringScheduleItem[];
  }[];
  totalOccurrencesCount: number;
}

/**
 * Deterministically resolves the student's complete recurring weekly schedule.
 * Separates Group schedules, Enrollment custom schedules, and Private lesson schedules.
 * Always sorts days by canonical week order (Saturday -> Friday) and times chronologically.
 */
export function getStudentEffectiveSchedule(
  student: Student,
  groups: Group[],
  enrollments: Enrollment[],
  isRTLOrLang?: boolean | string
): StudentEffectiveScheduleResult {
  if (!student) {
    return {
      groupSchedules: [],
      privateSchedules: [],
      allDaysGrouped: [],
      totalOccurrencesCount: 0,
    };
  }

  const isRTL = isRTLMode(isRTLOrLang);

  const studentEnrollments = enrollments.filter(
    (e) => e.studentId === student.id && e.status !== 'stopped'
  );

  const groupsMap = new Map<string, Group>();
  groups.forEach((g) => groupsMap.set(g.id, g));

  const allItems: StudentRecurringScheduleItem[] = [];
  const groupSchedules: StudentScheduleGroupSummary[] = [];
  const privateSchedules: StudentSchedulePrivateSummary[] = [];

  const seenKeys = new Set<string>();

  // Helper to get day index in canonical week (0 for saturday, ..., 6 for friday)
  const getCanonicalWeekIndex = (canonKey: string): number => {
    const idx = CANONICAL_WEEKDAY_KEYS.indexOf(canonKey as any);
    return idx >= 0 ? idx : 0;
  };

  // 1. Process Group Enrollments (Non-private)
  const groupEnrs = studentEnrollments.filter((e) => e.serviceType !== 'private');
  for (const enr of groupEnrs) {
    const group = groupsMap.get(enr.groupId);
    if (!group) continue;

    // Check if enrollment has custom schedule override, otherwise inherit from group
    const hasEnrOverride = enr.scheduleDays && Array.isArray(enr.scheduleDays) && enr.scheduleDays.length > 0;
    const rawDays = hasEnrOverride ? enr.scheduleDays! : group.scheduleDays || [];
    const normalizedDays = normalizeScheduleDays(rawDays);

    const groupItems: StudentRecurringScheduleItem[] = [];
    const loc = getLocalizedLocationName(group.roomOrLocation, isRTL);
    const subj = getLocalizedSubjectName(group.subject, isRTL) || (isRTL ? 'مجموعة دراسية' : 'Tuition Group');

    for (const dayKey of normalizedDays) {
      const dayIdx = getCanonicalWeekIndex(dayKey);
      const localizedDayName = getLocalizedWeekdayName(dayKey, isRTL);

      const rawTimes = getTimesForDayInEnrollment(enr, group, dayKey);
      const effectiveTimes = rawTimes.length > 0 ? rawTimes : [group.scheduleTime || '16:00'];

      effectiveTimes.forEach((rawTime, tIdx) => {
        const sortMinutes = parseTimeToMinutes(rawTime);
        const formattedTime = formatTimeDisplay(rawTime, isRTL);
        const uniqueKey = `grp_${group.id}_${dayKey}_${rawTime}`;

        const item: StudentRecurringScheduleItem = {
          id: `item_grp_${enr.id}_${dayKey}_${tIdx}_${rawTime}`,
          dayKey,
          dayIndex: dayIdx,
          dayName: localizedDayName,
          rawTime,
          time: formattedTime,
          sortMinutes,
          sourceType: 'group',
          sourceTitle: group.name,
          subject: subj,
          location: loc,
          groupId: group.id,
          enrollmentId: enr.id,
          accentColor: group.accentColor || '#17375E',
        };

        groupItems.push(item);
        if (!seenKeys.has(uniqueKey)) {
          seenKeys.add(uniqueKey);
          allItems.push(item);
        }
      });
    }

    if (groupItems.length > 0) {
      // Sort group items by canonical week order then time
      groupItems.sort((a, b) => {
        if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
        return a.sortMinutes - b.sortMinutes;
      });

      groupSchedules.push({
        groupId: group.id,
        groupName: group.name,
        subject: subj,
        accentColor: group.accentColor || '#17375E',
        location: loc,
        items: groupItems,
      });
    }
  }

  // 2. Process Private Lessons (Private enrollments or student private fields)
  const privateEnrs = studentEnrollments.filter((e) => e.serviceType === 'private');
  if (privateEnrs.length > 0) {
    for (const enr of privateEnrs) {
      const group = groupsMap.get(enr.groupId);
      const rawDays =
        enr.scheduleDays && enr.scheduleDays.length > 0
          ? enr.scheduleDays
          : group?.scheduleDays && group.scheduleDays.length > 0
          ? group.scheduleDays
          : student.privateDays || [];
      const normalizedDays = normalizeScheduleDays(rawDays);

      const privItems: StudentRecurringScheduleItem[] = [];
      const privSubj = getLocalizedSubjectName(group?.subject || student.subject, isRTL) || (isRTL ? 'درس خاص' : 'Private Lesson');
      const privLoc = getLocalizedLocationName(group?.roomOrLocation || student.privateLocation || (isRTL ? 'منزل الطالب' : "Student's Home"), isRTL);

      for (const dayKey of normalizedDays) {
        const dayIdx = getCanonicalWeekIndex(dayKey);
        const localizedDayName = getLocalizedWeekdayName(dayKey, isRTL);

        let effectiveTimes: string[] = [];
        if (group) {
          effectiveTimes = getTimesForDayInEnrollment(enr, group, dayKey);
        }
        if (effectiveTimes.length === 0 && student.privateTimes) {
          const normPT = normalizeScheduleTimes(student.privateTimes);
          if (normPT[dayKey]?.length) {
            effectiveTimes = normPT[dayKey];
          }
        }
        if (effectiveTimes.length === 0) {
          effectiveTimes = [group?.scheduleTime || student.privateTime || '16:30'];
        }

        effectiveTimes.forEach((rawTime, tIdx) => {
          const sortMinutes = parseTimeToMinutes(rawTime);
          const formattedTime = formatTimeDisplay(rawTime, isRTL);
          const uniqueKey = `priv_${enr.id}_${dayKey}_${rawTime}`;

          const item: StudentRecurringScheduleItem = {
            id: `item_priv_${enr.id}_${dayKey}_${tIdx}_${rawTime}`,
            dayKey,
            dayIndex: dayIdx,
            dayName: localizedDayName,
            rawTime,
            time: formattedTime,
            sortMinutes,
            sourceType: 'private',
            sourceTitle: isRTL ? 'الدرس الخاص' : 'Private Lesson',
            subject: privSubj,
            location: privLoc,
            groupId: group?.id,
            enrollmentId: enr.id,
            accentColor: group?.accentColor || '#0F2A4A',
          };

          privItems.push(item);
          if (!seenKeys.has(uniqueKey)) {
            seenKeys.add(uniqueKey);
            allItems.push(item);
          }
        });
      }

      if (privItems.length > 0) {
        privItems.sort((a, b) => {
          if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
          return a.sortMinutes - b.sortMinutes;
        });

        privateSchedules.push({
          groupId: group?.id,
          enrollmentId: enr.id,
          title: isRTL ? 'الدرس الخاص' : 'Private Lesson',
          subject: privSubj,
          location: privLoc,
          accentColor: group?.accentColor || '#0F2A4A',
          items: privItems,
        });
      }
    }
  } else if (student.privateDays && student.privateDays.length > 0) {
    // Top level student private days
    const normalizedDays = normalizeScheduleDays(student.privateDays);
    const privItems: StudentRecurringScheduleItem[] = [];
    const privSubj = getLocalizedSubjectName(student.subject, isRTL) || (isRTL ? 'درس خاص' : 'Private Lesson');
    const privLoc = getLocalizedLocationName(student.privateLocation || (isRTL ? 'منزل الطالب' : "Student's Home"), isRTL);
    const normPT = normalizeScheduleTimes(student.privateTimes);

    for (const dayKey of normalizedDays) {
      const dayIdx = getCanonicalWeekIndex(dayKey);
      const localizedDayName = getLocalizedWeekdayName(dayKey, isRTL);
      const effectiveTimes = normPT[dayKey]?.length ? normPT[dayKey] : [student.privateTime || '16:30'];

      effectiveTimes.forEach((rawTime, tIdx) => {
        const sortMinutes = parseTimeToMinutes(rawTime);
        const formattedTime = formatTimeDisplay(rawTime, isRTL);
        const uniqueKey = `priv_student_${student.id}_${dayKey}_${rawTime}`;

        const item: StudentRecurringScheduleItem = {
          id: `item_priv_direct_${student.id}_${dayKey}_${tIdx}_${rawTime}`,
          dayKey,
          dayIndex: dayIdx,
          dayName: localizedDayName,
          rawTime,
          time: formattedTime,
          sortMinutes,
          sourceType: 'private',
          sourceTitle: isRTL ? 'الدرس الخاص' : 'Private Lesson',
          subject: privSubj,
          location: privLoc,
          accentColor: '#0F2A4A',
        };

        privItems.push(item);
        if (!seenKeys.has(uniqueKey)) {
          seenKeys.add(uniqueKey);
          allItems.push(item);
        }
      });
    }

    if (privItems.length > 0) {
      privItems.sort((a, b) => {
        if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
        return a.sortMinutes - b.sortMinutes;
      });

      privateSchedules.push({
        title: isRTL ? 'الدرس الخاص' : 'Private Lesson',
        subject: privSubj,
        location: privLoc,
        accentColor: '#0F2A4A',
        items: privItems,
      });
    }
  }

  // 3. Process direct student custom schedule ONLY if not already covered by enrollments
  if (allItems.length === 0 && student.scheduleDays && student.scheduleDays.length > 0) {
    const normalizedDays = normalizeScheduleDays(student.scheduleDays);
    const normST = normalizeScheduleTimes(student.scheduleTimes);

    for (const dayKey of normalizedDays) {
      const dayIdx = getCanonicalWeekIndex(dayKey);
      const localizedDayName = getLocalizedWeekdayName(dayKey, isRTL);
      const effectiveTimes = normST[dayKey]?.length ? normST[dayKey] : [student.scheduleTime || '16:00'];

      effectiveTimes.forEach((rawTime, tIdx) => {
        const uniqueKey = `custom_${student.id}_${dayKey}_${rawTime}`;
        if (!seenKeys.has(uniqueKey)) {
          seenKeys.add(uniqueKey);
          const sortMinutes = parseTimeToMinutes(rawTime);
          const formattedTime = formatTimeDisplay(rawTime, isRTL);

          allItems.push({
            id: `item_custom_${student.id}_${dayKey}_${tIdx}_${rawTime}`,
            dayKey,
            dayIndex: dayIdx,
            dayName: localizedDayName,
            rawTime,
            time: formattedTime,
            sortMinutes,
            sourceType: 'student_custom',
            sourceTitle: isRTL ? 'موعد مخصص' : 'Custom Schedule',
            subject: getLocalizedSubjectName(student.subject, isRTL) || (isRTL ? 'مادة دراسية' : 'Subject'),
            accentColor: '#17375E',
          });
        }
      });
    }
  }

  // 4. Group all items by canonical weekday (0 for saturday, ..., 6 for friday)
  const groupedMap = new Map<string, StudentRecurringScheduleItem[]>();
  CANONICAL_WEEKDAY_KEYS.forEach((k) => groupedMap.set(k, []));

  allItems.forEach((item) => {
    const list = groupedMap.get(item.dayKey) || [];
    list.push(item);
    groupedMap.set(item.dayKey, list);
  });

  const allDaysGrouped: {
    dayKey: string;
    dayName: string;
    dayIndex: number;
    items: StudentRecurringScheduleItem[];
  }[] = [];

  CANONICAL_WEEKDAY_KEYS.forEach((canonKey, idx) => {
    const items = groupedMap.get(canonKey) || [];
    if (items.length > 0) {
      // Sort times chronologically
      items.sort((a, b) => a.sortMinutes - b.sortMinutes);
      allDaysGrouped.push({
        dayKey: canonKey,
        dayName: getLocalizedWeekdayName(canonKey, isRTL),
        dayIndex: idx,
        items,
      });
    }
  });

  return {
    groupSchedules,
    privateSchedules,
    allDaysGrouped,
    totalOccurrencesCount: allItems.length,
  };
}

// ==========================================
// 8. MULTI-YEAR CALENDAR DOMAIN & ENGINE
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

export const CALENDAR_WEEKDAY_HEADERS_ENGLISH = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export const CALENDAR_WEEKDAY_SHORT_ENGLISH = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const CALENDAR_WEEKDAY_INITIALS_ENGLISH = ['S', 'S', 'M', 'T', 'W', 'T', 'F'];

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

export function formatDateKey(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function getYearClassStatsMap(
  year: number,
  sessions: Session[],
  groups: Group[],
  enrollments: Enrollment[],
  students: Student[]
): Map<string, DayClassSummary> {
  const statsMap = new Map<string, DayClassSummary>();
  const todayStr = toLocalISODate();

  const sessionsByDate = new Map<string, Session[]>();
  for (const s of sessions) {
    if (!s.date) continue;
    if (s.date.startsWith(`${year}-`) || s.year === year) {
      const list = sessionsByDate.get(s.date) || [];
      list.push(s);
      sessionsByDate.set(s.date, list);
    }
  }

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

  interface RecurringSlotRef {
    groupId: string;
    studentId?: string;
    time: string;
  }
  const recurringSlotsByWeekday = new Map<CanonicalWeekday, RecurringSlotRef[]>();

  for (const canonDay of CANONICAL_WEEKDAYS) {
    const slots: RecurringSlotRef[] = [];

    for (const group of groups) {
      if (!group.scheduleDays || !Array.isArray(group.scheduleDays)) continue;
      const meets = normalizeScheduleDays(group.scheduleDays).includes(canonDay);
      if (!meets) continue;

      const groupEnrs = activeEnrollmentsByGroup.get(group.id) || [];
      if (groupEnrs.length > 0) {
        for (const enr of groupEnrs) {
          if (!activeStudentsMap.has(enr.studentId)) continue;
          const times = getTimesForDayInEnrollment(enr, group, canonDay);
          const effectiveTimes = times.length > 0 ? times : [group.scheduleTime || '16:00'];
          for (const t of effectiveTimes) {
            slots.push({
              groupId: group.id,
              studentId: enr.studentId,
              time: t,
            });
          }
        }
      } else {
        const times = getTimesForDayInGroup(group, canonDay);
        const effectiveTimes = times.length > 0 ? times : [group.scheduleTime || '16:00'];
        for (const t of effectiveTimes) {
          slots.push({
            groupId: group.id,
            time: t,
          });
        }
      }
    }
    recurringSlotsByWeekday.set(canonDay, slots);
  }

  for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDateKey(year, monthIdx, day);
      const dateObj = new Date(year, monthIdx, day);
      const dayOfWeek = dateObj.getDay();
      const canonDay = DAY_INDEX_TO_CANONICAL[dayOfWeek] || 'saturday';
      const isPast = dateStr < todayStr;

      const explicitSessions = sessionsByDate.get(dateStr) || [];
      
      let completedCount = 0;
      let scheduledCount = 0;
      let cancelledCount = 0;

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

      if (!isPast) {
        const slots = recurringSlotsByWeekday.get(canonDay) || [];
        for (const slot of slots) {
          const timeKey = `${slot.groupId}_${slot.time || 'flex'}`;
          const studentTimeKey = slot.studentId ? `${slot.groupId}_${slot.studentId}_${slot.time || 'flex'}` : '';

          if (representedGroupTimes.has(timeKey) || (studentTimeKey && representedGroupTimes.has(studentTimeKey))) {
            continue;
          }

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

export function generateMonthGrid(
  year: number,
  monthIndex: number,
  statsMap?: Map<string, DayClassSummary>
): CalendarDayCell[] {
  const cells: CalendarDayCell[] = [];
  const todayStr = toLocalISODate();

  const firstDayDate = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDayOfWeek = firstDayDate.getDay();

  const startColIndex = (firstDayOfWeek + 1) % 7;

  // Days from previous month
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

  // Trailing days from next month
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

export function getDetailedAgendaForDate(
  dateStr: string,
  sessions: Session[],
  groups: Group[],
  enrollments: Enrollment[],
  students: Student[],
  isRTLOrLang?: boolean | string
): DetailedDateAgenda {
  const isRTL = isRTLMode(isRTLOrLang);
  const dateObj = parseLocalDateStr(dateStr);
  const dayOfWeek = !isNaN(dateObj.getTime()) ? dateObj.getDay() : 6;
  const canonDay = DAY_INDEX_TO_CANONICAL[dayOfWeek] || 'saturday';
  const dayName = getLocalizedWeekdayName(canonDay, isRTL);
  
  const todayStr = toLocalISODate();
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

  const explicitSessions = sessions.filter((s) => s.date === dateStr);
  const items: DetailedDateAgendaItem[] = [];

  const representedGroupTimes = new Set<string>();

  for (const session of explicitSessions) {
    const group = groupsMap.get(session.groupId);
    const isPrivate = group?.type === 'private' || !!session.studentId;
    const groupEnrs = enrollmentsByGroup.get(session.groupId) || [];
    
    let attendanceList: any[] = [];
    try {
      const rawAtt = localStorage.getItem('tm_v2_attendance');
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
        studentName: stu?.name || (isRTL ? 'طالب' : 'Student'),
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
    const loc = getLocalizedLocationName(group?.roomOrLocation, isRTL);
    const subj = getLocalizedSubjectName(group?.subject, isRTL) || (isPrivate ? (isRTL ? 'درس خاص' : 'Private Lesson') : (isRTL ? 'مجموعة دراسية' : 'Tuition Group'));

    const timeKey = `${session.groupId}_${session.startTime || 'flex'}`;
    representedGroupTimes.add(timeKey);

    items.push({
      id: `ses_item_${session.id}`,
      source: 'session_record',
      session,
      groupId: session.groupId,
      groupName: isPrivate ? (singleStudentName || session.title || (isRTL ? 'درس خاص' : 'Private Lesson')) : (group?.name || session.title || (isRTL ? 'مجموعة' : 'Group')),
      studentId: session.studentId,
      studentName: singleStudentName,
      isPrivate,
      subject: subj,
      stageOrGrade: group?.gradeLevel,
      location: loc,
      dateStr,
      dayName,
      startTime: session.startTime,
      endTime: session.endTime,
      formattedTime,
      sortMinutes,
      status: session.status,
      notes: session.notes,
      accentColor: group?.accentColor || (isPrivate ? '#0F2A4A' : '#17375E'),
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

  // Recurring slots
  if (!isPast) {
    for (const group of groups) {
      if (!group.scheduleDays || !Array.isArray(group.scheduleDays)) continue;
      const meetsOnDay = normalizeScheduleDays(group.scheduleDays).includes(canonDay);
      if (!meetsOnDay) continue;

      const isPrivate = group.type === 'private';
      const groupEnrs = enrollmentsByGroup.get(group.id) || [];

      if (groupEnrs.length > 0) {
        for (const enr of groupEnrs) {
          const student = studentsMap.get(enr.studentId);
          if (!student || student.status === 'archived') continue;

          if (enr.scheduleDays && Array.isArray(enr.scheduleDays) && enr.scheduleDays.length > 0) {
            if (!normalizeScheduleDays(enr.scheduleDays).includes(canonDay)) continue;
          }

          const occurrenceTimes = getTimesForDayInEnrollment(enr, group, canonDay);
          const effectiveTimes = occurrenceTimes.length > 0 ? occurrenceTimes : [group.scheduleTime || '16:00'];

          for (let tIdx = 0; tIdx < effectiveTimes.length; tIdx++) {
            const rawTime = effectiveTimes[tIdx];
            const timeKey = `${group.id}_${rawTime || 'flex'}`;
            const studentTimeKey = `${group.id}_${student.id}_${rawTime || 'flex'}`;
            
            if (representedGroupTimes.has(timeKey) || representedGroupTimes.has(studentTimeKey)) continue;

            const sortMinutes = parseTimeToMinutes(rawTime);
            const formattedTime = formatTimeDisplay(rawTime, isRTL);
            const loc = getLocalizedLocationName(group.roomOrLocation, isRTL);
            const subj = getLocalizedSubjectName(group.subject, isRTL) || (isPrivate ? (isRTL ? 'درس خاص' : 'Private Lesson') : (isRTL ? 'مجموعة' : 'Group'));

            items.push({
              id: `rec_item_${group.id}_${enr.id}_${tIdx}`,
              source: 'recurring_schedule',
              groupId: group.id,
              groupName: isPrivate ? (isRTL ? 'درس خاص' : 'Private Lesson') : group.name,
              studentId: student.id,
              studentName: student.name,
              isPrivate,
              subject: subj,
              stageOrGrade: group.gradeLevel,
              location: loc,
              dateStr,
              dayName,
              startTime: rawTime,
              formattedTime,
              sortMinutes,
              status: 'scheduled',
              accentColor: group.accentColor || (isPrivate ? '#0F2A4A' : '#17375E'),
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
        const groupTimes = getTimesForDayInGroup(group, canonDay);
        const effectiveTimes = groupTimes.length > 0 ? groupTimes : [group.scheduleTime || '16:00'];

        for (let tIdx = 0; tIdx < effectiveTimes.length; tIdx++) {
          const rawTime = effectiveTimes[tIdx];
          const timeKey = `${group.id}_${rawTime || 'flex'}`;
          if (representedGroupTimes.has(timeKey)) continue;

          const sortMinutes = parseTimeToMinutes(rawTime);
          const formattedTime = formatTimeDisplay(rawTime, isRTL);
          const loc = getLocalizedLocationName(group.roomOrLocation, isRTL);
          const subj = getLocalizedSubjectName(group.subject, isRTL) || (isRTL ? 'مجموعة دراسية' : 'Tuition Group');

          items.push({
            id: `rec_grp_${group.id}_${tIdx}`,
            source: 'recurring_schedule',
            groupId: group.id,
            groupName: group.name,
            isPrivate,
            subject: subj,
            stageOrGrade: group.gradeLevel,
            location: loc,
            dateStr,
            dayName,
            startTime: rawTime,
            formattedTime,
            sortMinutes,
            status: 'scheduled',
            accentColor: group.accentColor || '#17375E',
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

  items.sort((a, b) => {
    if (a.sortMinutes !== b.sortMinutes) {
      return a.sortMinutes - b.sortMinutes;
    }
    return (a.studentName || a.groupName).localeCompare(b.studentName || b.groupName);
  });

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

  let formattedDisplayDate = dateStr;
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const mIdx = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (isRTL) {
        formattedDisplayDate = `${dayName}، ${d} ${MONTH_NAMES_ARABIC[mIdx] || ''} ${y}`;
      } else {
        formattedDisplayDate = `${dayName}, ${MONTH_NAMES_ENGLISH[mIdx] || ''} ${d}, ${y}`;
      }
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
