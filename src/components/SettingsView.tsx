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
  const { language, setLanguage, isRTL, t } = useTranslation();

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
          : `تم تفعيل جدول المزامنة التلقائية (${labels[newFreq]}) وحفظ الإعداد بنجاح.`,
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
        message: `تم تصدير النسخة الاحتياطية بنجاح (${syncPkg.stats?.totalStudents || 0} طالب، ${syncPkg.stats?.totalGroups || 0} مجموعة، ${syncPkg.stats?.totalSessions || 0} حصة).`,
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
      currency: currency.trim() || 'ج.م',
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
        'تحذير هام: هل أنت متأكد تماماً من تصفير وحذف جميع بيانات التطبيق لهذا الحساب؟ سيتم مسح البيانات محلياً وسحابياً وتحديث المزامنة فوراً.'
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

  const syncStatusData = formatSyncStatusArabic(
    autoSyncConfig.status,
    networkStatus.isOnline,
    networkStatus.statusReason
  );

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar p-3.5 sm:p-5 md:p-6 space-y-5 text-[#17163D] pb-28 bg-[#F6F7FC]"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* 1. HERO HEADER (CLASSY DESIGN SYSTEM) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#17163D] via-[#2A2368] to-[#403B9C] text-white p-5 sm:p-7 shadow-lg border border-white/10">
        {/* Background Ambient Glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#7657F6]/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#403B9C]/30 rounded-full blur-2xl pointer-events-none -ml-20 -mb-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          {/* Header Title & Subtitle */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-[#7657F6] shrink-0 shadow-inner">
              <SettingsIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
                  {t('settingsTitle')}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[10px] sm:text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Classy Control Center</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-white/80 font-medium mt-1">
                {t('settingsSubtitle') || 'إدارة الحساب، المزامنة السحابية الآمنة، والتنبيهات الذكية من مكان واحد.'}
              </p>
            </div>
          </div>

          {/* Quick Hero Actions & Sync Status */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Sync Now Button */}
            <button
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#7657F6] to-[#5C3DE6] hover:brightness-110 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'جارِ المزامنة...' : 'مزامنة سحابية فورية'}</span>
            </button>

            {/* Export Backup Button */}
            <button
              onClick={handleBackupNow}
              disabled={isSyncing}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#7657F6]" />
              <span>نسخة احتياطية</span>
            </button>
          </div>
        </div>

        {/* Hero Bottom Metric Strip */}
        <div className="mt-5 pt-4 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-white">
          {/* Identity */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-2.5 sm:p-3 border border-white/10 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black text-sm shrink-0">
              {currentUser?.name?.[0] || teacherProfile.name?.[0] || 'ك'}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-white/70 block font-semibold truncate">المعلم الحالي</span>
              <span className="text-xs font-black truncate block">{teacherProfile.name || 'حساب المعلم'}</span>
            </div>
          </div>

          {/* Network Connectivity */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-2.5 sm:p-3 border border-white/10 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-emerald-400 shrink-0">
              {networkStatus.isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4 text-rose-300" />}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-white/70 block font-semibold truncate">حالة الشبكة</span>
              <span className="text-xs font-black truncate block">
                {networkStatus.isOnline ? 'متصل بالإنترنت' : 'أوفلاين (محلي آمن)'}
              </span>
            </div>
          </div>

          {/* Sync Status */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-2.5 sm:p-3 border border-white/10 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-emerald-300 shrink-0">
              <CloudCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-white/70 block font-semibold truncate">المزامنة السحابية</span>
              <span className="text-xs font-black truncate block">
                {autoSyncConfig.frequency === 'off' ? 'يدوي' : `تلقائي (${autoSyncConfig.frequency})`}
              </span>
            </div>
          </div>

          {/* Last Sync Time */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-2.5 sm:p-3 border border-white/10 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-amber-300 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-white/70 block font-semibold truncate">آخر مزامنة</span>
              <span className="text-xs font-black truncate block">
                {lastSyncTime ? formatSyncTimeArabic(lastSyncTime) : 'لم تتم بعد'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Sync Notification / Alert Feedback */}
      {syncFeedback && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-3 transition-all shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
            syncFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : syncFeedback.type === 'error'
              ? 'bg-rose-50 text-rose-900 border border-rose-200'
              : 'bg-[#E8E7FF] text-[#17163D] border border-[#DDD6FE]'
          }`}
        >
          {syncFeedback.type === 'success' ? (
            <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          ) : syncFeedback.type === 'error' ? (
            <div className="w-7 h-7 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-xl bg-indigo-100 text-[#7657F6] flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
          )}
          <span className="flex-1">{syncFeedback.message}</span>
        </div>
      )}

      {/* 2. NAVIGATION FILTER PILLS (For Quick Jump on Mobile/Desktop) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'all', label: 'كل الإعدادات', icon: Sliders },
          { id: 'account', label: 'الحساب والملف', icon: User },
          { id: 'sync', label: 'المزامنة والنسخ', icon: RefreshCw },
          { id: 'notif', label: 'التنبيهات والفوترة', icon: Bell },
          { id: 'language', label: 'اللغة والعرض', icon: Globe },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-black flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#17163D] text-white shadow-sm'
                  : 'bg-white text-[#74778F] hover:text-[#17163D] hover:bg-[#E8E7FF]/50 border border-[#E8E7FF]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#7657F6]' : 'text-[#74778F]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN: Main Configuration (8 cols on large screens) */}
        <div className="lg:col-span-8 space-y-5">
          {/* SECTION 1: TEACHER PROFILE & CENTER CARD */}
          {(activeSection === 'all' || activeSection === 'account') && (
            <div className="classy-card bg-white rounded-3xl p-5 sm:p-6 border border-[#E8E7FF] shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8E7FF]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#E8E7FF] text-[#7657F6] flex items-center justify-center font-bold shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-[#17163D]">بيانات المعلم والسنتر</h2>
                    <p className="text-[11px] text-[#74778F] font-medium">
                      تعديل بيانات الملف الشخصي، المادة الأساسية، والعملة الافتراضية
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#E8E7FF] text-[#7657F6] text-[10px] font-black">
                  الملف الشخصي
                </span>
              </div>

              {savedSuccess && (
                <div className="p-3.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-2xl text-xs font-black flex items-center gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>تم حفظ وتحديث بيانات الملف الشخصي بنجاح!</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs text-[#17163D]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-black text-[#74778F] mb-1.5 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#7657F6]" />
                      <span>اسم المعلم / اللقب *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="مثال: أستاذ أحمد محمود"
                      className="w-full bg-[#F6F7FC] border border-[#E8E7FF] focus:border-[#7657F6] focus:bg-white rounded-2xl p-3 text-xs sm:text-sm font-bold text-[#17163D] transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-black text-[#74778F] mb-1.5 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-[#7657F6]" />
                      <span>المادة الدراسية الأساسية *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="مثال: الرياضيات / الفيزياء"
                      className="w-full bg-[#F6F7FC] border border-[#E8E7FF] focus:border-[#7657F6] focus:bg-white rounded-2xl p-3 text-xs sm:text-sm font-bold text-[#17163D] transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block font-black text-[#74778F] mb-1.5 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-[#7657F6]" />
                      <span>اسم السنتر / القاعة / المدرسة</span>
                    </label>
                    <input
                      type="text"
                      value={centerOrSchool}
                      onChange={(e) => setCenterOrSchool(e.target.value)}
                      placeholder="مثال: سنتر الأوائل التعليمي - مدينة نصر"
                      className="w-full bg-[#F6F7FC] border border-[#E8E7FF] focus:border-[#7657F6] focus:bg-white rounded-2xl p-3 text-xs sm:text-sm font-bold text-[#17163D] transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-black text-[#74778F] mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#7657F6]" />
                      <span>رقم الهاتف / واتساب</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="010XXXXXXXX"
                      className="w-full bg-[#F6F7FC] border border-[#E8E7FF] focus:border-[#7657F6] focus:bg-white rounded-2xl p-3 text-xs sm:text-sm font-bold text-[#17163D] transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-black text-[#74778F] mb-1.5 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-[#7657F6]" />
                      <span>العملة الافتراضية للفواتير والحسابات</span>
                    </label>
                    <input
                      type="text"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      placeholder="ج.م أو EGP"
                      className="w-full bg-[#F6F7FC] border border-[#E8E7FF] focus:border-[#7657F6] focus:bg-white rounded-2xl p-3 text-xs sm:text-sm font-bold text-[#17163D] transition-all outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#17163D] via-[#403B9C] to-[#7657F6] hover:opacity-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer"
                >
                  <Save className="w-4 h-4 text-white" />
                  <span>حفظ البيانات وتحديث الملف</span>
                </button>
              </form>
            </div>
          )}

          {/* SECTION 2: CLOUD SYNCHRONIZATION & BACKUP ENGINE */}
          {(activeSection === 'all' || activeSection === 'sync') && (
            <div className="classy-card bg-white rounded-3xl p-5 sm:p-6 border border-[#E8E7FF] shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8E7FF] flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#E8E7FF] text-[#7657F6] flex items-center justify-center font-bold shrink-0">
                    <RefreshCw className={`w-5 h-5 ${autoSyncConfig.status === 'syncing' ? 'animate-spin text-[#7657F6]' : ''}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-black text-[#17163D]">
                        المزامنة السحابية والنسخ الاحتياطي
                      </h2>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          autoSyncConfig.frequency === 'off'
                            ? 'bg-slate-100 text-slate-700 border border-slate-200'
                            : !networkStatus.isOnline
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
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
                    <p className="text-[11px] text-[#74778F] font-medium mt-0.5">
                      مزامنة بيانات المستخدم تلقائياً مع السحابة واستقلالية تامة لحسابك
                    </p>
                  </div>
                </div>

                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[11px] font-black border shadow-2xs ${
                    networkStatus.isOnline
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {networkStatus.isOnline ? (
                    <>
                      <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{networkStatus.connectionType === 'wifi' ? 'متصل (Wi-Fi)' : 'متصل بالإنترنت'}</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                      <span>وضع عدم الاتصال (أوفلاين)</span>
                    </>
                  )}
                </div>
              </div>

              {/* Frequency Schedule Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#17163D] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#7657F6]" />
                    <span>جدول التحديث التلقائي (Sync Schedule):</span>
                  </label>
                  <span className="text-[10px] text-[#74778F] font-bold">يُحفظ الإعداد تلقائياً بشكل دائم</span>
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
                        className={`p-3 rounded-2xl border text-center transition-all active:scale-95 flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-[#17163D] border-[#17163D] text-white shadow-md font-black'
                            : 'bg-[#F6F7FC] hover:bg-[#E8E7FF] border-[#E8E7FF] text-[#17163D]'
                        }`}
                      >
                        <span className="text-xs font-black">{opt.label}</span>
                        <span className={`text-[9px] ${isSelected ? 'text-[#7657F6] font-bold' : 'text-[#74778F] font-medium'}`}>
                          {opt.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status and Last/Next Timestamps Grid */}
              <div className="p-4 bg-[#F6F7FC] border border-[#E8E7FF] rounded-2xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-[#E8E7FF]">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#7657F6]" />
                    <span className="font-black text-xs text-[#17163D]">حالة المزامنة الحالية:</span>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[11px] font-black ${syncStatusData.badgeClass}`}>
                    {syncStatusData.label}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-white border border-[#E8E7FF] shadow-xs">
                    <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-[#74778F] block font-bold text-[10px]">آخر مزامنة مكتملة:</span>
                      <span className="font-black text-[#17163D] text-xs">{formatSyncTimeArabic(lastSyncTime)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-white border border-[#E8E7FF] shadow-xs">
                    <Calendar className="w-4 h-4 text-[#7657F6] shrink-0" />
                    <div>
                      <span className="text-[#74778F] block font-bold text-[10px]">الموعد القادم للمزامنة:</span>
                      <span className="font-black text-[#17163D] text-xs">
                        {formatNextSyncTimeArabic(autoSyncConfig.nextSyncTime, autoSyncConfig.frequency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Sync Now + Backup + Restore */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                  className="py-3 px-3.5 rounded-2xl bg-[#17163D] hover:bg-[#2A2368] text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#7657F6]' : 'text-[#7657F6]'}`} />
                  <span>مزامنة الآن (Sync Now)</span>
                </button>

                <button
                  onClick={handleBackupNow}
                  disabled={isSyncing}
                  className="py-3 px-3.5 rounded-2xl bg-gradient-to-r from-[#403B9C] to-[#7657F6] hover:opacity-95 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير نسخة (.json)</span>
                </button>

                <button
                  onClick={handleRestoreFromAccount}
                  disabled={isSyncing}
                  className="py-3 px-3.5 rounded-2xl bg-[#F6F7FC] hover:bg-[#E8E7FF] border border-[#E8E7FF] text-[#17163D] font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <HardDriveDownload className="w-3.5 h-3.5 text-[#7657F6]" />
                  <span>استعادة من السحابة</span>
                </button>
              </div>

              {/* Synced Entities Pill Badges */}
              <div className="pt-3 border-t border-[#E8E7FF]">
                <span className="text-[10px] font-black text-[#74778F] block mb-2">
                  البيانات المشمولة في المزامنة والحفظ الدائم:
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#F6F7FC] text-[#17163D] border border-[#E8E7FF] text-[10px] font-bold"
                    >
                      <Check className="w-2.5 h-2.5 text-[#7657F6]" />
                      {entity}
                    </span>
                  ))}
                </div>
              </div>

              {/* File Import Field */}
              <div className="pt-2 border-t border-[#E8E7FF]">
                <label className="w-full py-3 px-4 rounded-2xl bg-[#F6F7FC] hover:bg-[#E8E7FF] border-2 border-dashed border-[#DDD6FE] text-[#17163D] font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer">
                  <Upload className="w-4 h-4 text-[#7657F6]" />
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
          )}

          {/* SECTION 3: SMART NOTIFICATIONS & BILLING REMINDERS */}
          {(activeSection === 'all' || activeSection === 'notif') && (
            <div className="classy-card bg-white rounded-3xl p-5 sm:p-6 border border-[#E8E7FF] shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8E7FF]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#E8E7FF] text-[#7657F6] flex items-center justify-center font-bold shrink-0">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-[#17163D]">
                      التنبيهات والإشعارات الذكية
                    </h2>
                    <p className="text-[11px] text-[#74778F] font-medium">
                      تخصيص قواعد استحقاق سداد الباقات، التنبيه المبكر، ومتابعة الحضور والغياب
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {/* Rule 1: Package Payment Due (Core Rule) */}
                <div className="p-3.5 rounded-2xl bg-[#F6F7FC] border border-[#E8E7FF] flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[#17163D]">
                        تنبيه استحقاق سداد الباقة عند اكتمال الحصص المحددة
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800">
                        نشط أساسي
                      </span>
                    </div>
                    <p className="text-[10px] text-[#74778F] font-medium">
                      يظهر التنبيه حصراً عند إتمام الطالب لعدد الحصص المسجلة بالباقة ديناميكياً ويختفي فور تسجيل السداد.
                    </p>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Rule 2: Early Warning Before Package Completion */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#E8E7FF] shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-black text-[#17163D]">
                        تنبيه مبكر قبل اكتمال الباقة (Early Warning)
                      </span>
                      <p className="text-[10px] text-[#74778F] font-medium">
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
                      <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#17163D]"></div>
                    </label>
                  </div>

                  {notifSettings.enableEarlyPackageWarning && (
                    <div className="pt-2.5 border-t border-[#E8E7FF] flex items-center justify-between gap-2 flex-wrap bg-[#F6F7FC] p-3 rounded-2xl">
                      <span className="text-xs font-black text-[#17163D]">
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
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#17163D] text-white shadow-xs'
                                  : 'bg-white border border-[#E8E7FF] text-[#17163D] hover:bg-[#E8E7FF]'
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
                <div className="p-3.5 rounded-2xl bg-white border border-[#E8E7FF] shadow-xs flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-[#17163D]">
                      تنبيهات مستحقات السداد والديون المتبقية
                    </span>
                    <p className="text-[10px] text-[#74778F] font-medium">
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
                    <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#17163D]"></div>
                  </label>
                </div>

                {/* Rule 4: Unrecorded Attendance Reminders */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#E8E7FF] shadow-xs flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-[#17163D]">
                      تنبيهات رصد حضور الحصص المجدولة
                    </span>
                    <p className="text-[10px] text-[#74778F] font-medium">
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
                    <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#17163D]"></div>
                  </label>
                </div>

                {/* Rule 5: Repeated Absence Alerts */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#E8E7FF] shadow-xs flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-[#17163D]">
                      تنبيهات الغياب المتكرر (حصتان متتاليتان)
                    </span>
                    <p className="text-[10px] text-[#74778F] font-medium">
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
                    <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#17163D]"></div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Account, Security, Language & Safety (4 cols on large screens) */}
        <div className="lg:col-span-4 space-y-5">
          {/* 1. ACCOUNT & AUTHENTICATION CARD */}
          {(activeSection === 'all' || activeSection === 'account') && (
            <div className="classy-card bg-white rounded-3xl p-5 border border-[#E8E7FF] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#17163D] to-[#403B9C] text-white flex items-center justify-center font-black text-lg shadow-sm">
                    {currentUser?.name?.[0] || teacherProfile.name?.[0] || 'ك'}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs sm:text-sm font-black text-[#17163D]">
                        {currentUser?.name || teacherProfile.name || 'حساب المعلم'}
                      </p>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-black border border-emerald-200">
                        معتمد
                      </span>
                    </div>
                    <p className="text-[11px] text-[#74778F] font-medium flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3 text-[#74778F]" />
                      <span className="truncate max-w-[170px]">{currentUser?.email || 'teacher@example.com'}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={() => {
                  if (confirm('هل ترغب في تسجيل الخروج من الحساب؟ ستبقى جميع بياناتك محفوظة بأمان.')) {
                    onLogout();
                  }
                }}
                className="w-full py-2.5 px-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-2xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج من الحساب</span>
              </button>

              {/* Change Password Collapsible */}
              <div className="pt-3 border-t border-[#E8E7FF]">
                {!isChangingPassword ? (
                  <button
                    type="button"
                    onClick={() => setIsChangingPassword(true)}
                    className="text-xs font-black text-[#7657F6] hover:text-[#403B9C] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#7657F6]" />
                    <span>تغيير كلمة المرور الخاصة بالحساب</span>
                  </button>
                ) : (
                  <form onSubmit={handleUpdatePassword} className="space-y-3 pt-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-[#17163D] flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-[#7657F6]" />
                        تغيير كلمة المرور
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsChangingPassword(false);
                          setPassMessage(null);
                        }}
                        className="text-[11px] text-[#74778F] font-black hover:text-[#17163D] cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>

                    {passMessage && (
                      <div
                        className={`p-2.5 rounded-2xl text-xs font-black flex items-center gap-1.5 ${
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

                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-black text-[#74778F] mb-1">الحالية</label>
                        <input
                          type="password"
                          required
                          value={currentPass}
                          onChange={(e) => setCurrentPass(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl p-2.5 text-xs font-bold text-[#17163D] focus:outline-none focus:border-[#7657F6]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-[#74778F] mb-1">الجديدة</label>
                        <input
                          type="password"
                          required
                          value={newPass}
                          onChange={(e) => setNewPass(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl p-2.5 text-xs font-bold text-[#17163D] focus:outline-none focus:border-[#7657F6]"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-2xl bg-[#17163D] hover:bg-[#2A2368] text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-98 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5 text-[#7657F6]" />
                      <span>حفظ كلمة المرور الجديدة</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* 2. LANGUAGE SELECTOR CARD */}
          {(activeSection === 'all' || activeSection === 'language') && (
            <div className="classy-card bg-white rounded-3xl p-5 border border-[#E8E7FF] shadow-xs space-y-3.5">
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
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'ar' as Language, title: 'العربية', sub: 'Arabic (RTL)', flag: '🇪🇬' },
                  { id: 'en-GB' as Language, title: 'English (UK)', sub: 'British', flag: '🇬🇧' },
                  { id: 'en-US' as Language, title: 'English (US)', sub: 'American', flag: '🇺🇸' },
                ].map((langOpt) => {
                  const isSelected = language === langOpt.id;
                  return (
                    <button
                      key={langOpt.id}
                      type="button"
                      onClick={() => setLanguage(langOpt.id)}
                      className={`p-2.5 rounded-2xl border text-center transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        isSelected
                          ? 'bg-[#17163D] border-[#17163D] text-white shadow-sm font-bold'
                          : 'bg-[#F6F7FC] hover:bg-[#E8E7FF] border-[#E8E7FF] text-[#17163D]'
                      }`}
                    >
                      <span className="text-base">{langOpt.flag}</span>
                      <span className="text-[11px] font-black leading-tight">{langOpt.title}</span>
                      <span className={`text-[8px] ${isSelected ? 'text-[#7657F6]' : 'text-[#74778F] font-bold'}`}>
                        {langOpt.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. DANGER ZONE: DATA MANAGEMENT & RESET */}
          <div className="classy-card bg-white rounded-3xl p-5 border border-rose-100 shadow-xs space-y-3">
            <h2 className="text-xs font-black text-rose-600 flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span>إعادة ضبط البيانات المحلية</span>
            </h2>
            <p className="text-[11px] text-[#74778F] font-medium leading-relaxed">
              مسح السجلات المحلية والبدء من جديد. لن تفقد النسخ الاحتياطية المصدرة أو المتزامنة مع حسابك.
            </p>

            <button
              onClick={handleClearAll}
              className="w-full py-2.5 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>مسح البيانات المحلية الحالية</span>
            </button>
          </div>
        </div>
      </div>

      {/* App Info Footer */}
      <div className="text-center text-xs text-[#74778F] space-y-1 pt-4 pb-2 border-t border-[#E8E7FF]">
        <div className="flex items-center justify-center gap-1.5 font-black text-[#17163D]">
          <Sparkles className="w-3.5 h-3.5 text-[#7657F6]" />
          <span>Classy — The Teacher Operating System</span>
        </div>
        <p className="font-medium text-[11px]">
          مزامنة سحابية آمنة • أوفلاين بالكامل • استقلالية تامة لحسابات المعلمين
        </p>
      </div>
    </div>
  );
};
