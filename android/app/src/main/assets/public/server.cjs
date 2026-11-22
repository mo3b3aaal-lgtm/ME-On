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
var import_firestore = require("@google-cloud/firestore");
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_node_crypto = __toESM(require("node:crypto"), 1);
var import_node_zlib = require("node:zlib");
var projectId = "corded-elevator-cf6jr";
var databaseId = "ai-studio-teacherskdb-2ab7b23f-628d-4bc7-9c38-f649ca7153f9";
try {
  const configPath = import_node_path.default.join(process.cwd(), "firebase-applet-config.json");
  if (import_node_fs.default.existsSync(configPath)) {
    const config = JSON.parse(import_node_fs.default.readFileSync(configPath, "utf-8"));
    if (config.projectId) projectId = config.projectId;
    if (config.firestoreDatabaseId) databaseId = config.firestoreDatabaseId;
  }
} catch {
}
var db = new import_firestore.Firestore({
  projectId,
  databaseId
});
var firestoreAccessible = null;
var lastFirestoreProbeAt = 0;
var FIRESTORE_FAILURE_RETRY_COOLDOWN_MS = 15e3;
async function isFirestoreConnected() {
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
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4e3))
    ]);
    firestoreAccessible = true;
    return true;
  } catch {
    firestoreAccessible = false;
    return false;
  }
}
var dataDir = import_node_path.default.join(process.cwd(), ".data");
var storeFilePath = import_node_path.default.join(dataDir, "db_store.json");
function loadLocalStore() {
  try {
    if (!import_node_fs.default.existsSync(dataDir)) {
      import_node_fs.default.mkdirSync(dataDir, { recursive: true });
    }
    if (import_node_fs.default.existsSync(storeFilePath)) {
      const content = import_node_fs.default.readFileSync(storeFilePath, "utf-8");
      return JSON.parse(content);
    }
  } catch {
  }
  return { users: {}, syncPackages: {} };
}
var localStore = loadLocalStore();
function persistLocalStore() {
  try {
    if (!import_node_fs.default.existsSync(dataDir)) {
      import_node_fs.default.mkdirSync(dataDir, { recursive: true });
    }
    import_node_fs.default.writeFileSync(storeFilePath, JSON.stringify(localStore, null, 2), "utf-8");
  } catch {
  }
}
var DEFAULT_DEMO_USER = {
  id: "acc_master_teacher",
  email: "teacher@classy.app",
  name: "\u0623. \u0645\u062D\u0645\u062F \u0623\u062D\u0645\u062F",
  phone: "01000000000",
  subject: "\u0631\u064A\u0627\u0636\u064A\u0627\u062A",
  centerOrSchool: "\u0633\u0646\u062A\u0631 \u0627\u0644\u062A\u0641\u0648\u0642 \u0627\u0644\u062A\u0639\u0644\u064A\u0645\u064A",
  password_hash: import_node_crypto.default.createHash("sha256").update("123456").digest("hex"),
  auth_token: "tok_master_teacher_demo_token_123456",
  recovery_pin: "123456",
  created_at: (/* @__PURE__ */ new Date()).toISOString(),
  updated_at: (/* @__PURE__ */ new Date()).toISOString()
};
if (!localStore.users[DEFAULT_DEMO_USER.id]) {
  localStore.users[DEFAULT_DEMO_USER.id] = DEFAULT_DEMO_USER;
  persistLocalStore();
}
var localUserMemoryCache = /* @__PURE__ */ new Map();
var localUserTokenCache = /* @__PURE__ */ new Map();
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
  let matchedDoc = null;
  const canUseFirestore = await isFirestoreConnected();
  if (canUseFirestore) {
    const usersColl = db.collection("users");
    try {
      const directDoc = await usersColl.doc(clean).get();
      if (directDoc.exists) {
        matchedDoc = directDoc;
      }
    } catch {
    }
    if (!matchedDoc) {
      try {
        const snap = await usersColl.where("email", "==", clean.toLowerCase()).get();
        if (!snap.empty) {
          matchedDoc = snap.docs[0];
        }
      } catch {
      }
    }
    if (!matchedDoc) {
      try {
        const snap = await usersColl.where("email", "==", clean).get();
        if (!snap.empty) {
          matchedDoc = snap.docs[0];
        }
      } catch {
      }
    }
    if (!matchedDoc) {
      try {
        const snap = await usersColl.where("phone", "==", clean).get();
        if (!snap.empty) {
          matchedDoc = snap.docs[0];
        }
      } catch {
      }
    }
    if (!matchedDoc) {
      try {
        const snap = await usersColl.where("name", "==", clean).get();
        if (!snap.empty) {
          matchedDoc = snap.docs[0];
        }
      } catch {
      }
    }
  }
  let userData = null;
  if (matchedDoc) {
    userData = matchedDoc.data();
  } else {
    const cleanLower = clean.toLowerCase();
    const localMatched = localStore.users[clean] || localUserMemoryCache.get(clean) || localUserMemoryCache.get(cleanLower) || Object.values(localStore.users).find(
      (u) => u.id === clean || u.email && u.email.toLowerCase() === cleanLower || u.phone && u.phone === clean || u.name && u.name.toLowerCase() === cleanLower
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
    throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u062D\u0633\u0627\u0628 \u0645\u0633\u062C\u0644 \u0628\u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648 \u0627\u0644\u0647\u0627\u062A\u0641 \u0641\u064A \u0627\u0644\u0633\u064A\u0631\u0641\u0631 \u0627\u0644\u0633\u062D\u0627\u0628\u064A");
  }
  const storedHash = userData.password_hash || "";
  const storedPlain = userData.password || "";
  let verificationResult = false;
  if (password) {
    const inputHash = import_node_crypto.default.createHash("sha256").update(password).digest("hex");
    verificationResult = storedHash && storedHash === inputHash || storedPlain && storedPlain === password || !storedHash && !storedPlain;
    if (!verificationResult) {
      throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0623\u0643\u062F \u0648\u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u0627\u064B");
    }
  }
  const token = generateRandomSessionToken();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const prevTokens = Array.isArray(userData.active_tokens) ? userData.active_tokens : [];
  const nextActiveTokens = [
    token,
    ...userData.auth_token ? [userData.auth_token] : [],
    ...prevTokens
  ].filter((t, idx, arr) => Boolean(t) && arr.indexOf(t) === idx).slice(0, 10);
  if (matchedDoc && canUseFirestore) {
    try {
      await matchedDoc.ref.set(
        {
          auth_token: token,
          active_tokens: nextActiveTokens,
          last_login_at: now,
          updated_at: now
        },
        { merge: true }
      );
    } catch {
    }
  }
  const updatedUser = {
    ...userData,
    auth_token: token,
    active_tokens: nextActiveTokens,
    last_login_at: now,
    updated_at: now
  };
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
async function registerUser(account) {
  const cleanEmail = (account.email || "").trim().toLowerCase();
  const cleanPhone = (account.phone || "").trim();
  const canUseFirestore = await isFirestoreConnected();
  if (cleanEmail && canUseFirestore) {
    try {
      const snap = await db.collection("users").where("email", "==", cleanEmail).get();
      if (!snap.empty) {
        const existing = snap.docs[0].data();
        const pwdHash2 = account.password ? import_node_crypto.default.createHash("sha256").update(account.password).digest("hex") : "";
        if (pwdHash2 && existing.password_hash && pwdHash2 !== existing.password_hash) {
          throw new Error("\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0628\u062D\u0633\u0627\u0628 \u0622\u062E\u0631 \u0628\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0645\u062E\u062A\u0644\u0641\u0629.");
        }
        const token2 = generateRandomSessionToken();
        const now2 = (/* @__PURE__ */ new Date()).toISOString();
        try {
          await snap.docs[0].ref.set(
            {
              auth_token: token2,
              last_login_at: now2,
              updated_at: now2
            },
            { merge: true }
          );
        } catch {
        }
        localUserTokenCache.set(token2, existing);
        return { user: { ...existing, auth_token: token2 }, token: token2 };
      }
    } catch (err) {
      if (err.message && err.message.includes("\u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644")) {
        throw err;
      }
    }
  }
  if (cleanEmail) {
    const localExisting = Object.values(localStore.users).find(
      (u) => u.email && u.email.toLowerCase() === cleanEmail
    );
    if (localExisting) {
      const pwdHash2 = account.password ? import_node_crypto.default.createHash("sha256").update(account.password).digest("hex") : "";
      if (pwdHash2 && localExisting.password_hash && pwdHash2 !== localExisting.password_hash) {
        throw new Error("\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0628\u062D\u0633\u0627\u0628 \u0622\u062E\u0631 \u0628\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0645\u062E\u062A\u0644\u0641\u0629.");
      }
      const token2 = generateRandomSessionToken();
      const now2 = (/* @__PURE__ */ new Date()).toISOString();
      localExisting.auth_token = token2;
      localExisting.last_login_at = now2;
      localExisting.updated_at = now2;
      localStore.users[localExisting.id] = localExisting;
      localUserTokenCache.set(token2, localExisting);
      persistLocalStore();
      return { user: localExisting, token: token2 };
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
    subject: account.subject || "\u0639\u0627\u0645",
    centerOrSchool: account.centerOrSchool || "",
    password_hash: pwdHash,
    auth_token: token,
    recovery_pin: account.recoveryPin || "123456",
    created_at: now,
    updated_at: now
  };
  if (canUseFirestore) {
    try {
      await db.collection("users").doc(userId).set({
        ...newUser,
        subject: account.subject || "\u0639\u0627\u0645",
        centerOrSchool: account.centerOrSchool || ""
      });
    } catch {
    }
  }
  localStore.users[userId] = newUser;
  localUserMemoryCache.set(userId, newUser);
  if (cleanEmail) localUserMemoryCache.set(cleanEmail, newUser);
  if (cleanPhone) localUserMemoryCache.set(cleanPhone, newUser);
  localUserTokenCache.set(token, newUser);
  persistLocalStore();
  return { user: newUser, token };
}
async function resetUserPasswordInFirestore(identifier, newPassword, recoveryPin) {
  const clean = (identifier || "").trim().toLowerCase();
  const canUseFirestore = await isFirestoreConnected();
  let matchedDoc = null;
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
    } catch {
    }
  }
  let user = matchedDoc ? matchedDoc.data() : null;
  if (!user) {
    user = localStore.users[clean] || Object.values(localStore.users).find(
      (u) => u.id === clean || u.email && u.email.toLowerCase() === clean || u.phone && u.phone === clean
    ) || null;
  }
  if (!user) {
    throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u062D\u0633\u0627\u0628 \u0628\u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648 \u0627\u0644\u0647\u0627\u062A\u0641 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645 \u0627\u0644\u0633\u062D\u0627\u0628\u064A.");
  }
  if (recoveryPin && user.recovery_pin && user.recovery_pin.trim() !== recoveryPin.trim()) {
    throw new Error("\u0643\u0648\u062F \u0627\u0644\u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0627\u0644\u0633\u0631\u064A (PIN) \u063A\u064A\u0631 \u0635\u062D\u064A\u062D.");
  }
  const newHash = import_node_crypto.default.createHash("sha256").update(newPassword).digest("hex");
  const newToken = generateRandomSessionToken();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (matchedDoc && canUseFirestore) {
    try {
      await matchedDoc.ref.set(
        {
          password_hash: newHash,
          auth_token: newToken,
          updated_at: now
        },
        { merge: true }
      );
    } catch {
    }
  }
  const updatedUser = {
    ...user,
    password_hash: newHash,
    auth_token: newToken,
    updated_at: now
  };
  localStore.users[updatedUser.id] = updatedUser;
  localUserMemoryCache.set(updatedUser.id, updatedUser);
  if (updatedUser.email) localUserMemoryCache.set(updatedUser.email.toLowerCase(), updatedUser);
  localUserTokenCache.set(newToken, updatedUser);
  persistLocalStore();
  return { success: true, message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0628\u0646\u062C\u0627\u062D \u0641\u064A \u0627\u0644\u0633\u064A\u0631\u0641\u0631 \u0627\u0644\u0633\u062D\u0627\u0628\u064A \u0648\u062A\u062C\u062F\u064A\u062F \u062C\u0644\u0633\u0629 \u0627\u0644\u0623\u0645\u0627\u0646." };
}
async function registerOrAuthenticateUser(account) {
  return registerUser(account);
}
async function getUserByToken(token) {
  if (!token || typeof token !== "string") return null;
  const cleanToken = token.trim();
  const cached = localUserTokenCache.get(cleanToken);
  if (cached) return cached;
  const canUseFirestore = await isFirestoreConnected();
  if (canUseFirestore) {
    try {
      const snap = await db.collection("users").where("auth_token", "==", cleanToken).get();
      if (!snap.empty) {
        const u = snap.docs[0].data();
        localUserTokenCache.set(cleanToken, u);
        return u;
      }
      const multiSnap = await db.collection("users").where("active_tokens", "array-contains", cleanToken).get();
      if (!multiSnap.empty) {
        const u = multiSnap.docs[0].data();
        localUserTokenCache.set(cleanToken, u);
        return u;
      }
    } catch {
    }
  }
  const fromLocal = Object.values(localStore.users).find(
    (u) => u.auth_token === cleanToken || Array.isArray(u.active_tokens) && u.active_tokens.includes(cleanToken)
  );
  if (fromLocal) {
    localUserTokenCache.set(cleanToken, fromLocal);
    return fromLocal;
  }
  return null;
}
async function readRawCloudPackageFromFirestore(userId) {
  const docRef = db.collection("user_sync_stores").doc(userId);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (!data) return null;
  if (data.storage_encoding === "gzip_chunks" && Number(data.chunk_count) > 0) {
    const chunksSnap = await docRef.collection("chunks").orderBy("index", "asc").get();
    if (!chunksSnap.empty) {
      const b64 = chunksSnap.docs.map((d) => String(d.data()?.data || "")).join("");
      if (b64) {
        const jsonBuf = (0, import_node_zlib.gunzipSync)(Buffer.from(b64, "base64"));
        return JSON.parse(jsonBuf.toString("utf8"));
      }
    }
  }
  if (typeof data.package_gzip_b64 === "string" && data.package_gzip_b64.length > 0) {
    const jsonBuf = (0, import_node_zlib.gunzipSync)(Buffer.from(data.package_gzip_b64, "base64"));
    return JSON.parse(jsonBuf.toString("utf8"));
  }
  return data.package || data.data_package || null;
}
async function getCloudDataPackage(userId) {
  if (!userId) return null;
  let rawPkg = null;
  const canUseFirestore = await isFirestoreConnected();
  if (canUseFirestore) {
    try {
      rawPkg = await readRawCloudPackageFromFirestore(userId);
    } catch (err) {
      console.error(`[Server Sync] Failed reading Firestore cloud package for ${userId}:`, err?.message || err);
    }
  }
  if (!rawPkg && localStore.syncPackages[userId]) {
    rawPkg = localStore.syncPackages[userId];
  }
  if (!rawPkg) {
    return null;
  }
  const parseSafeTime = (str) => {
    if (!str) return 0;
    const ms = new Date(str).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  };
  const resetTime = parseSafeTime(rawPkg.resetAllBefore);
  const tombstoneMap = /* @__PURE__ */ new Map();
  for (const t of rawPkg.tombstones || []) {
    if (t && t.id && t.entityType) {
      const key = `${t.entityType}:${t.id}`;
      const existing = tombstoneMap.get(key);
      if (!existing || parseSafeTime(t.deletedAt) > parseSafeTime(existing)) {
        tombstoneMap.set(key, t.deletedAt);
      }
    }
  }
  const filterList = (entityType, list = []) => {
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
  const sanitizedStudents = filterList("student", rawPkg.students);
  const sanitizedGroups = filterList("group", rawPkg.groups);
  const sanitizedEnrollments = filterList("enrollment", rawPkg.enrollments);
  const sanitizedSessions = filterList("session", rawPkg.sessions);
  const sanitizedAttendance = filterList("attendance", rawPkg.attendance);
  const sanitizedPayments = filterList("payment", rawPkg.payments);
  const sanitizedCreditLogs = filterList("creditLog", rawPkg.creditLogs);
  const sanitizedBehaviorLogs = filterList("behaviorLog", rawPkg.behaviorLogs);
  const sanitizedHomeworkTests = filterList("homeworkTest", rawPkg.homeworkTests);
  const sanitizedHomeworkAssignments = filterList("homeworkAssignment", rawPkg.homeworkAssignments);
  const sanitizedPkg = {
    ...rawPkg,
    students: sanitizedStudents,
    groups: sanitizedGroups,
    enrollments: sanitizedEnrollments,
    sessions: sanitizedSessions,
    attendance: sanitizedAttendance,
    payments: sanitizedPayments,
    creditLogs: sanitizedCreditLogs,
    behaviorLogs: sanitizedBehaviorLogs,
    homeworkTests: sanitizedHomeworkTests,
    homeworkAssignments: sanitizedHomeworkAssignments,
    homeworkQuestionResults: Array.isArray(rawPkg.homeworkQuestionResults) ? rawPkg.homeworkQuestionResults : [],
    stats: {
      totalStudents: sanitizedStudents.length,
      totalGroups: sanitizedGroups.length,
      totalSessions: sanitizedSessions.length,
      totalPayments: sanitizedPayments.length,
      totalHomeworkAssignments: sanitizedHomeworkAssignments.length
    }
  };
  return sanitizedPkg;
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
async function writePackageToFirestoreSafe(userId, version, now, pkg) {
  const syncDocRef = db.collection("user_sync_stores").doc(userId);
  const plainJson = JSON.stringify(pkg);
  const rawBytes = Buffer.byteLength(plainJson, "utf8");
  if (rawBytes <= 75e4) {
    const firestorePayload = {
      user_id: userId,
      version,
      last_sync_time: now,
      storage_encoding: "json",
      package: pkg,
      updated_at: now
    };
    try {
      await syncDocRef.set(firestorePayload, { merge: false });
      return;
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (!msg.includes("maximum allowed size") && !msg.includes("INVALID_ARGUMENT")) {
        console.error(`[Server Sync] CRITICAL Firestore save failure for ${userId} (${rawBytes} bytes):`, msg);
        throw new Error(`Firestore sync write failed (${msg || "unknown error"})`);
      }
    }
  }
  const compressedB64 = (0, import_node_zlib.gzipSync)(Buffer.from(plainJson, "utf8"), { level: 6 }).toString("base64");
  if (compressedB64.length <= 85e4) {
    const compressedPayload = {
      user_id: userId,
      version,
      last_sync_time: now,
      storage_encoding: "gzip_base64",
      package_gzip_b64: compressedB64,
      raw_bytes: rawBytes,
      stats: pkg.stats || null,
      updated_at: now
    };
    try {
      await syncDocRef.set(compressedPayload, { merge: false });
      return;
    } catch (err) {
      console.error(`[Server Sync] CRITICAL Firestore gzip write failure for ${userId} (${compressedB64.length} b64 chars):`, err?.message || err);
      throw new Error(`Firestore sync write failed (${err?.message || "unknown error"})`);
    }
  }
  const CHUNK_SIZE = 4e5;
  const chunks = [];
  for (let i = 0; i < compressedB64.length; i += CHUNK_SIZE) {
    chunks.push(compressedB64.slice(i, i + CHUNK_SIZE));
  }
  try {
    const batch = db.batch();
    const existingChunks = await syncDocRef.collection("chunks").get();
    existingChunks.docs.forEach((d) => batch.delete(d.ref));
    chunks.forEach((chunkData, idx) => {
      const chunkRef = syncDocRef.collection("chunks").doc(`chunk_${String(idx).padStart(4, "0")}`);
      batch.set(chunkRef, { index: idx, data: chunkData, updated_at: now });
    });
    batch.set(
      syncDocRef,
      {
        user_id: userId,
        version,
        last_sync_time: now,
        storage_encoding: "gzip_chunks",
        chunk_count: chunks.length,
        raw_bytes: rawBytes,
        stats: pkg.stats || null,
        updated_at: now
      },
      { merge: false }
    );
    await batch.commit();
  } catch (err) {
    console.error(`[Server Sync] CRITICAL Firestore chunked write failure for ${userId} (${chunks.length} chunks):`, err?.message || err);
    throw new Error(`Firestore chunked sync write failed (${err?.message || "unknown error"})`);
  }
}
async function saveCloudDataPackage(userId, dataPackage) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updatedPkg = sanitizeForFirestore({
    ...dataPackage,
    userId,
    lastSyncTime: now
  });
  localStore.syncPackages[userId] = updatedPkg;
  persistLocalStore();
  const canUseFirestore = await isFirestoreConnected();
  if (canUseFirestore) {
    await writePackageToFirestoreSafe(userId, dataPackage.version || "2.0", now, updatedPkg);
    try {
      const auditRef = db.collection("sync_audit_logs").doc();
      const totalRecords = (dataPackage.students?.length || 0) + (dataPackage.groups?.length || 0) + (dataPackage.sessions?.length || 0) + (dataPackage.payments?.length || 0);
      auditRef.set({
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
  }
  return { lastSyncTime: now, stats: updatedPkg.stats };
}
function mergeTombstones(localTombstones = [], cloudTombstones = []) {
  const map = /* @__PURE__ */ new Map();
  for (const t of [...cloudTombstones || [], ...localTombstones || []]) {
    if (!t || !t.id || !t.entityType) continue;
    const key = `${t.entityType}:${t.id}`;
    const existing = map.get(key);
    const tMs = new Date(t.deletedAt || 0).getTime() || 0;
    const eMs = existing ? new Date(existing.deletedAt || 0).getTime() || 0 : 0;
    if (!existing || tMs > eMs) {
      map.set(key, t);
    }
  }
  return Array.from(map.values());
}
function mergeEntities(entityType, localList = [], cloudList = [], tombstoneMap, resetAllBefore) {
  const parseTs = (s) => {
    if (!s) return 0;
    const ms = new Date(s).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  };
  const map = /* @__PURE__ */ new Map();
  const resetTime = parseTs(resetAllBefore);
  for (const item of cloudList || []) {
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
  for (const item of localList || []) {
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
        let mergedObj = { ...item, ...existing };
        if (entityType === "session" && item.status === "completed" && existing.status !== "completed") {
          mergedObj = { ...existing, ...item, status: "completed" };
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
async function mergeCloudDataPackage(userId, incomingPackage) {
  const existingCloud = await getCloudDataPackage(userId);
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
  if (!existingCloud) {
    const initialStudents = mergeEntities("student", incomingPackage.students || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialGroups = mergeEntities("group", incomingPackage.groups || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialEnrollments = mergeEntities("enrollment", incomingPackage.enrollments || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialSessions = mergeEntities("session", incomingPackage.sessions || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialAttendance = mergeEntities("attendance", incomingPackage.attendance || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialPayments = mergeEntities("payment", incomingPackage.payments || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialCreditLogs = mergeEntities("creditLog", incomingPackage.creditLogs || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialHomeworkTests = mergeEntities("homeworkTest", incomingPackage.homeworkTests || [], [], tombstoneMap, effectiveResetAllBefore);
    const initialHomeworkAssignments = mergeEntities("homeworkAssignment", incomingPackage.homeworkAssignments || [], [], tombstoneMap, effectiveResetAllBefore);
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
        totalHomeworkAssignments: initialHomeworkAssignments.length
      }
    };
    await saveCloudDataPackage(userId, saved);
    return { dataPackage: saved, merged: false };
  }
  const mergedStudents = mergeEntities("student", incomingPackage.students, existingCloud.students, tombstoneMap, effectiveResetAllBefore);
  const mergedGroups = mergeEntities("group", incomingPackage.groups, existingCloud.groups, tombstoneMap, effectiveResetAllBefore);
  const mergedEnrollments = mergeEntities("enrollment", incomingPackage.enrollments, existingCloud.enrollments, tombstoneMap, effectiveResetAllBefore);
  const mergedSessions = mergeEntities("session", incomingPackage.sessions, existingCloud.sessions, tombstoneMap, effectiveResetAllBefore);
  const mergedAttendance = mergeEntities("attendance", incomingPackage.attendance, existingCloud.attendance, tombstoneMap, effectiveResetAllBefore);
  const mergedPayments = mergeEntities("payment", incomingPackage.payments, existingCloud.payments, tombstoneMap, effectiveResetAllBefore);
  const mergedCreditLogs = mergeEntities("creditLog", incomingPackage.creditLogs || [], existingCloud.creditLogs || [], tombstoneMap, effectiveResetAllBefore);
  const mergedHomeworkTests = mergeEntities("homeworkTest", incomingPackage.homeworkTests || [], existingCloud.homeworkTests || [], tombstoneMap, effectiveResetAllBefore);
  const mergedHomeworkAssignments = mergeEntities("homeworkAssignment", incomingPackage.homeworkAssignments || [], existingCloud.homeworkAssignments || [], tombstoneMap, effectiveResetAllBefore);
  const qMap = /* @__PURE__ */ new Map();
  for (const q of existingCloud.homeworkQuestionResults || []) {
    if (q && q.id) qMap.set(q.id, q);
  }
  for (const q of incomingPackage.homeworkQuestionResults || []) {
    if (q && q.id) qMap.set(q.id, q);
  }
  const mergedHomeworkQuestionResults = Array.from(qMap.values());
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
      totalHomeworkAssignments: mergedHomeworkAssignments.length
    }
  };
  await saveCloudDataPackage(userId, mergedPackage);
  return { dataPackage: mergedPackage, merged: true };
}
async function resetUserCloudData(userId, resetAllBefore) {
  const resetTimestamp = resetAllBefore || (/* @__PURE__ */ new Date()).toISOString();
  const resetTime = new Date(resetTimestamp).getTime();
  let existingPkg = localStore.syncPackages[userId] || {};
  const canUseFirestore = await isFirestoreConnected();
  if (canUseFirestore) {
    try {
      const firestorePkg = await readRawCloudPackageFromFirestore(userId);
      if (firestorePkg) {
        existingPkg = firestorePkg;
      }
    } catch {
    }
  }
  let effectiveReset = resetTimestamp;
  if (existingPkg.resetAllBefore) {
    if (new Date(existingPkg.resetAllBefore).getTime() > resetTime) {
      effectiveReset = existingPkg.resetAllBefore;
    }
  }
  const effectiveResetTime = new Date(effectiveReset).getTime();
  const filterPostReset = (items = []) => {
    if (!Array.isArray(items)) return [];
    return items.filter((it) => {
      if (!it || !it.id) return false;
      const tStr = it.updatedAt || it.createdAt || it.recordedAt || "";
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
  const remainingBehaviorLogs = filterPostReset(existingPkg.behaviorLogs);
  const remainingHomeworkTests = filterPostReset(existingPkg.homeworkTests);
  const remainingHomeworkAssignments = filterPostReset(existingPkg.homeworkAssignments);
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
    behaviorLogs: remainingBehaviorLogs,
    homeworkTests: remainingHomeworkTests,
    homeworkAssignments: remainingHomeworkAssignments,
    homeworkQuestionResults: [],
    monthlyInvoices: [],
    teacherProfile: existingPkg.teacherProfile || null,
    tombstones: [],
    stats: {
      totalStudents: remainingStudents.length,
      totalGroups: remainingGroups.length,
      totalSessions: remainingSessions.length,
      totalPayments: remainingPayments.length,
      totalHomeworkAssignments: remainingHomeworkAssignments.length
    }
  });
  localStore.syncPackages[userId] = resetPackage;
  persistLocalStore();
  if (canUseFirestore) {
    try {
      await writePackageToFirestoreSafe(userId, "2.0", now, resetPackage);
    } catch (err) {
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
    verifiedActiveSessions
  };
}

// server.ts
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(
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
app.options("*", (0, import_cors.default)());
app.use(
  import_express.default.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(
  import_express.default.urlencoded({
    extended: true,
    limit: "50mb",
    verify: (req, _res, buf) => {
      if (!req.rawBody) {
        req.rawBody = buf;
      }
    }
  })
);
var AI_MODELS_CASCADE = ["gemini-3.8-flash", "gemini-3.7-flash"];
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
async function safeGenerateContent(ai, params) {
  for (const model of AI_MODELS_CASCADE) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config
      });
      if (response && response.text) {
        return response.text;
      }
    } catch {
      continue;
    }
  }
  return null;
}
app.get("/api/health", (_req, res) => {
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
app.post("/api/auth/login", async (req, res) => {
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
app.post("/api/auth/register", async (req, res) => {
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
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { identifier, newPassword, recoveryPin } = req.body;
    const result = await resetUserPasswordInFirestore(identifier, newPassword, recoveryPin);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || "\u0641\u0634\u0644 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631" });
  }
});
app.post("/api/auth/sync-session", async (req, res) => {
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
var SYNC_COLLECTION_ARRAY_FIELDS = [
  "students",
  "groups",
  "enrollments",
  "sessions",
  "attendance",
  "payments",
  "creditLogs",
  "behaviorLogs",
  "homeworkTests",
  "homeworkAssignments",
  "homeworkQuestionResults",
  "tombstones"
];
function validateIncomingSyncPackage(pkg) {
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
    return "Invalid dataPackage: expected an object";
  }
  const obj = pkg;
  for (const field of SYNC_COLLECTION_ARRAY_FIELDS) {
    if (obj[field] !== void 0 && !Array.isArray(obj[field])) {
      return `Invalid dataPackage.${field}: expected an array`;
    }
  }
  return null;
}
function formatSyncRouteError(error, fallbackMessage) {
  const msg = String(error?.message || fallbackMessage);
  const isSizeError = msg.includes("maximum allowed size") || msg.includes("1,048,576") || msg.includes("INVALID_ARGUMENT");
  return {
    status: isSizeError ? 413 : 500,
    errorCode: isSizeError ? "FIRESTORE_DOC_TOO_LARGE" : "CLOUD_SYNC_SERVER_ERROR",
    error: msg
  };
}
app.post("/api/sync/push", requireAuth, async (req, res) => {
  try {
    const authenticatedUserId = req.user.id;
    const { dataPackage } = req.body;
    const validationError = validateIncomingSyncPackage(dataPackage);
    if (validationError) {
      return res.status(400).json({ success: false, errorCode: "INVALID_SYNC_PACKAGE", error: validationError });
    }
    const result = await saveCloudDataPackage(authenticatedUserId, dataPackage);
    res.json({ success: true, lastSyncTime: result.lastSyncTime, stats: result.stats });
  } catch (error) {
    console.error("Sync push error:", error);
    const formatted = formatSyncRouteError(error, "Failed to push sync data");
    res.status(formatted.status).json({ success: false, errorCode: formatted.errorCode, error: formatted.error });
  }
});
app.get("/api/sync/pull", requireAuth, async (req, res) => {
  try {
    const authenticatedUserId = req.user.id;
    const cloudData = await getCloudDataPackage(authenticatedUserId);
    if (!cloudData) {
      return res.json({ success: true, hasCloudData: false, dataPackage: null });
    }
    res.json({ success: true, hasCloudData: true, dataPackage: cloudData });
  } catch (error) {
    console.error("Sync pull error:", error);
    const formatted = formatSyncRouteError(error, "Failed to pull sync data");
    res.status(formatted.status).json({ success: false, errorCode: formatted.errorCode, error: formatted.error });
  }
});
app.get("/api/sync/pull/:userId", requireAuth, async (req, res) => {
  try {
    const authenticatedUserId = req.user.id;
    const cloudData = await getCloudDataPackage(authenticatedUserId);
    if (!cloudData) {
      return res.json({ success: true, hasCloudData: false, dataPackage: null });
    }
    res.json({ success: true, hasCloudData: true, dataPackage: cloudData });
  } catch (error) {
    console.error("Sync pull error:", error);
    const formatted = formatSyncRouteError(error, "Failed to pull sync data");
    res.status(formatted.status).json({ success: false, errorCode: formatted.errorCode, error: formatted.error });
  }
});
app.post("/api/sync/merge", requireAuth, async (req, res) => {
  try {
    const authenticatedUserId = req.user.id;
    const { dataPackage } = req.body;
    const validationError = validateIncomingSyncPackage(dataPackage);
    if (validationError) {
      return res.status(400).json({ success: false, errorCode: "INVALID_SYNC_PACKAGE", error: validationError });
    }
    const result = await mergeCloudDataPackage(authenticatedUserId, dataPackage);
    res.json({ success: true, dataPackage: result.dataPackage, merged: result.merged });
  } catch (error) {
    console.error("Sync merge error:", error);
    const formatted = formatSyncRouteError(error, "Failed to merge sync data");
    res.status(formatted.status).json({ success: false, errorCode: formatted.errorCode, error: formatted.error });
  }
});
app.post("/api/sync/reset", requireAuth, async (req, res) => {
  try {
    const authenticatedUserId = req.user.id;
    const { resetAllBefore } = req.body;
    const result = await resetUserCloudData(authenticatedUserId, resetAllBefore);
    res.json({
      success: true,
      acknowledged: true,
      resetAllBefore: result.resetAllBefore,
      verifiedActiveStudents: result.verifiedActiveStudents,
      verifiedActiveGroups: result.verifiedActiveGroups,
      verifiedActiveSessions: result.verifiedActiveSessions
    });
  } catch (error) {
    console.error("Sync reset error:", error);
    const formatted = formatSyncRouteError(error, "Failed to reset cloud sync data");
    res.status(formatted.status).json({ success: false, errorCode: formatted.errorCode, error: formatted.error });
  }
});
app.post("/api/ai/lesson-plan", async (req, res) => {
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
    const text = await safeGenerateContent(ai, { contents: prompt });
    res.json({ plan: text || fallbackPlan });
  } catch {
    res.json({ plan: fallbackPlan });
  }
});
app.post("/api/ai/parent-message", async (req, res) => {
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
    const text = await safeGenerateContent(ai, {
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    if (text) {
      try {
        const parsed = JSON.parse(text);
        return res.json(parsed);
      } catch {
      }
    }
    res.json({ subject: fallbackSubject, message: text || fallbackBody });
  } catch {
    res.json({ subject: fallbackSubject, message: fallbackBody });
  }
});
app.post("/api/ai/quiz-generator", async (req, res) => {
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
    const text = await safeGenerateContent(ai, {
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    if (text) {
      try {
        const parsed = JSON.parse(text);
        return res.json({ questions: Array.isArray(parsed) ? parsed : parsed.questions || fallbackQuestions });
      } catch {
      }
    }
    res.json({ questions: fallbackQuestions });
  } catch {
    res.json({ questions: fallbackQuestions });
  }
});
app.post("/api/ai/attendance-insights", async (req, res) => {
  const { students = [], attendanceSummary = [], teacherSubject = "\u0639\u0627\u0645", teacherName = "\u0627\u0644\u0645\u0639\u0644\u0645" } = req.body;
  const ai = getGenAI();
  const generateFallbackInsights = () => {
    const atRiskStudents = [];
    let totalPresent = 0;
    let totalAbsences = 0;
    let totalRecorded = 0;
    attendanceSummary.forEach((stSummary) => {
      totalPresent += stSummary.presentCount || 0;
      totalAbsences += (stSummary.absentChargedCount || 0) + (stSummary.absentFreeCount || 0);
      totalRecorded += stSummary.totalSessions || 0;
      const rate = stSummary.totalSessions > 0 ? Math.round(stSummary.presentCount / stSummary.totalSessions * 100) : 100;
      const recentAbsences = (stSummary.recentStatuses || []).slice(0, 2).filter((s) => s && s.includes("absent")).length;
      if (recentAbsences >= 2 || rate < 75) {
        const studentInfo = students.find((s) => s.id === stSummary.studentId);
        atRiskStudents.push({
          studentId: stSummary.studentId,
          studentName: stSummary.studentName || studentInfo?.name || "\u0637\u0627\u0644\u0628",
          riskLevel: recentAbsences >= 2 ? "high" : "medium",
          attendanceRate: rate,
          reason: recentAbsences >= 2 ? "\u063A\u064A\u0627\u0628 \u0645\u062A\u062A\u0627\u0644\u064A \u0641\u064A \u0622\u062E\u0631 \u062D\u0635\u062A\u064A\u0646" : `\u0646\u0633\u0628\u0629 \u0627\u0644\u062D\u0636\u0648\u0631 \u0645\u0646\u062E\u0641\u0636\u0629 (${rate}%)`,
          recommendation: "\u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0648\u0644\u064A \u0627\u0644\u0623\u0645\u0631 \u0644\u0644\u0627\u0637\u0645\u0626\u0646\u0627\u0646 \u0648\u0645\u062A\u0627\u0628\u0639\u0629 \u062A\u0639\u0648\u064A\u0636 \u0627\u0644\u062F\u0631\u0648\u0633 \u0627\u0644\u0641\u0627\u0626\u062A\u0629",
          parentPhone: studentInfo?.parentPhone || studentInfo?.phone || ""
        });
      }
    });
    const overallRate = totalRecorded > 0 ? Math.round(totalPresent / totalRecorded * 100) : 100;
    return {
      overallHealthScore: overallRate,
      headline: atRiskStudents.length > 0 ? `\u062A\u0645 \u0631\u0635\u062F ${atRiskStudents.length} \u0637\u0644\u0627\u0628 \u0628\u062D\u0627\u062C\u0629 \u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0625\u0636\u0627\u0641\u064A\u0629 \u0644\u062A\u0639\u0632\u064A\u0632 \u0627\u0644\u062A\u0632\u0627\u0645\u0647\u0645 \u0628\u0627\u0644\u062D\u0636\u0648\u0631` : "\u0645\u0639\u062F\u0644 \u0627\u0644\u062A\u0632\u0627\u0645 \u0645\u0645\u062A\u0627\u0632 \u0648\u0627\u0633\u062A\u0642\u0631\u0627\u0631 \u0639\u0627\u0645 \u0641\u064A \u062D\u0636\u0648\u0631 \u0627\u0644\u0637\u0644\u0627\u0628 \u0644\u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0627\u062A",
      summary: `\u0645\u0639\u062F\u0644 \u0627\u0644\u062D\u0636\u0648\u0631 \u0627\u0644\u0639\u0627\u0645 ${overallRate}%. \u064A\u0648\u0635\u0649 \u0628\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0637\u0644\u0627\u0628 \u0627\u0644\u0645\u062A\u063A\u064A\u0628\u064A\u0646 \u0644\u0644\u062D\u0641\u0627\u0638 \u0639\u0644\u0649 \u0627\u0633\u062A\u0645\u0631\u0627\u0631\u064A\u0629 \u0627\u0644\u062A\u062D\u0635\u064A\u0644 \u0627\u0644\u0623\u0643\u0627\u062F\u064A\u0645\u064A.`,
      attentionNeededStudents: atRiskStudents.slice(0, 5),
      positiveNotes: totalRecorded > 0 ? "\u0645\u0639\u0638\u0645 \u0627\u0644\u0637\u0644\u0627\u0628 \u064A\u062D\u0627\u0641\u0638\u0648\u0646 \u0639\u0644\u0649 \u062D\u0636\u0648\u0631 \u0645\u0646\u062A\u0638\u0645 \u062F\u0648\u0646 \u0627\u0646\u0642\u0637\u0627\u0639" : "\u0633\u062C\u0644 \u0627\u0644\u062D\u0636\u0648\u0631 \u0645\u0646\u062A\u0638\u0645",
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  };
  if (!ai || attendanceSummary.length === 0) {
    return res.json(generateFallbackInsights());
  }
  try {
    const prompt = `You are an expert educational data analyst assisting teacher "${teacherName}" (Subject: ${teacherSubject}).
Analyze the following student attendance records and generate actionable pedagogical insights in Arabic.

Student Attendance Data:
${JSON.stringify(attendanceSummary.slice(0, 30), null, 2)}

Instructions:
1. Calculate overall health score (0-100) of attendance.
2. Identify students who need extra attention due to:
   - Repeated/consecutive absences
   - Frequent tardiness
   - Sudden drop in attendance rate
3. For each identified student, provide:
   - studentId
   - studentName
   - riskLevel: "high" (2+ consecutive absences or <60% attendance) or "medium" (tardiness or 60-75% attendance) or "low"
   - attendanceRate: number (0-100)
   - reason: concise explanation in Arabic (e.g. "\u063A\u064A\u0627\u0628 \u0645\u062A\u062A\u0627\u0644\u064A \u0644\u0622\u062E\u0631 \u062D\u0635\u062A\u064A\u0646", "\u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u062A\u0623\u062E\u0631 \u0645\u0639 \u0627\u0646\u062E\u0641\u0627\u0636 \u0627\u0644\u062D\u0636\u0648\u0631")
   - recommendation: practical action for the teacher in Arabic
4. Provide a positive note acknowledging good performance or overall trend.

Respond ONLY with this JSON schema:
{
  "overallHealthScore": number,
  "headline": "Short punchy 1-sentence headline in Arabic",
  "summary": "1-2 sentences explaining the trend and key action in Arabic",
  "attentionNeededStudents": [
    {
      "studentId": "string",
      "studentName": "string",
      "riskLevel": "high" | "medium" | "low",
      "attendanceRate": number,
      "reason": "string",
      "recommendation": "string"
    }
  ],
  "positiveNotes": "string in Arabic"
}`;
    const text = await safeGenerateContent(ai, {
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.attentionNeededStudents && Array.isArray(parsed.attentionNeededStudents)) {
          parsed.attentionNeededStudents = parsed.attentionNeededStudents.map((st) => {
            const matched = students.find((s) => s.id === st.studentId);
            return {
              ...st,
              parentPhone: matched?.parentPhone || matched?.phone || ""
            };
          });
        }
        return res.json(parsed);
      } catch {
      }
    }
    res.json(generateFallbackInsights());
  } catch {
    res.json(generateFallbackInsights());
  }
});
app.post("/api/ai/student-remark", async (req, res) => {
  const { studentName, subject, gradeAverage, attendanceRate, behaviorPoints, strengths, areasForGrowth } = req.body;
  const fallbackRemark = {
    remark: `${studentName || "\u0627\u0644\u0637\u0627\u0644\u0628"} \u0623\u0638\u0647\u0631 \u0627\u0644\u062A\u0632\u0627\u0645\u0627\u064B \u0648\u0627\u062C\u062A\u0647\u0627\u062F\u0627\u064B \u0645\u0644\u062D\u0648\u0638\u0627\u064B \u0641\u064A \u0645\u0627\u062F\u0629 ${subject || "\u0627\u0644\u062F\u0631\u0627\u0633\u064A\u0629"}. \u0628\u0645\u0639\u062F\u0644 \u0625\u062C\u0645\u0627\u0644\u064A ${gradeAverage || "88%"} \u0648\u0646\u0633\u0628\u0629 \u062D\u0636\u0648\u0631 \u0645\u0645\u062A\u0627\u0632\u0629 (${attendanceRate || "95%"})\u060C \u064A\u0634\u0627\u0631\u0643 \u0628\u0641\u0627\u0639\u0644\u064A\u0629 \u0648\u062A\u0631\u0643\u064A\u0632 \u0641\u064A \u0627\u0644\u0623\u0646\u0634\u0637\u0629. \u0644\u0644\u0627\u0633\u062A\u0645\u0631\u0627\u0631 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u062A\u0645\u064A\u0632\u060C \u064A\u0648\u0635\u0649 \u0628\u0627\u0644\u062A\u0631\u0643\u064A\u0632 \u0639\u0644\u0649 \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0646\u0642\u0627\u0637 \u0627\u0644\u062F\u0642\u064A\u0642\u0629 \u0642\u0628\u0644 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A.`,
    actionPlan: [
      "\u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629 \u0627\u0644\u0645\u0633\u062A\u0645\u0631\u0629 \u0641\u064A \u0627\u0644\u062A\u062F\u0631\u064A\u0628\u0627\u062A \u0648\u0627\u0644\u0623\u0646\u0634\u0637\u0629 \u0627\u0644\u062A\u0637\u0628\u064A\u0642\u064A\u0629",
      "\u062A\u062E\u0635\u064A\u0635 \u0648\u0642\u062A \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064A\u0629 \u0644\u0644\u0645\u0641\u0627\u0647\u064A\u0645 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629",
      "\u0637\u0631\u062D \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0648\u0645\u062A\u0627\u0628\u0639\u0629 \u0623\u064A \u0627\u0633\u062A\u0641\u0633\u0627\u0631\u0627\u062A \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u062D\u0635\u0629"
    ]
  };
  const ai = getGenAI();
  if (!ai) {
    return res.json(fallbackRemark);
  }
  try {
    const prompt = `Write a balanced, constructive, and motivating report card comment in Arabic for a student.
Student Name: ${studentName}
Subject: ${subject}
Current Grade Average: ${gradeAverage}%
Attendance: ${attendanceRate}%
Merit/Demerit Points: ${behaviorPoints}
Observed Strengths: ${strengths || "\u0645\u0634\u0627\u0631\u0643\u0629 \u062C\u064A\u062F\u0629\u060C \u062A\u0631\u0643\u064A\u0632 \u0641\u064A \u0627\u0644\u062D\u0635\u0629\u060C \u0623\u062F\u0628 \u0648\u0627\u062C\u062A\u0647\u0627\u062F"}
Areas for Growth: ${areasForGrowth || "\u0627\u0644\u0645\u062F\u0627\u0648\u0645\u0629 \u0639\u0644\u0649 \u062D\u0644 \u0627\u0644\u0648\u0627\u062C\u0628\u0627\u062A \u0628\u062F\u0642\u0629\u060C \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0642\u0628\u0644 \u0627\u0644\u0627\u062E\u062A\u0628\u0627\u0631\u0627\u062A"}

Return a JSON object:
{
  "remark": "2-3 polished sentences suitable for official report cards in Arabic",
  "actionPlan": ["Bullet 1 in Arabic", "Bullet 2 in Arabic", "Bullet 3 in Arabic"]
}`;
    const text = await safeGenerateContent(ai, {
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    if (text) {
      try {
        const parsed = JSON.parse(text);
        return res.json(parsed);
      } catch {
      }
    }
    res.json(fallbackRemark);
  } catch {
    res.json(fallbackRemark);
  }
});
app.post("/api/ai/copilot", async (req, res) => {
  const { prompt, context } = req.body;
  const fallbackResponse = {
    response: `\u0625\u0644\u064A\u0643 \u0623\u0641\u0636\u0644 \u0627\u0644\u062A\u0648\u0635\u064A\u0627\u062A \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0644\u0644\u0645\u0639\u0644\u0645:

1. **\u0627\u0644\u062A\u0646\u0638\u064A\u0645 \u0648\u0627\u0644\u062A\u0633\u0644\u0633\u0644:** \u062A\u0642\u0633\u064A\u0645 \u0627\u0644\u0623\u0646\u0634\u0637\u0629 \u0625\u0644\u0649 \u0645\u0631\u0627\u062D\u0644 \u0648\u0627\u0636\u062D\u0629 (\u062A\u0645\u0647\u064A\u062F\u060C \u0634\u0631\u062D \u062A\u0637\u0628\u064A\u0642\u064A\u060C \u062A\u0642\u064A\u064A\u0645 \u0633\u0631\u064A\u0639).
2. **\u0627\u0644\u062A\u0641\u0627\u0639\u0644 \u0627\u0644\u0625\u064A\u062C\u0627\u0628\u064A:** \u062A\u0634\u062C\u064A\u0639 \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629 \u0648\u0637\u0631\u062D \u0623\u0633\u0626\u0644\u0629 \u0628\u0645\u0633\u062A\u0648\u064A\u0627\u062A \u062A\u0641\u0643\u064A\u0631 \u0645\u062A\u062F\u0631\u062C\u0629.
3. **\u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0645\u0633\u062A\u0645\u0631\u0629:** \u0631\u0635\u062F \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0645\u0628\u0627\u0634\u0631\u0629 \u0644\u062A\u0642\u062F\u064A\u0645 \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u0645\u0646\u0627\u0633\u0628 \u0644\u0643\u0644 \u0637\u0627\u0644\u0628.`
  };
  const ai = getGenAI();
  if (!ai) {
    return res.json(fallbackResponse);
  }
  try {
    const systemInstruction = "You are 'Classy Copilot', an expert K-12 educator, classroom management coach, and instructional designer. Provide clear, direct, actionable, practical, and empathetic advice to help teachers save time, engage students, and resolve classroom challenges in Arabic.";
    const text = await safeGenerateContent(ai, {
      contents: `${context ? `Context: ${context}

` : ""}Teacher Question: ${prompt}`,
      config: { systemInstruction }
    });
    res.json({ response: text || fallbackResponse.response });
  } catch {
    res.json(fallbackResponse);
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Classy server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
