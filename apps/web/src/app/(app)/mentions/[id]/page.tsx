import { ArrowLeft } from "@untitledui/icons";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UuidSchema } from "@how-about-me/contracts";
import { MentionDetail } from "@/features/mentions/detail/mention-detail";
import { PageHeader } from "@/features/shared/page-header";
import { BACK_PARAM, resolveBack } from "@/lib/navigation/back-link";

export const metadata = { title: "Chi tiết bài nhắc" };

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
  // `item` belongs to the list slide-out (#326), not to the list filters.
  sp.delete("item");
  // #331: `back` names the source page (phrase page, System Status…); falls back to the list.
  const back = resolveBack(sp.get(BACK_PARAM));
  sp.delete(BACK_PARAM);
  const qs = sp.toString();
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:px-8">
      <nav aria-label="Điều hướng">
        <Link
          href={back?.href ?? `/mentions${qs ? `?${qs}` : ""}`}
          className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-tertiary hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {back?.label ?? "Quay lại danh sách"}
        </Link>
      </nav>
      <PageHeader title="Chi tiết bài nhắc" />
      <MentionDetail mentionId={id} variant="page" />
    </div>
  );
}
