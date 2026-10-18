import { describe, expect, it } from "vitest";
import { previousWindow, termChange } from "./term-compare";

// #333 entry-5 (metric §5)
describe("previousWindow", () => {
  it("same length, ending at from", () => {
    expect(previousWindow("2026-10-10T00:00:00.000Z", "2026-10-17T00:00:00.000Z")).toEqual({
      from: "2026-10-03T00:00:00.000Z",
      to: "2026-10-10T00:00:00.000Z",
    });
  });
});

describe("termChange", () => {
  it("up / down / flat / new", () => {
    expect(termChange({ total: 38, negative: 8 }, { total: 31, negative: 4 })).toMatchObject({
      state: "up",
      previousTotal: 31,
    });
    expect(termChange({ total: 20, negative: 0 }, { total: 40, negative: 0 })).toMatchObject({
      state: "down",
      pct: -0.5,
    });
    expect(termChange({ total: 1000, negative: 0 }, { total: 1004, negative: 0 }).state).toBe("flat");
    expect(termChange({ total: 5, negative: 1 }, { total: 0, negative: 0 })).toMatchObject({
      state: "new",
      prevNegShare: null,
    });
  });
});
