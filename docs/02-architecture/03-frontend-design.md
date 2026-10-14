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
│     ├─ mentions/layout.tsx (children + @detail slot) · mentions/page.tsx · mentions/[id]/page.tsx (full page)
│     ├─ mentions/@detail/default.tsx · mentions/@detail/page.tsx (null, closes the slide-out on soft nav to `/mentions`, #250) · mentions/@detail/(.)[id]/page.tsx (intercepted slide-out, T-104)
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
│  ├─ query/                     TanStack Query client + key factories + infinite-list helpers
│  ├─ filters/                   URL state (nuqs) schema shared by overview & mentions
│  ├─ time/                      timezone formatting (date-fns-tz), presets → ranges
│  ├─ format/                    number formatting for KPIs (count, rate or "—", growth/"New", pp delta)
│  └─ semantics/                 badge mappings for sentiment/safety/relevance/status
├─ providers/                    theme, router (Untitled UI), query provider
├─ hooks/ · utils/               from Untitled UI (+ ours)
└─ styles/                       globals.css, theme.css (Untitled UI tokens), typography.css
```

Feature folders never import from each other, except `features/auth` (session, current project, role), which any feature may use. Shared code lives in `features/shared` (UI and shared hooks, e.g. `OverviewBanners`, `DetailSlideout`, `useOverview`, `SettingsDialog`) or `lib/` (e.g. `lib/query/infinite-list.ts` with `isRejectedCursor` / `flattenUnique`). Route files in `app/` compose features (e.g. the Mentions page renders the analytics `FilterBar`; the Reviews route injects `MentionDetail` into `ReviewsView` via `renderDetail`, #233). The boundary is enforced by `no-restricted-imports` in `apps/web/eslint.config.mjs` (#236): a feature may import only itself, `features/shared` and `features/auth`; `shared` and `auth` may import only each other. Untitled UI `components/` are treated as vendor-ish: modifications minimal and documented.

## 2. Rendering & data strategy

- App Router; the authenticated shell is a Server Component that reads the Supabase session cookie (`@supabase/ssr`) to redirect unauthenticated users to `/login`.
- All product data via **TanStack Query** in Client Components (dashboards are highly interactive). Query keys: `['project', pid, 'analytics', 'overview', filters]`, `['project', pid, 'mentions', filters]` (an infinite query: the opaque cursor lives in `pageParam`, never in the key or URL; a cursor rejected with 400 on `cursor` resets the list to page 1; T-103), `['project', pid, 'mention', id]` (detail; polls every 5 s while the analysis is pending/processing; re-analyze invalidates it, the mentions list and the review queue; T-104), `['project', pid, 'reviews', { reason, status }]` (review queue, infinite like mentions, `count=true` on page 1; invalidated by override create/revoke, re-analyze and mark-reviewed; mark-reviewed removes rows optimistically from cached unreviewed queues and rolls back on error; #219), etc. `staleTime`: overview 30 s, system status 10 s, mentions and reviews 15 s (refetch on window focus).
- Mutations invalidate the minimal key set; optimistic toggles for enable/disable.
- Mutation pattern (first set in `features/settings/api.ts`, T-036): one `useXxx(pid)` hook per endpoint, body validated with the contract schema before sending, responses parsed with the contract schema. Project PATCH sets `['project', pid]` and invalidates `['me']` (name/timezone/settings live there) plus `['project', pid, 'analytics']` when the timezone changed. Member mutations invalidate `['project', pid, 'members']`, and `['me']` when the caller changed their own membership. Analysis settings (`['project', pid, 'settings', 'analysis']`): the PATCH response is written with `setQueryData`; nothing else is invalidated. `errorMessage(err)` maps `ApiError.code` (`LAST_ADMIN`, `MEMBER_EXISTS`, `FORBIDDEN_*`) to copy; other codes show `message` + `requestId`.
- Feedback: success → `sonner` toast (single `<Toaster/>` in `app/layout.tsx`); validation and conflict errors stay inline next to the field.
- No server-side duplication of client queries (avoid double fetch).

## 3. Authentication in FE

- `@supabase/ssr` browser client with **anon key** only (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- API client injects `Authorization: Bearer <access_token>`; on `401 AUTH_TOKEN_EXPIRED` → `supabase.auth.refreshSession()` once → retry → else redirect `/login?reason=expired`.
- `src/proxy.ts` (Next 16 proxy): refreshes the Supabase cookie via `getUser()` on every request; unauthenticated non-public paths → `/login?next=<path>`, signed-in `/login` → `/overview`. Any Supabase error counts as signed out.
- `(app)/layout.tsx` is a second server-side guard (`getUser()`, `force-dynamic`) and mounts `AuthBridge`, which registers the token getter and a **deduped** refresh handler (concurrent 401s share one `refreshSession()`; retry exactly once).
- Login (`features/auth/login-form.tsx`): generic "Invalid email or password", banner for `reason=expired`, no sign-up link, Google button only when `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` → `/auth/callback` (`exchangeCodeForSession`). `next` is sanitised (`safe-next.ts`: must resolve to a same-origin path via `new URL`, no `//` or `\`, never `/login` or `/auth/*`).
- Sign out = `supabase.auth.signOut()` + `queryClient.clear()` + `location.replace("/login")` (no history entry with data, TC-AUTH-016).
- `AuthBridge` registers the token getter synchronously on first render (child effects such as `useMe` run before the parent's effects, so registering in `useEffect` sent the first `GET /me` without a bearer).
- `/me` result cached in `useMe()`. `CurrentProjectProvider` (mounted by `AuthBridge`) + `useCurrentProject()` hold the selected project: `localStorage["ham.projectId"]` if still a membership, else `projects[0]`; `null` when the user has no project. The project switcher renders only with ≥ 2 projects (FR-036).
- `useRole(projectId?)` (defaults to the current project) → `{ role, settings, hasRole }`. `ROUTE_ROLES` + `canAccess(path, role)` in `features/auth/route-roles.ts` is the single source for sidebar, settings tabs and page guards (FR-018): `/settings/members` admin; `/settings/integrations` admin + analyst; undeclared routes all roles.
- `<RequireRole roles={[...]} fallback?>`: allowed → children; denied → full-page `ForbiddenState` (or `fallback`, e.g. `null` to hide an action); loading → skeleton (never flashes forbidden); `/me` error → `ErrorState`; no project → "You are not a member of any project." `(app)/layout.tsx` wraps every page in `<RequireProject>`, which shows the same state once `/me` returns zero memberships (loading/errors pass through to the page). UX only — the server remains the authority (FR-015, BR-033).
- CI check: build output must not contain `SUPABASE_SERVICE_ROLE`, `THREADS_`, `OPENAI_` strings (script `scripts/check-fe-secrets.mjs`).

## 4. Filters & URL state

Layout `apps/web/src/lib/filters/`:

- `schema.ts` — `Filters` type (`preset, from, to, tz, queryIds[], relevance[], sentiment[], safety[], intent[], topic[], language[], analysisStatus[], phrase[], q, sort, compare`), `PRESETS` (`1h, 24h, 7d, 30d, custom`), default preset **`7d`**, default relevance `[relevant]` (BR-016). Enums come from `@how-about-me/taxonomy` / `contracts`, never redefined.
- `parsers.ts` — `nuqs` parsers (`filterParsers`, `serializeFilters`); `clearOnDefault`, `history: "replace"`. Arrays are CSV. Invalid enum values / UUIDs are dropped, `phrase` values are normalised with `normalizePhrase` (BR-041, same as the API; invalid/too long dropped — `phrase` has a removable chip "Phrase: …" but no picker, #243), an invalid `tz` falls back to `NEXT_PUBLIC_DEFAULT_TIMEZONE`. `cache.ts` exposes `filtersCache` for Server Components.
- `time-range.ts` — `resolveRange` (relative presets slide with `now`; **only `preset` is stored in the URL**, so reload re-resolves; custom stores `from`/`to` instants), `calendarRangeToInstants` (calendar days → 00:00 of start day … 00:00 of day after end day **in the selected tz**), `validateRange` (≤ `MAX_RANGE_DAYS`), `expectedInterval` (display-only mirror of FR-135), `timezoneChangePatch` (tz change on a custom range keeps the **calendar dates**: a range whose ends are both 00:00 in the old tz is re-read as `[from 00:00, to+1 00:00)` in the new tz; exact-instant ranges such as hour drill-downs and relative presets only change `tz`; one URL patch for `tz`/`from`/`to`, #240, UX §2.1).
- `api-params.ts` — `toApiParams(filters, { target: "analytics" | "mentions", now })`: maps `tz` → API `timezone`, drops `preset`, CSV arrays, omits empty arrays, always sends `relevance`, `compare` only for analytics, `q`/`sort` only for mentions, keys sorted (stable query key). `toMentionsHref(filters, extra)` builds drill-down links (FR-142) pinned as `preset=custom` with the resolved range and no `compare`. `appliedChips` / `removeFilterValue` back the removable chips. `timeField` is not exposed in the MVP (server default). The Mentions list pins the resolved range until the URL filters change (`usePinnedParams` in `features/mentions/mentions-view.tsx`): relative presets re-resolve every minute, and re-keying the infinite query would drop loaded pages mid-scroll (T-103).
- `use-filters.ts` — `useFilters(target)` → `{ filters, setFilters, reset, apiParams }`; `now` floored to the minute.

UI: `features/analytics/filter-bar.tsx` (+ `time-controls.tsx`, `enum-multi-select.tsx`, `applied-filter-chips.tsx`), rendered inside `<Suspense>` on Overview (`showCompare`) and Mentions. Query options are passed in as props. Timezone picker lists `Intl.supportedValuesOf("timeZone")` with `Asia/Ho_Chi_Minh` and `UTC` pinned first.

## 5. Charts

Recharts via Untitled UI `application/charts/charts-base.tsx` wrappers. Rules: colours from theme tokens (`--color-utility-*`), each series has a text label & pattern for safety; tooltips show count, share, denominator; "View as table" renders a `Table` with the same data; click handlers call `router.push(toMentionsHref(...))`.

Implementation pattern (T-100, `features/analytics/charts/`): every chart is wrapped in `ChartCard` (title, "View as table" `ToggleButton` with `aria-pressed`, per-chart `QueryState` so one failing chart never blanks the page, explicit empty state per BR-032) and tooltips use `MetricTooltip`. Charts are loaded lazily via `next/dynamic({ ssr: false })` with a fixed-height skeleton (`charts/index.ts`). Bucket labels use the bucketing timezone (response `timezone`, else the filter `tz`), never the browser's. Compare ghost series (dashed "Previous period") exists only on Mentions over time — `SentimentResponse` carries no previous-period data. Click-through drill-down is T-102.

Exception (#222): the Sentiment map is not Recharts — `d3-hierarchy` (`packSiblings`, ≥ 3.1.2 for deterministic output) computes the layout in `charts/bubble-layout.ts`, bubbles are HTML buttons styled in `globals.css` (`.bubble-3d`), idle/hover/grow-in motion animates only `transform`/`opacity` (re-layout also eases the radius via `width`/`height`) and is disabled via `usePrefersReducedMotion` (`data-motion`) and the `prefers-reduced-motion` media query. `ChartCard` gained optional `viewToggle` (segmented chart | table), `toolbar` (shown in both modes) and `footer`. Still lazy-loaded. #243: `BubbleDatum.key` is a `string`; adapters `toTopicBubbles` (humanised topic) and `toPhraseBubbles` (verbatim phrase); `bubble-mode.tsx` holds the Topics | Phrases toggle and empty-state selection; `ChartCard` gained optional `emptyDescription`.

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

### 6.1 Theme & brand (brand v2, #221)

Source: official brand pack v2 — guide in [`docs/assets/brand/brand-guide-v2.pdf`](../assets/brand/brand-guide-v2.pdf). Tokens live in `apps/web/src/styles/theme.css`.

| Brand v2                            | Untitled UI token                                         | Light                                      | Dark                                  |
| ----------------------------------- | --------------------------------------------------------- | ------------------------------------------ | ------------------------------------- |
| Brand scale (Tailwind sky, 25..950) | `--color-brand-*`                                         | sky; 500 `#0EA5E9`, 700 `#0369A1`          | same scale                            |
| Action Blue (primary button)        | `--color-bg-brand-solid` / `_hover`                       | brand-700 / 800 (white text ≈ 5.9:1)       | brand-700 / 800                       |
| Brand text / fg                     | `--color-text-brand-tertiary`, `--color-fg-brand-primary` | brand-700                                  | unchanged                             |
| Focus ring                          | `--color-focus-ring`                                      | brand-600 (≥ 3:1 on white)                 | brand-500 (≈ 7:1 on neutral-950)      |
| Mist (page bg)                      | `--color-bg-secondary`                                    | `#F5FBFF`                                  | neutral-900 (unchanged)               |
| Ink (primary text)                  | `--color-text-primary`                                    | `#15344B` (≈ 12:1 on white)                | neutral-50 (unchanged)                |
| Sidebar active item (#245)          | `nav-item.tsx` only (not `bg-active` / `bg-secondary`)    | brand-100 bg + brand-700 text/icon (5.2:1) | brand-500/15 bg + brand-300 (≈ 9.5:1) |

Page backgrounds use `bg-secondary` (Mist): the login page, and in light mode the app shell `<main>` (`(app)/layout.tsx`) and the sticky filter bar, which keep `bg-primary` in dark mode (`dark:bg-primary`) so dark cards do not sit on a lighter page. Cards and the sidebar stay `bg-primary` (white).

Error/success/warning, gray scale and the sentiment/safety palettes are not brand colours and are unchanged (BR-017). Charts using `utility-brand-*` follow the sky scale.

Logo: `features/shared/brand-logo.tsx` (`horizontal | stacked | mark`) renders the official primary SVG in light mode and the white SVG under `.dark-mode`; files in `apps/web/public/brand/`. Used in the sidebar and mobile header (horizontal, 180 px wide — the guide minimum) and on the login page (stacked). Icons use Next file conventions: `src/app/favicon.ico`, `icon.svg`, `apple-icon.png` (180). `viewport.themeColor` = Mist (light) / `#0C0E12` (dark).

Illustrations (#245): `features/shared/state-illustration.tsx` (`empty | pending | sync-attention`, 360×240) renders `public/brand/illustrations/{name}.svg` in light mode and `{name}-dark.svg` under `.dark-mode`, decorative (`alt=""`, `aria-hidden`), max 240/280 px wide. Opt-in via `EmptyState illustration` / `QueryState emptyIllustration`; the default (FeaturedIcon) stays for chart cards and widgets. The pack has no dark files, so dark variants map colours: Mist panel → `#13161B` (neutral-900), white card → `#0C0E12`, Light Blue `#BAE6FD` → brand-800 `#075985`, Sky `#0EA5E9` kept, clock hand `#0369A1` → brand-300, warning `#FFFAEB`/`#FEDF89`/`#B54708` → `#2B1D06`/`#93370D`/`#FDB022`.

## 7. Error handling & states

`lib/api` throws `ApiError {code, message, requestId, status}`. Feature components use `<QueryState query={...} empty={...} />` helper rendering skeleton / error card (with requestId + retry) / empty state, per UX §2.3. Banners derive from overview `coverage` + `dataQuality`.

## 8. Accessibility & i18n

React Aria primitives; every icon-only button has `aria-label`; charts have table fallback. Copy in English for MVP; strings centralised in `features/*/copy.ts` to allow VI later (first one: `features/analytics/copy.ts`, #222, keeps the VI prototype labels as comments).

## 9. Performance

- Route-level code splitting; charts lazy-loaded (`next/dynamic`) below the fold.
- `optimizePackageImports` for `@untitledui/icons`.
- Lists: 25/page + "Load more"; virtualisation deferred until needed.
- Avoid waterfalls: overview widgets fetch in parallel with one filters object.

## 10. Testing

Vitest + Testing Library for `lib/` and feature components (badge mapping, filter ↔ URL, drill-down href, KPI formatting incl. `New` state). Playwright smoke: login → overview → filter → open mention → role restrictions, against `PROVIDERS_MODE=fake` API.
Auth fixtures (`auth.setup.ts`, `asRole` in `e2e/fixtures.ts`) and how to run: `10-testing-strategy.md` §4.
