# Incident notes

Post-incident records for How About Me. Linked from [runbook §10](../02-runbook.md#10-incident-notes).

- **File name:** `YYYY-MM-DD-<slug>.md` (date the incident started, UTC), copied from [\_template.md](_template.md).
- **Severity:**
  - **SEV1** — product unusable or data loss/leak (all sync stopped, secret exposed, wrong purge). Note required.
  - **SEV2** — major degradation (sync lag > 1 h, analysis paused, missing data window). Note required.
  - **SEV3** — minor / self-healed (single job failures, short circuit open). Note optional.
- **No secrets or PII:** never paste tokens, keys, user emails or raw post content; redact log samples.
- **Times:** UTC first, `Asia/Ho_Chi_Minh` in brackets.
- Action items link to GitHub issues.
