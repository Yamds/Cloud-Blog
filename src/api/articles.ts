import { getArticleBySlug as getMockArticleBySlug, mockArticles } from "../data/articles";
import { ApiError, isApiError, requestJson } from "./http";
import type {
  Article,
  ArticleComment,
  ArticleContentBlock,
  ArticleInlineMark,
  ArticleInlineSegment,
  ArticleListItem,
} from "../types/article";

type JsonRecord = Record<string, unknown>;
type PublicArticlesResponse = ArticlePayload[] | { articles?: ArticlePayload[]; data?: ArticlePayload[] };
type PublicArticleResponse =
  | ArticlePayload
  | { article?: ArticlePayload | null; data?: ArticlePayload | null };

interface ArticlePayload {
  id?: string | null;
  slug?: string | null;
  language?: string | null;
  translationGroupId?: string | null;
  translation_group_id?: string | null;
  translations?: unknown;
  title?: string | null;
  summary?: string | null;
  iconName?: string | null;
  icon_name?: string | null;
  tags?: unknown;
  tags_json?: unknown;
  publishedAt?: string | null;
  published_at?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  articleUrl?: string | null;
  article_url?: string | null;
  url?: string | null;
  authorId?: string | null;
  author_id?: string | null;
  authorName?: string | null;
  author_name?: string | null;
  authorAvatar?: string | null;
  author_avatar?: string | null;
  authorHtmlUrl?: string | null;
  author_html_url?: string | null;
  readingMinutes?: number | null;
  reading_minutes?: number | null;
  content?: unknown;
  content_json?: unknown;
  comments?: unknown;
}

interface RichTextNode {
  type?: string;
  text?: string;
  attrs?: JsonRecord;
  marks?: RichTextMark[];
  content?: RichTextNode[];
}

interface RichTextMark {
  type?: string;
  attrs?: JsonRecord;
}

const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null;

const parseJsonString = (value: string) => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
};

const isMockFallbackError = (error: unknown) =>
  isApiError(error) &&
  (error.code === "FETCH_FAILED" ||
    error.code === "INVALID_JSON" ||
    error.code === "NOT_FOUND" ||
    error.status === 404);

const normalizeString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value.trim() : fallback;

const normalizeNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = parseJsonString(value);

    if (parsed !== undefined) {
      return normalizeStringArray(parsed);
    }

    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }

  return undefined;
};

const getNodeText = (node: unknown): string => {
  if (!isRecord(node)) {
    return "";
  }

  if (node.type === "hardBreak") {
    return "\n";
  }

  const ownText = typeof node.text === "string" ? node.text : "";
  const childText = Array.isArray(node.content) ? node.content.map((child) => getNodeText(child)).join("") : "";

  return `${ownText}${childText}`;
};

const normalizeInlineMark = (mark: RichTextMark): ArticleInlineMark | null => {
  if (mark.type === "bold" || mark.type === "italic" || mark.type === "strike" || mark.type === "code") {
    return { type: mark.type };
  }

  if (mark.type === "superscript" || mark.type === "subscript") {
    return { type: mark.type };
  }

  if (mark.type === "color") {
    const color = normalizeString(mark.attrs?.color ?? (mark as { color?: unknown }).color);
    return color ? { type: "color", color } : null;
  }

  if (mark.type === "background") {
    const color = normalizeString(mark.attrs?.color ?? mark.attrs?.backgroundColor ?? (mark as { color?: unknown }).color);
    return color ? { type: "background", color } : null;
  }

  if (mark.type === "underline") {
    return { type: "underline" };
  }

  if (mark.type === "wavyUnderline" || mark.type === "wavy") {
    return { type: "wavy" };
  }

  if (mark.type === "link") {
    const href = normalizeString(mark.attrs?.href ?? (mark as { href?: unknown }).href);
    return href ? { type: "link", href } : null;
  }

  if (mark.type === "textStyle") {
    const color = normalizeString(mark.attrs?.color);
    return color ? { type: "color", color } : null;
  }

  if (mark.type === "highlight") {
    const color = normalizeString(mark.attrs?.color ?? mark.attrs?.backgroundColor);
    return color ? { type: "background", color } : null;
  }

  return null;
};

