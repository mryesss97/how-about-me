"use client";

import { SAFETY_CATEGORIES, type SafetyCategory } from "@how-about-me/taxonomy";
import { Input } from "@/components/base/input/input";
import type { PolicyErrors, ThresholdDraft } from "./analysis-policy-form-state";

/** Vietnamese names for moderation categories (#281); the API keeps the English category id. */
const CATEGORY_LABEL_VI: Record<SafetyCategory, string> = {
  harassment: "Quấy rối",
  "harassment/threatening": "Quấy rối / đe doạ",
  hate: "Thù ghét",
  "hate/threatening": "Thù ghét / đe doạ",
  sexual: "Tình dục",
  "sexual/minors": "Tình dục / trẻ vị thành niên",
  violence: "Bạo lực",
  "violence/graphic": "Bạo lực / hình ảnh",
  "self-harm": "Tự hại",
  "self-harm/intent": "Tự hại / ý định",
  "self-harm/instructions": "Tự hại / hướng dẫn",
  illicit: "Phi pháp",
  "illicit/violent": "Phi pháp / bạo lực",
};
const label = (c: SafetyCategory) => CATEGORY_LABEL_VI[c];
const LEVEL_LABEL = { sensitive: "Nhạy cảm", severe: "Nghiêm trọng" } as const;

/** vi-VN text for a threshold draft ("0.85" → "0,85"); empty → "—" (#347). */
export function formatThreshold(v: string): string {
  if (v.trim() === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("vi-VN", { maximumFractionDigits: 4 }) : v;
}

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
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-sm text-tertiary">
        {readOnly ? "“—” = không áp dụng mức này." : "Giá trị 0,01–1. Để trống = không áp dụng mức này."}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="mb-2 text-left font-semibold text-primary">Ngưỡng an toàn</caption>
          <thead>
            <tr className="text-left text-tertiary">
              <th className="py-2 font-medium">Nhóm</th>
              <th className="py-2 font-medium">Nhạy cảm</th>
              <th className="py-2 font-medium">Nghiêm trọng</th>
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
                  {(["sensitive", "severe"] as const).map((level) => (
                    <td key={level} className="min-w-0 py-2 pr-3">
                      {readOnly ? (
                        <span className="text-secondary tabular-nums">{formatThreshold(thresholds[c][level])}</span>
                      ) : (
                        <Input
                          aria-label={`${label(c)} – ${LEVEL_LABEL[level]}`}
                          type="number"
                          size="sm"
                          placeholder="—"
                          value={thresholds[c][level]}
                          onChange={(v) => onChange(c, level, v)}
                          isInvalid={!!errors[`safetyThresholds.${c}.${level}`] || !!rowError}
                          hint={errors[`safetyThresholds.${c}.${level}`]}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
