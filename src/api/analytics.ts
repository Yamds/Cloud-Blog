import { requestJson } from "@/api/http";
import type { CmsAnalyticsSummary } from "@/types/cms";

export interface AnalyticsPageViewInput extends Record<string, unknown> {
  path: string;
  slug?: string;
  articleId?: string;
}

interface AnalyticsPageViewResponse {
  recorded: boolean;
}

interface CmsAnalyticsSummaryResponse {
  summary: CmsAnalyticsSummary;
}

export function recordPageView(body: AnalyticsPageViewInput): Promise<AnalyticsPageViewResponse> {
  return requestJson<AnalyticsPageViewResponse>("/api/analytics/pageview", {
    method: "POST",
    body,
  });
}

export async function getCmsAnalyticsSummary(): Promise<CmsAnalyticsSummary> {
  const response = await requestJson<CmsAnalyticsSummaryResponse>("/api/cms/analytics/summary");
  return response.summary;
}
