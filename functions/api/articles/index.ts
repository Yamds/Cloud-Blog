import { getPublishedArticles } from "../../_shared/articles";
import { requireDb } from "../../_shared/d1";
import type { Env } from "../../_shared/env";
import { handleRequest, json } from "../../_shared/http";

export const onRequestGet: PagesFunction<Env> = async ({ env }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    const articles = await getPublishedArticles(db);
    return json(articles);
  });
