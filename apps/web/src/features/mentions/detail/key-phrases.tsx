import type { MentionDetail } from "@how-about-me/contracts";
import Link from "next/link";
import { Badge } from "@/components/base/badges/badges";
import { phraseMentionsHref } from "@/lib/filters/api-params";

type Analysis = MentionDetail["analysis"];

/**
 * #250 / FR-120 / BR-041: key phrases of the current analysis, shown verbatim, each linking to `/mentions?phrase=p`.
 * `null` with an analysis = classifier-v1 (before phrase extraction); `[]` = none extracted.
 */
export function KeyPhrases({ analysis }: { analysis: Analysis }) {
  const phrases = analysis.phrases;
  if (phrases && phrases.length > 0) {
    return (
      <>
        {phrases.map((p) => (
          <Link
            key={p}
            href={phraseMentionsHref(p)}
            aria-label={`Xem bài nhắc có cụm từ "${p}"`}
            title={`Xem bài nhắc có cụm từ "${p}"`}
            className="rounded-md outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Badge type="modern" color="gray" size="sm" className="hover:bg-primary_hover">
              {p}
            </Badge>
          </Link>
        ))}
      </>
    );
  }
  if (phrases == null && analysis.versions != null) {
    return <span className="text-sm text-tertiary">Chưa có cụm từ (phân tích trước khi có trích xuất cụm từ)</span>;
  }
  return <span className="text-quaternary">—</span>;
}
