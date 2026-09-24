import { registerPlugin, Capacitor } from '@capacitor/core';
import {
  getServerApiBaseUrl,
  getFullApiUrl,
  universalApiFetch,
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
  MonthFinancialRecord,
  YearFinancialRecord,
  LifetimeFinancialSummary,
  PeriodFinancialBreakdown,
  MonthlyBillingLedgerItem,
  FinancialCredit,
  TeacherProfile,
  UserAccount,
  UserAccountDataPackage,
  ReportPeriodFilter,
  AutoSyncFrequency,
  AutoSyncStatus,
  AutoSyncConfig,
  AuthDiagnostics,
  DeletionTombstone,
  PendingResetRecord,
  BulkStudentSessionTarget,
  BulkCreateSessionsParams,
  BulkCreateSessionsResult,
  BulkStudentResultItem,
  HomeworkTest,
  HomeworkAssignment,
  HomeworkQuestionResult,
  HomeworkAssignmentStatus,
  NotificationSettings,
  NotificationStateItem,
  StudentBehaviorLog,
} from '../types';
import { getAppLanguage } from './i18n';
import {
  roundMoney,
  multiplyMoney,
  divideMoney,
  addMoney,
  subtractMoney,
  calculateCoveredSessions,
  calculateMoneyRemainder,
  formatMoney,
} from './money';

export {
  getServerApiBaseUrl,
  getFullApiUrl,
  DEPLOYED_SERVER_API_URL,
  roundMoney,
  multiplyMoney,
  divideMoney,
  addMoney,
  subtractMoney,
  calculateCoveredSessions,
  calculateMoneyRemainder,
  formatMoney,
};

let lastAuthDiagnosticsRecord: AuthDiagnostics | null = null;
const executedBulkBatches = new Map<string, BulkCreateSessionsResult>();

const STORAGE_KEYS = {
  STUDENTS: 'tm_v2_students',
  GROUPS: 'tm_v2_groups',
  ENROLLMENTS: 'tm_v2_enrollments',
  SESSIONS: 'tm_v2_sessions',
  ATTENDANCE: 'tm_v2_attendance',
  PAYMENTS: 'tm_v2_payments',
  CREDIT_LOGS: 'tm_v2_session_credit_logs',
  BEHAVIOR_LOGS: 'tm_v2_student_behavior_logs',
  HOMEWORK_TESTS: 'tm_v2_homework_tests',
  HOMEWORK_ASSIGNMENTS: 'tm_v2_homework_assignments',
  HOMEWORK_QUESTION_RESULTS: 'tm_v2_homework_question_results',
  TEACHER_PROFILE: 'tm_v2_teacher_profile',
  NOTIFICATION_SETTINGS: 'tm_v2_notification_settings',
  NOTIFICATION_STATES: 'tm_v2_notification_states',
  ACCOUNTS: 'tm_v2_accounts',
  CURRENT_SESSION: 'tm_v2_current_session',
  AUTO_SYNC_CONFIG: 'tm_v2_auto_sync_config',
  TOMBSTONES: 'tm_v2_deletion_tombstones',
  RESET_ALL_BEFORE: 'tm_v2_reset_all_before',
  PENDING_RESET_PREFIX: 'tm_v2_pending_reset_',
  PENDING_RESETS_LIST: 'tm_v2_pending_resets_list',
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
  const isEn = getAppLanguage().startsWith('en');

  if (isEn) {
    switch (mode) {
      case 'monthly':
        return 'Monthly Subscription';
      case 'prepaid':
        return 'Prepaid (Per Session)';
      case 'postpaid':
        return 'Postpaid (Per Session)';
      case 'per_session':
        return 'Per Session';
      case 'package':
        return 'Session Package';
      case 'hourly':
        return 'Hourly Billing';
      default:
        return 'Per Session';
    }
  }

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
    case 'hourly':
      return 'محاسبة بالساعة (Hourly Billing)';
    default:
      return 'نظام الدفع بالحصة';
  }
}

/**
 * دالة مساعدة مركزية لاحتساب سعر الحصة الفعلي (Effective Session Price)
 * للباقة: Package Total Price ÷ Package Session Count
 * للمحاسبة بالساعة: hourlyRate أو customPrice
 * لغير الباقة: customPrice أو defaultPrice
 */
export function getEffectiveSessionPrice(
  enrollment?: Enrollment | null,
  group?: Group | null
): number {
  if (!enrollment && !group) return 100;

  const isHourly =
    enrollment?.billingMode === 'hourly' ||
    enrollment?.billingType === 'hourly' ||
    group?.billingMode === 'hourly' ||
    group?.billingType === 'hourly';

  if (isHourly) {
    const rawRate = enrollment?.hourlyRate || enrollment?.customPrice || group?.hourlyRate || group?.defaultPrice || 100;
    return roundMoney(rawRate, 2);
  }

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
      return divideMoney(pkgPrice, pkgSessions);
    }
  }

  const rawPrice = enrollment?.customPrice || group?.defaultPrice || 100;
  return roundMoney(rawPrice, 2);
}

const DEFAULT_TEACHER_PROFILE: TeacherProfile = {
  name: 'أستاذ المادة',
  subject: 'المادة الدراسية',
  phone: '',
  centerOrSchool: 'سنتر التفوق التعليمي',
  academicYear: '2025 - 2026',
  currency: 'ج.م',
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enableEarlyPackageWarning: false,
  earlyWarningLessonThreshold: 1,
  enableAttendanceReminders: true,
  enableOverdueReminders: true,
  enableAbsenceReminders: true,
};

// ==========================================
// Homework Launch URL & Share Message Helpers
// ==========================================

export function buildHomeworkLaunchUrl(params: {
  test: HomeworkTest | string;
  student?: Student;
  assignmentId?: string;
}): string {
  const { test } = params;
  let baseUrl = '';

  if (typeof test === 'string') {
    baseUrl = test.trim();
  } else if (test && test.directUrlTemplate && test.directUrlTemplate.trim()) {
    baseUrl = test.directUrlTemplate.trim();
  }

  return baseUrl || '';
}

export function generateAssignmentShareMessage(
  paramsOrAssignment:
    | {
        assignment: HomeworkAssignment;
        student?: Student | { name: string; phone?: string; parentPhone?: string };
        teacherName?: string;
        subject?: string;
      }
    | HomeworkAssignment,
  optionalStudentName?: string
): string {
  let assignment: HomeworkAssignment;
  let studentName = 'طالب';
  let teacherName = 'معلم المادة';
  let subject = 'المادة';

  if ('title' in paramsOrAssignment || 'launchUrl' in paramsOrAssignment) {
    assignment = paramsOrAssignment as HomeworkAssignment;
    studentName = optionalStudentName || assignment.studentName || 'طالب';
    const profile = db.getTeacherProfile();
    teacherName = profile.name || teacherName;
    subject = profile.subject || subject;
  } else {
    const p = paramsOrAssignment as {
      assignment: HomeworkAssignment;
      student?: Student | { name: string };
      teacherName?: string;
      subject?: string;
    };
    assignment = p.assignment;
    studentName = p.student?.name || assignment.studentName || 'طالب';
    teacherName = p.teacherName || db.getTeacherProfile().name || teacherName;
    subject = p.subject || db.getTeacherProfile().subject || subject;
  }

  const deadlineStr = assignment.dueAt
    ? `\n⏰ موعد التسليم: ${new Date(assignment.dueAt).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : '';

  return `السلام عليكم ورحمة الله وبركاته 🌸
مرحباً بالبطل/ة: *${studentName}*

تم إسناد واجب/اختبار إلكتروني جديد بعنوان:
📝 *${assignment.title}*
📚 المادة: *${subject}*
👨‍🏫 إعداد: *${teacherName}*${deadlineStr}

🔗 رابط الاختبار المباشر الخاص بك:
${assignment.launchUrl}

نتمنى لك كل التوفيق والتميز دائماً ✨`;
}

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

// Deletion Tombstone & Sync Management Helpers
export function getDeletionTombstones(userId?: string): DeletionTombstone[] {
  const targetUserId = userId || getActiveUserId();
  const all = getList<DeletionTombstone>(STORAGE_KEYS.TOMBSTONES, []);
  return all.filter((t) => (t.userId ? t.userId === targetUserId : targetUserId === 'acc_master_teacher'));
}

export function addDeletionTombstone(
  entityType: DeletionTombstone['entityType'],
  entityId: string,
  userId?: string
): void {
  const targetUserId = userId || getActiveUserId();
  const now = new Date().toISOString();
  const all = getList<DeletionTombstone>(STORAGE_KEYS.TOMBSTONES, []);

  const existingIdx = all.findIndex(
    (t) => t.id === entityId && t.entityType === entityType && (t.userId === targetUserId || !t.userId)
  );

  const newTombstone: DeletionTombstone = {
    id: entityId,
    entityType,
    userId: targetUserId,
    deletedAt: now,
  };

  if (existingIdx >= 0) {
    all[existingIdx] = newTombstone;
  } else {
    all.push(newTombstone);
  }
  saveList(STORAGE_KEYS.TOMBSTONES, all);
}

export function removeDeletionTombstone(
  entityType: DeletionTombstone['entityType'],
  entityId: string,
  userId?: string
): void {
  const targetUserId = userId || getActiveUserId();
  const all = getList<DeletionTombstone>(STORAGE_KEYS.TOMBSTONES, []);
  const remaining = all.filter(
    (t) => !(t.id === entityId && t.entityType === entityType && (t.userId === targetUserId || (!t.userId && targetUserId === 'acc_master_teacher')))
  );
  saveList(STORAGE_KEYS.TOMBSTONES, remaining);
}

export function saveDeletionTombstones(tombstones: DeletionTombstone[], userId?: string): void {
  const targetUserId = userId || getActiveUserId();
  const all = getList<DeletionTombstone>(STORAGE_KEYS.TOMBSTONES, []).filter(
    (t) => (t.userId ? t.userId !== targetUserId : targetUserId !== 'acc_master_teacher')
  );

  const map = new Map<string, DeletionTombstone>();
  for (const t of tombstones || []) {
    if (t && t.id && t.entityType) {
      const key = `${t.entityType}:${t.id}`;
      const existing = map.get(key);
      if (!existing || new Date(t.deletedAt).getTime() > new Date(existing.deletedAt).getTime()) {
        map.set(key, { ...t, userId: targetUserId });
      }
    }
  }

  saveList(STORAGE_KEYS.TOMBSTONES, [...all, ...Array.from(map.values())]);
}

export function getResetAllBefore(userId?: string): string | undefined {
  const targetUserId = userId || getActiveUserId();
  try {
    const val = localStorage.getItem(`${STORAGE_KEYS.RESET_ALL_BEFORE}_${targetUserId}`);
    if (val) return val;
  } catch {}
  return undefined;
}

export function setResetAllBefore(timestampIso: string, userId?: string): void {
  const targetUserId = userId || getActiveUserId();
  try {
    localStorage.setItem(`${STORAGE_KEYS.RESET_ALL_BEFORE}_${targetUserId}`, timestampIso);
  } catch {}
}

export function getPendingReset(userId?: string): PendingResetRecord | null {
  const targetUserId = userId || getActiveUserId();
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.PENDING_RESET_PREFIX}${targetUserId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.resetAllBefore) return parsed;
    }
  } catch {}

  // Check accounts list fallback
  try {
    const accounts = getList<UserAccount>(STORAGE_KEYS.ACCOUNTS, []);
    const acc = accounts.find((a) => a.id === targetUserId);
    if (acc?.pendingReset && acc.pendingReset.resetAllBefore) {
      return acc.pendingReset;
    }
  } catch {}

  return null;
}

export function getAllPendingResets(): PendingResetRecord[] {
  const map = new Map<string, PendingResetRecord>();
  try {
    const rawList = localStorage.getItem(STORAGE_KEYS.PENDING_RESETS_LIST);
    if (rawList) {
      const list: PendingResetRecord[] = JSON.parse(rawList);
      for (const item of list) {
        if (item && item.userId && item.resetAllBefore) {
          map.set(item.userId, item);
        }
      }
    }
  } catch {}

  try {
    const accounts = getList<UserAccount>(STORAGE_KEYS.ACCOUNTS, []);
    for (const acc of accounts) {
      if (acc.pendingReset && acc.pendingReset.userId && acc.pendingReset.resetAllBefore) {
        map.set(acc.pendingReset.userId, acc.pendingReset);
      }
    }
  } catch {}

  return Array.from(map.values());
}

export function setPendingReset(record: PendingResetRecord): void {
  try {
    localStorage.setItem(
      `${STORAGE_KEYS.PENDING_RESET_PREFIX}${record.userId}`,
      JSON.stringify(record)
    );
  } catch {}

  try {
    const all = getAllPendingResets().filter((r) => r.userId !== record.userId);
    localStorage.setItem(STORAGE_KEYS.PENDING_RESETS_LIST, JSON.stringify([record, ...all]));
  } catch {}

  // Also sync into accounts
  try {
    const accounts = getList<UserAccount>(STORAGE_KEYS.ACCOUNTS, []);
    const updated = accounts.map((acc) => {
      if (acc.id === record.userId) {
        return {
          ...acc,
          resetAllBefore: record.resetAllBefore,
          pendingReset: record,
        };
      }
      return acc;
    });
    saveList(STORAGE_KEYS.ACCOUNTS, updated);
  } catch {}
}

export function clearPendingReset(userId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEYS.PENDING_RESET_PREFIX}${userId}`);
  } catch {}

  try {
    const all = getAllPendingResets().filter((r) => r.userId !== userId);
    localStorage.setItem(STORAGE_KEYS.PENDING_RESETS_LIST, JSON.stringify(all));
  } catch {}

  try {
    const accounts = getList<UserAccount>(STORAGE_KEYS.ACCOUNTS, []);
    const updated = accounts.map((acc) => {
      if (acc.id === userId) {
        const { pendingReset, ...rest } = acc;
        return rest;
      }
      return acc;
    });
    saveList(STORAGE_KEYS.ACCOUNTS, updated);
  } catch {}
}

export async function syncResetToCloud(
  userId: string,
  resetAllBefore: string,
  explicitToken?: string
): Promise<{
  success: boolean;
  acknowledged: boolean;
  verifiedActiveStudents?: number;
  error?: string;
}> {
  const resetUrl = getFullApiUrl('/api/sync/reset');
  let token = explicitToken;
  if (!token) {
    try {
      token = localStorage.getItem(`tm_v2_auth_token_${userId}`) || undefined;
    } catch {}
  }
  if (!token) {
    try {
      const session = db.getCurrentSession();
      if (session?.id === userId && session.authToken) {
        token = session.authToken;
      }
    } catch {}
  }

  console.log(`[Storage -> Cloud Reset] Sending awaited reset request for ${userId} to ${resetUrl} with resetAllBefore ${resetAllBefore}`);

  try {
    const res = await universalApiFetch(resetUrl, {
      method: 'POST',
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
            'x-auth-token': token,
          }
        : undefined,
      body: {
        resetAllBefore,
      },
      timeoutMs: 15000,
    });

    if (res.ok && res.data && res.data.success && res.data.acknowledged) {
      console.log(`[Storage -> Cloud Reset] Server confirmed and acknowledged reset for ${userId}:`, res.data);
      clearPendingReset(userId);
      setResetAllBefore(res.data.resetAllBefore || resetAllBefore, userId);
      return {
        success: true,
        acknowledged: true,
        verifiedActiveStudents: res.data.verifiedActiveStudents ?? 0,
      };
    } else {
      const err = res.data?.error || res.error || 'Server did not acknowledge reset';
      console.warn(`[Storage -> Cloud Reset] Server reset failed or not acknowledged:`, err);
      return {
        success: false,
        acknowledged: false,
        error: err,
      };
    }
  } catch (err: any) {
    console.warn(`[Storage -> Cloud Reset] Network exception during cloud reset:`, err);
    return {
      success: false,
      acknowledged: false,
      error: err.message || 'Network error during cloud reset',
    };
  }
}

