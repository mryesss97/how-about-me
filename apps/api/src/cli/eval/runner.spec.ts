import type { ContentClassifier, SafetyProvider } from "../../modules/analysis/providers/interfaces";
import { FakeContentClassifier } from "../../modules/analysis/providers/fake-classifier.provider";
import { FakeSafetyProvider } from "../../modules/analysis/providers/fake-safety.provider";
import type { EvalItem } from "./dataset";
import { runEval, summarize } from "./runner";

const item = (id: string, text: string, labels: Partial<EvalItem["labels"]> = {}): EvalItem => ({
  id,
  text,
  matchedTerms: ["1zone"],
  labels: { relevance: "relevant", safetyLevel: "safe", ...labels },
});

const opts = (classifier: ContentClassifier = new FakeContentClassifier({ inputPer1M: 1, outputPer1M: 1 })) => ({
  classifier,
  safety: new FakeSafetyProvider() as SafetyProvider,
  brandContext: "brand",
  concurrency: 2,
});

describe("runEval / summarize (T-079)", () => {
  it("keeps going when one item fails and records the error by id", async () => {
    const real = new FakeContentClassifier();
    const flaky: ContentClassifier = {
      provider: real.provider,
      model: real.model,
      promptVersion: real.promptVersion,
      relevance: (i, c) => real.relevance(i, c),
      classify: async (i, c) => {
        if (i.text === "boom") throw new Error("provider down");
        return real.classify(i, c);
      },
    };
    const results = await runEval(
      [item("a", "Concert xịn"), item("b", "boom"), item("c", "Vé bao nhiêu?")],
      opts(flaky),
    );
    expect(results.map((r) => r.item.id)).toEqual(["a", "b", "c"]);
    const s = summarize(results);
    expect(s.errors).toEqual([{ id: "b", message: "provider down" }]);
    expect(s.relevance.n).toBe(2);
  });

  it("sums usage across items", async () => {
    const results = await runEval([item("a", "Concert xịn"), item("b", "Vé bao nhiêu?")], opts());
    const s = summarize(results);
    const expectedIn = results.reduce((a, r) => a + r.usage.inputTokens, 0);
    expect(expectedIn).toBeGreaterThan(0);
    expect(s.usage.totalInputTokens).toBe(expectedIn);
    expect(s.usage.totalCostUsd).toBeCloseTo(results.reduce((a, r) => a + r.usage.estimatedCostUsd, 0));
  });

  it("excludes items without a gold dimension and computes the VI sentiment subset by gold language", async () => {
    const results = await runEval(
      [
        item("a", "Concert xịn 👏", { sentiment: "positive", language: "vi" }),
        item("b", "time zone 1zone", { relevance: "irrelevant" }),
      ],
      opts(),
    );
    const s = summarize(results);
    expect(s.sentiment.n).toBe(1);
    expect(s.sentiment.viN).toBe(1);
    expect(s.relevance.irrelevantRecall).toBe(1);
  });

  it("BR-017: safety level comes only from the safety provider, independent of sentiment gold", async () => {
    const [neg] = await runEval([item("a", "Concert xịn", { sentiment: "negative", safetyLevel: "safe" })], opts());
    expect(neg?.prediction?.safetyLevel).toBe("safe");
    expect(summarize(neg ? [neg] : []).safety.agreement).toBe(1);
  });
});
