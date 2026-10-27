import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  ActiveTab,
  Attendance,
  Enrollment,
  Group,
  LessonReminderLeadMinutes,
  NotificationCategory,
  NotificationHistoryRetentionDays,
  NotificationPriority,
  NotificationSettings,
  NotificationSoundPreset,
  NotificationStateItem,
  PersistedNotificationEvent,
  Payment,
  ScheduledNotificationRecord,
  Session,
  SmartReminderItem,
  Student,
} from '../types';
import { db, registerNotificationDomainHooks } from './storage';
import {
  DAY_INDEX_TO_CANONICAL,
  formatTimeDisplay,
  getScheduledClassesForDate,
  isEnrollmentActiveOnDate,
  isExplicitPrivateSessionOperationalOnDate,
  normalizeScheduleDays,
  parseTimeToMinutes,
} from './schedule';
import { getAppLanguage } from './i18n';
import { parseLocalDateStr, toLocalISODate } from './localDate';
import { isHapticsEnabled, triggerLightHaptic } from './haptics';

// ============================================================================
// STORAGE KEYS & CONSTANTS
// ============================================================================

const STORAGE_KEY_EVENTS_PREFIX = 'tm_v2_notification_events';
const STORAGE_KEY_SCHEDULED_PREFIX = 'tm_v2_scheduled_notifs';
const STORAGE_KEY_COOLDOWNS_PREFIX = 'tm_v2_notification_cooldowns';
const STORAGE_KEY_SYNC_ALERT_STATE_PREFIX = 'tm_v2_notif_sync_state';
const STORAGE_KEY_ACTIVE_CHANNEL_ID = 'classy_active_notification_channel_id';

const MAX_PERSISTED_EVENTS = 200;
const MAX_SCHEDULED_LOCAL_NOTIFICATIONS = 48;
const SYNC_FAILURE_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours anti-spam cooldown

export type OsPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface NotificationSoundPresetOption {
  id: NotificationSoundPreset;
  uri: NotificationSoundPreset;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
}

/**
 * Verified sound options that never reference nonexistent bundled asset files.
 * - 'default': Uses native OS default notification sound on Android; Web Audio chime on web/preview.
 * - 'soft_chime': Gentle notification channel on Android; soft triad chime on web/preview.
 * - 'silent': Silent channel (no sound) across all platforms.
 */
export const VERIFIED_NOTIFICATION_SOUNDS: NotificationSoundPresetOption[] = [
  {
    id: 'default',
    uri: 'default',
    nameAr: 'نغمة الجهاز الافتراضية',
    nameEn: 'Default Device Sound',
    descAr: 'تستخدم نغمة الإشعارات المعتمدة في إعدادات الهاتف',
    descEn: 'Uses the device standard notification tone',
  },
  {
    id: 'soft_chime',
    uri: 'soft_chime',
    nameAr: 'رنين هادئ لطيف',
    nameEn: 'Soft Chime',
    descAr: 'تنبيه صوتي خفيف وهادئ',
    descEn: 'Subtle, gentle alert chime',
  },
  {
    id: 'silent',
    uri: 'silent',
    nameAr: 'صامت (بدون صوت)',
    nameEn: 'Silent',
    descAr: 'إشعار مرئي بدون إصدار صوت',
    descEn: 'Visual alert with no sound',
  },
];

export const LESSON_LEAD_TIME_OPTIONS: LessonReminderLeadMinutes[] = [5, 10, 15, 30, 60];
export const HISTORY_RETENTION_OPTIONS: NotificationHistoryRetentionDays[] = [7, 30, 90, 365];

export const PROFESSIONAL_DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  // Master controls
  enableNotifications: true,
  enableMobileNotifications: true,
  enableInAppNotifications: true,
  enableNotificationSound: true,
  enableNotificationVibration: true,

  // Quiet hours
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  quietHoursDays: [],
  allowCriticalDuringQuietHours: false,

  // Category A — Lesson reminders
  enableLessonReminders: true,
  lessonReminderLeadMinutes: 15,
  enableDayOfLessonReminder: false,
  dayOfLessonReminderTime: '08:00',
  enableGroupLessonReminders: true,
  enablePrivateLessonReminders: true,

  // Category B — Attendance & missed lessons
  enableAttendanceReminders: true,
  enableStudentAbsenceAlerts: true,
  enableAbsenceReminders: true,
  enablePostLessonCompletionReminder: true,
  postLessonReminderDelayMinutes: 30,
  enableDailyAttendanceReminder: true,
  dailyAttendanceReminderTime: '22:00',

  // Category C — Student financial alerts
  enableOverdueReminders: true,
  enablePaymentRecordedAlerts: false,
  enableBalanceThresholdAlert: false,
  balanceThresholdAmount: 500,
  enableTodayLessonDebtAlerts: true,

  // Category D — Package & subscription alerts
  enablePackageCompletedAlerts: true,
  enableOneSessionRemainingAlert: true,
  enableEarlyPackageWarning: true,
  earlyWarningLessonThreshold: 2,
  enablePrepaidCreditExhaustedAlerts: true,

  // Category E — Student records & follow-ups
  enableFinancialFollowUpAlerts: true,
  enableIncompleteLessonAlerts: true,

  // Category F — Backup & synchronization
  enableSyncFailureAlerts: true,
  enableBackupFailureAlerts: true,
  enableBackupCompletionAlerts: false,

  // Category G — System & permission alerts
  enableSystemPermissionAlerts: true,

  // Sound & history
  soundPreset: 'default',
  notificationSoundUri: 'default',
  notificationSoundName: 'Default Device Sound',
  historyRetentionDays: 30,
};

// ============================================================================
// REACTIVE REVISION & SUBSCRIPTION BUS (ZERO FULL-DB SCAN / ZERO SYNC BLOAT)
// ============================================================================

let notificationRevision = 1;
const notificationListeners = new Set<() => void>();
let cachedPermissionStatus: OsPermissionState = 'prompt';

export function getNotificationRevision(): number {
  return notificationRevision;
}

export function bumpNotificationRevision(): void {
  notificationRevision++;
  notificationListeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

export function subscribeToNotifications(listener: () => void): () => void {
  notificationListeners.add(listener);
  return () => {
    notificationListeners.delete(listener);
  };
}

function resolveUserId(explicitUserId?: string): string {
  if (explicitUserId && explicitUserId.trim()) return explicitUserId.trim();
  try {
    const cur = db.getCurrentSession();
    if (cur?.id) return cur.id;
  } catch {}
  return 'acc_master_teacher';
}

// ============================================================================
// 1. NOTIFICATION PREFERENCES & BACKWARD-COMPATIBLE MIGRATION
// ============================================================================

export function normalizeSoundPreset(rawSound?: string | null): NotificationSoundPreset {
  if (!rawSound) return 'default';
  const clean = rawSound.trim().toLowerCase();
  if (clean === 'silent' || clean === 'none' || clean === 'mute') {
    return 'silent';
  }
  if (
    clean === 'soft_chime' ||
    clean === 'chime' ||
    clean === 'classy_chime.wav' ||
    clean === 'crystal.wav'
  ) {
    return 'soft_chime';
  }
  // Legacy nonexistent .wav values ('beep.wav', 'bell.wav', 'whistle.wav') normalize safely to 'default'
  return 'default';
}

export function normalizeNotificationSettings(
  raw?: Partial<NotificationSettings> | null
): NotificationSettings {
  const src = raw && typeof raw === 'object' ? raw : {};

  const resolvedAbsenceAlerts =
    src.enableStudentAbsenceAlerts !== undefined
      ? Boolean(src.enableStudentAbsenceAlerts)
      : src.enableAbsenceReminders !== undefined
      ? Boolean(src.enableAbsenceReminders)
      : PROFESSIONAL_DEFAULT_NOTIFICATION_SETTINGS.enableStudentAbsenceAlerts!;

  const resolvedLead = LESSON_LEAD_TIME_OPTIONS.includes(
    Number(src.lessonReminderLeadMinutes) as LessonReminderLeadMinutes
  )
    ? (Number(src.lessonReminderLeadMinutes) as LessonReminderLeadMinutes)
    : 15;

  const resolvedRetention = HISTORY_RETENTION_OPTIONS.includes(
    Number(src.historyRetentionDays) as NotificationHistoryRetentionDays
  )
    ? (Number(src.historyRetentionDays) as NotificationHistoryRetentionDays)
    : 30;

  const resolvedPreset = normalizeSoundPreset(src.soundPreset || src.notificationSoundUri);
  const soundMeta =
    VERIFIED_NOTIFICATION_SOUNDS.find((s) => s.id === resolvedPreset) ||
    VERIFIED_NOTIFICATION_SOUNDS[0];

  const thresholdLessons =
    typeof src.earlyWarningLessonThreshold === 'number' && src.earlyWarningLessonThreshold >= 1
      ? Math.min(10, Math.floor(src.earlyWarningLessonThreshold))
      : PROFESSIONAL_DEFAULT_NOTIFICATION_SETTINGS.earlyWarningLessonThreshold;

  const thresholdAmount =
    typeof src.balanceThresholdAmount === 'number' && src.balanceThresholdAmount > 0
      ? Math.round(src.balanceThresholdAmount)
      : 500;

  const postDelay =
    typeof src.postLessonReminderDelayMinutes === 'number' &&
    src.postLessonReminderDelayMinutes >= 5
      ? Math.min(180, Math.floor(src.postLessonReminderDelayMinutes))
      : 30;

  return {
    ...PROFESSIONAL_DEFAULT_NOTIFICATION_SETTINGS,
    ...src,
    enableNotifications: src.enableNotifications !== false,
    enableMobileNotifications: src.enableMobileNotifications !== false,
    enableInAppNotifications: src.enableInAppNotifications !== false,
    enableNotificationSound: src.enableNotificationSound !== false,
    enableNotificationVibration: src.enableNotificationVibration !== false,
    quietHoursEnabled: Boolean(src.quietHoursEnabled),
    quietHoursStart: src.quietHoursStart || '22:00',
    quietHoursEnd: src.quietHoursEnd || '07:00',
    quietHoursDays: Array.isArray(src.quietHoursDays)
      ? normalizeScheduleDays(src.quietHoursDays)
      : [],
    allowCriticalDuringQuietHours: Boolean(src.allowCriticalDuringQuietHours),

    enableLessonReminders: src.enableLessonReminders !== false,
    lessonReminderLeadMinutes: resolvedLead,
    enableDayOfLessonReminder: Boolean(src.enableDayOfLessonReminder),
    dayOfLessonReminderTime: src.dayOfLessonReminderTime || '08:00',
    enableGroupLessonReminders: src.enableGroupLessonReminders !== false,
    enablePrivateLessonReminders: src.enablePrivateLessonReminders !== false,

    enableAttendanceReminders:
      src.enableAttendanceReminders !== undefined ? Boolean(src.enableAttendanceReminders) : true,
    enableStudentAbsenceAlerts: resolvedAbsenceAlerts,
    enableAbsenceReminders: resolvedAbsenceAlerts,
    enablePostLessonCompletionReminder: src.enablePostLessonCompletionReminder !== false,
    postLessonReminderDelayMinutes: postDelay,
    enableDailyAttendanceReminder: src.enableDailyAttendanceReminder !== false,
    dailyAttendanceReminderTime: src.dailyAttendanceReminderTime || '22:00',

    enableOverdueReminders:
      src.enableOverdueReminders !== undefined ? Boolean(src.enableOverdueReminders) : true,
    enablePaymentRecordedAlerts: Boolean(src.enablePaymentRecordedAlerts),
    enableBalanceThresholdAlert: Boolean(src.enableBalanceThresholdAlert),
    balanceThresholdAmount: thresholdAmount,
    enableTodayLessonDebtAlerts: src.enableTodayLessonDebtAlerts !== false,

    enablePackageCompletedAlerts: src.enablePackageCompletedAlerts !== false,
    enableOneSessionRemainingAlert: src.enableOneSessionRemainingAlert !== false,
    enableEarlyPackageWarning:
      src.enableEarlyPackageWarning !== undefined ? Boolean(src.enableEarlyPackageWarning) : true,
    earlyWarningLessonThreshold: thresholdLessons,
    enablePrepaidCreditExhaustedAlerts: src.enablePrepaidCreditExhaustedAlerts !== false,

    enableFinancialFollowUpAlerts: src.enableFinancialFollowUpAlerts !== false,
    enableIncompleteLessonAlerts: src.enableIncompleteLessonAlerts !== false,

    enableSyncFailureAlerts: src.enableSyncFailureAlerts !== false,
    enableBackupFailureAlerts: src.enableBackupFailureAlerts !== false,
    enableBackupCompletionAlerts: Boolean(src.enableBackupCompletionAlerts),

    enableSystemPermissionAlerts: src.enableSystemPermissionAlerts !== false,

    soundPreset: resolvedPreset,
    notificationSoundUri: resolvedPreset,
    notificationSoundName: src.notificationSoundName || soundMeta.nameEn,
    historyRetentionDays: resolvedRetention,
  };
}

export async function restoreDefaultNotificationSettings(
  userId?: string,
  isEn?: boolean
): Promise<NotificationSettings> {
  const uid = resolveUserId(userId);
  const defaults = normalizeNotificationSettings(PROFESSIONAL_DEFAULT_NOTIFICATION_SETTINGS);
  db.saveNotificationSettings(defaults, uid);
  await createOrUpdatePlatformChannel(defaults);
  await reconcileScheduledNotifications({ userId: uid, isEn });
  bumpNotificationRevision();
  return defaults;
}

// ============================================================================
// 2. QUIET HOURS ENGINE
// ============================================================================

function parseHHMM(timeStr: string | undefined, fallbackMinutes: number): number {
  if (!timeStr || typeof timeStr !== 'string') return fallbackMinutes;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return fallbackMinutes;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return fallbackMinutes;
  return h * 60 + m;
}

export function isWithinQuietHours(date: Date, settings: NotificationSettings): boolean {
  if (!settings.quietHoursEnabled) return false;

  const startMins = parseHHMM(settings.quietHoursStart, 22 * 60);
  const endMins = parseHHMM(settings.quietHoursEnd, 7 * 60);
  const currentMins = date.getHours() * 60 + date.getMinutes();

  const restrictedDays =
    settings.quietHoursDays && settings.quietHoursDays.length > 0
      ? normalizeScheduleDays(settings.quietHoursDays)
      : [];

  const todayCanon = DAY_INDEX_TO_CANONICAL[date.getDay()] || 'saturday';
  const yesterdayDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  const yesterdayCanon = DAY_INDEX_TO_CANONICAL[yesterdayDate.getDay()] || 'friday';

  if (startMins === endMins) {
    return restrictedDays.length === 0 || restrictedDays.includes(todayCanon);
  }

  if (startMins < endMins) {
    // Same-day window (e.g., 13:00 -> 15:00)
    if (currentMins < startMins || currentMins >= endMins) return false;
    return restrictedDays.length === 0 || restrictedDays.includes(todayCanon);
  }

  // Overnight window (e.g., 22:00 -> 07:00)
  if (currentMins >= startMins) {
    return restrictedDays.length === 0 || restrictedDays.includes(todayCanon);
  }
  if (currentMins < endMins) {
    return (
      restrictedDays.length === 0 ||
      restrictedDays.includes(todayCanon) ||
      restrictedDays.includes(yesterdayCanon)
    );
  }
  return false;
}

export function getQuietHoursEndTimestamp(fromDate: Date, settings: NotificationSettings): Date {
  const endMins = parseHHMM(settings.quietHoursEnd, 7 * 60);
  const endHour = Math.floor(endMins / 60);
  const endMinute = endMins % 60;
  const currentMins = fromDate.getHours() * 60 + fromDate.getMinutes();

  if (currentMins < endMins) {
    return new Date(
      fromDate.getFullYear(),
      fromDate.getMonth(),
      fromDate.getDate(),
      endHour,
      endMinute,
      5,
      0
    );
  }
  return new Date(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate() + 1,
    endHour,
    endMinute,
    5,
    0
  );
}

export function shouldSuppressMobileAlert(
  targetDate: Date,
  priority: NotificationPriority,
  settings: NotificationSettings
): boolean {
  if (!settings.enableNotifications || !settings.enableMobileNotifications) {
    return true;
  }
  if (!isWithinQuietHours(targetDate, settings)) {
    return false;
  }
  if (priority === 'critical' && settings.allowCriticalDuringQuietHours) {
    return false;
  }
  return true;
}

// ============================================================================
// 3. PLATFORM NOTIFICATION ADAPTER (CAPACITOR ANDROID + WEB FALLBACK + AUDIO)
// ============================================================================

export interface PlatformNotificationCapabilities {
  platform: 'capacitor-native' | 'web';
  platformName: string;
  inAppSupported: boolean;
  localDeviceSupported: boolean;
  soundPreviewSupported: boolean;
  remotePushSupported: boolean;
  remotePushStatusNoteAr: string;
  remotePushStatusNoteEn: string;
  permissionStatus: OsPermissionState;
}

export function isNativeNotificationPlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getPermissionStatusSync(): OsPermissionState {
  if (isNativeNotificationPlatform()) {
    return cachedPermissionStatus;
  }
  if (typeof window !== 'undefined' && 'Notification' in window) {
    const p = window.Notification.permission;
    if (p === 'granted') return 'granted';
    if (p === 'denied') return 'denied';
    return 'prompt';
  }
  return 'unsupported';
}

export async function refreshPermissionStatus(): Promise<OsPermissionState> {
  if (isNativeNotificationPlatform()) {
    try {
      const check = await LocalNotifications.checkPermissions();
      const mapped: OsPermissionState =
        check.display === 'granted'
          ? 'granted'
          : check.display === 'denied'
          ? 'denied'
          : 'prompt';
      if (cachedPermissionStatus !== mapped) {
        cachedPermissionStatus = mapped;
        bumpNotificationRevision();
      }
      return mapped;
    } catch {
      return cachedPermissionStatus;
    }
  }
  const webPerm = getPermissionStatusSync();
  if (cachedPermissionStatus !== webPerm) {
    cachedPermissionStatus = webPerm;
    bumpNotificationRevision();
  }
  return webPerm;
}

export async function requestPlatformNotificationPermission(): Promise<OsPermissionState> {
  if (isNativeNotificationPlatform()) {
    try {
      const current = await LocalNotifications.checkPermissions();
      if (current.display === 'granted') {
        cachedPermissionStatus = 'granted';
        bumpNotificationRevision();
        return 'granted';
      }
      const req = await LocalNotifications.requestPermissions();
      cachedPermissionStatus =
        req.display === 'granted' ? 'granted' : req.display === 'denied' ? 'denied' : 'prompt';
      bumpNotificationRevision();
      return cachedPermissionStatus;
    } catch {
      return 'unsupported';
    }
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (window.Notification.permission === 'granted') {
        cachedPermissionStatus = 'granted';
        bumpNotificationRevision();
        return 'granted';
      }
      const res = await window.Notification.requestPermission();
      cachedPermissionStatus =
        res === 'granted' ? 'granted' : res === 'denied' ? 'denied' : 'prompt';
      bumpNotificationRevision();
      return cachedPermissionStatus;
    } catch {
      return getPermissionStatusSync();
    }
  }

  return 'unsupported';
}

