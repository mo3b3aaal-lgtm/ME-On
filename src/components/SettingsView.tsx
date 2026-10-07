import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  User,
  BookOpen,
  Phone,
  Building,
  Save,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  ShieldCheck,
  KeyRound,
  Mail,
  RefreshCw,
  CloudCheck,
  Database,
  ArrowDownCircle,
  HardDriveDownload,
  Clock,
  Check,
  Calendar,
  Wifi,
  WifiOff,
  Activity,
  Zap,
  Globe,
  Languages,
  Bell,
  Sliders,
  Sparkles,
  ChevronRight,
  Shield,
  Layers,
  FileJson,
  Laptop,
  Volume2,
} from 'lucide-react';
import { TeacherProfile, UserAccount, AutoSyncFrequency, AutoSyncConfig, NotificationSettings } from '../types';
import {
  db,
  formatSyncTimeArabic,
  formatNextSyncTimeArabic,
  formatSyncStatusArabic,
} from '../utils/storage';
import {
  subscribeToNetworkStatus,
  getCachedNetworkStatus,
  DetailedNetworkStatus,
} from '../utils/network';
import { useTranslation, Language } from '../utils/i18n';
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
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  teacherProfile,
  currentUser,
  onProfileUpdated,
  onDataReset,
  onLogout,
}) => {
  const { language, setLanguage, isRTL, t } = useTranslation();
  const isEn = language.startsWith('en');

  // Profile Form state
  const [name, setName] = useState(teacherProfile.name);
  const [subject, setSubject] = useState(teacherProfile.subject);
  const [phone, setPhone] = useState(teacherProfile.phone || '');
  const [centerOrSchool, setCenterOrSchool] = useState(teacherProfile.centerOrSchool || '');
  const [currency, setCurrency] = useState(teacherProfile.currency || 'ج.م');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync state & feedback
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => db.getLastSyncTime(currentUser?.id));
  const [autoSyncConfig, setAutoSyncConfig] = useState<AutoSyncConfig>(() => db.getAutoSyncConfig(currentUser?.id));
  const [networkStatus, setNetworkStatus] = useState<DetailedNetworkStatus>(() => getCachedNetworkStatus());
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() => db.getNotificationSettings(currentUser?.id));
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Password change in settings
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMessage, setPassMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Active section tab for mobile quick filtering
  const [activeSection, setActiveSection] = useState<'all' | 'account' | 'sync' | 'notif' | 'language'>('all');

  // Update sync time display periodically and subscribe to background sync & network updates
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
    setSyncFeedback({
      type: 'success',
      message:
        newFreq === 'off'
          ? (isEn ? 'Automatic scheduled sync disabled.' : 'تم إيقاف المزامنة التلقائية المجدولة.')
          : (isEn ? `Auto sync schedule (${labels[newFreq]}) enabled and saved.` : `تم تفعيل جدول المزامنة التلقائية (${labels[newFreq]}) وحفظ الإعداد بنجاح.`),
    });
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  // Handle Sync Now
  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await db.performFullSync(currentUser?.id, true);
      setLastSyncTime(db.getLastSyncTime(currentUser?.id));
      setAutoSyncConfig(db.getAutoSyncConfig(currentUser?.id));
      setSyncFeedback({
        type: res.isOffline ? 'info' : 'success',
        message: res.message,
      });
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: isEn ? 'Sync failed, but all data is secured locally on this device.' : 'فشلت المزامنة، ولكن تم حفظ وتأمين جميع البيانات محلياً على هذا الجهاز.',
      });
      setTimeout(() => setSyncFeedback(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Backup Now (.json export)
  const handleBackupNow = () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const syncPkg = db.syncAccountData(currentUser?.id);
      setLastSyncTime(syncPkg.lastSyncTime);

      // Download file to disk
      const backupJson = JSON.stringify(syncPkg, null, 2);
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const userName = (currentUser?.name || teacherProfile.name || 'teacher').replace(/\s+/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `Classy_Backup_${userName}_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setSyncFeedback({
        type: 'success',
        message: isEn
          ? `Backup exported successfully (${syncPkg.stats?.totalStudents || 0} students, ${syncPkg.stats?.totalGroups || 0} groups, ${syncPkg.stats?.totalSessions || 0} sessions).`
          : `تم تصدير النسخة الاحتياطية بنجاح (${syncPkg.stats?.totalStudents || 0} طالب، ${syncPkg.stats?.totalGroups || 0} مجموعة، ${syncPkg.stats?.totalSessions || 0} حصة).`,
      });
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err) {
      setSyncFeedback({ type: 'error', message: isEn ? 'Error occurred during backup.' : 'حدث خطأ أثناء إجراء النسخ الاحتياطي.' });
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
    setSyncFeedback(null);
    try {
      const res = db.restoreAccountData(currentUser.id);
      if (res.success) {
        setLastSyncTime(db.getLastSyncTime(currentUser.id));
        setSyncFeedback({
          type: 'success',
          message: isEn
            ? `${res.message} (${res.count?.students || 0} students, ${res.count?.groups || 0} groups, ${res.count?.sessions || 0} sessions)`
            : `${res.message} (${res.count?.students || 0} طالب، ${res.count?.groups || 0} مجموعة، ${res.count?.sessions || 0} حصة)`,
        });
        onDataReset();
        setTimeout(() => setSyncFeedback(null), 5000);
      } else {
        setSyncFeedback({ type: 'error', message: res.message });
      }
    } catch (err) {
      setSyncFeedback({ type: 'error', message: isEn ? 'Data restore failed.' : 'فشلت عملية استعادة البيانات.' });
    } finally {
      setIsSyncing(false);
    }
  };

  // Import JSON backup file
  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const res = db.importAccountBackup(content, currentUser?.id);
        if (res.success) {
          setLastSyncTime(new Date().toISOString());
          setSyncFeedback({
            type: 'success',
            message: isEn
              ? `File restored successfully! Loaded ${res.count?.students || 0} students, ${res.count?.groups || 0} groups, ${res.count?.sessions || 0} sessions.`
              : `تمت استعادة الملف بنجاح! تم تحميل ${res.count?.students || 0} طالب، ${res.count?.groups || 0} مجموعة، ${res.count?.sessions || 0} حصة.`,
          });
          onDataReset();
          setTimeout(() => setSyncFeedback(null), 5000);
        } else {
          setSyncFeedback({ type: 'error', message: res.message });
        }
      } catch (err) {
        setSyncFeedback({ type: 'error', message: isEn ? 'Invalid or corrupted backup file.' : 'الملف غير صالح أو تالف.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Handle profile save
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: TeacherProfile = {
      ...teacherProfile,
      name,
      subject,
      phone,
      centerOrSchool,
      currency,
    };
    db.saveTeacherProfile(updated);
    onProfileUpdated(updated);
    setSavedSuccess(true);
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
      alert(isEn ? 'Test notification sent! Check your notification tray.' : 'تم إرسال التنبيه التجريبي! تحقق من لوحة إشعارات الهاتف.');
    } else {
      alert(isEn ? 'Could not send test notification. Please enable notification permissions in system settings.' : 'تعذر إرسال التنبيه. يرجى تفعيل إذن الإشعارات من إعدادات الهاتف.');
    }
  };

  // Test Sound Trigger (Plays dummy notification with the selected custom alert sound)
  const handleTestSound = async () => {
    const activeSoundUri = notifSettings.notificationSoundUri || 'beep.wav';
    const selectedOption = AVAILABLE_NOTIFICATION_SOUNDS.find((s) => s.uri === activeSoundUri);
    const soundDisplayName = selectedOption ? (isEn ? selectedOption.nameEn : selectedOption.nameAr) : activeSoundUri;

    const success = await sendTestAttendanceReminderNotification(isEn, activeSoundUri);
    if (success) {
      alert(
        isEn
          ? `Playing dummy reminder with alert sound: "${soundDisplayName}". Check your phone's notification banner!`
          : `تم تشغيل إشعار تذكير تجريبي بنغمة: "${soundDisplayName}". تحقق من إشعار الهاتف!`
      );
    } else {
      alert(
        isEn
          ? 'Could not trigger sound test. Please ensure notification permissions are granted in device settings.'
          : 'تعذر تشغيل اختبار الصوت. يرجى التأكد من منح إذن الإشعارات في إعدادات الهاتف.'
      );
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
      alert(isEn ? 'All data cleared successfully.' : 'تم مسح البيانات بنجاح.');
    }
  };

  const syncStatus = formatSyncStatusArabic(
    autoSyncConfig.lastSyncStatus,
    networkStatus.isOnline,
    networkStatus.statusReason
  );

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar p-3.5 sm:p-5 space-y-4 text-[#16324F] pb-32 bg-[#FFFFFF] relative"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Ambient glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#0A3D62]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-0 w-80 h-80 bg-[#0A3D62]/8 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* =========================================================================
          1. SETTINGS HERO HEADER
          ========================================================================= */}
      <div className="rounded-[24px] bg-gradient-to-r from-[#0A3D62] via-[#16324F] to-[#6F7882] p-5 sm:p-6 text-[#FFFFFF] relative overflow-hidden shadow-xl border border-[#C7CDD3]/15">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#0A3D62] via-[#16324F] to-[#0A3D62] p-0.5 shadow-lg shadow-[#0A3D62]/35 shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#0A3D62] flex items-center justify-center text-[#FFFFFF]">
                <SettingsIcon className="w-6 h-6 text-[#FFFFFF]" />
              </div>
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#C7CDD3]/90 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#C7CDD3]" />
                  <span>{isEn ? 'Classy Control Center' : 'إعدادات الحساب والنظام'}</span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#FFFFFF] tracking-tight flex items-center gap-2.5 truncate">
                <span>{t('settingsTitle')}</span>
              </h1>
              <p className="text-xs sm:text-sm text-[#C7CDD3]/85 font-medium truncate">
                {currentUser?.email || teacherProfile.name || (isEn ? 'Teacher Profile & Settings' : 'الملف الشخصي وإعدادات الحساب')}
              </p>
            </div>
          </div>

          {currentUser && (
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 rounded-2xl bg-[#FFFFFF]/10 hover:bg-[#FFFFFF]/20 text-[#FFFFFF] font-bold text-xs flex items-center gap-2 border border-[#C7CDD3]/25 transition-all cursor-pointer self-end sm:self-auto"
            >
              <LogOut className="w-4 h-4 text-[#FFFFFF]" />
              <span>{t('logout')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Feedback Toast */}
      {syncFeedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 ${
            syncFeedback.type === 'success'
              ? 'bg-[#0A3D62] text-[#FFFFFF] shadow-[#0A3D62]/20'
              : syncFeedback.type === 'error'
              ? 'bg-[#16324F] text-[#FFFFFF] shadow-[#16324F]/20'
              : 'bg-[#0A3D62] text-[#FFFFFF] shadow-[#0A3D62]/20'
          }`}
        >
          <div className="flex items-center gap-2">
            {syncFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <span>{syncFeedback.message}</span>
          </div>
          <button onClick={() => setSyncFeedback(null)}>
            <Check className="w-4 h-4 opacity-80 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* =========================================================================
          2. LANGUAGE SWITCHER
          ========================================================================= */}
      <div className="classy-card p-4 sm:p-5 bg-[#FFFFFF] space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#C7CDD3]/25 flex items-center justify-center text-[#0A3D62]">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#16324F]">{t('languageSettings')}</h3>
            <p className="text-[11px] text-[#6F7882] font-medium">{t('selectLanguage')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => setLanguage('ar')}
            className={`p-3 rounded-2xl border flex items-center justify-between font-bold text-xs transition-all cursor-pointer ${
              language === 'ar'
                ? 'bg-gradient-to-r from-[#0A3D62] to-[#16324F] text-[#FFFFFF] border-[#0A3D62] shadow-sm'
                : 'bg-[#C7CDD3]/15 text-[#16324F] border-[#C7CDD3] hover:bg-[#C7CDD3]/35'
            }`}
          >
            <span>العربية (Egyptian Arabic)</span>
            {language === 'ar' && <Check className="w-4 h-4 text-[#0A3D62]" />}
          </button>

          <button
            type="button"
            onClick={() => setLanguage('en-GB')}
            className={`p-3 rounded-2xl border flex items-center justify-between font-bold text-xs transition-all cursor-pointer ${
              language === 'en-GB'
                ? 'bg-gradient-to-r from-[#0A3D62] to-[#16324F] text-[#FFFFFF] border-[#0A3D62] shadow-sm'
                : 'bg-[#C7CDD3]/15 text-[#16324F] border-[#C7CDD3] hover:bg-[#C7CDD3]/35'
            }`}
          >
            <span>English (UK)</span>
            {language === 'en-GB' && <Check className="w-4 h-4 text-[#0A3D62]" />}
          </button>

          <button
            type="button"
            onClick={() => setLanguage('en-US')}
            className={`p-3 rounded-2xl border flex items-center justify-between font-bold text-xs transition-all cursor-pointer ${
              language === 'en-US'
                ? 'bg-gradient-to-r from-[#0A3D62] to-[#16324F] text-[#FFFFFF] border-[#0A3D62] shadow-sm'
                : 'bg-[#C7CDD3]/15 text-[#16324F] border-[#C7CDD3] hover:bg-[#C7CDD3]/35'
            }`}
          >
            <span>English (US)</span>
            {language === 'en-US' && <Check className="w-4 h-4 text-[#0A3D62]" />}
          </button>
        </div>
      </div>

      {/* =========================================================================
          3. TEACHER PROFILE FORM
          ========================================================================= */}
      <div className="classy-card p-4 sm:p-5 bg-[#FFFFFF] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#C7CDD3]/25 flex items-center justify-center text-[#0A3D62]">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#16324F]">{isEn ? 'Teacher Profile & Branding' : 'بيانات المعلم والسنتر'}</h3>
              <p className="text-[11px] text-[#6F7882] font-medium">{isEn ? 'Displayed on reports and printouts' : 'تظهر في الكشوفات والمطبوعات'}</p>
            </div>
          </div>
          {savedSuccess && (
            <span className="text-xs text-[#0A3D62] font-bold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('saveSuccess')}</span>
            </span>
          )}
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#6F7882] block mb-1">{t('teacherName')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-[#C7CDD3]/15 border border-[#C7CDD3] font-bold text-xs text-[#16324F] focus:outline-none focus:border-[#0A3D62]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#6F7882] block mb-1">{t('subject')}</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-[#C7CDD3]/15 border border-[#C7CDD3] font-bold text-xs text-[#16324F] focus:outline-none focus:border-[#0A3D62]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#6F7882] block mb-1">{t('phone')}</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-[#C7CDD3]/15 border border-[#C7CDD3] font-bold text-xs text-[#16324F] focus:outline-none focus:border-[#0A3D62]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#6F7882] block mb-1">{isEn ? 'Center or School' : 'السنتر / المؤسسة التعليمية'}</label>
              <input
                type="text"
                value={centerOrSchool}
                onChange={(e) => setCenterOrSchool(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-[#C7CDD3]/15 border border-[#C7CDD3] font-bold text-xs text-[#16324F] focus:outline-none focus:border-[#0A3D62]"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-2xl bg-[#0A3D62] hover:bg-[#16324F] text-[#FFFFFF] font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4 text-[#FFFFFF]" />
              <span>{t('save')}</span>
            </button>
          </div>
        </form>
      </div>

      {/* =========================================================================
          4. CLOUD SYNC & BACKUP
          ========================================================================= */}
      <div className="classy-card p-4 sm:p-5 bg-[#FFFFFF] space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#C7CDD3]/65 flex items-center justify-center text-[#0A3D62]">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#16324F]">{isEn ? 'Cloud Sync & Data Security' : 'المزامنة السحابية والنسخ الاحتياطي'}</h3>
              <p className="text-[11px] text-[#6F7882] font-medium">{syncStatus.label}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-[#0A3D62] to-[#16324F] text-[#FFFFFF] font-black text-xs flex items-center gap-2 shadow-md shadow-[#16324F]/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? (isEn ? 'Syncing...' : 'جاري المزامنة...') : (isEn ? 'Sync Now' : 'مزامنة الآن')}</span>
          </button>
        </div>

        {/* Sync Frequency Options */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-bold text-[#6F7882] block">{isEn ? 'Auto Sync Schedule:' : 'جدولة المزامنة التلقائية:'}</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { key: 'off', label: isEn ? 'Off' : 'إيقاف' },
              { key: 'hourly', label: isEn ? 'Hourly' : 'كل ساعة' },
              { key: 'daily', label: isEn ? 'Daily' : 'كل يوم' },
              { key: 'weekly', label: isEn ? 'Weekly' : 'كل أسبوع' },
              { key: 'monthly', label: isEn ? 'Monthly' : 'كل شهر' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleFrequencyChange(item.key as AutoSyncFrequency)}
                className={`py-2 px-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                  autoSyncConfig.frequency === item.key
                    ? 'bg-[#0A3D62] text-[#FFFFFF] border-[#0A3D62] shadow-xs'
                    : 'bg-[#C7CDD3]/15 text-[#6F7882] border-[#C7CDD3] hover:bg-[#C7CDD3]/35'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Export & Import Backup Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#C7CDD3]">
          <button
            type="button"
            onClick={handleBackupNow}
            className="p-3 rounded-2xl bg-[#C7CDD3]/15 hover:bg-[#C7CDD3]/35 border border-[#C7CDD3] text-[#16324F] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#0A3D62]" />
            <span>{isEn ? 'Export Local Backup (.json)' : 'تصدير نسخة احتياطية (.json)'}</span>
          </button>

          <label className="p-3 rounded-2xl bg-[#C7CDD3]/15 hover:bg-[#C7CDD3]/35 border border-[#C7CDD3] text-[#16324F] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer">
            <Upload className="w-4 h-4 text-[#0A3D62]" />
            <span>{isEn ? 'Import Backup (.json)' : 'استعادة نسخة احتياطية (.json)'}</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackupFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* =========================================================================
          5. NOTIFICATIONS & SMART REMINDERS
          ========================================================================= */}
      <div className="classy-card p-4 sm:p-5 bg-[#FFFFFF] space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#C7CDD3]/70 flex items-center justify-center text-[#16324F]">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#16324F]">{isEn ? 'Smart Notifications & Reminders' : 'التنبيهات والتذكيرات الذكية'}</h3>
            <p className="text-[11px] text-[#6F7882] font-medium">{isEn ? 'Configure mobile notifications and proactive class alerts' : 'تفعيل التنبيهات المسبقة ومتابعة الحصص والمستحقات'}</p>
          </div>
        </div>

        {/* Daily Attendance Reminder Card */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#FFFFFF] to-[#C7CDD3]/30 border border-[#C7CDD3] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0A3D62] shrink-0" />
                <span className="font-black text-xs sm:text-sm text-[#16324F]">
                  {isEn ? 'Daily Attendance Reminder' : 'تذكير تسجيل الحضور اليومي'}
                </span>
              </div>
              <p className="text-[11px] text-[#6F7882] font-medium">
                {isEn ? 'Sends a mobile reminder if sessions today are missing attendance' : 'تنبيه يومي على الهاتف في حال وجود حصص لم يتم تسجيل حضورها اليوم'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleDailyAttendanceReminder}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer border shrink-0 ${
                notifSettings.enableDailyAttendanceReminder !== false
                  ? 'bg-gradient-to-r from-[#0A3D62] to-[#0A3D62] text-[#FFFFFF] border-transparent shadow-xs'
                  : 'bg-[#FFFFFF] text-[#6F7882] border-[#C7CDD3] hover:bg-[#C7CDD3]/35'
              }`}
            >
              {notifSettings.enableDailyAttendanceReminder !== false ? (isEn ? 'ON' : 'مفعّل') : (isEn ? 'OFF' : 'معطّل')}
            </button>
          </div>

          {notifSettings.enableDailyAttendanceReminder !== false && (
            <div className="pt-2 border-t border-[#C7CDD3]/80 space-y-2.5 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#16324F]">
                    {isEn ? 'Reminder Time:' : 'وقت التذكير:'}
                  </span>
                  <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-[#FFFFFF] border border-[#C7CDD3] text-[#0A3D62] shadow-2xs">
                    {formatReminderTimeDisplay(notifSettings.dailyAttendanceReminderTime || '22:00', isEn)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={notifSettings.dailyAttendanceReminderTime || '22:00'}
                    onChange={(e) => handleReminderTimeChange(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#C7CDD3] font-bold text-xs text-[#16324F] focus:outline-none focus:border-[#0A3D62] cursor-pointer shadow-2xs"
                    aria-label={isEn ? 'Reminder Time' : 'وقت التذكير'}
                  />
                  <button
                    type="button"
                    onClick={handleSendTestNotification}
                    className="px-2.5 py-1.5 rounded-xl bg-[#FFFFFF] hover:bg-[#C7CDD3]/35 border border-[#C7CDD3] text-[#0A3D62] font-bold text-[11px] transition-colors cursor-pointer shadow-2xs shrink-0"
                    title={isEn ? 'Send test notification now' : 'إرسال تنبيه تجريبي للهاتف'}
                  >
                    {isEn ? 'Test Alert' : 'تجربة التنبيه'}
                  </button>
                </div>
              </div>

              {/* Notification Sound Selection */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-dashed border-[#C7CDD3]">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#16324F]">
                    {isEn ? 'Alert Sound:' : 'نغمة التنبيه:'}
                  </span>
                  <span className="text-[11px] font-bold text-[#6F7882]">
                    {isEn ? '(Android Custom Channel Sound)' : '(قناة تنبيه أندرويد المخصصة)'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={notifSettings.notificationSoundUri || 'beep.wav'}
                    onChange={(e) => handleSoundChange(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#C7CDD3] font-bold text-xs text-[#16324F] focus:outline-none focus:border-[#0A3D62] cursor-pointer shadow-2xs"
                    aria-label={isEn ? 'Alert Sound' : 'نغمة التنبيه'}
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
                    className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#0A3D62] to-[#0A3D62] text-[#FFFFFF] font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 shrink-0"
                    title={isEn ? 'Play dummy notification with this sound' : 'تشغيل إشعار تجريبي بهذه النغمة'}
                  >
                    <Volume2 className="w-3.5 h-3.5 text-[#0A3D62]" />
                    <span>{isEn ? 'Test Sound' : 'تجربة الصوت'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2 pt-1">
          <label className="flex items-center justify-between p-3 rounded-2xl bg-[#C7CDD3]/15 border border-[#C7CDD3] cursor-pointer">
            <span className="font-bold text-xs text-[#16324F]">{isEn ? 'In-App Attendance Alerts' : 'تنبيهات رصد الحضور داخل التطبيق'}</span>
            <input
              type="checkbox"
              checked={notifSettings.enableAttendanceReminders}
              onChange={() => handleToggleNotif('enableAttendanceReminders')}
              className="w-4 h-4 accent-[#0A3D62] rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-2xl bg-[#C7CDD3]/15 border border-[#C7CDD3] cursor-pointer">
            <span className="font-bold text-xs text-[#16324F]">{isEn ? 'Overdue Payment Reminders' : 'تنبيهات المديونيات المتأخرة'}</span>
            <input
              type="checkbox"
              checked={notifSettings.enableOverdueReminders}
              onChange={() => handleToggleNotif('enableOverdueReminders')}
              className="w-4 h-4 accent-[#0A3D62] rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-2xl bg-[#C7CDD3]/15 border border-[#C7CDD3] cursor-pointer">
            <span className="font-bold text-xs text-[#16324F]">{isEn ? 'Student Absence Alerts' : 'تنبيهات غياب الطلاب المتكرر'}</span>
            <input
              type="checkbox"
              checked={notifSettings.enableAbsenceReminders}
              onChange={() => handleToggleNotif('enableAbsenceReminders')}
              className="w-4 h-4 accent-[#0A3D62] rounded cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* =========================================================================
          6. DANGER ZONE: DATA RESET
          ========================================================================= */}
      <div className="classy-card p-4 sm:p-5 bg-[#FFFFFF] border border-[#C7CDD3] space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#C7CDD3]/15 flex items-center justify-center text-[#16324F]">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#16324F]">{isEn ? 'Danger Zone: Data Reset' : 'المنطقة الحساسة: إعادة ضبط البيانات'}</h3>
            <p className="text-[11px] text-[#6F7882] font-medium">{isEn ? 'Permanently delete local records from this device' : 'حذف وإعادة تهيئة جميع البيانات المحلية'}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetData}
          className="w-full py-2.5 rounded-2xl bg-[#C7CDD3]/15 hover:bg-[#C7CDD3]/35 text-[#16324F] font-black text-xs border border-[#C7CDD3] transition-all cursor-pointer active:scale-95"
        >
          {isEn ? 'Erase All Local Data' : 'مسح جميع البيانات والبدء من جديد'}
        </button>
      </div>
    </div>
  );
};
