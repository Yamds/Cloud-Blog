import { afterEach, describe, expect, it, vi } from "vitest";

import { pushUrlsToBaidu } from "../functions/_shared/baidu";
import type { Env } from "../functions/_shared/env";

const baseEnv = {
  BAIDU_PUSH_TOKEN: "test-token",
  BAIDU_PUSH_SITE: "https://blog.example.com",
  BAIDU_PUSH_ENDPOINT: "https://push.example.com/urls",
} as Env;

function mockFetch(body: unknown, status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pushUrlsToBaidu", () => {
  it("skips when token or site is missing", async () => {
    const fetchMock = mockFetch({ success: 0, remain: 0 });

    const result = await pushUrlsToBaidu({} as Env, ["/articles/a"]);

    expect(result.attempted).toBe(false);
    expect(result.skippedReason).toContain("not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pushes same-site URLs and parses the response", async () => {
    const fetchMock = mockFetch({
      success: 2,
      remain: 99998,
      not_same_site: [],
      not_valid: [],
    });

    const result = await pushUrlsToBaidu(baseEnv, [
      "/articles/a",
      "https://blog.example.com/articles/b",
      "https://other.example.com/articles/c",
      "/articles/a#section",
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const endpoint = new URL(requestUrl);

    expect(endpoint.origin).toBe("https://push.example.com");
    expect(endpoint.pathname).toBe("/urls");
    expect(endpoint.searchParams.get("site")).toBe("https://blog.example.com");
    expect(endpoint.searchParams.get("token")).toBe("test-token");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "text/plain" });
    expect(init.body).toBe(
      "https://blog.example.com/articles/a\nhttps://blog.example.com/articles/b",
    );

    expect(result).toMatchObject({
      attempted: true,
      success: 2,
      remain: 99998,
      notSameSite: [],
      notValid: [],
    });
  });

  it("uses SITE_URL and the default Baidu endpoint when overrides are absent", async () => {
    const fetchMock = mockFetch({ success: 1, remain: 10 });

    await pushUrlsToBaidu(
      {
        BAIDU_PUSH_TOKEN: "test-token",
        SITE_URL: "https://blog.example.com/",
      } as Env,
      ["/articles/a"],
    );

    const [requestUrl] = fetchMock.mock.calls[0] as [string];
    expect(requestUrl.startsWith("https://data.zz.baidu.com/urls?")).toBe(true);
  });

  it("reports non-2xx responses without throwing", async () => {
    mockFetch("forbidden", 403);

    const result = await pushUrlsToBaidu(baseEnv, ["/articles/a"]);

    expect(result.attempted).toBe(true);
    expect(result.success).toBe(0);
    expect(result.error).toContain("403");
  });

  it("reports invalid JSON without throwing", async () => {
    mockFetch("<html>bad gateway</html>", 200);

    const result = await pushUrlsToBaidu(baseEnv, ["/articles/a"]);

    expect(result.attempted).toBe(true);
    expect(result.error).toContain("invalid JSON");
  });

  it("swallows network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await pushUrlsToBaidu(baseEnv, ["/articles/a"]);

    expect(result.attempted).toBe(true);
    expect(result.error).toContain("request failed");
  });

  it("skips when there are no valid same-site URLs", async () => {
    const fetchMock = mockFetch({ success: 0, remain: 0 });

    const result = await pushUrlsToBaidu(baseEnv, ["https://other.example.com/x"]);

    expect(result.attempted).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
