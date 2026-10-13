"use client";

import type { MarkStaleResponse } from "@how-about-me/contracts";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/base/buttons/button";
import { ApiError } from "@/lib/api/client";
import { SettingsDialog } from "@/features/shared/settings-dialog";
import { retryAfterSeconds, waitText } from "@/lib/api/rate-limit";
import { useMarkStale } from "./api";

const fmt = (n: number) => n.toLocaleString("en-US");

function errorText(err: unknown): string {
  if (err instanceof ApiError && err.code === "RATE_LIMITED")
    return `Re-analysis was requested recently. Try again in ${waitText(retryAfterSeconds(err))}.`;
  if (err instanceof ApiError && err.code === "VALIDATION_ERROR")
    return "This version is already current; nothing to re-analyse.";
  const rid = err instanceof ApiError && err.requestId ? ` (request ${err.requestId})` : "";
  return `Could not start re-analysis${rid}.`;
}

/**
 * FR-196: offered to admins after a new policy version when posts were analysed with an older one.
 * "Re-analyse" first previews (`dryRun=true`) then on confirm marks results of `version` stale and
 * enqueues up to `cap` posts (BR-023; results stay append-only, BR-003). Server enforces admin (FR-015).
 */
export function ReanalysisPromptDialog({
  pid,
  version,
  outdatedCount,
  isOpen,
  onClose,
}: {
  pid: string;
  /** The `effectiveVersion` that was current before the save. */
  version: string;
  outdatedCount: number;
  isOpen: boolean;
  onClose: () => void;
}) {
  const m = useMarkStale(pid);
  const [preview, setPreview] = useState<MarkStaleResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  // Nothing to stale (version already current, or no run of it left): a real call would only use the
  // project's 5-minute bulk window (FR-196), so only Close is offered.
  const nothingToDo = preview !== null && preview.marked === 0;
  const terminal = nothingToDo || (error instanceof ApiError && error.code === "VALIDATION_ERROR");
  const rateLimited = error instanceof ApiError && error.code === "RATE_LIMITED";

  const run = (dryRun: boolean) => {
    setError(null);
    m.mutate(
      { version, dryRun },
      {
        onSuccess: (r) => {
          if (dryRun) return setPreview(r);
          toast.success(
            r.enqueued > 0 ? `Re-analysis queued for ${fmt(r.enqueued)} posts` : "No posts needed re-analysis",
          );
          onClose();
        },
        onError: setError,
      },
    );
  };

  return (
    <SettingsDialog isOpen={isOpen} onClose={onClose} title="Re-analyse older posts?">
      {nothingToDo ? (
        <p className="text-sm text-secondary">No results of the older policy are left to re-analyse.</p>
      ) : preview ? (
        <p className="text-sm text-secondary">
          {fmt(preview.marked)} results will be marked stale; up to {fmt(preview.cap)} posts will be re-analysed now.
          {preview.marked > preview.cap ? " Posts above this limit stay stale until the next bulk re-analysis." : null}
        </p>
      ) : (
        <p className="text-sm text-secondary">
          {fmt(outdatedCount)} posts were analysed with an older policy. Re-analyse them now?
        </p>
      )}
      {error ? (
        <p role="alert" className="text-sm text-error-primary">
          {errorText(error)}
        </p>
      ) : null}
      <div className="flex justify-end gap-3">
        {terminal ? (
          <Button color="secondary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button color="secondary" onClick={onClose}>
              {preview ? "Cancel" : "Later"}
            </Button>
            <Button
              isLoading={m.isPending}
              isDisabled={m.isPending || rateLimited}
              onClick={() => run(preview === null)}
            >
              {preview ? "Confirm" : "Re-analyse"}
            </Button>
          </>
        )}
      </div>
    </SettingsDialog>
  );
}
