import { queryAll, queryFirst } from "./d1";
import type { Env } from "./env";
import { ApiError } from "./http";

export interface StorageEnv extends Env {
  BUCKET?: R2Bucket;
}

export type MediaWebpVariantKey = "webp_1080" | "webp_720";

export interface UploadImageRequest {
  articleId: string | null;
  file?: File;
  imageUrl?: string;
}

export interface UploadedImagePayload {
  id: string;
  objectKey: string;
  url: string;
  variants: MediaObjectVariantPayload[];
}

export interface CmsMediaObjectPayload {
  id: string;
  key: string;
  filename: string;
  type: "image" | "attachment";
  mime: string;
  sizeBytes: number;
  updatedAt: string;
  status: "ready" | "processing" | "orphaned" | "error";
  previewUrl: string;
  variants: MediaObjectVariantPayload[];
  relatedArticle: {
    articleId: string;
    articleTitle: string;
    articleStatus: "draft" | "published" | "archived";
  } | null;
}

export interface MediaObjectVariantPayload {
  variant: MediaWebpVariantKey;
  width: number;
  height: number | null;
  sizeBytes: number;
  status: "ready" | "missing" | "error";
  url: string;
  updatedAt: string | null;
  errorMessage?: string;
}

export interface StoredMediaObject {
  id: string;
  objectKey: string;
  mimeType: string;
}

export interface StoredMediaVariant {
  id: string;
  mediaObjectId: string;
  variant: MediaWebpVariantKey;
  objectKey: string;
  mimeType: string;
  width: number;
  height: number | null;
  sizeBytes: number;
  status: "ready" | "error";
  errorMessage: string | null;
  updatedAt: string;
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

interface MediaVariantListRow {
  media_object_id: string;
  variant: MediaWebpVariantKey;
  object_key: string;
  mime_type: string;
  width: number | string;
  height: number | string | null;
  size_bytes: number | string;
  status: "ready" | "error";
  error_message: string | null;
  updated_at: string;
}

interface StoredMediaObjectRow {
  id: string;
  object_key: string;
  mime_type: string;
}

interface StoredMediaVariantRow {
  id: string;
  media_object_id: string;
  variant: MediaWebpVariantKey;
  object_key: string;
  mime_type: string;
  width: number | string;
  height: number | string | null;
  size_bytes: number | string;
  status: "ready" | "error";
  error_message: string | null;
  updated_at: string;
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
const REMOTE_IMAGE_FETCH_TIMEOUT_MS = 15_000;
const WEBP_VARIANT_QUALITY = 82;
const WEBP_VARIANTS: Array<{ key: MediaWebpVariantKey; width: number }> = [
  { key: "webp_1080", width: 1080 },
  { key: "webp_720", width: 720 },
];
const WEBP_SOURCE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
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

export function requireImages(env: StorageEnv): ImagesBinding {
  if (!env.IMAGES || typeof env.IMAGES.input !== "function") {
    throw new ApiError(500, "IMAGES_NOT_CONFIGURED", 'Cloudflare Images binding "IMAGES" is not configured.');
  }

  return env.IMAGES;
}

export async function readUploadImageRequest(request: Request): Promise<UploadImageRequest> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      throw new ApiError(400, "VALIDATION_ERROR", "Request body must be multipart form data.");
    }

    const fileValue = formData.get("file");
    const imageUrlValue = formData.get("imageUrl");
    const articleIdValue = formData.get("articleId");
    const articleId =
      typeof articleIdValue === "string" && articleIdValue.trim()
        ? articleIdValue.trim().slice(0, 128)
        : null;

    if (fileValue instanceof File) {
      validateImageFile(fileValue);
      return {
        articleId,
        file: fileValue,
      };
    }

    if (typeof imageUrlValue === "string" && imageUrlValue.trim()) {
      return {
        articleId,
        imageUrl: validateRemoteImageUrl(imageUrlValue),
      };
    }

    throw new ApiError(400, "VALIDATION_ERROR", 'Field "file" or "imageUrl" is required.');
  }

  if (contentType.includes("application/json")) {
    const payload = await readJsonBody(request);

    if (!isRecord(payload)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Request body must be a JSON object.");
    }

    const articleId = readOptionalArticleId(payload.articleId);
    const imageUrl = validateRemoteImageUrl(payload.imageUrl);

    return {
      articleId,
      imageUrl,
    };
  }

  throw new ApiError(
    400,
    "VALIDATION_ERROR",
    "Request body must be multipart form data or application/json.",
  );
}

