import type { Express } from 'express';
import { getDb, type AppDatabase } from './db.js';
import { normalizeSubscriptionPlan } from './subscription.js';
import { getDbInfo, listBackupFiles } from './backup.js';
import { requirePlatformAdmin } from './platformAdmin.js';
import type { TheaterAccessRole } from './authTypes.js';

export interface AdminUserSummary {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  authMethods: { password: boolean; google: boolean };
  activeSessions: number;
  theaterCount: number;
  ownedTheaterCount: number;
  filesCount: number;
  filesBytes: number;
  content: {
    plays: number;
    scenes: number;
    rehearsals: number;
    actors: number;
    tasks: number;
    venues: number;
  };
  activity: {
    rehearsalsUpcoming: number;
    rehearsalsLast30Days: number;
    openTasks: number;
  };
}

export interface AdminUserTheaterStats {
  id: string;
  name: string;
  role: TheaterAccessRole;
  isOwner: boolean;
  plays: number;
  scenes: number;
  rehearsals: number;
  actors: number;
  tasks: number;
  venues: number;
  members: number;
  rehearsalsUpcoming: number;
}

export interface AdminUserDetail extends AdminUserSummary {
  generatedAt: string;
  theaters: AdminUserTheaterStats[];
}

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

function userTheaterIdsSubquery(alias = 'theater_id'): string {
  return `SELECT tm.theater_id AS ${alias}
          FROM theater_members tm
          WHERE tm.user_id = ?
          UNION
          SELECT t.id AS ${alias}
          FROM theaters t
          WHERE t.owner_user_id = ?`;
}

function countInUserTheaters(
  db: AppDatabase,
  userId: string,
  table: string,
  theaterColumn = 'theater_id',
  extraWhere = ''
): number {
  const where = extraWhere ? ` AND ${extraWhere}` : '';
  return countRow(
    db,
    `SELECT COUNT(*) AS count
     FROM ${table}
     WHERE ${theaterColumn} IN (${userTheaterIdsSubquery()})${where}`,
    userId,
    userId
  );
}

function mapUserSummaryRow(
  db: AppDatabase,
  row: {
    id: string;
    email: string;
    name: string;
    created_at: string;
    subscription_plan: string | null;
    has_password: number;
    has_google: number;
    active_sessions: number;
    theater_count: number;
    owned_theater_count: number;
    files_count: number;
    files_bytes: number;
  },
  today: string,
  since30Days: string
): AdminUserSummary {
  const userId = row.id;
  return {
    id: userId,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
    subscriptionPlan: normalizeSubscriptionPlan(row.subscription_plan),
    authMethods: {
      password: Boolean(row.has_password),
      google: Boolean(row.has_google),
    },
    activeSessions: Number(row.active_sessions),
    theaterCount: Number(row.theater_count),
    ownedTheaterCount: Number(row.owned_theater_count),
    filesCount: Number(row.files_count),
    filesBytes: Number(row.files_bytes),
    content: {
      plays: countInUserTheaters(db, userId, 'plays'),
      scenes: countScenesInUserTheaters(db, userId),
      rehearsals: countInUserTheaters(db, userId, 'rehearsals'),
      actors: countInUserTheaters(db, userId, 'actors'),
      tasks: countInUserTheaters(db, userId, 'tasks'),
      venues: countInUserTheaters(db, userId, 'venues'),
    },
    activity: {
      rehearsalsUpcoming: countInUserTheaters(
        db,
        userId,
        'rehearsals',
        'theater_id',
        `date >= '${today}'`
      ),
      rehearsalsLast30Days: countInUserTheaters(
        db,
        userId,
        'rehearsals',
        'theater_id',
        `date >= '${since30Days}' AND date <= '${today}'`
      ),
      openTasks: countInUserTheaters(db, userId, 'tasks', 'theater_id', 'completed = 0'),
    },
  };
}

export function collectAdminUsers(db: AppDatabase = getDb()): AdminUserSummary[] {
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const since30Days = isoDateDaysAgo(30);

  const rows = db
    .prepare(
      `SELECT
         u.id,
         u.email,
         u.name,
         u.created_at,
         u.subscription_plan,
         CASE WHEN u.password_hash IS NOT NULL THEN 1 ELSE 0 END AS has_password,
         CASE WHEN u.google_sub IS NOT NULL THEN 1 ELSE 0 END AS has_google,
         (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > ?) AS active_sessions,
         (SELECT COUNT(*) FROM theater_members tm WHERE tm.user_id = u.id) AS theater_count,
         (SELECT COUNT(*) FROM theaters t WHERE t.owner_user_id = u.id) AS owned_theater_count,
         (SELECT COUNT(*) FROM files f WHERE f.owner_user_id = u.id) AS files_count,
         (SELECT COALESCE(SUM(f.size_bytes), 0) FROM files f WHERE f.owner_user_id = u.id) AS files_bytes
       FROM users u
       ORDER BY u.created_at DESC`
    )
    .all(nowIso) as Array<{
    id: string;
    email: string;
    name: string;
    created_at: string;
    subscription_plan: string | null;
    has_password: number;
    has_google: number;
    active_sessions: number;
    theater_count: number;
    owned_theater_count: number;
    files_count: number;
    files_bytes: number;
  }>;

  return rows.map((row) => mapUserSummaryRow(db, row, today, since30Days));
}

