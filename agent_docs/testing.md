# Testing

## What actually exists

Vitest, running against `packages/core` only. Wired up 2026-08-14.

Before that date this file described a Vitest + React Testing Library +
Playwright setup that had never been installed — it was scaffolded from a
template, not written from this repo. If something here looks aspirational
again, check it before believing it.

```
packages/core/src/*.test.ts    — colocated with the code under test
```

There is **no** component testing, **no** route testing, and **no** e2e suite.
Playwright is installed on the machine and works, but nothing is wired into
`package.json` and there is no `e2e/` directory.

## Commands

Run from the repo root — turbo handles package ordering.

- `pnpm test` — single run across all packages (currently just `@mtga/core`)
- `pnpm --filter @mtga/core test:watch` — watch mode while working

`pnpm test` exits non-zero on failure; this was verified with a planted failing
test, not assumed.

## Where tests go

`packages/core` is pure domain logic — no React, no Supabase, no network — so
it needs no environment setup and runs in milliseconds. That is why it went
first, and it is the right home for any rule that can be expressed as a
function: format legality, deck validation, copy limits, parsers.

Prefer moving logic _into_ `packages/core` so it can be tested, over building
test scaffolding around a component.

## Conventions

- Colocate: `deckValidator.ts` → `deckValidator.test.ts`.
- `packages/core/tsconfig.json` excludes `src/**/*.test.ts`, so tests never
  land in `dist/`.
- Use fixture builders (see the `card()` / `deck()` helpers in
  `deckValidator.test.ts`) rather than repeating full object literals.
- Test the rule, not the implementation. Assert on error `type`, not on
  message wording.

## Commit gate

`.claude/hooks/test.sh` runs `pnpm test` before any `git commit`, alongside the
existing lint and typecheck gates.

Note for anyone editing that hook: capture the exit code with an explicit
`|| RC=$?`. Reading `$?` after an `if` block gives the status of the `if`
itself, not the command inside it — that mistake made the first draft of this
hook pass a failing suite, and is the same class of bug that left the typecheck
gate fail-open from init until session 16.

## Not done yet

- Component tests for `DeckEditor` and the card browser
- Route handler tests
- An e2e suite (Playwright is installed but unwired)
