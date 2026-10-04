import { useState, useEffect, useCallback, useRef } from 'react';
import { getLocalDateString, getLocalDateParts, getMsUntilNextLocalMidnight, getDeviceTimezone, LocalDateParts } from './localDate';
import { CanonicalWeekday } from './schedule';

export interface UseCurrentLocalDateResult {
  todayStr: string; // YYYY-MM-DD in local timezone
  canonicalWeekday: CanonicalWeekday;
  weekdayIndex: number;
  now: Date;
  timeZone: string;
  parts: LocalDateParts;
  forceDayRefresh: () => void;
}

/**
 * Global subscriber set to synchronize all components immediately upon local midnight rollover
 */
const dateChangeListeners = new Set<() => void>();

export function notifyGlobalDateChange() {
  dateChangeListeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('Error notifying date change listener:', err);
    }
  });
}

/**
 * React hook that dynamically tracks the current device local date (YYYY-MM-DD),
 * accurately triggers re-renders at local midnight (00:00:00),
 * and catches wake-from-sleep / tab-focus / timezone changes.
 */
export function useCurrentLocalDate(): UseCurrentLocalDateResult {
  const [now, setNow] = useState<Date>(() => new Date());
  const [timeZone, setTimeZone] = useState<string>(() => getDeviceTimezone());
  const lastKnownDateStrRef = useRef<string>(getLocalDateString(new Date(), getDeviceTimezone()));

  const parts = getLocalDateParts(now, timeZone);
  const todayStr = parts.dateStr;

  const checkAndUpdateDate = useCallback(() => {
    const currentNow = new Date();
    const currentTz = getDeviceTimezone();
    const newDateStr = getLocalDateString(currentNow, currentTz);

    if (newDateStr !== lastKnownDateStrRef.current || currentTz !== timeZone) {
      lastKnownDateStrRef.current = newDateStr;
      setTimeZone(currentTz);
      setNow(currentNow);
      notifyGlobalDateChange();
      window.dispatchEvent(new CustomEvent('classy_local_midnight_rollover', { detail: { newDateStr, timeZone: currentTz } }));
    }
  }, [timeZone]);

  const forceDayRefresh = useCallback(() => {
    const currentNow = new Date();
    const currentTz = getDeviceTimezone();
    lastKnownDateStrRef.current = getLocalDateString(currentNow, currentTz);
    setTimeZone(currentTz);
    setNow(currentNow);
    notifyGlobalDateChange();
  }, []);

  useEffect(() => {
    // 1. Subscribe to global sync
    const onGlobalChange = () => {
      setNow(new Date());
      setTimeZone(getDeviceTimezone());
    };
    dateChangeListeners.add(onGlobalChange);

    // 2. Schedule exact local midnight rollover
    let midnightTimeout: any = null;
    const scheduleNextMidnight = () => {
      if (midnightTimeout) clearTimeout(midnightTimeout);
      const msUntilMidnight = getMsUntilNextLocalMidnight(timeZone);
      // Add small buffer (+50ms) to ensure we have passed into the new day
      midnightTimeout = setTimeout(() => {
        checkAndUpdateDate();
        scheduleNextMidnight();
      }, msUntilMidnight + 50);
    };

    scheduleNextMidnight();

    // 3. Heartbeat check every 30s to catch wake from sleep, system time change, or background resume
    const heartbeatInterval = setInterval(() => {
      checkAndUpdateDate();
    }, 30000);

    // 4. Listen to visibility change & window focus
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkAndUpdateDate();
        scheduleNextMidnight();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('online', handleVisibilityOrFocus);

    return () => {
      dateChangeListeners.delete(onGlobalChange);
      if (midnightTimeout) clearTimeout(midnightTimeout);
      clearInterval(heartbeatInterval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('online', handleVisibilityOrFocus);
    };
  }, [timeZone, checkAndUpdateDate]);

  return {
    todayStr,
    canonicalWeekday: parts.canonicalWeekday,
    weekdayIndex: parts.weekdayIndex,
    now,
    timeZone,
    parts,
    forceDayRefresh,
  };
}
