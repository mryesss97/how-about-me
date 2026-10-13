import { AppError } from "../../common/errors/app.error";
import { ProviderError } from "../../common/errors/provider.error";
import { backoffMs, decideFailure, ERROR_MESSAGE_MAX } from "./analysis-failure-policy";

describe("analysis failure policy (FR-113, doc 07 §8, T-075)", () => {
  it.each([
    ["ANALYSIS_PROVIDER_ERROR", "retry"],
    ["ANALYSIS_SCHEMA_INVALID", "fail"],
    ["ANALYSIS_PROVIDER_BAD_REQUEST", "fail"],
    ["ANALYSIS_PROVIDER_AUTH", "fail_and_pause"],
  ] as const)("FR-113: ProviderError %s → %s with the same code", (code, action) => {
    expect(decideFailure(new ProviderError(code, "m"))).toEqual({ action, code, message: "m" });
  });

  it("FR-113: plain Error → retry INTERNAL without its message", () => {
    const d = decideFailure(new Error("secret post text"));
    expect(d).toEqual({ action: "retry", code: "INTERNAL", message: "unexpected_processor_error" });
  });

  it("FR-113: other AppError → retry INTERNAL", () => {
    expect(decideFailure(new AppError("INTERNAL", "db down"))).toMatchObject({ action: "retry", code: "INTERNAL" });
  });

  it("BR-027: message truncated to ERROR_MESSAGE_MAX", () => {
    const d = decideFailure(new ProviderError("ANALYSIS_SCHEMA_INVALID", "x".repeat(2000)));
    expect(d.message.length).toBe(ERROR_MESSAGE_MAX);
  });

  it("FR-113: backoff = min(30 s, max(2 s × 2^attempt, Retry-After))", () => {
    const e = new ProviderError("ANALYSIS_PROVIDER_ERROR");
    expect(backoffMs(1, e)).toBe(4000);
    expect(backoffMs(2, e)).toBe(8000);
    expect(backoffMs(5, e)).toBe(30_000);
    expect(backoffMs(1, new ProviderError("ANALYSIS_PROVIDER_ERROR", "m", { retryAfterMs: 20_000 }))).toBe(20_000);
    expect(backoffMs(1, new ProviderError("ANALYSIS_PROVIDER_ERROR", "m", { retryAfterMs: 120_000 }))).toBe(30_000);
  });
});
