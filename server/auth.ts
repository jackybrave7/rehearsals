import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, type AppDatabase } from './db.js';
import type { AuthSessionPayload, AuthUser, TheaterAccessInfo, TheaterAccessRole } from './authTypes.js';
import { enrichSessionPayload } from './platformAdmin.js';
import { getUserSubscriptionPlan } from './subscription.js';
import { isMailConfigured, sendEmailVerificationEmail, sendEmailConfirmedEmail, sendPasswordResetEmail } from './mail.js';
import {
  createEmailVerificationToken,
  isEmailVerified,
  verifyEmailByToken,
} from './emailVerification.js';
import { getRegistrationMode, isRegistrationApproved } from './platformSettings.js';

const SESSION_COOKIE = 'rehearsals_session';
const SESSION_DAYS = 30;
const PASSWORD_RESET_COOLDOWN_MS = 2 * 60 * 1000;
const EMAIL_VERIFICATION_COOLDOWN_MS = 2 * 60 * 1000;
const passwordResetCooldown = new Map<string, number>();
const emailVerificationCooldown = new Map<string, number>();

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64).toString('hex');
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
  } catch {
    return false;
  }
}

function generateOneTimePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = () =>
    Array.from({ length: 4 }, () => chars[randomBytes(1)[0] % chars.length]).join('');
  return `${part()}-${part()}-${part()}`;
}

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
};

function toAuthUser(
  db: AppDatabase,
  row: Pick<UserRow, 'id' | 'email' | 'name' | 'password_hash'>
): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    hasPassword: Boolean(row.password_hash),
    subscriptionPlan: getUserSubscriptionPlan(db, row.id, row.email),
  };
}

function buildSessionPayload(db: AppDatabase, userId: string): AuthSessionPayload {
  const row = db
    .prepare(`SELECT id, email, name, password_hash FROM users WHERE id = ?`)
    .get(userId) as UserRow | undefined;
  if (!row) throw new Error('USER_NOT_FOUND');
  return {
    user: toAuthUser(db, row),
    theaters: getUserTheaters(db, userId),
  };
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, decodeURIComponent(rest.join('='))];
    })
  );
}

function sessionExpiryIso(): string {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function setSessionCookie(res: Response, token: string) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
  );
}

export function clearSessionCookie(res: Response) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function readSessionToken(req: Request): string | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

function syncOwnerMemberships(db: AppDatabase): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO theater_members (theater_id, user_id, role, created_at)
     SELECT id, owner_user_id, 'owner', ?
     FROM theaters
     WHERE owner_user_id IS NOT NULL`
  ).run(now);
}

function getUserTheaters(db: AppDatabase, userId: string): TheaterAccessInfo[] {
  syncOwnerMemberships(db);
  const rows = db
    .prepare(
      `SELECT theater_id, role FROM theater_members WHERE user_id = ? ORDER BY role, theater_id`
    )
    .all(userId) as Array<{ theater_id: string; role: TheaterAccessRole }>;
  return rows.map((row) => ({ theaterId: row.theater_id, role: row.role }));
}

export function assignOrphanTheaters(db: AppDatabase, userId: string) {
  syncOwnerMemberships(db);

  const orphans = db
    .prepare(`SELECT id FROM theaters WHERE owner_user_id IS NULL`)
    .all() as Array<{ id: string }>;
  if (orphans.length === 0) return;

  const now = new Date().toISOString();
  const setOwner = db.prepare(`UPDATE theaters SET owner_user_id = ? WHERE id = ?`);
  const addMember = db.prepare(
    `INSERT OR IGNORE INTO theater_members (theater_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)`
  );
  for (const row of orphans) {
    setOwner.run(userId, row.id);
    addMember.run(row.id, userId, now);
  }
}

function createSession(db: AppDatabase, userId: string, res: Response): AuthUser {
  const token = randomBytes(32).toString('hex');
  const sessionId = uuidv4();
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`
  ).run(sessionId, userId, hashToken(token), sessionExpiryIso());
  setSessionCookie(res, token);

  const user = db.prepare(`SELECT id, email, name, password_hash FROM users WHERE id = ?`).get(userId) as UserRow;
  return toAuthUser(db, user);
}

