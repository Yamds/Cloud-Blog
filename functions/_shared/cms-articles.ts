import { queryAll, queryFirst } from "./d1";
import { ApiError } from "./http";

export type CmsArticleStatus = "draft" | "published" | "archived";
export type CmsArticleRevisionReason = "manual_save" | "publish" | "archive" | "rollback";
export type CmsArticleLanguage = "zh" | "en";

export interface CmsArticleTranslationLink {
  id: string;
  slug: string;
  title: string;
  language: CmsArticleLanguage;
  status: CmsArticleStatus;
  translatedFromArticleId: string | null;
  updatedAt: string;
}

export interface CmsArticleDetail {
  id: string;
  slug: string;
  title: string;
  summary: string;
  iconName: string;
  status: CmsArticleStatus;
  language: CmsArticleLanguage;
  translationGroupId: string;
  translatedFromArticleId: string | null;
  translations: CmsArticleTranslationLink[];
  tags: string[];
  contentText: string;
  contentJson: Record<string, unknown>;
  readingMinutes: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsArticleRevision {
  id: string;
  articleId: string;
  title: string;
  summary: string;
  iconName: string;
  contentText: string;
  tags: string[];
  reason: CmsArticleRevisionReason | string;
  createdBy: string;
  createdAt: string;
}

export interface CmsArticleAutosave {
  id: string;
  articleId: string;
  title: string;
  iconName: string;
  contentText: string;
  contentJson: Record<string, unknown>;
  tags: string[];
  createdAt: string;
}

export interface CmsArticleInput {
  title?: string;
  slug?: string;
  summary?: string;
  iconName?: string;
  tags?: string[];
  status?: CmsArticleStatus;
  language?: CmsArticleLanguage;
  translationGroupId?: string | null;
  translatedFromArticleId?: string | null;
  contentText?: string;
  contentJson?: Record<string, unknown>;
}

export interface CmsArticleStats {
  total: number;
  published: number;
  draft: number;
  archived: number;
  tags: number;
}

interface CmsArticleRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  icon_name: string | null;
  status: CmsArticleStatus;
  language: string | null;
  translation_group_id: string | null;
  translated_from_article_id: string | null;
  tags_csv: string | null;
  content_json: string | null;
  content_text: string | null;
  reading_minutes: number | string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CmsTranslationRow {
  id: string;
  slug: string;
  title: string;
  language: string | null;
  status: CmsArticleStatus;
  translation_group_id: string | null;
  translated_from_article_id: string | null;
  updated_at: string;
}

interface CmsStatsRow {
  total: number | string;
  published: number | string;
  draft: number | string;
  archived: number | string;
  tags: number | string;
}

interface CmsRevisionRow {
  id: string;
  article_id: string;
  title: string;
  summary: string | null;
  icon_name: string | null;
  content_text: string | null;
  tags_json: string | null;
  reason: string;
  created_by: string;
  created_at: string;
}

interface CmsRevisionDetailRow extends CmsRevisionRow {
  content_json: string;
}

interface CmsAutosaveRow {
  id: string;
  article_id: string;
  title: string | null;
  icon_name: string | null;
  content_json: string;
  content_text: string | null;
  tags_json: string | null;
  created_at: string;
}

const TAG_SEPARATOR = "\u001f";
const DEFAULT_TITLE = "未命名文章";
const DEFAULT_ICON_NAME = "ph:article";
const DEFAULT_LANGUAGE: CmsArticleLanguage = "zh";
const VALID_LANGUAGES: CmsArticleLanguage[] = ["zh", "en"];

export async function listCmsArticles(db: D1Database): Promise<CmsArticleDetail[]> {
  const rows = await queryAll<CmsArticleRow>(
    db.prepare(`
      SELECT
        a.id,
        a.slug,
        a.title,
        a.summary,
        a.icon_name,
        a.status,
        a.language,
        a.translation_group_id,
        a.translated_from_article_id,
        GROUP_CONCAT(t.name, '${TAG_SEPARATOR}') AS tags_csv,
        a.content_json,
        a.content_text,
        a.reading_minutes,
        a.published_at,
        a.created_at,
        a.updated_at
      FROM articles AS a
      LEFT JOIN article_tags AS article_tag ON article_tag.article_id = a.id
      LEFT JOIN tags AS t ON t.id = article_tag.tag_id
      GROUP BY a.id
      ORDER BY a.updated_at DESC
    `),
  );
  const translationsMap = await loadTranslationsMap(db, rows);

  return rows.map((row) => mapCmsArticleRow(row, translationsMap.get(row.id) ?? []));
}

export async function getCmsArticle(db: D1Database, id: string): Promise<CmsArticleDetail | null> {
  const row = await queryFirst<CmsArticleRow>(
    db
      .prepare(
        `
          SELECT
            a.id,
            a.slug,
            a.title,
            a.summary,
            a.icon_name,
            a.status,
            a.language,
            a.translation_group_id,
            a.translated_from_article_id,
            GROUP_CONCAT(t.name, '${TAG_SEPARATOR}') AS tags_csv,
            a.content_json,
            a.content_text,
            a.reading_minutes,
            a.published_at,
            a.created_at,
            a.updated_at
          FROM articles AS a
          LEFT JOIN article_tags AS article_tag ON article_tag.article_id = a.id
          LEFT JOIN tags AS t ON t.id = article_tag.tag_id
          WHERE a.id = ?
          GROUP BY a.id
          LIMIT 1
        `,
      )
      .bind(id),
  );

  if (!row) {
    return null;
  }

  const translationsMap = await loadTranslationsMap(db, [row]);
  return mapCmsArticleRow(row, translationsMap.get(row.id) ?? []);
}

export async function getCmsStats(db: D1Database): Promise<CmsArticleStats> {
  const row = await queryFirst<CmsStatsRow>(
    db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived,
        (SELECT COUNT(*) FROM tags) AS tags
      FROM articles
    `),
  );

  return {
    total: normalizeNumber(row?.total),
    published: normalizeNumber(row?.published),
    draft: normalizeNumber(row?.draft),
    archived: normalizeNumber(row?.archived),
    tags: normalizeNumber(row?.tags),
  };
}

export async function createCmsArticle(
  db: D1Database,
  authorId: string,
  input: CmsArticleInput,
): Promise<CmsArticleDetail> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const title = normalizeTitle(input.title);
  const contentText = normalizeContentText(input.contentText);
  const contentJson = normalizeContentJson(input.contentJson, contentText);
  const language = normalizeLanguage(input.language);
  const translatedFromArticleId = await normalizeTranslatedFromArticleId(db, input.translatedFromArticleId, language);
  const translationGroupId = await resolveTranslationGroupId(
    db,
    input.translationGroupId,
    translatedFromArticleId,
    language,
    id,
  );
  await assertTranslationLanguageAvailable(db, translationGroupId, language);
  const slug = await ensureUniqueSlug(db, normalizeSlug(input.slug || title || id));
  const status = normalizeStatus(input.status ?? "draft");
  const publishedAt = status === "published" ? now : null;

  await runStatement(
    db
      .prepare(
        `
          INSERT INTO articles (
            id,
            title,
            slug,
            summary,
            icon_name,
            status,
            language,
            translation_group_id,
            translated_from_article_id,
            reading_minutes,
            content_json,
            content_text,
            content_html,
            author_id,
            published_at,
            created_at,
            updated_at,
            archived_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        id,
        title,
        slug,
        normalizeSummary(input.summary),
        normalizeIconName(input.iconName),
        status,
        language,
        translationGroupId,
        translatedFromArticleId,
        estimateReadingMinutes(contentText),
        JSON.stringify(contentJson),
        contentText,
        authorId,
        publishedAt,
        now,
        now,
        status === "archived" ? now : null,
      ),
  );

  await syncArticleTags(db, id, input.tags ?? []);
  const article = await getCmsArticle(db, id);

  if (!article) {
    throw new ApiError(500, "DATABASE_ERROR", "Failed to read created article.");
  }

  await insertArticleRevision(db, article, authorId, "manual_save");
  return article;
}

export async function updateCmsArticle(
  db: D1Database,
  id: string,
  input: CmsArticleInput,
  actorId?: string,
  revisionReason: CmsArticleRevisionReason = "manual_save",
): Promise<CmsArticleDetail> {
  const existing = await getCmsArticle(db, id);

  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Article not found.");
  }

