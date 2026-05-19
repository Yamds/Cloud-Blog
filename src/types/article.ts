export type ArticleInlineMarkType =
  | "bold"
  | "italic"
  | "strike"
  | "code"
  | "link"
  | "underline"
  | "wavy"
  | "superscript"
  | "subscript"
  | "color"
  | "background";

export interface ArticleInlineMark {
  type: ArticleInlineMarkType;
  href?: string;
  color?: string;
}

export interface ArticleInlineSegment {
  text: string;
  marks?: ArticleInlineMark[];
}

export interface ArticleContentBlock {
  type: "heading" | "paragraph" | "code" | "blockquote" | "image" | "list" | "table";
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  text?: string;
  segments?: ArticleInlineSegment[];
  textAlign?: "left" | "center" | "right";
  language?: string;
  code?: string;
  alt?: string;
  src?: string;
  ordered?: boolean;
  items?: string[];
  listItems?: ArticleListItem[];
  rows?: ArticleTableRow[];
}

export interface ArticleListItem {
  text?: string;
  segments?: ArticleInlineSegment[];
}

export interface ArticleTableCell {
  header?: boolean;
  text?: string;
  segments?: ArticleInlineSegment[];
}

export interface ArticleTableRow {
  cells: ArticleTableCell[];
}

export interface ArticleComment {
  id: string;
  articleId?: string | null;
  parentId?: string | null;
  authorId?: string | null;
  authorName: string;
  authorAvatar: string | null;
  authorHtmlUrl?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  content: string;
  replies?: ArticleComment[];
}

export interface Article {
  id?: string;
  slug: string;
  language?: string;
  translationGroupId?: string | null;
  translations?: ArticleTranslationLink[];
  title: string;
  summary: string;
  iconName: string;
  icon_name: string;
  tags: string[];
  publishedAt: string;
  createdAt?: string;
  updatedAt?: string;
  articleUrl?: string;
  url?: string;
  authorId?: string | null;
  authorName?: string;
  authorAvatar?: string | null;
  authorHtmlUrl?: string | null;
  readingMinutes: number;
  content: ArticleContentBlock[];
  comments: ArticleComment[];
}

export interface ArticleTranslationLink {
  id: string;
  slug: string;
  title: string;
  language: "zh" | "en" | string;
  status?: string;
  updatedAt?: string;
}
