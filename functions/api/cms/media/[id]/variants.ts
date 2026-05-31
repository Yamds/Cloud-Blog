import { requireAdmin } from "../../../../_shared/auth";
import { requireDb } from "../../../../_shared/d1";
import type { Env } from "../../../../_shared/env";
import { ApiError, handleRequest, json } from "../../../../_shared/http";
import {
  generateStoredMediaWebpVariants,
  getStoredMediaObject,
  requireBucket,
  type StorageEnv,
} from "../../../../_shared/uploads";

function readMediaParam(params: EventContext<Env, string, unknown>["params"]): string {
  const idParam = params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  if (!id) {
    throw new ApiError(400, "VALIDATION_ERROR", "Missing media id.");
  }

  return id;
}

export const onRequestPost: PagesFunction<StorageEnv> = async ({ request, env, params }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    await requireAdmin(request, env, db);

    const media = await getStoredMediaObject(db, readMediaParam(params));
    if (!media) {
      throw new ApiError(404, "NOT_FOUND", "Media object not found.");
    }

    const variants = await generateStoredMediaWebpVariants({
      bucket: requireBucket(env),
      db,
      media,
      siteUrl: env.SITE_URL ?? new URL(request.url).origin,
    });

    return json({
      mediaId: media.id,
      variants,
    });
  });
