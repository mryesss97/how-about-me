# 09 · UX Specification

| Field            | Value                                                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status           | Approved (baseline v1.0) — visual design in Untitled UI; no separate Figma required for MVP, wireframe descriptions below are normative                                                        |
| Source           | [00-source/01_PRODUCT_REQUIREMENTS.md](../00-source/01_PRODUCT_REQUIREMENTS.md) §11–§15, §19–§20 · [00-source/02_TECHNICAL_ARCHITECTURE.md](../00-source/02_TECHNICAL_ARCHITECTURE.md) §5, §23 |
| Component system | Untitled UI React (Tailwind v4, React Aria) — `apps/web/src/components/**`                                                                                                                     |

## 1. Information architecture & routes

```text
/login                          Public
/(app)                          Authenticated shell (sidebar + header)
├─ /overview                    Dashboard (default after login)
├─ /mentions                    Mentions Explorer
│  └─ /mentions/[id]            Mention detail (route; also opens as slide-out from list)
├─ /listening-queries           Query table + create/edit drawer
├─ /reviews                     Review queue (P1)
├─ /system-status               Threads / collector / analyzer / DB + Sync jobs tab + Audit tab (admin)
└─ /settings
   ├─ /settings/project         Name, timezone, toggles
   ├─ /settings/members         Members & roles (admin)
   ├─ /settings/integrations    Threads connection (admin write, others read)
   └─ /settings/analysis        Thresholds & versions (P1)
```

Sidebar (Untitled UI `sidebar-simple`): Overview · Mentions · Listening Queries · Reviews (P1) · System Status · Settings. Footer: account card (name, role badge, sign out). Project switcher appears only with ≥ 2 projects.

## 2. Global patterns

### 2.1 Filter bar (shared by Overview & Mentions)

- Sticky under the header. Order: **Time range** (preset segmented control + custom date-range picker + timezone select) · **Queries** (multi-select with `#` rendering for tags) · **Relevance** (default `Relevant`; chips `Relevant`, `Uncertain`, `Irrelevant`) · **Sentiment** · **Safety** · **Intent** · **Topic** · **Language** · **Analysis status** · "Compare with previous period" toggle (Overview only) · "Reset".
- All filters sync to the URL query string (`nuqs`). Changing a filter refetches all widgets.
- Applied filters show as removable chips under the bar.

### 2.2 Semantic badges (never colour alone)

| Dimension       | Value                                 | Badge (Untitled UI `Badge` with dot/icon + label)                  |
| --------------- | ------------------------------------- | ------------------------------------------------------------------ |
| Sentiment       | positive                              | success · icon `face-smile` · "Positive"                           |
|                 | neutral                               | gray · icon `face-neutral` · "Neutral"                             |
|                 | negative                              | error · icon `face-frown` · "Negative"                             |
| Safety          | safe                                  | gray · icon `shield-tick` · "Safe"                                 |
|                 | sensitive                             | warning · icon `alert-triangle` · "Sensitive"                      |
|                 | severe                                | error (filled) · icon `alert-octagon` · "Severe"                   |
| Relevance       | relevant / uncertain / irrelevant     | brand / warning / gray, text label                                 |
| Analysis status | pending / processing / failed / stale | gray dot / spinner / error `x-circle` / warning "Stale"            |
| Confidence      | high / medium / low                   | no badge / gray "≈" marker with tooltip / warning "Low confidence" |
| Source of value | AI / Analyst                          | prefix icon `stars-02` "AI" vs `user-check` "Analyst" (P1)         |

### 2.3 States (every data widget)

| State               | Pattern                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Loading             | Skeleton matching final layout; no spinners longer than 300 ms                                                   |
| Empty (no data)     | Empty-state illustration + "No relevant mentions found in this period." + CTA "Widen time range"                 |
| Sync failed         | Amber alert banner on top of page: "Latest Threads sync failed. Data may be incomplete." + link to System Status |
| Analysis pending    | Blue info banner: "124 mentions are waiting for analysis." (count from coverage)                                 |
| Integration expired | Red alert banner: "Threads connection needs attention." + link to Settings → Integrations (admin)                |
| Error               | Inline error card with `requestId` and "Retry"                                                                   |
| Forbidden           | Full-page "You don't have permission to view this page." + back link                                             |

