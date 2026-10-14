import { TermFilterSchema } from "@how-about-me/contracts";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TermDetailView } from "@/features/analytics/term-detail-view";
import { TermMentions } from "@/features/mentions/term-mentions";

type Params = { params: Promise<{ term: string }> };

/** The route segment arrives percent-encoded or decoded depending on the caller; normalise like the API (BR-041). */
async function readTerm(params: Params["params"]): Promise<string | null> {
  const { term: raw } = await params;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    // Already decoded and containing a bare "%".
  }
  const parsed = TermFilterSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function generateMetadata({ params }: Params) {
  const term = await readTerm(params);
  return { title: term ? `"${term}"` : "Cụm từ" };
}

/** Phrase detail (#276): opened from a landing board; any valid term works, configured or not. */
export default async function TermPage({ params }: Params) {
  const term = await readTerm(params);
  if (!term) notFound();
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:px-8">
      {/* nuqs reads search params on the client, so the views need a Suspense boundary. */}
      <Suspense fallback={null}>
        <TermDetailView term={term} />
        <TermMentions term={term} />
      </Suspense>
    </div>
  );
}
