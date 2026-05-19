import type {
  Article,
  ArticleContentBlock,
  ArticleInlineMark,
  ArticleInlineSegment,
  ArticleListItem,
} from "../../src/types/article";
import { queryAll, queryFirst } from "./d1";
import { ApiError } from "./http";

interface ArticleRow {
  slug: string;
  title: string;
  summary: string | null;
  icon_name: string | null;
  tags_csv: string | null;
  published_at: string | null;
  reading_minutes: number | string | null;
  content_json?: string | null;
}

interface RichTextNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: RichTextMark[];
  content?: RichTextNode[];
}

interface RichTextMark {
  type?: string;
  attrs?: Record<string, unknown>;
}

const TAG_SEPARATOR = "\u001f";
const DEFAULT_ICON_NAME = "ph:article";
const SAFE_MEDIA_PATH_PATTERN = /^\/api\/cms\/media(?:\/|$|\?)/;
const SAFE_COLOR_PATTERN =
  /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*(?:\d{1,3}%?\s*,\s*){2}\d{1,3}%?(?:\s*,\s*(?:0|1|0?\.\d+|\d{1,3}%))?\s*\)|hsla?\(\s*-?(?:\d+(?:\.\d+)?)(?:deg|grad|rad|turn)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+|\d{1,3}%))?\s*\))$/i;
const VALID_BLOCK_TYPES = new Set<ArticleContentBlock["type"]>([
  "heading",
  "paragraph",
  "code",
  "blockquote",
  "image",
  "list",
  "table",
]);

const ARTICLE_LIST_SQL = `
  SELECT
    a.slug,
    a.title,
    COALESCE(a.summary, '') AS summary,
    COALESCE(a.icon_name, '${DEFAULT_ICON_NAME}') AS icon_name,
    GROUP_CONCAT(t.name, '${TAG_SEPARATOR}') AS tags_csv,
    a.published_at,
    a.reading_minutes
  FROM articles AS a
  LEFT JOIN article_tags AS article_tag
    ON article_tag.article_id = a.id
  LEFT JOIN tags AS t
    ON t.id = article_tag.tag_id
  WHERE a.status = ?
  GROUP BY
    a.id,
    a.slug,
    a.title,
    a.summary,
    a.icon_name,
    a.published_at,
    a.reading_minutes
  ORDER BY a.published_at DESC, a.updated_at DESC
`;

const ARTICLE_DETAIL_SQL = `
  SELECT
    a.slug,
    a.title,
    COALESCE(a.summary, '') AS summary,
    COALESCE(a.icon_name, '${DEFAULT_ICON_NAME}') AS icon_name,
    GROUP_CONCAT(t.name, '${TAG_SEPARATOR}') AS tags_csv,
    a.published_at,
    a.reading_minutes,
    a.content_json
  FROM articles AS a
  LEFT JOIN article_tags AS article_tag
    ON article_tag.article_id = a.id
  LEFT JOIN tags AS t
    ON t.id = article_tag.tag_id
  WHERE a.status = ?
    AND a.slug = ?
  GROUP BY
    a.id,
    a.slug,
    a.title,
    a.summary,
    a.icon_name,
    a.published_at,
    a.reading_minutes,
    a.content_json
  LIMIT 1
`;

export async function getPublishedArticles(db: D1Database): Promise<Article[]> {
  const rows = await queryAll<ArticleRow>(db.prepare(ARTICLE_LIST_SQL).bind("published"));
  return rows.map((row) => mapArticleRow(row, false));
}

export async function getPublishedArticleBySlug(
  db: D1Database,
  slug: string,
): Promise<Article | null> {
  const row = await queryFirst<ArticleRow>(db.prepare(ARTICLE_DETAIL_SQL).bind("published", slug));
  return row ? mapArticleRow(row, true) : null;
}

export function mapArticleRow(row: ArticleRow, includeContent: boolean): Article {
  const content = includeContent ? parseContentJson(row.content_json) : [];

  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? "",
    iconName: row.icon_name ?? DEFAULT_ICON_NAME,
    icon_name: row.icon_name ?? DEFAULT_ICON_NAME,
    tags: parseTags(row.tags_csv),
    publishedAt: row.published_at ?? "",
    readingMinutes: normalizeReadingMinutes(row.reading_minutes, content),
    content,
    comments: [],
  };
}

