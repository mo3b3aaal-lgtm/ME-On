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
function generateDeterministicToken(userId, salt = "teachermanager_secret_seed") {
  return import_node_crypto.default.createHmac("sha256", salt).update(userId).digest("hex");
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
  const usersColl = (0, import_firestore.collection)(db, "users");
  let matchedDoc = null;
  try {
    const directDoc = await (0, import_firestore.getDoc)((0, import_firestore.doc)(db, "users", clean));
    if (directDoc.exists()) {
      matchedDoc = directDoc;
    }
  } catch (e) {
  }
  if (!matchedDoc) {
    try {
      const qEmail = (0, import_firestore.query)(usersColl, (0, import_firestore.where)("email", "==", clean.toLowerCase()));
      const snap = await (0, import_firestore.getDocs)(qEmail);
      if (!snap.empty) {
        matchedDoc = snap.docs[0];
      }
    } catch (e) {
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
    }
  }
  if (!matchedDoc) {
    throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u062D\u0633\u0627\u0628 \u0645\u0633\u062C\u0644 \u0628\u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648 \u0627\u0644\u0647\u0627\u062A\u0641 \u0641\u064A \u0627\u0644\u0633\u064A\u0631\u0641\u0631 \u0627\u0644\u0633\u062D\u0627\u0628\u064A");
  }
  const userData = matchedDoc.data();
  if (password) {
    const inputHash = import_node_crypto.default.createHash("sha256").update(password).digest("hex");
    const storedHash = userData.password_hash || "";
    const storedPlain = userData.password || "";
    const isMatch = storedHash && storedHash === inputHash || storedPlain && storedPlain === password || !storedHash && !storedPlain;
    if (!isMatch) {
      throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0623\u0643\u062F \u0648\u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u0627\u064B");
    }
  }
  const token = generateDeterministicToken(userData.id);
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
      const token2 = generateDeterministicToken(existing.id);
      return { user: existing, token: token2 };
    }
  }
  const userId = account.id || `acc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const token = generateDeterministicToken(userId);
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
  await (0, import_firestore.setDoc)(userRef, {
    ...newUser,
    subject: account.subject || "\u0639\u0627\u0645",
    centerOrSchool: account.centerOrSchool || ""
  });
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
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await (0, import_firestore.setDoc)(
    matchedDoc.ref,
    {
      password_hash: newHash,
      updated_at: now
    },
    { merge: true }
  );
  return { success: true, message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0628\u0646\u062C\u0627\u062D \u0641\u064A \u0627\u0644\u0633\u064A\u0631\u0641\u0631 \u0627\u0644\u0633\u062D\u0627\u0628\u064A." };
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
async function getUserById(userId) {
  if (!userId) return null;
  try {
    const userRef = (0, import_firestore.doc)(db, "users", userId);
    const snap = await (0, import_firestore.getDoc)(userRef);
    if (!snap.exists()) return null;
    return snap.data();
  } catch (err) {
    console.error("Error getting user by id from Firestore:", err);
    return null;
  }
}
async function getCloudDataPackage(userId) {
  if (!userId) return null;
  try {
    const syncDocRef = (0, import_firestore.doc)(db, "user_sync_stores", userId);
    const snap = await (0, import_firestore.getDoc)(syncDocRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    return data.package || data.data_package || null;
  } catch (err) {
    console.error(`Error reading cloud data package from Firestore for ${userId}:`, err);
    return null;
  }
}
async function saveCloudDataPackage(userId, dataPackage) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updatedPkg = {
    ...dataPackage,
    userId,
    lastSyncTime: now
  };
  const syncDocRef = (0, import_firestore.doc)(db, "user_sync_stores", userId);
  await (0, import_firestore.setDoc)(
    syncDocRef,
    {
      user_id: userId,
      version: dataPackage.version || "2.0",
      last_sync_time: now,
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
function mergeEntities(localList = [], cloudList = []) {
  const map = /* @__PURE__ */ new Map();
  for (const item of cloudList) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
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
async function mergeCloudDataPackage(userId, incomingPackage) {
  const existingCloud = await getCloudDataPackage(userId);
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
    stats: {
      totalStudents: mergedStudents.length,
      totalGroups: mergedGroups.length,
      totalSessions: mergedSessions.length,
      totalPayments: mergedPayments.length
    }
  };
  await saveCloudDataPackage(userId, mergedPackage);
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
    let user = null;
    if (token) {
      user = await getUserByToken(token);
    }
    if (!user && req.body && req.body.userId) {
      const rawId = String(req.body.userId).trim();
      user = await getUserById(rawId);
      if (!user) {
        const result = await registerOrAuthenticateUser({
          id: rawId,
          email: req.body.email || `${rawId}@teachermanager.local`,
          name: req.body.teacherProfile?.name || "\u0645\u0639\u0644\u0645"
        });
        user = result.user;
      }
    }
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid or missing authentication credentials."
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
    const identifier = req.body.identifier || req.body.email || req.body.phone || req.body.id;
    const password = req.body.password;
    console.log(`[Auth API /api/auth/login] Attempting login for identifier: "${identifier}"`);
    if (!identifier) {
      return res.status(400).json({ success: false, error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641" });
    }
    const { user, token } = await authenticateUser(identifier, password);
    console.log(`[Auth API /api/auth/login] Login successful! User ID: ${user.id}, Email: ${user.email}`);
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
    console.warn(`[Auth API /api/auth/login] Authentication failed:`, error.message);
    res.status(401).json({ success: false, error: error.message || "\u0641\u0634\u0644 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644" });
  }
});
app2.post("/api/auth/register", async (req, res) => {
  try {
    const { id, email, name, phone, subject, centerOrSchool, password, recoveryPin } = req.body;
    console.log(`[Auth API /api/auth/register] Registering account for: ${email || name}`);
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
    res.status(400).json({ success: false, error: error.message || "\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062D\u0633\u0627\u0628" });
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
  try {
    const { topic, subject, gradeLevel, duration = "45 mins", objectives } = req.body;
    const ai = getGenAI();
    if (!ai) {
      return res.json({
        plan: `# Lesson Plan: ${topic || "Core Principles"}
