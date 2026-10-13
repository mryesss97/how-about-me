import { toQueryShare } from "./query-share";

const Q1 = "00000000-0000-4000-8000-000000000001";
const Q2 = "00000000-0000-4000-8000-000000000002";

describe("toQueryShare (T-150, FR-145)", () => {
  it("computes share = count / denominator, keeps input order and flags overlap (FR-147)", () => {
    const res = toQueryShare(
      [
        { queryId: Q2, displayName: "b", count: 3 },
        { queryId: Q1, displayName: "a", count: 2 },
      ],
      4,
    );
    expect(res.note).toBe("overlapping");
    expect(res.denominator).toBe(4);
    expect(res.distribution.map((d) => d.queryId)).toEqual([Q2, Q1]);
    expect(res.distribution.map((d) => d.share)).toEqual([0.75, 0.5]);
    // Shares are not normalised — overlap lets them exceed 100 %.
    expect(res.distribution.reduce((s, d) => s + (d.share ?? 0), 0)).toBeGreaterThan(1);
  });

  it("returns share null when denominator is 0 (FR-140)", () => {
    const res = toQueryShare([{ queryId: Q1, displayName: "a", count: 0 }], 0);
    expect(res.distribution[0]?.share).toBeNull();
  });
});
