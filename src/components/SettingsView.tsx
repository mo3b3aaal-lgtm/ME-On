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
} from 'lucide-react';
import { TeacherProfile, UserAccount, AutoSyncFrequency, AutoSyncConfig } from '../types';
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
import { NetworkDiagnosticsModal } from './NetworkDiagnosticsModal';

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

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

  const handleClearAll = () => {
    if (
      confirm(
        'تحذير: هل أنت متأكد تماماً من حذف جميع بيانات التطبيق لهذا الحساب؟ يمكنك لاحقاً استعادة بياناتك إذا كانت متزامنة مسبقاً.'
      )
    ) {
      db.clearAllData();
      onDataReset();
      setSyncFeedback({ type: 'info', message: 'تم مسح البيانات المحلية.' });
      setTimeout(() => setSyncFeedback(null), 3000);
    }
  };

  const { language, setLanguage, isRTL, t } = useTranslation();

  return (
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-4 text-[#2D332A] pb-24" dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* View Header */}
      <div>
        <h1 className="text-xl font-bold font-serif text-[#2D332A] tracking-tight">
          {t('settingsTitle')}
        </h1>
        <p className="text-xs text-[#8A9187] font-semibold mt-0.5">
          {t('settingsSubtitle')}
        </p>
      </div>

      {/* Global Sync Notification / Alert */}
      {syncFeedback && (
        <div
          className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all shadow-xs ${
            syncFeedback.type === 'success'
              ? 'bg-[#748C70]/15 text-[#748C70] border border-[#748C70]/30'
              : syncFeedback.type === 'error'
              ? 'bg-[#FCF6F4] text-[#C97C5D] border border-[#C97C5D]/30'
              : 'bg-[#5C788A]/15 text-[#5C788A] border border-[#5C788A]/30'
          }`}
        >
          {syncFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : syncFeedback.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
          )}
          <span>{syncFeedback.message}</span>
        </div>
      )}

      {/* LANGUAGE SELECTOR CARD (اللغة وخيارات العرض) */}
      <div className="p-4 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#E8E2D6]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#5C788A]/15 text-[#5C788A] flex items-center justify-center border border-[#5C788A]/30 shadow-xs">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-[#2D332A]">{t('languageSection')}</h2>
              <p className="text-[10px] sm:text-[11px] text-[#8A9187] font-semibold">
                {t('languageDesc')}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#5C788A]/15 text-[#5C788A]">
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
                className={`p-2.5 rounded-xl border text-center transition-all active:scale-95 flex flex-col items-center justify-center gap-1 cursor-pointer ${
                  isSelected
                    ? 'bg-[#5C788A] border-[#5C788A] text-white shadow-xs font-bold'
                    : 'bg-[#F9F7F2] hover:bg-[#F2ECE1] border-[#E8E2D6] text-[#2D332A]'
                }`}
              >
                <span className="text-base">{langOpt.flag}</span>
                <span className="text-xs font-bold leading-tight">{langOpt.title}</span>
                <span className={`text-[9px] ${isSelected ? 'text-white/80' : 'text-[#8A9187]'}`}>
                  {langOpt.sub}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. AUTO-SYNC & SCHEDULING (المزامنة التلقائية والنسخ الاحتياطي) */}
      <div className="p-4 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-4">
        {/* Section Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E8E2D6] flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#748C70]/15 text-[#748C70] flex items-center justify-center border border-[#748C70]/30 shadow-xs">
              <RefreshCw className={`w-4 h-4 ${autoSyncConfig.status === 'syncing' ? 'animate-spin text-[#5C788A]' : 'text-[#748C70]'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-bold text-[#2D332A]">المزامنة التلقائية والنسخ الاحتياطي</h2>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    autoSyncConfig.frequency === 'off'
                      ? 'bg-[#8A9187]/15 text-[#6B7567] border border-[#8A9187]/30'
                      : !networkStatus.isOnline
                      ? 'bg-[#C97C5D]/15 text-[#C97C5D] border border-[#C97C5D]/30'
                      : 'bg-[#748C70]/15 text-[#748C70] border border-[#748C70]/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      autoSyncConfig.frequency === 'off'
                        ? 'bg-[#8A9187]'
                        : !networkStatus.isOnline
                        ? 'bg-[#C97C5D]'
                        : 'bg-[#748C70] animate-pulse'
                    }`}
                  ></span>
                  {autoSyncConfig.frequency === 'off'
                    ? 'المزامنة متوقفة'
                    : !networkStatus.deviceConnected
                    ? 'مؤجلة (دون اتصال)'
                    : !networkStatus.apiReachable
                    ? 'مؤجلة (السيرفر غير متاح)'
                    : 'نشطة ومجدولة'}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#8A9187] font-semibold mt-0.5">
                مزامنة بيانات المستخدم تلقائياً مع السحابة حسب الفترة المحددة مع استقلالية تامة لكل حساب
              </p>
            </div>
          </div>

          {/* Connectivity Status Pill & Diagnostics Button */}
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border shadow-xs ${
                networkStatus.isOnline
                  ? 'bg-[#748C70]/10 text-[#5E755A] border-[#748C70]/25'
                  : networkStatus.deviceConnected && !networkStatus.apiReachable
                  ? 'bg-[#5C788A]/10 text-[#5C788A] border-[#5C788A]/25'
                  : 'bg-[#C97C5D]/10 text-[#C97C5D] border-[#C97C5D]/25'
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
                  <Activity className="w-3.5 h-3.5 text-[#5C788A]" />
                  <span>متصل بالشبكة (السيرفر غير متاح)</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-[#C97C5D]" />
                  <span>وضع عدم الاتصال (أوفلاين)</span>
                </>
              )}
            </div>

            <button
              id="open_network_diagnostics_button"
              type="button"
              onClick={() => setIsDiagnosticsOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-[11px] font-mono font-medium transition active:scale-95 shadow-xs"
              title="تشخيص اتصال السيرفر المباشر"
            >
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span>تشخيص السيرفر (Android Runtime)</span>
            </button>
          </div>
        </div>

        {/* Frequency Options Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#2D332A] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#5C788A]" />
              <span>فترة المزامنة التلقائية (Sync Schedule):</span>
            </label>
            <span className="text-[10px] text-[#8A9187] font-semibold">يُحفظ الإعداد تلقائياً بشكل دائم</span>
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
                  className={`p-2.5 rounded-xl border text-center transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[#748C70] border-[#748C70] text-white shadow-xs font-bold'
                      : 'bg-[#F9F7F2] hover:bg-[#F2ECE1] border-[#E8E2D6] text-[#2D332A]'
                  }`}
                >
                  <span className="text-xs font-bold">{opt.label}</span>
                  <span className={`text-[9px] ${isSelected ? 'text-white/80' : 'text-[#8A9187]'}`}>
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sync Status, Last Sync & Next Sync Times */}
        <div className="p-3.5 bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl space-y-2.5 text-xs">
          {/* Current Sync Status */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#E8E2D6]">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#5C788A]" />
              <span className="font-bold text-[#434B3E]">حالة المزامنة الحالية:</span>
            </div>
            <div
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                formatSyncStatusArabic(autoSyncConfig.status, networkStatus.isOnline, networkStatus.statusReason).badgeClass
              }`}
            >
              {formatSyncStatusArabic(autoSyncConfig.status, networkStatus.isOnline, networkStatus.statusReason).label}
            </div>
          </div>

          {/* Last Sync & Next Sync Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            {/* Last Sync */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-[#E8E2D6]/80 shadow-2xs">
              <Clock className="w-4 h-4 text-[#748C70] shrink-0" />
              <div>
                <span className="text-[#8A9187] block font-semibold">آخر مزامنة (Last Sync):</span>
                <span className="font-bold text-[#2D332A] text-xs">{formatSyncTimeArabic(lastSyncTime)}</span>
              </div>
            </div>

            {/* Next Sync */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-[#E8E2D6]/80 shadow-2xs">
              <Calendar className="w-4 h-4 text-[#5C788A] shrink-0" />
              <div>
                <span className="text-[#8A9187] block font-semibold">موعد المزامنة القادمة (Next Sync):</span>
                <span className="font-bold text-[#2D332A] text-xs">
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
            className="py-2.5 px-3 rounded-xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>مزامنة الآن (Sync Now)</span>
          </button>

          {/* 2. Backup Now (.json export) */}
          <button
            onClick={handleBackupNow}
            disabled={isSyncing}
            className="py-2.5 px-3 rounded-xl bg-[#5C788A] hover:bg-[#475E6C] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير نسخة احتياطية (.json)</span>
          </button>

          {/* 3. Restore Data */}
          <button
            onClick={handleRestoreFromAccount}
            disabled={isSyncing}
            className="py-2.5 px-3 rounded-xl bg-white hover:bg-[#F2ECE1] border border-[#E8E2D6] text-[#2D332A] font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <HardDriveDownload className="w-3.5 h-3.5 text-[#5C788A]" />
            <span>استعادة البيانات السحابية</span>
          </button>
        </div>

        {/* Synced Entities Pill Badges */}
        <div className="pt-2 border-t border-[#E8E2D6]">
          <span className="text-[10px] font-bold text-[#8A9187] block mb-1.5">
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
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F2ECE1] text-[#434B3E] text-[10px] font-semibold"
              >
                <Check className="w-2.5 h-2.5 text-[#748C70]" />
                {entity}
              </span>
            ))}
          </div>
        </div>

        {/* Secondary Import File Option */}
        <div className="pt-2 border-t border-[#E8E2D6]">
          <label className="w-full py-2 px-3 rounded-xl bg-[#F9F7F2] hover:bg-[#F2ECE1] border border-dashed border-[#8A9187]/40 text-[#434B3E] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-[#5C788A]" />
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

      {/* 2. ACCOUNT INFO & LOGOUT CARD */}
      <div className="p-4 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#748C70]/15 text-[#748C70] flex items-center justify-center font-bold font-serif text-base border border-[#748C70]/30">
              {currentUser?.name?.[0] || teacherProfile.name?.[0] || 'م'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-[#2D332A]">
                  {currentUser?.name || teacherProfile.name || 'حساب المعلم'}
                </p>
                <span className="px-1.5 py-0.5 rounded-md bg-[#748C70]/15 text-[#748C70] text-[9px] font-bold">
                  حساب معتمد
                </span>
              </div>
              <p className="text-[11px] text-[#8A9187] flex items-center gap-1">
                <Mail className="w-3 h-3 text-[#8A9187]" />
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
            className="py-2 px-3 rounded-xl bg-[#FCF6F4] hover:bg-[#F8ECE8] text-[#C97C5D] border border-[#C97C5D]/30 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>

        {/* Change Password Collapsible */}
        <div className="pt-2 border-t border-[#E8E2D6]">
          {!isChangingPassword ? (
            <button
              type="button"
              onClick={() => setIsChangingPassword(true)}
              className="text-xs font-bold text-[#5C788A] hover:text-[#415562] flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>تغيير كلمة المرور الخاصة بالحساب</span>
            </button>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-2.5 pt-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#2D332A] flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-[#D49B4B]" />
                  تغيير كلمة المرور
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPassMessage(null);
                  }}
                  className="text-[11px] text-[#8A9187] font-bold hover:text-[#2D332A]"
                >
                  إلغاء
                </button>
              </div>

              {passMessage && (
                <div
                  className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                    passMessage.type === 'success'
                      ? 'bg-[#748C70]/15 text-[#748C70]'
                      : 'bg-[#FCF6F4] text-[#C97C5D]'
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
                  <label className="block text-[11px] font-bold text-[#6B7567] mb-0.5">الحالية</label>
                  <input
                    type="password"
                    required
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7567] mb-0.5">الجديدة</label>
                  <input
                    type="password"
                    required
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-[#5C788A] hover:bg-[#475E6C] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                <span>حفظ كلمة المرور الجديدة</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 3. TEACHER PROFILE CARD */}
      <div className="p-4 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-3.5">
        <h2 className="text-xs font-bold text-[#2D332A] flex items-center gap-1.5">
          <User className="w-4 h-4 text-[#748C70]" />
          <span>تعديل بيانات المعلم والسنتر</span>
        </h2>

        {savedSuccess && (
          <div className="p-2.5 bg-[#748C70]/15 text-[#748C70] border border-[#748C70]/30 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>تم حفظ وتحديث بيانات الملف الشخصي بنجاح!</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-3 text-xs text-[#434B3E]">
          <div>
            <label className="block font-bold text-[#6B7567] mb-1">اسم المعلم / اللقب *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-[#6B7567] mb-1">المادة الدراسية الأساسية *</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#6B7567] mb-1">رقم الهاتف / واتساب</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#6B7567] mb-1">اسم السنتر / المدرسة / القاعة</label>
            <input
              type="text"
              value={centerOrSchool}
              onChange={(e) => setCenterOrSchool(e.target.value)}
              placeholder="مثال: سنتر الأوائل التعليمي - مدينة نصر"
              className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.99]"
          >
            <Save className="w-4 h-4" />
            <span>حفظ البيانات وتحديث الحساب</span>
          </button>
        </form>
      </div>

      {/* 4. DANGER ZONE: CLEAR LOCAL DATA */}
      <div className="p-4 bg-white border border-[#C97C5D]/30 rounded-2xl shadow-sm space-y-2.5">
        <h2 className="text-xs font-bold text-[#C97C5D] flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" />
          <span>إعادة ضبط البيانات المحلية</span>
        </h2>
        <p className="text-[11px] text-[#8A9187]">
          مسح السجلات المحلية والبدء من جديد. لن تفقد النسخ الاحتياطية المتزامنة مع حسابك.
        </p>

        <button
          onClick={handleClearAll}
          className="py-2 px-3 rounded-xl bg-[#FCF6F4] hover:bg-[#F8ECE8] text-[#C97C5D] border border-[#C97C5D]/40 font-bold text-xs flex items-center gap-1.5 transition-all"
        >
          <Trash2 className="w-4 h-4" />
          <span>مسح البيانات المحلية الحالية</span>
        </button>
      </div>

      {/* App Info Footer */}
      <div className="text-center text-[11px] text-[#8A9187] space-y-0.5 pt-2">
        <p className="font-bold text-[#2D332A]">Teacher Manager v2.0</p>
        <p>مزامنة آمنة للحسابات • يدعم العمل بدون إنترنت والنسخ السحابي</p>
      </div>

      {/* Network Diagnostics Modal */}
      <NetworkDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />
    </div>
  );
};
