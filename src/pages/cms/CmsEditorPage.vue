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
  translateContent,
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
import { useI18n } from "@/i18n/useI18n";
import type {
  CmsArticleDetail,
  CmsArticleAutosave,
  CmsLocalizedContentDraft,
  CmsArticleRevision,
  CmsArticleLanguage,
  CmsArticleStatus,
  CmsPublishInfo,
} from "@/types/cms";
import { formatShanghaiDateTime, formatShanghaiTime } from "@/utils/date";

const route = useRoute();
const router = useRouter();
const { locale } = useI18n();

interface CmsLocalizedEditorDraft extends CmsLocalizedContentDraft {
  articleId: string;
  slug: string;
  status: CmsArticleStatus;
  createdAtRaw: string;
  updatedAtRaw: string;
  publishInfo: CmsPublishInfo;
}

interface CmsEditorSharedDraft {
  sourceArticleId: string;
  translationGroupId: string;
  iconName: string;
  tags: string[];
}

const draft = reactive(createSharedDraft());
const localizedDrafts = reactive<Record<CmsArticleLanguage, CmsLocalizedEditorDraft>>({
  zh: createLocalizedContentDraft(),
  en: createLocalizedContentDraft(),
});
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
const editorLocale = ref<CmsArticleLanguage>("zh");
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
  width: number;
  canConvert: boolean;
}

const hoveredImage = ref<HoveredImageContext | null>(null);

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

