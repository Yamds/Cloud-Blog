import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatContent, readAiTextInput, readAiTranslateInput } from "../functions/_shared/ai";
import type { Env } from "../functions/_shared/env";
import { ApiError } from "../functions/_shared/http";

const env = {
  AI_API_KEY: "test-key",
  AI_BASE_URL: "https://ai.test",
  AI_MODEL_FORMAT: "test-model",
} as Env;

function mockProviderContent(content: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

function expectApiError(run: () => unknown, code: string): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(code);
    return;
  }

  throw new Error(`Expected ApiError with code ${code}.`);
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AI input validation", () => {
  it("requires text content and supports the content alias", () => {
    expectApiError(() => readAiTextInput({ title: "x" }), "VALIDATION_ERROR");
    expect(readAiTextInput({ content: "  hello  " }).contentText).toBe("hello");
  });

  it("requires a title and some body for translation", () => {
    expectApiError(() => readAiTranslateInput({ contentText: "hello" }), "VALIDATION_ERROR");
    expectApiError(() => readAiTranslateInput({ title: "Title" }), "VALIDATION_ERROR");
    expect(readAiTranslateInput({ title: "Title", contentJson: { type: "doc", content: [] } }).title).toBe("Title");
  });
});

describe("formatContent", () => {
  it("sanitizes unsafe provider output while keeping allowed image attributes", async () => {
    mockProviderContent(
      JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "hello",
                marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
              },
            ],
          },
          {
            type: "image",
            attrs: {
              src: "/api/cms/media/abc",
              alt: "diagram",
              size: 60,
              textAlign: "right",
              style: "background:url(javascript:alert(1))",
              onerror: "alert(1)",
            },
          },
          { type: "image", attrs: { src: "javascript:alert(1)" } },
          { type: "script", content: [{ type: "text", text: "alert(1)" }] },
        ],
      }),
    );

    const result = await formatContent(env, { title: "", contentText: "hello" });
    const serialized = JSON.stringify(result.contentJson);

    expect(result.model).toBe("test-model");
    expect(serialized).not.toContain("javascript:");
    expect(serialized).not.toContain("onerror");
    expect(serialized).not.toContain('"style"');
    expect(serialized).not.toContain('"script"');

    const image = result.contentJson.content.find((node) => node.type === "image");
    expect(image?.attrs).toMatchObject({
      src: "/api/cms/media/abc",
      alt: "diagram",
      size: 60,
      textAlign: "right",
    });
  });

  it("falls back to local formatting when the provider fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await formatContent(env, {
      title: "",
      contentText: "first paragraph\n\nsecond paragraph",
    });

    expect(result.model).toBe("test-model+local-fallback");
    expect(result.contentJson.type).toBe("doc");
    expect(JSON.stringify(result.contentJson)).toContain("first paragraph");
  });

  it("falls back when the provider returns invalid Tiptap JSON", async () => {
    mockProviderContent("not a json document");

    const result = await formatContent(env, { title: "", contentText: "fallback body" });

    expect(result.model).toBe("test-model+local-fallback");
    expect(JSON.stringify(result.contentJson)).toContain("fallback body");
  });
});
