// Audit actions (docs/02-architecture/08-security-secrets.md §6) live in contracts so the web filter shares them.
import { AUDIT_ACTIONS, type AuditAction } from "@how-about-me/contracts";
export { AUDIT_ACTIONS, type AuditAction };

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
  "sourceJobId",
  "queryId",
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
