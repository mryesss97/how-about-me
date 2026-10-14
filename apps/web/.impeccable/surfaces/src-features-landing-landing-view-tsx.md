---
version: 1
slug: "src-features-landing-landing-view-tsx"
primary_target: "src/features/landing/landing-view.tsx"
related_targets: ["src/app/page.tsx"]
---

# Landing `/` (signed-in home)

Scope: `src/features/landing/**`, `src/app/page.tsx`. Mode: Persuade (a glance that ends in one action). Audience: 1Zone/Eventista marketing, CS and analysts — a daily laptop check and a big screen in meetings. Action: "Vào dashboard" → `/overview`. Proof: the community's own phrases with real 30-day sentiment and the 4 figures (mentions + growth, positive %, negative %, last sync). Constraints: logo + sky binding, Vietnamese copy, light only, BR-017 (colour always with text), no safety, no individual posts, all configured phrases visible at every width (#270).

## Direction contract

THESIS: The landing is a Saigon street facade of hand-painted shop signboards: every phrase the community says hangs as its own enamel board, sized by how often it is said. It refuses the SaaS hero (centred headline, glow decoration, KPI tile row).

OWN-WORLD: Flat enamel boards on a cool concrete wall (#D9E6EF, stepped down from Mist because white enamel #FBFDFF vanishes on Mist #F5FBFF; Mist stays the app ground) seen through 6px seams; one 2px keyline inset on every board in the lettering colour (navy on neutral, red/green on mixed, white on solid enamel), no gradients, glow or shadows. Enamel: strong-red (#B42318) and strong-green (#067647) for clear sentiment, white board with red/green/navy lettering when the share is mixed, sky (#0369A1) for the shop's own main sign. Lettering: Bungee caps for phrases and the shop name; Saira Extra Condensed 700 caps as the painters' second, hand-ruled condensed alphabet on width-bound boards and for painted figures; Inter only for small print. Phrases sit in straight quotes (vertical boards drop them: upright quotes read as noise). States are small print, never painted figures. Rank plates are small sky house-number plates.

STORY: The visitor sees at once which words the crowd repeats and how they feel, reads the shop's main sign (what this is, the 30-day figures), and walks in through the door plaque.

FIRST VIEWPORT: Full-bleed wall, no scroll on desktop/tablet. Main sign ~44% wide × ~50% high, centred slightly above middle; the #1 board hangs beside it along its full height: logo plate, headline "Cộng đồng Threads nghĩ gì về bạn?", tagline, a ruled info line with the four painted figures, door-plaque CTA bottom-left of the sign. Boards fill every remaining region as a squarified treemap; the biggest board sits beside the main sign. Phones: main sign on top, boards continue as a scrolling wall.

FORM: Biển hiệu Sài Gòn — position 6 of the grounded list (assigned by the roll), seed key ebb6177e. Raises kept: one keyline weight (ligne claire), straight quotes (quote grammar), rank plates (j-card), tabular painted figures (forge). Signature interaction: boards are hung one by one with a short swing; hover/focus pulls a painted sub-sign up from the board's bottom with the full split.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
