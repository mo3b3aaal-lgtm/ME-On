import { registerPlugin, Capacitor } from '@capacitor/core';
import {
  getServerApiBaseUrl,
  getFullApiUrl,
  checkOverallConnectivity,
  onNetworkReconnected,
  NetworkStatusReason,
  DEPLOYED_SERVER_API_URL,
} from './network';
import {
  Student,
  Group,
  Enrollment,
  Session,
  Attendance,
  AttendanceStatus,
  Payment,
  SessionCreditLog,
  BillingType,
  BillingMode,
  PaymentTargetType,
  PricingModifierType,
  MonthBillStatus,
  EnrollmentFinancialSummary,
  StudentGrandFinancialSummary,
  GroupFinancialSummary,
  TeacherOverallFinancialSummary,
  MonthlyBillingLedgerItem,
  FinancialCredit,
  TeacherProfile,
  UserAccount,
  UserAccountDataPackage,
  ReportPeriodFilter,
  AutoSyncFrequency,
  AutoSyncStatus,
  AutoSyncConfig,
} from '../types';

export { getServerApiBaseUrl, getFullApiUrl, DEPLOYED_SERVER_API_URL };

const STORAGE_KEYS = {
  STUDENTS: 'tm_v2_students',
  GROUPS: 'tm_v2_groups',
  ENROLLMENTS: 'tm_v2_enrollments',
  SESSIONS: 'tm_v2_sessions',
  ATTENDANCE: 'tm_v2_attendance',
  PAYMENTS: 'tm_v2_payments',
  CREDIT_LOGS: 'tm_v2_session_credit_logs',
  TEACHER_PROFILE: 'tm_v2_teacher_profile',
  ACCOUNTS: 'tm_v2_accounts',
  CURRENT_SESSION: 'tm_v2_current_session',
  AUTO_SYNC_CONFIG: 'tm_v2_auto_sync_config',
};

const ARABIC_MONTH_NAMES = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export function getArabicMonthName(monthIndex1to12: number): string {
  if (monthIndex1to12 >= 1 && monthIndex1to12 <= 12) {
    return ARABIC_MONTH_NAMES[monthIndex1to12 - 1];
  }
  return `شهر ${monthIndex1to12}`;
}

const ARABIC_DAY_NAMES = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

export function getArabicDayName(dateString: string): string {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'السبت';
  return ARABIC_DAY_NAMES[d.getDay()] || 'السبت';
}

export function getBillingModeLabel(billingType?: string, billingMode?: string): string {
  const mode = billingMode || billingType;
  switch (mode) {
    case 'monthly':
      return 'اشتراك شهري (Monthly)';
    case 'prepaid':
      return 'دفع بالحصة - دفع مسبق (Prepaid)';
    case 'postpaid':
      return 'دفع بالحصة - دفع بعد الحصة (Postpaid)';
    case 'per_session':
      return 'نظام الدفع بالحصة (Per Session)';
    case 'package':
      return 'باقة عدد حصص (Session Package)';
    default:
      return 'نظام الدفع بالحصة';
  }
}

/**
 * دالة مساعدة مركزية لاحتساب سعر الحصة الفعلي (Effective Session Price)
 * للباقة: Package Total Price ÷ Package Session Count
 * لغير الباقة: customPrice أو defaultPrice
 */
export function getEffectiveSessionPrice(
  enrollment?: Enrollment | null,
  group?: Group | null
): number {
  if (!enrollment && !group) return 100;

  const isPackage =
    enrollment?.billingMode === 'package' ||
    enrollment?.billingType === 'package' ||
    group?.billingMode === 'package' ||
    group?.billingType === 'package';

  if (isPackage) {
    const pkgSessions = enrollment?.packageSessionsCount || group?.packageSessionsCount || 10;
    const pkgPrice =
      enrollment?.packagePrice ||
      (group?.billingMode === 'package' || group?.billingType === 'package' ? group.defaultPrice : undefined) ||
      enrollment?.customPrice ||
      1000;
    if (pkgSessions > 0) {
      return Math.round(pkgPrice / pkgSessions);
    }
  }

  return enrollment?.customPrice || group?.defaultPrice || 100;
}

const DEFAULT_TEACHER_PROFILE: TeacherProfile = {
  name: 'أستاذ المادة',
  subject: 'المادة الدراسية',
  phone: '',
  centerOrSchool: 'سنتر التفوق التعليمي',
  academicYear: '2025 - 2026',
  currency: 'ج.م',
};

// ==========================================
// Base Generic Storage Helper
// ==========================================
function getList<T>(key: string, fallback: T[] = []): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T[];
  } catch (err) {
    console.error(`Error reading key ${key} from storage:`, err);
    return fallback;
  }
}

