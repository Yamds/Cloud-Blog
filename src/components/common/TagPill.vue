<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string;
    title?: string;
    clickable?: boolean;
  }>(),
  {
    title: undefined,
    clickable: false,
  },
);
</script>

<template>
  <span class="tag-pill" :class="{ clickable: props.clickable }" :title="props.title ?? props.label">
    <slot>{{ props.label }}</slot>
  </span>
</template>

<style scoped>
.tag-pill {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 0.82rem;
  color: var(--text-secondary);
  background: color-mix(in oklch, var(--bg-elevated) 50%, transparent);
  transition: color var(--transition-fast), border-color var(--transition-fast);
}

.tag-pill.clickable {
  cursor: pointer;
}

.tag-pill.clickable:hover {
  color: var(--accent);
  border-color: var(--accent);
}
</style>
