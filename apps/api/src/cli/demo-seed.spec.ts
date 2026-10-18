import { MAX_PHRASES_PER_POST, normalizePhrase } from "@how-about-me/taxonomy";
import { policyVersionOfEffective as policyVersionOf } from "../modules/analysis/analysis-enqueuer";
import { demoAnchor, DemoSeedArgsError, parseDemoSeedArgs } from "./demo-seed";
import { buildDemoDataset } from "./demo-seed/generate";
import { assertDemoTarget, DemoSeedGuardError } from "./demo-seed/guard";
import { reviewReasons } from "./demo-seed/posts";
import type { DemoInput } from "./demo-seed/types";

const url = (host = "localhost", db = "how_about_me") => `postgresql://u:s3cretpw@${host}:5432/${db}?schema=public`;
const ANCHOR = new Date("2026-10-18T05:00:00Z");
const INPUT: DemoInput = {
  seed: 294,
  anchor: ANCHOR,
  projectId: "00000000-0000-4000-8000-000000000001",
  users: {
    admin: "00000000-0000-4000-8000-0000000000a1",
    analyst: "00000000-0000-4000-8000-0000000000a2",
    viewer: "00000000-0000-4000-8000-0000000000a3",
  },
  baseQueries: [
    { id: "00000000-0000-4000-8000-0000000000b1", queryType: "keyword", queryValue: "1zone" },
    { id: "00000000-0000-4000-8000-0000000000b2", queryType: "topic_tag", queryValue: "1zone" },
    { id: "00000000-0000-4000-8000-0000000000b3", queryType: "keyword", queryValue: "eventista" },
    { id: "00000000-0000-4000-8000-0000000000b4", queryType: "topic_tag", queryValue: "eventista" },
  ],
};
const DATA = buildDemoDataset(INPUT);

describe("demo seed guard (#294)", () => {
  it.each(["localhost", "127.0.0.1"])("accepts local host %s with any db name", (host) => {
    expect(assertDemoTarget(url(host), {}).databaseName).toBe("how_about_me");
  });

  it("refuses a remote host without leaking the password", () => {
    let err: unknown;
    try {
      assertDemoTarget(url("db.supabase.co"), {});
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DemoSeedGuardError);
    expect(String((err as Error).message)).not.toContain("s3cretpw");
  });

  it.each([[{ CI: "true" }], [{ CI: "1" }], [{ NODE_ENV: "production" }], [{ APP_ENV: "staging" }]])(
    "refuses env %p",
    (env) => {
      expect(() => assertDemoTarget(url(), env)).toThrow(DemoSeedGuardError);
    },
  );

  it("refuses a missing or malformed URL", () => {
    expect(() => assertDemoTarget(undefined, {})).toThrow(DemoSeedGuardError);
    expect(() => assertDemoTarget("not a url", {})).toThrow(DemoSeedGuardError);
  });
});

