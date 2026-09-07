import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import {
  registerOrAuthenticateUser,
  authenticateUser,
  registerUser,
  resetUserPasswordInFirestore,
  getUserByToken,
  getUserById,
  getCloudDataPackage,
  saveCloudDataPackage,
  mergeCloudDataPackage,
  ServerUser,
} from "./server/db";

dotenv.config();

const app = express();
const PORT = 3000;

// Enable CORS so Android Capacitor APK (https://localhost, capacitor://localhost, etc.) can reach the server APIs
app.use(
  cors({
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
      "Expires",
    ],
  })
);

app.options("*", cors());

app.use(express.json({ limit: "50mb" }));

// Initialize Gemini Client safely
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check and Database Status
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    database: "Firebase Firestore (Project: corded-elevator-cf6jr)",
    timestamp: new Date().toISOString(),
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Authentication Middleware: Strictly verifies identity via token, NEVER trusting client-supplied userId
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
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
        error: "Unauthorized: Missing authentication token.",
      });
    }

    const user = await getUserByToken(token);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid or expired authentication session token.",
      });
    }

    (req as any).user = user;
    next();
  } catch (err: any) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ success: false, error: "Internal authentication error" });
  }
}

// Dedicated Server-Authoritative Auth Endpoints
app.post("/api/auth/login", async (req, res) => {
  try {
    const rawBody = req.body || {};
    const bodyKeys = Object.keys(rawBody);
    const identifier = rawBody.identifier || rawBody.email || rawBody.phone || rawBody.id || rawBody.username;
    const hasPassword = Boolean(rawBody.password);

    // Determine identifier type for diagnostics
    let idType = "unknown";
    if (rawBody.email || (identifier && identifier.includes("@"))) {
      idType = "email";
    } else if (rawBody.phone || (identifier && /^[0-9+\s()-]+$/.test(identifier))) {
      idType = "phone";
    } else if (rawBody.id || (identifier && identifier.startsWith("acc_"))) {
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
      userAgent: req.headers["user-agent"],
    });

    if (!identifier) {
      console.warn(`[Auth Diagnostic] Login failed: Missing identifier in request body.`);
      return res.status(400).json({
        success: false,
        error: "يرجى إدخال البريد الإلكتروني أو رقم الهاتف",
        diagnostic: { reason: "MISSING_IDENTIFIER", receivedKeys: bodyKeys },
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
        subject: (user as any).subject || "عام",
        centerOrSchool: (user as any).centerOrSchool || "",
        recoveryPin: user.recovery_pin || "123456",
        createdAt: user.created_at,
        lastLoginAt: user.updated_at,
      },
    });
  } catch (error: any) {
    console.warn(`[Auth Diagnostic] Authentication failed:`, {
      message: error.message,
      code: error.code || "AUTH_FAILED",
      stack: error.stack?.split("\n").slice(0, 3).join(" | "),
    });
    res.status(401).json({
      success: false,
      error: error.message || "فشل تسجيل الدخول",
      errorCode: error.code || "AUTHENTICATION_FAILED",
      diagnostic: {
        errorMessage: error.message,
        errorName: error.name,
        errorCode: error.code,
      },
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
    const subject = rawBody.subject || "عام";
    const centerOrSchool = rawBody.centerOrSchool || rawBody.center_or_school || "";
    const recoveryPin = rawBody.recoveryPin || rawBody.recovery_pin || "123456";
    const id = rawBody.id;

    const missingFields: string[] = [];
    if (!name) missingFields.push("name (اسم المعلم)");
    if (!email && !phone) missingFields.push("email or phone (البريد الإلكتروني أو الهاتف)");
    if (!password) {
      missingFields.push("password (كلمة المرور)");
    } else if (String(password).length < 4) {
      missingFields.push("password_too_short (كلمة المرور يجب ألا تقل عن 4 أحرف)");
    }

    console.log(`[Auth Diagnostic - REGISTER Request]`, {
      receivedFields,
      hasName: Boolean(name),
      hasEmail: Boolean(email),
      hasPhone: Boolean(phone),
      hasPassword: Boolean(password),
      missingFields,
      clientIp: req.ip || req.headers["x-forwarded-for"],
    });

    if (missingFields.length > 0) {
      const firstMissing = missingFields[0];
      return res.status(400).json({
        success: false,
        error: `Missing field: ${firstMissing}`,
        errorCode: "VALIDATION_FAILED",
        missingFields,
        receivedFields,
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
      recoveryPin,
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
        subject: (user as any).subject || "عام",
        centerOrSchool: (user as any).centerOrSchool || "",
        recoveryPin: user.recovery_pin || "123456",
        createdAt: user.created_at,
        lastLoginAt: user.updated_at,
      },
    });
  } catch (error: any) {
    console.error(`[Auth API /api/auth/register] Registration error:`, error);
    res.status(400).json({
      success: false,
      error: error.message || "فشل إنشاء الحساب",
      errorCode: error.code || "REGISTRATION_FAILED",
    });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { identifier, newPassword, recoveryPin } = req.body;
    const result = await resetUserPasswordInFirestore(identifier, newPassword, recoveryPin);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || "فشل استعادة كلمة المرور" });
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
      name: name || "معلم",
      phone,
      password,
      recoveryPin,
    });

    res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error: any) {
    console.error("Auth sync error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to authenticate session" });
  }
});

