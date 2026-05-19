<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import IconifyIcon from './IconifyIcon.vue'
import ThemeToggle from './ThemeToggle.vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const authStore = useAuthStore()
const { isAdmin, isAuthenticated, isLoading, user } = storeToRefs(authStore)

const publicLinks = [
  { to: '/', label: '主页' },
  { to: '/articles', label: '文章' },
] as const

const links = computed(() =>
  isAdmin.value ? [...publicLinks, { to: '/cms', label: 'CMS' }] : publicLinks,
)

const isScrolled = ref(false)
const isHomeRoute = computed(() => route.path === '/')
const isHomeTop = computed(() => isHomeRoute.value && !isScrolled.value)
const userDisplayName = computed(() => user.value?.githubLogin ?? '')
const userAvatarUrl = computed(() => user.value?.githubAvatarUrl ?? '')
const userProfileUrl = computed(() => user.value?.githubHtmlUrl ?? `https://github.com/${userDisplayName.value}`)

function isActive(to: string): boolean {
  if (to === '/') {
    return route.path === '/'
  }

  return route.path === to || route.path.startsWith(`${to}/`)
}

function syncScrollState(): void {
  isScrolled.value = window.scrollY > 8
}

function handleLogin(): void {
  authStore.loginWithGitHub()
}

async function handleLogout(): Promise<void> {
  await authStore.logout()
}

onMounted(() => {
  syncScrollState()
  window.addEventListener('scroll', syncScrollState, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', syncScrollState)
})

watch(
  () => route.fullPath,
  () => {
    window.requestAnimationFrame(() => {
      syncScrollState()
    })
  },
)
</script>

<template>
  <nav class="navbar" :class="{ 'is-home-top': isHomeTop }">
    <div class="nav-inner">
      <RouterLink class="logo" to="/" title="返回首页">Yamds's Blog</RouterLink>
      <div class="nav-links">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="nav-link"
          :class="{ active: isActive(link.to) }"
          :aria-current="isActive(link.to) ? 'page' : undefined"
        >
          {{ link.label }}
        </RouterLink>
      </div>
      <div class="nav-actions">
        <div v-if="isAuthenticated && user" class="auth-panel">
          <a
            class="auth-user"
            :href="userProfileUrl"
            target="_blank"
            rel="noreferrer"
            :title="`打开 ${userDisplayName} 的 GitHub 主页`"
          >
            <img
              v-if="userAvatarUrl"
              class="auth-avatar"
              :src="userAvatarUrl"
              :alt="`${userDisplayName} 的头像`"
              width="28"
              height="28"
            />
            <span v-else class="auth-avatar auth-avatar-fallback" aria-hidden="true">
              <IconifyIcon icon="ph:user-circle" :size="20" />
            </span>
            <span class="auth-name">{{ userDisplayName }}</span>
          </a>
          <button
            class="icon-button"
            type="button"
            title="登出"
            aria-label="登出"
            @click="handleLogout"
          >
            <IconifyIcon icon="ph:sign-out" :size="18" />
          </button>
        </div>
        <button
          v-else
          class="login-link"
          type="button"
          :disabled="isLoading"
          @click="handleLogin"
        >
          <IconifyIcon icon="ph:github-logo" :size="18" />
          <span>{{ isLoading ? '连接中' : 'GitHub 登录' }}</span>
        </button>
        <ThemeToggle />
      </div>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(12px);
  background: color-mix(in oklch, var(--bg) 92%, transparent);
  border-bottom: 1px solid var(--border-subtle);
  transition:
    background var(--transition-base),
    border-color var(--transition-fast),
    backdrop-filter var(--transition-base);
}

.navbar.is-home-top {
  background: color-mix(in oklch, var(--bg) 72%, transparent);
  border-bottom-color: transparent;
  backdrop-filter: blur(4px);
}

.nav-inner {
  width: min(1100px, 100% - 48px);
  margin: 0 auto;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.logo {
  font-family: "Cormorant Garamond", serif;
  font-size: 1.4rem;
  letter-spacing: 0;
  color: var(--text-primary);
  transition:
    color var(--transition-fast),
    transform var(--transition-fast);
}

.logo:hover,
.logo:focus-visible {
  color: var(--accent);
  transform: translateY(-1px);
}

.logo:focus-visible {
  outline: none;
}

.logo:active {
  transform: translateY(0);
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 20px;
}

.nav-link {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 12px;
  color: var(--text-secondary);
  text-decoration: none;
  transition:
    color var(--transition-fast),
    transform var(--transition-fast);
}

.nav-link::after {
  content: "";
  position: absolute;
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
}

.nav-link::after {
  left: 12px;
  right: 12px;
  bottom: 6px;
  height: 1.5px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0;
  transform: scaleX(0);
  transform-origin: right center;
}

.nav-link:hover,
.nav-link:focus-visible,
.nav-link:active {
  color: var(--accent);
  transform: translateY(-1px);
}

.nav-link:hover::after,
.nav-link:focus-visible::after,
.nav-link:active::after,
.nav-link.active::after {
  opacity: 1;
  transform: scaleX(1);
  transform-origin: left center;
}

.nav-link.active {
  color: var(--accent);
}

.nav-link:focus-visible {
  outline: 1px solid color-mix(in oklch, var(--accent) 32%, transparent);
  outline-offset: 4px;
}

.nav-link:active {
  transform: translateY(0);
}

.nav-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.auth-panel {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.auth-user {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 36px;
  color: var(--text-secondary);
  transition:
    color var(--transition-fast),
    transform var(--transition-fast);
}

.auth-user:hover,
.auth-user:focus-visible {
  color: var(--accent);
  transform: translateY(-1px);
}

.auth-user:active {
  transform: translateY(0);
}

.auth-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid color-mix(in oklch, var(--border) 88%, transparent);
  background: var(--bg-elevated);
}

.auth-avatar-fallback {
  color: var(--text-tertiary);
}

.auth-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.login-link,
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 10px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
}

.login-link:hover,
.login-link:focus-visible,
.icon-button:hover,
.icon-button:focus-visible {
  background: transparent;
  color: var(--accent);
  transform: translateY(-1px);
}

.login-link:active,
.icon-button:active {
  transform: translateY(0);
}

.login-link:disabled {
  cursor: progress;
  color: var(--text-tertiary);
}

.icon-button {
  width: 36px;
  padding: 0;
}

@media (max-width: 720px) {
  .nav-inner {
    width: min(100% - 24px, 1100px);
    flex-wrap: wrap;
    height: auto;
    padding: 14px 0;
  }

  .nav-links {
    order: 3;
    width: 100%;
    justify-content: flex-start;
    gap: 12px;
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .nav-actions {
    margin-left: auto;
  }

  .auth-name {
    max-width: 96px;
  }
}
</style>
