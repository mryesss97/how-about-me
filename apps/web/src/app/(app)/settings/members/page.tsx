import { RequireRole } from "@/features/auth/require-role";
import { ROUTE_ROLES } from "@/features/auth/route-roles";
import { MembersSettings } from "@/features/settings/members-settings";

export const metadata = { title: "Thành viên" };
export default function MembersPage() {
  return (
    <RequireRole roles={ROUTE_ROLES["/settings/members"]}>
      <MembersSettings />
    </RequireRole>
  );
}