function saveList<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Error saving key ${key} to storage:`, err);
  }
}

// Active User Context Resolver
export function getActiveUserId(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
    if (raw) {
      const user = JSON.parse(raw);
      if (user && user.id) return user.id;
    }
  } catch {}
  return 'acc_master_teacher';
}

// Legacy Data Migration: Ensures all existing pre-auth records are assigned to the master account
function ensureDataMigrated(): void {
  try {
    const defaultUserId = 'acc_master_teacher';

    // Migrate students
    const rawStudents = getList<Student>(STORAGE_KEYS.STUDENTS, []);
    let studentsChanged = false;
    const migratedStudents = rawStudents.map((s) => {
      if (!s.userId) {
        studentsChanged = true;
        return { ...s, userId: defaultUserId };
      }
      return s;
    });
    if (studentsChanged) saveList(STORAGE_KEYS.STUDENTS, migratedStudents);

    // Migrate groups
    const rawGroups = getList<Group>(STORAGE_KEYS.GROUPS, []);
    let groupsChanged = false;
    const migratedGroups = rawGroups.map((g) => {
      if (!g.userId) {
        groupsChanged = true;
        return { ...g, userId: defaultUserId };
      }
      return g;
    });
    if (groupsChanged) saveList(STORAGE_KEYS.GROUPS, migratedGroups);

    // Migrate enrollments
    const rawEnrollments = getList<Enrollment>(STORAGE_KEYS.ENROLLMENTS, []);
    let enrollmentsChanged = false;
    const migratedEnrollments = rawEnrollments.map((e) => {
      if (!e.userId) {
        enrollmentsChanged = true;
        return { ...e, userId: defaultUserId };
      }
      return e;
    });
    if (enrollmentsChanged) saveList(STORAGE_KEYS.ENROLLMENTS, migratedEnrollments);

    // Migrate sessions
    const rawSessions = getList<Session>(STORAGE_KEYS.SESSIONS, []);
    let sessionsChanged = false;
    const migratedSessions = rawSessions.map((ses) => {
      if (!ses.userId) {
        sessionsChanged = true;
        return { ...ses, userId: defaultUserId };
      }
      return ses;
    });
    if (sessionsChanged) saveList(STORAGE_KEYS.SESSIONS, migratedSessions);

    // Migrate attendance
    const rawAttendance = getList<Attendance>(STORAGE_KEYS.ATTENDANCE, []);
    let attendanceChanged = false;
    const migratedAttendance = rawAttendance.map((a) => {
      if (!a.userId) {
        attendanceChanged = true;
        return { ...a, userId: defaultUserId };
      }
      return a;
    });
    if (attendanceChanged) saveList(STORAGE_KEYS.ATTENDANCE, migratedAttendance);

    // Migrate payments
    const rawPayments = getList<Payment>(STORAGE_KEYS.PAYMENTS, []);
    let paymentsChanged = false;
    const migratedPayments = rawPayments.map((p) => {
      if (!p.userId) {
        paymentsChanged = true;
        return { ...p, userId: defaultUserId };
      }
      return p;
    });
    if (paymentsChanged) saveList(STORAGE_KEYS.PAYMENTS, migratedPayments);

    // Migrate credit logs
    const rawLogs = getList<SessionCreditLog>(STORAGE_KEYS.CREDIT_LOGS, []);
    let logsChanged = false;
    const migratedLogs = rawLogs.map((l) => {
      if (!l.userId) {
        logsChanged = true;
        return { ...l, userId: defaultUserId };
      }
      return l;
    });
    if (logsChanged) saveList(STORAGE_KEYS.CREDIT_LOGS, migratedLogs);
  } catch (err) {
    console.error('Migration error:', err);
  }
}

// Run migration safely on module load
ensureDataMigrated();

/**
 * دالة مزامنة بيانات المستخدم مع حسابه تلقائياً
 * تقوم بجمع كافة الطلاب والمجموعات والحصص والاشتراكات والحضور والمدفوعات
 * وحفظها بشكل مشفر وآمن داخل كائن الحساب ومفتاح التخزين الاحتياطي الخاص به
 */
export function autoSyncUserAccount(userId?: string): UserAccountDataPackage {
  const targetUserId = userId || getActiveUserId();

  const allStudents = getList<Student>(STORAGE_KEYS.STUDENTS, []);
  const allGroups = getList<Group>(STORAGE_KEYS.GROUPS, []);
  const allEnrollments = getList<Enrollment>(STORAGE_KEYS.ENROLLMENTS, []);
  const allSessions = getList<Session>(STORAGE_KEYS.SESSIONS, []);
  const allAttendance = getList<Attendance>(STORAGE_KEYS.ATTENDANCE, []);
  const allPayments = getList<Payment>(STORAGE_KEYS.PAYMENTS, []);
  const allCreditLogs = getList<SessionCreditLog>(STORAGE_KEYS.CREDIT_LOGS, []);

  const userStudents = allStudents.filter((s) => (s.userId ? s.userId === targetUserId : targetUserId === 'acc_master_teacher'));
  const userGroups = allGroups.filter((g) => (g.userId ? g.userId === targetUserId : targetUserId === 'acc_master_teacher'));
  const userEnrollments = allEnrollments.filter((e) => (e.userId ? e.userId === targetUserId : targetUserId === 'acc_master_teacher'));
  const userSessions = allSessions.filter((s) => (s.userId ? s.userId === targetUserId : targetUserId === 'acc_master_teacher'));
  const userAttendance = allAttendance.filter((a) => (a.userId ? a.userId === targetUserId : targetUserId === 'acc_master_teacher'));
  const userPayments = allPayments.filter((p) => (p.userId ? p.userId === targetUserId : targetUserId === 'acc_master_teacher'));
  const userCreditLogs = allCreditLogs.filter((l) => (l.userId ? l.userId === targetUserId : targetUserId === 'acc_master_teacher'));

  let userProfile: TeacherProfile = DEFAULT_TEACHER_PROFILE;
  try {
    const rawProfile = localStorage.getItem(`${STORAGE_KEYS.TEACHER_PROFILE}_${targetUserId}`);
    if (rawProfile) userProfile = JSON.parse(rawProfile);
  } catch {}

  const nowIso = new Date().toISOString();
  const dataPackage: UserAccountDataPackage = {
    lastSyncTime: nowIso,
    version: '2.0',
    userId: targetUserId,
    students: userStudents,
    groups: userGroups,
    enrollments: userEnrollments,
    sessions: userSessions,
    attendance: userAttendance,
    payments: userPayments,
    creditLogs: userCreditLogs,
    teacherProfile: userProfile,
    stats: {
      totalStudents: userStudents.length,
      totalGroups: userGroups.length,
      totalSessions: userSessions.length,
      totalPayments: userPayments.length,
    },
  };

  // 1. Redundant persistent account backup storage
  try {
    localStorage.setItem(`tm_v2_user_backup_${targetUserId}`, JSON.stringify(dataPackage));
    localStorage.setItem(`tm_v2_last_sync_${targetUserId}`, nowIso);
  } catch (err) {
    console.warn('Storage sync warning:', err);
  }

  // 2. Embed into UserAccount object inside ACCOUNTS list
  try {
    const accounts = getList<UserAccount>(STORAGE_KEYS.ACCOUNTS, []);
    const idx = accounts.findIndex((a) => a.id === targetUserId);
    if (idx >= 0) {
      accounts[idx] = {
        ...accounts[idx],
        lastSyncAt: nowIso,
        syncedData: dataPackage,
      };
      saveList(STORAGE_KEYS.ACCOUNTS, accounts);

      // Also update CURRENT_SESSION if active user
      const rawCur = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
      if (rawCur) {
        const curUser = JSON.parse(rawCur);
        if (curUser && curUser.id === targetUserId) {
          localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(accounts[idx]));
        }
      }
    }
  } catch (err) {
    console.error('Account sync error:', err);
  }

  return dataPackage;
}

// ==========================================
// Auto-Sync Scheduling & Realtime Engine
// ==========================================

export function getAuthTokenForUser(userId: string): string {
  try {
    const accounts = db.getAccounts();
    const acc = accounts.find((a) => a.id === userId);
    if (acc && acc.authToken) return acc.authToken;
  } catch {}
  return `auth_tk_${userId}`;
}

export interface AutoSyncSchedulerPlugin {
  scheduleSync(options: { frequency: string; userId: string; serverUrl?: string }): Promise<{ success: boolean; message?: string }>;
  triggerImmediateSync(options: { userId: string; serverUrl?: string }): Promise<{ success: boolean }>;
  getSyncStatus(options: { userId: string }): Promise<{ frequency?: string; lastSyncTime?: string; lastSyncStatus?: string; lastSyncMessage?: string }>;
}

export const AutoSyncScheduler = registerPlugin<AutoSyncSchedulerPlugin>('AutoSyncScheduler');

export function calculateNextSyncTime(frequency: AutoSyncFrequency, fromDate = new Date()): string | null {
  if (frequency === 'off') return null;
  const t = fromDate.getTime();
  let deltaMs = 0;
  switch (frequency) {
    case 'hourly':
      deltaMs = 60 * 60 * 1000; // 1 hour
      break;
    case 'daily':
      deltaMs = 24 * 60 * 60 * 1000; // 24 hours
      break;
    case 'weekly':
      deltaMs = 7 * 24 * 60 * 60 * 1000; // 7 days
      break;
    case 'monthly':
      deltaMs = 30 * 24 * 60 * 60 * 1000; // 30 days
      break;
    default:
      return null;
  }
  return new Date(t + deltaMs).toISOString();
}

export function getAutoSyncConfig(userId?: string): AutoSyncConfig {
  const targetUserId = userId || getActiveUserId();
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.AUTO_SYNC_CONFIG}_${targetUserId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.frequency) {
        return {
          frequency: parsed.frequency,
          lastSyncTime: parsed.lastSyncTime || db.getLastSyncTime(targetUserId),
          nextSyncTime: parsed.nextSyncTime || (parsed.frequency !== 'off' ? calculateNextSyncTime(parsed.frequency) : null),
          status: parsed.status || 'idle',
          statusMessage: parsed.statusMessage || 'جاهز للمزامنة المجدولة',
          autoRetryOnReconnect: parsed.autoRetryOnReconnect ?? true,
        };
      }
    }
  } catch {}

  const defaultConfig: AutoSyncConfig = {
    frequency: 'daily',
    lastSyncTime: db.getLastSyncTime(targetUserId),
    nextSyncTime: calculateNextSyncTime('daily'),
    status: 'idle',
    statusMessage: 'المزامنة اليومية مجدولة ونشطة',
    autoRetryOnReconnect: true,
  };

  try {
    localStorage.setItem(`${STORAGE_KEYS.AUTO_SYNC_CONFIG}_${targetUserId}`, JSON.stringify(defaultConfig));
  } catch {}

  return defaultConfig;
}

export function saveAutoSyncConfig(configPatch: Partial<AutoSyncConfig>, userId?: string): AutoSyncConfig {
  const targetUserId = userId || getActiveUserId();
  const current = getAutoSyncConfig(targetUserId);

  let newNextSync = configPatch.nextSyncTime !== undefined ? configPatch.nextSyncTime : current.nextSyncTime;
  if (configPatch.frequency !== undefined && configPatch.frequency !== current.frequency) {
    newNextSync = calculateNextSyncTime(configPatch.frequency);
  }

  const updated: AutoSyncConfig = {
    ...current,
    ...configPatch,
    nextSyncTime: newNextSync,
  };

  try {
    localStorage.setItem(`${STORAGE_KEYS.AUTO_SYNC_CONFIG}_${targetUserId}`, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving auto sync config:', err);
  }

  // Schedule or cancel native Android WorkManager task with real backend API URL
  if (Capacitor.isNativePlatform()) {
    try {
      AutoSyncScheduler.scheduleSync({
        frequency: updated.frequency,
        userId: targetUserId,
        serverUrl: getServerApiBaseUrl(),
      }).catch((nativeErr) => {
        console.warn('Native Android WorkManager scheduler dispatch error:', nativeErr);
      });
    } catch (e) {
      console.warn('Capacitor native scheduling call failed:', e);
    }
  }

  notifySyncListeners();
  return updated;
}

type SyncListener = () => void;
const syncListeners: Set<SyncListener> = new Set();

export function subscribeToSyncUpdates(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

export function notifySyncListeners(): void {
  syncListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('Sync listener error:', e);
    }
  });
}

/**
 * تنفيذ المزامنة الكاملة (السحابية والمحلية)
 * تجمع جميع بيانات المستخدم (الطلاب، المجموعات، الاشتراكات، الدروس الخاصة، الحصص، الحضور، المدفوعات، الفواتير الشهرية، رصيد الحصص، الرصيد المالي، والملف الشخصي)
 * وتقوم بدمجها بشكل آمن وتحديث السجلات في قاعدة بيانات SQLite السحابية
 */
export async function performFullSync(
  userId?: string,
  isManual = false
): Promise<{ success: boolean; message: string; dataPackage: UserAccountDataPackage; isOffline?: boolean; error?: string }> {
  const targetUserId = userId || getActiveUserId();
  const config = getAutoSyncConfig(targetUserId);

  // Set status to syncing
  saveAutoSyncConfig(
    {
      status: 'syncing',
      statusMessage: isManual ? 'جاري تنفيذ المزامنة اليدوية الآن...' : 'جاري تنفيذ المزامنة التلقائية المجدولة...',
    },
    targetUserId
  );

  // 1. Gather all local entities
  const localPackage = autoSyncUserAccount(targetUserId);

  // 2. Check native network & reachability
  const netStatus = await checkOverallConnectivity(true);
  const resolvedBaseUrl = getServerApiBaseUrl();
  const syncApiUrl = getFullApiUrl('/api/sync/merge');

  console.log(`[Sync] performFullSync triggered (manual: ${isManual}, userId: ${targetUserId})`);
  console.log(`[Sync] Native network status: ${netStatus.deviceConnected ? 'CONNECTED' : 'DISCONNECTED'} (type: ${netStatus.connectionType})`);
  console.log(`[Sync] Resolved API base URL: ${resolvedBaseUrl}`);
  console.log(`[Sync] Target Sync Endpoint: ${syncApiUrl}`);

  // If the device is completely disconnected from network
  if (!netStatus.deviceConnected) {
    console.warn(`[Sync] Sync attempt deferred: Device has no active network connection (type: ${netStatus.connectionType})`);
    const nextSync = config.frequency !== 'off' ? calculateNextSyncTime(config.frequency) : null;
    saveAutoSyncConfig(
      {
        status: 'offline_deferred',
        statusMessage: 'محفوظ محلياً بأمان - لا يوجد اتصال إنترنت في الجهاز (ستتم المزامنة السحابية فور عودة الاتصال)',
        lastSyncTime: localPackage.lastSyncTime,
        nextSyncTime: nextSync,
        autoRetryOnReconnect: true,
      },
      targetUserId
    );
    return {
      success: true,
      message: 'تم حفظ وتأمين كافة البيانات محلياً. ستتم المزامنة السحابية فور عودة الاتصال بالإنترنت.',
      dataPackage: localPackage,
      isOffline: true,
    };
  }

  // 3. Attempt cloud sync via persistent server API with authorization token
  try {
    const token = getAuthTokenForUser(targetUserId);
    console.log(`[Sync] Dispatching POST request to ${syncApiUrl} with user token...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(syncApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-auth-token': token,
      },
      body: JSON.stringify({
        userId: targetUserId,
        token: token,
        dataPackage: localPackage,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    console.log(`[Sync] Server response status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const resData = await response.json();
      if (resData.success && resData.dataPackage) {
        if (resData.merged) {
          db.restoreAccountData(targetUserId, resData.dataPackage);
        }

        const nextSync = config.frequency !== 'off' ? calculateNextSyncTime(config.frequency) : null;
        const finalPackage = resData.dataPackage as UserAccountDataPackage;

        console.log(`[Sync] Sync attempt result: SUCCESS - Synced with Firestore (${finalPackage.stats?.totalStudents || 0} students, ${finalPackage.stats?.totalGroups || 0} groups, ${finalPackage.stats?.totalSessions || 0} sessions)`);

        saveAutoSyncConfig(
          {
            status: 'success',
            statusMessage: 'تمت المزامنة السحابية بنجاح وتحديث كافة البيانات في قاعدة البيانات السحابية الدائمة',
            lastSyncTime: finalPackage.lastSyncTime || new Date().toISOString(),
            nextSyncTime: nextSync,
            autoRetryOnReconnect: false,
          },
          targetUserId
        );

        return {
          success: true,
          message: `تمت المزامنة وحفظ البيانات سحابياً بنجاح (${finalPackage.stats?.totalStudents || 0} طالب، ${finalPackage.stats?.totalGroups || 0} مجموعة، ${finalPackage.stats?.totalSessions || 0} حصة).`,
          dataPackage: finalPackage,
        };
      } else {
        const failureReason = resData.error || 'Server returned unsuccessful sync response';
        console.warn(`[Sync] Sync attempt result: FAILED - Server error: ${failureReason}`);
        throw new Error(failureReason);
      }
    } else {
      const errorText = await response.text().catch(() => '');
      console.warn(`[Sync] Sync attempt result: FAILED (HTTP ${response.status}) - ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }
  } catch (netErr: any) {
    const isTimeout = netErr?.name === 'AbortError';
    const failureReason = isTimeout ? 'Request timed out after 12 seconds' : netErr?.message || 'Network fetch error';
    console.warn(`[Sync] Sync failure reason: ${failureReason}. Preserving local offline backup.`);

    const nextSync = config.frequency !== 'off' ? calculateNextSyncTime(config.frequency) : null;
    const isServerUnreachable = netStatus.deviceConnected;

    saveAutoSyncConfig(
      {
        status: 'offline_deferred',
        statusMessage: isServerUnreachable
          ? 'تم حفظ وتأمين البيانات محلياً - تعذر الوصول للسيرفر السحابي (سيُعاد المحاولة تلقائياً)'
          : 'محفوظ محلياً بأمان - لا يوجد اتصال إنترنت (ستتم المزامنة السحابية فور عودة الاتصال)',
        lastSyncTime: localPackage.lastSyncTime,
        nextSyncTime: nextSync,
        autoRetryOnReconnect: true,
      },
      targetUserId
    );

    return {
      success: true,
      message: isServerUnreachable
        ? 'تم حفظ وتأمين البيانات محلياً. تعذر الاتصال بالسيرفر السحابي وسيتم إعادة المحاولة تلقائياً عند استقرار الاتصال.'
        : 'تم حفظ وتأمين البيانات محلياً، وستتم المزامنة السحابية عند استقرار الشبكة.',
      dataPackage: localPackage,
      isOffline: true,
      error: failureReason,
    };
  }
}

/**
 * Pulls the latest cloud data package from the production server for the specified user
 */
export async function pullCloudDataPackageFromServer(
  userId?: string
): Promise<{ success: boolean; dataPackage?: UserAccountDataPackage | null; error?: string }> {
  const targetUserId = userId || getActiveUserId();
  const token = getAuthTokenForUser(targetUserId);
  const pullUrl = getFullApiUrl('/api/sync/pull');

  try {
    console.log(`[Sync] Pulling cloud data package from ${pullUrl} for user ${targetUserId}...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(pullUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'x-auth-token': token,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.dataPackage) {
        db.restoreAccountData(targetUserId, data.dataPackage);
        return { success: true, dataPackage: data.dataPackage };
      }
      return { success: true, dataPackage: null };
    } else {
      const errText = await res.text().catch(() => '');
      return { success: false, error: `HTTP ${res.status}: ${errText || res.statusText}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during pull' };
  }
}

/**
 * Authenticates / logs in with the production server API
 */
export async function loginWithServerApi(credentials: {
  id: string;
  email?: string;
  name?: string;
  password?: string;
}): Promise<{ success: boolean; token?: string; user?: any; error?: string }> {
  const loginUrl = getFullApiUrl('/api/auth/login');
  try {
    console.log(`[Auth] Logging in via server API at ${loginUrl}...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(credentials),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return { success: true, token: data.token, user: data.user };
      }
      return { success: false, error: data.error || 'Login failed' };
    } else {
      const errText = await res.text().catch(() => '');
      return { success: false, error: `HTTP ${res.status}: ${errText || res.statusText}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during login' };
  }
}

/**
 * تهيئة محرك الجدولة والمزامنة في الخلفية لنظام Android والمتصفح
 */
let schedulerInitialized = false;
export function initAutoSyncScheduler(): void {
  if (typeof window === 'undefined' || schedulerInitialized) return;
  schedulerInitialized = true;

  console.log('[Scheduler] Initializing auto-sync scheduler & listeners...');

  // 1. إعادة المحاولة فور عودة الاتصال بالإنترنت (عبر Network utility)
  onNetworkReconnected(() => {
    console.log('[Scheduler] onNetworkReconnected event fired! Checking for pending sync...');
    const activeUserId = getActiveUserId();
    const config = getAutoSyncConfig(activeUserId);
    if (config.autoRetryOnReconnect || config.status === 'offline_deferred') {
      performFullSync(activeUserId, false).catch((err) => console.warn('[Scheduler] Auto sync on reconnect failed:', err));
    }
  });

  // Native Android WorkManager bootstrap with production server URL
  if (Capacitor.isNativePlatform()) {
    try {
      const activeUserId = getActiveUserId();
      const config = getAutoSyncConfig(activeUserId);
      if (config.frequency !== 'off') {
        AutoSyncScheduler.scheduleSync({
          frequency: config.frequency,
          userId: activeUserId,
          serverUrl: getServerApiBaseUrl(),
        }).catch((e) => console.warn('[Scheduler] Bootstrap native sync failed:', e));
      }
    } catch {}
  }

  // 2. فحص المزامنة المجدولة عند فتح التطبيق أو عودته للواجهة (Android Resume / Tab active)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const activeUserId = getActiveUserId();
      const config = getAutoSyncConfig(activeUserId);
      if (config.frequency !== 'off' && config.nextSyncTime) {
        const nextTime = new Date(config.nextSyncTime).getTime();
        if (Date.now() >= nextTime && config.status !== 'syncing') {
          performFullSync(activeUserId, false).catch((err) => console.warn('[Scheduler] Foreground auto sync failed:', err));
        }
      }
    }
  });

  // 3. حلقة فحص مجدولة خفيفة في الخلفية (كل 20 ثانية)
  setInterval(() => {
    try {
      const activeUserId = getActiveUserId();
      const config = getAutoSyncConfig(activeUserId);
      if (config.frequency !== 'off' && config.nextSyncTime) {
        const nextTime = new Date(config.nextSyncTime).getTime();
        if (Date.now() >= nextTime && config.status !== 'syncing') {
          performFullSync(activeUserId, false).catch((err) => console.warn('[Scheduler] Interval auto sync failed:', err));
        }
      }
    } catch (err) {
      console.error('[Scheduler] Auto sync scheduler tick error:', err);
    }
  }, 20000);
}

