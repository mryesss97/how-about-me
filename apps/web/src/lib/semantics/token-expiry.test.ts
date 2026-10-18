import { describe, expect, it } from "vitest";
import { TOKEN_WARN_DAYS, tokenExpiryState } from "./token-expiry";

const NOW = Date.parse("2026-10-19T00:00:00.000Z");
const inDays = (d: number) => new Date(NOW + d * 86_400_000).toISOString();

// FR-046 / BR-017
describe("tokenExpiryState", () => {
  it("7-day boundary: 7 → soon, 8 → ok", () => {
    expect(TOKEN_WARN_DAYS).toBe(7);
    expect(tokenExpiryState("connected", inDays(7), NOW)).toBe("soon");
    expect(tokenExpiryState("connected", inDays(8), NOW)).toBe("ok");
    expect(tokenExpiryState("connected", inDays(0.5), NOW)).toBe("soon");
  });
  it("≤ 0 days → expired", () => {
    expect(tokenExpiryState("connected", inDays(0), NOW)).toBe("expired");
    expect(tokenExpiryState("connected", inDays(-2), NOW)).toBe("expired");
  });
  it("null expiry or non-connected → unknown", () => {
    expect(tokenExpiryState("connected", null, NOW)).toBe("unknown");
    expect(tokenExpiryState("expired", inDays(3), NOW)).toBe("unknown");
  });
});
