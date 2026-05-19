import { queryAll } from "./d1";
import { ApiError } from "./http";

export interface SiteSettings {
  siteName: string;
  siteDescription: string;
  commentsEnabled: boolean;
  analyticsEnabled: boolean;
}

export interface SiteSettingsInput {
  siteName?: string;
  siteDescription?: string;
  commentsEnabled?: boolean;
  analyticsEnabled?: boolean;
}

interface SettingRow {
  key: string;
  value: string;
}

const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "Yamds's Blog",
  siteDescription: "thoughts, craft and code.",
  commentsEnabled: true,
  analyticsEnabled: true,
};

const SETTINGS_KEYS = new Set([
  "site_name",
  "site_description",
  "comments_enabled",
  "analytics_enabled",
]);

export async function getSiteSettings(db: D1Database): Promise<SiteSettings> {
  const rows = await queryAll<SettingRow>(
    db.prepare("SELECT key, value FROM site_settings WHERE key IN (?, ?, ?, ?)").bind(
      "site_name",
      "site_description",
      "comments_enabled",
      "analytics_enabled",
    ),
  );
  const map = new Map(rows.map((row) => [row.key, row.value]));

  return {
    siteName: map.get("site_name") || DEFAULT_SETTINGS.siteName,
    siteDescription: map.get("site_description") || DEFAULT_SETTINGS.siteDescription,
    commentsEnabled: readBoolean(map.get("comments_enabled"), DEFAULT_SETTINGS.commentsEnabled),
    analyticsEnabled: readBoolean(map.get("analytics_enabled"), DEFAULT_SETTINGS.analyticsEnabled),
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

  for (const [key] of entries) {
    if (!SETTINGS_KEYS.has(key)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid settings key.");
    }
  }

  return entries;
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

async function runStatement(statement: D1PreparedStatement): Promise<void> {
  try {
    await statement.run();
  } catch (error) {
    console.error("D1 settings statement failed", error);
    throw new ApiError(500, "DATABASE_ERROR", "Database write failed.");
  }
}
