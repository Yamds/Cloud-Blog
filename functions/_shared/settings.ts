import { queryAll } from "./d1";
import { ApiError } from "./http";

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

export interface SiteSettingsInput {
  siteName?: string;
  siteDescription?: string;
  commentsEnabled?: boolean;
  analyticsEnabled?: boolean;
  navAction?: SiteNavActionSettings;
  navActions?: SiteNavActionSettings[];
}

interface SettingRow {
  key: string;
  value: string;
}

const MAX_NAV_ACTIONS = 8;
const DEFAULT_NAV_ACTION = createDefaultNavAction();
const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "Yamds's Blog",
  siteDescription: "thoughts, craft and code.",
  commentsEnabled: true,
  analyticsEnabled: true,
  navAction: DEFAULT_NAV_ACTION,
  navActions: [],
};

const SETTINGS_KEYS = new Set([
  "site_name",
  "site_description",
  "comments_enabled",
  "analytics_enabled",
  "nav_action",
  "nav_actions",
]);

export async function getSiteSettings(db: D1Database): Promise<SiteSettings> {
  const rows = await queryAll<SettingRow>(
    db.prepare("SELECT key, value FROM site_settings WHERE key IN (?, ?, ?, ?, ?, ?)").bind(
      "site_name",
      "site_description",
      "comments_enabled",
      "analytics_enabled",
      "nav_action",
      "nav_actions",
    ),
  );
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const navActions = readNavActions(map.get("nav_actions"), map.get("nav_action"));

  return {
    siteName: map.get("site_name") || DEFAULT_SETTINGS.siteName,
    siteDescription: map.get("site_description") || DEFAULT_SETTINGS.siteDescription,
    commentsEnabled: readBoolean(map.get("comments_enabled"), DEFAULT_SETTINGS.commentsEnabled),
    analyticsEnabled: readBoolean(map.get("analytics_enabled"), DEFAULT_SETTINGS.analyticsEnabled),
    navAction: navActions[0] ?? createDefaultNavAction(),
    navActions,
  };
}

export async function updateSiteSettings(
  db: D1Database,
  input: SiteSettingsInput,
): Promise<SiteSettings> {
  const entries = normalizeSettingsInput(input);
  const now = new Date().toISOString();

  for (const [key, value] of entries) {
    await runStatement(
      db
        .prepare(
          `
            INSERT INTO site_settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
              value = excluded.value,
              updated_at = excluded.updated_at
          `,
        )
        .bind(key, value, now),
    );
  }

  return getSiteSettings(db);
}

export function readSiteSettingsInput(value: unknown): SiteSettingsInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be a JSON object.");
  }

  const body = value as Record<string, unknown>;
  const input: SiteSettingsInput = {};

  if ("siteName" in body) input.siteName = readOptionalString(body.siteName, 80);
  if ("siteDescription" in body) input.siteDescription = readOptionalString(body.siteDescription, 300);
  if ("commentsEnabled" in body) input.commentsEnabled = readBooleanField(body.commentsEnabled, "commentsEnabled");
  if ("analyticsEnabled" in body) input.analyticsEnabled = readBooleanField(body.analyticsEnabled, "analyticsEnabled");
  if ("navAction" in body) input.navAction = readNavActionField(body.navAction);
  if ("navActions" in body) input.navActions = readNavActionsField(body.navActions);

  return input;
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}

function normalizeSettingsInput(input: SiteSettingsInput): Array<[string, string]> {
  const entries: Array<[string, string]> = [];

  if (input.siteName !== undefined) entries.push(["site_name", input.siteName.trim() || DEFAULT_SETTINGS.siteName]);
  if (input.siteDescription !== undefined) entries.push(["site_description", input.siteDescription.trim()]);
  if (input.commentsEnabled !== undefined) entries.push(["comments_enabled", String(input.commentsEnabled)]);
  if (input.analyticsEnabled !== undefined) entries.push(["analytics_enabled", String(input.analyticsEnabled)]);

  const navActions =
    input.navActions !== undefined
      ? normalizeNavActions(input.navActions)
      : input.navAction !== undefined
        ? normalizeNavActions([input.navAction])
        : undefined;

  if (navActions !== undefined) {
    entries.push(["nav_actions", JSON.stringify(navActions)]);
  }

  for (const [key] of entries) {
    if (!SETTINGS_KEYS.has(key)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid settings key.");
    }
  }

  return entries;
}

function createDefaultNavAction(): SiteNavActionSettings {
  return {
    enabled: false,
    variant: "icon",
    label: "",
    iconName: "",
    tooltip: "",
    targetType: "external",
    href: "",
    articlePath: "",
  };
}

