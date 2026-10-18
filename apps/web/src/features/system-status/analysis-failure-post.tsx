import type { AnalysisRun } from "@how-about-me/contracts";
import Link from "next/link";
import { withBack } from "@/lib/navigation/back-link";

/** #343: mention detail keeps the failures tab on the way back. */
export const failurePostHref = (postId: string) =>
  withBack(`/mentions/${postId}`, "/system-status?tab=analysis-failures");

/** Short text for aria-labels: excerpt cut to 30 chars, or a neutral fallback. */
export function shortExcerpt(run: AnalysisRun): string {
  const e = run.post.excerpt;
  if (!e) return "không có chữ";
  const chars = Array.from(e);
  return chars.length > 30 ? `${chars.slice(0, 30).join("")}…` : e;
}

/** #343 ops-11: post excerpt + @username linking to the mention (no UUID on screen). */
export function FailurePostLink({ run, className }: { run: AnalysisRun; className?: string }) {
  const { excerpt, username } = run.post;
  return (
    <Link href={failurePostHref(run.postId)} className={`group flex flex-col ${className ?? ""}`}>
      <span className="line-clamp-2 text-sm text-brand-secondary group-hover:underline">
        {excerpt ?? (username ? "Bài không có chữ" : "Xem bài nhắc")}
      </span>
      {username ? <span className="text-xs text-tertiary">@{username}</span> : null}
    </Link>
  );
}