export function parseTags(tagsCsv: string | null | undefined): string[] {
  if (!tagsCsv) {
    return [];
  }

  return [...new Set(tagsCsv.split(TAG_SEPARATOR).map((tag) => tag.trim()).filter(Boolean))];
}

export function parseContentJson(raw: string | null | undefined): ArticleContentBlock[] {
  if (!raw) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError(500, "INVALID_CONTENT_JSON", "Article content_json is invalid JSON.");
  }

  if (Array.isArray(parsed) && parsed.every(isArticleContentBlock)) {
    return parsed;
  }

  if (parsed && typeof parsed === "object" && "content" in parsed && Array.isArray(parsed.content)) {
    if (parsed.content.every(isArticleContentBlock)) {
      return parsed.content;
    }

    return parsed.content.flatMap((node) =>
      node && typeof node === "object" ? convertRichTextNode(node as RichTextNode) : [],
    );
  }

  throw new ApiError(
    500,
    "INVALID_CONTENT_JSON",
    "Article content_json is not a supported article content payload.",
  );
}

function convertRichTextNode(node: RichTextNode): ArticleContentBlock[] {
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
              language: typeof node.attrs?.language === "string" ? node.attrs.language : "",
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
      const items = listItems
        .map((item) => item.text ?? getSegmentsText(item.segments ?? []))
        .filter(Boolean);

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
      const src = normalizeSafeUrl(node.attrs?.src);
      return src
        ? [
            {
              type: "image",
              src,
              alt: normalizeOptionalText(node.attrs?.alt),
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
                        segments,
                      };
                    })
                    .filter((cell) => cell.text || cell.segments.length)
                : [],
            }))
            .filter((row) => row.cells.length > 0)
        : [];

      return rows.length ? [{ type: "table", rows }] : [];
    }
    default:
      return [];
  }
}

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

function getNodeText(node: RichTextNode): string {
  if (node.type === "hardBreak") {
    return "\n";
  }

  const ownText = typeof node.text === "string" ? node.text : "";
  const childText = Array.isArray(node.content)
    ? node.content.map((childNode) => getNodeText(childNode)).join("")
    : "";

  return `${ownText}${childText}`;
}

function normalizeInlineMark(mark: RichTextMark): ArticleInlineMark | null {
  if (mark.type === "bold" || mark.type === "italic" || mark.type === "strike" || mark.type === "code") {
    return { type: mark.type };
  }

  if (mark.type === "superscript" || mark.type === "subscript") {
    return { type: mark.type };
  }

  if (mark.type === "underline") {
    return { type: "underline" };
  }

  if (mark.type === "wavyUnderline" || mark.type === "wavy") {
    return { type: "wavy" };
  }

  if (mark.type === "link") {
    const href = normalizeSafeUrl(mark.attrs?.href);
    return href ? { type: "link", href } : null;
  }

  if (mark.type === "textStyle") {
    const color = normalizeSafeColor(mark.attrs?.color);
    return color ? { type: "color", color } : null;
  }

  if (mark.type === "highlight") {
    const color = normalizeSafeColor(mark.attrs?.color) ?? normalizeSafeColor(mark.attrs?.backgroundColor);
    return color ? { type: "background", color } : null;
  }

  return null;
}

function getInlineSegments(nodes: RichTextNode[] | undefined): ArticleInlineSegment[] {
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
}

function getSegmentsText(segments: ArticleInlineSegment[]): string {
  return segments
    .map((segment) => segment.text)
    .join("")
    .trim();
}

function normalizeReadingMinutes(
  value: number | string | null | undefined,
  content: ArticleContentBlock[],
): number {
  const numericValue = typeof value === "string" ? Number(value) : value;
  if (typeof numericValue === "number" && Number.isFinite(numericValue) && numericValue > 0) {
    return Math.round(numericValue);
  }

  return estimateReadingMinutes(content);
}

