---
name: How About Me — Landing
description: Biển hiệu Sài Gòn — the signed-in landing as a wall of hand-painted enamel shop signs.
colors:
  wall-concrete: "#D9E6EF"
  signwriter-navy: "#0C4A6E"
  sky-enamel: "#0369A1"
  red-enamel: "#B42318"
  green-enamel: "#067647"
  enamel-white: "#FBFDFF"
  lettering-white: "#FFFFFF"
  blank-lettering: "#5B7083"
  blank-keyline: "#9FB3C2"
  selection-sky: "#BAE6FD"
  brand-sky-500: "#0EA5E9"
  app-mist: "#F5FBFF"
typography:
  display:
    fontFamily: "Bungee, sans-serif"
    fontSize: "clamp(26px, 3.1vw, 48px)"
    fontWeight: 400
    lineHeight: 1.16
  headline:
    fontFamily: "Bungee, sans-serif"
    fontSize: "11px–76px (fitted per board)"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.01em"
  title:
    fontFamily: "Saira Extra Condensed, sans-serif"
    fontSize: "11px–76px (fitted per board)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0.01em"
  figure:
    fontFamily: "Saira Extra Condensed, sans-serif"
    fontSize: "clamp(28px, 2.6vw, 40px)"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  share-line:
    fontFamily: "Saira Extra Condensed, sans-serif"
    fontSize: "10px–30px (fitted to board width)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.02em"
    fontFeature: "tnum"
  label:
    fontFamily: "Saira Extra Condensed, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: "18px"
    fontFeature: "tnum"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.5
  small-print:
    fontFamily: "Inter, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.35
rounded:
  plate: "2px"
  board: "3px"
  main-sign: "4px"
spacing:
  seam: "6px"
  wall-inset: "3px"
  keyline-inset: "5px"
  main-keyline-inset: "8px"
  plate-offset: "11px"
  board-padding: "12px"
  main-sign-padding: "32px"
components:
  sign-board-neutral:
    backgroundColor: "{colors.enamel-white}"
    textColor: "{colors.signwriter-navy}"
    rounded: "{rounded.board}"
    padding: "12px"
  sign-board-negative-solid:
    backgroundColor: "{colors.red-enamel}"
    textColor: "{colors.lettering-white}"
    rounded: "{rounded.board}"
    padding: "12px"
  sign-board-positive-solid:
    backgroundColor: "{colors.green-enamel}"
    textColor: "{colors.lettering-white}"
    rounded: "{rounded.board}"
    padding: "12px"
  sign-board-negative-mixed:
    backgroundColor: "{colors.enamel-white}"
    textColor: "{colors.red-enamel}"
    rounded: "{rounded.board}"
    padding: "12px"
  sign-board-positive-mixed:
    backgroundColor: "{colors.enamel-white}"
    textColor: "{colors.green-enamel}"
    rounded: "{rounded.board}"
    padding: "12px"
  sign-board-blank:
    backgroundColor: "{colors.enamel-white}"
    textColor: "{colors.blank-lettering}"
    rounded: "{rounded.board}"
  rank-plate:
    backgroundColor: "{colors.sky-enamel}"
    textColor: "{colors.lettering-white}"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
    padding: "1px 6px"
  main-sign:
    backgroundColor: "{colors.sky-enamel}"
    textColor: "{colors.lettering-white}"
    rounded: "{rounded.main-sign}"
    padding: "24px / 32px from sm"
  sub-sign:
    backgroundColor: "{colors.signwriter-navy}"
    textColor: "{colors.lettering-white}"
    typography: "{typography.small-print}"
    padding: "7px 12px 8px"
  door-plaque:
    backgroundColor: "{colors.enamel-white}"
    textColor: "{colors.signwriter-navy}"
    rounded: "{rounded.plate}"
    padding: "12px 18px"
  door-plaque-hover:
    backgroundColor: "{colors.signwriter-navy}"
    textColor: "{colors.lettering-white}"
---

# Design System: How About Me — Landing

> **Scope.** This file documents the landing surface only (`src/features/landing/**`, rules at the end of `src/styles/globals.css` under `.sign-wall`). The rest of the app keeps the incumbent Untitled UI system (Inter, the sky brand scale, white cards on Mist `#F5FBFF`), which is defined in `src/styles/theme.css` and has no DESIGN.md of its own. Shared brand commitments bind both: the logo files in `public/brand/` (always shown as delivered, on a white plate), the sky scale (brand 500 and 700 are the same values on the landing and in the app), and Mist as the app ground. Light mode only.

## Overview

**Creative North Star: "Biển hiệu Sài Gòn"**

