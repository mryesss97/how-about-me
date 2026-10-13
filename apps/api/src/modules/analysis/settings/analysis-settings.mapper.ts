import type { AnalysisSettings } from "@how-about-me/contracts";
import type { AnalysisPolicy } from "@how-about-me/taxonomy";
import type { RunVersions } from "../analysis.service";
import type { AnalysisSettingRow } from "./analysis-settings.repository";

/** Active policy (+ its row when not default) → `AnalysisSettings` DTO (FR-190). */
export function toAnalysisSettings(
  policy: AnalysisPolicy,
  row: AnalysisSettingRow | null,
  extra: { versions: RunVersions; effectiveVersion: string; outdatedCount: number },
): AnalysisSettings {
  return {
    policyVersion: policy.policyVersion,
    version: policy.version,
    isDefault: row === null,
    confidenceBands: { ...policy.confidenceBands },
    safetyThresholds: { ...policy.safetyThresholds },
    versions: { ...extra.versions },
    effectiveVersion: extra.effectiveVersion,
    outdatedCount: extra.outdatedCount,
    createdAt: row ? row.createdAt.toISOString() : null,
    createdBy: row?.creator
      ? { id: row.creator.id, displayName: row.creator.displayName, email: row.creator.email }
      : null,
  };
}
