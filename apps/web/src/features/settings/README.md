Feature folder — see docs/02-architecture/03-frontend-design.md §1 and the T-### tasks for this epic in docs/03-delivery/02-work-breakdown.md.

Settings (UX §3.7, T-036):

- `api.ts` — query/mutation hooks for project + members, `errorMessage()` code → copy map.
- `settings-tabs.tsx` — role-filtered tabs with active state (`aria-current`).
- `project-settings.tsx` / `project-settings-form.tsx` — `/settings/project`; admins edit (diff-only PATCH), others read-only.
- `members-settings.tsx` / `members-table.tsx` / `invite-member-dialog.tsx` — `/settings/members` (admin): role change, remove with confirm, invite by email.
- `settings-dialog.tsx` — controlled modal shell. `test-fixtures.ts` — test data.
