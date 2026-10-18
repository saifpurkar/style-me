# Style Me — Project Context

## Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase: Auth (magic link), Postgres DB, Storage (private `wardrobe` bucket, RLS scoped to user_id)
- Deployed on Vercel

## Existing tables
- profiles
- items
- outfits
- outfit_items

## Design system — follow exactly, ask before deviating
**Colors**
- `ink` #211F1C — primary text
- `paper` #F6F3EC — card/surface background
- `charcoal` #33302B — app background
- `denim` #33475B — primary accent (required-slot controls, selects, active states)
- `brass` #B08D57 — secondary accent (optional-slot controls, primary CTA buttons)

**Type**
- Display (headers only): Fraunces, semi-bold
- Body: Inter
- Utility (tags, labels, category names): IBM Plex Mono, uppercase, letter-spaced

**Layout**
- Sharp to near-sharp corners (2px radius max)
- Thin 1–1.5px rules / dashed borders instead of heavy shadows or big rounded cards
- Outfit screen uses a flat-lay arrangement (see below), not a generic stacked list

## Data model conventions
`items` table — columns to add/confirm:
- `category`: enum('top','bottom','footwear','accessory')
- `subcategory`: text, nullable — only used when category='accessory'. Values: 'headgear','eyewear','watch','bracelet','belt','bag','socks','other'
- `occasions`: text[] — allowed values: work, wfh, dining, date, casual_hangout, special_event, travel, outdoor, gym
- `formality`: text[] — allowed values: casual, smart_casual, business_casual, formal

`outfit_items` table: `outfit_id`, `item_id`, `slot` — slot is one of: headgear, eyewear, watch, top, bracelet, belt, bottom, footwear, bag

## Outfit screen — flat-lay layout order (top to bottom)
```
Headgear
Eyewear
(Watch)   Top   (Bracelet)
Belt
Bottom
(Footwear)   (Bag)
```
- Required slots (top, bottom, footwear): Swap button only, no dismiss.
- Optional/accessory slots (headgear, eyewear, watch, bracelet, belt, bag): Swap + dismiss (×).
- "Swap" on any slot offers two modes: Auto-Swap (cycles to next match automatically) or Choose from Closet (opens Closet screen filtered to that category/subcategory as a picker).
- A separate "Swap Entire Outfit" action regenerates all slots at once.
- If a *required* slot has no matching item, show which slot is missing rather than a blank or broken state. Accessory slots with no match are simply omitted, no message needed.

## Add Item flow
- Offer both "Take Photo" and "Upload from Library" — not one or the other.
- Tag fields (category, subcategory, occasion, formality) should eventually be AI-suggested and pre-filled, editable before save. Manual-only is fine until the AI tagging step is built.

## Working style
- Work in small, sequential steps. State the plan and which file(s) you'll touch before editing.
- Don't modify working features (auth, existing closet upload, navigation) unless the current task requires it.
- If something in this file conflicts with what I ask for in a session, point it out before proceeding rather than silently picking one.

## Current status (as of 2026-10-18)
**Code**
- `main` is up to date with `origin/main`. Per-item tag editing on the Closet screen is merged (PR #3). `npm run build` passes with no errors (only `<img>` warnings).
- Build Session 1 is done: items taxonomy migration, tagging fields in the Add Item form, Outfit screen with occasion/formality slot filtering, and the design system applied to the Outfit screen only.

- Session 2 Swap is done and live (2026-10-18): Auto-swap cycles matching items; Choose from Closet goes to `/closet?pick=<slot>` and returns the pick; accessory slots have a dismiss (×) with "+ slot" chips to restore; Swap Entire Outfit re-picks every slot. The outfit (occasion, formality, picks, dismissed slots) is kept in `sessionStorage` (`styleme.outfit.v1`; the Closet hands back its pick via `styleme.pick.v1`). Swap logic is in `src/lib/outfit.ts` and was tested on its own and on the live site.

- Closet polish is done and live (2026-10-18): design system applied to Closet and NavBar, Add Item offers both Take Photo (`capture="environment"`, opens the camera on phones; on desktop it opens the file picker) and Upload from Library, page title is "Style Me", base font is Inter. `globals.css` body is charcoal with ink text; the old OS dark-mode override was removed because it made text unreadable on the white pages.

- AI tag suggestions (2026-10-18): picking a photo on Add Item (camera or library) shrinks it in the browser (`src/lib/image.ts`) and posts it to `/api/suggest-tags` (`src/app/api/suggest-tags/route.ts`), which checks the caller's Supabase login, then calls Claude (`claude-opus-5-5`, effort low, structured output via `client.messages.parse` + zod) using the server-only `ANTHROPIC_API_KEY`. The schema, prompt and cleanup rules are in `src/lib/tagging.ts`. The form is pre-filled but fully editable. Refusal fallbacks (`fallbacks`) were not enabled; a refusal just shows a message. Cost is roughly 1-2 cents per photo.

**Not done yet**
- Design system is not applied to the Home, Auth, Selfie, Try-On and Me pages (they are still on plain white). Outfit, Closet and the NavBar are done.
- Photos for the 3 restored items (the user will add them all at once later).
- AI tagging is built and deployed but NOT yet turned on: it needs the `ANTHROPIC_API_KEY` environment variable in Vercel (Production). Until then the Add Item form says "AI suggestions aren't set up yet" and stays manual. Once the key is set and redeployed, test it end to end with a real clothing photo (it has only been tested without a key, plus unit tests of the cleanup rules).

**Login (working as of 2026-10-18)**
- Supabase project is `style-me-2` (org "Mochi N Boba Inc.", free tier). Free-tier projects pause after inactivity. It was found paused on 2026-10-18 and showed 'Restoration in progress'; it is now Healthy. Check the dashboard shows Healthy before testing login.
- Magic-link login uses Supabase's built-in email sender (option A, no custom email service). It is limited to about 2 login emails per hour and, as I understand Supabase's rules, only delivers to people on the Supabase team. On 2026-07-30 this caused "email rate limit exceeded". Do not send repeated test logins. A custom email service (e.g. Resend) is only worth setting up once other people need to sign in; it has NOT been set up.
- Supabase Auth URL Configuration (set 2026-10-18): Site URL `https://style-me-six.vercel.app`; Redirect URLs `https://style-me-six.vercel.app/**` and `http://localhost:3000/**`. These were the defaults (`localhost:3000`, no redirects) before, which would have sent login links to a page that doesn't exist.
- The 3 restored items (Blue Oxford Shirt, Black Jeans, White Sneakers) are tagged Casual Hangout / Dining / Date with Casual / Smart Casual formality. The Outfit page renders them. They have no photos (the storage backup was not restored).

**Environment (Windows)**
- The project folder path must not contain `&` or `'`. Set `$env:ComSpec = "C:\Windows\System32\cmd.exe"` before npm commands in PowerShell sessions. Pin the folder "Always keep on this device" in OneDrive.