const normalizeInlineSegments = (value: unknown): ArticleInlineSegment[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((segment): segment is JsonRecord => isRecord(segment))
    .map((segment) => ({
      text: normalizeString(segment.text),
      marks: Array.isArray(segment.marks)
        ? segment.marks
            .filter((mark): mark is RichTextMark => isRecord(mark))
            .map((mark) => normalizeInlineMark(mark))
            .filter((mark): mark is ArticleInlineMark => mark !== null)
        : undefined,
    }))
    .filter((segment) => segment.text);
};

const getSegmentsText = (segments: ArticleInlineSegment[]) =>
  segments
    .map((segment) => segment.text)
    .join("")
    .trim();

const getListBlockText = (block: ArticleContentBlock): string =>
  block.listItems
    ?.map((item) => item.text ?? item.segments?.map((segment) => segment.text).join("") ?? "")
    .join(" ") ??
  block.items?.join(" ") ??
  "";

const normalizeListItems = (value: unknown): ArticleListItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is JsonRecord | string => isRecord(item) || typeof item === "string")
    .map((item) => {
      if (typeof item === "string") {
        return { text: item };
      }

      const segments = normalizeInlineSegments(item.segments);
      const text = normalizeString(item.text) || getSegmentsText(segments);

      return {
        text,
        segments: segments.length ? segments : undefined,
      };
    })
    .filter((item) => item.text || item.segments?.length);
};

const getInlineSegments = (nodes: RichTextNode[] | undefined): ArticleInlineSegment[] => {
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes.flatMap((node) => {
    if (node.type === "hardBreak") {
      return [{ text: "\n" }];
    }

    if (node.type === "text" && typeof node.text === "string") {
      const marks = Array.isArray(node.marks)
        ? node.marks
            .map((mark) => normalizeInlineMark(mark))
            .filter((mark): mark is ArticleInlineMark => mark !== null)
        : [];

      return [
        {
          text: node.text,
          marks: marks.length ? marks : undefined,
        },
      ];
    }

    return getInlineSegments(node.content);
  });
};

const normalizeContentBlock = (value: unknown): ArticleContentBlock | null => {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }

  switch (value.type) {
    case "heading": {
      const segments = normalizeInlineSegments(value.segments);
      const text = normalizeString(value.text) || getSegmentsText(segments);

      if (!text) {
        return null;
      }

      return {
        type: "heading",
        level: normalizeHeadingLevel(value.level),
        text,
        segments: segments.length ? segments : undefined,
        textAlign: normalizeTextAlign(value.textAlign),
      };
    }
    case "paragraph": {
      const segments = normalizeInlineSegments(value.segments);
      const text = normalizeString(value.text) || getSegmentsText(segments);
      return text
        ? {
            type: "paragraph",
            text,
            segments: segments.length ? segments : undefined,
            textAlign: normalizeTextAlign(value.textAlign),
          }
        : null;
    }
    case "code": {
      const code = normalizeString(value.code ?? value.text);
      return code
        ? {
            type: "code",
            language: normalizeString(value.language),
            code,
          }
        : null;
    }
    case "blockquote": {
      const segments = normalizeInlineSegments(value.segments);
      const text = normalizeString(value.text) || getSegmentsText(segments);
      return text
        ? {
            type: "blockquote",
            text,
            segments: segments.length ? segments : undefined,
            textAlign: normalizeTextAlign(value.textAlign),
          }
        : null;
    }
    case "image": {
      const src = normalizeString(value.src);
      return src
        ? {
            type: "image",
            src,
            alt: normalizeString(value.alt),
          }
        : null;
    }
    case "list": {
      const items = normalizeStringArray(value.items);
      const listItems = normalizeListItems(value.listItems);
      return items.length || listItems.length
        ? {
            type: "list",
            ordered: Boolean(value.ordered),
            items,
            listItems: listItems.length ? listItems : items.map((item) => ({ text: item })),
          }
        : null;
    }
    case "table": {
      const rows = Array.isArray(value.rows)
        ? value.rows
            .filter((row): row is JsonRecord => isRecord(row) && Array.isArray(row.cells))
            .map((row) => ({
              cells: (row.cells as unknown[])
                .filter((cell): cell is JsonRecord => isRecord(cell))
                .map((cell) => {
                  const segments = normalizeInlineSegments(cell.segments);
                  const text = normalizeString(cell.text) || getSegmentsText(segments);
                  return {
                    header: Boolean(cell.header),
                    text,
                    segments: segments.length ? segments : undefined,
                  };
                })
                .filter((cell) => cell.text || cell.segments),
            }))
            .filter((row) => row.cells.length > 0)
        : [];
      return rows.length ? { type: "table", rows } : null;
    }
    default:
      return null;
  }
};

