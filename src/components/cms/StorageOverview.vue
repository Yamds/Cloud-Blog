<script setup lang="ts">
import { computed } from "vue";
import IconifyIcon from "@/components/common/IconifyIcon.vue";
import type { CmsStorageSummary } from "@/types/cms";

const props = withDefaults(
  defineProps<{
    summary: CmsStorageSummary;
    visibleCount?: number;
    visibleBytes?: number;
  }>(),
  {
    visibleCount: undefined,
    visibleBytes: undefined,
  },
);

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

const cards = computed(() => [
  {
    key: "total",
    label: "总对象数",
    icon: "ph:stack",
    value: props.summary.totalObjects.toString(),
    change: `${props.summary.updatedRecentlyCount} 个最近 7 天更新`,
  },
  {
    key: "images",
    label: "图片数",
    icon: "ph:image-square",
    value: props.summary.imageCount.toString(),
    change: `${props.summary.processingCount} 个处理中`,
  },
  {
    key: "attachments",
    label: "附件数",
    icon: "ph:paperclip",
    value: props.summary.attachmentCount.toString(),
    change: `${props.summary.orphanedCount} 个待整理对象`,
  },
  {
    key: "capacity",
    label: "总容量",
    icon: "ph:database",
    value: formatBytes(props.summary.totalBytes),
    change: `${props.summary.linkedCount} 个对象已关联文章`,
  },
  {
    key: "linked",
    label: "已关联对象",
    icon: "ph:link-simple",
    value: props.summary.linkedCount.toString(),
    change: `${props.summary.orphanedCount} 个对象待整理`,
  },
]);

const filteredHint = computed(() => {
  if (props.visibleCount === undefined || props.visibleBytes === undefined) {
    return "";
  }

  if (props.visibleCount === props.summary.totalObjects) {
    return `当前显示全部对象，合计 ${formatBytes(props.visibleBytes)}。`;
  }

  return `当前筛选命中 ${props.visibleCount} 个对象，合计 ${formatBytes(props.visibleBytes)}。`;
});
</script>

<template>
  <section class="overview">
    <div class="stats-grid">
      <article v-for="card in cards" :key="card.key" class="stat-card">
        <div class="stat-header">
          <span class="stat-label">{{ card.label }}</span>
          <IconifyIcon :icon="card.icon" :size="22" />
        </div>
        <p class="stat-value">{{ card.value }}</p>
        <p class="stat-change">{{ card.change }}</p>
      </article>
    </div>

    <p v-if="filteredHint" class="filtered-hint">{{ filteredHint }}</p>
  </section>
</template>

<style scoped>
.overview {
  margin-bottom: var(--space-6);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4);
}

.stat-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  transition: border-color var(--transition-fast), transform var(--transition-fast);
}

.stat-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
  color: var(--accent);
}

.stat-label {
  color: var(--text-tertiary);
  font-size: 13px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.stat-value {
  font-family: var(--font-heading);
  font-size: clamp(34px, 5vw, 46px);
  line-height: 1;
  margin-bottom: var(--space-1);
}

.stat-change {
  color: var(--text-secondary);
  font-size: 13px;
}

.filtered-hint {
  margin-top: var(--space-3);
  color: var(--text-tertiary);
  font-size: 13px;
}
</style>
