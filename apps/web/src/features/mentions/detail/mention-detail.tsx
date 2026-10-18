"use client";

import type { OverrideField } from "@how-about-me/contracts";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { useRole } from "@/features/auth/use-role";
import { EmptyState, QueryState, SkeletonBlock } from "@/features/shared/query-state";
import { ApiError } from "@/lib/api/client";
import { env } from "@/lib/env";
import { cx } from "@/utils/cx";
import { AnalysisTabs } from "./analysis-tabs";
import { canOverride, canReanalyze, useCreateOverride, useMentionDetail, useReanalyze, useRevokeOverride } from "./api";
import { OperationsToolbar } from "./operations-toolbar";
import { OriginalActions } from "./original-actions";
import { OriginalPanel } from "./original-panel";
import { OverrideDialog } from "./override-form";
import { ReviewNote } from "./review-note";
import { defaultOverrideField } from "./overrides";
import { StatusBanner } from "./status-banner";

type Props = {
  mentionId: string;
  variant: "page" | "slideout";
  /** #339: set inside the Reviews slide-out — hides the review note and offers "mark after saving". */
  reviewContext?: { onOverrideSaved?: (markReviewed: boolean) => void };
};

/** One column of the detail as an Operate board (#277): navy keyline + condensed caps title, Inter inside. */
function DetailBoard({
  title,
  variant,
  actions,
  children,
}: {
  title: string;
  variant: Props["variant"];
  /** Board-level utility actions (icon buttons) on the title row (#338). */
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="operate-board min-w-0">
      <span aria-hidden className="sign-keyline" />
      <div className={cx("relative flex min-w-0 flex-col gap-4", variant === "page" ? "p-5 sm:p-6" : "p-4")}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="operate-board-title">{title}</h2>
          {actions}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Mention detail body shared by the full page and the slide-out — UX §3.4, FR-154..158. */
export function MentionDetail({ mentionId, variant, reviewContext }: Props) {
  const { project } = useCurrentProject();
  const { role, settings } = useRole();
  const pid = project?.id;
  const tz = project?.timezone ?? env.NEXT_PUBLIC_DEFAULT_TIMEZONE;
  const q = useMentionDetail(pid, mentionId);
  const reanalyze = useReanalyze(pid, mentionId);
  const createOverride = useCreateOverride(pid, mentionId);
  const revokeOverride = useRevokeOverride(pid, mentionId);
  const mayOverride = canOverride(role);
  // FR-155 / FR-156, BR-033: banner "Thử lại" and toolbar "Phân tích lại" share one rule; server enforces.
  const mayReanalyze = canReanalyze(role, settings);
  // Override dialog lives here so both the toolbar and per-field "Sửa" can open it (#338).
  const [overrideField, setOverrideField] = useState<OverrideField | null>(null);

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
            canRetry={mayReanalyze}
            onRetry={() => reanalyze.mutate()}
            isRetrying={reanalyze.isPending}
          />
          {reviewContext ? null : <ReviewNote mentionId={m.id} review={m.review} />}
          <OperationsToolbar
            mention={m}
            canReanalyze={mayReanalyze}
            onReanalyze={() => reanalyze.mutate()}
            isReanalyzing={reanalyze.isPending}
            canOverride={mayOverride}
            onOpenOverride={() => setOverrideField(defaultOverrideField(m))}
          />
          <OverrideDialog
            mention={m}
            isOpen={overrideField !== null}
            initialField={overrideField ?? "sentiment"}
            onClose={() => setOverrideField(null)}
            isPending={createOverride.isPending}
            followUp={reviewContext?.onOverrideSaved ? { label: "Đánh dấu đã xem lại sau khi lưu" } : undefined}
            onSubmit={(body, { followUp }) =>
              void createOverride.mutateAsync(body).then(
                () => {
                  setOverrideField(null);
                  reviewContext?.onOverrideSaved?.(followUp);
                },
                () => undefined,
              )
            }
          />
          <div className={cx("grid gap-6", variant === "page" && "lg:grid-cols-2")}>
            <DetailBoard title="Bài gốc" variant={variant} actions={<OriginalActions mention={m} />}>
              <OriginalPanel mention={m} tz={tz} />
            </DetailBoard>
            <DetailBoard title="Phân tích" variant={variant}>
              <AnalysisTabs
                mention={m}
                tz={tz}
                canOverride={mayOverride}
                onEditField={mayOverride ? setOverrideField : undefined}
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
