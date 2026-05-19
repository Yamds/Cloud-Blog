<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

import { useThemeStore } from '@/stores/theme'
import IconifyIcon from './IconifyIcon.vue'

const themeStore = useThemeStore()
const wrapperRef = ref<HTMLElement | null>(null)
const toggleButtonRef = ref<HTMLButtonElement | null>(null)
const isPaletteOpen = ref(false)

const themeIcon = computed(() =>
  themeStore.theme === 'dark' ? 'ph:sun-dim' : 'ph:moon',
)

const themeTitle = computed(() =>
  themeStore.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题',
)

const huePercent = computed(() => `${Math.max(0, Math.min(360, themeStore.hue)) / 3.6}%`)
let closeTimer: ReturnType<typeof setTimeout> | null = null

function clearCloseTimer(): void {
  if (closeTimer === null) {
    return
  }

  clearTimeout(closeTimer)
  closeTimer = null
}

function openPalette(): void {
  clearCloseTimer()
  isPaletteOpen.value = true
}

function closePalette(restoreFocus = false): void {
  clearCloseTimer()
  isPaletteOpen.value = false

  if (restoreFocus) {
    toggleButtonRef.value?.focus()
  }
}

function scheduleClosePalette(): void {
  clearCloseTimer()
  closeTimer = setTimeout(() => {
    closeTimer = null

    if (wrapperRef.value?.matches(':focus-within')) {
      return
    }

    isPaletteOpen.value = false
  }, 140)
}

function onFocusOut(event: FocusEvent): void {
  const nextTarget = event.relatedTarget as Node | null
  if (nextTarget && wrapperRef.value?.contains(nextTarget)) {
    return
  }

  scheduleClosePalette()
}

function onWrapperKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') {
    return
  }

  event.preventDefault()
  closePalette(true)
}

function onRainbowClick(event: MouseEvent): void {
  const target = event.currentTarget as HTMLElement | null
  if (!target) {
    return
  }

  const rect = target.getBoundingClientRect()
  const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width)
  const hue = Math.round((x / rect.width) * 360)
  themeStore.setHue(hue)
}

function onRainbowKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
    event.preventDefault()
    themeStore.setHue(Math.max(0, themeStore.hue - 5))
    return
  }
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
    event.preventDefault()
    themeStore.setHue(Math.min(360, themeStore.hue + 5))
    return
  }
  if (event.key === 'Home') {
    event.preventDefault()
    themeStore.setHue(0)
    return
  }
  if (event.key === 'End') {
    event.preventDefault()
    themeStore.setHue(360)
  }
}

onBeforeUnmount(() => {
  clearCloseTimer()
})
</script>

<template>
  <div
    ref="wrapperRef"
    class="theme-toggle-wrapper"
    :class="{ 'is-open': isPaletteOpen }"
    @pointerenter="openPalette"
    @pointerleave="scheduleClosePalette"
    @focusin="openPalette"
    @focusout="onFocusOut"
    @keydown="onWrapperKeydown"
  >
    <button
      ref="toggleButtonRef"
      class="theme-toggle"
      type="button"
      :title="themeTitle"
      :aria-label="themeTitle"
      aria-haspopup="true"
      aria-controls="theme-hue-slider"
      :aria-expanded="isPaletteOpen ? 'true' : 'false'"
      @click="themeStore.toggleTheme()"
    >
      <IconifyIcon :icon="themeIcon" :title="themeTitle" :aria-label="themeTitle" />
    </button>
    <div class="rainbow-bar-container">
      <div
        id="theme-hue-slider"
        class="rainbow-bar"
        role="slider"
        tabindex="0"
        aria-label="调整主题色相"
        aria-valuemin="0"
        aria-valuemax="360"
        :aria-valuenow="themeStore.hue"
        :style="{ '--hue-percent': huePercent }"
        @click="onRainbowClick"
        @keydown="onRainbowKeydown"
      >
        <span class="rainbow-thumb" aria-hidden="true" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-toggle-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.theme-toggle-wrapper::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  width: 164px;
  height: 16px;
  transform: translateX(-50%);
  pointer-events: none;
}

.theme-toggle {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition:
    color var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.theme-toggle-wrapper.is-open::after {
  pointer-events: auto;
}

.theme-toggle:hover,
.theme-toggle:focus-visible,
.theme-toggle-wrapper.is-open .theme-toggle {
  color: var(--accent);
  background: color-mix(in oklch, var(--bg-elevated) 72%, transparent);
  border-color: color-mix(in oklch, var(--accent) 24%, var(--border));
  transform: translateY(-1px);
}

.theme-toggle:focus-visible {
  outline: none;
  box-shadow: 0 0 0 1px color-mix(in oklch, var(--accent) 28%, transparent);
}

.theme-toggle:active {
  transform: translateY(0);
}

.rainbow-bar-container {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translate(-50%, -4px);
  width: 156px;
  padding: 10px 12px;
  background: color-mix(in oklch, var(--bg-elevated) 88%, transparent);
  border: 1px solid var(--border);
  border-radius: 8px;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  box-shadow: 0 10px 30px color-mix(in oklch, var(--text-primary) 8%, transparent);
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast),
    visibility var(--transition-fast);
  z-index: 1;
}

.theme-toggle-wrapper.is-open .rainbow-bar-container {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translate(-50%, 0);
}

.rainbow-bar {
  position: relative;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    hsl(0deg 90% 65%),
    hsl(60deg 90% 65%),
    hsl(120deg 90% 65%),
    hsl(180deg 90% 65%),
    hsl(240deg 90% 65%),
    hsl(300deg 90% 65%),
    hsl(360deg 90% 65%)
  );
  cursor: pointer;
  outline: none;
}

.rainbow-bar:focus-visible {
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--accent) 36%, transparent);
}

.rainbow-thumb {
  position: absolute;
  left: var(--hue-percent);
  top: 50%;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid var(--bg);
  background: var(--bg-elevated);
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 1px color-mix(in oklch, var(--text-primary) 20%, transparent);
}
</style>
