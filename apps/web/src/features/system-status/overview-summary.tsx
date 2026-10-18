import Link from "next/link";
import { Fragment } from "react";
import type { Summary } from "./format";

/**
 * One sentence under the fascia, most urgent issue first (#342, UX §3.6). Plain `<p>`, not a live region:
 * the overview polls every 30 s and re-announcing it would be noise.
 */
export function OverviewSummary({ summary }: { summary: Summary }) {
  if (summary.ok) return <p className="text-sm text-secondary">Mọi bộ phận hoạt động bình thường.</p>;
  return (
    <p className="text-sm text-primary">
      <span className="font-semibold">Cần xử lý: </span>
      {summary.clauses.map((c, i) => (
        <Fragment key={c.text}>
          {i > 0 ? " · " : null}
          {c.href ? (
            <Link href={c.href} className="font-semibold underline underline-offset-2">
              {c.text}
            </Link>
          ) : (
            c.text
          )}
        </Fragment>
      ))}
    </p>
  );
}
