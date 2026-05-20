<script setup lang="ts">
import { computed } from "vue";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import IconifyIcon from "@/components/common/IconifyIcon.vue";
import type {
  CmsStorageFilters,
  CmsStorageObjectStatus,
  CmsStorageObjectType,
  CmsStorageRelationFilter,
  CmsStorageSortKey,
  CmsStorageViewMode,
} from "@/types/cms";

const props = defineProps<{
  modelValue: CmsStorageFilters;
  totalCount: number;
  visibleCount: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: CmsStorageFilters];
}>();

const { t } = useI18n();

const typeOptions: Array<{ value: CmsStorageObjectType | "all"; label: MessageKey }> = [
  { value: "all", label: "cms.storage.filters.typeAll" },
  { value: "image", label: "cms.storage.filters.typeImage" },
  { value: "attachment", label: "cms.storage.filters.typeAttachment" },
];

const statusOptions: Array<{ value: CmsStorageObjectStatus | "all"; label: MessageKey }> = [
  { value: "all", label: "cms.storage.filters.statusAll" },
  { value: "ready", label: "cms.storage.filters.statusReady" },
  { value: "processing", label: "cms.storage.filters.statusProcessing" },
  { value: "orphaned", label: "cms.storage.filters.statusOrphaned" },
  { value: "error", label: "cms.storage.filters.statusError" },
];

const relationOptions: Array<{ value: CmsStorageRelationFilter; label: MessageKey }> = [
  { value: "all", label: "cms.storage.filters.relationAll" },
  { value: "linked", label: "cms.storage.filters.relationLinked" },
  { value: "unlinked", label: "cms.storage.filters.relationUnlinked" },
];

const sortOptions: Array<{ value: CmsStorageSortKey; label: MessageKey }> = [
  { value: "updatedAt", label: "cms.storage.filters.sortUpdatedAt" },
  { value: "sizeBytes", label: "cms.storage.filters.sortSizeBytes" },
  { value: "key", label: "cms.storage.filters.sortKey" },
];

const viewOptions: Array<{ value: CmsStorageViewMode; icon: string; label: MessageKey }> = [
  { value: "table", icon: "ph:rows", label: "cms.storage.filters.viewTable" },
  { value: "grid", icon: "ph:squares-four", label: "cms.storage.filters.viewGrid" },
];

const hasActiveFilters = computed(
  () =>
    props.modelValue.query.trim() !== "" ||
    props.modelValue.type !== "all" ||
    props.modelValue.status !== "all" ||
    props.modelValue.relation !== "all" ||
    props.modelValue.sortBy !== "updatedAt",
);

function updateModel<K extends keyof CmsStorageFilters>(key: K, value: CmsStorageFilters[K]): void {
  emit("update:modelValue", {
    ...props.modelValue,
    [key]: value,
  });
}

function onQueryInput(event: Event): void {
  updateModel("query", (event.target as HTMLInputElement).value);
}

function onTypeChange(event: Event): void {
  updateModel("type", (event.target as HTMLSelectElement).value as CmsStorageObjectType | "all");
}

function onStatusChange(event: Event): void {
  updateModel("status", (event.target as HTMLSelectElement).value as CmsStorageObjectStatus | "all");
}

function onRelationChange(event: Event): void {
  updateModel("relation", (event.target as HTMLSelectElement).value as CmsStorageRelationFilter);
}

function onSortChange(event: Event): void {
  updateModel("sortBy", (event.target as HTMLSelectElement).value as CmsStorageSortKey);
}

function resetFilters(): void {
  emit("update:modelValue", {
    query: "",
    type: "all",
    status: "all",
    relation: "all",
    sortBy: "updatedAt",
    viewMode: props.modelValue.viewMode,
  });
}
</script>

<template>
  <section class="filters-card">
    <div class="header">
      <div>
        <h2>{{ t("cms.storage.filters.title") }}</h2>
        <p>{{ t("cms.storage.filters.summary", { visible: visibleCount, total: totalCount }) }}</p>
      </div>
      <div class="view-toggle" :aria-label="t('cms.storage.filters.viewToggle')">
        <button
          v-for="option in viewOptions"
          :key="option.value"
          type="button"
          class="view-btn"
          :class="{ active: modelValue.viewMode === option.value }"
          :title="t(option.label)"
          @click="updateModel('viewMode', option.value)"
        >
          <IconifyIcon :icon="option.icon" :size="18" :aria-label="t(option.label)" />
        </button>
      </div>
    </div>

    <div class="controls">
      <label class="field field-search">
        <span>{{ t("cms.storage.filters.search") }}</span>
        <input
          :value="modelValue.query"
          type="search"
          :placeholder="t('cms.storage.filters.searchPlaceholder')"
          @input="onQueryInput"
        />
      </label>

      <label class="field">
        <span>{{ t("cms.storage.filters.type") }}</span>
        <select :value="modelValue.type" @change="onTypeChange">
          <option v-for="option in typeOptions" :key="option.value" :value="option.value">
            {{ t(option.label) }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>{{ t("cms.storage.filters.status") }}</span>
        <select :value="modelValue.status" @change="onStatusChange">
          <option v-for="option in statusOptions" :key="option.value" :value="option.value">
            {{ t(option.label) }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>{{ t("cms.storage.filters.relation") }}</span>
        <select :value="modelValue.relation" @change="onRelationChange">
          <option v-for="option in relationOptions" :key="option.value" :value="option.value">
            {{ t(option.label) }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>{{ t("cms.storage.filters.sort") }}</span>
        <select :value="modelValue.sortBy" @change="onSortChange">
          <option v-for="option in sortOptions" :key="option.value" :value="option.value">
            {{ t(option.label) }}
          </option>
        </select>
      </label>
    </div>

    <button v-if="hasActiveFilters" type="button" class="reset-btn" @click="resetFilters">
      <IconifyIcon icon="ph:x" :size="16" />
      {{ t("cms.storage.filters.reset") }}
    </button>
  </section>
</template>

<style scoped>
.filters-card {
  margin-bottom: var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.header h2 {
  font-family: var(--font-heading);
  font-size: 28px;
  font-weight: 400;
}

.header p {
  color: var(--text-tertiary);
  font-size: 13px;
}

.view-toggle {
  display: inline-flex;
  gap: 8px;
}

.view-btn {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
}

.view-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: color-mix(in oklch, var(--bg) 72%, transparent);
}

.controls {
  display: grid;
  grid-template-columns: minmax(220px, 1.7fr) repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  color: var(--text-tertiary);
  font-size: 12px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.field-search {
  min-width: 0;
}

.field input,
.field select {
  width: 100%;
  background: var(--bg);
}

.reset-btn {
  margin-top: var(--space-3);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
}

.reset-btn:hover {
  color: var(--accent);
}

@media (max-width: 1100px) {
  .controls {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .header {
    flex-direction: column;
  }

  .controls {
    grid-template-columns: 1fr;
  }
}
</style>
