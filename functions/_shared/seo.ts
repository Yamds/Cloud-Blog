import type { Article } from "../../src/types/article";

export const DEFAULT_SITE_NAME = "Yamds's Blog";
export const DEFAULT_SITE_DESCRIPTION = "thoughts, craft and code.";

export interface SeoSiteInfo {
  siteName: string;
  siteDescription: string;
}

export interface SeoHeadInput {
  title: string;
  description: string;
  canonical?: string;
  image?: string | null;
  type?: "website" | "article";
  locale?: string;
  noindex?: boolean;
  siteName?: string;
  publishedAt?: string;
  updatedAt?: string;
  authorName?: string;
  jsonLd?: Record<string, unknown> | null;
}

export function getSiteOrigin(request: Request, env: { SITE_URL?: string }): string {
  const configured = env.SITE_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return new URL(request.url).origin;
}

export function toAbsoluteUrl(origin: string, path: string): string {
  const normalizedOrigin = origin.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedOrigin}${normalizedPath}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeXml(value: string): string {
  return escapeHtml(value);
}

export function truncateText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd() + "…";
}

export function getArticlePlainText(article: Article): string {
  const parts: string[] = [];

  for (const block of article.content) {
    if (block.type === "code") {
      if (block.code) parts.push(block.code);
      continue;
    }

    if (block.type === "image") {
      if (block.alt) parts.push(block.alt);
      continue;
    }

    if (block.type === "list") {
      for (const item of block.listItems ?? []) {
        if (item.text) parts.push(item.text);
      }
      if (!block.listItems?.length) {
        parts.push(...(block.items ?? []));
      }
      continue;
    }

    if (block.type === "table") {
      for (const row of block.rows ?? []) {
        for (const cell of row.cells) {
          if (cell.text) parts.push(cell.text);
        }
      }
      continue;
    }

    if (block.text) parts.push(block.text);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function getArticleDescription(article: Article, maxLength = 160): string {
  return truncateText(article.summary || getArticlePlainText(article) || article.title, maxLength);
}

export function getArticleImageUrl(article: Article, origin: string): string | null {
  const imageBlock = article.content.find((block) => block.type === "image" && block.src);

  if (!imageBlock?.src) {
    return null;
  }

  return imageBlock.src.startsWith("/") ? toAbsoluteUrl(origin, imageBlock.src) : imageBlock.src;
}

export function getArticleLocale(article: Article): string {
  return article.language === "en" ? "en" : "zh-CN";
}

export function getArticleCanonical(origin: string, article: Article): string {
  const path = article.articleUrl || `/articles/${encodeURIComponent(article.slug)}`;
  return toAbsoluteUrl(origin, path);
}

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toRfc822Date(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toUTCString();
}

function escapeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function buildArticleJsonLd(
  article: Article,
  options: { origin: string; description: string; image: string | null },
): Record<string, unknown> {
  const canonical = getArticleCanonical(options.origin, article);
  const publishedAt = toIsoDate(article.publishedAt);
  const updatedAt = toIsoDate(article.updatedAt);

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: options.description,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical,
    },
    url: canonical,
    datePublished: publishedAt ?? undefined,
    dateModified: updatedAt ?? publishedAt ?? undefined,
    inLanguage: getArticleLocale(article),
    author: article.authorName
      ? {
          "@type": "Person",
          name: article.authorName,
          url: article.authorHtmlUrl ?? undefined,
        }
      : undefined,
    image: options.image ?? undefined,
    articleSection: article.tags.length ? article.tags : undefined,
  };
}

export function renderSeoHead(input: SeoHeadInput): string {
  const tags: string[] = [];
  const title = escapeHtml(input.title);
  const description = escapeHtml(input.description);
  const type = input.type ?? "website";
  const locale = input.locale ?? "zh-CN";
  const siteName = escapeHtml(input.siteName || DEFAULT_SITE_NAME);

  tags.push(`<title>${title}</title>`);
  tags.push(`<meta name="description" content="${description}">`);
  tags.push(
    input.noindex
      ? '<meta name="robots" content="noindex,nofollow">'
      : '<meta name="robots" content="index,follow,max-image-preview:large">',
  );

  if (input.canonical) {
    tags.push(`<link rel="canonical" href="${escapeHtml(input.canonical)}">`);
  }

  tags.push(`<meta property="og:type" content="${type}">`);
  tags.push(`<meta property="og:title" content="${title}">`);
  tags.push(`<meta property="og:description" content="${description}">`);
  tags.push(`<meta property="og:site_name" content="${siteName}">`);
  const ogLocale = locale === "en" ? "en_US" : locale.replace("-", "_");
  tags.push(`<meta property="og:locale" content="${escapeHtml(ogLocale)}">`);

  if (input.canonical) {
    tags.push(`<meta property="og:url" content="${escapeHtml(input.canonical)}">`);
  }

  if (input.image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(input.image)}">`);
  }

  if (type === "article") {
    const publishedAt = toIsoDate(input.publishedAt);
    const updatedAt = toIsoDate(input.updatedAt);

    if (publishedAt) {
      tags.push(`<meta property="article:published_time" content="${publishedAt}">`);
    }
    if (updatedAt) {
      tags.push(`<meta property="article:modified_time" content="${updatedAt}">`);
    }
    if (input.authorName) {
      tags.push(`<meta property="article:author" content="${escapeHtml(input.authorName)}">`);
    }
  }

  tags.push(
    `<meta name="twitter:card" content="${input.image ? "summary_large_image" : "summary"}">`,
  );
  tags.push(`<meta name="twitter:title" content="${title}">`);
  tags.push(`<meta name="twitter:description" content="${description}">`);

  if (input.image) {
    tags.push(`<meta name="twitter:image" content="${escapeHtml(input.image)}">`);
  }

  if (input.jsonLd) {
    tags.push(
      `<script type="application/ld+json" data-seo="json-ld">${escapeJsonLd(input.jsonLd)}</script>`,
    );
  }

  return tags.join("\n    ");
}

