import { describe, expect, it } from "vitest";

import { readCmsArticleInput } from "../functions/_shared/cms-articles";
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

describe("readCmsArticleInput", () => {
  it("rejects non-object payloads", () => {
    expectApiError(() => readCmsArticleInput(null));
    expectApiError(() => readCmsArticleInput("article"));
    expectApiError(() => readCmsArticleInput(["article"]));
  });

  it("returns only the fields that were provided", () => {
    expect(readCmsArticleInput({ title: "Hello" })).toEqual({ title: "Hello" });
  });

  it("caps overlong text fields", () => {
    const input = readCmsArticleInput({ title: "a".repeat(200), summary: "b".repeat(600) });

    expect(input.title).toHaveLength(160);
    expect(input.summary).toHaveLength(500);
  });

  it("normalizes language and rejects unknown values", () => {
    expect(readCmsArticleInput({ language: " EN " }).language).toBe("en");
    expectApiError(() => readCmsArticleInput({ language: "fr" }));
  });

  it("rejects unknown status values", () => {
    expect(readCmsArticleInput({ status: "archived" }).status).toBe("archived");
    expectApiError(() => readCmsArticleInput({ status: "deleted" }));
  });

  it("filters, trims and caps tags", () => {
    const input = readCmsArticleInput({
      tags: ["  alpha  ", 42, "", "beta", ...Array.from({ length: 20 }, (_, index) => `tag-${index}`)],
    });

    expect(input.tags).toEqual(["alpha", "beta", ...Array.from({ length: 10 }, (_, index) => `tag-${index}`)]);
  });

  it("rejects invalid contentJson payloads", () => {
    expectApiError(() => readCmsArticleInput({ contentJson: [] }));
    expectApiError(() => readCmsArticleInput({ contentJson: "doc" }));
    expect(readCmsArticleInput({ contentJson: { type: "doc", content: [] } }).contentJson).toEqual({
      type: "doc",
      content: [],
    });
  });

  it("normalizes nullable translation identifiers", () => {
    expect(readCmsArticleInput({ translatedFromArticleId: "   " }).translatedFromArticleId).toBeNull();
    expect(readCmsArticleInput({ translatedFromArticleId: " source-id " }).translatedFromArticleId).toBe("source-id");
    expect(readCmsArticleInput({ translationGroupId: "group-id" }).translationGroupId).toBe("group-id");
  });
});
