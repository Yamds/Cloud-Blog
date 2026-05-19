<script setup lang="ts">
import IconifyIcon from "@/components/common/IconifyIcon.vue";

const props = defineProps<{
  state: "idle" | "saving" | "saved" | "error";
  lastSavedAt?: string;
}>();

const labelMap = {
  idle: "未保存",
  saving: "保存中...",
  saved: "已保存",
  error: "保存失败",
} as const;

const iconMap = {
  idle: "ph:clock",
  saving: "ph:arrows-clockwise",
  saved: "ph:check-circle",
  error: "ph:warning-circle",
} as const;
</script>

<template>
  <p class="autosave" :class="state">
    <IconifyIcon :icon="iconMap[props.state]" :size="14" />
    {{ labelMap[props.state] }}
    <span v-if="props.lastSavedAt && props.state === 'saved'">（{{ props.lastSavedAt }}）</span>
  </p>
</template>

<style scoped>
.autosave { display: inline-flex; gap: 6px; align-items: center; color: var(--text-secondary); font-size: 13px; }
.autosave.saved { color: var(--accent); }
.autosave.error { color: #d46161; }
</style>
