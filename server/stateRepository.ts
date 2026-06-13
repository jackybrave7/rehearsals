import type {
  Actor,
  AppState,
  CastAssignment,
  Performance,
  Play,
  PlayRole,
  Rehearsal,
  Scene,
  ScheduleBlock,
  Task,
  Theater,
  Venue,
} from '../src/types/index.js';
import { backupState } from './backup.js';
import { getDb, type AppDatabase } from './db.js';

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function asBool(value: number | null | undefined): boolean {
  return value === 1;
}

function wouldLoseUserData(next: AppState, previous: AppState): boolean {
  if (isEmptyState(next) && !isEmptyState(previous)) return true;
  if (previous.rehearsals.length > 0 && next.rehearsals.length === 0) return true;
  if (previous.scenes.length > 0 && next.scenes.length === 0) return true;
  if (previous.performances.length > 0 && next.performances.length === 0) return true;
  if (previous.tasks.length > 0 && next.tasks.length === 0) return true;
  return false;
}

function parseOptionalJson<T>(value: string | null | undefined): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

export function isEmptyState(state: AppState): boolean {
  return (
    state.theaters.length === 0 &&
    state.actors.length === 0 &&
    state.plays.length === 0 &&
    state.scenes.length === 0 &&
    state.tasks.length === 0 &&
    state.rehearsals.length === 0 &&
    state.venues.length === 0 &&
    state.playRoles.length === 0 &&
    state.performances.length === 0 &&
    state.castAssignments.length === 0
  );
}

