import { PagePlaceholder } from "@/features/shared/page-placeholder";
export const metadata = { title: "Truy vấn theo dõi" };
export default function ListeningQueriesPage() {
  return (
    <PagePlaceholder
      title="Truy vấn theo dõi"
      description="Từ khoá và hashtag mà bộ thu thập tìm theo lịch: tạo/sửa, chạy ngay, bật/tắt, xoá mềm (UX §3.5)."
      tasks={["T-046 table", "T-047 drawer & actions", "T-141 backfill (P1)"]}
    />
  );
}
