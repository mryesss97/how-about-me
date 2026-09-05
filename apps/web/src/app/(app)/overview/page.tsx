import { PagePlaceholder } from "@/features/shared/page-placeholder";
export const metadata = { title: "Overview" };
export default function OverviewPage() {
  return (
    <PagePlaceholder
      title="Overview"
      description="KPI cards, six core charts, previous-period comparison and drill-down to mentions (docs/01-product/09-ux-specification.md §3.2)."
      tasks={["T-098 filter bar", "T-099 KPI cards & banners", "T-100 / T-101 charts", "T-102 compare & drill-down"]}
    />
  );
}