const normalizeComment = (value: unknown): ArticleComment | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeString(value.id);
  const authorName = normalizeString(value.authorName);
  const content = normalizeString(value.content);
  const createdAt = normalizeString(value.createdAt);

  if (!id || !authorName || !content || !createdAt) {
    return null;
  }

  const replies = Array.isArray(value.replies)
    ? value.replies
        .map((reply) => normalizeComment(reply))
        .filter((reply): reply is ArticleComment => reply !== null)
    : undefined;

  return {
    id,
    authorName,
    authorAvatar: normalizeString(value.authorAvatar),
    createdAt,
    content,
    replies: replies?.length ? replies : undefined,
  };
};

const normalizeArticleTranslations = (value: unknown): NonNullable<Article["translations"]> => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is JsonRecord => isRecord(item))
    .map((item) => ({
      id: normalizeString(item.id),
      slug: normalizeString(item.slug),
      title: normalizeString(item.title),
      language: normalizeString(item.language),
      status: normalizeString(item.status),
      updatedAt: normalizeString(item.updatedAt ?? item.updated_at),
    }))
    .filter((item) => item.id && item.slug && item.language);
};

const normalizeComments = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((comment) => normalizeComment(comment))
        .filter((comment): comment is ArticleComment => comment !== null)
    : [];

