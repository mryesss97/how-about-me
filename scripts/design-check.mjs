#!/usr/bin/env node
// `pnpm design:check` — design/figma docs ↔ apps/web code sync (#403). Part of `pnpm verify`.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkComponents, checkRoutes, checkTokens, cssVars, routeOf } from "./lib/design-check.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = join(root, "apps/web/src");
const read = (p) => readFileSync(join(root, p), "utf8");

const vars = new Set([
  ...cssVars(read("apps/web/src/styles/theme.css")),
  ...cssVars(read("apps/web/src/styles/globals.css")),
]);

const exists = (rel) => [rel, `${rel}.tsx`, `${rel}.ts`].some((p) => existsSync(join(web, p)));

function pages(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return pages(p);
    return e.name === "page.tsx" ? [relative(join(web, "app"), p)] : [];
  });
}
const routes = pages(join(web, "app"))
  .map(routeOf)
  .filter((r) => r !== null);

const problems = [
  ...checkTokens(read("design/figma/tokens/TOKENS.md"), vars),
  ...checkComponents(read("design/figma/COMPONENTS.md"), exists),
  ...checkRoutes(read("design/figma/TRACKING.md"), routes),
];

if (problems.length) {
  console.error(`❌ design:check — ${problems.length} chỗ lệch giữa design/figma và code:\n` + problems.join("\n"));
  process.exit(1);
}
console.log(`✅ design:check — ${routes.length} route, token và component trong design/figma khớp code.`);
