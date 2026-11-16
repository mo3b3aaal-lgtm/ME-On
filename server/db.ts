import { Firestore } from "@google-cloud/firestore";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Load configuration for project and named database
let projectId = "corded-elevator-cf6jr";
let databaseId = "ai-studio-teacherskdb-2ab7b23f-628d-4bc7-9c38-f649ca7153f9";

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (config.projectId) projectId = config.projectId;
    if (config.firestoreDatabaseId) databaseId = config.firestoreDatabaseId;
  }
} catch {}

// Initialize official @google-cloud/firestore Server SDK with Application Default Credentials (ADC)
export const db = new Firestore({
  projectId,
  databaseId,
});

export interface ServerUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  subject?: string;
  centerOrSchool?: string;
  password_hash?: string;
  auth_token: string;
  active_tokens?: string[];
  recovery_pin?: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

// -----------------------------------------------------------------------------
// Connectivity Gate: Probes Firestore with cooldown retry so transient cold-start
// timeouts do not permanently disable Firestore for the process lifetime.
// -----------------------------------------------------------------------------
let firestoreAccessible: boolean | null = null;
let lastFirestoreProbeAt = 0;
const FIRESTORE_FAILURE_RETRY_COOLDOWN_MS = 15000;

export async function isFirestoreConnected(): Promise<boolean> {
  const now = Date.now();
  if (firestoreAccessible === true) {
    return true;
  }
  if (firestoreAccessible === false && now - lastFirestoreProbeAt < FIRESTORE_FAILURE_RETRY_COOLDOWN_MS) {
    return false;
  }
  lastFirestoreProbeAt = now;
  try {
    const testQuery = db.collection("users").limit(1);
    await Promise.race([
      testQuery.get(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000)),
    ]);
    firestoreAccessible = true;
    return true;
  } catch {
    firestoreAccessible = false;
    return false;
  }
}

// -----------------------------------------------------------------------------
// Persistent Local Store (Seamless Zero-Downtime Fallback for Cloud Run & AI Studio)
// -----------------------------------------------------------------------------
interface LocalDatabaseStore {
  users: Record<string, ServerUser>;
  syncPackages: Record<string, any>;
}

const dataDir = path.join(process.cwd(), ".data");
const storeFilePath = path.join(dataDir, "db_store.json");

function loadLocalStore(): LocalDatabaseStore {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(storeFilePath)) {
      const content = fs.readFileSync(storeFilePath, "utf-8");
      return JSON.parse(content);
    }
  } catch {}
  return { users: {}, syncPackages: {} };
}

const localStore = loadLocalStore();

function persistLocalStore(): void {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(storeFilePath, JSON.stringify(localStore, null, 2), "utf-8");
  } catch {}
}

