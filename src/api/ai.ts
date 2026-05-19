import { requestJson } from "./http";

export type CmsAiActionKey = "summary" | "polish" | "tags" | "format";

export interface CmsAiInput extends Record<string, string | undefined> {
  title: string;
  contentText: string;
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
