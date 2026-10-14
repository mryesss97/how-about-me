import {
  IntentLabelSchema,
  LanguageCodeSchema,
  RelevanceLabelSchema,
  SafetyLevelSchema,
  SentimentLabelSchema,
  TopicLabelSchema,
} from "@how-about-me/contracts";
import { z } from "zod";

/**
 * Labelled evaluation record — docs/04-qa/03-ai-evaluation-plan.md §1 (T-079).
 * Local to the CLI on purpose: the dataset never crosses the API boundary.
 */
export const EvalItemSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  matchedTerms: z.array(z.string()).default([]),
  labels: z.object({
    relevance: RelevanceLabelSchema,
    sentiment: SentimentLabelSchema.optional(),
    intents: z.array(IntentLabelSchema).min(1).optional(),
    topics: z.array(TopicLabelSchema).min(1).optional(),
    language: LanguageCodeSchema.optional(),
    safetyLevel: SafetyLevelSchema,
    /** Gold key phrases (FR-120); compared after BR-041 normalisation. Informational, not a freeze gate. */
    keyPhrases: z.array(z.string()).max(5).optional(),
  }),
  notes: z.string().optional(),
  labeler: z.string().optional(),
  secondLabeler: z.string().optional(),
  agreed: z.boolean().optional(),
  /** Optional grouping for extra report breakdowns (decision 2026-10-13); subsets default to label-derived. */
  tags: z.array(z.string()).optional(),
});
export type EvalItem = z.infer<typeof EvalItemSchema>;

export class DatasetError extends Error {}

/** Parses JSONL. Blank lines are skipped; any invalid line throws with its line number (and id when known). */
export function parseDataset(jsonl: string): EvalItem[] {
  const items: EvalItem[] = [];
  const seen = new Set<string>();
  const lines = jsonl.split(/\r?\n/);
  for (const [index, raw] of lines.entries()) {
    const lineNo = index + 1;
    if (raw.trim() === "") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new DatasetError(`line ${lineNo}: invalid JSON`);
    }
    const r = EvalItemSchema.safeParse(parsed);
    if (!r.success) {
      const id = idOf(parsed);
      const issues = r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
      throw new DatasetError(`line ${lineNo}${id ? ` (id ${id})` : ""}: ${issues}`);
    }
    if (seen.has(r.data.id)) throw new DatasetError(`line ${lineNo}: duplicate id ${r.data.id}`);
    seen.add(r.data.id);
    items.push(r.data);
  }
  if (items.length === 0) throw new DatasetError("dataset is empty");
  return items;
}

function idOf(v: unknown): string | null {
  if (typeof v === "object" && v !== null && "id" in v && typeof v.id === "string") return v.id;
  return null;
}
