import express from "express";
import { createServer as createViteServer } from "vite";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import db from "./src/db.ts";
import { generateSchedule } from "./src/scheduler.ts";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "default_secret";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Auth Middleware ---
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // --- Auth Routes ---
  app.post("/api/register", async (req, res) => {
    const { username, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
      const result = stmt.run(username, hashedPassword);
      res.status(201).json({ id: result.lastInsertRowid });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const user: any = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!user) return res.status(400).json({ error: "User not found" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username } });
  });

  // --- Subject Routes ---
  app.get("/api/subjects", authenticateToken, (req: any, res) => {
    const subjects = db.prepare("SELECT * FROM subjects WHERE user_id = ?").all(req.user.id);
    res.json(subjects);
  });

  app.post("/api/subjects", authenticateToken, (req: any, res) => {
    const { name, difficulty, exam_date, estimated_hours } = req.body;
    const stmt = db.prepare("INSERT INTO subjects (user_id, name, difficulty, exam_date, estimated_hours) VALUES (?, ?, ?, ?, ?)");
    const result = stmt.run(req.user.id, name, difficulty, exam_date, estimated_hours);
    res.status(201).json({ id: result.lastInsertRowid });
  });

  app.delete("/api/subjects/:id", authenticateToken, (req: any, res) => {
    db.prepare("DELETE FROM subjects WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.sendStatus(204);
  });

  // --- Schedule Routes ---
  app.get("/api/schedule", authenticateToken, (req: any, res) => {
    const plan = db.prepare(`
      SELECT sp.*, s.name as subject_name 
      FROM study_plan sp 
      JOIN subjects s ON sp.subject_id = s.id 
      WHERE sp.user_id = ?
      ORDER BY sp.date ASC
    `).all(req.user.id);
    res.json(plan);
  });

  app.post("/api/schedule/generate", authenticateToken, (req: any, res) => {
    const subjects: any[] = db.prepare("SELECT * FROM subjects WHERE user_id = ?").all(req.user.id);
    
    if (subjects.length === 0) {
      return res.status(400).json({ error: "No subjects found. Add some subjects first." });
    }

    // Map to internal Subject interface
    const mappedSubjects = subjects.map(s => ({
      id: s.id,
      name: s.name,
      difficulty: s.difficulty,
      examDate: s.exam_date,
      estimatedHours: s.estimated_hours
    }));

    const rawSchedule = generateSchedule(mappedSubjects, new Date());

    // Clear old plan
    db.prepare("DELETE FROM study_plan WHERE user_id = ?").run(req.user.id);

    // Insert new plan
    const insertStmt = db.prepare("INSERT INTO study_plan (user_id, subject_id, date, hours, type) VALUES (?, ?, ?, ?, ?)");
    const transaction = db.transaction((items) => {
      for (const item of items) {
        insertStmt.run(req.user.id, item.subjectId, item.date, item.hours, item.type);
      }
    });

    transaction(rawSchedule);

    res.json({ message: "Schedule generated successfully", count: rawSchedule.length });
  });

  // --- Progress Routes ---
  app.get("/api/progress", authenticateToken, (req: any, res) => {
    const stats = db.prepare(`
      SELECT 
        s.name, 
        s.estimated_hours,
        COALESCE(SUM(ss.hours_completed), 0) as completed_hours
      FROM subjects s
      LEFT JOIN study_sessions ss ON s.id = ss.subject_id
      WHERE s.user_id = ?
      GROUP BY s.id
    `).all(req.user.id);
    res.json(stats);
  });

  app.post("/api/sessions", authenticateToken, (req: any, res) => {
    const { subject_id, date, hours_completed } = req.body;
    const stmt = db.prepare("INSERT INTO study_sessions (user_id, subject_id, date, hours_completed) VALUES (?, ?, ?, ?)");
    stmt.run(req.user.id, subject_id, date, hours_completed);
    res.sendStatus(201);
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
