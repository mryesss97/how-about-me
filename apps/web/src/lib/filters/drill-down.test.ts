import { MentionsListQuerySchema } from "@how-about-me/contracts";
import { createLoader } from "nuqs/server";
import { describe, expect, it } from "vitest";
import { toApiParams, toMentionsHref } from "./api-params";
import { bucketDrillDown, kpiDrillDown, queryDrillDown, segmentDrillDown } from "./drill-down";
import { filterParsers } from "./parsers";
import { defaultFilters, type Filters } from "./schema";

const now = new Date("2026-10-13T05:30:00.000Z");
const base = (patch: Partial<Filters> = {}): Filters => ({ ...defaultFilters("Asia/Ho_Chi_Minh"), ...patch });
const loadFilters = createLoader(filterParsers);
const parseFilters = (q: URLSearchParams): Filters => loadFilters(q);
const query = (href: string) => new URLSearchParams(href.split("?")[1]);

describe("kpiDrillDown (FR-142, doc 07 §6)", () => {
  it.each([
    ["mentions", {}],
    ["growth", {}],
    ["positive", { sentiment: ["positive"] }],
    ["negative", { sentiment: ["negative"] }],
    ["safety", { safety: ["sensitive", "severe"] }],
    ["severe", { safety: ["severe"] }],
    ["complaint", { intent: ["complaint"] }],
  ] as const)("%s → %j", (id, expected) => {
    expect(kpiDrillDown(id)).toEqual(expected);
  });

  it("BR-017: sentiment KPIs never set safety and vice versa", () => {
    expect(kpiDrillDown("negative")).not.toHaveProperty("safety");
    expect(kpiDrillDown("safety")).not.toHaveProperty("sentiment");
  });
});

describe("segmentDrillDown (FR-142)", () => {
  it("maps each dimension to its filter", () => {
    expect(segmentDrillDown("sentiment", "neutral")).toEqual({ sentiment: ["neutral"] });
    expect(segmentDrillDown("safety", "severe")).toEqual({ safety: ["severe"] });
    expect(segmentDrillDown("topic", "ticket")).toEqual({ topic: ["ticket"] });
    expect(segmentDrillDown("intent", "other")).toEqual({ intent: ["other"] });
    expect(segmentDrillDown("language", "vi")).toEqual({ language: ["vi"] });
  });

  it("aggregated topic 'other' has no filter → null", () => {
    expect(segmentDrillDown("topic", "other")).toBeNull();
  });

  it("language 'other' drills down to language=other (API folds codes outside the taxonomy, #201)", () => {
    expect(segmentDrillDown("language", "other")).toEqual({ language: ["other"] });
  });
});

describe("bucketDrillDown (FR-141 boundaries, [from, to))", () => {
  // Day buckets aligned to Asia/Ho_Chi_Minh midnight (UTC+7).
  const vnTimes = ["2026-10-10T17:00:00.000Z", "2026-10-11T17:00:00.000Z", "2026-10-12T17:00:00.000Z"];
  const vnRange = { from: "2026-10-10T20:00:00.000Z", to: "2026-10-13T05:30:00.000Z" };

  it("middle bucket ends at the next bucket start", () => {
    expect(bucketDrillDown(vnTimes, 1, vnRange)).toEqual({
      preset: "custom",
      from: new Date("2026-10-11T17:00:00.000Z"),
      to: new Date("2026-10-12T17:00:00.000Z"),
    });
  });

  it("first bucket is clamped to range.from, last bucket ends at range.to", () => {
    expect(bucketDrillDown(vnTimes, 0, vnRange)?.from).toEqual(new Date(vnRange.from));
    expect(bucketDrillDown(vnTimes, 2, vnRange)?.to).toEqual(new Date(vnRange.to));
  });

  it("UTC buckets use UTC midnights", () => {
    const utc = ["2026-10-11T00:00:00.000Z", "2026-10-12T00:00:00.000Z"];
    const r = bucketDrillDown(utc, 0, { from: "2026-10-11T00:00:00.000Z", to: "2026-10-13T00:00:00.000Z" });
    expect(r?.to).toEqual(new Date("2026-10-12T00:00:00.000Z"));
  });

  it("out-of-range index → null", () => {
    expect(bucketDrillDown(vnTimes, 5, vnRange)).toBeNull();
  });
});

describe("drill-down hrefs", () => {
  it("TC-DASH-019: topic filter + Negative segment → sentiment=negative&topic=ticket", () => {
    const q = query(toMentionsHref(base({ topic: ["ticket"] }), segmentDrillDown("sentiment", "negative") ?? {}, now));
    expect(q.get("sentiment")).toBe("negative");
    expect(q.get("topic")).toBe("ticket");
  });

  it("BR-016: keeps relevance=relevant by default and a user-widened relevance", () => {
    expect(query(toMentionsHref(base(), kpiDrillDown("mentions"), now)).get("relevance") ?? "relevant").toBe(
      "relevant",
    );
    const widened = query(
      toMentionsHref(base({ relevance: ["relevant", "uncertain"] }), kpiDrillDown("negative"), now),
    );
    expect(widened.get("relevance")).toBe("relevant,uncertain");
  });

  it("TC-DASH-017: href never carries compare, even when compare is on", () => {
    const href = toMentionsHref(base({ compare: true }), kpiDrillDown("growth"), now);
    expect(query(href).has("compare")).toBe(false);
  });

  it("bucket extra (preset=custom) wins over the dashboard preset", () => {
    const extra = bucketDrillDown(["2026-10-12T17:00:00.000Z"], 0, {
      from: "2026-10-06T05:30:00.000Z",
      to: "2026-10-13T05:30:00.000Z",
    });
    const f = parseFilters(query(toMentionsHref(base(), extra ?? {}, now)));
    expect(f.from?.toISOString()).toBe("2026-10-12T17:00:00.000Z");
    expect(f.to?.toISOString()).toBe("2026-10-13T05:30:00.000Z");
  });

  it("roundtrip: href → filters → mentions API params pass MentionsListQuerySchema", () => {
    const href = toMentionsHref(base({ topic: ["ticket"] }), kpiDrillDown("safety"), now);
    const params = toApiParams(parseFilters(query(href)), { target: "mentions", now });
    expect(MentionsListQuerySchema.safeParse(params).success).toBe(true);
    expect(params.safety).toBe("sensitive,severe");
  });
});

describe("queryDrillDown (FR-145, T-150)", () => {
  const Q1 = "00000000-0000-4000-8000-000000000001";
  const Q2 = "00000000-0000-4000-8000-000000000002";

  it("maps a keyword share bar to queryIds=[id]", () => {
    expect(queryDrillDown(Q1)).toEqual({ queryIds: [Q1] });
  });

  it("replaces global queryIds in the Mentions href (FR-142)", () => {
    const href = toMentionsHref(base({ queryIds: [Q1, Q2] }), queryDrillDown(Q2), now);
    expect(new URL(href, "http://x").searchParams.getAll("queryIds").join(",")).toBe(Q2);
  });
});
