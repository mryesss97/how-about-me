/** Audit actions — docs/02-architecture/08-security-secrets.md §6 (FR-200). */
export const AUDIT_ACTIONS = [
  "project.updated",
  "member.added",
  "member.role_changed",
  "member.removed",
  "integration.updated",
  "integration.verified",
  "integration.disconnected",
  "integration.refresh_failed",
  "query.created",
  "query.updated",
  "query.enabled",
  "query.disabled",
  "query.deleted",
  "query.restored",
  "query.run_requested",
  "query.backfill_requested",
  "analysis.reanalyze_requested",
  "analysis.bulk_reanalyze_requested",
  "analysis.retry_requested",
  "override.created",
  "override.revoked",
  "review.marked",
  "mentions.exported",
  "analysis_settings.updated",
  "data.purged",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Generic metadata allow-list (MVP decision: one list for every action). */
export const AUDIT_METADATA_ALLOW_LIST: ReadonlySet<string> = new Set([
  "changes",
  "before",
  "after",
  "fields",
  "role",
  "previousRole",
  "queryValue",
  "queryType",
  "since",
  "until",
  "jobId",
  "runId",
  "effectiveVersion",
  "count",
  "postIds",
  "filters",
  "format",
  "rowCount",
  "field",
  "value",
  "reason",
  "status",
  "errorCode",
  "name",
  "email",
  "enabled",
  "scope",
  "counts",
  "platformPostId",
]);

/** Secret-looking keys are always dropped, even when allow-listed or nested (FR-200: no secrets in audit). */
export const AUDIT_METADATA_DENY =
  /token|secret|password|api[_-]?key|authorization|ciphertext|private|service[_-]?role|credential|cookie|^key$/i;
export const AUDIT_MAX_DEPTH = 3;
export const AUDIT_MAX_STRING = 500;
export const AUDIT_MAX_BYTES = 4096;

export type AuditMetadata = Record<string, unknown>;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);

const isScalar = (v: unknown) => v === null || ["string", "number", "boolean"].includes(typeof v);

function clean(value: unknown, depth: number): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.length > AUDIT_MAX_STRING ? value.slice(0, AUDIT_MAX_STRING) : value;
  if (value instanceof Date) return value.toISOString();
  // A list of scalars is a leaf value (e.g. `changes["settings.landingTerms"].to`, #261), kept at the max depth.
  if (Array.isArray(value) && value.every(isScalar)) return value.map((v) => clean(v, depth));
  if (depth >= AUDIT_MAX_DEPTH) return undefined;
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1)).filter((v) => v !== undefined);
  if (isPlainObject(value)) {
    // Nested objects (e.g. before/after) keep arbitrary keys but secret-looking keys are still dropped.
    const out: AuditMetadata = {};
    for (const [k, v] of Object.entries(value)) {
      if (AUDIT_METADATA_DENY.test(k)) continue;
      const c = clean(v, depth + 1);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  return undefined;
}

/**
 * Sanitizes audit metadata (FR-200): top-level keys must be allow-listed, secret-like keys are dropped at any depth,
 * depth ≤ 3 (a list of scalars counts as a leaf), strings ≤ 500 chars, total JSON ≤ 4 KB (otherwise `{ truncated: true }`).
 */
export function sanitizeAuditMetadata(input: unknown): AuditMetadata | null {
  if (!isPlainObject(input)) return null;
  const out: AuditMetadata = {};
  for (const [k, v] of Object.entries(input)) {
    if (!AUDIT_METADATA_ALLOW_LIST.has(k) || AUDIT_METADATA_DENY.test(k)) continue;
    const c = clean(v, 1);
    if (c !== undefined) out[k] = c;
  }
  if (Object.keys(out).length === 0) return null;
  if (Buffer.byteLength(JSON.stringify(out), "utf8") > AUDIT_MAX_BYTES) return { truncated: true };
  return out;
}
