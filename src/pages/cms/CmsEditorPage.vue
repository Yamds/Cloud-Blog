<script setup lang="ts">
import Color from "@tiptap/extension-color";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Highlight from "@tiptap/extension-highlight";
import { Mark } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/vue-3";
import { BubbleMenu } from "@tiptap/vue-3/menus";
import { createLowlight } from "lowlight";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import shell from "highlight.js/lib/languages/shell";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  autosaveCmsArticle,
  createCmsArticle,
  getCmsArticle,
  getCmsArticleRevisions,
  getLatestCmsArticleAutosave,
  publishCmsArticle,
  restoreCmsArticleRevision,
  updateCmsArticle,
} from "@/api/cms";
import { uploadCmsImage, uploadCmsImageFromUrl } from "@/api/uploads";
import {
  formatContent,
  generateSummary,
  generateTags,
  polishText,
  type CmsAiActionKey,
} from "@/api/ai";
import { isApiError } from "@/api/http";
import AiPanel from "@/components/cms/AiPanel.vue";
import CmsShell from "@/components/cms/CmsShell.vue";
import EditorToolbar, { type ToolbarColor } from "@/components/cms/EditorToolbar.vue";
import IconPicker from "@/components/cms/IconPicker.vue";
import PublishPanel from "@/components/cms/PublishPanel.vue";
import TagEditor from "@/components/cms/TagEditor.vue";
import { cmsAiActions, cmsEditorInitialDraft } from "@/data/cms";
import type {
  CmsArticleDetail,
  CmsArticleAutosave,
  CmsArticleRevision,
  CmsArticleStatus,
  CmsEditorDraft,
  CmsPublishInfo,
} from "@/types/cms";
import { formatShanghaiDateTime, formatShanghaiTime } from "@/utils/date";

const route = useRoute();
const router = useRouter();

const draft = reactive(createLocalDraft());
const loading = ref(false);
const loadError = ref("");
const saving = ref(false);
const publishing = ref(false);
const imageUploading = ref(false);
const imageConverting = ref(false);
const saveMessage = ref("");
const saveError = ref("");
const activeAiKey = ref<CmsAiActionKey | null>(null);
const aiMessage = ref("");
const aiError = ref("");
const editorRevision = ref(0);
const revisions = ref<CmsArticleRevision[]>([]);
const latestAutosave = ref<CmsArticleAutosave | null>(null);
const revisionsLoading = ref(false);
const revisionsError = ref("");
const imageUploadInput = ref<HTMLInputElement | null>(null);
const editorContentWrap = ref<HTMLElement | null>(null);
const stickyTopOffset = ref(80);
const stickyActionsHeight = ref(0);
let applyingEditorContent = false;
let autosavePaused = false;
let autosaveTimer: number | null = null;

const CMS_MEDIA_PATH_PREFIX = "/api/cms/media";
const STICKY_HEADER_EXTRA_GAP = 12;

interface ImageNodeContext {
  src: string;
  alt: string;
  pos: number;
}

interface HoveredImageContext extends ImageNodeContext {
  top: number;
  left: number;
  maxWidth: number;
}

const hoveredExternalImage = ref<HoveredImageContext | null>(null);

interface EditorSnapshotSource {
  getJSON: () => unknown;
  getText: () => string;
}

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
interface ToolbarOption {
  label: string;
  value: string;
}

const lowlight = createLowlight();

lowlight.register("bash", bash);
lowlight.register("css", css);
lowlight.register("javascript", javascript);
lowlight.register("json", json);
lowlight.register("markdown", markdown);
lowlight.register("plaintext", plaintext);
lowlight.register("shell", shell);
lowlight.register("typescript", typescript);
lowlight.register("xml", xml);

const WavyUnderline = Mark.create({
  name: "wavyUnderline",

  parseHTML() {
    return [{ tag: "span.wavy" }];
  },

  renderHTML({ HTMLAttributes }) {
    const className = [HTMLAttributes.class, "wavy"].filter(Boolean).join(" ");
    return ["span", { ...HTMLAttributes, class: className }, 0];
  },
});

const articleId = computed(() => {
  const value = route.params.id;
  return typeof value === "string" ? value : "new";
});

const isNewArticle = computed(() => articleId.value === "new" || !draft.id);
const pageTitle = computed(() => (isNewArticle.value ? "新建文章" : "编辑文章"));
const pageSubtitle = computed(() =>
  isNewArticle.value ? "先写下草稿，保存后再继续整理细节。" : "保持轻量，随时保存，再决定何时发布。",
);

const toolbarActions = [
  { key: "bold", icon: "ph:text-bolder", title: "加粗" },
  { key: "italic", icon: "ph:text-italic", title: "斜体" },
  { key: "wavyUnderline", icon: "ph:wave-sine", title: "波浪下划线" },
  { key: "underline", icon: "ph:text-underline", title: "下划线" },
  { key: "strike", icon: "ph:text-strikethrough", title: "删除线" },
  { key: "quote", icon: "ph:quotes", title: "引用" },
  { key: "inlineCode", icon: "ph:brackets-curly", title: "行内代码" },
  { key: "code", icon: "ph:code", title: "代码块" },
  { key: "bullet", icon: "ph:list-bullets", title: "无序列表" },
  { key: "ordered", icon: "ph:list-numbers", title: "有序列表" },
  { key: "link", icon: "ph:link", title: "链接" },
  { key: "image", icon: "ph:image", title: "图片" },
  { key: "superscript", icon: "ph:text-superscript", title: "上角标" },
  { key: "subscript", icon: "ph:text-subscript", title: "下角标" },
  { key: "alignLeft", icon: "ph:text-align-left", title: "左对齐" },
  { key: "alignCenter", icon: "ph:text-align-center", title: "居中对齐" },
  { key: "alignRight", icon: "ph:text-align-right", title: "右对齐" },
  { key: "table", icon: "ph:table", title: "添加表格" },
];

const toolbarColors: ToolbarColor[] = [
  { key: "default", label: "默认文字", value: "" },
  { key: "accent", label: "强调色", value: "var(--accent)" },
  { key: "secondary", label: "次级文字", value: "var(--text-secondary)" },
  { key: "warm", label: "暖色", value: "oklch(0.68 0.17 45)" },
  { key: "green", label: "绿色", value: "oklch(0.65 0.16 150)" },
  { key: "rose", label: "玫瑰色", value: "oklch(0.68 0.17 20)" },
];

const toolbarBackgroundColors: ToolbarColor[] = [
  { key: "default", label: "无背景", value: "" },
  { key: "soft-accent", label: "浅强调", value: "var(--article-mark-accent)" },
  { key: "warm", label: "浅暖色", value: "var(--article-mark-warm)" },
  { key: "green", label: "浅绿色", value: "var(--article-mark-green)" },
  { key: "rose", label: "浅玫瑰", value: "var(--article-mark-rose)" },
];

