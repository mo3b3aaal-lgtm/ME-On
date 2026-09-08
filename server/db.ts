import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Load config from firebase-applet-config.json
let firebaseConfig: any = {};
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
} catch (e) {
  console.error("Error loading firebase-applet-config.json:", e);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use the designated database ID if provided, otherwise default
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export interface ServerUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  password_hash?: string;
  auth_token: string;
  recovery_pin?: string;
  created_at: string;
  updated_at: string;
}

export function generateRandomSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generateDeterministicToken(userId: string, salt = "teachermanager_secret_seed"): string {
  // Provided for backward compatibility if ever queried, but session tokens are random
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

  console.log(`[Auth Diagnostic - LOGIN]`, {
    identifierReceived: clean,
    hasPasswordProvided: Boolean(password),
  });

  const usersColl = collection(db, "users");
  let matchedDoc: any = null;
  const queryErrors: string[] = [];

  // 1. Direct document lookup (if identifier is a user ID like acc_...)
  try {
    const directDoc = await getDoc(doc(db, "users", clean));
    if (directDoc.exists()) {
      matchedDoc = directDoc;
    }
  } catch (e: any) {
    queryErrors.push(`directDoc: [${e.code || "ERR"}] ${e.message}`);
    console.warn(`[Auth Diagnostic] directDoc lookup error:`, e.message);
  }

  // 2. Query by email (lowercase)
  if (!matchedDoc) {
    try {
      const qEmail = query(usersColl, where("email", "==", clean.toLowerCase()));
      const snap = await getDocs(qEmail);
      if (!snap.empty) {
        matchedDoc = snap.docs[0];
      }
    } catch (e: any) {
      queryErrors.push(`queryEmailLower: [${e.code || "ERR"}] ${e.message}`);
      console.warn(`[Auth Diagnostic] qEmailLower lookup error:`, e.message);
    }
  }

  // 3. Query by exact email (in case stored without lowercase)
  if (!matchedDoc) {
    try {
      const qEmailRaw = query(usersColl, where("email", "==", clean));
      const snap = await getDocs(qEmailRaw);
      if (!snap.empty) {
        matchedDoc = snap.docs[0];
      }
    } catch (e: any) {
      queryErrors.push(`queryEmailRaw: [${e.code || "ERR"}] ${e.message}`);
      console.warn(`[Auth Diagnostic] qEmailRaw lookup error:`, e.message);
    }
  }

  // 4. Query by phone
  if (!matchedDoc) {
    try {
      const qPhone = query(usersColl, where("phone", "==", clean));
      const snap = await getDocs(qPhone);
      if (!snap.empty) {
        matchedDoc = snap.docs[0];
      }
    } catch (e: any) {
      queryErrors.push(`queryPhone: [${e.code || "ERR"}] ${e.message}`);
      console.warn(`[Auth Diagnostic] qPhone lookup error:`, e.message);
    }
  }

  // 5. Query by name
  if (!matchedDoc) {
    try {
      const qName = query(usersColl, where("name", "==", clean));
      const snap = await getDocs(qName);
      if (!snap.empty) {
        matchedDoc = snap.docs[0];
      }
    } catch (e: any) {
      queryErrors.push(`queryName: [${e.code || "ERR"}] ${e.message}`);
      console.warn(`[Auth Diagnostic] qName lookup error:`, e.message);
    }
  }

  const userFound = Boolean(matchedDoc);
  console.log(`[Auth Diagnostic] Database Search Result:`, {
    userFound,
    matchedUserId: matchedDoc ? matchedDoc.id : null,
    queryErrorsCount: queryErrors.length,
    queryErrors: queryErrors.length > 0 ? queryErrors : undefined,
  });

  if (!matchedDoc) {
    if (queryErrors.length > 0 && queryErrors.some(err => err.includes("permission-denied") || err.includes("insufficient"))) {
      throw new Error(`خطأ في صلاحيات قاعدة البيانات السحابية (Missing or insufficient permissions): ${queryErrors[0]}`);
    }
    throw new Error("لم يتم العثور على حساب مسجل بهذا البريد الإلكتروني أو الهاتف في السيرفر السحابي");
  }

  const userData = matchedDoc.data() as ServerUser;
  const storedHash = userData.password_hash || "";
  const storedPlain = (userData as any).password || "";
  const hasPasswordHash = Boolean(storedHash || storedPlain);

  let verificationResult = false;

  // Authenticate password if provided
  if (password) {
    const inputHash = crypto.createHash("sha256").update(password).digest("hex");

    verificationResult =
      (storedHash && storedHash === inputHash) ||
      (storedPlain && storedPlain === password) ||
      (!storedHash && !storedPlain);

    console.log(`[Auth Diagnostic] Password Verification:`, {
      passwordHashExists: hasPasswordHash,
      verificationResult,
      isHashMatch: Boolean(storedHash && storedHash === inputHash),
      isPlainMatch: Boolean(storedPlain && storedPlain === password),
      isEmptyFallback: Boolean(!storedHash && !storedPlain),
    });

    if (!verificationResult) {
      throw new Error("كلمة المرور غير صحيحة، يرجى التأكد والمحاولة مجدداً");
    }
  } else {
    console.log(`[Auth Diagnostic] Password Verification: No password provided in request`, {
      passwordHashExists: hasPasswordHash,
      verificationResult: false,
    });
  }

  const token = generateRandomSessionToken();
  const now = new Date().toISOString();

  await setDoc(
    matchedDoc.ref,
    {
      auth_token: token,
      last_login_at: now,
      updated_at: now,
    },
    { merge: true }
  );

  const updatedUser: ServerUser = {
    ...userData,
    auth_token: token,
  };

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
  const usersColl = collection(db, "users");

  // Check if email already exists
  if (cleanEmail) {
    const qEmail = query(usersColl, where("email", "==", cleanEmail));
    const snap = await getDocs(qEmail);
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
      await setDoc(
        snap.docs[0].ref,
        {
          auth_token: token,
          last_login_at: now,
          updated_at: now,
        },
        { merge: true }
      );
      return { user: { ...existing, auth_token: token }, token };
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
    password_hash: pwdHash,
    auth_token: token,
    recovery_pin: account.recoveryPin || "123456",
    created_at: now,
    updated_at: now,
  };

  const userRef = doc(db, "users", userId);
  try {
    await setDoc(userRef, {
      ...newUser,
      subject: account.subject || "عام",
      centerOrSchool: account.centerOrSchool || "",
    });

    console.log(`[Auth Diagnostic - REGISTER]`, {
      userCreated: true,
      userDocumentPath: `users/${userId}`,
      userId,
      emailType: cleanEmail ? "provided" : "generated",
      hasPasswordHash: Boolean(pwdHash),
    });
  } catch (err: any) {
    console.error(`[Auth Diagnostic - REGISTER]`, {
      userCreated: false,
      userDocumentPath: `users/${userId}`,
      userId,
      error: err.message,
      errorCode: err.code,
    });
    throw err;
  }

  return { user: newUser, token };
}

