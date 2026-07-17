# Build Session 1 — Vertical Slice: "I want an outfit"

**Goal:** prove the core loop end-to-end using the 3 existing closet items (Oxford shirt, black chinos, white sneakers). No AI tagging yet — tags entered manually through the UI we build. No weather logic yet. No swap logic yet — that's Session 2.

Refer to CLAUDE.md in this project for the design system and schema conventions. Work through the steps below **one at a time**, and stop after each one for me to review before continuing.

---

## Step 1 — Schema
Add to the `items` table:
- `category` — enum('top','bottom','footwear','accessory')
- `subcategory` — text, nullable
- `occasions` — text[]
- `formality` — text[]

Backfill `category` for the 3 existing items based on their current `type` field (shirt → top, jeans/chinos → bottom, sneakers → footwear).

Show me the migration before running it.

---

## Step 2 — Tagging UI
Update the Add/Edit Item form (Closet screen) to include:
- Category select
- Subcategory select — only shown when category = accessory
- Occasion — multi-select checkboxes (values in CLAUDE.md)
- Formality — multi-select checkboxes (values in CLAUDE.md)

Don't build AI suggestion yet — just working manual multi-select fields that save correctly to the array columns.

Once this exists, I'll manually tag the 3 existing items myself through the UI before we move to Step 3.

---

## Step 3 — Outfit screen
Build `/outfit`:
- Occasion selector and Formality selector at the top (hide Formality entirely when Occasion = gym)
- On selection, query `items` for the current user filtered by category + matching occasion + matching formality:
  - One item per required slot: top, bottom, footwear
  - Any accessory slots (headgear, eyewear, watch, bracelet, belt, bag) that have a match — include them, omit silently if none
- If **any required slot** has no match, show a clear message naming which slot is missing (e.g. "No footwear tagged for Smart Casual Dining yet") instead of a blank or broken layout
- Render items in the flat-lay order specified in CLAUDE.md

No Swap buttons yet this session — static display only, so we can verify the filtering logic actually works before adding interaction.

---

## Step 4 — Apply the design system
Style the Outfit screen only (leave Closet as-is for now) using the tokens in CLAUDE.md: charcoal app background, paper flat-lay card with dashed stitch-style border, denim for selects/required-slot elements, brass for the primary "Swap Entire Outfit" affordance (even if not yet functional — just style it, wire it up in Session 2), Fraunces for headers, Inter for body, IBM Plex Mono uppercase for tags/labels.

---

**Stop here.** Once Steps 1–4 are done and I've tagged the 3 items and can see a real outfit suggestion render correctly in the browser, we'll plan Session 2: Swap (Auto + Choose from Closet), dismiss buttons on accessory slots, and Closet screen polish.
