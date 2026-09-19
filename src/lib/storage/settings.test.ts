import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, sanitizeSettings } from "./settings";

describe("sanitizeSettings", () => {
  it("accepts valid settings", () => {
    expect(sanitizeSettings({ scheme: "church", theme: "dark" })).toEqual({
      scheme: "church",
      theme: "dark",
    });
  });

  it("defaults each invalid field independently", () => {
    expect(sanitizeSettings({ scheme: "rot13", theme: "dark" })).toEqual({
      scheme: DEFAULT_SETTINGS.scheme,
      theme: "dark",
    });
    expect(sanitizeSettings({ scheme: "church", theme: "purple" })).toEqual({
      scheme: "church",
      theme: null,
    });
  });

  it.each([null, undefined, 3, "x", []])("returns defaults for %j", (input) => {
    expect(sanitizeSettings(input)).toEqual(DEFAULT_SETTINGS);
  });
});
