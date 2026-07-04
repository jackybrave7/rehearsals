import type { Express, Response } from 'express';
import { getDb, type AppDatabase } from './db.js';
import { requireAuth, getTheaterRole, canReadTheater } from './auth.js';
import type { AuthSessionPayload } from './authTypes.js';
import type { ActorUnavailability, MemorizationStatus, RehearsalActorNote, RsvpStatus } from '../src/types/index.js';
import { getExpectedActorIds } from '../src/utils/rehearsalInsights.js';
import { isRehearsalPast } from '../src/utils/rehearsalSort.js';
import { timeToMinutes } from '../src/utils/time.js';
import { loadStateForUser } from './stateUserScope.js';
import { resolveSceneBodyFromScriptFile } from './sceneLearnText.js';
import { normalizeActorEmail, normalizeActorName } from '../src/utils/actorProfile.js';

const RSVP_STATUSES = new Set<RsvpStatus>(['confirmed', 'declined', 'late']);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

type ActorRow = {
  id: string;
  theater_id: string | null;
  name: string;
  status: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  notes: string | null;
  unavailability: string;
  memorization_by_scene: string;
};

function findLinkedActorRow(
  db: AppDatabase,
  userEmail: string,
  theaterId: string,
  userName?: string | null
): ActorRow | undefined {
  const normalizedEmail = normalizeActorEmail(userEmail);
  const rows = db
    .prepare(
      `SELECT id, theater_id, name, status, email, phone, photo_url, notes, unavailability, memorization_by_scene
       FROM actors
       WHERE theater_id = ? AND status = 'active'`
    )
    .all(theaterId) as ActorRow[];

  if (normalizedEmail) {
    const byEmail = rows.filter(
      (row) => normalizeActorEmail(row.email) === normalizedEmail
    );
    if (byEmail.length === 1) return byEmail[0];
  }

  const normalizedName = normalizeActorName(userName);
  if (!normalizedName) return undefined;

  const byName = rows.filter((row) => normalizeActorName(row.name) === normalizedName);
  return byName.length === 1 ? byName[0] : undefined;
}

function resolveActorTheaterId(session: AuthSessionPayload, theaterId?: string): string | null {
  if (theaterId && canReadTheater(session, theaterId)) return theaterId;

  const actorTheater = session.theaters.find((entry) => entry.role === 'actor');
  return actorTheater?.theaterId ?? session.theaters[0]?.theaterId ?? null;
}

function assertActorTheaterAccess(
  session: AuthSessionPayload,
  theaterId: string,
  res: Response
): boolean {
  if (!canReadTheater(session, theaterId)) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return false;
  }

  const role = getTheaterRole(session, theaterId);
  if (role !== 'actor' && role !== 'owner' && role !== 'editor' && role !== 'observer') {
    res.status(403).json({ error: 'FORBIDDEN' });
    return false;
  }

  if (role !== 'actor') {
    res.status(403).json({ error: 'ACTOR_ROLE_REQUIRED' });
    return false;
  }

  return true;
}

function assertLinkedActor(
  session: AuthSessionPayload,
  theaterId: string,
  db: AppDatabase,
  res: Response
): ActorRow | null {
  const actor = findLinkedActorRow(db, session.user.email, theaterId, session.user.name);
  if (!actor) {
    res.status(404).json({ error: 'LINKED_ACTOR_NOT_FOUND' });
    return null;
  }
  return actor;
}

function isActorRehearsalParticipant(
  session: AuthSessionPayload,
  actorId: string,
  rehearsalId: string,
  db: AppDatabase
): boolean {
  const state = loadStateForUser(session, db);
  if (!state) return false;

  const rehearsal = state.rehearsals.find((item) => item.id === rehearsalId);
  if (!rehearsal) return false;

  return getExpectedActorIds(state, rehearsal).includes(actorId);
}

