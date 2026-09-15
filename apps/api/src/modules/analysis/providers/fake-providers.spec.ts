import { ClassifierOutputSchema } from "@how-about-me/contracts";
import { mapSafetyLevel } from "@how-about-me/taxonomy";
import { FakeContentClassifier } from "./fake-classifier.provider";
import { FakeSafetyProvider } from "./fake-safety.provider";
import type { AnalysisContext, ClassifierInput } from "./interfaces";

const CTX: AnalysisContext = { requestId: "req-1", projectId: "p-1", runId: "r-1" };

const input = (text: string, over: Partial<ClassifierInput> = {}): ClassifierInput => ({
  text,
  matchedTerms: ["1zone"],
  brandContext: "1Zone and Eventista are Vietnamese live-event brands.",
  ...over,
});

describe("FakeContentClassifier (FR-112)", () => {
  const classifier = new FakeContentClassifier({ inputPer1M: 0.15, outputPer1M: 0.6 });

  it("always returns output valid against the strict classifier schema", async () => {
    const texts = [
      "Cho hỏi vé 1Zone mở bán lúc mấy giờ vậy mọi người?",
      "Mua vé 1zone mà chờ queue 2 tiếng, tới lượt hết vé. Quá thất vọng 😤",
      "SALE SALE vé 1zone giá rẻ inbox ngay kẻo lỡ!!!",
      "what time zone is the 1zone livestream in?",
      "ok",
      "",
    ];
    for (const text of texts) {
      const out = await classifier.classify(input(text), CTX);
      expect(() => ClassifierOutputSchema.parse(stripUsage(out))).not.toThrow();
    }
  });

  it("is deterministic: the same text yields byte-identical output", async () => {
    const text = "Concert 1Zone tối qua xịn thật sự, âm thanh ánh sáng quá ổn 🔥";
    const a = await classifier.classify(input(text), CTX);
    const b = await classifier.classify(input(text), CTX);
    expect(a).toEqual(b);
  });

  it("different texts get different labels, so demo charts are not one flat bar", async () => {
    const complaint = await classifier.classify(input("Thanh toán lỗi hoài, trừ tiền mà không thấy vé đâu"), CTX);
    const praise = await classifier.classify(
      input("Staff thân thiện, check-in nhanh, 10 điểm cho khâu tổ chức 👏"),
      CTX,
    );
    expect(complaint.sentiment.label).toBe("negative");
    expect(praise.sentiment.label).toBe("positive");
    expect(complaint.topics.map((t) => t.label)).toContain("payment");
  });

  it("marks an unrelated use of the term as irrelevant (BR-016, relevance guide)", async () => {
    const out = await classifier.classify(input("what time zone is the 1zone livestream in?"), CTX);
    expect(out.relevance.label).toBe("irrelevant");
    expect(out.relevance.explanation).toContain("unrelated sense");
  });

  it("marks a too-short post as uncertain, in the low/medium confidence band (BR-021)", async () => {
    const out = await classifier.classify(input("1zone ơi"), CTX);
    expect(out.relevance.label).toBe("uncertain");
    expect(out.relevance.confidence).toBeLessThan(0.8);
  });

  it("detects Vietnamese vs English text", async () => {
    expect((await classifier.classify(input("Vé 1Zone còn không shop ơi"), CTX)).language).toBe("vi");
    expect((await classifier.classify(input("Are there any 1zone tickets left?"), CTX)).language).toBe("en");
  });

  it("applies `other`-exclusivity and the 1..4 label limits via the shared normaliser", async () => {
    const out = await classifier.classify(
      input("Vé, giá, queue, thanh toán, membership, cskh, âm thanh, concert, idol, merch, chỗ ngồi"),
      CTX,
    );
    expect(out.topics.length).toBeGreaterThanOrEqual(1);
    expect(out.topics.length).toBeLessThanOrEqual(4);
    if (out.topics.length > 1) expect(out.topics.map((t) => t.label)).not.toContain("other");
  });

  it("simulates usage and cost from the configured prices", async () => {
    const out = await classifier.classify(input("Vé 1Zone mở bán chưa mọi người?"), CTX);
    expect(out.usage.inputTokens).toBeGreaterThan(0);
    expect(out.usage.outputTokens).toBe(96);
    expect(out.usage.estimatedCostUsd).toBeGreaterThan(0);

    const free = new FakeContentClassifier();
    expect((await free.classify(input("x"), CTX)).usage.estimatedCostUsd).toBe(0);
  });

  it("the relevance gate is cheaper than the full classification (two-step path, doc §2)", async () => {
    const text = "Mình định mua membership 1Zone, ai dùng rồi cho xin review với ạ";
    const gate = await classifier.relevance(input(text), CTX);
    const full = await classifier.classify(input(text), CTX);
    expect(gate.relevance).toEqual(full.relevance);
    expect(gate.usage.outputTokens).toBeLessThan(full.usage.outputTokens);
  });

  it("labels itself as fake so BR-023 metadata cannot be mistaken for real measurements", () => {
    expect(classifier.provider).toBe("fake");
    expect(classifier.model).toContain("fake");
    expect(classifier.promptVersion).toContain("fake");
  });
});

describe("FakeSafetyProvider (BR-017, BR-018)", () => {
  const safety = new FakeSafetyProvider();

  it("is deterministic and keeps every score inside [0, 1]", async () => {
    const a = await safety.moderate({ text: "Concert 1Zone tối qua xịn thật sự" }, CTX);
    const b = await safety.moderate({ text: "Concert 1Zone tối qua xịn thật sự" }, CTX);
    expect(a).toEqual(b);
    for (const score of Object.values(a.categoryScores)) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it("leaves ordinary posts safe once the policy is applied", async () => {
    const result = await safety.moderate({ text: "Cho hỏi vé 1Zone mở bán lúc mấy giờ ạ?" }, CTX);
    expect(result.flagged).toBe(false);
    expect(mapSafetyLevel(result).level).toBe("safe");
  });

  it("produces a severe post so the safety chart has more than one bucket", async () => {
    const result = await safety.moderate({ text: "thằng nào bán vé lụi tao giết nó luôn" }, CTX);
    expect(mapSafetyLevel(result).level).toBe("severe");
    expect(result.flagged).toBe(true);
  });

  it("produces a sensitive post between the two extremes", async () => {
    const result = await safety.moderate({ text: "đm cái app này, bực thật sự" }, CTX);
    expect(mapSafetyLevel(result).level).toBe("sensitive");
  });

  it("never derives safety from sentiment (BR-017): an angry but clean post stays safe", async () => {
    const result = await safety.moderate({ text: "Rất thất vọng, chờ queue 2 tiếng rồi hết vé" }, CTX);
    expect(mapSafetyLevel(result).level).toBe("safe");
  });
});

function stripUsage<T extends { usage: unknown }>(out: T) {
  const { usage: _usage, ...rest } = out;
  return rest;
}
