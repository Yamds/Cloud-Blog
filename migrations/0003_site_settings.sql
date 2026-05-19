PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO site_settings (key, value, updated_at)
VALUES
  ('site_name', 'Yamds''s Blog', CURRENT_TIMESTAMP),
  ('site_description', 'thoughts, craft and code.', CURRENT_TIMESTAMP),
  ('comments_enabled', 'true', CURRENT_TIMESTAMP),
  ('analytics_enabled', 'true', CURRENT_TIMESTAMP);
