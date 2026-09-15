"use client";

import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle,
  Clock,
  FaceFrown,
  FaceNeutral,
  FaceSmile,
  HelpCircle,
  Loading02,
  MinusCircle,
  RefreshCw05,
  ShieldTick,
  Stars02,
  Target04,
  UserCheck01,
  XCircle,
} from "@untitledui/icons";
import type { AnalysisStatus } from "@how-about-me/contracts";
import type { ConfidenceBand, RelevanceLabel, SafetyLevel, SentimentLabel } from "@how-about-me/taxonomy";
import { Badge, BadgeWithIcon } from "@/components/base/badges/badges";
import {
  analysisStatusBadge,
  confidenceMarker,
  relevanceBadge,
  safetyBadge,
  sentimentBadge,
  type BadgeSpec,
} from "@/lib/semantics/badges";

/**
 * Semantic badges — docs/01-product/09-ux-specification.md §2.2.
 *
 * The rule the whole design leans on: **colour is never the only encoding**. Every badge renders an
 * icon *and* a text label, so the four analysis dimensions stay readable for colour-blind users and in
 * a black-and-white print of a report (NFR-035).
 *
 * The value → label/colour/icon mapping lives in `@/lib/semantics/badges` (pure, unit-tested); this file
 * only resolves the icon name to a component and picks the Untitled UI variant.
 */

type IconComponent = typeof FaceSmile;

const ICONS: Record<string, IconComponent> = {
  FaceSmile,
  FaceNeutral,
  FaceFrown,
  ShieldTick,
  AlertTriangle,
  AlertOctagon,
  Target04,
  HelpCircle,
  MinusCircle,
  Clock,
  Loading02,
  CheckCircle,
  XCircle,
  RefreshCw05,
};

export type BadgeSize = "sm" | "md" | "lg";

export function SemanticBadge({ spec, size = "sm" }: { spec: BadgeSpec; size?: BadgeSize }) {
  const Icon = ICONS[spec.icon] ?? HelpCircle;
  // `filled` (severe) uses the solid badge variant so it still stands out next to a row of pills.
  return (
    <BadgeWithIcon type={spec.filled ? "color" : "pill-color"} color={spec.color} size={size} iconLeading={Icon}>
      {spec.label}
    </BadgeWithIcon>
  );
}

export const SentimentBadge = ({ value, size }: { value: SentimentLabel; size?: BadgeSize }) => (
  <SemanticBadge spec={sentimentBadge[value]} size={size} />
);

export const SafetyBadge = ({ value, size }: { value: SafetyLevel; size?: BadgeSize }) => (
  <SemanticBadge spec={safetyBadge[value]} size={size} />
);

export const RelevanceBadge = ({ value, size }: { value: RelevanceLabel; size?: BadgeSize }) => (
  <SemanticBadge spec={relevanceBadge[value]} size={size} />
);

export const AnalysisStatusBadge = ({ value, size }: { value: AnalysisStatus; size?: BadgeSize }) => (
  <SemanticBadge spec={analysisStatusBadge[value]} size={size} />
);

/**
 * BR-020/BR-021: confidence is an uncalibrated prioritisation signal, so `high` shows nothing at all —
 * marking every row would train people to ignore the marker that actually matters.
 */
export function ConfidenceMarker({ band, size = "sm" }: { band: ConfidenceBand; size?: BadgeSize }) {
  const marker = confidenceMarker[band];
  if (!marker.show) return null;
  return (
    <Badge type="pill-color" color={band === "low" ? "warning" : "gray"} size={size}>
      <span title="Estimated model confidence — used for prioritisation, not a probability">{marker.label}</span>
    </Badge>
  );
}

/** P1 (T-143): shows whether the displayed value comes from the model or from an analyst override (BR-025). */
export function ValueSourceBadge({ source, size = "sm" }: { source: "ai" | "analyst"; size?: BadgeSize }) {
  return source === "ai" ? (
    <BadgeWithIcon type="pill-color" color="gray" size={size} iconLeading={Stars02}>
      AI
    </BadgeWithIcon>
  ) : (
    <BadgeWithIcon type="pill-color" color="brand" size={size} iconLeading={UserCheck01}>
      Analyst
    </BadgeWithIcon>
  );
}
