# 04 · Bug Report Guideline

Use the GitHub **Bug report** issue template. Required fields:

1. **Title**: `[area] short description` — e.g. `[collector] partial job resets last_successful_sync_at`.
2. **Environment**: staging/local, build sha (from footer or `/health/live.version`), role used.
3. **Steps to reproduce**: numbered, exact filters/URLs/ids.
4. **Expected** vs **Actual** (quote docs: FR/BR/metric id).
5. **Evidence**: screenshot/GIF, `requestId` from the error card, job/run id, log excerpt (redacted).
6. **Severity** (Sev-1…4 per test plan) and **Priority** label.
7. **Related**: test case id, issue/PR that introduced (if known).

Triage within 1 business day (Tech Lead + QC). Fix PRs reference the bug (`Fixes #n`) and add a regression test when feasible. QC verifies on staging and closes.
