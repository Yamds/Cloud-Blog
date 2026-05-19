import { queryAll, queryFirst } from "./d1";
import { ApiError } from "./http";
import { getSiteSettings } from "./settings";

export interface AnalyticsPageViewInput {
  path: string;
  slug?: string;
  articleId?: string;
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

interface CountRow {
  count: number | string | null;
}

interface PageViewDateRow {
  created_at: string;
}

interface ArticleLookupRow {
  id: string;
}

interface PopularArticleRow {
  article_id: string;
  slug: string;
  title: string;
  icon_name: string | null;
  views: number | string | null;
}

interface PathRow {
  path: string;
  views: number | string | null;
}

interface ReferrerRow {
  referrer_host: string | null;
  views: number | string | null;
}

const DEFAULT_ICON_NAME = "ph:article";
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }
}

export function readAnalyticsPageViewInput(value: unknown): AnalyticsPageViewInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be a JSON object.");
  }

  const body = value as Record<string, unknown>;
  const path = readRequiredString(body.path, "path", 500);
  const slug = readOptionalString(body.slug, 180);
  const articleId = readOptionalString(body.articleId, 120);

  return {
    path: normalizePath(path),
    slug: slug ? normalizeSlug(slug) : undefined,
    articleId: articleId || undefined,
  };
}

export async function recordPageView(
  db: D1Database,
  request: Request,
  input: AnalyticsPageViewInput,
): Promise<void> {
  const settings = await getSiteSettings(db);

  if (!settings.analyticsEnabled) {
    return;
  }

  const now = new Date().toISOString();
  const articleId = await resolveArticleId(db, input);

  await runStatement(
    db
      .prepare(
        `
          INSERT INTO page_views (
            id,
            article_id,
            path,
            referrer_host,
            country,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        crypto.randomUUID(),
        articleId,
        input.path,
        readReferrerHost(request),
        readCountry(request),
        now,
      ),
  );
}

export async function getCmsAnalyticsSummary(db: D1Database): Promise<CmsAnalyticsSummary> {
  const todayStart = getShanghaiDayStart(new Date());
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  const sevenDayStart = new Date(todayStart.getTime() - 6 * DAY_MS);

  const [totalRow, todayRow, recentRows, popularRows, topPathRows, topReferrerRows] = await Promise.all([
    queryFirst<CountRow>(db.prepare("SELECT COUNT(*) AS count FROM page_views")),
    queryFirst<CountRow>(
      db
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM page_views
            WHERE created_at >= ?
              AND created_at < ?
          `,
        )
        .bind(todayStart.toISOString(), tomorrowStart.toISOString()),
    ),
    queryAll<PageViewDateRow>(
      db
        .prepare(
          `
            SELECT created_at
            FROM page_views
            WHERE created_at >= ?
              AND created_at < ?
          `,
        )
        .bind(sevenDayStart.toISOString(), tomorrowStart.toISOString()),
    ),
    queryAll<PopularArticleRow>(
      db
        .prepare(
          `
            SELECT
              pv.article_id,
              a.slug,
              a.title,
              a.icon_name,
              COUNT(*) AS views
            FROM page_views AS pv
            INNER JOIN articles AS a
              ON a.id = pv.article_id
            WHERE pv.article_id IS NOT NULL
              AND pv.created_at >= ?
              AND pv.created_at < ?
            GROUP BY
              pv.article_id,
              a.slug,
              a.title,
              a.icon_name
            ORDER BY
              views DESC,
              MAX(pv.created_at) DESC
            LIMIT 5
          `,
        )
        .bind(sevenDayStart.toISOString(), tomorrowStart.toISOString()),
    ),
    queryAll<PathRow>(
      db
        .prepare(
          `
            SELECT path, COUNT(*) AS views
            FROM page_views
            WHERE created_at >= ?
              AND created_at < ?
            GROUP BY path
            ORDER BY views DESC, MAX(created_at) DESC
            LIMIT 8
          `,
        )
        .bind(sevenDayStart.toISOString(), tomorrowStart.toISOString()),
    ),
    queryAll<ReferrerRow>(
      db
        .prepare(
          `
            SELECT referrer_host, COUNT(*) AS views
            FROM page_views
            WHERE created_at >= ?
              AND created_at < ?
              AND referrer_host IS NOT NULL
              AND referrer_host != ''
            GROUP BY referrer_host
            ORDER BY views DESC, MAX(created_at) DESC
            LIMIT 8
          `,
        )
        .bind(sevenDayStart.toISOString(), tomorrowStart.toISOString()),
    ),
  ]);

  const dailyViews = buildDailyViews(recentRows, sevenDayStart);

  return {
    totalViews: normalizeNumber(totalRow?.count),
    todayViews: normalizeNumber(todayRow?.count),
    last7DaysViews: dailyViews.reduce((sum, item) => sum + item.views, 0),
    dailyViews,
    popularArticles: popularRows.map((row) => ({
      articleId: row.article_id,
      slug: row.slug,
      title: row.title,
      iconName: row.icon_name ?? DEFAULT_ICON_NAME,
      views: normalizeNumber(row.views),
    })),
    topPaths: topPathRows.map((row) => ({
      path: row.path,
      views: normalizeNumber(row.views),
    })),
    topReferrers: topReferrerRows.map((row) => ({
      referrerHost: row.referrer_host || "direct",
      views: normalizeNumber(row.views),
    })),
  };
}

