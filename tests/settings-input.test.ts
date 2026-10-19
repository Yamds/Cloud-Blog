import { describe, expect, it } from "vitest";

import { ApiError } from "../functions/_shared/http";
import { readSiteSettingsInput } from "../functions/_shared/settings";

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

describe("readSiteSettingsInput", () => {
  it("rejects arrays and non-objects", () => {
    expectApiError(() => readSiteSettingsInput([]));
    expectApiError(() => readSiteSettingsInput("settings"));
  });

  it("returns only provided fields and caps text length", () => {
    expect(readSiteSettingsInput({ commentsEnabled: false })).toEqual({ commentsEnabled: false });

    const input = readSiteSettingsInput({ siteName: "n".repeat(100), siteDescription: "d".repeat(400) });
    expect(input.siteName).toHaveLength(80);
    expect(input.siteDescription).toHaveLength(300);
  });

  it("requires real booleans for feature switches", () => {
    expectApiError(() => readSiteSettingsInput({ commentsEnabled: "true" }));
    expectApiError(() => readSiteSettingsInput({ analyticsEnabled: 1 }));
  });

  it("fills nav action defaults", () => {
    const input = readSiteSettingsInput({
      navAction: {
        enabled: true,
        variant: "text",
        label: "About",
        targetType: "external",
        href: "https://example.com/about",
      },
    });

    expect(input.navAction).toEqual({
      enabled: true,
      variant: "text",
      label: "About",
      iconName: "",
      tooltip: "",
      targetType: "external",
      href: "https://example.com/about",
      articlePath: "",
    });
  });

  it("rejects incomplete or unsafe enabled nav actions", () => {
    expectApiError(() =>
      readSiteSettingsInput({ navAction: { enabled: true, variant: "icon", iconName: "ph:link" } }),
    );
    expectApiError(() =>
      readSiteSettingsInput({
        navAction: { enabled: true, variant: "text", label: "Bad", targetType: "external", href: "ftp://example.com" },
      }),
    );
    expectApiError(() =>
      readSiteSettingsInput({
        navAction: { enabled: true, variant: "text", label: "No target", targetType: "article" },
      }),
    );
  });

  it("rejects more than eight nav actions", () => {
    expectApiError(() =>
      readSiteSettingsInput({ navActions: Array.from({ length: 9 }, () => ({})) }),
    );

    expect(readSiteSettingsInput({ navActions: Array.from({ length: 8 }, () => ({})) }).navActions).toHaveLength(8);
  });
});
