"use client";

import type { MentionDetail } from "@how-about-me/contracts";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import {
  ConfidenceMarker,
  RelevanceBadge,
  SafetyBadge,
  SentimentBadge,
  ValueSourceBadge,
} from "@/features/shared/semantic-badge";
import { humanize, pct, usd } from "./format";
import { KeyPhrases } from "./key-phrases";
import { activeOverrides } from "./overrides";
import { SafetyScoresTable } from "./safety-scores-table";
import { ValueSource } from "./value-source";
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

type Props = {
  mention: MentionDetail;
  tz: string;
  canOverride?: boolean;
  onRevoke?: (overrideId: string) => void;
  isRevoking?: boolean;
};

/**
 * Current analysis — UX §3.4. Sentiment and safety are separate dimensions (sentiment ≠ safety).
 * `analysis` holds effective values (BR-025); overridden fields show the Analyst source and no confidence.
 */
export function AnalysisCurrent({ mention, tz, canOverride = false, onRevoke, isRevoking = false }: Props) {
  const a = mention.analysis;
  const [showScores, setShowScores] = useState(false);
  const notYet = a.status !== "completed" && !a.analyzedAt;
  const active = activeOverrides(mention.overrides);
  const anyOverride = Object.keys(active).length > 0;
  const src = (field: keyof typeof active, hasValue: boolean) => (
    <ValueSource
      override={active[field]}
      hasValue={hasValue}
      tz={tz}
      canRevoke={canOverride}
      onRevoke={onRevoke}
      isRevoking={isRevoking}
    />
  );
  // Analyst labels carry no model confidence (API returns null), so hide the % rather than show "—".
  const conf = (field: keyof typeof active, v: number | null | undefined) =>
    active[field] ? null : <span className="text-xs text-tertiary">{pct(v)}</span>;
  const chip = (field: "intents" | "topics", label: string, c: number | null | undefined) =>
    active[field] ? humanize(label) : `${humanize(label)} · ${pct(c)}`;
  return (
    <div className="flex flex-col gap-4">
      {notYet ? <p className="text-sm text-tertiary">Not analysed yet.</p> : null}
      <Row label="Relevance">
        {a.relevance ? (
          <>
            <RelevanceBadge value={a.relevance.label} />
            {conf("relevance", a.relevance.confidence)}
          </>
        ) : (
          <Dash />
        )}
        {src("relevance", !!a.relevance)}
      </Row>
      {a.relevanceExplanation ? <p className="text-sm text-secondary">{a.relevanceExplanation}</p> : null}
      <Row label="Sentiment">
        {a.sentiment ? (
          <>
            <SentimentBadge value={a.sentiment.label} />
            {conf("sentiment", a.sentiment.confidence)}
          </>
        ) : (
          <Dash />
        )}
        {src("sentiment", !!a.sentiment)}
      </Row>
      <Row label="Safety">
        {a.safety ? <SafetyBadge value={a.safety.level} /> : <Dash />}
        {src("safety_level", !!a.safety)}
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
            <Badge key={i.label} type="modern" color="gray" size="sm">
              {chip("intents", i.label, i.confidence)}
            </Badge>
          ))
        ) : (
          <Dash />
        )}
        {src("intents", a.intents.length > 0)}
      </Row>
      <Row label="Topics">
        {a.topics.length ? (
          a.topics.map((t) => (
            <Badge key={t.label} type="modern" color="gray" size="sm">
              {chip("topics", t.label, t.confidence)}
            </Badge>
          ))
        ) : (
          <Dash />
        )}
        {src("topics", a.topics.length > 0)}
      </Row>
      <Row label="Key phrases">
        <KeyPhrases analysis={a} />
        {/* Phrases are always AI values (not overridable), so the source is AI (UX §3.4). */}
        {a.phrases?.length ? <ValueSourceBadge source="ai" /> : null}
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
      {anyOverride ? (
        <p className="text-xs text-tertiary">
          Overall confidence, relevance explanation and safety category scores are AI values, not analyst overrides.
        </p>
      ) : null}
      <VersionsList analysis={a} tz={tz} />
    </div>
  );
}
