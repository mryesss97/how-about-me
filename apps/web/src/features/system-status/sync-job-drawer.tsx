"use client";

import { AlertCircle, RefreshCcw01 } from "@untitledui/icons";
import type { QueryType, SyncJobDetail } from "@how-about-me/contracts";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { notifyError } from "@/lib/toast";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Button } from "@/components/base/buttons/button";
import { PlaqueButton } from "@/features/shared/plaque-button";
import { ErrorState, SkeletonBlock } from "@/features/shared/query-state";
import { toQueryStateError } from "@/lib/semantics/api-errors";
import { syncErrorLabel } from "@/lib/semantics/sync-errors";
import { DASH, formatCount } from "@/lib/format/number";
import { mentionsHref, mentionsWindowHref } from "@/lib/links/mentions";
import { queryTypeLabelVi, searchModeLabelVi, searchTypeLabelVi } from "@/lib/semantics/labels";
import { formatDateTime } from "@/lib/time/format";
import { retryErrorMessage, useQueryNames, useRetrySyncJob, useSyncJob } from "./api";
import { jobStatusLabel, jobTriggerLabel, truncateMiddle } from "./format";
import { StatusPlate } from "./status-plate";

type Props = { pid: string; jobId: string; tz: string; isAdmin: boolean; onClose: () => void };

/** Sync job detail drawer (FR-081, TC-SYS-013) with admin retry for failed jobs (FR-175, TC-SYS-011). */
export function SyncJobDrawer({ pid, jobId, tz, isAdmin, onClose }: Props) {
  const [open, setOpen] = useState(true);
  const job = useSyncJob(pid, jobId);
  const retry = useRetrySyncJob(pid);
  const names = useQueryNames(pid);
  const queryId = job.data?.queryId ?? null;
  const close = () => {
    setOpen(false);
    onClose();
  };

  // Retry only for `failed` (UX §3.6); the button is UX only — the server answers 403 for non-admins (FR-015).
  const retryButton =
    isAdmin && job.data?.status === "failed" ? (
      <PlaqueButton
        iconLeading={RefreshCcw01}
        isLoading={retry.isPending}
        isDisabled={retry.isPending}
        onClick={() =>
          retry.mutate(jobId, {
            onSuccess: () => {
              toast.success("Đã xếp lịch thử lại");
              close();
            },
            onError: (e) => notifyError(retryErrorMessage(e)),
          })
        }
      >
        Thử lại
      </PlaqueButton>
    ) : null;

  return (
    <SlideoutMenu
      isOpen={open}
      onOpenChange={(o) => !o && close()}
      isDismissable
      className="z-50 md:*:max-w-xl"
      dialogClassName="gap-4"
    >
      <SlideoutMenu.Header onClose={close}>
        <div className="flex items-center gap-3 pr-8">
          {/* #343 ops-4: condensed caps title like the other operate drawers. */}
          <h2 className="operate-board-title pr-8 text-[var(--ink)]">Lượt đồng bộ</h2>
          {retryButton ? <div className="ml-auto">{retryButton}</div> : null}
        </div>
        {job.data ? <QueryLine queryId={queryId} names={names} /> : null}
      </SlideoutMenu.Header>
      <SlideoutMenu.Content role="region" aria-label="Chi tiết lượt đồng bộ" className="pb-6">
        {job.isLoading ? (
          <SkeletonBlock lines={8} />
        ) : job.data ? (
          <JobDetail job={job.data} tz={tz} />
        ) : (
          <ErrorState error={toQueryStateError(job.error) ?? {}} onRetry={() => void job.refetch()} />
        )}
      </SlideoutMenu.Content>
      {job.data && queryId ? (
        // Close the loop back to the query and its mentions (#340 flows-6, #343 ops-4: plaque actions).
        <SlideoutMenu.Footer className="flex flex-wrap gap-3">
          <PlaqueButton
            fullWidthOnMobile
            href={
              job.data.windowSince && job.data.windowUntil
                ? mentionsWindowHref(queryId, job.data.windowSince, job.data.windowUntil)
                : mentionsHref(queryId, "30d")
            }
          >
            Xem bài nhắc
          </PlaqueButton>
          <PlaqueButton fullWidthOnMobile href={queryHref(queryId, isAdmin, names)}>
            Xem truy vấn
          </PlaqueButton>
        </SlideoutMenu.Footer>
      ) : null}
    </SlideoutMenu>
  );
}

type QueryName = { id: string; name: string; type: QueryType; deletedAt: string | null };

/**
 * #343: admins open the query's edit drawer; a deleted query goes to the deleted list; others get the list
 * (the edit drawer is admin-only, so `?edit=` would be a dead link for them).
 */