export function loadState(db: AppDatabase = getDb()): AppState | null {
  const theaterCount = db.prepare('SELECT COUNT(*) AS count FROM theaters').get() as { count: number };
  const playCount = db.prepare('SELECT COUNT(*) AS count FROM plays').get() as { count: number };
  if (theaterCount.count === 0 && playCount.count === 0) return null;

  const settings = db.prepare('SELECT * FROM app_settings WHERE id = 1').get() as
    | {
        active_theater_id: string | null;
        active_play_id: string | null;
        selected_performance_by_play_id: string;
        app_meta: string;
      }
    | undefined;

  const scheduleByRehearsal = new Map<string, ScheduleBlock[]>();
  const scheduleRows = db
    .prepare(
      `SELECT id, rehearsal_id, start_time, duration_minutes, type, title, scene_id, task_id,
              notes, decided_notes, remaining_notes
       FROM schedule_blocks
       ORDER BY rehearsal_id, block_order, start_time`
    )
    .all() as Array<{
    id: string;
    rehearsal_id: string;
    start_time: string;
    duration_minutes: number;
    type: ScheduleBlock['type'];
    title: string;
    scene_id: string | null;
    task_id: string | null;
    notes: string | null;
    decided_notes: string | null;
    remaining_notes: string | null;
  }>;

  for (const row of scheduleRows) {
    const block: ScheduleBlock = {
      id: row.id,
      startTime: row.start_time,
      durationMinutes: row.duration_minutes,
      type: row.type,
      title: row.title,
      sceneId: row.scene_id ?? undefined,
      taskId: row.task_id ?? undefined,
      notes: row.notes ?? undefined,
      decidedNotes: row.decided_notes ?? undefined,
      remainingNotes: row.remaining_notes ?? undefined,
    };
    const list = scheduleByRehearsal.get(row.rehearsal_id) ?? [];
    list.push(block);
    scheduleByRehearsal.set(row.rehearsal_id, list);
  }

  const theaters = (db.prepare('SELECT * FROM theaters').all() as Array<Record<string, unknown>>).map(
    (row): Theater => ({
      id: String(row.id),
      name: String(row.name),
      notes: (row.notes as string | null) ?? undefined,
    })
  );

  const plays = (db.prepare('SELECT * FROM plays').all() as Array<Record<string, unknown>>).map(
    (row): Play => ({
      id: String(row.id),
      theaterId: (row.theater_id as string | null) ?? undefined,
      title: String(row.title),
      author: String(row.author),
      description: (row.description as string | null) ?? undefined,
      year: (row.year as number | null) ?? undefined,
      documentUrl: (row.document_url as string | null) ?? undefined,
      googleDocumentId: (row.google_document_id as string | null) ?? undefined,
      googleDocsLinksSyncedAt: (row.google_docs_links_synced_at as string | null) ?? undefined,
      scriptFileName: (row.script_file_name as string | null) ?? undefined,
      scriptFileDataUrl: (row.script_file_data_url as string | null) ?? undefined,
      scriptFileMimeType: (row.script_file_mime_type as string | null) ?? undefined,
      scriptFileSize: (row.script_file_size as number | null) ?? undefined,
    })
  );

  const actors = (db.prepare('SELECT * FROM actors').all() as Array<Record<string, unknown>>).map(
    (row): Actor => ({
      id: String(row.id),
      theaterId: (row.theater_id as string | null) ?? undefined,
      name: String(row.name),
      status: row.status as Actor['status'],
      archiveReason: (row.archive_reason as string | null) ?? undefined,
      photoUrl: (row.photo_url as string | null) ?? undefined,
      phone: (row.phone as string | null) ?? undefined,
      email: (row.email as string | null) ?? undefined,
      telegramUsername: (row.telegram_username as string | null) ?? undefined,
      notes: (row.notes as string | null) ?? undefined,
    })
  );

  const venues = (db.prepare('SELECT * FROM venues').all() as Array<Record<string, unknown>>).map(
    (row): Venue => ({
      id: String(row.id),
      theaterId: (row.theater_id as string | null) ?? undefined,
      name: String(row.name),
      address: (row.address as string | null) ?? undefined,
      notes: (row.notes as string | null) ?? undefined,
    })
  );

  const playRoles = (
    db.prepare('SELECT * FROM play_roles ORDER BY role_order').all() as Array<Record<string, unknown>>
  ).map(
    (row): PlayRole => ({
      id: String(row.id),
      playId: String(row.play_id),
      name: String(row.name),
      kind: row.kind as PlayRole['kind'],
      order: Number(row.role_order),
      description: (row.description as string | null) ?? undefined,
    })
  );

  const performances = (
    db.prepare('SELECT * FROM performances').all() as Array<Record<string, unknown>>
  ).map(
    (row): Performance => ({
      id: String(row.id),
      playId: String(row.play_id),
      name: String(row.name),
      description: (row.description as string | null) ?? undefined,
      date: (row.date as string | null) ?? undefined,
      startTime: (row.start_time as string | null) ?? undefined,
      isDefault: asBool(row.is_default as number | null),
      notes: (row.notes as string | null) ?? undefined,
    })
  );

  const castAssignments = (
    db.prepare('SELECT * FROM cast_assignments').all() as Array<Record<string, unknown>>
  ).map(
    (row): CastAssignment => ({
      id: String(row.id),
      playId: String(row.play_id),
      performanceId: String(row.performance_id),
      roleId: String(row.role_id),
      actorId: String(row.actor_id),
    })
  );

  const scenes = (
    db.prepare('SELECT * FROM scenes ORDER BY number').all() as Array<Record<string, unknown>>
  ).map(
    (row): Scene => ({
      id: String(row.id),
      playId: String(row.play_id),
      number: Number(row.number),
      title: String(row.title),
      description: (row.description as string | null) ?? undefined,
      directorNotes: (row.director_notes as string | null) ?? undefined,
      estimatedMinutes: (row.estimated_minutes as number | null) ?? undefined,
      status: row.status as Scene['status'],
      priority: (row.priority as Scene['priority'] | null) ?? undefined,
      roleIds: parseJson<string[]>(row.role_ids as string, []),
      scriptAnchor: parseOptionalJson<Scene['scriptAnchor']>(row.script_anchor as string),
    })
  );

  const tasks = (db.prepare('SELECT * FROM tasks').all() as Array<Record<string, unknown>>).map(
    (row): Task => ({
      id: String(row.id),
      theaterId: (row.theater_id as string | null) ?? undefined,
      title: String(row.title),
      description: (row.description as string | null) ?? undefined,
      completed: asBool(row.completed as number | null),
      assignedActorIds: parseJson<string[]>(row.assigned_actor_ids as string, []),
      rehearsalId: (row.rehearsal_id as string | null) ?? undefined,
    })
  );

  const rehearsals = (
    db.prepare('SELECT * FROM rehearsals ORDER BY date, start_time').all() as Array<Record<string, unknown>>
  ).map(
    (row): Rehearsal => ({
      id: String(row.id),
      theaterId: (row.theater_id as string | null) ?? undefined,
      seriesId: (row.series_id as string | null) ?? undefined,
      date: String(row.date),
      startTime: String(row.start_time),
      endTime: String(row.end_time),
      venueId: (row.venue_id as string | null) ?? undefined,
      location: (row.location as string | null) ?? undefined,
      notes: (row.notes as string | null) ?? undefined,
      playId: (row.play_id as string | null) ?? undefined,
      performanceId: (row.performance_id as string | null) ?? undefined,
      sceneIds: parseJson<string[]>(row.scene_ids as string, []),
      taskIds: parseJson<string[]>(row.task_ids as string, []),
      actorIds: parseJson<string[]>(row.actor_ids as string, []),
      attendance: parseJson<Rehearsal['attendance']>(row.attendance as string | undefined, {}),
      participantOrder: parseJson<string[]>(row.participant_order as string | undefined, []),
      googleCalendarEventId: (row.google_calendar_event_id as string | null) ?? undefined,
      dismissedWarningIds: parseJson<string[]>(row.dismissed_warning_ids as string | undefined, []),
      schedule: scheduleByRehearsal.get(String(row.id)) ?? [],
    })
  );

  return {
    theaters,
    activeTheaterId: settings?.active_theater_id ?? null,
    actors,
    plays,
    activePlayId: settings?.active_play_id ?? null,
    selectedPerformanceByPlayId: parseJson(settings?.selected_performance_by_play_id, {}),
    playRoles,
    performances,
    castAssignments,
    scenes,
    tasks,
    venues,
    rehearsals,
    appMeta: parseJson(settings?.app_meta, {}),
  };
}

