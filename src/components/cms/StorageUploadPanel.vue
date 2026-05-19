<script setup lang="ts">
import { computed, ref } from "vue";
import IconifyIcon from "@/components/common/IconifyIcon.vue";
import type {
  CmsStorageArticleOption,
  CmsStorageObjectType,
  CmsStorageUploadCandidate,
} from "@/types/cms";

const props = defineProps<{
  articleOptions: CmsStorageArticleOption[];
  uploading?: boolean;
}>();

const emit = defineEmits<{
  enqueue: [items: CmsStorageUploadCandidate[]];
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFiles = ref<File[]>([]);
const isDragging = ref(false);
const relatedArticleId = ref("");
const selectionMessage = ref("");

const queueItems = computed(() =>
  selectedFiles.value.map((file) => ({
    id: `${file.name}-${file.lastModified}-${file.size}`,
    name: file.name,
    type: resolveObjectType(file),
    mime: file.type || "application/octet-stream",
    sizeLabel: formatBytes(file.size),
  })),
);

const isSubmitDisabled = computed(() => selectedFiles.value.length === 0);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

function resolveObjectType(file: File): CmsStorageObjectType {
  return file.type.startsWith("image/") ? "image" : "attachment";
}

function openPicker(): void {
  if (props.uploading) {
    return;
  }

  fileInput.value?.click();
}

function appendFiles(fileList: FileList | null): void {
  if (!fileList) return;

  selectionMessage.value = "";

  const existingKeys = new Set(selectedFiles.value.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
  const imageFiles = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
  const skippedCount = fileList.length - imageFiles.length;
  const nextFiles = imageFiles.filter((file) => {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    return !existingKeys.has(key);
  });

  if (nextFiles.length > 0) {
    selectedFiles.value = [...selectedFiles.value, ...nextFiles];
  }

  if (skippedCount > 0) {
    selectionMessage.value = `已忽略 ${skippedCount} 个非图片文件。`;
  }
}

function onFileChange(event: Event): void {
  appendFiles((event.target as HTMLInputElement).files);
  (event.target as HTMLInputElement).value = "";
}

function removeFile(id: string): void {
  selectedFiles.value = selectedFiles.value.filter(
    (file) => `${file.name}-${file.lastModified}-${file.size}` !== id,
  );
}

function clearFiles(): void {
  selectedFiles.value = [];
  selectionMessage.value = "";
}

function onDragOver(event: DragEvent): void {
  event.preventDefault();
  isDragging.value = true;
}

function onDragLeave(): void {
  isDragging.value = false;
}

function onDrop(event: DragEvent): void {
  event.preventDefault();
  isDragging.value = false;
  appendFiles(event.dataTransfer?.files ?? null);
}

function enqueueFiles(): void {
  if (selectedFiles.value.length === 0) return;

  const items: CmsStorageUploadCandidate[] = selectedFiles.value.map((file) => ({
    id: `${file.name}-${file.lastModified}-${file.size}`,
    file,
    name: file.name,
    type: resolveObjectType(file),
    mime: file.type || "application/octet-stream",
    sizeBytes: file.size,
    previewUrl:
      file.type.startsWith("image/") && typeof URL !== "undefined" ? URL.createObjectURL(file) : undefined,
    relatedArticleId: relatedArticleId.value || null,
  }));

  emit("enqueue", items);
  selectedFiles.value = [];
  selectionMessage.value = "";
}
</script>

<template>
  <section class="upload-card">
    <div class="header">
      <div>
        <h2>上传图片</h2>
        <p>把正文图片发到 R2，并按需挂到文章名下。</p>
      </div>
      <button type="button" class="ghost-btn" :disabled="props.uploading" @click="openPicker">
        <IconifyIcon icon="ph:plus" :size="16" />
        选择图片
      </button>
    </div>

    <input ref="fileInput" class="hidden-input" type="file" accept="image/*" multiple @change="onFileChange" />

    <button
      type="button"
      class="dropzone"
      :class="{ dragging: isDragging }"
      :disabled="props.uploading"
      @click="openPicker"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <IconifyIcon icon="ph:upload-simple" :size="24" />
      <strong>拖拽图片到这里，或点击选择</strong>
      <span>当前只接入 image/* 上传，单张建议控制在 5MB 以内。</span>
    </button>

    <div class="config-grid">
      <label class="field">
        <span>关联文章</span>
        <select v-model="relatedArticleId" :disabled="props.uploading">
          <option value="">暂不关联</option>
          <option v-for="article in articleOptions" :key="article.id" :value="article.id">
            {{ article.title }}
          </option>
        </select>
      </label>
    </div>

    <p v-if="selectionMessage" class="selection-message">{{ selectionMessage }}</p>

    <ul v-if="queueItems.length" class="queue">
      <li v-for="item in queueItems" :key="item.id" class="queue-item">
        <div class="queue-meta">
          <span class="queue-icon" :class="item.type">
            <IconifyIcon :icon="item.type === 'image' ? 'ph:image-square' : 'ph:file-text'" :size="18" />
          </span>
          <div>
            <p class="queue-name">{{ item.name }}</p>
            <p class="queue-detail">{{ item.mime }} · {{ item.sizeLabel }}</p>
          </div>
        </div>

        <button type="button" class="remove-btn" title="移出队列" :disabled="props.uploading" @click.stop="removeFile(item.id)">
          <IconifyIcon icon="ph:x" :size="16" />
        </button>
      </li>
    </ul>

    <p v-else class="empty-state">先选几张正文图片，再决定是否关联到某篇文章。</p>

    <div class="actions">
      <button type="button" class="ghost-btn" :disabled="isSubmitDisabled || props.uploading" @click="clearFiles">
        清空队列
      </button>
      <button type="button" class="primary-btn" :disabled="isSubmitDisabled || props.uploading" @click="enqueueFiles">
        <IconifyIcon icon="ph:tray-arrow-down" :size="16" />
        {{ props.uploading ? "上传中..." : "开始上传" }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.upload-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.header h2 {
  font-family: var(--font-heading);
  font-size: 28px;
  font-weight: 400;
}

.header p {
  color: var(--text-tertiary);
  font-size: 13px;
}

.hidden-input {
  display: none;
}

.dropzone {
  width: 100%;
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: var(--space-4);
  border: 1px dashed var(--border);
  border-radius: var(--radius-lg);
  background: color-mix(in oklch, var(--bg) 84%, transparent);
  color: var(--text-secondary);
  text-align: center;
  transition: border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
}

.dropzone:disabled {
  cursor: progress;
  opacity: 0.72;
}

.dropzone.dragging,
.dropzone:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--text-primary);
}

.dropzone strong {
  font-weight: 400;
}

.dropzone span {
  font-size: 13px;
  color: var(--text-tertiary);
}

.config-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  color: var(--text-tertiary);
  font-size: 12px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.field select {
  background: var(--bg);
}

.selection-message {
  margin-top: var(--space-3);
  color: var(--text-tertiary);
  font-size: 12px;
}

.queue {
  display: grid;
  gap: 10px;
  margin-top: var(--space-3);
}

.queue-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  padding: 14px 16px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: color-mix(in oklch, var(--bg) 86%, transparent);
}

.queue-meta {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.queue-icon {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: var(--bg);
  color: var(--text-secondary);
}

.queue-icon.image {
  color: var(--accent);
}

.queue-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-detail {
  color: var(--text-tertiary);
  font-size: 13px;
}

.remove-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}

.empty-state {
  margin-top: var(--space-3);
  color: var(--text-tertiary);
  font-size: 13px;
}

.actions {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.ghost-btn,
.primary-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.primary-btn {
  background: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
}

.primary-btn:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

@media (max-width: 720px) {
  .header,
  .actions {
    flex-direction: column;
  }

  .ghost-btn,
  .primary-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
