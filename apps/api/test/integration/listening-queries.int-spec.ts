import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ListeningQuerySchema } from "@how-about-me/contracts";
import type { PrismaService } from "../../src/database/prisma.service";
import { QueryClaimRepository } from "../../src/jobs/query-claim.repository";
import {
  addMember,
  api,
  createPost,
  createProject,
  createTestApp,
  createUser,
  mintTestJwt,
  resetDb,
  waitForDbTime,
} from "../helpers";

/** T-042: listening queries CRUD — FR-051…FR-057, BR-004…BR-010, BR-034; TC-LQ-002…012. */
describe("Listening queries (T-042)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let claim: QueryClaimRepository;
  let projectId: string;
  let otherProjectId: string;
  type Who = "admin" | "analyst" | "viewer" | "outsider" | "adminB";
  const users = {} as { [K in Who]: { id: string; token: string } };
  const base = (pid = projectId) => `/projects/${pid}/listening-queries`;
  const as = (who: Who) => api(app, users[who].token);
  const post = (body: object, who: Who = "admin", pid = projectId) => as(who).post(base(pid), body);
  const patch = (id: string, body: object, who: Who = "admin", pid = projectId) =>
    as(who).patch(`${base(pid)}/${id}`, body);
  const del = (id: string, who: Who = "admin", pid = projectId) => as(who).delete(`${base(pid)}/${id}`);
  const restore = (id: string, who: Who = "admin") => as(who).post(`${base()}/${id}/restore`);
  const get = (path: string, who: Who = "admin", pid = projectId) => as(who).get(`${base(pid)}${path}`);
  const valid = { displayName: "Eventista", queryValue: "eventista", queryType: "keyword" };
  const create = async (body: object = valid, pid = projectId, who: Who = "admin"): Promise<string> => {
    const res = await post(body, who, pid);
    expect(res.status).toBe(201);
    return res.body.id as string;
  };
  // #189: bounded by a t0 taken before the request instead of a fixed tolerance that breaks under load.
  let t0 = Date.now();
  const near = (iso: string | null) => {
    const t = new Date(iso ?? 0).getTime();
    return t >= t0 - 1000 && t <= Date.now() + 1000;
  };
  const auditOf = (entityId: string) =>
    prisma.auditLog.findMany({ where: { entityId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const claimedIds = async () => (await claim.claimDueQueries(`w-${randomUUID()}`, 50, 15)).map((q) => q.id);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    claim = new QueryClaimRepository(prisma);
  });
  beforeEach(async () => {
    t0 = Date.now();
    await resetDb(prisma);
    projectId = (await createProject(prisma)).id;
    otherProjectId = (await createProject(prisma)).id;
    await prisma.integrationConnection.create({
      data: { id: randomUUID(), projectId, platform: "threads", status: "connected" },
    });
    for (const who of ["admin", "analyst", "viewer", "outsider", "adminB"] as const) {
      const user = await createUser(prisma, { displayName: who });
      if (who === "adminB") await addMember(prisma, { projectId: otherProjectId, userId: user.id, role: "admin" });
      else if (who !== "outsider") await addMember(prisma, { projectId, userId: user.id, role: who });
      users[who] = { id: user.id, token: await mintTestJwt({ sub: user.id, email: user.email }) };
    }
  });
  afterAll(async () => app.close());

  it("TC-LQ-002: create keyword → 201, RECENT, nextRunAt≈now, audit with requestId (FR-052, FR-056, BR-005, BR-034)", async () => {
    const res = await post(valid).set("x-request-id", "req-lq-002");
    expect(res.status).toBe(201);
    expect(ListeningQuerySchema.safeParse(res.body).success).toBe(true);
    expect(res.body).toMatchObject({
      searchMode: "KEYWORD",
      scheduledSearchType: "RECENT",
      enabled: true,
      pollIntervalSeconds: 600,
      createdBy: { id: users.admin.id, displayName: "admin" },
      deletedAt: null,
    });
    expect(near(res.body.nextRunAt)).toBe(true);
    const logs = await auditOf(res.body.id);
    expect(logs.map((l) => l.action)).toEqual(["query.created"]);
    expect(logs[0]).toMatchObject({
      requestId: "req-lq-002",
      actorUserId: users.admin.id,
      entityType: "listening_query",
    });
  });

  it("TC-LQ-003: '#Eventista' topic_tag → stored 'Eventista', TAG (BR-004, BR-005)", async () => {
    const res = await post({ ...valid, queryValue: "#Eventista", queryType: "topic_tag" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ queryValue: "Eventista", searchMode: "TAG" });
    const row = await prisma.listeningQuery.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.queryValue).toBe("Eventista");
  });

  it.each([
    ["pollIntervalSeconds", { pollIntervalSeconds: 30 }],
    ["pollIntervalSeconds", { pollIntervalSeconds: 100000 }],
    ["queryValue", { queryValue: "a".repeat(101) }],
    ["excludeTerms", { excludeTerms: Array(51).fill("x") }],
    ["displayName", { displayName: "" }],
    ["queryType", { queryType: "hashtag" }],
    ["overlapSeconds", { overlapSeconds: -1 }],
    ["initialBackfillDays", { initialBackfillDays: 31 }],
  ])("TC-LQ-004: invalid %s → 400 VALIDATION_ERROR (FR-052)", async (field, over) => {
    const res = await post({ ...valid, ...over });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const paths = (res.body.error.details.issues as { path: unknown }[]).map((i) => String(i.path));
    expect(paths.some((p) => p.startsWith(field))).toBe(true);
  });

  it("TC-LQ-005: case-insensitive duplicate → 409 with existingId; other type/project/literal _ allowed (BR-006, FR-053)", async () => {
    const first = await create();
    const dup = await post({ ...valid, queryValue: "EVENTISTA" });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toMatchObject({ code: "QUERY_DUPLICATE", details: { existingId: first } });
    await create({ ...valid, queryType: "topic_tag" });
    await create(valid, otherProjectId, "adminB");
    await create({ ...valid, queryValue: "1zoneXvn" });
    await create({ ...valid, queryValue: "1zone_vn" });
  });

  it("BR-006: concurrent identical creates → one 201, one 409 (no 500)", async () => {
    const statuses = (await Promise.all([post(valid), post(valid)])).map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
  });

  it("TC-LQ-006: delete then re-create same value → 201 with a new id (FR-053, FR-057)", async () => {
    const first = await create();
    expect((await del(first)).status).toBe(204);
    const second = await create();
    expect(second).not.toBe(first);
  });

  it("TC-LQ-007: PATCH mutable fields → 200; audit query.updated with diff (FR-054, BR-034)", async () => {
    const id = await create();
    const res = await patch(id, { displayName: "New", excludeTerms: ["giveaway"], pollIntervalSeconds: 900 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ displayName: "New", excludeTerms: ["giveaway"], pollIntervalSeconds: 900 });
    const logs = await auditOf(id);
    expect(logs.map((l) => l.action)).toEqual(["query.created", "query.updated"]);
    expect(logs[1]?.metadata).toEqual({
      fields: ["displayName", "excludeTerms", "pollIntervalSeconds"],
      before: { displayName: "Eventista", excludeTerms: [], pollIntervalSeconds: 600 },
      after: { displayName: "New", excludeTerms: ["giveaway"], pollIntervalSeconds: 900 },
    });
  });

  it("TC-LQ-008: immutable fields → 400 QUERY_IMMUTABLE_FIELD, nothing changes; {} → VALIDATION_ERROR (BR-009)", async () => {
    const id = await create();
    const a = await patch(id, { queryValue: "x" });
    expect(a.status).toBe(400);
    expect(a.body.error).toMatchObject({ code: "QUERY_IMMUTABLE_FIELD", details: { fields: ["queryValue"] } });
    const b = await patch(id, { queryType: "topic_tag", displayName: "y" });
    expect(b.body.error.code).toBe("QUERY_IMMUTABLE_FIELD");
    const row = await prisma.listeningQuery.findUniqueOrThrow({ where: { id } });
    expect(row.displayName).toBe("Eventista");
    const c = await patch(id, {});
    expect(c.status).toBe(400);
    expect(c.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("TC-LQ-009: disable → audit query.disabled, scheduler never claims, no jobs (FR-055, BR-010)", async () => {
    const id = await create();
    const res = await patch(id, { enabled: false });
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect((await auditOf(id)).map((l) => l.action)).toContain("query.disabled");
    expect(await claimedIds()).not.toContain(id);
    expect(await claimedIds()).not.toContain(id);
    expect(await prisma.syncJob.count({ where: { queryId: id } })).toBe(0);
  });

  it("TC-LQ-010: re-enable → nextRunAt≈now, audit query.enabled, claimable (FR-055)", async () => {
    const id = await create({ ...valid, enabled: false });
    await prisma.listeningQuery.update({ where: { id }, data: { nextRunAt: new Date(Date.now() + 86_400_000) } });
    t0 = Date.now();
    const res = await patch(id, { enabled: true });
    expect(res.status).toBe(200);
    expect(near(res.body.nextRunAt)).toBe(true);
    expect((await auditOf(id)).map((l) => l.action)).toEqual(["query.created", "query.enabled"]);
    await waitForDbTime(prisma, new Date(res.body.nextRunAt as string));
    expect(await claimedIds()).toContain(id);
  });

  it("TC-LQ-011: soft delete keeps history, hides from list, idempotent (FR-057, BR-010)", async () => {
    const id = await create();
    const { id: postId } = await createPost(prisma, { projectId, queryId: id });
    expect((await del(id)).status).toBe(204);
    const row = await prisma.listeningQuery.findUniqueOrThrow({ where: { id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.enabled).toBe(true);
    expect((await get("")).body.items.map((q: { id: string }) => q.id)).not.toContain(id);
    expect((await get("?includeDeleted=true")).body.items.map((q: { id: string }) => q.id)).toContain(id);
    const one = await get(`/${id}`);
    expect(one.status).toBe(200);
    expect(one.body.deletedAt).not.toBeNull();
    expect(await prisma.postQueryMatch.count({ where: { queryId: id } })).toBe(1);
    expect(await prisma.socialPost.count({ where: { id: postId } })).toBe(1);
    expect(await claimedIds()).not.toContain(id);
    expect((await del(id)).status).toBe(204);
    expect((await auditOf(id)).map((l) => l.action)).toEqual(["query.created", "query.deleted"]);
    expect((await patch(id, { displayName: "z" })).status).toBe(404);
  });

  it("TC-LQ-012: restore → listed, scheduled again; 409 if an active duplicate exists (FR-057)", async () => {
    const id = await create();
    await del(id);
    await prisma.listeningQuery.update({ where: { id }, data: { nextRunAt: new Date(Date.now() + 86_400_000) } });
    t0 = Date.now();
    const res = await restore(id);
    expect(res.status).toBe(200);
    expect(res.body.deletedAt).toBeNull();
    expect(near(res.body.nextRunAt)).toBe(true);
    expect((await get("")).body.items.map((q: { id: string }) => q.id)).toContain(id);
    await waitForDbTime(prisma, new Date(res.body.nextRunAt as string));
    expect(await claimedIds()).toContain(id);
    expect((await auditOf(id)).map((l) => l.action)).toEqual(["query.created", "query.deleted", "query.restored"]);

    await del(id);
    const replacement = await create({ ...valid, queryValue: "EventISTA" });
    const conflict = await restore(id);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error).toMatchObject({ code: "QUERY_DUPLICATE", details: { existingId: replacement } });
  });

  it.each(["analyst", "viewer"] as const)("FR-015: %s cannot mutate → 403 FORBIDDEN_ROLE; can read", async (who) => {
    const id = await create();
    for (const res of [
      await post(valid, who),
      await patch(id, { displayName: "x" }, who),
      await del(id, who),
      await restore(id, who),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
    }
    expect((await get("", who)).status).toBe(200);
    expect((await get(`/${id}`, who)).status).toBe(200);
  });

  it("non-member → 403 FORBIDDEN_PROJECT", async () => {
    const res = await get("", "outsider");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_PROJECT");
  });

  it("project scope: a query of project B is 404 under project A; unknown → 404; bad uuid → 400", async () => {
    const otherId = await create(valid, otherProjectId, "adminB");
    expect((await get(`/${otherId}`)).status).toBe(404);
    expect((await patch(otherId, { displayName: "x" })).status).toBe(404);
    expect((await del(otherId)).status).toBe(404);
    const missing = await get(`/${randomUUID()}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("NOT_FOUND");
    expect((await get("/not-a-uuid")).status).toBe(400);
  });

  it("FR-051: list filters, keyset pagination, count, bad cursor", async () => {
    const a = await create({ ...valid, queryValue: "a" });
    const b = await create({ ...valid, queryValue: "b", queryType: "topic_tag" });
    const c = await create({ ...valid, queryValue: "c", enabled: false });
    expect((await get("?enabled=false")).body.items.map((q: { id: string }) => q.id)).toEqual([c]);
    expect((await get("?type=topic_tag")).body.items.map((q: { id: string }) => q.id)).toEqual([b]);
    const p1 = await get("?limit=2&count=true");
    expect(p1.body.totalCount).toBe(3);
    expect(p1.body.items.map((q: { id: string }) => q.id)).toEqual([c, b]);
    const p2 = await get(`?limit=2&cursor=${p1.body.nextCursor as string}`);
    expect(p2.body.items.map((q: { id: string }) => q.id)).toEqual([a]);
    expect(p2.body.nextCursor).toBeNull();
    const bad = await get("?cursor=garbage");
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("#188 FR-051: keyset keeps µs — queries inside one millisecond page exactly once", async () => {
    const micros = [5, 1, 7, 3, 3, 0, 6];
    const ids: string[] = [];
    for (let i = 0; i < micros.length; i++) ids.push(await create({ ...valid, queryValue: `q${i}` }));
    for (const [i, id] of ids.entries())
      await prisma.$executeRaw(
        Prisma.sql`UPDATE listening_queries SET created_at = timestamptz '2026-10-01T00:00:00.123Z' + make_interval(secs => ${micros[i]}::float8 / 1e6) WHERE id = ${id}::uuid`,
      );
    expect((await del(ids[0] as string)).status).toBeLessThan(300);
    const walk = async (extra: string) => {
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const res = await get(`?limit=2${extra}${cursor ? `&cursor=${cursor}` : ""}`);
        expect(res.status).toBe(200);
        seen.push(...res.body.items.map((q: { id: string }) => q.id));
        cursor = res.body.nextCursor as string | null;
      } while (cursor);
      return seen;
    };
    const expected = async (withDeleted: boolean) =>
      (
        await prisma.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id::text AS id FROM listening_queries WHERE project_id = ${projectId}::uuid
            ${withDeleted ? Prisma.empty : Prisma.sql`AND deleted_at IS NULL`} ORDER BY created_at DESC, id DESC`,
        )
      ).map((r) => r.id);
    const active = await walk("");
    expect(active).toHaveLength(6);
    expect(new Set(active).size).toBe(6);
    expect(active).toEqual(await expected(false));
    const all = await walk("&includeDeleted=true");
    expect(all).toHaveLength(7);
    expect(all).toEqual(await expected(true));
  });
});
