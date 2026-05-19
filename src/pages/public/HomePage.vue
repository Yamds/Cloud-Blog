<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { getPublishedArticles } from "../../api/articles";
import ArticleCard from "../../components/article/ArticleCard.vue";
import IconifyIcon from "../../components/common/IconifyIcon.vue";
import type { Article } from "../../types/article";

const heroRef = ref<HTMLElement | null>(null);
const articleListRef = ref<HTMLElement | null>(null);
const prefersReducedMotion = ref(false);
const isAutoScrolling = ref(false);
const articles = ref<Article[]>([]);
const isLoadingArticles = ref(true);
const articlesLoadError = ref("");

const featuredArticles = computed(() => articles.value.slice(0, 4));

const NAV_HEIGHT = 68;
const ARTICLE_TOP_GAP = 28;
const WHEEL_DELTA_THRESHOLD = 18;
const SNAP_RELEASE_MS = 820;

let motionQuery: MediaQueryList | null = null;
let snapReleaseTimer = 0;

const clearSnapLock = () => {
  isAutoScrolling.value = false;

  if (snapReleaseTimer) {
    window.clearTimeout(snapReleaseTimer);
    snapReleaseTimer = 0;
  }
};

const getScrollTarget = (element: HTMLElement, offset = 0) =>
  Math.max(0, window.scrollY + element.getBoundingClientRect().top - offset);

const scrollToTarget = (top: number) => {
  if (prefersReducedMotion.value) {
    window.scrollTo({ top });
    return;
  }

  clearSnapLock();
  isAutoScrolling.value = true;
  window.scrollTo({ top, behavior: "smooth" });
  snapReleaseTimer = window.setTimeout(() => {
    clearSnapLock();
  }, SNAP_RELEASE_MS);
};

const scrollToHero = () => {
  if (!heroRef.value) {
    return;
  }

  scrollToTarget(getScrollTarget(heroRef.value, NAV_HEIGHT));
};

const scrollToArticles = () => {
  if (!articleListRef.value) {
    return;
  }

  scrollToTarget(getScrollTarget(articleListRef.value, NAV_HEIGHT + ARTICLE_TOP_GAP));
};

const handleWheel = (event: WheelEvent) => {
  if (prefersReducedMotion.value || Math.abs(event.deltaY) < WHEEL_DELTA_THRESHOLD) {
    return;
  }

  const hero = heroRef.value;
  const articleList = articleListRef.value;

  if (!hero || !articleList) {
    return;
  }

  if (isAutoScrolling.value) {
    event.preventDefault();
    return;
  }

  const heroRect = hero.getBoundingClientRect();
  const articleRect = articleList.getBoundingClientRect();
  const heroOwnsViewport =
    heroRect.top <= NAV_HEIGHT + 24 && heroRect.bottom >= window.innerHeight * 0.58;
  const articleSnapZone =
    articleRect.top >= NAV_HEIGHT - 16 &&
    articleRect.top <= NAV_HEIGHT + ARTICLE_TOP_GAP + 72;

  if (event.deltaY > 0 && heroOwnsViewport && articleRect.top > NAV_HEIGHT + ARTICLE_TOP_GAP) {
    event.preventDefault();
    scrollToArticles();
    return;
  }

  if (event.deltaY < 0 && articleSnapZone) {
    event.preventDefault();
    scrollToHero();
  }
};

const handleMotionChange = (event: MediaQueryListEvent) => {
  prefersReducedMotion.value = event.matches;

  if (event.matches) {
    clearSnapLock();
  }
};

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
  motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  prefersReducedMotion.value = motionQuery.matches;
  motionQuery.addEventListener("change", handleMotionChange);
  window.addEventListener("wheel", handleWheel, { passive: false });
  void loadArticles();
});

onBeforeUnmount(() => {
  window.removeEventListener("wheel", handleWheel);
  motionQuery?.removeEventListener("change", handleMotionChange);
  clearSnapLock();
});
</script>

