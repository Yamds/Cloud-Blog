<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
  }>(),
  {
    subtitle: "",
  },
);
</script>

<template>
  <div class="cms-shell">
    <header class="cms-header">
      <h1 class="cms-title">{{ title }}</h1>
      <p v-if="subtitle" class="cms-subtitle">{{ subtitle }}</p>
    </header>
    <slot />
  </div>
</template>

<style scoped>
.cms-shell { max-width: 1400px; margin: 0 auto; padding: var(--space-8) var(--space-4); }
.cms-header { margin-bottom: var(--space-6); }
.cms-title { font-family: var(--font-heading); font-size: clamp(32px, 4vw, 40px); font-weight: 400; line-height: 1.2; }
.cms-subtitle { margin-top: var(--space-1); color: var(--text-tertiary); font-size: 14px; }
</style>
