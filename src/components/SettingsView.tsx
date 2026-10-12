import React, { useState, useEffect } from 'react';
import {
  TeacherProfile,
  UserAccount,
  AutoSyncFrequency,
  AutoSyncConfig,
  NotificationSettings,
  ActiveTab,
} from '../types';
import { AppIcon, type AppIconName } from './ui/AppIcon';
import { MintCard } from './ui/MintCard';
import { SegmentedControl } from './ui/SegmentedControl';
import { Toggle } from './ui/Toggle';
import { Toast, type ToastType } from './ui/Toast';
import { SyncStatusPill } from './ui/SyncStatusPill';
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
import { toLocalISODate } from '../utils/localDate';
import {
  formatReminderTimeDisplay,
  scheduleDailyAttendanceReminder,
  sendTestAttendanceReminderNotification,
  requestNotificationPermission,
  AVAILABLE_NOTIFICATION_SOUNDS,
  updateNotificationSoundPreference,
} from '../utils/localNotifications';

interface SettingsViewProps {
  teacherProfile: TeacherProfile;
  currentUser: UserAccount | null;
  onProfileUpdated: (profile: TeacherProfile) => void;
  onDataReset: () => void;
  onLogout: () => void;
  onNavigateToTab?: (tab: ActiveTab) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  teacherProfile,
  currentUser,
  onProfileUpdated,
  onDataReset,
  onLogout,
  onNavigateToTab,
}) => {
  const { language, setLanguage, isRTL, t } = useTranslation();
  const isEn = language.startsWith('en');

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
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() => db.getNotificationSettings(currentUser?.id));
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Password change in settings
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMessage, setPassMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setLastSyncTime(db.getLastSyncTime(currentUser?.id));
    setAutoSyncConfig(db.getAutoSyncConfig(currentUser?.id));

    const unsubscribeSync = db.subscribeToSyncUpdates(() => {
      setLastSyncTime(db.getLastSyncTime(currentUser?.id));
      setAutoSyncConfig(db.getAutoSyncConfig(currentUser?.id));
    });

    const unsubscribeNet = subscribeToNetworkStatus((status) => {
      setNetworkStatus(status);
    });

    const interval = setInterval(() => {
      setLastSyncTime(db.getLastSyncTime(currentUser?.id));
      setAutoSyncConfig(db.getAutoSyncConfig(currentUser?.id));
    }, 10000);

    return () => {
      unsubscribeSync();
      unsubscribeNet();
      clearInterval(interval);
    };
  }, [currentUser]);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
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

      showToast(
        isEn
          ? 'Backup exported successfully!'
          : 'تم تصدير النسخة الاحتياطية بنجاح!',
        'success'
      );
    } catch (err) {
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
        showToast(res.message, 'error');
      }
    } catch (err) {
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
          showToast(res.message || (isEn ? 'Invalid backup file format.' : 'صيغة ملف النسخ غير صحيحة.'), 'error');
        }
      } catch (err) {
        showToast(isEn ? 'Failed to parse backup JSON file.' : 'فشل قراءة ملف النسخة الاحتياطية.', 'error');
      }
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
    setTimeout(() => setSavedSuccess(false), 3000);
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
      setTimeout(() => {
        setIsChangingPassword(false);
        setPassMessage(null);
      }, 2000);
    } else {
      setPassMessage({ type: 'error', text: res.message });
    }
  };

  // Handle toggle notifications
  const handleToggleNotif = (key: keyof NotificationSettings) => {
    const updated = {
      ...notifSettings,
      [key]: !notifSettings[key],
    };
    setNotifSettings(updated);
    db.saveNotificationSettings(updated, currentUser?.id);
  };

  // Handle Daily Attendance Reminder Toggle
  const handleToggleDailyAttendanceReminder = async () => {
    const nextVal = notifSettings.enableDailyAttendanceReminder === false;
    if (nextVal) {
      await requestNotificationPermission();
    }
    const updated = {
      ...notifSettings,
      enableDailyAttendanceReminder: nextVal,
    };
    setNotifSettings(updated);
    db.saveNotificationSettings(updated, currentUser?.id);
    await scheduleDailyAttendanceReminder({ userId: currentUser?.id, isEn });
  };

  // Handle Daily Attendance Reminder Time Change
  const handleReminderTimeChange = async (newTime: string) => {
    const updated = {
      ...notifSettings,
      dailyAttendanceReminderTime: newTime,
    };
    setNotifSettings(updated);
    db.saveNotificationSettings(updated, currentUser?.id);
    await scheduleDailyAttendanceReminder({ userId: currentUser?.id, isEn });
  };

  // Handle Notification Sound Change
  const handleSoundChange = async (soundUri: string) => {
    const selectedOption = AVAILABLE_NOTIFICATION_SOUNDS.find((s) => s.uri === soundUri);
    const soundName = selectedOption ? (isEn ? selectedOption.nameEn : selectedOption.nameAr) : soundUri;

    const updated = {
      ...notifSettings,
      notificationSoundUri: soundUri,
      notificationSoundName: soundName,
    };
    setNotifSettings(updated);
    await updateNotificationSoundPreference(soundUri, soundName, currentUser?.id, isEn);
  };

  // Test Notification Trigger
  const handleSendTestNotification = async () => {
    const success = await sendTestAttendanceReminderNotification(isEn);
    if (success) {
      showToast(isEn ? 'Test alert sent to notification tray.' : 'تم إرسال التنبيه التجريبي للإشعارات.', 'info');
    } else {
      showToast(isEn ? 'Could not send test notification.' : 'تعذر إرسال التنبيه.', 'error');
    }
  };

  // Test Sound Trigger
  const handleTestSound = async () => {
    const activeSoundUri = notifSettings.notificationSoundUri || 'beep.wav';
    const selectedOption = AVAILABLE_NOTIFICATION_SOUNDS.find((s) => s.uri === activeSoundUri);
    const soundDisplayName = selectedOption ? (isEn ? selectedOption.nameEn : selectedOption.nameAr) : activeSoundUri;

    const success = await sendTestAttendanceReminderNotification(isEn, activeSoundUri);
    if (success) {
      showToast(isEn ? `Playing alert sound: "${soundDisplayName}"` : `تشغيل نغمة: "${soundDisplayName}"`, 'info');
    } else {
      showToast(isEn ? 'Could not trigger sound test.' : 'تعذر اختبار الصوت.', 'error');
    }
  };

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
            onClick={() => (onNavigateToTab ? onNavigateToTab('dashboard') : undefined)}
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
          GROUP 1: APPLICATION LANGUAGE (SegmentedControl)
          ========================================================================= */}
      <section className="space-y-2">
        <h2 className="t-caption text-slate uppercase tracking-wider px-1">
          {isEn ? 'Language' : 'اللغة'}
        </h2>
        <MintCard className="bg-mint-soft p-4 sm:p-5 space-y-3.5">
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
        <MintCard className="bg-mint-soft p-4 sm:p-5 space-y-3.5">
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
                <p className="t-meta text-slate text-xs mt-0.5">
                  {syncStatus.label}
                </p>
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
          GROUP 4: SMART NOTIFICATIONS & REMINDERS
          ========================================================================= */}
      <section className="space-y-2">
        <h2 className="t-caption text-slate uppercase tracking-wider px-1">
          {isEn ? 'Notifications' : 'الإشعارات والتذكيرات'}
        </h2>
        <MintCard className="bg-mint-soft p-4 sm:p-5 space-y-3">
          {/* Row 1: Daily Attendance Reminder */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-page/70 border border-line/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-page flex items-center justify-center text-navy shrink-0 shadow-xs">
                <AppIcon name="clock" size={20} weight="duotone" />
              </div>
              <div className="min-w-0">
                <h4 className="t-card text-navy font-bold leading-tight">
                  {isEn ? 'Daily Attendance Reminder' : 'تذكير الحضور اليومي'}
                </h4>
                <p className="t-meta text-slate text-xs mt-0.5 truncate">
                  {formatReminderTimeDisplay(notifSettings.dailyAttendanceReminderTime || '22:00', isEn)}
                </p>
              </div>
            </div>
            <Toggle
              checked={notifSettings.enableDailyAttendanceReminder !== false}
              onChange={handleToggleDailyAttendanceReminder}
              ariaLabel="Daily Reminder"
            />
          </div>

          {/* Sub-row: Time & Alert Sound */}
          {notifSettings.enableDailyAttendanceReminder !== false && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-2xl bg-page border border-line animate-in fade-in">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate block">
                  {isEn ? 'Reminder Time' : 'وقت التذكير'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={notifSettings.dailyAttendanceReminderTime || '22:00'}
                    onChange={(e) => handleReminderTimeChange(e.target.value)}
                    className="classy-input flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleSendTestNotification}
                    className="btn-soft px-3 text-xs shrink-0 h-10"
                  >
                    {isEn ? 'Test' : 'تجربة'}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate block">
                  {isEn ? 'Alert Sound' : 'نغمة التنبيه'}
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={notifSettings.notificationSoundUri || 'beep.wav'}
                    onChange={(e) => handleSoundChange(e.target.value)}
                    className="classy-select flex-1 min-w-0"
                  >
                    {AVAILABLE_NOTIFICATION_SOUNDS.map((sound) => (
                      <option key={sound.id} value={sound.uri}>
                        {isEn ? sound.nameEn : sound.nameAr}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleTestSound}
                    className="btn-soft px-3 text-xs shrink-0 h-10"
                  >
                    <AppIcon name="speaker" size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Row 2: In-App Attendance Alerts */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-page/70 border border-line/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-page flex items-center justify-center text-navy shrink-0 shadow-xs">
                <AppIcon name="calendarCheck" size={20} weight="duotone" />
              </div>
              <div className="min-w-0">
                <h4 className="t-card text-navy font-bold leading-tight">
                  {isEn ? 'Attendance In-App Alerts' : 'تنبيهات استكمال الحصص'}
                </h4>
                <p className="t-meta text-slate text-xs mt-0.5 truncate">
                  {isEn ? 'Highlight pending sessions in app' : 'تنبيه بالحصص التي لم يُرصد حضورها'}
                </p>
              </div>
            </div>
            <Toggle
              checked={!!notifSettings.enableAttendanceReminders}
              onChange={() => handleToggleNotif('enableAttendanceReminders')}
              ariaLabel="Session Alerts"
            />
          </div>

          {/* Row 3: Overdue Payment Reminders */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-page/70 border border-line/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-page flex items-center justify-center text-navy shrink-0 shadow-xs">
                <AppIcon name="wallet" size={20} weight="duotone" />
              </div>
              <div className="min-w-0">
                <h4 className="t-card text-navy font-bold leading-tight">
                  {isEn ? 'Overdue Payment Alerts' : 'تنبيهات المستحقات المتأخرة'}
                </h4>
                <p className="t-meta text-slate text-xs mt-0.5 truncate">
                  {isEn ? 'Notify for delayed student tuition dues' : 'إشعار بالطلاب المتأخرين في السداد'}
                </p>
              </div>
            </div>
            <Toggle
              checked={!!notifSettings.enableOverdueReminders}
              onChange={() => handleToggleNotif('enableOverdueReminders')}
              ariaLabel="Overdue Dues"
            />
          </div>

          {/* Row 4: Repeated Absence Tracking */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-page/70 border border-line/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-page flex items-center justify-center text-navy shrink-0 shadow-xs">
                <AppIcon name="warning" size={20} weight="duotone" />
              </div>
              <div className="min-w-0">
                <h4 className="t-card text-navy font-bold leading-tight">
                  {isEn ? 'Repeated Absence Tracking' : 'متابعة الغياب المتكرر'}
                </h4>
                <p className="t-meta text-slate text-xs mt-0.5 truncate">
                  {isEn ? 'Track students missing multiple lessons' : 'تنبيه فوري عند تكرار غياب الطالب'}
                </p>
              </div>
            </div>
            <Toggle
              checked={!!notifSettings.enableAbsenceReminders}
              onChange={() => handleToggleNotif('enableAbsenceReminders')}
              ariaLabel="Absence Alerts"
            />
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
