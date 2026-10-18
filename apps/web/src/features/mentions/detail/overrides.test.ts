import { describe, expect, it } from "vitest";
import { detailFixture, overrideFixture, uuid } from "./fixtures.test-utils";
import { activeOverrides, defaultOverrideField, asLabel, asLabels, formatValue } from "./overrides";

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
    // #277: Vietnamese labels per field; unknown values fall back to a humanised code.
    expect(formatValue(["price_value", "praise"], "intents")).toBe("Price value, Khen ngợi");
    expect(formatValue("negative", "sentiment")).toBe("Tiêu cực");
    expect(formatValue(null, "topics")).toBe("—");
  });
});

describe("defaultOverrideField (#338, FR-195)", () => {
  it("relevance for an uncertain mention, otherwise sentiment", () => {
    expect(
      defaultOverrideField(detailFixture({ analysis: { relevance: { label: "uncertain", confidence: 0.5 } } })),
    ).toBe("relevance");
    expect(
      defaultOverrideField(detailFixture({ analysis: { relevance: { label: "relevant", confidence: 0.9 } } })),
    ).toBe("sentiment");
    expect(defaultOverrideField(detailFixture({ analysis: { relevance: null } }))).toBe("sentiment");
  });
});
