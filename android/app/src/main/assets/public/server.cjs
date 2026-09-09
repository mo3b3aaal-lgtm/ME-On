var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);

// server/db.ts
var import_app = require("firebase/app");
var import_firestore = require("firebase/firestore");
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_node_crypto = __toESM(require("node:crypto"), 1);
var firebaseConfig = {};
try {
  const configPath = import_node_path.default.join(process.cwd(), "firebase-applet-config.json");
  if (import_node_fs.default.existsSync(configPath)) {
    firebaseConfig = JSON.parse(import_node_fs.default.readFileSync(configPath, "utf-8"));
  }
} catch (e) {
  console.error("Error loading firebase-applet-config.json:", e);
}
var app = (0, import_app.getApps)().length === 0 ? (0, import_app.initializeApp)(firebaseConfig) : (0, import_app.getApp)();
var db = firebaseConfig.firestoreDatabaseId ? (0, import_firestore.getFirestore)(app, firebaseConfig.firestoreDatabaseId) : (0, import_firestore.getFirestore)(app);
function generateRandomSessionToken() {
  return import_node_crypto.default.randomBytes(32).toString("hex");
}
async function authenticateUser(identifierOrParams, explicitPassword) {
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
    throw new Error("\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0623\u0648 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645");
  }
  console.log(`[Auth Diagnostic - LOGIN]`, {
    identifierReceived: clean,
    hasPasswordProvided: Boolean(password)
  });
  const usersColl = (0, import_firestore.collection)(db, "users");
  let matchedDoc = null;
  const queryErrors = [];
  try {
    const directDoc = await (0, import_firestore.getDoc)((0, import_firestore.doc)(db, "users", clean));
    if (directDoc.exists()) {
      matchedDoc = directDoc;
    }
  } catch (e) {
    queryErrors.push(`directDoc: [${e.code || "ERR"}] ${e.message}`);
    console.warn(`[Auth Diagnostic] directDoc lookup error:`, e.message);
  }
  if (!matchedDoc) {
    try {
      const qEmail = (0, import_firestore.query)(usersColl, (0, import_firestore.where)("email", "==", clean.toLowerCase()));
      const snap = await (0, import_firestore.getDocs)(qEmail);
      if (!snap.empty) {
        matchedDoc = snap.docs[0];
      }
    } catch (e) {
      queryErrors.push(`queryEmailLower: [${e.code || "ERR"}] ${e.message}`);
      console.warn(`[Auth Diagnostic] qEmailLower lookup error:`, e.message);
    }
  }
  if (!matchedDoc) {
    try {
      const qEmailRaw = (0, import_firestore.query)(usersColl, (0, import_firestore.where)("email", "==", clean));
      const snap = await (0, import_firestore.getDocs)(qEmailRaw);
      if (!snap.empty) {
        matchedDoc = snap.docs[0];
      }
    } catch (e) {
      queryErrors.push(`queryEmailRaw: [${e.code || "ERR"}] ${e.message}`);
      console.warn(`[Auth Diagnostic] qEmailRaw lookup error:`, e.message);
    }
  }
  if (!matchedDoc) {
    try {
      const qPhone = (0, import_firestore.query)(usersColl, (0, import_firestore.where)("phone", "==", clean));
      const snap = await (0, import_firestore.getDocs)(qPhone);
      if (!snap.empty) {
        matchedDoc = snap.docs[0];
      }
    } catch (e) {
      queryErrors.push(`queryPhone: [${e.code || "ERR"}] ${e.message}`);
      console.warn(`[Auth Diagnostic] qPhone lookup error:`, e.message);
    }
  }
  if (!matchedDoc) {
    try {
      const qName = (0, import_firestore.query)(usersColl, (0, import_firestore.where)("name", "==", clean));
      const snap = await (0, import_firestore.getDocs)(qName);
      if (!snap.empty) {
        matchedDoc = snap.docs[0];
      }
    } catch (e) {
      queryErrors.push(`queryName: [${e.code || "ERR"}] ${e.message}`);
      console.warn(`[Auth Diagnostic] qName lookup error:`, e.message);
    }
  }
  const userFound = Boolean(matchedDoc);
  console.log(`[Auth Diagnostic] Database Search Result:`, {
    userFound,
    matchedUserId: matchedDoc ? matchedDoc.id : null,
    queryErrorsCount: queryErrors.length,
    queryErrors: queryErrors.length > 0 ? queryErrors : void 0
  });
  if (!matchedDoc) {
    if (queryErrors.length > 0 && queryErrors.some((err) => err.includes("permission-denied") || err.includes("insufficient"))) {
      throw new Error(`\u062E\u0637\u0623 \u0641\u064A \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0633\u062D\u0627\u0628\u064A\u0629 (Missing or insufficient permissions): ${queryErrors[0]}`);
    }
    throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u062D\u0633\u0627\u0628 \u0645\u0633\u062C\u0644 \u0628\u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648 \u0627\u0644\u0647\u0627\u062A\u0641 \u0641\u064A \u0627\u0644\u0633\u064A\u0631\u0641\u0631 \u0627\u0644\u0633\u062D\u0627\u0628\u064A");
  }
  const userData = matchedDoc.data();
  const storedHash = userData.password_hash || "";
  const storedPlain = userData.password || "";
  const hasPasswordHash = Boolean(storedHash || storedPlain);
  let verificationResult = false;
  if (password) {
    const inputHash = import_node_crypto.default.createHash("sha256").update(password).digest("hex");
    verificationResult = storedHash && storedHash === inputHash || storedPlain && storedPlain === password || !storedHash && !storedPlain;
    console.log(`[Auth Diagnostic] Password Verification:`, {
      passwordHashExists: hasPasswordHash,
      verificationResult,
      isHashMatch: Boolean(storedHash && storedHash === inputHash),
      isPlainMatch: Boolean(storedPlain && storedPlain === password),
      isEmptyFallback: Boolean(!storedHash && !storedPlain)
    });
    if (!verificationResult) {
      throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0623\u0643\u062F \u0648\u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u0627\u064B");
    }
  } else {
    console.log(`[Auth Diagnostic] Password Verification: No password provided in request`, {
      passwordHashExists: hasPasswordHash,
      verificationResult: false
    });
  }
  const token = generateRandomSessionToken();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await (0, import_firestore.setDoc)(
    matchedDoc.ref,
    {
      auth_token: token,
      last_login_at: now,
      updated_at: now
    },
    { merge: true }
  );
  const updatedUser = {
    ...userData,
    auth_token: token
  };
  return { user: updatedUser, token };
}
async function registerUser(account) {
  const cleanEmail = (account.email || "").trim().toLowerCase();
  const cleanPhone = (account.phone || "").trim();
  const usersColl = (0, import_firestore.collection)(db, "users");
  if (cleanEmail) {
    const qEmail = (0, import_firestore.query)(usersColl, (0, import_firestore.where)("email", "==", cleanEmail));
    const snap = await (0, import_firestore.getDocs)(qEmail);
    if (!snap.empty) {
      const existing = snap.docs[0].data();
      const pwdHash2 = account.password ? import_node_crypto.default.createHash("sha256").update(account.password).digest("hex") : "";
      if (pwdHash2 && existing.password_hash && pwdHash2 !== existing.password_hash) {
        throw new Error("\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0628\u062D\u0633\u0627\u0628 \u0622\u062E\u0631 \u0628\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0645\u062E\u062A\u0644\u0641\u0629.");
      }
      const token2 = generateRandomSessionToken();
      const now2 = (/* @__PURE__ */ new Date()).toISOString();
      await (0, import_firestore.setDoc)(
        snap.docs[0].ref,
        {
          auth_token: token2,
          last_login_at: now2,
          updated_at: now2
        },
        { merge: true }
      );
      return { user: { ...existing, auth_token: token2 }, token: token2 };
    }
  }
  const userId = account.id || `acc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const token = generateRandomSessionToken();
  const pwdHash = account.password ? import_node_crypto.default.createHash("sha256").update(account.password).digest("hex") : "";
  const newUser = {
    id: userId,
    email: cleanEmail || `${userId}@teachermanager.local`,
    name: account.name || "\u0645\u0639\u0644\u0645",
    phone: cleanPhone || "",
    password_hash: pwdHash,
    auth_token: token,
    recovery_pin: account.recoveryPin || "123456",
    created_at: now,
    updated_at: now
  };
  const userRef = (0, import_firestore.doc)(db, "users", userId);
  try {
    await (0, import_firestore.setDoc)(userRef, {
      ...newUser,
      subject: account.subject || "\u0639\u0627\u0645",
      centerOrSchool: account.centerOrSchool || ""
    });
    console.log(`[Auth Diagnostic - REGISTER]`, {
      userCreated: true,
      userDocumentPath: `users/${userId}`,
      userId,
      emailType: cleanEmail ? "provided" : "generated",
      hasPasswordHash: Boolean(pwdHash)
    });
  } catch (err) {
    console.error(`[Auth Diagnostic - REGISTER]`, {
      userCreated: false,
      userDocumentPath: `users/${userId}`,
      userId,
      error: err.message,
      errorCode: err.code
    });
    throw err;
  }
  return { user: newUser, token };
}
async function resetUserPasswordInFirestore(identifier, newPassword, recoveryPin) {
  const clean = (identifier || "").trim();
  const usersColl = (0, import_firestore.collection)(db, "users");
  let matchedDoc = null;
  const qEmail = (0, import_firestore.query)(usersColl, (0, import_firestore.where)("email", "==", clean.toLowerCase()));
  const snap = await (0, import_firestore.getDocs)(qEmail);
  if (!snap.empty) {
    matchedDoc = snap.docs[0];
  } else {
    const qPhone = (0, import_firestore.query)(usersColl, (0, import_firestore.where)("phone", "==", clean));
    const snapPhone = await (0, import_firestore.getDocs)(qPhone);
    if (!snapPhone.empty) {
      matchedDoc = snapPhone.docs[0];
    }
  }
  if (!matchedDoc) {
    throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u062D\u0633\u0627\u0628 \u0628\u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648 \u0627\u0644\u0647\u0627\u062A\u0641 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645 \u0627\u0644\u0633\u062D\u0627\u0628\u064A.");
  }
  const user = matchedDoc.data();
  if (recoveryPin && user.recovery_pin && user.recovery_pin.trim() !== recoveryPin.trim()) {
    throw new Error("\u0643\u0648\u062F \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0627\u0644\u0633\u0631\u064A (PIN) \u063A\u064A\u0631 \u0635\u062D\u064A\u062D.");
  }
  const newHash = import_node_crypto.default.createHash("sha256").update(newPassword).digest("hex");
  const newToken = generateRandomSessionToken();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await (0, import_firestore.setDoc)(
    matchedDoc.ref,
    {
      password_hash: newHash,
      auth_token: newToken,
      updated_at: now
    },
    { merge: true }
  );
  return { success: true, message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0628\u0646\u062C\u0627\u062D \u0641\u064A \u0627\u0644\u0633\u064A\u0631\u0641\u0631 \u0627\u0644\u0633\u062D\u0627\u0628\u064A \u0648\u062A\u062C\u062F\u064A\u062F \u062C\u0644\u0633\u0629 \u0627\u0644\u0623\u0645\u0627\u0646." };
}
async function registerOrAuthenticateUser(account) {
  return registerUser(account);
}
async function getUserByToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const usersColl = (0, import_firestore.collection)(db, "users");
    const q = (0, import_firestore.query)(usersColl, (0, import_firestore.where)("auth_token", "==", token.trim()));
    const snap = await (0, import_firestore.getDocs)(q);
    if (snap.empty) return null;
    return snap.docs[0].data();
  } catch (err) {
    console.error("Error getting user by token from Firestore:", err);
    return null;
  }
}
async function getCloudDataPackage(userId) {
  if (!userId) return null;
  try {
    const syncDocRef = (0, import_firestore.doc)(db, "user_sync_stores", userId);
    const snap = await (0, import_firestore.getDoc)(syncDocRef);
    if (!snap.exists()) {
      console.log(`[Server Cloud Storage] No sync package document found in Firestore for user ${userId}`);
      return null;
    }
    const data = snap.data();
    const rawPkg = data.package || data.data_package || null;
    if (!rawPkg) {
      console.log(`[Server Cloud Storage] Sync store document for user ${userId} contains empty package`);
      return null;
    }
    const resetTime = rawPkg.resetAllBefore ? new Date(rawPkg.resetAllBefore).getTime() : 0;
    const tombstoneMap = /* @__PURE__ */ new Map();
    for (const t of rawPkg.tombstones || []) {
      if (t && t.id && t.entityType) {
        const key = `${t.entityType}:${t.id}`;
        const existing = tombstoneMap.get(key);
        if (!existing || new Date(t.deletedAt).getTime() > new Date(existing).getTime()) {
          tombstoneMap.set(key, t.deletedAt);
        }
      }
    }
    const filterList = (entityType, list = []) => {
      if (!Array.isArray(list)) return [];
      return list.filter((item) => {
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
      });
    };
    const sanitizedStudents = filterList("student", rawPkg.students);
    const sanitizedGroups = filterList("group", rawPkg.groups);
    const sanitizedEnrollments = filterList("enrollment", rawPkg.enrollments);
    const sanitizedSessions = filterList("session", rawPkg.sessions);
    const sanitizedAttendance = filterList("attendance", rawPkg.attendance);
    const sanitizedPayments = filterList("payment", rawPkg.payments);
    const sanitizedCreditLogs = filterList("creditLog", rawPkg.creditLogs);
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
        totalPayments: sanitizedPayments.length
      }
    };
    console.log(`[Server Cloud Storage] getCloudDataPackage sanitized for user ${userId}:`, {
      resetAllBefore: sanitizedPkg.resetAllBefore,
      students: sanitizedStudents.length,
      groups: sanitizedGroups.length,
      sessions: sanitizedSessions.length,
      payments: sanitizedPayments.length,
      tombstones: rawPkg.tombstones?.length || 0
    });
    return sanitizedPkg;
  } catch (err) {
    console.error(`Error reading cloud data package from Firestore for ${userId}:`, err);
    return null;
  }
}
function sanitizeForFirestore(val) {
  if (val === void 0) return null;
  if (val === null) return null;
  if (Array.isArray(val)) {
    return val.map((item) => sanitizeForFirestore(item));
  }
  if (typeof val === "object") {
    const res = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== void 0) {
        res[k] = sanitizeForFirestore(v);
      }
    }
    return res;
  }
  return val;
}
async function saveCloudDataPackage(userId, dataPackage) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updatedPkg = sanitizeForFirestore({
    ...dataPackage,
    userId,
    lastSyncTime: now
  });
  const syncDocRef = (0, import_firestore.doc)(db, "user_sync_stores", userId);
  await (0, import_firestore.setDoc)(
    syncDocRef,
    {
      user_id: userId,
      version: dataPackage.version || "2.0",
      last_sync_time: now,
      data_package: updatedPkg,
      package: updatedPkg,
      updated_at: now
    },
    { merge: true }
  );
  try {
    const auditRef = (0, import_firestore.doc)((0, import_firestore.collection)(db, "sync_audit_logs"));
    const totalRecords = (dataPackage.students?.length || 0) + (dataPackage.groups?.length || 0) + (dataPackage.sessions?.length || 0) + (dataPackage.payments?.length || 0);
    (0, import_firestore.setDoc)(auditRef, {
      id: auditRef.id,
      user_id: userId,
      action: "sync_push",
      client_ip: "cloud_server",
      timestamp: now,
      records_count: totalRecords
    }).catch(() => {
    });
  } catch {
  }
  return { lastSyncTime: now, stats: updatedPkg.stats };
}
function mergeTombstones(localTombstones = [], cloudTombstones = []) {
  const map = /* @__PURE__ */ new Map();
  for (const t of [...cloudTombstones || [], ...localTombstones || []]) {
    if (!t || !t.id || !t.entityType) continue;
    const key = `${t.entityType}:${t.id}`;
    const existing = map.get(key);
    if (!existing || new Date(t.deletedAt).getTime() > new Date(existing.deletedAt).getTime()) {
      map.set(key, t);
    }
  }
  return Array.from(map.values());
}
function mergeEntities(entityType, localList = [], cloudList = [], tombstoneMap, resetAllBefore) {
  const map = /* @__PURE__ */ new Map();
  const resetTime = resetAllBefore ? new Date(resetAllBefore).getTime() : 0;
  for (const item of cloudList || []) {
    if (!item || !item.id) continue;
    const itemTimeStr = item.updatedAt || item.createdAt || "";
    const itemTime = itemTimeStr ? new Date(itemTimeStr).getTime() : 0;
    if (resetTime > 0 && itemTime <= resetTime) {
      continue;
    }
    const deletedAt = tombstoneMap.get(`${entityType}:${item.id}`);
    if (deletedAt) {
      const delTime = new Date(deletedAt).getTime();
      if (itemTime <= delTime) {
        continue;
      }
    }
    map.set(item.id, item);
  }
  for (const item of localList || []) {
    if (!item || !item.id) continue;
    const itemTimeStr = item.updatedAt || item.createdAt || "";
    const itemTime = itemTimeStr ? new Date(itemTimeStr).getTime() : 0;
    if (resetTime > 0 && itemTime <= resetTime) {
      continue;
    }
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
async function mergeCloudDataPackage(userId, incomingPackage) {
  const existingCloud = await getCloudDataPackage(userId);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  console.log(`[Server Cloud Merge] Starting merge for user ${userId}:`, {
    incomingResetAllBefore: incomingPackage?.resetAllBefore,
    existingCloudResetAllBefore: existingCloud?.resetAllBefore,
    incomingStudentsCount: incomingPackage?.students?.length || 0,
    existingCloudStudentsCount: existingCloud?.students?.length || 0,
    incomingTombstonesCount: incomingPackage?.tombstones?.length || 0,
    existingCloudTombstonesCount: existingCloud?.tombstones?.length || 0
  });
  const mergedTombstones = mergeTombstones(
    incomingPackage?.tombstones || [],
    existingCloud?.tombstones || []
  );
  const tombstoneMap = /* @__PURE__ */ new Map();
  for (const t of mergedTombstones) {
    if (t && t.id && t.entityType) {
      tombstoneMap.set(`${t.entityType}:${t.id}`, t.deletedAt);
    }
  }
  let effectiveResetAllBefore = void 0;
  const localReset = incomingPackage?.resetAllBefore;
  const cloudReset = existingCloud?.resetAllBefore;
  if (localReset && cloudReset) {
    effectiveResetAllBefore = new Date(localReset).getTime() >= new Date(cloudReset).getTime() ? localReset : cloudReset;
  } else {
    effectiveResetAllBefore = localReset || cloudReset;
  }
  console.log(`[Server Cloud Merge] Effective resetAllBefore for ${userId}: ${effectiveResetAllBefore}`);
  if (!existingCloud) {
    const initialStudents = mergeEntities("student", incomingPackage.students || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialGroups = mergeEntities("group", incomingPackage.groups || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialEnrollments = mergeEntities("enrollment", incomingPackage.enrollments || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialSessions = mergeEntities("session", incomingPackage.sessions || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialAttendance = mergeEntities("attendance", incomingPackage.attendance || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialPayments = mergeEntities("payment", incomingPackage.payments || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialCreditLogs = mergeEntities("creditLog", incomingPackage.creditLogs || [], [], tombstoneMap, effectiveResetAllBefore);
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
        totalPayments: initialPayments.length
      }
    };
    await saveCloudDataPackage(userId, saved);
    console.log(`[Server Cloud Merge] Created initial package for user ${userId}:`, saved.stats);
    return { dataPackage: saved, merged: false };
  }
  const mergedStudents = mergeEntities("student", incomingPackage.students, existingCloud.students, tombstoneMap, effectiveResetAllBefore);
  const mergedGroups = mergeEntities("group", incomingPackage.groups, existingCloud.groups, tombstoneMap, effectiveResetAllBefore);
  const mergedEnrollments = mergeEntities("enrollment", incomingPackage.enrollments, existingCloud.enrollments, tombstoneMap, effectiveResetAllBefore);
  const mergedSessions = mergeEntities("session", incomingPackage.sessions, existingCloud.sessions, tombstoneMap, effectiveResetAllBefore);
  const mergedAttendance = mergeEntities("attendance", incomingPackage.attendance, existingCloud.attendance, tombstoneMap, effectiveResetAllBefore);
  const mergedPayments = mergeEntities("payment", incomingPackage.payments, existingCloud.payments, tombstoneMap, effectiveResetAllBefore);
  const mergedCreditLogs = mergeEntities("creditLog", incomingPackage.creditLogs || [], existingCloud.creditLogs || [], tombstoneMap, effectiveResetAllBefore);
  const mergedMonthlyInvoices = incomingPackage.monthlyInvoices || existingCloud.monthlyInvoices || [];
  const mergedProfile = { ...existingCloud.teacherProfile || {}, ...incomingPackage.teacherProfile || {} };
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
      totalPayments: mergedPayments.length
    }
  };
  await saveCloudDataPackage(userId, mergedPackage);
  console.log(`[Server Cloud Merge] Successfully saved merged package for ${userId}:`, {
    effectiveResetAllBefore,
    stats: mergedPackage.stats
  });
  return { dataPackage: mergedPackage, merged: true };
}

// server.ts
import_dotenv.default.config();
var app2 = (0, import_express.default)();
var PORT = 3e3;
app2.use(
  (0, import_cors.default)({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "x-auth-token",
      "Cache-Control",
      "Pragma",
      "Expires"
    ]
  })
);
app2.options("*", (0, import_cors.default)());
app2.use(import_express.default.json({ limit: "50mb" }));
var aiClient = null;
function getGenAI() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new import_genai.GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
app2.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    database: "Firebase Firestore (Project: corded-elevator-cf6jr)",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    hasApiKey: Boolean(process.env.GEMINI_API_KEY)
  });
});
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else if (req.headers["x-auth-token"]) {
      token = String(req.headers["x-auth-token"]).trim();
    } else if (req.body && req.body.token) {
      token = String(req.body.token).trim();
    }
    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Missing authentication token."
      });
    }
    const user = await getUserByToken(token);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid or expired authentication session token."
      });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ success: false, error: "Internal authentication error" });
  }
}
app2.post("/api/auth/login", async (req, res) => {
  try {
    const rawBody = req.body || {};
    const bodyKeys = Object.keys(rawBody);
    const identifier = rawBody.identifier || rawBody.email || rawBody.phone || rawBody.id || rawBody.username;
    const hasPassword = Boolean(rawBody.password);
    let idType = "unknown";
    if (rawBody.email || identifier && identifier.includes("@")) {
      idType = "email";
    } else if (rawBody.phone || identifier && /^[0-9+\s()-]+$/.test(identifier)) {
      idType = "phone";
    } else if (rawBody.id || identifier && identifier.startsWith("acc_")) {
      idType = "userId";
    } else if (identifier) {
      idType = "name_or_string";
    }
    console.log(`[Auth Diagnostic] Login Request Received:`, {
      bodyKeys,
      receivedIdentifierType: idType,
      hasIdentifier: Boolean(identifier),
      hasPassword,
      clientIp: req.ip || req.headers["x-forwarded-for"],
      userAgent: req.headers["user-agent"]
    });
    if (!identifier) {
      console.warn(`[Auth Diagnostic] Login failed: Missing identifier in request body.`);
      return res.status(400).json({
        success: false,
        error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641",
        diagnostic: { reason: "MISSING_IDENTIFIER", receivedKeys: bodyKeys }
      });
    }
    const { user, token } = await authenticateUser(identifier, rawBody.password);
    console.log(`[Auth Diagnostic] Login successful! User ID: ${user.id}, Email: ${user.email}`);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone || "",
        subject: user.subject || "\u0639\u0627\u0645",
        centerOrSchool: user.centerOrSchool || "",
        recoveryPin: user.recovery_pin || "123456",
        createdAt: user.created_at,
        lastLoginAt: user.updated_at
      }
    });
  } catch (error) {
    console.warn(`[Auth Diagnostic] Authentication failed:`, {
      message: error.message,
      code: error.code || "AUTH_FAILED",
      stack: error.stack?.split("\n").slice(0, 3).join(" | ")
    });
    res.status(401).json({
      success: false,
      error: error.message || "\u0641\u0634\u0644 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644",
      errorCode: error.code || "AUTHENTICATION_FAILED",
      diagnostic: {
        errorMessage: error.message,
        errorName: error.name,
        errorCode: error.code
      }
    });
  }
});
app2.post("/api/auth/register", async (req, res) => {
  try {
    const rawBody = req.body || {};
    const receivedFields = Object.keys(rawBody);
    const name = (rawBody.name || "").trim();
    const email = (rawBody.email || "").trim().toLowerCase();
    const phone = (rawBody.phone || "").trim();
    const password = rawBody.password;
    const subject = rawBody.subject || "\u0639\u0627\u0645";
    const centerOrSchool = rawBody.centerOrSchool || rawBody.center_or_school || "";
    const recoveryPin = rawBody.recoveryPin || rawBody.recovery_pin || "123456";
    const id = rawBody.id;
    const missingFields = [];
    if (!name) missingFields.push("name (\u0627\u0633\u0645 \u0627\u0644\u0645\u0639\u0644\u0645)");
    if (!email && !phone) missingFields.push("email or phone (\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648 \u0627\u0644\u0647\u0627\u062A\u0641)");
    if (!password) {
      missingFields.push("password (\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631)");
    } else if (String(password).length < 4) {
      missingFields.push("password_too_short (\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0644\u0627 \u062A\u0642\u0644 \u0639\u0646 4 \u0623\u062D\u0631\u0641)");
    }
    console.log(`[Auth Diagnostic - REGISTER Request]`, {
      receivedFields,
      hasName: Boolean(name),
      hasEmail: Boolean(email),
      hasPhone: Boolean(phone),
      hasPassword: Boolean(password),
      missingFields,
      clientIp: req.ip || req.headers["x-forwarded-for"]
    });
    if (missingFields.length > 0) {
      const firstMissing = missingFields[0];
      return res.status(400).json({
        success: false,
        error: `Missing field: ${firstMissing}`,
        errorCode: "VALIDATION_FAILED",
        missingFields,
        receivedFields
      });
    }
    const { user, token } = await registerUser({
      id,
      email,
      name,
      phone,
      subject,
      centerOrSchool,
      password,
      recoveryPin
    });
    console.log(`[Auth API /api/auth/register] Registration successful! User ID: ${user.id}`);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone || "",
        subject: user.subject || "\u0639\u0627\u0645",
        centerOrSchool: user.centerOrSchool || "",
        recoveryPin: user.recovery_pin || "123456",
        createdAt: user.created_at,
        lastLoginAt: user.updated_at
      }
    });
  } catch (error) {
    console.error(`[Auth API /api/auth/register] Registration error:`, error);
    res.status(400).json({
      success: false,
      error: error.message || "\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062D\u0633\u0627\u0628",
      errorCode: error.code || "REGISTRATION_FAILED"
    });
  }
});
app2.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { identifier, newPassword, recoveryPin } = req.body;
    const result = await resetUserPasswordInFirestore(identifier, newPassword, recoveryPin);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || "\u0641\u0634\u0644 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631" });
  }
});
app2.post("/api/auth/sync-session", async (req, res) => {
  try {
    const { id, email, name, phone, password, recoveryPin } = req.body;
    const userId = id || `acc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const userEmail = email || `${userId}@teachermanager.local`;
    const { user, token } = await registerOrAuthenticateUser({
      id: userId,
      email: userEmail,
      name: name || "\u0645\u0639\u0644\u0645",
      phone,
      password,
      recoveryPin
    });
    res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error("Auth sync error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to authenticate session" });
  }
});
app2.post("/api/sync/push", requireAuth, async (req, res) => {
  try {
    const authenticatedUserId = req.user.id;
    const { dataPackage } = req.body;
    if (!dataPackage) {
      return res.status(400).json({ success: false, error: "Missing dataPackage" });
    }
    const result = await saveCloudDataPackage(authenticatedUserId, dataPackage);
    res.json({ success: true, lastSyncTime: result.lastSyncTime, stats: result.stats });
  } catch (error) {
    console.error("Sync push error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to push sync data" });
  }
});
app2.get("/api/sync/pull", requireAuth, async (req, res) => {
  try {
    const authenticatedUserId = req.user.id;
    const cloudData = await getCloudDataPackage(authenticatedUserId);
    if (!cloudData) {
      return res.json({ success: true, hasCloudData: false, dataPackage: null });
    }
    res.json({ success: true, hasCloudData: true, dataPackage: cloudData });
  } catch (error) {
    console.error("Sync pull error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to pull sync data" });
  }
});
app2.get("/api/sync/pull/:userId", requireAuth, async (req, res) => {
  try {
    const authenticatedUserId = req.user.id;
    const cloudData = await getCloudDataPackage(authenticatedUserId);
    if (!cloudData) {
      return res.json({ success: true, hasCloudData: false, dataPackage: null });
    }
    res.json({ success: true, hasCloudData: true, dataPackage: cloudData });
  } catch (error) {
    console.error("Sync pull error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to pull sync data" });
  }
});
app2.post("/api/sync/merge", requireAuth, async (req, res) => {
  try {
    const authenticatedUserId = req.user.id;
    const { dataPackage } = req.body;
    if (!dataPackage) {
      return res.status(400).json({ success: false, error: "Missing dataPackage" });
    }
    const result = await mergeCloudDataPackage(authenticatedUserId, dataPackage);
    res.json({ success: true, dataPackage: result.dataPackage, merged: result.merged });
  } catch (error) {
    console.error("Sync merge error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to merge sync data" });
  }
});
app2.post("/api/ai/lesson-plan", async (req, res) => {
  const { topic, subject, gradeLevel, duration = "45 mins", objectives } = req.body;
  const ai = getGenAI();
  const fallbackPlan = `# \u062E\u0637\u0629 \u062F\u0631\u0633: ${topic || "\u0627\u0644\u0645\u0641\u0627\u0647\u064A\u0645 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629"}
**\u0627\u0644\u0645\u0627\u062F\u0629:** ${subject || "\u0639\u0627\u0645"} | **\u0627\u0644\u0635\u0641:** ${gradeLevel || "\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062F\u0631\u0627\u0633\u064A\u0629"} | **\u0627\u0644\u0645\u062F\u0629:** ${duration}

## \u{1F3AF} \u0627\u0644\u0623\u0647\u062F\u0627\u0641 \u0627\u0644\u062A\u0639\u0644\u064A\u0645\u064A\u0629
- \u0641\u0647\u0645 \u0627\u0644\u0637\u0627\u0644\u0628 \u0644\u0644\u0645\u0641\u0627\u0647\u064A\u0645 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629 \u0644\u0640 ${topic || "\u0645\u0648\u0636\u0648\u0639 \u0627\u0644\u062F\u0631\u0633"}.
- \u062A\u0637\u0628\u064A\u0642 3 \u0623\u0645\u062B\u0644\u0629 \u0639\u0645\u0644\u064A\u0629 \u0648\u062A\u0645\u0627\u0631\u064A\u0646 \u062A\u0641\u0627\u0639\u0644\u064A\u0629.
- \u062A\u0642\u064A\u064A\u0645 \u0627\u0633\u062A\u064A\u0639\u0627\u0628 \u0627\u0644\u0637\u0644\u0627\u0628 \u0648\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0623\u062F\u0627\u0621.

## \u23F1\uFE0F \u0633\u064A\u0631 \u0627\u0644\u062D\u0635\u0629 \u0648\u0627\u0644\u0623\u0646\u0634\u0637\u0629
1. **\u0627\u0644\u062A\u0647\u064A\u0626\u0629 \u0648\u0627\u0644\u062A\u0645\u0647\u064A\u062F (5-8 \u062F\u0642\u0627\u0626\u0642):** \u0645\u0631\u0627\u062C\u0639\u0629 \u0633\u0631\u064A\u0639\u0629 \u0648\u0637\u0631\u062D \u0633\u0624\u0627\u0644 \u062A\u0641\u0627\u0639\u0644\u064A \u0645\u0634\u0648\u0642.
2. **\u0627\u0644\u0634\u0631\u062D \u0648\u0627\u0644\u062A\u062F\u0631\u064A\u0633 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 (15 \u062F\u0642\u064A\u0642\u0629):** \u062A\u0648\u0636\u064A\u062D \u0627\u0644\u0645\u0641\u0627\u0647\u064A\u0645 \u0648\u0627\u0644\u0623\u0641\u0643\u0627\u0631 \u0645\u0639 \u0623\u0645\u062B\u0644\u0629 \u0639\u0644\u0649 \u0627\u0644\u0633\u0628\u0648\u0631\u0629.
3. **\u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0648\u0627\u0644\u0645\u0645\u0627\u0631\u0633\u0629 \u0627\u0644\u0645\u0648\u062C\u0647\u0629 (12 \u062F\u0642\u064A\u0642\u0629):** \u062D\u0644 \u0645\u0633\u0627\u0626\u0644 \u0648\u062A\u0645\u0627\u0631\u064A\u0646 \u062B\u0646\u0627\u0626\u064A\u0629 \u0628\u0645\u0634\u0627\u0631\u0643\u0629 \u0627\u0644\u0637\u0644\u0627\u0628.
4. **\u0627\u0644\u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u062A\u0643\u0648\u064A\u0646\u064A (7 \u062F\u0642\u0627\u0626\u0642):** \u0633\u0624\u0627\u0644 \u0633\u0631\u064A\u0639 \u0644\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0641\u0647\u0645 \u0648\u0627\u0644\u062A\u0637\u0628\u064A\u0642.
5. **\u0627\u0644\u062E\u0627\u062A\u0645\u0629 \u0648\u0627\u0644\u0648\u0627\u062C\u0628 (3 \u062F\u0642\u0627\u0626\u0642):** \u062A\u0644\u062E\u064A\u0635 \u0627\u0644\u0646\u0642\u0627\u0637 \u0627\u0644\u0647\u0627\u0645\u0629 \u0648\u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0648\u0627\u062C\u0628 \u0627\u0644\u0645\u0646\u0632\u0644\u064A.`;
  if (!ai) {
    return res.json({ plan: fallbackPlan });
  }
  try {
    const prompt = `You are a master educator. Create a detailed, highly practical, engaging lesson plan for a teacher in Arabic (or matching the language requested).
Subject: ${subject}
Grade Level: ${gradeLevel}
Topic: ${topic}
Duration: ${duration}
Specific Goals/Notes: ${objectives || "Engaging hands-on activity, clear formative assessment"}

Format your response cleanly in Markdown with bold headers, bullet points, time breakdown, interactive activities, and an exit ticket.`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });
    res.json({ plan: response.text || fallbackPlan });
  } catch (error) {
    console.warn("Lesson plan AI call notice, returning fallback:", error?.message);
    res.json({ plan: fallbackPlan });
  }
});
app2.post("/api/ai/parent-message", async (req, res) => {
  const { studentName, parentName, reason, tone = "professional & warm", details, teacherName = "\u0627\u0644\u0645\u0639\u0644\u0645" } = req.body;
  const ai = getGenAI();
  let fallbackSubject = `\u062A\u0642\u0631\u064A\u0631 \u0645\u062A\u0627\u0628\u0639\u0629 \u0628\u062E\u0635\u0648\u0635 \u0627\u0644\u0637\u0627\u0644\u0628/\u0629 ${studentName || "\u0627\u0644\u0645\u062D\u062A\u0631\u0645/\u0629"}`;
  let fallbackBody = `\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u064A\u0643\u0645 \u0648\u0631\u062D\u0645\u0629 \u0627\u0644\u0644\u0647 \u0648\u0628\u0631\u0643\u0627\u062A\u0647 \u0648\u0644\u064A \u0623\u0645\u0631 \u0627\u0644\u0637\u0627\u0644\u0628/\u0629 ${studentName || "\u0627\u0644\u0645\u062D\u062A\u0631\u0645/\u0629"}\u060C

\u0646\u0648\u062F \u0625\u062D\u0627\u0637\u062A\u0643\u0645 \u0639\u0644\u0645\u0627\u064B \u0628\u0645\u062A\u0627\u0628\u0639\u0629 \u0623\u062F\u0627\u0621 \u0627\u0644\u0637\u0627\u0644\u0628/\u0629 \u0641\u064A \u0627\u0644\u062D\u0635\u0635 \u0627\u0644\u062F\u0631\u0627\u0633\u064A\u0629.
${details ? `\u0645\u0644\u0627\u062D\u0638\u0627\u062A: ${details}
` : ""}
\u0634\u0627\u0643\u0631\u064A\u0646 \u0648\u0645\u0642\u062F\u0631\u064A\u0646 \u062D\u0633\u0646 \u062A\u0639\u0627\u0648\u0646\u0643\u0645 \u0645\u0639\u0646\u0627.
\u0645\u0639 \u0623\u0637\u064A\u0628 \u0627\u0644\u062A\u062D\u064A\u0627\u062A\u060C
${teacherName}`;
  if (reason === "attendance") {
    fallbackSubject = `\u0625\u0634\u0639\u0627\u0631 \u0628\u062E\u0635\u0648\u0635 \u062D\u0636\u0648\u0631 \u0648\u063A\u064A\u0627\u0628 \u0627\u0644\u0637\u0627\u0644\u0628/\u0629 ${studentName}`;
    fallbackBody = `\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u064A\u0643\u0645 \u0648\u0631\u062D\u0645\u0629 \u0627\u0644\u0644\u0647 \u0648\u0628\u0631\u0643\u0627\u062A\u0647\u060C

\u0646\u062D\u064A\u0637\u0643\u0645 \u0639\u0644\u0645\u0627\u064B \u0628\u063A\u064A\u0627\u0628 \u0627\u0644\u0637\u0627\u0644\u0628/\u0629 ${studentName} \u0639\u0646 \u0627\u0644\u062D\u0635\u0629 \u0627\u0644\u0645\u0642\u0631\u0631\u0629 \u0627\u0644\u064A\u0648\u0645. \u0646\u0631\u062C\u0648 \u0627\u0644\u0627\u0637\u0645\u0626\u0646\u0627\u0646 \u0639\u0644\u064A\u0647 \u0648\u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627 \u0644\u062A\u0631\u062A\u064A\u0628 \u062A\u0639\u0648\u064A\u0636 \u0627\u0644\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u062F\u0631\u0627\u0633\u064A.

\u0645\u0639 \u062E\u0627\u0644\u0635 \u0627\u0644\u062A\u0642\u062F\u064A\u0631\u060C
${teacherName}`;
  } else if (reason === "praise") {
    fallbackSubject = `\u0634\u0647\u0627\u062F\u0629 \u0634\u0643\u0631 \u0648\u062A\u0645\u064A\u0632 \u0644\u0644\u0637\u0627\u0644\u0628/\u0629 ${studentName} \u{1F31F}`;
    fallbackBody = `\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u064A\u0643\u0645 \u0648\u0631\u062D\u0645\u0629 \u0627\u0644\u0644\u0647 \u0648\u0628\u0631\u0643\u0627\u062A\u0647\u060C

\u064A\u0633\u0639\u062F\u0646\u0627 \u0625\u0628\u0644\u0627\u063A\u0643\u0645 \u0628\u0627\u0644\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0645\u062A\u0645\u064A\u0632 \u0648\u0627\u0644\u062A\u0641\u0627\u0639\u0644 \u0627\u0644\u0625\u064A\u062C\u0627\u0628\u064A \u0627\u0644\u0631\u0627\u0626\u0639 \u0644\u0644\u0637\u0627\u0644\u0628/\u0629 ${studentName} \u062E\u0644\u0627\u0644 \u0627\u0644\u062D\u0635\u0629\u060C \u0645\u0645\u0627 \u064A\u0639\u0643\u0633 \u062A\u0641\u0648\u0642\u0647 \u0648\u062D\u0631\u0635\u0647 \u0627\u0644\u062F\u0627\u0626\u0645.

\u062F\u0645\u062A\u0645 \u0641\u062E\u0648\u0631\u064A\u0646 \u0628\u0647 \u062F\u0627\u0626\u0645\u0627\u064B\u060C
${teacherName}`;
  }
  if (!ai) {
    return res.json({ subject: fallbackSubject, message: fallbackBody });
  }
  try {
    const prompt = `You are an empathetic, professional teacher communicating with a student's parent/guardian in Arabic.
Teacher Name: ${teacherName}
Student Name: ${studentName}
Parent Name: ${parentName || "\u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631"}
Type/Reason: ${reason}
Tone: ${tone}
Specific Notes: ${details || "None"}

Generate a JSON object with two fields:
"subject": A concise, clear email/SMS subject line in Arabic
"message": The body of the message in Arabic.`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    try {
      const parsed = JSON.parse(response.text || "{}");
      res.json(parsed);
    } catch {
      res.json({
        subject: fallbackSubject,
        message: response.text || fallbackBody
      });
    }
  } catch (error) {
    console.warn("Parent message AI notice, returning fallback:", error?.message);
    res.json({ subject: fallbackSubject, message: fallbackBody });
  }
});
app2.post("/api/ai/quiz-generator", async (req, res) => {
  const { topic, subject, gradeLevel, questionCount = 4, difficulty = "Medium" } = req.body;
  const ai = getGenAI();
  const fallbackQuestions = [
    {
      id: "q1",
      question: `\u0645\u0627 \u0647\u0648 \u0627\u0644\u0645\u0641\u0647\u0648\u0645 \u0627\u0644\u0623\u0633\u0627\u0633\u064A \u0627\u0644\u0645\u0631\u062A\u0628\u0637 \u0628\u0640 (${topic || "\u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0636\u0648\u0639"})\u061F`,
      options: ["\u0645\u0641\u0647\u0648\u0645 \u0631\u0626\u064A\u0633\u064A \u0645\u062D\u0648\u0631\u064A", "\u0639\u0627\u0645\u0644 \u062B\u0627\u0646\u0648\u064A \u063A\u064A\u0631 \u0645\u0628\u0627\u0634\u0631", "\u062D\u0627\u0644\u0629 \u0634\u0627\u0630\u0629 \u0645\u0624\u0642\u062A\u0629", "\u0645\u0639\u0644\u0648\u0645\u0629 \u063A\u064A\u0631 \u0645\u0631\u062A\u0628\u0637\u0629"],
      correctAnswer: "\u0645\u0641\u0647\u0648\u0645 \u0631\u0626\u064A\u0633\u064A \u0645\u062D\u0648\u0631\u064A",
      explanation: "\u0647\u0630\u0627 \u0647\u0648 \u0627\u0644\u0623\u0633\u0627\u0633 \u0627\u0644\u0630\u064A \u064A\u0646\u0628\u0646\u064A \u0639\u0644\u064A\u0647 \u0627\u0644\u062F\u0631\u0633."
    },
    {
      id: "q2",
      question: `\u0623\u064A \u0645\u0645\u0627 \u064A\u0644\u064A \u064A\u0645\u062B\u0644 \u0623\u0641\u0636\u0644 \u062A\u0637\u0628\u064A\u0642 \u0639\u0645\u0644\u064A \u0644\u0640 (${topic || "\u0627\u0644\u0645\u062D\u062A\u0648\u0649"})\u061F`,
      options: ["\u0627\u0644\u062A\u062C\u0631\u0628\u0629 \u0648\u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0645\u0646\u0637\u0642\u064A", "\u0627\u0644\u062A\u062E\u0645\u064A\u0646 \u0627\u0644\u0639\u0634\u0648\u0627\u0626\u064A", "\u062A\u062C\u0627\u0647\u0644 \u0627\u0644\u0634\u0631\u0648\u0637 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629", "\u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636 \u063A\u064A\u0631 \u0627\u0644\u0645\u062F\u0631\u0648\u0633"],
      correctAnswer: "\u0627\u0644\u062A\u062C\u0631\u0628\u0629 \u0648\u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0645\u0646\u0637\u0642\u064A",
      explanation: "\u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u0639\u0645\u0644\u064A \u0627\u0644\u0633\u0644\u064A\u0645 \u064A\u062A\u0637\u0644\u0628 \u062A\u062D\u0644\u064A\u0644\u0627\u064B \u0648\u062A\u062C\u0631\u0628\u0629 \u062F\u0642\u064A\u0642\u0629."
    }
  ];
  if (!ai) {
    return res.json({ questions: fallbackQuestions });
  }
  try {
    const prompt = `Generate a ${questionCount}-question multiple-choice quiz in Arabic on:
Subject: ${subject}
Grade Level: ${gradeLevel}
Topic: ${topic}
Difficulty: ${difficulty}

Return a valid JSON array of objects with the structure:
[
  {
    "id": "q1",
    "question": "question text in Arabic",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "explanation": "Brief reasoning in Arabic"
  }
]`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || "[]");
    res.json({ questions: Array.isArray(parsed) ? parsed : parsed.questions || fallbackQuestions });
  } catch (error) {
    console.warn("Quiz generator AI notice, returning fallback:", error?.message);
    res.json({ questions: fallbackQuestions });
  }
});
app2.post("/api/ai/student-remark", async (req, res) => {
  try {
    const { studentName, subject, gradeAverage, attendanceRate, behaviorPoints, strengths, areasForGrowth } = req.body;
    const ai = getGenAI();
    if (!ai) {
      return res.json({
        remark: `${studentName} has demonstrated steady dedication in ${subject} this term. With an overall average of ${gradeAverage || "88%"} and strong attendance (${attendanceRate || "95%"}), they consistently contribute thoughtful ideas to classroom discussions. To continue excelling, focusing on ${areasForGrowth || "thorough revision before assessments and detailed proofreading"} will help unlock their full potential. It is a pleasure having ${studentName} in class!`,
        actionPlan: [
          "Maintain active engagement in collaborative lab and group tasks",
          "Complete regular 15-minute weekly review sessions on complex topics",
          "Seek proactive clarification during office hours or review periods"
        ]
      });
    }
    const prompt = `Write a balanced, constructive, and motivating report card comment for a student.
Student Name: ${studentName}
Subject: ${subject}
Current Grade Average: ${gradeAverage}%
Attendance: ${attendanceRate}%
Merit/Demerit Points: ${behaviorPoints}
Observed Strengths: ${strengths || "Good participation, respectful, active listener"}
Areas for Growth: ${areasForGrowth || "Submitting homework consistently, double-checking exam work"}

Return a JSON object:
{
  "remark": "2-3 polished sentences suitable for official report cards",
  "actionPlan": ["Bullet 1", "Bullet 2", "Bullet 3"]
}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error) {
    console.error("Student remark error:", error);
    res.status(500).json({ error: error.message || "Failed to generate student remark." });
  }
});
app2.post("/api/ai/copilot", async (req, res) => {
  try {
    const { prompt, context } = req.body;
    const ai = getGenAI();
    if (!ai) {
      return res.json({
        response: `As an AI Teacher Assistant, here are actionable recommendations for "${prompt}":

1. **Structured Engagement:** Use tiered questions (recall, application, analysis) to involve all learning styles.
2. **Clear Feedback Loops:** Provide immediate formative feedback using rubrics or peer reviews.
3. **Classroom Flow:** Establish transparent routines with 2-minute transition timers.

*Note: Add a GEMINI_API_KEY in Settings > Secrets for real-time live generative responses.*`
      });
    }
    const systemInstruction = "You are 'Teacher Manager Copilot', an expert K-12 educator, classroom management coach, and instructional designer. Provide clear, direct, actionable, practical, and empathetic advice to help teachers save time, engage students, and resolve classroom challenges.";
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: `${context ? `Context: ${context}

` : ""}Teacher Question: ${prompt}`,
      config: {
        systemInstruction
      }
    });
    res.json({ response: response.text || "No response received." });
  } catch (error) {
    console.error("Copilot error:", error);
    res.status(500).json({ error: error.message || "Failed to consult copilot." });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app2.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app2.use(import_express.default.static(distPath));
    app2.get("*", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app2.listen(PORT, "0.0.0.0", () => {
    console.log(`Teacher Manager server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
