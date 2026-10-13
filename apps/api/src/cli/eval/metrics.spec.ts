import { multiLabelMetrics, percentile, safetyMetrics, singleLabelMetrics } from "./metrics";

describe("eval metrics (T-079)", () => {
  it("computes accuracy, per-label P/R/F1 and confusion by hand-checked numbers", () => {
    const m = singleLabelMetrics(
      [
        { gold: "a", pred: "a" },
        { gold: "a", pred: "b" },
        { gold: "b", pred: "b" },
        { gold: "b", pred: "b" },
      ],
      ["a", "b"],
    );
    expect(m.accuracy).toBe(0.75);
    const a = m.perLabel.find((s) => s.label === "a");
    expect(a).toMatchObject({ precision: 1, recall: 0.5, support: 2 });
    expect(a?.f1).toBeCloseTo(2 / 3);
    const b = m.perLabel.find((s) => s.label === "b");
    expect(b?.precision).toBeCloseTo(2 / 3);
    expect(b?.recall).toBe(1);
    expect(m.confusion).toEqual({ a: { a: 1, b: 1 }, b: { a: 0, b: 2 } });
  });

  it("returns null when dividing by zero", () => {
    const m = singleLabelMetrics([], ["a"]);
    expect(m.accuracy).toBeNull();
    expect(m.macroF1).toBeNull();
    expect(m.perLabel[0]).toMatchObject({ precision: null, recall: null, f1: null });
    expect(multiLabelMetrics([], ["x"]).microF1).toBeNull();
    expect(percentile([], 50)).toBeNull();
  });

  it("computes micro-F1 and exact match for multi-label", () => {
    // tp=2 (x, y), fp=1 (z), fn=1 (w) → P=2/3, R=2/3, F1=2/3
    const m = multiLabelMetrics(
      [
        { gold: ["x"], pred: ["x"] },
        { gold: ["y", "w"], pred: ["y", "z"] },
      ],
      ["x", "y", "z", "w"],
    );
    expect(m.microPrecision).toBeCloseTo(2 / 3);
    expect(m.microRecall).toBeCloseTo(2 / 3);
    expect(m.microF1).toBeCloseTo(2 / 3);
    expect(m.exactMatch).toBe(0.5);
    // per-label F1 with gold support: x=1, y=1, w=0 (z has no gold support) → macro = 2/3
    expect(m.macroF1).toBeCloseTo(2 / 3);
  });

  it("BR-018: catches severe false negatives on the severe subset", () => {
    const m = safetyMetrics(
      [
        { id: "s1", gold: "severe", pred: "severe" },
        { id: "s2", gold: "severe", pred: "sensitive" },
        { id: "s3", gold: "safe", pred: "severe" },
      ],
      ["safe", "sensitive", "severe"],
    );
    expect(m.severeSubsetN).toBe(2);
    expect(m.severeFalseNegatives).toEqual(["s2"]);
    expect(m.agreement).toBeCloseTo(1 / 3);
  });

  it("nearest-rank percentile", () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
  });
});