function readNavActions(navActionsValue: string | undefined, legacyNavActionValue: string | undefined): SiteNavActionSettings[] {
  if (navActionsValue) {
    try {
      return normalizeNavActions(parseNavActions(JSON.parse(navActionsValue), false));
    } catch {
      return [];
    }
  }

  const legacyAction = readNavAction(legacyNavActionValue);
  return legacyAction.enabled ? [legacyAction] : [];
}

function readNavAction(value: string | undefined): SiteNavActionSettings {
  if (!value) {
    return createDefaultNavAction();
  }

  try {
    return parseNavAction(JSON.parse(value), false);
  } catch {
    return createDefaultNavAction();
  }
}

function readNavActionField(value: unknown): SiteNavActionSettings {
  return parseNavAction(value, true);
}

function readNavActionsField(value: unknown): SiteNavActionSettings[] {
  return normalizeNavActions(parseNavActions(value, true));
}

function parseNavActions(value: unknown, strict: boolean): SiteNavActionSettings[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    if (strict) {
      throw new ApiError(400, "VALIDATION_ERROR", "navActions must be an array.");
    }

    return [];
  }

  return value.map((item) => parseNavAction(item, strict));
}

function normalizeNavActions(navActions: SiteNavActionSettings[]): SiteNavActionSettings[] {
  if (navActions.length > MAX_NAV_ACTIONS) {
    throw new ApiError(400, "VALIDATION_ERROR", `navActions supports at most ${MAX_NAV_ACTIONS} items.`);
  }

  return navActions.map((action) => ({
    ...createDefaultNavAction(),
    ...action,
  }));
}

function parseNavAction(value: unknown, strict: boolean): SiteNavActionSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (strict) {
      throw new ApiError(400, "VALIDATION_ERROR", "navAction must be an object.");
    }

    return createDefaultNavAction();
  }

  const body = value as Record<string, unknown>;
  const defaults = createDefaultNavAction();
  const navAction: SiteNavActionSettings = {
    enabled: "enabled" in body ? readBooleanField(body.enabled, "navAction.enabled") : defaults.enabled,
    variant: readEnumField(body.variant, ["icon", "text"], "navAction.variant", defaults.variant, strict),
    label: "label" in body ? readOptionalString(body.label, 40).trim() : defaults.label,
    iconName: "iconName" in body ? readOptionalString(body.iconName, 80).trim() : defaults.iconName,
    tooltip: "tooltip" in body ? readOptionalString(body.tooltip, 120).trim() : defaults.tooltip,
    targetType: readEnumField(body.targetType, ["external", "article"], "navAction.targetType", defaults.targetType, strict),
    href: "href" in body ? readOptionalString(body.href, 300).trim() : defaults.href,
    articlePath: "articlePath" in body ? readOptionalString(body.articlePath, 300).trim() : defaults.articlePath,
  };

  if (navAction.href && !isExternalUrl(navAction.href)) {
    if (strict) {
      throw new ApiError(400, "VALIDATION_ERROR", "navAction.href must start with http:// or https://.");
    }

    navAction.href = "";
  }

  if (navAction.enabled) {
    if (navAction.variant === "icon") {
      if (!navAction.iconName) {
        throw new ApiError(400, "VALIDATION_ERROR", "navAction.iconName is required for icon buttons.");
      }
      if (!navAction.tooltip) {
        throw new ApiError(400, "VALIDATION_ERROR", "navAction.tooltip is required for icon buttons.");
      }
    }

    if (navAction.variant === "text" && !navAction.label) {
      throw new ApiError(400, "VALIDATION_ERROR", "navAction.label is required for text buttons.");
    }

    if (navAction.targetType === "external" && !navAction.href) {
      throw new ApiError(400, "VALIDATION_ERROR", "navAction.href is required for external links.");
    }

    if (navAction.targetType === "article" && !navAction.articlePath) {
      throw new ApiError(400, "VALIDATION_ERROR", "navAction.articlePath is required for article links.");
    }
  }

  return navAction;
}

function readOptionalString(value: unknown, maxLength: number): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "Expected string value.");
  }

  return value.slice(0, maxLength);
}

function readBooleanField(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} must be a boolean.`);
  }

  return value;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function readEnumField<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
  fallback: T,
  strict: boolean,
): T {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value !== "string" || !allowed.includes(value as T)) {
    if (strict) {
      throw new ApiError(400, "VALIDATION_ERROR", `${field} is invalid.`);
    }

    return fallback;
  }

  return value as T;
}

function isExternalUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

async function runStatement(statement: D1PreparedStatement): Promise<void> {
  try {
    await statement.run();
  } catch (error) {
    console.error("D1 settings statement failed", error);
    throw new ApiError(500, "DATABASE_ERROR", "Database write failed.");
  }
}
