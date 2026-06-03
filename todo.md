# MTGA DeckBuilder — Project Todo & Status

_Last updated: 2026-06-03_
_Branch: phase1/foundation_
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

### 🔲 Phase 2 — Deck Builder UI

- [ ] Deck list page (`/decks`) — user's decks, format badges, card count
- [ ] Deck editor page (`/decks/[id]`) — add/remove cards, sideboard, stats panel
- [ ] Deck create page (`/decks/new`) — name, format picker
- [ ] Mana curve chart (recharts or d3)
- [ ] Color identity breakdown
- [ ] MTGA export button (copy to clipboard)
- [ ] Format validation overlay (shows illegal cards inline)
- [ ] Supabase Auth — email + Google OAuth
- [ ] Protected routes (redirect to login if unauthenticated)

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
│   └── components/
│       ├── cards/CardGrid.tsx          — card tile grid
│       ├── cards/CardSearchFilters.tsx — search bar + format + arena toggle
│       └── ui/NavBar.tsx               — top navigation
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
- **Always deploy to production** with `vercel deploy --prod` — never preview-only

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
