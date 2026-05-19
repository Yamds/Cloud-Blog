<script setup lang="ts">
import { storeToRefs } from "pinia";

import { useI18n } from "@/i18n/useI18n";
import { useLanguageStore, type AppLocale } from "@/stores/language";

const languageStore = useLanguageStore();
const { locale } = storeToRefs(languageStore);
const { t } = useI18n();

const options: Array<{ value: AppLocale; label: "nav.languageZh" | "nav.languageEn" }> = [
  { value: "zh", label: "nav.languageZh" },
  { value: "en", label: "nav.languageEn" },
];

function setLocale(nextLocale: AppLocale): void {
  languageStore.setLocale(nextLocale);
}
</script>

<template>
  <div class="language-toggle" :aria-label="t('nav.language')">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="language-option"
      :class="{ active: locale === option.value }"
      :aria-pressed="locale === option.value"
      :title="t('nav.language')"
      @click="setLocale(option.value)"
    >
      {{ t(option.label) }}
    </button>
  </div>
</template>

<style scoped>
.language-toggle {
  display: inline-flex;
  align-items: center;
  padding: 3px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: color-mix(in oklch, var(--bg-elevated) 76%, transparent);
}

.language-option {
  min-width: 34px;
  min-height: 30px;
  padding: 0 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  transition:
    color var(--transition-fast),
    background var(--transition-fast);
}

.language-option:hover,
.language-option:focus-visible {
  color: var(--accent);
}

.language-option.active {
  background: var(--bg);
  color: var(--text-primary);
}

.language-option:focus-visible {
  outline: none;
}
</style>
