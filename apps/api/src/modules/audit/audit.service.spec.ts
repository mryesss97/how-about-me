import type { Prisma } from "@prisma/client";
import type { PinoLogger } from "nestjs-pino";
import { encodeCursor } from "../../common/pagination/cursor";
import { AuditRepository, buildAuditWhere, cursorWhere, toAuditLog } from "./audit.repository";
import { AuditService } from "./audit.service";
import type { PrismaService } from "../../database/prisma.service";

const PID = "00000000-0000-7000-8000-000000000001";
const logger = () => ({ setContext: jest.fn(), warn: jest.fn() }) as unknown as PinoLogger & { warn: jest.Mock };

/** FR-200: record sanitizes metadata, carries requestId, respects tx semantics. */
describe("AuditService.record (FR-200)", () => {
  it("passes sanitized metadata + requestId to the repository", async () => {
    const repo = { create: jest.fn().mockResolvedValue(undefined) } as unknown as AuditRepository & {
      create: jest.Mock;
    };
    const svc = new AuditService(repo, logger());
    await svc.record({
      projectId: PID,
      actorUserId: null,
      action: "member.role_changed",
      entityId: "u1",
      metadata: { role: "admin", token: "nope" },
      requestId: "req-1",
    });
    expect(repo.create).toHaveBeenCalledWith({
      projectId: PID,
      actorUserId: null,
      action: "member.role_changed",
      entityType: null,
      entityId: "u1",
      metadata: { role: "admin" },
      requestId: "req-1",
    });
  });

  it("uses tx and propagates failures inside a transaction", async () => {
    const repo = { create: jest.fn().mockRejectedValue(new Error("db")) } as unknown as AuditRepository & {
      create: jest.Mock;
    };
    const tx = {} as Prisma.TransactionClient;
    const svc = new AuditService(repo, logger());
    await expect(svc.record({ projectId: PID, actorUserId: null, action: "project.updated" }, tx)).rejects.toThrow(
      "db",
    );
    expect(repo.create.mock.calls[0][1]).toBe(tx);
  });

  it("outside a transaction logs warn without metadata and does not throw", async () => {
    const repo = { create: jest.fn().mockRejectedValue(new Error("db")) } as unknown as AuditRepository;
    const log = logger();
    const svc = new AuditService(repo, log);
    await expect(
      svc.record({ projectId: PID, actorUserId: null, action: "project.updated", metadata: { reason: "r" } }),
    ).resolves.toBeUndefined();
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.warn.mock.calls[0])).not.toContain("reason");
  });
});

/** FR-201: list filters + keyset pagination. */
describe("AuditRepository (FR-201)", () => {
  it("builds where with project scope, action, actor, from inclusive / to exclusive", () => {
    expect(
      buildAuditWhere(PID, {
        limit: 25,
        count: false,
        action: "query.created",
        actorUserId: "a",
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-01-02T00:00:00.000Z",
      }),
    ).toEqual({
      projectId: PID,
      action: "query.created",
      actorUserId: "a",
      createdAt: { gte: new Date("2026-01-01T00:00:00.000Z"), lt: new Date("2026-01-02T00:00:00.000Z") },
    });
    expect(buildAuditWhere(PID, { limit: 25, count: false })).toEqual({ projectId: PID });
  });

  it("cursorWhere rejects a non-date key", () => {
    expect(() => cursorWhere({ key: "nope", id: "x" })).toThrow("Invalid cursor");
  });

  it("returns nextCursor when there are more than limit rows and maps actor null", async () => {
    const mk = (i: number) => ({
      id: `id-${i}`,
      action: "project.updated",
      entityType: null,
      entityId: null,
      metadata: null,
      requestId: null,
      createdAt: new Date(Date.UTC(2026, 0, 3 - i)),
      actor: null,
    });
    const findMany = jest.fn().mockResolvedValue([mk(0), mk(1), mk(2)]);
    const count = jest.fn().mockResolvedValue(7);
    const repo = new AuditRepository({ auditLog: { findMany, count } } as unknown as PrismaService);
    const page = await repo.list(PID, { limit: 2, count: true });
    expect(page.items.map((i) => i.id)).toEqual(["id-0", "id-1"]);
    expect(page.nextCursor).toBe(encodeCursor({ key: mk(1).createdAt.toISOString(), id: "id-1" }));
    expect(page.totalCount).toBe(7);
    expect(page.items[0]?.actor).toBeNull();
    expect(findMany.mock.calls[0][0].take).toBe(3);
  });

  it("toAuditLog maps actor and non-object metadata to null", () => {
    const out = toAuditLog({
      id: "i",
      action: "a",
      entityType: "member",
      entityId: "e",
      metadata: [1] as Prisma.JsonValue,
      requestId: "r",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      actor: { id: "u", displayName: null, email: "u@example.com" },
    });
    expect(out.metadata).toBeNull();
    expect(out.actor).toEqual({ id: "u", displayName: null, email: "u@example.com" });
  });
});
