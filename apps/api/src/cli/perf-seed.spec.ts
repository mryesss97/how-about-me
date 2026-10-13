import { parsePerfSeedArgs, PerfSeedArgsError, seedConfig } from "./perf-seed";
import { buildFixture, DIST, generateChunk, type SeedConfig } from "./perf-seed/generate";
import { assertPerfDatabase, PerfDbGuardError } from "./perf-seed/guard";
import { percentile, summarizePlan } from "./perf-seed/plan-summary";
import { createRng } from "./perf-seed/prng";
import { batchRows, insertStatements, MAX_BIND_PARAMS, POSTS } from "./perf-seed/sql";

const url = (db: string, host = "localhost") => `postgresql://u:secret@${host}:5432/${db}?schema=public`;
const CFG: SeedConfig = { posts: 0, days: 120, anchor: new Date("2026-10-13T00:00:00Z"), auditLogs: 0, syncJobs: 0 };

/** T-097 (#84): perf seed generator — DB guard, determinism, distribution, batching. */
describe("perf seed guard (T-097)", () => {
  it.each(["how_about_me_t84_perf", "how_about_me_t84_test", "PERF_db"])("accepts %s", (db) => {
    expect(assertPerfDatabase(url(db), { allowAnyDb: false }).databaseName).toBe(db);
  });

  it.each(["how_about_me", "contest_prod", "perfect_prod"])("refuses %s (no perf/test word)", (db) => {
    expect(() => assertPerfDatabase(url(db), { allowAnyDb: false })).toThrow(PerfDbGuardError);
  });

  it("refuses a non-local host even with a perf name", () => {
    expect(() => assertPerfDatabase(url("x_perf", "db.example.com"), { allowAnyDb: false })).toThrow(/non-local/);
  });

  it("--allow-any-db overrides both checks", () => {
    expect(assertPerfDatabase(url("how_about_me", "db.example.com"), { allowAnyDb: true }).databaseName).toBe(
      "how_about_me",
    );
  });

  it.each([undefined, "", "not a url", "mysql://localhost/x_perf", "postgresql://localhost:5432/"])(
    "refuses missing/unparseable url %p",
    (u) => {
      expect(() => assertPerfDatabase(u, { allowAnyDb: true })).toThrow(PerfDbGuardError);
    },
  );

  it("never echoes the password in errors", () => {
    let message = "";
    try {
      assertPerfDatabase(url("prod"), { allowAnyDb: false });
    } catch (e) {
      message = e instanceof Error ? e.message : "";
    }
    expect(message).toContain("prod");
    expect(message).not.toContain("secret");
  });
});

describe("perf seed args (T-097)", () => {
  it("defaults to 100k posts, seed 84, 120 days", () => {
    expect(parsePerfSeedArgs([])).toMatchObject({
      posts: 100_000,
      seed: 84,
      days: 120,
      truncate: false,
      allowAnyDb: false,
    });
  });

  it("parses flags and a fixed anchor", () => {
    const a = parsePerfSeedArgs([
      "--",
      "--posts",
      "500",
      "--truncate",
      "--allow-any-db",
      "--anchor",
      "2026-10-13T00:00:00Z",
    ]);
    expect(a).toMatchObject({ posts: 500, truncate: true, allowAnyDb: true });
    expect(seedConfig(a).anchor.toISOString()).toBe("2026-10-13T00:00:00.000Z");
  });

  it.each([[["--posts"]], [["--bogus", "1"]], [["--posts", "0"]], [["positional"]]])("rejects %p", (argv) => {
    expect(() => parsePerfSeedArgs(argv)).toThrow(PerfSeedArgsError);
  });
});