The landing is a Saigon street facade of hand-painted shop signboards. Every phrase the community says hangs as its own flat enamel board, sized by how often it is said, packed edge to edge on a cool concrete wall with thin seams between them. The shop's own main sign (sky enamel, the logo plate, the headline, the 30-day figures) hangs among them, and the only way in is the white door plaque on it. The surface fills one viewport on tablet and desktop; on phones the main sign sits on top and the wall continues below as a scrolling stack.

The material is enamel on metal, painted by hand: flat colour, one ruled keyline inset on every board, capitals in two sign-painter alphabets, house-number plates for rank. Nothing glows, nothing has a gradient, nothing casts a shadow. Meaning comes from paint colour plus words (BR-017), never colour alone. The one motion is the hanging: boards swing into place once, one after another, and a small navy sub-sign slides up from a board's foot on hover or focus. It rejects the SaaS hero: no centred headline over decoration, no glow, no row of KPI tiles.

**Key Characteristics:**

- Flat enamel boards on a concrete wall, 6px seams, no shadow, gradient or glow.
- One 2px keyline per board, inset, in the lettering colour.
- Two lettering alphabets: Bungee caps (wide) and Saira Extra Condensed 700 caps (hand-ruled condensed); Inter only for small print.
- Board size = mention count; board paint = sentiment, always with the share in words.
- Sky enamel belongs to the shop: the main sign and the rank plates.
- Vietnamese copy and number format (`23,5%`, `1.284`).

## Colors

A cool concrete wall carrying four enamels: navy for lettering, sky for the shop, strong red and strong green for clear sentiment.

### Primary

- **Sky Enamel** (sky 700): the shop's own paint. The main sign ground and every rank plate. Never used on a phrase board's ground, so the shop never looks like one of the crowd's phrases.

### Secondary

- **Red Enamel**: negative sentiment. Full board ground when the negative share leads clearly (≥ 60%); lettering and keyline on a white board when it leads with less.
- **Green Enamel**: positive sentiment, same two-step use as red.

### Neutral

- **Wall Concrete**: the landing ground behind the boards. A step down from Mist because white enamel vanishes on Mist; Mist stays the app ground everywhere else.
- **Signwriter Navy** (sky 900): lettering, keyline and figures on white boards (neutral-led phrases), the door-plaque lettering, the sub-sign ground, focus outline.
- **Enamel White**: phrase board ground for neutral and mixed sentiment, the logo plate, the door plaque.
- **Lettering White**: lettering on solid red, green and sky enamel; keylines on those boards at 85–90% opacity.
- **Blank Lettering / Blank Keyline**: placeholder boards while phrases load or when none is configured; the keyline goes dashed.
- **Selection Sky** (sky 200): text selection inside the wall.
- **App Mist / Brand Sky 500**: shared brand values recorded for the boundary; not painted on the landing wall.

### Named Rules

**The Paint Plus Words Rule.** A board's paint is the dominant sentiment, and the same board always carries the share line in words (`62,0% TIÊU CỰC`). Colour never stands alone (BR-017).

**The Two-Step Enamel Rule.** Clear lead (≥ 60%) paints the whole board; a weaker lead paints only the lettering and keyline on white. Neutral-led boards are navy on white. There is no third intensity.

**The Shop's Own Paint Rule.** Sky enamel is reserved for the main sign and rank plates.

## Typography

**Display Font:** Bungee (sans-serif fallback), latin + vietnamese subsets, weight 400.
**Condensed Sign Font:** Saira Extra Condensed 600/700 (sans-serif fallback).
**Small Print:** Inter, the app face.

**Character:** Bungee is the wide, blocky shopfront capital; Saira Extra Condensed 700 is the painters' second, hand-ruled condensed alphabet for boards bound by width and for painted figures. Inter appears only as small print, the way a sign carries a painted phone number or address.

### Hierarchy

- **Display** (Bungee 400, clamp 26–48px, 1.16, uppercase, balanced wrap): the main-sign headline "Cộng đồng Threads nghĩ gì về bạn?".
- **Headline** (Bungee 400, fitted 11–76px per board, 1.2, 0.01em, uppercase): phrases on boards with room for wide caps. Line height leaves space for stacked Vietnamese marks (Ỗ, Ề).
- **Title** (Saira Extra Condensed 700, fitted, 1.05, uppercase): phrases on width-bound boards, chosen when it yields a bigger letter than Bungee.
- **Figure** (Saira Extra Condensed 700, clamp 28–40px, 1, tabular): the four painted figures on the main sign's info line.
- **Share line** (Saira Extra Condensed 700, 10–30px fitted to width, 1, 0.02em, tabular, uppercase): the dominant share under every phrase.
- **Label** (Saira Extra Condensed 700, 15px/18px, tabular; 12px/15px on compact boards): rank-plate numbers.
- **Body** (Inter 500, 16–18px): main-sign tagline.
- **Small print** (Inter 500, 11–14px): figure captions, notes ("kỳ trước: 7"), the legend, the sub-sign split, status values such as "Chưa đồng bộ" (Inter 600, 16px).
- **Door plaque** (Bungee 400, 17px, uppercase): "Vào dashboard".

