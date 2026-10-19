import { describe, expect, it } from "vitest";

import { renderArticleHtml } from "../functions/_shared/article-html";
import type { Article } from "../src/types/article";

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "article-1",
    slug: "hello",
    language: "zh",
    title: "Hello",
    summary: "Summary",
    iconName: "ph:code",
    icon_name: "ph:code",
    tags: [],
    publishedAt: "2026-05-01T04:00:00.000Z",
    updatedAt: "2026-05-02T04:00:00.000Z",
    articleUrl: "/articles/hello",
    readingMinutes: 3,
    content: [],
    comments: [],
    ...overrides,
  };
}

describe("renderArticleHtml", () => {
  it("renders headings, inline marks, lists, tables, images and code", () => {
    const html = renderArticleHtml(
      makeArticle({
        content: [
          {
            type: "heading",
            level: 2,
            text: "Section",
            textAlign: "center",
            segments: [{ text: "Section" }],
          },
          {
            type: "paragraph",
            text: "Hello world",
            segments: [
              { text: "Hello " },
              {
                text: "world",
                marks: [{ type: "bold" }, { type: "link", href: "https://example.com" }],
              },
            ],
          },
          { type: "paragraph", text: "line one\nline two", segments: [{ text: "line one\nline two" }] },
          {
            type: "image",
            src: "/api/cms/media/abc",
            alt: "diagram",
            imageSize: 60,
            textAlign: "right",
          },
          {
            type: "list",
            ordered: true,
            items: ["one"],
            listItems: [{ text: "one", segments: [{ text: "one" }] }],
          },
          {
            type: "table",
            rows: [
              {
                cells: [
                  { header: true, text: "H", segments: [{ text: "H" }] },
                  { header: false, text: "C", segments: [{ text: "C" }] },
                ],
              },
            ],
          },
          { type: "code", language: "ts", code: "const x = 1 < 2;" },
        ],
      }),
    );

    expect(html).toContain('<h1 class="seo-prerender__title">Hello</h1>');
    expect(html).toContain('<h2 style="text-align:center">Section</h2>');
    expect(html).toContain(
      '<a href="https://example.com" target="_blank" rel="noreferrer"><strong>world</strong></a>',
    );
    expect(html).toContain("line one<br>line two");
    expect(html).toContain('class="article-image-wrap"');
    expect(html).toContain('src="/api/cms/media/abc"');
    expect(html).toContain("width:60%;margin:0 0 24px auto;");
    expect(html).toContain("<ol><li>one</li></ol>");
    expect(html).toContain("<th>H</th>");
    expect(html).toContain("<td>C</td>");
    expect(html).toContain('<code class="language-ts">const x = 1 &lt; 2;</code>');
    expect(html).toContain("3 分钟");
  });

  it("escapes user-controlled text and attributes", () => {
    const html = renderArticleHtml(
      makeArticle({
        title: '<script>alert("x")</script>',
        summary: "A & B",
        content: [
          {
            type: "paragraph",
            text: "<img src=x onerror=alert(1)>",
            segments: [{ text: "<img src=x onerror=alert(1)>" }],
          },
          { type: "image", src: "https://example.com/a.png?a=1&b=2", alt: '"><script>' },
        ],
      }),
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("https://example.com/a.png?a=1&amp;b=2");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("defaults image size to 100% and centers it", () => {
    const html = renderArticleHtml(
      makeArticle({ content: [{ type: "image", src: "https://example.com/a.png", alt: "a" }] }),
    );

    expect(html).toContain("width:100%;margin:0 auto 24px;");
  });
});
