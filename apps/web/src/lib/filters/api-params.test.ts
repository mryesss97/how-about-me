import { describe, expect, it } from "vitest";
import { AnalyticsQuerySchema, MentionsListQuerySchema } from "@how-about-me/contracts";
import { appliedChips, phraseMentionsHref, removeFilterValue, toApiParams, toMentionsHref } from "./api-params";
import { filterParsers } from "./parsers";
import { defaultFilters, type Filters } from "./schema";

const now = new Date("2026-10-13T05:30:00.000Z");
const base = (patch: Partial<Filters> = {}): Filters => ({ ...defaultFilters("Asia/Ho_Chi_Minh"), ...patch });

describe("toApiParams (FR-130)", () => {
  it("maps tz → timezone and never sends preset", () => {
    const p = toApiParams(base({ tz: "UTC" }), { target: "analytics", now });
    expect(p.timezone).toBe("UTC");
    expect(p).not.toHaveProperty("tz");
    expect(p).not.toHaveProperty("preset");
  });

  it("BR-016: relevance defaults to relevant and is always sent; empty arrays are dropped; arrays become CSV", () => {
    const p = toApiParams(base({ relevance: [], sentiment: ["negative", "neutral"] }), { target: "analytics", now });
    expect(p.relevance).toBe("relevant");
    expect(p.sentiment).toBe("negative,neutral");
    expect(p).not.toHaveProperty("safety");
  });

  it("filters fields by target: compare only for analytics, q/sort only for mentions", () => {
    const f = base({ compare: true, q: " lỗi ", sort: "oldest" });
    const a = toApiParams(f, { target: "analytics", now });
    const m = toApiParams(f, { target: "mentions", now });
    expect(a.compare).toBe("true");
    expect(a).not.toHaveProperty("q");
    expect(a).not.toHaveProperty("sort");
    expect(m).not.toHaveProperty("compare");
    expect(m).toMatchObject({ q: "lỗi", sort: "oldest" });
  });

  it("keys are sorted for a stable query key", () => {
    const keys = Object.keys(toApiParams(base({ safety: ["severe"] }), { target: "analytics", now }));
    expect(keys).toEqual([...keys].sort());
  });

  it("output parses through the contract schemas (guards contract drift)", () => {
    const f = base({
      queryIds: ["7f0c1e9a-2b1d-4c3e-9f8a-1b2c3d4e5f60"],
      relevance: ["relevant", "uncertain"],
      sentiment: ["negative"],
      safety: ["sensitive"],
      analysisStatus: ["completed"],
      compare: true,
      q: "abc",
    });
    expect(AnalyticsQuerySchema.safeParse(toApiParams(f, { target: "analytics", now })).success).toBe(true);
    expect(MentionsListQuerySchema.safeParse(toApiParams(f, { target: "mentions", now })).success).toBe(true);
  });
});

describe("toMentionsHref (FR-142)", () => {
  it("pins the resolved range as custom, merges extra and drops compare", () => {
    const href = toMentionsHref(base({ preset: "24h", compare: true }), { sentiment: ["negative"] }, now);
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/mentions");
    expect(url.searchParams.get("preset")).toBe("custom");
    expect(url.searchParams.get("to")).toBe(now.toISOString());
    expect(url.searchParams.get("from")).toBe(new Date(now.getTime() - 24 * 3_600_000).toISOString());
    expect(url.searchParams.get("sentiment")).toBe("negative");
    expect(url.searchParams.has("compare")).toBe(false);
  });
});

describe("appliedChips / removeFilterValue", () => {
  it("skips defaults (BR-016) and labels active values", () => {
    expect(appliedChips(base())).toEqual([]);
    const chips = appliedChips(base({ sentiment: ["negative"], relevance: ["relevant", "irrelevant"] }));
    expect(chips.map((c) => c.label)).toEqual(["Relevance: Relevant", "Relevance: Irrelevant", "Sentiment: Negative"]);
  });

  it("removes a value; emptied relevance falls back to relevant (BR-016)", () => {
    expect(removeFilterValue(base({ sentiment: ["negative", "neutral"] }), "sentiment", "neutral")).toEqual({
      sentiment: ["negative"],
    });
    expect(removeFilterValue(base({ relevance: ["uncertain"] }), "relevance", "uncertain")).toEqual({
      relevance: ["relevant"],
    });
  });
});

describe("phrase filter (#243, FR-148, BR-041)", () => {
  const f = base({ phrase: ["giá vé", "xếp hàng"] });

  it("is sent to analytics and mentions as CSV", () => {
    expect(toApiParams(f, { target: "analytics", now }).phrase).toBe("giá vé,xếp hàng");
    expect(toApiParams(f, { target: "mentions", now }).phrase).toBe("giá vé,xếp hàng");
    expect(AnalyticsQuerySchema.parse(toApiParams(f, { target: "analytics", now })).phrase).toEqual([
      "giá vé",
      "xếp hàng",
    ]);
  });

  it("has a verbatim chip and can be removed", () => {
    expect(appliedChips(f).map((c) => c.label)).toEqual(["Phrase: giá vé", "Phrase: xếp hàng"]);
    expect(removeFilterValue(f, "phrase", "giá vé")).toEqual({ phrase: ["xếp hàng"] });
  });
});

describe("phraseMentionsHref (#250, FR-148, BR-041)", () => {
  it.each(["giá vé", "check-in", "a/b"])("round-trips %s through the phrase parser", (p) => {
    const url = new URL(phraseMentionsHref(p), "http://x");
    expect(url.pathname).toBe("/mentions");
    expect([...url.searchParams.keys()]).toEqual(["phrase"]);
    expect(filterParsers.phrase.parse(url.searchParams.get("phrase") ?? "")).toEqual([p]);
  });
});
