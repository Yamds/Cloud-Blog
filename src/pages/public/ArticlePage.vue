<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { recordPageView } from "@/api/analytics";
import { getSiteSettings } from "@/api/settings";
import { getArticleBySlug } from "../../api/articles";
import {
  createArticleComment,
  createCommentReply,
  deleteComment,
  getArticleComments,
} from "../../api/comments";
import ArticleHeader from "../../components/article/ArticleHeader.vue";
import ArticleContent from "../../components/article/ArticleContent.vue";
import ArticleCopyrightInfo from "../../components/article/ArticleCopyrightInfo.vue";
import CommentSection from "../../components/article/CommentSection.vue";
import type { Article, ArticleComment } from "../../types/article";
import { useAuthStore } from "@/stores/auth";
import { createArticleHeadingId, getArticleBlockText } from "@/utils/articleContent";

const route = useRoute();
const authStore = useAuthStore();
const { isAdmin, isAuthenticated, isLoading: isAuthLoading, user } = storeToRefs(authStore);
const article = ref<Article>();
const comments = ref<ArticleComment[]>([]);
const isLoadingArticle = ref(true);
const isLoadingComments = ref(false);
const isSubmittingComment = ref(false);
const submittingReplyToId = ref("");
const deletingCommentId = ref("");
const articleLoadError = ref("");
const commentsError = ref("");
const commentsEnabled = ref(true);
const siteOrigin = ref("");
const activeHeadingId = ref("");
const lastRecordedPageViewSlug = ref("");
const OUTLINE_SCROLL_EXTRA_GAP = 24;
const SITE_TITLE = "Yamds's Blog";
const slug = computed(() => String(route.params.slug ?? ""));
const currentUserId = computed(() => user.value?.id ?? null);
const currentUserName = computed(() => user.value?.githubLogin ?? "");
const outlineItems = computed(() =>
  (article.value?.content ?? [])
    .map((block, index) => ({
      id: createArticleHeadingId(block, index),
      level: block.level ?? 2,
      text: getArticleBlockText(block),
      type: block.type,
    }))
    .filter((item) => item.type === "heading" && item.text),
);

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const loadComments = async (targetSlug: string, options: { silent?: boolean } = {}) => {
  if (!targetSlug) {
    comments.value = [];
    commentsError.value = "";
    isLoadingComments.value = false;
    return;
  }

  if (!options.silent) {
    isLoadingComments.value = true;
  }

  commentsError.value = "";

  try {
    comments.value = await getArticleComments(targetSlug);
  } catch (error) {
    comments.value = [];
    commentsError.value = getErrorMessage(error, "评论暂时无法加载，请稍后再试。");
  } finally {
    isLoadingComments.value = false;
  }
};

const loadArticle = async (targetSlug: string) => {
  if (!targetSlug) {
    article.value = undefined;
    comments.value = [];
    articleLoadError.value = "";
    commentsError.value = "";
    isLoadingArticle.value = false;
    isLoadingComments.value = false;
    return;
  }

  isLoadingArticle.value = true;
  articleLoadError.value = "";

  try {
    const settings = await getSiteSettings().catch(() => null);
    commentsEnabled.value = settings?.commentsEnabled ?? true;
    siteOrigin.value = window.location.origin;
    article.value = await getArticleBySlug(targetSlug);

    if (article.value) {
      void recordArticlePageView(targetSlug);
      await loadComments(targetSlug);
    } else {
      comments.value = [];
      commentsError.value = "";
      isLoadingComments.value = false;
    }
  } catch (error) {
    article.value = undefined;
    comments.value = [];
    commentsError.value = "";
    articleLoadError.value = getErrorMessage(error, "文章暂时无法加载，请稍后再试。");
  } finally {
    isLoadingArticle.value = false;
  }
};

async function recordArticlePageView(targetSlug: string): Promise<void> {
  if (lastRecordedPageViewSlug.value === targetSlug) {
    return;
  }

  lastRecordedPageViewSlug.value = targetSlug;

  try {
    await recordPageView({
      path: `/articles/${targetSlug}`,
      slug: targetSlug,
    });
  } catch {
    // Analytics should never interrupt reading.
  }
}

