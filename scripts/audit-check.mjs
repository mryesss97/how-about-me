#!/usr/bin/env node
// Blocks on high/critical `pnpm audit --prod` findings not covered by an unexpired .audit-allowlist.json entry.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate } from "./lib/audit-check.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let raw;
try {
  raw = execFileSync("pnpm", ["audit", "--prod", "--json"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (err) {
  // pnpm audit exits non-zero when findings exist; stdout still holds the JSON report.
  raw = err.stdout;
  if (!raw) throw err;
}
const allowlist = JSON.parse(readFileSync(resolve(root, ".audit-allowlist.json"), "utf8"));
const today = new Date().toISOString().slice(0, 10);
const { ok, errors, warnings, total } = evaluate(JSON.parse(raw), allowlist, today);
for (const w of warnings) console.warn(`::warning::${w}`);
if (!ok) {
  console.error("❌ pnpm audit (high+) blocking findings:\n" + errors.join("\n"));
  process.exit(1);
}
console.log(`✅ ${total} high/critical advisories, all allowlisted and unexpired.`);
