import { describe, expect, it } from "vitest";

import { aiMessages, editorMessages, messages } from "../src/i18n/messages";

function collectLeafPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") {
    return [prefix];
  }

  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => collectLeafPaths(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

function collectLeafValues(value: unknown): string[] {
  if (value === null || typeof value !== "object") {
    return [String(value)];
  }

  return Object.values(value as Record<string, unknown>).flatMap(collectLeafValues);
}

describe("i18n dictionaries", () => {
  it("keeps zh and en site message keys in sync", () => {
    expect(collectLeafPaths(messages.zh)).toEqual(collectLeafPaths(messages.en));
  });

  it("keeps editor messages in sync and non-empty", () => {
    expect(collectLeafPaths(editorMessages.zh)).toEqual(collectLeafPaths(editorMessages.en));
    expect(collectLeafValues(editorMessages.zh).every((value) => value.trim().length > 0)).toBe(true);
    expect(collectLeafValues(editorMessages.en).every((value) => value.trim().length > 0)).toBe(true);
  });

  it("keeps AI panel messages in sync and non-empty", () => {
    expect(collectLeafPaths(aiMessages.zh)).toEqual(collectLeafPaths(aiMessages.en));
    expect(collectLeafValues(aiMessages.zh).every((value) => value.trim().length > 0)).toBe(true);
    expect(collectLeafValues(aiMessages.en).every((value) => value.trim().length > 0)).toBe(true);
  });

  it("contains every AI action key used by the panel", () => {
    const actionKeys = ["summary", "polish", "tags", "format", "translate"];

    expect(Object.keys(aiMessages.zh.actions).sort()).toEqual(actionKeys.sort());
    expect(Object.keys(aiMessages.en.actions).sort()).toEqual(actionKeys.sort());
  });
});
