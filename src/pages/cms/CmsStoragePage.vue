<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiError, isApiError } from "@/api/http";
import { deleteCmsMediaObject, getCmsMediaObjects } from "@/api/media";
import CmsShell from "@/components/cms/CmsShell.vue";
import StorageFilters from "@/components/cms/StorageFilters.vue";
import StorageObjectsTable from "@/components/cms/StorageObjectsTable.vue";
import StorageOverview from "@/components/cms/StorageOverview.vue";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import type {
  CmsDeleteMediaConflictDetails,
  CmsStorageFilters as CmsStorageFiltersModel,
  CmsStorageObject,
  CmsStorageSummary,
} from "@/types/cms";

type MessageState =
  | {
      key: MessageKey;
      params?: Record<string, string | number>;
    }
  | {
      referenceDetails: CmsDeleteMediaConflictDetails;
    };

const storageObjects = ref<CmsStorageObject[]>([]);
const loading = ref(true);
const deletePendingId = ref<string | null>(null);
const { locale, t } = useI18n();
const actionMessage = ref<MessageState>({ key: "cms.storage.loadingInitial" });
const actionMessageText = computed(() => {
  if ("referenceDetails" in actionMessage.value) {
    return formatReferenceReason(actionMessage.value.referenceDetails);
  }

  return t(actionMessage.value.key, actionMessage.value.params);
});
const localeTag = computed(() => (locale.value === "zh" ? "zh-CN" : "en-US"));

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
      return getDisplayName(left).localeCompare(getDisplayName(right), localeTag.value);
    }

    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });

  return sorted;
});

const filteredBytes = computed(() =>
  filteredObjects.value.reduce((sum, item) => sum + item.sizeBytes, 0),
);

function buildErrorMessage(error: unknown): string {
  return isApiError(error) ? error.message : t("cms.storage.requestFailed");
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
    return t("cms.storage.referenceBlocked");
  }

  const lines = details.references.map((reference, index) => {
    const via = reference.matchedBy
      .map((entry) => (entry === "url" ? t("cms.storage.referenceViaUrl") : t("cms.storage.referenceViaObjectKey")))
      .join(" + ");

    const statusLabel =
      reference.articleStatus === "published"
        ? t("cms.storage.articleStatusPublished")
        : reference.articleStatus === "draft"
          ? t("cms.storage.articleStatusDraft")
          : t("cms.storage.articleStatusArchived");

    return t("cms.storage.referenceLine", {
      index: index + 1,
      status: statusLabel,
      title: reference.articleTitle,
      via,
    });
  });

  return [t("cms.storage.referenceHeader"), ...lines].join("\n");
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
  if (mediaResult.status === "fulfilled") {
    storageObjects.value = mediaResult.value.objects;
    actionMessage.value = {
      key: "cms.storage.loadSuccess",
      params: { count: mediaResult.value.objects.length },
    };
  } else {
    storageObjects.value = [];
    actionMessage.value = {
      key: "cms.storage.loadFailed",
      params: { message: buildErrorMessage(mediaResult.reason) },
    };
  }
  loading.value = false;
}

async function handleCopy(item: CmsStorageObject): Promise<void> {
  const targetUrl = getPublicMediaUrl(item);

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(targetUrl);
      actionMessage.value = { key: "cms.storage.copiedPath", params: { path: targetUrl } };
      return;
    }
  } catch {
    // Fall through to the fallback message below.
  }

  actionMessage.value = { key: "cms.storage.clipboardUnsupported" };
}

function handlePreview(item: CmsStorageObject): void {
  const targetUrl = getPublicMediaUrl(item);

  window.open(targetUrl, "_blank", "noopener,noreferrer");
  actionMessage.value = { key: "cms.storage.previewOpened", params: { name: getDisplayName(item) } };
}

async function handleRemove(item: CmsStorageObject): Promise<void> {
  const displayName = getDisplayName(item);
  const confirmed = window.confirm(t("cms.storage.deleteConfirm", { name: displayName }));

  if (!confirmed) {
    return;
  }

  actionMessage.value = { key: "cms.storage.deleting", params: { name: displayName } };
  deletePendingId.value = item.id;

  try {
    await deleteCmsMediaObject(item.id);
    storageObjects.value = storageObjects.value.filter((current) => current.id !== item.id);
    actionMessage.value = { key: "cms.storage.deleted", params: { name: displayName } };
  } catch (error) {
    const conflictDetails = extractDeleteConflictDetails(error);

    if (conflictDetails) {
      actionMessage.value = { referenceDetails: conflictDetails };

      const forceConfirmed = window.confirm(
        t("cms.storage.forceDeleteConfirm", {
          reason: formatReferenceReason(conflictDetails),
        }),
      );

      if (forceConfirmed) {
        actionMessage.value = { key: "cms.storage.forceDeleting", params: { name: displayName } };

        try {
          await deleteCmsMediaObject(item.id, { force: true });
          storageObjects.value = storageObjects.value.filter((current) => current.id !== item.id);
          actionMessage.value = { key: "cms.storage.forceDeleted", params: { name: displayName } };
        } catch (forceError) {
          actionMessage.value = {
            key: "cms.storage.forceDeleteFailed",
            params: { message: buildErrorMessage(forceError) },
          };
        }
      }
    } else {
      actionMessage.value = { key: "cms.storage.deleteFailed", params: { message: buildErrorMessage(error) } };
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
  <CmsShell :title="t('cms.storage.title')" :subtitle="t('cms.storage.subtitle')">
    <p class="status-line">
      {{ loading ? t("cms.storage.loadingList") : actionMessageText }}
    </p>
    <p v-if="deletePendingId" class="status-line status-line--active">
      {{ t("cms.storage.deletePending") }}
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
