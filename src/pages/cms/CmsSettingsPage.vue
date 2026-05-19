<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { getCmsSiteSettings, updateCmsSiteSettings } from "@/api/settings";
import { isApiError } from "@/api/http";
import CmsShell from "@/components/cms/CmsShell.vue";
import type { SiteNavActionTargetType, SiteNavActionVariant, SiteSettings } from "@/types/cms";

function createDefaultNavAction() {
  return {
    enabled: false,
    variant: "icon" as SiteNavActionVariant,
    label: "",
    iconName: "",
    tooltip: "",
    targetType: "external" as SiteNavActionTargetType,
    href: "",
    articlePath: "",
  };
}

const form = reactive({
  siteName: "",
  siteDescription: "",
  commentsEnabled: true,
  analyticsEnabled: true,
  navAction: createDefaultNavAction(),
});
const loading = ref(true);
const saving = ref(false);
const notice = ref("");

function applySettings(settings: SiteSettings): void {
  form.siteName = settings.siteName;
  form.siteDescription = settings.siteDescription;
  form.commentsEnabled = settings.commentsEnabled;
  form.analyticsEnabled = settings.analyticsEnabled;
  form.navAction.enabled = settings.navAction.enabled;
  form.navAction.variant = settings.navAction.variant;
  form.navAction.label = settings.navAction.label;
  form.navAction.iconName = settings.navAction.iconName;
  form.navAction.tooltip = settings.navAction.tooltip;
  form.navAction.targetType = settings.navAction.targetType;
  form.navAction.href = settings.navAction.href;
  form.navAction.articlePath = settings.navAction.articlePath;
}

async function loadSettings(): Promise<void> {
  loading.value = true;
  notice.value = "";

  try {
    const settings = await getCmsSiteSettings();
    applySettings(settings);
  } catch (error) {
    notice.value = isApiError(error) ? error.message : "加载设置失败。";
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
      navAction: { ...form.navAction },
    });
    applySettings(settings);
    notice.value = "设置已保存。";
  } catch (error) {
    notice.value = isApiError(error) ? error.message : "保存设置失败。";
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadSettings();
});
</script>

