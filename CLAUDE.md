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

- AI tag suggestions (2026-10-18): picking a photo on Add Item (camera or library) shrinks it in the browser (`src/lib/image.ts`) and posts it to `/api/suggest-tags` (`src/app/api/suggest-tags/route.ts`), which checks the caller's Supabase login, then calls Claude (`claude-haiku-5-5`, the small cheap model, effort low; move up to `claude-sonnet-5-5` if suggestions are poor, structured output via `client.messages.parse` + zod) using the server-only `ANTHROPIC_API_KEY`. The schema, prompt and cleanup rules are in `src/lib/tagging.ts`. The form is pre-filled but fully editable. Refusal fallbacks (`fallbacks`) were not enabled; a refusal just shows a message. Cost with Haiku is a fraction of a cent per photo. The user plans to reuse their existing Anthropic Console account (a separate key named `style-me`).

- Design system is now on every page (2026-10-18): Home, Sign in, Selfie, Try-On, Outfit, Closet and the NavBar. The shared look lives in `src/lib/ui.ts` (use it for new pages). Sign in shows "Signed in as ..." with Sign out when logged in, and the NavBar shows "Account" instead of "Sign in". Selfie offers Take selfie / Upload from library. Try-On picks items by the `category` column. The developer pages `/test` and `/me` were removed.

- Weather-based outfits are done and live (2026-10-18). `items.warmth` (light / medium / heavy, nullable; migration `supabase/migrations/20261018000001_add_item_warmth.sql`, already applied; existing items were backfilled from `type`) is editable in the Closet and suggested by AI tagging. The Outfit screen has a Weather panel: city search (Open-Meteo geocoding) or device location, shows temperature / feels-like / conditions / high-low, °C or °F, and a "Dress for the weather" toggle. Weather comes from Open-Meteo (free, no key, CC BY 4.0 so the panel credits it). Logic is in `src/lib/weather.ts` (bands by feels-like: hot >= 24, warm >= 16, cool >= 8, cold below) and `candidatesFor(..., band)` in `src/lib/outfit.ts`; accessories are never filtered by weather, items with no warmth fit any weather, and if nothing fits a slot the screen falls back to the other occasion matches and says so. Place, units and the toggle are remembered per device in localStorage. Rain: `items.rain_ready` (boolean, default false; migration `20261019000001_add_item_rain_ready.sql`, applied) marks waterproof pieces (editable in the Closet, suggested by AI tagging). When it is wet (rain/snow/storm code or any precipitation, `isWet`), tops and footwear prefer rain-ready items (after the warmth filter); if none exist the screen says so and still shows an outfit. Bottoms and accessories ignore rain. The conditions passed around are `Conditions = { band, wet }`; `weatherNotes()` reports which slots fell back.
- Bulk photo upload and Closet filters are done (2026-10-19). Closet: "Add many photos at once" (`src/components/BulkUpload.tsx`; up to 200 photos, 3 at a time, each shrunk, AI-tagged and saved; photos the AI can't tag are saved with type `other` and no tags so the "Needs tags" filter finds them; if the AI service is down it stops asking and still saves). Closet filters: name search, category, and "Needs tags" (missing category/occasions/formality, warmth for garments, or subcategory for accessories). Stored photos are shrunk to max 1600px JPEG (`src/lib/photos.ts`, `src/lib/image.ts`) because Supabase free storage is only 1 GB.

- Phone use (2026-10-19): the site is an installable PWA, so the user installs it on their Pixel 9 Pro from Chrome (menu > "Install app" / "Add to Home screen") instead of an APK. Pieces: `src/app/manifest.ts` (name, standalone, charcoal colours), generated icons at `/icons/{180,192,512}.png` (`src/app/icons/[file]/route.tsx`, drawn with `next/og`), a pass-through service worker `public/sw.js` (caches nothing, so updates are always immediate) registered by `src/components/RegisterServiceWorker.tsx`, and `viewport.themeColor` in `layout.tsx`. The layout was checked at 360 and 375 px wide: the NavBar stacks into two rows below `sm`, outfit cards are `w-[26vw] min-w-[5.5rem] max-w-36` so three fit per row, and buttons are taller on phones. A real APK (e.g. a Trusted Web Activity via PWABuilder or Bubblewrap) was not built because the installed PWA does the same job; revisit only if a Play Store listing is wanted.

- Delete item (2026-10-19): each Closet card has Delete, then "Yes, delete" (two taps). It removes the item row and its photo from storage; saved outfit picks for a deleted item fall back automatically.

**Not done yet**
Everything planned is built and live as of 2026-10-19. What remains is on the user's side or needs their decision:
- Photos: the user will bulk-load their photos at the very end (Closet > "Add many photos at once"). The 3 restored items (Blue Oxford Shirt, Black Jeans, White Sneakers) still have `image_path` values pointing at photo files that were lost with the old Supabase project, so signing them returns a harmless 400 and they show "No image"; give them photos with each card's "Add image" button (bulk upload creates NEW items, so photographing those 3 there would make duplicates).
- Try-On is only a simple overlay of the item photo on the selfie (no background removal). A real AI try-on was never decided (it would need a paid external service and the user's account); ask before building it.
- Saved outfits are not built. The `outfits` / `outfit_items` tables and their RLS policies exist (restored from the old project) but nothing uses them. Optional next feature.
- AI tagging is ON as of 2026-10-18 (`ANTHROPIC_API_KEY` is set in Vercel Production and the account has credit). It was tested end to end with a drawn navy t-shirt picture (came back as "Navy Crew Tee", tee, top, casual). It has not yet been tried on real clothing photos; judge the quality when the user adds photos and move up to `claude-sonnet-5-5` in `route.ts` if suggestions are poor. If suggestions stop working, check the Anthropic Console credit balance first: an empty balance shows "AI suggestions are paused: the Anthropic account is out of credit".

**Login (working as of 2026-10-18)**
- Supabase project is `style-me-2` (org "Mochi N Boba Inc.", free tier). Free-tier projects pause after inactivity. It was found paused on 2026-10-18 and showed 'Restoration in progress'; it is now Healthy. Check the dashboard shows Healthy before testing login.
- Magic-link login uses Supabase's built-in email sender (option A, no custom email service). It is limited to about 2 login emails per hour and, as I understand Supabase's rules, only delivers to people on the Supabase team. On 2026-07-30 this caused "email rate limit exceeded". Do not send repeated test logins. A custom email service (e.g. Resend) is only worth setting up once other people need to sign in; it has NOT been set up.
- Supabase Auth URL Configuration (set 2026-10-18): Site URL `https://style-me-six.vercel.app`; Redirect URLs `https://style-me-six.vercel.app/**` and `http://localhost:3000/**`. These were the defaults (`localhost:3000`, no redirects) before, which would have sent login links to a page that doesn't exist.
- The 3 restored items (Blue Oxford Shirt, Black Jeans, White Sneakers) are tagged Casual Hangout / Dining / Date with Casual / Smart Casual formality. The Outfit page renders them. They have no photos (the storage backup was not restored).

**Environment (Windows)**
- The project folder path must not contain `&` or `'`. Set `$env:ComSpec = "C:\Windows\System32\cmd.exe"` before npm commands in PowerShell sessions. Pin the folder "Always keep on this device" in OneDrive.
