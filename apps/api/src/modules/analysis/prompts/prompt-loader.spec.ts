import { parseClassifierOutput } from "@how-about-me/contracts";
import { createHash } from "node:crypto";
import { DEFAULT_PROMPT_VERSION } from "@how-about-me/taxonomy";
import { loadPrompt, parsePrompt, renderMessages } from "./prompt-loader";

describe("prompt-loader (T-072, BR-023)", () => {
  it("loads classifier-v1 with system, user template and 6 valid few-shot examples", () => {
    const p = loadPrompt("classifier-v1");
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

  it("FR-113: correction appends one final user message with the issues; absent → unchanged", () => {
    const p = loadPrompt("classifier-v1");
    const input = { text: "t", matchedTerms: [], brandContext: "b" };
    const base = renderMessages(p, input);
    const fixed = renderMessages(p, { ...input, correction: { issues: ["intents.0.label: Invalid option"] } });
    expect(fixed).toHaveLength(base.length + 1);
    expect(fixed.at(-1)).toMatchObject({ role: "user" });
    expect(fixed.at(-1)?.content).toContain("- intents.0.label: Invalid option");
  });

  // FR-120, BR-041, BR-023: classifier-v2 adds key phrases; classifier-v1 stays byte-for-byte frozen.
  it("loads classifier-v2 (default) with 6 examples that all carry keyPhrases", () => {
    expect(DEFAULT_PROMPT_VERSION).toBe("classifier-v2");
    const p = loadPrompt(DEFAULT_PROMPT_VERSION);
    expect(p.examples).toHaveLength(6);
    for (const ex of p.examples) {
      expect(Array.isArray(ex.output.keyPhrases)).toBe(true);
      expect(parseClassifierOutput(ex.output, "v2").ok).toBe(true);
    }
    expect(p.examples[0]?.output.keyPhrases).toEqual([]); // irrelevant → []
  });

  it("golden: classifier-v1 rendered messages are unchanged (sha256 captured before #223)", () => {
    const messages = renderMessages(loadPrompt("classifier-v1"), {
      text: "Vé 1Zone chát quá",
      matchedTerms: ["1Zone"],
      brandContext: "1Zone brand",
      username: "u",
      languageHint: "vi",
    });
    expect(JSON.stringify(messages)).not.toContain("keyPhrases");
    expect(createHash("sha256").update(JSON.stringify(messages)).digest("hex")).toBe(
      "8815cfa0886c4690393503d442516144ca50967b37af9d5fc01325fc9433f4a5",
    );
  });

  it("fails fast when a classifier-v2 example has no keyPhrases", () => {
    const v1Example = JSON.stringify(loadPrompt("classifier-v1").examples[1]?.output);
    const src = `## system\ns\n## user\nu\n## examples\n### example\n#### input\n\`\`\`json\n{"text":"t","matchedTerms":[]}\n\`\`\`\n#### output\n\`\`\`json\n${v1Example}\n\`\`\`\n`;
    expect(() => parsePrompt("classifier-v2", src)).toThrow(/example 1 output invalid: keyPhrases/);
  });
});
