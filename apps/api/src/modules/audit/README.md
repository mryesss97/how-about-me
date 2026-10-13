# audit module

Append-only audit log (FR-200/201, T-059). Design: [docs/02-architecture/08-security-secrets.md §6](../../../../../docs/02-architecture/08-security-secrets.md), API [05-api-contract.md §11](../../../../../docs/02-architecture/05-api-contract.md).

- Import `AuditModule` and inject `AuditService`. Call `record` from services (not controllers):
  `await audit.record({ projectId, actorUserId, action: "query.created", entityType: "query", entityId, metadata: { changes }, requestId }, tx)`, with `requestId` taken in the controller via `@RequestId()` (`common/logging/request-id.decorator.ts`).
- Pass `tx` when the mutation runs in a transaction so both commit/fail together; without `tx` failures only log `warn`.
- Metadata is sanitized by `sanitizeAuditMetadata` (allow-list + secret-key deny pattern, depth/size caps). Never pass raw provider payloads.
- `GET /projects/:projectId/audit-logs` is admin-only and read-only; there is no update/delete.
- List pagination: keyset `(created_at, id) DESC` evaluated in SQL via `common/pagination/created-at-keyset.ts`; cursor = `encodeSortCursor` sort `created_desc` with the µs `created_at` key, so rows inside one millisecond are never skipped (#188).
