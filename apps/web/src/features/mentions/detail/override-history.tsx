import type { Override } from "@how-about-me/contracts";
import { formatDateTime } from "@/lib/time/format";
import { FIELD_LABELS, formatValue, userName } from "./overrides";

/** Every analyst override, active and revoked (FR-193: revoking keeps history). Newest first as returned. */
export function OverrideHistory({ overrides, tz }: { overrides: readonly Override[]; tz: string }) {
  if (overrides.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label="Analyst overrides">
        <caption className="pb-2 text-left text-sm font-semibold text-primary">Analyst overrides</caption>
        <thead>
          <tr className="text-left text-xs text-tertiary">
            <th className="py-1 pr-3 font-medium">Field</th>
            <th className="py-1 pr-3 font-medium">AI → Analyst</th>
            <th className="py-1 pr-3 font-medium">Reason</th>
            <th className="py-1 pr-3 font-medium">Created</th>
            <th className="py-1 font-medium">Revoked</th>
          </tr>
        </thead>
        <tbody>
          {overrides.map((o) => (
            <tr key={o.id} className="border-t border-secondary align-top">
              <td className="py-1.5 pr-3">{FIELD_LABELS[o.field]}</td>
              <td className="py-1.5 pr-3">{`${formatValue(o.previousValue)} → ${formatValue(o.value)}`}</td>
              <td className="py-1.5 pr-3">{o.reason ?? "—"}</td>
              <td className="py-1.5 pr-3">{`${userName(o.reviewedBy)} · ${formatDateTime(o.createdAt, tz)}`}</td>
              <td className="py-1.5">
                {o.revokedAt ? `${userName(o.revokedBy)} · ${formatDateTime(o.revokedAt, tz)}` : "Active"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