const convertRichTextNode = (node: RichTextNode): ArticleContentBlock[] => {
  switch (node.type) {
    case "heading": {
      const segments = getInlineSegments(node.content);
      const text = getSegmentsText(segments);
      return text
        ? [
            {
              type: "heading",
              level: normalizeHeadingLevel(node.attrs?.level),
              text,
              segments,
              textAlign: normalizeTextAlign(node.attrs?.textAlign),
            },
          ]
        : [];
    }
    case "paragraph": {
      const segments = getInlineSegments(node.content);
      const text = getSegmentsText(segments);
      return text ? [{ type: "paragraph", text, segments, textAlign: normalizeTextAlign(node.attrs?.textAlign) }] : [];
    }
    case "codeBlock": {
      const code = getNodeText(node).trimEnd();
      return code
        ? [
            {
              type: "code",
              language: normalizeString(node.attrs?.language),
              code,
            },
          ]
        : [];
    }
    case "blockquote": {
      const segments = Array.isArray(node.content)
        ? node.content.flatMap((childNode, index) => [
            ...(index > 0 ? [{ text: "\n\n" }] : []),
            ...getInlineSegments(childNode.content),
          ])
        : [];
      const text = getSegmentsText(segments);

      return text ? [{ type: "blockquote", text, segments, textAlign: normalizeTextAlign(node.attrs?.textAlign) }] : [];
    }
    case "bulletList":
    case "orderedList": {
      const listItems = Array.isArray(node.content)
        ? node.content
            .map(convertListItemNode)
            .filter((item): item is ArticleListItem => item !== null)
        : [];
      const items = listItems.map((item) => item.text ?? getSegmentsText(item.segments ?? [])).filter(Boolean);

      return items.length
        ? [
            {
              type: "list",
              ordered: node.type === "orderedList",
              items,
              listItems,
            },
          ]
        : [];
    }
    case "image": {
      const src = normalizeString(node.attrs?.src);
      return src
        ? [
            {
              type: "image",
              src,
              alt: normalizeString(node.attrs?.alt),
            },
          ]
        : [];
    }
    case "table": {
      const rows = Array.isArray(node.content)
        ? node.content
            .filter((rowNode) => rowNode.type === "tableRow")
            .map((rowNode) => ({
              cells: Array.isArray(rowNode.content)
                ? rowNode.content
                    .filter((cellNode) => cellNode.type === "tableCell" || cellNode.type === "tableHeader")
                    .map((cellNode) => {
                      const segments = Array.isArray(cellNode.content)
                        ? cellNode.content.flatMap((childNode) => getInlineSegments(childNode.content))
                        : [];
                      return {
                        header: cellNode.type === "tableHeader",
                        text: getSegmentsText(segments),
                        segments: segments.length ? segments : undefined,
                      };
                    })
                    .filter((cell) => cell.text || cell.segments)
                : [],
            }))
            .filter((row) => row.cells.length > 0)
        : [];
      return rows.length ? [{ type: "table", rows }] : [];
    }
    default:
      return [];
  }
};

function convertListItemNode(node: RichTextNode): ArticleListItem | null {
  const segments = Array.isArray(node.content)
    ? node.content.flatMap((childNode, index) => [
        ...(index > 0 ? [{ text: "\n" }] : []),
        ...getInlineSegments(childNode.content),
      ])
    : [];
  const text = getSegmentsText(segments) || getNodeText(node).trim();

  return text || segments.length ? { text, segments: segments.length ? segments : undefined } : null;
}

const normalizeTextAlign = (value: unknown): "left" | "center" | "right" | undefined =>
  value === "left" || value === "center" || value === "right" ? value : undefined;

const normalizeHeadingLevel = (value: unknown): 1 | 2 | 3 | 4 | 5 | 6 => {
  const level = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 2;
  return level === 1 || level === 2 || level === 3 || level === 4 || level === 5 || level === 6 ? level : 2;
};

const normalizeContent = (value: unknown): ArticleContentBlock[] => {
  if (Array.isArray(value)) {
    const blockContent = value
      .map((item) => normalizeContentBlock(item))
      .filter((item): item is ArticleContentBlock => item !== null);

    if (blockContent.length > 0) {
      return blockContent;
    }
  }

  const resolvedValue = typeof value === "string" ? parseJsonString(value) : value;

  if (Array.isArray(resolvedValue)) {
    return resolvedValue.flatMap((node) =>
      isRecord(node) ? convertRichTextNode(node as RichTextNode) : [],
    );
  }

  if (isRecord(resolvedValue) && Array.isArray(resolvedValue.content)) {
    return resolvedValue.content.flatMap((node) =>
      isRecord(node) ? convertRichTextNode(node as RichTextNode) : [],
    );
  }

  return [];
};

