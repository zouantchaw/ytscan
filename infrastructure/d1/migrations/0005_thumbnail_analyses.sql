-- Migration number: 0005 2026-03-08T12:15:00Z

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS thumbnail_analyses (
  id TEXT PRIMARY KEY,
  video_id INTEGER NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'gemini',
  model_key TEXT NOT NULL,
  text_overlay TEXT,
  text_overlay_present INTEGER NOT NULL DEFAULT 0,
  text_position TEXT NOT NULL DEFAULT 'none',
  text_size TEXT NOT NULL DEFAULT 'none',
  has_face INTEGER NOT NULL DEFAULT 0,
  face_count INTEGER NOT NULL DEFAULT 0,
  expression TEXT,
  dominant_colors TEXT NOT NULL DEFAULT '[]',
  composition_style TEXT NOT NULL DEFAULT 'other',
  primary_subject TEXT,
  objects_json TEXT NOT NULL DEFAULT '[]',
  visual_hook TEXT,
  why_it_works TEXT,
  clarity_score INTEGER,
  analysis_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_thumbnail_analyses_video_id
  ON thumbnail_analyses(video_id);
CREATE INDEX IF NOT EXISTS idx_thumbnail_analyses_composition_style
  ON thumbnail_analyses(composition_style);