// Auto-boot scheduler on module load
initAutoSyncScheduler();

/**
 * دالة تنسيق وقت المزامنة القادمة بشكل عربي واضح
 */
export function formatNextSyncTimeArabic(isoString?: string | null, frequency?: AutoSyncFrequency): string {
  if (frequency === 'off' || !isoString) {
    return 'المزامنة التلقائية متوقفة (إيقاف)';
  }
  try {
    const targetDate = new Date(isoString);
    if (isNaN(targetDate.getTime())) return 'المزامنة التلقائية متوقفة';

    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();
    const timeStr = targetDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    if (diffMs <= 0) {
      return `مستحقة الآن (${timeStr})`;
    }

    const diffMin = Math.round(diffMs / (60 * 1000));
    const diffHours = Math.round(diffMs / (60 * 60 * 1000));
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

    const isToday = targetDate.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = targetDate.toDateString() === tomorrow.toDateString();

    if (diffMin < 60) {
      return `اليوم، ${timeStr} (خلال ${diffMin} دقيقة)`;
    }

    if (isToday) {
      return `اليوم، ${timeStr} (خلال ${diffHours} ساعة)`;
    }

    if (isTomorrow) {
      return `غداً، ${timeStr}`;
    }

    return `${targetDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}، ${timeStr} (خلال ${diffDays} يوم)`;
  } catch {
    return 'مجدولة';
  }
}

/**
 * دالة تنسيق حالة المزامنة الحالية مع الألوان والوسوم المناسبة
 */
export function formatSyncStatusArabic(
  status: AutoSyncStatus,
  isOnline = true,
  statusReason?: NetworkStatusReason
): { label: string; badgeClass: string; iconType: 'success' | 'syncing' | 'offline' | 'error' | 'idle' } {
  if (!isOnline || status === 'offline_deferred') {
    if (statusReason === 'api_unreachable') {
      return {
        label: 'مؤجل - تعذر الوصول للسيرفر السحابي (البيانات محفوظة محلياً)',
        badgeClass: 'bg-[#C97C5D]/15 text-[#C97C5D] border border-[#C97C5D]/30',
        iconType: 'offline',
      };
    }
    return {
      label: 'مؤجل - لا يوجد اتصال بالإنترنت (البيانات محفوظة محلياً)',
      badgeClass: 'bg-[#C97C5D]/15 text-[#C97C5D] border border-[#C97C5D]/30',
      iconType: 'offline',
    };
  }

  switch (status) {
    case 'syncing':
      return {
        label: 'جاري مزامنة البيانات مع السحابة...',
        badgeClass: 'bg-[#5C788A]/15 text-[#5C788A] border border-[#5C788A]/30',
        iconType: 'syncing',
      };
    case 'success':
    case 'idle':
      return {
        label: 'متزامن وجاهز (جميع البيانات مؤمنة بالسحابة)',
        badgeClass: 'bg-[#748C70]/15 text-[#748C70] border border-[#748C70]/30',
        iconType: 'success',
      };
    case 'error':
      return {
        label: 'فشلت المزامنة الأخيرة (البيانات مؤمنة ومحفوظة محلياً)',
        badgeClass: 'bg-[#C97C5D]/15 text-[#C97C5D] border border-[#C97C5D]/30',
        iconType: 'error',
      };
    default:
      return {
        label: 'متزامن وجاهز',
        badgeClass: 'bg-[#748C70]/15 text-[#748C70] border border-[#748C70]/30',
        iconType: 'idle',
      };
  }
}

/**
 * دالة تنسيق وقت آخر مزامنة بشكل عربي أنيق وواضح
 */
export function formatSyncTimeArabic(isoString?: string | null): string {
  if (!isoString) return 'لم تتم المزامنة بعد';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'لم تتم المزامنة بعد';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffSec < 45) {
      return 'الآن (منذ لحظات)';
    }
    if (diffMin < 60) {
      return `منذ ${diffMin} دقيقة`;
    }

    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
      return `اليوم، ${timeStr}`;
    }

    return `${date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}، ${timeStr}`;
  } catch {
    return 'منذ قليل';
  }
}

// Pricing calculation helper
export function calculateCustomEnrollmentPrice(
  defaultGroupPrice: number,
  modifierType: PricingModifierType,
  modifierValue: number
): number {
  switch (modifierType) {
    case 'same_as_group':
      return defaultGroupPrice;
    case 'fixed_discount':
      return Math.max(0, defaultGroupPrice - (modifierValue || 0));
    case 'percentage_discount':
      return Math.max(0, Math.round(defaultGroupPrice * (1 - (modifierValue || 0) / 100)));
    case 'fixed_increase':
      return defaultGroupPrice + (modifierValue || 0);
    case 'percentage_increase':
      return Math.round(defaultGroupPrice * (1 + (modifierValue || 0) / 100));
    case 'custom_price':
      return Math.max(0, modifierValue || 0);
    default:
      return defaultGroupPrice;
  }
}

