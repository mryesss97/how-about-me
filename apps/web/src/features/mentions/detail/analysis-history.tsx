import type { MentionDetail } from "@how-about-me/contracts";
import { AnalysisStatusBadge } from "@/features/shared/semantic-badge";
import { formatDateTime, formatShortDateTime } from "@/lib/time/format";
import { analysisErrorLabel } from "@/lib/semantics/analysis-errors";
import { displayLabel } from "@/lib/semantics/labels";
import { runModel, usd } from "./format";

const TH = "py-1 pr-3 font-medium whitespace-nowrap";
const TD = "py-1.5 pr-3 whitespace-nowrap";

/**
 * Analysis runs, newest first as returned by the API (TC-MEN-012). Runs carry no tokens — cost only.
 * #344: one line per row — model only (full effective version in `title`), short dates (full in `title`),
 * Vietnamese error label (raw code in `title`; text, not colour alone — BR-017). Scrolls inside the board when narrow.
 */
export function AnalysisHistory({ runs, tz }: { runs: MentionDetail["runs"]; tz: string }) {
  if (runs.length === 0) return <p className="text-sm text-tertiary">Chưa có lượt phân tích nào.</p>;
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-max text-sm" aria-label="Các lượt phân tích">
        <thead>
          <tr className="text-left text-xs text-tertiary">
            <th className={TH}>Trạng thái</th>
            <th className={TH}>Kích hoạt</th>
            <th className={TH}>Mô hình</th>
            <th className={TH}>Tạo lúc</th>
            <th className={TH}>Hoàn tất</th>
            <th className={TH}>Chi phí</th>
            <th className="py-1 font-medium whitespace-nowrap">Lỗi</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-t border-secondary">
              <td className={TD}>
                <AnalysisStatusBadge value={r.status} />
              </td>
              <td className={TD}>{displayLabel("analysisTrigger", r.trigger)}</td>
              <td className={TD} title={r.effectiveVersion}>
                {runModel(r.effectiveVersion)}
              </td>
              <td className={TD} title={formatDateTime(r.createdAt, tz)}>
                {formatShortDateTime(r.createdAt, tz)}
              </td>
              <td className={TD} title={r.completedAt ? formatDateTime(r.completedAt, tz) : undefined}>
                {r.completedAt ? formatShortDateTime(r.completedAt, tz) : "—"}
              </td>
              <td className={TD}>{usd(r.estimatedCostUsd)}</td>
              <td className="py-1.5 whitespace-nowrap text-error-primary" title={r.errorCode ?? undefined}>
                {r.errorCode ? analysisErrorLabel(r.errorCode) : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
