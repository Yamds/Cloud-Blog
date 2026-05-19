<script setup lang="ts">
import AutosaveIndicator from "./AutosaveIndicator.vue";
import type { CmsArticleStatus } from "@/types/cms";

defineProps<{
  status: CmsArticleStatus;
  createdAt: string;
  updatedAt: string;
  autosaveState: "idle" | "saving" | "saved" | "error";
  lastSavedAt: string;
}>();

const emit = defineEmits<{ "update:status": [value: CmsArticleStatus] }>();
</script>

<template>
  <div class="publish-panel">
    <h3>发布信息</h3>
    <label class="field">
      状态
      <select :value="status" @change="emit('update:status', ($event.target as HTMLSelectElement).value as CmsArticleStatus)">
        <option value="draft">草稿</option>
        <option value="published">已发布</option>
        <option value="archived">已归档</option>
      </select>
    </label>
    <p class="meta"><strong>创建时间：</strong>{{ createdAt }}</p>
    <p class="meta"><strong>最后修改：</strong>{{ updatedAt }}</p>
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
