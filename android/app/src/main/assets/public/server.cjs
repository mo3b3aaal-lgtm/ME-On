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
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json());
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
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString(), hasApiKey: Boolean(process.env.GEMINI_API_KEY) });
});
var cloudUserStores = {};
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
        map.set(item.id, { ...existing, ...item });
      } else {
        map.set(item.id, item);
      }
    }
  }
  return Array.from(map.values());
}
app.post("/api/sync/push", (req, res) => {
  try {
    const { userId, dataPackage } = req.body;
    if (!userId || !dataPackage) {
      return res.status(400).json({ success: false, error: "Missing userId or dataPackage" });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const updatedPackage = {
      ...dataPackage,
      userId,
      lastSyncTime: now
    };
    cloudUserStores[userId] = updatedPackage;
    res.json({ success: true, lastSyncTime: now, stats: dataPackage.stats });
  } catch (error) {
    console.error("Sync push error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to push sync data" });
  }
});
app.get("/api/sync/pull/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId" });
    }
    const cloudData = cloudUserStores[userId];
    if (!cloudData) {
      return res.json({ success: true, hasCloudData: false, dataPackage: null });
    }
    res.json({ success: true, hasCloudData: true, dataPackage: cloudData });
  } catch (error) {
    console.error("Sync pull error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to pull sync data" });
  }
});
app.post("/api/sync/merge", (req, res) => {
  try {
    const { userId, dataPackage } = req.body;
    if (!userId || !dataPackage) {
      return res.status(400).json({ success: false, error: "Missing userId or dataPackage" });
    }
    const cloudData = cloudUserStores[userId];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (!cloudData) {
      const savedPackage = { ...dataPackage, userId, lastSyncTime: now };
      cloudUserStores[userId] = savedPackage;
      return res.json({ success: true, dataPackage: savedPackage, merged: false });
    }
    const mergedStudents = mergeEntities(dataPackage.students, cloudData.students);
    const mergedGroups = mergeEntities(dataPackage.groups, cloudData.groups);
    const mergedEnrollments = mergeEntities(dataPackage.enrollments, cloudData.enrollments);
    const mergedSessions = mergeEntities(dataPackage.sessions, cloudData.sessions);
    const mergedAttendance = mergeEntities(dataPackage.attendance, cloudData.attendance);
    const mergedPayments = mergeEntities(dataPackage.payments, cloudData.payments);
    const mergedCreditLogs = mergeEntities(dataPackage.creditLogs || [], cloudData.creditLogs || []);
    const mergedProfile = { ...cloudData.teacherProfile || {}, ...dataPackage.teacherProfile || {} };
    const mergedPackage = {
      version: "2.0",
      userId,
      lastSyncTime: now,
      students: mergedStudents,
      groups: mergedGroups,
      enrollments: mergedEnrollments,
      sessions: mergedSessions,
      attendance: mergedAttendance,
      payments: mergedPayments,
      creditLogs: mergedCreditLogs,
      teacherProfile: mergedProfile,
      stats: {
        totalStudents: mergedStudents.length,
        totalGroups: mergedGroups.length,
        totalSessions: mergedSessions.length,
        totalPayments: mergedPayments.length
      }
    };
    cloudUserStores[userId] = mergedPackage;
    res.json({ success: true, dataPackage: mergedPackage, merged: true });
  } catch (error) {
    console.error("Sync merge error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to merge sync data" });
  }
});
app.post("/api/ai/lesson-plan", async (req, res) => {
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
app.post("/api/ai/parent-message", async (req, res) => {
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
app.post("/api/ai/copilot", async (req, res) => {
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
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Teacher Manager server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
