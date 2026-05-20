<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { archiveCmsArticle, deleteCmsArticle, getCmsArticles } from "@/api/cms";
import { getCmsAnalyticsSummary } from "@/api/analytics";
import { isApiError } from "@/api/http";
import { useI18n } from "@/i18n/useI18n";
import ArticlesTable from "@/components/cms/ArticlesTable.vue";
import CmsShell from "@/components/cms/CmsShell.vue";
import StatCard from "@/components/cms/StatCard.vue";
import type { CmsAnalyticsSummary, CmsArticleDetail, CmsArticleRow, CmsArticleStats, CmsStatItem } from "@/types/cms";
import { formatShanghaiDate } from "@/utils/date";

const { t } = useI18n();
const articles = ref<CmsArticleRow[]>([]);
const stats = ref<CmsStatItem[]>(createEmptyStats());
const analyticsSummary = ref<CmsAnalyticsSummary | null>(null);
const loading = ref(true);
const archiveBusyId = ref<string | null>(null);
const deleteBusyId = ref<string | null>(null);
const fallbackNotice = ref("");
const actionNotice = ref("");

const archiveDisabled = computed(() => loading.value || Boolean(archiveBusyId.value) || Boolean(deleteBusyId.value));
const deleteDisabled = computed(() => loading.value || Boolean(archiveBusyId.value) || Boolean(deleteBusyId.value));
const analyticsMaxViews = computed(() =>
  Math.max(...(analyticsSummary.value?.dailyViews.map((item) => item.views) ?? [0]), 1),
);

function mapArticleRow(article: CmsArticleDetail): CmsArticleRow {
  return {
    id: article.id,
    iconName: article.iconName || "ph:article",
    title: article.title || t("cms.dashboard.articleUntitled"),
    date: formatShanghaiDate(article.updatedAt || article.createdAt || article.publishedAt),
    status: article.status,
    language: article.language,
    slug: article.slug,
  };
}

