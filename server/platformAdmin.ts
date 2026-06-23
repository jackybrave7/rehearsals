import type { Request, Response } from 'express';
import type { AuthSessionPayload } from './authTypes.js';
import { getSessionPayload, requireAuth } from './auth.js';

function parseAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isPlatformAdminEmail(email: string): boolean {
  const admins = parseAdminEmails();
  if (admins.size === 0) return false;
  return admins.has(email.trim().toLowerCase());
}

export function enrichSessionPayload(session: AuthSessionPayload): AuthSessionPayload {
  return {
    ...session,
    isPlatformAdmin: isPlatformAdminEmail(session.user.email),
  };
}

export function requirePlatformAdmin(req: Request, res: Response): AuthSessionPayload | null {
  const session = requireAuth(req, res);
  if (!session) return null;
  if (!isPlatformAdminEmail(session.user.email)) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return null;
  }
  return session;
}

export function getSessionPayloadWithAdmin(req: Request): AuthSessionPayload | null {
  const session = getSessionPayload(req);
  if (!session) return null;
  return enrichSessionPayload(session);
}
