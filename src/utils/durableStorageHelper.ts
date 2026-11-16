/**
 * Durable Storage, Quota Self-Healing, Persistent Sync Queue & Diagnostic Helper
 *
 * Ensures that:
 * 1. Leaked legacy backup keys (e.g. `tm_v2_sessions_backup_*`) are purged and quota is reclaimed.
 * 2. Storage writes never silently fail: callers either get a verified persistent commit or a typed `StoragePersistenceError`.
 * 3. Every local domain mutation increments a durable per-user `localMutationSeq` so pending cloud sync survives process termination, offline periods, failed syncs, and 401 re-auth.
 * 4. An asynchronous IndexedDB secondary mirror backs up account packages & sync queue state on Android WebView/browsers where `localStorage` quota is tight (~5 MB).
 * 5. A compact circular diagnostic log (`tm_v2_diag_log`) tracks quota recoveries, commit failures, and sync lifecycle events without unbounded growth.
 */

export type StoragePersistenceErrorCode =
  | 'QUOTA_EXCEEDED'
  | 'STORAGE_UNAVAILABLE'
  | 'WRITE_VERIFY_FAILED';

export class StoragePersistenceError extends Error {
  public readonly code: StoragePersistenceErrorCode;
  public readonly key: string;
  public readonly causeError?: unknown;

  constructor(code: StoragePersistenceErrorCode, key: string, message: string, causeError?: unknown) {
    super(message);
    this.name = 'StoragePersistenceError';
    this.code = code;
    this.key = key;
    this.causeError = causeError;
  }
}

export interface PersistentSyncQueueState {
  userId: string;
  localMutationSeq: number;
  lastSyncedMutationSeq: number;
  dirtySince: string | null;
  lastAttemptAt: string | null;
  consecutiveFailures: number;
  nextRetryAt: string | null;
  lastError: string | null;
  lastHttpStatus: number | null;
  authExpired: boolean;
  inFlightStartedAt: string | null;
  updatedAt: string;
}

export interface DiagnosticLogEntry {
  ts: string;
  event:
    | 'commit_fail'
    | 'quota_reclaim'
    | 'sync_start'
    | 'sync_success'
    | 'sync_fail'
    | 'sync_auth_expired'
    | 'merge_conflict'
    | 'idb_recovery';
  detail: string;
  userId?: string;
}

const DIAG_LOG_KEY = 'tm_v2_diag_log';
const MAX_DIAG_LOG_ENTRIES = 40;
const SYNC_QUEUE_KEY_PREFIX = 'tm_v2_sync_queue_';

const IDB_NAME = 'ClassyDurableMirrorDB';
const IDB_VERSION = 1;
const IDB_STORE_PACKAGES = 'user_packages';
const IDB_STORE_QUEUES = 'sync_queues';

// Protected primary keys that must NEVER be deleted during emergency quota reclamation
const PROTECTED_PRIMARY_PREFIXES = [
  'tm_v2_students',
  'tm_v2_groups',
  'tm_v2_enrollments',
  'tm_v2_sessions',
  'tm_v2_attendance',
  'tm_v2_payments',
  'tm_v2_session_credit_logs',
  'tm_v2_student_behavior_logs',
  'tm_v2_homework_tests',
  'tm_v2_homework_assignments',
  'tm_v2_homework_question_results',
  'tm_v2_accounts',
  'tm_v2_current_session',
  'tm_v2_auth_token_',
  'tm_v2_deletion_tombstones',
  'tm_v2_reset_all_before',
  'tm_v2_pending_reset_',
  'tm_v2_pending_resets_list',
  'tm_v2_sync_queue_',
  'tm_v2_auto_sync_config',
  'tm_v2_teacher_profile',
];

function isProtectedPrimaryKey(k: string): boolean {
  if (k.startsWith('tm_v2_sessions_backup_') || k === 'tm_v2_sessions_pre_cleanup_backup') {
    return false;
  }
  return PROTECTED_PRIMARY_PREFIXES.some((prefix) => k === prefix || k.startsWith(prefix));
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number; message?: string };
  if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  if (e.code === 22 || e.code === 1014) return true;
  if (typeof e.message === 'string' && e.message.toLowerCase().includes('quota')) return true;
  return false;
}