Rule: never render "0 negative mentions" when `sentimentAnalyzed = 0`; render "—" with tooltip "No analysed mentions in range".

### 2.4 Tooltips & definitions

Every KPI and chart title has an info icon → tooltip with the definition and denominator from [07-metric-definitions.md](07-metric-definitions.md).

### 2.5 External links

Threads permalink: icon `link-external-01`, `target=_blank`, `rel=noopener noreferrer`, aria-label "Open on Threads (opens in new tab)".

### 2.6 Accessibility

Keyboard reachable filters/tables/drawers (React Aria); focus rings visible; charts expose data table via "View as table" toggle; contrast AA; badges include text.

## 3. Screens

### 3.1 Login (`/login`)

Centered card: logo, email + password, "Continue with Google" (if enabled), error text. No sign-up link. Footer: "Ask an admin for access."

### 3.2 Overview (`/overview`) — P0

Layout (12-col grid, 24 px gap):

1. **Banners row** (conditional): integration / sync / pending banners (2.3).
2. **KPI row**: 6 cards (2 rows × 3 on tablet). Card = label + info icon, big value, delta vs previous (arrow + %, or "New"), sub-text with denominator ("of 2,410 analysed").
3. **Mentions over time** (span 8) + **Sentiment distribution** donut (span 4).
4. **Sentiment over time** stacked bars (span 6) + **Safety distribution** horizontal bars (span 6).
5. **Top topics** horizontal bar (span 6) + **Intent distribution** horizontal bar (span 6).
6. P1 row: Language donut · Topic × sentiment heatmap · Negative-topic contributors.

Interactions: click a KPI → `/mentions` with filters; click a bar/segment → `/mentions` with `+dimension=value`; hover shows count, share, denominator; chart legend toggles series; "View as table" on each chart. Compare toggle draws ghost series/values.

Chart library: Recharts via Untitled UI `charts-base.tsx` wrappers; palette from theme tokens; patterns for safety chart.

### 3.3 Mentions Explorer (`/mentions`) — P0

- Filter bar (2.1) + search input (`q`, debounced 400 ms) + sort select (Newest, Oldest, Highest safety severity, Lowest confidence, Highest relevance).
- Header: "2,481 mentions" (total from `count=true`), export button (P1, role-gated).
- **List** (card rows, 25 per page, "Load more" + infinite scroll):
  - Row left: platform icon, `@username`, published time (relative + absolute on hover, tz), matched query chips.
  - Row middle: 2-line text preview (plain text, highlights `q`), summary in muted text if present.
  - Row right: sentiment badge, safety badge, up to 2 intent chips, up to 2 topic chips, language tag, confidence marker, analysis status badge (if not completed), external link icon.
  - Click row → opens detail slide-out (route `/mentions/[id]` also works full-page).
- Keyboard: `↑/↓` move focus, `Enter` opens detail, `Esc` closes.
- Empty states per 2.3.

### 3.4 Mention Detail (`/mentions/[id]`) — P0

Two-column (≥ 1024 px) or stacked:

- **Original**: full text (plain, links auto-detected as text with external icon), `@username`, published (tz), permalink button "Open on Threads", media metadata (type, thumbnail URL as image if allowed, alt text), quote/repost indicators, matched queries, first seen / last seen, revision.
- **Analysis** (tabs: _Current_, _History_):
  - Current: relevance (badge + confidence + explanation), sentiment (badge + confidence), safety (level badge + expandable category scores table), intents (chips + confidence), topics (chips + confidence), language, summary, overall confidence band, versions (provider/model/prompt/taxonomy/policy), analyzed_at. Analyst override values shown with "Analyst" badge and original AI value struck-through (P1).
  - History: table of runs (status, versions, analyzed_at, tokens, cost, error).
