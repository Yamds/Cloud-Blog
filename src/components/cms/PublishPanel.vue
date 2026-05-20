<script setup lang="ts">
import { computed } from "vue";
import AutosaveIndicator from "./AutosaveIndicator.vue";
import { useI18n } from "@/i18n/useI18n";
import type { CmsArticleStatus } from "@/types/cms";

defineProps<{
  status: CmsArticleStatus;
  createdAt: string;
  updatedAt: string;
  autosaveState: "idle" | "saving" | "saved" | "error";
  lastSavedAt: string;
}>();

const emit = defineEmits<{ "update:status": [value: CmsArticleStatus] }>();

const { locale } = useI18n();

const text = computed(() =>
  locale.value === "en"
    ? {
        heading: "Publishing",
        status: "Status",
        createdAt: "Created",
        updatedAt: "Updated",
        draft: "Draft",
        published: "Published",
        archived: "Archived",
      }
    : {
        heading: "发布信息",
        status: "状态",
        createdAt: "创建时间",
        updatedAt: "最后修改",
        draft: "草稿",
        published: "已发布",
        archived: "已归档",
      },
);
</script>

<template>
  <div class="publish-panel">
    <h3>{{ text.heading }}</h3>
    <label class="field">
      {{ text.status }}
      <select :value="status" @change="emit('update:status', ($event.target as HTMLSelectElement).value as CmsArticleStatus)">
        <option value="draft">{{ text.draft }}</option>
        <option value="published">{{ text.published }}</option>
        <option value="archived">{{ text.archived }}</option>
      </select>
    </label>
    <p class="meta"><strong>{{ text.createdAt }}:</strong>{{ createdAt }}</p>
    <p class="meta"><strong>{{ text.updatedAt }}:</strong>{{ updatedAt }}</p>
    <AutosaveIndicator :state="autosaveState" :last-saved-at="lastSavedAt" />
  </div>
</template>

<style scoped>
.publish-panel { display: grid; gap: var(--space-2); }
h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
.field { display: grid; gap: 8px; font-size: 13px; color: var(--text-secondary); }
.meta { color: var(--text-secondary); font-size: 13px; }
.meta strong { color: var(--text-primary); font-weight: 500; }
</style>
