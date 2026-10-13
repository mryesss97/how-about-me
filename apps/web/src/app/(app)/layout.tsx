import { redirect } from "next/navigation";
import { AuthBridge } from "@/features/auth/auth-bridge";
import { RequireProject } from "@/features/auth/require-project";
import { AppSidebar } from "@/features/shared/app-sidebar";
import { getServerUser } from "@/lib/supabase/server";

// Never serve a cached authenticated shell (TC-AUTH-016).
export const dynamic = "force-dynamic";

/** Authenticated shell. Server-side session guard (second layer after proxy.ts) — FR-010. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  return (
    <AuthBridge>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <AppSidebar />
        <main className="min-w-0 flex-1 bg-primary">
          <RequireProject>{children}</RequireProject>
        </main>
      </div>
    </AuthBridge>
  );
}
