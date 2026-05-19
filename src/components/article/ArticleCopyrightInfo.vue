<script setup lang="ts">
import { computed } from "vue";
import type { Article } from "@/types/article";
import { formatShanghaiDateTime } from "@/utils/date";

const props = defineProps<{
  article: Article;
  siteOrigin?: string;
}>();

const LICENSE_URL = "https://creativecommons.org/licenses/by-nc-sa/4.0/";

const articleUrl = computed(() => {
  const rawUrl = props.article.articleUrl || props.article.url || `/articles/${encodeURIComponent(props.article.slug)}`;

  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }

  const normalizedPath = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  const origin = props.siteOrigin?.trim().replace(/\/+$/, "");
  return origin ? `${origin}${normalizedPath}` : normalizedPath;
});

const displayUpdatedAt = computed(() => props.article.updatedAt || props.article.publishedAt || props.article.createdAt || "");
const displayPublishedAt = computed(() => props.article.publishedAt || props.article.createdAt || "");
const displayAuthor = computed(() => props.article.authorName || "本站作者");
</script>

<template>
  <section class="copyright-info" aria-label="文章版权说明">
    <h2 class="title">版权说明</h2>
    <dl class="meta-list">
      <div class="meta-row">
        <dt>文章标题</dt>
        <dd>{{ article.title }}</dd>
      </div>
      <div class="meta-row">
        <dt>文章 URL</dt>
        <dd>
          <a class="meta-link" :href="articleUrl" target="_blank" rel="noopener noreferrer">{{ articleUrl }}</a>
        </dd>
      </div>
      <div class="meta-row">
        <dt>文章作者</dt>
        <dd>{{ displayAuthor }}</dd>
      </div>
      <div class="meta-row">
        <dt>许可协议</dt>
        <dd>
          转载或引用本文时请遵守
          <a class="meta-link" :href="LICENSE_URL" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a>
          许可协议，注明出处，不得用于商业用途。
        </dd>
      </div>
      <div class="meta-row">
        <dt>发布日期</dt>
        <dd>
          <time :datetime="displayPublishedAt">{{ formatShanghaiDateTime(displayPublishedAt) }}</time>
        </dd>
      </div>
      <div class="meta-row">
        <dt>更新日期</dt>
        <dd>
          <time :datetime="displayUpdatedAt">{{ formatShanghaiDateTime(displayUpdatedAt) }}</time>
        </dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.copyright-info {
  margin: var(--space-6) 0 var(--space-8);
  padding: var(--space-4) 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.title {
  margin: 0 0 var(--space-2);
  font-size: 16px;
  color: var(--text-primary);
}

.meta-list {
  margin: 0;
  display: grid;
  gap: 6px;
}

.meta-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

dt {
  color: var(--text-tertiary);
  font-size: 13px;
}

dd {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
  word-break: break-word;
}

time {
  font-family: var(--font-mono);
}

.meta-link {
  color: var(--accent);
  text-decoration: none;
}

.meta-link:hover,
.meta-link:focus-visible {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .meta-row {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
</style>
