<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { getCmsSiteSettings, updateCmsSiteSettings } from "@/api/settings";
import { isApiError } from "@/api/http";
import CmsShell from "@/components/cms/CmsShell.vue";

const form = reactive({
  siteName: "",
  siteDescription: "",
  commentsEnabled: true,
  analyticsEnabled: true,
});
const loading = ref(true);
const saving = ref(false);
const notice = ref("");

async function loadSettings(): Promise<void> {
  loading.value = true;
  notice.value = "";

  try {
    const settings = await getCmsSiteSettings();
    form.siteName = settings.siteName;
    form.siteDescription = settings.siteDescription;
    form.commentsEnabled = settings.commentsEnabled;
    form.analyticsEnabled = settings.analyticsEnabled;
  } catch (error) {
    notice.value = isApiError(error) ? error.message : "设置加载失败。";
  } finally {
    loading.value = false;
  }
}

async function handleSubmit(): Promise<void> {
  saving.value = true;
  notice.value = "";

  try {
    const settings = await updateCmsSiteSettings({
      siteName: form.siteName,
      siteDescription: form.siteDescription,
      commentsEnabled: form.commentsEnabled,
      analyticsEnabled: form.analyticsEnabled,
    });
    form.siteName = settings.siteName;
    form.siteDescription = settings.siteDescription;
    form.commentsEnabled = settings.commentsEnabled;
    form.analyticsEnabled = settings.analyticsEnabled;
    notice.value = "站点设置已保存。";
  } catch (error) {
    notice.value = isApiError(error) ? error.message : "设置保存失败。";
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadSettings();
});
</script>

<template>
  <CmsShell title="站点设置" subtitle="维护公开站点基础信息与功能开关。">
    <p v-if="notice" class="notice">{{ notice }}</p>

    <form class="settings-form" :class="{ loading }" @submit.prevent="handleSubmit">
      <section class="settings-panel">
        <h2>基础信息</h2>
        <label>
          <span>站点名</span>
          <input v-model="form.siteName" type="text" maxlength="80" placeholder="Yamds's Blog" />
        </label>
        <label>
          <span>简介</span>
          <textarea v-model="form.siteDescription" maxlength="300" rows="4" placeholder="写一句站点简介"></textarea>
        </label>
      </section>

      <section class="settings-panel">
        <h2>功能开关</h2>
        <label class="switch-row">
          <input v-model="form.commentsEnabled" type="checkbox" />
          <span>
            <strong>允许公开评论</strong>
            <small>关闭后用户不能发布评论或回复，历史评论仍可浏览。</small>
          </span>
        </label>
        <label class="switch-row">
          <input v-model="form.analyticsEnabled" type="checkbox" />
          <span>
            <strong>记录访问分析</strong>
            <small>关闭后 pageview API 仍返回成功，但不写入新记录。</small>
          </span>
        </label>
      </section>

      <div class="form-actions">
        <button type="button" :disabled="loading || saving" @click="loadSettings">重新读取</button>
        <button type="submit" class="primary" :disabled="loading || saving">
          {{ saving ? "保存中..." : "保存设置" }}
        </button>
      </div>
    </form>
  </CmsShell>
</template>

<style scoped>
.notice,
.settings-panel {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
}
.notice {
  margin-bottom: var(--space-4);
  padding: var(--space-2) var(--space-3);
  color: var(--text-secondary);
  font-size: 13px;
}
.settings-form {
  display: grid;
  gap: var(--space-4);
  max-width: 780px;
}
.settings-form.loading {
  opacity: 0.78;
}
.settings-panel {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
}
.settings-panel h2 {
  font-family: var(--font-heading);
  font-size: 28px;
  font-weight: 400;
}
label {
  display: grid;
  gap: 8px;
}
label > span:first-child {
  color: var(--text-secondary);
  font-size: 13px;
}
textarea {
  resize: vertical;
}
.switch-row {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
}
.switch-row input {
  width: 18px;
  height: 18px;
  margin-top: 3px;
}
.switch-row strong {
  display: block;
  font-weight: 500;
}
.switch-row small {
  display: block;
  margin-top: 4px;
  color: var(--text-tertiary);
  font-size: 13px;
}
.form-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}
.form-actions button {
  min-height: 38px;
  padding: 0 14px;
}
.form-actions .primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--bg);
}
@media (max-width: 640px) {
  .form-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
