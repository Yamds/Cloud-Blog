import { describe, expect, it } from "vitest";

import {
  buildImageNodeStyle,
  findNearestImageSize,
  normalizeImageAlign,
  normalizeImageSize,
  readImageAlignFromElement,
  readImageSizeFromElement,
} from "../src/components/cms/editor/image";

describe("editor image helpers", () => {
  it("snaps image sizes to the supported steps", () => {
    expect(normalizeImageSize(20)).toBe(20);
    expect(normalizeImageSize("60%")).toBe(60);
    expect(normalizeImageSize("55")).toBe(60);
    expect(normalizeImageSize(0)).toBe(20);
    expect(normalizeImageSize(999)).toBe(100);
  });

  it("falls back to full width for invalid values", () => {
    expect(normalizeImageSize(null)).toBe(100);
    expect(normalizeImageSize(undefined)).toBe(100);
    expect(normalizeImageSize("auto")).toBe(100);
  });

  it("finds the nearest supported step", () => {
    expect(findNearestImageSize(10)).toBe(20);
    expect(findNearestImageSize(30)).toBe(20);
    expect(findNearestImageSize(31)).toBe(40);
    expect(findNearestImageSize(72)).toBe(80);
  });

  it("normalizes alignment values", () => {
    expect(normalizeImageAlign("left")).toBe("left");
    expect(normalizeImageAlign("right")).toBe("right");
    expect(normalizeImageAlign("auto")).toBe("right");
    expect(normalizeImageAlign("diagonal")).toBe("center");
    expect(normalizeImageAlign(null)).toBe("center");
  });

  it("builds the expected inline styles", () => {
    expect(buildImageNodeStyle(60, "left")).toBe(
      "width: 60%; margin-left: 0; margin-right: auto;",
    );
    expect(buildImageNodeStyle(80, "right")).toBe(
      "width: 80%; margin-left: auto; margin-right: 0;",
    );
    expect(buildImageNodeStyle(100, "center")).toBe(
      "width: 100%; margin-left: auto; margin-right: auto;",
    );
  });

  it("reads size and alignment from an image element", () => {
    const element = {
      getAttribute: (name: string) => {
        if (name === "data-size") return "40";
        if (name === "data-align") return "left";
        return null;
      },
      style: { width: "" },
    } as unknown as HTMLImageElement;

    expect(readImageSizeFromElement(element)).toBe(40);
    expect(readImageAlignFromElement(element)).toBe("left");
  });
});
