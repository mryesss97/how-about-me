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
    return (
      <PageBanner
        tone="info"
        title="Analysis in progress"
        description="Results refresh automatically when the run finishes."
      />
    );
  if (a.status === "failed")
    return (
      <PageBanner
        tone="error"
        title="Analysis failed"
        description={a.errorCode ? `Error code: ${a.errorCode}` : "The last analysis run failed."}
        action={
          canRetry ? (
            <Button size="sm" color="secondary" onClick={onRetry} isLoading={isRetrying}>
              Retry
            </Button>
          ) : undefined
        }
      />
    );
  if (a.status === "stale")
    return (
      <PageBanner
        tone="warning"
        title="Analysis is out of date"
        description="The post or the analysis version changed since this result was produced."
      />
    );
  return null;
}
