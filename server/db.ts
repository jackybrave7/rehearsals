import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { propagateActorTelegramLinksByEmail } from './actorTelegramLink.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');
const dbPath = path.join(dataDir, 'rehearsals.db');
const schemaPath = path.join(__dirname, 'schema.sql');

export type AppDatabase = {
  prepare: DatabaseSync['prepare'];
  exec: DatabaseSync['exec'];
  transaction: <T extends () => unknown>(fn: T) => T;
  close: () => void;
};

let dbInstance: AppDatabase | null = null;

function wrapDatabase(db: DatabaseSync): AppDatabase {
  return {
    prepare: db.prepare.bind(db),
    exec: db.exec.bind(db),
    transaction<T extends () => unknown>(fn: T): T {
      const run = (() => {
        db.exec('BEGIN IMMEDIATE');
        try {
          const result = fn();
          db.exec('COMMIT');
          return result;
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      }) as T;
      return run;
    },
    close: () => db.close(),
  };
}

export function getDbPath(): string {
  return dbPath;
}

export function getDb(): AppDatabase {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  try {
    db.exec(`ALTER TABLE rehearsals ADD COLUMN participant_order TEXT NOT NULL DEFAULT '[]'`);
  } catch {
    // column already exists
  }

  const tmSchemaRow = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'theater_members'`)
    .get() as { sql: string } | undefined;
  if (tmSchemaRow?.sql && !tmSchemaRow.sql.includes("'actor'")) {
    db.exec(`
      CREATE TABLE theater_members_new (
        theater_id TEXT NOT NULL REFERENCES theaters(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'observer', 'actor')),
        created_at TEXT NOT NULL,
        PRIMARY KEY (theater_id, user_id)
      );
      INSERT INTO theater_members_new SELECT * FROM theater_members;
      DROP TABLE theater_members;
      ALTER TABLE theater_members_new RENAME TO theater_members;
    `);
  }

  for (const migration of [
    `ALTER TABLE app_settings ADD COLUMN active_theater_id TEXT`,
    `ALTER TABLE plays ADD COLUMN theater_id TEXT`,
    `ALTER TABLE actors ADD COLUMN theater_id TEXT`,
    `ALTER TABLE venues ADD COLUMN theater_id TEXT`,
    `ALTER TABLE tasks ADD COLUMN theater_id TEXT`,
    `ALTER TABLE rehearsals ADD COLUMN theater_id TEXT`,
    `ALTER TABLE scenes ADD COLUMN director_notes TEXT`,
    `ALTER TABLE scenes ADD COLUMN priority TEXT`,
    `ALTER TABLE actors ADD COLUMN telegram_username TEXT`,
    `ALTER TABLE rehearsals ADD COLUMN attendance TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE rehearsals ADD COLUMN series_id TEXT`,
    `ALTER TABLE rehearsals ADD COLUMN dismissed_warning_ids TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE schedule_blocks ADD COLUMN decided_notes TEXT`,
    `ALTER TABLE schedule_blocks ADD COLUMN remaining_notes TEXT`,
    `ALTER TABLE theaters ADD COLUMN owner_user_id TEXT REFERENCES users(id)`,
    `ALTER TABLE scenes ADD COLUMN script_character_count INTEGER`,
    `ALTER TABLE scenes ADD COLUMN script_character_count_synced_at TEXT`,
    `ALTER TABLE schedule_blocks ADD COLUMN completed INTEGER`,
    `ALTER TABLE tasks ADD COLUMN due_date TEXT`,
    `ALTER TABLE tasks ADD COLUMN priority TEXT`,
    `ALTER TABLE tasks ADD COLUMN play_id TEXT`,
    `ALTER TABLE tasks ADD COLUMN scene_id TEXT`,
    `ALTER TABLE actors ADD COLUMN unavailability TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE rehearsals ADD COLUMN reminders_sent TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE rehearsals ADD COLUMN reminder_opt_out INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE plays ADD COLUMN script_file_url TEXT`,
    `ALTER TABLE theaters ADD COLUMN telegram_chat_id TEXT`,
    `ALTER TABLE theaters ADD COLUMN reminder_settings TEXT`,
    `ALTER TABLE theaters ADD COLUMN timezone TEXT`,
    `ALTER TABLE actors ADD COLUMN telegram_chat_id TEXT`,
    `ALTER TABLE users ADD COLUMN subscription_plan TEXT NOT NULL DEFAULT 'free'`,
    `ALTER TABLE plays ADD COLUMN archived_at TEXT`,
    `ALTER TABLE plays ADD COLUMN script_import_synced_at TEXT`,
    `ALTER TABLE users ADD COLUMN email_verified_at TEXT`,
    `ALTER TABLE users ADD COLUMN email_verification_token_hash TEXT`,
    `ALTER TABLE users ADD COLUMN email_verification_expires_at TEXT`,
    `ALTER TABLE users ADD COLUMN terms_accepted_at TEXT`,
    `ALTER TABLE scenes ADD COLUMN act_group TEXT`,
    `ALTER TABLE plays ADD COLUMN act_script_anchors TEXT`,
    `ALTER TABLE users ADD COLUMN registration_approved_at TEXT`,
    `ALTER TABLE users ADD COLUMN subscription_pro_expires_at TEXT`,
    `CREATE TABLE IF NOT EXISTS platform_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      registration_mode TEXT NOT NULL DEFAULT 'beta' CHECK (registration_mode IN ('normal', 'beta'))
    )`,
    `ALTER TABLE platform_settings ADD COLUMN legacy_registration_backfill_at TEXT`,
    `ALTER TABLE rehearsals ADD COLUMN rsvp TEXT DEFAULT '{}'`,
    `ALTER TABLE schedule_blocks ADD COLUMN play_id TEXT`,
    `ALTER TABLE schedule_blocks ADD COLUMN actor_ids TEXT`,
    `ALTER TABLE schedule_blocks ADD COLUMN outcome_notes TEXT`,
    `ALTER TABLE rehearsals ADD COLUMN telegram_plan_sent_at TEXT`,
    `ALTER TABLE actors ADD COLUMN memorization_by_scene TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE plays ADD COLUMN cover_url TEXT`,
    `ALTER TABLE plays ADD COLUMN icon_url TEXT`,
    `ALTER TABLE plays ADD COLUMN icon_color TEXT`,
    `ALTER TABLE rehearsals ADD COLUMN outcome_photo_urls TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE play_roles ADD COLUMN script_aliases TEXT`,
    `CREATE TABLE IF NOT EXISTS rehearsal_actor_notes (
      id TEXT PRIMARY KEY,
      theater_id TEXT NOT NULL,
      rehearsal_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      scene_id TEXT,
      schedule_block_id TEXT,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sent_at TEXT,
      acknowledged_at TEXT
    )`,
  ]) {
    try {
      db.exec(migration);
    } catch {
      // column already exists
    }
  }

  for (const indexSql of [
    `CREATE INDEX IF NOT EXISTS idx_plays_theater_id ON plays(theater_id)`,
    `CREATE INDEX IF NOT EXISTS idx_actors_theater_id ON actors(theater_id)`,
    `CREATE INDEX IF NOT EXISTS idx_rehearsals_theater_id ON rehearsals(theater_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_theater_members_user_id ON theater_members(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_theaters_owner_user_id ON theaters(owner_user_id)`,
  ]) {
    db.exec(indexSql);
  }

  db.prepare(
    `INSERT OR IGNORE INTO theater_members (theater_id, user_id, role, created_at)
     SELECT id, owner_user_id, 'owner', datetime('now')
     FROM theaters
     WHERE owner_user_id IS NOT NULL`
  ).run();

  db.prepare(
    `UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL`
  ).run();

  db.prepare(
    `INSERT OR IGNORE INTO platform_settings (id, registration_mode) VALUES (1, 'beta')`
  ).run();

  // Однократно: старые пользователи до бета-одобрения считаются одобренными.
  // Не запускать на каждом старте — иначе новые заявки в бете тоже авто-одобряются.
  const backfillRow = db
    .prepare(`SELECT legacy_registration_backfill_at FROM platform_settings WHERE id = 1`)
    .get() as { legacy_registration_backfill_at: string | null } | undefined;
  if (!backfillRow?.legacy_registration_backfill_at) {
    db.prepare(
      `UPDATE users SET registration_approved_at = COALESCE(email_verified_at, created_at) WHERE registration_approved_at IS NULL`
    ).run();
    db.prepare(
      `UPDATE platform_settings SET legacy_registration_backfill_at = datetime('now') WHERE id = 1`
    ).run();
  }

  dbInstance = wrapDatabase(db);

  const propagatedLinks = propagateActorTelegramLinksByEmail(dbInstance);
  if (propagatedLinks > 0) {
    console.log(`[telegram] propagated bot links to ${propagatedLinks} actor card(s) by email`);
  }

  return dbInstance;
}

export function closeDb(): void {
  dbInstance?.close();
  dbInstance = null;
}