export function getSessionPayload(req: Request, db: AppDatabase = getDb()): AuthSessionPayload | null {
  const token = readSessionToken(req);
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.password_hash
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(hashToken(token)) as
    | { user_id: string; expires_at: string; id: string; email: string; name: string; password_hash: string | null }
    | undefined;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;

  return {
    user: toAuthUser(db, row),
    theaters: getUserTheaters(db, row.user_id),
  };
}

export function requireAuth(req: Request, res: Response): AuthSessionPayload | null {
  const session = getSessionPayload(req);
  if (!session) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return null;
  }
  return session;
}

export function getTheaterRole(
  session: AuthSessionPayload,
  theaterId: string | null | undefined
): TheaterAccessRole | null {
  if (!theaterId) return null;
  return session.theaters.find((t) => t.theaterId === theaterId)?.role ?? null;
}

export function canReadTheater(session: AuthSessionPayload, theaterId: string): boolean {
  return session.theaters.some((t) => t.theaterId === theaterId);
}

export function canEditTheater(session: AuthSessionPayload, theaterId: string): boolean {
  const role = getTheaterRole(session, theaterId);
  return role === 'owner' || role === 'editor';
}

export function canManageTheaterMembers(session: AuthSessionPayload, theaterId: string): boolean {
  return getTheaterRole(session, theaterId) === 'owner';
}

