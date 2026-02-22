import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("learning_platform.db");
db.pragma('foreign_keys = ON');
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    points INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    description TEXT,
    deadline DATETIME,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    team_id INTEGER, -- Added for team sharing
    title TEXT,
    content TEXT,
    is_public INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(team_id) REFERENCES teams(id)
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    created_by INTEGER,
    FOREIGN KEY(created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS team_members (
    team_id INTEGER,
    user_id INTEGER,
    PRIMARY KEY(team_id, user_id),
    FOREIGN KEY(team_id) REFERENCES teams(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    receiver_id INTEGER, -- NULL if team message
    team_id INTEGER,     -- NULL if direct message
    content TEXT,
    file_url TEXT,       -- Added for file uploads
    file_name TEXT,      -- Added for file uploads
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id),
    FOREIGN KEY(team_id) REFERENCES teams(id)
  );

  CREATE TABLE IF NOT EXISTS study_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    content TEXT,
    type TEXT, -- 'weekly' or 'monthly'
    start_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });
  const PORT = 3000;

  app.use(express.json());

  // Auth Middleware
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

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    const { username, email, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)");
      const result = stmt.run(username, email, hashedPassword);
      const token = jwt.sign({ id: result.lastInsertRowid, username }, JWT_SECRET);
      res.json({ token, user: { id: result.lastInsertRowid, username, email, points: 0 } });
    } catch (e) {
      res.status(400).json({ error: "Username or email already exists" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, points: user.points } });
  });

  // Tasks API
  app.get("/api/tasks", authenticateToken, (req: any, res) => {
    const tasks = db.prepare("SELECT * FROM tasks WHERE user_id = ?").all(req.user.id);
    res.json(tasks);
  });

  app.post("/api/tasks", authenticateToken, (req: any, res) => {
    const { title, description, deadline } = req.body;
    const stmt = db.prepare("INSERT INTO tasks (user_id, title, description, deadline) VALUES (?, ?, ?, ?)");
    const result = stmt.run(req.user.id, title, description, deadline);
    res.json({ id: result.lastInsertRowid, title, description, deadline, status: 'pending' });
  });

  app.patch("/api/tasks/:id", authenticateToken, (req: any, res) => {
    const { status } = req.body;
    const stmt = db.prepare("UPDATE tasks SET status = ? WHERE id = ? AND user_id = ?");
    stmt.run(status, req.params.id, req.user.id);
    res.json({ success: true });
  });

  app.delete("/api/tasks/:id", authenticateToken, (req: any, res) => {
    const taskId = parseInt(req.params.id);
    console.log(`Deleting task ${taskId} for user ${req.user.id}`);
    const stmt = db.prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?");
    const result = stmt.run(taskId, req.user.id);
    console.log(`Task deletion result:`, result);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Task not found or unauthorized" });
    }
    res.json({ success: true });
  });

  // Notes API
  app.get("/api/notes", authenticateToken, (req: any, res) => {
    const notes = db.prepare(`
      SELECT n.*, u.username as author FROM notes n
      JOIN users u ON n.user_id = u.id
      WHERE n.user_id = ? 
      OR n.is_public = 1 
      OR n.team_id IN (SELECT team_id FROM team_members WHERE user_id = ?)
    `).all(req.user.id, req.user.id);
    res.json(notes);
  });

  app.post("/api/notes", authenticateToken, (req: any, res) => {
    const { title, content, is_public, team_id } = req.body;
    const stmt = db.prepare("INSERT INTO notes (user_id, title, content, is_public, team_id) VALUES (?, ?, ?, ?, ?)");
    const result = stmt.run(req.user.id, title, content, is_public ? 1 : 0, team_id || null);
    res.json({ id: result.lastInsertRowid, title, content, is_public, team_id });
  });

  // Teams API
  app.get("/api/teams", authenticateToken, (req: any, res) => {
    const teams = db.prepare(`
      SELECT t.* FROM teams t
      JOIN team_members tm ON t.id = tm.team_id
      WHERE tm.user_id = ?
    `).all(req.user.id);
    res.json(teams);
  });

  app.get("/api/teams/:id/members", authenticateToken, (req: any, res) => {
    const members = db.prepare(`
      SELECT u.id, u.username, u.email FROM users u
      JOIN team_members tm ON u.id = tm.user_id
      WHERE tm.team_id = ?
    `).all(req.params.id);
    res.json(members);
  });

  app.post("/api/teams/:id/members", authenticateToken, (req: any, res) => {
    const { username } = req.body;
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as any;
    if (!user) return res.status(404).json({ error: "User not found" });
    
    try {
      db.prepare("INSERT INTO team_members (team_id, user_id) VALUES (?, ?)").run(req.params.id, user.id);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "User already in team" });
    }
  });

  app.get("/api/users/search", authenticateToken, (req: any, res) => {
    const { q } = req.query;
    const users = db.prepare("SELECT id, username FROM users WHERE username LIKE ? AND id != ? LIMIT 10")
      .all(`%${q}%`, req.user.id);
    res.json(users);
  });

  app.post("/api/teams", authenticateToken, (req: any, res) => {
    const { name } = req.body;
    try {
      const createTeam = db.transaction(() => {
        const stmt = db.prepare("INSERT INTO teams (name, created_by) VALUES (?, ?)");
        const result = stmt.run(name, req.user.id);
        const teamId = result.lastInsertRowid;
        db.prepare("INSERT INTO team_members (team_id, user_id) VALUES (?, ?)").run(teamId, req.user.id);
        return teamId;
      });
      const teamId = createTeam();
      res.json({ id: teamId, name, created_by: req.user.id });
    } catch (e) {
      res.status(400).json({ error: "Team name already exists" });
    }
  });

  app.post("/api/teams/:id/leave", authenticateToken, (req: any, res) => {
    db.prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?").run(req.params.id, req.user.id);
    res.json({ success: true });
  });

  app.delete("/api/teams/:id", authenticateToken, (req: any, res) => {
    const teamId = parseInt(req.params.id);
    console.log(`[DELETE TEAM] Attempting to delete team ${teamId} by user ${req.user.id}`);
    
    try {
      const team = db.prepare("SELECT created_by FROM teams WHERE id = ?").get(teamId) as any;
      if (!team) {
        console.log(`[DELETE TEAM] Team ${teamId} not found`);
        return res.status(404).json({ error: "Team not found" });
      }
      
      if (team.created_by !== req.user.id) {
        console.log(`[DELETE TEAM] User ${req.user.id} is not the creator of team ${teamId} (creator is ${team.created_by})`);
        return res.status(403).json({ error: "Only the creator can delete the team" });
      }

      const deleteTeamTx = db.transaction((id: number) => {
        const members = db.prepare("DELETE FROM team_members WHERE team_id = ?").run(id);
        const messages = db.prepare("DELETE FROM messages WHERE team_id = ?").run(id);
        const notes = db.prepare("DELETE FROM notes WHERE team_id = ?").run(id);
        const team = db.prepare("DELETE FROM teams WHERE id = ?").run(id);
        
        return {
          members: members.changes,
          messages: messages.changes,
          notes: notes.changes,
          team: team.changes
        };
      });
      
      const results = deleteTeamTx(teamId);
      console.log(`[DELETE TEAM] Deletion results for team ${teamId}:`, results);

      if (results.team === 0) {
        console.log(`[DELETE TEAM] Failed to delete team ${teamId} from teams table`);
        return res.status(500).json({ error: "Failed to delete team record" });
      }

      res.json({ success: true, details: results });
    } catch (error: any) {
      console.error(`[DELETE TEAM] Error deleting team ${teamId}:`, error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Study Plans API
  app.get("/api/study-plans", authenticateToken, (req: any, res) => {
    const plans = db.prepare("SELECT * FROM study_plans WHERE user_id = ? ORDER BY start_date DESC").all(req.user.id);
    res.json(plans);
  });

  app.post("/api/study-plans", authenticateToken, (req: any, res) => {
    const { title, content, type, start_date } = req.body;
    const stmt = db.prepare("INSERT INTO study_plans (user_id, title, content, type, start_date) VALUES (?, ?, ?, ?, ?)");
    const result = stmt.run(req.user.id, title, content, type, start_date);
    res.json({ id: result.lastInsertRowid, title, content, type, start_date });
  });

  // Messages API (History)
  app.get("/api/messages", authenticateToken, (req: any, res) => {
    const { teamId, receiverId } = req.query;
    let messages;
    if (teamId) {
      messages = db.prepare(`
        SELECT m.*, u.username as senderName FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.team_id = ?
        ORDER BY m.created_at ASC
      `).all(teamId);
    } else if (receiverId) {
      messages = db.prepare(`
        SELECT m.*, u.username as senderName FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE (m.sender_id = ? AND m.receiver_id = ?)
        OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.created_at ASC
      `).all(req.user.id, receiverId, receiverId, req.user.id);
    } else {
      return res.status(400).json({ error: "Missing teamId or receiverId" });
    }
    res.json(messages);
  });

  // WebSocket for real-time chat
  const clients = new Map<number, WebSocket>();

  wss.on("connection", (ws, req) => {
    let userId: number | null = null;

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());
      
      if (message.type === "auth") {
        try {
          const decoded = jwt.verify(message.token, JWT_SECRET) as any;
          userId = decoded.id;
          clients.set(userId!, ws);
        } catch (e) {}
      }

      if (message.type === "chat" && userId) {
        const { teamId, content, receiverId } = message;
        const stmt = db.prepare("INSERT INTO messages (sender_id, team_id, receiver_id, content) VALUES (?, ?, ?, ?)");
        const result = stmt.run(userId, teamId || null, receiverId || null, content);
        
        const user = db.prepare("SELECT username FROM users WHERE id = ?").get(userId) as any;
        
        const broadcastMsg = JSON.stringify({
          type: "chat",
          id: result.lastInsertRowid,
          senderId: userId,
          senderName: user.username,
          teamId,
          receiverId,
          content,
          createdAt: new Date().toISOString()
        });

        if (teamId) {
          const members = db.prepare("SELECT user_id FROM team_members WHERE team_id = ?").all(teamId) as any[];
          members.forEach(m => {
            const client = clients.get(m.user_id);
            if (client && client.readyState === WebSocket.OPEN) {
              client.send(broadcastMsg);
            }
          });
        } else if (receiverId) {
          [userId, receiverId].forEach(id => {
            const client = clients.get(id);
            if (client && client.readyState === WebSocket.OPEN) {
              client.send(broadcastMsg);
            }
          });
        }
      }
    });

    ws.on("close", () => {
      if (userId) clients.delete(userId);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
