import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../src/database/prisma.service";
import { resetDb } from "../helpers/app";

/**
 * T-007: verifies the hand-written objects of migration `20260905120100_init_extras`
 * (docs/02-architecture/04-data-model.md §4–§6) exist and behave on a real Postgres.
 */
describe("schema baseline: raw-SQL objects from init_extras (T-007)", () => {
  const prisma = new PrismaService();
  let projectId: string;

  const uniqueViolation = { code: "P2002" };

  async function createPost(overrides: Partial<{ platformPostId: string; text: string }> = {}) {
    const now = new Date();
    return prisma.socialPost.create({
      data: {
        id: randomUUID(),
        projectId,
        platform: "threads",
        platformPostId: overrides.platformPostId ?? randomUUID(),
        text: overrides.text ?? "hello",
        publishedAt: now,
        contentHash: "hash-1",
        firstSeenAt: now,
        lastSeenAt: now,
      },
    });
  }

  function runData(postId: string, status: "pending" | "processing" | "completed") {
    return {
      id: randomUUID(),
      postId,
      projectId,
      status,
      trigger: "ingest" as const,
      sourceContentHash: "hash-1",
      sourceRevision: 1,
      effectiveVersion: "v1",
    };
  }

  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => prisma.$disconnect());

  beforeEach(async () => {
    await resetDb(prisma);
    projectId = randomUUID();
    await prisma.monitoringProject.create({ data: { id: projectId, name: "P", slug: `p-${projectId}` } });
  });

  it("creates all partial unique and GIN indexes", async () => {
    const rows = await prisma.$queryRaw<{ indexname: string }[]>(
      Prisma.sql`SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()`,
    );
    const names = rows.map((r) => r.indexname);
    expect(names).toEqual(
      expect.arrayContaining([
        "listening_queries_active_unique",
        "analysis_runs_open_unique",
        "analysis_overrides_active_unique",
        "social_posts_search_vector_idx",
      ]),
    );
  });

  it("BR-006: one active query per (project, platform, type, lower(value)); soft-deleted frees the slot", async () => {
    const base = { projectId, displayName: "q", queryType: "keyword" as const, searchMode: "KEYWORD" as const };
    const first = await prisma.listeningQuery.create({ data: { ...base, id: randomUUID(), queryValue: "1Zone" } });
    await expect(
      prisma.listeningQuery.create({ data: { ...base, id: randomUUID(), queryValue: "1zone" } }),
    ).rejects.toMatchObject(uniqueViolation);

    await prisma.listeningQuery.update({ where: { id: first.id }, data: { deletedAt: new Date() } });
    await expect(
      prisma.listeningQuery.create({ data: { ...base, id: randomUUID(), queryValue: "1ZONE" } }),
    ).resolves.toBeDefined();
  });

  it("BR-002: posts are unique on (platform, platform_post_id)", async () => {
    await createPost({ platformPostId: "tp-1" });
    await expect(createPost({ platformPostId: "tp-1" })).rejects.toMatchObject(uniqueViolation);
  });

  it("BR-024: no two open runs for the same (post, content hash, version); closed run does not block", async () => {
    const post = await createPost();
    await prisma.analysisRun.create({ data: runData(post.id, "pending") });
    await expect(prisma.analysisRun.create({ data: runData(post.id, "processing") })).rejects.toMatchObject(
      uniqueViolation,
    );

    const other = await createPost();
    await prisma.analysisRun.create({ data: runData(other.id, "completed") });
    await expect(prisma.analysisRun.create({ data: runData(other.id, "pending") })).resolves.toBeDefined();
  });

  it("one active override per (post, field) until revoked", async () => {
    const post = await createPost();
    const data = () => ({
      id: randomUUID(),
      postId: post.id,
      projectId,
      field: "relevance" as const,
      overrideValue: { value: "irrelevant" },
      reviewedBy: randomUUID(),
    });
    const first = await prisma.analysisOverride.create({ data: data() });
    await expect(prisma.analysisOverride.create({ data: data() })).rejects.toMatchObject(uniqueViolation);
    await prisma.analysisOverride.update({ where: { id: first.id }, data: { revokedAt: new Date() } });
    await expect(prisma.analysisOverride.create({ data: data() })).resolves.toBeDefined();
  });

  it("FR-161: search_vector is generated from text and searchable", async () => {
    const post = await createPost({ text: "Concert vé 1Zone tuyệt vời" });
    await createPost({ text: "unrelated" });
    const rows = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id::text FROM social_posts WHERE search_vector @@ to_tsquery('simple', ${"concert"})`,
    );
    expect(rows.map((r) => r.id)).toEqual([post.id]);
  });

  it("FR-114: current_analysis_id FK is deferred until commit", async () => {
    const post = await createPost();
    const run = await prisma.analysisRun.create({ data: runData(post.id, "completed") });
    const analysisId = randomUUID();
    await prisma.$transaction(async (tx) => {
      // Pointer first, row second — only valid because the FK is DEFERRABLE INITIALLY DEFERRED.
      await tx.socialPost.update({ where: { id: post.id }, data: { currentAnalysisId: analysisId } });
      await tx.postAnalysis.create({
        data: { id: analysisId, analysisRunId: run.id, postId: post.id, projectId, relevanceLabel: "relevant" },
      });
    });
    const saved = await prisma.socialPost.findUniqueOrThrow({ where: { id: post.id } });
    expect(saved.currentAnalysisId).toBe(analysisId);
  });

  it("BR-025: effective_post_analysis prefers an active override over the AI label", async () => {
    const post = await createPost();
    const run = await prisma.analysisRun.create({ data: runData(post.id, "completed") });
    const analysis = await prisma.postAnalysis.create({
      data: { id: randomUUID(), analysisRunId: run.id, postId: post.id, projectId, relevanceLabel: "relevant" },
    });
    await prisma.socialPost.update({ where: { id: post.id }, data: { currentAnalysisId: analysis.id } });

    const read = () =>
      prisma.$queryRaw<{ relevance_label: string; has_override: boolean }[]>(
        Prisma.sql`SELECT relevance_label::text, has_override FROM effective_post_analysis WHERE post_id = ${post.id}::uuid`,
      );

    expect(await read()).toEqual([{ relevance_label: "relevant", has_override: false }]);

    const override = await prisma.analysisOverride.create({
      data: {
        id: randomUUID(),
        postId: post.id,
        projectId,
        analysisId: analysis.id,
        field: "relevance",
        overrideValue: { value: "irrelevant" },
        reviewedBy: randomUUID(),
      },
    });
    expect(await read()).toEqual([{ relevance_label: "irrelevant", has_override: true }]);

    await prisma.analysisOverride.update({ where: { id: override.id }, data: { revokedAt: new Date() } });
    expect(await read()).toEqual([{ relevance_label: "relevant", has_override: false }]);
  });
});
