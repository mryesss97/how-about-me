import type { AnalysisSettings } from "@how-about-me/contracts";

const FIELDS: [keyof AnalysisSettings["versions"], string][] = [
  ["classifierProvider", "Classifier provider"],
  ["classifierModel", "Classifier model"],
  ["promptVersion", "Prompt version"],
  ["taxonomyVersion", "Taxonomy version"],
  ["safetyProvider", "Safety provider"],
  ["safetyModel", "Safety model"],
  ["safetyPolicyVersion", "Safety policy version"],
];

/** BR-023: read-only list of the versions new analyses will run with. */
export function AnalysisVersions({ settings }: { settings: AnalysisSettings }) {
  return (
    <section aria-label="Current versions" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-primary">Current versions</h3>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
        {FIELDS.map(([k, l]) => (
          <div key={k} className="contents">
            <dt className="text-tertiary">{l}</dt>
            <dd className="text-secondary">{settings.versions[k] ?? "—"}</dd>
          </div>
        ))}
        <dt className="text-tertiary">Effective version</dt>
        <dd className="font-mono text-xs text-secondary">{settings.effectiveVersion}</dd>
      </dl>
    </section>
  );
}
