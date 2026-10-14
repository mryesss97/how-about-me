# 09 · UX Specification

| Field            | Value                                                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status           | Approved (baseline v1.0) — visual design in Untitled UI; no separate Figma required for MVP, wireframe descriptions below are normative                                                        |
| Source           | [00-source/01_PRODUCT_REQUIREMENTS.md](../00-source/01_PRODUCT_REQUIREMENTS.md) §11–§15, §19–§20 · [00-source/02_TECHNICAL_ARCHITECTURE.md](../00-source/02_TECHNICAL_ARCHITECTURE.md) §5, §23 |
| Component system | Untitled UI React (Tailwind v4, React Aria) — `apps/web/src/components/**`                                                                                                                     |

## 1. Information architecture & routes

```text
/login                          Public
/                               Landing (signed in, full screen, no sidebar; default after login, #262)
/(app)                          Authenticated shell (sidebar + header)
├─ /overview                    Dashboard (Explore from the landing)
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

Sidebar (Untitled UI `sidebar-simple`): logo links to `/` (landing, #262) · Overview · Mentions · Listening Queries · Reviews (P1) · System Status · Settings. Footer: account card (name, role badge, sign out). Project switcher appears only with ≥ 2 projects.

### Brand (v2)

Concept: an ear + a speech bubble — "Lắng nghe. Thấu hiểu." Palette: Sky `#0EA5E9`, Action Blue `#0369A1` (primary actions), Ink `#15344B` (text), Mist `#F5FBFF` (page background); Inter 400/600. Logo keeps clear space of ¼ of the symbol width on each side; horizontal logo ≥ 180 px wide, mark ≥ 24 px; never stretched or recoloured. Theme: light only (owner decision 2026-10-14, #260). Sky/blue is reserved for brand and actions — sentiment and safety keep their own palettes and always pair colour with a label + icon (BR-017). Guide: `docs/assets/brand/brand-guide-v2.pdf`; token mapping in `docs/02-architecture/03-frontend-design.md` §6.1.

## 2. Global patterns

### 2.1 Filter bar (shared by Overview & Mentions)

- Sticky under the header. Order: **Time range** (preset segmented control + custom date-range picker + timezone select) · **Queries** (multi-select with `#` rendering for tags) · **Relevance** (default `Relevant`; chips `Relevant`, `Uncertain`, `Irrelevant`) · **Sentiment** · **Safety** · **Intent** · **Topic** · **Language** · **Analysis status** · "Compare with previous period" toggle (Overview only) · "Reset".
- Default time preset is **7d**. The timezone select lists all IANA zones with `Asia/Ho_Chi_Minh` and `UTC` pinned first. Custom ranges over 366 days show an inline error and are not applied.
- Changing the timezone keeps a custom range's **calendar dates** (#240): the selected days are re-read as `[from 00:00, to+1 00:00)` in the new timezone (e.g. 1–7 Oct stays 1–7 Oct). Only ranges whose ends are both 00:00 in the old timezone are re-zoned; exact-instant ranges (e.g. hour-bucket drill-down, FR-142) keep their instants. Relative presets (1h/24h/7d/30d) only change `tz`. `tz`/`from`/`to` update in one URL change.
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

