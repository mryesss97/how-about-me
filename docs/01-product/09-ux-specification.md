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
   ├─ /settings/integrations    Threads connection (admin write, analyst read; hidden from viewer)
   └─ /settings/analysis        Thresholds & versions (P1)
```

Sidebar (Untitled UI `sidebar-simple`): Overview · Mentions · Listening Queries · Reviews (P1) · System Status · Settings. Footer: account card (name, role badge, sign out). Project switcher appears only with ≥ 2 projects.

## 2. Global patterns

### 2.1 Filter bar (shared by Overview & Mentions)

- Sticky under the header. Order: **Time range** (preset segmented control + custom date-range picker + timezone select) · **Queries** (multi-select with `#` rendering for tags) · **Relevance** (default `Relevant`; chips `Relevant`, `Uncertain`, `Irrelevant`) · **Sentiment** · **Safety** · **Intent** · **Topic** · **Language** · **Analysis status** · "Compare with previous period" toggle (Overview only) · "Reset".
- Default time preset is **7d**. The timezone select lists all IANA zones with `Asia/Ho_Chi_Minh` and `UTC` pinned first. Custom ranges over 366 days show an inline error and are not applied.
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
2. **KPI row**: 6 cards (2 rows × 3 on tablet). Card = label + info icon, big value, delta vs previous (arrow + %, or "New"), sub-text with denominator ("of 2,410 analysed"). Mention Growth is its own card ("New" when the previous period had 0). Rate cards show a delta in percentage points ("+2.1 pp") only when Compare is on; delta colour is neutral (arrow only). Banners: `lastSyncStatus` failed/partial → sync-failed banner; `pendingMentions > 0` → pending banner; `integrationStatus ≠ connected` → integration banner (link for admins only).
3. **Mentions over time** (span 8) + **Sentiment distribution** donut (span 4).
4. **Sentiment over time** stacked bars (span 6) + **Safety distribution** horizontal bars (span 6).
5. **Top topics** horizontal bar (span 6) + **Intent distribution** horizontal bar (span 6).
6. P1 row: Language donut · Keyword share (horizontal bars) · Topic × sentiment heatmap · Negative-topic contributors.
   - Keyword share (T-150): one bar per query in "count · share"; overlap note always shown (a mention counts once under each matched query); table ends with a "Distinct mentions" row, no Total; click → `/mentions?queryIds=<id>`.

Interactions: click a KPI → `/mentions` with filters; click a bar/segment → `/mentions` with `+dimension=value`; hover shows count, share, denominator; chart legend toggles series; "View as table" on each chart. Compare toggle draws ghost series/values.

Chart library: Recharts via Untitled UI `charts-base.tsx` wrappers; palette from theme tokens; patterns for safety chart.

