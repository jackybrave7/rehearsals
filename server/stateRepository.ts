import type {
  Actor,
  AppState,
  CastAssignment,
  Performance,
  Play,
  PlayRole,
  Rehearsal,
  RehearsalActorNote,
  Scene,
  ScheduleBlock,
  Task,
  Theater,
  TheaterReminderSettings,
  Venue,
} from '../src/types/index.js';
import { backupState } from './backup.js';
import { getDb, type AppDatabase } from './db.js';
import { syncDecidedNotesToActorNotes } from '../src/utils/decidedNotesMentions.js';

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function loadPreservedActorTelegramChatIds(db: AppDatabase): Map<string, string> {
  return new Map(
    (
      db
        .prepare(
          `SELECT id, telegram_chat_id FROM actors WHERE telegram_chat_id IS NOT NULL AND trim(telegram_chat_id) != ''`
        )
        .all() as Array<{ id: string; telegram_chat_id: string }>
    ).map((row) => [row.id, row.telegram_chat_id.trim()])
  );
}

function asBool(value: number | null | undefined): boolean {
  return value === 1;
}

export function wouldLoseUserData(next: AppState, previous: AppState): boolean {
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

function parseTheaterReminderSettings(
  value: string | null | undefined
): TheaterReminderSettings | undefined {
  const parsed = parseOptionalJson<TheaterReminderSettings>(value);
  if (!parsed || typeof parsed.enabled !== 'boolean' || !Array.isArray(parsed.types)) {
    return undefined;
  }
  return parsed;
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

export interface LoadStateOptions {
  theaterIds?: string[];
  userId?: string;
}

function inClause(ids: string[]): { sql: string; params: string[] } {
  if (ids.length === 0) return { sql: 'NULL', params: [] };
  return { sql: ids.map(() => '?').join(', '), params: ids };
}

function ensureUserSettings(
  db: AppDatabase,
  userId: string
): {
  active_theater_id: string | null;
  active_play_id: string | null;
  selected_performance_by_play_id: string;
  app_meta: string;
} {
  let row = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) as
    | {
        active_theater_id: string | null;
        active_play_id: string | null;
        selected_performance_by_play_id: string;
        app_meta: string;
      }
    | undefined;

  if (!row) {
    const legacy = db.prepare('SELECT * FROM app_settings WHERE id = 1').get() as
      | {
          active_theater_id: string | null;
          active_play_id: string | null;
          selected_performance_by_play_id: string;
          app_meta: string;
        }
      | undefined;
    db.prepare(
      `INSERT INTO user_settings (user_id, active_theater_id, active_play_id, selected_performance_by_play_id, app_meta)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      userId,
      legacy?.active_theater_id ?? null,
      legacy?.active_play_id ?? null,
      legacy?.selected_performance_by_play_id ?? '{}',
      legacy?.app_meta ?? '{}'
    );
    row = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) as typeof row;
  }

  return row!;
}

export function filterStateByTheaters(state: AppState, theaterIds: Set<string>): AppState {
  if (theaterIds.size === 0) {
    return {
      theaters: [],
      activeTheaterId: state.activeTheaterId,
      actors: [],
      plays: [],
      activePlayId: state.activePlayId,
      selectedPerformanceByPlayId: state.selectedPerformanceByPlayId,
      playRoles: [],
      performances: [],
      castAssignments: [],
      scenes: [],
      tasks: [],
      venues: [],
      rehearsals: [],
      rehearsalActorNotes: [],
      appMeta: state.appMeta,
    };
  }

  const playIds = new Set(
    state.plays.filter((play) => play.theaterId && theaterIds.has(play.theaterId)).map((play) => play.id)
  );
  const rehearsalIds = new Set(
    state.rehearsals.filter((r) => r.theaterId && theaterIds.has(r.theaterId)).map((r) => r.id)
  );

  return {
    theaters: state.theaters.filter((t) => theaterIds.has(t.id)),
    activeTheaterId: state.activeTheaterId,
    actors: state.actors.filter((a) => a.theaterId && theaterIds.has(a.theaterId)),
    plays: state.plays.filter((p) => p.theaterId && theaterIds.has(p.theaterId)),
    activePlayId: state.activePlayId,
    selectedPerformanceByPlayId: state.selectedPerformanceByPlayId,
    playRoles: state.playRoles.filter((r) => playIds.has(r.playId)),
    performances: state.performances.filter((p) => playIds.has(p.playId)),
    castAssignments: state.castAssignments.filter((a) => playIds.has(a.playId)),
    scenes: state.scenes.filter((s) => playIds.has(s.playId)),
    tasks: state.tasks.filter((t) => t.theaterId && theaterIds.has(t.theaterId)),
    venues: state.venues.filter((v) => v.theaterId && theaterIds.has(v.theaterId)),
    rehearsals: state.rehearsals
      .filter((r) => r.theaterId && theaterIds.has(r.theaterId))
      .map((r) => ({ ...r, schedule: r.schedule ?? [] })),
    rehearsalActorNotes: (state.rehearsalActorNotes ?? []).filter(
      (note) => note.theaterId && theaterIds.has(note.theaterId)
    ),
    appMeta: state.appMeta,
  };
}

/** Удаляет содержимое театра, но сохраняет строку theaters и список theater_members. */
export function deleteTheaterContent(db: AppDatabase, theaterId: string): void {
  const playRows = db.prepare('SELECT id FROM plays WHERE theater_id = ?').all(theaterId) as Array<{ id: string }>;
  const playIds = playRows.map((row) => row.id);

  if (playIds.length > 0) {
    const playIn = inClause(playIds);
    db.prepare(`DELETE FROM cast_assignments WHERE play_id IN (${playIn.sql})`).run(...playIn.params);
    db.prepare(`DELETE FROM scenes WHERE play_id IN (${playIn.sql})`).run(...playIn.params);
    db.prepare(`DELETE FROM performances WHERE play_id IN (${playIn.sql})`).run(...playIn.params);
    db.prepare(`DELETE FROM play_roles WHERE play_id IN (${playIn.sql})`).run(...playIn.params);
  }

  db.prepare('DELETE FROM schedule_blocks WHERE rehearsal_id IN (SELECT id FROM rehearsals WHERE theater_id = ?)').run(
    theaterId
  );
  db.prepare('DELETE FROM rehearsal_actor_notes WHERE theater_id = ?').run(theaterId);
  db.prepare('DELETE FROM rehearsals WHERE theater_id = ?').run(theaterId);
  db.prepare('DELETE FROM tasks WHERE theater_id = ?').run(theaterId);
  db.prepare('DELETE FROM plays WHERE theater_id = ?').run(theaterId);
  db.prepare('DELETE FROM actors WHERE theater_id = ?').run(theaterId);
  db.prepare('DELETE FROM venues WHERE theater_id = ?').run(theaterId);
}

export function deleteTheaterData(db: AppDatabase, theaterId: string): void {
  deleteTheaterContent(db, theaterId);
  db.prepare('DELETE FROM theaters WHERE id = ?').run(theaterId);
}

export function insertStateEntities(
  db: AppDatabase,
  state: AppState,
  options?: {
    ownerByTheaterId?: Map<string, string | null>;
    addOwnerMembershipFor?: Set<string>;
    preservedActorTelegramChatIds?: Map<string, string>;
  }
): void {
  const insertTheater = db.prepare(
    `INSERT INTO theaters (id, name, notes, owner_user_id, telegram_chat_id, reminder_settings, timezone) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       notes = excluded.notes,
       owner_user_id = COALESCE(theaters.owner_user_id, excluded.owner_user_id),
       telegram_chat_id = excluded.telegram_chat_id,
       reminder_settings = excluded.reminder_settings,
       timezone = excluded.timezone`
  );
  for (const theater of state.theaters) {
    const ownerUserId = options?.ownerByTheaterId?.get(theater.id) ?? null;
    insertTheater.run(
      theater.id,
      theater.name,
      theater.notes ?? null,
      ownerUserId,
      theater.telegramChatId?.trim() || null,
      JSON.stringify(theater.reminderSettings ?? {}),
      theater.timezone ?? null
    );
    if (ownerUserId && options?.addOwnerMembershipFor?.has(theater.id)) {
      db.prepare(
        `INSERT OR IGNORE INTO theater_members (theater_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)`
      ).run(theater.id, ownerUserId, new Date().toISOString());
    }
  }

  const insertPlay = db.prepare(
    `INSERT INTO plays (
      id, theater_id, title, author, description, year, document_url, google_document_id,
      google_docs_links_synced_at, script_import_synced_at, script_file_name, script_file_data_url, script_file_url,
      script_file_mime_type, script_file_size, archived_at, act_script_anchors, cover_url, icon_url, icon_color
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const play of state.plays) {
    const legacyDataUrl = play.scriptFileUrl ? null : play.scriptFileDataUrl ?? null;
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
      play.scriptImportSyncedAt ?? null,
      play.scriptFileName ?? null,
      legacyDataUrl,
      play.scriptFileUrl ?? null,
      play.scriptFileMimeType ?? null,
      play.scriptFileSize ?? null,
      play.archivedAt ?? null,
      play.actScriptAnchors ? JSON.stringify(play.actScriptAnchors) : null,
      play.coverUrl ?? null,
      play.iconUrl ?? null,
      play.iconColor ?? null
    );
  }

  const insertActor = db.prepare(
    `INSERT INTO actors (
      id, theater_id, name, status, archive_reason, photo_url, phone, email, telegram_username, telegram_chat_id, notes, unavailability, memorization_by_scene
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const actor of state.actors) {
    const linkedChatId =
      actor.telegramChatId?.trim() ||
      options?.preservedActorTelegramChatIds?.get(actor.id) ||
      null;
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
      linkedChatId,
      actor.notes ?? null,
      JSON.stringify(actor.unavailability ?? []),
      JSON.stringify(actor.memorizationByScene ?? {})
    );
  }

  const insertVenue = db.prepare(
    `INSERT INTO venues (id, theater_id, name, address, notes) VALUES (?, ?, ?, ?, ?)`
  );
  for (const venue of state.venues) {
    insertVenue.run(venue.id, venue.theaterId ?? null, venue.name, venue.address ?? null, venue.notes ?? null);
  }

  const insertRole = db.prepare(
    `INSERT INTO play_roles (id, play_id, name, kind, role_order, description, script_aliases)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const role of state.playRoles) {
    insertRole.run(
      role.id,
      role.playId,
      role.name,
      role.kind,
      role.order,
      role.description ?? null,
      role.scriptAliases?.length ? JSON.stringify(role.scriptAliases) : null
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
      priority, role_ids, act_group, script_anchor, script_character_count, script_character_count_synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      scene.actGroup ?? null,
      scene.scriptAnchor ? JSON.stringify(scene.scriptAnchor) : null,
      scene.scriptCharacterCount ?? null,
      scene.scriptCharacterCountSyncedAt ?? null
    );
  }

  const insertTask = db.prepare(
    `INSERT INTO tasks (
      id, theater_id, title, description, completed, assigned_actor_ids, rehearsal_id,
      due_date, priority, play_id, scene_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const task of state.tasks) {
    insertTask.run(
      task.id,
      task.theaterId ?? null,
      task.title,
      task.description ?? null,
      task.completed ? 1 : 0,
      JSON.stringify(task.assignedActorIds ?? []),
      task.rehearsalId ?? null,
      task.dueDate ?? null,
      task.priority ?? null,
      task.playId ?? null,
      task.sceneId ?? null
    );
  }

  const insertRehearsal = db.prepare(
    `INSERT INTO rehearsals (
      id, theater_id, series_id, date, start_time, end_time, venue_id, location, notes, play_id, performance_id,
      scene_ids, task_ids, actor_ids, attendance, rsvp, participant_order, google_calendar_event_id,
      dismissed_warning_ids, reminders_sent, reminder_opt_out, telegram_plan_sent_at, outcome_photo_urls
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      JSON.stringify(rehearsal.rsvp ?? {}),
      JSON.stringify(rehearsal.participantOrder ?? []),
      rehearsal.googleCalendarEventId ?? null,
      JSON.stringify(rehearsal.dismissedWarningIds ?? []),
      JSON.stringify(rehearsal.remindersSent ?? []),
      rehearsal.reminderOptOut ? 1 : 0,
      rehearsal.telegramPlanSentAt ?? null,
      JSON.stringify(rehearsal.outcomePhotoUrls ?? [])
    );
  }

  const insertBlock = db.prepare(
    `INSERT INTO schedule_blocks (
      id, rehearsal_id, start_time, duration_minutes, type, title, scene_id, task_id, notes,
      decided_notes, remaining_notes, play_id, actor_ids, outcome_notes, block_order, completed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        block.playId ?? null,
        JSON.stringify(block.actorIds ?? []),
        block.outcomeNotes ?? null,
        index,
        block.completed === undefined ? null : block.completed ? 1 : 0
      );
    });
  }

  const insertNote = db.prepare(
    `INSERT INTO rehearsal_actor_notes (
      id, theater_id, rehearsal_id, actor_id, scene_id, schedule_block_id, text, created_at, sent_at, acknowledged_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const note of state.rehearsalActorNotes ?? []) {
    insertNote.run(
      note.id,
      note.theaterId,
      note.rehearsalId,
      note.actorId,
      note.sceneId ?? null,
      note.scheduleBlockId ?? null,
      note.text,
      note.createdAt,
      note.sentAt ?? null,
      note.acknowledgedAt ?? null
    );
  }
}

export function loadState(db: AppDatabase = getDb(), options?: LoadStateOptions): AppState | null {
  const theaterFilter = options?.theaterIds;
  const hasTheaterFilter = Array.isArray(theaterFilter);

  if (hasTheaterFilter && theaterFilter!.length === 0) {
    const settings = options?.userId ? ensureUserSettings(db, options.userId) : undefined;
    return {
      theaters: [],
      activeTheaterId: settings?.active_theater_id ?? null,
      actors: [],
      plays: [],
      activePlayId: settings?.active_play_id ?? null,
      selectedPerformanceByPlayId: parseJson(settings?.selected_performance_by_play_id, {}),
      playRoles: [],
      performances: [],
      castAssignments: [],
      scenes: [],
      tasks: [],
      venues: [],
      rehearsals: [],
      rehearsalActorNotes: [],
      appMeta: parseJson(settings?.app_meta, {}),
    };
  }

  const theaterIn = hasTheaterFilter ? inClause(theaterFilter!) : null;

  const theaterCount = hasTheaterFilter
    ? (db
        .prepare(`SELECT COUNT(*) AS count FROM theaters WHERE id IN (${theaterIn!.sql})`)
        .get(...theaterIn!.params) as { count: number })
    : (db.prepare('SELECT COUNT(*) AS count FROM theaters').get() as { count: number });
  const playCount = hasTheaterFilter
    ? (db
        .prepare(`SELECT COUNT(*) AS count FROM plays WHERE theater_id IN (${theaterIn!.sql})`)
        .get(...theaterIn!.params) as { count: number })
    : (db.prepare('SELECT COUNT(*) AS count FROM plays').get() as { count: number });

  if (!hasTheaterFilter && theaterCount.count === 0 && playCount.count === 0) return null;
  if (hasTheaterFilter && theaterCount.count === 0 && playCount.count === 0) {
    const settings = options?.userId ? ensureUserSettings(db, options.userId) : undefined;
    return {
      theaters: [],
      activeTheaterId: settings?.active_theater_id ?? null,
      actors: [],
      plays: [],
      activePlayId: settings?.active_play_id ?? null,
      selectedPerformanceByPlayId: parseJson(settings?.selected_performance_by_play_id, {}),
      playRoles: [],
      performances: [],
      castAssignments: [],
      scenes: [],
      tasks: [],
      venues: [],
      rehearsals: [],
      rehearsalActorNotes: [],
      appMeta: parseJson(settings?.app_meta, {}),
    };
  }

  const settings = options?.userId
    ? ensureUserSettings(db, options.userId)
    : (db.prepare('SELECT * FROM app_settings WHERE id = 1').get() as
        | {
            active_theater_id: string | null;
            active_play_id: string | null;
            selected_performance_by_play_id: string;
            app_meta: string;
          }
        | undefined);

  const scheduleByRehearsal = new Map<string, ScheduleBlock[]>();
  const scheduleSql = hasTheaterFilter
    ? `SELECT sb.id, sb.rehearsal_id, sb.start_time, sb.duration_minutes, sb.type, sb.title, sb.scene_id, sb.task_id,
              sb.notes, sb.decided_notes, sb.remaining_notes, sb.play_id, sb.actor_ids, sb.outcome_notes, sb.completed
       FROM schedule_blocks sb
       JOIN rehearsals r ON r.id = sb.rehearsal_id
       WHERE r.theater_id IN (${theaterIn!.sql})
       ORDER BY sb.rehearsal_id, sb.block_order, sb.start_time`
    : `SELECT id, rehearsal_id, start_time, duration_minutes, type, title, scene_id, task_id,
              notes, decided_notes, remaining_notes, play_id, actor_ids, outcome_notes, completed
       FROM schedule_blocks
       ORDER BY rehearsal_id, block_order, start_time`;
  const scheduleRows = (
    hasTheaterFilter
      ? db.prepare(scheduleSql).all(...theaterIn!.params)
      : db.prepare(scheduleSql).all()
  ) as Array<{
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
    play_id: string | null;
    actor_ids: string | null;
    outcome_notes: string | null;
    completed: number | null;
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
      playId: row.play_id ?? undefined,
      actorIds: parseJson(row.actor_ids, [] as string[]),
      outcomeNotes: row.outcome_notes ?? undefined,
      completed:
        row.completed === null || row.completed === undefined
          ? undefined
          : row.completed === 1,
    };
    const list = scheduleByRehearsal.get(row.rehearsal_id) ?? [];
    list.push(block);
    scheduleByRehearsal.set(row.rehearsal_id, list);
  }

  const theaters = (
    (hasTheaterFilter
      ? db.prepare(`SELECT * FROM theaters WHERE id IN (${theaterIn!.sql})`).all(...theaterIn!.params)
      : db.prepare('SELECT * FROM theaters').all()
  ) as Array<Record<string, unknown>>
  ).map(
    (row): Theater => ({
      id: String(row.id),
      name: String(row.name),
      notes: (row.notes as string | null) ?? undefined,
      timezone: (row.timezone as string | null)?.trim() || undefined,
      telegramChatId: (row.telegram_chat_id as string | null)?.trim() || undefined,
      reminderSettings: parseTheaterReminderSettings(row.reminder_settings as string | null | undefined),
    })
  );

  const plays = (
    (hasTheaterFilter
      ? db.prepare(`SELECT * FROM plays WHERE theater_id IN (${theaterIn!.sql})`).all(...theaterIn!.params)
      : db.prepare('SELECT * FROM plays').all()
  ) as Array<Record<string, unknown>>
  ).map(
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
      scriptImportSyncedAt: (row.script_import_synced_at as string | null) ?? undefined,
      scriptFileName: (row.script_file_name as string | null) ?? undefined,
      scriptFileUrl: (row.script_file_url as string | null) ?? undefined,
      scriptFileDataUrl: (row.script_file_data_url as string | null) ?? undefined,
      scriptFileMimeType: (row.script_file_mime_type as string | null) ?? undefined,
      scriptFileSize: (row.script_file_size as number | null) ?? undefined,
      archivedAt: (row.archived_at as string | null) ?? undefined,
      actScriptAnchors: parseOptionalJson<Play['actScriptAnchors']>(
        row.act_script_anchors as string | null
      ),
      coverUrl: (row.cover_url as string | null) ?? undefined,
      iconUrl: (row.icon_url as string | null) ?? undefined,
      iconColor: (row.icon_color as string | null) ?? undefined,
    })
  );

  const playIdsForFilter = hasTheaterFilter
    ? (db
        .prepare(`SELECT id FROM plays WHERE theater_id IN (${theaterIn!.sql})`)
        .all(...theaterIn!.params) as Array<{ id: string }>).map((row) => row.id)
    : null;
  const playIn = playIdsForFilter ? inClause(playIdsForFilter) : null;

  const actors = (
    (hasTheaterFilter
      ? db.prepare(`SELECT * FROM actors WHERE theater_id IN (${theaterIn!.sql})`).all(...theaterIn!.params)
      : db.prepare('SELECT * FROM actors').all()
  ) as Array<Record<string, unknown>>
  ).map(
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
      telegramChatId: (row.telegram_chat_id as string | null)?.trim() || undefined,
      notes: (row.notes as string | null) ?? undefined,
      unavailability: parseJson(row.unavailability as string, []),
      memorizationByScene: parseJson(row.memorization_by_scene as string, {}),
    })
  );

  const venues = (
    (hasTheaterFilter
      ? db.prepare(`SELECT * FROM venues WHERE theater_id IN (${theaterIn!.sql})`).all(...theaterIn!.params)
      : db.prepare('SELECT * FROM venues').all()
  ) as Array<Record<string, unknown>>
  ).map(
    (row): Venue => ({
      id: String(row.id),
      theaterId: (row.theater_id as string | null) ?? undefined,
      name: String(row.name),
      address: (row.address as string | null) ?? undefined,
      notes: (row.notes as string | null) ?? undefined,
    })
  );

  const playRoles = (
    (hasTheaterFilter && playIn
      ? db
          .prepare(`SELECT * FROM play_roles WHERE play_id IN (${playIn.sql}) ORDER BY role_order`)
          .all(...playIn.params)
      : db.prepare('SELECT * FROM play_roles ORDER BY role_order').all()
  ) as Array<Record<string, unknown>>
  ).map(
    (row): PlayRole => ({
      id: String(row.id),
      playId: String(row.play_id),
      name: String(row.name),
      kind: row.kind as PlayRole['kind'],
      order: Number(row.role_order),
      description: (row.description as string | null) ?? undefined,
      scriptAliases: parseOptionalJson<string[]>(row.script_aliases as string | null),
    })
  );

  const performances = (
    (hasTheaterFilter && playIn
      ? db.prepare(`SELECT * FROM performances WHERE play_id IN (${playIn.sql})`).all(...playIn.params)
      : db.prepare('SELECT * FROM performances').all()
  ) as Array<Record<string, unknown>>
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
    (hasTheaterFilter && playIn
      ? db
          .prepare(`SELECT * FROM cast_assignments WHERE play_id IN (${playIn.sql})`)
          .all(...playIn.params)
      : db.prepare('SELECT * FROM cast_assignments').all()
  ) as Array<Record<string, unknown>>
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
    (hasTheaterFilter && playIn
      ? db.prepare(`SELECT * FROM scenes WHERE play_id IN (${playIn.sql}) ORDER BY number`).all(...playIn.params)
      : db.prepare('SELECT * FROM scenes ORDER BY number').all()
  ) as Array<Record<string, unknown>>
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
      actGroup: (row.act_group as string | null) ?? undefined,
      scriptAnchor: parseOptionalJson<Scene['scriptAnchor']>(row.script_anchor as string),
      scriptCharacterCount: (row.script_character_count as number | null) ?? undefined,
      scriptCharacterCountSyncedAt:
        (row.script_character_count_synced_at as string | null) ?? undefined,
    })
  );

  const tasks = (
    (hasTheaterFilter
      ? db.prepare(`SELECT * FROM tasks WHERE theater_id IN (${theaterIn!.sql})`).all(...theaterIn!.params)
      : db.prepare('SELECT * FROM tasks').all()
  ) as Array<Record<string, unknown>>
  ).map(
    (row): Task => ({
      id: String(row.id),
      theaterId: (row.theater_id as string | null) ?? undefined,
      title: String(row.title),
      description: (row.description as string | null) ?? undefined,
      completed: asBool(row.completed as number | null),
      assignedActorIds: parseJson<string[]>(row.assigned_actor_ids as string, []),
      rehearsalId: (row.rehearsal_id as string | null) ?? undefined,
      dueDate: (row.due_date as string | null) ?? undefined,
      priority: (row.priority as Task['priority'] | null) ?? undefined,
      playId: (row.play_id as string | null) ?? undefined,
      sceneId: (row.scene_id as string | null) ?? undefined,
    })
  );

  const rehearsals = (
    (hasTheaterFilter
      ? db
          .prepare(
            `SELECT * FROM rehearsals WHERE theater_id IN (${theaterIn!.sql}) ORDER BY date, start_time`
          )
          .all(...theaterIn!.params)
      : db.prepare('SELECT * FROM rehearsals ORDER BY date, start_time').all()
  ) as Array<Record<string, unknown>>
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
      rsvp: parseJson<Rehearsal['rsvp']>(row.rsvp as string | undefined, {}),
      participantOrder: parseJson<string[]>(row.participant_order as string | undefined, []),
      googleCalendarEventId: (row.google_calendar_event_id as string | null) ?? undefined,
      dismissedWarningIds: parseJson<string[]>(row.dismissed_warning_ids as string | undefined, []),
      remindersSent: parseJson<Rehearsal['remindersSent']>(row.reminders_sent as string | undefined, []),
      reminderOptOut: asBool(row.reminder_opt_out as number | null | undefined),
      telegramPlanSentAt: (row.telegram_plan_sent_at as string | null) ?? undefined,
      outcomePhotoUrls: parseJson<string[]>(row.outcome_photo_urls as string | undefined, []),
      schedule: scheduleByRehearsal.get(String(row.id)) ?? [],
    })
  );

  const noteSql = hasTheaterFilter
    ? `SELECT * FROM rehearsal_actor_notes WHERE theater_id IN (${theaterIn!.sql}) ORDER BY created_at DESC`
    : `SELECT * FROM rehearsal_actor_notes ORDER BY created_at DESC`;
  const noteRows = (
    hasTheaterFilter
      ? db.prepare(noteSql).all(...theaterIn!.params)
      : db.prepare(noteSql).all()
  ) as Array<Record<string, unknown>>;
  const rehearsalActorNotes: RehearsalActorNote[] = noteRows.map((row) => ({
    id: String(row.id),
    theaterId: String(row.theater_id),
    rehearsalId: String(row.rehearsal_id),
    actorId: String(row.actor_id),
    sceneId: (row.scene_id as string | null) ?? undefined,
    scheduleBlockId: (row.schedule_block_id as string | null) ?? undefined,
    text: String(row.text),
    createdAt: String(row.created_at),
    sentAt: (row.sent_at as string | null) ?? undefined,
    acknowledgedAt: (row.acknowledged_at as string | null) ?? undefined,
  }));

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
    rehearsalActorNotes,
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
    const preservedActorTelegramChatIds = loadPreservedActorTelegramChatIds(db);

    const existingRsvpRows = db
      .prepare(`SELECT id, rsvp FROM rehearsals`)
      .all() as Array<{ id: string; rsvp: string }>;
    const rsvpByRehearsalId = new Map(
      existingRsvpRows.map((row) => [row.id, parseJson<Record<string, string>>(row.rsvp, {})])
    );
    const stateToSave: AppState = syncDecidedNotesToActorNotes({
      ...state,
      rehearsals: state.rehearsals.map((rehearsal) => {
        const dbRsvp = rsvpByRehearsalId.get(rehearsal.id);
        if (!dbRsvp || Object.keys(dbRsvp).length === 0) return rehearsal;
        return { ...rehearsal, rsvp: { ...dbRsvp, ...(rehearsal.rsvp ?? {}) } };
      }),
    });

    db.prepare('DELETE FROM schedule_blocks').run();
    db.prepare('DELETE FROM rehearsal_actor_notes').run();
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

    insertStateEntities(db, stateToSave, { preservedActorTelegramChatIds });
  });

  tx();
}
