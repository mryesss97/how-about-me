import type { ListeningQuery } from "@how-about-me/contracts";

let n = 0;
const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

export function queryFixture(over: Partial<ListeningQuery> = {}): ListeningQuery {
  n += 1;
  return {
    id: uuid(n),
    displayName: `Query ${n}`,
    queryValue: "concert",
    queryType: "keyword",
    searchMode: "KEYWORD",
    scheduledSearchType: "RECENT",
    enabled: true,
    excludeTerms: [],
    includeTerms: [],
    pollIntervalSeconds: 600,
    overlapSeconds: 1200,
    initialBackfillDays: 1,
    nextRunAt: null,
    lastRunAt: "2026-10-13T03:00:00.000Z",
    lastSuccessfulSyncAt: "2026-10-13T03:00:00.000Z",
    lastError: null,
    lastJob: {
      id: uuid(9000 + n),
      status: "success",
      recordsFetched: 1234,
      recordsInserted: 56,
      completedAt: "2026-10-13T03:00:00.000Z",
    },
    matchedPosts: { total: 4321, last24h: 12 },
    createdBy: { id: uuid(8000), displayName: "An Admin" },
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    deletedAt: null,
    ...over,
  };
}
