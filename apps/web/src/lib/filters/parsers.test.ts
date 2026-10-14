import { describe, expect, it } from "vitest";
import { createLoader } from "nuqs/server";
import { filterParsers, serializeFilters } from "./parsers";

const load = createLoader(filterParsers);

describe("filter URL parsers (TC-DASH-005: reload preserves filters)", () => {
  it("round-trips serialize → parse", () => {
    const state = {
      preset: "custom" as const,
      from: new Date("2026-10-01T00:00:00.000Z"),
      to: new Date("2026-10-05T00:00:00.000Z"),
      tz: "UTC",
      sentiment: ["negative" as const],
      relevance: ["relevant" as const, "uncertain" as const],
      compare: true,
    };
    const parsed = load(serializeFilters(state));
    expect(parsed).toMatchObject(state);
  });

  it("defaults are kept out of the URL and restored on parse (BR-016)", () => {
    expect(serializeFilters({ preset: "7d", relevance: ["relevant"], compare: false })).toBe("");
    const parsed = load("");
    expect(parsed.preset).toBe("7d");
    expect(parsed.relevance).toEqual(["relevant"]);
    expect(parsed.tz).toBe("Asia/Ho_Chi_Minh");
  });

  it("falls back on garbage tz and drops unknown enum values / bad UUIDs", () => {
    const parsed = load(
      "?tz=Mars/Base&sentiment=negative,angry&queryIds=nope,7f0c1e9a-2b1d-4c3e-9f8a-1b2c3d4e5f60&preset=2y",
    );
    expect(parsed.tz).toBe("Asia/Ho_Chi_Minh");
    expect(parsed.sentiment).toEqual(["negative"]);
    expect(parsed.queryIds).toEqual(["7f0c1e9a-2b1d-4c3e-9f8a-1b2c3d4e5f60"]);
    expect(parsed.preset).toBe("7d");
  });
});

describe("phrase parser (#243, BR-041)", () => {
  it("normalises like the API and drops empty / too long values", () => {
    expect(load("?phrase=Gi%C3%A1%20V%C3%A9").phrase).toEqual(["giá vé"]);
    expect(load(`?phrase=${"a".repeat(61)},ok`).phrase).toEqual(["ok"]);
    expect(load("?phrase=%20,!!!").phrase).toEqual([]);
  });
});
