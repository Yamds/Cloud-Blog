import { requireAdmin } from "../../../_shared/auth";
import {
  getCmsArticle,
  readCmsArticleInput,
  readJsonBody,
  updateCmsArticle,
} from "../../../_shared/cms-articles";
import { requireDb } from "../../../_shared/d1";
import type { Env } from "../../../_shared/env";
import { ApiError, handleRequest, json } from "../../../_shared/http";

function readId(params: EventContext<Env, string, unknown>["params"]): string {
  const idParam = params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  if (!id) {
    throw new ApiError(400, "VALIDATION_ERROR", "Missing article id.");
  }

  return id;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    await requireAdmin(request, env, db);

    const article = await getCmsArticle(db, readId(params));

    if (!article) {
      throw new ApiError(404, "NOT_FOUND", "Article not found.");
    }

    return json({ article });
  });

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    const user = await requireAdmin(request, env, db);

    const article = await updateCmsArticle(
      db,
      readId(params),
      readCmsArticleInput(await readJsonBody(request)),
      user.id,
      "manual_save",
    );

    return json({ article });
  });