const isNewArticle = computed(() => articleId.value === "new" || !localizedDrafts.zh.articleId);
const editorText = computed(() =>
  locale.value === "en"
    ? {
        newTitle: "New Article",
        editTitle: "Edit Article",
        newSubtitle: "Start the draft first, then save and refine the details.",
        editSubtitle: "Keep it light, save anytime, and decide when to publish.",
        toolbar: {
          bold: "Bold",
          italic: "Italic",
          wavyUnderline: "Wavy underline",
          underline: "Underline",
          strike: "Strikethrough",
          quote: "Quote",
          inlineCode: "Inline code",
          code: "Code block",
          bullet: "Bulleted list",
          ordered: "Numbered list",
          link: "Link",
          image: "Image",
          superscript: "Superscript",
          subscript: "Subscript",
          alignLeft: "Align left",
          alignCenter: "Align center",
          alignRight: "Align right",
          table: "Add table",
        },
        colors: {
          defaultText: "Default text",
          accent: "Accent",
          secondary: "Secondary text",
          warm: "Warm",
          green: "Green",
          rose: "Rose",
          noBackground: "No background",
          softAccent: "Soft accent",
          softWarm: "Soft warm",
          softGreen: "Soft green",
          softRose: "Soft rose",
        },
        autoPlainText: "Auto / plain text",
        writingPlaceholder: "Start writing...",
        loadArticleFailedWithMessage: "Article details failed to load. Keeping the local draft view: {message}",
        loadArticleFailed: "Article details failed to load. Keeping the local draft view.",
        restoreAutosaveConfirm: "Restore the autosave from {time}? Current edits will be overwritten.",
        restoredAutosave: "Restored from autosave. Review it, then save manually.",
        revisionsLoadFailed: "Failed to load revisions.",
        saved: "Article saved.",
        saveFailed: "Save failed. Please try again later.",
        published: "Article published.",
        publishFailed: "Publish failed. Please try again later.",
        restoreRevisionConfirm: "Restore the revision from {time}? Current edits will be overwritten.",
        restoredRevision: "Selected revision restored.",
        restoreRevisionFailed: "Failed to restore revision. Please try again later.",
        revisionReason: {
          manual_save: "Save",
          publish: "Publish",
          archive: "Archive",
          rollback: "Version restore",
        },
        previewNeedsSlug: "Save the article and generate a slug before previewing the public page.",
        aiRunning: "AI is processing the current body...",
        aiNeedsContent: "Write article body content before using AI actions.",
        aiSummaryDone: "Summary candidate generated: {summary}",
        aiTagsDone: "Added tags: {tags}",
        aiPolishDone: "Replaced the body with the polished result.",
        aiFormatDone: "Structured formatting generated and inserted into the editor.",
        aiFailed: "AI action failed. Please try again later.",
        aiTranslating: "AI is translating the English draft...",
        aiNeedsChinese: "Complete the Chinese body before generating the English draft.",
        aiTranslateDone: "English draft generated. Review it before saving or publishing.",
        aiTranslateFailed: "AI translation failed. Please try again later.",
        linkUrlPrompt: "Link URL",
        imageUrlPrompt: "Image URL",
        invalidImageUrl: "Enter an http/https image URL or an existing /api/cms/media address.",
        imageLinkInserted: "Image link inserted.",
        saveForImage: "Saving the article first so the image can be linked to it...",
        saveForExternalImage: "Saving the article first so the external image can be linked to it...",
        imageUploaded: "Image uploaded and inserted into the body.",
        imageUploadFailed: "Image upload failed. Please try again later.",
        imageUploadFallbackPrompt: "Image upload failed. Enter a URL manually instead",
        manualImageInserted: "Inserted the manual image URL instead.",
        imageConverting: "Transferring external image to the media library...",
        imageConverted: "External image transferred to the media library.",
        imageConvertFailed: "External image transfer failed. Please try again later.",
        autosaveFound: "New autosave found",
        autosaveFoundDetail: "Saved at {time}. Restore it, then save manually if it looks right.",
        restoreAutosave: "Restore autosave",
        preview: "Preview",
        save: "Save",
        saving: "Saving...",
        publish: "Publish",
        publishing: "Publishing...",
        titlePlaceholderZh: "Article title...",
        titlePlaceholderEn: "English title...",
        body: "Body",
        codeLanguage: "Code language",
        tableEdit: "Table editing",
        addRow: "Add row",
        addColumn: "Add column",
        deleteRow: "Delete row",
        deleteColumn: "Delete column",
        transferToMedia: "Transfer to media library",
        transferring: "Transferring...",
        articleIcon: "Article icon",
        tags: "Tags",
        summaryZh: "Article Summary",
        summaryEn: "English Summary",
        summaryPlaceholderZh: "Write a short summary for the article list...",
        summaryPlaceholderEn: "Write a short English summary...",
        summaryHelpZh: "AI summaries are written here and synced to the home page and article list after saving.",
        summaryHelpEn: "English summary is saved alongside the Chinese article.",
        slugTitle: "Public URL",
        slugAria: "Article public URL",
        slugPlaceholder: "article-name",
        slugHelp: "Leave it empty to generate a slug from the title.",
        outline: "Outline",
        revisions: "Versions",
        refresh: "Refresh",
        revisionNeedsSave: "Versions are recorded after the first save.",
        revisionsLoading: "Loading versions...",
        restore: "Restore",
        revisionsEmpty: "No versions yet.",
      }
    : {
        newTitle: "新建文章",
        editTitle: "编辑文章",
        newSubtitle: "先写下草稿，保存后再继续整理细节。",
        editSubtitle: "保持轻量，随时保存，再决定何时发布。",
        toolbar: {
          bold: "加粗",
          italic: "斜体",
          wavyUnderline: "波浪下划线",
          underline: "下划线",
          strike: "删除线",
          quote: "引用",
          inlineCode: "行内代码",
          code: "代码块",
          bullet: "无序列表",
          ordered: "有序列表",
          link: "链接",
          image: "图片",
          superscript: "上角标",
          subscript: "下角标",
          alignLeft: "左对齐",
          alignCenter: "居中对齐",
          alignRight: "右对齐",
          table: "添加表格",
        },
        colors: {
          defaultText: "默认文字",
          accent: "强调色",
          secondary: "次级文字",
          warm: "暖色",
          green: "绿色",
          rose: "玫瑰色",
          noBackground: "无背景",
          softAccent: "浅强调",
          softWarm: "浅暖色",
          softGreen: "浅绿色",
          softRose: "浅玫瑰",
        },
        autoPlainText: "自动/纯文本",
        writingPlaceholder: "开始写作...",
        loadArticleFailedWithMessage: "文章详情加载失败，当前保留本地草稿视图：{message}",
        loadArticleFailed: "文章详情加载失败，当前保留本地草稿视图。",
        restoreAutosaveConfirm: "从 {time} 的自动保存恢复？当前编辑内容会被覆盖。",
        restoredAutosave: "已从自动保存恢复，请确认后手动保存。",
        revisionsLoadFailed: "版本记录加载失败。",
        saved: "已保存当前文章。",
        saveFailed: "保存失败，请稍后重试。",
        published: "文章已发布。",
        publishFailed: "发布失败，请稍后重试。",
        restoreRevisionConfirm: "恢复到 {time} 的版本？当前编辑内容会被覆盖。",
        restoredRevision: "已恢复所选版本。",
        restoreRevisionFailed: "恢复版本失败，请稍后重试。",
        revisionReason: {
          manual_save: "保存",
          publish: "发布",
          archive: "归档",
          rollback: "版本恢复",
        },
        previewNeedsSlug: "保存文章并生成 slug 后可预览公开页。",
        aiRunning: "AI 正在处理当前正文...",
        aiNeedsContent: "请先写入正文内容，再使用 AI 操作。",
        aiSummaryDone: "已生成摘要候选：{summary}",
        aiTagsDone: "已加入标签：{tags}",
        aiPolishDone: "已用润色结果替换正文。",
        aiFormatDone: "已生成结构化排版，并写入编辑器。",
        aiFailed: "AI 操作失败，请稍后重试。",
        aiTranslating: "AI 正在翻译英文稿...",
        aiNeedsChinese: "请先完成中文正文，再生成英文稿。",
        aiTranslateDone: "已生成英文稿，请检查后再保存或发布。",
        aiTranslateFailed: "AI 翻译失败，请稍后重试。",
        linkUrlPrompt: "链接 URL",
        imageUrlPrompt: "图片 URL",
        invalidImageUrl: "请输入 http/https 图片地址，或现有的 /api/cms/media 地址。",
        imageLinkInserted: "已插入图片链接。",
        saveForImage: "正在先保存文章，以便图片关联到当前文章...",
        saveForExternalImage: "正在先保存文章，以便外链图片能关联到当前文章...",
        imageUploaded: "图片已上传并插入正文。",
        imageUploadFailed: "图片上传失败，请稍后重试。",
        imageUploadFallbackPrompt: "图片上传失败，可改为手动输入 URL",
        manualImageInserted: "已改为插入手动图片 URL。",
        imageConverting: "正在转存外链图片到媒体库...",
        imageConverted: "已将外链图片转存到媒体库。",
        imageConvertFailed: "外链图片转存失败，请稍后重试。",
        autosaveFound: "发现新的自动保存",
        autosaveFoundDetail: "保存于 {time}，可以恢复后再手动保存。",
        restoreAutosave: "从自动保存恢复",
        preview: "预览",
        save: "保存",
        saving: "保存中...",
        publish: "发布",
        publishing: "发布中...",
        titlePlaceholderZh: "文章标题...",
        titlePlaceholderEn: "English title...",
        body: "正文",
        codeLanguage: "代码语言",
        tableEdit: "表格编辑",
        addRow: "加行",
        addColumn: "加列",
        deleteRow: "删行",
        deleteColumn: "删列",
        transferToMedia: "转存到媒体库",
        transferring: "转存中...",
        articleIcon: "文章图标",
        tags: "标签",
        summaryZh: "文章简介",
        summaryEn: "English Summary",
        summaryPlaceholderZh: "写一段会出现在文章列表中的简介...",
        summaryPlaceholderEn: "Write a short English summary...",
        summaryHelpZh: "AI 生成摘要会直接填写到这里，保存后同步到首页和文章列表。",
        summaryHelpEn: "English summary is saved alongside the Chinese article.",
        slugTitle: "访问链接",
        slugAria: "文章访问链接",
        slugPlaceholder: "文章名",
        slugHelp: "留空时会按标题自动生成 slug。",
        outline: "目录",
        revisions: "版本",
        refresh: "刷新",
        revisionNeedsSave: "首次保存后会记录版本。",
        revisionsLoading: "正在读取版本...",
        restore: "恢复",
        revisionsEmpty: "暂无版本记录。",
      },
);

