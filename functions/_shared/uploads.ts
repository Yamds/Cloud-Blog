import { queryAll, queryFirst } from "./d1";
import type { Env } from "./env";
import { ApiError } from "./http";

export interface StorageEnv extends Env {
  BUCKET?: R2Bucket;
}

export interface UploadImageRequest {
  articleId: string | null;
  file: File;
}

export interface UploadedImagePayload {
  id: string;
  objectKey: string;
  url: string;
}

export interface CmsMediaObjectPayload {
  id: string;
  key: string;
  type: "image" | "attachment";
  mime: string;
  sizeBytes: number;
  updatedAt: string;
  status: "ready" | "processing" | "orphaned" | "error";
  previewUrl: string;
  relatedArticle: {
    articleId: string;
    articleTitle: string;
    articleStatus: "draft" | "published" | "archived";
  } | null;
}

export interface StoredMediaObject {
  id: string;
  objectKey: string;
  mimeType: string;
}

export interface MediaUsageReference {
  articleId: string;
  articleTitle: string;
  articleStatus: "draft" | "published" | "archived";
  matchedBy: Array<"url" | "objectKey">;
}

interface ArticleReferenceRow {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
}

interface MediaObjectListRow {
  id: string;
  object_key: string;
  mime_type: string;
  size_bytes: number | string;
  created_at: string;
  article_id: string | null;
  article_title: string | null;
  article_status: "draft" | "published" | "archived" | null;
}

interface StoredMediaObjectRow {
  id: string;
  object_key: string;
  mime_type: string;
}

interface ArticleMediaReferenceRow {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  content_json: string | null;
  content_html: string | null;
}

export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

const IMAGE_MIME_PREFIX = "image/";
const PUBLIC_MEDIA_BASE_PATH = "/api/cms/media";
const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

export function requireBucket(env: StorageEnv): R2Bucket {
  if (!env.BUCKET || typeof env.BUCKET.put !== "function") {
    throw new ApiError(500, "BUCKET_NOT_CONFIGURED", 'R2 binding "BUCKET" is not configured.');
  }

  return env.BUCKET;
}

export async function readUploadImageRequest(request: Request): Promise<UploadImageRequest> {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be multipart form data.");
  }

  const fileValue = formData.get("file");

  if (!(fileValue instanceof File)) {
    throw new ApiError(400, "VALIDATION_ERROR", 'Field "file" is required.');
  }

  validateImageFile(fileValue);

  const articleIdValue = formData.get("articleId");
  const articleId =
    typeof articleIdValue === "string" && articleIdValue.trim()
      ? articleIdValue.trim().slice(0, 128)
      : null;

  return {
    articleId,
    file: fileValue,
  };
}

export async function uploadImageToStorage(options: {
  articleId: string | null;
  bucket: R2Bucket;
  db: D1Database;
  file: File;
  uploadedBy: string;
}): Promise<UploadedImagePayload> {
  const article = options.articleId
    ? await queryFirst<ArticleReferenceRow>(
        options.db
          .prepare("SELECT id, title, status FROM articles WHERE id = ? LIMIT 1")
          .bind(options.articleId),
      )
    : null;

  if (options.articleId && !article) {
    throw new ApiError(404, "NOT_FOUND", "Related article not found.");
  }

  const id = crypto.randomUUID();
  const objectKey = createObjectKey(id, options.file, article);
  const now = new Date().toISOString();

  try {
    await options.bucket.put(objectKey, await options.file.arrayBuffer(), {
      httpMetadata: {
        contentType: options.file.type,
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: {
        originalName: options.file.name.slice(0, 255),
        articleId: article?.id ?? "",
        uploadedBy: options.uploadedBy,
      },
    });
  } catch (error) {
    console.error("R2 upload failed", error);
    throw new ApiError(502, "UPLOAD_FAILED", "Failed to upload image to object storage.");
  }

  await runStatement(
    options.db
      .prepare(
        `
          INSERT INTO media_objects (
            id,
            object_key,
            bucket,
            mime_type,
            size_bytes,
            width,
            height,
            uploaded_by,
            article_id,
            created_at
          ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
        `,
      )
      .bind(
        id,
        objectKey,
        "BUCKET",
        options.file.type,
        options.file.size,
        options.uploadedBy,
        article?.id ?? null,
        now,
      ),
  );

  return {
    id,
    objectKey,
    url: buildMediaUrl(id),
  };
}

export async function listMediaObjects(db: D1Database): Promise<CmsMediaObjectPayload[]> {
  const rows = await queryAll<MediaObjectListRow>(
    db.prepare(
      `
        SELECT
          media.id,
          media.object_key,
          media.mime_type,
          media.size_bytes,
          media.created_at,
          media.article_id,
          article.title AS article_title,
          article.status AS article_status
        FROM media_objects AS media
        LEFT JOIN articles AS article
          ON article.id = media.article_id
        ORDER BY media.created_at DESC
      `,
    ),
  );

  return rows.map((row) => {
    const type = row.mime_type.startsWith(IMAGE_MIME_PREFIX) ? "image" : "attachment";
    const relatedArticle =
      row.article_id && row.article_title && row.article_status
        ? {
            articleId: row.article_id,
            articleTitle: row.article_title,
            articleStatus: row.article_status,
          }
        : null;

    return {
      id: row.id,
      key: row.object_key,
      type,
      mime: row.mime_type,
      sizeBytes: normalizeNumber(row.size_bytes),
      updatedAt: row.created_at,
      status: resolveMediaStatus(type, relatedArticle?.articleStatus ?? null),
      previewUrl: buildMediaUrl(row.id),
      relatedArticle,
    } satisfies CmsMediaObjectPayload;
  });
}

export async function getStoredMediaObject(
  db: D1Database,
  id: string,
): Promise<StoredMediaObject | null> {
  const row = await queryFirst<StoredMediaObjectRow>(
    db
      .prepare(
        `
          SELECT id, object_key, mime_type
          FROM media_objects
          WHERE id = ?
          LIMIT 1
        `,
      )
      .bind(id),
  );

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    objectKey: row.object_key,
    mimeType: row.mime_type,
  };
}