describe("demo seed args (#294)", () => {
  it("defaults", () => {
    expect(parseDemoSeedArgs([])).toEqual({ reset: false, seed: 294 });
  });

  it("parses --reset, --seed, --anchor", () => {
    const a = parseDemoSeedArgs(["--", "--reset", "--seed", "7", "--anchor", "2026-10-01T00:00:00Z"]);
    expect(a).toEqual({ reset: true, seed: 7, anchor: "2026-10-01T00:00:00Z" });
    expect(demoAnchor(a).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("default anchor = start of the current UTC hour", () => {
    expect(demoAnchor(parseDemoSeedArgs([]), new Date("2026-10-18T05:42:13Z")).toISOString()).toBe(
      "2026-10-18T05:00:00.000Z",
    );
  });

  it.each([["--bogus", "1"], ["--seed"], ["oops"]])("rejects %p", (...argv) => {
    expect(() => parseDemoSeedArgs(argv)).toThrow(DemoSeedArgsError);
  });
});

describe("demo seed generator (#294)", () => {
  it("is deterministic: same seed + anchor → equal; other seed → different", () => {
    expect(buildDemoDataset(INPUT)).toEqual(DATA);
    expect(buildDemoDataset({ ...INPUT, seed: 295 }).posts[0]?.id).not.toBe(DATA.posts[0]?.id);
  });

  it("keeps ids stable when only the anchor moves", () => {
    const later = buildDemoDataset({ ...INPUT, anchor: new Date(ANCHOR.getTime() + 86_400_000) });
    expect(later.posts.map((p) => p.id)).toEqual(DATA.posts.map((p) => p.id));
  });

  it("has 600 posts in the last 30 days, unique platform ids, VI > EN", () => {
    expect(DATA.posts).toHaveLength(600);
    const from = ANCHOR.getTime() - 30 * 86_400_000;
    for (const p of DATA.posts) {
      expect(p.publishedAt.getTime()).toBeGreaterThanOrEqual(from);
      expect(p.publishedAt.getTime()).toBeLessThan(ANCHOR.getTime());
    }
    expect(new Set(DATA.posts.map((p) => p.platformPostId)).size).toBe(600);
    const vi = DATA.posts.filter((p) => p.lang === "vi").length;
    expect(vi).toBeGreaterThan(600 - vi);
  });

  it("8 queries in total incl. one soft-deleted and one disabled (BR-004: no leading #)", () => {
    expect(DATA.queries.length + INPUT.baseQueries.length).toBe(8);
    expect(DATA.queries.filter((q) => q.deletedAt).length).toBe(1);
    expect(DATA.queries.some((q) => !q.enabled)).toBe(true);
    expect(DATA.queries.every((q) => !q.queryValue.startsWith("#"))).toBe(true);
  });

  it("every post matches ≥ 1 query; some matches are excluded by terms", () => {
    const matched = new Set(DATA.matches.map((m) => m.postId));
    expect(DATA.posts.every((p) => matched.has(p.id))).toBe(true);
    expect(DATA.matches.some((m) => m.excludedByTerms)).toBe(true);
  });

  it("≤ 1 pending/processing run per (post, hash, version)", () => {
    const seen = new Set<string>();
    for (const r of DATA.runs.filter((x) => x.status === "pending" || x.status === "processing")) {
      const k = `${r.postId}|${r.sourceContentHash}|${r.effectiveVersion}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });

  it("currentAnalysisId = result of the latest completed run; latestRunStatus = latest run (BR-023)", () => {
    for (const p of DATA.posts) {
      const runs = DATA.runs.filter((r) => r.postId === p.id);
      expect(p.latestRunStatus).toBe(runs[runs.length - 1]?.status);
      const lastCompleted = [...runs].reverse().find((r) => r.status === "completed");
      const a = DATA.analyses.find((x) => x.id === p.currentAnalysisId);
      expect(a?.analysisRunId).toBe(lastCompleted?.id);
    }
  });

  it("latest completed runs use policy v2; history posts keep a stale v1 run (BR-018, BR-023)", () => {
    const completed = DATA.runs.filter((r) => r.status === "completed");
    expect(completed.every((r) => policyVersionOf(r.effectiveVersion) === "safety-policy-v2")).toBe(true);
    expect(DATA.runs.some((r) => r.status === "stale" && r.policyVersion === "safety-policy-v1")).toBe(true);
    expect(DATA.runs.some((r) => r.trigger === "manual")).toBe(true);
    expect(DATA.analysisSettings.map((s) => s.version)).toEqual([1, 2]);
  });

  it("phrases ≤ 5 and normalised (BR-041); landing terms reach phraseMinMentions (BR-042, FR-148)", () => {
    for (const a of DATA.analyses) {
      expect(a.phrases.length).toBeLessThanOrEqual(MAX_PHRASES_PER_POST);
      for (const p of a.phrases) expect(normalizePhrase(p)).toBe(p);
    }
    const current = new Set(DATA.posts.map((p) => p.currentAnalysisId));
    for (const term of DATA.projectSettings.landingTerms) {
      const n = DATA.analyses.filter((a) => current.has(a.id) && a.phrases.includes(term)).length;
      expect(n).toBeGreaterThanOrEqual(DATA.projectSettings.phraseMinMentions);
    }
  });

  it("covers every relevance / sentiment / safety label and a revised post", () => {
    const set = <T>(xs: T[]) => new Set(xs);
    expect(set(DATA.analyses.map((a) => a.relevanceLabel))).toEqual(set(["relevant", "uncertain", "irrelevant"]));
    expect(set(DATA.analyses.map((a) => a.sentimentLabel))).toEqual(set(["positive", "neutral", "negative"]));
    expect(set(DATA.analyses.map((a) => a.safetyLevel))).toEqual(set(["safe", "sensitive", "severe"]));
    expect(DATA.posts.some((p) => p.revision > 1)).toBe(true);
    expect(set(DATA.runs.map((r) => r.status))).toEqual(
      set(["pending", "processing", "completed", "failed", "skipped", "stale"]),
    );
  });

  it("≤ 1 active override per (post, field) with revoked history (BR-025)", () => {
    const active = DATA.overrides.filter((o) => !o.revokedAt).map((o) => `${o.postId}|${o.field}`);
    expect(new Set(active).size).toBe(active.length);
    expect(active.length).toBe(15);
    expect(DATA.overrides.some((o) => o.revokedAt)).toBe(true);
  });

  it("review queue has every reason unreviewed and a reviewed tab (FR-195, BR-040)", () => {
    const runsById = new Map(DATA.runs.map((r) => [r.id, r]));
    const unreviewed = new Set<string>();
    let reviewed = 0;
    for (const p of DATA.posts) {
      const a = DATA.analyses.find((x) => x.id === p.currentAnalysisId);
      const reasons = reviewReasons(p, runsById, a);
      if (reasons.length === 0) continue;
      const last = DATA.runs.filter((r) => r.postId === p.id).pop();
      if (p.reviewedAt && last && p.reviewedAt >= last.createdAt) reviewed++;
      else reasons.forEach((r) => unreviewed.add(r));
    }
    expect(unreviewed).toEqual(new Set(["failed", "uncertain", "low_confidence"]));
    expect(reviewed).toBeGreaterThan(0);
  });

  it("sync jobs: counters consistent, one running + one queued, some rate-limited", () => {
    expect(DATA.syncJobs.length).toBeGreaterThanOrEqual(100);
    for (const j of DATA.syncJobs) {
      const sum = j.recordsInserted + j.recordsUpdated + j.recordsDuplicated + j.recordsInvalid + j.recordsExcluded;
      expect(sum).toBe(j.recordsFetched);
      expect(
        Math.min(j.recordsInserted, j.recordsUpdated, j.recordsDuplicated, j.recordsInvalid),
      ).toBeGreaterThanOrEqual(0);
    }
    expect(DATA.syncJobs.filter((j) => j.status === "running")).toHaveLength(1);
    expect(DATA.syncJobs.filter((j) => j.status === "queued")).toHaveLength(1);
    expect(DATA.syncJobs.some((j) => j.rateLimitEvents > 0)).toBe(true);
  });

  it("audit entries are marked demo and use existing actions", () => {
    expect(DATA.auditLogs).toHaveLength(40);
    expect(DATA.auditLogs.every((l) => l.metadata.demo === true)).toBe(true);
    expect(DATA.auditLogs.some((l) => l.action === "override.created")).toBe(true);
  });

  it("#393: override audit rows carry the field and one existing post id (FR-200)", () => {
    const postIds = new Set(DATA.posts.map((p) => p.id));
    const fields = new Set<unknown>(DATA.overrides.map((o) => o.field));
    const rows = DATA.auditLogs.filter((l) => l.action.startsWith("override."));
    expect(rows.length).toBeGreaterThan(0);
    for (const l of rows) {
      expect(fields.has(l.metadata.field)).toBe(true);
      const ids = l.metadata.postIds;
      expect(Array.isArray(ids) && ids.length === 1 && postIds.has(String(ids[0]))).toBe(true);
    }
  });
});