  const now = new Date().toISOString();
  const title = input.title !== undefined ? normalizeTitle(input.title) : existing.title;
  const contentText =
    input.contentText !== undefined ? normalizeContentText(input.contentText) : existing.contentText;
  const contentJson =
    input.contentJson !== undefined ? normalizeContentJson(input.contentJson, contentText) : existing.contentJson;
  const status = input.status !== undefined ? normalizeStatus(input.status) : existing.status;
  const language = input.language !== undefined ? normalizeLanguage(input.language) : existing.language;
  const translatedFromArticleId =
    input.translatedFromArticleId !== undefined
      ? await normalizeTranslatedFromArticleId(db, input.translatedFromArticleId, language, id)
      : existing.translatedFromArticleId;
  const translationGroupId = await resolveTranslationGroupId(
    db,
    input.translationGroupId !== undefined ? input.translationGroupId : existing.translationGroupId,
    translatedFromArticleId,
    language,
    id,
  );
  await assertTranslationLanguageAvailable(db, translationGroupId, language, id);

  const nextSlug =
    input.slug !== undefined
      ? await ensureUniqueSlug(db, normalizeSlug(input.slug || title), id)
      : await resolveAutomaticSlug(db, existing, title);
  const publishedAt =
    status === "published" ? existing.publishedAt ?? now : status === "archived" ? existing.publishedAt : null;

