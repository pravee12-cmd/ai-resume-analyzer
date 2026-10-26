import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  contactNumber: string;
  passwordHash: string;
  salt: string;
  passwordUpdatedByUser?: boolean;
  role: string;
  photoUrl?: string;
  createdAt: string;
  lastActive: string;
}

export interface OtpSession {
  identifierKey: string;
  contactNumber: string;
  otpCode: string;
  salt: string;
  expiresAt: number;
  attemptsRemaining: number;
  verified: boolean;
  resetToken?: string;
  createdAt: number;
}

export interface AnalysisRecord {
  id: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  fileName: string;
  targetRole: string;
  score: number;
  matchPercentage: number;
  skillsDetected: string[];
  missingSkills: string[];
  strengths: string[];
  formatVerified: boolean;
  timestamp: string;
  fullAnalysis?: Record<string, unknown>;
}

export interface ActivityLogRecord {
  id: string;
  category: 'resume_upload' | 'analysis_complete' | 'password_change' | 'account_auth';
  title: string;
  description: string;
  candidateName: string;
  candidateEmail: string;
  contactNumber?: string;
  metadata?: string;
  status: '200 OK' | 'VERIFIED' | 'UPDATED';
  timestamp: string;
}

const DB_FILE_PATH = path.join(process.cwd(), 'ai_resume_analyzer.db');

let db: DatabaseSync;

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

export function initSqliteDatabase(): { path: string; connected: boolean } {
  try {
    db = new DatabaseSync(DB_FILE_PATH);

    // Optimize SQLite with WAL mode and pragmas
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');

    // Users Table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        contact_number TEXT,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        password_updated_by_user INTEGER DEFAULT 0,
        role TEXT DEFAULT 'Candidate',
        photo_url TEXT,
        created_at TEXT NOT NULL,
        last_active TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_contact ON users(contact_number);
    `);

    // Analysis History Table
    db.exec(`
      CREATE TABLE IF NOT EXISTS analysis_history (
        id TEXT PRIMARY KEY,
        candidate_name TEXT NOT NULL,
        candidate_email TEXT NOT NULL COLLATE NOCASE,
        candidate_phone TEXT,
        file_name TEXT NOT NULL,
        target_role TEXT NOT NULL,
        score INTEGER NOT NULL,
        match_percentage INTEGER NOT NULL,
        skills_detected TEXT,
        missing_skills TEXT,
        strengths TEXT,
        format_verified INTEGER DEFAULT 1,
        timestamp TEXT NOT NULL,
        full_analysis TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_analysis_email ON analysis_history(candidate_email, timestamp DESC);
    `);

    // Activity Logs Table
    db.exec(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        candidate_name TEXT NOT NULL,
        candidate_email TEXT NOT NULL COLLATE NOCASE,
        contact_number TEXT,
        metadata TEXT,
        status TEXT DEFAULT 'VERIFIED',
        timestamp TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_logs_email ON activity_logs(candidate_email, timestamp DESC);
    `);

    // OTP Sessions Table (Strict 2-minute time window)
    db.exec(`
      CREATE TABLE IF NOT EXISTS otp_sessions (
        identifier_key TEXT PRIMARY KEY COLLATE NOCASE,
        contact_number TEXT,
        otp_code TEXT NOT NULL,
        salt TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        attempts_remaining INTEGER DEFAULT 3,
        verified INTEGER DEFAULT 0,
        reset_token TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_sessions(expires_at);
    `);

    // Seed default candidates if users table is empty
    const countRow = db.prepare('SELECT COUNT(*) as count FROM users;').get() as { count: number };
    if (!countRow || countRow.count === 0) {
      seedDefaultUsers();
    }

    return { path: DB_FILE_PATH, connected: true };
  } catch (err) {
    console.error('Failed to initialize SQLite DatabaseSync:', err);
    throw err;
  }
}

