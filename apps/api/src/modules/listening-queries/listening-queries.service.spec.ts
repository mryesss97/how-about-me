import { Prisma } from "@prisma/client";
import type { PinoLogger } from "nestjs-pino";
import type { CreateListeningQueryBody } from "@how-about-me/contracts";
import { AppError } from "../../common/errors/app.error";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import {
  type ListeningQueryRow,
  type ListeningQueriesRepository,
  toListeningQuery,
} from "./listening-queries.repository";
import { makeRow } from "./listening-queries.fixtures";
import { diff, ListeningQueriesService, toAuditDiff } from "./listening-queries.service";

const user = { id: "0199a3b4-0000-7000-8000-0000000000aa", email: "a@x.io", displayName: "A" };
const ctx = { projectId: "0199a3b4-0000-7000-8000-000000000002", user, requestId: "req-1" };

function setup(row: ListeningQueryRow = makeRow()) {
  const repo = {
    findById: jest.fn().mockResolvedValue(row),
    findActiveDuplicate: jest.fn().mockResolvedValue(null),
    create: jest.fn(async (d: Prisma.ListeningQueryUncheckedCreateInput) => makeRow(d as Partial<ListeningQueryRow>)),
    update: jest.fn(async (_id: string, d: Partial<ListeningQueryRow>) => ({ ...row, ...d })),
    toDto: jest.fn(async (r: ListeningQueryRow) => toListeningQuery(r, new Map())),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const prisma = { $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})) };
  const logger = { setContext: jest.fn(), info: jest.fn() };
  const svc = new ListeningQueriesService(
    repo as unknown as ListeningQueriesRepository,
    audit as unknown as AuditService,
    prisma as unknown as PrismaService,
    logger as unknown as PinoLogger,
  );
  const actions = () => audit.record.mock.calls.map((c) => (c[0] as { action: string }).action);
  return { svc, repo, audit, actions };
}

const body: CreateListeningQueryBody = {
  displayName: "E",
  queryValue: "eventista",
  queryType: "keyword",
  excludeTerms: [],
  includeTerms: [],
  pollIntervalSeconds: 600,
  overlapSeconds: 1200,
  initialBackfillDays: 1,
  enabled: true,
};

describe("diff (BR-034 audit diff)", () => {
  it("keeps only changed fields; arrays compared in order", () => {
    const row = makeRow({ excludeTerms: ["a", "b"] });
    expect(diff(row, { displayName: "Eventista", excludeTerms: ["a", "b"] })).toEqual({});
    expect(diff(row, { excludeTerms: ["b", "a"], pollIntervalSeconds: 900 })).toEqual({
      excludeTerms: { before: ["a", "b"], after: ["b", "a"] },
      pollIntervalSeconds: { before: 600, after: 900 },
    });
  });
});

describe("toAuditDiff (BR-034)", () => {
  it("splits changes into fields/before/after", () => {
    expect(toAuditDiff({ excludeTerms: { before: [], after: ["x"] } })).toEqual({
      fields: ["excludeTerms"],
      before: { excludeTerms: [] },
      after: { excludeTerms: ["x"] },
    });
  });
});

describe("ListeningQueriesService", () => {
  it("FR-055: enabling sets nextRunAt ≈ now and records only query.enabled", async () => {
    const future = new Date(Date.now() + 3_600_000);
    const { svc, repo, actions } = setup(makeRow({ enabled: false, nextRunAt: future }));
    await svc.update(ctx, "id", { enabled: true });
    const data = repo.update.mock.calls[0]?.[1] as { nextRunAt: Date };
    expect(Math.abs(data.nextRunAt.getTime() - Date.now())).toBeLessThan(5000);
    expect(actions()).toEqual(["query.enabled"]);
  });
  it("FR-055: disabling keeps nextRunAt", async () => {
    const { svc, repo, actions } = setup();
    await svc.update(ctx, "id", { enabled: false });
    expect(repo.update.mock.calls[0]?.[1]).toEqual({ enabled: false });
    expect(actions()).toEqual(["query.disabled"]);
  });
  it("BR-034: displayName + enabled → query.updated and query.disabled", async () => {
    const { svc, actions } = setup();
    await svc.update(ctx, "id", { displayName: "New", enabled: false });
    expect(actions()).toEqual(["query.updated", "query.disabled"]);
  });
  it("no real change → no write, no audit", async () => {
    const { svc, repo, actions } = setup();
    await svc.update(ctx, "id", { displayName: "Eventista", enabled: true });
    expect(repo.update).not.toHaveBeenCalled();
    expect(actions()).toEqual([]);
  });
  it("PATCH on soft-deleted query → NOT_FOUND", async () => {
    const { svc } = setup(makeRow({ deletedAt: new Date() }));
    await expect(svc.update(ctx, "id", { displayName: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("FR-056: create enabled=false → nextRunAt null; BR-008 RECENT; BR-005 searchMode", async () => {
    const { svc, repo, actions } = setup();
    await svc.create(ctx, { ...body, queryValue: "#tag", queryType: "topic_tag", enabled: false });
    expect(repo.create.mock.calls[0]?.[0]).toMatchObject({
      nextRunAt: null,
      scheduledSearchType: "RECENT",
      searchMode: "TAG",
      queryValue: "tag",
      createdBy: user.id,
    });
    expect(actions()).toEqual(["query.created"]);
  });
  it("BR-006: duplicate pre-check → QUERY_DUPLICATE with existingId", async () => {
    const { svc, repo } = setup();
    repo.findActiveDuplicate.mockResolvedValueOnce("existing-1");
    await expect(svc.create(ctx, body)).rejects.toMatchObject({
      code: "QUERY_DUPLICATE",
      details: { existingId: "existing-1" },
    });
  });
  it("BR-006: P2002 race → QUERY_DUPLICATE with existingId re-read after the transaction", async () => {
    const { svc, repo } = setup();
    repo.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "x" }),
    );
    repo.findActiveDuplicate.mockResolvedValueOnce(null).mockResolvedValueOnce("winner");
    const err: unknown = await svc.create(ctx, body).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ code: "QUERY_DUPLICATE", details: { existingId: "winner" } });
  });
  it("FR-057: delete is idempotent; restore of active query is a no-op", async () => {
    const deleted = setup(makeRow({ deletedAt: new Date() }));
    await deleted.svc.softDelete(ctx, "id");
    expect(deleted.actions()).toEqual([]);
    const active = setup();
    await active.svc.restore(ctx, "id");
    expect(active.repo.update).not.toHaveBeenCalled();
    expect(active.actions()).toEqual([]);
  });
});
