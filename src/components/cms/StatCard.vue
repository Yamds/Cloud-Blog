<script setup lang="ts">
import IconifyIcon from "@/components/common/IconifyIcon.vue";
import type { CmsStatItem } from "@/types/cms";

defineProps<{ stat: CmsStatItem }>();
</script>

<template>
  <article class="stat-card">
    <div class="stat-header">
      <span class="stat-label">{{ stat.label }}</span>
      <IconifyIcon :icon="stat.icon" :size="24" />
    </div>
    <p class="stat-value">{{ stat.value }}</p>
    <p class="stat-change" :class="{ positive: stat.positive }">{{ stat.change }}</p>
  </article>
</template>

<style scoped>
.stat-card { background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: var(--space-4); transition: border-color var(--transition-fast), transform var(--transition-fast); }
.stat-card:hover { border-color: var(--accent); transform: translateY(-2px); }
.stat-header { display: flex; justify-content: space-between; margin-bottom: var(--space-3); color: var(--accent); }
.stat-label { color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 1px; font-size: 13px; }
.stat-value { font-family: var(--font-heading); font-size: 48px; line-height: 1; margin-bottom: var(--space-1); }
.stat-change { color: var(--text-secondary); font-size: 13px; }
.stat-change.positive { color: var(--accent); }
</style>