const codeLanguageOptions: ToolbarOption[] = [
  { label: "自动/纯文本", value: "" },
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "JSON", value: "json" },
  { label: "HTML / XML", value: "xml" },
  { label: "CSS", value: "css" },
  { label: "Bash", value: "bash" },
  { label: "Shell session", value: "shell" },
  { label: "Markdown", value: "markdown" },
  { label: "Plain text", value: "plaintext" },
];

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4, 5, 6],
      },
      codeBlock: false,
    }),
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: "plaintext",
    }),
    TextStyle,
    Color,
    Highlight.configure({
      multicolor: true,
    }),
    Superscript,
    Subscript,
    TextAlign.configure({
      types: ["heading", "paragraph"],
      alignments: ["left", "center", "right"],
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
    Underline,
    WavyUnderline,
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
    }),
    Image.configure({
      allowBase64: false,
    }),
    Placeholder.configure({
      placeholder: "开始写作...",
    }),
  ],
  content: createEmptyDoc(),
  editorProps: {
    attributes: {
      class: "tiptap-prosemirror",
    },
  },
  onUpdate: ({ editor: nextEditor }) => {
    if (applyingEditorContent) {
      return;
    }

    syncDraftFromEditor(nextEditor);
    scheduleAutosave();
  },
  onSelectionUpdate: () => {
    editorRevision.value += 1;
  },
});

const activeToolbarKeys = computed(() => {
  const currentEditor = editor.value;

  if (!currentEditor) {
    return [];
  }

  return toolbarActions
    .filter((action) => isToolbarActive(action.key))
    .map((action) => action.key);
});

const activeHeadingValue = computed(() => {
  const currentEditor = editor.value;

  if (!currentEditor) {
    return "paragraph";
  }

  for (const level of [1, 2, 3, 4, 5, 6] as HeadingLevel[]) {
    if (currentEditor.isActive("heading", { level })) {
      return String(level);
    }
  }

  return "paragraph";
});

const activeEditorColor = computed(() => {
  const value = editor.value?.getAttributes("textStyle").color;
  return typeof value === "string" ? value : "";
});

const activeEditorBackgroundColor = computed(() => {
  const value = editor.value?.getAttributes("highlight").color;
  return typeof value === "string" ? value : "";
});

const activeCodeLanguage = computed(() => {
  const currentEditor = editor.value;

  if (!currentEditor?.isActive("codeBlock")) {
    return "";
  }

  const value = currentEditor.getAttributes("codeBlock").language;
  return typeof value === "string" ? value : "";
});

const showCodeBlockMenu = computed(() => {
  trackEditorRevision();
  return Boolean(editor.value?.isActive("codeBlock"));
});

const showTableMenu = computed(() => {
  trackEditorRevision();
  return Boolean(editor.value?.isActive("table"));
});

const imageOperationPending = computed(() => imageUploading.value || imageConverting.value);

const stickyHeaderStyle = computed(() => ({
  "--editor-sticky-top": `${stickyTopOffset.value}px`,
  "--editor-toolbar-top": `${stickyTopOffset.value + stickyActionsHeight.value}px`,
}));

const hoverConvertButtonStyle = computed(() => {
  const target = hoveredExternalImage.value;

  if (!target) {
    return {};
  }

  return {
    top: `${target.top}px`,
    left: `${target.left}px`,
    maxWidth: `${target.maxWidth}px`,
  };
});

function trackEditorRevision(): number {
  return editorRevision.value;
}

const editorOutlineItems = computed(() => {
  trackEditorRevision();

  const currentEditor = editor.value;

  if (!currentEditor) {
    return [];
  }

  const items: Array<{ id: string; level: 2 | 3; pos: number; text: string }> = [];

  currentEditor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "heading" || (node.attrs.level !== 2 && node.attrs.level !== 3)) {
      return;
    }

    const text = node.textContent.trim();

    if (!text) {
      return;
    }

    items.push({
      id: `editor-heading-${pos}`,
      level: node.attrs.level,
      pos,
      text,
    });
  });

  return items;
});

const activeEditorHeadingPos = computed(() => {
  trackEditorRevision();

  const currentEditor = editor.value;

  if (!currentEditor) {
    return null;
  }

  const { $from } = currentEditor.state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);

    if (node.type.name === "heading" && (node.attrs.level === 2 || node.attrs.level === 3)) {
      return $from.before(depth);
    }
  }

  return null;
});

function createLocalDraft(): CmsEditorDraft {
  return {
    id: "",
    slug: "",
    summary: "",
    title: "",
    iconName: cmsEditorInitialDraft.iconName,
    tags: [],
    status: "draft",
    content: "",
    contentJson: createEmptyDoc(),
    publishInfo: createPublishInfo({
      autosaveState: "idle",
    }),
  };
}

function createEmptyDoc(): Record<string, unknown> {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
      },
    ],
  };
}

function createPublishInfo(overrides?: Partial<CmsPublishInfo>): CmsPublishInfo {
  return {
    createdAt: "",
    updatedAt: "",
    autosaveState: "idle",
    lastSavedAt: "",
    ...overrides,
  };
}

function resetDraft(source?: CmsEditorDraft): void {
  const nextDraft = source ?? createLocalDraft();

  pauseAutosaveBriefly();
  draft.id = nextDraft.id;
  draft.slug = nextDraft.slug;
  draft.summary = nextDraft.summary;
  draft.title = nextDraft.title;
  draft.iconName = nextDraft.iconName;
  draft.tags = [...nextDraft.tags];
  draft.status = nextDraft.status;
  draft.content = nextDraft.content;
  draft.contentJson = nextDraft.contentJson;
  draft.publishInfo = createPublishInfo(nextDraft.publishInfo);
  setEditorContent(nextDraft.contentJson);
}

function applyArticle(article: CmsArticleDetail): void {
  resetDraft({
    id: article.id,
    slug: article.slug,
    summary: article.summary,
    title: article.title,
    iconName: article.iconName,
    tags: [...article.tags],
    status: article.status,
    content: article.contentText,
    contentJson: article.contentJson,
    publishInfo: createPublishInfo({
      createdAt: formatShanghaiDateTime(article.createdAt),
      updatedAt: formatShanghaiDateTime(article.updatedAt),
      autosaveState: "saved",
      lastSavedAt: formatShanghaiTime(article.updatedAt),
    }),
  });
}

function markSavingState(state: CmsPublishInfo["autosaveState"]): void {
  draft.publishInfo = createPublishInfo({
    ...draft.publishInfo,
    autosaveState: state,
  });
}

function setEditorContent(contentJson: Record<string, unknown>): void {
  const currentEditor = editor.value;

  if (!currentEditor) {
    return;
  }

  applyingEditorContent = true;
  currentEditor.commands.setContent(contentJson);
  syncDraftFromEditor(currentEditor);
  applyingEditorContent = false;
  editorRevision.value += 1;

  if (!autosavePaused) {
    scheduleAutosave();
  }
}

