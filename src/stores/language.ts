import { ref } from "vue";
import { defineStore } from "pinia";

export type AppLocale = "zh" | "en";

const STORAGE_LANGUAGE_KEY = "language";
const DEFAULT_LOCALE: AppLocale = "zh";

function normalizeLocale(value: string | null): AppLocale {
  return value === "en" ? "en" : DEFAULT_LOCALE;
}

export const useLanguageStore = defineStore("language", () => {
  const locale = ref<AppLocale>(DEFAULT_LOCALE);

  function syncLocale(nextLocale: AppLocale): void {
    locale.value = nextLocale;
    localStorage.setItem(STORAGE_LANGUAGE_KEY, nextLocale);
    document.documentElement.setAttribute("lang", nextLocale);
  }

  function setLocale(nextLocale: AppLocale): void {
    syncLocale(nextLocale);
  }

  function toggleLocale(): void {
    syncLocale(locale.value === "zh" ? "en" : "zh");
  }

  function initFromStorage(): void {
    const storedLocale = normalizeLocale(localStorage.getItem(STORAGE_LANGUAGE_KEY));
    syncLocale(storedLocale);
  }

  return {
    locale,
    initFromStorage,
    setLocale,
    toggleLocale,
  };
});