<template>
  <main class="home-page">
    <section ref="heroRef" class="hero">
      <div class="hero-copy">
        <h1 class="hero-title">Yamds's Blog</h1>
        <p class="hero-subtitle">thoughts, craft & code</p>
      </div>
      <button
        class="hero-scroll-hint"
        type="button"
        aria-label="滚动到文章列表"
        title="滚动到文章列表"
        @click="scrollToArticles"
      >
        <IconifyIcon icon="ph:caret-down" :size="24" aria-label="滚动到文章列表" />
      </button>
    </section>

    <section ref="articleListRef" class="article-list">
      <h2 class="section-title">Recent Writings</h2>
      <p v-if="isLoadingArticles" class="status-copy" aria-live="polite">文章加载中...</p>
      <p v-else-if="articlesLoadError" class="status-copy status-error">{{ articlesLoadError }}</p>
      <p v-else-if="featuredArticles.length === 0" class="status-copy">公开文章还在整理中。</p>
      <div v-else class="timeline">
        <ArticleCard
          v-for="article in featuredArticles"
          :key="article.slug"
          :article="article"
          :to="`/articles/${article.slug}`"
        />
      </div>
    </section>
  </main>
</template>

<style scoped>
.home-page {
  --layout-offset: 96px;
  --nav-height: 68px;
  --article-gap: 28px;
  margin-top: calc(-1 * var(--layout-offset));
}

.hero {
  position: relative;
  min-height: calc(100vh - var(--nav-height));
  min-height: calc(100svh - var(--nav-height));
  display: grid;
  place-items: center;
  padding: clamp(var(--space-6), 10vh, var(--space-12)) var(--space-4) var(--space-8);
  text-align: center;
  scroll-margin-top: var(--nav-height);
}

.hero-copy {
  display: grid;
  gap: var(--space-2);
  max-width: 720px;
}

.hero-title {
  font-family: var(--font-heading);
  font-size: clamp(48px, 8vw, 96px);
  line-height: 1.08;
}

.hero-subtitle {
  font-family: var(--font-heading);
  font-size: clamp(16px, 2vw, 24px);
  color: var(--text-secondary);
  font-style: italic;
}

.hero-scroll-hint {
  position: absolute;
  left: 50%;
  bottom: min(5vh, var(--space-6));
  transform: translateX(-50%);
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: color-mix(in oklch, var(--bg-elevated) 82%, transparent);
  color: var(--text-tertiary);
  backdrop-filter: blur(10px);
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast),
    background var(--transition-fast);
  animation: hero-scroll-bounce 2s ease-in-out infinite;
}

.hero-scroll-hint:hover,
.hero-scroll-hint:focus-visible {
  color: var(--accent);
  border-color: color-mix(in oklch, var(--accent) 36%, var(--border-subtle));
  background: color-mix(in oklch, var(--bg-elevated) 92%, transparent);
  transform: translateX(-50%) translateY(3px);
}

.hero-scroll-hint:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent) 22%, transparent);
}

.article-list {
  max-width: 900px;
  margin: 0 auto;
  padding: var(--space-12) var(--space-4);
  scroll-margin-top: calc(var(--nav-height) + var(--article-gap));
}

.section-title {
  font-family: var(--font-heading);
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 2px;
  text-align: center;
  color: var(--text-tertiary);
  margin-bottom: var(--space-8);
  font-weight: 300;
}

.status-copy {
  margin-bottom: var(--space-6);
  text-align: center;
  color: var(--text-secondary);
}

.status-error {
  color: color-mix(in oklch, var(--accent) 72%, var(--text-secondary));
}

.timeline {
  position: relative;
  padding-left: var(--space-8);
}

.timeline::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border-subtle);
}

@keyframes hero-scroll-bounce {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }

  50% {
    transform: translateX(-50%) translateY(8px);
  }
}

@media (max-width: 768px) {
  .hero {
    padding-inline: var(--space-2);
  }

  .timeline {
    padding-left: var(--space-4);
  }
}

@media (max-width: 720px) {
  .home-page {
    --layout-offset: 80px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-scroll-hint {
    animation: none;
  }

  .hero-scroll-hint:hover,
  .hero-scroll-hint:focus-visible {
    transform: translateX(-50%);
  }
}
</style>
