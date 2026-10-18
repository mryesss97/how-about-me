"use client";

import type { MentionDetail } from "@how-about-me/contracts";
import { RefreshCw01, UserCheck01 } from "@untitledui/icons";
import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { RequireRole } from "@/features/auth/require-role";
import { SettingsDialog } from "@/features/shared/settings-dialog";
import { isInFlight } from "./api";
import { PlaqueButton } from "@/features/shared/plaque-button";

type Props = {
  mention: MentionDetail;
  /** `canReanalyze(role, settings)` — admin, or analyst when the project allows it (FR-155, BR-033). */
  canReanalyze: boolean;
  onReanalyze: () => void;
  isReanalyzing: boolean;
  /** `canOverride(role)` — admin or analyst (FR-191; server enforces, FR-015). */
  canOverride: boolean;
  /** Opens the override dialog (owned by `MentionDetail`, #338). */
  onOpenOverride: () => void;
};

/**
 * Operations for one mention — FR-155, TC-MEN-013. Only the two plaques remain (#338); copy / open
 * moved to the "Bài gốc" board header (`OriginalActions`). Renders nothing when neither is allowed.
 */
export function OperationsToolbar({
  mention: m,
  canReanalyze,
  onReanalyze,
  isReanalyzing,
  canOverride,
  onOpenOverride,
}: Props) {
  const [confirm, setConfirm] = useState(false);
  const busy = isReanalyzing || isInFlight(m.analysis.status);
  if (!canReanalyze && !canOverride) return null;
  return (
    <div className="flex flex-nowrap items-center gap-2" role="toolbar" aria-label="Thao tác">
      {canReanalyze ? (
        <RequireRole roles={["admin", "analyst"]} fallback={null}>
          <PlaqueButton
            iconLeading={RefreshCw01}
            isDisabled={busy}
            aria-busy={isReanalyzing}
            onClick={() => setConfirm(true)}
          >
            Phân tích lại
          </PlaqueButton>
        </RequireRole>
      ) : null}
      {canOverride ? (
        <RequireRole roles={["admin", "analyst"]} fallback={null}>
          <PlaqueButton iconLeading={UserCheck01} onClick={onOpenOverride}>
            Ghi đè
          </PlaqueButton>
        </RequireRole>
      ) : null}
      <SettingsDialog isOpen={confirm} onClose={() => setConfirm(false)} title="Phân tích lại bài nhắc này?">
        <p className="text-sm text-tertiary">
          Một lượt phân tích mới sẽ được xếp hàng. Kết quả trước vẫn nằm trong Lịch sử (chỉ thêm, không ghi đè).
        </p>
        <div className="flex justify-end gap-2">
          <Button size="sm" color="secondary" onClick={() => setConfirm(false)}>
            Huỷ
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setConfirm(false);
              onReanalyze();
            }}
          >
            Phân tích lại
          </Button>
        </div>
      </SettingsDialog>
    </div>
  );
}