**Subject:** ${subject || "General Science"} | **Grade Level:** ${gradeLevel || "Grade 10"} | **Duration:** ${duration}

## \u{1F3AF} Learning Objectives
- Students will understand the fundamental concepts of ${topic || "the topic"}.
- Students will identify 3 key practical applications in real-world scenarios.
- Students will collaborate in pairs to analyze and present a 2-minute solution.

## \u23F1\uFE0F Lesson Structure
1. **Hook & Warm-up (5-8 mins):** 
   - Provocative real-world question: "How does ${topic} impact our daily technology or environment?"
   - Quick 2-minute think-pair-share.
2. **Direct Instruction (15 mins):**
   - Concept breakdown with visual diagrams on the board.
   - Demonstration of key vocabulary and step-by-step example problem.
3. **Guided Practice (12 mins):**
   - Small group activity: Analyzing a case scenario with teacher roving check-ins.
4. **Independent Work / Formative Check (7 mins):**
   - 3-question exit ticket checking for core concept retention.
5. **Closure & Homework (3 mins):**
   - Summary recap by two volunteer students; assigned reading / reflection prompt.

## \u{1F4A1} Differentiated Learning Support
- **For Advanced Learners:** Challenge problem involving multi-step synthesis.
- **For Scaffolding:** Graphic organizer with pre-filled vocabulary terms.`
      });
    }
    const prompt = `You are a master educator and pedagogical specialist. Create a detailed, highly practical, engaging lesson plan for a teacher.
Subject: ${subject}
Grade Level: ${gradeLevel}
Topic: ${topic}
Duration: ${duration}
Specific Goals/Notes: ${objectives || "Engaging hands-on activity, clear formative assessment"}