Chart details (T-100, decided 2026-10-13 on #87):

- Mentions over time: tooltip share = bucket ÷ all mentions in the range ("of N mentions"; "—" when N = 0). Compare draws a dashed "Previous period" line; a range with 0 mentions but a non-zero previous period still shows the chart.
- Sentiment donut: centre shows the denominator ("analysed"); the legend lists Positive · Neutral · Negative with their share as text. Sentiment over time: stacked bars, legend toggles series, tooltip share per bucket total.
- Ghost series only on Mentions over time: the sentiment API has no previous-period data.
- Bucket labels use the bucketing timezone (`hour` → `HH:mm dd/MM`, `day` → `dd/MM`). Each chart has its own loading, empty ("No mentions in this range") and error (request ID + Retry) state. "View as table" is a toggle button (`aria-pressed`), and long tables scroll inside the card.

Chart details (T-101, decided 2026-10-13 on #88):

- Safety, Top topics and Intent are horizontal bar charts; every bar prints "count · share" as text and the tooltip names the denominator.
- Safety: safe = gray solid, sensitive = warning diagonal stripes, severe = error dense dots; the legend shows the `safetyBadge` icon + label + share. No sentiment colours (BR-017). Its table ends with a Total row equal to the denominator (TC-DASH-014).
- Top topics: top 12 by distinct mentions, "Other" always last. Intent: all labels incl. zero counts, in API order. Neither table has a summed Total; the last row is the denominator ("Mentions with a topic / an intent"). When shares add up past 100 % a note explains that a mention can have several labels.
- Drill-down (T-102, FR-142): each KPI card is a link to `/mentions` with the doc 07 §6 filter (Sensitive + Severe → `safety=sensitive,severe`; the "N severe" line → `safety=severe`; Mention Growth → the current period, never the previous one). Clicking a bar, donut slice or time bucket opens the same list; the link pins the exact `from/to` sent to analytics, keeps all global filters (incl. relevance, BR-016) and drops `compare`. A segment value replaces the same filter key. Buckets map to `[bucketStart, nextBucketStart)`, the last one ends at the range `to`, clamped to the range. Topic `other` (top-12 remainder, no filter) and zero-count segments/buckets are not clickable. Language `other` drills down to `language=other`, which also matches codes outside the taxonomy (#201). Keyboard path: KPI cards and the first column of "View as table" rows are links.

Chart details (T-149, decided 2026-10-13 on #120):

- Layout: the P1 row is Language donut · Keyword share · Negative-topic contributors (4 + 4 + 4 columns); the Topic × sentiment heatmap takes a full row below. Both use one `topic-sentiment` request.
- Topic × sentiment heatmap: rows = all 12 topics in API order, columns Positive · Neutral · Negative + "With sentiment". Each cell prints "count · share" (share within the topic row) and its sentiment colour gets stronger with the share (colour is never the only cue, NFR-030; no safety colours, BR-017). Non-zero cells are links to `/mentions?topic=t&sentiment=s` (incl. `topic=other`); zero cells are plain text. "View as table": Topic, Positive, Neutral, Negative, With sentiment, Negative share; the topic column links to `topic=t`; no Total row (multi-label). Empty state "No analysed mentions in this range".
- Negative-topic contributors: red horizontal bars, only topics with negative mentions, ranked by negative count then negative share; label "count · negative share", tooltip names the topic denominator ("with sentiment in this topic"). Click → `/mentions?topic=t&sentiment=negative`. Empty state "No negative mentions in this range".

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
- Implementation notes (T-147): "Export CSV" button (secondary, sm) next to the sort select, hidden when `!canExport` (admin, analyst; viewer only with `allowViewerExport`). Exports the current filters, search and sort (same pinned params as the visible list). Toasts: success "Export ready"; 413 "Too many mentions to export — Exports are limited to N rows. Narrow the date range or filters."; 429 "Export limit reached. Try again in N seconds."; 403 "You don't have permission to export."; other errors generic + request ID.
- Implementation notes (T-146, FR-196): "Re-analyze" button (secondary, sm, admin only — analysts never see it, even with `allowAnalystReanalyze`; server enforces `@Roles("admin")`) next to "Export CSV". Opening the dialog "Re-analyze mentions?" snapshots the pinned list params and runs a dry run (`dryRun=true`). Preview: "{matched} mentions match the current filters. Up to {cap} posts will be re-analyzed now; posts that already have a current analysis or a pending run are skipped." plus " Narrow the filters to re-analyze the rest." when `matched > cap`; Cancel / Confirm. `matched = 0`: "No mentions match the current filters." with Close only (no real call, so the 5-minute bulk window is not used). Confirm (`dryRun=false`, same snapshot) toasts "Re-analysis queued for {enqueued} posts" or "No posts needed re-analysis", then closes. 429: "Re-analysis was requested recently. Try again in {wait}." and Confirm disabled (window shared with Settings → Analysis). 403: "You don't have permission to re-analyze."; other errors "Could not start re-analysis (request {id})." — a failed preview offers Retry.
- Implementation notes (T-103, decisions 2026-10-13 on #90):
  - Header count comes from `count=true` on the first page only. If the API omits `totalCount` (count timed out), the header shows "N+ mentions loaded" while more pages exist, or the exact "N mentions" once the last page is loaded.
  - Rows are de-duplicated by `id` across pages. "Load more" and infinite scroll share the same request; a failed further page shows an inline error with Retry and keeps the loaded rows. If the API rejects the cursor (`400 VALIDATION_ERROR` on `cursor`, e.g. a cursor from before a deploy, #195), the list starts over from the first page instead of showing an error.
  - With a relative preset, the resolved range is pinned when the page loads or a filter changes, so a new minute never resets the loaded pages.
  - Matched-query chips whose exclude terms matched (`excludedByTerms`) are hidden in the list (FR-059, TC-MEN-021); detail (T-104) shows them as "excluded".
  - `Esc` in the search box clears it. On rows, `Esc` has no action of its own; inside the detail slide-out (T-104) it closes the slide-out and returns focus to the row.
  - Sync-failed / analysis-pending banners reuse the Overview coverage for the same range (FR-159). Re-analyze is not on the row; it belongs to detail (T-104).

### 3.4 Mention Detail (`/mentions/[id]`) — P0

Two-column (≥ 1024 px) or stacked. Clicking a row in `/mentions` opens the detail as a slide-out over the list (URL becomes `/mentions/:id?<filters>`; Esc/close returns to the list with filters kept and focus back on the row); a deep link or refresh renders the full page (T-104).

- **Original**: full text (plain, links auto-detected as text with external icon), `@username`, published (tz), permalink button "Open on Threads", media metadata (type, thumbnail URL as image if allowed, alt text), quote/repost indicators, matched queries, first seen / last seen, revision.
- **Analysis** (tabs: _Current_, _History_):
  - Current: relevance (badge + confidence + explanation), sentiment (badge + confidence), safety (level badge + expandable category scores table), intents (chips + confidence), topics (chips + confidence), language, summary, overall confidence band, versions (provider/model/prompt/taxonomy/policy), analyzed_at. Analyst override values shown with "Analyst" badge and original AI value struck-through (P1).
  - History: table of runs (status, trigger, effective version, created/completed, cost, error). Runs carry no tokens in the API contract, so tokens are shown only on _Current_ (T-104).
- **Operations** toolbar: Re-analyze (admin / analyst if allowed; confirm dialog; disabled while pending), Override (P1), Copy post ID, Copy permalink, Open on Threads.
- Status banner if latest run pending/failed with error code + Retry (admin); stale shows a warning. Until `POST …/analysis-runs/:id/retry` exists, Retry calls `POST …/mentions/:id/reanalyze` (same effect: a new pending run). The detail polls every 5 s while the run is pending/processing.

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

- **Project**: name, timezone (searchable select), toggles `Allow analysts to re-analyze`, `Allow viewers to export`. Save → toast. Every role sees the tab; Analyst and Viewer get the form read-only (fields disabled, no Save), and the API rejects their PATCH (FR-015). The PATCH carries only the changed fields. Each toggle shows a one-line explanation of its effect, and after Save `/me` is refetched so the new permissions apply immediately.
- **Members** (admin): table (name/email, role select, added, remove with confirm); "Invite member" dialog (email, role, default Viewer; `409 MEMBER_EXISTS` shown under the email field). Guard on last admin: the sole admin's role select and Remove are disabled as a hint, and a `409 LAST_ADMIN` reverts the role select and shows an error.
- **Integrations** (admin write): Threads card — status, account, scopes, expiry; "Update token" (password-style input, never prefilled), "Verify connection", "Disconnect". Analyst sees a read-only card without controls; Viewer does not see the tab (deep link → Forbidden).
- **Analysis** (P1): confidence bands, safety thresholds table, current versions, "Create new policy version" with optional bulk re-analysis.
  - Tab visible to every role; analyst/viewer see a read-only form (inputs disabled, no submit). The API enforces admin-only PATCH (FR-015).
  - Header: `policyVersion` (+ "Default" badge; v1 shows "Default policy (taxonomy defaults)"), created time (relative, absolute on hover, project timezone) and author; a small line "{n} posts were analysed with an older policy." when `outdatedCount > 0`.
  - Inputs accept 0.01–1 in steps of 0.01. An empty threshold cell means `null` (level not applied). BR-018 / BR-021 are re-checked on every change; errors show under the cell (client checks and server `VALIDATION_ERROR` paths alike).
  - "Create new policy version" is disabled until something changes; the PATCH carries only the changed parts (bands as a full pair, thresholds per changed category). Success toasts "Created safety-policy-vN".
  - After a save with `outdatedCount > 0` a dialog asks "{n} posts were analysed with an older policy. Re-analyse them now?" with "Later". "Re-analyse" (admin only) calls `POST …/analysis-runs/mark-stale?version=<pre-save effectiveVersion>&dryRun=true` and shows "{marked} results will be marked stale; up to {cap} posts will be re-analysed now." with "Cancel" / "Confirm". Confirm repeats the call with `dryRun=false`, toasts "Re-analysis queued for {enqueued} posts" (or "No posts needed re-analysis") and closes. `429 RATE_LIMITED` shows "Re-analysis was requested recently. Try again in {n minutes}." (from `details.retryAfterSeconds`) and disables Confirm; `400 VALIDATION_ERROR` shows "This version is already current; nothing to re-analyse." with only "Close". A preview with `marked = 0` shows "No results of the older policy are left to re-analyse." with only "Close", so no real call uses the 5-minute window. When `marked > cap` the preview adds "Posts above this limit stay stale until the next bulk re-analysis." (#204).

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
