import { requireAdmin } from "../../../_shared/auth";
import { listCmsComments } from "../../../_shared/comments";
import { requireDb } from "../../../_shared/d1";
import type { Env } from "../../../_shared/env";
import { handleRequest, json } from "../../../_shared/http";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    await requireAdmin(request, env, db);
    const comments = await listCmsComments(db);

    return json({ comments });
  });
