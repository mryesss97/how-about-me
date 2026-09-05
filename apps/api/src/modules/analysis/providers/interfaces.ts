import type { ClassifierOutput } from "@how-about-me/contracts";

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
