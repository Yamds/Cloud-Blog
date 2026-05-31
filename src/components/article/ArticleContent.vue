<script setup lang="ts">
import ArticleInlineContent from "@/components/article/ArticleInlineContent.vue";
import type { ArticleContentBlock, ArticleListItem } from "../../types/article";
import { createArticleHeadingId } from "@/utils/articleContent";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import shell from "highlight.js/lib/languages/shell";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import { ref } from "vue";

defineProps<{ content: ArticleContentBlock[] }>();

const copiedCodeIndex = ref<number | null>(null);

const languageAliases: Record<string, string> = {
  bash: "bash",
  cjs: "javascript",
  css: "css",
  html: "xml",
  js: "javascript",
  json: "json",
  jsx: "javascript",
  md: "markdown",
  plaintext: "plaintext",
  sh: "bash",
  shell: "bash",
  terminal: "shell",
  text: "plaintext",
  ts: "typescript",
  tsx: "typescript",
  vue: "xml",
  xml: "xml",
};

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("plaintext", plaintext);
hljs.registerLanguage("shell", shell);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);

function escapeHtml(value = ""): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeCodeLanguage(language: string | undefined): string {
  const key = language?.trim().toLowerCase() ?? "";
  return languageAliases[key] ?? key;
}

function getHighlightedCode(code = "", language?: string): string {
  const normalizedLanguage = normalizeCodeLanguage(language);

  if (normalizedLanguage && hljs.getLanguage(normalizedLanguage)) {
    return hljs.highlight(code, { language: normalizedLanguage, ignoreIllegals: true }).value;
  }

  if (code.trim()) {
    return hljs.highlightAuto(code).value;
  }

  return escapeHtml(code);
}

function getHighlightedCodeLines(code = "", language?: string): string[] {
  return getHighlightedCode(code, language).replace(/\r\n?/g, "\n").split("\n");
}

function getCodeRows(block: ArticleContentBlock): Array<{ code: string; html: string }> {
  const codeLines = (block.code ?? "").replace(/\r\n?/g, "\n").split("\n");
  const htmlLines = getHighlightedCodeLines(block.code, block.language);
  const rowCount = Math.max(codeLines.length, htmlLines.length, 1);

  return Array.from({ length: rowCount }, (_, index) => ({
    code: codeLines[index] ?? "",
    html: htmlLines[index] ?? "",
  }));
}

