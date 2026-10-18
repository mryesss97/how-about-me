Feature folder — see docs/02-architecture/03-frontend-design.md §1 and the T-### tasks for this epic in docs/03-delivery/02-work-breakdown.md.

Settings (UX §3.7, T-036):

- `api.ts` — query/mutation hooks for project + members, `errorMessage()` code → copy map.
- `settings-tabs.tsx` — role-filtered tabs with active state (`aria-current`); guarded by unsaved changes.
- `unsaved-changes.tsx` — `UnsavedChangesProvider` (in the settings layout): dirty registry per board, tab-change confirm dialog, `beforeunload` (#347). Forms call `useRegisterDirty` via `SettingsSaveBar`; outside a provider the hooks are no-ops.
- `settings-save-bar.tsx` — `SettingsSaveBar`: clean disabled Save + "Chưa có thay đổi"; dirty sticky strip with "Huỷ thay đổi" (#347). `settings-read-only-note.tsx` — one admin-only note under the tabs.
- `project-settings.tsx` / `project-settings-form.tsx` — `/settings/project`; admins edit (diff-only PATCH), others read-only.
- `members-settings.tsx` / `members-table.tsx` / `invite-member-dialog.tsx` — `/settings/members` (admin): role change, remove with confirm, invite by email.
- Dialogs use `SettingsDialog` from `features/shared/settings-dialog`. `test-fixtures.ts` — test data.
- T-107: project permission toggles (`allowAnalystReanalyze`, `allowViewerExport`) show a short explanation; Save invalidates `/me` so the new permissions apply immediately.
- `analysis/` — `/settings/analysis` (FR-190, T-151b): bands + safety thresholds form (diff-only PATCH, per-cell errors), current versions, re-analysis prompt (admin only: dryRun preview → confirm mark-stale, FR-196); `phrase-threshold-form.tsx` "Sentiment map" section (`phraseMinMentions` via project PATCH, #251).
- `landing-terms-form.tsx` — Settings → Project "Landing page" section (`landingTerms` via project PATCH, FR-149, BR-042, #261); balloons data via `features/shared/use-landing-terms.ts`.
- `integrations/` — `/settings/integrations` (FR-043, FR-044, T-041): Threads card (status badge, account, scopes, expiry, last verify/success/error); admin: update token (password, never prefilled), verify (always refetches — a failed verify commits the new status), disconnect with confirm (optimistic, rollback); analyst read-only. `integrationErrorMessage()` maps Threads error codes.
