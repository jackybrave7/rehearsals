PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_theater_id TEXT,
  active_play_id TEXT,
  selected_performance_by_play_id TEXT NOT NULL DEFAULT '{}',
  app_meta TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT,
  google_sub TEXT UNIQUE,
  created_at TEXT NOT NULL,
  subscription_plan TEXT NOT NULL DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro')),
  email_verified_at TEXT,
  email_verification_token_hash TEXT,
  email_verification_expires_at TEXT,
  terms_accepted_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS theaters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  notes TEXT,
  owner_user_id TEXT REFERENCES users(id),
  telegram_chat_id TEXT,
  reminder_settings TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS theater_members (
  theater_id TEXT NOT NULL REFERENCES theaters(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'observer')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (theater_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  active_theater_id TEXT,
  active_play_id TEXT,
  selected_performance_by_play_id TEXT NOT NULL DEFAULT '{}',
  app_meta TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS plays (
  id TEXT PRIMARY KEY,
  theater_id TEXT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  description TEXT,
  year INTEGER,
  document_url TEXT,
  google_document_id TEXT,
  google_docs_links_synced_at TEXT,
  script_import_synced_at TEXT,
  script_file_name TEXT,
  script_file_data_url TEXT,
  script_file_url TEXT,
  script_file_mime_type TEXT,
  script_file_size INTEGER,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS actors (
  id TEXT PRIMARY KEY,
  theater_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  archive_reason TEXT,
  photo_url TEXT,
  phone TEXT,
  email TEXT,
  telegram_username TEXT,
  telegram_chat_id TEXT,
  notes TEXT,
  unavailability TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS venues (
  id TEXT PRIMARY KEY,
  theater_id TEXT,
  name TEXT NOT NULL,
  address TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS play_roles (
  id TEXT PRIMARY KEY,
  play_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  role_order INTEGER NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS performances (
  id TEXT PRIMARY KEY,
  play_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  date TEXT,
  start_time TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS cast_assignments (
  id TEXT PRIMARY KEY,
  play_id TEXT NOT NULL,
  performance_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  actor_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  play_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  director_notes TEXT,
  estimated_minutes INTEGER,
  status TEXT NOT NULL,
  priority TEXT,
  role_ids TEXT NOT NULL DEFAULT '[]',
  script_anchor TEXT,
  script_character_count INTEGER,
  script_character_count_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  theater_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  assigned_actor_ids TEXT NOT NULL DEFAULT '[]',
  rehearsal_id TEXT,
  due_date TEXT,
  priority TEXT,
  play_id TEXT,
  scene_id TEXT
);

CREATE TABLE IF NOT EXISTS rehearsals (
  id TEXT PRIMARY KEY,
  theater_id TEXT,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  venue_id TEXT,
  location TEXT,
  notes TEXT,
  play_id TEXT,
  performance_id TEXT,
  scene_ids TEXT NOT NULL DEFAULT '[]',
  task_ids TEXT NOT NULL DEFAULT '[]',
  actor_ids TEXT NOT NULL DEFAULT '[]',
  attendance TEXT NOT NULL DEFAULT '{}',
  participant_order TEXT NOT NULL DEFAULT '[]',
  google_calendar_event_id TEXT,
  series_id TEXT,
  dismissed_warning_ids TEXT NOT NULL DEFAULT '[]',
  reminders_sent TEXT NOT NULL DEFAULT '[]',
  reminder_opt_out INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS schedule_blocks (
  id TEXT PRIMARY KEY,
  rehearsal_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  scene_id TEXT,
  task_id TEXT,
  notes TEXT,
  decided_notes TEXT,
  remaining_notes TEXT,
  block_order INTEGER NOT NULL DEFAULT 0,
  completed INTEGER
);

CREATE INDEX IF NOT EXISTS idx_play_roles_play_id ON play_roles(play_id);
CREATE INDEX IF NOT EXISTS idx_performances_play_id ON performances(play_id);
CREATE INDEX IF NOT EXISTS idx_scenes_play_id ON scenes(play_id);
CREATE INDEX IF NOT EXISTS idx_rehearsals_date ON rehearsals(date);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_rehearsal_id ON schedule_blocks(rehearsal_id);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_owner_user_id ON files(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_theater_members_user_id ON theater_members(user_id);