function getHeadingTag(level?: ArticleContentBlock["level"]): "h1" | "h2" | "h3" | "h4" | "h5" | "h6" {
  return `h${level ?? 2}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

function getListItems(block: ArticleContentBlock): ArticleListItem[] {
  return block.listItems?.length ? block.listItems : block.items?.map((item) => ({ text: item })) ?? [];
}

function getResponsiveImageSrcSet(src?: string): string | null {
  if (!src || !isCmsMediaUrl(src)) {
    return null;
  }

  return [
    `${buildMediaVariantUrl(src, "webp_720")} 720w`,
    `${buildMediaVariantUrl(src, "webp_1080")} 1080w`,
  ].join(", ");
}

function isCmsMediaUrl(src: string): boolean {
  try {
    const url = new URL(src, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/cms/media/");
  } catch {
    return src.startsWith("/api/cms/media/");
  }
}

function buildMediaVariantUrl(src: string, variant: "webp_1080" | "webp_720"): string {
  const url = new URL(src, window.location.origin);
  url.searchParams.set("variant", variant);

  if (/^https?:\/\//i.test(src)) {
    return url.toString();
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

async function copyCode(block: ArticleContentBlock, index: number): Promise<void> {
  const code = block.code ?? "";
  const language = normalizeCodeLanguage(block.language);
  const html = createCodeBlockHtml(code, language);

  try {
    if (navigator.clipboard && "ClipboardItem" in window) {
      const ClipboardItemCtor = window.ClipboardItem;
      await navigator.clipboard.write([
        new ClipboardItemCtor({
          "text/plain": new Blob([code], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(code);
    }

    copiedCodeIndex.value = index;
    window.setTimeout(() => {
      if (copiedCodeIndex.value === index) {
        copiedCodeIndex.value = null;
      }
    }, 1400);
  } catch {
    copiedCodeIndex.value = null;
  }
}

function createCodeBlockHtml(code: string, language?: string): string {
  const languageClass = language ? ` class="language-${escapeHtml(language)}"` : "";
  return `<pre><code${languageClass}>${escapeHtml(code)}</code></pre>`;
}

function createClipboardText(fragment: DocumentFragment): string {
  const clone = fragment.cloneNode(true) as DocumentFragment;
  clone.querySelectorAll(".article-code-copy,.article-code-line-number").forEach((node) => node.remove());
  clone.querySelectorAll<HTMLElement>(".article-code-block").forEach((node) => {
    node.replaceWith(document.createTextNode(`\n${node.dataset.code ?? node.textContent ?? ""}\n`));
  });
  return clone.textContent ?? "";
}

function handleArticleCopy(event: ClipboardEvent): void {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const container = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  const range = selection.getRangeAt(0);

  if (!container || !range.intersectsNode(container)) {
    return;
  }

  const fragment = range.cloneContents();

  fragment.querySelectorAll(".article-code-copy,.article-code-line-number").forEach((node) => node.remove());
  fragment.querySelectorAll<HTMLElement>(".article-code-block").forEach((node) => {
    const code = node.dataset.code ?? "";
    const language = node.dataset.language;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = createCodeBlockHtml(code, language);
    node.replaceWith(wrapper.firstElementChild ?? document.createTextNode(code));
  });

  const wrapper = document.createElement("div");
  wrapper.appendChild(fragment.cloneNode(true));
  event.clipboardData?.setData("text/html", wrapper.innerHTML);
  event.clipboardData?.setData("text/plain", createClipboardText(fragment));
  event.preventDefault();
}
</script>

<template>
  <section class="article-content" @copy="handleArticleCopy">
    <template v-for="(block, index) in content" :key="index">
      <component
        :is="getHeadingTag(block.level)"
        v-if="block.type === 'heading'"
        :id="createArticleHeadingId(block, index)"
        class="article-heading"
        :class="`level-${block.level ?? 2}`"
        :style="{ textAlign: block.textAlign }"
      >
        <ArticleInlineContent :segments="block.segments" :fallback="block.text" />
      </component>
      <p v-else-if="block.type === 'paragraph'" :style="{ textAlign: block.textAlign }">
        <ArticleInlineContent :segments="block.segments" :fallback="block.text" />
      </p>
      <blockquote v-else-if="block.type === 'blockquote'" :style="{ textAlign: block.textAlign }">
        <ArticleInlineContent :segments="block.segments" :fallback="block.text" />
      </blockquote>
      <div
        v-else-if="block.type === 'code'"
        class="article-code-block"
        :data-code="block.code ?? ''"
        :data-language="normalizeCodeLanguage(block.language)"
      >
        <button type="button" class="article-code-copy" @click="copyCode(block, index)">
          {{ copiedCodeIndex === index ? "已复制" : "复制" }}
        </button>
        <div
          v-for="(line, lineIndex) in getCodeRows(block)"
          :key="lineIndex"
          class="article-code-line"
        >
          <span class="article-code-line-number">{{ lineIndex + 1 }}</span>
          <code v-html="line.html || ' '"></code>
        </div>
      </div>
      <picture v-else-if="block.type === 'image'" class="article-image-wrap">
        <source
          v-if="getResponsiveImageSrcSet(block.src)"
          :srcset="getResponsiveImageSrcSet(block.src) ?? undefined"
          sizes="(max-width: 720px) 100vw, 720px"
        />
        <img :src="block.src" :alt="block.alt || 'article image'" loading="lazy" decoding="async" />
      </picture>
      <ol v-else-if="block.type === 'list' && block.ordered">
        <li v-for="(item, itemIndex) in getListItems(block)" :key="itemIndex">
          <ArticleInlineContent :segments="item.segments" :fallback="item.text" />
        </li>
      </ol>
      <ul v-else-if="block.type === 'list' && !block.ordered">
        <li v-for="(item, itemIndex) in getListItems(block)" :key="itemIndex">
          <ArticleInlineContent :segments="item.segments" :fallback="item.text" />
        </li>
      </ul>
      <div v-else-if="block.type === 'table'" class="article-table-wrap">
        <table>
          <tbody>
            <tr v-for="(row, rowIndex) in block.rows" :key="rowIndex">
              <component
                :is="cell.header ? 'th' : 'td'"
                v-for="(cell, cellIndex) in row.cells"
                :key="cellIndex"
              >
                <ArticleInlineContent :segments="cell.segments" :fallback="cell.text" />
              </component>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<style scoped>
.article-content { font-family: var(--font-article); font-size: 16px; line-height: 1.72; }
.article-content p, .article-code-block, .article-content blockquote, .article-content ul, .article-content ol { margin-bottom: var(--space-4); }
.article-heading { scroll-margin-top: calc(68px + var(--space-6)); font-family: var(--font-article); font-weight: 500; line-height: 1.4; }
.article-heading.level-1 { font-size: 32px; margin: var(--space-8) 0 var(--space-4); }
.article-heading.level-2 { font-size: 28px; margin: var(--space-8) 0 var(--space-4); }
.article-heading.level-3 { font-size: 22px; margin: var(--space-6) 0 var(--space-3); }
.article-heading.level-4 { font-size: 19px; margin: var(--space-4) 0 var(--space-2); }
.article-heading.level-5 { font-size: 17px; margin: var(--space-4) 0 var(--space-2); }
.article-heading.level-6 { font-size: 15px; margin: var(--space-3) 0 var(--space-1); color: var(--text-secondary); }
.article-code-block { position: relative; overflow-x: auto; background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 10px 0; font-family: var(--font-mono); font-size: 14px; line-height: 1.62; }
.article-code-copy { position: sticky; top: 8px; left: calc(100% - 62px); z-index: 2; float: right; margin: -2px 8px 4px 8px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 4px 8px; background: color-mix(in oklab, var(--bg-elevated) 88%, transparent); color: var(--text-secondary); font-family: var(--font-mono); font-size: 12px; backdrop-filter: blur(10px); opacity: 0; transition: opacity var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast); }
.article-code-block:hover .article-code-copy,
.article-code-copy:focus-visible { opacity: 1; }
.article-code-copy:hover { color: var(--accent); border-color: var(--accent); }
.article-code-line { display: grid; grid-template-columns: 3.25em minmax(0, 1fr); align-items: start; min-width: max-content; padding: 0 14px 0 0; }
.article-code-line-number { position: sticky; left: 0; align-self: stretch; padding-right: 12px; background: var(--bg-elevated); color: var(--text-tertiary); text-align: right; user-select: none; }
.article-code-line code { display: block; min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.article-content code { font-family: var(--font-mono); font-size: 0.85em; }
.article-code-block code { font-size: inherit; }
.article-content blockquote { border-left: 3px solid var(--accent); padding-left: var(--space-3); color: var(--text-secondary); font-style: italic; }
.article-content ul, .article-content ol { padding-left: var(--space-4); }
.article-image-wrap { display: block; margin-bottom: var(--space-4); }
.article-content img { width: 100%; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); }
.article-table-wrap { overflow-x: auto; margin-bottom: var(--space-4); }
.article-content table { width: 100%; border-collapse: collapse; font-size: 14px; }
.article-content th, .article-content td { border: 1px solid var(--border-subtle); padding: 10px 12px; text-align: left; vertical-align: top; }
.article-content th { color: var(--text-primary); background: var(--bg-elevated); font-weight: 600; }
:deep(.hljs-keyword),:deep(.hljs-selector-tag),:deep(.hljs-built_in),:deep(.hljs-tag) { color: var(--syntax-keyword); }
:deep(.hljs-string),:deep(.hljs-section),:deep(.hljs-literal),:deep(.hljs-template-tag),:deep(.hljs-template-variable) { color: var(--syntax-string); }
:deep(.hljs-title),:deep(.hljs-title.function_),:deep(.hljs-function),:deep(.hljs-name),:deep(.hljs-attribute) { color: var(--syntax-function); }
:deep(.hljs-number),:deep(.hljs-regexp),:deep(.hljs-link),:deep(.hljs-symbol),:deep(.hljs-bullet),:deep(.hljs-addition) { color: var(--syntax-number); }
:deep(.hljs-operator),:deep(.hljs-punctuation),:deep(.hljs-variable),:deep(.hljs-type),:deep(.hljs-params) { color: var(--syntax-operator); }
:deep(.hljs-comment),:deep(.hljs-quote),:deep(.hljs-deletion),:deep(.hljs-meta) { color: var(--syntax-comment); }
</style>
