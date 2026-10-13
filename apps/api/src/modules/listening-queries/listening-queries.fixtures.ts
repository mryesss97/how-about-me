import type { ListeningQueryRow } from "./listening-queries.repository";

/** Test fixture: a full listening_queries row. */
export function makeRow(over: Partial<ListeningQueryRow> = {}): ListeningQueryRow {
  const at = new Date("2026-10-01T00:00:00.000Z");
  return {
    id: "0199a3b4-0000-7000-8000-000000000001",
    projectId: "0199a3b4-0000-7000-8000-000000000002",
    platform: "threads",
    displayName: "Eventista",
    queryValue: "eventista",
    queryType: "keyword",
    searchMode: "KEYWORD",
    scheduledSearchType: "RECENT",
    enabled: true,
    excludeTerms: [],
    includeTerms: [],
    pollIntervalSeconds: 600,
    overlapSeconds: 1200,
    initialBackfillDays: 1,
    nextRunAt: at,
    lastRunAt: null,
    lastSuccessfulSyncAt: null,
    lastErrorAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    consecutiveFailures: 0,
    lockedAt: null,
    lockedBy: null,
    createdBy: "0199a3b4-0000-7000-8000-000000000003",
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
    ...over,
  };
}
