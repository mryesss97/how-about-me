import { PagePlaceholder } from "@/features/shared/page-placeholder";
export const metadata = { title: "Trạng thái hệ thống" };
export default function SystemStatusPage() {
  return (
    <PagePlaceholder
      title="Trạng thái hệ thống"
      description="Kết nối Threads, bộ thu thập, bộ phân tích và cơ sở dữ liệu; lịch sử đồng bộ, lỗi phân tích và nhật ký (UX §3.6)."
      tasks={["T-060 v1", "T-061 audit tab", "T-106 analyzer & failures"]}
    />
  );
}