function formatUiText(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}

const pageTitle = computed(() => (isNewArticle.value ? editorText.value.newTitle : editorText.value.editTitle));
const pageSubtitle = computed(() =>
  isNewArticle.value ? editorText.value.newSubtitle : editorText.value.editSubtitle,
);
const currentLocalizedDraft = computed(() => localizedDrafts[editorLocale.value]);
const currentArticleId = computed(() => currentLocalizedDraft.value.articleId);
const currentSlug = computed({
  get: () => currentLocalizedDraft.value.slug,
  set: (value: string) => {
    currentLocalizedDraft.value.slug = value;
  },
});
const currentStatus = computed(() => currentLocalizedDraft.value.status);
const currentPublishInfo = computed(() => currentLocalizedDraft.value.publishInfo);
const currentRevisionsArticleId = computed(() => currentArticleId.value || localizedDrafts.zh.articleId);
const localizedSummaryLength = computed(() => currentLocalizedDraft.value.summary.length);

const toolbarActions = computed(() => [
  { key: "bold", icon: "ph:text-bolder", title: editorText.value.toolbar.bold },
  { key: "italic", icon: "ph:text-italic", title: editorText.value.toolbar.italic },
  { key: "wavyUnderline", icon: "ph:wave-sine", title: editorText.value.toolbar.wavyUnderline },
  { key: "underline", icon: "ph:text-underline", title: editorText.value.toolbar.underline },
  { key: "strike", icon: "ph:text-strikethrough", title: editorText.value.toolbar.strike },
  { key: "quote", icon: "ph:quotes", title: editorText.value.toolbar.quote },
  { key: "inlineCode", icon: "ph:brackets-curly", title: editorText.value.toolbar.inlineCode },
  { key: "code", icon: "ph:code", title: editorText.value.toolbar.code },
  { key: "bullet", icon: "ph:list-bullets", title: editorText.value.toolbar.bullet },
  { key: "ordered", icon: "ph:list-numbers", title: editorText.value.toolbar.ordered },
  { key: "link", icon: "ph:link", title: editorText.value.toolbar.link },
  { key: "image", icon: "ph:image", title: editorText.value.toolbar.image },
  { key: "superscript", icon: "ph:text-superscript", title: editorText.value.toolbar.superscript },
  { key: "subscript", icon: "ph:text-subscript", title: editorText.value.toolbar.subscript },
  { key: "alignLeft", icon: "ph:text-align-left", title: editorText.value.toolbar.alignLeft },
  { key: "alignCenter", icon: "ph:text-align-center", title: editorText.value.toolbar.alignCenter },
  { key: "alignRight", icon: "ph:text-align-right", title: editorText.value.toolbar.alignRight },
  { key: "table", icon: "ph:table", title: editorText.value.toolbar.table },
]);

const toolbarColors = computed<ToolbarColor[]>(() => [
  { key: "default", label: editorText.value.colors.defaultText, value: "" },
  { key: "accent", label: editorText.value.colors.accent, value: "var(--accent)" },
  { key: "secondary", label: editorText.value.colors.secondary, value: "var(--text-secondary)" },
  { key: "warm", label: editorText.value.colors.warm, value: "oklch(0.68 0.17 45)" },
  { key: "green", label: editorText.value.colors.green, value: "oklch(0.65 0.16 150)" },
  { key: "rose", label: editorText.value.colors.rose, value: "oklch(0.68 0.17 20)" },
]);

const toolbarBackgroundColors = computed<ToolbarColor[]>(() => [
  { key: "default", label: editorText.value.colors.noBackground, value: "" },
  { key: "soft-accent", label: editorText.value.colors.softAccent, value: "var(--article-mark-accent)" },
  { key: "warm", label: editorText.value.colors.softWarm, value: "var(--article-mark-warm)" },
  { key: "green", label: editorText.value.colors.softGreen, value: "var(--article-mark-green)" },
  { key: "rose", label: editorText.value.colors.softRose, value: "var(--article-mark-rose)" },
]);

const codeLanguageOptions = computed<ToolbarOption[]>(() => [
  { label: editorText.value.autoPlainText, value: "" },
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "JSON", value: "json" },
  { label: "HTML / XML", value: "xml" },
  { label: "CSS", value: "css" },
  { label: "Bash", value: "bash" },
  { label: "Shell session", value: "shell" },
  { label: "Markdown", value: "markdown" },
  { label: "Plain text", value: "plaintext" },
]);

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
      placeholder: () => editorText.value.writingPlaceholder,
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

  return toolbarActions.value
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
  const target = hoveredImage.value;

  if (!target) {
    return {};
  }

  return {
    top: `${target.top}px`,
    left: `${target.left}px`,
    width: `${target.width}px`,
    maxWidth: `${target.width}px`,
  };
});

const hoveredImageCanConvert = computed(() => Boolean(hoveredImage.value?.canConvert));

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

