System Status (`/system-status`, T-060 #55, UX §3.6) — see docs/02-architecture/03-frontend-design.md §1.

- `api.ts` — `useSystemStatus` (30 s poll), `useSyncJobs`, `useSyncJob`, `useRetrySyncJob`, `useFailedAnalysisRuns`, `useRetryAnalysisRun`, `useRetryAllFailedAnalysis`, `useAuditLogs`, `retryErrorMessage`.
- `format.ts` — status → label/tone maps (BR-017), lag, project-tz day bounds → UTC.
- `use-status-params.ts` — URL state (`tab`, `queryId`, `status`, `from`, `to`, `job`, `action`).
- `system-status-view.tsx` — page body + tabs; `overview-cards.tsx`, `status-plate.tsx`, `updated-ago.tsx`.
- `sync-jobs-tab.tsx`, `sync-jobs-filters.tsx`, `sync-jobs-table.tsx`, `sync-job-drawer.tsx` (admin retry, FR-175).
- `analysis-failures-tab.tsx`, `analysis-failures-table.tsx`, `retry-all-dialog.tsx` — "Lỗi phân tích" tab (T-106 #93, FR-175, BR-024): per-run retry + retry all ≤ 500 (admin).
- `audit-log-tab.tsx`, `audit-log-filters.tsx`, `audit-log-table.tsx` — "Nhật ký thao tác" tab (T-061 #56, FR-201), admin-only, expandable metadata.
