import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { ProjectSettings, UserRole } from "@how-about-me/contracts";
import { type Access, PERMISSION_MATRIX } from "../../src/common/auth/permission-matrix";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";
import { RBAC_FIXTURE_SEGMENT, RbacFixtureModule } from "../helpers/rbac-fixture.module";
import { discoverRoutes } from "../helpers/route-discovery";

/** T-031: RBAC role matrix — FR-014, FR-015, FR-016, FR-032; TC-AUTH-009/010/011/012/018. */
describe("RBAC: ProjectRoleGuard, @Roles, project setting gates (T-031)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  const tokens = {} as Record<UserRole | "outsider", string>;
  const ROLES: UserRole[] = ["admin", "analyst", "viewer"];
  const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  const api = (method: string, path: string, who: keyof typeof tokens) => {
    const agent = request(app.getHttpServer());
    const url = `/api/v1/${path.replace(":projectId", projectId)}`;
    const m = method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";
    return agent[m](url).set("authorization", `Bearer ${tokens[who]}`).send({});
  };
  const setSettings = (settings: Partial<ProjectSettings>) =>
    prisma.monitoringProject.update({ where: { id: projectId }, data: { settings } });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({ imports: [RbacFixtureModule] }));
  });
  beforeEach(async () => {
    await resetDb(prisma);
    projectId = randomUUID();
    await prisma.monitoringProject.create({ data: { id: projectId, name: "RBAC", slug: `rbac-${projectId}` } });
    for (const who of [...ROLES, "outsider"] as const) {
      const id = randomUUID();
      const email = `${who}@example.com`;
      await prisma.userProfile.create({ data: { id, email } });
      if (who !== "outsider") await prisma.projectMember.create({ data: { projectId, userId: id, role: who } });
      tokens[who] = await mintTestJwt({ sub: id, email });
    }
  });
  afterAll(async () => app.close());

  it("TC-AUTH-012: every mutating /projects/:projectId route has @Roles and matches PERMISSION_MATRIX", () => {
    const routes = discoverRoutes(app).filter(
      (r) => r.path.startsWith("projects/:projectId") && !r.path.split("/").includes(RBAC_FIXTURE_SEGMENT),
    );
    // Guard against a vacuous pass if discovery breaks.
    expect(routes.map((r) => `${r.method} ${r.path}`)).toContain("GET projects/:projectId");
    const problems: string[] = [];
    for (const r of routes) {
      const key = `${r.method} ${r.path}`;
      const entry = PERMISSION_MATRIX.find((e) => e.method === r.method && e.path === r.path);
      if (MUTATING.has(r.method) && r.roles.length === 0) problems.push(`${key}: missing @Roles`);
      if (!entry) {
        if (MUTATING.has(r.method)) problems.push(`${key}: missing PERMISSION_MATRIX entry`);
        continue;
      }
      if (entry.status !== "implemented") problems.push(`${key}: route exists but matrix status is planned`);
      for (const role of ROLES) {
        const access: Access = entry[role];
        const listed = r.roles.length === 0 || r.roles.includes(role);
        const gate = r.gates.find((g) => g.role === role);
        const actual: Access = !listed ? "deny" : gate ? { setting: gate.setting } : "allow";
        if (JSON.stringify(actual) !== JSON.stringify(access))
          problems.push(`${key}: ${role} is ${JSON.stringify(actual)}, matrix says ${JSON.stringify(access)}`);
      }
    }
    expect(problems).toEqual([]);
  });

  describe("table-driven matrix on implemented routes (TC-AUTH-012)", () => {
    const cases = PERMISSION_MATRIX.filter((e) => e.status === "implemented").flatMap((e) =>
      ROLES.map((role) => [e.method, e.path, role, e[role]] as const),
    );
    it.each(cases)("%s %s as %s → %j", async (method, path, role, access) => {
      if (typeof access === "object") await setSettings({ [access.setting]: true });
      const res = await api(method, path, role);
      if (access === "deny") {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
      } else {
        // Guard runs before pipes; an allowed role may still get 400 for an empty body.
        expect(res.status).not.toBe(403);
      }
    });
  });

  const fx = (name: string) => `projects/:projectId/${RBAC_FIXTURE_SEGMENT}/${name}`;

  it("TC-AUTH-009 (fixture, pending real route T-0xx): viewer POST admin-only → 403 FORBIDDEN_ROLE", async () => {
    const res = await api("POST", fx("admin-only"), "viewer");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
    expect(typeof res.body.error.requestId).toBe("string");
    expect((await api("POST", fx("admin-only"), "admin")).status).toBe(202);
  });

  it("TC-AUTH-010 (fixture, pending real route T-034): analyst PATCH admin-only → 403 FORBIDDEN_ROLE", async () => {
    const res = await api("PATCH", fx("admin-only"), "analyst");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("TC-AUTH-011: non-member → 403 FORBIDDEN_PROJECT on real and fixture routes; unknown project leaks nothing", async () => {
    for (const path of ["projects/:projectId", fx("read")]) {
      const res = await api("GET", path, "outsider");
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN_PROJECT");
    }
    const existing = await api("GET", "projects/:projectId", "outsider");
    const unknown = await request(app.getHttpServer())
      .get(`/api/v1/projects/${randomUUID()}`)
      .set("authorization", `Bearer ${tokens.outsider}`);
    expect(unknown.status).toBe(403);
    expect(unknown.body.error.code).toBe("FORBIDDEN_PROJECT");
    expect(unknown.body.error.message).toBe(existing.body.error.message);
    expect(Object.keys(unknown.body)).toEqual(["error"]);
  });

  it("TC-AUTH-018 (fixture): allowAnalystReanalyze gates analyst; admin always allowed; viewer always denied", async () => {
    await setSettings({ allowAnalystReanalyze: false });
    const denied = await api("POST", fx("reanalyze"), "analyst");
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("FORBIDDEN_ROLE");
    expect(denied.body.error.message).toContain("allowAnalystReanalyze");
    expect((await api("POST", fx("reanalyze"), "admin")).status).toBe(202);
    expect((await api("POST", fx("reanalyze"), "viewer")).status).toBe(403);

    await setSettings({ allowAnalystReanalyze: true });
    expect((await api("POST", fx("reanalyze"), "analyst")).status).toBe(202);
    expect((await api("POST", fx("reanalyze"), "viewer")).status).toBe(403);
  });

  it("allowAnalystReanalyze defaults to true when settings is empty", async () => {
    expect((await api("POST", fx("reanalyze"), "analyst")).status).toBe(202);
  });

  it("allowViewerExport: viewer denied by default, allowed when enabled; analyst/admin always allowed", async () => {
    const denied = await api("POST", fx("export"), "viewer");
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("FORBIDDEN_ROLE");
    expect((await api("POST", fx("export"), "analyst")).status).toBe(202);
    expect((await api("POST", fx("export"), "admin")).status).toBe(202);

    await setSettings({ allowViewerExport: true });
    expect((await api("POST", fx("export"), "viewer")).status).toBe(202);
  });

  it("no token on a project route → 401 AUTH_MISSING_TOKEN", async () => {
    const res = await request(app.getHttpServer()).post(
      `/api/v1/projects/${projectId}/${RBAC_FIXTURE_SEGMENT}/admin-only`,
    );
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_MISSING_TOKEN");
  });
});