export function registerAuthRoutes(app: import('express').Express) {
  app.get('/api/auth/config', (_req, res) => {
    res.json({
      mailConfigured: isMailConfigured(),
      registrationMode: getRegistrationMode(),
    });
  });

  app.get('/api/auth/me', (req, res) => {
    const session = getSessionPayload(req);
    if (!session) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    res.json(enrichSessionPayload(session));
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = readSessionToken(req);
    if (token) {
      getDb().prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(hashToken(token));
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.post('/api/auth/register', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const acceptTerms = req.body?.acceptTerms === true;

    if (!email || !password || password.length < 8) {
      res.status(400).json({ error: 'INVALID_CREDENTIALS' });
      return;
    }
    if (!acceptTerms) {
      res.status(400).json({ error: 'TERMS_NOT_ACCEPTED' });
      return;
    }
    if (!isMailConfigured()) {
      res.status(503).json({ error: 'MAIL_NOT_CONFIGURED' });
      return;
    }

    const db = getDb();
    const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
    if (existing) {
      res.status(409).json({ error: 'EMAIL_EXISTS' });
      return;
    }

    const userId = uuidv4();
    const now = new Date().toISOString();
    const registrationApprovedAt = getRegistrationMode(db) === 'normal' ? now : null;
    db.prepare(
      `INSERT INTO users (
         id, email, name, password_hash, google_sub, created_at, terms_accepted_at,
         email_verified_at, registration_approved_at
       ) VALUES (?, ?, ?, ?, NULL, ?, ?, NULL, ?)`
    ).run(userId, email, name || email, hashPassword(password), now, now, registrationApprovedAt);

    try {
      const token = createEmailVerificationToken(db, userId);
      const betaMode = getRegistrationMode(db) === 'beta';
      await sendEmailVerificationEmail(email, name || email, token, { betaMode });
      res.json({
        ok: true,
        needsEmailVerification: true,
        registrationMode: betaMode ? 'beta' : 'normal',
        message: betaMode
          ? 'Регистрация принята. Подтвердите email по ссылке из письма. Если письма нет во входящих — проверьте «Спам». После подтверждения заявка будет рассмотрена администратором — мы сообщим на почту, когда доступ откроется.'
          : 'На ваш email отправлена ссылка для подтверждения. Перейдите по ней, затем войдите в аккаунт. Если письма нет — проверьте папку «Спам».',
      });
    } catch (error) {
      console.error('[auth] verification mail failed', error);
      db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
      res.status(503).json({ error: 'MAIL_FAILED' });
    }
  });

  app.post('/api/auth/verify-email', async (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token) {
      res.status(400).json({ error: 'INVALID_TOKEN' });
      return;
    }

    const result = verifyEmailByToken(getDb(), token);
    if (!result) {
      res.status(400).json({ error: 'INVALID_TOKEN' });
      return;
    }

    const db = getDb();
    assignOrphanTheaters(db, result.userId);
    const betaMode = getRegistrationMode(db) === 'beta';
    const betaPendingApproval = betaMode && !isRegistrationApproved(db, result.userId);

    const userRow = db
      .prepare(`SELECT email, name FROM users WHERE id = ?`)
      .get(result.userId) as { email: string; name: string } | undefined;

    if (userRow && isMailConfigured()) {
      try {
        await sendEmailConfirmedEmail(userRow.email, userRow.name, { betaMode });
      } catch (error) {
        console.error('[auth] confirmation notice mail failed', error);
      }
    }

    res.json({ ok: true, betaPendingApproval });
  });

  app.post('/api/auth/resend-verification', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const genericMessage =
      'Если аккаунт с таким email зарегистрирован и не подтверждён, на почту отправлена новая ссылка.';

    if (!email) {
      res.status(400).json({ error: 'INVALID_EMAIL' });
      return;
    }
    if (!isMailConfigured()) {
      res.status(503).json({ error: 'MAIL_NOT_CONFIGURED' });
      return;
    }

    const lastSent = emailVerificationCooldown.get(email);
    if (lastSent && Date.now() - lastSent < EMAIL_VERIFICATION_COOLDOWN_MS) {
      res.status(429).json({ error: 'TOO_MANY_REQUESTS', message: genericMessage });
      return;
    }

    const db = getDb();
    const row = db
      .prepare(`SELECT id, email, name, email_verified_at FROM users WHERE email = ?`)
      .get(email) as
      | { id: string; email: string; name: string; email_verified_at: string | null }
      | undefined;

    if (!row || row.email_verified_at) {
      res.json({ ok: true, message: genericMessage });
      return;
    }

    try {
      const token = createEmailVerificationToken(db, row.id);
      const betaMode = getRegistrationMode(db) === 'beta';
      await sendEmailVerificationEmail(row.email, row.name, token, { betaMode });
      emailVerificationCooldown.set(email, Date.now());
      res.json({ ok: true, message: genericMessage });
    } catch (error) {
      console.error('[auth] resend verification mail failed', error);
      res.status(503).json({ error: 'MAIL_FAILED' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      res.status(400).json({ error: 'INVALID_CREDENTIALS' });
      return;
    }

    const db = getDb();
    const row = db
      .prepare(`SELECT id, email, name, password_hash FROM users WHERE email = ?`)
      .get(email) as { id: string; email: string; name: string; password_hash: string | null } | undefined;

    if (!row?.password_hash || !verifyPassword(password, row.password_hash)) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS' });
      return;
    }

    if (!isEmailVerified(db, row.id)) {
      res.status(403).json({ error: 'EMAIL_NOT_VERIFIED' });
      return;
    }

    if (!isRegistrationApproved(db, row.id)) {
      res.status(403).json({ error: 'REGISTRATION_PENDING' });
      return;
    }

    assignOrphanTheaters(db, row.id);
    createSession(db, row.id, res);
    res.json(enrichSessionPayload(buildSessionPayload(db, row.id)));
  });

  app.patch('/api/auth/profile', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
    const currentPassword =
      typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (name === undefined && !newPassword) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    const db = getDb();
    const row = db
      .prepare(`SELECT id, email, name, password_hash FROM users WHERE id = ?`)
      .get(session.user.id) as UserRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }

    if (name !== undefined) {
      if (!name) {
        res.status(400).json({ error: 'INVALID_NAME' });
        return;
      }
      db.prepare(`UPDATE users SET name = ? WHERE id = ?`).run(name, row.id);
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        res.status(400).json({ error: 'INVALID_PASSWORD' });
        return;
      }
      if (row.password_hash) {
        if (!currentPassword || !verifyPassword(currentPassword, row.password_hash)) {
          res.status(401).json({ error: 'WRONG_PASSWORD' });
          return;
        }
      }
      db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(
        hashPassword(newPassword),
        row.id
      );
    }

    res.json(enrichSessionPayload(buildSessionPayload(db, row.id)));
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const genericMessage =
      'Если аккаунт с таким email зарегистрирован, на почту отправлен одноразовый пароль.';

    if (!email) {
      res.status(400).json({ error: 'INVALID_EMAIL' });
      return;
    }

    if (!isMailConfigured()) {
      res.status(503).json({ error: 'MAIL_NOT_CONFIGURED' });
      return;
    }

    const lastSent = passwordResetCooldown.get(email);
    if (lastSent && Date.now() - lastSent < PASSWORD_RESET_COOLDOWN_MS) {
      res.json({ ok: true, message: genericMessage });
      return;
    }

    const db = getDb();
    const row = db
      .prepare(`SELECT id, email, name FROM users WHERE email = ?`)
      .get(email) as Pick<UserRow, 'id' | 'email' | 'name'> | undefined;

    if (!row) {
      res.json({ ok: true, message: genericMessage });
      return;
    }

    const oneTimePassword = generateOneTimePassword();
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(
      hashPassword(oneTimePassword),
      row.id
    );

    try {
      await sendPasswordResetEmail(row.email, row.name, oneTimePassword);
      passwordResetCooldown.set(email, Date.now());
      res.json({ ok: true, message: genericMessage });
    } catch (error) {
      console.error('[auth] forgot-password mail failed', error);
      res.status(503).json({ error: 'MAIL_FAILED' });
    }
  });

  app.get('/api/theaters/:theaterId/members', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const theaterId = req.params.theaterId;
    if (!canManageTheaterMembers(session, theaterId)) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }

    const rows = getDb()
      .prepare(
        `SELECT u.id, u.email, u.name, tm.role
         FROM theater_members tm
         JOIN users u ON u.id = tm.user_id
         WHERE tm.theater_id = ?
         ORDER BY CASE tm.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, u.name`
      )
      .all(theaterId) as Array<{ id: string; email: string; name: string; role: TheaterAccessRole }>;

    res.json({
      members: rows.map((row) => ({
        userId: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
      })),
    });
  });

  app.post('/api/theaters/:theaterId/members', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const theaterId = req.params.theaterId;
    if (!canManageTheaterMembers(session, theaterId)) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }

    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const role = req.body?.role as TheaterAccessRole;
    if (!email || (role !== 'editor' && role !== 'observer')) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    const db = getDb();
    const user = db.prepare(`SELECT id, email, name FROM users WHERE email = ?`).get(email) as
      | AuthUser
      | undefined;
    if (!user) {
      res.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }

    db.prepare(
      `INSERT INTO theater_members (theater_id, user_id, role, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(theater_id, user_id) DO UPDATE SET role = excluded.role`
    ).run(theaterId, user.id, role, new Date().toISOString());

    res.json({ ok: true });
  });

  app.delete('/api/theaters/:theaterId/members/:userId', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;
    const theaterId = req.params.theaterId;
    if (!canManageTheaterMembers(session, theaterId)) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }

    if (req.params.userId === session.user.id) {
      res.status(400).json({ error: 'CANNOT_REMOVE_SELF' });
      return;
    }

    getDb()
      .prepare(`DELETE FROM theater_members WHERE theater_id = ? AND user_id = ? AND role != 'owner'`)
      .run(theaterId, req.params.userId);
    res.json({ ok: true });
  });
}