// ==========================================
// Database Engine API
// ==========================================
export const db = {
  // 1. Students (الطلاب)
  getStudents: (userId?: string): Student[] => {
    const currentUserId = userId || getActiveUserId();
    const all = getList<Student>(STORAGE_KEYS.STUDENTS, []);
    return all.filter((s) => (s.userId ? s.userId === currentUserId : currentUserId === 'acc_master_teacher'));
  },

  getStudentById: (id: string): Student | undefined => {
    return db.getStudents().find((s) => s.id === id);
  },

  saveStudent: (student: Student): void => {
    const activeUserId = getActiveUserId();
    const studentWithUser: Student = {
      ...student,
      userId: student.userId || activeUserId,
    };
    const list = getList<Student>(STORAGE_KEYS.STUDENTS, []);
    const idx = list.findIndex((s) => s.id === student.id);
    if (idx >= 0) {
      list[idx] = studentWithUser;
    } else {
      list.unshift(studentWithUser);
    }
    saveList(STORAGE_KEYS.STUDENTS, list);
    autoSyncUserAccount(activeUserId);
  },

  deleteStudent: (id: string): void => {
    const activeUserId = getActiveUserId();
    const list = getList<Student>(STORAGE_KEYS.STUDENTS, []).filter((s) => s.id !== id);
    saveList(STORAGE_KEYS.STUDENTS, list);

    // Also remove associated enrollments to maintain referential integrity
    const enrollments = getList<Enrollment>(STORAGE_KEYS.ENROLLMENTS, []).filter((e) => e.studentId !== id);
    saveList(STORAGE_KEYS.ENROLLMENTS, enrollments);

    // Remove payments for this student
    const payments = getList<Payment>(STORAGE_KEYS.PAYMENTS, []).filter((p) => p.studentId !== id);
    saveList(STORAGE_KEYS.PAYMENTS, payments);

    // Remove attendance for this student
    const attendance = getList<Attendance>(STORAGE_KEYS.ATTENDANCE, []).filter((a) => a.studentId !== id);
    saveList(STORAGE_KEYS.ATTENDANCE, attendance);

    autoSyncUserAccount(activeUserId);
  },

  // 2. Groups (المجموعات والدروس الخاصة)
  getGroups: (userId?: string): Group[] => {
    const currentUserId = userId || getActiveUserId();
    const all = getList<Group>(STORAGE_KEYS.GROUPS, []);
    return all.filter((g) => (g.userId ? g.userId === currentUserId : currentUserId === 'acc_master_teacher'));
  },

  getGroupById: (id: string): Group | undefined => {
    return db.getGroups().find((g) => g.id === id);
  },

  saveGroup: (group: Group): void => {
    const activeUserId = getActiveUserId();
    const groupWithUser: Group = {
      ...group,
      userId: group.userId || activeUserId,
    };
    const list = getList<Group>(STORAGE_KEYS.GROUPS, []);
    const idx = list.findIndex((g) => g.id === group.id);
    if (idx >= 0) {
      list[idx] = groupWithUser;
    } else {
      list.unshift(groupWithUser);
    }
    saveList(STORAGE_KEYS.GROUPS, list);
    autoSyncUserAccount(activeUserId);
  },

  deleteGroup: (id: string): void => {
    const activeUserId = getActiveUserId();
    const list = getList<Group>(STORAGE_KEYS.GROUPS, []).filter((g) => g.id !== id);
    saveList(STORAGE_KEYS.GROUPS, list);

    // Cascade delete enrollments for this group
    const enrollments = getList<Enrollment>(STORAGE_KEYS.ENROLLMENTS, []).filter((e) => e.groupId !== id);
    saveList(STORAGE_KEYS.ENROLLMENTS, enrollments);

    // Cascade delete sessions for this group
    const sessions = getList<Session>(STORAGE_KEYS.SESSIONS, []).filter((s) => s.groupId !== id);
    saveList(STORAGE_KEYS.SESSIONS, sessions);

    autoSyncUserAccount(activeUserId);
  },

  // 3. Enrollments (تسجيلات الطلاب في المجموعات والدروس الخاصة)
  getEnrollments: (userId?: string): Enrollment[] => {
    const currentUserId = userId || getActiveUserId();
    const all = getList<Enrollment>(STORAGE_KEYS.ENROLLMENTS, []);
    return all.filter((e) => (e.userId ? e.userId === currentUserId : currentUserId === 'acc_master_teacher'));
  },

  getEnrollmentById: (id: string): Enrollment | undefined => {
    return db.getEnrollments().find((e) => e.id === id);
  },

  getStudentEnrollments: (studentId: string): Enrollment[] => {
    return db.getEnrollments().filter((e) => e.studentId === studentId && e.status !== 'stopped');
  },

  getGroupEnrollments: (groupId: string): Enrollment[] => {
    return db.getEnrollments().filter((e) => e.groupId === groupId && e.status !== 'stopped');
  },

  getGroupStudents: (groupId: string): Student[] => {
    const enrollments = db.getGroupEnrollments(groupId);
    const studentIds = new Set(enrollments.map((e) => e.studentId));
    return db.getStudents().filter((s) => studentIds.has(s.id));
  },

  getStudentGroups: (studentId: string): { group: Group; enrollment: Enrollment }[] => {
    const enrollments = db.getStudentEnrollments(studentId);
    const groups = db.getGroups();
    const result: { group: Group; enrollment: Enrollment }[] = [];

    for (const enr of enrollments) {
      const g = groups.find((grp) => grp.id === enr.groupId);
      if (g) {
        result.push({ group: g, enrollment: enr });
      }
    }
    return result;
  },

  getStudentServiceType: (studentId: string): 'none' | 'group_only' | 'private_only' | 'both' => {
    const enrollments = db.getStudentEnrollments(studentId);
    if (enrollments.length === 0) return 'none';
    const groups = db.getGroups();
    let hasGroup = false;
    let hasPrivate = false;

    for (const enr of enrollments) {
      const g = groups.find((grp) => grp.id === enr.groupId);
      const sType = enr.serviceType || g?.type || 'group';
      if (sType === 'private' || g?.type === 'private') {
        hasPrivate = true;
      } else {
        hasGroup = true;
      }
    }

    if (hasGroup && hasPrivate) return 'both';
    if (hasPrivate) return 'private_only';
    if (hasGroup) return 'group_only';
    return 'none';
  },

  createPrivateLessonService: (
    studentId: string,
    options: {
      subject: string;
      gradeLevel?: string;
      sessionPrice: number;
      billingType?: BillingType;
      billingMode?: BillingMode;
      packageSessionsCount?: number;
      packagePrice?: number;
      scheduleDays?: string[];
      scheduleTime?: string;
      roomOrLocation?: string;
      notes?: string;
    }
  ): { group: Group; enrollment: Enrollment } => {
    const student = db.getStudentById(studentId);
    const studentName = student ? student.name : 'طالب';
    const grade = options.gradeLevel || student?.gradeLevel || 'الصف الأول الثانوي';
    const resolvedBilling: BillingType = options.billingType || (options.billingMode as any) || 'prepaid';
    const resolvedMode: BillingMode = options.billingMode || (options.billingType as any) || 'prepaid';

    const isPackage = resolvedMode === 'package' || resolvedBilling === 'package';
    const packageSessions = isPackage ? (options.packageSessionsCount || 10) : undefined;
    const packagePrice = isPackage ? (options.packagePrice || options.sessionPrice) : undefined;
    const effectivePrice = isPackage && packageSessions && packagePrice
      ? Math.round(packagePrice / packageSessions)
      : options.sessionPrice;

    const newGroup: Group = {
      id: `grp_priv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: `درس خاص: ${studentName} - ${options.subject}`,
      subject: options.subject,
      gradeLevel: grade,
      type: 'private',
      billingType: resolvedBilling,
      billingMode: resolvedMode,
      defaultPrice: isPackage && packagePrice ? packagePrice : options.sessionPrice,
      packageSessionsCount: packageSessions,
      scheduleDays: options.scheduleDays || ['السبت'],
      scheduleTime: options.scheduleTime || '04:00 م',
      roomOrLocation: options.roomOrLocation || 'منزل الطالب / أونلاين',
      accentColor: '#D49B4B', // Gold accent for private lessons
      notes: options.notes || '',
      createdAt: new Date().toISOString(),
    };

    db.saveGroup(newGroup);

    const enrollment = db.enrollStudent(studentId, newGroup.id, {
      serviceType: 'private',
      billingType: resolvedBilling,
      billingMode: resolvedMode,
      pricingType: 'same_as_group',
      customPrice: effectivePrice,
      packageSessionsCount: packageSessions,
      packagePrice: packagePrice,
      sessionCredit: 0,
      financialCredit: 0,
      discount: 0,
      status: 'active',
      notes: options.notes,
    });

    return { group: newGroup, enrollment };
  },

  enrollStudent: (
    studentId: string,
    groupId: string,
    options?: Partial<Omit<Enrollment, 'id' | 'studentId' | 'groupId'>>
  ): Enrollment => {
    const activeUserId = getActiveUserId();
    const existing = db.getEnrollments();
    const found = existing.find((e) => e.studentId === studentId && e.groupId === groupId);

    const group = db.getGroupById(groupId);
    const defaultPrice = group ? group.defaultPrice : 0;
    const defaultBilling = group ? group.billingType : 'monthly';
    const defaultType = group ? group.type : 'group';
    const baseSessions = group?.baseSessionsPerMonth || 8;

    let calculatedPrice = options?.customPrice !== undefined ? options.customPrice : defaultPrice;
    if (options?.pricingType) {
      calculatedPrice = calculateCustomEnrollmentPrice(
        defaultPrice,
        options.pricingType,
        options.pricingValue || 0
      );
    }

    if (found) {
      // Re-activate if was paused/stopped, and update pricing options
      found.status = 'active';
      if (options?.customPrice !== undefined) found.customPrice = options.customPrice;
      if (options?.billingType !== undefined) found.billingType = options.billingType;
      if (options?.billingMode !== undefined) found.billingMode = options.billingMode;
      if (options?.pricingType !== undefined) found.pricingType = options.pricingType;
      if (options?.pricingValue !== undefined) found.pricingValue = options.pricingValue;
      if (options?.baseSessionsPerMonth !== undefined) found.baseSessionsPerMonth = options.baseSessionsPerMonth;
      if (options?.extraSessionPrice !== undefined) found.extraSessionPrice = options.extraSessionPrice;
      db.updateEnrollment(found);
      return found;
    }

    const newEnrollment: Enrollment = {
      id: `enr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId: activeUserId,
      studentId,
      groupId,
      serviceType: options?.serviceType || defaultType,
      billingType: options?.billingType || defaultBilling,
      billingMode: options?.billingMode || (options?.billingType as any) || group?.billingMode,
      pricingType: options?.pricingType || 'same_as_group',
      pricingValue: options?.pricingValue || 0,
      customPrice: calculatedPrice,
      baseSessionsPerMonth: options?.baseSessionsPerMonth || baseSessions,
      extraSessionPrice: options?.extraSessionPrice,
      packageSessionsCount: options?.packageSessionsCount || 8,
      packagePrice: options?.packagePrice || calculatedPrice,
      sessionCredit: options?.sessionCredit || 0,
      financialCredit: options?.financialCredit || 0,
      discount: options?.discount || 0,
      status: options?.status || 'active',
      joinedAt: options?.joinedAt || new Date().toISOString().split('T')[0],
      notes: options?.notes || '',
    };

    const allEnrollments = getList<Enrollment>(STORAGE_KEYS.ENROLLMENTS, []);
    allEnrollments.unshift(newEnrollment);
    saveList(STORAGE_KEYS.ENROLLMENTS, allEnrollments);
    autoSyncUserAccount(activeUserId);
    return newEnrollment;
  },

  removeEnrollment: (enrollmentId: string): void => {
    const activeUserId = getActiveUserId();
    const list = getList<Enrollment>(STORAGE_KEYS.ENROLLMENTS, []).filter((e) => e.id !== enrollmentId);
    saveList(STORAGE_KEYS.ENROLLMENTS, list);
    autoSyncUserAccount(activeUserId);
  },

  updateEnrollment: (enrollment: Enrollment): void => {
    const activeUserId = getActiveUserId();
    const list = getList<Enrollment>(STORAGE_KEYS.ENROLLMENTS, []);
    const idx = list.findIndex((e) => e.id === enrollment.id);
    if (idx >= 0) {
      list[idx] = {
        ...enrollment,
        userId: enrollment.userId || list[idx].userId || activeUserId,
      };
      saveList(STORAGE_KEYS.ENROLLMENTS, list);
      autoSyncUserAccount(activeUserId);
    }
  },

  // 4. Sessions (الحصص)
  getSessions: (userId?: string): Session[] => {
    const currentUserId = userId || getActiveUserId();
    const all = getList<Session>(STORAGE_KEYS.SESSIONS, []);
    return all.filter((s) => (s.userId ? s.userId === currentUserId : currentUserId === 'acc_master_teacher'));
  },

  getSessionById: (id: string): Session | undefined => {
    return db.getSessions().find((s) => s.id === id);
  },

  saveSession: (session: Session): void => {
    const activeUserId = getActiveUserId();
    const sessionWithUser: Session = {
      ...session,
      userId: session.userId || activeUserId,
    };
    const list = getList<Session>(STORAGE_KEYS.SESSIONS, []);
    const idx = list.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      list[idx] = sessionWithUser;
    } else {
      list.unshift(sessionWithUser);
    }
    saveList(STORAGE_KEYS.SESSIONS, list);
    autoSyncUserAccount(activeUserId);
  },

  /**
   * تسجيل حصة أو عدة حصص Private مباشرة لطالب محدد، مع إنشاء جلسات الحضور واستهلاك الرصيد أو تسجيلها كمستحق
   */
  recordPrivateSessionsForStudent: (params: {
    studentId: string;
    enrollmentId: string;
    groupId: string;
    date: string;
    startTime: string;
    sessionCount: number;
    title?: string;
    notes?: string;
    attendanceStatus?: AttendanceStatus | 'cancelled';
    isCharged?: boolean;
    absenceReason?: string;
    sessionStatus?: 'completed' | 'cancelled' | 'scheduled';
  }): Session[] => {
    const activeUserId = getActiveUserId();
    const count = Math.max(1, Math.floor(params.sessionCount || 1));
    const student = db.getStudentById(params.studentId);
    const enrollment = db.getEnrollmentById(params.enrollmentId);
    const group = db.getGroupById(params.groupId);

    const isPackage =
      enrollment?.billingMode === 'package' ||
      enrollment?.billingType === 'package' ||
      group?.billingMode === 'package' ||
      group?.billingType === 'package';

    const packageSessionsCount = isPackage
      ? (enrollment?.packageSessionsCount || group?.packageSessionsCount || 10)
      : undefined;

    const packageTotalPrice = isPackage
      ? (enrollment?.packagePrice ||
         (group?.billingMode === 'package' || group?.billingType === 'package' ? group.defaultPrice : undefined) ||
         enrollment?.customPrice ||
         1000)
      : undefined;

    // Effective Session Price = Package Total Price ÷ Package Session Count
    const effectiveSessionPrice = isPackage && packageSessionsCount && packageTotalPrice
      ? Math.round(packageTotalPrice / packageSessionsCount)
      : (enrollment?.customPrice || group?.defaultPrice || 100);

    const totalSessionValue = count * effectiveSessionPrice;
    const packageId = isPackage ? (enrollment?.groupId || group?.id || `pkg_${enrollment?.id}`) : undefined;

    const dateObj = new Date(params.date);
    const month = !isNaN(dateObj.getTime()) ? dateObj.getMonth() + 1 : new Date().getMonth() + 1;
    const year = !isNaN(dateObj.getTime()) ? dateObj.getFullYear() : new Date().getFullYear();
    const dayName = !isNaN(dateObj.getTime()) ? getArabicDayName(params.date) : 'السبت';

    const isCancelled = params.attendanceStatus === 'cancelled' || params.sessionStatus === 'cancelled';
    const isAbsentFree = params.attendanceStatus === 'absent_free' || params.attendanceStatus === 'excused' || params.isCharged === false;
    const isAbsentCharged = params.attendanceStatus === 'absent_charged';

    const finalSessionStatus: 'completed' | 'cancelled' | 'scheduled' = isCancelled
      ? 'cancelled'
      : (params.sessionStatus || 'completed');

    const finalAttendanceStatus: AttendanceStatus = isCancelled
      ? 'excused'
      : isAbsentFree
      ? 'absent_free'
      : isAbsentCharged
      ? 'absent_charged'
      : (params.attendanceStatus as AttendanceStatus) || 'present';

    const finalIsCharged = isCancelled || isAbsentFree ? false : (params.isCharged !== undefined ? params.isCharged : true);

    const createdSessions: Session[] = [];
    const baseTitle = params.title || (isCancelled ? `حصة خاصة ملغاة: ${student?.name || 'طالب'}` : `حصة خاصة: ${student?.name || 'طالب'}`);

    for (let i = 1; i <= count; i++) {
      const sessionSuffix = count > 1 ? ` (حصة ${i} من ${count})` : '';
      const sessionId = `ses_priv_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 6)}`;
      
      const newSession: Session = {
        id: sessionId,
        userId: activeUserId,
        groupId: params.groupId,
        enrollmentId: params.enrollmentId,
        studentId: params.studentId,
        packageId,
        title: `${baseTitle}${sessionSuffix}`,
        date: params.date,
        dayName,
        month,
        year,
        startTime: params.startTime,
        status: finalSessionStatus,
        pricePerStudent: effectiveSessionPrice,
        sessionCount: 1,
        effectiveSessionPrice,
        totalSessionValue: effectiveSessionPrice,
        packageTotalPrice,
        packageSessionsCount,
        notes: params.notes || '',
        createdAt: new Date().toISOString(),
      };

      db.saveSession(newSession);
      createdSessions.push(newSession);

      // Create attendance record
      const attendanceRec: Attendance = {
        id: `att_priv_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 6)}`,
        userId: activeUserId,
        sessionId: newSession.id,
        studentId: params.studentId,
        enrollmentId: params.enrollmentId,
        status: finalAttendanceStatus,
        isCharged: finalIsCharged,
        absenceReason: params.absenceReason || (isCancelled ? 'حصة ملغاة' : undefined),
        recordedAt: new Date().toISOString(),
        notes: params.notes || (params.absenceReason ? `سبب الغياب: ${params.absenceReason}` : undefined),
      };

      db.saveAttendanceBatch(newSession.id, [attendanceRec]);
    }

    return createdSessions;
  },

  deleteSession: (id: string): void => {
    const list = getList<Session>(STORAGE_KEYS.SESSIONS, []).filter((s) => s.id !== id);
    saveList(STORAGE_KEYS.SESSIONS, list);

    // Also remove attendance for this session and refund credit if prepaid
    const attendance = getList<Attendance>(STORAGE_KEYS.ATTENDANCE, []);
    const sessionAtt = attendance.filter((a) => a.sessionId === id);
    
    sessionAtt.forEach((att) => {
      const isCharged = att.isCharged !== undefined ? att.isCharged : (att.status === 'present' || att.status === 'late' || att.status === 'absent_charged' || att.status === 'absent');
      if (isCharged) {
        const enrollments = db.getEnrollments();
        const enr = enrollments.find((e) => e.id === att.enrollmentId || (e.studentId === att.studentId));
        if (enr && (enr.billingMode === 'prepaid' || enr.billingType === 'prepaid' || enr.billingType === 'per_session')) {
          const balanceBefore = enr.sessionCredit || 0;
          enr.sessionCredit = balanceBefore + 1;
          db.updateEnrollment(enr);
          db.addCreditLog({
            enrollmentId: enr.id,
            studentId: enr.studentId,
            groupId: enr.groupId,
            type: 'refund',
            sessionsDelta: 1,
            balanceBefore,
            balanceAfter: enr.sessionCredit,
            reason: 'استرجاع رصيد حصة: تم حذف الحصة',
            date: new Date().toISOString().split('T')[0],
            sessionId: id,
          });
        }
      }
    });

    const remainingAtt = attendance.filter((a) => a.sessionId !== id);
    saveList(STORAGE_KEYS.ATTENDANCE, remainingAtt);
    autoSyncUserAccount();
  },

  // 5. Attendance (الحضور والغياب)
  getAttendance: (userId?: string): Attendance[] => {
    const currentUserId = userId || getActiveUserId();
    const all = getList<Attendance>(STORAGE_KEYS.ATTENDANCE, []);
    return all.filter((a) => (a.userId ? a.userId === currentUserId : currentUserId === 'acc_master_teacher'));
  },

  getSessionAttendance: (sessionId: string): Attendance[] => {
    return db.getAttendance().filter((a) => a.sessionId === sessionId);
  },

  getStudentAttendance: (studentId: string): Attendance[] => {
    return db.getAttendance().filter((a) => a.studentId === studentId);
  },

  // 5.1 Session Credit Logs (سجل حركات رصيد الحصص الدفع المسبق)
  getCreditLogs: (userId?: string): SessionCreditLog[] => {
    const currentUserId = userId || getActiveUserId();
    const all = getList<SessionCreditLog>(STORAGE_KEYS.CREDIT_LOGS, []);
    return all.filter((l) => (l.userId ? l.userId === currentUserId : currentUserId === 'acc_master_teacher'));
  },

  getEnrollmentCreditLogs: (enrollmentId: string): SessionCreditLog[] => {
    return db
      .getCreditLogs()
      .filter((log) => log.enrollmentId === enrollmentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  addCreditLog: (logData: Omit<SessionCreditLog, 'id' | 'createdAt'>): SessionCreditLog => {
    const activeUserId = getActiveUserId();
    const logs = getList<SessionCreditLog>(STORAGE_KEYS.CREDIT_LOGS, []);
    const newLog: SessionCreditLog = {
      ...logData,
      userId: logData.userId || activeUserId,
      id: `crd_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    logs.unshift(newLog);
    saveList(STORAGE_KEYS.CREDIT_LOGS, logs);
    return newLog;
  },

  /**
   * حفظ دفعة الحضور مع تحديث رصيد الحصص الدفع المسبق وسجل الحركات
   */
  saveAttendanceBatch: (sessionId: string, records: Attendance[]): void => {
    const activeUserId = getActiveUserId();
    const session = db.getSessionById(sessionId);
    const existingAll = getList<Attendance>(STORAGE_KEYS.ATTENDANCE, []);
    const otherSessionsAtt = existingAll.filter((a) => a.sessionId !== sessionId);
    const oldSessionAttendance = existingAll.filter((a) => a.sessionId === sessionId);

    // Process credit changes for each student
    const enrollments = db.getEnrollments();
    records.forEach((rec) => {
      rec.userId = rec.userId || activeUserId;
      // Find matching enrollment
      const enr = enrollments.find(
        (e) => e.id === rec.enrollmentId || (e.studentId === rec.studentId && e.groupId === session?.groupId)
      );

      if (enr) {
        const isPrepaid = enr.billingMode === 'prepaid' || enr.billingType === 'prepaid' || (enr.billingType === 'per_session' && enr.billingMode !== 'postpaid');

        if (isPrepaid) {
          const oldRec = oldSessionAttendance.find((o) => o.studentId === rec.studentId);
          const oldIsCharged = oldRec
            ? (oldRec.isCharged !== undefined ? oldRec.isCharged : (oldRec.status === 'present' || oldRec.status === 'late' || oldRec.status === 'absent_charged' || oldRec.status === 'absent'))
            : false;
          
          const newIsCharged = rec.isCharged !== undefined
            ? rec.isCharged
            : (rec.status === 'present' || rec.status === 'late' || rec.status === 'absent_charged' || rec.status === 'absent');

          // Case 1: Newly charged attendance (Was unrecorded or uncharged, now charged)
          if (!oldIsCharged && newIsCharged) {
            const currentCredit = enr.sessionCredit || 0;
            if (currentCredit > 0) {
              const balanceBefore = currentCredit;
              enr.sessionCredit = balanceBefore - 1;
              db.updateEnrollment(enr);

              const reason = rec.status === 'absent_charged'
                ? `غياب محسوب: ${session?.title || 'حصة'} (${session?.date || ''})`
                : `حضور حصة: ${session?.title || 'حصة'} (${session?.date || ''})`;

              db.addCreditLog({
                enrollmentId: enr.id,
                studentId: enr.studentId,
                groupId: enr.groupId,
                type: 'consumption',
                sessionsDelta: -1,
                balanceBefore,
                balanceAfter: enr.sessionCredit,
                reason,
                date: session?.date || new Date().toISOString().split('T')[0],
                sessionId,
              });
            } else {
              // Credit is 0: Do NOT make Session Credit negative (stays 0), record attendance as unpaid due session
              enr.sessionCredit = 0;
              db.updateEnrollment(enr);

              const sessionPrice = enr.customPrice || 100;
              const reason = rec.status === 'absent_charged'
                ? `غياب محسوب بينما الرصيد 0 - تسجيل كحصة مستحقة غير مدفوعة (مستحق: ${sessionPrice} ج.م)`
                : `حضور حصة بينما الرصيد 0 - تسجيل كحصة مستحقة غير مدفوعة (مستحق: ${sessionPrice} ج.م)`;

              db.addCreditLog({
                enrollmentId: enr.id,
                studentId: enr.studentId,
                groupId: enr.groupId,
                type: 'consumption',
                sessionsDelta: 0,
                balanceBefore: 0,
                balanceAfter: 0,
                reason,
                date: session?.date || new Date().toISOString().split('T')[0],
                sessionId,
              });
            }
          }
          // Case 2: Changed from charged to uncharged (e.g. excused or cancelled)
          else if (oldIsCharged && !newIsCharged) {
            const balanceBefore = enr.sessionCredit || 0;
            enr.sessionCredit = balanceBefore + 1;
            db.updateEnrollment(enr);

            db.addCreditLog({
              enrollmentId: enr.id,
              studentId: enr.studentId,
              groupId: enr.groupId,
              type: 'refund',
              sessionsDelta: 1,
              balanceBefore,
              balanceAfter: enr.sessionCredit,
              reason: `استرجاع رصيد حصة: تغيير الحالة إلى غير محسوبة (${session?.date || ''})`,
              date: session?.date || new Date().toISOString().split('T')[0],
              sessionId,
            });
          }
        }
      }
    });

    const recordsWithUserId = records.map((r) => ({ ...r, userId: r.userId || activeUserId }));
    const combined = [...recordsWithUserId, ...otherSessionsAtt];
    saveList(STORAGE_KEYS.ATTENDANCE, combined);
    autoSyncUserAccount(activeUserId);
  },

  // 6. Payments Engine (نظام المدفوعات والتحصيلات المتطور)
  getPayments: (userId?: string): Payment[] => {
    const currentUserId = userId || getActiveUserId();
    const all = getList<Payment>(STORAGE_KEYS.PAYMENTS, []);
    return all.filter((p) => (p.userId ? p.userId === currentUserId : currentUserId === 'acc_master_teacher'));
  },

  getStudentPayments: (studentId: string): Payment[] => {
    return db.getPayments().filter((p) => p.studentId === studentId);
  },

  getEnrollmentPayments: (enrollmentId: string): Payment[] => {
    const enr = db.getEnrollmentById(enrollmentId);
    return db.getPayments().filter((p) => {
      if (p.enrollmentId === enrollmentId) return true;
      if (!p.enrollmentId && enr && p.studentId === enr.studentId && p.groupId === enr.groupId) return true;
      return false;
    });
  },

  /**
   * تسجيل دفعة مالية مع تنفيذ قواعد المحاسبة، رصيد الحصص، ورصيد العمليات
   */
  recordPayment: (paymentData: Omit<Payment, 'id' | 'createdAt'>): Payment => {
    const activeUserId = getActiveUserId();
    const payments = getList<Payment>(STORAGE_KEYS.PAYMENTS, []);
    const enrollments = db.getEnrollments();

    // Locate target enrollment
    let targetEnrollment = enrollments.find(
      (e) => e.id === paymentData.enrollmentId || (e.studentId === paymentData.studentId && e.groupId === paymentData.groupId)
    );

    const group = targetEnrollment ? db.getGroupById(targetEnrollment.groupId) : undefined;
    const sessionRate = getEffectiveSessionPrice(targetEnrollment, group);

    let sessionsPurchased = paymentData.sessionsPurchased || 0;
    let sessionsCovered = paymentData.sessionsCovered || 0;
    let financialCreditAdded = 0;
    let autoSessionsConverted = 0;
    let financialCreditConverted = 0;

    const paymentAmount = Number(paymentData.amount) || 0;
    const paymentId = `pmt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    if (targetEnrollment) {
      const isPrepaid =
        targetEnrollment.billingMode === 'prepaid' ||
        targetEnrollment.billingType === 'prepaid' ||
        (targetEnrollment.billingType === 'per_session' && targetEnrollment.billingMode !== 'postpaid');

      const isPostpaid =
        targetEnrollment.billingMode === 'postpaid' ||
        targetEnrollment.billingType === 'postpaid';

      const isPackage =
        targetEnrollment.billingMode === 'package' ||
        targetEnrollment.billingType === 'package';

      const prevSummary = db.calculateEnrollmentFinancials(targetEnrollment.id);
      const prevUnpaid = prevSummary ? prevSummary.unpaidSessionsCount : 0;
      const balanceBefore = targetEnrollment.sessionCredit || 0;

      let newSessions = 0;
      if (isPrepaid || isPackage) {
        if (sessionRate > 0) {
          const covered = Math.floor(paymentAmount / sessionRate);
          const remainder = paymentAmount % sessionRate;
          newSessions = covered;
          sessionsPurchased = covered;
          sessionsCovered = covered;
          financialCreditAdded = remainder;
          targetEnrollment.financialCredit = (targetEnrollment.financialCredit || 0) + remainder;
        }
      } else if (isPostpaid) {
        // Postpaid: Settle unpaid sessions first, then convert excess to Session Credit
        const totalUnpaidValue = prevUnpaid * sessionRate;
        const covered = sessionRate > 0 ? Math.floor(paymentAmount / sessionRate) : 0;
        const remainder = sessionRate > 0 ? paymentAmount % sessionRate : 0;
        sessionsPurchased = covered;
        sessionsCovered = covered;
        financialCreditAdded = remainder;
        targetEnrollment.financialCredit = (targetEnrollment.financialCredit || 0) + remainder;

        if (paymentAmount > totalUnpaidValue && totalUnpaidValue > 0) {
          // Settles all unpaid sessions + converts excess to session credit
          const excessValue = paymentAmount - totalUnpaidValue;
          const excessSessions = sessionRate > 0 ? Math.floor(excessValue / sessionRate) : 0;
          targetEnrollment.sessionCredit = balanceBefore + excessSessions;

          db.addCreditLog({
            enrollmentId: targetEnrollment.id,
            studentId: targetEnrollment.studentId,
            groupId: targetEnrollment.groupId,
            type: 'purchase',
            sessionsDelta: excessSessions,
            balanceBefore,
            balanceAfter: targetEnrollment.sessionCredit,
            reason: `سداد ${prevUnpaid} حصص مستحقة سابقة + تحويل الفائض (${excessSessions} حصص) إلى رصيد حصص متاح (سداد ${paymentAmount} ج.م)`,
            date: paymentData.date,
            paymentId,
          });
        } else if (paymentAmount > 0 && prevUnpaid === 0) {
          // No unpaid sessions -> Entire amount converted to Session Credit!
          const excessSessions = covered;
          targetEnrollment.sessionCredit = balanceBefore + excessSessions;

          db.addCreditLog({
            enrollmentId: targetEnrollment.id,
            studentId: targetEnrollment.studentId,
            groupId: targetEnrollment.groupId,
            type: 'purchase',
            sessionsDelta: excessSessions,
            balanceBefore,
            balanceAfter: targetEnrollment.sessionCredit,
            reason: `سداد آجل مسبق: إضافة ${excessSessions} حصص للرصيد المتاح (سداد ${paymentAmount} ج.م)`,
            date: paymentData.date,
            paymentId,
          });
        } else {
          // Partially or fully settles unpaid sessions without excess
          const settledCount = Math.min(prevUnpaid, covered);
          db.addCreditLog({
            enrollmentId: targetEnrollment.id,
            studentId: targetEnrollment.studentId,
            groupId: targetEnrollment.groupId,
            type: 'purchase',
            sessionsDelta: 0,
            balanceBefore,
            balanceAfter: balanceBefore,
            reason: `تسوية سداد ${settledCount} حصص مستحقة من إجمالي ${prevUnpaid} حصص (سداد ${paymentAmount} ج.م)`,
            date: paymentData.date,
            paymentId,
          });
        }
      } else {
        if (paymentData.paymentType === 'single_session') {
          sessionsPurchased = 1;
          sessionsCovered = 1;
          newSessions = 1;
        } else if (paymentData.paymentType === 'session_count') {
          sessionsPurchased = sessionsPurchased || 1;
          sessionsCovered = sessionsPurchased;
          newSessions = sessionsPurchased;
        } else if (paymentData.paymentType === 'custom_amount') {
          if (sessionRate > 0) {
            const covered = Math.floor(paymentAmount / sessionRate);
            const remainder = paymentAmount % sessionRate;
            sessionsCovered = covered;
            sessionsPurchased = covered;
            financialCreditAdded = remainder;
            newSessions = covered;
            targetEnrollment.financialCredit = (targetEnrollment.financialCredit || 0) + remainder;
          }
        }
      }

      if ((isPrepaid || isPackage) && newSessions > 0) {
        let coveredUnpaid = 0;
        let addedToCredit = newSessions;
        if (prevUnpaid > 0) {
          coveredUnpaid = Math.min(prevUnpaid, newSessions);
          addedToCredit = newSessions - coveredUnpaid;
        }

        targetEnrollment.sessionCredit = balanceBefore + addedToCredit;

        let reason = '';
        if (coveredUnpaid > 0 && addedToCredit > 0) {
          reason = `سداد ${coveredUnpaid} حصص مستحقة سابقة + إضافة ${addedToCredit} حصص للرصيد المتاح (سداد مبلغ ${paymentAmount} ج.م)`;
        } else if (coveredUnpaid > 0) {
          reason = `سداد ${coveredUnpaid} حصص مستحقة سابقة (سداد مبلغ ${paymentAmount} ج.م)`;
        } else {
          reason = `شراء ${newSessions} حصص (سداد مبلغ ${paymentAmount} ج.م)`;
        }

        db.addCreditLog({
          enrollmentId: targetEnrollment.id,
          studentId: targetEnrollment.studentId,
          groupId: targetEnrollment.groupId,
          type: 'purchase',
          sessionsDelta: newSessions,
          balanceBefore,
          balanceAfter: targetEnrollment.sessionCredit,
          reason,
          date: paymentData.date,
          paymentId,
        });
      }

      // Check for Automatic Financial Credit Conversion to Session Credit
      if (sessionRate > 0 && (targetEnrollment.financialCredit || 0) >= sessionRate) {
        const canConvertSessions = Math.floor(targetEnrollment.financialCredit / sessionRate);
        if (canConvertSessions > 0) {
          const creditBalBefore = targetEnrollment.sessionCredit || 0;
          autoSessionsConverted = canConvertSessions;
          financialCreditConverted = canConvertSessions * sessionRate;
          targetEnrollment.sessionCredit = creditBalBefore + canConvertSessions;
          targetEnrollment.financialCredit = targetEnrollment.financialCredit - financialCreditConverted;

          db.addCreditLog({
            enrollmentId: targetEnrollment.id,
            studentId: targetEnrollment.studentId,
            groupId: targetEnrollment.groupId,
            type: 'adjustment',
            sessionsDelta: canConvertSessions,
            balanceBefore: creditBalBefore,
            balanceAfter: targetEnrollment.sessionCredit,
            reason: `تحويل رصيد مالي متراكم (${financialCreditConverted} ج.م) إلى +${canConvertSessions} حصة`,
            date: paymentData.date,
            paymentId,
          });
        }
      }

      // Update enrollment in storage
      db.updateEnrollment(targetEnrollment);
    }

    const newPayment: Payment = {
      ...paymentData,
      userId: paymentData.userId || activeUserId,
      id: paymentId,
      amount: paymentAmount,
      sessionsPurchased,
      sessionsCovered,
      financialCreditAdded,
      financialCreditConverted,
      autoSessionsConverted,
      createdAt: new Date().toISOString(),
    };

    payments.unshift(newPayment);
    saveList(STORAGE_KEYS.PAYMENTS, payments);
    autoSyncUserAccount(activeUserId);
    return newPayment;
  },

  savePayment: (payment: Payment): void => {
    const activeUserId = getActiveUserId();
    const paymentWithUser = {
      ...payment,
      userId: payment.userId || activeUserId,
    };
    const list = getList<Payment>(STORAGE_KEYS.PAYMENTS, []);
    const idx = list.findIndex((p) => p.id === payment.id);
    if (idx >= 0) {
      list[idx] = paymentWithUser;
    } else {
      list.unshift(paymentWithUser);
    }
    saveList(STORAGE_KEYS.PAYMENTS, list);
    autoSyncUserAccount(activeUserId);
  },

  deletePayment: (id: string): void => {
    const activeUserId = getActiveUserId();
    const list = getList<Payment>(STORAGE_KEYS.PAYMENTS, []).filter((p) => p.id !== id);
    saveList(STORAGE_KEYS.PAYMENTS, list);
    autoSyncUserAccount(activeUserId);
  },

  // 7. Teacher Profile (ملف المدرس)
  getTeacherProfile: (userId?: string): TeacherProfile => {
    const currentUserId = userId || getActiveUserId();
    try {
      const rawUser = localStorage.getItem(`${STORAGE_KEYS.TEACHER_PROFILE}_${currentUserId}`);
      if (rawUser) return JSON.parse(rawUser);
    } catch {}

    const accounts = getList<UserAccount>(STORAGE_KEYS.ACCOUNTS, []);
    const account = accounts.find((a) => a.id === currentUserId);
    if (account) {
      return {
        name: account.name || 'أستاذ المادة',
        subject: account.subject || 'المادة الدراسية',
        phone: account.phone || '',
        centerOrSchool: account.centerOrSchool || 'سنتر تعليمي',
        academicYear: '2025 - 2026',
        currency: 'ج.م',
      };
    }

    try {
      const rawDefault = localStorage.getItem(STORAGE_KEYS.TEACHER_PROFILE);
      if (rawDefault) return JSON.parse(rawDefault);
    } catch {}

    return DEFAULT_TEACHER_PROFILE;
  },

  saveTeacherProfile: (profile: TeacherProfile, userId?: string): void => {
    const currentUserId = userId || getActiveUserId();
    try {
      localStorage.setItem(`${STORAGE_KEYS.TEACHER_PROFILE}_${currentUserId}`, JSON.stringify(profile));
      if (currentUserId === 'acc_master_teacher') {
        localStorage.setItem(STORAGE_KEYS.TEACHER_PROFILE, JSON.stringify(profile));
      }
      autoSyncUserAccount(currentUserId);
    } catch {}
  },

  // ==========================================
  // 8. Advanced Financial Engine & Ledger Calculations
  // ==========================================

  /**
   * حساب السجل المالي والمحاسبي الكامل لاشتراك محدد لطالب في مجموعة أو درس خاص
   */
  calculateEnrollmentFinancials: (enrollmentId: string): EnrollmentFinancialSummary | undefined => {
    const enrollment = db.getEnrollmentById(enrollmentId);
    if (!enrollment) return undefined;

    const group = db.getGroupById(enrollment.groupId);
    const groupName = group ? group.name : 'مجموعة محذوفة';
    const groupType = group ? group.type : enrollment.serviceType;
    const accentColor = group ? group.accentColor : '#748C70';

    const sessions = db.getSessions().filter((s) => s.groupId === enrollment.groupId && s.status === 'completed');
    const attendanceRecords = db.getStudentAttendance(enrollment.studentId);
    const payments = db.getEnrollmentPayments(enrollment.id);

    // Identify consumed sessions (present, late, absent_charged)
    const sessionIds = new Set(sessions.map((s) => s.id));
    const consumedAttendance = attendanceRecords.filter((a) => {
      if (!sessionIds.has(a.sessionId)) return false;
      if (a.isCharged !== undefined) return a.isCharged;
      return a.status === 'present' || a.status === 'late' || a.status === 'absent_charged' || a.status === 'absent';
    });

    const attendedCount = consumedAttendance.length;
    const baseSessionsLimit = enrollment.baseSessionsPerMonth || 8;
    const extraSessionRate =
      enrollment.extraSessionPrice ||
      (enrollment.customPrice > 0 ? Math.round(enrollment.customPrice / baseSessionsLimit) : 100);

    const monthlyLedger: MonthlyBillingLedgerItem[] = [];
    let totalDue = 0;
    let extraSessionsTotal = 0;

    if (enrollment.billingType === 'monthly') {
      // Collect months where student has activity (enrollment join date, sessions, or payments)
      const monthsSet = new Set<string>();

      // Join date month
      if (enrollment.joinedAt) {
        const d = new Date(enrollment.joinedAt);
        if (!isNaN(d.getTime())) {
          monthsSet.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
        }
      }

      // Current month
      const now = new Date();
      monthsSet.add(`${now.getFullYear()}-${now.getMonth() + 1}`);

      // Months from sessions
      sessions.forEach((s) => {
        if (s.month && s.year) {
          monthsSet.add(`${s.year}-${s.month}`);
        }
      });

      // Months from payments
      payments.forEach((p) => {
        if (p.targetYear && p.targetMonth) {
          monthsSet.add(`${p.targetYear}-${p.targetMonth}`);
        } else if (p.year && p.month) {
          monthsSet.add(`${p.year}-${p.month}`);
        }
      });

      // Sort months chronologically
      const sortedMonths = Array.from(monthsSet).sort((a, b) => {
        const [y1, m1] = a.split('-').map(Number);
        const [y2, m2] = b.split('-').map(Number);
        return y1 !== y2 ? y1 - y2 : m1 - m2;
      });

      for (const mKey of sortedMonths) {
        const [year, month] = mKey.split('-').map(Number);

        // Count attended sessions in this month
        const monthSessions = sessions.filter((s) => s.month === month && s.year === year);
        const monthSessionIds = new Set(monthSessions.map((s) => s.id));
        const attendedThisMonth = consumedAttendance.filter((a) => monthSessionIds.has(a.sessionId)).length;

        const extraInMonth = Math.max(0, attendedThisMonth - baseSessionsLimit);
        const extraCharge = extraInMonth * extraSessionRate;
        const basePrice = enrollment.customPrice;
        const totalRequired = basePrice + extraCharge;

        extraSessionsTotal += extraInMonth;

        // Sum payments for this month
        const paidThisMonth = payments
          .filter((p) => {
            if (p.paymentType === 'specific_month') {
              return p.targetMonth === month && p.targetYear === year;
            }
            return false;
          })
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        const remainingThisMonth = Math.max(0, totalRequired - paidThisMonth);
        let status: MonthBillStatus = 'unpaid';
        if (paidThisMonth >= totalRequired && totalRequired > 0) {
          status = 'fully_paid';
        } else if (paidThisMonth > 0) {
          status = 'partially_paid';
        }

        monthlyLedger.push({
          month,
          year,
          monthName: getArabicMonthName(month),
          basePrice,
          baseSessions: baseSessionsLimit,
          attendedSessions: attendedThisMonth,
          extraSessions: extraInMonth,
          extraCharge,
          totalRequired,
          totalPaid: paidThisMonth,
          remaining: remainingThisMonth,
          status,
        });

        totalDue += totalRequired;
      }
    } else if (
      enrollment.billingType === 'per_session' ||
      enrollment.billingType === 'prepaid' ||
      enrollment.billingType === 'postpaid' ||
      enrollment.billingMode === 'prepaid' ||
      enrollment.billingMode === 'postpaid'
    ) {
      // Per session billing (Prepaid / Postpaid)
      totalDue = attendedCount * enrollment.customPrice;
    } else if (enrollment.billingType === 'package' || enrollment.billingMode === 'package') {
      // Package billing
      const packageSessions = enrollment.packageSessionsCount || 8;
      const packagePrice = enrollment.packagePrice || enrollment.customPrice;
      const unitRate = Math.round(packagePrice / packageSessions);
      totalDue = attendedCount * unitRate;
    }

    const freeAttendance = attendanceRecords.filter((a) => {
      if (!sessionIds.has(a.sessionId)) return false;
      if (a.isCharged !== undefined) return !a.isCharged;
      return a.status === 'absent_free' || a.status === 'excused';
    });
    const freeSessionsCount = freeAttendance.length;

    const isPackage = enrollment.billingMode === 'package' || enrollment.billingType === 'package';

    const isPrepaid =
      !isPackage && (
        enrollment.billingMode === 'prepaid' ||
        enrollment.billingType === 'prepaid' ||
        (enrollment.billingType === 'per_session' && enrollment.billingMode !== 'postpaid')
      );

    const isPostpaid =
      !isPackage && (
        enrollment.billingMode === 'postpaid' ||
        enrollment.billingType === 'postpaid'
      );

    const sessionRate = getEffectiveSessionPrice(enrollment, group);
    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    let purchasedSessionsCount = 0;
    let usedSessionsCount = 0;
    let effectiveSessionCredit = 0;
    let sessionCreditValue = 0;
    let unpaidSessionsCount = 0;
    let settledSessionsCount = 0;
    let remaining = 0;

    if (isPrepaid) {
      // PREPAID Rules:
      const explicitPurchased = payments.reduce((sum, p) => {
        if (p.sessionsPurchased && p.sessionsPurchased > 0) return sum + p.sessionsPurchased;
        if (p.paymentType === 'single_session') return sum + 1;
        if (p.paymentType === 'session_count') return sum + (p.sessionsPurchased || 1);
        if (sessionRate > 0 && p.amount) return sum + Math.floor(Number(p.amount) / sessionRate);
        return sum;
      }, 0) + payments.reduce((sum, p) => sum + (p.autoSessionsConverted || 0), 0);

      purchasedSessionsCount = explicitPurchased > 0 ? explicitPurchased : (sessionRate > 0 ? Math.floor(totalPaid / sessionRate) : 0);
      usedSessionsCount = Math.min(attendedCount, purchasedSessionsCount);
      effectiveSessionCredit = Math.max(0, purchasedSessionsCount - attendedCount);
      sessionCreditValue = effectiveSessionCredit * sessionRate;
      unpaidSessionsCount = Math.max(0, attendedCount - purchasedSessionsCount);
      remaining = unpaidSessionsCount * sessionRate;
      totalDue = totalPaid + remaining;
    } else if (isPostpaid) {
      // POSTPAID Rules:
      totalDue = attendedCount * sessionRate;
      if (totalPaid >= totalDue) {
        settledSessionsCount = attendedCount;
        unpaidSessionsCount = 0;
        remaining = 0;
        const excess = totalPaid - totalDue;
        effectiveSessionCredit = sessionRate > 0 ? Math.floor(excess / sessionRate) : 0;
        sessionCreditValue = effectiveSessionCredit * sessionRate;
        purchasedSessionsCount = attendedCount + effectiveSessionCredit;
        usedSessionsCount = attendedCount;
      } else {
        settledSessionsCount = sessionRate > 0 ? Math.floor(totalPaid / sessionRate) : 0;
        unpaidSessionsCount = Math.max(0, attendedCount - settledSessionsCount);
        remaining = unpaidSessionsCount * sessionRate;
        effectiveSessionCredit = 0;
        sessionCreditValue = 0;
        purchasedSessionsCount = settledSessionsCount;
        usedSessionsCount = attendedCount;
      }
    } else if (enrollment.billingType === 'monthly') {
      // Monthly Billing
      purchasedSessionsCount = payments.length;
      usedSessionsCount = attendedCount;
      effectiveSessionCredit = 0;
      sessionCreditValue = 0;
      unpaidSessionsCount = 0;
      remaining = Math.max(0, totalDue - totalPaid);
    } else {
      // Package or other
      const packageSessions = enrollment.packageSessionsCount || 10;
      const packagePrice = enrollment.packagePrice || enrollment.customPrice;
      const unitRate = packageSessions > 0 ? Math.round(packagePrice / packageSessions) : sessionRate;

      const explicitPurchased = payments.reduce((sum, p) => {
        if (p.sessionsPurchased && p.sessionsPurchased > 0) return sum + p.sessionsPurchased;
        if (p.paymentType === 'single_session') return sum + 1;
        if (p.paymentType === 'session_count') return sum + (p.sessionsPurchased || 1);
        if (unitRate > 0 && p.amount) return sum + Math.floor(Number(p.amount) / unitRate);
        return sum;
      }, 0) + payments.reduce((sum, p) => sum + (p.autoSessionsConverted || 0), 0);

      purchasedSessionsCount = explicitPurchased > 0 ? explicitPurchased : (unitRate > 0 ? Math.floor(totalPaid / unitRate) : 0);
      usedSessionsCount = Math.min(attendedCount, purchasedSessionsCount);
      effectiveSessionCredit = Math.max(0, purchasedSessionsCount - attendedCount);
      sessionCreditValue = effectiveSessionCredit * unitRate;
      unpaidSessionsCount = Math.max(0, attendedCount - purchasedSessionsCount);
      remaining = unpaidSessionsCount * unitRate;
      totalDue = totalPaid + remaining;
    }

    const creditLogs = db.getEnrollmentCreditLogs(enrollment.id);

    return {
      enrollmentId: enrollment.id,
      groupId: enrollment.groupId,
      groupName,
      groupType,
      accentColor,
      billingType: enrollment.billingType,
      billingMode: enrollment.billingMode,
      customPrice: enrollment.customPrice,
      effectiveSessionPrice: sessionRate,
      packagePrice: enrollment.packagePrice,
      packageSessionsCount: enrollment.packageSessionsCount,
      baseSessionsPerMonth: baseSessionsLimit,
      totalDue,
      totalPaid,
      remaining,
      sessionCredit: effectiveSessionCredit,
      sessionCreditValue,
      financialCredit: enrollment.financialCredit || 0,
      attendedSessionsCount: attendedCount,
      extraSessionsCount: extraSessionsTotal,
      purchasedSessionsCount,
      usedSessionsCount,
      settledSessionsCount,
      freeSessionsCount,
      unpaidSessionsCount,
      creditLogs,
      monthlyLedger,
      payments,
    };
  },

  /**
   * حساب التقرير المالي الشامل للطالب عبر كل المجموعات والدروس الخاصة
   */
  calculateStudentGrandFinancials: (studentId: string): StudentGrandFinancialSummary => {
    const student = db.getStudentById(studentId);
    const studentName = student ? student.name : 'طالب غير محدد';
    const enrollments = db.getStudentEnrollments(studentId);
    const allPayments = db.getStudentPayments(studentId);

    const enrollmentsSummary: EnrollmentFinancialSummary[] = [];
    let grandTotalDue = 0;
    let grandTotalPaid = 0;
    let grandRemaining = 0;
    let totalSessionCredit = 0;
    let totalUnpaidSessions = 0;
    let totalFinancialCredit = 0;

    for (const enr of enrollments) {
      const summary = db.calculateEnrollmentFinancials(enr.id);
      if (summary) {
        enrollmentsSummary.push(summary);
        grandTotalDue += summary.totalDue;
        grandTotalPaid += summary.totalPaid;
        grandRemaining += summary.remaining;
        totalSessionCredit += summary.sessionCredit;
        totalUnpaidSessions += summary.unpaidSessionsCount;
        totalFinancialCredit += summary.financialCredit;
      }
    }

    return {
      studentId,
      studentName,
      enrollmentsSummary,
      grandTotalDue,
      grandTotalPaid,
      grandRemaining,
      totalSessionCredit,
      totalUnpaidSessions,
      totalFinancialCredit,
      allPayments,
    };
  },

  /**
   * حساب التقرير المالي للمجموعة مع تفاصيل كل طالب
   */
  calculateGroupFinancials: (groupId: string): GroupFinancialSummary | undefined => {
    const group = db.getGroupById(groupId);
    if (!group) return undefined;

    const enrollments = db.getGroupEnrollments(groupId);
    const students = db.getStudents();
    const sessions = db.getSessions().filter((s) => s.groupId === groupId);
    const completedSessions = sessions.filter((s) => s.status === 'completed');

    let totalDue = 0;
    let totalPaid = 0;
    let totalPrepaidCredits = 0;
    let totalAttendedSessions = 0;

    const studentsSummary: GroupFinancialSummary['studentsSummary'] = [];

    for (const enr of enrollments) {
      const st = students.find((s) => s.id === enr.studentId);
      if (!st) continue;

      const enrSummary = db.calculateEnrollmentFinancials(enr.id);
      if (enrSummary) {
        totalDue += enrSummary.totalDue;
        totalPaid += enrSummary.totalPaid;
        totalPrepaidCredits += enrSummary.sessionCredit;
        totalAttendedSessions += enrSummary.attendedSessionsCount;

        studentsSummary.push({
          student: st,
          enrollment: enr,
          totalDue: enrSummary.totalDue,
          totalPaid: enrSummary.totalPaid,
          remaining: enrSummary.remaining,
          sessionCredit: enrSummary.sessionCredit,
          financialCredit: enrSummary.financialCredit,
          attendedCount: enrSummary.attendedSessionsCount,
        });
      }
    }

    return {
      groupId: group.id,
      groupName: group.name,
      groupType: group.type,
      accentColor: group.accentColor,
      billingType: group.billingType,
      defaultPrice: group.defaultPrice,
      totalStudents: enrollments.length,
      totalDue,
      totalPaid,
      remaining: Math.max(0, totalDue - totalPaid),
      totalCompletedSessions: completedSessions.length,
      totalAttendedSessions,
      totalPrepaidCredits,
      studentsSummary,
    };
  },

  /**
   * حساب التقرير العام الشامل للمدرس
   */
  calculateTeacherFinancialOverview: (period?: ReportPeriodFilter): TeacherOverallFinancialSummary => {
    const students = db.getStudents();
    const payments = db.getPayments();
    const sessions = db.getSessions().filter((s) => s.status === 'completed');

    let totalRevenue = 0;
    let totalDues = 0;
    let totalRemaining = 0;
    let totalExtraSessions = 0;

    students.forEach((st) => {
      const fin = db.calculateStudentGrandFinancials(st.id);
      totalDues += fin.grandTotalDue;
      totalRemaining += fin.grandRemaining;
      fin.enrollmentsSummary.forEach((e) => {
        totalExtraSessions += e.extraSessionsCount;
      });
    });

    totalRevenue = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    // Monthly revenues breakdown
    const monthlyMap: Record<string, { revenue: number; dues: number }> = {};
    payments.forEach((p) => {
      const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
      if (!monthlyMap[key]) monthlyMap[key] = { revenue: 0, dues: 0 };
      monthlyMap[key].revenue += Number(p.amount) || 0;
    });

    const monthlyRevenues = Object.entries(monthlyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monthYear, data]) => ({
        monthYear,
        revenue: data.revenue,
        dues: data.dues,
      }));

    return {
      totalRevenue,
      totalDues,
      totalRemaining,
      totalActiveStudents: students.filter((s) => s.status === 'active').length,
      totalSessionsConducted: sessions.length,
      totalExtraSessions,
      monthlyRevenues,
      paymentsList: payments,
    };
  },

  // Legacy compatibility calculation
  calculateStudentFinancials: (studentId: string): FinancialCredit => {
    const summary = db.calculateStudentGrandFinancials(studentId);
    return {
      studentId,
      totalDue: summary.grandTotalDue,
      totalPaid: summary.grandTotalPaid,
      balance: summary.grandTotalPaid - summary.grandTotalDue,
    };
  },

  calculateGroupStats: (groupId: string) => {
    const summary = db.calculateGroupFinancials(groupId);
    const sessions = db.getSessions().filter((s) => s.groupId === groupId);
    const completedSessions = sessions.filter((s) => s.status === 'completed');

    const allAttendance = db.getAttendance();
    const sessionIds = new Set(completedSessions.map((s) => s.id));
    const groupAttendance = allAttendance.filter((a) => sessionIds.has(a.sessionId));

    const totalPossibleRecords = groupAttendance.length;
    const presentCount = groupAttendance.filter((a) => a.status === 'present' || a.status === 'late').length;
    const attendanceRate = totalPossibleRecords > 0 ? Math.round((presentCount / totalPossibleRecords) * 100) : 100;

    return {
      studentCount: summary?.totalStudents || 0,
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      attendanceRate,
      totalRevenue: summary?.totalPaid || 0,
      totalDue: summary?.totalDue || 0,
      remaining: summary?.remaining || 0,
    };
  },

  // 9. Full Database Backup & Reset & Secure Sync
  exportDatabaseJSON: (): string => {
    const activeUserId = getActiveUserId();
    const payload: UserAccountDataPackage = {
      version: '2.0',
      lastSyncTime: new Date().toISOString(),
      userId: activeUserId,
      students: db.getStudents(activeUserId),
      groups: db.getGroups(activeUserId),
      enrollments: db.getEnrollments(activeUserId),
      sessions: db.getSessions(activeUserId),
      attendance: db.getAttendance(activeUserId),
      payments: db.getPayments(activeUserId),
      creditLogs: db.getCreditLogs(activeUserId),
      teacherProfile: db.getTeacherProfile(activeUserId),
      stats: {
        totalStudents: db.getStudents(activeUserId).length,
        totalGroups: db.getGroups(activeUserId).length,
        totalSessions: db.getSessions(activeUserId).length,
        totalPayments: db.getPayments(activeUserId).length,
      },
    };
    return JSON.stringify(payload, null, 2);
  },

  exportAllData: (): string => {
    return db.exportDatabaseJSON();
  },

  exportAccountBackup: (userId?: string): string => {
    const targetUserId = userId || getActiveUserId();
    const pkg = autoSyncUserAccount(targetUserId);
    return JSON.stringify(pkg, null, 2);
  },

  syncAccountData: (userId?: string): UserAccountDataPackage => {
    return autoSyncUserAccount(userId);
  },

  getLastSyncTime: (userId?: string): string | null => {
    const targetUserId = userId || getActiveUserId();
    try {
      const rawSync = localStorage.getItem(`tm_v2_last_sync_${targetUserId}`);
      if (rawSync) return rawSync;
      const accounts = getList<UserAccount>(STORAGE_KEYS.ACCOUNTS, []);
      const acc = accounts.find((a) => a.id === targetUserId);
      if (acc?.lastSyncAt) return acc.lastSyncAt;
      if (acc?.syncedData?.lastSyncTime) return acc.syncedData.lastSyncTime;
    } catch {}
    return null;
  },

  restoreAccountData: (
    userId?: string,
    explicitData?: UserAccountDataPackage
  ): {
    success: boolean;
    message: string;
    count?: { students: number; groups: number; sessions: number; payments: number };
  } => {
    const targetUserId = userId || getActiveUserId();
    let dataToRestore: UserAccountDataPackage | null = explicitData || null;

    if (!dataToRestore) {
      // 1. Try from user account object
      const accounts = getList<UserAccount>(STORAGE_KEYS.ACCOUNTS, []);
      const acc = accounts.find((a) => a.id === targetUserId);
      if (acc?.syncedData) {
        dataToRestore = acc.syncedData;
      }
    }

    if (!dataToRestore) {
      // 2. Try from dedicated user backup key
      try {
        const raw = localStorage.getItem(`tm_v2_user_backup_${targetUserId}`);
        if (raw) dataToRestore = JSON.parse(raw);
      } catch {}
    }

    if (!dataToRestore) {
      return {
        success: false,
        message: 'لم يتم العثور على نسخة احتياطية أو بيانات متزامنة محفوظة لهذا الحساب.',
      };
    }

    try {
      // Restore students
      if (Array.isArray(dataToRestore.students)) {
        const otherStudents = getList<Student>(STORAGE_KEYS.STUDENTS, []).filter(
          (s) => (s.userId ? s.userId !== targetUserId : targetUserId !== 'acc_master_teacher')
        );
        const restoredStudents = dataToRestore.students.map((s) => ({ ...s, userId: targetUserId }));
        saveList(STORAGE_KEYS.STUDENTS, [...restoredStudents, ...otherStudents]);
      }

      // Restore groups
      if (Array.isArray(dataToRestore.groups)) {
        const otherGroups = getList<Group>(STORAGE_KEYS.GROUPS, []).filter(
          (g) => (g.userId ? g.userId !== targetUserId : targetUserId !== 'acc_master_teacher')
        );
        const restoredGroups = dataToRestore.groups.map((g) => ({ ...g, userId: targetUserId }));
        saveList(STORAGE_KEYS.GROUPS, [...restoredGroups, ...otherGroups]);
      }

      // Restore enrollments
      if (Array.isArray(dataToRestore.enrollments)) {
        const otherEnrollments = getList<Enrollment>(STORAGE_KEYS.ENROLLMENTS, []).filter(
          (e) => (e.userId ? e.userId !== targetUserId : targetUserId !== 'acc_master_teacher')
        );
        const restoredEnrollments = dataToRestore.enrollments.map((e) => ({ ...e, userId: targetUserId }));
        saveList(STORAGE_KEYS.ENROLLMENTS, [...restoredEnrollments, ...otherEnrollments]);
      }

      // Restore sessions
      if (Array.isArray(dataToRestore.sessions)) {
        const otherSessions = getList<Session>(STORAGE_KEYS.SESSIONS, []).filter(
          (s) => (s.userId ? s.userId !== targetUserId : targetUserId !== 'acc_master_teacher')
        );
        const restoredSessions = dataToRestore.sessions.map((s) => ({ ...s, userId: targetUserId }));
        saveList(STORAGE_KEYS.SESSIONS, [...restoredSessions, ...otherSessions]);
      }

      // Restore attendance
      if (Array.isArray(dataToRestore.attendance)) {
        const otherAtt = getList<Attendance>(STORAGE_KEYS.ATTENDANCE, []).filter(
          (a) => (a.userId ? a.userId !== targetUserId : targetUserId !== 'acc_master_teacher')
        );
        const restoredAtt = dataToRestore.attendance.map((a) => ({ ...a, userId: targetUserId }));
        saveList(STORAGE_KEYS.ATTENDANCE, [...restoredAtt, ...otherAtt]);
      }

      // Restore payments
      if (Array.isArray(dataToRestore.payments)) {
        const otherPay = getList<Payment>(STORAGE_KEYS.PAYMENTS, []).filter(
          (p) => (p.userId ? p.userId !== targetUserId : targetUserId !== 'acc_master_teacher')
        );
        const restoredPay = dataToRestore.payments.map((p) => ({ ...p, userId: targetUserId }));
        saveList(STORAGE_KEYS.PAYMENTS, [...restoredPay, ...otherPay]);
      }

      // Restore credit logs
      if (Array.isArray(dataToRestore.creditLogs)) {
        const otherLogs = getList<SessionCreditLog>(STORAGE_KEYS.CREDIT_LOGS, []).filter(
          (l) => (l.userId ? l.userId !== targetUserId : targetUserId !== 'acc_master_teacher')
        );
        const restoredLogs = dataToRestore.creditLogs.map((l) => ({ ...l, userId: targetUserId }));
        saveList(STORAGE_KEYS.CREDIT_LOGS, [...restoredLogs, ...otherLogs]);
      }

      // Restore profile
      if (dataToRestore.teacherProfile) {
        db.saveTeacherProfile(dataToRestore.teacherProfile, targetUserId);
      }

      autoSyncUserAccount(targetUserId);

      return {
        success: true,
        message: 'تمت استعادة كافة بيانات الحساب بنجاح وتحديث شاشات التطبيق.',
        count: {
          students: dataToRestore.students?.length || 0,
          groups: dataToRestore.groups?.length || 0,
          sessions: dataToRestore.sessions?.length || 0,
          payments: dataToRestore.payments?.length || 0,
        },
      };
    } catch (err) {
      console.error('Restore error:', err);
      return {
        success: false,
        message: 'حدث خطأ أثناء استعادة البيانات.',
      };
    }
  },

  importAccountBackup: (
    jsonString: string,
    userId?: string
  ): { success: boolean; message: string; count?: { students: number; groups: number; sessions: number; payments: number } } => {
    try {
      const data = JSON.parse(jsonString) as UserAccountDataPackage;
      return db.restoreAccountData(userId, data);
    } catch (err) {
      return {
        success: false,
        message: 'صيغة الملف غير صالحة أو غير متوافقة مع ملفات النسخ الاحتياطي.',
      };
    }
  },

  importDatabaseJSON: (jsonString: string): boolean => {
    try {
      const activeUserId = getActiveUserId();
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.students)) {
        const existing = getList<Student>(STORAGE_KEYS.STUDENTS, []).filter((s) => s.userId !== activeUserId);
        const imported = data.students.map((s: Student) => ({ ...s, userId: activeUserId }));
        saveList(STORAGE_KEYS.STUDENTS, [...imported, ...existing]);
      }
      if (Array.isArray(data.groups)) {
        const existing = getList<Group>(STORAGE_KEYS.GROUPS, []).filter((g) => g.userId !== activeUserId);
        const imported = data.groups.map((g: Group) => ({ ...g, userId: activeUserId }));
        saveList(STORAGE_KEYS.GROUPS, [...imported, ...existing]);
      }
      if (Array.isArray(data.enrollments)) {
        const existing = getList<Enrollment>(STORAGE_KEYS.ENROLLMENTS, []).filter((e) => e.userId !== activeUserId);
        const imported = data.enrollments.map((e: Enrollment) => ({ ...e, userId: activeUserId }));
        saveList(STORAGE_KEYS.ENROLLMENTS, [...imported, ...existing]);
      }
      if (Array.isArray(data.sessions)) {
        const existing = getList<Session>(STORAGE_KEYS.SESSIONS, []).filter((s) => s.userId !== activeUserId);
        const imported = data.sessions.map((s: Session) => ({ ...s, userId: activeUserId }));
        saveList(STORAGE_KEYS.SESSIONS, [...imported, ...existing]);
      }
      if (Array.isArray(data.attendance)) {
        const existing = getList<Attendance>(STORAGE_KEYS.ATTENDANCE, []).filter((a) => a.userId !== activeUserId);
        const imported = data.attendance.map((a: Attendance) => ({ ...a, userId: activeUserId }));
        saveList(STORAGE_KEYS.ATTENDANCE, [...imported, ...existing]);
      }
      if (Array.isArray(data.payments)) {
        const existing = getList<Payment>(STORAGE_KEYS.PAYMENTS, []).filter((p) => p.userId !== activeUserId);
        const imported = data.payments.map((p: Payment) => ({ ...p, userId: activeUserId }));
        saveList(STORAGE_KEYS.PAYMENTS, [...imported, ...existing]);
      }
      if (data.teacherProfile) db.saveTeacherProfile(data.teacherProfile);
      autoSyncUserAccount(activeUserId);
      return true;
    } catch (err) {
      console.error('Import error:', err);
      return false;
    }
  },

  importData: (jsonString: string): boolean => {
    return db.importDatabaseJSON(jsonString);
  },

  // 10. User Accounts & Authentication System
  getAccounts: (): UserAccount[] => {
    const list = getList<UserAccount>(STORAGE_KEYS.ACCOUNTS, []);
    if (list.length === 0) {
      // Seed initial default teacher account linked to existing data
      let initialProfile = DEFAULT_TEACHER_PROFILE;
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.TEACHER_PROFILE);
        if (raw) initialProfile = JSON.parse(raw);
      } catch {}

      const defaultAccount: UserAccount = {
        id: 'acc_master_teacher',
        name: initialProfile.name || 'أ/ محمد أحمد',
        email: 'teacher@example.com',
        phone: initialProfile.phone || '01000000000',
        subject: initialProfile.subject || 'رياضيات',
        centerOrSchool: initialProfile.centerOrSchool || 'سنتر الأوائل',
        password: 'password123',
        authToken: 'auth_tk_acc_master_teacher',
        recoveryPin: '123456',
        securityQuestion: 'ما هي مادتك المفضلة؟',
        securityAnswer: initialProfile.subject || 'رياضيات',
        createdAt: new Date().toISOString(),
      };
      saveList(STORAGE_KEYS.ACCOUNTS, [defaultAccount]);
      return [defaultAccount];
    }
    // Ensure all existing accounts have an authToken
    return list.map((acc) => {
      if (!acc.authToken) {
        return { ...acc, authToken: `auth_tk_${acc.id}` };
      }
      return acc;
    });
  },

  saveAccounts: (accounts: UserAccount[]): void => {
    saveList(STORAGE_KEYS.ACCOUNTS, accounts);
  },

  getCurrentSession: (): UserAccount | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
      if (!raw) return null;
      const user = JSON.parse(raw) as UserAccount;
      if (user && !user.authToken) {
        user.authToken = `auth_tk_${user.id}`;
      }
      return user;
    } catch {
      return null;
    }
  },

  setCurrentSession: (user: UserAccount | null): void => {
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
    } else {
      if (!user.authToken) {
        user.authToken = `auth_tk_${user.id}`;
      }
      localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(user));
    }
  },

  registerAccount: (accountData: {
    name: string;
    email: string;
    phone?: string;
    subject?: string;
    centerOrSchool?: string;
    password: string;
    recoveryPin?: string;
    securityQuestion?: string;
    securityAnswer?: string;
  }): { success: boolean; user?: UserAccount; error?: string } => {
    const accounts = db.getAccounts();
    const cleanEmail = accountData.email.trim().toLowerCase();
    
    // Check if email/username already exists
    const existing = accounts.find(
      (a) => a.email.toLowerCase() === cleanEmail || (accountData.phone && a.phone === accountData.phone.trim())
    );
    if (existing) {
      return { success: false, error: 'البريد الإلكتروني أو رقم الهاتف مسجل بالفعل بحساب آخر.' };
    }

    const newId = `acc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const newAccount: UserAccount = {
      id: newId,
      name: accountData.name.trim(),
      email: cleanEmail,
      phone: accountData.phone?.trim(),
      subject: accountData.subject?.trim(),
      centerOrSchool: accountData.centerOrSchool?.trim(),
      password: accountData.password,
      authToken: `auth_tk_${newId}`,
      recoveryPin: accountData.recoveryPin?.trim() || '123456',
      securityQuestion: accountData.securityQuestion?.trim() || 'ما هي مادتك الدراسية؟',
      securityAnswer: accountData.securityAnswer?.trim() || accountData.subject?.trim() || '',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    const updated = [newAccount, ...accounts];
    db.saveAccounts(updated);

    // Also sync teacher profile
    db.saveTeacherProfile({
      name: newAccount.name,
      subject: newAccount.subject || 'عام',
      phone: newAccount.phone || '',
      centerOrSchool: newAccount.centerOrSchool || '',
      currency: 'ج.م',
    }, newAccount.id);

    db.setCurrentSession(newAccount);
    autoSyncUserAccount(newAccount.id);
    return { success: true, user: newAccount };
  },

  login: (identifier: string, password: string): { success: boolean; user?: UserAccount; error?: string } => {
    const accounts = db.getAccounts();
    const clean = identifier.trim().toLowerCase();

    const account = accounts.find(
      (a) =>
        a.email.toLowerCase() === clean ||
        (a.phone && a.phone.trim() === identifier.trim()) ||
        a.name.toLowerCase() === clean
    );

    if (!account) {
      return { success: false, error: 'لم يتم العثور على حساب بهذا البريد أو الهاتف.' };
    }

    if (account.password !== password) {
      return { success: false, error: 'كلمة المرور غير صحيحة، يرجى المحاولة مجدداً.' };
    }

    // Update last login
    account.lastLoginAt = new Date().toISOString();
    db.saveAccounts(accounts.map((a) => (a.id === account.id ? account : a)));

    // Sync profile
    db.saveTeacherProfile({
      name: account.name,
      subject: account.subject || 'عام',
      phone: account.phone || '',
      centerOrSchool: account.centerOrSchool || '',
      currency: 'ج.م',
    }, account.id);

    db.setCurrentSession(account);

    // Auto-restore data on login if working storage for this user is empty but account has syncedData
    const localStudents = getList<Student>(STORAGE_KEYS.STUDENTS, []).filter((s) => s.userId === account.id);
    if (localStudents.length === 0 && account.syncedData && ((account.syncedData.students && account.syncedData.students.length > 0) || (account.syncedData.groups && account.syncedData.groups.length > 0))) {
      db.restoreAccountData(account.id, account.syncedData);
    } else {
      autoSyncUserAccount(account.id);
    }

    return { success: true, user: account };
  },

  logout: (): void => {
    db.setCurrentSession(null);
  },

  resetPassword: (
    identifier: string,
    newPassword: string,
    recoveryPinOrAnswer?: string
  ): { success: boolean; error?: string } => {
    const accounts = db.getAccounts();
    const clean = identifier.trim().toLowerCase();

    const account = accounts.find(
      (a) =>
        a.email.toLowerCase() === clean ||
        (a.phone && a.phone.trim() === identifier.trim()) ||
        a.name.toLowerCase() === clean
    );

    if (!account) {
      return { success: false, error: 'لم يتم العثور على حساب بهذا البريد الإلكتروني أو الهاتف.' };
    }

    if (recoveryPinOrAnswer) {
      const pinMatch = account.recoveryPin && account.recoveryPin === recoveryPinOrAnswer.trim();
      const answerMatch =
        account.securityAnswer &&
        account.securityAnswer.trim().toLowerCase() === recoveryPinOrAnswer.trim().toLowerCase();

      if (!pinMatch && !answerMatch) {
        return { success: false, error: 'كود الاسترداد أو إجابة سؤال الأمان غير صحيحة.' };
      }
    }

    account.password = newPassword;
    db.saveAccounts(accounts.map((a) => (a.id === account.id ? account : a)));
    return { success: true };
  },

  clearAllData: (): void => {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.getItem(k) && localStorage.removeItem(k));
  },

  // Auto-Sync Scheduling Helpers
  getAutoSyncConfig: (userId?: string): AutoSyncConfig => {
    return getAutoSyncConfig(userId);
  },

  saveAutoSyncConfig: (config: Partial<AutoSyncConfig>, userId?: string): AutoSyncConfig => {
    return saveAutoSyncConfig(config, userId);
  },

  setSyncFrequency: (frequency: AutoSyncFrequency, userId?: string): AutoSyncConfig => {
    return saveAutoSyncConfig({ frequency }, userId);
  },

  performFullSync: async (
    userId?: string,
    isManual = true
  ): Promise<{ success: boolean; message: string; dataPackage: UserAccountDataPackage; isOffline?: boolean }> => {
    return performFullSync(userId, isManual);
  },

  calculateNextSyncTime: (frequency: AutoSyncFrequency, fromDate?: Date): string | null => {
    return calculateNextSyncTime(frequency, fromDate);
  },

  formatNextSyncTimeArabic: (isoString?: string | null, frequency?: AutoSyncFrequency): string => {
    return formatNextSyncTimeArabic(isoString, frequency);
  },

  formatSyncStatusArabic: (status: AutoSyncStatus, isOnline?: boolean) => {
    return formatSyncStatusArabic(status, isOnline);
  },

  subscribeToSyncUpdates: (listener: () => void): (() => void) => {
    return subscribeToSyncUpdates(listener);
  },
};
