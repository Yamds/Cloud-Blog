import type {
  CmsAiAction,
  CmsArticleRow,
  CmsEditorDraft,
  CmsStatItem,
  CmsStorageArticleOption,
  CmsStorageObject,
  CmsStorageSummary,
} from "@/types/cms";

export const cmsStats: CmsStatItem[] = [
  { key: "articles", label: "总文章数", icon: "ph:article", value: "42", change: "+3 本月", positive: true },
  { key: "views", label: "总浏览量", icon: "ph:eye", value: "8,234", change: "+12% 较上月", positive: true },
  { key: "drafts", label: "草稿", icon: "ph:file-dashed", value: "5", change: "待发布" },
  { key: "tags", label: "标签数", icon: "ph:tag", value: "18", change: "+2 本月" },
];

export const cmsRecentArticles: CmsArticleRow[] = [
  { id: "1", iconName: "ph:code", title: "深入理解 React 并发渲染机制", date: "2026.05.15", status: "published" },
  { id: "2", iconName: "ph:pen-nib", title: "关于写作的一些思考", date: "2026.05.10", status: "published" },
  { id: "3", iconName: "ph:camera", title: "城市夜色：光影的诗", date: "2026.05.03", status: "published" },
  { id: "4", iconName: "ph:terminal-window", title: "构建高效的开发工作流", date: "2026.04.28", status: "draft" },
  { id: "5", iconName: "ph:book-open", title: "TypeScript 类型体操实战", date: "2026.04.20", status: "draft" },
];

export const cmsEditorInitialDraft: CmsEditorDraft = {
  id: "1",
  title: "深入理解 React 并发渲染机制",
  iconName: "ph:code",
  tags: ["React", "前端架构", "性能优化"],
  status: "published",
  content:
    "React 18 引入的并发特性从根本上改变了渲染的工作方式。在此之前，React 的渲染是同步且不可中断的——一旦开始渲染，就必须完成整个组件树的更新。\n\n并发渲染的核心思想是：让渲染工作可以被中断和恢复。这样 React 就能在渲染过程中响应更高优先级的任务，比如用户输入。",
  contentJson: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "React 18 引入的并发特性从根本上改变了渲染的工作方式。在此之前，React 的渲染是同步且不可中断的——一旦开始渲染，就必须完成整个组件树的更新。",
          },
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "并发渲染的核心思想是：让渲染工作可以被中断和恢复。这样 React 就能在渲染过程中响应更高优先级的任务，比如用户输入。",
          },
        ],
      },
    ],
  },
  publishInfo: {
    createdAt: "2026.05.15 14:30",
    updatedAt: "2026.05.15 16:45",
    autosaveState: "saved",
    lastSavedAt: "16:45:20",
  },
};

export const cmsAiActions: CmsAiAction[] = [
  { key: "summary", label: "生成摘要", description: "生成 80-160 字摘要候选。" },
  { key: "polish", label: "润色段落", description: "保持语义，优化表达克制度。" },
  { key: "tags", label: "生成标签", description: "根据正文推荐主题标签。" },
  { key: "format", label: "AI 排版", description: "将纯文本重排为结构化内容。" },
];

