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
  navActions?: SiteNavActionSettings[];
}

function normalizeSettings(settings: SiteSettings): SiteSettings {
  const navActions =
    Array.isArray(settings.navActions) && settings.navActions.length > 0
      ? settings.navActions
      : settings.navAction
        ? [settings.navAction]
        : [];

  return {
    ...settings,
    navAction: navActions[0] ?? settings.navAction,
    navActions,
  };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const response = await requestJson<SiteSettingsResponse>("/api/site-settings");
  return normalizeSettings(response.settings);
}

export async function getCmsSiteSettings(): Promise<SiteSettings> {
  const response = await requestJson<SiteSettingsResponse>("/api/cms/settings");
  return normalizeSettings(response.settings);
}

export async function updateCmsSiteSettings(body: UpdateSiteSettingsInput): Promise<SiteSettings> {
  const response = await requestJson<SiteSettingsResponse>("/api/cms/settings", {
    method: "PATCH",
    body,
  });
  return normalizeSettings(response.settings);
}
