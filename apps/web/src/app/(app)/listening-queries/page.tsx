import { PagePlaceholder } from "@/features/shared/page-placeholder";
export const metadata = { title: "Truy vấn theo dõi" };
export default function ListeningQueriesPage() {
  return (
    <PagePlaceholder
      title="Truy vấn theo dõi"
      description="Từ khoá và hashtag mà bộ thu thập tìm theo lịch: tạo/sửa, chạy ngay, bật/tắt, xoá mềm."
      tasks={[
        { id: "T-046", label: "Bảng truy vấn" },
        { id: "T-047", label: "Ngăn kéo & thao tác" },
        { id: "T-141", label: "Lấy dữ liệu cũ (P1)" },
      ]}
    />
  );
}
