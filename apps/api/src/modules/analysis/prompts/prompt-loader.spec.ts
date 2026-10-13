import { parseClassifierOutput } from "@how-about-me/contracts";
import { DEFAULT_PROMPT_VERSION } from "@how-about-me/taxonomy";
import { loadPrompt, parsePrompt } from "./prompt-loader";

describe("prompt-loader (T-072, BR-023)", () => {
  it("loads classifier-v1 with system, user template and 6 valid few-shot examples", () => {
    expect(DEFAULT_PROMPT_VERSION).toBe("classifier-v1");
    const p = loadPrompt(DEFAULT_PROMPT_VERSION);
    expect(p.version).toBe("classifier-v1");
    expect(p.system).toContain("{{brand_context}}");
    expect(p.system).toContain("{{taxonomy_guide}}");
    expect(p.userTemplate).toContain("<post>\n{{text}}\n</post>");
    expect(p.examples).toHaveLength(6);
    for (const ex of p.examples) expect(parseClassifierOutput(ex.output).ok).toBe(true);
  });

  it("covers the doc 07 §5 few-shot cases (BR-017: sensitive stays a sentiment, not safety)", () => {
    const labels = loadPrompt("classifier-v1").examples.map((e) => [
      e.output.relevance.label,
      ...e.output.intents.map((i) => i.label),
    ]);
    expect(labels.flat()).toEqual(
      expect.arrayContaining(["irrelevant", "complaint", "praise", "spam", "question", "purchase_intent"]),
    );
  });

  it("fails fast on an invalid example output", () => {
    const src =
      '## system\ns\n## user\nu\n## examples\n### example\n#### input\n```json\n{"text":"t","matchedTerms":[]}\n```\n#### output\n```json\n{"relevance":1}\n```\n';
    expect(() => parsePrompt("bad", src)).toThrow(/example 1 output invalid/);
  });
});