function seedDefaultUsers() {
  const defaultSeeds = [
    {
      id: 'usr_bintu_01',
      name: 'Bintu',
      email: 'bintu@gmail.com',
      contactNumber: '+91 9876543210',
      role: 'Senior Full-Stack Candidate',
      password: 'Password@123',
    },
    {
      id: 'usr_divya_02',
      name: 'Divya Sharma',
      email: 'divya@gmail.com',
      contactNumber: '+91 9845012345',
      role: 'Mid-Level SWE Candidate',
      password: 'Password@123',
    },
    {
      id: 'usr_elena_03',
      name: 'Elena Rostova',
      email: 'elena.rostova@gmail.com',
      contactNumber: '+1 4158904321',
      role: 'Staff Architect Candidate',
      password: 'Password@123',
    },
    {
      id: 'usr_alex_04',
      name: 'Alex Rivera',
      email: 'alex.rivera@gmail.com',
      contactNumber: '+1 6504329876',
      role: 'Junior Developer Candidate',
      password: 'Password@123',
    },
  ];

  const insertStmt = db.prepare(`
    INSERT INTO users (
      id, name, email, contact_number, password_hash, salt, password_updated_by_user, role, created_at, last_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  for (const s of defaultSeeds) {
    const { salt, hash } = hashPassword(s.password);
    insertStmt.run(
      s.id,
      s.name,
      s.email,
      s.contactNumber,
      hash,
      salt,
      0,
      s.role,
      now,
      now
    );
  }
}

// ---------------------------------------------------------
// User Operations
// ---------------------------------------------------------

export function getSqliteUsers(): UserRecord[] {
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC;').all() as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    contactNumber: r.contact_number,
    passwordHash: r.password_hash,
    salt: r.salt,
    passwordUpdatedByUser: Boolean(r.password_updated_by_user),
    role: r.role,
    photoUrl: r.photo_url || undefined,
    createdAt: r.created_at,
    lastActive: r.last_active,
  }));
}

export function findSqliteUser(identifier: string): UserRecord | undefined {
  const clean = String(identifier || '').trim().toLowerCase();
  if (!clean) return undefined;

  const phoneDigits = clean.replace(/\D/g, '');

  const row = db
    .prepare(
      `
      SELECT * FROM users
      WHERE email = ?
         OR LOWER(name) = ?
         OR contact_number = ?
         OR (LENGTH(?) >= 7 AND REPLACE(REPLACE(REPLACE(contact_number, ' ', ''), '-', ''), '+', '') LIKE '%' || ?)
      LIMIT 1;
    `
    )
    .get(clean, clean, clean, phoneDigits, phoneDigits.slice(-10)) as any;

  if (!row) return undefined;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    contactNumber: row.contact_number,
    passwordHash: row.password_hash,
    salt: row.salt,
    passwordUpdatedByUser: Boolean(row.password_updated_by_user),
    role: row.role,
    photoUrl: row.photo_url || undefined,
    createdAt: row.created_at,
    lastActive: row.last_active,
  };
}

export function saveSqliteUser(user: UserRecord): void {
  const existing = findSqliteUser(user.email) || findSqliteUser(user.id);
  if (existing) {
    db.prepare(`
      UPDATE users SET
        name = ?,
        email = ?,
        contact_number = ?,
        password_hash = ?,
        salt = ?,
        password_updated_by_user = ?,
        role = ?,
        photo_url = ?,
        last_active = ?
      WHERE id = ? OR email = ?
    `).run(
      user.name,
      user.email,
      user.contactNumber,
      user.passwordHash,
      user.salt,
      user.passwordUpdatedByUser ? 1 : 0,
      user.role,
      user.photoUrl || null,
      user.lastActive || new Date().toISOString(),
      existing.id,
      user.email
    );
  } else {
    db.prepare(`
      INSERT INTO users (
        id, name, email, contact_number, password_hash, salt, password_updated_by_user, role, photo_url, created_at, last_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id || `usr_${crypto.randomBytes(4).toString('hex')}`,
      user.name,
      user.email,
      user.contactNumber,
      user.passwordHash,
      user.salt,
      user.passwordUpdatedByUser ? 1 : 0,
      user.role || 'Candidate',
      user.photoUrl || null,
      user.createdAt || new Date().toISOString(),
      user.lastActive || new Date().toISOString()
    );
  }
}

export function updateSqliteUserPassword(
  identifier: string,
  newPassword: string
): { success: boolean; user?: UserRecord; error?: string } {
  const user = findSqliteUser(identifier);
  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  const { salt, hash } = hashPassword(newPassword);
  db.prepare(`
    UPDATE users SET
      password_hash = ?,
      salt = ?,
      password_updated_by_user = 1,
      last_active = ?
    WHERE id = ?
  `).run(hash, salt, new Date().toISOString(), user.id);

  user.passwordHash = hash;
  user.salt = salt;
  user.passwordUpdatedByUser = true;

  return { success: true, user };
}

// ---------------------------------------------------------
// 2-MINUTE OTP OPERATIONS
// ---------------------------------------------------------

