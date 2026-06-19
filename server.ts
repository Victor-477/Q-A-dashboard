import "dotenv/config";
import express from "express";
import path from "path";
import { randomUUID } from "crypto";
import { networkInterfaces } from "os";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";

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

  app.get("/api/questions/export", (req, res) => {
    try {
      const data = questions.map((q, idx) => ({
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
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });

      // Pipe to response
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="qa-report-${Date.now()}.pdf"`);
      doc.pipe(res);

      const totalQuestions = questions.length;
      const totalAnswered = questions.filter(q => q.answer).length;
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
      if (questions.length === 0) {
        doc.fillColor("#6b7280").font("Helvetica-Oblique").fontSize(11).text("Nenhuma pergunta registrada nesta sessão.", 50, doc.y + 10);
      } else {
        questions.forEach((q, idx) => {
          if (doc.y > 670) {
            doc.addPage();
            doc.fillColor("#4f46e5").font("Helvetica-Bold").fontSize(9).text("Relatório de Perguntas e Respostas (Continuação)", 50, 30);
            doc.strokeColor("#e5e7eb").moveTo(50, 42).lineTo(545, 42).stroke();
            doc.y = 55;
          }

          const cardY = doc.y;
          doc.save();

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
            
            // Calculate height of the answer block to make sure it doesn't overflow page
            const textHeight = doc.heightOfString(`Resposta ${answeredBy} ${answeredDate}:\n${answerText}`, { width: 450 }) + 14;
            
            if (answerY + textHeight > 740) {
              doc.addPage();
              doc.fillColor("#4f46e5").font("Helvetica-Bold").fontSize(9).text("Relatório de Perguntas e Respostas (Continuação)", 50, 30);
              doc.strokeColor("#e5e7eb").moveTo(50, 42).lineTo(545, 42).stroke();
              doc.y = 55;
              
              const newAnswerY = doc.y;
              doc.rect(55, newAnswerY, 480, textHeight).fill("#f3f4f6");
              doc.fillColor("#374151").font("Helvetica-Bold").fontSize(9).text(`Resposta ${answeredBy} ${answeredDate}:`, 65, newAnswerY + 7);
              doc.fillColor("#111827").font("Helvetica").fontSize(10).text(answerText, 65, doc.y + 3, { width: 450 });
              doc.y = newAnswerY + textHeight + 8;
            } else {
              doc.rect(55, answerY, 480, textHeight).fill("#f3f4f6");
              doc.fillColor("#374151").font("Helvetica-Bold").fontSize(9).text(`Resposta ${answeredBy} ${answeredDate}:`, 65, answerY + 7);
              doc.fillColor("#111827").font("Helvetica").fontSize(10).text(answerText, 65, doc.y + 3, { width: 450 });
              doc.y = answerY + textHeight + 8;
            }
          } else {
            doc.fillColor("#dc2626").font("Helvetica-Bold").fontSize(9).text("●  Pendente de resposta", 60, doc.y);
            doc.y = doc.y + 12;
          }

          doc.restore();
          doc.moveDown(1.2);
          doc.strokeColor("#f3f4f6").lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown(0.8);
        });
      }

      // Dynamic page numbers footer
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fillColor("#9ca3af").font("Helvetica").fontSize(8);
        doc.text(`Página ${i + 1} de ${range.count}`, 50, 785, { align: "center", width: 495 });
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