// 1. Cloud Sync Push (Persists directly into Firebase Firestore)
app.post("/api/sync/push", requireAuth, async (req, res) => {
  try {
    const authenticatedUserId = (req as any).user.id;
    const { dataPackage } = req.body;
    if (!dataPackage) {
      return res.status(400).json({ success: false, error: "Missing dataPackage" });
    }

    const result = await saveCloudDataPackage(authenticatedUserId, dataPackage);
    res.json({ success: true, lastSyncTime: result.lastSyncTime, stats: result.stats });
  } catch (error: any) {
    console.error("Sync push error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to push sync data" });
  }
});

// 2. Cloud Sync Pull (Reads strictly authenticated user's data from Firebase Firestore)
app.get("/api/sync/pull", requireAuth, async (req, res) => {
  try {
    const authenticatedUserId = (req as any).user.id;
    const cloudData = await getCloudDataPackage(authenticatedUserId);
    if (!cloudData) {
      return res.json({ success: true, hasCloudData: false, dataPackage: null });
    }

    res.json({ success: true, hasCloudData: true, dataPackage: cloudData });
  } catch (error: any) {
    console.error("Sync pull error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to pull sync data" });
  }
});

// Compatibility route for legacy pull with param (still strictly enforced by requireAuth)
app.get("/api/sync/pull/:userId", requireAuth, async (req, res) => {
  try {
    const authenticatedUserId = (req as any).user.id;
    const cloudData = await getCloudDataPackage(authenticatedUserId);
    if (!cloudData) {
      return res.json({ success: true, hasCloudData: false, dataPackage: null });
    }

    res.json({ success: true, hasCloudData: true, dataPackage: cloudData });
  } catch (error: any) {
    console.error("Sync pull error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to pull sync data" });
  }
});

// 3. Bi-directional Safe Merge Sync (Atomically merges & persists into Firebase Firestore)
app.post("/api/sync/merge", requireAuth, async (req, res) => {
  try {
    const authenticatedUserId = (req as any).user.id;
    const { dataPackage } = req.body;
    if (!dataPackage) {
      return res.status(400).json({ success: false, error: "Missing dataPackage" });
    }

    const result = await mergeCloudDataPackage(authenticatedUserId, dataPackage);
    res.json({ success: true, dataPackage: result.dataPackage, merged: result.merged });
  } catch (error: any) {
    console.error("Sync merge error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to merge sync data" });
  }
});

