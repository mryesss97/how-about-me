import { PagePlaceholder } from "@/features/shared/page-placeholder";
export const metadata = { title: "Listening Queries" };
export default function ListeningQueriesPage() {
  return (
    <PagePlaceholder
      title="Listening Queries"
      description="Keywords and topic tags the collector searches on a schedule; create/edit drawer, run now, enable/disable, soft delete (UX §3.5)."
      tasks={["T-046 table", "T-047 drawer & actions", "T-141 backfill (P1)"]}
    />
  );
}
