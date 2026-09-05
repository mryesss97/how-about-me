# 03 · Frontend Design (Next.js + Untitled UI)

| Field  | Value                                                                                                                                                                                  |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status | Approved (baseline v1.0)                                                                                                                                                               |
| Source | [00-source/02_TECHNICAL_ARCHITECTURE.md](../00-source/02_TECHNICAL_ARCHITECTURE.md) §5, §12.2, §19, §23 · [../01-product/09-ux-specification.md](../01-product/09-ux-specification.md) |
| Code   | `apps/web`                                                                                                                                                                             |

## 1. Structure

```text
apps/web/src/
├─ app/
│  ├─ layout.tsx                 fonts, Theme, RouteProvider, QueryProvider
│  ├─ (public)/login/page.tsx
│  └─ (app)/                     authenticated shell (sidebar + header), guards
│     ├─ layout.tsx
│     ├─ overview/page.tsx
│     ├─ mentions/page.tsx · mentions/[id]/page.tsx
│     ├─ listening-queries/page.tsx
│     ├─ reviews/page.tsx (P1)
│     ├─ system-status/page.tsx
│     └─ settings/(project|members|integrations|analysis)/page.tsx
├─ components/                   Untitled UI components (base/, application/, foundations/) — generated, kept close to upstream
├─ features/                     product features (one folder per epic)
│  ├─ auth/                      supabase client, session hooks, role helpers, <RequireRole>
│  ├─ analytics/                 filter bar, KPI cards, charts, drill-down mapping
│  ├─ mentions/                  list, row, detail, badges mapping
│  ├─ listening-queries/         table, drawer form
│  ├─ system-status/
│  ├─ settings/
│  └─ reviews/ (P1)
├─ lib/
│  ├─ api/                       typed fetch client (contracts), error envelope handling, auth header injection
│  ├─ query/                     TanStack Query client + key factories
│  ├─ filters/                   URL state (nuqs) schema shared by overview & mentions
│  ├─ time/                      timezone formatting (date-fns-tz), presets → ranges
│  └─ semantics/                 badge mappings for sentiment/safety/relevance/status
├─ providers/                    theme, router (Untitled UI), query provider
├─ hooks/ · utils/               from Untitled UI (+ ours)
└─ styles/                       globals.css, theme.css (Untitled UI tokens), typography.css
```

Feature folders never import from each other except via `lib/`. Untitled UI `components/` are treated as vendor-ish: modifications minimal and documented.

## 2. Rendering & data strategy

- App Router; the authenticated shell is a Server Component that reads the Supabase session cookie (`@supabase/ssr`) to redirect unauthenticated users to `/login`.
- All product data via **TanStack Query** in Client Components (dashboards are highly interactive). Query keys: `['project', pid, 'analytics', 'overview', filters]`, `['project', pid, 'mentions', filters, cursor]`, etc. `staleTime`: overview 30 s, system status 10 s, mentions 15 s (refetch on window focus).
- Mutations invalidate the minimal key set; optimistic toggles for enable/disable.
- No server-side duplication of client queries (avoid double fetch).

## 3. Authentication in FE

- `@supabase/ssr` browser client with **anon key** only (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- API client injects `Authorization: Bearer <access_token>`; on `401 AUTH_TOKEN_EXPIRED` → `supabase.auth.refreshSession()` once → retry → else redirect `/login?reason=expired`.
- `/me` result cached in `useMe()`; `useRole(projectId)` drives `<RequireRole roles={[...]}>` for UI gating (server remains the authority).
- CI check: build output must not contain `SUPABASE_SERVICE_ROLE`, `THREADS_`, `OPENAI_` strings (script `scripts/check-fe-secrets.mjs`).

## 4. Filters & URL state

`lib/filters/schema.ts` (Zod) defines: `from, to, tz, preset, queryIds[], relevance[], sentiment[], safety[], intent[], topic[], language[], analysisStatus[], q, sort, compare`. `nuqs` parsers keep them in the URL; a `toApiParams(filters)` helper produces API query params; a `toMentionsHref(filters, extra)` helper builds drill-down links (FR-142).

## 5. Charts

Recharts via Untitled UI `application/charts/charts-base.tsx` wrappers. Rules: colours from theme tokens (`--color-utility-*`), each series has a text label & pattern for safety; tooltips show count, share, denominator; "View as table" renders a `Table` with the same data; click handlers call `router.push(toMentionsHref(...))`.

## 6. Components mapping (Untitled UI)

| Need                                          | Component                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| Shell                                         | `application/app-navigation/sidebar-navigation/sidebar-simple.tsx`             |
| Buttons, inputs, selects, toggles, checkboxes | `base/*`                                                                       |
| Date range                                    | `application/date-picker/date-range-picker.tsx`                                |
| Tables                                        | `application/table/table.tsx`                                                  |
| Tabs                                          | `application/tabs/tabs.tsx`                                                    |
| Modals / drawers                              | `application/modals/modal.tsx`, `application/slideout-menus/slideout-menu.tsx` |
| Badges/tags                                   | `base/badges/*`, `base/tags/*`                                                 |
| Empty/loading                                 | `application/empty-state/empty-state.tsx`, `application/loading-indicator/*`   |
| Pagination                                    | `application/pagination/*`                                                     |
| Tooltip                                       | `base/tooltip/tooltip.tsx`                                                     |

Missing components are added with `npx untitledui@latest add <name>` into the same folder (see [../06-engineering/01-local-setup.md](../06-engineering/01-local-setup.md)).

## 7. Error handling & states

`lib/api` throws `ApiError {code, message, requestId, status}`. Feature components use `<QueryState query={...} empty={...} />` helper rendering skeleton / error card (with requestId + retry) / empty state, per UX §2.3. Banners derive from overview `coverage` + `dataQuality`.

## 8. Accessibility & i18n

React Aria primitives; every icon-only button has `aria-label`; charts have table fallback. Copy in English for MVP; strings centralised in `features/*/copy.ts` to allow VI later.

## 9. Performance

- Route-level code splitting; charts lazy-loaded (`next/dynamic`) below the fold.
- `optimizePackageImports` for `@untitledui/icons`.
- Lists: 25/page + "Load more"; virtualisation deferred until needed.
- Avoid waterfalls: overview widgets fetch in parallel with one filters object.

## 10. Testing

Vitest + Testing Library for `lib/` and feature components (badge mapping, filter ↔ URL, drill-down href, KPI formatting incl. `New` state). Playwright smoke: login → overview → filter → open mention → role restrictions, against `PROVIDERS_MODE=fake` API.