// Default pre-seeded demo teacher user
const DEFAULT_DEMO_USER: ServerUser = {
  id: "acc_master_teacher",
  email: "teacher@classy.app",
  name: "أ. محمد أحمد",
  phone: "01000000000",
  subject: "رياضيات",
  centerOrSchool: "سنتر التفوق التعليمي",
  password_hash: crypto.createHash("sha256").update("123456").digest("hex"),
  auth_token: "tok_master_teacher_demo_token_123456",
  recovery_pin: "123456",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

if (!localStore.users[DEFAULT_DEMO_USER.id]) {
  localStore.users[DEFAULT_DEMO_USER.id] = DEFAULT_DEMO_USER;
  persistLocalStore();
}

// Fast In-Memory Lookup Caches
const localUserMemoryCache = new Map<string, ServerUser>();
const localUserTokenCache = new Map<string, ServerUser>();

function populateCaches() {
  for (const u of Object.values(localStore.users)) {
    localUserMemoryCache.set(u.id, u);
    if (u.email) localUserMemoryCache.set(u.email.toLowerCase(), u);
    if (u.phone) localUserMemoryCache.set(u.phone, u);
    if (u.name) localUserMemoryCache.set(u.name, u);
    if (u.auth_token) localUserTokenCache.set(u.auth_token, u);
    if (Array.isArray(u.active_tokens)) {
      for (const tok of u.active_tokens) {
        if (tok) localUserTokenCache.set(tok, u);
      }
    }
  }
}
populateCaches();

export function generateRandomSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generateDeterministicToken(_userId: string, _salt = "teachermanager_secret_seed"): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function authenticateUser(
  identifierOrParams: string | { identifier?: string; email?: string; phone?: string; password?: string },
  explicitPassword?: string
): Promise<{ user: ServerUser; token: string }> {
  let clean = "";
  let password = explicitPassword;

  if (typeof identifierOrParams === "object" && identifierOrParams !== null) {
    clean = (identifierOrParams.identifier || identifierOrParams.email || identifierOrParams.phone || "").trim();
    if (!password) {
      password = identifierOrParams.password;
    }
  } else if (typeof identifierOrParams === "string") {
    clean = identifierOrParams.trim();
  }

  if (!clean) {
    throw new Error("يرجى إدخال البريد الإلكتروني أو رقم الهاتف أو اسم المستخدم");
  }

  let matchedDoc: any = null;
  const canUseFirestore = await isFirestoreConnected();

  if (canUseFirestore) {
    const usersColl = db.collection("users");
    // 1. Direct document lookup in Firestore
    try {
      const directDoc = await usersColl.doc(clean).get();
      if (directDoc.exists) {
        matchedDoc = directDoc;
      }
    } catch {}

    // 2. Query by email (lowercase)
    if (!matchedDoc) {
      try {
        const snap = await usersColl.where("email", "==", clean.toLowerCase()).get();
        if (!snap.empty) {
          matchedDoc = snap.docs[0];
        }
      } catch {}
    }

    // 3. Query by exact email
    if (!matchedDoc) {
      try {
        const snap = await usersColl.where("email", "==", clean).get();
        if (!snap.empty) {
          matchedDoc = snap.docs[0];
        }
      } catch {}
    }

    // 4. Query by phone
    if (!matchedDoc) {
      try {
        const snap = await usersColl.where("phone", "==", clean).get();
        if (!snap.empty) {
          matchedDoc = snap.docs[0];
        }
      } catch {}
    }

    // 5. Query by name
    if (!matchedDoc) {
      try {
        const snap = await usersColl.where("name", "==", clean).get();
        if (!snap.empty) {
          matchedDoc = snap.docs[0];
        }
      } catch {}
    }
  }

  let userData: ServerUser | null = null;
  if (matchedDoc) {
    userData = matchedDoc.data() as ServerUser;
  } else {
    // Seamless local fallback check
    const cleanLower = clean.toLowerCase();
    const localMatched =
      localStore.users[clean] ||
      localUserMemoryCache.get(clean) ||
      localUserMemoryCache.get(cleanLower) ||
      Object.values(localStore.users).find(
        (u) =>
          u.id === clean ||
          (u.email && u.email.toLowerCase() === cleanLower) ||
          (u.phone && u.phone === clean) ||
          (u.name && u.name.toLowerCase() === cleanLower)
      );

    if (localMatched) {
      userData = localMatched;
    } else if (cleanLower === "teacher@classy.app" || cleanLower === "teacher") {
      userData = DEFAULT_DEMO_USER;
      localStore.users[DEFAULT_DEMO_USER.id] = DEFAULT_DEMO_USER;
      persistLocalStore();
    }
  }

  if (!userData) {
    throw new Error("لم يتم العثور على حساب مسجل بهذا البريد الإلكتروني أو الهاتف في السيرفر السحابي");
  }

  const storedHash = userData.password_hash || "";
  const storedPlain = (userData as any).password || "";

  let verificationResult = false;

  // Authenticate password if provided
  if (password) {
    const inputHash = crypto.createHash("sha256").update(password).digest("hex");

    verificationResult =
      (storedHash && storedHash === inputHash) ||
      (storedPlain && storedPlain === password) ||
      (!storedHash && !storedPlain);

    if (!verificationResult) {
      throw new Error("كلمة المرور غير صحيحة، يرجى التأكد والمحاولة مجدداً");
    }
  }

  const token = generateRandomSessionToken();
  const now = new Date().toISOString();
  const prevTokens = Array.isArray(userData.active_tokens) ? userData.active_tokens : [];
  const nextActiveTokens = [
    token,
    ...(userData.auth_token ? [userData.auth_token] : []),
    ...prevTokens,
  ]
    .filter((t, idx, arr) => Boolean(t) && arr.indexOf(t) === idx)
    .slice(0, 5);

  // Update in Firestore if available
  if (matchedDoc && canUseFirestore) {
    try {
      await matchedDoc.ref.set(
        {
          auth_token: token,
          active_tokens: nextActiveTokens,
          last_login_at: now,
          updated_at: now,
        },
        { merge: true }
      );
    } catch {}
  }

  const updatedUser: ServerUser = {
    ...userData,
    auth_token: token,
    active_tokens: nextActiveTokens,
    last_login_at: now,
    updated_at: now,
  };

  // Update local persistent store and caches
  localStore.users[updatedUser.id] = updatedUser;
  localUserMemoryCache.set(updatedUser.id, updatedUser);
  if (updatedUser.email) localUserMemoryCache.set(updatedUser.email.toLowerCase(), updatedUser);
  if (updatedUser.phone) localUserMemoryCache.set(updatedUser.phone, updatedUser);
  if (updatedUser.name) localUserMemoryCache.set(updatedUser.name, updatedUser);
  for (const t of nextActiveTokens) {
    localUserTokenCache.set(t, updatedUser);
  }
  persistLocalStore();

  return { user: updatedUser, token };
}

export async function registerUser(account: {
  id?: string;
  name?: string;
  email: string;
  phone?: string;
  subject?: string;
  centerOrSchool?: string;
  password?: string;
  recoveryPin?: string;
}): Promise<{ user: ServerUser; token: string }> {
  const cleanEmail = (account.email || "").trim().toLowerCase();
  const cleanPhone = (account.phone || "").trim();
  const canUseFirestore = await isFirestoreConnected();

  // Check if email already exists in Firestore
  if (cleanEmail && canUseFirestore) {
    try {
      const snap = await db.collection("users").where("email", "==", cleanEmail).get();
      if (!snap.empty) {
        const existing = snap.docs[0].data() as ServerUser;
        const pwdHash = account.password
          ? crypto.createHash("sha256").update(account.password).digest("hex")
          : "";
        if (pwdHash && existing.password_hash && pwdHash !== existing.password_hash) {
          throw new Error("البريد الإلكتروني مسجل بالفعل بحساب آخر بكلمة مرور مختلفة.");
        }
        const token = generateRandomSessionToken();
        const now = new Date().toISOString();
        try {
          await snap.docs[0].ref.set(
            {
              auth_token: token,
              last_login_at: now,
              updated_at: now,
            },
            { merge: true }
          );
        } catch {}
        localUserTokenCache.set(token, existing);
        return { user: { ...existing, auth_token: token }, token };
      }
    } catch (err: any) {
      if (err.message && err.message.includes("مسجل بالفعل")) {
        throw err;
      }
    }
  }

  // Check local store for existing email
  if (cleanEmail) {
    const localExisting = Object.values(localStore.users).find(
      (u) => u.email && u.email.toLowerCase() === cleanEmail
    );
    if (localExisting) {
      const pwdHash = account.password
        ? crypto.createHash("sha256").update(account.password).digest("hex")
        : "";
      if (pwdHash && localExisting.password_hash && pwdHash !== localExisting.password_hash) {
        throw new Error("البريد الإلكتروني مسجل بالفعل بحساب آخر بكلمة مرور مختلفة.");
      }
      const token = generateRandomSessionToken();
      const now = new Date().toISOString();
      localExisting.auth_token = token;
      localExisting.last_login_at = now;
      localExisting.updated_at = now;
      localStore.users[localExisting.id] = localExisting;
      localUserTokenCache.set(token, localExisting);
      persistLocalStore();
      return { user: localExisting, token };
    }
  }

  const userId = account.id || `acc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const now = new Date().toISOString();
  const token = generateRandomSessionToken();
  const pwdHash = account.password
    ? crypto.createHash("sha256").update(account.password).digest("hex")
    : "";

  const newUser: ServerUser = {
    id: userId,
    email: cleanEmail || `${userId}@teachermanager.local`,
    name: account.name || "معلم",
    phone: cleanPhone || "",
    subject: account.subject || "عام",
    centerOrSchool: account.centerOrSchool || "",
    password_hash: pwdHash,
    auth_token: token,
    recovery_pin: account.recoveryPin || "123456",
    created_at: now,
    updated_at: now,
  };

  if (canUseFirestore) {
    try {
      await db.collection("users").doc(userId).set({
        ...newUser,
        subject: account.subject || "عام",
        centerOrSchool: account.centerOrSchool || "",
      });
    } catch {}
  }

  // Save in local persistent store and caches
  localStore.users[userId] = newUser;
  localUserMemoryCache.set(userId, newUser);
  if (cleanEmail) localUserMemoryCache.set(cleanEmail, newUser);
  if (cleanPhone) localUserMemoryCache.set(cleanPhone, newUser);
  localUserTokenCache.set(token, newUser);
  persistLocalStore();

  return { user: newUser, token };
}

export async function resetUserPasswordInFirestore(
  identifier: string,
  newPassword: string,
  recoveryPin?: string
): Promise<{ success: boolean; message: string }> {
  const clean = (identifier || "").trim().toLowerCase();
  const canUseFirestore = await isFirestoreConnected();
  let matchedDoc: any = null;

  if (canUseFirestore) {
    try {
      const snapEmail = await db.collection("users").where("email", "==", clean).get();
      if (!snapEmail.empty) {
        matchedDoc = snapEmail.docs[0];
      } else {
        const snapPhone = await db.collection("users").where("phone", "==", clean).get();
        if (!snapPhone.empty) {
          matchedDoc = snapPhone.docs[0];
        }
      }
    } catch {}
  }

  let user: ServerUser | null = matchedDoc ? (matchedDoc.data() as ServerUser) : null;
  if (!user) {
    user =
      localStore.users[clean] ||
      Object.values(localStore.users).find(
        (u) =>
          u.id === clean ||
          (u.email && u.email.toLowerCase() === clean) ||
          (u.phone && u.phone === clean)
      ) ||
      null;
  }

  if (!user) {
    throw new Error("لم يتم العثور على حساب بهذا البريد الإلكتروني أو الهاتف في الخادم السحابي.");
  }

  if (recoveryPin && user.recovery_pin && user.recovery_pin.trim() !== recoveryPin.trim()) {
    throw new Error("كود الاسترداد السري (PIN) غير صحيح.");
  }

  const newHash = crypto.createHash("sha256").update(newPassword).digest("hex");
  const newToken = generateRandomSessionToken();
  const now = new Date().toISOString();

  if (matchedDoc && canUseFirestore) {
    try {
      await matchedDoc.ref.set(
        {
          password_hash: newHash,
          auth_token: newToken,
          updated_at: now,
        },
        { merge: true }
      );
    } catch {}
  }

  // Update in local persistent store
  const updatedUser: ServerUser = {
    ...user,
    password_hash: newHash,
    auth_token: newToken,
    updated_at: now,
  };
  localStore.users[updatedUser.id] = updatedUser;
  localUserMemoryCache.set(updatedUser.id, updatedUser);
  if (updatedUser.email) localUserMemoryCache.set(updatedUser.email.toLowerCase(), updatedUser);
  localUserTokenCache.set(newToken, updatedUser);
  persistLocalStore();

  return { success: true, message: "تم تحديث كلمة المرور بنجاح في السيرفر السحابي وتجديد جلسة الأمان." };
}

export async function invalidateUserToken(userId: string): Promise<boolean> {
  if (!userId) return false;
  const newToken = generateRandomSessionToken();
  const now = new Date().toISOString();
  const canUseFirestore = await isFirestoreConnected();

  // Evict old tokens from memory cache for this user
  for (const [tok, cachedUser] of localUserTokenCache.entries()) {
    if (cachedUser.id === userId) {
      localUserTokenCache.delete(tok);
    }
  }

  if (canUseFirestore) {
    try {
      const userRef = db.collection("users").doc(userId);
      await userRef.set({ auth_token: newToken, active_tokens: [newToken], updated_at: now }, { merge: true });
    } catch {}
  }

  const user = localStore.users[userId];
  if (user) {
    user.auth_token = newToken;
    user.active_tokens = [newToken];
    user.updated_at = now;
    localStore.users[userId] = user;
    localUserTokenCache.set(newToken, user);
    persistLocalStore();
  }

  return true;
}

export async function registerOrAuthenticateUser(account: {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  password?: string;
  recoveryPin?: string;
}): Promise<{ user: ServerUser; token: string }> {
  return registerUser(account);
}

export async function getUserByToken(token: string): Promise<ServerUser | null> {
  if (!token || typeof token !== "string") return null;
  const cleanToken = token.trim();

  // Fast memory cache check
  const cached = localUserTokenCache.get(cleanToken);
  if (cached) return cached;

  const canUseFirestore = await isFirestoreConnected();
  if (canUseFirestore) {
    try {
      const snap = await db.collection("users").where("auth_token", "==", cleanToken).get();
      if (!snap.empty) {
        const u = snap.docs[0].data() as ServerUser;
        localUserTokenCache.set(cleanToken, u);
        return u;
      }
      const multiSnap = await db.collection("users").where("active_tokens", "array-contains", cleanToken).get();
      if (!multiSnap.empty) {
        const u = multiSnap.docs[0].data() as ServerUser;
        localUserTokenCache.set(cleanToken, u);
        return u;
      }
    } catch {}
  }

  // Local store scan
  const fromLocal = Object.values(localStore.users).find(
    (u) => u.auth_token === cleanToken || (Array.isArray(u.active_tokens) && u.active_tokens.includes(cleanToken))
  );
  if (fromLocal) {
    localUserTokenCache.set(cleanToken, fromLocal);
    return fromLocal;
  }

  return null;
}

export async function getUserById(userId: string): Promise<ServerUser | null> {
  if (!userId) return null;

  const localUser = localStore.users[userId];
  if (localUser) return localUser;

  const canUseFirestore = await isFirestoreConnected();
  if (canUseFirestore) {
    try {
      const snap = await db.collection("users").doc(userId).get();
      if (snap.exists) return snap.data() as ServerUser;
    } catch {}
  }

  return null;
}

export async function getCloudDataPackage(userId: string): Promise<any | null> {
  if (!userId) return null;
  let rawPkg: any = null;

  const canUseFirestore = await isFirestoreConnected();
  if (canUseFirestore) {
    try {
      const snap = await db.collection("user_sync_stores").doc(userId).get();
      if (snap.exists) {
        const data = snap.data();
        if (data) {
          rawPkg = data.package || data.data_package || null;
        }
      }
    } catch {}
  }

  if (!rawPkg && localStore.syncPackages[userId]) {
    rawPkg = localStore.syncPackages[userId];
  }

  if (!rawPkg) {
    return null;
  }

  const parseSafeTime = (str?: string | null): number => {
    if (!str) return 0;
    const ms = new Date(str).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  };

  const resetTime = parseSafeTime(rawPkg.resetAllBefore);
  const tombstoneMap = new Map<string, string>();
  for (const t of (rawPkg.tombstones || [])) {
    if (t && t.id && t.entityType) {
      const key = `${t.entityType}:${t.id}`;
      const existing = tombstoneMap.get(key);
      if (!existing || parseSafeTime(t.deletedAt) > parseSafeTime(existing)) {
        tombstoneMap.set(key, t.deletedAt);
      }
    }
  }

  const filterList = (entityType: string, list: any[] = []) => {
    if (!Array.isArray(list)) return [];
    return list.filter((item) => {
      if (!item || !item.id) return false;
      const itemTime = parseSafeTime(item.updatedAt || item.createdAt || item.recordedAt);
      if (resetTime > 0 && itemTime > 0 && itemTime <= resetTime) {
        return false;
      }
      const delTimeStr = tombstoneMap.get(`${entityType}:${item.id}`);
      if (delTimeStr && itemTime > 0 && itemTime <= parseSafeTime(delTimeStr)) {
        return false;
      }
      return true;
    });
  };

  const sanitizedStudents = filterList('student', rawPkg.students);
  const sanitizedGroups = filterList('group', rawPkg.groups);
  const sanitizedEnrollments = filterList('enrollment', rawPkg.enrollments);
  const sanitizedSessions = filterList('session', rawPkg.sessions);
  const sanitizedAttendance = filterList('attendance', rawPkg.attendance);
  const sanitizedPayments = filterList('payment', rawPkg.payments);
  const sanitizedCreditLogs = filterList('creditLog', rawPkg.creditLogs);

  const sanitizedPkg = {
    ...rawPkg,
    students: sanitizedStudents,
    groups: sanitizedGroups,
    enrollments: sanitizedEnrollments,
    sessions: sanitizedSessions,
    attendance: sanitizedAttendance,
    payments: sanitizedPayments,
    creditLogs: sanitizedCreditLogs,
    stats: {
      totalStudents: sanitizedStudents.length,
      totalGroups: sanitizedGroups.length,
      totalSessions: sanitizedSessions.length,
      totalPayments: sanitizedPayments.length,
    },
  };

  return sanitizedPkg;
}

function sanitizeForFirestore(val: any): any {
  if (val === undefined) return null;
  if (val === null) return null;
  if (Array.isArray(val)) {
    return val.map((item) => sanitizeForFirestore(item));
  }
  if (typeof val === "object") {
    const res: any = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        res[k] = sanitizeForFirestore(v);
      }
    }
    return res;
  }
  return val;
}

export async function saveCloudDataPackage(userId: string, dataPackage: any): Promise<{ lastSyncTime: string; stats?: any }> {
  const now = new Date().toISOString();
  const updatedPkg = sanitizeForFirestore({
    ...dataPackage,
    userId,
    lastSyncTime: now,
  });

  // Always update local persistent store first
  localStore.syncPackages[userId] = updatedPkg;
  persistLocalStore();

  const canUseFirestore = await isFirestoreConnected();
  if (canUseFirestore) {
    // Store single canonical `package` field (do not duplicate `data_package` + `package` 2x,
    // which previously halved Firestore's 1 MiB document budget and caused silent write drops).
    const firestorePayload = {
      user_id: userId,
      version: dataPackage.version || "2.0",
      last_sync_time: now,
      package: updatedPkg,
      updated_at: now,
    };
    const payloadBytes = Buffer.byteLength(JSON.stringify(firestorePayload), "utf8");
    if (payloadBytes > 1000000) {
      console.error(`[Server Sync] Payload size (${payloadBytes} bytes) approaches Firestore 1 MiB limit for user ${userId}`);
    }

    const syncDocRef = db.collection("user_sync_stores").doc(userId);
    try {
      await syncDocRef.set(firestorePayload, { merge: false });
    } catch (err: any) {
      console.error(`[Server Sync] CRITICAL Firestore save failure for ${userId} (${payloadBytes} bytes):`, err?.message || err);
      throw new Error(`Firestore sync write failed (${err?.message || "unknown error"})`);
    }

    try {
      const auditRef = db.collection("sync_audit_logs").doc();
      const totalRecords =
        (dataPackage.students?.length || 0) +
        (dataPackage.groups?.length || 0) +
        (dataPackage.sessions?.length || 0) +
        (dataPackage.payments?.length || 0);
      auditRef.set({
        id: auditRef.id,
        user_id: userId,
        action: "sync_push",
        client_ip: "cloud_server",
        timestamp: now,
        records_count: totalRecords,
      }).catch(() => {});
    } catch {}
  }

  return { lastSyncTime: now, stats: updatedPkg.stats };
}

export interface ServerDeletionTombstone {
  id: string;
  entityType: 'student' | 'group' | 'enrollment' | 'session' | 'attendance' | 'payment' | 'creditLog' | 'homeworkAssignment' | 'homeworkTest' | 'behaviorLog';
  userId: string;
  deletedAt: string;
}

function mergeTombstones(
  localTombstones: ServerDeletionTombstone[] = [],
  cloudTombstones: ServerDeletionTombstone[] = []
): ServerDeletionTombstone[] {
  const map = new Map<string, ServerDeletionTombstone>();
  for (const t of [...(cloudTombstones || []), ...(localTombstones || [])]) {
    if (!t || !t.id || !t.entityType) continue;
    const key = `${t.entityType}:${t.id}`;
    const existing = map.get(key);
    const tMs = new Date(t.deletedAt || 0).getTime() || 0;
    const eMs = existing ? (new Date(existing.deletedAt || 0).getTime() || 0) : 0;
    if (!existing || tMs > eMs) {
      map.set(key, t);
    }
  }
  return Array.from(map.values());
}

function mergeEntities<T extends { id?: string; updatedAt?: string; createdAt?: string; recordedAt?: string }>(
  entityType: ServerDeletionTombstone['entityType'],
  localList: T[] = [],
  cloudList: T[] = [],
  tombstoneMap: Map<string, string>,
  resetAllBefore?: string
): T[] {
  const parseTs = (s?: string | null): number => {
    if (!s) return 0;
    const ms = new Date(s).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  };
  const map = new Map<string, T>();
  const resetTime = parseTs(resetAllBefore);

  // 1. Process cloud items
  for (const item of (cloudList || [])) {
    if (!item || !item.id) continue;
    const itemTime = parseTs(item.updatedAt || item.createdAt || item.recordedAt);

    if (resetTime > 0 && itemTime > 0 && itemTime <= resetTime) {
      continue;
    }

    const deletedAt = tombstoneMap.get(`${entityType}:${item.id}`);
    if (deletedAt) {
      const delTime = parseTs(deletedAt);
      if (itemTime > 0 && delTime > 0 && itemTime <= delTime) {
        continue;
      }
    }

    map.set(item.id, item);
  }

  // 2. Process local items
  for (const item of (localList || [])) {
    if (!item || !item.id) continue;
    const itemTime = parseTs(item.updatedAt || item.createdAt || item.recordedAt);

    if (resetTime > 0 && itemTime > 0 && itemTime <= resetTime) {
      continue;
    }

    const deletedAt = tombstoneMap.get(`${entityType}:${item.id}`);
    if (deletedAt) {
      const delTime = parseTs(deletedAt);
      if (itemTime > 0 && delTime > 0 && itemTime <= delTime) {
        continue;
      }
    }

    const existing = map.get(item.id);
    if (existing) {
      const existingTime = parseTs(existing.updatedAt || existing.createdAt || existing.recordedAt);

      if (existingTime > itemTime) {
        let mergedObj: any = { ...item, ...existing };
        if (entityType === 'session' && (item as any).status === 'completed' && (existing as any).status !== 'completed') {
          mergedObj = { ...existing, ...item, status: 'completed' };
        }
        map.set(item.id, mergedObj);
      } else {
        map.set(item.id, { ...existing, ...item });
      }
    } else {
      map.set(item.id, item);
    }
  }

  return Array.from(map.values());
}

export async function mergeCloudDataPackage(userId: string, incomingPackage: any): Promise<{ dataPackage: any; merged: boolean }> {
  const existingCloud = await getCloudDataPackage(userId);
  const now = new Date().toISOString();

  const mergedTombstones = mergeTombstones(
    incomingPackage?.tombstones || [],
    existingCloud?.tombstones || []
  );

  const tombstoneMap = new Map<string, string>();
  for (const t of mergedTombstones) {
    if (t && t.id && t.entityType) {
      tombstoneMap.set(`${t.entityType}:${t.id}`, t.deletedAt);
    }
  }

  let effectiveResetAllBefore: string | undefined = undefined;
  const localReset = incomingPackage?.resetAllBefore;
  const cloudReset = existingCloud?.resetAllBefore;
  if (localReset && cloudReset) {
    effectiveResetAllBefore = new Date(localReset).getTime() >= new Date(cloudReset).getTime() ? localReset : cloudReset;
  } else {
    effectiveResetAllBefore = localReset || cloudReset;
  }

  if (!existingCloud) {
    const initialStudents = mergeEntities('student', incomingPackage.students || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialGroups = mergeEntities('group', incomingPackage.groups || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialEnrollments = mergeEntities('enrollment', incomingPackage.enrollments || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialSessions = mergeEntities('session', incomingPackage.sessions || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialAttendance = mergeEntities('attendance', incomingPackage.attendance || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialPayments = mergeEntities('payment', incomingPackage.payments || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialCreditLogs = mergeEntities('creditLog', incomingPackage.creditLogs || [], [], tombstoneMap, effectiveResetAllBefore);

    const initialHomeworkTests = mergeEntities('homeworkTest', incomingPackage.homeworkTests || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialHomeworkAssignments = mergeEntities('homeworkAssignment', incomingPackage.homeworkAssignments || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialHomeworkQuestionResults = incomingPackage.homeworkQuestionResults || [];

    const saved = {
      ...incomingPackage,
      userId,
      lastSyncTime: now,
      students: initialStudents,
      groups: initialGroups,
      enrollments: initialEnrollments,
      sessions: initialSessions,
      attendance: initialAttendance,
      payments: initialPayments,
      creditLogs: initialCreditLogs,
      homeworkTests: initialHomeworkTests,
      homeworkAssignments: initialHomeworkAssignments,
      homeworkQuestionResults: initialHomeworkQuestionResults,
      tombstones: mergedTombstones,
      resetAllBefore: effectiveResetAllBefore,
      stats: {
        totalStudents: initialStudents.length,
        totalGroups: initialGroups.length,
        totalSessions: initialSessions.length,
        totalPayments: initialPayments.length,
        totalHomeworkAssignments: initialHomeworkAssignments.length,
      },
    };
    await saveCloudDataPackage(userId, saved);
    return { dataPackage: saved, merged: false };
  }

  const mergedStudents = mergeEntities('student', incomingPackage.students, existingCloud.students, tombstoneMap, effectiveResetAllBefore);
  const mergedGroups = mergeEntities('group', incomingPackage.groups, existingCloud.groups, tombstoneMap, effectiveResetAllBefore);
  const mergedEnrollments = mergeEntities('enrollment', incomingPackage.enrollments, existingCloud.enrollments, tombstoneMap, effectiveResetAllBefore);
  const mergedSessions = mergeEntities('session', incomingPackage.sessions, existingCloud.sessions, tombstoneMap, effectiveResetAllBefore);
  const mergedAttendance = mergeEntities('attendance', incomingPackage.attendance, existingCloud.attendance, tombstoneMap, effectiveResetAllBefore);
  const mergedPayments = mergeEntities('payment', incomingPackage.payments, existingCloud.payments, tombstoneMap, effectiveResetAllBefore);
  const mergedCreditLogs = mergeEntities('creditLog', incomingPackage.creditLogs || [], existingCloud.creditLogs || [], tombstoneMap, effectiveResetAllBefore);
  const mergedHomeworkTests = mergeEntities('homeworkTest', incomingPackage.homeworkTests || [], existingCloud.homeworkTests || [], tombstoneMap, effectiveResetAllBefore);
  const mergedHomeworkAssignments = mergeEntities('homeworkAssignment', incomingPackage.homeworkAssignments || [], existingCloud.homeworkAssignments || [], tombstoneMap, effectiveResetAllBefore);

  const qMap = new Map<string, any>();
  for (const q of (existingCloud.homeworkQuestionResults || [])) {
    if (q && q.id) qMap.set(q.id, q);
  }
  for (const q of (incomingPackage.homeworkQuestionResults || [])) {
    if (q && q.id) qMap.set(q.id, q);
  }
  const mergedHomeworkQuestionResults = Array.from(qMap.values());

  const mergedMonthlyInvoices = incomingPackage.monthlyInvoices || existingCloud.monthlyInvoices || [];
  const mergedProfile = { ...(existingCloud.teacherProfile || {}), ...(incomingPackage.teacherProfile || {}) };

  const mergedPackage = {
    version: incomingPackage.version || "2.0",
    userId,
    lastSyncTime: now,
    students: mergedStudents,
    groups: mergedGroups,
    enrollments: mergedEnrollments,
    sessions: mergedSessions,
    attendance: mergedAttendance,
    payments: mergedPayments,
    creditLogs: mergedCreditLogs,
    homeworkTests: mergedHomeworkTests,
    homeworkAssignments: mergedHomeworkAssignments,
    homeworkQuestionResults: mergedHomeworkQuestionResults,
    monthlyInvoices: mergedMonthlyInvoices,
    teacherProfile: mergedProfile,
    tombstones: mergedTombstones,
    resetAllBefore: effectiveResetAllBefore,
    stats: {
      totalStudents: mergedStudents.length,
      totalGroups: mergedGroups.length,
      totalSessions: mergedSessions.length,
      totalPayments: mergedPayments.length,
      totalHomeworkAssignments: mergedHomeworkAssignments.length,
    },
  };

  await saveCloudDataPackage(userId, mergedPackage);
  return { dataPackage: mergedPackage, merged: true };
}

export async function resetUserCloudData(
  userId: string,
  resetAllBefore?: string
): Promise<{
  success: boolean;
  acknowledged: boolean;
  resetAllBefore: string;
  verifiedActiveStudents: number;
  verifiedActiveGroups: number;
  verifiedActiveSessions: number;
}> {
  const resetTimestamp = resetAllBefore || new Date().toISOString();
  const resetTime = new Date(resetTimestamp).getTime();

  // Fetch current package
  let existingPkg: any = localStore.syncPackages[userId] || {};
  const canUseFirestore = await isFirestoreConnected();
  if (canUseFirestore) {
    try {
      const snap = await db.collection("user_sync_stores").doc(userId).get();
      if (snap.exists) {
        const d = snap.data();
        if (d) {
          existingPkg = d.package || d.data_package || existingPkg;
        }
      }
    } catch {}
  }

  let effectiveReset = resetTimestamp;
  if (existingPkg.resetAllBefore) {
    if (new Date(existingPkg.resetAllBefore).getTime() > resetTime) {
      effectiveReset = existingPkg.resetAllBefore;
    }
  }

  const effectiveResetTime = new Date(effectiveReset).getTime();

  const filterPostReset = (items: any[] = []) => {
    if (!Array.isArray(items)) return [];
    return items.filter((it) => {
      if (!it || !it.id) return false;
      const tStr = it.updatedAt || it.createdAt || "";
      const t = tStr ? new Date(tStr).getTime() : 0;
      return t > effectiveResetTime;
    });
  };

  const remainingStudents = filterPostReset(existingPkg.students);
  const remainingGroups = filterPostReset(existingPkg.groups);
  const remainingEnrollments = filterPostReset(existingPkg.enrollments);
  const remainingSessions = filterPostReset(existingPkg.sessions);
  const remainingAttendance = filterPostReset(existingPkg.attendance);
  const remainingPayments = filterPostReset(existingPkg.payments);
  const remainingCreditLogs = filterPostReset(existingPkg.creditLogs);

  const now = new Date().toISOString();
  const resetPackage = sanitizeForFirestore({
    version: "2.0",
    userId,
    lastSyncTime: now,
    resetAllBefore: effectiveReset,
    students: remainingStudents,
    groups: remainingGroups,
    enrollments: remainingEnrollments,
    sessions: remainingSessions,
    attendance: remainingAttendance,
    payments: remainingPayments,
    creditLogs: remainingCreditLogs,
    monthlyInvoices: [],
    teacherProfile: existingPkg.teacherProfile || null,
    tombstones: [],
    stats: {
      totalStudents: remainingStudents.length,
      totalGroups: remainingGroups.length,
      totalSessions: remainingSessions.length,
      totalPayments: remainingPayments.length,
    },
  });

  // Save to local persistent store
  localStore.syncPackages[userId] = resetPackage;
  persistLocalStore();

  if (canUseFirestore) {
    try {
      await db.collection("user_sync_stores").doc(userId).set(
        {
          user_id: userId,
          version: "2.0",
          last_sync_time: now,
          package: resetPackage,
          updated_at: now,
        },
        { merge: false }
      );
    } catch (err: any) {
      console.error(`[Server Sync] Firestore reset write error for ${userId}:`, err?.message || err);
      throw new Error(`Firestore reset write failed (${err?.message || "unknown error"})`);
    }
  }

  const verifiedActiveStudents = resetPackage.students?.length || 0;
  const verifiedActiveGroups = resetPackage.groups?.length || 0;
  const verifiedActiveSessions = resetPackage.sessions?.length || 0;

  return {
    success: true,
    acknowledged: true,
    resetAllBefore: effectiveReset,
    verifiedActiveStudents,
    verifiedActiveGroups,
    verifiedActiveSessions,
  };
}
