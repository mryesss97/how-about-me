import { toPostExcerpt } from "./analysis-runs.repository";

// #343: post excerpt for the failed-analysis ops list (docs 05 §9).
describe("toPostExcerpt", () => {
  it("returns null for null, empty and whitespace-only text", () => {
    expect(toPostExcerpt(null)).toBeNull();
    expect(toPostExcerpt("")).toBeNull();
    expect(toPostExcerpt("  \n\t ")).toBeNull();
  });

  it("collapses whitespace and keeps short text as is", () => {
    expect(toPostExcerpt("  hello\n\n  world ")).toBe("hello world");
  });

  it("cuts to 80 code points with an ellipsis", () => {
    const out = toPostExcerpt("a".repeat(100));
    expect(out).toBe(`${"a".repeat(80)}…`);
  });

  it("never splits an emoji (surrogate pair)", () => {
    const out = toPostExcerpt("😀".repeat(90)) ?? "";
    expect(Array.from(out)).toHaveLength(81);
    expect(out.endsWith("😀…")).toBe(true);
  });
});
