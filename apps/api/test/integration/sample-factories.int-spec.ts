import type { INestApplication } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../../src/database/prisma.service";
import { api, createActor, createPost, createProject, createQuery, createTestApp, resetDb } from "../helpers";

/**
 * T-014 sample: how to write an API integration spec with factories + actors.
 * TODO(T-042): once listening-query routes exist, add `POST /projects/:id/queries → GET list` over HTTP.
 */
describe("Sample: factories + actors (T-014)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(async () => resetDb(prisma));
  afterAll(async () => app.close());

  it("GET /projects lists only the actor's projects with role", async () => {
    const a = await createProject(prisma);
    await createProject(prisma);
    const admin = await createActor(prisma, { projectId: a.id, role: "admin" });
    const res = await api(app, admin.token).get("/projects");
    expect(res.status).toBe(200);
    expect(res.body.map((p: { id: string; role: string }) => [p.id, p.role])).toEqual([[a.id, "admin"]]);
  });

  it("createQuery + createPost({ queryId }) creates one match; duplicate (platform, platform_post_id) → P2002", async () => {
    const project = await createProject(prisma);
    const query = await createQuery(prisma, { projectId: project.id });
    const post = await createPost(prisma, { projectId: project.id, queryId: query.id });
    expect(await prisma.postQueryMatch.count({ where: { queryId: query.id } })).toBe(1);
    // BR-001: posts are unique on (platform, platform_post_id).
    const dup = createPost(prisma, { projectId: project.id, platformPostId: post.platformPostId });
    await expect(dup).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    await expect(dup).rejects.toMatchObject({ code: "P2002" });
  });

  it("outsider → 403 FORBIDDEN_PROJECT on GET /projects/:id", async () => {
    const project = await createProject(prisma);
    const outsider = await createActor(prisma);
    const res = await api(app, outsider.token).get(`/projects/${project.id}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_PROJECT");
  });
});
