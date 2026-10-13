"use client";

import type { MentionDetail } from "@how-about-me/contracts";
import { Tabs } from "@/components/application/tabs/tabs";
import { AnalysisCurrent } from "./analysis-current";
import { AnalysisHistory } from "./analysis-history";
import { OverrideHistory } from "./override-history";

/** Current / History tabs (UX §3.4). Tab state is local — not part of the URL. */
type Props = {
  mention: MentionDetail;
  tz: string;
  canOverride?: boolean;
  onRevoke?: (overrideId: string) => void;
  isRevoking?: boolean;
};

export function AnalysisTabs({ mention, tz, canOverride = false, onRevoke, isRevoking = false }: Props) {
  return (
    <Tabs defaultSelectedKey="current">
      <Tabs.List
        type="underline"
        size="sm"
        aria-label="Analysis"
        items={[
          { id: "current", label: "Current" },
          { id: "history", label: "History", badge: mention.runs.length || undefined },
        ]}
      />
      <Tabs.Panel id="current" className="pt-4">
        <AnalysisCurrent
          mention={mention}
          tz={tz}
          canOverride={canOverride}
          onRevoke={onRevoke}
          isRevoking={isRevoking}
        />
      </Tabs.Panel>
      <Tabs.Panel id="history" className="pt-4">
        <div className="flex flex-col gap-6">
          <AnalysisHistory runs={mention.runs} tz={tz} />
          <OverrideHistory overrides={mention.overrides ?? []} tz={tz} />
        </div>
      </Tabs.Panel>
    </Tabs>
  );
}