export function getPersistenceDiagLogs(): DiagnosticLogEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DIAG_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function logPersistenceDiag(
  event: DiagnosticLogEntry['event'],
  detail: string,
  userId?: string
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const current = getPersistenceDiagLogs();
    const entry: DiagnosticLogEntry = {
      ts: new Date().toISOString(),
      event,
      detail: String(detail || '').slice(0, 220),
      ...(userId ? { userId } : {}),
    };
    const next = [entry, ...current].slice(0, MAX_DIAG_LOG_ENTRIES);
    localStorage.setItem(DIAG_LOG_KEY, JSON.stringify(next));
  } catch {
    // Diagnostic log is non-critical; if storage is completely full, clear diag log to free bytes
    try {
      localStorage.removeItem(DIAG_LOG_KEY);
    } catch {}
  }
}

/**
 * Purges unbounded timestamped `tm_v2_sessions_backup_*` keys leaked by earlier versions.
 * Safe to run on startup before reading/writing domain collections.
 */
export function purgeLeakedSessionBackups(alsoRemovePreCleanup = false): {
  removedKeys: number;
  freedChars: number;
} {
  if (typeof localStorage === 'undefined') {
    return { removedKeys: 0, freedChars: 0 };
  }
  let removedKeys = 0;
  let freedChars = 0;
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith('tm_v2_sessions_backup_') ||
        (alsoRemovePreCleanup && k === 'tm_v2_sessions_pre_cleanup_backup')
      ) {
        keysToDelete.push(k);
      }
    }
    for (const k of keysToDelete) {
      const val = localStorage.getItem(k);
      freedChars += (k.length + (val ? val.length : 0));
      localStorage.removeItem(k);
      removedKeys++;
    }
  } catch {}
  if (removedKeys > 0) {
    logPersistenceDiag(
      'quota_reclaim',
      `Purged ${removedKeys} leaked session backup keys (~${Math.round(freedChars / 1024)}KB)`
    );
  }
  return { removedKeys, freedChars };
}

/**
 * Compacts `tm_v2_accounts` & `tm_v2_current_session` by stripping redundant multi-MB `syncedData` blobs.
 */
export function stripEmbeddedSyncedDataFromAccounts(): number {
  if (typeof localStorage === 'undefined') return 0;
  let strippedCount = 0;
  try {
    const rawAcc = localStorage.getItem('tm_v2_accounts');
    if (rawAcc) {
      const accounts = JSON.parse(rawAcc);
      if (Array.isArray(accounts)) {
        let modified = false;
        const cleaned = accounts.map((acc: any) => {
          if (acc && typeof acc === 'object' && 'syncedData' in acc && acc.syncedData !== undefined) {
            const { syncedData: _drop, ...rest } = acc;
            modified = true;
            strippedCount++;
            return rest;
          }
          return acc;
        });
        if (modified) {
          localStorage.setItem('tm_v2_accounts', JSON.stringify(cleaned));
        }
      }
    }
  } catch {}

  try {
    const rawCur = localStorage.getItem('tm_v2_current_session');
    if (rawCur) {
      const cur = JSON.parse(rawCur);
      if (cur && typeof cur === 'object' && 'syncedData' in cur && cur.syncedData !== undefined) {
        const { syncedData: _drop, ...rest } = cur;
        localStorage.setItem('tm_v2_current_session', JSON.stringify(rest));
        strippedCount++;
      }
    }
  } catch {}

  return strippedCount;
}

/**
 * Prunes notification state maps so daily notification IDs do not accumulate unboundedly over weeks.
 */
export function pruneNotificationStateMaps(maxEntries = 150): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === 'tm_v2_notification_states' || k.startsWith('tm_v2_notification_states_'))) {
        keys.push(k);
      }
    }
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      const entries = Object.entries(parsed as Record<string, any>);
      if (entries.length <= maxEntries) continue;

      entries.sort((a, b) => {
        const ta = new Date(a[1]?.dismissedAt || a[1]?.readAt || a[1]?.firstSeenAt || 0).getTime() || 0;
        const tb = new Date(b[1]?.dismissedAt || b[1]?.readAt || b[1]?.firstSeenAt || 0).getTime() || 0;
        return tb - ta;
      });
      const prunedObj: Record<string, any> = {};
      for (const [entryKey, val] of entries.slice(0, maxEntries)) {
        prunedObj[entryKey] = val;
      }
      localStorage.setItem(k, JSON.stringify(prunedObj));
    }
  } catch {}
}