export function getPlatformNotificationCapabilities(): PlatformNotificationCapabilities {
  const isNative = isNativeNotificationPlatform();
  let platformName = 'web';
  try {
    platformName = Capacitor.getPlatform();
  } catch {}

  const webNotifAvailable = typeof window !== 'undefined' && 'Notification' in window;
  const audioAvailable =
    typeof window !== 'undefined' &&
    Boolean((window as any).AudioContext || (window as any).webkitAudioContext);

  return {
    platform: isNative ? 'capacitor-native' : 'web',
    platformName,
    inAppSupported: true,
    localDeviceSupported: isNative || webNotifAvailable,
    soundPreviewSupported: audioAvailable || isNative,
    remotePushSupported: false,
    remotePushStatusNoteAr:
      'التنبيهات المحلية المجدولة وتنبيهات داخل التطبيق مفعلة بالكامل. الإشعارات السحابية الخلفية (FCM Push) غير مفعلة لعدم إعداد خدمة دفع خادم خارجية.',
    remotePushStatusNoteEn:
      'Scheduled local device alerts and in-app notifications are active. Background server push (FCM) is inactive because no remote push sender is configured.',
    permissionStatus: getPermissionStatusSync(),
  };
}

export function getChannelIdForSettings(settings: NotificationSettings): string {
  const preset = normalizeSoundPreset(settings.soundPreset || settings.notificationSoundUri);
  const soundOn = settings.enableNotificationSound !== false && preset !== 'silent';
  const vibrateOn = settings.enableNotificationVibration !== false && isHapticsEnabled();
  const soundPart = soundOn ? preset : 'silent';
  const vibPart = vibrateOn ? 'vib' : 'novib';
  return `classy_alerts_${soundPart}_${vibPart}`;
}

export async function createOrUpdatePlatformChannel(
  customSettings?: NotificationSettings
): Promise<string> {
  const settings = normalizeNotificationSettings(customSettings || db.getNotificationSettings());
  const channelId = getChannelIdForSettings(settings);

  if (!isNativeNotificationPlatform()) {
    return channelId;
  }

  const preset = normalizeSoundPreset(settings.soundPreset || settings.notificationSoundUri);
  const soundEnabled = settings.enableNotificationSound !== false && preset !== 'silent';
  const vibrationEnabled = settings.enableNotificationVibration !== false && isHapticsEnabled();

  try {
    const previousChannelId =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(STORAGE_KEY_ACTIVE_CHANNEL_ID)
        : null;

    if (previousChannelId && previousChannelId !== channelId) {
      try {
        await LocalNotifications.deleteChannel({ id: previousChannelId });
      } catch {}
    }

    await LocalNotifications.createChannel({
      id: channelId,
      name:
        !soundEnabled
          ? 'Classy Silent Alerts'
          : preset === 'soft_chime'
          ? 'Classy Soft Alerts'
          : 'Classy Important Alerts',
      description: 'Classy lesson, attendance, and student management notifications',
      importance: !soundEnabled ? 2 : preset === 'soft_chime' ? 3 : 5,
      visibility: 1,
      // Omit custom sound filename so Android uses real system notification sound when soundEnabled is true
      sound: undefined,
      vibration: vibrationEnabled,
      lights: true,
      lightColor: '#17375E',
    });

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ACTIVE_CHANNEL_ID, channelId);
    }
  } catch {
    // Safe fallback if native bridge is unavailable
  }

  return channelId;
}

/**
 * Plays a clean synthesized tone using Web Audio API without requiring external audio asset files.
 * Works offline across desktop/mobile browsers, PWAs, and Android WebView.
 */
export async function playNotificationSoundTone(
  presetInput?: string,
  options?: { isPreview?: boolean; settings?: NotificationSettings }
): Promise<{ played: boolean; reason?: string }> {
  const settings = normalizeNotificationSettings(options?.settings || db.getNotificationSettings());
  const preset = normalizeSoundPreset(
    presetInput || settings.soundPreset || settings.notificationSoundUri
  );

  if (preset === 'silent') {
    return { played: false, reason: 'silent_preset' };
  }

  if (!options?.isPreview && (!settings.enableNotifications || !settings.enableNotificationSound)) {
    return { played: false, reason: 'sound_disabled' };
  }

  if (typeof window === 'undefined') {
    return { played: false, reason: 'no_window' };
  }

  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    return { played: false, reason: 'audio_context_unavailable' };
  }

  try {
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      await ctx.resume();
    }

    const now = ctx.currentTime;
    const notes =
      preset === 'soft_chime'
        ? [
            { freq: 523.25, start: 0, dur: 0.16, gain: 0.08, type: 'sine' as OscillatorType },
            { freq: 659.25, start: 0.11, dur: 0.22, gain: 0.07, type: 'sine' as OscillatorType },
          ]
        : [
            { freq: 587.33, start: 0, dur: 0.14, gain: 0.13, type: 'triangle' as OscillatorType },
            { freq: 880.0, start: 0.13, dur: 0.24, gain: 0.12, type: 'sine' as OscillatorType },
          ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = note.type;
      osc.frequency.setValueAtTime(note.freq, now + note.start);

      gainNode.gain.setValueAtTime(0.0001, now + note.start);
      gainNode.gain.exponentialRampToValueAtTime(note.gain, now + note.start + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.dur);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(now + note.start);
      osc.stop(now + note.start + note.dur + 0.02);
    }

    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 650);

    return { played: true };
  } catch {
    return { played: false, reason: 'audio_playback_blocked' };
  }
}

export function triggerNotificationVibrationIfAllowed(settings: NotificationSettings): void {
  if (
    settings.enableNotifications !== false &&
    settings.enableNotificationVibration !== false &&
    isHapticsEnabled()
  ) {
    triggerLightHaptic();
  }
}

export async function dispatchImmediateDeviceNotification(params: {
  idKey: string;
  title: string;
  body: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  extra?: Record<string, any>;
  userId?: string;
  bypassQuietHours?: boolean;
}): Promise<boolean> {
  const uid = resolveUserId(params.userId);
  const settings = normalizeNotificationSettings(db.getNotificationSettings(uid));

  if (!settings.enableNotifications || !settings.enableMobileNotifications) {
    return false;
  }

  const now = new Date();
  if (!params.bypassQuietHours && shouldSuppressMobileAlert(now, params.priority, settings)) {
    return false;
  }

  const numericId = hashStringToNotificationId(`imm_${uid}_${params.idKey}`);

  if (isNativeNotificationPlatform()) {
    try {
      const perm = await refreshPermissionStatus();
      if (perm !== 'granted') return false;
      const channelId = await createOrUpdatePlatformChannel(settings);
      await LocalNotifications.schedule({
        notifications: [
          {
            id: numericId,
            title: params.title,
            body: params.body,
            channelId,
            schedule: {
              at: new Date(Date.now() + 600),
              allowWhileIdle: true,
            },
            smallIcon: 'ic_launcher',
            iconColor: '#17375E',
            extra: {
              ...(params.extra || {}),
              userId: uid,
              category: params.category,
            },
          },
        ],
      });
      return true;
    } catch {
      return false;
    }
  }

  // Browser / PWA fallback using Web Notification API when permitted
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (window.Notification.permission === 'granted') {
      try {
        const silent =
          settings.enableNotificationSound === false ||
          normalizeSoundPreset(settings.soundPreset || settings.notificationSoundUri) === 'silent';

        const n = new window.Notification(params.title, {
          body: params.body,
          tag: `${uid}_${params.idKey}`,
          silent,
        });
        n.onclick = () => {
          try {
            window.focus();
            if (typeof CustomEvent === 'function') {
              window.dispatchEvent(
                new CustomEvent('classy_notification_tapped', {
                  detail: { ...(params.extra || {}), userId: uid, category: params.category },
                })
              );
            }
          } catch {}
          n.close();
        };

        if (!silent) {
          playNotificationSoundTone(settings.soundPreset, { settings }).catch(() => {});
        }
        triggerNotificationVibrationIfAllowed(settings);
        return true;
      } catch {
        return false;
      }
    }
  }

  return false;
}

// ============================================================================
// 4. DETERMINISTIC IDEMPOTENT NOTIFICATION SCHEDULER
// ============================================================================

let foregroundAlarmTimer: ReturnType<typeof setTimeout> | null = null;
const firedForegroundKeys = new Set<string>();

export function hashStringToNotificationId(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Positive 31-bit integer in [10000, 2147400000] avoiding 1001/1002 legacy static IDs
  const positive = Math.abs(hash >>> 1);
  return 10000 + (positive % 2147300000);
}

export function getScheduledRegistry(userId?: string): Record<string, ScheduledNotificationRecord> {
  const uid = resolveUserId(userId);
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_SCHEDULED_PREFIX}_${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return {};
}

