/** TanStack Query key factories — docs/02-architecture/03-frontend-design.md §2 */
export const qk = {
  me: () => ["me"] as const,
  projects: () => ["projects"] as const,
  project: (pid: string) => ["project", pid] as const,
  overview: (pid: string, filters: unknown) => ["project", pid, "analytics", "overview", filters] as const,
  timeseries: (pid: string, filters: unknown) => ["project", pid, "analytics", "timeseries", filters] as const,
  distribution: (pid: string, kind: string, filters: unknown) => ["project", pid, "analytics", kind, filters] as const,
  mentions: (pid: string, filters: unknown) => ["project", pid, "mentions", filters] as const,
  mention: (pid: string, id: string) => ["project", pid, "mention", id] as const,
  queries: (pid: string, filters?: unknown) => ["project", pid, "listening-queries", filters ?? {}] as const,
  syncJobs: (pid: string, filters?: unknown) => ["project", pid, "sync-jobs", filters ?? {}] as const,
  systemStatus: (pid: string) => ["project", pid, "system-status"] as const,
  integration: (pid: string) => ["project", pid, "integrations", "threads"] as const,
  members: (pid: string) => ["project", pid, "members"] as const,
  auditLogs: (pid: string, filters?: unknown) => ["project", pid, "audit-logs", filters ?? {}] as const,
};

/** staleTime per resource (ms) — docs/02-architecture/02-backend-design.md caching notes */
export const staleTimes = {
  overview: 30_000,
  systemStatus: 10_000,
  mentions: 15_000,
  queries: 15_000,
  me: 60_000,
} as const;
