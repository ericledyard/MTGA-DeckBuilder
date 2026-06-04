# MTGA DeckBuilder — Project Todo & Status

_Last updated: 2026-06-04 (session 5)_
_Branch: main (all session 5 work merged)_
_Repo: https://github.com/ericledyard/MTGA-DeckBuilder_
_Vercel project: ledyard111-8901s-projects/mtga-deckbuilder_
_Production URL: https://mtga-deckbuilder.vercel.app_

---

## Project Overview

Full-featured MTG Arena deck management platform:

- Web app (Next.js on Vercel) + iPhone app (Expo/React Native)
- Supabase (PostgreSQL) backend
- Scryfall as card data source (MTGA flags, Alchemy, format legality, art)
- Google ADK + Gemini for agentic AI deck building with Text-to-SQL
- untapped.gg collection import (file upload)
- Card art HD browser
- Physical card scanner (Phase 7, future)

---

## Tech Stack

| Layer     | Choice                                          |
| --------- | ----------------------------------------------- |
| Web       | Next.js 16 (App Router), Vercel                 |
| Mobile    | Expo (React Native), EAS Build                  |
| Database  | Supabase (PostgreSQL + Auth + RLS)              |
| Card data | Scryfall Bulk Data API                          |
| AI agent  | Google ADK + Gemini 1.5 Pro (Python, Cloud Run) |
| Styling   | Tailwind CSS v4 + shadcn/ui (to be added)       |
| Monorepo  | pnpm workspaces + Turborepo                     |

---

## Phases

### ✅ Phase 0 — Tooling & Rig

- [x] cc-rig installed and initialized (Next.js + standard workflow, 87 files)
- [x] GitHub repo created: ericledyard/MTGA-DeckBuilder
- [x] Vercel project linked: mtga-deckbuilder
- [x] pnpm + Turborepo monorepo scaffolded
- [x] Claude Code PR review workflow (.github/workflows/claude.yml)
- [x] `todo.md` project tracker created (this file)
- [x] Memory files created: project_status.md, project_stack.md, gotchas_and_rules.md
- [x] `/endsession` skill created at `.claude/skills/endsession/SKILL.md`
- [x] `/resume` skill created at `.claude/skills/resume/SKILL.md`

### ✅ Phase 1 — Foundation (COMPLETE — live in production)

- [x] Monorepo: pnpm workspaces, turbo.json, tsconfig.base.json
- [x] `packages/core`: Card/Deck/DeckCard types, format legality helpers, deck validator, untapped.gg parser, MTGA export parser/generator
- [x] `packages/db`: Supabase browser + service client, full schema migration (001_initial_schema.sql), real generated types
- [x] `packages/db/migrations/001_initial_schema.sql`: All tables with RLS — cards, sets, card_legalities, card_rulings, user_collections, decks, deck_cards, rules_documents, format_banlists
- [x] `packages/db/migrations/002_search_cards_rpc.sql`: `search_cards` SQL function (EXISTS join, no PostgREST row-limit issue)
- [x] `apps/web`: Next.js app shell, NavBar, home page, card browser page, CardGrid + CardSearchFilters components
- [x] `apps/web/src/app/api/cards/search/route.ts`: Card search API via `search_cards` RPC
- [x] `apps/web/src/app/api/cards/[id]/route.ts`: Single card detail API
- [x] `apps/web/src/app/cards/[id]/page.tsx`: Card detail page (large image, mana cost, oracle text, P/T, legality table, MTGA/Alchemy badges, set symbol, rarity colors)
- [x] `apps/web/src/app/api/sync/scryfall/route.ts`: Sync trigger endpoint + Vercel cron config
- [x] `scripts/sync-scryfall.ts`: Full Scryfall bulk data sync (streaming, cards + sets + legalities) — 114k cards, 412k legality rows
- [x] `.env.example` with all required env vars
- [x] `apps/web/vercel.json`: Daily 6am cron for Scryfall sync
- [x] Supabase project provisioned, migration applied, Scryfall sync complete
- [x] Vercel env vars set (all environments), framework + rootDirectory configured
- [x] Deployed to production: https://mtga-deckbuilder.vercel.app
- [x] `next.config.ts`: Scryfall image domains whitelisted (cards.scryfall.io, imgs.scryfall.io, svgs.scryfall.io)
- [x] All packages typecheck clean

