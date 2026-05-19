<script setup lang="ts">
import IconifyIcon from "../common/IconifyIcon.vue";
import type { Article } from "../../types/article";
import { formatShanghaiDate } from "../../utils/date";

defineProps<{ article: Article }>();
</script>

<template>
  <article class="masonry-item">
    <IconifyIcon :icon="article.icon_name || article.iconName" class="icon" :size="54" />
    <h3 class="title">{{ article.title }}</h3>
    <p class="summary">{{ article.summary }}</p>
    <footer class="footer">
      <time :datetime="article.publishedAt">{{ formatShanghaiDate(article.publishedAt) }}</time>
      <div class="tags">
        <span v-for="tag in article.tags" :key="tag" class="tag">{{ tag }}</span>
      </div>
    </footer>
  </article>
</template>

<style scoped>
.masonry-item { break-inside: avoid; margin-bottom: var(--space-4); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: var(--space-4); transition: all var(--transition-base); }
.masonry-item:hover { border-color: var(--accent); transform: translateY(-4px); }
.icon { color: var(--accent); margin-bottom: var(--space-3); display: inline-block; }
.title { font-size: 24px; margin-bottom: var(--space-2); }
.summary { color: var(--text-secondary); margin-bottom: var(--space-3); font-size: 15px; }
.footer { display: flex; justify-content: space-between; gap: var(--space-2); flex-wrap: wrap; border-top: 1px solid var(--border-subtle); padding-top: var(--space-2); }
time { color: var(--text-tertiary); font-family: var(--font-heading); font-size: 13px; }
.tags { display: flex; gap: var(--space-1); flex-wrap: wrap; }
.tag { background: var(--bg-elevated); border-radius: 3px; padding: 3px 10px; font-size: 12px; color: var(--text-tertiary); }
</style>
