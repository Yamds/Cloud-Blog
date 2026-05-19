import { ref } from 'vue'
import { defineStore } from 'pinia'

type ThemeMode = 'dark' | 'light'

const STORAGE_THEME_KEY = 'theme'
const STORAGE_HUE_KEY = 'hue'
const DEFAULT_THEME: ThemeMode = 'light'
const DEFAULT_HUE = 45

function normalizeTheme(value: string | null): ThemeMode {
  return value === 'dark' ? 'dark' : 'light'
}

function normalizeHue(value: string | number | null): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value ?? '', 10)
  if (Number.isNaN(parsed)) {
    return DEFAULT_HUE
  }

  return Math.max(0, Math.min(360, parsed))
}

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<ThemeMode>(DEFAULT_THEME)
  const hue = ref<number>(DEFAULT_HUE)

  function applyThemeToDom(nextTheme: ThemeMode): void {
    document.documentElement.setAttribute('data-theme', nextTheme)
  }

  function applyHueToDom(nextHue: number): void {
    document.documentElement.style.setProperty('--hue', String(nextHue))
  }

  function setTheme(nextTheme: ThemeMode): void {
    theme.value = nextTheme
    applyThemeToDom(nextTheme)
    localStorage.setItem(STORAGE_THEME_KEY, nextTheme)
  }

  function toggleTheme(): void {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  function setHue(nextHue: number): void {
    const normalizedHue = normalizeHue(nextHue)
    hue.value = normalizedHue
    applyHueToDom(normalizedHue)
    localStorage.setItem(STORAGE_HUE_KEY, String(normalizedHue))
  }

  function initFromStorage(): void {
    const storedTheme = normalizeTheme(localStorage.getItem(STORAGE_THEME_KEY))
    const storedHue = normalizeHue(localStorage.getItem(STORAGE_HUE_KEY))

    theme.value = storedTheme
    hue.value = storedHue

    applyThemeToDom(storedTheme)
    applyHueToDom(storedHue)
  }

  return {
    theme,
    hue,
    initFromStorage,
    setTheme,
    toggleTheme,
    setHue
  }
})
