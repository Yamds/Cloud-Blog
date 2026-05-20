<script setup lang="ts">
import { computed } from "vue";
import IconifyIcon from "@/components/common/IconifyIcon.vue";
import { useI18n } from "@/i18n/useI18n";

const props = defineProps<{
  state: "idle" | "saving" | "saved" | "error";
  lastSavedAt?: string;
}>();

const { locale } = useI18n();

const iconMap = {
  idle: "ph:clock",
  saving: "ph:arrows-clockwise",
  saved: "ph:check-circle",
  error: "ph:warning-circle",
} as const;

const labelMap = computed(() =>
  locale.value === "en"
    ? {
        idle: "Unsaved",
        saving: "Saving...",
        saved: "Saved",
        error: "Save failed",
      }
    : {
        idle: "未保存",
        saving: "保存中...",
        saved: "已保存",
        error: "保存失败",
      },
);
</script>

<template>
  <p class="autosave" :class="state">
    <IconifyIcon :icon="iconMap[props.state]" :size="14" />
    {{ labelMap[props.state] }}
    <span v-if="props.lastSavedAt && props.state === 'saved'">
      {{ locale === "en" ? `(${props.lastSavedAt})` : `（${props.lastSavedAt}）` }}
    </span>
  </p>
</template>

<style scoped>
.autosave { display: inline-flex; gap: 6px; align-items: center; color: var(--text-secondary); font-size: 13px; }
.autosave.saved { color: var(--accent); }
.autosave.error { color: #d46161; }
</style>
