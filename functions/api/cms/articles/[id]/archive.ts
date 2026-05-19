import { requireAdmin } from "../../../../_shared/auth";
import { updateCmsArticle } from "../../../../_shared/cms-articles";
import { requireDb } from "../../../../_shared/d1";
import type { Env } from "../../../../_shared/env";
import { ApiError, handleRequest, json } from "../../../../_shared/http";

function readId(params: EventContext<Env, string, unknown>["params"]): string {
  const idParam = params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  if (!id) {
    throw new ApiError(400, "VALIDATION_ERROR", "Missing article id.");
  }

  return id;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    const user = await requireAdmin(request, env, db);
    const article = await updateCmsArticle(db, readId(params), { status: "archived" }, user.id, "archive");

    return json({ article });
  });
