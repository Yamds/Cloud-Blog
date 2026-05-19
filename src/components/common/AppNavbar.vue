<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import { getSiteSettings } from "@/api/settings";
import { useAuthStore } from "@/stores/auth";
import type { SiteNavActionSettings } from "@/types/cms";
import IconifyIcon from "./IconifyIcon.vue";
import ThemeToggle from "./ThemeToggle.vue";

const route = useRoute();
const authStore = useAuthStore();
const { isAdmin, isAuthenticated, isLoading, user } = storeToRefs(authStore);

const publicLinks = [
  { to: "/", label: "Home" },
  { to: "/articles", label: "Articles" },
] as const;

const isScrolled = ref(false);
const navAction = ref<SiteNavActionSettings | null>(null);
const isHomeRoute = computed(() => route.path === "/");
const isHomeTop = computed(() => isHomeRoute.value && !isScrolled.value);
const userDisplayName = computed(() => user.value?.githubLogin ?? "");
const userAvatarUrl = computed(() => user.value?.githubAvatarUrl ?? "");
const userProfileUrl = computed(() => user.value?.githubHtmlUrl ?? `https://github.com/${userDisplayName.value}`);

const textLinks = computed(() => {
  const items: Array<
    | { type: "internal"; key: string; label: string; to: string }
    | { type: "external"; key: string; label: string; href: string }
  > = publicLinks.map((link) => ({
    type: "internal" as const,
    key: link.to,
    label: link.label,
    to: link.to,
  }));

  if (navAction.value?.enabled && navAction.value.variant === "text") {
    items.push(createTextNavLink(navAction.value));
  }

  if (isAdmin.value) {
    items.push({ type: "internal", key: "/cms", to: "/cms", label: "CMS" });
  }

  return items;
});

const iconNavAction = computed(() => {
  if (!navAction.value?.enabled || navAction.value.variant !== "icon") {
    return null;
  }

  if (navAction.value.targetType === "external") {
    return {
      type: "external" as const,
      href: navAction.value.href,
      iconName: navAction.value.iconName,
      title: navAction.value.tooltip,
    };
  }

  return {
    type: "internal" as const,
    to: normalizeArticlePath(navAction.value.articlePath),
    iconName: navAction.value.iconName,
    title: navAction.value.tooltip,
  };
});

function isActive(to: string): boolean {
  if (to === "/") {
    return route.path === "/";
  }

  return route.path === to || route.path.startsWith(`${to}/`);
}

function syncScrollState(): void {
  isScrolled.value = window.scrollY > 8;
}

function handleLogin(): void {
  authStore.loginWithGitHub();
}

async function handleLogout(): Promise<void> {
  await authStore.logout();
}

function createTextNavLink(action: SiteNavActionSettings) {
  if (action.targetType === "external") {
    return {
      type: "external" as const,
      key: action.href,
      href: action.href,
      label: action.label,
    };
  }

  const articlePath = normalizeArticlePath(action.articlePath);
  return {
    type: "internal" as const,
    key: articlePath,
    to: articlePath,
    label: action.label,
  };
}

function normalizeArticlePath(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "/articles";
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  const normalized = trimmed.replace(/^articles\//, "").replace(/^\/+/, "");
  return `/articles/${normalized}`;
}

async function loadNavAction(): Promise<void> {
  try {
    const settings = await getSiteSettings();
    navAction.value = settings.navAction.enabled ? settings.navAction : null;
  } catch {
    navAction.value = null;
  }
}

onMounted(() => {
  syncScrollState();
  window.addEventListener("scroll", syncScrollState, { passive: true });
  void loadNavAction();
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", syncScrollState);
});

watch(
  () => route.fullPath,
  () => {
    window.requestAnimationFrame(() => {
      syncScrollState();
    });
  },
);
</script>

<template>
  <nav class="navbar" :class="{ 'is-home-top': isHomeTop }">
    <div class="nav-inner">
      <RouterLink class="logo" to="/" title="Back to home">Yamds's Blog</RouterLink>
      <div class="nav-links">
        <template v-for="link in textLinks" :key="link.key">
          <RouterLink
            v-if="link.type === 'internal'"
            :to="link.to"
            class="nav-link"
            :class="{ active: isActive(link.to) }"
            :aria-current="isActive(link.to) ? 'page' : undefined"
          >
            {{ link.label }}
          </RouterLink>
          <a v-else :href="link.href" class="nav-link" target="_blank" rel="noreferrer">
            {{ link.label }}
          </a>
        </template>
      </div>
      <div class="nav-actions">
        <component
          :is="iconNavAction?.type === 'internal' ? RouterLink : 'a'"
          v-if="iconNavAction"
          class="icon-button nav-action-button"
          v-bind="
            iconNavAction.type === 'internal'
              ? { to: iconNavAction.to }
              : { href: iconNavAction.href, target: '_blank', rel: 'noreferrer' }
          "
          :title="iconNavAction.title"
          :aria-label="iconNavAction.title"
        >
          <IconifyIcon :icon="iconNavAction.iconName" :size="18" />
        </component>

        <div v-if="isAuthenticated && user" class="auth-panel">
          <a
            class="auth-user"
            :href="userProfileUrl"
            target="_blank"
            rel="noreferrer"
            :title="`Open ${userDisplayName}'s GitHub profile`"
          >
            <img
              v-if="userAvatarUrl"
              class="auth-avatar"
              :src="userAvatarUrl"
              :alt="`${userDisplayName} avatar`"
              width="28"
              height="28"
            />
            <span v-else class="auth-avatar auth-avatar-fallback" aria-hidden="true">
              <IconifyIcon icon="ph:user-circle" :size="20" />
            </span>
            <span class="auth-name">{{ userDisplayName }}</span>
          </a>
          <button class="icon-button" type="button" title="Log out" aria-label="Log out" @click="handleLogout">
            <IconifyIcon icon="ph:sign-out" :size="18" />
          </button>
        </div>
        <button v-else class="login-link" type="button" :disabled="isLoading" @click="handleLogin">
          <IconifyIcon icon="ph:github-logo" :size="18" />
          <span>{{ isLoading ? "Connecting..." : "GitHub Login" }}</span>
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
  transition: color var(--transition-fast);
}

.logo:hover,
.logo:focus-visible {
  color: var(--accent);
}

.logo:focus-visible {
  outline: none;
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
  transition: color var(--transition-fast);
}

.nav-link::after {
  content: "";
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 6px;
  height: 1.5px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0;
  transform: scaleX(0);
  transform-origin: right center;
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
}

.nav-link:hover,
.nav-link:focus-visible,
.nav-link:active {
  color: var(--accent);
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
  transition: color var(--transition-fast);
}

.auth-user:hover,
.auth-user:focus-visible {
  color: var(--accent);
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
}

.login-link:disabled {
  cursor: progress;
  color: var(--text-tertiary);
}

.icon-button {
  width: 36px;
  padding: 0;
}

.nav-action-button {
  flex: 0 0 auto;
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
