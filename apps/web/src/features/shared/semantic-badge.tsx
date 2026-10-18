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
import { cx } from "@/utils/cx";
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

type SizeProps = { size?: BadgeSize; className?: string };

export function SemanticBadge({ spec, size = "sm", className }: { spec: BadgeSpec } & SizeProps) {
  const Icon = ICONS[spec.icon] ?? HelpCircle;
  // `filled` (severe) uses the solid badge variant so it still stands out next to a row of pills.
  return (
    <BadgeWithIcon
      type={spec.filled ? "color" : "pill-color"}
      color={spec.color}
      size={size}
      iconLeading={Icon}
      className={className}
    >
      {spec.label}
    </BadgeWithIcon>
  );
}

export const SentimentBadge = ({ value, size, className }: { value: SentimentLabel } & SizeProps) => (
  <SemanticBadge spec={sentimentBadge[value]} size={size} className={className} />
);

export const SafetyBadge = ({ value, size, className }: { value: SafetyLevel } & SizeProps) => (
  <SemanticBadge spec={safetyBadge[value]} size={size} className={className} />
);

export const RelevanceBadge = ({ value, size, className }: { value: RelevanceLabel } & SizeProps) => (
  <SemanticBadge spec={relevanceBadge[value]} size={size} className={className} />
);

export const AnalysisStatusBadge = ({ value, size }: { value: AnalysisStatus; size?: BadgeSize }) => (
  <SemanticBadge spec={analysisStatusBadge[value]} size={size} />
);

/**
 * BR-020/BR-021: confidence is an uncalibrated prioritisation signal, so `high` shows nothing at all —
 * marking every row would train people to ignore the marker that actually matters.
 */
export function ConfidenceMarker({
  band,
  size = "sm",
  variant = "full",
}: {
  band: ConfidenceBand;
  size?: BadgeSize;
  /** UX §2.2 (#337): `compact` renders medium as a gray "≈" with the full label as accessible name. */
  variant?: "full" | "compact";
}) {
  const marker = confidenceMarker[band];
  if (!marker.show) return null;
  const hint = "Độ tin cậy ước tính của mô hình — dùng để ưu tiên xem lại, không phải xác suất";
  if (variant === "compact" && band === "medium") {
    return (
      <span
        role="img"
        aria-label={`${marker.label} — ${hint}`}
        title={`${marker.label} — ${hint}`}
        className="text-sm font-medium text-tertiary"
      >
        {marker.short}
      </span>
    );
  }
  return (
    <Badge type="pill-color" color={band === "low" ? "warning" : "gray"} size={size}>
      <span title={hint}>{variant === "compact" ? marker.short : marker.label}</span>
    </Badge>
  );
}

/** P1 (T-143): shows whether the displayed value comes from the model or from an analyst override (BR-025). */
export function ValueSourceBadge({ source, size = "sm" }: { source: "ai" | "analyst"; size?: BadgeSize }) {
  // #338: AI is the default source, so it reads as quiet muted text (still labelled, FR-194 / BR-017);
  // the analyst pill stays prominent because it marks the exception.
  return source === "ai" ? (
    <span
      className={cx("inline-flex items-center gap-1 font-medium text-tertiary", size === "lg" ? "text-sm" : "text-xs")}
    >
      <Stars02 className="size-3" aria-hidden />
      AI
    </span>
  ) : (
    <BadgeWithIcon type="pill-color" color="brand" size={size} iconLeading={UserCheck01}>
      Chuyên viên
    </BadgeWithIcon>
  );
}