export async function processPendingResets(targetUserId?: string): Promise<void> {
  const resets = targetUserId
    ? [getPendingReset(targetUserId)].filter(Boolean) as PendingResetRecord[]
    : getAllPendingResets();

  for (const record of resets) {
    if (!record || !record.userId || !record.resetAllBefore) continue;
    try {
      console.log(`[Storage -> Process Pending Resets] Retrying cloud reset for ${record.userId}...`);
      const res = await syncResetToCloud(record.userId, record.resetAllBefore);
      if (res.acknowledged) {
        console.log(`[Storage -> Process Pending Resets] Successfully cleared pending reset for ${record.userId}`);
      }
    } catch (e) {
      console.warn(`[Storage -> Process Pending Resets] Failed retry for ${record.userId}:`, e);
    }
  }
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

    // Migrate homework tests
    const rawHwTests = getList<HomeworkTest>(STORAGE_KEYS.HOMEWORK_TESTS, []);
    let hwTestsChanged = false;
    const migratedHwTests = rawHwTests.map((t) => {
      if (!t.userId) {
        hwTestsChanged = true;
        return { ...t, userId: defaultUserId };
      }
      return t;
    });
    if (hwTestsChanged) saveList(STORAGE_KEYS.HOMEWORK_TESTS, migratedHwTests);

    // Migrate homework assignments
    const rawHwAssignments = getList<HomeworkAssignment>(STORAGE_KEYS.HOMEWORK_ASSIGNMENTS, []);
    let hwAssignmentsChanged = false;
    const migratedHwAssignments = rawHwAssignments.map((a) => {
      if (!a.userId) {
        hwAssignmentsChanged = true;
        return { ...a, userId: defaultUserId };
      }
      return a;
    });
    if (hwAssignmentsChanged) saveList(STORAGE_KEYS.HOMEWORK_ASSIGNMENTS, migratedHwAssignments);

    // Migrate behavior logs
    const rawBehaviorLogs = getList<StudentBehaviorLog>(STORAGE_KEYS.BEHAVIOR_LOGS, []);
    let behaviorLogsChanged = false;
    const migratedBehaviorLogs = rawBehaviorLogs.map((b) => {
      if (!b.userId) {
        behaviorLogsChanged = true;
        return { ...b, userId: defaultUserId };
      }
      return b;
    });
    if (behaviorLogsChanged) saveList(STORAGE_KEYS.BEHAVIOR_LOGS, migratedBehaviorLogs);
  } catch (err) {
    console.error('Migration error:', err);
  }
}

// Run migration safely on module load
ensureDataMigrated();

