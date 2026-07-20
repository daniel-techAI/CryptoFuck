import { describe, expect, it } from "vitest";
import { normalizeHandle, validateHandle } from "./profile";

describe("profile handles", () => {
  it("normalizes a public handle before saving", () => {
    expect(normalizeHandle("  Night Trader!  ")).toBe("nighttrader");
  });

  it("rejects handles that are too short", () => {
    expect(validateHandle("nt")).toContain("3–24");
  });

  it("accepts a privacy-safe handle without an email address", () => {
    expect(validateHandle("night_trader_7")).toBeUndefined();
  });
});
