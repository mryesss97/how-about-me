import { FakeContentClassifier } from "../../modules/analysis/providers/fake-classifier.provider";
import { FakeSafetyProvider } from "../../modules/analysis/providers/fake-safety.provider";
import type { EvalItem } from "./dataset";
import { gateRows, renderReport, type ReportMeta } from "./report";
import { runEval, summarize } from "./runner";

const SECRET_TEXT = "Gặp nó tao đánh chết nó, số nhà 12 phố X";
const items: EvalItem[] = [
  { id: "r1", text: SECRET_TEXT, matchedTerms: [], labels: { relevance: "relevant", safetyLevel: "severe" } },
  { id: "r2", text: "time zone 1zone", matchedTerms: [], labels: { relevance: "irrelevant", safetyLevel: "safe" } },
];
const meta: ReportMeta = {
  generatedAt: new Date("2026-10-13T00:00:00Z"),
  datasetPath: "x.jsonl",
  datasetSha256: "abc",
  providersMode: "fake",
  classifier: { provider: "fake", model: "m", promptVersion: "p" },
  safety: { name: "fake", model: "s" },
  brandContextSha256: "0123456789abcdef",
  brandContextLength: 10,
  pricesConfigured: false,
};

describe("renderReport (T-079)", () => {
  it("renders the gate table with PASS/FAIL and never includes item text", async () => {
    const results = await runEval(items, {
      classifier: new FakeContentClassifier(),
      safety: new FakeSafetyProvider(),
      brandContext: "b",
      concurrency: 1,
    });
    const s = summarize(results);
    const md = renderReport(s, meta);
    expect(md).toContain("## Freeze gate");
    expect(md).toContain("| Relevance accuracy | 1.000 | ≥ 0.85 | PASS |");
    // No sentiment gold → VI accuracy null → FAIL.
    expect(md).toContain("| Sentiment accuracy (VI) | — | ≥ 0.75 | FAIL |");
    expect(md).toContain("Fake providers");
    expect(md).toContain("giá chưa cấu hình");
    expect(md).not.toContain(SECRET_TEXT);
    expect(md).not.toContain("time zone 1zone");
    // FR-120: phrase section is informational, never a gate row.
    expect(md).toContain("## Key phrases (informational, not gated)");
    expect(gateRows(s).some((g) => /phrase/i.test(g.metric))).toBe(false);
  });

  it("BR-018: severe gate fails when a severe item is missed", async () => {
    const results = await runEval(
      [{ id: "x", text: "hello", matchedTerms: [], labels: { relevance: "relevant", safetyLevel: "severe" } }],
      { classifier: new FakeContentClassifier(), safety: new FakeSafetyProvider(), brandContext: "b", concurrency: 1 },
    );
    const gate = gateRows(summarize(results)).find((g) => g.metric.startsWith("Severe"));
    expect(gate).toMatchObject({ value: "1 / 1", pass: false });
  });
});
