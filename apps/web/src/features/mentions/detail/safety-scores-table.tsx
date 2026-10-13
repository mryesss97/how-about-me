import type { MentionDetail } from "@how-about-me/contracts";
import { cx } from "@/utils/cx";
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
  if (entries.length === 0) return <p className="text-sm text-tertiary">No category scores.</p>;
  const hit = new Map((triggered ?? []).map((t) => [t.category, t.level]));
  return (
    <table className="w-full text-sm" aria-label="Safety category scores">
      <thead>
        <tr className="text-left text-xs text-tertiary">
          <th className="py-1 font-medium">Category</th>
          <th className="py-1 text-right font-medium">Score</th>
          <th className="py-1 text-right font-medium">Triggered</th>
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
              <td className="py-1 text-right font-mono">{score.toFixed(3)}</td>
              <td className="py-1 text-right">{level ? humanize(level) : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
