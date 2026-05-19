<script setup lang="ts">
import IconifyIcon from "@/components/common/IconifyIcon.vue";
import type { CmsStorageObject, CmsStorageViewMode } from "@/types/cms";
import { formatShanghaiDateTime } from "@/utils/date";

defineProps<{
  objects: CmsStorageObject[];
  viewMode: CmsStorageViewMode;
}>();

const emit = defineEmits<{
  preview: [item: CmsStorageObject];
  copy: [item: CmsStorageObject];
  remove: [item: CmsStorageObject];
}>();

const statusMap = {
  ready: { label: "可用", icon: "ph:check-circle", tone: "ready" },
  processing: { label: "处理中", icon: "ph:spinner-gap", tone: "processing" },
  orphaned: { label: "待整理", icon: "ph:warning-circle", tone: "orphaned" },
  error: { label: "异常", icon: "ph:warning-octagon", tone: "error" },
} as const;

const articleStatusMap = {
  published: { label: "已发布", tone: "published" },
  draft: { label: "草稿", tone: "draft" },
  archived: { label: "归档", tone: "archived" },
} as const;

const typeMap = {
  image: { label: "图片", icon: "ph:image-square" },
  attachment: { label: "附件", icon: "ph:paperclip" },
} as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

function resolveFileIcon(item: CmsStorageObject): string {
  if (item.type === "image") {
    return "ph:image-square";
  }

  if (item.mime.includes("pdf")) return "ph:file-pdf";
  if (item.mime.includes("word")) return "ph:file-doc";
  if (item.mime.includes("markdown")) return "ph:file-text";
  if (item.mime.startsWith("text/")) return "ph:file-txt";

  return "ph:file";
}
</script>

<template>
  <section class="objects-card">
    <div v-if="objects.length === 0" class="empty-state">
      <IconifyIcon icon="ph:folder-open" :size="28" />
      <p>当前筛选下没有对象，试试放宽条件或加入新的文件。</p>
    </div>

    <div v-else-if="viewMode === 'table'" class="table-wrap">
      <div class="table-head">
        <span>预览</span>
        <span>Object Key</span>
        <span>类型 / 状态</span>
        <span>大小</span>
        <span>关联文章</span>
        <span>更新时间</span>
        <span>操作</span>
      </div>

      <article v-for="item in objects" :key="item.id" class="table-row">
        <div class="preview-cell">
          <img
            v-if="item.type === 'image' && item.previewUrl"
            :src="item.previewUrl"
            :alt="item.key"
            class="preview-image"
            loading="lazy"
          />
          <span v-else class="preview-fallback">
            <IconifyIcon :icon="resolveFileIcon(item)" :size="20" />
          </span>
        </div>

        <div class="key-cell">
          <p class="object-key">{{ item.key }}</p>
          <p class="object-meta">{{ item.mime }}</p>
        </div>

        <div class="type-cell">
          <span class="pill">
            <IconifyIcon :icon="typeMap[item.type].icon" :size="14" />
            {{ typeMap[item.type].label }}
          </span>
          <span class="pill status-pill" :class="statusMap[item.status].tone">
            <IconifyIcon :icon="statusMap[item.status].icon" :size="14" />
            {{ statusMap[item.status].label }}
          </span>
        </div>

        <p class="mono">{{ formatBytes(item.sizeBytes) }}</p>

        <div class="article-cell">
          <template v-if="item.relatedArticle">
            <p class="article-title">{{ item.relatedArticle.articleTitle }}</p>
            <span class="relation-badge" :class="articleStatusMap[item.relatedArticle.articleStatus].tone">
              {{ articleStatusMap[item.relatedArticle.articleStatus].label }}
            </span>
          </template>
          <p v-else class="article-empty">暂未关联</p>
        </div>

        <time class="mono" :datetime="item.updatedAt">{{ formatShanghaiDateTime(item.updatedAt) }}</time>

        <div class="actions">
          <button type="button" title="预览对象" @click="emit('preview', item)">
            <IconifyIcon icon="ph:eye" :size="16" />
          </button>
          <button type="button" title="复制 object key" @click="emit('copy', item)">
            <IconifyIcon icon="ph:copy" :size="16" />
          </button>
          <button type="button" title="从当前会话移除" @click="emit('remove', item)">
            <IconifyIcon icon="ph:trash" :size="16" />
          </button>
        </div>
      </article>
    </div>

    <div v-else class="grid-wrap">
      <article v-for="item in objects" :key="item.id" class="storage-card">
        <div class="card-preview">
          <img
            v-if="item.type === 'image' && item.previewUrl"
            :src="item.previewUrl"
            :alt="item.key"
            class="card-image"
            loading="lazy"
          />
          <span v-else class="preview-fallback large">
            <IconifyIcon :icon="resolveFileIcon(item)" :size="24" />
          </span>
        </div>

        <div class="card-meta">
          <div class="card-tags">
            <span class="pill">
              <IconifyIcon :icon="typeMap[item.type].icon" :size="14" />
              {{ typeMap[item.type].label }}
            </span>
            <span class="pill status-pill" :class="statusMap[item.status].tone">
              <IconifyIcon :icon="statusMap[item.status].icon" :size="14" />
              {{ statusMap[item.status].label }}
            </span>
          </div>

          <p class="object-key card-key">{{ item.key }}</p>
          <p class="object-meta">{{ item.mime }} · {{ formatBytes(item.sizeBytes) }}</p>
          <p class="article-line">
            {{ item.relatedArticle ? item.relatedArticle.articleTitle : "暂未关联文章" }}
          </p>
          <span
            v-if="item.relatedArticle"
            class="relation-badge"
            :class="articleStatusMap[item.relatedArticle.articleStatus].tone"
          >
            {{ articleStatusMap[item.relatedArticle.articleStatus].label }}
          </span>
          <time class="mono" :datetime="item.updatedAt">{{ formatShanghaiDateTime(item.updatedAt) }}</time>
        </div>

        <div class="actions">
          <button type="button" title="预览对象" @click="emit('preview', item)">
            <IconifyIcon icon="ph:eye" :size="16" />
          </button>
          <button type="button" title="复制 object key" @click="emit('copy', item)">
            <IconifyIcon icon="ph:copy" :size="16" />
          </button>
          <button type="button" title="从当前会话移除" @click="emit('remove', item)">
            <IconifyIcon icon="ph:trash" :size="16" />
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.objects-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.empty-state {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: var(--space-6);
  color: var(--text-tertiary);
  text-align: center;
}

