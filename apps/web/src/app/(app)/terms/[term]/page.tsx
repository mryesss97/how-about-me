import { notFound } from "next/navigation";
import { Suspense } from "react";
import { parseTermSegment } from "@/lib/filters/term-segment";
import { TermPage as TermPageView } from "./term-page";
import { PageFrame } from "@/features/shared/page-frame";

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
    <PageFrame>
      {/* nuqs reads search params on the client, so the view needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <TermPageView term={term} />
      </Suspense>
    </PageFrame>
  );
}
