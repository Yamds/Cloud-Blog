<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import IconifyIcon from "../common/IconifyIcon.vue";
import type { Article } from "../../types/article";
import { formatShanghaiDate } from "../../utils/date";

const props = defineProps<{
  article: Article;
  to?: string;
}>();

const articleIcon = computed(() => props.article.icon_name || props.article.iconName);
const articleLinkTarget = computed(() => props.to);
const articleLinkProps = computed(() =>
  articleLinkTarget.value
    ? {
        to: articleLinkTarget.value,
        "aria-label": `阅读文章：${props.article.title}`,
      }
    : {},
);
const articleLinkTag = computed(() => (articleLinkTarget.value ? RouterLink : "div"));
const displayDate = computed(() => formatShanghaiDate(props.article.publishedAt));
</script>

<template>
  <article class="timeline-item">
    <component :is="articleLinkTag" class="item-link" v-bind="articleLinkProps">
      <IconifyIcon :icon="articleIcon" class="article-icon" :size="48" aria-hidden="true" />
      <div class="article-content">
        <h3 class="article-title">{{ article.title }}</h3>
        <p class="article-excerpt">{{ article.summary }}</p>
        <footer class="article-footer">
          <time class="article-date" :datetime="article.publishedAt">{{ displayDate }}</time>
          <div class="article-tags">
            <span v-for="tag in article.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </footer>
      </div>
    </component>
  </article>
</template>

<style scoped>
.timeline-item {
  position: relative;
  margin-bottom: var(--space-12);
}

.timeline-item::before {
  content: "";
  position: absolute;
  left: -33px;
  top: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg);
  transition:
    transform 0.3s ease,
    background 0.3s ease;
}

.timeline-item:hover::before,
.timeline-item:focus-within::before {
  transform: scale(1.5);
  background: var(--accent-hover);
}

.item-link {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
  color: inherit;
  text-decoration: none;
}

.item-link:focus-visible {
  outline: 2px solid color-mix(in oklch, var(--accent) 42%, transparent);
  outline-offset: 8px;
  border-radius: 6px;
}

.article-icon {
  color: var(--accent);
  margin-top: 4px;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

.timeline-item:hover .article-icon,
.timeline-item:focus-within .article-icon {
  transform: scale(1.22) rotate(-22.5deg);
}

.article-content {
  flex: 1;
  min-width: 0;
}

.article-title {
  font-family: "LXGW WenKai", serif;
  font-size: 28px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
  margin-bottom: var(--space-2);
  transition: color 0.2s ease;
}

.timeline-item:hover .article-title,
.timeline-item:focus-within .article-title {
  color: var(--accent);
}

.article-excerpt {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: var(--space-3);
  line-height: 1.8;
  text-wrap: pretty;
}

.article-footer {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.article-date {
  color: var(--text-tertiary);
  font-family: var(--font-heading);
  font-size: 14px;
  flex-shrink: 0;
}

.article-tags {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.tag {
  padding: 4px 12px;
  border-radius: 4px;
  background: var(--bg-elevated);
  font-size: 13px;
  color: var(--text-secondary);
  transition:
    background 0.2s ease,
    color 0.2s ease;
}

.tag:hover {
  background: var(--accent);
  color: var(--bg);
}

@media (max-width: 768px) {
  .timeline-item {
    padding-left: var(--space-4);
  }

  .timeline-item::before {
    left: -19px;
  }

  .item-link {
    gap: var(--space-3);
  }

  .article-title {
    font-size: clamp(24px, 7vw, 28px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .timeline-item::before,
  .article-icon,
  .article-title,
  .tag {
    transition: none;
  }

  .timeline-item:hover::before,
  .timeline-item:focus-within::before {
    transform: none;
  }

  .timeline-item:hover .article-icon,
  .timeline-item:focus-within .article-icon {
    transform: none;
  }
}
</style>
