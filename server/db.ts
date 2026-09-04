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

export function generateDeterministicToken(userId: string, salt = "teachermanager_secret_seed"): string {
  return crypto.createHmac("sha256", salt).update(userId).digest("hex");
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

  const usersColl = collection(db, "users");
  let matchedDoc: any = null;

  // 1. Direct document lookup (if identifier is a user ID like acc_...)
  try {
    const directDoc = await getDoc(doc(db, "users", clean));
    if (directDoc.exists()) {
      matchedDoc = directDoc;
    }
  } catch (e) {}

  // 2. Query by email (lowercase)
  if (!matchedDoc) {
    try {
      const qEmail = query(usersColl, where("email", "==", clean.toLowerCase()));
      const snap = await getDocs(qEmail);
      if (!snap.empty) {
        matchedDoc = snap.docs[0];
      }
    } catch (e) {}
  }

  // 3. Query by exact email (in case stored without lowercase)
  if (!matchedDoc) {
    try {
      const qEmailRaw = query(usersColl, where("email", "==", clean));
      const snap = await getDocs(qEmailRaw);
      if (!snap.empty) {
        matchedDoc = snap.docs[0];
      }
    } catch (e) {}
  }

  // 4. Query by phone
  if (!matchedDoc) {
    try {
      const qPhone = query(usersColl, where("phone", "==", clean));
      const snap = await getDocs(qPhone);
      if (!snap.empty) {
        matchedDoc = snap.docs[0];
      }
    } catch (e) {}
  }

  // 5. Query by name
  if (!matchedDoc) {
    try {
      const qName = query(usersColl, where("name", "==", clean));
      const snap = await getDocs(qName);
      if (!snap.empty) {
        matchedDoc = snap.docs[0];
      }
    } catch (e) {}
  }

  if (!matchedDoc) {
    throw new Error("لم يتم العثور على حساب مسجل بهذا البريد الإلكتروني أو الهاتف في السيرفر السحابي");
  }

  const userData = matchedDoc.data() as ServerUser;

  // Authenticate password if provided
  if (password) {
    const inputHash = crypto.createHash("sha256").update(password).digest("hex");
    const storedHash = userData.password_hash || "";
    const storedPlain = (userData as any).password || "";

    const isMatch =
      (storedHash && storedHash === inputHash) ||
      (storedPlain && storedPlain === password) ||
      (!storedHash && !storedPlain);

    if (!isMatch) {
      throw new Error("كلمة المرور غير صحيحة، يرجى التأكد والمحاولة مجدداً");
    }
  }

  const token = generateDeterministicToken(userData.id);
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
      const token = generateDeterministicToken(existing.id);
      return { user: existing, token };
    }
  }

  const userId = account.id || `acc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const now = new Date().toISOString();
  const token = generateDeterministicToken(userId);
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
  await setDoc(userRef, {
    ...newUser,
    subject: account.subject || "عام",
    centerOrSchool: account.centerOrSchool || "",
  });

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
  const now = new Date().toISOString();
  await setDoc(
    matchedDoc.ref,
    {
      password_hash: newHash,
      updated_at: now,
    },
    { merge: true }
  );

  return { success: true, message: "تم تحديث كلمة المرور بنجاح في السيرفر السحابي." };
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

function mergeEntities<T extends { id?: string; updatedAt?: string; createdAt?: string }>(
  localList: T[] = [],
  cloudList: T[] = []
): T[] {
  const map = new Map<string, T>();

  // Add cloud items first
  for (const item of cloudList) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }

  // Merge/add local items without overwriting newer data with older data
  for (const item of localList) {
    if (item && item.id) {
      const existing = map.get(item.id);
      if (existing) {
        const existingTime = existing.updatedAt || existing.createdAt || "";
        const localTime = item.updatedAt || item.createdAt || "";

        if (existingTime && localTime && new Date(existingTime).getTime() > new Date(localTime).getTime()) {
          map.set(item.id, { ...item, ...existing });
        } else {
          map.set(item.id, { ...existing, ...item });
        }
      } else {
        map.set(item.id, item);
      }
    }
  }

  return Array.from(map.values());
}

export async function mergeCloudDataPackage(userId: string, incomingPackage: any): Promise<{ dataPackage: any; merged: boolean }> {
  const existingCloud = await getCloudDataPackage(userId);
  const now = new Date().toISOString();

  if (!existingCloud) {
    const saved = { ...incomingPackage, userId, lastSyncTime: now };
    await saveCloudDataPackage(userId, saved);
    return { dataPackage: saved, merged: false };
  }

  const mergedStudents = mergeEntities(incomingPackage.students, existingCloud.students);
  const mergedGroups = mergeEntities(incomingPackage.groups, existingCloud.groups);
  const mergedEnrollments = mergeEntities(incomingPackage.enrollments, existingCloud.enrollments);
  const mergedSessions = mergeEntities(incomingPackage.sessions, existingCloud.sessions);
  const mergedAttendance = mergeEntities(incomingPackage.attendance, existingCloud.attendance);
  const mergedPayments = mergeEntities(incomingPackage.payments, existingCloud.payments);
  const mergedCreditLogs = mergeEntities(incomingPackage.creditLogs || [], existingCloud.creditLogs || []);
  const mergedMonthlyInvoices = mergeEntities(incomingPackage.monthlyInvoices || [], existingCloud.monthlyInvoices || []);
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
