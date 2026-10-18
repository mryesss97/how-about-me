import { describe, expect, it } from "vitest";
import { queueNeighbours } from "./queue-nav";

// #339: one-after-another navigation in the Reviews slide-out.
describe("queueNeighbours (#339)", () => {
  const ids = ["a", "b", "c"];
  it("middle, first and last item", () => {
    expect(queueNeighbours(ids, "b", null)).toEqual({ index: 1, prevId: "a", nextId: "c" });
    expect(queueNeighbours(ids, "a", null)).toEqual({ index: 0, prevId: null, nextId: "b" });
    expect(queueNeighbours(ids, "c", 2)).toEqual({ index: 2, prevId: "b", nextId: null });
  });
  it("current gone (marked, BR-040 optimistic remove) → the item that slid into its place is next", () => {
    expect(queueNeighbours(["a", "c"], "b", 1)).toEqual({ index: null, prevId: "a", nextId: "c" });
    expect(queueNeighbours(["a", "b"], "c", 2)).toEqual({ index: null, prevId: "b", nextId: null });
  });
  it("empty list and deep link never seen in the list → no navigation", () => {
    expect(queueNeighbours([], "x", 0)).toEqual({ index: null, prevId: null, nextId: null });
    expect(queueNeighbours(ids, "x", null)).toEqual({ index: null, prevId: null, nextId: null });
  });
});
