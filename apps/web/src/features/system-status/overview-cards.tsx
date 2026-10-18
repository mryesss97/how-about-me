"use client";

import type { SystemStatusResponse } from "@how-about-me/contracts";
import Link from "next/link";
import type { ReactNode } from "react";
import { DASH, formatCount, formatRate } from "@/lib/format/number";
import { formatDateTime } from "@/lib/time/format";
import { analysisStatusLabel, collectorStatusLabel, formatLag, integrationStatusLabel } from "./format";
import { StatusPlate } from "./status-plate";

type Props = { data: SystemStatusResponse; tz: string; isAdmin: boolean };

const dt = (iso: string | null, tz: string) => (iso ? formatDateTime(iso, tz) : DASH);
/** Same style as the mention detail cost (`$0,0012`): vi-VN digits after a leading `$`. */
const usd = {
  format: (v: number) => `$${v.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
};

/** Overview tab cards (UX §3.6, FR-170, TC-SYS-001). "Scopes" is not in the contract, so it is not shown. */
export function OverviewCards({ data, tz, isAdmin }: Props) {
  const { threads, collector, analysis, database } = data;
  const t = integrationStatusLabel[threads.status];
  const c = collectorStatusLabel[collector.status];
  const a = analysisStatusLabel[analysis.status];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Board
        title="Kết nối Threads"
        plate={<StatusPlate {...t} />}
        action={
          isAdmin ? (
            <Link href="/settings/integrations" className="text-sm font-semibold text-brand-secondary hover:underline">
              Quản lý
            </Link>
          ) : null
        }
      >
        <Row label="Tài khoản" value={threads.accountIdentifier ?? DASH} />
        <Row label="Token hết hạn" value={dt(threads.tokenExpiresAt, tz)} />
        <Row label="Lần thành công cuối" value={dt(threads.lastSuccessAt, tz)} />
        {threads.lastError ? (
          <Row
            label="Lỗi cuối"
            value={`${threads.lastError.code}: ${threads.lastError.message} (${dt(threads.lastError.at, tz)})`}
          />
        ) : null}
      </Board>

      <Board title="Bộ thu thập" plate={<StatusPlate {...c} />}>
        <Kpi label="Lỗi 24 giờ" value={formatCount(collector.failedJobs24h)} />
        <Row label="Truy vấn hoạt động" value={formatCount(collector.activeQueries)} />
        <Row label="Đồng bộ toàn cục cuối" value={dt(collector.lastGlobalSyncAt, tz)} />
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

      <Board title="Bộ phân tích" plate={<StatusPlate {...a} />}>
        <Kpi label="Đang chờ phân tích" value={formatCount(analysis.pending)} />
        <Row label="Đang xử lý" value={formatCount(analysis.processing)} />
        <Row label="Hoàn tất 24 giờ" value={formatCount(analysis.completed24h)} />
        <Row label="Lỗi 24 giờ" value={formatCount(analysis.failed24h)} />
        <Row label="Độ trễ phân tích" value={formatLag(analysis.analysisLagSeconds)} />
        <Row
          label="Phiên bản"
          value={
            [
              analysis.versions.classifierModel,
              analysis.versions.promptVersion && `prompt ${analysis.versions.promptVersion}`,
              analysis.versions.taxonomyVersion && `taxonomy ${analysis.versions.taxonomyVersion}`,
            ]
              .filter(Boolean)
              .join(" · ") || DASH
          }
        />
        <Row
          label="Token 24 giờ (vào / ra)"
          value={`${formatCount(analysis.tokens24h.input)} / ${formatCount(analysis.tokens24h.output)}`}
        />
        <Row label="Chi phí ước tính 24 giờ" value={usd.format(analysis.estimatedCost24hUsd)} />
      </Board>

      <Board title="Cơ sở dữ liệu">
        <Kpi label="Bài nhắc ~" value={formatCount(database.approxPosts)} />
        <Row label="Kết quả phân tích ~" value={formatCount(database.approxAnalyses)} />
        <Row label="Migration cuối" value={database.lastMigration ?? DASH} />
      </Board>
    </div>
  );
}

function Board({
  title,
  plate,
  action,
  children,
}: {
  title: string;
  plate?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="operate-board min-w-0">
      <span aria-hidden className="sign-keyline" />
      <div className="relative flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="operate-board-title">{title}</h2>
          {plate}
          {action ? <div className="ml-auto">{action}</div> : null}
        </div>
        <dl className="flex flex-col gap-2">{children}</dl>
      </div>
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-semibold text-tertiary">{label}</dt>
      <dd className="kpi-figure">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <dt className="text-tertiary">{label}</dt>
      <dd className="text-right break-words text-primary">{value}</dd>
    </div>
  );
}
