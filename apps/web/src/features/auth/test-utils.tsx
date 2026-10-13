import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { CurrentProjectProvider } from "./use-current-project";

export const projectFixture = (id: string, role: "admin" | "analyst" | "viewer", name = `P ${id}`) => ({
  id,
  name,
  slug: `p-${id.slice(0, 4)}`,
  timezone: "Asia/Ho_Chi_Minh",
  settings: { allowAnalystReanalyze: false, allowViewerExport: false },
  role,
});

export const meFixture = (projects: ReturnType<typeof projectFixture>[]) => ({
  id: "7f1c5a3e-2b4d-4c6e-8f9a-0b1c2d3e4f50",
  email: "a@b.co",
  displayName: null,
  projects,
});

export const P1 = "11111111-1111-4111-8111-111111111111";
export const P2 = "22222222-2222-4222-8222-222222222222";

export function Providers({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <CurrentProjectProvider>{children}</CurrentProjectProvider>
    </QueryClientProvider>
  );
}
