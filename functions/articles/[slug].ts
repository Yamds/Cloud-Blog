import { getPublishedArticleBySlug } from "../_shared/articles";
import { ARTICLE_PRERENDER_STYLES, renderArticleHtml } from "../_shared/article-html";
import { requireDb } from "../_shared/d1";
import type { Env } from "../_shared/env";
import {
  buildArticleJsonLd,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_NAME,
  getArticleCanonical,
  getArticleDescription,
  getArticleImageUrl,
  getArticleLocale,
  getSiteOrigin,
  injectSeoHtml,
  renderSeoHead,
} from "../_shared/seo";
import { getSiteSettings } from "../_shared/settings";

interface SeoEnv extends Env {
  ASSETS: Fetcher;
}

function htmlResponse(html: string, status: number, robots: string): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": robots,
    },
  });
}

async function fetchIndexHtml(request: Request, env: SeoEnv): Promise<string> {
  const indexUrl = new URL("/index.html", request.url);
  const response = await env.ASSETS.fetch(
    new Request(indexUrl.toString(), {
      headers: { accept: "text/html" },
    }),
  );

  if (!response.ok) {
    throw new Error(`Unable to load index.html: ${response.status}`);
  }

  return await response.text();
}

async function readSiteInfo(db: D1Database): Promise<{ siteName: string; siteDescription: string }> {
  try {
    const settings = await getSiteSettings(db);
    return {
      siteName: settings.siteName?.trim() || DEFAULT_SITE_NAME,
      siteDescription: settings.siteDescription?.trim() || DEFAULT_SITE_DESCRIPTION,
    };
  } catch (error) {
    console.error("Unable to load site settings for SEO", error);
    return {
      siteName: DEFAULT_SITE_NAME,
      siteDescription: DEFAULT_SITE_DESCRIPTION,
    };
  }
}

export const onRequestGet: PagesFunction<SeoEnv> = async ({ request, env, params }) => {
  const slugParam = params.slug;
  const rawSlug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

  if (!rawSlug) {
    return new Response("Missing article slug.", { status: 400 });
  }

  let slug: string;

  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    return new Response("Invalid article slug.", { status: 400 });
  }

  const db = requireDb(env);
  const origin = getSiteOrigin(request, env);
  const { siteName, siteDescription } = await readSiteInfo(db);
  const indexHtml = await fetchIndexHtml(request, env);
  const isPreview = new URL(request.url).searchParams.get("preview") === "1";

  if (isPreview) {
    const head = renderSeoHead({
      title: `Preview - ${siteName}`,
      description: siteDescription,
      siteName,
      noindex: true,
    });

    return htmlResponse(
      injectSeoHtml({ html: indexHtml, lang: "zh-CN", headHtml: head }),
      200,
      "noindex, nofollow",
    );
  }

  const article = await getPublishedArticleBySlug(db, slug);

  if (!article) {
    const head = renderSeoHead({
      title: `Article not found - ${siteName}`,
      description: siteDescription,
      siteName,
      noindex: true,
    });

    return htmlResponse(
      injectSeoHtml({ html: indexHtml, lang: "zh-CN", headHtml: head }),
      404,
      "noindex, nofollow",
    );
  }

  const description = getArticleDescription(article);
  const canonical = getArticleCanonical(origin, article);
  const image = getArticleImageUrl(article, origin);
  const head = [
    renderSeoHead({
      title: `${article.title} - ${siteName}`,
      description,
      canonical,
      image,
      type: "article",
      locale: getArticleLocale(article),
      siteName,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
      authorName: article.authorName,
      jsonLd: buildArticleJsonLd(article, { origin, description, image }),
    }),
    `<style>${ARTICLE_PRERENDER_STYLES}</style>`,
  ].join("\n    ");

  return htmlResponse(
    injectSeoHtml({
      html: indexHtml,
      lang: getArticleLocale(article),
      headHtml: head,
      appHtml: renderArticleHtml(article),
    }),
    200,
    "index, follow",
  );
};
