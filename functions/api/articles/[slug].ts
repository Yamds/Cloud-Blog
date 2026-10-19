import { requireAdmin } from "../../_shared/auth";
import { getArticleBySlugIncludingDrafts, getPublishedArticleBySlug } from "../../_shared/articles";
import { requireDb } from "../../_shared/d1";
import type { Env } from "../../_shared/env";
import { ApiError, handleRequest, json } from "../../_shared/http";

function readPreviewFlag(request: Request): boolean {
  return new URL(request.url).searchParams.get("preview") === "1";
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) =>
  handleRequest(async () => {
    const slugParam = params.slug;
    const rawSlug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

    if (!rawSlug) {
      throw new ApiError(400, "VALIDATION_ERROR", "Missing article slug.");
    }

    let slug: string;

    try {
      slug = decodeURIComponent(rawSlug);
    } catch {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid article slug.");
    }

    const db = requireDb(env);
    const isPreview = readPreviewFlag(request);

    if (isPreview) {
      try {
        await requireAdmin(request, env, db);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          throw new ApiError(404, "NOT_FOUND", "Article not found.");
        }

        throw error;
      }

      const draftArticle = await getArticleBySlugIncludingDrafts(db, slug);

      if (!draftArticle) {
        throw new ApiError(404, "NOT_FOUND", "Article not found.");
      }

      return json(draftArticle);
    }

    const article = await getPublishedArticleBySlug(db, slug);

    if (!article) {
      throw new ApiError(404, "NOT_FOUND", "Article not found.");
    }

    return json(article);
  });