function createSharedDraft(): CmsEditorSharedDraft {
  return {
    sourceArticleId: "",
    translationGroupId: "",
    iconName: cmsEditorInitialDraft.iconName,
    tags: [],
  };
}

function createLocalizedContentDraft(): CmsLocalizedEditorDraft {
  return {
    articleId: "",
    slug: "",
    status: "draft",
    title: "",
    summary: "",
    content: "",
    contentJson: createEmptyDoc(),
    createdAtRaw: "",
    updatedAtRaw: "",
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

function createLocalizedDraftFromArticle(article?: CmsArticleDetail | null): CmsLocalizedEditorDraft {
  if (!article) {
    return createLocalizedContentDraft();
  }

  return {
    articleId: article.id,
    slug: article.slug,
    status: article.status,
    title: article.title,
    summary: article.summary,
    content: article.contentText,
    contentJson: article.contentJson,
    createdAtRaw: article.createdAt,
    updatedAtRaw: article.updatedAt,
    publishInfo: createPublishInfo({
      createdAt: formatShanghaiDateTime(article.createdAt),
      updatedAt: formatShanghaiDateTime(article.updatedAt),
      autosaveState: "saved",
      lastSavedAt: formatShanghaiTime(article.updatedAt),
    }),
  };
}

function applyWorkspace(
  sourceArticle: CmsArticleDetail | null,
  englishArticle: CmsArticleDetail | null,
  initialLocale: CmsArticleLanguage,
): void {
  pauseAutosaveBriefly();
  const sharedArticle = sourceArticle ?? englishArticle;

  draft.sourceArticleId = sourceArticle?.id ?? englishArticle?.translatedFromArticleId ?? "";
  draft.translationGroupId =
    sourceArticle?.translationGroupId ?? englishArticle?.translationGroupId ?? draft.sourceArticleId;
  draft.iconName = sharedArticle?.iconName ?? cmsEditorInitialDraft.iconName;
  draft.tags = sharedArticle ? [...sharedArticle.tags] : [];
  localizedDrafts.zh = createLocalizedDraftFromArticle(sourceArticle);
  localizedDrafts.en = createLocalizedDraftFromArticle(englishArticle);
  editorLocale.value = initialLocale;
  setEditorContent(localizedDrafts[initialLocale].contentJson);
}

function resetWorkspace(): void {
  applyWorkspace(null, null, "zh");
  latestAutosave.value = null;
  revisions.value = [];
}

function markSavingState(state: CmsPublishInfo["autosaveState"], locale = editorLocale.value): void {
  localizedDrafts[locale].publishInfo = createPublishInfo({
    ...localizedDrafts[locale].publishInfo,
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

  const target = localizedDrafts[editorLocale.value];
  const contentJson = currentEditor.getJSON() as Record<string, unknown>;
  const content = currentEditor.getText();
  target.contentJson = contentJson;
  target.content = content;
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
  if (
    autosavePaused ||
    loading.value ||
    saving.value ||
    publishing.value ||
    imageOperationPending.value ||
    !currentArticleId.value
  ) {
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
  if (
    autosavePaused ||
    loading.value ||
    saving.value ||
    publishing.value ||
    imageOperationPending.value ||
    !currentArticleId.value
  ) {
    return;
  }

  syncDraftFromEditor();
  markSavingState("saving");

  try {
    const response = await autosaveCmsArticle(currentArticleId.value, getSavePayload(editorLocale.value));
    if (response.autosave) {
      currentLocalizedDraft.value.publishInfo = createPublishInfo({
        ...currentLocalizedDraft.value.publishInfo,
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
  currentLocalizedDraft.value.status = status;
}

function hasEnglishContent(): boolean {
  const english = localizedDrafts.en;
  return Boolean(english.title.trim() || english.summary.trim() || english.content.trim());
}

function getSavePayload(locale: CmsArticleLanguage) {
  syncDraftFromEditor();
  const target = localizedDrafts[locale];

  return {
    title: target.title || undefined,
    slug: target.slug || undefined,
    summary: target.summary || undefined,
    iconName: draft.iconName || undefined,
    tags: draft.tags,
    status: target.status,
    contentText: target.content || undefined,
    contentJson: target.contentJson,
    language: locale,
    translationGroupId: locale === "zh" ? draft.translationGroupId || target.articleId || undefined : draft.translationGroupId || undefined,
    translatedFromArticleId: locale === "en" ? draft.sourceArticleId || undefined : null,
  };
}

function getEnglishSavePayload(sourceArticle: CmsArticleDetail) {
  const english = localizedDrafts.en;
  const englishSlug = english.slug || `${sourceArticle.slug}-en`;

  return {
    title: english.title || undefined,
    slug: englishSlug,
    summary: english.summary || undefined,
    iconName: draft.iconName || undefined,
    tags: [...draft.tags],
    status: english.status,
    contentText: english.content || undefined,
    contentJson: english.contentJson,
    language: "en" as CmsArticleLanguage,
    translationGroupId: sourceArticle.translationGroupId || sourceArticle.id,
    translatedFromArticleId: sourceArticle.id,
  };
}

async function persistDraft(): Promise<CmsArticleDetail> {
  if (autosaveTimer !== null) {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }

  let sourceArticle: CmsArticleDetail;

  if (localizedDrafts.zh.articleId) {
    const response = await updateCmsArticle(localizedDrafts.zh.articleId, getSavePayload("zh"));
    sourceArticle = response.article;
  } else {
    const response = await createCmsArticle({
      title: localizedDrafts.zh.title || undefined,
      slug: localizedDrafts.zh.slug || undefined,
      summary: localizedDrafts.zh.summary || undefined,
      contentText: localizedDrafts.zh.content || undefined,
      iconName: draft.iconName || undefined,
      tags: draft.tags,
      status: localizedDrafts.zh.status,
      contentJson: localizedDrafts.zh.contentJson,
      language: "zh" as CmsArticleLanguage,
      translationGroupId: draft.translationGroupId || undefined,
    });

    sourceArticle = response.article;
    await router.replace(`/cms/articles/${sourceArticle.id}`);
  }

  draft.sourceArticleId = sourceArticle.id;
  draft.translationGroupId = sourceArticle.translationGroupId || sourceArticle.id;

  if (hasEnglishContent()) {
    if (localizedDrafts.en.articleId) {
      const response = await updateCmsArticle(localizedDrafts.en.articleId, getEnglishSavePayload(sourceArticle));
      localizedDrafts.en = createLocalizedDraftFromArticle(response.article);
    } else {
      const response = await createCmsArticle(getEnglishSavePayload(sourceArticle));
      localizedDrafts.en = createLocalizedDraftFromArticle(response.article);
    }
  }

  const refreshed = await getCmsArticle(sourceArticle.id);
  return refreshed.article;
}

async function loadArticle(id: string): Promise<void> {
  loading.value = true;
  loadError.value = "";
  saveMessage.value = "";
  saveError.value = "";
  latestAutosave.value = null;

  if (id === "new") {
    resetWorkspace();
    loading.value = false;
    return;
  }

  try {
    const response = await getCmsArticle(id);
    const openedArticle = response.article;
    const sourceArticle =
      openedArticle.language === "zh"
        ? openedArticle
        : openedArticle.translatedFromArticleId
          ? (await getCmsArticle(openedArticle.translatedFromArticleId)).article
          : null;
    const englishArticle = await resolveEnglishArticle(openedArticle, sourceArticle);
    const initialLocale = openedArticle.language === "en" ? "en" : "zh";
    const revisionsArticle = initialLocale === "en" ? englishArticle : sourceArticle;

    applyWorkspace(sourceArticle, englishArticle, initialLocale);
    await loadLatestAutosave(
      revisionsArticle?.id ?? openedArticle.id,
      revisionsArticle?.updatedAt ?? openedArticle.updatedAt,
    );
    await loadRevisions(revisionsArticle?.id ?? openedArticle.id);
  } catch (error) {
    resetWorkspace();
    loadError.value = isApiError(error)
      ? formatUiText(editorText.value.loadArticleFailedWithMessage, { message: error.message })
      : editorText.value.loadArticleFailed;
  } finally {
    loading.value = false;
  }
}

async function resolveEnglishArticle(
  openedArticle: CmsArticleDetail,
  sourceArticle: CmsArticleDetail | null,
): Promise<CmsArticleDetail | null> {
  if (openedArticle.language === "en") {
    return openedArticle;
  }

  const englishTranslation = (sourceArticle ?? openedArticle).translations.find(
    (translation) => translation.language === "en",
  );
  if (!englishTranslation) {
    return null;
  }

  try {
    return (await getCmsArticle(englishTranslation.id)).article;
  } catch {
    return null;
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

  const confirmed = window.confirm(
    formatUiText(editorText.value.restoreAutosaveConfirm, { time: formatShanghaiDateTime(autosave.createdAt) }),
  );
  if (!confirmed) {
    return;
  }

  const target = currentLocalizedDraft.value;
  target.title = autosave.title;
  target.content = autosave.contentText;
  target.contentJson = autosave.contentJson;
  draft.iconName = autosave.iconName;
  draft.tags = [...autosave.tags];
  target.publishInfo = createPublishInfo({
    ...target.publishInfo,
    autosaveState: "saved",
    lastSavedAt: formatShanghaiTime(autosave.createdAt),
  });
  setEditorContent(autosave.contentJson);
  latestAutosave.value = null;
  saveMessage.value = editorText.value.restoredAutosave;
  saveError.value = "";
}

function switchEditorLocale(nextLocale: CmsArticleLanguage): void {
  if (editorLocale.value === nextLocale) {
    return;
  }

  syncDraftFromEditor();
  editorLocale.value = nextLocale;
  setEditorContent(localizedDrafts[nextLocale].contentJson);
}

function toggleEditorLocale(): void {
  switchEditorLocale(editorLocale.value === "zh" ? "en" : "zh");
}

async function loadRevisions(id = currentRevisionsArticleId.value): Promise<void> {
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
    revisionsError.value = isApiError(error) ? error.message : editorText.value.revisionsLoadFailed;
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
    const englishArticle = await resolveEnglishArticle(article, article);
    applyWorkspace(article, englishArticle, editorLocale.value);
    await loadRevisions(article.id);
    saveMessage.value = editorText.value.saved;
  } catch (error) {
    markSavingState("error");
    saveError.value = isApiError(error) ? error.message : editorText.value.saveFailed;
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
    if (localizedDrafts.en.articleId && hasEnglishContent()) {
      const englishResponse = await publishCmsArticle(localizedDrafts.en.articleId);
      localizedDrafts.en = createLocalizedDraftFromArticle(englishResponse.article);
    }
    const englishArticle = await resolveEnglishArticle(response.article, response.article);
    applyWorkspace(response.article, englishArticle, editorLocale.value);
    await loadRevisions(response.article.id);
    saveMessage.value = editorText.value.published;
  } catch (error) {
    markSavingState("error");
    saveError.value = isApiError(error) ? error.message : editorText.value.publishFailed;
  } finally {
    publishing.value = false;
  }
}

async function handleRestoreRevision(revision: CmsArticleRevision): Promise<void> {
  if (!currentArticleId.value) {
    return;
  }

  const confirmed = window.confirm(
    formatUiText(editorText.value.restoreRevisionConfirm, { time: formatShanghaiDateTime(revision.createdAt) }),
  );
  if (!confirmed) {
    return;
  }

  saving.value = true;
  saveError.value = "";
  saveMessage.value = "";
  markSavingState("saving");

  try {
    const response = await restoreCmsArticleRevision(currentArticleId.value, revision.id);
    if (response.article.language === "en") {
      localizedDrafts.en = createLocalizedDraftFromArticle(response.article);
      setEditorContent(localizedDrafts.en.contentJson);
    } else {
      const englishArticle = await resolveEnglishArticle(response.article, response.article);
      applyWorkspace(response.article, englishArticle, editorLocale.value);
    }
    await loadRevisions(response.article.id);
    saveMessage.value = editorText.value.restoredRevision;
  } catch (error) {
    markSavingState("error");
    saveError.value = isApiError(error) ? error.message : editorText.value.restoreRevisionFailed;
  } finally {
    saving.value = false;
  }
}

function formatRevisionReason(reason: string): string {
  const labels: Record<string, string> = {
    manual_save: editorText.value.revisionReason.manual_save,
    publish: editorText.value.revisionReason.publish,
    archive: editorText.value.revisionReason.archive,
    rollback: editorText.value.revisionReason.rollback,
  };

  return labels[reason] ?? reason;
}

function formatRevisionTitle(revision: CmsArticleRevision): string {
  return `${formatRevisionReason(revision.reason)} ${formatShanghaiDateTime(revision.createdAt)}`;
}

function handlePreview(): void {
  syncDraftFromEditor();
  saveError.value = "";

  const slug = currentLocalizedDraft.value.slug?.trim() ?? "";

  if (!slug) {
    saveMessage.value = editorText.value.previewNeedsSlug;
    return;
  }

  const routeData = router.resolve(`/articles/${slug}`);
  window.open(routeData.href, "_blank", "noopener,noreferrer");
}

async function runAiAction(key: CmsAiActionKey): Promise<void> {
  if (key === "translate") {
    await handleTranslateToEnglish();
    return;
  }

  syncDraftFromEditor();
  activeAiKey.value = key;
  aiMessage.value = editorText.value.aiRunning;
  aiError.value = "";

  if (!currentLocalizedDraft.value.content.trim()) {
    aiMessage.value = "";
    aiError.value = editorText.value.aiNeedsContent;
    activeAiKey.value = null;
    return;
  }

  const input = {
    title: currentLocalizedDraft.value.title,
    contentText: currentLocalizedDraft.value.content,
    articleId: currentLocalizedDraft.value.articleId || undefined,
  };

  try {
    if (key === "summary") {
      const result = await generateSummary(input);
      currentLocalizedDraft.value.summary = result.summary;
      aiMessage.value = formatUiText(editorText.value.aiSummaryDone, { summary: result.summary });
      return;
    }

    if (key === "tags") {
      const result = await generateTags(input);
      result.tags.forEach(addTag);
      aiMessage.value = formatUiText(editorText.value.aiTagsDone, {
        tags: result.tags.join(locale.value === "en" ? ", " : "、"),
      });
      return;
    }

    if (key === "polish") {
      const result = await polishText(input);
      setEditorContent(contentTextToDoc(result.text));
      aiMessage.value = editorText.value.aiPolishDone;
      return;
    }

    const result = await formatContent(input);
    setEditorContent(result.contentJson);
    aiMessage.value = editorText.value.aiFormatDone;
  } catch (error) {
    aiError.value = isApiError(error) ? error.message : editorText.value.aiFailed;
  } finally {
    activeAiKey.value = null;
  }
}

async function handleTranslateToEnglish(): Promise<void> {
  syncDraftFromEditor();
  activeAiKey.value = "translate";
  aiMessage.value = editorText.value.aiTranslating;
  aiError.value = "";

  if (!localizedDrafts.zh.content.trim()) {
    aiMessage.value = "";
    aiError.value = editorText.value.aiNeedsChinese;
    activeAiKey.value = null;
    return;
  }

  try {
    const result = await translateContent({
      articleId: localizedDrafts.zh.articleId || undefined,
      sourceLanguage: "zh",
      targetLanguage: "en",
      title: localizedDrafts.zh.title,
      summary: localizedDrafts.zh.summary,
      contentText: localizedDrafts.zh.content,
      contentJson: localizedDrafts.zh.contentJson as { type: "doc"; content: unknown[] },
    });

    localizedDrafts.en = {
      ...localizedDrafts.en,
      title: result.title,
      summary: result.summary,
      content: result.contentText,
      contentJson: result.contentJson,
    };

    if (editorLocale.value === "en") {
      setEditorContent(result.contentJson);
    }

    aiMessage.value = editorText.value.aiTranslateDone;
  } catch (error) {
    aiError.value = isApiError(error) ? error.message : editorText.value.aiTranslateFailed;
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
  const url = window.prompt(editorText.value.linkUrlPrompt, previousUrl ?? "");

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

  const url = window.prompt(editorText.value.imageUrlPrompt, "");

  if (url === null) {
    return;
  }

  const normalizedUrl = normalizeInsertableImageUrl(url);

  if (!normalizedUrl) {
    saveMessage.value = "";
    saveError.value = editorText.value.invalidImageUrl;
    return;
  }

  currentEditor.chain().focus().setImage({ src: normalizedUrl }).run();
  syncDraftFromEditor(currentEditor);
  scheduleAutosave();
  saveError.value = "";
  saveMessage.value = editorText.value.imageLinkInserted;
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
    if (!currentArticleId.value) {
      await ensureDraftExistsForImageOperation(editorText.value.saveForImage);
    }

    const uploaded = await uploadCmsImage(file, {
      articleId: currentArticleId.value || undefined,
    });

    currentEditor.chain().focus().setImage({
      src: uploaded.url,
      alt: file.name,
    }).run();
    syncDraftFromEditor(currentEditor);
    scheduleAutosave();
    saveMessage.value = editorText.value.imageUploaded;
  } catch (error) {
    const message = isApiError(error) ? error.message : editorText.value.imageUploadFailed;
    const fallbackSrc = window.prompt(editorText.value.imageUploadFallbackPrompt, "");

    if (fallbackSrc?.trim()) {
      currentEditor.chain().focus().setImage({ src: fallbackSrc.trim(), alt: file.name }).run();
      syncDraftFromEditor(currentEditor);
      scheduleAutosave();
      saveMessage.value = editorText.value.manualImageInserted;
      saveError.value = "";
    } else {
      saveError.value = message;
    }
  } finally {
    imageUploading.value = false;
  }
}

async function convertExternalImage(target: ImageNodeContext | null = hoveredImage.value): Promise<void> {
  const currentEditor = editor.value;

  if (!currentEditor || !target || imageOperationPending.value) {
    return;
  }

  if (!isExternalImageUrl(target.src)) {
    return;
  }

  imageConverting.value = true;
  saveMessage.value = "";
  saveError.value = "";

  try {
    if (!currentArticleId.value) {
      await ensureDraftExistsForImageOperation(editorText.value.saveForExternalImage);
    }

    saveMessage.value = editorText.value.imageConverting;
    const uploaded = await uploadCmsImageFromUrl(target.src, {
      articleId: currentArticleId.value || undefined,
    });

    replaceImageAtPosition(target.pos, {
      src: uploaded.url,
      alt: target.alt,
    });
    hoveredImage.value = null;
    syncDraftFromEditor(currentEditor);
    scheduleAutosave();
    saveError.value = "";
    saveMessage.value = editorText.value.imageConverted;
  } catch (error) {
    saveMessage.value = "";
    saveError.value = isApiError(error) ? error.message : editorText.value.imageConvertFailed;
  } finally {
    imageConverting.value = false;
  }
}

async function ensureDraftExistsForImageOperation(message: string): Promise<void> {
  saveMessage.value = message;
  const article = await persistDraft();
  const englishArticle = await resolveEnglishArticle(article, article);
  applyWorkspace(article, englishArticle, editorLocale.value);
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
    hoveredImage.value = null;
    return;
  }

  const src = imageElement.getAttribute("src")?.trim() ?? imageElement.currentSrc.trim();

  if (!src) {
    hoveredImage.value = null;
    return;
  }

  const rect = imageElement.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  const inset = 10;
  const leftBoundary = Math.max(rect.left - wrapRect.left + inset, inset);
  const rightBoundary = Math.min(rect.right - wrapRect.left - inset, wrapRect.width - inset);
  const availableWidth = Math.max(rightBoundary - leftBoundary, 0);

  if (availableWidth < 80) {
    hoveredImage.value = null;
    return;
  }

  const desiredWidth = availableWidth;
  const left = leftBoundary;
  const width = Math.max(rightBoundary - left, 80);
  const topBoundary = rect.top - wrapRect.top + inset;
  const bottomBoundary = rect.bottom - wrapRect.top - 36 - inset;
  const top = Math.max(Math.min(topBoundary, bottomBoundary), inset);

  hoveredImage.value = {
    src,
    alt: imageElement.getAttribute("alt")?.trim() ?? "",
    pos: currentEditor.view.posAtDOM(imageElement, 0),
    top,
    left,
    width,
    canConvert: isExternalImageUrl(src),
  };
}

function clearHoveredExternalImage(): void {
  hoveredImage.value = null;
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
  () => [
    localizedDrafts.zh.title,
    localizedDrafts.zh.summary,
    localizedDrafts.en.title,
    localizedDrafts.en.summary,
    draft.iconName,
    currentLocalizedDraft.value.status,
    currentLocalizedDraft.value.slug,
    draft.tags.join("\u001f"),
  ],
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
        <strong>{{ editorText.autosaveFound }}</strong>
        <p>
          {{
            formatUiText(editorText.autosaveFoundDetail, {
              time: formatShanghaiDateTime(latestAutosave.createdAt),
            })
          }}
        </p>
      </div>
      <button type="button" class="text-action" :disabled="saving || publishing" @click="handleRestoreAutosave">
        {{ editorText.restoreAutosave }}
      </button>
    </section>

    <div class="editor-layout" :class="{ loading }">
      <main>
        <input ref="imageUploadInput" class="hidden-file-input" type="file" accept="image/*" @change="handleImageInputChange" />
        <div class="editor-actions-sticky" :style="stickyHeaderStyle">
          <div class="header-actions">
            <button type="button" class="text-action editor-locale-action" @click="toggleEditorLocale">
              {{ editorLocale === "zh" ? "English" : "中文" }}
            </button>
            <button type="button" class="text-action" @click="handlePreview">{{ editorText.preview }}</button>
            <button type="button" class="text-action" :disabled="loading || saving || publishing" @click="handleSave">
              {{ saving ? editorText.saving : editorText.save }}
            </button>
            <button
              type="button"
              class="text-action publish-action"
              :disabled="loading || saving || publishing"
              @click="handlePublish"
            >
              {{ publishing ? editorText.publishing : editorText.publish }}
            </button>
          </div>
        </div>
        <input
          v-model="currentLocalizedDraft.title"
          type="text"
          class="title-input"
          :placeholder="editorLocale === 'zh' ? editorText.titlePlaceholderZh : editorText.titlePlaceholderEn"
        />
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
          <p class="hint">{{ editorText.body }}</p>
          <BubbleMenu
            v-if="editor"
            :editor="editor"
            plugin-key="code-block-language-menu"
            :should-show="() => showCodeBlockMenu"
            :options="{ placement: 'top-start', offset: 8 }"
          >
            <label class="context-menu context-menu-select" :title="editorText.codeLanguage">
              <span>{{ editorText.codeLanguage }}</span>
              <select
                :value="activeCodeLanguage"
                :aria-label="editorText.codeLanguage"
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
            <div class="context-menu table-context-menu" :aria-label="editorText.tableEdit">
              <button type="button" :title="editorText.addRow" @click="runTableAction('addRow')">{{ editorText.addRow }}</button>
              <button type="button" :title="editorText.addColumn" @click="runTableAction('addColumn')">{{ editorText.addColumn }}</button>
              <button type="button" :title="editorText.deleteRow" @click="runTableAction('deleteRow')">{{ editorText.deleteRow }}</button>
              <button type="button" :title="editorText.deleteColumn" @click="runTableAction('deleteColumn')">{{ editorText.deleteColumn }}</button>
            </div>
          </BubbleMenu>
          <div v-if="hoveredImage" class="image-convert-float" :style="hoverConvertButtonStyle">
            <span class="image-convert-chip image-convert-url" :title="hoveredImage.src">{{ hoveredImage.src }}</span>
            <button
              v-if="hoveredImageCanConvert"
              type="button"
              class="image-convert-chip image-convert-button"
              :disabled="imageOperationPending"
              @click="convertExternalImage(hoveredImage)"
            >
              {{ imageConverting ? editorText.transferring : editorText.transferToMedia }}
            </button>
          </div>
          <EditorContent v-if="editor" :editor="editor" class="editor-content" :class="{ disabled: loading }" />
          <p v-if="aiMessage" class="ai-note">{{ aiMessage }}</p>
          <p v-if="aiError" class="ai-error">{{ aiError }}</p>
        </section>
      </main>

      <aside class="sidebar">
        <section class="panel">
          <h3>{{ editorText.articleIcon }}</h3>
          <IconPicker v-model="draft.iconName" />
        </section>
        <section class="panel">
          <h3>{{ editorText.tags }}</h3>
          <TagEditor :tags="draft.tags" @add="addTag" @remove="removeTag" />
        </section>
        <section class="panel">
          <div class="panel-heading">
            <h3>{{ editorLocale === "zh" ? editorText.summaryZh : editorText.summaryEn }}</h3>
            <span>{{ localizedSummaryLength }}/240</span>
          </div>
          <textarea
            v-model="currentLocalizedDraft.summary"
            class="summary-input"
            maxlength="240"
            rows="5"
            :placeholder="editorLocale === 'zh' ? editorText.summaryPlaceholderZh : editorText.summaryPlaceholderEn"
          ></textarea>
          <p class="panel-help">
            {{ editorLocale === "zh" ? editorText.summaryHelpZh : editorText.summaryHelpEn }}
          </p>
        </section>
        <section class="panel">
          <h3>{{ editorText.slugTitle }}</h3>
          <p class="panel-help slug-prefix">https://blog.yamds.cafe/articles/</p>
          <label class="slug-input" :aria-label="editorText.slugAria">
            <input
              v-model="currentSlug"
              type="text"
              inputmode="url"
              autocomplete="off"
              spellcheck="false"
              :placeholder="editorText.slugPlaceholder"
            />
          </label>
          <p class="panel-help">{{ editorText.slugHelp }}</p>
        </section>
        <section class="panel">
          <PublishPanel
            :status="currentStatus"
            :created-at="currentPublishInfo.createdAt"
            :updated-at="currentPublishInfo.updatedAt"
            :autosave-state="currentPublishInfo.autosaveState"
            :last-saved-at="currentPublishInfo.lastSavedAt"
            @update:status="updateStatus"
          />
        </section>
        <section v-if="editorOutlineItems.length" class="panel editor-outline-panel">
          <h3>{{ editorText.outline }}</h3>
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
            <h3>{{ editorText.revisions }}</h3>
            <button type="button" class="panel-link" :disabled="!currentRevisionsArticleId || revisionsLoading" @click="loadRevisions()">
              {{ editorText.refresh }}
            </button>
          </div>
          <p v-if="!currentRevisionsArticleId" class="panel-help">{{ editorText.revisionNeedsSave }}</p>
          <p v-else-if="revisionsLoading" class="panel-help">{{ editorText.revisionsLoading }}</p>
          <p v-else-if="revisionsError" class="panel-help error">{{ revisionsError }}</p>
          <ul v-else-if="revisions.length" class="revision-list">
            <li v-for="revision in revisions.slice(0, 6)" :key="revision.id" class="revision-item">
              <div>
                <strong>{{ formatRevisionTitle(revision) }}</strong>
              </div>
              <button type="button" class="panel-link" :disabled="saving || publishing" @click="handleRestoreRevision(revision)">
                {{ editorText.restore }}
              </button>
            </li>
          </ul>
          <p v-else class="panel-help">{{ editorText.revisionsEmpty }}</p>
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

.editor-locale-action {
  min-width: 54px;
  text-align: center;
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
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  min-width: 0;
  pointer-events: auto;
}
.image-convert-chip {
  min-width: 0;
  height: 32px;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: color-mix(in oklab, var(--bg-elevated) 94%, transparent);
  box-shadow: 0 10px 26px color-mix(in oklab, var(--text-primary) 10%, transparent);
  backdrop-filter: blur(12px);
}
.image-convert-url {
  display: inline-flex;
  align-items: center;
  flex: 1 1 auto;
  padding: 0 12px;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.image-convert-button {
  flex: 0 0 auto;
  padding: 0 12px;
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}
.image-convert-button:hover:enabled,
.image-convert-button:focus-visible {
  border-color: var(--border);
  background: var(--bg);
  color: var(--accent);
}
.slug-input {
  display: block;
  margin-top: var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
}
.slug-prefix {
  margin-top: 0;
}
.slug-input input {
  display: block;
  width: 100%;
  min-width: 0;
  border: 0;
  border-radius: inherit;
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
