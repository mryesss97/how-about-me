"use client";

import type { MentionDetail } from "@how-about-me/contracts";
import { Tabs } from "@/components/application/tabs/tabs";
import { AnalysisCurrent } from "./analysis-current";
import { AnalysisHistory } from "./analysis-history";

/** Current / History tabs (UX §3.4). Tab state is local — not part of the URL. */
export function AnalysisTabs({ mention, tz }: { mention: MentionDetail; tz: string }) {
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
        <AnalysisCurrent mention={mention} tz={tz} />
      </Tabs.Panel>
      <Tabs.Panel id="history" className="pt-4">
        <AnalysisHistory runs={mention.runs} tz={tz} />
      </Tabs.Panel>
    </Tabs>
  );
}