const handleLoginRequest = () => {
  authStore.loginWithGitHub();
};

const handleSubmitComment = async (content: string) => {
  if (!slug.value) {
    return;
  }

  isSubmittingComment.value = true;
  commentsError.value = "";

  try {
    await createArticleComment(slug.value, content);
    await loadComments(slug.value, { silent: true });
  } catch (error) {
    commentsError.value = getErrorMessage(error, "评论发布失败，请稍后再试。");
    throw error;
  } finally {
    isSubmittingComment.value = false;
  }
};

const handleSubmitReply = async (payload: { commentId: string; content: string }) => {
  if (!slug.value) {
    return;
  }

  submittingReplyToId.value = payload.commentId;
  commentsError.value = "";

  try {
    await createCommentReply(payload.commentId, payload.content);
    await loadComments(slug.value, { silent: true });
  } catch (error) {
    commentsError.value = getErrorMessage(error, "回复发布失败，请稍后再试。");
    throw error;
  } finally {
    submittingReplyToId.value = "";
  }
};

const handleDeleteComment = async (commentId: string) => {
  if (!slug.value) {
    return;
  }

  deletingCommentId.value = commentId;
  commentsError.value = "";

  try {
    await deleteComment(commentId);
    await loadComments(slug.value, { silent: true });
  } catch (error) {
    commentsError.value = getErrorMessage(error, "评论删除失败，请稍后再试。");
    throw error;
  } finally {
    deletingCommentId.value = "";
  }
};

function updateActiveOutline(): void {
  let currentHeadingId = outlineItems.value[0]?.id ?? "";
  const activationOffset = getOutlineScrollOffset() + OUTLINE_SCROLL_EXTRA_GAP;

  outlineItems.value.forEach((item) => {
    const element = document.getElementById(item.id);

    if (element && element.getBoundingClientRect().top <= activationOffset) {
      currentHeadingId = item.id;
    }
  });

  activeHeadingId.value = currentHeadingId;
}

function getOutlineScrollOffset(): number {
  const navbar = document.querySelector<HTMLElement>(".navbar");
  return (navbar?.getBoundingClientRect().height ?? 68) + OUTLINE_SCROLL_EXTRA_GAP;
}

function scrollToOutlineItem(id: string): void {
  const target = document.getElementById(id);

  if (!target) {
    return;
  }

  const targetTop = target.getBoundingClientRect().top + window.scrollY - getOutlineScrollOffset();
  window.scrollTo({ top: Math.max(targetTop, 0), behavior: "smooth" });
  activeHeadingId.value = id;
}

watch(
  slug,
  (currentSlug) => {
    void loadArticle(currentSlug);
  },
  { immediate: true },
);

watch(article, () => {
  document.title = article.value ? `${article.value.title} - ${SITE_TITLE}` : SITE_TITLE;
  void nextTick(updateActiveOutline);
});

