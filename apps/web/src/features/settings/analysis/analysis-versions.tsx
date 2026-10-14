import type { AnalysisSettings } from "@how-about-me/contracts";

const FIELDS: [keyof AnalysisSettings["versions"], string][] = [
  ["classifierProvider", "Nhà cung cấp phân loại"],
  ["classifierModel", "Mô hình phân loại"],
  ["promptVersion", "Phiên bản prompt"],
  ["taxonomyVersion", "Phiên bản taxonomy"],
  ["safetyProvider", "Nhà cung cấp kiểm duyệt an toàn"],
  ["safetyModel", "Mô hình an toàn"],
  ["safetyPolicyVersion", "Phiên bản chính sách an toàn"],
];

/** BR-023: read-only list of the versions new analyses will run with. */
export function AnalysisVersions({ settings }: { settings: AnalysisSettings }) {
  return (
    <section aria-label="Phiên bản hiện tại" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-primary">Phiên bản hiện tại</h3>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
        {FIELDS.map(([k, l]) => (
          <div key={k} className="contents">
            <dt className="text-tertiary">{l}</dt>
            <dd className="text-secondary">{settings.versions[k] ?? "—"}</dd>
          </div>
        ))}
        <dt className="text-tertiary">Phiên bản hiệu lực</dt>
        <dd className="font-mono text-xs text-secondary">{settings.effectiveVersion}</dd>
      </dl>
    </section>
  );
}