/**
 * Multi-tier localStorage quota reclamation when a critical write encounters QuotaExceededError.
 * Level 1: Removes leaked session backups, redundant embedded syncedData, and prunes notification states/cooldowns.
 * Level 2 (aggressive, when target key is a protected collection): Also removes disposable duplicate full-package
 *          `tm_v2_user_backup_*` snapshots (since primary keys + IndexedDB mirror already hold the data).
 */
export function reclaimLocalStorageQuota(targetKey: string, aggressive = true): {
  reclaimedBytes: number;
  actions: string[];
} {
  if (typeof localStorage === 'undefined') {
    return { reclaimedBytes: 0, actions: [] };
  }
  const actions: string[] = [];
  let reclaimedBytes = 0;

  // Tier 1a: Remove all legacy timestamped & pre-cleanup session backups
  const sessionPurge = purgeLeakedSessionBackups(true);
  if (sessionPurge.removedKeys > 0) {
    reclaimedBytes += sessionPurge.freedChars;
    actions.push(`purged_session_backups:${sessionPurge.removedKeys}`);
  }

  // Tier 1b: Strip redundant syncedData inside accounts/session
  const stripped = stripEmbeddedSyncedDataFromAccounts();
  if (stripped > 0) {
    actions.push(`stripped_account_syncedData:${stripped}`);
  }

  // Tier 1c: Prune old notification states & cooldown caches
  pruneNotificationStateMaps(120);
  try {
    const disposableKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k === targetKey) continue;
      if (
        k.startsWith('tm_v2_notif_cooldowns_') ||
        k.startsWith('tm_v2_scheduled_notifs_') ||
        k === DIAG_LOG_KEY
      ) {
        disposableKeys.push(k);
      }
    }
    for (const k of disposableKeys) {
      const v = localStorage.getItem(k);
      reclaimedBytes += k.length + (v ? v.length : 0);
      localStorage.removeItem(k);
    }
    if (disposableKeys.length > 0) {
      actions.push(`cleared_disposable:${disposableKeys.length}`);
    }
  } catch {}

  // Tier 2: Aggressive reclamation (only when writing a primary collection key that MUST succeed)
  if (aggressive && isProtectedPrimaryKey(targetKey)) {
    try {
      const userBackupKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || k === targetKey) continue;
        if (k.startsWith('tm_v2_user_backup_') || k.startsWith('tm_v2_notification_events_')) {
          userBackupKeys.push(k);
        }
      }
      for (const k of userBackupKeys) {
        const v = localStorage.getItem(k);
        reclaimedBytes += k.length + (v ? v.length : 0);
        localStorage.removeItem(k);
      }
      if (userBackupKeys.length > 0) {
        actions.push(`cleared_redundant_full_backups:${userBackupKeys.length}`);
      }
    } catch {}
  }

  if (actions.length > 0) {
    logPersistenceDiag('quota_reclaim', `For ${targetKey}: ${actions.join(', ')} (~${Math.round(reclaimedBytes / 1024)}KB)`);
  }
  return { reclaimedBytes, actions };
}

export function getSyncQueueKey(userId: string): string {
  return `${SYNC_QUEUE_KEY_PREFIX}${userId || 'acc_master_teacher'}`;
}

export function createDefaultSyncQueueState(userId: string): PersistentSyncQueueState {
  return {
    userId: userId || 'acc_master_teacher',
    localMutationSeq: 0,
    lastSyncedMutationSeq: 0,
    dirtySince: null,
    lastAttemptAt: null,
    consecutiveFailures: 0,
    nextRetryAt: null,
    lastError: null,
    lastHttpStatus: null,
    authExpired: false,
    inFlightStartedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function getSyncQueueState(userId: string): PersistentSyncQueueState {
  const uid = userId || 'acc_master_teacher';
  if (typeof localStorage === 'undefined') {
    return createDefaultSyncQueueState(uid);
  }
  try {
    const raw = localStorage.getItem(getSyncQueueKey(uid));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          ...createDefaultSyncQueueState(uid),
          ...parsed,
          userId: uid,
          localMutationSeq: Number(parsed.localMutationSeq) || 0,
          lastSyncedMutationSeq: Number(parsed.lastSyncedMutationSeq) || 0,
          consecutiveFailures: Number(parsed.consecutiveFailures) || 0,
          authExpired: Boolean(parsed.authExpired),
        };
      }
    }
  } catch {}
  return createDefaultSyncQueueState(uid);
}