onMounted(() => {
  window.addEventListener("scroll", updateActiveOutline, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", updateActiveOutline);
  document.title = SITE_TITLE;
});
</script>

<template>
  <main class="article-page">
    <div v-if="article" class="article-wrapper" :class="{ 'without-outline': outlineItems.length === 0 }">
      <aside v-if="outlineItems.length" class="outline-sidebar">
        <div class="outline-title">
          <span>目录</span>
        </div>
        <ul class="outline-list">
          <li
            v-for="item in outlineItems"
            :key="item.id"
            class="outline-item"
            :class="`level-${item.level}`"
          >
            <a
              class="outline-link"
              :class="{ active: activeHeadingId === item.id }"
              :href="`#${item.id}`"
              @click.prevent="scrollToOutlineItem(item.id)"
            >
              {{ item.text }}
            </a>
          </li>
        </ul>
      </aside>

      <article class="article-container">
        <RouterLink class="back" to="/articles">返回列表</RouterLink>
        <ArticleHeader :article="article" />
        <div class="divider" />
        <ArticleContent :content="article.content" />
        <ArticleCopyrightInfo :article="article" :site-origin="siteOrigin" />
        <CommentSection
          :comments="comments"
          :is-logged-in="isAuthenticated"
          :auth-loading="isAuthLoading"
          :is-loading="isLoadingComments"
          :is-submitting-comment="isSubmittingComment"
          :submitting-reply-to-id="submittingReplyToId"
          :deleting-comment-id="deletingCommentId"
          :error-message="commentsError"
          :current-user-id="currentUserId"
          :current-user-name="currentUserName"
          :is-admin="isAdmin"
          :comments-enabled="commentsEnabled"
          :on-request-login="handleLoginRequest"
          :on-submit-comment="handleSubmitComment"
          :on-submit-reply="handleSubmitReply"
          :on-delete-comment="handleDeleteComment"
        />
      </article>
    </div>

    <section v-else-if="isLoadingArticle" class="status-state">
      <p aria-live="polite">文章加载中...</p>
    </section>

    <section v-else-if="articleLoadError" class="status-state status-error">
      <h1>文章暂时不可用</h1>
      <p>{{ articleLoadError }}</p>
      <RouterLink class="back-link" to="/articles">回到文章列表</RouterLink>
    </section>

    <section v-else class="empty-state">
      <h1>文章不存在</h1>
      <p>当前 slug 未找到对应内容。</p>
      <RouterLink class="back-link" to="/articles">回到文章列表</RouterLink>
    </section>
  </main>
</template>

<style scoped>
.article-page { padding: calc(64px + var(--space-8)) var(--space-4) var(--space-12); }
.article-wrapper { max-width: 1400px; margin: 0 auto; display: grid; grid-template-columns: 240px minmax(0, 720px); gap: var(--space-8); justify-content: center; align-items: start; }
.article-wrapper.without-outline { grid-template-columns: minmax(0, 720px); }
.outline-sidebar { position: sticky; top: calc(64px + var(--space-4)); align-self: start; }
.outline-title { font-size: 14px; font-weight: 500; color: var(--text-primary); margin-bottom: var(--space-3); }
.outline-list { list-style: none; padding: 0; margin: 0; }
.outline-item { margin-bottom: var(--space-1); }
.outline-item.level-1 { padding-left: 0; }
.outline-item.level-2 { padding-left: var(--space-1); }
.outline-item.level-3 { padding-left: var(--space-3); }
.outline-item.level-4 { padding-left: var(--space-4); }
.outline-item.level-5 { padding-left: calc(var(--space-4) + var(--space-2)); }
.outline-item.level-6 { padding-left: var(--space-6); }
.outline-link { display: block; padding: var(--space-1) var(--space-2); font-size: 13px; color: var(--text-secondary); text-decoration: none; border-radius: 4px; transition: all 0.2s ease; }
.outline-link:hover, .outline-link.active { background: var(--bg-elevated); color: var(--accent); }
.article-container { max-width: 720px; margin: 0 auto; width: 100%; }
.back { display: inline-block; margin-bottom: var(--space-6); color: var(--text-tertiary); }
.back:hover { color: var(--accent); }
.divider { width: 60px; height: 1px; margin: var(--space-8) auto; background: var(--border); }
.status-state { max-width: 720px; margin: 0 auto; text-align: center; padding-top: var(--space-12); color: var(--text-secondary); }
.status-state h1 { color: var(--text-primary); }
.status-error p { color: color-mix(in oklch, var(--accent) 72%, var(--text-secondary)); margin: var(--space-2) 0 var(--space-4); }
.empty-state { max-width: 720px; margin: 0 auto; text-align: center; padding-top: var(--space-12); }
.empty-state p { color: var(--text-secondary); margin: var(--space-2) 0 var(--space-4); }
.back-link { color: var(--accent); }
@media (max-width: 1024px) {
  .article-wrapper { grid-template-columns: minmax(0, 720px); }
  .outline-sidebar { display: none; }
}
</style>
