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

/** Post-validation normalisation: `other` exclusivity, de-duplication (keeps highest confidence), clamping. */
export function normalizeClassifierOutput(out: ClassifierOutput): ClassifierOutput {
  const dedupe = <L extends string>(items: { label: L; confidence: number }[], allowed: readonly L[]) => {
    const best = new Map<L, number>();
    for (const i of items) best.set(i.label, Math.max(best.get(i.label) ?? 0, Math.min(1, Math.max(0, i.confidence))));
    const labels = normalizeMultiLabel([...best.keys()], allowed);
    return labels.map((label) => ({ label, confidence: best.get(label) ?? 0 }));
  };
  return {
    ...out,
    intents: dedupe(out.intents, INTENT_LABELS),
    topics: dedupe(out.topics, TOPIC_LABELS),
    summary: out.summary.trim(),
    relevance: { ...out.relevance, explanation: out.relevance.explanation.trim() },
  };
}

/** JSON Schema (draft 2020-12) for providers supporting strict structured outputs. */
export const ClassifierOutputJsonSchema = z.toJSONSchema(ClassifierOutputSchema, { target: "draft-2020-12" });
