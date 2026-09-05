#!/usr/bin/env node
// Fails if the built Next.js bundle contains server-only secret patterns. Run after `pnpm --filter web build`.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "apps/web/.next");
const FORBIDDEN = [
  /SUPABASE_SERVICE_ROLE_KEY/,
  /service_role/i,
  /\bsk-[A-Za-z0-9]{20,}/,
  /OPENAI_API_KEY/,
  /THREADS_APP_SECRET/,
  /INTEGRATION_ENCRYPTION_KEYS/,
  /DATABASE_URL/,
];
if (!existsSync(outDir)) {
  console.error(`No build output at ${outDir}. Run the web build first.`);
  process.exit(2);
}

const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (p.includes(`${join(".next", "cache")}`)) continue;
    statSync(p).isDirectory() ? walk(p) : /\.(js|json|html|txt)$/.test(f) && files.push(p);
  }
})(outDir);
const hits = [];
for (const f of files) {
  const s = readFileSync(f, "utf8");
  for (const re of FORBIDDEN) if (re.test(s)) hits.push(`${f} ⇢ ${re}`);
}
if (hits.length) {
  console.error("❌ Forbidden secret patterns found in web build:\n" + hits.join("\n"));
  process.exit(1);
}
console.log(`✅ ${files.length} build files scanned, no forbidden patterns.`);
