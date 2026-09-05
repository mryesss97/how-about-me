import { PagePlaceholder } from "@/features/shared/page-placeholder";
export const metadata = { title: "System Status" };
export default function SystemStatusPage() {
  return (
    <PagePlaceholder
      title="System Status"
      description="Threads connection, collector, analyzer and database health; sync jobs, analysis failures and audit log tabs (UX §3.6)."
      tasks={["T-060 v1", "T-061 audit tab", "T-106 analyzer & failures"]}
    />
  );
}
