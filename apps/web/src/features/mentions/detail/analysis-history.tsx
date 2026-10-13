import type { MentionDetail } from "@how-about-me/contracts";
import { AnalysisStatusBadge } from "@/features/shared/semantic-badge";
import { formatDateTime } from "@/lib/time/format";
import { humanize, usd } from "./format";

/** Analysis runs, newest first as returned by the API (TC-MEN-012). Runs carry no tokens — cost only. */
export function AnalysisHistory({ runs, tz }: { runs: MentionDetail["runs"]; tz: string }) {
  if (runs.length === 0) return <p className="text-sm text-tertiary">No analysis runs yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label="Analysis runs">
        <thead>
          <tr className="text-left text-xs text-tertiary">
            <th className="py-1 pr-3 font-medium">Status</th>
            <th className="py-1 pr-3 font-medium">Trigger</th>
            <th className="py-1 pr-3 font-medium">Version</th>
            <th className="py-1 pr-3 font-medium">Created</th>
            <th className="py-1 pr-3 font-medium">Completed</th>
            <th className="py-1 pr-3 font-medium">Cost</th>
            <th className="py-1 font-medium">Error</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-t border-secondary">
              <td className="py-1.5 pr-3">
                <AnalysisStatusBadge value={r.status} />
              </td>
              <td className="py-1.5 pr-3">{humanize(r.trigger)}</td>
              <td className="py-1.5 pr-3 font-mono text-xs">{r.effectiveVersion}</td>
              <td className="py-1.5 pr-3">{formatDateTime(r.createdAt, tz)}</td>
              <td className="py-1.5 pr-3">{r.completedAt ? formatDateTime(r.completedAt, tz) : "—"}</td>
              <td className="py-1.5 pr-3">{usd(r.estimatedCostUsd)}</td>
              <td className="py-1.5 font-mono text-xs text-error-primary">{r.errorCode ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