function syncDraftFromEditor(currentEditor: EditorSnapshotSource | null | undefined = editor.value): void {
  if (!currentEditor) {
    return;
  }

  draft.contentJson = currentEditor.getJSON() as Record<string, unknown>;
  draft.content = currentEditor.getText();
  editorRevision.value += 1;
}

function pauseAutosaveBriefly(): void {
  autosavePaused = true;
  if (autosaveTimer !== null) {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
  window.setTimeout(() => {
    autosavePaused = false;
  }, 0);
}

function scheduleAutosave(): void {
  if (autosavePaused || loading.value || saving.value || publishing.value || imageOperationPending.value || !draft.id) {
    return;
  }

  if (autosaveTimer !== null) {
    window.clearTimeout(autosaveTimer);
  }

  autosaveTimer = window.setTimeout(() => {
    autosaveTimer = null;
    void runAutosave();
  }, 1500);
}

async function runAutosave(): Promise<void> {
  if (autosavePaused || loading.value || saving.value || publishing.value || imageOperationPending.value || !draft.id) {
    return;
  }

  syncDraftFromEditor();
  markSavingState("saving");

  try {
    const response = await autosaveCmsArticle(draft.id, getSavePayload());
    if (response.autosave) {
      draft.publishInfo = createPublishInfo({
        ...draft.publishInfo,
        autosaveState: "saved",
        lastSavedAt: formatShanghaiTime(response.autosave.createdAt),
      });
    }
  } catch {
    markSavingState("error");
  }
}

function isToolbarActive(key: string): boolean {
  const currentEditor = editor.value;

  if (!currentEditor) {
    return false;
  }

  if (key === "quote") return currentEditor.isActive("blockquote");
  if (key === "code") return currentEditor.isActive("codeBlock");
  if (key === "inlineCode") return currentEditor.isActive("code");
  if (key === "wavyUnderline") return currentEditor.isActive("wavyUnderline");
  if (key === "bullet") return currentEditor.isActive("bulletList");
  if (key === "ordered") return currentEditor.isActive("orderedList");
  if (key === "link") return currentEditor.isActive("link");
  if (key === "alignLeft") return currentEditor.isActive({ textAlign: "left" });
  if (key === "alignCenter") return currentEditor.isActive({ textAlign: "center" });
  if (key === "alignRight") return currentEditor.isActive({ textAlign: "right" });
  if (key === "table") return false;
  if (key === "image") return false;

  return currentEditor.isActive(key);
}

function toggleToolbar(key: string): void {
  const currentEditor = editor.value;

  if (!currentEditor) {
    return;
  }

  const chain = currentEditor.chain().focus();

  if (key === "bold") chain.toggleBold().run();
  if (key === "italic") chain.toggleItalic().run();
  if (key === "underline") chain.toggleUnderline().run();
  if (key === "wavyUnderline") chain.toggleMark("wavyUnderline").run();
  if (key === "strike") chain.toggleStrike().run();
  if (key === "inlineCode") chain.toggleCode().run();
  if (key === "quote") chain.toggleBlockquote().run();
  if (key === "code") chain.toggleCodeBlock().run();
  if (key === "bullet") chain.toggleBulletList().run();
  if (key === "ordered") chain.toggleOrderedList().run();
  if (key === "link") toggleLink();
  if (key === "image") openImagePicker();
  if (key === "superscript") chain.toggleSuperscript().run();
  if (key === "subscript") chain.toggleSubscript().run();
  if (key === "alignLeft") chain.setTextAlign("left").run();
  if (key === "alignCenter") chain.setTextAlign("center").run();
  if (key === "alignRight") chain.setTextAlign("right").run();
  if (key === "table") chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
}

function setHeadingLevel(value: string): void {
  const currentEditor = editor.value;

  if (!currentEditor) {
    return;
  }

  if (value === "paragraph") {
    currentEditor.chain().focus().setParagraph().run();
    return;
  }

  const level = parseHeadingLevel(value);
  if (!level || currentEditor.isActive("heading", { level })) {
    return;
  }

  currentEditor.chain().focus().toggleHeading({ level }).run();
}

function parseHeadingLevel(value: string): HeadingLevel | null {
  const level = Number(value);
  return level === 1 || level === 2 || level === 3 || level === 4 || level === 5 || level === 6 ? level : null;
}

function setEditorColor(value: string): void {
  const currentEditor = editor.value;

  if (!currentEditor) {
    return;
  }

  if (!value) {
    currentEditor.chain().focus().unsetColor().removeEmptyTextStyle().run();
    return;
  }

  currentEditor.chain().focus().setColor(value).run();
}

function setEditorBackgroundColor(value: string): void {
  const currentEditor = editor.value;

  if (!currentEditor) {
    return;
  }

  if (!value) {
    currentEditor.chain().focus().unsetHighlight().run();
    return;
  }

  currentEditor.chain().focus().setHighlight({ color: value }).run();
}

function setCodeLanguage(value: string): void {
  const currentEditor = editor.value;

  if (!currentEditor || !currentEditor.isActive("codeBlock")) {
    return;
  }

  currentEditor.chain().focus().updateAttributes("codeBlock", {
    language: value || null,
  }).run();
}

function runTableAction(action: "addRow" | "addColumn" | "deleteRow" | "deleteColumn"): void {
  const currentEditor = editor.value;

  if (!currentEditor || !currentEditor.isActive("table")) {
    return;
  }

  const chain = currentEditor.chain().focus();

  if (action === "addRow") chain.addRowAfter().run();
  if (action === "addColumn") chain.addColumnAfter().run();
  if (action === "deleteRow") chain.deleteRow().run();
  if (action === "deleteColumn") chain.deleteColumn().run();
}

function scrollToEditorHeading(pos: number): void {
  const currentEditor = editor.value;

  if (!currentEditor) {
    return;
  }

  currentEditor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
}

function addTag(tag: string): void {
  if (draft.tags.includes(tag)) {
    return;
  }
  draft.tags.push(tag);
}

function removeTag(tag: string): void {
  draft.tags = draft.tags.filter((item) => item !== tag);
}

function updateStatus(status: CmsArticleStatus): void {
  draft.status = status;
}

function getSavePayload() {
  syncDraftFromEditor();

  return {
    title: draft.title || undefined,
    summary: draft.summary || undefined,
    iconName: draft.iconName || undefined,
    tags: draft.tags,
    status: draft.status,
    contentText: draft.content || undefined,
    contentJson: draft.contentJson,
  };
}

async function persistDraft(): Promise<CmsArticleDetail> {
  if (autosaveTimer !== null) {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }

  if (draft.id) {
    const response = await updateCmsArticle(draft.id, getSavePayload());
    return response.article;
  }

  const response = await createCmsArticle({
    title: draft.title || undefined,
    summary: draft.summary || undefined,
    contentText: draft.content || undefined,
    iconName: draft.iconName || undefined,
    tags: draft.tags,
    status: draft.status,
    contentJson: draft.contentJson,
  });

  await router.replace(`/cms/articles/${response.article.id}`);
  return response.article;
}

async function loadArticle(id: string): Promise<void> {
  loading.value = true;
    loadError.value = "";
    saveMessage.value = "";
    saveError.value = "";
    latestAutosave.value = null;

  if (id === "new") {
    resetDraft(createLocalDraft());
    revisions.value = [];
    loading.value = false;
    return;
  }

  try {
    const response = await getCmsArticle(id);
    applyArticle(response.article);
    await loadLatestAutosave(response.article.id, response.article.updatedAt);
    await loadRevisions(response.article.id);
  } catch (error) {
    resetDraft({
      ...createLocalDraft(),
      id,
    });
    loadError.value = isApiError(error)
      ? `文章详情加载失败，当前保留本地草稿视图：${error.message}`
      : "文章详情加载失败，当前保留本地草稿视图。";
  } finally {
    loading.value = false;
  }
}

async function loadLatestAutosave(id: string, articleUpdatedAt: string): Promise<void> {
  try {
    const response = await getLatestCmsArticleAutosave(id);
    const autosave = response.autosave;

    latestAutosave.value =
      autosave && Date.parse(autosave.createdAt) > Date.parse(articleUpdatedAt)
        ? autosave
        : null;
  } catch {
    latestAutosave.value = null;
  }
}

function handleRestoreAutosave(): void {
  const autosave = latestAutosave.value;

  if (!autosave) {
    return;
  }

  const confirmed = window.confirm(`从 ${formatShanghaiDateTime(autosave.createdAt)} 的自动保存恢复？当前编辑内容会被覆盖。`);
  if (!confirmed) {
    return;
  }

  resetDraft({
    ...draft,
    id: draft.id,
    slug: draft.slug,
    title: autosave.title,
    iconName: autosave.iconName,
    tags: [...autosave.tags],
    content: autosave.contentText,
    contentJson: autosave.contentJson,
    publishInfo: createPublishInfo({
      ...draft.publishInfo,
      autosaveState: "saved",
      lastSavedAt: formatShanghaiTime(autosave.createdAt),
    }),
  });
  latestAutosave.value = null;
  saveMessage.value = "已从自动保存恢复，请确认后手动保存。";
  saveError.value = "";
}

async function loadRevisions(id = draft.id): Promise<void> {
  if (!id) {
    revisions.value = [];
    return;
  }

  revisionsLoading.value = true;
  revisionsError.value = "";

  try {
    const response = await getCmsArticleRevisions(id);
    revisions.value = response.revisions;
  } catch (error) {
    revisionsError.value = isApiError(error) ? error.message : "版本记录加载失败。";
  } finally {
    revisionsLoading.value = false;
  }
}

async function handleSave(): Promise<void> {
  saving.value = true;
  saveError.value = "";
  saveMessage.value = "";
  markSavingState("saving");

  try {
    const article = await persistDraft();
    applyArticle(article);
    await loadRevisions(article.id);
    saveMessage.value = "已保存当前文章。";
  } catch (error) {
    markSavingState("error");
    saveError.value = isApiError(error) ? error.message : "保存失败，请稍后重试。";
  } finally {
    saving.value = false;
  }
}

async function handlePublish(): Promise<void> {
  publishing.value = true;
  saveError.value = "";
  saveMessage.value = "";
  markSavingState("saving");

  try {
    const savedArticle = await persistDraft();
    const response = await publishCmsArticle(savedArticle.id);
    applyArticle(response.article);
    await loadRevisions(response.article.id);
    saveMessage.value = "文章已发布。";
  } catch (error) {
    markSavingState("error");
    saveError.value = isApiError(error) ? error.message : "发布失败，请稍后重试。";
  } finally {
    publishing.value = false;
  }
}

async function handleRestoreRevision(revision: CmsArticleRevision): Promise<void> {
  if (!draft.id) {
    return;
  }

  const confirmed = window.confirm(`恢复到 ${formatShanghaiDateTime(revision.createdAt)} 的版本？当前编辑内容会被覆盖。`);
  if (!confirmed) {
    return;
  }

  saving.value = true;
  saveError.value = "";
  saveMessage.value = "";
  markSavingState("saving");

  try {
    const response = await restoreCmsArticleRevision(draft.id, revision.id);
    applyArticle(response.article);
    await loadRevisions(response.article.id);
    saveMessage.value = "已恢复所选版本。";
  } catch (error) {
    markSavingState("error");
    saveError.value = isApiError(error) ? error.message : "恢复版本失败，请稍后重试。";
  } finally {
    saving.value = false;
  }
}

function formatRevisionReason(reason: string): string {
  const labels: Record<string, string> = {
    manual_save: "保存",
    publish: "发布",
    archive: "归档",
    rollback: "版本恢复",
  };

  return labels[reason] ?? reason;
}

function formatRevisionTitle(revision: CmsArticleRevision): string {
  return `${formatRevisionReason(revision.reason)} ${formatShanghaiDateTime(revision.createdAt)}`;
}

function handlePreview(): void {
  syncDraftFromEditor();
  saveError.value = "";

  const slug = draft.slug?.trim() ?? "";

  if (!slug) {
    saveMessage.value = "保存文章并生成 slug 后可预览公开页。";
    return;
  }

  const routeData = router.resolve(`/articles/${slug}`);
  window.open(routeData.href, "_blank", "noopener,noreferrer");
}

async function runAiAction(key: CmsAiActionKey): Promise<void> {
  syncDraftFromEditor();
  activeAiKey.value = key;
  aiMessage.value = "AI 正在处理当前正文...";
  aiError.value = "";

  if (!draft.content.trim()) {
    aiMessage.value = "";
    aiError.value = "请先写入正文内容，再使用 AI 操作。";
    activeAiKey.value = null;
    return;
  }

  const input = {
    title: draft.title,
    contentText: draft.content,
    articleId: draft.id || undefined,
  };

  try {
    if (key === "summary") {
      const result = await generateSummary(input);
      draft.summary = result.summary;
      aiMessage.value = `已生成摘要候选：${result.summary}`;
      return;
    }

    if (key === "tags") {
      const result = await generateTags(input);
      result.tags.forEach(addTag);
      aiMessage.value = `已加入标签：${result.tags.join("、")}`;
      return;
    }

    if (key === "polish") {
      const result = await polishText(input);
      setEditorContent(contentTextToDoc(result.text));
      aiMessage.value = "已用润色结果替换正文。";
      return;
    }

    const result = await formatContent(input);
    setEditorContent(result.contentJson);
    aiMessage.value = "已生成结构化排版，并写入编辑器。";
  } catch (error) {
    aiError.value = isApiError(error) ? error.message : "AI 操作失败，请稍后重试。";
  } finally {
    activeAiKey.value = null;
  }
}

function contentTextToDoc(contentText: string): Record<string, unknown> {
  const content = contentText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: paragraph,
        },
      ],
    }));

  return {
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  };
}

