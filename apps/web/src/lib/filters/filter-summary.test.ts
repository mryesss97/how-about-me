import { describe, expect, it } from "vitest";
import { activeFilterCount, isDefaultFilters, rangeLabel, secondaryFilterCount } from "./filter-summary";
import { DEFAULT_TZ } from "./parsers";
import { defaultFilters, type Filters } from "./schema";

const base = (patch: Partial<Filters> = {}): Filters => ({ ...defaultFilters(DEFAULT_TZ), ...patch });
// 19 Oct 2026 10:30 in Asia/Ho_Chi_Minh.
const NOW = new Date("2026-10-19T03:30:00.000Z");

describe("filter summary (#332, UX §2.1)", () => {
  it("counts secondary values, so sentiment=negative&topic=ticket → 2", () => {
    expect(secondaryFilterCount(base({ sentiment: ["negative"], topic: ["ticket"] }))).toBe(2);
    expect(secondaryFilterCount(base({ sentiment: ["negative", "positive"] }))).toBe(2);
  });

  it("tz ≠ default adds 1", () => {
    expect(secondaryFilterCount(base({ tz: "UTC" }))).toBe(1);
  });

  it("BR-016: default relevance is not counted, a non-default one is", () => {
    expect(activeFilterCount(base())).toBe(0);
    expect(activeFilterCount(base({ relevance: ["relevant", "uncertain"] }))).toBe(2);
  });

  it("isDefaultFilters: true for defaults, false for any changed field", () => {
    expect(isDefaultFilters(base())).toBe(true);
    // q/sort belong to the Mentions toolbar, not the filter bar.
    expect(isDefaultFilters(base({ q: "x", sort: "oldest" as Filters["sort"] }))).toBe(true);
    const changed: Partial<Filters>[] = [
      { preset: "24h" },
      { preset: "custom", from: new Date(0), to: NOW },
      { tz: "UTC" },
      { queryIds: ["q1"] },
      { relevance: ["irrelevant"] },
      { sentiment: ["negative"] },
      { safety: ["sensitive"] },
      { phrase: ["giá vé"] },
      { term: "giá vé" },
      { compare: true },
    ];
    for (const patch of changed) expect(isDefaultFilters(base(patch)), JSON.stringify(patch)).toBe(false);
  });

  it("rangeLabel: 7d shows days in the selected tz, no GMT suffix by default", () => {
    expect(rangeLabel(base(), NOW)).toBe("12/10 – 19/10");
  });

  it("rangeLabel: 1h shows hours", () => {
    expect(rangeLabel(base({ preset: "1h" }), NOW)).toBe("09:30 19/10 – 10:30 19/10");
  });

  it("rangeLabel: custom end is exclusive", () => {
    const f = base({
      preset: "custom",
      from: new Date("2026-09-30T17:00:00.000Z"),
      to: new Date("2026-10-07T17:00:00.000Z"),
    });
    expect(rangeLabel(f, NOW)).toBe("01/10 – 07/10");
  });

  it("rangeLabel: GMT suffix only when tz ≠ default", () => {
    expect(rangeLabel(base({ tz: "UTC" }), NOW)).toBe("12/10 – 19/10 · GMT+0");
  });
});
