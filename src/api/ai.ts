import { requestJson } from "./http";

export type CmsAiActionKey = "summary" | "polish" | "tags" | "format" | "translate";

export interface CmsAiInput extends Record<string, string | undefined> {
  title: string;
  contentText: string;
  articleId?: string;
}

export interface CmsAiTranslateInput extends Record<string, unknown> {
  sourceLanguage?: "zh";
  targetLanguage?: "en";
  title: string;
  summary?: string;
  contentText?: string;
  contentJson?: {
    type: "doc";
    content: unknown[];
  };
  articleId?: string;
}

export interface CmsAiSummaryResponse {
  summary: string;
  model: string;
}

export interface CmsAiPolishResponse {
  text: string;
  model: string;
}

export interface CmsAiTagsResponse {
  tags: string[];
  model: string;
}

export interface CmsAiFormatResponse {
  contentJson: {
    type: "doc";
    content: unknown[];
  };
  model: string;
}

export interface CmsAiTranslateResponse {
  title: string;
  summary: string;
  contentText: string;
  contentJson: {
    type: "doc";
    content: unknown[];
  };
  model: string;
}

export function generateSummary(input: CmsAiInput): Promise<CmsAiSummaryResponse> {
  return requestJson<CmsAiSummaryResponse>("/api/cms/ai/summary", {
    method: "POST",
    body: input,
  });
}

export function polishText(input: CmsAiInput): Promise<CmsAiPolishResponse> {
  return requestJson<CmsAiPolishResponse>("/api/cms/ai/polish", {
    method: "POST",
    body: input,
  });
}

export function generateTags(input: CmsAiInput): Promise<CmsAiTagsResponse> {
  return requestJson<CmsAiTagsResponse>("/api/cms/ai/tags", {
    method: "POST",
    body: input,
  });
}

export function formatContent(input: CmsAiInput): Promise<CmsAiFormatResponse> {
  return requestJson<CmsAiFormatResponse>("/api/cms/ai/format", {
    method: "POST",
    body: input,
  });
}

export function translateContent(input: CmsAiTranslateInput): Promise<CmsAiTranslateResponse> {
  return requestJson<CmsAiTranslateResponse>("/api/cms/ai/translate", {
    method: "POST",
    body: input,
  });
}
