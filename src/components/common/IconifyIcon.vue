<script setup lang="ts">
import { Icon } from "@iconify/vue";

const props = withDefaults(
  defineProps<{
    icon: string;
    size?: string | number;
    title?: string;
    ariaLabel?: string;
    inline?: boolean;
  }>(),
  {
    size: 18,
    title: undefined,
    ariaLabel: undefined,
    inline: false,
  },
);
</script>

<template>
  <Icon
    :icon="props.icon"
    :width="props.size"
    :height="props.size"
    :title="props.title"
    :aria-label="props.ariaLabel"
    :inline="props.inline"
  />
</template>
