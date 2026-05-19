<template>
  <main class="cms-layout" aria-label="CMS workspace">
    <RouterView />
  </main>
</template>

<style scoped>
.cms-layout {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
  padding: 96px 0 80px;
}

@media (max-width: 720px) {
  .cms-layout {
    width: min(100% - 24px, 1180px);
    padding-top: 80px;
  }
}
</style>
