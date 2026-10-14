import { PagePlaceholder } from "@/features/shared/page-placeholder";
export const metadata = { title: "Trạng thái hệ thống" };
export default function SystemStatusPage() {
  return (
    <PagePlaceholder
      title="Trạng thái hệ thống"
      description="Kết nối Threads, bộ thu thập, bộ phân tích và cơ sở dữ liệu; lịch sử đồng bộ, lỗi phân tích và nhật ký."
      tasks={[
        { id: "T-060", label: "Thẻ trạng thái & lượt đồng bộ" },
        { id: "T-061", label: "Nhật ký thao tác" },
        { id: "T-106", label: "Bộ phân tích & lỗi phân tích" },
      ]}
    />
  );
}
