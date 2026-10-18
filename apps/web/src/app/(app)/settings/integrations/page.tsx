import { RequireRole } from "@/features/auth/require-role";
import { ROUTE_ROLES } from "@/features/auth/route-roles";
import { IntegrationsSettings } from "@/features/settings/integrations/integrations-settings";

export const metadata = { title: "Kết nối" };
export default function IntegrationsPage() {
  return (
    <RequireRole roles={ROUTE_ROLES["/settings/integrations"]}>
      <IntegrationsSettings />
    </RequireRole>
  );
}
