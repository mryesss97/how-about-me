import { Prisma } from "@prisma/client";
import {
  createdAtKeysetSql,
  isUtcMicrosKey,
  decodeCreatedAtCursor,
  encodeCreatedAtCursor,
  orderByIds,
} from "./created-at-keyset";
import { encodeSortCursor } from "./cursor";

/** #188 (FR-051, FR-201): createdAt keyset cursor keeps µs and rejects tampering with 400. */
describe("created-at keyset (#188)", () => {
  const id = "0192a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
  const key = "2026-10-01T00:00:00.123456Z";
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

  it("round-trips a µs key", () => {
    expect(decodeCreatedAtCursor(encodeCreatedAtCursor({ key, id }))).toEqual({ key, id });
  });

  it("returns null for empty", () => {
    expect(decodeCreatedAtCursor(undefined)).toBeNull();
    expect(decodeCreatedAtCursor("")).toBeNull();
  });

  it.each([
    ["non-date key", enc({ v: 1, s: "created_desc", k: ["nope"], id })],
    ["ms-only key", enc({ v: 1, s: "created_desc", k: ["2026-10-01T00:00:00.123Z"], id })],
    ["pg text key", enc({ v: 1, s: "created_desc", k: ["2026-10-01 00:00:00.123456+00"], id })],
    ["impossible date", enc({ v: 1, s: "created_desc", k: ["2026-02-30T00:00:00.000000Z"], id })],
    ["number key", enc({ v: 1, s: "created_desc", k: [1], id })],
    ["non-uuid id", enc({ v: 1, s: "created_desc", k: [key], id: "1; drop" })],
    ["other sort", encodeSortCursor({ sort: "newest", keys: [key], id })],
    ["legacy [key,id] cursor", enc([key, id])],
  ])("rejects %s with VALIDATION_ERROR", (_n, raw) => {
    expect(() => decodeCreatedAtCursor(raw)).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });

  it("builds the row-value predicate", () => {
    expect(createdAtKeysetSql(null)).toBe(Prisma.empty);
    const sql = createdAtKeysetSql({ key, id });
    expect(sql.sql).toContain("(created_at, id) < (");
    expect(sql.values).toEqual([key, id]);
  });

  it("orderByIds follows keyset order and drops vanished ids", () => {
    expect(orderByIds(["b", "x", "a"], [{ id: "a" }, { id: "b" }])).toEqual([{ id: "b" }, { id: "a" }]);
  });

  it("#195 isUtcMicrosKey: accepts only real UTC µs keys", () => {
    expect(isUtcMicrosKey(key)).toBe(true);
    expect(isUtcMicrosKey("2026-10-01T00:00:00.123Z")).toBe(false);
    expect(isUtcMicrosKey("2026-10-01 00:00:00.123456+00")).toBe(false);
    expect(isUtcMicrosKey("2026-02-30T00:00:00.000000Z")).toBe(false);
    expect(isUtcMicrosKey(1700000000)).toBe(false);
  });
});