// AI Lesson Plan Generator
app.post("/api/ai/lesson-plan", async (req, res) => {
  try {
    const { topic, subject, gradeLevel, duration = "45 mins", objectives } = req.body;
    const ai = getGenAI();

    if (!ai) {
      // High-quality smart fallback
      return res.json({
        plan: `# Lesson Plan: ${topic || "Core Principles"}
**Subject:** ${subject || "General Science"} | **Grade Level:** ${gradeLevel || "Grade 10"} | **Duration:** ${duration}

## 🎯 Learning Objectives
- Students will understand the fundamental concepts of ${topic || "the topic"}.
- Students will identify 3 key practical applications in real-world scenarios.
- Students will collaborate in pairs to analyze and present a 2-minute solution.

## ⏱️ Lesson Structure
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

## 💡 Differentiated Learning Support
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
      contents: prompt,
    });

    res.json({ plan: response.text || "Failed to generate lesson plan." });
  } catch (error: any) {
    console.error("Lesson plan error:", error);
    res.status(500).json({ error: error.message || "Failed to generate lesson plan." });
  }
});

// AI Parent Message Drafter
app.post("/api/ai/parent-message", async (req, res) => {
  try {
    const { studentName, parentName, reason, tone = "professional & warm", details, teacherName = "Teacher" } = req.body;
    const ai = getGenAI();

    if (!ai) {
      let subjectLine = `Update regarding ${studentName}`;
      let bodyText = `Dear ${parentName || "Parent/Guardian"},\n\nI hope this message finds you well. I am writing to share a brief update regarding ${studentName}.\n\n${details || "We are tracking their progress in class and wanted to keep you informed."}\n\nPlease let me know if you have any questions or would like to arrange a brief call.\n\nWarm regards,\n${teacherName}\nClassroom Teacher`;

      if (reason === "attendance") {
        subjectLine = `Attendance Notice: ${studentName}`;
        bodyText = `Dear ${parentName || "Parent/Guardian"},\n\nI am reaching out regarding ${studentName}'s attendance in our class today. We missed having them with us and want to ensure they stay on track with our current lessons.\n\nPlease reply to let us know the reason for the absence and if we can provide any study materials.\n\nBest regards,\n${teacherName}`;
      } else if (reason === "praise") {
        subjectLine = `Positive Note: ${studentName}'s Outstanding Effort! 🌟`;
        bodyText = `Dear ${parentName || "Parent/Guardian"},\n\nI wanted to take a quick moment to commend ${studentName} for their wonderful participation and effort in class recently! They demonstrated great enthusiasm and teamwork.\n\nThank you for your ongoing support at home!\n\nWarmly,\n${teacherName}`;
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
        responseMimeType: "application/json",
      },
    });

    try {
      const parsed = JSON.parse(response.text || "{}");
      res.json(parsed);
    } catch {
      res.json({
        subject: `Update regarding ${studentName}`,
        message: response.text,
      });
    }
  } catch (error: any) {
    console.error("Parent message error:", error);
    res.status(500).json({ error: error.message || "Failed to generate parent message." });
  }
});

// AI Quiz / Test Question Generator
app.post("/api/ai/quiz-generator", async (req, res) => {
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
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "[]");
    res.json({ questions: Array.isArray(parsed) ? parsed : parsed.questions || [] });
  } catch (error: any) {
    console.error("Quiz generator error:", error);
    res.status(500).json({ error: error.message || "Failed to generate quiz." });
  }
});

// AI Student Evaluation / Report Card Comment
app.post("/api/ai/student-remark", async (req, res) => {
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
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("Student remark error:", error);
    res.status(500).json({ error: error.message || "Failed to generate student remark." });
  }
});

// General AI Classroom Copilot
app.post("/api/ai/copilot", async (req, res) => {
  try {
    const { prompt, context } = req.body;
    const ai = getGenAI();

    if (!ai) {
      return res.json({
        response: `As an AI Teacher Assistant, here are actionable recommendations for "${prompt}":\n\n1. **Structured Engagement:** Use tiered questions (recall, application, analysis) to involve all learning styles.\n2. **Clear Feedback Loops:** Provide immediate formative feedback using rubrics or peer reviews.\n3. **Classroom Flow:** Establish transparent routines with 2-minute transition timers.\n\n*Note: Add a GEMINI_API_KEY in Settings > Secrets for real-time live generative responses.*`
      });
    }

    const systemInstruction = "You are 'Teacher Manager Copilot', an expert K-12 educator, classroom management coach, and instructional designer. Provide clear, direct, actionable, practical, and empathetic advice to help teachers save time, engage students, and resolve classroom challenges.";

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: `${context ? `Context: ${context}\n\n` : ""}Teacher Question: ${prompt}`,
      config: {
        systemInstruction,
      },
    });

    res.json({ response: response.text || "No response received." });
  } catch (error: any) {
    console.error("Copilot error:", error);
    res.status(500).json({ error: error.message || "Failed to consult copilot." });
  }
});

// Vite Middleware for Development & Production Static Handling
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Teacher Manager server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
