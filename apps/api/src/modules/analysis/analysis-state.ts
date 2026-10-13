import type { AnalysisStatus } from "@how-about-me/contracts";
import { AppError } from "../../common/errors/app.error";

/**
 * Analysis run state machine — docs/02-architecture/07-analysis-pipeline.md §1 (FR-100).
 * `pending → stale` covers FR-078 (content changed before the run was claimed).
 */
export const ANALYSIS_TRANSITIONS: Readonly<Record<AnalysisStatus, readonly AnalysisStatus[]>> = {
  pending: ["processing", "stale"],
  processing: ["completed", "skipped", "failed", "pending"],
  completed: ["stale"],
  failed: ["pending"],
  skipped: [],
  stale: [],
};

export function canTransition(from: AnalysisStatus, to: AnalysisStatus): boolean {
  return ANALYSIS_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: AnalysisStatus, to: AnalysisStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError("INTERNAL", `Invalid analysis run transition ${from} → ${to}`);
  }
}
