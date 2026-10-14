import { RequireRole } from "@/features/auth/require-role";
import { ROUTE_ROLES } from "@/features/auth/route-roles";
import { SettingsBoard } from "@/features/settings/settings-board";

export const metadata = { title: "Kết nối" };
export default function IntegrationsPage() {
  return (
    <RequireRole roles={ROUTE_ROLES["/settings/integrations"]}>
      {/* T-041 builds the real screen; the token is never shown (CLAUDE.md secrets rule). */}
      <SettingsBoard title="Kết nối Threads">
        <p className="text-sm text-tertiary">
          Trạng thái kết nối Threads, cập nhật và kiểm tra token (quản trị viên) sẽ có ở đây. Token không bao giờ được
          hiển thị.
        </p>
      </SettingsBoard>
    </RequireRole>
  );
}
