import { LocalNotifications } from '@capacitor/local-notifications';
import { db } from './storage';
import { getScheduledClassesForDate } from './schedule';

export const BASE_ATTENDANCE_REMINDER_CHANNEL_ID = 'daily_attendance_reminder_channel';
export const ATTENDANCE_REMINDER_NOTIFICATION_ID = 1001;
const STORAGE_KEY_LAST_REMINDER_SENT_DATE = 'classy_last_attendance_reminder_sent_date';
const STORAGE_KEY_ACTIVE_CHANNEL_ID = 'classy_active_notification_channel_id';

export interface UnrecordedSessionInfo {
  id: string;
  title: string;
  time?: string;
  isPrivate?: boolean;
  groupId?: string;
  studentId?: string;
}

export interface NotificationSoundOption {
  id: string;
  uri: string;
  nameAr: string;
  nameEn: string;
}

/** Predefined sound presets available for Android notifications */
export const AVAILABLE_NOTIFICATION_SOUNDS: NotificationSoundOption[] = [
  {
    id: 'beep',
    uri: 'beep.wav',
    nameAr: 'نغمة كلاسي الكلاسيكية (Beep)',
    nameEn: 'Classy Alert (Beep)',
  },
  {
    id: 'chime',
    uri: 'classy_chime.wav',
    nameAr: 'رنين هادئ (Chime)',
    nameEn: 'Soft Chime',
  },
  {
    id: 'bell',
    uri: 'bell.wav',
    nameAr: 'جرس الحصة (School Bell)',
    nameEn: 'School Bell',
  },
  {
    id: 'crystal',
    uri: 'crystal.wav',
    nameAr: 'كريستال خفيف (Crystal)',
    nameEn: 'Crystal Tone',
  },
  {
    id: 'whistle',
    uri: 'whistle.wav',
    nameAr: 'صفارة لطيفة (Gentle Whistle)',
    nameEn: 'Gentle Whistle',
  },
  {
    id: 'system_default',
    uri: 'default',
    nameAr: 'نغمة النظام الافتراضية',
    nameEn: 'System Default Sound',
  },
];

/**
 * Format local date as YYYY-MM-DD using system local timezone
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format time display for Arabic/English (e.g. "22:00" -> "10:00 م" / "10:00 PM")
 */
export function formatReminderTimeDisplay(timeStr: string = '22:00', isEn: boolean = false): string {
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr || '22', 10);
  const m = parseInt(mStr || '00', 10);
  if (isNaN(h)) h = 22;
  const mm = String(isNaN(m) ? 0 : m).padStart(2, '0');

  const periodEn = h >= 12 ? 'PM' : 'AM';
  const periodAr = h >= 12 ? 'م' : 'ص';
  const displayH = h % 12 === 0 ? 12 : h % 12;

  if (isEn) {
    return `${displayH}:${mm} ${periodEn}`;
  }
  return `${displayH}:${mm} ${periodAr}`;
}

/**
 * Generates a dynamic notification channel ID based on sound URI.
 * In Android 8.0+, channel sound is immutable once created by the OS.
 * Using a sound-specific channel ID guarantees that when the user changes sound,
 * a fresh channel with the new sound is bound and played.
 */
export function getNotificationChannelIdForSound(soundUri?: string): string {
  if (!soundUri || soundUri === 'default') {
    return `${BASE_ATTENDANCE_REMINDER_CHANNEL_ID}_default`;
  }
  const cleanKey = soundUri.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  return `${BASE_ATTENDANCE_REMINDER_CHANNEL_ID}_${cleanKey}`;
}

/**
 * Dynamically creates or updates the Android notification channel with the selected sound URI.
 */
