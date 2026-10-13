import { decodeSortCursor, encodeSortCursor } from "./cursor";

describe("sort cursor codec (T-095)", () => {
  const id = "0192a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  it("round-trips string and number keys", () => {
    const c = { sort: "safety_desc", keys: [3, "2026-10-01 00:00:00.123456+00"], id };
    expect(decodeSortCursor(encodeSortCursor(c), { sort: "safety_desc", arity: 2 })).toEqual(c);
  });
  it("returns null for empty", () => {
    expect(decodeSortCursor(undefined, { sort: "newest", arity: 1 })).toBeNull();
    expect(decodeSortCursor("", { sort: "newest", arity: 1 })).toBeNull();
  });
  it.each([
    ["garbage", "%%%not-json"],
    ["wrong version", enc({ v: 2, s: "newest", k: ["x"], id })],
    ["other sort", enc({ v: 1, s: "oldest", k: ["x"], id })],
    ["wrong arity", enc({ v: 1, s: "newest", k: ["x", "y"], id })],
    ["non-uuid id", enc({ v: 1, s: "newest", k: ["x"], id: "1; drop" })],
    ["object key", enc({ v: 1, s: "newest", k: [{ a: 1 }], id })],
    ["array payload", enc([1, 2])],
  ])("rejects %s with VALIDATION_ERROR", (_n, raw) => {
    expect(() => decodeSortCursor(raw, { sort: "newest", arity: 1 })).toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR" }),
    );
  });
});
