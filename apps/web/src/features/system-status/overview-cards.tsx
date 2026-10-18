"use client";

import type { SystemStatusResponse } from "@how-about-me/contracts";
import Link from "next/link";
import { DASH, formatCount, formatRate } from "@/lib/format/number";
import { formatDateTime } from "@/lib/time/format";
import {
  analysisStatusLabel,
  buildSummary,
  collectorStatusLabel,
  failedJobsHref,
  formatLag,
  formatVersions,
  threadsPlate,
  tokenDaysLeft,
  TOKEN_WARN_DAYS,
} from "./format";
import { Board, Kpi, Row } from "./overview-board";
import { OverviewSummary } from "./overview-summary";
import { StatusPlate } from "./status-plate";

/** `queriesWithError`: counted in the browser from listening-queries (#342); null = not loaded → row hidden. */
type Props = { data: SystemStatusResponse; tz: string; isAdmin: boolean; queriesWithError?: number | null };

const dt = (iso: string | null, tz: string) => (iso ? formatDateTime(iso, tz) : DASH);
/** Same style as the mention detail cost (`$0,0012`): vi-VN digits after a leading `$`. */
const usd = {
  format: (v: number) => `$${v.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
};
const PLAQUE = "plaque-button inline-flex items-center whitespace-nowrap px-3 py-1 text-sm max-md:min-h-11";

/** Overview tab cards (UX §3.6, FR-170, TC-SYS-001). "Scopes" is not in the contract, so it is not shown. */
export function OverviewCards({ data, tz, isAdmin, queriesWithError = null }: Props) {
  const { threads, collector, analysis, database } = data;
  // Server clock (payload time), not the browser's: stable across polls and in tests.
  const nowMs = Date.parse(data.generatedAt);
  const t = threadsPlate(threads, nowMs);
  const c = collectorStatusLabel[collector.status];
  const a = analysisStatusLabel[analysis.status];
  const days = threads.status === "connected" ? tokenDaysLeft(threads.tokenExpiresAt, nowMs) : null;
  const tokenSoon = days != null && days <= TOKEN_WARN_DAYS;
  const tokenTrouble = tokenSoon || threads.status === "expired" || threads.status === "error";
  const jobsHref = failedJobsHref(collector.failedJobs24h, collector.partialJobs24h);
  // A Threads error older than the last success is history: shown grey, not red (flows-5).
  const staleThreadsError =
    !!threads.lastError &&
    !!threads.lastSuccessAt &&
    Date.parse(threads.lastSuccessAt) > Date.parse(threads.lastError.at);
  return (
    <div className="flex flex-col gap-4">
      <OverviewSummary summary={buildSummary({ data, nowMs, queriesWithError, isAdmin })} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Board
          title="Kết nối Threads"
          plate={<StatusPlate {...t} />}
          action={
            isAdmin ? (
              <Link href="/settings/integrations" className={PLAQUE}>
                {tokenTrouble ? "Cập nhật token" : "Quản lý"}
              </Link>
            ) : null
          }
        >
          <Row label="Tài khoản" value={threads.accountIdentifier ?? DASH} />
          <Row
            label="Token hết hạn"
            value={`${dt(threads.tokenExpiresAt, tz)}${tokenSoon && days > 0 ? ` (còn ${formatCount(days)} ngày)` : ""}`}
          />
          <Row label="Lần thành công cuối" value={dt(threads.lastSuccessAt, tz)} />
          {threads.lastError ? (
            <Row
              label="Lỗi cuối"
              value={
                <span className={staleThreadsError ? "text-tertiary" : undefined}>
                  {`${threads.lastError.code}: ${threads.lastError.message} (${dt(threads.lastError.at, tz)})`}
                  {staleThreadsError ? ", đã kết nối lại" : ""}
                </span>
              }
            />
          ) : null}
        </Board>

        <Board
          title="Bộ thu thập"
          plate={<StatusPlate {...c} />}
          action={
            jobsHref ? (
              <Link href={jobsHref} className={PLAQUE}>
                Xem lượt lỗi
              </Link>
            ) : null
          }
        >
          <Kpi label="Lỗi 24 giờ" value={formatCount(collector.failedJobs24h)} />
          <Row label="Truy vấn hoạt động" value={formatCount(collector.activeQueries)} />
          {queriesWithError != null ? (
            <Row
              label="Truy vấn đang lỗi"
              value={
                queriesWithError > 0 ? (
                  <Link href="/listening-queries" className="font-semibold underline underline-offset-2">
                    {formatCount(queriesWithError)}
                  </Link>
                ) : (
                  formatCount(0)
                )
              }
            />
          ) : null}
          <Row label="Đồng bộ thành công gần nhất" value={dt(collector.lastGlobalSyncAt, tz)} />
          <Row label="Đang chạy" value={formatCount(collector.jobsInProgress)} />
          <Row label="Một phần 24 giờ" value={formatCount(collector.partialJobs24h)} />
          <Row label="Tỉ lệ thành công 24 giờ" value={formatRate(collector.successRate24h)} />
          <Row label="Độ trễ thu thập" value={formatLag(collector.collectionLagSeconds)} />
          {collector.circuit.open ? (
            <p role="note" className="text-sm font-semibold text-error-primary">
              Tạm ngắt tới {dt(collector.circuit.until, tz)}
              {collector.circuit.reason ? ` (${collector.circuit.reason})` : ""}
            </p>
          ) : null}
        </Board>

        <Board
          title="Bộ phân tích"
          plate={<StatusPlate {...a} />}
          action={
            analysis.failed24h > 0 ? (
              <Link href="/system-status?tab=analysis-failures" className={PLAQUE}>
                Xem lỗi
              </Link>
            ) : null
          }
        >
          <Kpi label="Đang chờ phân tích" value={formatCount(analysis.pending)} />
          <Row label="Đang xử lý" value={formatCount(analysis.processing)} />
          <Row label="Hoàn tất 24 giờ" value={formatCount(analysis.completed24h)} />
          <Row label="Lỗi 24 giờ" value={formatCount(analysis.failed24h)} />
          <Row label="Độ trễ phân tích" value={formatLag(analysis.analysisLagSeconds)} />
          <Row label="Phiên bản" value={formatVersions(analysis.versions)} />
          <Row
            label="Token 24 giờ (vào / ra)"
            value={`${formatCount(analysis.tokens24h.input)} / ${formatCount(analysis.tokens24h.output)}`}
          />
          <Row label="Chi phí ước tính 24 giờ" value={usd.format(analysis.estimatedCost24hUsd)} />
        </Board>

        <Board title="Cơ sở dữ liệu">
          <Kpi label="Bài nhắc (ước tính)" value={formatCount(database.approxPosts)} />
          <Row label="Kết quả phân tích (ước tính)" value={formatCount(database.approxAnalyses)} />
          {isAdmin ? (
            <div className="flex justify-between gap-3 text-xs text-tertiary" title="Tên migration Prisma gần nhất">
              <dt>Cập nhật CSDL cuối (kỹ thuật)</dt>
              <dd className="text-right break-words">{database.lastMigration ?? DASH}</dd>
            </div>
          ) : null}
        </Board>
      </div>
    </div>
  );
}
