// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

let user: { id: string } | null = null;
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }),
}));

const req = (path: string) => new NextRequest(new URL(path, "http://localhost:3000"));
const location = (res: Response) => {
  const l = res.headers.get("location");
  return l ? new URL(l).pathname + new URL(l).search : null;
};

beforeEach(() => {
  user = null;
});

// FR-010, #262
describe("proxy", () => {
  it("#262: signed-in /login → / (landing)", async () => {
    user = { id: "u1" };
    expect(location(await proxy(req("/login")))).toBe("/");
  });

  it("signed-out / → /login without next", async () => {
    expect(location(await proxy(req("/")))).toBe("/login");
  });

  it("signed-out /mentions → /login?next=", async () => {
    expect(location(await proxy(req("/mentions?q=a")))).toBe(`/login?next=${encodeURIComponent("/mentions?q=a")}`);
  });

  it("signed-in / passes through", async () => {
    user = { id: "u1" };
    expect(location(await proxy(req("/")))).toBeNull();
  });
});