function stripExistingSeo(html: string): string {
  return html
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta\s+name="description"[^>]*>/gi, "")
    .replace(/<meta\s+name="robots"[^>]*>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, "")
    .replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/gi, "");
}

export function injectSeoHtml(options: {
  html: string;
  lang: string;
  headHtml: string;
  appHtml?: string;
}): string {
  let html = stripExistingSeo(options.html);

  html = html.replace(/<html[^>]*>/i, `<html lang="${escapeHtml(options.lang)}">`);

  if (html.includes("</head>")) {
    html = html.replace("</head>", `  ${options.headHtml}\n  </head>`);
  }

  if (options.appHtml) {
    html = html.replace(/<div id="app">\s*<\/div>/, `<div id="app">${options.appHtml}</div>`);
  }

  return html;
}

export function buildSitemap(articles: Article[], origin: string): string {
  const urls: string[] = [];
  const today = new Date().toISOString();

  const addUrl = (
    loc: string,
    lastmod: string | null,
    alternates: Array<{ hreflang: string; href: string }> = [],
  ): void => {
    const parts = [`    <loc>${escapeXml(loc)}</loc>`];

    if (lastmod) {
      parts.push(`    <lastmod>${lastmod}</lastmod>`);
    }

    for (const alternate of alternates) {
      parts.push(
        `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(alternate.href)}"/>`,
      );
    }

    urls.push(`  <url>\n${parts.join("\n")}\n  </url>`);
  };

  addUrl(toAbsoluteUrl(origin, "/"), today);
  addUrl(toAbsoluteUrl(origin, "/articles"), today);

  for (const article of articles) {
    const alternates = new Map<string, string>();
    const selfHref = getArticleCanonical(origin, article);
    alternates.set(article.language === "en" ? "en" : "zh", selfHref);

    for (const translation of article.translations ?? []) {
      alternates.set(
        translation.language === "en" ? "en" : "zh",
        toAbsoluteUrl(origin, `/articles/${encodeURIComponent(translation.slug)}`),
      );
    }

    addUrl(
      selfHref,
      toIsoDate(article.updatedAt || article.publishedAt),
      [...alternates.entries()].map(([hreflang, href]) => ({ hreflang, href })),
    );
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

export function buildRss(articles: Article[], options: {
  origin: string;
  siteName: string;
  siteDescription: string;
  limit?: number;
}): string {
  const limit = options.limit ?? 20;
  const items = articles.slice(0, limit).map((article) => {
    const link = getArticleCanonical(options.origin, article);
    const description = getArticleDescription(article, 300);
    const pubDate = toRfc822Date(article.publishedAt);
    const parts = [
      `      <title>${escapeXml(article.title)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
      `      <description>${escapeXml(description)}</description>`,
    ];

    if (pubDate) {
      parts.push(`      <pubDate>${pubDate}</pubDate>`);
    }

    for (const tag of article.tags) {
      parts.push(`      <category>${escapeXml(tag)}</category>`);
    }

    return `    <item>\n${parts.join("\n")}\n    </item>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(options.siteName)}</title>`,
    `    <link>${escapeXml(toAbsoluteUrl(options.origin, "/"))}</link>`,
    `    <description>${escapeXml(options.siteDescription)}</description>`,
    "    <language>zh-cn</language>",
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(toAbsoluteUrl(options.origin, "/rss.xml"))}" rel="self" type="application/rss+xml"/>`,
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

export function buildRobots(origin: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /cms",
    "Disallow: /*?preview=1",
    "",
    "User-agent: Googlebot",
    "Allow: /",
    "",
    "User-agent: Baiduspider",
    "Allow: /",
    "",
    "User-agent: bingbot",
    "Allow: /",
    "",
    `Sitemap: ${toAbsoluteUrl(origin, "/sitemap.xml")}`,
    "",
  ].join("\n");
}