.table-head,
.table-row {
  display: grid;
  grid-template-columns: 92px minmax(220px, 1.9fr) minmax(160px, 1.2fr) 96px minmax(180px, 1.3fr) 130px 110px;
  gap: var(--space-2);
  align-items: center;
  padding: 18px var(--space-3);
}

.table-head {
  font-size: 12px;
  color: var(--text-tertiary);
  letter-spacing: 1px;
  text-transform: uppercase;
  border-bottom: 1px solid var(--border-subtle);
}

.table-row {
  border-bottom: 1px solid var(--border-subtle);
}

.table-row:last-child {
  border-bottom: 0;
}

.table-row:hover {
  background: color-mix(in oklch, var(--bg) 88%, transparent);
}

.preview-cell {
  display: flex;
  align-items: center;
}

.preview-image,
.preview-fallback {
  width: 68px;
  height: 48px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--bg);
  object-fit: cover;
}

.preview-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.preview-fallback.large {
  width: 72px;
  height: 72px;
}

.key-cell,
.article-cell {
  min-width: 0;
}

.object-key {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  word-break: break-all;
}

.object-meta,
.article-empty {
  color: var(--text-tertiary);
  font-size: 12px;
}

.type-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-secondary);
  background: color-mix(in oklch, var(--bg) 84%, transparent);
}

.status-pill.ready {
  color: var(--accent);
  border-color: var(--accent);
}

.status-pill.processing {
  color: color-mix(in oklch, var(--accent) 70%, var(--text-primary));
}

.status-pill.orphaned {
  color: color-mix(in oklch, var(--text-primary) 72%, var(--text-secondary));
}

.status-pill.error {
  color: #f97316;
  border-color: color-mix(in oklch, #f97316 55%, var(--border));
}

.article-title,
.article-line {
  font-size: 14px;
}

.relation-badge {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  margin-top: 6px;
  padding: 2px 8px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.4;
  background: color-mix(in oklch, var(--bg) 88%, transparent);
}

.relation-badge.published {
  color: var(--accent);
  border-color: color-mix(in oklch, var(--accent) 30%, var(--border-subtle));
}

.relation-badge.draft {
  color: color-mix(in oklch, var(--accent) 68%, var(--text-primary));
}

.relation-badge.archived {
  color: var(--text-secondary);
}

.mono {
  font-family: var(--font-heading);
  color: var(--text-secondary);
  font-size: 14px;
}

.actions {
  display: flex;
  gap: 8px;
}

.actions button {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}

.grid-wrap {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-3);
  padding: var(--space-3);
}

.storage-card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: color-mix(in oklch, var(--bg) 88%, transparent);
}

.card-preview {
  min-height: 148px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: var(--bg);
  border: 1px solid var(--border-subtle);
  overflow: hidden;
}

.card-image {
  width: 100%;
  height: 148px;
  object-fit: cover;
}

.card-meta {
  display: grid;
  gap: 8px;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.card-key {
  font-size: 12px;
}

.article-line {
  color: var(--text-secondary);
}

@media (max-width: 1180px) {
  .table-head,
  .table-row {
    grid-template-columns: 84px minmax(220px, 1.8fr) minmax(140px, 1.1fr) 90px minmax(160px, 1fr) 112px 104px;
  }
}

@media (max-width: 940px) {
  .table-head {
    display: none;
  }

  .table-row {
    grid-template-columns: 88px 1fr;
    gap: var(--space-3);
    align-items: flex-start;
  }

  .table-row > :nth-child(3),
  .table-row > :nth-child(4),
  .table-row > :nth-child(5),
  .table-row > :nth-child(6),
  .table-row > :nth-child(7) {
    grid-column: 2;
  }

  .actions {
    margin-top: 4px;
  }
}
</style>
