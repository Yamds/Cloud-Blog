<script setup lang="ts">
import { computed } from "vue";
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

const typeOptions: Array<{ value: CmsStorageObjectType | "all"; label: string }> = [
  { value: "all", label: "全部类型" },
  { value: "image", label: "图片" },
  { value: "attachment", label: "附件" },
];

const statusOptions: Array<{ value: CmsStorageObjectStatus | "all"; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "ready", label: "可用" },
  { value: "processing", label: "处理中" },
  { value: "orphaned", label: "待整理" },
  { value: "error", label: "异常" },
];

const relationOptions: Array<{ value: CmsStorageRelationFilter; label: string }> = [
  { value: "all", label: "全部关联" },
  { value: "linked", label: "已关联文章" },
  { value: "unlinked", label: "未关联" },
];

const sortOptions: Array<{ value: CmsStorageSortKey; label: string }> = [
  { value: "updatedAt", label: "按更新时间" },
  { value: "sizeBytes", label: "按大小" },
  { value: "key", label: "按对象 key" },
];

const viewOptions: Array<{ value: CmsStorageViewMode; icon: string; label: string }> = [
  { value: "table", icon: "ph:rows", label: "表格视图" },
  { value: "grid", icon: "ph:squares-four", label: "网格视图" },
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
        <h2>对象筛选</h2>
        <p>{{ visibleCount }} / {{ totalCount }} 个对象正在显示</p>
      </div>
      <div class="view-toggle" aria-label="切换对象视图">
        <button
          v-for="option in viewOptions"
          :key="option.value"
          type="button"
          class="view-btn"
          :class="{ active: modelValue.viewMode === option.value }"
          :title="option.label"
          @click="updateModel('viewMode', option.value)"
        >
          <IconifyIcon :icon="option.icon" :size="18" :aria-label="option.label" />
        </button>
      </div>
    </div>

    <div class="controls">
      <label class="field field-search">
        <span>搜索</span>
        <input
          :value="modelValue.query"
          type="search"
          placeholder="按 key、类型或关联文章搜索"
          @input="onQueryInput"
        />
      </label>

      <label class="field">
        <span>类型</span>
        <select :value="modelValue.type" @change="onTypeChange">
          <option v-for="option in typeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>状态</span>
        <select :value="modelValue.status" @change="onStatusChange">
          <option v-for="option in statusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>关联</span>
        <select :value="modelValue.relation" @change="onRelationChange">
          <option v-for="option in relationOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>排序</span>
        <select :value="modelValue.sortBy" @change="onSortChange">
          <option v-for="option in sortOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
    </div>

    <button v-if="hasActiveFilters" type="button" class="reset-btn" @click="resetFilters">
      <IconifyIcon icon="ph:x" :size="16" />
      清空筛选
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
