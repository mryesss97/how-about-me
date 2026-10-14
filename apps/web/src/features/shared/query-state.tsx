"use client";

import type { ReactNode } from "react";
import { AlertCircle, Inbox01, Lock01, RefreshCcw01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
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
  /** Opt-in brand illustration for page-level empty states only; cards/widgets keep the FeaturedIcon. */
  emptyIllustration?: StateIllustrationName;
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
  emptyTitle = "No relevant mentions found in this period.",
  emptyDescription = "Try widening the time range or clearing some filters.",
  emptyAction,
  emptyIllustration,
  className,
  children,
}: QueryStateProps) {
  const forbidden = isForbidden || (error?.code?.startsWith("FORBIDDEN") ?? false);

  if (forbidden) return <ForbiddenState className={className} />;
  if (isLoading) return <div className={className}>{skeleton ?? <SkeletonBlock />}</div>;
  if (error) return <ErrorState error={error} onRetry={onRetry} className={className} />;
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

/** Full-page state; the backend already denied the request — the UI only mirrors it (BR-033). */
export function ForbiddenState({ className, backHref = "/overview" }: { className?: string; backHref?: string }) {
  return (
    <div
      role="status"
      className={cx("flex flex-col items-center justify-center gap-3 px-4 py-16 text-center", className)}
    >
      <FeaturedIcon color="gray" theme="modern" icon={Lock01} size="lg" />
      <h2 className="text-lg font-semibold text-primary">You don&apos;t have permission to view this page.</h2>
      <p className="max-w-md text-sm text-tertiary">
        Ask a project admin if you need access. Your role decides which screens are available.
      </p>
      <Button href={backHref} color="secondary" size="sm">
        Back to Overview
      </Button>
    </div>
  );
}

/** `requestId` is shown verbatim: it is the one thing that lets an engineer find the matching log line. */
export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: QueryStateError;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cx("flex flex-col gap-3 rounded-xl border border-error bg-primary p-5", className)}>
      <div className="flex items-start gap-3">
        <FeaturedIcon color="error" theme="modern" icon={AlertCircle} size="md" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm font-semibold text-primary">Something went wrong loading this data.</p>
          <p className="text-sm text-tertiary">{error.message ?? "Please try again in a moment."}</p>
          {error.requestId ? (
            <p className="font-mono text-xs text-quaternary">
              Request ID: <span data-testid="request-id">{error.requestId}</span>
            </p>
          ) : null}
        </div>
      </div>
      {onRetry ? (
        <div>
          <Button color="secondary" size="sm" iconLeading={RefreshCcw01} onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * `illustration` is opt-in for states that fill the page / main content area (Mentions list, Reviews queue,
 * no project). Without it the compact FeaturedIcon is kept — chart cards and widgets rely on that default.
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
        <FeaturedIcon color="gray" theme="modern" icon={Inbox01} size="lg" />
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
      <span className="sr-only">Loading…</span>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 w-full animate-pulse rounded-md bg-secondary" style={{ opacity: 1 - i * 0.2 }} />
      ))}
    </div>
  );
}
