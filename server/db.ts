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

export async function registerOrAuthenticateUser(account: {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  password?: string;
  recoveryPin?: string;
}): Promise<{ user: ServerUser; token: string }> {
  const now = new Date().toISOString();
  const token = generateDeterministicToken(account.id);
  const pwdHash = account.password ? crypto.createHash("sha256").update(account.password).digest("hex") : "";

  const userRef = doc(db, "users", account.id);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const existing = userSnap.data() as ServerUser;
    const updatedData: Partial<ServerUser> = {
      name: account.name || existing.name,
      phone: account.phone || existing.phone,
      auth_token: token,
      updated_at: now,
    };
    if (pwdHash) {
      updatedData.password_hash = pwdHash;
    }
    await setDoc(userRef, updatedData, { merge: true });
    return {
      user: { ...existing, ...updatedData } as ServerUser,
      token,
    };
  }

  // Also check by email to handle cross-device registration matching
  const usersColl = collection(db, "users");
  const q = query(usersColl, where("email", "==", account.email));
  const querySnap = await getDocs(q);
  if (!querySnap.empty) {
    const docFound = querySnap.docs[0];
    const existing = docFound.data() as ServerUser;
    const updatedData: Partial<ServerUser> = {
      name: account.name || existing.name,
      phone: account.phone || existing.phone,
      auth_token: token,
      updated_at: now,
    };
    if (pwdHash) {
      updatedData.password_hash = pwdHash;
    }
    await setDoc(docFound.ref, updatedData, { merge: true });
    return {
      user: { ...existing, ...updatedData } as ServerUser,
      token,
    };
  }

  const newUser: ServerUser = {
    id: account.id,
    email: account.email,
    name: account.name || "معلم",
    phone: account.phone || "",
    password_hash: pwdHash,
    auth_token: token,
    recovery_pin: account.recoveryPin || "123456",
    created_at: now,
    updated_at: now,
  };

  await setDoc(userRef, newUser);
  return { user: newUser, token };
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
