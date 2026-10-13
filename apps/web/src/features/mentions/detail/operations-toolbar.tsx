"use client";

import type { CreateOverrideBody, MentionDetail } from "@how-about-me/contracts";
import { Copy01, LinkExternal01, RefreshCw01, UserCheck01 } from "@untitledui/icons";
import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { RequireRole } from "@/features/auth/require-role";
import { SettingsDialog } from "@/features/settings/settings-dialog";
import { safePermalink } from "../mention-row";
import { isInFlight } from "./api";
import { OverrideDialog } from "./override-form";
import { useCopy } from "./use-copy";

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
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Mention operations">
      {canReanalyze ? (
        <RequireRole roles={["admin", "analyst"]} fallback={null}>
          <Button
            size="sm"
            color="secondary"
            iconLeading={RefreshCw01}
            isDisabled={busy}
            isLoading={isReanalyzing}
            onClick={() => setConfirm(true)}
          >
            Re-analyze
          </Button>
        </RequireRole>
      ) : null}
      {canOverride ? (
        <RequireRole roles={["admin", "analyst"]} fallback={null}>
          <Button size="sm" color="secondary" iconLeading={UserCheck01} onClick={() => setOverriding(true)}>
            Override
          </Button>
        </RequireRole>
      ) : null}
      <Button size="sm" color="tertiary" iconLeading={Copy01} onClick={() => void copy(m.platformPostId, "Post ID")}>
        Copy post ID
      </Button>
      <Button
        size="sm"
        color="tertiary"
        iconLeading={Copy01}
        isDisabled={!m.permalink}
        onClick={() => m.permalink && void copy(m.permalink, "Permalink")}
      >
        Copy permalink
      </Button>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 text-sm font-semibold text-brand-secondary hover:underline"
        >
          Open on Threads
          <LinkExternal01 className="size-4" aria-hidden />
        </a>
      ) : null}
      <SettingsDialog isOpen={confirm} onClose={() => setConfirm(false)} title="Re-analyze this mention?">
        <p className="text-sm text-tertiary">
          A new analysis run is queued. Previous results stay in History (append-only).
        </p>
        <div className="flex justify-end gap-2">
          <Button size="sm" color="secondary" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setConfirm(false);
              onReanalyze();
            }}
          >
            Re-analyze
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
