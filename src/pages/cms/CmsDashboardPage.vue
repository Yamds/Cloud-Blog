<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { archiveCmsArticle, getCmsArticles } from "@/api/cms";
import { getCmsAnalyticsSummary } from "@/api/analytics";
import { isApiError } from "@/api/http";
import ArticlesTable from "@/components/cms/ArticlesTable.vue";
import CmsShell from "@/components/cms/CmsShell.vue";
import StatCard from "@/components/cms/StatCard.vue";
import { cmsRecentArticles, cmsStats } from "@/data/cms";
import type {
  CmsAnalyticsSummary,
  CmsArticleDetail,
  CmsArticleRow,
  CmsArticleStats,
  CmsStatItem,
} from "@/types/cms";
import { formatShanghaiDate } from "@/utils/date";

const articles = ref<CmsArticleRow[]>([...cmsRecentArticles]);
const stats = ref<CmsStatItem[]>([...cmsStats]);
const analyticsSummary = ref<CmsAnalyticsSummary | null>(null);
const loading = ref(true);
const archiveBusyId = ref<string | null>(null);
const fallbackNotice = ref("");
const actionNotice = ref("");

const archiveDisabled = computed(() => loading.value || Boolean(archiveBusyId.value));
const analyticsMaxViews = computed(() =>
  Math.max(...(analyticsSummary.value?.dailyViews.map((item) => item.views) ?? [0]), 1),
);

function mapArticleRow(article: CmsArticleDetail): CmsArticleRow {
  return {
    id: article.id,
    iconName: article.iconName || "ph:article",
    title: article.title || "未命名文章",
    date: formatShanghaiDate(article.updatedAt || article.createdAt || article.publishedAt),
    status: article.status,
  };
}

function mapStats(source: CmsArticleStats | null, summary: CmsAnalyticsSummary | null): CmsStatItem[] {
  const mockMap = new Map(cmsStats.map((item) => [item.key, item]));
  const fallbackItem = (key: string, index: number): CmsStatItem => {
    const item = mockMap.get(key) ?? cmsStats[index];

    if (!item) {
      return {
        key,
        label: "",
        icon: "ph:dot-outline",
        value: "0",
        change: "",
      };
    }

    return item;
  };

  const mockArticles = fallbackItem("articles", 0);
  const mockViews = fallbackItem("views", 1);
  const mockDrafts = fallbackItem("drafts", 2);
  const mockTags = fallbackItem("tags", 3);

  return [
    {
      key: "articles",
      label: "总文章数",
      icon: "ph:article",
      value: source ? formatCount(source.total) : mockArticles.value,
      change: source ? `已发布 ${formatCount(source.published)}` : mockArticles.change,
      positive: source ? source.published > 0 : mockArticles.positive,
    },
    {
      key: "views",
      label: "总浏览量",
      icon: "ph:eye",
      value: summary ? formatCount(summary.totalViews) : mockViews.value,
      change: summary ? `今日 ${formatCount(summary.todayViews)}` : mockViews.change,
      positive: summary ? summary.todayViews > 0 : mockViews.positive,
    },
    {
      key: "drafts",
      label: "草稿",
      icon: "ph:file-dashed",
      value: source ? formatCount(source.draft) : mockDrafts.value,
      change: source ? `归档 ${formatCount(source.archived)}` : mockDrafts.change,
    },
    {
      key: "tags",
      label: "标签数",
      icon: "ph:tag",
      value: source ? formatCount(source.tags) : mockTags.value,
      change: summary ? `近 7 日 ${formatCount(summary.last7DaysViews)}` : mockTags.change,
      positive: summary ? summary.last7DaysViews > 0 : mockTags.positive,
    },
  ];
}

async function loadDashboard(): Promise<void> {
  loading.value = true;
  fallbackNotice.value = "";
  analyticsSummary.value = null;

  const notices: string[] = [];
  const [articlesResult, analyticsResult] = await Promise.allSettled([
    getCmsArticles(),
    getCmsAnalyticsSummary(),
  ]);

  if (articlesResult.status === "fulfilled") {
    const sortedArticles = [...articlesResult.value.articles].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );

    articles.value = sortedArticles.slice(0, 5).map(mapArticleRow);
  } else {
    articles.value = [...cmsRecentArticles];
    notices.push(
      isApiError(articlesResult.reason)
        ? `文章接口暂时不可用，当前展示本地示例数据：${articlesResult.reason.message}`
        : "文章接口暂时不可用，当前展示本地示例数据。",
    );
  }

  if (analyticsResult.status === "fulfilled") {
    analyticsSummary.value = analyticsResult.value;
  } else {
    notices.push(
      isApiError(analyticsResult.reason)
        ? `访问分析接口暂时不可用，当前保留示例统计卡片：${analyticsResult.reason.message}`
        : "访问分析接口暂时不可用，当前保留示例统计卡片。",
    );
  }

  stats.value = mapStats(
    articlesResult.status === "fulfilled" ? articlesResult.value.stats : null,
    analyticsResult.status === "fulfilled" ? analyticsResult.value : null,
  );
  fallbackNotice.value = notices.join("；");
  loading.value = false;
}

async function handleArchive(id: string): Promise<void> {
  archiveBusyId.value = id;
  actionNotice.value = "";

  try {
    await archiveCmsArticle(id);
    await loadDashboard();
    actionNotice.value = "文章已归档。";
  } catch (error) {
    actionNotice.value = isApiError(error) ? error.message : "归档失败，请稍后重试。";
  } finally {
    archiveBusyId.value = null;
  }
}

onMounted(() => {
  void loadDashboard();
});

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatAnalyticsDayLabel(value: string): string {
  const [, month = "", day = ""] = value.split("-");
  return `${month}.${day}`;
}
</script>

