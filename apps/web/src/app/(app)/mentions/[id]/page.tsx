import { PagePlaceholder } from "@/features/shared/page-placeholder";
export const metadata = { title: "Mention detail" };
export default async function MentionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PagePlaceholder
      title="Mention detail"
      description={`Original post, analysis (current/history) and operations for mention ${id} (UX §3.4).`}
      tasks={["T-104"]}
    />
  );
}
