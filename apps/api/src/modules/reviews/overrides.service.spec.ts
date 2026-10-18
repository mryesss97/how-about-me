import type { Prisma } from "@prisma/client";
import { Prisma as P } from "@prisma/client";
import type { AuditService } from "../audit/audit.service";
import type { OverrideRow, OverridesRepository } from "./overrides.repository";
import { normalizeOverrideValue, OverridesService } from "./overrides.service";

const PID = "00000000-0000-7000-8000-000000000001";
const MID = "00000000-0000-7000-8000-000000000002";
const ACTOR = "00000000-0000-7000-8000-000000000003";
const AID = "00000000-0000-7000-8000-000000000004";
const OID = "00000000-0000-7000-8000-000000000005";
const NOW = new Date("2026-10-13T00:00:00Z");

const row = (over: Partial<OverrideRow> = {}): OverrideRow => ({
  id: OID,
  postId: MID,
  field: "sentiment",
  previousValue: { value: "negative" },
  overrideValue: { value: "neutral" },
  reason: null,
  reviewedBy: ACTOR,
  createdAt: NOW,
  revokedAt: null,
  revokedBy: null,
  ...over,
});

function setup(opts: {
  post?: { id: string; currentAnalysisId: string | null } | null;
  ai?: string | string[] | null;
  active?: OverrideRow | null;
  byId?: OverrideRow | null;
  insertError?: unknown;
}) {
  const tx = {} as Prisma.TransactionClient;
  const repo = {
    transaction: jest.fn((fn: (t: Prisma.TransactionClient) => Promise<unknown>) => fn(tx)),
    lockPostInProject: jest
      .fn()
      .mockResolvedValue(opts.post === undefined ? { id: MID, currentAnalysisId: AID } : opts.post),
    aiValue: jest.fn().mockResolvedValue(opts.ai === undefined ? "negative" : opts.ai),
    findActive: jest.fn().mockResolvedValue(opts.active ?? null),
    findById: jest.fn().mockResolvedValue(opts.byId ?? null),
    revoke: jest.fn().mockResolvedValue(undefined),
    insert: opts.insertError
      ? jest.fn().mockRejectedValue(opts.insertError)
      : jest.fn((_tx: unknown, d: { id: string; overrideValue: unknown; previousValue: unknown; field: string }) =>
          Promise.resolve(row({ id: d.id, overrideValue: d.overrideValue, previousValue: d.previousValue })),
        ),
    usersById: jest.fn().mockResolvedValue(new Map([[ACTOR, { id: ACTOR, displayName: "An", email: "a@x.io" }]])),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const svc = new OverridesService(repo as unknown as OverridesRepository, audit as unknown as AuditService);
  return { svc, repo, audit, tx };
}

/** T-142 — FR-191, BR-025, FR-200. */
describe("OverridesService.create", () => {
  it("FR-191: inserts with AI snapshot as previous value and audits override.created (FR-200)", async () => {
    const { svc, repo, audit, tx } = setup({});
    const o = await svc.create(PID, MID, { field: "sentiment", value: "neutral", reason: "sarcasm" }, ACTOR, "r1", NOW);
    expect(repo.insert).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        postId: MID,
        projectId: PID,
        analysisId: AID,
        field: "sentiment",
        previousValue: { value: "negative" },
        overrideValue: { value: "neutral" },
        reason: "sarcasm",
        reviewedBy: ACTOR,
      }),
    );
    expect(repo.revoke).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "override.created",
        entityType: "analysis_override",
        // FR-200 / #393: post id (no post text) so the audit log can link the mention.
        metadata: { field: "sentiment", before: "negative", after: "neutral", reason: null, postIds: [MID] },
        requestId: "r1",
      }),
      tx,
    );
    expect(o).toMatchObject({ previousValue: "negative", value: "neutral", reviewedBy: { id: ACTOR } });
  });

  it("doc 07 §10: active override on same field → revoke + audit override.revoked, then created", async () => {
    const active = row({ id: "old" });
    const { svc, repo, audit, tx } = setup({ active });
    await svc.create(PID, MID, { field: "sentiment", value: "positive" }, ACTOR, null, NOW);
    expect(repo.revoke).toHaveBeenCalledWith(tx, "old", ACTOR, NOW);
    expect(audit.record.mock.calls.map((c) => (c[0] as { action: string }).action)).toEqual([
      "override.revoked",
      "override.created",
    ]);
    expect(audit.record.mock.calls[0]?.[0]).toMatchObject({
      entityId: "old",
      metadata: { field: "sentiment", before: "neutral", postIds: [MID] },
    });
  });

  it("mention missing / other project → 404 NOT_FOUND, no audit", async () => {
    const { svc, audit, repo } = setup({ post: null });
    await expect(svc.create(PID, MID, { field: "relevance", value: "irrelevant" }, ACTOR, null)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(repo.insert).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("unanalysed post → analysisId null, previousValue null", async () => {
    const { svc, repo } = setup({ post: { id: MID, currentAnalysisId: null } });
    await svc.create(PID, MID, { field: "relevance", value: "relevant" }, ACTOR, null);
    expect(repo.aiValue).not.toHaveBeenCalled();
    expect(repo.insert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ analysisId: null, previousValue: null }),
    );
  });

  it("intents are deduped in order; [] allowed", async () => {
    expect(normalizeOverrideValue({ field: "intents", value: ["complaint", "complaint", "praise"] })).toEqual([
      "complaint",
      "praise",
    ]);
    expect(normalizeOverrideValue({ field: "topics", value: [] })).toEqual([]);
  });

  it("P2002 from active partial unique → 409 OVERRIDE_CONFLICT (never 500)", async () => {
    const err = new P.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6" });
    const { svc } = setup({ insertError: err });
    await expect(svc.create(PID, MID, { field: "sentiment", value: "neutral" }, ACTOR, null)).rejects.toMatchObject({
      code: "OVERRIDE_CONFLICT",
      status: 409,
    });
  });
});

/** T-142 — FR-193: revoke keeps history. */
describe("OverridesService.revoke", () => {
  it("revokes and audits override.revoked", async () => {
    const { svc, repo, audit, tx } = setup({ byId: row() });
    await svc.revoke(PID, MID, OID, ACTOR, "r2", NOW);
    expect(repo.findById).toHaveBeenCalledWith(tx, MID, OID);
    expect(repo.revoke).toHaveBeenCalledWith(tx, OID, ACTOR, NOW);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "override.revoked", entityId: OID }),
      tx,
    );
  });

  it("override not on this mention → 404", async () => {
    const { svc, audit } = setup({ byId: null });
    await expect(svc.revoke(PID, MID, OID, ACTOR, null)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("mention not in project → 404", async () => {
    const { svc } = setup({ post: null });
    await expect(svc.revoke(PID, MID, OID, ACTOR, null)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("already revoked → idempotent no-op, no audit", async () => {
    const { svc, repo, audit } = setup({ byId: row({ revokedAt: NOW, revokedBy: ACTOR }) });
    await expect(svc.revoke(PID, MID, OID, ACTOR, null)).resolves.toBeUndefined();
    expect(repo.revoke).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
