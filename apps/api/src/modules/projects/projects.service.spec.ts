import type { Prisma } from "@prisma/client";
import { UpdateProjectBodySchema } from "@how-about-me/contracts";
import type { AuditService } from "../audit/audit.service";
import type { ProjectRow } from "./projects.mapper";
import type { ProjectsRepository } from "./projects.repository";
import { ProjectsService } from "./projects.service";

const PID = "00000000-0000-7000-8000-000000000001";
const ACTOR = "00000000-0000-7000-8000-000000000002";
const row = (over: Partial<ProjectRow> = {}): ProjectRow => ({
  id: PID,
  name: "P1",
  slug: "p1",
  description: null,
  timezone: "Asia/Ho_Chi_Minh",
  settings: { allowAnalystReanalyze: false, allowViewerExport: false },
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

function setup(current: ProjectRow | null) {
  const tx = {} as Prisma.TransactionClient;
  const repo = {
    findById: jest.fn().mockResolvedValue(current),
    update: jest.fn((_id: string, data: Partial<ProjectRow>) => Promise.resolve(row({ ...current, ...data }))),
    transaction: jest.fn((fn: (t: Prisma.TransactionClient) => Promise<unknown>) => fn(tx)),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const svc = new ProjectsService(repo as unknown as ProjectsRepository, audit as unknown as AuditService);
  return { svc, repo, audit, tx };
}

/** FR-032 / FR-200 — PATCH /projects/:projectId (T-034). */
describe("ProjectsService.update", () => {
  it("TC-PROJ-006: partial settings patch keeps unsent keys", async () => {
    const { svc, repo } = setup(row());
    const res = await svc.update(PID, { settings: { allowViewerExport: true } }, ACTOR, "admin", "req-1");
    expect(repo.update.mock.calls[0]?.[1]).toEqual({
      settings: { allowAnalystReanalyze: false, allowViewerExport: true, phraseMinMentions: 2, landingTerms: [] },
    });
    expect(res.settings).toEqual({
      allowAnalystReanalyze: false,
      allowViewerExport: true,
      phraseMinMentions: 2,
      landingTerms: [],
    });
    expect(res.role).toBe("admin");
  });

  it("TC-PROJ-004: audits project.updated in the same tx with only changed fields", async () => {
    const { svc, audit, tx } = setup(row());
    await svc.update(PID, { timezone: "UTC", name: "P1" }, ACTOR, "admin", "req-1");
    expect(audit.record).toHaveBeenCalledWith(
      {
        projectId: PID,
        actorUserId: ACTOR,
        action: "project.updated",
        entityType: "project",
        entityId: PID,
        metadata: { changes: { timezone: { from: "Asia/Ho_Chi_Minh", to: "UTC" } } },
        requestId: "req-1",
      },
      tx,
    );
  });

  it("no-op patch returns current project without update or audit", async () => {
    const { svc, repo, audit } = setup(row());
    const res = await svc.update(PID, { name: "P1", settings: { allowViewerExport: false } }, ACTOR, "admin", null);
    expect(res.name).toBe("P1");
    expect(repo.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("FR-032 / #251: phraseMinMentions patch merges and audits settings.phraseMinMentions", async () => {
    const { svc, repo, audit } = setup(row());
    await svc.update(PID, { settings: { phraseMinMentions: 5 } }, ACTOR, "admin", "req-1");
    expect(repo.update.mock.calls[0]?.[1]).toEqual({
      settings: { allowAnalystReanalyze: false, allowViewerExport: false, phraseMinMentions: 5, landingTerms: [] },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { changes: { "settings.phraseMinMentions": { from: 2, to: 5 } } } }),
      expect.anything(),
    );
  });

  it("FR-032 / #251: same phraseMinMentions value is a no-op without audit", async () => {
    const { svc, repo, audit } = setup(row());
    await svc.update(PID, { settings: { phraseMinMentions: 2 } }, ACTOR, "admin", null);
    expect(repo.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("FR-032 / BR-042 (#261): landingTerms patch merges and audits settings.landingTerms", async () => {
    const { svc, repo, audit } = setup(row());
    await svc.update(PID, { settings: { landingTerms: ["giá vé", "app"] } }, ACTOR, "admin", "req-1");
    expect(repo.update.mock.calls[0]?.[1]).toMatchObject({ settings: { landingTerms: ["giá vé", "app"] } });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { changes: { "settings.landingTerms": { from: [], to: ["giá vé", "app"] } } },
      }),
      expect.anything(),
    );
  });

  it("FR-032 (#261): same landingTerms list (new array) is a no-op without audit; order change is a change", async () => {
    const current = row({ settings: { landingTerms: ["a", "b"] } });
    const same = setup(current);
    await same.svc.update(PID, { settings: { landingTerms: ["a", "b"] } }, ACTOR, "admin", null);
    expect(same.repo.update).not.toHaveBeenCalled();
    expect(same.audit.record).not.toHaveBeenCalled();
    const reordered = setup(current);
    await reordered.svc.update(PID, { settings: { landingTerms: ["b", "a"] } }, ACTOR, "admin", null);
    expect(reordered.repo.update).toHaveBeenCalled();
  });

  it("404 when project does not exist", async () => {
    const { svc } = setup(null);
    await expect(svc.update(PID, { name: "X" }, ACTOR, "admin", null)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("UpdateProjectBodySchema (FR-032)", () => {
  it("TC-PROJ-005: rejects invalid IANA timezone", () => {
    expect(UpdateProjectBodySchema.safeParse({ timezone: "Mars/Olympus" }).success).toBe(false);
  });
  it("rejects empty body and empty name", () => {
    expect(UpdateProjectBodySchema.safeParse({}).success).toBe(false);
    expect(UpdateProjectBodySchema.safeParse({ name: "  " }).success).toBe(false);
  });
});
