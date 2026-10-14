import { describe, expect, it } from "vitest";
import {
  LandingTermsQuerySchema,
  LandingTermsResponseSchema,
  PhrasesQuerySchema,
  ProjectSettingsPatchSchema,
  ProjectSettingsSchema,
  UpdateProjectBodySchema,
} from "../src/index.js";

describe("FR-032 / FR-148 (#251): phraseMinMentions project setting", () => {
  it("defaults to 2 and keeps 1 and 50", () => {
    expect(ProjectSettingsSchema.parse({}).phraseMinMentions).toBe(2);
    expect(ProjectSettingsSchema.parse({ phraseMinMentions: 1 }).phraseMinMentions).toBe(1);
    expect(ProjectSettingsSchema.parse({ phraseMinMentions: 50 }).phraseMinMentions).toBe(50);
  });

  it("PATCH body accepts an integer 1–50 only", () => {
    expect(UpdateProjectBodySchema.safeParse({ settings: { phraseMinMentions: 5 } }).success).toBe(true);
    expect(UpdateProjectBodySchema.safeParse({ settings: {} }).success).toBe(true);
    for (const bad of [0, 51, 2.5, "5"]) {
      expect(UpdateProjectBodySchema.safeParse({ settings: { phraseMinMentions: bad } }).success).toBe(false);
    }
  });

  it("phrases query leaves minMentions undefined when omitted (server falls back to the setting)", () => {
    expect(PhrasesQuerySchema.parse({}).minMentions).toBeUndefined();
    expect(PhrasesQuerySchema.parse({ minMentions: "7" }).minMentions).toBe(7);
    expect(PhrasesQuerySchema.safeParse({ minMentions: "0" }).success).toBe(false);
    expect(PhrasesQuerySchema.safeParse({ minMentions: "1001" }).success).toBe(false);
  });
});

describe("FR-032 / FR-149 / BR-042 (#261): landingTerms project setting", () => {
  const patch = (landingTerms: unknown) => UpdateProjectBodySchema.safeParse({ settings: { landingTerms } });

  it("defaults to [] and is not added to a PATCH that omits it", () => {
    expect(ProjectSettingsSchema.parse({}).landingTerms).toEqual([]);
    expect(ProjectSettingsPatchSchema.parse({})).toEqual({});
  });

  it("BR-042: normalises like key phrases (BR-041) and de-duplicates keeping first order", () => {
    expect(ProjectSettingsSchema.parse({ landingTerms: ["  Giá   Vé "] }).landingTerms).toEqual(["giá vé"]);
    const r = patch(["Giá vé", "giá  vé", "App"]);
    expect(r.success && r.data.settings?.landingTerms).toEqual(["giá vé", "app"]);
  });

  it("BR-042: rejects > 20 terms, empty, > 60 chars, no letter/digit, non-string", () => {
    expect(patch(Array.from({ length: 20 }, (_, i) => `t${i}`)).success).toBe(true);
    expect(patch(Array.from({ length: 21 }, (_, i) => `t${i}`)).success).toBe(false);
    for (const bad of ["", "   ", "a".repeat(61), "!!!", 5]) expect(patch([bad]).success).toBe(false);
  });

  it("FR-149: landing-terms query rejects to <= from; response parses", () => {
    expect(
      LandingTermsQuerySchema.safeParse({ from: "2026-10-02T00:00:00Z", to: "2026-10-01T00:00:00Z" }).success,
    ).toBe(false);
    expect(LandingTermsQuerySchema.parse({}).relevance).toEqual(["relevant"]);
    const sample = {
      range: { from: "2026-09-14T00:00:00+07:00", to: "2026-10-14T00:00:00+07:00", timezone: "Asia/Ho_Chi_Minh" },
      sentimentAnalyzed: 10,
      rows: [
        { term: "giá vé", positive: 1, neutral: 0, negative: 3, total: 4, dominant: "negative", dominantShare: 0.75 },
        { term: "app", positive: 0, neutral: 0, negative: 0, total: 0, dominant: null, dominantShare: null },
      ],
    };
    expect(LandingTermsResponseSchema.parse(sample)).toEqual(sample);
  });
});
