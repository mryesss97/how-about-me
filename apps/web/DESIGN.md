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

The wall fills the viewport (`100dvh`, no scroll) from `sm` up, inset 3px, with boards separated by 6px seams. The main sign is positioned in the wall, centred horizontally and slightly above middle (47% from top): 400–560px wide on tablet, 520–680px (~44vw) on desktop. Boards fill every region around it as a squarified treemap, area proportional to mentions with a floor of 22% of the largest so small phrases stay legible. The #1 board shares a full edge with the main sign (its full height beside it, or its full width above/below), capped at 72% of its band and 2.4:1 aspect. Every configured phrase is visible at every width.

Phones: the main sign stacks on top (6px page padding), and the wall continues below in rows of 128px, two boards per row, scrolling.

Inside a board: keyline 5px in, rank plate 11px from top-left (9px on compact boards under 96×72px), content centred with 12px padding and 0.35em gap between phrase and share line. When the phrase's first line would reach the plate, the content drops by a reserved band (28px; 20px compact). Main sign: 24px padding (32px from `sm`), 20px stack gap, figures ruled off by a 2px white line with 16px above, in a 2-column grid (14px × 20px gaps), 4 columns from 1024px.

## Elevation & Depth

Flat. There are no shadows, gradients or glows anywhere on the wall. Depth reads only as paint against concrete: boards sit on the wall through the 6px seams, and the main sign sits over the wall by z-order alone. Focus is a 3px navy outline 2px off the board (white, 3px off, on the door plaque).

### Named Rules

**The Flat Enamel Rule.** No `box-shadow`, gradient or glow on boards, the main sign, plates or the plaque. If a board needs to stand out, it gets bigger or gets solid paint.

## Shapes

Squared enamel plates with barely eased corners, in a three-step hierarchy: plates and the plaque 2px, phrase boards 3px, the main sign 4px. Every board carries one 2px keyline inset (5px, 8px on the main sign) with a 2px radius, in the lettering colour: navy on neutral boards, red or green on mixed boards, white (85–90%) on solid enamel, dashed grey on blank boards. The main sign's figure line is ruled with the same 2px white. One line weight everywhere.

## Components

### Sign Board

Flat enamel phrase board, absolutely positioned by the treemap, `role="img"`, focusable, named with the full text (`"giá vé" · 62,0% tích cực · 100 lượt nhắc`). Not a link.

- **Tones:** neutral (navy on white), negative/positive solid (white on red/green), negative/positive mixed (red/green lettering on white), blank (grey lettering, dashed keyline, no sub-sign).
- **Contents:** keyline, rank plate, phrase (quoted Bungee, condensed caps, stacked vertical, or blade sign), share line.
- **Hang-in:** each board animates in once with `sign-hang` (720ms, `cubic-bezier(0.16, 1, 0.3, 1)`, staggered 55ms per board, swinging from ±2.4° alternately, pivoting at the top centre). Reduced motion hangs them still.
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