  await runStatement(
    db
      .prepare(
        `
          UPDATE articles
          SET
            title = ?,
            slug = ?,
            summary = ?,
            icon_name = ?,
            status = ?,
            language = ?,
            translation_group_id = ?,
            translated_from_article_id = ?,
            reading_minutes = ?,
            content_json = ?,
            content_text = ?,
            published_at = ?,
            updated_at = ?,
            archived_at = ?
          WHERE id = ?
        `,
      )
      .bind(
        title,
        nextSlug,
        input.summary !== undefined ? normalizeSummary(input.summary) : existing.summary,
        input.iconName !== undefined ? normalizeIconName(input.iconName) : existing.iconName,
        status,
        language,
        translationGroupId,
        translatedFromArticleId,
        estimateReadingMinutes(contentText),
        JSON.stringify(contentJson),
        contentText,
        publishedAt,
        now,
        status === "archived" ? now : null,
        id,
      ),
  );

  if (input.tags !== undefined) {
    await syncArticleTags(db, id, input.tags);
  }

  const article = await getCmsArticle(db, id);

  if (!article) {
    throw new ApiError(500, "DATABASE_ERROR", "Failed to read updated article.");
  }

  if (actorId) {
    await insertArticleRevision(db, article, actorId, revisionReason);
  }

  return article;
}

