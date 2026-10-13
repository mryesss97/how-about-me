import { z } from "zod";
import { normalizeMultiLabel, INTENT_LABELS, TOPIC_LABELS } from "@how-about-me/taxonomy";
import {
  IntentLabelSchema,
  LanguageCodeSchema,
  RelevanceLabelSchema,
  SentimentLabelSchema,
  TopicLabelSchema,
} from "../enums.js";

const Confidence = z.number().min(0).max(1);

/** Strict structured-output contract for the classifier — docs/02-architecture/07-analysis-pipeline.md §4. */
export const ClassifierOutputSchema = z
  .object({
    relevance: z
      .object({ label: RelevanceLabelSchema, confidence: Confidence, explanation: z.string().max(200) })
      .strict(),
    sentiment: z.object({ label: SentimentLabelSchema, confidence: Confidence }).strict(),
    intents: z
      .array(z.object({ label: IntentLabelSchema, confidence: Confidence }).strict())
      .min(1)
      .max(4),
    topics: z
      .array(z.object({ label: TopicLabelSchema, confidence: Confidence }).strict())
      .min(1)
      .max(4),
    language: LanguageCodeSchema,
    summary: z.string().max(240),
  })
  .strict();
export type ClassifierOutput = z.infer<typeof ClassifierOutputSchema>;

/** Clamp to [0,1]; non-finite (NaN/Infinity) becomes 0. Defensive only — schema already enforces range. */
function clampConfidence(c: number): number {
  return Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0;
}

/**
 * Post-validation normalisation (docs/02-architecture/07-analysis-pipeline.md §4, FR-119).
 * Order: parse with `ClassifierOutputSchema` first, then normalise (see `parseClassifierOutput`).
 * - `other` is dropped when any other label is present (exclusivity).
 * - Duplicate labels collapse to one entry keeping the highest confidence; label order follows model output.
 * - Confidence clamped to [0,1]; summary/explanation trimmed.
 */
export function normalizeClassifierOutput(out: ClassifierOutput): ClassifierOutput {
  const dedupe = <L extends string>(items: { label: L; confidence: number }[], allowed: readonly L[]) => {
    const best = new Map<L, number>();
    for (const i of items) best.set(i.label, Math.max(best.get(i.label) ?? 0, clampConfidence(i.confidence)));
    const labels = normalizeMultiLabel([...best.keys()], allowed);
    return labels.map((label) => ({ label, confidence: best.get(label) ?? 0 }));
  };
  return {
    ...out,
    intents: dedupe(out.intents, INTENT_LABELS),
    topics: dedupe(out.topics, TOPIC_LABELS),
    summary: out.summary.trim(),
    relevance: {
      ...out.relevance,
      confidence: clampConfidence(out.relevance.confidence),
      explanation: out.relevance.explanation.trim(),
    },
    sentiment: { ...out.sentiment, confidence: clampConfidence(out.sentiment.confidence) },
  };
}

export type ClassifierParseResult = { ok: true; value: ClassifierOutput } | { ok: false; issues: string[] };

const MAX_ISSUES = 10;

/**
 * Validate raw provider output (strict, unknown labels rejected — FR-119) then normalise.
 * On failure returns short `path: message` lines for the corrective retry prompt / run error_message (FR-113).
 */
export function parseClassifierOutput(raw: unknown): ClassifierParseResult {
  const r = ClassifierOutputSchema.safeParse(raw);
  if (!r.success) {
    const issues = r.error.issues
      .slice(0, MAX_ISSUES)
      .map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`);
    return { ok: false, issues };
  }
  return { ok: true, value: normalizeClassifierOutput(r.data) };
}

/**
 * JSON Schema (draft 2020-12) for providers supporting strict structured outputs.
 * Includes a top-level `$schema` key; provider adapters (e.g. OpenAI strict mode) may strip it.
 */
export const ClassifierOutputJsonSchema = z.toJSONSchema(ClassifierOutputSchema, { target: "draft-2020-12" });
