import { getPublishedArticles } from "./_shared/articles";
import { requireDb } from "./_shared/d1";
import type { Env } from "./_shared/env";
import { buildSitemap, getSiteOrigin } from "./_shared/seo";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const db = requireDb(env);
    const articles = await getPublishedArticles(db);
    const origin = getSiteOrigin(request, env);

    return new Response(buildSitemap(articles, origin), {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Unable to generate sitemap", error);
    return new Response("Unable to generate sitemap.", { status: 500 });
  }
};
