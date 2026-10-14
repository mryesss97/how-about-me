import { describe, expect, it } from "vitest";
import { ApiError } from "./client";
import { retryAfterSeconds, waitText, waitTextVi } from "./rate-limit";

describe("waitText", () => {
  it.each([
    [null, "later"],
    [0, "1 seconds"],
    [45, "45 seconds"],
    [60, "1 minute"],
    [61, "2 minutes"],
    [300, "5 minutes"],
  ] as const)("%s → %s", (s, text) => expect(waitText(s)).toBe(text));
});

describe("retryAfterSeconds", () => {
  it("reads details.retryAfterSeconds from 429 RATE_LIMITED", () => {
    expect(retryAfterSeconds(new ApiError(429, "RATE_LIMITED", "x", "r", { retryAfterSeconds: 90 }))).toBe(90);
  });
  it("returns null for other errors or missing details", () => {
    expect(retryAfterSeconds("x")).toBeNull();
    expect(retryAfterSeconds(new ApiError(403, "FORBIDDEN_ROLE", "x", "r", { retryAfterSeconds: 5 }))).toBeNull();
    expect(retryAfterSeconds(new ApiError(429, "RATE_LIMITED", "x", "r"))).toBeNull();
  });
});

describe("waitTextVi (#277)", () => {
  it.each([
    [null, "ít phút nữa"],
    [0.2, "1 giây"],
    [45, "45 giây"],
    [60, "1 phút"],
    [240, "4 phút"],
  ] as const)("%s → %s", (s, text) => expect(waitTextVi(s)).toBe(text));
});
