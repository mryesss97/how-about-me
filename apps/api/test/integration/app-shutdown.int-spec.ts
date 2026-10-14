import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp } from "../helpers/app";

/**
 * #258: closing an app must not leave a DB connection behind. Before the fix PrismaService disconnected in
 * onModuleDestroy, then SchedulerService.releaseLocks made Prisma reconnect and that connection was never closed.
 */
describe("app shutdown does not leak DB connections (#258)", () => {
  let observer: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app: observer, prisma } = await createTestApp());
  });
  afterAll(async () => observer.close());

  const leakedReleaseLockConnections = async (): Promise<number> => {
    const [row] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid()
        AND query ILIKE '%listening_queries%' AND query ILIKE '%locked_at%'`;
    return row?.n ?? 0;
  };

  it("N create/close cycles leave no idle releaseLocks connection", async () => {
    const before = await leakedReleaseLockConnections();
    for (let i = 0; i < 3; i++) {
      const { app } = await createTestApp();
      await request(app.getHttpServer()).get("/health/live");
      await app.close();
    }
    expect(await leakedReleaseLockConnections()).toBe(before);
  });
});
