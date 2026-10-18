import { Injectable } from "@nestjs/common";
import type { Platform } from "@how-about-me/contracts";
import { ProviderError } from "../../../common/errors/provider.error";
import {
  buildScenarios,
  CHANGED_TEXT,
  DEFAULT_SCENARIO_KEY,
  type ScenarioDefinition,
  type ScenarioFailure,
} from "./__fixtures__/threads-scenarios";
import type {
  ConnectionInfo,
  ProviderContext,
  ProviderItem,
  RefreshedToken,
  SearchInput,
  SearchPage,
  SocialDiscoveryProvider,
} from "./social-discovery.provider";

/**
 * Offline Threads adapter used when `PROVIDERS_MODE=fake` (T-013) — docs/02-architecture/02-backend-design.md §10.
 *
 * The scenario is chosen by the listening query's `query_value`, so a test or a local seed selects a
 * behaviour just by creating a query: `1zone` / `eventista` return the happy-path dataset, `fake-429`,
 * `fake-401`, `fake-malformed` … reproduce one failure mode each.
 *
 * It keeps per-scenario counters so "fail once then succeed" and "text changes on the second run" are
 * reproducible; `reset()` clears them between tests. No network, no token, no randomness.
 */
@Injectable()
export class FakeThreadsProvider implements SocialDiscoveryProvider {
  readonly platform: Platform = "threads";

  /** Provider calls per scenario, used by `transientFailure`. */
  private readonly calls = new Map<string, number>();
  /** Runs (first page fetched) per scenario, used by `changesTextOnRerun`. */
  private readonly runs = new Map<string, number>();

  constructor(private readonly clock: () => Date = () => new Date()) {}

  reset(): void {
    this.calls.clear();
    this.runs.clear();
  }

  /** Scenario keys a developer can use as a `query_value`, with what each one does. */
  listScenarios(): { key: string; description: string }[] {
    return [...buildScenarios(this.clock()).values()].map((s) => ({ key: s.key, description: s.description }));
  }

  async search(input: SearchInput, _ctx: ProviderContext): Promise<SearchPage> {
    const now = this.clock();
    const scenario = this.resolveScenario(input.query, now);
    const calls = (this.calls.get(scenario.key) ?? 0) + 1;
    this.calls.set(scenario.key, calls);

    if (scenario.fatalFailure) throw toProviderError(scenario.fatalFailure);
    if (scenario.malformed)
      throw new ProviderError("THREADS_MALFORMED_RESPONSE", "Response body is not valid JSON", {
        providerStatus: 200,
        details: { sample: '{"data":[{"id":' },
      });
    if (scenario.transientFailure && calls <= scenario.transientFailure.count)
      throw toProviderError(scenario.transientFailure);

    const pageIndex = parseCursor(input.cursor);
    if (scenario.failOnPage && scenario.failOnPage.index === pageIndex) throw toProviderError(scenario.failOnPage);
    if (pageIndex === 0) this.runs.set(scenario.key, (this.runs.get(scenario.key) ?? 0) + 1);

    const page = scenario.pages[pageIndex] ?? [];
    const items = this.applyRunMutation(scenario, page).filter((item) => withinWindow(item, input));
    const hasMore = pageIndex + 1 < scenario.pages.length;

    return {
      items: input.limit ? items.slice(0, input.limit) : items,
      ...(hasMore ? { nextCursor: `fake-page-${pageIndex + 1}` } : {}),
      rateLimit: {
        remaining: Math.max(0, 200 - calls),
        resetAt: new Date(now.getTime() + 3_600_000),
        raw: { "x-app-usage": `{"call_count":${calls}}` },
      },
      requestDurationMs: 12,
    };
  }

  /**
   * Token sentinels (T-038, TC-INT-005): a token starting with `fake-invalid` behaves like an expired
   * token (401), `fake-forbidden` like one missing scopes (403). Any other token verifies.
   */
  async verifyConnection(ctx: ProviderContext): Promise<ConnectionInfo> {
    if (ctx.accessToken.startsWith("fake-invalid"))
      throw new ProviderError("THREADS_UNAUTHORIZED", "Threads token is invalid or expired", { providerStatus: 401 });
    if (ctx.accessToken.startsWith("fake-forbidden"))
      throw new ProviderError("THREADS_FORBIDDEN", "Threads token lacks required permissions", {
        providerStatus: 403,
      });
    return {
      accountIdentifier: "fake_brand_account",
      grantedScopes: ["threads_basic", "threads_keyword_search"],
      tokenExpiresAt: new Date(this.clock().getTime() + 60 * 86_400_000),
    };
  }

  /**
   * FR-046 test double (T-040): token `fake-invalid*` → 401, `fake-forbidden*` → 403, otherwise a new
   * token valid for 60 days. The real Threads refresh endpoint is not confirmed by the POC yet.
   */
  async refreshToken(ctx: ProviderContext): Promise<RefreshedToken> {
    await this.verifyConnection(ctx);
    return {
      accessToken: `fake-refreshed-${this.clock().getTime()}`,
      tokenExpiresAt: new Date(this.clock().getTime() + 60 * 86_400_000),
    };
  }

  private resolveScenario(query: string, now: Date): ScenarioDefinition {
    const scenarios = buildScenarios(now);
    const key = query.trim().toLowerCase().replace(/^#+/, "");
    return scenarios.get(key) ?? (scenarios.get(DEFAULT_SCENARIO_KEY) as ScenarioDefinition);
  }

  /** `fake-changed-text`: the same post id comes back with new text from the second run on (TC-COL-013). */
  private applyRunMutation(scenario: ScenarioDefinition, page: ProviderItem[]): ProviderItem[] {
    if (!scenario.changesTextOnRerun || (this.runs.get(scenario.key) ?? 0) < 2) return page;
    return page.map((item, index) => (index === 0 ? { ...item, text: CHANGED_TEXT } : item));
  }
}

function toProviderError(failure: ScenarioFailure) {
  return new ProviderError(failure.code, failure.message, {
    ...(failure.providerStatus !== undefined ? { providerStatus: failure.providerStatus } : {}),
    ...(failure.retryAfterMs !== undefined ? { retryAfterMs: failure.retryAfterMs } : {}),
  });
}

function parseCursor(cursor?: string): number {
  const match = /^fake-page-(\d+)$/.exec(cursor ?? "");
  return match ? Number(match[1]) : 0;
}

/**
 * The real API may or may not honour `since`/`until` (open question in doc §11), so the fake filters
 * client-side exactly like the collector's fallback path — a fixture post outside the window is not returned.
 */
function withinWindow(item: ProviderItem, input: SearchInput): boolean {
  const published = new Date(String(item["timestamp"] ?? ""));
  if (Number.isNaN(published.getTime())) return true; // invalid-item fixtures must reach the normalizer
  if (input.since && published < input.since) return false;
  if (input.until && published > input.until) return false;
  return true;
}