export async function createOrUpdateNotificationChannel(soundUri?: string): Promise<string> {
  const effectiveSound = soundUri || 'beep.wav';
  const newChannelId = getNotificationChannelIdForSound(effectiveSound);

  try {
    const previousChannelId = typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY_ACTIVE_CHANNEL_ID)
      : null;

    // If channel changed, remove previous channel to avoid stale channels in system settings
    if (previousChannelId && previousChannelId !== newChannelId) {
      try {
        await LocalNotifications.deleteChannel({ id: previousChannelId });
      } catch {}
    }

    // Create or recreate the Android High-Priority Notification Channel with custom sound URI
    await LocalNotifications.createChannel({
      id: newChannelId,
      name: 'Classy Attendance Reminder',
      description: 'Daily reminders for unrecorded session attendance with custom alert sound',
      importance: 5, // High Importance (Heads-up alert)
      visibility: 1, // Public visibility on lockscreen
      sound: effectiveSound === 'default' ? undefined : effectiveSound,
      vibration: true,
      lights: true,
      lightColor: '#0A3D62',
    });

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ACTIVE_CHANNEL_ID, newChannelId);
    }
  } catch {
    // Graceful fallback for non-native / browser environments
  }

  return newChannelId;
}

/**
 * Accurately check today's sessions to find any with NO attendance status recorded
 */
export function checkTodayUnrecordedSessions(
  targetDate: Date = new Date(),
  userId?: string
): { count: number; unrecordedItems: UnrecordedSessionInfo[] } {
  const dateStr = getLocalDateString(targetDate);
  const allSessions = db.getSessions(userId);
  const allGroups = db.getGroups(userId);
  const allEnrollments = db.getEnrollments(userId);
  const allStudents = db.getStudents(userId);
  const allAttendance = db.getAttendance(userId);

  // 1. Sessions explicitly stored for today
  const todaySavedSessions = allSessions.filter(
    (s) => s.date === dateStr && s.status !== 'cancelled'
  );

  // 2. Scheduled classes according to schedule calendar
  const scheduledClasses = getScheduledClassesForDate(targetDate, allGroups, allEnrollments, allStudents);

  const unrecordedList: UnrecordedSessionInfo[] = [];
  const processedSessionIds = new Set<string>();

  // Check saved sessions for today
  for (const session of todaySavedSessions) {
    processedSessionIds.add(session.id);
    const sessionAtt = allAttendance.filter((a) => a.sessionId === session.id);

    // If no attendance records exist at all
    if (sessionAtt.length === 0) {
      unrecordedList.push({
        id: session.id,
        title: session.title,
        time: session.startTime,
        isPrivate: !!session.studentId,
        groupId: session.groupId,
        studentId: session.studentId,
      });
    } else {
      // Check if all records are unrecorded or if there are valid status records (present, late, absent_charged, absent_free, excused)
      const hasRecordedStatus = sessionAtt.some(
        (a) =>
          a.status === 'present' ||
          a.status === 'late' ||
          a.status === 'absent_charged' ||
          a.status === 'absent_free' ||
          a.status === 'excused' ||
          a.status === 'absent'
      );
      if (!hasRecordedStatus) {
        unrecordedList.push({
          id: session.id,
          title: session.title,
          time: session.startTime,
          isPrivate: !!session.studentId,
          groupId: session.groupId,
          studentId: session.studentId,
        });
      }
    }
  }

  // Check scheduled classes that might not have a saved session record yet
  for (const item of scheduledClasses) {
    const matchingSession = todaySavedSessions.find(
      (s) =>
        s.groupId === item.groupId &&
        (!item.studentId || s.studentId === item.studentId)
    );

    if (!matchingSession) {
      // Scheduled class has no saved session and no attendance recorded
      unrecordedList.push({
        id: item.id,
        title: item.isPrivate ? `${item.studentName} (درس خاص)` : item.groupName,
        time: item.time,
        isPrivate: item.isPrivate,
        groupId: item.groupId,
        studentId: item.studentId,
      });
    }
  }

  return {
    count: unrecordedList.length,
    unrecordedItems: unrecordedList,
  };
}

/**
 * Initialize notification channels and tap action listeners
 */
export async function initLocalNotifications(onNotificationTapped?: (data: any) => void): Promise<void> {
  try {
    const settings = db.getNotificationSettings();
    const soundUri = settings.notificationSoundUri || 'beep.wav';

    // Create or update channel with the configured sound
    await createOrUpdateNotificationChannel(soundUri);

    // Remove any previous listener before attaching to avoid duplicate handlers
    await LocalNotifications.removeAllListeners();

    // Listen for notification tap
    await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const extra = event.notification.extra;
      if (onNotificationTapped) {
        onNotificationTapped(extra);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('classy_open_attendance_reminder', {
            detail: extra,
          })
        );
      }
    });
  } catch {
    // Native local notifications might not be available in standard browser test environments
  }
}