describe("perf seed generator (T-097)", () => {
  function generate(seed: number, posts: number) {
    const rng = createRng(seed);
    const fx = buildFixture(rng);
    return { fx, rows: generateChunk(rng, fx, CFG, 0, posts) };
  }

  it("same seed → identical rows; different seed → different ids", () => {
    const a = generate(84, 300);
    expect(generate(84, 300)).toEqual(a);
    expect(generate(85, 300).rows.posts[0]?.id).not.toBe(a.rows.posts[0]?.id);
  });

  it("uuids are v4-shaped and unique", () => {
    const { rows } = generate(1, 2000);
    const ids = [...rows.posts.map((p) => p.id), ...rows.analyses.map((a) => a.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids.slice(0, 50))
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("distribution stays within tolerance (≈1.2 analyses/post, status, relevance)", () => {
    const n = 20_000;
    const { rows } = generate(84, n);
    const share = (k: number) => k / n;
    expect(share(rows.analyses.length)).toBeGreaterThan(1.15);
    expect(share(rows.analyses.length)).toBeLessThan(1.25);
    expect(share(rows.posts.filter((p) => p.latestRunStatus === "completed").length)).toBeCloseTo(0.92, 1);
    const rel = rows.analyses.filter((a) => a.relevance === "relevant").length / rows.analyses.length;
    expect(rel).toBeCloseTo(DIST.relevance[0][1], 1);
    expect(share(rows.overrides.length)).toBeGreaterThan(0.005);
    expect(share(rows.overrides.length)).toBeLessThan(0.015);
    expect(rows.matches.length / n).toBeCloseTo(1 + DIST.secondMatch, 1);
  });

  it("BR-002 / BR-025 invariants: every post has ≥1 match in its own project; current analysis is its newest", () => {
    const { fx, rows } = generate(7, 3000);
    const queryProject = new Map(fx.queries.map((q) => [q.id, q.projectId]));
    const byPost = new Map(rows.posts.map((p) => [p.id, p]));
    for (const m of rows.matches) expect(queryProject.get(m.queryId)).toBe(byPost.get(m.postId)?.projectId);
    expect(new Set(rows.matches.map((m) => m.postId)).size).toBe(rows.posts.length);
    const newest = new Map<string, { id: string; at: number }>();
    for (const a of rows.analyses) {
      const cur = newest.get(a.postId);
      if (!cur || a.createdAt.getTime() > cur.at) newest.set(a.postId, { id: a.id, at: a.createdAt.getTime() });
    }
    for (const p of rows.posts) expect(p.currentAnalysisId).toBe(newest.get(p.id)?.id ?? null);
    for (const p of rows.posts) expect(p.publishedAt.getTime()).toBeLessThanOrEqual(CFG.anchor.getTime());
    // One override per post at most → partial unique (post_id, field) WHERE revoked_at IS NULL holds.
    expect(new Set(rows.overrides.map((o) => o.postId)).size).toBe(rows.overrides.length);
  });
});

describe("perf seed batching (T-097)", () => {
  it("batchRows keeps every statement under the bind-parameter budget", () => {
    const rows = Array.from({ length: 10_001 }, (_, i) => i);
    const batches = batchRows(rows, 14);
    expect(batches.flat()).toEqual(rows);
    for (const b of batches) expect(b.length * 14).toBeLessThanOrEqual(MAX_BIND_PARAMS);
  });

  it("insertStatements binds every value (no literal interpolation)", () => {
    const rng = createRng(3);
    const fx = buildFixture(rng);
    const { posts } = generateChunk(rng, fx, CFG, 0, 5);
    const [stmt] = insertStatements(POSTS, posts);
    expect(stmt?.values).toHaveLength(5 * POSTS.columns.length);
    expect(stmt?.text).not.toContain(posts[0]?.text ?? "∅");
  });
});

describe("perf explain helpers (T-097)", () => {
  it("percentile uses nearest rank", () => {
    const s = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(percentile(s, 50)).toBe(10);
    expect(percentile(s, 95)).toBe(19);
    expect(percentile([], 50)).toBeNaN();
  });

  it("summarizePlan collects seq scans and the worst row estimate", () => {
    const s = summarizePlan({
      "Execution Time": 12.5,
      "Planning Time": 1,
      Plan: {
        "Node Type": "Hash Join",
        "Plan Rows": 10,
        "Actual Rows": 1000,
        "Actual Loops": 1,
        Plans: [
          {
            "Node Type": "Seq Scan",
            "Relation Name": "post_analyses",
            "Plan Rows": 100,
            "Actual Rows": 100,
            "Actual Loops": 2,
          },
          {
            "Node Type": "Index Scan",
            "Relation Name": "social_posts",
            "Plan Rows": 1,
            "Actual Rows": 1,
            "Actual Loops": 5,
          },
        ],
      },
    });
    expect(s.seqScans).toEqual([{ relation: "post_analyses", rows: 200 }]);
    expect(s.worstMisestimate).toEqual({ node: "Hash Join", planRows: 10, actualRows: 1000 });
    expect(s.executionMs).toBe(12.5);
  });
});
