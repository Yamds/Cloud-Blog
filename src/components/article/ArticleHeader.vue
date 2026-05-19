<script setup lang="ts">
import IconifyIcon from "../common/IconifyIcon.vue";
import type { Article } from "../../types/article";
import { formatShanghaiDate } from "../../utils/date";

defineProps<{ article: Article }>();

const getTagRoute = (tag: string) => `/tags/${encodeURIComponent(tag)}`;
</script>

<template>
  <header class="article-header">
    <IconifyIcon :icon="article.icon_name || article.iconName" class="icon" :size="62" />
    <h1 class="title">{{ article.title }}</h1>
    <div class="meta">
      <time :datetime="article.publishedAt">{{ formatShanghaiDate(article.publishedAt) }}</time>
      <span>&middot;</span>
      <span>阅读时长 {{ article.readingMinutes }} 分钟</span>
    </div>
    <div class="tags">
      <RouterLink
        v-for="tag in article.tags"
        :key="tag"
        class="tag"
        :to="getTagRoute(tag)"
      >
        {{ tag }}
      </RouterLink>
    </div>
  </header>
</template>

<style scoped>
.article-header { text-align: center; margin-bottom: var(--space-8); }
.icon { color: var(--accent); margin-bottom: var(--space-3); }
.title { font-size: clamp(32px, 5vw, 48px); margin-bottom: var(--space-3); }
.meta { display: flex; gap: var(--space-2); justify-content: center; flex-wrap: wrap; color: var(--text-tertiary); margin-bottom: var(--space-3); }
time { font-family: var(--font-heading); }
.tags { display: flex; gap: var(--space-2); flex-wrap: wrap; justify-content: center; }
.tag { position: relative; display: inline-flex; align-items: center; padding: 2px 0; font-size: 13px; color: var(--text-secondary); text-decoration: none; transition: color var(--transition-fast); }
.tag::after { content: ""; position: absolute; left: 0; right: 0; bottom: -2px; height: 1px; background: currentColor; opacity: 0; transform: scaleX(0); transform-origin: right center; transition: opacity var(--transition-fast), transform var(--transition-fast); }
.tag:hover,
.tag:focus-visible { color: var(--accent); }
.tag:hover::after,
.tag:focus-visible::after { opacity: 1; transform: scaleX(1); transform-origin: left center; }
.tag:focus-visible { outline: none; }
</style>