Format your response cleanly in Markdown with bold headers, bullet points, time breakdown, interactive activities, and an exit ticket.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt
    });
    res.json({ plan: response.text || "Failed to generate lesson plan." });
  } catch (error) {
    console.error("Lesson plan error:", error);
    res.status(500).json({ error: error.message || "Failed to generate lesson plan." });
  }
});
app2.post("/api/ai/parent-message", async (req, res) => {
  try {
    const { studentName, parentName, reason, tone = "professional & warm", details, teacherName = "Teacher" } = req.body;
    const ai = getGenAI();
    if (!ai) {
      let subjectLine = `Update regarding ${studentName}`;
      let bodyText = `Dear ${parentName || "Parent/Guardian"},

I hope this message finds you well. I am writing to share a brief update regarding ${studentName}.

${details || "We are tracking their progress in class and wanted to keep you informed."}

Please let me know if you have any questions or would like to arrange a brief call.

Warm regards,
${teacherName}
Classroom Teacher`;
      if (reason === "attendance") {
        subjectLine = `Attendance Notice: ${studentName}`;
        bodyText = `Dear ${parentName || "Parent/Guardian"},

I am reaching out regarding ${studentName}'s attendance in our class today. We missed having them with us and want to ensure they stay on track with our current lessons.

Please reply to let us know the reason for the absence and if we can provide any study materials.

Best regards,
${teacherName}`;
      } else if (reason === "praise") {
        subjectLine = `Positive Note: ${studentName}'s Outstanding Effort! \u{1F31F}`;
        bodyText = `Dear ${parentName || "Parent/Guardian"},

I wanted to take a quick moment to commend ${studentName} for their wonderful participation and effort in class recently! They demonstrated great enthusiasm and teamwork.

Thank you for your ongoing support at home!

Warmly,
${teacherName}`;
      }
      return res.json({ subject: subjectLine, message: bodyText });
    }
    const prompt = `You are an empathetic, professional teacher communicating with a student's parent/guardian.
Teacher Name: ${teacherName}
Student Name: ${studentName}
Parent Name: ${parentName || "Parent/Guardian"}
Type/Reason: ${reason} (e.g. attendance alert, academic praise, missing assignment, behavioral feedback, conference invitation)
Tone: ${tone}
Specific Notes: ${details || "None"}

Generate a JSON object with two fields:
"subject": A concise, clear email/SMS subject line
"message": The body of the message (ready to send, polite, constructive, with placeholders where needed).`;
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
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
        subject: `Update regarding ${studentName}`,
        message: response.text
      });
    }
  } catch (error) {
    console.error("Parent message error:", error);
    res.status(500).json({ error: error.message || "Failed to generate parent message." });
  }
});
app2.post("/api/ai/quiz-generator", async (req, res) => {
  try {
    const { topic, subject, gradeLevel, questionCount = 4, difficulty = "Medium" } = req.body;
    const ai = getGenAI();
    if (!ai) {
      return res.json({
        questions: [
          {
            id: "q1",
            question: `What is the primary function or principle of ${topic || "this topic"}?`,
            options: ["A core foundational process", "A secondary auxiliary factor", "An unrelated environmental condition", "A historical anomaly"],
            correctAnswer: "A core foundational process",
            explanation: `The foundational definition directly establishes how ${topic} operates in standard conditions.`
          },
          {
            id: "q2",
            question: `Which of the following best exemplifies ${topic || "this concept"} in practical application?`,
            options: ["Standard controlled experiment", "Unmonitored random variance", "Passive observation without metrics", "Isolated numerical calculation"],
            correctAnswer: "Standard controlled experiment",
            explanation: "Controlled experiments allow direct verification of key variables."
          },
          {
            id: "q3",
            question: `When analyzing key results in ${subject || "this subject"}, what should be evaluated first?`,
            options: ["Hypothesis and baseline data", "Final conclusion only", "External unsolicited opinions", "Random guesses"],
            correctAnswer: "Hypothesis and baseline data",
            explanation: "Baseline data provides the benchmark for assessing any statistical or empirical change."
          }
        ]
      });
    }
    const prompt = `Generate a ${questionCount}-question multiple-choice quiz on:
Subject: ${subject}
Grade Level: ${gradeLevel}
Topic: ${topic}
Difficulty: ${difficulty}

Return a valid JSON array of objects with the structure:
[
  {
    "id": "q1",
    "question": "question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "explanation": "Brief reasoning for the correct answer"
  }
]`;
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const parsed = JSON.parse(response.text || "[]");
    res.json({ questions: Array.isArray(parsed) ? parsed : parsed.questions || [] });
  } catch (error) {
    console.error("Quiz generator error:", error);
    res.status(500).json({ error: error.message || "Failed to generate quiz." });
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