export function saveState(state: AppState, db: AppDatabase = getDb()): void {
  const existing = loadState(db);
  if (existing && wouldLoseUserData(state, existing)) {
    throw new Error('WOULD_LOSE_USER_DATA');
  }

  if (existing && !isEmptyState(existing)) {
    backupState(existing);
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM schedule_blocks').run();
    db.prepare('DELETE FROM rehearsals').run();
    db.prepare('DELETE FROM tasks').run();
    db.prepare('DELETE FROM scenes').run();
    db.prepare('DELETE FROM cast_assignments').run();
    db.prepare('DELETE FROM performances').run();
    db.prepare('DELETE FROM play_roles').run();
    db.prepare('DELETE FROM venues').run();
    db.prepare('DELETE FROM actors').run();
    db.prepare('DELETE FROM plays').run();
    db.prepare('DELETE FROM theaters').run();
    db.prepare('DELETE FROM app_settings').run();

    db.prepare(
      `INSERT INTO app_settings (id, active_theater_id, active_play_id, selected_performance_by_play_id, app_meta)
       VALUES (1, ?, ?, ?, ?)`
    ).run(
      state.activeTheaterId,
      state.activePlayId,
      JSON.stringify(state.selectedPerformanceByPlayId ?? {}),
      JSON.stringify(state.appMeta ?? {})
    );

    const insertTheater = db.prepare(`INSERT INTO theaters (id, name, notes) VALUES (?, ?, ?)`);
    for (const theater of state.theaters) {
      insertTheater.run(theater.id, theater.name, theater.notes ?? null);
    }

    const insertPlay = db.prepare(
      `INSERT INTO plays (
        id, theater_id, title, author, description, year, document_url, google_document_id,
        google_docs_links_synced_at, script_file_name, script_file_data_url,
        script_file_mime_type, script_file_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const play of state.plays) {
      insertPlay.run(
        play.id,
        play.theaterId ?? null,
        play.title,
        play.author,
        play.description ?? null,
        play.year ?? null,
        play.documentUrl ?? null,
        play.googleDocumentId ?? null,
        play.googleDocsLinksSyncedAt ?? null,
        play.scriptFileName ?? null,
        play.scriptFileDataUrl ?? null,
        play.scriptFileMimeType ?? null,
        play.scriptFileSize ?? null
      );
    }

    const insertActor = db.prepare(
      `INSERT INTO actors (
        id, theater_id, name, status, archive_reason, photo_url, phone, email, telegram_username, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const actor of state.actors) {
      insertActor.run(
        actor.id,
        actor.theaterId ?? null,
        actor.name,
        actor.status,
        actor.archiveReason ?? null,
        actor.photoUrl ?? null,
        actor.phone ?? null,
        actor.email ?? null,
        actor.telegramUsername ?? null,
        actor.notes ?? null
      );
    }

    const insertVenue = db.prepare(
      `INSERT INTO venues (id, theater_id, name, address, notes) VALUES (?, ?, ?, ?, ?)`
    );
    for (const venue of state.venues) {
      insertVenue.run(venue.id, venue.theaterId ?? null, venue.name, venue.address ?? null, venue.notes ?? null);
    }

    const insertRole = db.prepare(
      `INSERT INTO play_roles (id, play_id, name, kind, role_order, description)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const role of state.playRoles) {
      insertRole.run(
        role.id,
        role.playId,
        role.name,
        role.kind,
        role.order,
        role.description ?? null
      );
    }

    const insertPerformance = db.prepare(
      `INSERT INTO performances (id, play_id, name, description, date, start_time, is_default, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const performance of state.performances) {
      insertPerformance.run(
        performance.id,
        performance.playId,
        performance.name,
        performance.description ?? null,
        performance.date ?? null,
        performance.startTime ?? null,
        performance.isDefault ? 1 : 0,
        performance.notes ?? null
      );
    }

    const insertAssignment = db.prepare(
      `INSERT INTO cast_assignments (id, play_id, performance_id, role_id, actor_id)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const assignment of state.castAssignments) {
      insertAssignment.run(
        assignment.id,
        assignment.playId,
        assignment.performanceId,
        assignment.roleId,
        assignment.actorId
      );
    }

    const insertScene = db.prepare(
      `INSERT INTO scenes (
        id, play_id, number, title, description, director_notes, estimated_minutes, status,
        priority, role_ids, script_anchor
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const scene of state.scenes) {
      insertScene.run(
        scene.id,
        scene.playId,
        scene.number,
        scene.title,
        scene.description ?? null,
        scene.directorNotes ?? null,
        scene.estimatedMinutes ?? null,
        scene.status,
        scene.priority ?? null,
        JSON.stringify(scene.roleIds ?? []),
        scene.scriptAnchor ? JSON.stringify(scene.scriptAnchor) : null
      );
    }

    const insertTask = db.prepare(
      `INSERT INTO tasks (id, theater_id, title, description, completed, assigned_actor_ids, rehearsal_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const task of state.tasks) {
      insertTask.run(
        task.id,
        task.theaterId ?? null,
        task.title,
        task.description ?? null,
        task.completed ? 1 : 0,
        JSON.stringify(task.assignedActorIds ?? []),
        task.rehearsalId ?? null
      );
    }

    const insertRehearsal = db.prepare(
      `INSERT INTO rehearsals (
        id, theater_id, series_id, date, start_time, end_time, venue_id, location, notes, play_id, performance_id,
        scene_ids, task_ids, actor_ids, attendance, participant_order, google_calendar_event_id,
        dismissed_warning_ids
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const rehearsal of state.rehearsals) {
      insertRehearsal.run(
        rehearsal.id,
        rehearsal.theaterId ?? null,
        rehearsal.seriesId ?? null,
        rehearsal.date,
        rehearsal.startTime,
        rehearsal.endTime,
        rehearsal.venueId ?? null,
        rehearsal.location ?? null,
        rehearsal.notes ?? null,
        rehearsal.playId ?? null,
        rehearsal.performanceId ?? null,
        JSON.stringify(rehearsal.sceneIds ?? []),
        JSON.stringify(rehearsal.taskIds ?? []),
        JSON.stringify(rehearsal.actorIds ?? []),
        JSON.stringify(rehearsal.attendance ?? {}),
        JSON.stringify(rehearsal.participantOrder ?? []),
        rehearsal.googleCalendarEventId ?? null,
        JSON.stringify(rehearsal.dismissedWarningIds ?? [])
      );
    }

    const insertBlock = db.prepare(
      `INSERT INTO schedule_blocks (
        id, rehearsal_id, start_time, duration_minutes, type, title, scene_id, task_id, notes,
        decided_notes, remaining_notes, block_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const rehearsal of state.rehearsals) {
      rehearsal.schedule.forEach((block, index) => {
        insertBlock.run(
          block.id,
          rehearsal.id,
          block.startTime,
          block.durationMinutes,
          block.type,
          block.title,
          block.sceneId ?? null,
          block.taskId ?? null,
          block.notes ?? null,
          block.decidedNotes ?? null,
          block.remainingNotes ?? null,
          index
        );
      });
    }
  });

  tx();
}
