import { Body, Controller, type INestApplication, Module, Post } from "@nestjs/common";
import { PrismaHealthIndicator } from "@nestjs/terminus";
import request from "supertest";
import { z } from "zod";
import { Public } from "../../src/common/auth/public.decorator";
import { zod } from "../../src/common/pipes/zod-validation.pipe";
import { createTestApp } from "../helpers/app";

const ProbeSchema = z.object({ email: z.email(), items: z.array(z.object({ name: z.string() })) });

/** Test-only route to exercise the global Zod pipe → filter path (NFR-015). Never registered in prod. */
@Controller("__test")
class ValidationProbeController {
  @Public()
  @Post("validate")
  validate(@Body(zod(ProbeSchema)) body: z.infer<typeof ProbeSchema>) {
    return body;
  }
}

@Module({ controllers: [ValidationProbeController] })
class ValidationProbeModule {}

describe("foundation: health, request id, error envelope, validation, swagger (T-012)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp({ imports: [ValidationProbeModule] }));
  });
  afterAll(async () => app.close());

  it("TC-SYS-006: GET /health/live without token → 200 ok", async () => {
    const res = await request(app.getHttpServer()).get("/health/live");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("echoes a safe x-request-id in header and error envelope", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/me").set("x-request-id", "abc-123");
    expect(res.status).toBe(401);
    expect(res.headers["x-request-id"]).toBe("abc-123");
    expect(res.body.error.requestId).toBe("abc-123");
  });

  it("replaces an unsafe x-request-id with a fresh one used consistently", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/me").set("x-request-id", "a".repeat(200));
    const id = res.headers["x-request-id"];
    expect(id).toBeTruthy();
    expect(id).not.toBe("a".repeat(200));
    expect(res.body.error.requestId).toBe(id);
  });

  it("NFR-015: invalid body → 400 VALIDATION_ERROR with field paths", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/__test/validate")
      .send({ email: "nope", items: [{}] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const paths = res.body.error.details.issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(["email", "items.0.name"]));
  });

  it("serves OpenAPI at /api/docs when enabled (non-production default)", async () => {
    const res = await request(app.getHttpServer()).get("/api/docs-json");
    expect(res.status).toBe(200);
    expect(res.body.paths["/health/live"]).toBeDefined();
  });
});

describe("TC-SYS-007: /health/ready with database down", () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp({
      customize: (b) =>
        b.overrideProvider(PrismaHealthIndicator).useValue({
          pingCheck: async (key: string) => ({ [key]: { status: "down", message: "connection refused" } }),
        }),
    }));
  });
  afterAll(async () => app.close());

  it("returns 503 Terminus body (not wrapped in the error envelope)", async () => {
    const res = await request(app.getHttpServer()).get("/health/ready");
    expect(res.status).toBe(503);
    expect(res.body.error.database.status).toBe("down");
    expect(res.body.status).toBe("error");
  });
});
