import type { INestApplication } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";
import type { PrismaService } from "../../src/database/prisma.service";
import { SchedulerService } from "../../src/jobs/scheduler.service";
import { TokenRefreshJobService } from "../../src/jobs/token-refresh-job.service";
import { COLLECTOR_RETRY_OVERRIDES } from "../../src/modules/collector/collector.service";
import { IntegrationsService } from "../../src/modules/integrations/integrations.service";
import type { FakeThreadsProvider } from "../../src/modules/integrations/threads/fake-threads.provider";
import { SOCIAL_DISCOVERY_PROVIDER } from "../../src/modules/integrations/threads/social-discovery.provider";
import { ThreadsTokenStore } from "../../src/modules/integrations/threads/threads-token.store";
import { createTestApp, resetDb } from "../helpers/app";

const DAY_MS = 86_400_000;

describe("integration status on 401/403 + token refresh (T-040, doc 06 §7)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let scheduler: SchedulerService;
  let fake: FakeThreadsProvider;
  let projectId: string;
  let connectionId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({
      customize: (b) =>
        b.overrideProvider(COLLECTOR_RETRY_OVERRIDES).useValue({ sleep: async () => undefined, random: () => 0 }),
    }));
    scheduler = app.get(SchedulerService);
    fake = app.get<FakeThreadsProvider>(SOCIAL_DISCOVERY_PROVIDER);
  });
  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    fake.reset();
    projectId = uuidv7();
    connectionId = uuidv7();
    await prisma.monitoringProject.create({ data: { id: projectId, name: "P", slug: `p-${projectId}` } });
    await prisma.integrationConnection.create({
      data: { id: connectionId, projectId, platform: "threads", status: "connected" },
    });
  });

  async function seedQuery(value: string): Promise<string> {
    const id = uuidv7();
    await prisma.listeningQuery.create({
      data: {
        id,
        projectId,
        displayName: value,
        queryValue: value,
        queryType: "keyword",
        searchMode: "KEYWORD",
        nextRunAt: new Date(Date.now() - 60_000),
      },
    });
    return id;
  }
  const conn = () => prisma.integrationConnection.findUniqueOrThrow({ where: { id: connectionId } });
  const makeDue = (id: string) =>
    prisma.listeningQuery.update({ where: { id }, data: { nextRunAt: new Date(Date.now() - 60_000) } });
  const reopenCircuit = () => prisma.collectorState.deleteMany({ where: { projectId } });

  it("TC-INT-008 / FR-045: fake-401 → job failed THREADS_UNAUTHORIZED, connection expired", async () => {
    const q = await seedQuery("fake-401");
    await scheduler.tick();
    const [job] = await prisma.syncJob.findMany({ where: { queryId: q } });
    expect(job).toMatchObject({ status: "failed", errorCode: "THREADS_UNAUTHORIZED" });
    expect(await conn()).toMatchObject({ status: "expired", lastErrorCode: "THREADS_UNAUTHORIZED" });
    expect((await conn()).lastErrorAt).not.toBeNull();
  });

  it("TC-INT-009 / FR-085: fake-403 → permission_error, next tick claims nothing for the project", async () => {
    const q = await seedQuery("fake-403");
    await scheduler.tick();
    expect(await conn()).toMatchObject({ status: "permission_error", lastErrorCode: "THREADS_FORBIDDEN" });
    await makeDue(q);
    await reopenCircuit();
    await scheduler.tick();
    expect(await prisma.syncJob.count({ where: { queryId: q } })).toBe(1);
  });

  it("TC-INT-010: after a successful verify the project is claimed again", async () => {
    const q = await seedQuery("fake-401");
    await scheduler.tick();
    expect((await conn()).status).toBe("expired");

    await app.get(ThreadsTokenStore).save(connectionId, "fake-good-token");
    await app.get(IntegrationsService).verifyThreads(projectId, uuidv7(), null);
    expect((await conn()).status).toBe("connected");

    await makeDue(q);
    await reopenCircuit();
    await scheduler.tick();
    expect(await prisma.syncJob.count({ where: { queryId: q } })).toBe(2);
  });

  it("race: 401 never overwrites a connection that left `connected` (new PUT → disconnected)", async () => {
    await seedQuery("fake-401");
    // Simulate an admin PUT landing while the job runs: the claim already passed, status changes before finish.
    const original = fake.search.bind(fake);
    const spy = jest.spyOn(fake, "search").mockImplementation(async (input, ctx) => {
      await prisma.integrationConnection.update({ where: { id: connectionId }, data: { status: "disconnected" } });
      return original(input, ctx);
    });
    await scheduler.tick();
    spy.mockRestore();
    expect(await conn()).toMatchObject({ status: "disconnected", lastErrorCode: null });
  });

  describe("TC-INT-011 / FR-046 token refresh job", () => {
    let job: TokenRefreshJobService;
    let store: ThreadsTokenStore;
    beforeAll(() => {
      job = app.get(TokenRefreshJobService);
      store = app.get(ThreadsTokenStore);
    });

    it("token expiring in 3 days → refreshed: new token, new expiry", async () => {
      await prisma.integrationConnection.update({
        where: { id: connectionId },
        data: { tokenExpiresAt: new Date(Date.now() + 3 * DAY_MS) },
      });
      await store.save(connectionId, "fake-good-token");
      expect(await job.run()).toEqual({ candidates: 1, refreshed: 1, failed: 0 });
      expect((await conn()).tokenExpiresAt?.getTime()).toBeGreaterThan(Date.now() + 30 * DAY_MS);
      expect(await store.read(projectId)).toMatch(/^fake-refreshed-/);
    });

    it("token expiring in 30 days → not a candidate", async () => {
      await prisma.integrationConnection.update({
        where: { id: connectionId },
        data: { tokenExpiresAt: new Date(Date.now() + 30 * DAY_MS) },
      });
      await store.save(connectionId, "fake-good-token");
      expect(await job.run()).toEqual({ candidates: 0, refreshed: 0, failed: 0 });
    });

    it("refresh fails (401) → integration.refresh_failed audit with null actor, status expired", async () => {
      await prisma.integrationConnection.update({
        where: { id: connectionId },
        data: { tokenExpiresAt: new Date(Date.now() + 3 * DAY_MS) },
      });
      await store.save(connectionId, "fake-invalid-token");
      expect(await job.run()).toEqual({ candidates: 1, refreshed: 0, failed: 1 });
      const rows = await prisma.auditLog.findMany({ where: { action: "integration.refresh_failed" } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ actorUserId: null, entityId: connectionId, projectId });
      expect(JSON.stringify(rows[0]?.metadata)).not.toContain("fake-invalid");
      expect((await conn()).status).toBe("expired");
    });
  });
});
