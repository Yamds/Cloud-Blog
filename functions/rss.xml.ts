import { getPublishedArticles } from "./_shared/articles";
import { requireDb } from "./_shared/d1";
import type { Env } from "./_shared/env";
import {
  buildRss,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_NAME,
  getSiteOrigin,
} from "./_shared/seo";
import { getSiteSettings } from "./_shared/settings";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const db = requireDb(env);
    const [articles, settings] = await Promise.all([getPublishedArticles(db), getSiteSettings(db)]);
    const origin = getSiteOrigin(request, env);

    return new Response(
      buildRss(articles, {
        origin,
        siteName: settings.siteName?.trim() || DEFAULT_SITE_NAME,
        siteDescription: settings.siteDescription?.trim() || DEFAULT_SITE_DESCRIPTION,
      }),
      {
        headers: {
          "content-type": "application/rss+xml; charset=utf-8",
          "cache-control": "public, max-age=3600",
        },
      },
    );
  } catch (error) {
    console.error("Unable to generate RSS feed", error);
    return new Response("Unable to generate RSS feed.", { status: 500 });
  }
};