function toggleLink(): void {
  const currentEditor = editor.value;

  if (!currentEditor) {
    return;
  }

  const previousUrl = currentEditor.getAttributes("link").href as string | undefined;
  const url = window.prompt("链接 URL", previousUrl ?? "");

  if (url === null) {
    return;
  }

  if (!url.trim()) {
    currentEditor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }

  currentEditor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
}

function openImagePicker(): void {
  if (imageOperationPending.value) {
    return;
  }

  imageUploadInput.value?.click();
}

function promptImageLink(): void {
  const currentEditor = editor.value;

  if (!currentEditor) {
    return;
  }

  const url = window.prompt("图片 URL", "");

  if (url === null) {
    return;
  }

  const normalizedUrl = normalizeInsertableImageUrl(url);

  if (!normalizedUrl) {
    saveMessage.value = "";
    saveError.value = "请输入 http/https 图片地址，或现有的 /api/cms/media 地址。";
    return;
  }

  currentEditor.chain().focus().setImage({ src: normalizedUrl }).run();
  syncDraftFromEditor(currentEditor);
  scheduleAutosave();
  saveError.value = "";
  saveMessage.value = "已插入图片链接。";
}

async function handleImageInputChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";

  if (!file) {
    return;
  }

  await uploadAndInsertImage(file);
}

