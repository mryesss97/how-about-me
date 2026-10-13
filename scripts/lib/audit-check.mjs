// Pure logic for `pnpm audit:check` (docs/02-architecture/08-security-secrets.md §9).

const BLOCKING = new Set(["high", "critical"]);

/** Collects unique high/critical advisory ids from `pnpm audit --json` output. */
export function blockingAdvisories(report) {
  const out = new Map();
  for (const a of Object.values(report?.advisories ?? {})) {
    if (!BLOCKING.has(a.severity)) continue;
    const id = a.github_advisory_id ?? String(a.id);
    if (!out.has(id)) out.set(id, { id, severity: a.severity, module: a.module_name, title: a.title });
  }
  return [...out.values()];
}

/** Compares advisories with the allowlist. `today` is YYYY-MM-DD (UTC). */
export function evaluate(report, allowlist, today) {
  const entries = Object.fromEntries(Object.entries(allowlist ?? {}).filter(([k]) => !k.startsWith("_")));
  const advisories = blockingAdvisories(report);
  const errors = [];
  const warnings = [];
  const seen = new Set();
  for (const a of advisories) {
    seen.add(a.id);
    const entry = entries[a.id];
    if (!entry) errors.push(`${a.id} (${a.severity}, ${a.module}) not allowlisted: ${a.title}`);
    else if (!entry.expires || entry.expires < today)
      errors.push(`${a.id} (${a.module}) allowlist entry expired on ${entry.expires ?? "?"}`);
  }
  for (const id of Object.keys(entries)) if (!seen.has(id)) warnings.push(`${id} allowlisted but no longer reported`);
  return { ok: errors.length === 0, errors, warnings, total: advisories.length };
}
