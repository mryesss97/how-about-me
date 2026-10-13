import { RequireRole } from "@/features/auth/require-role";
import { ROUTE_ROLES } from "@/features/auth/route-roles";

export const metadata = { title: "Integrations" };
export default function IntegrationsPage() {
  return (
    <RequireRole roles={ROUTE_ROLES["/settings/integrations"]}>
      <p className="text-sm text-tertiary">
        Threads connection status, update token, verify (admin) — T-041. Tokens are never shown.
      </p>
    </RequireRole>
  );
}
