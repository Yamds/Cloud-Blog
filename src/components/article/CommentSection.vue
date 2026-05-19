<script setup lang="ts">
import { computed, ref, watch } from "vue";
import IconifyIcon from "../common/IconifyIcon.vue";
import CommentItem from "./CommentItem.vue";
import type { ArticleComment } from "../../types/article";

const props = defineProps<{
  comments: ArticleComment[];
  isLoggedIn?: boolean;
  authLoading?: boolean;
  isLoading?: boolean;
  isSubmittingComment?: boolean;
  submittingReplyToId?: string;
  deletingCommentId?: string;
  errorMessage?: string;
  currentUserId?: string | null;
  currentUserName?: string;
  isAdmin?: boolean;
  commentsEnabled?: boolean;
  onRequestLogin?: () => void;
  onSubmitComment?: (content: string) => void | Promise<void>;
  onSubmitReply?: (payload: { commentId: string; content: string }) => void | Promise<void>;
  onDeleteComment?: (commentId: string) => void | Promise<void>;
}>();

const draft = ref("");
const replyDraft = ref("");
const replyingToId = ref("");

const totalCount = computed(() =>
  props.comments.reduce((count, comment) => count + 1 + (comment.replies?.length ?? 0), 0),
);

const normalizedDraft = computed(() => draft.value.replace(/\r\n?/g, "\n").trim());
const normalizedReplyDraft = computed(() => replyDraft.value.replace(/\r\n?/g, "\n").trim());
const rootRemaining = computed(() => 1000 - draft.value.length);
const canSubmitComment = computed(
  () =>
    props.commentsEnabled !== false &&
    !props.isSubmittingComment &&
    normalizedDraft.value.length > 0 &&
    draft.value.length <= 1000,
);
const canSubmitReply = computed(
  () =>
    !!replyingToId.value &&
    props.commentsEnabled !== false &&
    props.submittingReplyToId !== replyingToId.value &&
    normalizedReplyDraft.value.length > 0 &&
    replyDraft.value.length <= 1000,
);

watch(
  () => props.isLoggedIn,
  (isLoggedIn) => {
    if (!isLoggedIn) {
      replyingToId.value = "";
      replyDraft.value = "";
      draft.value = "";
    }
  },
);

const beginReply = (comment: ArticleComment) => {
  replyingToId.value = comment.id;
  replyDraft.value = "";
};

const cancelReply = () => {
  replyingToId.value = "";
  replyDraft.value = "";
};

const handleSubmitComment = async () => {
  if (!canSubmitComment.value) {
    return;
  }

  try {
    await props.onSubmitComment?.(normalizedDraft.value);
    draft.value = "";
  } catch {
    // The page handles API error state.
  }
};

const handleSubmitReply = async () => {
  if (!replyingToId.value || !canSubmitReply.value) {
    return;
  }

  try {
    await props.onSubmitReply?.({
      commentId: replyingToId.value,
      content: normalizedReplyDraft.value,
    });
    cancelReply();
  } catch {
    // The page handles API error state.
  }
};

const handleDeleteComment = async (comment: ArticleComment) => {
  if (typeof window !== "undefined") {
    const confirmed = window.confirm("确定删除这条评论吗？");

    if (!confirmed) {
      return;
    }
  }

  try {
    await props.onDeleteComment?.(comment.id);

    if (replyingToId.value === comment.id) {
      cancelReply();
    }
  } catch {
    // The page handles API error state.
  }
};
</script>

<template>
  <section class="comments" aria-labelledby="article-comments-title">
    <header class="comments-header">
      <div class="title-group">
        <h2 id="article-comments-title">评论 {{ totalCount }}</h2>
        <p class="helper-text">
          <span v-if="isLoggedIn && currentUserName">已登录为 {{ currentUserName }}</span>
          <span v-else>仅支持使用 GitHub 账号发表评论</span>
        </p>
      </div>

      <div class="header-actions">
        <button
          v-if="!isLoggedIn"
          type="button"
          class="github-btn"
          :disabled="authLoading"
          @click="props.onRequestLogin?.()"
        >
          <IconifyIcon icon="ph:github-logo" :size="16" />
          <span>{{ authLoading ? "检查中..." : "登录后评论" }}</span>
        </button>
      </div>
    </header>

    <p v-if="commentsEnabled === false" class="login-hint">评论发布已关闭，但历史评论仍然可见。</p>

    <div v-else-if="isLoggedIn" class="editor">
      <textarea
        v-model="draft"
        rows="4"
        maxlength="1000"
        placeholder="写点什么..."
        :disabled="isSubmittingComment"
      />
      <div class="editor-footer">
        <span class="editor-meta" :class="{ warning: rootRemaining < 0 }">{{ rootRemaining }}</span>
        <button type="button" class="submit-btn" :disabled="!canSubmitComment" @click="handleSubmitComment">
          {{ isSubmittingComment ? "发布中..." : "发布评论" }}
        </button>
      </div>
    </div>

    <p v-else class="login-hint">登录后即可评论、回复，并删除自己的评论。</p>

    <p v-if="errorMessage" class="comment-error" role="alert">{{ errorMessage }}</p>
    <p v-else-if="isLoading" class="comment-state" aria-live="polite">评论加载中...</p>

    <div v-if="comments.length" class="list">
      <CommentItem
        v-for="comment in comments"
        :key="comment.id"
        :comment="comment"
        :current-user-id="currentUserId"
        :is-admin="isAdmin"
        :show-reply-composer="replyingToId === comment.id"
        :reply-draft="replyingToId === comment.id ? replyDraft : ''"
        :reply-submitting="submittingReplyToId === comment.id"
        :delete-pending-id="deletingCommentId"
        @reply="beginReply"
        @cancel-reply="cancelReply"
        @update-reply-draft="replyDraft = $event"
        @submit-reply="handleSubmitReply"
        @delete="handleDeleteComment"
      />
    </div>

    <p v-else-if="!isLoading" class="comment-state comment-empty">还没有评论，来聊两句吧。</p>
  </section>
</template>

<style scoped>
.comments {
  margin-top: var(--space-12);
  padding-top: var(--space-6);
  border-top: 1px solid var(--border-subtle);
}

.comments-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.title-group {
  display: grid;
  gap: 6px;
}

.comments-header h2 {
  margin: 0;
  font-size: 24px;
  font-family: var(--font-body);
}

.helper-text,
.login-hint,
.comment-state,
.editor-meta {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.header-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.github-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 12px;
}

.editor {
  display: grid;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.editor textarea {
  width: 100%;
  min-height: 120px;
  padding: 14px 16px;
  resize: vertical;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: color-mix(in oklch, var(--bg-elevated) 72%, transparent);
  color: var(--text-primary);
  font: inherit;
  line-height: 1.7;
}

.editor textarea:focus-visible {
  outline: 1px solid color-mix(in oklch, var(--accent) 32%, transparent);
  outline-offset: 3px;
}

.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.editor-meta.warning {
  color: color-mix(in oklch, var(--accent) 72%, var(--text-secondary));
}

.submit-btn {
  min-height: 36px;
  padding: 0 14px;
}

.comment-error {
  margin: 0 0 var(--space-3);
  font-size: 13px;
  color: color-mix(in oklch, var(--accent) 76%, var(--text-secondary));
}

.comment-empty {
  padding-top: var(--space-2);
}

@media (max-width: 640px) {
  .editor-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
