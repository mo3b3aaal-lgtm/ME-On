import { db } from './storage';
import { getScheduledClassesForDate } from './schedule';
import {
  VERIFIED_NOTIFICATION_SOUNDS,
  createOrUpdatePlatformChannel,
  dispatchImmediateDeviceNotification,
  getChannelIdForSettings,
  initNotificationSystem,
  normalizeNotificationSettings,
  normalizeSoundPreset,
  playNotificationSoundTone,
  reconcileScheduledNotifications,
  refreshPermissionStatus,
  requestPlatformNotificationPermission,
} from './notificationCenter';

export const BASE_ATTENDANCE_REMINDER_CHANNEL_ID = 'classy_alerts';
export const ATTENDANCE_REMINDER_NOTIFICATION_ID = 1001;

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

/**
 * Verified sound presets delegating to centralized notificationCenter.ts
 * (Never references nonexistent bundled .wav files)
 */
export const AVAILABLE_NOTIFICATION_SOUNDS: NotificationSoundOption[] =
  VERIFIED_NOTIFICATION_SOUNDS.map((s) => ({
    id: s.id,
    uri: s.uri,
    nameAr: s.nameAr,
    nameEn: s.nameEn,
  }));

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

export function getNotificationChannelIdForSound(soundUri?: string): string {
  const current = normalizeNotificationSettings(db.getNotificationSettings());
  const preset = normalizeSoundPreset(soundUri || current.soundPreset || current.notificationSoundUri);
  return getChannelIdForSettings({
    ...current,
    soundPreset: preset,
    notificationSoundUri: preset,
  });
}

export async function createOrUpdateNotificationChannel(soundUri?: string): Promise<string> {
  const current = normalizeNotificationSettings(db.getNotificationSettings());
  const preset = normalizeSoundPreset(soundUri || current.soundPreset || current.notificationSoundUri);
  return createOrUpdatePlatformChannel({
    ...current,
    soundPreset: preset,
    notificationSoundUri: preset,
  });
}

export function checkTodayUnrecordedSessions(
  targetDate: Date = new Date(),
  userId?: string
): { count: number; unrecordedItems: UnrecordedSessionInfo[] } {
  const dateStr = getLocalDateString(targetDate);
  const allSessions = db.getSessions(userId);
  const allGroups = db.getGroups(userId);
  const allEnrollments = db.getEnrollments(userId);
  const allStudents = db.getStudents(userId).filter((s) => s.status !== 'archived');
  const allAttendance = db.getAttendance(userId);

  const todaySavedSessions = allSessions.filter(
    (s) => s.date === dateStr && s.status !== 'cancelled'
  );
  const scheduledClasses = getScheduledClassesForDate(
    targetDate,
    allGroups,
    allEnrollments,
    allStudents
  );

  const unrecordedList: UnrecordedSessionInfo[] = [];

  for (const session of todaySavedSessions) {
    const sessionAtt = allAttendance.filter((a) => a.sessionId === session.id);
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

  for (const item of scheduledClasses) {
    const matchingSession = allSessions.find(
      (s) =>
        s.date === dateStr &&
        (s.groupId === item.groupId || (item.enrollmentId && s.enrollmentId === item.enrollmentId)) &&
        (!item.studentId || s.studentId === item.studentId)
    );

    if (!matchingSession) {
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

export async function initLocalNotifications(
  onNotificationTapped?: (data: any) => void
): Promise<void> {
  await initNotificationSystem(onNotificationTapped);
}

export async function requestNotificationPermission(): Promise<boolean> {
  const status = await requestPlatformNotificationPermission();
  return status === 'granted';
}

export async function checkNotificationPermission(): Promise<boolean> {
  const status = await refreshPermissionStatus();
  return status === 'granted';
}

export async function updateNotificationSoundPreference(
  soundUri: string,
  soundName?: string,
  userId?: string,
  isEn?: boolean
): Promise<{ channelId: string; soundUri: string }> {
  const effectiveUserId = userId || db.getCurrentSession()?.id;
  const currentSettings = normalizeNotificationSettings(db.getNotificationSettings(effectiveUserId));
  const preset = normalizeSoundPreset(soundUri);
  const matched =
    VERIFIED_NOTIFICATION_SOUNDS.find((s) => s.id === preset) || VERIFIED_NOTIFICATION_SOUNDS[0];

  const updatedSettings = normalizeNotificationSettings({
    ...currentSettings,
    soundPreset: preset,
    notificationSoundUri: preset,
    notificationSoundName: soundName || (isEn ? matched.nameEn : matched.nameAr),
    enableNotificationSound: preset !== 'silent',
  });

  db.saveNotificationSettings(updatedSettings, effectiveUserId);
  const channelId = await createOrUpdatePlatformChannel(updatedSettings);
  await reconcileScheduledNotifications({ userId: effectiveUserId, isEn });

  return { channelId, soundUri: preset };
}

export async function scheduleDailyAttendanceReminder(options?: {
  forceSchedule?: boolean;
  userId?: string;
  isEn?: boolean;
}): Promise<{
  scheduled: boolean;
  unrecordedCount: number;
  triggerDate?: Date;
  channelId?: string;
  soundUri?: string;
  reason?: string;
}> {
  const userId = options?.userId || db.getCurrentSession()?.id;
  const settings = normalizeNotificationSettings(db.getNotificationSettings(userId));
  const { count: unrecordedCount } = checkTodayUnrecordedSessions(new Date(), userId);

  const res = await reconcileScheduledNotifications({
    userId,
    isEn: options?.isEn,
  });

  return {
    scheduled: res.scheduledCount > 0,
    unrecordedCount,
    channelId: res.channelId,
    soundUri: settings.soundPreset || 'default',
    reason: !settings.enableNotifications || !settings.enableDailyAttendanceReminder ? 'disabled' : undefined,
  };
}

export async function sendTestAttendanceReminderNotification(
  isEn: boolean = false,
  customSoundUri?: string
): Promise<boolean> {
  await requestPlatformNotificationPermission();
  const settings = normalizeNotificationSettings(db.getNotificationSettings());
  const soundPreset = normalizeSoundPreset(
    customSoundUri || settings.soundPreset || settings.notificationSoundUri
  );
  const { count } = checkTodayUnrecordedSessions();
  const displayCount = count > 0 ? count : 1;

  const title = isEn ? 'Classy Alert Test' : 'تجربة إشعار كلاسي';
  const body = isEn
    ? `Notifications are active (${displayCount} pending ${displayCount === 1 ? 'lesson' : 'lessons'} today).`
    : `نظام التنبيهات يعمل بنجاح (${displayCount === 1 ? 'حصة واحدة بانتظار الرصد' : `${displayCount} حصص بانتظار الرصد`} اليوم).`;

  const dispatched = await dispatchImmediateDeviceNotification({
    idKey: `test_alert_${Date.now()}`,
    title,
    body,
    category: 'system',
    priority: 'critical',
    bypassQuietHours: true,
    extra: {
      type: 'daily_attendance_reminder',
      actionType: 'open_session',
      isTest: true,
      date: getLocalDateString(),
      targetTab: 'sessions',
    },
  });

  // Always play tone preview if browser Notification permission wasn't granted yet so user hears confirmation
  if (!dispatched && soundPreset !== 'silent') {
    const tone = await playNotificationSoundTone(soundPreset, { isPreview: true, settings });
    return tone.played;
  }

  return dispatched || soundPreset === 'silent';
}
