import { Suspense } from "react";
import { notFound } from "next/navigation";
import { UuidSchema } from "@how-about-me/contracts";
import { MentionDetailSlideout } from "@/features/mentions/detail/mention-detail-slideout";

/** Client-side navigation from the list to /mentions/:id lands here (slide-out over the list, TC-MEN-009). */
export default async function MentionDetailIntercepted({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UuidSchema.safeParse(id).success) notFound();
  return (
    <Suspense fallback={null}>
      <MentionDetailSlideout mentionId={id} />
    </Suspense>
  );
}