function queryHref(queryId: string, isAdmin: boolean, names: QueryName[]): string {
  if (names.find((n) => n.id === queryId)?.deletedAt) return "/listening-queries?deleted=1";
  return isAdmin ? `/listening-queries?edit=${queryId}` : "/listening-queries";
}

/** Query name under the title (names come from the first 200 queries, incl. deleted), type on a second line. */
function QueryLine({ queryId, names }: { queryId: string | null; names: QueryName[] }) {
  if (!queryId) return <p className="text-sm text-tertiary">Không gắn truy vấn</p>;
  const found = names.find((n) => n.id === queryId);
  return (
    <div data-testid="job-query">
      <p className="text-md font-semibold text-primary">{found ? found.name : `Truy vấn ${queryId.slice(0, 8)}`}</p>
      {found ? (
        <p className="text-sm text-tertiary">
          {queryTypeLabelVi[found.type]}
          {found.deletedAt ? " · Đã xoá" : ""}
        </p>
      ) : null}
    </div>
  );
}

const dt = (iso: string | null, tz: string) => (iso ? formatDateTime(iso, tz) : DASH);

function JobDetail({ job, tz }: { job: SyncJobDetail; tz: string }) {
  return (
    <div className="flex flex-col gap-5">
      <StatusPlate {...jobStatusLabel[job.status]} className="self-start" />
      <Section title="Thời gian">
        <Row label="Cửa sổ từ" value={dt(job.windowSince, tz)} />
        <Row label="Cửa sổ đến" value={dt(job.windowUntil, tz)} />
        <Row label="Bắt đầu" value={dt(job.startedAt, tz)} />
        <Row label="Kết thúc" value={dt(job.completedAt, tz)} />
      </Section>
      <Section title="Cấu hình">
        <Row label="Kích hoạt" value={jobTriggerLabel[job.trigger]} />
        {/* #344: same words as the backfill dialog and the audit log; raw RECENT/TAG never shown. */}
        <Row label="Thứ tự lấy" value={searchTypeLabelVi[job.searchType]} />
        <Row label="Loại" value={searchModeLabelVi[job.searchMode]} />
      </Section>
      <Section title="Số liệu">
        <Row label="Trang" value={formatCount(job.pagesFetched)} />
        <Row label="Đã lấy" value={formatCount(job.recordsFetched)} />
        <Row label="Mới" value={formatCount(job.recordsInserted)} />
        <Row label="Cập nhật" value={formatCount(job.recordsUpdated)} />
        <Row label="Trùng" value={formatCount(job.recordsDuplicated)} />
        <Row label="Không hợp lệ" value={formatCount(job.recordsInvalid)} />
        <Row label="Bị loại" value={formatCount(job.recordsExcluded)} />
        <Row label="Yêu cầu tới Threads" value={formatCount(job.providerRequests)} />
        <Row label="Lần bị giới hạn tần suất" value={formatCount(job.rateLimitEvents)} />
      </Section>
      {job.providerUsage ? (
        <Section title="Hạn mức Threads">
          <Row
            label="Còn lại"
            value={job.providerUsage.remaining == null ? DASH : formatCount(job.providerUsage.remaining)}
          />
          <Row label="Đặt lại lúc" value={dt(job.providerUsage.resetAt, tz)} />
        </Section>
      ) : null}
      {job.error ? (
        <Section title="Lỗi">
          {/* #392: Vietnamese label first (same as the jobs table); icon + text so colour never stands alone (BR-017). */}
          <p className="flex items-start gap-2 text-sm font-medium text-error-primary" data-testid="job-error-label">
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {syncErrorLabel(job.error.code, job.error.message)}
          </p>
          <p className="text-xs text-tertiary">Chi tiết kỹ thuật</p>
          <p className="font-mono text-xs text-tertiary">{job.error.code}</p>
          <p className="text-xs break-words text-tertiary">{job.error.message}</p>
        </Section>
      ) : null}
      {job.lastCursor ? (
        <Section title="Vị trí trang cuối (kỹ thuật)">
          <div className="flex items-center gap-2">
            <code className="font-mono text-xs text-secondary">{truncateMiddle(job.lastCursor)}</code>
            <Button
              size="sm"
              color="link-gray"
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(job.lastCursor ?? "")
                  .then(() => toast.success("Đã sao chép vị trí trang"))
                  .catch(() => notifyError("Không sao chép được"))
              }
            >
              Sao chép
            </Button>
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      <dl className="flex flex-col gap-1.5">{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <dt className="text-tertiary">{label}</dt>
      <dd className="text-right text-primary">{value}</dd>
    </div>
  );
}