function mapStats(source: CmsArticleStats | null, summary: CmsAnalyticsSummary | null): CmsStatItem[] {
  return [
    {
      key: "articles",
      label: t("cms.dashboard.stats.articlesLabel"),
      icon: "ph:article",
      value: source ? formatCount(source.total) : "0",
      change: source ? t("cms.dashboard.stats.articlesChange", { count: formatCount(source.published) }) : t("cms.dashboard.syncPending"),
      positive: source ? source.published > 0 : false,
    },
    {
      key: "views",
      label: t("cms.dashboard.stats.viewsLabel"),
      icon: "ph:eye",
      value: summary ? formatCount(summary.totalViews) : "0",
      change: summary ? t("cms.dashboard.stats.viewsChange", { count: formatCount(summary.todayViews) }) : t("cms.dashboard.syncPending"),
      positive: summary ? summary.todayViews > 0 : false,
    },
    {
      key: "drafts",
      label: t("cms.dashboard.stats.draftsLabel"),
      icon: "ph:file-dashed",
      value: source ? formatCount(source.draft) : "0",
      change: source ? t("cms.dashboard.stats.draftsChange", { count: formatCount(source.archived) }) : t("cms.dashboard.syncPending"),
    },
    {
      key: "tags",
      label: t("cms.dashboard.stats.tagsLabel"),
      icon: "ph:tag",
      value: source ? formatCount(source.tags) : "0",
      change: summary ? t("cms.dashboard.stats.tagsChange", { count: formatCount(summary.last7DaysViews) }) : t("cms.dashboard.syncPending"),
      positive: summary ? summary.last7DaysViews > 0 : false,
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
    articles.value = [];
    notices.push(
      isApiError(articlesResult.reason)
        ? t("cms.dashboard.noticeArticlesUnavailable", { message: articlesResult.reason.message })
        : t("cms.dashboard.noticeArticlesUnavailablePlain"),
    );
  }

  if (analyticsResult.status === "fulfilled") {
    analyticsSummary.value = analyticsResult.value;
  } else {
    notices.push(
      isApiError(analyticsResult.reason)
        ? t("cms.dashboard.noticeAnalyticsUnavailable", { message: analyticsResult.reason.message })
        : t("cms.dashboard.noticeAnalyticsUnavailablePlain"),
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
    actionNotice.value = t("cms.dashboard.actionArchived");
  } catch (error) {
    actionNotice.value = isApiError(error) ? error.message : t("cms.dashboard.actionArchiveFailed");
  } finally {
    archiveBusyId.value = null;
  }
}

async function handleDelete(article: CmsArticleRow): Promise<void> {
  const confirmed = window.confirm(t("cms.dashboard.actionDeleteConfirm", { title: article.title }));

  if (!confirmed) {
    return;
  }

  deleteBusyId.value = article.id;
  actionNotice.value = "";

  try {
    await deleteCmsArticle(article.id);
    await loadDashboard();
    actionNotice.value = t("cms.dashboard.actionDeleted");
  } catch (error) {
    actionNotice.value = isApiError(error) ? error.message : t("cms.dashboard.actionDeleteFailed");
  } finally {
    deleteBusyId.value = null;
  }
}

onMounted(() => {
  void loadDashboard();
});

function formatCount(value: number): string {
  return new Intl.NumberFormat(undefined).format(value);
}

function createEmptyStats(): CmsStatItem[] {
  return mapStats(null, null);
}

function formatAnalyticsDayLabel(value: string): string {
  const [, month = "", day = ""] = value.split("-");
  return `${month}.${day}`;
}
</script>

<template>
  <CmsShell :title="t('cms.dashboard.title')" :subtitle="t('cms.dashboard.subtitle')">
    <div v-if="loading" class="loading-overlay" aria-live="polite" :aria-label="t('cms.dashboard.loadingLabel')">
      <span class="loading-spinner" aria-hidden="true" />
    </div>

    <p v-if="fallbackNotice" class="notice">
      {{ fallbackNotice }}
    </p>
    <p v-else-if="actionNotice" class="notice">
      {{ actionNotice }}
    </p>

    <section v-if="!loading" class="stats-grid">
      <StatCard v-for="stat in stats" :key="stat.key" :stat="stat" />
    </section>

    <section v-if="!loading && analyticsSummary" class="analytics-section">
      <div class="section-header">
        <div>
          <h2>{{ t("cms.dashboard.analyticsTitle") }}</h2>
          <p class="section-note">{{ t("cms.dashboard.analyticsSummary", { count: formatCount(analyticsSummary.last7DaysViews) }) }}</p>
        </div>
      </div>

      <div class="analytics-grid">
        <div class="analytics-panel">
          <div class="analytics-panel-header">
            <h3>{{ t("cms.dashboard.analyticsTrendTitle") }}</h3>
            <span>{{ t("cms.dashboard.analyticsTrendMeta") }}</span>
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
            <h3>{{ t("cms.dashboard.analyticsPopularTitle") }}</h3>
            <span>{{ t("cms.dashboard.analyticsPopularMeta") }}</span>
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
          <p v-else class="empty-note">{{ t("cms.dashboard.analyticsPopularEmpty") }}</p>
        </div>
      </div>
    </section>

    <section v-if="!loading" class="recent-section">
      <div class="section-header">
        <div>
          <h2>{{ t("cms.dashboard.recentTitle") }}</h2>
          <p v-if="articles.length === 0" class="section-note">{{ t("cms.dashboard.recentEmpty") }}</p>
        </div>
        <div class="section-actions">
          <RouterLink class="secondary-action" to="/cms/articles">{{ t("cms.dashboard.linkAllArticles") }}</RouterLink>
          <RouterLink class="secondary-action" to="/cms/comments">{{ t("cms.dashboard.linkComments") }}</RouterLink>
          <RouterLink class="secondary-action" to="/cms/analytics">{{ t("cms.dashboard.linkAnalytics") }}</RouterLink>
          <RouterLink class="secondary-action" to="/cms/settings">{{ t("cms.dashboard.linkSettings") }}</RouterLink>
          <RouterLink class="secondary-action" to="/cms/storage">{{ t("cms.dashboard.linkStorage") }}</RouterLink>
          <RouterLink class="primary-action" to="/cms/articles/new">{{ t("cms.dashboard.linkNewArticle") }}</RouterLink>
        </div>
      </div>
      <ArticlesTable
        :articles="articles"
        :archive-disabled="archiveDisabled"
        :delete-disabled="deleteDisabled"
        @archive="handleArchive"
        @delete="handleDelete"
      />
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
.loading-overlay {
  min-height: 360px;
  display: grid;
  place-items: center;
}
.loading-spinner {
  width: 34px;
  height: 34px;
  border: 2px solid var(--border-subtle);
  border-top-color: var(--accent);
  border-radius: 999px;
  animation: loading-spin 0.8s linear infinite;
}
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6); }
.analytics-section { display: grid; gap: var(--space-3); margin-bottom: var(--space-6); }
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
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 6px 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  transition: color var(--transition-fast);
}
.primary-action::after,
.secondary-action::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 2px;
  height: 1px;
  background: currentColor;
  opacity: 0;
  transform: scaleX(0);
  transform-origin: right center;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}
.primary-action:hover,
.primary-action:focus-visible,
.secondary-action:hover,
.secondary-action:focus-visible {
  color: var(--accent);
}
.primary-action:hover::after,
.primary-action:focus-visible::after,
.secondary-action:hover::after,
.secondary-action:focus-visible::after {
  opacity: 1;
  transform: scaleX(1);
  transform-origin: left center;
}
.primary-action:focus-visible,
.secondary-action:focus-visible {
  outline: none;
}
@keyframes loading-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 640px) {
  .analytics-grid { grid-template-columns: 1fr; }
  .trend-item { grid-template-columns: 48px minmax(0, 1fr) auto; }
  .section-header { align-items: flex-start; flex-direction: column; }
  .section-actions { justify-content: flex-start; }
}
</style>
