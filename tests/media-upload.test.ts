import { describe, expect, it } from "vitest";

import { ApiError } from "../functions/_shared/http";
import { MAX_IMAGE_UPLOAD_BYTES, readMediaVariantParam, validateImageFile } from "../functions/_shared/uploads";

describe("readMediaVariantParam", () => {
  it("returns null when no variant is requested", () => {
    expect(readMediaVariantParam(new Request("https://blog.test/api/cms/media/abc"))).toBeNull();
  });

  it("maps variant and size parameters", () => {
    const cases: Array<[string, string]> = [
      ["?variant=webp_1080", "webp_1080"],
      ["?variant=webp_720", "webp_720"],
      ["?size=1080", "webp_1080"],
      ["?size=720", "webp_720"],
      ["?variant=%20WEBP_1080%20", "webp_1080"],
    ];

    for (const [query, expected] of cases) {
      expect(readMediaVariantParam(new Request(`https://blog.test/api/cms/media/abc${query}`))).toBe(expected);
    }
  });

  it("rejects unsupported variants", () => {
    expect(() => readMediaVariantParam(new Request("https://blog.test/api/cms/media/abc?variant=webp_480"))).toThrow(
      ApiError,
    );
  });
});

describe("validateImageFile", () => {
  const makeFile = (type: string, size: number): File =>
    ({ type, size, name: "test.bin" }) as unknown as File;

  it("accepts a normal image", () => {
    expect(() => validateImageFile(makeFile("image/png", 1024))).not.toThrow();
  });

  it("rejects non-image MIME types", () => {
    expect(() => validateImageFile(makeFile("application/pdf", 1024))).toThrow(ApiError);
    expect(() => validateImageFile(makeFile("text/html", 1024))).toThrow(ApiError);
  });

  it("rejects empty files", () => {
    expect(() => validateImageFile(makeFile("image/png", 0))).toThrow(ApiError);
  });

  it("rejects files above the upload limit", () => {
    expect(() => validateImageFile(makeFile("image/png", MAX_IMAGE_UPLOAD_BYTES + 1))).toThrow(ApiError);
    expect(() => validateImageFile(makeFile("image/png", MAX_IMAGE_UPLOAD_BYTES))).not.toThrow();
  });
});
