import { SAFETY_POLICY_V1 } from "@how-about-me/taxonomy";
import flaggedBelow from "../providers/__fixtures__/openai-moderation/flagged-below-threshold.json";
import negativeButSafe from "../providers/__fixtures__/openai-moderation/negative-but-safe.json";
import safe from "../providers/__fixtures__/openai-moderation/safe.json";
import sensitive from "../providers/__fixtures__/openai-moderation/sensitive-harassment.json";
import severe from "../providers/__fixtures__/openai-moderation/severe-violence.json";
import { OpenAiModerationProvider } from "../providers/openai-moderation.provider";
import { toSafetyAnalysis } from "./safety-mapping";

const ctx = { requestId: "r", projectId: "p", runId: "run" };

/** Adapter + mapping end-to-end over a recorded (anonymised) response. */
async function analyse(body: unknown) {
  const provider = new OpenAiModerationProvider({
    apiKey: "sk-test",
    model: "omni-moderation-latest",
    baseUrl: "https://api.openai.test/v1",
    timeoutMs: 50,
    maxRetries: 0,
    fetchFn: async () => new Response(JSON.stringify(body), { status: 200 }),
  });
  return toSafetyAnalysis(await provider.moderate({ text: "post" }, ctx));
}

const single = (category: string, score: number, flagged = false) => ({
  results: [{ flagged, categories: { [category]: flagged }, category_scores: { [category]: score } }],
});

describe("toSafetyAnalysis (T-071, BR-018)", () => {
  it("TC-ANA-006: sensitive fixture → persisted shape { scores, triggered }, level, policy version", async () => {
    const out = await analyse(sensitive);
    expect(out.safetyFlagged).toBe(true);
    expect(out.safetyLevel).toBe("sensitive");
    expect(out.safetyPolicyVersion).toBe("safety-policy-v1");
    expect(out.safetyCategoryScores.scores.harassment).toBe(0.62);
    expect(out.safetyCategoryScores.triggered).toEqual([{ category: "harassment", score: 0.62, level: "sensitive" }]);
  });

  it("safe fixture → safe, nothing triggered", async () => {
    const out = await analyse(safe);
    expect(out).toMatchObject({ safetyFlagged: false, safetyLevel: "safe" });
    expect(out.safetyCategoryScores.triggered).toEqual([]);
  });

  it("TC-ANA-007: severe wins over sensitive", async () => {
    expect((await analyse(severe)).safetyLevel).toBe("severe");
  });

  it("TC-ANA-007: flagged with no threshold crossed → sensitive", async () => {
    expect((await analyse(flaggedBelow)).safetyLevel).toBe("sensitive");
  });

  it.each([
    ["harassment", 0.5, "sensitive"],
    ["violence", 0.85, "severe"],
    ["self-harm/intent", 0.4, "severe"],
    ["hate", 0.4, "sensitive"],
  ])("TC-ANA-007 boundary: %s at %d → %s; just below → lower level", async (category, threshold, level) => {
    expect((await analyse(single(category, threshold))).safetyLevel).toBe(level);
    expect((await analyse(single(category, threshold - 0.0001))).safetyLevel).not.toBe(level);
  });

  it("keeps unknown categories in scores but ignores them in the policy", async () => {
    const out = await analyse(single("brand-new/category", 0.99));
    expect(out.safetyCategoryScores.scores["brand-new/category"]).toBe(0.99);
    expect(out.safetyLevel).toBe("safe");
    expect(Object.keys(SAFETY_POLICY_V1)).not.toContain("brand-new/category");
  });

  it("TC-ANA-008 / BR-017: a negative-but-safe post stays safe; sentiment is not an input", async () => {
    expect((await analyse(negativeButSafe)).safetyLevel).toBe("safe");
    // @ts-expect-error toSafetyAnalysis takes no sentiment (BR-017)
    toSafetyAnalysis({ flagged: false, categoryScores: {}, categories: {} }, { sentiment: "negative" });
  });
});
