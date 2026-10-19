import { describe, expect, it } from "vitest";

import { parseContentJson } from "../functions/_shared/articles";
import { ApiError } from "../functions/_shared/http";

const toJson = (value: unknown): string => JSON.stringify(value);

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

describe("parseContentJson", () => {
  it("returns an empty list for empty input", () => {
    expect(parseContentJson(null)).toEqual([]);
    expect(parseContentJson(undefined)).toEqual([]);
    expect(parseContentJson("")).toEqual([]);
  });

  it("rejects malformed JSON and unsupported payloads", () => {
    expectApiError(() => parseContentJson("{not-json"), "INVALID_CONTENT_JSON");
    expectApiError(() => parseContentJson(toJson({ type: "doc" })), "INVALID_CONTENT_JSON");
    expectApiError(() => parseContentJson(toJson("plain string")), "INVALID_CONTENT_JSON");
  });

  it("converts a Tiptap doc and keeps only whitelisted marks", () => {
    const blocks = parseContentJson(
      toJson({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2, textAlign: "center" },
            content: [{ type: "text", text: "标题" }],
          },
          {
            type: "paragraph",
            attrs: { textAlign: "right" },
            content: [
              {
                type: "text",
                text: "Hello",
                marks: [
                  { type: "bold" },
                  { type: "link", attrs: { href: "https://example.com" } },
                  { type: "textStyle", attrs: { color: "#2563eb" } },
                  { type: "link", attrs: { href: "javascript:alert(1)" } },
                ],
              },
            ],
          },
        ],
      }),
    );

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      type: "heading",
      level: 2,
      text: "标题",
      textAlign: "center",
    });

    const paragraph = blocks[1];
    expect(paragraph).toMatchObject({ type: "paragraph", text: "Hello", textAlign: "right" });
    expect(paragraph?.segments?.[0]?.marks).toEqual([
      { type: "bold" },
      { type: "link", href: "https://example.com/" },
      { type: "color", color: "#2563eb" },
    ]);
  });

  it("keeps allowed image size and alignment but drops unsafe sources", () => {
    const blocks = parseContentJson(
      toJson({
        type: "doc",
        content: [
          {
            type: "image",
            attrs: {
              src: "/api/cms/media/abc",
              alt: "diagram",
              size: "80",
              textAlign: "left",
              style: "background:url(javascript:alert(1))",
            },
          },
          {
            type: "image",
            attrs: { src: "https://cdn.example.com/photo.png", size: 50, textAlign: "diagonal" },
          },
          { type: "image", attrs: { src: "javascript:alert(1)" } },
          { type: "image", attrs: { src: "data:image/png;base64,AAAA" } },
          { type: "image", attrs: { src: "https://user:pass@example.com/a.png" } },
        ],
      }),
    );

    expect(blocks).toEqual([
      { type: "image", src: "/api/cms/media/abc", alt: "diagram", textAlign: "left", imageSize: 80 },
      { type: "image", src: "https://cdn.example.com/photo.png", alt: "", textAlign: undefined, imageSize: undefined },
    ]);
  });

  it("converts ordered lists and tables", () => {
    const blocks = parseContentJson(
      toJson({
        type: "doc",
        content: [
          {
            type: "orderedList",
            content: [
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [{ type: "text", text: "first" }] }],
              },
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [{ type: "text", text: "second" }] }],
              },
            ],
          },
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "H" }] }] },
                  { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "C" }] }] },
                ],
              },
            ],
          },
        ],
      }),
    );

    expect(blocks[0]).toMatchObject({ type: "list", ordered: true, items: ["first", "second"] });
    expect(blocks[1]?.type).toBe("table");
    expect(blocks[1]?.rows?.[0]?.cells).toEqual([
      { header: true, text: "H", segments: [{ text: "H", marks: undefined }] },
      { header: false, text: "C", segments: [{ text: "C", marks: undefined }] },
    ]);
  });

  it("rejects a stored block array that contains an invalid image size", () => {
    expectApiError(
      () => parseContentJson(toJson([{ type: "image", src: "https://example.com/a.png", imageSize: 55 }])),
      "INVALID_CONTENT_JSON",
    );
  });
});
