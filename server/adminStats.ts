import type { Express } from 'express';
import { getDb, type AppDatabase } from './db.js';
import { getDbInfo, listBackupFiles } from './backup.js';
import { requirePlatformAdmin } from './platformAdmin.js';

export interface PlatformStats {
  generatedAt: string;
  users: {
    total: number;
    newLast30Days: number;
    withPassword: number;
    withGoogle: number;
  };
  sessions: {
    active: number;
    activeUsers: number;
  };
  theaters: {
    total: number;
    membersByRole: { owner: number; editor: number; observer: number };
  };
  content: {
    plays: number;
    scenes: number;
    rehearsals: number;
    actors: number;
    tasks: number;
    venues: number;
    scheduleBlocks: number;
  };
  activity: {
    rehearsalsPast: number;
    rehearsalsUpcoming: number;
    rehearsalsLast30Days: number;
    openTasks: number;
    completedTasks: number;
  };
  storage: {
    fileCount: number;
    totalBytes: number;
    backupCount: number;
    dbSizeBytes: number;
  };
  integrations: {
    playsWithGoogleDocs: number;
    actorsWithTelegram: number;
  };
  signupsByMonth: Array<{ month: string; count: number }>;
  theatersOverview: Array<{
    id: string;
    name: string;
    plays: number;
    rehearsals: number;
    actors: number;
    members: number;
  }>;
  recentUsers: Array<{
    id: string;
    email: string;
    name: string;
    createdAt: string;
    theaterCount: number;
  }>;
}

function countRow(db: AppDatabase, sql: string, ...params: unknown[]): number {
  const row = db.prepare(sql).get(...params) as { count: number } | undefined;
  return Number(row?.count ?? 0);
}

function isoDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function collectPlatformStats(db: AppDatabase = getDb()): PlatformStats {
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const since30Days = isoDateDaysAgo(30);
  const since30DaysUsers = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const membersByRole = { owner: 0, editor: 0, observer: 0 };
  const roleRows = db
    .prepare(`SELECT role, COUNT(*) AS count FROM theater_members GROUP BY role`)
    .all() as Array<{ role: string; count: number }>;
  for (const row of roleRows) {
    if (row.role === 'owner' || row.role === 'editor' || row.role === 'observer') {
      membersByRole[row.role] = Number(row.count);
    }
  }

  const signupsByMonth = (
    db
      .prepare(
        `SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count
         FROM users
         GROUP BY month
         ORDER BY month DESC
         LIMIT 12`
      )
      .all() as Array<{ month: string; count: number }>
  )
    .filter((row) => row.month)
    .map((row) => ({ month: row.month, count: Number(row.count) }))
    .reverse();

  const theatersOverview = (
    db
      .prepare(
        `SELECT
           t.id,
           t.name,
           (SELECT COUNT(*) FROM plays p WHERE p.theater_id = t.id) AS plays,
           (SELECT COUNT(*) FROM rehearsals r WHERE r.theater_id = t.id) AS rehearsals,
           (SELECT COUNT(*) FROM actors a WHERE a.theater_id = t.id) AS actors,
           (SELECT COUNT(*) FROM theater_members tm WHERE tm.theater_id = t.id) AS members
         FROM theaters t
         ORDER BY rehearsals DESC, plays DESC, t.name`
      )
      .all() as Array<{
      id: string;
      name: string;
      plays: number;
      rehearsals: number;
      actors: number;
      members: number;
    }>
  ).map((row) => ({
    id: row.id,
    name: row.name,
    plays: Number(row.plays),
    rehearsals: Number(row.rehearsals),
    actors: Number(row.actors),
    members: Number(row.members),
  }));

  const recentUsers = (
    db
      .prepare(
        `SELECT
           u.id,
           u.email,
           u.name,
           u.created_at AS createdAt,
           (SELECT COUNT(*) FROM theater_members tm WHERE tm.user_id = u.id) AS theaterCount
         FROM users u
         ORDER BY u.created_at DESC
         LIMIT 10`
      )
      .all() as Array<{
      id: string;
      email: string;
      name: string;
      createdAt: string;
      theaterCount: number;
    }>
  ).map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.createdAt,
    theaterCount: Number(row.theaterCount),
  }));

  const dbInfo = getDbInfo();

  return {
    generatedAt: nowIso,
    users: {
      total: countRow(db, `SELECT COUNT(*) AS count FROM users`),
      newLast30Days: countRow(
        db,
        `SELECT COUNT(*) AS count FROM users WHERE created_at >= ?`,
        since30DaysUsers
      ),
      withPassword: countRow(
        db,
        `SELECT COUNT(*) AS count FROM users WHERE password_hash IS NOT NULL`
      ),
      withGoogle: countRow(db, `SELECT COUNT(*) AS count FROM users WHERE google_sub IS NOT NULL`),
    },
    sessions: {
      active: countRow(db, `SELECT COUNT(*) AS count FROM sessions WHERE expires_at > ?`, nowIso),
      activeUsers: countRow(
        db,
        `SELECT COUNT(DISTINCT user_id) AS count FROM sessions WHERE expires_at > ?`,
        nowIso
      ),
    },
    theaters: {
      total: countRow(db, `SELECT COUNT(*) AS count FROM theaters`),
      membersByRole,
    },
    content: {
      plays: countRow(db, `SELECT COUNT(*) AS count FROM plays`),
      scenes: countRow(db, `SELECT COUNT(*) AS count FROM scenes`),
      rehearsals: countRow(db, `SELECT COUNT(*) AS count FROM rehearsals`),
      actors: countRow(db, `SELECT COUNT(*) AS count FROM actors`),
      tasks: countRow(db, `SELECT COUNT(*) AS count FROM tasks`),
      venues: countRow(db, `SELECT COUNT(*) AS count FROM venues`),
      scheduleBlocks: countRow(db, `SELECT COUNT(*) AS count FROM schedule_blocks`),
    },
    activity: {
      rehearsalsPast: countRow(db, `SELECT COUNT(*) AS count FROM rehearsals WHERE date < ?`, today),
      rehearsalsUpcoming: countRow(
        db,
        `SELECT COUNT(*) AS count FROM rehearsals WHERE date >= ?`,
        today
      ),
      rehearsalsLast30Days: countRow(
        db,
        `SELECT COUNT(*) AS count FROM rehearsals WHERE date >= ? AND date <= ?`,
        since30Days,
        today
      ),
      openTasks: countRow(db, `SELECT COUNT(*) AS count FROM tasks WHERE completed = 0`),
      completedTasks: countRow(db, `SELECT COUNT(*) AS count FROM tasks WHERE completed = 1`),
    },
    storage: {
      fileCount: countRow(db, `SELECT COUNT(*) AS count FROM files`),
      totalBytes: Number(
        (db.prepare(`SELECT COALESCE(SUM(size_bytes), 0) AS total FROM files`).get() as
          | { total: number }
          | undefined)?.total ?? 0
      ),
      backupCount: listBackupFiles().length,
      dbSizeBytes: dbInfo.size,
    },
    integrations: {
      playsWithGoogleDocs: countRow(
        db,
        `SELECT COUNT(*) AS count FROM plays WHERE google_document_id IS NOT NULL AND google_document_id != ''`
      ),
      actorsWithTelegram: countRow(
        db,
        `SELECT COUNT(*) AS count FROM actors WHERE telegram_username IS NOT NULL AND telegram_username != ''`
      ),
    },
    signupsByMonth,
    theatersOverview,
    recentUsers,
  };
}

export function registerAdminRoutes(app: Express) {
  app.get('/api/admin/stats', (req, res) => {
    if (!requirePlatformAdmin(req, res)) return;
    try {
      res.json(collectPlatformStats());
    } catch (error) {
      console.error('[admin] stats failed', error);
      res.status(500).json({ error: 'STATS_FAILED' });
    }
  });
}
