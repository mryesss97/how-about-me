import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, setAccessTokenGetter, setTokenExpiredHandler, toSearchParams } from "./client";

describe("toSearchParams", () => {
  it("repeats array keys and skips empty values", () => {
    expect(
      toSearchParams({ sentiment: ["positive", "negative"], q: "", cursor: undefined, limit: 25, compare: true }),
    ).toBe("?sentiment=positive&sentiment=negative&limit=25&compare=true");
  });
  it("returns empty string without params", () => {
    expect(toSearchParams()).toBe("");
    expect(toSearchParams({})).toBe("");
  });
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const err = (code: string) => ({ error: { code, message: code, requestId: "r1" } });

describe("apiFetch auth (FR-011, TC-AUTH-008)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setTokenExpiredHandler(null);
    setAccessTokenGetter(() => null);
  });

  it("attaches the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    setAccessTokenGetter(async () => "tok");
    await apiFetch("/me");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("refreshes once on AUTH_TOKEN_EXPIRED and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, err("AUTH_TOKEN_EXPIRED")))
      .mockResolvedValueOnce(json(200, { ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const handler = vi.fn().mockResolvedValue(true);
    setTokenExpiredHandler(handler);
    await expect(apiFetch("/me")).resolves.toEqual({ ok: 1 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws ApiError when refresh fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(401, err("AUTH_TOKEN_EXPIRED"))));
    setTokenExpiredHandler(vi.fn().mockResolvedValue(false));
    await expect(apiFetch("/me")).rejects.toBeInstanceOf(ApiError);
  });

  it("does not loop when the retry is still 401", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json(401, err("AUTH_TOKEN_EXPIRED")));
    vi.stubGlobal("fetch", fetchMock);
    const handler = vi.fn().mockResolvedValue(true);
    setTokenExpiredHandler(handler);
    await expect(apiFetch("/me")).rejects.toMatchObject({ code: "AUTH_TOKEN_EXPIRED" });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not refresh on AUTH_INVALID_TOKEN", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(401, err("AUTH_INVALID_TOKEN"))));
    const handler = vi.fn();
    setTokenExpiredHandler(handler);
    await expect(apiFetch("/me")).rejects.toMatchObject({ code: "AUTH_INVALID_TOKEN" });
    expect(handler).not.toHaveBeenCalled();
  });
});
