import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";

/** T-038: Threads integration — FR-040..FR-044, BR-034, BR-036; TC-INT-001..007. */
describe("Integrations / Threads (T-038)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let p1: string;
  let p2: string;
  const TOKEN = "THREADS-PLAINTEXT-TOKEN-abcdefghijklmnop";
  const users = {} as Record<"admin" | "analyst" | "viewer" | "outsider", { id: string; token: string }>;
  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof users) => ({ authorization: `Bearer ${users[who].token}` });
  const url = () => `/api/v1/projects/${p1}/integrations/threads`;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(async () => {
    await resetDb(prisma);
    p1 = randomUUID();
    p2 = randomUUID();
    await prisma.monitoringProject.create({ data: { id: p1, name: "P1", slug: `p1-${p1}` } });
    await prisma.monitoringProject.create({ data: { id: p2, name: "P2", slug: `p2-${p2}` } });
    for (const who of ["admin", "analyst", "viewer", "outsider"] as const) {
      const id = randomUUID();
      const email = `${who}@example.com`;
      await prisma.userProfile.create({ data: { id, email } });
      if (who === "outsider") await prisma.projectMember.create({ data: { projectId: p2, userId: id, role: "admin" } });
      else await prisma.projectMember.create({ data: { projectId: p1, userId: id, role: who } });
      users[who] = { id, token: await mintTestJwt({ sub: id, email }) };
    }
  });
  afterAll(async () => app.close());

  it("GET before configuration → default disconnected", async () => {
    const res = await http().get(url()).set(auth("viewer"));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "disconnected", grantedScopes: [], lastError: null });
  });

  it("TC-INT-001/TC-INT-003: admin PUT → 200, no token in response, DB or audit (BR-034, BR-036)", async () => {
    const res = await http().put(url()).set(auth("admin")).send({ accessToken: TOKEN });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("disconnected");
    expect(JSON.stringify(res.body)).not.toContain(TOKEN);
    const secrets = await prisma.integrationSecret.findMany();
    expect(secrets).toHaveLength(1);
    const [secret] = secrets;
    expect(Buffer.from(secret?.ciphertext ?? new Uint8Array()).toString("utf8")).not.toContain(TOKEN);
    const logs = await prisma.auditLog.findMany({ where: { projectId: p1, action: "integration.updated" } });
    expect(logs).toHaveLength(1);
    expect(JSON.stringify(logs[0]?.metadata)).not.toContain(TOKEN);
  });

  it("TC-INT-002: analyst PUT / viewer verify & DELETE → 403 FORBIDDEN_ROLE", async () => {
    const put = await http().put(url()).set(auth("analyst")).send({ accessToken: TOKEN });
    expect(put.status).toBe(403);
    expect(put.body.error.code).toBe("FORBIDDEN_ROLE");
    const verify = await http().post(`${url()}/verify`).set(auth("viewer"));
    expect(verify.body.error.code).toBe("FORBIDDEN_ROLE");
    const del = await http().delete(url()).set(auth("viewer"));
    expect(del.body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("PUT with a too-short token → 400 VALIDATION_ERROR without echoing it", async () => {
    const res = await http().put(url()).set(auth("admin")).send({ accessToken: "short-secret" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("short-secret");
  });

  it("TC-INT-004: verify with the fake provider → connected", async () => {
    await http().put(url()).set(auth("admin")).send({ accessToken: TOKEN });
    const res = await http().post(`${url()}/verify`).set(auth("admin"));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "connected", accountIdentifier: "fake_brand_account", lastError: null });
    expect(res.body.lastVerifiedAt).not.toBeNull();
  });

  it("TC-INT-005: invalid token → 502 THREADS_UNAUTHORIZED and status expired persisted", async () => {
    await http().put(url()).set(auth("admin")).send({ accessToken: "fake-invalid-xxxxxxxxxxxxxxxx" });
    const res = await http().post(`${url()}/verify`).set(auth("admin"));
    expect(res.status).toBe(502);
    expect(res.body.error).toMatchObject({ code: "THREADS_UNAUTHORIZED" });
    const get = await http().get(url()).set(auth("viewer"));
    expect(get.body.status).toBe("expired");
    expect(get.body.lastError.code).toBe("THREADS_UNAUTHORIZED");
  });

  it("verify without a token → 409 INTEGRATION_NOT_CONFIGURED", async () => {
    const res = await http().post(`${url()}/verify`).set(auth("admin"));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INTEGRATION_NOT_CONFIGURED");
  });

  it("TC-INT-006: viewer GET exposes no secret fields", async () => {
    await http().put(url()).set(auth("admin")).send({ accessToken: TOKEN });
    const res = await http().get(url()).set(auth("viewer"));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/accessToken|secret|ciphertext/);
    expect(JSON.stringify(res.body)).not.toContain(TOKEN);
  });

  it("TC-INT-007: DELETE → 204, disconnected, secret removed, audited", async () => {
    await http().put(url()).set(auth("admin")).send({ accessToken: TOKEN });
    await http().post(`${url()}/verify`).set(auth("admin"));
    const del = await http().delete(url()).set(auth("admin"));
    expect(del.status).toBe(204);
    expect(await prisma.integrationSecret.count()).toBe(0);
    const get = await http().get(url()).set(auth("admin"));
    expect(get.body.status).toBe("disconnected");
    expect(await prisma.auditLog.count({ where: { action: "integration.disconnected" } })).toBe(1);
    expect((await http().delete(url()).set(auth("admin"))).status).toBe(204);
  });

  it("non-member → 403 FORBIDDEN_PROJECT", async () => {
    const res = await http().get(url()).set(auth("outsider"));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_PROJECT");
  });
});