export async function uploadImageToStorage(options: {
  articleId: string | null;
  bucket: R2Bucket;
  db: D1Database;
  file: File;
  images?: ImagesBinding;
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
  const objectKey = await createUniqueObjectKey(options.db, options.bucket, options.file, article);
  const now = new Date().toISOString();

  let originalImageInfo: ImageInfoResponse | null = null;
  const fileBytes = await options.file.arrayBuffer();

  if (options.images && options.file.type.startsWith(IMAGE_MIME_PREFIX)) {
    originalImageInfo = await readImageInfo(options.images, fileBytes);
  }

  try {
    await options.bucket.put(objectKey, fileBytes, {
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
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        id,
        objectKey,
        "BUCKET",
        options.file.type,
        options.file.size,
        getImageInfoWidth(originalImageInfo),
        getImageInfoHeight(originalImageInfo),
        options.uploadedBy,
        article?.id ?? null,
        now,
      ),
  );

  if (options.images && canGenerateWebpVariants(options.file.type)) {
    await generateMediaWebpVariants({
      bucket: options.bucket,
      db: options.db,
      images: options.images,
      media: {
        id,
        objectKey,
        mimeType: options.file.type,
      },
      sourceBytes: fileBytes,
    });
  }

  return {
    id,
    objectKey,
    url: buildMediaUrl(id, objectKey),
    variants: await listMediaVariantPayloads(options.db, id),
  };
}

export async function createImageFileFromUrl(imageUrl: string): Promise<File> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REMOTE_IMAGE_FETCH_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(imageUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (error) {
    const isAbortError = error instanceof Error && error.name === "AbortError";
    throw new ApiError(
      502,
      "REMOTE_IMAGE_FETCH_FAILED",
      isAbortError ? "Fetching remote image timed out." : "Failed to fetch remote image.",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new ApiError(502, "REMOTE_IMAGE_FETCH_FAILED", `Remote image request failed with ${response.status}.`);
  }

  const contentType = normalizeMimeType(response.headers.get("content-type"));
  if (!contentType.startsWith(IMAGE_MIME_PREFIX)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Remote resource must return image/* MIME type.");
  }

  const contentLength = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_UPLOAD_BYTES) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `Image size must be at most ${Math.floor(MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024))}MB.`,
    );
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "Remote image is empty.");
  }
  if (bytes.byteLength > MAX_IMAGE_UPLOAD_BYTES) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `Image size must be at most ${Math.floor(MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024))}MB.`,
    );
  }

  const filename = inferRemoteImageFilename(imageUrl, contentType);
  const file = new File([bytes], filename, {
    type: contentType,
  });
  validateImageFile(file);
  return file;
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
  const variantRows = await queryAll<MediaVariantListRow>(
    db.prepare(
      `
        SELECT
          media_object_id,
          variant,
          object_key,
          mime_type,
          width,
          height,
          size_bytes,
          status,
          error_message,
          updated_at
        FROM media_object_variants
        ORDER BY variant ASC
      `,
    ),
  ).catch(() => []);
  const variantsByMediaId = groupVariantRowsByMediaId(variantRows);

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
      filename: getObjectKeyFilename(row.object_key),
      type,
      mime: row.mime_type,
      sizeBytes: normalizeNumber(row.size_bytes),
      updatedAt: row.created_at,
      status: resolveMediaStatus(type, relatedArticle?.articleStatus ?? null),
      previewUrl: buildMediaUrl(row.id, row.object_key),
      variants: buildVariantPayloads(row.id, variantsByMediaId.get(row.id) ?? []),
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

export async function getStoredMediaObjectByPublicName(
  db: D1Database,
  publicName: string,
): Promise<StoredMediaObject | null> {
  const normalizedName = normalizePublicMediaName(publicName);
  const row = await queryFirst<StoredMediaObjectRow>(
    db
      .prepare(
        `
          SELECT id, object_key, mime_type
          FROM media_objects
          WHERE object_key = ?
             OR object_key LIKE ?
          ORDER BY
            CASE WHEN object_key = ? THEN 0 ELSE 1 END,
            created_at DESC
          LIMIT 1
        `,
      )
      .bind(normalizedName, `%/${escapeLikePattern(normalizedName)}`, normalizedName),
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

export async function getStoredMediaVariant(
  db: D1Database,
  mediaObjectId: string,
  variant: MediaWebpVariantKey,
): Promise<StoredMediaVariant | null> {
  const row = await queryFirst<StoredMediaVariantRow>(
    db
      .prepare(
        `
          SELECT
            id,
            media_object_id,
            variant,
            object_key,
            mime_type,
            width,
            height,
            size_bytes,
            status,
            error_message,
            updated_at
          FROM media_object_variants
          WHERE media_object_id = ?
            AND variant = ?
          LIMIT 1
        `,
      )
      .bind(mediaObjectId, variant),
  ).catch(() => null);

  if (!row) {
    return null;
  }

  return mapStoredMediaVariant(row);
}

export function readMediaVariantParam(request: Request): MediaWebpVariantKey | null {
  const url = new URL(request.url);
  const rawVariant = url.searchParams.get("variant") ?? url.searchParams.get("size");

  if (!rawVariant) {
    return null;
  }

  const normalized = rawVariant.trim().toLowerCase();
  if (normalized === "webp_1080" || normalized === "1080") {
    return "webp_1080";
  }
  if (normalized === "webp_720" || normalized === "720") {
    return "webp_720";
  }

  throw new ApiError(400, "VALIDATION_ERROR", "Unsupported media variant.");
}

export async function generateStoredMediaWebpVariants(options: {
  bucket: R2Bucket;
  db: D1Database;
  images: ImagesBinding;
  media: StoredMediaObject;
}): Promise<MediaObjectVariantPayload[]> {
  if (!canGenerateWebpVariants(options.media.mimeType)) {
    throw new ApiError(400, "UNSUPPORTED_MEDIA_TYPE", "Only JPEG and PNG images can be converted to WebP.");
  }

  const source = await options.bucket.get(options.media.objectKey);
  if (!source) {
    throw new ApiError(404, "NOT_FOUND", "Stored object not found.");
  }

  await generateMediaWebpVariants({
    bucket: options.bucket,
    db: options.db,
    images: options.images,
    media: options.media,
    sourceBytes: await source.arrayBuffer(),
  });

  return listMediaVariantPayloads(options.db, options.media.id);
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

  const mediaUrlTerms = buildMediaUrlTerms(options.media, options.siteUrl);
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

  const variants = await listStoredMediaVariants(options.db, media.id);

  try {
    await options.bucket.delete(media.objectKey);
    await Promise.all(variants.map((variant) => options.bucket.delete(variant.objectKey)));
  } catch (error) {
    console.error("R2 delete failed", error);
    throw new ApiError(502, "DELETE_FAILED", "Failed to delete object from storage.");
  }

  await options.db
    .prepare("DELETE FROM media_object_variants WHERE media_object_id = ?")
    .bind(media.id)
    .run()
    .catch(() => undefined);
  await runStatement(options.db.prepare("DELETE FROM media_objects WHERE id = ?").bind(media.id));

  return media;
}

export function buildNamedMediaUrl(id: string, filename: string): string {
  void id;
  return `${PUBLIC_MEDIA_BASE_PATH}/${encodeURIComponent(filename)}`;
}

export function buildMediaUrl(id: string, objectKey?: string): string {
  const filename = objectKey ? getObjectKeyFilename(objectKey) : "";
  return filename && !objectKey?.includes("/")
    ? buildNamedMediaUrl(id, filename)
    : `${PUBLIC_MEDIA_BASE_PATH}/${encodeURIComponent(id)}`;
}

export function buildMediaVariantUrl(id: string, variant: MediaWebpVariantKey, objectKey?: string): string {
  return `${buildMediaUrl(id, objectKey)}?variant=${variant}`;
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

async function createUniqueObjectKey(
  db: D1Database,
  bucket: R2Bucket,
  file: File,
  _article: ArticleReferenceRow | null,
): Promise<string> {
  const filename = sanitizeFilename(file.name, resolveImageExtension(file));
  const { name, extension } = splitFilename(filename);

  for (let index = 0; index < 1000; index += 1) {
    const candidateFilename = index === 0 ? filename : `${name}-${index}${extension}`;

    if (await isObjectKeyAvailable(db, bucket, candidateFilename)) {
      return candidateFilename;
    }
  }

  throw new ApiError(409, "MEDIA_NAME_CONFLICT", "Unable to allocate a unique media filename.");
}

async function isObjectKeyAvailable(db: D1Database, bucket: R2Bucket, objectKey: string): Promise<boolean> {
  const existingRow = await queryFirst<{ id: string }>(
    db.prepare("SELECT id FROM media_objects WHERE object_key = ? LIMIT 1").bind(objectKey),
  );

  if (existingRow) {
    return false;
  }

  const existingObject = await bucket.head(objectKey);
  return existingObject === null;
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

function canGenerateWebpVariants(mimeType: string): boolean {
  return WEBP_SOURCE_MIME_TYPES.has(normalizeMimeType(mimeType));
}

async function readImageInfo(images: ImagesBinding, bytes: ArrayBuffer): Promise<ImageInfoResponse | null> {
  try {
    return await images.info(arrayBufferToStream(bytes));
  } catch (error) {
    console.warn("Image metadata read failed", error);
    return null;
  }
}

async function generateMediaWebpVariants(options: {
  bucket: R2Bucket;
  db: D1Database;
  images: ImagesBinding;
  media: StoredMediaObject;
  sourceBytes: ArrayBuffer;
}): Promise<void> {
  for (const variant of WEBP_VARIANTS) {
    const objectKey = buildVariantObjectKey(options.media.id, variant.key);

    try {
      const result = await options.images
        .input(arrayBufferToStream(options.sourceBytes))
        .transform({
          width: variant.width,
          fit: "scale-down",
        })
        .output({
          format: "image/webp",
          quality: WEBP_VARIANT_QUALITY,
        });
      const response = result.response();
      const bytes = await response.arrayBuffer();
      const info = await readImageInfo(options.images, bytes);

      await options.bucket.put(objectKey, bytes, {
        httpMetadata: {
          contentType: "image/webp",
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: {
          mediaObjectId: options.media.id,
          sourceObjectKey: options.media.objectKey,
          variant: variant.key,
        },
      });

      await upsertMediaVariant({
        db: options.db,
        mediaObjectId: options.media.id,
        variant: variant.key,
        objectKey,
        width: getImageInfoWidth(info) ?? variant.width,
        height: getImageInfoHeight(info),
        sizeBytes: bytes.byteLength,
      });
    } catch (error) {
      console.error("WebP variant generation failed", { mediaId: options.media.id, variant: variant.key, error });
      await upsertMediaVariantError({
        db: options.db,
        mediaObjectId: options.media.id,
        variant: variant.key,
        objectKey,
        width: variant.width,
        errorMessage: error instanceof Error ? error.message : "Failed to generate WebP variant.",
      });
    }
  }
}

async function upsertMediaVariant(options: {
  db: D1Database;
  mediaObjectId: string;
  variant: MediaWebpVariantKey;
  objectKey: string;
  width: number;
  height: number | null;
  sizeBytes: number;
}): Promise<void> {
  const now = new Date().toISOString();
  await runStatement(
    options.db
      .prepare(
        `
          INSERT INTO media_object_variants (
            id,
            media_object_id,
            variant,
            object_key,
            mime_type,
            width,
            height,
            size_bytes,
            status,
            error_message,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, 'image/webp', ?, ?, ?, 'ready', NULL, ?, ?)
          ON CONFLICT(media_object_id, variant) DO UPDATE SET
            object_key = excluded.object_key,
            mime_type = excluded.mime_type,
            width = excluded.width,
            height = excluded.height,
            size_bytes = excluded.size_bytes,
            status = 'ready',
            error_message = NULL,
            updated_at = excluded.updated_at
        `,
      )
      .bind(
        crypto.randomUUID(),
        options.mediaObjectId,
        options.variant,
        options.objectKey,
        options.width,
        options.height,
        options.sizeBytes,
        now,
        now,
      ),
  );
}

async function upsertMediaVariantError(options: {
  db: D1Database;
  mediaObjectId: string;
  variant: MediaWebpVariantKey;
  objectKey: string;
  width: number;
  errorMessage: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await runStatement(
    options.db
      .prepare(
        `
          INSERT INTO media_object_variants (
            id,
            media_object_id,
            variant,
            object_key,
            mime_type,
            width,
            height,
            size_bytes,
            status,
            error_message,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, 'image/webp', ?, NULL, 0, 'error', ?, ?, ?)
          ON CONFLICT(media_object_id, variant) DO UPDATE SET
            object_key = excluded.object_key,
            width = excluded.width,
            status = 'error',
            error_message = excluded.error_message,
            updated_at = excluded.updated_at
        `,
      )
      .bind(
        crypto.randomUUID(),
        options.mediaObjectId,
        options.variant,
        options.objectKey,
        options.width,
        options.errorMessage.slice(0, 500),
        now,
        now,
      ),
  );
}

async function listStoredMediaVariants(db: D1Database, mediaObjectId: string): Promise<StoredMediaVariant[]> {
  const rows = await queryAll<StoredMediaVariantRow>(
    db
      .prepare(
        `
          SELECT
            id,
            media_object_id,
            variant,
            object_key,
            mime_type,
            width,
            height,
            size_bytes,
            status,
            error_message,
            updated_at
          FROM media_object_variants
          WHERE media_object_id = ?
        `,
      )
      .bind(mediaObjectId),
  ).catch(() => []);

  return rows.map(mapStoredMediaVariant);
}

async function listMediaVariantPayloads(db: D1Database, mediaObjectId: string): Promise<MediaObjectVariantPayload[]> {
  return buildVariantPayloads(mediaObjectId, await listStoredMediaVariants(db, mediaObjectId));
}

function buildVariantPayloads(
  mediaObjectId: string,
  variants: Array<StoredMediaVariant | MediaVariantListRow>,
): MediaObjectVariantPayload[] {
  const rows = new Map<MediaWebpVariantKey, StoredMediaVariant | MediaVariantListRow>();
  variants.forEach((variant) => rows.set(variant.variant, variant));

  return WEBP_VARIANTS.map(({ key, width }) => {
    const variant = rows.get(key);

    if (!variant) {
      return {
        variant: key,
        width,
        height: null,
        sizeBytes: 0,
        status: "missing",
        url: buildMediaVariantUrl(mediaObjectId, key),
        updatedAt: null,
      } satisfies MediaObjectVariantPayload;
    }

    return {
      variant: key,
      width: normalizeNumber(variant.width),
      height: normalizeNullableNumber(variant.height),
      sizeBytes: getVariantSizeBytes(variant),
      status: variant.status,
      url: buildMediaVariantUrl(mediaObjectId, key),
      updatedAt: getVariantUpdatedAt(variant),
      errorMessage: getVariantErrorMessage(variant) ?? undefined,
    } satisfies MediaObjectVariantPayload;
  });
}

function groupVariantRowsByMediaId(rows: MediaVariantListRow[]): Map<string, MediaVariantListRow[]> {
  const grouped = new Map<string, MediaVariantListRow[]>();

  rows.forEach((row) => {
    const existing = grouped.get(row.media_object_id) ?? [];
    existing.push(row);
    grouped.set(row.media_object_id, existing);
  });

  return grouped;
}

function mapStoredMediaVariant(row: StoredMediaVariantRow): StoredMediaVariant {
  return {
    id: row.id,
    mediaObjectId: row.media_object_id,
    variant: row.variant,
    objectKey: row.object_key,
    mimeType: row.mime_type,
    width: normalizeNumber(row.width),
    height: normalizeNullableNumber(row.height),
    sizeBytes: normalizeNumber(row.size_bytes),
    status: row.status,
    errorMessage: row.error_message,
    updatedAt: row.updated_at,
  };
}

function getVariantSizeBytes(variant: StoredMediaVariant | MediaVariantListRow): number {
  return "size_bytes" in variant ? normalizeNumber(variant.size_bytes) : variant.sizeBytes;
}

function getVariantUpdatedAt(variant: StoredMediaVariant | MediaVariantListRow): string {
  return "updated_at" in variant ? variant.updated_at : variant.updatedAt;
}

function getVariantErrorMessage(variant: StoredMediaVariant | MediaVariantListRow): string | null {
  return "error_message" in variant ? variant.error_message : variant.errorMessage;
}

function buildVariantObjectKey(mediaObjectId: string, variant: MediaWebpVariantKey): string {
  const width = variant === "webp_1080" ? 1080 : 720;
  return `variants/${mediaObjectId}/${width}.webp`;
}

function arrayBufferToStream(bytes: ArrayBuffer): ReadableStream<Uint8Array> {
  return new Response(bytes).body as ReadableStream<Uint8Array>;
}

function getImageInfoWidth(info: ImageInfoResponse | null): number | null {
  return info && "width" in info ? info.width : null;
}

function getImageInfoHeight(info: ImageInfoResponse | null): number | null {
  return info && "height" in info ? info.height : null;
}

function sanitizeFilename(filename: string, fallbackExtension: string): string {
  const rawName = filename.trim() || `image.${fallbackExtension}`;
  const decodedName = rawName.replace(/[/\\]+/g, "-");
  const withoutControl = decodedName.replace(/[\u0000-\u001f\u007f<>:"|?*]+/g, "-");
  const collapsed = withoutControl.replace(/\s+/g, " ").replace(/-+/g, "-").trim();
  const candidate = collapsed || `image.${fallbackExtension}`;
  const extension = candidate.includes(".") ? candidate.split(".").pop()?.trim() : "";

  if (extension && /^[a-z0-9]{1,12}$/i.test(extension)) {
    return candidate.slice(0, 180);
  }

  return `${candidate.slice(0, 160)}.${fallbackExtension}`;
}

function splitFilename(filename: string): { name: string; extension: string } {
  const dotIndex = filename.lastIndexOf(".");

  if (dotIndex <= 0) {
    return {
      name: filename,
      extension: "",
    };
  }

  return {
    name: filename.slice(0, dotIndex),
    extension: filename.slice(dotIndex),
  };
}

function getObjectKeyFilename(objectKey: string): string {
  return objectKey.split("/").filter(Boolean).pop() ?? "";
}

function normalizePublicMediaName(value: string): string {
  const decoded = decodeURIComponent(value).trim();

  if (!decoded || decoded.includes("/") || decoded.includes("\\")) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid media filename.");
  }

  return decoded;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function validateRemoteImageUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", '"imageUrl" must be a string.');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new ApiError(400, "VALIDATION_ERROR", '"imageUrl" is required.');
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", '"imageUrl" must be a valid URL.');
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ApiError(400, "VALIDATION_ERROR", '"imageUrl" must use http or https.');
  }

  return parsed.toString();
}

function inferRemoteImageFilename(imageUrl: string, mimeType: string): string {
  try {
    const url = new URL(imageUrl);
    const segment = url.pathname.split("/").filter(Boolean).pop() ?? "";
    const decoded = decodeURIComponent(segment).trim();

    if (decoded && /^[^<>:"/\\|?*\u0000-\u001f]+$/.test(decoded)) {
      return decoded.slice(0, 255);
    }
  } catch {
    // Fall through to default filename.
  }

  const extension = IMAGE_EXTENSION_BY_MIME[mimeType] ?? "bin";
  return `remote-image.${extension}`;
}

function normalizeMimeType(value: string | null): string {
  return (value ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}

function readOptionalArticleId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 128) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function normalizeNullableNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const nextValue = normalizeNumber(value);
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : null;
}

function buildMediaUrlTerms(media: StoredMediaObject, siteUrl?: string): string[] {
  const legacyUrl = buildMediaUrl(media.id);
  const namedUrl = buildMediaUrl(media.id, media.objectKey);
  const terms = new Set<string>([legacyUrl, `${legacyUrl}/`, namedUrl]);
  const normalizedSiteUrl = siteUrl?.trim().replace(/\/+$/, "");

  if (normalizedSiteUrl && /^https?:\/\//i.test(normalizedSiteUrl)) {
    terms.add(`${normalizedSiteUrl}${legacyUrl}`);
    terms.add(`${normalizedSiteUrl}${legacyUrl}/`);
    terms.add(`${normalizedSiteUrl}${namedUrl}`);
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