<template>
  <CmsShell title="概览" subtitle="欢迎回来，这里是你的博客统计与最近更新。">
    <p v-if="fallbackNotice" class="notice">
      {{ fallbackNotice }}
    </p>
    <p v-else-if="actionNotice" class="notice">
      {{ actionNotice }}
    </p>

    <section class="stats-grid" :class="{ dimmed: loading }">
      <StatCard v-for="stat in stats" :key="stat.key" :stat="stat" />
    </section>

    <section v-if="analyticsSummary" class="analytics-section" :class="{ dimmed: loading }">
      <div class="section-header">
        <div>
          <h2>访问分析</h2>
          <p class="section-note">最近 7 天累计 {{ formatCount(analyticsSummary.last7DaysViews) }} 次浏览</p>
        </div>
      </div>

      <div class="analytics-grid">
        <div class="analytics-panel">
          <div class="analytics-panel-header">
            <h3>最近 7 天</h3>
            <span>按天聚合</span>
          </div>
          <ol class="trend-list">
            <li v-for="point in analyticsSummary.dailyViews" :key="point.date" class="trend-item">
              <span class="trend-label">{{ formatAnalyticsDayLabel(point.date) }}</span>
              <div class="trend-bar-track">
                <span
                  class="trend-bar-fill"
                  :style="{ width: `${Math.max((point.views / analyticsMaxViews) * 100, point.views ? 12 : 0)}%` }"
                />
              </div>
              <strong class="trend-value">{{ formatCount(point.views) }}</strong>
            </li>
          </ol>
        </div>

        <div class="analytics-panel">
          <div class="analytics-panel-header">
            <h3>热门文章</h3>
            <span>近 7 日</span>
          </div>
          <ol v-if="analyticsSummary.popularArticles.length" class="popular-list">
            <li
              v-for="article in analyticsSummary.popularArticles"
              :key="article.articleId"
              class="popular-item"
            >
              <div class="popular-copy">
                <div>
                  <strong>{{ article.title }}</strong>
                  <span>{{ article.slug }}</span>
                </div>
              </div>
              <strong class="popular-value">{{ formatCount(article.views) }}</strong>
            </li>
          </ol>
          <p v-else class="empty-note">近 7 日还没有文章浏览数据。</p>
        </div>
      </div>
    </section>

    <section class="recent-section">
      <div class="section-header">
        <div>
          <h2>最近文章</h2>
          <p v-if="loading" class="section-note">正在读取最新文章数据…</p>
        </div>
        <div class="section-actions">
          <RouterLink class="secondary-action" to="/cms/comments">评论管理</RouterLink>
          <RouterLink class="secondary-action" to="/cms/analytics">访问分析</RouterLink>
          <RouterLink class="secondary-action" to="/cms/settings">站点设置</RouterLink>
          <RouterLink class="secondary-action" to="/cms/storage">对象存储</RouterLink>
          <RouterLink class="primary-action" to="/cms/articles/new">新建文章</RouterLink>
        </div>
      </div>
      <ArticlesTable :articles="articles" :archive-disabled="archiveDisabled" @archive="handleArchive" />
    </section>
  </CmsShell>
</template>

<style scoped>
.notice {
  margin-bottom: var(--space-4);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 13px;
}
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6); }
.stats-grid.dimmed { opacity: 0.8; }
.analytics-section { display: grid; gap: var(--space-3); margin-bottom: var(--space-6); }
.analytics-section.dimmed { opacity: 0.8; }
.analytics-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
.analytics-panel {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
}
.analytics-panel-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}
.analytics-panel-header h3 {
  margin: 0;
  font-size: 18px;
}
.analytics-panel-header span,
.empty-note,
.popular-copy span,
.trend-label {
  color: var(--text-secondary);
  font-size: 13px;
}
.trend-list,
.popular-list {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.trend-item,
.popular-item {
  display: grid;
  align-items: center;
  gap: var(--space-3);
}
.trend-item {
  grid-template-columns: 56px minmax(0, 1fr) auto;
}
.trend-bar-track {
  overflow: hidden;
  height: 8px;
  border-radius: 999px;
  background: var(--bg);
}
.trend-bar-fill {
  display: block;
  height: 100%;
  min-width: 0;
  border-radius: inherit;
  background: var(--accent);
}
.trend-value,
.popular-value {
  font-size: 14px;
}
.popular-item {
  grid-template-columns: minmax(0, 1fr) auto;
}
.popular-copy {
  display: flex;
  align-items: center;
  min-width: 0;
}
.popular-copy div {
  display: grid;
  min-width: 0;
}
.popular-copy strong,
.popular-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recent-section { display: grid; gap: var(--space-3); }
.section-header { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
.section-note { margin-top: 6px; color: var(--text-tertiary); font-size: 13px; }
h2 { font-family: var(--font-heading); font-size: 28px; font-weight: 400; }
.section-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; justify-content: flex-end; }
.primary-action,
.secondary-action {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px 14px;
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}
.primary-action { background: var(--accent); color: var(--bg); border-color: var(--accent); }
.primary-action:hover { background: var(--accent-hover); border-color: var(--accent-hover); transform: translateY(-1px); }
.secondary-action { color: var(--text-secondary); background: var(--bg-elevated); }
.secondary-action:hover { color: var(--text-primary); border-color: var(--accent); transform: translateY(-1px); }
@media (max-width: 640px) {
  .analytics-grid { grid-template-columns: 1fr; }
  .trend-item { grid-template-columns: 48px minmax(0, 1fr) auto; }
  .section-header { align-items: flex-start; flex-direction: column; }
  .section-actions { justify-content: flex-start; }
}
</style>
