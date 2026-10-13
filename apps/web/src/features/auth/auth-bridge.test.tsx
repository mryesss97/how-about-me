import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

const getters: Array<() => unknown> = [];
vi.mock("@/lib/api/client", () => ({
  setAccessTokenGetter: (g: () => unknown) => getters.push(g),
  setTokenExpiredHandler: vi.fn(),
  apiFetch: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/supabase/browser", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "tok" } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));

import { AuthBridge } from "./auth-bridge";

// Regression: child effects run before the parent's, so the first GET /me used to go out without a bearer.
describe("AuthBridge", () => {
  it("registers the token getter before child effects run", () => {
    let countAtChildEffect = -1;
    function Child() {
      useEffect(() => {
        countAtChildEffect = getters.length;
      }, []);
      return null;
    }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthBridge>
          <Child />
        </AuthBridge>
      </QueryClientProvider>,
    );
    expect(countAtChildEffect).toBeGreaterThan(0);
  });
});