export function createSqliteOtpSession(
  identifier: string,
  contactNumber: string
): { otp: string; expiresAt: number; expiresInSeconds: number } {
  const cleanId = identifier.trim().toLowerCase();
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit numeric OTP
  const salt = crypto.randomBytes(8).toString('hex');
  const now = Date.now();
  const expiresAt = now + 120 * 1000; // Strict 2-minute expiration (120 seconds)

  db.prepare(`
    INSERT INTO otp_sessions (
      identifier_key, contact_number, otp_code, salt, expires_at, attempts_remaining, verified, created_at
    ) VALUES (?, ?, ?, ?, ?, 3, 0, ?)
    ON CONFLICT(identifier_key) DO UPDATE SET
      contact_number = excluded.contact_number,
      otp_code = excluded.otp_code,
      salt = excluded.salt,
      expires_at = excluded.expires_at,
      attempts_remaining = 3,
      verified = 0,
      reset_token = NULL,
      created_at = excluded.created_at;
  `).run(cleanId, contactNumber, otp, salt, expiresAt, now);

  return {
    otp,
    expiresAt,
    expiresInSeconds: 120,
  };
}

export function verifySqliteOtp(
  identifier: string,
  enteredOtp: string
): { valid: boolean; error?: string; resetToken?: string } {
  const cleanId = identifier.trim().toLowerCase();
  const row = db.prepare('SELECT * FROM otp_sessions WHERE identifier_key = ?;').get(cleanId) as any;

  if (!row) {
    return {
      valid: false,
      error: 'No active OTP verification session found. Please click "Send OTP" to generate a 2-minute verification code.',
    };
  }

  const now = Date.now();
  if (now > row.expires_at) {
    db.prepare('DELETE FROM otp_sessions WHERE identifier_key = ?;').run(cleanId);
    return {
      valid: false,
      error: 'OTP has expired! The 2-minute time window has passed. Please click "Resend OTP" to generate a fresh verification code.',
    };
  }

  if (row.attempts_remaining <= 0) {
    db.prepare('DELETE FROM otp_sessions WHERE identifier_key = ?;').run(cleanId);
    return {
      valid: false,
      error: 'Too many incorrect OTP attempts. For security, please request a new verification code.',
    };
  }

  const cleanEntered = String(enteredOtp || '').trim();
  if (cleanEntered !== String(row.otp_code)) {
    const remaining = row.attempts_remaining - 1;
    db.prepare('UPDATE otp_sessions SET attempts_remaining = ? WHERE identifier_key = ?;').run(
      remaining,
      cleanId
    );
    return {
      valid: false,
      error: `Invalid OTP code. (${remaining} attempts remaining before code expires)`,
    };
  }

  const resetToken = crypto.randomBytes(24).toString('hex');
  db.prepare(`
    UPDATE otp_sessions SET
      verified = 1,
      reset_token = ?
    WHERE identifier_key = ?;
  `).run(resetToken, cleanId);

  return {
    valid: true,
    resetToken,
  };
}

export function completeSqliteOtpPasswordReset(
  identifier: string,
  enteredOtp: string,
  newPassword: string
): { success: boolean; user?: UserRecord; error?: string } {
  const cleanId = identifier.trim().toLowerCase();
  const row = db.prepare('SELECT * FROM otp_sessions WHERE identifier_key = ?;').get(cleanId) as any;

  if (!row) {
    return {
      success: false,
      error: 'No active OTP session found. Please click "Send OTP" to begin password reset.',
    };
  }

  const now = Date.now();
  if (now > row.expires_at) {
    db.prepare('DELETE FROM otp_sessions WHERE identifier_key = ?;').run(cleanId);
    return {
      success: false,
      error: 'OTP expired after 2 minutes! Please request a new OTP to reset your password.',
    };
  }

  const cleanEntered = String(enteredOtp || '').trim();
  if (cleanEntered !== String(row.otp_code) && !row.verified) {
    return {
      success: false,
      error: 'Invalid OTP code. Please check your 6-digit verification code.',
    };
  }

  if (newPassword.length < 6) {
    return {
      success: false,
      error: 'New password must be at least 6 characters long.',
    };
  }

  const updateResult = updateSqliteUserPassword(cleanId, newPassword);
  if (!updateResult.success) {
    return updateResult;
  }

  // Clear OTP session once successfully used
  db.prepare('DELETE FROM otp_sessions WHERE identifier_key = ?;').run(cleanId);

  return {
    success: true,
    user: updateResult.user,
  };
}

// ---------------------------------------------------------
// Analysis History Operations
// ---------------------------------------------------------

