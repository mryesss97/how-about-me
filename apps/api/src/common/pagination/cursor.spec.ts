import { decodeCursor, encodeCursor } from "./cursor";

describe("cursor codec", () => {
  it("round-trips", () => {
    const c = { key: "2026-09-05T00:00:00.000Z", id: "0192a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });
  it("returns null for empty", () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });
  it("rejects tampered input with VALIDATION_ERROR", () => {
    expect(() => decodeCursor("not-base64-json")).toThrow(/Invalid cursor/);
    expect(() => decodeCursor(Buffer.from('{"a":1}').toString("base64url"))).toThrow(/Invalid cursor/);
  });
});
