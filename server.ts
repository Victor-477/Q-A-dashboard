import "dotenv/config";
import express from "express";
import path from "path";
import { randomUUID } from "crypto";
import { networkInterfaces } from "os";
import { createServer as createViteServer } from "vite";

interface Question {
  id: string;
  topicNumber: number;
  studentName: string;
  text: string;
  answer?: string;
  answeredBy?: string;
  createdAt: string;
  answeredAt?: string;
}

const questions: Question[] = [];
let clients: express.Response[] = [];
const teacherSessions = new Map<string, { name?: string; createdAt: number }>();

// Edit this list manually to define one or more teacher passwords.
// You can also override it with an environment variable: TEACHER_PASSWORDS="password1,password2"
const TEACHER_PASSWORDS = (process.env.TEACHER_PASSWORDS ?? "professor123")
  .split(",")
  .map(password => password.trim())
  .filter(Boolean);

function normalizeName(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function getTeacherSession(req: express.Request) {
  const authHeader = req.header("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return teacherSessions.get(token) ?? null;
}

async function startServer() {
  const app = express();
  const preferredPort = getPreferredPort(process.env.PORT);
  const HOST = process.env.HOST ?? "0.0.0.0";

  app.use(express.json());

  // Subscribe to real-time events via SSE
  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    clients.push(res);
    
    // Send initial active questions immediately
    res.write(`event: init\ndata: ${JSON.stringify(questions)}\n\n`);

    req.on("close", () => {
      clients = clients.filter(c => c !== res);
    });
  });

  const notifyClients = (event: string, data: any) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach(client => client.write(payload));
  };

  app.post("/api/teacher/login", (req, res) => {
    const { password } = req.body;
    const teacherName = normalizeName(req.body.name);

    if (typeof password !== "string" || !TEACHER_PASSWORDS.includes(password)) {
      res.status(401).json({ error: "Invalid teacher password" });
      return;
    }

    const token = randomUUID();
    teacherSessions.set(token, {
      name: teacherName || undefined,
      createdAt: Date.now()
    });

    res.json({ token, name: teacherName || "" });
  });

  app.post("/api/teacher/logout", (req, res) => {
    const authHeader = req.header("authorization") ?? "";
    const [, token] = authHeader.split(" ");

    if (token) {
      teacherSessions.delete(token);
    }

    res.status(204).send();
  });

  // REST endpoints
  app.get("/api/questions", (req, res) => {
    res.json(questions);
  });

  app.post("/api/questions", (req, res) => {
    const { topicNumber, text } = req.body;
    const studentName = normalizeName(req.body.studentName);
    
    if (
      typeof topicNumber !== 'number' ||
      !Number.isFinite(topicNumber) ||
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 500 ||
      !studentName
    ) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    const newQuestion: Question = {
      id: Math.random().toString(36).substring(2, 9),
      topicNumber,
      studentName,
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    questions.push(newQuestion);
    notifyClients("new_question", newQuestion);
    
    res.status(201).json(newQuestion);
  });

  app.post("/api/questions/:id/answer", (req, res) => {
    const teacherSession = getTeacherSession(req);
    if (!teacherSession) {
      res.status(401).json({ error: "Teacher access is required" });
      return;
    }

    const { id } = req.params;
    const { answer } = req.body;

    const queryIdx = questions.findIndex(q => q.id === id);
    if (queryIdx === -1) {
      res.status(404).json({ error: "Question not found" });
      return;
    }

    if (typeof answer !== "string" || !answer.trim() || answer.length > 1000) {
      res.status(400).json({ error: "Invalid answer" });
      return;
    }

    questions[queryIdx] = {
      ...questions[queryIdx],
      answer: answer.trim(),
      answeredBy: teacherSession.name || undefined,
      answeredAt: new Date().toISOString()
    };
    notifyClients("question_answered", questions[queryIdx]);

    res.json(questions[queryIdx]);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = await listenWithFallback(app, preferredPort, HOST);
  logAvailableUrls(port);
}

startServer();

function getPreferredPort(value: string | undefined) {
  const port = Number(value ?? 3000);

  if (Number.isInteger(port) && port > 0 && port <= 65535) {
    return port;
  }

  console.warn(`Invalid PORT "${value}", falling back to 3000.`);
  return 3000;
}

function listen(app: express.Express, port: number, host: string) {
  return new Promise<number>((resolve, reject) => {
    const server = app.listen(port, host);

    server.once("listening", () => {
      server.off("error", reject);
      resolve(port);
    });

    server.once("error", reject);
  });
}

async function listenWithFallback(app: express.Express, preferredPort: number, host: string) {
  const ports = Array.from({ length: 20 }, (_, index) => preferredPort + index);

  for (const port of ports) {
    try {
      return await listen(app, port, host);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") {
        throw error;
      }

      console.warn(`Port ${port} is already in use, trying ${port + 1}...`);
    }
  }

  throw new Error(`No available port found between ${preferredPort} and ${preferredPort + ports.length - 1}`);
}

function getLanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((details): details is NonNullable<typeof details> => Boolean(details))
    .filter(details => details.family === "IPv4" && !details.internal)
    .map(details => details.address);
}

function logAvailableUrls(port: number) {
  const urls = [
    `Local:   http://localhost:${port}`,
    ...getLanAddresses().map(address => `Network: http://${address}:${port}`)
  ];

  console.log("Server running:");
  urls.forEach(url => console.log(`  ${url}`));
  console.log("Interfaces:");
  console.log("  Student: /student");
  console.log("  Teacher: /teacher");
  console.log("  Legacy routes still work: /aluno and /professor");
}
