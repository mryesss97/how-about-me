import type { MentionDetail } from "@how-about-me/contracts";
import { cx } from "@/utils/cx";
import { displayLabel } from "@/lib/semantics/labels";
import { humanize } from "./format";

type A = MentionDetail["analysis"];

/** Safety category scores, triggered rows highlighted with their level (TC-MEN-010). */
export function SafetyScoresTable({
  scores,
  triggered,
}: {
  scores: A["safetyCategoryScores"];
  triggered: A["safetyTriggered"];
}) {
  const entries = Object.entries(scores ?? {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <p className="text-sm text-tertiary">Không có điểm hạng mục.</p>;
  const hit = new Map((triggered ?? []).map((t) => [t.category, t.level]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label="Điểm an toàn theo hạng mục">
        <thead>
          <tr className="text-left text-xs text-tertiary">
            <th className="py-1 font-medium">Hạng mục</th>
            <th className="py-1 text-right font-medium">Điểm</th>
            <th className="py-1 text-right font-medium">Kích hoạt</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([cat, score]) => {
            const level = hit.get(cat);
            return (
              <tr
                key={cat}
                data-triggered={level ? "true" : undefined}
                className={cx("border-t border-secondary", level && "bg-utility-red-50")}
              >
                <td className="py-1 text-primary">{humanize(cat)}</td>
                <td className="py-1 text-right font-mono">
                  {score.toLocaleString("vi-VN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </td>
                <td className="py-1 text-right">{level ? displayLabel("safety", level) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
