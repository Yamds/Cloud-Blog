<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  deleteCmsComment,
  getCmsComments,
  hideCmsComment,
  restoreCmsComment,
} from "@/api/cms-comments";
import { isApiError } from "@/api/http";
import CmsShell from "@/components/cms/CmsShell.vue";
import IconifyIcon from "@/components/common/IconifyIcon.vue";
import type { CmsComment } from "@/types/cms";
import { formatShanghaiDateTime } from "@/utils/date";

const comments = ref<CmsComment[]>([]);
const loading = ref(true);
const busyId = ref("");
const notice = ref("");
const query = ref("");
const statusFilter = ref<"all" | CmsComment["status"]>("all");

const filteredComments = computed(() => {
  const keyword = query.value.trim().toLowerCase();

  return comments.value.filter((comment) => {
    if (statusFilter.value !== "all" && comment.status !== statusFilter.value) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return [
      comment.articleTitle,
      comment.articleSlug,
      comment.authorName,
      comment.content,
    ].some((field) => field.toLowerCase().includes(keyword));
  });
});

const stats = computed(() => ({
  total: comments.value.length,
  visible: comments.value.filter((comment) => comment.status === "visible").length,
  hidden: comments.value.filter((comment) => comment.status === "hidden").length,
  deleted: comments.value.filter((comment) => comment.status === "deleted").length,
}));

async function loadComments(): Promise<void> {
  loading.value = true;
  notice.value = "";

  try {
    comments.value = await getCmsComments();
  } catch (error) {
    notice.value = isApiError(error) ? error.message : "Failed to load comments.";
  } finally {
    loading.value = false;
  }
}

async function runAction(comment: CmsComment, action: "hide" | "restore" | "delete"): Promise<void> {
  if (action === "delete") {
    const confirmed = window.confirm("Delete this comment? It will no longer appear on the public page.");
    if (!confirmed) return;
  }

  busyId.value = comment.id;
  notice.value = "";

  try {
    const updated =
      action === "hide"
        ? await hideCmsComment(comment.id)
        : action === "restore"
          ? await restoreCmsComment(comment.id)
          : await deleteCmsComment(comment.id);

    comments.value = comments.value.map((item) => (item.id === updated.id ? updated : item));
    notice.value =
      action === "hide"
        ? "Comment hidden."
        : action === "restore"
          ? "Comment restored."
          : "Comment deleted.";
  } catch (error) {
    notice.value = isApiError(error) ? error.message : "Action failed. Please try again.";
  } finally {
    busyId.value = "";
  }
}

function statusLabel(status: CmsComment["status"]): string {
  return status === "visible" ? "Visible" : status === "hidden" ? "Hidden" : "Deleted";
}

onMounted(() => {
  void loadComments();
});
</script>

