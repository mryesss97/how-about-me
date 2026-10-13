import { describe, expect, it } from "vitest";
import { overrideFixture, uuid } from "./fixtures.test-utils";
import { activeOverrides, asLabel, asLabels, formatValue } from "./overrides";

describe("activeOverrides (BR-025)", () => {
  it("ignores revoked overrides", () => {
    const o = overrideFixture({ revokedAt: "2026-10-13T06:00:00.000Z" });
    expect(activeOverrides([o]).sentiment).toBeUndefined();
  });
  it("keeps the newest active override per field", () => {
    const old = overrideFixture({ id: uuid(1), createdAt: "2026-10-13T01:00:00.000Z" });
    const neu = overrideFixture({ id: uuid(2), createdAt: "2026-10-13T02:00:00.000Z" });
    expect(activeOverrides([old, neu]).sentiment?.id).toBe(uuid(2));
    expect(activeOverrides(undefined)).toEqual({});
  });
});

describe("asLabel / asLabels / formatValue", () => {
  it("narrows unknown values safely", () => {
    expect(asLabel("negative")).toBe("negative");
    expect(asLabel(3)).toBeNull();
    expect(asLabel(null)).toBeNull();
    expect(asLabels(["praise", 1, "complaint"])).toEqual(["praise", "complaint"]);
    expect(asLabels("neutral")).toEqual(["neutral"]);
    expect(asLabels({})).toEqual([]);
    expect(formatValue(["price_value", "praise"])).toBe("Price value, Praise");
    expect(formatValue(null)).toBe("—");
  });
});
