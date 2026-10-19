import { describe, expect, it } from "vitest";

import { readAnalyticsPageViewInput } from "../functions/_shared/analytics";
import { ApiError } from "../functions/_shared/http";

function expectApiError(run: () => unknown): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    return;
  }

  throw new Error("Expected ApiError with status 400.");
}

describe("readAnalyticsPageViewInput", () => {
  it("requires a non-empty path", () => {
    expectApiError(() => readAnalyticsPageViewInput({}));
    expectApiError(() => readAnalyticsPageViewInput({ path: "   " }));
    expectApiError(() => readAnalyticsPageViewInput({ path: 42 }));
    expectApiError(() => readAnalyticsPageViewInput(null));
  });

  it("normalizes relative paths and strips query/hash", () => {
    expect(readAnalyticsPageViewInput({ path: "articles/hello?utm=1#section" })).toEqual({
      path: "/articles/hello",
      slug: undefined,
      articleId: undefined,
    });
  });

  it("keeps only the pathname for absolute URLs", () => {
    expect(readAnalyticsPageViewInput({ path: "https://example.com/articles/x?from=feed" }).path).toBe(
      "/articles/x",
    );
  });

  it("normalizes slug and article id", () => {
    expect(readAnalyticsPageViewInput({ path: "/articles/x", slug: "/articles/my-post/", articleId: "  abc  " })).toEqual({
      path: "/articles/x",
      slug: "my-post",
      articleId: "abc",
    });
  });

  it("drops blank optional fields and ignores unknown keys", () => {
    expect(readAnalyticsPageViewInput({ path: "/", slug: "  ", articleId: "", referrer: "evil" })).toEqual({
      path: "/",
      slug: undefined,
      articleId: undefined,
    });
  });
});
