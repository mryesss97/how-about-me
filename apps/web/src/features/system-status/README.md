System Status (`/system-status`, T-060 #55, UX §3.6) — see docs/02-architecture/03-frontend-design.md §1.

- `api.ts` — `useSystemStatus` (30 s poll), `useSyncJobs`, `useSyncJob`, `useRetrySyncJob`, `retryErrorMessage`.
- `format.ts` — status → label/tone maps (BR-017), lag, project-tz day bounds → UTC.
- `use-status-params.ts` — URL state (`tab`, `queryId`, `status`, `from`, `to`, `job`).
- `system-status-view.tsx` — page body + tabs; `overview-cards.tsx`, `status-plate.tsx`, `updated-ago.tsx`.
- `sync-jobs-tab.tsx`, `sync-jobs-filters.tsx`, `sync-jobs-table.tsx`, `sync-job-drawer.tsx` (admin retry, FR-175).