const summarizeFromContent = (content: ArticleContentBlock[]) => {
  const text = content
    .flatMap((block) => {
      if (block.type === "code") {
        return "";
      }

      if (block.type === "list") {
        return getListBlockText(block);
      }

      if (block.segments?.length) {
        return block.segments.map((segment) => segment.text).join("");
      }

      return block.text || "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return text ? `${text.slice(0, 110)}${text.length > 110 ? "..." : ""}` : "";
};

const estimateReadingMinutes = (article: Pick<Article, "summary" | "content">) => {
  const contentText = article.content
    .flatMap((block) => {
      if (block.type === "code") {
        return block.code || "";
      }

      if (block.type === "list") {
        return getListBlockText(block);
      }

      if (block.segments?.length) {
        return block.segments.map((segment) => segment.text).join("");
      }

      return block.text || "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const sample = `${article.summary} ${contentText}`.trim();
  return sample ? Math.max(1, Math.ceil(sample.length / 320)) : 1;
};

const normalizeArticle = (value: unknown): Article | null => {
  if (!isRecord(value)) {
    return null;
  }

  const slug = normalizeString(value.slug);
  const title = normalizeString(value.title);

  if (!slug || !title) {
    return null;
  }

  const content = normalizeContent(value.content ?? value.content_json);
  const summary = normalizeString(value.summary) || summarizeFromContent(content);
  const iconName = normalizeString(value.iconName ?? value.icon_name, "ph:article");

  const article: Article = {
    id: normalizeString(value.id) || undefined,
    slug,
    language: normalizeString(value.language) || undefined,
    translationGroupId: normalizeNullableString(value.translationGroupId ?? value.translation_group_id),
    translations: normalizeArticleTranslations(value.translations),
    title,
    summary,
    iconName,
    icon_name: iconName,
    tags: normalizeStringArray(value.tags ?? value.tags_json),
    publishedAt: normalizeString(value.publishedAt ?? value.published_at),
    createdAt: normalizeString(value.createdAt ?? value.created_at) || undefined,
    updatedAt: normalizeString(value.updatedAt ?? value.updated_at) || undefined,
    articleUrl: normalizeString(value.articleUrl ?? value.article_url ?? value.url) || `/articles/${encodeURIComponent(slug)}`,
    url: normalizeString(value.url ?? value.articleUrl ?? value.article_url) || `/articles/${encodeURIComponent(slug)}`,
    authorId: normalizeNullableString(value.authorId ?? value.author_id),
    authorName: normalizeString(value.authorName ?? value.author_name) || undefined,
    authorAvatar: normalizeNullableString(value.authorAvatar ?? value.author_avatar),
    authorHtmlUrl: normalizeNullableString(value.authorHtmlUrl ?? value.author_html_url),
    readingMinutes: normalizeNumber(value.readingMinutes ?? value.reading_minutes) ?? 0,
    content,
    comments: normalizeComments(value.comments),
  };

  article.readingMinutes = article.readingMinutes > 0 ? article.readingMinutes : estimateReadingMinutes(article);

  return article;
};

const unwrapArticleList = (payload: PublicArticlesResponse): ArticlePayload[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.articles)) {
    return payload.articles;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  throw new ApiError({
    code: "INVALID_DATA",
    message: "文章列表数据格式不正确。",
  });
};

const unwrapArticle = (payload: PublicArticleResponse) => {
  if (isRecord(payload) && ("article" in payload || "data" in payload)) {
    return payload.article ?? payload.data ?? undefined;
  }

  return payload;
};

export async function getPublishedArticles(language?: "zh" | "en"): Promise<Article[]> {
  try {
    const payload = await requestJson<PublicArticlesResponse>("/api/articles");
    const articles = unwrapArticleList(payload)
      .map((item) => normalizeArticle(item))
      .filter((item): item is Article => item !== null);

    return language ? articles.filter((article) => (article.language ?? "zh") === language) : articles;
  } catch (error) {
    if (isMockFallbackError(error)) {
      return mockArticles;
    }

    throw error;
  }
}

export async function getArticleBySlug(slug: string): Promise<Article | undefined> {
  try {
    const payload = await requestJson<PublicArticleResponse>(`/api/articles/${encodeURIComponent(slug)}`);
    const article = normalizeArticle(unwrapArticle(payload));

    return article ?? getMockArticleBySlug(slug);
  } catch (error) {
    if (isMockFallbackError(error)) {
      return getMockArticleBySlug(slug);
    }

    throw error;
  }
}
