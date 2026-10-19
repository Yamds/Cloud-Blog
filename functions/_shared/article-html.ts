import type { Article, ArticleContentBlock, ArticleInlineMark, ArticleInlineSegment } from "../../src/types/article";
import { escapeHtml } from "./seo";

export const ARTICLE_PRERENDER_STYLES = `
    .seo-prerender { max-width: 720px; margin: 0 auto; padding: 96px 16px 64px; }
    .seo-prerender__title { margin: 0 0 16px; font-family: var(--font-heading, var(--font-article, serif)); font-size: clamp(32px, 5vw, 48px); line-height: 1.2; color: var(--text-primary); }
    .seo-prerender__meta { margin: 0 0 12px; color: var(--text-tertiary); font-size: 14px; }
    .seo-prerender__summary { margin: 0 0 32px; color: var(--text-secondary); line-height: 1.8; }
    .seo-prerender .article-content h1,
    .seo-prerender .article-content h2 { margin: 48px 0 24px; font-size: 28px; }
    .seo-prerender .article-content h3 { margin: 40px 0 20px; font-size: 22px; }
    .seo-prerender .article-content h4,
    .seo-prerender .article-content h5,
    .seo-prerender .article-content h6 { margin: 32px 0 16px; font-size: 18px; }
    .seo-prerender .article-content > * + * { margin-top: 24px; }
    .seo-prerender .article-content p,
    .seo-prerender .article-content blockquote,
    .seo-prerender .article-content ul,
    .seo-prerender .article-content ol,
    .seo-prerender .article-content pre,
    .seo-prerender .article-image-wrap,
    .seo-prerender .article-table-wrap { margin: 0 0 24px; }
    .seo-prerender .article-content li + li { margin-top: 8px; }
    .seo-prerender .article-image-wrap { display: block; }
    .seo-prerender .article-content img { display: block; max-width: 100%; height: auto; }
    .seo-prerender .article-table-wrap { overflow-x: auto; }
    .seo-prerender .article-content u,
    .seo-prerender .article-content .seo-underline { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 3px; }
    .seo-prerender .article-content .seo-wavy { text-decoration-line: underline; text-decoration-style: wavy; text-decoration-thickness: 1.25px; text-underline-offset: 0.16em; }
    .seo-prerender .article-content .seo-inline-highlight { border-radius: 3px; }
`;

function renderMark(child: string, mark: ArticleInlineMark): string {
  switch (mark.type) {
    case "bold":
      return `<strong>${child}</strong>`;
    case "italic":
      return `<em>${child}</em>`;
    case "strike":
      return `<s>${child}</s>`;
    case "code":
      return `<code>${child}</code>`;
    case "link":
      return mark.href
        ? `<a href="${escapeHtml(mark.href)}" target="_blank" rel="noreferrer">${child}</a>`
        : child;
    case "superscript":
      return `<sup>${child}</sup>`;
    case "subscript":
      return `<sub>${child}</sub>`;
    case "underline":
      return `<span class="seo-underline">${child}</span>`;
    case "wavy":
      return `<span class="seo-wavy">${child}</span>`;
    case "color":
      return mark.color ? `<span style="color:${escapeHtml(mark.color)}">${child}</span>` : child;
    case "background":
      return mark.color
        ? `<span class="seo-inline-highlight" style="background-color:${escapeHtml(mark.color)}">${child}</span>`
        : child;
    default:
      return child;
  }
}

function renderInline(segments: ArticleInlineSegment[] | undefined, fallback?: string): string {
  const normalized = segments?.length
    ? segments
    : fallback
      ? [{ text: fallback, marks: undefined }]
      : [];

  return normalized
    .map((segment) => {
      const text = escapeHtml(segment.text).replace(/\n/g, "<br>");
      return (segment.marks ?? []).reduce((child, mark) => renderMark(child, mark), text);
    })
    .join("");
}

function alignStyle(value: ArticleContentBlock["textAlign"]): string {
  return value ? ` style="text-align:${escapeHtml(value)}"` : "";
}

function renderImage(block: ArticleContentBlock): string {
  if (!block.src) {
    return "";
  }

  const size = block.imageSize ?? 100;
  const align = block.textAlign ?? "center";
  const margin =
    align === "left"
      ? "margin:0 auto 24px 0;"
      : align === "right"
        ? "margin:0 0 24px auto;"
        : "margin:0 auto 24px;";

  return `<figure class="article-image-wrap"><img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt || "article image")}" loading="lazy" decoding="async" style="width:${size}%;${margin}"></figure>`;
}

function renderList(block: ArticleContentBlock): string {
  const tag = block.ordered ? "ol" : "ul";
  const items = block.listItems?.length
    ? block.listItems.map((item) => renderInline(item.segments, item.text))
    : (block.items ?? []).map((item) => escapeHtml(item));

  if (!items.length) {
    return "";
  }

  return `<${tag}>${items.map((item) => `<li>${item}</li>`).join("")}</${tag}>`;
}

function renderTable(block: ArticleContentBlock): string {
  if (!block.rows?.length) {
    return "";
  }

  const rows = block.rows
    .map((row) => {
      const cells = row.cells
        .map((cell) => {
          const tag = cell.header ? "th" : "td";
          return `<${tag}>${renderInline(cell.segments, cell.text)}</${tag}>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<div class="article-table-wrap"><table><tbody>${rows}</tbody></table></div>`;
}

function renderBlock(block: ArticleContentBlock): string {
  switch (block.type) {
    case "heading": {
      const level = Math.min(6, Math.max(1, block.level ?? 2));
      return `<h${level}${alignStyle(block.textAlign)}>${renderInline(block.segments, block.text)}</h${level}>`;
    }
    case "paragraph":
      return `<p${alignStyle(block.textAlign)}>${renderInline(block.segments, block.text)}</p>`;
    case "blockquote":
      return `<blockquote${alignStyle(block.textAlign)}>${renderInline(block.segments, block.text)}</blockquote>`;
    case "code": {
      if (!block.code) {
        return "";
      }
      const language = (block.language ?? "").replace(/[^a-zA-Z0-9+#-]/g, "").slice(0, 24);
      const className = language ? ` class="language-${escapeHtml(language)}"` : "";
      return `<pre><code${className}>${escapeHtml(block.code)}</code></pre>`;
    }
    case "image":
      return renderImage(block);
    case "list":
      return renderList(block);
    case "table":
      return renderTable(block);
    default:
      return "";
  }
}

export function renderArticleHtml(article: Article): string {
  const publishedDate = article.publishedAt ? article.publishedAt.slice(0, 10) : "";
  const readingLabel = article.language === "en"
    ? `${article.readingMinutes} min read`
    : `${article.readingMinutes} 分钟`;
  const meta = [publishedDate, readingLabel].filter(Boolean).join(" · ");
  const body = article.content.map(renderBlock).join("");

  return [
    '<article class="seo-prerender">',
    `<header><h1 class="seo-prerender__title">${escapeHtml(article.title)}</h1>`,
    meta ? `<p class="seo-prerender__meta">${escapeHtml(meta)}</p>` : "",
    article.summary
      ? `<p class="seo-prerender__summary">${escapeHtml(article.summary)}</p>`
      : "",
    "</header>",
    `<div class="article-content">${body}</div>`,
    "</article>",
  ].join("");
}
