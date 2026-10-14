import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthBridge } from "@/features/auth/auth-bridge";
import { RequireProject } from "@/features/auth/require-project";
import { LandingView } from "@/features/landing/landing-view";
import { getServerUser } from "@/lib/supabase/server";

// Never serve a cached authenticated page (TC-AUTH-016).
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "How About Me" };

/** Landing `/` (#262): signed-in only, full screen — no sidebar. Server guard is the second layer after proxy.ts (FR-010). */
export default async function Home() {
  const user = await getServerUser();
  if (!user) redirect("/login");
  return (
    <AuthBridge>
      <div className="min-h-dvh bg-secondary">
        <RequireProject>
          <LandingView />
        </RequireProject>
      </div>
    </AuthBridge>
  );
}