export async function findMediaUsageReferences(
  db: D1Database,
  options: {
    media: StoredMediaObject;
    siteUrl?: string;
  },
): Promise<MediaUsageReference[]> {
  const rows = await queryAll<ArticleMediaReferenceRow>(
    db.prepare(
      `
        SELECT
          id,
          title,
          status,
          content_json,
          content_html
        FROM articles
        WHERE status IN ('draft', 'published', 'archived')
        ORDER BY
          CASE status
            WHEN 'published' THEN 0
            WHEN 'draft' THEN 1
            ELSE 2
          END,
          updated_at DESC
      `,
    ),
  );

  const mediaUrlTerms = buildMediaUrlTerms(options.media.id, options.siteUrl);
  const objectKeyTerms = buildObjectKeyTerms(options.media.objectKey);

  return rows.flatMap((row) => {
    const haystacks = [row.content_json ?? "", row.content_html ?? ""];
    const matchedBy: MediaUsageReference["matchedBy"] = [];

    if (mediaUrlTerms.some((term) => haystacks.some((haystack) => haystack.includes(term)))) {
      matchedBy.push("url");
    }

    if (objectKeyTerms.some((term) => haystacks.some((haystack) => haystack.includes(term)))) {
      matchedBy.push("objectKey");
    }

    if (matchedBy.length === 0) {
      return [];
    }

    return [
      {
        articleId: row.id,
        articleTitle: row.title,
        articleStatus: row.status,
        matchedBy,
      } satisfies MediaUsageReference,
    ];
  });
}

export async function deleteStoredMediaObject(options: {
  bucket: R2Bucket;
  db: D1Database;
  id: string;
}): Promise<StoredMediaObject> {
  const media = await getStoredMediaObject(options.db, options.id);

  if (!media) {
    throw new ApiError(404, "NOT_FOUND", "Media object not found.");
  }

  try {
    await options.bucket.delete(media.objectKey);
  } catch (error) {
    console.error("R2 delete failed", error);
    throw new ApiError(502, "DELETE_FAILED", "Failed to delete object from storage.");
  }

  await runStatement(options.db.prepare("DELETE FROM media_objects WHERE id = ?").bind(media.id));

  return media;
}

export function buildMediaUrl(id: string): string {
  return `${PUBLIC_MEDIA_BASE_PATH}/${encodeURIComponent(id)}`;
}

export function validateImageFile(file: File): void {
  if (!file.type.startsWith(IMAGE_MIME_PREFIX)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Only image/* files are allowed.");
  }

  if (file.size <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "Image file is empty.");
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `Image size must be at most ${Math.floor(MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024))}MB.`,
    );
  }
}

function createObjectKey(
  id: string,
  file: File,
  article: ArticleReferenceRow | null,
): string {
  const extension = resolveImageExtension(file);

  if (!article) {
    return `drafts/inbox/${id}.${extension}`;
  }

  const root = article.status === "published" ? "articles" : "drafts";
  return `${root}/${article.id}/${id}.${extension}`;
}

function resolveImageExtension(file: File): string {
  const mimeExtension = IMAGE_EXTENSION_BY_MIME[file.type];

  if (mimeExtension) {
    return mimeExtension;
  }

  const filenameExtension = file.name.split(".").pop()?.trim().toLowerCase();

  if (filenameExtension && /^[a-z0-9]{1,8}$/.test(filenameExtension)) {
    return filenameExtension;
  }

  return "bin";
}

function resolveMediaStatus(
  type: CmsMediaObjectPayload["type"],
  articleStatus: ArticleReferenceRow["status"] | null,
): CmsMediaObjectPayload["status"] {
  if (!articleStatus) {
    return "orphaned";
  }

  if (type === "image" && articleStatus === "draft") {
    return "processing";
  }

  return "ready";
}

function normalizeNumber(value: number | string): number {
  const nextValue = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function buildMediaUrlTerms(id: string, siteUrl?: string): string[] {
  const relativeUrl = buildMediaUrl(id);
  const terms = new Set<string>([relativeUrl]);
  const normalizedSiteUrl = siteUrl?.trim().replace(/\/+$/, "");

  if (normalizedSiteUrl && /^https?:\/\//i.test(normalizedSiteUrl)) {
    terms.add(`${normalizedSiteUrl}${relativeUrl}`);
  }

  return [...terms];
}

function buildObjectKeyTerms(objectKey: string): string[] {
  const terms = new Set<string>([objectKey]);
  const encodedObjectKey = encodeURI(objectKey);

  if (encodedObjectKey !== objectKey) {
    terms.add(encodedObjectKey);
  }

  return [...terms];
}

async function runStatement(statement: D1PreparedStatement): Promise<void> {
  try {
    await statement.run();
  } catch (error) {
    console.error("D1 statement failed", error);
    throw new ApiError(500, "DATABASE_ERROR", "Database write failed.");
  }
}
