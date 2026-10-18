"use client";

import type { MentionDetail, OverrideField } from "@how-about-me/contracts";
import { useState } from "react";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import {
  ConfidenceMarker,
  RelevanceBadge,
  SafetyBadge,
  SentimentBadge,
  ValueSourceBadge,
} from "@/features/shared/semantic-badge";
import { displayLabel } from "@/lib/semantics/labels";
import { formatDateTime } from "@/lib/time/format";
import { Dash, EditButton, Group, Row } from "./analysis-groups";
import { Disclosure } from "./disclosure";
import { pct, usd } from "./format";
import { KeyPhrases } from "./key-phrases";
import { activeOverrides } from "./overrides";
import { SafetyScoresTable } from "./safety-scores-table";
import { ValueSource } from "./value-source";
import { VersionsList } from "./versions-list";

type Props = {
  mention: MentionDetail;
  tz: string;
  canOverride?: boolean;
  /** Per-field "Sửa"; shown only with `canOverride` (FR-191, FR-015 UX mirror). */
  onEditField?: (field: OverrideField) => void;
  onRevoke?: (overrideId: string) => void;
  isRevoking?: boolean;
};

/**
 * Current analysis — UX §3.4. Sentiment and safety are separate dimensions (sentiment ≠ safety).
 * `analysis` holds effective values (BR-025); overridden fields show the Analyst source and no confidence.
 * #338: verdict first (Kết luận), then content (Nội dung); technical data folds into "Chi tiết kỹ thuật".
 */
export function AnalysisCurrent({
  mention,
  tz,
  canOverride = false,
  onEditField,
  onRevoke,
  isRevoking = false,
}: Props) {
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
    active[field] ? displayLabel(kind(field), label) : `${displayLabel(kind(field), label)} · ${pct(c)}`;
  const edit = (f: OverrideField) =>
    canOverride && onEditField ? <EditButton field={f} onEdit={onEditField} /> : null;
  const verdictCls = "text-md";
  const kind = (field: "intents" | "topics") => (field === "intents" ? "intent" : "topic");
  return (
    <div className="flex flex-col gap-6">
      {notYet ? <p className="text-sm text-tertiary">Chưa phân tích.</p> : null}
      {a.status === "failed" && a.analyzedAt ? (
        // #338: on a failed run the API still returns the last completed values — say they are old.
        <p className="text-sm text-tertiary">
          Giá trị dưới đây từ lần phân tích trước ({formatDateTime(a.analyzedAt, tz)}); lượt mới nhất bị lỗi.
        </p>
      ) : null}
      <Group title="Kết luận">
        <Row label="Mức liên quan" size="verdict" action={edit("relevance")}>
          {a.relevance ? (
            <>
              <RelevanceBadge value={a.relevance.label} size="lg" className={verdictCls} />
              {conf("relevance", a.relevance.confidence)}
            </>
          ) : (
            <Dash />
          )}
          {src("relevance", !!a.relevance)}
        </Row>
        {a.relevanceExplanation ? <p className="text-md text-secondary">{a.relevanceExplanation}</p> : null}
        {/* Sentiment ≠ safety: two separate rows (BR-017). */}
        <Row label="Cảm xúc" size="verdict" action={edit("sentiment")}>
          {a.sentiment ? (
            <>
              <SentimentBadge value={a.sentiment.label} size="lg" className={verdictCls} />
              {conf("sentiment", a.sentiment.confidence)}
            </>
          ) : (
            <Dash />
          )}
          {src("sentiment", !!a.sentiment)}
        </Row>
        <Row label="An toàn" size="verdict" action={edit("safety_level")}>
          {a.safety ? <SafetyBadge value={a.safety.level} size="lg" className={verdictCls} /> : <Dash />}
          {src("safety_level", !!a.safety)}
          {a.safetyCategoryScores ? (
            <Button
              color="link-color"
              size="sm"
              className="max-md:min-h-11"
              onClick={() => setShowScores((s) => !s)}
              aria-expanded={showScores}
            >
              {showScores ? "Ẩn điểm theo hạng mục" : "Hiện điểm theo hạng mục"}
            </Button>
          ) : null}
        </Row>
        {showScores ? <SafetyScoresTable scores={a.safetyCategoryScores} triggered={a.safetyTriggered} /> : null}
      </Group>
      <Group title="Nội dung">
        <Row label="Ý định" action={edit("intents")}>
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
        <Row label="Chủ đề" action={edit("topics")}>
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
        <Row label="Cụm từ khoá">
          <KeyPhrases analysis={a} />
          {/* Phrases are always AI values (not overridable), so the source is AI (UX §3.4). */}
          {a.phrases?.length ? <ValueSourceBadge source="ai" /> : null}
        </Row>
        <Row label="Tóm tắt">{a.summary ?? <Dash />}</Row>
        <Row label="Ngôn ngữ">{a.language ? displayLabel("language", a.language) : <Dash />}</Row>
      </Group>
      <Disclosure label="Chi tiết kỹ thuật">
        <Row label="Độ tin cậy">
          {a.confidenceBand ? <ConfidenceMarker band={a.confidenceBand} /> : <Dash />}
          <span className="text-xs text-tertiary">{pct(a.overallConfidence)}</span>
        </Row>
        <Row label="Token / chi phí">
          <span className="text-xs">
            {a.tokens ? `${a.tokens.input ?? "—"} vào · ${a.tokens.output ?? "—"} ra` : "—"} · {usd(a.estimatedCostUsd)}
          </span>
        </Row>
        {anyOverride ? (
          <p className="text-xs text-tertiary">
            Độ tin cậy tổng, giải thích mức liên quan và điểm an toàn theo hạng mục là giá trị AI, không phải ghi đè của
            chuyên viên.
          </p>
        ) : null}
        <VersionsList analysis={a} tz={tz} />
      </Disclosure>
    </div>
  );
}
