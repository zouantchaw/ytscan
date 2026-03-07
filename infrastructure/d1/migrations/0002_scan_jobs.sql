-- Migration number: 0002 2026-03-07T18:30:00Z

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS scan_jobs (
  id TEXT PRIMARY KEY,
  channel_url TEXT NOT NULL,
  requested_channel_slug TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  stage TEXT NOT NULL DEFAULT 'queued',
  progress REAL NOT NULL DEFAULT 0,
  total_videos INTEGER,
  processed_videos INTEGER,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_scan_jobs_status ON scan_jobs(status, created_at DESC);
