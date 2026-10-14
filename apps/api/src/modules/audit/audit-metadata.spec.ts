import { AUDIT_MAX_STRING, sanitizeAuditMetadata } from "./audit-metadata";

/** FR-200 / TC-SYS-014: audit metadata keeps allow-listed fields only and never stores secrets. */
describe("sanitizeAuditMetadata (FR-200)", () => {
  it("drops top-level keys outside the allow-list", () => {
    expect(sanitizeAuditMetadata({ role: "analyst", foo: 1, rawPayload: { a: 1 } })).toEqual({ role: "analyst" });
  });

  it("TC-SYS-014: drops secret-like keys at any depth, even inside allow-listed objects", () => {
    const out = sanitizeAuditMetadata({
      token: "t",
      apiKey: "k",
      changes: { name: "x", accessToken: "a", nested: { secret: "s", client_secret: "c", ok: true } },
      before: { password: "p", serviceRoleKey: "r", credentials: "c", cookie: "k", key: "sk", enabled: false },
    });
    expect(out).toEqual({ changes: { name: "x", nested: { ok: true } }, before: { enabled: false } });
    expect(JSON.stringify(out)).not.toMatch(/token|secret|password|"t"|"k"/i);
  });

  it("truncates long strings and limits depth", () => {
    const out = sanitizeAuditMetadata({ reason: "x".repeat(900), changes: { a: { b: { c: 1 } } } });
    expect((out?.reason as string).length).toBe(AUDIT_MAX_STRING);
    expect(out?.changes).toEqual({ a: {} }); // top-level → changes → a = 3 levels
  });

  it("#261: a list of scalars at the max depth is kept (setting diffs); a list of objects there is still dropped", () => {
    const out = sanitizeAuditMetadata({
      changes: { "settings.landingTerms": { from: [], to: ["giá vé", "app"] }, x: { y: [{ z: 1 }] } },
    });
    expect(out?.changes).toEqual({ "settings.landingTerms": { from: [], to: ["giá vé", "app"] }, x: {} });
  });

  it("replaces oversized metadata with { truncated: true }", () => {
    const postIds = Array.from({ length: 200 }, (_, i) => `00000000-0000-7000-8000-${String(i).padStart(12, "0")}`);
    expect(sanitizeAuditMetadata({ postIds })).toEqual({ truncated: true });
  });

  it("returns null for null/undefined/non-object/empty input", () => {
    expect(sanitizeAuditMetadata(null)).toBeNull();
    expect(sanitizeAuditMetadata(undefined)).toBeNull();
    expect(sanitizeAuditMetadata("str")).toBeNull();
    expect(sanitizeAuditMetadata([1])).toBeNull();
    expect(sanitizeAuditMetadata({ token: "x" })).toBeNull();
  });
});