export async function resetUserPasswordInFirestore(
  identifier: string,
  newPassword: string,
  recoveryPin?: string
): Promise<{ success: boolean; message: string }> {
  const clean = (identifier || "").trim();
  const usersColl = collection(db, "users");
  let matchedDoc: any = null;

  const qEmail = query(usersColl, where("email", "==", clean.toLowerCase()));
  const snap = await getDocs(qEmail);
  if (!snap.empty) {
    matchedDoc = snap.docs[0];
  } else {
    const qPhone = query(usersColl, where("phone", "==", clean));
    const snapPhone = await getDocs(qPhone);
    if (!snapPhone.empty) {
      matchedDoc = snapPhone.docs[0];
    }
  }

  if (!matchedDoc) {
    throw new Error("لم يتم العثور على حساب بهذا البريد الإلكتروني أو الهاتف في الخادم السحابي.");
  }

  const user = matchedDoc.data() as ServerUser;
  if (recoveryPin && user.recovery_pin && user.recovery_pin.trim() !== recoveryPin.trim()) {
    throw new Error("كود الاسترداد السري (PIN) غير صحيح.");
  }

  const newHash = crypto.createHash("sha256").update(newPassword).digest("hex");
  const newToken = generateRandomSessionToken(); // Invalidate old session tokens
  const now = new Date().toISOString();
  await setDoc(
    matchedDoc.ref,
    {
      password_hash: newHash,
      auth_token: newToken,
      updated_at: now,
    },
    { merge: true }
  );

  return { success: true, message: "تم تحديث كلمة المرور بنجاح في السيرفر السحابي وتجديد جلسة الأمان." };
}