async function uploadAndInsertImage(file: File): Promise<void> {
  const currentEditor = editor.value;

  if (!currentEditor || imageOperationPending.value) {
    return;
  }

  imageUploading.value = true;
  saveMessage.value = "";
  saveError.value = "";

  try {
    if (!draft.id) {
      await ensureDraftExistsForImageOperation("正在先保存文章，以便图片关联到当前文章...");
    }

    const uploaded = await uploadCmsImage(file, {
      articleId: draft.id,
    });

    currentEditor.chain().focus().setImage({
      src: uploaded.url,
      alt: file.name,
    }).run();
    syncDraftFromEditor(currentEditor);
    scheduleAutosave();
    saveMessage.value = "图片已上传并插入正文。";
  } catch (error) {
    const message = isApiError(error) ? error.message : "图片上传失败，请稍后重试。";
    const fallbackSrc = window.prompt("图片上传失败，可改为手动输入 URL", "");

    if (fallbackSrc?.trim()) {
      currentEditor.chain().focus().setImage({ src: fallbackSrc.trim(), alt: file.name }).run();
      syncDraftFromEditor(currentEditor);
      scheduleAutosave();
      saveMessage.value = "已改为插入手动图片 URL。";
      saveError.value = "";
    } else {
      saveError.value = message;
    }
  } finally {
    imageUploading.value = false;
  }
}

async function convertExternalImage(target: ImageNodeContext | null = hoveredExternalImage.value): Promise<void> {
  const currentEditor = editor.value;

  if (!currentEditor || !target || imageOperationPending.value) {
    return;
  }

  imageConverting.value = true;
  saveMessage.value = "";
  saveError.value = "";

  try {
    if (!draft.id) {
      await ensureDraftExistsForImageOperation("正在先保存文章，以便外链图片能关联到当前文章...");
    }

    saveMessage.value = "正在转存外链图片到媒体库...";
    const uploaded = await uploadCmsImageFromUrl(target.src, {
      articleId: draft.id,
    });

    replaceImageAtPosition(target.pos, {
      src: uploaded.url,
      alt: target.alt,
    });
    hoveredExternalImage.value = null;
    syncDraftFromEditor(currentEditor);
    scheduleAutosave();
    saveError.value = "";
    saveMessage.value = "已将外链图片转存到媒体库。";
  } catch (error) {
    saveMessage.value = "";
    saveError.value = isApiError(error) ? error.message : "外链图片转存失败，请稍后重试。";
  } finally {
    imageConverting.value = false;
  }
}

async function ensureDraftExistsForImageOperation(message: string): Promise<void> {
  saveMessage.value = message;
  const article = await persistDraft();
  applyArticle(article);
  await loadRevisions(article.id);
}

function replaceImageAtPosition(pos: number, attrs: { src: string; alt?: string }): void {
  const currentEditor = editor.value;

  if (!currentEditor) {
    return;
  }

  currentEditor.chain().focus().setNodeSelection(pos).updateAttributes("image", attrs).run();
}

function handleEditorMouseMove(event: MouseEvent): void {
  const wrap = editorContentWrap.value;
  const currentEditor = editor.value;

  if (!wrap || !currentEditor) {
    return;
  }

  const target = event.target as HTMLElement | null;

  if (target?.closest(".image-convert-float")) {
    return;
  }

  const imageElement = target?.closest("img");

  if (!(imageElement instanceof HTMLImageElement) || !wrap.contains(imageElement)) {
    hoveredExternalImage.value = null;
    return;
  }

  const src = imageElement.getAttribute("src")?.trim() ?? imageElement.currentSrc.trim();

  if (!isExternalImageUrl(src)) {
    hoveredExternalImage.value = null;
    return;
  }

  const rect = imageElement.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  const horizontalPadding = 8;
  const maxWidth = Math.max(Math.min(wrap.clientWidth - horizontalPadding * 2, 360), 220);
  const buttonWidth = Math.min(220, maxWidth);
  const left = Math.min(
    Math.max(rect.right - wrapRect.left - buttonWidth, horizontalPadding),
    Math.max(wrap.clientWidth - buttonWidth - horizontalPadding, horizontalPadding),
  );
  const top = Math.max(rect.top - wrapRect.top + 8, horizontalPadding);

  hoveredExternalImage.value = {
    src,
    alt: imageElement.getAttribute("alt")?.trim() ?? "",
    pos: currentEditor.view.posAtDOM(imageElement, 0),
    top,
    left,
    maxWidth,
  };
}

function clearHoveredExternalImage(): void {
  hoveredExternalImage.value = null;
}

function updateStickyMetrics(): void {
  const navbar = document.querySelector<HTMLElement>(".navbar");
  const actions = document.querySelector<HTMLElement>(".editor-actions-sticky");

  stickyTopOffset.value = (navbar?.getBoundingClientRect().height ?? 68) + STICKY_HEADER_EXTRA_GAP;
  stickyActionsHeight.value = (actions?.getBoundingClientRect().height ?? 0) + 8;
}

function normalizeInsertableImageUrl(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith(CMS_MEDIA_PATH_PREFIX)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);

    if (parsed.pathname.startsWith(CMS_MEDIA_PATH_PREFIX)) {
      return parsed.pathname + parsed.search + parsed.hash;
    }

    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function isExternalImageUrl(value: string): boolean {
  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
    return isHttp && !parsed.pathname.startsWith(CMS_MEDIA_PATH_PREFIX);
  } catch {
    return false;
  }
}

watch(
  articleId,
  (id) => {
    void loadArticle(id);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (autosaveTimer !== null) {
    window.clearTimeout(autosaveTimer);
  }
  window.removeEventListener("resize", updateStickyMetrics);
  editor.value?.destroy();
});

