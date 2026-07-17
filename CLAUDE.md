# Style Me — Project Context

## What this is
AI-powered personal styling / wardrobe management app. Digitize wardrobe, get outfit recommendations matched to occasion/weather, eventually AI try-on via selfie.

## Stack
Next.js 15.4.6, React 19.1.0, TypeScript, Tailwind v4, Supabase (auth + DB + storage), deployed via Vercel.
Repo: https://github.com/saifpurkar/style-me.git

## Current state (as of 2026-07-16)
**Foundation phase -- built:**
- Auth flow, Supabase client wiring, env config
- Wardrobe item upload (manually tested with sample items)
- Selfie upload flow, linked via profiles.selfie_url
- Closet skeleton, navigation/routing

**Urgent -- not yet backed up:** feature directories exist locally but were never committed to git --
src/app/auth/, src/app/closet/, src/app/me/, src/app/outfit/, src/app/selfie/, src/app/try-on/, src/components/, src/lib/.
Last real commit was 2025-08-12 (bootstrap only). These need to be committed and pushed before anything else touches this folder.

.env.local exists at project root with Supabase keys -- not yet re-verified as valid after ~11 months of inactivity (Supabase free-tier projects can auto-pause).

**Phase 2 -- not started:**
- AI clothing classification from photos (shirt/sneakers/jacket, color, style)
- Outfit recommendation logic (occasion + weather based)
- Improved closet UI (filters, cards, categories)
- AI try-on (undecided: OpenAI vision vs. Replicate vs. other)

## Known open items
- [ ] Commit + push untracked feature work to GitHub
- [ ] Fresh npm install + npm run dev to confirm it still runs after ~11 months
- [ ] Confirm Supabase project is still active, keys still valid
- [ ] Folder relocation in progress: from
      C:\Users\saifp\Projects\Style Me\style-me
      to
      D:\OneDrive\Work & Play\Softwares\Work\Artificial Intelligence (Including Backup)\Claude\Claude Code\Style Me

## Working style preferences
- Step-by-step, no skipped steps; overview before diving into detail
- Full code replacements preferred over partial diffs
- Confirm before moving to the next step in multi-step work
