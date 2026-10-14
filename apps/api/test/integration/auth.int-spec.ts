import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { MeResponseSchema } from "@how-about-me/contracts";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";

/** T-030: Supabase JWT guard + GET /me + lazy profile upsert — FR-013, FR-017, FR-033. */
describe("auth: JWT guard, /me, profile upsert (T-030)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const me = () => request(app.getHttpServer()).get("/api/v1/me");

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(async () => resetDb(prisma));
  afterAll(async () => app.close());

  it("TC-AUTH-005: no Authorization header → 401 AUTH_MISSING_TOKEN with requestId", async () => {
    const res = await me();
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_MISSING_TOKEN");
    expect(typeof res.body.error.requestId).toBe("string");
  });

  it("TC-AUTH-006: tampered signature → 401 AUTH_INVALID_TOKEN", async () => {
    const token = await mintTestJwt({ sub: randomUUID(), email: "a@example.com" });
    const tampered = token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA");
    const res = await me().set("authorization", `Bearer ${tampered}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_INVALID_TOKEN");
  });

  it("TC-AUTH-007: expired token → 401 AUTH_TOKEN_EXPIRED", async () => {
    const token = await mintTestJwt({
      sub: randomUUID(),
      email: "a@example.com",
      expiresIn: Math.floor(Date.now() / 1000) - 60,
    });
    const res = await me().set("authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_TOKEN_EXPIRED");
  });

  it("anonymous Supabase user → 401 AUTH_INVALID_TOKEN", async () => {
    const token = await mintTestJwt({ sub: randomUUID(), email: "", extra: { is_anonymous: true } });
    const res = await me().set("authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_INVALID_TOKEN");
  });

  it("TC-AUTH-013: first login upserts profile (lowercase email, displayName, lastLoginAt); repeat creates no row", async () => {
    const sub = randomUUID();
    const token = await mintTestJwt({ sub, email: "New.User@Example.com", name: "New User" });
    const res = await me().set("authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const body = MeResponseSchema.parse(res.body);
    expect(body).toMatchObject({ id: sub, email: "new.user@example.com", displayName: "New User", projects: [] });
    const row = await prisma.userProfile.findUniqueOrThrow({ where: { id: sub } });
    expect(row.lastLoginAt).not.toBeNull();

    // Within the 5-minute throttle window lastLoginAt is not rewritten.
    expect((await me().set("authorization", `Bearer ${token}`)).status).toBe(200);
    expect(await prisma.userProfile.count()).toBe(1);
    const again = await prisma.userProfile.findUniqueOrThrow({ where: { id: sub } });
    expect(again.lastLoginAt?.getTime()).toBe(row.lastLoginAt?.getTime());

    // Stale lastLoginAt (> 5 min) is refreshed.
    const stale = new Date(Date.now() - 10 * 60_000);
    await prisma.userProfile.update({ where: { id: sub }, data: { lastLoginAt: stale } });
    await me().set("authorization", `Bearer ${token}`);
    const refreshed = await prisma.userProfile.findUniqueOrThrow({ where: { id: sub } });
    expect(refreshed.lastLoginAt?.getTime() ?? 0).toBeGreaterThan(stale.getTime());
  });

  it("concurrent first-login requests all succeed (no P2002 → 500)", async () => {
    const token = await mintTestJwt({ sub: randomUUID(), email: "race@example.com" });
    // #258: allSettled + error code/debug so a failure message explains itself (P1001 / too many clients / ...).
    const settled = await Promise.allSettled(
      Array.from({ length: 5 }, () => me().set("authorization", `Bearer ${token}`)),
    );
    const outcomes = settled.map((s) =>
      s.status === "fulfilled"
        ? {
            status: s.value.status,
            code: s.value.body?.error?.code as string | undefined,
            debug: s.value.body?.error?.details?.debug?.message as string | undefined,
          }
        : { status: 0, code: (s.reason as { code?: string })?.code, debug: String(s.reason) },
    );
    expect(outcomes).toEqual(Array.from({ length: 5 }, () => ({ status: 200, code: undefined, debug: undefined })));
    expect(await prisma.userProfile.count()).toBe(1);
  });

  it("FR-033: invitation placeholder is re-keyed; /me lists active projects with role, hides inactive", async () => {
    const placeholderId = randomUUID();
    const active = randomUUID();
    const inactive = randomUUID();
    await prisma.userProfile.create({ data: { id: placeholderId, email: "invited@example.com" } });
    await prisma.monitoringProject.createMany({
      data: [
        { id: active, name: "Active", slug: "active" },
        { id: inactive, name: "Inactive", slug: "inactive", isActive: false },
      ],
    });
    await prisma.projectMember.createMany({
      data: [
        { projectId: active, userId: placeholderId, role: "analyst" },
        { projectId: inactive, userId: placeholderId, role: "analyst" },
      ],
    });

    const sub = randomUUID();
    const token = await mintTestJwt({ sub, email: "Invited@Example.com", name: "Invitee" });
    const res = await me().set("authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const body = MeResponseSchema.parse(res.body);
    expect(body.id).toBe(sub);
    expect(body.projects.map((p) => [p.id, p.role])).toEqual([[active, "analyst"]]);
    expect(await prisma.userProfile.findUnique({ where: { id: placeholderId } })).toBeNull();
    expect(await prisma.projectMember.count({ where: { userId: sub } })).toBe(2);
  });

  it("TC-SYS-006: @Public health route needs no token", async () => {
    expect((await request(app.getHttpServer()).get("/health/live")).status).toBe(200);
  });
});