onMounted(() => {
  updateStickyMetrics();
  window.addEventListener("resize", updateStickyMetrics);
});

watch(
  () => [loading.value, saving.value, publishing.value],
  () => {
    requestAnimationFrame(() => {
      updateStickyMetrics();
    });
  },
  { immediate: true },
);

watch(
  () => [draft.title, draft.summary, draft.iconName, draft.status, draft.tags.join("\u001f")],
  () => {
    scheduleAutosave();
  },
);
</script>

<template>
  <CmsShell :title="pageTitle" :subtitle="pageSubtitle">
    <p v-if="loadError" class="status-line">
      {{ loadError }}
    </p>
    <p v-else-if="saveMessage" class="status-line">
      {{ saveMessage }}
    </p>
        <p v-if="saveError" class="status-line error">
      {{ saveError }}
    </p>
    <section v-if="latestAutosave" class="autosave-restore">
      <div>
        <strong>发现新的自动保存</strong>
        <p>保存于 {{ formatShanghaiDateTime(latestAutosave.createdAt) }}，可以恢复后再手动保存。</p>
      </div>
      <button type="button" class="text-action" :disabled="saving || publishing" @click="handleRestoreAutosave">
        从自动保存恢复
      </button>
    </section>

    <div class="editor-layout" :class="{ loading }">
      <main>
        <input ref="imageUploadInput" class="hidden-file-input" type="file" accept="image/*" @change="handleImageInputChange" />
        <div class="editor-actions-sticky" :style="stickyHeaderStyle">
          <div class="header-actions">
            <button type="button" class="text-action" @click="handlePreview">预览</button>
            <button type="button" class="text-action" :disabled="loading || saving || publishing" @click="handleSave">
              {{ saving ? "保存中..." : "保存" }}
            </button>
            <button
              type="button"
              class="text-action publish-action"
              :disabled="loading || saving || publishing"
              @click="handlePublish"
            >
              {{ publishing ? "发布中..." : "发布" }}
            </button>
          </div>
        </div>
        <input v-model="draft.title" type="text" class="title-input" placeholder="文章标题..." />
        <div class="editor-toolbar-sticky" :style="stickyHeaderStyle">
          <EditorToolbar
            :actions="toolbarActions"
            :active-keys="activeToolbarKeys"
            :heading-value="activeHeadingValue"
            :colors="toolbarColors"
            :active-color="activeEditorColor"
            :background-colors="toolbarBackgroundColors"
            :active-background-color="activeEditorBackgroundColor"
            @toggle="toggleToolbar"
            @set-heading="setHeadingLevel"
            @set-color="setEditorColor"
            @set-background-color="setEditorBackgroundColor"
            @image-upload="openImagePicker"
            @image-link="promptImageLink"
          />
        </div>
        <section
          ref="editorContentWrap"
          class="editor-content-wrap"
          @mousemove="handleEditorMouseMove"
          @mouseleave="clearHoveredExternalImage"
        >
          <p class="hint">正文</p>
          <BubbleMenu
            v-if="editor"
            :editor="editor"
            plugin-key="code-block-language-menu"
            :should-show="() => showCodeBlockMenu"
            :options="{ placement: 'top-start', offset: 8 }"
          >
            <label class="context-menu context-menu-select" title="代码语言">
              <span>代码语言</span>
              <select
                :value="activeCodeLanguage"
                aria-label="代码语言"
                @change="setCodeLanguage(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="language in codeLanguageOptions" :key="language.value || 'auto'" :value="language.value">
                  {{ language.label }}
                </option>
              </select>
            </label>
          </BubbleMenu>
          <BubbleMenu
            v-if="editor"
            :editor="editor"
            plugin-key="table-edit-menu"
            :should-show="() => showTableMenu"
            :options="{ placement: 'top-start', offset: 8 }"
          >
            <div class="context-menu table-context-menu" aria-label="表格编辑">
              <button type="button" title="增加表格行" @click="runTableAction('addRow')">加行</button>
              <button type="button" title="增加表格列" @click="runTableAction('addColumn')">加列</button>
              <button type="button" title="删除当前表格行" @click="runTableAction('deleteRow')">删行</button>
              <button type="button" title="删除当前表格列" @click="runTableAction('deleteColumn')">删列</button>
            </div>
          </BubbleMenu>
          <div v-if="hoveredExternalImage" class="image-convert-float" :style="hoverConvertButtonStyle">
            <span class="image-convert-url" :title="hoveredExternalImage.src">{{ hoveredExternalImage.src }}</span>
            <button
              type="button"
              class="image-convert-button"
              :disabled="imageOperationPending"
              @click="convertExternalImage(hoveredExternalImage)"
            >
              {{ imageConverting ? "转存中..." : "转存到媒体库" }}
            </button>
          </div>
          <EditorContent v-if="editor" :editor="editor" class="editor-content" :class="{ disabled: loading }" />
          <p v-if="aiMessage" class="ai-note">{{ aiMessage }}</p>
          <p v-if="aiError" class="ai-error">{{ aiError }}</p>
        </section>
      </main>

      <aside class="sidebar">
        <section class="panel">
          <h3>文章图标</h3>
          <IconPicker v-model="draft.iconName" />
        </section>
        <section class="panel">
          <h3>标签</h3>
          <TagEditor :tags="draft.tags" @add="addTag" @remove="removeTag" />
        </section>
        <section class="panel">
          <div class="panel-heading">
            <h3>文章简介</h3>
            <span>{{ draft.summary?.length ?? 0 }}/240</span>
          </div>
          <textarea
            v-model="draft.summary"
            class="summary-input"
            maxlength="240"
            rows="5"
            placeholder="写一段会出现在文章列表中的简介..."
          ></textarea>
          <p class="panel-help">AI 生成摘要会直接填写到这里，保存后同步到首页和文章列表。</p>
        </section>
        <section class="panel">
          <h3>访问链接</h3>
          <label class="slug-input" aria-label="文章访问链接">
            <span class="slug-prefix">https://blog.yamds.cafe/articles/</span>
            <input
              v-model="draft.slug"
              type="text"
              inputmode="url"
              autocomplete="off"
              spellcheck="false"
              placeholder="ceshi"
            />
          </label>
          <p class="panel-help">留空时会按标题自动生成 slug。</p>
        </section>
        <section class="panel">
          <PublishPanel
            :status="draft.status"
            :created-at="draft.publishInfo.createdAt"
            :updated-at="draft.publishInfo.updatedAt"
            :autosave-state="draft.publishInfo.autosaveState"
            :last-saved-at="draft.publishInfo.lastSavedAt"
            @update:status="updateStatus"
          />
        </section>
        <section v-if="editorOutlineItems.length" class="panel editor-outline-panel">
          <h3>目录</h3>
          <ul class="editor-outline-list">
            <li
              v-for="item in editorOutlineItems"
              :key="item.id"
              class="editor-outline-item"
              :class="`level-${item.level}`"
            >
              <button
                type="button"
                class="editor-outline-link"
                :class="{ active: activeEditorHeadingPos === item.pos }"
                @click="scrollToEditorHeading(item.pos)"
              >
                {{ item.text }}
              </button>
            </li>
          </ul>
        </section>
        <section class="panel revisions-panel">
          <div class="panel-heading">
            <h3>版本</h3>
            <button type="button" class="panel-link" :disabled="!draft.id || revisionsLoading" @click="loadRevisions()">
              刷新
            </button>
          </div>
          <p v-if="!draft.id" class="panel-help">首次保存后会记录版本。</p>
          <p v-else-if="revisionsLoading" class="panel-help">正在读取版本...</p>
          <p v-else-if="revisionsError" class="panel-help error">{{ revisionsError }}</p>
          <ul v-else-if="revisions.length" class="revision-list">
            <li v-for="revision in revisions.slice(0, 6)" :key="revision.id" class="revision-item">
              <div>
                <strong>{{ formatRevisionTitle(revision) }}</strong>
              </div>
              <button type="button" class="panel-link" :disabled="saving || publishing" @click="handleRestoreRevision(revision)">
                恢复
              </button>
            </li>
          </ul>
          <p v-else class="panel-help">暂无版本记录。</p>
        </section>
        <section class="panel">
          <AiPanel :actions="cmsAiActions" :active-key="activeAiKey" @run="runAiAction" />
          <p v-if="aiMessage" class="side-note">{{ aiMessage }}</p>
          <p v-if="aiError" class="side-error">{{ aiError }}</p>
        </section>
      </aside>
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
}
.status-line.error {
  color: var(--accent);
  border-color: color-mix(in oklab, var(--accent) 35%, var(--border-subtle));
}
.autosave-restore {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  border: 1px solid color-mix(in oklab, var(--accent) 32%, var(--border-subtle));
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
}
.autosave-restore strong {
  display: block;
  margin-bottom: 4px;
}
.autosave-restore p {
  color: var(--text-secondary);
  font-size: 13px;
}
.hidden-file-input { display: none; }
.editor-layout { display: grid; grid-template-columns: 1fr 320px; gap: var(--space-4); }
.editor-layout.loading { opacity: 0.82; }
.editor-actions-sticky,
.editor-toolbar-sticky {
  position: sticky;
  z-index: 11;
  background: color-mix(in oklab, var(--bg) 94%, transparent);
  backdrop-filter: blur(12px);
}
.editor-actions-sticky {
  top: var(--editor-sticky-top);
  padding: var(--space-2) 0 var(--space-2);
}
.editor-toolbar-sticky {
  top: var(--editor-toolbar-top);
  z-index: 10;
  padding: 0 0 var(--space-3);
}
.header-actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-bottom: var(--space-3); flex-wrap: wrap; }
.text-action {
  position: relative;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  padding: 7px 0;
}

