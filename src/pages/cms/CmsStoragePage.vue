<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiError, isApiError } from "@/api/http";
import { deleteCmsMediaObject, getCmsMediaObjects } from "@/api/media";
import CmsShell from "@/components/cms/CmsShell.vue";
import StorageFilters from "@/components/cms/StorageFilters.vue";
import StorageObjectsTable from "@/components/cms/StorageObjectsTable.vue";
import StorageOverview from "@/components/cms/StorageOverview.vue";
import type {
  CmsDeleteMediaConflictDetails,
  CmsStorageFilters as CmsStorageFiltersModel,
  CmsStorageObject,
  CmsStorageSummary,
} from "@/types/cms";

const storageObjects = ref<CmsStorageObject[]>([]);
const actionMessage = ref("正在读取对象存储中的媒体对象。");
const loading = ref(true);
const deletePendingId = ref<string | null>(null);

const filters = ref<CmsStorageFiltersModel>({
  query: "",
  type: "all",
  status: "all",
  relation: "all",
  sortBy: "updatedAt",
  viewMode: "table",
});

function summarizeObjects(objects: CmsStorageObject[]): CmsStorageSummary {
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return objects.reduce<CmsStorageSummary>(
    (summary, item) => {
      summary.totalObjects += 1;
      summary.totalBytes += item.sizeBytes;
      summary.linkedCount += item.relatedArticle ? 1 : 0;
      summary.processingCount += item.status === "processing" ? 1 : 0;
      summary.orphanedCount += item.status === "orphaned" ? 1 : 0;
      summary.updatedRecentlyCount += Date.parse(item.updatedAt) >= recentCutoff ? 1 : 0;

      if (item.type === "image") {
        summary.imageCount += 1;
      } else {
        summary.attachmentCount += 1;
      }

      return summary;
    },
    {
      totalObjects: 0,
      imageCount: 0,
      attachmentCount: 0,
      totalBytes: 0,
      linkedCount: 0,
      processingCount: 0,
      orphanedCount: 0,
      updatedRecentlyCount: 0,
    },
  );
}

const storageSummaryState = computed(() => summarizeObjects(storageObjects.value));

const filteredObjects = computed(() => {
  const query = filters.value.query.trim().toLowerCase();
  const items = storageObjects.value.filter((item) => {
    if (filters.value.type !== "all" && item.type !== filters.value.type) {
      return false;
    }

    if (filters.value.status !== "all" && item.status !== filters.value.status) {
      return false;
    }

    if (filters.value.relation === "linked" && !item.relatedArticle) {
      return false;
    }

    if (filters.value.relation === "unlinked" && item.relatedArticle) {
      return false;
    }

    if (!query) {
      return true;
    }

    const articleTitle = item.relatedArticle?.articleTitle ?? "";
    return [getDisplayName(item), item.key, item.mime, item.type, articleTitle].some((field) =>
      field.toLowerCase().includes(query),
    );
  });

  const sorted = [...items];
  sorted.sort((left, right) => {
    if (filters.value.sortBy === "sizeBytes") {
      return right.sizeBytes - left.sizeBytes;
    }

    if (filters.value.sortBy === "key") {
      return getDisplayName(left).localeCompare(getDisplayName(right), "zh-CN");
    }

    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });

  return sorted;
});

const filteredBytes = computed(() =>
  filteredObjects.value.reduce((sum, item) => sum + item.sizeBytes, 0),
);

function buildErrorMessage(error: unknown): string {
  return isApiError(error) ? error.message : "请求失败，请稍后重试。";
}

function extractDeleteConflictDetails(error: unknown): CmsDeleteMediaConflictDetails | null {
  if (!(error instanceof ApiError) || error.code !== "MEDIA_IN_USE") {
    return null;
  }

  const details = error.details;

  if (typeof details !== "object" || details === null || !("details" in details)) {
    return null;
  }

  const payloadDetails = (details as { details?: unknown }).details;

  if (typeof payloadDetails !== "object" || payloadDetails === null) {
    return null;
  }

  return payloadDetails as CmsDeleteMediaConflictDetails;
}

function formatReferenceReason(details: CmsDeleteMediaConflictDetails): string {
  if (details.references.length === 0) {
    return "该媒体仍被正文引用，默认阻止删除。";
  }

  const lines = details.references.map((reference, index) => {
    const via = reference.matchedBy
      .map((entry) => (entry === "url" ? "URL" : "object key"))
      .join(" + ");

    const statusLabel =
      reference.articleStatus === "published"
        ? "已发布"
        : reference.articleStatus === "draft"
          ? "草稿"
          : "归档";

    return `${index + 1}. [${statusLabel}] ${reference.articleTitle}（${via}）`;
  });

  return [`删除已被阻止，以下文章正文仍在引用这个媒体：`, ...lines].join("\n");
}

