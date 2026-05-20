<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

import { archiveCmsArticle, deleteCmsArticle, getCmsArticles } from "@/api/cms";
import { isApiError } from "@/api/http";
import ArticlesTable from "@/components/cms/ArticlesTable.vue";
import CmsShell from "@/components/cms/CmsShell.vue";
import { useI18n } from "@/i18n/useI18n";
import type { CmsArticleDetail, CmsArticleRow, CmsArticleStatus } from "@/types/cms";
import { formatShanghaiDate } from "@/utils/date";

const { t } = useI18n();

const articles = ref<CmsArticleRow[]>([]);
const loading = ref(true);
const loadError = ref("");
const actionNotice = ref("");
const archiveBusyId = ref<string | null>(null);
const deleteBusyId = ref<string | null>(null);
const query = ref("");
const statusFilter = ref<CmsArticleStatus | "all">("all");

const archiveDisabled = computed(() => loading.value || Boolean(archiveBusyId.value) || Boolean(deleteBusyId.value));
const deleteDisabled = computed(() => loading.value || Boolean(archiveBusyId.value) || Boolean(deleteBusyId.value));

const filteredArticles = computed(() => {
  const normalizedQuery = query.value.trim().toLocaleLowerCase();

  return articles.value.filter((article) => {
    const matchesStatus = statusFilter.value === "all" || article.status === statusFilter.value;
    const matchesQuery =
      !normalizedQuery ||
      [article.title, article.slug ?? "", article.language ?? "", ...(article.tags ?? [])]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);

    return matchesStatus && matchesQuery;
  });
});

function mapArticleRow(article: CmsArticleDetail): CmsArticleRow {
  return {
    id: article.id,
    iconName: article.iconName || "ph:article",
    title: article.title || t("cms.dashboard.articleUntitled"),
    date: formatShanghaiDate(article.updatedAt || article.createdAt || article.publishedAt || ""),
    status: article.status,
    language: article.language,
    slug: article.slug,
    tags: article.tags,
  };
}

async function loadArticles(): Promise<void> {
  loading.value = true;
  loadError.value = "";

  try {
    const response = await getCmsArticles();
    articles.value = [...response.articles]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(mapArticleRow);
  } catch (error) {
    articles.value = [];
    loadError.value = isApiError(error) ? error.message : t("cms.articles.loadFailed");
  } finally {
    loading.value = false;
  }
}

async function handleArchive(id: string): Promise<void> {
  archiveBusyId.value = id;
  actionNotice.value = "";

  try {
    await archiveCmsArticle(id);
    await loadArticles();
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
    await loadArticles();
    actionNotice.value = t("cms.dashboard.actionDeleted");
  } catch (error) {
    actionNotice.value = isApiError(error) ? error.message : t("cms.dashboard.actionDeleteFailed");
  } finally {
    deleteBusyId.value = null;
  }
}

onMounted(() => {
  void loadArticles();
});
</script>

<template>
  <CmsShell :title="t('cms.articles.title')" :subtitle="t('cms.articles.subtitle')">
    <div class="toolbar">
      <label class="field search-field">
        <span>{{ t("cms.shared.search") }}</span>
        <input v-model="query" type="search" :placeholder="t('cms.articles.searchPlaceholder')" />
      </label>

      <label class="field status-field">
        <span>{{ t("cms.shared.status") }}</span>
        <select v-model="statusFilter">
          <option value="all">{{ t("cms.shared.allStatuses") }}</option>
          <option value="published">{{ t("cms.articlesTable.published") }}</option>
          <option value="draft">{{ t("cms.articlesTable.draft") }}</option>
          <option value="archived">{{ t("cms.articlesTable.archived") }}</option>
        </select>
      </label>

      <RouterLink class="text-action" to="/cms/articles/new">{{ t("cms.dashboard.linkNewArticle") }}</RouterLink>
    </div>

    <p v-if="loadError" class="notice notice-error">{{ loadError }}</p>
    <p v-else-if="actionNotice" class="notice">{{ actionNotice }}</p>

    <p v-if="loading" class="status-copy" aria-live="polite">{{ t("cms.shared.loading") }}...</p>
    <template v-else>
      <p class="result-copy">{{ t("cms.articles.resultCount", { visible: filteredArticles.length, total: articles.length }) }}</p>
      <ArticlesTable
        :articles="filteredArticles"
        :archive-disabled="archiveDisabled"
        :delete-disabled="deleteDisabled"
        @archive="handleArchive"
        @delete="handleDelete"
      />
    </template>
  </CmsShell>
</template>

<style scoped>
.toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(160px, 220px) auto;
  align-items: end;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.field {
  display: grid;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 13px;
}

.field input,
.field select {
  width: 100%;
  min-height: 38px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-primary);
  padding: 0 var(--space-3);
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: color-mix(in oklch, var(--accent) 46%, var(--border-subtle));
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent) 14%, transparent);
}

.notice {
  margin-bottom: var(--space-4);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 13px;
}

.notice-error {
  color: color-mix(in oklch, var(--accent) 72%, var(--text-secondary));
}

.status-copy,
.result-copy {
  margin-bottom: var(--space-3);
  color: var(--text-secondary);
  font-size: 14px;
}

.text-action {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 6px 0;
  color: var(--text-secondary);
  transition: color var(--transition-fast);
}

.text-action::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 4px;
  height: 1px;
  background: currentColor;
  opacity: 0;
  transform: scaleX(0);
  transform-origin: right center;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.text-action:hover,
.text-action:focus-visible {
  color: var(--accent);
}

.text-action:hover::after,
.text-action:focus-visible::after {
  opacity: 1;
  transform: scaleX(1);
  transform-origin: left center;
}

.text-action:focus-visible {
  outline: none;
}

@media (max-width: 720px) {
  .toolbar {
    grid-template-columns: 1fr;
  }
}
</style>
