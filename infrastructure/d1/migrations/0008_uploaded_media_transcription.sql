CREATE TABLE IF NOT EXISTS uploaded_media (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  source_kind TEXT NOT NULL DEFAULT 'upload',
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_upload',
  upload_token_hash TEXT,
  upload_expires_at TEXT,
  r2_key TEXT,
  duration_sec REAL,
  language TEXT,
  transcript_text TEXT,
  transcript_word_count INTEGER NOT NULL DEFAULT 0,
  segment_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  uploaded_at TEXT,
  transcribed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_uploaded_media_workspace_created
  ON uploaded_media(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_uploaded_media_workspace_status
  ON uploaded_media(workspace_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS uploaded_media_segments (
  id TEXT PRIMARY KEY,
  media_id TEXT NOT NULL,
  segment_index INTEGER NOT NULL,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  text TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (media_id) REFERENCES uploaded_media(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uploaded_media_segments_media_segment
  ON uploaded_media_segments(media_id, segment_index);

ALTER TABLE generation_jobs ADD COLUMN uploaded_media_id TEXT REFERENCES uploaded_media(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_generation_jobs_uploaded_media_created
  ON generation_jobs(uploaded_media_id, created_at DESC);
