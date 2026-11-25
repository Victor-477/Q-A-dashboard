import "dotenv/config";
import express from "express";
import fs from "fs";
import http from "http";
import https from "https";
import path from "path";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";
import {
  Question,
  TeacherSession,
  archiveActiveQuestions,
  countStoredQuestions,
  deleteSession,
  findSession,
  initDatabase,
  insertQuestion,
  insertSession,
  loadActiveQuestions,
  loadAllQuestions,
  purgeExpiredSessions,
  readSetting,
  updateAnswer,
  writeSetting
} from "./db";
import { ensureCertificate, getLanAddresses, isTlsEnabled } from "./tls";
import { isTranslationEnabled, translateBatch, translationProviderHost } from "./translate";

// In-memory mirror of the active board. SQLite is the source of truth; this
// array is a read cache so SSE fan-out and stats stay allocation-free.
let questions: Question[] = [];
const clients = new Set<express.Response>();

/**
 * How long a teacher stays logged in. Sessions outlive a restart (they are in
 * SQLite) but not a school day, so an abandoned token stops working by itself.
 */
const SESSION_TTL_MS = Number(process.env.QA_SESSION_TTL_HOURS ?? 12) * 60 * 60 * 1000;

/**
 * Accepted teacher passwords.
 *
 * There is deliberately no password in the source. TEACHER_PASSWORDS wins when
 * set; otherwise one is generated on first run, stored in the database and
 * printed at startup, so every install has a different secret.
 */
let TEACHER_PASSWORDS: string[] = [];

function parsePasswords(raw: string) {
  return raw
    .split(",")
    .map(password => password.trim())
    .filter(Boolean);
}

/** Readable, high-entropy password: 4 groups of 4 (~62 bits). */
function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alike characters
  const bytes = randomBytes(16);
  const chars = [...bytes].map(byte => alphabet[byte % alphabet.length]);
  return [0, 4, 8, 12].map(start => chars.slice(start, start + 4).join("")).join("-");
}

function resolveTeacherPasswords() {
  const fromEnv = parsePasswords(process.env.TEACHER_PASSWORDS ?? "");
  if (fromEnv.length > 0) {
    TEACHER_PASSWORDS = fromEnv;
    return { passwords: fromEnv, generated: false };
  }

  const stored = readSetting("teacher_password");
  if (stored) {
    TEACHER_PASSWORDS = [stored];
    return { passwords: [stored], generated: false };
  }

  const created = generatePassword();
  writeSetting("teacher_password", created);
  TEACHER_PASSWORDS = [created];
  return { passwords: [created], generated: true };
}

