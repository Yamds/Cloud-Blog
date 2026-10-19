<script setup lang="ts">
import { computed } from "vue";
import IconifyIcon from "@/components/common/IconifyIcon.vue";
import { aiMessages } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import type { CmsAiActionKey } from "@/api/ai";

defineProps<{
  activeKey?: CmsAiActionKey | null;
}>();

defineEmits<{
  run: [key: CmsAiActionKey];
}>();

const { locale } = useI18n();

const actionKeys: CmsAiActionKey[] = ["summary", "polish", "tags", "format", "translate"];

const text = computed(() => aiMessages[locale.value]);

function getActionText(key: CmsAiActionKey) {
  return text.value.actions[key];
}
</script>

<template>
  <div class="ai-panel">
    <h3>{{ text.heading }}</h3>
    <button
      v-for="key in actionKeys"
      :key="key"
      type="button"
      class="ai-btn"
      :disabled="Boolean(activeKey)"
      @click="$emit('run', key)"
    >
      <span>
        <IconifyIcon :icon="activeKey === key ? 'ph:spinner-gap' : 'ph:sparkle'" :size="14" />
        {{ activeKey === key ? text.running : getActionText(key).label }}
      </span>
      <small>{{ getActionText(key).description }}</small>
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
