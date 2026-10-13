import { mapSafetyLevel, type SafetyLevel } from "@how-about-me/taxonomy";
import type { SafetyProviderResult } from "../providers/interfaces";

export type SafetyAnalysis = {
  safetyFlagged: boolean;
  safetyLevel: SafetyLevel;
  safetyPolicyVersion: string;
  safetyCategoryScores: {
    scores: Record<string, number>;
    triggered: { category: string; score: number; level: "sensitive" | "severe" }[];
  };
};

/**
 * Provider result → persisted safety fields of `post_analyses` (doc 07 §6, FR-104/FR-105).
 * Applies safety policy v1 (BR-018). Takes no sentiment input on purpose: safety ≠ sentiment (BR-017).
 * Used by T-074 when writing analyses.
 */
export function toSafetyAnalysis(result: SafetyProviderResult): SafetyAnalysis {
  const mapped = mapSafetyLevel({ categoryScores: result.categoryScores, flagged: result.flagged });
  return {
    safetyFlagged: result.flagged,
    safetyLevel: mapped.level,
    safetyPolicyVersion: mapped.policyVersion,
    safetyCategoryScores: { scores: { ...result.categoryScores }, triggered: mapped.triggered },
  };
}
