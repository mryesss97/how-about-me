#!/usr/bin/env node
// Fails if the web build env or the built Next.js bundle exposes server-only secrets.
// Run after `pnpm --filter web build`. Pass `--build-env` in CI to also reject server-only vars in the env.
// Docs: docs/02-architecture/08-security-secrets.md §9.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { scanEnv, scanText } from "./lib/fe-secrets.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "apps/web/.next");
const buildEnv = process.argv.includes("--build-env");

const envProblems = scanEnv(process.env, { buildEnv });
if (envProblems.length) {
  console.error("❌ Web build env exposes secrets:\n" + envProblems.join("\n"));
  process.exit(1);
}
if (!existsSync(outDir)) {
  console.error(`No build output at ${outDir}. Run the web build first.`);
  process.exit(2);
}

const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    // cache and the `next dev` output are not what ships; `next dev` bundles
    // supabase-js unminified, whose source names `service_role`.
    if (p.includes(join(".next", "cache")) || p.includes(join(".next", "dev"))) continue;
    statSync(p).isDirectory() ? walk(p) : /\.(js|json|html|txt)$/.test(f) && files.push(p);
  }
})(outDir);
const hits = [];
for (const f of files) {
  for (const h of scanText(readFileSync(f, "utf8"), process.env)) hits.push(`${f} ⇢ ${h}`);
}
if (hits.length) {
  console.error("❌ Forbidden secret patterns found in web build:\n" + hits.join("\n"));
  process.exit(1);
}
console.log(`✅ ${files.length} build files scanned, no forbidden patterns.`);
