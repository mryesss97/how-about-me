# export module

CSV export of the filtered mentions list (T-147, FR-180/181, FR-200, NFR-017). Contract: [api-contract §7 Export](../../../../../docs/02-architecture/05-api-contract.md).

- `csv.ts` — RFC 4180 cell/row serializer, BOM, CRLF, formula-injection guard.
- `mentions-csv.ts` — column definitions (`MentionListItem` → row) and `exportFilename`.
- `export-throttle.ts` — 5/min/user, DB-backed (per-user advisory xact lock + count of `mentions.exported` audit rows in 60 s). Not `@nestjs/throttler`: its tracker is per IP, it may run before the JWT guard, and in-memory storage does not hold across instances (same reasoning as T-145).
- `export.service.ts` — one short tx: throttle → `listPage(limit=cap)` (cap+1 rows ⇒ `413 EXPORT_TOO_LARGE`) → audit; then streams hydration + serialization in chunks of 500 outside the tx.

The route `GET projects/:projectId/mentions/export.csv` lives in `MentionsController` (declared above `:mentionId`, which would otherwise shadow it); `ExportService`/`ExportThrottle` are providers of `MentionsModule`. There is no separate `ExportModule`.
