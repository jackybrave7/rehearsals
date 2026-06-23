import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, type AppDatabase } from './db.js';
import type { AuthSessionPayload, AuthUser, TheaterAccessInfo, TheaterAccessRole } from './authTypes.js';
import { enrichSessionPayload } from './platformAdmin.js';

const SESSION_COOKIE = 'rehearsals_session';
const SESSION_DAYS = 30;

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

function assignOrphanTheaters(db: AppDatabase, userId: string) {
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

  const user = db.prepare(`SELECT id, email, name FROM users WHERE id = ?`).get(userId) as AuthUser;
  return user;
}

export function getSessionPayload(req: Request, db: AppDatabase = getDb()): AuthSessionPayload | null {
  const token = readSessionToken(req);
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT s.user_id, s.expires_at, u.id, u.email, u.name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(hashToken(token)) as
    | { user_id: string; expires_at: string; id: string; email: string; name: string }
    | undefined;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;

  return {
    user: { id: row.id, email: row.email, name: row.name },
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

async function verifyGoogleCredential(credential: string): Promise<{ sub: string; email: string; name: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.VITE_GOOGLE_CLIENT_ID;
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
  );
  if (!response.ok) throw new Error('INVALID_GOOGLE_TOKEN');
  const data = (await response.json()) as { sub?: string; email?: string; name?: string; aud?: string };
  if (!data.sub || !data.email) throw new Error('INVALID_GOOGLE_TOKEN');
  if (clientId && data.aud !== clientId) throw new Error('INVALID_GOOGLE_AUDIENCE');
  return { sub: data.sub, email: data.email.toLowerCase(), name: data.name ?? data.email };
}

export function registerAuthRoutes(app: import('express').Express) {
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

  app.post('/api/auth/register', (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

    if (!email || !password || password.length < 8) {
      res.status(400).json({ error: 'INVALID_CREDENTIALS' });
      return;
    }

    const db = getDb();
    const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
    if (existing) {
      res.status(409).json({ error: 'EMAIL_EXISTS' });
      return;
    }

    const userId = uuidv4();
    db.prepare(
      `INSERT INTO users (id, email, name, password_hash, google_sub, created_at) VALUES (?, ?, ?, ?, NULL, ?)`
    ).run(userId, email, name || email, hashPassword(password), new Date().toISOString());

    assignOrphanTheaters(db, userId);
    const user = createSession(db, userId, res);
    res.json(enrichSessionPayload({ user, theaters: getUserTheaters(db, userId) }));
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

    assignOrphanTheaters(db, row.id);
    createSession(db, row.id, res);
    res.json(
      enrichSessionPayload({
        user: { id: row.id, email: row.email, name: row.name },
        theaters: getUserTheaters(db, row.id),
      })
    );
  });

  app.post('/api/auth/google', async (req, res) => {
    const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
    if (!credential) {
      res.status(400).json({ error: 'INVALID_CREDENTIALS' });
      return;
    }

    try {
      const googleUser = await verifyGoogleCredential(credential);
      const db = getDb();
      let row = db
        .prepare(`SELECT id, email, name FROM users WHERE google_sub = ? OR email = ?`)
        .get(googleUser.sub, googleUser.email) as AuthUser | undefined;

      if (!row) {
        const userId = uuidv4();
        db.prepare(
          `INSERT INTO users (id, email, name, password_hash, google_sub, created_at) VALUES (?, ?, ?, NULL, ?, ?)`
        ).run(userId, googleUser.email, googleUser.name, googleUser.sub, new Date().toISOString());
        row = { id: userId, email: googleUser.email, name: googleUser.name };
      } else {
        db.prepare(`UPDATE users SET google_sub = ?, name = ? WHERE id = ?`).run(
          googleUser.sub,
          googleUser.name,
          row.id
        );
      }

      assignOrphanTheaters(db, row.id);
      createSession(db, row.id, res);
      res.json(enrichSessionPayload({ user: row, theaters: getUserTheaters(db, row.id) }));
    } catch (error) {
      console.error('[auth] google failed', error);
      res.status(401).json({ error: 'INVALID_GOOGLE_TOKEN' });
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
