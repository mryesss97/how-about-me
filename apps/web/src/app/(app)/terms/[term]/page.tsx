import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TermDetailView } from "@/features/analytics/term-detail-view";
import { TermMentions } from "@/features/mentions/term-mentions";
import { parseTermSegment } from "@/lib/filters/term-segment";

type Params = { params: Promise<{ term: string }> };

async function readTerm(params: Params["params"]): Promise<string | null> {
  return parseTermSegment((await params).term);
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
