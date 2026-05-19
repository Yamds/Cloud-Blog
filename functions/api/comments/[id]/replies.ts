import { requireCurrentUser } from "../../../_shared/auth";
import {
  createReplyForComment,
  readCommentContentFromPayload,
} from "../../../_shared/comments";
import { requireDb } from "../../../_shared/d1";
import type { Env } from "../../../_shared/env";
import { ApiError, handleRequest, json } from "../../../_shared/http";

function getCommentIdParam(commentIdParam: string | string[] | undefined): string {
  const rawCommentId = Array.isArray(commentIdParam) ? commentIdParam[0] : commentIdParam;

  if (!rawCommentId) {
    throw new ApiError(400, "VALIDATION_ERROR", "Missing comment id.");
  }

  return rawCommentId;
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) =>
  handleRequest(async () => {
    const commentId = getCommentIdParam(params.id);
    const db = requireDb(env);
    const user = await requireCurrentUser(request, env, db);
    const payload = await readJsonBody(request);
    const content = readCommentContentFromPayload(payload);
    const comment = await createReplyForComment(db, commentId, user, content);

    return json(
      { comment },
      {
        status: 201,
      },
    );
  });
