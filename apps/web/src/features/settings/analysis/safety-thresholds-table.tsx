"use client";

import { SAFETY_CATEGORIES, type SafetyCategory } from "@how-about-me/taxonomy";
import { Input } from "@/components/base/input/input";
import type { PolicyErrors, ThresholdDraft } from "./analysis-policy-form-state";

/** `harassment/threatening` → `Harassment / threatening`. */
const label = (c: string) => (c.charAt(0).toUpperCase() + c.slice(1)).replace(/\//g, " / ");

/** FR-190 / BR-018: one row per safety category; an empty cell means the level is not applied. */
export function SafetyThresholdsTable({
  thresholds,
  errors,
  readOnly,
  onChange,
}: {
  thresholds: Record<SafetyCategory, ThresholdDraft>;
  errors: PolicyErrors;
  readOnly: boolean;
  onChange: (category: SafetyCategory, level: keyof ThresholdDraft, value: string) => void;
}) {
  return (
    <table className="w-full text-sm">
      <caption className="mb-2 text-left font-semibold text-primary">Safety thresholds</caption>
      <thead>
        <tr className="text-left text-tertiary">
          <th className="py-2 font-medium">Category</th>
          <th className="py-2 font-medium">Sensitive</th>
          <th className="py-2 font-medium">Severe</th>
        </tr>
      </thead>
      <tbody>
        {SAFETY_CATEGORIES.map((c) => {
          const rowError = errors[`safetyThresholds.${c}`];
          return (
            <tr key={c} className="border-t border-secondary align-top">
              <th scope="row" className="py-2 pr-3 text-left font-medium text-secondary">
                {label(c)}
                {rowError ? <p className="text-xs font-normal text-error-primary">{rowError}</p> : null}
              </th>
              {(["sensitive", "severe"] as const).map((level) => {
                const err = errors[`safetyThresholds.${c}.${level}`];
                return (
                  <td key={level} className="py-2 pr-3">
                    <Input
                      aria-label={`${label(c)} ${level}`}
                      type="number"
                      size="sm"
                      placeholder="Not applied"
                      value={thresholds[c][level]}
                      onChange={(v) => onChange(c, level, v)}
                      isDisabled={readOnly}
                      isInvalid={!!err || !!rowError}
                      hint={err}
                    />
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
