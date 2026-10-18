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

Sidebar (Untitled UI `sidebar-simple`, signboard style #274 — sky enamel sign, white logo plate, condensed caps labels, current item as a white plate): logo links to `/` (landing, #262) · Tổng quan · Bài nhắc · Truy vấn theo dõi · Cần xem lại (P1) · Trạng thái hệ thống · Cài đặt. Footer: account card (e-mail, role plate Quản trị / Phân tích / Chỉ xem, Đăng xuất). Project switcher appears only with ≥ 2 projects. Every page opens with a page fascia (white enamel board, navy keyline, title in sign lettering). Copy moves to Vietnamese screen by screen (#274, #275, #277–#281).

### Brand (v2)

Concept: an ear + a speech bubble — "Lắng nghe. Thấu hiểu." Palette: Sky `#0EA5E9`, Action Blue `#0369A1` (primary actions), Ink `#15344B` (text), Mist `#F5FBFF` (page background); Inter 400/600. Logo keeps clear space of ¼ of the symbol width on each side; horizontal logo ≥ 180 px wide, mark ≥ 24 px; never stretched or recoloured. Theme: light only (owner decision 2026-10-14, #260). Sky/blue is reserved for brand and actions — sentiment and safety keep their own palettes and always pair colour with a label + icon (BR-017). Guide: `docs/assets/brand/brand-guide-v2.pdf`; token mapping in `docs/02-architecture/03-frontend-design.md` §6.1.

## 2. Global patterns

### 2.1 Filter bar (shared by Overview & Mentions)

- Sticky under the header; since #275 a white enamel panel with a 2px navy rule, controls stay Untitled/Inter. Labels are Vietnamese (#275): Khoảng thời gian (1 giờ · 24 giờ · 7 ngày · 30 ngày · Chọn ngày) · Múi giờ · Truy vấn · Mức liên quan (Liên quan / Chưa chắc / Không liên quan) · Cảm xúc · An toàn · Ý định · Chủ đề · Ngôn ngữ · Trạng thái phân tích · "So sánh với kỳ trước" · "Đặt lại". Enum values in the URL stay English.
- Order: **Time range** (preset segmented control + custom date-range picker + timezone select) · **Queries** (multi-select with `#` rendering for tags) · **Relevance** (default `Relevant`; chips `Relevant`, `Uncertain`, `Irrelevant`) · **Sentiment** · **Safety** · **Intent** · **Topic** · **Language** · **Analysis status** · "Compare with previous period" toggle (Overview only) · "Reset".
- Default time preset is **7d**. The timezone select lists all IANA zones with `Asia/Ho_Chi_Minh` and `UTC` pinned first. Custom ranges over 366 days show an inline error and are not applied.
- Changing the timezone keeps a custom range's **calendar dates** (#240): the selected days are re-read as `[from 00:00, to+1 00:00)` in the new timezone (e.g. 1–7 Oct stays 1–7 Oct). Only ranges whose ends are both 00:00 in the old timezone are re-zoned; exact-instant ranges (e.g. hour-bucket drill-down, FR-142) keep their instants. Relative presets (1h/24h/7d/30d) only change `tz`. `tz`/`from`/`to` update in one URL change.
- All filters sync to the URL query string (`nuqs`). Changing a filter refetches all widgets.
- Applied filters show as removable chips under the bar.

### 2.2 Semantic badges (never colour alone)

Display labels are Vietnamese since #275 (`lib/semantics/badges.ts`): Tích cực / Trung tính / Tiêu cực; An toàn / Nhạy cảm / Nghiêm trọng; Liên quan / Chưa chắc / Không liên quan; Chờ phân tích / Đang phân tích… / Đã phân tích / Phân tích lỗi / Bỏ qua / Cũ; Độ tin cậy cao / trung bình / thấp. The English names in the table are the enum values.

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

Mentions empty state by cause (FR-159, BR-032, #92). When the list is empty the empty state names only the highest-priority cause (integration > sync > pending, same order as the banners); banners above still show every cause. Overview data loading/failed → "none".

| Cause         | Title (VI)                                                              | Action                                        |
| ------------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| `integration` | "Kết nối Threads cần được kiểm tra."                                    | Link Settings → Integrations (admin only, UX) |
| `sync`        | "Lần đồng bộ Threads gần nhất bị lỗi, dữ liệu có thể chưa đầy đủ."      | Link System Status                            |
| `pending`     | "{N} lượt nhắc đang chờ phân tích." (+ note that filters may hide them) | Link `/mentions?analysisStatus=pending`       |
| `none`        | "Không có lượt nhắc liên quan trong khoảng thời gian này."              | CTA "Mở rộng khoảng thời gian"                |

Illustrations (#245): page-level empty states (Mentions list, Reviews queue, "not a member of any project") show the brand v2 `empty` illustration; card/widget states (chart cards, small panels) keep the compact icon. `pending` and `sync-attention` illustrations are reserved for page-level states: System Status (T-060) uses `sync-attention` for "connection needs attention / last sync failed", a future analysis-pending page uses `pending`. Banners above a page stay banners (no illustration). In light mode the illustration panel is Sky Tint (`#E0F2FE`), not Mist, so it stays visible on Mist pages (#253). Illustrations are decorative (`alt=""`, `aria-hidden`); the heading carries the meaning.

Rule: never render "0 negative mentions" when `sentimentAnalyzed = 0`; render "—" with tooltip "No analysed mentions in range".

### 2.4 Tooltips & definitions

Every KPI and chart title has an info icon → tooltip with the definition and denominator from [07-metric-definitions.md](07-metric-definitions.md).

### 2.5 External links

Threads permalink: icon `link-external-01`, `target=_blank`, `rel=noopener noreferrer`, aria-label "Open on Threads (opens in new tab)".

### 2.6 Accessibility

Keyboard reachable filters/tables/drawers (React Aria); focus rings visible; charts expose data table via "View as table" toggle (the Sentiment map uses a segmented "Bubbles | Table" toggle instead, #222); contrast AA; badges include text.

**axe gate (#95):** unit tests run axe-core (`apps/web/src/test/axe.ts`, `color-contrast` off in jsdom) on badges, `ChartCard` (chart + table mode) and `MentionRow`; Playwright `e2e/a11y.spec.ts` (public `/`, `/login`) and `e2e/a11y.auth.spec.ts` (working screens @1280/@900, mention slide-out) fail on any `serious`/`critical` violation (WCAG 2.1 A/AA tags); `moderate`/`minor` are attached to the report only. Esc on the detail slide-out returns focus to the row that opened it (TC-MEN-020).

## 3. Screens

### 3.0 Landing (`/`) — P1 (#262, FR-020; signboard wall #271)

A Saigon street facade of hand-painted shop signboards (direction chosen by the owner 2026-10-14). Copy in **Vietnamese** (owner decision; the rest of the app stays English). No sidebar or header, light only. Desktop and tablet (≥ 640 px): one viewport (`100dvh`, no scroll). Phones: the main sign on top, then the wall scrolls.

- **Wall** — every configured landing phrase (`landingTerms`, FR-149, BR-042, last 30 days in the project timezone) is a flat enamel board; boards are packed as a squarified treemap around the main sign with 6 px seams of wall colour. Board area ∝ mentions with a floor (22 % of the largest), so quiet and 0-mention phrases stay legible. **Every phrase renders at every width** (#270): narrow bands beside the main sign take fewer, larger boards; nothing covers the main sign; no overlaps; deterministic.
- **Board** — enamel by dominant effective sentiment: solid red / solid green with white lettering when its share is ≥ 60 %, a white board with red / green lettering below that, a white board with navy lettering for neutral, a white board with a dashed keyline for 0 mentions ("chưa ai nhắc"). One 2 px keyline inset on every board; no gradient, glow or shadow. The phrase is set in straight quotes (Bungee caps; tall, narrow boards stack the letters vertically like a vertical shop sign), the dominant share below it ("62,0% TIÊU CỰC", Saira Extra Condensed), a sky house-number plate with the rank by mentions. Hover/focus slides up a navy sub-sign with the full split ("100 lượt nhắc · 62,0% tích cực · 38,0% trung tính · 0,0% tiêu cực"). Boards are links to the phrase detail page `/terms/<term>?preset=30d` (#276), named `"giá vé" · 62,0% tích cực · 100 lượt nhắc`. BR-017: colour always with words.
- **Main sign** — sky enamel (`#0369A1`) with a white keyline: logo on a white plate, "30 NGÀY QUA", headline "Cộng đồng Threads nghĩ gì về bạn?", tagline "Lắng nghe. Thấu hiểu.", a ruled info line with the four painted figures — lượt nhắc · 30 ngày (+ growth `↑ 12,0%` / `↓ 5,0%` / `Mới`, shown capped at `>999%`, exact value in the accessible name), tích cực %, tiêu cực %, cập nhật ("vừa xong" under a minute, "5 phút trước", "3 giờ trước", else "14/10 09:30"; "Chưa đồng bộ" when never synced, set as small print — a state, never a painted figure). Under the mentions figure, small print "kỳ trước: N" gives the previous period's count behind the growth, so a jump from a nearly empty period reads as such (no low-base rule exists in metric-definitions §1.2; open question for the owner). Growth direction is a drawn arrow icon — then the door plaque **VÀO DASHBOARD →** → `/overview` (current project kept, no filters) and the legend "Biển càng to, càng nhiều người nhắc. Màu biển là cảm xúc chủ đạo." Numbers use Vietnamese formatting (`1.284`, `23,5%`). Figures come from the overview endpoint over the landing `range` with `compare=true` (fallback: last 30 days if landing-terms failed). Safety is never shown here (BR-017). Sum of boards ≠ mentions (phrases overlap).
- **Motion** — boards are hung once, one after another, with a short swing (720 ms, exponential ease-out); `prefers-reduced-motion` hangs them still and the sub-sign appears without sliding (`data-motion="reduced"`, NFR-031).
- **States** — loading: 8 blank placeholder boards, figures show "—" with `aria-busy`; figures error: info line hidden, door plaque stays; landing-terms error: placeholder boards only; no phrase configured: placeholder boards, and in the main sign admins get "Thêm cụm từ cho landing trong Cài đặt" → `/settings/project`, other roles "Chưa có cụm từ nào được cấu hình."; no project: the shared no-project state.

### 3.0b Phrase detail (`/terms/[term]`) — #276

Opened from a landing board (last 30 days) or any `/terms/<term>` URL; inside the app shell; Vietnamese; signboard world.

- **Hero board** — the phrase in quotes as a large enamel board, toned like its landing board (solid red/green at ≥ 60 % dominant share, white with coloured lettering when mixed, white/navy neutral, blank when 0). Line "54,9% TIÊU CỰC · 82 LƯỢT NHẮC CÓ CẢM XÚC": the count is the sentiment denominator with `term`, i.e. exactly the landing board's total (BR-042). A white plate shows the split bar and Tích cực / Trung tính / Tiêu cực with % and counts (BR-017). Links "← Về bức tường cụm từ" (`/`) and "Xem tất cả trong Bài nhắc →" (`/mentions?term=…`). Note on matching (text or key phrases, BR-042). 0 mentions → "Chưa ai nhắc tới cụm từ này trong khoảng thời gian đã chọn."
- **Filter bar** (same as Overview, no compare); every request carries `term` (#273).
- **Charts** — mentions over time, sentiment donut, sentiment over time, top topics; drill-downs keep `term`.
- **Mentions** — "Bài nhắc tới \"…\"" board with the mentions list (`term`, infinite scroll); a row opens the mention detail page.
- Invalid term (empty, no letter/digit, > 60 chars) → not found.

### 3.1 Login (`/login`)

Centered white enamel board on the wall (signboard style, #286): logo, title "Đăng nhập" (Bungee caps), "E-mail công việc" + "Mật khẩu", "Tiếp tục", "Tiếp tục với Google" (if enabled), generic error "E-mail hoặc mật khẩu không đúng". Banners: `?reason=expired` → "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."; `?reason=forbidden` → "Tài khoản không có quyền truy cập. Liên hệ quản trị viên." (render only; no flow sends it yet). No sign-up link. Footer: "Chưa có tài khoản? Nhờ quản trị viên cấp quyền." After sign-in → `/` (landing, #262) unless a safe `next` is given; a signed-in visit to `/login` → `/`.

### 3.1a Not found (404, `not-found`)

Same wall + white enamel board: "Lỗi 404", title "Không tìm thấy trang", short description; plaque buttons "Quay lại" (browser back) and "Về trang chủ" (→ `/`). Title tab: "Không tìm thấy trang".

### 3.2 Overview (`/overview`) — P0

Layout (12-col grid, 24 px gap):

1. **Banners row** (conditional): integration / sync / pending banners (2.3).
2. **KPI row**: 6 cards (2 rows × 3 on tablet). Card (#275: white enamel board, navy keyline, label in condensed caps 15px, value as a 40px figure) = label + info icon, big value, delta vs previous (arrow icon + %, or "Mới"), sub-text with denominator ("trên 2.410 đã phân tích"). Tăng trưởng lượt nhắc is its own card ("Mới" when the previous period had 0). Rate cards show a delta in percentage points ("+2,1 điểm %") only when Compare is on; delta colour is neutral (arrow only). Banners: `lastSyncStatus` failed/partial → sync-failed banner; `pendingMentions > 0` → pending banner; `integrationStatus ≠ connected` → integration banner (link for admins only).
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
- Style and copy (#277, behaviour unchanged): toolbar is a white enamel panel with a navy rule; count shown as a figure ("1.234 bài nhắc"; without total "Đã tải N+ bài nhắc"). Copy is Vietnamese; the English strings in the notes below are the pre-#277 originals. Sort: Mới nhất · Cũ nhất · Mức an toàn nghiêm trọng nhất · Độ tin cậy thấp nhất · Liên quan nhất. Search "Tìm trong nội dung…". "Tải thêm" / "Đang tải…". Row chips use the Vietnamese intent/topic/language labels; times are vi-VN ("5 phút trước"). Export: "Xuất CSV"; toasts "Đã xuất xong", "Quá nhiều bài nhắc để xuất" (+ "Mỗi lần xuất tối đa N dòng…"), "Đã chạm giới hạn xuất. Thử lại sau N giây.", "Bạn không có quyền xuất dữ liệu.", "Xuất thất bại. Vui lòng thử lại." + "Mã yêu cầu". Bulk: "Phân tích lại" → dialog "Phân tích lại các bài nhắc?", preview "{matched} bài nhắc khớp bộ lọc hiện tại. Tối đa {cap} bài sẽ được phân tích lại ngay; …", buttons Huỷ / Xác nhận / Đóng / Thử lại, toasts "Đã xếp hàng phân tích lại {n} bài" / "Không có bài nào cần phân tích lại", 429 "Vừa có yêu cầu phân tích lại. Thử lại sau {N giây|N phút}.".
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

Two-column (≥ 1024 px) or stacked. Clicking a row in `/mentions` opens the detail as a slide-out over the list (URL becomes `/mentions?<filters>&item=<id>`; Back/Esc/close closes it with filters, scroll and loaded pages kept and focus back on the row). Each row is a real link to `/mentions/:id?<filters>`: cmd/ctrl/middle-click opens the full page in a new tab; a deep link or refresh of `/mentions/:id` renders the full page (T-104, #326).

- **Original**: full text (plain, links auto-detected as text with external icon), `@username`, published (tz), permalink button "Open on Threads", media metadata (type, thumbnail URL as image if allowed, alt text), quote/repost indicators, matched queries, first seen / last seen, revision.
- **Analysis** (tabs: _Current_, _History_):
  - Current: relevance (badge + confidence + explanation), sentiment (badge + confidence), safety (level badge + expandable category scores table), intents (chips + confidence), topics (chips + confidence), key phrases (#250: chips shown verbatim (BR-041) with the "AI" badge, each links to `/mentions?phrase=p` and closes the slide-out; v1 analysis → "No phrases (analysed before phrase extraction)"; none → "—"), language, summary, overall confidence band, versions (provider/model/prompt/taxonomy/policy), analyzed_at. Analyst override values shown with "Analyst" badge and original AI value struck-through (P1).
  - History: table of runs (status, trigger, effective version, created/completed, cost, error). Runs carry no tokens in the API contract, so tokens are shown only on _Current_ (T-104).
- **Operations** toolbar: Re-analyze (admin / analyst if allowed; confirm dialog; disabled while pending), Override (P1), Copy post ID, Copy permalink, Open on Threads.
- Implementation notes (T-143): "Override" button (admin, analyst; hidden from viewer) opens a dialog with Field (Relevance, Sentiment, Safety level, Intents, Topics), Value (select from the taxonomy enum; intents/topics as a checkbox list, max 20) prefilled with the current effective value, and Reason (required in the UI, 1–500 chars after trim; the API keeps it optional). Save is disabled while the value equals the effective value. If the field already has an active override the dialog says "Saving replaces the current analyst override" (the server revokes the old one). Toasts: "Override saved", "Override revoked"; `409 OVERRIDE_CONFLICT` → info toast "Another override was saved at the same time" + refetch. Save/revoke refetch detail, mention list and analytics (FR-192).
- Current tab (T-143, FR-194): every AI value shows the "AI" source badge; an overridden field shows the "Analyst" badge (tooltip: who, when, reason), then "AI:" and the AI value at override time struck through (screen-reader text "AI value: …"; "—" if it was not analysed yet), and no confidence %. A "Revoke" link (admin, analyst) asks for confirmation. With any active override a note says overall confidence, relevance explanation and safety category scores are still AI values. History tab adds an "Analyst overrides" table (field, AI → Analyst, reason, created by/at, revoked by/at or "Active").
- Style and copy (#277, behaviour unchanged): the two columns are Operate boards titled "Bài gốc" / "Phân tích"; page/slide-over title "Chi tiết bài nhắc". Copy is Vietnamese (English above = pre-#277 originals): tabs Hiện tại / Lịch sử; operations Phân tích lại · Ghi đè · Sao chép ID bài · Sao chép liên kết · Mở trên Threads (plaque buttons); source badge "Chuyên viên" (was "Analyst"), sr text "Giá trị AI: …", "Thu hồi"; override dialog "Ghi đè kết quả phân tích" (Trường / Giá trị / Lý do, values as Vietnamese labels); toasts "Đã lưu ghi đè", "Đã thu hồi ghi đè", "Có ghi đè khác vừa được lưu cùng lúc"; banners "Đang phân tích", "Phân tích thất bại" ("Mã lỗi: …"), "Kết quả phân tích đã cũ"; run triggers translated (Thu thập, Nội dung thay đổi, Thủ công, Hàng loạt, Thử lại, Đổi phiên bản); safety category names stay provider codes; key phrases verbatim (BR-041); cost "$0,0012".
- Status banner if latest run pending/failed with error code + Retry (admin); stale shows a warning. Until `POST …/analysis-runs/:id/retry` exists, Retry calls `POST …/mentions/:id/reanalyze` (same effect: a new pending run). The detail polls every 5 s while the run is pending/processing.

### 3.5 Listening Queries (`/listening-queries`) — P0

- Header: title, "Show deleted" toggle, **+ Add query** (admin).
- Table (Untitled UI `table.tsx`): Query (display name + value with `#` for tags) · Type · Enabled (toggle, admin) · Poll interval · Overlap · Last sync (relative + status dot) · Last result (fetched/inserted) · Matched posts (24 h / all) · Last error (truncated, tooltip) · Created by · Actions (⋯ menu: Edit, Run now, Backfill (P1), View mentions, Disable/Enable, Delete/Restore).
- Create/Edit **drawer**: Display name · Query value (helper: "Enter without #") · Type (Keyword / Topic tag radio, disabled on edit) · Exclude terms (tag input) · Include terms (tag input, collapsed "Advanced") · Poll interval (number, seconds, presets 5/10/30/60 min) · Overlap (seconds, preset) · Initial backfill (days, 0–30) · Enabled toggle. Validation inline; duplicate → error toast with link to existing query.
- Run now → toast "Sync queued" with "View job". Delete → confirm dialog explaining soft delete.
- **Signboard (#279).** Table built in #42; drawer and mutations (Sửa, Chạy ngay, Tắt/Bật, Xoá/Khôi phục) wired in #43 for admins (viewers/analysts see none; API enforces `@Roles("admin")`). Drawer "THÊM TRUY VẤN" / "SỬA TRUY VẤN": Tên hiển thị, Giá trị truy vấn ("Nhập không có dấu #"), Loại (Từ khoá / Chủ đề) — both read-only on edit (FR-054) — Loại trừ, Nâng cao → Bao gồm (tag input, Enter or comma), Chu kỳ quét (presets 5/10/30/60 phút), Chồng lấn (presets 10/20/60 phút), Lấy dữ liệu cũ (0–30 ngày), Bật. Inline errors after a field is touched or on submit; submit disabled while errors show; edit PATCHes only changed fields. 409 QUERY_DUPLICATE → toast "Truy vấn này đã tồn tại" with "Xem truy vấn" (opens the existing query; `?edit=<id>` deep link fetches it when not in the list). Xoá asks "Xoá truy vấn?" first; toasts "Đã tạo truy vấn", "Đã lưu thay đổi", "Đã bật/Đã tắt truy vấn", "Đã xoá truy vấn" (+ "Hoàn tác"), "Đã khôi phục truy vấn". "Xem lượt đồng bộ" links to `/system-status?tab=sync-jobs&job=<jobId>` (reserved for #55/#56). Layout: fascia header + "+ Thêm truy vấn"; toolbar panel with "Hiện truy vấn đã xoá"; table on an `.operate-board`, Inter cells, status dot + text (BR-017); drawer title in condensed caps. Vietnamese labels — columns: Truy vấn · Loại · Bật · Chu kỳ quét · Chồng lấn · Lần đồng bộ cuối · Kết quả gần nhất · Bài khớp (24 giờ / tất cả) · Lỗi gần nhất · Người tạo; actions: Sửa, Chạy ngay, Lấy dữ liệu cũ, Xem bài nhắc, Tắt/Bật, Xoá/Khôi phục. Toast: "Đã xếp lịch đồng bộ" / "Xem lượt đồng bộ". See `apps/web/DESIGN.md` → Operate Surfaces.
- **Backfill dialog (P1, #112).** Menu item "Lấy dữ liệu cũ" (admin, enabled non-deleted queries only; API enforces `@Roles("admin")`, BR-033). Dialog "Backfill truy vấn": Khoảng ngày (date range in the project timezone, default last 7 days, no future days, helper "Tối đa 30 ngày." — server `COLLECTOR_MAX_BACKFILL_DAYS` is authoritative), Loại tìm kiếm Gần đây (RECENT, default) / Nổi bật (TOP), Huỷ / "Bắt đầu backfill" (loading, no double submit). Days are sent as UTC bounds, `until` clamped to now. 202 → toast "Đã xếp lịch backfill" and the same dialog switches to progress: status word (BR-017), indeterminate bar while queued/running, Trang · Đã lấy · Mới · Trùng, window, error message, "Xem lượt đồng bộ". Polls `GET …/sync-jobs/:id` every 3 s, stops at a terminal status, when hidden or closed (job keeps running); list refreshes when it ends. 409 SYNC_ALREADY_RUNNING → "Truy vấn đang đồng bộ" and follows that job (BR-010); 400 BACKFILL_WINDOW_INVALID → inline "Khoảng thời gian không hợp lệ (tối đa 30 ngày, không vượt quá hiện tại)."
- **Sync status dot (#42).** "Lần đồng bộ cuối" shows a dot + word, then the relative time of `lastSuccessfulSyncAt` (absolute in the title; "—" if never). Mapping, first match wins: deleted → Đã xoá (grey); disabled → Tắt (grey); no job yet → Lỗi (red) if `lastError`, else Chưa đồng bộ (grey); last job `success` → Thành công (green), `partial` → Một phần (amber), `failed` → Lỗi (red), `cancelled` → Đã huỷ (grey), `running` → Đang chạy, `queued` → Đang chờ (brand). "Lỗi gần nhất" is cut at 60 chars; the tooltip shows `code: message`. "Xem bài nhắc" opens `/mentions?queryIds=<id>` (FR-062). "Hiện truy vấn đã xoá" is kept in the URL as `?deleted=1`.

### 3.6 System Status (`/system-status`) — P0

Tabs: **Overview** · **Sync jobs** · **Analysis failures** · **Audit log** (admin).

- Overview cards: Threads connection (status badge, account, scopes, expiry, last success/error, "Manage" link for admin) · Collector (status healthy/degraded/paused, active queries, last global sync, jobs in progress, failed 24 h, collection lag) · Analyzer (pending, processing, failed 24 h, lag, versions, tokens & est. cost 24 h) · Database (approx mentions, analyses, storage note). Auto-refresh 30 s with "Updated 12 s ago".
- Sync jobs tab: table with filters (query, status, date) → row click opens job detail drawer (window, pages, counters, requests, rate-limit events, error, cursor). Admin: "Retry" for failed.
- Analysis failures tab: failed runs list with error code, post link, "Retry" (admin), "Retry all failed (≤ 500)" (admin, confirm).
- Audit log tab (admin): actor, action, entity, time, metadata (expand).

- **Signboard (#280).** Built in #55: tabs Tổng quan · Lượt đồng bộ (URL `?tab=sync-jobs&queryId=&status=&from=YYYY-MM-DD&to=YYYY-MM-DD&job=<id>`, days in the project timezone sent as UTC bounds; deep-linkable). Overview polls every 30 s while the browser tab is visible. Sync job drawer shows window, counters, provider usage, error and last cursor (truncated, copy); admins get "Thử lại" on `failed` jobs only (toast "Đã xếp lịch thử lại"; 409 → "Lượt đồng bộ này không thể thử lại."). Token scopes are not in the contract and are not shown. Tab Lỗi phân tích (#93, `?tab=analysis-failures`, every member can view) lists `failed` analysis runs (Thời gian · Mã lỗi + message · Bài viết → `/mentions/{postId}` · Phiên bản · Số lần thử · Kích hoạt, "Tải thêm" by cursor); admins get per-row "Thử lại" (toast "Đã xếp lịch thử lại"; 409 `ANALYSIS_RUN_NOT_RETRYABLE` → "Lượt phân tích này không còn ở trạng thái lỗi.", `ANALYSIS_ALREADY_PENDING` → "Bài này đã có lượt phân tích đang chờ.") and "Thử lại tất cả lỗi (≤ 500)" behind a confirm dialog (toast "Đã xếp lịch N lượt phân tích"; BR-024). The Bộ phân tích card links "Xem lỗi" to this tab when failed 24h > 0. Tab Nhật ký thao tác (#56, FR-201, `?tab=audit-log&action=&from=YYYY-MM-DD&to=YYYY-MM-DD`) is admin-only: columns Thời gian · Người thực hiện ("Hệ thống" when no actor) · Thao tác (Vietnamese label; unknown legacy actions shown raw) · Đối tượng (type · truncated id); "Chi tiết" expands the sanitized metadata JSON + Mã yêu cầu; filters Thao tác + Từ ngày/Đến ngày (project-timezone days, `to` sent as next-day start since the API bound is exclusive); "Tải thêm" by cursor. Analysts/viewers don't see the tab and a deep link falls back to Tổng quan without calling the API (TC-SYS-015; the API returns 403). Target layout: tabs Tổng quan · Lượt đồng bộ · Lỗi phân tích · Nhật ký thao tác (admin); cards Kết nối Threads · Bộ thu thập · Bộ phân tích · Cơ sở dữ liệu as `.operate-board`s, state as a plate with its word (Hoạt động tốt · Chậm · Tạm dừng · Lỗi), never colour alone (BR-017); "Cập nhật 12 giây trước"; actions "Thử lại", "Thử lại tất cả lỗi (≤ 500)", "Quản lý". See `apps/web/DESIGN.md` → Operate Surfaces.

### 3.7 Settings (`/settings/*`) — P0

- **Style & copy (#281).** Tabs "Dự án / Thành viên / Kết nối / Phân tích" are a row of plaque buttons (current tab inverts to navy, wraps at 390px). Each section ("Dự án", "Trang landing", "Thành viên", "Chính sách phân tích", "Bản đồ cảm xúc", "Kết nối Threads") is an operate board with a condensed-caps title; form controls and tables stay Untitled/Inter. All copy is Vietnamese; role labels Quản trị / Phân tích / Chỉ xem (API values stay `admin|analyst|viewer`). Members toasts "{email} giờ là {vai trò}", "Đã xoá {email}", "Đã thêm {email}"; last-admin hint "Dự án phải còn ít nhất một quản trị viên.".

- **Project**: name, timezone (searchable select), toggles "Cho phép Phân tích viên chạy lại phân tích", "Cho phép Người xem xuất dữ liệu". Save → toast. Every role sees the tab; Analyst and Viewer get the form read-only (fields disabled, no Save), and the API rejects their PATCH (FR-015). The PATCH carries only the changed fields. Each toggle shows a one-line explanation of its effect, and after Save `/me` is refetched so the new permissions apply immediately. Below it, a separate **Trang landing** section (#261, FR-149) with its own Save: tag input "Cụm từ trên landing" (Enter adds; placeholder "Thêm cụm từ rồi nhấn Enter"; hint "Mỗi cụm từ thành một biển hiệu trên trang landing, tô màu theo cảm xúc của các bài nhắc có chứa cụm từ đó trong nội dung hoặc cụm từ khoá. Tối đa 20 cụm từ, mỗi cụm 1–60 ký tự."). Terms are shown normalised (BR-041/BR-042); errors "Nhập 1–60 ký tự, có ít nhất một chữ hoặc số.", "Đã có trong danh sách.", "Tối đa 20 cụm từ."; toast "Đã lưu cài đặt trang landing". Non-admins see the tags disabled, no Save, "Chỉ quản trị viên dự án mới thay đổi được các cài đặt này."; empty → "Chưa có cụm từ nào.". Saving either section remounts both (unsaved drafts reset).
- **Members** (admin): table (name/email, role select, added, remove with confirm); "Mời thành viên" dialog (email, role, default Viewer; `409 MEMBER_EXISTS` shown under the email field). Guard on last admin: the sole admin's role select and Remove are disabled as a hint, and a `409 LAST_ADMIN` reverts the role select and shows an error.
- **Integrations** (admin write): Threads card — status, account, scopes, expiry; "Update token" (password-style input, never prefilled), "Verify connection", "Disconnect". Analyst sees a read-only card without controls; Viewer does not see the tab (deep link → Forbidden). Copy (T-041): status labels Đã kết nối / Hết hạn / Lỗi quyền / Lỗi / Chưa kết nối; buttons "Cập nhật token", "Kiểm tra kết nối", "Ngắt kết nối"; confirm "Ngắt kết nối Threads?" — "Token sẽ bị xoá, việc thu thập dừng lại."; toasts "Đã lưu token. Hãy kiểm tra kết nối.", "Kết nối Threads hoạt động", "Đã ngắt kết nối Threads"; read-only hint "Chỉ quản trị viên dự án mới thay đổi được các cài đặt này.". Saving a token does not verify it: status stays "Chưa kết nối" until "Kiểm tra kết nối" succeeds.
- **Analysis** (P1): confidence bands, safety thresholds table, current versions, "Create new policy version" with optional bulk re-analysis.
  - **Sentiment map** section (#251, FR-032/FR-148), below the policy form with a divider: number input "Số lượt nhắc tối thiểu mỗi cụm từ" (hint "Cụm từ xuất hiện trong ít bài nhắc hơn sẽ bị ẩn khỏi bản đồ cảm xúc ở chế độ Cụm từ. Số nguyên từ 1 đến 50."; invalid → "Nhập số nguyên từ 1 đến 50."), its own "Lưu" (disabled until changed) via `PATCH /projects/:projectId` — never creates a policy version or prompts re-analysis. Toast "Đã lưu cài đặt bản đồ cảm xúc". Non-admins see the value read-only with "Chỉ quản trị viên dự án mới thay đổi được các cài đặt này."
  - Tab visible to every role; analyst/viewer see a read-only form (inputs disabled, no submit). The API enforces admin-only PATCH (FR-015).
  - Header: `policyVersion` (+ "Mặc định" badge; v1 shows "Chính sách mặc định (theo taxonomy)"), created time (relative, absolute on hover, project timezone) and author; a small line "{n} bài đã được phân tích bằng chính sách cũ." when `outdatedCount > 0`.
  - Inputs accept 0.01–1 in steps of 0.01. An empty threshold cell means `null` (level not applied). BR-018 / BR-021 are re-checked on every change; errors show under the cell (client checks and server `VALIDATION_ERROR` paths alike).
  - "Tạo phiên bản chính sách mới" is disabled until something changes; the PATCH carries only the changed parts (bands as a full pair, thresholds per changed category). Success toasts "Đã tạo safety-policy-vN" (race with identical values: "Không có thay đổi").
  - After a save with `outdatedCount > 0` a dialog "Phân tích lại các bài cũ?" asks "{n} bài đã được phân tích bằng chính sách cũ. Phân tích lại ngay?" with "Để sau". "Phân tích lại" (admin only) calls `POST …/analysis-runs/mark-stale?version=<pre-save effectiveVersion>&dryRun=true` and shows "{marked} kết quả sẽ được đánh dấu cũ; tối đa {cap} bài sẽ được phân tích lại ngay." with "Huỷ" / "Xác nhận". Confirm repeats the call with `dryRun=false`, toasts "Đã đưa {enqueued} bài vào hàng đợi phân tích lại" (or "Không có bài nào cần phân tích lại") and closes. `429 RATE_LIMITED` shows "Vừa có yêu cầu phân tích lại. Thử lại sau {n phút}." (from `details.retryAfterSeconds`) and disables Confirm; `400 VALIDATION_ERROR` shows "Phiên bản này đang là phiên bản hiện tại; không có gì để phân tích lại." with only "Đóng". A preview with `marked = 0` shows "Không còn kết quả nào của chính sách cũ cần phân tích lại." with only "Đóng", so no real call uses the 5-minute window. When `marked > cap` the preview adds "Các bài vượt giới hạn này giữ trạng thái cũ cho tới lần phân tích lại hàng loạt tiếp theo." (#204).

### 3.8 Reviews (`/reviews`) — P1

Queue of `uncertain`, low-confidence, failed items; tabs by reason; row → detail with override form (field, value, reason); "Mark reviewed".

Built in #219 (`apps/web/src/features/reviews`):

- **Signboard (#278):** tabs are plaques (`.plaque-button`, selected inverts to navy); tabs + toolbar sit in a white enamel panel with a 2px navy rule; the table sits in an `.operate-board` and scrolls horizontally inside it (390px never scrolls the page). Table, controls and helper text stay Inter. Copy is Vietnamese; enum values in the URL stay English.
- **Tabs** Tất cả · Chưa chắc · Độ tin cậy thấp · Phân tích lỗi, each with a count (`Tất cả · 1.234`) from page 1 `counts`. When the API omits `counts` (count timed out) the counts are hidden — never shown as 0 (BR-032).
- **URL state:** `?reason=uncertain|low_confidence|failed` (missing/invalid → All), `?status=reviewed` (toggle "Hiện mục đã xem lại"; default unreviewed), `?item=<postId>` (slide-out). Tabs and the toggle replace history; opening a row pushes, so Back closes the slide-out. Changing tab/status clears the selection.
- **Table:** post (user, time with tz tooltip, 2-line text, override icon), reasons, relevance, sentiment, confidence (`%` + band; a band, not a probability — BR-020), analysis status (+ `errorCode` when failed), and "Reviewed by" when Show reviewed is on. "Tải thêm" (plaque) paginates (25 / page). Confidence renders vi-VN (`42,0%`), band as Thấp / Trung bình / Cao. Column headers: Bài viết, Lý do, Mức liên quan, Cảm xúc, Độ tin cậy, Trạng thái, Người xem lại.
- **Mark reviewed (admin, analyst):** checkboxes + "Đánh dấu đã xem lại (N)"; select-all and manual selection are capped at 50 (`MARK_REVIEWED_MAX`, helper "Tối đa 50 mục mỗi lần"). Success toast "Đã đánh dấu N mục đã xem lại" (+ "(bỏ qua M)"). Rows disappear optimistically and come back with a toast "Không thể đánh dấu đã xem lại" (incl. "Mã yêu cầu") on error. Not offered under Show reviewed; no "Unmark" in v1. A new analysis run reopens an item (BR-040).
- **Slide-out:** mention detail with override form (T-143) + "Đánh dấu đã xem lại" for that item (closes on success); title "Chi tiết bài viết"; "Mở trang đầy đủ" → `/mentions/:id`. The detail body (MentionDetail, override form) is restyled with Mentions (#277).
- **Viewer:** read-only — no checkboxes, no Mark reviewed, no override form.
- **Empty:** "Không có mục nào cần xem lại" / "Đã xem hết." (unreviewed) / "Chưa có mục nào đã xem lại" (reviewed).

## 4. Responsive behaviour

- Landing `/` (#262, #271): one viewport from 640 px with every phrase on the wall; below 640 px the main sign sits on top and the wall scrolls (every phrase still shown).
- ≥ 1280 px: full sidebar, 12-col grid.
- 768–1279 px: collapsed slim sidebar, charts 2-per-row → 1-per-row, tables horizontally scrollable.
  - **Current state (#95):** the slim icon-only sidebar is not built yet (follow-up issue). Shipped behaviour: full sidebar from Tailwind `lg` (1024 px); below that a header with a hamburger menu. Overview grid is 1-per-row < 1024 px and 2–3-per-row ≥ 1024 px; no horizontal page scroll at 900 px (checked in `e2e/a11y.auth.spec.ts`).
- < 768 px: read-only Overview/Mentions acceptable; admin forms not optimised.

## 5. Copy guidelines

- Plain, factual, no blame ("Latest Threads sync failed" not "Something went wrong").
- Numbers use thousands separators; percentages 1 decimal; times relative (< 24 h) + absolute on hover.
- Timezone label shown next to time-range picker ("GMT+7 · Asia/Ho_Chi_Minh").
