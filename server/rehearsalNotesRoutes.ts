import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Express } from 'express';
import { canEditTheater, canReadTheater, requireAuth } from './auth.js';
import { getDb } from './db.js';
import { getTelegramBotToken, sendTelegramHtmlMessage } from './telegram.js';
import { loadStateForUser } from './stateUserScope.js';
import type { RehearsalActorNote } from '../src/types/index.js';
import { getSceneShortLabel } from '../src/utils/sceneLabels.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function registerRehearsalNotesRoutes(app: Express): void {
  app.get('/api/rehearsals/:rehearsalId/rsvp', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const rehearsalId = req.params.rehearsalId;
    const db = getDb();
    const row = db
      .prepare(`SELECT id, theater_id, rsvp FROM rehearsals WHERE id = ?`)
      .get(rehearsalId) as { id: string; theater_id: string | null; rsvp: string } | undefined;

    if (!row?.theater_id) {
      res.status(404).json({ error: 'REHEARSAL_NOT_FOUND' });
      return;
    }

    if (!canReadTheater(session, row.theater_id)) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }

    res.json({ rsvp: parseJson(row.rsvp, {}) });
  });

  app.post('/api/rehearsals/:rehearsalId/distribute-notes', async (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const rehearsalId = req.params.rehearsalId;
    const db = getDb();
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

    const token = getTelegramBotToken();
    if (!token) {
      res.status(503).json({ error: 'BOT_NOT_CONFIGURED' });
      return;
    }

    const unsentNotes = (state.rehearsalActorNotes ?? []).filter(
      (note) => note.rehearsalId === rehearsalId && !note.sentAt
    );
    if (unsentNotes.length === 0) {
      res.json({ ok: true, notes: [] });
      return;
    }

    const byActor = new Map<string, RehearsalActorNote[]>();
    for (const note of unsentNotes) {
      const list = byActor.get(note.actorId) ?? [];
      list.push(note);
      byActor.set(note.actorId, list);
    }

    const now = new Date().toISOString();
    const updateSentAt = db.prepare(
      `UPDATE rehearsal_actor_notes SET sent_at = ? WHERE id = ? AND sent_at IS NULL`
    );

    const updatedNotes: RehearsalActorNote[] = [];
    const rehearsalDateLabel = format(parseISO(rehearsal.date), 'd MMMM yyyy', { locale: ru });

    for (const [actorId, notes] of byActor) {
      const actor = state.actors.find((item) => item.id === actorId);
      const chatId = actor?.telegramChatId?.trim();
      if (!chatId) continue;

      const lines = notes.map((note) => {
        const scene = note.sceneId
          ? state.scenes.find((item) => item.id === note.sceneId)
          : undefined;
        const sceneLabel = scene ? getSceneShortLabel(scene) : null;
        const prefix = sceneLabel ? `<b>${sceneLabel}</b>\n` : '';
        return `${prefix}${escapeHtml(note.text)}`;
      });

      const html = `<b>Замечания с репетиции ${rehearsalDateLabel}</b>\n\n${lines.join('\n\n')}`;
      try {
        await sendTelegramHtmlMessage(chatId, html, token);
        for (const note of notes) {
          updateSentAt.run(now, note.id);
          updatedNotes.push({ ...note, sentAt: now });
        }
      } catch (error) {
        console.error(`[api] distribute-notes failed for actor ${actorId}`, error);
      }
    }

    res.json({ ok: true, notes: updatedNotes });
  });
}
