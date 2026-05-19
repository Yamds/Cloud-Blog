<script setup lang="ts">
import IconifyIcon from "@/components/common/IconifyIcon.vue";
import { ref } from "vue";

defineProps<{ tags: string[] }>();
const emit = defineEmits<{
  add: [tag: string];
  remove: [tag: string];
}>();

const inputValue = ref("");

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
      <button type="button" title="删除标签" @click="emit('remove', tag)">
        <IconifyIcon icon="ph:x" :size="12" />
      </button>
    </span>
    <input v-model="inputValue" type="text" placeholder="添加标签..." @keydown.enter.prevent="addTag" />
  </div>
</template>

<style scoped>
.tags { display: flex; flex-wrap: wrap; gap: var(--space-1); min-height: 42px; }
.tag { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-elevated); font-size: 13px; }
.tag button { width: 16px; height: 16px; border: 0; background: transparent; color: var(--text-tertiary); padding: 0; }
.tag button:hover { color: var(--accent); }
.tags input { min-width: 110px; flex: 1; border: 0; padding: 4px 0; background: transparent; }
</style>
