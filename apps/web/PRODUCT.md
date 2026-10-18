# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Internal team of 1Zone / Eventista: marketing, customer support and analysts. They open How About Me in two situations (owner, 2026-10-14):

- a quick daily check on a laptop, to see how the Threads community feels about the brands before going into the dashboard;
- on a big screen in the office or in meetings, to show leadership the community's mood at a glance.

## Product Purpose

How About Me is an internal Threads social-listening product. It collects Threads posts that match configured listening queries (seed terms `1zone`, `#1zone`, `eventista`, `#eventista`), classifies each post (relevance, sentiment, safety, topics, intent, key phrases) and turns them into analytics, a mentions explorer and a review queue. Success: the team notices shifts in sentiment and emerging complaints early, and can drill from a number down to the posts behind it.

## Positioning

Built on the brands' own Threads conversation with classification tuned to their events and ticketing context. Every number drills down to the real posts (FR-142). Analytics count distinct posts and exclude irrelevant ones by default, and sentiment is kept separate from safety (BR-017).

## Operating Context

- Signed-in only; no public pages. Roles: admin, analyst, viewer.
- Landing `/` (FR-020): a wall of signboards (each a link to its phrase detail) for admin-configured phrases/keywords (`landingTerms`, ≤ 20, BR-042) with their sentiment over the last 30 days, 4 stats (mentions + growth, positive %, negative %, last updated), one CTA into the dashboard `/overview`.
- Used on laptops (1280–1920 wide), big office screens, tablets, and phones.
- Timestamps in UTC, analytics in `Asia/Ho_Chi_Minh` by default.

## Capabilities and Constraints

- Next.js 16 + Untitled UI (React Aria, Tailwind v4). **Light mode only** (owner decision 2026-10-14, #260).
- Docs in `docs/` are the source of truth; business rules BR-xxx, requirements FR-xxx.
- **Copy is Vietnamese**: the landing (owner decision 2026-10-14) and, screen by screen as each is restyled in the signboard world, the dashboard (owner decision 2026-10-14, #274). Screens not yet restyled are still English. One concept, one word — see the vocabulary table in `docs/01-product/09-ux-specification.md` §5 (#344).
- Sentiment colours always come with text (BR-017); safety numbers are never shown on the landing.
- **Phones are first-class (#386):** every control is ≥ 44 px tall below `md`, and anything shown only on hover (KPI definition + denominator) also opens on tap.

## Brand Commitments

- Brand guide v2: the logo (ear + chat bubble mark, files in `apps/web/public/brand/`) and the **sky** colour scale (brand 500 `#0EA5E9`, 700 `#0369A1`, Mist page ground `#F5FBFF`) are binding.
- Typography: Inter stays the app face. On the landing, a display face with its own character is allowed (owner decision 2026-10-14); Inter stays for small text.

## Evidence on Hand

- Real local data: ~850 posts in the last 30 days, 13 configured landing phrases (e.g. "thất vọng", "giá vé", "hoàn tiền", "xếp hàng", "check-in", "đỉnh quá", "app lỗi") with real sentiment splits.
- Brand illustrations in `apps/web/public/brand/illustrations/`.
- No testimonials, customer quotes, press or external metrics exist; do not invent them. Post text is real user content: do not show individual posts on the landing.

## Product Principles

- Every figure is real and traceable to posts; no decorative numbers.
- Sentiment is not safety; colour never carries meaning alone.
- The landing is a glance, the dashboard is the work: little information, one way in.
- Vietnamese community voice first: the phrases are the community's own words.
