import { requireCurrentUser } from "../../_shared/auth";
import { deleteCommentById } from "../../_shared/comments";
import { requireDb } from "../../_shared/d1";
import type { Env } from "../../_shared/env";
import { ApiError, handleRequest, json } from "../../_shared/http";

function getCommentIdParam(commentIdParam: string | string[] | undefined): string {
  const rawCommentId = Array.isArray(commentIdParam) ? commentIdParam[0] : commentIdParam;

  if (!rawCommentId) {
    throw new ApiError(400, "VALIDATION_ERROR", "Missing comment id.");
  }

  return rawCommentId;
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) =>
  handleRequest(async () => {
    const commentId = getCommentIdParam(params.id);
    const db = requireDb(env);
    const user = await requireCurrentUser(request, env, db);

    await deleteCommentById(db, commentId, user);

    return json({
      success: true,
    });
  });
