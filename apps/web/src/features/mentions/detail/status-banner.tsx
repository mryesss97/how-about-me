import type { MentionDetail } from "@how-about-me/contracts";
import { Button } from "@/components/base/buttons/button";
import { PageBanner } from "@/features/shared/page-banner";
import { analysisErrorLabel } from "@/lib/semantics/analysis-errors";

type Props = {
  analysis: MentionDetail["analysis"];
  /** `canReanalyze(role, settings)` — FR-155/FR-156, BR-033; server enforces, this only hides the button. */
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
        description={
          a.errorCode ? `${analysisErrorLabel(a.errorCode)} · Mã: ${a.errorCode}` : "Lượt phân tích gần nhất thất bại."
        }
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
