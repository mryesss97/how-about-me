import type { ClassifierOutput } from "@how-about-me/contracts";
import type { ConfidenceBands } from "@how-about-me/taxonomy";

/** AI provider contracts — docs/02-architecture/07-analysis-pipeline.md §3 (ADR-0007). Implemented in T-071/T-072 (real) and T-013 (fake). */
export type AnalysisContext = { requestId: string; projectId: string; runId: string };
export type Usage = { inputTokens: number; outputTokens: number; estimatedCostUsd: number };

export interface SafetyProvider {
  readonly name: string;
  readonly model: string;
  moderate(input: { text: string }, ctx: AnalysisContext): Promise<SafetyProviderResult>;
}
export type SafetyProviderResult = {
  flagged: boolean;
  categoryScores: Record<string, number>;
  categories: Record<string, boolean>;
  raw?: unknown;
};

export type ClassifierInput = {
  text: string;
  username?: string;
  matchedTerms: string[];
  brandContext: string;
  languageHint?: string;
  /** Set only on the corrective retry (FR-113): validation issues (`path: message`) of the previous output. */
  correction?: { issues: string[] };
  /** Project policy bands for BR-021 banding (FR-190). Never sent to the model; absent → v1 defaults. */
  confidenceBands?: ConfidenceBands;
};
export interface ContentClassifier {
  readonly provider: string;
  readonly model: string;
  readonly promptVersion: string;
  relevance(
    input: ClassifierInput,
    ctx: AnalysisContext,
  ): Promise<Pick<ClassifierOutput, "relevance"> & { language?: ClassifierOutput["language"]; usage: Usage }>;
  classify(input: ClassifierInput, ctx: AnalysisContext): Promise<ClassifierOutput & { usage: Usage }>;
}

export const SAFETY_PROVIDER = Symbol("SAFETY_PROVIDER");
export const CONTENT_CLASSIFIER = Symbol("CONTENT_CLASSIFIER");
