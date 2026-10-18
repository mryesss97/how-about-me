import type { INestApplication } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../src/database/prisma.service";
import { COLLECTOR_RUNNER, type ClaimedQuery, type CollectorRunner } from "../../src/jobs/collector-runner";
import { QueryClaimRepository } from "../../src/jobs/query-claim.repository";
import { SchedulerService } from "../../src/jobs/scheduler.service";
import { createTestApp, resetDb } from "../helpers/app";

const STALE = 15;
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

describe("scheduler claiming (T-048, FR-086)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let prisma2: PrismaService;
  let repoA: QueryClaimRepository;
  let repoB: QueryClaimRepository;
  const ran: ClaimedQuery[] = [];
  const fakeRunner: CollectorRunner = {
    run: async (q) => {
      ran.push(q);
      return { status: "success", completedAt: new Date() };
    },
  };
  let projectId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({
      customize: (b) => b.overrideProvider(COLLECTOR_RUNNER).useValue(fakeRunner),
    }));
    prisma2 = new PrismaService();
    await prisma2.$connect();
    repoA = new QueryClaimRepository(prisma);
    repoB = new QueryClaimRepository(prisma2);
  });
  afterAll(async () => {
    await prisma2.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    ran.length = 0;
    projectId = await seedProject("connected");
  });

  async function seedProject(status: "connected" | "expired"): Promise<string> {
    const id = randomUUID();
    await prisma.monitoringProject.create({ data: { id, name: "P", slug: `p-${id}` } });
    await prisma.integrationConnection.create({
      data: { id: randomUUID(), projectId: id, platform: "threads", status },
    });
    return id;
  }

  let seq = 0;
  async function seedQuery(
    data: Partial<{
      projectId: string;
      nextRunAt: Date | null;
      enabled: boolean;
      deletedAt: Date;
      lockedAt: Date;
      lockedBy: string;
    }> = {},
  ) {
    const id = randomUUID();
    await prisma.listeningQuery.create({
      data: {
        id,
        projectId,
        displayName: `q${++seq}`,
        queryValue: `q${seq}`,
        queryType: "keyword",
        searchMode: "KEYWORD",
        nextRunAt: minutesAgo(1),
        ...data,
      },
    });
    return id;
  }

  it("TC-COL-022: two workers claiming concurrently never get the same query", async () => {
    for (let i = 0; i < 10; i++) await seedQuery();
    const seen: string[] = [];
    for (let round = 0; round < 5; round++) {
      const [a, b] = await Promise.all([repoA.claimDueQueries("A", 3, STALE), repoB.claimDueQueries("B", 3, STALE)]);
      expect(a.length).toBeLessThanOrEqual(3);
      expect(b.length).toBeLessThanOrEqual(3);
      seen.push(...a.map((x) => x.id), ...b.map((x) => x.id));
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBe(10);
  });

  it("FR-086: a row locked by another in-flight claim is skipped, not waited on (SKIP LOCKED)", async () => {
    const held = await seedQuery({ nextRunAt: minutesAgo(10) });
    const free = await seedQuery({ nextRunAt: minutesAgo(5) });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let locked!: () => void;
    const isLocked = new Promise<void>((r) => (locked = r));
    const tx = prisma.$transaction(
      async (t) => {
        await t.$queryRaw(Prisma.sql`SELECT id FROM listening_queries WHERE id = ${held}::uuid FOR UPDATE`);
        locked();
        await gate;
      },
      { timeout: 20_000 },
    );
    await isLocked;
    try {
      const claimed = await repoB.claimDueQueries("B", 10, STALE);
      expect(claimed.map((c) => c.id)).toEqual([free]);
    } finally {
      release();
      await tx;
    }
  });

  it("TC-COL-023: stale lock (16 min) is reclaimed; fresh lock (5 min) is not", async () => {
    const stale = await seedQuery({ lockedAt: minutesAgo(16), lockedBy: "dead" });
    await seedQuery({ lockedAt: minutesAgo(5), lockedBy: "alive" });
    const claimed = await repoA.claimDueQueries("A", 10, STALE);
    expect(claimed.map((c) => c.id)).toEqual([stale]);
  });

  it("completeRun is guarded by locked_by: a worker that lost its stale lock cannot overwrite", async () => {
    const id = await seedQuery();
    await repoA.claimDueQueries("A", 1, STALE);
    await prisma.listeningQuery.update({ where: { id }, data: { lockedAt: minutesAgo(16) } });
    await repoB.claimDueQueries("B", 1, STALE);
    const affected = await repoA.completeRun(id, "A", {
      nextRunAt: new Date(),
      consecutiveFailures: 0,
      lastRunAt: new Date(),
    });
    expect(affected).toBe(0);
    expect((await prisma.listeningQuery.findUniqueOrThrow({ where: { id } })).lockedBy).toBe("B");
  });

  it("TC-COL-027 / FR-058: query with a queued manual job is claimed before an older scheduled one", async () => {
    await seedQuery({ nextRunAt: minutesAgo(30) });
    const y = await seedQuery({ nextRunAt: new Date(Date.now() + 3_600_000) });
    const jobId = randomUUID();
    await prisma.syncJob.create({
      data: {
        id: jobId,
        projectId,
        queryId: y,
        status: "queued",
        trigger: "manual",
        searchType: "RECENT",
        searchMode: "KEYWORD",
      },
    });
    const claimed = await repoA.claimDueQueries("A", 1, STALE);
    expect(claimed).toEqual([expect.objectContaining({ id: y, manualJobId: jobId })]);
  });

  it("T-055 / FR-175: a queued retry job is claimed like a manual one", async () => {
    await seedQuery({ nextRunAt: minutesAgo(30) });
    const y = await seedQuery({ nextRunAt: new Date(Date.now() + 3_600_000) });
    const jobId = randomUUID();
    await prisma.syncJob.create({
      data: {
        id: jobId,
        projectId,
        queryId: y,
        status: "queued",
        trigger: "retry",
        searchType: "RECENT",
        searchMode: "KEYWORD",
      },
    });
    const claimed = await repoA.claimDueQueries("A", 1, STALE);
    expect(claimed).toEqual([expect.objectContaining({ id: y, manualJobId: jobId })]);
  });

  it("new query with next_run_at NULL is due", async () => {
    const id = await seedQuery({ nextRunAt: null });
    expect((await repoA.claimDueQueries("A", 5, STALE)).map((c) => c.id)).toEqual([id]);
  });

  it("BR-010 / ingestion §3: disabled, deleted, future, open-circuit and disconnected projects are skipped", async () => {
    await seedQuery({ enabled: false });
    await seedQuery({ deletedAt: new Date() });
    await seedQuery({ nextRunAt: new Date(Date.now() + 60_000) });
    const tripped = await seedProject("connected");
    await prisma.collectorState.create({
      data: { projectId: tripped, circuitOpenUntil: new Date(Date.now() + 600_000) },
    });
    await seedQuery({ projectId: tripped });
    await seedQuery({ projectId: await seedProject("expired") });
    expect(await repoA.claimDueQueries("A", 10, STALE)).toEqual([]);
  });

  it("TC-COL-001 (T-048 scope): tick runs due query, updates next_run_at and releases the lock", async () => {
    const id = await seedQuery();
    const svc = app.get(SchedulerService);
    await svc.tick();
    expect(ran.map((r) => r.id)).toEqual([id]);
    const row = await prisma.listeningQuery.findUniqueOrThrow({ where: { id } });
    expect(row.lockedAt).toBeNull();
    expect(row.lockedBy).toBeNull();
    expect(row.consecutiveFailures).toBe(0);
    expect(row.lastRunAt).not.toBeNull();
    const interval = row.pollIntervalSeconds;
    expect((row.nextRunAt?.getTime() ?? 0) - (row.lastRunAt?.getTime() ?? 0)).toBe(interval * 1000);
  });
});
