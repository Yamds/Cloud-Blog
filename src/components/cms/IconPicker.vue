<script setup lang="ts">
import { computed } from "vue";
import IconifyIcon from "@/components/common/IconifyIcon.vue";
import { useI18n } from "@/i18n/useI18n";

defineProps<{ modelValue: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const { locale } = useI18n();

const text = computed(() =>
  locale.value === "en"
    ? {
        openIconify: "Browse icons in Iconify",
        placeholder: "ph:code",
      }
    : {
        openIconify: "在 Iconify 中查看图标",
        placeholder: "ph:code",
      },
);
</script>

<template>
  <div class="icon-picker">
    <a
      class="preview"
      href="https://icon-sets.iconify.design"
      target="_blank"
      rel="noopener noreferrer"
      :title="text.openIconify"
      :aria-label="text.openIconify"
    >
      <IconifyIcon :icon="modelValue || 'ph:code'" :size="30" />
    </a>
    <input
      :value="modelValue"
      type="text"
      :placeholder="text.placeholder"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<style scoped>
.icon-picker { display: flex; align-items: center; gap: var(--space-2); }
.preview {
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  border: 1px solid var(--border);
  border-radius: 0;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  transition:
    border-color var(--transition-fast),
    color var(--transition-fast),
    background var(--transition-fast);
}
.preview:hover,
.preview:focus-visible {
  border-color: var(--accent);
  color: var(--accent-strong);
  background: color-mix(in oklab, var(--bg) 92%, var(--accent) 8%);
  outline: none;
}
</style>
