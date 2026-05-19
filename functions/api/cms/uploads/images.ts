import { requireAdmin } from "../../../_shared/auth";
import { requireDb } from "../../../_shared/d1";
import { handleRequest, json } from "../../../_shared/http";
import {
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
    const uploaded = await uploadImageToStorage({
      articleId: uploadRequest.articleId,
      bucket,
      db,
      file: uploadRequest.file,
      uploadedBy: user.id,
    });

    return json(uploaded, {
      status: 201,
    });
  });