<template>
  <CmsShell title="站点设置" subtitle="管理公开站点信息、功能开关和导航栏按钮。">
    <p v-if="notice" class="notice">{{ notice }}</p>

    <form class="settings-form" :class="{ loading }" @submit.prevent="handleSubmit">
      <section class="settings-panel">
        <h2>基础信息</h2>
        <label>
          <span>站点名称</span>
          <input v-model="form.siteName" type="text" maxlength="80" placeholder="例如：Yamds 的博客" />
        </label>
        <label>
          <span>站点简介</span>
          <textarea
            v-model="form.siteDescription"
            maxlength="300"
            rows="4"
            placeholder="为公开站点添加一段简短介绍。"
          />
        </label>
      </section>

      <section class="settings-panel">
        <h2>功能开关</h2>
        <label class="switch-row">
          <input v-model="form.commentsEnabled" type="checkbox" />
          <span>
            <strong>启用评论</strong>
            <small>关闭后读者仍可查看已有评论。</small>
          </span>
        </label>
        <label class="switch-row">
          <input v-model="form.analyticsEnabled" type="checkbox" />
          <span>
            <strong>记录分析数据</strong>
            <small>页面浏览请求仍会成功，但不会再写入新的浏览记录。</small>
          </span>
        </label>
      </section>

      <section class="settings-panel">
        <h2>导航栏按钮</h2>
        <label class="switch-row">
          <input v-model="form.navAction.enabled" type="checkbox" />
          <span>
            <strong>启用自定义按钮</strong>
            <small>图标按钮显示在 GitHub 登录按钮左侧，文字按钮显示在文章与 CMS 之间。</small>
          </span>
        </label>

        <div class="option-group">
          <span class="field-label">按钮样式</span>
          <div class="segmented">
            <button
              type="button"
              class="segment"
              :class="{ active: form.navAction.variant === 'icon' }"
              :aria-pressed="form.navAction.variant === 'icon'"
              @click="form.navAction.variant = 'icon'"
            >
              图标
            </button>
            <button
              type="button"
              class="segment"
              :class="{ active: form.navAction.variant === 'text' }"
              :aria-pressed="form.navAction.variant === 'text'"
              @click="form.navAction.variant = 'text'"
            >
              文字
            </button>
          </div>
        </div>

        <div class="option-group">
          <span class="field-label">跳转目标</span>
          <div class="segmented">
            <button
              type="button"
              class="segment"
              :class="{ active: form.navAction.targetType === 'external' }"
              :aria-pressed="form.navAction.targetType === 'external'"
              @click="form.navAction.targetType = 'external'"
            >
              外部链接
            </button>
            <button
              type="button"
              class="segment"
              :class="{ active: form.navAction.targetType === 'article' }"
              :aria-pressed="form.navAction.targetType === 'article'"
              @click="form.navAction.targetType = 'article'"
            >
              文章
            </button>
          </div>
        </div>

        <div v-if="form.navAction.variant === 'icon'" class="field-grid">
          <label>
            <span>Iconify 图标名</span>
            <input
              v-model="form.navAction.iconName"
              type="text"
              maxlength="80"
              placeholder="ph:paper-plane-tilt"
            />
          </label>
          <label>
            <span>提示文案</span>
            <input
              v-model="form.navAction.tooltip"
              type="text"
              maxlength="120"
              placeholder="例如：在新标签页打开"
            />
          </label>
        </div>

        <label v-else>
          <span>按钮文案</span>
          <input v-model="form.navAction.label" type="text" maxlength="40" placeholder="例如：关于" />
        </label>

        <label v-if="form.navAction.targetType === 'external'">
          <span>外部链接 URL</span>
          <input
            v-model="form.navAction.href"
            type="url"
            maxlength="300"
            placeholder="https://example.com"
          />
        </label>
        <label v-else>
          <span>文章 slug 或路径</span>
          <input
            v-model="form.navAction.articlePath"
            type="text"
            maxlength="300"
            placeholder="hello-world 或 /articles/hello-world"
          />
        </label>
      </section>

      <div class="form-actions">
        <button type="button" class="text-action" :disabled="loading || saving" @click="loadSettings">重新加载</button>
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
label > span:first-child,
.field-label {
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
.option-group {
  display: grid;
  gap: 8px;
}
.segmented {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 4px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: color-mix(in oklch, var(--bg-elevated) 80%, transparent);
}
.segment {
  min-width: 96px;
  min-height: 34px;
  padding: 0 12px;
  border: none;
  border-radius: calc(var(--radius-md) - 4px);
  background: transparent;
  color: var(--text-secondary);
  transition: color var(--transition-fast), background var(--transition-fast);
}
.segment.active {
  background: var(--bg);
  color: var(--text-primary);
}
.field-grid {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.form-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}
.form-actions button {
  min-height: 38px;
}
.text-action {
  position: relative;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  transition: color var(--transition-fast);
}
.text-action::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 6px;
  height: 1px;
  background: currentColor;
  opacity: 0;
  transform: scaleX(0);
  transform-origin: right center;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}
.text-action:hover,
.text-action:focus-visible {
  color: var(--accent);
}
.text-action:hover::after,
.text-action:focus-visible::after {
  opacity: 1;
  transform: scaleX(1);
  transform-origin: left center;
}
.text-action:disabled {
  color: var(--text-tertiary);
}
.text-action:disabled::after {
  display: none;
}
.text-action:focus-visible {
  outline: none;
}
.form-actions .primary {
  padding: 0 14px;
  border-color: var(--accent);
  background: var(--accent);
  color: var(--bg);
}
@media (max-width: 640px) {
  .field-grid {
    grid-template-columns: 1fr;
  }

  .segmented {
    width: 100%;
  }

  .segment {
    flex: 1 1 0;
  }

  .form-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