function saveScheduledRegistry(
  registry: Record<string, ScheduledNotificationRecord>,
  userId?: string
): void {
  const uid = resolveUserId(userId);
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_KEY_SCHEDULED_PREFIX}_${uid}`, JSON.stringify(registry));
  } catch {}
}

function clearForegroundAlarmTimer(): void {
  if (foregroundAlarmTimer !== null) {
    clearTimeout(foregroundAlarmTimer);
    foregroundAlarmTimer = null;
  }
}

function scheduleNearestForegroundWebTimer(
  desiredList: ScheduledNotificationRecord[],
  userId: string
): void {
  clearForegroundAlarmTimer();
  if (isNativeNotificationPlatform() || typeof window === 'undefined') return;
  if (desiredList.length === 0) return;

  const nowMs = Date.now();
  const upcoming = desiredList
    .map((item) => ({ item, ms: new Date(item.triggerAt).getTime() }))
    .filter(
      ({ item, ms }) =>
        !isNaN(ms) &&
        ms > nowMs &&
        ms - nowMs <= 6 * 60 * 60 * 1000 &&
        !firedForegroundKeys.has(item.fingerprint)
    )
    .sort((a, b) => a.ms - b.ms);

  if (upcoming.length === 0) return;

  const next = upcoming[0];
  const delayMs = Math.max(500, next.ms - nowMs);

  foregroundAlarmTimer = setTimeout(() => {
    foregroundAlarmTimer = null;
    const activeSessionUser = db.getCurrentSession()?.id || 'acc_master_teacher';
    if (activeSessionUser !== userId) return;

    firedForegroundKeys.add(next.item.fingerprint);
    dispatchImmediateDeviceNotification({
      idKey: next.item.key,
      title: next.item.title,
      body: next.item.body,
      category: next.item.category,
      priority: 'high',
      extra: next.item.extra,
      userId,
    }).catch(() => {});

    bumpNotificationRevision();
    scheduleNearestForegroundWebTimer(desiredList, userId);
  }, delayMs);
}

function buildLocalTimestamp(dateStr: string, rawTime: string | undefined, fallbackMinutes = 16 * 60): Date | null {
  const d = parseLocalDateStr(dateStr);
  if (isNaN(d.getTime())) return null;
  const mins = parseTimeToMinutes(rawTime);
  const resolvedMins = mins === 99999 ? fallbackMinutes : mins;
  const h = Math.floor(resolvedMins / 60) % 24;
  const m = resolvedMins % 60;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
}

function isSessionPrivateEntity(
  session: Session,
  groupsById: Map<string, Group>,
  enrollmentsById: Map<string, Enrollment>
): boolean {
  if (session.studentId) return true;
  if (session.enrollmentId) {
    const enr = enrollmentsById.get(session.enrollmentId);
    if (enr && (enr.serviceType === 'private' || !enr.groupId)) return true;
  }
  if (!session.groupId) return true;
  const grp = groupsById.get(session.groupId);
  return grp?.type === 'private';
}

export function computeDesiredScheduledNotifications(options?: {
  userId?: string;
  isEn?: boolean;
  now?: Date;
}): ScheduledNotificationRecord[] {
  const uid = resolveUserId(options?.userId);
  const settings = normalizeNotificationSettings(db.getNotificationSettings(uid));
  const isEn = options?.isEn ?? getAppLanguage().startsWith('en');
  const isRTL = !isEn;
  const now = options?.now || new Date();
  const nowMs = now.getTime();

  if (!settings.enableNotifications || !settings.enableMobileNotifications) {
    return [];
  }

  const students = db.getStudents(uid);
  const activeStudents = students.filter((s) => s.status !== 'archived');
  const studentsById = new Map(activeStudents.map((s) => [s.id, s]));
  const groups = db.getGroups(uid);
  const groupsById = new Map(groups.map((g) => [g.id, g]));
  const enrollments = db.getEnrollments(uid);
  const enrollmentsById = new Map(enrollments.map((e) => [e.id, e]));
  const sessions = db.getSessions(uid);
  const allAttendance = db.getAttendance(uid);
  const channelId = getChannelIdForSettings(settings);

  const attendanceBySessionId = new Map<string, Attendance[]>();
  for (const att of allAttendance) {
    const arr = attendanceBySessionId.get(att.sessionId);
    if (arr) arr.push(att);
    else attendanceBySessionId.set(att.sessionId, [att]);
  }

  const desired: ScheduledNotificationRecord[] = [];
  const usedNumericIds = new Set<number>();

  const allocateNumericId = (key: string): number => {
    let id = hashStringToNotificationId(`${uid}|${key}`);
    while (usedNumericIds.has(id)) {
      id += 1;
    }
    usedNumericIds.add(id);
    return id;
  };

  const leadMinutes = settings.lessonReminderLeadMinutes || 15;
  const todayStr = toLocalISODate(now);

  // Horizon: next 7 days (offsets 0..6)
  for (let offset = 0; offset < 7; offset++) {
    const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dateStr = toLocalISODate(dayDate);

    const daySessions = sessions.filter((s) => s.date === dateStr);
    const handledSlotKeys = new Set<string>();
    let activeLessonsCountForDay = 0;

    // 1A. Explicit saved sessions for this exact date (never recurring daily)
    for (const s of daySessions) {
      const isPriv = isSessionPrivateEntity(s, groupsById, enrollmentsById);
      const startMins = parseTimeToMinutes(s.startTime);
      const slotMins = startMins === 99999 ? 16 * 60 : startMins;
      const slotKey = isPriv
        ? `priv_${s.studentId || s.enrollmentId || s.id}_${slotMins}`
        : `grp_${s.groupId || s.id}_${slotMins}`;
      handledSlotKeys.add(slotKey);

      if (s.status === 'cancelled' || s.status === 'completed') {
        continue;
      }

      // Skip private session if student was archived/deleted or enrollment is inactive on dateStr
      if (isPriv && s.studentId && !studentsById.has(s.studentId)) {
        continue;
      }
      const sAttList = attendanceBySessionId.get(s.id) || [];
      if (
        isPriv &&
        !isExplicitPrivateSessionOperationalOnDate(
          s,
          dateStr,
          enrollments,
          studentsById,
          sAttList.length > 0
        )
      ) {
        continue;
      }
      if (!isPriv && s.groupId && !groupsById.has(s.groupId)) {
        continue;
      }

      const categoryEnabled = isPriv
        ? settings.enablePrivateLessonReminders !== false
        : settings.enableGroupLessonReminders !== false;

      if (settings.enableLessonReminders !== false && categoryEnabled) {
        activeLessonsCountForDay++;
        const startDate = buildLocalTimestamp(dateStr, s.startTime);
        if (startDate) {
          const triggerDate = new Date(startDate.getTime() - leadMinutes * 60 * 1000);
          if (
            triggerDate.getTime() > nowMs + 1500 &&
            !shouldSuppressMobileAlert(triggerDate, 'high', settings)
          ) {
            const stu = s.studentId ? studentsById.get(s.studentId) : undefined;
            const grp = s.groupId ? groupsById.get(s.groupId) : undefined;
            const label = isPriv
              ? stu?.name || s.title || (isEn ? 'Private Lesson' : 'درس خاص')
              : grp?.name || s.title || (isEn ? 'Group Lesson' : 'حصة مجموعة');
            const formattedTime = formatTimeDisplay(s.startTime, isRTL);

            const title = isEn ? `Upcoming Lesson (${leadMinutes} min)` : `تذكير بحصة قادمة (خلال ${leadMinutes} د)`;
            const body = isEn
              ? `${label} starts at ${formattedTime}`
              : `تبدأ حصة ${label} الساعة ${formattedTime}`;
            const key = `lesson_ses_${s.id}`;
            const triggerIso = triggerDate.toISOString();
            const fingerprint = `${triggerIso}|${title}|${body}|${channelId}`;

            desired.push({
              key,
              numericId: allocateNumericId(key),
              fingerprint,
              triggerAt: triggerIso,
              category: 'lesson_reminders',
              title,
              body,
              extra: {
                actionType: isPriv ? 'open_private_session' : 'record_attendance',
                sessionId: s.id,
                studentId: s.studentId,
                groupId: s.groupId,
                enrollmentId: s.enrollmentId,
                isPrivate: isPriv,
                date: dateStr,
              },
            });
          }
        }
      }

      // Post-lesson attendance completion reminder for today's unrecorded saved sessions
      if (
        offset === 0 &&
        settings.enableAttendanceReminders !== false &&
        settings.enablePostLessonCompletionReminder !== false
      ) {
        const sAtt = attendanceBySessionId.get(s.id) || [];
        if (sAtt.length === 0) {
          const startDate = buildLocalTimestamp(dateStr, s.startTime);
          const endDate = s.endTime ? buildLocalTimestamp(dateStr, s.endTime) : null;
          const baseEnd =
            endDate && startDate && endDate.getTime() > startDate.getTime()
              ? endDate
              : startDate
              ? new Date(startDate.getTime() + 60 * 60 * 1000)
              : null;

          if (baseEnd) {
            let postTrigger = new Date(
              baseEnd.getTime() + (settings.postLessonReminderDelayMinutes || 30) * 60 * 1000
            );
            if (shouldSuppressMobileAlert(postTrigger, 'medium', settings)) {
              postTrigger = getQuietHoursEndTimestamp(postTrigger, settings);
            }
            if (postTrigger.getTime() > nowMs + 1500) {
              const stu = s.studentId ? studentsById.get(s.studentId) : undefined;
              const grp = s.groupId ? groupsById.get(s.groupId) : undefined;
              const label = isPriv
                ? stu?.name || s.title || (isEn ? 'Private Lesson' : 'درس خاص')
                : grp?.name || s.title || (isEn ? 'Group Lesson' : 'حصة مجموعة');

              const title = isEn ? 'Complete Lesson Attendance' : 'تذكير باستكمال حضور الحصة';
              const body = isEn
                ? `Attendance for "${label}" has not been recorded yet.`
                : `لم يتم تسجيل حضور "${label}" بعد انتهاء موعدها.`;
              const key = `post_att_ses_${s.id}_${dateStr}`;
              const triggerIso = postTrigger.toISOString();
              const fingerprint = `${triggerIso}|${title}|${body}|${channelId}`;

              desired.push({
                key,
                numericId: allocateNumericId(key),
                fingerprint,
                triggerAt: triggerIso,
                category: 'attendance',
                title,
                body,
                extra: {
                  actionType: isPriv ? 'open_private_session' : 'record_attendance',
                  sessionId: s.id,
                  studentId: s.studentId,
                  groupId: s.groupId,
                  enrollmentId: s.enrollmentId,
                  isPrivate: isPriv,
                  date: dateStr,
                },
              });
            }
          }
        }
      }
    }

    // 1B. Recurring weekly schedule occurrences for this concrete date
    const recurringItems = getScheduledClassesForDate(
      dayDate,
      groups,
      enrollments,
      activeStudents,
      isRTL
    );

    for (const item of recurringItems) {
      const slotMins = item.sortMinutes === 99999 ? 16 * 60 : item.sortMinutes;
      const slotKey = item.isPrivate
        ? `priv_${item.studentId || item.enrollmentId || item.id}_${slotMins}`
        : `grp_${item.groupId || item.id}_${slotMins}`;

      if (handledSlotKeys.has(slotKey)) {
        continue;
      }
      handledSlotKeys.add(slotKey);

      const categoryEnabled = item.isPrivate
        ? settings.enablePrivateLessonReminders !== false
        : settings.enableGroupLessonReminders !== false;

      if (settings.enableLessonReminders !== false && categoryEnabled) {
        activeLessonsCountForDay++;
        const startDate = buildLocalTimestamp(dateStr, item.rawTime, slotMins);
        if (startDate) {
          const triggerDate = new Date(startDate.getTime() - leadMinutes * 60 * 1000);
          if (
            triggerDate.getTime() > nowMs + 1500 &&
            !shouldSuppressMobileAlert(triggerDate, 'high', settings)
          ) {
            const label = item.isPrivate ? item.studentName : item.groupName;
            const title = isEn
              ? `Upcoming Lesson (${leadMinutes} min)`
              : `تذكير بحصة قادمة (خلال ${leadMinutes} د)`;
            const body = isEn
              ? `${label} starts at ${item.time}`
              : `تبدأ حصة ${label} الساعة ${item.time}`;
            const key = `lesson_rec_${slotKey}_${dateStr}`;
            const triggerIso = triggerDate.toISOString();
            const fingerprint = `${triggerIso}|${title}|${body}|${channelId}`;

            desired.push({
              key,
              numericId: allocateNumericId(key),
              fingerprint,
              triggerAt: triggerIso,
              category: 'lesson_reminders',
              title,
              body,
              extra: {
                actionType: item.isPrivate ? 'open_private_session' : 'record_attendance',
                studentId: item.studentId || undefined,
                groupId: item.groupId || undefined,
                enrollmentId: item.enrollmentId,
                isPrivate: item.isPrivate,
                rawTime: item.rawTime,
                date: dateStr,
              },
            });
          }
        }
      }

      // Post-lesson completion reminder for today's recurring unrecorded class
      if (
        offset === 0 &&
        settings.enableAttendanceReminders !== false &&
        settings.enablePostLessonCompletionReminder !== false
      ) {
        const startDate = buildLocalTimestamp(dateStr, item.rawTime, slotMins);
        if (startDate) {
          const baseEnd = new Date(startDate.getTime() + 60 * 60 * 1000);
          let postTrigger = new Date(
            baseEnd.getTime() + (settings.postLessonReminderDelayMinutes || 30) * 60 * 1000
          );
          if (shouldSuppressMobileAlert(postTrigger, 'medium', settings)) {
            postTrigger = getQuietHoursEndTimestamp(postTrigger, settings);
          }
          if (postTrigger.getTime() > nowMs + 1500) {
            const label = item.isPrivate ? item.studentName : item.groupName;
            const title = isEn ? 'Complete Lesson Attendance' : 'تذكير باستكمال حضور الحصة';
            const body = isEn
              ? `Attendance for "${label}" has not been recorded yet.`
              : `لم يتم تسجيل حضور "${label}" بعد انتهاء موعدها.`;
            const key = `post_att_rec_${slotKey}_${dateStr}`;
            const triggerIso = postTrigger.toISOString();
            const fingerprint = `${triggerIso}|${title}|${body}|${channelId}`;

            desired.push({
              key,
              numericId: allocateNumericId(key),
              fingerprint,
              triggerAt: triggerIso,
              category: 'attendance',
              title,
              body,
              extra: {
                actionType: item.isPrivate ? 'open_private_session' : 'record_attendance',
                studentId: item.studentId || undefined,
                groupId: item.groupId || undefined,
                enrollmentId: item.enrollmentId,
                isPrivate: item.isPrivate,
                rawTime: item.rawTime,
                date: dateStr,
              },
            });
          }
        }
      }
    }

    // 1C. Optional Day-of-Lesson Morning Summary Reminder
    if (
      settings.enableLessonReminders !== false &&
      settings.enableDayOfLessonReminder &&
      activeLessonsCountForDay > 0
    ) {
      let daySummaryTrigger = buildLocalTimestamp(
        dateStr,
        settings.dayOfLessonReminderTime || '08:00',
        8 * 60
      );
      if (daySummaryTrigger) {
        if (shouldSuppressMobileAlert(daySummaryTrigger, 'medium', settings)) {
          daySummaryTrigger = getQuietHoursEndTimestamp(daySummaryTrigger, settings);
        }
        if (
          daySummaryTrigger.getTime() > nowMs + 1500 &&
          toLocalISODate(daySummaryTrigger) === dateStr
        ) {
          const title = isEn ? "Today's Teaching Schedule" : 'جدول حصص اليوم';
          const body = isEn
            ? `You have ${activeLessonsCountForDay} scheduled ${
                activeLessonsCountForDay === 1 ? 'lesson' : 'lessons'
              } today.`
            : `لديك اليوم ${activeLessonsCountForDay} ${
                activeLessonsCountForDay === 1 ? 'حصة مجدولة' : 'حصص مجدولة'
              }.`;
          const key = `lesson_dayof_${dateStr}`;
          const triggerIso = daySummaryTrigger.toISOString();
          const fingerprint = `${triggerIso}|${title}|${body}|${channelId}`;

          desired.push({
            key,
            numericId: allocateNumericId(key),
            fingerprint,
            triggerAt: triggerIso,
            category: 'lesson_reminders',
            title,
            body,
            extra: {
              actionType: 'open_session',
              date: dateStr,
              targetTab: 'sessions',
            },
          });
        }
      }
    }
  }

  // 2. Daily Attendance Sweep Reminder (respects unrecorded count & quiet hours)
  if (
    settings.enableAttendanceReminders !== false &&
    settings.enableDailyAttendanceReminder !== false
  ) {
    const unrecordedTodayCount = countUnrecordedLessonsOnDate(
      now,
      sessions,
      groups,
      enrollments,
      activeStudents,
      attendanceBySessionId,
      isRTL
    );

    const sweepMins = parseHHMM(settings.dailyAttendanceReminderTime || '22:00', 22 * 60);
    const sweepToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      Math.floor(sweepMins / 60),
      sweepMins % 60,
      0,
      0
    );

    let sweepTrigger: Date | null = null;
    let sweepCount = unrecordedTodayCount;

    if (nowMs < sweepToday.getTime()) {
      if (unrecordedTodayCount > 0) {
        sweepTrigger = sweepToday;
      }
    } else {
      // Check if tomorrow has scheduled classes before priming tomorrow's sweep
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const tomorrowUnrecorded = countUnrecordedLessonsOnDate(
        tomorrow,
        sessions,
        groups,
        enrollments,
        activeStudents,
        attendanceBySessionId,
        isRTL
      );
      if (tomorrowUnrecorded > 0) {
        sweepTrigger = new Date(
          tomorrow.getFullYear(),
          tomorrow.getMonth(),
          tomorrow.getDate(),
          Math.floor(sweepMins / 60),
          sweepMins % 60,
          0,
          0
        );
        sweepCount = tomorrowUnrecorded;
      }
    }

    if (sweepTrigger) {
      if (shouldSuppressMobileAlert(sweepTrigger, 'medium', settings)) {
        sweepTrigger = getQuietHoursEndTimestamp(sweepTrigger, settings);
      }
      if (sweepTrigger.getTime() > nowMs + 1500) {
        const targetSweepDateStr = toLocalISODate(sweepTrigger);
        const title = isEn ? 'Attendance Reminder' : 'تذكير تسجيل الحضور';
        const body = isEn
          ? sweepCount === 1
            ? 'You have 1 session without attendance recorded today.'
            : `You have ${sweepCount} sessions without attendance recorded today.`
          : sweepCount === 1
          ? 'لديك حصة واحدة لم يتم تسجيل حضورها اليوم'
          : sweepCount === 2
          ? 'حصتان تحتاجان إلى تسجيل الحضور اليوم'
          : `لديك ${sweepCount} حصص لم يتم تسجيل حضورها اليوم`;

        const key = `daily_att_sweep_${targetSweepDateStr}`;
        const triggerIso = sweepTrigger.toISOString();
        const fingerprint = `${triggerIso}|${title}|${body}|${channelId}`;

        desired.push({
          key,
          numericId: allocateNumericId(key),
          fingerprint,
          triggerAt: triggerIso,
          category: 'attendance',
          title,
          body,
          extra: {
            type: 'daily_attendance_reminder',
            actionType: 'open_session',
            date: todayStr,
            unrecordedCount: sweepCount,
            targetTab: 'sessions',
          },
        });
      }
    }
  }

  desired.sort((a, b) => a.triggerAt.localeCompare(b.triggerAt));
  return desired.slice(0, MAX_SCHEDULED_LOCAL_NOTIFICATIONS);
}

function countUnrecordedLessonsOnDate(
  targetDate: Date,
  sessions: Session[],
  groups: Group[],
  enrollments: Enrollment[],
  activeStudents: Student[],
  attendanceBySessionId: Map<string, Attendance[]>,
  isRTL: boolean
): number {
  const dateStr = toLocalISODate(targetDate);
  const daySessions = sessions.filter((s) => s.date === dateStr);
  const handledSlots = new Set<string>();
  let unrecorded = 0;

  for (const s of daySessions) {
    const startMins = parseTimeToMinutes(s.startTime);
    const slotMins = startMins === 99999 ? 16 * 60 : startMins;
    const isPriv = Boolean(s.studentId || !s.groupId);
    const slotKey = isPriv
      ? `priv_${s.studentId || s.enrollmentId || s.id}_${slotMins}`
      : `grp_${s.groupId || s.id}_${slotMins}`;
    handledSlots.add(slotKey);

    if (s.status === 'cancelled') continue;
    const att = attendanceBySessionId.get(s.id) || [];
    if (
      isPriv &&
      !isExplicitPrivateSessionOperationalOnDate(
        s,
        dateStr,
        enrollments,
        new Map(activeStudents.map((st) => [st.id, st])),
        att.length > 0 || s.status === 'completed'
      )
    ) {
      continue;
    }
    if (att.length === 0) {
      unrecorded++;
    }
  }

  const recurring = getScheduledClassesForDate(
    targetDate,
    groups,
    enrollments,
    activeStudents,
    isRTL
  );
  for (const item of recurring) {
    const slotMins = item.sortMinutes === 99999 ? 16 * 60 : item.sortMinutes;
    const slotKey = item.isPrivate
      ? `priv_${item.studentId || item.enrollmentId || item.id}_${slotMins}`
      : `grp_${item.groupId || item.id}_${slotMins}`;
    if (!handledSlots.has(slotKey)) {
      handledSlots.add(slotKey);
      unrecorded++;
    }
  }

  return unrecorded;
}

export async function reconcileScheduledNotifications(options?: {
  userId?: string;
  isEn?: boolean;
  now?: Date;
}): Promise<{
  scheduledCount: number;
  addedCount: number;
  cancelledCount: number;
  unchangedCount: number;
  channelId: string;
}> {
  const uid = resolveUserId(options?.userId);
  const settings = normalizeNotificationSettings(db.getNotificationSettings(uid));
  const channelId = getChannelIdForSettings(settings);
  const existingRegistry = getScheduledRegistry(uid);
  const desiredList = computeDesiredScheduledNotifications(options);

  const desiredByKey = new Map(desiredList.map((d) => [d.key, d]));
  const idsToCancel: { id: number }[] = [
    { id: 1001 }, // Clean up legacy static ID if previously scheduled
  ];
  const itemsToSchedule: ScheduledNotificationRecord[] = [];
  let unchangedCount = 0;
  let cancelledCount = 0;

  for (const [oldKey, oldRec] of Object.entries(existingRegistry)) {
    const nextRec = desiredByKey.get(oldKey);
    if (!nextRec || nextRec.fingerprint !== oldRec.fingerprint) {
      idsToCancel.push({ id: oldRec.numericId });
      cancelledCount++;
    } else {
      unchangedCount++;
    }
  }

  for (const nextRec of desiredList) {
    const oldRec = existingRegistry[nextRec.key];
    if (!oldRec || oldRec.fingerprint !== nextRec.fingerprint) {
      itemsToSchedule.push(nextRec);
    }
  }

  // Persist next registry synchronously BEFORE awaiting native platform bridge calls
  // so rapid synchronous mutations and verification assertions always observe immediate consistency
  const nextRegistry: Record<string, ScheduledNotificationRecord> = {};
  for (const rec of desiredList) {
    nextRegistry[rec.key] = rec;
  }
  saveScheduledRegistry(nextRegistry, uid);

  if (isNativeNotificationPlatform()) {
    await createOrUpdatePlatformChannel(settings);

    if (idsToCancel.length > 0) {
      try {
        await LocalNotifications.cancel({ notifications: idsToCancel });
      } catch {}
    }

    if (itemsToSchedule.length > 0) {
      try {
        const perm = await refreshPermissionStatus();
        if (perm === 'granted') {
          await LocalNotifications.schedule({
            notifications: itemsToSchedule.map((rec) => ({
              id: rec.numericId,
              title: rec.title,
              body: rec.body,
              channelId,
              schedule: {
                at: new Date(rec.triggerAt),
                allowWhileIdle: true,
              },
              smallIcon: 'ic_launcher',
              iconColor: '#17375E',
              extra: {
                ...rec.extra,
                userId: uid,
                category: rec.category,
                scheduledKey: rec.key,
              },
            })),
          });
        }
      } catch {}
    }
  } else {
    scheduleNearestForegroundWebTimer(desiredList, uid);
  }

  return {
    scheduledCount: desiredList.length,
    addedCount: itemsToSchedule.length,
    cancelledCount,
    unchangedCount,
    channelId,
  };
}

export async function cancelAllScheduledNotificationsForUser(userId?: string): Promise<void> {
  const uid = resolveUserId(userId);
  clearForegroundAlarmTimer();
  const existing = getScheduledRegistry(uid);
  const ids = Object.values(existing).map((r) => ({ id: r.numericId }));
  ids.push({ id: 1001 });

  if (isNativeNotificationPlatform() && ids.length > 0) {
    try {
      await LocalNotifications.cancel({ notifications: ids });
    } catch {}
  }
  saveScheduledRegistry({}, uid);
}

// ============================================================================
// 5. PERSISTED EVENT NOTIFICATIONS & COOLDOWNS
// ============================================================================

export function getPersistedNotificationEvents(userId?: string): PersistedNotificationEvent[] {
  const uid = resolveUserId(userId);
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_EVENTS_PREFIX}_${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((e) => e && e.userId === uid);
      }
    }
  } catch {}
  return [];
}

function savePersistedNotificationEvents(
  events: PersistedNotificationEvent[],
  userId?: string
): void {
  const uid = resolveUserId(userId);
  if (typeof localStorage === 'undefined') return;
  const settings = normalizeNotificationSettings(db.getNotificationSettings(uid));
  const retentionMs = (settings.historyRetentionDays || 30) * 24 * 60 * 60 * 1000;
  const cutoffMs = Date.now() - retentionMs;

  const pruned = events
    .filter((e) => {
      const ts = e.createdAt ? new Date(e.createdAt).getTime() : Date.now();
      return isNaN(ts) || ts >= cutoffMs || e.status === 'active';
    })
    .slice(0, MAX_PERSISTED_EVENTS);

  try {
    localStorage.setItem(`${STORAGE_KEY_EVENTS_PREFIX}_${uid}`, JSON.stringify(pruned));
  } catch {}
}

function getCooldownMap(userId: string): Record<string, number> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_COOLDOWNS_PREFIX}_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return {};
}

function setCooldownTimestamp(cooldownKey: string, userId: string, tsMs = Date.now()): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const map = getCooldownMap(userId);
    map[cooldownKey] = tsMs;
    localStorage.setItem(`${STORAGE_KEY_COOLDOWNS_PREFIX}_${userId}`, JSON.stringify(map));
  } catch {}
}

function isOnCooldown(cooldownKey: string, windowMs: number, userId: string): boolean {
  const map = getCooldownMap(userId);
  const lastTs = map[cooldownKey];
  if (!lastTs) return false;
  return Date.now() - lastTs < windowMs;
}

export function upsertNotificationEvent(
  event: Omit<PersistedNotificationEvent, 'userId'> & { userId?: string },
  options?: { cooldownMs?: number; triggerMobileAlert?: boolean }
): PersistedNotificationEvent | null {
  const uid = resolveUserId(event.userId);
  const settings = normalizeNotificationSettings(db.getNotificationSettings(uid));

  if (!settings.enableNotifications) {
    return null;
  }

  if (options?.cooldownMs && isOnCooldown(event.dedupeKey, options.cooldownMs, uid)) {
    return null;
  }

  const events = getPersistedNotificationEvents(uid);
  const existingIdx = events.findIndex((e) => e.dedupeKey === event.dedupeKey);

  const record: PersistedNotificationEvent = {
    ...event,
    userId: uid,
  };

  if (existingIdx >= 0) {
    // Already exists with identical dedupeKey -> preserve read state and avoid duplicate entries
    events[existingIdx] = {
      ...events[existingIdx],
      ...record,
      createdAt: events[existingIdx].createdAt || record.createdAt,
    };
    savePersistedNotificationEvents(events, uid);
    bumpNotificationRevision();
    return events[existingIdx];
  }

  events.unshift(record);
  savePersistedNotificationEvents(events, uid);

  if (options?.cooldownMs) {
    setCooldownTimestamp(event.dedupeKey, uid);
  }

  if (options?.triggerMobileAlert) {
    const isEn = getAppLanguage().startsWith('en');
    dispatchImmediateDeviceNotification({
      idKey: record.dedupeKey,
      title: isEn ? record.titleEn : record.titleAr,
      body: isEn ? record.descriptionEn : record.descriptionAr,
      category: record.category,
      priority: record.priority,
      extra: {
        actionType: record.actionType,
        studentId: record.studentId,
        groupId: record.groupId,
        sessionId: record.sessionId,
        enrollmentId: record.enrollmentId,
        isPrivate: record.isPrivate,
        targetTab: record.targetTab,
      },
      userId: uid,
    }).catch(() => {});
  }

  bumpNotificationRevision();
  return record;
}

// --- Domain Event Hooks ---

export function notifyAttendanceBatchSaved(params: {
  sessionId: string;
  session?: Session;
  newRecords: Attendance[];
  oldRecords: Attendance[];
  userId?: string;
}): void {
  const uid = resolveUserId(params.userId);
  const settings = normalizeNotificationSettings(db.getNotificationSettings(uid));

  if (
    settings.enableNotifications &&
    settings.enableStudentAbsenceAlerts !== false &&
    params.session?.status !== 'cancelled'
  ) {
    const oldByStudent = new Map(params.oldRecords.map((r) => [r.studentId, r]));
    const groupsById = new Map(db.getGroups(uid).map((g) => [g.id, g]));
    const studentsById = new Map(db.getStudents(uid).map((s) => [s.id, s]));
    const group = params.session?.groupId ? groupsById.get(params.session.groupId) : undefined;
    const isPriv = Boolean(
      params.session?.studentId || !params.session?.groupId || group?.type === 'private'
    );

    for (const rec of params.newRecords) {
      const isAbsence =
        rec.status === 'absent_charged' ||
        rec.status === 'absent' ||
        rec.status === 'absent_free' ||
        rec.status === 'excused';

      if (!isAbsence) continue;

      const prev = oldByStudent.get(rec.studentId);
      const isExcusedOrUncharged =
        rec.status === 'absent_free' || rec.status === 'excused' || rec.isCharged === false;

      const prevWasSameAbsence =
        prev &&
        prev.status === rec.status &&
        Boolean(prev.isCharged !== false) === !isExcusedOrUncharged;

      if (prevWasSameAbsence) continue;

      const student = studentsById.get(rec.studentId);
      if (!student || student.status === 'archived') continue;

      const sessionDate = params.session?.date || toLocalISODate();
      const lessonLabelAr = isPriv ? 'درس خاص' : group?.name || params.session?.title || 'حصة';
      const lessonLabelEn = isPriv
        ? 'Private Lesson'
        : group?.name || params.session?.title || 'Lesson';

      // STRICT RULE: Excused / uncharged absences are NEVER described as financial charges
      const titleAr = isExcusedOrUncharged
        ? `غياب معفي / بعذر: ${student.name}`
        : `تسجيل غياب: ${student.name}`;
      const titleEn = isExcusedOrUncharged
        ? `Excused Absence: ${student.name}`
        : `Student Absent: ${student.name}`;

      const descriptionAr = isExcusedOrUncharged
        ? `تغيب الطالب بعذر (غير محسوب مالياً) في ${lessonLabelAr} بتاريخ ${sessionDate}.`
        : `تغيب الطالب (حصة محسوبة) في ${lessonLabelAr} بتاريخ ${sessionDate}.`;
      const descriptionEn = isExcusedOrUncharged
        ? `Marked absent (uncharged / excused — no fee applied) in ${lessonLabelEn} on ${sessionDate}.`
        : `Marked absent (charged session) in ${lessonLabelEn} on ${sessionDate}.`;

      const badgeAr = isExcusedOrUncharged ? 'غياب غير محسوب' : 'غياب محسوب';
      const badgeEn = isExcusedOrUncharged ? 'Uncharged Absence' : 'Charged Absence';

      const dedupeKey = `evt_absent_${params.sessionId}_${student.id}_${
        isExcusedOrUncharged ? 'free' : 'charged'
      }`;

      upsertNotificationEvent({
        id: dedupeKey,
        dedupeKey,
        userId: uid,
        category: 'attendance',
        type: 'student_absent',
        priority: isExcusedOrUncharged ? 'low' : 'medium',
        status: 'active',
        titleAr,
        titleEn,
        descriptionAr,
        descriptionEn,
        badgeAr,
        badgeEn,
        actionType: 'open_student',
        createdAt: new Date().toISOString(),
        studentId: student.id,
        studentName: student.name,
        studentPhone: student.phone,
        parentPhone: student.parentPhone,
        parentRelation: student.parentRelation,
        groupId: params.session?.groupId || undefined,
        groupName: isPriv ? undefined : group?.name,
        sessionId: params.sessionId,
        enrollmentId: rec.enrollmentId,
        isPrivate: isPriv,
        isChargedAbsence: !isExcusedOrUncharged,
        date: sessionDate,
      });
    }
  }

  reconcileScheduledNotifications({ userId: uid }).catch(() => {});
  bumpNotificationRevision();
}

export function notifyPaymentRecorded(params: {
  payment: Payment;
  userId?: string;
}): void {
  const uid = resolveUserId(params.userId);
  const settings = normalizeNotificationSettings(db.getNotificationSettings(uid));

  if (settings.enableNotifications && settings.enablePaymentRecordedAlerts) {
    const student = db.getStudents(uid).find((s) => s.id === params.payment.studentId);
    const group = params.payment.groupId
      ? db.getGroups(uid).find((g) => g.id === params.payment.groupId)
      : undefined;
    const studentName = student?.name || '';
    const amountStr = Number(params.payment.amount || 0).toLocaleString();
    const dedupeKey = `evt_payment_${params.payment.id}`;

    upsertNotificationEvent(
      {
        id: dedupeKey,
        dedupeKey,
        userId: uid,
        category: 'financial',
        type: 'payment_recorded',
        priority: 'low',
        status: 'active',
        titleAr: `تأكيد تسجيل سداد: ${studentName}`,
        titleEn: `Payment Recorded: ${studentName}`,
        descriptionAr: `تم تحصيل مبلغ ${amountStr} ج.م بنجاح${
          group ? ` (${group.name})` : ''
        }.`,
        descriptionEn: `Recorded payment of ${amountStr} EGP${
          group ? ` (${group.name})` : ''
        }.`,
        badgeAr: `${amountStr} ج.م مدفوعة`,
        badgeEn: `${amountStr} EGP Paid`,
        actionType: 'open_student',
        createdAt: new Date().toISOString(),
        studentId: student?.id || params.payment.studentId,
        studentName,
        groupId: group?.id,
        groupName: group?.name,
        enrollmentId: params.payment.enrollmentId,
        amount: params.payment.amount,
        date: params.payment.date,
      },
      { triggerMobileAlert: false }
    );
  } else {
    bumpNotificationRevision();
  }
}

export function notifySyncOutcome(params: {
  outcome: 'success' | 'server_failure';
  errorReason?: string;
  isManual?: boolean;
  userId?: string;
}): void {
  const uid = resolveUserId(params.userId);
  const settings = normalizeNotificationSettings(db.getNotificationSettings(uid));
  const stateKey = `${STORAGE_KEY_SYNC_ALERT_STATE_PREFIX}_${uid}`;

  let prevAlertState = 'ok';
  if (typeof localStorage !== 'undefined') {
    try {
      prevAlertState = localStorage.getItem(stateKey) || 'ok';
    } catch {}
  }

  if (params.outcome === 'server_failure') {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(stateKey, 'failed');
      } catch {}
    }

    if (!settings.enableNotifications || settings.enableSyncFailureAlerts === false) {
      return;
    }

    const dedupeKey = `evt_sync_failed_${uid}`;
    upsertNotificationEvent(
      {
        id: dedupeKey,
        dedupeKey,
        userId: uid,
        category: 'sync_backup',
        type: 'sync_failed',
        priority: 'high',
        status: 'active',
        titleAr: 'تعذر إتمام المزامنة السحابية',
        titleEn: 'Cloud Sync Failed',
        descriptionAr:
          'تم حفظ بياناتك محلياً بأمان، ولكن تعذر الوصول لخادم المزامنة السحابية. ستتم إعادة المحاولة تلقائياً.',
        descriptionEn:
          'Your data is safely saved locally, but cloud sync could not reach the server. Will retry automatically.',
        badgeAr: 'فشل مزامنة',
        badgeEn: 'Sync Failed',
        actionType: 'open_settings',
        createdAt: new Date().toISOString(),
        date: toLocalISODate(),
        targetTab: 'settings',
      },
      {
        cooldownMs: params.isManual ? 60 * 1000 : SYNC_FAILURE_COOLDOWN_MS,
        triggerMobileAlert: Boolean(params.isManual),
      }
    );
    return;
  }

  // outcome === 'success'
  if (prevAlertState === 'failed') {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(stateKey, 'ok');
      } catch {}
    }

    // Resolve any active sync_failed event
    const events = getPersistedNotificationEvents(uid);
    let updatedAny = false;
    const nowIso = new Date().toISOString();
    for (const ev of events) {
      if (ev.type === 'sync_failed' && ev.status === 'active') {
        ev.status = 'resolved';
        ev.resolvedAt = nowIso;
        updatedAny = true;
      }
    }
    if (updatedAny) {
      savePersistedNotificationEvents(events, uid);
    }

    if (settings.enableNotifications && settings.enableSyncFailureAlerts !== false) {
      const recoveryKey = `evt_sync_restored_${uid}_${toLocalISODate()}_${Math.floor(
        Date.now() / 60000
      )}`;
      upsertNotificationEvent({
        id: recoveryKey,
        dedupeKey: recoveryKey,
        userId: uid,
        category: 'sync_backup',
        type: 'sync_restored',
        priority: 'low',
        status: 'active',
        titleAr: 'استعادة المزامنة السحابية بنجاح',
        titleEn: 'Cloud Sync Restored',
        descriptionAr: 'عاد الاتصال السحابي وتمت مزامنة جميع السجلات المعلقة بنجاح.',
        descriptionEn: 'Cloud connection recovered and all pending records were synced.',
        badgeAr: 'متزامن',
        badgeEn: 'Synced',
        actionType: 'open_settings',
        createdAt: nowIso,
        date: toLocalISODate(),
        targetTab: 'settings',
      });
    } else if (updatedAny) {
      bumpNotificationRevision();
    }
  }
}

export function notifyBackupOrRestoreEvent(params: {
  eventType: 'backup_completed' | 'backup_failed' | 'restore_failed';
  detail?: string;
  userId?: string;
}): void {
  const uid = resolveUserId(params.userId);
  const settings = normalizeNotificationSettings(db.getNotificationSettings(uid));
  if (!settings.enableNotifications) return;

  if (params.eventType === 'backup_completed') {
    if (!settings.enableBackupCompletionAlerts) return;
    const key = `evt_backup_ok_${uid}_${Math.floor(Date.now() / 10000)}`;
    upsertNotificationEvent({
      id: key,
      dedupeKey: key,
      userId: uid,
      category: 'sync_backup',
      type: 'backup_completed',
      priority: 'low',
      status: 'active',
      titleAr: 'اكتمل النسخ الاحتياطي بنجاح',
      titleEn: 'Backup Completed Successfully',
      descriptionAr: params.detail || 'تم حفظ وتصدير النسخة الاحتياطية لبياناتك بنجاح.',
      descriptionEn: params.detail || 'Your data backup was completed and saved successfully.',
      badgeAr: 'نسخة مكتملة',
      badgeEn: 'Backup Saved',
      actionType: 'open_settings',
      createdAt: new Date().toISOString(),
      date: toLocalISODate(),
      targetTab: 'settings',
    });
    return;
  }

  if (settings.enableBackupFailureAlerts === false) return;

  const isRestore = params.eventType === 'restore_failed';
  const key = `evt_${params.eventType}_${uid}_${Math.floor(Date.now() / 30000)}`;
  upsertNotificationEvent(
    {
      id: key,
      dedupeKey: key,
      userId: uid,
      category: 'sync_backup',
      type: params.eventType,
      priority: 'critical',
      status: 'active',
      titleAr: isRestore ? 'فشلت استعادة البيانات' : 'تعذر إجراء النسخ الاحتياطي',
      titleEn: isRestore ? 'Data Restore Failed' : 'Backup Failed',
      descriptionAr:
        params.detail ||
        (isRestore
          ? 'تعذرت استعادة النسخة الاحتياطية. لم يتم المساس بسجلاتك الحالية.'
          : 'حدث خطأ أثناء إنشاء ملف النسخة الاحتياطية. يرجى المحاولة مرة أخرى.'),
      descriptionEn:
        params.detail ||
        (isRestore
          ? 'Could not restore backup data. Your existing local records remain intact.'
          : 'An error occurred while creating the backup file. Please try again.'),
      badgeAr: isRestore ? 'فشل استعادة' : 'فشل نسخ',
      badgeEn: isRestore ? 'Restore Error' : 'Backup Error',
      actionType: 'open_settings',
      createdAt: new Date().toISOString(),
      date: toLocalISODate(),
      targetTab: 'settings',
    },
    { triggerMobileAlert: true }
  );
}

// ============================================================================
// 6. SMART NOTIFICATION EVALUATION & CACHING ENGINE
// ============================================================================

interface NotificationsCacheSnapshot {
  cacheKey: string;
  items: SmartReminderItem[];
}

let activeNotificationsCache: NotificationsCacheSnapshot | null = null;
let allNotificationsCache: NotificationsCacheSnapshot | null = null;

function persistFirstSeenTimestamps(
  states: Record<string, NotificationStateItem>,
  newEntries: Record<string, NotificationStateItem>,
  userId: string
): void {
  const keys = Object.keys(newEntries);
  if (keys.length === 0) return;
  for (const k of keys) {
    states[k] = { ...states[k], ...newEntries[k] };
    db.saveNotificationState(states[k], userId);
  }
}

export function evaluateNotifications(params?: {
  students?: Student[];
  groups?: Group[];
  sessions?: Session[];
  enrollments?: Enrollment[];
  attendanceList?: Attendance[];
  includeResolved?: boolean;
  customSettings?: NotificationSettings;
  lang?: string;
  userId?: string;
  now?: Date;
}): SmartReminderItem[] {
  const uid = resolveUserId(params?.userId);
  const currentLang = params?.lang || getAppLanguage();
  const isEn = currentLang.startsWith('en');
  const isRTL = !isEn;
  const includeResolved = Boolean(params?.includeResolved);
  const now = params?.now || new Date();
  const minuteBucket = Math.floor(now.getTime() / 60000);
  const domainRev = db.getDomainRevision();

  const canUseCache = !params?.customSettings && !params?.now && !params?.students;
  const cacheKey = `${uid}|${domainRev}|${notificationRevision}|${currentLang}|${minuteBucket}|${includeResolved}`;

  if (canUseCache) {
    const slot = includeResolved ? allNotificationsCache : activeNotificationsCache;
    if (slot && slot.cacheKey === cacheKey) {
      return slot.items;
    }
  }

  const settings = normalizeNotificationSettings(
    params?.customSettings || db.getNotificationSettings(uid)
  );

  // Master & In-App switches gate in-app notifications cleanly
  if (!settings.enableNotifications || !settings.enableInAppNotifications) {
    return [];
  }

  const students = (params?.students || db.getStudents(uid)).filter(
    (s) => (s.userId ? s.userId === uid : uid === 'acc_master_teacher')
  );
  const activeStudents = students.filter((s) => s.status !== 'archived');
  const activeStudentsById = new Map(activeStudents.map((s) => [s.id, s]));

  const groups = (params?.groups || db.getGroups(uid)).filter(
    (g) => (g.userId ? g.userId === uid : uid === 'acc_master_teacher')
  );
  const groupsMap = new Map(groups.map((g) => [g.id, g]));

  const enrollments = (params?.enrollments || db.getEnrollments(uid)).filter(
    (e) => (e.userId ? e.userId === uid : uid === 'acc_master_teacher')
  );
  const enrollmentsMap = new Map(enrollments.map((e) => [e.id, e]));

  const sessions = (params?.sessions || db.getSessions(uid)).filter(
    (s) => (s.userId ? s.userId === uid : uid === 'acc_master_teacher')
  );
  const attendanceList = (params?.attendanceList || db.getAttendance(uid)).filter(
    (a) => (a.userId ? a.userId === uid : uid === 'acc_master_teacher')
  );

  const attendanceBySessionId = new Map<string, Attendance[]>();
  for (const att of attendanceList) {
    const arr = attendanceBySessionId.get(att.sessionId);
    if (arr) arr.push(att);
    else attendanceBySessionId.set(att.sessionId, [att]);
  }

  const states = db.getNotificationStates(uid);
  const newStatePatches: Record<string, NotificationStateItem> = {};
  const nowIso = now.toISOString();
  const todayStr = toLocalISODate(now);
  const nowMs = now.getTime();
  const currencyLabel = isEn ? 'EGP' : 'ج.م';

  const getOrRecordCreatedAt = (id: string, fallbackIso: string, snapshotVal?: number | string): string => {
    const st = states[id];
    if (st?.firstSeenAt) {
      // State-transition check: if numeric value increased (e.g. higher overdue debt), re-open dismissed alert
      if (
        st.isDismissed &&
        typeof snapshotVal === 'number' &&
        typeof st.lastValueSnapshot === 'number' &&
        snapshotVal > st.lastValueSnapshot
      ) {
        newStatePatches[id] = {
          ...st,
          isDismissed: false,
          isRead: false,
          firstSeenAt: nowIso,
          lastValueSnapshot: snapshotVal,
        };
        return nowIso;
      }
      return st.firstSeenAt;
    }
    newStatePatches[id] = {
      ...(st || { id, isRead: false }),
      firstSeenAt: fallbackIso,
      lastValueSnapshot: snapshotVal,
    };
    return fallbackIso;
  };

  const results: SmartReminderItem[] = [];
  const studentIdsWithLessonsToday = new Set<string>();

  // -------------------------------------------------------------------------
  // CATEGORY A & B: TODAY'S LESSONS (UPCOMING + UNRECORDED + POST-LESSON)
  // -------------------------------------------------------------------------
  const scheduledToday = getScheduledClassesForDate(
    now,
    groups,
    activeStudents,
    enrollments,
    isRTL
  );
  const todaySessions = sessions.filter((s) => s.date === todayStr);

  interface TodaySlotOccurrence {
    slotKey: string;
    isPrivate: boolean;
    studentId?: string;
    studentName: string;
    groupId?: string;
    groupName: string;
    enrollmentId?: string;
    session?: Session;
    rawTime: string;
    formattedTime: string;
    sortMinutes: number;
  }

  const todaySlots: TodaySlotOccurrence[] = [];
  const seenSlots = new Set<string>();

  for (const s of todaySessions) {
    const isPriv = isSessionPrivateEntity(s, groupsMap, enrollmentsMap);
    const sMins = parseTimeToMinutes(s.startTime);
    const sortMinutes = sMins === 99999 ? 16 * 60 : sMins;
    const slotKey = isPriv
      ? `priv_${s.studentId || s.enrollmentId || s.id}_${sortMinutes}`
      : `grp_${s.groupId || s.id}_${sortMinutes}`;
    seenSlots.add(slotKey);

    if (s.status === 'cancelled') continue;

    const stu = s.studentId ? activeStudentsById.get(s.studentId) : undefined;
    const grp = s.groupId ? groupsMap.get(s.groupId) : undefined;
    if (isPriv && s.studentId && !stu) continue;
    if (!isPriv && s.groupId && !grp) continue;

    const sAttList = attendanceBySessionId.get(s.id) || [];
    if (
      isPriv &&
      !isExplicitPrivateSessionOperationalOnDate(
        s,
        todayStr,
        enrollments,
        activeStudentsById,
        sAttList.length > 0
      )
    ) {
      continue;
    }

    if (isPriv && s.studentId) {
      studentIdsWithLessonsToday.add(s.studentId);
    } else if (!isPriv && s.groupId) {
      for (const e of enrollments) {
        const eStu = activeStudentsById.get(e.studentId);
        if (
          e.groupId === s.groupId &&
          e.status !== 'stopped' &&
          eStu &&
          isEnrollmentActiveOnDate(e, todayStr, eStu)
        ) {
          studentIdsWithLessonsToday.add(e.studentId);
        }
      }
    }

    todaySlots.push({
      slotKey,
      isPrivate: isPriv,
      studentId: s.studentId,
      studentName: stu?.name || s.title || (isEn ? 'Private Lesson' : 'درس خاص'),
      groupId: s.groupId || undefined,
      groupName: isPriv
        ? isEn
          ? 'Private Lesson'
          : 'درس خاص'
        : grp?.name || s.title || (isEn ? 'Group' : 'مجموعة'),
      enrollmentId: s.enrollmentId,
      session: s,
      rawTime: s.startTime || '16:00',
      formattedTime: formatTimeDisplay(s.startTime, isRTL),
      sortMinutes,
    });
  }

  for (const item of scheduledToday) {
    const sortMinutes = item.sortMinutes === 99999 ? 16 * 60 : item.sortMinutes;
    const slotKey = item.isPrivate
      ? `priv_${item.studentId || item.enrollmentId || item.id}_${sortMinutes}`
      : `grp_${item.groupId || item.id}_${sortMinutes}`;

    if (seenSlots.has(slotKey)) continue;
    seenSlots.add(slotKey);

    // Check if an explicit cancelled session exists for this recurring slot
    const cancelledMatch = todaySessions.find((s) => {
      if (s.status !== 'cancelled') return false;
      const m = parseTimeToMinutes(s.startTime);
      const normM = m === 99999 ? 16 * 60 : m;
      if (normM !== sortMinutes) return false;
      return item.isPrivate ? s.studentId === item.studentId : s.groupId === item.groupId;
    });
    if (cancelledMatch) continue;

    if (item.isPrivate && item.studentId) {
      studentIdsWithLessonsToday.add(item.studentId);
    } else if (!item.isPrivate && item.groupId) {
      for (const e of enrollments) {
        const eStu = activeStudentsById.get(e.studentId);
        if (
          e.groupId === item.groupId &&
          e.status !== 'stopped' &&
          eStu &&
          isEnrollmentActiveOnDate(e, todayStr, eStu)
        ) {
          studentIdsWithLessonsToday.add(e.studentId);
        }
      }
    }

    const matchingSession = todaySessions.find((s) => {
      if (s.status === 'cancelled') return false;
      const m = parseTimeToMinutes(s.startTime);
      const normM = m === 99999 ? 16 * 60 : m;
      if (normM !== sortMinutes) return false;
      return item.isPrivate ? s.studentId === item.studentId : s.groupId === item.groupId;
    });

    todaySlots.push({
      slotKey,
      isPrivate: item.isPrivate,
      studentId: item.studentId || undefined,
      studentName: item.studentName,
      groupId: item.groupId || undefined,
      groupName: item.groupName,
      enrollmentId: item.enrollmentId,
      session: matchingSession,
      rawTime: item.rawTime || '16:00',
      formattedTime: item.time,
      sortMinutes,
    });
  }

  const leadMinutes = settings.lessonReminderLeadMinutes || 15;

  for (const slot of todaySlots) {
    const startTs = buildLocalTimestamp(todayStr, slot.rawTime, slot.sortMinutes);
    const startMs = startTs ? startTs.getTime() : nowMs;
    const hasAttendance = slot.session
      ? (attendanceBySessionId.get(slot.session.id) || []).length > 0
      : false;
    const isCompleted = slot.session?.status === 'completed' || hasAttendance;

    // A1. Upcoming Lesson Lead-Time Reminder
    const lessonTypeEnabled = slot.isPrivate
      ? settings.enablePrivateLessonReminders !== false
      : settings.enableGroupLessonReminders !== false;

    if (settings.enableLessonReminders !== false && lessonTypeEnabled) {
      const leadStartMs = startMs - leadMinutes * 60 * 1000;
      const isWithinUpcomingWindow = nowMs >= leadStartMs && nowMs <= startMs + 15 * 60 * 1000;

      if (isWithinUpcomingWindow && !isCompleted) {
        const id = `notif_upcoming_${slot.slotKey}_${todayStr}`;
        const state = states[id];
        const isDismissed = Boolean(state?.isDismissed);
        if (!isDismissed || includeResolved) {
          const createdAt = getOrRecordCreatedAt(id, new Date(leadStartMs).toISOString());
          const label = slot.isPrivate ? slot.studentName : slot.groupName;
          const minsUntil = Math.max(0, Math.round((startMs - nowMs) / 60000));

          results.push({
            id,
            category: 'lesson_reminders',
            type: 'upcoming_class',
            priority: 'high',
            status: isDismissed ? 'dismissed' : 'active',
            isRead: Boolean(state?.isRead),
            title: isEn ? `Upcoming Lesson: ${label}` : `حصة قادمة: ${label}`,
            description:
              minsUntil > 0
                ? isEn
                  ? `Starts in ${minsUntil} min (${slot.formattedTime}).`
                  : `تبدأ خلال ${minsUntil} دقيقة (${slot.formattedTime}).`
                : isEn
                ? `Scheduled for ${slot.formattedTime} — starting now.`
                : `مجدولة الساعة ${slot.formattedTime} — تبدأ الآن.`,
            badge: isEn ? `At ${slot.formattedTime}` : `الساعة ${slot.formattedTime}`,
            groupId: slot.groupId,
            groupName: slot.groupName,
            studentId: slot.studentId,
            studentName: slot.studentName,
            sessionId: slot.session?.id,
            enrollmentId: slot.enrollmentId,
            isPrivate: slot.isPrivate,
            date: todayStr,
            timeStr: slot.formattedTime,
            actionType: slot.isPrivate ? 'open_private_session' : 'record_attendance',
            createdAt,
          });
        }
      }
    }

    // B1 & B2. Unrecorded Lesson Attendance & Post-Lesson Completion Reminder
    const endMs =
      slot.session?.endTime && buildLocalTimestamp(todayStr, slot.session.endTime)
        ? buildLocalTimestamp(todayStr, slot.session.endTime)!.getTime()
        : startMs + 60 * 60 * 1000;
    const postDelayMs = (settings.postLessonReminderDelayMinutes || 30) * 60 * 1000;
    const isPastPostLessonDelay = nowMs >= endMs + postDelayMs;

    const shouldShowPostLesson =
      settings.enablePostLessonCompletionReminder !== false && isPastPostLessonDelay;
    const shouldShowPendingAttendance = settings.enableAttendanceReminders !== false;

    if (!hasAttendance && (shouldShowPendingAttendance || shouldShowPostLesson)) {
      const id = `notif_att_${slot.groupId || 'priv'}_${slot.studentId || 'grp'}_${slot.sortMinutes}_${todayStr}`;
      const state = states[id];
      const isDismissed = Boolean(state?.isDismissed);

      if (!isDismissed || includeResolved) {
        const createdAt = getOrRecordCreatedAt(id, nowIso);
        const label = slot.isPrivate ? slot.studentName : slot.groupName;
        const isPost = shouldShowPostLesson;

        results.push({
          id,
          category: 'attendance',
          type: isPost ? 'post_lesson_completion' : 'unrecorded_attendance',
          priority: 'high',
          status: isDismissed ? 'dismissed' : 'active',
          isRead: Boolean(state?.isRead),
          title: isPost
            ? isEn
              ? `Complete Lesson Attendance: ${label}`
              : `استكمال حضور الحصة: ${label}`
            : isEn
            ? `Take Attendance: ${label}`
            : `رصد حضور: ${label}`,
          description: isPost
            ? isEn
              ? `The ${slot.formattedTime} ${
                  slot.isPrivate ? 'private lesson' : 'group session'
                } has ended without recorded attendance.`
              : `انتهى موعد ${slot.isPrivate ? 'الدرس الخاص' : 'حصة المجموعة'} (${
                  slot.formattedTime
                }) ولم يُسجل الحضور بعد.`
            : isEn
            ? `Today's ${slot.formattedTime} lesson has not been marked yet.`
            : `حصة اليوم الساعة ${slot.formattedTime} لم يُسجل حضورها بعد.`,
          badge: isEn ? 'Pending Attendance' : 'حضور معلق',
          groupId: slot.groupId,
          groupName: slot.groupName,
          studentId: slot.studentId,
          studentName: slot.studentName,
          sessionId: slot.session?.id,
          enrollmentId: slot.enrollmentId,
          isPrivate: slot.isPrivate,
          date: todayStr,
          timeStr: slot.formattedTime,
          // STRICT SEPARATION: Private lessons never open bulk group attendance
          actionType: slot.isPrivate ? 'open_private_session' : 'record_attendance',
          createdAt,
        });
      }
    }
  }

  // A2. Day-of-Lesson Summary Reminder
  if (
    settings.enableLessonReminders !== false &&
    settings.enableDayOfLessonReminder &&
    todaySlots.length > 0
  ) {
    const daySummaryTs = buildLocalTimestamp(
      todayStr,
      settings.dayOfLessonReminderTime || '08:00',
      8 * 60
    );
    if (daySummaryTs && nowMs >= daySummaryTs.getTime()) {
      const id = `notif_dayof_summary_${todayStr}`;
      const state = states[id];
      const isDismissed = Boolean(state?.isDismissed);
      if (!isDismissed || includeResolved) {
        const createdAt = getOrRecordCreatedAt(id, daySummaryTs.toISOString());
        results.push({
          id,
          category: 'lesson_reminders',
          type: 'day_of_lesson_summary',
          priority: 'low',
          status: isDismissed ? 'dismissed' : 'active',
          isRead: Boolean(state?.isRead),
          title: isEn ? "Today's Lesson Agenda" : 'ملخص جدول حصص اليوم',
          description: isEn
            ? `You have ${todaySlots.length} scheduled ${
                todaySlots.length === 1 ? 'lesson' : 'lessons'
              } today.`
            : `لديك اليوم ${todaySlots.length} ${
                todaySlots.length === 1 ? 'حصة مجدولة' : 'حصص مجدولة'
              } في جدولك الدراسي.`,
          badge: isEn ? `${todaySlots.length} Today` : `${todaySlots.length} اليوم`,
          date: todayStr,
          targetTab: 'sessions',
          actionType: 'open_session',
          createdAt,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // CATEGORY C, D, E: STUDENT FINANCIALS, PACKAGES, ABSENCES & FOLLOW-UPS
  // -------------------------------------------------------------------------
  for (const student of activeStudents) {
    const grandFin = db.calculateStudentGrandFinancials(student.id);

    const nonPackageEnrollments = grandFin.enrollmentsSummary.filter(
      (e) => e.billingMode !== 'package' && e.billingType !== 'package'
    );
    const nonPackageRemaining = nonPackageEnrollments.reduce((sum, e) => sum + e.remaining, 0);
    const totalStudentRemaining = grandFin.grandRemaining || 0;
    const totalUnpaidSessionsCount = grandFin.enrollmentsSummary.reduce(
      (sum, e) => sum + (e.unpaidSessionsCount || 0),
      0
    );

    // C1. Overdue balance reminder (with state-transition snapshot deduplication)
    if (settings.enableOverdueReminders) {
      const id = `notif_overdue_${student.id}`;
      const existingState = states[id];
      if (nonPackageRemaining > 0) {
        const createdAt = getOrRecordCreatedAt(id, nowIso, nonPackageRemaining);
        const refreshedState = newStatePatches[id] || existingState;
        const isDismissed = Boolean(refreshedState?.isDismissed);

        if (!isDismissed || includeResolved) {
          results.push({
            id,
            category: 'financial',
            type: 'payment_overdue',
            priority: nonPackageRemaining > 500 ? 'high' : 'medium',
            status: isDismissed ? 'dismissed' : 'active',
            isRead: Boolean(refreshedState?.isRead),
            title: isEn ? `Payment Due: ${student.name}` : `مستحقات سداد: ${student.name}`,
            description: isEn
              ? `Outstanding balance of ${nonPackageRemaining.toLocaleString()} ${currencyLabel} requires settlement.`
              : `متبقي على الطالب ${nonPackageRemaining.toLocaleString()} ${currencyLabel} لم تُسدد.`,
            badge: isEn
              ? `${nonPackageRemaining.toLocaleString()} ${currencyLabel} Due`
              : `${nonPackageRemaining.toLocaleString()} ج.م مستحقة`,
            studentId: student.id,
            studentName: student.name,
            studentPhone: student.phone,
            parentPhone: student.parentPhone,
            parentRelation: student.parentRelation,
            amount: nonPackageRemaining,
            actionType: 'add_payment',
            createdAt,
          });
        }
      } else if (includeResolved && existingState?.firstSeenAt) {
        results.push({
          id,
          category: 'financial',
          type: 'payment_overdue',
          priority: 'low',
          status: 'resolved',
          isRead: true,
          title: isEn ? `Settled Dues: ${student.name}` : `تم سداد المستحقات: ${student.name}`,
          description: isEn
            ? 'Previous overdue tuition balance has been settled.'
            : 'تمت تسوية وسداد المديونية المستحقة السابقة بالكامل.',
          badge: isEn ? 'Settled' : 'تم السداد',
          studentId: student.id,
          studentName: student.name,
          actionType: 'open_student',
          createdAt: existingState.firstSeenAt,
        });
      }
    }

    // C2. Configurable Balance Threshold Alert
    if (settings.enableBalanceThresholdAlert) {
      const threshold = settings.balanceThresholdAmount || 500;
      if (totalStudentRemaining >= threshold) {
        const id = `notif_threshold_${student.id}_${threshold}`;
        const createdAt = getOrRecordCreatedAt(id, nowIso, totalStudentRemaining);
        const state = newStatePatches[id] || states[id];
        const isDismissed = Boolean(state?.isDismissed);

        if (!isDismissed || includeResolved) {
          results.push({
            id,
            category: 'financial',
            type: 'balance_threshold_exceeded',
            priority: 'high',
            status: isDismissed ? 'dismissed' : 'active',
            isRead: Boolean(state?.isRead),
            title: isEn
              ? `Balance Exceeds ${threshold.toLocaleString()} ${currencyLabel}: ${student.name}`
              : `تجاوز حد المديونية (${threshold.toLocaleString()} ${currencyLabel}): ${student.name}`,
            description: isEn
              ? `Total unpaid balance reached ${totalStudentRemaining.toLocaleString()} ${currencyLabel}.`
              : `بلغ إجمالي الرصيد غير المسدد ${totalStudentRemaining.toLocaleString()} ${currencyLabel}.`,
            badge: isEn ? 'High Balance' : 'مديونية مرتفعة',
            studentId: student.id,
            studentName: student.name,
            studentPhone: student.phone,
            parentPhone: student.parentPhone,
            parentRelation: student.parentRelation,
            amount: totalStudentRemaining,
            actionType: 'add_payment',
            createdAt,
          });
        }
      }
    }

    // C3. Outstanding Balance for Students With Lessons Today
    if (
      settings.enableTodayLessonDebtAlerts !== false &&
      studentIdsWithLessonsToday.has(student.id) &&
      totalStudentRemaining > 0
    ) {
      const id = `notif_today_debt_${student.id}_${todayStr}`;
      const createdAt = getOrRecordCreatedAt(id, nowIso, totalStudentRemaining);
      const state = newStatePatches[id] || states[id];
      const isDismissed = Boolean(state?.isDismissed);

      if (!isDismissed || includeResolved) {
        results.push({
          id,
          category: 'financial',
          type: 'today_lesson_debt',
          priority: 'high',
          status: isDismissed ? 'dismissed' : 'active',
          isRead: Boolean(state?.isRead),
          title: isEn
            ? `Today's Student Has Dues: ${student.name}`
            : `مديونية لطالب لديه حصة اليوم: ${student.name}`,
          description: isEn
            ? `Attending today with an unpaid balance of ${totalStudentRemaining.toLocaleString()} ${currencyLabel}.`
            : `لدى الطالب حصة اليوم وعليه رصيد مستحق بقيمة ${totalStudentRemaining.toLocaleString()} ${currencyLabel}.`,
          badge: isEn
            ? `${totalStudentRemaining.toLocaleString()} ${currencyLabel} Today`
            : `مستحق اليوم ${totalStudentRemaining.toLocaleString()} ج.م`,
          studentId: student.id,
          studentName: student.name,
          studentPhone: student.phone,
          parentPhone: student.parentPhone,
          parentRelation: student.parentRelation,
          amount: totalStudentRemaining,
          date: todayStr,
          actionType: 'add_payment',
          createdAt,
        });
      }
    }

    // E1. Student Financial Follow-Up (multiple unpaid completed sessions)
    if (
      settings.enableFinancialFollowUpAlerts !== false &&
      totalUnpaidSessionsCount >= 2 &&
      totalStudentRemaining > 0
    ) {
      const id = `notif_followup_fin_${student.id}`;
      const createdAt = getOrRecordCreatedAt(id, nowIso, totalUnpaidSessionsCount);
      const state = newStatePatches[id] || states[id];
      const isDismissed = Boolean(state?.isDismissed);

      if (!isDismissed || includeResolved) {
        results.push({
          id,
          category: 'follow_ups',
          type: 'financial_follow_up',
          priority: 'medium',
          status: isDismissed ? 'dismissed' : 'active',
          isRead: Boolean(state?.isRead),
          title: isEn
            ? `Financial Follow-Up Needed: ${student.name}`
            : `متابعة مالية مطلوبة: ${student.name}`,
          description: isEn
            ? `${totalUnpaidSessionsCount} completed sessions remain unpaid (${totalStudentRemaining.toLocaleString()} ${currencyLabel}).`
            : `لدى الطالب ${totalUnpaidSessionsCount} حصص مكتملة غير مسددة بإجمالي ${totalStudentRemaining.toLocaleString()} ${currencyLabel}.`,
          badge: isEn
            ? `${totalUnpaidSessionsCount} Unpaid Sessions`
            : `${totalUnpaidSessionsCount} حصص غير مسددة`,
          studentId: student.id,
          studentName: student.name,
          studentPhone: student.phone,
          parentPhone: student.parentPhone,
          parentRelation: student.parentRelation,
          amount: totalStudentRemaining,
          actionType: 'add_payment',
          createdAt,
        });
      }
    }

    // D1–D4. Package & Subscription Cycle Tracking (Exact packageSessionsCount)
    for (const enr of grandFin.enrollmentsSummary) {
      const rawEnrollment = enrollmentsMap.get(enr.enrollmentId);
      const grp = groupsMap.get(enr.groupId);
      const isHourly =
        enr.billingType === 'hourly' ||
        enr.billingMode === 'hourly' ||
        grp?.billingType === 'hourly' ||
        grp?.billingMode === 'hourly';

      const isPkg =
        !isHourly &&
        (enr.billingMode === 'package' ||
          enr.billingType === 'package' ||
          grp?.billingType === 'package' ||
          grp?.billingMode === 'package' ||
          Boolean(
            rawEnrollment?.packageSessionsCount ||
              enr.packageSessionsCount ||
              grp?.packageSessionsCount
          ));

      const isPrepaid =
        !isHourly &&
        !isPkg &&
        (enr.billingMode === 'prepaid' ||
          enr.billingType === 'prepaid' ||
          (enr.billingType === 'per_session' && enr.billingMode !== 'postpaid') ||
          grp?.billingType === 'prepaid');

      const isPrivEnr =
        enr.groupType === 'private' ||
        rawEnrollment?.serviceType === 'private' ||
        !enr.groupId;

      const defaultGroupName = isPrivEnr
        ? isEn
          ? `Private Lesson - ${student.name}`
          : `درس خاص - ${student.name}`
        : enr.groupName;

      if (isPkg) {
        const packageSize = Math.max(
          1,
          rawEnrollment?.packageSessionsCount ||
            enr.packageSessionsCount ||
            grp?.packageSessionsCount ||
            8
        );

        const attendedCount = enr.attendedSessionsCount || 0;
        const totalPaid = enr.totalPaid || 0;
        const packagePrice = enr.packagePrice || grp?.defaultPrice || enr.customPrice || 0;
        const unitRate =
          packagePrice > 0 ? packagePrice / packageSize : enr.customPrice || 100;

        const coveredCycles =
          packagePrice > 0
            ? Math.floor((totalPaid + 0.001) / packagePrice)
            : unitRate > 0
            ? Math.floor((totalPaid + 0.001) / (unitRate * packageSize))
            : 0;

        const completedCycles = Math.floor(attendedCount / packageSize);

        // D1. Exact Package Limit Reached (resolves automatically when cycle is paid)
        if (settings.enablePackageCompletedAlerts !== false) {
          for (let cycle = 1; cycle <= completedCycles; cycle++) {
            const targetLimit = cycle * packageSize;
            const isCyclePaid =
              coveredCycles >= cycle || (cycle === completedCycles && enr.remaining <= 0);
            const id = `notif_pkg_due_${enr.enrollmentId}_cycle_${cycle}_limit_${packageSize}`;
            const state = states[id];
            const isDismissed = Boolean(state?.isDismissed);
            const status = isCyclePaid ? 'resolved' : isDismissed ? 'dismissed' : 'active';

            if (status === 'active' || includeResolved) {
              const createdAt = getOrRecordCreatedAt(id, nowIso);
              results.push({
                id,
                category: 'packages',
                type: 'package_completed',
                priority: 'high',
                status,
                isRead: Boolean(state?.isRead),
                title: isEn
                  ? `Package Completed — Payment Due: ${student.name}`
                  : `انتهت الباقة — مستحق سداد: ${student.name}`,
                description: isEn
                  ? `Student completed ${targetLimit} ${
                      targetLimit === 1 ? 'lesson' : 'lessons'
                    } (${packageSize}-lesson package). Renewal is due.`
                  : `أكمل الطالب ${targetLimit} ${
                      targetLimit === 1 ? 'حصة' : 'حصص'
                    } (باقة ${packageSize} حصص). حان وقت التجديد والسداد.`,
                badge: isEn
                  ? isCyclePaid
                    ? 'Package Settled'
                    : `Package Completed (${packageSize}/${packageSize})`
                  : isCyclePaid
                  ? 'تم سداد الباقة'
                  : `باقة مكتملة (${packageSize}/${packageSize})`,
                studentId: student.id,
                studentName: student.name,
                studentPhone: student.phone,
                parentPhone: student.parentPhone,
                parentRelation: student.parentRelation,
                groupId: isPrivEnr ? undefined : enr.groupId,
                groupName: defaultGroupName,
                enrollmentId: enr.enrollmentId,
                isPrivate: isPrivEnr,
                packageSize,
                cycleIndex: cycle,
                totalCompletedSessions: targetLimit,
                actionType: 'add_payment',
                createdAt,
              });
            }
          }
        }

        const inProgressCycle = completedCycles + 1;
        const cycleAttended = attendedCount - completedCycles * packageSize;
        const lessonsRemaining = packageSize - cycleAttended;
        const isNextCyclePrepaid = coveredCycles >= inProgressCycle;

        // D2. Exactly 1 Session Remaining in Package
        const oneRemEnabled = settings.enableOneSessionRemainingAlert !== false;
        const nearDueEnabled = settings.enableEarlyPackageWarning !== false;
        const nearThreshold = settings.earlyWarningLessonThreshold || 2;

        if (!isNextCyclePrepaid && cycleAttended > 0 && lessonsRemaining === 1 && oneRemEnabled) {
          const id = `notif_pkg_warn_${enr.enrollmentId}_cycle_${inProgressCycle}_rem_1`;
          const state = states[id];
          const isDismissed = Boolean(state?.isDismissed);

          if (!isDismissed || includeResolved) {
            const createdAt = getOrRecordCreatedAt(id, nowIso);
            results.push({
              id,
              category: 'packages',
              type: 'package_one_remaining',
              priority: 'medium',
              status: isDismissed ? 'dismissed' : 'active',
              isRead: Boolean(state?.isRead),
              title: isEn
                ? `1 Lesson Remaining in Package: ${student.name}`
                : `متبقي حصة واحدة في الباقة: ${student.name}`,
              description: isEn
                ? `Only 1 lesson left before renewal (${cycleAttended}/${packageSize} completed in ${defaultGroupName}).`
                : `متبقي حصة واحدة فقط قبل التجديد (${cycleAttended}/${packageSize} مكتملة في ${defaultGroupName}).`,
              badge: isEn ? '1 Lesson Left' : 'متبقي حصة واحدة',
              studentId: student.id,
              studentName: student.name,
              studentPhone: student.phone,
              parentPhone: student.parentPhone,
              parentRelation: student.parentRelation,
              groupId: isPrivEnr ? undefined : enr.groupId,
              groupName: defaultGroupName,
              enrollmentId: enr.enrollmentId,
              isPrivate: isPrivEnr,
              packageSize,
              cycleIndex: inProgressCycle,
              lessonsRemaining: 1,
              totalCompletedSessions: attendedCount,
              actionType: 'add_payment',
              createdAt,
            });
          }
        } else if (
          !isNextCyclePrepaid &&
          cycleAttended > 0 &&
          lessonsRemaining > 0 &&
          lessonsRemaining <= nearThreshold &&
          nearDueEnabled &&
          !(lessonsRemaining === 1 && oneRemEnabled)
        ) {
          // D3. Package Nearly Exhausted
          const id = `notif_pkg_warn_${enr.enrollmentId}_cycle_${inProgressCycle}_rem_${lessonsRemaining}`;
          const state = states[id];
          const isDismissed = Boolean(state?.isDismissed);

          if (!isDismissed || includeResolved) {
            const createdAt = getOrRecordCreatedAt(id, nowIso);
            results.push({
              id,
              category: 'packages',
              type: 'package_almost_due',
              priority: 'medium',
              status: isDismissed ? 'dismissed' : 'active',
              isRead: Boolean(state?.isRead),
              title: isEn
                ? `Package Near Completion: ${student.name}`
                : `اقتراب اكتمال الباقة: ${student.name}`,
              description: isEn
                ? `Student has ${lessonsRemaining} ${
                    lessonsRemaining === 1 ? 'lesson' : 'lessons'
                  } remaining before renewal (${cycleAttended}/${packageSize} lessons).`
                : `متبقي للطالب ${
                    lessonsRemaining === 1 ? 'حصة واحدة' : `${lessonsRemaining} حصص`
                  } قبل استحقاق السداد (${cycleAttended}/${packageSize} حصص).`,
              badge: isEn
                ? `${lessonsRemaining} ${lessonsRemaining === 1 ? 'Lesson' : 'Lessons'} Left`
                : `متبقي ${lessonsRemaining} ${lessonsRemaining === 1 ? 'حصة' : 'حصص'}`,
              studentId: student.id,
              studentName: student.name,
              studentPhone: student.phone,
              parentPhone: student.parentPhone,
              parentRelation: student.parentRelation,
              groupId: isPrivEnr ? undefined : enr.groupId,
              groupName: defaultGroupName,
              enrollmentId: enr.enrollmentId,
              isPrivate: isPrivEnr,
              packageSize,
              cycleIndex: inProgressCycle,
              lessonsRemaining,
              totalCompletedSessions: attendedCount,
              actionType: 'add_payment',
              createdAt,
            });
          }
        }
      } else if (isPrepaid && settings.enablePrepaidCreditExhaustedAlerts !== false) {
        // D4. Prepaid Credit Exhaustion
        if (enr.sessionCredit <= 0 && enr.attendedSessionsCount > 0 && enr.remaining > 0) {
          const id = `notif_prepaid_fin_${enr.enrollmentId}`;
          const state = states[id];
          const isDismissed = Boolean(state?.isDismissed);

          if (!isDismissed || includeResolved) {
            const createdAt = getOrRecordCreatedAt(id, nowIso);
            results.push({
              id,
              category: 'packages',
              type: 'low_credit',
              priority: 'medium',
              status: isDismissed ? 'dismissed' : 'active',
              isRead: Boolean(state?.isRead),
              title: isEn
                ? `Credits Exhausted: ${student.name}`
                : `نفاد رصيد الحصص: ${student.name}`,
              description: isEn
                ? `Prepaid lesson credits have been exhausted in (${defaultGroupName}).`
                : `نفد رصيد الحصص المدفوعة مسبقاً في (${defaultGroupName}).`,
              badge: isEn ? 'Credits Exhausted' : 'رصيد منتهي',
              studentId: student.id,
              studentName: student.name,
              studentPhone: student.phone,
              parentPhone: student.parentPhone,
              parentRelation: student.parentRelation,
              groupId: isPrivEnr ? undefined : enr.groupId,
              groupName: defaultGroupName,
              enrollmentId: enr.enrollmentId,
              isPrivate: isPrivEnr,
              remainingCredits: enr.sessionCredit,
              actionType: 'add_payment',
              createdAt,
            });
          }
        }
      }
    }

    // B3. Repeated Absences Check (accurately distinguishes excused/uncharged vs charged)
    if (settings.enableStudentAbsenceAlerts !== false) {
      const stuAtt = db.getStudentAttendance(student.id);
      if (stuAtt.length >= 2) {
        const lastTwo = stuAtt.slice(0, 2);
        const isConsecutiveAbsent = lastTwo.every(
          (a) =>
            a.status === 'absent' ||
            a.status === 'absent_charged' ||
            a.status === 'absent_free' ||
            a.status === 'excused'
        );
        if (isConsecutiveAbsent) {
          const allUncharged = lastTwo.every(
            (a) => a.status === 'absent_free' || a.status === 'excused' || a.isCharged === false
          );
          const id = `notif_rep_abs_${student.id}_${lastTwo[0].id}`;
          const state = states[id];
          const isDismissed = Boolean(state?.isDismissed);

          if (!isDismissed || includeResolved) {
            const createdAt = getOrRecordCreatedAt(id, lastTwo[0].recordedAt || nowIso);
            results.push({
              id,
              category: 'attendance',
              type: 'repeated_absence',
              priority: allUncharged ? 'low' : 'medium',
              status: isDismissed ? 'dismissed' : 'active',
              isRead: Boolean(state?.isRead),
              title: isEn
                ? `Repeated Absence: ${student.name}`
                : `غياب متكرر: ${student.name}`,
              description: allUncharged
                ? isEn
                  ? 'Student missed the last 2 consecutive lessons (marked excused/uncharged — no fee applied).'
                  : 'تغيب الطالب عن آخر حصتين متتاليتين (مسجلة كغياب معفي غير محسوب مالياً).'
                : isEn
                ? 'Student was absent from the last 2 consecutive lessons — recommended to follow up with guardian.'
                : 'تغيب الطالب عن آخر حصتين متتاليتين — ينصح بالتواصل مع ولي الأمر.',
              badge: isEn ? 'Consecutive Absence' : 'غياب متتالي',
              studentId: student.id,
              studentName: student.name,
              studentPhone: student.phone,
              parentPhone: student.parentPhone,
              parentRelation: student.parentRelation,
              isChargedAbsence: !allUncharged,
              actionType: 'open_student',
              createdAt,
            });
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // CATEGORY E2: INCOMPLETE LESSON / ATTENDANCE RECORDS
  // -------------------------------------------------------------------------
  if (settings.enableIncompleteLessonAlerts !== false) {
    const incompleteSessionIds = new Set<string>();

    for (const s of sessions) {
      if (s.status === 'cancelled') continue;
      const sAtt = attendanceBySessionId.get(s.id) || [];
      const hasIncompleteAtt = sAtt.some((a) => a.isIncomplete === true);
      if (!s.isIncomplete && !hasIncompleteAtt) continue;

      incompleteSessionIds.add(s.id);
      const isPriv = isSessionPrivateEntity(s, groupsMap, enrollmentsMap);
      const stu = s.studentId ? activeStudentsById.get(s.studentId) : undefined;
      const grp = s.groupId ? groupsMap.get(s.groupId) : undefined;
      if (isPriv && s.studentId && !stu) continue;
      if (!isPriv && s.groupId && !grp) continue;

      const id = `notif_incomplete_ses_${s.id}`;
      const state = states[id];
      const isDismissed = Boolean(state?.isDismissed);

      if (!isDismissed || includeResolved) {
        const createdAt = getOrRecordCreatedAt(id, s.updatedAt || s.createdAt || nowIso);
        const label = isPriv
          ? stu?.name || s.title || (isEn ? 'Private Lesson' : 'درس خاص')
          : grp?.name || s.title || (isEn ? 'Group Session' : 'حصة مجموعة');

        results.push({
          id,
          category: 'follow_ups',
          type: 'incomplete_record',
          priority: 'medium',
          status: isDismissed ? 'dismissed' : 'active',
          isRead: Boolean(state?.isRead),
          title: isEn
            ? `Incomplete Lesson Record: ${label}`
            : `سجل حصة غير مكتمل: ${label}`,
          description: isEn
            ? `Lesson on ${s.date} requires quantity, duration, or attendance completion.`
            : `حصة بتاريخ ${s.date} تحتاج إلى استكمال الكمية أو تفاصيل الحضور.`,
          badge: isEn ? 'Incomplete Record' : 'سجل غير مكتمل',
          studentId: s.studentId,
          studentName: stu?.name,
          groupId: isPriv ? undefined : s.groupId,
          groupName: isPriv ? undefined : grp?.name,
          sessionId: s.id,
          enrollmentId: s.enrollmentId,
          isPrivate: isPriv,
          date: s.date,
          actionType: isPriv ? 'open_private_session' : 'record_attendance',
          createdAt,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // CATEGORY F: PERSISTED EVENT NOTIFICATIONS (ABSENCES, PAYMENTS, SYNC, BACKUP)
  // -------------------------------------------------------------------------
  const persistedEvents = getPersistedNotificationEvents(uid);
  for (const ev of persistedEvents) {
    // Respect current category switches dynamically
    if (ev.type === 'student_absent' && settings.enableStudentAbsenceAlerts === false) continue;
    if (ev.type === 'payment_recorded' && !settings.enablePaymentRecordedAlerts) continue;
    if (
      (ev.type === 'sync_failed' || ev.type === 'sync_restored') &&
      settings.enableSyncFailureAlerts === false
    ) {
      continue;
    }
    if (
      (ev.type === 'backup_failed' || ev.type === 'restore_failed') &&
      settings.enableBackupFailureAlerts === false
    ) {
      continue;
    }
    if (ev.type === 'backup_completed' && !settings.enableBackupCompletionAlerts) continue;

    const state = states[ev.id];
    const effectiveStatus = state?.isDismissed ? 'dismissed' : ev.status;
    if (effectiveStatus !== 'active' && !includeResolved) continue;

    results.push({
      id: ev.id,
      category: ev.category,
      type: ev.type,
      priority: ev.priority,
      status: effectiveStatus,
      isRead: Boolean(state?.isRead || effectiveStatus === 'resolved'),
      title: isEn ? ev.titleEn : ev.titleAr,
      description: isEn ? ev.descriptionEn : ev.descriptionAr,
      badge: isEn ? ev.badgeEn : ev.badgeAr,
      studentId: ev.studentId,
      studentName: ev.studentName,
      studentPhone: ev.studentPhone,
      parentPhone: ev.parentPhone,
      parentRelation: ev.parentRelation,
      groupId: ev.groupId,
      groupName: ev.groupName,
      sessionId: ev.sessionId,
      enrollmentId: ev.enrollmentId,
      isPrivate: ev.isPrivate,
      isChargedAbsence: ev.isChargedAbsence,
      amount: ev.amount,
      date: ev.date,
      timeStr: ev.timeStr,
      targetTab: ev.targetTab,
      actionType: ev.actionType,
      createdAt: ev.createdAt,
      resolvedAt: ev.resolvedAt,
      isEventRecord: true,
    });
  }

  // -------------------------------------------------------------------------
  // CATEGORY G: SYSTEM & OS PERMISSION ALERTS (RECOVERABLE, NON-NAGGING)
  // -------------------------------------------------------------------------
  if (
    settings.enableMobileNotifications !== false &&
    settings.enableSystemPermissionAlerts !== false &&
    getPermissionStatusSync() === 'denied'
  ) {
    const id = `notif_sys_perm_denied_${uid}`;
    const state = states[id];
    const isDismissed = Boolean(state?.isDismissed);

    if (!isDismissed || includeResolved) {
      const createdAt = getOrRecordCreatedAt(id, nowIso);
      results.push({
        id,
        category: 'system',
        type: 'permission_denied',
        priority: 'medium',
        status: isDismissed ? 'dismissed' : 'active',
        isRead: Boolean(state?.isRead),
        title: isEn
          ? 'Mobile Notification Permission Disabled'
          : 'صلاحية إشعارات الهاتف غير مفعلة',
        description: isEn
          ? 'Device alerts are blocked by system settings. Enable notification permission to receive lesson reminders on time.'
          : 'التنبيهات الصوتية محجوبة من إعدادات الجهاز. فعّل صلاحية الإشعارات لاستلام تذكيرات الحصص في موعدها.',
        badge: isEn ? 'Permission Needed' : 'تحتاج صلاحية',
        targetTab: 'settings',
        actionType: 'open_permissions',
        createdAt,
      });
    }
  }

  persistFirstSeenTimestamps(states, newStatePatches, uid);

  const filtered = includeResolved
    ? results
    : results.filter((r) => r.status === 'active');

  const priorityRank: Record<NotificationPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  filtered.sort((a, b) => {
    const statusOrder = (st: SmartReminderItem['status']) =>
      st === 'active' ? 0 : st === 'resolved' ? 1 : 2;
    const stDiff = statusOrder(a.status) - statusOrder(b.status);
    if (stDiff !== 0) return stDiff;

    if (a.isRead !== b.isRead) {
      return a.isRead ? 1 : -1;
    }

    const pDiff = (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2);
    if (pDiff !== 0) return pDiff;

    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  if (canUseCache) {
    if (includeResolved) {
      allNotificationsCache = { cacheKey, items: filtered };
    } else {
      activeNotificationsCache = { cacheKey, items: filtered };
    }
  }

  return filtered;
}

export function getUnreadNotificationsCount(userId?: string): number {
  const active = evaluateNotifications({ userId, includeResolved: false });
  let count = 0;
  for (let i = 0; i < active.length; i++) {
    if (!active[i].isRead) count++;
  }
  return count;
}

export function clearNotificationHistoryForUser(userId?: string): void {
  const uid = resolveUserId(userId);
  const activeBeforeClear = evaluateNotifications({ userId: uid, includeResolved: true });

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(`${STORAGE_KEY_EVENTS_PREFIX}_${uid}`);
    } catch {}
  }

  // Mark all currently visible rule-based items as dismissed so history clear gives a clean slate
  const states = db.getNotificationStates(uid);
  const nowIso = new Date().toISOString();
  for (const item of activeBeforeClear) {
    if (!item.isEventRecord) {
      states[item.id] = {
        ...(states[item.id] || { id: item.id }),
        isRead: true,
        isDismissed: true,
        readAt: nowIso,
        dismissedAt: nowIso,
      };
      db.saveNotificationState(states[item.id], uid);
    }
  }

  activeNotificationsCache = null;
  allNotificationsCache = null;
  bumpNotificationRevision();
}

export function resetPermissionAlertDismissal(userId?: string): void {
  const uid = resolveUserId(userId);
  const id = `notif_sys_perm_denied_${uid}`;
  const states = db.getNotificationStates(uid);
  if (states[id]?.isDismissed) {
    db.saveNotificationState(
      {
        ...states[id],
        isDismissed: false,
        isRead: false,
      },
      uid
    );
    bumpNotificationRevision();
  }
}

let activeWebTapHandler: ((ev: Event) => void) | null = null;

export async function initNotificationSystem(
  onNotificationTapped?: (data: Record<string, any>) => void
): Promise<void> {
  const uid = resolveUserId();
  await refreshPermissionStatus();
  await createOrUpdatePlatformChannel();

  if (typeof window !== 'undefined') {
    if (activeWebTapHandler) {
      window.removeEventListener('classy_notification_tapped', activeWebTapHandler);
      activeWebTapHandler = null;
    }
    if (onNotificationTapped) {
      activeWebTapHandler = (ev: Event) => {
        const detail = (ev as CustomEvent)?.detail;
        if (detail && typeof detail === 'object') {
          onNotificationTapped(detail);
        }
      };
      window.addEventListener('classy_notification_tapped', activeWebTapHandler);
    }
  }

  if (isNativeNotificationPlatform()) {
    try {
      await LocalNotifications.removeAllListeners();
      await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
        const extra = (event?.notification?.extra || {}) as Record<string, any>;
        if (onNotificationTapped) {
          onNotificationTapped(extra);
        }
        if (typeof window !== 'undefined' && extra?.type === 'daily_attendance_reminder') {
          window.dispatchEvent(
            new CustomEvent('classy_open_attendance_reminder', {
              detail: extra,
            })
          );
        }
      });
    } catch {}
  }

  await reconcileScheduledNotifications({ userId: uid });
}

// Automatically connect storage domain mutations to the centralized notification service
registerNotificationDomainHooks({
  onScheduleChanged: (userId) => {
    reconcileScheduledNotifications({ userId }).catch(() => {});
    bumpNotificationRevision();
  },
  onAttendanceBatchSaved: (params) => {
    notifyAttendanceBatchSaved(params);
  },
  onPaymentRecorded: (params) => {
    notifyPaymentRecorded(params);
    reconcileScheduledNotifications({ userId: params.userId }).catch(() => {});
  },
  onFinancialsMutated: (userId) => {
    reconcileScheduledNotifications({ userId }).catch(() => {});
    bumpNotificationRevision();
  },
  onSyncOutcome: (params) => {
    notifySyncOutcome(params);
  },
  onUserSessionChanged: ({ prevUserId, nextUserId, isLogout }) => {
    if (prevUserId && prevUserId !== nextUserId) {
      cancelAllScheduledNotificationsForUser(prevUserId).catch(() => {});
    }
    if (isLogout) {
      cancelAllScheduledNotificationsForUser(prevUserId).catch(() => {});
    } else {
      reconcileScheduledNotifications({ userId: nextUserId }).catch(() => {});
    }
    bumpNotificationRevision();
  },
  onNotificationSettingsChanged: (userId) => {
    reconcileScheduledNotifications({ userId }).catch(() => {});
    bumpNotificationRevision();
  },
  onNotificationStateMutated: () => {
    bumpNotificationRevision();
  },
  onDataCleared: (userId) => {
    cancelAllScheduledNotificationsForUser(userId).catch(() => {});
    clearNotificationHistoryForUser(userId);
    bumpNotificationRevision();
  },
});

