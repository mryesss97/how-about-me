import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hardSignOut } from "./sign-out";

const signOut = vi.fn();
vi.mock("@/lib/supabase/browser", () => ({ getSupabaseBrowserClient: () => ({ auth: { signOut } }) }));

describe("hardSignOut (FR-011, TC-AUTH-016, TC-AUTH-008)", () => {
  const original = window.location;
  const replace = vi.fn();
  Object.defineProperty(window, "location", { configurable: true, value: { ...original, replace } });
  afterEach(() => vi.clearAllMocks());

  it("signs out, clears the cache and replaces history with /login?reason=expired", async () => {
    signOut.mockResolvedValue({ error: null });
    const qc = new QueryClient();
    const clear = vi.spyOn(qc, "clear");
    await hardSignOut(qc, "expired");
    expect(signOut).toHaveBeenCalled();
    expect(clear).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/login?reason=expired");
  });

  it("still clears and redirects when Supabase signOut throws", async () => {
    signOut.mockRejectedValue(new Error("offline"));
    const qc = new QueryClient();
    const clear = vi.spyOn(qc, "clear");
    await hardSignOut(qc);
    expect(clear).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
