<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";

import { isApiError } from "@/api/http";
import { getCmsSiteSettings, updateCmsSiteSettings } from "@/api/settings";
import CmsShell from "@/components/cms/CmsShell.vue";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import type {
  SiteNavActionSettings,
  SiteNavActionTargetType,
  SiteNavActionVariant,
  SiteSettings,
} from "@/types/cms";

type MessageState =
  | {
      key: MessageKey;
      params?: Record<string, string | number>;
    }
  | {
      text: string;
    };

const MAX_NAV_ACTIONS = 8;

function createDefaultNavAction(): SiteNavActionSettings {
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

function cloneNavAction(action?: Partial<SiteNavActionSettings>): SiteNavActionSettings {
  return {
    ...createDefaultNavAction(),
    ...action,
  };
}

const form = reactive({
  siteName: "",
  siteDescription: "",
  commentsEnabled: true,
  analyticsEnabled: true,
  navActions: [createDefaultNavAction()] as SiteNavActionSettings[],
});

const loading = ref(true);
const saving = ref(false);
const notice = ref<MessageState | null>(null);
const { t } = useI18n();

const canAddNavAction = computed(() => form.navActions.length < MAX_NAV_ACTIONS);
const noticeText = computed(() => {
  if (!notice.value) {
    return "";
  }

  return "text" in notice.value ? notice.value.text : t(notice.value.key, notice.value.params);
});

function ensureNavActions(actions?: SiteNavActionSettings[]): SiteNavActionSettings[] {
  const normalized = (actions ?? []).map((action) => cloneNavAction(action)).slice(0, MAX_NAV_ACTIONS);
  return normalized.length ? normalized : [createDefaultNavAction()];
}

function applySettings(settings: SiteSettings): void {
  form.siteName = settings.siteName;
  form.siteDescription = settings.siteDescription;
  form.commentsEnabled = settings.commentsEnabled;
  form.analyticsEnabled = settings.analyticsEnabled;
  form.navActions = ensureNavActions(settings.navActions);
}

async function loadSettings(): Promise<void> {
  loading.value = true;
  notice.value = null;

  try {
    const settings = await getCmsSiteSettings();
    applySettings(settings);
  } catch (error) {
    notice.value = isApiError(error) ? { text: error.message } : { key: "cms.settings.loadFailed" };
  } finally {
    loading.value = false;
  }
}

function addNavAction(): void {
  if (!canAddNavAction.value) {
    return;
  }

  form.navActions.push(createDefaultNavAction());
}

function removeNavAction(index: number): void {
  if (form.navActions.length === 1) {
    form.navActions[0] = createDefaultNavAction();
    return;
  }

  form.navActions.splice(index, 1);
}

async function handleSubmit(): Promise<void> {
  saving.value = true;
  notice.value = null;

  try {
    const navActions = form.navActions.map((action) => ({ ...action })).slice(0, MAX_NAV_ACTIONS);
    const settings = await updateCmsSiteSettings({
      siteName: form.siteName,
      siteDescription: form.siteDescription,
      commentsEnabled: form.commentsEnabled,
      analyticsEnabled: form.analyticsEnabled,
      navAction: navActions[0] ?? createDefaultNavAction(),
      navActions,
    });
    applySettings(settings);
    notice.value = { key: "cms.settings.saveSuccess" };
  } catch (error) {
    notice.value = isApiError(error) ? { text: error.message } : { key: "cms.settings.saveFailed" };
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadSettings();
});
</script>

<template>
  <CmsShell :title="t('cms.settings.title')" :subtitle="t('cms.settings.subtitle')">
    <p v-if="noticeText" class="notice">{{ noticeText }}</p>

    <form class="settings-form" :class="{ loading }" @submit.prevent="handleSubmit">
      <section class="settings-panel">
        <h2>{{ t("cms.settings.sectionBasic") }}</h2>
        <label>
          <span>{{ t("cms.settings.siteName") }}</span>
          <input
            v-model="form.siteName"
            type="text"
            maxlength="80"
            :placeholder="t('cms.settings.siteNamePlaceholder')"
          />
        </label>
        <label>
          <span>{{ t("cms.settings.siteDescription") }}</span>
          <textarea
            v-model="form.siteDescription"
            maxlength="300"
            rows="4"
            :placeholder="t('cms.settings.siteDescriptionPlaceholder')"
          />
        </label>
      </section>

      <section class="settings-panel">
        <h2>{{ t("cms.settings.sectionFeatures") }}</h2>
        <label class="switch-row">
          <input v-model="form.commentsEnabled" type="checkbox" />
          <span>
            <strong>{{ t("cms.settings.enableComments") }}</strong>
            <small>{{ t("cms.settings.enableCommentsHint") }}</small>
          </span>
        </label>
        <label class="switch-row">
          <input v-model="form.analyticsEnabled" type="checkbox" />
          <span>
            <strong>{{ t("cms.settings.enableAnalytics") }}</strong>
            <small>{{ t("cms.settings.enableAnalyticsHint") }}</small>
          </span>
        </label>
      </section>

      <section class="settings-panel">
        <div class="panel-heading">
          <div>
            <h2>{{ t("cms.settings.sectionNavActions") }}</h2>
            <p class="panel-intro">{{ t("cms.settings.sectionNavIntro") }}</p>
          </div>
          <button type="button" class="text-action" :disabled="!canAddNavAction" @click="addNavAction">
            {{ t("cms.settings.addAction") }}
          </button>
        </div>

        <div class="nav-action-list">
          <section
            v-for="(action, index) in form.navActions"
            :key="index"
            class="nav-action-card"
          >
            <div class="card-header">
              <strong>{{ t("cms.settings.actionCard", { index: index + 1 }) }}</strong>
              <button type="button" class="text-action" @click="removeNavAction(index)">
                {{ t("cms.settings.removeAction") }}
              </button>
            </div>

            <label class="switch-row">
              <input v-model="action.enabled" type="checkbox" />
              <span>
                <strong>{{ t("cms.settings.enableAction") }}</strong>
                <small>{{ t("cms.settings.enableActionHint") }}</small>
              </span>
            </label>

            <div class="option-group">
              <span class="field-label">{{ t("cms.settings.variantLabel") }}</span>
              <div class="segmented">
                <button
                  type="button"
                  class="segment"
                  :class="{ active: action.variant === 'icon' }"
                  :aria-pressed="action.variant === 'icon'"
                  @click="action.variant = 'icon'"
                >
                  {{ t("cms.settings.variantIcon") }}
                </button>
                <button
                  type="button"
                  class="segment"
                  :class="{ active: action.variant === 'text' }"
                  :aria-pressed="action.variant === 'text'"
                  @click="action.variant = 'text'"
                >
                  {{ t("cms.settings.variantText") }}
                </button>
              </div>
            </div>

            <div class="option-group">
              <span class="field-label">{{ t("cms.settings.targetLabel") }}</span>
              <div class="segmented">
                <button
                  type="button"
                  class="segment"
                  :class="{ active: action.targetType === 'external' }"
                  :aria-pressed="action.targetType === 'external'"
                  @click="action.targetType = 'external'"
                >
                  {{ t("cms.settings.targetExternal") }}
                </button>
                <button
                  type="button"
                  class="segment"
                  :class="{ active: action.targetType === 'article' }"
                  :aria-pressed="action.targetType === 'article'"
                  @click="action.targetType = 'article'"
                >
                  {{ t("cms.settings.targetArticle") }}
                </button>
              </div>
            </div>

            <div v-if="action.variant === 'icon'" class="field-grid">
              <label>
                <span>{{ t("cms.settings.iconName") }}</span>
                <input
                  v-model="action.iconName"
                  type="text"
                  maxlength="80"
                  :placeholder="t('cms.settings.iconNamePlaceholder')"
                />
              </label>
              <label>
                <span>{{ t("cms.settings.tooltip") }}</span>
                <input
                  v-model="action.tooltip"
                  type="text"
                  maxlength="120"
                  :placeholder="t('cms.settings.tooltipPlaceholder')"
                />
              </label>
            </div>

            <label v-else>
              <span>{{ t("cms.settings.actionLabel") }}</span>
              <input
                v-model="action.label"
                type="text"
                maxlength="40"
                :placeholder="t('cms.settings.actionLabelPlaceholder')"
              />
            </label>

            <label v-if="action.targetType === 'external'">
              <span>{{ t("cms.settings.externalUrl") }}</span>
              <input
                v-model="action.href"
                type="url"
                maxlength="300"
                :placeholder="t('cms.settings.externalUrlPlaceholder')"
              />
            </label>
            <label v-else>
              <span>{{ t("cms.settings.articlePath") }}</span>
              <input
                v-model="action.articlePath"
                type="text"
                maxlength="300"
                :placeholder="t('cms.settings.articlePathPlaceholder')"
              />
            </label>
          </section>
        </div>
      </section>

      <div class="form-actions">
        <button type="button" class="text-action" :disabled="loading || saving" @click="loadSettings">
          {{ t("cms.shared.reload") }}
        </button>
        <button type="submit" class="primary" :disabled="loading || saving">
          {{ saving ? t("cms.shared.saving") : t("cms.shared.saveSettings") }}
        </button>
      </div>
    </form>
  </CmsShell>
</template>

<style scoped>
.notice,
.settings-panel,
.nav-action-card {
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
  max-width: 840px;
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

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.panel-intro {
  margin-top: 6px;
  color: var(--text-tertiary);
  font-size: 13px;
  line-height: 1.7;
}

.nav-action-list {
  display: grid;
  gap: var(--space-3);
}

.nav-action-card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.card-header strong {
  font-size: 14px;
  color: var(--text-primary);
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

  .panel-heading,
  .form-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
