CREATE TABLE IF NOT EXISTS media_object_variants (
  id TEXT PRIMARY KEY,
  media_object_id TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('webp_1080', 'webp_720')),
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER,
  size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'error')),
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (media_object_id) REFERENCES media_objects(id) ON DELETE CASCADE,
  UNIQUE (media_object_id, variant)
);

CREATE INDEX IF NOT EXISTS idx_media_object_variants_media_id
  ON media_object_variants(media_object_id);
