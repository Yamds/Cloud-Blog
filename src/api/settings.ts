import { requestJson } from "@/api/http";
import type { SiteNavActionSettings, SiteSettings } from "@/types/cms";

interface SiteSettingsResponse {
  settings: SiteSettings;
}

export interface UpdateSiteSettingsInput extends Record<string, unknown> {
  siteName?: string;
  siteDescription?: string;
  commentsEnabled?: boolean;
  analyticsEnabled?: boolean;
  navAction?: SiteNavActionSettings;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const response = await requestJson<SiteSettingsResponse>("/api/site-settings");
  return response.settings;
}

export async function getCmsSiteSettings(): Promise<SiteSettings> {
  const response = await requestJson<SiteSettingsResponse>("/api/cms/settings");
  return response.settings;
}

export async function updateCmsSiteSettings(body: UpdateSiteSettingsInput): Promise<SiteSettings> {
  const response = await requestJson<SiteSettingsResponse>("/api/cms/settings", {
    method: "PATCH",
    body,
  });
  return response.settings;
}
