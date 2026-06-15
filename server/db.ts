import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

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

  dbInstance = wrapDatabase(db);
  return dbInstance;
}

export function closeDb(): void {
  dbInstance?.close();
  dbInstance = null;
}