### ✅ Phase 1.5 — Card Browser & Detail Polish (completed session 2)

- [x] `components/ui/ManaCost.tsx`: Renders Scryfall SVG mana symbols (W/U/B/R/G/C + hybrid + phyrexian) — replaces text like "1 U U"
- [x] `components/cards/CardSearchFilters.tsx`: Full MTGA-style advanced filter panel — color (subset/AND logic via `<@`), CMC (0–7+), rarity, type, expansion (scrollable with set icons), format, arena-only
- [x] `packages/db/migrations/003_advanced_search.sql`: Extended `search_cards` RPC with `p_colors`, `p_cmc_values`, `p_rarities`, `p_types`, `p_set_codes` params; color uses PostgreSQL `<@` subset operator
- [x] `/api/cards/sets` route: returns all sets for the expansion picker
- [x] `components/cards/CardImageZoom.tsx`: Hover-to-zoom on card detail page (pointer-events:none overlay, Escape/click-away to close)
- [x] `components/cards/CardPrintingsCarousel.tsx`: All printings stacked fan on detail page — slide cursor left/right to browse, click active card to zoom correct printing; `zoomedPrinting` state captures printing at click time (fixes zoom showing wrong edition)
- [x] `apps/web/src/app/globals.css`: `@keyframes zoomFadeIn` for overlay animation
- [x] Supabase types regenerated after migration 003

### ✅ Phase 2 — Deck Builder UI (COMPLETE — live in production, session 3)

- [x] Supabase Auth — email auth live; Google OAuth stubbed ("coming soon")
- [x] Protected routes — `/decks`, `/decks/new`, `/decks/[id]` redirect to `/login` if unauthenticated
- [x] `src/proxy.ts` (Next.js 16 convention, was middleware.ts) — refreshes Supabase session cookies on every request
- [x] `src/lib/supabase/server.ts` + `client.ts` — SSR server client and browser singleton
- [x] `/auth/callback/route.ts` — handles both PKCE `code` and OTP `token_hash` flows
- [x] `/login` and `/register` pages — Raleway/Anton fonts, amber accent, Google stub button
- [x] `AuthErrorRedirect` on home page — catches Supabase error redirects to site root (hash fragment), forwards to `/login` with readable message
- [x] NavBar auth state — server-side session check, "Sign in" / email + "Sign out"
- [x] API routes: GET/POST `/api/decks`, GET/PUT/DELETE `/api/decks/[id]`, POST/PUT `/api/decks/[id]/cards`
- [x] `/decks` page — deck list with format color badges, card count, last updated
- [x] `/decks/new` page — name + format picker form
- [x] `/decks/[id]` page — full MTGA-style split-pane deck editor:
  - Left panel: scrollable card image grid (3–6 cols), auto-loads arena cards on mount, compact horizontal filter bar (search + color toggles + arena toggle)
  - Right panel: deck name/format, card count with format-aware requirement label, CSS mana curve chart, card list grouped by type with sticky headers, mainboard/sideboard tabs
  - Click or drag cards from grid to add to deck
  - In-deck quantity badge on card image, rarity dot
  - +/− quantity controls in deck list
  - MTGA export button (clipboard)
  - Format validation with inline error count badge
- [x] `ManaCurveChart` — pure CSS bar chart (replaced recharts which crashed on React 19 with NaN cmc)
- [x] `ColorBreakdown` — Scryfall SVG mana icons
- [x] `DeckCardRow` — compact card rows with mana cost symbols
- [x] Format rules corrected: Brawl = 100 cards (was 60), `FORMAT_RULES` exported from `@mtga/core`
- [x] Fonts: Anton for headers, Raleway for body text (swapped from Geist)

**Known remaining items / polish:**

