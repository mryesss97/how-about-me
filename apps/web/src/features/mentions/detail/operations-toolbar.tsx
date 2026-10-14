"use client";

import type { CreateOverrideBody, MentionDetail } from "@how-about-me/contracts";
import { Copy01, LinkExternal01, RefreshCw01, UserCheck01 } from "@untitledui/icons";
import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { RequireRole } from "@/features/auth/require-role";
import { SettingsDialog } from "@/features/shared/settings-dialog";
import { safePermalink } from "../mention-row";
import { isInFlight } from "./api";
import { OverrideDialog } from "./override-form";
import { useCopy } from "./use-copy";

const PLAQUE =
  "plaque-button inline-flex items-center gap-2 px-3 py-1.5 outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

type Props = {
  mention: MentionDetail;
  /** `canReanalyze(role, settings)` — admin, or analyst when the project allows it (FR-155, BR-033). */
  canReanalyze: boolean;
  onReanalyze: () => void;
  isReanalyzing: boolean;
  /** `canOverride(role)` — admin or analyst (FR-191; server enforces, FR-015). */
  canOverride: boolean;
  /** Resolves `true` when the override was saved, so the dialog can close. */
  onOverride: (body: CreateOverrideBody) => Promise<boolean>;
  isOverriding: boolean;
};

/** Operations for one mention — FR-155, TC-MEN-013, TC-MEN-019. */
export function OperationsToolbar({
  mention: m,
  canReanalyze,
  onReanalyze,
  isReanalyzing,
  canOverride,
  onOverride,
  isOverriding,
}: Props) {
  const [confirm, setConfirm] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const copy = useCopy();
  const link = safePermalink(m.permalink);
  const busy = isReanalyzing || isInFlight(m.analysis.status);
  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Thao tác">
      {canReanalyze ? (
        <RequireRole roles={["admin", "analyst"]} fallback={null}>
          <button
            type="button"
            className={PLAQUE}
            disabled={busy}
            aria-busy={isReanalyzing}
            onClick={() => setConfirm(true)}
          >
            <RefreshCw01 className="size-4" aria-hidden />
            Phân tích lại
          </button>
        </RequireRole>
      ) : null}
      {canOverride ? (
        <RequireRole roles={["admin", "analyst"]} fallback={null}>
          <button type="button" className={PLAQUE} onClick={() => setOverriding(true)}>
            <UserCheck01 className="size-4" aria-hidden />
            Ghi đè
          </button>
        </RequireRole>
      ) : null}
      <button type="button" className={PLAQUE} onClick={() => void copy(m.platformPostId, "ID bài")}>
        <Copy01 className="size-4" aria-hidden />
        Sao chép ID bài
      </button>
      <button
        type="button"
        className={PLAQUE}
        disabled={!m.permalink}
        onClick={() => m.permalink && void copy(m.permalink, "liên kết")}
      >
        <Copy01 className="size-4" aria-hidden />
        Sao chép liên kết
      </button>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 text-sm font-semibold text-brand-secondary hover:underline"
        >
          Mở trên Threads
          <LinkExternal01 className="size-4" aria-hidden />
        </a>
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
      <OverrideDialog
        mention={m}
        isOpen={overriding}
        onClose={() => setOverriding(false)}
        isPending={isOverriding}
        onSubmit={(body) => void onOverride(body).then((ok) => ok && setOverriding(false))}
      />
    </div>
  );
}
