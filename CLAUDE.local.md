# Personal Preferences (CLAUDE.local.md)

This file is for your personal preferences. It is not tracked by git.
Uncomment and edit the examples below, or add your own.

## Preferences

<!-- Uncomment any preferences you want to set:
- Always use descriptive variable names.
- Prefer functional style over imperative.
- Use type annotations on all public functions.
-->

## Personal Context

<!-- Add any personal context here:
- I am working on the payments module this sprint.
- My local dev environment uses Docker Compose.
-->

## Machine Setup (new MacBook Pro, 2026-08-13)

`CLAUDE.md` has been corrected directly — it is now the source of truth for
commands and layout. Nothing here duplicates it.

- pnpm 9.15.0 via `corepack enable` (not a global install).
- Env: `apps/web/.env.local` — **still holds the example values copied from
  `.env.example`**. Supabase-backed pages will fail until real keys are pasted in.
- **No Homebrew on this machine** (install needs sudo). `gh` 2.97.0 and
  `supabase` 2.114.0 are user-local binaries in `~/.local/bin`; `vercel` 58.11.0
  is an npm global. `~/.local/bin` is prepended to PATH in `~/.zshrc`.
  Upgrades are manual re-downloads, not `brew upgrade`.
- **All three CLIs are unauthenticated.** Run `gh auth login`, `supabase login`,
  `vercel login` — each is interactive.
- Playwright: browsers in `~/Library/Caches/ms-playwright`. Node and Python
  Playwright pin *different* chromium revisions (1234 / 1223) — both installed.
  Python package is a `pip --user` install for the `webapp-testing` skill.
- MCP: `.mcp.json` previously pointed at `@anthropic/mcp-playwright`, which does
  not exist on npm (404) — it never worked, and GreatBanquet-Site still has the
  same dead entry. Repo-level `mcpServers` is now empty; the `playwright` plugin
  supplies a working server via `npx @playwright/mcp@latest`.
- `agent_docs/testing.md` and `agent_docs/conventions.md` are both stale:
  testing.md describes a Vitest/Playwright suite that doesn't exist, and
  conventions.md claims kebab-case component files while the tree uses
  PascalCase. `.claude/skills/project-patterns` documents the real conventions.

## Open Items

- 11 eslint warnings, all `@next/next/no-img-element` — Scryfall CDN images in
  `DeckEditor` (7), `CardSearchFilters` (2), `ColorBreakdown`, `ManaCost`.
  Converting to `next/image` needs `remotePatterns` in `next.config` and has
  Vercel image-optimization cost implications. Deliberate, not an oversight.
- No test suite (see above). Playwright is installed and working, but nothing is
  wired into `package.json` and there is no `e2e/` directory.
- `.claude/skills/webapp-testing/` ships only `SKILL.md`; the `scripts/with_server.py`
  helper it references was never installed. Reinstall the skill if you need it.
- `GreatBanquet-Site` has the same dead `@anthropic/mcp-playwright` MCP entry —
  worth the same fix over there.
