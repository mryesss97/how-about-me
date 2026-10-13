"use client";

import type { BulkReanalyzeResponse, UserRole } from "@how-about-me/contracts";
import { RefreshCw01 } from "@untitledui/icons";
import { useEffect, useState } from "react";
import { Heading as AriaHeading } from "react-aria-components";
import { toast } from "sonner";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { ApiError } from "@/lib/api/client";
import { retryAfterSeconds, waitText } from "@/lib/api/rate-limit";
import { formatCount } from "@/lib/format/number";
import { useBulkReanalyze } from "./api";

const TITLE = "Re-analyze mentions?";

/** personas §3: admin only, even with `allowAnalystReanalyze` — UX only, the API enforces it (FR-015). */
export function canBulkReanalyze(role: UserRole | null): boolean {
  return role === "admin";
}

function errorText(err: unknown): string {
  if (err instanceof ApiError && err.code === "RATE_LIMITED")
    return `Re-analysis was requested recently. Try again in ${waitText(retryAfterSeconds(err))}.`;
  if (err instanceof ApiError && err.code === "FORBIDDEN_ROLE") return "You don't have permission to re-analyze.";
  const rid = err instanceof ApiError && err.requestId ? ` (request ${err.requestId})` : "";
  return `Could not start re-analysis${rid}.`;
}

/**
 * T-146 / FR-196: previews (`dryRun=true`) on mount with the `params` snapshot taken when opened, then Confirm
 * runs the same filters for real. Mounted only while open, so closing resets the state.
 */
export function BulkReanalyzeDialog({
  pid,
  params,
  onClose,
}: {
  pid: string;
  params: Record<string, string>;
  onClose: () => void;
}) {
  const m = useBulkReanalyze(pid);
  const [preview, setPreview] = useState<BulkReanalyzeResponse | null>(null);
  const { mutate } = m;

  const run = (dryRun: boolean) =>
    mutate(
      { params, dryRun },
      {
        onSuccess: (r) => {
          if (dryRun) return setPreview(r);
          // BR-024: enqueued can be below min(matched, cap) — current or pending runs are skipped.
          toast.success(
            r.enqueued > 0 ? `Re-analysis queued for ${formatCount(r.enqueued)} posts` : "No posts needed re-analysis",
          );
          onClose();
        },
      },
    );

  useEffect(() => {
    // One dry run on open with the snapshot; `params` is fixed for the dialog's lifetime.
    mutate({ params, dryRun: true }, { onSuccess: setPreview });
  }, [mutate, params]);

  const error = m.error;
  const previewFailed = m.isError && m.variables?.dryRun === true;
  const rateLimited = error instanceof ApiError && error.code === "RATE_LIMITED";
  // Nothing matched: a real call would only use the project's 5-minute bulk window (FR-196).
  const nothingToDo = preview !== null && preview.matched === 0;

  return (
    <ModalOverlay isOpen onOpenChange={(o) => !o && onClose()} isDismissable>
      <Modal className="max-w-md">
        <Dialog aria-label={TITLE}>
          <div className="flex w-full flex-col gap-4 rounded-xl bg-primary p-6 shadow-xl">
            <AriaHeading slot="title" className="text-lg font-semibold text-primary">
              {TITLE}
            </AriaHeading>
            {nothingToDo ? (
              <p className="text-sm text-secondary">No mentions match the current filters.</p>
            ) : preview ? (
              <p className="text-sm text-secondary">
                {formatCount(preview.matched)} mentions match the current filters. Up to {formatCount(preview.cap)}{" "}
                posts will be re-analyzed now; posts that already have a current analysis or a pending run are skipped.
                {preview.matched > preview.cap ? " Narrow the filters to re-analyze the rest." : null}
              </p>
            ) : !previewFailed ? (
              <p className="text-sm text-tertiary" aria-busy="true">
                Counting matching mentions…
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-error-primary">
                {errorText(error)}
              </p>
            ) : null}
            <div className="flex justify-end gap-3">
              {nothingToDo ? (
                <Button color="secondary" onClick={onClose}>
                  Close
                </Button>
              ) : (
                <>
                  <Button color="secondary" onClick={onClose}>
                    Cancel
                  </Button>
                  {previewFailed && !rateLimited ? (
                    <Button isLoading={m.isPending} isDisabled={m.isPending} onClick={() => run(true)}>
                      Retry
                    </Button>
                  ) : (
                    <Button
                      isLoading={m.isPending}
                      isDisabled={m.isPending || rateLimited || preview === null}
                      onClick={() => run(false)}
                    >
                      Confirm
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Toolbar action on /mentions (UX §3.3, T-146). Render only when `canBulkReanalyze`. */
export function BulkReanalyzeButton({ pid, params }: { pid: string; params: Record<string, string> }) {
  // Snapshot of the pinned list params at open time: filter changes while open do not alter the run.
  const [snapshot, setSnapshot] = useState<Record<string, string> | null>(null);
  return (
    <>
      <Button color="secondary" size="sm" iconLeading={RefreshCw01} onClick={() => setSnapshot(params)}>
        Re-analyze
      </Button>
      {snapshot ? <BulkReanalyzeDialog pid={pid} params={snapshot} onClose={() => setSnapshot(null)} /> : null}
    </>
  );
}
