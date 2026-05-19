<script setup lang="ts">
import IconifyIcon from "./IconifyIcon.vue";

const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    icon?: string;
  }>(),
  {
    description: "",
    icon: "ph:files-light",
  },
);
</script>

<template>
  <section class="empty-state" aria-live="polite">
    <IconifyIcon class="empty-icon" :icon="props.icon" size="28" title="空状态图标" aria-label="空状态图标" />
    <h3 class="empty-title">{{ props.title }}</h3>
    <p v-if="props.description" class="empty-description">{{ props.description }}</p>
    <div v-if="$slots.action" class="empty-action">
      <slot name="action" />
    </div>
  </section>
</template>

<style scoped>
.empty-state {
  border: 1px dashed var(--border);
  border-radius: 8px;
  padding: 32px 20px;
  text-align: center;
  background: color-mix(in oklch, var(--bg-elevated) 35%, transparent);
}

.empty-icon {
  color: var(--text-tertiary);
}

.empty-title {
  margin-top: 8px;
  font-size: 1rem;
  font-weight: 500;
}

.empty-description {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.empty-action {
  margin-top: 14px;
}
</style>
