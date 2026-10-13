import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import { PrismaService } from "../../../database/prisma.service";

type Db = Prisma.TransactionClient;

const ROW_SELECT = {
  id: true,
  projectId: true,
  version: true,
  policyVersion: true,
  confidenceBands: true,
  safetyThresholds: true,
  createdAt: true,
  creator: { select: { id: true, displayName: true, email: true } },
} satisfies Prisma.AnalysisSettingSelect;

export type AnalysisSettingRow = Prisma.AnalysisSettingGetPayload<{ select: typeof ROW_SELECT }>;

export type CreateAnalysisSettingData = {
  projectId: string;
  version: number;
  policyVersion: string;
  confidenceBands: Prisma.InputJsonValue;
  safetyThresholds: Prisma.InputJsonValue;
  createdBy: string | null;
};

/** Data access for `analysis_settings` (FR-190). Append-only: no update/delete on purpose (BR-003 spirit). */
@Injectable()
export class AnalysisSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Active policy row = highest version; null → v1 defaults. */
  findActive(projectId: string, tx?: Db): Promise<AnalysisSettingRow | null> {
    return (tx ?? this.prisma).analysisSetting.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
      select: ROW_SELECT,
    });
  }

  findByPolicyVersion(projectId: string, policyVersion: string): Promise<AnalysisSettingRow | null> {
    return this.prisma.analysisSetting.findUnique({
      where: { projectId_policyVersion: { projectId, policyVersion } },
      select: ROW_SELECT,
    });
  }

  /** Distinct `policy_version`s that are active somewhere (latest row per project). */
  async activePolicyVersions(): Promise<{ projectId: string; policyVersion: string }[]> {
    return this.prisma.$queryRaw<{ projectId: string; policyVersion: string }[]>(Prisma.sql`
      SELECT DISTINCT ON (project_id) project_id AS "projectId", policy_version AS "policyVersion"
      FROM analysis_settings ORDER BY project_id, version DESC`);
  }

  create(data: CreateAnalysisSettingData, tx: Db): Promise<AnalysisSettingRow> {
    return tx.analysisSetting.create({ data: { id: uuidv7(), ...data }, select: ROW_SELECT });
  }

  /** Serializes concurrent PATCHes of the same project so `version + 1` never collides. */
  async lockProject(projectId: string, tx: Db): Promise<boolean> {
    const rows = await tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM monitoring_projects WHERE id = ${projectId}::uuid FOR UPDATE`,
    );
    return rows.length > 0;
  }

  /** Posts whose current analysis was produced under another policy version (re-analysis candidates). */
  async countOutdated(projectId: string, policyVersion: string, tx?: Db): Promise<number> {
    const rows = await (tx ?? this.prisma).$queryRaw<{ n: number }[]>(Prisma.sql`
      SELECT count(DISTINCT p.id)::int AS n
      FROM social_posts p
      JOIN post_analyses a ON a.id = p.current_analysis_id
      JOIN analysis_runs r ON r.id = a.analysis_run_id
      WHERE p.project_id = ${projectId}::uuid AND r.safety_policy_version IS DISTINCT FROM ${policyVersion}`);
    return rows[0]?.n ?? 0;
  }

  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
