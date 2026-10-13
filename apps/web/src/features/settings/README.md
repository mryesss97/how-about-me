Feature folder — see docs/02-architecture/03-frontend-design.md §1 and the T-### tasks for this epic in docs/03-delivery/02-work-breakdown.md.

Settings (UX §3.7, T-036):

- `api.ts` — query/mutation hooks for project + members, `errorMessage()` code → copy map.
- `settings-tabs.tsx` — role-filtered tabs with active state (`aria-current`).
- `project-settings.tsx` / `project-settings-form.tsx` — `/settings/project`; admins edit (diff-only PATCH), others read-only.
- `members-settings.tsx` / `members-table.tsx` / `invite-member-dialog.tsx` — `/settings/members` (admin): role change, remove with confirm, invite by email.
- `settings-dialog.tsx` — controlled modal shell. `test-fixtures.ts` — test data.
- T-107: project permission toggles (`allowAnalystReanalyze`, `allowViewerExport`) show a short explanation; Save invalidates `/me` so the new permissions apply immediately.
- `analysis/` — `/settings/analysis` (FR-190, T-151b): bands + safety thresholds form (diff-only PATCH, per-cell errors), current versions, re-analysis prompt (admin only: dryRun preview → confirm mark-stale, FR-196).
