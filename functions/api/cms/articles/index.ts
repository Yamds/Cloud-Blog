import { requireAdmin } from "../../../_shared/auth";
import {
  createCmsArticle,
  getCmsStats,
  listCmsArticles,
  readCmsArticleInput,
  readJsonBody,
} from "../../../_shared/cms-articles";
import { requireDb } from "../../../_shared/d1";
import type { Env } from "../../../_shared/env";
import { handleRequest, json } from "../../../_shared/http";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    await requireAdmin(request, env, db);

    const [articles, stats] = await Promise.all([listCmsArticles(db), getCmsStats(db)]);
    return json({ articles, stats });
  });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) =>
  handleRequest(async () => {
    const db = requireDb(env);
    const user = await requireAdmin(request, env, db);
    const input = readCmsArticleInput(await readJsonBody(request));
    const article = await createCmsArticle(db, user.id, input);

    return json(
      { article },
      {
        status: 201,
      },
    );
  });
