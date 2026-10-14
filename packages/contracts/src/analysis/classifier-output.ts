import { z } from "zod";
import {
  normalizeMultiLabel,
  normalizePhrases,
  INTENT_LABELS,
  MAX_PHRASES_PER_POST,
  PHRASE_MAX_LENGTH,
  PHRASE_PROMPT_VERSIONS,
  TOPIC_LABELS,
} from "@how-about-me/taxonomy";
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
/** Frozen v1 shape (classifier-v1 / fake-v1); never gains keys — its JSON schema is sent as is to the provider. */
export const ClassifierOutputV1Schema = ClassifierOutputSchema;
export type ClassifierOutputV1 = z.infer<typeof ClassifierOutputV1Schema>;

/** v2 (classifier-v2 / fake-v2): v1 + 0–5 key phrases (FR-120, BR-041). Empty array is valid. */
export const ClassifierOutputV2Schema = ClassifierOutputSchema.extend({
  keyPhrases: z.array(z.string().max(PHRASE_MAX_LENGTH)).max(MAX_PHRASES_PER_POST),
}).strict();
export type ClassifierOutputV2 = z.infer<typeof ClassifierOutputV2Schema>;

/** Pipeline-wide output type; `keyPhrases` is undefined when the prompt version does not extract phrases. */
export type ClassifierOutput = ClassifierOutputV1 & { keyPhrases?: string[] };

export type ClassifierSchemaVersion = "v1" | "v2";

/** Maps a prompt version to its output schema version (BR-023): phrase prompts → v2, everything else → v1. */
export function classifierSchemaVersionOf(promptVersion: string): ClassifierSchemaVersion {
  return (PHRASE_PROMPT_VERSIONS as readonly string[]).includes(promptVersion) ? "v2" : "v1";
}

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
    // BR-041: only touched when present (v2); a v1 output never gains the key.
    ...(out.keyPhrases !== undefined ? { keyPhrases: normalizePhrases(out.keyPhrases) } : {}),
  };
}

export type ClassifierParseResult = { ok: true; value: ClassifierOutput } | { ok: false; issues: string[] };

const MAX_ISSUES = 10;

/**
 * Validate raw provider output (strict, unknown labels rejected — FR-119) then normalise.
 * On failure returns short `path: message` lines for the corrective retry prompt / run error_message (FR-113).
 */
export function parseClassifierOutput(raw: unknown, version: ClassifierSchemaVersion = "v1"): ClassifierParseResult {
  const r = (version === "v2" ? ClassifierOutputV2Schema : ClassifierOutputV1Schema).safeParse(raw);
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

/** JSON Schema for the v2 output (`keyPhrases` added). The v1 schema above stays byte-identical. */
export const ClassifierOutputJsonSchemaV2 = z.toJSONSchema(ClassifierOutputV2Schema, { target: "draft-2020-12" });
