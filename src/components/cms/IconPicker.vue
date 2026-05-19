<script setup lang="ts">
import IconifyIcon from "@/components/common/IconifyIcon.vue";

defineProps<{ modelValue: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<template>
  <div class="icon-picker">
    <div class="preview"><IconifyIcon :icon="modelValue || 'ph:code'" :size="30" /></div>
    <input
      :value="modelValue"
      type="text"
      placeholder="ph:code"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<style scoped>
.icon-picker { display: flex; align-items: center; gap: var(--space-2); }
.preview { width: 48px; height: 48px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg); display: flex; align-items: center; justify-content: center; color: var(--accent); }
</style>
