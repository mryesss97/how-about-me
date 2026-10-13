"use client";

import { Button } from "@/components/base/buttons/button";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { SettingsDialog } from "../settings-dialog";

/**
 * FR-196: offered after a new policy version when posts were analysed with an older one.
 * Calls no API — bulk re-analysis / mark-stale does not exist yet.
 * TODO(#116): wire "Re-analyse" to the mark-stale endpoint once T-145 ships.
 */
export function ReanalysisPromptDialog({
  outdatedCount,
  isOpen,
  onClose,
}: {
  outdatedCount: number;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <SettingsDialog isOpen={isOpen} onClose={onClose} title="Re-analyse older posts?">
      <p className="text-sm text-secondary">
        {outdatedCount.toLocaleString("en-US")} posts were analysed with an older policy. Re-analyse them now?
      </p>
      <div className="flex justify-end gap-3">
        <Button color="secondary" onClick={onClose}>
          Later
        </Button>
        {/* Focusable, aria-disabled trigger styled like a disabled primary Button so the tooltip still shows. */}
        <Tooltip title="Bulk re-analysis is not available yet (T-145)">
          <TooltipTrigger
            aria-disabled="true"
            className="cursor-not-allowed rounded-lg bg-brand-solid px-3.5 py-2.5 text-sm font-semibold text-white opacity-50"
          >
            Re-analyse
          </TooltipTrigger>
        </Tooltip>
      </div>
    </SettingsDialog>
  );
}
