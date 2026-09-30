import { v4 as uuidv4 } from 'uuid';
import type { Express } from 'express';
import { canEditTheater, requireAuth } from './auth.js';
import { getDb } from './db.js';
import { loadStateForUser } from './stateUserScope.js';
import { getUserSubscriptionPlan } from './subscription.js';
import {
  MAX_OUTCOME_VIDEO_BYTES,
  buildOutcomeVideoKey,
  deleteOutcomeVideoFromS3,
  isAllowedOutcomeVideoMime,
  isS3Configured,
  parseOutcomeVideoKeyFromUrl,
  uploadOutcomeVideoToS3,
} from './s3Storage.js';
import { parseEmbeddableVideoLink } from '../shared/outcomeVideoEmbed.js';

const MAX_VIDEOS_PER_REHEARSAL = 10;

function isManagedOutcomeVideoUrl(url: string): boolean {
  return parseOutcomeVideoKeyFromUrl(url) !== null || parseEmbeddableVideoLink(url) !== null;
}

function parseVideoUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function readOutcomeVideoUrls(db: ReturnType<typeof getDb>, rehearsalId: string): string[] {
  const row = db
    .prepare(`SELECT outcome_video_urls FROM rehearsals WHERE id = ?`)
    .get(rehearsalId) as { outcome_video_urls: string | null } | undefined;
  return parseVideoUrls(row?.outcome_video_urls);
}

function writeOutcomeVideoUrls(
  db: ReturnType<typeof getDb>,
  rehearsalId: string,
  urls: string[]
): void {
  db.prepare(`UPDATE rehearsals SET outcome_video_urls = ? WHERE id = ?`).run(
    JSON.stringify(urls),
    rehearsalId
  );
}

export function registerRehearsalOutcomeVideoRoutes(app: Express): void {
  app.post('/api/rehearsals/:rehearsalId/outcome-videos', async (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

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

    const existingUrls = readOutcomeVideoUrls(db, rehearsalId);
    if (existingUrls.length >= MAX_VIDEOS_PER_REHEARSAL) {
      res.status(413).json({ error: 'TOO_MANY_VIDEOS' });
      return;
    }

    const linkUrl = typeof req.body?.linkUrl === 'string' ? req.body.linkUrl.trim() : '';
    if (linkUrl) {
      const parsed = parseEmbeddableVideoLink(linkUrl);
      if (!parsed) {
        res.status(400).json({ error: 'INVALID_VIDEO_LINK' });
        return;
      }
      if (!existingUrls.includes(parsed.canonicalUrl)) {
        writeOutcomeVideoUrls(db, rehearsalId, [...existingUrls, parsed.canonicalUrl]);
      }
      res.status(201).json({
        url: parsed.canonicalUrl,
        provider: parsed.provider,
        embedUrl: parsed.embedUrl,
      });
      return;
    }

    if (!isS3Configured()) {
      res.status(503).json({ error: 'S3_NOT_CONFIGURED' });
      return;
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : 'video.mp4';
    const mimeType =
      typeof req.body?.mimeType === 'string' ? req.body.mimeType.toLowerCase() : 'video/mp4';
    const dataBase64 = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64 : '';

    if (!dataBase64) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    if (!isAllowedOutcomeVideoMime(mimeType)) {
      res.status(400).json({ error: 'INVALID_VIDEO_TYPE' });
      return;
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(dataBase64, 'base64');
    } catch {
      res.status(400).json({ error: 'INVALID_BASE64' });
      return;
    }

    if (buffer.byteLength > MAX_OUTCOME_VIDEO_BYTES) {
      res.status(413).json({ error: 'FILE_TOO_LARGE' });
      return;
    }

    try {
      const fileId = uuidv4();
      const key = buildOutcomeVideoKey(rehearsal.theaterId, rehearsalId, fileId, mimeType);
      const url = await uploadOutcomeVideoToS3(buffer, key, mimeType);
      if (!existingUrls.includes(url)) {
        writeOutcomeVideoUrls(db, rehearsalId, [...existingUrls, url]);
      }

      res.status(201).json({
        url,
        mimeType,
        size: buffer.byteLength,
        originalName: name,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UPLOAD_FAILED';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/rehearsals/:rehearsalId/outcome-videos', async (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const db = getDb();
    const plan = getUserSubscriptionPlan(db, session.user.id, session.user.email);
    if (plan !== 'pro') {
      res.status(402).json({ error: 'SUBSCRIPTION_PRO_REQUIRED' });
      return;
    }

    const rehearsalId = req.params.rehearsalId;
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!url || !isManagedOutcomeVideoUrl(url)) {
      res.status(400).json({ error: 'INVALID_VIDEO_URL' });
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

    const existingUrls = readOutcomeVideoUrls(db, rehearsalId);
    if (!existingUrls.includes(url)) {
      res.status(404).json({ error: 'VIDEO_NOT_FOUND' });
      return;
    }

    try {
      if (parseOutcomeVideoKeyFromUrl(url)) {
        await deleteOutcomeVideoFromS3(url);
      }
      writeOutcomeVideoUrls(
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
