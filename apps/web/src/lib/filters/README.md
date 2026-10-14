Shared URL-synced filters (nuqs) for Overview & Mentions (T-098). Full description: docs/02-architecture/03-frontend-design.md §4.

- `phrase` (#243, FR-148): CSV, normalised with `normalizePhrase` (BR-041), sent to analytics and mentions; chip only, no picker.
- `useFilters(target)` → `{ filters, setFilters, reset, apiParams }` (client only).
- `toApiParams(filters, { target, now })` → API query params (`tz` → `timezone`, CSV arrays, sorted keys).
- `toMentionsHref(filters, extra)` → drill-down link with the resolved range pinned as `custom`.
- `phraseMentionsHref(p)` (#250) → plain `/mentions?phrase=p` (page defaults) for mention-detail phrase chips.
- `drill-down.ts` (T-102, FR-142): `kpiDrillDown`, `segmentDrillDown` (null for topic `other`; language `other` → `language=other`, #201), `bucketDrillDown` (`[start, nextStart)` clamped to the range), `phraseSentimentDrillDown` (`phrase=p[&sentiment=s]`, #243) → `extra` for `toMentionsHref`.
- `resolveRange`, `calendarRangeToInstants`, `validateRange`, `expectedInterval`, `timezoneChangePatch` (keeps calendar dates on tz change, #240) — pure time helpers.
- `filtersCache` (`./cache`) — read filters in Server Components.
