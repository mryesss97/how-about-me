"use client";

import Link from "next/link";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { useRole } from "@/features/auth/use-role";
import { EmptyState, QueryState, SkeletonBlock } from "@/features/shared/query-state";
import { ApiError } from "@/lib/api/client";
import { env } from "@/lib/env";
import { cx } from "@/utils/cx";
import { AnalysisTabs } from "./analysis-tabs";
import { canReanalyze, useMentionDetail, useReanalyze } from "./api";
import { OperationsToolbar } from "./operations-toolbar";
import { OriginalPanel } from "./original-panel";
import { StatusBanner } from "./status-banner";

type Props = { mentionId: string; variant: "page" | "slideout" };

/** Mention detail body shared by the full page and the slide-out — UX §3.4, FR-154..158. */
export function MentionDetail({ mentionId, variant }: Props) {
  const { project } = useCurrentProject();
  const { role, settings } = useRole();
  const pid = project?.id;
  const tz = project?.timezone ?? env.NEXT_PUBLIC_DEFAULT_TIMEZONE;
  const q = useMentionDetail(pid, mentionId);
  const reanalyze = useReanalyze(pid, mentionId);

  if (q.error instanceof ApiError && q.error.code === "NOT_FOUND")
    return (
      <EmptyState
        title="Mention not found"
        description="It may belong to another project or no longer exist."
        action={
          <Link href="/mentions" className="text-sm font-semibold text-brand-secondary">
            Back to Mentions
          </Link>
        }
      />
    );

  const err = q.error
    ? q.error instanceof ApiError
      ? { code: q.error.code, message: q.error.message, requestId: q.error.requestId }
      : { message: "Unexpected response from the server." }
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
          />
          <div className={cx("grid gap-6", variant === "page" && "lg:grid-cols-2")}>
            <OriginalPanel mention={m} tz={tz} />
            <section aria-label="Analysis">
              <AnalysisTabs mention={m} tz={tz} />
            </section>
          </div>
        </div>
      ) : null}
    </QueryState>
  );
}