- **Shell = the shop's vertical sign.** The sidebar and the mobile header are Sky Enamel with a 2px white keyline (an inset ring, never a glow); the logo sits on a white plate; nav labels are Saira Extra Condensed 700 caps, 18px, white; the current item is a white enamel plate with navy lettering (9.3:1), hover is white at 12%. Account: e-mail in Inter, role on a small white plate (Quản trị / Phân tích / Chỉ xem), "Đăng xuất" as a white-keyline plaque that fills white on hover.
- **Ground = the wall.** `(app)` pages stand on Wall Concrete `#D9E6EF`; cards are white enamel boards.
- **Page fascia.** Every page opens under a white enamel board with a navy keyline (`PageHeader`): title in Bungee caps (22–32px), optional description in Inter.
- **Boards (#275).** KPI and chart cards are white enamel boards (`.operate-board`, 3px corners) with a 2px navy keyline inset 5px (`.sign-keyline`), no shadow. KPI label: Saira Extra Condensed 700 caps 15px (`.kpi-label`); KPI value: 40px tabular figure (`.kpi-figure`), ink — only the positive/negative rate figures may take green/red enamel, always beside their label (BR-017); the safety figure stays ink. Growth/delta is an Untitled arrow icon + Inter text, no pill. Chart titles: condensed caps 20px (`.operate-board-title`).
- **Plaque button (#275).** `.plaque-button`: white plate, 2px navy border, 2px corners, condensed caps 15px navy; hover/selected invert to navy with white lettering (160ms, colour only). Used for "Xem dạng bảng".
- **Plaque tabs (#278).** Segmented tabs (e.g. Reviews reasons) are React Aria tabs styled `.plaque-button`; the selected tab inverts to navy. Counts follow the label (`Tất cả · 1.234`), no coloured pill. Wrap on narrow screens.
- **Table board (#278).** Data tables sit inside an `.operate-board` (+ `.sign-keyline`); horizontal overflow scrolls inside the board, never the page. Cells and headers stay Inter. Secondary "Tải thêm" is a plaque.
- **Filter panel (#275).** The sticky filter bar is a white enamel panel with a 2px navy bottom rule; its controls stay Untitled/Inter.
- **Placeholder board (#279).** "Sẽ làm trong" is an `.operate-board` with keyline, title `.operate-board-title`; each task is a `.task-plate` (white plate, 2px navy border, condensed caps 15px, static — no hover), e.g. `T-046 · Bảng truy vấn`; plates wrap on 390.
- **Listening Queries (#279, applies to #42/#43).** Header: fascia + "+ Thêm truy vấn" (admin, Untitled primary). Toolbar: white enamel panel with a 2px navy rule holding the "Hiện truy vấn đã xoá" toggle (Inter). Table: `.operate-board` wrapping Untitled `table.tsx`; cells Inter, numbers `vi-VN` tabular; sync status is a coloured dot always with text (BR-017). Drawer and soft-delete dialog stay Untitled/Inter; drawer title in condensed caps. Toasts Vietnamese: "Đã xếp lịch đồng bộ" / "Xem lượt đồng bộ". No large KPI figures (`.kpi-figure` only if a total count is added later).
- **System Status (#280, applies to #55/#56/#93).** Tabs as plaque tabs: Tổng quan · Lượt đồng bộ · Lỗi phân tích · Nhật ký thao tác (admin). Overview cards are `.operate-board`s titled in condensed caps (Kết nối Threads · Bộ thu thập · Bộ phân tích · Cơ sở dữ liệu); the state is a small plate with its word — Hoạt động tốt (green enamel), Chậm / Tạm dừng (ink on white, navy border), Lỗi (red enamel) — never colour alone (BR-017). Counts in `.kpi-figure` only for the one figure each card is about (e.g. jobs failed 24 giờ); the rest Inter. Tables, job drawer and audit metadata stay Untitled/Inter; "Cập nhật 12 giây trước" in Inter small print, not a figure.
- **Settings (#281).** Each settings section is an `.operate-board` with `.sign-keyline` and an `.operate-board-title` heading (`SettingsBoard`); the section tabs are `.plaque-button`s, the current one (`aria-current="page"`) inverts to navy; "Mời thành viên" is a plaque. Form controls, tables and hints stay Untitled/Inter; Save buttons stay Untitled primary.
- **Mentions (#277).** The toolbar (count, search, sort, actions) is a white enamel panel with a 2px navy bottom rule, like the filter panel. The count is a 28px figure (`.kpi-figure.kpi-figure--sm`) beside a condensed caps label ("1.234 bài nhắc", "Đã tải 25+ bài nhắc"). Secondary actions are plaque buttons: Xuất CSV, Phân tích lại, Tải thêm, and the detail operations (Phân tích lại, Ghi đè, Sao chép ID bài, Sao chép liên kết). Detail columns are boards titled "Bài gốc" / "Phân tích" (`.operate-board-title`; `p-4` in the slide-over). Row cards, tables and post text stay Untitled/Inter.
- **What stays Inter:** tables, form controls, filters, chart axes, post text, descriptions and help text. Sign lettering is for titles, figures and short labels only.
- **Sign-in & 404 (#286).** Public screens stand on the wall; the form/message sits on a single white enamel board with navy keyline; title Bungee caps (`.page-fascia-title`); fields and primary button stay Untitled/Inter; 404 actions are plaque buttons (Quay lại / Về trang chủ → `/`). Plaque buttons show a 2px navy focus ring.
- **Copy:** Vietnamese, screen by screen as each screen is restyled (#275, #277–#281, #286).
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
