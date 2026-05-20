<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "@/i18n/useI18n";
import { getPublishedArticles } from "../../api/articles";
import ArticleMasonryCard from "../../components/article/ArticleMasonryCard.vue";
import type { Article } from "../../types/article";

const { t } = useI18n();
const route = useRoute();
const articles = ref<Article[]>([]);
const isLoadingArticles = ref(true);
const articlesLoadError = ref("");

const activeTag = computed(() => {
  const tag = route.params.tag;
  return typeof tag === "string" ? tag.trim() : "";
});

const filteredArticles = computed(() => {
  if (!activeTag.value) {
    return articles.value;
  }

  const normalizedTag = activeTag.value.toLocaleLowerCase();
  return articles.value.filter((article) =>
    article.tags.some((tag) => tag.toLocaleLowerCase() === normalizedTag),
  );
});

const hasArticles = computed(() => filteredArticles.value.length > 0);
const pageTitle = computed(() =>
  activeTag.value ? t("articles.tagTitle", { tag: activeTag.value }) : t("articles.all"),
);
const pageDescription = computed(() =>
  activeTag.value
    ? t("articles.tagDescription", { count: filteredArticles.value.length })
    : "",
);

const loadArticles = async () => {
  isLoadingArticles.value = true;
  articlesLoadError.value = "";

  try {
    articles.value = await getPublishedArticles();
  } catch (error) {
    articles.value = [];
    articlesLoadError.value =
      error instanceof Error ? error.message : t("articles.loadError");
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
    <h2 class="section-title">{{ pageTitle }}</h2>
    <p v-if="pageDescription" class="filter-copy">
      <span>{{ pageDescription }}</span>
      <RouterLink class="filter-link" to="/articles">{{ t("articles.viewAll") }}</RouterLink>
    </p>
    <p v-if="isLoadingArticles" class="status-copy" aria-live="polite">{{ t("articles.loading") }}</p>
    <p v-else-if="articlesLoadError" class="status-copy status-error">{{ articlesLoadError }}</p>
    <p v-else-if="!hasArticles" class="status-copy">{{ t("articles.empty") }}</p>
    <section v-else class="masonry-grid">
      <RouterLink
        v-for="article in filteredArticles"
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
.filter-copy { display: flex; align-items: center; justify-content: center; gap: var(--space-3); flex-wrap: wrap; margin: calc(var(--space-8) * -1) 0 var(--space-6); text-align: center; color: var(--text-secondary); font-size: 14px; }
.filter-link { position: relative; color: var(--text-secondary); text-decoration: none; transition: color var(--transition-fast); }
.filter-link::after { content: ""; position: absolute; left: 0; right: 0; bottom: -3px; height: 1px; background: currentColor; opacity: 0; transform: scaleX(0); transform-origin: right center; transition: opacity var(--transition-fast), transform var(--transition-fast); }
.filter-link:hover,
.filter-link:focus-visible { color: var(--accent); }
.filter-link:hover::after,
.filter-link:focus-visible::after { opacity: 1; transform: scaleX(1); transform-origin: left center; }
.filter-link:focus-visible { outline: none; }
.status-copy { margin-bottom: var(--space-6); text-align: center; color: var(--text-secondary); }
.status-error { color: color-mix(in oklch, var(--accent) 72%, var(--text-secondary)); }
.masonry-grid { column-count: 3; column-gap: var(--space-4); }
.item-link { display: block; color: inherit; break-inside: avoid; }
.item-link:focus-visible { outline: none; }
.item-link:focus-visible :deep(.masonry-item) { border-color: color-mix(in oklch, var(--accent) 45%, var(--border-subtle)); box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent) 18%, transparent); }
@media (max-width: 1024px) { .masonry-grid { column-count: 2; } }
@media (max-width: 768px) { .masonry-grid { column-count: 1; } }
</style>
