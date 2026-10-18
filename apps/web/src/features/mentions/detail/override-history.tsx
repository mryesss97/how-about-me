import type { Override } from "@how-about-me/contracts";
import { formatDateTime, formatShortDateTime } from "@/lib/time/format";
import { FIELD_LABELS, formatValue, userName } from "./overrides";

/** Every analyst override, active and revoked (FR-193: revoking keeps history). Newest first as returned. */
export function OverrideHistory({ overrides, tz }: { overrides: readonly Override[]; tz: string }) {
  if (overrides.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label="Ghi đè của chuyên viên">
        <caption className="pb-2 text-left text-sm font-semibold text-primary">Ghi đè của chuyên viên</caption>
        <thead>
          <tr className="text-left text-xs text-tertiary">
            <th className="py-1 pr-3 font-medium">Trường</th>
            <th className="py-1 pr-3 font-medium">AI → Chuyên viên</th>
            <th className="py-1 pr-3 font-medium">Lý do</th>
            <th className="py-1 pr-3 font-medium">Tạo</th>
            <th className="py-1 font-medium">Thu hồi</th>
          </tr>
        </thead>
        <tbody>
          {overrides.map((o) => (
            <tr key={o.id} className="border-t border-secondary align-top">
              <td className="py-1.5 pr-3">{FIELD_LABELS[o.field]}</td>
              <td className="py-1.5 pr-3">{`${formatValue(o.previousValue, o.field)} → ${formatValue(o.value, o.field)}`}</td>
              <td className="py-1.5 pr-3">{o.reason ?? "—"}</td>
              <td className="py-1.5 pr-3 whitespace-nowrap" title={formatDateTime(o.createdAt, tz)}>
                {`${userName(o.reviewedBy)} · ${formatShortDateTime(o.createdAt, tz)}`}
              </td>
              {/* #344: same short date as the runs table; full date in title. */}
              <td
                className="py-1.5 whitespace-nowrap"
                title={o.revokedAt ? formatDateTime(o.revokedAt, tz) : undefined}
              >
                {o.revokedAt ? `${userName(o.revokedBy)} · ${formatShortDateTime(o.revokedAt, tz)}` : "Đang hiệu lực"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
