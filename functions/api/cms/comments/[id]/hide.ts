import { requireAdmin } from "../../../../_shared/auth";
import { updateCommentStatus } from "../../../../_shared/comments";
import { requireDb } from "../../../../_shared/d1";
import type { Env } from "../../../../_shared/env";
import { ApiError, handleRequest, json } from "../../../../_shared/http";

function readId(params: EventContext<Env, string, unknown>["params"]): string {
  const idParam = params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  if (!id) {
    throw new ApiError(400, "VALIDATION_ERROR", "Missing comment id.");
  }

  return id;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    await requireAdmin(request, env, db);
    const comment = await updateCommentStatus(db, readId(params), "hidden");

    return json({ comment });
  });
