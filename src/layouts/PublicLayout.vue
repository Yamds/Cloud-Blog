<template>
  <main class="public-layout" aria-label="Public blog content">
    <RouterView />
  </main>
</template>

<style scoped>
.public-layout {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 96px 0 80px;
}

@media (max-width: 720px) {
  .public-layout {
    width: min(100% - 24px, 1120px);
    padding-top: 80px;
  }
}
</style>
