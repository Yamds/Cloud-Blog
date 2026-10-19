export interface SeoInput {
  title: string;
  description?: string;
  canonicalPath?: string | null;
  type?: "website" | "article";
  image?: string | null;
  locale?: "zh" | "en";
  noindex?: boolean;
  siteName?: string;
  publishedAt?: string;
  updatedAt?: string;
  authorName?: string;
}

export const DEFAULT_SITE_NAME = "Yamds's Blog";
export const DEFAULT_SITE_DESCRIPTION = "thoughts, craft and code.";

function upsertMeta(attr: "name" | "property", key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }

  element.setAttribute("data-seo", "true");
  element.setAttribute("content", content);
}

function removeMeta(attr: "name" | "property", key: string): void {
  document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)?.remove();
}

function upsertCanonical(href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  element.setAttribute("data-seo", "true");
  element.setAttribute("href", href);
}

function removeCanonical(): void {
  document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.remove();
}

export function absoluteUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

export function resolveSeoImage(src: string | null | undefined): string | null {
  if (!src) {
    return null;
  }

  return src.startsWith("/") ? absoluteUrl(src) : src;
}

export function truncateDescription(value: string, maxLength = 160): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd() + "…";
}

function normalizeDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function clearJsonLd(): void {
  document.head.querySelector('script[data-seo="json-ld"]')?.remove();
}

function escapeJsonLdValue(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function clearArticleJsonLd(): void {
  clearJsonLd();
}

export function applyArticleJsonLd(
  article: {
    title: string;
    summary: string;
    tags: string[];
    language?: string;
    publishedAt: string;
    updatedAt?: string;
    authorName?: string;
    authorHtmlUrl?: string | null;
  },
  canonicalPath: string,
  image: string | null,
): void {
  clearJsonLd();

  const canonical = absoluteUrl(canonicalPath);
  const payload = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: truncateDescription(article.summary || article.title, 300),
    url: canonical,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    datePublished: normalizeDate(article.publishedAt),
    dateModified: normalizeDate(article.updatedAt || article.publishedAt),
    inLanguage: article.language === "en" ? "en" : "zh-CN",
    author: article.authorName
      ? {
          "@type": "Person",
          name: article.authorName,
          url: article.authorHtmlUrl || undefined,
        }
      : undefined,
    image: image ?? undefined,
    articleSection: article.tags.length ? article.tags : undefined,
  };

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.setAttribute("data-seo", "json-ld");
  script.textContent = escapeJsonLdValue(payload);
  document.head.appendChild(script);
}

export function applySeo(input: SeoInput): void {
  const description = input.description?.trim() || DEFAULT_SITE_DESCRIPTION;
  const siteName = input.siteName?.trim() || DEFAULT_SITE_NAME;
  const type = input.type ?? "website";
  const locale = input.locale === "en" ? "en_US" : "zh_CN";
  const image = input.image ?? null;
  const canonical =
    !input.noindex && input.canonicalPath ? absoluteUrl(input.canonicalPath) : null;

  document.title = input.title;

  upsertMeta("name", "description", description);
  upsertMeta(
    "name",
    "robots",
    input.noindex ? "noindex,nofollow" : "index,follow,max-image-preview:large",
  );
  upsertMeta("property", "og:type", type);
  upsertMeta("property", "og:title", input.title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:site_name", siteName);
  upsertMeta("property", "og:locale", locale);

  if (canonical) {
    upsertCanonical(canonical);
    upsertMeta("property", "og:url", canonical);
  } else {
    removeCanonical();
    removeMeta("property", "og:url");
  }

  if (image) {
    upsertMeta("property", "og:image", image);
    upsertMeta("name", "twitter:image", image);
  } else {
    removeMeta("property", "og:image");
    removeMeta("name", "twitter:image");
  }

  upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
  upsertMeta("name", "twitter:title", input.title);
  upsertMeta("name", "twitter:description", description);

  removeMeta("property", "article:published_time");
  removeMeta("property", "article:modified_time");
  removeMeta("property", "article:author");

  if (type === "article") {
    const publishedAt = normalizeDate(input.publishedAt);
    const updatedAt = normalizeDate(input.updatedAt);

    if (publishedAt) {
      upsertMeta("property", "article:published_time", publishedAt);
    }
    if (updatedAt) {
      upsertMeta("property", "article:modified_time", updatedAt);
    }
    if (input.authorName) {
      upsertMeta("property", "article:author", input.authorName);
    }
  } else {
    clearJsonLd();
  }
}
