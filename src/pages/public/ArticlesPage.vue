<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { getPublishedArticles } from "../../api/articles";
import ArticleMasonryCard from "../../components/article/ArticleMasonryCard.vue";
import type { Article } from "../../types/article";

const articles = ref<Article[]>([]);
const isLoadingArticles = ref(true);
const articlesLoadError = ref("");

const hasArticles = computed(() => articles.value.length > 0);

const loadArticles = async () => {
  isLoadingArticles.value = true;
  articlesLoadError.value = "";

  try {
    articles.value = await getPublishedArticles();
  } catch (error) {
    articles.value = [];
    articlesLoadError.value =
      error instanceof Error ? error.message : "文章暂时无法加载，请稍后再试。";
  } finally {
    isLoadingArticles.value = false;
  }
};

onMounted(() => {
  void loadArticles();
});
</script>

<template>
  <main class="article-list">
    <h2 class="section-title">All Articles</h2>
    <p v-if="isLoadingArticles" class="status-copy" aria-live="polite">文章加载中...</p>
    <p v-else-if="articlesLoadError" class="status-copy status-error">{{ articlesLoadError }}</p>
    <p v-else-if="!hasArticles" class="status-copy">还没有可展示的公开文章。</p>
    <section v-else class="masonry-grid">
      <RouterLink
        v-for="article in articles"
        :key="article.slug"
        class="item-link"
        :to="`/articles/${article.slug}`"
      >
        <ArticleMasonryCard :article="article" />
      </RouterLink>
    </section>
  </main>
</template>

<style scoped>
.article-list { max-width: 1200px; margin: 0 auto; padding: calc(64px + var(--space-8)) var(--space-4) var(--space-12); }
.section-title { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; text-align: center; color: var(--text-tertiary); margin-bottom: var(--space-8); }
.status-copy { margin-bottom: var(--space-6); text-align: center; color: var(--text-secondary); }
.status-error { color: color-mix(in oklch, var(--accent) 72%, var(--text-secondary)); }
.masonry-grid { column-count: 3; column-gap: var(--space-4); }
.item-link { display: block; color: inherit; }
@media (max-width: 1024px) { .masonry-grid { column-count: 2; } }
@media (max-width: 768px) { .masonry-grid { column-count: 1; } }
</style>
