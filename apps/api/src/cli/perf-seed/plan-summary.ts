/**
 * Summaries of `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` output and timing stats for `perf:explain` (T-097).
 */
export type PlanNode = {
  "Node Type": string;
  "Relation Name"?: string;
  "Index Name"?: string;
  "Plan Rows"?: number;
  "Actual Rows"?: number;
  "Actual Loops"?: number;
  "Shared Hit Blocks"?: number;
  "Shared Read Blocks"?: number;
  Plans?: PlanNode[];
};
export type ExplainJson = { Plan: PlanNode; "Execution Time": number; "Planning Time": number };

export type PlanSummary = {
  executionMs: number;
  planningMs: number;
  rootNode: string;
  /** Relations read by Seq Scan with total actual rows (rows × loops). */
  seqScans: { relation: string; rows: number }[];
  /** Worst |log10(actual/plan)| over all nodes with ≥ 1 loop, signed (+ = under-estimate). */
  worstMisestimate: { node: string; planRows: number; actualRows: number } | null;
  sharedBlocks: number;
};

function walk(n: PlanNode, f: (n: PlanNode) => void): void {
  f(n);
  for (const c of n.Plans ?? []) walk(c, f);
}

export function summarizePlan(e: ExplainJson): PlanSummary {
  const seq = new Map<string, number>();
  let worst: PlanSummary["worstMisestimate"] = null;
  let worstScore = 0;
  walk(e.Plan, (n) => {
    const loops = n["Actual Loops"] ?? 0;
    const actual = (n["Actual Rows"] ?? 0) * loops;
    const planned = (n["Plan Rows"] ?? 0) * Math.max(loops, 1);
    if (n["Node Type"] === "Seq Scan" && n["Relation Name"]) {
      seq.set(n["Relation Name"], (seq.get(n["Relation Name"]) ?? 0) + actual);
    }
    if (loops > 0) {
      const score = Math.abs(Math.log10(Math.max(actual, 1) / Math.max(planned, 1)));
      if (score > worstScore) {
        worstScore = score;
        const label = n["Relation Name"] ? `${n["Node Type"]} on ${n["Relation Name"]}` : n["Node Type"];
        worst = { node: label, planRows: planned, actualRows: actual };
      }
    }
  });
  return {
    executionMs: e["Execution Time"],
    planningMs: e["Planning Time"],
    rootNode: e.Plan["Node Type"],
    seqScans: [...seq].map(([relation, rows]) => ({ relation, rows })).sort((a, b) => b.rows - a.rows),
    worstMisestimate: worst,
    sharedBlocks: (e.Plan["Shared Hit Blocks"] ?? 0) + (e.Plan["Shared Read Blocks"] ?? 0),
  };
}

/** Nearest-rank percentile (p in (0,100]). */
export function percentile(samples: readonly number[], p: number): number {
  if (samples.length === 0) return Number.NaN;
  const s = [...samples].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx] ?? Number.NaN;
}