Illustrations (#245): page-level empty states (Mentions list, Reviews queue, "not a member of any project") show the brand v2 `empty` illustration; card/widget states (chart cards, small panels) keep the compact icon. `pending` and `sync-attention` illustrations are reserved for page-level states: System Status (T-060) uses `sync-attention` for "connection needs attention / last sync failed", a future analysis-pending page uses `pending`. Banners above a page stay banners (no illustration). In light mode the illustration panel is Sky Tint (`#E0F2FE`), not Mist, so it stays visible on Mist pages (#253). Illustrations are decorative (`alt=""`, `aria-hidden`); the heading carries the meaning.

Rule: never render "0 negative mentions" when `sentimentAnalyzed = 0`; render "—" with tooltip "No analysed mentions in range".

### 2.4 Tooltips & definitions

Every KPI and chart title has an info icon → tooltip with the definition and denominator from [07-metric-definitions.md](07-metric-definitions.md).

### 2.5 External links

Threads permalink: icon `link-external-01`, `target=_blank`, `rel=noopener noreferrer`, aria-label "Open on Threads (opens in new tab)".

### 2.6 Accessibility

Keyboard reachable filters/tables/drawers (React Aria); focus rings visible; charts expose data table via "View as table" toggle (the Sentiment map uses a segmented "Bubbles | Table" toggle instead, #222); contrast AA; badges include text.

## 3. Screens

### 3.0 Landing (`/`) — P1 (#262, FR-020; signboard wall #271)

A Saigon street facade of hand-painted shop signboards (direction chosen by the owner 2026-10-14). Copy in **Vietnamese** (owner decision; the rest of the app stays English). No sidebar or header, light only. Desktop and tablet (≥ 640 px): one viewport (`100dvh`, no scroll). Phones: the main sign on top, then the wall scrolls.

- **Wall** — every configured landing phrase (`landingTerms`, FR-149, BR-042, last 30 days in the project timezone) is a flat enamel board; boards are packed as a squarified treemap around the main sign with 6 px seams of wall colour. Board area ∝ mentions with a floor (22 % of the largest), so quiet and 0-mention phrases stay legible. **Every phrase renders at every width** (#270): narrow bands beside the main sign take fewer, larger boards; nothing covers the main sign; no overlaps; deterministic.
- **Board** — enamel by dominant effective sentiment: solid red / solid green with white lettering when its share is ≥ 60 %, a white board with red / green lettering below that, a white board with navy lettering for neutral, a white board with a dashed keyline for 0 mentions ("chưa ai nhắc"). One 2 px keyline inset on every board; no gradient, glow or shadow. The phrase is set in straight quotes (Bungee caps; tall, narrow boards stack the letters vertically like a vertical shop sign), the dominant share below it ("62,0% TIÊU CỰC", Saira Extra Condensed), a sky house-number plate with the rank by mentions. Hover/focus slides up a navy sub-sign with the full split ("100 lượt nhắc · 62,0% tích cực · 38,0% trung tính · 0,0% tiêu cực"). Boards are focusable `role="img"` named `"giá vé" · 62,0% tích cực · 100 lượt nhắc`; not links (FR-149 exception to FR-142). BR-017: colour always with words.
- **Main sign** — sky enamel (`#0369A1`) with a white keyline: logo on a white plate, "30 NGÀY QUA", headline "Cộng đồng Threads nghĩ gì về bạn?", tagline "Lắng nghe. Thấu hiểu.", a ruled info line with the four painted figures — lượt nhắc · 30 ngày (+ growth `↑ 12,0%` / `↓ 5,0%` / `Mới`, shown capped at `>999%`, exact value in the accessible name), tích cực %, tiêu cực %, cập nhật ("vừa xong" under a minute, "5 phút trước", "3 giờ trước", else "14/10 09:30"; "Chưa đồng bộ" when never synced, set as small print — a state, never a painted figure). Under the mentions figure, small print "kỳ trước: N" gives the previous period's count behind the growth, so a jump from a nearly empty period reads as such (no low-base rule exists in metric-definitions §1.2; open question for the owner). Growth direction is a drawn arrow icon — then the door plaque **VÀO DASHBOARD →** → `/overview` (current project kept, no filters) and the legend "Biển càng to, càng nhiều người nhắc. Màu biển là cảm xúc chủ đạo." Numbers use Vietnamese formatting (`1.284`, `23,5%`). Figures come from the overview endpoint over the landing `range` with `compare=true` (fallback: last 30 days if landing-terms failed). Safety is never shown here (BR-017). Sum of boards ≠ mentions (phrases overlap).
- **Motion** — boards are hung once, one after another, with a short swing (720 ms, exponential ease-out); `prefers-reduced-motion` hangs them still and the sub-sign appears without sliding (`data-motion="reduced"`, NFR-031).
- **States** — loading: 8 blank placeholder boards, figures show "—" with `aria-busy`; figures error: info line hidden, door plaque stays; landing-terms error: placeholder boards only; no phrase configured: placeholder boards, and in the main sign admins get "Thêm cụm từ cho landing trong Cài đặt" → `/settings/project`, other roles "Chưa có cụm từ nào được cấu hình."; no project: the shared no-project state.

### 3.1 Login (`/login`)

Centered card: logo, email + password, "Continue with Google" (if enabled), error text. No sign-up link. Footer: "Ask an admin for access." After sign-in → `/` (landing, #262) unless a safe `next` is given; a signed-in visit to `/login` → `/`.

### 3.2 Overview (`/overview`) — P0

Layout (12-col grid, 24 px gap):

1. **Banners row** (conditional): integration / sync / pending banners (2.3).
2. **KPI row**: 6 cards (2 rows × 3 on tablet). Card = label + info icon, big value, delta vs previous (arrow + %, or "New"), sub-text with denominator ("of 2,410 analysed"). Mention Growth is its own card ("New" when the previous period had 0). Rate cards show a delta in percentage points ("+2.1 pp") only when Compare is on; delta colour is neutral (arrow only). Banners: `lastSyncStatus` failed/partial → sync-failed banner; `pendingMentions > 0` → pending banner; `integrationStatus ≠ connected` → integration banner (link for admins only).
3. **Mentions over time** (span 8) + **Sentiment distribution** donut (span 4).
4. **Sentiment over time** stacked bars (span 6) + **Safety distribution** horizontal bars (span 6).
5. **Sentiment map** bubble chart (span 12, #222).
6. **Top topics** horizontal bar (span 6) + **Intent distribution** horizontal bar (span 6).
7. P1 row: Language donut · Keyword share (horizontal bars) · Topic × sentiment heatmap · Negative-topic contributors.
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

Chart details (#222, decided 2026-10-13):

- Sentiment map: one bubble per topic with sentiment (topics with total 0 get no bubble), data from `topic-sentiment` (same request as the heatmap). Area ∝ mentions with sentiment (`total`); colour = dominant sentiment (argmax; tie-break negative > positive > neutral); tint strength + "% sentiment" line = dominant share. Bubbles smaller than 25 % of the largest radius are drawn at that minimum so they stay clickable (area is then not to scale; the table always has exact numbers). Layout: deterministic circle packing fitted to the canvas (360 / 480 / 560 px high by breakpoint), centres stretched horizontally (≤ 1.6×) to fill wide cards; no overlap. Labels: radius ≥ 58 px → topic, "75.0% negative", "N mentions"; 36–58 px → topic + "75.0%"; smaller → tooltip on hover/focus (the button's accessible name always has the full text, e.g. "Ticket, 75.0% negative, 420 mentions"). Sentiment colours only (no safety colours, BR-017); selected bubble has a sky ring.
- Chips "All · Negative · Positive · Neutral (n)" filter by dominant sentiment (local state, not in the URL, not the global sentiment filter) and apply to bubbles and table; no match → "No topics where {s} is dominant.". "Bubbles | Table" toggle in the header; table columns Topic, Dominant sentiment, Dominant share, Positive, Neutral, Negative, With sentiment (topic links to `topic=t`, no Total row). Footer: "Area = mentions with sentiment · Intensity = share of the dominant sentiment", "N topics" and the multi-label note.
- Topics | Phrases toggle (#243, FR-148): segmented control (`aria-label` "Group bubbles by") next to the chips; local state, not in the URL, default **Topics**; switching clears the selection. Phrases mode reads `analytics/phrases` (`limit=30`, no `minMentions` — the server applies the project's `phraseMinMentions`, #251; the request runs only in Phrases mode) and draws one bubble per phrase with the same encoding; the phrase is shown verbatim (normalised per BR-041, no humanising). Table first column "Phrase"; footer "N phrases", or "Top N of M phrases" when `totalPhrases` exceeds the rows. Drill-down: `phrase=p` / `phrase=p&sentiment=s`. Empty states: `sentimentAnalyzed = 0` → "No analysed mentions in this range" (BR-032); `phraseAnalyzed = 0` → "No phrases yet — re-analyse to extract phrases" ("Mentions analysed before phrase extraction have no phrases until they are re-analysed."); phrases exist but none reach `minMentions` → "No phrase reaches {n} mentions". Chip empty text "No phrases where {s} is dominant.".
- Click / Enter / Space on a bubble selects it (`aria-pressed`) and opens the detail panel: 3 sentiment rows "count · share" with bar, non-zero rows link to `topic=t&sentiment=s`, "View all N mentions" → `topic=t`. Escape deselects. Phase 1 shows no posts inline.
- Motion: grow-in stagger on first render, gentle float (paused while the map is hovered/focused), hover lift, animated re-layout when chips/data change (position by `transform`; the radius eases `width`/`height` on the same 600 ms curve, only on re-layout); idle float, grow-in and hover are `transform`/`opacity` only. The hovered/selected bubble is raised above its neighbours. `prefers-reduced-motion: reduce` turns all of it off.

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
  - Current: relevance (badge + confidence + explanation), sentiment (badge + confidence), safety (level badge + expandable category scores table), intents (chips + confidence), topics (chips + confidence), key phrases (#250: chips shown verbatim (BR-041) with the "AI" badge, each links to `/mentions?phrase=p` and closes the slide-out; v1 analysis → "No phrases (analysed before phrase extraction)"; none → "—"), language, summary, overall confidence band, versions (provider/model/prompt/taxonomy/policy), analyzed_at. Analyst override values shown with "Analyst" badge and original AI value struck-through (P1).
  - History: table of runs (status, trigger, effective version, created/completed, cost, error). Runs carry no tokens in the API contract, so tokens are shown only on _Current_ (T-104).
- **Operations** toolbar: Re-analyze (admin / analyst if allowed; confirm dialog; disabled while pending), Override (P1), Copy post ID, Copy permalink, Open on Threads.
- Implementation notes (T-143): "Override" button (admin, analyst; hidden from viewer) opens a dialog with Field (Relevance, Sentiment, Safety level, Intents, Topics), Value (select from the taxonomy enum; intents/topics as a checkbox list, max 20) prefilled with the current effective value, and Reason (required in the UI, 1–500 chars after trim; the API keeps it optional). Save is disabled while the value equals the effective value. If the field already has an active override the dialog says "Saving replaces the current analyst override" (the server revokes the old one). Toasts: "Override saved", "Override revoked"; `409 OVERRIDE_CONFLICT` → info toast "Another override was saved at the same time" + refetch. Save/revoke refetch detail, mention list and analytics (FR-192).
- Current tab (T-143, FR-194): every AI value shows the "AI" source badge; an overridden field shows the "Analyst" badge (tooltip: who, when, reason), then "AI:" and the AI value at override time struck through (screen-reader text "AI value: …"; "—" if it was not analysed yet), and no confidence %. A "Revoke" link (admin, analyst) asks for confirmation. With any active override a note says overall confidence, relevance explanation and safety category scores are still AI values. History tab adds an "Analyst overrides" table (field, AI → Analyst, reason, created by/at, revoked by/at or "Active").
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

- **Project**: name, timezone (searchable select), toggles `Allow analysts to re-analyze`, `Allow viewers to export`. Save → toast. Every role sees the tab; Analyst and Viewer get the form read-only (fields disabled, no Save), and the API rejects their PATCH (FR-015). The PATCH carries only the changed fields. Each toggle shows a one-line explanation of its effect, and after Save `/me` is refetched so the new permissions apply immediately. Below it, a separate **Landing page** section (#261, FR-149) with its own Save: tag input "Landing phrases" (Enter adds; placeholder "Add a phrase and press Enter"; hint "Each phrase becomes a signboard on the landing page, coloured by the sentiment of mentions whose text or key phrases contain it. Up to 20 phrases, 1–60 characters."). Terms are shown normalised (BR-041/BR-042); errors "Enter 1–60 characters with a letter or digit.", "Already in the list.", "Up to 20 phrases."; toast "Landing page settings saved". Non-admins see the tags disabled, no Save, "Only project admins can change these settings."; empty → "No landing phrases yet.". Saving either section remounts both (unsaved drafts reset).
- **Members** (admin): table (name/email, role select, added, remove with confirm); "Invite member" dialog (email, role, default Viewer; `409 MEMBER_EXISTS` shown under the email field). Guard on last admin: the sole admin's role select and Remove are disabled as a hint, and a `409 LAST_ADMIN` reverts the role select and shows an error.
- **Integrations** (admin write): Threads card — status, account, scopes, expiry; "Update token" (password-style input, never prefilled), "Verify connection", "Disconnect". Analyst sees a read-only card without controls; Viewer does not see the tab (deep link → Forbidden).
- **Analysis** (P1): confidence bands, safety thresholds table, current versions, "Create new policy version" with optional bulk re-analysis.
  - **Sentiment map** section (#251, FR-032/FR-148), below the policy form with a divider: number input "Minimum mentions per phrase" (hint "Phrases found in fewer mentions are hidden from the sentiment map in Phrases mode. Whole number from 1 to 50."; invalid → "Enter a whole number from 1 to 50."), its own "Save" (disabled until changed) via `PATCH /projects/:projectId` — never creates a policy version or prompts re-analysis. Toast "Sentiment map settings saved". Non-admins see the value read-only with "Only project admins can change these settings."
  - Tab visible to every role; analyst/viewer see a read-only form (inputs disabled, no submit). The API enforces admin-only PATCH (FR-015).
  - Header: `policyVersion` (+ "Default" badge; v1 shows "Default policy (taxonomy defaults)"), created time (relative, absolute on hover, project timezone) and author; a small line "{n} posts were analysed with an older policy." when `outdatedCount > 0`.
  - Inputs accept 0.01–1 in steps of 0.01. An empty threshold cell means `null` (level not applied). BR-018 / BR-021 are re-checked on every change; errors show under the cell (client checks and server `VALIDATION_ERROR` paths alike).
  - "Create new policy version" is disabled until something changes; the PATCH carries only the changed parts (bands as a full pair, thresholds per changed category). Success toasts "Created safety-policy-vN".
  - After a save with `outdatedCount > 0` a dialog asks "{n} posts were analysed with an older policy. Re-analyse them now?" with "Later". "Re-analyse" (admin only) calls `POST …/analysis-runs/mark-stale?version=<pre-save effectiveVersion>&dryRun=true` and shows "{marked} results will be marked stale; up to {cap} posts will be re-analysed now." with "Cancel" / "Confirm". Confirm repeats the call with `dryRun=false`, toasts "Re-analysis queued for {enqueued} posts" (or "No posts needed re-analysis") and closes. `429 RATE_LIMITED` shows "Re-analysis was requested recently. Try again in {n minutes}." (from `details.retryAfterSeconds`) and disables Confirm; `400 VALIDATION_ERROR` shows "This version is already current; nothing to re-analyse." with only "Close". A preview with `marked = 0` shows "No results of the older policy are left to re-analyse." with only "Close", so no real call uses the 5-minute window. When `marked > cap` the preview adds "Posts above this limit stay stale until the next bulk re-analysis." (#204).

### 3.8 Reviews (`/reviews`) — P1

Queue of `uncertain`, low-confidence, failed items; tabs by reason; row → detail with override form (field, value, reason); "Mark reviewed".

Built in #219 (`apps/web/src/features/reviews`):

- **Tabs** All · Uncertain · Low confidence · Failed, each with a count badge from page 1 `counts`. When the API omits `counts` (count timed out) the badges are hidden — never shown as 0 (BR-032).
- **URL state:** `?reason=uncertain|low_confidence|failed` (missing/invalid → All), `?status=reviewed` (toggle "Show reviewed"; default unreviewed), `?item=<postId>` (slide-out). Tabs and the toggle replace history; opening a row pushes, so Back closes the slide-out. Changing tab/status clears the selection.
- **Table:** post (user, time with tz tooltip, 2-line text, override icon), reasons, relevance, sentiment, confidence (`%` + band; a band, not a probability — BR-020), analysis status (+ `errorCode` when failed), and "Reviewed by" when Show reviewed is on. Load more paginates (25 / page).
- **Mark reviewed (admin, analyst):** checkboxes + "Mark reviewed (N)"; select-all and manual selection are capped at 50 (`MARK_REVIEWED_MAX`, helper "Up to 50 at a time"). Rows disappear optimistically and come back with a toast (incl. Request ID) on error. Not offered under Show reviewed; no "Unmark" in v1. A new analysis run reopens an item (BR-040).
- **Slide-out:** mention detail with override form (T-143) + "Mark reviewed" for that item (closes on success); "Open full page" → `/mentions/:id`.
- **Viewer:** read-only — no checkboxes, no Mark reviewed, no override form.
- **Empty:** "No items need review" (unreviewed) / "No reviewed items".

## 4. Responsive behaviour

- Landing `/` (#262, #271): one viewport from 640 px with every phrase on the wall; below 640 px the main sign sits on top and the wall scrolls (every phrase still shown).
- ≥ 1280 px: full sidebar, 12-col grid.
- 768–1279 px: collapsed slim sidebar, charts 2-per-row → 1-per-row, tables horizontally scrollable.
- < 768 px: read-only Overview/Mentions acceptable; admin forms not optimised.

## 5. Copy guidelines

- Plain, factual, no blame ("Latest Threads sync failed" not "Something went wrong").
- Numbers use thousands separators; percentages 1 decimal; times relative (< 24 h) + absolute on hover.
- Timezone label shown next to time-range picker ("GMT+7 · Asia/Ho_Chi_Minh").
