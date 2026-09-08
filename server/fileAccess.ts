import type { AuthSessionPayload } from './authTypes.js';
import { getDb, type AppDatabase } from './db.js';
import { getFileRecord, publicFileUrl } from './fileStorage.js';

function isFileLinkedToTheaters(
  db: AppDatabase,
  fileId: string,
  theaterIds: string[]
): boolean {
  if (theaterIds.length === 0) return false;

  const fileUrl = publicFileUrl(fileId);
  const placeholders = theaterIds.map(() => '?').join(', ');

  const playHit = db
    .prepare(
      `SELECT 1 AS ok FROM plays
       WHERE theater_id IN (${placeholders})
         AND (icon_url = ? OR cover_url = ? OR script_file_url = ?)
       LIMIT 1`
    )
    .get(...theaterIds, fileUrl, fileUrl, fileUrl) as { ok: number } | undefined;
  if (playHit?.ok) return true;

  const actorHit = db
    .prepare(
      `SELECT 1 AS ok FROM actors
       WHERE theater_id IN (${placeholders}) AND photo_url = ?
       LIMIT 1`
    )
    .get(...theaterIds, fileUrl) as { ok: number } | undefined;
  if (actorHit?.ok) return true;

  const rehearsalHit = db
    .prepare(
      `SELECT 1 AS ok FROM rehearsals
       WHERE theater_id IN (${placeholders}) AND outcome_photo_urls LIKE ?
       LIMIT 1`
    )
    .get(...theaterIds, `%${fileUrl}%`) as { ok: number } | undefined;

  return Boolean(rehearsalHit?.ok);
}

export function canUserDownloadFile(session: AuthSessionPayload, fileId: string): boolean {
  const db = getDb();
  const record = getFileRecord(db, fileId);
  if (!record) return false;
  if (record.ownerUserId === session.user.id) return true;
  if (session.isPlatformAdmin) return true;

  const supportLinked = db
    .prepare(`SELECT 1 AS ok FROM support_ticket_attachments WHERE file_id = ? LIMIT 1`)
    .get(fileId) as { ok: number } | undefined;
  if (supportLinked?.ok) return true;

  const theaterIds = session.theaters.map((t) => t.theaterId);
  return isFileLinkedToTheaters(db, fileId, theaterIds);
}