function normalizeName(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

// The Electron dashboard is the local operator: it spawned this process, so it
// gets a per-run token instead of a teacher password. Exports accept either.
const EXPORT_TOKEN = process.env.QA_EXPORT_TOKEN?.trim() ?? "";

function getBearerToken(req: express.Request) {
  const [scheme, token] = (req.header("authorization") ?? "").split(" ");
  return scheme === "Bearer" && token ? token : null;
}

/**
 * Constant-time membership test, so the time taken to reject a wrong password
 * does not reveal how much of it was correct.
 */
function timingSafeIncludes(candidates: string[], value: string) {
  const supplied = Buffer.from(value);
  let matched = false;

  for (const candidate of candidates) {
    const expected = Buffer.from(candidate);
    // timingSafeEqual throws on length mismatch, which would itself leak the
    // length, so compare fixed-size digests of equal length instead.
    const a = createHash("sha256").update(supplied).digest();
    const b = createHash("sha256").update(expected).digest();
    if (timingSafeEqual(a, b)) {
      matched = true;
    }
  }

  return matched;
}

function isExportAuthorized(req: express.Request) {
  if (getTeacherSession(req)) {
    return true;
  }

  return Boolean(EXPORT_TOKEN) && getBearerToken(req) === EXPORT_TOKEN;
}

function getTeacherSession(req: express.Request): TeacherSession | null {
  const token = getBearerToken(req);
  return token ? findSession(token) : null;
}

async function startServer() {
  const app = express();
  const preferredPort = getPreferredPort(process.env.PORT);
  const HOST = process.env.HOST ?? "0.0.0.0";

  // Restore the board before accepting connections, so the first SSE client
  // already receives the questions from before the restart.
  const databaseFile = initDatabase();
  questions = loadActiveQuestions();
  console.log(`[server] Database: ${databaseFile}`);
  console.log(`[server] Restored ${questions.length} active question(s), ${countStoredQuestions()} stored in total.`);

  const { passwords, generated } = resolveTeacherPasswords();
  if (generated) {
    console.log("");
    console.log("  ┌──────────────────────────────────────────────┐");
    console.log("  │  TEACHER PASSWORD (generated on first run)   │");
    console.log(`  │           ${passwords[0].padEnd(35)}│`);
    console.log("  │  Change it in the dashboard or with          │");
    console.log("  │  TEACHER_PASSWORDS in the environment.       │");
    console.log("  └──────────────────────────────────────────────┘");
    console.log("");
  } else {
    console.log(`[server] Teacher password: ${passwords.length} configured (not shown).`);
  }

  // Old sessions are dropped at boot and hourly thereafter, so the table does
  // not accumulate tokens from past classes.
  const purged = purgeExpiredSessions();
  if (purged > 0) {
    console.log(`[server] Purged ${purged} expired teacher session(s).`);
  }
  setInterval(() => {
    try {
      purgeExpiredSessions();
    } catch (error) {
      console.error("Failed to purge expired sessions:", error);
    }
  }, 60 * 60 * 1000).unref();

  if (isTranslationEnabled()) {
    console.log(`[server] Translation provider: ${translationProviderHost()}`);
  } else {
    console.log("[server] Translation: disabled (set QA_TRANSLATE_URL to enable).");
  }

  // Increase payload limit for large sessions
  app.use(express.json({ limit: "1mb" }));

  // Disable ETag generation for better throughput under high concurrency
  app.set("etag", false);

  // Subscribe to real-time events via SSE
  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable proxy buffering (nginx)

    // Disable Nagle algorithm for low-latency SSE delivery
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true, 30000);

    clients.add(res);

    // Send initial active questions immediately
    res.write(`event: init\ndata: ${JSON.stringify(questions)}\n\n`);

    req.on("close", () => {
      clients.delete(res);
    });
  });

  // Heartbeat: send a comment every 30s to keep SSE connections alive
  setInterval(() => {
    const beat = `:heartbeat ${Date.now()}\n\n`;
    for (const client of clients) {
      try {
        client.write(beat);
      } catch {
        clients.delete(client);
      }
    }
  }, 30_000);

  const notifyClients = (event: string, data: any) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) {
      try {
        client.write(payload);
      } catch {
        clients.delete(client);
      }
    }
  };

  app.post("/api/teacher/login", (req, res) => {
    const { password } = req.body;
    const teacherName = normalizeName(req.body.name);

    if (typeof password !== "string" || !timingSafeIncludes(TEACHER_PASSWORDS, password)) {
      res.status(401).json({ error: "Invalid teacher password" });
      return;
    }

    const now = Date.now();
    const session: TeacherSession = {
      token: randomUUID(),
      name: teacherName || undefined,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString()
    };

    insertSession(session);

    res.json({ token: session.token, name: teacherName || "", expiresAt: session.expiresAt });
  });

  app.post("/api/teacher/logout", (req, res) => {
    const token = getBearerToken(req);

    if (token) {
      deleteSession(token);
    }

    res.status(204).send();
  });

  // REST endpoints
  app.get("/api/stats", (req, res) => {
    res.json({
      connectedClients: clients.size,
      totalQuestions: questions.length,
      answeredQuestions: questions.filter(q => q.answer).length,
      pendingQuestions: questions.filter(q => !q.answer).length,
      storedQuestions: countStoredQuestions()
    });
  });

  app.get("/api/config", (req, res) => {
    // Translation now happens on the server, so the client only needs to know
    // whether asking for it is worthwhile at all.
    res.json({
      enableAutoTranslate: isTranslationEnabled() && process.env.ENABLE_AUTO_TRANSLATE !== "false"
    });
  });

  /**
   * Translates a batch of strings through the configured provider.
   *
   * Clients used to call an undocumented Google endpoint directly, which leaked
   * the class's questions from every student device. Routing it here means one
   * request per distinct string for the whole room, a cache that is shared, and
   * no third party unless the operator explicitly configured one.
   */
  app.post("/api/translate", async (req, res) => {
    if (!isTranslationEnabled() || process.env.ENABLE_AUTO_TRANSLATE === "false") {
      res.status(404).json({ error: "Translation is not configured on this server" });
      return;
    }

    const { texts, target } = req.body ?? {};

    if (
      !Array.isArray(texts) ||
      texts.length === 0 ||
      texts.length > 200 ||
      !texts.every(text => typeof text === "string" && text.length <= 2000) ||
      typeof target !== "string" ||
      !/^[a-z]{2}(-[A-Za-z0-9]{2,8})?$/.test(target)
    ) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    try {
      res.json({ translations: await translateBatch(texts, target) });
    } catch (error) {
      console.error("Translation request failed:", error);
      // Returning the originals keeps the board readable when the provider dies.
      res.json({ translations: texts });
    }
  });

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
      // randomUUID instead of a 7-char random string: ids now have to stay
      // unique across every session kept in the database, not just one run.
      id: randomUUID(),
      topicNumber,
      studentName,
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      insertQuestion(newQuestion);
    } catch (error) {
      console.error("Failed to persist question:", error);
      res.status(500).json({ error: "Failed to save question" });
      return;
    }

    questions.push(newQuestion);
    notifyClients("new_question", newQuestion);

    res.status(201).json(newQuestion);
  });

  // POST to answer a question (new answer)
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

    const updated: Question = {
      ...questions[queryIdx],
      answer: answer.trim(),
      answeredBy: teacherSession.name || undefined,
      answeredAt: new Date().toISOString()
    };

    try {
      updateAnswer(updated);
    } catch (error) {
      console.error("Failed to persist answer:", error);
      res.status(500).json({ error: "Failed to save answer" });
      return;
    }

    questions[queryIdx] = updated;
    notifyClients("question_answered", updated);

    res.json(updated);
  });

  // PUT to edit an existing answer (stores previous answer)
  app.put("/api/questions/:id/answer", (req, res) => {
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

    const oldAnswer = questions[queryIdx].answer;

    const updated: Question = {
      ...questions[queryIdx],
      answer: answer.trim(),
      previousAnswer: oldAnswer,
      answeredBy: teacherSession.name || undefined,
      answeredAt: new Date().toISOString()
    };

    try {
      updateAnswer(updated);
    } catch (error) {
      console.error("Failed to persist edited answer:", error);
      res.status(500).json({ error: "Failed to save answer" });
      return;
    }

    questions[queryIdx] = updated;
    notifyClients("question_answer_edited", updated);

    res.json(updated);
  });

  // Close the current board. Nothing is deleted: rows are archived and stay
  // reachable through the "include previous sessions" export.
  app.delete("/api/questions", (req, res) => {
    const teacherSession = getTeacherSession(req);
    if (!teacherSession) {
      res.status(401).json({ error: "Teacher access is required" });
      return;
    }

    let archived: number;
    try {
      archived = archiveActiveQuestions();
    } catch (error) {
      console.error("Failed to archive questions:", error);
      res.status(500).json({ error: "Failed to clear the board" });
      return;
    }

    questions = [];
    notifyClients("board_cleared", { archived });

    res.json({ archived });
  });

  // `?all=1` widens an export from the current board to every stored session.
  const resolveExportScope = (req: express.Request) => {
    const includeArchived = req.query.all === "1" || req.query.all === "true";
    return includeArchived ? loadAllQuestions() : questions;
  };

  app.get("/api/questions/export", (req, res) => {
    if (!isExportAuthorized(req)) {
      res.status(401).json({ error: "Teacher access is required" });
      return;
    }

    try {
      const exported = resolveExportScope(req);
      const data = exported.map((q, idx) => ({
        "#": idx + 1,
        "Tópico": q.topicNumber,
        "Aluno": q.studentName,
        "Pergunta": q.text,
        "Resposta": q.answer || "",
        "Respondido por": q.answeredBy || "",
        "Data Pergunta": q.createdAt ? new Date(q.createdAt).toLocaleString("pt-BR") : "",
        "Data Resposta": q.answeredAt ? new Date(q.answeredAt).toLocaleString("pt-BR") : ""
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Perguntas e Respostas");

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="qa-log-${Date.now()}.xlsx"`);
      res.send(buffer);
    } catch (error) {
      console.error("Failed to export questions to Excel:", error);
      res.status(500).json({ error: "Failed to generate Excel file" });
    }
  });

  app.get("/api/questions/export/pdf", (req, res) => {
    if (!isExportAuthorized(req)) {
      res.status(401).json({ error: "Teacher access is required" });
      return;
    }

    try {
      const exported = resolveExportScope(req);
      const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });

      // Pipe to response
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="qa-report-${Date.now()}.pdf"`);
      doc.pipe(res);

      const totalQuestions = exported.length;
      const totalAnswered = exported.filter(q => q.answer).length;
      const totalPending = totalQuestions - totalAnswered;

      // Header Banner (dark indigo background color)
      doc.rect(0, 0, doc.page.width, 110).fill("#4f46e5");
      doc.fillColor("#ffffff");
      doc.font("Helvetica-Bold").fontSize(20).text("Relatório de Perguntas e Respostas", 50, 30);
      doc.fontSize(10).font("Helvetica").text("Q&A Session Report — Dashboard Manager", 50, 56);
      doc.text(`Data do Relatório: ${new Date().toLocaleString("pt-BR")}`, 50, 72);

      // Summary Title
      doc.y = 135;
      doc.fillColor("#111827");
      doc.font("Helvetica-Bold").fontSize(13).text("Resumo da Sessão", 50, 135);
      
      const summaryY = 155;
      
      // Box 1: Total
      doc.rect(50, summaryY, 150, 50).fill("#f3f4f6");
      doc.fillColor("#4b5563").font("Helvetica-Bold").fontSize(8).text("TOTAL DE PERGUNTAS", 60, summaryY + 12);
      doc.fillColor("#111827").fontSize(16).text(String(totalQuestions), 60, summaryY + 24);

      // Box 2: Answered
      doc.rect(215, summaryY, 150, 50).fill("#ecfdf5");
      doc.fillColor("#047857").font("Helvetica-Bold").fontSize(8).text("RESPONDIDAS", 225, summaryY + 12);
      doc.fillColor("#065f46").fontSize(16).text(String(totalAnswered), 225, summaryY + 24);

      // Box 3: Pending
      doc.rect(380, summaryY, 150, 50).fill("#fffbeb");
      doc.fillColor("#b45309").font("Helvetica-Bold").fontSize(8).text("PENDENTES", 390, summaryY + 12);
      doc.fillColor("#92400e").fontSize(16).text(String(totalPending), 390, summaryY + 24);

      doc.y = summaryY + 70;

      // Divider line
      doc.strokeColor("#e5e7eb").lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1.2);

      // List of questions
      if (exported.length === 0) {
        doc.fillColor("#6b7280").font("Helvetica-Oblique").fontSize(11).text("Nenhuma pergunta registrada nesta sessão.", 50, doc.y + 10);
      } else {
        exported.forEach((q, idx) => {
          const cardHeight = calculateCardHeight(doc, q);

          if (doc.y + cardHeight > 750) {
            doc.addPage();
            doc.fillColor("#4f46e5").font("Helvetica-Bold").fontSize(9).text("Relatório de Perguntas e Respostas (Continuação)", 50, 30);
            doc.strokeColor("#e5e7eb").moveTo(50, 42).lineTo(545, 42).stroke();
            doc.y = 55;
          }

          const cardY = doc.y;

          // Metadata header
          doc.fillColor("#4b5563").font("Helvetica").fontSize(8.5);
          const dateStr = q.createdAt ? new Date(q.createdAt).toLocaleString("pt-BR") : "";
          doc.text(`Pergunta #${idx + 1}  |  Tópico ${q.topicNumber}  |  Aluno: ${q.studentName}  |  ${dateStr}`, 50, cardY);
          
          // Question body
          doc.moveDown(0.35);
          doc.fillColor("#1f2937").font("Helvetica-Oblique").fontSize(10.5).text(`"${q.text}"`, 60, doc.y, { width: 470 });
          doc.moveDown(0.5);

          // Answer or Pending status
          if (q.answer) {
            const answerY = doc.y;
            const answerText = q.answer;
            const answeredBy = q.answeredBy ? `por ${q.answeredBy}` : "";
            const answeredDate = q.answeredAt ? `em ${new Date(q.answeredAt).toLocaleString("pt-BR")}` : "";
            
            // Calculate height of the answer block components
            doc.font("Helvetica-Bold").fontSize(9);
            const labelHeight = doc.heightOfString(`Resposta ${answeredBy} ${answeredDate}:`, { width: 450 });
            
            doc.font("Helvetica").fontSize(10);
            const bodyHeight = doc.heightOfString(answerText, { width: 450 });
            
            const boxHeight = labelHeight + 3 + bodyHeight + 14;
            
            doc.rect(55, answerY, 480, boxHeight).fill("#f3f4f6");
            doc.fillColor("#374151").font("Helvetica-Bold").fontSize(9).text(`Resposta ${answeredBy} ${answeredDate}:`, 65, answerY + 7);
            doc.fillColor("#111827").font("Helvetica").fontSize(10).text(answerText, 65, doc.y + 3, { width: 450 });
            doc.y = answerY + boxHeight + 8;
          } else {
            doc.fillColor("#dc2626").font("Helvetica-Bold").fontSize(9).text("●  Pendente de resposta", 60, doc.y);
            doc.y = doc.y + 12;
          }

          doc.moveDown(1.2);
          doc.strokeColor("#f3f4f6").lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown(0.8);
        });
      }

      // Dynamic page numbers footer.
      //
      // The footer sits at y=785, but with a 50pt bottom margin the writable
      // area of an A4 page ends at y=792. An 8pt line is ~9.6pt tall, so
      // PDFKit treated every footer as an overflow and appended a fresh page
      // for it — turning a 9-page report into 9 content pages with no numbers
      // followed by 9 near-blank pages carrying only the numbers. Dropping the
      // bottom margin while stamping keeps the text on the page it belongs to.
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        const bottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        doc.fillColor("#9ca3af").font("Helvetica").fontSize(8);
        doc.text(`Página ${i + 1} de ${range.count}`, 50, 785, { align: "center", width: 495 });

        doc.page.margins.bottom = bottomMargin;
      }

      doc.end();
    } catch (error) {
      console.error("Failed to export questions to PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF file" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = typeof __dirname !== 'undefined'
      ? __dirname
      : path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // TLS material lives beside the database so a device that accepted the
  // certificate keeps working across restarts.
  const tls = isTlsEnabled() ? ensureCertificate(path.dirname(databaseFile)) : null;

  if (tls) {
    console.log(`[server] TLS enabled, certificate: ${tls.certPath}`);
    if (tls.generated) {
      console.log("[server] A new self-signed certificate was created. Browsers will");
      console.log("[server] warn once per device; choose Advanced and proceed.");
    }
  } else {
    console.warn("[server] WARNING: TLS is off (QA_TLS=off). The teacher password");
    console.warn("[server] crosses the network in cleartext and can be read by anyone");
    console.warn("[server] sniffing this Wi-Fi.");
  }

  const port = await listenWithFallback(app, preferredPort, HOST, tls);
  logAvailableUrls(port, Boolean(tls));
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

function calculateCardHeight(doc: any, q: Question): number {
  let height = 12; // Metadata header (Helvetica 8.5)
  height += 5;     // Spacing (moveDown 0.35)
  
  doc.font("Helvetica-Oblique").fontSize(10.5);
  height += doc.heightOfString(`"${q.text}"`, { width: 470 });
  
  height += 7;     // Spacing (moveDown 0.5)
  
  if (q.answer) {
    const answeredBy = q.answeredBy ? `por ${q.answeredBy}` : "";
    const answeredDate = q.answeredAt ? `em ${new Date(q.answeredAt).toLocaleString("pt-BR")}` : "";
    
    doc.font("Helvetica-Bold").fontSize(9);
    const labelHeight = doc.heightOfString(`Resposta ${answeredBy} ${answeredDate}:`, { width: 450 });
    
    doc.font("Helvetica").fontSize(10);
    const bodyHeight = doc.heightOfString(q.answer, { width: 450 });
    
    height += labelHeight + 3 + bodyHeight + 14; // Grey box height + internal padding
  } else {
    height += 12; // Pending status height
  }
  
  height += 15; // Spacing (moveDown 1.2)
  height += 1;  // Divider line stroke
  height += 10; // Spacing (moveDown 0.8)
  
  return height;
}

interface TlsOptions {
  key: string;
  cert: string;
}

function listen(app: express.Express, port: number, host: string, tls: TlsOptions | null) {
  return new Promise<number>((resolve, reject) => {
    // One Express app, served over TLS or plain HTTP depending on configuration.
    const server = tls
      ? https.createServer({ key: tls.key, cert: tls.cert }, app)
      : http.createServer(app);

    // Increase max listeners to support 100+ simultaneous SSE connections
    server.setMaxListeners(300);

    // Long keep-alive and header timeout for SSE
    server.keepAliveTimeout = 120_000;
    server.headersTimeout = 125_000;

    server.once("listening", () => {
      server.off("error", reject);
      console.log(`[server] Max listeners set to ${server.getMaxListeners()}, keepAliveTimeout=${server.keepAliveTimeout}ms`);
      resolve(port);
    });

    server.once("error", reject);
    server.listen(port, host);
  });
}

async function listenWithFallback(
  app: express.Express,
  preferredPort: number,
  host: string,
  tls: TlsOptions | null
) {
  const ports = Array.from({ length: 20 }, (_, index) => preferredPort + index);

  for (const port of ports) {
    try {
      return await listen(app, port, host, tls);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") {
        throw error;
      }

      console.warn(`Port ${port} is already in use, trying ${port + 1}...`);
    }
  }

  throw new Error(`No available port found between ${preferredPort} and ${preferredPort + ports.length - 1}`);
}

function logAvailableUrls(port: number, secure: boolean) {
  const scheme = secure ? "https" : "http";
  const urls = [
    `Local:   ${scheme}://localhost:${port}`,
    ...getLanAddresses().map(address => `Network: ${scheme}://${address}:${port}`)
  ];

  console.log("Server running:");
  urls.forEach(url => console.log(`  ${url}`));
  console.log("Interfaces:");
  console.log("  Student: /student");
  console.log("  Teacher: /teacher");
  console.log("  Legacy routes still work: /aluno and /professor");
}