<template>
  <CmsShell title="评论管理" subtitle="查看、隐藏、恢复或删除公开文章下的评论。">
    <p v-if="notice" class="notice">{{ notice }}</p>

    <section class="stat-grid">
      <div class="stat-item">
        <span>总评论</span>
        <strong>{{ stats.total }}</strong>
      </div>
      <div class="stat-item">
        <span>可见</span>
        <strong>{{ stats.visible }}</strong>
      </div>
      <div class="stat-item">
        <span>隐藏</span>
        <strong>{{ stats.hidden }}</strong>
      </div>
      <div class="stat-item">
        <span>删除</span>
        <strong>{{ stats.deleted }}</strong>
      </div>
    </section>

    <section class="toolbar">
      <input v-model="query" type="search" placeholder="搜索作者、文章或评论内容" />
      <select v-model="statusFilter" aria-label="评论状态">
        <option value="all">全部状态</option>
        <option value="visible">可见</option>
        <option value="hidden">隐藏</option>
        <option value="deleted">删除</option>
      </select>
      <button type="button" class="text-action" :disabled="loading" @click="loadComments">
        <IconifyIcon icon="ph:arrows-clockwise" :size="16" />
        {{ loading ? "读取中" : "刷新" }}
      </button>
    </section>

    <section class="comments-table">
      <p v-if="loading" class="state-line">正在读取评论...</p>
      <p v-else-if="filteredComments.length === 0" class="state-line">当前筛选下没有评论。</p>

      <article v-for="comment in filteredComments" :key="comment.id" class="comment-row">
        <div class="comment-main">
          <div class="comment-meta">
            <strong>{{ comment.authorName }}</strong>
            <span class="status-pill" :class="comment.status">{{ statusLabel(comment.status) }}</span>
            <time :datetime="comment.createdAt">{{ formatShanghaiDateTime(comment.createdAt) }}</time>
          </div>
          <p class="comment-content">
            {{ comment.status === "deleted" ? "这条评论已删除。" : comment.content }}
          </p>
          <RouterLink class="article-link text-link" :to="`/articles/${comment.articleSlug}`">
            {{ comment.articleTitle }}
          </RouterLink>
        </div>

        <div class="comment-actions">
          <button
            v-if="comment.status === 'visible'"
            class="text-action"
            type="button"
            :disabled="busyId === comment.id"
            @click="runAction(comment, 'hide')"
          >
            隐藏
          </button>
          <button
            v-if="comment.status === 'hidden'"
            class="text-action"
            type="button"
            :disabled="busyId === comment.id"
            @click="runAction(comment, 'restore')"
          >
            恢复
          </button>
          <button
            class="text-action"
            type="button"
            :disabled="busyId === comment.id || comment.status === 'deleted'"
            @click="runAction(comment, 'delete')"
          >
            删除
          </button>
        </div>
      </article>
    </section>
  </CmsShell>
</template>

<style scoped>
.notice,
.state-line {
  margin-bottom: var(--space-4);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 13px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.stat-item {
  padding: var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
}
.stat-item span {
  color: var(--text-secondary);
  font-size: 13px;
}
.stat-item strong {
  display: block;
  margin-top: 6px;
  font-family: var(--font-heading);
  font-size: 30px;
  font-weight: 400;
}
.toolbar {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}
.toolbar input {
  flex: 1 1 260px;
}
.toolbar select,
.toolbar button {
  min-height: 40px;
}
.text-link,
.text-action {
  position: relative;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color var(--transition-fast);
}
.text-link::after,
.text-action::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  height: 1px;
  background: currentColor;
  opacity: 0;
  transform: scaleX(0);
  transform-origin: right center;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}
.text-link:hover,
.text-link:focus-visible,
.text-action:hover,
.text-action:focus-visible {
  color: var(--accent);
}
.text-link:hover::after,
.text-link:focus-visible::after,
.text-action:hover::after,
.text-action:focus-visible::after {
  opacity: 1;
  transform: scaleX(1);
  transform-origin: left center;
}
.text-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: none;
  background: transparent;
}
.text-action:disabled {
  color: var(--text-tertiary);
}
.text-action:disabled::after {
  display: none;
}
.text-link:focus-visible,
.text-action:focus-visible {
  outline: none;
}
.comments-table {
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--bg-elevated);
}
.comment-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-3);
  padding: var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}
.comment-row:last-child {
  border-bottom: 0;
}
.comment-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.comment-meta time,
.article-link {
  color: var(--text-tertiary);
  font-size: 13px;
}
.status-pill {
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 12px;
}
.status-pill.visible {
  color: var(--accent);
  border-color: var(--accent);
}
.status-pill.deleted {
  color: var(--text-tertiary);
}
.comment-content {
  margin: var(--space-2) 0;
  color: var(--text-primary);
  line-height: 1.7;
  white-space: pre-wrap;
}
.comment-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
@media (max-width: 720px) {
  .comment-row {
    grid-template-columns: 1fr;
  }
  .comment-actions {
    justify-content: flex-start;
  }
}
</style>
