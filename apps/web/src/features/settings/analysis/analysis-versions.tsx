"use client";

import type { AnalysisSettings } from "@how-about-me/contracts";
import { ChevronDown } from "@untitledui/icons";
import { toast } from "sonner";
import { PlaqueButton } from "@/features/shared/plaque-button";

const FIELDS: [keyof AnalysisSettings["versions"], string][] = [
  ["classifierProvider", "Nhà cung cấp phân loại"],
  ["classifierModel", "Mô hình phân loại"],
  ["promptVersion", "Phiên bản prompt"],
  ["taxonomyVersion", "Phiên bản taxonomy"],
  ["safetyProvider", "Nhà cung cấp kiểm duyệt an toàn"],
  ["safetyModel", "Mô hình an toàn"],
  ["safetyPolicyVersion", "Phiên bản chính sách an toàn"],
];

/** BR-023: read-only versions new analyses will run with, collapsed as technical detail (#347). */
export function AnalysisVersions({ settings }: { settings: AnalysisSettings }) {
  const copy = () => {
    void navigator.clipboard
      ?.writeText(settings.effectiveVersion)
      .then(() => toast.success("Đã sao chép"))
      .catch(() => undefined);
  };
  return (
    <details className="group min-w-0 text-sm">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-semibold text-secondary hover:text-primary [&::-webkit-details-marker]:hidden">
        Chi tiết phiên bản (kỹ thuật)
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
        {FIELDS.map(([k, l]) => (
          <div key={k} className="contents">
            <dt className="text-tertiary">{l}</dt>
            <dd className="mb-2 min-w-0 break-words text-secondary sm:mb-0">{settings.versions[k] ?? "—"}</dd>
          </div>
        ))}
        <dt className="text-tertiary">Phiên bản hiệu lực</dt>
        <dd className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 font-mono text-xs break-all text-secondary">{settings.effectiveVersion}</span>
          <PlaqueButton type="button" size="xs" onClick={copy}>
            Sao chép
          </PlaqueButton>
        </dd>
      </dl>
    </details>
  );
}
