Shared URL-synced filters (nuqs) for Overview & Mentions (T-098). Full description: docs/02-architecture/03-frontend-design.md §4.

- `useFilters(target)` → `{ filters, setFilters, reset, apiParams }` (client only).
- `toApiParams(filters, { target, now })` → API query params (`tz` → `timezone`, CSV arrays, sorted keys).
- `toMentionsHref(filters, extra)` → drill-down link with the resolved range pinned as `custom`.
- `resolveRange`, `calendarRangeToInstants`, `validateRange`, `expectedInterval` — pure time helpers.
- `filtersCache` (`./cache`) — read filters in Server Components.
