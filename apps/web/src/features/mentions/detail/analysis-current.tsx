"use client";

import type { MentionDetail } from "@how-about-me/contracts";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ConfidenceMarker, RelevanceBadge, SafetyBadge, SentimentBadge } from "@/features/shared/semantic-badge";
import { humanize, pct, usd } from "./format";
import { SafetyScoresTable } from "./safety-scores-table";
import { VersionsList } from "./versions-list";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-tertiary">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5 text-sm text-primary">{children}</div>
    </div>
  );
}

const Dash = () => <span className="text-quaternary">—</span>;

/** Current analysis — UX §3.4. Sentiment and safety are separate dimensions (sentiment ≠ safety). */
export function AnalysisCurrent({ mention, tz }: { mention: MentionDetail; tz: string }) {
  const a = mention.analysis;
  const [showScores, setShowScores] = useState(false);
  const notYet = a.status !== "completed" && !a.analyzedAt;
  return (
    <div className="flex flex-col gap-4">
      {notYet ? <p className="text-sm text-tertiary">Not analysed yet.</p> : null}
      <Row label="Relevance">
        {a.relevance ? (
          <>
            <RelevanceBadge value={a.relevance.label} />
            <span className="text-xs text-tertiary">{pct(a.relevance.confidence)}</span>
          </>
        ) : (
          <Dash />
        )}
      </Row>
      {a.relevanceExplanation ? <p className="text-sm text-secondary">{a.relevanceExplanation}</p> : null}
      <Row label="Sentiment">
        {a.sentiment ? (
          <>
            <SentimentBadge value={a.sentiment.label} />
            <span className="text-xs text-tertiary">{pct(a.sentiment.confidence)}</span>
          </>
        ) : (
          <Dash />
        )}
      </Row>
      <Row label="Safety">
        {a.safety ? <SafetyBadge value={a.safety.level} /> : <Dash />}
        {a.safetyCategoryScores ? (
          <Button color="link-color" size="sm" onClick={() => setShowScores((s) => !s)} aria-expanded={showScores}>
            {showScores ? "Hide category scores" : "Show category scores"}
          </Button>
        ) : null}
      </Row>
      {showScores ? <SafetyScoresTable scores={a.safetyCategoryScores} triggered={a.safetyTriggered} /> : null}
      <Row label="Intents">
        {a.intents.length ? (
          a.intents.map((i) => (
            <Badge
              key={i.label}
              type="modern"
              color="gray"
              size="sm"
            >{`${humanize(i.label)} · ${pct(i.confidence)}`}</Badge>
          ))
        ) : (
          <Dash />
        )}
      </Row>
      <Row label="Topics">
        {a.topics.length ? (
          a.topics.map((t) => (
            <Badge
              key={t.label}
              type="modern"
              color="gray"
              size="sm"
            >{`${humanize(t.label)} · ${pct(t.confidence)}`}</Badge>
          ))
        ) : (
          <Dash />
        )}
      </Row>
      <Row label="Language">{a.language ? a.language.toUpperCase() : <Dash />}</Row>
      <Row label="Summary">{a.summary ?? <Dash />}</Row>
      <Row label="Confidence">
        {a.confidenceBand ? <ConfidenceMarker band={a.confidenceBand} /> : <Dash />}
        <span className="text-xs text-tertiary">{pct(a.overallConfidence)}</span>
      </Row>
      <Row label="Tokens / cost">
        <span className="text-xs">
          {a.tokens ? `${a.tokens.input ?? "—"} in · ${a.tokens.output ?? "—"} out` : "—"} · {usd(a.estimatedCostUsd)}
        </span>
      </Row>
      <VersionsList analysis={a} tz={tz} />
    </div>
  );
}
