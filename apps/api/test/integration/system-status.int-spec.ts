import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { SystemStatusResponseSchema } from "@how-about-me/contracts";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";

/** T-057: system status v1 — FR-171, FR-176, FR-084; TC-SYS-002/003/005. */
describe("System status (T-057)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let otherProjectId: string;
  let viewerToken: string;
  let outsiderToken: string;
  const get = (token: string, pid = projectId) =>
    request(app.getHttpServer()).get(`/api/v1/projects/${pid}/system-status`).set("authorization", `Bearer ${token}`);

  async function seedJob(pid: string, status: "success" | "partial" | "failed" | "running", createdAt = new Date()) {
    await prisma.syncJob.create({
      data: {
        id: randomUUID(),
        projectId: pid,
        status,
        trigger: "scheduled",
        searchType: "RECENT",
        searchMode: "KEYWORD",
        createdAt,
      },
    });
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(async () => {
    await resetDb(prisma);
    projectId = randomUUID();
    otherProjectId = randomUUID();
    await prisma.monitoringProject.create({ data: { id: projectId, name: "A", slug: `a-${projectId}` } });
    await prisma.monitoringProject.create({ data: { id: otherProjectId, name: "B", slug: `b-${otherProjectId}` } });
    const viewer = randomUUID();
    await prisma.userProfile.create({ data: { id: viewer, email: "v@example.com", displayName: "v" } });
    await prisma.projectMember.create({ data: { projectId, userId: viewer, role: "viewer" } });
    viewerToken = await mintTestJwt({ sub: viewer, email: "v@example.com" });
    const outsider = randomUUID();
    await prisma.userProfile.create({ data: { id: outsider, email: "o@example.com", displayName: "o" } });
    outsiderToken = await mintTestJwt({ sub: outsider, email: "o@example.com" });
  });
  afterAll(async () => app.close());

  it("TC-SYS-002/005: aggregates collector metrics, contract-valid, no secret leak", async () => {
    const connId = randomUUID();
    await prisma.integrationConnection.create({
      data: { id: connId, projectId, platform: "threads", status: "connected", accountIdentifier: "@acme" },
    });
    const secretBytes = Buffer.from("SUPER-SECRET-TOKEN");
    await prisma.integrationSecret.create({
      data: {
        id: randomUUID(),
        connectionId: connId,
        keyId: "k1",
        ciphertext: secretBytes,
        iv: secretBytes,
        authTag: secretBytes,
      },
    });
    const synced = new Date(Date.now() - 60_000);
    await prisma.listeningQuery.create({
      data: {
        id: randomUUID(),
        projectId,
        displayName: "q1",
        queryValue: "q1",
        queryType: "keyword",
        searchMode: "KEYWORD",
        lastSuccessfulSyncAt: synced,
      },
    });
    await prisma.listeningQuery.create({
      data: {
        id: randomUUID(),
        projectId,
        displayName: "q2",
        queryValue: "q2",
        queryType: "keyword",
        searchMode: "KEYWORD",
        enabled: false,
        lastSuccessfulSyncAt: new Date(),
      },
    });
    for (const s of ["success", "success", "success", "partial", "failed", "running"] as const)
      await seedJob(projectId, s);
    await seedJob(projectId, "failed", new Date(Date.now() - 25 * 3600_000)); // outside 24h
    await seedJob(otherProjectId, "failed"); // other project

    const res = await get(viewerToken);
    expect(res.status).toBe(200);
    const body = SystemStatusResponseSchema.parse(res.body);
    expect(body.collector).toMatchObject({
      status: "healthy",
      activeQueries: 1,
      jobsInProgress: 1,
      failedJobs24h: 1,
      partialJobs24h: 1,
      successRate24h: 0.8,
      circuit: { open: false },
    });
    expect(body.collector.collectionLagSeconds).toBeGreaterThanOrEqual(59);
    expect(body.threads).toMatchObject({ status: "connected", accountIdentifier: "@acme" });
    expect(JSON.stringify(res.body)).not.toContain("SUPER-SECRET-TOKEN");
    expect(body.database.lastMigration).not.toBeNull();
  });

  it("TC-SYS-003: circuit open → collector paused with reason", async () => {
    await prisma.integrationConnection.create({
      data: { id: randomUUID(), projectId, platform: "threads", status: "connected" },
    });
    const until = new Date(Date.now() + 600_000);
    await prisma.collectorState.create({
      data: { projectId, consecutiveProviderFailures: 5, circuitOpenUntil: until, circuitReason: "THREADS_5XX: x" },
    });
    const body = SystemStatusResponseSchema.parse((await get(viewerToken)).body);
    expect(body.collector.status).toBe("paused");
    expect(body.collector.circuit).toEqual({ open: true, until: until.toISOString(), reason: "THREADS_5XX: x" });
  });

  it("FR-015: a viewer can read; a non-member gets 403 FORBIDDEN_PROJECT", async () => {
    expect((await get(viewerToken)).status).toBe(200);
    const res = await get(outsiderToken);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_PROJECT");
  });
});