- **Operations** toolbar: Re-analyze (admin / analyst if allowed; confirm dialog; disabled while pending), Override (P1), Copy post ID, Copy permalink, Open on Threads.
- Status banner if latest run pending/failed with error code + Retry (admin).

### 3.5 Listening Queries (`/listening-queries`) — P0

- Header: title, "Show deleted" toggle, **+ Add query** (admin).
- Table (Untitled UI `table.tsx`): Query (display name + value with `#` for tags) · Type · Enabled (toggle, admin) · Poll interval · Overlap · Last sync (relative + status dot) · Last result (fetched/inserted) · Matched posts (24 h / all) · Last error (truncated, tooltip) · Created by · Actions (⋯ menu: Edit, Run now, Backfill (P1), View mentions, Disable/Enable, Delete/Restore).
- Create/Edit **drawer**: Display name · Query value (helper: "Enter without #") · Type (Keyword / Topic tag radio, disabled on edit) · Exclude terms (tag input) · Include terms (tag input, collapsed "Advanced") · Poll interval (number, seconds, presets 5/10/30/60 min) · Overlap (seconds, preset) · Initial backfill (days, 0–30) · Enabled toggle. Validation inline; duplicate → error toast with link to existing query.
- Run now → toast "Sync queued" with "View job". Delete → confirm dialog explaining soft delete.

### 3.6 System Status (`/system-status`) — P0

Tabs: **Overview** · **Sync jobs** · **Analysis failures** · **Audit log** (admin).

- Overview cards: Threads connection (status badge, account, scopes, expiry, last success/error, "Manage" link for admin) · Collector (status healthy/degraded/paused, active queries, last global sync, jobs in progress, failed 24 h, collection lag) · Analyzer (pending, processing, failed 24 h, lag, versions, tokens & est. cost 24 h) · Database (approx mentions, analyses, storage note). Auto-refresh 30 s with "Updated 12 s ago".
- Sync jobs tab: table with filters (query, status, date) → row click opens job detail drawer (window, pages, counters, requests, rate-limit events, error, cursor). Admin: "Retry" for failed.
- Analysis failures tab: failed runs list with error code, post link, "Retry" (admin), "Retry all failed (≤ 500)" (admin, confirm).
- Audit log tab (admin): actor, action, entity, time, metadata (expand).

### 3.7 Settings (`/settings/*`) — P0

- **Project**: name, timezone (searchable select), toggles `Allow analysts to re-analyze`, `Allow viewers to export`. Save → toast.
- **Members** (admin): table (name/email, role select, added, remove); "Invite member" dialog (email, role). Guard on last admin.
- **Integrations** (admin write): Threads card — status, account, scopes, expiry; "Update token" (password-style input, never prefilled), "Verify connection", "Disconnect". Everyone else sees read-only card without controls.
- **Analysis** (P1): confidence bands, safety thresholds table, current versions, "Create new policy version" with optional bulk re-analysis.

### 3.8 Reviews (`/reviews`) — P1

Queue of `uncertain`, low-confidence, failed items; tabs by reason; row → detail with override form (field, value, reason); "Mark reviewed".

## 4. Responsive behaviour

- ≥ 1280 px: full sidebar, 12-col grid.
- 768–1279 px: collapsed slim sidebar, charts 2-per-row → 1-per-row, tables horizontally scrollable.
- < 768 px: read-only Overview/Mentions acceptable; admin forms not optimised.

## 5. Copy guidelines

- Plain, factual, no blame ("Latest Threads sync failed" not "Something went wrong").
- Numbers use thousands separators; percentages 1 decimal; times relative (< 24 h) + absolute on hover.
- Timezone label shown next to time-range picker ("GMT+7 · Asia/Ho_Chi_Minh").