function createStoragePreview(title: string, subtitle: string, palette: { bg: string; panel: string; accent: string }): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">
      <rect width="480" height="320" rx="28" fill="${palette.bg}" />
      <rect x="28" y="28" width="424" height="184" rx="20" fill="${palette.panel}" />
      <circle cx="108" cy="110" r="34" fill="${palette.accent}" opacity="0.9" />
      <path d="M76 176L156 116L214 162L284 96L404 176V212H76Z" fill="${palette.accent}" opacity="0.38" />
      <rect x="76" y="232" width="182" height="18" rx="9" fill="#F8FAFC" opacity="0.92" />
      <rect x="76" y="264" width="250" height="12" rx="6" fill="#CBD5E1" opacity="0.84" />
      <text x="76" y="205" font-size="34" fill="#F8FAFC" font-family="Georgia, serif">${title}</text>
      <text x="76" y="290" font-size="18" fill="#E2E8F0" font-family="Arial, sans-serif">${subtitle}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function summarizeStorageObjects(objects: CmsStorageObject[]): CmsStorageSummary {
  const recentCutoff = Date.parse("2026-05-11T00:00:00+08:00");

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

export const cmsStorageObjects: CmsStorageObject[] = [
  {
    id: "storage-1",
    key: "articles/1/react-scheduler/cover-diagram.png",
    type: "image",
    mime: "image/png",
    sizeBytes: 684320,
    updatedAt: "2026-05-18T09:12:00+08:00",
    status: "ready",
    previewUrl: createStoragePreview("React Scheduler", "cover png", {
      bg: "#0F172A",
      panel: "#1E293B",
      accent: "#38BDF8",
    }),
    relatedArticle: {
      articleId: "1",
      articleTitle: "深入理解 React 并发渲染机制",
      articleStatus: "published",
    },
  },
  {
    id: "storage-2",
    key: "articles/1/react-scheduler/lanes-overview.webp",
    type: "image",
    mime: "image/webp",
    sizeBytes: 332108,
    updatedAt: "2026-05-17T22:05:00+08:00",
    status: "ready",
    previewUrl: createStoragePreview("Lane Priority", "overview webp", {
      bg: "#172554",
      panel: "#1D4ED8",
      accent: "#93C5FD",
    }),
    relatedArticle: {
      articleId: "1",
      articleTitle: "深入理解 React 并发渲染机制",
      articleStatus: "published",
    },
  },
  {
    id: "storage-3",
    key: "articles/2/writing-notes/reference-handwrite.jpg",
    type: "image",
    mime: "image/jpeg",
    sizeBytes: 1482004,
    updatedAt: "2026-05-16T18:28:00+08:00",
    status: "ready",
    previewUrl: createStoragePreview("Writing Notes", "reference jpg", {
      bg: "#3F2A1D",
      panel: "#6F4E37",
      accent: "#F3C98B",
    }),
    relatedArticle: {
      articleId: "2",
      articleTitle: "关于写作的一些思考",
      articleStatus: "published",
    },
  },
  {
    id: "storage-4",
    key: "drafts/4/workflow-board.png",
    type: "image",
    mime: "image/png",
    sizeBytes: 512944,
    updatedAt: "2026-05-15T11:40:00+08:00",
    status: "processing",
    previewUrl: createStoragePreview("Workflow Board", "draft png", {
      bg: "#111827",
      panel: "#374151",
      accent: "#34D399",
    }),
    relatedArticle: {
      articleId: "4",
      articleTitle: "构建高效的开发工作流",
      articleStatus: "draft",
    },
  },
  {
    id: "storage-5",
    key: "articles/3/night-city/long-exposure.jpg",
    type: "image",
    mime: "image/jpeg",
    sizeBytes: 2406784,
    updatedAt: "2026-05-13T20:06:00+08:00",
    status: "ready",
    previewUrl: createStoragePreview("Night Exposure", "city jpg", {
      bg: "#1E1B4B",
      panel: "#312E81",
      accent: "#C084FC",
    }),
    relatedArticle: {
      articleId: "3",
      articleTitle: "城市夜色：光影的诗",
      articleStatus: "published",
    },
  },
  {
    id: "storage-6",
    key: "articles/5/typescript-cheatsheet.pdf",
    type: "attachment",
    mime: "application/pdf",
    sizeBytes: 2104330,
    updatedAt: "2026-05-12T15:00:00+08:00",
    status: "ready",
    relatedArticle: {
      articleId: "5",
      articleTitle: "TypeScript 类型体操实战",
      articleStatus: "draft",
    },
  },
  {
    id: "storage-7",
    key: "articles/5/inference-notes.md",
    type: "attachment",
    mime: "text/markdown",
    sizeBytes: 28402,
    updatedAt: "2026-05-09T10:32:00+08:00",
    status: "ready",
    relatedArticle: {
      articleId: "5",
      articleTitle: "TypeScript 类型体操实战",
      articleStatus: "draft",
    },
  },
  {
    id: "storage-8",
    key: "drafts/inbox/interview-outline.docx",
    type: "attachment",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 88192,
    updatedAt: "2026-05-08T19:14:00+08:00",
    status: "orphaned",
    relatedArticle: null,
  },
  {
    id: "storage-9",
    key: "drafts/8/ai-layout-brief.txt",
    type: "attachment",
    mime: "text/plain",
    sizeBytes: 12640,
    updatedAt: "2026-05-17T07:55:00+08:00",
    status: "error",
    relatedArticle: null,
  },
  {
    id: "storage-10",
    key: "articles/2/writing-notes/quote-sheet.png",
    type: "image",
    mime: "image/png",
    sizeBytes: 243776,
    updatedAt: "2026-05-14T16:20:00+08:00",
    status: "ready",
    previewUrl: createStoragePreview("Quote Sheet", "inline png", {
      bg: "#0F172A",
      panel: "#334155",
      accent: "#F472B6",
    }),
    relatedArticle: {
      articleId: "2",
      articleTitle: "关于写作的一些思考",
      articleStatus: "published",
    },
  },
];

export const cmsStorageSummary: CmsStorageSummary = summarizeStorageObjects(cmsStorageObjects);

export const cmsStorageArticleOptions: CmsStorageArticleOption[] = cmsRecentArticles.map((article) => ({
  id: article.id,
  title: article.title,
  status: article.status,
}));
