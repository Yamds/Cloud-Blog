import { describe, expect, it } from "vitest";

import type { Article } from "../src/types/article";
import {
  buildArticleJsonLd,
  buildRobots,
  buildRss,
  buildSitemap,
  escapeXml,
  getArticleDescription,
  injectSeoHtml,
  renderSeoHead,
} from "../functions/_shared/seo";

const origin = "https://blog.example.com";

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "article-1",
    slug: "hello",
    language: "zh",
    translationGroupId: "group-1",
    translations: [],
    title: "Hello",
    summary: "A short summary.",
    iconName: "ph:code",
    icon_name: "ph:code",
    tags: ["typescript"],
    publishedAt: "2026-05-01T04:00:00.000Z",
    createdAt: "2026-05-01T04:00:00.000Z",
    updatedAt: "2026-05-02T04:00:00.000Z",
    articleUrl: "/articles/hello",
    authorId: "user-1",
    authorName: "Yamds",
    authorHtmlUrl: "https://github.com/Yamds",
    readingMinutes: 5,
    content: [],
    comments: [],
    ...overrides,
  };
}

describe("XML and HTML escaping", () => {
  it("escapes XML special characters", () => {
    expect(escapeXml(`<a href="x">&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;",
    );
  });
});

describe("buildSitemap", () => {
  it("includes static pages with absolute URLs", () => {
    const xml = buildSitemap([], origin);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(`<loc>${origin}/</loc>`);
    expect(xml).toContain(`<loc>${origin}/articles</loc>`);
    expect(xml).not.toContain("/articles/hello");
  });

  it("includes published articles, lastmod and hreflang alternates", () => {
    const article = makeArticle({
      translations: [
        { id: "article-2", slug: "hello-en", title: "Hello", language: "en", status: "published" },
      ],
    });
    const xml = buildSitemap([article], origin);

    expect(xml).toContain(`<loc>${origin}/articles/hello</loc>`);
    expect(xml).toContain("<lastmod>2026-05-02T04:00:00.000Z</lastmod>");
    expect(xml).toContain(`hreflang="zh" href="${origin}/articles/hello"`);
    expect(xml).toContain(`hreflang="en" href="${origin}/articles/hello-en"`);
  });

  it("escapes article slugs in locations", () => {
    const article = makeArticle({ slug: "a&b", articleUrl: "/articles/a%26b" });
    const xml = buildSitemap([article], origin);

    expect(xml).toContain(`<loc>${origin}/articles/a%26b</loc>`);
  });
});

describe("buildRss", () => {
  it("limits items, escapes content and uses absolute links", () => {
    const articles = Array.from({ length: 25 }, (_, index) =>
      makeArticle({
        id: `article-${index}`,
        slug: `post-${index}`,
        title: index === 0 ? "A & B <script>" : `Post ${index}`,
        articleUrl: `/articles/post-${index}`,
        publishedAt: `2026-05-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
      }),
    );

    const xml = buildRss(articles, {
      origin,
      siteName: "My & Blog",
      siteDescription: "Notes <daily>",
      limit: 20,
    });

    expect(xml.match(/<item>/g)).toHaveLength(20);
    expect(xml).toContain("A &amp; B &lt;script&gt;");
    expect(xml).toContain("<title>My &amp; Blog</title>");
    expect(xml).toContain("Notes &lt;daily&gt;");
    expect(xml).toContain(`<link>${origin}/articles/post-0</link>`);
    expect(xml).toMatch(/<pubDate>[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4}/);
  });
});

describe("buildRobots", () => {
  it("allows major crawlers and points to the sitemap", () => {
    const robots = buildRobots(origin);

    expect(robots).toContain("User-agent: Googlebot");
    expect(robots).toContain("User-agent: Baiduspider");
    expect(robots).toContain("User-agent: bingbot");
    expect(robots).toContain("Disallow: /cms");
    expect(robots).toContain("Disallow: /*?preview=1");
    expect(robots).toContain(`Sitemap: ${origin}/sitemap.xml`);
  });
});

describe("renderSeoHead", () => {
  it("renders canonical, social tags and index directives", () => {
    const head = renderSeoHead({
      title: "Hello & <World>",
      description: "Desc",
      canonical: `${origin}/articles/hello`,
      image: "https://cdn.example.com/a.png",
      type: "article",
      locale: "zh-CN",
      siteName: "My Blog",
      publishedAt: "2026-05-01T04:00:00.000Z",
      updatedAt: "2026-05-02T04:00:00.000Z",
      authorName: "Yamds",
    });

    expect(head).toContain("<title>Hello &amp; &lt;World&gt;</title>");
    expect(head).toContain('<meta name="robots" content="index,follow,max-image-preview:large">');
    expect(head).toContain(`<link rel="canonical" href="${origin}/articles/hello">`);
    expect(head).toContain('<meta property="og:image" content="https://cdn.example.com/a.png">');
    expect(head).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(head).toContain('<meta property="article:author" content="Yamds">');
  });

  it("marks preview pages as noindex", () => {
    const head = renderSeoHead({ title: "Preview", description: "Desc", noindex: true });

    expect(head).toContain('<meta name="robots" content="noindex,nofollow">');
    expect(head).not.toContain('rel="canonical"');
  });

  it("escapes script-closing sequences in JSON-LD", () => {
    const head = renderSeoHead({
      title: "Hello",
      description: "Desc",
      jsonLd: { "@type": "BlogPosting", headline: "</script><script>alert(1)</script>" },
    });

    expect(head).not.toContain("</script><script>");
    expect(head).toContain('<script type="application/ld+json" data-seo="json-ld">');
    expect(head).toContain("\\u003c/script\\u003e");
  });
});

describe("injectSeoHtml", () => {
  it("replaces managed tags, language and app content", () => {
    const html =
      '<!DOCTYPE html><html lang="zh-CN"><head><title>Old</title><meta name="description" content="old"><meta property="og:title" content="old"></head><body><div id="app"></div></body></html>';
    const head = renderSeoHead({ title: "New", description: "New description" });

    const output = injectSeoHtml({ html, lang: "en", headHtml: head, appHtml: "<p>prerender</p>" });

    expect(output).toContain('<html lang="en">');
    expect(output).toContain("<title>New</title>");
    expect(output).toContain('content="New description"');
    expect(output).not.toContain('content="old"');
    expect(output).toContain('<div id="app"><p>prerender</p></div>');
  });
});

describe("article helpers", () => {
  it("falls back from summary to body text and truncates", () => {
    const article = makeArticle({
      summary: "",
      content: [{ type: "paragraph", text: "x".repeat(300) }],
    });
    const description = getArticleDescription(article, 160);

    expect(description).toHaveLength(160);
    expect(description.endsWith("…")).toBe(true);
  });

  it("builds BlogPosting JSON-LD with canonical and dates", () => {
    const jsonLd = buildArticleJsonLd(makeArticle(), {
      origin,
      description: "Desc",
      image: `${origin}/api/cms/media/abc`,
    });

    expect(jsonLd).toMatchObject({
      "@type": "BlogPosting",
      headline: "Hello",
      url: `${origin}/articles/hello`,
      datePublished: "2026-05-01T04:00:00.000Z",
      inLanguage: "zh-CN",
    });
  });
});