export async function createArticleAutosave(
  db: D1Database,
  id: string,
  input: CmsArticleInput,
): Promise<CmsArticleAutosave> {
  const existing = await getCmsArticle(db, id);

  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Article not found.");
  }

  const now = new Date().toISOString();
  const contentText =
    input.contentText !== undefined ? normalizeContentText(input.contentText) : existing.contentText;
  const contentJson =
    input.contentJson !== undefined ? normalizeContentJson(input.contentJson, contentText) : existing.contentJson;
  const autosave: CmsArticleAutosave = {
    id: crypto.randomUUID(),
    articleId: id,
    title: input.title !== undefined ? normalizeTitle(input.title) : existing.title,
    iconName: input.iconName !== undefined ? normalizeIconName(input.iconName) : existing.iconName,
    contentText,
    contentJson,
    tags: input.tags !== undefined ? readTags(input.tags) : existing.tags,
    createdAt: now,
  };

  await runStatement(
    db
      .prepare(
        `
          INSERT INTO article_autosaves (
            id,
            article_id,
            title,
            icon_name,
            content_json,
            content_text,
            tags_json,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        autosave.id,
        autosave.articleId,
        autosave.title,
        autosave.iconName,
        JSON.stringify(autosave.contentJson),
        autosave.contentText,
        JSON.stringify(autosave.tags),
        autosave.createdAt,
      ),
  );

  await runStatement(
    db
      .prepare(
        `
          DELETE FROM article_autosaves
          WHERE article_id = ?
            AND id NOT IN (
              SELECT id
              FROM article_autosaves
              WHERE article_id = ?
              ORDER BY created_at DESC
              LIMIT 20
            )
        `,
      )
      .bind(id, id),
  );

  return autosave;
}

export async function deleteCmsArticle(db: D1Database, id: string): Promise<void> {
  const existing = await getCmsArticle(db, id);

  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Article not found.");
  }

  await runStatement(db.prepare("UPDATE page_views SET article_id = NULL WHERE article_id = ?").bind(id));
  await runStatement(db.prepare("UPDATE media_objects SET article_id = NULL WHERE article_id = ?").bind(id));
  await runStatement(db.prepare("UPDATE ai_outputs SET article_id = NULL WHERE article_id = ?").bind(id));
  await runStatement(
    db.prepare("UPDATE articles SET translated_from_article_id = NULL WHERE translated_from_article_id = ?").bind(id),
  );

  await runStatement(db.prepare("DELETE FROM comments WHERE article_id = ?").bind(id));
  await runStatement(db.prepare("DELETE FROM article_autosaves WHERE article_id = ?").bind(id));
  await runStatement(db.prepare("DELETE FROM article_revisions WHERE article_id = ?").bind(id));
  await runStatement(db.prepare("DELETE FROM article_tags WHERE article_id = ?").bind(id));
  await runStatement(db.prepare("DELETE FROM articles WHERE id = ?").bind(id));
}

export async function getLatestArticleAutosave(
  db: D1Database,
  id: string,
): Promise<CmsArticleAutosave | null> {
  const row = await queryFirst<CmsAutosaveRow>(
    db
      .prepare(
        `
          SELECT
            id,
            article_id,
            title,
            icon_name,
            content_json,
            content_text,
            tags_json,
            created_at
          FROM article_autosaves
          WHERE article_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `,
      )
      .bind(id),
  );

  return row ? mapAutosaveRow(row) : null;
}

export async function listArticleRevisions(
  db: D1Database,
  id: string,
): Promise<CmsArticleRevision[]> {
  const existing = await getCmsArticle(db, id);

  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Article not found.");
  }

  const rows = await queryAll<CmsRevisionRow>(
    db
      .prepare(
        `
          SELECT
            id,
            article_id,
            title,
            summary,
            icon_name,
            content_text,
            tags_json,
            reason,
            created_by,
            created_at
          FROM article_revisions
          WHERE article_id = ?
          ORDER BY created_at DESC
        `,
      )
      .bind(id),
  );

  return rows.map(mapRevisionRow);
}

export async function restoreArticleRevision(
  db: D1Database,
  articleId: string,
  revisionId: string,
  actorId: string,
): Promise<CmsArticleDetail> {
  const revision = await queryFirst<CmsRevisionDetailRow>(
    db
      .prepare(
        `
          SELECT
            id,
            article_id,
            title,
            summary,
            icon_name,
            content_json,
            content_text,
            tags_json,
            reason,
            created_by,
            created_at
          FROM article_revisions
          WHERE article_id = ?
            AND id = ?
          LIMIT 1
        `,
      )
      .bind(articleId, revisionId),
  );

  if (!revision) {
    throw new ApiError(404, "NOT_FOUND", "Revision not found.");
  }

  return updateCmsArticle(
    db,
    articleId,
    {
      title: revision.title,
      summary: revision.summary ?? "",
      iconName: revision.icon_name ?? DEFAULT_ICON_NAME,
      contentText: revision.content_text ?? "",
      contentJson: parseContentJson(revision.content_json, revision.content_text ?? ""),
      tags: parseTagsJson(revision.tags_json),
    },
    actorId,
    "rollback",
  );
}

export function readCmsArticleInput(value: unknown): CmsArticleInput {
  if (!value || typeof value !== "object") {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be a JSON object.");
  }

  const body = value as Record<string, unknown>;
  const input: CmsArticleInput = {};

  if ("title" in body) input.title = readOptionalString(body.title, 160);
  if ("slug" in body) input.slug = readOptionalString(body.slug, 180);
  if ("summary" in body) input.summary = readOptionalString(body.summary, 500);
  if ("iconName" in body) input.iconName = readOptionalString(body.iconName, 80);
  if ("contentText" in body) input.contentText = readOptionalString(body.contentText, 100_000);
  if ("contentJson" in body && body.contentJson !== undefined) input.contentJson = readContentJson(body.contentJson);
  if ("status" in body && body.status !== undefined) input.status = normalizeStatus(String(body.status));
  if ("language" in body && body.language !== undefined) input.language = normalizeLanguage(body.language);
  if ("translationGroupId" in body) input.translationGroupId = readOptionalNullableId(body.translationGroupId);
  if ("translatedFromArticleId" in body) input.translatedFromArticleId = readOptionalNullableId(body.translatedFromArticleId);
  if ("tags" in body && body.tags !== undefined) input.tags = readTags(body.tags);

  return input;
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}

function mapCmsArticleRow(row: CmsArticleRow, translations: CmsArticleTranslationLink[]): CmsArticleDetail {
  const language = normalizeLanguage(row.language);
  const translationGroupId = normalizeStoredTranslationGroupId(row.translation_group_id, row.id);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? "",
    iconName: row.icon_name ?? DEFAULT_ICON_NAME,
    status: row.status,
    language,
    translationGroupId,
    translatedFromArticleId: row.translated_from_article_id ?? null,
    translations,
    tags: parseTags(row.tags_csv),
    contentText: row.content_text ?? "",
    contentJson: parseContentJson(row.content_json, row.content_text ?? ""),
    readingMinutes: normalizeNumber(row.reading_minutes) || 1,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRevisionRow(row: CmsRevisionRow): CmsArticleRevision {
  return {
    id: row.id,
    articleId: row.article_id,
    title: row.title,
    summary: row.summary ?? "",
    iconName: row.icon_name ?? DEFAULT_ICON_NAME,
    contentText: row.content_text ?? "",
    tags: parseTagsJson(row.tags_json),
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapAutosaveRow(row: CmsAutosaveRow): CmsArticleAutosave {
  return {
    id: row.id,
    articleId: row.article_id,
    title: row.title ?? DEFAULT_TITLE,
    iconName: row.icon_name ?? DEFAULT_ICON_NAME,
    contentText: row.content_text ?? "",
    contentJson: parseContentJson(row.content_json, row.content_text ?? ""),
    tags: parseTagsJson(row.tags_json),
    createdAt: row.created_at,
  };
}

async function loadTranslationsMap(
  db: D1Database,
  rows: CmsArticleRow[],
): Promise<Map<string, CmsArticleTranslationLink[]>> {
  const translationKeys = [...new Set(rows.map((row) => normalizeStoredTranslationGroupId(row.translation_group_id, row.id)))];
  const map = new Map<string, CmsArticleTranslationLink[]>();

  if (translationKeys.length === 0) {
    return map;
  }

  const placeholders = translationKeys.map(() => "?").join(", ");
  const translationRows = await queryAll<CmsTranslationRow>(
    db.prepare(
      `
        SELECT
          id,
          slug,
          title,
          language,
          status,
          translation_group_id,
          translated_from_article_id,
          updated_at
        FROM articles
        WHERE translation_group_id IN (${placeholders})
        ORDER BY updated_at DESC
      `,
    ).bind(...translationKeys),
  );

  const grouped = new Map<string, CmsTranslationRow[]>();
  for (const row of translationRows) {
    const key = normalizeStoredTranslationGroupId(row.translation_group_id, row.id);
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  }

  for (const row of rows) {
    const key = normalizeStoredTranslationGroupId(row.translation_group_id, row.id);
    const links = (grouped.get(key) ?? [])
      .filter((item) => item.id !== row.id)
      .map((item) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        language: normalizeLanguage(item.language),
        status: item.status,
        translatedFromArticleId: item.translated_from_article_id ?? null,
        updatedAt: item.updated_at,
      }));
    map.set(row.id, links);
  }

  return map;
}

async function syncArticleTags(db: D1Database, articleId: string, tags: string[]): Promise<void> {
  const normalizedTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
  await runStatement(db.prepare("DELETE FROM article_tags WHERE article_id = ?").bind(articleId));

  for (const tag of normalizedTags) {
    const slug = normalizeSlug(tag);
    const tagId = `tag_${slug}`;

    await runStatement(
      db
        .prepare(
          `
            INSERT INTO tags (id, name, slug, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET name = excluded.name
          `,
        )
        .bind(tagId, tag, slug, new Date().toISOString()),
    );

    const savedTag = await queryFirst<{ id: string }>(
      db.prepare("SELECT id FROM tags WHERE slug = ? LIMIT 1").bind(slug),
    );

    if (savedTag) {
      await runStatement(
        db
          .prepare("INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)")
          .bind(articleId, savedTag.id),
      );
    }
  }
}

async function ensureUniqueSlug(db: D1Database, baseSlug: string, currentArticleId?: string): Promise<string> {
  const resolvedBase = baseSlug || crypto.randomUUID().slice(0, 8);
  let slug = resolvedBase;
  let index = 2;

  while (await slugExists(db, slug, currentArticleId)) {
    slug = `${resolvedBase}-${index}`;
    index += 1;
  }

  return slug;
}

async function resolveAutomaticSlug(
  db: D1Database,
  existing: CmsArticleDetail,
  title: string,
): Promise<string> {
  if (title !== DEFAULT_TITLE && isDefaultTitleSlug(existing.slug)) {
    return ensureUniqueSlug(db, normalizeSlug(title), existing.id);
  }

  return existing.slug;
}

function isDefaultTitleSlug(slug: string): boolean {
  const defaultSlug = normalizeSlug(DEFAULT_TITLE);

  if (slug === defaultSlug) {
    return true;
  }

  if (!slug.startsWith(`${defaultSlug}-`)) {
    return false;
  }

  return /^\d+$/.test(slug.slice(defaultSlug.length + 1));
}

async function slugExists(db: D1Database, slug: string, currentArticleId?: string): Promise<boolean> {
  const row = await queryFirst<{ id: string }>(
    db.prepare("SELECT id FROM articles WHERE slug = ? LIMIT 1").bind(slug),
  );

  return Boolean(row && row.id !== currentArticleId);
}

function contentTextToJson(contentText: string): Record<string, unknown> {
  const paragraphs = contentText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: paragraph,
        },
      ],
    }));

  return {
    type: "doc",
    content: paragraphs.length ? paragraphs : [{ type: "paragraph" }],
  };
}

function estimateReadingMinutes(contentText: string): number {
  const text = contentText.trim();

  if (!text) {
    return 1;
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const nonWhitespaceCharacters = text.replace(/\s+/g, "").length;
  return Math.max(1, Math.ceil(Math.max(wordCount / 200, nonWhitespaceCharacters / 400)));
}

function normalizeTitle(value: string | undefined): string {
  const title = value?.trim();
  return title || DEFAULT_TITLE;
}

function normalizeSummary(value: string | undefined): string {
  return value?.trim() ?? "";
}

function normalizeIconName(value: string | undefined): string {
  const iconName = value?.trim();
  return iconName || DEFAULT_ICON_NAME;
}

function normalizeContentText(value: string | undefined): string {
  return value?.trim() ?? "";
}

function normalizeStatus(value: string): CmsArticleStatus {
  if (value === "draft" || value === "published" || value === "archived") {
    return value;
  }

  throw new ApiError(400, "VALIDATION_ERROR", "Invalid article status.");
}

function normalizeLanguage(value: unknown): CmsArticleLanguage {
  if (typeof value !== "string") {
    return DEFAULT_LANGUAGE;
  }

  const normalized = value.trim().toLowerCase();
  if (VALID_LANGUAGES.includes(normalized as CmsArticleLanguage)) {
    return normalized as CmsArticleLanguage;
  }

  throw new ApiError(400, "VALIDATION_ERROR", "language must be zh or en.");
}

function normalizeSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

  return slug || crypto.randomUUID().slice(0, 8);
}

function readOptionalString(value: unknown, maxLength: number): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "Expected string value.");
  }

  return value.slice(0, maxLength);
}

function readOptionalNullableId(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "Expected string identifier.");
  }

  const normalized = value.trim().slice(0, 120);
  return normalized || null;
}

function readContentJson(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "contentJson must be an object.");
  }

  const serialized = JSON.stringify(value);
  if (serialized.length > 200_000) {
    throw new ApiError(400, "VALIDATION_ERROR", "contentJson is too large.");
  }

  return value as Record<string, unknown>;
}

function normalizeContentJson(
  value: Record<string, unknown> | undefined,
  contentText: string,
): Record<string, unknown> {
  if (!value) {
    return contentTextToJson(contentText);
  }

  if (value.type !== "doc" || !Array.isArray(value.content)) {
    throw new ApiError(400, "VALIDATION_ERROR", "contentJson must be a Tiptap doc.");
  }

  return value;
}

function parseContentJson(raw: string | null | undefined, contentText: string): Record<string, unknown> {
  if (!raw) {
    return contentTextToJson(contentText);
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return readContentJson(parsed);
  } catch {
    return contentTextToJson(contentText);
  }
}

function readTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "tags must be an array.");
  }

  return value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function parseTags(tagsCsv: string | null | undefined): string[] {
  if (!tagsCsv) {
    return [];
  }

  return [...new Set(tagsCsv.split(TAG_SEPARATOR).map((tag) => tag.trim()).filter(Boolean))];
}

function parseTagsJson(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function normalizeNumber(value: number | string | null | undefined): number {
  const numericValue = typeof value === "string" ? Number(value) : value;
  return typeof numericValue === "number" && Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizeStoredTranslationGroupId(value: string | null | undefined, fallbackId: string): string {
  const normalized = value?.trim();
  return normalized || fallbackId;
}

async function normalizeTranslatedFromArticleId(
  db: D1Database,
  value: string | null | undefined,
  language: CmsArticleLanguage,
  currentArticleId?: string,
): Promise<string | null> {
  if (value === undefined || value === null || value === "") {
    if (language === "zh") {
      return null;
    }

    return null;
  }

  const normalized = value.trim();
  const row = await queryFirst<{
    id: string;
    language: string | null;
    translation_group_id: string | null;
  }>(
    db
      .prepare(
        `
          SELECT id, language, translation_group_id
          FROM articles
          WHERE id = ?
          LIMIT 1
        `,
      )
      .bind(normalized),
  );

  if (!row) {
    throw new ApiError(400, "VALIDATION_ERROR", "translatedFromArticleId does not exist.");
  }

  if (row.id === currentArticleId) {
    throw new ApiError(400, "VALIDATION_ERROR", "translatedFromArticleId cannot point to the same article.");
  }

  if (language === "zh") {
    throw new ApiError(400, "VALIDATION_ERROR", "Chinese articles cannot set translatedFromArticleId.");
  }

  if (normalizeLanguage(row.language) !== "zh") {
    throw new ApiError(400, "VALIDATION_ERROR", "translatedFromArticleId must point to a Chinese article.");
  }

  return row.id;
}

async function resolveTranslationGroupId(
  db: D1Database,
  requestedGroupId: string | null | undefined,
  translatedFromArticleId: string | null,
  language: CmsArticleLanguage,
  fallbackArticleId: string,
): Promise<string> {
  if (translatedFromArticleId) {
    const source = await queryFirst<{ translation_group_id: string | null }>(
      db
        .prepare("SELECT translation_group_id FROM articles WHERE id = ? LIMIT 1")
        .bind(translatedFromArticleId),
    );
    return normalizeStoredTranslationGroupId(source?.translation_group_id, translatedFromArticleId);
  }

  const normalizedRequested = requestedGroupId?.trim();

  if (normalizedRequested) {
    const groupOwner = await queryFirst<{ id: string }>(
      db
        .prepare("SELECT id FROM articles WHERE translation_group_id = ? LIMIT 1")
        .bind(normalizedRequested),
    );

    if (!groupOwner) {
      throw new ApiError(400, "VALIDATION_ERROR", "translationGroupId does not exist.");
    }

    return normalizedRequested;
  }

  if (language === "zh") {
    return fallbackArticleId;
  }

  return fallbackArticleId;
}

async function assertTranslationLanguageAvailable(
  db: D1Database,
  translationGroupId: string,
  language: CmsArticleLanguage,
  currentArticleId?: string,
): Promise<void> {
  const row = await queryFirst<{ id: string }>(
    db
      .prepare(
        `
          SELECT id
          FROM articles
          WHERE translation_group_id = ?
            AND language = ?
          LIMIT 1
        `,
      )
      .bind(translationGroupId, language),
  );

  if (row && row.id !== currentArticleId) {
    throw new ApiError(409, "CONFLICT", `An article with language ${language} already exists in this translation group.`);
  }
}

async function runStatement(statement: D1PreparedStatement): Promise<void> {
  try {
    await statement.run();
  } catch (error) {
    console.error("D1 statement failed", error);
    throw new ApiError(500, "DATABASE_ERROR", "Database write failed.");
  }
}

async function insertArticleRevision(
  db: D1Database,
  article: CmsArticleDetail,
  actorId: string,
  reason: CmsArticleRevisionReason,
): Promise<void> {
  await runStatement(
    db
      .prepare(
        `
          INSERT INTO article_revisions (
            id,
            article_id,
            title,
            summary,
            icon_name,
            content_json,
            content_text,
            tags_json,
            reason,
            created_by,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        crypto.randomUUID(),
        article.id,
        article.title,
        article.summary,
        article.iconName,
        JSON.stringify(article.contentJson),
        article.contentText,
        JSON.stringify(article.tags),
        reason,
        actorId,
        new Date().toISOString(),
      ),
  );
}
