import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { DEFAULT_ANALYSIS_POLICY, type AnalysisPolicy } from "@how-about-me/taxonomy";
import { toAnalysisPolicy } from "./analysis-policy";
import { AnalysisSettingsRepository } from "./analysis-settings.repository";

/**
 * Resolves the analysis policy of a project for enqueue and the pipeline (FR-190, BR-018, BR-021, BR-023).
 * `active` always reads the DB (API and worker may run in different processes); `byPolicyVersion` caches
 * because a stored version is immutable.
 */
@Injectable()
export class AnalysisPolicyService {
  private readonly cache = new Map<string, AnalysisPolicy>();

  constructor(private readonly repo: AnalysisSettingsRepository) {}

  async active(projectId: string, tx?: Prisma.TransactionClient): Promise<AnalysisPolicy> {
    return toAnalysisPolicy(await this.repo.findActive(projectId, tx));
  }

  /** Policy recorded in a run's effective_version. `safety-policy-v1` is always the taxonomy default. */
  async byPolicyVersion(projectId: string, policyVersion: string): Promise<AnalysisPolicy> {
    if (policyVersion === DEFAULT_ANALYSIS_POLICY.policyVersion) return DEFAULT_ANALYSIS_POLICY;
    const key = `${projectId}|${policyVersion}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const row = await this.repo.findByPolicyVersion(projectId, policyVersion);
    if (!row) throw new Error(`unknown analysis policy version ${policyVersion}`);
    const policy = toAnalysisPolicy(row);
    this.cache.set(key, policy);
    return policy;
  }

  /** Policy versions currently active in any project, including the v1 default. */
  async activePolicyVersions(): Promise<Set<string>> {
    const rows = await this.repo.activePolicyVersions();
    return new Set([DEFAULT_ANALYSIS_POLICY.policyVersion, ...rows.map((r) => r.policyVersion)]);
  }
}
