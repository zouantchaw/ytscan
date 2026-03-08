-- Migration number: 0004 2026-03-08T09:25:00Z

PRAGMA foreign_keys = ON;

ALTER TABLE generation_jobs ADD COLUMN stage TEXT NOT NULL DEFAULT 'queued';
ALTER TABLE generation_jobs ADD COLUMN message TEXT;
ALTER TABLE generation_jobs ADD COLUMN lease_token TEXT;
ALTER TABLE generation_jobs ADD COLUMN lease_expires_at TEXT;
ALTER TABLE generation_jobs ADD COLUMN started_at TEXT;
ALTER TABLE generation_jobs ADD COLUMN completed_at TEXT;

CREATE TABLE IF NOT EXISTS generation_job_events (
  id TEXT PRIMARY KEY,
  generation_job_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  message TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (generation_job_id) REFERENCES generation_jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS generation_assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT,
  generation_job_id TEXT,
  asset_kind TEXT NOT NULL,
  variant TEXT,
  mime_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  byte_size INTEGER,
  r2_key TEXT NOT NULL UNIQUE,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES script_projects(id) ON DELETE SET NULL,
  FOREIGN KEY (generation_job_id) REFERENCES generation_jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_status_created_at
  ON generation_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_job_events_job_id
  ON generation_job_events(generation_job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_assets_project_id
  ON generation_assets(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_assets_job_id
  ON generation_assets(generation_job_id, created_at DESC);
