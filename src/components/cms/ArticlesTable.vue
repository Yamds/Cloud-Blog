<script setup lang="ts">
import { RouterLink } from "vue-router";
import IconifyIcon from "@/components/common/IconifyIcon.vue";
import type { CmsArticleRow } from "@/types/cms";

defineProps<{
  articles: CmsArticleRow[];
  archiveDisabled?: boolean;
}>();

defineEmits<{
  archive: [id: string];
}>();

const statusMap = {
  published: { label: "已发布", icon: "ph:check-circle" },
  draft: { label: "草稿", icon: "ph:file-dashed" },
  archived: { label: "已归档", icon: "ph:archive" },
} as const;
</script>

<template>
  <div class="table-wrap">
    <div class="table-head">
      <span>图标</span>
      <span>标题</span>
      <span>日期</span>
      <span>状态</span>
      <span>操作</span>
    </div>
    <div v-for="article in articles" :key="article.id" class="table-row">
      <IconifyIcon :icon="article.iconName" :size="30" />
      <p class="title">{{ article.title }}</p>
      <time>{{ article.date }}</time>
      <span class="status" :class="article.status">
        <IconifyIcon :icon="statusMap[article.status].icon" :size="14" />
        {{ statusMap[article.status].label }}
      </span>
      <div class="actions">
        <RouterLink :to="`/cms/articles/${article.id}`" class="action-btn" title="编辑" aria-label="编辑">
          <IconifyIcon icon="ph:pencil-simple" />
        </RouterLink>
        <button
          type="button"
          class="action-btn"
          title="归档"
          aria-label="归档"
          :disabled="archiveDisabled || article.status === 'archived'"
          @click="$emit('archive', article.id)"
        >
          <IconifyIcon icon="ph:archive" />
        </button>
      </div>
    </div>
    <p v-if="articles.length === 0" class="empty-row">暂无文章。</p>
  </div>
</template>

<style scoped>
.table-wrap { background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); overflow: hidden; }
.table-head,.table-row { display: grid; grid-template-columns: 64px 1fr 120px 120px 96px; gap: var(--space-2); align-items: center; padding: var(--space-3) var(--space-4); }
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
.action-btn:disabled { cursor: not-allowed; opacity: 0.5; }
@media (max-width: 1024px) {
  .table-head,.table-row { grid-template-columns: 56px 1fr 120px; }
  .table-head span:nth-child(4),.table-head span:nth-child(5),.table-row > :nth-child(4),.table-row > :nth-child(5) { display: none; }
}
</style>
