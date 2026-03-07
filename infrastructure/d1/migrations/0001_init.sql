-- Migration number: 0001 2026-03-07T14:00:00Z

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  channel_url TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  channel_youtube_id TEXT UNIQUE,
  total_videos INTEGER NOT NULL DEFAULT 0,
  subscriber_count INTEGER,
  scan_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL,
  youtube_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  upload_date TEXT NOT NULL,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  engagement_rate REAL NOT NULL DEFAULT 0,
  performance_tier TEXT NOT NULL DEFAULT 'average',
  thumbnail_path TEXT,
  transcript_path TEXT,
  source_path TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  start_time REAL NOT NULL DEFAULT 0,
  end_time REAL NOT NULL DEFAULT 60,
  word_count INTEGER NOT NULL DEFAULT 0,
  hook_type TEXT NOT NULL DEFAULT 'unknown',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transcript_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  vector_id TEXT NOT NULL UNIQUE,
  text TEXT NOT NULL,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  UNIQUE(video_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_channels_slug ON channels(slug);
CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_view_count ON videos(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_videos_upload_date ON videos(upload_date DESC);
CREATE INDEX IF NOT EXISTS idx_hooks_video_id ON hooks(video_id);
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_video_id ON transcript_chunks(video_id);
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_vector_id ON transcript_chunks(vector_id);
