/** Pure evaluation metrics (T-079) — docs/04-qa/03-ai-evaluation-plan.md §3. Division by zero → null. */

export type LabelStats = {
  label: string;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  support: number;
};

export type SingleLabelMetrics = {
  n: number;
  accuracy: number | null;
  macroF1: number | null;
  perLabel: LabelStats[];
  /** confusion[gold][pred] = count */
  confusion: Record<string, Record<string, number>>;
};

export type MultiLabelMetrics = {
  n: number;
  microPrecision: number | null;
  microRecall: number | null;
  microF1: number | null;
  /** Mean F1 over labels with gold support > 0 (labels never in gold are left out). */
  macroF1: number | null;
  exactMatch: number | null;
  perLabel: LabelStats[];
};

export function ratio(num: number, den: number): number | null {
  return den === 0 ? null : num / den;
}

function macroF1(perLabel: readonly LabelStats[]): number | null {
  const f1s = perLabel.filter((s) => s.support > 0).map((s) => s.f1 ?? 0);
  return f1s.length === 0 ? null : f1s.reduce((a, b) => a + b, 0) / f1s.length;
}

function f1(p: number | null, r: number | null): number | null {
  if (p === null || r === null) return null;
  return p + r === 0 ? 0 : (2 * p * r) / (p + r);
}

export function singleLabelMetrics(
  pairs: readonly { gold: string; pred: string }[],
  labels: readonly string[],
): SingleLabelMetrics {
  const confusion: Record<string, Record<string, number>> = {};
  for (const g of labels) confusion[g] = Object.fromEntries(labels.map((p) => [p, 0]));
  let correct = 0;
  for (const { gold, pred } of pairs) {
    const row = (confusion[gold] ??= {});
    row[pred] = (row[pred] ?? 0) + 1;
    if (gold === pred) correct++;
  }
  const perLabel = labels.map((label) => {
    const tp = pairs.filter((x) => x.gold === label && x.pred === label).length;
    const predicted = pairs.filter((x) => x.pred === label).length;
    const support = pairs.filter((x) => x.gold === label).length;
    const precision = ratio(tp, predicted);
    const recall = ratio(tp, support);
    return { label, precision, recall, f1: f1(precision, recall), support };
  });
  return {
    n: pairs.length,
    accuracy: ratio(correct, pairs.length),
    macroF1: macroF1(perLabel),
    perLabel,
    confusion,
  };
}

export function multiLabelMetrics(
  pairs: readonly { gold: readonly string[]; pred: readonly string[] }[],
  labels: readonly string[],
): MultiLabelMetrics {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let exact = 0;
  for (const { gold, pred } of pairs) {
    const g = new Set(gold);
    const p = new Set(pred);
    for (const x of p) {
      if (g.has(x)) tp++;
      else fp++;
    }
    for (const x of g) if (!p.has(x)) fn++;
    if (g.size === p.size && [...g].every((x) => p.has(x))) exact++;
  }
  const perLabel = labels.map((label) => {
    let ltp = 0;
    let lpred = 0;
    let support = 0;
    for (const { gold, pred } of pairs) {
      const inG = gold.includes(label);
      const inP = pred.includes(label);
      if (inG) support++;
      if (inP) lpred++;
      if (inG && inP) ltp++;
    }
    const precision = ratio(ltp, lpred);
    const recall = ratio(ltp, support);
    return { label, precision, recall, f1: f1(precision, recall), support };
  });
  const microPrecision = ratio(tp, tp + fp);
  const microRecall = ratio(tp, tp + fn);
  return {
    n: pairs.length,
    microPrecision,
    microRecall,
    microF1: f1(microPrecision, microRecall),
    macroF1: macroF1(perLabel),
    exactMatch: ratio(exact, pairs.length),
    perLabel,
  };
}

export type SafetyMetrics = SingleLabelMetrics & {
  agreement: number | null;
  severeSubsetN: number;
  /** ids where gold = severe but pred ≠ severe (BR-018 gate: must be empty). */
  severeFalseNegatives: string[];
};

/** Safety metrics use only `safetyLevel` — never sentiment (BR-017). */
export function safetyMetrics(
  pairs: readonly { id: string; gold: string; pred: string }[],
  labels: readonly string[],
): SafetyMetrics {
  const base = singleLabelMetrics(pairs, labels);
  const severe = pairs.filter((x) => x.gold === "severe");
  return {
    ...base,
    agreement: base.accuracy,
    severeSubsetN: severe.length,
    severeFalseNegatives: severe.filter((x) => x.pred !== "severe").map((x) => x.id),
  };
}

export type PhraseMetrics = {
  /** Items predicted relevant/uncertain with phrase extraction on (denominator of coverage). */
  n: number;
  /** Share of those items with ≥ 1 phrase. */
  coverage: number | null;
  avgPhrasesPerPost: number | null;
  /** Items with gold phrases (P/R/F1 denominator). */
  goldN: number;
  microPrecision: number | null;
  microRecall: number | null;
  microF1: number | null;
};

/**
 * Key phrase metrics (FR-120, BR-041) — informational only, never part of the freeze gate.
 * Exact match on already-normalised strings; micro P/R/F1 reuses `multiLabelMetrics`.
 */
export function phraseMetrics(
  items: readonly { relevant: boolean; gold?: readonly string[]; pred: readonly string[] }[],
): PhraseMetrics {
  const scoped = items.filter((x) => x.relevant);
  const withPhrase = scoped.filter((x) => x.pred.length > 0).length;
  const total = scoped.reduce((a, x) => a + x.pred.length, 0);
  const gold = items.flatMap((x) => (x.gold ? [{ gold: x.gold, pred: x.pred }] : []));
  const m = multiLabelMetrics(gold, []);
  return {
    n: scoped.length,
    coverage: ratio(withPhrase, scoped.length),
    avgPhrasesPerPost: ratio(total, scoped.length),
    goldN: gold.length,
    microPrecision: m.microPrecision,
    microRecall: m.microRecall,
    microF1: m.microF1,
  };
}

/** Nearest-rank percentile; null on empty input. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? null;
}
