import { redirect } from "next/navigation";
import { AuthBridge } from "@/features/auth/auth-bridge";
import { RequireProject } from "@/features/auth/require-project";
import { AppSidebar } from "@/features/shared/app-sidebar";
import { CollectionHealthProvider } from "@/features/shared/health-strip";
import { getServerUser } from "@/lib/supabase/server";

// Never serve a cached authenticated shell (TC-AUTH-016).
export const dynamic = "force-dynamic";

/** Authenticated shell. Server-side session guard (second layer after proxy.ts) — FR-010. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  return (
    <AuthBridge>
      {/* #345: one system-status read feeds the health strip and the sidebar dot. */}
      <CollectionHealthProvider>
        <div className="flex min-h-dvh flex-col lg:flex-row">
          {/* #325: skip link, first focusable element of the shell. */}
          <a href="#main-content" className="skip-link">
            Bỏ qua tới nội dung chính
          </a>
          <AppSidebar />
          {/* #274: working screens stand on the signboard wall; cards are white enamel boards. */}
          <main id="main-content" tabIndex={-1} className="min-w-0 outline-none flex-1 bg-[var(--wall)]">
            <RequireProject>{children}</RequireProject>
          </main>
        </div>
      </CollectionHealthProvider>
    </AuthBridge>
  );
}