/**
 * دالة مزامنة بيانات المستخدم مع حسابه تلقائياً
 * تقوم بجمع كافة الطلاب والمجموعات والحصص والاشتراكات والحضور والمدفوعات والواجبات
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
  const allBehaviorLogs = getList<StudentBehaviorLog>(STORAGE_KEYS.BEHAVIOR_LOGS, []);
  const allHomeworkTests = getList<HomeworkTest>(STORAGE_KEYS.HOMEWORK_TESTS, []);
  const allHomeworkAssignments = getList<HomeworkAssignment>(STORAGE_KEYS.HOMEWORK_ASSIGNMENTS, []);
  const allHomeworkQuestionResults = getList<HomeworkQuestionResult>(STORAGE_KEYS.HOMEWORK_QUESTION_RESULTS, []);

  const userStudents = allStudents.filter((s) => (s.userId ? s.userId === targetUserId : targetUserId === 'acc_master_teacher'));
  const userGroups = allGroups.filter((g) => (g.userId ? g.userId === targetUserId : targetUserId === 'acc_master_teacher'));
  const userEnrollments = allEnrollments.filter((e) => (e.userId ? e.userId === targetUserId : targetUserId === 'acc_master_teacher'));
  const userSessions = allSessions.filter((s) => (s.userId ? s.userId === targetUserId : targetUserId === 'acc_master_teacher'));
  const userAttendance = allAttendance.filter((a) => (a.userId ? a.userId === targetUserId : targetUserId === 'acc_master_teacher'));
  const userPayments = allPayments.filter((p) => (p.userId ? p.userId === targetUserId : targetUserId === 'acc_master_teacher'));
  const userCreditLogs = allCreditLogs.filter((l) => (l.userId ? l.userId === targetUserId : targetUserId === 'acc_master_teacher'));
  const userBehaviorLogs = allBehaviorLogs.filter((b) => (b.userId ? b.userId === targetUserId : targetUserId === 'acc_master_teacher'));
  const userHomeworkTests = allHomeworkTests.filter((t) => (t.userId ? t.userId === targetUserId : targetUserId === 'acc_master_teacher'));
  const userHomeworkAssignments = allHomeworkAssignments.filter((a) => (a.userId ? a.userId === targetUserId : targetUserId === 'acc_master_teacher'));

  const userAssignmentIds = new Set(userHomeworkAssignments.map((a) => a.id));
  const userHomeworkQuestionResults = allHomeworkQuestionResults.filter((r) => userAssignmentIds.has(r.assignmentId));

  let userProfile: TeacherProfile = DEFAULT_TEACHER_PROFILE;
  try {
    const rawProfile = localStorage.getItem(`${STORAGE_KEYS.TEACHER_PROFILE}_${targetUserId}`);
    if (rawProfile) userProfile = JSON.parse(rawProfile);
  } catch {}

  const nowIso = new Date().toISOString();
  const userTombstones = getDeletionTombstones(targetUserId);
  const resetAllBefore = getResetAllBefore(targetUserId);

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
    behaviorLogs: userBehaviorLogs,
    homeworkTests: userHomeworkTests,
    homeworkAssignments: userHomeworkAssignments,
    homeworkQuestionResults: userHomeworkQuestionResults,
    teacherProfile: userProfile,
    tombstones: userTombstones,
    resetAllBefore,
    stats: {
      totalStudents: userStudents.length,
      totalGroups: userGroups.length,
      totalSessions: userSessions.length,
      totalPayments: userPayments.length,
      totalHomeworkAssignments: userHomeworkAssignments.length,
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
    const rawTok = localStorage.getItem(`tm_v2_auth_token_${userId}`);
    if (rawTok && rawTok.trim()) return rawTok.trim();
  } catch {}
  try {
    const accounts = db.getAccounts();
    const acc = accounts.find((a) => a.id === userId);
    if (acc && acc.authToken && acc.authToken.trim()) return acc.authToken.trim();
  } catch {}
  try {
    const current = db.getCurrentSession();
    if (current && current.id === userId && current.authToken && current.authToken.trim()) {
      return current.authToken.trim();
    }
  } catch {}
  return '';
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

  // 3. Dispatch cloud sync directly to standalone Cloud Run Express backend (/api/sync/merge)
  try {
    console.log(`[Sync] Initiating cloud sync for user ${targetUserId} to Cloud Run backend...`);
    const token = getAuthTokenForUser(targetUserId);

    const res = await universalApiFetch(syncApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-auth-token': token,
      },
      body: {
        userId: targetUserId,
        token: token,
        dataPackage: localPackage,
      },
      timeoutMs: 15000,
    });

    if (res.ok && res.data && res.data.success) {
      const resData = res.data;
      if (resData.merged && resData.dataPackage) {
        db.restoreAccountData(targetUserId, resData.dataPackage);
      }

      const nextSync = config.frequency !== 'off' ? calculateNextSyncTime(config.frequency) : null;
      const finalPackage = (resData.dataPackage || localPackage) as UserAccountDataPackage;

      console.log(`[Sync] Sync attempt result: SUCCESS - Synced with Cloud Run Backend (${finalPackage.stats?.totalStudents || 0} students, ${finalPackage.stats?.totalGroups || 0} groups, ${finalPackage.stats?.totalSessions || 0} sessions)`);

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
      const errorDetail = res.data?.error || res.error || `HTTP ${res.status}`;
      throw new Error(errorDetail);
    }
  } catch (netErr: any) {
    const isTimeout = netErr?.name === 'AbortError' || String(netErr?.message).includes('Timeout');
    const failureReason = isTimeout ? 'Request timed out' : netErr?.message || 'Network fetch error';
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

  try {
    console.log(`[Sync] Pulling cloud data package for user ${targetUserId} from Cloud Run backend...`);
    const token = getAuthTokenForUser(targetUserId);
    const pullUrl = getFullApiUrl('/api/sync/pull');

    const res = await universalApiFetch(pullUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-auth-token': token,
      },
      timeoutMs: 15000,
    });

    if (res.ok && res.data) {
      const data = res.data;
      if (data.success && data.dataPackage) {
        db.restoreAccountData(targetUserId, data.dataPackage);
        return { success: true, dataPackage: data.dataPackage };
      }
      return { success: true, dataPackage: null };
    } else {
      return { success: false, error: res.data?.error || res.error || `HTTP ${res.status}` };
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

    const res = await universalApiFetch(loginUrl, {
      method: 'POST',
      body: credentials,
      timeoutMs: 15000,
    });

    if (res.ok && res.data) {
      const data = res.data;
      if (data.success) {
        return { success: true, token: data.token, user: data.user };
      }
      return { success: false, error: data.error || 'Login failed' };
    } else {
      return { success: false, error: res.error || `HTTP ${res.status}` };
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
        badgeClass: 'bg-[#FF647C]/15 text-[#FF647C] border border-[#FF647C]/30',
        iconType: 'offline',
      };
    }
    return {
      label: 'مؤجل - لا يوجد اتصال بالإنترنت (البيانات محفوظة محلياً)',
      badgeClass: 'bg-[#FF647C]/15 text-[#FF647C] border border-[#FF647C]/30',
      iconType: 'offline',
    };
  }

  switch (status) {
    case 'syncing':
      return {
        label: 'جاري مزامنة البيانات مع السحابة...',
        badgeClass: 'bg-[#55C7E8]/15 text-[#0284C7] border border-[#55C7E8]/30',
        iconType: 'syncing',
      };
    case 'success':
    case 'idle':
      return {
        label: 'متزامن وجاهز (جميع البيانات مؤمنة بالسحابة)',
        badgeClass: 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30',
        iconType: 'success',
      };
    case 'error':
      return {
        label: 'فشلت المزامنة الأخيرة (البيانات مؤمنة ومحفوظة محلياً)',
        badgeClass: 'bg-[#FF647C]/15 text-[#FF647C] border border-[#FF647C]/30',
        iconType: 'error',
      };
    default:
      return {
        label: 'متزامن وجاهز',
        badgeClass: 'bg-[#7657F6]/15 text-[#7657F6] border border-[#7657F6]/30',
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
      return roundMoney(defaultGroupPrice, 2);
    case 'fixed_discount':
      return Math.max(0, roundMoney(defaultGroupPrice - (modifierValue || 0), 2));
    case 'percentage_discount':
      return Math.max(0, roundMoney(defaultGroupPrice * (1 - (modifierValue || 0) / 100), 2));
    case 'fixed_increase':
      return roundMoney(defaultGroupPrice + (modifierValue || 0), 2);
    case 'percentage_increase':
      return roundMoney(defaultGroupPrice * (1 + (modifierValue || 0) / 100), 2);
    case 'custom_price':
      return Math.max(0, roundMoney(modifierValue || 0, 2));
    default:
      return roundMoney(defaultGroupPrice, 2);
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
    const now = new Date().toISOString();
    const studentWithUser: Student = {
      ...student,
      userId: student.userId || activeUserId,
      updatedAt: now,
      createdAt: student.createdAt || now,
    };
    removeDeletionTombstone('student', student.id, activeUserId);
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

    // 1. Add tombstone for student
    addDeletionTombstone('student', id, activeUserId);

    // 2. Cascade tombstones for associated enrollments
    const enrollments = getList<Enrollment>(STORAGE_KEYS.ENROLLMENTS, []);
    const studentEnrollments = enrollments.filter((e) => e.studentId === id);
    studentEnrollments.forEach((e) => addDeletionTombstone('enrollment', e.id, activeUserId));

    // 3. Cascade tombstones for associated payments
    const payments = getList<Payment>(STORAGE_KEYS.PAYMENTS, []);
    const studentPayments = payments.filter((p) => p.studentId === id);
    studentPayments.forEach((p) => addDeletionTombstone('payment', p.id, activeUserId));

    // 4. Cascade tombstones for associated attendance
    const attendance = getList<Attendance>(STORAGE_KEYS.ATTENDANCE, []);
    const studentAtt = attendance.filter((a) => a.studentId === id);
    studentAtt.forEach((a) => addDeletionTombstone('attendance', a.id, activeUserId));

    // 5. Update local storage
    const list = getList<Student>(STORAGE_KEYS.STUDENTS, []).filter((s) => s.id !== id);
    saveList(STORAGE_KEYS.STUDENTS, list);
    saveList(STORAGE_KEYS.ENROLLMENTS, enrollments.filter((e) => e.studentId !== id));
    saveList(STORAGE_KEYS.PAYMENTS, payments.filter((p) => p.studentId !== id));
    saveList(STORAGE_KEYS.ATTENDANCE, attendance.filter((a) => a.studentId !== id));

    autoSyncUserAccount(activeUserId);
    performFullSync(activeUserId, false).catch(() => {});
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
    const now = new Date().toISOString();
    const groupWithUser: Group = {
      ...group,
      userId: group.userId || activeUserId,
      updatedAt: now,
      createdAt: group.createdAt || now,
    };
    removeDeletionTombstone('group', group.id, activeUserId);
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

    // 1. Tombstone group
    addDeletionTombstone('group', id, activeUserId);

    // 2. Cascade tombstone enrollments
    const enrollments = getList<Enrollment>(STORAGE_KEYS.ENROLLMENTS, []);
    const groupEnrollments = enrollments.filter((e) => e.groupId === id);
    groupEnrollments.forEach((e) => addDeletionTombstone('enrollment', e.id, activeUserId));

    // 3. Cascade tombstone sessions & attendance
    const sessions = getList<Session>(STORAGE_KEYS.SESSIONS, []);
    const groupSessions = sessions.filter((s) => s.groupId === id);
    groupSessions.forEach((s) => addDeletionTombstone('session', s.id, activeUserId));

    const sessionIds = new Set(groupSessions.map((s) => s.id));
    const attendance = getList<Attendance>(STORAGE_KEYS.ATTENDANCE, []);
    const groupAtt = attendance.filter((a) => sessionIds.has(a.sessionId));
    groupAtt.forEach((a) => addDeletionTombstone('attendance', a.id, activeUserId));

    // 4. Update local storage
    const list = getList<Group>(STORAGE_KEYS.GROUPS, []).filter((g) => g.id !== id);
    saveList(STORAGE_KEYS.GROUPS, list);
    saveList(STORAGE_KEYS.ENROLLMENTS, enrollments.filter((e) => e.groupId !== id));
    saveList(STORAGE_KEYS.SESSIONS, sessions.filter((s) => s.groupId !== id));
    saveList(STORAGE_KEYS.ATTENDANCE, attendance.filter((a) => !sessionIds.has(a.sessionId)));

    autoSyncUserAccount(activeUserId);
    performFullSync(activeUserId, false).catch(() => {});
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
    const group = db.getGroupById(groupId);
    const enrollments = db.getGroupEnrollments(groupId).filter((e) => {
      if (group && group.type !== 'private') {
        return e.serviceType !== 'private';
      }
      return true;
    });
    const studentIds = new Set(enrollments.map((e) => e.studentId));
    return db.getStudents().filter((s) => studentIds.has(s.id) && s.status !== 'archived');
  },

  getStudentGroups: (studentId: string): { group: Group; enrollment: Enrollment }[] => {
    const enrollments = db.getStudentEnrollments(studentId);
    const groups = db.getGroups();
    const result: { group: Group; enrollment: Enrollment }[] = [];

    for (const enr of enrollments) {
      const g = groups.find((grp) => grp.id === enr.groupId);
      // ONLY REAL GROUPS: Not private pseudo-groups and not serviceType private
      if (g && g.type !== 'private' && enr.serviceType !== 'private') {
        result.push({ group: g, enrollment: enr });
      }
    }
    return result;
  },

  getStudentPrivateEnrollments: (studentId: string): { group?: Group; enrollment: Enrollment }[] => {
    const enrollments = db.getStudentEnrollments(studentId);
    const groups = db.getGroups();
    const result: { group?: Group; enrollment: Enrollment }[] = [];

    for (const enr of enrollments) {
      const g = groups.find((grp) => grp.id === enr.groupId);
      if (enr.serviceType === 'private' || g?.type === 'private') {
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
      hourlyRate?: number;
      billingType?: BillingType;
      billingMode?: BillingMode;
      packageSessionsCount?: number;
      packagePrice?: number;
      scheduleDays?: string[];
      scheduleTime?: string;
      scheduleTimes?: Record<string, string | string[]>;
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
    const packageSessions = isPackage ? (options.packageSessionsCount && options.packageSessionsCount > 0 ? options.packageSessionsCount : 10) : undefined;
    const packagePrice = isPackage ? (options.packagePrice || options.sessionPrice) : undefined;
    const effectivePrice = isPackage && packageSessions && packagePrice
      ? divideMoney(packagePrice, packageSessions)
      : roundMoney(options.sessionPrice, 2);

    const newGroup: Group = {
      id: `grp_priv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: options.subject ? `درس خاص - ${options.subject}` : 'درس خاص',
      subject: options.subject,
      gradeLevel: grade,
      type: 'private',
      billingType: resolvedBilling,
      billingMode: resolvedMode,
      defaultPrice: isPackage && packagePrice ? roundMoney(packagePrice, 2) : roundMoney(options.sessionPrice, 2),
      hourlyRate: options.hourlyRate ? roundMoney(options.hourlyRate, 2) : undefined,
      packageSessionsCount: packageSessions,
      scheduleDays: options.scheduleDays || ['السبت'],
      scheduleTime: options.scheduleTime || '04:00 م',
      scheduleTimes: options.scheduleTimes,
      roomOrLocation: options.roomOrLocation || 'منزل الطالب / أونلاين',
      accentColor: '#FF647C', // Coral accent for private lessons
      notes: options.notes || '',
      createdAt: new Date().toISOString(),
    };

    db.saveGroup(newGroup);

    const enrollment = db.enrollStudent(studentId, newGroup.id, {
      serviceType: 'private',
      billingType: resolvedBilling,
      billingMode: resolvedMode,
      hourlyRate: options.hourlyRate,
      pricingType: 'same_as_group',
      customPrice: effectivePrice,
      packageSessionsCount: packageSessions,
      packagePrice: packagePrice,
      scheduleDays: options.scheduleDays,
      scheduleTime: options.scheduleTime,
      scheduleTimes: options.scheduleTimes,
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

    const now = new Date().toISOString();
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
      updatedAt: now,
      createdAt: now,
    };

    removeDeletionTombstone('enrollment', newEnrollment.id, activeUserId);
    const allEnrollments = getList<Enrollment>(STORAGE_KEYS.ENROLLMENTS, []);
    allEnrollments.unshift(newEnrollment);
    saveList(STORAGE_KEYS.ENROLLMENTS, allEnrollments);
    autoSyncUserAccount(activeUserId);
    return newEnrollment;
  },

  removeEnrollment: (enrollmentId: string): void => {
    const activeUserId = getActiveUserId();
    addDeletionTombstone('enrollment', enrollmentId, activeUserId);
    const list = getList<Enrollment>(STORAGE_KEYS.ENROLLMENTS, []).filter((e) => e.id !== enrollmentId);
    saveList(STORAGE_KEYS.ENROLLMENTS, list);
    autoSyncUserAccount(activeUserId);
  },

  updateEnrollment: (enrollment: Enrollment): void => {
    const activeUserId = getActiveUserId();
    const now = new Date().toISOString();
    removeDeletionTombstone('enrollment', enrollment.id, activeUserId);
    const list = getList<Enrollment>(STORAGE_KEYS.ENROLLMENTS, []);
    const idx = list.findIndex((e) => e.id === enrollment.id);
    if (idx >= 0) {
      list[idx] = {
        ...enrollment,
        userId: enrollment.userId || list[idx].userId || activeUserId,
        updatedAt: now,
      };
      saveList(STORAGE_KEYS.ENROLLMENTS, list);
      autoSyncUserAccount(activeUserId);
    }
  },

  /**
   * تعديل نظام وأسعار محاسبة اشتراك طالب (بدون المساس بالسجلات والحصص السابقة)
   */
  updateEnrollmentBilling: (
    enrollmentId: string,
    updates: {
      billingType: BillingType;
      billingMode?: BillingMode;
      customPrice: number;
      hourlyRate?: number;
      baseSessionsPerMonth?: number;
      extraSessionPrice?: number;
      packageSessionsCount?: number;
      packagePrice?: number;
    }
  ): Enrollment | undefined => {
    const enr = db.getEnrollmentById(enrollmentId);
    if (!enr) return undefined;

    const updated: Enrollment = {
      ...enr,
      billingType: updates.billingType,
      billingMode: updates.billingMode || (updates.billingType as any),
      customPrice: updates.customPrice,
      hourlyRate: updates.hourlyRate,
      baseSessionsPerMonth: updates.baseSessionsPerMonth,
      extraSessionPrice: updates.extraSessionPrice,
      packageSessionsCount: updates.packageSessionsCount,
      packagePrice: updates.packagePrice,
    };

    db.updateEnrollment(updated);
    return updated;
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
    const now = new Date().toISOString();
    const sessionWithUser: Session = {
      ...session,
      userId: session.userId || activeUserId,
      updatedAt: now,
      createdAt: session.createdAt || now,
    };
    removeDeletionTombstone('session', session.id, activeUserId);
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
    hours?: number;
    hourlyRate?: number;
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

    const isHourly =
      enrollment?.billingMode === 'hourly' ||
      enrollment?.billingType === 'hourly' ||
      group?.billingMode === 'hourly' ||
      group?.billingType === 'hourly' ||
      (params.hours !== undefined && params.hours > 0);

    const hours = params.hours && params.hours > 0 ? params.hours : 1;
    const hourlyRate = params.hourlyRate || enrollment?.hourlyRate || enrollment?.customPrice || group?.hourlyRate || group?.defaultPrice || 100;

    const isPackage =
      !isHourly && (
        enrollment?.billingMode === 'package' ||
        enrollment?.billingType === 'package' ||
        group?.billingMode === 'package' ||
        group?.billingType === 'package'
      );

    const packageSessionsCount = isPackage
      ? (enrollment?.packageSessionsCount || group?.packageSessionsCount || 10)
      : undefined;

    const packageTotalPrice = isPackage
      ? (enrollment?.packagePrice ||
         (group?.billingMode === 'package' || group?.billingType === 'package' ? group.defaultPrice : undefined) ||
         enrollment?.customPrice ||
         1000)
      : undefined;

    // Effective Session Price
    let effectiveSessionPrice = roundMoney(enrollment?.customPrice || group?.defaultPrice || 100, 2);
    if (isHourly) {
      effectiveSessionPrice = multiplyMoney(hours, hourlyRate);
    } else if (isPackage && packageSessionsCount && packageTotalPrice) {
      effectiveSessionPrice = divideMoney(packageTotalPrice, packageSessionsCount);
    }

    const totalSessionValue = multiplyMoney(count, effectiveSessionPrice);
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
        hours: isHourly ? hours : undefined,
        hourlyRate: isHourly ? hourlyRate : undefined,
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
        hours: isHourly ? hours : undefined,
        hourlyRate: isHourly ? hourlyRate : undefined,
        absenceReason: params.absenceReason || (isCancelled ? 'حصة ملغاة' : undefined),
        recordedAt: new Date().toISOString(),
        notes: params.notes || (params.absenceReason ? `سبب الغياب: ${params.absenceReason}` : undefined),
      };

      db.saveAttendanceBatch(newSession.id, [attendanceRec]);
    }

    return createdSessions;
  },

  /**
   * تسجيل حصة أو أكثر لعدة طلاب دفعة واحدة، مع احتساب النظام المالي والتسعير الخاص بكل طالب
   */
  recordBulkSessionsForStudents: (params: BulkCreateSessionsParams): BulkCreateSessionsResult => {
    const activeUserId = getActiveUserId();
    const count = Math.max(1, Math.floor(params.sessionCount || 1));
    const idempotencyKey = params.idempotencyKey?.trim();

    if (idempotencyKey && executedBulkBatches.has(idempotencyKey)) {
      return executedBulkBatches.get(idempotencyKey)!;
    }

    const createdSessions: Session[] = [];
    const results: BulkStudentResultItem[] = [];
    let totalCreated = 0;

    const parsedDate = new Date(params.date);
    const month = !isNaN(parsedDate.getTime()) ? parsedDate.getMonth() + 1 : new Date().getMonth() + 1;
    const year = !isNaN(parsedDate.getTime()) ? parsedDate.getFullYear() : new Date().getFullYear();
    const dayName = !isNaN(parsedDate.getTime()) ? getArabicDayName(params.date) : 'السبت';

    for (const target of params.students) {
      const student = db.getStudentById(target.studentId);
      const enrollment = db.getEnrollmentById(target.enrollmentId);
      const group = db.getGroupById(target.groupId);

      if (!student) {
        results.push({
          studentId: target.studentId,
          studentName: 'غير معروف',
          enrollmentId: target.enrollmentId,
          groupId: target.groupId,
          groupName: group?.name || 'غير محدد',
          sessionsCreated: 0,
          billingMode: 'postpaid',
          chargedAmountPerSession: 0,
          totalAmount: 0,
          success: false,
          error: 'Student not found in database',
        });
        continue;
      }

      if (!enrollment || !group) {
        results.push({
          studentId: target.studentId,
          studentName: student.name,
          enrollmentId: target.enrollmentId,
          groupId: target.groupId,
          groupName: group?.name || 'غير محدد',
          sessionsCreated: 0,
          billingMode: 'postpaid',
          chargedAmountPerSession: 0,
          totalAmount: 0,
          success: false,
          error: 'Enrollment or Group not found',
        });
        continue;
      }

      const billingMode: BillingMode =
        enrollment.billingMode ||
        (enrollment.billingType === 'hourly' ? 'hourly' : enrollment.billingType === 'monthly' ? 'monthly' : enrollment.billingType === 'package' ? 'package' : enrollment.billingType === 'prepaid' ? 'prepaid' : 'postpaid') ||
        group.billingMode ||
        (group.billingType === 'hourly' ? 'hourly' : group.billingType === 'monthly' ? 'monthly' : group.billingType === 'package' ? 'package' : group.billingType === 'prepaid' ? 'prepaid' : 'postpaid') ||
        'postpaid';

      const isHourly =
        billingMode === 'hourly' ||
        enrollment.billingType === 'hourly' ||
        group.billingType === 'hourly' ||
        (target.hours !== undefined && target.hours > 0);

      const hours = target.hours && target.hours > 0 ? target.hours : 1;
      const hourlyRate =
        target.hourlyRate ||
        enrollment.hourlyRate ||
        enrollment.customPrice ||
        group.hourlyRate ||
        group.defaultPrice ||
        100;

      const isPackage =
        !isHourly &&
        (billingMode === 'package' ||
          enrollment.billingType === 'package' ||
          group.billingType === 'package');

      const packageSessionsCount = isPackage
        ? (enrollment.packageSessionsCount || group.packageSessionsCount || 10)
        : undefined;

      const packageTotalPrice = isPackage
        ? (enrollment.packagePrice ||
            (group.billingMode === 'package' || group.billingType === 'package' ? group.defaultPrice : undefined) ||
            enrollment.customPrice ||
            1000)
        : undefined;

      // Effective Session Price
      let effectiveSessionPrice = roundMoney(enrollment.customPrice || group.defaultPrice || 100, 2);
      if (isHourly) {
        effectiveSessionPrice = multiplyMoney(hours, hourlyRate);
      } else if (isPackage && packageSessionsCount && packageTotalPrice) {
        effectiveSessionPrice = divideMoney(packageTotalPrice, packageSessionsCount);
      }

      const totalStudentValue = multiplyMoney(count, effectiveSessionPrice);
      const packageId = isPackage ? (enrollment.groupId || group.id || `pkg_${enrollment.id}`) : undefined;
      const baseTitle = params.title?.trim() || `حصة دراسية: ${student.name}`;

      let studentSessionsCreated = 0;

      for (let i = 1; i <= count; i++) {
        const sessionSuffix = count > 1 ? ` (حصة ${i} من ${count})` : '';
        const sessionId = `ses_bulk_${Date.now()}_${student.id}_${i}_${Math.random().toString(36).substr(2, 6)}`;

        const newSession: Session = {
          id: sessionId,
          userId: activeUserId,
          groupId: target.groupId,
          enrollmentId: target.enrollmentId,
          studentId: target.studentId,
          packageId,
          title: `${baseTitle}${sessionSuffix}`,
          date: params.date,
          dayName,
          month,
          year,
          startTime: params.startTime || '16:00',
          endTime: params.endTime,
          status: params.status || 'completed',
          pricePerStudent: effectiveSessionPrice,
          hours: isHourly ? hours : undefined,
          hourlyRate: isHourly ? hourlyRate : undefined,
          sessionCount: 1,
          effectiveSessionPrice,
          totalSessionValue: effectiveSessionPrice,
          packageTotalPrice,
          packageSessionsCount,
          notes: params.notes || '',
          createdAt: new Date().toISOString(),
          billingModeSnapshot: billingMode,
          billingTypeSnapshot: enrollment.billingType,
          hourlyRateSnapshot: isHourly ? hourlyRate : undefined,
          sessionPriceSnapshot: enrollment.customPrice || group.defaultPrice,
          effectivePriceSnapshot: effectiveSessionPrice,
          packagePriceSnapshot: packageTotalPrice,
          packageSessionsCountSnapshot: packageSessionsCount,
          hoursSnapshot: isHourly ? hours : undefined,
        };

        db.saveSession(newSession);
        createdSessions.push(newSession);

        const attendanceRec: Attendance = {
          id: `att_bulk_${Date.now()}_${student.id}_${i}_${Math.random().toString(36).substr(2, 6)}`,
          userId: activeUserId,
          sessionId: newSession.id,
          studentId: target.studentId,
          enrollmentId: target.enrollmentId,
          status: params.attendanceStatus || 'present',
          isCharged: params.isCharged !== undefined ? params.isCharged : true,
          hours: isHourly ? hours : undefined,
          hourlyRate: isHourly ? hourlyRate : undefined,
          recordedAt: new Date().toISOString(),
          notes: params.notes || '',
          billingModeSnapshot: billingMode,
          billingTypeSnapshot: enrollment.billingType,
          hourlyRateSnapshot: isHourly ? hourlyRate : undefined,
          sessionPriceSnapshot: enrollment.customPrice || group.defaultPrice,
          effectivePriceSnapshot: effectiveSessionPrice,
          packagePriceSnapshot: packageTotalPrice,
          packageSessionsCountSnapshot: packageSessionsCount,
          hoursSnapshot: isHourly ? hours : undefined,
        };

        db.saveAttendanceBatch(newSession.id, [attendanceRec]);
        studentSessionsCreated++;
        totalCreated++;
      }

      results.push({
        studentId: student.id,
        studentName: student.name,
        enrollmentId: target.enrollmentId,
        groupId: target.groupId,
        groupName: group.name,
        sessionsCreated: studentSessionsCreated,
        billingMode,
        chargedAmountPerSession: effectiveSessionPrice,
        totalAmount: totalStudentValue,
        success: true,
      });
    }

    const finalResult: BulkCreateSessionsResult = {
      success: results.some((r) => r.success),
      totalCreated,
      totalRequested: params.students.length * count,
      sessionsPerStudent: count,
      studentCount: params.students.length,
      createdSessions,
      results,
    };

    if (idempotencyKey) {
      executedBulkBatches.set(idempotencyKey, finalResult);
      if (executedBulkBatches.size > 200) {
        const firstKey = executedBulkBatches.keys().next().value;
        if (firstKey) executedBulkBatches.delete(firstKey);
      }
    }

    return finalResult;
  },

  deleteSession: (id: string): void => {
    const activeUserId = getActiveUserId();

    // 1. Tombstone session
    addDeletionTombstone('session', id, activeUserId);

    // 2. Cascade tombstones for attendance and refund credit if prepaid
    const attendance = getList<Attendance>(STORAGE_KEYS.ATTENDANCE, []);
    const sessionAtt = attendance.filter((a) => a.sessionId === id);
    sessionAtt.forEach((a) => addDeletionTombstone('attendance', a.id, activeUserId));

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

    const list = getList<Session>(STORAGE_KEYS.SESSIONS, []).filter((s) => s.id !== id);
    saveList(STORAGE_KEYS.SESSIONS, list);

    const remainingAtt = attendance.filter((a) => a.sessionId !== id);
    saveList(STORAGE_KEYS.ATTENDANCE, remainingAtt);
    autoSyncUserAccount(activeUserId);
    performFullSync(activeUserId, false).catch(() => {});
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

    const now = new Date().toISOString();
    const recordsWithUserId = records.map((r) => {
      removeDeletionTombstone('attendance', r.id, activeUserId);
      return {
        ...r,
        userId: r.userId || activeUserId,
        updatedAt: now,
        recordedAt: r.recordedAt || now,
      };
    });
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

    const paymentAmount = roundMoney(Number(paymentData.amount) || 0, 2);
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
          const covered = calculateCoveredSessions(paymentAmount, sessionRate);
          const remainder = calculateMoneyRemainder(paymentAmount, sessionRate);
          newSessions = covered;
          sessionsPurchased = covered;
          sessionsCovered = covered;
          financialCreditAdded = remainder;
          targetEnrollment.financialCredit = roundMoney((targetEnrollment.financialCredit || 0) + remainder, 2);
        }
      } else if (isPostpaid) {
        // Postpaid: Settle unpaid sessions first, then convert excess to Session Credit
        const totalUnpaidValue = multiplyMoney(prevUnpaid, sessionRate);
        const covered = calculateCoveredSessions(paymentAmount, sessionRate);
        const remainder = calculateMoneyRemainder(paymentAmount, sessionRate);
        sessionsPurchased = covered;
        sessionsCovered = covered;
        financialCreditAdded = remainder;
        targetEnrollment.financialCredit = roundMoney((targetEnrollment.financialCredit || 0) + remainder, 2);

        if (paymentAmount > totalUnpaidValue && totalUnpaidValue > 0) {
          // Settles all unpaid sessions + converts excess to session credit
          const excessValue = subtractMoney(paymentAmount, totalUnpaidValue);
          const excessSessions = calculateCoveredSessions(excessValue, sessionRate);
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
            const covered = calculateCoveredSessions(paymentAmount, sessionRate);
            const remainder = calculateMoneyRemainder(paymentAmount, sessionRate);
            sessionsCovered = covered;
            sessionsPurchased = covered;
            financialCreditAdded = remainder;
            newSessions = covered;
            targetEnrollment.financialCredit = roundMoney((targetEnrollment.financialCredit || 0) + remainder, 2);
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
        const canConvertSessions = calculateCoveredSessions(targetEnrollment.financialCredit || 0, sessionRate);
        if (canConvertSessions > 0) {
          const creditBalBefore = targetEnrollment.sessionCredit || 0;
          autoSessionsConverted = canConvertSessions;
          financialCreditConverted = multiplyMoney(canConvertSessions, sessionRate);
          targetEnrollment.sessionCredit = creditBalBefore + canConvertSessions;
          targetEnrollment.financialCredit = subtractMoney(targetEnrollment.financialCredit || 0, financialCreditConverted);

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

    const now = new Date().toISOString();
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
      createdAt: (paymentData as any).createdAt || now,
      updatedAt: now,
    };

    removeDeletionTombstone('payment', paymentId, activeUserId);
    payments.unshift(newPayment);
    saveList(STORAGE_KEYS.PAYMENTS, payments);
    autoSyncUserAccount(activeUserId);
    return newPayment;
  },

  savePayment: (payment: Payment): void => {
    const activeUserId = getActiveUserId();
    const now = new Date().toISOString();
    const paymentWithUser = {
      ...payment,
      userId: payment.userId || activeUserId,
      updatedAt: now,
      createdAt: payment.createdAt || now,
    };
    removeDeletionTombstone('payment', payment.id, activeUserId);
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
    addDeletionTombstone('payment', id, activeUserId);
    const list = getList<Payment>(STORAGE_KEYS.PAYMENTS, []).filter((p) => p.id !== id);
    saveList(STORAGE_KEYS.PAYMENTS, list);
    autoSyncUserAccount(activeUserId);
    performFullSync(activeUserId, false).catch(() => {});
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
  // Smart Notification & Alert Settings & States
  // ==========================================

  getNotificationSettings: (userId?: string): NotificationSettings => {
    const currentUserId = userId || getActiveUserId();
    try {
      const scoped = localStorage.getItem(`${STORAGE_KEYS.NOTIFICATION_SETTINGS}_${currentUserId}`);
      if (scoped) return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(scoped) };
      const rawDefault = localStorage.getItem(STORAGE_KEYS.NOTIFICATION_SETTINGS);
      if (rawDefault) return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(rawDefault) };
    } catch {}
    return DEFAULT_NOTIFICATION_SETTINGS;
  },

  saveNotificationSettings: (settings: NotificationSettings, userId?: string): void => {
    const currentUserId = userId || getActiveUserId();
    try {
      localStorage.setItem(`${STORAGE_KEYS.NOTIFICATION_SETTINGS}_${currentUserId}`, JSON.stringify(settings));
      if (currentUserId === 'acc_master_teacher') {
        localStorage.setItem(STORAGE_KEYS.NOTIFICATION_SETTINGS, JSON.stringify(settings));
      }
      autoSyncUserAccount(currentUserId);
    } catch {}
  },

  getNotificationStates: (userId?: string): Record<string, NotificationStateItem> => {
    const currentUserId = userId || getActiveUserId();
    try {
      const raw = localStorage.getItem(`${STORAGE_KEYS.NOTIFICATION_STATES}_${currentUserId}`) ||
                  localStorage.getItem(STORAGE_KEYS.NOTIFICATION_STATES);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  },

  saveNotificationState: (item: NotificationStateItem, userId?: string): void => {
    const currentUserId = userId || getActiveUserId();
    try {
      const states = db.getNotificationStates(currentUserId);
      states[item.id] = { ...states[item.id], ...item };
      localStorage.setItem(`${STORAGE_KEYS.NOTIFICATION_STATES}_${currentUserId}`, JSON.stringify(states));
      if (currentUserId === 'acc_master_teacher') {
        localStorage.setItem(STORAGE_KEYS.NOTIFICATION_STATES, JSON.stringify(states));
      }
    } catch {}
  },

  markNotificationAsRead: (id: string, userId?: string): void => {
    const currentUserId = userId || getActiveUserId();
    const states = db.getNotificationStates(currentUserId);
    const existing = states[id] || { id, isRead: false };
    existing.isRead = !existing.isRead;
    existing.readAt = existing.isRead ? new Date().toISOString() : undefined;
    states[id] = existing;
    try {
      localStorage.setItem(`${STORAGE_KEYS.NOTIFICATION_STATES}_${currentUserId}`, JSON.stringify(states));
      if (currentUserId === 'acc_master_teacher') {
        localStorage.setItem(STORAGE_KEYS.NOTIFICATION_STATES, JSON.stringify(states));
      }
    } catch {}
  },

  markAllNotificationsAsRead: (ids: string[], userId?: string): void => {
    const currentUserId = userId || getActiveUserId();
    const states = db.getNotificationStates(currentUserId);
    const now = new Date().toISOString();
    ids.forEach((id) => {
      states[id] = {
        ...(states[id] || { id }),
        isRead: true,
        readAt: now,
      };
    });
    try {
      localStorage.setItem(`${STORAGE_KEYS.NOTIFICATION_STATES}_${currentUserId}`, JSON.stringify(states));
      if (currentUserId === 'acc_master_teacher') {
        localStorage.setItem(STORAGE_KEYS.NOTIFICATION_STATES, JSON.stringify(states));
      }
    } catch {}
  },

  dismissNotification: (id: string, userId?: string): void => {
    const currentUserId = userId || getActiveUserId();
    const states = db.getNotificationStates(currentUserId);
    states[id] = {
      ...(states[id] || { id, isRead: true }),
      isDismissed: true,
      dismissedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(`${STORAGE_KEYS.NOTIFICATION_STATES}_${currentUserId}`, JSON.stringify(states));
      if (currentUserId === 'acc_master_teacher') {
        localStorage.setItem(STORAGE_KEYS.NOTIFICATION_STATES, JSON.stringify(states));
      }
    } catch {}
  },

  // ==========================================
  // 7.1 Homework & Quizzes System
  // ==========================================

  getHomeworkTests: (userId?: string): HomeworkTest[] => {
    const currentUserId = userId || getActiveUserId();
    const all = getList<HomeworkTest>(STORAGE_KEYS.HOMEWORK_TESTS, []);
    return all.filter((t) => (t.userId ? t.userId === currentUserId : currentUserId === 'acc_master_teacher'));
  },

  getHomeworkTestById: (id: string): HomeworkTest | undefined => {
    return db.getHomeworkTests().find((t) => t.id === id);
  },

  saveHomeworkTest: (test: HomeworkTest): HomeworkTest => {
    const activeUserId = getActiveUserId();
    const now = new Date().toISOString();
    const testWithUser: HomeworkTest = {
      ...test,
      userId: test.userId || activeUserId,
      updatedAt: now,
      createdAt: test.createdAt || now,
    };
    removeDeletionTombstone('homeworkTest', test.id, activeUserId);
    const list = getList<HomeworkTest>(STORAGE_KEYS.HOMEWORK_TESTS, []);
    const idx = list.findIndex((t) => t.id === test.id);
    if (idx >= 0) {
      list[idx] = testWithUser;
    } else {
      list.unshift(testWithUser);
    }
    saveList(STORAGE_KEYS.HOMEWORK_TESTS, list);
    autoSyncUserAccount(activeUserId);
    return testWithUser;
  },

  deleteHomeworkTest: (id: string): void => {
    const activeUserId = getActiveUserId();
    addDeletionTombstone('homeworkTest', id, activeUserId);
    const list = getList<HomeworkTest>(STORAGE_KEYS.HOMEWORK_TESTS, []).filter((t) => t.id !== id);
    saveList(STORAGE_KEYS.HOMEWORK_TESTS, list);
    autoSyncUserAccount(activeUserId);
    performFullSync(activeUserId, false).catch(() => {});
  },

  getHomeworkAssignments: (userId?: string): HomeworkAssignment[] => {
    const currentUserId = userId || getActiveUserId();
    const all = getList<HomeworkAssignment>(STORAGE_KEYS.HOMEWORK_ASSIGNMENTS, []);
    return all.filter((a) => (a.userId ? a.userId === currentUserId : currentUserId === 'acc_master_teacher'));
  },

  getHomeworkAssignmentById: (id: string): HomeworkAssignment | undefined => {
    return db.getHomeworkAssignments().find((a) => a.id === id);
  },

  getStudentHomeworkAssignments: (studentId: string): HomeworkAssignment[] => {
    return db.getHomeworkAssignments().filter((a) => a.studentId === studentId);
  },

  getGroupHomeworkAssignments: (groupId: string): HomeworkAssignment[] => {
    return db.getHomeworkAssignments().filter((a) => a.groupId === groupId);
  },

  saveHomeworkAssignment: (assignment: HomeworkAssignment): HomeworkAssignment => {
    const activeUserId = getActiveUserId();
    const now = new Date().toISOString();
    const assignmentWithUser: HomeworkAssignment = {
      ...assignment,
      userId: assignment.userId || activeUserId,
      updatedAt: now,
      createdAt: assignment.createdAt || now,
    };
    removeDeletionTombstone('homeworkAssignment', assignment.id, activeUserId);
    const list = getList<HomeworkAssignment>(STORAGE_KEYS.HOMEWORK_ASSIGNMENTS, []);
    const idx = list.findIndex((a) => a.id === assignment.id);
    if (idx >= 0) {
      list[idx] = assignmentWithUser;
    } else {
      list.unshift(assignmentWithUser);
    }
    saveList(STORAGE_KEYS.HOMEWORK_ASSIGNMENTS, list);
    autoSyncUserAccount(activeUserId);
    return assignmentWithUser;
  },

  saveHomeworkAssignmentsBatch: (assignments: HomeworkAssignment[]): HomeworkAssignment[] => {
    const activeUserId = getActiveUserId();
    const now = new Date().toISOString();
    const list = getList<HomeworkAssignment>(STORAGE_KEYS.HOMEWORK_ASSIGNMENTS, []);
    const map = new Map<string, HomeworkAssignment>();

    for (const item of list) {
      map.set(item.id, item);
    }

    const savedItems: HomeworkAssignment[] = [];
    for (const a of assignments) {
      const itemWithUser: HomeworkAssignment = {
        ...a,
        userId: a.userId || activeUserId,
        updatedAt: now,
        createdAt: a.createdAt || now,
      };
      removeDeletionTombstone('homeworkAssignment', a.id, activeUserId);
      map.set(a.id, itemWithUser);
      savedItems.push(itemWithUser);
    }

    saveList(STORAGE_KEYS.HOMEWORK_ASSIGNMENTS, Array.from(map.values()));
    autoSyncUserAccount(activeUserId);
    return savedItems;
  },

  deleteHomeworkAssignment: (id: string): void => {
    const activeUserId = getActiveUserId();
    addDeletionTombstone('homeworkAssignment', id, activeUserId);
    const list = getList<HomeworkAssignment>(STORAGE_KEYS.HOMEWORK_ASSIGNMENTS, []).filter((a) => a.id !== id);
    saveList(STORAGE_KEYS.HOMEWORK_ASSIGNMENTS, list);
    autoSyncUserAccount(activeUserId);
    performFullSync(activeUserId, false).catch(() => {});
  },

  getHomeworkQuestionResults: (assignmentId?: string): HomeworkQuestionResult[] => {
    const all = getList<HomeworkQuestionResult>(STORAGE_KEYS.HOMEWORK_QUESTION_RESULTS, []);
    if (!assignmentId) return all;
    return all.filter((r) => r.assignmentId === assignmentId);
  },

  saveHomeworkQuestionResultsBatch: (results: HomeworkQuestionResult[]): void => {
    const all = getList<HomeworkQuestionResult>(STORAGE_KEYS.HOMEWORK_QUESTION_RESULTS, []);
    const map = new Map<string, HomeworkQuestionResult>();
    for (const r of all) {
      map.set(`${r.assignmentId}_${r.questionId}`, r);
    }
    for (const r of results) {
      map.set(`${r.assignmentId}_${r.questionId}`, r);
    }
    saveList(STORAGE_KEYS.HOMEWORK_QUESTION_RESULTS, Array.from(map.values()));
  },

  /**
   * Bulk assign a test to multiple students (e.g. all group members or selected students)
   */
  createAssignmentsForStudents: (params: {
    testId: string;
    studentIds: string[];
    groupId?: string;
    title?: string;
    description?: string;
    dueAt?: string;
  }): HomeworkAssignment[] => {
    const activeUserId = getActiveUserId();
    const test = db.getHomeworkTestById(params.testId);
    if (!test) {
      throw new Error(`Master test ${params.testId} not found`);
    }

    const students = db.getStudents();
    const group = params.groupId ? db.getGroupById(params.groupId) : undefined;
    const now = new Date().toISOString();
    const createdAssignments: HomeworkAssignment[] = [];

    for (const sId of params.studentIds) {
      const student = students.find((s) => s.id === sId);
      if (!student) continue;

      const assignmentId = `hwa_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const launchUrl = buildHomeworkLaunchUrl({
        test,
        student,
        assignmentId,
      });

      const newAssignment: HomeworkAssignment = {
        id: assignmentId,
        userId: activeUserId,
        testId: test.id,
        studentId: student.id,
        studentName: student.name,
        groupId: group?.id || params.groupId,
        groupName: group?.name,
        title: params.title || test.title,
        description: params.description || test.description,
        assignedAt: now,
        dueAt: params.dueAt,
        status: 'PENDING',
        launchUrl,
        createdAt: now,
        updatedAt: now,
      };

      createdAssignments.push(newAssignment);
    }

    return db.saveHomeworkAssignmentsBatch(createdAssignments);
  },

  assignHomeworkBatch: (params: {
    testId: string;
    studentIds: string[];
    groupId?: string;
    dueDate?: string;
    dueAt?: string;
    customTitle?: string;
    title?: string;
    customInstructions?: string;
    description?: string;
  }): HomeworkAssignment[] => {
    return db.createAssignmentsForStudents({
      testId: params.testId,
      studentIds: params.studentIds,
      groupId: params.groupId,
      dueAt: params.dueDate || params.dueAt,
      title: params.customTitle || params.title,
      description: params.customInstructions || params.description,
    });
  },

  // ==========================================
  // 7.2 Student Behavior & Quick Logs System
  // ==========================================

  getBehaviorLogs: (userId?: string): StudentBehaviorLog[] => {
    const currentUserId = userId || getActiveUserId();
    const all = getList<StudentBehaviorLog>(STORAGE_KEYS.BEHAVIOR_LOGS, []);
    return all.filter((b) => (b.userId ? b.userId === currentUserId : currentUserId === 'acc_master_teacher'));
  },

  getStudentBehaviorLogs: (studentId: string): StudentBehaviorLog[] => {
    return db.getBehaviorLogs()
      .filter((b) => b.studentId === studentId)
      .sort((a, b) => new Date(b.timestamp || b.createdAt).getTime() - new Date(a.timestamp || a.createdAt).getTime());
  },

  getGroupBehaviorLogs: (groupId: string): StudentBehaviorLog[] => {
    return db.getBehaviorLogs()
      .filter((b) => b.groupId === groupId)
      .sort((a, b) => new Date(b.timestamp || b.createdAt).getTime() - new Date(a.timestamp || a.createdAt).getTime());
  },

  saveBehaviorLog: (log: StudentBehaviorLog): StudentBehaviorLog => {
    const activeUserId = getActiveUserId();
    const now = new Date().toISOString();
    const logWithUser: StudentBehaviorLog = {
      ...log,
      userId: log.userId || activeUserId,
      timestamp: log.timestamp || now,
      updatedAt: now,
      createdAt: log.createdAt || now,
    };
    removeDeletionTombstone('behaviorLog', log.id, activeUserId);
    const list = getList<StudentBehaviorLog>(STORAGE_KEYS.BEHAVIOR_LOGS, []);
    const idx = list.findIndex((b) => b.id === log.id);
    if (idx >= 0) {
      list[idx] = logWithUser;
    } else {
      list.unshift(logWithUser);
    }
    saveList(STORAGE_KEYS.BEHAVIOR_LOGS, list);
    autoSyncUserAccount(activeUserId);
    return logWithUser;
  },

  deleteBehaviorLog: (id: string): void => {
    const activeUserId = getActiveUserId();
    addDeletionTombstone('behaviorLog', id, activeUserId);
    const list = getList<StudentBehaviorLog>(STORAGE_KEYS.BEHAVIOR_LOGS, []).filter((b) => b.id !== id);
    saveList(STORAGE_KEYS.BEHAVIOR_LOGS, list);
    autoSyncUserAccount(activeUserId);
    performFullSync(activeUserId, false).catch(() => {});
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
    const accentColor = group ? group.accentColor : '#7657F6';

    const allGroupSessions = db.getSessions().filter((s) => s.groupId === enrollment.groupId);
    const sessions = allGroupSessions.filter((s) => s.status === 'completed');
    const allGroupSessionIds = new Set(allGroupSessions.map((s) => s.id));
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
      (enrollment.customPrice > 0 ? divideMoney(enrollment.customPrice, baseSessionsLimit) : 100);

    const monthlyLedger: MonthlyBillingLedgerItem[] = [];
    let totalDue = 0;
    let extraSessionsTotal = 0;
    let totalAccumulatedHours = 0;

    const isHourly =
      enrollment.billingType === 'hourly' ||
      enrollment.billingMode === 'hourly' ||
      group?.billingType === 'hourly' ||
      group?.billingMode === 'hourly';

    const isPackage = !isHourly && (enrollment.billingMode === 'package' || enrollment.billingType === 'package' || group?.billingType === 'package' || group?.billingMode === 'package');

    const isPrepaid =
      !isHourly &&
      !isPackage && (
        enrollment.billingMode === 'prepaid' ||
        enrollment.billingType === 'prepaid' ||
        (enrollment.billingType === 'per_session' && enrollment.billingMode !== 'postpaid')
      );

    const isPostpaid =
      !isHourly &&
      !isPackage && (
        enrollment.billingMode === 'postpaid' ||
        enrollment.billingType === 'postpaid'
      );

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
        const extraCharge = multiplyMoney(extraInMonth, extraSessionRate);
        const basePrice = roundMoney(enrollment.customPrice, 2);
        const totalRequired = addMoney(basePrice, extraCharge);

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

        const paidThisMonthRounded = roundMoney(paidThisMonth, 2);
        const remainingThisMonth = Math.max(0, subtractMoney(totalRequired, paidThisMonthRounded));
        let status: MonthBillStatus = 'unpaid';
        if (paidThisMonthRounded >= totalRequired && totalRequired > 0) {
          status = 'fully_paid';
        } else if (paidThisMonthRounded > 0) {
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
          totalPaid: paidThisMonthRounded,
          remaining: remainingThisMonth,
          status,
        });

        totalDue = addMoney(totalDue, totalRequired);
      }
    } else if (isHourly) {
      // Hourly billing calculation: sum the exact duration of each charged lesson
      let hourlyGrossCharged = 0;
      consumedAttendance.forEach((a) => {
        const sess = sessions.find((s) => s.id === a.sessionId);
        const hours = a.hours !== undefined && a.hours !== null ? Number(a.hours) : (sess?.hours !== undefined && sess?.hours !== null ? Number(sess.hours) : 1);
        const rate = a.hourlyRate || sess?.hourlyRate || enrollment.hourlyRate || enrollment.customPrice || group?.hourlyRate || group?.defaultPrice || 100;
        totalAccumulatedHours = roundMoney(totalAccumulatedHours + hours, 2);
        hourlyGrossCharged = addMoney(hourlyGrossCharged, multiplyMoney(hours, rate));
      });
      totalDue = hourlyGrossCharged;
    } else if (isPackage) {
      // Package billing
      const packageSessions = enrollment.packageSessionsCount || group?.packageSessionsCount || 8;
      const packagePrice = enrollment.packagePrice || group?.defaultPrice || enrollment.customPrice;
      const unitRate = packageSessions > 0 ? divideMoney(packagePrice, packageSessions) : 100;
      totalDue = multiplyMoney(attendedCount, unitRate);
    } else if (isPrepaid) {
      // PREPAID Rules:
      // - Normal attendance is automatically marked Paid (Due = 0).
      // - No session-credit system, no remaining prepaid credits.
      // - Session still counts as a normal completed session.
      // - Teacher can manually override an individual session to Unpaid/Due.
      // - Overridden sessions contribute to outstanding balance and unpaidSessionsCount.
      const sessionRate = getEffectiveSessionPrice(enrollment, group);
      const prepaidUnpaidAttendance = consumedAttendance.filter(
        (a) => a.paymentStatus === 'unpaid' || a.paymentOverride === 'unpaid' || a.isPaid === false
      );
      const prepaidPaidAttendance = consumedAttendance.filter(
        (a) => !(a.paymentStatus === 'unpaid' || a.paymentOverride === 'unpaid' || a.isPaid === false)
      );

      const prepaidPaidValue = prepaidPaidAttendance.reduce((sum, a) => addMoney(sum, a.sessionPriceSnapshot || sessionRate), 0);
      const prepaidUnpaidValue = prepaidUnpaidAttendance.reduce((sum, a) => addMoney(sum, a.sessionPriceSnapshot || sessionRate), 0);
      totalDue = addMoney(prepaidPaidValue, prepaidUnpaidValue);
    } else {
      // Per session billing (Prepaid / Postpaid)
      const sessionRate = getEffectiveSessionPrice(enrollment, group);
      totalDue = multiplyMoney(attendedCount, sessionRate);
    }

    const freeAttendance = attendanceRecords.filter((a) => {
      if (!allGroupSessionIds.has(a.sessionId)) return false;
      if (a.isCharged !== undefined) return !a.isCharged;
      return a.status === 'absent_free' || a.status === 'excused';
    });
    const freeSessionsCount = freeAttendance.length;

    const sessionRate = getEffectiveSessionPrice(enrollment, group);
    const explicitPaymentsTotal = roundMoney(payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0), 2);
    let totalPaid = explicitPaymentsTotal;

    let purchasedSessionsCount = 0;
    let usedSessionsCount = 0;
    let effectiveSessionCredit = 0;
    let sessionCreditValue = 0;
    let unpaidSessionsCount = 0;
    let settledSessionsCount = 0;
    let unpaidHours = 0;
    let remaining = 0;

    if (isHourly) {
      // Hourly mode stats: calculated purely on hours/duration, not session counts
      const effectiveHourlyRate = enrollment.hourlyRate || enrollment.customPrice || group?.hourlyRate || group?.defaultPrice || 100;
      usedSessionsCount = attendedCount;
      const prepaidHourlyPaidAttendance = consumedAttendance.filter(
        (a) => !(a.paymentStatus === 'unpaid' || a.paymentOverride === 'unpaid' || a.isPaid === false)
      );
      const isPrepaidHourly = enrollment.billingMode === 'prepaid' || enrollment.billingType === 'prepaid' || (enrollment.billingType === 'per_session' && enrollment.billingMode !== 'postpaid');

      if (isPrepaidHourly) {
        let paidHourlyVal = 0;
        prepaidHourlyPaidAttendance.forEach((a) => {
          const sess = sessions.find((s) => s.id === a.sessionId);
          const hours = a.hours !== undefined && a.hours !== null ? Number(a.hours) : (sess?.hours !== undefined && sess?.hours !== null ? Number(sess.hours) : 1);
          const rate = a.hourlyRate || sess?.hourlyRate || effectiveHourlyRate;
          paidHourlyVal = addMoney(paidHourlyVal, multiplyMoney(hours, rate));
        });
        totalPaid = addMoney(paidHourlyVal, explicitPaymentsTotal);
        remaining = Math.max(0, subtractMoney(totalDue, totalPaid));
        unpaidHours = effectiveHourlyRate > 0 && remaining > 0 ? Number((remaining / effectiveHourlyRate).toFixed(2)) : 0;
        settledSessionsCount = prepaidHourlyPaidAttendance.length;
        unpaidSessionsCount = Math.max(0, attendedCount - settledSessionsCount);
      } else {
        if (totalPaid >= totalDue) {
          remaining = 0;
          unpaidHours = 0;
          unpaidSessionsCount = 0;
          settledSessionsCount = attendedCount;
        } else {
          remaining = subtractMoney(totalDue, totalPaid);
          unpaidHours = effectiveHourlyRate > 0 ? Number((remaining / effectiveHourlyRate).toFixed(2)) : 0;
          settledSessionsCount = 0;
          unpaidSessionsCount = 0;
        }
      }
    } else if (isPrepaid) {
      // PREPAID Rules:
      // - Normal attendance is automatically marked Paid (Due = 0).
      // - No session-credit system, no remaining prepaid credits.
      // - Session still counts as a normal completed session.
      // - Teacher can manually override an individual session to Unpaid/Due.
      // - Overridden sessions contribute to outstanding balance and unpaidSessionsCount.
      const prepaidUnpaidAttendance = consumedAttendance.filter(
        (a) => a.paymentStatus === 'unpaid' || a.paymentOverride === 'unpaid' || a.isPaid === false
      );
      const prepaidPaidAttendance = consumedAttendance.filter(
        (a) => !(a.paymentStatus === 'unpaid' || a.paymentOverride === 'unpaid' || a.isPaid === false)
      );

      const prepaidPaidCount = prepaidPaidAttendance.length;
      const prepaidUnpaidCount = prepaidUnpaidAttendance.length;
      const prepaidPaidValue = prepaidPaidAttendance.reduce((sum, a) => addMoney(sum, a.sessionPriceSnapshot || sessionRate), 0);

      totalPaid = addMoney(prepaidPaidValue, explicitPaymentsTotal);
      remaining = Math.max(0, subtractMoney(totalDue, totalPaid));

      usedSessionsCount = attendedCount;
      settledSessionsCount = prepaidPaidCount;
      effectiveSessionCredit = 0;
      sessionCreditValue = 0;

      const paymentsCoveredSessions = sessionRate > 0 ? calculateCoveredSessions(explicitPaymentsTotal, sessionRate) : 0;
      purchasedSessionsCount = prepaidPaidCount + paymentsCoveredSessions;
      unpaidSessionsCount = Math.max(0, prepaidUnpaidCount - paymentsCoveredSessions);
    } else if (isPostpaid) {
      // POSTPAID Rules:
      remaining = Math.max(0, subtractMoney(totalDue, totalPaid));
      if (totalPaid >= totalDue) {
        settledSessionsCount = attendedCount;
        unpaidSessionsCount = 0;
        remaining = 0;
        const excess = subtractMoney(totalPaid, totalDue);
        effectiveSessionCredit = sessionRate > 0 ? calculateCoveredSessions(excess, sessionRate) : 0;
        sessionCreditValue = multiplyMoney(effectiveSessionCredit, sessionRate);
        purchasedSessionsCount = attendedCount + effectiveSessionCredit;
        usedSessionsCount = attendedCount;
      } else {
        settledSessionsCount = sessionRate > 0 ? calculateCoveredSessions(totalPaid, sessionRate) : 0;
        unpaidSessionsCount = Math.max(0, attendedCount - settledSessionsCount);
        effectiveSessionCredit = 0;
        sessionCreditValue = 0;
        purchasedSessionsCount = settledSessionsCount;
        usedSessionsCount = attendedCount;
      }
    } else if (enrollment.billingType === 'monthly') {
      // Monthly Billing
      remaining = Math.max(0, subtractMoney(totalDue, totalPaid));
      purchasedSessionsCount = payments.length;
      usedSessionsCount = attendedCount;
      effectiveSessionCredit = 0;
      sessionCreditValue = 0;
      unpaidSessionsCount = 0;
    } else {
      // Package or other
      const packageSessions = enrollment.packageSessionsCount || group?.packageSessionsCount || 10;
      const packagePrice = enrollment.packagePrice || group?.defaultPrice || enrollment.customPrice;
      const unitRate = packageSessions > 0 ? divideMoney(packagePrice, packageSessions) : sessionRate;

      const explicitPurchased = payments.reduce((sum, p) => {
        if (p.sessionsPurchased && p.sessionsPurchased > 0) return sum + p.sessionsPurchased;
        if (p.paymentType === 'single_session') return sum + 1;
        if (p.paymentType === 'session_count') return sum + (p.sessionsPurchased || 1);
        if (unitRate > 0 && p.amount) return sum + calculateCoveredSessions(Number(p.amount), unitRate);
        return sum;
      }, 0) + payments.reduce((sum, p) => sum + (p.autoSessionsConverted || 0), 0);

      purchasedSessionsCount = explicitPurchased > 0 ? explicitPurchased : (unitRate > 0 ? calculateCoveredSessions(totalPaid, unitRate) : 0);
      usedSessionsCount = Math.min(attendedCount, purchasedSessionsCount);
      effectiveSessionCredit = Math.max(0, purchasedSessionsCount - attendedCount);
      sessionCreditValue = multiplyMoney(effectiveSessionCredit, unitRate);
      unpaidSessionsCount = Math.max(0, attendedCount - purchasedSessionsCount);
      remaining = Math.max(0, subtractMoney(totalDue, totalPaid));
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
      totalHours: isHourly ? totalAccumulatedHours : undefined,
      unpaidHours: isHourly ? unpaidHours : undefined,
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
        grandTotalDue = addMoney(grandTotalDue, summary.totalDue);
        grandTotalPaid = addMoney(grandTotalPaid, summary.totalPaid);
        grandRemaining = addMoney(grandRemaining, summary.remaining);
        totalSessionCredit += summary.sessionCredit;
        totalUnpaidSessions += summary.unpaidSessionsCount;
        totalFinancialCredit = addMoney(totalFinancialCredit, summary.financialCredit);
      }
    }

    const groupSummaries = enrollmentsSummary.filter((e) => e.groupType !== 'private');
    const privateSummaries = enrollmentsSummary.filter((e) => e.groupType === 'private');

    const groupsFinancials = {
      totalDue: roundMoney(groupSummaries.reduce((sum, s) => sum + s.totalDue, 0), 2),
      totalPaid: roundMoney(groupSummaries.reduce((sum, s) => sum + s.totalPaid, 0), 2),
      remaining: roundMoney(groupSummaries.reduce((sum, s) => sum + s.remaining, 0), 2),
      totalSessionCredit: groupSummaries.reduce((sum, s) => sum + s.sessionCredit, 0),
      totalUnpaidSessions: groupSummaries.reduce((sum, s) => sum + s.unpaidSessionsCount, 0),
      totalFinancialCredit: roundMoney(groupSummaries.reduce((sum, s) => sum + s.financialCredit, 0), 2),
      enrollments: groupSummaries,
    };

    const privateFinancials = {
      totalDue: roundMoney(privateSummaries.reduce((sum, s) => sum + s.totalDue, 0), 2),
      totalPaid: roundMoney(privateSummaries.reduce((sum, s) => sum + s.totalPaid, 0), 2),
      remaining: roundMoney(privateSummaries.reduce((sum, s) => sum + s.remaining, 0), 2),
      totalSessionCredit: privateSummaries.reduce((sum, s) => sum + s.sessionCredit, 0),
      totalUnpaidSessions: privateSummaries.reduce((sum, s) => sum + s.unpaidSessionsCount, 0),
      totalFinancialCredit: roundMoney(privateSummaries.reduce((sum, s) => sum + s.financialCredit, 0), 2),
      enrollments: privateSummaries,
    };

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
      groupsFinancials,
      privateFinancials,
      hasGroupService: groupSummaries.length > 0,
      hasPrivateService: privateSummaries.length > 0,
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
        totalDue = addMoney(totalDue, enrSummary.totalDue);
        totalPaid = addMoney(totalPaid, enrSummary.totalPaid);
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
      remaining: Math.max(0, subtractMoney(totalDue, totalPaid)),
      totalCompletedSessions: completedSessions.length,
      totalAttendedSessions,
      totalPrepaidCredits,
      studentsSummary,
    };
  },

  /**
   * حساب السجل المالي التاريخي الكامل (شهري + سنوي + إجمالي)
   * مع احتساب حصص الدفع المسبق المؤكدة كإيراد محصل فعلياً
   */
  calculateFinancialHistory: (userId?: string): LifetimeFinancialSummary => {
    const groups = db.getGroups(userId);
    const enrollments = db.getEnrollments(userId);
    const sessions = db.getSessions(userId);
    const attendance = db.getAttendance(userId);
    const payments = db.getPayments(userId);

    // Collect all months with activity (from sessions, payments, and current month)
    const monthKeysSet = new Set<string>();
    const now = new Date();
    monthKeysSet.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

    sessions.forEach((s) => {
      const y = s.year || (s.date ? Number(s.date.split('-')[0]) : now.getFullYear());
      const m = s.month || (s.date ? Number(s.date.split('-')[1]) : now.getMonth() + 1);
      if (y && m) {
        monthKeysSet.add(`${y}-${String(m).padStart(2, '0')}`);
      }
    });

    payments.forEach((p) => {
      const y = p.targetYear || p.year || (p.date ? Number(p.date.split('-')[0]) : now.getFullYear());
      const m = p.targetMonth || p.month || (p.date ? Number(p.date.split('-')[1]) : now.getMonth() + 1);
      if (y && m) {
        monthKeysSet.add(`${y}-${String(m).padStart(2, '0')}`);
      }
    });

    const sortedMonthKeys = Array.from(monthKeysSet).sort((a, b) => a.localeCompare(b));
    const monthRecords: MonthFinancialRecord[] = [];

    for (const mKey of sortedMonthKeys) {
      const [year, month] = mKey.split('-').map(Number);
      const monthName = `${getArabicMonthName(month)} ${year}`;

      const monthSessions = sessions.filter((s) => {
        const sYear = s.year || (s.date ? Number(s.date.split('-')[0]) : 0);
        const sMonth = s.month || (s.date ? Number(s.date.split('-')[1]) : 0);
        return sYear === year && sMonth === month;
      });

      const monthPayments = payments.filter((p) => {
        const pYear = p.targetYear || p.year || (p.date ? Number(p.date.split('-')[0]) : 0);
        const pMonth = p.targetMonth || p.month || (p.date ? Number(p.date.split('-')[1]) : 0);
        return pYear === year && pMonth === month;
      });

      const initBreakdown = (): PeriodFinancialBreakdown => ({
        totalSessions: 0,
        completedSessions: 0,
        presentCount: 0,
        lateCount: 0,
        absentChargedCount: 0,
        freeCount: 0,
        totalSessionValue: 0,
        totalCollected: 0,
        totalDue: 0,
        totalRemaining: 0,
      });

      const groupBreakdown = initBreakdown();
      const privateBreakdown = initBreakdown();
      const methodStats: Record<string, { label: string; amount: number; count: number; color?: string }> = {
        cash: { label: 'كاش (نقداً)', amount: 0, count: 0, color: '#607B5E' },
        vodafone_cash: { label: 'فودافون كاش', amount: 0, count: 0, color: '#B86B52' },
        instapay: { label: 'إنستاباي (InstaPay)', amount: 0, count: 0, color: '#586E7E' },
        bank_transfer: { label: 'تحويل بنكي', amount: 0, count: 0, color: '#B88438' },
        prepaid_auto: { label: 'دفع مسبق للحصص', amount: 0, count: 0, color: '#4F46E5' },
        other: { label: 'أخرى', amount: 0, count: 0, color: '#878E82' },
      };

      let totalCompleted = 0;
      let presentCount = 0;
      let lateCount = 0;
      let absentChargedCount = 0;
      let freeCount = 0;
      let cancelledCount = 0;
      let totalSessionVal = 0;
      let totalCollected = 0;
      let totalDue = 0;
      let totalRemaining = 0;

      monthSessions.forEach((s) => {
        const isCompleted = s.status === 'completed';
        const isCancelled = s.status === 'cancelled';
        if (isCancelled) cancelledCount++;
        if (isCompleted) totalCompleted++;

        const grp = groups.find((g) => g.id === s.groupId);
        const isPrivate = grp?.type === 'private' || s.groupId.startsWith('private_');
        const targetB = isPrivate ? privateBreakdown : groupBreakdown;

        targetB.totalSessions++;
        if (isCompleted) targetB.completedSessions++;

        const sAttendance = attendance.filter((a) => a.sessionId === s.id);

        sAttendance.forEach((a) => {
          if (a.status === 'present') {
            presentCount++;
            targetB.presentCount++;
          } else if (a.status === 'late') {
            lateCount++;
            targetB.lateCount++;
          } else if (a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false)) {
            absentChargedCount++;
            targetB.absentChargedCount++;
          } else if (a.status === 'absent_free' || a.status === 'excused') {
            freeCount++;
            targetB.freeCount++;
          }

          const isCharged =
            isCompleted &&
            (a.status === 'present' || a.status === 'late' || a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false));

          if (isCharged) {
            const enr = enrollments.find(
              (e) => e.id === a.enrollmentId || (e.studentId === a.studentId && e.groupId === s.groupId)
            );
            const isHourly =
              enr?.billingType === 'hourly' ||
              enr?.billingMode === 'hourly' ||
              grp?.billingType === 'hourly' ||
              grp?.billingMode === 'hourly';
            const isPackage = !isHourly && (enr?.billingMode === 'package' || enr?.billingType === 'package' || grp?.billingType === 'package');
            const isPrepaid =
              !isHourly &&
              !isPackage &&
              (enr?.billingMode === 'prepaid' ||
                enr?.billingType === 'prepaid' ||
                (enr?.billingType === 'per_session' && enr?.billingMode !== 'postpaid') ||
                grp?.billingType === 'prepaid' ||
                (!enr?.billingMode && !enr?.billingType));

            let sessionVal = 0;
            if (isHourly) {
              const hours = a.hours !== undefined && a.hours !== null ? Number(a.hours) : (s.hours !== undefined && s.hours !== null ? Number(s.hours) : 1);
              const rate = a.hourlyRate || s.hourlyRate || enr?.hourlyRate || grp?.hourlyRate || enr?.customPrice || grp?.defaultPrice || 100;
              sessionVal = roundMoney(multiplyMoney(hours, rate), 2);
            } else if (isPackage) {
              const pkgSessions = enr?.packageSessionsCount || grp?.packageSessionsCount || 8;
              const pkgPrice = enr?.packagePrice || grp?.defaultPrice || enr?.customPrice || 800;
              const uRate = pkgSessions > 0 ? divideMoney(pkgPrice, pkgSessions) : 100;
              sessionVal = roundMoney(uRate, 2);
            } else {
              const sRate = a.sessionPriceSnapshot || (enr ? getEffectiveSessionPrice(enr, grp) : (grp?.defaultPrice || 100));
              sessionVal = roundMoney(sRate, 2);
            }

            totalSessionVal = addMoney(totalSessionVal, sessionVal);
            targetB.totalSessionValue = addMoney(targetB.totalSessionValue, sessionVal);

            const isUnpaid = a.paymentStatus === 'unpaid' || a.paymentOverride === 'unpaid' || a.isPaid === false;
            if (isPrepaid && !isUnpaid) {
              totalCollected = addMoney(totalCollected, sessionVal);
              targetB.totalCollected = addMoney(targetB.totalCollected, sessionVal);
              totalDue = addMoney(totalDue, sessionVal);
              targetB.totalDue = addMoney(targetB.totalDue, sessionVal);

              methodStats.prepaid_auto.amount = addMoney(methodStats.prepaid_auto.amount, sessionVal);
              methodStats.prepaid_auto.count++;
            } else {
              totalDue = addMoney(totalDue, sessionVal);
              targetB.totalDue = addMoney(targetB.totalDue, sessionVal);
              totalRemaining = addMoney(totalRemaining, sessionVal);
              targetB.totalRemaining = addMoney(targetB.totalRemaining, sessionVal);
            }
          }
        });
      });

      monthPayments.forEach((p) => {
        const amt = Number(p.amount) || 0;
        if (amt <= 0) return;

        const grp = p.groupId ? groups.find((g) => g.id === p.groupId) : (p.enrollmentId ? groups.find((g) => g.id === enrollments.find((e) => e.id === p.enrollmentId)?.groupId) : undefined);
        const isPrivate = grp?.type === 'private' || (p.groupId && p.groupId.startsWith('private_'));
        const targetB = isPrivate ? privateBreakdown : groupBreakdown;

        totalCollected = addMoney(totalCollected, amt);
        targetB.totalCollected = addMoney(targetB.totalCollected, amt);

        if (p.paymentType === 'specific_month') {
          totalDue = addMoney(totalDue, amt);
          targetB.totalDue = addMoney(targetB.totalDue, amt);
        }

        const m = p.paymentMethod || 'cash';
        if (methodStats[m]) {
          methodStats[m].amount = addMoney(methodStats[m].amount, amt);
          methodStats[m].count++;
        } else {
          methodStats.other.amount = addMoney(methodStats.other.amount, amt);
          methodStats.other.count++;
        }
      });

      totalRemaining = Math.max(0, subtractMoney(totalDue, totalCollected));
      groupBreakdown.totalRemaining = Math.max(0, subtractMoney(groupBreakdown.totalDue, groupBreakdown.totalCollected));
      privateBreakdown.totalRemaining = Math.max(0, subtractMoney(privateBreakdown.totalDue, privateBreakdown.totalCollected));

      monthRecords.push({
        year,
        month,
        monthYear: mKey,
        monthName,
        totalCompletedSessions: totalCompleted,
        presentSessionsCount: presentCount,
        lateSessionsCount: lateCount,
        absentChargedCount: absentChargedCount,
        freeSessionsCount: freeCount,
        cancelledSessionsCount: cancelledCount,
        totalSessionValue: totalSessionVal,
        totalCollected,
        totalDue,
        totalRemaining,
        group: groupBreakdown,
        private: privateBreakdown,
        methodStats,
      });
    }

    const yearMap: Record<number, MonthFinancialRecord[]> = {};
    monthRecords.forEach((m) => {
      if (!yearMap[m.year]) yearMap[m.year] = [];
      yearMap[m.year].push(m);
    });

    const yearRecords: YearFinancialRecord[] = Object.entries(yearMap)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([yearStr, mList]) => {
        const yr = Number(yearStr);
        const initB = (): PeriodFinancialBreakdown => ({
          totalSessions: 0,
          completedSessions: 0,
          presentCount: 0,
          lateCount: 0,
          absentChargedCount: 0,
          freeCount: 0,
          totalSessionValue: 0,
          totalCollected: 0,
          totalDue: 0,
          totalRemaining: 0,
        });

        const grpB = initB();
        const privB = initB();

        let totalComp = 0;
        let pCount = 0;
        let lCount = 0;
        let aCount = 0;
        let fCount = 0;
        let tVal = 0;
        let tColl = 0;
        let tDue = 0;
        let tRem = 0;

        mList.forEach((m) => {
          totalComp += m.totalCompletedSessions;
          pCount += m.presentSessionsCount;
          lCount += m.lateSessionsCount;
          aCount += m.absentChargedCount;
          fCount += m.freeSessionsCount;
          tVal = addMoney(tVal, m.totalSessionValue);
          tColl = addMoney(tColl, m.totalCollected);
          tDue = addMoney(tDue, m.totalDue);
          tRem = addMoney(tRem, m.totalRemaining);

          grpB.totalSessions += m.group.totalSessions;
          grpB.completedSessions += m.group.completedSessions;
          grpB.presentCount += m.group.presentCount;
          grpB.lateCount += m.group.lateCount;
          grpB.absentChargedCount += m.group.absentChargedCount;
          grpB.freeCount += m.group.freeCount;
          grpB.totalSessionValue = addMoney(grpB.totalSessionValue, m.group.totalSessionValue);
          grpB.totalCollected = addMoney(grpB.totalCollected, m.group.totalCollected);
          grpB.totalDue = addMoney(grpB.totalDue, m.group.totalDue);
          grpB.totalRemaining = addMoney(grpB.totalRemaining, m.group.totalRemaining);

          privB.totalSessions += m.private.totalSessions;
          privB.completedSessions += m.private.completedSessions;
          privB.presentCount += m.private.presentCount;
          privB.lateCount += m.private.lateCount;
          privB.absentChargedCount += m.private.absentChargedCount;
          privB.freeCount += m.private.freeCount;
          privB.totalSessionValue = addMoney(privB.totalSessionValue, m.private.totalSessionValue);
          privB.totalCollected = addMoney(privB.totalCollected, m.private.totalCollected);
          privB.totalDue = addMoney(privB.totalDue, m.private.totalDue);
          privB.totalRemaining = addMoney(privB.totalRemaining, m.private.totalRemaining);
        });

        return {
          year: yr,
          yearName: `${yr}`,
          totalCompletedSessions: totalComp,
          presentSessionsCount: pCount,
          lateSessionsCount: lCount,
          absentChargedCount: aCount,
          freeSessionsCount: fCount,
          totalSessionValue: tVal,
          totalCollected: tColl,
          totalDue: tDue,
          totalRemaining: tRem,
          group: grpB,
          private: privB,
          months: mList.sort((a, b) => b.month - a.month),
        };
      });

    const lifeGrp: PeriodFinancialBreakdown = {
      totalSessions: 0,
      completedSessions: 0,
      presentCount: 0,
      lateCount: 0,
      absentChargedCount: 0,
      freeCount: 0,
      totalSessionValue: 0,
      totalCollected: 0,
      totalDue: 0,
      totalRemaining: 0,
    };
    const lifePriv: PeriodFinancialBreakdown = {
      totalSessions: 0,
      completedSessions: 0,
      presentCount: 0,
      lateCount: 0,
      absentChargedCount: 0,
      freeCount: 0,
      totalSessionValue: 0,
      totalCollected: 0,
      totalDue: 0,
      totalRemaining: 0,
    };

    let lifetimeCompleted = 0;
    let lifetimePresent = 0;
    let lifetimeLate = 0;
    let lifetimeAbsent = 0;
    let lifetimeFree = 0;
    let lifetimeValue = 0;
    let lifetimeCollected = 0;
    let lifetimeDue = 0;
    let lifetimeRemaining = 0;

    monthRecords.forEach((m) => {
      lifetimeCompleted += m.totalCompletedSessions;
      lifetimePresent += m.presentSessionsCount;
      lifetimeLate += m.lateSessionsCount;
      lifetimeAbsent += m.absentChargedCount;
      lifetimeFree += m.freeSessionsCount;
      lifetimeValue = addMoney(lifetimeValue, m.totalSessionValue);
      lifetimeCollected = addMoney(lifetimeCollected, m.totalCollected);
      lifetimeDue = addMoney(lifetimeDue, m.totalDue);
      lifetimeRemaining = addMoney(lifetimeRemaining, m.totalRemaining);

      lifeGrp.totalSessions += m.group.totalSessions;
      lifeGrp.completedSessions += m.group.completedSessions;
      lifeGrp.presentCount += m.group.presentCount;
      lifeGrp.lateCount += m.group.lateCount;
      lifeGrp.absentChargedCount += m.group.absentChargedCount;
      lifeGrp.freeCount += m.group.freeCount;
      lifeGrp.totalSessionValue = addMoney(lifeGrp.totalSessionValue, m.group.totalSessionValue);
      lifeGrp.totalCollected = addMoney(lifeGrp.totalCollected, m.group.totalCollected);
      lifeGrp.totalDue = addMoney(lifeGrp.totalDue, m.group.totalDue);
      lifeGrp.totalRemaining = addMoney(lifeGrp.totalRemaining, m.group.totalRemaining);

      lifePriv.totalSessions += m.private.totalSessions;
      lifePriv.completedSessions += m.private.completedSessions;
      lifePriv.presentCount += m.private.presentCount;
      lifePriv.lateCount += m.private.lateCount;
      lifePriv.absentChargedCount += m.private.absentChargedCount;
      lifePriv.freeCount += m.private.freeCount;
      lifePriv.totalSessionValue = addMoney(lifePriv.totalSessionValue, m.private.totalSessionValue);
      lifePriv.totalCollected = addMoney(lifePriv.totalCollected, m.private.totalCollected);
      lifePriv.totalDue = addMoney(lifePriv.totalDue, m.private.totalDue);
      lifePriv.totalRemaining = addMoney(lifePriv.totalRemaining, m.private.totalRemaining);
    });

    return {
      totalCompletedSessions: lifetimeCompleted,
      presentSessionsCount: lifetimePresent,
      lateSessionsCount: lifetimeLate,
      absentChargedCount: lifetimeAbsent,
      freeSessionsCount: lifetimeFree,
      totalSessionValue: lifetimeValue,
      totalCollected: lifetimeCollected,
      totalDue: lifetimeDue,
      totalRemaining: lifetimeRemaining,
      group: lifeGrp,
      private: lifePriv,
      years: yearRecords,
      months: [...monthRecords].reverse(),
    };
  },

  /**
   * حساب التقرير العام الشامل للمدرس
   */
  calculateTeacherFinancialOverview: (period?: ReportPeriodFilter): TeacherOverallFinancialSummary => {
    const history = db.calculateFinancialHistory();
    const students = db.getStudents();
    const payments = db.getPayments();
    const sessions = db.getSessions().filter((s) => s.status === 'completed');

    let totalExtraSessions = 0;
    students.forEach((st) => {
      const fin = db.calculateStudentGrandFinancials(st.id);
      fin.enrollmentsSummary.forEach((e) => {
        totalExtraSessions += e.extraSessionsCount;
      });
    });

    const monthlyRevenues = history.months.map((m) => ({
      monthYear: m.monthYear,
      month: m.month,
      year: m.year,
      monthName: m.monthName,
      revenue: m.totalCollected,
      dues: m.totalDue,
      remaining: m.totalRemaining,
      sessionsCount: m.totalCompletedSessions,
      groupRevenue: m.group.totalCollected,
      privateRevenue: m.private.totalCollected,
    }));

    return {
      totalRevenue: history.totalCollected,
      totalDues: history.totalDue,
      totalRemaining: history.totalRemaining,
      totalActiveStudents: students.filter((s) => s.status === 'active').length,
      totalSessionsConducted: sessions.length,
      totalExtraSessions,
      monthlyRevenues,
      paymentsList: payments,
      financialHistory: history,
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
      behaviorLogs: db.getBehaviorLogs(activeUserId),
      homeworkTests: db.getHomeworkTests(activeUserId),
      homeworkAssignments: db.getHomeworkAssignments(activeUserId),
      homeworkQuestionResults: db.getHomeworkQuestionResults(),
      teacherProfile: db.getTeacherProfile(activeUserId),
      stats: {
        totalStudents: db.getStudents(activeUserId).length,
        totalGroups: db.getGroups(activeUserId).length,
        totalSessions: db.getSessions(activeUserId).length,
        totalPayments: db.getPayments(activeUserId).length,
        totalHomeworkAssignments: db.getHomeworkAssignments(activeUserId).length,
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
      // 1. Resolve effective resetAllBefore (considering local store, durable pending resets, and cloud package)
      const localReset = getResetAllBefore(targetUserId);
      const pendingReset = getPendingReset(targetUserId);
      const incomingReset = dataToRestore.resetAllBefore;

      const resetCandidates = [localReset, pendingReset?.resetAllBefore, incomingReset]
        .filter(Boolean)
        .map((ts) => ({ ts: ts!, time: new Date(ts!).getTime() }))
        .filter((item) => !isNaN(item.time));

      let effectiveResetAllBefore: string | undefined = undefined;
      if (resetCandidates.length > 0) {
        resetCandidates.sort((a, b) => b.time - a.time);
        effectiveResetAllBefore = resetCandidates[0].ts;
      }

      if (effectiveResetAllBefore) {
        setResetAllBefore(effectiveResetAllBefore, targetUserId);
      }
      const resetTime = effectiveResetAllBefore ? new Date(effectiveResetAllBefore).getTime() : 0;

      // 2. Merge and persist tombstones
      const localTombstones = getDeletionTombstones(targetUserId);
      const incomingTombstones = dataToRestore.tombstones || [];
      const tombstoneMap = new Map<string, string>();
      for (const t of [...localTombstones, ...incomingTombstones]) {
        if (t && t.id && t.entityType) {
          const key = `${t.entityType}:${t.id}`;
          const existing = tombstoneMap.get(key);
          if (!existing || new Date(t.deletedAt).getTime() > new Date(existing).getTime()) {
            tombstoneMap.set(key, t.deletedAt);
          }
        }
      }
      const mergedTombstones: DeletionTombstone[] = Array.from(tombstoneMap.entries()).map(([key, deletedAt]) => {
        const [entityType, id] = key.split(':');
        return {
          id,
          entityType: entityType as DeletionTombstone['entityType'],
          userId: targetUserId,
          deletedAt,
        };
      });
      saveDeletionTombstones(mergedTombstones, targetUserId);

      // Helper to test if an entity is alive (not wiped by resetAllBefore or tombstones)
      const isEntityAlive = (entityType: string, item: any): boolean => {
        if (!item || !item.id) return false;
        const itemTimeStr = item.updatedAt || item.createdAt || "";
        const itemTime = itemTimeStr ? new Date(itemTimeStr).getTime() : 0;
        if (resetTime > 0 && itemTime <= resetTime) {
          return false;
        }
        const delTimeStr = tombstoneMap.get(`${entityType}:${item.id}`);
        if (delTimeStr && itemTime <= new Date(delTimeStr).getTime()) {
          return false;
        }
        return true;
      };

      // 3. Merge entity collections cleanly
      const mergeEntityList = <T extends { id: string; userId?: string; updatedAt?: string; createdAt?: string }>(
        entityType: string,
        key: string,
        incomingList: T[] = []
      ): T[] => {
        const otherUsersItems = getList<T>(key, []).filter(
          (item) => (item.userId ? item.userId !== targetUserId : targetUserId !== 'acc_master_teacher')
        );

        const currentLocalItems = getList<T>(key, []).filter(
          (item) => (item.userId ? item.userId === targetUserId : targetUserId === 'acc_master_teacher')
        );

        const itemMap = new Map<string, T>();

        // Process incoming
        for (const item of (incomingList || [])) {
          if (isEntityAlive(entityType, item)) {
            itemMap.set(item.id, { ...item, userId: targetUserId });
          }
        }

        // Process local items (allowing newer local modifications to override if alive)
        for (const item of currentLocalItems) {
          if (isEntityAlive(entityType, item)) {
            const existing = itemMap.get(item.id);
            if (existing) {
              const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
              const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
              if (itemTime > existingTime) {
                itemMap.set(item.id, { ...existing, ...item, userId: targetUserId });
              }
            } else {
              itemMap.set(item.id, { ...item, userId: targetUserId });
            }
          }
        }

        const finalUserItems = Array.from(itemMap.values());
        saveList(key, [...finalUserItems, ...otherUsersItems]);
        return finalUserItems;
      };

      const restoredStudents = mergeEntityList('student', STORAGE_KEYS.STUDENTS, dataToRestore.students);
      const restoredGroups = mergeEntityList('group', STORAGE_KEYS.GROUPS, dataToRestore.groups);
      const restoredEnrollments = mergeEntityList('enrollment', STORAGE_KEYS.ENROLLMENTS, dataToRestore.enrollments);
      const restoredSessions = mergeEntityList('session', STORAGE_KEYS.SESSIONS, dataToRestore.sessions);
      const restoredAttendance = mergeEntityList('attendance', STORAGE_KEYS.ATTENDANCE, dataToRestore.attendance);
      const restoredPayments = mergeEntityList('payment', STORAGE_KEYS.PAYMENTS, dataToRestore.payments);
      const restoredCreditLogs = mergeEntityList('creditLog', STORAGE_KEYS.CREDIT_LOGS, dataToRestore.creditLogs);
      mergeEntityList('behaviorLog', STORAGE_KEYS.BEHAVIOR_LOGS, dataToRestore.behaviorLogs);
      mergeEntityList('homeworkTest', STORAGE_KEYS.HOMEWORK_TESTS, dataToRestore.homeworkTests);
      mergeEntityList('homeworkAssignment', STORAGE_KEYS.HOMEWORK_ASSIGNMENTS, dataToRestore.homeworkAssignments);

      if (dataToRestore.homeworkQuestionResults && dataToRestore.homeworkQuestionResults.length > 0) {
        db.saveHomeworkQuestionResultsBatch(dataToRestore.homeworkQuestionResults);
      }

      // Restore profile
      if (dataToRestore.teacherProfile) {
        db.saveTeacherProfile(dataToRestore.teacherProfile, targetUserId);
      }

      console.log(`[Storage] restoreAccountData completed for ${targetUserId}:`, {
        effectiveResetAllBefore,
        studentsCount: restoredStudents.length,
        groupsCount: restoredGroups.length,
        sessionsCount: restoredSessions.length,
        paymentsCount: restoredPayments.length,
      });

      autoSyncUserAccount(targetUserId);

      return {
        success: true,
        message: 'تمت استعادة ومزامنة بيانات الحساب بنجاح وتحديث شاشات التطبيق.',
        count: {
          students: restoredStudents.length,
          groups: restoredGroups.length,
          sessions: restoredSessions.length,
          payments: restoredPayments.length,
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
      if (Array.isArray(data.creditLogs)) {
        const existing = getList<SessionCreditLog>(STORAGE_KEYS.CREDIT_LOGS, []).filter((l) => l.userId !== activeUserId);
        const imported = data.creditLogs.map((l: SessionCreditLog) => ({ ...l, userId: activeUserId }));
        saveList(STORAGE_KEYS.CREDIT_LOGS, [...imported, ...existing]);
      }
      if (Array.isArray(data.behaviorLogs)) {
        const existing = getList<StudentBehaviorLog>(STORAGE_KEYS.BEHAVIOR_LOGS, []).filter((b) => b.userId !== activeUserId);
        const imported = data.behaviorLogs.map((b: StudentBehaviorLog) => ({ ...b, userId: activeUserId }));
        saveList(STORAGE_KEYS.BEHAVIOR_LOGS, [...imported, ...existing]);
      }
      if (Array.isArray(data.homeworkTests)) {
        const existing = getList<HomeworkTest>(STORAGE_KEYS.HOMEWORK_TESTS, []).filter((t) => t.userId !== activeUserId);
        const imported = data.homeworkTests.map((t: HomeworkTest) => ({ ...t, userId: activeUserId }));
        saveList(STORAGE_KEYS.HOMEWORK_TESTS, [...imported, ...existing]);
      }
      if (Array.isArray(data.homeworkAssignments)) {
        const existing = getList<HomeworkAssignment>(STORAGE_KEYS.HOMEWORK_ASSIGNMENTS, []).filter((a) => a.userId !== activeUserId);
        const imported = data.homeworkAssignments.map((a: HomeworkAssignment) => ({ ...a, userId: activeUserId }));
        saveList(STORAGE_KEYS.HOMEWORK_ASSIGNMENTS, [...imported, ...existing]);
      }
      if (Array.isArray(data.homeworkQuestionResults)) {
        db.saveHomeworkQuestionResultsBatch(data.homeworkQuestionResults);
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

  // 10. User Accounts & Authentication System (Server-Authoritative with Cloud Run & Firestore)
  getAccounts: (): UserAccount[] => {
    return getList<UserAccount>(STORAGE_KEYS.ACCOUNTS, []);
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
        const storedToken = localStorage.getItem(`tm_v2_auth_token_${user.id}`);
        if (storedToken && storedToken.trim()) {
          user.authToken = storedToken.trim();
        }
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
        const storedToken = localStorage.getItem(`tm_v2_auth_token_${user.id}`);
        if (storedToken && storedToken.trim()) {
          user.authToken = storedToken.trim();
        }
      }
      if (user.authToken && user.authToken.trim()) {
        try {
          localStorage.setItem(`tm_v2_auth_token_${user.id}`, user.authToken.trim());
        } catch {}
      }
      localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(user));
    }
  },

  registerAccount: async (accountData: {
    name: string;
    email: string;
    phone?: string;
    subject?: string;
    centerOrSchool?: string;
    password: string;
    recoveryPin?: string;
    securityQuestion?: string;
    securityAnswer?: string;
  }): Promise<{ success: boolean; user?: UserAccount; error?: string }> => {
    const regUrl = getFullApiUrl('/api/auth/register');
    console.log('[Auth API] Registering account at:', regUrl);

    try {
      const res = await universalApiFetch(regUrl, {
        method: 'POST',
        body: accountData,
        timeoutMs: 15000,
      });

      if (res.ok && res.data && res.data.success && res.data.user) {
        const serverUser = res.data.user;
        const token = (res.data.token && typeof res.data.token === 'string') ? res.data.token.trim() : '';

        const newAccount: UserAccount = {
          id: serverUser.id,
          name: serverUser.name || accountData.name.trim(),
          email: serverUser.email || accountData.email.trim().toLowerCase(),
          phone: serverUser.phone || accountData.phone?.trim(),
          subject: serverUser.subject || accountData.subject?.trim(),
          centerOrSchool: serverUser.centerOrSchool || accountData.centerOrSchool?.trim(),
          password: accountData.password,
          authToken: token,
          recoveryPin: serverUser.recoveryPin || accountData.recoveryPin?.trim() || '123456',
          securityQuestion: accountData.securityQuestion?.trim() || 'ما هي مادتك الدراسية؟',
          securityAnswer: accountData.securityAnswer?.trim() || accountData.subject?.trim() || '',
          createdAt: serverUser.createdAt || new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };

        // Cache locally
        if (token) {
          localStorage.setItem(`tm_v2_auth_token_${serverUser.id}`, token);
        }
        const existing = getList<UserAccount>(STORAGE_KEYS.ACCOUNTS, []).filter((a) => a.id !== newAccount.id);
        db.saveAccounts([newAccount, ...existing]);

        db.saveTeacherProfile(
          {
            name: newAccount.name,
            subject: newAccount.subject || 'عام',
            phone: newAccount.phone || '',
            centerOrSchool: newAccount.centerOrSchool || '',
            currency: 'ج.م',
          },
          newAccount.id
        );

        db.setCurrentSession(newAccount);
        autoSyncUserAccount(newAccount.id);
        return { success: true, user: newAccount };
      } else {
        return {
          success: false,
          error: res.data?.error || res.error || 'فشل إنشاء الحساب بالسيرفر السحابي.',
        };
      }
    } catch (err: any) {
      console.warn('[Auth API] Registration network error:', err);
      return { success: false, error: err.message || 'حدث خطأ في الاتصال بالإنترنت أثناء إنشاء الحساب.' };
    }
  },

  getLastAuthDiagnostics: (): AuthDiagnostics | null => {
    return lastAuthDiagnosticsRecord;
  },

  login: async (
    identifier: string,
    password: string
  ): Promise<{
    success: boolean;
    user?: UserAccount;
    error?: string;
    isOffline?: boolean;
    diagnostics?: AuthDiagnostics;
  }> => {
    const clean = (identifier || '').trim();
    const loginUrl = getFullApiUrl('/api/auth/login');

    console.log('=== [AUTH & RESTORE DIAGNOSTICS] ===');
    console.log('[Auth] 1. Login Request URL:', loginUrl);
    console.log('[Auth] 2. Login Identifier:', clean);

    const diag: AuthDiagnostics = {
      loginRequestUrl: loginUrl,
      httpStatus: 0,
      loginSuccess: false,
      tokenSaved: false,
      syncPullStatus: 'not_attempted',
      studentsReceived: 0,
      groupsReceived: 0,
      sessionsReceived: 0,
      paymentsReceived: 0,
      restoreSuccess: false,
      restoreMessage: '',
      timestamp: new Date().toISOString(),
    };
    lastAuthDiagnosticsRecord = diag;

    if (!clean) {
      diag.restoreMessage = 'يرجى إدخال البريد الإلكتروني أو رقم الهاتف أو اسم المستخدم.';
      return { success: false, error: diag.restoreMessage, diagnostics: diag };
    }

    try {
      // 1. Authenticate with Cloud Run Production API -> Firestore
      const res = await universalApiFetch(loginUrl, {
        method: 'POST',
        body: { identifier: clean, email: clean, phone: clean, password },
        timeoutMs: 15000,
      });

      diag.httpStatus = res.status;
      console.log('[Auth] 3. HTTP Status:', res.status, 'Response:', res.data);

      if (res.ok && res.data && res.data.success && res.data.user) {
        const serverUser = res.data.user;
        const token = (res.data.token && typeof res.data.token === 'string') ? res.data.token.trim() : '';

        diag.loginSuccess = true;
        diag.authenticatedUserId = serverUser.id;

        console.log('[Auth] 4. Authentication Result: SUCCESS');
        console.log('[Auth] 5. Returned User ID:', serverUser.id, 'Email:', serverUser.email);

        const userAccount: UserAccount = {
          id: serverUser.id,
          name: serverUser.name || 'معلم',
          email: serverUser.email,
          phone: serverUser.phone || '',
          subject: serverUser.subject || 'عام',
          centerOrSchool: serverUser.centerOrSchool || '',
          password: password,
          authToken: token,
          recoveryPin: serverUser.recoveryPin || '123456',
          createdAt: serverUser.createdAt || new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };

        // Cache token locally
        if (token) {
          try {
            localStorage.setItem(`tm_v2_auth_token_${serverUser.id}`, token);
            diag.tokenSaved = true;
          } catch {
            diag.tokenSaved = false;
          }
        }

        // Update local accounts array (offline cache)
        const existingAccounts = getList<UserAccount>(STORAGE_KEYS.ACCOUNTS, []).filter(
          (a) => a.id !== serverUser.id
        );
        db.saveAccounts([userAccount, ...existingAccounts]);

        // Save profile
        db.saveTeacherProfile(
          {
            name: userAccount.name,
            subject: userAccount.subject || 'عام',
            phone: userAccount.phone || '',
            centerOrSchool: userAccount.centerOrSchool || '',
            currency: 'ج.م',
          },
          userAccount.id
        );

        // Set session
        db.setCurrentSession(userAccount);

        // Process any pending reset for this user BEFORE performing cloud pull
        const pendingReset = getPendingReset(serverUser.id);
        const localReset = getResetAllBefore(serverUser.id);
        const effectiveResetBarrier = pendingReset?.resetAllBefore || localReset;

        if (effectiveResetBarrier && token) {
          console.log(`[Auth -> Login] Found reset barrier ${effectiveResetBarrier} for user ${serverUser.id}. Ensuring server acknowledges reset before pulling...`);
          try {
            const resetAck = await syncResetToCloud(serverUser.id, effectiveResetBarrier, token);
            console.log('[Auth -> Login] syncResetToCloud result before pull:', resetAck.success, resetAck.acknowledged);
          } catch (resetErr) {
            console.warn('[Auth -> Login] Failed to synchronize reset to cloud before pull, will still enforce local reset barrier on incoming pull data:', resetErr);
          }
        }

        // 2. Immediately call authenticated /api/sync/pull to restore all Firestore cloud data
        if (token) {
          const pullUrl = getFullApiUrl('/api/sync/pull');
          console.log('[Auth -> Restore] 6. Pull Request URL:', pullUrl);

          try {
            const pullRes = await universalApiFetch(pullUrl, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
                'x-auth-token': token,
              },
              timeoutMs: 20000,
            });

            diag.syncPullStatus = pullRes.status;
            console.log('[Auth -> Restore] 8. Pull Request Status:', pullRes.status, 'Ok:', pullRes.ok);

            if (pullRes.ok && pullRes.data && pullRes.data.success && pullRes.data.dataPackage) {
              const cloudPkg: UserAccountDataPackage = pullRes.data.dataPackage;
              diag.studentsReceived = cloudPkg.students?.length || 0;
              diag.groupsReceived = cloudPkg.groups?.length || 0;
              diag.sessionsReceived = cloudPkg.sessions?.length || 0;
              diag.paymentsReceived = cloudPkg.payments?.length || 0;

              console.log('[Auth -> Restore] 9. Cloud Data Counts from Firestore:', {
                students: diag.studentsReceived,
                groups: diag.groupsReceived,
                sessions: diag.sessionsReceived,
                payments: diag.paymentsReceived,
                enrollments: cloudPkg.enrollments?.length || 0,
                attendance: cloudPkg.attendance?.length || 0,
                creditLogs: cloudPkg.creditLogs?.length || 0,
                resetAllBefore: cloudPkg.resetAllBefore,
              });

              const restoreRes = db.restoreAccountData(serverUser.id, cloudPkg);
              diag.restoreSuccess = restoreRes.success;
              diag.restoreMessage = restoreRes.message;
              console.log('[Auth -> Restore] 10. Restore Counts locally:', restoreRes.count, 'Success:', restoreRes.success);
            } else {
              diag.restoreSuccess = true;
              diag.restoreMessage = 'لا توجد بيانات سابقة مسجلة لهذا الحساب بالسيرفر السحابي.';
              console.log('[Auth -> Restore] 9. No existing cloud data package found in Firestore for this user.');
            }
          } catch (pullErr: any) {
            diag.syncPullStatus = `error: ${pullErr.message}`;
            diag.restoreMessage = `فشل سحب البيانات: ${pullErr.message}`;
            console.warn('[Auth -> Restore] Error pulling cloud data after login:', pullErr);
          }
        }

        // Initialize background auto-sync scheduler for this account
        autoSyncUserAccount(serverUser.id);
        lastAuthDiagnosticsRecord = diag;

        return { success: true, user: userAccount, diagnostics: diag };
      }

      // If server explicitly returned 401 or failed credentials
      if (res.status === 401 || (res.data && res.data.success === false)) {
        diag.restoreMessage = res.data?.error || 'بيانات الدخول غير صحيحة.';
        lastAuthDiagnosticsRecord = diag;
        console.warn('[Auth] 4. Authentication Result: FAILED -', res.data?.error);
        return {
          success: false,
          error: res.data?.error || 'بيانات الدخول غير صحيحة، يرجى التأكد من البريد أو الهاتف وكلمة المرور.',
          diagnostics: diag,
        };
      }

      console.warn('[Auth] Server returned non-ok status:', res.status, res.error);
    } catch (netErr: any) {
      diag.httpStatus = `error: ${netErr.message}`;
      console.warn('[Auth] Network error during server login:', netErr);
    }

    // Offline Fallback: ONLY if the account was previously logged in on this device
    const cachedAccounts = getList<UserAccount>(STORAGE_KEYS.ACCOUNTS, []);
    const cached = cachedAccounts.find(
      (a) =>
        a.email.toLowerCase() === clean.toLowerCase() ||
        (a.phone && a.phone.trim() === clean) ||
        a.name.toLowerCase() === clean.toLowerCase()
    );

    if (cached && cached.password === password) {
      console.log('[Auth] Logging in via local offline cache...');
      cached.lastLoginAt = new Date().toISOString();
      db.saveAccounts(cachedAccounts.map((a) => (a.id === cached.id ? cached : a)));
      db.setCurrentSession(cached);
      autoSyncUserAccount(cached.id);
      diag.loginSuccess = true;
      diag.authenticatedUserId = cached.id;
      diag.restoreMessage = 'تم الدخول عبر النسخة المحلية المؤقتة (Offline)';
      lastAuthDiagnosticsRecord = diag;
      return { success: true, user: cached, isOffline: true, diagnostics: diag };
    }

    diag.restoreMessage = 'تعذر الاتصال بالسيرفر السحابي للتحقق من الحساب.';
    lastAuthDiagnosticsRecord = diag;
    return {
      success: false,
      error:
        'تعذر الاتصال بالسيرفر السحابي للتحقق من الحساب واستعادة البيانات. يرجى التأكد من اتصال الإنترنت والمحاولة مجدداً.',
      diagnostics: diag,
    };
  },

  logout: (): void => {
    db.setCurrentSession(null);
  },

  resetPassword: async (
    identifier: string,
    newPassword: string,
    recoveryPinOrAnswer?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const clean = (identifier || '').trim();
    const resetUrl = getFullApiUrl('/api/auth/reset-password');

    try {
      const res = await universalApiFetch(resetUrl, {
        method: 'POST',
        body: {
          identifier: clean,
          newPassword,
          recoveryPin: recoveryPinOrAnswer?.trim(),
        },
        timeoutMs: 15000,
      });

      if (res.ok && res.data && res.data.success) {
        // Update local cached account if present
        const accounts = getList<UserAccount>(STORAGE_KEYS.ACCOUNTS, []);
        const updated = accounts.map((a) => {
          if (a.email.toLowerCase() === clean.toLowerCase() || (a.phone && a.phone.trim() === clean)) {
            return { ...a, password: newPassword };
          }
          return a;
        });
        db.saveAccounts(updated);
        return { success: true };
      } else {
        return { success: false, error: res.data?.error || res.error || 'فشل استعادة كلمة المرور.' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'حدث خطأ في الاتصال أثناء استعادة كلمة المرور.' };
    }
  },

  clearUserData: async (
    userId?: string
  ): Promise<{ success: boolean; message: string; dataPackage?: UserAccountDataPackage; error?: string }> => {
    const targetUserId = userId || getActiveUserId();
    const now = new Date().toISOString();

    console.log(`[Storage] clearUserData triggered for ${targetUserId} with reset timestamp ${now}`);

    // 1. Set the resetAllBefore timestamp for the user (MUST be preserved across all local and cloud ops)
    setResetAllBefore(now, targetUserId);

    // 2. Persist durable PendingResetRecord BEFORE starting any network operation
    const pendingRecord: PendingResetRecord = {
      userId: targetUserId,
      resetAllBefore: now,
      timestamp: now,
      attempts: 0,
    };
    setPendingReset(pendingRecord);

    // 3. Clear ONLY the domain user-data collections for this user immediately
    // Preserving: RESET_ALL_BEFORE, CURRENT_SESSION, ACCOUNTS, auth tokens, AUTO_SYNC_CONFIG, TEACHER_PROFILE
    const filterUser = <T extends { userId?: string }>(key: string) => {
      const list = getList<T>(key, []);
      const remaining = list.filter((item) => (item.userId ? item.userId !== targetUserId : targetUserId !== 'acc_master_teacher'));
      saveList(key, remaining);
    };

    filterUser(STORAGE_KEYS.STUDENTS);
    filterUser(STORAGE_KEYS.GROUPS);
    filterUser(STORAGE_KEYS.ENROLLMENTS);
    filterUser(STORAGE_KEYS.SESSIONS);
    filterUser(STORAGE_KEYS.ATTENDANCE);
    filterUser(STORAGE_KEYS.PAYMENTS);
    filterUser(STORAGE_KEYS.CREDIT_LOGS);
    filterUser(STORAGE_KEYS.HOMEWORK_TESTS);
    filterUser(STORAGE_KEYS.HOMEWORK_ASSIGNMENTS);
    saveList(STORAGE_KEYS.HOMEWORK_QUESTION_RESULTS, []);

    // 4. Clear local tombstones for this user since resetAllBefore clears all prior history
    saveDeletionTombstones([], targetUserId);

    // 5. Clear backup and userAccount.syncedData
    try {
      localStorage.removeItem(`tm_v2_user_backup_${targetUserId}`);
    } catch {}

    const accounts = getList<UserAccount>(STORAGE_KEYS.ACCOUNTS, []);
    const updatedAccounts = accounts.map((acc) => {
      if (acc.id === targetUserId) {
        return {
          ...acc,
          resetAllBefore: now,
          pendingReset: pendingRecord,
          syncedData: undefined,
        };
      }
      return acc;
    });
    db.saveAccounts(updatedAccounts);

    // 6. Build data package containing resetAllBefore marker and empty arrays
    const localPkg = autoSyncUserAccount(targetUserId);

    // 7. Transmit the reset marker directly to cloud backend with explicit server acknowledgment
    try {
      console.log(`[Storage] clearUserData pushing reset to cloud backend for ${targetUserId}...`);
      const resetResult = await syncResetToCloud(targetUserId, now);
      console.log(`[Storage] clearUserData cloud reset result for ${targetUserId}:`, resetResult.success, resetResult.acknowledged);

      if (resetResult.success && resetResult.acknowledged) {
        return {
          success: true,
          message: 'تم مسح كافة البيانات وتأكيد التصفير مع السيرفر السحابي بنجاح.',
          dataPackage: localPkg,
        };
      } else {
        return {
          success: true,
          message: 'تم مسح كافة البيانات محلياً بأمان. ستتم مزامنة التصفير سحابياً عند استقرار الاتصال.',
          dataPackage: localPkg,
          error: resetResult.error,
        };
      }
    } catch (err: any) {
      console.warn('[Storage] Clear user data cloud sync warning (local wipe preserved):', err);
      return {
        success: true,
        message: 'تم مسح كافة البيانات محلياً بأمان. ستتم مزامنة التصفير سحابياً عند استقرار الاتصال.',
        dataPackage: localPkg,
        error: err.message,
      };
    }
  },

  clearAllData: async (): Promise<{ success: boolean; message: string; dataPackage?: UserAccountDataPackage; error?: string }> => {
    const activeUserId = getActiveUserId();
    return db.clearUserData(activeUserId);
  },

  // Pending Reset Management
  getPendingReset: (userId?: string): PendingResetRecord | null => {
    return getPendingReset(userId);
  },

  getAllPendingResets: (): PendingResetRecord[] => {
    return getAllPendingResets();
  },

  setPendingReset: (record: PendingResetRecord): void => {
    setPendingReset(record);
  },

  clearPendingReset: (userId: string): void => {
    clearPendingReset(userId);
  },

  syncResetToCloud: async (
    userId: string,
    resetAllBefore: string,
    explicitToken?: string
  ): Promise<{ success: boolean; acknowledged: boolean; verifiedActiveStudents?: number; error?: string }> => {
    return syncResetToCloud(userId, resetAllBefore, explicitToken);
  },

  processPendingResets: async (targetUserId?: string): Promise<void> => {
    return processPendingResets(targetUserId);
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
