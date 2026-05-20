export type CmsArticleStatus = "draft" | "published" | "archived";
export type CmsArticleLanguage = "zh" | "en";
export type CmsStorageObjectType = "image" | "attachment";
export type CmsStorageObjectStatus = "ready" | "processing" | "orphaned" | "error";
export type CmsStorageRelationFilter = "all" | "linked" | "unlinked";
export type CmsStorageSortKey = "updatedAt" | "sizeBytes" | "key";
export type CmsStorageViewMode = "table" | "grid";

export interface CmsStatItem {
  key: string;
  label: string;
  icon: string;
  value: string;
  change: string;
  positive?: boolean;
}

export interface CmsArticleRow {
  id: string;
  iconName: string;
  title: string;
  date: string;
  status: CmsArticleStatus;
}

export interface CmsArticleStats {
  total: number;
  published: number;
  draft: number;
  archived: number;
  tags: number;
}

export interface CmsAnalyticsDailyPoint {
  date: string;
  views: number;
}

export interface CmsAnalyticsPopularArticle {
  articleId: string;
  slug: string;
  title: string;
  iconName: string;
  views: number;
}

export interface CmsAnalyticsPathItem {
  path: string;
  views: number;
}

export interface CmsAnalyticsReferrerItem {
  referrerHost: string;
  views: number;
}

export interface CmsAnalyticsSummary {
  totalViews: number;
  todayViews: number;
  last7DaysViews: number;
  dailyViews: CmsAnalyticsDailyPoint[];
  popularArticles: CmsAnalyticsPopularArticle[];
  topPaths: CmsAnalyticsPathItem[];
  topReferrers: CmsAnalyticsReferrerItem[];
}

export interface CmsArticleDetail {
  id: string;
  slug: string;
  title: string;
  summary: string;
  iconName: string;
  status: CmsArticleStatus;
  language: CmsArticleLanguage;
  translationGroupId: string;
  translatedFromArticleId: string | null;
  translations: CmsArticleTranslationLink[];
  tags: string[];
  contentText: string;
  contentJson: Record<string, unknown>;
  readingMinutes: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CmsArticleTranslationLink {
  id: string;
  slug: string;
  title: string;
  language: CmsArticleLanguage;
  status: CmsArticleStatus;
  translatedFromArticleId: string | null;
  updatedAt: string;
}

export interface CmsArticleRevision {
  id: string;
  articleId: string;
  title: string;
  summary: string;
  iconName: string;
  contentText: string;
  tags: string[];
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface CmsArticleAutosave {
  id: string;
  articleId: string;
  title: string;
  iconName: string;
  summary?: string;
  slug?: string;
  contentText: string;
  contentJson: Record<string, unknown>;
  tags: string[];
  createdAt: string;
}

export interface CmsPublishInfo {
  createdAt: string;
  updatedAt: string;
  autosaveState: "idle" | "saving" | "saved" | "error";
  lastSavedAt: string;
}

export interface CmsEditorDraft {
  id: string;
  slug?: string;
  summary?: string;
  title: string;
  iconName: string;
  tags: string[];
  status: CmsArticleStatus;
  content: string;
  contentJson: Record<string, unknown>;
  publishInfo: CmsPublishInfo;
}

export interface CmsLocalizedContentDraft {
  title: string;
  summary: string;
  content: string;
  contentJson: Record<string, unknown>;
}

export interface CmsAiAction {
  key: "summary" | "polish" | "tags" | "format" | "translate";
  label: string;
  description: string;
}

export interface CmsStorageArticleLink {
  articleId: string;
  articleTitle: string;
  articleStatus: CmsArticleStatus;
}

export interface CmsMediaUsageReference {
  articleId: string;
  articleTitle: string;
  articleStatus: CmsArticleStatus;
  matchedBy: Array<"url" | "objectKey">;
}

export interface CmsStorageObject {
  id: string;
  key: string;
  filename?: string;
  type: CmsStorageObjectType;
  mime: string;
  sizeBytes: number;
  updatedAt: string;
  status: CmsStorageObjectStatus;
  previewUrl?: string;
  relatedArticle?: CmsStorageArticleLink | null;
}

export interface CmsDeleteMediaConflictDetails {
  media: {
    id: string;
    objectKey: string;
    url: string;
  };
  references: CmsMediaUsageReference[];
}

export interface CmsDeleteMediaResponse {
  deleted: boolean;
  forced?: boolean;
  references?: CmsMediaUsageReference[];
  media: {
    id: string;
    objectKey: string;
    mimeType: string;
  };
}

export interface CmsStorageSummary {
  totalObjects: number;
  imageCount: number;
  attachmentCount: number;
  totalBytes: number;
  linkedCount: number;
  processingCount: number;
  orphanedCount: number;
  updatedRecentlyCount: number;
}

export interface CmsStorageFilters {
  query: string;
  type: CmsStorageObjectType | "all";
  status: CmsStorageObjectStatus | "all";
  relation: CmsStorageRelationFilter;
  sortBy: CmsStorageSortKey;
  viewMode: CmsStorageViewMode;
}

export interface CmsStorageArticleOption {
  id: string;
  title: string;
  status: CmsArticleStatus;
}

export interface CmsStorageUploadCandidate {
  id: string;
  file: File;
  name: string;
  type: CmsStorageObjectType;
  mime: string;
  sizeBytes: number;
  previewUrl?: string;
  relatedArticleId: string | null;
}

export interface CmsImageUploadOptions {
  articleId?: string | null;
}

export interface CmsImageUploadResult {
  id: string;
  objectKey: string;
  url: string;
}

export interface CmsComment {
  id: string;
  articleId: string;
  articleSlug: string;
  articleTitle: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  content: string;
  status: "visible" | "hidden" | "deleted";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  repliesCount: number;
}

export type SiteNavActionVariant = "icon" | "text";
export type SiteNavActionTargetType = "external" | "article";

export interface SiteNavActionSettings {
  enabled: boolean;
  variant: SiteNavActionVariant;
  label: string;
  iconName: string;
  tooltip: string;
  targetType: SiteNavActionTargetType;
  href: string;
  articlePath: string;
}

export interface SiteSettings {
  siteName: string;
  siteDescription: string;
  commentsEnabled: boolean;
  analyticsEnabled: boolean;
  navAction: SiteNavActionSettings;
  navActions: SiteNavActionSettings[];
}
