<script setup lang="ts">
import IconifyIcon from "@/components/common/IconifyIcon.vue";

export interface ToolbarAction {
  key: string;
  icon: string;
  title: string;
}

export interface ToolbarColor {
  key: string;
  label: string;
  value: string;
}

const props = defineProps<{
  actions: ToolbarAction[];
  activeKeys: string[];
  headingValue: string;
  colors: ToolbarColor[];
  activeColor?: string;
  backgroundColors: ToolbarColor[];
  activeBackgroundColor?: string;
}>();

const emit = defineEmits<{
  toggle: [key: string];
  "set-heading": [value: string];
  "set-color": [value: string];
  "set-background-color": [value: string];
}>();

const toolbarRows = [
  [
    { kind: "format", keys: ["bold", "italic", "wavyUnderline", "underline", "strike"] },
    { kind: "actions", keys: ["quote", "inlineCode", "code"] },
    { kind: "actions", keys: ["bullet", "ordered"] },
    { kind: "actions", keys: ["link", "image"] },
  ],
  [
    { kind: "actions", keys: ["superscript", "subscript", "alignLeft", "alignCenter", "alignRight"] },
    { kind: "colors" },
    { kind: "actions", keys: ["table"] },
  ],
] as const;

function findAction(key: string): ToolbarAction | undefined {
  return props.actions.find((action) => action.key === key);
}
</script>

<template>
  <div class="toolbar">
    <div v-for="(row, rowIndex) in toolbarRows" :key="rowIndex" class="toolbar-row">
      <div v-for="(group, groupIndex) in row" :key="`${rowIndex}-${groupIndex}`" class="toolbar-group">
        <select
          v-if="group.kind === 'format'"
          class="heading-select"
          :value="headingValue"
          title="标题层级"
          aria-label="标题层级"
          @change="emit('set-heading', ($event.target as HTMLSelectElement).value)"
        >
          <option value="paragraph">正文</option>
          <option value="1">H1</option>
          <option value="2">H2</option>
          <option value="3">H3</option>
          <option value="4">H4</option>
          <option value="5">H5</option>
          <option value="6">H6</option>
        </select>

        <template v-if="group.kind === 'format' || group.kind === 'actions'">
          <template v-for="key in group.keys" :key="key">
            <button
              v-if="findAction(key)"
              type="button"
              class="toolbar-btn"
              :class="{ active: activeKeys.includes(key) }"
              :title="findAction(key)?.title"
              :aria-label="findAction(key)?.title"
              :aria-pressed="activeKeys.includes(key)"
              @click="emit('toggle', key)"
            >
              <IconifyIcon :icon="findAction(key)?.icon ?? ''" />
            </button>
          </template>
        </template>

        <div v-else-if="group.kind === 'colors'" class="color-select-group">
          <label class="color-select-label" title="字体颜色">
            <IconifyIcon icon="ph:paint-brush" />
            <select
              class="color-select"
              :value="activeColor ?? ''"
              title="字体颜色"
              aria-label="字体颜色"
              @change="emit('set-color', ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="color in colors" :key="color.key" :value="color.value">
                {{ color.label }}
              </option>
            </select>
          </label>
          <label class="color-select-label" title="背景颜色">
            <IconifyIcon icon="ph:highlighter-circle" />
            <select
              class="color-select"
              :value="activeBackgroundColor ?? ''"
              title="背景颜色"
              aria-label="背景颜色"
              @change="emit('set-background-color', ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="color in backgroundColors" :key="color.key" :value="color.value">
                {{ color.label }}
              </option>
            </select>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}
.toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  row-gap: var(--space-1);
}
.toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 36px;
  padding: 0 var(--space-2);
  border-left: 1px solid var(--border-subtle);
}
.toolbar-group:first-child {
  padding-left: 0;
  border-left: 0;
}
.heading-select {
  width: auto;
  min-width: 92px;
  height: 36px;
  padding: 0 30px 0 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}
.toolbar-btn { width: 36px; height: 36px; border: 1px solid transparent; border-radius: var(--radius-sm); color: var(--text-secondary); display: inline-flex; align-items: center; justify-content: center; }
.toolbar-btn:hover { border-color: var(--border); color: var(--text-primary); background: var(--bg); }
.toolbar-btn.active { color: var(--bg); background: var(--accent); border-color: var(--accent); }
.color-select-group {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}
.color-select-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  color: var(--text-secondary);
}
.color-select {
  width: 92px;
  height: 36px;
  padding: 0 26px 0 9px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}
@media (max-width: 640px) {
  .toolbar-row {
    gap: var(--space-1);
  }
  .toolbar-group {
    padding: 0 var(--space-1);
  }
}
</style>
