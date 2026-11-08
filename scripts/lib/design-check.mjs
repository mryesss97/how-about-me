// Keeps design/figma/* in sync with the shipped web app (#403, design/figma/WORKFLOW.md §4–5):
// tokens named in TOKENS.md exist in the CSS, component paths in COMPONENTS.md exist, every route has a TRACKING row.

/** CSS custom properties declared in a stylesheet (`--name:`). */
export function cssVars(css) {
  return new Set([...css.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)].map((m) => m[1]));
}

/** `--token` names in backticks. `--color-brand-*` → prefix check. A bare prefix like `--color-` is prose, skipped. */
export function tokenRefs(md) {
  return [...md.matchAll(/`(--[a-zA-Z0-9_-]+(?:-\*)?)`/g)].map((m) => m[1]).filter((r) => !r.endsWith("-"));
}

/** Problems for token references that no stylesheet declares. */
export function checkTokens(md, vars) {
  const problems = [];
  for (const ref of tokenRefs(md)) {
    const ok = ref.endsWith("-*") ? [...vars].some((v) => v.startsWith(ref.slice(0, -1))) : vars.has(ref);
    if (!ok) problems.push(`TOKENS.md: ${ref} không có trong theme.css hoặc globals.css`);
  }
  return problems;
}

/** `components/…` and `features/…` paths in backticks. */
export function componentPaths(md) {
  return [...md.matchAll(/`((?:components|features)\/[a-zA-Z0-9_./-]+)`/g)].map((m) => m[1]);
}

/** Problems for component paths missing under apps/web/src. `exists(rel)` is injected for tests. */
export function checkComponents(md, exists) {
  return componentPaths(md)
    .filter((p) => !exists(p))
    .map((p) => `COMPONENTS.md: apps/web/src/${p} không tồn tại`);
}

/**
 * Route of a Next.js page file relative to `src/app` (`(app)/mentions/[id]/page.tsx` → `/mentions/[id]`).
 * Route groups `(x)` drop out. Returns null for dev-only routes.
 */
export function routeOf(pageFile) {
  const parts = pageFile
    .split("/")
    .slice(0, -1)
    .filter((s) => !/^\(.*\)$/.test(s));
  const route = "/" + parts.join("/");
  return route === "/dev" || route.startsWith("/dev/") ? null : route;
}

/** Problems for routes with no backticked mention in TRACKING.md. */
export function checkRoutes(md, routes) {
  return routes
    .filter((r) => !md.includes("`" + r + "`"))
    .map((r) => `TRACKING.md: route ${r} chưa có dòng (thêm vào bảng Trạng thái section)`);
}
