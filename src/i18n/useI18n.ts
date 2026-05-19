import { computed } from "vue";
import { storeToRefs } from "pinia";

import { messages, type MessageKey } from "@/i18n/messages";
import { useLanguageStore, type AppLocale } from "@/stores/language";

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}

export function translate(
  locale: AppLocale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  return interpolate(messages[locale][key] ?? messages.zh[key] ?? key, params);
}

export function useI18n() {
  const languageStore = useLanguageStore();
  const { locale } = storeToRefs(languageStore);

  function t(key: MessageKey, params?: Record<string, string | number>): string {
    return translate(locale.value, key, params);
  }

  return {
    locale: computed(() => locale.value),
    t,
  };
}