export function saveSqliteAnalysis(record: AnalysisRecord): void {
  db.prepare(`
    INSERT OR REPLACE INTO analysis_history (
      id, candidate_name, candidate_email, candidate_phone, file_name, target_role,
      score, match_percentage, skills_detected, missing_skills, strengths, format_verified, timestamp, full_analysis
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.candidateName,
    record.candidateEmail,
    record.candidatePhone || null,
    record.fileName,
    record.targetRole,
    record.score,
    record.matchPercentage,
    JSON.stringify(record.skillsDetected || []),
    JSON.stringify(record.missingSkills || []),
    JSON.stringify(record.strengths || []),
    record.formatVerified ? 1 : 0,
    record.timestamp,
    record.fullAnalysis ? JSON.stringify(record.fullAnalysis) : null
  );
}

export function getSqliteAnalysisHistory(email?: string): AnalysisRecord[] {
  let rows: any[];
  if (email) {
    rows = db
      .prepare('SELECT * FROM analysis_history WHERE candidate_email = ? ORDER BY timestamp DESC;')
      .all(email.trim().toLowerCase());
  } else {
    rows = db.prepare('SELECT * FROM analysis_history ORDER BY timestamp DESC;').all();
  }

  return rows.map((r) => ({
    id: r.id,
    candidateName: r.candidate_name,
    candidateEmail: r.candidate_email,
    candidatePhone: r.candidate_phone || undefined,
    fileName: r.file_name,
    targetRole: r.target_role,
    score: r.score,
    matchPercentage: r.match_percentage,
    skillsDetected: r.skills_detected ? JSON.parse(r.skills_detected) : [],
    missingSkills: r.missing_skills ? JSON.parse(r.missing_skills) : [],
    strengths: r.strengths ? JSON.parse(r.strengths) : [],
    formatVerified: Boolean(r.format_verified),
    timestamp: r.timestamp,
    fullAnalysis: r.full_analysis ? JSON.parse(r.full_analysis) : undefined,
  }));
}

// ---------------------------------------------------------
// Activity Logs Operations
// ---------------------------------------------------------

export function saveSqliteActivityLog(log: ActivityLogRecord): void {
  db.prepare(`
    INSERT OR REPLACE INTO activity_logs (
      id, category, title, description, candidate_name, candidate_email, contact_number, metadata, status, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    log.id,
    log.category,
    log.title,
    log.description,
    log.candidateName,
    log.candidateEmail,
    log.contactNumber || null,
    log.metadata || null,
    log.status || 'VERIFIED',
    log.timestamp
  );
}

export function getSqliteActivityLogs(email?: string): ActivityLogRecord[] {
  let rows: any[];
  if (email) {
    rows = db
      .prepare('SELECT * FROM activity_logs WHERE candidate_email = ? ORDER BY timestamp DESC LIMIT 100;')
      .all(email.trim().toLowerCase());
  } else {
    rows = db.prepare('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 200;').all();
  }

  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    title: r.title,
    description: r.description,
    candidateName: r.candidate_name,
    candidateEmail: r.candidate_email,
    contactNumber: r.contact_number || undefined,
    metadata: r.metadata || undefined,
    status: r.status,
    timestamp: r.timestamp,
  }));
}

// ---------------------------------------------------------
// SQLite Database Diagnostics & Status
// ---------------------------------------------------------

export function getSqliteDbDiagnostics() {
  const usersCount = (db.prepare('SELECT COUNT(*) as c FROM users;').get() as any)?.c || 0;
  const analysisCount = (db.prepare('SELECT COUNT(*) as c FROM analysis_history;').get() as any)?.c || 0;
  const logsCount = (db.prepare('SELECT COUNT(*) as c FROM activity_logs;').get() as any)?.c || 0;
  const activeOtps = (db.prepare('SELECT COUNT(*) as c FROM otp_sessions WHERE expires_at > ?;').get(Date.now()) as any)?.c || 0;

  let sizeBytes = 0;
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      sizeBytes = fs.statSync(DB_FILE_PATH).size;
    }
  } catch {
    // ignore
  }

  return {
    engine: 'SQLite3 (Node native node:sqlite)',
    dbPath: DB_FILE_PATH,
    connected: true,
    sizeBytes,
    sizeFormatted: `${(sizeBytes / 1024).toFixed(1)} KB`,
    stats: {
      users: usersCount,
      analyses: analysisCount,
      activityLogs: logsCount,
      activeOtps,
    },
    tables: ['users', 'analysis_history', 'activity_logs', 'otp_sessions'],
  };
}
