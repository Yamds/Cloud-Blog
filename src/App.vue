<script setup lang="ts">
import { onMounted } from "vue";
import { RouterView } from "vue-router";

import AppNavbar from "@/components/common/AppNavbar.vue";
import { useAuthStore } from "@/stores/auth";
import { useLanguageStore } from "@/stores/language";
import { useThemeStore } from "@/stores/theme";

const themeStore = useThemeStore();
const languageStore = useLanguageStore();
const authStore = useAuthStore();

themeStore.initFromStorage();
languageStore.initFromStorage();

onMounted(() => {
  void authStore.loadMe();
});
</script>

<template>
  <div class="app-shell">
    <AppNavbar />
    <RouterView />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}
</style>