.text-action::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 3px;
  height: 1px;
  background: currentColor;
  opacity: 0;
  transform: scaleX(0);
  transform-origin: right center;
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
}

.text-action:hover:enabled,
.text-action:focus-visible {
  background: transparent;
  color: var(--accent);
}

.text-action:hover:enabled::after,
.text-action:focus-visible::after {
  opacity: 1;
  transform: scaleX(1);
  transform-origin: left center;
}

.text-action:focus-visible {
  outline: none;
}
.text-action:disabled { cursor: not-allowed; opacity: 0.5; }
.publish-action { color: var(--accent); }
.title-input { border: 0; font-size: clamp(30px, 4vw, 38px); padding: var(--space-2) 0; margin-top: var(--space-3); background: transparent; }
.title-input:hover,.title-input:focus { border: 0; }
.editor-content-wrap { position: relative; margin-top: var(--space-2); border: 1px solid var(--border-subtle); background: var(--bg-elevated); border-radius: var(--radius-md); padding: var(--space-3); }
.hint { font-size: 12px; color: var(--text-tertiary); margin-bottom: var(--space-2); }
.context-menu {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 6px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: color-mix(in oklab, var(--bg-elevated) 92%, transparent);
  box-shadow: 0 10px 26px color-mix(in oklab, var(--text-primary) 10%, transparent);
  backdrop-filter: blur(12px);
}
.context-menu button {
  min-width: 42px;
  height: 30px;
  padding: 0 9px;
  border-color: transparent;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 12px;
}
.context-menu button:hover,
.context-menu button:focus-visible {
  border-color: var(--border);
  background: var(--bg);
  color: var(--accent);
}
.context-menu-select {
  padding-left: 10px;
  color: var(--text-secondary);
  font-size: 12px;
}
.context-menu-select select {
  width: 128px;
  height: 30px;
  padding: 0 24px 0 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}
