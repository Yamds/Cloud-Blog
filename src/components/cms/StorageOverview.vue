<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "@/i18n/useI18n";
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

const { locale, t } = useI18n();
const localeTag = computed(() => (locale.value === "zh" ? "zh-CN" : "en-US"));

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

function formatCount(value: number): string {
  return new Intl.NumberFormat(localeTag.value).format(value);
}

const cards = computed(() => [
  {
    key: "total",
    label: t("cms.storage.overview.totalObjects"),
    icon: "ph:stack",
    value: formatCount(props.summary.totalObjects),
    change: t("cms.storage.overview.totalObjectsChange", { count: props.summary.updatedRecentlyCount }),
  },
  {
    key: "images",
    label: t("cms.storage.overview.images"),
    icon: "ph:image-square",
    value: formatCount(props.summary.imageCount),
    change: t("cms.storage.overview.imagesChange", { count: props.summary.processingCount }),
  },
  {
    key: "attachments",
    label: t("cms.storage.overview.attachments"),
    icon: "ph:paperclip",
    value: formatCount(props.summary.attachmentCount),
    change: t("cms.storage.overview.attachmentsChange", { count: props.summary.orphanedCount }),
  },
  {
    key: "capacity",
    label: t("cms.storage.overview.capacity"),
    icon: "ph:database",
    value: formatBytes(props.summary.totalBytes),
    change: t("cms.storage.overview.capacityChange", { count: props.summary.linkedCount }),
  },
  {
    key: "linked",
    label: t("cms.storage.overview.linked"),
    icon: "ph:link-simple",
    value: formatCount(props.summary.linkedCount),
    change: t("cms.storage.overview.linkedChange", { count: props.summary.orphanedCount }),
  },
]);

const filteredHint = computed(() => {
  if (props.visibleCount === undefined || props.visibleBytes === undefined) {
    return "";
  }

  if (props.visibleCount === props.summary.totalObjects) {
    return t("cms.storage.overview.filteredAll", { size: formatBytes(props.visibleBytes) });
  }

  return t("cms.storage.overview.filteredPartial", {
    count: props.visibleCount,
    size: formatBytes(props.visibleBytes),
  });
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
