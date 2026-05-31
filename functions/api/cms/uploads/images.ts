import { requireAdmin } from "../../../_shared/auth";
import { requireDb } from "../../../_shared/d1";
import { handleRequest, json } from "../../../_shared/http";
import {
  createImageFileFromUrl,
  readUploadImageRequest,
  requireBucket,
  type StorageEnv,
  uploadImageToStorage,
} from "../../../_shared/uploads";

export const onRequestPost: PagesFunction<StorageEnv> = async ({ request, env }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    const user = await requireAdmin(request, env, db);
    const uploadRequest = await readUploadImageRequest(request);
    const bucket = requireBucket(env);
    const file = uploadRequest.file ?? (uploadRequest.imageUrl ? await createImageFileFromUrl(uploadRequest.imageUrl) : null);

    if (!file) {
      throw new Error("Upload request resolved without file or imageUrl.");
    }

    const uploaded = await uploadImageToStorage({
      articleId: uploadRequest.articleId,
      bucket,
      db,
      file,
      siteUrl: env.SITE_URL ?? new URL(request.url).origin,
      uploadedBy: user.id,
    });

    return json(uploaded, {
      status: 201,
    });
  });
