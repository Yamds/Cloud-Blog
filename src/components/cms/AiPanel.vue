<script setup lang="ts">
import { computed } from "vue";
import IconifyIcon from "@/components/common/IconifyIcon.vue";
import { useI18n } from "@/i18n/useI18n";
import type { CmsAiAction } from "@/types/cms";

const props = defineProps<{
  actions: CmsAiAction[];
  activeKey?: CmsAiAction["key"] | null;
}>();

defineEmits<{
  run: [key: CmsAiAction["key"]];
}>();

const { locale } = useI18n();

const actionText = {
  zh: {
    summary: {
      label: "生成摘要",
      description: "生成 80-160 字摘要候选。",
    },
    polish: {
      label: "润色段落",
      description: "保持语义，优化表达克制度。",
    },
    tags: {
      label: "生成标签",
      description: "根据正文推荐主题标签。",
    },
    format: {
      label: "AI 排版",
      description: "将纯文本重排为结构化内容。",
    },
    translate: {
      label: "AI 翻译",
      description: "基于中文稿生成或刷新英文稿。",
    },
  },
  en: {
    summary: {
      label: "Generate summary",
      description: "Create an 80-160 character summary candidate.",
    },
    polish: {
      label: "Polish paragraph",
      description: "Improve expression while keeping the meaning intact.",
    },
    tags: {
      label: "Generate tags",
      description: "Recommend topic tags from the article body.",
    },
    format: {
      label: "AI formatting",
      description: "Reshape plain text into structured content.",
    },
    translate: {
      label: "AI translate",
      description: "Create or refresh the English article from the Chinese draft.",
    },
  },
} as const;

const text = computed(() =>
  locale.value === "en"
    ? {
        heading: "AI Actions",
        running: "Running...",
      }
    : {
        heading: "AI 操作",
        running: "处理中...",
      },
);

function getActionText(action: CmsAiAction) {
  return actionText[locale.value][action.key] ?? {
    label: action.label,
    description: action.description,
  };
}
</script>

<template>
  <div class="ai-panel">
    <h3>{{ text.heading }}</h3>
    <button
      v-for="action in props.actions"
      :key="action.key"
      type="button"
      class="ai-btn"
      :disabled="Boolean(props.activeKey)"
      @click="$emit('run', action.key)"
    >
      <span>
        <IconifyIcon :icon="props.activeKey === action.key ? 'ph:spinner-gap' : 'ph:sparkle'" :size="14" />
        {{ props.activeKey === action.key ? text.running : getActionText(action).label }}
      </span>
      <small>{{ getActionText(action).description }}</small>
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
