// Tests for the design/figma ↔ code sync check (#403, design/figma/WORKFLOW.md §4–5).
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkComponents, checkRoutes, checkTokens, cssVars, routeOf, tokenRefs } from "./lib/design-check.mjs";

const css = `@theme { --color-brand-500: rgb(14 165 233); --color-bg-primary: var(--color-white); }
.sign-wall { --wall: #d9e6ef; }`;

test("cssVars reads declarations, not var() uses", () => {
  const vars = cssVars(css);
  assert.ok(vars.has("--color-brand-500") && vars.has("--wall"));
  assert.ok(!vars.has("--color-white"));
});

test("tokens: exact names and -* prefixes pass, unknown names fail", () => {
  const vars = cssVars(css);
  assert.deepEqual(checkTokens("`--color-bg-primary` `--color-brand-*` `--wall`", vars), []);
  assert.deepEqual(checkTokens("`--color-bg-nope`", vars), [
    "TOKENS.md: --color-bg-nope không có trong theme.css hoặc globals.css",
  ]);
  assert.deepEqual(checkTokens("`--color-utility-*`", vars).length, 1);
});

test("tokenRefs ignores unquoted names and bare prefixes", () => {
  assert.deepEqual(tokenRefs("--spacing and `--wall` and prefix `--color-`"), ["--wall"]);
});

test("components: missing paths are reported", () => {
  const md = "`components/base/buttons/button.tsx` `features/shared/gone.tsx` `components/application/pagination`";
  const have = new Set(["components/base/buttons/button.tsx", "components/application/pagination"]);
  assert.deepEqual(
    checkComponents(md, (p) => have.has(p)),
    ["COMPONENTS.md: apps/web/src/features/shared/gone.tsx không tồn tại"],
  );
});

test("routeOf drops route groups and dev pages", () => {
  assert.equal(routeOf("page.tsx"), "/");
  assert.equal(routeOf("(app)/mentions/[id]/page.tsx"), "/mentions/[id]");
  assert.equal(routeOf("(public)/login/page.tsx"), "/login");
  assert.equal(routeOf("(app)/dev/ui/page.tsx"), null);
});

test("routes: every route needs a backticked TRACKING mention", () => {
  const md = "| J4 | `/mentions` |\n| J5 | `/mentions/[id]` |";
  assert.deepEqual(checkRoutes(md, ["/mentions", "/mentions/[id]"]), []);
  assert.deepEqual(checkRoutes("`/mentions/[id]`", ["/mentions"]), [
    "TRACKING.md: route /mentions chưa có dòng (thêm vào bảng Trạng thái section)",
  ]);
});