function countScenesInUserTheaters(db: AppDatabase, userId: string): number {
  return countRow(
    db,
    `SELECT COUNT(*) AS count
     FROM scenes
     WHERE play_id IN (
       SELECT id FROM plays
       WHERE theater_id IN (${userTheaterIdsSubquery()})
     )`,
    userId,
    userId
  );
}

function countScenesInTheater(db: AppDatabase, theaterId: string): number {
  return countRow(
    db,
    `SELECT COUNT(*) AS count
     FROM scenes
     WHERE play_id IN (SELECT id FROM plays WHERE theater_id = ?)`,
    theaterId
  );
}

export function collectAdminUserDetail(
  userId: string,
  db: AppDatabase = getDb()
): AdminUserDetail | null {
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const since30Days = isoDateDaysAgo(30);

  const row = db
    .prepare(
      `SELECT
         u.id,
         u.email,
         u.name,
         u.created_at,
         u.subscription_plan,
         CASE WHEN u.password_hash IS NOT NULL THEN 1 ELSE 0 END AS has_password,
         CASE WHEN u.google_sub IS NOT NULL THEN 1 ELSE 0 END AS has_google,
         (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > ?) AS active_sessions,
         (SELECT COUNT(*) FROM theater_members tm WHERE tm.user_id = u.id) AS theater_count,
         (SELECT COUNT(*) FROM theaters t WHERE t.owner_user_id = u.id) AS owned_theater_count,
         (SELECT COUNT(*) FROM files f WHERE f.owner_user_id = u.id) AS files_count,
         (SELECT COALESCE(SUM(f.size_bytes), 0) FROM files f WHERE f.owner_user_id = u.id) AS files_bytes
       FROM users u
       WHERE u.id = ?`
    )
    .get(nowIso, userId) as
    | {
        id: string;
        email: string;
        name: string;
        created_at: string;
        has_password: number;
        has_google: number;
        active_sessions: number;
        theater_count: number;
        owned_theater_count: number;
        files_count: number;
        files_bytes: number;
      }
    | undefined;

  if (!row) return null;

  const theaterRows = db
    .prepare(
      `SELECT
         t.id,
         t.name,
         tm.role,
         CASE WHEN t.owner_user_id = ? THEN 1 ELSE 0 END AS is_owner,
         (SELECT COUNT(*) FROM plays p WHERE p.theater_id = t.id) AS plays,
         (SELECT COUNT(*) FROM rehearsals r WHERE r.theater_id = t.id) AS rehearsals,
         (SELECT COUNT(*) FROM actors a WHERE a.theater_id = t.id) AS actors,
         (SELECT COUNT(*) FROM tasks tk WHERE tk.theater_id = t.id) AS tasks,
         (SELECT COUNT(*) FROM venues v WHERE v.theater_id = t.id) AS venues,
         (SELECT COUNT(*) FROM theater_members m WHERE m.theater_id = t.id) AS members,
         (SELECT COUNT(*) FROM rehearsals r WHERE r.theater_id = t.id AND r.date >= ?) AS rehearsals_upcoming
       FROM theater_members tm
       JOIN theaters t ON t.id = tm.theater_id
       WHERE tm.user_id = ?
       ORDER BY CASE tm.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, t.name`
    )
    .all(userId, today, userId) as Array<{
    id: string;
    name: string;
    role: TheaterAccessRole;
    is_owner: number;
    plays: number;
    rehearsals: number;
    actors: number;
    tasks: number;
    venues: number;
    members: number;
    rehearsals_upcoming: number;
  }>;

  const theaters: AdminUserTheaterStats[] = theaterRows.map((theater) => ({
    id: theater.id,
    name: theater.name,
    role: theater.role,
    isOwner: Boolean(theater.is_owner),
    plays: Number(theater.plays),
    scenes: countScenesInTheater(db, theater.id),
    rehearsals: Number(theater.rehearsals),
    actors: Number(theater.actors),
    tasks: Number(theater.tasks),
    venues: Number(theater.venues),
    members: Number(theater.members),
    rehearsalsUpcoming: Number(theater.rehearsals_upcoming),
  }));

  return {
    ...mapUserSummaryRow(db, row, today, since30Days),
    generatedAt: nowIso,
    theaters,
  };
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

  app.get('/api/admin/users', (req, res) => {
    if (!requirePlatformAdmin(req, res)) return;
    try {
      res.json({ users: collectAdminUsers() });
    } catch (error) {
      console.error('[admin] users failed', error);
      res.status(500).json({ error: 'USERS_FAILED' });
    }
  });

  app.get('/api/admin/users/:userId', (req, res) => {
    if (!requirePlatformAdmin(req, res)) return;
    try {
      const detail = collectAdminUserDetail(req.params.userId);
      if (!detail) {
        res.status(404).json({ error: 'NOT_FOUND' });
        return;
      }
      res.json(detail);
    } catch (error) {
      console.error('[admin] user detail failed', error);
      res.status(500).json({ error: 'USER_DETAIL_FAILED' });
    }
  });
}
