import { Firestore } from "@google-cloud/firestore";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

let projectId = "corded-elevator-cf6jr";
let databaseId = "ai-studio-teacherskdb-2ab7b23f-628d-4bc7-9c38-f649ca7153f9";

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (config.projectId) projectId = config.projectId;
    if (config.firestoreDatabaseId) databaseId = config.firestoreDatabaseId;
  }
} catch {
  // Use defaults
}

const firestoreOptions: Record<string, any> = { projectId };
if (databaseId && databaseId !== "(default)") {
  firestoreOptions.databaseId = databaseId;
}

let db: Firestore | null = null;
try {
  db = new Firestore(firestoreOptions);
} catch (err) {
  console.error("Failed to initialize Firestore:", err);
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function registerOrAuthenticateUser(email: string, passwordHash?: string) {
  if (!db) throw new Error("Database not connected");
  const usersRef = db.collection("users");
  const q = await usersRef.where("email", "==", email.toLowerCase().trim()).limit(1).get();
  const token = crypto.randomUUID();
  const now = new Date().toISOString();

  if (!q.empty) {
    const doc = q.docs[0];
    await doc.ref.update({ lastLoginAt: now, token });
    return { id: doc.id, email, token, ...doc.data() };
  } else {
    const newUser = {
      email: email.toLowerCase().trim(),
      passwordHash: passwordHash || "",
      token,
      createdAt: now,
      lastLoginAt: now,
    };
    const ref = await usersRef.add(newUser);
    return { id: ref.id, ...newUser };
  }
}

export async function authenticateUser(email: string, passwordHash: string) {
  if (!db) throw new Error("Database not connected");
  const usersRef = db.collection("users");
  const q = await usersRef.where("email", "==", email.toLowerCase().trim()).limit(1).get();
  if (q.empty) return null;
  const doc = q.docs[0];
  const data = doc.data();
  if (data.passwordHash && data.passwordHash !== passwordHash) return null;
  const token = crypto.randomUUID();
  await doc.ref.update({ token, lastLoginAt: new Date().toISOString() });
  return { id: doc.id, token, ...data };
}

export async function registerUser(email: string, passwordHash: string) {
  if (!db) throw new Error("Database not connected");
  const usersRef = db.collection("users");
  const q = await usersRef.where("email", "==", email.toLowerCase().trim()).limit(1).get();
  if (!q.empty) throw new Error("User already exists");
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  const newUser = {
    email: email.toLowerCase().trim(),
    passwordHash,
    token,
    createdAt: now,
    lastLoginAt: now,
  };
  const ref = await usersRef.add(newUser);
  return { id: ref.id, ...newUser };
}

export async function resetUserPasswordInFirestore(email: string, newPasswordHash: string) {
  if (!db) throw new Error("Database not connected");
  const usersRef = db.collection("users");
  const q = await usersRef.where("email", "==", email.toLowerCase().trim()).limit(1).get();
  if (q.empty) return false;
  await q.docs[0].ref.update({ passwordHash: newPasswordHash, lastPasswordReset: new Date().toISOString() });
  return true;
}

export async function getUserByToken(token: string) {
  if (!db) return null;
  const usersRef = db.collection("users");
  const q = await usersRef.where("token", "==", token).limit(1).get();
  if (q.empty) return null;
  const doc = q.docs[0];
  return { id: doc.id, ...doc.data() };
}

export async function getCloudDataPackage(userId: string) {
  if (!db) throw new Error("Database not connected");
  const doc = await db.collection("cloud_data").doc(userId).get();
  if (!doc.exists) return null;
  return doc.data();
}

export async function saveCloudDataPackage(userId: string, data: any) {
  if (!db) throw new Error("Database not connected");
  await db.collection("cloud_data").doc(userId).set({
    ...data,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  return true;
}

export async function mergeCloudDataPackage(userId: string, data: any) {
  if (!db) throw new Error("Database not connected");
  const existing = await getCloudDataPackage(userId);
  const merged = { ...existing, ...data, updatedAt: new Date().toISOString() };
  await db.collection("cloud_data").doc(userId).set(merged, { merge: true });
  return merged;
}

export async function resetUserCloudData(userId: string) {
  if (!db) throw new Error("Database not connected");
  await db.collection("cloud_data").doc(userId).delete();
  return true;
}
