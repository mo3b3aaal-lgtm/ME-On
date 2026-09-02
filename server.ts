import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

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

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), hasApiKey: Boolean(process.env.GEMINI_API_KEY) });
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

// APK Download Endpoint
app.get(["/api/apk/download", "/TeacherManager.apk", "/download/TeacherManager.apk"], (_req, res) => {
  const apkPath = path.join(process.cwd(), "android/app/build/outputs/apk/debug/app-debug.apk");
  const fallbackPath = path.join(process.cwd(), "public/TeacherManager.apk");
  
  const fileToSend = fs.existsSync(apkPath) ? apkPath : fallbackPath;
  if (fs.existsSync(fileToSend)) {
    res.download(fileToSend, "TeacherManager.apk");
  } else {
    res.status(404).json({ error: "APK file not found. Please build it first." });
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
