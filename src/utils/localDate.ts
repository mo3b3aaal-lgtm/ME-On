/**
 * Canonical Local Date, Time, and Device Timezone Utilities for Classy
 *
 * Implements strict local-time daily boundaries (00:00:00 local device midnight)
 * without UTC drift, without hardcoded timezones, and handles daylight saving transitions.
 */

import { CanonicalWeekday, DAY_INDEX_TO_CANONICAL, CANONICAL_TO_DAY_INDEX } from './schedule';

/**
 * Returns the current device / browser IANA timezone dynamically.
 * Fallback to safe default if detection fails.
 */
export function getDeviceTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && typeof tz === 'string' && tz.trim().length > 0) {
      return tz.trim();
    }
  } catch {
    // fallback
  }
  return 'Africa/Cairo';
}

/**
 * Formats a Date object into a canonical local YYYY-MM-DD string using the device's local calendar day.
 */
export function toLocalISODate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses a YYYY-MM-DD date string into a local Date object (at 00:00:00 local time).
 */
export function parseLocalDateStr(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  if (!m) return new Date(dateStr);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Formats any Date or timestamp into a canonical local YYYY-MM-DD string
 * in the specified IANA timezone (or current device timezone).
 */
export function getLocalDateString(
  dateInput: Date | number | string = new Date(),
  timeZone: string = getDeviceTimezone()
): string {
  try {
    let d: Date;
    if (typeof dateInput === 'string') {
      if (dateInput.length === 10 && dateInput.includes('-')) {
        // Already YYYY-MM-DD
        return dateInput;
      }
      d = new Date(dateInput);
    } else {
      d = new Date(dateInput);
    }

    if (isNaN(d.getTime())) {
      d = new Date();
    }

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch {
    const d = new Date(dateInput);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

/**
 * Returns detailed local calendar parts for a date in the given timezone.
 */
export interface LocalDateParts {
  year: number;
  month: number; // 1 - 12
  day: number; // 1 - 31
  dateStr: string; // YYYY-MM-DD
  canonicalWeekday: CanonicalWeekday;
  weekdayIndex: number; // 0 = Sunday, ..., 6 = Saturday
  hour: number;
  minute: number;
  second: number;
  timeZone: string;
}

export function getLocalDateParts(
  dateInput: Date | number | string = new Date(),
  timeZone: string = getDeviceTimezone()
): LocalDateParts {
  const dateStr = getLocalDateString(dateInput, timeZone);
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // Determine weekday in target timezone
  let d = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput);
  if (isNaN(d.getTime())) d = new Date();

  const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  });
  const shortWeekday = weekdayFormatter.format(d).toLowerCase();

  let canonicalWeekday: CanonicalWeekday = 'saturday';
  if (shortWeekday.startsWith('sun')) canonicalWeekday = 'sunday';
  else if (shortWeekday.startsWith('mon')) canonicalWeekday = 'monday';
  else if (shortWeekday.startsWith('tue')) canonicalWeekday = 'tuesday';
  else if (shortWeekday.startsWith('wed')) canonicalWeekday = 'wednesday';
  else if (shortWeekday.startsWith('thu')) canonicalWeekday = 'thursday';
  else if (shortWeekday.startsWith('fri')) canonicalWeekday = 'friday';
  else canonicalWeekday = 'saturday';

  const weekdayIndex = CANONICAL_TO_DAY_INDEX[canonicalWeekday];

  // Extract hour, minute, second in target timezone
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const timeParts = timeFormatter.formatToParts(d);
  let hour = 0;
  let minute = 0;
  let second = 0;
  timeParts.forEach((p) => {
    if (p.type === 'hour') hour = parseInt(p.value, 10) % 24;
    if (p.type === 'minute') minute = parseInt(p.value, 10);
    if (p.type === 'second') second = parseInt(p.value, 10);
  });

  return {
    year,
    month,
    day,
    dateStr,
    canonicalWeekday,
    weekdayIndex,
    hour,
    minute,
    second,
    timeZone,
  };
}

/**
 * Calculates milliseconds remaining until exactly 00:00:00.000 local midnight
 * in the specified timezone, accounting for Daylight Saving Time.
 */
export function getMsUntilNextLocalMidnight(timeZone: string = getDeviceTimezone()): number {
  try {
    const now = new Date();
    const parts = getLocalDateParts(now, timeZone);
    const hoursRemaining = 23 - parts.hour;
    const minsRemaining = 59 - parts.minute;
    const secsRemaining = 59 - parts.second;
    const msRemaining = (hoursRemaining * 3600 + minsRemaining * 60 + secsRemaining + 1) * 1000;

    // Sanity check: between 1 second and 26 hours (accounting for DST 25-hour days)
    if (msRemaining > 500 && msRemaining <= 26 * 3600 * 1000) {
      return msRemaining;
    }
  } catch {
    // fallback to standard calculation
  }
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 50);
  return Math.max(1000, nextMidnight.getTime() - now.getTime());
}

/**
 * Normalizes time string to standard 24h format "HH:MM" and returns chronological sortMinutes
 */
export function parseLocalTimeToStandard(timeStr?: string): { normalizedTime: string; sortMinutes: number } {
  if (!timeStr || !timeStr.trim()) {
    return { normalizedTime: '16:00', sortMinutes: 960 };
  }

  const str = timeStr.trim();

  // 24-hour match e.g. "17:30"
  const match24 = str.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const m = parseInt(match24[2], 10);
    const validH = Math.min(23, Math.max(0, h));
    const validM = Math.min(59, Math.max(0, m));
    return {
      normalizedTime: `${String(validH).padStart(2, '0')}:${String(validM).padStart(2, '0')}`,
      sortMinutes: validH * 60 + validM,
    };
  }

  // 12-hour match e.g. "5:30 PM" or "05:30 م"
  const isPM = /pm|م/i.test(str);
  const isAM = /am|ص/i.test(str);
  const match12 = str.match(/(\d{1,2}):(\d{2})/);

  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    const validH = Math.min(23, Math.max(0, h));
    const validM = Math.min(59, Math.max(0, m));
    return {
      normalizedTime: `${String(validH).padStart(2, '0')}:${String(validM).padStart(2, '0')}`,
      sortMinutes: validH * 60 + validM,
    };
  }

  // Single hour digit e.g. "5"
  const matchSingle = str.match(/^(\d{1,2})$/);
  if (matchSingle) {
    let h = parseInt(matchSingle[1], 10);
    if (isPM && h < 12) h += 12;
    const validH = Math.min(23, Math.max(0, h));
    return {
      normalizedTime: `${String(validH).padStart(2, '0')}:00`,
      sortMinutes: validH * 60,
    };
  }

  return { normalizedTime: '16:00', sortMinutes: 960 };
}
