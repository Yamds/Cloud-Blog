import { getPublishedArticleBySlug } from "../../_shared/articles";
import { requireDb } from "../../_shared/d1";
import type { Env } from "../../_shared/env";
import { ApiError, handleRequest, json } from "../../_shared/http";

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) =>
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
    const article = await getPublishedArticleBySlug(db, slug);

    if (!article) {
      throw new ApiError(404, "NOT_FOUND", "Article not found.");
    }

    return json(article);
  });
