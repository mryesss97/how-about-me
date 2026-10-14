import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifierSchemaVersionOf, parseClassifierOutput, type ClassifierOutput } from "@how-about-me/contracts";
import { renderTaxonomyGuide } from "@how-about-me/taxonomy";
import { z } from "zod";
import type { ClassifierInput } from "../providers/interfaces";

/**
 * Loads a versioned classifier prompt (`prompts/<version>.md`, copied to `dist` by nest-cli assets) —
 * docs/02-architecture/07-analysis-pipeline.md §5. Each file is parsed once and cached; every few-shot output
 * is validated with `parseClassifierOutput` against the schema of its version (v1 / v2, FR-120) so a broken prompt fails fast at boot, not per post (BR-023).
 */
export type PromptExample = {
  input: { text: string; matchedTerms: string[]; username?: string };
  output: ClassifierOutput;
};
export type ClassifierPrompt = { version: string; system: string; userTemplate: string; examples: PromptExample[] };
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const ExampleInputSchema = z.object({
  text: z.string(),
  matchedTerms: z.array(z.string()),
  username: z.string().optional(),
});

const cache = new Map<string, ClassifierPrompt>();

export function loadPrompt(version: string, dir: string = __dirname): ClassifierPrompt {
  const key = join(dir, `${version}.md`);
  const cached = cache.get(key);
  if (cached) return cached;
  const prompt = parsePrompt(version, readFileSync(key, "utf8"));
  cache.set(key, prompt);
  return prompt;
}

export function parsePrompt(version: string, source: string): ClassifierPrompt {
  const body = source.replace(/<!--[\s\S]*?-->/g, "");
  const sections = splitSections(body, /^## (\w+)\s*$/m);
  const system = sections.get("system")?.trim();
  const userTemplate = sections.get("user")?.trim();
  const examplesSrc = sections.get("examples");
  const schemaVersion = classifierSchemaVersionOf(version);
  if (!system || !userTemplate || examplesSrc === undefined)
    throw new Error(`Prompt ${version}: missing ## system / ## user / ## examples section`);

  const examples = examplesSrc
    .split(/^### example\s*$/m)
    .slice(1)
    .map((chunk, i) => {
      const parts = splitSections(chunk, /^#### (\w+)\s*$/m);
      const input = ExampleInputSchema.safeParse(readJsonBlock(parts.get("input"), version, i));
      if (!input.success) throw new Error(`Prompt ${version}: example ${i + 1} input invalid`);
      const output = parseClassifierOutput(readJsonBlock(parts.get("output"), version, i), schemaVersion);
      if (!output.ok)
        throw new Error(`Prompt ${version}: example ${i + 1} output invalid: ${output.issues.join("; ")}`);
      return { input: input.data, output: output.value };
    });
  return { version, system, userTemplate, examples };
}

/** Runtime-only corrective message (FR-113, doc 07 §5): not part of the frozen prompt file. */
export const CORRECTION_TEMPLATE =
  "Your previous response failed validation:\n{{issues}}\nReturn only JSON that matches the schema exactly and use only the labels defined in the taxonomy guide.";
const CORRECTION_MAX_ISSUES = 10;
const CORRECTION_MAX_CHARS = 500;

/** Builds chat messages: system, few-shot user/assistant pairs, the real post, then the optional correction. */
export function renderMessages(prompt: ClassifierPrompt, input: ClassifierInput): ChatMessage[] {
  const system = fill(prompt.system, {
    brand_context: input.brandContext,
    taxonomy_guide: renderTaxonomyGuide(),
  });
  const messages: ChatMessage[] = [{ role: "system", content: system }];
  for (const ex of prompt.examples) {
    messages.push({ role: "user", content: renderUser(prompt.userTemplate, { ...ex.input, brandContext: "" }) });
    messages.push({ role: "assistant", content: JSON.stringify(ex.output) });
  }
  messages.push({ role: "user", content: renderUser(prompt.userTemplate, input) });
  if (input.correction && input.correction.issues.length > 0) {
    const issues = input.correction.issues
      .slice(0, CORRECTION_MAX_ISSUES)
      .map((i) => `- ${i}`)
      .join("\n")
      .slice(0, CORRECTION_MAX_CHARS);
    messages.push({ role: "user", content: fill(CORRECTION_TEMPLATE, { issues }) });
  }
  return messages;
}

function renderUser(template: string, input: ClassifierInput): string {
  return fill(template, {
    matched_terms: input.matchedTerms.length > 0 ? input.matchedTerms.join(", ") : "(none)",
    username: input.username ?? "(unknown)",
    language_hint: input.languageHint ?? "(none)",
    // Prompt-injection guard: the post cannot close the data delimiter.
    text: input.text.replace(/<\/?post>/gi, (m) => m.replace("<", "&lt;")),
  });
}

/** Single-pass replace so placeholder-looking text inside values is never expanded again. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (m, name: string) => values[name] ?? m);
}

function splitSections(src: string, heading: RegExp): Map<string, string> {
  const re = new RegExp(heading.source, "gm");
  const out = new Map<string, string>();
  const matches = [...src.matchAll(re)];
  matches.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = matches[i + 1]?.index ?? src.length;
    out.set(String(m[1]), src.slice(start, end));
  });
  return out;
}

function readJsonBlock(chunk: string | undefined, version: string, i: number): unknown {
  const m = chunk?.match(/```json\s*([\s\S]*?)```/);
  if (!m?.[1]) throw new Error(`Prompt ${version}: example ${i + 1} missing json block`);
  return JSON.parse(m[1]) as unknown;
}
