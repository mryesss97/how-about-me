import { buildRetentionScopes, retentionCutoff } from "./retention-plan";

/** T-153 (NFR-054): cutoff = now − N days truncated to UTC midnight (exclusive). */
describe("retentionCutoff (T-153, NFR-054)", () => {
  it("truncates to UTC midnight", () => {
    expect(retentionCutoff(new Date("2026-10-13T20:00:00Z"), 365)).toEqual(new Date("2025-10-13T00:00:00Z"));
  });

  it("uses the UTC date even when Asia/Ho_Chi_Minh is already the next day", () => {
    // 2026-10-13T18:30Z is 2026-10-14 01:30 in Vietnam; the cutoff stays on the UTC calendar.
    expect(retentionCutoff(new Date("2026-10-13T18:30:00Z"), 1)).toEqual(new Date("2026-10-12T00:00:00Z"));
  });

  it("crosses a leap day and a year boundary", () => {
    expect(retentionCutoff(new Date("2024-03-01T05:00:00Z"), 1)).toEqual(new Date("2024-02-29T00:00:00Z"));
    expect(retentionCutoff(new Date("2026-01-02T00:00:00Z"), 2)).toEqual(new Date("2025-12-31T00:00:00Z"));
  });
});

describe("buildRetentionScopes (T-153)", () => {
  const cfg = { RETENTION_POSTS_DAYS: 365, RETENTION_RUNS_DAYS: 30, RETENTION_SYNC_JOBS_DAYS: 180 };
  const now = new Date("2026-10-13T20:00:00Z");

  it("emits project + runs per project, then one global sync-jobs", () => {
    const s = buildRetentionScopes(["a", "b"], cfg, now);
    expect(s).toEqual([
      { scope: "project", projectId: "a", before: new Date("2025-10-13T00:00:00Z") },
      { scope: "runs", projectId: "a", before: new Date("2026-09-13T00:00:00Z") },
      { scope: "project", projectId: "b", before: new Date("2025-10-13T00:00:00Z") },
      { scope: "runs", projectId: "b", before: new Date("2026-09-13T00:00:00Z") },
      { scope: "sync-jobs", before: new Date("2026-04-16T00:00:00Z") },
    ]);
  });

  it("still purges sync jobs when there are no projects", () => {
    expect(buildRetentionScopes([], cfg, now)).toHaveLength(1);
  });
});
