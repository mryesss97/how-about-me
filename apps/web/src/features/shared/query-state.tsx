"use client";

import type { ReactNode } from "react";
import { AlertCircle, Inbox01, Lock01, RefreshCcw01 } from "@untitledui/icons";
import { PlaqueButton } from "./plaque-button";
import { apiErrorMessageVi } from "@/lib/semantics/api-errors";
import { cx } from "@/utils/cx";
import { StateIllustration, type StateIllustrationName } from "./state-illustration";

/**
 * The four non-happy states every data widget must be able to show —
 * docs/01-product/09-ux-specification.md §2.3.
 *
 * BR-032 is the reason this is one component: "0 mentions", "sync failed" and "analysis pending" are
 * *different* states and must never collapse into the same empty box. `QueryState` keeps them apart and
 * makes the error case carry its `requestId`, which is what support asks for first.
 */

export type QueryStateError = { code?: string; message?: string; requestId?: string };

export type QueryStateProps = {
  isLoading?: boolean;
  error?: QueryStateError | null;
  /** The request succeeded and returned nothing — never inferred from an error. */
  isEmpty?: boolean;
  /** Forced forbidden state; otherwise derived from a `FORBIDDEN_*` error code. */
  isForbidden?: boolean;
  onRetry?: () => void;
  /** Skeleton matching the final layout — a spinner is the fallback, not the default (UX §2.3). */
  skeleton?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Opt-in brand illustration for page-level empty states only; cards/widgets keep the flat icon. */
  emptyIllustration?: StateIllustrationName;
  /** #348: `inline` when the state renders inside a board (chart card, settings board) so boards never nest. */
  errorVariant?: "board" | "inline";
  className?: string;
  children: ReactNode;
};

export function QueryState({
  isLoading,
  error,
  isEmpty,
  isForbidden,
  onRetry,
  skeleton,
  emptyTitle = "Không có lượt nhắc liên quan trong khoảng thời gian này.",
  emptyDescription = "Hãy mở rộng khoảng thời gian hoặc bỏ bớt bộ lọc.",
  emptyAction,
  emptyIllustration,
  errorVariant,
  className,
  children,
}: QueryStateProps) {
  const forbidden = isForbidden || (error?.code?.startsWith("FORBIDDEN") ?? false);

  if (forbidden) return <ForbiddenState className={className} />;
  if (isLoading) return <div className={className}>{skeleton ?? <SkeletonBlock />}</div>;
  if (error) return <ErrorState error={error} onRetry={onRetry} className={className} variant={errorVariant} />;
  if (isEmpty)
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        illustration={emptyIllustration}
        className={className}
      />
    );
  return <>{children}</>;
}

/**
 * Full-page state; the backend already denied the request — the UI only mirrors it (BR-033).
 * #348: an enamel board with a navy keyline (DESIGN.md "Toasts & states"), no featured-icon halo.
 */
export function ForbiddenState({ className, backHref = "/overview" }: { className?: string; backHref?: string }) {
  return (
    <div role="status" className={cx("operate-board", className)}>
      <span aria-hidden className="sign-keyline" />
      <div className="relative flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <Lock01 aria-hidden className="size-6 text-[var(--ink)]" />
        <h2 className="operate-board-title">Bạn không có quyền xem trang này.</h2>
        <p className="max-w-md text-sm text-tertiary">
          Hãy hỏi quản trị viên dự án nếu bạn cần quyền truy cập. Vai trò của bạn quyết định những màn hình bạn xem
          được.
        </p>
        <PlaqueButton href={backHref}>Về Tổng quan</PlaqueButton>
      </div>
    </div>
  );
}

/**
 * Body text is a Vietnamese sentence from `apiErrorMessageVi` (#392) — never the API's English `message`.
 * Code and `requestId` go in the small mono line: the requestId is the one thing that lets an engineer find the matching log line.
 * #348: `board` = enamel board with a red keyline; `inline` = red left rule only, for use inside a board
 * (chart card, settings board) so boards never nest. The heading text carries the meaning (BR-017).
 */
export function ErrorState({
  error,
  onRetry,
  className,
  variant = "board",
}: {
  error: QueryStateError;
  onRetry?: () => void;
  className?: string;
  variant?: "board" | "inline";
}) {
  const showRaw = process.env.NODE_ENV !== "production";
  const body = (
    <div className="relative flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-[var(--red-enamel)]" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm font-semibold text-primary">Đã xảy ra lỗi khi tải dữ liệu.</p>
          {/* #392: Vietnamese copy only; the raw (English) message is a dev-only tooltip. */}
          <p className="text-sm text-tertiary" title={showRaw ? error.message : undefined}>
            {apiErrorMessageVi(error)}
          </p>
          {error.requestId ? (
            <p className="font-mono text-xs text-quaternary">
              Mã yêu cầu: <span data-testid="request-id">{error.requestId}</span>
              {error.code ? ` · ${error.code}` : null}
            </p>
          ) : error.code ? (
            <p className="font-mono text-xs text-quaternary">{error.code}</p>
          ) : null}
        </div>
      </div>
      {onRetry ? (
        <div>
          <PlaqueButton iconLeading={RefreshCcw01} onClick={onRetry}>
            Thử lại
          </PlaqueButton>
        </div>
      ) : null}
    </div>
  );
  if (variant === "inline")
    return (
      <div role="alert" data-variant="inline" className={cx("state-inline-error py-2 pl-4", className)}>
        {body}
      </div>
    );
  return (
    <div role="alert" data-variant="board" className={cx("operate-board p-5", className)}>
      <span aria-hidden className="sign-keyline sign-keyline--error" />
      {body}
    </div>
  );
}

/**
 * `illustration` is opt-in for states that fill the page / main content area (Mentions list, Reviews queue,
 * no project). Without it a flat Untitled icon is shown (#348: no featured-icon halo); the state is not wrapped in a
 * board because it usually sits inside one.
 */
export function EmptyState({
  title,
  description,
  action,
  illustration,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  illustration?: StateIllustrationName;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cx("flex flex-col items-center justify-center gap-3 px-4 py-12 text-center", className)}
    >
      {illustration ? (
        <StateIllustration name={illustration} />
      ) : (
        <Inbox01 aria-hidden className="size-6 text-[var(--ink)]" />
      )}
      <h3 className="text-md font-semibold text-primary">{title}</h3>
      {description ? <p className="max-w-md text-sm text-tertiary">{description}</p> : null}
      {action}
    </div>
  );
}

/** Generic skeleton; widgets pass their own shape so the layout does not jump when data arrives. */
export function SkeletonBlock({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className={cx("flex flex-col gap-3", className)}>
      <span className="sr-only">Đang tải…</span>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 w-full animate-pulse rounded-md bg-secondary" style={{ opacity: 1 - i * 0.2 }} />
      ))}
    </div>
  );
}
