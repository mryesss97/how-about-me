import type { z } from "zod";
import { ProviderError } from "../../../common/errors/provider.error";
import type {
  ConnectionInfo,
  ProviderContext,
  SearchInput,
  SearchPage,
  SocialDiscoveryProvider,
} from "./social-discovery.provider";
import { DebugTokenSchema, MeSchema, SearchResponseSchema } from "./threads-api.types";
import { malformed } from "./threads-error.mapper";
import { getThreadsJson, type FetchFn, type ThreadsJson } from "./threads-http";
import { parseRateLimit } from "./threads-rate-limit";

/** Fields requested from `keyword_search`; only these may land in `raw_data` (BR-038, doc 06 §2). */
export const THREADS_SEARCH_FIELDS = [
  "id",
  "media_type",
  "media_url",
  "permalink",
  "username",
  "text",
  "timestamp",
  "shortcode",
  "thumbnail_url",
  "is_quote_post",
  "quoted_post",
  "reposted_post",
  "has_replies",
  "alt_text",
  "link_attachment_url",
].join(",");

export type ThreadsDiscoveryOptions = {
  baseUrl: string;
  timeoutMs: number;
  fetchFn?: FetchFn;
  /** Injected in tests; `Date.now` in production. */
  clock?: () => number;
  userAgent?: string;
};

/**
 * Real Threads adapter (T-039) — docs/02-architecture/06-ingestion-pipeline.md §2.
 * FR-047: the rest of the app only sees `SocialDiscoveryProvider`. FR-082: errors mapped to `THREADS_*`.
 * FR-089: rate-limit headers surfaced as `rateLimit`. BR-036: the token never enters a URL (except Meta's
 * mandatory `input_token` on `/debug_token`), a log line or an error. No `refreshToken` (FR-046 unconfirmed).
 */
export class ThreadsDiscoveryProvider implements SocialDiscoveryProvider {
  readonly platform = "threads" as const;
  private readonly clock: () => number;

  constructor(private readonly opts: ThreadsDiscoveryOptions) {
    this.clock = opts.clock ?? Date.now;
  }

  async search(input: SearchInput, ctx: ProviderContext): Promise<SearchPage> {
    const path = "/keyword_search";
    const res = await this.get(path, ctx, {
      q: input.query.replace(/^#+/, ""),
      search_type: input.searchType,
      search_mode: input.searchMode,
      fields: THREADS_SEARCH_FIELDS,
      limit: input.limit !== undefined ? String(input.limit) : undefined,
      since: input.since ? String(Math.floor(input.since.getTime() / 1000)) : undefined,
      until: input.until ? String(Math.floor(input.until.getTime() / 1000)) : undefined,
      after: input.cursor,
    });
    const parsed = this.parse(SearchResponseSchema, res, path);
    // Follow `paging.cursors.after` only while `paging.next` says another page exists; never follow the `next` URL.
    const after = parsed.paging?.cursors?.after;
    const nextCursor = parsed.paging?.next && after ? after : undefined;
    const rateLimit = parseRateLimit(res.headers, new Date(this.clock()));
    return {
      items: parsed.data,
      ...(nextCursor ? { nextCursor } : {}),
      ...(rateLimit ? { rateLimit } : {}),
      requestDurationMs: res.durationMs,
    };
  }

  /** FR-045: `/me` for the account, then `/debug_token` for scopes and expiry (POC 2026-11-11). */
  async verifyConnection(ctx: ProviderContext): Promise<ConnectionInfo> {
    const me = this.parse(MeSchema, await this.get("/me", ctx, { fields: "id,username" }), "/me");
    const debugPath = "/debug_token";
    // Meta requires the inspected token as `input_token`; this URL is never logged nor put in an error (D7).
    const debug = this.parse(
      DebugTokenSchema,
      await this.get(debugPath, ctx, { input_token: ctx.accessToken }),
      debugPath,
    ).data;
    if (debug.is_valid === false)
      throw new ProviderError("THREADS_UNAUTHORIZED", "Threads reports the token as invalid", { providerStatus: 200 });
    return {
      accountIdentifier: me.username ?? me.id,
      grantedScopes: debug.scopes ?? [],
      tokenExpiresAt: debug.expires_at && debug.expires_at > 0 ? new Date(debug.expires_at * 1000) : null,
    };
  }

  private get(path: string, ctx: ProviderContext, params: Record<string, string | undefined>) {
    return getThreadsJson(path, params, {
      accessToken: ctx.accessToken,
      baseUrl: this.opts.baseUrl,
      timeoutMs: this.opts.timeoutMs,
      userAgent: this.opts.userAgent ?? "how-about-me-api",
      now: this.clock,
      ...(this.opts.fetchFn ? { fetchFn: this.opts.fetchFn } : {}),
    });
  }

  private parse<S extends z.ZodType>(schema: S, res: ThreadsJson, path: string): z.infer<S> {
    const result = schema.safeParse(res.body);
    if (!result.success) throw malformed(path, res.status, JSON.stringify(res.body) ?? "", "unexpected shape");
    return result.data;
  }
}
