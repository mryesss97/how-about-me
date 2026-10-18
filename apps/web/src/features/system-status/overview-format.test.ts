import { describe, expect, it } from "vitest";
import { liveQueryFixture, statusFixture } from "./fixtures.test-utils";
import {
  buildSummary,
  countQueriesWithError,
  failedJobsHref,
  formatVersions,
  threadsPlate,
  tokenDaysLeft,
} from "./format";

const NOW = Date.parse("2026-10-13T03:00:00.000Z");
const inDays = (d: number) => new Date(NOW + d * 86_400_000).toISOString();

describe("overview helpers (#342)", () => {
  it("tokenDaysLeft: null, 4 days, expired, 7/8-day edges", () => {
    expect(tokenDaysLeft(null, NOW)).toBeNull();
    expect(tokenDaysLeft(inDays(4), NOW)).toBe(4);
    expect(tokenDaysLeft(inDays(3.5), NOW)).toBe(4);
    expect(tokenDaysLeft(inDays(-1), NOW)).toBe(-1);
    expect(tokenDaysLeft(inDays(7), NOW)).toBe(7);
    expect(tokenDaysLeft(inDays(8), NOW)).toBe(8);
  });

  // BR-017: every plate keeps a text label.
  it("threadsPlate: warns within 7 days, expired past it, otherwise the integration label", () => {
    const t = statusFixture().threads;
    expect(threadsPlate({ ...t, tokenExpiresAt: inDays(7) }, NOW)).toEqual({ label: "Sắp hết hạn", tone: "warning" });
    expect(threadsPlate({ ...t, tokenExpiresAt: inDays(8) }, NOW)).toEqual({ label: "Đã kết nối", tone: "success" });
    expect(threadsPlate({ ...t, tokenExpiresAt: inDays(-1) }, NOW)).toEqual({ label: "Đã hết hạn", tone: "error" });
    expect(threadsPlate({ ...t, status: "expired", tokenExpiresAt: inDays(2) }, NOW).label).toBe("Lỗi: token hết hạn");
  });

  it("formatVersions: no doubled prefix, adds it when missing, — when empty", () => {
    const v = statusFixture().analysis.versions;
    expect(
      formatVersions({ ...v, classifierModel: "classifier-v2", promptVersion: null, taxonomyVersion: "taxonomy-v1" }),
    ).toBe("classifier-v2 · taxonomy-v1");
    expect(formatVersions(v)).toBe("gpt-x · prompt p1 · taxonomy t1");
    expect(formatVersions({ ...v, classifierModel: null, promptVersion: null, taxonomyVersion: null })).toBe("—");
  });

  it("countQueriesWithError: deleted/disabled excluded, re-synced errors not counted", () => {
    const failedJob = { id: "j", status: "failed" as const, recordsFetched: 0, recordsInserted: 0, completedAt: null };
    const err = { code: "X", message: "m", at: "2026-10-13T02:00:00.000Z" };
    expect(
      countQueriesWithError([
        liveQueryFixture({ lastJob: failedJob, lastError: err }),
        liveQueryFixture({ lastJob: failedJob, lastError: err, enabled: false }),
        liveQueryFixture({ lastJob: failedJob, lastError: err, deletedAt: "2026-10-12T00:00:00.000Z" }),
        liveQueryFixture({ lastError: err }), // last job success → stale error
        liveQueryFixture(),
      ]),
    ).toBe(1);
  });

  it("failedJobsHref: failed first, only partial → status=partial, none → null", () => {
    expect(failedJobsHref(1, 2)).toBe("/system-status?tab=sync-jobs&status=failed");
    expect(failedJobsHref(0, 2)).toBe("/system-status?tab=sync-jobs&status=partial");
    expect(failedJobsHref(0, 0)).toBeNull();
  });

  it("buildSummary: healthy → ok", () => {
    const base = statusFixture();
    const data = {
      ...base,
      collector: { ...base.collector, failedJobs24h: 0 },
      analysis: { ...base.analysis, failed24h: 0 },
    };
    expect(buildSummary({ data, nowMs: NOW, queriesWithError: 0, isAdmin: true })).toEqual({ ok: true });
  });

  it("buildSummary: urgent first — token 4 days, 3 failed syncs, 2 erroring queries, 1 analysis failure", () => {
    const base = statusFixture();
    const data = { ...base, threads: { ...base.threads, tokenExpiresAt: inDays(4) } };
    const s = buildSummary({ data, nowMs: NOW, queriesWithError: 2, isAdmin: true });
    expect(s).toEqual({
      ok: false,
      clauses: [
        { text: "token Threads hết hạn sau 4 ngày", href: "/settings/integrations" },
        { text: "3 lượt đồng bộ lỗi trong 24 giờ", href: "/system-status?tab=sync-jobs&status=failed" },
        { text: "2 truy vấn đang lỗi", href: "/listening-queries" },
        { text: "1 lượt phân tích lỗi trong 24 giờ", href: "/system-status?tab=analysis-failures" },
      ],
    });
    const viewer = buildSummary({ data, nowMs: NOW, queriesWithError: null, isAdmin: false });
    expect(viewer.ok === false && viewer.clauses[0]).toEqual({ text: "token Threads hết hạn sau 4 ngày", href: null });
  });
});
