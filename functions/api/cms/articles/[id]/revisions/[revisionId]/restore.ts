import { requireAdmin } from "../../../../../../_shared/auth";
import { restoreArticleRevision } from "../../../../../../_shared/cms-articles";
import { requireDb } from "../../../../../../_shared/d1";
import type { Env } from "../../../../../../_shared/env";
import { ApiError, handleRequest, json } from "../../../../../../_shared/http";

function readParam(params: EventContext<Env, string, unknown>["params"], key: string): string {
  const rawValue = params[key];
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

  if (!value) {
    throw new ApiError(400, "VALIDATION_ERROR", `Missing ${key}.`);
  }

  return value;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    const user = await requireAdmin(request, env, db);
    const article = await restoreArticleRevision(
      db,
      readParam(params, "id"),
      readParam(params, "revisionId"),
      user.id,
    );

    return json({ article });
  });
