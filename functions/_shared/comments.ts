import { queryAll, queryFirst } from "./d1";
import { type CurrentUser } from "./auth";
import { ApiError } from "./http";
import { getSiteSettings } from "./settings";

export const COMMENT_CONTENT_MAX_LENGTH = 1000;
const COMMENT_RATE_LIMIT_WINDOW_MINUTES = 10;
const COMMENT_RATE_LIMIT_MAX_COUNT = 5;

export interface CommentPayload {
  id: string;
  articleId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  authorHtmlUrl: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  replies: CommentPayload[];
}

export interface CmsCommentPayload {
  id: string;
  articleId: string;
  articleSlug: string;
  articleTitle: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  content: string;
  status: "visible" | "hidden" | "deleted";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  repliesCount: number;
}

interface ArticleRow {
  id: string;
}

interface CommentRow {
  id: string;
  article_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  status: "visible" | "hidden" | "deleted";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface CommentListRow {
  id: string;
  article_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  author_name: string;
  author_avatar: string | null;
  author_html_url: string | null;
}

interface CmsCommentRow {
  id: string;
  article_id: string;
  article_slug: string;
  article_title: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  parent_id: string | null;
  content: string;
  status: "visible" | "hidden" | "deleted";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  replies_count: number | string | null;
}

interface CountRow {
  count: number | string | null;
}

const PUBLISHED_ARTICLE_BY_SLUG_SQL = `
  SELECT id
  FROM articles
  WHERE slug = ?
    AND status = 'published'
  LIMIT 1
`;

const COMMENT_LIST_BY_ARTICLE_SQL = `
  SELECT
    c.id,
    c.article_id,
    c.author_id,
    c.parent_id,
    c.content,
    c.created_at,
    c.updated_at,
    u.github_login AS author_name,
    u.github_avatar_url AS author_avatar,
    u.github_html_url AS author_html_url
  FROM comments AS c
  INNER JOIN users AS u
    ON u.id = c.author_id
  WHERE c.article_id = ?
    AND c.status = 'visible'
  ORDER BY c.created_at ASC, c.id ASC
`;

const COMMENT_BY_ID_SQL = `
  SELECT
    id,
    article_id,
    author_id,
    parent_id,
    content,
    status,
    created_at,
    updated_at,
    deleted_at
  FROM comments
  WHERE id = ?
  LIMIT 1
`;

const COMMENT_PAYLOAD_BY_ID_SQL = `
  SELECT
    c.id,
    c.article_id,
    c.author_id,
    c.parent_id,
    c.content,
    c.created_at,
    c.updated_at,
    u.github_login AS author_name,
    u.github_avatar_url AS author_avatar,
    u.github_html_url AS author_html_url
  FROM comments AS c
  INNER JOIN users AS u
    ON u.id = c.author_id
  WHERE c.id = ?
  LIMIT 1
`;

const CMS_COMMENTS_SQL = `
  SELECT
    c.id,
    c.article_id,
    a.slug AS article_slug,
    a.title AS article_title,
    c.author_id,
    u.github_login AS author_name,
    u.github_avatar_url AS author_avatar,
    c.parent_id,
    c.content,
    c.status,
    c.created_at,
    c.updated_at,
    c.deleted_at,
    (
      SELECT COUNT(*)
      FROM comments AS reply
      WHERE reply.parent_id = c.id
    ) AS replies_count
  FROM comments AS c
  INNER JOIN users AS u
    ON u.id = c.author_id
  INNER JOIN articles AS a
    ON a.id = c.article_id
  ORDER BY c.created_at DESC
  LIMIT 200
`;

export async function listVisibleCommentsByArticleSlug(
  db: D1Database,
  slug: string,
): Promise<CommentPayload[]> {
  const article = await getPublishedArticleBySlug(db, slug);

  if (!article) {
    throw new ApiError(404, "NOT_FOUND", "Article not found.");
  }

  return listVisibleCommentsByArticleId(db, article.id);
}

export async function createCommentForArticleSlug(
  db: D1Database,
  slug: string,
  author: CurrentUser,
  rawContent: unknown,
): Promise<CommentPayload> {
  await requireCommentsEnabled(db);
  const article = await getPublishedArticleBySlug(db, slug);

  if (!article) {
    throw new ApiError(404, "NOT_FOUND", "Article not found.");
  }

  await enforceCommentRateLimit(db, author.id, article.id);
  const content = normalizeCommentContent(rawContent);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await runStatement(
    db
      .prepare(
        `
          INSERT INTO comments (
            id,
            article_id,
            author_id,
            parent_id,
            content,
            status,
            created_at,
            updated_at,
            deleted_at
          ) VALUES (?, ?, ?, NULL, ?, 'visible', ?, ?, NULL)
        `,
      )
      .bind(id, article.id, author.id, content, now, now),
  );

  return requireCommentPayloadById(db, id);
}

export async function createReplyForComment(
  db: D1Database,
  commentId: string,
  author: CurrentUser,
  rawContent: unknown,
): Promise<CommentPayload> {
  await requireCommentsEnabled(db);
  const parentComment = await queryFirst<CommentRow>(db.prepare(COMMENT_BY_ID_SQL).bind(commentId));

  if (!parentComment || parentComment.status !== "visible") {
    throw new ApiError(404, "NOT_FOUND", "Comment not found.");
  }

  if (parentComment.parent_id) {
    throw new ApiError(400, "VALIDATION_ERROR", "Replies can only target top-level comments.");
  }

  const article = await queryFirst<ArticleRow>(
    db
      .prepare(
        `
          SELECT id
          FROM articles
          WHERE id = ?
            AND status = 'published'
          LIMIT 1
        `,
      )
      .bind(parentComment.article_id),
  );

  if (!article) {
    throw new ApiError(404, "NOT_FOUND", "Article not found.");
  }

  const content = normalizeCommentContent(rawContent);
  await enforceCommentRateLimit(db, author.id, parentComment.article_id);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await runStatement(
    db
      .prepare(
        `
          INSERT INTO comments (
            id,
            article_id,
            author_id,
            parent_id,
            content,
            status,
            created_at,
            updated_at,
            deleted_at
          ) VALUES (?, ?, ?, ?, ?, 'visible', ?, ?, NULL)
        `,
      )
      .bind(id, parentComment.article_id, author.id, parentComment.id, content, now, now),
  );

  return requireCommentPayloadById(db, id);
}

export async function listCmsComments(db: D1Database): Promise<CmsCommentPayload[]> {
  const rows = await queryAll<CmsCommentRow>(db.prepare(CMS_COMMENTS_SQL));
  return rows.map(mapCmsCommentRow);
}

export async function updateCommentStatus(
  db: D1Database,
  commentId: string,
  status: "visible" | "hidden",
): Promise<CmsCommentPayload> {
  const comment = await queryFirst<CommentRow>(db.prepare(COMMENT_BY_ID_SQL).bind(commentId));

  if (!comment) {
    throw new ApiError(404, "NOT_FOUND", "Comment not found.");
  }

  if (comment.status === "deleted") {
    throw new ApiError(400, "VALIDATION_ERROR", "Deleted comments cannot be restored from this action.");
  }

  await runStatement(
    db
      .prepare(
        `
          UPDATE comments
          SET status = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .bind(status, new Date().toISOString(), commentId),
  );

  return requireCmsCommentById(db, commentId);
}

export async function adminDeleteCommentById(db: D1Database, commentId: string): Promise<CmsCommentPayload> {
  const comment = await queryFirst<CommentRow>(db.prepare(COMMENT_BY_ID_SQL).bind(commentId));

  if (!comment) {
    throw new ApiError(404, "NOT_FOUND", "Comment not found.");
  }

  if (comment.status !== "deleted") {
    const now = new Date().toISOString();

    await runStatement(
      db
        .prepare(
          `
            UPDATE comments
            SET
              status = 'deleted',
              content = '',
              updated_at = ?,
              deleted_at = ?
            WHERE id = ?
          `,
        )
        .bind(now, now, commentId),
    );
  }

  return requireCmsCommentById(db, commentId);
}

export async function deleteCommentById(
  db: D1Database,
  commentId: string,
  actor: CurrentUser,
): Promise<void> {
  const comment = await queryFirst<CommentRow>(db.prepare(COMMENT_BY_ID_SQL).bind(commentId));

  if (!comment) {
    throw new ApiError(404, "NOT_FOUND", "Comment not found.");
  }

  if (comment.author_id !== actor.id && !actor.isAdmin) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to delete this comment.");
  }

  if (comment.status === "deleted") {
    return;
  }

  const now = new Date().toISOString();

  await runStatement(
    db
      .prepare(
        `
          UPDATE comments
          SET
            status = 'deleted',
            content = '',
            updated_at = ?,
            deleted_at = ?
          WHERE id = ?
        `,
      )
      .bind(now, now, commentId),
  );
}

export function readCommentContentFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object" || !("content" in payload)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Comment content is required.");
  }

  return normalizeCommentContent((payload as { content?: unknown }).content);
}

async function listVisibleCommentsByArticleId(
  db: D1Database,
  articleId: string,
): Promise<CommentPayload[]> {
  const rows = await queryAll<CommentListRow>(db.prepare(COMMENT_LIST_BY_ARTICLE_SQL).bind(articleId));
  const rootComments: CommentPayload[] = [];
  const commentMap = new Map<string, CommentPayload>();

  for (const row of rows) {
    const comment = mapCommentRow(row);
    commentMap.set(comment.id, comment);

    if (!comment.parentId) {
      rootComments.push(comment);
      continue;
    }

    const parentComment = commentMap.get(comment.parentId);

    if (parentComment) {
      parentComment.replies.push(comment);
    }
  }

  return rootComments;
}

async function getPublishedArticleBySlug(
  db: D1Database,
  slug: string,
): Promise<ArticleRow | null> {
  return queryFirst<ArticleRow>(db.prepare(PUBLISHED_ARTICLE_BY_SLUG_SQL).bind(slug));
}

async function requireCommentPayloadById(
  db: D1Database,
  commentId: string,
): Promise<CommentPayload> {
  const row = await queryFirst<CommentListRow>(db.prepare(COMMENT_PAYLOAD_BY_ID_SQL).bind(commentId));

  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Comment not found.");
  }

  return mapCommentRow(row);
}

function mapCommentRow(row: CommentListRow): CommentPayload {
  return {
    id: row.id,
    articleId: row.article_id,
    parentId: row.parent_id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatar: row.author_avatar,
    authorHtmlUrl: row.author_html_url,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    replies: [],
  };
}

async function requireCmsCommentById(db: D1Database, commentId: string): Promise<CmsCommentPayload> {
  const row = await queryFirst<CmsCommentRow>(
    db
      .prepare(
        `
          SELECT
            c.id,
            c.article_id,
            a.slug AS article_slug,
            a.title AS article_title,
            c.author_id,
            u.github_login AS author_name,
            u.github_avatar_url AS author_avatar,
            c.parent_id,
            c.content,
            c.status,
            c.created_at,
            c.updated_at,
            c.deleted_at,
            (
              SELECT COUNT(*)
              FROM comments AS reply
              WHERE reply.parent_id = c.id
            ) AS replies_count
          FROM comments AS c
          INNER JOIN users AS u
            ON u.id = c.author_id
          INNER JOIN articles AS a
            ON a.id = c.article_id
          WHERE c.id = ?
          LIMIT 1
        `,
      )
      .bind(commentId),
  );

  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Comment not found.");
  }

  return mapCmsCommentRow(row);
}

function mapCmsCommentRow(row: CmsCommentRow): CmsCommentPayload {
  return {
    id: row.id,
    articleId: row.article_id,
    articleSlug: row.article_slug,
    articleTitle: row.article_title,
    parentId: row.parent_id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatar: row.author_avatar,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    repliesCount: normalizeNumber(row.replies_count),
  };
}

async function requireCommentsEnabled(db: D1Database): Promise<void> {
  const settings = await getSiteSettings(db);

  if (!settings.commentsEnabled) {
    throw new ApiError(403, "COMMENTS_DISABLED", "Comments are currently disabled.");
  }
}

async function enforceCommentRateLimit(db: D1Database, authorId: string, articleId: string): Promise<void> {
  const windowStart = new Date(Date.now() - COMMENT_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const row = await queryFirst<CountRow>(
    db
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM comments
          WHERE author_id = ?
            AND article_id = ?
            AND created_at >= ?
            AND status != 'deleted'
        `,
      )
      .bind(authorId, articleId, windowStart),
  );

  if (normalizeNumber(row?.count) >= COMMENT_RATE_LIMIT_MAX_COUNT) {
    throw new ApiError(
      429,
      "RATE_LIMITED",
      `Comment too frequently. Please wait before posting again.`,
    );
  }
}

function normalizeCommentContent(rawContent: unknown): string {
  if (typeof rawContent !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "Comment content must be plain text.");
  }

  const normalized = rawContent.replace(/\r\n?/g, "\n").trim();

  if (!normalized) {
    throw new ApiError(400, "VALIDATION_ERROR", "Comment content cannot be empty.");
  }

  if (normalized.length > COMMENT_CONTENT_MAX_LENGTH) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `Comment content must be ${COMMENT_CONTENT_MAX_LENGTH} characters or fewer.`,
    );
  }

  return normalized;
}

async function runStatement(statement: D1PreparedStatement): Promise<void> {
  try {
    await statement.run();
  } catch (error) {
    console.error("Comment statement failed", error);
    throw new ApiError(500, "DATABASE_ERROR", "Database write failed.");
  }
}

function normalizeNumber(value: number | string | null | undefined): number {
  const numericValue = typeof value === "string" ? Number(value) : value;
  return typeof numericValue === "number" && Number.isFinite(numericValue) ? numericValue : 0;
}
