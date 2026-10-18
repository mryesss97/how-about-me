import { Suspense } from "react";
import { SystemStatusView } from "@/features/system-status/system-status-view";

export const metadata = { title: "Trạng thái hệ thống" };

export default function SystemStatusPage() {
  return (
    <Suspense>
      <SystemStatusView />
    </Suspense>
  );
}