### Named Rules

**The Two Alphabets Rule.** Phrases are Bungee caps or Saira Extra Condensed 700 caps, whichever paints the larger letter on that board. No third display face.

**The Straight Quotes Rule.** Phrases are painted inside straight quotes (`"GIÁ VÉ"`). Stacked vertical boards drop them: upright quote glyphs read as noise.

**The Tall Board Rule.** A tall, narrow board either stacks Bungee letters top to bottom (one column per word group, no quotes) or carries a blade-sign line of condensed caps turned 90°, read top to bottom.

**The Unbroken Share Rule.** The share line is always present and always on one line; it shrinks to the board's width, never wraps.

**The Small Print Rule.** States (never synced, empty, loading) are Inter small print, never painted figures.

**The Vietnamese Figures Rule.** Decimal comma and thousands dot via `vi-VN` (`23,5%`, `1.284`); tabular figures wherever numbers are painted.

## Layout

The wall fills the viewport (`100dvh`, no scroll) from `sm` up, inset 3px, with boards separated by 6px seams. The main sign is positioned in the wall, centred horizontally and slightly above middle (47% from top): 400–560px wide on tablet, 520–680px (~44vw) on desktop. Boards fill every region around it as a squarified treemap, area proportional to mentions with a floor of 22% of the largest so small phrases stay legible. The #1 board shares a full edge with the main sign (its full height beside it, or its full width above/below). Every configured phrase is visible at every width. Invariants (#334): no bare wall shows beyond a seam (a band left without a board takes one from the fullest band); #1 always holds the largest board (it starts at up to 72% of its band and grows step by step, up to the whole band); boards stay ≥ 72px a side before the seam inset where the canvas allows (20 phrases under 1024px wide may go smaller: every phrase showing wins, BR-042). DOM and tab order follow the rank.

