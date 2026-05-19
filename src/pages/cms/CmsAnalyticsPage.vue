<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { getCmsAnalyticsSummary } from "@/api/analytics";
import { isApiError } from "@/api/http";
import CmsShell from "@/components/cms/CmsShell.vue";
import IconifyIcon from "@/components/common/IconifyIcon.vue";
import type { CmsAnalyticsSummary } from "@/types/cms";

const summary = ref<CmsAnalyticsSummary | null>(null);
const loading = ref(true);
const notice = ref("");

const maxDailyViews = computed(() =>
  Math.max(...(summary.value?.dailyViews.map((item) => item.views) ?? [0]), 1),
);
const maxPathViews = computed(() =>
  Math.max(...(summary.value?.topPaths.map((item) => item.views) ?? [0]), 1),
);

async function loadAnalytics(): Promise<void> {
  loading.value = true;
  notice.value = "";

  try {
    summary.value = await getCmsAnalyticsSummary();
  } catch (error) {
    notice.value = isApiError(error) ? error.message : "Failed to load analytics.";
  } finally {
    loading.value = false;
  }
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDay(value: string): string {
  const [, month = "", day = ""] = value.split("-");
  return `${month}.${day}`;
}

onMounted(() => {
  void loadAnalytics();
});
</script>

<template>
  <CmsShell title="访问分析" subtitle="查看最近访问趋势、热门文章和主要入口。">
    <p v-if="notice" class="notice">{{ notice }}</p>

    <section class="top-actions">
      <button type="button" class="text-action" :disabled="loading" @click="loadAnalytics">
        <IconifyIcon icon="ph:arrows-clockwise" :size="16" />
        {{ loading ? "同步中" : "刷新" }}
      </button>
    </section>

    <section v-if="summary" class="metric-grid">
      <article class="metric-card">
        <span>总浏览</span>
        <strong>{{ formatCount(summary.totalViews) }}</strong>
      </article>
      <article class="metric-card">
        <span>今日浏览</span>
        <strong>{{ formatCount(summary.todayViews) }}</strong>
      </article>
      <article class="metric-card">
        <span>近 7 日</span>
        <strong>{{ formatCount(summary.last7DaysViews) }}</strong>
      </article>
      <article class="metric-card">
        <span>热门文章</span>
        <strong>{{ summary.popularArticles.length }}</strong>
      </article>
    </section>

    <section v-if="summary" class="analytics-grid">
      <article class="panel trend-panel">
        <div class="panel-heading">
          <h2>最近 7 天</h2>
          <span>按上海时区聚合</span>
        </div>
        <ol class="trend-list">
          <li v-for="point in summary.dailyViews" :key="point.date">
            <span>{{ formatDay(point.date) }}</span>
            <div class="bar-track">
              <i :style="{ width: `${Math.max((point.views / maxDailyViews) * 100, point.views ? 10 : 0)}%` }" />
            </div>
            <strong>{{ formatCount(point.views) }}</strong>
          </li>
        </ol>
      </article>

      <article class="panel">
        <div class="panel-heading">
          <h2>热门文章</h2>
          <span>近 7 日</span>
        </div>
        <ol v-if="summary.popularArticles.length" class="rank-list">
          <li v-for="article in summary.popularArticles" :key="article.articleId">
            <RouterLink class="text-link" :to="`/articles/${article.slug}`">{{ article.title }}</RouterLink>
            <strong>{{ formatCount(article.views) }}</strong>
          </li>
        </ol>
        <p v-else class="empty-note">还没有文章浏览记录。</p>
      </article>

      <article class="panel">
        <div class="panel-heading">
          <h2>热门路径</h2>
          <span>近 7 日</span>
        </div>
        <ol v-if="summary.topPaths.length" class="path-list">
          <li v-for="item in summary.topPaths" :key="item.path">
            <span class="mono">{{ item.path }}</span>
            <div class="bar-track">
              <i :style="{ width: `${Math.max((item.views / maxPathViews) * 100, item.views ? 10 : 0)}%` }" />
            </div>
            <strong>{{ formatCount(item.views) }}</strong>
          </li>
        </ol>
        <p v-else class="empty-note">还没有路径数据。</p>
      </article>

      <article class="panel">
        <div class="panel-heading">
          <h2>来源域名</h2>
          <span>近 7 日</span>
        </div>
        <ol v-if="summary.topReferrers.length" class="rank-list">
          <li v-for="item in summary.topReferrers" :key="item.referrerHost">
            <span>{{ item.referrerHost }}</span>
            <strong>{{ formatCount(item.views) }}</strong>
          </li>
        </ol>
        <p v-else class="empty-note">暂无外部来源数据。</p>
      </article>
    </section>

    <p v-else-if="loading" class="notice">正在读取访问分析...</p>
  </CmsShell>
</template>

<style scoped>
.notice,
.metric-card,
.panel {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
}
.notice {
  margin-bottom: var(--space-4);
  padding: var(--space-2) var(--space-3);
  color: var(--text-secondary);
  font-size: 13px;
}
.top-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-4);
}
.top-actions button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
}
.text-link,
.text-action {
  position: relative;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color var(--transition-fast);
}
.text-link::after,
.text-action::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  height: 1px;
  background: currentColor;
  opacity: 0;
  transform: scaleX(0);
  transform-origin: right center;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}
.text-link:hover,
.text-link:focus-visible,
.text-action:hover,
.text-action:focus-visible {
  color: var(--accent);
}
.text-link:hover::after,
.text-link:focus-visible::after,
.text-action:hover::after,
.text-action:focus-visible::after {
  opacity: 1;
  transform: scaleX(1);
  transform-origin: left center;
}
.text-action {
  padding: 0;
  border: none;
  background: transparent;
}
.text-action:disabled {
  color: var(--text-tertiary);
}
.text-action:disabled::after {
  display: none;
}
.text-link:focus-visible,
.text-action:focus-visible {
  outline: none;
}
.metric-grid,
.analytics-grid {
  display: grid;
  gap: var(--space-4);
}
.metric-grid {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin-bottom: var(--space-4);
}
.metric-card {
  padding: var(--space-3);
}
.metric-card span,
.panel-heading span,
.empty-note {
  color: var(--text-secondary);
  font-size: 13px;
}
.metric-card strong {
  display: block;
  margin-top: 8px;
  font-family: var(--font-heading);
  font-size: 32px;
  font-weight: 400;
}
.analytics-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.panel {
  padding: var(--space-4);
}
.panel-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.panel-heading h2 {
  font-family: var(--font-heading);
  font-size: 26px;
  font-weight: 400;
}
.trend-list,
.rank-list,
.path-list {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.trend-list li,
.path-list li {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
}
.path-list li {
  grid-template-columns: minmax(160px, 1fr) minmax(0, 1fr) auto;
}
.rank-list li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
}
.rank-list a,
.rank-list span,
.mono {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mono {
  font-family: var(--font-mono);
  font-size: 12px;
}
.bar-track {
  overflow: hidden;
  height: 8px;
  border-radius: 999px;
  background: var(--bg);
}
.bar-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
}
@media (max-width: 860px) {
  .analytics-grid {
    grid-template-columns: 1fr;
  }
  .path-list li {
    grid-template-columns: 1fr auto;
  }
  .path-list .bar-track {
    grid-column: 1 / -1;
  }
}
</style>
