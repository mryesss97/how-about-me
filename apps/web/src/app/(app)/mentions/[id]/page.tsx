import { ArrowLeft } from "@untitledui/icons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UuidSchema } from "@how-about-me/contracts";
import { MentionDetail } from "@/features/mentions/detail/mention-detail";

export const metadata = { title: "Mention detail" };

/** Full-page mention detail — deep link / refresh (UX §3.4, FR-160). Auth redirect is handled by the proxy. */
export default async function MentionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!UuidSchema.safeParse(id).success) notFound();
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    if (typeof v === "string") sp.set(k, v);
    else v?.forEach((x) => sp.append(k, x));
  }
  const qs = sp.toString();
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:px-8">
      <header className="flex flex-col gap-2">
        <Link
          href={`/mentions${qs ? `?${qs}` : ""}`}
          className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-tertiary hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Mentions
        </Link>
        <h1 className="text-display-xs font-semibold text-primary">Mention detail</h1>
      </header>
      <MentionDetail mentionId={id} variant="page" />
    </div>
  );
}
