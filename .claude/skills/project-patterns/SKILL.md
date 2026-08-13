---
name: project-patterns
description: MTGA-DeckBuilder's actual conventions — pnpm/turbo monorepo layout, workspace package boundaries, component and route naming, Supabase client split, and the search/filter state pattern. Use when adding files, naming things, deciding which package code belongs in, or writing components that read URL filter state.
---

# Project Patterns

Conventions as they actually exist in this repo. Where these disagree with
`agent_docs/conventions.md`, this file wins — it was written from the tree.

## Monorepo Layout

pnpm workspaces + turbo. Three packages:

```
apps/web        @mtga/web   Next.js 16 App Router, the only deployable
packages/core   @mtga/core  Pure domain logic — zero I/O, zero React
packages/db     @mtga/db    Supabase client + generated DB types
```

Cross-package imports use the workspace alias (`@mtga/core`), never relative
paths that climb out of a package. Inside `apps/web`, use the `@/` alias.

**Where does new code go?**

- Rules that could run in a script or a test with no network → `packages/core`
  (deck validation, format legality, MTGA/Untapped import parsers).
- Anything touching Supabase tables or DB types → `packages/db`.
- Everything else → `apps/web`.

`packages/core/src/index.ts` is a barrel of `export *`. Add new modules there
or they aren't reachable from the app.

## Naming

- **Components**: PascalCase file _and_ export — `CardGrid.tsx`, `ManaCost.tsx`.
  (`agent_docs/conventions.md` says kebab-case; the codebase does not. Follow
  the codebase.)
- **Non-component modules**: camelCase — `deckValidator.ts`, `formatLegality.ts`.
- **Route segments**: lowercase, and dynamic params match the DB column they
  carry — `api/collection/[oracle_id]`, not `[oracleId]`.
- Components group by domain under `components/`: `cards/`, `decks/`,
  `collection/`, `ui/`. `ui/` is for cross-domain presentational pieces only.

## Supabase Client Split

Two entry points, never interchangeable:

- `@/lib/supabase/server` — Server Components, Route Handlers, Server Actions.
- `@/lib/supabase/client` — `"use client"` components only.

`SUPABASE_SERVICE_ROLE_KEY` is server-only and must never reach a file that
carries `"use client"`. Only `NEXT_PUBLIC_*` vars cross to the browser.

Env lives in `apps/web/.env.local` (Next reads from the app dir, not the repo
root). `.env.example` at the root is the template.

## Route Handlers

- Live at `app/api/**/route.ts`, return `NextResponse.json()` with explicit
  status codes.
- `deck_cards` has **no FK to `cards`** — hydrating a deck is deliberately a
  two-query approach (fetch deck rows, then fetch cards by `oracle_id` and
  build a map). Don't try to write it as a join.

## Search & Filter State

Card search state lives in the URL via `searchParams`, so back navigation and
sharing work. Components mirror it into local state for input responsiveness:

- Text inputs keep a local copy and debounce (~350ms) before pushing to the URL.
- When the URL changes externally (back nav, reset), local state re-syncs
  **during render** via the compare-previous-value pattern, not in an effect.
  See `useSyncedState` in `CardSearchFilters.tsx` and the `filterSignature`
  block in `DeckEditor.tsx`.
- Never call `setState` synchronously in an effect body — `react-hooks/set-state-in-effect`
  is an error here, not a warning.
- Pagination is offset-based; changing any filter resets to page 0.

## Images

Card art comes from Scryfall's CDN as raw `<img>` with an eslint-disable
comment. This is a deliberate open item, not an oversight — switching to
`next/image` needs `remotePatterns` config and has cost implications on Vercel.
If you touch these, don't silently convert them.

## Verification

Run from the repo root; turbo handles package ordering:

```bash
pnpm typecheck   # must be clean
pnpm lint        # must be 0 errors (img warnings are known)
pnpm build
```

There is **no test suite wired up** despite `CLAUDE.md` listing `npm test`.
Don't claim tests pass — there are none to run.
