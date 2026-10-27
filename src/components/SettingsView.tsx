import React, { useState, useEffect, useRef } from 'react';
import {
  TeacherProfile,
  UserAccount,
  AutoSyncFrequency,
  AutoSyncConfig,
  NotificationSettings,
  LessonReminderLeadMinutes,
  NotificationHistoryRetentionDays,
  ActiveTab,
} from '../types';
import { AppIcon, type AppIconName } from './ui/AppIcon';
import { MintCard } from './ui/MintCard';
import { SegmentedControl } from './ui/SegmentedControl';
import { Toggle } from './ui/Toggle';
import { Toast, type ToastType } from './ui/Toast';
import { SyncStatusPill } from './ui/SyncStatusPill';
import { useDelayedLoading } from './ui/Skeleton';
import { SettingsSyncStatusSkeleton } from './skeletons/ClassySkeletons';
import {
  db,
  formatSyncTimeArabic,
  formatSyncStatusArabic,
} from '../utils/storage';
import {
  subscribeToNetworkStatus,
  getCachedNetworkStatus,
  DetailedNetworkStatus,
} from '../utils/network';
import { useTranslation, Language } from '../utils/i18n';
import { useTheme } from '../utils/theme';
import { triggerLightHaptic, useHapticsPreference } from '../utils/haptics';
import { toLocalISODate } from '../utils/localDate';
import {
  formatReminderTimeDisplay,
  sendTestAttendanceReminderNotification,
  updateNotificationSoundPreference,
} from '../utils/localNotifications';
import {
  HISTORY_RETENTION_OPTIONS,
  LESSON_LEAD_TIME_OPTIONS,
  VERIFIED_NOTIFICATION_SOUNDS,
  type OsPermissionState,
  clearNotificationHistoryForUser,
  getPermissionStatusSync,
  getPlatformNotificationCapabilities,
  normalizeNotificationSettings,
  notifyBackupOrRestoreEvent,
  playNotificationSoundTone,
  refreshPermissionStatus,
  requestPlatformNotificationPermission,
  resetPermissionAlertDismissal,
  restoreDefaultNotificationSettings,
  subscribeToNotifications,
} from '../utils/notificationCenter';
import {
  cleanupPracticeEntities,
  getActivePracticeEntitiesCount,
  openTutorialChapterHub,
  resumeTutorial,
  startFullTutorial,
  useTutorialState,
} from '../utils/tutorialProgress';
import { TUTORIAL_CHAPTERS } from './tutorial/tutorialSteps';

