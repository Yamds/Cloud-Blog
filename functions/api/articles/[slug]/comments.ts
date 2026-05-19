import { requireCurrentUser } from "../../../_shared/auth";
import {
  createCommentForArticleSlug,
  listVisibleCommentsByArticleSlug,
  readCommentContentFromPayload,
} from "../../../_shared/comments";
import { requireDb } from "../../../_shared/d1";
import type { Env } from "../../../_shared/env";
import { ApiError, handleRequest, json } from "../../../_shared/http";

function getSlugParam(slugParam: string | string[] | undefined): string {
  const rawSlug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

  if (!rawSlug) {
    throw new ApiError(400, "VALIDATION_ERROR", "Missing article slug.");
  }

  try {
    return decodeURIComponent(rawSlug);
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid article slug.");
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) =>
  handleRequest(async () => {
    const slug = getSlugParam(params.slug);
    const db = requireDb(env);
    const comments = await listVisibleCommentsByArticleSlug(db, slug);
    return json({ comments });
  });

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) =>
  handleRequest(async () => {
    const slug = getSlugParam(params.slug);
    const db = requireDb(env);
    const user = await requireCurrentUser(request, env, db);
    const payload = await readJsonBody(request);
    const content = readCommentContentFromPayload(payload);
    const comment = await createCommentForArticleSlug(db, slug, user, content);

    return json(
      { comment },
      {
        status: 201,
      },
    );
  });
