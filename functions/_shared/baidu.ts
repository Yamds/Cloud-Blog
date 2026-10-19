import type { Env } from "./env";

export interface BaiduPushResult {
  attempted: boolean;
  success: number;
  remain: number | null;
  notSameSite: string[];
  notValid: string[];
  skippedReason?: string;
  error?: string;
}

interface BaiduPushPayload {
  success?: unknown;
  remain?: unknown;
  not_same_site?: unknown;
  not_valid?: unknown;
}

const DEFAULT_ENDPOINT = "https://data.zz.baidu.com/urls";
const MAX_URLS_PER_PUSH = 100;
const REQUEST_TIMEOUT_MS = 5000;

function normalizeSite(value: string | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

function toSameSiteUrl(site: string, value: string): string | null {
  try {
    const url = new URL(value, site);

    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin !== site) {
      return null;
    }

    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * 把 URL 推送给百度搜索资源平台。失败只记录日志，不影响发布流程。
 * 调用方应通过 waitUntil 异步执行。
 */
export async function pushUrlsToBaidu(env: Env, urls: string[]): Promise<BaiduPushResult> {
  const token = env.BAIDU_PUSH_TOKEN?.trim();
  const site = normalizeSite(env.BAIDU_PUSH_SITE?.trim() || env.SITE_URL?.trim());

  if (!token || !site) {
    return {
      attempted: false,
      success: 0,
      remain: null,
      notSameSite: [],
      notValid: [],
      skippedReason: "BAIDU_PUSH_TOKEN or BAIDU_PUSH_SITE/SITE_URL is not configured.",
    };
  }

  const normalizedUrls = [
    ...new Set(urls.map((url) => toSameSiteUrl(site, url)).filter((url): url is string => Boolean(url))),
  ].slice(0, MAX_URLS_PER_PUSH);

  if (normalizedUrls.length === 0) {
    return {
      attempted: false,
      success: 0,
      remain: null,
      notSameSite: [],
      notValid: [],
      skippedReason: "No valid same-site URLs to push.",
    };
  }

  let endpoint: URL;

  try {
    endpoint = new URL(env.BAIDU_PUSH_ENDPOINT?.trim() || DEFAULT_ENDPOINT);
  } catch {
    return {
      attempted: false,
      success: 0,
      remain: null,
      notSameSite: [],
      notValid: [],
      skippedReason: "BAIDU_PUSH_ENDPOINT is not a valid URL.",
    };
  }

  endpoint.searchParams.set("site", site);
  endpoint.searchParams.set("token", token);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint.toString(), {
      method: "POST",
      headers: {
        "content-type": "text/plain",
      },
      body: normalizedUrls.join("\n"),
      signal: controller.signal,
    });
    const responseText = await response.text();

    if (!response.ok) {
      console.error("[Baidu push] request failed", {
        status: response.status,
        body: responseText.slice(0, 300),
      });

      return {
        attempted: true,
        success: 0,
        remain: null,
        notSameSite: [],
        notValid: [],
        error: `Baidu push failed with status ${response.status}.`,
      };
    }

    let payload: BaiduPushPayload;

    try {
      payload = JSON.parse(responseText) as BaiduPushPayload;
    } catch {
      console.error("[Baidu push] invalid JSON response", { body: responseText.slice(0, 300) });
      return {
        attempted: true,
        success: 0,
        remain: null,
        notSameSite: [],
        notValid: [],
        error: "Baidu push returned invalid JSON.",
      };
    }

    const result: BaiduPushResult = {
      attempted: true,
      success: toNumber(payload.success) ?? 0,
      remain: toNumber(payload.remain),
      notSameSite: toStringArray(payload.not_same_site),
      notValid: toStringArray(payload.not_valid),
    };

    console.log("[Baidu push] completed", {
      submitted: normalizedUrls.length,
      success: result.success,
      remain: result.remain,
      notSameSite: result.notSameSite.length,
      notValid: result.notValid.length,
    });

    return result;
  } catch (error) {
    console.error("[Baidu push] request error", error instanceof Error ? error.message : "unknown error");

    return {
      attempted: true,
      success: 0,
      remain: null,
      notSameSite: [],
      notValid: [],
      error: "Baidu push request failed.",
    };
  } finally {
    clearTimeout(timer);
  }
}