function buildDailyViews(rows: PageViewDateRow[], sevenDayStart: Date): CmsAnalyticsDailyPoint[] {
  const counts = new Map<string, number>();

  for (let index = 0; index < 7; index += 1) {
    const day = new Date(sevenDayStart.getTime() + index * DAY_MS);
    counts.set(getShanghaiDateKey(day), 0);
  }

  for (const row of rows) {
    const date = new Date(row.created_at);

    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const key = getShanghaiDateKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()].map(([date, views]) => ({ date, views }));
}

async function resolveArticleId(db: D1Database, input: AnalyticsPageViewInput): Promise<string | null> {
  if (input.articleId) {
    const row = await queryFirst<ArticleLookupRow>(
      db.prepare("SELECT id FROM articles WHERE id = ? LIMIT 1").bind(input.articleId),
    );

    if (row?.id) {
      return row.id;
    }
  }

  if (input.slug) {
    const row = await queryFirst<ArticleLookupRow>(
      db
        .prepare(
          `
            SELECT id
            FROM articles
            WHERE slug = ?
              AND status = 'published'
            LIMIT 1
          `,
        )
        .bind(input.slug),
    );

    if (row?.id) {
      return row.id;
    }
  }

  return null;
}

function readReferrerHost(request: Request): string | null {
  const referer = request.headers.get("referer");

  if (!referer) {
    return null;
  }

  try {
    const url = new URL(referer);
    return url.hostname || null;
  } catch {
    return null;
  }
}

function readCountry(request: Request): string | null {
  const cf = (request as Request & { cf?: { country?: unknown } }).cf;
  const country = cf?.country;

  if (typeof country !== "string") {
    return null;
  }

  const normalized = country.trim().toUpperCase().slice(0, 8);
  return normalized || null;
}

function normalizePath(value: string): string {
  const trimmed = value.trim();
  let pathname = "/";

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      pathname = new URL(trimmed).pathname || "/";
    } else {
      pathname = new URL(trimmed.startsWith("/") ? trimmed : `/${trimmed}`, "https://cloud-blog.local")
        .pathname || "/";
    }
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid analytics path.");
  }

  if (!pathname.startsWith("/")) {
    pathname = `/${pathname}`;
  }

  return pathname.slice(0, 500) || "/";
}

function normalizeSlug(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, "").split("/").pop()?.trim() || value.trim();
}

function readRequiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} must be a string.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} is required.`);
  }

  return normalized.slice(0, maxLength);
}

function readOptionalString(value: unknown, maxLength: number): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "Expected string value.");
  }

  const normalized = value.trim().slice(0, maxLength);
  return normalized || undefined;
}

function getShanghaiDateKey(date: Date): string {
  return new Date(date.getTime() + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
}

function getShanghaiDayStart(date: Date): Date {
  const dayKey = getShanghaiDateKey(date);
  return new Date(Date.parse(`${dayKey}T00:00:00.000Z`) - SHANGHAI_OFFSET_MS);
}

function normalizeNumber(value: number | string | null | undefined): number {
  const numericValue = typeof value === "string" ? Number(value) : value;
  return typeof numericValue === "number" && Number.isFinite(numericValue) ? numericValue : 0;
}

async function runStatement(statement: D1PreparedStatement): Promise<void> {
  try {
    await statement.run();
  } catch (error) {
    console.error("D1 statement failed", error);
    throw new ApiError(500, "DATABASE_ERROR", "Database write failed.");
  }
}
