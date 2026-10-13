import type { Prisma } from "@prisma/client";
import type { AnalysisService } from "../analysis/analysis.service";
import type { AuditService } from "../audit/audit.service";
import type { MentionForReanalyze, MentionsRepository } from "./mentions.repository";
import { MentionsService } from "./mentions.service";

const PID = "00000000-0000-7000-8000-000000000001";
const MID = "00000000-0000-7000-8000-000000000002";
const ACTOR = "00000000-0000-7000-8000-000000000003";
const RUN = "00000000-0000-7000-8000-000000000004";
const post: MentionForReanalyze = { id: MID, projectId: PID, contentHash: "h1", revision: 1 };

function setup(opts: { post?: MentionForReanalyze | null; open?: boolean; created?: boolean }) {
  const tx = {} as Prisma.TransactionClient;
  const repo = {
    findInProject: jest.fn().mockResolvedValue(opts.post === undefined ? post : opts.post),
    hasOpenRun: jest.fn().mockResolvedValue(opts.open ?? false),
    transaction: jest.fn((fn: (t: Prisma.TransactionClient) => Promise<unknown>) => fn(tx)),
  };
  const analysis = {
    effectiveVersion: "v1",
    enqueueDetailed: jest
      .fn()
      .mockResolvedValue(
        opts.created === false ? { created: false, reason: "already_open" } : { created: true, runId: RUN },
      ),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const svc = new MentionsService(
    repo as unknown as MentionsRepository,
    analysis as unknown as AnalysisService,
    audit as unknown as AuditService,
  );
  return { svc, repo, analysis, audit, tx };
}

/** FR-115 / FR-116 / BR-024 — POST …/mentions/:mentionId/reanalyze (T-076). */
describe("MentionsService.reanalyze", () => {
  it("TC-ANA-018: enqueues a manual (force) run and audits it in the same tx", async () => {
    const { svc, analysis, audit, tx } = setup({});
    await expect(svc.reanalyze(PID, MID, ACTOR, "req-1")).resolves.toEqual({ runId: RUN, status: "pending" });
    expect(analysis.enqueueDetailed).toHaveBeenCalledWith(tx, {
      postId: MID,
      projectId: PID,
      contentHash: "h1",
      revision: 1,
      trigger: "manual",
      requestedBy: ACTOR,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "analysis.reanalyze_requested",
        entityId: MID,
        metadata: { runId: RUN, effectiveVersion: "v1" },
        requestId: "req-1",
      }),
      tx,
    );
  });

  it("404 when the mention is not in the project", async () => {
    const { svc, analysis } = setup({ post: null });
    await expect(svc.reanalyze(PID, MID, ACTOR, null)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(analysis.enqueueDetailed).not.toHaveBeenCalled();
  });

  it("TC-ANA-019: 409 when the post already has an open run", async () => {
    const { svc, analysis, audit } = setup({ open: true });
    await expect(svc.reanalyze(PID, MID, ACTOR, null)).rejects.toMatchObject({ code: "ANALYSIS_ALREADY_PENDING" });
    expect(analysis.enqueueDetailed).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("BR-024: a request that loses the race on the partial unique index gets 409, not 500", async () => {
    const { svc, audit } = setup({ created: false });
    await expect(svc.reanalyze(PID, MID, ACTOR, null)).rejects.toMatchObject({ code: "ANALYSIS_ALREADY_PENDING" });
    expect(audit.record).not.toHaveBeenCalled();
  });
});