export function saveSyncQueueState(state: PersistentSyncQueueState): PersistentSyncQueueState {
  const normalized: PersistentSyncQueueState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  if (typeof localStorage !== 'undefined') {
    const key = getSyncQueueKey(normalized.userId);
    const json = JSON.stringify(normalized);
    try {
      localStorage.setItem(key, json);
    } catch (err) {
      if (isQuotaExceededError(err)) {
        reclaimLocalStorageQuota(key, true);
        try {
          localStorage.setItem(key, json);
        } catch {}
      }
    }
  }
  idbMirrorSyncQueue(normalized).catch(() => {});
  return normalized;
}

export function hasPendingCloudSync(userId: string): boolean {
  const q = getSyncQueueState(userId);
  return q.localMutationSeq > q.lastSyncedMutationSeq;
}

export function markLocalMutationDirty(userId: string, _reason?: string): PersistentSyncQueueState {
  const uid = userId || 'acc_master_teacher';
  const cur = getSyncQueueState(uid);
  const nextSeq = cur.localMutationSeq + 1;
  const nowIso = new Date().toISOString();
  return saveSyncQueueState({
    ...cur,
    localMutationSeq: nextSeq,
    dirtySince: cur.dirtySince || nowIso,
    // Reset nextRetryAt on fresh user edit so online background sync tries promptly
    nextRetryAt: null,
  });
}

// ============================================================================
// Lightweight IndexedDB Secondary Mirror (Browser & Android WebView)
// Safe no-op in Node/Vitest environments lacking global indexedDB.
// ============================================================================

let idbOpenPromise: Promise<IDBDatabase | null> | null = null;

function openMirrorDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (idbOpenPromise) {
    return idbOpenPromise;
  }
  idbOpenPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_PACKAGES)) {
          db.createObjectStore(IDB_STORE_PACKAGES, { keyPath: 'userId' });
        }
        if (!db.objectStoreNames.contains(IDB_STORE_QUEUES)) {
          db.createObjectStore(IDB_STORE_QUEUES, { keyPath: 'userId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return idbOpenPromise;
}

export async function idbMirrorUserPackage(userId: string, pkg: any): Promise<boolean> {
  try {
    const idb = await openMirrorDb();
    if (!idb) return false;
    return await new Promise<boolean>((resolve) => {
      try {
        const tx = idb.transaction(IDB_STORE_PACKAGES, 'readwrite');
        const store = tx.objectStore(IDB_STORE_PACKAGES);
        store.put({
          userId,
          updatedAt: new Date().toISOString(),
          pkg,
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

export async function idbLoadUserPackage(userId: string): Promise<any | null> {
  try {
    const idb = await openMirrorDb();
    if (!idb) return null;
    return await new Promise<any | null>((resolve) => {
      try {
        const tx = idb.transaction(IDB_STORE_PACKAGES, 'readonly');
        const store = tx.objectStore(IDB_STORE_PACKAGES);
        const req = store.get(userId);
        req.onsuccess = () => resolve(req.result?.pkg || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

export async function idbMirrorSyncQueue(queue: PersistentSyncQueueState): Promise<boolean> {
  try {
    const idb = await openMirrorDb();
    if (!idb) return false;
    return await new Promise<boolean>((resolve) => {
      try {
        const tx = idb.transaction(IDB_STORE_QUEUES, 'readwrite');
        tx.objectStore(IDB_STORE_QUEUES).put(queue);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

export async function idbDeleteUserPackage(userId: string): Promise<void> {
  try {
    const idb = await openMirrorDb();
    if (!idb) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = idb.transaction([IDB_STORE_PACKAGES, IDB_STORE_QUEUES], 'readwrite');
        tx.objectStore(IDB_STORE_PACKAGES).delete(userId);
        tx.objectStore(IDB_STORE_QUEUES).delete(userId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {}
}
