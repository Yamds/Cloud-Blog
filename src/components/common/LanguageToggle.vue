<script setup lang="ts">
import { computed } from "vue";

import { useI18n } from "@/i18n/useI18n";
import { useLanguageStore } from "@/stores/language";
import IconifyIcon from "./IconifyIcon.vue";

const languageStore = useLanguageStore();
const { t } = useI18n();

const toggleLabel = computed(() => t("nav.languageToggle"));

function handleToggle(): void {
  languageStore.toggleLocale();
}
</script>

<template>
  <button
    class="icon-button language-toggle"
    type="button"
    :title="toggleLabel"
    :aria-label="toggleLabel"
    @click="handleToggle"
  >
    <IconifyIcon icon="meteor-icons:language" :size="18" :title="toggleLabel" :aria-label="toggleLabel" />
  </button>
</template>

<style scoped>
.language-toggle {
  width: 36px;
  padding: 0;
}
</style>