export async function invalidateUserToken(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const userRef = doc(db, "users", userId);
    const newToken = generateRandomSessionToken();
    await setDoc(userRef, { auth_token: newToken, updated_at: new Date().toISOString() }, { merge: true });
    return true;
  } catch (err) {
    console.error("Error invalidating user token in Firestore:", err);
    return false;
  }
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
  try {
    const usersColl = collection(db, "users");
    const q = query(usersColl, where("auth_token", "==", token.trim()));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as ServerUser;
  } catch (err) {
    console.error("Error getting user by token from Firestore:", err);
    return null;
  }
}

export async function getUserById(userId: string): Promise<ServerUser | null> {
  if (!userId) return null;
  try {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return null;
    return snap.data() as ServerUser;
  } catch (err) {
    console.error("Error getting user by id from Firestore:", err);
    return null;
  }
}

export async function getCloudDataPackage(userId: string): Promise<any | null> {
  if (!userId) return null;
  try {
    const syncDocRef = doc(db, "user_sync_stores", userId);
    const snap = await getDoc(syncDocRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    return data.package || data.data_package || null;
  } catch (err) {
    console.error(`Error reading cloud data package from Firestore for ${userId}:`, err);
    return null;
  }
}

export async function saveCloudDataPackage(userId: string, dataPackage: any): Promise<{ lastSyncTime: string; stats?: any }> {
  const now = new Date().toISOString();
  const updatedPkg = {
    ...dataPackage,
    userId,
    lastSyncTime: now,
  };

  const syncDocRef = doc(db, "user_sync_stores", userId);
  await setDoc(
    syncDocRef,
    {
      user_id: userId,
      version: dataPackage.version || "2.0",
      last_sync_time: now,
      data_package: updatedPkg,
      package: updatedPkg,
      updated_at: now,
    },
    { merge: true }
  );

  // Async audit log
  try {
    const auditRef = doc(collection(db, "sync_audit_logs"));
    const totalRecords =
      (dataPackage.students?.length || 0) +
      (dataPackage.groups?.length || 0) +
      (dataPackage.sessions?.length || 0) +
      (dataPackage.payments?.length || 0);
    setDoc(auditRef, {
      id: auditRef.id,
      user_id: userId,
      action: "sync_push",
      client_ip: "cloud_server",
      timestamp: now,
      records_count: totalRecords,
    }).catch(() => {});
  } catch {}

  return { lastSyncTime: now, stats: updatedPkg.stats };
}

export interface ServerDeletionTombstone {
  id: string;
  entityType: 'student' | 'group' | 'enrollment' | 'session' | 'attendance' | 'payment' | 'creditLog';
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
    if (!existing || new Date(t.deletedAt).getTime() > new Date(existing.deletedAt).getTime()) {
      map.set(key, t);
    }
  }
  return Array.from(map.values());
}

