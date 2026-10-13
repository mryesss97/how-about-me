import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../../src/database/prisma.service";
import { APP_CONFIG } from "../../src/config/config.module";
import { loadEnv } from "../../src/config/env.schema";
import {
  addMember,
  api,
  createActor,
  createPost,
  createProject,
  createQuery,
  createTestApp,
  resetDb,
} from "../helpers";

/**
 * T-147 CSV export against real Postgres — FR-180/181, FR-200, FR-015, FR-032, NFR-017, BR-002, BR-007, BR-016;
 * TC-EXP-001…006.
 */
const CAP = 5;
const WEEK = { from: "2026-10-01T00:00:00Z", to: "2026-10-08T00:00:00Z" };
const ACTION = "mentions.exported";

/** Tiny RFC 4180 parser for assertions. */
function parseCsv(body: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\r" && body[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
    } else cell += c;
  }
  return rows;
}

describe("Mentions CSV export (T-147)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let queryId: string;
  let admin: string;
  let adminId: string;
  let seq = 0;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({
      customize: (b) =>
        b.overrideProvider(APP_CONFIG).useFactory({ factory: () => ({ ...loadEnv(), EXPORT_MAX_ROWS: CAP }) }),
    }));
  });
  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });
  beforeEach(async () => {
    await resetDb(prisma);
    seq = 0;
    projectId = (await createProject(prisma)).id;
    queryId = (await createQuery(prisma, { projectId })).id;
    const a = await createActor(prisma, { projectId, role: "admin" });
    admin = a.token;
    adminId = a.user.id;
  });

  async function seed(opts: { relevance?: "relevant" | "irrelevant"; text?: string; pid?: string } = {}) {
    const pid = opts.pid ?? projectId;
    seq += 1;
    const at = new Date(`2026-10-02T00:00:${String(seq).padStart(2, "0")}Z`);
    const post = await createPost(prisma, {
      projectId: pid,
      publishedAt: at,
      firstSeenAt: at,
      text: opts.text ?? `post ${seq}`,
    });
    const qid = pid === projectId ? queryId : (await createQuery(prisma, { projectId: pid })).id;
    await prisma.postQueryMatch.create({
      data: { postId: post.id, queryId: qid, excludedByTerms: false, firstMatchedAt: at, lastMatchedAt: at },
    });
    const runId = randomUUID();
    const analysisId = randomUUID();
    await prisma.analysisRun.create({
      data: {
        id: runId,
        postId: post.id,
        projectId: pid,
        status: "completed",
        trigger: "ingest",
        sourceContentHash: post.contentHash,
        sourceRevision: 1,
        effectiveVersion: "v",
        completedAt: at,
      },
    });
    await prisma.postAnalysis.create({
      data: {
        id: analysisId,
        analysisRunId: runId,
        postId: post.id,
        projectId: pid,
        relevanceLabel: opts.relevance ?? "relevant",
        relevanceConfidence: 0.9,
        sentimentLabel: "neutral",
        safetyLevel: "safe",
        languageCode: "vi",
        overallModelConfidence: 0.9,
      },
    });
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { currentAnalysisId: analysisId, latestRunStatus: "completed" },
    });
    return { postId: post.id, at };
  }

  const exportCsv = (token = admin, params: Record<string, string> = {}, pid = projectId) =>
    api(app, token)
      .get(`/projects/${pid}/mentions/export.csv?${new URLSearchParams({ ...WEEK, ...params }).toString()}`)
      .buffer(true)
      .parse((res, cb) => {
        let s = "";
        res.setEncoding("utf8");
        res.on("data", (c: string) => (s += c));
        res.on("end", () => cb(null, s));
      });
  const json = (body: unknown) =>
    JSON.parse(String(body)) as { error: { code: string; details?: Record<string, number> } };

  it("TC-EXP-001 / FR-180 / BR-016 / BR-002: same set as list, BOM, headers, one row per post", async () => {
    const a = await seed();
    await seed({ relevance: "irrelevant" });
    const b = await seed();
    // Second (and an excluded) match on `b` must not duplicate rows (BR-002) nor show the excluded query (BR-007).
    const q2 = await createQuery(prisma, { projectId });
    const q3 = await createQuery(prisma, { projectId });
    await prisma.postQueryMatch.createMany({
      data: [
        { postId: b.postId, queryId: q2.id, excludedByTerms: false, firstMatchedAt: b.at, lastMatchedAt: b.at },
        { postId: b.postId, queryId: q3.id, excludedByTerms: true, firstMatchedAt: b.at, lastMatchedAt: b.at },
      ],
    });
    const res = await exportCsv();
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("text/csv; charset=utf-8");
    expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="mentions-\d{8}-\d{4}\.csv"$/);
    expect(res.headers["cache-control"]).toBe("no-store");
    const body = String(res.body);
    expect(body.charCodeAt(0)).toBe(0xfeff);
    const rows = parseCsv(body.slice(1));
    expect(rows[0]?.[0]).toBe("post_id");
    expect(rows[0]).toHaveLength(15);
    const list = await api(app, admin).get(
      `/projects/${projectId}/mentions?${new URLSearchParams({ ...WEEK, count: "true" }).toString()}`,
    );
    expect(rows.length - 1).toBe(list.body.totalCount);
    // Default sort newest → same order as list.
    expect(rows.slice(1).map((r) => r[0])).toEqual([b.postId, a.postId]);
    const bRow = rows[1] ?? [];
    expect(bRow[6]?.split("; ")).toHaveLength(2);
    expect(bRow[7]).toBe("relevant");
    expect(bRow[14]).toBe(b.at.toISOString());
  });

  it("route order: export.csv is not shadowed by :mentionId", async () => {
    const res = await exportCsv();
    expect(res.status).toBe(200);
  });

  it("sort=oldest and q are honoured", async () => {
    const a = await seed({ text: "giá vé đắt" });
    const b = await seed({ text: "giá rẻ" });
    await seed({ text: "khác hẳn" });
    const rows = parseCsv(String((await exportCsv(admin, { sort: "oldest", q: "giá" })).body).slice(1));
    expect(rows.slice(1).map((r) => r[0])).toEqual([a.postId, b.postId]);
  });

  it("TC-EXP-002 / FR-181: over cap → 413 JSON envelope, no audit, no throttle token", async () => {
    for (let i = 0; i < CAP + 1; i++) await seed();
    const res = await exportCsv();
    expect(res.status).toBe(413);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    const err = json(res.body).error;
    expect(err.code).toBe("EXPORT_TOO_LARGE");
    expect(err.details?.cap).toBe(CAP);
    expect(await prisma.auditLog.count({ where: { action: ACTION } })).toBe(0);
  });

  it("TC-EXP-003 / FR-015 / FR-032: viewer gated by allowViewerExport; analyst/admin allowed; outsider 403", async () => {
    await seed();
    const viewer = (await createActor(prisma, { projectId, role: "viewer" })).token;
    const analyst = (await createActor(prisma, { projectId, role: "analyst" })).token;
    const outsider = (await createActor(prisma)).token;
    const denied = await exportCsv(viewer);
    expect(denied.status).toBe(403);
    expect(json(denied.body).error.code).toBe("FORBIDDEN_ROLE");
    expect((await exportCsv(analyst)).status).toBe(200);
    const out = await exportCsv(outsider);
    expect(out.status).toBe(403);
    expect(json(out.body).error.code).toBe("FORBIDDEN_PROJECT");
    await prisma.monitoringProject.update({
      where: { id: projectId },
      data: { settings: { allowViewerExport: true } },
    });
    expect((await exportCsv(viewer)).status).toBe(200);
  });

  it("TC-EXP-004 / FR-200: one audit row with filters + rowCount, no text", async () => {
    await seed({ text: "very private text" });
    await seed();
    expect((await exportCsv()).status).toBe(200);
    const logs = await prisma.auditLog.findMany({ where: { action: ACTION } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ projectId, entityType: "monitoring_project", entityId: projectId });
    expect(logs[0]?.actorUserId).toBeTruthy();
    expect(logs[0]?.metadata).toMatchObject({ format: "csv", rowCount: 2, filters: { relevance: ["relevant"] } });
    expect(JSON.stringify(logs[0]?.metadata)).not.toContain("private");
  });

  it("TC-EXP-005: commas, quotes, newlines, Vietnamese, formula guard round-trip", async () => {
    await seed({ text: 'Giá vé "đắt", quá\nđắt' });
    await seed({ text: "=1+1" });
    const rows = parseCsv(String((await exportCsv(admin, { sort: "oldest" })).body).slice(1));
    expect(rows[1]?.[4]).toBe('Giá vé "đắt", quá\nđắt');
    expect(rows[2]?.[4]).toBe("'=1+1");
  });

  it("TC-EXP-006 / NFR-017: 6th export in a minute → 429 + Retry-After; per user across projects", async () => {
    await seed();
    for (let i = 0; i < 5; i++) expect((await exportCsv()).status).toBe(200);
    const limited = await exportCsv();
    expect(limited.status).toBe(429);
    const err = json(limited.body).error;
    expect(err.code).toBe("RATE_LIMITED");
    const retry = Number(limited.headers["retry-after"]);
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(60);
    expect(err.details?.retryAfterSeconds).toBe(retry);
    // Another user is unaffected.
    const other = (await createActor(prisma, { projectId, role: "analyst" })).token;
    expect((await exportCsv(other)).status).toBe(200);
    // Same user, other project → still limited (per user).
    const p2 = (await createProject(prisma)).id;
    await addMember(prisma, { projectId: p2, userId: adminId, role: "admin" });
    expect((await exportCsv(admin, {}, p2)).status).toBe(429);
  });

  it("NFR-017: concurrent requests of one user → exactly 5 succeed (advisory lock)", async () => {
    await seed();
    const results = await Promise.all(Array.from({ length: 6 }, () => exportCsv()));
    expect(results.filter((r) => r.status === 200)).toHaveLength(5);
    expect(results.filter((r) => r.status === 429)).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { action: ACTION } })).toBe(5);
  });

  it("no token → 401", async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/projects/${projectId}/mentions/export.csv`);
    expect(res.status).toBe(401);
  });
});
