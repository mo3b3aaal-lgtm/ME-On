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
      const dateStr = toLocalISODate();
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
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar p-3.5 sm:p-5 space-y-4 text-[#0F1206] pb-32 bg-[#F2E9DE] relative"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Ambient luxury glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#293828]/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-0 w-80 h-80 bg-[#756046]/12 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* =========================================================================
          1. SETTINGS EXECUTIVE HERO HEADER (WITH METALLIC LUSTRE)
          ========================================================================= */}
      <div className="rounded-[26px] bg-gradient-to-br from-[#293828] via-[#0F1206] to-[#756046] p-5 sm:p-6 text-[#F8F2EC] relative overflow-hidden shadow-xl border border-[#DDD3C7]/35 shadow-[inset_0_1px_0_0_rgba(248, 242, 236,0.32)]">
        {/* Diagonal Metallic Sheen Overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#F8F2EC]/8 to-[#DDD3C7]/15 pointer-events-none" />
        <div className="absolute -top-14 -right-14 w-52 h-52 bg-[#DDD3C7]/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-14 -left-14 w-52 h-52 bg-[#293828]/35 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#DDD3C7] via-[#F8F2EC] to-[#756046] p-0.5 shadow-lg shadow-[#0F1206]/40 shrink-0">
              <div className="w-full h-full rounded-[14px] bg-gradient-to-br from-[#293828] to-[#0F1206] flex items-center justify-center text-[#F8F2EC] shadow-inner">
                <SettingsIcon className="w-6 h-6 text-[#F8F2EC]" />
              </div>
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#DDD3C7] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#F8F2EC]" />
                  <span>{isEn ? 'Classy Executive Control' : 'مركز التحكم والإعدادات الفاخرة'}</span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#F8F2EC] tracking-tight flex items-center gap-2.5 truncate">
                <span>{t('settingsTitle')}</span>
              </h1>
              <p className="text-xs sm:text-sm text-[#DDD3C7]/90 font-medium truncate">
                {currentUser?.email || teacherProfile.name || (isEn ? 'Teacher Profile & System Preferences' : 'الملف الشخصي وتفضيلات النظام والمزامنة')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {activeSection !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveSection('all')}
                className="px-3.5 py-2 rounded-2xl bg-[#F8F2EC] text-[#293828] font-black text-xs flex items-center gap-1.5 border border-[#DDD3C7] shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Layers className="w-3.5 h-3.5 text-[#293828]" />
                <span>{isEn ? 'Show All' : 'عرض الكل'}</span>
              </button>
            )}
            {currentUser && (
              <button
                type="button"
                onClick={onLogout}
                className="px-4 py-2 rounded-2xl bg-[#F8F2EC]/15 hover:bg-[#F8F2EC]/25 text-[#F8F2EC] font-bold text-xs flex items-center gap-2 border border-[#DDD3C7]/35 shadow-[inset_0_1px_0_0_rgba(248, 242, 236,0.25)] transition-all cursor-pointer active:scale-95"
              >
                <LogOut className="w-4 h-4 text-[#F8F2EC]" />
                <span>{t('logout')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sync Feedback Toast */}
      {syncFeedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-md animate-in fade-in slide-in-from-top-2 border border-[#DDD3C7]/35 shadow-[inset_0_1px_0_0_rgba(248, 242, 236,0.28)] ${
            syncFeedback.type === 'success'
              ? 'bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC]'
              : syncFeedback.type === 'error'
              ? 'bg-gradient-to-r from-[#0F1206] to-[#756046] text-[#F8F2EC]'
              : 'bg-gradient-to-r from-[#293828] via-[#0F1206] to-[#756046] text-[#F8F2EC]'
          }`}
        >
          <div className="flex items-center gap-2">
            {syncFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#F8F2EC]" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#DDD3C7]" />
            )}
            <span>{syncFeedback.message}</span>
          </div>
          <button onClick={() => setSyncFeedback(null)}>
            <Check className="w-4 h-4 text-[#F8F2EC] opacity-85 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* =========================================================================
          2. DASHBOARD-STYLE SQUARE BENTO GRID (4 LUXURY SQUARE TILES)
          ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Square Tile 1: Teacher Profile & Security (Sapphire Lustre) */}
        <button
          type="button"
          onClick={() => setActiveSection(activeSection === 'account' ? 'all' : 'account')}
          className={`p-3.5 sm:p-4 rounded-[22px] flex flex-col justify-between min-h-[112px] text-start transition-all cursor-pointer active:scale-[0.98] relative overflow-hidden group ${
            activeSection === 'account'
              ? 'bg-gradient-to-br from-[#293828] via-[#0F1206] to-[#293828] text-[#F8F2EC] border border-[#DDD3C7]/40 shadow-lg shadow-[#293828]/25 shadow-[inset_0_1px_0_0_rgba(248, 242, 236,0.3)]'
              : 'classy-bento-sapphire text-[#0F1206] hover:border-[#293828]'
          }`}
        >
          <div className="absolute -top-8 -left-8 w-24 h-24 bg-[#F8F2EC]/25 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between w-full mb-2 relative z-10">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shadow-md transition-transform group-hover:scale-105 ${
                activeSection === 'account'
                  ? 'bg-[#F8F2EC]/20 text-[#F8F2EC] border border-[#DDD3C7]/30'
                  : 'bg-gradient-to-tr from-[#293828] to-[#0F1206] text-[#F8F2EC] shadow-[#293828]/25'
              }`}
            >
              <User className="w-4.5 h-4.5 text-[#F8F2EC]" />
            </div>
            <span
              className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                activeSection === 'account'
                  ? 'bg-[#F8F2EC] text-[#293828] border-[#F8F2EC]'
                  : 'bg-[#F8F2EC]/80 text-[#293828] border-[#293828]/25 shadow-2xs'
              }`}
            >
              {subject || (isEn ? 'Profile' : 'حسابي')}
            </span>
          </div>
          <div className="w-full min-w-0 relative z-10">
            <span className="text-xs sm:text-sm font-black block truncate">
              {isEn ? 'Teacher & Security' : 'بيانات المعلم والأمان'}
            </span>
            <span
              className={`text-[11px] font-bold block truncate mt-0.5 ${
                activeSection === 'account' ? 'text-[#DDD3C7]' : 'text-[#756046]'
              }`}
            >
              {name || (isEn ? 'Profile & Password' : 'الاسم وكلمة المرور')}
            </span>
          </div>
        </button>

        {/* Square Tile 2: Cloud Sync & Backup (Navy Velvet Sheen) */}
        <button
          type="button"
          onClick={() => setActiveSection(activeSection === 'sync' ? 'all' : 'sync')}
          className={`p-3.5 sm:p-4 rounded-[22px] flex flex-col justify-between min-h-[112px] text-start transition-all cursor-pointer active:scale-[0.98] relative overflow-hidden group ${
            activeSection === 'sync'
              ? 'bg-gradient-to-br from-[#0F1206] via-[#293828] to-[#0F1206] text-[#F8F2EC] border border-[#DDD3C7]/40 shadow-lg shadow-[#0F1206]/25 shadow-[inset_0_1px_0_0_rgba(248, 242, 236,0.3)]'
              : 'classy-bento-navy text-[#0F1206] hover:border-[#0F1206]'
          }`}
        >
          <div className="absolute -top-8 -left-8 w-24 h-24 bg-[#F8F2EC]/25 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between w-full mb-2 relative z-10">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shadow-md transition-transform group-hover:scale-105 ${
                activeSection === 'sync'
                  ? 'bg-[#F8F2EC]/20 text-[#F8F2EC] border border-[#DDD3C7]/30'
                  : 'bg-gradient-to-tr from-[#0F1206] to-[#756046] text-[#F8F2EC] shadow-[#0F1206]/25'
              }`}
            >
              <Database className="w-4.5 h-4.5 text-[#F8F2EC]" />
            </div>
            <span
              className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                activeSection === 'sync'
                  ? 'bg-[#F8F2EC] text-[#0F1206] border-[#F8F2EC]'
                  : 'bg-[#F8F2EC]/80 text-[#0F1206] border-[#0F1206]/25 shadow-2xs'
              }`}
            >
              {networkStatus.isOnline ? (isEn ? 'Synced' : 'متصل') : (isEn ? 'Local' : 'محلي')}
            </span>
          </div>
          <div className="w-full min-w-0 relative z-10">
            <span className="text-xs sm:text-sm font-black block truncate">
              {isEn ? 'Cloud & Backup' : 'المزامنة والنسخ'}
            </span>
            <span
              className={`text-[11px] font-bold block truncate mt-0.5 ${
                activeSection === 'sync' ? 'text-[#DDD3C7]' : 'text-[#756046]'
              }`}
            >
              {isEn ? 'Schedule & JSON Export' : 'جدولة وحفظ احتياطي'}
            </span>
          </div>
        </button>

        {/* Square Tile 3: Smart Notifications (Steel Grey Cashmere Sheen) */}
        <button
          type="button"
          onClick={() => setActiveSection(activeSection === 'notif' ? 'all' : 'notif')}
          className={`p-3.5 sm:p-4 rounded-[22px] flex flex-col justify-between min-h-[112px] text-start transition-all cursor-pointer active:scale-[0.98] relative overflow-hidden group ${
            activeSection === 'notif'
              ? 'bg-gradient-to-br from-[#293828] via-[#756046] to-[#0F1206] text-[#F8F2EC] border border-[#DDD3C7]/40 shadow-lg shadow-[#293828]/25 shadow-[inset_0_1px_0_0_rgba(248, 242, 236,0.3)]'
              : 'classy-bento-steel text-[#0F1206] hover:border-[#756046]'
          }`}
        >
          <div className="absolute -top-8 -left-8 w-24 h-24 bg-[#F8F2EC]/25 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between w-full mb-2 relative z-10">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shadow-md transition-transform group-hover:scale-105 ${
                activeSection === 'notif'
                  ? 'bg-[#F8F2EC]/20 text-[#F8F2EC] border border-[#DDD3C7]/30'
                  : 'bg-gradient-to-tr from-[#756046] to-[#293828] text-[#F8F2EC] shadow-[#756046]/25'
              }`}
            >
              <Bell className="w-4.5 h-4.5 text-[#F8F2EC]" />
            </div>
            <span
              className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                activeSection === 'notif'
                  ? 'bg-[#F8F2EC] text-[#293828] border-[#F8F2EC]'
                  : 'bg-[#F8F2EC]/80 text-[#0F1206] border-[#756046]/35 shadow-2xs'
              }`}
            >
              {notifSettings.enableDailyAttendanceReminder !== false
                ? formatReminderTimeDisplay(notifSettings.dailyAttendanceReminderTime || '22:00', isEn)
                : (isEn ? 'Alerts' : 'تنبيهات')}
            </span>
          </div>
          <div className="w-full min-w-0 relative z-10">
            <span className="text-xs sm:text-sm font-black block truncate">
              {isEn ? 'Smart Reminders' : 'التنبيهات والتذكيرات'}
            </span>
            <span
              className={`text-[11px] font-bold block truncate mt-0.5 ${
                activeSection === 'notif' ? 'text-[#DDD3C7]' : 'text-[#756046]'
              }`}
            >
              {isEn ? 'Daily Alerts & Sounds' : 'تذكير الحضور والنغمات'}
            </span>
          </div>
        </button>

        {/* Square Tile 4: Language & System Control (Silver Pearl Sheen) */}
        <button
          type="button"
          onClick={() => setActiveSection(activeSection === 'language' ? 'all' : 'language')}
          className={`p-3.5 sm:p-4 rounded-[22px] flex flex-col justify-between min-h-[112px] text-start transition-all cursor-pointer active:scale-[0.98] relative overflow-hidden group ${
            activeSection === 'language'
              ? 'bg-gradient-to-br from-[#0F1206] via-[#756046] to-[#293828] text-[#F8F2EC] border border-[#DDD3C7]/40 shadow-lg shadow-[#0F1206]/25 shadow-[inset_0_1px_0_0_rgba(248, 242, 236,0.3)]'
              : 'classy-bento-silver text-[#0F1206] hover:border-[#293828]'
          }`}
        >
          <div className="absolute -top-8 -left-8 w-24 h-24 bg-[#F8F2EC]/35 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between w-full mb-2 relative z-10">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shadow-md transition-transform group-hover:scale-105 ${
                activeSection === 'language'
                  ? 'bg-[#F8F2EC]/20 text-[#F8F2EC] border border-[#DDD3C7]/30'
                  : 'bg-gradient-to-tr from-[#293828] via-[#0F1206] to-[#756046] text-[#F8F2EC] shadow-[#293828]/25'
              }`}
            >
              <Globe className="w-4.5 h-4.5 text-[#F8F2EC]" />
            </div>
            <span
              className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                activeSection === 'language'
                  ? 'bg-[#F8F2EC] text-[#0F1206] border-[#F8F2EC]'
                  : 'bg-[#F8F2EC]/85 text-[#293828] border-[#293828]/25 shadow-2xs'
              }`}
            >
              {language === 'ar' ? 'العربية' : language === 'en-GB' ? 'EN-UK' : 'EN-US'}
            </span>
          </div>
          <div className="w-full min-w-0 relative z-10">
            <span className="text-xs sm:text-sm font-black block truncate">
              {isEn ? 'Language & System' : 'اللغة وإدارة النظام'}
            </span>
            <span
              className={`text-[11px] font-bold block truncate mt-0.5 ${
                activeSection === 'language' ? 'text-[#DDD3C7]' : 'text-[#756046]'
              }`}
            >
              {isEn ? 'Interface & Data Reset' : 'واجهة التطبيق والبيانات'}
            </span>
          </div>
        </button>
      </div>

      {/* =========================================================================
          3. LANGUAGE SWITCHER (SQUARE CARDS GRID)
          ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'language') && (
        <div className="classy-card p-4 sm:p-5 space-y-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#293828] to-[#0F1206] flex items-center justify-center text-[#F8F2EC] shadow-sm shadow-[#293828]/20">
                <Globe className="w-4.5 h-4.5 text-[#F8F2EC]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#0F1206]">{t('languageSettings')}</h3>
                <p className="text-[11px] text-[#756046] font-medium">{t('selectLanguage')}</p>
              </div>
            </div>
            <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#DDD3C7]/30 text-[#0F1206] border border-[#DDD3C7]">
              3 {isEn ? 'Languages' : 'لغات'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {[
              { code: 'ar' as Language, badge: 'AR', title: 'العربية', sub: 'واجهة عربية كاملة' },
              { code: 'en-GB' as Language, badge: 'UK', title: 'English (UK)', sub: 'British Standard' },
              { code: 'en-US' as Language, badge: 'US', title: 'English (US)', sub: 'American Standard' },
            ].map((langItem) => {
              const isSelected = language === langItem.code;
              return (
                <button
                  key={langItem.code}
                  type="button"
                  onClick={() => setLanguage(langItem.code)}
                  className={`p-3 sm:p-3.5 rounded-[20px] border flex flex-col justify-between min-h-[92px] text-start transition-all cursor-pointer active:scale-[0.98] relative overflow-hidden ${
                    isSelected
                      ? 'bg-gradient-to-br from-[#293828] via-[#0F1206] to-[#756046] text-[#F8F2EC] border-[#293828] shadow-md shadow-[#293828]/25 shadow-[inset_0_1px_0_0_rgba(248, 242, 236,0.3)]'
                      : 'classy-bento-silver text-[#0F1206] hover:border-[#293828]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                        isSelected
                          ? 'bg-[#F8F2EC]/20 text-[#F8F2EC] border-[#DDD3C7]/35'
                          : 'bg-[#F8F2EC] text-[#293828] border-[#DDD3C7]'
                      }`}
                    >
                      {langItem.badge}
                    </span>
                    {isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-[#293828] border border-[#F8F2EC]/60 flex items-center justify-center shadow-xs">
                        <Check className="w-3 h-3 text-[#F8F2EC] stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-[#F8F2EC]/80 border border-[#DDD3C7]" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-black block truncate">{langItem.title}</span>
                    <span className={`text-[10px] font-bold block truncate mt-0.5 ${isSelected ? 'text-[#DDD3C7]' : 'text-[#756046]'}`}>
                      {langItem.sub}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          4. TEACHER PROFILE & ACCOUNT SECURITY (2x2 SQUARE BENTO FORM + PASSWORD)
          ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'account') && (
        <div className="classy-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#293828] to-[#0F1206] flex items-center justify-center text-[#F8F2EC] shadow-sm shadow-[#293828]/20">
                <User className="w-4.5 h-4.5 text-[#F8F2EC]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#0F1206]">{isEn ? 'Teacher Profile & Branding' : 'بيانات المعلم والسنتر'}</h3>
                <p className="text-[11px] text-[#756046] font-medium">{isEn ? 'Displayed on reports and printouts' : 'تظهر في الكشوفات والتقارير المطبوعة'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {savedSuccess && (
                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] text-xs font-black flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#F8F2EC]" />
                  <span>{t('saveSuccess')}</span>
                </span>
              )}
              {currentUser && (
                <button
                  type="button"
                  onClick={() => setIsChangingPassword(!isChangingPassword)}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#F8F2EC] to-[#DDD3C7]/35 hover:border-[#293828] border border-[#DDD3C7] text-[#0F1206] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#293828]" />
                  <span>{isEn ? 'Password' : 'كلمة المرور'}</span>
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3">
            {/* 2x2 Square Field Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-[20px] classy-bento-sapphire flex flex-col justify-between min-h-[88px]">
                <label className="text-[11px] font-black text-[#293828] flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5 text-[#293828]" />
                  <span className="truncate">{t('teacherName')}</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 rounded-xl bg-[#F8F2EC]/95 border border-[#DDD3C7] font-black text-xs text-[#0F1206] focus:outline-none focus:border-[#293828] shadow-2xs"
                  required
                />
              </div>

              <div className="p-3 rounded-[20px] classy-bento-navy flex flex-col justify-between min-h-[88px]">
                <label className="text-[11px] font-black text-[#0F1206] flex items-center gap-1.5 mb-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#0F1206]" />
                  <span className="truncate">{t('subject')}</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full p-2 rounded-xl bg-[#F8F2EC]/95 border border-[#DDD3C7] font-black text-xs text-[#0F1206] focus:outline-none focus:border-[#293828] shadow-2xs"
                  required
                />
              </div>

              <div className="p-3 rounded-[20px] classy-bento-steel flex flex-col justify-between min-h-[88px]">
                <label className="text-[11px] font-black text-[#0F1206] flex items-center gap-1.5 mb-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#756046]" />
                  <span className="truncate">{t('phone')}</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2 rounded-xl bg-[#F8F2EC]/95 border border-[#DDD3C7] font-black text-xs text-[#0F1206] focus:outline-none focus:border-[#293828] shadow-2xs"
                />
              </div>

              <div className="p-3 rounded-[20px] classy-bento-silver flex flex-col justify-between min-h-[88px]">
                <label className="text-[11px] font-black text-[#293828] flex items-center gap-1.5 mb-1.5">
                  <Building className="w-3.5 h-3.5 text-[#293828]" />
                  <span className="truncate">{isEn ? 'Center / Academy' : 'السنتر / المؤسسة'}</span>
                </label>
                <input
                  type="text"
                  value={centerOrSchool}
                  onChange={(e) => setCenterOrSchool(e.target.value)}
                  className="w-full p-2 rounded-xl bg-[#F8F2EC]/95 border border-[#DDD3C7] font-black text-xs text-[#0F1206] focus:outline-none focus:border-[#293828] shadow-2xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="btn-primary px-5 py-2.5 text-xs flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4 text-[#F8F2EC]" />
                <span>{t('save')}</span>
              </button>
            </div>
          </form>

          {/* Optional Password Change Square Panel */}
          {isChangingPassword && currentUser && (
            <form
              onSubmit={handleChangePassword}
              className="p-3.5 sm:p-4 rounded-[20px] classy-bento-navy space-y-3 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#0F1206] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#293828]" />
                  <span>{isEn ? 'Change Account Password' : 'تحديث كلمة مرور الحساب'}</span>
                </span>
              </div>
              {passMessage && (
                <div className="p-2.5 rounded-xl bg-[#293828] text-[#F8F2EC] text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#F8F2EC]" />
                  <span>{passMessage.text}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="password"
                  placeholder={isEn ? 'Current password' : 'كلمة المرور الحالية'}
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#F8F2EC] border border-[#DDD3C7] text-xs font-bold text-[#0F1206]"
                />
                <input
                  type="password"
                  placeholder={isEn ? 'New password (min 6)' : 'كلمة المرور الجديدة'}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#F8F2EC] border border-[#DDD3C7] text-xs font-bold text-[#0F1206]"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-[#F8F2EC]" />
                  <span>{isEn ? 'Update Password' : 'حفظ كلمة المرور'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* =========================================================================
          5. CLOUD SYNC & BACKUP (SQUARE BENTO OPERATIONS GRID)
          ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'sync') && (
        <div className="classy-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#0F1206] to-[#756046] flex items-center justify-center text-[#F8F2EC] shadow-sm shadow-[#0F1206]/20">
                <Database className="w-4.5 h-4.5 text-[#F8F2EC]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#0F1206]">{isEn ? 'Cloud Sync & Data Security' : 'المزامنة السحابية والنسخ الاحتياطي'}</h3>
                <p className="text-[11px] text-[#756046] font-medium">{syncStatus.label}</p>
              </div>
            </div>

            <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#DDD3C7]/35 text-[#0F1206] border border-[#DDD3C7]">
              {lastSyncTime ? formatSyncTimeArabic(lastSyncTime) : (isEn ? 'Ready' : 'جاهز للمزامنة')}
            </span>
          </div>

          {/* 2x2 Square Sync & Backup Action Tiles */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Square 1: Sync Now */}
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="p-3.5 rounded-[20px] classy-bento-sapphire hover:border-[#293828] flex flex-col justify-between min-h-[96px] text-start transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50"
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#293828] to-[#0F1206] text-[#F8F2EC] flex items-center justify-center shadow-xs">
                  <RefreshCw className={`w-4 h-4 text-[#F8F2EC] ${isSyncing ? 'animate-spin' : ''}`} />
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#F8F2EC] text-[#293828] border border-[#DDD3C7]">
                  {isEn ? 'Cloud' : 'سحابي'}
                </span>
              </div>
              <div>
                <span className="text-xs font-black text-[#0F1206] block truncate">
                  {isSyncing ? (isEn ? 'Syncing...' : 'جاري المزامنة...') : (isEn ? 'Sync Now' : 'مزامنة الآن')}
                </span>
                <span className="text-[10px] font-bold text-[#756046] block truncate mt-0.5">
                  {isEn ? 'Instant cloud sync' : 'تحديث فوري للبيانات'}
                </span>
              </div>
            </button>

            {/* Square 2: Export JSON Backup */}
            <button
              type="button"
              onClick={handleBackupNow}
              className="p-3.5 rounded-[20px] classy-bento-navy hover:border-[#0F1206] flex flex-col justify-between min-h-[96px] text-start transition-all cursor-pointer active:scale-[0.98]"
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0F1206] to-[#756046] text-[#F8F2EC] flex items-center justify-center shadow-xs">
                  <Download className="w-4 h-4 text-[#F8F2EC]" />
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#F8F2EC] text-[#0F1206] border border-[#DDD3C7]">
                  JSON
                </span>
              </div>
              <div>
                <span className="text-xs font-black text-[#0F1206] block truncate">
                  {isEn ? 'Export Backup' : 'تصدير نسخة احتياطية'}
                </span>
                <span className="text-[10px] font-bold text-[#756046] block truncate mt-0.5">
                  {isEn ? 'Save file to device' : 'حفظ ملف على الجهاز'}
                </span>
              </div>
            </button>

            {/* Square 3: Import JSON Backup */}
            <label className="p-3.5 rounded-[20px] classy-bento-steel hover:border-[#756046] flex flex-col justify-between min-h-[96px] text-start transition-all cursor-pointer active:scale-[0.98]">
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#756046] to-[#293828] text-[#F8F2EC] flex items-center justify-center shadow-xs">
                  <Upload className="w-4 h-4 text-[#F8F2EC]" />
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#F8F2EC] text-[#0F1206] border border-[#DDD3C7]">
                  {isEn ? 'Restore' : 'استيراد'}
                </span>
              </div>
              <div>
                <span className="text-xs font-black text-[#0F1206] block truncate">
                  {isEn ? 'Import Backup' : 'استعادة نسخة (.json)'}
                </span>
                <span className="text-[10px] font-bold text-[#756046] block truncate mt-0.5">
                  {isEn ? 'Load from backup file' : 'رفع ملف نسخة سابقة'}
                </span>
              </div>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackupFile}
                className="hidden"
              />
            </label>

            {/* Square 4: Restore Account Snapshot */}
            <button
              type="button"
              onClick={handleRestoreFromAccount}
              className="p-3.5 rounded-[20px] classy-bento-silver hover:border-[#293828] flex flex-col justify-between min-h-[96px] text-start transition-all cursor-pointer active:scale-[0.98]"
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#293828] via-[#0F1206] to-[#756046] text-[#F8F2EC] flex items-center justify-center shadow-xs">
                  <HardDriveDownload className="w-4 h-4 text-[#F8F2EC]" />
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#F8F2EC] text-[#293828] border border-[#DDD3C7]">
                  {isEn ? 'Account' : 'الحساب'}
                </span>
              </div>
              <div>
                <span className="text-xs font-black text-[#0F1206] block truncate">
                  {isEn ? 'Account Restore' : 'استعادة بيانات الحساب'}
                </span>
                <span className="text-[10px] font-bold text-[#756046] block truncate mt-0.5">
                  {isEn ? 'Reload synced records' : 'تحديث السجلات المحفوظة'}
                </span>
              </div>
            </button>
          </div>

          {/* Sync Frequency Square Pills */}
          <div className="space-y-2 pt-2 border-t border-[#DDD3C7]/70">
            <label className="text-xs font-black text-[#0F1206] block">{isEn ? 'Auto Sync Schedule:' : 'جدولة المزامنة التلقائية:'}</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
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
                    className={`py-2.5 px-2.5 rounded-xl font-black text-xs transition-all cursor-pointer border flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] border-[#293828] shadow-sm shadow-[inset_0_1px_0_0_rgba(248, 242, 236,0.28)]'
                        : 'bg-[#DDD3C7]/20 text-[#756046] border-[#DDD3C7] hover:bg-[#DDD3C7]/40 hover:text-[#0F1206]'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#F8F2EC] stroke-[3] shrink-0" />}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          6. NOTIFICATIONS & SMART REMINDERS (2x2 SQUARE BENTO GRID)
          ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'notif') && (
        <div className="classy-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#756046] to-[#293828] flex items-center justify-center text-[#F8F2EC] shadow-sm shadow-[#293828]/20">
                <Bell className="w-4.5 h-4.5 text-[#F8F2EC]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#0F1206]">{isEn ? 'Smart Notifications & Reminders' : 'التنبيهات والتذكيرات الذكية'}</h3>
                <p className="text-[11px] text-[#756046] font-medium">{isEn ? 'Proactive attendance & payment alerts in square cards' : 'تحكم كامل في تنبيهات الحضور والمستحقات والغياب'}</p>
              </div>
            </div>
          </div>

          {/* 2x2 Square Notification Toggle Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Square 1: Daily Mobile Attendance Reminder */}
            <button
              type="button"
              onClick={handleToggleDailyAttendanceReminder}
              className={`p-3.5 rounded-[20px] flex flex-col justify-between min-h-[100px] text-start transition-all cursor-pointer active:scale-[0.98] border ${
                notifSettings.enableDailyAttendanceReminder !== false
                  ? 'classy-bento-sapphire border-[#293828]/60'
                  : 'bg-[#DDD3C7]/15 border-[#DDD3C7] text-[#756046]'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#293828] to-[#0F1206] text-[#F8F2EC] flex items-center justify-center shadow-xs">
                  <Clock className="w-4 h-4 text-[#F8F2EC]" />
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                    notifSettings.enableDailyAttendanceReminder !== false
                      ? 'bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] shadow-2xs'
                      : 'bg-[#F8F2EC] text-[#756046] border border-[#DDD3C7]'
                  }`}
                >
                  {notifSettings.enableDailyAttendanceReminder !== false && <Check className="w-3 h-3 text-[#F8F2EC] stroke-[3]" />}
                  <span>{notifSettings.enableDailyAttendanceReminder !== false ? (isEn ? 'ON' : 'مفعّل') : (isEn ? 'OFF' : 'معطّل')}</span>
                </span>
              </div>
              <div>
                <span className="text-xs font-black text-[#0F1206] block truncate">
                  {isEn ? 'Daily Reminder' : 'تذكير الحضور اليومي'}
                </span>
                <span className="text-[10px] font-bold text-[#756046] block truncate mt-0.5">
                  {formatReminderTimeDisplay(notifSettings.dailyAttendanceReminderTime || '22:00', isEn)}
                </span>
              </div>
            </button>

            {/* Square 2: In-App Attendance Alerts */}
            <button
              type="button"
              onClick={() => handleToggleNotif('enableAttendanceReminders')}
              className={`p-3.5 rounded-[20px] flex flex-col justify-between min-h-[100px] text-start transition-all cursor-pointer active:scale-[0.98] border ${
                notifSettings.enableAttendanceReminders
                  ? 'classy-bento-navy border-[#0F1206]/60'
                  : 'bg-[#DDD3C7]/15 border-[#DDD3C7] text-[#756046]'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0F1206] to-[#756046] text-[#F8F2EC] flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-[#F8F2EC]" />
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                    notifSettings.enableAttendanceReminders
                      ? 'bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] shadow-2xs'
                      : 'bg-[#F8F2EC] text-[#756046] border border-[#DDD3C7]'
                  }`}
                >
                  {notifSettings.enableAttendanceReminders && <Check className="w-3 h-3 text-[#F8F2EC] stroke-[3]" />}
                  <span>{notifSettings.enableAttendanceReminders ? (isEn ? 'ON' : 'مفعّل') : (isEn ? 'OFF' : 'معطّل')}</span>
                </span>
              </div>
              <div>
                <span className="text-xs font-black text-[#0F1206] block truncate">
                  {isEn ? 'Session Alerts' : 'تنبيهات رصد الحضور'}
                </span>
                <span className="text-[10px] font-bold text-[#756046] block truncate mt-0.5">
                  {isEn ? 'In-app session tracking' : 'متابعة الحصص داخل التطبيق'}
                </span>
              </div>
            </button>

            {/* Square 3: Overdue Payment Reminders */}
            <button
              type="button"
              onClick={() => handleToggleNotif('enableOverdueReminders')}
              className={`p-3.5 rounded-[20px] flex flex-col justify-between min-h-[100px] text-start transition-all cursor-pointer active:scale-[0.98] border ${
                notifSettings.enableOverdueReminders
                  ? 'classy-bento-steel border-[#756046]/60'
                  : 'bg-[#DDD3C7]/15 border-[#DDD3C7] text-[#756046]'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#756046] to-[#293828] text-[#F8F2EC] flex items-center justify-center shadow-xs">
                  <Zap className="w-4 h-4 text-[#F8F2EC]" />
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                    notifSettings.enableOverdueReminders
                      ? 'bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] shadow-2xs'
                      : 'bg-[#F8F2EC] text-[#756046] border border-[#DDD3C7]'
                  }`}
                >
                  {notifSettings.enableOverdueReminders && <Check className="w-3 h-3 text-[#F8F2EC] stroke-[3]" />}
                  <span>{notifSettings.enableOverdueReminders ? (isEn ? 'ON' : 'مفعّل') : (isEn ? 'OFF' : 'معطّل')}</span>
                </span>
              </div>
              <div>
                <span className="text-xs font-black text-[#0F1206] block truncate">
                  {isEn ? 'Overdue Dues' : 'تنبيهات المديونيات'}
                </span>
                <span className="text-[10px] font-bold text-[#756046] block truncate mt-0.5">
                  {isEn ? 'Pending payment alerts' : 'تذكير بالمستحقات المتأخرة'}
                </span>
              </div>
            </button>

            {/* Square 4: Student Absence Alerts */}
            <button
              type="button"
              onClick={() => handleToggleNotif('enableAbsenceReminders')}
              className={`p-3.5 rounded-[20px] flex flex-col justify-between min-h-[100px] text-start transition-all cursor-pointer active:scale-[0.98] border ${
                notifSettings.enableAbsenceReminders
                  ? 'classy-bento-silver border-[#293828]/50'
                  : 'bg-[#DDD3C7]/15 border-[#DDD3C7] text-[#756046]'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#293828] via-[#0F1206] to-[#756046] text-[#F8F2EC] flex items-center justify-center shadow-xs">
                  <Activity className="w-4 h-4 text-[#F8F2EC]" />
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                    notifSettings.enableAbsenceReminders
                      ? 'bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] shadow-2xs'
                      : 'bg-[#F8F2EC] text-[#756046] border border-[#DDD3C7]'
                  }`}
                >
                  {notifSettings.enableAbsenceReminders && <Check className="w-3 h-3 text-[#F8F2EC] stroke-[3]" />}
                  <span>{notifSettings.enableAbsenceReminders ? (isEn ? 'ON' : 'مفعّل') : (isEn ? 'OFF' : 'معطّل')}</span>
                </span>
              </div>
              <div>
                <span className="text-xs font-black text-[#0F1206] block truncate">
                  {isEn ? 'Absence Alerts' : 'تنبيهات غياب الطلاب'}
                </span>
                <span className="text-[10px] font-bold text-[#756046] block truncate mt-0.5">
                  {isEn ? 'Repeated absence tracking' : 'متابعة الغياب المتكرر'}
                </span>
              </div>
            </button>
          </div>

          {/* Reminder Time & Sound Configuration (2 Square Sub-Cards) */}
          {notifSettings.enableDailyAttendanceReminder !== false && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#DDD3C7]/70 animate-in fade-in">
              {/* Time Picker Card */}
              <div className="p-3.5 rounded-[20px] classy-bento-sapphire flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#0F1206] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#293828]" />
                    <span>{isEn ? 'Reminder Time' : 'وقت التذكير اليومي'}</span>
                  </span>
                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-[#F8F2EC] border border-[#DDD3C7] text-[#293828]">
                    {formatReminderTimeDisplay(notifSettings.dailyAttendanceReminderTime || '22:00', isEn)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={notifSettings.dailyAttendanceReminderTime || '22:00'}
                    onChange={(e) => handleReminderTimeChange(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-xl bg-[#F8F2EC] border border-[#DDD3C7] font-bold text-xs text-[#0F1206] focus:outline-none focus:border-[#293828] cursor-pointer shadow-2xs"
                    aria-label={isEn ? 'Reminder Time' : 'وقت التذكير'}
                  />
                  <button
                    type="button"
                    onClick={handleSendTestNotification}
                    className="px-3 py-1.5 rounded-xl bg-[#F8F2EC] hover:bg-[#DDD3C7]/35 border border-[#DDD3C7] text-[#293828] font-black text-[11px] transition-colors cursor-pointer shadow-2xs shrink-0"
                  >
                    {isEn ? 'Test Alert' : 'تجربة التنبيه'}
                  </button>
                </div>
              </div>

              {/* Sound Picker Card */}
              <div className="p-3.5 rounded-[20px] classy-bento-steel flex flex-col justify-between gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#0F1206] flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-[#293828]" />
                    <span>{isEn ? 'Alert Sound' : 'نغمة التنبيه المخصصة'}</span>
                  </span>
                  <span className="text-[10px] font-bold text-[#756046]">
                    {isEn ? 'Custom Tone' : 'صوت الإشعار'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={notifSettings.notificationSoundUri || 'beep.wav'}
                    onChange={(e) => handleSoundChange(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-[#F8F2EC] border border-[#DDD3C7] font-bold text-xs text-[#0F1206] focus:outline-none focus:border-[#293828] cursor-pointer shadow-2xs"
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
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] font-black text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-[#F8F2EC]" />
                    <span>{isEn ? 'Test Sound' : 'تجربة الصوت'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          7. DANGER ZONE: DATA RESET
          ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'language') && (
        <div className="classy-bento-navy p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#0F1206] to-[#756046] flex items-center justify-center text-[#F8F2EC] shadow-xs">
                <AlertTriangle className="w-4.5 h-4.5 text-[#F8F2EC]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#0F1206]">{isEn ? 'System Reset & Local Data' : 'المنطقة الحساسة: إعادة ضبط البيانات'}</h3>
                <p className="text-[11px] text-[#756046] font-medium">{isEn ? 'Permanently clear local records on this device' : 'حذف وإعادة تهيئة جميع السجلات المحلية على هذا الجهاز'}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetData}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#0F1206] to-[#756046] hover:from-[#293828] hover:to-[#0F1206] text-[#F8F2EC] font-black text-xs border border-[#DDD3C7]/40 shadow-sm shadow-[inset_0_1px_0_0_rgba(248, 242, 236,0.25)] transition-all cursor-pointer active:scale-95"
            >
              {isEn ? 'Erase All Local Data' : 'مسح جميع البيانات والبدء من جديد'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
