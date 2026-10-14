import type { MentionDetail } from "@how-about-me/contracts";
import { Button } from "@/components/base/buttons/button";
import { PageBanner } from "@/features/shared/page-banner";

type Props = {
  analysis: MentionDetail["analysis"];
  /** Admin only (FR-156). Server enforces; this only hides the button (BR-033). */
  canRetry: boolean;
  onRetry: () => void;
  isRetrying: boolean;
};

/** Analysis status banner — FR-156, TC-MEN-014. */
export function StatusBanner({ analysis: a, canRetry, onRetry, isRetrying }: Props) {
  if (a.status === "pending" || a.status === "processing")
    return <PageBanner tone="info" title="Đang phân tích" description="Kết quả tự làm mới khi lượt chạy hoàn tất." />;
  if (a.status === "failed")
    return (
      <PageBanner
        tone="error"
        title="Phân tích thất bại"
        description={a.errorCode ? `Mã lỗi: ${a.errorCode}` : "Lượt phân tích gần nhất thất bại."}
        action={
          canRetry ? (
            <Button size="sm" color="secondary" onClick={onRetry} isLoading={isRetrying}>
              Thử lại
            </Button>
          ) : undefined
        }
      />
    );
  if (a.status === "stale")
    return (
      <PageBanner
        tone="warning"
        title="Kết quả phân tích đã cũ"
        description="Bài hoặc phiên bản phân tích đã thay đổi kể từ khi có kết quả này."
      />
    );
  return null;
}
