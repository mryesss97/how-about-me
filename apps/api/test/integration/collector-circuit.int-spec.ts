import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../src/database/prisma.service";
import { COLLECTOR_RUNNER, type CollectorRunner } from "../../src/jobs/collector-runner";
import { SchedulerService } from "../../src/jobs/scheduler.service";
import { CircuitBreakerService } from "../../src/modules/collector/circuit-breaker.service";
import { createTestApp, resetDb } from "../helpers/app";

const failed = { status: "failed" as const, errorCode: "THREADS_5XX", errorMessage: "upstream down" };

describe("collector circuit breaker (T-054, FR-084, TC-COL-020)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let breaker: CircuitBreakerService;
  let calls = 0;
  let nextStatus: "success" | "failed" = "success";
  const fakeRunner: CollectorRunner = {
    run: async () => {
      calls++;
      return nextStatus === "success"
        ? { status: "success", completedAt: new Date() }
        : { ...failed, completedAt: new Date() };
    },
  };
  let projectId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({
      customize: (b) => b.overrideProvider(COLLECTOR_RUNNER).useValue(fakeRunner),
    }));
    breaker = app.get(CircuitBreakerService);
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await resetDb(prisma);
    calls = 0;
    nextStatus = "success";
    projectId = randomUUID();
    await prisma.monitoringProject.create({ data: { id: projectId, name: "P", slug: `p-${projectId}` } });
    await prisma.integrationConnection.create({
      data: { id: randomUUID(), projectId, platform: "threads", status: "connected" },
    });
  });

  const fail = async (n: number) => {
    for (let i = 0; i < n; i++) await breaker.recordOutcome(projectId, failed);
  };
  const seedQuery = (i: number) =>
    prisma.listeningQuery.create({
      data: {
        id: randomUUID(),
        projectId,
        displayName: `q${i}`,
        queryValue: `q${i}`,
        queryType: "keyword",
        searchMode: "KEYWORD",
        nextRunAt: new Date(Date.now() - 60_000),
      },
    });
  const toHalfOpen = () =>
    prisma.collectorState.update({ where: { projectId }, data: { circuitOpenUntil: new Date(Date.now() - 1000) } });

  it("opens after 5 consecutive failures with until ≈ now+600s and reason", async () => {
    await fail(4);
    expect((await breaker.getState(projectId)).open).toBe(false);
    await fail(1);
    const s = await breaker.getState(projectId);
    expect(s.state).toBe("open");
    expect(s.reason).toContain("THREADS_5XX");
    const delta = (s.until?.getTime() ?? 0) - Date.now();
    expect(delta).toBeGreaterThan(590_000);
    expect(delta).toBeLessThanOrEqual(601_000);
  });

  it("open circuit: scheduler tick never calls the provider", async () => {
    await seedQuery(1);
    await fail(5);
    await app.get(SchedulerService).tick();
    expect(calls).toBe(0);
  });

  it("half-open: exactly one concurrent probe is granted", async () => {
    await fail(5);
    await toHalfOpen();
    expect((await breaker.getState(projectId)).state).toBe("half_open");
    const results = await Promise.all([1, 2, 3, 4].map(() => breaker.tryAcquireProbe(projectId)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await breaker.getState(projectId)).open).toBe(true);
  });

  it("half-open tick with a failing probe calls the provider exactly once and re-opens", async () => {
    nextStatus = "failed";
    await seedQuery(1);
    await seedQuery(2);
    await fail(5);
    await toHalfOpen();
    await app.get(SchedulerService).tick();
    expect(calls).toBe(1);
    expect((await breaker.getState(projectId)).state).toBe("open");
    const locked = await prisma.listeningQuery.count({ where: { projectId, lockedBy: { not: null } } });
    expect(locked).toBe(0);
  });

  it("half-open tick with a successful probe closes the circuit", async () => {
    await seedQuery(1);
    await fail(5);
    await toHalfOpen();
    await app.get(SchedulerService).tick();
    expect(calls).toBe(1);
    const s = await breaker.getState(projectId);
    expect(s).toMatchObject({ state: "closed", open: false, until: null, consecutiveFailures: 0 });
    const locked = await prisma.listeningQuery.count({ where: { projectId, lockedBy: { not: null } } });
    expect(locked).toBe(0);
  });

  it("failed probe re-opens for another open period", async () => {
    await fail(5);
    await toHalfOpen();
    expect(await breaker.tryAcquireProbe(projectId)).toBe(true);
    await fail(1);
    const s = await breaker.getState(projectId);
    expect(s.state).toBe("open");
    expect((s.until?.getTime() ?? 0) - Date.now()).toBeGreaterThan(590_000);
  });

  it("success before the threshold resets the counter", async () => {
    await fail(3);
    await breaker.recordOutcome(projectId, { status: "success" });
    await fail(4);
    expect(await breaker.getState(projectId)).toMatchObject({ state: "closed", consecutiveFailures: 4 });
  });

  it("partial leaves the counter unchanged", async () => {
    await fail(2);
    await breaker.recordOutcome(projectId, { status: "partial" });
    expect((await breaker.getState(projectId)).consecutiveFailures).toBe(2);
  });

  it("no state row → closed and probe allowed", async () => {
    expect(await breaker.tryAcquireProbe(projectId)).toBe(true);
    expect((await breaker.getState(projectId)).state).toBe("closed");
  });
});
