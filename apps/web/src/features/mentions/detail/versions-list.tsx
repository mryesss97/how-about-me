import type { MentionDetail } from "@how-about-me/contracts";
import { formatDateTime } from "@/lib/time/format";

const FIELDS = [
  ["classifierProvider", "Nhà cung cấp phân loại"],
  ["classifierModel", "Mô hình phân loại"],
  ["promptVersion", "Phiên bản prompt"],
  ["taxonomyVersion", "Phiên bản taxonomy"],
  ["safetyProvider", "Nhà cung cấp an toàn"],
  ["safetyModel", "Mô hình an toàn"],
  ["safetyPolicyVersion", "Phiên bản chính sách an toàn"],
] as const;

/** The 7 version fields + analyzedAt of the current analysis (TC-MEN-011). */
export function VersionsList({ analysis, tz }: { analysis: MentionDetail["analysis"]; tz: string }) {
  const v = analysis.versions;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs" aria-label="Phiên bản">
      {FIELDS.map(([k, label]) => (
        <div key={k} className="contents">
          <dt className="text-tertiary">{label}</dt>
          <dd className="font-mono text-secondary">{v?.[k] ?? "—"}</dd>
        </div>
      ))}
      <dt className="text-tertiary">Phân tích lúc</dt>
      <dd className="text-secondary">{analysis.analyzedAt ? formatDateTime(analysis.analyzedAt, tz) : "—"}</dd>
    </dl>
  );
}