function estimateReadingMinutes(content: ArticleContentBlock[]): number {
  const text = content
    .map((block) => {
      if (block.type === "code") {
        return block.code ?? "";
      }
      if (block.type === "image") {
        return block.alt ?? "";
      }
      if (block.type === "list") {
        return (
          block.listItems
            ?.map((item) => item.text ?? item.segments?.map((segment) => segment.text).join("") ?? "")
            .join(" ") ??
          block.items?.join(" ") ??
          ""
        );
      }
      if (block.segments?.length) {
        return block.segments.map((segment) => segment.text).join("");
      }
      return block.text ?? "";
    })
    .join(" ")
    .trim();

  if (!text) {
    return 1;
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const nonWhitespaceCharacters = text.replace(/\s+/g, "").length;
  const estimated = wordCount > 1 ? Math.ceil(wordCount / 200) : Math.ceil(nonWhitespaceCharacters / 400);
  return Math.max(1, estimated);
}

function isArticleContentBlock(value: unknown): value is ArticleContentBlock {
  if (!value || typeof value !== "object") {
    return false;
  }

  const block = value as Partial<ArticleContentBlock>;

  if (!block.type || !VALID_BLOCK_TYPES.has(block.type)) {
    return false;
  }

  if (
    block.level !== undefined &&
    block.level !== 1 &&
    block.level !== 2 &&
    block.level !== 3 &&
    block.level !== 4 &&
    block.level !== 5 &&
    block.level !== 6
  ) {
    return false;
  }

  if (block.text !== undefined && typeof block.text !== "string") {
    return false;
  }

  if (
    block.textAlign !== undefined &&
    block.textAlign !== "left" &&
    block.textAlign !== "center" &&
    block.textAlign !== "right"
  ) {
    return false;
  }

  if (
    block.segments !== undefined &&
    (!Array.isArray(block.segments) ||
      block.segments.some(
        (segment) =>
          !segment ||
          typeof segment !== "object" ||
          typeof segment.text !== "string" ||
          (segment.marks !== undefined &&
            (!Array.isArray(segment.marks) ||
              segment.marks.some(
                (mark) =>
                  !mark ||
                  typeof mark !== "object" ||
                  typeof mark.type !== "string" ||
                  (mark.href !== undefined && normalizeSafeUrl(mark.href) === undefined) ||
                  (mark.color !== undefined && normalizeSafeColor(mark.color) === undefined),
              ))),
      ))
  ) {
    return false;
  }

  if (block.language !== undefined && typeof block.language !== "string") {
    return false;
  }

  if (block.code !== undefined && typeof block.code !== "string") {
    return false;
  }

  if (block.alt !== undefined && typeof block.alt !== "string") {
    return false;
  }

  if (block.src !== undefined && normalizeSafeUrl(block.src) === undefined) {
    return false;
  }

  if (block.ordered !== undefined && typeof block.ordered !== "boolean") {
    return false;
  }

  if (block.items !== undefined && (!Array.isArray(block.items) || block.items.some((item) => typeof item !== "string"))) {
    return false;
  }

  if (
    block.listItems !== undefined &&
    (!Array.isArray(block.listItems) ||
      block.listItems.some(
        (item) =>
          !item ||
          typeof item !== "object" ||
          (item.text !== undefined && typeof item.text !== "string") ||
          (item.segments !== undefined && !Array.isArray(item.segments)),
      ))
  ) {
    return false;
  }

  if (
    block.rows !== undefined &&
    (!Array.isArray(block.rows) ||
      block.rows.some(
        (row) =>
          !row ||
          typeof row !== "object" ||
          !Array.isArray(row.cells) ||
          row.cells.some(
            (cell) =>
              !cell ||
              typeof cell !== "object" ||
              (cell.header !== undefined && typeof cell.header !== "boolean") ||
              (cell.text !== undefined && typeof cell.text !== "string") ||
              (cell.segments !== undefined && !Array.isArray(cell.segments)),
          ),
      ))
  ) {
    return false;
  }

  return true;
}

function normalizeTextAlign(value: unknown): "left" | "center" | "right" | undefined {
  return value === "left" || value === "center" || value === "right" ? value : undefined;
}

function normalizeHeadingLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | 6 {
  const level = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 2;
  return level === 1 || level === 2 || level === 3 || level === 4 || level === 5 || level === 6 ? level : 2;
}

function normalizeOptionalText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSafeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const url = value.trim();

  if (!url || /[\u0000-\u001f\u007f\s]/.test(url)) {
    return undefined;
  }

  if (SAFE_MEDIA_PATH_PATTERN.test(url)) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if ((parsed.protocol === "http:" || parsed.protocol === "https:") && !parsed.username && !parsed.password) {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function normalizeSafeColor(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const color = value.trim();
  return SAFE_COLOR_PATTERN.test(color) ? color : undefined;
}
