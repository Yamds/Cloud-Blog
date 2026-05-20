<script setup lang="ts">
import { RouterLink } from "vue-router";
import { useI18n } from "@/i18n/useI18n";
import IconifyIcon from "@/components/common/IconifyIcon.vue";
import type { CmsArticleRow } from "@/types/cms";

defineProps<{
  articles: CmsArticleRow[];
  archiveDisabled?: boolean;
  deleteDisabled?: boolean;
}>();

defineEmits<{
  archive: [id: string];
  delete: [article: CmsArticleRow];
}>();

const { t } = useI18n();

const statusMap = {
  published: { label: "cms.articlesTable.published", icon: "ph:check-circle" },
  draft: { label: "cms.articlesTable.draft", icon: "ph:file-dashed" },
  archived: { label: "cms.articlesTable.archived", icon: "ph:archive" },
} as const;
</script>

<template>
  <div class="table-wrap">
    <div class="table-head">
      <span>{{ t("cms.shared.icon") }}</span>
      <span>{{ t("cms.shared.title") }}</span>
      <span>{{ t("cms.shared.date") }}</span>
      <span>{{ t("cms.shared.status") }}</span>
      <span>{{ t("cms.shared.actions") }}</span>
    </div>
    <div v-for="article in articles" :key="article.id" class="table-row">
      <IconifyIcon :icon="article.iconName" :size="30" />
      <p class="title">{{ article.title }}</p>
      <time>{{ article.date }}</time>
      <span class="status" :class="article.status">
        <IconifyIcon :icon="statusMap[article.status].icon" :size="14" />
        {{ t(statusMap[article.status].label) }}
      </span>
      <div class="actions">
        <RouterLink
          :to="`/cms/articles/${article.id}`"
          class="action-btn"
          :title="t('cms.shared.edit')"
          :aria-label="t('cms.shared.edit')"
        >
          <IconifyIcon icon="ph:pencil-simple" />
        </RouterLink>
        <button
          type="button"
          class="action-btn"
          :title="t('cms.shared.archive')"
          :aria-label="t('cms.shared.archive')"
          :disabled="archiveDisabled || article.status === 'archived'"
          @click="$emit('archive', article.id)"
        >
          <IconifyIcon icon="ph:archive" />
        </button>
        <button
          type="button"
          class="action-btn danger"
          :title="t('cms.shared.delete')"
          :aria-label="t('cms.shared.delete')"
          :disabled="deleteDisabled"
          @click="$emit('delete', article)"
        >
          <IconifyIcon icon="ph:trash" />
        </button>
      </div>
    </div>
    <p v-if="articles.length === 0" class="empty-row">{{ t("cms.articlesTable.empty") }}</p>
  </div>
</template>

<style scoped>
.table-wrap { background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); overflow: hidden; }
.table-head,.table-row { display: grid; grid-template-columns: 64px 1fr 120px 120px 136px; gap: var(--space-2); align-items: center; padding: var(--space-3) var(--space-4); }
.table-head { font-size: 13px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--border-subtle); }
.table-row { border-bottom: 1px solid var(--border-subtle); }
.table-row:last-child { border-bottom: 0; }
.table-row:hover { background: var(--bg); }
.empty-row { padding: var(--space-4); color: var(--text-secondary); text-align: center; }
.title { font-size: 16px; }
time { color: var(--text-secondary); font-family: var(--font-heading); }
.status { display: inline-flex; align-items: center; gap: 6px; width: fit-content; padding: 4px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 12px; color: var(--text-tertiary); }
.status.published { color: var(--accent); border-color: var(--accent); }
.actions { display: flex; gap: 8px; }
.action-btn { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--border); border-radius: var(--radius-sm); }
.action-btn.danger:hover:not(:disabled),
.action-btn.danger:focus-visible:not(:disabled) { color: var(--accent); border-color: color-mix(in oklab, var(--accent) 48%, var(--border)); }
.action-btn:disabled { cursor: not-allowed; opacity: 0.5; }
@media (max-width: 1024px) {
  .table-head,.table-row { grid-template-columns: 56px 1fr 120px; }
  .table-head span:nth-child(4),.table-head span:nth-child(5),.table-row > :nth-child(4),.table-row > :nth-child(5) { display: none; }
}
</style>
