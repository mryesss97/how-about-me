import { toLandingTermRows } from "./landing-terms";

/** FR-149, BR-042 (#261) — pure row builder. */
describe("toLandingTermRows", () => {
  it("keeps setting order and zero-fills terms without mentions", () => {
    const rows = toLandingTermRows(["b", "a"], [{ ord: 2, sentiment: "positive", count: 3 }]);
    expect(rows).toEqual([
      { term: "b", positive: 0, neutral: 0, negative: 0, total: 0, dominant: null, dominantShare: null },
      { term: "a", positive: 3, neutral: 0, negative: 0, total: 3, dominant: "positive", dominantShare: 1 },
    ]);
  });

  it("dominant share and tie-break negative > positive > neutral", () => {
    const [r1, r2, r3] = toLandingTermRows(
      ["x", "y", "z"],
      [
        { ord: 1, sentiment: "negative", count: 2 },
        { ord: 1, sentiment: "positive", count: 2 },
        { ord: 2, sentiment: "positive", count: 1 },
        { ord: 2, sentiment: "neutral", count: 1 },
        { ord: 3, sentiment: "neutral", count: 3 },
        { ord: 3, sentiment: "negative", count: 1 },
      ],
    );
    expect(r1).toMatchObject({ dominant: "negative", dominantShare: 0.5, total: 4 });
    expect(r2).toMatchObject({ dominant: "positive", dominantShare: 0.5 });
    expect(r3).toMatchObject({ dominant: "neutral", dominantShare: 0.75 });
  });

  it("ignores unknown sentiments", () => {
    expect(toLandingTermRows(["x"], [{ ord: 1, sentiment: "mixed", count: 9 }])[0]).toMatchObject({
      total: 0,
      dominant: null,
    });
  });
});
