import { notFound } from "next/navigation";
import { ANALYSIS_STATUSES, CONFIDENCE_BAND_VALUES } from "@how-about-me/contracts";
import { RELEVANCE_LABELS, SAFETY_LEVELS, SENTIMENT_LABELS } from "@how-about-me/taxonomy";
import {
  AnalysisPendingBanner,
  IntegrationExpiredBanner,
  PageBanner,
  SyncFailedBanner,
} from "@/features/shared/page-banner";
import { EmptyState, ErrorState, ForbiddenState, SkeletonBlock } from "@/features/shared/query-state";
import {
  AnalysisStatusBadge,
  ConfidenceMarker,
  RelevanceBadge,
  SafetyBadge,
  SentimentBadge,
  ValueSourceBadge,
} from "@/features/shared/semantic-badge";

export const metadata = { title: "UI gallery (dev)" };

/**
 * Every shared component on one page, so a designer or reviewer can check the badge/state/banner set
 * against docs/01-product/09-ux-specification.md §2 without clicking through half-built screens —
 * and so a regression in the theme is obvious at a glance.
 *
 * Not available in production builds: it is a development aid, not a product screen.
 */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-display-xs font-semibold text-primary">UI gallery</h1>
        <p className="text-md text-tertiary">
          Shared badges, states and banners — UX specification §2. Development only.
        </p>
      </header>

      <Section title="Semantic badges (§2.2)" note="Colour is never the only encoding: icon + text label always.">
        <Row label="Sentiment">
          {SENTIMENT_LABELS.map((v) => (
            <SentimentBadge key={v} value={v} />
          ))}
        </Row>
        <Row label="Safety">
          {SAFETY_LEVELS.map((v) => (
            <SafetyBadge key={v} value={v} />
          ))}
        </Row>
        <Row label="Relevance">
          {RELEVANCE_LABELS.map((v) => (
            <RelevanceBadge key={v} value={v} />
          ))}
        </Row>
        <Row label="Analysis status">
          {ANALYSIS_STATUSES.map((v) => (
            <AnalysisStatusBadge key={v} value={v} />
          ))}
        </Row>
        <Row label="Confidence">
          {CONFIDENCE_BAND_VALUES.map((band) => (
            <span key={band} className="flex items-center gap-2 text-xs text-tertiary">
              {band}: <ConfidenceMarker band={band} />
              {band === "high" ? <em>(no marker by design)</em> : null}
            </span>
          ))}
        </Row>
        <Row label="Value source (P1)">
          <ValueSourceBadge source="ai" />
          <ValueSourceBadge source="analyst" />
        </Row>
      </Section>

      <Section title="Page banners (§2.3)" note="Qualify every number on the page, so they sit above the content.">
        <div className="flex flex-col gap-3">
          <SyncFailedBanner />
          <AnalysisPendingBanner count={124} />
          <IntegrationExpiredBanner canManage />
          <IntegrationExpiredBanner />
          <PageBanner tone="info" title="Generic banner" description="Any tone, title and description." />
        </div>
      </Section>

      <Section
        title="Widget states (§2.3)"
        note="'0 mentions', 'sync failed' and 'analysis pending' are distinct (BR-032)."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Loading">
            <SkeletonBlock lines={4} />
          </Card>
          <Card title="Empty">
            <EmptyState
              title="No relevant mentions found in this period."
              description="Try widening the time range or clearing some filters."
            />
          </Card>
          <Card title="Error">
            <ErrorState
              error={{
                code: "INTERNAL",
                message: "Analytics service is temporarily unavailable.",
                requestId: "0199325e-4d2a-7c31-9f07-2f6d0a8b1c44",
              }}
            />
          </Card>
          <Card title="Forbidden">
            <ForbiddenState />
          </Card>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">{title}</h2>
        <p className="text-sm text-tertiary">{note}</p>
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-secondary py-2 last:border-b-0">
      <span className="w-40 shrink-0 text-sm text-secondary">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-secondary bg-primary p-4">
      <h3 className="text-sm font-semibold text-secondary">{title}</h3>
      {children}
    </div>
  );
}