- [ ] Google OAuth — needs Supabase provider config in dashboard then remove stub
- [ ] Drag-and-drop visual feedback (drop zone highlight while dragging)
- [ ] Color identity breakdown visible in deck panel (component exists, not wired in new layout)

### ✅ Phase 2.6 — UX Polish (COMPLETE — live in production, session 5)

- [x] Deck editor card browser: hover zoom — 80% panel overlay, 80ms debounce, clears on drag
- [x] Card browser "Back to card browser" link now restores all active filters via `?ref=` param
- [x] Card browser: filter panel collapsed by default behind amber **Filters** button with active-count badge
- [x] Deck editor: filter panel collapsed by default behind amber **Filters** button with active-count badge
- [x] Both search inputs (name + oracle text) debounced 350ms — no more per-keystroke API calls
- [x] Deck editor expanded filter panel: full CMC / Rarity / Type / Expansion pickers (matches card browser)
- [x] Global `~/.claude/CLAUDE.md` created — deploy workflow and phase-transition rules embedded
- [x] Deployment workflow corrected: always commit → PR → merge to main → Vercel auto-deploys (PR #5–8 all merged)

### ✅ Phase 2.5 — Search & UX Polish (COMPLETE — live in production, session 4)

- [x] Migration 004: `search_cards` RPC now sorts results by CMC asc, name asc (subquery pattern to decouple DISTINCT ON from ORDER BY)
- [x] Migration 005: GIN trgm index on `oracle_text` + `p_text_query` param added to `search_cards` RPC
- [x] API `/api/cards/search`: accepts `?text=` param for oracle text keyword search
- [x] Card browser: filter state now persists via URL search params (back button restores all filters)
- [x] Card browser: two search inputs — "Search by name" + "Card text contains" (e.g. Connive, +1/+1, draw a card)
- [x] Deck editor: oracle text search row added to compact filter bar (second row below name/color/arena)
- [x] Hook fix: all `.claude/hooks/*.sh` now use absolute paths in settings.json (was relative, caused "No such file" errors on every Stop hook)

### 🔲 Phase 3 — Collection Management

- [ ] untapped.gg file upload UI (drag-and-drop)
- [ ] Collection import parser wired to `/api/collection/import`
- [ ] Collection browser page (`/collection`)
- [ ] "Build from collection" toggle in deck editor
- [ ] Collection stats (set completion %, format coverage)
- [ ] Manual card add/remove

### 🔲 Phase 4 — AI Deck Builder (Google ADK + Gemini)

- [ ] `packages/ai-agent/` Python FastAPI + Google ADK service
- [ ] Tools: search_cards (Text-to-SQL), validate_deck, get_synergies, get_owned_cards
- [ ] Text-to-SQL: Gemini generates parameterized SQL, whitelist validator (SELECT only, no auth tables)
- [ ] Cloud Run deployment (Dockerfile + cloudbuild.yaml)
- [ ] Next.js `/api/ai/build` route proxying to Cloud Run
- [ ] AI Builder UI page (`/ai-builder`) — prompt input, streaming response, deck preview
- [ ] "Import to deck editor" from AI result

### 🔲 Phase 5 — Card Art Browser

- [ ] `/art` page — full-screen HD art viewer
- [ ] Scryfall `image_uri.art_crop` + `image_uri.large` display
- [ ] Filter by artist, set, color identity
- [ ] Favorite art (per user, saved to Supabase)
- [ ] Keyboard/swipe navigation between cards

### 🔲 Phase 6 — Expo Mobile App

- [ ] `apps/mobile/` Expo scaffold
- [ ] Shared `@mtga/core` + `@mtga/db` types
- [ ] Tab navigation: Search, Decks, Collection, AI Builder, Art Browser
- [ ] Auth via Supabase (Expo SecureStore for tokens)
- [ ] EAS Build config → TestFlight → App Store submission

### 🔲 Phase 7 — MTG Rules Sync System

- [ ] `scripts/sync-rules.ts` — fetch Wizards comprehensive rules txt
- [ ] Parse banned/restricted announcements
- [ ] `/api/sync/rules` endpoint (admin-authed)
- [ ] Weekly cron
- [ ] "Rules last updated" indicator in UI

### 🔲 Phase 8 — Physical Card Scanner (Future)

- [ ] Expo Camera API integration
- [ ] Card name OCR → DB lookup
- [ ] Mythic Tools / TCGPlayer CSV import
- [ ] Physical collection management separate from Arena collection

---

## File Map (key files)

```
MTGA-DeckBuilder/
├── apps/web/src/
│   ├── app/
│   │   ├── layout.tsx                  — root layout, NavBar
│   │   ├── page.tsx                    — home page
│   │   ├── cards/page.tsx              — card browser (search + filters)
│   │   ├── cards/[id]/page.tsx         — card detail (image, text, legality)
│   │   └── api/
│   │       ├── cards/search/route.ts   — GET search via search_cards RPC
│   │       ├── cards/[id]/route.ts     — GET single card + legalities
│   │       └── sync/scryfall/route.ts  — POST sync trigger + cron
│   ├── (auth)/login/page.tsx           — email login, Google stub
│   ├── (auth)/register/page.tsx        — signup with confirm email flow
│   ├── auth/callback/route.ts          — PKCE code + OTP token_hash exchange
│   ├── decks/page.tsx                  — deck list with format badges
│   ├── decks/new/page.tsx              — create deck form
│   ├── decks/[id]/page.tsx             — deck editor (server, hydrates cards)
│   ├── api/decks/route.ts              — GET list / POST create
│   ├── api/decks/[id]/route.ts         — GET/PUT/DELETE single deck
│   ├── api/decks/[id]/cards/route.ts   — POST add / PUT set quantity
│   ├── src/proxy.ts                    — Supabase session refresh (Next.js 16 proxy)
│   ├── src/lib/supabase/server.ts      — SSR Supabase client (cookies)
│   ├── src/lib/supabase/client.ts      — browser singleton
│   └── components/
│       ├── cards/CardGrid.tsx              — card tile grid
│       ├── cards/CardSearchFilters.tsx     — MTGA-style advanced filter panel (color/CMC/rarity/type/set)
│       ├── cards/CardPrintingsCarousel.tsx — stacked fan of all printings; slide to browse, click to zoom
│       ├── cards/CardImageZoom.tsx         — hover-to-zoom overlay (pointer-events:none pattern)
│       ├── decks/DeckEditor.tsx            — MTGA split-pane editor (card grid left, deck list right)
│       ├── decks/DeckCardRow.tsx           — compact deck card row with qty controls + mana cost
│       ├── decks/ManaCurveChart.tsx        — pure CSS bar chart (0–7+ CMC buckets)
│       ├── decks/ColorBreakdown.tsx        — color distribution with Scryfall SVG icons
│       └── ui/
│           ├── NavBar.tsx                  — top navigation (server, reads auth session)
│           ├── NavBarAuthButton.tsx        — client auth state (sign in / sign out)
│           ├── AuthErrorRedirect.tsx       — catches Supabase error hash on home page
│           └── ManaCost.tsx                — renders Scryfall SVG mana symbols
├── packages/
│   ├── core/src/
│   │   ├── types/card.ts           — Card, Deck, DeckCard, Format types
│   │   ├── formatLegality.ts       — isCardLegalInFormat(), isArenaFormat()
│   │   ├── deckValidator.ts        — validateDeckStructure(), format rules
│   │   └── parsers/
│   │       ├── untapped.ts         — parseUntappedExport(), parseUntappedCollection()
│   │       └── mtgaExport.ts       — parseMtgaExport(), deckToMtgaExport()
│   └── db/
│       ├── migrations/001_initial_schema.sql
│       ├── migrations/002_search_cards_rpc.sql
│       ├── migrations/003_advanced_search.sql  — extended search_cards RPC (color/CMC/rarity/type/set)
│       └── src/
│           ├── client.ts           — createBrowserClient(), createServiceClient()
│           └── types.ts            — generated types (supabase gen types)
└── scripts/
    └── sync-scryfall.ts            — bulk Scryfall sync (streaming, run with pnpm tsx)
```

---

## Gotchas & Rules Established

### Git / Workflow

- **cc-rig hook blocks direct push to main** — always use a feature branch + PR
- **GitHub token needs `workflow` scope** to push `.github/workflows/` files (re-auth with `gh auth refresh -h github.com -s workflow`)
- Commit messages follow conventional style; co-author line required for Claude commits
- **Always use the GitHub → Vercel pipeline** — commit on feature branch → push → `gh pr create` → `gh pr merge --merge` → Vercel auto-deploys from main. Never run `vercel deploy --prod` directly.
- **Full pipeline is one atomic action** — when user says "commit" or "deploy", run the entire commit→PR→merge sequence without pausing for confirmation
- **Global deploy rule in `~/.claude/CLAUDE.md`** — applies to all projects, not just this one

### Data / Scryfall

- MTGA flag: `card.games.includes("arena")` in Scryfall data
- Alchemy detection: `card.set_type === "alchemy"` OR `card.name.startsWith("A-")`
- Double-faced cards (DFC) store images on `card_faces[0].image_uris`, not top-level `image_uris`
- Scryfall rate limit: 10 req/sec — bulk download is one large file, not per-card requests
- `default_cards` bulk file = all printings (~100MB compressed, ~500MB uncompressed); must stream — do NOT use `response.json()` directly (hits Node string length limit)
- Always send `User-Agent` header to Scryfall API requests
- **Scryfall legalities include unsupported formats** (explorer, historicbrawl, oathbreaker, penny, premodern, etc.) — filter to only `SUPPORTED_FORMATS` before upserting or every batch fails silently
- **Some Scryfall cards have null oracle_id** (tokens/art cards) — skip with `if (!c.oracle_id) continue` or whole batch fails
- **PostgREST default row limit is 1000** — any query expecting more rows (e.g. all legal cards in a format) must use a SQL RPC with EXISTS, not a `.in()` filter

### Database

- RLS is ON for all tables — use `createServiceClient()` (service role) for sync jobs, `createBrowserClient()` (anon) for user-facing queries
- After any schema change: run `supabase gen types typescript --linked 2>/dev/null | grep -v "^Initialising" > packages/db/src/types.ts` then `pnpm --filter @mtga/db build`
- `pg_trgm` extension required for fuzzy card name search — already in migration
- Card search uses `search_cards` RPC (EXISTS join) — much faster than two-query approach

### Next.js / Vercel

- Next.js version is 16.2.7 (newer than training data — read node_modules/next/dist/docs/ if unsure)
- Tailwind is v4 (different config from v3 — no tailwind.config.js, uses CSS @import)
- `vercel.json` cron in `apps/web/` (not root) because Vercel deploys the web app, not the monorepo root
- `maxDuration = 300` needed on the sync API route for Vercel Pro/Enterprise
- **Vercel project rootDirectory must be `apps/web`**, framework `nextjs` — set via API (CLI alone doesn't surface this)
- **Do NOT have a `pnpm-workspace.yaml` inside `apps/web`** — it makes pnpm treat it as a broken workspace root and fails Vercel CI with "packages field missing or empty"
- `vercel env add ... preview` requires `--value "..." ""` (empty string as third arg for all preview branches) — `--yes` flag alone doesn't work in v54
- `supabase gen types` prints "Initialising login role..." to stdout — pipe through `grep -v "^Initialising"` before writing to file

### Mana Symbols / UI

- **Mana symbols use Scryfall SVG CDN** — `https://svgs.scryfall.io/card-symbols/{SYMBOL}.svg` (already whitelisted in next.config.ts). Use `<img>` not `next/image` for variable-size icons.
- **Color filter uses PostgreSQL `<@` (subset) operator** — `c.colors <@ p_colors` means "card's colors are within the selected palette." This is AND/subset logic: selecting R+G shows only mono-R, mono-G, and R/G cards. Colorless ('C') handled separately as `c.colors = '{}'`.
- **Zoom overlay + hover interaction conflict** — when a `fixed inset-0` overlay appears, the browser fires `mouseleave` on any element beneath it. If you have state that resets on `onMouseLeave`, capture the value into a separate ref/state before the overlay opens. Pattern: `zoomedPrinting` state set at click time, not derived from hover state.
- **`supabase db query --linked -f <file>`** is the correct way to run a migration SQL file against the remote Supabase DB via CLI (not `supabase db push`, which uses migration history tracking).
- **`CREATE OR REPLACE FUNCTION` requires matching signature** — if a function has been previously created with fewer params, it's a different overload. Add `DROP FUNCTION IF EXISTS fn(old, signature)` before the `CREATE OR REPLACE` in the migration.

### Auth / Supabase SSR

- **`proxy.ts` not `middleware.ts`** in Next.js 16 — the file must export `proxy` function, not `middleware`. Using the old name causes a build error.
- **`@supabase/ssr`** is the correct auth library for Next.js App Router. `createBrowserClient` for client components, `createServerClient` (with cookie store) for RSC/route handlers.
- **Supabase auth callback handles two flows**: PKCE (`code` param) for OAuth/magic links, OTP (`token_hash` + `type` params) for email confirmations. Must handle both in `/auth/callback/route.ts`.
- **Supabase redirect URLs must be whitelisted** in Dashboard → Authentication → URL Configuration → Redirect URLs. Add `http://localhost:3000/**` and `https://mtga-deckbuilder.vercel.app/**`. Without this, confirmation emails redirect to the site root with errors in the hash fragment.
- **`@supabase/supabase-js` must be in `apps/web/package.json`** directly — even though it's in `@mtga/db`, Vercel's build won't resolve it for client-side types without an explicit dependency.
- **`useSearchParams()` needs a `<Suspense>` boundary** in Next.js App Router pages — extract it into a sub-component wrapped in `<Suspense>` or the build fails with a static generation error.

### React 19 Error Handling

- **React 19 routes event handler errors to error boundaries** — any uncaught throw in onClick/onDrop/etc. triggers the nearest `error.tsx`. Always add `.catch(() => {})` to fire-and-forget `fetch()` calls inside event handlers.
- **`card.cmc` from the search API can be NaN** for some cards (tokens, special cards) — always guard with `Number(card.cmc) || 0` before using in array index calculations. `buckets[NaN]` = `undefined` and crashes the component.
- **Drag double-fire**: browsers fire `click` after `dragend` on some setups. Use a `isDraggingRef` to suppress the `onClick` handler during/after a drag.

### Format Rules

- **Brawl = 100 cards exactly** (MTGA uses Historic Brawl rules), singleton, commander required. The old deckValidator had 60 which was wrong.
- **`FORMAT_RULES` is now exported** from `@mtga/core/deckValidator` so UI components can read format-specific requirements without duplicating logic.
- **Card search API param**: arena filter is `arena=1` (not `arena_only=true`). API response is a plain array (not `{ cards: [] }`).

### Environment Variables

- Copy `.env.example` → `.env.local` (never commit `.env.local`)
- Required vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SYNC_SECRET`
- Supabase now issues `sb_publishable_...` keys (equivalent to old anon key) — store as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Phase 4 adds: `GOOGLE_AI_API_KEY`, `ADK_AGENT_URL`

---

## Commands Reference

```bash
# Dev
pnpm dev                              # start all apps
pnpm --filter @mtga/web dev           # start web only

# Build & typecheck
pnpm build                            # turbo build all
pnpm --filter @mtga/core build        # build core package
pnpm --filter @mtga/web typecheck     # typecheck web app

# Scryfall sync (streaming, safe for large files)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm tsx scripts/sync-scryfall.ts

# Supabase types (run after any migration)
supabase link --project-ref ozdcbklmswydbbzxinij
supabase gen types typescript --linked 2>/dev/null | grep -v "^Initialising" > packages/db/src/types.ts
pnpm --filter @mtga/db build

# Deploy (always production)
cd apps/web && vercel deploy --prod

# Git (always branch — cc-rig blocks direct push to main)
git checkout -b feature/your-feature
git push -u origin feature/your-feature
gh pr create --title "..." --body "..."
```
