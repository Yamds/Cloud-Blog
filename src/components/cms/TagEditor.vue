<script setup lang="ts">
import { computed, ref } from "vue";
import IconifyIcon from "@/components/common/IconifyIcon.vue";
import { useI18n } from "@/i18n/useI18n";

defineProps<{ tags: string[] }>();
const emit = defineEmits<{
  add: [tag: string];
  remove: [tag: string];
}>();

const inputValue = ref("");
const { locale } = useI18n();

const text = computed(() =>
  locale.value === "en"
    ? {
        removeTag: "Remove tag",
        placeholder: "Add a tag...",
      }
    : {
        removeTag: "删除标签",
        placeholder: "添加标签...",
      },
);

function addTag(): void {
  const value = inputValue.value.trim();
  if (!value) return;
  emit("add", value);
  inputValue.value = "";
}
</script>

<template>
  <div class="tags">
    <span v-for="tag in tags" :key="tag" class="tag">
      {{ tag }}
      <button type="button" :title="text.removeTag" :aria-label="text.removeTag" @click="emit('remove', tag)">
        <IconifyIcon icon="ph:x" :size="12" />
      </button>
    </span>
    <input v-model="inputValue" type="text" :placeholder="text.placeholder" @keydown.enter.prevent="addTag" />
  </div>
</template>

<style scoped>
.tags { display: flex; flex-wrap: wrap; gap: var(--space-1); min-height: 42px; }
.tag { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-elevated); font-size: 13px; }
.tag button { width: 16px; height: 16px; border: 0; background: transparent; color: var(--text-tertiary); padding: 0; }
.tag button:hover { color: var(--accent); }
.tags input { min-width: 110px; flex: 1; border: 0; padding: 4px 0; background: transparent; }
</style>
