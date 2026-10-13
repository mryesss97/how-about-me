import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { SAFETY_POLICY_V1 } from "@how-about-me/taxonomy";
import request from "supertest";
import type { PrismaService } from "../../src/database/prisma.service";
import { AnalysisPipelineService } from "../../src/modules/analysis/analysis-pipeline.service";
import { AnalysisService } from "../../src/modules/analysis/analysis.service";
import { SAFETY_PROVIDER, type SafetyProvider } from "../../src/modules/analysis/providers/interfaces";
import { IngestionService, type IngestionQuery } from "../../src/modules/collector/ingestion.service";
import { normalizeItem, type NormalizedPost } from "../../src/modules/collector/post-normalizer";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";

function post(id: string, text = "1zone concert xịn quá, vé đáng tiền"): NormalizedPost {
  const r = normalizeItem({ id, text, timestamp: "2026-10-01T10:00:00+0000", username: "u" });
  if (!r.ok) throw new Error("fixture invalid");
  return r.post;
}

type Who = "admin" | "analyst" | "viewer" | "outsider";
const HATE_V2 = { safetyThresholds: { hate: { sensitive: 0.4, severe: 0.7 } } };

/** T-151: analysis settings — FR-190, FR-200, FR-015, BR-018, BR-021, BR-023, BR-024; TC-REV-010 (part A). */
describe("Analysis settings (T-151)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let svc: AnalysisService;
  let p1: string;
  let p2: string;
  let q: IngestionQuery;
  const users = {} as Record<Who, { id: string; token: string }>;
  const http = () => request(app.getHttpServer());
  const auth = (who: Who) => ({ authorization: `Bearer ${users[who].token}` });
  const url = (pid: string) => `/api/v1/projects/${pid}/settings/analysis`;
  const patch = (body: unknown, who: Who = "admin", pid = p1) =>
    http()
      .patch(url(pid))
      .set(auth(who))
      .send(body as object);

  /** Claims every pending run and processes it with the bound pipeline (fake classifier). */
  async function drain(): Promise<void> {
    const pipeline = app.get(AnalysisPipelineService);
    for (const r of await svc.claimBatch("w-settings", 50)) await pipeline.process(r);
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    svc = app.get(AnalysisService);
  });
  beforeEach(async () => {
    await resetDb(prisma);
    jest.restoreAllMocks();
    p1 = randomUUID();
    p2 = randomUUID();
    await prisma.monitoringProject.create({ data: { id: p1, name: "P1", slug: `p1-${p1}` } });
    await prisma.monitoringProject.create({ data: { id: p2, name: "P2", slug: `p2-${p2}` } });
    for (const who of ["admin", "analyst", "viewer", "outsider"] as const) {
      const id = randomUUID();
      const email = `${who}@example.com`;
      await prisma.userProfile.create({ data: { id, email } });
      await prisma.projectMember.create({
        data: { projectId: who === "outsider" ? p2 : p1, userId: id, role: who === "outsider" ? "admin" : who },
      });
      users[who] = { id, token: await mintTestJwt({ sub: id, email }) };
    }
    const qid = randomUUID();
    await prisma.listeningQuery.create({
      data: {
        id: qid,
        projectId: p1,
        displayName: "1zone",
        queryValue: "1zone",
        queryType: "keyword",
        searchMode: "KEYWORD",
      },
    });
    q = { id: qid, projectId: p1, platform: "threads", includeTerms: [], excludeTerms: [] };
    // hate 0.75: sensitive under v1 (severe ≥ 0.8), severe under v2 (severe ≥ 0.7).
    jest
      .spyOn(app.get<SafetyProvider>(SAFETY_PROVIDER), "moderate")
      .mockResolvedValue({ flagged: false, categoryScores: { hate: 0.75 }, categories: { hate: false } });
  });
  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  it("FR-190 / BR-018 / BR-021: GET without rows → safety-policy-v1 defaults", async () => {
    const res = await http().get(url(p1)).set(auth("viewer"));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      policyVersion: "safety-policy-v1",
      version: 1,
      isDefault: true,
      confidenceBands: { high: 0.8, medium: 0.6 },
      safetyThresholds: SAFETY_POLICY_V1,
      outdatedCount: 0,
      createdAt: null,
      createdBy: null,
    });
    expect(res.body.effectiveVersion).toMatch(/\|safety-policy-v1$/);
  });

  it("TC-REV-010 / FR-200: admin PATCH → safety-policy-v2 row + audit in the same request", async () => {
    const res = await patch(HATE_V2);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ policyVersion: "safety-policy-v2", version: 2, isDefault: false });
    expect(res.body.safetyThresholds.hate).toEqual({ sensitive: 0.4, severe: 0.7 });
    expect(res.body.createdBy).toMatchObject({ id: users.admin.id, email: "admin@example.com" });
    const rows = await prisma.analysisSetting.findMany({ where: { projectId: p1 } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ version: 2, policyVersion: "safety-policy-v2", createdBy: users.admin.id });
    const logs = await prisma.auditLog.findMany({ where: { projectId: p1, action: "analysis_settings.updated" } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorUserId: users.admin.id,
      entityType: "analysis_settings",
      entityId: rows[0]?.id,
    });
    expect(logs[0]?.metadata).toEqual({
      changes: { "safetyThresholds.hate.severe": { from: 0.8, to: 0.7 } },
      effectiveVersion: res.body.effectiveVersion,
    });
    expect(res.body.effectiveVersion).toMatch(/\|safety-policy-v2$/);
  });

  it("TC-REV-010: new runs use the new policy (effective_version, safety level, stamped version)", async () => {
    await patch(HATE_V2).expect(200);
    await app.get(IngestionService).ingestPage(q, [post("a")]);
    const [pending] = await prisma.analysisRun.findMany();
    expect(pending?.effectiveVersion).toMatch(/\|safety-policy-v2$/);
    await drain();
    const run = await prisma.analysisRun.findFirstOrThrow();
    expect(run).toMatchObject({ status: "completed", safetyPolicyVersion: "safety-policy-v2" });
    const analysis = await prisma.postAnalysis.findFirstOrThrow();
    expect(analysis.safetyLevel).toBe("severe");
  });

  it("BR-023: a run enqueued before the change is processed with the policy in its effective_version", async () => {
    await app.get(IngestionService).ingestPage(q, [post("a")]);
    await patch(HATE_V2).expect(200);
    await drain();
    const run = await prisma.analysisRun.findFirstOrThrow();
    expect(run.effectiveVersion).toMatch(/\|safety-policy-v1$/);
    expect(run).toMatchObject({ status: "completed", safetyPolicyVersion: "safety-policy-v1" });
    expect((await prisma.postAnalysis.findFirstOrThrow()).safetyLevel).toBe("sensitive");
  });

  it("BR-023 / BR-024: a v1-completed post gets a new run after the change; a second open run is still blocked", async () => {
    await app.get(IngestionService).ingestPage(q, [post("a")]);
    await drain();
    await patch(HATE_V2).expect(200);
    const p = await prisma.socialPost.findFirstOrThrow();
    const input = {
      postId: p.id,
      projectId: p1,
      contentHash: p.contentHash,
      revision: p.revision,
      trigger: "ingest" as const,
    };
    const first = await prisma.$transaction((tx) => svc.enqueueDetailed(tx, input));
    expect(first).toMatchObject({ created: true, effectiveVersion: expect.stringMatching(/\|safety-policy-v2$/) });
    const second = await prisma.$transaction((tx) => svc.enqueueDetailed(tx, input));
    expect(second).toEqual({ created: false, reason: "already_open" });
  });

  it("FR-190: outdatedCount counts posts whose current analysis used another policy", async () => {
    await app.get(IngestionService).ingestPage(q, [post("a"), post("b", "1zone vé đắt quá")]);
    await drain();
    const res = await patch(HATE_V2).expect(200);
    expect(res.body.outdatedCount).toBe(2);
  });

  it("no-op PATCH → 200, no new version, no audit", async () => {
    const res = await patch({ confidenceBands: { high: 0.8, medium: 0.6 } });
    expect(res.status).toBe(200);
    expect(res.body.policyVersion).toBe("safety-policy-v1");
    expect(await prisma.analysisSetting.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "analysis_settings.updated" } })).toBe(0);
  });

  it.each([
    ["medium ≥ high (BR-021)", { confidenceBands: { high: 0.6, medium: 0.6 } }],
    ["sensitive ≥ severe (BR-018)", { safetyThresholds: { hate: { sensitive: 0.9, severe: 0.5 } } }],
    ["both null (BR-018)", { safetyThresholds: { hate: { sensitive: null, severe: null } } }],
    ["unknown category", { safetyThresholds: { spam: { sensitive: 0.5, severe: null } } }],
    ["out of range", { confidenceBands: { high: 1.5, medium: 0.6 } }],
    ["empty body", {}],
  ])("400 VALIDATION_ERROR: %s", async (_name, body) => {
    const res = await patch(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.analysisSetting.count()).toBe(0);
  });

  it("FR-015: analyst/viewer PATCH → 403 FORBIDDEN_ROLE; outsider → FORBIDDEN_PROJECT; members can GET", async () => {
    for (const who of ["analyst", "viewer"] as const) {
      const res = await patch(HATE_V2, who);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
      expect((await http().get(url(p1)).set(auth(who))).status).toBe(200);
    }
    const out = await patch(HATE_V2, "outsider");
    expect(out.body.error.code).toBe("FORBIDDEN_PROJECT");
    expect((await http().get(url(p1)).set(auth("outsider"))).body.error.code).toBe("FORBIDDEN_PROJECT");
    expect(await prisma.analysisSetting.count()).toBe(0);
  });

  it("concurrent PATCHes serialize into v2 and v3 (no 500)", async () => {
    const [a, b] = await Promise.all([
      patch({ confidenceBands: { high: 0.9, medium: 0.6 } }),
      patch({ confidenceBands: { high: 0.85, medium: 0.5 } }),
    ]);
    expect([a?.status, b?.status]).toEqual([200, 200]);
    const versions = (await prisma.analysisSetting.findMany({ orderBy: { version: "asc" } })).map(
      (r) => r.policyVersion,
    );
    expect(versions).toEqual(["safety-policy-v2", "safety-policy-v3"]);
  });

  it("FR-190: policies are per project — p2 stays on v1", async () => {
    await patch(HATE_V2).expect(200);
    const res = await http().get(url(p2)).set(auth("outsider"));
    expect(res.body).toMatchObject({ policyVersion: "safety-policy-v1", isDefault: true });
    expect(await svc.effectiveVersionFor(p2)).toMatch(/\|safety-policy-v1$/);
  });

  it("BR-023: markVersionStale refuses a project's current version and stales the old one", async () => {
    await app.get(IngestionService).ingestPage(q, [post("a")]);
    await drain();
    const v1 = await svc.effectiveVersionFor(p1);
    await patch(HATE_V2).expect(200);
    const v2 = await svc.effectiveVersionFor(p1);
    await expect(svc.markVersionStale(v2, { projectId: p1 })).rejects.toThrow(/current effective_version/);
    // v1 is still the default for p2, so a global call is refused too.
    await expect(svc.markVersionStale(v1)).rejects.toThrow(/current effective_version/);
    await expect(svc.markVersionStale(v1, { projectId: p1 })).resolves.toEqual({ marked: 1 });
  });
});
