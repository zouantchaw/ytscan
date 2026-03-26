CREATE TABLE IF NOT EXISTS uploaded_media_translations (
  id TEXT PRIMARY KEY,
  media_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  latest_generation_job_id TEXT,
  source_language TEXT,
  target_language TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gemini',
  status TEXT NOT NULL DEFAULT 'queued',
  translated_text TEXT,
  translated_word_count INTEGER NOT NULL DEFAULT 0,
  segment_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  translated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (media_id) REFERENCES uploaded_media(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (latest_generation_job_id) REFERENCES generation_jobs(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uploaded_media_translations_media_target
  ON uploaded_media_translations(media_id, target_language);

CREATE INDEX IF NOT EXISTS idx_uploaded_media_translations_workspace_created
  ON uploaded_media_translations(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS uploaded_media_translation_segments (
  id TEXT PRIMARY KEY,
  translation_id TEXT NOT NULL,
  segment_index INTEGER NOT NULL,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  text TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (translation_id) REFERENCES uploaded_media_translations(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uploaded_media_translation_segments_translation_segment
  ON uploaded_media_translation_segments(translation_id, segment_index);
