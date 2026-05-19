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
    notice.value = isApiError(error) ? error.message : "Failed to load settings.";
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
    notice.value = "Settings saved.";
  } catch (error) {
    notice.value = isApiError(error) ? error.message : "Failed to save settings.";
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadSettings();
});
</script>

<template>
  <CmsShell title="Site Settings" subtitle="Manage public site metadata, feature flags, and navbar actions.">
    <p v-if="notice" class="notice">{{ notice }}</p>

    <form class="settings-form" :class="{ loading }" @submit.prevent="handleSubmit">
      <section class="settings-panel">
        <h2>Basics</h2>
        <label>
          <span>Site name</span>
          <input v-model="form.siteName" type="text" maxlength="80" placeholder="Yamds's Blog" />
        </label>
        <label>
          <span>Description</span>
          <textarea
            v-model="form.siteDescription"
            maxlength="300"
            rows="4"
            placeholder="Add a short intro for the public site."
          />
        </label>
      </section>

      <section class="settings-panel">
        <h2>Features</h2>
        <label class="switch-row">
          <input v-model="form.commentsEnabled" type="checkbox" />
          <span>
            <strong>Enable comments</strong>
            <small>Readers can still view existing comments when this is turned off.</small>
          </span>
        </label>
        <label class="switch-row">
          <input v-model="form.analyticsEnabled" type="checkbox" />
          <span>
            <strong>Record analytics</strong>
            <small>Pageview requests stay successful, but no new view records will be written.</small>
          </span>
        </label>
      </section>

      <section class="settings-panel">
        <h2>Navbar action</h2>
        <label class="switch-row">
          <input v-model="form.navAction.enabled" type="checkbox" />
          <span>
            <strong>Enable custom button</strong>
            <small>
              Icon buttons appear left of the GitHub login control. Text buttons sit between Articles and CMS.
            </small>
          </span>
        </label>

        <div class="option-group">
          <span class="field-label">Button style</span>
          <div class="segmented">
            <button
              type="button"
              class="segment"
              :class="{ active: form.navAction.variant === 'icon' }"
              :aria-pressed="form.navAction.variant === 'icon'"
              @click="form.navAction.variant = 'icon'"
            >
              Icon
            </button>
            <button
              type="button"
              class="segment"
              :class="{ active: form.navAction.variant === 'text' }"
              :aria-pressed="form.navAction.variant === 'text'"
              @click="form.navAction.variant = 'text'"
            >
              Text
            </button>
          </div>
        </div>

        <div class="option-group">
          <span class="field-label">Target</span>
          <div class="segmented">
            <button
              type="button"
              class="segment"
              :class="{ active: form.navAction.targetType === 'external' }"
              :aria-pressed="form.navAction.targetType === 'external'"
              @click="form.navAction.targetType = 'external'"
            >
              External link
            </button>
            <button
              type="button"
              class="segment"
              :class="{ active: form.navAction.targetType === 'article' }"
              :aria-pressed="form.navAction.targetType === 'article'"
              @click="form.navAction.targetType = 'article'"
            >
              Article
            </button>
          </div>
        </div>

        <div v-if="form.navAction.variant === 'icon'" class="field-grid">
          <label>
            <span>Iconify icon name</span>
            <input
              v-model="form.navAction.iconName"
              type="text"
              maxlength="80"
              placeholder="ph:paper-plane-tilt"
            />
          </label>
          <label>
            <span>Tooltip</span>
            <input
              v-model="form.navAction.tooltip"
              type="text"
              maxlength="120"
              placeholder="Open in a new tab"
            />
          </label>
        </div>

        <label v-else>
          <span>Button label</span>
          <input v-model="form.navAction.label" type="text" maxlength="40" placeholder="About" />
        </label>

        <label v-if="form.navAction.targetType === 'external'">
          <span>External URL</span>
          <input
            v-model="form.navAction.href"
            type="url"
            maxlength="300"
            placeholder="https://example.com"
          />
        </label>
        <label v-else>
          <span>Article slug or path</span>
          <input
            v-model="form.navAction.articlePath"
            type="text"
            maxlength="300"
            placeholder="hello-world or /articles/hello-world"
          />
        </label>
      </section>

      <div class="form-actions">
        <button type="button" class="text-action" :disabled="loading || saving" @click="loadSettings">Reload</button>
        <button type="submit" class="primary" :disabled="loading || saving">
          {{ saving ? "Saving..." : "Save settings" }}
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
