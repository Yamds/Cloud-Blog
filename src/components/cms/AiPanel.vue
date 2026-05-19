<script setup lang="ts">
import IconifyIcon from "@/components/common/IconifyIcon.vue";
import type { CmsAiAction } from "@/types/cms";

defineProps<{
  actions: CmsAiAction[];
  activeKey?: CmsAiAction["key"] | null;
}>();

defineEmits<{
  run: [key: CmsAiAction["key"]];
}>();
</script>

<template>
  <div class="ai-panel">
    <h3>AI 操作</h3>
    <button
      v-for="action in actions"
      :key="action.key"
      type="button"
      class="ai-btn"
      :disabled="Boolean(activeKey)"
      @click="$emit('run', action.key)"
    >
      <span>
        <IconifyIcon :icon="activeKey === action.key ? 'ph:spinner-gap' : 'ph:sparkle'" :size="14" />
        {{ activeKey === action.key ? "处理中..." : action.label }}
      </span>
      <small>{{ action.description }}</small>
    </button>
  </div>
</template>

<style scoped>
.ai-panel { display: grid; gap: var(--space-2); }
h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
.ai-btn { text-align: left; padding: var(--space-2); border-radius: var(--radius-md); }
.ai-btn:disabled { cursor: wait; opacity: 0.72; }
.ai-btn span { display: inline-flex; align-items: center; gap: 6px; color: var(--text-primary); font-size: 14px; }
.ai-btn small { display: block; color: var(--text-tertiary); margin-top: 4px; font-size: 12px; }
</style>
