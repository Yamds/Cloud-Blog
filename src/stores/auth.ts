import { computed, ref } from "vue";
import { defineStore } from "pinia";

import {
  getMe,
  loginWithGitHub as startGitHubLogin,
  logout as logoutRequest,
  type AuthUser,
} from "@/api/auth";
import { isApiError } from "@/api/http";

const isSoftAuthError = (error: unknown) =>
  isApiError(error) &&
  (error.code === "FETCH_FAILED" ||
    error.code === "NOT_FOUND" ||
    error.status === 401 ||
    error.status === 404 ||
    error.status === 405);

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const isLoading = ref(false);
  const hasLoaded = ref(false);
  let pendingLoad: Promise<AuthUser | null> | null = null;

  const isAuthenticated = computed(() => user.value !== null);
  const isAdmin = computed(() => user.value?.isAdmin ?? user.value?.role === "admin");

  const clearState = () => {
    user.value = null;
  };

  async function loadMe(force = false): Promise<AuthUser | null> {
    if (!force) {
      if (pendingLoad) {
        return pendingLoad;
      }

      if (hasLoaded.value) {
        return user.value;
      }
    }

    isLoading.value = true;
    pendingLoad = (async () => {
      try {
        const nextUser = await getMe();
        user.value = nextUser;
        hasLoaded.value = true;
        return nextUser;
      } catch (error) {
        clearState();
        hasLoaded.value = true;

        if (isSoftAuthError(error)) {
          return null;
        }

        throw error;
      } finally {
        isLoading.value = false;
        pendingLoad = null;
      }
    })();

    return pendingLoad;
  }

  function loginWithGitHub(): void {
    startGitHubLogin();
  }

  async function logout(): Promise<void> {
    try {
      await logoutRequest();
    } finally {
      clearState();
      hasLoaded.value = true;
    }
  }

  return {
    user,
    isLoading,
    isAuthenticated,
    isAdmin,
    loadMe,
    loginWithGitHub,
    logout,
  };
});
