import type { Prisma } from "@prisma/client";
import { SAFETY_POLICY_V1 } from "@how-about-me/taxonomy";
import type { AuditService } from "../../audit/audit.service";
import type { AnalysisService } from "../analysis.service";
import type { AnalysisSettingRow, AnalysisSettingsRepository } from "./analysis-settings.repository";
import { AnalysisSettingsService } from "./analysis-settings.service";

const PID = "00000000-0000-7000-8000-000000000001";
const ACTOR = "00000000-0000-7000-8000-000000000002";
const ROW_ID = "00000000-0000-7000-8000-000000000003";

function setup(active: AnalysisSettingRow | null = null) {
  const tx = {} as Prisma.TransactionClient;
  const repo = {
    lockProject: jest.fn().mockResolvedValue(true),
    findActive: jest.fn().mockResolvedValue(active),
    countOutdated: jest.fn().mockResolvedValue(3),
    create: jest.fn(
      async (data: {
        version: number;
        policyVersion: string;
        confidenceBands: unknown;
        safetyThresholds: unknown;
      }) => ({
        id: ROW_ID,
        projectId: PID,
        ...data,
        createdAt: new Date("2026-10-13T00:00:00Z"),
        creator: { id: ACTOR, displayName: "Admin", email: "a@x.io" },
      }),
    ),
    transaction: jest.fn((fn: (t: Prisma.TransactionClient) => Promise<unknown>) => fn(tx)),
  };
  const analysis = {
    runVersions: jest.fn((v: string) => ({
      classifierProvider: "fake",
      classifierModel: "m",
      promptVersion: "classifier-v1",
      taxonomyVersion: "taxonomy-v1",
      safetyProvider: "fake",
      safetyModel: "s",
      safetyPolicyVersion: v,
    })),
    effectiveVersionOf: jest.fn((v: string) => `fake|m|classifier-v1|taxonomy-v1|fake|s|${v}`),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const svc = new AnalysisSettingsService(
    repo as unknown as AnalysisSettingsRepository,
    analysis as unknown as AnalysisService,
    audit as unknown as AuditService,
  );
  return { svc, repo, audit, tx };
}

/** FR-190 / FR-200 — PATCH /projects/:projectId/settings/analysis (T-151). */
describe("AnalysisSettingsService", () => {
  it("GET without rows → safety-policy-v1 default (BR-018, BR-021)", async () => {
    const { svc } = setup();
    await expect(svc.get(PID)).resolves.toMatchObject({
      policyVersion: "safety-policy-v1",
      version: 1,
      isDefault: true,
      confidenceBands: { high: 0.8, medium: 0.6 },
      safetyThresholds: SAFETY_POLICY_V1,
      outdatedCount: 3,
      createdBy: null,
    });
  });

  it("TC-REV-010 / FR-200: a change creates version n+1 and audits changes + effectiveVersion in the tx", async () => {
    const { svc, repo, audit, tx } = setup();
    const out = await svc.update(PID, { safetyThresholds: { hate: { sensitive: 0.4, severe: 0.7 } } }, ACTOR, "req-1");
    expect(out).toMatchObject({ policyVersion: "safety-policy-v2", version: 2, isDefault: false });
    expect(out.effectiveVersion.endsWith("|safety-policy-v2")).toBe(true);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: PID, version: 2, policyVersion: "safety-policy-v2", createdBy: ACTOR }),
      tx,
    );
    expect(audit.record).toHaveBeenCalledWith(
      {
        projectId: PID,
        actorUserId: ACTOR,
        action: "analysis_settings.updated",
        entityType: "analysis_settings",
        entityId: ROW_ID,
        metadata: {
          changes: { "safetyThresholds.hate.severe": { from: 0.8, to: 0.7 } },
          effectiveVersion: out.effectiveVersion,
        },
        requestId: "req-1",
      },
      tx,
    );
  });

  it("no-op → no new version, no audit", async () => {
    const { svc, repo, audit } = setup();
    const out = await svc.update(PID, { confidenceBands: { high: 0.8, medium: 0.6 } }, ACTOR, null);
    expect(out.policyVersion).toBe("safety-policy-v1");
    expect(repo.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("BR-018: merged policy is re-validated → VALIDATION_ERROR with body paths", async () => {
    const { svc, repo } = setup();
    await expect(
      svc.update(PID, { safetyThresholds: { hate: { sensitive: 0.9, severe: 0.5 } } }, ACTOR, null),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: { issues: [expect.objectContaining({ path: "safetyThresholds.hate.sensitive" })] },
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("unknown project → NOT_FOUND", async () => {
    const { svc, repo } = setup();
    repo.lockProject.mockResolvedValueOnce(false);
    await expect(svc.update(PID, { confidenceBands: { high: 0.9, medium: 0.6 } }, ACTOR, null)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
