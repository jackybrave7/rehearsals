import { v4 as uuidv4 } from 'uuid';
import type { Express } from 'express';
import { canEditTheater, requireAuth } from './auth.js';
import { getDb } from './db.js';
import { loadStateForUser } from './stateUserScope.js';
import { getUserSubscriptionPlan } from './subscription.js';
import {
  MAX_OUTCOME_PHOTO_BYTES,
  buildOutcomePhotoKey,
  compressOutcomePhoto,
  deleteOutcomePhotoFromS3,
  isAllowedOutcomePhotoMime,
  isS3Configured,
  parseOutcomePhotoKeyFromUrl,
  uploadOutcomePhotoToS3,
} from './s3Storage.js';

const MAX_PHOTOS_PER_REHEARSAL = 50;

function parsePhotoUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function readOutcomePhotoUrls(db: ReturnType<typeof getDb>, rehearsalId: string): string[] {
  const row = db
    .prepare(`SELECT outcome_photo_urls FROM rehearsals WHERE id = ?`)
    .get(rehearsalId) as { outcome_photo_urls: string | null } | undefined;
  return parsePhotoUrls(row?.outcome_photo_urls);
}

function writeOutcomePhotoUrls(
  db: ReturnType<typeof getDb>,
  rehearsalId: string,
  urls: string[]
): void {
  db.prepare(`UPDATE rehearsals SET outcome_photo_urls = ? WHERE id = ?`).run(
    JSON.stringify(urls),
    rehearsalId
  );
}

export function registerRehearsalOutcomePhotoRoutes(app: Express): void {
  app.post('/api/rehearsals/:rehearsalId/outcome-photos', async (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    if (!isS3Configured()) {
      res.status(503).json({ error: 'S3_NOT_CONFIGURED' });
      return;
    }

    const db = getDb();
    const plan = getUserSubscriptionPlan(db, session.user.id, session.user.email);
    if (plan !== 'pro') {
      res.status(402).json({ error: 'SUBSCRIPTION_PRO_REQUIRED' });
      return;
    }

    const rehearsalId = req.params.rehearsalId;
    const state = loadStateForUser(session, db);
    if (!state) {
      res.status(404).json({ error: 'EMPTY' });
      return;
    }

    const rehearsal = state.rehearsals.find((item) => item.id === rehearsalId);
    if (!rehearsal?.theaterId) {
      res.status(404).json({ error: 'REHEARSAL_NOT_FOUND' });
      return;
    }

    if (!canEditTheater(session, rehearsal.theaterId)) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }

    const existingUrls = readOutcomePhotoUrls(db, rehearsalId);
    if (existingUrls.length >= MAX_PHOTOS_PER_REHEARSAL) {
      res.status(413).json({ error: 'TOO_MANY_PHOTOS' });
      return;
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : 'photo.jpg';
    const mimeType =
      typeof req.body?.mimeType === 'string' ? req.body.mimeType.toLowerCase() : 'image/jpeg';
    const dataBase64 = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64 : '';

    if (!dataBase64) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    if (!isAllowedOutcomePhotoMime(mimeType)) {
      res.status(400).json({ error: 'INVALID_IMAGE_TYPE' });
      return;
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(dataBase64, 'base64');
    } catch {
      res.status(400).json({ error: 'INVALID_BASE64' });
      return;
    }

    if (buffer.byteLength > MAX_OUTCOME_PHOTO_BYTES) {
      res.status(413).json({ error: 'FILE_TOO_LARGE' });
      return;
    }

    try {
      const compressed = await compressOutcomePhoto(buffer, mimeType);
      const fileId = uuidv4();
      const key = buildOutcomePhotoKey(rehearsal.theaterId, rehearsalId, fileId);
      const url = await uploadOutcomePhotoToS3(compressed, key);
      if (!existingUrls.includes(url)) {
        writeOutcomePhotoUrls(db, rehearsalId, [...existingUrls, url]);
      }

      res.status(201).json({
        url,
        mimeType: 'image/jpeg',
        size: compressed.byteLength,
        originalName: name,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UPLOAD_FAILED';
      const status = message === 'INVALID_IMAGE' ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  app.delete('/api/rehearsals/:rehearsalId/outcome-photos', async (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    if (!isS3Configured()) {
      res.status(503).json({ error: 'S3_NOT_CONFIGURED' });
      return;
    }

    const db = getDb();
    const plan = getUserSubscriptionPlan(db, session.user.id, session.user.email);
    if (plan !== 'pro') {
      res.status(402).json({ error: 'SUBSCRIPTION_PRO_REQUIRED' });
      return;
    }

    const rehearsalId = req.params.rehearsalId;
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!url || !parseOutcomePhotoKeyFromUrl(url)) {
      res.status(400).json({ error: 'INVALID_PHOTO_URL' });
      return;
    }

    const state = loadStateForUser(session, db);
    const rehearsal = state?.rehearsals.find((item) => item.id === rehearsalId);
    if (!rehearsal?.theaterId) {
      res.status(404).json({ error: 'REHEARSAL_NOT_FOUND' });
      return;
    }

    if (!canEditTheater(session, rehearsal.theaterId)) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }

    const existingUrls = readOutcomePhotoUrls(db, rehearsalId);
    if (!existingUrls.includes(url)) {
      res.status(404).json({ error: 'PHOTO_NOT_FOUND' });
      return;
    }

    try {
      await deleteOutcomePhotoFromS3(url);
      writeOutcomePhotoUrls(
        db,
        rehearsalId,
        existingUrls.filter((item) => item !== url)
      );
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'DELETE_FAILED';
      res.status(500).json({ error: message });
    }
  });
}