/**
 * Request notification permissions safely
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const check = await LocalNotifications.checkPermissions();
    if (check.display === 'granted') {
      return true;
    }
    const req = await LocalNotifications.requestPermissions();
    return req.display === 'granted';
  } catch {
    return false;
  }
}

/**
 * Check notification permission status
 */
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    const check = await LocalNotifications.checkPermissions();
    return check.display === 'granted';
  } catch {
    return false;
  }
}

/**
 * Dynamically updates the user's sound preference, updates/recreates the channel,
 * and reschedules any pending reminder with the new sound.
 */
export async function updateNotificationSoundPreference(
  soundUri: string,
  soundName?: string,
  userId?: string,
  isEn?: boolean
): Promise<{ channelId: string; soundUri: string }> {
  const effectiveUserId = userId || db.getCurrentSession()?.id;
  const currentSettings = db.getNotificationSettings(effectiveUserId);

  const updatedSettings = {
    ...currentSettings,
    notificationSoundUri: soundUri,
    notificationSoundName: soundName || soundUri,
  };

  db.saveNotificationSettings(updatedSettings, effectiveUserId);

  // Recreate the channel with new sound
  const channelId = await createOrUpdateNotificationChannel(soundUri);

  // Reschedule reminder to apply the new sound channel
  await scheduleDailyAttendanceReminder({
    userId: effectiveUserId,
    isEn,
    forceSchedule: false,
  });

  return { channelId, soundUri };
}

/**
 * Schedule or update the Daily Attendance Reminder with dynamic sound channel
 */
