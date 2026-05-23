CREATE TABLE file_backups (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT REFERENCES snapshots(id) ON DELETE SET NULL,
  original_path TEXT NOT NULL,
  backup_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  byte_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

