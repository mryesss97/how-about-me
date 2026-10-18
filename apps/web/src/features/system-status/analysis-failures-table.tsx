"use client";

import { analysisErrorLabel } from "@/lib/semantics/sync-errors";
import type { AnalysisRun } from "@how-about-me/contracts";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/base/buttons/button";
import { DASH, formatCount } from "@/lib/format/number";
import { formatDateTime } from "@/lib/time/format";
import { withBack } from "@/lib/navigation/back-link";
import { retryErrorMessage, useRetryAnalysisRun } from "./api";
import { analysisTriggerLabel, truncateMiddle } from "./format";

const TH = "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-tertiary";
const TD = "px-3 py-3 align-top text-sm text-primary";

type Props = { pid: string; items: AnalysisRun[]; tz: string; isAdmin: boolean };

/** Failed analysis runs (FR-175, UX §3.6). "Thử lại" is admin-only UX; the server enforces FR-015. */
export function AnalysisFailuresTable({ pid, items, tz, isAdmin }: Props) {
  const retry = useRetryAnalysisRun(pid);
  // Every row with a retry in flight (two rows retried back to back both stay disabled).
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());

  const onRetry = (id: string) => {
    setBusyIds((prev) => new Set(prev).add(id));
    retry.mutate(id, {
      onSuccess: () => toast.success("Đã xếp lịch thử lại"),
      onError: (e) => toast.error(retryErrorMessage(e)),
      onSettled: () =>
        setBusyIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }),
    });
  };

  return (
    <div className="operate-board min-w-0">
      <span aria-hidden className="sign-keyline" />
      <div className="relative overflow-x-auto p-3">
        <table className="w-full">
          <thead className="border-b border-secondary bg-secondary">
            <tr>
              <th className={TH}>Thời gian</th>
              <th className={TH}>Mã lỗi</th>
              <th className={TH}>Bài viết</th>
              <th className={TH}>Phiên bản</th>
              <th className={TH}>Số lần thử</th>
              <th className={TH}>Kích hoạt</th>
              {isAdmin ? (
                <th className={TH}>
                  <span className="sr-only">Thao tác</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {items.map((r) => {
              const msg = r.errorMessage ?? "";
              return (
                <tr key={r.id} data-run-id={r.id} className="border-b border-secondary">
                  <td className={`${TD} whitespace-nowrap`}>{formatDateTime(r.completedAt ?? r.createdAt, tz)}</td>
                  <td className={TD} title={r.errorCode ? `${r.errorCode}${msg ? `: ${msg}` : ""}` : undefined}>
                    {r.errorCode ? (
                      <>
                        <div className="text-sm font-semibold text-error-primary">
                          {analysisErrorLabel(r.errorCode)}
                        </div>
                        <div className="font-mono text-xs text-tertiary">{r.errorCode}</div>
                      </>
                    ) : (
                      DASH
                    )}
                  </td>
                  <td className={TD}>
                    <Link
                      href={withBack(`/mentions/${r.postId}`, "/system-status")}
                      className="font-mono text-xs text-brand-secondary hover:underline"
                    >
                      {truncateMiddle(r.postId, 14)}
                    </Link>
                  </td>
                  <td className={`${TD} font-mono text-xs whitespace-nowrap`} title={r.effectiveVersion}>
                    {truncateMiddle(r.effectiveVersion, 28)}
                  </td>
                  <td className={TD}>{formatCount(r.attemptCount)}</td>
                  <td className={`${TD} whitespace-nowrap`}>{analysisTriggerLabel[r.trigger]}</td>
                  {isAdmin ? (
                    <td className={TD}>
                      <Button
                        color="secondary"
                        size="sm"
                        className="plaque"
                        aria-label={`Thử lại lượt phân tích ${r.id}`}
                        isLoading={busyIds.has(r.id)}
                        isDisabled={busyIds.has(r.id)}
                        onClick={() => onRetry(r.id)}
                      >
                        Thử lại
                      </Button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
