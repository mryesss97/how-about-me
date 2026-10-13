// Tests for `pnpm audit:check` allowlist logic (T-003, NFR-061).
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "./lib/audit-check.mjs";

const report = (severity) => ({
  advisories: { 1: { github_advisory_id: "GHSA-aaaa", severity, module_name: "next", title: "t" } },
});

test("high advisory not allowlisted fails", () => {
  assert.equal(evaluate(report("high"), {}, "2026-10-13").ok, false);
});

test("allowlisted and unexpired passes", () => {
  const r = evaluate(report("critical"), { "GHSA-aaaa": { expires: "2026-11-14" } }, "2026-10-13");
  assert.equal(r.ok, true);
});

test("expired allowlist entry fails", () => {
  assert.equal(evaluate(report("high"), { "GHSA-aaaa": { expires: "2026-10-01" } }, "2026-10-13").ok, false);
});

test("moderate only passes; stale entry warns", () => {
  const r = evaluate(report("moderate"), { _comment: "x", "GHSA-bbbb": { expires: "2026-11-14" } }, "2026-10-13");
  assert.equal(r.ok, true);
  assert.equal(r.warnings.length, 1);
});

test("real .audit-allowlist.json entries have package, reason and YYYY-MM-DD expiry", async () => {
  const { readFile } = await import("node:fs/promises");
  const list = JSON.parse(await readFile(new URL("../.audit-allowlist.json", import.meta.url), "utf8"));
  for (const [id, entry] of Object.entries(list)) {
    if (id.startsWith("_")) continue;
    assert.ok(typeof entry.package === "string" && entry.package.length > 0, `${id} package`);
    assert.ok(typeof entry.reason === "string" && entry.reason.trim().length > 0, `${id} reason`);
    assert.match(entry.expires, /^\d{4}-\d{2}-\d{2}$/, `${id} expires`);
  }
});