export function registerActorSelfRoutes(app: Express) {
  app.get('/api/actor/me', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const requestedTheaterId =
      typeof req.query.theaterId === 'string' ? req.query.theaterId : undefined;
    const theaterId = resolveActorTheaterId(session, requestedTheaterId);
    if (!theaterId) {
      res.status(404).json({ error: 'NO_THEATER' });
      return;
    }

    const db = getDb();
    const role = getTheaterRole(session, theaterId);
    const linkedActor = findLinkedActorRow(db, session.user.email, theaterId, session.user.name);

    res.json({
      theaterId,
      role,
      linked: linkedActor
        ? {
            id: linkedActor.id,
            name: linkedActor.name,
            email: linkedActor.email,
            phone: linkedActor.phone,
            photoUrl: linkedActor.photo_url,
            notes: linkedActor.notes,
            status: linkedActor.status,
            unavailability: parseJson<ActorUnavailability[]>(linkedActor.unavailability, []),
            memorizationByScene: parseJson<Record<string, MemorizationStatus>>(
              linkedActor.memorization_by_scene,
              {}
            ),
          }
        : null,
    });
  });

  app.get('/api/actor/me/rehearsals-rsvp', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const requestedTheaterId =
      typeof req.query.theaterId === 'string' ? req.query.theaterId : undefined;
    const theaterId = resolveActorTheaterId(session, requestedTheaterId);
    if (!theaterId) {
      res.status(404).json({ error: 'NO_THEATER' });
      return;
    }

    if (!assertActorTheaterAccess(session, theaterId, res)) return;

    const db = getDb();
    const actor = assertLinkedActor(session, theaterId, db, res);
    if (!actor) return;

    const state = loadStateForUser(session, db);
    if (!state) {
      res.json({ rehearsals: [] });
      return;
    }

    const upcoming = state.rehearsals
      .filter(
        (rehearsal) =>
          rehearsal.theaterId === theaterId &&
          !isRehearsalPast(rehearsal) &&
          getExpectedActorIds(state, rehearsal).includes(actor.id)
      )
      .sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        return a.startTime.localeCompare(b.startTime);
      });

    const rsvpStmt = db.prepare(`SELECT rsvp FROM rehearsals WHERE id = ?`);
    const rehearsals = upcoming.map((rehearsal) => {
      const row = rsvpStmt.get(rehearsal.id) as { rsvp: string } | undefined;
      return {
        rehearsalId: rehearsal.id,
        rsvp: parseJson<Record<string, RsvpStatus>>(row?.rsvp, {}),
      };
    });

    res.json({ rehearsals });
  });

  app.patch('/api/actor/me/availability', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const theaterId = typeof req.body?.theaterId === 'string' ? req.body.theaterId : '';
    const unavailability = req.body?.unavailability;

    if (!theaterId || !Array.isArray(unavailability)) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    if (!assertActorTheaterAccess(session, theaterId, res)) return;

    const db = getDb();
    const actor = assertLinkedActor(session, theaterId, db, res);
    if (!actor) return;

    const normalized: ActorUnavailability[] = unavailability.map((entry: ActorUnavailability) => {
      const recurrence =
        entry.recurrence === 'weekly' ? 'weekly' : entry.recurrence === 'none' ? 'none' : undefined;
      const weekdays =
        recurrence === 'weekly' && Array.isArray(entry.weekdays)
          ? entry.weekdays.filter(
              (day): day is number => Number.isInteger(day) && day >= 0 && day <= 6
            )
          : undefined;

      return {
        id: typeof entry.id === 'string' ? entry.id : '',
        from: typeof entry.from === 'string' ? entry.from : '',
        to: typeof entry.to === 'string' ? entry.to : '',
        reason: typeof entry.reason === 'string' ? entry.reason : undefined,
        recurrence,
        weekdays: weekdays?.length ? weekdays : undefined,
        startTime: typeof entry.startTime === 'string' ? entry.startTime : undefined,
        endTime: typeof entry.endTime === 'string' ? entry.endTime : undefined,
      };
    });

    if (
      normalized.some((entry) => {
        if (!entry.id || !entry.from || !entry.to) return true;
        if (entry.recurrence === 'weekly' && !entry.weekdays?.length) return true;
        const hasStart = Boolean(entry.startTime?.trim());
        const hasEnd = Boolean(entry.endTime?.trim());
        if (hasStart !== hasEnd) return true;
        if (hasStart && hasEnd && timeToMinutes(entry.startTime!) >= timeToMinutes(entry.endTime!)) {
          return true;
        }
        return false;
      })
    ) {
      res.status(400).json({ error: 'INVALID_UNAVAILABILITY' });
      return;
    }

    db.prepare(`UPDATE actors SET unavailability = ? WHERE id = ? AND theater_id = ?`).run(
      JSON.stringify(normalized),
      actor.id,
      theaterId
    );

    res.json({ ok: true, unavailability: normalized });
  });

  app.patch('/api/actor/me/rsvp', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const rehearsalId = typeof req.body?.rehearsalId === 'string' ? req.body.rehearsalId : '';
    const clear = req.body?.status === null || req.body?.status === '';
    const status = req.body?.status as RsvpStatus;

    if (!rehearsalId || (!clear && !RSVP_STATUSES.has(status))) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    const db = getDb();
    const rehearsalRow = db
      .prepare(`SELECT id, theater_id, rsvp FROM rehearsals WHERE id = ?`)
      .get(rehearsalId) as { id: string; theater_id: string | null; rsvp: string } | undefined;

    if (!rehearsalRow?.theater_id) {
      res.status(404).json({ error: 'REHEARSAL_NOT_FOUND' });
      return;
    }

    if (!assertActorTheaterAccess(session, rehearsalRow.theater_id, res)) return;

    const actor = assertLinkedActor(session, rehearsalRow.theater_id, db, res);
    if (!actor) return;

    if (!isActorRehearsalParticipant(session, actor.id, rehearsalId, db)) {
      res.status(403).json({ error: 'NOT_PARTICIPANT' });
      return;
    }

    const current = parseJson<Record<string, RsvpStatus>>(rehearsalRow.rsvp, {});
    if (clear) delete current[actor.id];
    else current[actor.id] = status;
    db.prepare(`UPDATE rehearsals SET rsvp = ? WHERE id = ?`).run(JSON.stringify(current), rehearsalId);

    res.json({ ok: true, rsvp: current });
  });

  const MEMORIZATION_STATUSES = new Set<MemorizationStatus>(['not_started', 'learning', 'known']);

  app.patch('/api/actor/me/memorization', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const theaterId = typeof req.body?.theaterId === 'string' ? req.body.theaterId : '';
    const sceneId = typeof req.body?.sceneId === 'string' ? req.body.sceneId : '';
    const status = req.body?.status as MemorizationStatus;

    if (!theaterId || !sceneId || !MEMORIZATION_STATUSES.has(status)) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    if (!assertActorTheaterAccess(session, theaterId, res)) return;

    const db = getDb();
    const actor = assertLinkedActor(session, theaterId, db, res);
    if (!actor) return;

    const current = parseJson<Record<string, MemorizationStatus>>(actor.memorization_by_scene, {});
    current[sceneId] = status;

    db.prepare(`UPDATE actors SET memorization_by_scene = ? WHERE id = ? AND theater_id = ?`).run(
      JSON.stringify(current),
      actor.id,
      theaterId
    );

    res.json({ ok: true, memorizationByScene: current });
  });

  app.patch('/api/actor/me/profile', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const theaterId = typeof req.body?.theaterId === 'string' ? req.body.theaterId : '';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
    const photoUrl =
      req.body?.photoUrl === null
        ? null
        : typeof req.body?.photoUrl === 'string'
          ? req.body.photoUrl
          : undefined;
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;

    if (!theaterId) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    if (name === undefined && photoUrl === undefined && notes === undefined) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    if (name !== undefined && !name) {
      res.status(400).json({ error: 'INVALID_NAME' });
      return;
    }

    if (!assertActorTheaterAccess(session, theaterId, res)) return;

    const db = getDb();
    const actor = assertLinkedActor(session, theaterId, db, res);
    if (!actor) return;

    const updates: string[] = [];
    const values: unknown[] = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (photoUrl !== undefined) {
      updates.push('photo_url = ?');
      values.push(photoUrl);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    db.prepare(`UPDATE actors SET ${updates.join(', ')} WHERE id = ? AND theater_id = ?`).run(
      ...values,
      actor.id,
      theaterId
    );

    const updated = db
      .prepare(
        `SELECT id, theater_id, name, status, email, phone, photo_url, notes, unavailability, memorization_by_scene
         FROM actors WHERE id = ?`
      )
      .get(actor.id) as ActorRow;

    res.json({
      ok: true,
      linked: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        photoUrl: updated.photo_url,
        notes: updated.notes,
        status: updated.status,
        unavailability: parseJson<ActorUnavailability[]>(updated.unavailability, []),
        memorizationByScene: parseJson<Record<string, MemorizationStatus>>(
          updated.memorization_by_scene,
          {}
        ),
      },
    });
  });

  app.get('/api/actor/me/scenes/:sceneId/learn-text', async (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const sceneId = typeof req.params.sceneId === 'string' ? req.params.sceneId : '';
    if (!sceneId) {
      res.status(400).json({ error: 'INVALID_SCENE' });
      return;
    }

    const requestedTheaterId =
      typeof req.query.theaterId === 'string' ? req.query.theaterId : undefined;
    const theaterId = resolveActorTheaterId(session, requestedTheaterId);
    if (!theaterId) {
      res.status(404).json({ error: 'NO_THEATER' });
      return;
    }

    if (!assertActorTheaterAccess(session, theaterId, res)) return;

    const db = getDb();
    const actor = assertLinkedActor(session, theaterId, db, res);
    if (!actor) return;

    const state = loadStateForUser(session, db);
    if (!state) {
      res.status(404).json({ error: 'SCENE_NOT_FOUND' });
      return;
    }

    const scene = state.scenes.find((item) => item.id === sceneId);
    if (!scene) {
      res.status(404).json({ error: 'SCENE_NOT_FOUND' });
      return;
    }

    const play = state.plays.find((item) => item.id === scene.playId);
    if (!play) {
      res.status(404).json({ error: 'PLAY_NOT_FOUND' });
      return;
    }

    try {
      const text = await resolveSceneBodyFromScriptFile(play, scene);
      if (text) {
        res.json({ text, source: 'script_file' });
        return;
      }

      const hasGoogleDoc = Boolean(play.documentUrl || play.googleDocumentId);
      const hasGoogleAnchor =
        Boolean(scene.scriptAnchor) && !scene.scriptAnchor?.id.startsWith('file-');

      if (hasGoogleDoc && hasGoogleAnchor) {
        res.json({ text: null, source: 'none', needsGoogleAuth: true });
        return;
      }

      res.json({ text: null, source: 'none' });
    } catch (error) {
      console.error('[api] actor learn text failed', error);
      res.status(500).json({ error: 'LOAD_FAILED' });
    }
  });

  app.get('/api/actor/me/notes', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const requestedTheaterId =
      typeof req.query.theaterId === 'string' ? req.query.theaterId : undefined;
    const theaterId = resolveActorTheaterId(session, requestedTheaterId);
    if (!theaterId) {
      res.status(404).json({ error: 'NO_THEATER' });
      return;
    }

    if (!assertActorTheaterAccess(session, theaterId, res)) return;

    const db = getDb();
    const actor = assertLinkedActor(session, theaterId, db, res);
    if (!actor) return;

    const rows = db
      .prepare(
        `SELECT id, theater_id, rehearsal_id, actor_id, scene_id, schedule_block_id, text, created_at, sent_at, acknowledged_at
         FROM rehearsal_actor_notes
         WHERE theater_id = ? AND actor_id = ?
         ORDER BY created_at DESC`
      )
      .all(theaterId, actor.id) as Array<{
      id: string;
      theater_id: string;
      rehearsal_id: string;
      actor_id: string;
      scene_id: string | null;
      schedule_block_id: string | null;
      text: string;
      created_at: string;
      sent_at: string | null;
      acknowledged_at: string | null;
    }>;

    const notes: RehearsalActorNote[] = rows.map((row) => ({
      id: row.id,
      theaterId: row.theater_id,
      rehearsalId: row.rehearsal_id,
      actorId: row.actor_id,
      sceneId: row.scene_id ?? undefined,
      scheduleBlockId: row.schedule_block_id ?? undefined,
      text: row.text,
      createdAt: row.created_at,
      sentAt: row.sent_at ?? undefined,
      acknowledgedAt: row.acknowledged_at ?? undefined,
    }));

    res.json({ notes });
  });

  app.patch('/api/actor/me/notes/:noteId/acknowledge', (req, res) => {
    const session = requireAuth(req, res);
    if (!session) return;

    const noteId = req.params.noteId;
    const theaterId = typeof req.body?.theaterId === 'string' ? req.body.theaterId : '';
    if (!theaterId) {
      res.status(400).json({ error: 'INVALID_BODY' });
      return;
    }

    if (!assertActorTheaterAccess(session, theaterId, res)) return;

    const db = getDb();
    const actor = assertLinkedActor(session, theaterId, db, res);
    if (!actor) return;

    const row = db
      .prepare(
        `SELECT id, theater_id, rehearsal_id, actor_id, scene_id, schedule_block_id, text, created_at, sent_at, acknowledged_at
         FROM rehearsal_actor_notes WHERE id = ?`
      )
      .get(noteId) as {
      id: string;
      theater_id: string;
      rehearsal_id: string;
      actor_id: string;
      scene_id: string | null;
      schedule_block_id: string | null;
      text: string;
      created_at: string;
      sent_at: string | null;
      acknowledged_at: string | null;
    } | undefined;

    if (!row || row.theater_id !== theaterId || row.actor_id !== actor.id) {
      res.status(404).json({ error: 'NOTE_NOT_FOUND' });
      return;
    }

    if (!row.sent_at) {
      res.status(400).json({ error: 'NOTE_NOT_SENT' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(`UPDATE rehearsal_actor_notes SET acknowledged_at = ? WHERE id = ?`).run(now, noteId);

    const note: RehearsalActorNote = {
      id: row.id,
      theaterId: row.theater_id,
      rehearsalId: row.rehearsal_id,
      actorId: row.actor_id,
      sceneId: row.scene_id ?? undefined,
      scheduleBlockId: row.schedule_block_id ?? undefined,
      text: row.text,
      createdAt: row.created_at,
      sentAt: row.sent_at ?? undefined,
      acknowledgedAt: now,
    };

    res.json({ ok: true, note });
  });
}
