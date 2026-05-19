import { requireAdmin } from "../../../_shared/auth";
import { requireDb } from "../../../_shared/d1";
import { handleRequest, json } from "../../../_shared/http";
import { listMediaObjects, type StorageEnv } from "../../../_shared/uploads";

export const onRequestGet: PagesFunction<StorageEnv> = async ({ request, env }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    await requireAdmin(request, env, db);

    const objects = await listMediaObjects(db);
    return json({ objects });
  });