interface SettingsViewProps {
  teacherProfile: TeacherProfile;
  currentUser: UserAccount | null;
  isActive?: boolean;
  onProfileUpdated: (profile: TeacherProfile) => void;
  onDataReset: () => void;
  onLogout: () => void;
  onNavigateToTab?: (tab: ActiveTab) => void;
  onBack?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  teacherProfile,
  currentUser,
  isActive = true,
  onProfileUpdated,
  onDataReset,
  onLogout,
  onNavigateToTab,
  onBack,
}) => {
  const { language, setLanguage, isRTL, t } = useTranslation();
  const { isDark, setTheme } = useTheme();
  const { hapticsEnabled, setHapticsEnabled } = useHapticsPreference();
  const isEn = language.startsWith('en');
  const { persisted: tutorialPersisted } = useTutorialState(currentUser?.id);
  const practiceEntitiesInfo = getActivePracticeEntitiesCount(currentUser?.id);

  // Profile Form state
  const [name, setName] = useState(teacherProfile.name);
  const [subject, setSubject] = useState(teacherProfile.subject);
  const [phone, setPhone] = useState(teacherProfile.phone || '');
  const [centerOrSchool, setCenterOrSchool] = useState(teacherProfile.centerOrSchool || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync state & feedback
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => db.getLastSyncTime(currentUser?.id));
  const [autoSyncConfig, setAutoSyncConfig] = useState<AutoSyncConfig>(() => db.getAutoSyncConfig(currentUser?.id));
  const [networkStatus, setNetworkStatus] = useState<DetailedNetworkStatus>(() => getCachedNetworkStatus());
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() =>
    normalizeNotificationSettings(db.getNotificationSettings(currentUser?.id))
  );
  const [permStatus, setPermStatus] = useState<OsPermissionState>(() => getPermissionStatusSync());
  const [expandedNotifGroup, setExpandedNotifGroup] = useState<
    'quiet' | 'lessons' | 'attendance' | 'financial' | 'packages' | 'system_sync' | null
  >(null);
  const [confirmClearNotifHistory, setConfirmClearNotifHistory] = useState(false);
  const [confirmRestoreNotifDefaults, setConfirmRestoreNotifDefaults] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const showAsyncSyncSkeleton = useDelayedLoading(
    isImportingBackup || networkStatus.statusReason === 'checking',
    90
  );

  // Password change in settings
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMessage, setPassMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const savedSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedSuccessTimerRef.current !== null) {
        clearTimeout(savedSuccessTimerRef.current);
      }
      if (passTimerRef.current !== null) {
        clearTimeout(passTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setName(teacherProfile.name);
    setSubject(teacherProfile.subject);
    setPhone(teacherProfile.phone || '');
    setCenterOrSchool(teacherProfile.centerOrSchool || '');
  }, [
    teacherProfile.name,
    teacherProfile.subject,
    teacherProfile.phone,
    teacherProfile.centerOrSchool,
  ]);

  useEffect(() => {
    if (!isActive) return;

    const syncSnapshot = () => {
      const nextTime = db.getLastSyncTime(currentUser?.id);
      const nextCfg = db.getAutoSyncConfig(currentUser?.id);
      setLastSyncTime((prev) => (prev === nextTime ? prev : nextTime));
      setAutoSyncConfig((prev) =>
        JSON.stringify(prev) === JSON.stringify(nextCfg) ? prev : nextCfg
      );
    };

    const syncNotifSnapshot = () => {
      const latest = normalizeNotificationSettings(db.getNotificationSettings(currentUser?.id));
      setNotifSettings((prev) =>
        JSON.stringify(prev) === JSON.stringify(latest) ? prev : latest
      );
      setPermStatus(getPermissionStatusSync());
    };

    syncSnapshot();
    syncNotifSnapshot();
    refreshPermissionStatus().then((st) => setPermStatus(st)).catch(() => {});

    const unsubscribeSync = db.subscribeToSyncUpdates(syncSnapshot);
    const unsubscribeNotif = subscribeToNotifications(syncNotifSnapshot);

    const unsubscribeNet = subscribeToNetworkStatus((status) => {
      setNetworkStatus((prev) =>
        prev.isOnline === status.isOnline && prev.statusReason === status.statusReason
          ? prev
          : status
      );
    });

    const interval = setInterval(syncSnapshot, 10000);

    return () => {
      unsubscribeSync();
      unsubscribeNotif();
      unsubscribeNet();
      clearInterval(interval);
    };
  }, [currentUser, isActive]);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  };

  const handleToggleDarkTheme = (nextDark: boolean) => {
    triggerLightHaptic();
    setTheme(nextDark ? 'dark' : 'light');
    showToast(
      nextDark
        ? (isEn ? 'Dark theme enabled.' : 'تم تفعيل الوضع الداكن.')
        : (isEn ? 'Light theme enabled.' : 'تم تفعيل الوضع الفاتح.'),
      'info'
    );
  };

  const handleToggleHaptics = (nextEnabled: boolean) => {
    setHapticsEnabled(nextEnabled);
    if (nextEnabled) {
      triggerLightHaptic();
    }
    showToast(
      nextEnabled ? t('hapticFeedbackEnabledToast') : t('hapticFeedbackDisabledToast'),
      'info'
    );
  };

  // Handle frequency schedule change
  const handleFrequencyChange = (newFreq: AutoSyncFrequency) => {
    const updated = db.setSyncFrequency(newFreq, currentUser?.id);
    setAutoSyncConfig(updated);
    const labels: Record<AutoSyncFrequency, string> = {
      off: isEn ? 'Off' : 'إيقاف',
      hourly: isEn ? 'Hourly' : 'كل ساعة',
      daily: isEn ? 'Daily' : 'كل يوم',
      weekly: isEn ? 'Weekly' : 'كل أسبوع',
      monthly: isEn ? 'Monthly' : 'كل شهر',
    };
    showToast(
      newFreq === 'off'
        ? (isEn ? 'Automatic scheduled sync disabled.' : 'تم إيقاف المزامنة التلقائية المجدولة.')
        : (isEn ? `Auto sync schedule (${labels[newFreq]}) enabled.` : `تم تفعيل جدول المزامنة التلقائية (${labels[newFreq]}).`),
      'success'
    );
  };

  // Handle Sync Now
  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await db.performFullSync(currentUser?.id, true);
      setLastSyncTime(db.getLastSyncTime(currentUser?.id));
      setAutoSyncConfig(db.getAutoSyncConfig(currentUser?.id));
      showToast(res.message, res.isOffline ? 'info' : 'success');
    } catch (err: any) {
      showToast(
        isEn ? 'Sync failed, but all data is secured locally on this device.' : 'فشلت المزامنة، ولكن تم حفظ وتأمين جميع البيانات محلياً على هذا الجهاز.',
        'error'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Backup (Export JSON)
  const handleBackupNow = () => {
    setIsSyncing(true);
    try {
      const backupJson = db.exportDatabaseJSON();
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const userName = (currentUser?.name || teacherProfile.name || 'teacher').replace(/\s+/g, '_');
      const dateStr = toLocalISODate();
      a.download = `Classy_Backup_${userName}_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);

      notifyBackupOrRestoreEvent({
        eventType: 'backup_completed',
        userId: currentUser?.id,
      });

      showToast(
        isEn
          ? 'Backup exported successfully!'
          : 'تم تصدير النسخة الاحتياطية بنجاح!',
        'success'
      );
    } catch (err) {
      notifyBackupOrRestoreEvent({
        eventType: 'backup_failed',
        userId: currentUser?.id,
      });
      showToast(isEn ? 'Error occurred during backup.' : 'حدث خطأ أثناء إجراء النسخ الاحتياطي.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Restore from user account
  const handleRestoreFromAccount = () => {
    if (!currentUser) return;
    if (
      !confirm(
        isEn
          ? 'Do you want to restore the latest data synced with your account? This will refresh all local records.'
          : 'هل ترغب في استعادة آخر بيانات محفوظة ومتزامنة مع حسابك؟ سيتم تحديث جميع السجلات على هذا الجهاز.'
      )
    ) {
      return;
    }

    setIsSyncing(true);
    try {
      const res = db.restoreAccountData(currentUser.id);
      if (res.success) {
        setLastSyncTime(db.getLastSyncTime(currentUser.id));
        showToast(
          isEn
            ? `${res.message} (${res.count?.students || 0} students, ${res.count?.groups || 0} groups)`
            : `${res.message} (${res.count?.students || 0} طالب، ${res.count?.groups || 0} مجموعة)`,
          'success'
        );
        onDataReset();
      } else {
        notifyBackupOrRestoreEvent({
          eventType: 'restore_failed',
          detail: res.message,
          userId: currentUser.id,
        });
        showToast(res.message, 'error');
      }
    } catch (err) {
      notifyBackupOrRestoreEvent({
        eventType: 'restore_failed',
        userId: currentUser.id,
      });
      showToast(isEn ? 'Data restore failed.' : 'فشلت عملية استعادة البيانات.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Import Backup from JSON file
  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !confirm(
        isEn
          ? `Are you sure you want to import backup from "${file.name}"? Existing data will be merged safely.`
          : `هل أنت متأكد من استيراد النسخة الاحتياطية من "${file.name}"؟ سيتم دمج السجلات بأمان.`
      )
    ) {
      e.target.value = '';
      return;
    }

    setIsImportingBackup(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const res = db.importAccountBackup(text, currentUser?.id);
        if (res.success) {
          showToast(
            isEn
              ? 'Backup restored successfully!'
              : 'تمت استعادة النسخة الاحتياطية بنجاح!',
            'success'
          );
          onDataReset();
        } else {
          notifyBackupOrRestoreEvent({
            eventType: 'restore_failed',
            detail: res.message,
            userId: currentUser?.id,
          });
          showToast(res.message || (isEn ? 'Invalid backup file format.' : 'صيغة ملف النسخ غير صحيحة.'), 'error');
        }
      } catch (err) {
        notifyBackupOrRestoreEvent({
          eventType: 'restore_failed',
          userId: currentUser?.id,
        });
        showToast(isEn ? 'Failed to parse backup JSON file.' : 'فشل قراءة ملف النسخة الاحتياطية.', 'error');
      } finally {
        setIsImportingBackup(false);
      }
    };
    reader.onerror = () => {
      setIsImportingBackup(false);
      notifyBackupOrRestoreEvent({
        eventType: 'restore_failed',
        userId: currentUser?.id,
      });
      showToast(isEn ? 'Failed to read backup file.' : 'تعذر قراءة ملف النسخة الاحتياطية.', 'error');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Handle save profile
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: TeacherProfile = {
      ...teacherProfile,
      name: name.trim(),
      subject: subject.trim(),
      phone: phone.trim() || undefined,
      centerOrSchool: centerOrSchool.trim() || undefined,
    };
    onProfileUpdated(updated);
    setSavedSuccess(true);
    showToast(isEn ? 'Profile updated successfully!' : 'تم حفظ بيانات المعلم بنجاح!', 'success');
    if (savedSuccessTimerRef.current !== null) {
      clearTimeout(savedSuccessTimerRef.current);
    }
    savedSuccessTimerRef.current = setTimeout(() => {
      setSavedSuccess(false);
      savedSuccessTimerRef.current = null;
    }, 3000);
  };

  // Handle password change
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setPassMessage(null);

    if (!currentPass || !newPass) {
      setPassMessage({ type: 'error', text: isEn ? 'Please enter current and new password.' : 'يرجى إدخال كلمة المرور الحالية والجديدة.' });
      return;
    }
    if (newPass.length < 6) {
      setPassMessage({ type: 'error', text: isEn ? 'New password must be at least 6 characters.' : 'كلمة المرور الجديدة يجب أن تكون 6 خانات على الأقل.' });
      return;
    }

    const res = db.changePassword(currentUser.id, currentPass, newPass);
    if (res.success) {
      setPassMessage({ type: 'success', text: isEn ? 'Password changed successfully!' : 'تم تغيير كلمة المرور بنجاح!' });
      setCurrentPass('');
      setNewPass('');
      if (passTimerRef.current !== null) {
        clearTimeout(passTimerRef.current);
      }
      passTimerRef.current = setTimeout(() => {
        setIsChangingPassword(false);
        setPassMessage(null);
        passTimerRef.current = null;
      }, 2000);
    } else {
      setPassMessage({ type: 'error', text: res.message });
    }
  };

  // Centralized Notification Preference Updater (takes effect immediately & persists per user)
  const updateNotifPatch = (patch: Partial<NotificationSettings>) => {
    triggerLightHaptic();
    const next = normalizeNotificationSettings({
      ...notifSettings,
      ...patch,
    });
    if (patch.enableStudentAbsenceAlerts !== undefined) {
      next.enableAbsenceReminders = patch.enableStudentAbsenceAlerts;
    } else if (patch.enableAbsenceReminders !== undefined) {
      next.enableStudentAbsenceAlerts = patch.enableAbsenceReminders;
    }
    setNotifSettings(next);
    db.saveNotificationSettings(next, currentUser?.id);
  };

  const handleRequestOsPermission = async () => {
    triggerLightHaptic();
    const res = await requestPlatformNotificationPermission();
    setPermStatus(res);
    if (res === 'granted') {
      resetPermissionAlertDismissal(currentUser?.id);
      showToast(
        isEn
          ? 'Device notification permission enabled.'
          : 'تم تفعيل صلاحية إشعارات الجهاز بنجاح.',
        'success'
      );
    } else if (res === 'denied') {
      showToast(
        isEn
          ? 'Permission blocked by system settings. Enable notifications in your device/browser settings.'
          : 'الصلاحية محجوبة من إعدادات النظام. يرجى تفعيل الإشعارات من إعدادات الهاتف أو المتصفح.',
        'info'
      );
    }
  };

  const handleToggleMobileAlerts = async (nextVal: boolean) => {
    if (nextVal && permStatus !== 'granted') {
      const res = await requestPlatformNotificationPermission();
      setPermStatus(res);
      if (res === 'granted') {
        resetPermissionAlertDismissal(currentUser?.id);
      }
    }
    updateNotifPatch({ enableMobileNotifications: nextVal });
  };

  const handleToggleQuietDay = (dayKey: string) => {
    const currentDays = notifSettings.quietHoursDays || [];
    const exists = currentDays.includes(dayKey);
    const nextDays = exists
      ? currentDays.filter((d) => d !== dayKey)
      : [...currentDays, dayKey];
    updateNotifPatch({ quietHoursDays: nextDays });
  };

  // Handle Notification Sound Change
  const handleSoundChange = async (soundUri: string) => {
    const selectedOption = VERIFIED_NOTIFICATION_SOUNDS.find((s) => s.uri === soundUri);
    const soundName = selectedOption ? (isEn ? selectedOption.nameEn : selectedOption.nameAr) : soundUri;
    const isSilent = soundUri === 'silent';

    const next = normalizeNotificationSettings({
      ...notifSettings,
      soundPreset: (selectedOption?.id || 'default') as NotificationSettings['soundPreset'],
      notificationSoundUri: soundUri,
      notificationSoundName: soundName,
      enableNotificationSound: !isSilent,
    });
    setNotifSettings(next);
    await updateNotificationSoundPreference(soundUri, soundName, currentUser?.id, isEn);
  };

  // Test Device Notification Trigger
  const handleSendTestNotification = async () => {
    triggerLightHaptic();
    const success = await sendTestAttendanceReminderNotification(isEn, notifSettings.soundPreset);
    setPermStatus(getPermissionStatusSync());
    if (success) {
      showToast(
        isEn ? 'Test alert dispatched successfully.' : 'تم إرسال التنبيه التجريبي بنجاح.',
        'info'
      );
    } else {
      showToast(
        isEn
          ? 'Enable notification permission to receive device alerts.'
          : 'فعّل صلاحية الإشعارات لاستلام تنبيهات الجهاز.',
        'info'
      );
    }
  };

  // Test Sound Preview Trigger
  const handleTestSound = async () => {
    triggerLightHaptic();
    const activePreset = notifSettings.soundPreset || 'default';
    const selectedOption =
      VERIFIED_NOTIFICATION_SOUNDS.find((s) => s.id === activePreset) ||
      VERIFIED_NOTIFICATION_SOUNDS[0];
    const soundDisplayName = isEn ? selectedOption.nameEn : selectedOption.nameAr;

    if (activePreset === 'silent') {
      showToast(
        isEn
          ? 'Silent preset is selected (visual alerts only, no sound).'
          : 'الوضع الصامت محدد حالياً (إشعار مرئي بدون صوت).',
        'info'
      );
      return;
    }

    const res = await playNotificationSoundTone(activePreset, {
      isPreview: true,
      settings: notifSettings,
    });
    if (res.played) {
      showToast(
        isEn ? `Playing sound preview: "${soundDisplayName}"` : `معاينة نغمة: "${soundDisplayName}"`,
        'info'
      );
    } else {
      showToast(
        isEn ? 'Audio preview unavailable on this device.' : 'تعذر تشغيل معاينة الصوت على هذا الجهاز.',
        'error'
      );
    }
  };

  const handleConfirmClearNotifHistory = () => {
    triggerLightHaptic();
    clearNotificationHistoryForUser(currentUser?.id);
    setConfirmClearNotifHistory(false);
    onDataReset();
    showToast(
      isEn ? 'Notification history cleared.' : 'تم مسح سجل الإشعارات بنجاح.',
      'info'
    );
  };

  const handleConfirmRestoreNotifDefaults = async () => {
    triggerLightHaptic();
    const restored = await restoreDefaultNotificationSettings(currentUser?.id, isEn);
    setNotifSettings(restored);
    setConfirmRestoreNotifDefaults(false);
    onDataReset();
    showToast(
      isEn
        ? 'Default notification settings restored.'
        : 'تمت استعادة الإعدادات الافتراضية للإشعارات.',
      'success'
    );
  };

  const platformCaps = getPlatformNotificationCapabilities();

  // Handle reset data
  const handleResetData = () => {
    if (
      confirm(
        isEn
          ? 'Are you sure you want to erase all records (students, groups, sessions, payments) on this device?'
          : 'هل أنت متأكد من مسح جميع البيانات (الطلاب، المجموعات، الحصص، المقبوضات) من هذا الجهاز؟'
      )
    ) {
      db.clearAllData();
      onDataReset();
      showToast(isEn ? 'All data cleared successfully.' : 'تم مسح البيانات بنجاح.', 'info');
    }
  };

  const syncStatus = formatSyncStatusArabic(
    autoSyncConfig.lastSyncStatus,
    networkStatus.isOnline,
    networkStatus.statusReason
  );

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar px-5 py-4 space-y-6 text-navy pb-32 bg-page relative"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Screen Header with Back Arrow and Title */}
      <header className="flex items-center justify-between gap-3 pt-1 select-none">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            data-tutorial-id="settings-back-btn"
            onClick={() => (onBack ? onBack() : onNavigateToTab ? onNavigateToTab('dashboard') : undefined)}
            aria-label={t('back') || (isEn ? 'Back' : 'رجوع')}
            title={t('back') || (isEn ? 'Back' : 'رجوع')}
            className="text-navy hover:text-navy/80 active:scale-95 transition-transform cursor-pointer p-0.5 flex items-center justify-center"
          >
            <AppIcon name="chevronStart" weight="bold" size={26} />
          </button>
          <h1 className="t-display text-navy">
            {t('settingsTitle') || (isEn ? 'Settings' : 'الإعدادات')}
          </h1>
        </div>

        <SyncStatusPill
          isOnline={networkStatus.isOnline}
          syncStatus={autoSyncConfig.lastSyncStatus}
          lastSyncTime={lastSyncTime || undefined}
          onClick={handleSyncNow}
        />
      </header>

      {/* =========================================================================
          INTERACTIVE ONBOARDING TUTORIAL & CHAPTER HUB
          ========================================================================= */}
      <section className="space-y-2">
        <h2 className="t-caption text-slate uppercase tracking-wider px-1">
          {isEn ? 'Interactive Guide & Help' : 'الجولة التفاعلية والمساعدة'}
        </h2>
        <MintCard
          data-tutorial-id="settings-tutorial-card"
          className="bg-mint-soft p-4 sm:p-5 space-y-3.5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-page flex items-center justify-center text-orange shrink-0 shadow-xs">
                <AppIcon name="sparkles" size={20} weight="fill" />
              </div>
              <div className="min-w-0">
                <h3 className="t-card text-navy font-bold leading-tight">
                  {isEn ? 'Interactive Hands-On Tour' : 'الجولة التفاعلية خطوة بخطوة'}
                </h3>
                <p className="t-meta text-slate text-xs mt-0.5 leading-snug">
                  {tutorialPersisted.status === 'in_progress'
                    ? isEn
                      ? `Saved progress (${tutorialPersisted.completedChapterIds.length}/${TUTORIAL_CHAPTERS.length} chapters completed)`
                      : `لديك جولة محفوظة (${tutorialPersisted.completedChapterIds.length}/${TUTORIAL_CHAPTERS.length} فصول مكتملة)`
                    : isEn
                    ? 'Learn Students, Groups, Attendance, Billing & Reports directly on real screens'
                    : 'تعلّم استخدام الطلاب والمجموعات والتحضير والمحاسبة والتقارير عملياً'}
                </p>
              </div>
            </div>

            <span className="text-[11px] font-bold text-slate tabular-nums shrink-0 pt-0.5">
              {tutorialPersisted.completedChapterIds.length}/{TUTORIAL_CHAPTERS.length}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {tutorialPersisted.status === 'in_progress' ? (
              <button
                type="button"
                onClick={() => {
                  triggerLightHaptic();
                  resumeTutorial(currentUser?.id);
                }}
                className="btn-orange h-10 min-h-[40px] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <AppIcon name="sparkles" size={15} weight="fill" />
                <span>{isEn ? 'Resume Saved Tour' : 'متابعة الجولة المحفوظة'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  triggerLightHaptic();
                  startFullTutorial(currentUser?.id, false);
                }}
                className="btn-orange h-10 min-h-[40px] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <AppIcon name="sparkles" size={15} weight="fill" />
                <span>
                  {tutorialPersisted.completedChapterIds.length > 0
                    ? isEn
                      ? 'Restart Interactive Tour'
                      : 'إعادة تشغيل الجولة التفاعلية'
                    : isEn
                    ? 'Start Interactive Tour'
                    : 'ابدأ الجولة التفاعلية'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                triggerLightHaptic();
                openTutorialChapterHub();
              }}
              className="btn-soft h-10 min-h-[40px] text-xs font-bold flex items-center justify-center gap-1.5 bg-page border border-line cursor-pointer"
            >
              <AppIcon name="list" size={15} />
              <span>{isEn ? 'Choose a Specific Chapter' : 'اختيار فصل محدد (7 فصول)'}</span>
            </button>
          </div>

          {practiceEntitiesInfo.totalCount > 0 && (
            <div className="pt-2.5 border-t border-line/70 flex items-center justify-between gap-2.5">
              <span className="text-[11px] font-semibold text-slate">
                {isEn
                  ? `${practiceEntitiesInfo.totalCount} [Practice] sample item(s) present`
                  : `يوجد ${practiceEntitiesInfo.totalCount} سجل تجريبي بوسم [تجريبي]`}
              </span>
              <button
                type="button"
                onClick={() => {
                  triggerLightHaptic();
                  const res = cleanupPracticeEntities(currentUser?.id);
                  onDataReset();
                  const removed = res.removedStudents + res.removedGroups;
                  showToast(
                    isEn
                      ? `Removed ${removed} [Practice] sample item(s). Real data preserved.`
                      : `تم مسح ${removed} سجل تجريبي [تجريبي] بأمان تام.`,
                    'success'
                  );
                }}
                className="px-3 py-1.5 rounded-xl bg-page border border-line hover:bg-mist text-navy text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
              >
                <AppIcon name="trash" size={13} />
                <span>{isEn ? 'Clean Up Practice Data' : 'مسح البيانات التجريبية'}</span>
              </button>
            </div>
          )}
        </MintCard>
      </section>

      {/* =========================================================================
          GROUP 1: APPLICATION LANGUAGE (SegmentedControl)
          ========================================================================= */}
      <section className="space-y-2">
        <h2 className="t-caption text-slate uppercase tracking-wider px-1">
          {isEn ? 'Language' : 'اللغة'}
        </h2>
        <MintCard
          data-tutorial-id="settings-language-card"
          className="bg-mint-soft p-4 sm:p-5 space-y-3.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-page flex items-center justify-center text-navy shrink-0 shadow-xs">
                <AppIcon name="globe" size={20} weight="duotone" />
              </div>
              <div className="min-w-0">
                <h3 className="t-card text-navy font-bold leading-tight">
                  {t('languageSettings')}
                </h3>
                <p className="t-meta text-slate text-xs mt-0.5 truncate">
                  {t('selectLanguage')}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-page text-navy border border-line">
              {language === 'ar' ? 'العربية' : language === 'en-GB' ? 'UK' : 'US'}
            </span>
          </div>

          <SegmentedControl<Language>
            value={language}
            onChange={(val) => setLanguage(val)}
            options={[
              { value: 'ar', label: 'العربية (AR)' },
              { value: 'en-GB', label: 'English (UK)' },
              { value: 'en-US', label: 'English (US)' },
            ]}
          />
        </MintCard>
      </section>

      {/* =========================================================================
          APPEARANCE / HARBOR MINT DARK THEME TOGGLE
          ========================================================================= */}
      <section className="space-y-2">
        <h2 className="t-caption text-slate uppercase tracking-wider px-1">
          {isEn ? 'Appearance' : 'المظهر'}
        </h2>
        <MintCard className="bg-mint-soft p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-page/70 border border-line/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-page flex items-center justify-center text-navy shrink-0 shadow-xs">
                <AppIcon name={isDark ? 'moon' : 'sun'} size={20} weight="duotone" />
              </div>
              <div className="min-w-0">
                <h3 className="t-card text-navy font-bold leading-tight">
                  {isEn ? 'Dark Theme' : 'الوضع الداكن'}
                </h3>
                <p className="t-meta text-slate text-xs mt-0.5 truncate">
                  {isDark
                    ? (isEn ? 'High-contrast Harbor Mint dark mode active' : 'وضع هاربور منت الداكن عالي التباين مفعّل')
                    : (isEn ? 'Switch to high-contrast Harbor Mint dark mode' : 'تفعيل المظهر الداكن عالي التباين المريح للعين')}
                </p>
              </div>
            </div>
            <Toggle
              id="settings-dark-theme-toggle"
              checked={isDark}
              onChange={handleToggleDarkTheme}
              ariaLabel={isEn ? 'Dark Theme' : 'الوضع الداكن'}
            />
          </div>
        </MintCard>
      </section>

      {/* =========================================================================
          INTERACTION / HAPTIC FEEDBACK TOGGLE
          ========================================================================= */}
      <section className="space-y-2">
        <h2 className="t-caption text-slate uppercase tracking-wider px-1">
          {t('interactionSection')}
        </h2>
        <MintCard className="bg-mint-soft p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-page/70 border border-line/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-page flex items-center justify-center text-navy shrink-0 shadow-xs">
                <AppIcon name="activity" size={20} weight="duotone" />
              </div>
              <div className="min-w-0">
                <h3 className="t-card text-navy font-bold leading-tight">
                  {t('hapticFeedback')}
                </h3>
                <p className="t-meta text-slate text-xs mt-0.5 leading-snug">
                  {t('hapticFeedbackDesc')}
                </p>
              </div>
            </div>
            <Toggle
              id="settings-haptic-feedback-toggle"
              checked={hapticsEnabled}
              onChange={handleToggleHaptics}
              ariaLabel={t('hapticFeedback')}
            />
          </div>
        </MintCard>
      </section>

      {/* =========================================================================
          GROUP 2: TEACHER PROFILE & BRANDING
          ========================================================================= */}
      <section className="space-y-2">
        <h2 className="t-caption text-slate uppercase tracking-wider px-1">
          {isEn ? 'Teacher Profile' : 'الملف الشخصي'}
        </h2>
        <MintCard className="bg-mint-soft p-4 sm:p-5 space-y-4">
          <form onSubmit={handleSaveProfile} className="space-y-3.5">
            {/* Row 1: Teacher Name */}
            <div className="flex items-center gap-3 p-2 rounded-2xl bg-page/70 border border-line/60">
              <div className="w-10 h-10 rounded-full bg-page flex items-center justify-center text-navy shrink-0 shadow-xs">
                <AppIcon name="teacher" size={20} weight="duotone" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[11px] font-bold text-slate block">
                  {t('teacherName')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent font-bold text-sm text-navy focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Row 2: Subject */}
            <div className="flex items-center gap-3 p-2 rounded-2xl bg-page/70 border border-line/60">
              <div className="w-10 h-10 rounded-full bg-page flex items-center justify-center text-navy shrink-0 shadow-xs">
                <AppIcon name="bookOpen" size={20} weight="duotone" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[11px] font-bold text-slate block">
                  {t('subject')}
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-transparent font-bold text-sm text-navy focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Row 3: Phone */}
            <div className="flex items-center gap-3 p-2 rounded-2xl bg-page/70 border border-line/60">
              <div className="w-10 h-10 rounded-full bg-page flex items-center justify-center text-navy shrink-0 shadow-xs">
                <AppIcon name="phone" size={20} weight="duotone" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[11px] font-bold text-slate block">
                  {t('phone')}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-transparent font-bold text-sm text-navy focus:outline-none"
                />
              </div>
            </div>

            {/* Row 4: Center or School */}
            <div className="flex items-center gap-3 p-2 rounded-2xl bg-page/70 border border-line/60">
              <div className="w-10 h-10 rounded-full bg-page flex items-center justify-center text-navy shrink-0 shadow-xs">
                <AppIcon name="school" size={20} weight="duotone" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[11px] font-bold text-slate block">
                  {isEn ? 'Center / Academy' : 'السنتر / المؤسسة'}
                </label>
                <input
                  type="text"
                  value={centerOrSchool}
                  onChange={(e) => setCenterOrSchool(e.target.value)}
                  className="w-full bg-transparent font-bold text-sm text-navy focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="btn-orange px-6"
              >
                <AppIcon name="check" size={16} weight="bold" />
                <span>{savedSuccess ? (isEn ? 'Saved!' : 'تم الحفظ!') : t('save')}</span>
              </button>
            </div>
          </form>

          {/* Password toggle for authenticated teachers */}
          {currentUser && (
            <div className="pt-3 border-t border-line/70 space-y-3">
              <button
                type="button"
                onClick={() => setIsChangingPassword(!isChangingPassword)}
                className="w-full flex items-center justify-between p-2 rounded-2xl hover:bg-page/50 transition-colors cursor-pointer text-start"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-page flex items-center justify-center text-navy shrink-0 shadow-xs">
                    <AppIcon name="key" size={20} weight="duotone" />
                  </div>
                  <div>
                    <h4 className="t-card text-navy font-bold">{isEn ? 'Change Password' : 'تغيير كلمة المرور'}</h4>
                    <p className="t-meta text-slate text-xs">{isEn ? 'Update your account access credentials' : 'تحديث كلمة مرور الدخول للحساب'}</p>
                  </div>
                </div>
                <AppIcon name={isChangingPassword ? 'chevronUp' : 'chevronEnd'} size={18} className="text-slate shrink-0" />
              </button>

              {isChangingPassword && (
                <form onSubmit={handleChangePassword} className="space-y-2.5 p-3 rounded-2xl bg-page border border-line">
                  {passMessage && (
                    <div className={`p-2 rounded-xl text-xs font-bold ${passMessage.type === 'error' ? 'text-coral bg-coral/10' : 'text-teal bg-mint-soft'}`}>
                      {passMessage.text}
                    </div>
                  )}
                  <input
                    type="password"
                    placeholder={isEn ? 'Current password' : 'كلمة المرور الحالية'}
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    className="classy-input"
                  />
                  <input
                    type="password"
                    placeholder={isEn ? 'New password (min 6 characters)' : 'كلمة المرور الجديدة (6 خانات على الأقل)'}
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    className="classy-input"
                  />
                  <div className="flex justify-end pt-1">
                    <button type="submit" className="btn-navy px-5 text-xs">
                      {isEn ? 'Update Password' : 'حفظ كلمة المرور'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </MintCard>
      </section>

      {/* =========================================================================
          GROUP 3: CLOUD SYNC & DATA BACKUP
          ========================================================================= */}
      <section className="space-y-2">
        <h2 className="t-caption text-slate uppercase tracking-wider px-1">
          {isEn ? 'Cloud & Backup' : 'المزامنة والنسخ'}
        </h2>
        <MintCard
          data-tutorial-id="settings-cloud-sync-card"
          className="bg-mint-soft p-4 sm:p-5 space-y-3.5"
        >
          {/* Header row with status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-page flex items-center justify-center text-navy shrink-0 shadow-xs">
                <AppIcon name="wifi" size={20} weight="duotone" />
              </div>
              <div>
                <h3 className="t-card text-navy font-bold leading-tight">
                  {isEn ? 'Data Sync State' : 'حالة المزامنة السحابية'}
                </h3>
                {showAsyncSyncSkeleton ? (
                  <SettingsSyncStatusSkeleton />
                ) : (
                  <p className="t-meta text-slate text-xs mt-0.5">
                    {syncStatus.label}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="btn-navy px-4 text-xs h-9 min-h-[36px]"
            >
              <AppIcon name="spinner" size={14} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? (isEn ? 'Syncing...' : 'جاري المزامنة...') : (isEn ? 'Sync Now' : 'مزامنة الآن')}</span>
            </button>
          </div>

          {/* Backup Operations: Export / Import / Restore */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-line/70">
            {/* Export JSON */}
            <button
              type="button"
              onClick={handleBackupNow}
              className="p-3 rounded-2xl bg-page border border-line flex items-center gap-2.5 text-start hover:bg-page/80 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-mint-soft flex items-center justify-center text-navy shrink-0">
                <AppIcon name="download" size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-navy block truncate">
                  {isEn ? 'Export JSON' : 'تصدير نسخة'}
                </span>
                <span className="text-[10px] text-slate block truncate">
                  {isEn ? 'Download backup' : 'حفظ ملف محلي'}
                </span>
              </div>
            </button>

            {/* Import JSON */}
            <label className="p-3 rounded-2xl bg-page border border-line flex items-center gap-2.5 text-start hover:bg-page/80 transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-mint-soft flex items-center justify-center text-navy shrink-0">
                <AppIcon name="upload" size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-navy block truncate">
                  {isEn ? 'Import Backup' : 'استيراد نسخة'}
                </span>
                <span className="text-[10px] text-slate block truncate">
                  {isEn ? 'Restore from .json' : 'رفع ملف نسخة'}
                </span>
              </div>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackupFile}
                className="hidden"
              />
            </label>

            {/* Account Restore */}
            <button
              type="button"
              onClick={handleRestoreFromAccount}
              className="p-3 rounded-2xl bg-page border border-line flex items-center gap-2.5 text-start hover:bg-page/80 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-mint-soft flex items-center justify-center text-navy shrink-0">
                <AppIcon name="cloudCheck" size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-navy block truncate">
                  {isEn ? 'Account Restore' : 'استعادة الحساب'}
                </span>
                <span className="text-[10px] text-slate block truncate">
                  {isEn ? 'Reload cloud snapshot' : 'تحديث من السحابة'}
                </span>
              </div>
            </button>
          </div>

          {/* Sync Frequency Schedule Chips */}
          <div className="space-y-2 pt-2 border-t border-line/70">
            <span className="text-[11px] font-bold text-slate block">
              {isEn ? 'Automatic Scheduled Sync:' : 'جدولة المزامنة التلقائية:'}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { key: 'off', label: isEn ? 'Off' : 'إيقاف' },
                { key: 'hourly', label: isEn ? 'Hourly' : 'كل ساعة' },
                { key: 'daily', label: isEn ? 'Daily' : 'كل يوم' },
                { key: 'weekly', label: isEn ? 'Weekly' : 'كل أسبوع' },
                { key: 'monthly', label: isEn ? 'Monthly' : 'كل شهر' },
              ].map((item) => {
                const isSelected = autoSyncConfig.frequency === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleFrequencyChange(item.key as AutoSyncFrequency)}
                    className={`chip ${isSelected ? 'chip-active' : ''}`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </MintCard>
      </section>

      {/* =========================================================================
          GROUP 4: PROFESSIONAL NOTIFICATIONS & MOBILE ALERTS
          ========================================================================= */}
      <section className="space-y-2">
        <h2 className="t-caption text-slate uppercase tracking-wider px-1">
          {isEn ? 'Notifications & Alerts' : 'الإشعارات والتنبيهات'}
        </h2>
        <MintCard
          data-tutorial-id="settings-notifications-card"
          className="bg-mint-soft p-4 sm:p-5 space-y-3"
        >
          {/* Master Switch: Enable All Notifications */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-page border border-line shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-mint-soft flex items-center justify-center text-navy shrink-0 border border-line/60">
                <AppIcon name="bell" size={20} weight="duotone" />
              </div>
              <div className="min-w-0">
                <h4 className="t-card text-navy font-bold leading-tight">
                  {t('notifEnableAll')}
                </h4>
                <p className="t-meta text-slate text-xs mt-0.5 truncate">
                  {notifSettings.enableNotifications !== false
                    ? (isEn ? 'Active across in-app center & scheduled alerts' : 'مفعلة لمركز الإشعارات والتنبيهات المجدولة')
                    : (isEn ? 'All notifications and scheduled alarms are paused' : 'جميع الإشعارات والتنبيهات المجدولة متوقفة')}
                </p>
              </div>
            </div>
            <Toggle
              checked={notifSettings.enableNotifications !== false}
              onChange={(val) => updateNotifPatch({ enableNotifications: val })}
              ariaLabel={t('notifEnableAll')}
            />
          </div>

          {notifSettings.enableNotifications !== false && (
            <>
              {/* OS / Browser Permission Recovery Banner */}
              {notifSettings.enableMobileNotifications !== false && permStatus !== 'granted' && (
                <div className="p-3 rounded-2xl bg-page border border-orange/40 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <AppIcon name="warning" size={18} weight="fill" className="text-orange shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-navy block">
                        {permStatus === 'denied'
                          ? (isEn ? 'Notification Permission Blocked' : 'صلاحية الإشعارات محجوبة من النظام')
                          : permStatus === 'unsupported'
                          ? (isEn ? 'In-App Alerts Active (OS Tray Unsupported)' : 'تنبيهات داخل التطبيق نشطة')
                          : (isEn ? 'Allow Device Notifications' : 'السماح بإشعارات الهاتف')}
                      </span>
                      <span className="text-[11px] text-slate block mt-0.5 leading-snug">
                        {permStatus === 'denied'
                          ? (isEn
                              ? 'Enable notifications in system settings to receive lesson alarms outside the app.'
                              : 'فعّل صلاحية الإشعارات من إعدادات الجهاز لاستلام تنبيهات الحصص بالخلفية.')
                          : (isEn
                              ? 'Grant permission to receive scheduled lesson and attendance alerts with sound.'
                              : 'امنح الصلاحية لاستلام تذكيرات الحصص والحضور بالصوت في موعدها.')}
                      </span>
                    </div>
                  </div>
                  {permStatus !== 'unsupported' && (
                    <button
                      type="button"
                      onClick={handleRequestOsPermission}
                      className="btn-orange px-3 py-1.5 text-xs shrink-0"
                    >
                      {isEn ? 'Enable' : 'تفعيل'}
                    </button>
                  )}
                </div>
              )}

              {/* Channel Delivery Switches (Mobile, In-App, Sound, Vibration) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-page/75 border border-line/60">
                  <div className="min-w-0 pe-2">
                    <span className="text-xs font-bold text-navy block truncate">
                      {t('notifEnableMobile')}
                    </span>
                    <span className="text-[10px] text-slate block truncate">
                      {isEn ? 'Scheduled device alarms' : 'تنبيهات مجدولة على الهاتف'}
                    </span>
                  </div>
                  <Toggle
                    checked={notifSettings.enableMobileNotifications !== false}
                    onChange={handleToggleMobileAlerts}
                    ariaLabel={t('notifEnableMobile')}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-page/75 border border-line/60">
                  <div className="min-w-0 pe-2">
                    <span className="text-xs font-bold text-navy block truncate">
                      {t('notifEnableInApp')}
                    </span>
                    <span className="text-[10px] text-slate block truncate">
                      {isEn ? 'Bell badge & alert feed' : 'شارة الجرس وسجل التنبيهات'}
                    </span>
                  </div>
                  <Toggle
                    checked={notifSettings.enableInAppNotifications !== false}
                    onChange={(val) => updateNotifPatch({ enableInAppNotifications: val })}
                    ariaLabel={t('notifEnableInApp')}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-page/75 border border-line/60">
                  <div className="min-w-0 pe-2">
                    <span className="text-xs font-bold text-navy block truncate">
                      {t('notifEnableSound')}
                    </span>
                    <span className="text-[10px] text-slate block truncate">
                      {isEn ? 'Play alert tone' : 'تشغيل نغمة مع الإشعار'}
                    </span>
                  </div>
                  <Toggle
                    checked={
                      notifSettings.enableNotificationSound !== false &&
                      notifSettings.soundPreset !== 'silent'
                    }
                    onChange={(val) =>
                      updateNotifPatch({
                        enableNotificationSound: val,
                        soundPreset: val
                          ? notifSettings.soundPreset === 'silent'
                            ? 'default'
                            : notifSettings.soundPreset || 'default'
                          : notifSettings.soundPreset,
                      })
                    }
                    ariaLabel={t('notifEnableSound')}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-page/75 border border-line/60">
                  <div className="min-w-0 pe-2">
                    <span className="text-xs font-bold text-navy block truncate">
                      {t('notifEnableVibration')}
                    </span>
                    <span className="text-[10px] text-slate block truncate">
                      {!hapticsEnabled
                        ? (isEn ? 'Muted while global Haptics is OFF' : 'متوقف طالما الاهتزاز اللمسي مغلق')
                        : (isEn ? 'Vibrate on alert' : 'اهتزاز عند وصول التنبيه')}
                    </span>
                  </div>
                  <Toggle
                    checked={notifSettings.enableNotificationVibration !== false}
                    onChange={(val) => updateNotifPatch({ enableNotificationVibration: val })}
                    ariaLabel={t('notifEnableVibration')}
                  />
                </div>
              </div>

              {/* Verified Sound Preset Selector + Preview & Test Alert */}
              <div className="p-3 rounded-2xl bg-page border border-line space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-navy flex items-center gap-1.5">
                    <AppIcon name="volume" size={16} weight="duotone" />
                    <span>{isEn ? 'Alert Sound Preset' : 'نغمة الإشعارات المعتمدة'}</span>
                  </label>
                  <span className="text-[10px] text-slate font-semibold">
                    {isEn ? 'Verified playback' : 'صوت محقق بدون ملفات مفقودة'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select
                    value={notifSettings.soundPreset || 'default'}
                    onChange={(e) => handleSoundChange(e.target.value)}
                    className="classy-select flex-1 min-w-0"
                  >
                    {VERIFIED_NOTIFICATION_SOUNDS.map((sound) => (
                      <option key={sound.id} value={sound.uri}>
                        {isEn ? `${sound.nameEn} — ${sound.descEn}` : `${sound.nameAr} — ${sound.descAr}`}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleTestSound}
                      className="btn-soft px-3 text-xs h-10 flex-1 sm:flex-initial flex items-center justify-center gap-1.5"
                      title={isEn ? 'Preview Sound' : 'معاينة النغمة'}
                    >
                      <AppIcon name="volume" size={15} weight="duotone" />
                      <span>{isEn ? 'Preview' : 'معاينة'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSendTestNotification}
                      className="btn-soft px-3 text-xs h-10 flex-1 sm:flex-initial flex items-center justify-center gap-1.5"
                      title={isEn ? 'Send Test Notification' : 'إرسال إشعار تجريبي'}
                    >
                      <AppIcon name="bell" size={15} weight="duotone" />
                      <span>{isEn ? 'Test Alert' : 'تجربة إشعار'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 1. Quiet Hours Accordion */}
              <div className="rounded-2xl bg-page/80 border border-line/70 overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedNotifGroup((prev) => (prev === 'quiet' ? null : 'quiet'))
                  }
                  className="w-full p-3 flex items-center justify-between gap-3 text-start cursor-pointer hover:bg-page transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-mint-soft flex items-center justify-center text-navy shrink-0">
                      <AppIcon name="moon" size={18} weight="duotone" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-navy truncate">
                        {t('notifQuietHours')}
                      </h4>
                      <p className="text-[11px] text-slate truncate">
                        {notifSettings.quietHoursEnabled
                          ? `${formatReminderTimeDisplay(notifSettings.quietHoursStart || '22:00', isEn)} → ${formatReminderTimeDisplay(notifSettings.quietHoursEnd || '07:00', isEn)}`
                          : (isEn ? 'Off — alerts allowed anytime' : 'متوقفة — يسمح بالتنبيهات في أي وقت')}
                      </p>
                    </div>
                  </div>
                  <AppIcon
                    name={expandedNotifGroup === 'quiet' ? 'chevronUp' : 'chevronDown'}
                    size={16}
                    className="text-slate shrink-0"
                  />
                </button>

                {expandedNotifGroup === 'quiet' && (
                  <div className="p-3 pt-2 border-t border-line/60 space-y-3 bg-page">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-navy">
                        {isEn ? 'Enable Quiet Hours' : 'تفعيل ساعات الهدوء'}
                      </span>
                      <Toggle
                        checked={Boolean(notifSettings.quietHoursEnabled)}
                        onChange={(val) => updateNotifPatch({ quietHoursEnabled: val })}
                        ariaLabel="Quiet Hours"
                      />
                    </div>

                    {notifSettings.quietHoursEnabled && (
                      <>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate block">
                              {isEn ? 'Start Time' : 'من الساعة'}
                            </label>
                            <input
                              type="time"
                              value={notifSettings.quietHoursStart || '22:00'}
                              onChange={(e) =>
                                updateNotifPatch({ quietHoursStart: e.target.value })
                              }
                              className="classy-input w-full"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate block">
                              {isEn ? 'End Time' : 'إلى الساعة'}
                            </label>
                            <input
                              type="time"
                              value={notifSettings.quietHoursEnd || '07:00'}
                              onChange={(e) => updateNotifPatch({ quietHoursEnd: e.target.value })}
                              className="classy-input w-full"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold text-slate block">
                            {isEn
                              ? 'Active Days (leave unselected for every day):'
                              : 'أيام التفعيل (اتركها فارغة لتشمل كل الأيام):'}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {[
                              { key: 'saturday', ar: 'السبت', en: 'Sat' },
                              { key: 'sunday', ar: 'الأحد', en: 'Sun' },
                              { key: 'monday', ar: 'الاثنين', en: 'Mon' },
                              { key: 'tuesday', ar: 'الثلاثاء', en: 'Tue' },
                              { key: 'wednesday', ar: 'الأربعاء', en: 'Wed' },
                              { key: 'thursday', ar: 'الخميس', en: 'Thu' },
                              { key: 'friday', ar: 'الجمعة', en: 'Fri' },
                            ].map((d) => {
                              const active = (notifSettings.quietHoursDays || []).includes(d.key);
                              return (
                                <button
                                  key={d.key}
                                  type="button"
                                  onClick={() => handleToggleQuietDay(d.key)}
                                  className={`chip text-[11px] ${active ? 'chip-active' : ''}`}
                                >
                                  {isEn ? d.en : d.ar}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-line/50">
                          <div className="min-w-0 pe-2">
                            <span className="text-xs font-bold text-navy block">
                              {isEn ? 'Allow Critical Alerts' : 'السماح بالتنبيهات الحرجة'}
                            </span>
                            <span className="text-[10px] text-slate block">
                              {isEn
                                ? 'Permit backup/data failure alerts during quiet hours'
                                : 'السماح بتمرير تنبيهات فشل النسخ الاحتياطي الطارئة'}
                            </span>
                          </div>
                          <Toggle
                            checked={Boolean(notifSettings.allowCriticalDuringQuietHours)}
                            onChange={(val) =>
                              updateNotifPatch({ allowCriticalDuringQuietHours: val })
                            }
                            ariaLabel="Allow Critical Alerts"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Category A: Lesson Reminders Accordion */}
              <div className="rounded-2xl bg-page/80 border border-line/70 overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedNotifGroup((prev) => (prev === 'lessons' ? null : 'lessons'))
                  }
                  className="w-full p-3 flex items-center justify-between gap-3 text-start cursor-pointer hover:bg-page transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-mint-soft flex items-center justify-center text-navy shrink-0">
                      <AppIcon name="clock" size={18} weight="duotone" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-navy truncate">
                        {t('notifCatLessons')}
                      </h4>
                      <p className="text-[11px] text-slate truncate">
                        {notifSettings.enableLessonReminders !== false
                          ? (isEn
                              ? `${notifSettings.lessonReminderLeadMinutes || 15} min before group & private lessons`
                              : `قبل الحصص والدروس الخاصة بـ ${notifSettings.lessonReminderLeadMinutes || 15} دقيقة`)
                          : (isEn ? 'Disabled' : 'متوقفة')}
                      </p>
                    </div>
                  </div>
                  <AppIcon
                    name={expandedNotifGroup === 'lessons' ? 'chevronUp' : 'chevronDown'}
                    size={16}
                    className="text-slate shrink-0"
                  />
                </button>

                {expandedNotifGroup === 'lessons' && (
                  <div className="p-3 pt-2 border-t border-line/60 space-y-3 bg-page">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-navy">
                        {isEn ? 'Upcoming Lesson Reminders' : 'تفعيل تذكيرات موعد الحصة'}
                      </span>
                      <Toggle
                        checked={notifSettings.enableLessonReminders !== false}
                        onChange={(val) => updateNotifPatch({ enableLessonReminders: val })}
                        ariaLabel="Lesson Reminders"
                      />
                    </div>

                    {notifSettings.enableLessonReminders !== false && (
                      <>
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold text-slate block">
                            {isEn ? 'Lead Time Before Lesson:' : 'وقت التنبيه قبل بدء الحصة:'}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {LESSON_LEAD_TIME_OPTIONS.map((mins: LessonReminderLeadMinutes) => {
                              const selected =
                                (notifSettings.lessonReminderLeadMinutes || 15) === mins;
                              return (
                                <button
                                  key={mins}
                                  type="button"
                                  onClick={() =>
                                    updateNotifPatch({ lessonReminderLeadMinutes: mins })
                                  }
                                  className={`chip text-xs ${selected ? 'chip-active' : ''}`}
                                >
                                  {isEn ? `${mins} min` : `${mins} دقيقة`}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-line/50">
                          <span className="text-xs font-semibold text-navy">
                            {isEn ? 'Group Session Reminders' : 'تذكيرات حصص المجموعات'}
                          </span>
                          <Toggle
                            checked={notifSettings.enableGroupLessonReminders !== false}
                            onChange={(val) =>
                              updateNotifPatch({ enableGroupLessonReminders: val })
                            }
                            ariaLabel="Group Reminders"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-navy">
                            {isEn ? 'Private Lesson Reminders' : 'تذكيرات الدروس الخاصة'}
                          </span>
                          <Toggle
                            checked={notifSettings.enablePrivateLessonReminders !== false}
                            onChange={(val) =>
                              updateNotifPatch({ enablePrivateLessonReminders: val })
                            }
                            ariaLabel="Private Lesson Reminders"
                          />
                        </div>

                        <div className="pt-1 border-t border-line/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 pe-2">
                              <span className="text-xs font-semibold text-navy block">
                                {isEn ? 'Morning Schedule Summary' : 'ملخص جدول حصص اليوم صباحاً'}
                              </span>
                              <span className="text-[10px] text-slate block">
                                {isEn
                                  ? 'Daily summary on days with scheduled classes'
                                  : 'تذكير صباحي بعدد حصص اليوم المجدولة'}
                              </span>
                            </div>
                            <Toggle
                              checked={Boolean(notifSettings.enableDayOfLessonReminder)}
                              onChange={(val) =>
                                updateNotifPatch({ enableDayOfLessonReminder: val })
                              }
                              ariaLabel="Morning Summary"
                            />
                          </div>

                          {notifSettings.enableDayOfLessonReminder && (
                            <input
                              type="time"
                              value={notifSettings.dayOfLessonReminderTime || '08:00'}
                              onChange={(e) =>
                                updateNotifPatch({ dayOfLessonReminderTime: e.target.value })
                              }
                              className="classy-input w-40"
                            />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Category B: Attendance & Missed Lessons Accordion */}
              <div className="rounded-2xl bg-page/80 border border-line/70 overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedNotifGroup((prev) =>
                      prev === 'attendance' ? null : 'attendance'
                    )
                  }
                  className="w-full p-3 flex items-center justify-between gap-3 text-start cursor-pointer hover:bg-page transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-mint-soft flex items-center justify-center text-navy shrink-0">
                      <AppIcon name="calendarCheck" size={18} weight="duotone" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-navy truncate">
                        {t('notifCatAttendance')}
                      </h4>
                      <p className="text-[11px] text-slate truncate">
                        {isEn
                          ? `Daily sweep (${formatReminderTimeDisplay(notifSettings.dailyAttendanceReminderTime || '22:00', true)}) & absence tracking`
                          : `مراجعة الحضور (${formatReminderTimeDisplay(notifSettings.dailyAttendanceReminderTime || '22:00', false)}) ومتابعة الغياب`}
                      </p>
                    </div>
                  </div>
                  <AppIcon
                    name={expandedNotifGroup === 'attendance' ? 'chevronUp' : 'chevronDown'}
                    size={16}
                    className="text-slate shrink-0"
                  />
                </button>

                {expandedNotifGroup === 'attendance' && (
                  <div className="p-3 pt-2 border-t border-line/60 space-y-3 bg-page">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 pe-2">
                        <span className="text-xs font-semibold text-navy block">
                          {isEn ? 'Pending Attendance Alerts' : 'تنبيهات الحصص غير المرصودة'}
                        </span>
                        <span className="text-[10px] text-slate block">
                          {isEn
                            ? 'Highlight today’s classes awaiting attendance'
                            : 'إظهار الحصص التي لم يُسجل حضورها بعد'}
                        </span>
                      </div>
                      <Toggle
                        checked={notifSettings.enableAttendanceReminders !== false}
                        onChange={(val) => updateNotifPatch({ enableAttendanceReminders: val })}
                        ariaLabel="Attendance Alerts"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-line/50">
                      <div className="min-w-0 pe-2">
                        <span className="text-xs font-semibold text-navy block">
                          {isEn ? 'Post-Lesson Completion Reminder' : 'تذكير استكمال الحضور بعد الحصة'}
                        </span>
                        <span className="text-[10px] text-slate block">
                          {isEn
                            ? `${notifSettings.postLessonReminderDelayMinutes || 30} min after lesson ends`
                            : `بعد انتهاء موعد الحصة بـ ${notifSettings.postLessonReminderDelayMinutes || 30} دقيقة`}
                        </span>
                      </div>
                      <Toggle
                        checked={notifSettings.enablePostLessonCompletionReminder !== false}
                        onChange={(val) =>
                          updateNotifPatch({ enablePostLessonCompletionReminder: val })
                        }
                        ariaLabel="Post-Lesson Reminder"
                      />
                    </div>

                    <div className="pt-1 border-t border-line/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 pe-2">
                          <span className="text-xs font-semibold text-navy block">
                            {isEn ? 'Daily End-of-Day Sweep' : 'تذكير الحضور اليومي المسائي'}
                          </span>
                          <span className="text-[10px] text-slate block">
                            {isEn
                              ? 'Alerts only if unrecorded lessons remain today'
                              : 'ينبهك فقط عند وجود حصص لم يُسجل حضورها اليوم'}
                          </span>
                        </div>
                        <Toggle
                          checked={notifSettings.enableDailyAttendanceReminder !== false}
                          onChange={(val) =>
                            updateNotifPatch({ enableDailyAttendanceReminder: val })
                          }
                          ariaLabel="Daily Attendance Sweep"
                        />
                      </div>

                      {notifSettings.enableDailyAttendanceReminder !== false && (
                        <input
                          type="time"
                          value={notifSettings.dailyAttendanceReminderTime || '22:00'}
                          onChange={(e) =>
                            updateNotifPatch({ dailyAttendanceReminderTime: e.target.value })
                          }
                          className="classy-input w-40"
                        />
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-line/50">
                      <div className="min-w-0 pe-2">
                        <span className="text-xs font-semibold text-navy block">
                          {isEn ? 'Student & Consecutive Absence Alerts' : 'تنبيهات غياب الطلاب والغياب المتكرر'}
                        </span>
                        <span className="text-[10px] text-slate block">
                          {isEn
                            ? 'Distinguishes excused/uncharged vs charged absences'
                            : 'يميز بدقة بين الغياب المعفي والغياب المحسوب'}
                        </span>
                      </div>
                      <Toggle
                        checked={notifSettings.enableStudentAbsenceAlerts !== false}
                        onChange={(val) => updateNotifPatch({ enableStudentAbsenceAlerts: val })}
                        ariaLabel="Absence Alerts"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Category C: Student Financial Alerts Accordion */}
              <div className="rounded-2xl bg-page/80 border border-line/70 overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedNotifGroup((prev) =>
                      prev === 'financial' ? null : 'financial'
                    )
                  }
                  className="w-full p-3 flex items-center justify-between gap-3 text-start cursor-pointer hover:bg-page transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-mint-soft flex items-center justify-center text-navy shrink-0">
                      <AppIcon name="wallet" size={18} weight="duotone" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-navy truncate">
                        {t('notifCatFinancial')}
                      </h4>
                      <p className="text-[11px] text-slate truncate">
                        {isEn
                          ? 'Overdue balances, today’s lesson dues & thresholds'
                          : 'المتأخرات، مديونيات حصص اليوم، وحد الرصيد'}
                      </p>
                    </div>
                  </div>
                  <AppIcon
                    name={expandedNotifGroup === 'financial' ? 'chevronUp' : 'chevronDown'}
                    size={16}
                    className="text-slate shrink-0"
                  />
                </button>

                {expandedNotifGroup === 'financial' && (
                  <div className="p-3 pt-2 border-t border-line/60 space-y-3 bg-page">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-navy">
                        {isEn ? 'Overdue Tuition Alerts' : 'تنبيهات المستحقات المتأخرة'}
                      </span>
                      <Toggle
                        checked={notifSettings.enableOverdueReminders !== false}
                        onChange={(val) => updateNotifPatch({ enableOverdueReminders: val })}
                        ariaLabel="Overdue Alerts"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-line/50">
                      <div className="min-w-0 pe-2">
                        <span className="text-xs font-semibold text-navy block">
                          {isEn ? 'Today’s Lesson Student Debt' : 'تنبيهات مديونية طلاب حصص اليوم'}
                        </span>
                        <span className="text-[10px] text-slate block">
                          {isEn
                            ? 'Alert when a student scheduled today has unpaid dues'
                            : 'تنبيه عندما يكون لطالب مجدول اليوم رصيد متبقٍ'}
                        </span>
                      </div>
                      <Toggle
                        checked={notifSettings.enableTodayLessonDebtAlerts !== false}
                        onChange={(val) => updateNotifPatch({ enableTodayLessonDebtAlerts: val })}
                        ariaLabel="Today Debt Alerts"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-line/50">
                      <span className="text-xs font-semibold text-navy">
                        {isEn ? 'Payment Recorded Confirmation' : 'إشعار تأكيد عند تسجيل دفعة'}
                      </span>
                      <Toggle
                        checked={Boolean(notifSettings.enablePaymentRecordedAlerts)}
                        onChange={(val) => updateNotifPatch({ enablePaymentRecordedAlerts: val })}
                        ariaLabel="Payment Confirmation"
                      />
                    </div>

                    <div className="pt-1 border-t border-line/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-navy">
                          {isEn ? 'High Balance Threshold Alert' : 'تنبيه تجاوز حد المديونية'}
                        </span>
                        <Toggle
                          checked={Boolean(notifSettings.enableBalanceThresholdAlert)}
                          onChange={(val) =>
                            updateNotifPatch({ enableBalanceThresholdAlert: val })
                          }
                          ariaLabel="Balance Threshold"
                        />
                      </div>

                      {notifSettings.enableBalanceThresholdAlert && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={50}
                            step={50}
                            value={notifSettings.balanceThresholdAmount || 500}
                            onChange={(e) =>
                              updateNotifPatch({
                                balanceThresholdAmount: Math.max(
                                  50,
                                  Number(e.target.value) || 500
                                ),
                              })
                            }
                            className="classy-input w-32"
                          />
                          <span className="text-xs text-slate font-bold">{t('currency')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Category D: Packages & Subscriptions Accordion */}
              <div className="rounded-2xl bg-page/80 border border-line/70 overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedNotifGroup((prev) =>
                      prev === 'packages' ? null : 'packages'
                    )
                  }
                  className="w-full p-3 flex items-center justify-between gap-3 text-start cursor-pointer hover:bg-page transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-mint-soft flex items-center justify-center text-navy shrink-0">
                      <AppIcon name="receipt" size={18} weight="duotone" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-navy truncate">
                        {t('notifCatPackages')}
                      </h4>
                      <p className="text-[11px] text-slate truncate">
                        {isEn
                          ? 'Package cycle completion, 1-session-left & prepaid credits'
                          : 'اكتمال الباقة، تبقي حصة أخيرة، ونفاد الرصيد المسبق'}
                      </p>
                    </div>
                  </div>
                  <AppIcon
                    name={expandedNotifGroup === 'packages' ? 'chevronUp' : 'chevronDown'}
                    size={16}
                    className="text-slate shrink-0"
                  />
                </button>

                {expandedNotifGroup === 'packages' && (
                  <div className="p-3 pt-2 border-t border-line/60 space-y-3 bg-page">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-navy">
                        {isEn ? 'Package Completed / Renewal Due' : 'اكتمال الباقة واستحقاق التجديد'}
                      </span>
                      <Toggle
                        checked={notifSettings.enablePackageCompletedAlerts !== false}
                        onChange={(val) => updateNotifPatch({ enablePackageCompletedAlerts: val })}
                        ariaLabel="Package Completed"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-line/50">
                      <span className="text-xs font-semibold text-navy">
                        {isEn ? 'Final 1 Session Remaining Alert' : 'تنبيه تبقي حصة واحدة أخيرة'}
                      </span>
                      <Toggle
                        checked={notifSettings.enableOneSessionRemainingAlert !== false}
                        onChange={(val) =>
                          updateNotifPatch({ enableOneSessionRemainingAlert: val })
                        }
                        ariaLabel="One Session Remaining"
                      />
                    </div>

                    <div className="pt-1 border-t border-line/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-navy">
                          {isEn ? 'Early Package Warning' : 'التنبيه المبكر قبل انتهاء الباقة'}
                        </span>
                        <Toggle
                          checked={notifSettings.enableEarlyPackageWarning !== false}
                          onChange={(val) => updateNotifPatch({ enableEarlyPackageWarning: val })}
                          ariaLabel="Early Package Warning"
                        />
                      </div>

                      {notifSettings.enableEarlyPackageWarning !== false && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[1, 2, 3, 4].map((cnt) => {
                            const active =
                              (notifSettings.earlyWarningLessonThreshold || 2) === cnt;
                            return (
                              <button
                                key={cnt}
                                type="button"
                                onClick={() =>
                                  updateNotifPatch({ earlyWarningLessonThreshold: cnt })
                                }
                                className={`chip text-xs ${active ? 'chip-active' : ''}`}
                              >
                                {isEn
                                  ? `≤ ${cnt} ${cnt === 1 ? 'lesson' : 'lessons'}`
                                  : `≤ ${cnt} ${cnt === 1 ? 'حصة' : 'حصص'}`}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-line/50">
                      <span className="text-xs font-semibold text-navy">
                        {isEn ? 'Prepaid Credit Exhausted' : 'نفاد رصيد الحصص المسبقة الدفع'}
                      </span>
                      <Toggle
                        checked={notifSettings.enablePrepaidCreditExhaustedAlerts !== false}
                        onChange={(val) =>
                          updateNotifPatch({ enablePrepaidCreditExhaustedAlerts: val })
                        }
                        ariaLabel="Prepaid Exhausted"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Categories E, F, G: Follow-ups, Sync & System Accordion */}
              <div className="rounded-2xl bg-page/80 border border-line/70 overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedNotifGroup((prev) =>
                      prev === 'system_sync' ? null : 'system_sync'
                    )
                  }
                  className="w-full p-3 flex items-center justify-between gap-3 text-start cursor-pointer hover:bg-page transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-mint-soft flex items-center justify-center text-navy shrink-0">
                      <AppIcon name="shieldCheck" size={18} weight="duotone" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-navy truncate">
                        {isEn ? 'Follow-ups, Sync & System' : 'المتابعة والمزامنة والنظام'}
                      </h4>
                      <p className="text-[11px] text-slate truncate">
                        {isEn
                          ? 'Incomplete records, cloud sync status & backup alerts'
                          : 'السجلات غير المكتملة، حالة المزامنة، والنسخ الاحتياطي'}
                      </p>
                    </div>
                  </div>
                  <AppIcon
                    name={expandedNotifGroup === 'system_sync' ? 'chevronUp' : 'chevronDown'}
                    size={16}
                    className="text-slate shrink-0"
                  />
                </button>

                {expandedNotifGroup === 'system_sync' && (
                  <div className="p-3 pt-2 border-t border-line/60 space-y-3 bg-page">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-navy">
                        {isEn ? 'Multi-Session Debt Follow-up (≥3)' : 'متابعة تراكم الحصص غير المسددة (3+)'}
                      </span>
                      <Toggle
                        checked={notifSettings.enableFinancialFollowUpAlerts !== false}
                        onChange={(val) =>
                          updateNotifPatch({ enableFinancialFollowUpAlerts: val })
                        }
                        ariaLabel="Financial Follow-up"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-line/50">
                      <span className="text-xs font-semibold text-navy">
                        {isEn ? 'Incomplete Lesson Records' : 'تنبيهات سجلات الحصص غير المكتملة'}
                      </span>
                      <Toggle
                        checked={notifSettings.enableIncompleteLessonAlerts !== false}
                        onChange={(val) =>
                          updateNotifPatch({ enableIncompleteLessonAlerts: val })
                        }
                        ariaLabel="Incomplete Records"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-line/50">
                      <span className="text-xs font-semibold text-navy">
                        {isEn ? 'Cloud Sync Failure & Recovery' : 'تنبيهات تعذر واستعادة المزامنة السحابية'}
                      </span>
                      <Toggle
                        checked={notifSettings.enableSyncFailureAlerts !== false}
                        onChange={(val) => updateNotifPatch({ enableSyncFailureAlerts: val })}
                        ariaLabel="Sync Failure Alerts"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-line/50">
                      <span className="text-xs font-semibold text-navy">
                        {isEn ? 'Backup / Restore Error Alerts' : 'تنبيهات فشل النسخ أو الاستعادة'}
                      </span>
                      <Toggle
                        checked={notifSettings.enableBackupFailureAlerts !== false}
                        onChange={(val) => updateNotifPatch({ enableBackupFailureAlerts: val })}
                        ariaLabel="Backup Error Alerts"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-line/50">
                      <span className="text-xs font-semibold text-navy">
                        {isEn ? 'Backup Export Completion' : 'إشعار اكتمال تصدير النسخة الاحتياطية'}
                      </span>
                      <Toggle
                        checked={Boolean(notifSettings.enableBackupCompletionAlerts)}
                        onChange={(val) =>
                          updateNotifPatch({ enableBackupCompletionAlerts: val })
                        }
                        ariaLabel="Backup Completion"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-line/50">
                      <span className="text-xs font-semibold text-navy">
                        {isEn ? 'OS Permission Recovery Prompts' : 'تنبيهات استعادة صلاحية إشعارات النظام'}
                      </span>
                      <Toggle
                        checked={notifSettings.enableSystemPermissionAlerts !== false}
                        onChange={(val) => updateNotifPatch({ enableSystemPermissionAlerts: val })}
                        ariaLabel="Permission Prompts"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Retention, Clear History & Restore Defaults */}
          <div className="p-3 rounded-2xl bg-page/75 border border-line/60 space-y-3">
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate block">
                {isEn ? 'Notification History Retention:' : 'مدة الاحتفاظ بسجل الإشعارات:'}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {HISTORY_RETENTION_OPTIONS.map((days: NotificationHistoryRetentionDays) => {
                  const selected = (notifSettings.historyRetentionDays || 30) === days;
                  return (
                    <button
                      key={days}
                      type="button"
                      onClick={() => updateNotifPatch({ historyRetentionDays: days })}
                      className={`chip text-xs ${selected ? 'chip-active' : ''}`}
                    >
                      {days === 365
                        ? (isEn ? '1 Year' : 'سنة')
                        : (isEn ? `${days} Days` : `${days} يوم`)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-line/60">
              {/* Two-step inline Clear History */}
              {!confirmClearNotifHistory ? (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmRestoreNotifDefaults(false);
                    setConfirmClearNotifHistory(true);
                  }}
                  className="btn-soft px-3 py-2 text-xs flex items-center justify-center gap-1.5"
                >
                  <AppIcon name="trash" size={14} />
                  <span>{t('notifClearHistory')}</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleConfirmClearNotifHistory}
                    className="btn-orange px-3 py-2 text-xs font-bold"
                  >
                    {isEn ? 'Confirm Clear' : 'تأكيد المسح'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearNotifHistory(false)}
                    className="btn-soft px-2.5 py-2 text-xs"
                  >
                    {t('cancel')}
                  </button>
                </div>
              )}

              {/* Two-step inline Restore Default Settings */}
              {!confirmRestoreNotifDefaults ? (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmClearNotifHistory(false);
                    setConfirmRestoreNotifDefaults(true);
                  }}
                  className="btn-soft px-3 py-2 text-xs flex items-center justify-center gap-1.5"
                >
                  <AppIcon name="restore" size={14} />
                  <span>{isEn ? 'Restore Defaults' : 'استعادة الافتراضي'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleConfirmRestoreNotifDefaults}
                    className="btn-navy px-3 py-2 text-xs font-bold"
                  >
                    {isEn ? 'Confirm Reset' : 'تأكيد الاستعادة'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRestoreNotifDefaults(false)}
                    className="btn-soft px-2.5 py-2 text-xs"
                  >
                    {t('cancel')}
                  </button>
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate leading-relaxed pt-1 border-t border-line/40">
              {isEn ? platformCaps.remotePushStatusNoteEn : platformCaps.remotePushStatusNoteAr}
            </p>
          </div>
        </MintCard>
      </section>

      {/* =========================================================================
          GROUP 5: DANGER ZONE (Clear data, Logout) - CORAL TEXT ONLY
          ========================================================================= */}
      <section className="space-y-2">
        <h2 className="t-caption text-slate uppercase tracking-wider px-1">
          {isEn ? 'Account & Danger Zone' : 'الحساب وإدارة النظام'}
        </h2>
        <MintCard className="bg-mint-soft p-4 sm:p-5 space-y-3">
          {/* Logout row if signed in */}
          {currentUser && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-page/70 border border-line/60 hover:bg-page transition-colors cursor-pointer text-start"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-page flex items-center justify-center text-coral shrink-0 shadow-xs">
                  <AppIcon name="logout" size={20} weight="bold" />
                </div>
                <div className="min-w-0">
                  <h4 className="t-card font-bold text-coral">
                    {t('logout')}
                  </h4>
                  <p className="t-meta text-slate text-xs mt-0.5 truncate">
                    {currentUser.email}
                  </p>
                </div>
              </div>
              <AppIcon name="chevronEnd" size={18} className="text-coral shrink-0" />
            </button>
          )}

          {/* Clear Data row */}
          <button
            type="button"
            onClick={handleResetData}
            className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-page/70 border border-line/60 hover:bg-page transition-colors cursor-pointer text-start"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-page flex items-center justify-center text-coral shrink-0 shadow-xs">
                <AppIcon name="trash" size={20} weight="bold" />
              </div>
              <div className="min-w-0">
                <h4 className="t-card font-bold text-coral">
                  {isEn ? 'Clear All Local Data' : 'مسح جميع البيانات المحلية'}
                </h4>
                <p className="t-meta text-slate text-xs mt-0.5 truncate">
                  {isEn ? 'Permanently wipe records on this device' : 'حذف السجلات المحفوظة على هذا الجهاز'}
                </p>
              </div>
            </div>
            <AppIcon name="chevronEnd" size={18} className="text-coral shrink-0" />
          </button>
        </MintCard>
      </section>

      {/* Floating Toast above navigation */}
      <Toast
        isOpen={Boolean(toast)}
        message={toast?.message || ''}
        type={toast?.type || 'success'}
        onClose={() => setToast(null)}
      />
    </div>
  );
};

export default SettingsView;
