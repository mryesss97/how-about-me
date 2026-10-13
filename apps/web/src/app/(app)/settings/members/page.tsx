import { RequireRole } from "@/features/auth/require-role";
import { ROUTE_ROLES } from "@/features/auth/route-roles";

export const metadata = { title: "Members" };
export default function MembersPage() {
  return (
    <RequireRole roles={ROUTE_ROLES["/settings/members"]}>
      <p className="text-sm text-tertiary">Invite members and manage roles (admin) — T-036.</p>
    </RequireRole>
  );
}
