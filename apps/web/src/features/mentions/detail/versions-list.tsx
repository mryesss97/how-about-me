import type { MentionDetail } from "@how-about-me/contracts";
import { formatDateTime } from "@/lib/time/format";

const FIELDS = [
  ["classifierProvider", "Classifier provider"],
  ["classifierModel", "Classifier model"],
  ["promptVersion", "Prompt version"],
  ["taxonomyVersion", "Taxonomy version"],
  ["safetyProvider", "Safety provider"],
  ["safetyModel", "Safety model"],
  ["safetyPolicyVersion", "Safety policy version"],
] as const;

/** The 7 version fields + analyzedAt of the current analysis (TC-MEN-011). */
export function VersionsList({ analysis, tz }: { analysis: MentionDetail["analysis"]; tz: string }) {
  const v = analysis.versions;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs" aria-label="Versions">
      {FIELDS.map(([k, label]) => (
        <div key={k} className="contents">
          <dt className="text-tertiary">{label}</dt>
          <dd className="font-mono text-secondary">{v?.[k] ?? "—"}</dd>
        </div>
      ))}
      <dt className="text-tertiary">Analyzed at</dt>
      <dd className="text-secondary">{analysis.analyzedAt ? formatDateTime(analysis.analyzedAt, tz) : "—"}</dd>
    </dl>
  );
}
