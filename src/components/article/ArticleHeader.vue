<script setup lang="ts">
import IconifyIcon from "../common/IconifyIcon.vue";
import type { Article } from "../../types/article";
import { formatShanghaiDate } from "../../utils/date";

defineProps<{ article: Article }>();
</script>

<template>
  <header class="article-header">
    <IconifyIcon :icon="article.icon_name || article.iconName" class="icon" :size="62" />
    <h1 class="title">{{ article.title }}</h1>
    <div class="meta">
      <time :datetime="article.publishedAt">{{ formatShanghaiDate(article.publishedAt) }}</time>
      <span>·</span>
      <span>阅读时长 {{ article.readingMinutes }} 分钟</span>
    </div>
    <div class="tags">
      <span v-for="tag in article.tags" :key="tag" class="tag">{{ tag }}</span>
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
.tag { background: var(--bg-elevated); border-radius: var(--radius-sm); padding: 4px 12px; font-size: 13px; color: var(--text-secondary); }
</style>
