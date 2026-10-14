import { describe, expect, it } from "vitest";
import { PhrasesQuerySchema, ProjectSettingsSchema, UpdateProjectBodySchema } from "../src/index.js";

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