Phones (#334): the main sign stacks on top (6px page padding), and the wall continues below in rank order, scrolling: #1 alone on a full-width row 160px tall, ranks 2–3 in rows of 144px, the rest 112px, two boards per row. A board whose phrase would set under 22px at half width, and an odd last board, take the full row.

Inside a board: keyline 5px in, rank plate 11px from top-left (9px on compact boards under 96×72px), content centred with 12px padding and 0.35em gap between phrase and share line. When the phrase's first line would reach the plate, the content drops by a reserved band (28px; 20px compact). Main sign: 24px padding (32px from `sm`), 20px stack gap, figures ruled off by a 2px white line with 16px above, in a 2-column grid (14px × 20px gaps), 4 columns from 1024px.

## Elevation & Depth

Flat. There are no shadows, gradients or glows anywhere on the wall. Depth reads only as paint against concrete: boards sit on the wall through the 6px seams, and the main sign sits over the wall by z-order alone. Focus is a 3px navy outline 2px off the board (white, 3px off, on the door plaque).

### Named Rules

**The Flat Enamel Rule.** No `box-shadow`, gradient or glow on boards, the main sign, plates or the plaque. If a board needs to stand out, it gets bigger or gets solid paint.

## Shapes

Squared enamel plates with barely eased corners, in a three-step hierarchy: plates and the plaque 2px, phrase boards 3px, the main sign 4px. Every board carries one 2px keyline inset (5px, 8px on the main sign) with a 2px radius, in the lettering colour: navy on neutral boards, red or green on mixed boards, white (85–90%) on solid enamel, dashed grey on blank boards. The main sign's figure line is ruled with the same 2px white. One line weight everywhere.

## Components

### Sign Board

Flat enamel phrase board, absolutely positioned by the treemap (rows on phones), a link to `/terms/<term>?preset=30d` (#276), named with the full text (`"giá vé" · 62,0% tích cực · 100 lượt nhắc`).

- **Tones:** neutral (navy on white), negative/positive solid (white on red/green), negative/positive mixed (red/green lettering on white), blank (grey lettering, dashed keyline, no sub-sign).
- **Contents:** keyline, rank plate, phrase (quoted Bungee, condensed caps, stacked vertical, or blade sign), share line (never under 13px; when one line would be smaller it wraps between the share and the label, #334).
- **Hang-in:** each board animates in once with `sign-hang` (720ms, `cubic-bezier(0.16, 1, 0.3, 1)`, staggered 55ms per board, swinging from ±2.4° alternately, pivoting at the top centre), only on the first `/` of a session (#334): a revisit shows them already hung (`data-motion="still"`, or `html[data-landing-hung]` set before hydration). Reduced motion hangs them still.
- **Focus:** 3px navy outline, 2px offset, raised above neighbours.

### Rank Plate

Small sky house-number plate (số nhà) in the top-left of every board: white tabular condensed figure, 2px corners, min-width 26px (18px compact). On solid red/green boards it inverts to a white plate with the board's paint as figure colour. Always present.

### Sub-sign

Navy strip with the full split in Inter small print ("100 lượt nhắc · 62,0% tích cực · 38,0% trung tính · 0,0% tiêu cực"), hidden below the board's foot and sliding up on hover or focus (260ms, same ease). Tight variant (3px 8px, 11px) on boards under 64px tall. No transition under reduced motion.

### Main Sign

The shop's sign, sky enamel with a white keyline: the logo on a white enamel plate (8px 12px, 2px corners, logo 132px / 156px wide), the Bungee headline, Inter tagline, a ruled info line of four painted figures (mentions + growth, positive %, negative %, last updated) with Inter captions beneath, then the door plaque and the legend (or the empty-state line/link). Growth is a drawn arrow icon (Untitled UI `ArrowUp`/`ArrowDown`, 16px) beside condensed 600 17px text, capped at `>999%`. A status value (never synced) is Inter 600 16px, not a figure. Safety is never shown.

### Door Plaque

The one call to action: white enamel plaque, 2px white border, 2px corners, Bungee 17px navy caps with a 20px drawn right arrow, 10px gap. Hover inverts to navy with white lettering (160ms ease-out on colour only); focus is a 3px white outline 3px off.

## Operate Surfaces (dashboard, #274)

The signboard world reaches the working screens as **accents** (owner decision 2026-10-14): the visitor works here daily, so scanning and long reading come first.

- **Shell = the shop's vertical sign.** The sidebar and the mobile header are Sky Enamel with a 2px white keyline (an inset ring, never a glow); the logo sits on a white plate; nav labels are Saira Extra Condensed 700 caps, 18px, white; the current item is a white enamel plate with navy lettering (9.3:1), hover is white at 12%. Current project (#348) sits right under the logo for every role: a small "DỰ ÁN" caps label and the name in Inter 13px white (truncated, full name in the title); with ≥ 2 projects it is a labelled React Aria select whose trigger is a white plate (2px corners, no shadow, chevron, ≥ 44 px). Account: e-mail in Inter, role on a small white plate (Quản trị / Phân tích / Chỉ xem), "Đăng xuất" as a quiet 44 px text action (icon left, white Inter, underline on hover, no border or fill; #348). Current = longest URL prefix match (Cài đặt on every `/settings/*`, Bài nhắc on `/mentions/[id]`), only one `aria-current` (#325). Mobile header is sticky, 56 px, with 44 px targets and a single close button; the drawer scrim is flat ink 60% with no blur. A skip link (white plate, ink keyline, condensed caps, no shadow) appears on first Tab. Nav plates (#345): small white plates (condensed caps 13px, 2px corners) at the right of an item — the "Cần xem lại" count and the "Trạng thái hệ thống" dot + word (Lỗi / Chậm / Sắp hết hạn, never a dot alone); they invert to navy on the current item.
- **Health strip (#345).** One compact banner board right under the fascia (same white board + 2px tone rule as page banners, tighter padding, title and description on one line from `sm`); only one at a time; the action is a plaque link for admins only. Not a live region.
- **List rows show verdicts, not every label (#337).** A row's badge column holds sentiment plus only the exceptions that need action (a quiet row shows one badge); descriptive labels sit in one muted text line. Long-list toolbars are sticky from `lg` (`z-10`, below overlays).
- **Settings → Kết nối (#346).** The Threads card reuses the `.status-plate` (warning) for "Sắp hết hạn"; one primary button by state; the destructive "Ngắt kết nối" is pushed right on desktop and gets its own row under a 1px rule on mobile.
- **Ground = the wall.** `(app)` pages stand on Wall Concrete `#D9E6EF`; cards are white enamel boards.
- **Page fascia.** Every page opens under a white enamel board with a navy keyline (`PageHeader`): title in Bungee caps (22–32px), optional description in Inter.
- **Boards (#275).** KPI and chart cards are white enamel boards (`.operate-board`, 3px corners) with a 2px navy keyline inset 5px (`.sign-keyline`), no shadow. KPI label: Saira Extra Condensed 700 caps 15px (`.kpi-label`); KPI value: 40px tabular figure (`.kpi-figure`), ink — only the positive/negative rate figures may take green/red enamel, always beside their label (BR-017); the safety figure stays ink. When the global filter pins a card's own dimension the figure is ink too, with an Inter line "Đang lọc theo …" (#335). Rate deltas (compare) are an Untitled arrow icon + Inter text, no pill; growth has no arrow (sign in the figure, "so với kỳ trước (N)" below). Linked KPI cards end with an Inter 12px "Xem bài nhắc" + drawn right arrow footer (underlined on card hover/focus). KPI cards sit in 3 groups of 2 (wider gap between groups), 2 per row on mobile. Horizontal distribution bars are HTML rows (full-width links, 44px tall on mobile), not Recharts; Recharts stays for time series and donuts. Chart titles: condensed caps 20px (`.operate-board-title`).
- **Plaque button (#275).** `.plaque-button`: white plate, 2px navy border, 2px corners, condensed caps 15px navy; hover/selected invert to navy with white lettering (160ms, colour only). #330: every secondary card action (Tải thêm, Thử lại, Thử lại tất cả lỗi, Chi tiết, Xuất CSV, Phân tích lại, mention operations, 404 actions) uses `PlaqueButton` (`features/shared/plaque-button.tsx`): sizes xs/sm/md, optional leading icon, loading = spinner + `aria-busy` (label unchanged), 2px navy focus. #386: ≥ 44 px tall below `md` built into `PlaqueButton`/`plaqueClassName` — call sites never add their own `max-md:min-h-11`. Never hand-roll `plaque-button` on a button; tabs and the chart "Biểu đồ | Bảng" segment (React Aria, #336) still style `.plaque-button` via `plaqueClassName`. tabs and the "Xem dạng bảng" toggle (React Aria) still style `.plaque-button` directly.
- **Plaque toolbar order & locked plaque (#349).** Mentions toolbar: Sao chép liên kết · Xuất CSV · Phân tích lại (heavy action last). Overview / phrase filter bar: Sao chép liên kết at the row end; icon-only `Link01` in the mobile strip. A plaque the role cannot use but should know about (viewer export) is `aria-disabled` + `opacity-60` + leading `Lock01` + reason tooltip that also opens on tap, with the reason wired via `aria-describedby` — never colour alone.
- **Section tabs vs filters (#278, #348).** One rule: sections that are routes or URL state (Settings tabs, System Status tabs) are a `<nav aria-label>` of `next/link`s styled `.plaque-button`, the current one `aria-current="page"` (inverts to navy) — never an ARIA tablist. Filters inside a page (Reviews reasons) are a React Aria toggle group styled `.plaque-button`. Counts follow the label (`Tất cả · 1.234`), no coloured pill. Wrap on narrow screens. Phrase page mentions tabs (#333) are plaque buttons with `aria-pressed`/`data-selected`, same count format. Wrap on narrow screens (System Status: 2×2 grid below `sm`, #343). #386: both Settings and System Status render `SectionTabs` (`features/shared/section-tabs.tsx`): 44 px at every size, 2×2 grid below `sm` with ≥ 3 tabs, a wrapping row with ≤ 2.
- **Touch targets (#386).** Every interactive control is ≥ 44 px tall below `md` (inline links inside prose excepted). Grow the hit area with min-height, padding or a negative margin — never the lettering. Information that lives only in a tooltip must also open on press (popover): the KPI ⓘ is a React Aria `DialogTrigger` + `Popover` (`kpi-info-button.tsx`). Toggle tracks are `shrink-0` so a wrapping label never squeezes them into a dot (BR-017).
- **Chart view segment (#336).** Every chart board has one two-plaque segment "Biểu đồ | Bảng" (`ChartCard`, React Aria toggle buttons, `aria-pressed`; selected inverts to navy). 44px tall under `sm`. Text tables use compact ~40px rows; the sentiment map's Topics "Bảng" shows the coloured topic × sentiment cells.
- **Bar rows (#387).** `HorizontalBarChart` is a `@container`: below 420px card width each row stacks — label + "count · share" on line 1, a full-width 8px bar on line 2 — so narrow `col-span-4` cards (Phân bố an toàn, Phân bổ ý định, Tỷ trọng từ khoá) get a real bar track; 420px and up keep the single-line label · bar (10px) · value grid. Rows stay links ≥ 44px tall when stacked (FR-142). Safety rows carry icon + word + value + pattern (BR-017, NFR-030); the separate safety legend is gone.
- **Page frame & create action (#348).** Every working screen (Settings included) renders inside `PageFrame` (`features/shared/page-frame.tsx`): `max-w-7xl`, `px-4 lg:px-8`, `py-8`, 24 px (`gap-6`) between fascia, tabs and boards. Board titles under the page h1 are h2. A "create new" action (Thêm truy vấn, Mời thành viên) is an Untitled primary `Button size="sm"` with a leading Plus, top-right of its fascia or board; it stacks under the title below `sm`.
- **Toasts & states (#348).** Toasts are flat enamel plates: white, 2px ink border, 2px corners, no shadow, Inter 14px, flat Untitled icon (`AppToaster`). Error toasts add a 6px red-enamel left rule and start with the word "Lỗi: " (`notifyError`, BR-017). Load errors are an `.operate-board` with a red keyline + icon + "Đã xảy ra lỗi khi tải dữ liệu." + a Vietnamese sentence (`apiErrorMessageVi`, never the API message) + a mono line "Mã yêu cầu: … · CODE" (#392); inside a board (chart cards, settings boards) they render inline with a 4px red left rule so boards never nest. Forbidden is a keyline board with a plaque "Về Tổng quan". Empty states use a flat icon (no featured-icon halo). Settings loading shows the board with its real title and a skeleton inside.
- **Banners (#336).** Page banners are flat white enamel boards (3px corners) with a 2px left rule in the tone colour, icon + title always (BR-017); the action is a plaque link (`next/link`), wrapping below the text under `sm`. On /overview they sit between the fascia and the filter bar.
- **Fascia meta (#336).** `PageHeader` `meta` slot: one Inter small-print status line on the right (e.g. "Đồng bộ lần cuối 5 phút trước"), below the title under `sm`.
- **Table board (#278).** Data tables sit inside an `.operate-board` (+ `.sign-keyline`); horizontal overflow scrolls inside the board, never the page. Cells and headers stay Inter. Secondary "Tải thêm" is a plaque.
- **Reviews (#339).** Selection bar: white enamel, 2px navy rule on top, Inter count + "Bỏ chọn" link, Untitled primary action; sticky at the bottom, full width under `md` above the safe area. Below `md` rows are white cards (1px border, no shadow, 44px checkbox hit area). Slide-out: nav is Untitled tertiary icon buttons ‹ › around a tabular "n / N"; the primary action sits in the slide-out footer; reason plates always carry their word (UX §2.2). An item outside the loaded pages (#390) keeps the ‹ › frame disabled with a muted Inter hint "Mục này nằm ngoài danh sách đang tải" — text, not colour alone (BR-017).
- **Filter panel (#275).** The sticky filter bar is a white enamel panel with a 2px navy bottom rule; its controls stay Untitled/Inter. Multi-select copy is Vietnamese via `EnumMultiSelect` props ("Tìm…", "Không có kết quả", "Bỏ chọn", "Chọn tất cả", "N đã chọn"); the vendored `MultiSelect` keeps English defaults (#329). Since #332 it is compact: one desktop row with a `.plaque-button` "Bộ lọc khác (n)" opening a popover of secondary filters; below `lg` a 48px summary strip (Inter, truncated) with a 44px "Bộ lọc" plaque opening a bottom sheet (rounded top, max 85dvh, controls Inter). Layer `z-30`. System Status tabs (#343) use a lighter variant: quick row + "Làm mới" always visible, the 3–4 fields collapse below `md` behind an inline "Bộ lọc · n" plaque (no bottom sheet). Each multi-select trigger's accessible name is label + value ("Cảm xúc Tất cả", #385); the date-range trigger is named "Khoảng ngày: …" with no React Aria English strings ("Calendar").
- **Placeholder board (#279).** "Sẽ làm trong" is an `.operate-board` with keyline, title `.operate-board-title`; each task is a `.task-plate` (white plate, 2px navy border, condensed caps 15px, static — no hover), e.g. `T-046 · Bảng truy vấn`; plates wrap on 390. The phrase page "Cụm từ khác:" row (#333) uses small `.task-plate` links. `.term-hero-link` is at least 44 px tall (#333).
- **Listening Queries (#279, applies to #42/#43).** Header: fascia + "+ Thêm truy vấn" (admin, Untitled primary). Toolbar: white enamel panel with a 2px navy rule holding the "Hiện truy vấn đã xoá" toggle (Inter). Table: `.operate-board` wrapping Untitled `table.tsx`; cells Inter, numbers `vi-VN` tabular; sync status is a coloured dot always with text (BR-017) and links to its last job; an error already followed by a successful sync is grey ("đã đồng bộ lại"), only current errors are red (#342). Drawer and soft-delete dialog stay Untitled/Inter; drawer title in condensed caps. Toasts Vietnamese: "Đã xếp lịch đồng bộ" / "Xem lượt đồng bộ". No large KPI figures (`.kpi-figure` only if a total count is added later). sync status is a coloured dot always with text (BR-017). Toolbar: white enamel panel with a 2px navy rule — "{n} truy vấn · {m} đang bật" (Inter small print) left, "Hiện truy vấn đã xoá" toggle right (#340); the count only shows once data has loaded — a skeleton line while loading, nothing after a first-load error (#392). Table has 6 columns to fit 1366; the ⋯ column is sticky right on a solid enamel background with a 1px ink rule; below `md` rows are white cards (1px border, no shadow) with a 44px ⋯. Row menu groups are split by separators and "Xoá" uses the error text colour (#340). Drawer groups (#341): Inter section headings Truy vấn / Lịch quét / Nâng cao, no boards inside the drawer; Bật toggle in the footer left of Huỷ/Tạo. "Bài khớp mới" counts are ingest numbers shown as tabular text with a tooltip (not links); a separate underlined "Xem bài nhắc" link without a number opens Mentions across all relevance labels (#391).
- **Sentiment map labels (#389).** In-bubble labels always carry a word or icon, never colour alone (BR-017): ≥ 44 px "75,0% tích cực" (11–12px Inter semibold, sentiment 700 text), 36–44 px sentiment icon + "%". Bubbles under 36 px are listed under the canvas in an Inter 12px tertiary row "Chủ đề nhỏ:" / "Cụm từ nhỏ:" of small `.task-plate` buttons (12px, sentence case, sentiment icon + "Giá · 33,3% tiêu cực (3)", `aria-pressed`); unlike placeholder plates they are interactive — hover and selected invert to navy with white lettering, 2px focus ring, ≥ 44 px tall below `sm`.
- **System Status (#280, applies to #55/#56/#93).** Tabs are section links (`<nav>` + `aria-current`, #348; other URL filters kept, open job/action dropped): Tổng quan · Lượt đồng bộ · Lỗi phân tích · Nhật ký thao tác (admin). Overview cards are `.operate-board`s titled in condensed caps (Kết nối Threads · Bộ thu thập · Bộ phân tích · Cơ sở dữ liệu); the state is a small `.status-plate` with its word — Hoạt động tốt / Thành công (green enamel, white text), Chậm / Sắp hết hạn / Một phần / Đang chạy (ink on white, 2px navy border), Lỗi / Tạm dừng / Đã hết hạn (red enamel, white text; Tạm dừng is a fault to fix, #342) — never colour alone (BR-017). The same plate is used in the sync-jobs table and drawer. Card actions ("Quản lý" / "Cập nhật token", "Xem lượt lỗi", "Xem lỗi") are plaques, not blue links. One Inter summary sentence under the fascia puts the most urgent issue first (#342). Counts in `.kpi-figure` only for the one figure each card is about (e.g. jobs failed 24 giờ); the rest Inter. Tables, job drawer and audit metadata stay Untitled/Inter; "Cập nhật 12 giây trước" in Inter small print, not a figure. the state is a small plate with its word — Hoạt động tốt (green enamel), Chậm / Tạm dừng (ink on white, navy border), Lỗi (red enamel) — never colour alone (BR-017). Tab actions sit in a white toolbar panel with a 2px navy rule (#330): on Lỗi phân tích, "Đã tải N lượt lỗi" (Inter small print) left and the "Thử lại tất cả lỗi (≤ 500)" plaque right, admin only; per-row "Thử lại" and "Tải thêm" are plaques. Tab actions sit in a white toolbar panel with a 2px navy rule (#330). #343: on Lỗi phân tích the toolbar shows for every role — "{n} lượt lỗi" (Inter) left, "Làm mới" plaque and (admin) "Thử lại tất cả (≤ 500)" right; Tabs are a 2×2 grid below `sm`, `min-h-11`. Below `md` the three lists are row cards (`rounded-lg border border-secondary bg-primary p-4`, ≥ 44 px targets; stretched button opens the job drawer). The job drawer "Lỗi" section opens with the Vietnamese label (`syncErrorLabel`, Inter, error colour + icon), then a tertiary "Chi tiết kỹ thuật" with the mono code and provider message (#392). The job drawer title is condensed caps ("LƯỢT ĐỒNG BỘ") with plaque footer actions "Xem bài nhắc" / "Xem truy vấn". Audit log: objects are named in words, never id fragments (ids in `title`); mobile cards don't repeat the action word (#393).
- **Settings (#281).** Each settings section is an `.operate-board` with `.sign-keyline` and an `.operate-board-title` heading (`SettingsBoard`); the section tabs are `.plaque-button`s, the current one (`aria-current="page"`) inverts to navy; "Mời thành viên" is the board's primary create action (#348). Form controls, tables and hints stay Untitled/Inter; Save buttons stay Untitled primary. #347: form boards end in a save strip while dirty (2px navy top rule, white, sticky bottom — same language as the Reviews selection bar), "Huỷ thay đổi" + Save; read-only roles get `<dl>` text instead of disabled inputs; the Members table has no nested frame (rules only) and stacks under `sm`.
- **Mentions (#277).** The toolbar (count, search, sort, actions) is a white enamel panel with a 2px navy bottom rule, like the filter panel. The count is a 28px figure (`.kpi-figure.kpi-figure--sm`) beside a condensed caps label ("1.234 bài nhắc", "Đã tải 25+ bài nhắc"). Secondary actions are plaque buttons: Xuất CSV, Phân tích lại, Tải thêm, and the detail operations (Phân tích lại, Ghi đè, Sao chép ID bài, Sao chép liên kết). Detail columns are boards titled "Bài gốc" / "Phân tích" (`.operate-board-title`; `p-4` in the slide-over). Row cards, tables and post text stay Untitled/Inter. The whole row card is the click target (stretched link, #326); keyboard focus draws a 2px brand ring on the card, hover tints the card — never colour alone (BR-017). Info chips (no close button) explain a server-side rule, e.g. "Mức liên quan: gồm cả chưa phân tích" (#328). Secondary actions are plaque buttons: Xuất CSV, Phân tích lại, Tải thêm, and the detail operations (Phân tích lại, Ghi đè only, #338). Board utility actions (Sao chép ID bài, Sao chép liên kết, Mở trên Threads) are Untitled tertiary icon buttons with tooltips in the board header, 44px hit area under `sm`. Sub-groups inside a board ("Kết luận", "Nội dung") are Inter headings, never sign lettering; disclosures ("Chi tiết kỹ thuật", "Thông tin bài") are link-style Inter text with a chevron.
- **390px (#327).** No working screen ever scrolls the page horizontally at 390px (e2e checks every app route for admin and viewer). Board headers stack under `sm` (title, then actions). Segmented groups (`ButtonGroup`: date presets, sentiment chips, "Chế độ xem") never grow past their container — they scroll inside the board. The topic × sentiment cells (sentiment map "Bảng") order columns Tiêu cực · Trung tính · Tích cực; under `sm` it hides the "Có cảm xúc" column, folds the total into the row header and splits each cell into count / share on two lines. Tables with `sr-only` headers keep a `relative` scroll wrapper. The filter panel is replaced by the summary strip + bottom sheet (#332).
- **What stays Inter:** tables, form controls, filters, chart axes, post text, descriptions and help text. Sign lettering is for titles, figures and short labels only.
- **Sign-in & 404 (#286).** Public screens stand on the wall; the form/message sits on a single white enamel board with navy keyline; title Bungee caps (`.page-fascia-title`); fields and primary button stay Untitled/Inter; both boards carry the stacked logo plate (#350); 404 actions are plaque buttons (Quay lại — back, or `/` without history — / Về trang chủ → `/`). An invalid `/terms/<term>` shows its own board inside the shell (no logo, plaque "Trang chủ" → `/`). Plaque buttons show a 2px navy focus ring.
- **Copy:** Vietnamese, screen by screen as each screen is restyled (#275, #277–#281, #286). One concept, one word — follow the vocabulary table in UX §5 (#344).
- Tokens live on `:root` (`--wall`, `--ink`, `--sky-enamel`, `--red-enamel`, `--green-enamel`, `--enamel-white`); the sign fonts load once in the root layout (`src/lib/fonts/sign.ts`).

## Do's and Don'ts

### Do:

- **Do** paint every phrase board flat, with one 2px keyline inset 5px in the lettering colour.
- **Do** keep the share line on every board, on one line, in words beside the paint (BR-017).
- **Do** keep the rank plate on every board, sky enamel with a white figure (inverted on solid boards).
- **Do** let the #1 board share a full edge with the main sign.
- **Do** choose Bungee or Saira Extra Condensed 700 per board by which paints the larger letter; stack or blade-turn the letters on tall, narrow boards.
- **Do** keep the wall at Wall Concrete (#D9E6EF) so white enamel reads; keep Mist for the rest of the app.
- **Do** format numbers as `vi-VN` with tabular figures.
- **Do** draw arrows as icons (Untitled UI icons), not glyphs.

### Don't:

- **Don't** add shadows, gradients, glows or a second keyline weight to anything on the wall.
- **Don't** paint a phrase board sky; sky enamel is the shop's.
- **Don't** paint states (loading, never synced, empty) as figures; they are Inter small print.
- **Don't** put quote glyphs on letter-stacked vertical boards.
- **Don't** let colour carry sentiment without the words.
- **Don't** show safety figures or individual posts on the wall.
