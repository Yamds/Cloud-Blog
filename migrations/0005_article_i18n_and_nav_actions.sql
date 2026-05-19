PRAGMA foreign_keys = ON;

ALTER TABLE articles ADD COLUMN language TEXT NOT NULL DEFAULT 'zh' CHECK (language IN ('zh', 'en'));
ALTER TABLE articles ADD COLUMN translation_group_id TEXT;
ALTER TABLE articles ADD COLUMN translated_from_article_id TEXT REFERENCES articles(id) ON DELETE SET NULL;

UPDATE articles
SET translation_group_id = id
WHERE translation_group_id IS NULL OR translation_group_id = '';

CREATE INDEX IF NOT EXISTS idx_articles_language ON articles(language);
CREATE INDEX IF NOT EXISTS idx_articles_translation_group_id ON articles(translation_group_id);
CREATE INDEX IF NOT EXISTS idx_articles_translated_from_article_id ON articles(translated_from_article_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_translation_group_language
  ON articles(translation_group_id, language)
  WHERE translation_group_id IS NOT NULL;

INSERT OR IGNORE INTO site_settings (key, value, updated_at)
VALUES ('nav_actions', '[]', CURRENT_TIMESTAMP);
