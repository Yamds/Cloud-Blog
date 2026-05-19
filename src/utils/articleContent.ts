import type { ArticleContentBlock } from "@/types/article";

export function getArticleBlockText(block: ArticleContentBlock): string {
  if (block.segments?.length) {
    return block.segments.map((segment) => segment.text).join("");
  }

  return block.text ?? "";
}

export function createArticleHeadingId(block: ArticleContentBlock, index: number): string {
  const text = getArticleBlockText(block);
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `heading-${index}-${slug || "section"}`;
}
