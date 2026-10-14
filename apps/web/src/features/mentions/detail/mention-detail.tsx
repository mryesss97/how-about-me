"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { useRole } from "@/features/auth/use-role";
import { EmptyState, QueryState, SkeletonBlock } from "@/features/shared/query-state";
import { ApiError } from "@/lib/api/client";
import { env } from "@/lib/env";
import { cx } from "@/utils/cx";
import { AnalysisTabs } from "./analysis-tabs";
import { canOverride, canReanalyze, useCreateOverride, useMentionDetail, useReanalyze, useRevokeOverride } from "./api";
import { OperationsToolbar } from "./operations-toolbar";
import { OriginalPanel } from "./original-panel";
import { StatusBanner } from "./status-banner";

type Props = { mentionId: string; variant: "page" | "slideout" };

/** One column of the detail as an Operate board (#277): navy keyline + condensed caps title, Inter inside. */
function DetailBoard({ title, variant, children }: { title: string; variant: Props["variant"]; children: ReactNode }) {
  return (
    <div className="operate-board min-w-0">
      <span aria-hidden className="sign-keyline" />
      <div className={cx("relative flex min-w-0 flex-col gap-4", variant === "page" ? "p-5 sm:p-6" : "p-4")}>
        <h2 className="operate-board-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Mention detail body shared by the full page and the slide-out — UX §3.4, FR-154..158. */
export function MentionDetail({ mentionId, variant }: Props) {
  const { project } = useCurrentProject();
  const { role, settings } = useRole();
  const pid = project?.id;
  const tz = project?.timezone ?? env.NEXT_PUBLIC_DEFAULT_TIMEZONE;
  const q = useMentionDetail(pid, mentionId);
  const reanalyze = useReanalyze(pid, mentionId);
  const createOverride = useCreateOverride(pid, mentionId);
  const revokeOverride = useRevokeOverride(pid, mentionId);
  const mayOverride = canOverride(role);

  if (q.error instanceof ApiError && q.error.code === "NOT_FOUND")
    return (
      <EmptyState
        title="Không tìm thấy bài nhắc"
        description="Bài có thể thuộc dự án khác hoặc không còn tồn tại."
        action={
          <Link href="/mentions" className="text-sm font-semibold text-brand-secondary">
            Quay lại danh sách
          </Link>
        }
      />
    );

  const err = q.error
    ? q.error instanceof ApiError
      ? { code: q.error.code, message: q.error.message, requestId: q.error.requestId }
      : { message: "Phản hồi không hợp lệ từ máy chủ." }
    : null;
  const m = q.data;

  return (
    <QueryState
      isLoading={!pid || q.isLoading}
      error={err}
      onRetry={() => void q.refetch()}
      skeleton={<SkeletonBlock lines={8} />}
    >
      {m ? (
        <div className="flex flex-col gap-4">
          <StatusBanner
            analysis={m.analysis}
            canRetry={role === "admin"}
            onRetry={() => reanalyze.mutate()}
            isRetrying={reanalyze.isPending}
          />
          <OperationsToolbar
            mention={m}
            canReanalyze={canReanalyze(role, settings)}
            onReanalyze={() => reanalyze.mutate()}
            isReanalyzing={reanalyze.isPending}
            canOverride={mayOverride}
            onOverride={(body) =>
              createOverride.mutateAsync(body).then(
                () => true,
                () => false,
              )
            }
            isOverriding={createOverride.isPending}
          />
          <div className={cx("grid gap-6", variant === "page" && "lg:grid-cols-2")}>
            <DetailBoard title="Bài gốc" variant={variant}>
              <OriginalPanel mention={m} tz={tz} />
            </DetailBoard>
            <DetailBoard title="Phân tích" variant={variant}>
              <AnalysisTabs
                mention={m}
                tz={tz}
                canOverride={mayOverride}
                onRevoke={(oid) => revokeOverride.mutate(oid)}
                isRevoking={revokeOverride.isPending}
              />
            </DetailBoard>
          </div>
        </div>
      ) : null}
    </QueryState>
  );
}
