import { Injectable } from "@nestjs/common";
import type { AnalysisSettings, UpdateAnalysisSettingsBody } from "@how-about-me/contracts";
import { SafetyThresholdsSchema, ConfidenceBandsSchema } from "@how-about-me/contracts";
import { safetyPolicyVersionOf, type AnalysisPolicy } from "@how-about-me/taxonomy";
import type { Prisma } from "@prisma/client";
import { AppError } from "../../../common/errors/app.error";
import { AuditService } from "../../audit/audit.service";
import { AnalysisService } from "../analysis.service";
import { diffPolicy, mergePolicy, toAnalysisPolicy } from "./analysis-policy";
import { toAnalysisSettings } from "./analysis-settings.mapper";
import { type AnalysisSettingRow, AnalysisSettingsRepository } from "./analysis-settings.repository";

type Issue = { path: string; message: string; code: string };

/** Re-validates the merged policy (BR-018, BR-021); issue paths match the PATCH body. */
function validateMerged(merged: Pick<AnalysisPolicy, "confidenceBands" | "safetyThresholds">): void {
  const issues: Issue[] = [];
  const bands = ConfidenceBandsSchema.safeParse(merged.confidenceBands);
  if (!bands.success) {
    issues.push(
      ...bands.error.issues.map((i) => ({
        path: ["confidenceBands", ...i.path].join("."),
        message: i.message,
        code: i.code,
      })),
    );
  }
  const thresholds = SafetyThresholdsSchema.safeParse(merged.safetyThresholds);
  if (!thresholds.success) {
    issues.push(
      ...thresholds.error.issues.map((i) => ({
        path: ["safetyThresholds", ...i.path].join("."),
        message: i.message,
        code: i.code,
      })),
    );
  }
  if (issues.length > 0) throw new AppError("VALIDATION_ERROR", "Validation failed", { issues });
}

/**
 * Analysis settings (FR-190): per-project confidence bands + safety thresholds, append-only versions
 * `safety-policy-v{n}`. Every change creates a new version and is audited in the same transaction (FR-200).
 * No re-analysis is triggered here; that is optional and done via T-145 (FR-196).
 */
@Injectable()
export class AnalysisSettingsService {
  constructor(
    private readonly repo: AnalysisSettingsRepository,
    private readonly analysis: AnalysisService,
    private readonly audit: AuditService,
  ) {}

  async get(projectId: string): Promise<AnalysisSettings> {
    return this.build(projectId, await this.repo.findActive(projectId));
  }

  update(
    projectId: string,
    body: UpdateAnalysisSettingsBody,
    actorUserId: string,
    requestId: string | null,
  ): Promise<AnalysisSettings> {
    return this.repo.transaction(async (tx) => {
      // Serialize concurrent admins so `version + 1` never hits the unique index.
      if (!(await this.repo.lockProject(projectId, tx))) throw AppError.notFound("Project");
      const currentRow = await this.repo.findActive(projectId, tx);
      const current = toAnalysisPolicy(currentRow);
      const merged = mergePolicy(current, body);
      validateMerged(merged);
      const changes = diffPolicy(current, merged);
      // No-op → no new version, no audit (same as PATCH /projects).
      if (Object.keys(changes).length === 0) return this.build(projectId, currentRow, tx);

      const version = current.version + 1;
      const row = await this.repo.create(
        {
          projectId,
          version,
          policyVersion: safetyPolicyVersionOf(version),
          confidenceBands: merged.confidenceBands,
          safetyThresholds: merged.safetyThresholds,
          createdBy: actorUserId,
        },
        tx,
      );
      const dto = await this.build(projectId, row, tx);
      await this.audit.record(
        {
          projectId,
          actorUserId,
          action: "analysis_settings.updated",
          entityType: "analysis_settings",
          entityId: row.id,
          metadata: { changes, effectiveVersion: dto.effectiveVersion },
          requestId,
        },
        tx,
      );
      return dto;
    });
  }

  private async build(
    projectId: string,
    row: AnalysisSettingRow | null,
    tx?: Prisma.TransactionClient,
  ): Promise<AnalysisSettings> {
    const policy = toAnalysisPolicy(row);
    const versions = this.analysis.runVersions(policy.policyVersion);
    return toAnalysisSettings(policy, row, {
      versions,
      effectiveVersion: this.analysis.effectiveVersionOf(policy.policyVersion),
      outdatedCount: await this.repo.countOutdated(projectId, policy.policyVersion, tx),
    });
  }
}
