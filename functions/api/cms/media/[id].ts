import { requireAdmin } from "../../../_shared/auth";
import { requireDb } from "../../../_shared/d1";
import type { Env } from "../../../_shared/env";
import { ApiError, handleRequest, json } from "../../../_shared/http";
import {
  deleteStoredMediaObject,
  findMediaUsageReferences,
  getStoredMediaObjectByPublicName,
  getStoredMediaObject,
  requireBucket,
  buildMediaUrl,
  type StorageEnv,
} from "../../../_shared/uploads";

function readMediaParam(params: EventContext<Env, string, unknown>["params"]): string {
  const idParam = params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  if (!id) {
    throw new ApiError(400, "VALIDATION_ERROR", "Missing media id.");
  }

  return id;
}

export const onRequestGet: PagesFunction<StorageEnv> = async ({ env, params }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    const rawParam = readMediaParam(params);
    const media =
      (await getStoredMediaObjectByPublicName(db, rawParam).catch(() => null)) ??
      (await getStoredMediaObject(db, rawParam));

    if (!media) {
      throw new ApiError(404, "NOT_FOUND", "Media object not found.");
    }

    const object = await requireBucket(env).get(media.objectKey);

    if (!object) {
      throw new ApiError(404, "NOT_FOUND", "Stored object not found.");
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);

    if (!headers.has("content-type")) {
      headers.set("content-type", media.mimeType);
    }

    if (!headers.has("cache-control")) {
      headers.set("cache-control", "public, max-age=31536000, immutable");
    }

    return new Response(object.body, {
      headers,
    });
  });

export const onRequestDelete: PagesFunction<StorageEnv> = async ({ request, env, params }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    await requireAdmin(request, env, db);
    const id = readMediaParam(params);
    const force = readForceFlag(request);
    const media = await getStoredMediaObject(db, id);

    if (!media) {
      throw new ApiError(404, "NOT_FOUND", "Media object not found.");
    }

    const references = await findMediaUsageReferences(db, {
      media,
      siteUrl: env.SITE_URL,
    });

    if (references.length > 0 && !force) {
      return json(
        {
          error: {
            code: "MEDIA_IN_USE",
            message: "该媒体仍被文章正文引用，默认阻止删除。",
          },
          details: {
            media: {
              id: media.id,
              objectKey: media.objectKey,
              url: buildMediaUrl(media.id, media.objectKey),
            },
            references,
          },
        },
        {
          status: 409,
        },
      );
    }

    const deletedMedia = await deleteStoredMediaObject({
      bucket: requireBucket(env),
      db,
      id,
    });

    return json({
      deleted: true,
      forced: force && references.length > 0,
      references,
      media: deletedMedia,
    });
  });

function readForceFlag(request: Request): boolean {
  const url = new URL(request.url);
  const forceValue = url.searchParams.get("force");

  if (!forceValue) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(forceValue.trim().toLowerCase());
}
