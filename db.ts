import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

export interface Question {
  id: string;
  topicNumber: number;
  studentName: string;
  text: string;
  answer?: string;
  previousAnswer?: string;
  answeredBy?: string;
  createdAt: string;
  answeredAt?: string;
}

type Row = Record<string, any>;

let db: DatabaseSync | null = null;

// Resolve the folder that holds the database file.
// The Electron panel passes QA_DATA_DIR so the data survives the portable
// executable being re-extracted on every launch.
function resolveDataDir() {
  const configured = process.env.QA_DATA_DIR?.trim();
  return configured ? path.resolve(configured) : path.join(process.cwd(), "data");
}

function requireDb() {
  if (!db) {
    throw new Error("Database has not been initialised. Call initDatabase() first.");
  }
  return db;
}

function toQuestion(row: Row): Question {
  return {
    id: String(row.id),
    topicNumber: Number(row.topic_number),
    studentName: String(row.student_name),
    text: String(row.text),
    answer: row.answer ?? undefined,
    previousAnswer: row.previous_answer ?? undefined,
    answeredBy: row.answered_by ?? undefined,
    createdAt: String(row.created_at),
    answeredAt: row.answered_at ?? undefined
  };
}

/**
 * Open (or create) the database and make sure the schema is in place.
 * Returns the absolute path of the database file.
 */
export function initDatabase() {
  const dir = resolveDataDir();
  fs.mkdirSync(dir, { recursive: true });

  const file = path.join(dir, "qa-board.db");
  db = new DatabaseSync(file);

  // WAL keeps reads from blocking writes, which matters because every answer
  // is written while dozens of SSE clients are being served.
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id              TEXT PRIMARY KEY,
      topic_number    REAL NOT NULL,
      student_name    TEXT NOT NULL,
      text            TEXT NOT NULL,
      answer          TEXT,
      previous_answer TEXT,
      answered_by     TEXT,
      created_at      TEXT NOT NULL,
      answered_at     TEXT,
      archived        INTEGER NOT NULL DEFAULT 0
    )
  `);

  db.exec("CREATE INDEX IF NOT EXISTS idx_questions_archived ON questions (archived, created_at)");

  // Teacher sessions live here rather than in a Map so a restart does not log
  // the teacher out mid-class. Unlike the questions table they expire, so a
  // stolen or forgotten token stops working on its own.
  db.exec(`
    CREATE TABLE IF NOT EXISTS teacher_sessions (
      token      TEXT PRIMARY KEY,
      name       TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);

  db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON teacher_sessions (expires_at)");

  // Small key/value table for values that must survive a restart but are not
  // questions, such as the generated teacher password.
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  purgeExpiredSessions();

  return file;
}

// ---------------------------------------------------------------- settings

export function readSetting(key: string): string | null {
  const row = requireDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as Row | undefined;
  return row?.value ?? null;
}

export function writeSetting(key: string, value: string) {
  requireDb()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

// -------------------------------------------------------- teacher sessions

export interface TeacherSession {
  token: string;
  name?: string;
  createdAt: string;
  expiresAt: string;
}

function toSession(row: Row): TeacherSession {
  return {
    token: String(row.token),
    name: row.name ?? undefined,
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at)
  };
}

export function insertSession(session: TeacherSession) {
  requireDb()
    .prepare("INSERT INTO teacher_sessions (token, name, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(session.token, session.name ?? null, session.createdAt, session.expiresAt);
}

/**
 * Looks up a session, treating an expired one as absent and deleting it on the
 * way out so the table does not grow without bound.
 */
export function findSession(token: string): TeacherSession | null {
  const row = requireDb()
    .prepare("SELECT * FROM teacher_sessions WHERE token = ?")
    .get(token) as Row | undefined;

  if (!row) {
    return null;
  }

  const session = toSession(row);
  if (Date.parse(session.expiresAt) <= Date.now()) {
    deleteSession(token);
    return null;
  }
  return session;
}

export function deleteSession(token: string) {
  requireDb().prepare("DELETE FROM teacher_sessions WHERE token = ?").run(token);
}

/** Drops every session already past its expiry. Returns how many were removed. */
export function purgeExpiredSessions() {
  const result = requireDb()
    .prepare("DELETE FROM teacher_sessions WHERE expires_at <= ?")
    .run(new Date().toISOString());
  return Number(result.changes);
}

export function countActiveSessions() {
  const row = requireDb()
    .prepare("SELECT COUNT(*) AS total FROM teacher_sessions WHERE expires_at > ?")
    .get(new Date().toISOString()) as Row | undefined;
  return Number(row?.total ?? 0);
}

/** Questions on the current board, oldest first (the order the UI expects). */
export function loadActiveQuestions(): Question[] {
  return requireDb()
    .prepare("SELECT * FROM questions WHERE archived = 0 ORDER BY created_at ASC, rowid ASC")
    .all()
    .map(toQuestion);
}

/** Every question ever stored, including archived sessions. */
export function loadAllQuestions(): Question[] {
  return requireDb()
    .prepare("SELECT * FROM questions ORDER BY created_at ASC, rowid ASC")
    .all()
    .map(toQuestion);
}

export function insertQuestion(question: Question) {
  requireDb()
    .prepare(
      `INSERT INTO questions (id, topic_number, student_name, text, created_at, archived)
       VALUES (?, ?, ?, ?, ?, 0)`
    )
    .run(
      question.id,
      question.topicNumber,
      question.studentName,
      question.text,
      question.createdAt
    );
}

export function updateAnswer(question: Question) {
  requireDb()
    .prepare(
      `UPDATE questions
          SET answer = ?, previous_answer = ?, answered_by = ?, answered_at = ?
        WHERE id = ?`
    )
    .run(
      question.answer ?? null,
      question.previousAnswer ?? null,
      question.answeredBy ?? null,
      question.answeredAt ?? null,
      question.id
    );
}

/**
 * Close the current board without deleting anything: rows stay in the database
 * and remain available through the "include previous sessions" export.
 * Returns how many questions were archived.
 */
export function archiveActiveQuestions() {
  const result = requireDb().prepare("UPDATE questions SET archived = 1 WHERE archived = 0").run();
  return Number(result.changes);
}

export function countStoredQuestions() {
  const row = requireDb().prepare("SELECT COUNT(*) AS total FROM questions").get();
  return Number(row?.total ?? 0);
}

export function closeDatabase() {
  db?.close();
  db = null;
}
