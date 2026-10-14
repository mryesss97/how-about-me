Shared URL-synced filters (nuqs) for Overview & Mentions (T-098). Full description: docs/02-architecture/03-frontend-design.md §4.

- `useFilters(target)` → `{ filters, setFilters, reset, apiParams }` (client only).
- `toApiParams(filters, { target, now })` → API query params (`tz` → `timezone`, CSV arrays, sorted keys).
- `toMentionsHref(filters, extra)` → drill-down link with the resolved range pinned as `custom`.
- `drill-down.ts` (T-102, FR-142): `kpiDrillDown`, `segmentDrillDown` (null for topic `other`; language `other` → `language=other`, #201), `bucketDrillDown` (`[start, nextStart)` clamped to the range) → `extra` for `toMentionsHref`.
- `resolveRange`, `calendarRangeToInstants`, `validateRange`, `expectedInterval`, `timezoneChangePatch` (keeps calendar dates on tz change, #240) — pure time helpers.
- `filtersCache` (`./cache`) — read filters in Server Components.