function getDisplayName(item: CmsStorageObject): string {
  return item.filename || item.key.split("/").filter(Boolean).pop() || item.key;
}

function getPublicMediaUrl(item: CmsStorageObject): string {
  return item.previewUrl || `/api/cms/media/${encodeURIComponent(getDisplayName(item))}`;
}

async function loadStorageData(options: { silent?: boolean } = {}): Promise<void> {
  if (!options.silent) {
    loading.value = true;
  }

  const mediaResult = await getCmsMediaObjects().then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason) => ({ status: "rejected" as const, reason }),
  );
  const notes: string[] = [];

  if (mediaResult.status === "fulfilled") {
    storageObjects.value = mediaResult.value.objects;
    notes.push(`已加载 ${mediaResult.value.objects.length} 个媒体对象。`);
  } else {
    storageObjects.value = [];
    notes.push(`对象列表读取失败：${buildErrorMessage(mediaResult.reason)}`);
  }

  actionMessage.value = notes.join(" ");
  loading.value = false;
}

async function handleCopy(item: CmsStorageObject): Promise<void> {
  const targetUrl = getPublicMediaUrl(item);

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(targetUrl);
      actionMessage.value = `已复制访问路径：${targetUrl}`;
      return;
    }
  } catch {
    // Fall through to the fallback message below.
  }

  actionMessage.value = "当前环境不支持剪贴板写入，可直接从列表中复制访问路径。";
}

function handlePreview(item: CmsStorageObject): void {
  const targetUrl = getPublicMediaUrl(item);

  window.open(targetUrl, "_blank", "noopener,noreferrer");
  actionMessage.value = `已打开预览：${getDisplayName(item)}`;
}

async function handleRemove(item: CmsStorageObject): Promise<void> {
  const displayName = getDisplayName(item);
  const confirmed = window.confirm(`确认删除这个文件吗？\n${displayName}`);

  if (!confirmed) {
    return;
  }

  actionMessage.value = `正在删除：${displayName}`;
  deletePendingId.value = item.id;

  try {
    await deleteCmsMediaObject(item.id);
    storageObjects.value = storageObjects.value.filter((current) => current.id !== item.id);
    actionMessage.value = `已删除文件与元数据：${displayName}`;
  } catch (error) {
    const conflictDetails = extractDeleteConflictDetails(error);

    if (conflictDetails) {
      actionMessage.value = formatReferenceReason(conflictDetails);

      const forceConfirmed = window.confirm(
        `${formatReferenceReason(conflictDetails)}\n\n如确认这批正文引用已失效，可继续强制删除。`,
      );

      if (forceConfirmed) {
        actionMessage.value = `正在强制删除：${displayName}`;

        try {
          await deleteCmsMediaObject(item.id, { force: true });
          storageObjects.value = storageObjects.value.filter((current) => current.id !== item.id);
          actionMessage.value = `已强制删除文件：${displayName}。请尽快清理对应文章中的失效引用。`;
        } catch (forceError) {
          actionMessage.value = `强制删除失败：${buildErrorMessage(forceError)}`;
        }
      }
    } else {
      actionMessage.value = `删除失败：${buildErrorMessage(error)}`;
    }
  } finally {
    deletePendingId.value = null;
  }
}

onMounted(() => {
  void loadStorageData();
});
</script>

<template>
  <CmsShell title="对象存储" subtitle="管理正文图片，以及它们与文章之间的关系。">
    <p class="status-line">
      {{ loading ? "正在同步对象列表..." : actionMessage }}
    </p>
    <p v-if="deletePendingId" class="status-line status-line--active">
      删除进行中，正在校验正文引用并同步对象存储。
    </p>

    <StorageOverview
      :summary="storageSummaryState"
      :visible-count="filteredObjects.length"
      :visible-bytes="filteredBytes"
    />

    <div class="storage-workspace">
      <div class="main-column">
        <StorageFilters v-model="filters" :total-count="storageObjects.length" :visible-count="filteredObjects.length" />
        <StorageObjectsTable
          :objects="filteredObjects"
          :view-mode="filters.viewMode"
          @preview="handlePreview"
          @copy="handleCopy"
          @remove="handleRemove"
        />
      </div>
    </div>
  </CmsShell>
</template>

<style scoped>
.status-line {
  margin-bottom: var(--space-4);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 13px;
  white-space: pre-line;
}

.status-line--active {
  margin-top: calc(var(--space-4) * -1);
  margin-bottom: var(--space-4);
  color: var(--text-primary);
  border-color: color-mix(in oklch, var(--accent) 28%, var(--border-subtle));
  white-space: normal;
}

.storage-workspace {
  display: grid;
  gap: var(--space-4);
}

.main-column {
  min-width: 0;
}
</style>
