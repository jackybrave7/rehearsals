import type { AppState } from '../src/types/index.js';
import type { AppDatabase } from './db.js';
import { normalizeActorEmail } from '../src/utils/actorProfile.js';
import { isMailConfigured, sendTheaterActorInviteEmail } from './mail.js';
import type { TheaterAccessRole } from './authTypes.js';

function theaterName(db: AppDatabase, theaterId: string): string {
  const row = db.prepare(`SELECT name FROM theaters WHERE id = ?`).get(theaterId) as
    | { name: string }
    | undefined;
  return row?.name?.trim() || 'театр';
}

function markInviteSent(db: AppDatabase, theaterId: string, email: string): void {
  db.prepare(
    `INSERT INTO actor_roster_invites (theater_id, email, sent_at)
     VALUES (?, ?, ?)
     ON CONFLICT(theater_id, email) DO UPDATE SET sent_at = excluded.sent_at`
  ).run(theaterId, email, new Date().toISOString());
}

export function sendActorRosterInviteIfNeeded(
  db: AppDatabase,
  theaterId: string,
  email: string,
  actorName: string
): void {
  const normalized = normalizeActorEmail(email);
  if (!normalized || !isMailConfigured()) return;

  const existing = db
    .prepare(`SELECT sent_at FROM actor_roster_invites WHERE theater_id = ? AND email = ?`)
    .get(theaterId, normalized) as { sent_at: string } | undefined;
  if (existing) return;

  const name = theaterName(db, theaterId);
  void sendTheaterActorInviteEmail({
    to: normalized,
    theaterName: name,
    actorName: actorName.trim() || normalized,
  })
    .then(() => {
      markInviteSent(db, theaterId, normalized);
    })
    .catch((error) => {
      console.error('[mail] actor roster invite failed', normalized, error);
    });
}

/** После сохранения состояния — письмо при первом указании email на карточке участника. */
export function processActorRosterInvitesAfterSave(
  db: AppDatabase,
  before: AppState,
  after: AppState,
  editableTheaterIds: Set<string>
): void {
  const beforeById = new Map(before.actors.map((actor) => [actor.id, actor]));

  for (const actor of after.actors) {
    if (!actor.theaterId || !editableTheaterIds.has(actor.theaterId)) continue;
    if (actor.status !== 'active') continue;

    const newEmail = normalizeActorEmail(actor.email);
    if (!newEmail) continue;

    const previous = beforeById.get(actor.id);
    const oldEmail = normalizeActorEmail(previous?.email);
    if (newEmail === oldEmail) continue;

    sendActorRosterInviteIfNeeded(db, actor.theaterId, newEmail, actor.name);
  }
}

export function sendTheaterMemberInviteEmail(
  db: AppDatabase,
  theaterId: string,
  email: string,
  role: Extract<TheaterAccessRole, 'editor' | 'observer' | 'actor'>
): void {
  const normalized = normalizeActorEmail(email);
  if (!normalized || !isMailConfigured()) return;

  const name = theaterName(db, theaterId);
  void sendTheaterActorInviteEmail({
    to: normalized,
    theaterName: name,
    actorName: normalized,
    accessRole: role,
  })
    .then(() => {
      if (role === 'actor') {
        markInviteSent(db, theaterId, normalized);
      }
    })
    .catch((error) => {
      console.error('[mail] theater member invite failed', normalized, error);
    });
}
