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
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Password change in settings
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMessage, setPassMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      off: 'إيقاف',
      hourly: 'كل ساعة',
      daily: 'كل يوم',
      weekly: 'كل أسبوع',
      monthly: 'كل شهر',
    };
    setSyncFeedback({
      type: 'success',
      message:
        newFreq === 'off'
          ? 'تم إيقاف المزامنة التلقائية المجدولة.'
          : `تم تفعيل وتعيين جدول المزامنة التلقائية (${labels[newFreq]}) وحفظ الإعداد بشكل دائم.`,
    });
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  // Handle Sync Now ("مزامنة الآن")
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
        message: 'فشلت المزامنة، ولكن تم حفظ وتأمين جميع البيانات محلياً على هذا الجهاز.',
      });
      setTimeout(() => setSyncFeedback(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Backup Now
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
      a.download = `backup_${userName}_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setSyncFeedback({
        type: 'success',
        message: `تم إنشاء النسخة الاحتياطية بنجاح ومزامنة (${syncPkg.stats?.totalStudents || 0} طالب، ${syncPkg.stats?.totalGroups || 0} مجموعة، ${syncPkg.stats?.totalSessions || 0} حصة).`,
      });
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err) {
      setSyncFeedback({ type: 'error', message: 'حدث خطأ أثناء إجراء النسخ الاحتياطي.' });
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Restore from user account
  const handleRestoreFromAccount = () => {
    if (!currentUser) return;
    if (
      !confirm(
        'هل ترغب في استعادة آخر بيانات محفوظة ومتزامنة مع حسابك؟ سيتم تحديث جميع السجلات على هذا الجهاز.'
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
          message: `${res.message} (${res.count?.students || 0} طالب، ${res.count?.groups || 0} مجموعة، ${res.count?.sessions || 0} حصة)`,
        });
        onDataReset();
        setTimeout(() => setSyncFeedback(null), 5000);
      } else {
        setSyncFeedback({ type: 'error', message: res.message });
      }
    } catch (err) {
      setSyncFeedback({ type: 'error', message: 'فشلت عملية استعادة البيانات.' });
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
            message: `تمت استعادة الملف بنجاح! تم تحميل ${res.count?.students || 0} طالب، ${res.count?.groups || 0} مجموعة، ${res.count?.sessions || 0} حصة.`,
          });
          onDataReset();
          setTimeout(() => setSyncFeedback(null), 5000);
        } else {
          setSyncFeedback({ type: 'error', message: res.message || 'الملف غير صالح أو تالف.' });
        }
      } catch (err) {
        setSyncFeedback({ type: 'error', message: 'حدث خطأ أثناء قراءة ملف النسخ الاحتياطي.' });
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: TeacherProfile = {
      name: name.trim(),
      subject: subject.trim(),
      phone: phone.trim(),
      centerOrSchool: centerOrSchool.trim(),
      currency: teacherProfile.currency || 'ج.م',
    };
    db.saveTeacherProfile(updated, currentUser?.id);

    // Also update account if logged in
    if (currentUser) {
      const accounts = db.getAccounts();
      const updatedAccounts = accounts.map((acc) => {
        if (acc.id === currentUser.id) {
          return {
            ...acc,
            name: updated.name,
            subject: updated.subject,
            phone: updated.phone,
            centerOrSchool: updated.centerOrSchool,
          };
        }
        return acc;
      });
      db.saveAccounts(updatedAccounts);
      const updatedUser = updatedAccounts.find((a) => a.id === currentUser.id);
      if (updatedUser) db.setCurrentSession(updatedUser);
    }

    onProfileUpdated(updated);
    setLastSyncTime(new Date().toISOString());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleUpdateNotifSettings = (newSettings: NotificationSettings) => {
    setNotifSettings(newSettings);
    db.saveNotificationSettings(newSettings, currentUser?.id);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMessage(null);

    if (!currentUser) return;
    if (currentUser.password && currentUser.password !== currentPass) {
      setPassMessage({ type: 'error', text: 'كلمة المرور الحالية غير صحيحة.' });
      return;
    }
    if (!newPass || newPass.length < 4) {
      setPassMessage({ type: 'error', text: 'يجب ألا تقل كلمة المرور الجديدة عن 4 أحرف أو أرقام.' });
      return;
    }

    try {
      const res = await db.resetPassword(currentUser.email, newPass, currentUser.recoveryPin);
      if (res.success) {
        setPassMessage({ type: 'success', text: 'تم تغيير كلمة المرور بنجاح!' });
        setCurrentPass('');
        setNewPass('');
        setTimeout(() => {
          setIsChangingPassword(false);
          setPassMessage(null);
        }, 2000);
      } else {
        setPassMessage({ type: 'error', text: res.error || 'فشل تحديث كلمة المرور.' });
      }
    } catch (err: any) {
      setPassMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء الاتصال بالخادم.' });
    }
  };

  const handleClearAll = async () => {
    if (
      confirm(
        'تحذير: هل أنت متأكد تماماً من تصفير وحذف جميع بيانات التطبيق لهذا الحساب؟ سيتم مسح البيانات محلياً وسحابياً وتحديث المزامنة فوراً.'
      )
    ) {
      setIsSyncing(true);
      try {
        const result = await db.clearAllData();
        onDataReset();
        setSyncFeedback({
          type: result.success ? 'success' : 'info',
          message: result.message || 'تم مسح البيانات وتصفير السحابة بنجاح.',
        });
      } catch (err: any) {
        onDataReset();
        setSyncFeedback({
          type: 'info',
          message: 'تم مسح البيانات محلياً بنجاح.',
        });
      } finally {
        setIsSyncing(false);
        setTimeout(() => setSyncFeedback(null), 4000);
      }
    }
  };

  const { language, setLanguage, isRTL, t } = useTranslation();

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar p-4 space-y-4 text-[#17163D] pb-24 bg-[#F6F7FC]" dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 classy-card p-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#E8E7FF] text-[#7657F6] flex items-center justify-center shadow-xs">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#17163D] tracking-tight">
                {t('settingsTitle')}
              </h1>
              <p className="text-xs text-[#74778F] font-medium mt-0.5">
                {t('settingsSubtitle')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Global Sync Notification / Alert */}
      {syncFeedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all shadow-xs ${
            syncFeedback.type === 'success'
              ? 'bg-[#E0F7EF] text-emerald-800 border border-emerald-200'
              : syncFeedback.type === 'error'
              ? 'bg-[#FFEBEB] text-rose-800 border border-[#FFD6D6]'
              : 'bg-[#E8E7FF] text-[#7657F6] border border-[#DDD6FE]'
          }`}
        >
          {syncFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : syncFeedback.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#FF647C]" />
          ) : (
            <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-[#7657F6]" />
          )}
          <span>{syncFeedback.message}</span>
        </div>
      )}

      {/* LANGUAGE SELECTOR CARD (اللغة وخيارات العرض) */}
      <div className="p-4 classy-card space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-[#E8E7FF]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E8E7FF] text-[#7657F6] flex items-center justify-center font-bold">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black text-[#17163D]">{t('languageSection')}</h2>
              <p className="text-[10px] sm:text-[11px] text-[#74778F] font-medium">
                {t('languageDesc')}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#E8E7FF] text-[#7657F6]">
            {language === 'ar' ? 'العربية (RTL)' : language === 'en-GB' ? 'UK English (LTR)' : 'US English (LTR)'}
          </span>
        </div>

        {/* 3 Distinct Language Options */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { id: 'ar' as Language, title: 'العربية', sub: 'Arabic (RTL)', flag: '🇪🇬' },
            { id: 'en-GB' as Language, title: 'English (UK)', sub: 'British (LTR)', flag: '🇬🇧' },
            { id: 'en-US' as Language, title: 'English (US)', sub: 'American (LTR)', flag: '🇺🇸' },
          ].map((langOpt) => {
            const isSelected = language === langOpt.id;
            return (
              <button
                key={langOpt.id}
                type="button"
                onClick={() => setLanguage(langOpt.id)}
                className={`p-3 rounded-2xl border text-center transition-all active:scale-95 flex flex-col items-center justify-center gap-1 cursor-pointer ${
                  isSelected
                    ? 'bg-[#17163D] border-[#17163D] text-white shadow-md font-bold'
                    : 'bg-[#F6F7FC] hover:bg-[#E8E7FF] border-[#E8E7FF] text-[#17163D]'
                }`}
              >
                <span className="text-base">{langOpt.flag}</span>
                <span className="text-xs font-black leading-tight">{langOpt.title}</span>
                <span className={`text-[9px] ${isSelected ? 'text-[#FF647C]' : 'text-[#74778F] font-bold'}`}>
                  {langOpt.sub}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. AUTO-SYNC & SCHEDULING (المزامنة التلقائية والنسخ الاحتياطي) */}
      <div className="p-4 neu-card space-y-4">
        {/* Section Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#172554]/10 text-[#172554] flex items-center justify-center">
              <RefreshCw className={`w-4 h-4 ${autoSyncConfig.status === 'syncing' ? 'animate-spin text-[#C9A227]' : 'text-[#172554]'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-bold text-[#111827]">المزامنة التلقائية والنسخ الاحتياطي</h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[10px] font-bold ${
                    autoSyncConfig.frequency === 'off'
                      ? 'bg-slate-100 text-slate-600 border border-slate-200'
                      : !networkStatus.isOnline
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      autoSyncConfig.frequency === 'off'
                        ? 'bg-slate-400'
                        : !networkStatus.isOnline
                        ? 'bg-rose-500'
                        : 'bg-emerald-500 animate-pulse'
                    }`}
                  ></span>
                  {autoSyncConfig.frequency === 'off'
                    ? 'المزامنة متوقفة'
                    : !networkStatus.deviceConnected
                    ? 'مؤجلة (دون اتصال)'
                    : !networkStatus.apiReachable
                    ? 'مؤجلة (في انتظار الاتصال)'
                    : 'نشطة ومجدولة'}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#64748B] font-medium mt-0.5">
                مزامنة بيانات المستخدم تلقائياً مع السحابة حسب الفترة المحددة مع استقلالية تامة لكل حساب
              </p>
            </div>
          </div>

          {/* Connectivity Status Pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border shadow-2xs ${
                networkStatus.isOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : networkStatus.deviceConnected && !networkStatus.apiReachable
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {networkStatus.isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>
                    {networkStatus.connectionType === 'wifi'
                      ? 'متصل بالإنترنت (Wi-Fi)'
                      : networkStatus.connectionType === 'cellular'
                      ? 'متصل بالإنترنت (بيانات الجوال)'
                      : 'متصل بالإنترنت'}
                  </span>
                </>
              ) : networkStatus.deviceConnected && !networkStatus.apiReachable ? (
                <>
                  <Activity className="w-3.5 h-3.5 text-amber-600" />
                  <span>متصل بالشبكة (في انتظار المزامنة)</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                  <span>وضع عدم الاتصال (أوفلاين)</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Frequency Options Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>فترة المزامنة التلقائية (Sync Schedule):</span>
            </label>
            <span className="text-[10px] text-[#64748B] font-bold">يُحفظ الإعداد تلقائياً بشكل دائم</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { value: 'off', label: 'إيقاف', desc: 'يدوي فقط' },
              { value: 'hourly', label: 'كل ساعة', desc: 'تحديث كل 60 دقيقة' },
              { value: 'daily', label: 'كل يوم', desc: 'مرة يومياً' },
              { value: 'weekly', label: 'كل أسبوع', desc: 'مرة أسبوعياً' },
              { value: 'monthly', label: 'كل شهر', desc: 'مرة شهرياً' },
            ].map((opt) => {
              const isSelected = autoSyncConfig.frequency === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleFrequencyChange(opt.value as AutoSyncFrequency)}
                  className={`p-3 rounded-xl border text-center transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[#172554] border-[#172554] text-white shadow-xs font-bold'
                      : 'bg-[#F7F8FC] hover:bg-slate-100 border-[#E2E8F0] text-[#111827]'
                  }`}
                >
                  <span className="text-xs font-bold">{opt.label}</span>
                  <span className={`text-[9px] ${isSelected ? 'text-[#C9A227]' : 'text-[#64748B] font-bold'}`}>
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sync Status, Last Sync & Next Sync Times */}
        <div className="p-3.5 bg-[#F7F8FC] border border-[#E2E8F0] rounded-xl space-y-3 text-xs">
          {/* Current Sync Status */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#172554]" />
              <span className="font-bold text-[#111827]">حالة المزامنة الحالية:</span>
            </div>
            <div
              className={`px-3 py-1 rounded-xl text-[11px] font-bold ${
                formatSyncStatusArabic(autoSyncConfig.status, networkStatus.isOnline, networkStatus.statusReason).badgeClass
              }`}
            >
              {formatSyncStatusArabic(autoSyncConfig.status, networkStatus.isOnline, networkStatus.statusReason).label}
            </div>
          </div>

          {/* Last Sync & Next Sync Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            {/* Last Sync */}
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-[#E2E8F0] shadow-xs">
              <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="text-[#64748B] block font-bold">آخر مزامنة (Last Sync):</span>
                <span className="font-bold text-[#111827] text-xs">{formatSyncTimeArabic(lastSyncTime)}</span>
              </div>
            </div>

            {/* Next Sync */}
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-[#E2E8F0] shadow-xs">
              <Calendar className="w-4 h-4 text-[#172554] shrink-0" />
              <div>
                <span className="text-[#64748B] block font-bold">موعد المزامنة القادمة (Next Sync):</span>
                <span className="font-bold text-[#111827] text-xs">
                  {formatNextSyncTimeArabic(autoSyncConfig.nextSyncTime, autoSyncConfig.frequency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons: Sync Now + Backup & Restore */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          {/* 1. "مزامنة الآن" Sync Now */}
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="py-2.5 px-3 rounded-xl bg-[#172554] hover:bg-[#0F172A] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : 'text-[#C9A227]'}`} />
            <span>مزامنة الآن (Sync Now)</span>
          </button>

          {/* 2. Backup Now (.json export) */}
          <button
            onClick={handleBackupNow}
            disabled={isSyncing}
            className="py-2.5 px-3 rounded-xl bg-[#0F172A] hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#C9A227]" />
            <span>تصدير نسخة احتياطية (.json)</span>
          </button>

          {/* 3. Restore Data */}
          <button
            onClick={handleRestoreFromAccount}
            disabled={isSyncing}
            className="py-2.5 px-3 rounded-xl bg-[#F7F8FC] hover:bg-slate-100 border border-[#E2E8F0] text-[#172554] font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <HardDriveDownload className="w-3.5 h-3.5 text-[#C9A227]" />
            <span>استعادة البيانات السحابية</span>
          </button>
        </div>

        {/* Synced Entities Pill Badges */}
        <div className="pt-2 border-t border-[#E2E8F0]">
          <span className="text-[10px] font-bold text-[#64748B] block mb-1.5">
            البيانات المشمولة في المزامنة التلقائية:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              'الطلاب (Students)',
              'المجموعات (Groups)',
              'الاشتراكات (Enrollments)',
              'الدروس الخاصة (Private Services)',
              'الحصص والمواعيد (Sessions)',
              'الحضور والغياب (Attendance)',
              'المدفوعات (Payments)',
              'الفواتير الشهرية (Monthly Billing)',
              'رصيد الحصص (Session Credits)',
              'الرصيد المالي (Financial Credits)',
              'الملف الشخصي (Teacher Profile)',
            ].map((entity, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F7F8FC] text-[#172554] border border-[#E2E8F0] text-[10px] font-bold"
              >
                <Check className="w-2.5 h-2.5 text-[#C9A227]" />
                {entity}
              </span>
            ))}
          </div>
        </div>

        {/* Secondary Import File Option */}
        <div className="pt-2 border-t border-[#E2E8F0]">
          <label className="w-full py-2.5 px-3 rounded-xl bg-[#F7F8FC] hover:bg-slate-100 border border-dashed border-[#CBD5E1] text-[#172554] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-[#C9A227]" />
            <span>استيراد واستعادة من ملف نسخة احتياطية (.json)</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackupFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 2. SMART NOTIFICATIONS & BILLING REMINDERS (إعدادات التنبيهات والإشعارات الذكية) */}
      <div className="p-4 neu-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#C9A227]/10 text-[#C9A227] flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-[#111827]">
                إعدادات التنبيهات والإشعارات الذكية
              </h2>
              <p className="text-[10px] sm:text-[11px] text-[#64748B] font-medium mt-0.5">
                تخصيص قواعد استحقاق سداد الباقات، التنبيه المبكر، ومتابعة الحضور والغياب
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* Rule 1: Package Payment Due (Core Rule) */}
          <div className="p-3.5 rounded-xl bg-[#F7F8FC] border border-[#E2E8F0] flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#111827]">
                  تنبيه استحقاق سداد الباقة عند اكتمال الحصص المحددة
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                  نشط أساسي
                </span>
              </div>
              <p className="text-[10px] text-[#64748B] font-medium">
                يظهر التنبيه حصراً عند إتمام الطالب لعدد الحصص المسجلة بالباقة (ديناميكياً لكل طالب) ويختفي فور تسجيل السداد.
              </p>
            </div>
            <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Check className="w-3 h-3" />
            </div>
          </div>

          {/* Rule 2: Early Warning Before Package Completion */}
          <div className="p-3.5 rounded-xl bg-white border border-[#E2E8F0] shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-[#111827]">
                  تنبيه مبكر قبل اكتمال الباقة (Early Warning)
                </span>
                <p className="text-[10px] text-[#64748B] font-medium">
                  إشعار استباقي لتذكير ولي الأمر باقتراب تجديد الباقة قبل الحصة الأخيرة.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={notifSettings.enableEarlyPackageWarning}
                  onChange={(e) =>
                    handleUpdateNotifSettings({
                      ...notifSettings,
                      enableEarlyPackageWarning: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#172554]"></div>
              </label>
            </div>

            {notifSettings.enableEarlyPackageWarning && (
              <div className="pt-2.5 border-t border-[#E2E8F0] flex items-center justify-between gap-2 flex-wrap bg-[#F7F8FC] p-3 rounded-xl">
                <span className="text-xs font-bold text-[#111827]">
                  إظهار التنبيه عندما يتبقى للطالب:
                </span>
                <div className="flex items-center gap-1.5">
                  {[
                    { val: 1, label: 'حصة واحدة (1)' },
                    { val: 2, label: 'حصتان (2)' },
                    { val: 3, label: '3 حصص' },
                  ].map((opt) => {
                    const isSelected = (notifSettings.earlyWarningLessonThreshold || 1) === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() =>
                          handleUpdateNotifSettings({
                            ...notifSettings,
                            earlyWarningLessonThreshold: opt.val,
                          })
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#172554] text-white shadow-xs'
                            : 'bg-white border border-[#E2E8F0] text-[#111827] hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Rule 3: Overdue Balances & Remaining Debt */}
          <div className="p-3.5 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-[#111827]">
                تنبيهات مستحقات السداد والديون المتبقية
              </span>
              <p className="text-[10px] text-[#64748B] font-medium">
                إشعار بمستحقات الاشتراكات الشهرية والحسابات المؤجلة التي عليها مبالغ معلقة.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={notifSettings.enableOverdueReminders}
                onChange={(e) =>
                  handleUpdateNotifSettings({
                    ...notifSettings,
                    enableOverdueReminders: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#172554]"></div>
            </label>
          </div>

          {/* Rule 4: Unrecorded Attendance Reminders */}
          <div className="p-3.5 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-[#111827]">
                تنبيهات رصد حضور الحصص المجدولة
              </span>
              <p className="text-[10px] text-[#64748B] font-medium">
                تذكير تلقائي بالحصص المستحقة اليوم التي لم يتم تسجيل حضورها وغيابها بعد.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={notifSettings.enableAttendanceReminders}
                onChange={(e) =>
                  handleUpdateNotifSettings({
                    ...notifSettings,
                    enableAttendanceReminders: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#172554]"></div>
            </label>
          </div>

          {/* Rule 5: Repeated Absence Alerts */}
          <div className="p-3.5 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-[#111827]">
                تنبيهات الغياب المتكرر (حصتان متتاليتان)
              </span>
              <p className="text-[10px] text-[#64748B] font-medium">
                تنبيه فوري عند تغيب الطالب عن حصتين متتاليتين للمتابعة السريعة مع ولي الأمر.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={notifSettings.enableAbsenceReminders}
                onChange={(e) =>
                  handleUpdateNotifSettings({
                    ...notifSettings,
                    enableAbsenceReminders: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#172554]"></div>
            </label>
          </div>
        </div>
      </div>

      {/* 2. ACCOUNT INFO & LOGOUT CARD */}
      <div className="p-4 neu-card space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#172554] text-[#C9A227] flex items-center justify-center font-bold text-base shadow-xs">
              {currentUser?.name?.[0] || teacherProfile.name?.[0] || 'م'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-[#111827]">
                  {currentUser?.name || teacherProfile.name || 'حساب المعلم'}
                </p>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-bold border border-emerald-200">
                  حساب معتمد
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] font-medium flex items-center gap-1">
                <Mail className="w-3 h-3 text-[#64748B]" />
                <span>{currentUser?.email || 'teacher@example.com'}</span>
              </p>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={() => {
              if (confirm('هل ترغب في تسجيل الخروج من الحساب؟ ستبقى بياناتك محفوظة بأمان.')) {
                onLogout();
              }
            }}
            className="py-2 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>

        {/* Change Password Collapsible */}
        <div className="pt-2.5 border-t border-[#E2E8F0]">
          {!isChangingPassword ? (
            <button
              type="button"
              onClick={() => setIsChangingPassword(true)}
              className="text-xs font-bold text-[#172554] hover:text-[#0F172A] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#C9A227]" />
              <span>تغيير كلمة المرور الخاصة بالحساب</span>
            </button>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-3 pt-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#111827] flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#C9A227]" />
                  تغيير كلمة المرور
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPassMessage(null);
                  }}
                  className="text-[11px] text-[#64748B] font-bold hover:text-[#111827] cursor-pointer"
                >
                  إلغاء
                </button>
              </div>

              {passMessage && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                    passMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {passMessage.type === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{passMessage.text}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">الحالية</label>
                  <input
                    type="password"
                    required
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F7F8FC] border border-[#E2E8F0] rounded-xl p-2.5 text-xs font-bold text-[#111827] focus:outline-none focus:border-[#172554]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#64748B] mb-1">الجديدة</label>
                  <input
                    type="password"
                    required
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F7F8FC] border border-[#E2E8F0] rounded-xl p-2.5 text-xs font-bold text-[#111827] focus:outline-none focus:border-[#172554]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#172554] hover:bg-[#0F172A] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-[#C9A227]" />
                <span>حفظ كلمة المرور الجديدة</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 3. TEACHER PROFILE CARD */}
      <div className="p-4 neu-card space-y-4">
        <h2 className="text-xs font-bold text-[#111827] flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#172554]/10 text-[#172554] flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <span>تعديل بيانات المعلم والسنتر</span>
        </h2>

        {savedSuccess && (
          <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>تم حفظ وتحديث بيانات الملف الشخصي بنجاح!</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs text-[#111827]">
          <div>
            <label className="block font-bold text-[#64748B] mb-1.5">اسم المعلم / اللقب *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#F7F8FC] border border-[#E2E8F0] rounded-xl p-3 text-xs font-bold text-[#111827] focus:outline-none focus:border-[#172554]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#64748B] mb-1.5">المادة الدراسية الأساسية *</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-[#F7F8FC] border border-[#E2E8F0] rounded-xl p-3 text-xs font-bold text-[#111827] focus:outline-none focus:border-[#172554]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#64748B] mb-1.5">رقم الهاتف / واتساب</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#F7F8FC] border border-[#E2E8F0] rounded-xl p-3 text-xs font-bold text-[#111827] focus:outline-none focus:border-[#172554]"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#64748B] mb-1.5">اسم السنتر / المدرسة / القاعة</label>
            <input
              type="text"
              value={centerOrSchool}
              onChange={(e) => setCenterOrSchool(e.target.value)}
              placeholder="مثال: سنتر الأوائل التعليمي - مدينة نصر"
              className="w-full bg-[#F7F8FC] border border-[#E2E8F0] rounded-xl p-3 text-xs font-bold text-[#111827] focus:outline-none focus:border-[#172554]"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-[#172554] hover:bg-[#0F172A] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99] cursor-pointer"
          >
            <Save className="w-4 h-4 text-[#C9A227]" />
            <span>حفظ البيانات وتحديث الحساب</span>
          </button>
        </form>
      </div>

      {/* 4. DANGER ZONE: CLEAR LOCAL DATA */}
      <div className="p-4 bg-white border border-rose-100 rounded-xl shadow-xs space-y-3">
        <h2 className="text-xs font-bold text-rose-600 flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <span>إعادة ضبط البيانات المحلية</span>
        </h2>
        <p className="text-[11px] text-[#64748B] font-medium">
          مسح السجلات المحلية والبدء من جديد. لن تفقد النسخ الاحتياطية المتزامنة مع حسابك.
        </p>

        <button
          onClick={handleClearAll}
          className="py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>مسح البيانات المحلية الحالية</span>
        </button>
      </div>

      {/* App Info Footer */}
      <div className="text-center text-[11px] text-[#64748B] space-y-0.5 pt-2">
        <p className="font-bold text-[#172554]">Classy Royal Edition</p>
        <p className="font-medium">مزامنة آمنة للحسابات • يدعم العمل بدون إنترنت والنسخ السحابي</p>
      </div>
    </div>
  );
};