function mergeEntities<T extends { id?: string; updatedAt?: string; createdAt?: string }>(
  entityType: ServerDeletionTombstone['entityType'],
  localList: T[] = [],
  cloudList: T[] = [],
  tombstoneMap: Map<string, string>,
  resetAllBefore?: string
): T[] {
  const map = new Map<string, T>();
  const resetTime = resetAllBefore ? new Date(resetAllBefore).getTime() : 0;

  // 1. Process cloud items
  for (const item of (cloudList || [])) {
    if (!item || !item.id) continue;
    const itemTimeStr = item.updatedAt || item.createdAt || "";
    const itemTime = itemTimeStr ? new Date(itemTimeStr).getTime() : 0;

    // Filter out if wiped by a resetAllBefore operation that occurred after item creation/update
    if (resetTime > 0 && itemTime <= resetTime) {
      continue;
    }

    // Filter out if tombstone deleted this entity
    const deletedAt = tombstoneMap.get(`${entityType}:${item.id}`);
    if (deletedAt) {
      const delTime = new Date(deletedAt).getTime();
      if (itemTime <= delTime) {
        // Deleted and not updated afterwards
        continue;
      }
    }

    map.set(item.id, item);
  }

  // 2. Process local items
  for (const item of (localList || [])) {
    if (!item || !item.id) continue;
    const itemTimeStr = item.updatedAt || item.createdAt || "";
    const itemTime = itemTimeStr ? new Date(itemTimeStr).getTime() : 0;

    // Filter out if wiped by resetAllBefore
    if (resetTime > 0 && itemTime <= resetTime) {
      continue;
    }

    // Filter out if tombstone deleted this entity
    const deletedAt = tombstoneMap.get(`${entityType}:${item.id}`);
    if (deletedAt) {
      const delTime = new Date(deletedAt).getTime();
      if (itemTime <= delTime) {
        continue;
      }
    }

    const existing = map.get(item.id);
    if (existing) {
      const existingTimeStr = existing.updatedAt || existing.createdAt || "";
      const existingTime = existingTimeStr ? new Date(existingTimeStr).getTime() : 0;

      if (existingTime > itemTime) {
        map.set(item.id, { ...item, ...existing });
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

  // Merge tombstones from local and cloud
  const mergedTombstones = mergeTombstones(
    incomingPackage?.tombstones || [],
    existingCloud?.tombstones || []
  );

  // Build tombstone map: `${entityType}:${id}` -> deletedAt
  const tombstoneMap = new Map<string, string>();
  for (const t of mergedTombstones) {
    if (t && t.id && t.entityType) {
      tombstoneMap.set(`${t.entityType}:${t.id}`, t.deletedAt);
    }
  }

  // Determine effective resetAllBefore
  let effectiveResetAllBefore: string | undefined = undefined;
  const localReset = incomingPackage?.resetAllBefore;
  const cloudReset = existingCloud?.resetAllBefore;
  if (localReset && cloudReset) {
    effectiveResetAllBefore = new Date(localReset).getTime() >= new Date(cloudReset).getTime() ? localReset : cloudReset;
  } else {
    effectiveResetAllBefore = localReset || cloudReset;
  }

  if (!existingCloud) {
    // Filter initial incoming package through tombstones and resetAllBefore
    const initialStudents = mergeEntities('student', incomingPackage.students || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialGroups = mergeEntities('group', incomingPackage.groups || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialEnrollments = mergeEntities('enrollment', incomingPackage.enrollments || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialSessions = mergeEntities('session', incomingPackage.sessions || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialAttendance = mergeEntities('attendance', incomingPackage.attendance || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialPayments = mergeEntities('payment', incomingPackage.payments || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialCreditLogs = mergeEntities('creditLog', incomingPackage.creditLogs || [], [], tombstoneMap, effectiveResetAllBefore);

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
      tombstones: mergedTombstones,
      resetAllBefore: effectiveResetAllBefore,
      stats: {
        totalStudents: initialStudents.length,
        totalGroups: initialGroups.length,
        totalSessions: initialSessions.length,
        totalPayments: initialPayments.length,
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
    monthlyInvoices: mergedMonthlyInvoices,
    teacherProfile: mergedProfile,
    tombstones: mergedTombstones,
    resetAllBefore: effectiveResetAllBefore,
    stats: {
      totalStudents: mergedStudents.length,
      totalGroups: mergedGroups.length,
      totalSessions: mergedSessions.length,
      totalPayments: mergedPayments.length,
    },
  };

  await saveCloudDataPackage(userId, mergedPackage);
  return { dataPackage: mergedPackage, merged: true };
}
