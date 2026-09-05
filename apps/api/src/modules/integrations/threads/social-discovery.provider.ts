import type { Platform, SearchMode, SearchType } from "@how-about-me/contracts";

/** Provider-neutral discovery contract — docs/02-architecture/06-ingestion-pipeline.md §2 (ADR-0006). Implemented in T-039 (real) / T-013 (fake). */
export interface SocialDiscoveryProvider {
  readonly platform: Platform;
  search(input: SearchInput, ctx: ProviderContext): Promise<SearchPage>;
  verifyConnection(ctx: ProviderContext): Promise<ConnectionInfo>;
}

export type SearchInput = {
  query: string;
  searchMode: SearchMode;
  searchType: SearchType;
  since?: Date;
  until?: Date;
  limit?: number;
  cursor?: string;
};
export type ProviderItem = Record<string, unknown> & { id?: string; timestamp?: string; text?: string };
export type RateLimitInfo = { remaining?: number; resetAt?: Date; raw?: Record<string, string> };
export type SearchPage = {
  items: ProviderItem[];
  nextCursor?: string;
  rateLimit?: RateLimitInfo;
  requestDurationMs: number;
};
export type ProviderContext = { accessToken: string; requestId: string; projectId: string };
export type ConnectionInfo = { accountIdentifier: string | null; grantedScopes: string[]; tokenExpiresAt: Date | null };

export const SOCIAL_DISCOVERY_PROVIDER = Symbol("SOCIAL_DISCOVERY_PROVIDER");
