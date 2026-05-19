<script setup lang="ts">
import { computed } from "vue";
import IconifyIcon from "../common/IconifyIcon.vue";
import type { ArticleComment } from "../../types/article";

const props = defineProps<{
  comment: ArticleComment;
  nested?: boolean;
  currentUserId?: string | null;
  isAdmin?: boolean;
  showReplyComposer?: boolean;
  replyDraft?: string;
  replySubmitting?: boolean;
  deletePendingId?: string;
}>();

const emit = defineEmits<{
  reply: [comment: ArticleComment];
  cancelReply: [];
  updateReplyDraft: [value: string];
  submitReply: [];
  delete: [comment: ArticleComment];
}>();

const canReply = computed(() => !props.nested);
const canDelete = computed(
  () =>
    !!props.currentUserId &&
    (props.comment.authorId === props.currentUserId || Boolean(props.isAdmin)),
);
const isDeleting = computed(() => props.deletePendingId === props.comment.id);
const formattedTime = computed(() => {
  const timestamp = Date.parse(props.comment.createdAt);

  if (Number.isNaN(timestamp)) {
    return props.comment.createdAt;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
});
</script>

<template>
  <article class="comment-item" :class="{ nested }">
    <a
      v-if="comment.authorAvatar && comment.authorHtmlUrl"
      class="avatar-link"
      :href="comment.authorHtmlUrl"
      target="_blank"
      rel="noreferrer"
      :aria-label="`${comment.authorName} 的 GitHub 主页`"
    >
      <img class="avatar" :src="comment.authorAvatar" :alt="`${comment.authorName} 的头像`" />
    </a>
    <img
      v-else-if="comment.authorAvatar"
      class="avatar"
      :src="comment.authorAvatar"
      :alt="`${comment.authorName} 的头像`"
    />
    <span v-else class="avatar avatar-fallback" aria-hidden="true">
      <IconifyIcon icon="ph:user-circle" :size="20" />
    </span>

    <div class="body">
      <header class="meta">
        <a
          v-if="comment.authorHtmlUrl"
          class="author-link"
          :href="comment.authorHtmlUrl"
          target="_blank"
          rel="noreferrer"
        >
          {{ comment.authorName }}
        </a>
        <strong v-else>{{ comment.authorName }}</strong>
        <time :datetime="comment.createdAt">{{ formattedTime }}</time>
      </header>

      <p class="content">{{ comment.content }}</p>

      <div class="actions">
        <button
          v-if="canReply"
          class="action-btn"
          type="button"
          :disabled="replySubmitting"
          @click="showReplyComposer ? emit('cancelReply') : emit('reply', comment)"
        >
          {{ showReplyComposer ? "收起回复" : "回复" }}
        </button>

        <button
          v-if="canDelete"
          class="action-btn"
          type="button"
          :disabled="isDeleting"
          @click="emit('delete', comment)"
        >
          {{ isDeleting ? "删除中..." : "删除" }}
        </button>
      </div>

      <div v-if="showReplyComposer" class="reply-editor">
        <textarea
          :value="replyDraft"
          rows="3"
          maxlength="1000"
          placeholder="写下你的回复..."
          :disabled="replySubmitting"
          @input="emit('updateReplyDraft', ($event.target as HTMLTextAreaElement).value)"
        />
        <div class="reply-footer">
          <span class="reply-meta">{{ 1000 - (replyDraft?.length ?? 0) }}</span>
          <div class="reply-actions">
            <button class="action-btn" type="button" :disabled="replySubmitting" @click="emit('cancelReply')">
              取消
            </button>
            <button class="submit-btn" type="button" :disabled="replySubmitting" @click="emit('submitReply')">
              {{ replySubmitting ? "发送中..." : "发送回复" }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="comment.replies?.length" class="replies">
        <CommentItem
          v-for="reply in comment.replies"
          :key="reply.id"
          :comment="reply"
          nested
          :current-user-id="currentUserId"
          :is-admin="isAdmin"
          :delete-pending-id="deletePendingId"
          @delete="emit('delete', $event)"
        />
      </div>
    </div>
  </article>
</template>

<style scoped>
.comment-item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4) 0;
  border-top: 1px solid var(--border-subtle);
}

.comment-item.nested {
  margin-left: var(--space-5);
  padding-top: var(--space-3);
  border-top: 0;
}

.avatar-link,
.avatar {
  display: inline-flex;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
}

.avatar-fallback {
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}

.body {
  flex: 1;
  min-width: 0;
}

.meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--text-tertiary);
}

.author-link {
  color: var(--text-primary);
}

.author-link:hover {
  color: var(--accent);
}

.content {
  margin: 8px 0 10px;
  color: var(--text-primary);
  white-space: pre-wrap;
  line-height: 1.8;
}

.actions,
.reply-actions,
.reply-footer {
  display: flex;
  align-items: center;
  gap: 12px;
}

.action-btn {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
}

.action-btn:hover,
.action-btn:focus-visible {
  background: transparent;
  color: var(--accent);
}

.reply-editor {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.reply-editor textarea {
  width: 100%;
  padding: 12px 14px;
  resize: vertical;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: color-mix(in oklch, var(--bg-elevated) 72%, transparent);
  color: var(--text-primary);
  font: inherit;
  line-height: 1.7;
}

.reply-footer {
  justify-content: space-between;
  flex-wrap: wrap;
}

.reply-meta {
  font-size: 13px;
  color: var(--text-secondary);
}

.submit-btn {
  min-height: 32px;
  padding: 0 12px;
}

.replies {
  margin-top: var(--space-3);
  padding-left: var(--space-3);
  border-left: 1px solid var(--border-subtle);
}

@media (max-width: 640px) {
  .comment-item.nested {
    margin-left: var(--space-3);
  }

  .reply-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
