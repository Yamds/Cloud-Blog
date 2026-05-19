import { requestJson } from "@/api/http";
import type {
  CmsArticleAutosave,
  CmsArticleDetail,
  CmsArticleRevision,
  CmsArticleStats,
  CmsArticleStatus,
} from "@/types/cms";

export interface CmsArticlesResponse {
  articles: CmsArticleDetail[];
  stats: CmsArticleStats;
}

export interface CreateCmsArticleInput extends Record<string, unknown> {
  title?: string;
  summary?: string;
  contentText?: string;
  contentJson?: Record<string, unknown>;
  iconName?: string;
  tags?: string[];
  status?: CmsArticleStatus;
}

export interface UpdateCmsArticleInput extends Record<string, unknown> {
  title?: string;
  slug?: string;
  summary?: string;
  iconName?: string;
  tags?: string[];
  status?: CmsArticleStatus;
  contentText?: string;
  contentJson?: Record<string, unknown>;
}

interface CmsArticleResponse {
  article: CmsArticleDetail;
}

interface CmsArticleAutosaveResponse {
  autosave: CmsArticleAutosave | null;
}

interface CmsArticleRevisionsResponse {
  revisions: CmsArticleRevision[];
}

export function getCmsArticles(): Promise<CmsArticlesResponse> {
  return requestJson<CmsArticlesResponse>("/api/cms/articles");
}

export function createCmsArticle(body: CreateCmsArticleInput): Promise<CmsArticleResponse> {
  return requestJson<CmsArticleResponse>("/api/cms/articles", {
    method: "POST",
    body,
  });
}

export function getCmsArticle(id: string): Promise<CmsArticleResponse> {
  return requestJson<CmsArticleResponse>(`/api/cms/articles/${id}`);
}

export function updateCmsArticle(id: string, body: UpdateCmsArticleInput): Promise<CmsArticleResponse> {
  return requestJson<CmsArticleResponse>(`/api/cms/articles/${id}`, {
    method: "PATCH",
    body,
  });
}

export function publishCmsArticle(id: string): Promise<CmsArticleResponse> {
  return requestJson<CmsArticleResponse>(`/api/cms/articles/${id}/publish`, {
    method: "POST",
  });
}

export function archiveCmsArticle(id: string): Promise<CmsArticleResponse> {
  return requestJson<CmsArticleResponse>(`/api/cms/articles/${id}/archive`, {
    method: "POST",
  });
}

export function autosaveCmsArticle(id: string, body: UpdateCmsArticleInput): Promise<CmsArticleAutosaveResponse> {
  return requestJson<CmsArticleAutosaveResponse>(`/api/cms/articles/${id}/autosave`, {
    method: "POST",
    body,
  });
}

export function getLatestCmsArticleAutosave(id: string): Promise<CmsArticleAutosaveResponse> {
  return requestJson<CmsArticleAutosaveResponse>(`/api/cms/articles/${id}/autosave`);
}

export function getCmsArticleRevisions(id: string): Promise<CmsArticleRevisionsResponse> {
  return requestJson<CmsArticleRevisionsResponse>(`/api/cms/articles/${id}/revisions`);
}

export function restoreCmsArticleRevision(id: string, revisionId: string): Promise<CmsArticleResponse> {
  return requestJson<CmsArticleResponse>(`/api/cms/articles/${id}/revisions/${revisionId}/restore`, {
    method: "POST",
  });
}