export async function scheduleDailyAttendanceReminder(
  options?: {
    forceSchedule?: boolean;
    userId?: string;
    isEn?: boolean;
  }
): Promise<{
  scheduled: boolean;
  unrecordedCount: number;
  triggerDate?: Date;
  channelId?: string;
  soundUri?: string;
  reason?: string;
}> {
  const userId = options?.userId || db.getCurrentSession()?.id;
  const settings = db.getNotificationSettings(userId);
  const isEn = options?.isEn ?? false;
  const soundUri = settings.notificationSoundUri || 'beep.wav';

  // 1. If reminder is disabled, cancel any scheduled notifications
  if (settings.enableDailyAttendanceReminder === false) {
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: ATTENDANCE_REMINDER_NOTIFICATION_ID }],
      });
    } catch {}
    return {
      scheduled: false,
      unrecordedCount: 0,
      reason: 'disabled',
    };
  }

  // Ensure channel exists with current sound URI
  const channelId = await createOrUpdateNotificationChannel(soundUri);

  // 2. Parse configured reminder time (e.g. "22:00")
  const reminderTime = settings.dailyAttendanceReminderTime || '22:00';
  const [hStr, mStr] = reminderTime.split(':');
  let targetHour = parseInt(hStr || '22', 10);
  let targetMinute = parseInt(mStr || '0', 10);
  if (isNaN(targetHour)) targetHour = 22;
  if (isNaN(targetMinute)) targetMinute = 0;

  const now = new Date();
  const dateStrToday = getLocalDateString(now);

  // Target trigger timestamp today
  const targetTriggerToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHour, targetMinute, 0, 0);

  // Check missing attendance for today
  const { count: unrecordedCount } = checkTodayUnrecordedSessions(now, userId);

  // Determine whether to schedule for today or tomorrow
  let triggerDate: Date;

  if (now.getTime() < targetTriggerToday.getTime()) {
    // Reminder time today is still in the future!
    if (unrecordedCount === 0 && !options?.forceSchedule) {
      // All sessions for today are already recorded, do not trigger today!
      try {
        await LocalNotifications.cancel({
          notifications: [{ id: ATTENDANCE_REMINDER_NOTIFICATION_ID }],
        });
      } catch {}
      return {
        scheduled: false,
        unrecordedCount: 0,
        channelId,
        soundUri,
        reason: 'all_sessions_recorded',
      };
    }
    triggerDate = targetTriggerToday;
  } else {
    // Reminder time today has already passed -> prime for tomorrow at the configured time
    triggerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, targetHour, targetMinute, 0, 0);
  }

  // Prevent duplicate notifications if already sent today
  const lastSentDate = typeof localStorage !== 'undefined'
    ? localStorage.getItem(`${STORAGE_KEY_LAST_REMINDER_SENT_DATE}_${userId || 'master'}`)
    : null;

  if (lastSentDate === dateStrToday && !options?.forceSchedule && triggerDate === targetTriggerToday) {
    return {
      scheduled: false,
      unrecordedCount,
      channelId,
      soundUri,
      reason: 'already_sent_today',
    };
  }

  // 3. Build localized Title and Body
  const title = isEn ? 'Attendance Reminder' : 'تذكير تسجيل الحضور';
  let body = '';

  if (isEn) {
    if (unrecordedCount === 1) {
      body = 'You have 1 session without attendance recorded today.';
    } else {
      body = `You have ${unrecordedCount} sessions without attendance recorded today.`;
    }
  } else {
    if (unrecordedCount === 1) {
      body = 'لديك حصة واحدة لم يتم تسجيل حضورها اليوم';
    } else if (unrecordedCount === 2) {
      body = 'حصتان تحتاجان إلى تسجيل الحضور اليوم';
    } else {
      body = `لديك ${unrecordedCount} حصص لم يتم تسجيل حضورها اليوم`;
    }
  }

  try {
    // Cancel existing reminder first
    await LocalNotifications.cancel({
      notifications: [{ id: ATTENDANCE_REMINDER_NOTIFICATION_ID }],
    });

    // Schedule local notification with sound URI and dynamic channel
    await LocalNotifications.schedule({
      notifications: [
        {
          id: ATTENDANCE_REMINDER_NOTIFICATION_ID,
          title,
          body,
          channelId,
          sound: soundUri === 'default' ? undefined : soundUri,
          schedule: {
            at: triggerDate,
            allowWhileIdle: true,
          },
          smallIcon: 'ic_launcher',
          iconColor: '#0A3D62',
          extra: {
            type: 'daily_attendance_reminder',
            date: dateStrToday,
            unrecordedCount,
            soundUri,
            channelId,
            scheduledAt: triggerDate.toISOString(),
          },
        },
      ],
    });

    return {
      scheduled: true,
      unrecordedCount,
      triggerDate,
      channelId,
      soundUri,
    };
  } catch (err) {
    return {
      scheduled: false,
      unrecordedCount,
      channelId,
      soundUri,
      reason: 'error',
    };
  }
}

/**
 * Immediate test notification for testing and verification with current custom sound
 */
export async function sendTestAttendanceReminderNotification(
  isEn: boolean = false,
  customSoundUri?: string
): Promise<boolean> {
  try {
    await requestNotificationPermission();
    const settings = db.getNotificationSettings();
    const soundUri = customSoundUri || settings.notificationSoundUri || 'beep.wav';

    // Recreate/update channel for test
    const channelId = await createOrUpdateNotificationChannel(soundUri);

    const { count } = checkTodayUnrecordedSessions();
    const displayCount = count > 0 ? count : 2;

    const title = isEn ? 'Attendance Reminder' : 'تذكير تسجيل الحضور';
    let body = '';

    if (isEn) {
      body = displayCount === 1
        ? 'You have 1 session without attendance recorded today.'
        : `You have ${displayCount} sessions without attendance recorded today.`;
    } else {
      body = displayCount === 1
        ? 'لديك حصة واحدة لم يتم تسجيل حضورها اليوم'
        : displayCount === 2
        ? 'حصتان تحتاجان إلى تسجيل الحضور اليوم'
        : `لديك ${displayCount} حصص لم يتم تسجيل حضورها اليوم`;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: 1002, // Test ID
          title,
          body,
          channelId,
          sound: soundUri === 'default' ? undefined : soundUri,
          schedule: {
            at: new Date(Date.now() + 1000), // 1 second
            allowWhileIdle: true,
          },
          smallIcon: 'ic_launcher',
          iconColor: '#0A3D62',
          extra: {
            type: 'daily_attendance_reminder',
            isTest: true,
            soundUri,
            channelId,
            date: getLocalDateString(),
          },
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}
