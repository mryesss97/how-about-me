import { runPerfSeed, seedConfig, parsePerfSeedArgs } from "../../src/cli/perf-seed";
import { assertPerfDatabase } from "../../src/cli/perf-seed/guard";
import { PrismaService } from "../../src/database/prisma.service";
import { resetDb } from "../helpers/app";

/**
 * T-097 (#84): the perf generator loads a consistent dataset (small size here) into the test database.
 * Checks the invariants analytics rely on: BR-002 one row per post, BR-010 ≥1 match, current analysis = newest
 * (append-only, BR-003), ≤1 active override per (post, field) (BR-025), view row count.
 */
describe("perf seed generator (T-097)", () => {
  const prisma = new PrismaService();
  const args = parsePerfSeedArgs([
    "--posts",
    "500",
    "--chunk",
    "200",
    "--anchor",
    "2026-10-13T00:00:00Z",
    "--truncate",
  ]);
  const cfg = seedConfig(args);
  const count = async (sql: string) => {
    const [r] = await prisma.$queryRawUnsafe<{ n: number }[]>(sql);
    return r?.n ?? -1;
  };

  beforeAll(async () => {
    await prisma.$connect();
    // The integration DB name carries the test marker, so the guard passes without --allow-any-db.
    assertPerfDatabase(process.env.DATABASE_URL, { allowAnyDb: false });
    await runPerfSeed(prisma, args, cfg);
  }, 60_000);

  afterAll(async () => {
    await resetDb(prisma);
    await prisma.$disconnect();
  });

  it("loads the requested posts with children and audit/sync rows", async () => {
    expect(await prisma.socialPost.count()).toBe(500);
    expect(await prisma.monitoringProject.count()).toBe(2);
    expect(await prisma.postAnalysis.count()).toBeGreaterThan(500);
    expect(await prisma.auditLog.count()).toBe(100);
    expect(await prisma.syncJob.count()).toBe(10);
  });

  it("BR-010: every post has ≥1 match, all within its own project", async () => {
    expect(
      await count(
        `SELECT count(*)::int AS n FROM social_posts p WHERE NOT EXISTS (SELECT 1 FROM post_query_matches m WHERE m.post_id = p.id)`,
      ),
    ).toBe(0);
    expect(
      await count(`SELECT count(*)::int AS n FROM post_query_matches m JOIN social_posts p ON p.id = m.post_id
                    JOIN listening_queries q ON q.id = m.query_id WHERE q.project_id <> p.project_id`),
    ).toBe(0);
  });

  it("current_analysis_id is the post's newest analysis; completed posts always have one", async () => {
    expect(
      await count(`SELECT count(*)::int AS n FROM social_posts p
                    WHERE p.current_analysis_id IS DISTINCT FROM
                      (SELECT a.id FROM post_analyses a WHERE a.post_id = p.id ORDER BY a.created_at DESC LIMIT 1)`),
    ).toBe(0);
    expect(
      await count(
        `SELECT count(*)::int AS n FROM social_posts WHERE latest_run_status = 'completed' AND current_analysis_id IS NULL`,
      ),
    ).toBe(0);
  });

  it("BR-025: at most one active override per (post, field); effective view has one row per post", async () => {
    expect(
      await count(`SELECT count(*)::int AS n FROM (SELECT post_id, field FROM analysis_overrides WHERE revoked_at IS NULL
                    GROUP BY 1, 2 HAVING count(*) > 1) d`),
    ).toBe(0);
    expect(await count(`SELECT count(*)::int AS n FROM effective_post_analysis`)).toBe(500);
  });

  it("is deterministic: reloading with the same seed reproduces the same ids", async () => {
    const before = await prisma.socialPost.findMany({ select: { id: true }, orderBy: { platformPostId: "asc" } });
    await runPerfSeed(prisma, args, cfg);
    const after = await prisma.socialPost.findMany({ select: { id: true }, orderBy: { platformPostId: "asc" } });
    expect(after).toEqual(before);
  });

  it("refuses to load into a non-empty database without --truncate", async () => {
    await expect(runPerfSeed(prisma, { ...args, truncate: false }, cfg)).rejects.toThrow(/--truncate/);
  });
});
