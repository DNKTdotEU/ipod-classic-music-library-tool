CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artists TEXT NOT NULL,
  album TEXT,
  album_artist TEXT,
  track_number INTEGER,
  disc_number INTEGER,
  canonical_duration_sec REAL,
  year INTEGER,
  genre TEXT,
  compilation INTEGER NOT NULL DEFAULT 0,
  artwork_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_copies (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  path TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  format TEXT NOT NULL,
  codec TEXT,
  bitrate INTEGER,
  sample_rate INTEGER,
  channels INTEGER,
  duration_sec REAL NOT NULL,
  size_bytes INTEGER NOT NULL,
  modified_at TEXT NOT NULL,
  metadata_completeness REAL NOT NULL DEFAULT 0,
  fingerprint_hash TEXT,
  artwork_hash TEXT,
  has_artwork INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS duplicate_groups (
  id TEXT PRIMARY KEY,
  duplicate_type TEXT NOT NULL CHECK (duplicate_type IN ('exact', 'likely')),
  confidence REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('unreviewed', 'rule_resolved', 'user_resolved', 'conflict')),
  summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS duplicate_group_items (
  group_id TEXT NOT NULL REFERENCES duplicate_groups(id) ON DELETE CASCADE,
  file_copy_id TEXT NOT NULL REFERENCES file_copies(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, file_copy_id)
);

CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  preferred_formats TEXT NOT NULL,
  min_bitrate INTEGER,
  prefer_artwork INTEGER NOT NULL DEFAULT 1,
  prefer_metadata INTEGER NOT NULL DEFAULT 1,
  ask_on_conflict INTEGER NOT NULL DEFAULT 1,
  duration_threshold_sec REAL NOT NULL DEFAULT 2,
  is_ipod_profile INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quarantine_items (
  id TEXT PRIMARY KEY,
  file_copy_id TEXT,
  original_path TEXT NOT NULL,
  quarantined_path TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  duplicate_group_id TEXT,
  created_at TEXT NOT NULL,
  restored_at TEXT,
  deleted_permanently_at TEXT
);

CREATE TABLE IF NOT EXISTS history_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  message TEXT NOT NULL,
  payload_json TEXT,
  track_id TEXT,
  file_copy_id TEXT,
  duplicate_group_id TEXT,
  quarantine_item_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_file_copies_track ON file_copies(track_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_groups_status ON duplicate_groups(status);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON history_events(created_at);