.image-convert-float {
  position: absolute;
  z-index: 9;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 36px;
  padding: 4px 6px 4px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in oklab, var(--bg-elevated) 94%, transparent);
  color: var(--text-primary);
  font-size: 12px;
  box-shadow: 0 10px 26px color-mix(in oklab, var(--text-primary) 10%, transparent);
  backdrop-filter: blur(12px);
}
.image-convert-url {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  color: var(--text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.image-convert-button {
  flex: 0 0 auto;
  min-width: 96px;
  height: 28px;
  padding: 0 9px;
  border-color: transparent;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 12px;
}
.image-convert-button:hover:enabled,
.image-convert-button:focus-visible {
  border-color: var(--border);
  background: var(--bg);
  color: var(--accent);
}
.slug-input {
  display: flex;
  align-items: stretch;
  margin-top: var(--space-2);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
}
.slug-prefix {
  display: inline-flex;
  align-items: center;
  flex: 0 1 auto;
  min-width: 0;
  padding: 0 var(--space-2);
  border-right: 1px solid var(--border-subtle);
  color: var(--text-tertiary);
  font-size: 13px;
  white-space: nowrap;
}
.slug-input input {
  flex: 1;
  min-width: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.slug-input:focus-within {
  border-color: var(--accent);
}
.editor-content { min-height: 440px; }
.editor-content.disabled { pointer-events: none; opacity: 0.72; }
.editor-content :deep(.tiptap-prosemirror) {
  min-height: 440px;
  outline: none;
  color: var(--text-primary);
  font-family: var(--font-article);
  font-size: 16px;
  line-height: 1.72;
  text-wrap: pretty;
}
.editor-content :deep(.tiptap-prosemirror > * + *) { margin-top: 1em; }
.editor-content :deep(.tiptap-prosemirror h1),
.editor-content :deep(.tiptap-prosemirror h2),
.editor-content :deep(.tiptap-prosemirror h3),
.editor-content :deep(.tiptap-prosemirror h4) {
  color: var(--text-primary);
  font-family: var(--font-article);
  font-weight: 500;
  line-height: 1.4;
}
.editor-content :deep(.tiptap-prosemirror h1) { font-size: 34px; }
.editor-content :deep(.tiptap-prosemirror h2) { font-size: 28px; }
.editor-content :deep(.tiptap-prosemirror h3) { font-size: 23px; }
.editor-content :deep(.tiptap-prosemirror h4) { font-size: 19px; }
.editor-content :deep(.tiptap-prosemirror h5) { font-size: 17px; }
.editor-content :deep(.tiptap-prosemirror h6) { font-size: 15px; color: var(--text-secondary); }
.editor-content :deep(.tiptap-prosemirror a) {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.editor-content :deep(.tiptap-prosemirror u) {
  text-decoration: underline;
  text-decoration-color: var(--accent);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
.editor-content :deep(.tiptap-prosemirror .wavy) {
  text-decoration: underline wavy;
  text-decoration-color: var(--accent);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}
.editor-content :deep(.tiptap-prosemirror blockquote) {
  margin-left: 0;
  padding-left: var(--space-3);
  border-left: 2px solid var(--accent);
  color: var(--text-secondary);
}
.editor-content :deep(.tiptap-prosemirror ul),
.editor-content :deep(.tiptap-prosemirror ol) {
  padding-left: var(--space-4);
}
.editor-content :deep(.tiptap-prosemirror hr) {
  border: 0;
  border-top: 1px solid var(--border);
  margin: var(--space-4) 0;
}
.editor-content :deep(.tiptap-prosemirror pre) {
  overflow: auto;
  padding: 10px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.7;
}
.editor-content :deep(.tiptap-prosemirror code) {
  font-family: var(--font-mono);
  font-size: 0.85em;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--accent);
}
.editor-content :deep(.tiptap-prosemirror pre code) {
  font-size: inherit;
  padding: 0;
  background: transparent;
  color: inherit;
}
.editor-content :deep(.hljs-keyword),
.editor-content :deep(.hljs-selector-tag),
.editor-content :deep(.hljs-built_in),
.editor-content :deep(.hljs-tag) {
  color: var(--syntax-keyword);
}
.editor-content :deep(.hljs-string),
.editor-content :deep(.hljs-section),
.editor-content :deep(.hljs-literal),
.editor-content :deep(.hljs-template-tag),
.editor-content :deep(.hljs-template-variable) {
  color: var(--syntax-string);
}
.editor-content :deep(.hljs-title),
.editor-content :deep(.hljs-title.function_),
.editor-content :deep(.hljs-function),
.editor-content :deep(.hljs-name),
.editor-content :deep(.hljs-attribute) {
  color: var(--syntax-function);
}
.editor-content :deep(.hljs-comment),
.editor-content :deep(.hljs-quote),
.editor-content :deep(.hljs-deletion),
.editor-content :deep(.hljs-meta) {
  color: var(--syntax-comment);
}
.editor-content :deep(.hljs-number),
.editor-content :deep(.hljs-regexp),
.editor-content :deep(.hljs-link),
.editor-content :deep(.hljs-symbol),
.editor-content :deep(.hljs-bullet),
.editor-content :deep(.hljs-addition) {
  color: var(--syntax-number);
}
.editor-content :deep(.hljs-operator),
.editor-content :deep(.hljs-punctuation),
.editor-content :deep(.hljs-variable),
.editor-content :deep(.hljs-type),
.editor-content :deep(.hljs-params) {
  color: var(--syntax-operator);
}
.editor-content :deep(.tiptap-prosemirror img) {
  display: block;
  max-width: 100%;
  border-radius: var(--radius-md);
}
.editor-content :deep(.tiptap-prosemirror mark) {
  border-radius: 3px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.editor-content :deep(.tiptap-prosemirror table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.editor-content :deep(.tiptap-prosemirror th),
.editor-content :deep(.tiptap-prosemirror td) {
  min-width: 72px;
  border: 1px solid var(--border-subtle);
  padding: 10px 12px;
  vertical-align: top;
}
.editor-content :deep(.tiptap-prosemirror th) {
  color: var(--text-primary);
  background: var(--bg-elevated);
  font-weight: 600;
}
.editor-content :deep(.tiptap-prosemirror .selectedCell::after) {
  content: "";
  position: absolute;
  inset: 0;
  background: color-mix(in oklab, var(--accent) 14%, transparent);
  pointer-events: none;
}
.editor-content :deep(.tiptap-prosemirror .tableWrapper) {
  overflow-x: auto;
}
.editor-content :deep(.tiptap-prosemirror sup),
.editor-content :deep(.tiptap-prosemirror sub) {
  line-height: 0;
}
.editor-content :deep(.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  color: var(--text-tertiary);
  pointer-events: none;
}
.ai-note,.ai-error { margin-top: var(--space-2); font-size: 13px; line-height: 1.7; }
.ai-note { color: var(--text-secondary); }
.ai-error { color: var(--accent); }
.side-note,.side-error { margin-top: var(--space-2); font-size: 13px; line-height: 1.7; }
.side-note { color: var(--text-secondary); }
.side-error { color: var(--accent); }
.sidebar { display: grid; gap: var(--space-3); align-content: start; }
.panel { background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: var(--space-3); }
.panel h3 { font-size: 14px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: var(--space-2); }
.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}
.panel-heading h3 { margin-bottom: 0; }
.panel-heading span,
.panel-help {
  color: var(--text-tertiary);
  font-size: 12px;
}
.panel-help.error { color: var(--accent); }
.panel-link {
  border: 0;
  background: transparent;
  color: var(--accent);
  padding: 0;
  font-size: 12px;
}
.panel-link:disabled { cursor: not-allowed; opacity: 0.5; }
.summary-input {
  min-height: 128px;
  resize: vertical;
  border-color: var(--border-subtle);
  background: var(--bg);
  line-height: 1.7;
}
.panel-help {
  margin-top: var(--space-2);
  line-height: 1.6;
}
.editor-outline-list { list-style: none; padding: 0; margin: 0; }
.editor-outline-item { margin-bottom: var(--space-1); }
.editor-outline-item.level-3 { padding-left: var(--space-3); }
.editor-outline-link {
  display: block;
  width: 100%;
  padding: var(--space-1) var(--space-2);
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  text-align: left;
  font-size: 13px;
}
.editor-outline-link:hover,
.editor-outline-link.active {
  background: var(--bg);
  color: var(--accent);
}
.revision-list { list-style: none; padding: 0; margin: 0; }
.revision-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-top: 1px solid var(--border-subtle);
}
.revision-item:first-child { border-top: 0; padding-top: 0; }
.revision-item strong {
  display: block;
  color: var(--text-primary);
  font-size: 13px;
}
@media (max-width: 1024px) {
  .editor-layout { grid-template-columns: 1fr; }
  .editor-actions-sticky { top: calc(var(--editor-sticky-top) - 4px); }
  .editor-toolbar-sticky { top: calc(var(--editor-toolbar-top) - 4px); }
}
</style>
